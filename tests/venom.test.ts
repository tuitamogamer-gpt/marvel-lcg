import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";
import {
  VENOM_SCRIPT_CODES,
  resolveVenomEffect,
  venomAbility,
  venomAbilityOptions,
  venomAttackInitiatedOptions,
  venomBasicPowerOptions,
  venomBoost,
  venomEncounterReveal,
  venomEvent,
  venomInitializeNemesis,
  venomPaidOnly,
  venomPhaseEnded,
  venomPlayRestriction,
  venomResourceSources,
  venomResourceSpent,
  venomRestrictedAllowance,
  venomSchemeLocked,
  venomSetup,
  venomShadowOfPast,
  type VenomPorts,
} from "../src/game/venom.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const V = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `venom:${type}`,
  ...args,
});
const reload = (s: GameState): GameState => {
  const result: GameState = JSON.parse(JSON.stringify(s));
  const seat = result.players.find((p) => p.id === result.activePlayerId)!;
  seat.player = result.player;
  seat.flags = result.flags;
  return result;
};
function fixture(team = false) {
  let s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId: "rhino",
    seed: 20001,
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
  // Pure module tests can run before native Venom metadata/engine integration.
  s.phase = "player";
  for (const seat of s.players) seat.mulliganDone = true;
  s.heroId = s.players[0].heroId = "vnm";
  s.player.form = "hero";
  s.player.hp = 12;
  s.player.deck = [];
  s.player.hand = [];
  s.player.discard = [];
  s.player.inPlay = [];
  delete s.player.setAside;
  s.flags = {};
  s.players[0].flags = s.flags;
  s.players[0].player = s.player;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.attack = null;
  s.minions = [];
  s.sideSchemes = [];
  s.resolving = [];
  const piece = (code: string) => ({
    ...makePiece(s, code),
    ownerId: s.activePlayerId,
  });
  const ports: VenomPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: (state) => {
      state.player.form = state.player.form === "hero" ? "alter" : "hero";
    },
    canReadyIdentity: () => true,
    canPay: vi.fn(() => true),
    canGiveStatus: (state, target, status) => {
      const p =
        target === state.villain.id
          ? state.villain
          : state.minions.find((p) => p.id === target);
      return !!p && !p[status];
    },
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some(
        (p) =>
          (p.engagedWith || state.activePlayerId) === state.activePlayerId &&
          cards.get(p.code)?.text?.startsWith("Guard."),
      )
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
      (!thwart ||
        !state.minions.some(
          (p) =>
            (p.engagedWith || state.activePlayerId) === state.activePlayerId &&
            p.code === "20025",
        ))
        ? [{ id: "main", label: "The Break-In!" }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    isTextBlank: (state, p) =>
      !!state.flags[`blank:${p.id}`] ||
      (state.sideSchemes.some((x) => x.code === "12026") &&
        !!cards.get(p.code)?.traits?.includes("Tech")),
    discardHand: (state, id) => {
      const index = state.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Missing hand card");
      state.player.discard.push(state.player.hand.splice(index, 1)[0]);
    },
    discardPiece: (state, id) => {
      const index = state.player.inPlay.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Missing controlled card");
      state.player.discard.push(state.player.inPlay.splice(index, 1)[0]);
    },
    revealHidden: (state) => {
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    },
    recycleEncounter: vi.fn(),
    attackProgram: (state, effects, after) =>
      state.queue.unshift(...effects, ...after),
    log: vi.fn(),
    makePiece: vi.fn((state: GameState, code: string) => ({
      ...makePiece(state, code),
      ownerId: state.activePlayerId,
    })),
    shufflePlayerDeck: vi.fn(),
    shuffleEncounter: vi.fn(),
    discardPlayerTop: vi.fn((state: GameState) => {
      const p = state.player.deck.shift();
      if (!p) return { emptied: true };
      state.player.discard.push(p);
      ports.revealHidden(state);
      const emptied = !state.player.deck.length;
      if (emptied) {
        state.player.deck = state.player.discard.splice(0);
        state.encounter.dealt.push(makePiece(state, "01102"));
      }
      return { piece: p, emptied };
    }),
    cardCost: (_state, p) => cards.get(p.code)?.cost || 0,
    heroMaxHP: () => 12,
    canTakeDamageCost: (state, amount) =>
      amount > 0 &&
      state.player.hp > 0 &&
      !state.player.tough &&
      !state.flags.cannotTake &&
      !state.flags.mandatoryPrevent,
    takeDamageCost: vi.fn((state: GameState, amount: number) => {
      if (!ports.canTakeDamageCost(state, amount)) return false;
      state.player.hp = Math.max(0, state.player.hp - amount);
      return true;
    }),
    damageBatch: vi.fn((state: GameState, ids: string[], amount: number) => {
      // Snapshot all recipients first, then apply one batch before removing any.
      const recipients = state.minions.filter((p) => ids.includes(p.id));
      for (const p of recipients) {
        if (p.tough) p.tough = false;
        else p.damage += amount;
      }
      state.minions = state.minions.filter(
        (p) => p.damage < (cards.get(p.code)?.health || 1),
      );
    }),
    putMinion: vi.fn((state: GameState, p: Piece, playerId: string) => {
      p.engagedWith = playerId;
      state.minions.push(p);
    }),
    putBoostMinion: vi.fn((state: GameState, p: Piece, playerId: string) => {
      p.engagedWith = playerId;
      state.minions.push(p);
      (state.attack!.retainedBoostIds ||= []).push(p.id);
    }),
    cancelVillainAttack: vi.fn((state: GameState, clauses: Effect[]) => {
      state.attack = null;
      state.queue.unshift(...clauses);
    }),
  };
  const choose = (state: GameState, id: string) => {
    const selected = state.prompt!.options.find((o) => o.id === id);
    expect(selected, `Missing choice ${id}`).toBeDefined();
    state.prompt = null;
    state.queue.unshift(...selected!.effects);
  };
  const step = (state: GameState) => {
    const e = state.queue.shift()!;
    expect(e).toBeDefined();
    if (resolveVenomEffect(state, e, ports)) return e;
    switch (e.type) {
      case "draw":
        for (let i = 0; i < e.amount; i++) {
          const p = state.player.deck.shift();
          if (p) state.player.hand.push(p);
        }
        break;
      case "ready":
        if (e.target === "hero") state.player.exhausted = false;
        else
          state.player.inPlay.find((p) => p.id === e.target)!.exhausted = false;
        break;
      case "heal":
        state.player.hp = Math.min(12, state.player.hp + e.amount);
        break;
      case "thwart":
        if (e.target === "main")
          state.scheme.threat = Math.max(0, state.scheme.threat - e.amount);
        else
          state.sideSchemes.find((p) => p.id === e.target)!.counters -=
            e.amount;
        break;
      case "status": {
        const p =
          e.target === state.villain.id
            ? state.villain
            : state.minions.find((p) => p.id === e.target)!;
        p[e.status as "confused" | "stunned"] = true;
        break;
      }
      case "flip":
        state.player.form = "alter";
        break;
      case "discardEncounter":
        state.resolving = state.resolving.filter((p) => p.id !== e.piece.id);
        if (!state.encounter.discard.some((p) => p.id === e.piece.id))
          state.encounter.discard.push(e.piece);
        break;
      case "reveal":
        if (e.piece.code === "20025") {
          e.piece.engagedWith = state.activePlayerId;
          state.minions.push(e.piece);
        } else {
          e.piece.counters =
            cards.get(e.piece.code)!.base_threat! * state.playerCount;
          state.sideSchemes.push(e.piece);
        }
        break;
    }
    return e;
  };
  const attack = (state = s) => {
    state.attack = {
      attacker: state.villain.id,
      base: 2,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
      originalPlayerId: state.activePlayerId,
    };
    return {
      attacker: state.villain.id,
      playerId: state.activePlayerId,
      isVillain: true,
    };
  };
  return { s, ports, piece, choose, step, attack };
}

describe("Venom original identity, signatures and physical nemesis", () => {
  it("uses 14 original dedicated faces and exactly 15 physical signature cards", () => {
    expect(VENOM_SCRIPT_CODES).toHaveLength(14);
    expect(VENOM_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(
      [...cards.values()]
        .filter(
          (c) =>
            c.set_code === "vnm" &&
            c.type_code !== "hero" &&
            c.type_code !== "alter_ego" &&
            c.type_code !== "obligation",
        )
        .reduce((n, c) => n + c.quantity, 0),
    ).toBe(15);
  });
  it.each(["hero", "alter"] as const)(
    "identity keeps one additional general Restricted slot in %s form",
    (form) => {
      const { s } = fixture();
      s.player.form = form;
      expect(venomRestrictedAllowance(s)).toBe(1);
      s.heroId = "rocket";
      expect(venomRestrictedAllowance(s)).toBe(0);
    },
  );
  it("creates four distinct actual nemesis minions and one scheme exactly once", () => {
    const { s, ports } = fixture();
    venomInitializeNemesis(s, ports);
    expect(s.player.setAside!.map((p) => p.code)).toEqual([
      "20024",
      "20025",
      "20025",
      "20025",
      "20025",
    ]);
    expect(new Set(s.player.setAside!.map((p) => p.id)).size).toBe(5);
    s.player.setAside = [];
    venomInitializeNemesis(s, ports);
    expect(s.player.setAside).toEqual([]);
    expect(ports.makePiece).toHaveBeenCalledTimes(5);
  });
  it("does not create a Venom set-aside zone for another identity", () => {
    const { s, ports } = fixture();
    s.heroId = "rocket";
    venomInitializeNemesis(s, ports);
    expect(s.player.setAside).toBeUndefined();
    expect(ports.makePiece).not.toHaveBeenCalled();
  });
  it("Armed and Ready discards actual top cards until a Weapon upgrade, preserving cards after it", () => {
    const { s, ports, piece } = fixture();
    s.player.form = "alter";
    const ordinary = piece("20002"),
      nonUpgradeWeapon = piece("01100"),
      gun = piece("20010"),
      last = piece("20004");
    s.player.deck = [ordinary, nonUpgradeWeapon, gun, last];
    expect(venomSetup(s)).toEqual([V("setup")]);
    resolveVenomEffect(s, V("setup"), ports);
    expect(s.player.hand).toEqual([gun]);
    expect(s.player.discard).toEqual([ordinary, nonUpgradeWeapon]);
    expect(s.player.deck).toEqual([last]);
    expect(ports.discardPlayerTop).toHaveBeenCalledTimes(3);
  });
  it("the last discarded Weapon is moved out of an immediately recycled deck exactly once", () => {
    const { s, ports, piece } = fixture();
    const gun = piece("20008"),
      ordinary = piece("20002");
    s.player.deck = [ordinary, gun];
    resolveVenomEffect(s, V("setup"), ports);
    expect(s.player.hand).toEqual([gun]);
    expect(s.player.deck).toEqual([ordinary]);
    expect(s.player.discard).toEqual([]);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("a search without a Weapon stops at deck exhaustion instead of looping through the recycled deck", () => {
    const { s, ports, piece } = fixture();
    s.player.deck = [piece("20002"), piece("20004")];
    s.player.discard = [piece("20010")];
    resolveVenomEffect(s, V("setup"), ports);
    expect(s.player.hand).toEqual([]);
    expect(ports.discardPlayerTop).toHaveBeenCalledTimes(2);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.deck).toHaveLength(3);
  });
  it("setup with an empty deck does not invent a Weapon or repeatedly recycle", () => {
    const { s, ports } = fixture();
    resolveVenomEffect(s, V("setup"), ports);
    expect(s.player.hand).toEqual([]);
    expect(ports.discardPlayerTop).not.toHaveBeenCalled();
  });
  it("Shadows reveals ALL four actual Symbiotes then Klyntar and shuffles", () => {
    let { s, ports, step } = fixture(true);
    venomInitializeNemesis(s, ports);
    const ids = s.player.setAside!.map((p) => p.id);
    s.queue = venomShadowOfPast(s)!;
    expect(s.player.setAside).toHaveLength(5);
    expect(
      s.queue.filter((e) => e.type === "venom:reveal-setaside"),
    ).toHaveLength(5);
    s = reload(s);
    while (s.queue.length) step(s);
    expect(s.minions.map((p) => p.id)).toEqual(ids.slice(1));
    expect(s.minions.every((p) => p.engagedWith === s.activePlayerId)).toBe(
      true,
    );
    expect(s.sideSchemes[0].id).toBe(ids[0]);
    expect(s.sideSchemes[0].counters).toBe(4);
    expect(s.player.setAside).toEqual([]);
    expect(s.flags.venomReservedNemesis).toBeUndefined();
    expect(ports.shuffleEncounter).toHaveBeenCalledOnce();
    expect(ports.makePiece).toHaveBeenCalledTimes(5);
  });
  it("an obligation removes only one real copy; Shadows reveals the remaining three", () => {
    const { s, ports, piece } = fixture(true);
    venomInitializeNemesis(s, ports);
    const minion = s.player.setAside!.find((p) => p.code === "20025")!;
    const obligation = piece("20023");
    s.firstPlayerId = s.players[1].id;
    resolveVenomEffect(
      s,
      V("obligation-symbiote", { piece: obligation }),
      ports,
    );
    expect(s.minions).toEqual([minion]);
    expect(minion.engagedWith).toBe(s.players[1].id);
    expect(s.player.setAside).toHaveLength(4);
    const effects = venomShadowOfPast(s)!;
    expect(
      effects.filter(
        (e) =>
          e.type === "venom:reveal-setaside" &&
          s.player.setAside!.some((p) => p.id === e.id && p.code === "20025"),
      ),
    ).toHaveLength(3);
    expect(
      effects.some(
        (e) => e.type === "venom:reveal-setaside" && e.id === minion.id,
      ),
    ).toBe(false);
  });
  it("Shadows with no remaining minion still reveals its real scheme and gains surge, without fabricating replacements", () => {
    const { s, ports } = fixture();
    venomInitializeNemesis(s, ports);
    s.player.setAside = s.player.setAside!.filter((p) => p.code === "20024");
    const effects = venomShadowOfPast(s)!;
    expect(effects.map((e) => e.type)).toEqual([
      "venom:reveal-setaside",
      "venom:shuffle-nemesis",
      "surge",
    ]);
    expect(venomShadowOfPast(s)).toEqual([{ type: "surge" }]);
    expect(ports.makePiece).toHaveBeenCalledTimes(5);
  });
  it("a missing migrated physical zone never creates virtual minions during Shadows", () => {
    const { s, ports } = fixture();
    expect(venomShadowOfPast(s)!.at(-1)).toEqual({ type: "surge" });
    expect(ports.makePiece).not.toHaveBeenCalled();
  });
  it("pending Shadows cards remain physical during an entry pause and are reserved from nested obligations", () => {
    let { s, ports, piece, step } = fixture();
    venomInitializeNemesis(s, ports);
    const ids = s.player.setAside!.map((p) => p.id);
    s.queue = venomShadowOfPast(s)!;
    step(s);
    step(s);
    s = reload(s);
    expect(s.minions).toHaveLength(1);
    expect(s.player.setAside).toHaveLength(4);
    const physical = [...s.minions, ...s.player.setAside!];
    for (const id of ids)
      expect(physical.filter((p) => p.id === id)).toHaveLength(1);
    expect(venomShadowOfPast(s)).toEqual([{ type: "surge" }]);
    resolveVenomEffect(
      s,
      V("obligation-symbiote", { piece: piece("20023") }),
      ports,
    );
    expect(s.minions).toHaveLength(1);
    expect(s.queue[0].type).toBe("surge");
    expect(s.player.setAside).toHaveLength(4);
  });
  it("ordinary boost retains this actual Symbiote instead of cloning or discarding it", () => {
    let { s, ports, piece, attack } = fixture();
    attack();
    const actual = piece("20025");
    s.attack!.pendingBoosts = [actual];
    const effects = venomBoost(s, actual)!;
    s = reload(s);
    resolveVenomEffect(s, effects[0], ports);
    expect(s.minions[0].id).toBe(actual.id);
    expect(s.minions[0].engagedWith).toBe(s.activePlayerId);
    expect(s.attack!.retainedBoostIds).toEqual([actual.id]);
    const cleanupDiscard = s.attack!.pendingBoosts!.filter(
      (p) => !s.attack!.retainedBoostIds!.includes(p.id),
    );
    expect(cleanupDiscard).toEqual([]);
    expect(ports.makePiece).not.toHaveBeenCalled();
  });
  it("obligation resolves for Flash's actual owner when another player reveals it", () => {
    const { s, piece } = fixture(true);
    const view = seatView(s, s.players[1]);
    expect(venomEncounterReveal(view, piece("20023"))).toEqual([
      V("obligation", {
        piece: expect.objectContaining({ code: "20023" }),
        actorId: s.players[0].id,
      }),
    ]);
  });
  it("obligation offers an optional free change to alter-ego before its choices", () => {
    let { s, ports, piece, choose, step } = fixture();
    const obligation = piece("20023");
    resolveVenomEffect(s, V("obligation", { piece: obligation }), ports);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["alter", "stay"]);
    s = reload(s);
    choose(s, "alter");
    step(s);
    step(s);
    expect(s.player.form).toBe("alter");
    expect(s.player.flipped).toBe(false);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["exhaust", "symbiote"]);
  });
  it("taking 2 and exhausting Flash DISCARD the actual obligation rather than removing it from the game", () => {
    let { s, ports, piece, step } = fixture();
    s.player.form = "alter";
    const obligation = piece("20023");
    s.resolving = [obligation];
    resolveVenomEffect(
      s,
      V("obligation-exhaust", { piece: obligation }),
      ports,
    );
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(true);
    s = reload(s);
    step(s);
    expect(
      s.encounter.discard.filter((p) => p.id === obligation.id),
    ).toHaveLength(1);
    expect(s.resolving).toEqual([]);
    expect(s.removed).not.toContainEqual(obligation);
  });
  it.each(["tough", "exhausted", "cannotTake", "mandatoryPrevent", "hero"])(
    "obligation refuses an unpayable exhaust/take2 cost (%s) without spending any part",
    (kind) => {
      const { s, ports, piece } = fixture();
      s.player.form = "alter";
      if (kind === "hero") s.player.form = "hero";
      else if (kind === "tough" || kind === "exhausted") s.player[kind] = true;
      else s.flags[kind] = true;
      resolveVenomEffect(
        s,
        V("obligation-choices", { piece: piece("20023") }),
        ports,
      );
      expect(s.prompt!.options.map((o) => o.id)).toEqual(["symbiote"]);
      const before = {
        hp: s.player.hp,
        tough: s.player.tough,
        exhausted: s.player.exhausted,
      };
      expect(() =>
        resolveVenomEffect(
          s,
          V("obligation-exhaust", { piece: piece("20023") }),
          ports,
        ),
      ).toThrow();
      expect({
        hp: s.player.hp,
        tough: s.player.tough,
        exhausted: s.player.exhausted,
      }).toEqual(before);
      expect(ports.takeDamageCost).not.toHaveBeenCalled();
    },
  );
  it("empty set-aside obligation gains surge and discards, preserving the spent zone", () => {
    const { s, ports, piece } = fixture();
    s.player.setAside = [];
    const obligation = piece("20023");
    resolveVenomEffect(
      s,
      V("obligation-symbiote", { piece: obligation }),
      ports,
    );
    expect(s.queue.map((e) => e.type)).toEqual(["surge", "discardEncounter"]);
    expect(ports.putMinion).not.toHaveBeenCalled();
    expect(s.player.setAside).toEqual([]);
  });
});

describe("Venom resource and event timing", () => {
  it("Symbiotic Bond takes its full cost, generates wild once per phase and survives reload", () => {
    let { s, ports } = fixture();
    expect(venomResourceSources(s, ports)[0].resources).toEqual(["wild"]);
    expect(venomResourceSpent(s, "symbiotic-bond", ports)).toBe(true);
    expect(s.player.hp).toBe(11);
    expect(venomResourceSources(s, ports)).toEqual([]);
    s = reload(s);
    expect(() => venomResourceSpent(s, "symbiotic-bond", ports)).toThrow();
    s.phase = "villain";
    expect(venomResourceSources(s, ports)).toHaveLength(1);
    venomResourceSpent(s, "symbiotic-bond", ports);
    expect(s.player.hp).toBe(10);
    venomPhaseEnded(s);
    expect(s.flags.venomBondPhase).toBeUndefined();
  });
  it.each(["tough", "cannotTake", "mandatoryPrevent", "alter", "otherHero"])(
    "Symbiotic Bond does not partially pay through %s",
    (kind) => {
      const { s, ports } = fixture();
      if (kind === "tough") s.player.tough = true;
      else if (kind === "alter") s.player.form = "alter";
      else if (kind === "otherHero") s.heroId = "rocket";
      else s.flags[kind] = true;
      expect(venomResourceSources(s, ports)).toEqual([]);
      expect(() => venomResourceSpent(s, "symbiotic-bond", ports)).toThrow();
      expect(s.player.hp).toBe(12);
      expect(s.flags.venomBondPhase).toBeUndefined();
      expect(ports.takeDamageCost).not.toHaveBeenCalled();
      if (kind === "tough") expect(s.player.tough).toBe(true);
    },
  );
  it("a failed native damage-cost commit cannot spend the phase limit", () => {
    const { s, ports } = fixture();
    ports.takeDamageCost = () => false;
    expect(() => venomResourceSpent(s, "symbiotic-bond", ports)).toThrow();
    expect(s.flags.venomBondPhase).toBeUndefined();
    expect(venomResourceSpent(s, "other", ports)).toBe(false);
  });
  it.each(["mental", "physical", "energy"] as Resource[])(
    "only-%s bonus requires a nonempty actual payment of that type",
    (type) => {
      expect(venomPaidOnly([type, type], type)).toBe(true);
      expect(venomPaidOnly([], type)).toBe(false);
      expect(venomPaidOnly([type, "wild"], type)).toBe(false);
      expect(
        venomPaidOnly(
          [type, type, type === "mental" ? "energy" : "mental"],
          type,
        ),
      ).toBe(false);
    },
  );
  it("Behind Enemy Lines removes threat before its independently selected confusion", () => {
    const { s, ports, piece, step } = fixture();
    s.scheme.threat = 4;
    const effects = venomEvent(s, piece("20002"), ["mental", "mental"])!;
    resolveVenomEffect(s, effects[0], ports);
    expect(s.queue.map((e) => e.type)).toEqual([
      "thwart",
      "venom:behind-confuse",
    ]);
    step(s);
    expect(s.scheme.threat).toBe(1);
    step(s);
    step(s);
    expect(s.villain.confused).toBe(true);
  });
  it("a mixed Behind Enemy Lines payment omits its bonus; an already-confused enemy is not a useful bonus target", () => {
    const { s, ports, piece } = fixture();
    s.scheme.threat = 4;
    resolveVenomEffect(
      s,
      venomEvent(s, piece("20002"), ["mental", "energy"])![0],
      ports,
    );
    expect(s.queue.map((e) => e.type)).toEqual(["thwart"]);
    s.queue = [];
    s.villain.confused = true;
    resolveVenomEffect(s, V("behind-confuse"), ports);
    expect(s.queue).toEqual([]);
  });
  it.each(
    ([["energy", "energy"], ["energy", "mental"], []] as Resource[][]).map(
      (paid) => ({ paid }),
    ),
  )(
    "Savage Attack gives Overkill only for actual all-energy payment $paid",
    ({ paid }) => {
      const { s, piece } = fixture();
      const effect = venomEvent(s, piece("20006"), paid)![0];
      expect(effect.attack).toBe(true);
      expect(effect.action.amount).toBe(5);
      expect(effect.action.overkill).toBe(
        paid.length > 0 && paid.every((r) => r === "energy"),
      );
    },
  );
  it("Locked and Loaded searches only actual deck Weapon upgrades and shuffles after the chosen card", () => {
    let { s, ports, piece, step } = fixture();
    s.player.form = "alter";
    const first = piece("20010"),
      second = piece("20008"),
      discarded = piece("16005");
    s.player.deck = [piece("01100"), first, second];
    s.player.discard = [discarded];
    resolveVenomEffect(s, V("loaded"), ports);
    expect(s.prompt!.options.map((o) => o.id)).toEqual([first.id, second.id]);
    s = reload(s);
    s.queue = s.prompt!.options[1].effects;
    s.prompt = null;
    step(s);
    expect(s.player.hand).toEqual([second]);
    expect(s.player.discard).toEqual([discarded]);
    expect(s.player.deck).toContainEqual(first);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    expect(() =>
      resolveVenomEffect(s, V("loaded-take", { target: discarded.id }), ports),
    ).toThrow();
  });
  it("Locked and Loaded shuffles a searched deck even when no Weapon is found", () => {
    const { s, ports, piece } = fixture();
    s.player.deck = [piece("20002")];
    resolveVenomEffect(s, V("loaded"), ports);
    expect(s.player.hand).toEqual([]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("Run and Gun readies the identity and own Weapon upgrades, not other cards or another player's Weapon", () => {
    const { s, ports, piece, step } = fixture(true);
    const pistol = piece("20010"),
      multi = piece("20008"),
      rebirth = piece("20007"),
      attachment = piece("01100"),
      other = piece("20010");
    s.player.inPlay = [pistol, multi, rebirth, attachment];
    s.players[1].player.inPlay = [other];
    for (const p of [...s.player.inPlay, other]) p.exhausted = true;
    s.player.exhausted = true;
    resolveVenomEffect(s, V("run"), ports);
    while (s.queue.length) step(s);
    expect(s.player.exhausted).toBe(false);
    expect(pistol.exhausted).toBe(false);
    expect(multi.exhausted).toBe(false);
    expect(rebirth.exhausted).toBe(true);
    expect(attachment.exhausted).toBe(true);
    expect(other.exhausted).toBe(true);
  });
  it("Hero events reject alter-ego, while Locked and Loaded is an ordinary Action", () => {
    const { s, piece } = fixture();
    s.player.form = "alter";
    for (const code of ["20002", "20003", "20005", "20006"])
      expect(venomPlayRestriction(s, piece(code))).toContain("hero form");
    expect(venomPlayRestriction(s, piece("20004"))).toBeNull();
  });
});

describe("Venom upgrade powers and native attack window contracts", () => {
  it("Project Rebirth offers draw/heal in alter-ego, commits exhaustion and caps healing", () => {
    const { s, ports, piece, step } = fixture();
    const support = piece("20007");
    s.player.inPlay = [support];
    s.player.deck = [piece("20002")];
    s.player.form = "alter";
    s.player.hp = 11;
    expect(venomAbilityOptions(s, support.id, ports).map((o) => o.id)).toEqual([
      "rebirth-draw",
      "rebirth-heal",
    ]);
    const effects = venomAbility(s, support.id, "rebirth-heal", ports)!;
    resolveVenomEffect(s, effects[0], ports);
    step(s);
    expect(s.player.hp).toBe(12);
    expect(support.exhausted).toBe(true);
    expect(venomAbilityOptions(s, support.id, ports)).toEqual([]);
    support.exhausted = false;
    expect(venomAbilityOptions(s, support.id, ports).map((o) => o.id)).toEqual([
      "rebirth-draw",
    ]);
    s.player.form = "hero";
    expect(venomAbilityOptions(s, support.id, ports)).toEqual([]);
  });
  it("Multi-Gun's single-target damage ignores Guard and Stun because it is not an attack", () => {
    const { s, ports, piece } = fixture();
    const gun = piece("20008"),
      guard = piece("20025");
    s.player.inPlay = [gun];
    s.minions = [guard];
    s.player.stunned = true;
    resolveVenomEffect(s, V("multi", { id: gun.id, mode: "damage" }), ports);
    expect(s.prompt!.options.map((o) => o.id)).toContain(s.villain.id);
    expect(s.prompt!.options[0].effects[0]).toMatchObject({
      type: "damage",
      amount: 2,
    });
    expect(s.prompt!.options[0].effects[0].attack).toBeUndefined();
    expect(gun.exhausted).toBe(true);
    expect(s.player.stunned).toBe(true);
  });
  it("Multi-Gun damages all of one chosen player's minions as one simultaneous non-attack batch", () => {
    let { s, ports, piece, choose, step } = fixture(true);
    const gun = piece("20008"),
      own1 = piece("20025"),
      own2 = piece("20025"),
      other = piece("20025");
    s.player.inPlay = [gun];
    own1.engagedWith = own2.engagedWith = s.players[0].id;
    other.engagedWith = s.players[1].id;
    own2.tough = true;
    s.minions = [own1, own2, other];
    resolveVenomEffect(s, V("multi", { id: gun.id, mode: "minions" }), ports);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(
      s.players.map((p) => p.id),
    );
    s = reload(s);
    choose(s, s.players[0].id);
    step(s);
    expect(ports.damageBatch).toHaveBeenCalledWith(
      s,
      [own1.id, own2.id],
      1,
      "20008",
    );
    expect(s.minions[0].damage).toBe(1);
    expect(s.minions[1].tough).toBe(false);
    expect(s.minions[1].damage).toBe(0);
    expect(s.minions[2].damage).toBe(0);
  });
  it("Multi-Gun scheme removal ignores Confuse and Patrol, but obeys Crisis", () => {
    const { s, ports, piece, step } = fixture();
    const gun = piece("20008");
    s.player.inPlay = [gun];
    s.player.confused = true;
    s.scheme.threat = 4;
    s.minions = [piece("20025")];
    resolveVenomEffect(s, V("multi", { id: gun.id, mode: "threat" }), ports);
    expect(s.queue[0]).toMatchObject({
      type: "thwart",
      target: "main",
      amount: 2,
      action: false,
    });
    step(s);
    expect(s.scheme.threat).toBe(2);
    expect(s.player.confused).toBe(true);
    gun.exhausted = false;
    const crisis = piece("01108");
    crisis.counters = 2;
    s.sideSchemes = [crisis];
    resolveVenomEffect(s, V("multi", { id: gun.id, mode: "threat" }), ports);
    expect(s.queue[0].target).toBe(crisis.id);
  });
  it("Klyntar locks any threat removal while any Symbiote enemy is in play, including another player's minion", () => {
    const { s, ports, piece } = fixture(true);
    const scheme = piece("20024"),
      minion = piece("20025"),
      gun = piece("20008");
    scheme.counters = 4;
    minion.engagedWith = s.players[1].id;
    s.sideSchemes = [scheme];
    s.minions = [minion];
    s.player.inPlay = [gun];
    s.scheme.threat = 0;
    expect(venomSchemeLocked(s, scheme.id)).toBe(true);
    expect(
      venomAbilityOptions(s, gun.id, ports).map((o) => o.id),
    ).not.toContain("multi-threat");
    s.flags[`blank:${minion.id}`] = true;
    expect(venomSchemeLocked(s, scheme.id)).toBe(true);
    s.minions = [];
    expect(venomSchemeLocked(s, scheme.id)).toBe(false);
    expect(venomAbilityOptions(s, gun.id, ports).map((o) => o.id)).toContain(
      "multi-threat",
    );
  });
  it("the hero or friendly Symbiote ally does not lock Klyntar", () => {
    const { s, piece } = fixture();
    const scheme = piece("20024");
    s.sideSchemes = [scheme];
    s.player.inPlay = [piece("20010")];
    expect(venomSchemeLocked(s, scheme.id)).toBe(false);
  });
  it("Tech Theft blanks Multi-Gun and Pistols, but does not remove Weapon traits from Run and Gun", () => {
    const { s, ports, piece } = fixture();
    const gun = piece("20008"),
      pistol = piece("20010");
    s.player.inPlay = [gun, pistol];
    s.sideSchemes = [piece("12026")];
    expect(venomAbilityOptions(s, gun.id, ports)).toEqual([]);
    expect(venomBasicPowerOptions(s, "attack", [], ports)).toEqual([]);
    pistol.exhausted = true;
    resolveVenomEffect(s, V("run"), ports);
    expect(
      s.queue.some((e) => e.type === "ready" && e.target === pistol.id),
    ).toBe(true);
  });
  it.each(["attack", "thwart"] as const)(
    "two actual Pistols add +2 to just the saved basic %s use, across reload",
    (power) => {
      let { s, ports, piece, choose, step } = fixture();
      const first = piece("20010"),
        second = piece("20010");
      s.player.inPlay = [first, second];
      const after = [
        {
          type: "basicPower",
          power,
          amount: power === "attack" ? 2 : 1,
          basicStatAmount: power === "attack" ? 2 : 1,
          venomBasicHandled: true,
        },
      ];
      resolveVenomEffect(
        s,
        venomBasicPowerOptions(s, power, after, ports)[0].effects[0],
        ports,
      );
      expect(s.prompt!.options.map((o) => o.id)).toEqual([
        second.id,
        "continue",
      ]);
      s = reload(s);
      choose(s, second.id);
      step(s);
      expect(s.player.inPlay.every((p) => p.exhausted)).toBe(true);
      expect(s.queue[0].amount).toBe((power === "attack" ? 2 : 1) + 2);
      expect(s.queue[0].venomBasicBonus).toBe(2);
      expect(s.queue[0].basicStatAmount).toBe(power === "attack" ? 2 : 1);
    },
  );
  it("a Pistol defense bonus belongs to the current basic defense and can stack both copies", () => {
    const { s, ports, piece, attack, choose, step } = fixture();
    attack();
    const first = piece("20010"),
      second = piece("20010");
    s.player.inPlay = [first, second];
    s.attack!.basicDefense = true;
    s.attack!.defender = "hero";
    const after = [{ type: "boostAttack", venomPistolHandled: true }];
    resolveVenomEffect(
      s,
      venomBasicPowerOptions(s, "defense", after, ports)[0].effects[0],
      ports,
    );
    choose(s, second.id);
    step(s);
    expect(s.attack!.defenseBonus).toBe(2);
    expect(s.queue).toEqual(after);
  });
  it.each(["alter", "stun", "confuse", "allyDefense", "eventDefense"])(
    "Pistols do not apply to replaced or non-hero basic powers (%s)",
    (kind) => {
      const { s, ports, piece, attack } = fixture();
      s.player.inPlay = [piece("20010")];
      attack();
      let power: "attack" | "thwart" | "defense" = "attack";
      if (kind === "alter") s.player.form = "alter";
      if (kind === "stun") s.player.stunned = true;
      if (kind === "confuse") {
        s.player.confused = true;
        power = "thwart";
      }
      if (kind === "allyDefense" || kind === "eventDefense") {
        power = "defense";
        s.attack!.defender = kind === "allyDefense" ? "ally-id" : "hero";
        s.attack!.basicDefense = kind === "allyDefense";
      }
      expect(venomBasicPowerOptions(s, power, [], ports)).toEqual([]);
    },
  );
  it("Spider-Sense draws before the repeated initiation window, making a newly drawn Tendrils playable", () => {
    let { s, ports, piece, attack, step } = fixture();
    const sense = piece("20009"),
      tendrils = piece("20003");
    s.player.inPlay = [sense];
    s.player.deck = [tendrils];
    const snapshot = attack();
    const after = [{ type: "boostAttack" }];
    const options = venomAttackInitiatedOptions(s, snapshot, after, ports);
    expect(options.map((o) => o.id)).toEqual([sense.id]);
    resolveVenomEffect(s, options[0].effects[0], ports);
    step(s);
    s = reload(s);
    step(s);
    expect(s.player.hand[0].id).toBe(tendrils.id);
    expect(s.prompt!.options.map((o) => o.id)).toEqual([
      tendrils.id,
      "continue",
    ]);
    expect(sense.exhausted).toBe(false);
    expect(s.prompt!.options[0].effects[0]).toMatchObject({
      type: "payRequest",
      piece: { id: tendrils.id },
      cost: 2,
      cancelable: true,
      after: [{ type: "resolveHandEvent", id: tendrils.id, continuation: [] }],
    });
  });
  it("each Spider-Sense copy may draw once per attack and is available for the next attack", () => {
    const { s, ports, piece, attack } = fixture();
    const sense = piece("20009");
    s.player.inPlay = [sense];
    s.player.deck = [piece("20002")];
    const snapshot = attack();
    expect(
      venomAttackInitiatedOptions(
        s,
        { ...snapshot, usedIds: [sense.id] },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(venomAttackInitiatedOptions(s, snapshot, [], ports)).toHaveLength(1);
  });
  it("Spider-Sense returns to the complete native shared initiation window after drawing", () => {
    const { s, ports, piece, attack } = fixture();
    const sense = piece("20009");
    s.player.inPlay = [sense];
    s.player.deck = [piece("20003")];
    const snapshot = {
      ...attack(),
      sharedWindow: {
        type: "enemyAttackInitiationWindow",
        attacker: s.villain.id,
        playerId: s.activePlayerId,
        isVillain: true,
        modifier: -3,
        draxPackSubdues: ["paid-subdue"],
        usedIds: [],
      },
    };
    resolveVenomEffect(
      s,
      venomAttackInitiatedOptions(s, snapshot, [], ports)[0].effects[0],
      ports,
    );
    expect(s.queue).toEqual([
      { type: "draw", amount: 1 },
      { ...snapshot.sharedWindow, usedIds: [sense.id] },
    ]);
    expect(JSON.parse(JSON.stringify(s.queue))).toEqual(s.queue);
  });
  it.each(["minion", "otherPlayer", "alter", "noFunds"])(
    "initiation interrupts require the initial villain attack against this hero (%s)",
    (kind) => {
      const { s, ports, piece, attack } = fixture();
      s.player.hand = [piece("20003")];
      s.player.inPlay = [piece("20009")];
      s.player.deck = [piece("20002")];
      const snapshot = attack();
      if (kind === "minion") snapshot.isVillain = false;
      if (kind === "otherPlayer") snapshot.playerId = "p2";
      if (kind === "alter") s.player.form = "alter";
      if (kind === "noFunds") {
        ports.canPay = () => false;
        s.player.inPlay = [];
      }
      expect(venomAttackInitiatedOptions(s, snapshot, [], ports)).toEqual([]);
    },
  );
  it.each(
    (
      [["physical", "physical"], ["physical", "energy"], []] as Resource[][]
    ).map((paid) => ({ paid })),
  )(
    "Tendrils passes cancellation and only-physical stun clauses to native defense completion ($paid)",
    ({ paid }) => {
      const { s, ports, piece, attack } = fixture();
      attack();
      const villain = s.villain.id;
      resolveVenomEffect(s, venomEvent(s, piece("20003"), paid)![0], ports);
      expect(s.attack).toBeNull();
      expect(s.player.exhausted).toBe(false);
      expect(ports.cancelVillainAttack).toHaveBeenCalledWith(
        s,
        paid.length && paid.every((r) => r === "physical")
          ? [{ type: "status", target: villain, status: "stunned" }]
          : [],
      );
    },
  );
  it("Tendrils refuses an absent, minion or other-player attack rather than canceling it", () => {
    const { s, ports, attack } = fixture();
    expect(() => resolveVenomEffect(s, V("tendrils"), ports)).toThrow();
    attack();
    s.attack!.isVillain = false;
    expect(() => resolveVenomEffect(s, V("tendrils"), ports)).toThrow();
    s.attack!.isVillain = true;
    s.attack!.originalPlayerId = "p2";
    expect(() => resolveVenomEffect(s, V("tendrils"), ports)).toThrow();
    expect(ports.cancelVillainAttack).not.toHaveBeenCalled();
  });
});
