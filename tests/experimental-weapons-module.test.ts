import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import {
  EXPERIMENTAL_WEAPONS_SCRIPT_CODES,
  experimentalWeaponsActionEffects,
  experimentalWeaponsActions,
  experimentalWeaponsAttackResponses,
  experimentalWeaponsRanged,
  experimentalWeaponsRetaliate,
  resolveExperimentalWeaponsEffect,
  type ExperimentalWeaponsPorts,
} from "../src/game/experimental-weapons.js";

function fixture() {
  const s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    module: "exper_weapon",
    seed: 4072,
  });
  s.phase = "player";
  s.player.form = "hero";
  const take = (code: string) => {
    const index = s.encounter.deck.findIndex((p) => p.code === code);
    expect(index).toBeGreaterThanOrEqual(0);
    const p = s.encounter.deck.splice(index, 1)[0];
    p.attachedTo = s.villain.id;
    s.attachments.push(p);
    return p;
  };
  const ports: ExperimentalWeaponsPorts = {
    queue: vi.fn(),
    choose: vi.fn(),
    attach: vi.fn(),
    pay: vi.fn(),
    canPay: vi.fn(() => true),
    discardPiece: vi.fn(),
    discardHand: vi.fn(),
  };
  return { s, take, ports };
}

describe("Experimental Weapons printed and saved-effect contracts", () => {
  it("closes exactly the four original one-copy printings", () => {
    const source = catalog.filter((p) => p.set_code === "exper_weapon");
    expect(source.map((p) => p.code)).toEqual([
      ...EXPERIMENTAL_WEAPONS_SCRIPT_CODES,
    ]);
    expect(source.map((p) => p.quantity)).toEqual([1, 1, 1, 1]);
    expect(
      source.every(
        (p) => p.pack_code === "trors" && p.type_code === "attachment",
      ),
    ).toBe(true);
  });

  it("only the actually attached villain receives the weapon keywords", () => {
    const { s, take } = fixture();
    const rifle = take("04072"),
      shield = take("04073");
    expect(experimentalWeaponsRanged(s, s.villain.id)).toBe(true);
    expect(experimentalWeaponsRetaliate(s, s.villain.id)).toBe(1);
    rifle.attachedTo = shield.attachedTo = "unrelated-minion";
    expect(experimentalWeaponsRanged(s, s.villain.id)).toBe(false);
    expect(experimentalWeaponsRetaliate(s, s.villain.id)).toBe(0);
    expect(experimentalWeaponsRetaliate(s, "unrelated-minion")).toBe(0);
  });

  it("does not offer another source's removal action and rejects forged action IDs", () => {
    const { s, take } = fixture();
    const p = take("04072");
    expect(experimentalWeaponsActionEffects(s, s.villain, "remove")).toBeNull();
    expect(() =>
      experimentalWeaponsActionEffects(s, p, "invented-action"),
    ).toThrow(/not available/);
    s.player.form = "alter";
    expect(experimentalWeaponsActions(s, p)).toEqual([]);
    expect(() => experimentalWeaponsActionEffects(s, p, "remove")).toThrow(
      /not available/,
    );
  });

  it("uses only actual identity damage and a surviving recipient for Gauntlets", () => {
    const { s, take } = fixture();
    take("04074");
    expect(s.player.hand.length).toBeGreaterThan(0);
    expect(
      experimentalWeaponsAttackResponses(s, s.villain.id, "p1", 0),
    ).toEqual([]);
    expect(
      experimentalWeaponsAttackResponses(s, "another-enemy", "p1", 3),
    ).toEqual([]);
    const responses = experimentalWeaponsAttackResponses(
      s,
      s.villain.id,
      "p1",
      1,
    );
    expect(responses).toHaveLength(1);
    expect(responses[0].effects[0]).toMatchObject({
      actorId: "p1",
      mandatory: true,
    });
    s.players[0].eliminated = true;
    expect(
      experimentalWeaponsAttackResponses(s, s.villain.id, "p1", 1),
    ).toEqual([]);
  });

  it("rechecks the live hand when a saved mandatory discard choice opens", () => {
    const { s, take, ports } = fixture();
    take("04074");
    const e = experimentalWeaponsAttackResponses(s, s.villain.id, "p1", 1)[0]
      .effects[0];
    const saved = JSON.parse(JSON.stringify(s));
    seatView(saved, "p1").player.hand = [];
    expect(resolveExperimentalWeaponsEffect(saved, e, ports)).toBe(true);
    expect(ports.choose).not.toHaveBeenCalled();
    expect(ports.discardHand).not.toHaveBeenCalled();
  });

  it("does not pay or discard an attachment that left before the saved action", () => {
    const { s, take, ports } = fixture();
    const p = take("04075");
    const [effect] = experimentalWeaponsActionEffects(s, p, "remove")!;
    s.encounter.discard.push(...s.attachments.splice(0));
    expect(() => resolveExperimentalWeaponsEffect(s, effect, ports)).toThrow(
      /no longer available/,
    );
    expect(ports.pay).not.toHaveBeenCalled();
    expect(ports.discardPiece).not.toHaveBeenCalled();
  });

  it("completes an accepted paid removal even if the source subsequently becomes blank", () => {
    const { s, take, ports } = fixture();
    const p = take("04072");
    s.flags[`deadpoolRay:${p.id}`] = true;
    resolveExperimentalWeaponsEffect(
      s,
      { type: "experimental-weapons:remove-paid", id: p.id },
      ports,
    );
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
  });
});
