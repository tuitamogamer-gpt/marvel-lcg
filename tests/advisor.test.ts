import { describe, expect, it } from "vitest";
import {
  adviseAction,
  advisePrompt,
  autoplay,
  cardValue,
  endTurnDiscards,
} from "../src/game/advisor";
import { autoplaySmart, candidates, evaluate } from "../src/game/lookahead";
import { card } from "../src/game/cards";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import type { GameState } from "../src/game/types";

function fresh(heroId = "spider_man", villainId = "rhino", seed = 2024) {
  const hero = {
    spider_man: "justice",
    captain_marvel: "leadership",
    iron_man: "aggression",
    black_panther: "protection",
    she_hulk: "aggression",
  }[heroId] as any;
  let s = newGame({ heroId, aspect: hero, villainId, seed });
  s = dispatch(s, { type: "MULLIGAN", ids: [] });
  return s;
}

describe("advisor", () => {
  it("suits up from a healthy alter-ego and recovers when badly hurt with threat under control", () => {
    const s = fresh();
    expect(adviseAction(s)?.command).toEqual({ type: "FLIP" });
    const hurt: GameState = { ...s, player: { ...s.player, hp: 3 } };
    expect(adviseAction(hurt)?.command).toEqual({
      type: "BASIC",
      action: "recover",
    });
  });
  it("attacks when threat is low and thwarts when the scheme is about to complete", () => {
    let s = dispatch(fresh(), { type: "FLIP" });
    s.player.hand = [];
    expect(adviseAction(s)?.command).toEqual({
      type: "BASIC",
      action: "attack",
    });
    const pressed: GameState = { ...s, scheme: { ...s.scheme, threat: 5 } };
    expect(adviseAction(pressed)?.command).toEqual({
      type: "BASIC",
      action: "thwart",
    });
  });
  it("prefers playing an ally over a basic action and values allies above resource cards", () => {
    let s = dispatch(fresh(), { type: "FLIP" });
    const ally = makePiece(s, "01059");
    s.player.hand = [
      ally,
      makePiece(s, "01088"),
      makePiece(s, "01088"),
      makePiece(s, "01088"),
    ];
    expect(cardValue(s, ally)).toBeGreaterThan(cardValue(s, s.player.hand[1]));
    expect(adviseAction(s)?.command).toEqual({ type: "PLAY", id: ally.id });
    s = dispatch(s, { type: "PLAY", id: ally.id });
    expect(s.prompt?.kind).toBe("payment");
    const pay = advisePrompt(s)!;
    const paid = dispatch(s, pay.command);
    expect(paid.error).toBeUndefined();
    expect(paid.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
  });
  it("blocks a lethal hit with an ally and takes a small one", () => {
    let s = dispatch(fresh(), { type: "FLIP" });
    const ally = makePiece(s, "01059");
    s.player.inPlay.push(ally);
    s.player.hand = [];
    s = dispatch(s, { type: "END_TURN", discard: [] });
    for (
      let n = 0;
      n < 50 && !(s.prompt && /attacks$/.test(s.prompt.title));
      n++
    ) {
      if (s.prompt) s = dispatch(s, advisePrompt(s)!.command);
      else break;
    }
    expect(s.prompt?.title).toMatch(/attacks$/);
    const small = advisePrompt(s)!;
    expect(small.command).toEqual({ type: "CHOOSE", id: "take" });
    const lethal: GameState = { ...s, player: { ...s.player, hp: 2 } };
    expect(advisePrompt(lethal)!.command).toEqual({
      type: "CHOOSE",
      id: ally.id,
    });
  });
  it("discards only what the hand size requires, least valuable first", () => {
    let s = dispatch(fresh(), { type: "FLIP" });
    const ally = makePiece(s, "01059");
    s.player.hand = [
      ally,
      ...Array.from({ length: 6 }, () => makePiece(s, "01088")),
    ];
    const ids = endTurnDiscards(s);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(ally.id);
    expect(
      ids.every(
        (id) =>
          card(s.player.hand.find((p) => p.id === id)!).type_code ===
          "resource",
      ),
    ).toBe(true);
  });
  it("the heuristics finish complete missions without errors", () => {
    for (const seed of [11, 22, 33]) {
      const { state } = autoplay(fresh("spider_man", "rhino", seed), 40);
      expect(["won", "lost"]).toContain(state.phase);
    }
  });
  it("lookahead scores a defeat below any live position and lists the legal actions", () => {
    let s = dispatch(fresh(), { type: "FLIP" });
    const live = evaluate(s);
    expect(live).toBeGreaterThan(evaluate({ ...s, phase: "lost" }));
    expect(evaluate({ ...s, phase: "won" })).toBeGreaterThan(live);
    const hurt = { ...s, player: { ...s.player, hp: 2 } };
    expect(evaluate(hurt)).toBeLessThan(live);
    const list = candidates(s);
    expect(list.some((c) => c.type === "BASIC" && c.action === "attack")).toBe(
      true,
    );
    expect(list.some((c) => c.type === "END_TURN")).toBe(true);
    expect(list.some((c) => c.type === "FLIP")).toBe(false);
  });
  it.skipIf(!process.env.SLOW)(
    "SLOW: the planner reports its win rate and wins at least one core mission",
    () => {
      let wins = 0;
      const lines: string[] = [];
      for (const villainId of ["rhino", "klaw", "ultron"]) {
        for (const seed of [11, 22, 33]) {
          const { state } = autoplaySmart(
            newGame({
              heroId: "spider_man",
              aspect: "justice",
              villainId,
              seed,
            }),
            { rollouts: 2, seed: seed * 7 },
          );
          if (state.phase === "won") wins++;
          lines.push(
            `spider_man vs ${villainId} seed ${seed}: ${state.phase} in ${state.round} rounds`,
          );
        }
      }
      console.log(lines.join("\n"));
      expect(wins).toBeGreaterThanOrEqual(1);
    },
    600_000,
  );
});
