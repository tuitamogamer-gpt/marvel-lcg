/** Payment windows retain the real forty-card source and recheck current
 * physical identity permissions after a saved decision resumes. */
import { describe, expect, it } from "vitest";
import { card, deckCodes } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { dispatch, newGame, paymentSources } from "../src/game/engine.js";
import type { Effect, GameState, Piece, Prompt } from "../src/game/types.js";
import {
  command,
  finish,
  native,
  pay,
  physical,
  reload,
  respond,
  target,
} from "./dv-test-helpers.js";

type SourceState = GameState & {
  hamPaymentOriginalIds?: string[];
  hamPaymentIdentityId?: string;
};
function identity(s: GameState): Piece {
  expect(s.player.spiderHamIdentity).toBeDefined();
  return s.player.spiderHamIdentity!;
}
function exact(s: GameState) {
  const ids = (s as SourceState).hamPaymentOriginalIds!;
  const pieces = physical(s);
  expect(pieces).toHaveLength(40);
  expect(pieces.map((p) => p.id).sort()).toEqual(ids.slice().sort());
  expect(new Set(pieces.map((p) => p.id)).size).toBe(40);
  expect(identity(s).id).toBe((s as SourceState).hamPaymentIdentityId);
}
function base(): GameState {
  let s = newGame({
    heroId: "spiderham",
    aspect: "justice",
    villainId: "rhino",
    module: "inheritors",
    seed: 30007,
    pacing: "expert",
  });
  s = finish(command(s, { type: "MULLIGAN", ids: [] }));
  const source = physical(s);
  expect(source).toHaveLength(40);
  expect(source.map((p) => p.code).sort()).toEqual(
    deckCodes("spiderham", "justice").sort(),
  );
  s.player.deck = source;
  s.player.hand = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.player.form = "hero";
  s.player.exhausted = s.player.flipped = s.player.tough = false;
  s.queue = [];
  s.prompt = s.review = null;
  s.resolving = [];
  s.villain.hp = s.villain.maxHp = 50;
  identity(s).code = "30001a";
  identity(s).counters = 0;
  (s as SourceState).hamPaymentOriginalIds = source.map((p) => p.id);
  (s as SourceState).hamPaymentIdentityId = identity(s).id;
  exact(s);
  return s;
}
function hand(s: GameState, ...codes: string[]): Piece[] {
  const pieces = codes.map((code) => {
    const i = s.player.deck.findIndex((p) => p.code === code);
    expect(i, `actual starter source ${code}`).toBeGreaterThanOrEqual(0);
    return s.player.deck.splice(i, 1)[0];
  });
  s.player.hand.push(...pieces);
  return pieces;
}
function slots(s: GameState) {
  return paymentSources(s, s.prompt?.card?.id, s.prompt?.paymentTarget)
    .filter((p) => p.id.startsWith("spider-ham-toon:"))
    .map((p) => p.id);
}
function pendingAttack() {
  let s = base();
  identity(s).counters = 3;
  const [event, a, b] = hand(s, "30007", "30014", "30019");
  s = command(s, { type: "PLAY", id: event.id });
  expect(s.prompt?.kind).toBe("payment");
  expect(s.prompt?.cost).toBe(3);
  return { s, event, a, b, sourceIds: slots(s) };
}
function reject(s: GameState, ids: string[]) {
  const before = reload(s);
  const failed = dispatch(reload(s), { type: "PAY", ids, wildAs: "energy" });
  expect(failed.error).toMatch(/unavailable/i);
  expect(failed.prompt).toEqual(before.prompt);
  expect(failed.player.hand).toEqual(before.player.hand);
  expect(failed.player.discard).toEqual(before.player.discard);
  expect(failed.player.hp).toBe(before.player.hp);
  expect(identity(failed).counters).toBe(identity(before).counters);
  exact(failed);
  return failed;
}

describe("Spider-Ham saved payment identity permissions", () => {
  it("rejects a stale high ordinal before spending any currently available counter or hand card", () => {
    const { s, a, b, sourceIds } = pendingAttack();
    identity(s).counters = 1;
    expect(slots(s)).toEqual([sourceIds[0]]);
    const failed = reject(s, [a.id, b.id, sourceIds[2]]);
    expect(identity(failed).counters).toBe(1);
    expect(failed.player.hand.map((p) => p.id)).toContain(a.id);
  });
  it("the remaining current slot can fund the same saved payment after a stale choice is rejected", () => {
    let { s, event, a, b, sourceIds } = pendingAttack();
    identity(s).counters = 1;
    s = reject(s, sourceIds);
    delete s.error;
    s = pay(s, [a, b], "energy", slots(s));
    s = finish(target(s, s.villain.id));
    expect(identity(s).counters).toBe(0);
    expect(s.villain.hp).toBe(44);
    expect(s.villain.confused).toBe(true);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    exact(s);
  });
  it("a native blank marker on the actual identity withdraws the offered sources without deleting counters", () => {
    const { s, a, b, sourceIds } = pendingAttack();
    s.flags[`novaIronheartPackBlank:${identity(s).id}`] = s.round;
    expect(isTextBlank(s, identity(s))).toBe(true);
    expect(slots(s)).toEqual([]);
    const failed = reject(s, [a.id, b.id, sourceIds[0]]);
    expect(identity(failed).counters).toBe(3);
  });
  it("a native form change withdraws hero resources while preserving their physical counters and identity", () => {
    let { s, sourceIds } = pendingAttack();
    const pending: Prompt = reload(s).prompt!;
    s.prompt = null;
    s = finish(native(s, { type: "flip", target: "alter" }));
    expect(s.player.form).toBe("alter");
    expect(identity(s).counters).toBe(3);
    s.prompt = pending;
    expect(slots(s)).toEqual([]);
    reject(s, sourceIds);
  });
  it("canceling an interrupted saved payment leaves its original card and current counters untouched", () => {
    let { s, event } = pendingAttack();
    identity(s).counters = 2;
    s = command(reload(s), { type: "CANCEL" });
    expect(s.prompt).toBeNull();
    expect(identity(s).counters).toBe(2);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.discard).toEqual([]);
    exact(s);
  });
});

function damageCostPayment(s: GameState, cost = 2) {
  const subject = s.player.hand.find((p) => p.code === "30010")!;
  const effect: Effect = {
    type: "payRequest",
    title: "Printed ability with a resource and damage cost",
    piece: subject,
    cost,
    requirements: [],
    abilityCost: true,
    cancelable: true,
    paymentCommit: [
      {
        type: "damage",
        target: "hero",
        amount: 1,
        source: subject.id,
        cost: true,
      },
    ],
    after: [{ type: "flag", key: "hamPaymentBenefit", value: true }],
  };
  const result = native(s, effect);
  expect(result.prompt?.kind, JSON.stringify(result.prompt)).toBe("payment");
  return result;
}

describe("Spider-Ham responses after the complete native payment cost", () => {
  it("an underfunded payment cannot take its damage cost or gain a counter to finish the same payment", () => {
    let s = base();
    const [_subject, fuel] = hand(s, "30010", "30014", "30019");
    s = damageCostPayment(s);
    const failed = dispatch(reload(s), { type: "PAY", ids: [fuel.id] });
    expect(failed.error).toMatch(/not enough resources/i);
    expect(failed.player.hp).toBe(12);
    expect(identity(failed).counters).toBe(0);
    expect(failed.flags.hamPaymentBenefit).toBeUndefined();
    expect(failed.prompt?.kind).toBe("payment");
    expect(failed.player.discard).toEqual([]);
    exact(failed);
  });
  it("the saved damage response opens after resources commit and cannot spend its new counter retroactively", () => {
    let s = base();
    const [_subject, a, b] = hand(s, "30010", "30014", "30019");
    s = damageCostPayment(s);
    s = pay(reload(s), [a, b]);
    expect(s.player.hp).toBe(11);
    expect(identity(s).counters).toBe(0);
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    expect(s.prompt?.kind).toBe("choice");
    s = finish(respond(reload(s), /Spider-Nonsense/, "30001a"));
    expect(identity(s).counters).toBe(1);
    expect(s.flags.hamPaymentBenefit).toBe(true);
    expect(card(s.player.hand[0]).code).toBe("30010");
    exact(s);
  });
  it("canceling the native payment performs neither the additional damage nor its benefit", () => {
    let s = base();
    hand(s, "30010", "30014", "30019");
    s = damageCostPayment(s);
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.hp).toBe(12);
    expect(identity(s).counters).toBe(0);
    expect(s.flags.hamPaymentBenefit).toBeUndefined();
    expect(s.player.hand).toHaveLength(3);
    exact(s);
  });
});
