import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { card, heroCard } from "../src/game/cards.js";
import {
  giveStatus,
  scaledKeyword,
  printedKeyword,
} from "../src/game/keywords.js";
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, allInPlay, seatView } from "../src/game/team.js";
import type { Effect, GameState, Piece } from "../src/game/types.js";
import * as pack from "../src/game/brotherhood.js";

function fixture() {
  let s = newGame({
    heroId: "colossus",
    aspect: "protection",
    villainId: "rhino",
    seed: 32073,
    pacing: "expert",
    heroes: [
      { heroId: "colossus", aspect: "protection" },
      { heroId: "shadowcat", aspect: "aggression" },
    ],
  });
  s.phase = "player";
  s.queue = [];
  s.prompt = s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.tough = v.player.stunned = v.player.confused = false;
    v.player.toughCards = v.player.stunCards = v.player.confuseCards = 0;
    v.flags = seat.flags = {};
  }
  s.flags = s.players[0].flags;
  const log: string[] = [];
  const qualify = (v: GameState, e: Effect) => ({
    actorId: v.activePlayerId,
    ...e,
  });
  const target = (v: GameState, id: string) =>
    id.startsWith("hero:")
      ? seatView(v, id.slice(5)).player
      : [...allInPlay(v), ...v.minions].find((p) => p.id === id);
  const definition = (v: GameState, id: string) =>
    id.startsWith("hero:")
      ? heroCard(seatView(v, id.slice(5)))
      : card([...allInPlay(v), ...v.minions].find((p) => p.id === id)!);
  const modifiers = (v: GameState, id: string) => ({
    steady: !!v.flags[`steady:${id}`],
    stalwart: !!v.flags[`stalwart:${id}`],
  });
  const ports: pack.BrotherhoodPorts = {
    queue: (v, ...es) => v.queue.unshift(...es.map((e) => qualify(v, e))),
    choose: (v, title, text, options) => {
      v.prompt = {
        kind: "choice",
        title,
        text,
        options: options.map((o) => ({
          ...o,
          effects: o.effects.map((e) => qualify(v, e)),
        })),
      };
    },
    isTextBlank: (v, p) => !!v.flags[`blank:${p.id}`],
    hasTrait: (v, id, trait) =>
      !!v.flags[`trait:${id}:${trait}`] ||
      !![...v.minions, ...allInPlay(v)].find(
        (p) => p.id === id && card(p).traits?.split(/\.\s*/).includes(trait),
      ),
    controlledCharacters: (v) => [
      {
        id: `hero:${v.activePlayerId}`,
        label: heroCard(v).name,
        code: heroCard(v).code,
      },
      ...v.player.inPlay
        .filter((p) => card(p).type_code === "ally" && !p.treatedAsMinion)
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    canExhaustCharacter: (v, id) =>
      !!target(v, id) &&
      !target(v, id)!.exhausted &&
      !v.flags[`cannotExhaust:${id}`],
    exhaustCharacter: (v, id) => {
      target(v, id)!.exhausted = true;
      log.push(`exhaust:${id}`);
    },
    statusEligible: (v, id, status) => {
      const p = target(v, id);
      return (
        !!p && giveStatus({ ...p }, definition(v, id), status, modifiers(v, id))
      );
    },
    addStatus: (v, id, status) => {
      const p = target(v, id)!;
      giveStatus(p, definition(v, id), status, modifiers(v, id));
      log.push(`status:${id}:${status}`);
    },
    discardPlayerTop: vi.fn((v: GameState, pid: string, after: Effect[]) => {
      const player = seatView(v, pid).player,
        p = player.deck.shift();
      const emptied = !player.deck.length;
      if (p) {
        (card(p).faction_code === "encounter"
          ? v.encounter.discard
          : player.discard
        ).push(p);
        log.push(`mill:${pid}:${p.id}`);
      }
      if (emptied) {
        player.deck.push(...player.discard.splice(0));
        ports.queue(
          v,
          { type: "reset", playerId: pid },
          ...after.map((e) => ({ ...e, discardedPiece: p, deckEmptied: true })),
        );
      } else
        ports.queue(
          v,
          ...after.map((e) => ({
            ...e,
            discardedPiece: p,
            deckEmptied: false,
          })),
        );
    }),
    discardRandomHand: vi.fn((v: GameState, pid: string, after: Effect[]) => {
      const hand = seatView(v, pid).player.hand;
      if (hand.length) {
        v.seed = (Math.imul(v.seed, 1664525) + 1013904223) >>> 0;
        v.hiddenInfo = Number(v.hiddenInfo || 0) + 1;
        const p = hand.splice(v.seed % hand.length, 1)[0];
        (card(p).faction_code === "encounter"
          ? v.encounter.discard
          : seatView(v, pid).player.discard
        ).push(p);
        log.push(`random:${pid}:${p.id}`);
      }
      ports.queue(v, ...after);
    }),
    indirectDamage: vi.fn(
      (
        v: GameState,
        pid: string,
        amount: number,
        source: string,
        after: Effect[],
      ) => {
        log.push(`indirect:${pid}:${amount}:${source}`);
        ports.queue(v, ...after);
      },
    ),
    attachMinion: vi.fn(
      (v: GameState, id: string, minionId: string, boost: boolean) => {
        const zones = [
          v.resolving,
          v.encounter.deck,
          v.encounter.discard,
          v.encounter.dealt,
          ...(v.attack?.pendingBoosts ? [v.attack.pendingBoosts] : []),
        ];
        let found: Piece | undefined;
        for (const zone of zones) {
          const i = zone.findIndex((p) => p.id === id);
          if (i >= 0) {
            found = zone.splice(i, 1)[0];
            break;
          }
        }
        expect(found).toBeTruthy();
        found!.attachedTo = minionId;
        v.attachments.push(found!);
        log.push(`attach:${id}:${minionId}:${boost}`);
      },
    ),
    searchAndRevealSideScheme: vi.fn(
      (v: GameState, code: string, after: Effect[]) => {
        let entered = false;
        for (const zone of [v.encounter.deck, v.encounter.discard]) {
          const i = zone.findIndex((p) => p.code === code);
          if (i < 0) continue;
          const p = zone.splice(i, 1)[0];
          if (!v.sideSchemes.some((a) => a.code === code)) {
            p.counters = 3 + 2 * v.playerCount;
            v.sideSchemes.push(p);
            entered = true;
            log.push(`reveal-scheme:${p.id}`);
          } else v.encounter.discard.push(p);
          break;
        }
        log.push("shuffle-encounter");
        ports.queue(
          v,
          ...after.map((e) => ({
            ...e,
            entered:
              v.flags.searchEnteredOverride === undefined
                ? entered
                : !!v.flags.searchEnteredOverride,
          })),
        );
      },
    ),
    discardUntilMinion: vi.fn(
      (v: GameState, trait: string, after: Effect[]) => {
        let found: Piece | undefined;
        while (v.encounter.deck.length) {
          const p = v.encounter.deck.shift()!;
          v.encounter.discard.push(p);
          log.push(`encounter-mill:${p.id}`);
          if (
            card(p).type_code === "minion" &&
            card(p).traits?.split(/\.\s*/).includes(trait)
          ) {
            found = p;
            break;
          }
        }
        ports.queue(v, ...after.map((e) => ({ ...e, discardedPiece: found })));
      },
    ),
    revealDiscardedMinion: vi.fn(
      (v: GameState, p: Piece, pid: string, after: Effect[]) => {
        for (const zone of [
          v.encounter.deck,
          v.encounter.discard,
          v.encounter.dealt,
          v.resolving,
        ]) {
          const i = zone.findIndex((a) => a.id === p.id);
          if (i >= 0) zone.splice(i, 1);
        }
        p.engagedWith = pid;
        v.minions.push(p);
        log.push(`reveal-minion:${p.id}:${pid}`);
        ports.queue(v, ...after);
      },
    ),
  };
  const piece = (code: string, owner?: string) => {
    const p = makePiece(s, code);
    p.ownerId = owner;
    return p;
  };
  const minion = (code = "32073", pid = "p1") => {
    const p = piece(code);
    p.engagedWith = pid;
    s.minions.push(p);
    return p;
  };
  const ally = (code = "32041", pid = "p1") => {
    const p = piece(code, pid);
    seatView(s, pid).player.inPlay.push(p);
    return p;
  };
  const hand = (code: string, pid = "p1") => {
    const p = piece(
      code,
      card(code).faction_code === "encounter" ? undefined : pid,
    );
    seatView(s, pid).player.hand.push(p);
    return p;
  };
  const receipt = (
    code: string,
    args: Partial<pack.BrotherhoodAttackReceipt> = {},
  ): pack.BrotherhoodAttackReceipt => ({
    token: `actual:${s.nextId++}`,
    attackerId: minion(code).id,
    attackerCode: code,
    playerId: "p1",
    performed: true,
    textBlank: false,
    targetId: "hero:p1",
    damageTaken: 1,
    targetControllerId: "p1",
    ...args,
  });
  const run = () => {
    for (let n = 0; s.queue.length && !s.prompt && n < 100; n++) {
      const e = s.queue.shift()!;
      if (e.actorId) activateSeat(s, e.actorId);
      if (!pack.resolveBrotherhoodEffect(s, e, ports))
        log.push(
          e.type === "surge"
            ? "surge"
            : e.type === "reset"
              ? `reset:${e.playerId}`
              : e.type,
        );
    }
  };
  const start = (...effects: Effect[]) => {
    ports.queue(s, ...effects);
    run();
  };
  const choose = (id: string) => {
    s = JSON.parse(JSON.stringify(s));
    const seat = s.players.find((p) => p.id === s.activePlayerId)!;
    seat.player = s.player;
    seat.flags = s.flags;
    const o = s.prompt?.options.find((o) => o.id === id);
    expect(o, JSON.stringify(s.prompt)).toBeTruthy();
    s.prompt = null;
    ports.queue(s, ...o!.effects);
    run();
  };
  return {
    get s() {
      return s;
    },
    ports,
    log,
    piece,
    minion,
    ally,
    hand,
    receipt,
    start,
    choose,
    run,
  };
}

describe("Brotherhood original modular encounter set", () => {
  it("covers exact seven faces/eight physical cards, preserving frozen quantities and metadata", () => {
    const source = (
      catalog as unknown as {
        code: string;
        set_code?: string;
        quantity: number;
      }[]
    ).filter((c) => c.set_code === "brotherhood");
    expect(source.map((c) => c.code)).toEqual([
      ...pack.BROTHERHOOD_SCRIPT_CODES,
    ]);
    expect(source.reduce((n, c) => n + c.quantity, 0)).toBe(8);
    expect(card("32077").quantity).toBe(2);
    for (const code of ["32073", "32074", "32075", "32076"]) {
      expect(card(code).is_unique).toBe(true);
      expect(card(code).attack).not.toBeUndefined();
    }
  });
  it.each([1, 2, 3])(
    "Brotherhood fixed base3 plus ordinary Hinder2 per each of%s players",
    (n) => {
      expect(card("32079").base_threat_fixed).toBe(true);
      expect(card("32079").base_threat).toBe(3);
      expect(scaledKeyword(card("32079"), "Hinder", n)).toBe(2 * n);
      expect(card("32079").scheme_hazard).toBe(1);
    },
  );
  it.each(["32073", "32074", "32075", "32076", "32079"])(
    "%s has no duplicate authored When Revealed or Hinder instruction",
    (code) => {
      const f = fixture(),
        p = f.piece(code);
      expect(pack.brotherhoodReveal(f.s, p, f.ports)).toEqual([]);
    },
  );
  it("keeps Blob's Guard as the ordinary printed native keyword", () =>
    expect(printedKeyword(card("32074"), "Guard")).toBe(1));
  it("unrelated encounter faces fall through authored dispatch", () => {
    const f = fixture(),
      p = f.piece("01104");
    expect(pack.brotherhoodReveal(f.s, p, f.ports)).toBeNull();
    expect(pack.brotherhoodBoost(f.s, p)).toBeNull();
    expect(pack.resolveBrotherhoodEffect(f.s, { type: "other" }, f.ports)).toBe(
      false,
    );
  });
  it("The Brotherhood grants Quickstrike to all live Brotherhood-trait minions including Mystique", () => {
    const f = fixture(),
      a = f.minion(),
      m = f.minion("32080"),
      other = f.minion("01103"),
      scheme = f.piece("32079");
    f.s.sideSchemes.push(scheme);
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).quickstrike).toBe(true);
    expect(pack.brotherhoodModifiers(f.s, m, f.ports).quickstrike).toBe(true);
    expect(pack.brotherhoodModifiers(f.s, other, f.ports).quickstrike).toBe(
      false,
    );
  });
  it("Quickstrike follows live unblanked source while recipient blanking retains grant", () => {
    const f = fixture(),
      a = f.minion(),
      scheme = f.piece("32079");
    f.s.sideSchemes.push(scheme);
    f.s.flags[`blank:${a.id}`] = true;
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).quickstrike).toBe(true);
    f.s.flags[`blank:${scheme.id}`] = true;
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).quickstrike).toBe(false);
    delete f.s.flags[`blank:${scheme.id}`];
    f.s.sideSchemes = [];
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).quickstrike).toBe(false);
  });
  it("Quickstrike uses current native trait grants but never grants to a card outside minion play", () => {
    const f = fixture(),
      a = f.minion("01103"),
      scheme = f.piece("32079");
    f.s.sideSchemes.push(scheme);
    f.s.flags[`trait:${a.id}:Brotherhood of Mutants`] = true;
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).quickstrike).toBe(true);
    f.s.minions = [];
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).quickstrike).toBe(false);
  });
  it("Homo Superior grants +5 each through attachment text and never through recipient text", () => {
    const f = fixture(),
      a = f.minion(),
      one = f.piece("32077"),
      two = f.piece("32077");
    one.attachedTo = two.attachedTo = a.id;
    f.s.attachments.push(one, two);
    f.s.flags[`blank:${a.id}`] = true;
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).health).toBe(10);
    f.s.flags[`blank:${one.id}`] = true;
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).health).toBe(5);
    f.s.minions = [];
    expect(pack.brotherhoodModifiers(f.s, a, f.ports).health).toBe(0);
  });
  it.each([false, true])(
    "Homo Superior boost=%s attaches same physical card to any actual minion",
    (boost) => {
      const f = fixture(),
        a = f.minion("01103"),
        h = f.piece("32077");
      if (boost) {
        f.s.attack = {
          attacker: f.s.villain.id,
          isVillain: true,
          base: 2,
          boostCodes: [],
          boostEffects: [],
          defense: 0,
          prevented: 0,
          damage: 0,
          overkill: false,
          pendingBoosts: [h],
        };
        f.start(...pack.brotherhoodBoost(f.s, h)!);
      } else {
        f.s.resolving.push(h);
        f.start(...pack.brotherhoodReveal(f.s, h, f.ports)!);
      }
      f.choose(a.id);
      expect(f.s.attachments[0]).toMatchObject({
        id: h.id,
        code: "32077",
        attachedTo: a.id,
      });
      expect(f.s.minions[0].tough).toBe(true);
      expect(f.s.attack?.pendingBoosts || []).toEqual([]);
      expect(card(h).boost).toBe(1);
      expect(
        pack.brotherhoodModifiers(f.s, f.s.minions[0], f.ports).health,
      ).toBe(5);
    },
  );
  it.each([false, true])(
    "Homo Superior boost=%s attaches already Tough target without Surge or extra Tough",
    (boost) => {
      const f = fixture(),
        a = f.minion(),
        h = f.piece("32077");
      a.tough = true;
      a.toughCards = 1;
      f.s.resolving.push(h);
      f.start(
        ...(boost
          ? pack.brotherhoodBoost(f.s, h)
          : pack.brotherhoodReveal(f.s, h, f.ports))!,
      );
      f.choose(a.id);
      expect(f.s.attachments).toHaveLength(1);
      expect(f.s.minions[0].toughCards).toBe(1);
      expect(f.log).not.toContain("surge");
    },
  );
  it.each(["steady", "stalwart"])(
    "Homo Superior can give Tough to a%s minion",
    (keyword) => {
      const f = fixture(),
        a = f.minion(),
        h = f.piece("32077");
      f.s.flags[`${keyword}:${a.id}`] = true;
      f.s.resolving.push(h);
      f.start(...pack.brotherhoodReveal(f.s, h, f.ports)!);
      f.choose(a.id);
      expect(f.s.minions[0].tough).toBe(true);
    },
  );
  it("Homo Superior reveal with no minion gains Surge; boost with no minion does not", () => {
    const f = fixture(),
      h = f.piece("32077");
    f.start(...pack.brotherhoodReveal(f.s, h, f.ports)!);
    expect(f.log).toEqual(["surge"]);
    f.log.length = 0;
    f.start(...pack.brotherhoodBoost(f.s, h)!);
    expect(f.log).toEqual([]);
  });
  it("Homo Superior revalidates saved minion target and never attaches a lost target", () => {
    const f = fixture(),
      a = f.minion(),
      h = f.piece("32077");
    f.s.resolving.push(h);
    f.start(...pack.brotherhoodReveal(f.s, h, f.ports)!);
    f.s.minions = [];
    expect(() => f.choose(a.id)).toThrow(/actual minion/);
    expect(f.ports.attachMinion).not.toHaveBeenCalled();
  });
  it("blanked attachment/treachery reveal does not resolve its textbox", () => {
    const f = fixture();
    for (const code of ["32077", "32078"]) {
      const p = f.piece(code);
      f.s.flags[`blank:${p.id}`] = true;
      expect(pack.brotherhoodReveal(f.s, p, f.ports)).toEqual([]);
    }
  });
  it.each([0, 2])(
    "Avalanche completed attack damage=%s still exhausts an actual controlled character after reload",
    (damageTaken) => {
      const f = fixture(),
        a = f.ally(),
        r = f.receipt("32073", { damageTaken });
      f.start(...pack.brotherhoodAfterAttack(f.s, r));
      f.choose(a.id);
      expect(allInPlay(f.s).find((p) => p.id === a.id)!.exhausted).toBe(true);
      expect(f.s.player.exhausted).toBe(false);
    },
  );
  it("Avalanche can exhaust the actual controlled NPC Kelly", () => {
    const f = fixture(),
      kelly = f.ally("32066"),
      r = f.receipt("32073", { damageTaken: 0 });
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    f.choose(kelly.id);
    expect(allInPlay(f.s).find((p) => p.id === kelly.id)!.exhausted).toBe(true);
  });
  it("Avalanche targets only actual attacked player's ready controlled characters", () => {
    const f = fixture(),
      one = f.ally(),
      two = f.ally("32041", "p2"),
      r = f.receipt("32073", {
        playerId: "p2",
        targetId: "hero:p2",
        targetControllerId: "p2",
      });
    one.exhausted = false;
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["hero:p2", two.id]);
    f.choose("hero:p2");
    expect(seatView(f.s, "p2").player.exhausted).toBe(true);
    expect(seatView(f.s, "p1").player.exhausted).toBe(false);
  });
  it("Avalanche has no exhaust choice when all controlled characters are exhausted", () => {
    const f = fixture(),
      a = f.ally(),
      r = f.receipt("32073");
    a.exhausted = f.s.player.exhausted = true;
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.prompt).toBeNull();
  });
  it("Avalanche boost exhausts a real ready character independently of completed attack", () => {
    const f = fixture(),
      a = f.ally(),
      p = f.piece("32073");
    f.start(...pack.brotherhoodBoost(f.s, p)!);
    f.choose(a.id);
    expect(allInPlay(f.s).find((p) => p.id === a.id)!.exhausted).toBe(true);
  });
  it("Avalanche revalidates physical controlled exhaustion target", () => {
    const f = fixture(),
      a = f.ally(),
      r = f.receipt("32073");
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    a.exhausted = true;
    expect(() => f.choose(a.id)).toThrow(/ready character/);
  });
  it.each(["32073", "32074", "32075", "32076"])(
    "%s never triggers after Stun replacement or captured blank source",
    (code) => {
      const f = fixture(),
        r = f.receipt(code);
      expect(
        pack.brotherhoodAfterAttack(f.s, { ...r, performed: false }),
      ).toEqual([]);
      expect(
        pack.brotherhoodAfterAttack(f.s, { ...r, textBlank: true }),
      ).toEqual([]);
    },
  );
  it("same completed attack receipt resolves its forced response only once", () => {
    const f = fixture(),
      r = f.receipt("32073");
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    f.choose("hero:p1");
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.prompt).toBeNull();
    expect(f.log).toEqual(["exhaust:hero:p1"]);
  });
  it.each(["hero:p1", "ally", "kelly"])(
    "Blob stuns actual positive-damage recipient%s",
    (kind) => {
      const f = fixture(),
        a =
          kind === "ally"
            ? f.ally()
            : kind === "kelly"
              ? f.ally("32066")
              : undefined,
        id = a?.id || "hero:p1",
        r = f.receipt("32074", { targetId: id });
      f.start(...pack.brotherhoodAfterAttack(f.s, r));
      const p = id.startsWith("hero:")
        ? f.s.player
        : allInPlay(f.s).find((p) => p.id === id)!;
      expect(p.stunned).toBe(true);
      expect(f.log).toEqual([`status:${id}:stunned`]);
    },
  );
  it("Blob uses actual Kelly recipient even when Kelly is controlled by a different player", () => {
    const f = fixture(),
      kelly = f.ally("32066"),
      r = f.receipt("32074", {
        playerId: "p2",
        targetId: kelly.id,
        targetControllerId: "p1",
      });
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(allInPlay(f.s).find((p) => p.id === kelly.id)!.stunned).toBe(true);
    expect(seatView(f.s, "p2").player.stunned).toBe(false);
  });
  it.each(["32074", "32076"])(
    "%s ignores zero actual damage after prevention/Tough",
    (code) => {
      const f = fixture(),
        r = f.receipt(code, { damageTaken: 0 });
      expect(pack.brotherhoodAfterAttack(f.s, r)).toEqual([]);
    },
  );
  it("Blob respects native Stalwart and Steady status limits", () => {
    const f = fixture(),
      r = f.receipt("32074");
    f.s.flags["stalwart:hero:p1"] = true;
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.player.stunned).toBe(false);
    delete f.s.flags["stalwart:hero:p1"];
    f.s.flags["steady:hero:p1"] = true;
    f.start(...pack.brotherhoodAfterAttack(f.s, { ...r, token: "next" }));
    expect(f.s.player.stunCards).toBe(1);
    expect(f.s.player.stunned).toBe(false);
    f.start(...pack.brotherhoodAfterAttack(f.s, { ...r, token: "third" }));
    expect(f.s.player.stunCards).toBe(2);
    expect(f.s.player.stunned).toBe(true);
  });
  it("Blob's already-triggered response survives later source blanking", () => {
    const f = fixture(),
      r = f.receipt("32074");
    f.s.flags[`blank:${r.attackerId}`] = true;
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.player.stunned).toBe(true);
  });
  it.each([
    ["32022", 2],
    ["32023", 2],
    ["32024", 2],
    ["32018", 1],
    ["32047", 1],
    ["32013", 1],
    ["32082", 0],
    ["32083", 0],
  ] as const)("Pyro counts%s printed resource icons=%s", (code, count) => {
    const f = fixture();
    expect(pack.brotherhoodPrintedResources(f.piece(code))).toBe(count);
  });
  it("Pyro actual zero-damage attack discards exact top2 and deals indirect double+wild total", () => {
    const f = fixture(),
      r = f.receipt("32075", { damageTaken: 0 }),
      first = f.piece("32022", "p1"),
      second = f.piece("32047", "p1"),
      third = f.piece("32013", "p1");
    f.s.player.deck = [first, second, third];
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.player.discard.map((p) => p.id)).toEqual([first.id, second.id]);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([third.id]);
    expect(f.log).toEqual([
      `mill:p1:${first.id}`,
      `mill:p1:${second.id}`,
      `indirect:p1:3:${r.attackerId}`,
    ]);
  });
  it("Pyro stops first native player-deck exhaustion and counts exact last discarded physical card", () => {
    const f = fixture(),
      r = f.receipt("32075"),
      only = f.piece("32023", "p1"),
      old = f.piece("32022", "p1");
    f.s.player.deck = [only];
    f.s.player.discard = [old];
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.ports.discardPlayerTop).toHaveBeenCalledTimes(1);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([old.id, only.id]);
    expect(f.log).toEqual([
      `mill:p1:${only.id}`,
      "reset:p1",
      `indirect:p1:2:${r.attackerId}`,
    ]);
  });
  it("Pyro preserves physical Shapeshifter and counts its actual zero rather than generated resources", () => {
    const f = fixture(),
      r = f.receipt("32075"),
      shape = f.piece("32083"),
      resource = f.piece("32024", "p1"),
      third = f.piece("32013", "p1");
    f.s.player.deck = [shape, resource, third];
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.encounter.discard.map((p) => p.id)).toContain(shape.id);
    expect(f.log.at(-1)).toBe(`indirect:p1:2:${r.attackerId}`);
    expect(f.ports.indirectDamage).toHaveBeenCalledTimes(1);
  });
  it("Pyro resets before indirect assignment when the second discard empties the deck", () => {
    const f = fixture(),
      r = f.receipt("32075"),
      a = f.piece("32022", "p1"),
      b = f.piece("32023", "p1");
    f.s.player.deck = [a, b];
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.log).toEqual([
      `mill:p1:${a.id}`,
      `mill:p1:${b.id}`,
      "reset:p1",
      `indirect:p1:4:${r.attackerId}`,
    ]);
  });
  it("Pyro routes actual deck and indirect damage to cooperative defending player", () => {
    const f = fixture(),
      r = f.receipt("32075", {
        playerId: "p2",
        targetId: "hero:p2",
        targetControllerId: "p2",
      }),
      a = f.piece("32052", "p2"),
      b = f.piece("32053", "p2"),
      third = f.piece("32043", "p2");
    seatView(f.s, "p2").player.deck = [a, b, third];
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(seatView(f.s, "p1").player.discard).toEqual([]);
    expect(seatView(f.s, "p2").player.discard.map((p) => p.id)).toEqual([
      a.id,
      b.id,
    ]);
    expect(f.log.at(-1)).toBe(`indirect:p2:4:${r.attackerId}`);
  });
  it("Pyro all-zero or empty actual discard never fabricates indirect damage", () => {
    const f = fixture(),
      r = f.receipt("32075");
    f.s.player.deck = [
      f.piece("32082"),
      f.piece("32083"),
      f.piece("32013", "p1"),
    ];
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.ports.indirectDamage).not.toHaveBeenCalled();
    f.s.player.deck = [];
    f.start(...pack.brotherhoodAfterAttack(f.s, { ...r, token: "next" }));
    expect(f.ports.indirectDamage).not.toHaveBeenCalled();
  });
  it("Toad uses captured controller after a damaged ally has been defeated and discarded", () => {
    const f = fixture(),
      victim = f.ally(),
      h = f.hand("32013"),
      r = f.receipt("32076", { targetId: victim.id });
    f.s.player.inPlay = [];
    f.s.player.discard = [victim];
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.player.hand).toEqual([]);
    expect(f.s.player.discard.map((p) => p.id)).toContain(h.id);
  });
  it("Toad does not discard when the actual damaged character belonged to another controller", () => {
    const f = fixture(),
      h = f.hand("32013"),
      r = f.receipt("32076", { targetControllerId: "p2" });
    expect(pack.brotherhoodAfterAttack(f.s, r)).toEqual([]);
    expect(f.s.player.hand[0].id).toBe(h.id);
  });
  it("Toad boost random discard moves the same physical hand Shapeshifter", () => {
    const f = fixture(),
      shape = f.hand("32082"),
      p = f.piece("32076"),
      seed = f.s.seed;
    f.start(...pack.brotherhoodBoost(f.s, p)!);
    expect(f.s.player.hand).toEqual([]);
    expect(f.s.encounter.discard[0]).toMatchObject({
      id: shape.id,
      code: "32082",
    });
    expect(f.s.seed).not.toBe(seed);
    expect(f.s.hiddenInfo).toBeGreaterThan(0);
  });
  it("Toad delegates deterministic random discard to the actual attacked player's native port", () => {
    const f = fixture(),
      h = f.hand("32043", "p2"),
      local = f.hand("32013"),
      r = f.receipt("32076", {
        playerId: "p2",
        targetId: "hero:p2",
        targetControllerId: "p2",
      });
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(seatView(f.s, "p2").player.discard.map((p) => p.id)).toContain(h.id);
    expect(seatView(f.s, "p1").player.hand.map((p) => p.id)).toContain(
      local.id,
    );
    expect(f.ports.discardRandomHand).toHaveBeenCalledTimes(1);
  });
  it("Toad empty hand resolves without synthetic cards or RNG advancement", () => {
    const f = fixture(),
      r = f.receipt("32076"),
      seed = f.s.seed;
    f.start(...pack.brotherhoodAfterAttack(f.s, r));
    expect(f.s.seed).toBe(seed);
    expect(f.s.player.discard).toEqual([]);
  });
  it.each(["deck", "discard"] as const)(
    "Mutant Terrorists searches actual%s, reveals physical Brotherhood scheme, then shuffles",
    (zone) => {
      const f = fixture(),
        terror = f.piece("32078"),
        scheme = f.piece("32079");
      f.s.encounter[zone].push(scheme);
      f.start(...pack.brotherhoodReveal(f.s, terror, f.ports)!);
      expect(f.s.sideSchemes[0].id).toBe(scheme.id);
      expect(f.s.sideSchemes[0].counters).toBe(7);
      expect(f.log).toEqual([
        `reveal-scheme:${scheme.id}`,
        "shuffle-encounter",
      ]);
      expect(f.ports.discardUntilMinion).not.toHaveBeenCalled();
    },
  );
  it("Mutant Terrorists already-in-play scheme falls back to native discard until and REVEAL exact Mystique", () => {
    const f = fixture(),
      terror = f.piece("32078"),
      scheme = f.piece("32079"),
      miss = f.piece("01104"),
      mystique = f.piece("32080");
    f.s.sideSchemes = [scheme];
    f.s.encounter.deck = [miss, mystique];
    f.start(...pack.brotherhoodReveal(f.s, terror, f.ports)!);
    expect(f.ports.searchAndRevealSideScheme).toHaveBeenCalledTimes(1);
    expect(f.s.minions[0]).toMatchObject({
      id: mystique.id,
      code: "32080",
      engagedWith: "p1",
    });
    expect(f.log).toEqual([
      "shuffle-encounter",
      `encounter-mill:${miss.id}`,
      `encounter-mill:${mystique.id}`,
      `reveal-minion:${mystique.id}:p1`,
    ]);
    expect(f.ports.revealDiscardedMinion).toHaveBeenCalledTimes(1);
  });
  it("Mutant Terrorists falls back if the searched scheme could not enter, not merely if it was found", () => {
    const f = fixture(),
      terror = f.piece("32078"),
      existing = f.piece("32079"),
      searched = f.piece("32079"),
      m = f.piece("32073");
    f.s.sideSchemes = [existing];
    f.s.encounter.deck = [searched, m];
    f.start(...pack.brotherhoodReveal(f.s, terror, f.ports)!);
    expect(f.s.minions[0].id).toBe(m.id);
    expect(f.s.sideSchemes.map((p) => p.id)).toEqual([existing.id]);
  });
  it("Mutant Terrorists captured true entry is not reversed by later game-state changes", () => {
    const f = fixture();
    f.start({
      type: "brotherhood:terrorists-result",
      id: "actual",
      playerId: "p1",
      entered: true,
    });
    expect(f.ports.discardUntilMinion).not.toHaveBeenCalled();
  });
  it("Mutant Terrorists missing scheme/minion completes with no cloned card or PUT", () => {
    const f = fixture(),
      terror = f.piece("32078"),
      miss = f.piece("01104");
    f.s.encounter.deck = [miss];
    f.start(...pack.brotherhoodReveal(f.s, terror, f.ports)!);
    expect(f.s.minions).toEqual([]);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([miss.id]);
    expect(f.ports.revealDiscardedMinion).not.toHaveBeenCalled();
  });
  it("Mutant Terrorists retains actual revealed player during cooperative fallback", () => {
    const f = fixture(),
      terror = f.piece("32078"),
      m = f.piece("32075");
    activateSeat(f.s, "p2");
    f.s.encounter.deck = [m];
    f.start(...pack.brotherhoodReveal(f.s, terror, f.ports)!);
    expect(f.s.minions[0].engagedWith).toBe("p2");
  });
});
