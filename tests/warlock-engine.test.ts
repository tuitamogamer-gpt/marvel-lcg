/** Native Adam Warlock tests use the original forty-card deck and physical nemesis. */
import { describe, expect, it } from "vitest";
import { card, heroStats } from "../src/game/cards.js";
import { deckErrors } from "../src/game/decks.js";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView, upgradeSave } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  conserved,
  encounterConserved,
  finish,
  hand,
  native,
  pay,
  physical,
  play,
  put,
  reload,
  respond,
  target,
  top,
} from "./dv-test-helpers.js";

function start(other = false) {
  return newGame({
    heroId: "warlock",
    aspect: "aggression",
    villainId: "rhino",
    seed: 21031,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            { heroId: "warlock", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
}
function base(other = false) {
  let s = start(other);
  for (let i = 0; i < s.players.length; i++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat),
      source = physical(s, seat.id);
    expect(source).toHaveLength(40);
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.deck = source;
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.flipped = false;
    v.flags.warlockDeckEmptyObserved = false;
    source.forEach((p) => {
      p.ownerId = seat.id;
    });
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.scheme.threat = 10;
  s.villain.hp = s.villain.maxHp = 50;
  (s as GameState & { dvSourceIds: Record<string, string[]> }).dvSourceIds =
    Object.fromEntries(
      s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
    );
  return s;
}
function nemesis(s: GameState, code: string) {
  const zone = s.player.setAside!,
    i = zone.findIndex((p) => p.code === code);
  expect(i).toBeGreaterThanOrEqual(0);
  return zone.splice(i, 1)[0];
}
function church(s: GameState, counters = 4) {
  const p = nemesis(s, "21068");
  p.counters = counters;
  s.sideSchemes.push(p);
  return p;
}
function mage(s: GameState, p: Piece) {
  return choose(
    command(s, { type: "ABILITY", id: "hero", action: "battle-mage" }),
    p.id,
  );
}
function revealPhysical(s: GameState, code: string) {
  const p =
    code === "21066"
      ? s.encounter.deck.splice(
          s.encounter.deck.findIndex((p) => p.code === code),
          1,
        )[0]
      : nemesis(s, code);
  expect(p).toBeTruthy();
  return { s: native(s, { type: "reveal", piece: p }), p };
}

describe("Adam Warlock native source and saved physical zones", () => {
  it("uses the original equal four-aspect singleton forty with five separate nemesis IDs", () => {
    const s = start(),
      codes = heroStarterCodes("warlock");
    expect(codes).toHaveLength(40);
    expect(deckErrors("warlock", "aggression", codes)).toEqual([]);
    for (const color of ["aggression", "justice", "leadership", "protection"])
      expect(
        codes.filter((c) => card({ code: c } as Piece).faction_code === color),
      ).toHaveLength(6);
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "21067",
      "21068",
      "21069",
      "21069",
      "21070",
    ]);
    expect(
      new Set([...physical(s), ...s.player.setAside!].map((p) => p.id)).size,
    ).toBe(45);
    expect(s.player.hp).toBe(11);
    expect(s.encounter.deck.filter((p) => p.code === "21066")).toHaveLength(1);
    const ids = s.player.setAside!.map((p) => p.id),
      nextId = s.nextId;
    const loaded = upgradeSave(reload(s));
    expect(loaded.player.setAside?.map((p) => p.id)).toEqual(ids);
    expect(loaded.nextId).toBe(nextId);
  });
  it("never replenishes an existing empty set-aside zone and migrates missing zones with unique root IDs", () => {
    const s = start(true),
      set = s.player.setAside!;
    s.encounter.discard.push(...set);
    s.player.setAside = [];
    expect(upgradeSave(reload(s)).player.setAside).toEqual([]);
    for (const seat of s.players) delete seatView(s, seat).player.setAside;
    const migrated = upgradeSave(reload(s)),
      pieces = migrated.players.flatMap(
        (seat) => seatView(migrated, seat).player.setAside || [],
      );
    expect(pieces).toHaveLength(5);
    expect(
      new Set(
        [
          ...physical(migrated, "p1"),
          ...physical(migrated, "p2"),
          ...pieces,
        ].map((p) => p.id),
      ).size,
    ).toBe(85);
    expect(upgradeSave(reload(migrated)).nextId).toBe(migrated.nextId);
  });
});

describe("Battle Mage and actual identity costs", () => {
  it("discards a Basic card, then permits both physical Senses and Cape in chosen order after reload", () => {
    let s = base();
    const a = put(s, "21037"),
      b = put(s, "21037"),
      cape = put(s, "21035"),
      [basic] = hand(s, "21065");
    s.player.exhausted = true;
    const draws = s.player.deck.slice(0, 2).map((p) => p.id);
    s = mage(s, basic);
    expect(s.player.discard.some((p) => p.id === basic.id)).toBe(true);
    s = choose(reload(s), b.id);
    s = choose(reload(s), cape.id);
    s = choose(reload(s), a.id);
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual(draws);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === cape.id)?.exhausted).toBe(true);
    expect(s.flags.warlockMagePhase).toBe(`${s.round}:${s.phase}`);
    const again = dispatch(reload(s), {
      type: "ABILITY",
      id: "hero",
      action: "battle-mage",
    });
    expect(again.error).toBeTruthy();
    conserved(s, [basic, a, b, cape]);
  });
  it("a signature discard still resolves Battle Mage and Mystic Senses without an intrinsic aspect effect", () => {
    let s = base();
    const senses = put(s, "21037"),
      [signature] = hand(s, "21040");
    s = finish(choose(mage(s, signature), senses.id));
    expect(s.villain.hp).toBe(50);
    expect(s.scheme.threat).toBe(10);
    expect(s.player.hand).toHaveLength(1);
    conserved(s, [senses, signature]);
  });
  it("Aggression is nonattack damage and neither Guard nor Stun replaces it", () => {
    let s = base();
    s.player.stunned = true;
    const guard = makePiece(s, "01101");
    guard.engagedWith = "p1";
    s.minions.push(guard);
    const [p] = hand(s, "21044");
    s = finish(target(mage(s, p), "villain"));
    expect(s.villain.hp).toBe(48);
    expect(s.player.stunned).toBe(true);
  });
  it("Justice removes two without consuming Confuse", () => {
    let s = base();
    s.player.confused = true;
    const [p] = hand(s, "21049");
    s = finish(target(mage(s, p), "main"));
    expect(s.scheme.threat).toBe(8);
    expect(s.player.confused).toBe(true);
  });
  it("Protection heals an actual ally controlled by another player", () => {
    let s = base(true);
    const pip = put(s, "21032");
    s.player.inPlay.splice(s.player.inPlay.indexOf(pip), 1);
    seatView(s, "p2").player.inPlay.push(pip);
    pip.damage = 1;
    const [p] = hand(s, "21063");
    s = finish(target(mage(s, p), pip.id));
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === pip.id)?.damage,
    ).toBe(0);
    conserved(s, [pip]);
  });
  it("Leadership changes the receiving hero's three native stats for this round", () => {
    let s = base(true);
    const before = heroStats(seatView(s, "p2")),
      own = heroStats(s),
      [p] = hand(s, "21057");
    s = finish(target(mage(s, p), "hero:p2"));
    const after = heroStats(seatView(s, "p2"));
    expect(after.attack).toBe(before.attack + 1);
    expect(after.thwart).toBe(before.thwart + 1);
    expect(after.defense).toBe(before.defense + 1);
    expect(heroStats(s)).toEqual(own);
    seatView(s, "p2").player.form = "alter";
    expect(heroStats(seatView(s, "p2")).attack).toBe(before.attack);
    s.round++;
    seatView(s, "p2").player.form = "hero";
    expect(heroStats(seatView(s, "p2")).attack).toBe(before.attack);
  });
  it("Avatar discards only after both choices and removes one actual status", () => {
    let s = base();
    s.player.form = "alter";
    s.player.stunned = true;
    s.player.confused = true;
    const [p] = hand(s, "21040");
    s = command(s, { type: "ABILITY", id: "hero", action: "avatar-of-life" });
    expect(s.player.hand.some((x) => x.id === p.id)).toBe(true);
    s = choose(reload(s), p.id);
    expect(s.player.hand.some((x) => x.id === p.id)).toBe(true);
    s = finish(choose(reload(s), "stunned"));
    expect(s.player.stunned).toBe(false);
    expect(s.player.confused).toBe(true);
    conserved(s, [p]);
  });
});

describe("Soul World, Staff and additional spell costs", () => {
  it("commits two simultaneous last-hand resources in one reset and does not repeat an already observed Soul transition", () => {
    let s = base();
    const world = put(s, "21033"),
      c = church(s),
      [staff, energy, mental] = hand(s, "21034", "21040", "21037");
    const last = s.player.deck.pop()!;
    s.player.hand.push(...s.player.deck.splice(0));
    s.player.deck.push(last);
    s = native(s, { type: "draw", amount: 1 });
    expect(s.prompt?.title).toBe("Soul World");
    s = finish(choose(reload(s), "yes"));
    expect(s.player.deck).toHaveLength(0);
    expect(s.player.discard).toHaveLength(0);
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    s = command(s, { type: "PLAY", id: staff.id });
    s = pay(reload(s), [energy, mental]);
    s = finish(s);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.deck.map((p) => p.id).sort()).toEqual(
      [energy.id, mental.id].sort(),
    );
    expect(s.player.inPlay.find((p) => p.id === staff.id)).toBeTruthy();
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.stunned).toBe(true);
    encounterConserved(s, [c]);
    conserved(s, [world, staff, energy, mental, last]);
  });
  it("a spell's new empty transition resolves Church and Soul World before its status-replaced initial cost", () => {
    let s = base();
    const world = put(s, "21033"),
      c = church(s),
      h = hand(s, "21038", "21040", "21037"),
      last = top(s, "21044");
    s.player.hand.push(...s.player.deck.splice(1));
    s = play(s, h[0], h.slice(1));
    expect(s.prompt?.title).toMatch(/Karmic Blast/);
    s = choose(reload(s), "1");
    expect(s.prompt?.title).toBe("Soul World");
    expect(s.player.exhausted).toBe(true);
    expect(s.player.stunned).toBe(true);
    expect(s.villain.hp).toBe(50);
    s = choose(reload(s), "yes");
    expect(s.prompt?.title).toMatch(/initial cost/);
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(46);
    expect(s.player.stunned).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === world.id)?.counters).toBe(1);
    expect(s.encounter.dealt).toHaveLength(1);
    conserved(s, [...h, world, last]);
    encounterConserved(s, [c]);
  });
  it("Soul World exhausts and spends one real counter to heal every missing HP in alter ego", () => {
    let s = base();
    const world = put(s, "21033");
    world.counters = 2;
    s.player.hp = 2;
    s.player.form = "alter";
    s = finish(
      command(s, { type: "ABILITY", id: world.id, action: "soul-heal" }),
    );
    expect(s.player.hp).toBe(11);
    expect(s.player.inPlay.find((p) => p.id === world.id)).toMatchObject({
      counters: 1,
      exhausted: true,
    });
  });
  it("Karmic Staff is a real wild resource in both forms and remains ready after payment cancellation", () => {
    let s = base();
    const staff = put(s, "21034"),
      returned = top(s, "21044");
    s.player.deck.splice(s.player.deck.indexOf(returned), 1);
    s.player.discard.push(returned);
    s.player.form = "alter";
    const [quantum] = hand(s, "21040");
    s = command(s, { type: "PLAY", id: quantum.id });
    expect(paymentSources(s, quantum.id).some((p) => p.id === staff.id)).toBe(
      true,
    );
    s = command(s, { type: "CANCEL" });
    expect(
      s.player.inPlay.find((p) => p.id === staff.id)?.exhausted,
    ).toBeFalsy();
    s = command(s, { type: "PLAY", id: quantum.id });
    s = pay(s, [], "mental", [staff.id]);
    expect(s.prompt?.options.some((o) => o.id === quantum.id)).toBe(false);
    s = finish(target(reload(s), returned.id));
    expect(s.player.hand.some((p) => p.id === returned.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === staff.id)?.exhausted).toBe(
      true,
    );
    conserved(s, [staff, quantum, returned]);
  });
  it("Blast mills the chosen four actual cards and deals a single eight-damage attack", () => {
    let s = base();
    const h = hand(s, "21038", "21040", "21037");
    const cards = ["21044", "21049", "21057", "21063"]
      .reverse()
      .map((code) => top(s, code));
    s = choose(play(s, h[0], h.slice(1)), "4");
    s = finish(target(reload(s), "villain"));
    expect(s.villain.hp).toBe(42);
    expect(
      cards.every((p) => s.player.discard.some((x) => x.id === p.id)),
    ).toBe(true);
    conserved(s, [...h, ...cards]);
  });
  it("Tough prevents all original and additional Blast damage together", () => {
    let s = base();
    s.villain.tough = true;
    const h = hand(s, "21038", "21040", "21037");
    top(s, "21044");
    s = finish(target(choose(play(s, h[0], h.slice(1)), "1"), "villain"));
    expect(s.villain.hp).toBe(50);
    expect(s.villain.tough).toBe(false);
  });
  it("Awareness counts different aspects once and excludes signature cards", () => {
    let s = base();
    const h = hand(s, "21039", "21040", "21037");
    ["21044", "21045", "21049", "21038"]
      .reverse()
      .forEach((code) => top(s, code));
    s = finish(target(choose(play(s, h[0], h.slice(1)), "4"), "main"));
    expect(s.scheme.threat).toBe(5);
  });
  it("an empty original deck cannot pay the spell's up-to discard cost", () => {
    const s = base(),
      h = hand(s, "21038", "21040", "21037");
    s.player.hand.push(...s.player.deck.splice(0));
    expect(playable(s, h[0])).toMatch(/deck|discard/i);
  });
});

describe("Physical nemesis and forced Cosmic Ward", () => {
  it("Ward preserves the already captured first-treachery Surge from Mister Knife through reload", () => {
    let s = base();
    s.phase = "villain";
    s.scheme.threat = 0;
    const ward = put(s, "21036"),
      inq = nemesis(s, "21070"),
      knife = makePiece(s, "17026"),
      boostedReveal = s.encounter.deck[0];
    knife.engagedWith = "p1";
    s.minions.push(knife);
    s = native(s, { type: "reveal", piece: inq });
    s = finish(
      reload(s),
      (v) => v.prompt?.options.find((o) => o.id === "incite")?.id,
    );
    expect(s.scheme.threat).toBe(2);
    expect(s.sideSchemes).toHaveLength(0);
    expect(s.flags.starlordFirstTreacheryRound).toBe(s.round);
    expect(s.encounter.deck).toHaveLength(19);
    expect(s.encounter.dealt.some((p) => p.id === boostedReveal.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === inq.id)).toBe(true);
    conserved(s, [ward]);
    encounterConserved(s, [inq, boostedReveal, knife]);
  });
  it("chooses exactly one forced physical Ward and retains Inquisition's printed Incite", () => {
    let s = base();
    s.scheme.threat = 0;
    const a = put(s, "21036"),
      b = put(s, "21036"),
      set = [...s.player.setAside!],
      inq = nemesis(s, "21070");
    s = native(s, { type: "reveal", piece: inq });
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    s = finish(choose(reload(s), b.id));
    expect(s.scheme.threat).toBe(2);
    expect(s.sideSchemes).toHaveLength(0);
    expect(s.player.inPlay.some((p) => p.id === a.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === b.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === inq.id)).toBe(true);
    encounterConserved(s, set);
    conserved(s, [a, b]);
  });
  it("Inquisition searches the actual set-aside Church before Shadows without cloning it", () => {
    let s = base();
    s.scheme.threat = 0;
    const set = [...s.player.setAside!],
      c = set.find((p) => p.code === "21068")!;
    const r = revealPhysical(s, "21070");
    s = finish(r.s, (v) => v.prompt?.options.find((o) => o.id === "text")?.id);
    expect(s.sideSchemes.some((p) => p.id === c.id)).toBe(true);
    expect(s.player.setAside?.some((p) => p.id === c.id)).toBe(false);
    encounterConserved(s, set);
  });
  it("Shadows reveals physical Magus and Church and shuffles only the actual remaining three", () => {
    let s = base();
    const set = [...s.player.setAside!],
      shadows = makePiece(s, "01190");
    s = finish(
      native(s, { type: "reveal", piece: shadows }),
      (v) => v.prompt?.options.find((o) => o.id === "take")?.id,
    );
    expect(s.player.setAside).toEqual([]);
    expect(
      s.minions.some((p) => p.id === set.find((p) => p.code === "21067")!.id),
    ).toBe(true);
    expect(
      s.sideSchemes.some(
        (p) => p.id === set.find((p) => p.code === "21068")!.id,
      ),
    ).toBe(true);
    for (const p of set.filter((p) => ["21069", "21070"].includes(p.code)))
      expect(s.encounter.deck.some((x) => x.id === p.id)).toBe(true);
    encounterConserved(s, set);
  });
  it("a Zealot anywhere prevents every native player-card removal from the actual Church", () => {
    let s = base(true);
    const c = church(s),
      zealot = nemesis(s, "21069");
    zealot.engagedWith = "p2";
    s.minions.push(zealot);
    const [p] = hand(s, "21049");
    s = mage(s, p);
    expect(s.prompt?.options.some((o) => o.id === c.id)).toBe(false);
    s = finish(target(s, "main"));
    s = finish(
      native(s, {
        type: "thwart",
        target: c.id,
        amount: 3,
        source: "hero",
        action: false,
      }),
    );
    expect(s.sideSchemes.find((p) => p.id === c.id)?.counters).toBe(4);
    encounterConserved(s, [c, zealot]);
  });
  it("the same boost Zealot enters play and survives boost cleanup", () => {
    let s = base();
    const z = nemesis(s, "21069");
    s.encounter.deck.unshift(z);
    s = finish(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === "take")?.id,
    );
    expect(s.minions.find((p) => p.id === z.id)?.engagedWith).toBe("p1");
    expect(s.encounter.discard.some((p) => p.id === z.id)).toBe(false);
    encounterConserved(s, [z]);
  });
  it("the same boost Church is revealed and survives boost cleanup", () => {
    let s = base();
    const c = nemesis(s, "21068");
    s.encounter.deck.unshift(c);
    s = finish(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.sideSchemes.some((p) => p.id === c.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === c.id)).toBe(false);
    encounterConserved(s, [c]);
  });
  it("a completed Magus attack mills exactly five physical player cards", () => {
    let s = base();
    const magus = nemesis(s, "21067");
    magus.engagedWith = "p1";
    s.minions.push(magus);
    const milled = s.player.deck.slice(0, 5);
    s = finish(
      native(s, { type: "enemyAttack", id: magus.id }),
      (v) => v.prompt?.options.find((o) => o.id === "take")?.id,
    );
    expect(s.player.discard.map((p) => p.id)).toEqual(milled.map((p) => p.id));
    conserved(s, milled);
    encounterConserved(s, [magus]);
  });
  it("a completed Magus scheme also mills five after placing threat", () => {
    let s = base();
    s.player.form = "alter";
    s.scheme.threat = 0;
    const magus = nemesis(s, "21067"),
      milled = s.player.deck.slice(0, 5);
    magus.engagedWith = "p1";
    s.minions.push(magus);
    s = finish(native(s, { type: "enemyScheme", id: magus.id }));
    expect(s.scheme.threat).toBe(2);
    expect(s.player.discard.map((p) => p.id)).toEqual(milled.map((p) => p.id));
    conserved(s, milled);
    encounterConserved(s, [magus]);
  });
  it("Stun replacing Magus's activation does not trigger his after-activation mill", () => {
    let s = base();
    const magus = nemesis(s, "21067");
    magus.engagedWith = "p1";
    magus.stunned = true;
    s.minions.push(magus);
    s = finish(native(s, { type: "enemyAttack", id: magus.id }));
    expect(s.player.discard).toHaveLength(0);
    expect(s.minions.find((p) => p.id === magus.id)?.stunned).toBe(false);
  });
  it("Regeneration Cycle can freely change form and removes its actual physical card", () => {
    let s = base();
    const p = makePiece(s, "21066");
    s = choose(native(s, { type: "reveal", piece: p }), "alter");
    s = finish(choose(reload(s), "exhaust"));
    expect(s.player.form).toBe("alter");
    expect(s.player.flipped).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((x) => x.id === p.id)).toBe(true);
    encounterConserved(s, [p]);
  });
  it("Regeneration Cycle discards its original five and places only distinct-aspect threat", () => {
    let s = base();
    s.scheme.threat = 0;
    const p = makePiece(s, "21066");
    ["21044", "21045", "21049", "21057", "21040"]
      .reverse()
      .forEach((code) => top(s, code));
    const before = s.player.deck.slice(0, 5);
    s = choose(native(s, { type: "reveal", piece: p }), "stay");
    s = finish(choose(s, "discard"));
    expect(s.scheme.threat).toBe(3);
    expect(s.player.discard.map((p) => p.id)).toEqual(before.map((p) => p.id));
    expect(s.encounter.discard.some((x) => x.id === p.id)).toBe(true);
    encounterConserved(s, [p]);
  });
});

describe("Pip in the shared native attack window", () => {
  it("canceling Pip's interrupt payment retains every original hand card and resumes the same attack", () => {
    let s = base();
    const h = hand(s, "21032", "21040", "21037");
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      /Pip the Troll/,
    );
    s = command(reload(s), { type: "CANCEL" });
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "take")?.id);
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    expect(s.player.inPlay).toHaveLength(0);
    expect(s.player.hp).toBe(9);
    expect(s.attack).toBeNull();
    conserved(s, h);
  });
  it("an alter-ego owner pays Energy and Mental to put the original Pip under the attacked teammate's control", () => {
    let s = base(true);
    s.player.form = "alter";
    const h = hand(s, "21032", "21040", "21037");
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" }),
      /Pip the Troll/,
    );
    expect(s.activePlayerId).toBe("p1");
    expect(s.prompt?.paymentTarget).toBe("21032");
    s = pay(reload(s), h.slice(1));
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === h[0].id),
    ).toMatchObject({ ownerId: "p1", tough: true });
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find(
          (o) => o.id === h[0].id || o.id === `ally:${h[0].id}`,
        )?.id,
    );
    const pip = seatView(s, "p2").player.inPlay.find((p) => p.id === h[0].id);
    expect(pip).toBeTruthy();
    expect(pip?.tough).toBe(false);
    expect(pip?.damage).toBe(0);
    expect(seatView(s, "p2").player.hp).toBe(10);
    conserved(s, h, "p1");
  });
  it("Pip's Tough absorbs enemy Retaliate, then his ordinary attack consequential damage remains", () => {
    let s = base();
    const pip = put(s, "21032"),
      knife = makePiece(s, "17026");
    pip.tough = true;
    knife.engagedWith = "p1";
    s.minions.push(knife);
    s = finish(
      target(
        command(s, { type: "ABILITY", id: pip.id, action: "attack" }),
        knife.id,
      ),
    );
    expect(s.minions.find((p) => p.id === knife.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === pip.id)).toMatchObject({
      tough: false,
      damage: 1,
      exhausted: true,
    });
    conserved(s, [pip]);
  });
});
