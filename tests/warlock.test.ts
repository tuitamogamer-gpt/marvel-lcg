import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import {
  consumeStatus,
  consumeTough,
  printedKeyword,
  statusCards,
} from "../src/game/keywords.js";
import { allInPlay, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  WARLOCK_SCRIPT_CODES,
  resolveWarlockEffect,
  warlockAbility,
  warlockAbilityOptions,
  warlockAttackInitiatedOptions,
  warlockBeforeEvent,
  warlockBoost,
  warlockDeckExhausted,
  warlockDeckReset,
  warlockDistinctAspects,
  warlockEncounterReveal,
  warlockEnemyActivated,
  warlockEvent,
  warlockForcedTreacheryInterrupt,
  warlockInitializeNemesis,
  warlockPhaseEnded,
  warlockPlayRestriction,
  warlockResourceSources,
  warlockResourceSpent,
  warlockRoundEnded,
  warlockSchemeLocked,
  warlockShadowOfPast,
  warlockStats,
  type WarlockPorts,
} from "../src/game/warlock.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const W = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `warlock:${type}`,
  ...args,
});
function reload(s: GameState): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s));
  const active = copy.players.find((seat) => seat.id === copy.activePlayerId)!;
  active.player = copy.player;
  active.flags = copy.flags;
  return copy;
}
function fixture(team = false) {
  const s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId: "rhino",
    seed: 21031,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "rocket", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  s.phase = "player";
  s.heroId = s.players[0].heroId = "warlock";
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.exhausted = false;
    v.player.flipped = false;
  }
  s.player.hp = 11;
  s.players[0].player = s.player;
  s.flags = {};
  s.players[0].flags = s.flags;
  delete s.player.setAside;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.resolving = [];
  s.removed = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.attack = null;
  s.villain.hp = 50;
  s.villain.tough = false;
  s.encounter.deck = [];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.scheme.threat = 20;
  s.hiddenInfo = 0;
  const f: {
    s: GameState;
    damagePackets: Effect[];
    thwartPackets: Effect[];
    history: string[];
    ports: WarlockPorts;
    piece(code: string, playerId?: string): Piece;
  } = {
    s,
    damagePackets: [] as Effect[],
    thwartPackets: [] as Effect[],
    history: [] as string[],
    ports: {} as WarlockPorts,
    piece: (code: string, playerId = f.s.activePlayerId) => ({
      ...makePiece(f.s, code),
      ownerId: playerId,
    }),
  };
  const exhaustDeck = (state: GameState) => {
    if (state.player.deck.length || !state.player.discard.length) return;
    const soul = warlockDeckExhausted(state);
    state.player.deck = state.player.discard.splice(0);
    state.encounter.dealt.push(makePiece(state, "01104"));
    f.ports.queue(state, ...warlockDeckReset(state), ...soul);
  };
  f.ports = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: (state) => {
      state.player.form = state.player.form === "hero" ? "alter" : "hero";
    },
    canReadyIdentity: (state) => !state.flags.cannotReady,
    canPay: vi.fn(() => true),
    canGiveStatus: () => true,
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some((p) => printedKeyword(cards.get(p.code)!, "Guard"))
        ? [{ id: state.villain.id, label: "Rhino" }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(state.scheme.threat > 0 &&
      !state.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis) &&
      (!thwart ||
        !state.minions.some((p) =>
          printedKeyword(cards.get(p.code)!, "Patrol"),
        ))
        ? [{ id: "main", label: "Main scheme" }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0 && !warlockSchemeLocked(state, p.id))
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    discardHand: (state, id) => {
      const index = state.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Missing actual hand card");
      state.player.discard.push(state.player.hand.splice(index, 1)[0]);
    },
    discardPiece: (state, id) => {
      const index = state.player.inPlay.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Missing actual controlled card");
      state.player.discard.push(state.player.inPlay.splice(index, 1)[0]);
    },
    revealHidden: (state) => {
      state.hiddenInfo = Number(state.hiddenInfo || 0) + 1;
    },
    recycleEncounter: vi.fn(),
    attackProgram: (state, effects, after) =>
      f.ports.queue(state, ...effects, ...after),
    log: vi.fn(),
    makePiece: (state, code) => makePiece(state, code),
    shuffleEncounter: vi.fn(),
    discardPlayerCards: vi.fn((state, count) => {
      const pieces = state.player.deck.splice(0, count);
      state.player.discard.push(...pieces);
      for (const _p of pieces) f.ports.revealHidden(state);
      if (pieces.length) exhaustDeck(state);
      return pieces;
    }),
    heroMaxHP: () => 11,
    removeIdentityStatusCard: (state, status) => {
      const count = statusCards(state.player, status);
      if (!count) return false;
      const key =
        status === "stunned"
          ? "stunCards"
          : status === "confused"
            ? "confuseCards"
            : "toughCards";
      state.player[key] = count - 1;
      state.player[status] = count > 1;
      return true;
    },
    putAllyFromHand: (state, id, playerId) => {
      const index = state.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Missing physical ally");
      const p = state.player.hand.splice(index, 1)[0];
      p.tough = true;
      p.toughCards = 1;
      seatView(state, playerId).player.inPlay.push(p);
    },
    canPutAlly: (state, p) =>
      !allInPlay(state).some(
        (x) => cards.get(x.code)?.name === cards.get(p.code)?.name,
      ),
    canCancelTreachery: (state, p) =>
      !state.flags[`canceled:${p.id}`] && !state.flags[`uncancelable:${p.id}`],
    cancelWhenRevealed: (state, p, after) => {
      state.flags[`canceled:${p.id}`] = true;
      f.ports.queue(
        state,
        ...after,
        ...(printedKeyword(cards.get(p.code)!, "Surge")
          ? [{ type: "surge" }]
          : []),
        ...(printedKeyword(cards.get(p.code)!, "Incite")
          ? [{ type: "threat", target: "main", amount: 2 }]
          : []),
      );
    },
    findAndRevealEncounter: vi.fn((state: GameState, code: string) => {
      const reserved = new Set(
        String(state.flags.warlockReservedNemesis || "").split(","),
      );
      for (const zone of [
        state.encounter.deck,
        state.encounter.discard,
        ...state.players.map(
          (seat) => seatView(state, seat).player.setAside || [],
        ),
      ]) {
        const index = zone.findIndex(
          (p) => p.code === code && !reserved.has(p.id),
        );
        if (index >= 0) {
          f.ports.queue(state, {
            type: "reveal",
            piece: zone.splice(index, 1)[0],
          });
          break;
        }
      }
      f.ports.shuffleEncounter(state);
    }),
    putBoostMinion: (state, p, playerId) => {
      p.engagedWith = playerId;
      state.minions.push(p);
    },
    revealBoostCard: (state, p) =>
      f.ports.queue(state, { type: "reveal", piece: p }),
  };
  function pump() {
    for (let n = 0; f.s.queue.length && !f.s.prompt && n < 200; n++) {
      const e = f.s.queue.shift()!;
      f.history.push(e.type);
      if (resolveWarlockEffect(f.s, e, f.ports)) continue;
      switch (e.type) {
        case "nativeEvent": {
          const attack = e.piece.code === "21038",
            thwart = e.piece.code === "21039";
          if (attack && f.s.player.stunned)
            consumeStatus(f.s.player, "stunned");
          else if (thwart && f.s.player.confused)
            consumeStatus(f.s.player, "confused");
          else
            f.ports.queue(
              f.s,
              ...(warlockEvent(f.s, e.piece, e.warlockDiscarded || []) || []),
            );
          break;
        }
        case "damage": {
          f.damagePackets.push(e);
          const target =
            e.target === f.s.villain.id
              ? f.s.villain
              : f.s.minions.find((p) => p.id === e.target);
          if (!target) break;
          if (consumeTough(target)) break;
          if (e.target === f.s.villain.id) f.s.villain.hp -= e.amount;
          else target.damage += e.amount;
          break;
        }
        case "thwart": {
          f.thwartPackets.push(e);
          if (e.target === "main")
            f.s.scheme.threat = Math.max(0, f.s.scheme.threat - e.amount);
          else {
            const p = f.s.sideSchemes.find((p) => p.id === e.target);
            if (p) p.counters = Math.max(0, p.counters - e.amount);
          }
          break;
        }
        case "heal":
          if (e.target === "hero")
            f.s.player.hp = Math.min(11, f.s.player.hp + e.amount);
          else {
            const p = allInPlay(f.s).find((p) => p.id === e.target);
            if (p) p.damage = Math.max(0, p.damage - e.amount);
          }
          break;
        case "ready":
          f.s.player.exhausted = false;
          break;
        case "draw":
          for (let i = 0; i < e.amount; i++) {
            const p = f.s.player.deck.shift();
            if (p) f.s.player.hand.push(p);
            exhaustDeck(f.s);
          }
          break;
        case "status":
          f.s.player[e.status as "stunned"] = true;
          break;
        case "flip":
          f.s.player.form =
            e.target || (f.s.player.form === "hero" ? "alter" : "hero");
          break;
        case "optional":
          f.ports.choose(f.s, e.title, e.text, [
            { id: "yes", label: "Use response", effects: e.effects },
            { id: "no", label: "Skip", effects: [] },
          ]);
          break;
        case "discardEncounter": {
          f.s.resolving = f.s.resolving.filter((p) => p.id !== e.piece.id);
          if (!f.s.encounter.discard.some((p) => p.id === e.piece.id))
            f.s.encounter.discard.push(e.piece);
          break;
        }
        case "removeEncounter":
          f.s.resolving = f.s.resolving.filter((p) => p.id !== e.piece.id);
          f.s.removed.push(e.piece);
          break;
        case "threat":
          f.s.scheme.threat += e.amount;
          break;
        case "surge":
          f.s.encounter.dealt.push(makePiece(f.s, "01104"));
          break;
        case "reveal": {
          const p: Piece = e.piece,
            c = cards.get(p.code)!;
          if (c.type_code === "minion") {
            p.engagedWith = f.s.activePlayerId;
            p.tough = !!printedKeyword(c, "Toughness");
            f.s.minions.push(p);
          } else if (c.type_code === "side_scheme") {
            p.counters = c.base_threat || 0;
            f.s.sideSchemes.push(p);
          } else f.s.resolving.push(p);
          f.ports.queue(f.s, ...(warlockEncounterReveal(f.s, p) || []));
          break;
        }
        case "sentinel":
          f.s.flags.sentinel = true;
          break;
        default:
          throw Error(`Unhandled test host effect ${e.type}`);
      }
    }
    return f.s;
  }
  function resolve(...effects: Effect[]) {
    f.ports.queue(f.s, ...effects);
    return pump();
  }
  function choose(id: string) {
    expect(f.s.prompt?.kind, JSON.stringify(f.s.prompt)).toBe("choice");
    const o = f.s.prompt!.options.find((o) => o.id === id);
    expect(o, JSON.stringify(f.s.prompt)).toBeTruthy();
    f.s.prompt = null;
    return resolve(...o!.effects);
  }
  return Object.assign(f, { resolve, choose, pump, exhaustDeck });
}
type Fixture = ReturnType<typeof fixture>;
function add(
  f: Fixture,
  code: string,
  zone: "hand" | "deck" | "discard" | "inPlay" = "inPlay",
  playerId = f.s.activePlayerId,
) {
  const p = f.piece(code, playerId);
  seatView(f.s, playerId).player[zone].push(p);
  return p;
}
function mage(f: Fixture, p: Piece, target?: string) {
  expect(warlockAbility(f.s, "hero", f.ports, "battle-mage")).toBe(true);
  f.pump();
  f.choose(p.id);
  if (target) f.choose(target);
}
function conserved(s: GameState, pieces: Piece[]) {
  const physical = [
    s.villain,
    ...s.minions,
    ...s.sideSchemes,
    ...s.resolving,
    ...s.removed,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
  ];
  for (const p of pieces)
    expect(
      physical.filter((x) => x.id === p.id),
      `${p.code}:${p.id}`,
    ).toHaveLength(1);
}

describe("original Warlock catalog and physical nemesis", () => {
  it("covers sixteen faces and fifteen physical signatures from original quantities", () => {
    expect(WARLOCK_SCRIPT_CODES).toHaveLength(16);
    expect(new Set(WARLOCK_SCRIPT_CODES).size).toBe(16);
    expect(WARLOCK_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(
      WARLOCK_SCRIPT_CODES.filter((code) =>
        /^210(3[2-9]|40)$/.test(code),
      ).reduce((sum, code) => sum + cards.get(code)!.quantity, 0),
    ).toBe(15);
    expect(cards.get("21031a")).toMatchObject({
      attack: 1,
      thwart: 1,
      defense: 2,
      health: 11,
      hand_size: 5,
    });
    expect(cards.get("21031b")).toMatchObject({ recover: 3, hand_size: 6 });
    expect(!!printedKeyword(cards.get("21032")!, "Toughness")).toBe(true);
    expect(!!printedKeyword(cards.get("21032")!, "Retaliate")).toBe(false);
  });
  it("initializes exactly five distinct physical cards and never replenishes empty or existing zones", () => {
    const f = fixture();
    warlockInitializeNemesis(f.s, f.ports);
    const original = f.s.player.setAside!;
    expect(original.map((p) => p.code)).toEqual([
      "21067",
      "21068",
      "21069",
      "21069",
      "21070",
    ]);
    expect(new Set(original.map((p) => p.id)).size).toBe(5);
    warlockInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toBe(original);
    f.s.player.setAside = [];
    warlockInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside).toEqual([]);
  });
  it("delayed Shadows preserves every source until its reveal and shuffles only the actual remaining cards", () => {
    const f = fixture();
    warlockInitializeNemesis(f.s, f.ports);
    const original = [...f.s.player.setAside!],
      effects = warlockShadowOfPast(f.s)!;
    expect(f.s.player.setAside).toHaveLength(5);
    expect(effects.slice(0, 2).map((e) => e.type)).toEqual([
      "warlock:reveal-setaside",
      "warlock:reveal-setaside",
    ]);
    f.s = reload(f.s);
    f.resolve(...effects);
    expect(f.s.player.setAside).toHaveLength(0);
    expect(f.s.minions[0]).toMatchObject({ code: "21067", tough: true });
    expect(f.s.sideSchemes[0].code).toBe("21068");
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual([
      "21069",
      "21069",
      "21070",
    ]);
    expect(f.ports.shuffleEncounter).toHaveBeenCalledOnce();
    expect(warlockShadowOfPast(f.s)).toEqual([{ type: "surge" }]);
    conserved(f.s, original);
  });
  it("Cosmic Inquisition finds the actual set-aside Church before Shadows, then Shadows never clones it", () => {
    const f = fixture();
    warlockInitializeNemesis(f.s, f.ports);
    const original = [...f.s.player.setAside!],
      church = original.find((p) => p.code === "21068")!;
    f.resolve(...warlockEncounterReveal(f.s, f.piece("21070"))!);
    expect(f.s.sideSchemes[0].id).toBe(church.id);
    f.resolve(...warlockShadowOfPast(f.s)!);
    expect(f.s.sideSchemes.filter((p) => p.code === "21068")).toHaveLength(1);
    expect(f.s.encounter.deck).toHaveLength(3);
    conserved(f.s, original);
  });
});

describe("Battle Mage actual discard, aspect effects and optional responses", () => {
  it.each(["01088", "21038"])(
    "Basic/hero card %s still resolves Mage and both actual Mystic Senses",
    (code) => {
      const f = fixture(),
        p = add(f, code, "hand"),
        first = add(f, "21037"),
        second = add(f, "21037");
      const draws = [
        add(f, "01089", "deck"),
        add(f, "01090", "deck"),
        add(f, "01088", "deck"),
      ];
      mage(f, p);
      expect(f.s.prompt?.title).toBe("Battle Mage · responses");
      f.choose(second.id);
      f.s = reload(f.s);
      f.choose(first.id);
      expect(f.s.prompt).toBeNull();
      expect(f.s.player.hand.map((p) => p.id)).toEqual(
        draws.slice(0, 2).map((p) => p.id),
      );
      expect(f.damagePackets).toHaveLength(0);
      expect(f.thwartPackets).toHaveLength(0);
      expect(warlockAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
      conserved(f.s, [p, first, second, ...draws]);
    },
  );
  it("uses one actual hand discard once per phase and rejects replay without spending another card", () => {
    const f = fixture(),
      p = add(f, "01088", "hand"),
      other = add(f, "01089", "hand");
    mage(f, p);
    expect(() => f.resolve(W("mage-discard", { id: other.id }))).toThrow(
      /unused phase/,
    );
    expect(f.s.player.hand[0].id).toBe(other.id);
    warlockPhaseEnded(f.s);
    f.s.phase = "villain";
    mage(f, other);
    conserved(f.s, [p, other]);
  });
  it("Aggression damage is not an attack and ignores Guard and Stun", () => {
    const f = fixture(),
      p = add(f, "01054", "hand"),
      guard = f.piece("01101");
    f.s.minions.push(guard);
    f.s.player.stunned = true;
    mage(f, p, f.s.villain.id);
    expect(f.s.villain.hp).toBe(48);
    expect(f.s.player.stunned).toBe(true);
    expect(f.damagePackets[0]).toMatchObject({
      amount: 2,
      source: "hero",
      attack: false,
    });
  });
  it("Justice removes threat without thwarting and ignores Patrol/Confused", () => {
    const f = fixture(),
      p = add(f, "01060", "hand"),
      patrol = f.piece("20025");
    f.s.minions.push(patrol);
    f.s.player.confused = true;
    mage(f, p, "main");
    expect(f.s.scheme.threat).toBe(18);
    expect(f.s.player.confused).toBe(true);
    expect(f.thwartPackets[0]).toMatchObject({
      action: false,
      ignoreCrisis: false,
    });
  });
  it("Justice respects Crisis even though it is not a thwart", () => {
    const f = fixture(),
      p = add(f, "01060", "hand"),
      crisis = f.piece("01108");
    crisis.counters = 4;
    f.s.sideSchemes.push(crisis);
    mage(f, p);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([crisis.id]);
    f.choose(crisis.id);
    expect(f.s.scheme.threat).toBe(20);
    expect(crisis.counters).toBe(2);
  });
  it("Protection heals another player's actual damaged ally", () => {
    const f = fixture(true),
      p = add(f, "01079", "hand"),
      ally = add(f, "01067", "inPlay", "p2");
    ally.damage = 2;
    mage(f, p, ally.id);
    expect(ally.damage).toBe(1);
    expect(f.s.player.hp).toBe(11);
    conserved(f.s, [p, ally]);
  });
  it("an unavailable Protection subeffect still resolves Mage's discard and Mystic Senses", () => {
    const f = fixture(),
      p = add(f, "01079", "hand"),
      senses = add(f, "21037");
    add(f, "01088", "deck");
    add(f, "01089", "deck");
    mage(f, p);
    f.choose(senses.id);
    expect(f.s.player.hand).toHaveLength(1);
    expect(f.s.prompt).toBeNull();
  });
  it("Leadership bonus belongs to a receiving hero, stacks this round, suppresses in AE and expires", () => {
    const f = fixture(true),
      p = add(f, "01073", "hand");
    mage(f, p, "hero:p2");
    expect(warlockStats(f.s)).toEqual({ attack: 0, thwart: 0, defense: 0 });
    const v = seatView(f.s, "p2");
    expect(warlockStats(v)).toEqual({ attack: 1, thwart: 1, defense: 1 });
    warlockPhaseEnded(f.s);
    f.s.phase = "villain";
    const next = add(f, "01073", "hand");
    mage(f, next, "hero:p2");
    expect(warlockStats(v).attack).toBe(2);
    v.player.form = "alter";
    expect(warlockStats(v).attack).toBe(0);
    v.player.form = "hero";
    warlockRoundEnded(f.s);
    expect(warlockStats(v).attack).toBe(0);
  });
  it("Leadership selects heroes only, with no alter-ego teammate target", () => {
    const f = fixture(true),
      p = add(f, "01073", "hand");
    seatView(f.s, "p2").player.form = "alter";
    mage(f, p);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["hero:p1"]);
  });
  it.each(["cape-first", "senses-first"])(
    "Cape and Senses resolve in chosen order %s, once per physical source",
    (order) => {
      const f = fixture(),
        p = add(f, "01088", "hand"),
        cape = add(f, "21035"),
        senses = add(f, "21037");
      const draw = add(f, "01089", "deck");
      add(f, "01090", "deck");
      f.s.player.exhausted = true;
      mage(f, p);
      const first = order === "cape-first" ? cape : senses,
        second = order === "cape-first" ? senses : cape;
      f.choose(first.id);
      f.s = reload(f.s);
      f.choose(second.id);
      expect(f.s.player.exhausted).toBe(false);
      expect(f.s.player.inPlay.find((p) => p.id === cape.id)?.exhausted).toBe(
        true,
      );
      expect(f.s.player.hand.some((p) => p.id === draw.id)).toBe(true);
      expect(f.s.prompt).toBeNull();
      conserved(f.s, [p, cape, senses, draw]);
    },
  );
  it("declining Mage responses spends no Cape exhaustion and a later Senses cannot join the old trigger", () => {
    const f = fixture(),
      p = add(f, "01088", "hand"),
      cape = add(f, "21035"),
      senses = add(f, "21037");
    f.s.player.exhausted = true;
    add(f, "01089", "deck");
    add(f, "01090", "deck");
    mage(f, p);
    add(f, "21037");
    f.choose(senses.id);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([cape.id, "continue"]);
    f.choose("continue");
    expect(cape.exhausted).toBe(false);
    expect(f.s.player.exhausted).toBe(true);
  });
  it("blank upgrades and a prohibited ready do not offer their responses", () => {
    const f = fixture(),
      p = add(f, "01088", "hand"),
      senses = add(f, "21037");
    add(f, "21035");
    f.s.flags[`blank:${senses.id}`] = true;
    f.s.flags.cannotReady = true;
    f.s.player.exhausted = true;
    mage(f, p);
    expect(f.s.prompt).toBeNull();
  });
  it("hero identity actions have correct form and phase gates", () => {
    const f = fixture();
    add(f, "01088", "hand");
    f.s.player.form = "alter";
    expect(warlockAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.s.player.stunned = true;
    expect(warlockAbilityOptions(f.s, "hero", f.ports)[0].id).toBe(
      "avatar-of-life",
    );
    f.s.heroId = "rocket";
    expect(warlockAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
  });
});

describe("Avatar, Soul World and Karmic Staff", () => {
  it.each(["stunned", "confused", "tough"] as const)(
    "Avatar removes exactly one actual %s card and discards its exact chosen cost",
    (status) => {
      const f = fixture(),
        p = add(f, "01088", "hand"),
        keep = add(f, "01089", "hand");
      f.s.player.form = "alter";
      f.s.player[status] = true;
      const key =
        status === "stunned"
          ? "stunCards"
          : status === "confused"
            ? "confuseCards"
            : "toughCards";
      f.s.player[key] = 2;
      expect(warlockAbility(f.s, "hero", f.ports, "avatar-of-life")).toBe(true);
      f.pump();
      f.choose(p.id);
      f.s = reload(f.s);
      f.choose(status);
      expect(f.s.player[key]).toBe(1);
      expect(f.s.player.hand.map((p) => p.id)).toEqual([keep.id]);
      conserved(f.s, [p, keep]);
      expect(warlockAbilityOptions(f.s, "hero", f.ports)[0].id).toBe(
        "avatar-of-life",
      );
    },
  );
  it("Avatar cannot spend a hand card when no actual status exists", () => {
    const f = fixture(),
      p = add(f, "01088", "hand");
    f.s.player.form = "alter";
    expect(warlockAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    expect(() =>
      f.resolve(W("avatar-remove", { id: p.id, status: "stunned" })),
    ).toThrow(/actual cost/);
    expect(f.s.player.hand[0].id).toBe(p.id);
  });
  it.each(["hero", "alter"] as const)(
    "Staff generates one wild in %s form and exhausts only its physical source",
    (form) => {
      const f = fixture(),
        staff = add(f, "21034");
      f.s.player.form = form;
      expect(warlockResourceSources(f.s, f.ports)).toEqual([
        expect.objectContaining({ id: staff.id, resources: ["wild"] }),
      ]);
      expect(warlockResourceSpent(f.s, staff.id, f.ports)).toBe(true);
      expect(staff.exhausted).toBe(true);
      expect(warlockResourceSources(f.s, f.ports)).toEqual([]);
      expect(warlockResourceSpent(f.s, "not-staff", f.ports)).toBe(false);
      expect(() => warlockResourceSpent(f.s, staff.id, f.ports)).toThrow(
        /unavailable/,
      );
    },
  );
  it("blank Staff cannot generate or commit a resource", () => {
    const f = fixture(),
      staff = add(f, "21034");
    f.s.flags[`blank:${staff.id}`] = true;
    expect(warlockResourceSources(f.s, f.ports)).toEqual([]);
    expect(() => warlockResourceSpent(f.s, staff.id, f.ports)).toThrow();
    expect(staff.exhausted).toBe(false);
  });
  it("Soul World captures actual deck exhaustion, places an optional counter and heals all actual missing HP", () => {
    const f = fixture(),
      world = add(f, "21033"),
      card = add(f, "01088", "deck");
    f.ports.discardPlayerCards(f.s, 5);
    f.pump();
    expect(f.s.prompt?.title).toBe("Soul World");
    expect(world.counters).toBe(0);
    f.choose("yes");
    expect(world.counters).toBe(1);
    expect(f.s.encounter.dealt).toHaveLength(1);
    conserved(f.s, [world, card]);
    f.s.player.form = "alter";
    f.s.player.hp = 1;
    expect(warlockAbility(f.s, world.id, f.ports, "soul-heal")).toBe(true);
    f.pump();
    expect(f.s.player.hp).toBe(11);
    expect(world.counters).toBe(0);
    expect(world.exhausted).toBe(true);
  });
  it("Soul World's declined exhaustion trigger does not retroactively grant counters", () => {
    const f = fixture(),
      world = add(f, "21033");
    add(f, "01088", "deck");
    f.ports.discardPlayerCards(f.s, 1);
    f.pump();
    f.choose("no");
    expect(world.counters).toBe(0);
    expect(warlockDeckExhausted(f.s)).toHaveLength(1); // Host must call only on an actual transition.
    expect(warlockAbilityOptions(f.s, world.id, f.ports)).toEqual([]);
  });
  it("Soul World cannot heal in hero form, without a counter, while exhausted or at full HP", () => {
    const f = fixture(),
      world = add(f, "21033");
    world.counters = 1;
    f.s.player.hp = 3;
    expect(warlockAbilityOptions(f.s, world.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    world.counters = 0;
    expect(warlockAbilityOptions(f.s, world.id, f.ports)).toEqual([]);
    world.counters = 1;
    world.exhausted = true;
    expect(warlockAbilityOptions(f.s, world.id, f.ports)).toEqual([]);
    world.exhausted = false;
    f.s.player.hp = 11;
    expect(warlockAbilityOptions(f.s, world.id, f.ports)).toEqual([]);
  });
});

describe("Warlock events commit original physical additional costs", () => {
  it("counts each distinct aspect once and excludes Basic and hero cards", () => {
    const f = fixture();
    expect(
      warlockDistinctAspects(
        ["01054", "01054", "01060", "01073", "01079", "01088", "21038"].map(
          (code) => f.piece(code),
        ),
      ),
    ).toBe(4);
  });
  it.each(["21038", "21039"])(
    "%s chooses 1–4 discards up front without looking, never offers a zero cost",
    (code) => {
      const f = fixture(),
        event = f.piece(code),
        deck = ["01054", "01060", "01073", "01079", "01088"].map((c) =>
          add(f, c, "deck"),
        );
      f.resolve(
        ...warlockBeforeEvent(f.s, event, [
          { type: "nativeEvent", piece: event },
        ])!,
      );
      expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
        "1",
        "2",
        "3",
        "4",
      ]);
      expect(f.s.player.deck.map((p) => p.id)).toEqual(deck.map((p) => p.id));
      expect(f.s.hiddenInfo || 0).toBe(0);
      f.s = reload(f.s);
      f.choose("4");
      expect(f.ports.discardPlayerCards).toHaveBeenCalledTimes(1);
      expect(f.s.player.discard.map((p) => p.id)).toEqual(
        deck.slice(0, 4).map((p) => p.id),
      );
      f.choose(code === "21038" ? f.s.villain.id : "main");
      if (code === "21038")
        expect(f.damagePackets).toEqual([
          expect.objectContaining({ amount: 8, attack: true, source: "hero" }),
        ]);
      else
        expect(f.thwartPackets).toEqual([
          expect.objectContaining({ amount: 7, action: true, source: "hero" }),
        ]);
      conserved(f.s, deck);
    },
  );
  it("Karmic Blast remains one modified attack packet, including against Tough", () => {
    const f = fixture(),
      event = f.piece("21038");
    f.s.villain.tough = true;
    add(f, "01054", "deck");
    add(f, "01060", "deck");
    add(f, "01088", "deck");
    f.resolve(
      ...warlockBeforeEvent(f.s, event, [
        { type: "nativeEvent", piece: event },
      ])!,
    );
    f.choose("2");
    f.choose(f.s.villain.id);
    expect(f.damagePackets).toHaveLength(1);
    expect(f.damagePackets[0].amount).toBe(6);
    expect(f.s.villain.hp).toBe(50);
    expect(f.s.villain.tough).toBe(false);
  });
  it.each(["21038", "21039"])(
    "%s additional discard is paid before Stun/Confuse replacement",
    (code) => {
      const f = fixture(),
        event = f.piece(code);
      const top = add(f, "01054", "deck");
      add(f, "01088", "deck");
      f.s.player[code === "21038" ? "stunned" : "confused"] = true;
      f.resolve(
        ...warlockBeforeEvent(f.s, event, [
          { type: "nativeEvent", piece: event },
        ])!,
      );
      f.choose("1");
      f.choose(code === "21038" ? f.s.villain.id : "main");
      expect(f.s.player.discard.some((p) => p.id === top.id)).toBe(true);
      expect(f.s.player.stunned || f.s.player.confused).toBe(false);
      if (code === "21038")
        expect(f.damagePackets).toEqual([
          expect.objectContaining({ amount: 4, attack: false }),
        ]);
      else
        expect(f.thwartPackets).toEqual([
          expect.objectContaining({ amount: 3, action: false }),
        ]);
      conserved(f.s, [top]);
    },
  );
  it("original deck exhaustion stops discard and resolves Church/Soul World before the event", () => {
    const f = fixture(),
      event = f.piece("21038"),
      world = add(f, "21033"),
      church = f.piece("21068");
    f.s.sideSchemes.push(church);
    const deck = [add(f, "01054", "deck"), add(f, "01060", "deck")];
    f.resolve(
      ...warlockBeforeEvent(f.s, event, [
        { type: "nativeEvent", piece: event },
      ])!,
    );
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["1", "2"]);
    f.choose("2");
    expect(f.s.prompt?.title).toBe("Soul World");
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.stunned).toBe(true);
    f.choose("yes");
    f.choose(f.s.villain.id);
    expect(world.counters).toBe(1);
    expect(f.damagePackets).toEqual([
      expect.objectContaining({ amount: 4, attack: false }),
    ]);
    expect(f.s.player.stunned).toBe(false);
    expect(f.s.player.deck).toHaveLength(2);
    expect(f.s.encounter.dealt).toHaveLength(1);
    conserved(f.s, deck);
  });
  it("empty decks and invalid additional costs cannot be used or partially spent", () => {
    const f = fixture(),
      event = f.piece("21038");
    expect(warlockPlayRestriction(f.s, event)).toMatch(/at least 1/);
    expect(() =>
      f.resolve(W("spell-cost", { piece: event, after: [] })),
    ).toThrow(/deck card/);
    const top = add(f, "01054", "deck");
    expect(() =>
      f.resolve(W("spell-discard", { piece: event, count: 0, after: [] })),
    ).toThrow(/1–4/);
    expect(() =>
      f.resolve(W("spell-discard", { piece: event, count: 2, after: [] })),
    ).toThrow(/1–4/);
    expect(f.s.player.deck[0].id).toBe(top.id);
    expect(f.s.player.discard).toHaveLength(0);
  });
  it("Cosmic Awareness respects Crisis and Patrol as a real thwart", () => {
    const f = fixture(),
      event = f.piece("21039"),
      patrol = f.piece("20025"),
      side = f.piece("01107");
    f.s.minions.push(patrol);
    side.counters = 5;
    f.s.sideSchemes.push(side);
    f.resolve(...warlockEvent(f.s, event, [f.piece("01054")])!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([side.id]);
    f.choose(side.id);
    expect(side.counters).toBe(1);
  });
  it("Quantum Magic returns the exact chosen discarded card and can run in alter-ego", () => {
    const f = fixture(),
      p = add(f, "21038", "discard"),
      other = add(f, "21038", "discard"),
      event = f.piece("21040");
    f.s.player.form = "alter";
    f.resolve(...warlockEvent(f.s, event)!);
    f.s = reload(f.s);
    f.choose(other.id);
    expect(f.s.player.hand[0].id).toBe(other.id);
    expect(f.s.player.discard[0].id).toBe(p.id);
    conserved(f.s, [p, other]);
  });
  it("Quantum Magic needs a preexisting discard target and cannot return a resolving event", () => {
    const f = fixture(),
      event = f.piece("21040");
    f.s.resolving.push(event);
    expect(warlockPlayRestriction(f.s, event)).toMatch(/already/);
    f.resolve(...warlockEvent(f.s, event)!);
    expect(f.s.prompt).toBeNull();
  });
});

describe("Pip, Cosmic Ward, original obligation and nemesis timing", () => {
  it("Pip is a typed ability payment that puts the actual ally into the attacked teammate's control", () => {
    const f = fixture(true),
      pip = add(f, "21032", "hand");
    f.s.player.form = "alter";
    const options = warlockAttackInitiatedOptions(
      f.s,
      "p2",
      [{ type: "sentinel" }],
      f.ports,
    );
    expect(options).toHaveLength(1);
    const payment = options[0].effects[0];
    expect(payment).toMatchObject({
      type: "payRequest",
      cost: 2,
      requirements: ["energy", "mental"],
      piece: { id: pip.id },
      targetCode: pip.code,
      abilityCost: true,
      cancelable: true,
    });
    expect(f.ports.canPay).toHaveBeenCalledWith(
      f.s,
      2,
      ["energy", "mental"],
      pip.id,
    );
    f.s = reload(f.s);
    f.resolve(...payment.after);
    expect(f.s.player.hand).toHaveLength(0);
    expect(seatView(f.s, "p2").player.inPlay[0]).toMatchObject({
      id: pip.id,
      ownerId: "p1",
      tough: true,
    });
    expect(f.s.flags.sentinel).toBe(true);
    conserved(f.s, [pip]);
  });
  it("Pip cannot enter twice through uniqueness, missing hand or eliminated target", () => {
    const f = fixture(true),
      pip = add(f, "21032", "hand");
    add(f, "21032", "inPlay", "p2");
    expect(warlockAttackInitiatedOptions(f.s, "p2", [], f.ports)).toEqual([]);
    expect(() =>
      f.resolve(W("pip", { id: pip.id, targetPlayerId: "p2" })),
    ).toThrow(/unavailable/);
    f.s.players[1].eliminated = true;
    expect(warlockAttackInitiatedOptions(f.s, "p2", [], f.ports)).toEqual([]);
    expect(f.s.player.hand[0].id).toBe(pip.id);
  });
  it("Cosmic Ward is forced, consumes one chosen physical copy and preserves Incite", () => {
    const f = fixture(),
      first = add(f, "21036"),
      second = add(f, "21036"),
      treachery = f.piece("21070");
    f.s.resolving.push(treachery);
    f.resolve(...warlockForcedTreacheryInterrupt(f.s, treachery, f.ports)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([first.id, second.id]);
    f.s = reload(f.s);
    f.choose(second.id);
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual([first.id]);
    expect(f.s.scheme.threat).toBe(22);
    expect(f.ports.findAndRevealEncounter).not.toHaveBeenCalled();
    expect(warlockForcedTreacheryInterrupt(f.s, treachery, f.ports)).toBeNull();
    expect(f.history.indexOf("discardEncounter")).toBeLessThan(
      f.history.indexOf("warlock:ward-discard"),
    );
    conserved(f.s, [first, second, treachery]);
  });
  it("one Ward needs no optional confirmation and only the revealer's Ward can interrupt", () => {
    const f = fixture(true),
      ward = add(f, "21036", "inPlay", "p2"),
      treachery = f.piece("01188");
    expect(warlockForcedTreacheryInterrupt(f.s, treachery, f.ports)).toBeNull();
    const ownWard = add(f, "21036");
    f.s.resolving.push(treachery);
    f.resolve(...warlockForcedTreacheryInterrupt(f.s, treachery, f.ports)!);
    expect(f.s.prompt).toBeNull();
    conserved(f.s, [ward, ownWard, treachery]);
  });
  it("blank Wards and uncancelable reveals do not spend a physical Ward", () => {
    const f = fixture(),
      ward = add(f, "21036"),
      treachery = f.piece("01188");
    f.s.flags[`blank:${ward.id}`] = true;
    expect(warlockForcedTreacheryInterrupt(f.s, treachery, f.ports)).toBeNull();
    delete f.s.flags[`blank:${ward.id}`];
    f.s.flags[`uncancelable:${treachery.id}`] = true;
    expect(warlockForcedTreacheryInterrupt(f.s, treachery, f.ports)).toBeNull();
    expect(f.s.player.inPlay[0].id).toBe(ward.id);
  });
  it("Regeneration Cycle flips freely, exhausts actual alter-ego and removes its actual obligation", () => {
    const f = fixture(),
      obligation = f.piece("21066");
    f.s.resolving.push(obligation);
    f.resolve(...warlockEncounterReveal(f.s, obligation)!);
    f.choose("alter");
    f.s = reload(f.s);
    f.choose("exhaust");
    expect(f.s.player.form).toBe("alter");
    expect(f.s.player.flipped).toBe(false);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed.map((p) => p.id)).toEqual([obligation.id]);
    expect(f.s.encounter.discard).toHaveLength(0);
    conserved(f.s, [obligation]);
  });
  it("Regeneration Cycle mills actual top five, counts distinct aspects, and discards instead of removing", () => {
    const f = fixture(),
      obligation = f.piece("21066");
    f.s.resolving.push(obligation);
    const top = ["01054", "01054", "01060", "01073", "01088", "01079"].map(
      (code) => add(f, code, "deck"),
    );
    f.resolve(...warlockEncounterReveal(f.s, obligation)!);
    f.choose("stay");
    f.choose("discard");
    expect(f.s.player.discard.map((p) => p.id)).toEqual(
      top.slice(0, 5).map((p) => p.id),
    );
    expect(f.s.player.deck[0].id).toBe(top[5].id);
    expect(f.s.scheme.threat).toBe(23);
    expect(f.s.removed).toHaveLength(0);
    conserved(f.s, [obligation, ...top]);
  });
  it("a form lock or exhausted alter-ego suppresses only the obligation exhaust option", () => {
    const f = fixture(),
      obligation = f.piece("21066");
    f.s.flags.formLocked = true;
    f.resolve(...warlockEncounterReveal(f.s, obligation)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
  });
  it("Church's actual deck reset forced effect affects any identity form before optional Soul World", () => {
    const f = fixture(true),
      church = f.piece("21068");
    f.s.sideSchemes.push(church);
    f.s.player.form = "alter";
    f.resolve(...warlockDeckReset(f.s));
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.stunned).toBe(true);
    expect(seatView(f.s, "p2").player.exhausted).toBe(false);
  });
  it("Zealot locks only the actual Church, globally across engagement seats", () => {
    const f = fixture(true),
      church = f.piece("21068"),
      other = f.piece("01107"),
      zealot = f.piece("21069");
    f.s.sideSchemes.push(church, other);
    zealot.engagedWith = "p2";
    f.s.minions.push(zealot);
    expect(warlockSchemeLocked(f.s, church.id)).toBe(true);
    expect(warlockSchemeLocked(f.s, other.id)).toBe(false);
    expect(warlockSchemeLocked(f.s, "main")).toBe(false);
    f.s.minions = [];
    expect(warlockSchemeLocked(f.s, church.id)).toBe(false);
  });
  it("Magus mills after an actual activation only and never mills the reset deck", () => {
    const f = fixture(),
      magus = f.piece("21067");
    f.s.minions.push(magus);
    const top = [add(f, "01054", "deck"), add(f, "01060", "deck")];
    expect(warlockEnemyActivated(f.s, magus.id, false)).toEqual([]);
    f.resolve(...warlockEnemyActivated(f.s, magus.id));
    expect(f.ports.discardPlayerCards).toHaveBeenCalledWith(f.s, 5);
    expect(f.s.player.deck).toHaveLength(2);
    expect(f.s.encounter.dealt).toHaveLength(1);
    conserved(f.s, top);
    f.s.minions = [];
    expect(warlockEnemyActivated(f.s, magus.id)).toEqual([]);
  });
  it("Church and Zealot boost abilities retain the original physical boost source", () => {
    const f = fixture(),
      church = f.piece("21068"),
      zealot = f.piece("21069");
    f.resolve(...warlockBoost(f.s, church)!);
    expect(f.s.sideSchemes[0].id).toBe(church.id);
    f.s = reload(f.s);
    f.resolve(...warlockBoost(f.s, zealot)!);
    expect(f.s.minions[0]).toMatchObject({ id: zealot.id, engagedWith: "p1" });
    conserved(f.s, [church, zealot]);
  });
  it("Inquisition with a Church already in play mills ten as far as possible without searching", () => {
    const f = fixture(),
      church = f.piece("21068");
    f.s.sideSchemes.push(church);
    const top = ["01054", "01060", "01088"].map((c) => add(f, c, "deck"));
    f.resolve(...warlockEncounterReveal(f.s, f.piece("21070"))!);
    expect(f.ports.discardPlayerCards).toHaveBeenCalledWith(f.s, 10);
    expect(f.ports.findAndRevealEncounter).not.toHaveBeenCalled();
    expect(f.s.player.deck).toHaveLength(3);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.stunned).toBe(true);
    conserved(f.s, top);
  });
  it("unknown ordinary cards fall through and unknown Warlock effects fail loudly", () => {
    const f = fixture(),
      p = f.piece("01088");
    expect(warlockEvent(f.s, p)).toBeNull();
    expect(warlockEncounterReveal(f.s, p)).toBeNull();
    expect(warlockBoost(f.s, p)).toBeNull();
    expect(resolveWarlockEffect(f.s, { type: "unrelated" }, f.ports)).toBe(
      false,
    );
    expect(() => resolveWarlockEffect(f.s, W("unknown"), f.ports)).toThrow(
      /Unknown Adam/,
    );
  });
});
