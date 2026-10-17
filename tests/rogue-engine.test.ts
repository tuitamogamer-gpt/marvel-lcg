import { describe, expect, it } from "vitest";
import {
  card,
  deckCodes,
  heroStats,
  aerial,
  pieceHP,
  imageFor,
} from "../src/game/cards.js";
import {
  newGame,
  makePiece,
  playable,
  nativeHeroAbilityOptions,
  paymentSources,
} from "../src/game/engine.js";
import { deckErrors, deckSizeFor } from "../src/game/decks.js";
import {
  rogueTouched,
  rogueModifiers,
  rogueTraits,
} from "../src/game/rogue.js";
import {
  allInPlay,
  controller,
  seatView,
  activateSeat,
} from "../src/game/team.js";
import {
  command,
  choose,
  finish,
  native,
  pay,
  reload,
  respond,
} from "./dv-test-helpers.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
function settle(s: GameState) {
  return finish(
    s,
    (v) =>
      v.prompt?.options.find((o) =>
        ["continue", "pass", "allow", "none"].includes(o.id),
      )?.id,
  );
}
function start(aspect: Aspect = "protection", other?: string, extra?: string) {
  const codes = deckCodes("rogue", aspect);
  if (extra) {
    const i = codes.findIndex((c) => card(c).faction_code === aspect);
    codes[i] = extra;
  }
  return newGame({
    heroId: "rogue",
    aspect,
    villainId: "rhino",
    seed: 38001,
    pacing: "expert",
    heroes: [
      { heroId: "rogue", aspect, deckCards: codes },
      ...(other ? [{ heroId: other, aspect: "justice" as Aspect }] : []),
    ],
  });
}
function base(aspect: Aspect = "protection", other?: string, extra?: string) {
  let s = start(aspect, other, extra);
  for (let i = 0; i < s.players.length; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.deck.push(...v.player.hand.splice(0));
    v.player.form = "hero";
    v.player.exhausted = false;
  }
  s.player.hp = 11;
  s.villain.hp = s.villain.maxHp = 99;
  s.scheme.threat = 4;
  return s;
}
function take(
  s: GameState,
  code: string,
  zone: "hand" | "inPlay" | "discard" = "hand",
  seat = s.activePlayerId,
) {
  const v = seatView(s, seat);
  for (const z of [v.player.deck, v.player.hand, v.player.discard]) {
    const i = z.findIndex((p) => p.code === code);
    if (i >= 0) {
      const [p] = z.splice(i, 1);
      v.player[zone].push(p);
      return p;
    }
  }
  throw Error(`Missing original ${code}`);
}
function resources(s: GameState, count: number) {
  return Array.from({ length: count }, () => {
    const p = s.player.deck.find(
      (p) =>
        card(p).type_code !== "resource" &&
        card(p).faction_code !== "encounter",
    )!;
    return take(s, p.code);
  });
}
function play(s: GameState, p: Piece, rs: Piece[] = []) {
  s = command(s, { type: "PLAY", id: p.id });
  return s.prompt?.kind === "payment" ? pay(s, rs) : s;
}
function minion(s: GameState, code = "01103") {
  const p = makePiece(s, code);
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
function touch(s: GameState, id: string) {
  s = command(s, { type: "ABILITY", id: "hero", action: "skin-contact" });
  return settle(choose(s, id));
}
function pieces(s: GameState): Piece[] {
  const walk = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(walk),
    ...(p.captured || []).flatMap(walk),
    ...(p.inheritorBoosts || []).flatMap(walk),
    ...(p.droneCard ? walk(p.droneCard) : []),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...s.resolving,
    ...s.removed,
    ...(s.victoryDisplay || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
  ].flatMap(walk);
}
function exact(s: GameState, ids: string[]) {
  for (const id of ids)
    expect(
      pieces(s).filter((p) => p.id === id),
      id,
    ).toHaveLength(1);
}
function zeroBoost(s: GameState) {
  s.encounter.deck.unshift(makePiece(s, "01104"));
}

describe("Rogue Touched FIND across physical zones", () => {
  it.each(["hand", "discard", "deck", "captured", "stored"] as const)(
    "Skin Contact finds its same owned card in %s and shuffles only a searched deck",
    (zone) => {
      let s = base(
        zone === "stored" ? "leadership" : "protection",
        "spider_man",
        zone === "stored" ? "38028" : undefined,
      );
      const touched = rogueTouched(s)!;
      s.player.setAside!.splice(s.player.setAside!.indexOf(touched), 1);
      let holder: Piece | undefined;
      if (zone === "captured") {
        holder = makePiece(s, "32104");
        holder.captured = [touched];
        s.sideSchemes.push(holder);
      } else if (zone === "stored") {
        holder = take(s, "38028", "inPlay");
        s.player.inPlay.splice(s.player.inPlay.indexOf(holder), 1);
        seatView(s, "p2").player.inPlay.push(holder);
        holder.storedCards = [touched];
      } else s.player[zone].push(touched);
      const ids = pieces(s).map((p) => p.id);
      const beforeSeed = s.seed;
      const beforeDeck = s.player.deck
        .filter((p) => p.id !== touched.id)
        .map((p) => p.id);
      const teammateDeck = seatView(s, "p2").player.deck.map((p) => p.id);
      s = touch(reload(s), s.villain.id);
      expect(rogueTouched(s)).toMatchObject({
        id: touched.id,
        ownerId: "p1",
        attachedTo: s.villain.id,
      });
      expect(s.player.deck.map((p) => p.id).sort()).toEqual(
        [...beforeDeck].sort(),
      );
      if (zone === "deck") {
        expect(s.seed).not.toBe(beforeSeed);
        expect(s.player.deck.map((p) => p.id)).not.toEqual(beforeDeck);
      } else {
        expect(s.seed).toBe(beforeSeed);
        expect(s.player.deck.map((p) => p.id)).toEqual(beforeDeck);
      }
      expect(seatView(s, "p2").player.deck.map((p) => p.id)).toEqual(
        teammateDeck,
      );
      if (holder) {
        const actual = pieces(s).find((p) => p.id === holder!.id)!;
        expect([
          ...(actual.captured || []),
          ...(actual.storedCards || []),
        ]).toEqual([]);
      }
      exact(reload(s), ids);
    },
  );

  it.each(["withdrawn", "player-phase"] as const)(
    "%s finds the original captured Touched without drawing or recapturing a replacement",
    (trigger) => {
      let s = base();
      const touched = rogueTouched(s)!;
      s.player.setAside!.splice(s.player.setAside!.indexOf(touched), 1);
      const holder = makePiece(s, "32104");
      holder.captured = [touched];
      s.sideSchemes.push(holder);
      const before = {
        seed: s.seed,
        hand: s.player.hand.map((p) => p.id),
        deck: s.player.deck.map((p) => p.id),
      };
      s =
        trigger === "withdrawn"
          ? settle(command(s, { type: "FLIP" }))
          : settle(native(s, { type: "wolverinePlayerPhase" }));
      expect(s.player.setAside?.find((p) => p.id === touched.id)).toMatchObject(
        { ownerId: "p1", code: "38002" },
      );
      expect(s.sideSchemes.find((p) => p.id === holder.id)?.captured).toEqual(
        [],
      );
      expect({
        seed: s.seed,
        hand: s.player.hand.map((p) => p.id),
        deck: s.player.deck.map((p) => p.id),
      }).toEqual(before);
      exact(reload(s), [touched.id]);
    },
  );

  it("extracts an Ultron drone's actual Touched and performs leave-play cleanup without a defeat", () => {
    let s = base();
    const touched = rogueTouched(s)!;
    s.player.setAside!.splice(s.player.setAside!.indexOf(touched), 1);
    s.player.deck.unshift(touched);
    s = settle(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.droneCard?.id === touched.id)!;
    expect(drone).toBeTruthy();
    const attachment = take(s, "38004", "inPlay");
    attachment.attachedTo = drone.id;
    s.flags.rogueTraitsRound = s.round;
    s.flags.rogueTraitTargets = drone.id;
    const ids = pieces(s)
      .filter((p) => p.id !== drone.id)
      .map((p) => p.id);
    const defeated = s.stats!.enemiesDefeated;
    const beforeSeed = s.seed;
    s = command(reload(s), {
      type: "ABILITY",
      id: "identity",
      action: "skin-contact",
    });
    expect(s.prompt?.options.some((o) => o.id === drone.id)).toBe(false);
    s = settle(choose(reload(s), s.villain.id));
    expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
    expect(pieces(s).some((p) => p.id === drone.id)).toBe(false);
    expect(rogueTouched(s)).toMatchObject({
      id: touched.id,
      ownerId: "p1",
      attachedTo: s.villain.id,
    });
    expect(s.player.discard.find((p) => p.id === attachment.id)).toMatchObject({
      ownerId: "p1",
    });
    expect(s.player.discard.some((p) => p.id === touched.id)).toBe(false);
    expect(String(s.flags.rogueTraitTargets)).not.toContain(drone.id);
    expect(s.stats!.enemiesDefeated).toBe(defeated);
    expect(s.seed).toBe(beforeSeed);
    exact(reload(s), ids);
  });

  it("a deck search with one remaining card invalidates hidden-information undo without advancing the RNG", () => {
    let s = base();
    const touched = rogueTouched(s)!;
    s.player.setAside!.splice(s.player.setAside!.indexOf(touched), 1);
    const remaining = s.player.deck.shift()!;
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck.push(touched, remaining);
    const seed = s.seed;
    const hidden = s.hiddenInfo || 0;
    const dealt = s.encounter.dealt.map((p) => p.id);
    s = touch(s, s.villain.id);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    expect(s.seed).toBe(seed);
    expect(s.player.deck.map((p) => p.id)).toEqual([remaining.id]);
    expect(s.encounter.dealt.map((p) => p.id)).toEqual(dealt);
    exact(s, [touched.id]);
  });

  it.each(["deck", "drone"] as const)(
    "the non-active Rogue's phase-begin FIND updates canonical %s state across saves",
    (zone) => {
      let s = base("protection", "spider_man");
      const touched = rogueTouched(s)!;
      s.player.setAside!.splice(s.player.setAside!.indexOf(touched), 1);
      s.player.deck.unshift(touched);
      if (zone === "drone") s = settle(native(s, { type: "drone" }));
      const drone = s.minions.find((p) => p.droneCard?.id === touched.id);
      const seed = s.seed;
      const ids = pieces(s)
        .filter((p) => p.id !== drone?.id)
        .map((p) => p.id);
      activateSeat(s, "p2");
      s = settle(native(reload(s), { type: "wolverinePlayerPhase" }));
      expect(
        seatView(s, "p1").player.setAside?.find((p) => p.id === touched.id),
      ).toMatchObject({ ownerId: "p1" });
      expect(
        seatView(s, "p2").player.setAside?.some((p) => p.id === touched.id),
      ).not.toBe(true);
      if (zone === "deck") expect(s.seed).not.toBe(seed);
      else {
        expect(s.seed).toBe(seed);
        expect(s.minions.some((p) => p.id === drone!.id)).toBe(false);
      }
      exact(reload(s), ids);
    },
  );

  it("a prevented drone leave retains its same backing Touched instead of an empty or duplicated wrapper", () => {
    let s = base();
    const touched = rogueTouched(s)!;
    s.player.setAside!.splice(s.player.setAside!.indexOf(touched), 1);
    s.player.deck.unshift(touched);
    s = settle(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.droneCard?.id === touched.id)!;
    const shield = makePiece(s, "37034");
    shield.attachedTo = drone.id;
    s.attachments.push(shield);
    const transfer = take(s, "38007");
    const payment = resources(s, 2);
    expect(playable(s, transfer)).toMatch(/cannot be found and moved/);
    s = touch(s, s.villain.id);
    expect(s.flags.rogueSkinRound).toBe(s.round);
    expect(s.minions.find((p) => p.id === drone.id)?.droneCard).toMatchObject({
      id: touched.id,
      ownerId: "p1",
    });
    expect(s.encounter.discard.some((p) => p.id === shield.id)).toBe(true);
    expect(rogueTouched(s)).toBeUndefined();
    exact(reload(s), [touched.id, shield.id]);
    expect(
      playable(
        s,
        s.player.hand.find((p) => p.id === transfer.id)!,
      ),
    ).toBeNull();
    s = play(s, transfer, payment);
    s = settle(choose(s, s.villain.id));
    expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
    expect(rogueTouched(s)?.id).toBe(touched.id);
    exact(reload(s), [touched.id, shield.id]);
  });

  it.each(["removed", "victoryDisplay"] as const)(
    "FIND cannot recover Touched from %s or manufacture a replacement",
    (zone) => {
      let s = base();
      const touched = rogueTouched(s)!;
      s.player.setAside!.splice(s.player.setAside!.indexOf(touched), 1);
      (s[zone] ||= []).push(touched);
      const transfer = take(s, "38007");
      expect(
        nativeHeroAbilityOptions(s).some((o) => o.id === "skin-contact"),
      ).toBe(false);
      expect(playable(s, transfer)).toMatch(/Touched.*cannot be found/);
      s = settle(native(s, { type: "rogue:set-aside" }));
      expect(s[zone]?.find((p) => p.id === touched.id)).toMatchObject({
        ownerId: "p1",
      });
      expect(rogueTouched(s)).toBeUndefined();
      exact(reload(s), [touched.id]);
    },
  );
});

describe("Rogue original source, setup and Touched", () => {
  it("exposes Skin Contact through the public default identity ability and dispatches that same alias", () => {
    let s = base();
    const touched = rogueTouched(s)!;
    expect(
      nativeHeroAbilityOptions(s).some(
        (option) => option.id === "skin-contact",
      ),
    ).toBe(true);
    s = command(s, { type: "ABILITY", id: "identity", action: "skin-contact" });
    s = settle(choose(reload(s), s.villain.id));
    expect(rogueTouched(s)).toMatchObject({
      id: touched.id,
      attachedTo: s.villain.id,
    });
    expect(rogueModifiers(s).retaliate).toBe(1);
    expect(
      nativeHeroAbilityOptions(reload(s)).some(
        (option) => option.id === "skin-contact",
      ),
    ).toBe(false);
    expect(
      nativeHeroAbilityOptions(reload(s), "hero").some(
        (option) => option.id === "skin-contact",
      ),
    ).toBe(false);
    exact(s, [touched.id]);
  });

  it.each(["aggression", "justice", "leadership", "protection"] as Aspect[])(
    "all original signatures and actual41-card %s deck are legal",
    (aspect) => {
      const codes = deckCodes("rogue", aspect);
      expect(deckErrors("rogue", aspect, codes)).toEqual([]);
      expect(deckSizeFor(codes)).toBe(41);
      expect(codes.filter((c) => card(c).set_code === "rogue")).toHaveLength(
        16,
      );
      const s = start(aspect);
      expect(s.player.hand).toHaveLength(6);
      expect(s.player.inPlay).toHaveLength(0);
      expect(rogueTouched(s)).toBeTruthy();
      expect(s.player.setAside).toHaveLength(5);
    },
  );
  it("finds the original Touched only after mulligan, without replacing a drawn copy", () => {
    let s = start();
    const t = rogueTouched(s)!;
    const i = s.player.deck.findIndex((p) => p.id === t.id);
    if (i >= 0) {
      const old = s.player.hand.pop()!;
      s.player.deck[i] = old;
      s.player.hand.push(t);
    }
    const ids = pieces(s)
      .filter((p) => p.ownerId === "p1")
      .map((p) => p.id);
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.player.hand).toHaveLength(5);
    expect(s.player.setAside?.filter((p) => p.id === t.id)).toHaveLength(1);
    expect(imageFor("38001a")).toContain("38001b");
    exact(s, ids);
  });
  it("Skin Contact is once per round, Jacket changes stats, and alter-ego detaches Touched", () => {
    let s = base();
    const t = rogueTouched(s)!,
      j = take(s, "38004", "inPlay");
    s = touch(s, s.villain.id);
    expect(rogueTouched(s)).toMatchObject({
      id: t.id,
      attachedTo: s.villain.id,
    });
    expect(rogueModifiers(s).retaliate).toBe(1);
    expect(heroStats(s).attack).toBe(3);
    expect(
      nativeHeroAbilityOptions(s, "hero").some((o) => o.id === "skin-contact"),
    ).toBe(false);
    s = settle(command(s, { type: "FLIP" }));
    expect(s.player.setAside?.some((p) => p.id === t.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === j.id)).toBe(true);
  });
  it("Touching an ally grants Aerial and Jacket THW; touching another hero gives Stalwart", () => {
    let s = base("protection", "spider_man");
    const a = take(s, "38003", "inPlay");
    take(s, "38004", "inPlay");
    s = touch(s, a.id);
    expect(aerial(s)).toBe(true);
    expect(heroStats(s).thwart).toBe(3);
    s.round++;
    s = touch(s, "hero:p2");
    s = settle(
      native(
        s,
        { type: "status", target: "hero", status: "stunned" },
        { type: "status", target: "hero", status: "confused" },
      ),
    );
    expect(s.player.stunned || s.player.confused).toBe(false);
  });
  it("the next player phase sets Touched aside without using Skin Contact", () => {
    let s = base();
    s = touch(s, s.villain.id);
    s.round++;
    s = settle(native(s, { type: "wolverinePlayerPhase" }));
    expect(rogueTouched(s)?.attachedTo).toBeUndefined();
    expect(
      nativeHeroAbilityOptions(s, "hero").some((o) => o.id === "skin-contact"),
    ).toBe(true);
  });
});
describe("Rogue actual paid signatures and resources", () => {
  it("Southern Cross deals8 while Aerial and Goin' Rogue removes5", () => {
    let s = base();
    const ally = take(s, "38003", "inPlay");
    s = touch(s, ally.id);
    const cross = take(s, "38006"),
      rs = resources(s, 3);
    s = play(s, cross, rs);
    s = s.prompt ? settle(choose(s, s.villain.id)) : s;
    expect(s.villain.hp).toBe(91);
    s.scheme.threat = 6;
    const go = take(s, "38005"),
      more = resources(s, 2);
    s = play(s, go, more);
    s = settle(choose(s, "main"));
    expect(s.scheme.threat).toBe(1);
  });
  it("villain Touched enables Southern Cross stun and Goin' Rogue's chosen confuse", () => {
    let s = base();
    s = touch(s, s.villain.id);
    const cross = take(s, "38006"),
      rs = resources(s, 3);
    s = play(s, cross, rs);
    s = settle(choose(s, s.villain.id));
    expect(s.villain.stunned).toBe(true);
    const go = take(s, "38005"),
      more = resources(s, 2);
    s = play(s, go, more);
    s = choose(s, "main");
    s = settle(choose(s, s.villain.id));
    expect(s.villain.confused).toBe(true);
  });
  it("Touching a minion gives Rogue's actual event attack Overkill", () => {
    let s = base();
    const m = minion(s);
    s = touch(s, m.id);
    const cross = take(s, "38006"),
      rs = resources(s, 3);
    s = play(s, cross, rs);
    s = settle(choose(s, m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.villain.hp).toBe(96);
  });
  it("Energy Transfer pays movement and damage before healing/readying, including Tough prevention", () => {
    let s = base();
    const a = take(s, "38003", "inPlay");
    a.tough = true;
    s.player.hp = 5;
    s.player.exhausted = true;
    const event = take(s, "38007"),
      rs = resources(s, 2);
    s = play(s, event, rs);
    s = settle(choose(s, a.id));
    expect(s.player.hp).toBe(7);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === a.id)?.tough).toBe(false);
    expect(rogueTouched(s)?.attachedTo).toBe(a.id);
  });
  it("Energy Transfer still heals and readies when its damage defeats its actual target", () => {
    let s = base();
    const m = minion(s);
    m.damage = 2;
    s.player.hp = 5;
    s.player.exhausted = true;
    const event = take(s, "38007"),
      rs = resources(s, 2);
    s = play(s, event, rs);
    s = settle(choose(s, m.id));
    expect(s.player.hp).toBe(7);
    expect(s.player.exhausted).toBe(false);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
  });
  it("X-Gene only funds identity-specific events and its actual cost exhausts once", () => {
    let s = base();
    const gene = take(s, "38019", "inPlay"),
      event = take(s, "38005"),
      r = resources(s, 1);
    expect(
      paymentSources(s, event.id, event.code).some(
        (p) => p.id === `rogue-gene:${gene.id}`,
      ),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "38016").some(
        (p) => p.id === `rogue-gene:${gene.id}`,
      ),
    ).toBe(false);
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, r, undefined, [`rogue-gene:${gene.id}`]);
    s = settle(choose(s, "main"));
    expect(s.player.inPlay.find((p) => p.id === gene.id)?.exhausted).toBe(true);
  });
});
describe("Rogue allies and cross-owner Superpower Adaptation", () => {
  it("Gambit enters with3 counters and its interrupt deals1 before the actual attack", () => {
    let s = base();
    const p = take(s, "38003"),
      rs = resources(s, 3);
    s = settle(play(s, p, rs));
    expect(s.player.inPlay.find((q) => q.id === p.id)?.counters).toBe(3);
    s = native(s, {
      type: "allyAction",
      id: p.id,
      kind: "attack",
      target: s.villain.id,
    });
    s = respond(s, /Gambit/);
    s = settle(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(96);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.counters).toBe(2);
  });
  it("Iceman responds to an actual minion entry and spends one freeze counter", () => {
    let s = base();
    const p = take(s, "38010"),
      rs = resources(s, 3);
    s = settle(play(s, p, rs));
    const m = makePiece(s, "01103");
    s = native(s, { type: "reveal", piece: m });
    s = settle(respond(s, /Iceman/));
    expect(s.minions.find((p) => p.id === m.id)?.stunned).toBe(true);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.counters).toBe(2);
  });
  it("Karma controls the same minion with2 consequential damage and restores it when Karma leaves", () => {
    let s = base();
    const m = minion(s),
      p = take(s, "38011"),
      rs = resources(s, 4);
    s = play(s, p, rs);
    s = respond(s, /Karma/);
    s = settle(choose(s, m.id));
    const controlled = s.player.inPlay.find((p) => p.id === m.id)!;
    expect(card(controlled)).toMatchObject({
      type_code: "ally",
      thwart: 1,
      attack_cost: 2,
      thwart_cost: 2,
    });
    s = settle(
      native(s, {
        type: "allyAction",
        id: m.id,
        kind: "attack",
        target: s.villain.id,
      }),
    );
    expect(s.player.inPlay.find((p) => p.id === m.id)?.damage).toBe(2);
    s = settle(native(s, { type: "discardPiece", id: p.id }));
    expect(s.minions.find((p) => p.id === m.id)).toMatchObject({
      engagedWith: "p1",
      damage: 2,
    });
    exact(s, [m.id, p.id]);
  });
  it("Adaptation takes a teammate's physical identity event, plays it, and returns it to that owner's discard", () => {
    let s = base("protection", "spider_man");
    const event = take(s, "01005", "discard", "p2");
    s = touch(s, "hero:p2");
    const adapt = take(s, "38009");
    s = play(s, adapt);
    s = settle(choose(s, event.id));
    expect(s.player.hand.find((p) => p.id === event.id)?.ownerId).toBe("p2");
    const rs = resources(s, 3);
    s = play(reload(s), event, rs);
    s = s.prompt ? settle(choose(s, s.villain.id)) : s;
    expect(s.villain.hp).toBe(91);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === event.id),
    ).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(false);
    exact(s, [event.id, adapt.id]);
  });
});

describe("Rogue trait grants and paid defensive windows", () => {
  it("tracks target traits dynamically, retains the original grant when Touched moves, and ends it on leave/re-entry", () => {
    let s = base("protection", "spider_man");
    const ally = take(s, "01002", "inPlay", "p2");
    s = touch(s, ally.id);
    expect(playable(s, take(s, "38018"))).toContain("Mutant");
    const honor = makePiece(s, "03025");
    honor.ownerId = "p2";
    honor.attachedTo = ally.id;
    seatView(s, "p2").player.inPlay.push(honor);
    const grant = (v: GameState) =>
      rogueTraits(v, (state, id) => {
        const p = allInPlay(state).find((p) => p.id === id);
        return p
          ? [
              ...(card(p).traits || "").split(/\.\s*/),
              ...(allInPlay(state).some(
                (a) => a.code === "03025" && a.attachedTo === id,
              )
                ? ["Avenger"]
                : []),
            ]
          : [];
      });
    expect(grant(s)).toContain("Avenger");
    const transfer = take(s, "38007");
    const rs = resources(s, 2);
    s = play(s, transfer, rs);
    s = settle(choose(s, s.villain.id));
    expect(grant(reload(s))).toContain("Avenger");
    s = settle(native(s, { type: "discardPiece", id: ally.id }));
    expect(s.flags.rogueTraitTargets).not.toContain(ally.id);
    const returned = take(s, "01002", "inPlay", "p2");
    expect(returned.id).toBe(ally.id);
    expect(grant(s)).not.toContain("Avenger");
  });
  it("copied Mutant tracks a teammate's form and supports native play restrictions", () => {
    let s = base("protection", "phoenix");
    s = touch(s, "hero:p2");
    const moira = take(s, "38018");
    expect(playable(s, moira)).toContain("Mutant");
    seatView(s, "p2").player.form = "alter";
    resources(s, 2);
    expect(playable(s, moira)).toBeNull();
    seatView(s, "p2").player.form = "hero";
    expect(playable(s, moira)).toContain("Mutant");
  });
  it.each([false, true])(
    "Bulletproof Belle pays against the Touched attacker; piercing=%s",
    (piercing) => {
      let s = base();
      const m = minion(s);
      s = touch(s, m.id);
      const event = take(s, "38008");
      const rs = resources(s, 1);
      const hp = s.player.hp;
      s = native(s, { type: "enemyAttack", id: m.id });
      if (piercing) s.attack!.piercing = true;
      s = respond(s, /Bulletproof Belle/);
      s = pay(s, rs);
      s = settle(s);
      expect(s.player.hp).toBe(hp);
      expect(s.player.tough).toBe(!piercing);
      expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    },
  );
  it.each([0, 5])(
    "Not Today preserves +2DEF through attack recalculation and thwarts only after no damage, bonus=%s",
    (bonus) => {
      let s = base();
      const event = take(s, "38016"),
        rs = resources(s, 1);
      const hp = s.player.hp;
      zeroBoost(s);
      s = native(s, {
        type: "enemyAttack",
        id: s.villain.id,
        activation: {
          playerId: "p1",
          enemyId: s.villain.id,
          kind: "attack",
          modifier: bonus,
        },
      });
      s = choose(s, "hero");
      s = respond(s, /Not Today/);
      s = pay(s, rs);
      s = finish(s, (v) =>
        v.prompt?.title === "Not Today!" ? "main" : undefined,
      );
      expect(s.player.hp).toBe(hp - Math.max(0, 2 + bonus - 4));
      expect(s.scheme.threat).toBe(bonus === 0 ? 2 : 4);
      expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    },
  );
  it("Judoka pays each of three counters once per attack and discards its same physical card", () => {
    let s = base();
    const j = take(s, "38014"),
      rs = resources(s, 2);
    s = settle(play(s, j, rs));
    expect(s.player.inPlay.find((p) => p.id === j.id)?.counters).toBe(3);
    for (let n = 0; n < 3; n++) {
      s.player.exhausted = false;
      zeroBoost(s);
      s = native(s, {
        type: "enemyAttack",
        id: s.villain.id,
        activation: {
          playerId: "p1",
          enemyId: s.villain.id,
          kind: "attack",
          modifier: 2,
        },
      });
      s = choose(s, "hero");
      s = respond(s, /Judoka/);
      s = settle(s);
      expect(s.player.hp).toBe(11);
    }
    expect(s.player.discard.filter((p) => p.id === j.id)).toHaveLength(1);
    exact(s, [j.id]);
  });
  it("Defensive Energy draws during an actually paid Not Today and reprinted Unflappable draws after the attack", () => {
    let s = base();
    const un = take(s, "38013"),
      r = resources(s, 1);
    s = settle(play(s, un, r));
    const ev = take(s, "38016"),
      energy = take(s, "38017");
    zeroBoost(s);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    s = respond(s, /Not Today/);
    s = pay(s, [energy]);
    s = finish(s, (v) =>
      v.prompt?.title === "Not Today!"
        ? "main"
        : ["Unflappable", "Defensive Energy"].includes(v.prompt?.title || "")
          ? "yes"
          : undefined,
    );
    expect(s.player.hand).toHaveLength(2);
    expect(s.player.inPlay.find((p) => p.id === un.id)?.exhausted).toBe(true);
    exact(s, [ev.id, energy.id, un.id]);
  });
  it("the original Preemptive Strike printing cancels real boost icons and deals the matching damage", () => {
    let s = base();
    const ev = take(s, "38015"),
      rs = resources(s, 1);
    s.encounter.deck.unshift(makePiece(s, "01109"));
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    s = respond(s, /Preemptive Strike/);
    s = pay(s, rs);
    s = settle(s);
    expect(s.villain.hp).toBe(99 - (card("01109").boost || 0));
    expect(s.player.hp).toBe(11);
    exact(s, [ev.id]);
  });
});

describe("Rogue supports, team-up, and encounter physical lifecycle", () => {
  it("Moira is paid in alter-ego then exhausts to draw for a different Mutant player's actual flip", () => {
    let s = base("protection", "phoenix");
    s.player.form = "alter";
    const p = take(s, "38018"),
      rs = resources(s, 2);
    s = settle(play(s, p, rs));
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    s.player.form = "alter";
    s.player.flipped = false;
    s = command(s, { type: "FLIP" });
    s = settle(respond(s, /Moira/));
    expect(seatView(s, "p2").player.hand).toHaveLength(1);
    expect(
      seatView(s, "p1").player.inPlay.find((q) => q.id === p.id)?.exhausted,
    ).toBe(true);
  });
  it("Armor's actual play requires X-Men and gives its physical ally Tough", () => {
    let s = base();
    const p = take(s, "38012"),
      rs = resources(s, 2);
    s = settle(play(s, p, rs));
    expect(s.player.inPlay.find((q) => q.id === p.id)?.tough).toBe(true);
  });
  it("Med Lab captures a teammate's consequentially defeated ally and plays that same owned card exhausted at full cost", () => {
    let s = base("leadership", "spider_man", "38028");
    const lab = take(s, "38028"),
      rs = resources(s, 1);
    s = settle(play(s, lab, rs));
    const ally = take(s, "01002", "inPlay", "p2");
    ally.damage = 1;
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    s = native(s, {
      type: "allyAction",
      id: ally.id,
      kind: "thwart",
      target: "main",
    });
    s = settle(respond(s, /Med Lab/));
    const stored = seatView(s, "p1").player.inPlay.find(
      (p) => p.id === lab.id,
    )!;
    expect(stored.storedCards?.[0].id).toBe(ally.id);
    expect(stored.storedCards?.[0].ownerId).toBe("p2");
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    s.player.form = "alter";
    s.player.inPlay.find((p) => p.id === lab.id)!.exhausted = false;
    const payWith = resources(s, 2);
    s = command(s, { type: "ABILITY", id: lab.id, action: "med-lab" });
    s = pay(s, payWith);
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      ownerId: "p2",
      exhausted: true,
      damage: 0,
    });
    exact(s, [lab.id, ally.id]);
  });
  it("Beauty and the Thief pays once for both attack and thwart with live Rogue and Gambit", () => {
    let s = base();
    take(s, "38003", "inPlay");
    const p = take(s, "38020"),
      rs = resources(s, 2);
    s = play(s, p, rs);
    s = choose(s, s.villain.id);
    s = settle(choose(s, "main"));
    expect(s.villain.hp).toBe(95);
    expect(s.scheme.threat).toBe(0);
    exact(s, [p.id]);
  });
  it.each([false, true])(
    "Deadly Touch resolves the friendly-target branch=%s",
    (friendly) => {
      let s = base();
      let ally: Piece | undefined;
      if (friendly) {
        ally = take(s, "38003", "inPlay");
        s = touch(s, ally.id);
      }
      const p = makePiece(s, "38024");
      s = settle(native(s, { type: "reveal", piece: p }));
      expect(s.scheme.threat).toBe(friendly ? 4 : 6);
      if (ally)
        expect(s.player.inPlay.find((q) => q.id === ally.id)?.damage).toBe(2);
      exact(s, [p.id]);
    },
  );
  it("Shadows reveals original Mystique and scheme, and Misled hand entries resolve once and discard to encounters", () => {
    let s = base();
    const reserved = (s.player.setAside || [])
      .filter((p) => p.code !== "38002")
      .map((p) => p.id);
    s = settle(native(s, { type: "reveal", piece: makePiece(s, "01190") }));
    expect(s.minions.some((p) => p.code === "38025")).toBe(true);
    expect(s.sideSchemes.some((p) => p.code === "38026")).toBe(true);
    const mis = s.player.deck.find((p) => p.code === "38027")!;
    expect(mis).toBeTruthy();
    s.player.deck.splice(s.player.deck.indexOf(mis), 1);
    s.player.deck.unshift(mis);
    const before = s.scheme.threat;
    s = settle(native(s, { type: "draw", amount: 1 }));
    expect(s.scheme.threat).toBe(before + 2);
    s = settle(native(reload(s), { type: "heal", target: "hero", amount: 0 }));
    expect(s.scheme.threat).toBe(before + 2);
    s = settle(native(s, { type: "discardHand", id: mis.id }));
    expect(s.encounter.discard.some((p) => p.id === mis.id)).toBe(true);
    exact(s, reserved);
  });
  it.each(["38032", "38033"])(
    "%s attaches the original Cybernetic Enhancements before Teamwork attack, then discards it",
    (code) => {
      let s = base();
      minion(s, "38030");
      const a = makePiece(s, "38035");
      s.encounter.deck.unshift(a);
      const p = makePiece(s, code);
      s = settle(native(s, { type: "reveal", piece: p }));
      expect(s.encounter.discard.some((p) => p.id === a.id)).toBe(true);
      expect(s.player.hp).toBe(
        11 - (card(code).attack || 0) - (card("38035").attack || 0),
      );
      exact(s, [p.id, a.id]);
    },
  );
  it("Cybernetic Enhancements prevents native damage until the attached minion attacks", () => {
    let s = base();
    const m = minion(s),
      p = makePiece(s, "38035");
    s = native(s, { type: "reveal", piece: p });
    s = settle(choose(s, m.id));
    s = settle(
      native(s, { type: "damage", target: m.id, amount: 2, source: "hero" }),
    );
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(0);
    s = settle(native(s, { type: "enemyAttack", id: m.id }));
    s = settle(
      native(s, { type: "damage", target: m.id, amount: 2, source: "hero" }),
    );
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(2);
    exact(s, [m.id, p.id]);
  });
  it("Donald Pierce reveals the topmost actual Reaver in discard; Skullbuster and Bonebreaker resolve engage effects", () => {
    let s = base();
    s.player.form = "alter";
    const skull = makePiece(s, "38030"),
      bone = makePiece(s, "38031");
    s.encounter.discard.push(skull, bone);
    const p = makePiece(s, "38029");
    zeroBoost(s);
    s = native(s, { type: "reveal", piece: p });
    s = finish(s, (v) =>
      v.prompt?.title === "Forced responses"
        ? v.prompt.options[0]?.id
        : undefined,
    );
    expect(s.minions.some((q) => q.id === bone.id)).toBe(true);
    expect(s.encounter.discard.some((q) => q.id === skull.id)).toBe(true);
    expect(s.player.hp).toBe(9);
    s = native(s, {
      type: "reveal",
      piece: s.encounter.discard.splice(
        s.encounter.discard.findIndex((q) => q.id === skull.id),
        1,
      )[0],
    });
    s = finish(s, (v) =>
      v.prompt?.title === "Forced responses"
        ? v.prompt.options[0]?.id
        : undefined,
    );
    expect(s.scheme.threat).toBeGreaterThanOrEqual(7);
    exact(s, [p.id, bone.id, skull.id]);
  });
  it("defeating The Reavers discards to and reveals the same minion", () => {
    let s = base();
    const sc = makePiece(s, "38034");
    s = settle(native(s, { type: "reveal", piece: sc }));
    const p = makePiece(s, "38030");
    s.encounter.deck.unshift(makePiece(s, "01104"), p);
    const scheme = s.sideSchemes.find((q) => q.id === sc.id)!;
    s = settle(
      native(s, { type: "thwart", target: sc.id, amount: scheme.counters }),
    );
    expect(s.minions.some((q) => q.id === p.id)).toBe(true);
    exact(s, [sc.id, p.id]);
  });
});

describe("Rogue latest control effects and classification boundaries", () => {
  it("Karma does not recapture a defeated minion when its same physical card re-enters", () => {
    let s = base();
    const m = minion(s),
      karma = take(s, "38011"),
      rs = resources(s, 4);
    s = play(s, karma, rs);
    s = respond(s, /Karma/);
    s = settle(choose(s, m.id));
    s = settle(
      native(s, { type: "damage", target: m.id, amount: 3, source: "hero" }),
    );
    expect(
      s.player.inPlay.find((p) => p.id === karma.id)?.controlTargetId,
    ).toBeUndefined();
    const original = s.encounter.discard.splice(
      s.encounter.discard.findIndex((p) => p.id === m.id),
      1,
    )[0];
    s = settle(native(reload(s), { type: "reveal", piece: original }));
    expect(s.minions.some((p) => p.id === m.id)).toBe(true);
    exact(s, [m.id, karma.id]);
  });
  it("the newest Possessed overrides Karma, then its removal restores Karma's same ally with two consequential damage", () => {
    let s = base();
    const m = minion(s),
      karma = take(s, "38011"),
      rs = resources(s, 4);
    s = play(s, karma, rs);
    s = respond(s, /Karma/);
    s = settle(choose(s, m.id));
    const pos = makePiece(s, "36038");
    pos.attachedTo = m.id;
    pos.controlOrder = s.nextId++;
    s.attachments.push(pos);
    s = settle(native(reload(s), { type: "heal", target: "hero", amount: 0 }));
    expect(card(s.minions.find((p) => p.id === m.id)!)).toMatchObject({
      type_code: "minion",
    });
    s = settle(native(s, { type: "discardPiece", id: pos.id }));
    expect(card(s.player.inPlay.find((p) => p.id === m.id)!)).toMatchObject({
      type_code: "ally",
      attack_cost: 2,
      thwart_cost: 2,
    });
    exact(s, [m.id, karma.id, pos.id]);
  });
  it("Adaptation's aspect classification permits an event of a different aspect; spending it returns the original owner's card", () => {
    let s = base("protection", "spider_man");
    const aspectAlly = take(s, "01059", "inPlay", "p2");
    const event = take(s, "01060", "discard", "p2");
    s = touch(s, aspectAlly.id);
    const other = makePiece(s, "01053");
    other.ownerId = "p2";
    seatView(s, "p2").player.discard.push(other);
    const adapt = take(s, "38009");
    s = play(s, adapt);
    expect(s.prompt?.options.some((o) => o.id === other.id)).toBe(true);
    s = settle(choose(s, other.id));
    const own = take(s, "38013");
    s = play(s, own, [other]);
    s = settle(choose(s, "p1"));
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === other.id),
    ).toBe(true);
    expect(s.player.discard.some((p) => p.id === other.id)).toBe(false);
    exact(s, [other.id, event.id]);
  });
  it("Misled revealed from encounters shuffles its original card into the player deck and resolves Surge", () => {
    let s = base();
    s.encounter.deck.unshift(makePiece(s, "01103"));
    const p = makePiece(s, "38027");
    s = settle(native(s, { type: "reveal", piece: p }));
    expect(s.player.deck.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.dealt.some((q) => q.code === "01103")).toBe(true);
    exact(s, [p.id]);
  });
  it("defeating Mystique's Manipulations searches Misled and preserves its actual encounter ownership", () => {
    let s = base();
    const p = makePiece(s, "38026"),
      mis = makePiece(s, "38027");
    s.encounter.discard.push(mis);
    s = settle(native(s, { type: "reveal", piece: p }));
    s = settle(
      native(s, {
        type: "thwart",
        target: p.id,
        amount: s.sideSchemes.find((q) => q.id === p.id)!.counters,
      }),
    );
    expect(s.player.deck.find((q) => q.id === mis.id)?.ownerId).toBe(
      mis.ownerId,
    );
    expect(s.player.deck.some((q) => q.id === mis.id)).toBe(true);
    exact(s, [p.id, mis.id]);
  });
});

describe("Rogue source boundary regressions", () => {
  it("a controlled encounter ally does not become an aspect classification for Adaptation", () => {
    let s = base();
    const m = minion(s);
    m.ownerId = "p1";
    const k = take(s, "38011"),
      rs = resources(s, 4);
    s = play(s, k, rs);
    s = respond(s, /Karma/);
    s = settle(choose(s, m.id));
    s = touch(s, m.id);
    take(s, "38016", "discard");
    const a = take(s, "38009");
    expect(playable(s, a)).toContain("matching event");
  });
  it("a target hero's gained Aerial is copied dynamically and remains after moving Touched", () => {
    let s = base("protection", "iron_man");
    s = touch(s, "hero:p2");
    expect(aerial(s)).toBe(false);
    seatView(s, "p2").flags.aerial = true;
    expect(aerial(reload(s))).toBe(true);
    const ev = take(s, "38007"),
      rs = resources(s, 2);
    s = play(s, ev, rs);
    s = settle(choose(s, s.villain.id));
    expect(aerial(s)).toBe(true);
    seatView(s, "p2").flags.aerial = false;
    expect(aerial(s)).toBe(false);
  });
});
