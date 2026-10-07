import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import {
  activateSeat,
  seatView,
  syncSeat,
  upgradeSave,
} from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  GROOT_SCRIPT_CODES,
  grootAbility,
  grootAbilityOptions,
  grootAddGrowthCounters,
  grootAfterBasicOptions,
  grootAfterBasicPower,
  grootBasicOptions,
  grootBoost,
  grootDefenseOptions,
  grootEncounterReveal,
  grootEnemyActivated,
  grootEvent,
  grootGrowthCounters,
  grootPlayRestriction,
  grootPreventDamage,
  grootVillainPhaseBegin,
  resolveGrootEffect,
  type GrootPorts,
} from "../src/game/groot.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const G = (type: string, patch: Record<string, unknown> = {}): Effect => ({
  type: `groot:${type}`,
  ...patch,
});
let next = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `groot${++next}`,
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
  hp: 10,
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
    seed: 16,
    nextId: 1,
    heroId: "groot",
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
      heroId: "groot",
      aspect: "protection",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  const native: Effect[] = [];
  const find = (id: string) =>
    id === "hero"
      ? s.player
      : id.startsWith("hero:")
        ? seatView(s, id.slice(5)).player
        : s.players
            .flatMap(
              (p) => (p.id === s.activePlayerId ? s.player : p.player).inPlay,
            )
            .find((p) => p.id === id) ||
          s.minions.find((p) => p.id === id) ||
          (id === s.villain.id ? s.villain : undefined);
  const ports: GrootPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: vi.fn((state, counts, target) => {
      state.player.form = target === "alter" ? "alter" : "hero";
      if (counts) state.player.flipped = true;
    }),
    canReadyIdentity: (state, id) => !seatView(state, id).flags.readyLocked,
    canPay: () => true,
    canGiveStatus: (_state, id, status) => {
      const p = find(id);
      return !!p && !p[status];
    },
    enemyTargets: (state, attack) => [
      ...(!attack || !state.minions.some((p) => p.code === "01101")
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
      (!thwart || !state.sideSchemes.some((p) => p.code === "01104"))
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
    friendlyTargets: (state) =>
      state.players
        .filter((p) => !p.eliminated)
        .flatMap((seat) => {
          const view = seatView(state, seat);
          return [
            {
              id: seat.id === state.activePlayerId ? "hero" : `hero:${seat.id}`,
              label: seat.heroId,
            },
            ...view.player.inPlay
              .filter((p) => cards.get(p.code)?.type_code === "ally")
              .map((p) => ({
                id: p.id,
                label: cards.get(p.code)!.name,
                code: p.code,
              })),
          ];
        }),
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    discardHand: vi.fn(),
    discardPiece: vi.fn(),
    revealHidden: vi.fn(),
    recycleEncounter: vi.fn(),
    log: vi.fn(),
    attackProgram: vi.fn((state, effects, after) =>
      ports.queue(state, ...effects, ...after),
    ),
  };
  function run() {
    for (let i = 0; s.queue.length && !s.prompt; i++) {
      if (i > 100) throw Error("Unexpected effect loop");
      const e = s.queue.shift()!;
      if (e.actorId && e.actorId !== s.activePlayerId)
        activateSeat(s, e.actorId);
      if (resolveGrootEffect(s, e, ports)) continue;
      native.push(e);
      if (e.type === "draw")
        s.player.hand.push(...s.player.deck.splice(0, e.amount));
      if (e.type === "ready") {
        const p = find(e.target);
        if (p) p.exhausted = false;
      }
      if (e.type === "status") {
        const p = find(e.target);
        if (p) p[e.status as "tough"] = true;
      }
      if (e.type === "scriptCheckpoint") {
        const p = find(e.target) as Piece | undefined;
        ((s.scriptCheckpoints ||= {})[e.key] ||= []).push({
          target: e.target,
          code: p?.code,
          stage: e.target === s.villain.id ? s.villain.stage : undefined,
          existed: !!p,
        });
      }
      if (e.type === "scriptIfDefeated") {
        const snapshot = s.scriptCheckpoints?.[e.key]?.pop();
        const p = snapshot
          ? (find(snapshot.target) as Piece | undefined)
          : undefined;
        if (
          snapshot?.existed &&
          (!p ||
            p.code !== snapshot.code ||
            (snapshot.stage !== undefined &&
              snapshot.stage !== s.villain.stage))
        )
          ports.queue(s, ...e.effects);
      }
      if (e.type === "damage") {
        const p = find(e.target) as Piece | undefined;
        if (p && e.amount > 0) {
          if (p.tough) p.tough = false;
          else if (p.id === s.villain.id) {
            s.villain.hp -= e.amount;
            if (s.villain.hp <= 0) {
              s.villain.stage++;
              s.villain.hp = 15;
              s.villain.code = "01095";
            }
          } else {
            p.damage += e.amount;
            if (p.damage >= (cards.get(p.code)?.health || 0))
              s.minions = s.minions.filter((q) => q.id !== p.id);
          }
        }
      }
      if (e.type === "removeEncounter") {
        s.resolving = s.resolving.filter((p) => p.id !== e.piece.id);
        s.removed.push(e.piece);
      }
    }
  }
  function choose(id: string) {
    const o = s.prompt!.options.find((o) => o.id === id);
    if (!o) throw Error(`Missing choice ${id}`);
    s.prompt = null;
    ports.queue(s, ...o.effects);
    run();
  }
  return {
    get s() {
      return s;
    },
    ports,
    native,
    run,
    choose,
    resolve: (e: Effect) => resolveGrootEffect(s, e, ports),
    reload: () => {
      syncSeat(s);
      s = upgradeSave(JSON.parse(JSON.stringify(s)));
    },
    addSeat: () => {
      s.players.push({
        id: "p2",
        heroId: "rocket",
        aspect: "aggression",
        player: player(),
        flags: {},
        ended: false,
        eliminated: false,
        mulliganDone: true,
      });
      s.playerCount = 2;
    },
  };
}

describe("Groot counters and Flora Colossus", () => {
  it("registers every actual signature, obligation and nemesis face", () => {
    expect(GROOT_SCRIPT_CODES).toHaveLength(16);
    expect(new Set(GROOT_SCRIPT_CODES).size).toBe(16);
    expect(GROOT_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(fixture().resolve({ type: "other" })).toBe(false);
  });
  it("starts at zero and preserves capped identity counters through form changes and reload", () => {
    const f = fixture();
    expect(grootGrowthCounters(f.s)).toBe(0);
    grootAddGrowthCounters(f.s, 9);
    f.s.player.form = "alter";
    f.reload();
    grootAddGrowthCounters(f.s, 2);
    f.s.player.form = "hero";
    expect(grootGrowthCounters(f.s)).toBe(10);
  });
  it("rejects foreign identities and negative growth additions", () => {
    const f = fixture();
    expect(() => grootAddGrowthCounters(f.s, -1)).toThrow();
    f.s.heroId = "rocket";
    f.s.flags.grootGrowthCounters = 5;
    expect(grootGrowthCounters(f.s)).toBe(0);
    expect(() => grootAddGrowthCounters(f.s, 1)).toThrow();
  });
  it.each([
    [3, 5, 3, 0],
    [7, 2, 2, 5],
    [2, 2, 2, 0],
    [0, 4, 0, 0],
    [10, 20, 10, 0],
  ])(
    "%s counters prevent available damage from a %s-damage packet",
    (growth, damage, prevented, remaining) => {
      const f = fixture();
      grootAddGrowthCounters(f.s, growth);
      expect(grootPreventDamage(f.s, "hero", damage)).toBe(prevented);
      expect(grootGrowthCounters(f.s)).toBe(remaining);
    },
  );
  it("Tough prevents first without removing growth counters", () => {
    const f = fixture();
    grootAddGrowthCounters(f.s, 5);
    f.s.player.tough = true;
    expect(grootPreventDamage(f.s, "hero", 4)).toBe(0);
    expect(grootGrowthCounters(f.s)).toBe(5);
  });
  it("does not consume counters for alter-ego, other heroes, allies or zero damage", () => {
    const f = fixture();
    grootAddGrowthCounters(f.s, 5);
    for (const target of ["hero:p2", "ally"])
      expect(grootPreventDamage(f.s, target, 4)).toBe(0);
    expect(grootPreventDamage(f.s, "hero", 0)).toBe(0);
    f.s.player.form = "alter";
    expect(grootPreventDamage(f.s, "hero", 4)).toBe(0);
    expect(grootGrowthCounters(f.s)).toBe(5);
  });
  it("prevents for the actual Groot recipient while another seat is active", () => {
    const f = fixture();
    f.addSeat();
    grootAddGrowthCounters(f.s, 6);
    activateSeat(f.s, "p2");
    expect(grootPreventDamage(f.s, "hero", 3)).toBe(0);
    expect(grootPreventDamage(seatView(f.s, "p1"), "hero:p1", 3)).toBe(3);
    expect(f.s.players[0].flags.grootGrowthCounters).toBe(3);
    expect(f.s.activePlayerId).toBe("p2");
  });
});

describe("Groot actions and printed events", () => {
  it("Growth Spurt is alter-ego only, once per round, without exhaustion", () => {
    const f = fixture();
    expect(grootAbility(f.s, "hero", "growth-spurt", f.ports)).toBeNull();
    f.s.player.form = "alter";
    f.ports.queue(f.s, ...grootAbility(f.s, "hero", "growth-spurt", f.ports)!);
    f.run();
    expect(grootGrowthCounters(f.s)).toBe(2);
    expect(f.s.player.exhausted).toBe(false);
    expect(grootAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.reload();
    f.s.round++;
    f.ports.queue(f.s, ...grootAbility(f.s, "identity", undefined, f.ports)!);
    f.run();
    expect(grootGrowthCounters(f.s)).toBe(4);
  });
  it("Growth Spurt cannot initiate an action at the cap", () => {
    const f = fixture();
    f.s.player.form = "alter";
    grootAddGrowthCounters(f.s, 10);
    expect(grootAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
  });
  it.each(["hero", "alter"] as const)(
    "Fruition places capped counters in %s form",
    (form) => {
      const f = fixture();
      f.s.player.form = form;
      grootAddGrowthCounters(f.s, 9);
      expect(grootPlayRestriction(f.s, piece("16002"), f.ports)).toBeNull();
      f.ports.queue(f.s, ...grootEvent(f.s, piece("16002"))!);
      f.run();
      expect(grootGrowthCounters(f.s)).toBe(10);
      expect(grootPlayRestriction(f.s, piece("16002"), f.ports)).toContain(
        "maximum",
      );
    },
  );
  it("Fertile Ground draws at the growth cap and pays actual support exhaustion", () => {
    const f = fixture(),
      support = piece("16007"),
      draw = piece("01088");
    f.s.player.form = "alter";
    f.s.player.inPlay.push(support);
    f.s.player.deck.push(draw);
    grootAddGrowthCounters(f.s, 10);
    f.ports.queue(
      f.s,
      ...grootAbility(f.s, support.id, "fertile-ground", f.ports)!,
    );
    f.run();
    expect(grootGrowthCounters(f.s)).toBe(10);
    expect(f.s.player.hand).toEqual([draw]);
    expect(support.exhausted).toBe(true);
    expect(grootAbilityOptions(f.s, support.id, f.ports)).toEqual([]);
  });
  it("Fertile Ground is unavailable in hero form or when blank", () => {
    const f = fixture(),
      support = piece("16007");
    f.s.player.inPlay.push(support);
    expect(grootAbilityOptions(f.s, support.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    f.s.flags[`blank:${support.id}`] = true;
    expect(grootAbilityOptions(f.s, support.id, f.ports)).toEqual([]);
  });
  it.each([
    ["16003", "thwart"],
    ["16004", "damage"],
  ])(
    "%s uses growth at actual resolution without spending it",
    (code, type) => {
      const f = fixture();
      grootAddGrowthCounters(f.s, 6);
      f.ports.queue(f.s, ...grootEvent(f.s, piece(code))!);
      f.run();
      expect(f.native).toContainEqual(
        expect.objectContaining({ type, amount: 6 }),
      );
      expect(grootGrowthCounters(f.s)).toBe(6);
    },
  );
  it("confused growth thwart and stunned growth attack clear statuses without effect", () => {
    const f = fixture();
    f.s.player.confused = true;
    f.s.player.stunned = true;
    expect(grootPlayRestriction(f.s, piece("16003"), f.ports)).toBeNull();
    expect(grootPlayRestriction(f.s, piece("16004"), f.ports)).toBeNull();
    f.resolve(G("growth-thwart"));
    f.resolve(G("growth-attack"));
    expect(f.s.player.confused).toBe(false);
    expect(f.s.player.stunned).toBe(false);
    expect(f.s.queue).toEqual([]);
  });
  it("rejects empty growth and respects Guard, Crisis and hero form restrictions", () => {
    const f = fixture();
    expect(grootPlayRestriction(f.s, piece("16003"), f.ports)).toContain(
      "no growth",
    );
    expect(grootPlayRestriction(f.s, piece("16004"), f.ports)).toContain(
      "no growth",
    );
    grootAddGrowthCounters(f.s, 4);
    f.s.sideSchemes.push(piece("01104"));
    expect(grootPlayRestriction(f.s, piece("16003"), f.ports)).toContain(
      "no legal",
    );
    f.s.player.form = "alter";
    expect(grootPlayRestriction(f.s, piece("16005"), f.ports)).toContain(
      "hero form",
    );
    expect(grootEvent(f.s, piece("01088"))).toBeNull();
  });
  it("Root Stomp rewards an actual defeated physical minion", () => {
    const f = fixture(),
      target = piece("01101");
    f.s.minions.push(target);
    f.resolve(G("root-stomp"));
    f.run();
    expect(f.s.minions).toEqual([]);
    expect(grootGrowthCounters(f.s)).toBe(1);
    expect(f.ports.attackProgram).toHaveBeenCalledOnce();
  });
  it("Root Stomp does not reward Tough prevention or an enemy that survives", () => {
    for (const tough of [false, true]) {
      const f = fixture(),
        target = piece("16027", { tough });
      f.s.minions.push(target);
      f.resolve(G("root-stomp"));
      f.choose(target.id);
      expect(f.s.minions).toHaveLength(1);
      expect(grootGrowthCounters(f.s)).toBe(0);
    }
  });
  it("Root Stomp recognizes a defeated villain stage and caps the growth reward", () => {
    const f = fixture();
    grootAddGrowthCounters(f.s, 10);
    f.s.villain.hp = 4;
    f.resolve(G("root-stomp"));
    f.run();
    expect(f.s.villain.stage).toBe(2);
    expect(grootGrowthCounters(f.s)).toBe(10);
  });
  it("Root Stomp is replaced entirely when stunned", () => {
    const f = fixture();
    f.s.player.stunned = true;
    f.resolve(G("root-stomp"));
    f.run();
    expect(f.ports.attackProgram).not.toHaveBeenCalled();
    expect(grootGrowthCounters(f.s)).toBe(0);
  });
});

describe("Groot Vines and distinct friendly Tough targets", () => {
  it.each([
    ["attack", "16011"],
    ["thwart", "16008"],
  ] as const)(
    "pays %s Vines counters and actual exhaustion before applying a one-use bonus",
    (power, code) => {
      const f = fixture(),
        upgrade = piece(code);
      f.s.player.inPlay.push(upgrade);
      grootAddGrowthCounters(f.s, 4);
      const after = [
        {
          type: power === "attack" ? "damage" : "thwart",
          target: "target",
          amount: 2,
        },
      ];
      f.ports.queue(
        f.s,
        ...grootBasicOptions(f.s, power, after, f.ports)[0].effects,
      );
      f.reload();
      f.run();
      expect(f.native.at(-1)).toEqual({ ...after[0], amount: 4 });
      expect(grootGrowthCounters(f.s)).toBe(3);
      expect(f.s.player.inPlay[0].exhausted).toBe(true);
      expect(grootBasicOptions(f.s, power, after, f.ports)).toEqual([]);
    },
  );
  it("status replacement leaves Vines counters and upgrade exhaustion untouched", () => {
    const f = fixture();
    f.s.player.inPlay.push(piece("16011"), piece("16008"));
    grootAddGrowthCounters(f.s, 4);
    f.s.player.stunned = true;
    f.s.player.confused = true;
    expect(grootBasicOptions(f.s, "attack", [], f.ports)).toEqual([]);
    expect(grootBasicOptions(f.s, "thwart", [], f.ports)).toEqual([]);
    expect(grootGrowthCounters(f.s)).toBe(4);
    expect(f.s.player.inPlay.every((p) => !p.exhausted)).toBe(true);
  });
  it("Vine Shield requires actual basic Groot defense and adds +3 for only that attack", () => {
    const f = fixture(),
      shield = piece("16010");
    f.s.player.inPlay.push(shield);
    grootAddGrowthCounters(f.s, 3);
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 3,
      boostCodes: [],
      boostEffects: [],
      defense: 3,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
      defender: "hero",
      basicDefense: true,
      targetPlayerId: "p1",
    };
    f.ports.queue(
      f.s,
      ...grootDefenseOptions(f.s, [{ type: "boostAttack" }], f.ports)[0]
        .effects,
    );
    f.run();
    expect(f.s.attack.defenseBonus).toBe(3);
    expect(grootGrowthCounters(f.s)).toBe(2);
    expect(shield.exhausted).toBe(true);
    expect(f.native.at(-1)?.type).toBe("boostAttack");
  });
  it("Vine Shield cannot claim another player's or an ally's defense", () => {
    const f = fixture();
    f.s.player.inPlay.push(piece("16010"));
    grootAddGrowthCounters(f.s, 3);
    expect(grootDefenseOptions(f.s, [], f.ports)).toEqual([]);
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 3,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
      defender: "hero",
      basicDefense: true,
      targetPlayerId: "p2",
    };
    expect(grootDefenseOptions(f.s, [], f.ports)).toEqual([]);
  });
  it.each(["attack", "thwart", "defense", "recover"] as const)(
    "Lashing Vines responds to actual basic %s and pays before readying",
    (power) => {
      const f = fixture(),
        vines = piece("16009");
      f.s.player.inPlay.push(vines);
      f.s.player.exhausted = true;
      grootAddGrowthCounters(f.s, 4);
      f.ports.queue(f.s, ...grootAfterBasicPower(f.s, power, f.ports));
      f.run();
      f.reload();
      f.choose(vines.id);
      expect(f.s.player.exhausted).toBe(false);
      expect(grootGrowthCounters(f.s)).toBe(2);
      expect(f.s.player.inPlay[0].exhausted).toBe(true);
    },
  );
  it("Lashing Vines respects current hero form, blank text, ready locks and insufficient counters", () => {
    const f = fixture(),
      vines = piece("16009");
    f.s.player.inPlay.push(vines);
    f.s.player.exhausted = true;
    expect(grootAfterBasicOptions(f.s, "attack", [], f.ports)).toEqual([]);
    grootAddGrowthCounters(f.s, 3);
    f.s.flags.readyLocked = true;
    expect(grootAfterBasicPower(f.s, "defense", f.ports)).toEqual([]);
    delete f.s.flags.readyLocked;
    f.s.flags[`blank:${vines.id}`] = true;
    expect(grootAfterBasicPower(f.s, "attack", f.ports)).toEqual([]);
    delete f.s.flags[`blank:${vines.id}`];
    f.s.player.form = "alter";
    expect(grootAfterBasicPower(f.s, "attack", f.ports)).toEqual([]);
  });
  it("We Are Groot pays physical counters before choosing distinct heroes and allies across seats", () => {
    const f = fixture(),
      ally = piece("01067");
    f.addSeat();
    f.s.player.inPlay.push(ally);
    grootAddGrowthCounters(f.s, 5);
    f.resolve(G("we-are-groot"));
    f.choose("3");
    expect(grootGrowthCounters(f.s)).toBe(2);
    f.choose("hero");
    f.reload();
    expect(f.s.prompt!.options.map((o) => o.id)).not.toContain("hero");
    f.choose("hero:p2");
    f.choose(ally.id);
    expect(f.s.player.tough).toBe(true);
    expect(f.s.players[1].player.tough).toBe(true);
    expect(f.s.player.inPlay[0].tough).toBe(true);
    expect(f.s.prompt).toBeNull();
  });
  it("We Are Groot excludes already Tough characters and allows zero in its up-to cost", () => {
    const f = fixture();
    f.addSeat();
    grootAddGrowthCounters(f.s, 5);
    f.s.player.tough = true;
    f.resolve(G("we-are-groot"));
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["0", "1"]);
    f.choose("0");
    expect(grootGrowthCounters(f.s)).toBe(5);
    expect(f.s.players[1].player.tough).toBe(false);
  });
  it("We Are Groot cannot initiate when every friendly character already has Tough", () => {
    const f = fixture();
    grootAddGrowthCounters(f.s, 4);
    f.s.player.tough = true;
    expect(grootPlayRestriction(f.s, piece("16006"), f.ports)).toContain(
      "friendly character",
    );
  });
  it("rejects repeated or unaffordable We Are Groot costs after hydration", () => {
    const f = fixture();
    grootAddGrowthCounters(f.s, 2);
    expect(() => f.resolve(G("we-are-groot-pay", { amount: 4 }))).toThrow();
    expect(() =>
      f.resolve(
        G("we-are-groot-status", {
          target: "hero",
          chosen: ["hero"],
          remaining: 1,
        }),
      ),
    ).toThrow();
  });
});

describe("Groot obligation and native nemesis clauses", () => {
  it("routes Wilt to the actual Groot owner instead of the revealing player", () => {
    const f = fixture();
    f.addSeat();
    activateSeat(f.s, "p2");
    expect(grootEncounterReveal(f.s, piece("16025"))?.[0]).toMatchObject({
      type: "groot:obligation",
      actorId: "p1",
    });
  });
  it("Wilt permits optional alter-ego change, then removes the exact physical obligation", () => {
    const f = fixture(),
      obligation = piece("16025");
    f.s.resolving.push(obligation);
    f.ports.queue(f.s, ...grootEncounterReveal(f.s, obligation)!);
    f.run();
    f.choose("flip");
    f.reload();
    f.choose("remove");
    expect(f.s.player.form).toBe("alter");
    expect(f.s.player.flipped).toBe(false);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed.map((p) => p.id)).toEqual([obligation.id]);
    expect(f.s.resolving).toEqual([]);
  });
  it.each([1, 2, 3, 5])(
    "Wilt removes as many of its 3 counters as possible from %s without surge",
    (growth) => {
      const f = fixture();
      grootAddGrowthCounters(f.s, growth);
      f.resolve(G("obligation", { piece: piece("16025") }));
      f.choose("stay");
      f.choose("growth");
      expect(grootGrowthCounters(f.s)).toBe(Math.max(0, growth - 3));
      expect(f.native.some((e) => e.type === "dealEncounter")).toBe(false);
    },
  );
  it("Wilt with zero counters deals exactly one facedown encounter, including alter-ego", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.s.player.exhausted = true;
    f.resolve(G("obligation", { piece: piece("16025") }));
    f.run();
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["growth"]);
    f.choose("growth");
    expect(f.native).toEqual([{ type: "dealEncounter", playerId: "p1" }]);
  });
  it("Wilt respects a form change lock without offering the optional flip", () => {
    const f = fixture();
    f.s.flags.formLocked = true;
    f.resolve(G("obligation", { piece: piece("16025") }));
    f.run();
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["growth"]);
  });
  it("Blazing Inferno and an actual Furnax activation deal 2 indirect to every live seat", () => {
    const f = fixture(),
      side = piece("16026"),
      furnax = piece("16027");
    f.addSeat();
    f.s.firstPlayerId = "p2";
    f.s.sideSchemes.push(side);
    f.s.minions.push(furnax);
    for (const effects of [
      grootVillainPhaseBegin(f.s, f.ports),
      grootEnemyActivated(f.s, furnax, f.ports),
    ]) {
      expect(effects.map((e) => e.actorId)).toEqual(["p2", "p1"]);
      expect(
        effects.every((e) => e.type === "indirect" && e.amount === 2),
      ).toBe(true);
    }
    f.s.players[1].eliminated = true;
    expect(grootVillainPhaseBegin(f.s, f.ports)).toHaveLength(1);
  });
  it("nemesis responses cannot resolve from blank or departed sources", () => {
    const f = fixture(),
      side = piece("16026"),
      furnax = piece("16027");
    f.s.sideSchemes.push(side);
    f.s.minions.push(furnax);
    f.s.flags[`blank:${side.id}`] = true;
    f.s.flags[`blank:${furnax.id}`] = true;
    expect(grootVillainPhaseBegin(f.s, f.ports)).toEqual([]);
    expect(grootEnemyActivated(f.s, furnax, f.ports)).toEqual([]);
    delete f.s.flags[`blank:${furnax.id}`];
    f.s.minions = [];
    expect(grootEnemyActivated(f.s, furnax, f.ports)).toEqual([]);
  });
  it.each([
    [false, false, 2],
    [true, false, 3],
    [false, true, 3],
    [true, true, 4],
  ])(
    "Fan the Flames combines actual in-play conditions %s/%s into %s indirect damage",
    (side, minion, amount) => {
      const f = fixture();
      if (side) f.s.sideSchemes.push(piece("16026"));
      if (minion) f.s.minions.push(piece("16027"));
      const treachery = piece("16028");
      f.ports.queue(f.s, ...grootEncounterReveal(f.s, treachery)!);
      f.run();
      expect(f.native).toEqual([
        {
          type: "indirect",
          amount,
          source: treachery.id,
          sourceTitle: "Fan the Flames",
        },
      ]);
    },
  );
  it("nemesis cards have no added reveal or boost ability", () => {
    const f = fixture();
    expect(grootEncounterReveal(f.s, piece("16026"))).toEqual([]);
    expect(grootEncounterReveal(f.s, piece("16027"))).toEqual([]);
    expect(grootEncounterReveal(f.s, piece("01088"))).toBeNull();
    expect(grootBoost(f.s, piece("01088"))).toBeNull();
    for (const code of ["16025", "16026", "16027", "16028"])
      expect(grootBoost(f.s, piece(code))).toEqual([]);
  });
});
