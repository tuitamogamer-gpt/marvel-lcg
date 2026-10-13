import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine";
import { activateSeat, seatView } from "../src/game/team";
import type { Card, Effect, GameState, Piece } from "../src/game/types";
import {
  SABRETOOTH_SCRIPT_CODES,
  SABRETOOTH_SET,
  resolveSabretoothEffect,
  sabretoothActionOptions,
  sabretoothAfterActivation,
  sabretoothBoost,
  sabretoothBoostAllyDefeated,
  sabretoothFirstPlayerChanged,
  sabretoothHeroDefended,
  sabretoothKelly,
  sabretoothKellyCanAttach,
  sabretoothKellyCanHeal,
  sabretoothKellyController,
  sabretoothKellyCountsAgainstAllyLimit,
  sabretoothKellyLeftPlay,
  sabretoothKellyTextBlank,
  sabretoothMainCompleted,
  sabretoothMainThreatLimit,
  sabretoothModifiers,
  sabretoothReveal,
  sabretoothSetup,
  sabretoothSideSchemeBaseThreat,
  sabretoothSideSchemeDefeated,
  sabretoothUndefendedTarget,
  sabretoothVillainPhaseStepOne,
  type SabretoothActivationReceipt,
  type SabretoothDefenseReceipt,
  type SabretoothGameState,
  type SabretoothPorts,
} from "../src/game/sabretooth";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));

function fixture(count = 1) {
  let s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    seed: 32060,
    pacing: "expert",
    aspect: "justice",
  }) as SabretoothGameState;
  s.phase = "player";
  s.player.form = "hero";
  s.player.inPlay = [];
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.flags = {};
  s.players[0].player = s.player;
  s.players[0].flags = s.flags;
  for (let index = 1; index < count; index++)
    s.players.push({
      ...s.players[0],
      id: `p${index + 1}`,
      player: structuredClone(s.player),
      flags: {},
    });
  s.playerCount = count;
  s.villainId = "sabretooth";
  s.villain.code = "32060";
  s.villain.hp = s.villain.maxHp = 13 * count;
  s.scheme = { code: "32063b", threat: 0, index: 0 };
  s.sideSchemes = [];
  s.environments = [];
  s.attachments = [];
  s.minions = [];
  s.resolving = [];
  s.removed = [];
  s.queue = [];
  s.prompt = null;
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  const sequence: string[] = [];
  const activations: Effect[] = [];
  const ports: SabretoothPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    putSetupSideScheme: vi.fn((state: GameState, p: Piece, threat: number) => {
      p.counters = threat;
      state.sideSchemes.push(p);
    }),
    advanceMain: vi.fn(
      (state: GameState, _front: "32064a", after: Effect[]) => {
        sequence.push("advance");
        state.scheme = { code: "32064b", threat: 0, index: 1 };
        ports.queue(
          state,
          ...sabretoothReveal(state, {
            ...state.villain,
            id: "main2",
            code: "32064a",
          })!,
          ...after,
        );
      },
    ),
    flipFind: vi.fn((state: GameState, p: Piece) => {
      sequence.push("flip");
      state.sideSchemes = state.sideSchemes.filter((f) => f.id !== p.id);
      p.code = "32065b";
      p.counters = 0;
      delete p.pendingDefeat;
      state.environments!.push(p);
    }),
    attach: vi.fn((state: GameState, p: Piece, target: string) => {
      for (const zone of [
        state.encounter.deck,
        state.encounter.discard,
        state.resolving,
      ]) {
        const index = zone.findIndex((x) => x.id === p.id);
        if (index >= 0) zone.splice(index, 1);
      }
      p.attachedTo = target;
      state.attachments.push(p);
    }),
    discardPiece: vi.fn((state: GameState, id: string) => {
      const index = state.attachments.findIndex((p) => p.id === id);
      if (index >= 0)
        state.encounter.discard.push(...state.attachments.splice(index, 1));
    }),
    discardTop: vi.fn((state: GameState) => {
      const p = state.encounter.deck.shift();
      if (p) state.encounter.discard.push(p);
      const emptied = !!p && !state.encounter.deck.length;
      if (emptied) {
        state.encounter.acceleration++;
        state.encounter.deck = state.encounter.discard.splice(0);
      }
      return { piece: p, emptied };
    }),
    damage: vi.fn((state: GameState, target: string, amount: number) => {
      const kelly = sabretoothKelly(state);
      if (kelly && kelly.id === target) {
        kelly.damage += amount;
        if (kelly.damage >= 9) {
          state.removed.push(kelly);
          sabretoothKellyLeftPlay(state, kelly.id, ports);
        }
      }
    }),
    heal: vi.fn((state: GameState, target: string, amount: number) => {
      const kelly = sabretoothKelly(state);
      if (kelly && target === kelly.id)
        kelly.damage = Math.max(0, kelly.damage - amount);
      else if (target === state.villain.id)
        state.villain.hp = Math.min(
          state.villain.maxHp,
          state.villain.hp + amount,
        );
    }),
    defeatKelly: vi.fn((state, id) => {
      const kelly = sabretoothKelly(state);
      if (kelly) state.removed.push(kelly);
      sabretoothKellyLeftPlay(state, id, ports);
    }),
    lose: vi.fn((state, reason) => {
      state.phase = "lost";
      state.result = reason;
    }),
    dealEncounter: vi.fn((state, id) => {
      sequence.push(`deal:${id}`);
      const p = state.encounter.deck.shift();
      if (p) {
        p.dealtTo = id;
        state.encounter.dealt.push(p);
      }
    }),
    canExhaustHero: (state) =>
      !state.player.exhausted && !state.flags.noExhaust,
    exhaustHero: vi.fn((state) => {
      state.player.exhausted = true;
    }),
    canReadyHero: (state) => state.player.exhausted && !state.flags.noReady,
    readyHero: vi.fn((state) => {
      state.player.exhausted = false;
    }),
    canPay: vi.fn((state) => !state.flags.noPay),
    pay: vi.fn((state, title, cost, requirements, after) => {
      state.prompt = {
        kind: "payment",
        title,
        text: title,
        cost,
        requirements,
        options: [],
        after,
        abilityCost: true,
        cancelable: true,
      };
    }),
    registerAllyDefeatBoost: vi.fn(),
  };
  const piece = (code: string) => makePiece(s, code);
  const find = piece("32065a");
  const kelly = piece("32066");
  sabretoothSetup(s, find, kelly, ports, 0);
  const drain = () => {
    for (let count = 0; s.queue.length && !s.prompt && count < 100; count++) {
      const e = s.queue.shift()!;
      if (e.actorId) activateSeat(s, e.actorId);
      if (resolveSabretoothEffect(s, e, ports)) continue;
      if (["enemyAttack", "enemyScheme"].includes(e.type)) activations.push(e);
      else if (e.type === "threat") s.scheme.threat += e.amount;
      else throw Error(`Unknown test port effect: ${e.type}`);
    }
    expect(s.queue.length).toBeLessThan(100);
  };
  const effects = (list: Effect[] | null) => {
    expect(list).not.toBeNull();
    ports.queue(s, ...list!);
    drain();
  };
  const choose = (id: string) => {
    const option = s.prompt!.options.find((o) => o.id === id)!;
    expect(option).toBeDefined();
    s.prompt = null;
    effects(option.effects);
  };
  const pay = () => {
    expect(s.prompt?.kind).toBe("payment");
    const after = s.prompt!.after!;
    s.prompt = null;
    effects(after);
  };
  const rescue = () =>
    effects(sabretoothSideSchemeDefeated(s, find, s.activePlayerId));
  const receipt = (
    kind: "attack" | "scheme" = "attack",
  ): SabretoothActivationReceipt => ({
    token: `activation:${s.nextId++}`,
    enemyId: s.villain.id,
    enemyCode: s.villain.code,
    playerId: s.activePlayerId,
    kind,
    performed: true,
  });
  const defense = (playerId = s.activePlayerId): SabretoothDefenseReceipt => ({
    attackId: `attack:${s.nextId++}`,
    enemyId: s.villain.id,
    enemyCode: s.villain.code,
    playerId,
    heroDefended: true,
  });
  const attached = (code: string) => {
    const p = piece(code);
    p.attachedTo = s.villain.id;
    s.attachments.push(p);
    return p;
  };
  return {
    get s() {
      return s;
    },
    ports,
    find,
    kelly,
    piece,
    drain,
    effects,
    choose,
    pay,
    rescue,
    receipt,
    defense,
    attached,
    sequence,
    activations,
    reload() {
      s = JSON.parse(JSON.stringify(s)) as SabretoothGameState;
    },
    clearSetup() {
      delete s.sabretooth;
      s.sideSchemes = [];
    },
  };
}

describe("Sabretooth authored scenario and explicit native ports", () => {
  it("owns exactly sixteen unchanged faces and seventeen physical source cards", () => {
    const source = catalog.filter((c) => c.set_code === SABRETOOTH_SET);
    expect(source.map((c) => c.code)).toEqual([...SABRETOOTH_SCRIPT_CODES]);
    const physical = source.filter((c) => !c.hidden);
    expect(physical.reduce((sum, c) => sum + c.quantity, 0)).toBe(17);
    expect(cards.get("32066")?.is_unique).toBe(true);
    expect(cards.get("32066")?.health).toBe(9);
    expect(cards.get("32066")?.attack).toBeNull();
    expect(cards.get("32066")?.thwart).toBeNull();
    const f = fixture();
    expect(sabretoothReveal(f.s, f.piece("01103"))).toBeNull();
    expect(sabretoothBoost(f.s, f.piece("01103"))).toBeNull();
    expect(resolveSabretoothEffect(f.s, { type: "other" }, f.ports)).toBe(
      false,
    );
  });

  it("sets up actual Find/Kelly IDs, uncontrolled blank nine-HP Kelly, and 5 threat per player", () => {
    const f = fixture(3);
    expect(f.s.sideSchemes[0]).toBe(f.find);
    expect(f.find.counters).toBe(15);
    expect(sabretoothKelly(f.s)).toBe(f.kelly);
    expect(f.kelly.attachedTo).toBe(f.find.id);
    expect(f.kelly.damage).toBe(0);
    expect(sabretoothKellyTextBlank(f.s)).toBe(true);
    expect(sabretoothKellyController(f.s)).toBeUndefined();
    expect(sabretoothKellyCanHeal(f.s, "player")).toBe(false);
    expect(sabretoothKellyCanHeal(f.s, "encounter")).toBe(true);
    expect(sabretoothKellyCanAttach(f.s, cards.get("01065")!)).toBe(false);
    expect(sabretoothKellyCanAttach(f.s, cards.get("01104")!)).toBe(true);
    sabretoothSetup(f.s, f.find, f.kelly, f.ports);
    expect(f.ports.putSetupSideScheme).toHaveBeenCalledTimes(1);
    expect(() =>
      sabretoothSetup(f.s, f.find, f.piece("32066"), f.ports),
    ).toThrow("physical ID");
  });

  it("stage one has no completion limit, even above six threat per player", () => {
    const f = fixture(2);
    f.s.scheme.threat = 100;
    expect(sabretoothMainThreatLimit(f.s)).toBe(0);
    expect(sabretoothMainCompleted(f.s)).toBeNull();
    expect(
      sabretoothMainThreatLimit({ ...f.s, villainId: "rhino" }),
    ).toBeNull();
  });

  it.each([
    ["standard", 0, 1],
    ["expert", 0, 2],
    ["standard", 1, 3],
  ] as const)(
    "recommended Kelly starting damage is %s/Heroic%i → %i",
    (difficulty, heroic, damage) => {
      const f = fixture();
      f.clearSetup();
      f.s.difficulty = difficulty;
      f.s.heroic = heroic;
      sabretoothSetup(f.s, f.find, f.kelly, f.ports);
      expect(f.kelly.damage).toBe(damage);
      expect(f.s.sabretooth?.startingDamage).toBe(damage);
      f.kelly.damage++;
      sabretoothSetup(f.s, f.find, f.kelly, f.ports, 0);
      expect(f.kelly.damage).toBe(damage + 1);
      expect(f.s.sabretooth?.startingDamage).toBe(damage);
    },
  );

  it("explicit group starting damage is bounded, saved, and never creates a new Kelly", () => {
    const f = fixture();
    f.clearSetup();
    expect(() => sabretoothSetup(f.s, f.find, f.kelly, f.ports, 9)).toThrow(
      "0 to 8",
    );
    expect(() => sabretoothSetup(f.s, f.find, f.kelly, f.ports, 1.5)).toThrow(
      "0 to 8",
    );
    sabretoothSetup(f.s, f.find, f.kelly, f.ports, 7);
    f.reload();
    expect(f.s.sabretooth?.startingDamage).toBe(7);
    expect(sabretoothKelly(f.s)?.damage).toBe(7);
    expect(sabretoothKelly(f.s)?.id).toBe(f.kelly.id);
  });

  it.each([
    [1, 5, 2],
    [1, 6, 3],
    [3, 17, 2],
    [3, 18, 3],
  ])(
    "post-step-one checks final threat for %i players at %i threat, dealing %i Kelly damage",
    (count, threat, amount) => {
      const f = fixture(count);
      f.s.scheme.threat = threat;
      f.effects(sabretoothVillainPhaseStepOne(f.s));
      expect(f.ports.damage).toHaveBeenCalledWith(
        f.s,
        f.kelly.id,
        amount,
        "32063b",
      );
      expect(f.kelly.damage).toBe(amount);
      expect(f.s.scheme.code).toBe("32063b");
    },
  );

  it("rescue detaches the same damaged Kelly, deals each surviving seat, then flips the same Find", () => {
    const f = fixture(3);
    f.kelly.damage = 4;
    f.s.firstPlayerId = "p2";
    f.s.players[2].eliminated = true;
    const dealt = [f.piece("01103"), f.piece("01105")];
    f.s.encounter.deck = [...dealt];
    f.rescue();
    expect(f.sequence).toEqual(["advance", "deal:p2", "deal:p1", "flip"]);
    expect(f.s.scheme).toEqual({ code: "32064b", threat: 0, index: 1 });
    expect(sabretoothKelly(f.s)).toBe(f.kelly);
    expect(f.kelly.damage).toBe(4);
    expect(f.kelly.attachedTo).toBeUndefined();
    expect(sabretoothKellyController(f.s)).toBe("p2");
    expect(sabretoothKellyTextBlank(f.s)).toBe(false);
    expect(f.s.sideSchemes).toEqual([]);
    expect(f.s.environments).toEqual([f.find]);
    expect(f.find.code).toBe("32065b");
    expect(f.s.encounter.dealt.map((p) => p.id)).toEqual(
      dealt.map((p) => p.id),
    );
    expect(sabretoothMainThreatLimit(f.s)).toBe(27);
    expect(sabretoothVillainPhaseStepOne(f.s)).toEqual([]);
  });

  it("serializes rescue before its queued advance and preserves one Kelly/Find source across reload", () => {
    const f = fixture(2);
    f.kelly.damage = 3;
    f.s.queue = sabretoothSideSchemeDefeated(f.s, f.find, "p2")!;
    const ids = [f.find.id, f.kelly.id];
    f.reload();
    f.drain();
    f.reload();
    expect(f.s.environments?.[0].id).toBe(ids[0]);
    expect(f.s.sabretooth?.kelly?.id).toBe(ids[1]);
    expect(f.s.sabretooth?.kelly?.damage).toBe(3);
    const actual = [
      ...f.s.sideSchemes,
      ...f.s.environments!,
      ...f.s.encounter.deck,
      ...f.s.encounter.discard,
      ...f.s.removed,
      ...f.s.players.flatMap((p) => p.player.inPlay),
      sabretoothKelly(f.s)!,
    ];
    expect(actual.filter((p) => ids.includes(p.id))).toHaveLength(2);
    expect(new Set(actual.map((p) => p.id)).size).toBe(actual.length);
  });

  it("first-player rotation transfers control without moving or resetting the NPC", () => {
    const f = fixture(2);
    f.rescue();
    f.kelly.damage = 5;
    f.s.firstPlayerId = "p2";
    sabretoothFirstPlayerChanged(f.s);
    expect(sabretoothKellyController(f.s)).toBe("p2");
    expect(sabretoothKelly(f.s)).toBe(f.kelly);
    expect(f.kelly.damage).toBe(5);
    expect(sabretoothKellyCountsAgainstAllyLimit(f.s)).toBe(false);
    expect(sabretoothKellyCanHeal(f.s, "player")).toBe(false);
    expect(sabretoothKellyCanAttach(f.s, cards.get("01065")!)).toBe(false);
    expect(sabretoothKellyCanAttach(f.s, cards.get("01104")!)).toBe(true);
    const attached = fixture(2);
    attached.s.firstPlayerId = "p2";
    sabretoothFirstPlayerChanged(attached.s);
    expect(sabretoothKellyController(attached.s)).toBeUndefined();
  });

  it("routes only an actual undefended attack against Kelly's controller; ally Overkill stays identity", () => {
    const f = fixture(2);
    const r = { playerId: "p1", undefended: true, target: "hero" };
    expect(sabretoothUndefendedTarget(f.s, r)).toBeNull();
    f.rescue();
    expect(sabretoothUndefendedTarget(f.s, r)).toBe(f.kelly.id);
    expect(sabretoothUndefendedTarget(f.s, { ...r, target: "hero:p1" })).toBe(
      f.kelly.id,
    );
    expect(
      sabretoothUndefendedTarget(f.s, { ...r, playerId: "p2" }),
    ).toBeNull();
    expect(
      sabretoothUndefendedTarget(f.s, { ...r, undefended: false }),
    ).toBeNull();
    expect(
      sabretoothUndefendedTarget(f.s, { ...r, target: "ally" }),
    ).toBeNull();
  });

  it("loses on actual Kelly leave, independent of remaining HP or why he left", () => {
    const f = fixture();
    const id = f.kelly.id;
    f.s.removed.push(f.kelly);
    sabretoothKellyLeftPlay(f.s, "other", f.ports);
    expect(f.s.phase).toBe("player");
    sabretoothKellyLeftPlay(f.s, id, f.ports);
    expect(f.s.phase).toBe("lost");
    expect(sabretoothKelly(f.s)).toBeUndefined();
    expect(f.s.sabretooth?.kellyId).toBe(id);
    expect(f.s.removed).toEqual([f.kelly]);
  });

  it("stage-two completion defeats the actual Kelly before ordinary scheme loss handling", () => {
    const f = fixture(2);
    f.rescue();
    f.s.scheme.threat = 18;
    f.effects(sabretoothMainCompleted(f.s));
    expect(f.ports.defeatKelly).toHaveBeenCalledWith(f.s, f.kelly.id, "32064b");
    expect(f.s.phase).toBe("lost");
    expect(f.s.removed.map((p) => p.id)).toEqual([f.kelly.id]);
  });

  it.each(["attack", "scheme"] as const)(
    "regenerates after an actual %s using numeric icons without boost abilities",
    (kind) => {
      const f = fixture();
      f.s.villain.hp -= 5;
      const top = f.piece("32071");
      f.s.encounter.deck = [top, f.piece("32068")];
      const receipt = f.receipt(kind);
      f.effects(sabretoothAfterActivation(f.s, receipt));
      expect(f.s.villain.hp).toBe(f.s.villain.maxHp - 3);
      expect(f.s.encounter.discard).toEqual([top]);
      expect(f.ports.heal).toHaveBeenCalledWith(
        f.s,
        f.s.villain.id,
        2,
        f.s.villain.id,
      );
      expect(f.ports.attach).not.toHaveBeenCalled();
      expect(sabretoothAfterActivation(f.s, receipt)).toEqual([]);
    },
  );

  it("mandatory regeneration discards even at full health, and ignores a boost star", () => {
    const f = fixture();
    const claws = f.piece("32067");
    f.s.encounter.deck = [claws, f.piece("32070")];
    f.effects(sabretoothAfterActivation(f.s, f.receipt()));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(1);
    expect(f.ports.heal).toHaveBeenCalledWith(
      f.s,
      f.s.villain.id,
      0,
      f.s.villain.id,
    );
    expect(f.s.attachments).toEqual([]);
    expect(f.s.encounter.discard).toEqual([claws]);
  });

  it("does not regenerate after a status-canceled activation or a different enemy", () => {
    const f = fixture();
    const r = f.receipt();
    expect(sabretoothAfterActivation(f.s, { ...r, performed: false })).toEqual(
      [],
    );
    expect(sabretoothAfterActivation(f.s, { ...r, enemyId: "minion" })).toEqual(
      [],
    );
    expect(
      sabretoothAfterActivation(f.s, { ...r, enemyCode: "01121" }),
    ).toEqual([]);
    expect(f.ports.discardTop).not.toHaveBeenCalled();
  });

  it("regeneration retains the top-card receipt when encounter exhaustion recycles that card", () => {
    const f = fixture();
    f.s.villain.hp -= 4;
    const top = f.piece("32072");
    f.s.encounter.deck = [top];
    f.effects(sabretoothAfterActivation(f.s, f.receipt()));
    expect(f.s.villain.hp).toBe(f.s.villain.maxHp - 1);
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.s.encounter.deck).toEqual([top]);
    expect(f.s.encounter.discard).toEqual([]);
  });

  it("saved regeneration receipts do not discard or heal twice after reload", () => {
    const f = fixture();
    const r = f.receipt();
    f.s.encounter.deck = [f.piece("32070"), f.piece("32071")];
    f.s.queue = sabretoothAfterActivation(f.s, r);
    f.reload();
    f.drain();
    f.reload();
    f.effects(sabretoothAfterActivation(f.s, r));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(1);
    expect(f.s.sabretooth?.completedActivationIds).toEqual([r.token]);
  });

  it.each(["32067", "32068"])(
    "reveal and boost attach the actual %s source to Sabretooth",
    (code) => {
      const f = fixture();
      const p = f.piece(code);
      f.s.encounter.discard = [p];
      f.effects(sabretoothBoost(f.s, p));
      expect(f.s.attachments).toEqual([p]);
      expect(f.s.encounter.discard).toEqual([]);
      expect(p.attachedTo).toBe(f.s.villain.id);
      expect(sabretoothReveal(f.s, p)?.[0].piece).toBe(p);
    },
  );

  it("text grants are target-specific, while Claws' printed +1 ATK remains native", () => {
    const f = fixture();
    f.attached("32067");
    f.attached("32068");
    expect(sabretoothModifiers(f.s)).toEqual({
      piercing: true,
      stalwart: true,
    });
    expect(sabretoothModifiers(f.s, "minion")).toEqual({
      piercing: false,
      stalwart: false,
    });
    expect(cards.get("32067")?.attack).toBe(1);
    expect(cards.get("32061")?.text).toContain("Toughness.");
    expect(cards.get("32062")?.text).toContain("Retaliate 1. Toughness.");
  });

  it("attachment discard is a Hero Action with a native energy/mental/physical payment", () => {
    const f = fixture();
    const p = f.attached("32068");
    const option = sabretoothActionOptions(f.s, p.id, f.ports)[0];
    f.effects(option.effects);
    expect(f.s.prompt?.cost).toBe(3);
    expect(f.s.prompt?.requirements).toEqual(["energy", "mental", "physical"]);
    expect(f.s.attachments).toEqual([p]);
    f.reload();
    f.pay();
    expect(f.s.attachments).toEqual([]);
    expect(f.s.encounter.discard.map((a) => a.id)).toEqual([p.id]);
    expect(f.ports.discardPiece).toHaveBeenCalledTimes(1);
  });

  it("cannot freely discard an attachment in alter ego, without payable resources, or on canceled payment", () => {
    const f = fixture();
    const p = f.attached("32067");
    f.s.player.form = "alter";
    expect(sabretoothActionOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.form = "hero";
    f.s.flags.noPay = true;
    expect(sabretoothActionOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.flags.noPay = false;
    f.effects(sabretoothActionOptions(f.s, p.id, f.ports)[0].effects);
    f.s.prompt = null;
    f.drain();
    expect(f.s.attachments).toEqual([p]);
    expect(f.ports.discardPiece).not.toHaveBeenCalled();
  });

  it("Strikes permits a ready hero to exhaust and prevents its exact Kelly damage", () => {
    const f = fixture();
    const p = f.piece("32069");
    f.effects(sabretoothReveal(f.s, p));
    f.reload();
    f.choose("exhaust");
    expect(f.s.player.exhausted).toBe(true);
    expect(sabretoothKelly(f.s)?.damage).toBe(0);
    expect(f.ports.damage).not.toHaveBeenCalled();
  });

  it.each(["alter", "exhausted", "cannot-exhaust"])(
    "Strikes deals actual Kelly damage without an invalid %s exhaust choice",
    (condition) => {
      const f = fixture();
      if (condition === "alter") f.s.player.form = "alter";
      if (condition === "exhausted") f.s.player.exhausted = true;
      if (condition === "cannot-exhaust") f.s.flags.noExhaust = true;
      f.effects(sabretoothReveal(f.s, f.piece("32069")));
      expect(f.s.prompt).toBeNull();
      expect(f.kelly.damage).toBe(1);
      expect(f.ports.exhaustHero).not.toHaveBeenCalled();
    },
  );

  it("Strikes' optional decline can defeat the actual last-HP Kelly", () => {
    const f = fixture();
    f.kelly.damage = 8;
    f.effects(sabretoothReveal(f.s, f.piece("32069")));
    f.choose("damage");
    expect(f.s.phase).toBe("lost");
    expect(f.s.removed).toEqual([f.kelly]);
  });

  it("Strikes boost retains only an actual ally-defeat trigger on the same native attack", () => {
    const f = fixture();
    const p = f.piece("32069");
    expect(sabretoothBoost(f.s, p)).toEqual([]);
    f.s.attack = { ...f.s.attack, id: "attack-boost" } as GameState["attack"];
    f.effects(sabretoothBoost(f.s, p));
    expect(f.ports.registerAllyDefeatBoost).toHaveBeenCalledWith(
      f.s,
      p.id,
      "attack-boost",
    );
    f.effects(
      sabretoothBoostAllyDefeated(f.s, {
        attackId: "attack-boost",
        sourceId: p.id,
        allyId: f.kelly.id,
      }),
    );
    expect(f.s.scheme.threat).toBe(2);
  });

  it.each([
    ["hero", false, "enemyAttack", 1],
    ["alter", false, "enemyScheme", 1],
    ["hero", true, "enemyAttack", 0],
    ["alter", true, "enemyScheme", 0],
  ] as const)(
    "Savage captures %s form/damaged=%s and queues %s with modifier %i only for that activation",
    (form, damaged, type, modifier) => {
      const f = fixture();
      f.s.player.form = form;
      if (damaged) f.s.villain.hp--;
      f.effects(sabretoothReveal(f.s, f.piece("32070")));
      expect(f.activations).toHaveLength(1);
      expect(f.activations[0]).toMatchObject({
        type,
        id: f.s.villain.id,
        actorId: "p1",
        activation: {
          enemyId: f.s.villain.id,
          playerId: "p1",
          kind: form === "hero" ? "attack" : "scheme",
          modifier,
        },
      });
      expect(f.s.villain.bonusAtk).toBeUndefined();
    },
  );

  it("Medical base is fixed 2 plus native Hinder 2 per player; Feral base is fixed 4", () => {
    const f = fixture(3);
    expect(sabretoothSideSchemeBaseThreat(f.s, f.piece("32071"))).toBe(2);
    expect(cards.get("32071")?.text).toContain("Hinder 2[per_hero]");
    expect(cards.get("32071")?.base_threat_fixed).toBe(true);
    expect(sabretoothSideSchemeBaseThreat(f.s, f.piece("32072"))).toBe(4);
    expect(cards.get("32072")?.base_threat_fixed).toBe(true);
    expect(sabretoothSideSchemeBaseThreat(f.s, f.find)).toBe(15);
  });

  it("Medical's encounter effect heals Kelly despite the player-card prohibition", () => {
    const f = fixture();
    f.kelly.damage = 5;
    const medical = f.piece("32071");
    f.effects(sabretoothSideSchemeDefeated(f.s, medical, "p1"));
    expect(f.kelly.damage).toBe(3);
    expect(f.ports.heal).toHaveBeenCalledWith(f.s, f.kelly.id, 2, medical.id);
    expect(sabretoothKellyCanHeal(f.s, "player")).toBe(false);
    expect(cards.get("32071")?.text).toContain("Victory 1");
  });

  it("Feral defeat attacks the actual defeating alter-ego player", () => {
    const f = fixture(2);
    seatView(f.s, "p2").player.form = "alter";
    const feral = f.piece("32072");
    f.effects(sabretoothSideSchemeDefeated(f.s, feral, "p2"));
    expect(f.activations).toEqual([
      { type: "enemyAttack", id: f.s.villain.id, actorId: "p2" },
    ]);
    expect(f.s.activePlayerId).toBe("p2");
  });

  it("Protect is an optional controller hero-defense response, paid before ready, once per actual attack", () => {
    const f = fixture(2);
    f.rescue();
    f.s.player.exhausted = true;
    const receipt = f.defense();
    const option = sabretoothHeroDefended(f.s, receipt, f.ports)[0];
    expect(option.id).toBe(`protect:${f.find.id}:${receipt.attackId}`);
    f.effects(option.effects);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      cost: 2,
      requirements: [],
    });
    f.reload();
    f.pay();
    f.s.player.exhausted = true;
    expect(sabretoothHeroDefended(f.s, receipt, f.ports)).toEqual([]);
    expect(sabretoothHeroDefended(f.s, f.defense(), f.ports)).toHaveLength(1);
    expect(f.ports.readyHero).toHaveBeenCalledTimes(1);
  });

  it("Protect excludes undefended/ally attacks, another controller, alter ego, ready and blocked heroes", () => {
    const f = fixture(2);
    f.rescue();
    f.s.player.exhausted = true;
    const receipt = f.defense();
    expect(
      sabretoothHeroDefended(f.s, { ...receipt, heroDefended: false }, f.ports),
    ).toEqual([]);
    expect(sabretoothHeroDefended(f.s, f.defense("p2"), f.ports)).toEqual([]);
    expect(
      sabretoothHeroDefended(f.s, { ...receipt, enemyId: "minion" }, f.ports),
    ).toEqual([]);
    f.s.player.form = "alter";
    expect(sabretoothHeroDefended(f.s, receipt, f.ports)).toEqual([]);
    f.s.player.form = "hero";
    f.s.player.exhausted = false;
    expect(sabretoothHeroDefended(f.s, receipt, f.ports)).toEqual([]);
    f.s.player.exhausted = true;
    f.s.flags.noReady = true;
    expect(sabretoothHeroDefended(f.s, receipt, f.ports)).toEqual([]);
    f.s.flags.noReady = false;
    f.s.flags.noPay = true;
    expect(sabretoothHeroDefended(f.s, receipt, f.ports)).toEqual([]);
  });

  it("an optional canceled Protect payment neither readies nor consumes the response", () => {
    const f = fixture();
    f.rescue();
    f.s.player.exhausted = true;
    const receipt = f.defense();
    f.effects(sabretoothHeroDefended(f.s, receipt, f.ports)[0].effects);
    f.s.prompt = null;
    f.drain();
    expect(f.s.player.exhausted).toBe(true);
    expect(f.ports.readyHero).not.toHaveBeenCalled();
    expect(f.s.sabretooth?.usedDefenseResponses).toEqual([]);
    expect(sabretoothHeroDefended(f.s, receipt, f.ports)).toHaveLength(1);
  });

  it("Protect cannot ready an eliminated or defeated defending identity", () => {
    const f = fixture(2);
    f.rescue();
    f.s.player.exhausted = true;
    const receipt = f.defense();
    f.s.player.hp = 0;
    expect(sabretoothHeroDefended(f.s, receipt, f.ports)).toEqual([]);
    f.s.player.hp = 1;
    f.s.players[0].eliminated = true;
    expect(sabretoothHeroDefended(f.s, receipt, f.ports)).toEqual([]);
    expect(
      sabretoothHeroDefended(f.s, { ...receipt, playerId: "unknown" }, f.ports),
    ).toEqual([]);
  });

  it("an established Protect effect does not ready a different hero when its payer is eliminated", () => {
    const f = fixture(2);
    f.rescue();
    f.s.player.exhausted = true;
    const receipt = f.defense();
    f.effects(sabretoothHeroDefended(f.s, receipt, f.ports)[0].effects);
    const after = f.s.prompt!.after!;
    f.s.prompt = null;
    f.s.players[0].eliminated = true;
    f.s.player.hp = 0;
    activateSeat(f.s, "p2");
    f.s.player.exhausted = true;
    f.s.sabretooth!.controllerId = "p2";
    resolveSabretoothEffect(f.s, after[0], f.ports);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.ports.readyHero).not.toHaveBeenCalled();
  });
});
