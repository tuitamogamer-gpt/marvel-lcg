import { describe, expect, it, vi } from "vitest";
import { card } from "../src/game/cards";
import { makePiece, newGame } from "../src/game/engine";
import { activateSeat, seatView } from "../src/game/team";
import { compileCardScript } from "../src/game/scripts/compiler";
import catalog from "../src/data/catalog-cards.json";
import type { Card, Effect, GameState, Piece } from "../src/game/types";
import {
  BLACK_WIDOW_COMPILED_CODES,
  BLACK_WIDOW_CORE_ALIASES,
  BLACK_WIDOW_SCRIPT_CODES,
  blackWidowAbilityOptions,
  blackWidowAllyDefeated,
  blackWidowAllyDiscount,
  blackWidowAllyEnter,
  blackWidowAttackResponses,
  blackWidowBoost,
  blackWidowBoostOptions,
  blackWidowCardPlayed,
  blackWidowDamageOptions,
  blackWidowEncounterReveal,
  blackWidowEnemyModifier,
  blackWidowEvent,
  blackWidowMinionEntered,
  blackWidowMinionSchemed,
  blackWidowPlayRestriction,
  blackWidowPreparationResolved,
  blackWidowResourceSources,
  blackWidowResourceSpent,
  blackWidowRevealOptions,
  blackWidowStats,
  blackWidowSurgeOptions,
  blackWidowThreatOptions,
  resolveBlackWidowEffect,
  type BlackWidowPorts,
} from "../src/game/black-widow";

function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 81,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "she_hulk", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  s.heroId = s.players[0].heroId = "black_widow";
  s.phase = "player";
  s.prompt = null;
  s.queue = [];
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.inPlay = [];
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
  }
  const ports: BlackWidowPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    discardPiece: (state, id) => {
      const index = state.player.inPlay.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Not controlled");
      state.player.discard.push(state.player.inPlay.splice(index, 1)[0]);
    },
    shufflePlayerDeck: vi.fn(),
    revealHidden: vi.fn((state: GameState) => {
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    }),
    canChangeForm: () => true,
    flip: vi.fn((state: GameState) => {
      state.player.form = state.player.form === "hero" ? "alter" : "hero";
    }),
    canReadyIdentity: () => true,
    identityHasTrait: (state, id, t) => {
      const view = seatView(state, id);
      const code =
        view.heroId === "black_widow"
          ? `08001${view.player.form === "hero" ? "a" : "b"}`
          : "01001a";
      return (card(code).traits || "").split(/\.\s*/).includes(t);
    },
    enemyTargets: (state) =>
      [state.villain, ...state.minions].map((p) => ({
        id: p.id,
        code: p.code,
        label: card(p).name,
      })),
    attackProgram: vi.fn(
      (state: GameState, effects: Effect[], after: Effect[]) => {
        state.queue.unshift(...effects, ...after);
      },
    ),
    numericBoostIcons: (_, id) => (id === "numeric" ? 2 : 0),
    cancelBoostIcons: vi.fn(() => 2),
    hasBoostAbility: (_, id) => id === "star",
    cancelBoostAbility: vi.fn(),
    cancelEncounter: vi.fn(),
    revealReplacement: vi.fn(),
    preventDamage: vi.fn(),
    returnDefeatedAlly: vi.fn(
      (
        state: GameState,
        id: string,
        _playerId: string,
        damage: number,
        after: Effect[],
      ) => {
        const index = state.player.discard.findIndex((p) => p.id === id);
        const p = state.player.discard.splice(index, 1)[0];
        Object.assign(p, {
          exhausted: false,
          damage,
          counters: 0,
          stunned: false,
          confused: false,
          tough: false,
        });
        state.player.inPlay.push(p);
        state.queue.unshift(...after);
      },
    ),
    activationModifier: vi.fn(),
    log: vi.fn(),
  };
  const play = (code: string, playerId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = playerId;
    seatView(s, playerId).player.inPlay.push(p);
    return p;
  };
  const minion = (code = "08026") => {
    const p = makePiece(s, code);
    p.engagedWith = s.activePlayerId;
    s.minions.push(p);
    return p;
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    expect(resolveBlackWidowEffect(s, e, ports)).toBe(true);
  };
  const choose = (id: string) => {
    const o = s.prompt?.options.find((o) => o.id === id);
    expect(o).toBeTruthy();
    s.prompt = null;
    s.queue.unshift(...o!.effects);
  };
  const next = () => run(s.queue.shift()!);
  return { s, ports, play, minion, run, choose, next };
}

describe("Black Widow's complete retail product contracts", () => {
  it("assigns all34 faces exactly once to explicit hooks, exact Core aliases or executable compiler programs", () => {
    const source = (catalog as unknown as Card[]).filter(
      (c) => c.pack_code === "bkw",
    );
    const codes = [
      ...BLACK_WIDOW_SCRIPT_CODES,
      ...BLACK_WIDOW_CORE_ALIASES,
      ...BLACK_WIDOW_COMPILED_CODES,
    ];
    expect(source).toHaveLength(34);
    expect(new Set(codes).size).toBe(34);
    expect(codes.slice().sort()).toEqual(source.map((c) => c.code).sort());
    for (const c of BLACK_WIDOW_CORE_ALIASES)
      expect(compileCardScript(card(c)).implementation).toBe("core");
    for (const c of BLACK_WIDOW_COMPILED_CODES)
      expect(compileCardScript(card(c)).implementation).toBe("script");
    expect(card("08026").boost_star).toBe(true);
    for (const c of ["08025", "08027", "08029"])
      expect(card(c).boost_star).toBeFalsy();
  });
  it("keeps unknown ability and encounter faces outside this module", () => {
    const { s, ports } = fixture();
    expect(blackWidowEvent(s, makePiece(s, "08003"))).toBeNull();
    expect(blackWidowEncounterReveal(s, makePiece(s, "01099"))).toBeNull();
    expect(resolveBlackWidowEffect(s, { type: "thor:dance" }, ports)).toBe(
      false,
    );
    expect(() =>
      resolveBlackWidowEffect(s, { type: "bw:invented" }, ports),
    ).toThrow("Unimplemented");
  });
  it("Synth-Suit grants DEF only to Black Widow's hero form", () => {
    const { s, play } = fixture();
    play("08009");
    expect(blackWidowStats(s).defense).toBe(1);
    s.player.form = "alter";
    expect(blackWidowStats(s).defense).toBe(0);
    s.player.form = "hero";
    s.heroId = "spider_man";
    expect(blackWidowStats(s).defense).toBe(0);
  });
  it("Winter Soldier discounts every controlled Preparation in either form, without counting other upgrades", () => {
    const { s, play } = fixture();
    play("08006");
    play("08017");
    play("08009");
    s.player.form = "alter";
    expect(blackWidowAllyDiscount(s, card("08002"))).toBe(2);
    expect(blackWidowAllyDiscount(s, card("08011"))).toBe(0);
  });
  it("Spy play restrictions accept a Spy ally, while Quincarrier requires the current Avenger identity", () => {
    const { s, ports, play } = fixture();
    expect(
      blackWidowPlayRestriction(s, makePiece(s, "08023"), ports),
    ).toBeNull();
    s.player.form = "alter";
    expect(
      blackWidowPlayRestriction(s, makePiece(s, "08023"), ports),
    ).toContain("current identity");
    s.heroId = "she_hulk";
    ports.identityHasTrait = () => false;
    expect(
      blackWidowPlayRestriction(s, makePiece(s, "08018"), ports),
    ).toContain("Spy character");
    play("08011");
    expect(
      blackWidowPlayRestriction(s, makePiece(s, "08018"), ports),
    ).toBeNull();
    expect(
      blackWidowPlayRestriction(s, makePiece(s, "08033"), ports),
    ).toBeNull();
  });
  it("enforces each printed maximum-one preparation without incorrectly limiting ordinary duplicates", () => {
    const { s, ports, play } = fixture();
    for (const code of ["08017", "08024", "08030", "08031", "08032"]) {
      play(code);
      expect(blackWidowPlayRestriction(s, makePiece(s, code), ports)).toContain(
        "maximum-one",
      );
    }
    play("08010");
    expect(
      blackWidowPlayRestriction(s, makePiece(s, "08010"), ports),
    ).toBeNull();
  });
  it("Gauntlets pay only for Preparation cards; Quincarrier remains available in alter ego after legal play", () => {
    const { s, play } = fixture();
    const glove = play("08007"),
      carrier = play("08023");
    s.player.form = "alter";
    expect(blackWidowResourceSources(s, "08006").map((p) => p.id)).toEqual([
      glove.id,
      carrier.id,
    ]);
    expect(blackWidowResourceSources(s, "08004").map((p) => p.id)).toEqual([
      carrier.id,
    ]);
    expect(blackWidowResourceSources(s).map((p) => p.id)).toEqual([carrier.id]);
    expect(() => blackWidowResourceSpent(s, glove, "08004")).toThrow(
      "Preparation",
    );
    glove.exhausted = carrier.exhausted = true;
    expect(blackWidowResourceSources(s, "08006")).toEqual([]);
  });
  it("Mission Prep is optional and consumes only an accepted once-per-phase response", () => {
    const { s, run } = fixture();
    s.player.form = "alter";
    s.player.deck = [makePiece(s, "08020")];
    const p = makePiece(s, "08010");
    const response = blackWidowCardPlayed(s, p)[0];
    expect(response.type).toBe("optional");
    expect(blackWidowCardPlayed(s, p)).toHaveLength(1);
    run(response.effects[0]);
    expect(s.queue).toEqual([{ type: "draw", amount: 1 }]);
    expect(blackWidowCardPlayed(s, p)).toEqual([]);
    s.phase = "villain";
    expect(blackWidowCardPlayed(s, p)).toHaveLength(1);
    expect(blackWidowCardPlayed(s, makePiece(s, "08009"))).toEqual([]);
  });
  it("Safe House selects the physical discarded Preparation before paying its exhaust cost", () => {
    const { s, play, run, choose, next } = fixture();
    s.player.form = "alter";
    const house = play("08005"),
      p = makePiece(s, "08006");
    s.player.discard = [p, makePiece(s, "08020")];
    run(blackWidowAbilityOptions(s, house.id)[0].effects[0]);
    expect(house.exhausted).toBe(false);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([p.id]);
    choose(p.id);
    next();
    expect(house.exhausted).toBe(true);
    expect(s.player.hand).toEqual([p]);
    expect(s.player.discard.map((p) => p.code)).toEqual(["08020"]);
  });
  it("Coulson's optional search preserves instance identity, marks hidden information and shuffles after a discard-pile selection", () => {
    const { s, ports, play, run, choose, next } = fixture();
    const coulson = play("08011"),
      p = makePiece(s, "08017"),
      other = makePiece(s, "08006");
    s.player.discard = [p];
    s.player.deck = [other, makePiece(s, "08020")];
    const entry = blackWidowAllyEnter(s, coulson)![0];
    expect(entry.type).toBe("optional");
    run(entry.effects[0]);
    expect(ports.revealHidden).toHaveBeenCalledOnce();
    expect(s.prompt?.options.map((o) => o.id)).toEqual([other.id, p.id]);
    choose(p.id);
    next();
    expect(s.player.hand).toEqual([p]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("each Dance of Death attack has its own target and complete native attack boundary", () => {
    const { s, ports, minion, run, choose, next } = fixture();
    const m = minion();
    run(blackWidowEvent(s, makePiece(s, "08004"))![0]);
    choose(m.id);
    next();
    expect(ports.attackProgram).toHaveBeenLastCalledWith(
      s,
      [
        expect.objectContaining({
          type: "damage",
          amount: 1,
          target: m.id,
          attack: true,
        }),
      ],
      [{ type: "bw:dance", step: 1, initiated: true }],
    );
    s.queue = [];
    run({ type: "bw:dance", step: 1 });
    choose(s.villain.id);
    next();
    expect(ports.attackProgram).toHaveBeenLastCalledWith(
      s,
      [expect.objectContaining({ amount: 2, target: s.villain.id })],
      [{ type: "bw:dance", step: 2, initiated: true }],
    );
  });
  it("Stunned replaces only the first Dance attack; later attacks still resolve", () => {
    const { s, ports, run, next, choose } = fixture();
    s.player.stunned = true;
    s.player.stunCards = 1;
    run({ type: "bw:dance", step: 0 });
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(0);
    expect(ports.attackProgram).not.toHaveBeenCalled();
    next();
    choose(s.villain.id);
    next();
    expect(ports.attackProgram).toHaveBeenCalledWith(
      s,
      [expect.objectContaining({ amount: 2 })],
      [{ type: "bw:dance", step: 2, initiated: true }],
    );
  });
  it("an already-initiated Dance keeps resolving if an intervening effect changes identity form", () => {
    const { s, run } = fixture();
    s.player.form = "alter";
    expect(() => run({ type: "bw:dance", step: 0 })).toThrow("hero form");
    run({ type: "bw:dance", step: 1, initiated: true });
    expect(s.prompt?.text).toContain("attack 2");
  });
  it("Attacrobatics requires numeric icons, retains a canceled-star window and binds a foreign-seat continuation", () => {
    const { s, ports, play, run } = fixture(true);
    const p = play("08006", "p2"),
      numeric = { ...makePiece(s, "08026"), id: "numeric" };
    expect(
      blackWidowBoostOptions(
        s,
        { ...numeric, id: "star" },
        "interrupt",
        [],
        ports,
      ),
    ).toEqual([]);
    const o = blackWidowBoostOptions(
      s,
      numeric,
      "interrupt",
      [{ type: "fixture-resume" }],
      ports,
    )[0];
    expect(o.effects[0].actorId).toBe("p2");
    run(o.effects[0]);
    expect(s.player.discard.some((other) => other.id === p.id)).toBe(true);
    expect(ports.cancelBoostIcons).toHaveBeenCalledWith(s, "numeric");
    expect(ports.attackProgram).toHaveBeenCalledWith(
      s,
      [expect.objectContaining({ amount: 2, attack: true })],
      [
        expect.objectContaining({
          type: "bw:after-preparation",
          after: [{ type: "fixture-resume", actorId: "p1" }],
        }),
      ],
    );
  });
  it("Stunned still pays the preparation discard cost but cancels icons/damage and all preparation followers", () => {
    const { s, ports, play, run } = fixture();
    const p = play("08006");
    s.player.stunned = true;
    const o = blackWidowBoostOptions(
      s,
      { ...makePiece(s, "08026"), id: "numeric" },
      "interrupt",
      [{ type: "resume" }],
      ports,
    )[0];
    run(o.effects[0]);
    expect(s.player.discard).toEqual([p]);
    expect(s.player.stunned).toBe(false);
    expect(ports.cancelBoostIcons).not.toHaveBeenCalled();
    expect(s.queue).toEqual([{ type: "resume", actorId: "p1" }]);
  });
  it("Target Acquired independently cancels a pending boost ability without canceling numeric icons", () => {
    const { s, ports, play, run } = fixture();
    play("08024");
    const boost = { ...makePiece(s, "08026"), id: "star" };
    run(blackWidowBoostOptions(s, boost, "response", [], ports)[0].effects[0]);
    expect(ports.cancelBoostAbility).toHaveBeenCalledWith(s, "star");
    expect(ports.cancelBoostIcons).not.toHaveBeenCalled();
    expect(s.queue[0].type).toBe("bw:after-preparation");
  });
  it("Spycraft applies in alter ego and reveals a replacement only after the canceled ability finishes", () => {
    const { s, ports, play, run, next } = fixture();
    s.player.form = "alter";
    play("08018");
    play("08008");
    const encounter = makePiece(s, "08026");
    const options = blackWidowRevealOptions(s, encounter, "p1", [
      { type: "old-reveal" },
    ]);
    expect(options).toHaveLength(1);
    run(options[0].effects[0]);
    expect(ports.cancelEncounter).toHaveBeenCalledWith(s, encounter);
    next();
    next();
    expect(ports.revealReplacement).toHaveBeenCalledWith(s, "p1");
    expect(s.queue).toEqual([]);
  });
  it("Grappling Hook only cancels a locally revealed treachery in hero form, without revealing a replacement", () => {
    const { s, ports, play, run } = fixture(true);
    play("08008");
    expect(blackWidowRevealOptions(s, makePiece(s, "08026"), "p1", [])).toEqual(
      [],
    );
    expect(blackWidowRevealOptions(s, makePiece(s, "08029"), "p2", [])).toEqual(
      [],
    );
    run(
      blackWidowRevealOptions(s, makePiece(s, "08029"), "p1", [
        { type: "old-reveal" },
      ])[0].effects[0],
    );
    expect(ports.cancelEncounter).toHaveBeenCalledOnce();
    expect(s.queue[0]).toEqual({
      type: "bw:after-preparation",
      after: [],
      used: [],
    });
    expect(ports.revealReplacement).not.toHaveBeenCalled();
  });
  it("Widow's Bite responds only to a still-present entering minion after forced entry effects", () => {
    const { s, ports, play, minion, run } = fixture();
    play("08010");
    const p = minion();
    run(blackWidowMinionEntered(s, p, [], ports)[0].effects[0]);
    expect(ports.attackProgram).toHaveBeenCalledWith(
      s,
      [
        expect.objectContaining({ target: p.id, amount: 2, attack: true }),
        { type: "status", target: p.id, status: "stunned" },
      ],
      [expect.objectContaining({ type: "bw:after-preparation" })],
    );
    s.minions = [];
    expect(blackWidowMinionEntered(s, p, [], ports)).toEqual([]);
  });
  it("Counterintelligence prevents only3 positive main threat and resumes its original player's packet", () => {
    const { s, play, run, next } = fixture(true);
    play("08017", "p2");
    expect(
      blackWidowThreatOptions(s, { type: "threat", target: "side", amount: 4 }),
    ).toEqual([]);
    expect(
      blackWidowThreatOptions(s, { type: "threat", target: "main", amount: 0 }),
    ).toEqual([]);
    run(
      blackWidowThreatOptions(s, {
        type: "threat",
        target: "main",
        amount: 5,
      })[0].effects[0],
    );
    next();
    expect(s.queue).toEqual([
      { type: "threat", target: "main", amount: 2, actorId: "p1" },
    ]);
  });
  it("Defensive Stance requires actual pending identity damage and cannot preempt compulsory Tough", () => {
    const { s, ports, play, run } = fixture();
    play("08032");
    const window = { target: "hero", playerId: "p1", amount: 4, attack: true };
    expect(
      blackWidowDamageOptions(s, { ...window, target: "ally" }, []),
    ).toEqual([]);
    s.player.tough = true;
    expect(blackWidowDamageOptions(s, window, [])).toEqual([]);
    s.player.tough = false;
    run(blackWidowDamageOptions(s, window, [{ type: "resume" }])[0].effects[0]);
    expect(ports.preventDamage).toHaveBeenCalledWith(s, window, 3);
    expect(s.queue[0].type).toBe("bw:after-preparation");
  });
  it("Counterattack uses only actual identity attack damage, including Overkill and same-title stage advance", () => {
    const { s, ports, play, run } = fixture();
    play("08030");
    const oldCode = s.villain.code;
    const snapshot = {
      attacker: s.villain.id,
      attackerCode: oldCode,
      playerId: "p1",
      heroDamage: 4,
    };
    expect(
      blackWidowAttackResponses(s, { ...snapshot, heroDamage: 0 }),
    ).toEqual([]);
    s.villain.code = "01095";
    run(blackWidowAttackResponses(s, snapshot)[0].effects[0]);
    expect(ports.attackProgram).toHaveBeenCalledWith(
      s,
      [
        expect.objectContaining({
          target: s.villain.id,
          amount: 4,
          attack: true,
        }),
      ],
      [expect.objectContaining({ type: "bw:after-preparation" })],
    );
  });
  it("Rapid Response returns the exact defeated ally and applies its damage before entrance responses", () => {
    const { s, ports, play, run } = fixture();
    play("08031");
    const ally = makePiece(s, "08011");
    Object.assign(ally, {
      exhausted: true,
      damage: 3,
      counters: 4,
      stunned: true,
    });
    expect(blackWidowAllyDefeated(s, ally, "p1")).toEqual([]);
    s.player.discard = [ally];
    run(blackWidowAllyDefeated(s, ally, "p1")[0].effects[0]);
    expect(ports.returnDefeatedAlly).toHaveBeenCalledWith(s, ally.id, "p1", 1, [
      expect.objectContaining({ type: "bw:after-preparation" }),
    ]);
    expect(s.player.inPlay).toContain(ally);
    expect(ally.damage).toBe(1);
    expect(ally.exhausted).toBe(false);
    expect(ally.stunned).toBe(false);
  });
  it("Quake exhausts the controlling ally, deals non-attack damage, and restores the foreign-seat continuation", () => {
    const { s, play, minion, run } = fixture(true);
    const q = play("08012", "p2"),
      m = minion();
    const o = blackWidowMinionSchemed(s, m, [{ type: "resume" }])[0];
    run(o.effects[0]);
    expect(q.exhausted).toBe(true);
    expect(s.queue).toEqual([
      { type: "damage", target: m.id, amount: 2, source: q.id },
      { type: "resume", actorId: "p1" },
    ]);
  });
  it("Espionage works globally in either form, draws2, and leaves the actual Surge continuation intact", () => {
    const { s, play, run } = fixture(true);
    const view = seatView(s, "p2");
    view.player.form = "alter";
    view.player.deck = [makePiece(s, "08020")];
    play("08033", "p2");
    run(
      blackWidowSurgeOptions(s, makePiece(s, "01099"), [
        { type: "resolve-surge" },
      ])[0].effects[0],
    );
    expect(s.queue[0]).toEqual({ type: "draw", amount: 2 });
    expect(s.queue[1].after).toEqual([
      { type: "resolve-surge", actorId: "p1" },
    ]);
  });
  it("Widowmaker and Synth-Suit are independent optional responses, usable once each in either chosen order", () => {
    const { s, ports, play, run, choose, next } = fixture();
    const suit = play("08009");
    s.player.exhausted = true;
    run(blackWidowPreparationResolved(s, "08017", [{ type: "resume" }])[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "widowmaker",
      suit.id,
      "continue",
    ]);
    choose("widowmaker");
    next();
    choose(s.villain.id);
    const damage = s.queue.shift()!;
    expect(damage.amount).toBe(1);
    expect(damage.attack).toBeUndefined();
    next();
    expect(s.prompt?.options.map((o) => o.id)).toEqual([suit.id, "continue"]);
    choose(suit.id);
    next();
    expect(suit.exhausted).toBe(true);
    expect(s.queue.shift()).toEqual({ type: "ready", target: "hero" });
    s.player.exhausted = false;
    next();
    expect(s.queue).toEqual([{ type: "resume" }]);
    expect(ports.attackProgram).not.toHaveBeenCalled();
  });
  it("Synth-Suit never spends its exhaust cost on an already-ready or ready-locked identity", () => {
    const { s, ports, play, run } = fixture();
    const suit = play("08009");
    run({ type: "bw:after-preparation", used: ["widowmaker"], after: [] });
    expect(s.prompt).toBeNull();
    expect(suit.exhausted).toBe(false);
    s.player.exhausted = true;
    ports.canReadyIdentity = () => false;
    run({ type: "bw:after-preparation", used: ["widowmaker"], after: [] });
    expect(s.prompt).toBeNull();
    expect(suit.exhausted).toBe(false);
  });
  it("Burn Notice preserves a form lock and explicitly chooses tied highest printed-cost Preparations", () => {
    const { s, ports, play, run, choose, next } = fixture();
    const low = play("08010"),
      a = play("08017"),
      b = play("08008");
    ports.canChangeForm = () => false;
    const p = makePiece(s, "08025");
    run(blackWidowEncounterReveal(s, p)![0]);
    next();
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
    choose("discard");
    next();
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    expect(s.prompt?.options.some((o) => o.id === low.id)).toBe(false);
  });
  it("Burn Notice gains Surge when no Preparation exists, but the alter-ego exhaust branch removes it", () => {
    const { s, run, choose, next } = fixture();
    const p = makePiece(s, "08025");
    run({ type: "bw:obligation-discard", piece: p });
    expect(s.queue).toEqual([
      { type: "surge" },
      { type: "discardEncounter", piece: p },
    ]);
    s.queue = [];
    s.player.form = "alter";
    run({ type: "bw:obligation-choice", piece: p });
    choose("exhaust");
    expect(s.queue).toEqual([
      { type: "exhaust", id: "hero" },
      { type: "removeEncounter", piece: p },
    ]);
  });
  it("Taskmaster's passive counts the engaged player's upgrades, and its boost grants both activation modifiers", () => {
    const { s, ports, play, minion, run } = fixture(true);
    play("08009");
    play("08006");
    play("08005");
    play("08010", "p2");
    const m = minion();
    m.engagedWith = "p2";
    expect(blackWidowEnemyModifier(s, m)).toBe(1);
    expect(blackWidowEnemyModifier(s, s.villain)).toBe(0);
    run(blackWidowBoost(s, m)![0]);
    expect(ports.activationModifier).toHaveBeenCalledWith(s, 2, 2);
  });
  it("Killer for Hire adds one threat per player to its printed fixed base", () => {
    const { s } = fixture(true);
    const p = makePiece(s, "08027");
    expect(blackWidowEncounterReveal(s, p)).toEqual([
      { type: "threat", target: p.id, amount: 2 },
    ]);
  });
  it("Deadly Shot discards the chosen upgrade but still applies its form-dependent remaining effect without a discard target", () => {
    const { s, play, run, choose } = fixture();
    const upgrade = play("08009");
    play("08005");
    run(blackWidowEncounterReveal(s, makePiece(s, "08029"))![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([upgrade.id]);
    choose(upgrade.id);
    expect(s.queue).toEqual([
      { type: "discardPiece", id: upgrade.id },
      { type: "damage", target: "hero", amount: 1, source: "Deadly Shot" },
    ]);
    s.queue = [];
    s.player.inPlay = [];
    s.player.form = "alter";
    run({ type: "bw:deadly-shot" });
    expect(s.queue).toEqual([{ type: "threat", target: "main", amount: 1 }]);
  });
});
