import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import type { Command, Effect, GameState } from "../src/game/types";

function command(input: GameState, cmd: Command): GameState {
  let s = dispatch(input, cmd);
  expect(s.error).toBeUndefined();
  let guard = 0;
  while (s.review && guard++ < 50) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}

function captain() {
  let s = newGame({
    heroId: "captain_america",
    villainId: "rhino",
    aspect: "leadership",
    seed: 42,
    pacing: "expert",
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  s.player.form = "hero";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.queue = [];
  s.review = null;
  return s;
}

function native(s: GameState, effect: Effect) {
  s.queue = [effect];
  s.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "Resolve the queued native effect.",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return command(s, { type: "CHOOSE", id: "go" });
}

describe("expansion script final review regressions", () => {
  it("Heroic Strike stuns the same Rhino character after advancing his stage", () => {
    let s = captain();
    const serum = makePiece(s, "03010");
    s.player.inPlay.push(serum);
    const strike = makePiece(s, "03004");
    const genius = makePiece(s, "01089");
    s.player.hand = [strike, genius];
    s.villain.hp = 1;
    s.encounter.deck = [makePiece(s, "01107")];
    s = command(s, { type: "PLAY", id: strike.id });
    s = command(s, { type: "PAY", ids: [serum.id, genius.id] });
    expect(s.villain.stage).toBe(2);
    expect(s.villain.code).toBe("01095");
    expect(s.villain.stunned).toBe(true);
    expect(s.villain.stunCards).toBe(1);
  });

  it("Shield Toss consumes the actual stun card so a later stun can be placed", () => {
    let s = captain();
    const shield = makePiece(s, "03009");
    s.player.inPlay.push(shield);
    const toss = makePiece(s, "03006");
    const payment = makePiece(s, "03003");
    s.player.hand = [toss, payment];
    s = native(s, { type: "status", target: "hero", status: "stunned" });
    expect(s.player.stunCards).toBe(1);
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: toss.id });
    s = command(s, { type: "SELECT", ids: [payment.id] });
    expect(s.villain.hp).toBe(before);
    expect(s.player.hand.map((piece) => piece.id)).toEqual([shield.id]);
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(0);
    s = native(s, { type: "status", target: "hero", status: "stunned" });
    expect(s.player.stunned).toBe(true);
    expect(s.player.stunCards).toBe(1);
  });
});
