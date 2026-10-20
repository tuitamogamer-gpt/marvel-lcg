import { describe, it, expect } from "vitest";
import {
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  playable,
  cardCost,
} from "../src/game/engine.js";
import { seatView, activateSeat } from "../src/game/team.js";
import { isTextBlank } from "../src/game/card-text.js";
import { card, deckCodes } from "../src/game/cards.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { deckErrors } from "../src/game/decks.js";
import { paymentSources } from "../src/game/payment.js";
import { nickFurySuit, NICK_FURY_SCRIPT_CODES } from "../src/game/nick-fury.js";
import {
  command,
  choose,
  finish,
  native,
  hand,
  put,
  minion,
  side,
  reload,
  respond,
  passId,
  target,
} from "./dv-test-helpers.js";
import type { GameState, Piece } from "../src/game/types.js";
function base(alter = false, team = false) {
  let s = newGame({
    heroId: "nick_fury",
    aspect: "justice",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 50034,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "nick_fury", aspect: "justice" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  s.player.deck.push(...s.player.hand.splice(0));
  s.player.form = alter ? "alter" : "hero";
  s.player.flipped = false;
  s.villain.hp = s.villain.maxHp = 100;
  s.scheme.threat = 8;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
function cast(s: GameState, code: string, ...resources: string[]) {
  const ps = hand(s, code, ...resources);
  s = command(s, { type: "PLAY", id: ps[0].id });
  if (s.prompt?.kind === "payment")
    s = command(s, { type: "PAY", ids: ps.slice(1).map((p) => p.id) });
  return s;
}
function reveal(s: GameState, code: string) {
  const z = s.player.setAside || [];
  const i = z.findIndex((p) => p.code === code);
  return native(s, {
    type: "reveal",
    piece: i >= 0 ? z.splice(i, 1)[0] : makePiece(s, code),
  });
}
function suit(s: GameState) {
  return nickFurySuit(s)!;
}
describe("Nick Fury complete native source", () => {
  it("extracts one linked physical suit from the41 source composition, shuffling exactly40 playing cards", () => {
    const codes = deckCodes("nick_fury", "justice");
    expect(codes).toEqual(heroStarterCodes("nick_fury"));
    expect(codes).toHaveLength(41);
    expect(deckErrors("nick_fury", "justice", codes)).toEqual([]);
    let s = base(true);
    expect(s.player.deck).toHaveLength(40);
    expect(suit(s).code).toBe("50035a");
    expect(s.player.setAside).toHaveLength(5);
    expect(NICK_FURY_SCRIPT_CODES).toHaveLength(33);
    for (const c of NICK_FURY_SCRIPT_CODES)
      expect(hasExecutableScript(c), c).toBe(true);
  });
  it("Infiltrate changes only the physical suit, retaining threat/exhaustion, separate from identity flip", () => {
    let s = base(true);
    const id = suit(s).id;
    suit(s).counters = 2;
    s = command(s, { type: "ABILITY", id: "identity", action: "infiltrate" });
    expect(suit(s)).toMatchObject({ id, code: "50035b", counters: 2 });
    expect(s.player.form).toBe("alter");
    expect(s.player.flipped).toBe(false);
    expect(reload(s)).toEqual(s);
  });
  it("Gather Intel follows a real basic thwart and adds exactly1 suit threat", () => {
    let s = base();
    s = command(s, { type: "BASIC", action: "thwart" });
    s = target(s, "main");
    expect(s.scheme.threat).toBe(6);
    s = respond(s, /Gather Intel/);
    s = finish(s);
    expect(suit(s).counters).toBe(1);
  });
  it("Break Cover changes Stealth before a real attack and Assault spends actual threat for damage", () => {
    let s = base();
    suit(s).code = "50035b";
    suit(s).counters = 3;
    const id = suit(s).id;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, "villain");
    expect(suit(s)).toMatchObject({ id, code: "50035a", counters: 3 });
    expect(s.prompt?.title).toBe("Assault");
    s = choose(reload(s), "2");
    s = finish(s);
    expect(s.villain.hp).toBe(96);
    expect(suit(s).counters).toBe(1);
  });
  it.each([0, 5, 6])(
    "Stealth replaces an enemy attack with scheming and diverts at threat%s",
    (count) => {
      let s = base();
      suit(s).code = "50035b";
      suit(s).counters = count;
      const hp = s.player.hp;
      s = native(s, { type: "enemyAttack", id: s.villain.id });
      s = finish(s);
      expect(s.player.hp).toBe(hp);
      expect(suit(s).counters).toBe(count + (count <= 5 ? 1 : 0));
      expect(s.scheme.threat).toBe(8 + (count <= 5 ? 0 : 1));
      expect(reload(s)).toEqual(s);
    },
  );
  it("Stunned replaces the original attack before Stealth can produce a scheme", () => {
    let s = base();
    suit(s).code = "50035b";
    s.villain.stunned = true;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = finish(s);
    expect(s.villain.stunned).toBe(false);
    expect(s.scheme.threat).toBe(8);
    expect(suit(s).counters).toBe(0);
  });
  it("Covert Surveillance moves actual removed threat in Stealth", () => {
    let s = base();
    suit(s).code = "50035b";
    s.scheme.threat = 1;
    s = cast(s, "50038", "50058");
    s = target(s, "main");
    s = choose(s, "yes");
    s = finish(s);
    expect(s.scheme.threat).toBe(0);
    expect(suit(s).counters).toBe(1);
  });
  it("Concentrated Fire defeats an enemy and grants its printed SCH", () => {
    let s = base();
    const m = minion(s, "01102");
    m.tough = false;
    s = cast(s, "50037", "50058", "50058");
    s = choose(s, m.id);
    s = finish(s, (v) =>
      v.prompt?.title === "Concentrated Fire" ? "threat" : undefined,
    );
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(suit(s).counters).toBe(card(m).scheme || 0);
  });
  it("Flying Car pays suit threat to ready Nick and grants Aerial through this round", () => {
    let s = base();
    const p = put(s, "50040");
    s.player.exhausted = true;
    suit(s).counters = 1;
    s = command(s, { type: "ABILITY", id: p.id, action: "flying-car" });
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
    expect(suit(s).counters).toBe(0);
    expect(s.flags.nickAerialRound).toBe(s.round);
  });
  it("Safe House exhausts for2 healing in alter ego", () => {
    let s = base(true);
    const p = put(s, "50041");
    s.player.hp = 5;
    s = command(s, { type: "ABILITY", id: p.id, action: "safe-house" });
    s = choose(s, "heal");
    s = finish(s);
    expect(s.player.hp).toBe(7);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Leo Fitz discounts for SHIELD then searches only the actual deck for Tech", () => {
    let s = base(true);
    const p = put(s, "50056");
    expect(cardCost(s, card(p), p)).toBe(1);
    const tech = s.player.deck.find((p) => p.code === "50042")!;
    s = command(s, { type: "ABILITY", id: p.id, action: "leo-fitz" });
    expect(s.prompt?.options.some((o) => o.id === tech.id)).toBe(true);
    s = choose(reload(s), tech.id);
    expect(s.player.hand.some((q) => q.id === tech.id)).toBe(true);
  });
  it("Watch commits the chosen1 threat/resource, preserving its physical payment ID", () => {
    let s = base();
    const watch = put(s, "50044");
    suit(s).counters = 2;
    const [p] = hand(s, "50038");
    expect(
      paymentSources(s, p.id, p.code).find((q) => q.id === watch.id)?.resources,
    ).toEqual(["mental", "mental"]);
    s = command(s, { type: "PLAY", id: p.id });
    s = command(s, { type: "PAY", ids: [watch.id] });
    expect(s.prompt?.title).toBe("Fury's Watch");
    s = choose(reload(s), "1");
    s = target(s, "main");
    s = finish(s);
    expect(suit(s).counters).toBe(1);
    expect(s.player.inPlay.find((q) => q.id === watch.id)?.exhausted).toBe(
      true,
    );
  });
  it("Jemma only generates its mental resource for Tech payments", () => {
    let s = base();
    const p = put(s, "50055");
    expect(
      paymentSources(s, undefined, "50042").some((q) => q.id === p.id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "50037").some((q) => q.id === p.id),
    ).toBe(false);
  });
  it("EM Shield prevents all actual attack damage in either identity form and discards its same physical ID", () => {
    let s = base(true);
    const p = put(s, "50042");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = finish(
      s,
      (v) => v.prompt?.options.find((o) => o.image === "50042")?.id,
    );
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Eyepatch Camera moves only threat in the pending main-scheme packet", () => {
    let s = base();
    const p = put(s, "50043");
    s = native(s, { type: "threat", target: "main", amount: 4 });
    s = respond(s, /Eyepatch Camera/);
    s = choose(s, "3");
    s = finish(s);
    expect(s.scheme.threat).toBe(9);
    expect(suit(s).counters).toBe(3);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Intelligence Analysis discards its preparation and1 suit threat to cancel an actual treachery", () => {
    let s = base();
    const p = put(s, "50045");
    suit(s).counters = 1;
    s = reveal(s, "50063");
    s = respond(s, /Intelligence Analysis/);
    s = finish(s);
    expect(suit(s).counters).toBe(0);
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.discard.filter((q) => q.code === "50063")).toHaveLength(
      1,
    );
  });
  it("Practiced Plan returns the exact discarded Preparation before it resolves; Secret Agent responds afterward", () => {
    let s = base();
    const camera = put(s, "50043"),
      plan = put(s, "50058");
    put(s, "50046");
    s = native(s, { type: "threat", target: "main", amount: 2 });
    s = respond(s, /Eyepatch Camera/);
    expect(s.prompt?.title).toBe("Practiced Plan");
    s = choose(reload(s), plan.id);
    expect(s.player.hand.some((q) => q.id === camera.id)).toBe(true);
    s = finish(s, (v) =>
      v.prompt?.title === "Eyepatch Camera" ? "2" : undefined,
    );
    expect(s.scheme.threat).toBe(8);
    expect(suit(s).counters).toBe(2);
    expect(s.player.discard.some((q) => q.id === plan.id)).toBe(true);
  });
  it("Informant changes a real minion scheme into threat removal", () => {
    let s = base();
    const p = put(s, "50050"),
      m = minion(s, "01102");
    s = native(s, { type: "enemyScheme", id: m.id });
    s = respond(s, /Informant/);
    s = finish(s);
    expect(s.scheme.threat).toBe(8 - (card(m).scheme || 0));
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Prism Dust confuses and attacks the actual entering minion", () => {
    let s = base();
    const p = put(s, "50052");
    const m = makePiece(s, "01157");
    s = native(s, { type: "reveal", piece: m });
    s = respond(s, /Prism Dust/);
    s = finish(s);
    expect(s.minions.find((q) => q.id === m.id)).toMatchObject({
      damage: 2,
      confused: true,
    });
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Nick Fury Sr forced entry can draw2, and his same physical ally leaves at round end", () => {
    let s = base();
    const p = put(s, "50054");
    s = native(s, { type: "allyEnter", id: p.id });
    s = choose(s, "draw");
    s = finish(s);
    expect(s.player.hand).toHaveLength(2);
    s = native(s, { type: "newRound" });
    s = finish(s);
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Orion accepts multiple Tough cards and gains another after positive damage", () => {
    let s = base();
    s = reveal(s, "50060");
    s = finish(s);
    const m = s.minions.find((q) => q.code === "50060")!;
    s = native(s, { type: "status", target: m.id, status: "tough" });
    expect(s.minions.find((q) => q.id === m.id)?.toughCards).toBe(2);
    s = native(s, {
      type: "damage",
      target: m.id,
      amount: 2,
      source: "hero",
      piercing: true,
      attack: true,
    });
    s = finish(s);
    expect(s.minions.find((q) => q.id === m.id)).toMatchObject({
      damage: 2,
      toughCards: 1,
      tough: true,
    });
  });
  it("Acquire the Infinity Formula has fixed5 threat and finds the reserved physical Orion after Nick takes damage", () => {
    let s = base();
    const id = s.player.setAside!.find((p) => p.code === "50060")!.id;
    s = reveal(s, "50061");
    s = finish(s);
    expect(s.sideSchemes.find((q) => q.code === "50061")?.counters).toBe(5);
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    s = finish(s);
    expect(s.minions.find((q) => q.id === id)).toMatchObject({
      code: "50060",
      engagedWith: "p1",
      tough: true,
    });
  });
  it("a zero-SCH Leviathan Soldier still deals1 damage after scheming", () => {
    let s = base();
    s = reveal(s, "50062");
    s = finish(s);
    const m = s.minions.find((q) => q.code === "50062")!;
    s = native(s, { type: "enemyScheme", id: m.id });
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.scheme.threat).toBe(8);
  });
  it("Cold Storage puts the exact selected Leviathan from discard into play; otherwise deals2", () => {
    let s = base();
    const p = makePiece(s, "50062");
    s.encounter.discard.push(p);
    s = reveal(s, "50063");
    s = choose(s, p.id);
    s = finish(s);
    expect(s.minions.find((q) => q.id === p.id)?.engagedWith).toBe("p1");
    s = reveal(s, "50063");
    s = finish(s);
    expect(s.player.hp).toBe(8);
  });
});

describe("Nick source pool and cross-pack interactions", () => {
  it("Super Spies literal mixed placements keep suit AP, suit threat and support threat distinct across players", () => {
    let s = base(false, true);
    put(s, "50036");
    const support = put(s, "50055", "p2"),
      suitId = suit(s).id;
    const [event] = hand(s, "50024");
    expect(playable(s, event)).toBeNull();
    s = command(s, { type: "PLAY", id: event.id });
    s = choose(reload(s), `${suitId}:counter`);
    s = choose(reload(s), `${support.id}:threat`);
    s = choose(reload(s), `${suitId}:threat`);
    s = finish(s);
    expect(suit(s)).toMatchObject({
      id: suitId,
      counters: 1,
      nickAllPurposeCounters: 1,
    });
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === support.id),
    ).toMatchObject({ counters: 0, nickThreatTokens: 1 });
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(reload(s)).toEqual(s);
  });
  it("inert suit AP cannot fund Watch or Flying Car, and inert support threat cannot fund Uses", () => {
    let s = base();
    const watch = put(s, "50044"),
      car = put(s, "50040"),
      battery = put(s, "27047");
    suit(s).nickAllPurposeCounters = 3;
    battery.nickThreatTokens = 3;
    battery.counters = 0;
    s.player.exhausted = true;
    expect(
      paymentSources(s, undefined, "50038").some((p) => p.id === watch.id),
    ).toBe(false);
    expect(nativeHeroAbilityOptions(s, car.id)).toEqual([]);
    expect(battery.counters).toBe(0);
  });
  it("Super Spies all-purpose counters replenish a support's real counter store", () => {
    let s = base();
    put(s, "50036");
    const support = put(s, "50055");
    s = cast(s, "50024");
    for (let i = 0; i < 3; i++) s = choose(reload(s), `${support.id}:counter`);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === support.id)).toMatchObject({
      counters: 3,
    });
    expect(suit(s).counters).toBe(0);
  });
  it("Super Spies requires both named team-up characters and control of one", () => {
    const s = base();
    const [e] = hand(s, "50024");
    expect(playable(s, e)).toMatch(/Maria Hill and Nick Fury/);
  });
  it("Maria Hill's real basic thwart puts only actually removed threat on the same physical suit", () => {
    let s = base();
    const maria = put(s, "50036");
    s.scheme.threat = 1;
    s = command(s, { type: "ABILITY", id: maria.id, action: "thwart" });
    s = target(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(0);
    expect(suit(s).counters).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === maria.id)?.damage).toBe(1);
  });
  it("Spray Fire spends one Assault cost and adds its bonus to the villain and each selected player's minion", () => {
    let s = base(false, true);
    suit(s).code = "50035b";
    suit(s).counters = 3;
    const m = minion(s, "01157", "p2"),
      other = minion(s, "01102", "p1");
    s = cast(s, "50039", "50058", "50058", "50058");
    s = choose(s, "p2");
    expect(s.prompt?.title).toBe("Assault");
    s = choose(reload(s), "1");
    s = finish(s);
    expect(s.villain.hp).toBe(96);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(4);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(0);
    expect(suit(s)).toMatchObject({ code: "50035a", counters: 2 });
  });
  it("Assault choosing0 stays0 on every packet, rather than reducing later damage", () => {
    let s = base();
    suit(s).counters = 3;
    const m = minion(s, "01157");
    s = cast(s, "50039", "50058", "50058", "50058");
    s = choose(s, "p1");
    s = choose(s, "0");
    s = finish(s);
    expect(s.villain.hp).toBe(97);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(3);
    expect(suit(s).counters).toBe(3);
  });
  it("Secret Agent responds only after the camera replacement has resolved, then moves actual threat", () => {
    let s = base();
    s.scheme.threat = 1;
    const agent = put(s, "50046");
    put(s, "50043");
    s = native(s, { type: "threat", target: "main", amount: 4 });
    s = respond(s, /Eyepatch Camera/);
    s = choose(s, "2");
    expect(s.scheme.threat).toBe(3);
    expect(suit(s).counters).toBe(2);
    s = choose(reload(s), `${agent.id}:main`);
    s = finish(s);
    expect(s.scheme.threat).toBe(2);
    expect(suit(s).counters).toBe(3);
  });
  it("Practiced Plan also observes a legacy Black Widow Preparation and returns the exact discarded ID", () => {
    let s = base();
    const intel = put(s, "08017"),
      plan = put(s, "50058");
    s = native(s, { type: "threat", target: "main", amount: 3 });
    s = respond(s, /Counterintelligence/);
    expect(s.prompt?.title).toBe("Practiced Plan");
    s = choose(reload(s), plan.id);
    s = finish(s);
    expect(s.player.hand.find((p) => p.id === intel.id)?.code).toBe("08017");
    expect(s.scheme.threat).toBe(8);
    expect(s.player.discard.some((p) => p.id === plan.id)).toBe(true);
  });
  it("Practiced Plan observes an ordinary controlled-Preparation discard without treating it as a resolved ability", () => {
    let s = base();
    const p = put(s, "50050"),
      plan = put(s, "50058");
    put(s, "50046");
    s = native(s, { type: "discardPiece", id: p.id });
    s = choose(s, plan.id);
    s = finish(s);
    expect(s.player.hand.some((q) => q.id === p.id)).toBe(true);
    expect(suit(s).counters).toBe(0);
  });
  it("Intelligence looks at all dealt physical encounters and swaps the deck top without changing recipients", () => {
    let s = base(false, true);
    const intel = put(s, "50051");
    const first = makePiece(s, "01122"),
      top = makePiece(s, "01104");
    s.encounter.deck = [first, top, ...s.encounter.deck];
    s = native(s, { type: "dealEncounter", playerId: "p2" });
    s = choose(s, "yes");
    expect(s.prompt?.title).toBe("Intelligence");
    s = choose(reload(s), "0");
    s = choose(reload(s), "1");
    s = choose(s, "done");
    s = finish(s);
    expect(s.encounter.deck[0].id).toBe(first.id);
    expect(s.encounter.dealt.find((p) => p.id === top.id)?.dealtTo).toBe("p2");
    expect(s.player.discard.some((p) => p.id === intel.id)).toBe(true);
  });
  it("Intelligence is offered before villain-phase dealt cards are revealed", () => {
    let s = base();
    put(s, "50051");
    s = native(s, { type: "dealEncounters" });
    expect(s.prompt?.title).toBe("Intelligence");
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.resolving).toHaveLength(0);
  });
  it("reprinted Agent Coulson searches for the actual new Preparation and preserves both printings", () => {
    let s = base();
    const p = put(s, "50047"),
      prep = s.player.deck.find((p) => p.code === "50045")!;
    s = native(s, { type: "allyEnter", id: p.id });
    s = choose(s, "yes");
    s = choose(reload(s), prep.id);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === prep.id)).toBe(true);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.code).toBe("50047");
  });
  it("reprinted Quake exhausts after a real minion scheme and damages that same minion", () => {
    let s = base();
    s.scheme.threat = 1;
    const p = put(s, "50048"),
      m = minion(s, "01157");
    s = native(s, { type: "enemyScheme", id: m.id });
    s = respond(s, /Quake/);
    s = finish(s);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
    expect(s.minions.find((q) => q.id === m.id)?.damage).toBe(2);
  });
  it("reprinted Under Surveillance attaches to the actual main scheme and rejects a duplicate", () => {
    let s = base();
    s = cast(s, "50053", "50058", "50058");
    s = finish(s);
    const p = s.player.inPlay.find((p) => p.code === "50053")!;
    expect(p.attachedTo).toBe(`main:${s.scheme.code}`);
    const [second] = hand(s, "06031");
    expect(playable(s, second)).toMatch(/already has Under Surveillance/);
  });
  it("reprinted Sky-Destroyer responds to playing a real SHIELD support using its own physical ID", () => {
    let s = base();
    const sky = put(s, "50057");
    s = cast(s, "50055", "50058");
    s = respond(s, /Sky-Destroyer/);
    s = target(s, "villain");
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === sky.id)?.exhausted).toBe(true);
    expect(s.villain.hp).toBe(98);
  });
  it("Discovered changes the same suit to Assault and removes all its threat, keeping inert AP", () => {
    let s = base();
    const id = suit(s).id;
    suit(s).code = "50035b";
    suit(s).counters = 4;
    suit(s).nickAllPurposeCounters = 2;
    s = reveal(s, "50059");
    s = choose(s, "remove");
    s = finish(s);
    expect(suit(s)).toMatchObject({
      id,
      code: "50035a",
      counters: 0,
      nickAllPurposeCounters: 2,
    });
    expect(
      [...s.encounter.discard, ...s.player.inPlay].filter(
        (p) => p.code === "50059",
      ),
    ).toHaveLength(1);
  });
  it("Shadows reveals the original Orion and fixed-threat scheme and shuffles the actual remaining3 nemesis cards", () => {
    let s = base();
    const ids = s.player.setAside!.map((p) => p.id);
    s = reveal(s, "01190");
    s = finish(s);
    expect(s.minions.some((p) => p.code === "50060")).toBe(true);
    expect(s.sideSchemes.find((p) => p.code === "50061")?.counters).toBe(5);
    const all = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.encounter.deck,
      ...s.encounter.discard,
      ...s.player.setAside!,
    ];
    for (const id of ids)
      expect(all.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("a blanked Stealth suit does not replace an enemy attack", () => {
    let s = base();
    suit(s).code = "50035b";
    s.flags[`deadpoolRay:${suit(s).id}`] = true;
    expect(isTextBlank(s, suit(s))).toBe(true);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = finish(s);
    expect(s.player.hp).toBeLessThan(10);
    expect(suit(s).counters).toBe(0);
  });
});

describe("Nick forced replacement timing", () => {
  it.each([0, 5, 6])(
    "Informant still allows Stealth's diverted1 threat at suit%s (official2025-01-24)",
    (count) => {
      let s = base();
      s.scheme.threat = 5;
      suit(s).code = "50035b";
      suit(s).counters = count;
      put(s, "50050");
      const m = minion(s, "01157");
      s = native(s, { type: "enemyAttack", id: m.id });
      s = respond(s, /Informant/);
      s = finish(s);
      expect(s.player.hp).toBe(10);
      expect(suit(s).counters).toBe(count + (count <= 5 ? 1 : 0));
      expect(s.scheme.threat).toBe(count <= 5 ? 4 : 3);
      expect(reload(s)).toEqual(s);
    },
  );
  it("Serve and Protect prevents only main threat after Stealth's mandatory1 threat diversion", () => {
    let s = base();
    s.scheme.threat = 1;
    suit(s).code = "50035b";
    const a = put(s, "40015"),
      b = put(s, "47002");
    const cards = hand(s, "47029", "01088");
    const m = minion(s, "01157");
    s = native(s, { type: "enemyAttack", id: m.id });
    expect(suit(s).counters).toBe(1);
    s = respond(s, /Serve and Protect/);
    s = choose(s, `${a.id}:${b.id}`);
    s = command(s, { type: "PAY", ids: [cards[1].id] });
    s = finish(s);
    expect(suit(s).counters).toBe(1);
    expect(s.scheme.threat).toBe(1);
  });
  it("a Stunned Prism Dust attack is replaced entirely and does not trigger Secret Agent", () => {
    let s = base();
    put(s, "50052");
    put(s, "50046");
    s.player.stunned = true;
    const p = makePiece(s, "01157");
    s = native(s, { type: "reveal", piece: p });
    s = respond(s, /Prism Dust/);
    s = finish(s);
    expect(s.player.stunned).toBe(false);
    expect(s.minions.find((q) => q.id === p.id)).toMatchObject({
      damage: 0,
      confused: false,
    });
    expect(suit(s).counters).toBe(0);
  });
});

describe("Nick shared native controls", () => {
  it("reprinted Global Logistics pays a real SHIELD exhaust cost and moves exact inspected cards", () => {
    let s = base();
    const support = put(s, "50055"),
      top = s.encounter.deck.slice(0, 4);
    s = cast(s, "50049");
    s = target(s, support.id);
    s = choose(s, "encounter");
    for (let i = 0; i < 4; i++) s = choose(reload(s), "discard");
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
    for (const p of top)
      expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.code === "50049")).toHaveLength(1);
  });
  it("Stealth cannot divert threat from a zero-SCH activation", () => {
    let s = base();
    suit(s).code = "50035b";
    const m = minion(s, "50062");
    s = native(s, { type: "enemyAttack", id: m.id });
    s = finish(s);
    expect(suit(s).counters).toBe(0);
    expect(s.scheme.threat).toBe(8);
    expect(s.player.hp).toBe(9);
  });
  it("Orion FIND can recover the original physical card from a dealt encounter slot", () => {
    let s = base();
    s = reveal(s, "50061");
    s = finish(s);
    const z = s.player.setAside!,
      i = z.findIndex((p) => p.code === "50060"),
      p = z.splice(i, 1)[0];
    p.dealtTo = "p1";
    s.encounter.dealt.push(p);
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    s = finish(s);
    expect(s.minions.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.encounter.dealt.some((q) => q.id === p.id)).toBe(false);
  });
  it("Merc with the Mouth blocks Nick's own actions and Preparation reactions during another player's turn", () => {
    let s = base(true, true);
    const other = s.players[1];
    other.heroId = "deadpool";
    put(s, "44032", other.id);
    s.turnPlayerId = other.id;
    put(s, "50043");
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
    s.player.form = "hero";
    s.scheme.threat = 1;
    s = native(s, { type: "threat", target: "main", amount: 2 });
    expect(s.prompt).toBeNull();
    expect(s.scheme.threat).toBe(3);
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.code === "50043"),
    ).toBe(true);
  });
  it("a blanked Orion cannot add further Tough cards", () => {
    let s = base();
    s = reveal(s, "50060");
    s = finish(s);
    const p = s.minions.find((p) => p.code === "50060")!;
    s.flags[`deadpoolRay:${p.id}`] = true;
    s = native(s, { type: "status", target: p.id, status: "tough" });
    expect(s.minions.find((q) => q.id === p.id)?.toughCards || 1).toBe(1);
  });
});

describe("Nick suspended attack continuations", () => {
  it("Break Cover's Moxie form response finishes before Assault and updates the current basic attack", () => {
    let s = base();
    suit(s).code = "50035b";
    suit(s).counters = 1;
    hand(s, "21017");
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, "villain");
    s = respond(s, /Moxie/);
    s = finish(s, (v) => (v.prompt?.title === "Assault" ? "1" : undefined));
    expect(s.villain.hp).toBe(96);
    expect(suit(s).counters).toBe(0);
  });
  it("EM Shield prevents actual Overkill to Nick without preventing damage to his defending ally", () => {
    let s = base();
    const shield = put(s, "50042"),
      ally = put(s, "50036");
    ally.damage = 2;
    const charge = makePiece(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, ally.id);
    s = respond(s, /EM Shield/);
    s = finish(s);
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === shield.id)).toBe(true);
  });
});
