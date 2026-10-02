import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  playable,
  paymentSources,
  schemeLimit,
} from "../src/game/engine";
import { card, heroStats, maxHP, handSize } from "../src/game/cards";
import { heroStarterCodes } from "../src/game/hero-runtime";
import { seatView } from "../src/game/team";
import type { Command, Effect, GameState, Piece } from "../src/game/types";

function command(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  let guard = 0;
  while (s.review && guard++ < 60) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function base(team = false, villainId = "rhino") {
  let s = newGame({
    heroId: "thor",
    villainId,
    aspect: "aggression",
    seed: 87,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "thor", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (team) s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.hand = [];
    view.player.inPlay = [];
    view.player.discard = [];
  }
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((c) => makePiece(s, c));
  return [...s.player.hand];
}
function play(s: GameState, code: string) {
  const p = makePiece(s, code);
  s.player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind).toBe("choice");
  return command(s, { type: "CHOOSE", id });
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: makePiece(s, code), skip: true });
}
function effectIds(pieces: Piece[]) {
  return pieces.map((p) => p.id);
}

describe("Thor's full retail product through actual mission commands", () => {
  it("launches the complete published40-card starter with all imported printing IDs", () => {
    const codes = heroStarterCodes("thor");
    expect(codes).toHaveLength(40);
    const s = newGame({
      heroId: "thor",
      aspect: "aggression",
      villainId: "rhino",
      seed: 87,
      heroes: [{ heroId: "thor", aspect: "aggression", deckCards: codes }],
    });
    expect(
      [...s.player.hand, ...s.player.deck].map((p) => p.code).sort(),
    ).toEqual(codes.slice().sort());
  });
  it("Worthy retrieves Mjolnir as Odinson once per round and preserves all card instances through shuffle", () => {
    let s = base();
    s.player.form = "alter";
    const hammer = makePiece(s, "06009");
    s.player.discard = [hammer];
    const inventory = effectIds([...s.player.deck, ...s.player.discard]).sort();
    const hidden = s.hiddenInfo || 0;
    s = command(s, { type: "ABILITY", id: "identity", action: "worthy" });
    expect(s.prompt?.title).toBe("Worthy");
    s = choose(s, hammer.id);
    expect(s.player.hand).toEqual([hammer]);
    expect(
      effectIds([
        ...s.player.hand,
        ...s.player.deck,
        ...s.player.discard,
      ]).sort(),
    ).toEqual(inventory);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    expect(
      dispatch(s, { type: "ABILITY", id: "identity", action: "worthy" }).error,
    ).toBeTruthy();
  });
  it("For Asgard explicitly searches the deck/discard and only accepts Asgard cards", () => {
    let s = base();
    s.player.form = "alter";
    const h = hand(s, "06004", "06024");
    const sif = makePiece(s, "06002");
    s.player.discard = [sif];
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.prompt?.options.some((o) => o.id === sif.id)).toBe(true);
    s = choose(s, sif.id);
    expect(s.player.hand.map((p) => p.code)).toEqual(["06002"]);
  });
  it("minion entry offers Thor's optional draw once per phase, with Toughness applied before that choice", () => {
    let s = base();
    const count = s.player.deck.length;
    s = reveal(s, "06029");
    expect(s.minions[0].tough).toBe(true);
    expect(s.prompt?.title).toContain("Have at thee");
    expect(s.player.deck).toHaveLength(count);
    s = choose(s, "skip");
    s = reveal(s, "01101");
    expect(s.prompt?.title).toContain("Have at thee");
    s = choose(s, "yes");
    expect(s.player.deck).toHaveLength(count - 2);
    s = reveal(s, "01101");
    expect(s.prompt).toBeNull();
    s.phase = "villain";
    s = reveal(s, "01101");
    expect(s.prompt?.title).toContain("Have at thee");
  });
  it("Defender pays encounter discard/engagement before Confused cancels only the thwart", () => {
    let s = base();
    const h = hand(s, "06003");
    s.player.confused = true;
    s.player.confuseCards = 1;
    s.scheme.threat = 5;
    s.encounter.deck = [
      makePiece(s, "06030"),
      makePiece(s, "06028"),
      makePiece(s, "06030"),
    ];
    const before = s.player.deck.length;
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.minions[0].code).toBe("06028");
    expect(s.encounter.discard.some((p) => p.code === "06030")).toBe(true);
    s = choose(s, "yes");
    expect(s.scheme.threat).toBe(5);
    expect(s.player.confused).toBe(false);
    expect(s.player.confuseCards).toBe(0);
    expect(s.player.deck).toHaveLength(before - 2);
  });
  it("Defender's search stops at the emptied encounter deck without inventing a minion or granting threat removal", () => {
    let s = base();
    const [event] = hand(s, "06003");
    s.scheme.threat = 5;
    s.encounter.deck = [makePiece(s, "06030")];
    const acceleration = s.encounter.acceleration;
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.minions).toEqual([]);
    expect(s.scheme.threat).toBe(5);
    expect(s.encounter.acceleration).toBe(acceleration + 1);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Defender's already initiated thwart still removes threat after its engagement cost puts Baron Zemo into play", () => {
    let s = base();
    const [defender] = hand(s, "06003");
    s.scheme.threat = 5;
    s.encounter.deck = [makePiece(s, "03028"), makePiece(s, "06030")];
    s = command(s, { type: "PLAY", id: defender.id });
    expect(s.minions[0].code).toBe("03028");
    s = choose(s, "take");
    s = choose(s, "yes");
    expect(s.scheme.threat).toBe(2);
    expect(dispatch(s, { type: "BASIC", action: "thwart" }).error).toContain(
      "Zemo",
    );
  });
  it("Hammer Throw exhausts Mjolnir even when Stunned cancels its attack, and consumes the full stun card", () => {
    let s = base();
    const hammer = play(s, "06009");
    const h = hand(s, "06005", "06023", "06004");
    s.player.stunned = true;
    s.player.stunCards = 1;
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.player.inPlay.find((p) => p.id === hammer.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(0);
    expect(s.villain.hp).toBe(hp);
    expect(s.player.hand).toEqual([]);
  });
  it("Hammer Throw damages a Guard minion, applies actual Overkill and returns the exact Mjolnir", () => {
    let s = base();
    const hammer = play(s, "06009");
    const target = minion(s, "01101");
    const h = hand(s, "06005", "06023", "06004");
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.minions.some((p) => p.id === target.id)).toBe(false);
    expect(s.villain.hp).toBe(hp - 5);
    expect(s.player.hand.find((p) => p.id === hammer.id)).toMatchObject({
      exhausted: false,
    });
    expect(heroStats(s).attack).toBe(2);
  });
  it("Loki healing replaces actual defeat and suppresses Overkill under the current rules", () => {
    for (const save of [true, false]) {
      let s = base();
      play(s, "06009");
      const loki = minion(s, "06028");
      const top = makePiece(s, save ? "06030" : "06029");
      s.encounter.deck = [top, makePiece(s, "06027")];
      const h = hand(s, "06005", "06023", "06004");
      const hp = s.villain.hp;
      s = command(s, { type: "PLAY", id: h[0].id });
      s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
      if (s.prompt) s = choose(s, loki.id);
      expect(s.encounter.discard.some((p) => p.id === top.id)).toBe(true);
      expect(s.minions.some((p) => p.id === loki.id)).toBe(save);
      if (save) expect(s.minions.find((p) => p.id === loki.id)?.damage).toBe(0);
      expect(s.villain.hp).toBe(hp - (save ? 0 : 4));
    }
  });
  it("Lightning Strike combines its printed cost with Xenergy and Aerial bypasses Tough without discarding it", () => {
    let s = base(true);
    play(s, "06009");
    const target = minion(s, "06029"),
      teammate = minion(s, "06029", "p2");
    s.villain.tough = true;
    s.villain.toughCards = 1;
    target.tough = true;
    target.toughCards = 1;
    teammate.tough = true;
    teammate.toughCards = 1;
    s.player.stunned = true;
    s.player.stunCards = 1;
    const h = hand(s, "06006", "06022");
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["1"]);
    s = choose(s, "1");
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 2,
      requirements: ["energy"],
    });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.villain.hp).toBe(hp - 1);
    expect(s.villain).toMatchObject({ tough: true, toughCards: 1 });
    expect(s.minions.find((p) => p.id === target.id)).toMatchObject({
      damage: 1,
      tough: true,
      toughCards: 1,
    });
    expect(s.minions.find((p) => p.id === teammate.id)).toMatchObject({
      damage: 0,
      tough: true,
    });
    expect(s.player.stunned).toBe(true);
  });
  it("Lightning payment cancellation leaves all chosen cards and resource abilities untouched", () => {
    let s = base();
    const god = play(s, "06008");
    const h = hand(s, "06006", "06022");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = choose(s, "1");
    s = command(s, { type: "CANCEL" });
    expect(effectIds(s.player.hand)).toEqual(effectIds(h));
    expect(s.player.inPlay.find((p) => p.id === god.id)?.exhausted).toBe(false);
    expect(s.player.discard).toEqual([]);
  });
  it("Asgard/Helmet/God of Thunder retain actual generic bonuses, health dial changes and hero-only payment", () => {
    let s = base();
    const h = hand(s, "06010", "06022");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(maxHP(s)).toBe(19);
    expect(s.player.hp).toBe(19);
    const god = play(s, "06008");
    expect(paymentSources(s).find((p) => p.id === god.id)?.resources).toEqual([
      "energy",
    ]);
    s.player.form = "alter";
    expect(paymentSources(s).some((p) => p.id === god.id)).toBe(false);
    play(s, "06007");
    expect(handSize(s)).toBe(6);
  });
  it("Hercules uses engagement-based real payment reduction and Valkyrie offers a paid-energy bonus response", () => {
    let s = base();
    minion(s, "06029");
    minion(s, "01101");
    const h = hand(s, "06011", "06022", "06023");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.cost).toBe(4);
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.player.inPlay.some((p) => p.code === "06011")).toBe(true);
    const val = hand(s, "06012", "06022", "06004");
    s = command(s, { type: "PLAY", id: val[0].id });
    s = command(s, { type: "PAY", ids: [val[1].id, val[2].id] });
    expect(s.prompt?.title).toBe("Valkyrie");
    s = choose(s, "yes");
    s = choose(s, s.minions.find((p) => p.code === "01101")!.id);
    expect(s.minions.some((p) => p.code === "01101")).toBe(false);
  });
  it("Lady Sif's entry response really readies Odinson while remaining optional", () => {
    let s = base();
    s.player.form = "alter";
    s.player.exhausted = true;
    const h = hand(s, "06002", "06022", "06023");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.player.exhausted).toBe(true);
    s = choose(s, "yes");
    expect(s.player.exhausted).toBe(false);
  });
  it("Get Over Here transfers a surviving teammate minion, triggers engagement once and ignores duplicate transfer", () => {
    let s = base(true);
    play(s, "06009");
    const target = minion(s, "06029", "p2");
    target.tough = false;
    target.toughCards = 0;
    const h = hand(s, "06014", "06014");
    const deck = s.player.deck.length;
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.minions.find((p) => p.id === target.id)).toMatchObject({
      engagedWith: "p1",
      damage: 1,
    });
    s = choose(s, "skip");
    s = command(s, { type: "PLAY", id: h[1].id });
    expect(s.prompt).toBeNull();
    expect(s.player.deck).toHaveLength(deck);
    expect(s.minions.find((p) => p.id === target.id)?.damage).toBe(2);
  });
  it("Mean Swing and Teamwork modify one basic attack, with real exhaust/discard costs and no ally consequence", () => {
    let s = base();
    const hammer = play(s, "06009"),
      hercules = play(s, "06011");
    const h = hand(s, "06015", "06032");
    const hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, h[0].id);
    s = choose(s, hammer.id);
    s = choose(s, h[1].id);
    s = choose(s, hercules.id);
    expect(s.villain.hp).toBe(hp - 9);
    expect(s.player.inPlay.find((p) => p.id === hammer.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.find((p) => p.id === hercules.id)).toMatchObject({
      exhausted: true,
      damage: 0,
    });
    expect(s.player.discard.map((p) => p.code).sort()).toEqual([
      "06015",
      "06032",
    ]);
    expect(heroStats(s).attack).toBe(3);
  });
  it("Hall of Heroes grants optional glory only to identity kills, then uses real3-counter AE action", () => {
    let s = base();
    const hall = play(s, "06017"),
      ally = play(s, "06011");
    minion(s, "01101");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.prompt).toBeNull();
    expect(s.player.inPlay.find((p) => p.id === hall.id)?.counters).toBe(0);
    minion(s, "01101");
    play(s, "06009");
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.title).toBe("Hall of Heroes");
    s = choose(s, "yes");
    expect(s.player.inPlay.find((p) => p.id === hall.id)?.counters).toBe(1);
    s.player.inPlay.find((p) => p.id === hall.id)!.counters = 3;
    s.player.form = "alter";
    const deck = s.player.deck.length;
    s = command(s, { type: "ABILITY", id: hall.id, action: "hall" });
    expect(s.player.deck).toHaveLength(deck - 3);
    expect(s.player.inPlay.find((p) => p.id === hall.id)).toMatchObject({
      counters: 0,
      exhausted: true,
    });
  });
  it("Teamwork adds current THW to one basic thwart and skips a zero-power ally as an ineffective interrupt", () => {
    let s = base();
    const hercules = play(s, "06011");
    hercules.bonusThw = 2;
    const [teamwork] = hand(s, "06032");
    s.scheme.threat = 5;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, teamwork.id);
    s = choose(s, hercules.id);
    expect(s.scheme.threat).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === hercules.id)).toMatchObject({
      exhausted: true,
      damage: 0,
    });
    s = base();
    const brawn = play(s, "10011");
    brawn.bonusThw = -1; // A resolved modifier makes its current THW zero.
    const [zero] = hand(s, "06032");
    s.scheme.threat = 5;
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt).toBeNull();
    expect(s.scheme.threat).toBe(4);
    expect(s.player.hand.some((p) => p.id === zero.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.exhausted).toBe(
      false,
    );
  });
  it("Jarnbjorn responds separately to Shield Toss's two simultaneous enemy attacks with two real payments", () => {
    let s = newGame({
      heroId: "captain_america",
      aspect: "aggression",
      villainId: "rhino",
      seed: 87,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    s.player.form = "hero";
    s.player.inPlay = [];
    s.player.discard = [];
    s.player.hand = [];
    s.queue = [];
    s.review = null;
    play(s, "03009");
    const axe = play(s, "06019");
    const first = minion(s, "06029"),
      second = minion(s, "06029");
    first.tough = second.tough = false;
    first.toughCards = second.toughCards = 0;
    const h = hand(s, "03006", "03003", "03003", "06024", "06004");
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "SELECT", ids: [h[1].id, h[2].id] });
    s = command(s, { type: "SELECT", ids: [first.id, second.id] });
    expect(s.minions).toEqual([]);
    expect(s.villain.hp).toBe(hp);
    s = choose(s, axe.id);
    s = command(s, { type: "PAY", ids: [h[3].id] });
    expect(s.villain.hp).toBe(hp - 2);
    expect(s.prompt?.title).toBe("After your hero attacks");
    s = choose(s, axe.id);
    s = command(s, { type: "PAY", ids: [h[4].id] });
    expect(s.villain.hp).toBe(hp - 4);
    expect(s.prompt).toBeNull();
  });
  it("Jarnbjorn requests an actual physical resource after an event attack, deals nonattack damage and does not recur", () => {
    let s = base();
    const axe = play(s, "06019");
    const target = minion(s, "06029");
    target.tough = false;
    target.toughCards = 0;
    const h = hand(s, "06014", "06024");
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.title).toBe("After your hero attacks");
    s = choose(s, axe.id);
    expect(s.prompt?.requirements).toEqual(["physical"]);
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, s.villain.id);
    expect(s.villain.hp).toBe(hp - 2);
    expect(s.minions.find((p) => p.id === target.id)?.damage).toBe(1);
    expect(s.prompt).toBeNull();
    expect(s.player.inPlay.find((p) => p.id === axe.id)?.exhausted).toBe(false);
  });
  it("mandatory Retaliate resolves before offering optional Jarnbjorn responses", () => {
    let s = base();
    play(s, "06019");
    hand(s, "06024");
    const blasters = makePiece(s, "01153");
    blasters.attachedTo = s.villain.id;
    s.attachments.push(blasters);
    s.player.hp = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.phase).toBe("lost");
    expect(s.prompt).toBeNull();
  });
  it("Battle Fury transfers control with original ownership and pays damage/discard before readying the actual attacker", () => {
    let s = base(true);
    const h = hand(s, "06018", "06024");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, "p2");
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === h[0].id)?.ownerId,
    ).toBe("p1");
    const target = minion(s, "01101", "p2");
    target.damage = 1;
    const hp = seatView(s, "p2").player.hp;
    s = command(s, { type: "END_TURN" });
    expect(s.turnPlayerId).toBe("p2");
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.minions.some((p) => p.id === target.id)).toBe(false);
    s = choose(s, h[0].id);
    expect(seatView(s, "p2").player.hp).toBe(hp - 1);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(seatView(s, "p1").player.discard.some((p) => p.id === h[0].id)).toBe(
      true,
    );
  });
  it("Heimdall exposes only its looked cards and restores the actual chosen order", () => {
    let s = base();
    const top = ["06030", "06029", "06027", "06026"].map((c) =>
      makePiece(s, c),
    );
    s.encounter.deck = [...top];
    const h = hand(s, "06020", "06022", "06023", "06004");
    const hidden = s.hiddenInfo || 0;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id, h[3].id] });
    s = choose(s, "yes");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(
      top.slice(0, 3).map((p) => p.id),
    );
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    s = choose(s, top[1].id);
    s = choose(s, top[2].id);
    expect(effectIds(s.encounter.deck)).toEqual([
      top[2].id,
      top[0].id,
      top[3].id,
    ]);
    expect(s.encounter.discard.at(-1)?.id).toBe(top[1].id);
  });
  it("Odin's Anger offers the actual owner forced flip and refuses a missing-Mjolnir discard choice", () => {
    let s = base();
    s.player.flipped = true;
    s = reveal(s, "06026");
    s = choose(s, "flip");
    expect(s.player.form).toBe("alter");
    expect(s.player.flipped).toBe(true);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["exhaust"]);
    s = choose(s, "exhaust");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((p) => p.code === "06026")).toBe(true);
  });
  it("Heimdall discarding the last encounter card immediately rebuilds that deck and adds acceleration", () => {
    let s = base();
    const last = makePiece(s, "06030");
    s.encounter.deck = [last];
    const acceleration = s.encounter.acceleration;
    const h = hand(s, "06020", "06022", "06023", "06004");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id, h[3].id] });
    s = choose(s, "yes");
    s = choose(s, last.id);
    expect(effectIds(s.encounter.deck)).toEqual([last.id]);
    expect(s.encounter.discard).toEqual([]);
    expect(s.encounter.acceleration).toBe(acceleration + 1);
  });
  it("Family Feud includes Asgard identity/in-play cards and Trickster adds threat for unique discarded types", () => {
    let s = base();
    play(s, "06009");
    play(s, "06007");
    minion(s, "06028");
    s = reveal(s, "06027");
    expect(s.sideSchemes[0].counters).toBe(6);
    s.player.deck = ["06003", "06005", "06009", "06022"].map((c) =>
      makePiece(s, c),
    );
    const threat = s.scheme.threat;
    s = reveal(s, "06030");
    expect(s.scheme.threat).toBe(threat + 2);
    expect(s.player.discard.map((p) => p.code)).toEqual([
      "06003",
      "06005",
      "06009",
    ]);
  });
  it("Frost Giant's boost stuns only when its actual villain attack deals damage", () => {
    for (const tough of [false, true]) {
      let s = base();
      s.encounter.deck = [makePiece(s, "06029"), makePiece(s, "06030")];
      if (tough) {
        s.player.tough = true;
        s.player.toughCards = 1;
      }
      s = native(s, { type: "enemyAttack", id: s.villain.id });
      s = choose(s, "take");
      expect(s.player.stunned).toBe(!tough);
      expect(s.player.stunCards || 0).toBe(tough ? 0 : 1);
    }
  });
  it("Under Surveillance raises actual main threshold and is discarded when that card advances", () => {
    let s = base(false, "klaw");
    const h = hand(s, "06031", "06022");
    const limit = schemeLimit(s);
    const old = s.scheme.code;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(schemeLimit(s)).toBe(limit + 4);
    expect(playable(s, makePiece(s, "06031"))).toContain("already");
    s = native(s, { type: "threat", target: "main", amount: limit + 4 });
    if (s.prompt?.title?.includes("Have at thee")) s = choose(s, "skip");
    expect(s.scheme.code).not.toBe(old);
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === h[0].id)).toBe(true);
  });
  it("Frost Giant's delayed boost stuns an identity damaged by Overkill after its ally defender is defeated", () => {
    let s = base();
    const brawn = play(s, "10011");
    brawn.damage = card(brawn).health! - 1;
    const charge = makePiece(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    s.encounter.deck = [makePiece(s, "06029"), makePiece(s, "06030")];
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, brawn.id);
    expect(s.player.inPlay.some((p) => p.id === brawn.id)).toBe(false);
    expect(s.player.hp).toBeLessThan(hp);
    expect(s.player).toMatchObject({ stunned: true, stunCards: 1 });
  });
  it("Second Wind heals an actual teammate identity using paid mental and Enhanced Physique consumes3 real counters", () => {
    let s = base(true);
    seatView(s, "p2").player.hp -= 6;
    const h = hand(s, "06033", "06023", "06004");
    const hp = seatView(s, "p2").player.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    s = choose(s, "p2");
    expect(seatView(s, "p2").player.hp).toBe(hp + 5);
    expect(s.activePlayerId).toBe(s.turnPlayerId);
    const ph = hand(
      s,
      "06034",
      "06022",
      "06021",
      "06021",
      "06021",
      "06004",
      "06004",
      "06004",
    );
    s = command(s, { type: "PLAY", id: ph[0].id });
    s = command(s, { type: "PAY", ids: [ph[1].id] });
    const physique = s.player.inPlay.find((p) => p.id === ph[0].id)!;
    expect(physique.counters).toBe(3);
    for (let i = 0; i < 3; i++) {
      const current = s.player.inPlay.find((p) => p.id === physique.id)!;
      current.exhausted = false;
      s.player.tough = false;
      s.player.toughCards = 0;
      const event = s.player.hand.find((p) => p.code === "06021")!,
        resource = s.player.hand.find((p) => p.code === "06004")!;
      s.player.hand.push(makePiece(s, "06004"));
      const other = s.player.hand.at(-1)!;
      s = command(s, { type: "PLAY", id: event.id });
      s = command(s, {
        type: "PAY",
        ids: [physique.id, resource.id, other.id],
      });
    }
    expect(s.player.inPlay.some((p) => p.id === physique.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === physique.id)).toBe(true);
  });
});
