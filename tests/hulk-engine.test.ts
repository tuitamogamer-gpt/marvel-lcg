import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine";
import { deckCodes, heroStats, maxHP } from "../src/game/cards";
import type { Command, Effect, GameState } from "../src/game/types";

function command(input: GameState, cmd: Command) {
  let state = dispatch(input, cmd);
  expect(state.error).toBeUndefined();
  for (let i = 0; state.review && i < 50; i++) {
    state = dispatch(state, { type: "PROCEED" });
    expect(state.error).toBeUndefined();
  }
  return state;
}
function base() {
  let state = newGame({
    heroId: "hulk",
    villainId: "rhino",
    aspect: "aggression",
    seed: 320,
    pacing: "expert",
  });
  state = command(state, { type: "MULLIGAN", ids: [] });
  state.player.form = "hero";
  state.player.hand = [];
  state.player.inPlay = [];
  state.player.discard = [];
  state.queue = [];
  state.review = null;
  expect(state.prompt).toBeNull();
  return state;
}
function hand(state: GameState, ...codes: string[]) {
  state.player.hand = codes.map((code) => makePiece(state, code));
  return [...state.player.hand];
}
function minion(state: GameState, code: string) {
  const piece = makePiece(state, code);
  piece.engagedWith = state.activePlayerId;
  state.minions.push(piece);
  return piece;
}
function native(state: GameState, ...effects: Effect[]) {
  state.queue = effects;
  state.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "Resolve a native rules window.",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return command(state, { type: "CHOOSE", id: "go" });
}
function play(state: GameState, code: string, resourceCode = "10007") {
  const [piece, resource] = hand(state, code, resourceCode);
  state = command(state, { type: "PLAY", id: piece.id });
  expect(state.prompt?.kind).toBe("payment");
  state = command(state, { type: "PAY", ids: [resource.id] });
  return state;
}

describe("Hulk through the actual game dispatcher", () => {
  it("starts a real40-card mission with Hulk's18HP and Banner5-card opening hand", () => {
    expect(deckCodes("hulk", "aggression")).toHaveLength(40);
    const state = newGame({
      heroId: "hulk",
      villainId: "rhino",
      aspect: "aggression",
      seed: 320,
    });
    expect(state.heroId).toBe("hulk");
    expect(state.player.hp).toBe(18);
    expect(state.player.hand).toHaveLength(5);
    expect(
      [...state.player.hand, ...state.player.deck].filter(
        (piece) => piece.code === "10003",
      ),
    ).toHaveLength(2);
  });

  it("Research draws a real card, asks for the discard, and enforces once per round", () => {
    let state = base();
    state.player.form = "alter";
    const [old] = hand(state, "10003");
    const next = makePiece(state, "10007");
    state.player.deck.unshift(next);
    state = command(state, {
      type: "ABILITY",
      id: "identity",
      action: "research",
    });
    expect(state.prompt?.kind).toBe("select");
    expect(state.player.hand.map((piece) => piece.id)).toEqual([
      old.id,
      next.id,
    ]);
    state = command(state, { type: "SELECT", ids: [next.id] });
    expect(state.player.hand.map((piece) => piece.id)).toEqual([old.id]);
    expect(state.player.discard.some((piece) => piece.id === next.id)).toBe(
      true,
    );
    const repeat = dispatch(state, {
      type: "ABILITY",
      id: "identity",
      action: "research",
    });
    expect(repeat.error).toBeDefined();
  });

  it("Limitless Strength cannot pay in alter-ego form, while Laboratory can generate mental and adds2REC", () => {
    let state = base();
    state.player.form = "alter";
    const [strength] = hand(state, "10007");
    const laboratory = makePiece(state, "10008");
    state.player.inPlay.push(laboratory);
    expect(
      paymentSources(state).some((source) => source.id === strength.id),
    ).toBe(false);
    expect(
      paymentSources(state).find((source) => source.id === laboratory.id)
        ?.resources,
    ).toEqual(["mental"]);
    expect(heroStats(state).recover).toBe(6);
    state.player.form = "hero";
    expect(
      paymentSources(state).find((source) => source.id === strength.id)
        ?.resources,
    ).toEqual(["physical", "physical", "physical"]);
    expect(
      paymentSources(state).some((source) => source.id === laboratory.id),
    ).toBe(false);
  });

  it("Crushing Blow rejects mixed payment without spending sources, then resolves current ATK with physical payment", () => {
    let state = base();
    const [event, mental, physical] = hand(state, "10002", "01089", "10007");
    const hp = state.villain.hp;
    state = command(state, { type: "PLAY", id: event.id });
    const rejected = dispatch(state, { type: "PAY", ids: [mental.id] });
    expect(rejected.error).toContain("physical");
    expect(rejected.player.hand.some((piece) => piece.id === mental.id)).toBe(
      true,
    );
    expect(rejected.prompt?.kind).toBe("payment");
    state = command(state, { type: "PAY", ids: [physical.id] });
    expect(state.villain.hp).toBe(hp - 3);
    expect(state.player.discard.some((piece) => piece.id === physical.id)).toBe(
      true,
    );
  });

  it("Hulk Smash uses a real cost3 interrupt and applies13 damage to only that basic attack", () => {
    let state = base();
    const [smash, strength] = hand(state, "10003", "10007");
    expect(playable(state, smash)).toContain("interrupt");
    const hp = state.villain.hp;
    state = command(state, { type: "BASIC", action: "attack" });
    expect(state.prompt?.title).toBe("Hulk Smash");
    expect(state.villain.hp).toBe(hp);
    state = command(state, { type: "CHOOSE", id: smash.id });
    expect(state.prompt).toMatchObject({ kind: "payment", cost: 3 });
    state = command(state, { type: "PAY", ids: [strength.id] });
    expect(state.villain.hp).toBe(hp - 13);
    expect(state.player.discard.some((piece) => piece.id === smash.id)).toBe(
      true,
    );
    expect(state.player.exhausted).toBe(true);
    expect(heroStats(state).attack).toBe(3);
    expect(state.prompt).toBeNull();
  });

  it("a fully physical Hulk Smash overkills a Guard minion through the native attack pipeline", () => {
    let state = base();
    const guard = minion(state, "01101");
    const [smash, strength] = hand(state, "10003", "10007");
    const hp = state.villain.hp;
    state = command(state, { type: "BASIC", action: "attack" });
    state = command(state, { type: "CHOOSE", id: smash.id });
    state = command(state, { type: "PAY", ids: [strength.id] });
    expect(state.minions.some((piece) => piece.id === guard.id)).toBe(false);
    expect(state.villain.hp).toBe(hp - 10);
    expect(state.prompt).toBeNull();
  });

  it("both Hulk Smash copies can be paid as separate interrupts on the same basic attack", () => {
    let state = base();
    state.villain.hp = state.villain.maxHp = 40;
    const [first, second, resourceA, resourceB] = hand(
      state,
      "10003",
      "10003",
      "10007",
      "10007",
    );
    state = command(state, { type: "BASIC", action: "attack" });
    state = command(state, { type: "CHOOSE", id: first.id });
    state = command(state, { type: "PAY", ids: [resourceA.id] });
    expect(
      state.prompt?.options.some((option) => option.id === second.id),
    ).toBe(true);
    expect(state.villain.hp).toBe(40);
    state = command(state, { type: "CHOOSE", id: second.id });
    state = command(state, { type: "PAY", ids: [resourceB.id] });
    expect(state.villain.hp).toBe(17);
    expect(
      state.player.discard.filter((piece) => piece.code === "10003"),
    ).toHaveLength(2);
    expect(state.resolving).toEqual([]);
    expect(heroStats(state).attack).toBe(3);
  });

  it("a mixed-resource Smash defeats its Guard target without overkill damage to the villain", () => {
    let state = base();
    const guard = minion(state, "01101");
    const [smash, mental, physical] = hand(state, "10003", "01089", "10004");
    const hp = state.villain.hp;
    state = command(state, { type: "BASIC", action: "attack" });
    state = command(state, { type: "CHOOSE", id: smash.id });
    state = command(state, { type: "PAY", ids: [mental.id, physical.id] });
    expect(state.minions.some((piece) => piece.id === guard.id)).toBe(false);
    expect(state.villain.hp).toBe(hp);
  });

  it("Thunderclap damages a chosen villain through Guard without consuming Hulk's Stunned", () => {
    let state = base();
    const guard = minion(state, "01101");
    state.player.stunned = true;
    const hp = state.villain.hp;
    state = play(state, "10005");
    expect(state.prompt?.kind).toBe("select");
    expect(state.prompt?.options.map((option) => option.id)).toContain(
      state.villain.id,
    );
    state = command(state, {
      type: "SELECT",
      ids: [state.villain.id, guard.id],
    });
    expect(state.villain.hp).toBe(hp - 3);
    expect(state.minions.some((piece) => piece.id === guard.id)).toBe(false);
    expect(state.player.stunned).toBe(true);
  });

  it("Sub-Orbital Leap and Unstoppable Force honor actual physical payment", () => {
    let state = base();
    state.scheme.threat = 8;
    state = play(state, "10004");
    expect(state.scheme.threat).toBe(3);
    state.player.exhausted = true;
    state = play(state, "10006");
    expect(state.player.exhausted).toBe(false);
    expect(state.player.hand).toHaveLength(1);
  });

  it("Rage disappears after flipping, while Immovable adjusts current and maximum HP by4", () => {
    let state = base();
    state.player.hp = 12;
    state = play(state, "10010");
    expect(maxHP(state)).toBe(22);
    expect(state.player.hp).toBe(16);
    state = play(state, "10009");
    expect(heroStats(state).attack).toBe(4);
    state = command(state, { type: "FLIP" });
    expect(state.player.form).toBe("alter");
    expect(state.player.inPlay.some((piece) => piece.code === "10009")).toBe(
      false,
    );
    expect(state.player.discard.some((piece) => piece.code === "10009")).toBe(
      true,
    );
    expect(maxHP(state)).toBe(22);
    expect(state.player.hp).toBe(16);
    const immovable = state.player.inPlay.find(
      (piece) => piece.code === "10010",
    )!;
    state = native(state, { type: "discardPiece", id: immovable.id });
    expect(maxHP(state)).toBe(18);
    expect(state.player.hp).toBe(12);
  });

  it("Enraged discards the old hand before normal end-of-phase replenishment", () => {
    let state = base();
    const held = hand(state, "10003", "10002", "10007");
    state = command(state, { type: "END_TURN", discard: [] });
    expect(
      held.every((piece) =>
        state.player.discard.some((discarded) => discarded.id === piece.id),
      ),
    ).toBe(true);
    expect(
      held.every(
        (piece) => !state.player.hand.some((fresh) => fresh.id === piece.id),
      ),
    ).toBe(true);
    expect(state.player.hand).toHaveLength(4);
  });

  it("Inner Demons flips to Banner, resolves Rage's forced discard, and selects2 actual hand cards", () => {
    let state = base();
    const rage = makePiece(state, "10009");
    state.player.inPlay.push(rage);
    const held = hand(state, "10003", "10002", "10007");
    const obligation = makePiece(state, "10025");
    state = native(state, { type: "reveal", piece: obligation, skip: true });
    expect(state.player.form).toBe("alter");
    expect(state.player.inPlay.some((piece) => piece.id === rage.id)).toBe(
      false,
    );
    expect(state.prompt).toMatchObject({ kind: "select", min: 2, max: 2 });
    state = command(state, {
      type: "SELECT",
      ids: held.slice(0, 2).map((piece) => piece.id),
    });
    expect(state.player.hand.map((piece) => piece.id)).toEqual([held[2].id]);
    expect(
      state.encounter.discard.some((piece) => piece.id === obligation.id),
    ).toBe(true);
  });

  it("Total Destruction cannot lose threat while Abomination is present", () => {
    let state = base();
    minion(state, "10026");
    const scheme = makePiece(state, "10027");
    scheme.counters = 3;
    state.sideSchemes.push(scheme);
    state = native(state, { type: "thwart", target: scheme.id, amount: 5 });
    expect(
      state.sideSchemes.find((piece) => piece.id === scheme.id)?.counters,
    ).toBe(3);
  });

  it("Clash's undefended ally target receives damage and still triggers Abomination's after-attacks-you ability", () => {
    let state = base();
    const abomination = minion(state, "10026");
    const ally = makePiece(state, "01050");
    ally.bonusAtk = 3;
    state.player.inPlay.push(ally);
    const top = makePiece(state, "10007");
    state.player.deck.unshift(top);
    const hp = state.player.hp;
    state = native(state, {
      type: "reveal",
      piece: makePiece(state, "10028"),
      skip: true,
    });
    expect(state.attack?.attacker).toBe(abomination.id);
    expect(state.attack?.originalTarget).toBe(ally.id);
    expect(state.prompt?.options.some((option) => option.id === "take")).toBe(
      true,
    );
    state = command(state, { type: "CHOOSE", id: "take" });
    expect(state.player.hp).toBe(hp - 2);
    expect(state.player.discard.some((piece) => piece.id === top.id)).toBe(
      true,
    );
    expect(state.player.inPlay.some((piece) => piece.id === ally.id)).toBe(
      true,
    );
    expect(
      state.player.inPlay.find((piece) => piece.id === ally.id)?.damage,
    ).toBe(3);
  });

  it("Hulk can use his printed basic THW0 when a scheme has threat, and Confused still replaces it", () => {
    let state = base();
    state.scheme.threat = 3;
    state = command(state, { type: "BASIC", action: "thwart" });
    expect(state.player.exhausted).toBe(true);
    expect(state.scheme.threat).toBe(3);
    state = base();
    state.scheme.threat = 0;
    state.player.confused = true;
    state = command(state, { type: "BASIC", action: "thwart" });
    expect(state.player.confused).toBe(false);
    expect(state.player.exhausted).toBe(true);
  });
});
