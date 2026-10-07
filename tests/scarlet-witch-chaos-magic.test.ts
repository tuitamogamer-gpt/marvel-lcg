import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame, playable } from "../src/game/engine.js";
import type { Command, GameState, Piece } from "../src/game/types.js";

const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function command(s: GameState, cmd: Command): GameState {
  s = dispatch(reload(s), cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let guard = 0; s.review && guard < 80; guard++) {
    s = dispatch(s, { type: "PROCEED" });
    expect(s.error).toBeUndefined();
  }
  return s;
}
function choose(s: GameState, id: string): GameState {
  expect(
    s.prompt?.options.some((option) => option.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function base(heroId = "scw") {
  let s = newGame({
    heroId,
    aspect: "justice",
    villainId: "rhino",
    pacing: "expert",
    seed: 150030,
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  s.player.form = "hero";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.player.deck = Array.from({ length: 15 }, () => makePiece(s, "15019"));
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.attachments = [];
  s.minions = [];
  s.sideSchemes = [];
  s.scheme.threat = 6;
  s.villain.hp = s.villain.maxHp = 50;
  s.prompt = null;
  s.queue = [];
  s.review = null;
  return s;
}
function hand(s: GameState, ...codes: string[]): Piece[] {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function free(s: GameState, magic: Piece, selected: Piece) {
  s = command(s, { type: "PLAY", id: magic.id });
  expect(s.prompt?.title).toBe("Chaos Magic");
  return choose(s, selected.id);
}
function physical(s: GameState, id: string) {
  return [
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.discard,
    ...s.player.inPlay,
    ...s.resolving,
  ].filter((p) => p.id === id);
}

describe("Chaos Magic native nested plays and independent costs", () => {
  it("chooses a positive printed X without requiring resources, then discards that chosen X after the event resolves", () => {
    let s = base();
    const [magic, cyclone] = hand(s, "15003", "14006");
    const minions = ["01101", "01103"].map((code) => ({
      ...makePiece(s, code),
      engagedWith: s.activePlayerId,
    }));
    s.minions = minions;
    const discarded = s.encounter.deck.slice(0, 3).map((p) => p.id);
    s = free(s, magic, cyclone);
    expect(s.prompt?.title).toBe("Speed Cyclone");
    expect(s.prompt?.options.map((option) => option.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
    s = choose(s, "3");
    expect(s.prompt?.kind).toBe("select");
    expect(s.prompt?.min).toBe(3);
    s = command(s, {
      type: "SELECT",
      ids: [s.villain.id, ...minions.map((p) => p.id)],
    });
    expect(s.prompt).toBeNull();
    expect(s.villain.stunned).toBe(true);
    expect(s.minions.every((p) => p.stunned)).toBe(true);
    expect(s.encounter.discard.map((p) => p.id)).toEqual(discarded);
    expect(physical(s, magic.id)).toHaveLength(1);
    expect(physical(s, cyclone.id)).toHaveLength(1);
  });
  it("free play does not invent paid mental resources for For Justice's bonus", () => {
    let s = base();
    const [magic, event, mental] = hand(s, "15003", "01060", "15019");
    const initialEncounter = s.encounter.deck.length;
    s = free(s, magic, event);
    if (s.prompt?.options.some((option) => option.id === "main"))
      s = choose(s, "main");
    expect(s.prompt).toBeNull();
    expect(s.scheme.threat).toBe(3);
    expect(s.player.hand.some((p) => p.id === mental.id)).toBe(true);
    expect(s.encounter.deck).toHaveLength(initialEncounter - 2);
  });
  it("pays Master of the Mystic Arts' additional Invocation cost while ignoring only its printed resource cost", () => {
    let s = base("doctor_strange");
    const invocation = s.player.invocationDeck!.find(
      (p) => p.code === "09032",
    )!;
    s.player.invocationDeck = [
      invocation,
      ...s.player.invocationDeck!.filter((p) => p.id !== invocation.id),
    ];
    const [magic, master, energy] = hand(s, "15003", "09005", "15020");
    s = free(s, magic, master);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(2);
    expect(s.player.hand.some((p) => p.id === master.id)).toBe(true);
    expect(s.encounter.discard).toEqual([]);
    s = command(s, { type: "PAY", ids: [energy.id] });
    if (s.prompt?.options.some((option) => option.id === s.villain.id))
      s = choose(s, s.villain.id);
    for (let guard = 0; s.prompt && guard < 15; guard++) {
      const id = s.prompt.options.find((option) =>
        ["continue", "skip", "none"].includes(option.id),
      )?.id;
      expect(id, JSON.stringify(s.prompt)).toBeTruthy();
      s = choose(s, id!);
    }
    expect(s.prompt).toBeNull();
    expect(s.villain.hp).toBe(43);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.invocationDeck![0].id).toBe(invocation.id);
    expect(s.encounter.discard).toHaveLength(1);
    expect(physical(s, master.id)).toHaveLength(1);
  });
  it("does not offer a Master of the Mystic Arts whose additional Invocation cost cannot be paid", () => {
    const s = base("doctor_strange");
    const invocation = s.player.invocationDeck!.find(
      (p) => p.code === "09032",
    )!;
    s.player.invocationDeck = [
      invocation,
      ...s.player.invocationDeck!.filter((p) => p.id !== invocation.id),
    ];
    const [magic] = hand(s, "15003", "09005");
    expect(playable(s, magic)).toContain("no legal card");
    expect(s.encounter.discard).toEqual([]);
  });
  it("Lightning Strike pays its additional X energy while ignoring the printed card cost", () => {
    let s = base("thor");
    const [magic, strike, energy] = hand(s, "15003", "06006", "15020");
    s = free(s, magic, strike);
    expect(s.prompt?.title).toBe("Lightning Strike");
    expect(s.prompt?.options.map((option) => option.id)).toEqual(["1", "2"]);
    s = choose(s, "2");
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(2);
    expect(s.prompt?.requirements).toEqual(["energy", "energy"]);
    s = command(s, { type: "PAY", ids: [energy.id] });
    expect(s.prompt).toBeNull();
    expect(s.villain.hp).toBe(48);
    expect(s.encounter.discard).toHaveLength(1);
    expect(physical(s, strike.id)).toHaveLength(1);
  });
  it("Lightning Strike cannot omit its additional energy cost merely because the card play is free", () => {
    const s = base("thor"),
      [magic] = hand(s, "15003", "06006");
    expect(playable(s, magic)).toContain("no legal card");
  });
  it("can nest another actual Chaos Magic and finishes all nested play before the outer discard", () => {
    let s = base();
    const [outer, inner, ally] = hand(s, "15003", "15003", "01084");
    const encounterTop = s.encounter.deck.slice(0, 4).map((p) => p.id);
    s = free(s, outer, inner);
    expect(s.prompt?.title).toBe("Chaos Magic");
    s = choose(s, ally.id);
    expect(s.prompt?.title).toBe("Nick Fury");
    expect(s.encounter.discard).toEqual([]);
    const draw = s.prompt!.options.find((option) =>
      /draw 3/i.test(option.label),
    )!;
    s = choose(s, draw.id);
    expect(s.player.hand).toHaveLength(3);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    expect(s.encounter.discard.map((p) => p.id)).toEqual(encounterTop);
    for (const p of [outer, inner, ally])
      expect(physical(s, p.id)).toHaveLength(1);
  });
  it("terminates recursive legality when only two Chaos Magics remain and no legal card can follow", () => {
    const s = base(),
      [outer, inner] = hand(s, "15003", "15003");
    expect(playable(s, outer)).toContain("no legal card");
    expect(playable(s, inner)).toContain("no legal card");
  });
  it("retains an actual hand-discard cost for Legal Practice instead of treating every card effect as free", () => {
    const s = base(),
      [magic] = hand(s, "15003", "01023");
    expect(playable(s, magic)).toContain("no legal card");
  });
  it("does not turn a Requirement card into a free legal play", () => {
    const s = base(),
      [magic] = hand(s, "15003", "27049");
    expect(playable(s, magic)).toContain("no legal card");
  });
});
