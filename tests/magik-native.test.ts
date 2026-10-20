import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sources from "../src/data/catalog-decks.json" with { type: "json" };
import { card, deckCodes, heroStats } from "../src/game/cards.js";
import { deckErrors } from "../src/game/decks.js";
import {
  cardCost,
  dispatch,
  newGame,
  makePiece,
  playable,
  paymentSources,
  abilityOptions,
} from "../src/game/engine.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { eventPlaySource, eventPlaySources } from "../src/game/card-text.js";
import { magikRevealedTop, magikTopPlayable } from "../src/game/magik.js";
import { fairClone, candidates } from "../src/game/lookahead.js";
import { activateSeat, seatView, syncSeat } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  hand,
  put,
  top,
  native,
  pay,
  target,
  reload,
  physical,
  minion,
  side,
  respond,
} from "./dv-test-helpers.js";

function launch(seed = 45037) {
  let s = newGame({
    heroId: "magik",
    aspect: "aggression",
    villainId: "rhino",
    seed,
    pacing: "expert",
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  return finish(s);
}
function base() {
  const s = launch();
  s.player.deck = physical(s);
  s.player.hand = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.player.form = "hero";
  s.player.exhausted = false;
  s.player.flipped = false;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.villain.hp = s.villain.maxHp = 90;
  s.scheme.threat = 15;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01186"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
function play(s: GameState, code: string, ...resources: string[]) {
  const [p, ...r] = hand(s, code, ...resources);
  return { p, s: pay(command(s, { type: "PLAY", id: p.id }), r) };
}
function reveal(s: GameState, code: string) {
  const p = makePiece(s, code);
  return { p, s: native(s, { type: "reveal", piece: p }) };
}
const names = (s: GameState) =>
  s.prompt?.options.map((o) => `${o.id}:${o.label}`).join("\n");

describe("Magik original source and native execution", () => {
  it("registers all30original faces and keeps the exact40-card Aggression source", () => {
    const faces = catalog.filter(
      (c) => c.pack_code === "aoa" && c.position >= 30 && c.position <= 58,
    );
    expect(faces).toHaveLength(30);
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    const src = sources.find((s) => s.heroCode === "45030a")!;
    expect(deckCodes("magik", "aggression").sort()).toEqual(
      Object.entries(src.cards)
        .flatMap(([code, n]) => Array(n).fill(code))
        .sort(),
    );
    const s = launch();
    expect(physical(s)).toHaveLength(40);
    expect(s.player.setAside?.map((p) => p.code)).toEqual([
      "45054",
      "45055",
      "45056",
      "45057",
      "45058",
    ]);
    for (const aspect of [
      "aggression",
      "justice",
      "leadership",
      "protection",
      "pool",
    ] as Aspect[])
      expect(
        deckErrors("magik", aspect, deckCodes("magik", aspect)),
        aspect,
      ).toEqual([]);
    expect(heroStats(s).recover).toBe(3);
  });
  it("launches the original source at seed45037 and plays its actual top Blood Rage for0", () => {
    let s = launch();
    expect(s.player.deck[0].code).toBe("45043");
    const ids = physical(s).map((p) => p.id),
      handIds = s.player.hand.map((p) => p.id),
      topId = s.player.deck[0].id,
      next = s.player.deck[1].id;
    s = command(s, { type: "FLIP" });
    expect(magikRevealedTop(s)?.id).toBe(topId);
    expect(cardCost(s, card(s.player.deck[0]), s.player.deck[0])).toBe(0);
    expect(candidates(s)).toContainEqual({ type: "PLAY", id: topId });
    s = command(s, { type: "PLAY", id: topId });
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === topId)).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual(handIds);
    expect(s.player.deck[0].id).toBe(next);
    expect(magikTopPlayable(s)).toBeUndefined();
    expect(magikRevealedTop(s)?.id).toBe(next);
    expect(reload(s)).toEqual(s);
    expect(
      physical(s)
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids.sort());
  });
  it("shows the next top before paid play and preserves the actual staged card across reload", () => {
    let s = base();
    const [r] = hand(s, "45047"),
      n = top(s, "45035"),
      p = top(s, "45033");
    s = command(s, { type: "PLAY", id: p.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(1);
    expect(s.prompt?.cancelable).toBe(false);
    const canceled = dispatch(reload(s), { type: "CANCEL" });
    expect(canceled.error).toMatch(/next card is already revealed/);
    expect(canceled.player.deck[0].id).toBe(n.id);
    expect(canceled.resolving.some((q) => q.id === p.id)).toBe(true);
    expect(s.resolving.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.player.deck[0].id).toBe(n.id);
    expect(magikTopPlayable(s)).toBeUndefined();
    s = pay(reload(s), [r]);
    s = finish(s);
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
    expect(s.resolving.some((q) => q.id === p.id)).toBe(false);
  });
  it("cannot spend the revealed top as a payment source or play a non-top deck card", () => {
    const s = base();
    const p = top(s, "45047"),
      other = s.player.deck[1];
    expect(paymentSources(s).some((q) => q.id === p.id)).toBe(false);
    expect(dispatch(s, { type: "PLAY", id: other.id }).error).toBeTruthy();
    expect(playable(s, p)).toMatch(/Spend/);
  });
  it("does not expose top cards or their constant resource bonuses in alter ego or while blanked", () => {
    let s = base();
    put(s, "45033");
    put(s, "45034");
    put(s, "45035");
    top(s, "45031");
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 2, defense: 3 });
    s.player.form = "alter";
    expect(magikRevealedTop(s)).toBeUndefined();
    s.player.form = "hero";
    s.flags["deadpoolRay:hero:p1"] = true;
    expect(magikRevealedTop(s)).toBeUndefined();
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 1, defense: 2 });
  });
  it("Crown grants two-card steady and loses its extra allowance when discarded", () => {
    let s = base();
    const crown = put(s, "45033");
    s = native(s, { type: "status", target: "hero", status: "stunned" });
    s = native(s, { type: "status", target: "hero", status: "stunned" });
    expect(s.player.stunCards).toBe(2);
    s = native(s, { type: "discardPiece", id: crown.id });
    expect(s.player.stunCards).toBe(1);
  });
  it("Illyana chooses an actual discarded Spell before changing form and survives reload", () => {
    let s = base();
    s.player.form = "alter";
    const p = top(s, "45039");
    s.player.deck.shift();
    s.player.discard.push(p);
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("alter");
    expect(s.prompt?.title).toBe("Illyana Rasputin");
    s = choose(reload(s), p.id);
    expect(s.player.form).toBe("hero");
    expect(s.player.deck[0].id).toBe(p.id);
    expect(s.player.flipped).toBe(true);
  });
  it("Limbo swaps exact physical cards without discarding and exhausts for the action", () => {
    let s = base();
    const limbo = put(s, "45032"),
      [h] = hand(s, "45038"),
      t = top(s, "45039");
    expect(abilityOptions(s, limbo).some((o) => o.id === "limbo")).toBe(true);
    s = command(s, { type: "ABILITY", id: limbo.id, action: "limbo" });
    s = choose(reload(s), h.id);
    expect(s.player.deck[0].id).toBe(h.id);
    expect(s.player.hand.some((p) => p.id === t.id)).toBe(true);
    expect(s.player.discard).toEqual([]);
    expect(s.player.inPlay.find((p) => p.id === limbo.id)?.exhausted).toBe(
      true,
    );
  });
  it("Scrying played from the top looks at the next three cards rather than itself", () => {
    let s = base();
    const a = top(s, "45038"),
      b = top(s, "45039"),
      c = top(s, "45045"),
      p = top(s, "45036");
    const before = physical(s)
      .map((p) => p.id)
      .sort();
    s = command(s, { type: "PLAY", id: p.id });
    s = choose(s, "draw");
    expect(names(s)).not.toContain(p.id);
    s = choose(s, a.id);
    s = choose(s, "discard");
    s = choose(s, b.id);
    s = choose(s, "top");
    s = choose(s, c.id);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === a.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === b.id)).toBe(true);
    expect(s.player.deck[0].id).toBe(c.id);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(
      physical(s)
        .map((p) => p.id)
        .sort(),
    ).toEqual(before);
  });
  it("Scrying with one remaining card lets the player select which instruction resolves", () => {
    let s = base();
    const [spell] = hand(s, "45036"),
      last = top(s, "45039");
    s.player.discard.push(...s.player.deck.filter((p) => p.id !== last.id));
    s.player.deck = [last];
    s = command(s, { type: "PLAY", id: spell.id });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "draw",
      "discard",
      "top",
    ]);
    s = choose(s, "top");
    s = choose(s, last.id);
    s = finish(s);
    expect(s.player.deck[0].id).toBe(last.id);
  });
  it("Stepping Disc readies and places an actual different Magik card on top", () => {
    let s = base();
    s.player.exhausted = true;
    const a = top(s, "45039");
    s.player.deck.shift();
    s.player.discard.push(a);
    ({ s } = play(s, "45037", "45047"));
    expect(s.player.exhausted).toBe(false);
    expect(s.prompt?.title).toBe("Stepping Disc");
    expect(names(s)).not.toContain("45037");
    s = choose(s, a.id);
    s = finish(s);
    expect(s.player.deck[0].id).toBe(a.id);
  });
  it("Exorcism uses the newly revealed top and confuses only from mental or wild", () => {
    let s = base();
    const [r] = hand(s, "45047"),
      n = top(s, "45039"),
      p = top(s, "45038");
    s = pay(command(s, { type: "PLAY", id: p.id }), [r]);
    s = target(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(11);
    expect(s.villain.confused).toBe(true);
    expect(s.player.deck[0].id).toBe(n.id);
  });
  it("Soul Strike deals an ordinary attack and stuns from the next physical top", () => {
    let s = base();
    const [r] = hand(s, "45047");
    top(s, "45034");
    const p = top(s, "45039");
    s = pay(command(s, { type: "PLAY", id: p.id }), [r]);
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(86);
    expect(s.villain.stunned).toBe(true);
  });
  it("a stunned Soul Strike is still played but its damage and conditional stun are canceled", () => {
    let s = base();
    s = native(s, { type: "status", target: "hero", status: "stunned" });
    top(s, "45034");
    ({ s } = play(s, "45039", "45047", "45048"));
    s = finish(s);
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(90);
    expect(s.villain.stunned).toBe(false);
  });
  it("Bloodgem exhausts and takes the full two-damage cost, with no source while Tough", () => {
    let s = base();
    const gem = put(s, "45050"),
      [p] = hand(s, "45037");
    s.player.exhausted = true;
    expect(paymentSources(s).find((p) => p.id === gem.id)?.resources).toEqual([
      "wild",
    ]);
    s = command(s, { type: "PLAY", id: p.id });
    s = pay(s, [], undefined, [gem.id]);
    s = finish(s);
    expect(s.player.hp).toBe(8);
    expect(s.player.inPlay.find((p) => p.id === gem.id)?.exhausted).toBe(true);
    const t = base(),
      g = put(t, "45050");
    t.player.tough = true;
    expect(paymentSources(t).some((p) => p.id === g.id)).toBe(false);
  });
  it("Basic Spell offers unlabelled damage, threat or identity healing", () => {
    let s = base();
    s.player.hp = 4;
    ({ s } = play(s, "45051", "45047", "45041"));
    s = choose(s, "heal");
    s = target(s, "hero:p1");
    s = finish(s);
    expect(s.player.hp).toBe(7);
    let t = base();
    t = native(t, { type: "status", target: "hero", status: "stunned" });
    ({ s: t } = play(t, "45051", "45047", "45041"));
    t = choose(t, "damage");
    t = target(t, t.villain.id);
    t = finish(t);
    expect(t.villain.hp).toBe(87);
    expect(t.player.stunned).toBe(true);
  });
  it("Spiritual Meditation preserves original printing while drawing two and discarding a hand card", () => {
    let s = base();
    const a = top(s, "45038"),
      b = top(s, "45039");
    const { p, s: played } = play(s, "45052");
    s = played;
    expect(s.player.hand.some((p) => p.id === a.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === b.id)).toBe(true);
    s = choose(s, a.id);
    s = finish(s);
    expect(s.player.discard.find((q) => q.id === p.id)?.code).toBe("45052");
  });
  it("Clobber returns its actual first-played printing, including top-deck play", () => {
    let s = base();
    const [r] = hand(s, "45047"),
      p = top(s, "45046");
    s = pay(command(s, { type: "PLAY", id: p.id }), [r]);
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(87);
    expect(s.player.hand.some((q) => q.id === p.id && q.code === "45046")).toBe(
      true,
    );
  });
  it("Goldballs fixes the chosen mill count before discarding and gains exactly that much ATK", () => {
    let s = base();
    const p = put(s, "45041");
    s = command(s, { type: "ABILITY", id: p.id, action: "attack" });
    s = target(s, s.villain.id);
    expect(s.prompt?.title).toBe("Goldballs");
    s = choose(s, "3");
    s = finish(s);
    expect(s.villain.hp).toBe(86);
    expect(s.player.discard).toHaveLength(3);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
  });
  it("Tempus cancels the villain activation before any boost is dealt and gives its controller an encounter", () => {
    let s = base();
    const p = put(s, "45042");
    s.player.form = "alter";
    const deck = s.encounter.deck.length;
    s = native(s, { type: "enemyScheme", id: s.villain.id });
    expect(s.prompt?.title).toBe("Villain would activate");
    const o = s.prompt!.options.find((o) => o.image === "45042")!;
    expect(o, names(s)).toBeTruthy();
    s = choose(s, o.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(15);
    expect(s.encounter.deck).toHaveLength(deck - 1);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Triage enters through normal play and heals an actual X-Men character", () => {
    let s = base();
    s.player.hp = 5;
    ({ s } = play(s, "45048", "45047", "45041"));
    s = respond(s, /Triage/);
    s = target(s, "hero:p1");
    s = finish(s);
    expect(s.player.hp).toBe(7);
  });
  it("Stepford Cuckoos uses its physical counter, cancels only the treachery and reveals a replacement", () => {
    let s = base();
    const p = put(s, "45049");
    p.counters = 3;
    ({ s } = reveal(s, "01187"));
    const o = s.prompt!.options.find((o) => o.image === "45049")!;
    expect(o, names(s)).toBeTruthy();
    s = choose(reload(s), o.id);
    s = finish(s);
    expect(s.player.inPlay.find((q) => q.id === p.id)).toMatchObject({
      counters: 2,
      exhausted: true,
    });
    expect(s.encounter.discard.some((p) => p.code === "01187")).toBe(true);
  });
  it("Ruler of Limbo captures the original support, blocks threat while Belasco lives, then returns Limbo", () => {
    let s = base();
    const limbo = put(s, "45032"),
      b = minion(s, "45054");
    let ruler: Piece;
    ({ p: ruler, s } = reveal(s, "45055"));
    s = finish(s);
    expect(
      s.sideSchemes
        .find((p) => p.id === ruler.id)
        ?.storedCards?.map((p) => p.id),
    ).toContain(limbo.id);
    expect(s.player.inPlay.some((p) => p.id === limbo.id)).toBe(false);
    const before = s.sideSchemes.find((p) => p.id === ruler.id)!.counters;
    s = native(s, {
      type: "thwart",
      target: ruler.id,
      amount: 9,
      source: "hero",
    });
    expect(s.sideSchemes.find((p) => p.id === ruler.id)?.counters).toBe(before);
    s = native(s, { type: "damage", target: b.id, amount: 8, source: "hero" });
    s = finish(s);
    s = native(s, {
      type: "thwart",
      target: ruler.id,
      amount: 9,
      source: "hero",
    });
    s = finish(s);
    expect(s.player.inPlay.filter((p) => p.id === limbo.id)).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.id === ruler.id)).toBe(true);
  });
  it("Belasco mills three actual cards and attaches them to Ruler after activating", () => {
    let s = base();
    const b = minion(s, "45054"),
      r = side(s, "45055", 3);
    const ids = s.player.deck.slice(0, 3).map((p) => p.id);
    s.player.form = "alter";
    s.scheme.threat = 0;
    s = native(s, { type: "enemyScheme", id: b.id });
    s = finish(s);
    expect(
      s.sideSchemes.find((p) => p.id === r.id)?.storedCards?.map((p) => p.id),
    ).toEqual(ids);
    expect(s.player.discard.some((p) => ids.includes(p.id))).toBe(false);
  });
  it("Darkchilde removes its own physical obligation after exhausting Illyana", () => {
    let s = base();
    let p: Piece;
    ({ p, s } = reveal(s, "45053"));
    s = choose(s, "alter");
    s = choose(s, "remove");
    s = finish(s);
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((q) => q.id === p.id)).toBe(true);
  });
  it("Shadows moves the five exact owned nemesis instances rather than creating replacements", () => {
    let s = base();
    const ids = s.player.setAside!.map((p) => p.id).sort();
    ({ s } = reveal(s, "01190"));
    s = finish(s);
    const all = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.encounter.deck,
      ...s.encounter.discard,
    ];
    expect(ids.map((id) => all.filter((p) => p.id === id).length)).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect(s.player.setAside).toEqual([]);
  });
  it("fair sampling retains only the currently public Magik top and hides it again when blanked", () => {
    const s = base();
    const p = top(s, "45038");
    syncSeat(s);
    const a = fairClone(s, () => 0.17),
      b = fairClone(s, () => 0.77);
    expect(a.player.deck[0].id).toBe(p.id);
    expect(b.player.deck[0].id).toBe(p.id);
    expect(a.player.deck.slice(1).map((p) => p.id)).not.toEqual(
      b.player.deck.slice(1).map((p) => p.id),
    );
    s.flags["deadpoolRay:hero:p1"] = true;
    syncSeat(s);
    expect(fairClone(s, () => 0.17).player.deck[0].id).not.toBe(p.id);
  });
  it("once per phase applies across top swaps and refreshes for the villain phase", () => {
    let s = base();
    const [h] = hand(s, "45035"),
      limbo = put(s, "45032"),
      p = top(s, "45043");
    s = finish(command(s, { type: "PLAY", id: p.id }));
    s = command(s, { type: "ABILITY", id: limbo.id, action: "limbo" });
    s = choose(s, h.id);
    expect(s.player.deck[0].id).toBe(h.id);
    expect(magikTopPlayable(s)).toBeUndefined();
    s.phase = "villain";
    expect(magikTopPlayable(s)?.id).toBe(h.id);
  });
  it("top-card cost reduction makes a zero-hand support playable without phantom resources", () => {
    let s = base();
    s.player.hand = [];
    const p = top(s, "45035");
    expect(playable(s, p)).toBeNull();
    s = finish(command(s, { type: "PLAY", id: p.id }));
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
  });
  it("cannot cancel after revealing the next top, while ordinary hand payments remain cancelable", () => {
    let s = base();
    const [r] = hand(s, "45047"),
      p = top(s, "45033"),
      next = s.player.deck[1].id;
    s = command(s, { type: "PLAY", id: p.id });
    expect(s.prompt?.cancelable).toBe(false);
    const blocked = dispatch(reload(s), { type: "CANCEL" });
    expect(blocked.error).toMatch(/finish playing this card/);
    expect(blocked.player.deck[0].id).toBe(next);
    expect(blocked.resolving.filter((q) => q.id === p.id)).toHaveLength(1);
    s = finish(pay(reload(s), [r]));
    expect(magikTopPlayable(s)).toBeUndefined();
    let t = base();
    const [c] = hand(t, "45033", "45047", "45048");
    t = command(t, { type: "PLAY", id: c.id });
    expect(t.prompt?.cancelable).toBe(true);
    t = command(t, { type: "CANCEL" });
    expect(t.player.hand.some((p) => p.id === c.id)).toBe(true);
  });
  it("Team-Building Exercise stacks its own discount with Magik and consumes one top play", () => {
    let s = base();
    const tbe = put(s, "12024"),
      [r] = hand(s, "45047"),
      p = top(s, "45031");
    s = command(s, { type: "ABILITY", id: tbe.id, action: "team-building" });
    expect(
      s.prompt?.options.some((o) => o.id === p.id),
      names(s),
    ).toBe(true);
    s = choose(s, p.id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(1);
    expect(s.prompt?.cancelable).toBe(false);
    s = finish(pay(s, [r]));
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
    expect(magikTopPlayable(s)).toBeUndefined();
    expect(s.player.inPlay.find((q) => q.id === tbe.id)?.exhausted).toBe(true);
  });
  it("top-played Pixie receives after-play-from-hand text without exposing the next ally as physically in hand", () => {
    let s = base();
    const [r] = hand(s, "45047"),
      ally = top(s, "45048");
    s.player.deck.shift();
    s.player.discard.push(ally);
    const p = top(s, "36017");
    s = pay(command(s, { type: "PLAY", id: p.id }), [r]);
    s = respond(s, /Pixie/);
    s = target(s, ally.id);
    s = finish(s);
    expect(s.player.hand.some((q) => q.id === ally.id)).toBe(true);
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
  });
  it("top Colossus interrupts an attack in villain phase and defends ready with his actual Tough card", () => {
    let s = base();
    const [r, a] = hand(s, "45047", "45048"),
      p = top(s, "45031");
    s.phase = "villain";
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Play Colossus/);
    expect(s.prompt?.cost).toBe(2);
    s = pay(reload(s), [r, a]);
    s = finish(s);
    const colossus = s.player.inPlay.find((q) => q.id === p.id);
    expect(colossus).toBeTruthy();
    expect(colossus!.exhausted).toBe(false);
    expect(colossus!.damage).toBe(0);
    expect(colossus!.tough).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(magikTopPlayable(s)).toBeUndefined();
  });
  it("top Magic Barrier prevents3 and checks the newly revealed energy before damaging its attacker", () => {
    let s = base();
    s.encounter.deck.unshift(makePiece(s, "01103"));
    top(s, "45035");
    const p = top(s, "45040");
    s.phase = "villain";
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Magic Barrier/);
    s = finish(s);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.villain.hp).toBe(87);
    expect(s.player.hp).toBe(9);
    expect(magikTopPlayable(s)).toBeUndefined();
  });
  it("Soulsword pierces a basic attack but grants no piercing to a later Soul Strike", () => {
    let s = base();
    put(s, "45034");
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBeLessThan(90);
    expect(s.villain.tough).toBe(false);
    s.villain.hp = 90;
    s.villain.tough = true;
    s.villain.toughCards = 1;
    ({ s } = play(s, "45039", "45047", "45048"));
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(90);
    expect(s.villain.tough).toBe(false);
  });
  it("Mystical Armor retaliates against a surviving attacker after its attack", () => {
    let s = base();
    put(s, "45035");
    s.scheme.threat = 0;
    const m = minion(s, "01103");
    s = native(s, { type: "enemyAttack", id: m.id });
    s = finish(s);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(1);
  });
  it("Blood Rage responds only after a basic defeat and pays before drawing", () => {
    let s = base();
    const rage = put(s, "45043"),
      m = minion(s, "01103", s.activePlayerId, card("01103").health! - 1),
      d = s.player.deck[0].id;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, m.id);
    s = respond(s, /Blood Rage/);
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.player.hand.some((p) => p.id === d)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === rage.id)?.exhausted).toBe(true);
  });
  it("Test the Defense counts a played Attack event even when Stunned cancels that attack", () => {
    let s = base();
    const test = put(s, "45044");
    test.counters = 4;
    s = native(s, { type: "status", target: "hero", status: "stunned" });
    ({ s } = play(s, "45039", "45047", "45048"));
    s = respond(s, /Test the Defense/);
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(85);
    expect(s.player.inPlay.some((p) => p.id === test.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === test.id)).toBe(true);
  });
  it("Full-Body Charge gains overkill only below half the hero's starting HP", () => {
    let s = base();
    s.player.hp = 4;
    const m = minion(s, "01103", s.activePlayerId, card("01103").health! - 1);
    ({ s } = play(s, "45045", "45047", "45047"));
    s = target(s, m.id);
    s = finish(s);
    expect(s.villain.hp).toBe(83);
    let t = base();
    t.player.hp = 5;
    const n = minion(t, "01103", t.activePlayerId, card("01103").health! - 1);
    ({ s: t } = play(t, "45045", "45047", "45047"));
    t = target(t, n.id);
    t = finish(t);
    expect(t.villain.hp).toBe(90);
  });
  it("S'ym and the Battle for Limbo boost use Ruler, otherwise the printed main-scheme fallback", () => {
    let s = base();
    s.scheme.threat = 0;
    const r = side(s, "45055", 3);
    ({ s } = reveal(s, "45056"));
    s = finish(s);
    expect(s.sideSchemes.find((p) => p.id === r.id)?.counters).toBe(5);
    s = native(s, { type: "boostEffect", piece: makePiece(s, "45058") });
    s = finish(s);
    expect(s.sideSchemes.find((p) => p.id === r.id)?.counters).toBe(7);
  });
  it("Blood Rage does not respond to a controlled ally's basic defeat", () => {
    let s = base();
    put(s, "45043");
    const ally = put(s, "45031"),
      m = minion(s, "01103", s.activePlayerId, 2);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, m.id);
    expect(s.prompt?.title).not.toBe("Blood Rage");
    s = finish(s);
    expect(s.player.hp).toBe(10);
  });
  it("Blood Rage responds to a non-final villain-stage defeat by the identity's basic attack", () => {
    let s = base();
    put(s, "45043");
    s.villain.hp = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    s = respond(s, /Blood Rage/);
    s = finish(s);
    expect(s.villain.stage).toBe(2);
    expect(s.player.hp).toBe(9);
  });
  it("blanking Magik hides top icons while her unblanked upgrades still grant steady, piercing and retaliate", () => {
    let s = base();
    put(s, "45033");
    put(s, "45034");
    put(s, "45035");
    top(s, "45031");
    s.flags["deadpoolRay:hero:p1"] = true;
    expect(magikRevealedTop(s)).toBeUndefined();
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 1, defense: 2 });
    s = native(
      s,
      { type: "status", target: "hero", status: "stunned" },
      { type: "status", target: "hero", status: "stunned" },
    );
    expect(s.player.stunCards).toBe(2);
    s.player.stunned = false;
    s.player.stunCards = 0;
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(88);
    const m = minion(s, "01103");
    s = native(s, { type: "enemyAttack", id: m.id });
    s = finish(s);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(1);
  });
  it("Limbo offers its actual beginning-of-villain-phase response after readying", () => {
    let s = base();
    s.scheme.threat = 0;
    const limbo = put(s, "45032");
    limbo.exhausted = true;
    const [h] = hand(s, "45038");
    s = command(s, { type: "END_TURN", discard: [] });
    s = respond(s, /Limbo/);
    expect(s.prompt?.title).toBe("Limbo");
    s = choose(reload(s), h.id);
    expect(s.player.deck[0].id).toBe(h.id);
    expect(s.player.inPlay.find((p) => p.id === limbo.id)?.exhausted).toBe(
      true,
    );
  });
  it("Battle for Limbo surges if every attempted activation was replaced by Stunned", () => {
    let s = base();
    const a = minion(s, "45054"),
      b = minion(s, "45057");
    a.stunned = b.stunned = true;
    a.stunCards = b.stunCards = 1;
    const extra = makePiece(s, "01101");
    s.encounter.deck.unshift(extra);
    ({ s } = reveal(s, "45058"));
    s = finish(s);
    expect(s.minions.find((p) => p.id === a.id)?.stunned).toBe(false);
    expect(s.minions.find((p) => p.id === b.id)?.stunned).toBe(false);
    expect(s.encounter.dealt.some((p) => p.id === extra.id)).toBe(true);
    expect(s.player.hp).toBe(10);
  });
  it("Battle for Limbo does not surge once one Limbo minion completes its activation", () => {
    let s = base();
    const a = minion(s, "45054"),
      b = minion(s, "45057");
    a.stunned = true;
    a.stunCards = 1;
    const extra = makePiece(s, "01101");
    s.encounter.deck.unshift(extra);
    ({ s } = reveal(s, "45058"));
    s = finish(s);
    expect(s.player.hp).toBe(7);
    expect(s.encounter.deck[0].id).toBe(extra.id);
    expect(s.minions.some((p) => p.id === b.id)).toBe(true);
  });
  it("original paid source seed45052 stages Crown, reveals Barrier and spends the actual Colossus", () => {
    let s = launch(45052);
    s = command(s, { type: "FLIP" });
    const p = s.player.deck[0],
      next = s.player.deck[1],
      payment = s.player.hand.find((q) => q.code === "45031")!;
    expect(p.code).toBe("45033");
    expect(next.code).toBe("45040");
    expect(payment).toBeTruthy();
    const ids = physical(s)
        .map((p) => p.id)
        .sort(),
      beforeHand = s.player.hand.map((p) => p.id);
    s = command(s, { type: "PLAY", id: p.id });
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 1,
      cancelable: false,
    });
    expect(s.player.deck[0].id).toBe(next.id);
    expect(s.player.hand.map((p) => p.id)).toEqual(beforeHand);
    expect(
      physical(reload(s))
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids);
    s = finish(pay(reload(s), [payment]));
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === payment.id)).toBe(true);
    expect(
      physical(s)
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids);
  });
  it("playing the actual last top card immediately recycles its old discard and deals one encounter", () => {
    let s = base();
    const p = top(s, "45043"),
      ids = physical(s)
        .map((p) => p.id)
        .sort();
    s.player.discard.push(...s.player.deck.filter((q) => q.id !== p.id));
    s.player.deck = [p];
    s = finish(command(s, { type: "PLAY", id: p.id }));
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.deck).toHaveLength(39);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(
      physical(s)
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids);
  });
  it("a last-top Scrying is legal after immediate recycling and looks at the newly shuffled deck", () => {
    let s = base();
    const p = top(s, "45036");
    s.player.discard.push(...s.player.deck.filter((q) => q.id !== p.id));
    s.player.deck = [p];
    expect(playable(s, p)).toBeNull();
    s = command(s, { type: "PLAY", id: p.id });
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.deck).toHaveLength(39);
    s = choose(s, "draw");
    s = choose(s, s.prompt!.options[0].id);
    s = choose(s, "discard");
    s = choose(s, s.prompt!.options[0].id);
    s = choose(s, "top");
    s = choose(s, s.prompt!.options[0].id);
    s = finish(s);
    expect(physical(s)).toHaveLength(40);
    expect(s.player.deck).toHaveLength(37);
  });
  it("Belasco retains the discarded physical references even when exhausting the player's deck reshuffles them", () => {
    let s = base();
    const b = minion(s, "45054"),
      r = side(s, "45055", 3),
      cards = s.player.deck.splice(0, 3);
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck = cards;
    s.player.form = "alter";
    s.scheme.threat = 0;
    s = native(s, { type: "enemyScheme", id: b.id });
    s = finish(s);
    expect(
      s.sideSchemes.find((p) => p.id === r.id)?.storedCards?.map((p) => p.id),
    ).toEqual(cards.map((p) => p.id));
    expect(s.encounter.dealt).toHaveLength(1);
    for (const p of cards)
      expect(
        [...s.player.deck, ...s.player.discard].some((q) => q.id === p.id),
      ).toBe(false);
  });
  it("Illyana's interrupt and Limbo's phase response each resolve Superpower Feedback exactly once", () => {
    let s = base();
    const f = makePiece(s, "40069");
    f.attachedTo = "hero:p1";
    s.attachments.push(f);
    s.player.form = "alter";
    const spell = top(s, "45039");
    s.player.deck.shift();
    s.player.discard.push(spell);
    s = command(s, { type: "FLIP" });
    s = choose(s, spell.id);
    s = finish(s);
    expect(s.player.hp).toBe(9);
    const limbo = put(s, "45032"),
      [h] = hand(s, "45038");
    s = native(s, { type: "magik:limbo-window", id: limbo.id });
    s = respond(s, /Limbo/);
    s = choose(s, h.id);
    s = finish(s);
    expect(s.player.hp).toBe(8);
  });
  it("Colossus's hand-play defense interrupt resolves Superpower Feedback once before protecting Magik", () => {
    let s = base();
    const f = makePiece(s, "40069");
    f.attachedTo = "hero:p1";
    s.attachments.push(f);
    const [p, r, a, b] = hand(s, "45031", "45047", "45048", "45041");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Play Colossus/);
    s = finish(pay(s, [r, a, b]));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(0);
  });
  it("plays Emergency from the faceup top during an enemy scheme", () => {
    let s = base();
    s.scheme.threat = 0;
    const p = top(s, "01085");
    s.phase = "villain";
    s = native(s, { type: "enemyScheme", id: s.villain.id });
    s = finish(respond(s, /Emergency/));
    expect(s.scheme.threat).toBe(0);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(magikTopPlayable(s)).toBeUndefined();
  });
  it("plays Defiance from the faceup top in a facedown boost window", () => {
    let s = base();
    const p = top(s, "26018"),
      boost = makePiece(s, "01103");
    s.encounter.deck.unshift(boost);
    s.phase = "villain";
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = finish(respond(s, /Defiance/));
    expect(s.player.hp).toBe(8);
    expect(s.encounter.discard.some((q) => q.id === boost.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(magikTopPlayable(s)).toBeUndefined();
  });
  it("validates a staged event by owned physical ID without offering it as a new play", () => {
    let s = base();
    hand(s, "45048");
    const p = top(s, "45039");
    expect(eventPlaySource(s, p.id)?.id).toBe(p.id);
    s = command(s, { type: "PLAY", id: p.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(eventPlaySource(reload(s), p.id)?.id).toBe(p.id);
    expect(eventPlaySources(s).some((q) => q.id === p.id)).toBe(false);
    const foreign = reload(s);
    foreign.resolving.find((q) => q.id === p.id)!.ownerId = "p2";
    expect(eventPlaySource(foreign, p.id)).toBeUndefined();
    const stale = reload(s);
    stale.phase = "villain";
    expect(eventPlaySource(stale, p.id)).toBeUndefined();
    expect(cardCost(stale, card(p), p)).toBe(2);
  });
  it("plays top Mean Swing for its actual Weapon cost and refreshes Soulsword's changing ATK", () => {
    let s = base();
    const sword = put(s, "45034");
    top(s, "45039");
    const p = top(s, "06015"),
      hp = s.villain.hp;
    expect(heroStats(s).attack).toBe(3);
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, p.id);
    s = finish(choose(reload(s), sword.id));
    expect(s.villain.hp).toBe(hp - 5);
    expect(heroStats(s).attack).toBe(2);
    expect(s.player.inPlay.find((q) => q.id === sword.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it.each(["06032", "33017"])(
    "plays top Teamwork %s during a basic thwart and refreshes Crown's THW",
    (code) => {
      let s = base();
      put(s, "45033");
      const ally = put(s, "45031");
      top(s, "45039");
      const p = top(s, code);
      s.scheme.threat = 6;
      expect(heroStats(s).thwart).toBe(1);
      s = command(s, { type: "BASIC", action: "thwart" });
      s = choose(s, p.id);
      s = finish(choose(reload(s), ally.id));
      expect(s.scheme.threat).toBe(2);
      expect(heroStats(s).thwart).toBe(2);
      expect(s.player.inPlay.find((q) => q.id === ally.id)).toMatchObject({
        exhausted: true,
        damage: 0,
      });
      expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    },
  );
  it("plays top Skilled Strike without spending the hidden next top as a resource", () => {
    let s = base();
    const p = top(s, "09037"),
      hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(choose(s, p.id));
    expect(s.villain.hp).toBe(hp - 4);
    expect(s.player.hand).toEqual([]);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
});
