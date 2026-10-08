import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { activateSeat, seatView, syncSeat } from "../src/game/team.js";
import { consumeStatus } from "../src/game/keywords.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  DRAX_SCRIPT_CODES,
  DRAX_ENCOUNTER_BOOSTS,
  draxAbility,
  draxAbilityOptions,
  draxAddVengeanceCounters,
  draxAfterBasicAttack,
  draxAfterVillainAttack,
  draxBasicAttackOptions,
  draxBoost,
  draxCardCostReduction,
  draxChangedForm,
  draxDamageDealt,
  draxDamageOptions,
  draxDefeatOptions,
  draxEncounterReveal,
  draxEnemyStats,
  draxEvent,
  draxPlayRestriction,
  draxStats,
  draxVengeanceCounters,
  draxVillainAttackResponseOptions,
  resolveDraxEffect,
  type DraxPorts,
  type DraxVillainAttackSnapshot,
} from "../src/game/drax.js";

const cards = new Map((catalog as unknown as Card[]).map((p) => [p.code, p]));
const flags = (s: GameState): Record<string, any> => s.flags;
const D = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `drax:${type}`,
  ...args,
});
let id = 0;
const piece = (code: string, args: Partial<Piece> = {}): Piece => ({
  id: `drax${++id}`,
  code,
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ownerId: "p1",
  ...args,
});
const player = (): GameState["player"] => ({
  form: "hero",
  hp: 14,
  exhausted: false,
  flipped: false,
  tough: false,
  stunned: false,
  confused: false,
  hand: [],
  deck: [],
  discard: [],
  inPlay: [],
});
function fixture() {
  let s: GameState = {
    version: 1,
    seed: 19,
    nextId: 1,
    heroId: "drax",
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
    player: player(),
    villain: { ...piece("01094"), hp: 40, maxHp: 40, stage: 1 },
    scheme: { code: "01097", threat: 9, index: 0 },
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
      heroId: "drax",
      aspect: "protection",
      player: s.player,
      flags: flags(s),
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  const trace: Effect[] = [];
  const find = (state: GameState, target: string) =>
    target === "hero"
      ? state.player
      : target.startsWith("hero:")
        ? seatView(state, target.slice(5)).player
        : state.player.inPlay.find((p) => p.id === target) ||
          state.minions.find((p) => p.id === target) ||
          (target === state.villain.id ? state.villain : undefined);
  const queue = (state: GameState, ...effects: Effect[]) =>
    state.queue.unshift(...effects);
  const ports: DraxPorts = {
    queue,
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: (state) => !flags(state).formLocked,
    flip: (state, counts, target) => {
      const old = state.player.form;
      state.player.form = target === "alter" ? "alter" : "hero";
      if (counts) state.player.flipped = true;
      queue(state, ...draxChangedForm(state, old));
    },
    canReadyIdentity: (state) => !flags(state).cannotReady,
    canPay: (state, cost) =>
      !flags(state).cannotPay && Number(flags(state).resources ?? 10) >= cost,
    canGiveStatus: () => true,
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some((p) => p.code === "19027" || p.code === "01101")
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(state.scheme.threat > 0 &&
      (!thwart || (!flags(state).patrol && !flags(state).crisis))
        ? [{ id: "main", label: "Main scheme" }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    isTextBlank: (state, p) => (flags(state).blankCards || []).includes(p.id),
    discardHand: (state, target) => {
      const index = state.player.hand.findIndex((p) => p.id === target);
      if (index >= 0)
        state.player.discard.push(...state.player.hand.splice(index, 1));
    },
    discardPiece: (state, target) => {
      for (const zone of [
        state.player.inPlay,
        state.attachments,
        state.minions,
        state.sideSchemes,
      ]) {
        const index = zone.findIndex((p) => p.id === target);
        if (index < 0) continue;
        const [p] = zone.splice(index, 1);
        if (cards.get(p.code)?.faction_code === "encounter")
          state.encounter.discard.push(p);
        else state.player.discard.push(p);
        break;
      }
    },
    revealHidden: () => {},
    recycleEncounter: () => {},
    attackProgram: (state, effects, after) =>
      queue(state, ...effects, ...after),
    log: (state, text) =>
      state.log.push({
        id: state.log.length + 1,
        round: state.round,
        text,
        kind: "info",
      }),
    identityTargets: (state) =>
      state.players
        .filter(
          (seat) =>
            !seat.eliminated &&
            seatView(state, seat).player.hp <
              (seat.heroId === "drax" ? 14 : 10),
        )
        .map((seat) => ({
          id: seat.id === state.activePlayerId ? "hero" : `hero:${seat.id}`,
          label: seat.heroId,
        })),
    heroAttack: (state) =>
      1 +
      draxStats(state, ports).attack +
      Number(flags(state).attackBonus || 0),
    enemyAttack: (state, p) =>
      Number(cards.get(p.code)?.attack || 0) +
      draxEnemyStats(state, p, ports).attack +
      state.attachments.filter(
        (a) => a.code === "19028" && a.attachedTo === p.id,
      ).length *
        2 +
      Number(flags(state).enemyBonus?.[p.id] || 0),
    cardCost: (state, p) =>
      Math.max(
        0,
        Number(cards.get(p.code)?.cost || 0) - draxCardCostReduction(state, p),
      ),
    preventDamage: (state, packet, amount) => {
      flags(state).prevented = Number(flags(state).prevented || 0) + amount;
      if (packet) packet.prevented = Number(packet.prevented || 0) + amount;
    },
    claimDefense: (state, packet) => {
      flags(state).claimedPacket = packet;
    },
    removePlayerCard: (state, target) => {
      const index = state.player.inPlay.findIndex((p) => p.id === target);
      if (index >= 0)
        state.removed.push(...state.player.inPlay.splice(index, 1));
      trace.push({ type: "physicalRemove", id: target, hp: state.player.hp });
    },
    startEnemyAttack: (state, target, modifier, after) =>
      queue(state, { type: "enemyAttack", target, modifier }, ...after),
    enemyAttackCount: (state, target) =>
      Number(flags(state).completedAttacks?.[target] || 0),
  };
  function reload() {
    syncSeat(s);
    s = JSON.parse(JSON.stringify(s));
    syncSeat(s);
  }
  function drain(effects: Effect[] = []) {
    queue(s, ...effects);
    for (let count = 0; s.queue.length && !s.prompt && count < 200; count++) {
      reload();
      const e = s.queue.shift()!;
      trace.push(JSON.parse(JSON.stringify(e)));
      if (e.actorId && e.actorId !== s.activePlayerId)
        activateSeat(s, e.actorId);
      if (resolveDraxEffect(s, e, ports)) continue;
      if (e.type === "optional")
        ports.choose(s, e.title, e.text, [
          { id: "yes", label: "Yes", effects: e.effects },
          { id: "no", label: "No", effects: [] },
        ]);
      else if (e.type === "payRequest") {
        expect(ports.canPay(s, e.cost)).toBe(true);
        flags(s).resources = Number(flags(s).resources ?? 10) - e.cost;
        queue(s, ...e.after);
      } else if (e.type === "resolveHandEvent") {
        const index = s.player.hand.findIndex((p) => p.id === e.id);
        expect(index).toBeGreaterThanOrEqual(0);
        const [p] = s.player.hand.splice(index, 1);
        s.resolving.push(p);
        queue(
          s,
          ...(e.after || []),
          { type: "finishEvent", piece: p },
          ...(e.continuation || []),
        );
      } else if (e.type === "finishEvent") {
        s.resolving = s.resolving.filter((p) => p.id !== e.piece.id);
        s.player.discard.push(e.piece);
      } else if (e.type === "draw") {
        for (let n = 0; n < e.amount; n++) {
          const p = s.player.deck.shift();
          if (p) s.player.hand.push(p);
        }
      } else if (e.type === "heal") {
        const p = find(s, e.target)!;
        if ("hp" in p)
          p.hp = Math.min(
            e.target.startsWith("hero:p2") ? 10 : 14,
            p.hp + e.amount,
          );
      } else if (e.type === "damage") {
        const p = find(s, e.target);
        if (!p) continue;
        if (p.tough) {
          p.tough = false;
          continue;
        }
        if ("hp" in p) p.hp -= e.amount;
        else {
          p.damage += e.amount;
          if (p.damage >= Number(cards.get(p.code)?.health || 100))
            ports.discardPiece(s, p.id);
        }
      } else if (e.type === "thwart") {
        if (e.target === "main")
          s.scheme.threat = Math.max(0, s.scheme.threat - e.amount);
        else {
          const p = s.sideSchemes.find((p) => p.id === e.target);
          if (p) p.counters = Math.max(0, p.counters - e.amount);
        }
      } else if (e.type === "ready") {
        if (!flags(s).cannotReady) s.player.exhausted = false;
      } else if (e.type === "status") {
        const p = find(s, e.target)!;
        p[e.status as "stunned"] = true;
      } else if (e.type === "discardPiece") ports.discardPiece(s, e.id);
      else if (e.type === "removeEncounter") s.removed.push(e.piece);
      else if (e.type === "dealEncounter")
        s.encounter.dealt.push(piece("01104", { dealtTo: e.playerId }));
      else if (e.type === "enemyAttack") {
        const p =
          e.target === s.villain.id
            ? s.villain
            : s.minions.find((p) => p.id === e.target);
        if (!p || flags(s).abortAttacks?.includes(e.target)) continue;
        if (p.stunned) {
          consumeStatus(p, "stunned");
          continue;
        }
        flags(s).completedAttacks ||= {};
        flags(s).completedAttacks[e.target] =
          ports.enemyAttackCount(s, e.target) + 1;
        flags(s).nativeAttackModifiers ||= [];
        flags(s).nativeAttackModifiers.push(e.modifier);
      }
    }
    return s;
  }
  function choose(target: string) {
    const o = s.prompt!.options.find((p) => p.id === target);
    expect(o, JSON.stringify(s.prompt)).toBeTruthy();
    s.prompt = null;
    drain(o!.effects);
    return s;
  }
  function put(code: string, args: Partial<Piece> = {}) {
    const p = piece(code, args);
    s.player.inPlay.push(p);
    return p;
  }
  function hand(code: string) {
    const p = piece(code);
    s.player.hand.push(p);
    return p;
  }
  function snapshot(identityAttacked = true): DraxVillainAttackSnapshot {
    return {
      attacker: s.villain.id,
      isVillain: true,
      playerId: s.activePlayerId,
      identityAttacked,
    };
  }
  function other() {
    s.players.push({
      ...s.players[0],
      id: "p2",
      heroId: "gam",
      player: { ...player(), hp: 6 },
      flags: {},
    });
    s.playerCount = 2;
  }
  return {
    get s() {
      return s;
    },
    ports,
    trace,
    reload,
    drain,
    choose,
    put,
    hand,
    snapshot,
    other,
  };
}

describe("Drax source and continuous rules", () => {
  it("uses 17 original faces and 15 physical signatures", () => {
    expect(DRAX_SCRIPT_CODES).toHaveLength(17);
    expect(new Set(DRAX_SCRIPT_CODES).size).toBe(17);
    for (const code of DRAX_SCRIPT_CODES)
      expect(cards.has(code), code).toBe(true);
    expect(
      DRAX_SCRIPT_CODES.filter((c) => c >= "19002" && c <= "19011").reduce(
        (n, c) => n + cards.get(c)!.quantity,
        0,
      ),
    ).toBe(15);
  });
  it("preserves all printed numeric encounter boosts", () => {
    expect(DRAX_ENCOUNTER_BOOSTS).toEqual({
      "19025": 2,
      "19026": 2,
      "19027": 3,
      "19028": 1,
      "19029": 2,
    });
    const f = fixture();
    for (const code of Object.keys(DRAX_ENCOUNTER_BOOSTS))
      expect(draxBoost(f.s, piece(code))).toEqual([]);
    expect(draxBoost(f.s, piece("01104"))).toBeNull();
  });
  it("does not clamp counters added by external effects", () => {
    const f = fixture();
    draxAddVengeanceCounters(f.s, 4);
    expect(draxVengeanceCounters(f.s)).toBe(4);
    expect(f.ports.heroAttack(f.s)).toBe(5);
  });
  it("rejects invalid external counter placement", () => {
    const f = fixture();
    expect(() => draxAddVengeanceCounters(f.s, -1)).toThrow();
    expect(() => draxAddVengeanceCounters(f.s, 0.5)).toThrow();
  });
  it("adds the two different knives only in hero form", () => {
    const f = fixture();
    f.put("19008");
    f.put("19009");
    draxAddVengeanceCounters(f.s, 2);
    expect(draxStats(f.s, f.ports)).toEqual({ attack: 3, retaliate: 1 });
    f.s.player.form = "alter";
    expect(draxStats(f.s, f.ports)).toEqual({ attack: 0, retaliate: 0 });
  });
  it("respects blank weapon text", () => {
    const f = fixture();
    const a = f.put("19008");
    const b = f.put("19009");
    flags(f.s).blankCards = [a.id, b.id];
    expect(draxStats(f.s, f.ports)).toEqual({ attack: 0, retaliate: 0 });
  });
  it("uses per-seat vengeance state", () => {
    const f = fixture();
    f.other();
    draxAddVengeanceCounters(f.s, 4);
    expect(draxVengeanceCounters(seatView(f.s, "p2"))).toBe(0);
    expect(draxStats(seatView(f.s, "p2"))).toEqual({ attack: 0, retaliate: 0 });
  });
  it("adds Cull's text separately from Challenge's unblankable printed icon", () => {
    const f = fixture();
    const c = piece("19026");
    const a = piece("19028", { attachedTo: f.s.villain.id });
    f.s.sideSchemes.push(c);
    f.s.attachments.push(a);
    expect(draxEnemyStats(f.s, f.s.villain, f.ports)).toEqual({ attack: 2 });
    expect(f.ports.enemyAttack(f.s, f.s.villain)).toBe(6);
    flags(f.s).blankCards = [c.id, a.id];
    expect(draxEnemyStats(f.s, f.s.villain, f.ports)).toEqual({ attack: 0 });
    expect(f.ports.enemyAttack(f.s, f.s.villain)).toBe(4);
  });
});

describe("Drax alter-ego and Mantis", () => {
  it.each([0, 1, 3, 4])(
    "removes all %i counters and heals two per counter on a real change",
    (n) => {
      const f = fixture();
      f.s.player.hp = 1;
      draxAddVengeanceCounters(f.s, n);
      f.ports.flip(f.s, false, "alter");
      f.drain();
      expect(f.s.player.hp).toBe(1 + 2 * n);
      expect(draxVengeanceCounters(f.s)).toBe(0);
      expect(f.s.player.flipped).toBe(false);
    },
  );
  it("does not heal at setup or on an unchanged form", () => {
    const f = fixture();
    f.s.player.form = "alter";
    expect(draxChangedForm(f.s, "alter")).toEqual([]);
    f.s.player.form = "hero";
    expect(draxChangedForm(f.s, "hero")).toEqual([]);
    expect(draxChangedForm(f.s, "alter")).toEqual([]);
  });
  it("allows Mantis's Action in alter-ego", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.s.player.hp = 8;
    const m = f.put("19002");
    f.drain(draxAbility(f.s, m.id, "mantis", f.ports)!);
    expect(f.s.player.hp).toBe(11);
    expect(f.s.player.inPlay.find((p) => p.id === m.id)).toMatchObject({
      damage: 1,
      exhausted: true,
    });
  });
  it("chooses another player's damaged identity without touching its own HP", () => {
    const f = fixture();
    f.other();
    f.s.player.hp = 10;
    const m = f.put("19002");
    f.drain(draxAbility(f.s, m.id, "mantis", f.ports)!);
    f.choose("hero:p2");
    expect(seatView(f.s, "p2").player.hp).toBe(9);
    expect(f.s.player.hp).toBe(10);
  });
  it("pays lethal ally damage and still resolves healing", () => {
    const f = fixture();
    f.s.player.hp = 8;
    const m = f.put("19002", { damage: 2 });
    f.drain(draxAbility(f.s, m.id, "mantis", f.ports)!);
    expect(f.s.player.hp).toBe(11);
    expect(f.s.player.discard.map((p) => p.id)).toContain(m.id);
  });
  it("dealing the cost through Tough still pays and heals", () => {
    const f = fixture();
    f.s.player.hp = 8;
    const m = f.put("19002", { tough: true });
    f.drain(draxAbility(f.s, m.id, "mantis", f.ports)!);
    expect(f.s.player.hp).toBe(11);
    expect(f.s.player.inPlay[0]).toMatchObject({
      damage: 0,
      tough: false,
      exhausted: true,
    });
  });
  it("requires a damaged identity and ready, active ally text", () => {
    const f = fixture();
    const m = f.put("19002");
    expect(draxAbilityOptions(f.s, m.id, f.ports)).toEqual([]);
    f.s.player.hp = 10;
    m.exhausted = true;
    expect(draxAbilityOptions(f.s, m.id, f.ports)).toEqual([]);
    m.exhausted = false;
    flags(f.s).blankCards = [m.id];
    expect(draxAbilityOptions(f.s, m.id, f.ports)).toEqual([]);
  });
  it("revalidates the selected identity before paying", () => {
    const f = fixture();
    f.other();
    f.s.player.hp = 10;
    const m = f.put("19002");
    f.drain(draxAbility(f.s, m.id, "mantis", f.ports)!);
    seatView(f.s, "p2").player.hp = 10;
    expect(() => f.choose("hero:p2")).toThrow(/no longer available/);
    expect(f.s.player.inPlay[0].exhausted).toBe(false);
  });
});

describe("Drax actions", () => {
  it("readies and draws before Fight Me, Coward's native villain activation", () => {
    const f = fixture();
    f.s.player.exhausted = true;
    const draw = piece("19004");
    f.s.player.deck = [draw];
    f.drain(draxEvent(f.s, piece("19003"))!);
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.hand[0].id).toBe(draw.id);
    expect(f.trace.map((e) => e.type)).toEqual([
      "ready",
      "draw",
      "drax:fight-me-attack",
      "enemyAttack",
    ]);
    expect(f.ports.enemyAttackCount(f.s, f.s.villain.id)).toBe(1);
  });
  it("still draws and initiates an attack if readying does not change the state", () => {
    const f = fixture();
    flags(f.s).cannotReady = true;
    f.s.player.deck = [piece("19004")];
    f.drain(draxEvent(f.s, piece("19003"))!);
    expect(f.s.player.hand).toHaveLength(1);
    expect(f.ports.enemyAttackCount(f.s, f.s.villain.id)).toBe(1);
  });
  it("Intimidation uses current derived ATK", () => {
    const f = fixture();
    draxAddVengeanceCounters(f.s, 3);
    f.put("19008");
    flags(f.s).attackBonus = 2;
    f.drain(draxEvent(f.s, piece("19004"))!);
    expect(f.s.scheme.threat).toBe(2);
  });
  it("Confused cancels Intimidation and Stunned remains unrelated", () => {
    const f = fixture();
    f.s.player.confused = true;
    f.s.player.stunned = true;
    f.drain(draxEvent(f.s, piece("19004"))!);
    expect(f.s.player.confused).toBe(false);
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.scheme.threat).toBe(9);
  });
  it.each(["patrol", "crisis"])(
    "uses native scheme legality for %s",
    (flag) => {
      const f = fixture();
      flags(f.s)[flag] = true;
      expect(draxPlayRestriction(f.s, piece("19004"), f.ports)).toMatch(
        /no legal scheme/,
      );
      const side = piece("19026", { counters: 4 });
      f.s.sideSchemes.push(side);
      f.drain(draxEvent(f.s, piece("19004"))!);
      expect(f.s.sideSchemes[0].counters).toBe(3);
      expect(f.s.scheme.threat).toBe(9);
    },
  );
  it("allows a Confused thwart event to clear its status without a scheme target", () => {
    const f = fixture();
    flags(f.s).patrol = true;
    f.s.player.confused = true;
    expect(draxPlayRestriction(f.s, piece("19004"), f.ports)).toBeNull();
  });
  it.each(["19005", "19006", "19007"])(
    "%s requires its own native window",
    (code) => {
      const f = fixture();
      expect(draxPlayRestriction(f.s, piece(code), f.ports)).toMatch(
        /native interrupt or response/,
      );
      expect(draxEvent(f.s, piece(code))).toBeNull();
    },
  );
  it("requires hero form for all signature events", () => {
    const f = fixture();
    f.s.player.form = "alter";
    for (const code of ["19003", "19004", "19005", "19006", "19007"])
      expect(draxPlayRestriction(f.s, piece(code), f.ports)).toMatch(
        /hero form/,
      );
  });
});

describe("Knife Leap and DWI Theet Mastery", () => {
  it.each([0, 1, 2, 3, 4])(
    "reduces Knife Leap's cost for %i counters without a negative cost",
    (n) => {
      const f = fixture();
      draxAddVengeanceCounters(f.s, n);
      expect(f.ports.cardCost(f.s, piece("19005"))).toBe(Math.max(0, 3 - n));
    },
  );
  it("pays, physically discards, then applies modifiers to only the saved basic attack", () => {
    const f = fixture();
    const p = f.hand("19005");
    draxAddVengeanceCounters(f.s, 3);
    const packet = {
      type: "basicPacket",
      basic: true,
      amount: 4,
      target: f.s.villain.id,
    };
    f.drain(
      draxBasicAttackOptions(f.s, packet, [{ type: "afterBasic" }], f.ports)[0]
        .effects,
    );
    expect(f.s.player.discard.map((p) => p.id)).toEqual([p.id]);
    const attack = f.trace.find((e) => e.type === "basicPacket")!;
    expect(attack).toMatchObject({
      amount: 9,
      gmwBasicBonus: 5,
      piercing: true,
      overkill: true,
      draxKnifeLeaps: [p.id],
    });
    expect(f.trace.findIndex((e) => e.type === "finishEvent")).toBeLessThan(
      f.trace.findIndex((e) => e.type === "basicPacket"),
    );
    expect(f.ports.heroAttack(f.s)).toBe(4);
  });
  it("stacks separate physical Knife Leaps without replaying the same copy", () => {
    const f = fixture();
    const a = f.hand("19005");
    const b = f.hand("19005");
    draxAddVengeanceCounters(f.s, 3);
    let packet: Effect = { type: "basicPacket", basic: true, amount: 4 };
    f.drain(
      draxBasicAttackOptions(f.s, packet, [], f.ports).find(
        (o) => o.id === a.id,
      )!.effects,
    );
    packet = f.trace.find((e) => e.type === "basicPacket")!;
    f.drain(
      draxBasicAttackOptions(f.s, packet, [], f.ports).find(
        (o) => o.id === b.id,
      )!.effects,
    );
    expect(
      f.trace.filter((e) => e.type === "basicPacket").at(-1),
    ).toMatchObject({
      amount: 14,
      gmwBasicBonus: 10,
      draxKnifeLeaps: [a.id, b.id],
    });
  });
  it("does not offer an unaffordable event or a Stun-replaced basic attack", () => {
    const f = fixture();
    f.hand("19005");
    const packet = { type: "damage", basic: true };
    flags(f.s).resources = 2;
    expect(draxBasicAttackOptions(f.s, packet, [], f.ports)).toEqual([]);
    flags(f.s).resources = 10;
    f.s.player.stunned = true;
    expect(draxBasicAttackOptions(f.s, packet, [], f.ports)).toEqual([]);
  });
  it("does not offer Knife Leap for event attacks or alter-ego", () => {
    const f = fixture();
    f.hand("19005");
    expect(
      draxBasicAttackOptions(
        f.s,
        { type: "damage", attack: true },
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.s.player.form = "alter";
    expect(
      draxBasicAttackOptions(f.s, { type: "damage", basic: true }, [], f.ports),
    ).toEqual([]);
  });
  it("offers Mastery's optional draw only from active hero-form text", () => {
    const f = fixture();
    const p = f.put("19010");
    const drawn = piece("19004");
    f.s.player.deck.push(drawn);
    f.drain(draxAfterBasicAttack(f.s, f.ports));
    f.choose("yes");
    expect(f.s.player.hand[0].id).toBe(drawn.id);
    expect(f.s.player.inPlay[0].exhausted).toBe(false);
    flags(f.s).blankCards = [p.id];
    expect(draxAfterBasicAttack(f.s, f.ports)).toEqual([]);
    flags(f.s).blankCards = [];
    f.s.player.form = "alter";
    expect(draxAfterBasicAttack(f.s, f.ports)).toEqual([]);
  });
  it("lets Mastery be declined without drawing", () => {
    const f = fixture();
    f.put("19010");
    f.s.player.deck.push(piece("19004"));
    f.drain(draxAfterBasicAttack(f.s, f.ports));
    f.choose("no");
    expect(f.s.player.hand).toHaveLength(0);
  });
});

describe("Parry and villain attack responses", () => {
  it.each(["attack", "overkill", "retaliate", "indirect", "effect"])(
    "Parry prevents current ATK twice for %s damage",
    (kind) => {
      const f = fixture();
      const p = f.hand("19006");
      draxAddVengeanceCounters(f.s, 2);
      f.put("19008");
      f.s.player.stunned = true;
      const packet = { type: "damage", target: "hero", kind };
      f.drain(
        draxDamageOptions(
          f.s,
          packet,
          7,
          [{ type: "resumeDamage" }],
          f.ports,
        )[0].effects,
      );
      expect(flags(f.s).prevented).toBe(8);
      expect(flags(f.s).claimedPacket).toMatchObject({ target: "hero", kind });
      expect(f.s.player.stunned).toBe(true);
      expect(f.s.player.discard[0].id).toBe(p.id);
    },
  );
  it("does not offer Parry for Tough, zero damage or a different player's identity", () => {
    const f = fixture();
    f.hand("19006");
    expect(
      draxDamageOptions(
        f.s,
        { type: "damage", target: "hero:p2" },
        3,
        [],
        f.ports,
      ),
    ).toEqual([]);
    expect(draxDamageOptions(f.s, undefined, 0, [], f.ports)).toEqual([]);
    f.s.player.tough = true;
    expect(draxDamageOptions(f.s, undefined, 3, [], f.ports)).toEqual([]);
  });
  it("does not offer a zero-prevention or alter-ego Parry", () => {
    const f = fixture();
    f.hand("19006");
    flags(f.s).attackBonus = -1;
    expect(draxDamageOptions(f.s, undefined, 3, [], f.ports)).toEqual([]);
    flags(f.s).attackBonus = 0;
    f.s.player.form = "alter";
    expect(draxDamageOptions(f.s, undefined, 3, [], f.ports)).toEqual([]);
  });
  it("vengeance requires actual Drax to have been attacked but Payback allows his own ally defense", () => {
    const f = fixture();
    const p = f.hand("19007");
    f.drain(draxAfterVillainAttack(f.s, f.snapshot(false), [], f.ports));
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([p.id, "continue"]);
    f.choose(p.id);
    expect(f.s.villain.hp).toBe(39);
    expect(draxVengeanceCounters(f.s)).toBe(0);
  });
  it("can resolve vengeance before Payback for increased current ATK", () => {
    const f = fixture();
    const p = f.hand("19007");
    f.drain(draxAfterVillainAttack(f.s, f.snapshot(), [], f.ports));
    f.choose("vengeance");
    f.choose(p.id);
    expect(draxVengeanceCounters(f.s)).toBe(1);
    expect(f.s.villain.hp).toBe(38);
    expect(f.s.player.discard[0].id).toBe(p.id);
  });
  it("can resolve Payback before vengeance", () => {
    const f = fixture();
    const p = f.hand("19007");
    f.drain(draxAfterVillainAttack(f.s, f.snapshot(), [], f.ports));
    f.choose(p.id);
    f.choose("vengeance");
    expect(f.s.villain.hp).toBe(39);
    expect(draxVengeanceCounters(f.s)).toBe(1);
  });
  it.each([3, 4])(
    "draws at %i counters before reopening the same response window",
    (n) => {
      const f = fixture();
      draxAddVengeanceCounters(f.s, n);
      const p = piece("19007");
      f.s.player.deck.push(p);
      f.drain(draxAfterVillainAttack(f.s, f.snapshot(), [], f.ports));
      f.choose("vengeance");
      expect(draxVengeanceCounters(f.s)).toBe(n);
      expect(f.s.prompt!.options.map((o) => o.id)).toContain(p.id);
      expect(f.s.prompt!.options.map((o) => o.id)).not.toContain("vengeance");
    },
  );
  it("an actual Tough-protected Drax attack still offers vengeance", () => {
    const f = fixture();
    f.s.player.tough = true;
    f.drain(draxAfterVillainAttack(f.s, f.snapshot(), [], f.ports));
    expect(f.s.prompt!.options.map((o) => o.id)).toContain("vengeance");
  });
  it.each(["minion", "different-player", "alter-ego"])(
    "does not offer identity reactions for %s",
    (kind) => {
      const f = fixture();
      f.hand("19007");
      const snapshot = f.snapshot();
      if (kind === "minion") snapshot.isVillain = false;
      if (kind === "different-player") snapshot.playerId = "p2";
      if (kind === "alter-ego") f.s.player.form = "alter";
      expect(
        draxAfterVillainAttack(f.s, snapshot, [{ type: "resume" }], f.ports),
      ).toEqual([{ type: "resume" }]);
    },
  );
  it("Guard blocks Payback, while a Stun replacement remains playable", () => {
    const f = fixture();
    const p = f.hand("19007");
    f.s.minions.push(piece("19027"));
    f.drain(draxAfterVillainAttack(f.s, f.snapshot(false), [], f.ports));
    expect(f.s.prompt).toBeNull();
    f.s.player.stunned = true;
    f.drain(draxAfterVillainAttack(f.s, f.snapshot(false), [], f.ports));
    f.choose(p.id);
    expect(f.s.player.stunned).toBe(false);
    expect(f.s.villain.hp).toBe(40);
    expect(f.s.player.discard[0].id).toBe(p.id);
  });
  it("can pass all optional responses while retaining the continuation", () => {
    const f = fixture();
    f.hand("19007");
    f.drain(
      draxAfterVillainAttack(f.s, f.snapshot(), [{ type: "resume" }], f.ports),
    );
    f.choose("continue");
    expect(draxVengeanceCounters(f.s)).toBe(0);
    expect(f.trace.at(-1)?.type).toBe("resume");
  });
});

describe("Drax shared after-attack responses", () => {
  it("returns to a shared response window after vengeance, retaining its used marker", () => {
    const f = fixture();
    const p = f.hand("19007");
    const after = [{ type: "sharedResponses", otherUsed: ["counter-punch"] }];
    const choices = draxVillainAttackResponseOptions(
      f.s,
      f.snapshot(),
      [],
      after,
      f.ports,
    );
    f.drain(choices.find((o) => o.id === "vengeance")!.effects);
    expect(f.trace.at(-1)).toEqual({
      type: "sharedResponses",
      otherUsed: ["counter-punch"],
      draxUsed: ["vengeance"],
    });
    expect(
      draxVillainAttackResponseOptions(
        f.s,
        f.snapshot(),
        ["vengeance"],
        after,
        f.ports,
      ).map((o) => o.id),
    ).toEqual([p.id]);
  });
  it("physically resolves Payback before returning to other responses", () => {
    const f = fixture();
    const p = f.hand("19007");
    const after = [{ type: "sharedResponses" }];
    f.drain(
      draxVillainAttackResponseOptions(
        f.s,
        f.snapshot(),
        [],
        after,
        f.ports,
      ).find((o) => o.id === p.id)!.effects,
    );
    expect(f.s.player.discard.map((p) => p.id)).toEqual([p.id]);
    expect(f.trace.at(-1)).toEqual({
      type: "sharedResponses",
      draxUsed: [p.id],
    });
    expect(
      draxVillainAttackResponseOptions(
        f.s,
        f.snapshot(),
        [p.id],
        after,
        f.ports,
      ).map((o) => o.id),
    ).toEqual(["vengeance"]);
  });
  it("finishes a maximum-counter draw before resuming the shared window", () => {
    const f = fixture();
    draxAddVengeanceCounters(f.s, 4);
    const p = piece("19007");
    f.s.player.deck.push(p);
    f.drain(
      draxVillainAttackResponseOptions(
        f.s,
        f.snapshot(),
        [],
        [{ type: "sharedResponses" }],
        f.ports,
      ).find((o) => o.id === "vengeance")!.effects,
    );
    expect(f.s.player.hand[0].id).toBe(p.id);
    expect(f.trace.slice(-2).map((e) => e.type)).toEqual([
      "draw",
      "sharedResponses",
    ]);
  });
});

describe("Too Stubborn to Die", () => {
  it.each([0, 3, 4])(
    "sets HP4, forced-heals %i counters and removes exactly the chosen upgrade",
    (n) => {
      const f = fixture();
      const p = f.put("19011");
      const other = f.put("19008");
      f.s.player.hp = -3;
      draxAddVengeanceCounters(f.s, n);
      f.drain(draxDefeatOptions(f.s, [{ type: "resume" }], f.ports)[0].effects);
      expect(f.s.player.hp).toBe(4 + 2 * n);
      expect(f.s.player.form).toBe("alter");
      expect(f.s.player.flipped).toBe(false);
      expect(draxVengeanceCounters(f.s)).toBe(0);
      expect(f.s.removed.map((p) => p.id)).toEqual([p.id]);
      expect(f.s.player.inPlay.map((p) => p.id)).toEqual([other.id]);
      expect(f.s.player.discard).toHaveLength(0);
      expect(f.trace.find((e) => e.type === "physicalRemove")?.hp).toBe(
        4 + 2 * n,
      );
      expect(f.trace.at(-1)?.type).toBe("resume");
    },
  );
  it("honors absolute cannot-change-form while resolving its other independent effects", () => {
    const f = fixture();
    const p = f.put("19011");
    f.s.player.hp = 0;
    flags(f.s).formLocked = true;
    draxAddVengeanceCounters(f.s, 4);
    f.drain(draxDefeatOptions(f.s, [], f.ports)[0].effects);
    expect(f.s.player.hp).toBe(4);
    expect(f.s.player.form).toBe("hero");
    expect(draxVengeanceCounters(f.s)).toBe(4);
    expect(f.s.removed[0].id).toBe(p.id);
  });
  it("requires a defeated hero and active physical upgrade", () => {
    const f = fixture();
    const p = f.put("19011");
    expect(draxDefeatOptions(f.s, [], f.ports)).toEqual([]);
    f.s.player.hp = 0;
    f.s.player.form = "alter";
    expect(draxDefeatOptions(f.s, [], f.ports)).toEqual([]);
    f.s.player.form = "hero";
    flags(f.s).blankCards = [p.id];
    expect(draxDefeatOptions(f.s, [], f.ports)).toEqual([]);
  });
});

describe("Drax nemesis and obligation", () => {
  it("attaches Challenge to highest derived ATK and lets the revealing player break ties", () => {
    const f = fixture();
    const a = piece("19028");
    const m = piece("19027");
    f.s.attachments.push(a);
    f.s.minions.push(m);
    flags(f.s).enemyBonus = { [f.s.villain.id]: 1 };
    f.drain(draxEncounterReveal(f.s, a)!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([
      f.s.villain.id,
      m.id,
    ]);
    f.choose(m.id);
    expect(f.s.attachments[0].attachedTo).toBe(m.id);
    expect(f.ports.enemyAttack(f.s, f.s.minions[0])).toBe(5);
  });
  it("automatically attaches when only one enemy has the highest ATK", () => {
    const f = fixture();
    const a = piece("19028");
    const m = piece("19027");
    f.s.attachments.push(a);
    f.s.minions.push(m);
    f.drain(draxEncounterReveal(f.s, a)!);
    expect(f.s.attachments[0].attachedTo).toBe(m.id);
  });
  it("discards Challenge for four damage dealt, including an attack fully prevented by Tough", () => {
    const f = fixture();
    const a = piece("19028", { attachedTo: f.s.villain.id });
    f.s.attachments.push(a);
    f.s.villain.tough = true;
    f.drain(
      draxDamageDealt(
        f.s,
        {
          target: f.s.villain.id,
          attack: true,
          sourceIsDrax: true,
          damageDealt: 4,
        },
        f.ports,
      ),
    );
    expect(f.s.attachments).toHaveLength(0);
    expect(f.s.encounter.discard[0].id).toBe(a.id);
    expect(f.s.villain.hp).toBe(40);
  });
  it.each([
    "low",
    "non-attack",
    "different-source",
    "different-target",
    "blank",
  ])("does not discard Challenge for %s", (kind) => {
    const f = fixture();
    const a = piece("19028", { attachedTo: f.s.villain.id });
    f.s.attachments.push(a);
    if (kind === "blank") flags(f.s).blankCards = [a.id];
    expect(
      draxDamageDealt(
        f.s,
        {
          target: kind === "different-target" ? "other" : f.s.villain.id,
          attack: kind !== "non-attack",
          sourceIsDrax: kind !== "different-source",
          damageDealt: kind === "low" ? 3 : 4,
        },
        f.ports,
      ),
    ).toEqual([]);
  });
  it("Yotat makes its +1 ATK activation before resuming without a fallback", () => {
    const f = fixture();
    const m = piece("19027");
    f.s.minions.push(m);
    f.drain(draxEncounterReveal(f.s, piece("19029"))!);
    expect(f.ports.enemyAttackCount(f.s, m.id)).toBe(1);
    expect(f.ports.enemyAttackCount(f.s, f.s.villain.id)).toBe(0);
    expect(flags(f.s).nativeAttackModifiers).toEqual([1]);
  });
  it.each(["absent", "stunned", "aborted"])(
    "falls back to a villain attack if Yotat's attack is %s",
    (kind) => {
      const f = fixture();
      const m = piece("19027", { stunned: kind === "stunned" });
      if (kind !== "absent") f.s.minions.push(m);
      if (kind === "aborted") flags(f.s).abortAttacks = [m.id];
      f.drain(draxEncounterReveal(f.s, piece("19029"))!);
      expect(f.ports.enemyAttackCount(f.s, f.s.villain.id)).toBe(1);
      expect(f.ports.enemyAttackCount(f.s, m.id)).toBe(0);
    },
  );
  it("I Will Destroy You only surges in alter-ego", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.drain(draxEncounterReveal(f.s, piece("19029"))!);
    expect(f.s.encounter.dealt).toHaveLength(1);
    expect(f.ports.enemyAttackCount(f.s, f.s.villain.id)).toBe(0);
  });
  it("routes the actual obligation to Drax's seat", () => {
    const f = fixture();
    f.other();
    const p = piece("19025");
    activateSeat(f.s, "p2");
    expect(draxEncounterReveal(f.s, p)).toEqual([
      D("obligation", { piece: p, actorId: "p1" }),
    ]);
  });
  it("optional obligation flip resolves forced healing before the resolution choice", () => {
    const f = fixture();
    const p = piece("19025");
    f.s.player.hp = 5;
    draxAddVengeanceCounters(f.s, 3);
    f.drain(draxEncounterReveal(f.s, p)!);
    f.choose("flip");
    expect(f.s.player.hp).toBe(11);
    expect(draxVengeanceCounters(f.s)).toBe(0);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["remove", "stun"]);
    f.choose("remove");
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed[0].id).toBe(p.id);
  });
  it("staying in hero form cannot exhaust an alter-ego", () => {
    const f = fixture();
    f.drain(draxEncounterReveal(f.s, piece("19025"))!);
    f.choose("stay");
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["stun"]);
  });
  it("form lock suppresses the optional flip", () => {
    const f = fixture();
    flags(f.s).formLocked = true;
    f.drain(draxEncounterReveal(f.s, piece("19025"))!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["stun"]);
  });
  it.each([false, true])(
    "surges only when already Stunned before resolving the obligation (%s)",
    (stunned) => {
      const f = fixture();
      f.s.player.stunned = stunned;
      f.drain(draxEncounterReveal(f.s, piece("19025"))!);
      f.choose("stay");
      f.choose("stun");
      expect(f.s.player.stunned).toBe(true);
      expect(f.s.encounter.dealt).toHaveLength(stunned ? 1 : 0);
    },
  );
  it("an exhausted alter-ego cannot pay the obligation removal cost", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.s.player.exhausted = true;
    f.drain(draxEncounterReveal(f.s, piece("19025"))!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["stun"]);
  });
  it("keeps physical choices and effects serializable across every response payment", () => {
    const f = fixture();
    f.hand("19006");
    f.hand("19007");
    const effects = [
      ...draxDamageOptions(
        f.s,
        { type: "damage", target: "hero" },
        4,
        [],
        f.ports,
      ),
      ...draxBasicAttackOptions(
        f.s,
        { type: "damage", basic: true },
        [],
        f.ports,
      ),
    ];
    expect(JSON.parse(JSON.stringify(effects))).toEqual(effects);
  });
  it("does not claim unrelated effects or card faces", () => {
    const f = fixture();
    expect(resolveDraxEffect(f.s, { type: "other:effect" }, f.ports)).toBe(
      false,
    );
    expect(draxEncounterReveal(f.s, piece("01104"))).toBeNull();
    expect(() => resolveDraxEffect(f.s, D("unknown"), f.ports)).toThrow(
      /Unknown Drax/,
    );
  });
});
