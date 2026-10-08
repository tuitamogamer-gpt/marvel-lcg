import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { makePiece, newGame } from "../src/game/engine.js";
import {
  paymentSources,
  paymentStatus,
  resourcesFor,
} from "../src/game/payment.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Resource } from "../src/game/types.js";

function fixture(heroId = "spectrum", team = false) {
  const s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    seed: 21018,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "leadership" as const },
          ],
        }
      : {}),
  });
  s.heroId = heroId;
  s.players[0].heroId = heroId;
  s.prompt = null;
  s.review = null;
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.inPlay = [];
    view.player.hand = [];
  }
  return s;
}
function put(s: GameState, code: string) {
  const p = makePiece(s, code);
  s.player.inPlay.push(p);
  return p;
}
function hand(s: GameState, code: string) {
  const p = makePiece(s, code);
  s.player.hand.push(p);
  return p;
}

describe("MTS resource providers in actual payment sources", () => {
  it.each([
    ["21002", "physical"],
    ["21003", "mental"],
    ["21004", "energy"],
  ] as [string, Resource][])(
    "Energy Duplication copies the active physical %s form's %s icon",
    (code, resource) => {
      const s = fixture();
      const forms = ["21002", "21003", "21004"].map((c) => put(s, c));
      s.flags.spectrumEnergyFormId = forms.find((p) => p.code === code)!.id;
      const first = put(s, "21006"),
        second = put(s, "21006");
      const sources = paymentSources(s);
      expect(sources.map((source) => source.id)).toEqual([first.id, second.id]);
      expect(sources.map((source) => source.resources)).toEqual([
        [resource],
        [resource],
      ]);
      expect(
        paymentStatus(sources, [first.id, second.id], 2, [resource, resource])
          .ready,
      ).toBe(true);
      const restored = JSON.parse(JSON.stringify(s)) as GameState;
      expect(
        paymentSources(restored).map((source) => source.resources),
      ).toEqual([[resource], [resource]]);
    },
  );
  it("requires a ready Energy Duplication, a physical faceup form and hero form", () => {
    const s = fixture(),
      form = put(s, "21002"),
      duplication = put(s, "21006");
    expect(paymentSources(s)).toEqual([]);
    s.flags.spectrumEnergyFormId = form.id;
    expect(paymentSources(s).map((p) => p.id)).toEqual([duplication.id]);
    duplication.exhausted = true;
    expect(paymentSources(s)).toEqual([]);
    duplication.exhausted = false;
    s.player.form = "alter";
    expect(paymentSources(s)).toEqual([]);
    s.player.form = "hero";
    s.player.inPlay.splice(s.player.inPlay.indexOf(form), 1);
    expect(paymentSources(s)).toEqual([]);
  });
  it.each(["hero", "alter"] as const)(
    "offers Karmic Staff once in %s form and stops after exhaustion",
    (form) => {
      const s = fixture("warlock"),
        staff = put(s, "21034");
      s.player.form = form;
      const sources = paymentSources(s);
      expect(sources.filter((p) => p.id === staff.id)).toHaveLength(1);
      expect(sources.find((p) => p.id === staff.id)?.resources).toEqual([
        "wild",
      ]);
      expect(paymentStatus(sources, [staff.id], 1, ["mental"]).ready).toBe(
        true,
      );
      staff.exhausted = true;
      expect(paymentSources(s).some((p) => p.id === staff.id)).toBe(false);
    },
  );
  it.each([0, 1, 2, 3, 4])(
    "Band Together generates the capped wild count with %s controlled allies",
    (count) => {
      const s = fixture(),
        together = hand(s, "21018");
      for (let n = 0; n < count; n++) put(s, "21012");
      put(s, "21020");
      const expected = Array<Resource>(Math.min(3, count)).fill("wild");
      expect(resourcesFor(s, together)).toEqual(expected);
      const source = paymentSources(s).find((p) => p.id === together.id);
      if (count) expect(source?.resources).toEqual(expected);
      else expect(source).toBeUndefined();
    },
  );
  it("counts controlled allies instead of owner IDs or teammates' allies", () => {
    const s = fixture("spectrum", true),
      together = hand(s, "21018");
    const other = seatView(s, s.players[1]);
    const loan = put(s, "21019");
    loan.ownerId = other.activePlayerId;
    put(other, "21012");
    put(other, "21013");
    expect(resourcesFor(s, together)).toEqual(["wild"]);
    const theirs = hand(other, "21018");
    expect(resourcesFor(other, theirs)).toEqual(["wild", "wild"]);
    s.player.inPlay.splice(s.player.inPlay.indexOf(loan), 1);
    other.player.inPlay.push(loan);
    expect(paymentSources(s).some((p) => p.id === together.id)).toBe(false);
    expect(resourcesFor(other, theirs)).toEqual(["wild", "wild", "wild"]);
  });
  it("keeps printed fallback resources and Power-of doubling for actual ability subjects", () => {
    const s = fixture(),
      aggression = hand(s, "01055"),
      basic = hand(s, "13024");
    expect(resourcesFor(s, aggression)).toEqual(["wild"]);
    expect(resourcesFor(s, aggression, card("21041"))).toEqual([
      "wild",
      "wild",
    ]);
    expect(resourcesFor(s, basic, card("21019"))).toEqual(["wild", "wild"]);
    expect(
      paymentSources(s, aggression.id, "21019", true).map((p) => p.resources),
    ).toEqual([["wild", "wild"]]);
  });
  it("hand-only costs hide generated abilities while preserving eligible physical hand sources", () => {
    const s = fixture("spider_man");
    s.player.form = "alter";
    const staff = put(s, "21034"),
      together = hand(s, "21018"),
      excluded = hand(s, "01088");
    put(s, "21019");
    const ordinary = paymentSources(s, excluded.id, "21019");
    expect(new Set(ordinary.map((p) => p.id))).toEqual(
      new Set([together.id, staff.id, "scientist"]),
    );
    const fromHand = paymentSources(s, excluded.id, "21019", true);
    expect(fromHand.map((p) => p.id)).toEqual([together.id]);
    expect(fromHand.every((p) => p.kind === "card")).toBe(true);
    expect(paymentStatus(fromHand, [together.id], 1, ["physical"]).ready).toBe(
      true,
    );
    expect(paymentStatus(fromHand, [staff.id, "scientist"], 1).ready).toBe(
      false,
    );
  });
});
