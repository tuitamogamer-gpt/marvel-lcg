import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  QUICKSILVER_SCRIPT_CODES,
  quicksilverAbility,
  quicksilverAbilityOptions,
  quicksilverAttachmentActions,
  quicksilverAttackReduction,
  quicksilverBasicUsed,
  quicksilverBeforeAllyBasic,
  quicksilverBoost,
  quicksilverCanReady,
  quicksilverCyclonePaymentOptions,
  quicksilverEncounterReveal,
  quicksilverEvent,
  quicksilverPhaseEnded,
  quicksilverPlayRestriction,
  quicksilverReadied,
  quicksilverResourceSources,
  quicksilverRoundEnded,
  quicksilverStats,
  quicksilverTurnEnded,
  resolveQuicksilverEffect,
  type QuicksilverPorts,
} from "../src/game/quicksilver.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const Q = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `qsv:${type}`,
  ...args,
});
let nextId = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `qsv${++nextId}`,
  code,
  ownerId: "p1",
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ...patch,
});
function fixture() {
  const player: GameState["player"] = {
    form: "hero",
    hp: 9,
    exhausted: false,
    flipped: false,
    tough: false,
    stunned: false,
    confused: false,
    hand: [],
    deck: [],
    discard: [],
    inPlay: [],
  };
  const s: GameState = {
    version: 1,
    seed: 14,
    nextId: 1,
    heroId: "qsv",
    aspect: "protection",
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
    player,
    villain: { ...piece("01094"), hp: 14, maxHp: 14, stage: 1 },
    scheme: { code: "01097", threat: 5, index: 0 },
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
  s.players = [
    {
      id: "p1",
      heroId: "qsv",
      aspect: "protection",
      player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  const ports: QuicksilverPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    select: (state, title, text, pieces, min, max, action) => {
      state.prompt = {
        kind: "select",
        title,
        text,
        min,
        max,
        selectAction: action,
        options: pieces.map((p) => ({
          id: p.id,
          label: cards.get(p.code)?.name || p.code,
          image: p.code,
          effects: [],
        })),
      };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: vi.fn((state, _counts, form) => {
      state.player.form = form === "alter" ? "alter" : "hero";
    }),
    canReadyIdentity: (state, id) => !seatView(state, id).flags.otherReadyLock,
    canPay: vi.fn(() => true),
    canGiveStatus: (state, id, status) => {
      const p =
        id === state.villain.id
          ? state.villain
          : state.minions.find((p) => p.id === id);
      return !!p && !p[status] && p.code !== "04030";
    },
    enemyTargets: (state, attack) => [
      ...(!attack || !state.minions.some((p) => p.code === "01101")
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        code: p.code,
        label: cards.get(p.code)?.name || p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(!thwart && state.scheme.threat > 0
        ? [{ id: "main", label: "Main scheme", code: state.scheme.code }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          code: p.code,
          label: cards.get(p.code)?.name || p.code,
        })),
    ],
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    discardHand: (state, id) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i < 0) throw Error("No hand card");
      state.player.discard.push(state.player.hand.splice(i, 1)[0]);
    },
    discardPiece: (state, id) => {
      const zone = [state.player.inPlay, state.attachments, state.minions].find(
        (zone) => zone.some((p) => p.id === id),
      );
      if (!zone) return;
      const p = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      )[0];
      (cards.get(p.code)?.faction_code === "encounter"
        ? state.encounter.discard
        : state.player.discard
      ).push(p);
    },
    revealHidden: vi.fn(),
    recycleEncounter: vi.fn(),
    attackProgram: vi.fn(),
    log: vi.fn(),
    shufflePlayerDeck: vi.fn(),
    discardEncounterTop: vi.fn((state) => {
      const p = state.encounter.deck.shift();
      if (p) state.encounter.discard.push(p);
      const emptied = !state.encounter.deck.length;
      if (emptied) {
        state.encounter.deck.push(...state.encounter.discard);
        state.encounter.discard = [];
        state.encounter.acceleration++;
      }
      return { piece: p, emptied };
    }),
  };
  const resolve = (e: Effect) => resolveQuicksilverEffect(s, e, ports);
  return { s, ports, resolve };
}

describe("Quicksilver identity and signature runtime", () => {
  it("registers all identity, signature, obligation and nemesis faces with immutable definitions", () => {
    expect(QUICKSILVER_SCRIPT_CODES).toHaveLength(17);
    expect(new Set(QUICKSILVER_SCRIPT_CODES).size).toBe(17);
    expect(QUICKSILVER_SCRIPT_CODES.every((code) => cards.has(code))).toBe(
      true,
    );
    expect(cards.get("14006")?.cost).toBe(-1);
    expect(cards.get("14001a")?.text).toContain("Limit once per phase");
  });
  it("keeps permanent printed upgrade modifiers distinct from the round bonus", () => {
    const { s, resolve } = fixture();
    s.player.inPlay.push(piece("14008"), piece("14010"), piece("14011"));
    expect(quicksilverStats(s)).toEqual({ attack: 1, thwart: 1, defense: 1 });
    resolve(Q("velocity"));
    expect(quicksilverStats(s)).toEqual({ attack: 3, thwart: 3, defense: 3 });
    s.player.form = "alter";
    expect(quicksilverStats(s)).toEqual({ attack: 0, thwart: 0, defense: 0 });
    s.player.form = "hero";
    s.round++;
    expect(quicksilverStats(s)).toEqual({ attack: 1, thwart: 1, defense: 1 });
  });
  it("limits Maximum Velocity by phase while two legal phases stack through the same round", () => {
    const { s, ports, resolve } = fixture();
    resolve(Q("velocity"));
    expect(quicksilverPlayRestriction(s, piece("14005"), ports)).toMatch(
      /max 1 per phase/i,
    );
    expect(() => resolve(Q("velocity"))).toThrow(/max 1 per phase/);
    quicksilverPhaseEnded(s);
    s.phase = "villain";
    resolve(Q("velocity"));
    expect(quicksilverStats(s).defense).toBe(4);
    quicksilverRoundEnded(s);
    expect(quicksilverStats(s).defense).toBe(0);
  });
  it("opens Super Speed after each genuine exhausted basic power and spends its phase limit only when accepted", () => {
    const { s, resolve } = fixture();
    s.player.exhausted = true;
    for (const power of ["attack", "thwart", "defense"] as const)
      expect(quicksilverBasicUsed(s, power)[0].type).toBe("qsv:speed-window");
    resolve(quicksilverBasicUsed(s, "attack")[0]);
    expect(s.queue[0]).toMatchObject({
      type: "optional",
      title: "Super Speed",
    });
    expect(s.flags.qsvSuperSpeedPhase).toBeUndefined();
    resolve(s.queue.shift()!.effects[0]);
    expect(s.flags.qsvSuperSpeedPhase).toBe("1:player");
    expect(s.queue[0]).toMatchObject({ type: "ready", target: "hero" });
    expect(quicksilverBasicUsed(s, "thwart")).toEqual([]);
    quicksilverPhaseEnded(s);
    s.phase = "villain";
    expect(quicksilverBasicUsed(s, "defense")).toHaveLength(1);
  });
  it("revalidates the phase, face and ready locks before using Super Speed", () => {
    const { s, resolve } = fixture();
    s.player.exhausted = true;
    const response = Q("speed-ready", { phase: "1:player" });
    s.phase = "villain";
    expect(() => resolve(response)).toThrow(/unavailable/);
    s.phase = "player";
    s.flags.qsvCannotReadyUntilTurnEnd = 2;
    expect(() => resolve(response)).toThrow(/unavailable/);
    delete s.flags.qsvCannotReadyUntilTurnEnd;
    s.flags.otherReadyLock = true;
    expect(() => resolve(response)).toThrow(/unavailable/);
    s.flags.otherReadyLock = false;
    s.player.form = "alter";
    expect(() => resolve(response)).toThrow(/unavailable/);
  });
  it("requires two distinct actual hand cards for Pietro and commits the cost before drawing", () => {
    const { s, ports, resolve } = fixture();
    s.player.form = "alter";
    const a = piece("14019"),
      b = piece("14003");
    s.player.hand.push(a, b);
    expect(quicksilverAbility(s, "identity", "siblings", ports)).toEqual([
      Q("siblings"),
    ]);
    resolve(Q("siblings"));
    expect(s.prompt).toMatchObject({ kind: "select", min: 2, max: 2 });
    expect(() => resolve(Q("siblings-discard", { ids: [a.id, a.id] }))).toThrow(
      /distinct/,
    );
    expect(() =>
      resolve(Q("siblings-discard", { ids: [a.id, "fabricated"] })),
    ).toThrow(/distinct/);
    resolve(Q("siblings-discard", { ids: [b.id, a.id] }));
    expect(s.player.hand).toEqual([]);
    expect(s.player.discard).toEqual([b, a]);
    expect(s.queue[0]).toMatchObject({ type: "draw", amount: 2 });
    expect(quicksilverAbilityOptions(s, "hero", ports)).toEqual([]);
  });
  it("draws three with Wanda's ally subtitle under another player's control", () => {
    const { s, resolve } = fixture();
    s.player.form = "alter";
    const a = piece("14003"),
      b = piece("14004");
    s.player.hand.push(a, b);
    s.players.push({
      ...s.players[0],
      id: "p2",
      heroId: "spider_man",
      player: { ...s.player, inPlay: [piece("14002", { ownerId: "p2" })] },
      flags: {},
    });
    resolve(Q("siblings-discard", { ids: [a.id, b.id] }));
    expect(s.queue[0]).toMatchObject({ type: "draw", amount: 3 });
  });
  it("counts Wanda's identity only while its matching alter-ego title is faceup, never on an eliminated seat", () => {
    for (const form of ["hero", "alter"] as const) {
      const { s, resolve } = fixture();
      s.player.form = "alter";
      const a = piece("14003"),
        b = piece("14004");
      s.player.hand.push(a, b);
      s.players.push({
        ...s.players[0],
        id: "p2",
        heroId: "scw",
        player: { ...s.player, form, inPlay: [] },
        flags: {},
      });
      resolve(Q("siblings-discard", { ids: [a.id, b.id] }));
      expect(s.queue[0]).toMatchObject({
        type: "draw",
        amount: form === "alter" ? 3 : 2,
      });
    }
    const { s, resolve } = fixture();
    s.player.form = "alter";
    const a = piece("14003"),
      b = piece("14004");
    s.player.hand.push(a, b);
    s.players.push({
      ...s.players[0],
      id: "p2",
      heroId: "scw",
      eliminated: true,
      player: { ...s.player, inPlay: [] },
      flags: {},
    });
    resolve(Q("siblings-discard", { ids: [a.id, b.id] }));
    expect(s.queue[0]).toMatchObject({ type: "draw", amount: 2 });
  });
  it("allows Friction's physical Resource in either face, and Hero Response only with a hero controller", () => {
    const { s, resolve } = fixture();
    const friction = piece("14009");
    s.player.inPlay.push(friction);
    for (const form of ["hero", "alter"] as const) {
      s.player.form = form;
      expect(quicksilverResourceSources(s)[0]).toMatchObject({
        id: friction.id,
        resources: ["physical"],
        kind: "ability",
      });
    }
    friction.exhausted = true;
    expect(quicksilverResourceSources(s)).toEqual([]);
    expect(quicksilverReadied(s)).toEqual([]);
    s.player.form = "hero";
    expect(quicksilverReadied(s)).toEqual([
      Q("friction-window", { id: friction.id, actorId: "p1" }),
    ]);
    resolve(quicksilverReadied(s)[0]);
    expect(s.queue[0]).toMatchObject({
      title: "Friction Resistance",
      type: "optional",
    });
    resolve(s.queue.shift()!.effects[0]);
    expect(s.queue[0]).toMatchObject({ type: "ready", target: friction.id });
  });
  it("does not offer ready Friction Resistance and suppresses a text-blanked response", () => {
    const { s, resolve } = fixture();
    const friction = piece("14009");
    s.player.inPlay.push(friction);
    expect(quicksilverReadied(s)).toEqual([]);
    friction.exhausted = true;
    s.flags[`blank:${friction.id}`] = true;
    resolve(Q("friction-window", { id: friction.id }));
    expect(s.queue).toEqual([]);
  });
  it("Always Be Running readies the actual Quicksilver seat rather than the acting hero", () => {
    const { s, resolve, ports } = fixture();
    s.heroId = s.players[0].heroId = "spider_man";
    s.players.push({
      ...s.players[0],
      id: "p2",
      heroId: "qsv",
      player: { ...s.player, exhausted: true, inPlay: [] },
      flags: {},
    });
    expect(quicksilverPlayRestriction(s, piece("14003"), ports)).toBeNull();
    resolve(Q("running"));
    expect(s.queue[0]).toEqual({
      type: "ready",
      target: "hero",
      actorId: "p2",
    });
    s.players[1].player.form = "alter";
    expect(quicksilverPlayRestriction(s, piece("14003"), ports)).toMatch(
      /cannot be readied/,
    );
    s.players[1].player.form = "hero";
    s.players[1].flags.qsvCannotReadyUntilTurnEnd = 2;
    expect(quicksilverPlayRestriction(s, piece("14003"), ports)).toMatch(
      /cannot be readied/,
    );
  });
  it("Double Time deals nonattack damage and repeats sequentially without consuming Stunned", () => {
    const { s, resolve } = fixture();
    s.player.stunned = true;
    s.minions.push(piece("01101"));
    resolve(Q("double", { remaining: 2 }));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["damage", "thwart"]);
    resolve(Q("double-target", { kind: "damage", remaining: 2 }));
    expect(s.prompt?.options.map((o) => o.id)).toContain(s.villain.id);
    resolve(
      Q("double-resolve", {
        kind: "damage",
        target: s.villain.id,
        remaining: 2,
      }),
    );
    expect(s.queue).toEqual([
      {
        type: "damage",
        target: s.villain.id,
        amount: 2,
        source: "hero",
        action: false,
        ignoreCrisis: false,
      },
      Q("double", { remaining: 1 }),
    ]);
    expect(s.player.stunned).toBe(true);
    expect(s.queue[0].attack).toBeUndefined();
  });
  it("Double Time removes threat without thwarting but still respects Crisis", () => {
    const { s, ports, resolve } = fixture();
    s.player.confused = true;
    const crisis = piece("14025", { counters: 2 });
    s.sideSchemes.push(crisis);
    resolve(Q("double-target", { kind: "thwart", remaining: 2 }));
    expect(s.queue[0]).toMatchObject({
      type: "qsv:double-resolve",
      target: crisis.id,
    });
    expect(() =>
      resolve(
        Q("double-resolve", { kind: "thwart", target: "main", remaining: 2 }),
      ),
    ).toThrow(/no longer eligible/);
    resolve(
      Q("double-resolve", { kind: "thwart", target: crisis.id, remaining: 2 }),
    );
    expect(s.queue[0]).toMatchObject({
      type: "thwart",
      action: false,
      ignoreCrisis: false,
    });
    expect(s.player.confused).toBe(true);
    expect(quicksilverPlayRestriction(s, piece("14004"), ports)).toBeNull();
  });
  it("chooses Cyclone X before payment and carries the value independently of any overpayment", () => {
    const { s, ports } = fixture();
    s.minions.push(piece("01101"), piece("04030"));
    const event = piece("14006");
    const choices = quicksilverCyclonePaymentOptions(s, event, ports);
    expect(choices.map((o) => o.id)).toEqual(["1", "2"]);
    expect(choices[1].effects[0]).toMatchObject({
      type: "payRequest",
      cost: 2,
      piece: event,
      cancelable: true,
      after: [{ type: "play", cycloneX: 2 }],
    });
    expect(quicksilverEvent(s, event, 2)).toEqual([
      Q("cyclone", { amount: 2 }),
    ]);
    expect(() => quicksilverEvent(s, event, 0)).toThrow(/positive X/);
  });
  it("stuns distinct actual enemies despite Guard and Stunned, excluding enemies that cannot receive status", () => {
    const { s, resolve } = fixture();
    s.player.stunned = true;
    const guard = piece("01101"),
      stalwart = piece("04030");
    s.minions.push(guard, stalwart);
    resolve(Q("cyclone", { amount: 2 }));
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      s.villain.id,
      guard.id,
    ]);
    expect(() =>
      resolve(Q("cyclone-stun", { amount: 2, ids: [guard.id, guard.id] })),
    ).toThrow(/distinct/);
    expect(() =>
      resolve(Q("cyclone-stun", { amount: 2, ids: [guard.id, stalwart.id] })),
    ).toThrow(/distinct/);
    resolve(Q("cyclone-stun", { amount: 2, ids: [s.villain.id, guard.id] }));
    expect(s.queue).toHaveLength(2);
    expect(
      s.queue.every((e) => e.type === "status" && e.status === "stunned"),
    ).toBe(true);
    expect(s.player.stunned).toBe(true);
  });
  it("Serval commits exhaustion then selects original signature instances, excluding generic and nemesis cards", () => {
    const { s, ports, resolve } = fixture();
    s.player.form = "alter";
    const serval = piece("14007"),
      a = piece("14003"),
      b = piece("14003"),
      basic = piece("14019"),
      nemesis = piece("14028");
    s.player.inPlay.push(serval);
    s.player.discard.push(a, b, basic, nemesis);
    expect(quicksilverAbility(s, serval.id, undefined, ports)).toEqual([
      Q("serval", { id: serval.id }),
    ]);
    resolve(Q("serval", { id: serval.id }));
    expect(serval.exhausted).toBe(true);
    expect(s.prompt).toMatchObject({ min: 2, max: 2 });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    expect(() =>
      resolve(
        Q("serval-shuffle", {
          id: serval.id,
          amount: 2,
          ids: [a.id, basic.id],
        }),
      ),
    ).toThrow(/actual/);
    resolve(
      Q("serval-shuffle", { id: serval.id, amount: 2, ids: [b.id, a.id] }),
    );
    expect(s.player.deck).toEqual([b, a]);
    expect(s.player.discard).toEqual([basic, nemesis]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("Serval resolves as much as possible with one matching card, but cannot initiate with zero", () => {
    const { s, ports, resolve } = fixture();
    s.player.form = "alter";
    const serval = piece("14007"),
      a = piece("14004");
    s.player.inPlay.push(serval);
    expect(quicksilverAbilityOptions(s, serval.id, ports)).toEqual([]);
    s.player.discard.push(a);
    resolve(Q("serval", { id: serval.id }));
    expect(s.prompt).toMatchObject({ min: 1, max: 1 });
    resolve(Q("serval-shuffle", { id: serval.id, amount: 1, ids: [a.id] }));
    expect(s.player.deck[0]).toBe(a);
  });
  it("Scarlet Witch optionally modifies exactly one basic ATK or THW using printed dots", () => {
    const { s, ports, resolve } = fixture();
    const witch = piece("14002"),
      encounter = piece("01118");
    s.player.inPlay.push(witch);
    s.encounter.deck.push(encounter, piece("01123"));
    const after = [
      {
        type: "allyAction",
        id: witch.id,
        kind: "attack",
        amount: 1,
        target: s.villain.id,
        qsvHandled: true,
      },
    ];
    const interrupt = quicksilverBeforeAllyBasic(
      s,
      witch,
      "attack",
      after,
      ports,
    )!;
    resolve(interrupt[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["yes", "skip"]);
    resolve(s.prompt!.options[0].effects[0]);
    expect(s.queue[0]).toEqual({
      ...after[0],
      amount: 1 + cards.get(encounter.code)!.boost!,
    });
    expect(s.encounter.discard[0]).toBe(encounter);
    expect(s.encounter.deck[0].code).toBe("01123");
    expect(ports.discardEncounterTop).toHaveBeenCalledOnce();
  });
  it("Scarlet Witch discards a star card without resolving its boost and recycles a depleted encounter deck once", () => {
    const { s, ports, resolve } = fixture();
    const witch = piece("14002"),
      earthquake = piece("14028");
    s.player.inPlay.push(witch);
    s.encounter.deck.push(earthquake);
    const after = [
      {
        type: "allyAction",
        id: witch.id,
        kind: "thwart",
        amount: 1,
        target: "main",
      },
    ];
    resolve(Q("scarlet", { id: witch.id, power: "thwart", after }));
    expect(s.queue).toEqual(after);
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck).toEqual([earthquake]);
    expect(s.player.exhausted).toBe(false);
    expect(ports.discardEncounterTop).toHaveBeenCalledOnce();
  });
  it("Scarlet Witch's canceled basic power never opens its interrupt", () => {
    const { s, ports } = fixture();
    const witch = piece("14002", { stunned: true, confused: true });
    s.player.inPlay.push(witch);
    expect(
      quicksilverBeforeAllyBasic(s, witch, "attack", [], ports),
    ).toBeNull();
    expect(
      quicksilverBeforeAllyBasic(s, witch, "thwart", [], ports),
    ).toBeNull();
    witch.stunned = witch.confused = false;
    s.flags[`blank:${witch.id}`] = true;
    expect(
      quicksilverBeforeAllyBasic(s, witch, "attack", [], ports),
    ).toBeNull();
  });
});

describe("Quicksilver obligation and nemesis runtime", () => {
  it("routes Need for Speed to the actual Quicksilver owner", () => {
    const { s } = fixture();
    s.heroId = s.players[0].heroId = "spider_man";
    s.players.push({
      ...s.players[0],
      id: "p2",
      heroId: "qsv",
      player: { ...s.player },
      flags: {},
    });
    const obligation = piece("14024");
    expect(quicksilverEncounterReveal(s, obligation)).toEqual([
      Q("obligation", { piece: obligation, actorId: "p2" }),
    ]);
  });
  it("removes the same physical obligation only after paying Pietro's exhaustion cost", () => {
    const { s, resolve } = fixture();
    const obligation = piece("14024");
    s.player.form = "alter";
    s.resolving.push(obligation);
    resolve(Q("obligation-choice", { piece: obligation }));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["remove", "lock"]);
    resolve(Q("obligation-remove", { piece: obligation }));
    expect(s.player.exhausted).toBe(true);
    expect(s.resolving).toEqual([]);
    expect(s.removed[0].id).toBe(obligation.id);
    expect(() =>
      resolve(Q("obligation-remove", { piece: obligation })),
    ).toThrow(/exhaustion cost/);
  });
  it("keeps the ready lock through new round and another player's turn, expiring only at the owner's next turn end", () => {
    const { s, resolve } = fixture();
    s.phase = "villain";
    resolve(Q("obligation-lock"));
    expect(s.flags.qsvCannotReadyUntilTurnEnd).toBe(2);
    expect(quicksilverCanReady(s)).toBe(false);
    s.round = 2;
    quicksilverPhaseEnded(s);
    quicksilverRoundEnded(s);
    s.players.push({
      ...s.players[0],
      id: "p2",
      heroId: "spider_man",
      player: { ...s.player },
      flags: {},
    });
    quicksilverTurnEnded(s, "p2");
    expect(quicksilverCanReady(s)).toBe(false);
    const reloaded = JSON.parse(JSON.stringify(s)) as GameState;
    quicksilverTurnEnded(reloaded, "p1");
    expect(quicksilverCanReady(reloaded)).toBe(true);
  });
  it("recognizes an upcoming same-round turn as the next turn when another player is acting", () => {
    const { s, resolve } = fixture();
    s.turnPlayerId = "p2";
    resolve(Q("obligation-lock"));
    expect(s.flags.qsvCannotReadyUntilTurnEnd).toBe(1);
    quicksilverTurnEnded(s, "p1");
    expect(quicksilverCanReady(s)).toBe(true);
  });
  it("allows the lasting lock branch with an already exhausted identity but rejects removal", () => {
    const { s, resolve } = fixture();
    s.player.form = "alter";
    s.player.exhausted = true;
    resolve(Q("obligation-choice", { piece: piece("14024") }));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["lock"]);
    resolve(Q("obligation-lock"));
    expect(quicksilverCanReady(s)).toBe(false);
  });
  it("leaves Incite to the shared engine and gives each player their own Avalanche choice", () => {
    const { s, resolve } = fixture();
    s.players.push({
      ...s.players[0],
      id: "p2",
      heroId: "spider_man",
      player: { ...s.player },
      flags: {},
    });
    expect(quicksilverEncounterReveal(s, piece("14025"))).toEqual([]);
    const avalanche = piece("14026");
    expect(quicksilverEncounterReveal(s, avalanche)).toEqual([
      Q("avalanche", { actorId: "p1", enemyId: avalanche.id }),
      Q("avalanche", { actorId: "p2", enemyId: avalanche.id }),
    ]);
    resolve(Q("avalanche", { enemyId: avalanche.id }));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["damage", "exhaust"]);
    expect(s.prompt?.options[0].effects).toEqual([
      {
        type: "indirect",
        amount: 2,
        source: avalanche.id,
        sourceTitle: "Avalanche",
      },
    ]);
    s.player.exhausted = true;
    resolve(Q("avalanche"));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["damage"]);
  });
  it("attaches Vibration Resistance to Avalanche or otherwise the villain and pays removal with exhaustion", () => {
    const { s, ports, resolve } = fixture();
    const attachment = piece("14027"),
      avalanche = piece("14026");
    s.attachments.push(attachment);
    s.minions.push(avalanche);
    resolve(Q("vibration", { id: attachment.id }));
    expect(s.queue.shift()).toEqual(
      Q("vibration-attach", { id: attachment.id, target: avalanche.id }),
    );
    expect(() =>
      resolve(
        Q("vibration-attach", { id: attachment.id, target: s.villain.id }),
      ),
    ).toThrow(/eligible/);
    resolve(Q("vibration-attach", { id: attachment.id, target: avalanche.id }));
    expect(quicksilverAttackReduction(s, avalanche.id)).toBe(1);
    expect(quicksilverAttackReduction(s, s.villain.id)).toBe(0);
    expect(quicksilverAttachmentActions(s, attachment, ports)[0].id).toBe(
      "remove",
    );
    resolve(Q("vibration-remove", { id: attachment.id }));
    expect(s.player.exhausted).toBe(true);
    expect(s.encounter.discard).toContain(attachment);
    expect(s.attachments).toEqual([]);
  });
  it("Vibration removal is a hero action, requiring a ready hero and active text", () => {
    const { s, ports, resolve } = fixture();
    const attachment = piece("14027");
    s.attachments.push(attachment);
    for (const patch of [
      { form: "alter" as const, exhausted: false },
      { form: "hero" as const, exhausted: true },
    ]) {
      Object.assign(s.player, patch);
      expect(quicksilverAttachmentActions(s, attachment, ports)).toEqual([]);
      expect(() =>
        resolve(Q("vibration-remove", { id: attachment.id })),
      ).toThrow(/exhaustion cost/);
    }
  });
  it("Earthquake discards as many as possible and exhausts without cloning or randomly picking cards", () => {
    const { s, resolve } = fixture();
    const hand = piece("14003");
    s.player.hand.push(hand);
    resolve(Q("earthquake"));
    expect(s.player.exhausted).toBe(true);
    expect(s.prompt).toMatchObject({ min: 1, max: 1 });
    expect(() =>
      resolve(Q("earthquake-discard", { amount: 1, ids: ["fake"] })),
    ).toThrow(/actual/);
    resolve(Q("earthquake-discard", { amount: 1, ids: [hand.id] }));
    expect(s.player.discard[0]).toBe(hand);
    expect(quicksilverEncounterReveal(s, piece("14028"))).toEqual([
      Q("earthquake"),
    ]);
  });
  it("Earthquake's boost requires two physical icons in one committed payment", () => {
    const { s, resolve } = fixture();
    expect(quicksilverBoost(s, piece("14028"))).toEqual([
      Q("earthquake-boost"),
    ]);
    resolve(Q("earthquake-boost"));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["pay", "exhaust"]);
    expect(s.prompt?.options[0].effects[0]).toMatchObject({
      type: "payRequest",
      cost: 2,
      requirements: ["physical", "physical"],
      cancelable: false,
    });
  });
  it("Earthquake boost disallows ineffective exhaustion and avoids a blocking prompt when neither option can resolve", () => {
    const { s, ports, resolve } = fixture();
    s.player.exhausted = true;
    resolve(Q("earthquake-boost"));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["pay"]);
    s.prompt = null;
    vi.mocked(ports.canPay).mockReturnValue(false);
    resolve(Q("earthquake-boost"));
    expect(s.prompt).toBeNull();
  });
  it("declines other modules' effects and fails loudly for malformed Quicksilver effects", () => {
    const { resolve } = fixture();
    expect(resolve({ type: "draw" })).toBe(false);
    expect(() => resolve(Q("unknown"))).toThrow(/Unknown Quicksilver/);
  });
});
