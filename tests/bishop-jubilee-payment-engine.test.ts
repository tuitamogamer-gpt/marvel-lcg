import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece, Resource } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  hand,
  put,
  reload,
  target,
} from "./dv-test-helpers.js";

function base() {
  let s = newGame({
    heroId: "jubilee",
    aspect: "justice",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 47001,
    pacing: "expert",
    heroes: [
      { heroId: "jubilee", aspect: "justice" },
      { heroId: "bishop", aspect: "leadership" },
    ],
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.deck.push(...view.player.hand.splice(0));
    view.player.form = "hero";
    view.player.flipped = false;
  }
  s.villain.hp = s.villain.maxHp = 100;
  s.scheme.threat = 5;
  s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  put(s, "47004");
  return s;
}
function initiate(
  s: GameState,
  event: Piece,
  sources: Piece[],
  wildAs?: Resource,
) {
  s = command(s, { type: "PLAY", id: event.id });
  return command(s, {
    type: "PAY",
    ids: sources.map((p) => p.id),
    ...(wildAs ? { wildAs } : {}),
  });
}
function allocate(s: GameState, wanted: Resource[]) {
  expect(s.prompt?.title).toBe("Allocate payment resources");
  const key = (resources: Resource[]) => [...resources].sort().join(":");
  const option = s.prompt!.options.find((o) =>
    o.effects.some(
      (e) =>
        e.type === "commitPaymentAllocation" &&
        key(e.paidForCard) === key(wanted),
    ),
  );
  expect(option).toBeDefined();
  return choose(reload(s), option!.id);
}
function spentOnce(s: GameState, pieces: Piece[]) {
  for (const piece of pieces)
    expect(s.player.discard.filter((p) => p.id === piece.id)).toHaveLength(1);
}

describe("Bishop event payment under Jubilee's independent Wild declarations", () => {
  it.each(["45007", "45008"])(
    "borrowed %s accepts mixed declarations, preserving actual Resource-card payment and identity ownership",
    (code) => {
      let s = base();
      const pieces = hand(
        s,
        code,
        "45019",
        "47003",
        ...(code === "45007" ? ["47007c"] : []),
      );
      s.player.exhausted = true;
      seatView(s, "p2").player.exhausted = true;
      s = initiate(s, pieces[0], pieces.slice(1));
      s = choose(reload(s), "energy");
      s = choose(reload(s), "mental");
      expect(s.prompt?.title).not.toBe("Allocate resource-card payment");
      s = finish(target(s, code === "45007" ? s.villain.id : "main"));
      expect(
        JSON.parse(String(s.flags[`jubileePaid:${pieces[0].id}`])).sort(),
      ).toEqual(
        ["energy", "mental", ...(code === "45007" ? ["physical"] : [])].sort(),
      );
      expect(s.player.hand).toHaveLength(code === "45008" ? 1 : 0);
      expect(seatView(s, "p2").player.exhausted).toBe(code === "45008");
      expect(s.player.exhausted).toBe(true);
      spentOnce(s, pieces);
    },
  );
  it("matches the declared type to its physical Resource source when overpaid Wild icons look identical", () => {
    for (const usedResourceCard of [false, true]) {
      let s = base();
      const pieces = hand(s, "45008", "45019", "47003", "47005");
      s = initiate(s, pieces[0], pieces.slice(1));
      for (const declared of ["energy", "mental", "physical"])
        s = choose(reload(s), declared);
      const paid: Resource[] = usedResourceCard
        ? ["energy", "mental"]
        : ["mental", "physical"];
      s = allocate(s, paid);
      expect(s.prompt?.title).not.toBe("Allocate resource-card payment");
      s = finish(target(reload(s), "main"));
      expect(s.player.hand).toHaveLength(Number(usedResourceCard));
      expect(
        JSON.parse(String(s.flags[`jubileePaid:${pieces[0].id}`])).sort(),
      ).toEqual(paid.sort());
      spentOnce(s, pieces);
    }
  });
});

describe("Crushing Blow honors Jubilee's actual Wild declarations", () => {
  it("accepts a Wild declared Physical even when the original aggregate wildAs was Energy", () => {
    let s = base();
    const pieces = hand(s, "10002", "47003");
    s = initiate(s, pieces[0], pieces.slice(1), "energy");
    s = choose(reload(s), "physical");
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(99);
    expect(JSON.parse(String(s.flags[`jubileePaid:${pieces[0].id}`]))).toEqual([
      "physical",
    ]);
    spentOnce(s, pieces);
  });
  it.each(["mental", "wild"])(
    "rejects an explicitly declared %s without spending selected sources despite aggregate wildAs Physical",
    (declared) => {
      let s = base();
      const pieces = hand(s, "10002", "47003", "47005");
      s = initiate(s, pieces[0], pieces.slice(1), "physical");
      s = choose(reload(s), "physical");
      s = dispatch(reload(s), { type: "CHOOSE", id: declared });
      expect(s.error).toMatch(/only be paid with physical/);
      expect(s.player.hand.map((p) => p.id)).toEqual(pieces.map((p) => p.id));
      expect(
        s.player.discard.some((p) => pieces.some((q) => q.id === p.id)),
      ).toBe(false);
    },
  );
});
