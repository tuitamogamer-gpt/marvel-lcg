import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  playable,
  paymentSources,
  abilityOptions,
} from "../src/game/engine";
import { card, heroStats, maxHP, handSize } from "../src/game/cards";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog";
import { deckErrors } from "../src/game/decks";
import { activateSeat, seatView } from "../src/game/team";
import type { Command, Effect, GameState, Piece } from "../src/game/types";

function command(input: GameState, cmd: Command): GameState {
  let s = dispatch(input, cmd);
  expect(s.error).toBeUndefined();
  for (let i = 0; s.review && i < 80; i++) {
    s = dispatch(s, { type: "PROCEED" });
    expect(s.error).toBeUndefined();
  }
  return s;
}
function base(team = false) {
  let s = newGame({
    heroId: "doctor_strange",
    villainId: "rhino",
    aspect: "protection",
    seed: 909,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "doctor_strange", aspect: "protection" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (let i = 0; i < s.players.length; i++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.hand = [];
    view.player.inPlay = [];
    view.player.discard = [];
    view.player.exhausted = false;
    view.player.deck = Array.from({ length: 12 }, () =>
      owned(s, "09022", seat.id),
    );
  }
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  return s;
}
function owned(s: GameState, code: string, ownerId = s.activePlayerId) {
  return { ...makePiece(s, code), ownerId };
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => owned(s, code));
  return [...s.player.hand];
}
function area(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = owned(s, code, seatId);
  seatView(s, seatId).player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code: string) {
  const p = makePiece(s, code);
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
function top(s: GameState, code: string) {
  const deck = s.player.invocationDeck!;
  const index = deck.findIndex((p) => p.code === code);
  expect(index).toBeGreaterThanOrEqual(0);
  const [p] = deck.splice(index, 1);
  deck.unshift(p);
  return p;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind).toBe("choice");
  const actual = s.prompt!.options.find(
    (o) => o.id === id || o.id.endsWith(":" + id),
  );
  expect(actual, `Missing option ${id} in ${s.prompt?.title}`).toBeDefined();
  return command(s, { type: "CHOOSE", id: actual!.id });
}
function pay(s: GameState, ids: string[]) {
  expect(s.prompt?.kind).toBe("payment");
  return command(s, { type: "PAY", ids });
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Native fixture",
    text: "Resolve effects.",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function physical(s: GameState, id: string): Piece[] {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.invocationDeck || []),
        ...(p.invocationDiscard || []),
      ];
    }),
    ...s.attachments,
    ...s.resolving,
    ...s.encounter.discard,
    ...s.minions,
    ...s.sideSchemes.flatMap((p) => [p, ...(p.storedCards || [])]),
    ...s.removed,
  ].filter((p) => p.id === id);
}

describe("Doctor Strange retail pack through native dispatch", () => {
  it("starts the exact40-card source precon and a distinct five-card Invocation deck", () => {
    const source = STARTER_DECKS.find(
      (d) =>
        d.heroCode === "09001a" && d.sourceType === "source-preconstructed",
    )!;
    const codes = catalogDeckCodes(source);
    expect(codes).toHaveLength(40);
    expect(deckErrors("doctor_strange", "protection", codes)).toEqual([]);
    const s = newGame({
      heroId: "doctor_strange",
      villainId: "rhino",
      aspect: "protection",
      heroes: [
        { heroId: "doctor_strange", aspect: "protection", deckCards: codes },
      ],
      seed: 909,
    });
    expect(
      [...s.player.hand, ...s.player.deck].map((p) => p.code).sort(),
    ).toEqual(codes.sort());
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.hp).toBe(10);
    expect(s.player.invocationDeck).toHaveLength(5);
    expect(s.player.invocationDiscard).toEqual([]);
    expect(
      new Set(
        [...s.player.hand, ...s.player.deck, ...s.player.invocationDeck!].map(
          (p) => p.id,
        ),
      ).size,
    ).toBe(45);
  });
  it("Spell Mastery resolves Crimson Bands through Guard and Stunned without being an attack or triggering Retaliate", () => {
    let s = base();
    const bands = top(s, "09032");
    const guard = minion(s, "01101"),
      modok = minion(s, "01184");
    s.player.stunned = true;
    s.player.stunCards = 1;
    const [resource] = hand(s, "09023");
    const hp = s.player.hp;
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    expect(s.prompt?.cost).toBe(2);
    s = pay(s, [resource.id]);
    s = choose(s, modok.id);
    expect(s.minions.find((p) => p.id === modok.id)?.damage).toBe(7);
    expect(s.minions.find((p) => p.id === modok.id)?.stunned).toBe(true);
    expect(s.minions.some((p) => p.id === guard.id)).toBe(true);
    expect(s.player.hp).toBe(hp);
    expect(s.player.stunned).toBe(true);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.invocationDiscard?.some((p) => p.id === bands.id)).toBe(
      true,
    );
  });
  it("Natural Talent and Wong cycle the same physical Invocation pieces in either appropriate form", () => {
    let s = base();
    s.player.form = "alter";
    const first = top(s, "09036"),
      wong = area(s, "09002");
    s = command(s, { type: "ABILITY", id: "identity", action: "natural" });
    expect(s.player.invocationDiscard?.some((p) => p.id === first.id)).toBe(
      true,
    );
    expect(
      dispatch(s, { type: "ABILITY", id: "identity", action: "natural" }).error,
    ).toBeDefined();
    const second = s.player.invocationDeck![0];
    s = command(s, { type: "ABILITY", id: wong.id, action: "wong" });
    s = choose(s, "discard");
    expect(s.player.invocationDiscard?.some((p) => p.id === second.id)).toBe(
      true,
    );
    expect(physical(s, first.id)).toHaveLength(1);
    expect(physical(s, second.id)).toHaveLength(1);
  });
  it("Cloak readies Strange after casting and grants Aerial to both identity forms", () => {
    let s = base();
    const cloak = area(s, "09009");
    top(s, "09036");
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    expect(s.player.exhausted).toBe(true);
    s = command(s, { type: "ABILITY", id: cloak.id, action: "cloak" });
    expect(s.player.exhausted).toBe(false);
    expect(physical(s, cloak.id)[0].exhausted).toBe(true);
  });
  it("Master pays normal and invocation costs together using a double plus single resource, then restores the bound Invocation", () => {
    let s = base();
    const bands = top(s, "09032"),
      before = s.villain.hp;
    const [event, double, single] = hand(s, "09005", "09023", "09006");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.cost).toBe(3);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = pay(s, [double.id, single.id]);
    expect(s.villain.hp).toBe(before - 7);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.invocationDeck?.[0].id).toBe(bands.id);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(physical(s, bands.id)).toHaveLength(1);
  });
  it("Master on the final Invocation shuffles only its special discard, returns the same ID, and deals no encounter", () => {
    let s = base();
    const winds = top(s, "09036");
    s.player.invocationDiscard = s.player.invocationDeck!.splice(1);
    const before = s.encounter.dealt.length;
    const [event, resource] = hand(s, "09005", "09006");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    expect(s.player.hand).toHaveLength(3);
    expect(s.player.invocationDeck).toHaveLength(5);
    expect(s.player.invocationDeck?.[0].id).toBe(winds.id);
    expect(s.player.invocationDiscard).toEqual([]);
    expect(s.encounter.dealt).toHaveLength(before);
    expect(physical(s, winds.id)).toHaveLength(1);
  });
  it("a surplus play discount cannot pay an Invocation's printed cost inside Master of the Mystic Arts", () => {
    let s = base();
    const bands = top(s, "09032");
    s.flags.discount = 3;
    const [event, double] = hand(s, "09005", "09023");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.cost).toBe(2);
    s = pay(JSON.parse(JSON.stringify(s)) as GameState, [double.id]);
    expect(s.player.invocationDeck?.[0].id).toBe(bands.id);
    expect(s.flags.discount).toBe(0);
    expect(physical(s, bands.id)).toHaveLength(1);
  });
  it("Spell Mastery pays the printed cost without consuming an available play discount or Physical Toll", () => {
    let s = base();
    const bands = top(s, "09032"),
      toll = makePiece(s, "09027");
    toll.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(toll);
    s.flags.discount = 2;
    const [double] = hand(s, "09023");
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    expect(s.prompt?.cost).toBe(2);
    s = pay(JSON.parse(JSON.stringify(s)) as GameState, [double.id]);
    expect(s.flags.discount).toBe(2);
    expect(s.attachments.some((p) => p.id === toll.id)).toBe(true);
    expect(s.player.invocationDiscard?.some((p) => p.id === bands.id)).toBe(
      true,
    );
  });
  it("a restored Master payment refuses a different physical top Invocation and preserves the unpaid hand", () => {
    let s = base();
    top(s, "09032");
    const [event, double, single] = hand(s, "09005", "09023", "09006");
    s = command(s, { type: "PLAY", id: event.id });
    s = JSON.parse(JSON.stringify(s)) as GameState;
    top(s, "09036");
    const before = s.player.hand.map((p) => p.id);
    const refused = dispatch(s, { type: "PAY", ids: [double.id, single.id] });
    expect(refused.error).toContain("no longer on top");
    expect(refused.player.hand.map((p) => p.id)).toEqual(before);
    expect(refused.prompt?.kind).toBe("payment");
  });
  it("Vapors resolves without statuses and without a meaningless target prompt", () => {
    let s = base();
    const vapors = top(s, "09035");
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    expect(s.prompt).toBeNull();
    expect(s.player.exhausted).toBe(true);
    expect(s.player.invocationDiscard?.some((p) => p.id === vapors.id)).toBe(
      true,
    );
  });
  it("Vapors keeps JSON status choices and replaces exactly one Stun with Tough", () => {
    let s = base();
    top(s, "09035");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = choose(s, `hero:${s.activePlayerId}`);
    s = choose(s, "tough");
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards || 0).toBe(0);
    expect(s.player.tough).toBe(true);
  });
  it("Magic Blast Wild resolves5+2 as one attack: one Retaliate and one optional Jarnbjorn occurrence", () => {
    let s = base();
    s.aspect = "aggression";
    const modok = minion(s, "01184");
    area(s, "06019");
    s.player.deck.unshift(owned(s, "09002"));
    const [event, r1, r2] = hand(s, "09004", "09023", "09022", "09006");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [r1.id, r2.id]);
    s = choose(s, modok.id);
    expect(s.minions.find((p) => p.id === modok.id)).toMatchObject({
      damage: 7,
      stunned: true,
      confused: true,
    });
    expect(s.player.hp).toBe(8);
    expect(s.prompt?.title).toBe("After your hero attacks");
    s = choose(s, "continue");
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(8);
  });
  it("Astral Projection removes3 plus numeric icons and displays the actual looked face", () => {
    let s = base();
    s.scheme.threat = 9;
    const boost = makePiece(s, "09027");
    s.encounter.deck.unshift(boost);
    const [event, resource] = hand(s, "09003", "09023");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    expect(s.prompt?.title).toBe("Astral Projection · encounter card");
    expect(s.prompt?.options[0].image).toBe(boost.code);
    s = choose(s, "continue");
    expect(s.scheme.threat).toBe(4);
    expect(s.encounter.deck[0].id).toBe(boost.id);
  });
  it("Mystical Studies returns the actual discarded signature, then shuffles the normal deck", () => {
    let s = base();
    s.player.form = "alter";
    const cloak = owned(s, "09009");
    s.player.discard.push(cloak);
    const [event, resource] = hand(s, "09006", "09016");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    expect(s.prompt?.kind).toBe("select");
    s = command(s, { type: "SELECT", ids: [cloak.id] });
    expect(s.player.hand.some((p) => p.id === cloak.id)).toBe(true);
    expect(physical(s, cloak.id)).toHaveLength(1);
  });
  it("Sanctum shuffles an actual Spell into the ordinary deck and draws one", () => {
    let s = base();
    s.player.form = "alter";
    const sanctum = area(s, "09008"),
      spell = owned(s, "09004");
    s.player.discard.push(spell);
    s = command(s, { type: "ABILITY", id: sanctum.id, action: "sanctum" });
    s = command(s, { type: "SELECT", ids: [spell.id] });
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === spell.id)).toBe(false);
    expect(physical(s, spell.id)).toHaveLength(1);
  });
  it("Brother Voodoo searches the top5 actual player cards after entry", () => {
    let s = base();
    const wanted = owned(s, "09004"),
      sixth = owned(s, "09003");
    s.player.deck = [
      wanted,
      ...Array.from({ length: 4 }, () => owned(s, "09022")),
      sixth,
    ];
    const [ally, r1, r2] = hand(s, "09012", "09023", "09024");
    s = command(s, { type: "PLAY", id: ally.id });
    s = pay(s, [r1.id, r2.id]);
    s = choose(s, "yes");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([wanted.id]);
    s = command(s, { type: "SELECT", ids: [wanted.id] });
    expect(s.player.hand[0].id).toBe(wanted.id);
  });
  it("Iron Fist's interrupt kill aborts the basic attack and its consequential damage", () => {
    let s = base();
    const iron = area(s, "09014");
    iron.counters = 2;
    const target = minion(s, "01101");
    target.damage = Number(card(target).health) - 1;
    s = command(s, { type: "ABILITY", id: iron.id, action: "attack" });
    if (s.prompt?.title !== "Iron Fist") s = choose(s, target.id);
    expect(s.prompt?.title).toBe("Iron Fist");
    s = choose(s, "yes");
    expect(s.minions.some((p) => p.id === target.id)).toBe(false);
    expect(physical(s, iron.id)[0]).toMatchObject({
      counters: 1,
      exhausted: true,
      damage: 0,
    });
    expect(s.prompt).toBeNull();
  });
  it("Clea shuffles the exact defeated ally into her owner's deck, retaining owner despite another controller", () => {
    let s = base(true);
    const clea = area(s, "09013");
    clea.ownerId = "p2";
    s = native(s, {
      type: "damage",
      target: clea.id,
      amount: 2,
      source: "Fixture",
    });
    s = choose(s, clea.id);
    expect(s.player.inPlay.some((p) => p.id === clea.id)).toBe(false);
    expect(seatView(s, "p2").player.deck.some((p) => p.id === clea.id)).toBe(
      true,
    );
    expect(physical(s, clea.id)).toHaveLength(1);
  });
  it("Momentum Shift requires its full heal2 cost and heals before dealing2", () => {
    let s = base();
    const [event, resource] = hand(s, "09016", "09023");
    s.player.hp = 9;
    expect(playable(s, event)).toMatch(/healing 2/);
    s.player.hp = 8;
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    expect(s.player.hp).toBe(maxHP(s));
    expect(s.villain.hp).toBe(before - 2);
  });
  it("Desperate Defense prevents a boosted attack, readies the hero, then offers Unflappable", () => {
    let s = base();
    area(s, "09020");
    const [defense, resource] = hand(s, "09015", "09006");
    const hp = s.player.hp;
    s.encounter.deck = [makePiece(s, "09031"), makePiece(s, "09031")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    s = choose(s, defense.id);
    s = pay(s, [resource.id]);
    if (s.prompt?.title === "Damage window") s = choose(s, "resolve");
    expect(s.player.hp).toBe(hp);
    expect(s.player.exhausted).toBe(false);
    expect(s.prompt?.title).toBe("Unflappable");
    s = choose(s, "yes");
    expect(s.player.hand).toHaveLength(1);
  });
  it("Warning from another alter-ego player reduces a hero's non-attack packet without moving defense ownership", () => {
    let s = base(true);
    s.player.form = "alter";
    const [warning] = hand(s, "09021");
    const hp = seatView(s, "p2").player.hp;
    s = native(s, {
      type: "damage",
      target: "hero:p2",
      amount: 1,
      source: "Fixture",
    });
    s = choose(s, warning.id);
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(physical(s, warning.id)[0].ownerId).toBe("p1");
    expect(s.attack).toBeNull();
  });
  it("Counterspell cancels Warning's prevention but the original damage packet still resolves once", () => {
    let s = base();
    const [warning] = hand(s, "09021"),
      counter = makePiece(s, "09030"),
      hp = s.player.hp;
    counter.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(counter);
    s = native(s, { type: "damage", target: "hero", amount: 3 });
    expect(s.prompt?.title).toBe("Incoming damage");
    s = choose(JSON.parse(JSON.stringify(s)) as GameState, warning.id);
    expect(s.player.hp).toBe(hp - 3);
    expect(s.player.discard.some((p) => p.id === warning.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === counter.id)).toBe(true);
    expect(physical(s, warning.id)).toHaveLength(1);
    expect(s.prompt).toBeNull();
  });
  it("Foiled cancels numeric scheme icons while preserving a boost star", () => {
    let s = base();
    s.player.form = "alter";
    const [foiled] = hand(s, "09038");
    s.encounter.deck = [makePiece(s, "01158"), makePiece(s, "09031")];
    const before = s.scheme.threat;
    s = native(s, { type: "enemyScheme", id: s.villain.id });
    s = choose(s, foiled.id);
    expect(s.scheme.threat).toBe(before + 1);
    expect(s.villain.tough).toBe(true);
    expect(s.prompt).toBeNull();
  });
  it("Physical Toll remains for Invocation resolution, then taxes and discards after an actual played event", () => {
    let s = base();
    const toll = makePiece(s, "09027");
    s = native(s, { type: "reveal", piece: toll, skip: true });
    s = choose(s, "stay");
    s = choose(s, "event");
    top(s, "09036");
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    expect(s.attachments.some((p) => p.id === toll.id)).toBe(true);
    const [event, r1, r2, r3] = hand(s, "09004", "09022", "09023", "09024");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.cost).toBe(6);
    s = pay(s, [r1.id, r2.id, r3.id]);
    expect(s.attachments.some((p) => p.id === toll.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === toll.id)).toBe(true);
  });
  it("Stunned replacement precedes Counterspell, which then cancels the next uncanceled event", () => {
    let s = base();
    const counter = makePiece(s, "09030");
    counter.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(counter);
    s.player.stunned = true;
    s.player.stunCards = 1;
    const [attack, r1, r2] = hand(s, "09004", "09022", "09023");
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: attack.id });
    s = pay(s, [r1.id, r2.id]);
    expect(s.player.stunned).toBe(false);
    expect(s.attachments.some((p) => p.id === counter.id)).toBe(true);
    expect(s.villain.hp).toBe(before);
    const bands = top(s, "09032"),
      [master, double, single] = hand(s, "09005", "09023", "09006");
    s = command(s, { type: "PLAY", id: master.id });
    s = pay(s, [double.id, single.id]);
    expect(s.player.invocationDeck?.[0].id).toBe(bands.id);
    expect(s.villain.hp).toBe(before);
    expect(s.attachments.some((p) => p.id === counter.id)).toBe(false);
  });
  it("Protective Ward cancels a surge treachery completely and keeps its actual piece in encounter discard", () => {
    let s = base();
    const [ward, resource] = hand(s, "09007", "09006");
    const surge = makePiece(s, "01191"),
      next = makePiece(s, "01103");
    s.encounter.deck = [next];
    s = native(s, { type: "reveal", piece: surge });
    s = choose(s, ward.id);
    s = pay(s, [resource.id]);
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.encounter.discard.some((p) => p.id === surge.id)).toBe(true);
    expect(s.resolving.some((p) => p.id === surge.id)).toBe(false);
    expect(s.player.exhausted).toBe(false);
  });
  it("Open the Dark Dimension holds a physical Invocation and returns it to its own deck on defeat", () => {
    let s = base();
    const invocation = top(s, "09036"),
      dimension = makePiece(s, "09029");
    s = native(s, { type: "reveal", piece: dimension, skip: true });
    expect(
      s.sideSchemes.find((p) => p.id === dimension.id)?.storedCards?.[0].id,
    ).toBe(invocation.id);
    expect(physical(s, invocation.id)).toHaveLength(1);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = native(s, {
      type: "thwart",
      target: dimension.id,
      amount: 3,
      source: "hero",
    });
    expect(s.sideSchemes.some((p) => p.id === dimension.id)).toBe(false);
    expect(s.player.invocationDeck?.some((p) => p.id === invocation.id)).toBe(
      true,
    );
    expect(s.player.discard.some((p) => p.id === invocation.id)).toBe(false);
    expect(physical(s, invocation.id)).toHaveLength(1);
  });
  it.each([false, true])(
    "Images of Ikonn defeats Open the Dark Dimension and discards the actual resolving Invocation after its deck shuffles (Master=%s)",
    (master) => {
      let s = base();
      const captured = top(s, "09036");
      s.player.invocationDeck!.shift();
      const images = top(s, "09033"),
        dimension = makePiece(s, "09029");
      dimension.counters = 4;
      dimension.storedCards = [captured];
      s.sideSchemes.push(dimension);
      s.scheme.threat = 1;
      const [event, resource] = master
        ? hand(s, "09005", "09023")
        : hand(s, "09006", "09006");
      s = master
        ? command(s, { type: "PLAY", id: event.id })
        : command(s, { type: "ABILITY", id: "identity", action: "spell" });
      s = pay(s, [resource.id]);
      expect(s.prompt?.title).toBe("Images of Ikonn");
      s = choose(JSON.parse(JSON.stringify(s)) as GameState, dimension.id);
      expect(s.sideSchemes.some((p) => p.id === dimension.id)).toBe(false);
      expect(s.player.invocationDeck?.some((p) => p.id === captured.id)).toBe(
        true,
      );
      expect(s.player.invocationDeck?.[0].id === images.id).toBe(master);
      expect(s.player.invocationDiscard?.some((p) => p.id === images.id)).toBe(
        !master,
      );
      expect(s.player.discard.some((p) => p.id === images.id)).toBe(false);
      expect(physical(s, images.id)).toHaveLength(1);
      expect(physical(s, captured.id)).toHaveLength(1);
    },
  );
  it("Baron Mordo discards a Wild and applies all printed effects before defense is chosen", () => {
    let s = base();
    const mordo = minion(s, "09028"),
      wild = owned(s, "09002");
    s.player.deck.unshift(wild);
    s = native(s, { type: "enemyAttack", id: mordo.id });
    expect(s.player.hp).toBe(8);
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
    expect(s.player.discard.some((p) => p.id === wild.id)).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(true);
  });
  it("Night Nurse removes Tough from a full-health hero and spends one actual medical counter", () => {
    let s = base();
    const nurse = area(s, "09019");
    nurse.counters = 3;
    s.player.hp = maxHP(s);
    s.player.tough = true;
    s.player.toughCards = 1;
    s = command(s, { type: "ABILITY", id: nurse.id, action: "nurse" });
    s = choose(s, s.activePlayerId);
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(maxHP(s));
    expect(physical(s, nurse.id)[0]).toMatchObject({
      counters: 2,
      exhausted: true,
    });
  });
  it("Magical Enhancements and Sorcerer Supreme affect actual stats once, with hero-only hand size", () => {
    let s = base();
    const enhancement = area(s, "09010");
    area(s, "09026");
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 3, defense: 3 });
    expect(handSize(s)).toBe(6);
    s = command(s, { type: "FLIP" });
    expect(handSize(s)).toBe(6);
    expect(heroStats(s).recover).toBe(3);
    expect(physical(s, enhancement.id)).toHaveLength(1);
  });
  it("The Eye appears only once in native payment and pays a real Invocation resource", () => {
    let s = base();
    const eye = area(s, "09011");
    top(s, "09033");
    expect(paymentSources(s).filter((p) => p.id === eye.id)).toHaveLength(1);
    s.scheme.threat = 4;
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    s = pay(s, [eye.id]);
    expect(physical(s, eye.id)[0].exhausted).toBe(true);
    expect(s.scheme.threat).toBe(0);
    expect(s.villain.confused).toBe(true);
  });
  it("Skilled Strike copies each modify only the current basic attack and use actual discarded events", () => {
    let s = base();
    const [first, second] = hand(s, "09037", "09037");
    const hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, first.id);
    s = choose(JSON.parse(JSON.stringify(s)) as GameState, second.id);
    expect(s.villain.hp).toBe(hp - 5);
    expect(s.player.discard.map((p) => p.id)).toEqual([first.id, second.id]);
    s.player.exhausted = false;
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.villain.hp).toBe(hp - 6);
    expect(heroStats(s).attack).toBe(1);
  });
  it("Counterspell cancels Skilled Strike without increasing the resumed basic attack", () => {
    let s = base();
    const counter = makePiece(s, "09030");
    counter.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(counter);
    const [strike] = hand(s, "09037");
    const hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, strike.id);
    expect(s.villain.hp).toBe(hp - 1);
    expect(s.attachments.some((p) => p.id === counter.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === strike.id)).toBe(true);
  });
  it.each([true, false])(
    "Iron Man's upgrade discount uses the selected physical target before payment (Iron Man=%s)",
    (ironTarget) => {
      let s = base();
      const iron = area(s, "09039"),
        wong = area(s, "09002");
      const [upgrade, resource] = hand(s, "01074", "09006");
      s = command(s, { type: "PLAY", id: upgrade.id });
      expect(s.prompt?.kind).toBe("choice");
      expect(s.prompt?.text).toContain("before paying");
      s = choose(
        JSON.parse(JSON.stringify(s)) as GameState,
        ironTarget ? iron.id : wong.id,
      );
      if (!ironTarget) {
        expect(s.prompt?.cost).toBe(1);
        s = pay(s, [resource.id]);
      }
      expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.attachedTo).toBe(
        ironTarget ? iron.id : wong.id,
      );
      expect(s.player.hand.some((p) => p.id === resource.id)).toBe(ironTarget);
      expect(physical(s, upgrade.id)).toHaveLength(1);
    },
  );
  it.each(["hero", "alter"] as const)(
    "Physical Toll hides an invalid optional flip while All Tied Up locks %s form",
    (form) => {
      let s = base();
      s.player.form = form;
      const lock = makePiece(s, "02048");
      lock.attachedTo = `hero:${s.activePlayerId}`;
      s.attachments.push(lock);
      const toll = makePiece(s, "09027");
      s = native(s, { type: "reveal", piece: toll, skip: true });
      expect(s.prompt?.title).toBe("Physical Toll");
      expect(s.prompt!.options.map((o) => o.id)).toEqual(
        form === "alter" ? ["exhaust", "event"] : ["event"],
      );
      expect(s.player.form).toBe(form);
    },
  );
  it.each(["hero", "alter"] as const)(
    "Thoughtcasting discards one actual highest-cost card and applies printed cost in %s form",
    (form) => {
      let s = base();
      s.player.form = form;
      const [lower, first, second] = hand(s, "09003", "09014", "09039");
      const hp = s.player.hp,
        threat = s.scheme.threat;
      const casting = makePiece(s, "09031");
      s = native(s, { type: "reveal", piece: casting, skip: true });
      expect(s.prompt!.options.map((o) => o.id)).toEqual([first.id, second.id]);
      s = choose(JSON.parse(JSON.stringify(s)) as GameState, second.id);
      expect(s.player.discard.some((p) => p.id === second.id)).toBe(true);
      expect(s.player.hand.map((p) => p.id)).toEqual([lower.id, first.id]);
      expect(s.player.hp).toBe(hp - (form === "hero" ? 4 : 0));
      expect(s.scheme.threat).toBe(threat + (form === "alter" ? 4 : 0));
    },
  );
  it("Seven Rings selects up to three different physical characters and keeps the Invocation outside the normal discard", () => {
    let s = base(true);
    const ring = top(s, "09034"),
      ally = area(s, "09002");
    const [resource] = hand(s, "09023");
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    s = pay(s, [resource.id]);
    expect(s.prompt?.kind).toBe("select");
    expect(s.prompt?.min).toBe(0);
    expect(s.prompt?.max).toBe(3);
    s = command(JSON.parse(JSON.stringify(s)) as GameState, {
      type: "SELECT",
      ids: ["hero:p1", "hero:p2", ally.id],
    });
    expect(s.player.tough).toBe(true);
    expect(seatView(s, "p2").player.tough).toBe(true);
    expect(physical(s, ally.id)[0].tough).toBe(true);
    expect(s.player.invocationDiscard?.some((p) => p.id === ring.id)).toBe(
      true,
    );
    expect(s.player.discard.some((p) => p.id === ring.id)).toBe(false);
  });
  it("Night Nurse is absent from public action options when all heroes are healthy without statuses", () => {
    const s = base(true),
      nurse = area(s, "09019");
    nurse.counters = 3;
    expect(abilityOptions(s, nurse)).toEqual([]);
    seatView(s, "p2").player.confused = true;
    expect(abilityOptions(s, nurse).map((o) => o.id)).toEqual(["nurse"]);
  });
  it("Unflappable excludes separate boost-ability damage from the attack's damage check", () => {
    let s = base();
    const unflappable = area(s, "09020"),
      hp = s.player.hp;
    s.encounter.deck = [makePiece(s, "01130"), makePiece(s, "09031")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    expect(s.player.hp).toBe(hp - 1);
    expect(s.prompt?.title).toBe("Unflappable");
    s = choose(s, "yes");
    expect(s.player.hand).toHaveLength(1);
    expect(physical(s, unflappable.id)[0].exhausted).toBe(true);
  });
  it("playing a Defense event while an own ally remains the defender cannot trigger Unflappable", () => {
    let s = base();
    const unflappable = area(s, "09020"),
      wong = area(s, "09002");
    const [strike, resource] = hand(s, "05014", "09006");
    s.encounter.deck = [makePiece(s, "09031"), makePiece(s, "09031")];
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, wong.id);
    expect(s.prompt?.options.some((o) => o.id.endsWith(":" + strike.id))).toBe(
      true,
    );
    s = choose(s, strike.id);
    s = pay(s, [resource.id]);
    if (s.prompt?.title === "Damage window") s = choose(s, "resolve");
    expect(s.player.hp).toBe(hp);
    expect(s.player.exhausted).toBe(false);
    expect(physical(s, wong.id)[0].damage).toBe(2);
    expect(physical(s, unflappable.id)[0].exhausted).toBe(false);
    expect(s.prompt).toBeNull();
  });
  it("Night Nurse removes exactly one chosen status, heals one, and discards the actual support after its last counter", () => {
    let s = base();
    const nurse = area(s, "09019");
    nurse.counters = 1;
    s.player.hp = maxHP(s) - 1;
    s.player.stunned = true;
    s.player.stunCards = 1;
    s.player.confused = true;
    s.player.confuseCards = 1;
    s = command(s, { type: "ABILITY", id: nurse.id, action: "nurse" });
    s = choose(s, s.activePlayerId);
    s = choose(JSON.parse(JSON.stringify(s)) as GameState, "stunned");
    expect(s.player.stunned).toBe(false);
    expect(s.player.confused).toBe(true);
    expect(s.player.hp).toBe(maxHP(s));
    expect(s.player.discard.some((p) => p.id === nurse.id)).toBe(true);
    expect(physical(s, nurse.id)).toHaveLength(1);
  });
  it("Magical Enhancements transfers control while retaining ownership and discards to its owner's pile at round end", () => {
    let s = base(true);
    const [enhancement, resource] = hand(s, "09010", "09006");
    s = command(s, { type: "PLAY", id: enhancement.id });
    s = pay(s, [resource.id]);
    s = choose(s, "p2");
    expect(s.player.inPlay.some((p) => p.id === enhancement.id)).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === enhancement.id)
        ?.ownerId,
    ).toBe("p1");
    expect(heroStats(seatView(s, "p2"))).toMatchObject({
      attack: 3,
      thwart: 2,
      defense: 4,
    });
    expect(heroStats(s)).toMatchObject({ attack: 1, thwart: 2, defense: 2 });
    s = native(JSON.parse(JSON.stringify(s)) as GameState, {
      type: "newRound",
    });
    expect(
      seatView(s, "p2").player.inPlay.some((p) => p.id === enhancement.id),
    ).toBe(false);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === enhancement.id),
    ).toBe(true);
    expect(physical(s, enhancement.id)).toHaveLength(1);
  });
  it("another hero who controls Wong through Make the Call can discard from Doctor Strange's separate Invocation deck", () => {
    let s = base(true);
    const invocation = top(s, "09036"),
      wong = owned(s, "09002", "p1");
    s.player.discard.push(wong);
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    const [call, double, single] = hand(s, "01071", "09023", "09006");
    s = command(s, { type: "PLAY", id: call.id });
    s = choose(s, wong.id);
    s = pay(s, [double.id, single.id]);
    expect(s.player.inPlay.find((p) => p.id === wong.id)?.ownerId).toBe("p1");
    s = command(s, { type: "ABILITY", id: wong.id, action: "wong" });
    expect(s.prompt?.options.map((o) => o.id)).toContain("discard");
    s = choose(JSON.parse(JSON.stringify(s)) as GameState, "discard");
    expect(
      seatView(s, "p1").player.invocationDiscard?.some(
        (p) => p.id === invocation.id,
      ),
    ).toBe(true);
    expect(s.player.invocationDeck).toBeUndefined();
    expect(physical(s, invocation.id)).toHaveLength(1);
  });
  it("Cloak's ready-only action is unavailable while All Tied Up forbids readying the identity", () => {
    const s = base(),
      cloak = area(s, "09009"),
      lock = makePiece(s, "02048");
    lock.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(lock);
    s.player.exhausted = true;
    expect(abilityOptions(s, cloak)).toEqual([]);
    const blocked = dispatch(s, {
      type: "ABILITY",
      id: cloak.id,
      action: "cloak",
    });
    expect(blocked.error).toContain("unavailable");
    expect(blocked.player.exhausted).toBe(true);
    expect(physical(blocked, cloak.id)[0].exhausted).toBe(false);
  });
  it("Wong hides its action while every Invocation is captured and its controller is healthy, then allows actual healing", () => {
    let s = base();
    const wong = area(s, "09002"),
      dimension = makePiece(s, "09029");
    dimension.storedCards = s.player.invocationDeck!.splice(0);
    s.sideSchemes.push(dimension);
    expect(abilityOptions(s, wong).map((o) => o.id)).toEqual([
      "attack",
      "thwart",
    ]);
    s.player.hp--;
    expect(abilityOptions(s, wong).map((o) => o.id)).toContain("wong");
    s = command(s, { type: "ABILITY", id: wong.id, action: "wong" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["heal"]);
    s = choose(s, "heal");
    expect(s.player.hp).toBe(maxHP(s));
    expect(physical(s, wong.id)[0].exhausted).toBe(true);
    expect(s.sideSchemes[0].storedCards).toHaveLength(5);
  });
  it("Counterspell revealed in alter-ego is discarded without surging or revealing a replacement", () => {
    let s = base();
    s.player.form = "alter";
    const counter = makePiece(s, "09030"),
      next = makePiece(s, "01191");
    s.encounter.deck = [next];
    s = native(s, { type: "reveal", piece: counter });
    expect(s.encounter.deck.map((p) => p.id)).toEqual([next.id]);
    expect(s.encounter.discard.some((p) => p.id === counter.id)).toBe(true);
    expect(s.attachments.some((p) => p.id === counter.id)).toBe(false);
    expect(s.player.exhausted).toBe(false);
  });
  it("Counterspell revealed in hero form attaches the actual encounter to that identity rather than the villain", () => {
    let s = base();
    const counter = makePiece(s, "09030");
    s = native(s, { type: "reveal", piece: counter });
    expect(s.attachments.find((p) => p.id === counter.id)?.attachedTo).toBe(
      `hero:${s.activePlayerId}`,
    );
    expect(s.resolving.some((p) => p.id === counter.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === counter.id)).toBe(false);
    expect(physical(s, counter.id)).toHaveLength(1);
  });
  it("Images of Ikonn removes threat from an eligible scheme instead of offering an empty main scheme", () => {
    let s = base();
    top(s, "09033");
    s.scheme.threat = 0;
    const side = makePiece(s, "01107");
    side.counters = 6;
    s.sideSchemes.push(side);
    const [resource] = hand(s, "09006");
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    s = pay(s, [resource.id]);
    expect(s.prompt).toBeNull();
    expect(s.sideSchemes.find((p) => p.id === side.id)?.counters).toBe(2);
  });
  it("Images can still resolve and discard with an already-confused villain and no threat", () => {
    let s = base();
    const invocation = top(s, "09033");
    s.scheme.threat = 0;
    s.villain.confused = true;
    s.villain.confuseCards = 1;
    const [resource] = hand(s, "09006");
    s = command(s, { type: "ABILITY", id: "identity", action: "spell" });
    s = pay(s, [resource.id]);
    expect(s.prompt).toBeNull();
    expect(
      s.player.invocationDiscard?.some((p) => p.id === invocation.id),
    ).toBe(true);
  });
  it("Astral Projection still looks at its real encounter target when no scheme has threat", () => {
    let s = base();
    s.scheme.threat = 0;
    const looked = makePiece(s, "09031");
    s.encounter.deck = [looked];
    const [projection, resource] = hand(s, "09003", "09023");
    s = command(s, { type: "PLAY", id: projection.id });
    s = pay(s, [resource.id]);
    expect(s.prompt?.title).toBe("Astral Projection · encounter card");
    expect(s.prompt?.options[0].image).toBe(looked.code);
    s = choose(s, "continue");
    expect(s.scheme.threat).toBe(0);
    expect(s.encounter.deck[0].id).toBe(looked.id);
  });
});
