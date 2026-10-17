import { describe, it, expect } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sources from "../src/data/catalog-decks.json" with { type: "json" };
import { card, deckCodes, maxHP, pieceHP } from "../src/game/cards.js";
import { deckErrors } from "../src/game/decks.js";
import {
  newGame,
  dispatch,
  makePiece,
  nativeHeroAbilityOptions,
  playable,
} from "../src/game/engine.js";
import { dominoResources } from "../src/game/domino.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  hand,
  put,
  minion,
  native,
  pay,
  physical,
  target,
  reload,
  top,
  side,
  attach,
} from "./dv-test-helpers.js";
function base(team = false) {
  let s = newGame({
    heroId: "domino",
    aspect: "justice",
    villainId: "rhino",
    seed: 40037,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "domino", aspect: "justice" as Aspect },
            { heroId: "spider_man", aspect: "justice" as Aspect },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    s.player.deck = physical(s);
    s.player.hand = [];
    s.player.discard = [];
    s.player.inPlay = [];
    s.player.form = "hero";
    s.player.exhausted = false;
    s.player.flipped = false;
  }
  activateSeat(s, "p1");
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01186"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 80;
  s.scheme.threat = 15;
  return s;
}
const ability = (s: GameState, action: string, id = "identity") =>
  command(s, { type: "ABILITY", id, action });
function paid(s: GameState, code: string) {
  const [p, ...r] = hand(s, code, "40061", "40062");
  return pay(command(s, { type: "PLAY", id: p.id }), r);
}
function reveal(s: GameState, code: string) {
  const p = makePiece(s, code);
  return { p, s: native(s, { type: "reveal", piece: p }) };
}
describe("Domino original sources and native rules", () => {
  it("supports every original face, exact40Justice and five physical owned nemesis cards", () => {
    for (const c of catalog.filter(
      (c) => c.code >= "40037" && c.code <= "40069",
    ))
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    const src = sources.find((d) => d.heroCode === "40037a")!;
    expect(deckCodes("domino", "justice").sort()).toEqual(
      Object.entries(src.cards)
        .flatMap(([c, n]) => Array(n).fill(c))
        .sort(),
    );
    expect(deckCodes("domino", "justice")).toHaveLength(40);
    for (const a of [
      "justice",
      "leadership",
      "aggression",
      "protection",
    ] as Aspect[])
      expect(deckErrors("domino", a, deckCodes("domino", a))).toEqual([]);
    const s = newGame({
      heroId: "domino",
      aspect: "justice",
      villainId: "rhino",
    });
    expect(s.player.deck.length + s.player.hand.length).toBe(40);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "40066",
      "40067",
      "40068",
      "40069",
      "40069",
    ]);
    expect(maxHP(s)).toBe(9);
  });
  it("swaps the exact hand/top physical cards once per face and never triggers discard responses", () => {
    let s = base();
    const [a] = hand(s, "40038"),
      b = top(s, "40060");
    s = ability(s, "swap");
    s = choose(reload(s), a.id);
    expect(s.player.hand.map((p) => p.id)).toContain(b.id);
    expect(s.player.deck[0].id).toBe(a.id);
    expect(s.player.discard).toEqual([]);
    expect(
      dispatch(s, { type: "ABILITY", id: "identity", action: "swap" }).error,
    ).toBeTruthy();
    s.player.form = "alter";
    const c = s.player.deck.pop()!;
    s.player.discard.push(c);
    s = choose(ability(s, "swap"), b.id);
    expect(s.player.hand.map((p) => p.id)).toContain(c.id);
    expect(s.player.discard.at(-1)?.id).toBe(b.id);
  });
  it("counts printed wild twice only while unblanked hero and never alters payment icons", () => {
    const s = base();
    const w = makePiece(s, "40060"),
      j = makePiece(s, "40043");
    expect(dominoResources(s, w)).toEqual(["wild", "wild"]);
    expect(dominoResources(s, j)).toEqual(["energy", "mental", "physical"]);
    s.player.form = "alter";
    expect(dominoResources(s, w)).toEqual(["wild"]);
    s.player.form = "hero";
    put(s, "40065");
    expect(dominoResources(s, w)).toEqual(["wild"]);
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
  });
  it("Digging Deep and Painted Lady offer mutually exclusive physical destinations and survive reload", () => {
    let s = base();
    const lady = put(s, "40045"),
      d = top(s, "40060");
    s = native(s, { type: "mill", amount: 1 });
    expect(s.prompt?.title).toBe("After discarding from your deck");
    s = choose(reload(s), `lady:${lady.id}:${d.id}`);
    expect(
      s.player.inPlay
        .find((p) => p.id === lady.id)
        ?.storedCards?.map((p) => p.id),
    ).toEqual([d.id]);
    expect(s.player.hand.some((p) => p.id === d.id)).toBe(false);
    s.player.form = "alter";
    s = choose(ability(s, "painted-lady", lady.id), d.id);
    expect(s.player.hand.some((p) => p.id === d.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === lady.id)?.storedCards).toEqual(
      [],
    );
  });
  it("the last-card reset precedes Jackpot response and conserves the card", () => {
    let s = base();
    const j = top(s, "40043");
    s.player.hand.push(...s.player.deck.splice(1));
    s = native(s, { type: "mill", amount: 1 });
    expect(s.player.deck.map((p) => p.id)).toEqual([j.id]);
    s = finish(s);
    expect(s.prompt).toBeNull();
    expect(s.player.deck.map((p) => p.id)).toEqual([j.id]);
    expect(s.encounter.dealt.length).toBe(1);
  });
  it("White Fox enters once under discarding player's control, declines with a duplicate in play", () => {
    let s = base();
    const fox = top(s, "40057");
    s = choose(native(s, { type: "mill", amount: 1 }), `fox:${fox.id}`);
    s = finish(s);
    expect(s.player.inPlay.filter((p) => p.id === fox.id)).toHaveLength(1);
    const second = makePiece(s, "40057");
    s.player.deck.unshift(second);
    s = native(s, { type: "mill", amount: 1 });
    expect(s.prompt).toBeNull();
    expect(s.player.discard.some((p) => p.id === second.id)).toBe(true);
  });
  it("Pistol pays its mill cost, resolves Jackpot before Sharpshooter, and keeps printed ranged", () => {
    let s = base();
    const pistol = put(s, "40046"),
      sharp = put(s, "40064"),
      j = top(s, "40043");
    s = target(ability(s, "pistol", pistol.id), s.villain.id);
    expect(s.prompt?.title).toBe("After discarding from your deck");
    s = choose(s, `jackpot:${j.id}`);
    expect(s.prompt?.title).toBe("Sharpshooter");
    expect(s.player.deck.some((p) => p.id === j.id)).toBe(true);
    const before = s.villain.hp;
    s = choose(s, "continue");
    expect(s.villain.hp).toBe(before - 3);
    expect(s.player.inPlay.find((p) => p.id === pistol.id)?.exhausted).toBe(
      true,
    );
  });
  it("Diamondback finishes even when her damage cost defeats her", () => {
    let s = base();
    const diamond = put(s, "40038");
    diamond.damage = 1;
    top(s, "40040");
    const m = minion(s, "01103");
    s = finish(ability(s, "diamondback", diamond.id));
    expect(s.player.inPlay.some((p) => p.id === diamond.id)).toBe(false);
    expect(s.villain.hp).toBe(78);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(2);
  });
  it("Probability Field boosts one actual basic attack using discarded wild resources", () => {
    let s = base();
    const field = put(s, "40049");
    top(s, "40040");
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.title).toBe("Probability Field");
    s = choose(s, field.id);
    s = target(s, s.villain.id);
    expect(s.villain.hp).toBe(76);
    expect(s.player.exhausted).toBe(true);
  });
  it("Right Place Right Time counts Jackpot as3 and removes six threat", () => {
    let s = base();
    s = paid(s, "40042");
    const j = top(s, "40043");
    s = target(s, "main");
    s = choose(s, "continue");
    expect(s.scheme.threat).toBe(9);
    expect(s.player.discard.some((p) => p.id === j.id)).toBe(true);
  });
  it("Luck Be a Lady resolves each distinct Jackpot resource sequentially without attack/thwart labels", () => {
    let s = base();
    s.player.hp = 5;
    top(s, "40043");
    s = paid(s, "40041");
    s = choose(s, "continue");
    s = choose(s, "energy:hero");
    s = choose(s, "mental:main");
    s = choose(s, `physical:${s.villain.id}`);
    expect(s.player.hp).toBe(7);
    expect(s.villain.hp).toBe(77);
  });
  it("Memories blanks identity then clears through actual alter-ego exhaust action", () => {
    let s = base();
    const r = reveal(s, "40065");
    s = finish(r.s);
    expect(s.player.inPlay.some((p) => p.id === r.p.id)).toBe(true);
    expect(dominoResources(s, makePiece(s, "40060"))).toHaveLength(1);
    s.player.form = "alter";
    s = ability(s, "memories", r.p.id);
    expect(s.player.inPlay.some((p) => p.id === r.p.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === r.p.id)).toBe(true);
  });
  it("Topaz searches an actual set-aside Feedback, Prototype uses actual damage and nemesis recurs by surge", () => {
    let s = base();
    const r = reveal(s, "40066");
    s = finish(r.s);
    expect(s.attachments.filter((p) => p.code === "40069")).toHaveLength(1);
    expect(s.player.setAside?.filter((p) => p.code === "40069")).toHaveLength(
      1,
    );
    s.player.hp = 4;
    const r2 = reveal(s, "40068");
    s = finish(r2.s);
    const p = s.minions.find((p) => p.id === r2.p.id)!;
    expect(p.counters).toBe(5);
    expect(pieceHP(s, p)).toBe(6);
  });
  it("Feedback damages after identity action, never from doubled wild constant, and discards by identity card", () => {
    let s = base();
    const f = attach(s, "40069", "hero:p1");
    const [h] = hand(s, "40038");
    top(s, "40060");
    s = choose(ability(s, "swap"), h.id);
    expect(s.player.hp).toBe(8);
    expect(dominoResources(s, makePiece(s, "40060"))).toHaveLength(2);
    expect(s.player.hp).toBe(8);
    s.player.form = "alter";
    const [cost] = hand(s, "40040");
    s = choose(ability(s, "feedback", f.id), cost.id);
    expect(s.attachments.some((p) => p.id === f.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === cost.id)).toBe(true);
  });
  it("Take Out the Guards discards a non-Elite minion and preserves player scheme in victory", () => {
    let s = base();
    const m = minion(s, "01103"),
      p = side(s, "40054", 1);
    p.ownerId = "p1";
    s = native(s, {
      type: "thwart",
      target: p.id,
      amount: 1,
      action: true,
      source: "hero",
    });
    expect(s.prompt?.title).toBe("Take Out the Guards");
    s = choose(s, m.id);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.victoryDisplay?.some((q) => q.id === p.id)).toBe(true);
  });
  it("Superpower Training moves the selected original upgrade and shuffles after searching", () => {
    let s = base();
    const card = top(s, "40046"),
      p = side(s, "40059", 1);
    p.ownerId = "p1";
    s = native(s, {
      type: "thwart",
      target: p.id,
      amount: 1,
      action: true,
      source: "hero",
    });
    s = choose(s, card.id);
    expect(s.player.inPlay.some((p) => p.id === card.id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === card.id)).toBe(false);
    expect(s.victoryDisplay?.some((q) => q.id === p.id)).toBe(true);
  });
  it("Even the Odds and Overwatch exact reprints use their native physical printing", () => {
    let s = base();
    const p = side(s, "01107", 1);
    s = paid(s, "40052");
    s = finish(s);
    expect(s.sideSchemes.some((q) => q.id === p.id)).toBe(false);
    expect(s.villain.hp).toBe(79);
    const [over] = hand(s, "40055");
    s = command(s, { type: "PLAY", id: over.id });
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(true);
    s = choose(s, "main");
    expect(s.player.inPlay.find((p) => p.id === over.id)?.attachedTo).toBe(
      "main",
    );
  });
});
describe("Domino shared native interaction windows", () => {
  it("Outlaw optional discard adds to actual ATK and costs normal consequential damage", () => {
    let s = base();
    const ally = put(s, "40039");
    ally.tough = false;
    top(s, "40040");
    s = target(ability(s, "attack", ally.id), s.villain.id);
    expect(s.prompt?.title).toBe("Outlaw");
    s = finish(choose(s, "discard"));
    expect(s.villain.hp).toBe(77);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("Feral response resolves after thwarting and counts wilds on the actual discarded card", () => {
    let s = base();
    const ally = put(s, "40050");
    top(s, "40040");
    s = target(ability(s, "thwart", ally.id), "main");
    expect(s.prompt?.title).toBe("Feral");
    s = finish(choose(s, "yes"));
    expect(s.scheme.threat).toBe(13);
    expect(s.villain.hp).toBe(78);
  });
  it("Wolfsbane names before the hidden discard and recovers only its physical matching type", () => {
    let s = base();
    const ally = put(s, "40051"),
      event = top(s, "40040");
    s = target(ability(s, "thwart", ally.id), "main");
    s = choose(s, "yes");
    s = choose(s, "event");
    s = finish(choose(s, event.id));
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(false);
  });
  it("Atlas Bear looks at teammate's deck and gives the event to its actual owner", () => {
    let s = base(true);
    const bear = put(s, "40056"),
      event = top(s, "01005", "p2");
    s = ability(s, "atlas", bear.id);
    s = choose(s, "p2");
    s = choose(s, "take");
    s = finish(s);
    expect(seatView(s, "p2").player.hand.some((p) => p.id === event.id)).toBe(
      true,
    );
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === bear.id)?.damage).toBe(1);
  });
  it("Pip moves a physical Posse card from discard to top and exhausts", () => {
    let s = base();
    s.player.form = "alter";
    const pip = put(s, "40044"),
      fox = top(s, "40057");
    s.player.discard.push(s.player.deck.shift()!);
    s = choose(ability(s, "pip", pip.id), fox.id);
    expect(s.player.deck[0].id).toBe(fox.id);
    expect(s.player.inPlay.find((p) => p.id === pip.id)?.exhausted).toBe(true);
  });
  it("The Posse requires three controlled characters then heals and readies Posse across the team", () => {
    let s = base(true);
    const a = put(s, "40038"),
      b = put(s, "40039"),
      fox = put(s, "40057", "p2");
    a.damage = 1;
    a.exhausted = true;
    b.exhausted = true;
    fox.damage = 1;
    fox.exhausted = true;
    s.player.hp = 7;
    s.player.exhausted = true;
    s = finish(paid(s, "40058"));
    expect(s.player.hp).toBe(8);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === a.id)?.damage).toBe(0);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === fox.id)?.exhausted,
    ).toBe(false);
  });
  it("Probability Field boosts basic REC once and counts wild only once in alter-ego", () => {
    let s = base();
    const field = put(s, "40049");
    s.player.form = "alter";
    s.player.hp = 3;
    top(s, "40040");
    s = command(s, { type: "BASIC", action: "recover" });
    s = finish(choose(s, field.id));
    expect(s.player.hp).toBe(7);
    expect(s.player.exhausted).toBe(true);
  });
  it("Probability Field DEF survives attack-stat recalculation", () => {
    let s = base();
    const field = put(s, "40049");
    top(s, "40040");
    s.encounter.deck.unshift(makePiece(s, "37026"));
    s = native(s, { type: "enemyAttack", id: "villain" });
    s = choose(s, "hero");
    s = choose(s, field.id);
    s = finish(s);
    expect(s.player.hp).toBe(9);
  });
  it("Lucky and Good cancels both printed boost components, adds a replacement and exhausts", () => {
    let s = base();
    const lucky = put(s, "40047");
    const boost = makePiece(s, "37035"),
      replacement = makePiece(s, "01186");
    s.encounter.deck.unshift(boost, replacement);
    s = native(s, { type: "enemyAttack", id: "villain" });
    s = choose(s, "hero");
    expect(s.prompt?.title).toBe("Boost card revealed");
    s = choose(s, lucky.id);
    s = finish(s);
    expect(s.player.stunned).toBe(false);
    expect(s.player.confused).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === lucky.id)?.exhausted).toBe(
      true,
    );
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === replacement.id)).toBe(true);
  });
  it("Lucky Break cancels a physical encounter card and reveals one actual replacement", () => {
    let s = base();
    const lucky = put(s, "40048"),
      replacement = makePiece(s, "01103");
    s.encounter.deck.unshift(replacement);
    const original = makePiece(s, "01186");
    s = native(s, { type: "reveal", piece: original });
    s = choose(s, lucky.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(15);
    expect(s.minions.some((p) => p.id === replacement.id)).toBe(true);
    expect(
      s.encounter.discard.filter((p) => p.id === original.id),
    ).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === lucky.id)).toBe(true);
  });
  it("A Good Workout attacks two chosen enemies within one native attack scope", () => {
    let s = base();
    const m = minion(s, "01184");
    m.tough = false;
    top(s, "40038");
    s = paid(s, "40040");
    s = target(s, s.villain.id);
    s = target(s, m.id);
    s = finish(s);
    expect(s.villain.hp).toBe(76);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(2);
  });
  it("mill a cohort first, then order distinct responses without duplicating physical cards", () => {
    let s = base();
    const lady = put(s, "40045"),
      deep = top(s, "40060"),
      fox = top(s, "40057"),
      jackpot = top(s, "40043");
    s = native(s, { type: "mill", amount: 3 });
    expect(s.player.discard.map((p) => p.id)).toEqual([
      jackpot.id,
      fox.id,
      deep.id,
    ]);
    s = choose(s, `fox:${fox.id}`);
    s = choose(s, `digging:${deep.id}`);
    s = choose(s, `lady:${lady.id}:${jackpot.id}`);
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === fox.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === deep.id)).toBe(true);
    expect(
      s.player.inPlay
        .find((p) => p.id === lady.id)
        ?.storedCards?.map((p) => p.id),
    ).toEqual([jackpot.id]);
  });
});

it("FFG #92 resolves last Digging Deep from its actual reshuffled-deck ID", () => {
  let s = base();
  const p = top(s, "40060");
  s.player.hand.push(...s.player.deck.splice(1));
  s = native(s, { type: "mill", amount: 1 });
  expect(s.player.deck[0].id).toBe(p.id);
  expect(s.encounter.dealt).toHaveLength(1);
  s = choose(reload(s), `digging:${p.id}`);
  expect(s.player.hand.filter((c) => c.id === p.id)).toHaveLength(1);
  expect(s.player.deck.some((c) => c.id === p.id)).toBe(false);
});
it("Team Investigation uses Alliance across both actual owners and its per-player cost", () => {
  let s = base(true);
  const scheme = side(s, "01107", 8);
  const [event, energy] = hand(s, "40053", "40061");
  const p2 = seatView(s, "p2").player;
  const i = p2.deck.findIndex((p) => card(p).name === "Genius");
  const genius = p2.deck.splice(i, 1)[0];
  p2.hand.push(genius);
  s = command(s, { type: "PLAY", id: event.id });
  expect(s.prompt?.cost).toBe(4);
  s = command(s, { type: "PAY", ids: [energy.id, `alliance:p2:${genius.id}`] });
  s = target(s, scheme.id);
  s = finish(s);
  expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
  expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
  expect(seatView(s, "p2").player.discard.some((p) => p.id === genius.id)).toBe(
    true,
  );
});
