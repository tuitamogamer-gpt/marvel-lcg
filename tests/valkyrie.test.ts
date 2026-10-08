import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import starters from "../src/data/catalog-decks.json" with { type: "json" };
import { activateSeat, seatView, syncSeat } from "../src/game/team.js";
import { consumeTough } from "../src/game/keywords.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  VALKYRIE_SCRIPT_CODES,
  resolveValkyrieEffect,
  valkyrieAbility,
  valkyrieAbilityOptions,
  valkyrieAttachmentActions,
  valkyrieAttachmentDiscarded,
  valkyrieAttackBonusForTarget,
  valkyrieAttackInitiationOptions,
  valkyrieBeguiledEnemy,
  valkyrieBoost,
  valkyrieCanAttackTarget,
  valkyrieCanDiscardAttachment,
  valkyrieCannotBasicAttack,
  valkyrieCardEntered,
  valkyrieDeathGlowTarget,
  valkyrieDefenseBonusForAttacker,
  valkyrieDefeatReceipt,
  valkyrieEncounterReveal,
  valkyrieEnemyDefeatInterrupt,
  valkyrieEnemyDefeated,
  valkyrieEnemyStats,
  valkyrieEnemyTextBlank,
  valkyrieEnemyTraits,
  valkyrieEvent,
  valkyrieHPBonus,
  valkyrieInitializeNemesis,
  valkyriePlayRestriction,
  valkyrieSetup,
  valkyrieShadowOfPast,
  valkyrieStats,
  valkyrieTraits,
  type ValkyrieDefeatReceipt,
  type ValkyriePorts,
} from "../src/game/valkyrie.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const starter = starters.find((d) => d.heroCode === "25001a")!;
const V = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `valkyrie:${type}`,
  ...args,
});
let serial = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `valk${++serial}`,
  code,
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ...patch,
});
const player = (): GameState["player"] => ({
  form: "hero",
  hp: 12,
  exhausted: false,
  flipped: false,
  tough: false,
  stunned: false,
  confused: false,
  hand: [],
  deck: [],
  discard: [],
  inPlay: [],
  setAside: [],
});
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function fixture() {
  let s: GameState = {
    version: 1,
    seed: 25,
    nextId: 1,
    heroId: "valk",
    aspect: "aggression",
    villainId: "rhino",
    difficulty: "standard",
    module: "bomb_scare",
    phase: "player",
    round: 1,
    players: [],
    activePlayerId: "p1",
    firstPlayerId: "p1",
    turnPlayerId: "p1",
    playerCount: 1,
    guided: false,
    review: null,
    reviewCount: 0,
    player: player(),
    villain: { ...piece("01094"), hp: 14, maxHp: 14, stage: 1 },
    scheme: { code: "01097", threat: 8, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    removed: [],
    resolving: [],
    queue: [],
    prompt: null,
    flags: {},
    log: [],
    attack: null,
  };
  s.player.deck = Object.entries(starter.cards).flatMap(([code, count]) =>
    Array.from({ length: count }, () => piece(code, { ownerId: "p1" })),
  );
  s.players = [
    {
      id: "p1",
      heroId: "valk",
      aspect: "aggression",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  const sourceIds = s.player.deck.map((p) => p.id),
    native: Effect[] = [];
  const ports: ValkyriePorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: () => true,
    flip: (state, counts, target) => {
      state.player.form = target === "alter" ? "alter" : "hero";
      if (counts) state.player.flipped = true;
    },
    canReadyIdentity: (state) => !state.flags.readyLocked,
    canPay: (state) => !state.flags.paymentBlocked,
    canGiveStatus: () => true,
    enemyTargets: (state, attack) => [
      ...(!attack || !state.flags.guard
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(state.scheme.threat > 0 && (!thwart || !state.flags.crisis)
        ? [{ id: "main", label: "Main scheme", code: state.scheme.code }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    isIdentityTextBlank: (state) => !!state.flags.identityBlank,
    discardHand: (state, id) => {
      const p = take([state.player.hand], id);
      if (p) state.player.discard.push(p);
    },
    discardPiece: vi.fn((state, id) => {
      for (const seat of state.players) {
        const view = seatView(state, seat),
          p = take([view.player.inPlay], id);
        if (p) view.player.discard.push(p);
      }
      const p = take([state.attachments], id);
      if (p) state.encounter.discard.push(p);
    }),
    revealHidden: vi.fn(),
    recycleEncounter: vi.fn(),
    attackProgram: vi.fn((state, effects, after) =>
      ports.queue(state, ...effects, ...after),
    ),
    log: vi.fn(),
    cardCost: (_state, p) => cards.get(p.code)?.cost || 0,
    makePiece: (_state, code) => piece(code),
    shuffleEncounter: vi.fn((state) => state.encounter.deck.reverse()),
    shufflePlayerDeck: vi.fn((state, after) => {
      state.player.deck.reverse();
      ports.queue(state, ...after);
    }),
    canPutMinion: (state, p) => !state.flags[`entryBlocked:${p.id}`],
    putMinion: vi.fn((state, id, playerId, after) => {
      const p = take([state.encounter.deck, state.encounter.discard], id);
      if (!p) return false;
      p.engagedWith = playerId;
      state.minions.push(p);
      ports.queue(state, { type: "fixture:entry", id }, ...after);
      return true;
    }),
    playSetAside: vi.fn((state: GameState, id: string, after: Effect[]) => {
      const p = state.player.setAside!.find((p) => p.id === id)!;
      ports.queue(state, {
        type: "payRequest",
        title: "Death-Glow",
        piece: p,
        cost: ports.cardCost(state, p),
        cancelable: true,
        after: [{ type: "fixture:play-glow", id, after }],
      });
    }),
    setAsideOwnedPiece: vi.fn((state: GameState, id: string) => {
      const p = take([state.player.inPlay], id);
      if (!p) return false;
      delete p.attachedTo;
      p.exhausted = false;
      p.counters = p.damage = 0;
      state.player.setAside ||= [];
      state.player.setAside.push(p);
      return true;
    }),
    canDeclareIdentityDefender: (state) =>
      !!state.attack && !state.flags.defenderLocked,
    declareIdentityDefender: vi.fn((state, playerId, bonus, after) => {
      state.attack!.defender = "hero";
      state.attack!.targetPlayerId = playerId;
      state.attack!.basicDefense = false;
      state.attack!.defenseBonus =
        Number(state.attack!.defenseBonus || 0) + bonus;
      state.attack!.defense =
        1 +
        valkyrieStats(state, ports).defense +
        valkyrieDefenseBonusForAttacker(state, state.attack!.attacker, ports) +
        state.attack!.defenseBonus;
      ports.queue(state, ...after);
    }),
  };
  function run(state = s): GameState {
    state = reload(state);
    // Rebind after hydration, exactly as the host does before saved effects.
    const active = state.players.find((p) => p.id === state.activePlayerId)!;
    active.player = state.player;
    active.flags = state.flags;
    for (let n = 0; state.queue.length && !state.prompt && n < 100; n++) {
      const e = state.queue.shift()!;
      if (e.actorId && e.actorId !== state.activePlayerId)
        activateSeat(state, e.actorId);
      if (resolveValkyrieEffect(state, e, ports)) continue;
      native.push(e);
      if (e.type === "payRequest") {
        state.prompt = {
          kind: "payment",
          title: e.title,
          text: "",
          options: [],
          cost: e.cost,
          card: e.piece,
          after: e.after,
          requirements: e.requirements,
          cancelable: e.cancelable,
          abilityCost: e.abilityCost,
          paymentTarget: e.targetCode,
        };
      } else if (e.type === "fixture:play-glow") {
        const p = take([state.player.setAside || []], e.id)!;
        state.player.inPlay.push(p);
        ports.queue(state, ...valkyrieCardEntered(state, p), ...e.after);
      } else if (e.type === "resolveHandEvent") {
        const p = take([state.player.hand], e.id)!;
        state.resolving.push(p);
        ports.queue(
          state,
          ...e.after,
          { type: "fixture:discard-event", id: p.id },
          ...(e.continuation || []),
        );
      } else if (e.type === "fixture:discard-event") {
        const p = take([state.resolving], e.id)!;
        state.player.discard.push(p);
      } else if (e.type === "draw") {
        for (let i = 0; i < e.amount; i++) {
          const p = state.player.deck.shift();
          if (p) state.player.hand.push(p);
        }
      } else if (e.type === "ready") {
        const view = e.target.startsWith("hero:")
          ? seatView(state, e.target.slice(5))
          : state;
        if (ports.canReadyIdentity(view, view.activePlayerId))
          view.player.exhausted = false;
      } else if (e.type === "heal") {
        const view = e.target.startsWith("hero:")
          ? seatView(state, e.target.slice(5))
          : state;
        view.player.hp = Math.min(
          12 + valkyrieHPBonus(view, ports),
          view.player.hp + e.amount,
        );
      } else if (e.type === "thwart") {
        if (e.target === "main")
          state.scheme.threat = Math.max(0, state.scheme.threat - e.amount);
        else {
          const p = state.sideSchemes.find((p) => p.id === e.target);
          if (p) p.counters = Math.max(0, p.counters - e.amount);
        }
      } else if (e.type === "threat") {
        if (e.target === "main")
          state.scheme.threat = Math.max(0, state.scheme.threat + e.amount);
        else {
          const p = state.sideSchemes.find((p) => p.id === e.target);
          if (p) p.counters = Math.max(0, p.counters + e.amount);
        }
      } else if (e.type === "damage") {
        const p =
          e.target === state.villain.id
            ? state.villain
            : state.minions.find((p) => p.id === e.target);
        if (p && !consumeTough(p)) p.damage += e.amount;
      } else if (e.type === "reveal") {
        state.resolving.push(e.piece);
      }
    }
    s = state;
    syncSeat(s);
    return s;
  }
  function step(effects: Effect | Effect[], state = s) {
    state.queue.unshift(...(Array.isArray(effects) ? effects : [effects]));
    return run(state);
  }
  function choose(id: string, state = s) {
    const o = state.prompt!.options.find((o) => o.id === id);
    expect(o, JSON.stringify(state.prompt)).toBeTruthy();
    state.prompt = null;
    state.queue.unshift(...o!.effects);
    return run(state);
  }
  function pay(resourceId: string | string[], state = s) {
    expect(state.prompt!.kind).toBe("payment");
    const generated: string[] = [];
    for (const id of Array.isArray(resourceId) ? resourceId : [resourceId]) {
      const p = take([state.player.hand], id);
      expect(p).toBeTruthy();
      const c = cards.get(p!.code)!;
      for (const type of ["energy", "mental", "physical", "wild"] as const)
        generated.push(...Array(Number(c[`resource_${type}`] || 0)).fill(type));
      state.player.discard.push(p!);
    }
    expect(generated.length).toBeGreaterThanOrEqual(state.prompt!.cost!);
    for (const requirement of state.prompt!.requirements || []) {
      const index = generated.includes(requirement)
        ? generated.indexOf(requirement)
        : generated.indexOf("wild");
      expect(index, `Missing ${requirement} resource`).toBeGreaterThanOrEqual(
        0,
      );
      generated.splice(index, 1);
    }
    const after = state.prompt!.after!;
    state.prompt = null;
    state.queue.unshift(...after);
    return run(state);
  }
  function cancel(state = s) {
    expect(state.prompt?.cancelable).toBe(true);
    state.prompt = null;
    state.queue = [];
    return run(state);
  }
  function owned(
    code: string,
    zone: "inPlay" | "hand" | "discard" = "inPlay",
    playerId = s.activePlayerId,
  ) {
    const view = seatView(s, playerId),
      p = [
        view.player.deck,
        view.player.hand,
        view.player.discard,
        view.player.inPlay,
        view.player.setAside || [],
      ]
        .flat()
        .find((p) => p.code === code);
    if (!p) throw Error(`No actual source ${code}`);
    const actual = take(
      [
        view.player.deck,
        view.player.hand,
        view.player.discard,
        view.player.inPlay,
        view.player.setAside || [],
      ],
      p.id,
    )!;
    view.player[zone].push(actual);
    return actual;
  }
  function conserve(state = s) {
    const zones = state.players.flatMap((seat) => {
      const p = seatView(state, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    });
    zones.push(...state.resolving, ...state.removed, ...state.minions);
    for (const id of sourceIds)
      expect(
        zones.filter((p) => p.id === id),
        id,
      ).toHaveLength(1);
  }
  function second() {
    s.players.push({
      id: "p2",
      heroId: "spider_man",
      aspect: "justice",
      player: player(),
      flags: {},
      ended: false,
      eliminated: false,
      mulliganDone: true,
    });
    s.playerCount = 2;
    return seatView(s, "p2").player;
  }
  function glow(target = s.villain.id) {
    const p = owned("25002");
    p.attachedTo = target;
    return p;
  }
  function receipt(attack = true, identityId: string | undefined = "hero:p1") {
    return valkyrieDefeatReceipt(
      s,
      s.villain.id,
      { identityId, attack },
      ports,
    )[0];
  }
  return {
    get s() {
      return s;
    },
    ports,
    native,
    sourceIds,
    run,
    step,
    choose,
    pay,
    cancel,
    owned,
    conserve,
    second,
    glow,
    receipt,
  };
}
function take(zones: Piece[][], id: string): Piece | undefined {
  const z = zones.find((z) => z.some((p) => p.id === id));
  return z?.splice(
    z.findIndex((p) => p.id === id),
    1,
  )[0];
}

describe("Valkyrie original faces and physical setup", () => {
  it("covers the exact18 identity/signature/encounter faces without pool aliases", () => {
    const expected = (catalog as unknown as Card[])
      .filter(
        (c) =>
          c.pack_code === "valk" &&
          (c.faction_code === "hero" || c.faction_code === "encounter"),
      )
      .map((c) => c.code)
      .sort();
    expect([...VALKYRIE_SCRIPT_CODES].sort()).toEqual(expected);
    expect(new Set(VALKYRIE_SCRIPT_CODES).size).toBe(18);
    expect(
      Object.entries(starter.cards).reduce(
        (n, [code, count]) =>
          n + (cards.get(code)!.faction_code === "hero" ? count : 0),
        0,
      ),
    ).toBe(16);
  });
  it("uses exact original41 and sets aside the same Death-Glow before shuffling", () => {
    const f = fixture(),
      original = f.s.player.deck.find((p) => p.code === "25002")!;
    expect(f.s.player.deck).toHaveLength(41);
    valkyrieSetup(f.s);
    expect(f.s.player.deck).toHaveLength(40);
    expect(f.s.player.setAside).toEqual([original]);
    expect(f.s.player.setAside![0].ownerId).toBe("p1");
    f.conserve();
    const s = f.run();
    valkyrieSetup(s);
    expect(s.player.setAside).toHaveLength(1);
    f.conserve(s);
  });
  it("never creates a replacement Death-Glow or reconstructs a missing setup source", () => {
    const f = fixture();
    f.s.player.deck = f.s.player.deck.filter((p) => p.code !== "25002");
    expect(() => valkyrieSetup(f.s)).toThrow(/actual Death-Glow/);
  });
  it("creates exactly five actual nemesis cards alongside Death-Glow once", () => {
    const f = fixture();
    valkyrieSetup(f.s);
    valkyrieInitializeNemesis(f.s, f.ports);
    const ids = f.s.player.setAside!.map((p) => p.id);
    expect(f.s.player.setAside!.map((p) => p.code)).toEqual([
      "25002",
      "25029",
      "25030",
      "25031",
      "25032",
      "25032",
    ]);
    valkyrieInitializeNemesis(f.run(), f.ports);
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual(ids);
    f.conserve();
  });
  it("Shadow uses actual set-aside IDs and does not shuffle Death-Glow into encounter", () => {
    const f = fixture();
    valkyrieSetup(f.s);
    valkyrieInitializeNemesis(f.s, f.ports);
    const original = f.s.player.setAside!.map((p) => p.id);
    f.step(valkyrieShadowOfPast(f.s)!);
    expect(f.s.resolving.map((p) => p.code)).toEqual(["25029", "25030"]);
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual([
      "25032",
      "25032",
      "25031",
    ]);
    expect(f.s.player.setAside!.map((p) => p.code)).toEqual(["25002"]);
    expect(
      [...f.s.resolving, ...f.s.encounter.deck, ...f.s.player.setAside!]
        .map((p) => p.id)
        .sort(),
    ).toEqual(original.sort());
    expect(valkyrieShadowOfPast(f.s)).toEqual([
      { type: "surge", sourceCode: "01190" },
    ]);
    f.conserve();
  });
  it("leaves other heroes' setup unchanged", () => {
    const f = fixture();
    f.s.heroId = "spider_man";
    valkyrieSetup(f.s);
    expect(f.s.player.deck).toHaveLength(41);
    expect(valkyrieShadowOfPast(f.s)).toBeNull();
  });
});

describe("selected-target bonuses and current errata", () => {
  it("keeps base Dragonfang/Spear separate from their selected-enemy increment", () => {
    const f = fixture();
    f.owned("25005");
    f.owned("25006");
    f.glow();
    expect(valkyrieStats(f.s, f.ports)).toEqual({
      attack: 1,
      thwart: 0,
      defense: 1,
    });
    expect(valkyrieAttackBonusForTarget(f.s, f.s.villain.id, f.ports)).toBe(1);
    expect(valkyrieDefenseBonusForAttacker(f.s, f.s.villain.id, f.ports)).toBe(
      1,
    );
    expect(valkyrieAttackBonusForTarget(f.s, "other", f.ports)).toBe(0);
  });
  it("a blank Death-Glow is still attached for Dragonfang/Spear", () => {
    const f = fixture();
    f.owned("25006");
    f.owned("25005");
    const glow = f.glow();
    f.s.flags[`blank:${glow.id}`] = true;
    expect(valkyrieAttackBonusForTarget(f.s, f.s.villain.id, f.ports)).toBe(1);
    expect(valkyrieDefenseBonusForAttacker(f.s, f.s.villain.id, f.ports)).toBe(
      1,
    );
    expect(f.receipt()).toMatchObject({ glowId: glow.id });
  });
  it("blanked weapons lose both bonuses; alter-ego never has weapon hero stats", () => {
    const f = fixture();
    const p = f.owned("25006");
    f.glow();
    f.s.flags[`blank:${p.id}`] = true;
    expect(valkyrieStats(f.s, f.ports).attack).toBe(0);
    expect(valkyrieAttackBonusForTarget(f.s, f.s.villain.id, f.ports)).toBe(0);
    delete f.s.flags[`blank:${p.id}`];
    f.s.player.form = "alter";
    expect(valkyrieStats(f.s, f.ports).attack).toBe(0);
  });
  it("Aragorn's YOU grants4HP and Aerial in both forms and respects text blanking", () => {
    const f = fixture(),
      p = f.owned("25007");
    for (const form of ["hero", "alter"] as const) {
      f.s.player.form = form;
      expect(valkyrieHPBonus(f.s, f.ports)).toBe(4);
      expect(valkyrieTraits(f.s, f.ports)).toEqual(["Aerial"]);
    }
    f.s.flags[`blank:${p.id}`] = true;
    expect(valkyrieHPBonus(f.s, f.ports)).toBe(0);
    expect(valkyrieTraits(f.s, f.ports)).toEqual([]);
  });
});

describe("Death-Glow play, detach, defeat and serialized response receipts", () => {
  it("a blank Death-Glow preserves Valhalla and Flight responses without its own forced interrupt", () => {
    const f = fixture(),
      glow = f.glow(),
      valhalla = f.owned("25004"),
      flight = f.owned("25008");
    f.s.player.exhausted = true;
    f.s.player.hp = 8;
    f.s.flags[`blank:${glow.id}`] = true;
    const receipt = f.receipt();
    expect(receipt.responses.map((p) => p.id).sort()).toEqual(
      [valhalla.id, flight.id].sort(),
    );
    f.step(valkyrieEnemyDefeatInterrupt(f.s, receipt));
    expect(f.s.player.inPlay.some((p) => p.id === glow.id)).toBe(true);
    expect(f.s.player.exhausted).toBe(true);
    f.step(valkyrieEnemyDefeated(f.s, receipt));
    f.choose(valhalla.id);
    expect(f.s.player.hp).toBe(9);
    expect(f.s.player.hand).toHaveLength(1);
    f.choose(flight.id);
    expect(f.s.scheme.threat).toBe(3);
    expect(f.s.player.discard.some((p) => p.id === flight.id)).toBe(true);
    f.conserve();
  });
  it("Death Perception requests native paid PLAY while retaining its source zone", () => {
    const f = fixture();
    valkyrieSetup(f.s);
    const id = f.s.player.setAside![0].id;
    const r = f.owned("25025", "hand");
    expect(valkyrieAbility(f.s, "hero", f.ports)).toBe(true);
    f.run();
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      cost: 1,
      card: { id, code: "25002" },
    });
    expect(f.s.player.setAside!.some((p) => p.id === id)).toBe(true);
    f.pay(r.id);
    expect(valkyrieDeathGlowTarget(f.s)).toBe(f.s.villain.id);
    expect(f.s.player.inPlay.find((p) => p.code === "25002")!.id).toBe(id);
    f.conserve();
  });
  it("canceling the port's native payment leaves the same Death-Glow set aside", () => {
    const f = fixture();
    valkyrieSetup(f.s);
    const id = f.s.player.setAside![0].id;
    valkyrieAbility(f.s, "hero", f.ports);
    f.run();
    f.cancel();
    expect(f.s.player.setAside!.map((p) => p.id)).toContain(id);
    expect(f.s.player.inPlay).toHaveLength(0);
    f.conserve();
  });
  it("blocked payment, identity blanking, wrong form and no enemies hide Death Perception", () => {
    const f = fixture();
    valkyrieSetup(f.s);
    f.s.flags.paymentBlocked = true;
    expect(valkyrieAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    delete f.s.flags.paymentBlocked;
    f.s.flags.identityBlank = true;
    expect(valkyrieAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    delete f.s.flags.identityBlank;
    f.s.player.form = "alter";
    expect(valkyrieAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
  });
  it("Death-Glow's attachment choice ignores Guard because it is not an attack", () => {
    const f = fixture();
    f.s.flags.guard = true;
    const p = f.owned("25002");
    f.step(valkyrieCardEntered(f.s, p));
    expect(p.id).toBe(f.s.player.inPlay[0].id);
    expect(valkyrieDeathGlowTarget(f.s)).toBe(f.s.villain.id);
    f.conserve();
  });
  it("Brunnhilde detaches to the same physical set-aside card without discarding", () => {
    const f = fixture(),
      p = f.glow();
    f.s.player.form = "alter";
    valkyrieAbility(f.s, "hero", f.ports);
    f.run();
    expect(f.s.player.setAside).toMatchObject([{ id: p.id, code: "25002" }]);
    expect(f.s.player.setAside![0].attachedTo).toBeUndefined();
    expect(f.ports.discardPiece).not.toHaveBeenCalled();
    f.conserve();
  });
  it("the forced defeat interrupt sets aside first and readies only actual Valkyrie", () => {
    const f = fixture(),
      p = f.glow();
    f.s.player.exhausted = true;
    const r = f.receipt();
    expect(r).toMatchObject({ glowId: p.id, defeatedByValkyrie: true });
    f.step(valkyrieEnemyDefeatInterrupt(f.s, r));
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.setAside!.map((p) => p.id)).toContain(p.id);
    f.conserve();
  });
  it("an ally/support/other player's defeat still sets aside but does not ready her", () => {
    const f = fixture();
    f.glow();
    f.s.player.exhausted = true;
    const r = f.receipt(true, "hero:p2");
    f.step(valkyrieEnemyDefeatInterrupt(f.s, r));
    expect(f.s.player.exhausted).toBe(true);
    expect(r.defeatedByValkyrie).toBe(false);
  });
  it("duplicate forced effects cannot duplicate the actual card or ready twice", () => {
    const f = fixture();
    const p = f.glow(),
      r = f.receipt();
    f.step(valkyrieEnemyDefeatInterrupt(f.s, r));
    f.s.player.exhausted = true;
    f.step(valkyrieEnemyDefeatInterrupt(f.s, r));
    expect(f.s.player.exhausted).toBe(true);
    expect(
      f.s.player.setAside!.filter((candidate) => candidate.id === p.id),
    ).toHaveLength(1);
    f.conserve();
  });
  it("normal ready locks remain effective after the forced set-aside cost", () => {
    const f = fixture();
    f.glow();
    f.s.player.exhausted = true;
    f.s.flags.readyLocked = true;
    f.step(valkyrieEnemyDefeatInterrupt(f.s, f.receipt()));
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.setAside!.some((p) => p.code === "25002")).toBe(true);
  });
  it("a saved mandatory interrupt returns to the original actor after readying Valkyrie", () => {
    const f = fixture();
    const glow = f.glow();
    f.s.player.exhausted = true;
    f.second();
    activateSeat(f.s, "p2");
    const receipt = valkyrieDefeatReceipt(
      f.s,
      f.s.villain.id,
      { identityId: "hero:p1", attack: true },
      f.ports,
    )[0];
    f.step(valkyrieEnemyDefeatInterrupt(f.s, receipt));
    expect(f.s.activePlayerId).toBe("p2");
    expect(seatView(f.s, "p1").player.exhausted).toBe(false);
    expect(seatView(f.s, "p1").player.setAside!.map((p) => p.id)).toContain(
      glow.id,
    );
    f.conserve();
  });
  it("Valhalla uses the before-cleanup receipt, draws1 and heals1 after actual defeat", () => {
    const f = fixture();
    f.glow();
    const p = f.owned("25004");
    f.s.player.hp = 8;
    const r = f.receipt();
    f.step(valkyrieEnemyDefeatInterrupt(f.s, r));
    f.step(valkyrieEnemyDefeated(f.s, r));
    expect(f.s.prompt?.options.map((o) => o.id)).toContain(p.id);
    f.choose(p.id);
    expect(f.s.player.hp).toBe(9);
    expect(f.s.player.hand).toHaveLength(1);
    expect(f.s.player.inPlay.find((p) => p.code === "25004")!.exhausted).toBe(
      true,
    );
    f.conserve();
  });
  it("Valhalla requires an attack by Valkyrie, Flight does not", () => {
    const f = fixture();
    f.glow();
    f.owned("25004");
    const flight = f.owned("25008");
    expect(f.receipt(false).responses.map((p) => p.code)).toEqual(["25008"]);
    expect(
      f.receipt(true, "ally:physical-source").responses.map((p) => p.code),
    ).toEqual(["25008"]);
    f.step(valkyrieEnemyDefeated(f.s, f.receipt(false)));
    expect(f.s.prompt?.options.map((o) => o.id)).toContain(flight.id);
  });
  it("Flight discards its physical cost then removes5 non-thwart threat despite Crisis", () => {
    const f = fixture();
    f.glow();
    const p = f.owned("25008");
    f.s.flags.crisis = true;
    f.step(valkyrieEnemyDefeated(f.s, f.receipt(false)));
    f.choose(p.id);
    expect(f.s.player.discard.map((p) => p.id)).toContain(p.id);
    expect(f.s.scheme.threat).toBe(3);
    expect(f.native.find((e) => e.type === "thwart")).toEqual({
      type: "thwart",
      target: "main",
      amount: 5,
      source: p.id,
    });
    f.conserve();
  });
  it("two Flight copies remain separate response costs and can each resolve once", () => {
    const f = fixture();
    f.glow();
    const a = f.owned("25008"),
      b = f.owned("25008");
    f.s.scheme.threat = 12;
    f.step(valkyrieEnemyDefeated(f.s, f.receipt(false)));
    f.choose(a.id);
    expect(f.s.prompt!.options.some((o) => o.id === a.id)).toBe(false);
    f.choose(b.id);
    expect(f.s.scheme.threat).toBe(2);
    expect(f.s.player.discard.filter((p) => p.code === "25008")).toHaveLength(
      2,
    );
    f.conserve();
  });
  it("a teammate-controlled Flight records that actor and conserves physical ownership", () => {
    const f = fixture();
    f.glow();
    const other = f.second(),
      p = f.owned("25008");
    f.s.player.inPlay.splice(
      f.s.player.inPlay.findIndex((x) => x.id === p.id),
      1,
    );
    other.inPlay.push(p);
    const r = f.receipt(false);
    f.step(valkyrieEnemyDefeated(f.s, r));
    f.choose(p.id);
    expect(f.s.activePlayerId).toBe("p1");
    expect(
      seatView(f.s, "p2").player.discard.find((x) => x.id === p.id)!.ownerId,
    ).toBe("p1");
    expect(f.s.scheme.threat).toBe(3);
    f.conserve();
  });
  it("passing responses preserves optional sources and does not heal or draw", () => {
    const f = fixture();
    f.glow();
    f.owned("25004");
    f.owned("25008");
    f.s.player.hp = 8;
    f.step(valkyrieEnemyDefeated(f.s, f.receipt()));
    f.choose("pass");
    expect(f.s.player.hp).toBe(8);
    expect(f.s.player.hand).toHaveLength(0);
    expect(f.s.player.inPlay.some((p) => p.code === "25008")).toBe(true);
  });
});

describe("events, search costs and Shieldmaiden", () => {
  it("Have at Thee! snapshots Overkill before7 damage and does not add Dragonfang ATK", () => {
    const f = fixture();
    f.owned("25006");
    f.glow();
    const p = f.owned("25012", "hand");
    f.step(valkyrieEvent(f.s, p)!);
    expect(f.native.find((e) => e.type === "damage")).toMatchObject({
      amount: 7,
      overkill: true,
      attack: true,
      attackInitiated: true,
      abilitySource: p.id,
    });
  });
  it("Have at Thee! against an unmarked enemy has no Overkill", () => {
    const f = fixture(),
      p = f.owned("25012", "hand");
    f.step(valkyrieEvent(f.s, p)!);
    expect(f.native.find((e) => e.type === "damage")!.overkill).toBe(false);
  });
  it("Stun replaces Have at Thee!'s attack before target selection", () => {
    const f = fixture(),
      p = f.owned("25012", "hand");
    f.s.player.stunned = true;
    f.s.player.stunCards = 1;
    f.s.flags.guard = true;
    expect(valkyriePlayRestriction(f.s, p, f.ports)).toBeNull();
    f.step(valkyrieEvent(f.s, p)!);
    expect(f.s.player.stunCards).toBe(0);
    expect(f.s.player.stunned).toBe(false);
    expect(f.ports.attackProgram).not.toHaveBeenCalled();
    expect(f.s.prompt).toBeNull();
  });
  it("Trouble in Otherworld blocks only attacks against the marked enemy", () => {
    const f = fixture();
    f.glow();
    f.s.player.inPlay.push(piece("25028"));
    expect(valkyrieCanAttackTarget(f.s, f.s.villain.id, f.ports)).toBe(false);
    expect(valkyrieCanAttackTarget(f.s, "unmarked", f.ports)).toBe(true);
    const p = f.owned("25012", "hand");
    expect(valkyriePlayRestriction(f.s, p, f.ports)).toMatch(/legal attack/);
    f.s.player.stunned = true;
    expect(valkyriePlayRestriction(f.s, p, f.ports)).toBeNull();
  });
  it("Visit Valhalla retrieves the chosen actual signature, not similarly named aspect cards", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const p = f.owned("25006", "discard"),
      non = f.owned("25016", "discard"),
      event = f.owned("25009", "hand");
    f.step(valkyrieEvent(f.s, event)!);
    expect(f.s.prompt!.options.map((p) => p.id)).toEqual([p.id]);
    f.choose(p.id);
    expect(f.s.player.hand.map((p) => p.id)).toContain(p.id);
    expect(f.s.player.discard.map((p) => p.id)).toContain(non.id);
    f.conserve();
  });
  it("Annabelle pays exhaustion first and searches only actual top5 before shuffling", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const ann = f.owned("25003"),
      sixth = f.owned("25006", "hand");
    const blanks = f.s.player.deck
      .filter((p) => cards.get(p.code)!.faction_code !== "hero")
      .slice(0, 5);
    for (const p of blanks) take([f.s.player.deck], p.id);
    take([f.s.player.hand], sixth.id);
    f.s.player.deck.unshift(...blanks, sixth);
    valkyrieAbility(f.s, ann.id, f.ports);
    f.run();
    expect(f.s.player.inPlay.find((p) => p.id === ann.id)!.exhausted).toBe(
      true,
    );
    expect(f.s.player.hand.map((p) => p.id)).not.toContain(sixth.id);
    expect(f.ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    f.conserve();
  });
  it("Annabelle's saved selection retrieves the same searched signatureID", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const ann = f.owned("25003"),
      found = f.s.player.deck.find((p) => p.code === "25006")!;
    take([f.s.player.deck], found.id);
    f.s.player.deck.unshift(found);
    valkyrieAbility(f.s, ann.id, f.ports);
    f.run();
    const saved = reload(f.s);
    f.choose(found.id, saved);
    expect(f.s.player.hand.map((p) => p.id)).toContain(found.id);
    expect(f.ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    f.conserve();
  });
  it("Chooser pays actual minion entry before drawing2 and does not reveal it", () => {
    const f = fixture(),
      m = piece("25029");
    f.s.encounter.discard.push(m);
    const event = f.owned("25010", "hand");
    f.step(valkyrieEvent(f.s, event)!);
    expect(f.s.player.hand).toHaveLength(1);
    f.choose(m.id);
    expect(f.s.minions[0]).toMatchObject({ id: m.id, engagedWith: "p1" });
    expect(f.native.map((e) => e.type)).toEqual(["fixture:entry", "draw"]);
    expect(f.s.player.hand).toHaveLength(3);
    expect(f.s.attachments).toHaveLength(0);
    expect(f.ports.shuffleEncounter).toHaveBeenCalledOnce();
    f.conserve();
  });
  it("Chooser's failed/declined search never draws cards", () => {
    const f = fixture();
    f.s.encounter.deck.push(piece("25029"));
    f.step(valkyrieEvent(f.s, f.owned("25010", "hand"))!);
    f.choose("none");
    expect(f.native.some((e) => e.type === "draw")).toBe(false);
    expect(f.ports.shuffleEncounter).toHaveBeenCalledOnce();
  });
  it("Chooser cannot put a native illegal unique minion into play", () => {
    const f = fixture(),
      p = piece("25029");
    f.s.encounter.deck.push(p);
    f.s.flags[`entryBlocked:${p.id}`] = true;
    f.step(valkyrieEvent(f.s, f.owned("25010", "hand"))!);
    expect(f.s.prompt).toBeNull();
    expect(f.ports.putMinion).not.toHaveBeenCalled();
    expect(f.native.some((e) => e.type === "draw")).toBe(false);
  });
  it("Shieldmaiden pays/discards the physical event then defends without exhausting", () => {
    const f = fixture();
    f.glow();
    f.owned("25005");
    const p = f.owned("25011", "hand"),
      resource = f.owned("25025", "hand");
    f.s.player.exhausted = true;
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 2,
      boostCodes: [],
      boostIds: [],
      pendingBoosts: [],
      defender: "none",
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    const after = [{ type: "fixture:resume-attack" }];
    const o = valkyrieAttackInitiationOptions(
      f.s,
      f.s.villain.id,
      after,
      f.ports,
    )[0];
    f.step(o.effects);
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      cost: 1,
      card: { id: p.id },
      cancelable: false,
    });
    expect(f.ports.declareIdentityDefender).not.toHaveBeenCalled();
    f.pay(resource.id);
    expect(f.ports.declareIdentityDefender).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
      2,
      [],
    );
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.attack).toMatchObject({
      defender: "hero",
      targetPlayerId: "p1",
      basicDefense: false,
      defenseBonus: 2,
      defense: 5,
    });
    expect(f.s.player.discard.map((p) => p.id)).toContain(p.id);
    expect(f.native.at(-1)?.type).toBe("fixture:resume-attack");
    f.conserve();
  });
  it("Shieldmaiden requires the marked attacker, hero form, payable cost and a native legal defender", () => {
    const f = fixture();
    f.glow();
    f.owned("25011", "hand");
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 2,
      boostCodes: [],
      boostIds: [],
      pendingBoosts: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    expect(valkyrieAttackInitiationOptions(f.s, "other", [], f.ports)).toEqual(
      [],
    );
    f.s.flags.defenderLocked = true;
    expect(
      valkyrieAttackInitiationOptions(f.s, f.s.villain.id, [], f.ports),
    ).toEqual([]);
    delete f.s.flags.defenderLocked;
    f.s.player.form = "alter";
    expect(
      valkyrieAttackInitiationOptions(f.s, f.s.villain.id, [], f.ports),
    ).toEqual([]);
  });
});

describe("physical obligation, enchantments and transformed allies", () => {
  it("Trouble is handed to the Valkyrie seat, remains in play and offers no unprinted flip", () => {
    const f = fixture();
    f.second();
    const p = piece("25028");
    f.s.resolving.push(p);
    activateSeat(f.s, "p2");
    const effects = valkyrieEncounterReveal(f.s, p)!;
    expect(effects).toEqual([V("obligation", { id: p.id, actorId: "p1" })]);
    f.step(effects);
    expect(f.s.activePlayerId).toBe("p1");
    expect(f.s.player.inPlay.map((p) => p.id)).toContain(p.id);
    expect(f.s.resolving).toHaveLength(0);
    expect(f.s.prompt).toBeNull();
  });
  it("Trouble removal is energy+mental payment, then actual removal rather than discard", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const p = piece("25028");
    f.s.player.inPlay.push(p);
    const resource = f.owned("25025", "hand");
    const mental = f.owned("25026", "hand");
    valkyrieAbility(f.s, p.id, f.ports);
    f.run();
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      cost: 2,
      requirements: ["energy", "mental"],
      abilityCost: true,
      paymentTarget: "25028",
    });
    expect(f.s.removed).toHaveLength(0);
    f.pay([resource.id, mental.id]);
    expect(f.s.removed.map((p) => p.id)).toContain(p.id);
    expect(f.ports.discardPiece).not.toHaveBeenCalled();
  });
  it("canceling a condition payment preserves the actual attached/controlled source", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const p = piece("25028");
    f.s.player.inPlay.push(p);
    valkyrieAbility(f.s, p.id, f.ports);
    f.run();
    f.cancel();
    expect(f.s.player.inPlay.map((p) => p.id)).toContain(p.id);
    expect(f.s.removed).toHaveLength(0);
  });
  it("Seduced blocks every Attack-trait event and basic attack, including Stun replacement", () => {
    const f = fixture(),
      p = piece("25032", { attachedTo: "hero:p1" });
    f.s.attachments.push(p);
    f.s.player.stunned = true;
    expect(valkyrieCannotBasicAttack(f.s, f.ports)).toBe(true);
    expect(
      valkyriePlayRestriction(f.s, f.owned("25012", "hand"), f.ports),
    ).toMatch(/Seduced/);
    expect(
      valkyriePlayRestriction(f.s, f.owned("25018", "hand"), f.ports),
    ).toMatch(/Seduced/);
    expect(
      valkyriePlayRestriction(f.s, f.owned("25010", "hand"), f.ports),
    ).toBeNull();
  });
  it("Seduced applies only to its actual target seat and loses restrictions while blank", () => {
    const f = fixture();
    f.second();
    const p = piece("25032", { attachedTo: "hero:p2" });
    f.s.attachments.push(p);
    expect(valkyrieCannotBasicAttack(f.s, f.ports)).toBe(false);
    expect(valkyrieCannotBasicAttack(seatView(f.s, "p2"), f.ports)).toBe(true);
    seatView(f.s, "p2").flags[`blank:${p.id}`] = true;
    expect(valkyrieCannotBasicAttack(seatView(f.s, "p2"), f.ports)).toBe(false);
  });
  it("Powerful Enchantments blocks discarding friendly attachments, not enemy attachments or removal", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const p = piece("25032", { attachedTo: "hero:p1" }),
      scheme = piece("25030");
    f.s.attachments.push(p);
    f.s.sideSchemes.push(scheme);
    expect(valkyrieCanDiscardAttachment(f.s, p, f.ports)).toBe(false);
    expect(valkyrieAttachmentActions(f.s, p, f.ports)).toEqual([]);
    expect(
      valkyrieCanDiscardAttachment(
        f.s,
        piece("25031", { attachedTo: f.s.villain.id }),
        f.ports,
      ),
    ).toBe(true);
    f.s.flags[`blank:${scheme.id}`] = true;
    expect(valkyrieAttachmentActions(f.s, p, f.ports)).toHaveLength(1);
  });
  it("a new discard prohibition after payment preserves Seduced without refunding the cost", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const attachment = piece("25032", { attachedTo: "hero:p1" });
    f.s.attachments.push(attachment);
    const energy = f.owned("25025", "hand"),
      mental = f.owned("25026", "hand");
    f.step(valkyrieAttachmentActions(f.s, attachment, f.ports)[0].effects);
    f.s.sideSchemes.push(piece("25030"));
    f.pay([energy.id, mental.id]);
    expect(f.s.attachments.map((p) => p.id)).toContain(attachment.id);
    expect(f.s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([energy.id, mental.id]),
    );
    f.conserve();
  });
  it("Seduced's paid action discards the same attachment only after spending resources", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const p = piece("25032", { attachedTo: "hero:p1" }),
      r = f.owned("25025", "hand"),
      mental = f.owned("25026", "hand");
    f.s.attachments.push(p);
    f.step(valkyrieAttachmentActions(f.s, p, f.ports)[0].effects);
    expect(f.s.attachments.map((p) => p.id)).toContain(p.id);
    f.pay([r.id, mental.id]);
    expect(f.s.attachments).toHaveLength(0);
    expect(f.s.encounter.discard.map((p) => p.id)).toContain(p.id);
  });
  it("Enchantress searches set-aside Seduced and attaches its actual ID to the revealing seat", () => {
    const f = fixture();
    valkyrieSetup(f.s);
    valkyrieInitializeNemesis(f.s, f.ports);
    const p = f.s.player.setAside!.find((p) => p.code === "25032")!;
    f.second();
    activateSeat(f.s, "p2");
    f.step(valkyrieEncounterReveal(f.s, piece("25029"))!);
    expect(f.s.attachments).toMatchObject([
      { id: p.id, attachedTo: "hero:p2" },
    ]);
    expect(seatView(f.s, "p1").player.setAside!.map((p) => p.id)).not.toContain(
      p.id,
    );
    expect(f.ports.shuffleEncounter).toHaveBeenCalledOnce();
  });
  it("Shadow's subsequent shuffle skips the Seduced already attached by Enchantress", () => {
    const f = fixture();
    valkyrieSetup(f.s);
    valkyrieInitializeNemesis(f.s, f.ports);
    const effects = valkyrieShadowOfPast(f.s)!;
    const shuffle = effects.find((e) => e.type === "valkyrie:shuffle-nemesis")!;
    f.step(V("enchantress"));
    const id = f.s.attachments[0].id;
    f.step(shuffle);
    expect(f.s.encounter.deck.some((p) => p.id === id)).toBe(false);
    expect(f.s.encounter.deck.map((p) => p.code).sort()).toEqual([
      "25031",
      "25032",
    ]);
  });
  it("Beguiled selects highest-cost allies across all seats and retains the exact physical ally", () => {
    const f = fixture();
    const low = f.owned("25003"),
      high = f.owned("25013"),
      other = f.second();
    f.s.player.inPlay.splice(
      f.s.player.inPlay.findIndex((p) => p.id === high.id),
      1,
    );
    other.inPlay.push(high);
    high.damage = 1;
    high.exhausted = true;
    const a = piece("25031");
    f.s.attachments.push(a);
    f.step(valkyrieEncounterReveal(f.s, a)!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([high.id]);
    f.choose(high.id);
    expect(f.s.minions[0]).toMatchObject({
      id: high.id,
      ownerId: "p1",
      engagedWith: "p2",
      damage: 1,
      exhausted: true,
    });
    expect(f.s.player.inPlay.map((p) => p.id)).toContain(low.id);
    expect(valkyrieEnemyStats(f.s, f.s.minions[0])).toEqual({
      schemeOverride: 1,
    });
    expect(valkyrieEnemyTraits(f.s, f.s.minions[0])).toEqual(["Enthralled"]);
    expect(valkyrieEnemyTextBlank(f.s, f.s.minions[0])).toBe(true);
    f.conserve();
  });
  it("Beguiled's no-ally fallback uses actual Surge, not a direct encounter shortcut", () => {
    const f = fixture(),
      a = piece("25031");
    f.s.attachments.push(a);
    f.step(valkyrieEncounterReveal(f.s, a)!);
    expect(f.native).toEqual([{ type: "surge", sourceCode: "25031" }]);
  });
  it("removing Beguiled restores the same surviving ally to its former controller", () => {
    const f = fixture(),
      high = f.owned("25013"),
      a = piece("25031");
    f.s.attachments.push(a);
    f.step(valkyrieEncounterReveal(f.s, a)!);
    f.choose(high.id);
    const actual = f.s.attachments.splice(0, 1)[0];
    f.step(valkyrieAttachmentDiscarded(f.s, actual));
    expect(f.s.minions).toHaveLength(0);
    expect(f.s.player.inPlay.find((p) => p.id === high.id)!.ownerId).toBe("p1");
    f.conserve();
  });
  it("a changed minion engagement never transfers the restored ally to another controller", () => {
    const f = fixture(),
      high = f.owned("25013"),
      a = piece("25031");
    f.second();
    f.s.attachments.push(a);
    f.step(valkyrieEncounterReveal(f.s, a)!);
    f.choose(high.id);
    f.s.minions[0].engagedWith = "p2";
    const actual = f.s.attachments.splice(0, 1)[0];
    activateSeat(f.s, "p2");
    f.step(valkyrieAttachmentDiscarded(f.s, actual));
    expect(
      seatView(f.s, "p1").player.inPlay.some((p) => p.id === high.id),
    ).toBe(true);
    expect(
      seatView(f.s, "p2").player.inPlay.some((p) => p.id === high.id),
    ).toBe(false);
    expect(
      seatView(f.s, "p1").flags[`valkyrieBeguiledController:${high.id}`],
    ).toBeUndefined();
    f.conserve();
  });
  it("defeated enthralled ally is not recreated when its Beguiled is cleaned up", () => {
    const f = fixture(),
      high = f.owned("25013"),
      a = piece("25031");
    f.s.attachments.push(a);
    f.step(valkyrieEncounterReveal(f.s, a)!);
    f.choose(high.id);
    const defeated = f.s.minions.splice(0, 1)[0];
    f.s.player.discard.push(defeated);
    const actual = f.s.attachments.splice(0, 1)[0];
    f.step(valkyrieAttachmentDiscarded(f.s, actual));
    expect(f.s.player.inPlay.some((p) => p.id === high.id)).toBe(false);
    expect(f.s.player.discard.map((p) => p.id)).toContain(high.id);
    f.conserve();
  });
  it("all nemesis boost faces have no invented boost ability", () => {
    const f = fixture();
    for (const code of ["25028", "25029", "25030", "25031", "25032"])
      expect(valkyrieBoost(f.s, piece(code))).toEqual([]);
    expect(valkyrieBoost(f.s, piece("25013"))).toBeNull();
    expect(resolveValkyrieEffect(f.s, { type: "unknown" }, f.ports)).toBe(
      false,
    );
  });
});
