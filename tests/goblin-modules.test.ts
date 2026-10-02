import { describe, expect, it, vi } from "vitest";
import { newGame, makePiece } from "../src/game/engine";
import { activateSeat, seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import catalog from "../src/data/catalog-cards.json";
import {
  GOBLIN_MODULE_SCRIPT_CODES,
  GOBLIN_MODULE_SETS,
  goblinModuleReveal,
  goblinModuleBoost,
  goblinModuleDefeated,
  goblinModuleAttackResponses,
  goblinIdentityLocked,
  goblinWhenRevealedCopies,
  goblinModuleAttachmentActions,
  resolveGoblinModuleEffect,
  type GoblinModuleEnginePorts,
} from "../src/game/goblin-modules";

function fixture(players = 1) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 771,
    pacing: "expert",
  });
  s.phase = "player";
  s.playerCount = players;
  s.player.form = "hero";
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.players[0].player = s.player;
  for (let i = 1; i < players; i++)
    s.players.push({
      ...s.players[0],
      id: `p${i + 1}`,
      player: structuredClone(s.player),
      flags: {},
      eliminated: false,
    });
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.resolving = [];
  s.queue = [];
  s.prompt = null;
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  const ports: GoblinModuleEnginePorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    pay: vi.fn(),
    canPay: vi.fn(() => true),
    activate: vi.fn(),
    discardTop: vi.fn((state) => {
      const piece = state.encounter.deck.shift();
      if (piece) state.encounter.discard.push(piece);
      const emptied = !state.encounter.deck.length;
      if (emptied && piece) {
        state.encounter.acceleration++;
        state.encounter.deck = state.encounter.discard.splice(0);
      }
      return { piece, emptied };
    }),
    putMinion: vi.fn((state, piece, playerId) => {
      state.encounter.discard = state.encounter.discard.filter(
        (p: Piece) => p.id !== piece.id,
      );
      state.encounter.deck = state.encounter.deck.filter(
        (p: Piece) => p.id !== piece.id,
      );
      piece.engagedWith = playerId;
      if (!state.minions.some((p: Piece) => p.code === piece.code))
        state.minions.push(piece);
    }),
    attach: vi.fn((state, piece, target) => {
      piece.attachedTo = target;
      state.attachments.push(piece);
      state.resolving = state.resolving.filter((p: Piece) => p.id !== piece.id);
    }),
    discardPiece: vi.fn((state, id) => {
      const p = state.attachments.find((p: Piece) => p.id === id);
      state.attachments = state.attachments.filter((p: Piece) => p.id !== id);
      if (p) state.encounter.discard.push(p);
    }),
    discardHand: vi.fn((state, id) => {
      const index = state.player.hand.findIndex((p: Piece) => p.id === id);
      state.player.discard.push(...state.player.hand.splice(index, 1));
    }),
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    if (resolveGoblinModuleEffect(s, e, ports)) return;
    if (e.type === "threat")
      s.sideSchemes.find((p: Piece) => p.id === e.target)!.counters += e.amount;
    else if (e.type === "status") {
      if (e.target.startsWith("hero:"))
        seatView(s, e.target.slice(5)).player.stunned = true;
      else if (e.target === "hero") s.player.stunned = true;
      else
        for (const seat of s.players) {
          const p = seatView(s, seat).player.inPlay.find(
            (p: Piece) => p.id === e.target,
          );
          if (p) p.stunned = true;
        }
    } else if (e.type === "surge") {
      const p = s.encounter.deck.shift();
      if (p) {
        p.dealtTo = s.activePlayerId;
        s.encounter.dealt.push(p);
      }
    } else if (e.type === "indirect") s.flags.lastIndirect = e.amount;
    else if (e.type === "heal")
      s.villain.hp = Math.min(s.villain.maxHp, s.villain.hp + e.amount);
    else throw Error(`Unknown fixture effect ${e.type}`);
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
  const minion = (code: string, playerId = "p1") => {
    const p = piece(code);
    p.engagedWith = playerId;
    s.minions.push(p);
    return p;
  };
  const side = (code: string, threat = 2) => {
    const p = piece(code);
    p.counters = threat;
    s.sideSchemes.push(p);
    return p;
  };
  const attachment = (code: string, playerId = "p1") => {
    const p = piece(code);
    p.attachedTo = `hero:${playerId}`;
    s.attachments.push(p);
    return p;
  };
  const deck = (...codes: string[]) => {
    s.encounter.deck = codes.map(piece);
    return [...s.encounter.deck];
  };
  return {
    s,
    ports,
    run,
    effects,
    choose,
    drain,
    piece,
    minion,
    side,
    attachment,
    deck,
  };
}

describe("all three remaining Goblin modular sets, port-level exact rules", () => {
  it("closes exactly13 imported card faces with no unrelated module claims", () => {
    expect(GOBLIN_MODULE_SCRIPT_CODES).toHaveLength(13);
    expect([...GOBLIN_MODULE_SCRIPT_CODES].sort()).toEqual(
      catalog
        .filter((c) =>
          (GOBLIN_MODULE_SETS as readonly string[]).includes(c.set_code || ""),
        )
        .map((c) => c.code)
        .sort(),
    );
  });
  it("A Mess of Things counts all stunned friendly heroes/allies, excluding partially Steady and enemies", () => {
    const f = fixture(2),
      scheme = f.side("02037");
    f.s.player.stunned = true;
    seatView(f.s, "p2").player.inPlay.push({
      ...f.piece("01083"),
      stunned: true,
    });
    seatView(f.s, "p2").player.stunCards = 1;
    seatView(f.s, "p2").player.stunned = false;
    f.minion("02038").stunned = true;
    f.effects(goblinModuleReveal(f.s, scheme));
    expect(scheme.counters).toBe(6);
    expect(catalog.find((c) => c.code === "02037")!.base_threat_fixed).toBe(
      true,
    );
  });
  it("Gang-Up in alter ego deals surge with no activation", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.deck("02010", "02013");
    f.effects(goblinModuleReveal(f.s, f.piece("02039")));
    expect(f.s.encounter.dealt).toHaveLength(1);
    expect(f.ports.activate).not.toHaveBeenCalled();
  });
  it("Gang-Up waits for whole villain attack, then includes newly engaged minions in chosen order", () => {
    const f = fixture();
    const first = f.minion("02038");
    f.effects(goblinModuleReveal(f.s, f.piece("02039")));
    expect(f.ports.activate).toHaveBeenCalledTimes(1);
    const initial = vi.mocked(f.ports.activate).mock.calls[0][1];
    expect(initial.enemyId).toBe(f.s.villain.id);
    const fresh = f.minion("02042");
    f.effects([initial.after!]);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([first.id, fresh.id]);
    f.choose(fresh.id);
    const attack = vi.mocked(f.ports.activate).mock.calls[1][1];
    expect(attack).toMatchObject({ enemyId: fresh.id, playerId: "p1" });
    f.effects([attack.after!]);
    expect(vi.mocked(f.ports.activate).mock.calls[2][1].enemyId).toBe(first.id);
  });
  it("Gang-Up revalidates departed minions and survives serializable continuation", () => {
    const f = fixture();
    const a = f.minion("02038"),
      b = f.minion("02042");
    f.effects(goblinModuleReveal(f.s, f.piece("02039")));
    f.effects([vi.mocked(f.ports.activate).mock.calls[0][1].after!]);
    const e = JSON.parse(
      JSON.stringify(
        f.s.prompt!.options.find((o) => o.id === a.id)!.effects[0],
      ),
    );
    f.s.prompt = null;
    f.s.minions = [b];
    f.effects([e]);
    expect(vi.mocked(f.ports.activate).mock.calls[1][1].enemyId).toBe(b.id);
  });
  it.each(["missing", "alter"])(
    "Tail Sweep %s cannot attack hero and stuns the original revealer",
    (mode) => {
      const f = fixture(2);
      if (mode === "alter") {
        f.minion("02038", "p2");
        f.s.player.form = "alter";
      }
      f.effects(goblinModuleReveal(f.s, f.piece("02040")));
      expect(f.s.player.stunned).toBe(true);
      expect(seatView(f.s, "p2").player.stunned).toBeFalsy();
      expect(f.ports.activate).not.toHaveBeenCalled();
    },
  );
  it.each([true, false])(
    "Tail Sweep uses actual performed=%s, independent of damage",
    (performed) => {
      const f = fixture();
      const scorpion = f.minion("02038", "p2");
      f.effects(goblinModuleReveal(f.s, f.piece("02040")));
      const request = vi.mocked(f.ports.activate).mock.calls[0][1];
      expect(request).toMatchObject({
        enemyId: scorpion.id,
        playerId: "p1",
        kind: "attack",
      });
      f.effects([{ ...request.after!, performed, damagePlaced: 0 }]);
      expect(!!f.s.player.stunned).toBe(!performed);
    },
  );
  it("Tail Sweep boost stuns only final defender's identity", () => {
    const f = fixture(2);
    f.effects(goblinModuleBoost(f.s, f.piece("02040"), "p2"));
    expect(seatView(f.s, "p2").player.stunned).toBe(true);
    expect(seatView(f.s, "p1").player.stunned).toBeFalsy();
  });
  it("Scorpion gives one source-guarded forced response to every actually damaged character", () => {
    const f = fixture(2),
      scorpion = f.minion("02038"),
      ally = f.piece("01083");
    f.s.player.inPlay.push(ally);
    const responses = goblinModuleAttackResponses(f.s, {
      attacker: scorpion,
      playerId: "p1",
      performed: true,
      identityDamage: 2,
      damaged: [
        { target: ally.id, playerId: "p1", amount: 1 },
        { target: "hero:p1", playerId: "p1", amount: 2 },
        { target: "hero:p2", playerId: "p2", amount: 0 },
      ],
    });
    expect(responses).toHaveLength(2);
    expect(responses.every((r) => r.sourceId === scorpion.id)).toBe(true);
    for (const r of responses) f.effects(r.effects);
    expect(ally.stunned).toBe(true);
    expect(f.s.player.stunned).toBe(true);
  });
  it("departed or canceled attackers have no uninitiated forced responses", () => {
    const f = fixture();
    const p = f.minion("02042");
    const outcome = {
      attacker: p,
      playerId: "p1",
      performed: true,
      identityDamage: 0,
      damaged: [],
    };
    f.s.minions = [];
    expect(goblinModuleAttackResponses(f.s, outcome)).toEqual([]);
    f.s.minions.push(p);
    expect(
      goblinModuleAttackResponses(f.s, { ...outcome, performed: false }),
    ).toEqual([]);
  });
  it("Electro response runs even after no attack damage and counts icons, not stars", () => {
    const f = fixture();
    const p = f.minion("02042");
    f.deck("02042", "02010");
    const responses = goblinModuleAttackResponses(f.s, {
      attacker: p,
      playerId: "p1",
      performed: true,
      identityDamage: 0,
      damaged: [],
    });
    f.effects(responses[0].effects);
    expect(f.s.flags.lastIndirect).toBe(2);
    expect(f.s.encounter.deck).toHaveLength(1);
  });
  it.each(["02042", "02043", "02044", "02045"])(
    "boost%s discards exactly3, doesn't run discarded boost abilities",
    (code) => {
      const f = fixture();
      f.deck("02042", "02043", "02044", "02010");
      f.effects(goblinModuleBoost(f.s, f.piece(code), "p1"));
      expect(f.ports.discardTop).toHaveBeenCalledTimes(3);
      expect(f.s.encounter.deck).toHaveLength(1);
      expect(f.s.flags.lastIndirect).toBeUndefined();
    },
  );
  it("multi-card discard stops on first empty encounter deck even after immediate reset", () => {
    const f = fixture();
    f.deck("02042");
    f.effects(goblinModuleBoost(f.s, f.piece("02045"), "p1"));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(1);
    expect(f.s.encounter.acceleration).toBe(1);
  });
  it("Electromagnetic Pulse puts actual discarded Electro without reveal and suppresses Surge if found", () => {
    const f = fixture();
    const cards = f.deck(
      "02010",
      "02042",
      "02013",
      "02037",
      "02040",
      "02044",
      "02045",
      "02010",
    );
    f.effects(goblinModuleReveal(f.s, f.piece("02043")));
    expect(f.ports.putMinion).toHaveBeenCalledWith(f.s, cards[1], "p1");
    expect(f.s.minions.map((p) => p.id)).toEqual([cards[1].id]);
    expect(f.s.encounter.dealt).toHaveLength(0);
    expect(f.s.encounter.deck).toHaveLength(1);
  });
  it("discarding Electro while another unique copy is in play does not incorrectly surge", () => {
    const f = fixture();
    const existing = f.minion("02042");
    f.deck("02042", "02010");
    f.effects(goblinModuleReveal(f.s, f.piece("02043")));
    expect(f.ports.putMinion).toHaveBeenCalled();
    expect(f.s.minions.map((p) => p.id)).toEqual([existing.id]);
    expect(f.s.encounter.dealt).toHaveLength(0);
  });
  it("Pulse no Electro discards only first available batch, then surges", () => {
    const f = fixture();
    f.deck("02010", "02013");
    f.effects(goblinModuleReveal(f.s, f.piece("02043")));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.s.encounter.dealt).toHaveLength(1);
  });
  it("Lightning Bolt sums numeric icons of exactly2 cards", () => {
    const f = fixture();
    f.deck("02042", "02040", "02010");
    f.effects(goblinModuleReveal(f.s, f.piece("02044")));
    expect(f.s.flags.lastIndirect).toBe(2);
    expect(f.s.encounter.deck).toHaveLength(1);
  });
  it("Shock Therapy discardsP cards, counts icons, and caps villain healing", () => {
    const f = fixture(2);
    f.s.villain.hp = f.s.villain.maxHp - 1;
    f.deck("02010", "02042", "02013");
    f.effects(goblinModuleReveal(f.s, f.piece("02045")));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.s.villain.hp).toBe(f.s.villain.maxHp);
  });
  it("Power Drain waits for When Defeated, presents each-player order and discards printed resources", () => {
    const f = fixture(2),
      scheme = f.side("02041");
    expect(goblinModuleReveal(f.s, scheme)).toEqual([]);
    f.deck("02042", "02040", "02010");
    const hand = f.piece("01089");
    seatView(f.s, "p2").player.hand.push(hand);
    f.effects(goblinModuleDefeated(f.s, scheme));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    f.choose("p2");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([hand.id]);
    f.choose(hand.id);
    expect(seatView(f.s, "p2").player.discard.map((p) => p.id)).toEqual([
      hand.id,
    ]);
    expect(f.ports.pay).not.toHaveBeenCalled();
    expect(f.s.prompt).toBeNull();
  });
  it("Power Drain accepts printed doubles as2 resources and stops when the hand has none eligible", () => {
    const f = fixture();
    const double = f.piece("01090");
    f.s.player.hand.push(double);
    f.effects([
      {
        type: "goblin-module:hand-resources",
        amount: 3,
        types: ["energy", "mental", "physical", "wild"],
      },
    ]);
    f.choose(double.id);
    expect(f.s.player.hand).toHaveLength(0);
    expect(f.s.prompt).toBeNull();
    expect(f.ports.discardHand).toHaveBeenCalledTimes(1);
  });
  it("Power Drain zero icons creates no forced hand discard", () => {
    const f = fixture();
    f.deck("02040", "02013", "02010");
    f.effects(goblinModuleDefeated(f.s, f.piece("02041")));
    expect(f.s.prompt).toBeNull();
    expect(f.ports.discardHand).not.toHaveBeenCalled();
  });
  it("Running Interference offers atomic mental+physical payment or2threat, with no payment cancellation", () => {
    const f = fixture();
    const p = f.side("02046", 1);
    f.effects(goblinModuleReveal(f.s, p));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["pay", "threat"]);
    f.choose("pay");
    expect(f.ports.pay).toHaveBeenCalledWith(
      f.s,
      2,
      ["mental", "physical"],
      [],
      "Running Interference",
      false,
    );
  });
  it("unpayable Running Interference requires2threat and never offers invalid payment", () => {
    const f = fixture();
    vi.mocked(f.ports.canPay).mockReturnValue(false);
    const p = f.side("02046", 1);
    f.effects(goblinModuleReveal(f.s, p));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["threat"]);
    f.choose("threat");
    expect(p.counters).toBe(3);
  });
  it("Running Interference resolves every live player in selected first-player order", () => {
    const f = fixture(2);
    vi.mocked(f.ports.canPay).mockReturnValue(false);
    const p = f.side("02046", 2);
    f.effects(goblinModuleReveal(f.s, p));
    f.choose("p2");
    expect(f.s.activePlayerId).toBe("p2");
    f.choose("threat");
    expect(f.s.activePlayerId).toBe("p1");
    f.choose("threat");
    expect(p.counters).toBe(6);
  });
  it("Tombstone needs identity damage, excludes wild-only/energy cards, and cannot use generators", () => {
    const f = fixture();
    const tomb = f.minion("02047");
    const mental = f.piece("01089"),
      wild = f.piece("01055"),
      energy = f.piece("01088");
    f.s.player.hand.push(mental, wild, energy);
    const result = {
      attacker: tomb,
      playerId: "p1",
      performed: true,
      identityDamage: 1,
      damaged: [],
    };
    expect(
      goblinModuleAttackResponses(f.s, { ...result, identityDamage: 0 }),
    ).toEqual([]);
    f.effects(goblinModuleAttackResponses(f.s, result)[0].effects);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([mental.id]);
    f.choose(mental.id);
    expect(f.ports.pay).not.toHaveBeenCalled();
  });
  it("identity attachments attach actual piece to correct multiplayer identity and remove resolving duplicate", () => {
    const f = fixture(2);
    activateSeat(f.s, "p2");
    const p = f.piece("02048");
    f.s.resolving.push(p);
    f.effects(goblinModuleReveal(f.s, p));
    expect(p.attachedTo).toBe("hero:p2");
    expect(f.s.resolving).toHaveLength(0);
    expect(goblinIdentityLocked(f.s, "p1")).toBe(false);
    expect(goblinIdentityLocked(f.s, "p2")).toBe(true);
  });
  it("All Tied Up action works in either form with exact requirements and canceled payment preserves attachment", () => {
    const f = fixture();
    const p = f.attachment("02048");
    for (const form of ["hero", "alter"] as const) {
      f.s.player.form = form;
      f.effects(goblinModuleAttachmentActions(f.s, p)[0].effects);
      expect(f.ports.pay).toHaveBeenLastCalledWith(
        f.s,
        2,
        ["mental", "physical"],
        [{ type: "goblin-module:remove", id: p.id, actorId: "p1" }],
        "All Tied Up",
        true,
      );
      expect(goblinIdentityLocked(f.s)).toBe(true);
    }
    f.effects([{ type: "goblin-module:remove", id: p.id }]);
    expect(goblinIdentityLocked(f.s)).toBe(false);
  });
  it("Media Coverage copies stack only for attached identity and its removal is alter-ego only", () => {
    const f = fixture(2);
    const p = f.attachment("02049");
    f.attachment("02049");
    f.attachment("02049", "p2");
    expect(goblinWhenRevealedCopies(f.s, "p1")).toBe(2);
    expect(goblinWhenRevealedCopies(f.s, "p2")).toBe(1);
    expect(goblinModuleAttachmentActions(f.s, p)).toEqual([]);
    f.s.player.form = "alter";
    f.effects(goblinModuleAttachmentActions(f.s, p)[0].effects);
    expect(f.ports.pay).toHaveBeenLastCalledWith(
      f.s,
      1,
      ["mental"],
      expect.any(Array),
      "Media Coverage",
      true,
    );
  });
  it("attachment actions are unavailable outside player phase or after departure", () => {
    const f = fixture();
    const p = f.attachment("02048");
    f.s.phase = "villain";
    expect(goblinModuleAttachmentActions(f.s, p)).toEqual([]);
    f.s.phase = "player";
    f.s.attachments = [];
    expect(goblinModuleAttachmentActions(f.s, p)).toEqual([]);
  });
  it("only attached identity controller may trigger or pay either attachment's action", () => {
    const f = fixture(2);
    f.s.player.form = "alter";
    for (const code of ["02048", "02049"]) {
      const p = f.attachment(code, "p2");
      expect(goblinModuleAttachmentActions(f.s, p)).toEqual([]);
      expect(() =>
        f.effects([{ type: "goblin-module:remove-cost", id: p.id }]),
      ).toThrow(/controller/);
    }
  });
  it("unknown cards/effects never claim support", () => {
    const f = fixture();
    expect(goblinModuleReveal(f.s, f.piece("01190"))).toBeNull();
    expect(goblinModuleBoost(f.s, f.piece("01190"), "p1")).toBeNull();
    expect(goblinModuleDefeated(f.s, f.piece("01190"))).toBeNull();
    expect(resolveGoblinModuleEffect(f.s, { type: "native" }, f.ports)).toBe(
      false,
    );
    expect(() => f.run({ type: "goblin-module:invented" })).toThrow(
      /Unknown Goblin/,
    );
  });
});
