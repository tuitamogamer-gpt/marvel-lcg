import { describe, expect, it } from "vitest";
import {
  adviseAction,
  advisePrompt,
  autoplay,
  cardValue,
  endTurnDiscards,
} from "../src/game/advisor";
import {
  autoplaySmart,
  candidates,
  evaluate,
  fairClone,
  planAction,
  planPrompt,
} from "../src/game/lookahead";
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
  it("can thwart while Stunned and spends a basic action to clear a status", () => {
    let s = dispatch(fresh(), { type: "FLIP" });
    s.player.hand = [];
    s.player.stunned = true;
    s.scheme.threat = 5;
    expect(adviseAction(s)?.command).toEqual({
      type: "BASIC",
      action: "thwart",
    });
    const thwarted = dispatch(s, adviseAction(s)!.command);
    expect(thwarted.error).toBeUndefined();
    expect(thwarted.scheme.threat).toBe(4);
    expect(thwarted.player.stunned).toBe(true);
    s.scheme.threat = 0;
    expect(adviseAction(s)?.title).toBe("Clear Stunned");
    const cleared = dispatch(s, adviseAction(s)!.command);
    expect(cleared.error).toBeUndefined();
    expect(cleared.player.stunned).toBe(false);
    expect(cleared.villain.hp).toBe(s.villain.hp);
  });
  it("suggests Rechannel with a payable energy resource and no Energy Channel", () => {
    const s = dispatch(fresh("captain_marvel"), { type: "FLIP" });
    s.player.hp -= 1;
    s.player.hand = [makePiece(s, "01088")];
    expect(adviseAction(s)?.command).toEqual({
      type: "ABILITY",
      id: "identity",
    });
    const activated = dispatch(s, adviseAction(s)!.command);
    expect(activated.prompt?.title).toBe("Rechannel");
    const paid = dispatch(activated, advisePrompt(activated)!.command);
    expect(paid.error).toBeUndefined();
    expect(paid.player.hp).toBe(s.player.hp + 1);
    expect(paid.player.hand).toHaveLength(1);
    s.player.hand = [makePiece(s, "01089")];
    expect(candidates(s)).not.toContainEqual({
      type: "ABILITY",
      id: "identity",
    });
    expect(adviseAction(s)?.command).not.toEqual({
      type: "ABILITY",
      id: "identity",
    });
  });
  it("does not repeatedly suggest a support whose typed cost cannot be paid", () => {
    const s = fresh("she_hulk");
    s.player.exhausted = true;
    s.player.flipped = true;
    s.player.hand = [];
    s.scheme.threat = 4;
    const law = makePiece(s, "01026");
    s.player.inPlay.push(law);
    expect(adviseAction(s)).toBeNull();
    expect(candidates(s)).not.toContainEqual({
      type: "ABILITY",
      id: law.id,
      action: "special",
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

describe("fair lookahead samples", () => {
  const sample = (s: GameState) => fairClone(s, () => 0);
  it("resamples facedown dealt encounters and pending boosts while retaining their slots", () => {
    let s = dispatch(fresh(), { type: "FLIP" });
    s.player.hand = [];
    s = dispatch(s, { type: "END_TURN", discard: [] });
    expect(s.attack?.pendingBoosts).toHaveLength(1);
    const dealt = s.encounter.deck.pop()!;
    dealt.dealtTo = "p1";
    s.encounter.dealt = [dealt];
    const copy = structuredClone(s);
    [copy.encounter.deck[0], copy.encounter.dealt[0]] = [
      copy.encounter.dealt[0],
      copy.encounter.deck[0],
    ];
    copy.encounter.dealt[0].dealtTo = "p1";
    const left = sample(s),
      right = sample(copy);
    expect(left.encounter).toEqual(right.encounter);
    expect(left.attack?.pendingBoosts).toEqual(right.attack?.pendingBoosts);
    expect(left.encounter.dealt[0].dealtTo).toBe("p1");
    expect(left.encounter.deck.every((p) => !p.dealtTo)).toBe(true);
    expect(left.encounter.deck).not.toBe(s.encounter.deck);
    expect(s.encounter.dealt).toEqual([dealt]);
    const adviceLeft = planPrompt(s, { seed: 17, rollouts: 1 });
    const adviceRight = planPrompt(copy, { seed: 17, rollouts: 1 });
    expect(adviceLeft).toEqual(adviceRight);
  });
  it("resamples hidden drone cards with the owning deck and retains known Futurist cards", () => {
    const s = fresh("iron_man");
    const drone = makePiece(s, "drone");
    drone.droneCard = s.player.deck.pop()!;
    drone.engagedWith = "p1";
    s.minions.push(drone);
    const swapped = structuredClone(s);
    [swapped.player.deck[0], swapped.minions[0].droneCard] = [
      swapped.minions[0].droneCard!,
      swapped.player.deck[0],
    ];
    const left = sample(s),
      right = sample(swapped);
    expect(left.player.deck).toEqual(right.player.deck);
    expect(left.minions[0].droneCard).toEqual(right.minions[0].droneCard);
    const looked = dispatch(s, { type: "ABILITY", id: "identity" });
    const cloned = sample(looked);
    expect(cloned.player.deck.slice(0, 3)).toEqual(
      looked.player.deck.slice(0, 3),
    );
    expect(cloned.prompt?.options).toEqual(looked.prompt?.options);
  });
  it("uses the active player snapshot after a JSON reload and ignores hidden ordering", () => {
    const s = JSON.parse(JSON.stringify(fresh())) as GameState;
    const piece = makePiece(s, "01088");
    s.player.hand = [piece];
    const cloned = sample(s);
    expect(cloned.player.hand).toEqual([piece]);
    expect(cloned.player).toBe(cloned.players[0].player);
    const reversed = structuredClone(s);
    reversed.player.deck.reverse();
    expect(planAction(s, { seed: 44, rollouts: 1 })).toEqual(
      planAction(reversed, { seed: 44, rollouts: 1 }),
    );
  });
});
