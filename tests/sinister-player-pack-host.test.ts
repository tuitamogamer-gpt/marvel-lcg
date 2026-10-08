import { describe, it, expect } from "vitest";
import { card } from "../src/game/cards.js";
import {
  newGame,
  makePiece,
  playable,
  abilityOptions,
  paymentSources,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState } from "../src/game/types.js";
import {
  command,
  finish,
  choose,
  hand,
  put,
  play,
  physical,
  respond,
  until,
  native,
  target,
  owned,
  conserved,
} from "./dv-test-helpers.js";
function base(ghost = false, team = false, other?: string) {
  const h = {
    heroId: ghost ? "ghost_spider" : "spider_man_morales",
    aspect: ghost ? ("protection" as const) : ("justice" as const),
  };
  let s = newGame({
    ...h,
    villainId: "rhino",
    seed: 27400,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            h,
            {
              heroId: other || (ghost ? "spider_man_morales" : "ghost_spider"),
              aspect: ghost ? ("justice" as const) : ("protection" as const),
            },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    const original = physical(s, seat.id);
    expect(original).toHaveLength(40);
    v.player.deck = original;
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.flipped = false;
  }
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 0;
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  return s;
}
function pick(s: GameState, id: string) {
  return choose(
    until(s, (v) => !!v.prompt?.options.some((o) => o.id === id)),
    id,
  );
}
function by(s: GameState, code: string) {
  return respond(
    s,
    new RegExp(card(code).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    code,
  );
}
describe("Sinister player pool native ownership and remaining printed effects", () => {
  it("Web of Life ignores its cost for the actual Web-Warrior identity and preserves the original physical source", () => {
    let s = base();
    const originals = physical(s);
    const [web] = hand(s, "27023");
    expect(playable(s, web)).toBeNull();
    s = finish(play(s, web));
    expect(s.player.inPlay.filter((p) => p.id === web.id)).toHaveLength(1);
    expect(s.player.discard).toHaveLength(0);
    conserved(s, originals);
  });
  it("Silk searches the actual encounter deck only after hand PLAY and shuffles without duplicating the treachery", () => {
    let s = base();
    const [silk, energy] = hand(s, "27010", "27051");
    const treachery = makePiece(s, "01186");
    s.encounter.deck.push(treachery);
    const seed = s.seed;
    s = by(play(s, silk, [energy]), "27010");
    s = pick(s, treachery.id);
    s = finish(s);
    expect(
      s.encounter.discard.filter((p) => p.id === treachery.id),
    ).toHaveLength(1);
    expect(s.encounter.deck.some((p) => p.id === treachery.id)).toBe(false);
    expect(s.seed).not.toBe(seed);
  });
  it("PUT Silk does not manufacture its hand PLAY response", () => {
    let s = base();
    const silk = owned(s, "27010");
    s.player.discard.push(silk);
    const [verse, energy] = hand(s, "27018", "27051");
    s = play(s, verse, [energy]);
    s = pick(s, `hero:${s.activePlayerId}`);
    s = pick(s, silk.id);
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === silk.id)).toBe(true);
    expect(s.encounter.discard).toHaveLength(0);
  });
  it("Miles ally counts the actual identity and support among three Web-Warriors before applying two statuses", () => {
    let s = base(true);
    put(s, "27023");
    const [ally, a, b] = hand(s, "27011", "27020", "27021");
    s = by(play(s, ally, [a, b]), "27011");
    s = finish(pick(s, s.villain.id));
    expect(s.villain.stunned).toBe(true);
    expect(s.villain.confused).toBe(true);
  });
  it("Monica PUTs the actual printed Core-alias Team and adds one counter to every controlled Team", () => {
    let s = base();
    const team = put(s, "27045");
    team.counters = 1;
    const second = owned(s, "01064");
    s.player.discard.push(second);
    const [monica, a, b] = hand(s, "27040", "27051", "27052");
    s = by(play(s, monica, [a, b]), "27040");
    s = pick(s, second.id);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === team.id)?.counters).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === second.id)?.counters).toBe(4);
    expect(s.player.discard.some((p) => p.id === second.id)).toBe(false);
  });
  it("Spider-Woman uses the actual confused enemy count for current discounted PLAY cost", () => {
    let s = base();
    s.villain.confused = true;
    const m = makePiece(s, "01101");
    m.confused = true;
    m.engagedWith = "p1";
    s.minions.push(m);
    const [woman, res] = hand(s, "27041", "27043");
    expect(playable(s, woman)).toBeNull();
    s = finish(play(s, woman, [res]));
    expect(s.player.inPlay.some((p) => p.id === woman.id)).toBe(true);
  });
  it("Agent13 readies an actual SHIELD support controlled by another player", () => {
    let s = base(false, true);
    const a = put(s, "27046"),
      support = put(s, "27054", "p2");
    support.exhausted = true;
    s = command(s, { type: "ABILITY", id: a.id, action: "attack" });
    s = target(s, s.villain.id);
    s = pick(s, support.id);
    s = finish(s);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === support.id)
        ?.exhausted,
    ).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === a.id)?.damage).toBe(1);
  });
  it("Peter readies another actual Web-Warrior character after thwarting and before consequential damage", () => {
    let s = base();
    const peter = put(s, "27049");
    s.player.exhausted = true;
    s.scheme.threat = 3;
    s = command(s, { type: "ABILITY", id: peter.id, action: "thwart" });
    s = target(s, "main");
    s = pick(s, "hero:p1");
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === peter.id)?.damage).toBe(1);
    expect(s.scheme.threat).toBe(1);
  });
  it("SpiderUK can defeat its actual attacking minion before boosts and receiving attack damage", () => {
    let s = base();
    const uk = put(s, "27012");
    put(s, "27023");
    const m = makePiece(s, "01101");
    m.engagedWith = "p1";
    s.minions.push(m);
    s = native(s, { type: "enemyAttack", id: m.id });
    s = pick(s, uk.id);
    s = by(s, "27012");
    s = finish(s);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === uk.id)?.damage).toBe(0);
    expect(s.attack).toBeNull();
  });
  it("Sky-Destroyer reacts once to an actual SHIELD PLAY", () => {
    let s = base();
    const sky = put(s, "27055");
    const [gov, a] = hand(s, "27054", "27051");
    s = by(play(s, gov, [a]), "27055");
    s = pick(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(s.player.inPlay.find((p) => p.id === sky.id)?.exhausted).toBe(true);
  });
  it("PlanB retains physical ownership when played under the teammate control and discards a real random hand cost", () => {
    let s = base(false, true);
    const [plan, res] = hand(s, "27024", "27043");
    s = play(s, plan, [res]);
    s = pick(s, "p2");
    s = finish(s);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === plan.id)?.ownerId,
    ).toBe("p1");
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    const [a, b] = hand(s, "27014", "27015");
    const beforeSeed = s.seed,
      hidden = s.hiddenInfo || 0;
    s = command(s, { type: "ABILITY", id: plan.id, action: "plan-b" });
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(
      s.player.discard.filter((p) => [a.id, b.id].includes(p.id)),
    ).toHaveLength(1);
    expect(s.seed).not.toBe(beforeSeed);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    expect(s.player.inPlay.find((p) => p.id === plan.id)?.exhausted).toBe(true);
  });
  it("GlobalLogistics preserves actual teammate IDs and chosen top/bottom order with owner-aware discard", () => {
    let s = base(false, true);
    const gov = put(s, "27054");
    const [event] = hand(s, "27043");
    const ids = seatView(s, "p2")
      .player.deck.slice(0, 4)
      .map((p) => p.id);
    s = play(s, event);
    s = pick(s, gov.id);
    s = pick(s, "p2");
    for (const destination of ["top", "top", "bottom", "discard"])
      s = pick(s, destination);
    s = pick(s, ids[1]);
    s = pick(s, ids[0]);
    s = pick(s, ids[2]);
    s = finish(s);
    const v = seatView(s, "p2");
    expect(v.player.deck.slice(0, 2).map((p) => p.id)).toEqual([
      ids[1],
      ids[0],
    ]);
    expect(v.player.deck.at(-1)?.id).toBe(ids[2]);
    expect(v.player.discard.filter((p) => p.id === ids[3])).toHaveLength(1);
    expect(s.activePlayerId).toBe("p1");
  });
  it("A native actual SHIELD PUT does not create a Sky-Destroyer PLAY response", () => {
    let s = base();
    const sky = put(s, "27055"),
      team = owned(s, "27045");
    s.player.discard.push(team);
    s = finish(native(s, { type: "sinisterNativePut", id: team.id }));
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === sky.id)?.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === team.id)?.counters).toBe(3);
  });
  it("Venom counts a star on the actual Chaos Control replacement while ordinary attack boosts remain numeric", () => {
    let s = base(false, true, "scw");
    const venom = put(s, "27190"),
      revealed = makePiece(s, "01131"),
      replacement = makePiece(s, "01129");
    s.encounter.deck.unshift(replacement);
    s = native(s, { type: "reveal", piece: revealed });
    s = by(s, "27190");
    s = pick(s, s.villain.id);
    s = respond(s, /Chaos Control/i);
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.encounter.discard.some((p) => p.id === replacement.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === venom.id)?.damage).toBe(1);
    s.encounter.deck.unshift(makePiece(s, "01130"));
    const before = seatView(s, "p2").player.hp,
      attack = card(s.villain).attack || 0;
    activateSeat(s, "p2");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = pick(s, "take");
    s = finish(s);
    expect(seatView(s, "p2").player.hp).toBe(before - attack - 1);
  });
  it("Government Liaison preserves its ready cost source when Homeland has no legal scheme or the cost removes its only ready SHIELD card", () => {
    let s = base();
    const gov = put(s, "27054");
    const [event] = hand(s, "27042");
    s.scheme.threat = 0;
    expect(playable(s, event)).toBeTruthy();
    expect(
      abilityOptions(s, gov).some((o) => o.id === "government-liaison"),
    ).toBe(false);
    expect(gov.exhausted).toBe(false);
    s.scheme.threat = 3;
    expect(playable(s, event)).toBeNull();
    expect(
      abilityOptions(s, gov).some((o) => o.id === "government-liaison"),
    ).toBe(false);
    expect(gov.exhausted).toBe(false);
    const team = put(s, "27045");
    expect(
      abilityOptions(s, gov).some((o) => o.id === "government-liaison"),
    ).toBe(true);
    expect(gov.exhausted).toBe(false);
    expect(team.exhausted).toBe(false);
  });
});
