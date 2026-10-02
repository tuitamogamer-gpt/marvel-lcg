import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine";
import { card, heroStats, maxHP } from "../src/game/cards";
import { heroStarterCodes } from "../src/game/hero-runtime";
import {
  captainPackAllyLimit,
  captainPackHasTrait,
} from "../src/game/captain-pack";
import { seatView } from "../src/game/team";
import type { Command, Effect, GameState } from "../src/game/types";

function command(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
  expect(s.error).toBeUndefined();
  let n = 0;
  while (s.review && n++ < 50) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function base(team = false) {
  let s = newGame({
    heroId: "captain_america",
    villainId: "rhino",
    aspect: "leadership",
    seed: 42,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "captain_america", aspect: "leadership" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (team) s = command(s, { type: "MULLIGAN", ids: [] });
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
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function support(s: GameState, code: string, target?: string) {
  const p = makePiece(s, code);
  p.attachedTo = target;
  s.player.inPlay.push(p);
  return p;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind).toBe("choice");
  return command(s, { type: "CHOOSE", id });
}
function select(s: GameState, ids: string[]) {
  expect(s.prompt?.kind).toBe("select");
  return command(s, { type: "SELECT", ids });
}

describe("Captain America full product through actual mission commands", () => {
  it("accepts the complete published40-card source starter, including every pack-specific rule", () => {
    const codes = heroStarterCodes("captain_america");
    expect(codes).toHaveLength(40);
    const s = newGame({
      heroId: "captain_america",
      aspect: "leadership",
      villainId: "rhino",
      seed: 42,
      heroes: [
        { heroId: "captain_america", aspect: "leadership", deckCards: codes },
      ],
    });
    expect(
      [...s.player.hand, ...s.player.deck].map((p) => p.code).sort(),
    ).toEqual(codes.sort());
  });
  it("Falcon preserves encounter order and removes one threat per treachery from separately chosen schemes", () => {
    let s = base();
    const h = hand(s, "03011", "03021", "03022");
    const scheme = makePiece(s, "03027");
    scheme.counters = 3;
    s.sideSchemes.push(scheme);
    s.scheme.threat = 3;
    s.encounter.deck = ["03030", "03028", "03030"].map((code) =>
      makePiece(s, code),
    );
    const top = s.encounter.deck.map((p) => p.id);
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    s = choose(s, "yes");
    expect(s.prompt?.options[0].detail).toContain("Hail Hydra!");
    s = choose(s, "continue");
    s = choose(s, "main");
    s = choose(s, scheme.id);
    expect(s.scheme.threat).toBe(2);
    expect(s.sideSchemes[0].counters).toBe(2);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(top);
  });
  it("SquirrelGirl's entry damages all enemies once without consuming the hero's Stunned status", () => {
    let s = base();
    const h = hand(s, "03013", "03021");
    const guard = makePiece(s, "03029");
    guard.engagedWith = s.activePlayerId;
    s.minions.push(guard);
    s.player.stunned = true;
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, "yes");
    expect(s.villain.hp).toBe(hp - 1);
    expect(s.minions[0].damage).toBe(1);
    expect(s.player.stunned).toBe(true);
  });
  it("WonderMan attacks only after selected discard payment and takes his printed consequence", () => {
    let s = base();
    const ally = support(s, "03014");
    const h = hand(s, "03003", "03004");
    const hp = s.villain.hp;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.player.inPlay[0].exhausted).toBe(false);
    s = select(s, [h[1].id]);
    expect(s.villain.hp).toBe(hp - 3);
    expect(s.player.inPlay[0]).toMatchObject({ exhausted: true, damage: 1 });
    expect(s.player.discard.map((p) => p.code)).toEqual(["03004"]);
  });
  it("WonderMan's Stunned attack still pays both hand-discard and exhaust costs, with no attack damage or consequence", () => {
    let s = base();
    const ally = support(s, "03014");
    ally.stunned = true;
    const h = hand(s, "03003");
    const hp = s.villain.hp;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = select(s, [h[0].id]);
    expect(s.player.inPlay[0]).toMatchObject({
      exhausted: true,
      stunned: false,
      damage: 0,
    });
    expect(s.villain.hp).toBe(hp);
    expect(s.player.discard.map((p) => p.code)).toEqual(["03003"]);
  });
  it("StrengthInNumbers exhausts exactly the chosen ready allies and draws without consequential damage", () => {
    let s = base();
    const a = support(s, "03002");
    const b = support(s, "03014");
    const c = support(s, "03011");
    c.exhausted = true;
    const h = hand(s, "03017");
    const before = s.player.deck.length;
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    s = select(s, [a.id, b.id]);
    expect(s.player.deck).toHaveLength(before - 2);
    expect(s.player.inPlay.every((p) => p.exhausted && p.damage === 0)).toBe(
      true,
    );
  });
  it("Quinjet earns optional turn counters and puts an ally into play, bypassing payment and consuming no next-play discounts", () => {
    let s = base();
    const jet = support(s, "03019");
    jet.counters = 1;
    s = native(s, { type: "beginTurn" });
    expect(s.prompt?.title).toBe("Quinjet");
    s = choose(s, "yes");
    expect(s.player.inPlay[0].counters).toBe(2);
    const h = hand(s, "03014");
    s.flags.captainTowerDiscount = 1;
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: jet.id, action: "quinjet" });
    s = choose(s, h[0].id);
    expect(s.player.inPlay.some((p) => p.code === "03014")).toBe(true);
    expect(s.player.inPlay.some((p) => p.code === "03019")).toBe(false);
    expect(s.flags.captainTowerDiscount).toBe(1);
    expect(s.flags.captainFirstAllyRound).toBeUndefined();
    expect(s.prompt).toBeNull();
  });
  it("Quinjet applies normal ally-limit choices and initializes Core Hawkeye reprint's four arrows", () => {
    let s = base();
    const jet = support(s, "03019");
    jet.counters = 3;
    const a = support(s, "03002");
    support(s, "03014");
    support(s, "01068");
    const h = hand(s, "03012");
    s = command(s, { type: "ABILITY", id: jet.id, action: "quinjet" });
    s = choose(s, h[0].id);
    expect(s.prompt?.title).toBe("Ally limit");
    s = choose(s, a.id);
    expect(
      s.player.inPlay.filter((p) => card(p).type_code === "ally"),
    ).toHaveLength(3);
    expect(s.player.inPlay.find((p) => p.code === "03012")?.counters).toBe(4);
  });
  it("Tower's actual next-Avenger discount stacks with LivingLegend and expires at phase end", () => {
    let s = base();
    const tower = support(s, "03024");
    s.player.form = "alter";
    const h = hand(s, "03014", "03004");
    s = command(s, { type: "ABILITY", id: tower.id, action: "tower" });
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt).toBeNull();
    expect(s.player.inPlay.some((p) => p.code === "03014")).toBe(true);
    expect(s.player.hand.map((p) => p.code)).toEqual(["03004"]);
    expect(s.flags.captainTowerDiscount).toBeUndefined();
  });
  it("Tower increases ally limit only while every controlled ally has Avenger", () => {
    let s = base();
    support(s, "03024");
    support(s, "03014");
    support(s, "03012");
    support(s, "01068");
    expect(captainPackAllyLimit(s)).toBe(1);
    const h = hand(s, "03013", "03021");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, "skip");
    expect(
      s.player.inPlay.filter((p) => card(p).type_code === "ally"),
    ).toHaveLength(4);
    expect(s.prompt).toBeNull();
  });
  it("removing an ally's HonoraryAvenger immediately restores Tower's normal ally limit", () => {
    let s = base();
    support(s, "03024");
    const agent = support(s, "03002");
    support(s, "03014");
    support(s, "03012");
    const h = hand(s, "03025", "03013", "03021");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = choose(s, agent.id);
    expect(captainPackAllyLimit(s)).toBe(1);
    s = command(s, { type: "PLAY", id: h[1].id });
    s = command(s, { type: "PAY", ids: [h[2].id] });
    s = choose(s, "skip");
    expect(
      s.player.inPlay.filter((p) => card(p).type_code === "ally"),
    ).toHaveLength(4);
    s = native(s, { type: "discardPiece", id: h[0].id });
    expect(captainPackAllyLimit(s)).toBe(0);
    expect(s.prompt?.title).toBe("Ally limit");
    s = choose(s, agent.id);
    expect(
      s.player.inPlay.filter((p) => card(p).type_code === "ally"),
    ).toHaveLength(3);
  });
  it("HonoraryAvenger attaches to another identity, transfers control, increases remaining/max HP and returns to its owner when discarded", () => {
    let s = base(true);
    const h = hand(s, "03025");
    const oldHP = s.players[1].player.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = choose(s, "hero:p2");
    expect(
      s.players[1].player.inPlay.some(
        (p) =>
          p.id === h[0].id && p.ownerId === "p1" && p.attachedTo === "hero:p2",
      ),
    ).toBe(true);
    expect(s.players[1].player.hp).toBe(oldHP + 1);
    expect(maxHP(seatView(s, "p2"))).toBe(11);
    expect(captainPackHasTrait(s, "hero:p2", "Avenger")).toBe(true);
    s = native(s, { type: "discardPiece", id: h[0].id });
    expect(s.players[1].player.hp).toBe(oldHP);
    expect(s.players[0].player.discard.some((p) => p.id === h[0].id)).toBe(
      true,
    );
    expect(maxHP(seatView(s, "p2"))).toBe(10);
  });
  it("HonoraryAvenger enforces active Avenger identity permission and maximum one per friendly character", () => {
    let s = base();
    const h = hand(s, "03025", "03025");
    s.player.form = "alter";
    expect(playable(s, h[0])).toContain("Avenger");
    s.player.form = "hero";
    s = command(s, { type: "PLAY", id: h[0].id });
    s = choose(s, "hero:p1");
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(12);
    expect(playable(s, h[1])).toContain("eligible");
  });
  it("Enraged's attached ally gains2ATK and takes one extra attack consequence", () => {
    let s = base();
    const ally = support(s, "03014");
    const h = hand(s, "03031", "03003", "03004");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, ally.id);
    const hp = s.villain.hp;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = select(s, [h[2].id]);
    expect(s.villain.hp).toBe(hp - 5);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(2);
  });
  it("Followed's scheme-defeat interrupt damages the villain through Guard and discards with its attachment", () => {
    let s = base();
    const scheme = makePiece(s, "03027");
    scheme.counters = 2;
    s.sideSchemes.push(scheme);
    s.scheme.threat = 3;
    const guard = makePiece(s, "03029");
    guard.engagedWith = s.activePlayerId;
    s.minions.push(guard);
    const h = hand(s, "03032", "03003");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, scheme.id);
    const hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, scheme.id);
    expect(s.prompt?.title).toBe("Followed");
    s = choose(s, "yes");
    s = choose(s, s.villain.id);
    expect(s.villain.hp).toBe(hp - 4);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.player.discard.some((p) => p.code === "03032")).toBe(true);
  });
  it("ExpertDefense resolves before boost cards and retains its3DEF modifier through attack calculation", () => {
    let s = base();
    const h = hand(s, "03033");
    s.encounter.deck = [makePiece(s, "03027"), makePiece(s, "03030")];
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    expect(s.prompt?.options.some((o) => o.id === h[0].id)).toBe(true);
    s = choose(s, h[0].id);
    if (s.prompt) s = choose(s, "resolve");
    expect(s.player.hp).toBe(hp);
    expect(s.player.discard.some((p) => p.code === "03033")).toBe(true);
    expect(s.attack).toBeNull();
    expect(heroStats(s).defense).toBe(2);
  });
  it("multiple ExpertDefense copies can interrupt the same basic defense before boosts", () => {
    let s = base();
    const h = hand(s, "03033", "03033");
    s.encounter.deck = [makePiece(s, "03027"), makePiece(s, "03030")];
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    s = choose(s, h[0].id);
    expect(s.prompt?.options.map((o) => o.id)).toContain(h[1].id);
    s = choose(s, h[1].id);
    if (s.prompt) s = choose(s, "resolve");
    expect(s.player.hp).toBe(hp);
    expect(s.player.discard.filter((p) => p.code === "03033")).toHaveLength(2);
    expect(s.attack).toBeNull();
  });
  it("EnhancedAwareness pays three separate real cards and discards immediately after its final mental counter", () => {
    let s = base();
    const h = hand(s, "03034", "03022", "03008", "03019", "03007");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.player.inPlay[0].counters).toBe(3);
    for (const [i, cardId] of [h[2].id, h[3].id, h[4].id].entries()) {
      if (i > 0) s = native(s, { type: "ready", target: h[0].id });
      expect(
        paymentSources(s).find((p) => p.id === h[0].id)?.resources,
      ).toEqual(["mental"]);
      s = command(s, { type: "PLAY", id: cardId });
      s = command(s, { type: "PAY", ids: [h[0].id] });
      if (i < 2)
        expect(s.player.inPlay.find((p) => p.id === h[0].id)?.counters).toBe(
          2 - i,
        );
    }
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(false);
    expect(s.player.discard.some((p) => p.code === "03034")).toBe(true);
    expect(s.player.inPlay.some((p) => p.code === "03007")).toBe(true);
  });
  it("AvengersAssemble readies controlled Avengers, grants temporary global powers and observes max1 across all players", () => {
    let s = base(true);
    const ally = support(s, "03014");
    ally.exhausted = true;
    s.player.exhausted = true;
    s.players[1].player.exhausted = true;
    const h = hand(s, "03015", "03021", "03022");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.player.exhausted).toBe(false);
    expect(heroStats(s).attack).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.inPlay[0].bonusAtk).toBe(1);
    const attackCost = hand(s, "03003");
    const beforeAttack = s.villain.hp;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = select(s, [attackCost[0].id]);
    expect(s.villain.hp).toBe(beforeAttack - 4);
    const other = seatView(s, "p2");
    expect(heroStats(other).attack).toBe(3);
    expect(other.player.exhausted).toBe(true);
    const second = makePiece(s, "03015");
    s.players[1].player.hand = [
      second,
      makePiece(s, "03021"),
      makePiece(s, "03022"),
    ];
    expect(playable(seatView(s, "p2"), second)).toContain("once per round");
    s = native(s, { type: "refill", actorId: "p1" });
    expect(heroStats(seatView(s, "p1")).attack).toBe(2);
    expect(heroStats(seatView(s, "p2")).attack).toBe(2);
    expect(
      s.players[0].player.inPlay.find((p) => p.id === ally.id)!.bonusAtk,
    ).toBe(0);
  });
  it("AvengersAssemble's temporary attack bonus also affects Avenger enemies already in play", () => {
    let s = base();
    const enemy = makePiece(s, "56073"); // Printed Avenger minion; no reveal ability is invoked by this fixture.
    enemy.engagedWith = s.activePlayerId;
    enemy.exhausted = true;
    s.minions.push(enemy);
    const h = hand(s, "03015", "03021", "03022");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.minions[0]).toMatchObject({ exhausted: true, bonusAtk: 1 });
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = choose(s, "take");
    if (s.prompt) s = choose(s, "resolve");
    expect(s.player.hp).toBe(hp - 2);
    s = native(s, { type: "refill", actorId: "p1" });
    expect(s.minions[0].bonusAtk).toBe(0);
  });
});
