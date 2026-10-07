import { describe, expect, it } from "vitest";
import { heroStats } from "../src/game/cards.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import type { Command, Effect, GameState } from "../src/game/types.js";

function command(s: GameState, cmd: Command): GameState {
  let next = dispatch(s, cmd);
  expect(next.error, JSON.stringify(next.prompt)).toBeUndefined();
  for (let i = 0; next.review && i < 100; i++)
    next = dispatch(next, { type: "PROCEED" });
  expect(next.error, JSON.stringify(next.prompt)).toBeUndefined();
  return next;
}
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function choose(s: GameState, id: string) {
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(reload(s), { type: "CHOOSE", id });
}
function pass(s: GameState) {
  for (let i = 0; s.prompt && i < 50; i++) {
    const option = s.prompt.options.find((o) =>
      /^(continue|pass|skip|no|none)$/.test(o.id),
    );
    expect(option, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, option!.id);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
function base(heroId = "groot") {
  let s = newGame({
    heroId,
    aspect: "aggression",
    villainId: "rhino",
    seed: 16160,
    pacing: "expert",
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  s.player.form = "hero";
  s.player.exhausted = false;
  s.player.flipped = false;
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.player.deck = Array.from({ length: 10 }, () => makePiece(s, "01088"));
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 10;
  s.villain.hp = s.villain.maxHp = 50;
  s.encounter.deck = Array.from({ length: 10 }, () => makePiece(s, "01108"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
function put(s: GameState, code: string, counters = 0) {
  const p = makePiece(s, code);
  p.ownerId = s.activePlayerId;
  p.counters = counters;
  s.player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code = "01101", damage = 0) {
  const p = makePiece(s, code);
  p.damage = damage;
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Native rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function attack(s: GameState) {
  return native(s, { type: "enemyAttack", id: s.villain.id });
}

describe("GMW basic power and defense adapters", () => {
  it("combines paid Vine Spikes and Hand Cannon bonuses once on the same native attack", () => {
    let s = base();
    s.flags.grootGrowthCounters = 5;
    const spikes = put(s, "16011"),
      cannon = put(s, "16046", 3),
      mercenary = minion(s);
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, spikes.id);
    s = choose(s, cannon.id);
    s = target(s, mercenary.id);
    s = pass(s);
    expect(s.minions).toHaveLength(0);
    expect(s.villain.hp).toBe(47);
    expect(s.flags.grootGrowthCounters).toBe(4);
    expect(s.player.inPlay.find((p) => p.id === spikes.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.find((p) => p.id === cannon.id)?.counters).toBe(2);
  });
  it("offers each remaining Hand Cannon once and discards a physical last-charge Cannon", () => {
    let s = base();
    const one = put(s, "16046", 1),
      two = put(s, "16046", 1);
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, one.id);
    s = choose(s, two.id);
    s = target(s, s.villain.id);
    s = pass(s);
    expect(s.villain.hp).toBe(44);
    expect(s.player.inPlay.some((p) => [one.id, two.id].includes(p.id))).toBe(
      false,
    );
    expect(
      s.player.discard.filter((p) => [one.id, two.id].includes(p.id)),
    ).toHaveLength(2);
  });
  it("Stun replacement leaves Vines and Hand Cannon costs untouched", () => {
    let s = base();
    s.flags.grootGrowthCounters = 5;
    s.player.stunned = true;
    const spikes = put(s, "16011"),
      cannon = put(s, "16046", 3);
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    s = pass(s);
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.flags.grootGrowthCounters).toBe(5);
    expect(s.player.inPlay.find((p) => p.id === spikes.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.inPlay.find((p) => p.id === cannon.id)?.counters).toBe(3);
  });
  it.each(["tiny", "giant"] as const)(
    "preserves Hand Cannon bonus and overkill for %s Wasp",
    (form) => {
      let s = base("wsp");
      s.player.heroForm = form;
      const cannon = put(s, "16046", 3),
        furnax = minion(s, "16027", 4);
      s = command(s, { type: "BASIC", action: "attack" });
      s = choose(s, cannon.id);
      if (form === "giant") s = choose(s, `${furnax.id}:4`);
      else s = target(s, furnax.id);
      s = pass(s);
      expect(s.minions).toHaveLength(0);
      expect(s.villain.hp).toBe(form === "tiny" ? 49 : 48);
    },
  );
  it("preserves Cannon modifiers while Rapid Growth changes Tiny Wasp to Giant", () => {
    let s = base("wsp");
    s.player.heroForm = "tiny";
    const cannon = put(s, "16046", 3),
      mercenary = minion(s),
      rapid = makePiece(s, "13005"),
      resource = makePiece(s, "01088");
    s.player.hand = [rapid, resource];
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, cannon.id);
    s = choose(s, rapid.id);
    s = command(reload(s), { type: "PAY", ids: [resource.id] });
    if (s.prompt?.options.some((o) => o.id === "continue"))
      s = choose(s, "continue");
    s = pass(s);
    expect(s.player.heroForm).toBe("giant");
    expect(s.minions).toHaveLength(0);
    expect(s.villain.hp).toBe(47);
    expect(s.player.discard.some((p) => p.id === rapid.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === cannon.id)?.counters).toBe(2);
    expect(mercenary.id).toBeTruthy();
  });
  it("Lashing Vines follows an actual native basic thwart after printed threat removal", () => {
    let s = base();
    s.flags.grootGrowthCounters = 5;
    const entangling = put(s, "16008"),
      lashing = put(s, "16009");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, entangling.id);
    s = target(s, "main");
    expect(s.scheme.threat).toBe(7);
    expect(s.player.exhausted).toBe(true);
    s = choose(s, lashing.id);
    s = pass(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.flags.grootGrowthCounters).toBe(2);
  });
  it("Confuse replacement creates no Lashing Vines or Rocket plan response", () => {
    for (const heroId of ["groot", "rocket"]) {
      let s = base(heroId);
      s.player.confused = true;
      s.flags.grootGrowthCounters = 5;
      const lashing = put(s, "16009"),
        plan = makePiece(s, "16030");
      s.player.hand = [plan, makePiece(s, "01088")];
      s = command(s, { type: "BASIC", action: "thwart" });
      s = target(s, "main");
      s = pass(s);
      expect(s.scheme.threat).toBe(10);
      expect(s.player.confused).toBe(false);
      expect(s.player.exhausted).toBe(true);
      expect(s.player.inPlay.find((p) => p.id === lashing.id)?.exhausted).toBe(
        false,
      );
      expect(s.player.hand.some((p) => p.id === plan.id)).toBe(true);
    }
  });
  it("I've Got a Plan retains repeated response windows and stacks phase THW bonuses", () => {
    let s = base("rocket");
    const plans = [makePiece(s, "16030"), makePiece(s, "16030")],
      resources = [makePiece(s, "01088"), makePiece(s, "01089")];
    s.player.hand = [...plans, ...resources];
    s = command(s, { type: "BASIC", action: "thwart" });
    s = target(s, "main");
    for (let i = 0; i < 2; i++) {
      s = choose(s, plans[i].id);
      s = command(reload(s), { type: "PAY", ids: [resources[i].id] });
    }
    s = pass(s);
    expect(s.player.exhausted).toBe(false);
    expect(heroStats(s).thwart).toBe(4);
    s = command(s, { type: "BASIC", action: "thwart" });
    s = target(s, "main");
    s = pass(s);
    expect(s.scheme.threat).toBe(4);
    expect(
      s.player.discard.filter((p) => plans.some((q) => q.id === p.id)),
    ).toHaveLength(2);
  });
  it("Bug heals only after an actual basic attack, including zero Tough-prevented damage", () => {
    let s = base("rocket");
    const bug = put(s, "16040");
    bug.damage = 1;
    s.villain.tough = true;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    const response = s.prompt?.options.find((o) => o.id === "yes")!;
    expect(response).toBeTruthy();
    s = choose(s, response.id);
    s = pass(s);
    expect(s.player.inPlay.find((p) => p.id === bug.id)?.damage).toBe(0);
    expect(s.villain.hp).toBe(50);
  });
  it("stunned basic attacks do not heal Bug", () => {
    let s = base("rocket");
    const bug = put(s, "16040");
    bug.damage = 1;
    s.player.stunned = true;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    s = pass(s);
    expect(s.player.inPlay.find((p) => p.id === bug.id)?.damage).toBe(1);
  });
  it("Vine Shield prevents before boosts and Lashing Vines follows completed basic defense", () => {
    let s = base();
    s.flags.grootGrowthCounters = 5;
    const shield = put(s, "16010"),
      lashing = put(s, "16009");
    s = attack(s);
    s = choose(s, "hero");
    s = choose(s, shield.id);
    expect(s.player.hp).toBe(10);
    expect(s.flags.grootGrowthCounters).toBe(4);
    expect(s.player.exhausted).toBe(true);
    s = choose(s, lashing.id);
    s = pass(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.flags.grootGrowthCounters).toBe(2);
  });
  it("Desperate Defense gives its +2 before boost reveal and does not ready after actual damage", () => {
    let s = base("rocket");
    const event = makePiece(s, "16013"),
      resource = makePiece(s, "01088");
    s.player.hand = [event, resource];
    const hard = put(s, "16017");
    s = attack(s);
    s = choose(s, "hero");
    s = choose(s, event.id);
    s = command(reload(s), { type: "PAY", ids: [resource.id] });
    s = pass(s);
    expect(s.player.hp).toBe(8); // Rocket starts at 9 HP; Rhino's 4 total ATK exceeds 3 DEF by 1.
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === hard.id)?.exhausted).toBe(
      false,
    );
  });
  it("Desperate Defense readies the actual defender and Hard to Ignore removes threat after a damage-free attack", () => {
    let s = base();
    s.flags.grootGrowthCounters = 5;
    const event = makePiece(s, "16013"),
      resource = makePiece(s, "01088"),
      hard = put(s, "16017");
    s.player.hand = [event, resource];
    s = attack(s);
    s = choose(s, "hero");
    s = choose(s, event.id);
    s = command(reload(s), { type: "PAY", ids: [resource.id] });
    expect(s.prompt?.title).toBe("Hard to Ignore");
    s = choose(s, "yes");
    s = pass(s);
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(false);
    expect(s.flags.grootGrowthCounters).toBe(5);
    expect(s.scheme.threat).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === hard.id)?.exhausted).toBe(true);
  });
  it("the physical Groot ally heals after surviving a native defended attack", () => {
    let s = base("rocket");
    const grootAlly = put(s, "16047");
    grootAlly.damage = 1;
    s = attack(s);
    s = choose(s, grootAlly.id);
    expect(s.prompt?.title).toBe("Groot");
    s = choose(s, "yes");
    s = pass(s);
    expect(s.player.inPlay.find((p) => p.id === grootAlly.id)?.damage).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === grootAlly.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.hp).toBe(9);
  });
});
