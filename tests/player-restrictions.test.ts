import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame, playable } from "../src/game/engine";
import { card, deckCodes, heroStats, maxHP } from "../src/game/cards";
import { deckErrors, deckOptions } from "../src/game/decks";
import { validateHeroDeck } from "../src/game/hero-runtime";
import { captainPackAbilityOptions } from "../src/game/captain-pack";
import type { Command, Effect, GameState } from "../src/game/types";

function command(input: GameState, action: Command) {
  let s = dispatch(input, action);
  expect(s.error).toBeUndefined();
  for (let n = 0; s.review && n < 50; n++) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function base(heroId = "captain_america", teammate?: string) {
  let s = newGame({
    heroId,
    aspect: heroId === "hulk" ? "aggression" : "leadership",
    villainId: "rhino",
    seed: 8,
    pacing: "expert",
    ...(teammate
      ? {
          heroes: [
            { heroId, aspect: "leadership" as const },
            { heroId: teammate, aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (teammate) s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    seat.player.hand = [];
    seat.player.inPlay = [];
    seat.player.discard = [];
    seat.player.form = "hero";
  }
  s.player = s.players[0].player;
  s.flags = s.players[0].flags;
  return s;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function put(s: GameState, code: string) {
  const piece = makePiece(s, code);
  s.player.inPlay.push(piece);
  return piece;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Fixture",
    text: "",
    options: [{ id: "go", label: "Go", effects: [] }],
  };
  return command(s, { type: "CHOOSE", id: "go" });
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind).toBe("choice");
  return command(s, { type: "CHOOSE", id });
}

describe("native uniqueness, Restricted, and attachment rules", () => {
  it("Hulk's default constructed starter remains40 cards and excludes his matching Bruce Banner ally", () => {
    const codes = deckCodes("hulk", "aggression");
    expect(codes).toHaveLength(40);
    expect(codes).not.toContain("01050");
    expect(validateHeroDeck("hulk", ["aggression"], codes).errors).toEqual([]);
    expect(deckErrors("hulk", "aggression", codes)).toEqual([]);
    expect(
      deckOptions("hulk", "aggression").some((c) => c.code === "01050"),
    ).toBe(false);
  });
  it("Hulk's customized deck rejects his own ally, even with a different printed card code", () => {
    const codes = deckCodes("hulk", "aggression");
    codes[codes.indexOf("01054")] = "01050";
    expect(deckErrors("hulk", "aggression", codes).length).toBeGreaterThan(0);
    expect(validateHeroDeck("hulk", ["aggression"], codes).valid).toBe(false);
    expect(() =>
      newGame({
        heroId: "hulk",
        aspect: "aggression",
        villainId: "rhino",
        heroes: [{ heroId: "hulk", aspect: "aggression", deckCards: codes }],
      }),
    ).toThrow();
  });
  it("a matching Hulk ally cannot be played while the Hulk identity is in either form", () => {
    const s = base("hulk");
    const h = hand(s, "01050", "01088");
    for (const form of ["hero", "alter"] as const) {
      s.player.form = form;
      expect(playable(s, h[0])).toMatch(/unique|match|identity/i);
      const next = dispatch(s, { type: "PLAY", id: h[0].id });
      expect(next.error).toMatch(/unique|match|identity/i);
      expect(next.player.hand.map((p) => p.id)).toContain(h[0].id);
    }
  });
  it("a teammate's Hulk identity blocks a matching ally, and Captain America blocks his own Quinjet candidate", () => {
    const s = base("captain_america", "hulk");
    const h = hand(s, "01050", "01088");
    expect(playable(s, h[0])).toMatch(/unique|match|identity/i);
    const jet = put(s, "03019");
    jet.counters = 6;
    hand(s, "21011");
    expect(captainPackAbilityOptions(s, jet.id)).toEqual([]);
  });
  it("a matching unique encounter minion is discarded before its entry rules can resolve", () => {
    let s = base();
    const ally = put(s, "01059");
    const enemy = makePiece(s, "56185");
    enemy.engagedWith = s.activePlayerId;
    s.minions.push(enemy);
    s = native(s, { type: "minionEntered", id: enemy.id });
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === enemy.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
  });
  it("a third Restricted upgrade may enter play, then its controller chooses which card to discard", () => {
    let s = base();
    const axe = put(s, "06019");
    const hammer = put(s, "06009");
    const h = hand(s, "03009", "03003");
    expect(playable(s, h[0])).toBeNull();
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.prompt?.title).toMatch(/Restricted/i);
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      [axe.id, hammer.id, h[0].id].sort(),
    );
    expect(heroStats(s).defense).toBe(3);
    s = choose(s, axe.id);
    expect(s.player.inPlay.map((p) => p.id).sort()).toEqual(
      [hammer.id, h[0].id].sort(),
    );
    expect(s.player.discard.some((p) => p.id === axe.id)).toBe(true);
    expect(s.prompt).toBeNull();
  });
  it("choosing to discard the new Restricted Shield removes its printed defense bonus immediately", () => {
    let s = base();
    put(s, "06019");
    put(s, "06009");
    const h = hand(s, "03009", "03003");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, h[0].id);
    expect(heroStats(s).defense).toBe(2);
    expect(s.player.inPlay).toHaveLength(2);
    expect(s.player.discard.some((p) => p.id === h[0].id)).toBe(true);
  });
  it("HonoraryAvenger adds only printed health/trait and preserves Iron Man's existing armor and basic powers", () => {
    let s = base("iron_man");
    put(s, "01036");
    s.player.hp = 15;
    const before = heroStats(s);
    expect(maxHP(s)).toBe(15);
    const h = hand(s, "03025");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = choose(s, "hero:p1");
    expect(maxHP(s)).toBe(16);
    expect(s.player.hp).toBe(16);
    expect(heroStats(s)).toEqual(before);
    s = native(s, { type: "discardPiece", id: h[0].id });
    expect(maxHP(s)).toBe(15);
    expect(s.player.hp).toBe(15);
    expect(heroStats(s)).toEqual(before);
  });
  it("HonoraryAvenger preserves Hulk's printed stats and stacks health with Immovable Object", () => {
    let s = base("hulk");
    put(s, "10010");
    s.player.hp = 22;
    const before = heroStats(s);
    expect(maxHP(s)).toBe(22);
    const h = hand(s, "03025");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = choose(s, "hero:p1");
    expect(maxHP(s)).toBe(23);
    expect(s.player.hp).toBe(23);
    expect(heroStats(s)).toEqual(before);
    expect(card(s.player.inPlay.find((p) => p.code === "10010")!).name).toBe(
      "Immovable Object",
    );
  });
});
