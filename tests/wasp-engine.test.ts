/** Wasp acceptance uses native commands, original physical cards and saved decisions. */
import { describe, expect, it } from "vitest";
import {
  aerial,
  handSize,
  heroCard,
  heroStats,
  maxHP,
  pieceHP,
} from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

function command(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let guard = 0; s.review && guard < 80; guard++)
    s = dispatch(s, { type: "PROCEED" });
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  expect(s.review).toBeNull();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt!.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function respond(s: GameState, text: RegExp, code?: string) {
  for (let guard = 0; guard < 12; guard++) {
    expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
    const o =
      s.prompt!.options.find(
        (o) => text.test(o.label) || (code && o.image === code),
      ) ||
      (text.test(s.prompt!.title)
        ? s.prompt!.options.find((o) => o.id === "yes")
        : undefined);
    if (o) return choose(s, o.id);
    s = skip(s);
  }
  throw Error(`Missing response ${text}: ${JSON.stringify(s.prompt)}`);
}
function skip(s: GameState) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  const o = s.prompt!.options.find(
    (o) =>
      /^(skip|pass|none|done|continue|no)$/.test(o.id) ||
      /^(skip|pass|continue without|do not|no response|decline)/i.test(o.label),
  );
  expect(o, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(s, o!.id);
}
function skipAll(s: GameState) {
  for (let guard = 0; s.prompt && guard < 30; guard++) s = skip(s);
  expect(s.prompt).toBeNull();
  return s;
}
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function base(team = false) {
  let s = newGame({
    heroId: "wsp",
    aspect: "aggression",
    villainId: "rhino",
    seed: 13001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "wsp", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (team) s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    if (v.heroId === "wsp") v.player.heroForm = "tiny";
    v.player.flipped = false;
    v.player.exhausted = false;
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.deck = Array.from({ length: 12 }, () => makePiece(s, "13021"));
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.scheme.threat = 8;
  s.villain.hp = s.villain.maxHp = 40;
  return s;
}
function put(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function minion(s: GameState, code = "01101", playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function side(s: GameState, code = "01107", threat = 2) {
  const p = makePiece(s, code);
  p.counters = threat;
  s.sideSchemes.push(p);
  return p;
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
function paid(
  s: GameState,
  piece: Piece,
  ids: string[],
  wildAs?: "energy" | "mental" | "physical",
) {
  s = command(s, { type: "PLAY", id: piece.id });
  expect(s.prompt?.kind).toBe("payment");
  return command(reload(s), {
    type: "PAY",
    ids,
    ...(wildAs ? { wildAs } : {}),
  });
}
function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
function physical(s: GameState) {
  return [
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.discard,
    ...s.player.inPlay,
    ...s.resolving,
  ];
}
function allocate(s: GameState, id: string, amount: number) {
  return choose(reload(s), `${id}:${amount}`);
}

describe("Wasp's full retail pack through actual engine commands", () => {
  it("launches the exact source 40-card Aggression deck including every original printing", () => {
    const source = STARTER_DECKS.find((d) => d.id === "starter-13001a")!;
    const codes = heroStarterCodes("wsp");
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("13"))).toBe(true);
    expect(deckErrors("wsp", "aggression", codes)).toEqual([]);
    const s = newGame({
      heroId: "wsp",
      aspect: "aggression",
      villainId: "rhino",
      seed: 13001,
      heroes: [{ heroId: "wsp", aspect: "aggression", deckCards: codes }],
    });
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.hp).toBe(11);
    expect(heroCard(s).code).toBe("13001b");
    expect(handSize(s)).toBe(6);
    expect(s.encounter.deck.some((p) => p.code === "13026")).toBe(true);
  });

  it("offers both other forms, preserves canceled choices and resolves saved form choices", () => {
    let s = base();
    s = command(s, { type: "FLIP" });
    expect(s.prompt?.title).toBe("Change form");
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual([
      "alter",
      "giant",
    ]);
    expect(s.player.flipped).toBe(false);
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player).toMatchObject({
      form: "hero",
      heroForm: "tiny",
      flipped: false,
    });
    s = choose(command(reload(s), { type: "FLIP" }), "giant");
    s = skipAll(s);
    expect(s.player).toMatchObject({
      form: "hero",
      heroForm: "giant",
      flipped: true,
    });
    expect(heroCard(s).code).toBe("13001c");
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 3,
      recover: 3,
    });
    expect(handSize(s)).toBe(5);
    expect(
      dispatch(reload(s), { type: "FLIP", target: "tiny" }).error,
    ).toBeTruthy();
  });

  it("uses Tiny printed stats and Nadia's Genius trait, with no Ant-Man entry response", () => {
    let s = base();
    expect(heroStats(s)).toMatchObject({
      attack: 1,
      thwart: 1,
      defense: 2,
      recover: 3,
    });
    expect(heroCard(s).traits).toBe("Avenger. Tiny.");
    expect(maxHP(s)).toBe(11);
    s.player.hp = 7;
    s = skipAll(command(s, { type: "FLIP", target: "alter" }));
    expect(heroCard(s).code).toBe("13001b");
    expect(heroCard(s).traits).toBe("Genius.");
    expect(s.player.hp).toBe(7);
    expect(s.villain.hp).toBe(40);
    expect(s.scheme.threat).toBe(8);
  });

  it("Helmet modifiers follow the exact hero face and disappear under Tech Theft", () => {
    const s = base();
    put(s, "13010");
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 1, defense: 2 });
    s.player.heroForm = "giant";
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 3, defense: 3 });
    side(s, "12026", 2);
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 3 });
  });

  it("Small but Mighty is optional after Tiny basic attack defeats a minion", () => {
    let s = base();
    const enemy = minion(s);
    enemy.damage = pieceHP(s, enemy) - 1;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, enemy.id);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.villain.hp).toBe(40);
    s = respond(reload(s), /Small but Mighty|deal 1 damage/i, "13001a");
    s = skipAll(s);
    expect(s.villain.hp).toBe(39);
    expect(s.encounter.discard.filter((p) => p.id === enemy.id)).toHaveLength(
      1,
    );
  });

  it("Small but Mighty can be declined and does not fire for a controlled ally's defeat", () => {
    let s = base();
    const enemy = minion(s);
    enemy.damage = pieceHP(s, enemy) - 1;
    s = target(command(s, { type: "BASIC", action: "attack" }), enemy.id);
    s = skipAll(reload(s));
    expect(s.villain.hp).toBe(40);
    const second = minion(s),
      ally = put(s, "13018");
    second.damage = pieceHP(s, second) - 1;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      second.id,
    );
    expect(s.prompt?.options.some((o) => o.image === "13001a")).not.toBe(true);
    s = skipAll(s);
    expect(s.villain.hp).toBe(40);
  });

  it("Tiny basic thwart opens Small but Mighty after defeating a side scheme", () => {
    let s = base();
    const scheme = side(s, "01107", 1);
    s = target(command(s, { type: "BASIC", action: "thwart" }), scheme.id);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    s = respond(reload(s), /Small but Mighty/i, "13001a");
    s = skipAll(s);
    expect(s.villain.hp).toBe(39);
  });

  it("Pinpoint Strike in Tiny gains eight damage and overkill, then an independent Tiny response", () => {
    let s = base();
    const enemy = minion(s),
      h = hand(s, "13004", "13021", "13022");
    expect(pieceHP(s, enemy)).toBe(3);
    s = target(
      paid(
        s,
        h[0],
        h.slice(1).map((p) => p.id),
      ),
      enemy.id,
    );
    expect(s.villain.hp).toBe(35);
    s = respond(reload(s), /Small but Mighty/i, "13001a");
    s = skipAll(s);
    expect(s.villain.hp).toBe(34);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Giant Pinpoint Strike deals seven damage with no overkill and no Tiny response", () => {
    let s = base();
    s.player.heroForm = "giant";
    const enemy = minion(s),
      h = hand(s, "13004", "13021", "13022");
    s = target(
      paid(
        s,
        h[0],
        h.slice(1).map((p) => p.id),
      ),
      enemy.id,
    );
    s = skipAll(s);
    expect(s.villain.hp).toBe(40);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
  });

  it("Stunned replaces the complete paid Pinpoint Strike including overkill and defeats", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    const enemy = minion(s),
      h = hand(s, "13004", "13021", "13022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
    expect(s.villain.hp).toBe(40);
    expect(s.player.stunned).toBe(false);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
    expect(s.prompt).toBeNull();
  });

  it("Tiny Giant Help removes three threat and opens its identity response after an event defeat", () => {
    let s = base();
    const scheme = side(s, "01107", 3),
      h = hand(s, "13003", "13021");
    s = target(paid(s, h[0], [h[1].id]), scheme.id);
    s = respond(reload(s), /Small but Mighty/i, "13001a");
    s = skipAll(s);
    expect(s.villain.hp).toBe(39);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Confused replaces Giant Help's paid thwart before any allocation or Tiny response", () => {
    let s = base();
    s.player.heroForm = "giant";
    s.player.confused = true;
    s.player.confuseCards = 1;
    const scheme = side(s, "01107", 2),
      h = hand(s, "13003", "13021");
    s = paid(s, h[0], [h[1].id]);
    expect(s.scheme.threat).toBe(8);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
    expect(s.player.confused).toBe(false);
    expect(s.prompt).toBeNull();
  });

  it("Tiny Wasp Sting deals exactly five damage with normal paid-card conservation", () => {
    let s = base();
    const h = hand(s, "13006", "13021");
    s = target(paid(s, h[0], [h[1].id]), s.villain.id);
    s = skipAll(reload(s));
    expect(s.villain.hp).toBe(35);
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      h.map((p) => p.id).sort(),
    );
  });

  it.each(["13003", "13004", "13006"])(
    "rejects hero action %s in Nadia form without paying",
    (code) => {
      const s = base();
      s.player.form = "alter";
      const h = hand(s, code, "13021", "13022");
      expect(playable(s, h[0])).toBeTruthy();
      expect(dispatch(s, { type: "PLAY", id: h[0].id }).error).toBeTruthy();
      expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    },
  );

  it.each(["tiny", "giant"] as const)(
    "saved Pym Particles payment in %s gives a separate optional response",
    (form) => {
      let s = base();
      s.player.heroForm = form;
      s.player.hp = 5;
      const h = hand(s, "13010", "13007", "13007"),
        drawn = s.player.deck.slice(0, 2);
      s = command(s, { type: "PLAY", id: h[0].id });
      s = command(reload(s), { type: "CANCEL" });
      expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
      expect(s.player.hp).toBe(5);
      s = paid(
        s,
        h[0],
        h.slice(1).map((p) => p.id),
      );
      expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(true);
      expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(false);
      for (let i = 0; i < 2; i++)
        s = respond(reload(s), /Pym Particles/i, "13007");
      s = skipAll(s);
      expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
      expect(s.player.hp).toBe(form === "giant" ? 9 : 5);
      expect(s.player.hand.map((p) => p.id)).toEqual(
        form === "tiny" ? drawn.map((p) => p.id) : [],
      );
      expect(s.player.discard.map((p) => p.id).sort()).toEqual(
        h
          .slice(1)
          .map((p) => p.id)
          .sort(),
      );
    },
  );

  it("alter-ego Pym Particles give resources without granting the hero response", () => {
    let s = base();
    s.player.form = "alter";
    s.player.hp = 5;
    const h = hand(s, "13010", "13007", "13007");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(s.player.hp).toBe(5);
    expect(s.player.hand).toEqual([]);
    expect(s.prompt).toBeNull();
  });

  it("Red Room Training makes only Tiny basic attacks piercing", () => {
    let s = base();
    put(s, "13008");
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = target(command(s, { type: "BASIC", action: "attack" }), s.villain.id);
    s = skipAll(s);
    expect(s.villain.hp).toBe(39);
    expect(s.villain.tough).toBe(false);
    s.villain.tough = true;
    s.villain.toughCards = 1;
    const h = hand(s, "13006", "13021");
    s = target(paid(s, h[0], [h[1].id]), s.villain.id);
    s = skipAll(s);
    expect(s.villain.hp).toBe(39);
    expect(s.villain.tough).toBe(false);
  });

  it("Red Room Training grants Giant retaliate when Wasp survives a real enemy attack", () => {
    let s = base();
    s.player.heroForm = "giant";
    put(s, "13008");
    const enemy = minion(s, "01103");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = choose(s, "take");
    s = skipAll(s);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(s.player.hp).toBe(9);
  });

  it("Bio-Synthetic Wings optionally prevents one damage from a saved non-attack packet and exhausts once", () => {
    let s = base();
    const wings = put(s, "13009");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "Fixture",
    });
    expect(s.player.hp).toBe(11);
    s = respond(reload(s), /Bio-Synthetic Wings/i, "13009");
    s = skipAll(s);
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === wings.id)?.exhausted).toBe(
      true,
    );
    s = native(reload(s), {
      type: "damage",
      target: "hero",
      amount: 2,
      source: "Fixture",
    });
    expect(s.player.hp).toBe(7);
    expect(s.prompt).toBeNull();
  });

  it("Giant Wings give no prevention window, and Tech Theft blanks Tiny prevention", () => {
    let s = base();
    put(s, "13009");
    s.player.heroForm = "giant";
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 2,
      source: "Fixture",
    });
    expect(s.player.hp).toBe(9);
    expect(s.prompt).toBeNull();
    s.player.heroForm = "tiny";
    side(s, "12026", 2);
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 2,
      source: "Fixture",
    });
    expect(s.player.hp).toBe(7);
    expect(s.prompt).toBeNull();
  });

  it("played Wings grant Aerial in each Wasp hero face, lose it in Nadia form and obey Tech Theft blanking", () => {
    let s = base();
    const h = hand(s, "13009", "13021");
    expect(aerial(s)).toBe(false);
    s = paid(s, h[0], [h[1].id]);
    expect(aerial(reload(s))).toBe(true);
    s = skipAll(command(reload(s), { type: "FLIP", target: "giant" }));
    expect(aerial(s)).toBe(true);
    side(s, "12026", 2);
    expect(aerial(s)).toBe(false);
    s.player.form = "alter";
    s.sideSchemes = [];
    expect(aerial(s)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.code).toBe("13009");
  });

  it("Tech Theft preserves Red Room Training's Skill text and Tiny basic piercing", () => {
    let s = base();
    put(s, "13008");
    side(s, "12026", 2);
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = target(
      command(reload(s), { type: "BASIC", action: "attack" }),
      s.villain.id,
    );
    s = skipAll(s);
    expect(s.villain.hp).toBe(39);
    expect(s.villain.tough).toBe(false);
  });

  it("Ant-Man ally receives +1 THW in Tiny and +1 ATK in Giant from its controller's form", () => {
    let s = base(true);
    const ant = put(s, "13002");
    s = target(
      command(s, { type: "ABILITY", id: ant.id, action: "thwart" }),
      "main",
    );
    expect(s.scheme.threat).toBe(5);
    s.player.inPlay.find((p) => p.id === ant.id)!.exhausted = false;
    s.player.heroForm = "giant";
    s = target(
      command(s, { type: "ABILITY", id: ant.id, action: "attack" }),
      s.villain.id,
    );
    expect(s.villain.hp).toBe(37);
    expect(s.player.inPlay.find((p) => p.id === ant.id)?.damage).toBe(2);
    s = native(s, { type: "discardPiece", id: ant.id });
    const index = seatView(s, "p1").player.discard.findIndex(
      (p) => p.id === ant.id,
    );
    const otherAnt = seatView(s, "p1").player.discard.splice(index, 1)[0];
    seatView(s, "p2").player.inPlay.push(otherAnt);
    expect(otherAnt.ownerId).toBe("p1");
    s.turnPlayerId = "p2";
    s = command(s, {
      type: "ABILITY",
      id: otherAnt.id,
      action: "attack",
      playerId: "p2",
    });
    s = target(s, s.villain.id);
    expect(s.villain.hp).toBe(35);
  });

  it("original Swarm Tactics printing changes Wasp's hero face and readies without consuming voluntary change", () => {
    let s = base();
    const h = hand(s, "13020", "13021");
    expect(playable(s, h[0])).toBeTruthy();
    put(s, "13002");
    s.player.exhausted = true;
    s = paid(s, h[0], [h[1].id]);
    s = skipAll(reload(s));
    expect(s.player).toMatchObject({
      form: "hero",
      heroForm: "giant",
      exhausted: false,
      flipped: false,
    });
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("original Quincarrier enforces the current Avenger trait and becomes a native wild payment source", () => {
    let s = base();
    s.player.form = "alter";
    const h = hand(s, "13025", "13021", "13022");
    expect(playable(s, h[0])).toBeTruthy();
    s.player.form = "hero";
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(paymentSources(s).map((p) => p.id)).toContain(h[0].id);
    const next = hand(s, "13005");
    expect(playable(s, next[0])).toBeTruthy();
  });
});

describe("Wasp's saved selections, native split powers and interruption timing", () => {
  it("Nadia recycles only printed mental resource cards, preserves physical identities and is once per round", () => {
    let s = base();
    s.player.form = "alter";
    const mental = [makePiece(s, "13018"), makePiece(s, "13022")],
      energy = makePiece(s, "13021"),
      wild = makePiece(s, "13007");
    s.player.discard = [...mental, energy, wild];
    const deckIds = s.player.deck.map((p) => p.id);
    s = command(s, { type: "ABILITY", id: "hero", action: "girl" });
    expect(s.prompt?.kind).toBe("select");
    expect(s.prompt?.min).toBe(0);
    expect(s.prompt?.max).toBe(2);
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      mental.map((p) => p.id).sort(),
    );
    const rejected = dispatch(reload(s), {
      type: "SELECT",
      ids: [mental[0].id, energy.id],
    });
    expect(rejected.error).toBeTruthy();
    expect(rejected.player.discard.map((p) => p.id)).toEqual(
      [...mental, energy, wild].map((p) => p.id),
    );
    s = command(reload(s), { type: "SELECT", ids: mental.map((p) => p.id) });
    expect(s.player.discard.map((p) => p.id)).toEqual([energy.id, wild.id]);
    expect(s.player.deck.map((p) => p.id).sort()).toEqual(
      [...deckIds, ...mental.map((p) => p.id)].sort(),
    );
    expect(
      dispatch(reload(s), { type: "ABILITY", id: "hero", action: "girl" })
        .error,
    ).toBeTruthy();
    s = native(reload(s), { type: "newRound" });
    s.player.form = "alter";
    s.player.discard.push(makePiece(s, "13018"));
    s = command(s, { type: "ABILITY", id: "hero", action: "girl" });
    expect(s.prompt?.kind).toBe("select");
  });

  it("saved G.I.R.L. choices allow zero, one or two cards without moving an unselected printing", () => {
    for (const count of [0, 1, 2]) {
      let s = base();
      s.player.form = "alter";
      const cards = [makePiece(s, "13018"), makePiece(s, "13022")];
      s.player.discard = cards;
      const ids = physical(s)
        .map((p) => p.id)
        .sort();
      s = command(s, { type: "ABILITY", id: "hero", action: "girl" });
      s = command(reload(s), {
        type: "SELECT",
        ids: cards.slice(0, count).map((p) => p.id),
      });
      expect(s.player.discard.map((p) => p.id)).toEqual(
        cards.slice(count).map((p) => p.id),
      );
      expect(
        physical(s)
          .map((p) => p.id)
          .sort(),
      ).toEqual(ids);
      expect(new Set(physical(s).map((p) => p.id)).size).toBe(ids.length);
    }
  });

  it("preserves all 40 starter instances through form, paid response, canceled payment and Nadia's saved recycle", () => {
    let s = newGame({
      heroId: "wsp",
      aspect: "aggression",
      villainId: "rhino",
      seed: 13001,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    const source = [...s.player.hand, ...s.player.deck],
      ids = source.map((p) => p.id).sort();
    const take = (code: string) => {
      const i = source.findIndex((p) => p.code === code);
      expect(i, `Missing source card ${code}`).toBeGreaterThanOrEqual(0);
      return source.splice(i, 1)[0];
    };
    const helmet = take("13010"),
      pym = take("13007"),
      energy = take("13021"),
      genius = take("13022"),
      ironheart = take("13018");
    s.player.hand = [helmet, pym, energy];
    s.player.deck = source;
    s.player.discard = [genius, ironheart];
    const conserve = (state: GameState) => {
      expect(
        physical(state)
          .map((p) => p.id)
          .sort(),
      ).toEqual(ids);
      expect(new Set(physical(state).map((p) => p.id)).size).toBe(40);
    };
    conserve(reload(s));
    s = command(s, { type: "ABILITY", id: "hero", action: "girl" });
    s = command(reload(s), { type: "SELECT", ids: [ironheart.id, genius.id] });
    conserve(reload(s));
    s = skipAll(command(reload(s), { type: "FLIP", target: "tiny" }));
    s = command(s, { type: "PLAY", id: helmet.id });
    s = command(reload(s), { type: "CANCEL" });
    conserve(reload(s));
    s = paid(s, helmet, [pym.id, energy.id]);
    s = respond(reload(s), /Pym Particles/i, "13007");
    s = skipAll(s);
    conserve(reload(s));
    expect(heroStats(s).attack).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === helmet.id)?.code).toBe("13010");
  });

  it("Giant basic attack splits its two points before applying either target's damage", () => {
    let s = base();
    s.player.heroForm = "giant";
    const enemy = minion(s, "01103");
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.player.exhausted).toBe(true);
    expect(s.villain.hp).toBe(40);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
    s = allocate(s, enemy.id, 1);
    s = skipAll(reload(s));
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(s.villain.hp).toBe(39);
  });

  it("Giant basic thwart divides Helmet's three points across physical schemes", () => {
    let s = base();
    s.player.heroForm = "giant";
    put(s, "13010");
    const scheme = side(s, "01107", 2);
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.scheme.threat).toBe(8);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
    s = allocate(s, scheme.id, 1);
    s = skipAll(reload(s));
    expect(s.scheme.threat).toBe(6);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(1);
  });

  it("one Giant split cannot allocate damage to the villain after choosing to defeat a Guard", () => {
    let s = base();
    s.player.heroForm = "giant";
    const guard = minion(s),
      other = minion(s, "01103");
    guard.damage = 2;
    s = command(s, { type: "BASIC", action: "attack" });
    expect(
      s.prompt?.options.some((o) => o.id.startsWith(`${s.villain.id}:`)),
    ).toBe(false);
    s = allocate(s, guard.id, 1);
    s = skipAll(reload(s));
    expect(s.minions.some((p) => p.id === guard.id)).toBe(false);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(1);
    expect(s.villain.hp).toBe(40);
  });

  it("one Giant thwart split cannot add the main scheme after defeating Crisis", () => {
    let s = base();
    s.player.heroForm = "giant";
    const crisis = side(s, "01108", 1),
      other = side(s, "01107", 3);
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.options.some((o) => o.id.startsWith("main:"))).toBe(false);
    s = allocate(s, crisis.id, 1);
    s = skipAll(reload(s));
    expect(s.sideSchemes.some((p) => p.id === crisis.id)).toBe(false);
    expect(s.sideSchemes.find((p) => p.id === other.id)?.counters).toBe(2);
    expect(s.scheme.threat).toBe(8);
  });

  it("Patrol removes main from Giant Help's initial allocation and does not permit a forged target", () => {
    let s = base();
    s.player.heroForm = "giant";
    minion(s, "16136");
    const first = side(s, "01107", 4),
      second = side(s, "12026", 3),
      h = hand(s, "13003", "13021");
    s = paid(s, h[0], [h[1].id]);
    expect(s.prompt?.options.some((o) => o.id.startsWith("main:"))).toBe(false);
    const denied = dispatch(reload(s), { type: "CHOOSE", id: "main:1" });
    expect(denied.error).toBeTruthy();
    expect(denied.scheme.threat).toBe(8);
    s = allocate(s, first.id, 2);
    s = skipAll(s);
    expect(s.sideSchemes.find((p) => p.id === first.id)?.counters).toBe(2);
    expect(s.sideSchemes.find((p) => p.id === second.id)?.counters).toBe(1);
  });

  it("Giant Wasp Sting applies its four-point split atomically through saved selections", () => {
    let s = base();
    s.player.heroForm = "giant";
    const a = minion(s, "01103"),
      b = minion(s, "01101"),
      c = minion(s, "12027"),
      h = hand(s, "13006", "13021");
    s = paid(s, h[0], [h[1].id]);
    s = allocate(s, a.id, 1);
    expect(s.minions.find((p) => p.id === a.id)?.damage).toBe(0);
    expect(s.minions.find((p) => p.id === b.id)?.damage).toBe(0);
    s = allocate(s, b.id, 2);
    s = skipAll(reload(s));
    expect(s.minions.find((p) => p.id === a.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === b.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === c.id)?.damage).toBe(1);
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Stunned replaces all of Giant Wasp Sting before splitting or touching Tough", () => {
    let s = base();
    s.player.heroForm = "giant";
    s.player.stunned = true;
    s.player.stunCards = 1;
    const enemy = minion(s, "01103"),
      h = hand(s, "13006", "13021");
    enemy.tough = true;
    enemy.toughCards = 1;
    s = paid(s, h[0], [h[1].id]);
    expect(s.player.stunned).toBe(false);
    expect(s.minions.find((p) => p.id === enemy.id)?.tough).toBe(true);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
    expect(s.villain.hp).toBe(40);
    expect(s.prompt).toBeNull();
  });

  it("Rapid Growth interrupts Tiny ATK, spends its own card, becomes Giant and adds two for this use only", () => {
    let s = base();
    s.player.flipped = true;
    const h = hand(s, "13005", "13023");
    expect(playable(s, h[0])).toBeTruthy();
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(reload(s), /Rapid Growth/i, "13005");
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = target(s, s.villain.id);
    s = skipAll(s);
    expect(s.villain.hp).toBe(36);
    expect(s.player).toMatchObject({
      heroForm: "giant",
      flipped: true,
      exhausted: true,
    });
    expect(heroStats(s).attack).toBe(2);
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      h.map((p) => p.id).sort(),
    );
  });

  it("committed Rapid Growth payment rejects cancellation without moving resources or granting its bonus early", () => {
    let s = base();
    const h = hand(s, "13005", "13021");
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(reload(s), /Rapid Growth/i, "13005");
    const canceled = dispatch(reload(s), { type: "CANCEL" });
    expect(canceled.error).toBe("This decision cannot be canceled.");
    expect(canceled.prompt).toEqual(s.prompt);
    expect(canceled.villain.hp).toBe(40);
    expect(canceled.player.heroForm).toBe("tiny");
    expect(canceled.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    expect(canceled.player.discard).toEqual([]);
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.villain.hp).toBe(36);
    expect(s.player.heroForm).toBe("giant");
  });

  it("two physical Rapid Growth interrupts stack while already Giant and expire after this basic thwart", () => {
    let s = base();
    s.player.heroForm = "giant";
    const h = hand(s, "13005", "13005", "13021", "13023");
    s = command(s, { type: "BASIC", action: "thwart" });
    for (let i = 0; i < 2; i++) {
      s = respond(reload(s), /Rapid Growth/i, "13005");
      s = command(reload(s), { type: "PAY", ids: [h[2 + i].id] });
    }
    s = target(s, "main");
    s = skipAll(s);
    expect(s.scheme.threat).toBe(2);
    expect(heroStats(s).thwart).toBe(2);
    expect(
      s.player.discard.filter((p) => h.slice(0, 2).some((x) => x.id === p.id)),
    ).toHaveLength(2);
  });

  it.each(["attack", "thwart"] as const)(
    "status replacement prevents opening Rapid Growth for basic %s",
    (action) => {
      let s = base();
      const h = hand(s, "13005", "13021");
      if (action === "attack") {
        s.player.stunned = true;
        s.player.stunCards = 1;
      } else {
        s.player.confused = true;
        s.player.confuseCards = 1;
      }
      s = command(s, { type: "BASIC", action });
      expect(s.prompt?.options.some((o) => o.image === "13005")).not.toBe(true);
      s = skipAll(s);
      expect(s.player.heroForm).toBe("tiny");
      expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
      expect(s.villain.hp).toBe(40);
      expect(s.scheme.threat).toBe(8);
    },
  );

  it("Rapid Growth interrupts a real basic defense before evaluating Giant's five DEF", () => {
    let s = base();
    const enemy = minion(s, "01103"),
      h = hand(s, "13005", "13021");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = choose(s, "hero");
    s = respond(reload(s), /Rapid Growth/i, "13005");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.player.hp).toBe(11);
    expect(s.player).toMatchObject({
      heroForm: "giant",
      exhausted: true,
      flipped: false,
    });
    expect(heroStats(s).defense).toBe(3);
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      h.map((p) => p.id).sort(),
    );
  });
});

describe("Wasp pack allies, aspect cards and physical encounter continuation", () => {
  it("Thor's optional hand-play response uses actual physical resources paid for her", () => {
    let s = base();
    const h = hand(s, "13011", "13021", "13023");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(s.villain.hp).toBe(40);
    s = respond(reload(s), /Thor|deal 3 damage/i, "13011");
    s = skipAll(s);
    expect(s.villain.hp).toBe(37);
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
  });

  it("Thor's response can be declined and otherwise gives two damage without physical payment", () => {
    let s = base();
    const h = hand(s, "13011", "13021", "13022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    s = skipAll(reload(s));
    expect(s.villain.hp).toBe(40);
    let second = base();
    const next = hand(second, "13011", "13021", "13022");
    second = paid(
      second,
      next[0],
      next.slice(1).map((p) => p.id),
    );
    second = respond(reload(second), /Thor/i, "13011");
    second = skipAll(second);
    expect(second.villain.hp).toBe(38);
  });

  it("Janet's zero-cost ally asks for real overpayment and counts only excess energy resources", () => {
    let s = base();
    const h = hand(s, "13012", "13021", "13022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    const janet = s.player.inPlay.find((p) => p.id === h[0].id)!;
    expect(janet).toBeTruthy();
    expect(janet.counters).toBe(2);
    expect(pieceHP(s, janet)).toBe(2);
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      h
        .slice(1)
        .map((p) => p.id)
        .sort(),
    );
  });

  it("Janet energy overpayment caps at three and records a wild resource declared as energy", () => {
    let s = base();
    const h = hand(s, "13012", "13021", "13015");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
      "energy",
    );
    const janet = s.player.inPlay.find((p) => p.id === h[0].id)!;
    expect(janet.counters).toBe(3);
    expect(pieceHP(s, janet)).toBe(3);
    expect(s.player.discard.filter((p) => p.id === h[2].id)).toHaveLength(1);
  });

  it("canceled Janet overpayment preserves the entire hand and creates no zero-HP ally", () => {
    let s = base();
    const h = hand(s, "13012", "13021");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    expect(s.player.inPlay).toEqual([]);
    expect(s.player.discard).toEqual([]);
  });

  it("Into the Fray removes only actual excess damage and Tiny adds its separate optional defeat response", () => {
    let s = base();
    const enemy = minion(s),
      h = hand(s, "13013", "13021", "13022");
    s = target(
      paid(
        s,
        h[0],
        h.slice(1).map((p) => p.id),
      ),
      enemy.id,
    );
    expect(s.scheme.threat).toBe(5);
    expect(s.villain.hp).toBe(40);
    s = respond(reload(s), /Small but Mighty/i, "13001a");
    s = skipAll(s);
    expect(s.villain.hp).toBe(39);
    expect(s.encounter.discard.filter((p) => p.id === enemy.id)).toHaveLength(
      1,
    );
  });

  it("Into the Fray respects Tough and Stunned and cannot target a villain", () => {
    for (const condition of ["tough", "stunned"]) {
      let s = base();
      const enemy = minion(s),
        h = hand(s, "13013", "13021", "13022");
      if (condition === "tough") {
        enemy.tough = true;
        enemy.toughCards = 1;
      } else {
        s.player.stunned = true;
        s.player.stunCards = 1;
      }
      s = paid(
        s,
        h[0],
        h.slice(1).map((p) => p.id),
      );
      expect(s.prompt?.options.some((o) => o.id === s.villain.id)).not.toBe(
        true,
      );
      s = target(s, enemy.id);
      s = skipAll(s);
      expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
      expect(s.scheme.threat).toBe(8);
      expect(s.villain.hp).toBe(40);
    }
  });

  it("Surprise Attack is offered only after changing form, uses physical payment and resumes saved choice", () => {
    let s = base();
    const h = hand(s, "13014", "13023");
    expect(playable(s, h[0])).toBeTruthy();
    s = command(s, { type: "FLIP", target: "giant" });
    s = respond(reload(s), /Surprise Attack/i, "13014");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = target(s, s.villain.id);
    s = skipAll(s);
    expect(s.villain.hp).toBe(36);
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      h.map((p) => p.id).sort(),
    );
  });

  it("Boot Camp can be controlled by another player, buffs only their allies and discards to its owner", () => {
    let s = base(true);
    const h = hand(s, "13016", "13021", "13022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    s = choose(reload(s), "p2");
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === h[0].id)?.ownerId,
    ).toBe("p1");
    const mine = put(s, "13018"),
      theirs = put(s, "01084", "p2");
    s = target(
      command(s, { type: "ABILITY", id: mine.id, action: "attack" }),
      s.villain.id,
    );
    expect(s.villain.hp).toBe(39);
    s.turnPlayerId = "p2";
    s = command(s, {
      type: "ABILITY",
      id: theirs.id,
      action: "attack",
      playerId: "p2",
    });
    s = target(s, s.villain.id);
    expect(s.villain.hp).toBe(36);
    s = native(s, { type: "discardPiece", id: h[0].id });
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === h[0].id),
    ).toHaveLength(1);
    expect(seatView(s, "p2").player.discard.some((p) => p.id === h[0].id)).toBe(
      false,
    );
  });

  it("Boot Camp's one-per-player limit blocks another copy once every player controls one", () => {
    const s = base(true);
    put(s, "13016", "p1");
    put(s, "13016", "p2");
    const h = hand(s, "13016", "13021", "13022");
    expect(playable(s, h[0])).toBeTruthy();
    expect(
      dispatch(reload(s), { type: "PLAY", id: h[0].id }).error,
    ).toBeTruthy();
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
  });

  it("Lie in Wait gives an optional paid discard response to a minion entering its controller's engagement", () => {
    let s = base();
    const lie = put(s, "13017");
    s = reveal(s, "01101");
    expect(s.player.inPlay.some((p) => p.id === lie.id)).toBe(true);
    s = respond(reload(s), /Lie in Wait/i, "13017");
    s = skipAll(s);
    expect(s.player.inPlay.some((p) => p.id === lie.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === lie.id)).toHaveLength(1);
    expect(s.minions).toEqual([]);
  });

  it("Ironheart's optional hand-play draw moves the actual top physical card", () => {
    let s = base();
    const h = hand(s, "13018", "13021"),
      top = s.player.deck[0];
    s = paid(s, h[0], [h[1].id]);
    expect(s.player.hand).toEqual([]);
    s = respond(reload(s), /Ironheart|draw 1/i, "13018");
    s = skipAll(s);
    expect(s.player.hand.map((p) => p.id)).toEqual([top.id]);
    expect(s.player.deck.some((p) => p.id === top.id)).toBe(false);
  });

  it("Miles chooses his phase bonus, which affects actual ally actions and expires at the phase boundary", () => {
    let s = base();
    const h = hand(s, "13019", "13021", "13022");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    s = respond(reload(s), /Spider-Man/i, "13019");
    s = choose(reload(s), "attack");
    s = skipAll(s);
    s = target(
      command(s, { type: "ABILITY", id: h[0].id, action: "attack" }),
      s.villain.id,
    );
    expect(s.villain.hp).toBe(36);
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.bonusAtk).toBe(2);
    s = command(reload(s), { type: "END_TURN", discard: [] });
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.bonusAtk || 0).toBe(
      0,
    );
  });

  it("The Power in All of Us doubles for Basic payment and retains its original physical printing", () => {
    let s = base();
    const h = hand(s, "13018", "13024");
    expect(playable(s, h[0])).toBeNull();
    s = paid(s, h[0], [h[1].id]);
    s = skipAll(s);
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
    expect(s.player.discard.find((p) => p.id === h[1].id)?.code).toBe("13024");
    const next = hand(s, "13010", "13024");
    expect(playable(s, next[0])).toBeTruthy();
  });

  it("Running Interference uses villain stage plus two threat and requires an Avenger hero", () => {
    let s = base();
    s.villain.stage = 2;
    const h = hand(s, "13031", "13021");
    s = target(paid(s, h[0], [h[1].id]), "main");
    s = skipAll(s);
    expect(s.scheme.threat).toBe(4);
    s.player.form = "alter";
    const next = hand(s, "13031", "13021");
    expect(playable(s, next[0])).toBeTruthy();
  });

  it("All for One exhausts only selected ready controlled Avengers before adding damage", () => {
    let s = base(true);
    const ant = put(s, "13002"),
      ironheart = put(s, "13018"),
      other = put(s, "01041", "p2");
    const h = hand(s, "13032", "13021");
    s = target(paid(s, h[0], [h[1].id]), s.villain.id);
    expect(s.prompt?.options.some((o) => o.id === ironheart.id)).toBe(false);
    expect(s.prompt?.options.some((o) => o.id === other.id)).toBe(false);
    s = choose(reload(s), ant.id);
    expect(s.prompt?.options.some((o) => o.id === ant.id)).toBe(false);
    s = choose(reload(s), "hero");
    if (s.prompt?.options.some((o) => o.id === "finish"))
      s = choose(reload(s), "finish");
    s = skipAll(s);
    expect(s.villain.hp).toBe(35);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ant.id)?.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ironheart.id)?.exhausted).toBe(
      false,
    );
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === other.id)?.exhausted,
    ).toBe(false);
  });

  it("Perseverance gives the acting identity Tough only in the shared after-form window", () => {
    let s = base();
    const h = hand(s, "13033", "13021");
    expect(playable(s, h[0])).toBeTruthy();
    s = command(s, { type: "FLIP", target: "giant" });
    s = respond(reload(s), /Perseverance/i, "13033");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.player.tough).toBe(true);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Athletic Conditioning removes one chosen status card without treating itself as an attack or thwart", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 2;
    s.player.confused = true;
    s.player.confuseCards = 1;
    const h = hand(s, "13034", "13021");
    s = paid(s, h[0], [h[1].id]);
    s = choose(reload(s), "stunned");
    expect(s.player.stunCards).toBe(1);
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
    expect(s.player.confuseCards).toBe(1);
    const next = hand(s, "13034", "13021");
    s = paid(s, next[0], [next[1].id]);
    s = choose(reload(s), "confused");
    expect(s.player.confused).toBe(false);
    expect(s.player.stunned).toBe(true);
  });

  it("Red Dreams saved flip and exhaust removes its exact obligation without using the voluntary form change", () => {
    let s = base();
    const obligation = makePiece(s, "13026");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(reload(s), "flip");
    s = choose(reload(s), "remove");
    expect(s.player).toMatchObject({
      form: "alter",
      exhausted: true,
      flipped: false,
    });
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(false);
  });

  it("Red Dreams alternative discards all printed mental hand cards, keeps wild and deals one damage", () => {
    let s = base();
    const h = hand(s, "13018", "13022", "13007", "13021");
    s = reveal(s, "13026");
    s = choose(reload(s), "stay");
    s = choose(reload(s), "discard");
    s = skipAll(s);
    expect(s.player.hp).toBe(10);
    expect(s.player.hand.map((p) => p.id)).toEqual(h.slice(2).map((p) => p.id));
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      h
        .slice(0, 2)
        .map((p) => p.id)
        .sort(),
    );
    expect(s.encounter.discard.filter((p) => p.code === "13026")).toHaveLength(
      1,
    );
  });

  it("Mother's Orders requires a real extra basic-attack resource and canceled payment does not exhaust Wasp", () => {
    let s = base();
    side(s, "13027", 2);
    const h = hand(s, "13021");
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(1);
    expect(s.player.exhausted).toBe(false);
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual([h[0].id]);
    s = command(s, { type: "BASIC", action: "attack" });
    s = command(reload(s), { type: "PAY", ids: [h[0].id] });
    s = target(s, s.villain.id);
    s = skipAll(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.villain.hp).toBe(39);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Beetle Armor attaches to the actual Beetle first and adds four max HP, otherwise to the villain", () => {
    let s = base();
    const beetle = minion(s, "13028");
    s = reveal(s, "13029");
    expect(s.attachments[0]).toMatchObject({
      code: "13029",
      attachedTo: beetle.id,
    });
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === beetle.id)!,
      ),
    ).toBe(8);
    let other = base();
    other = reveal(other, "13029");
    expect(other.attachments[0]).toMatchObject({
      code: "13029",
      attachedTo: other.villain.id,
    });
    expect(other.villain.maxHp).toBe(44);
    expect(other.villain.hp).toBe(44);
  });

  it("Beetle Mania attacks through the real defense prompt with +1 ATK and keeps its physical card", () => {
    let s = base();
    const beetle = minion(s, "13028");
    s = reveal(s, "13030");
    expect(s.attack?.attacker).toBe(beetle.id);
    expect(s.attack?.base).toBe(2);
    s = choose(reload(s), "take");
    s = skipAll(s);
    expect(s.player.hp).toBe(9);
    expect(s.encounter.discard.filter((p) => p.code === "13030")).toHaveLength(
      1,
    );
  });
});
