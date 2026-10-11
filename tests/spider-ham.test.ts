import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine";
import { activateSeat, seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  SPIDER_HAM_SCRIPT_CODES,
  spiderHamInitializeIdentity,
  spiderHamToonCounters,
  spiderHamAddToonCounters,
  spiderHamSpendToonCounters,
  spiderHamResourceSources,
  spiderHamResourceSpent,
  spiderHamStats,
  spiderHamTraits,
  spiderHamPhaseEnded,
  spiderHamAfterDamage,
  spiderHamAfterBasicRecover,
  spiderHamAllyEnter,
  spiderHamPlayRestriction,
  spiderHamBeforeEvent,
  spiderHamEvent,
  spiderHamAbilityOptions,
  spiderHamAbility,
  spiderHamBasicAttackOptions,
  spiderHamDamageOptions,
  spiderHamRevealOptions,
  spiderHamRevealCancelEffects,
  spiderHamInitializeNemesis,
  spiderHamShadowOfPast,
  spiderHamEncounterReveal,
  spiderHamBoost,
  spiderHamSideDefeated,
  spiderHamMinionEngaged,
  spiderHamEnemyTraits,
  resolveSpiderHamEffect,
  type SpiderHamPorts,
  type SpiderHamDamageContext,
  type SpiderHamRevealReceipt,
} from "../src/game/spider-ham";

const definitions = new Map(catalog.map((c) => [c.code, c]));
type ToonPlayer = GameState["player"] & { spiderHamIdentity?: Piece };
const physicalIdentity = (s: GameState) =>
  (s.player as ToonPlayer).spiderHamIdentity!;

function fixture(players = 1) {
  let s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 30001,
    pacing: "expert",
  });
  s.heroId = "spiderham";
  s.players[0].heroId = s.heroId;
  s.phase = "player";
  s.player.form = "hero";
  s.player.inPlay = [];
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.player.setAside = [];
  s.flags = {};
  s.players[0].flags = s.flags;
  s.players[0].player = s.player;
  s.playerCount = players;
  for (let i = 1; i < players; i++)
    s.players.push({
      ...s.players[0],
      id: `p${i + 1}`,
      heroId: "nova",
      player: structuredClone(s.player),
      flags: {},
      eliminated: false,
    });
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.resolving = [];
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  s.queue = [];
  s.prompt = null;
  s.scheme.threat = 10;
  const removeEncounter = (state: GameState, piece: Piece) => {
    for (const zone of [
      state.resolving,
      state.encounter.deck,
      state.encounter.discard,
      state.encounter.dealt,
    ]) {
      const index = zone.findIndex((p) => p.id === piece.id);
      if (index >= 0) zone.splice(index, 1);
    }
  };
  const ports: SpiderHamPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (state, p) =>
      !!p.treatedAsMinion || !!state.flags[`testBlank:${p.id}`],
    isIdentityTextBlank: (state) => !!state.flags.testIdentityBlank,
    makePiece,
    canChangeForm: (state) => !state.flags.testFormLocked,
    canReadyIdentity: (state) => !state.flags.testReadyLocked,
    enemyTargets: (state, attack) =>
      [state.villain, ...state.minions]
        .filter((p) => !attack || !state.flags[`testAttackBlocked:${p.id}`])
        .map((p) => ({
          id: p.id,
          code: p.code,
          label: definitions.get(p.code)?.name || p.code,
        })),
    schemeTargets: (state, thwart) =>
      [
        { id: "main", label: "Main scheme" },
        ...state.sideSchemes.map((p) => ({
          id: p.id,
          code: p.code,
          label: definitions.get(p.code)?.name || p.code,
        })),
      ].filter((p) => !thwart || !state.flags[`testThwartBlocked:${p.id}`]),
    attackProgram: vi.fn(
      (state: GameState, effects: Effect[], after: Effect[]) =>
        state.queue.unshift(...effects, ...after),
    ),
    attackVillain: vi.fn(),
    enemyAttack: vi.fn(),
    shufflePlayerDeck: vi.fn((state: GameState, after: Effect[]) => {
      state.player.deck.reverse();
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
      state.queue.unshift(...after);
    }),
    shuffleEncounter: vi.fn((state: GameState) => {
      state.encounter.deck.reverse();
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    }),
    canPayWithToonCost: (state) =>
      spiderHamToonCounters(state) >= 1 && !state.flags.testCannotPay,
    canDiscardPiece: (state, p) =>
      state.player.inPlay.some((x) => x.id === p.id) &&
      !state.flags[`testCannotDiscard:${p.id}`],
    discardControlledCost: vi.fn(
      (state: GameState, id: string, after: Effect[]) => {
        const index = state.player.inPlay.findIndex((p) => p.id === id);
        if (index >= 0) {
          state.player.discard.push(state.player.inPlay.splice(index, 1)[0]);
          state.queue.unshift(...after);
        }
      },
    ),
    preventDamage: vi.fn(),
    damageRemaining: (state, context) =>
      Number(state.flags[`testRemaining:${context.token}`] ?? context.amount),
    playRevealReaction: vi.fn(),
    cancelEncounter: vi.fn((state: GameState, p: Piece) => {
      removeEncounter(state, p);
      state.encounter.discard.push(p);
    }),
    putMinion: vi.fn(
      (state: GameState, p: Piece, playerId: string, after: Effect[]) => {
        removeEncounter(state, p);
        p.engagedWith = playerId;
        state.minions.push(p);
        state.queue.unshift(
          ...spiderHamMinionEngaged(state, p, playerId),
          ...after,
        );
      },
    ),
    revealEncounter: vi.fn((state: GameState, p: Piece) => {
      state.resolving.push(p);
      if (definitions.get(p.code)?.type_code === "minion") {
        state.minions.push(p);
        p.engagedWith = state.activePlayerId;
        state.resolving = state.resolving.filter((q) => q.id !== p.id);
        state.queue.unshift(...spiderHamMinionEngaged(state, p));
      } else if (definitions.get(p.code)?.type_code === "side_scheme") {
        p.counters = definitions.get(p.code)!.base_threat || 0;
        state.sideSchemes.push(p);
        state.resolving = state.resolving.filter((q) => q.id !== p.id);
      }
      state.queue.unshift(...(spiderHamEncounterReveal(state, p) || []));
    }),
    attach: vi.fn((state: GameState, p: Piece, target: string) => {
      removeEncounter(state, p);
      p.attachedTo = target;
      state.attachments.push(p);
    }),
    clearControlledCounters: vi.fn((state: GameState, playerId: string) => {
      const view = seatView(state, playerId);
      for (const p of view.player.inPlay) p.counters = 0;
      if (physicalIdentity(view)) physicalIdentity(view).counters = 0;
    }),
  };
  spiderHamInitializeIdentity(s, ports);
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    if (resolveSpiderHamEffect(s, e, ports)) return;
    switch (e.type) {
      case "optional":
        ports.choose(s, e.title, e.text, [
          { id: "use", label: "Use response", effects: e.effects },
          { id: "continue", label: "Continue", effects: [] },
        ]);
        break;
      case "damage":
        if (e.target === "hero") s.player.hp -= e.amount;
        else
          [...s.minions, s.villain].find((p) => p.id === e.target)!.damage +=
            e.amount;
        break;
      case "thwart":
        if (e.target === "main")
          s.scheme.threat = Math.max(0, s.scheme.threat - e.amount);
        else {
          const p = s.sideSchemes.find((p) => p.id === e.target)!;
          p.counters = Math.max(0, p.counters - e.amount);
        }
        break;
      case "status": {
        const p =
          e.target === "hero"
            ? s.player
            : [...s.minions, ...s.player.inPlay, s.villain].find(
                (p) => p.id === e.target,
              )!;
        p[e.status as "confused" | "stunned"] = true;
        break;
      }
      case "flip":
        s.player.form = e.target;
        physicalIdentity(s).code = e.target === "hero" ? "30001a" : "30001b";
        break;
      case "ready":
        s.player.exhausted = false;
        break;
      case "draw":
        s.flags.testDrawn = Number(s.flags.testDrawn || 0) + e.amount;
        break;
      case "surge":
        s.flags.testSurge = Number(s.flags.testSurge || 0) + 1;
        break;
      case "removeEncounter":
        removeEncounter(s, e.piece);
        s.removed.push(e.piece);
        break;
      case "discardEncounter":
        removeEncounter(s, e.piece);
        s.encounter.discard.push(e.piece);
        break;
      case "test-basic":
        s.flags.testBasicAmount = e.amount;
        s.flags.testBasicOverkill = !!e.overkill;
        break;
      case "test-after":
        s.flags.testAfter = true;
        break;
      default:
        throw Error(`Unknown fixture effect: ${e.type}`);
    }
  };
  const drain = () => {
    for (let i = 0; s.queue.length && !s.prompt && i < 100; i++)
      run(s.queue.shift()!);
  };
  const effects = (list: Effect[] | null) => {
    expect(list).not.toBeNull();
    ports.queue(s, ...list!);
    drain();
  };
  const choose = (id: string) => {
    const option = s.prompt?.options.find((o) => o.id === id);
    expect(option, s.prompt?.title).toBeDefined();
    s.prompt = null;
    ports.queue(s, ...option!.effects);
    drain();
  };
  const piece = (code: string) => makePiece(s, code);
  const controlled = (code: string) => {
    const p = piece(code);
    p.ownerId = s.activePlayerId;
    s.player.inPlay.push(p);
    return p;
  };
  const minion = (code = "30026", playerId = "p1") => {
    const p = piece(code);
    p.engagedWith = playerId;
    s.minions.push(p);
    return p;
  };
  const side = (code = "30025", threat = 3) => {
    const p = piece(code);
    p.counters = threat;
    s.sideSchemes.push(p);
    return p;
  };
  const revealReceipt = (p: Piece): SpiderHamRevealReceipt => ({
    token: `reveal:${p.id}`,
    playerId: "p1",
    pieceId: p.id,
    code: p.code,
    fromEncounterDeck: true,
  });
  return {
    get s() {
      return s;
    },
    ports,
    run,
    drain,
    effects,
    choose,
    piece,
    controlled,
    minion,
    side,
    revealReceipt,
    reload() {
      s = JSON.parse(JSON.stringify(s));
    },
  };
}

describe("Spider-Ham hero, signatures, obligation and nemesis authored native contracts", () => {
  it("bounds exactly seventeen authored faces, fifteen signature cards and five nemesis pieces", () => {
    const source = catalog.filter(
      (c) =>
        c.pack_code === "spiderham" &&
        ["spiderham", "spiderham_nemesis"].includes(c.set_code || ""),
    );
    expect([...SPIDER_HAM_SCRIPT_CODES].sort()).toEqual(
      source.map((c) => c.code).sort(),
    );
    expect(
      source
        .filter(
          (c) =>
            c.faction_code === "hero" &&
            !["hero", "alter_ego"].includes(c.type_code),
        )
        .reduce((n, c) => n + c.quantity, 0),
    ).toBe(15);
    expect(
      source
        .filter((c) => c.set_code === "spiderham_nemesis")
        .reduce((n, c) => n + c.quantity, 0),
    ).toBe(5);
  });
  it("stores toon counters on a stable actual identity across form changes and JSON hydration", () => {
    const f = fixture(),
      id = physicalIdentity(f.s).id;
    spiderHamAddToonCounters(f.s, 4);
    f.effects([{ type: "flip", target: "alter" }]);
    expect(spiderHamToonCounters(f.s)).toBe(4);
    f.reload();
    spiderHamInitializeIdentity(f.s, f.ports);
    expect(physicalIdentity(f.s)).toMatchObject({
      id,
      code: "30001b",
      counters: 4,
      ownerId: "p1",
    });
    f.effects([{ type: "flip", target: "hero" }]);
    expect(physicalIdentity(f.s).id).toBe(id);
    expect(() => spiderHamSpendToonCounters(f.s, 5)).toThrow(/cannot pay/);
    expect(() => spiderHamAddToonCounters(f.s, -1)).toThrow(/nonnegative/);
  });
  it("offers unique wild resource slots and reserves the additional toon for both toon-cost events", () => {
    const f = fixture();
    spiderHamAddToonCounters(f.s, 3);
    const sources = spiderHamResourceSources(f.s, "30007", f.ports);
    expect(sources).toHaveLength(3);
    expect(new Set(sources.map((p) => p.id)).size).toBe(3);
    expect(
      sources.every(
        (p) => p.resources.join() === "wild" && p.kind === "ability",
      ),
    ).toBe(true);
    expect(spiderHamResourceSources(f.s, "30004", f.ports)).toHaveLength(2);
    expect(spiderHamResourceSources(f.s, "30005", f.ports)).toHaveLength(2);
    for (const p of sources)
      expect(spiderHamResourceSpent(f.s, p.id, f.ports)).toBe(true);
    expect(spiderHamToonCounters(f.s)).toBe(0);
    expect(spiderHamResourceSpent(f.s, "not-a-toon", f.ports)).toBe(false);
    expect(() => spiderHamResourceSpent(f.s, sources[0].id, f.ports)).toThrow(
      /unavailable/,
    );
  });
  it("cannot spend hero-face toon resources in alter ego, while blanked or from another physical identity", () => {
    const f = fixture();
    spiderHamAddToonCounters(f.s, 2);
    const id = spiderHamResourceSources(f.s, undefined, f.ports)[0].id;
    f.s.player.form = "alter";
    expect(spiderHamResourceSources(f.s, undefined, f.ports)).toEqual([]);
    expect(() => spiderHamResourceSpent(f.s, id, f.ports)).toThrow(
      /unavailable/,
    );
    f.s.player.form = "hero";
    f.s.flags.testIdentityBlank = true;
    expect(spiderHamResourceSources(f.s, undefined, f.ports)).toEqual([]);
    delete f.s.flags.testIdentityBlank;
    expect(() =>
      spiderHamResourceSpent(f.s, "spider-ham-toon:another-id:1", f.ports),
    ).toThrow(/unavailable/);
    expect(spiderHamToonCounters(f.s)).toBe(2);
  });
  it("offers optional Spider-Nonsense only for actual positive hero damage, one counter per occurrence", () => {
    const f = fixture();
    const receipt = { token: "damage1", playerId: "p1", actualDamage: 7 };
    expect(
      spiderHamAfterDamage(f.s, { ...receipt, actualDamage: 0 }, f.ports),
    ).toEqual([]);
    f.effects(spiderHamAfterDamage(f.s, receipt, f.ports));
    expect(f.s.prompt?.title).toBe("Spider-Nonsense");
    expect(spiderHamToonCounters(f.s)).toBe(0);
    f.choose("continue");
    expect(spiderHamToonCounters(f.s)).toBe(0);
    f.effects(
      spiderHamAfterDamage(f.s, { ...receipt, token: "damage2" }, f.ports),
    );
    f.reload();
    f.choose("use");
    expect(spiderHamToonCounters(f.s)).toBe(1);
    expect(
      spiderHamAfterDamage(f.s, { ...receipt, token: "damage2" }, f.ports),
    ).toEqual([]);
    f.s.player.form = "alter";
    expect(spiderHamAfterDamage(f.s, receipt, f.ports)).toEqual([]);
  });
  it("rebinds damage-response ownership and rejects blank or eliminated identity responses", () => {
    const f = fixture(2),
      receipt = { token: "damage-team", playerId: "p1", actualDamage: 1 };
    const pending = spiderHamAfterDamage(f.s, receipt, f.ports);
    activateSeat(f.s, "p2");
    f.effects(pending);
    f.choose("use");
    expect(spiderHamToonCounters(seatView(f.s, "p1"))).toBe(1);
    expect(spiderHamToonCounters(seatView(f.s, "p2"))).toBe(0);
    f.s.flags.testIdentityBlank = true;
    expect(
      spiderHamAfterDamage(f.s, { ...receipt, token: "new" }, f.ports),
    ).toEqual([]);
    delete f.s.flags.testIdentityBlank;
    f.s.players[0].eliminated = true;
    expect(
      spiderHamAfterDamage(f.s, { ...receipt, token: "new" }, f.ports),
    ).toEqual([]);
  });
  it("Cartoon Power follows an actual basic recovery rather than healing amount or an ordinary heal", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const receipt = {
      token: "rec1",
      playerId: "p1",
      performed: true,
      wasAlter: true,
    };
    expect(
      spiderHamAfterBasicRecover(
        f.s,
        { ...receipt, performed: false },
        f.ports,
      ),
    ).toEqual([]);
    expect(
      spiderHamAfterBasicRecover(f.s, { ...receipt, wasAlter: false }, f.ports),
    ).toEqual([]);
    f.effects(spiderHamAfterBasicRecover(f.s, receipt, f.ports));
    f.choose("use");
    expect(spiderHamToonCounters(f.s)).toBe(1);
    expect(spiderHamAfterBasicRecover(f.s, receipt, f.ports)).toEqual([]);
  });
  it("Captain Americat's optional any-form response gains a toon even with no eligible discarded signature", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const ally = f.controlled("30002");
    f.s.player.discard.push(
      f.piece("30012"),
      f.piece("30023"),
      f.piece("30028"),
    );
    f.effects(spiderHamAllyEnter(f.s, ally, f.ports));
    f.choose("continue");
    expect(spiderHamToonCounters(f.s)).toBe(0);
    f.effects(spiderHamAllyEnter(f.s, ally, f.ports));
    f.choose("use");
    expect(spiderHamToonCounters(f.s)).toBe(1);
    expect(f.s.prompt).toBeNull();
    expect(f.ports.shufflePlayerDeck).not.toHaveBeenCalled();
  });
  it("Captain Americat selects and shuffles the actual discarded Spider-Ham card, preserving owner and ID on reload", () => {
    const f = fixture(),
      ally = f.controlled("30002"),
      signature = f.piece("30003"),
      other = f.piece("30012");
    signature.ownerId = "p1";
    f.s.player.discard.push(signature, other);
    f.effects(spiderHamAllyEnter(f.s, ally, f.ports));
    f.choose("use");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([signature.id]);
    f.reload();
    f.choose(signature.id);
    expect(f.s.player.deck).toContainEqual(
      expect.objectContaining({ id: signature.id, ownerId: "p1" }),
    );
    expect(f.s.player.discard.map((p) => p.id)).toEqual([other.id]);
    expect(f.ports.shufflePlayerDeck).toHaveBeenCalledTimes(1);
  });
  it("Captain Americat places a toon on its actual foreign controller's identity without granting a resource ability", () => {
    const f = fixture(2),
      ally = f.controlled("30002"),
      originalIdentity = physicalIdentity(f.s);
    ally.ownerId = "p1";
    f.s.player.inPlay.splice(f.s.player.inPlay.indexOf(ally), 1);
    seatView(f.s, "p2").player.inPlay.push(ally);
    f.ports.addIdentityToonCounters = vi.fn(
      (state: GameState, count: number) => {
        state.flags.spiderHamForeignToonCounters =
          Number(state.flags.spiderHamForeignToonCounters || 0) + count;
      },
    );
    activateSeat(f.s, "p2");
    f.effects(spiderHamAllyEnter(f.s, ally, f.ports));
    f.reload();
    f.choose("use");
    expect(f.ports.addIdentityToonCounters).toHaveBeenCalledOnce();
    expect(f.ports.addIdentityToonCounters).toHaveBeenCalledWith(f.s, 1);
    expect(f.s.activePlayerId).toBe("p2");
    expect(f.s.flags.spiderHamForeignToonCounters).toBe(1);
    expect(
      seatView(f.s, "p1").flags.spiderHamForeignToonCounters,
    ).toBeUndefined();
    expect(originalIdentity.counters).toBe(0);
    expect(physicalIdentity(seatView(f.s, "p1")).counters).toBe(0);
    expect(f.s.player.inPlay.find((p) => p.id === ally.id)?.ownerId).toBe("p1");
    expect(spiderHamResourceSources(f.s, undefined, f.ports)).toEqual([]);
  });
  it("Ham It Up uses current toon counters without spending them and native thwart targeting", () => {
    const f = fixture();
    spiderHamAddToonCounters(f.s, 4);
    const p = f.piece("30003");
    expect(spiderHamPlayRestriction(f.s, p, f.ports)).toBeNull();
    f.effects(spiderHamEvent(f.s, p));
    f.choose("main");
    expect(f.s.scheme.threat).toBe(6);
    expect(spiderHamToonCounters(f.s)).toBe(4);
    spiderHamSpendToonCounters(f.s, 4);
    expect(spiderHamPlayRestriction(f.s, p, f.ports)).toMatch(/needs toon/);
    f.s.player.confused = true;
    expect(spiderHamPlayRestriction(f.s, p, f.ports)).toBeNull();
  });
  it("Hogwashed pays its additional toon after resources and bypasses attack/thwart target restrictions", () => {
    const f = fixture(),
      p = f.piece("30004"),
      minion = f.minion(),
      scheme = f.side();
    spiderHamAddToonCounters(f.s, 2);
    f.s.player.stunned = f.s.player.confused = true;
    f.s.flags[`testAttackBlocked:${minion.id}`] = true;
    f.s.flags[`testThwartBlocked:${scheme.id}`] = true;
    expect(spiderHamPlayRestriction(f.s, p, f.ports)).toBeNull();
    f.effects(spiderHamBeforeEvent(f.s, p, spiderHamEvent(f.s, p)!));
    expect(spiderHamToonCounters(f.s)).toBe(1);
    expect(f.s.prompt?.options.map((o) => o.id)).toContain(minion.id);
    expect(f.s.prompt?.options.map((o) => o.id)).toContain(scheme.id);
    f.choose(minion.id);
    expect(minion.damage).toBe(5);
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.player.confused).toBe(true);
    expect(f.ports.attackProgram).not.toHaveBeenCalled();
  });
  it("Hogwashed removes side-scheme threat as an unlabelled effect, never the main scheme", () => {
    const f = fixture(),
      scheme = f.side("30025", 8),
      p = f.piece("30004");
    spiderHamAddToonCounters(f.s, 1);
    f.effects(spiderHamBeforeEvent(f.s, p, spiderHamEvent(f.s, p)!));
    expect(f.s.prompt?.options.map((o) => o.id)).not.toContain("main");
    f.choose(scheme.id);
    expect(scheme.counters).toBe(3);
    expect(f.s.scheme.threat).toBe(10);
    f.s.flags.testCannotPay = true;
    expect(spiderHamPlayRestriction(f.s, p, f.ports)).toMatch(
      /additional toon/,
    );
  });
  it("Petulant Pig waits for the complete native attack before drawing, including a canceled attack", () => {
    const f = fixture();
    f.s.villain.stunned = true;
    f.effects(spiderHamEvent(f.s, f.piece("30006")));
    expect(f.ports.attackVillain).toHaveBeenCalledTimes(1);
    expect(f.s.flags.testDrawn).toBeUndefined();
    const after = vi.mocked(f.ports.attackVillain).mock.calls[0][2];
    f.effects(JSON.parse(JSON.stringify(after)));
    expect(f.s.flags.testDrawn).toBe(3);
  });
  it("Swinging Web Pig runs a single native six-damage attack and confuses after its complete attack program", () => {
    const f = fixture(),
      m = f.minion(),
      p = f.piece("30007");
    f.effects(spiderHamEvent(f.s, p));
    f.choose(m.id);
    const [, effects, after] = vi.mocked(f.ports.attackProgram).mock.calls[0];
    expect(effects[0]).toMatchObject({
      amount: 6,
      attack: true,
      attackInitiated: true,
      abilitySource: p.id,
    });
    expect(after[0]).toMatchObject({
      type: "status",
      target: m.id,
      status: "confused",
    });
    expect(m.damage).toBe(6);
    expect(m.confused).toBe(true);
  });
  it("Daily Beagle is an alter-ego exhaustion action, while printed stat upgrades survive source exhaustion", () => {
    const f = fixture(),
      beagle = f.controlled("30008"),
      hammer = f.controlled("30010"),
      web = f.controlled("30011");
    expect(spiderHamAbilityOptions(f.s, beagle.id, f.ports)).toEqual([]);
    hammer.exhausted = web.exhausted = true;
    expect(spiderHamStats(f.s, f.ports)).toEqual({ attack: 1, thwart: 1 });
    f.s.flags[`testBlank:${hammer.id}`] = true;
    expect(spiderHamStats(f.s, f.ports)).toEqual({ attack: 0, thwart: 1 });
    f.s.player.form = "alter";
    f.effects(spiderHamAbility(f.s, beagle.id, "daily-beagle", f.ports));
    expect(beagle.exhausted).toBe(true);
    expect(spiderHamToonCounters(f.s)).toBe(1);
    expect(spiderHamAbilityOptions(f.s, beagle.id, f.ports)).toEqual([]);
    expect(spiderHamStats(f.s, f.ports)).toEqual({ attack: 0, thwart: 0 });
  });
  it("Huge Wooden Hammer spends its actual costs and grants only this basic attack +2 ATK and overkill", () => {
    const f = fixture(),
      hammer = f.controlled("30010");
    spiderHamAddToonCounters(f.s, 1);
    const packet = { type: "test-basic", amount: 2, basic: true };
    const option = spiderHamBasicAttackOptions(
      f.s,
      packet,
      [{ type: "test-after" }],
      f.ports,
    )[0];
    expect(option.id).toBe(hammer.id);
    f.reload();
    f.effects(JSON.parse(JSON.stringify(option.effects)));
    expect(f.s.flags.testBasicAmount).toBe(4);
    expect(f.s.flags.testBasicOverkill).toBe(true);
    expect(f.s.flags.testAfter).toBe(true);
    expect(spiderHamToonCounters(f.s)).toBe(0);
    expect(f.s.player.inPlay.find((p) => p.id === hammer.id)!.exhausted).toBe(
      true,
    );
    expect(spiderHamBasicAttackOptions(f.s, packet, [], f.ports)).toEqual([]);
  });
  it("Hammer is not offered for a stunned replacement, alter ego, blank/exhausted source or repeated packet", () => {
    const f = fixture(),
      hammer = f.controlled("30010");
    spiderHamAddToonCounters(f.s, 2);
    const packet = { type: "test-basic", amount: 2 };
    f.s.player.stunned = true;
    expect(spiderHamBasicAttackOptions(f.s, packet, [], f.ports)).toEqual([]);
    f.s.player.stunned = false;
    f.s.flags[`testBlank:${hammer.id}`] = true;
    expect(spiderHamBasicAttackOptions(f.s, packet, [], f.ports)).toEqual([]);
    delete f.s.flags[`testBlank:${hammer.id}`];
    expect(
      spiderHamBasicAttackOptions(
        f.s,
        { ...packet, spiderHamHammerHandled: true },
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.s.player.form = "alter";
    expect(spiderHamBasicAttackOptions(f.s, packet, [], f.ports)).toEqual([]);
  });
  it("Organic Webbing pays its native costs, readies the actual identity and grants Aerial until phase end", () => {
    const f = fixture(),
      web = f.controlled("30011");
    spiderHamAddToonCounters(f.s, 2);
    f.s.player.exhausted = true;
    f.effects(spiderHamAbility(f.s, web.id, "organic-webbing", f.ports));
    expect(f.s.player.exhausted).toBe(false);
    expect(web.exhausted).toBe(true);
    expect(spiderHamToonCounters(f.s)).toBe(1);
    f.reload();
    expect(spiderHamTraits(f.s)).toEqual(["Aerial"]);
    f.s.player.form = "alter";
    expect(spiderHamTraits(f.s)).toEqual(["Aerial"]);
    spiderHamPhaseEnded(f.s);
    expect(spiderHamTraits(f.s)).toEqual([]);
  });
  it("Organic Webbing can gain Aerial without a ready, but rejects a wholly ineffective action", () => {
    const f = fixture(),
      web = f.controlled("30011");
    spiderHamAddToonCounters(f.s, 2);
    f.s.flags.testReadyLocked = true;
    expect(spiderHamAbilityOptions(f.s, web.id, f.ports)).toHaveLength(1);
    f.effects(spiderHamAbility(f.s, web.id, undefined, f.ports));
    web.exhausted = false;
    expect(spiderHamAbilityOptions(f.s, web.id, f.ports)).toEqual([]);
  });
  it.each(["hero", "alter"] as const)(
    "Cartoon Physics is optional in %s form for the retained identity packet and actual discard cost",
    (form) => {
      const f = fixture(),
        physics = f.controlled("30009");
      f.s.player.form = form;
      const context: SpiderHamDamageContext = {
        token: "damage-physics",
        playerId: "p1",
        targetId: "hero",
        amount: 7,
      };
      expect(
        spiderHamDamageOptions(f.s, { ...context, amount: 1 }, [], f.ports),
      ).toEqual([]);
      expect(
        spiderHamDamageOptions(
          f.s,
          { ...context, targetId: "ally" },
          [],
          f.ports,
        ),
      ).toEqual([]);
      f.effects(
        spiderHamDamageOptions(
          f.s,
          context,
          [{ type: "test-after" }],
          f.ports,
        )[0].effects,
      );
      expect(f.s.player.discard.map((p) => p.id)).toContain(physics.id);
      expect(vi.mocked(f.ports.preventDamage).mock.calls[0]).toEqual([
        f.s,
        context,
        6,
      ]);
      expect(f.s.flags.testAfter).toBe(true);
    },
  );
  it("Cartoon Physics waits for a successfully paid discard and rechecks remaining damage after leave windows", () => {
    const f = fixture(),
      p = f.controlled("30009"),
      context = {
        token: "damage-later",
        playerId: "p1",
        targetId: "hero:p1",
        amount: 7,
      };
    vi.mocked(f.ports.discardControlledCost).mockImplementation(() => {});
    f.effects(spiderHamDamageOptions(f.s, context, [], f.ports)[0].effects);
    expect(f.ports.preventDamage).not.toHaveBeenCalled();
    const after = vi.mocked(f.ports.discardControlledCost).mock.calls[0][2];
    f.s.flags[`testRemaining:${context.token}`] = 3;
    f.reload();
    f.effects(JSON.parse(JSON.stringify(after)));
    expect(vi.mocked(f.ports.preventDamage).mock.calls[0][2]).toBe(2);
    f.s.flags[`testCannotDiscard:${p.id}`] = true;
    expect(spiderHamDamageOptions(f.s, context, [], f.ports)).toEqual([]);
  });
  it('"I Don\'t Think So!" requires own hero encounter-deck reveal and combined resource/toon legality', () => {
    const f = fixture(),
      event = f.piece("30005"),
      encounter = f.piece("30030");
    f.s.player.hand.push(event);
    spiderHamAddToonCounters(f.s, 2);
    const receipt = f.revealReceipt(encounter);
    expect(spiderHamRevealOptions(f.s, receipt, [], f.ports)).toHaveLength(1);
    expect(
      spiderHamRevealOptions(
        f.s,
        { ...receipt, fromEncounterDeck: false },
        [],
        f.ports,
      ),
    ).toEqual([]);
    expect(
      spiderHamRevealOptions(f.s, { ...receipt, playerId: "p2" }, [], f.ports),
    ).toEqual([]);
    f.s.flags.testCannotPay = true;
    expect(spiderHamRevealOptions(f.s, receipt, [], f.ports)).toEqual([]);
    delete f.s.flags.testCannotPay;
    f.s.player.form = "alter";
    expect(spiderHamRevealOptions(f.s, receipt, [], f.ports)).toEqual([]);
    expect(spiderHamPlayRestriction(f.s, event, f.ports)).toMatch(/hero form/);
  });
  it("reveal reaction defers additional toon payment until native event PLAY commits and cancels the exact actual card", () => {
    const f = fixture(),
      event = f.piece("30005"),
      encounter = f.piece("30030");
    f.s.player.hand.push(event);
    f.s.resolving.push(encounter);
    spiderHamAddToonCounters(f.s, 2);
    const receipt = f.revealReceipt(encounter),
      after = [{ type: "test-after" }];
    f.effects(spiderHamRevealOptions(f.s, receipt, after, f.ports)[0].effects);
    expect(f.ports.playRevealReaction).toHaveBeenCalledWith(
      f.s,
      event.id,
      receipt,
      after,
    );
    expect(spiderHamToonCounters(f.s)).toBe(2);
    expect(f.ports.cancelEncounter).not.toHaveBeenCalled();
    f.reload();
    f.effects(spiderHamRevealCancelEffects(f.s, event, receipt));
    expect(spiderHamToonCounters(f.s)).toBe(1);
    expect(vi.mocked(f.ports.cancelEncounter).mock.calls[0][1].id).toBe(
      encounter.id,
    );
    expect(
      f.s.encounter.discard.filter((p) => p.id === encounter.id),
    ).toHaveLength(1);
    expect(f.s.resolving).toEqual([]);
  });
  it("initializes five actual nemesis reserve pieces once and reveals/shuffles those same physical IDs", () => {
    const f = fixture();
    spiderHamInitializeNemesis(f.s, f.ports);
    const ids = f.s.player.setAside!.map((p) => p.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(f.s.player.setAside!.every((p) => p.ownerId === "p1")).toBe(true);
    f.reload();
    spiderHamInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual(ids);
    spiderHamAddToonCounters(f.s, 3);
    f.effects(spiderHamShadowOfPast(f.s));
    expect(f.s.player.setAside).toEqual([]);
    expect(f.s.minions[0].code).toBe("30026");
    expect(f.s.sideSchemes[0].counters).toBe(3);
    expect(spiderHamToonCounters(f.s)).toBe(0);
    expect(
      [...f.s.minions, ...f.s.sideSchemes, ...f.s.encounter.deck]
        .map((p) => p.id)
        .sort(),
    ).toEqual([...ids].sort());
    expect(spiderHamShadowOfPast(f.s)).toEqual([
      { type: "surge", sourceCode: "01190" },
    ]);
  });
  it("Gobbler engagement clears all controlled all-purpose counters including identity, preserving damage and status cards", () => {
    const f = fixture(2),
      source = f.minion(),
      card = f.controlled("30009");
    spiderHamAddToonCounters(f.s, 3);
    card.counters = 5;
    card.damage = 2;
    card.tough = card.stunned = card.confused = true;
    f.s.player.hp = 4;
    f.s.player.stunned = true;
    f.effects(spiderHamMinionEngaged(f.s, source, "p1"));
    expect(card.counters).toBe(0);
    expect(spiderHamToonCounters(f.s)).toBe(0);
    expect(card.damage).toBe(2);
    expect(card.tough && card.stunned && card.confused).toBe(true);
    expect(f.s.player.hp).toBe(4);
    expect(f.s.player.stunned).toBe(true);
    source.treatedAsMinion = true;
    expect(spiderHamMinionEngaged(f.s, source)).toEqual([]);
  });
  it("Gobbler's queued engagement response revalidates the actual unblanked source before clearing", () => {
    const f = fixture(),
      source = f.minion();
    spiderHamAddToonCounters(f.s, 4);
    const effects = spiderHamMinionEngaged(f.s, source);
    f.s.minions = [];
    f.effects(effects);
    expect(spiderHamToonCounters(f.s)).toBe(4);
    expect(f.ports.clearControlledCounters).not.toHaveBeenCalled();
  });
  it("Nefarious Trap attacks its actual defeater with an already in-play Gobbler", () => {
    const f = fixture(2),
      source = f.minion(),
      scheme = f.side();
    f.effects(spiderHamSideDefeated(f.s, scheme, "p2"));
    expect(f.ports.enemyAttack).toHaveBeenCalledWith(f.s, source.id, "p2", []);
    expect(f.ports.putMinion).not.toHaveBeenCalled();
  });
  it("Nefarious Trap searches and PUTs the actual absent Gobbler, clearing counters without a newly invented attack", () => {
    const f = fixture(),
      p = f.piece("30026"),
      scheme = f.side();
    f.s.encounter.discard.push(p);
    spiderHamAddToonCounters(f.s, 2);
    f.effects(spiderHamSideDefeated(f.s, scheme));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([p.id]);
    f.reload();
    f.choose(p.id);
    expect(f.s.minions[0]).toMatchObject({
      id: p.id,
      code: "30026",
      engagedWith: "p1",
    });
    expect(spiderHamToonCounters(f.s)).toBe(0);
    expect(f.ports.enemyAttack).not.toHaveBeenCalled();
    expect(f.ports.revealEncounter).not.toHaveBeenCalled();
    expect(f.ports.shuffleEncounter).toHaveBeenCalledTimes(1);
  });
  it("Gobbler Glider prioritizes Gobbler, attaches the actual instance and grants Aerial through its unblanked source", () => {
    const f = fixture(),
      other = f.minion("30031"),
      gobbler = f.minion(),
      glider = f.piece("30027");
    f.s.resolving.push(glider);
    f.effects(spiderHamEncounterReveal(f.s, glider));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([gobbler.id]);
    f.choose(gobbler.id);
    expect(f.s.attachments[0]).toMatchObject({
      id: glider.id,
      attachedTo: gobbler.id,
    });
    expect(spiderHamEnemyTraits(f.s, gobbler)).toEqual(["Aerial"]);
    expect(spiderHamEnemyTraits(f.s, other)).toEqual([]);
    glider.treatedAsMinion = true;
    expect(spiderHamEnemyTraits(f.s, gobbler)).toEqual([]);
  });
  it.each([false, true])(
    "Feast damages before applying confusion and gains Surge only if already confused=%s",
    (already) => {
      const f = fixture(),
        p = f.piece("30028"),
        hp = f.s.player.hp;
      f.s.player.confused = already;
      f.effects(spiderHamEncounterReveal(f.s, p));
      expect(f.s.player.hp).toBe(hp - 2);
      expect(f.s.player.confused).toBe(true);
      expect(Number(f.s.flags.testSurge || 0)).toBe(Number(already));
    },
  );
  it("obligation offers a voluntary alter-ego flip and pays both actual exhaust/toon costs to remove its physical card", () => {
    const f = fixture(),
      p = f.piece("30024");
    f.s.resolving.push(p);
    spiderHamAddToonCounters(f.s, 2);
    f.effects(spiderHamEncounterReveal(f.s, p));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["alter", "stay"]);
    f.choose("alter");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["exhaust", "stun"]);
    f.reload();
    f.choose("exhaust");
    expect(f.s.player.exhausted).toBe(true);
    expect(spiderHamToonCounters(f.s)).toBe(1);
    expect(f.s.removed.some((q) => q.id === p.id)).toBe(true);
  });
  it("obligation routes to its actual owner and otherwise stuns or gains Surge when already stunned", () => {
    const f = fixture(2),
      p = f.piece("30024");
    f.s.resolving.push(p);
    f.s.player.form = "alter";
    f.s.player.stunned = true;
    const effects = spiderHamEncounterReveal(f.s, p);
    activateSeat(f.s, "p2");
    f.effects(effects);
    expect(f.s.activePlayerId).toBe("p1");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["stun"]);
    f.choose("stun");
    expect(f.s.flags.testSurge).toBe(1);
    expect(f.s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    expect(seatView(f.s, "p2").player.stunned).toBe(false);
  });
  it("does not invent boost abilities, unrelated events or cross-namespace dispatch", () => {
    const f = fixture();
    for (const code of ["30024", "30025", "30026", "30027", "30028"])
      expect(spiderHamBoost(f.s, f.piece(code))).toEqual([]);
    expect(spiderHamBoost(f.s, f.piece("30030"))).toBeNull();
    expect(spiderHamEvent(f.s, f.piece("30012"))).toBeNull();
    expect(spiderHamSideDefeated(f.s, f.side("30030"))).toBeNull();
    expect(spiderHamEncounterReveal(f.s, f.piece("30030"))).toBeNull();
    expect(
      resolveSpiderHamEffect(f.s, { type: "draw", amount: 1 }, f.ports),
    ).toBe(false);
    expect(() =>
      resolveSpiderHamEffect(f.s, { type: "spider-ham:unknown" }, f.ports),
    ).toThrow(/Unknown Spider-Ham/);
  });
});
