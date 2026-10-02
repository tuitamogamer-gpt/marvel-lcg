import { describe, expect, it, vi } from "vitest";
import { newGame, makePiece } from "../src/game/engine";
import { activateSeat, seatView } from "../src/game/team";
import { card } from "../src/game/cards";
import type { Effect, GameState, Piece } from "../src/game/types";
import catalog from "../src/data/catalog-cards.json";
import {
  RISKY_BUSINESS_CONFIG,
  RISKY_BUSINESS_SCRIPT_CODES,
  riskySetup,
  riskyEnvironment,
  riskyCounters,
  riskyVillainForm,
  riskyBlankPower,
  riskyVillainRevealed,
  riskyActivationReplacement,
  riskyDamageReplacement,
  riskyNextVillainFace,
  riskySchemeValues,
  riskyMainCompleted,
  riskyEnvironmentEffects,
  riskyEncounterReveal,
  riskyBoost,
  resolveRiskyEffect,
  type RiskyBusinessEnginePorts,
} from "../src/game/risky-business";

function fixture(players = 1, stage = 1, side: "a" | "b" = "a") {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 420,
    pacing: "expert",
  }) as GameState & { environments: Piece[] };
  s.phase = "player";
  s.playerCount = players;
  s.player.form = "hero";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.deck = [];
  s.player.discard = [];
  s.players[0].player = s.player;
  for (let index = 1; index < players; index++)
    s.players.push({
      ...s.players[0],
      id: `p${index + 1}`,
      player: structuredClone(s.player),
      flags: {},
      eliminated: false,
    });
  s.villainId = "risky_business";
  const v = makePiece(s, `0200${stage}${side}`);
  s.villain = {
    ...v,
    stage,
    hp: card(v).health! * players,
    maxHp: card(v).health! * players,
  };
  s.scheme = { code: "02004b", index: 0, threat: 2 * players };
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.environments = [];
  s.resolving = [];
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  s.queue = [];
  s.prompt = null;
  const ports: RiskyBusinessEnginePorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    putEnvironment: vi.fn((state, code, counters) => {
      const p = makePiece(state, code);
      p.counters = counters;
      (state as typeof s).environments.push(p);
      return p;
    }),
    shuffleEncounter: vi.fn(),
    discardPlayerCards: vi.fn((state, playerId, amount) => {
      const view = seatView(state, playerId);
      const available = Math.min(amount, view.player.deck.length);
      view.player.discard.push(...view.player.deck.splice(0, available));
      if (!view.player.deck.length && view.player.discard.length) {
        view.player.deck = view.player.discard.splice(0);
        const p = state.encounter.deck.shift();
        if (p) {
          p.dealtTo = playerId;
          state.encounter.dealt.push(p);
        }
      }
    }),
    giveBoost: vi.fn((state) => {
      const p = state.encounter.deck.shift();
      if (p) (state.encounter.storedBoosts ||= []).push(p);
    }),
    activate: vi.fn(),
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    if (resolveRiskyEffect(s, e, ports)) return;
    if (e.type === "threat") {
      if (e.target === "main") s.scheme.threat += e.amount;
      else s.sideSchemes.find((p) => p.id === e.target)!.counters += e.amount;
    } else if (e.type === "damage") s.player.hp -= e.amount;
    else if (e.type === "indirect") {
      // Trace only: allocation/prevention is a native host responsibility.
      s.flags.lastIndirect = e.amount;
    } else if (e.type === "surge") {
      const p = s.encounter.deck.shift();
      if (p) {
        p.dealtTo = s.activePlayerId;
        s.encounter.dealt.push(p);
      }
    } else throw Error(`Unexpected fixture effect ${e.type}`);
  };
  const drain = () => {
    for (let n = 0; !s.prompt && s.queue.length && n < 100; n++)
      run(s.queue.shift()!);
  };
  const effects = (list: Effect[] | null) => {
    expect(list).not.toBeNull();
    ports.queue(s, ...list!);
    drain();
  };
  const choose = (id: string) => {
    const option = s.prompt?.options.find((o) => o.id === id);
    expect(option).toBeDefined();
    s.prompt = null;
    ports.queue(s, ...option!.effects);
    drain();
  };
  const environment = (
    code: "02006a" | "02006b" = side === "a" ? "02006a" : "02006b",
    counters = 2 * players,
  ) => {
    const p = makePiece(s, code);
    p.counters = counters;
    s.environments.push(p);
    return p;
  };
  const piece = (code: string) => makePiece(s, code);
  return { s, ports, run, effects, choose, drain, environment, piece };
}

describe("Risky Business complete authored scenario module", () => {
  it("owns exactly all19 imported Risky Business faces and exact configuration", () => {
    expect([...RISKY_BUSINESS_SCRIPT_CODES].sort()).toEqual(
      catalog
        .filter((c) => c.set_code === "risky_business")
        .map((c) => c.code)
        .sort(),
    );
    expect(RISKY_BUSINESS_SCRIPT_CODES).toHaveLength(19);
    expect(RISKY_BUSINESS_CONFIG).toMatchObject({
      standardVillains: ["02001a", "02002a"],
      expertVillains: ["02002a", "02003a"],
      mainSchemes: ["02004b", "02005b"],
      recommendedModule: "goblin_gimmicks",
    });
  });
  it.each([1, 2, 3])(
    "sets up%d players with one physical environment and no attack/reveal damage",
    (players) => {
      const f = fixture(players);
      f.effects(riskySetup());
      expect(f.s.environments).toHaveLength(1);
      expect(riskyEnvironment(f.s)).toMatchObject({
        code: "02006a",
        counters: 2 * players,
      });
      expect(f.s.scheme.threat).toBe(2 * players);
      expect(f.ports.shuffleEncounter).toHaveBeenCalledOnce();
      expect(f.ports.activate).not.toHaveBeenCalled();
      expect(() => f.effects(riskySetup())).toThrow(/already/);
    },
  );
  it("expert stageII still begins on Norman face without Goblin's when-revealed ability", () => {
    const f = fixture(2, 2);
    f.effects(riskySetup());
    expect(f.s.villain.code).toBe("02002a");
    expect(riskyVillainRevealed(f.s)).toEqual([]);
    expect(f.s.players.every((p) => !p.flags.lastIndirect)).toBe(true);
  });
  it.each([1, 2, 3])(
    "reports both main schemes' exact%d-player values and stage2 hazard",
    (players) => {
      const { s } = fixture(players);
      expect(riskySchemeValues(s)).toEqual({
        baseThreat: 2 * players,
        threshold: 7 * players,
        escalation: players,
      });
      s.scheme.code = "02005b";
      expect(riskySchemeValues(s)).toEqual({
        baseThreat: players,
        threshold: 10 * players,
        escalation: 2 * players,
      });
      expect(card("02005b").scheme_hazard).toBe(1);
      s.scheme.code = "01107";
      expect(riskySchemeValues(s)).toBeNull();
    },
  );
  it.each([1, 2, 3])(
    "replaces Norman stage%d attack with exact infamy without an activation",
    (stage) => {
      const f = fixture(1, stage);
      f.environment();
      f.effects(riskyActivationReplacement(f.s, "attack", f.s.villain.id));
      expect(riskyCounters(f.s, "infamy")).toBe(2 + stage);
      expect(
        riskyActivationReplacement(f.s, "scheme", f.s.villain.id),
      ).toBeNull();
      expect(f.ports.activate).not.toHaveBeenCalled();
    },
  );
  it.each([1, 2, 3])(
    "replaces Goblin stage%d scheme and flips only when all madness is removed",
    (stage) => {
      const f = fixture(1, stage, "b");
      f.environment();
      f.effects(riskyActivationReplacement(f.s, "scheme", f.s.villain.id));
      expect(riskyVillainForm(f.s)).toBe(stage === 3 ? "norman" : "goblin");
      expect(riskyCounters(f.s, "madness")).toBe(stage === 3 ? 0 : 1);
      expect(
        riskyActivationReplacement(f.s, "attack", f.s.villain.id) === null,
      ).toBe(stage !== 3);
    },
  );
  it("replaces the whole oversize damage packet, preserving HP/status/attachments/boost instances across form flip", () => {
    const f = fixture(2);
    const env = f.environment();
    f.s.villain.hp -= 3;
    f.s.villain.stunned = true;
    f.s.villain.stunCards = 1;
    const attached = f.piece("02033");
    attached.attachedTo = f.s.villain.id;
    f.s.attachments.push(attached);
    const boost = f.piece("02035");
    f.s.encounter.storedBoosts = [boost];
    f.s.players[1].player.form = "alter";
    const before = { ...f.s.villain };
    f.effects(riskyDamageReplacement(f.s, f.s.villain.id, 50));
    expect(f.s.villain).toEqual({ ...before, code: "02001b" });
    expect(f.s.environments[0].id).toBe(env.id);
    expect(f.s.environments[0]).toMatchObject({ code: "02006b", counters: 4 });
    expect(f.s.attachments[0]).toBe(attached);
    expect(f.s.encounter.storedBoosts[0]).toBe(boost);
    expect(f.s.flags.lastIndirect).toBe(3);
    expect(f.s.players[1].flags.lastIndirect).toBeUndefined();
    expect(riskyDamageReplacement(f.s, f.s.villain.id, 1)).toBeNull();
    expect(riskyDamageReplacement(f.s, f.s.villain.id, 0)).toBeNull();
  });
  it("does not replace minion damage or activation and explicitly exposes unmodifiable dash powers", () => {
    const { s } = fixture();
    expect(riskyDamageReplacement(s, "minion-id", 5)).toBeNull();
    expect(riskyActivationReplacement(s, "attack", "minion-id")).toBeNull();
    expect(riskyBlankPower(s, "attack", s.villain.id)).toBe(true);
    expect(riskyBlankPower(s, "scheme", s.villain.id)).toBe(false);
    s.villain.code = "02001b";
    expect(riskyBlankPower(s, "attack", s.villain.id)).toBe(false);
    expect(riskyBlankPower(s, "scheme", s.villain.id)).toBe(true);
  });
  it.each(["a", "b"])(
    "keeps %s face when advancing the villain stage",
    (side) => {
      const { s } = fixture(1, 1, side as "a" | "b");
      expect(riskyNextVillainFace(s, "02002a")).toBe(`02002${side}`);
      expect(() => riskyNextVillainFace(s, "01101")).toThrow();
      s.villain.code = "01101";
      expect(riskyNextVillainFace(s, "02002a")).toBeNull();
    },
  );
  it("reveals stageII to alter-ego as well as hero in chosen order", () => {
    const f = fixture(2, 2, "b");
    f.environment();
    f.s.players[1].player.form = "alter";
    f.effects(riskyVillainRevealed(f.s));
    expect(f.s.prompt?.title).toMatch(/order/);
    f.choose("p2");
    expect(f.s.players[1].flags.lastIndirect).toBe(3);
    expect(f.s.players[0].flags.lastIndirect).toBe(3);
  });
  it("reveals stageIII as four direct damage to each player in chosen order", () => {
    const f = fixture(2, 3, "b");
    f.environment();
    f.s.players[1].player.form = "alter";
    const hp = f.s.players.map((p) => p.player.hp);
    f.effects(riskyVillainRevealed(f.s));
    f.choose("p2");
    expect(f.s.players.map((p) => p.player.hp)).toEqual(hp.map((n) => n - 4));
  });
  it("completes Hostile Takeover's then-discard using new total infamy and discards each deck only until its first reset", () => {
    const f = fixture(2);
    const env = f.environment();
    for (const seat of f.s.players)
      seat.player.deck = [f.piece("01088"), f.piece("01089")];
    f.s.encounter.deck = [f.piece("02012"), f.piece("02011")];
    f.effects(riskyMainCompleted(f.s));
    expect(env.counters).toBe(6);
    expect(f.s.scheme.code).toBe("02004b"); // Completion waits for every player's discard.
    f.choose("p2");
    expect(f.ports.discardPlayerCards).toHaveBeenNthCalledWith(1, f.s, "p2", 6);
    expect(f.ports.discardPlayerCards).toHaveBeenNthCalledWith(2, f.s, "p1", 6);
    expect(f.s.players.map((seat) => seat.player.deck.length)).toEqual([2, 2]);
    expect(f.s.encounter.dealt.map((p) => p.dealtTo)).toEqual(["p2", "p1"]);
    expect(f.s.scheme).toEqual({ code: "02005b", index: 1, threat: 2 });
  });
  it("does not perform Hostile Takeover's then-discard when Criminal Enterprise is not in play", () => {
    const f = fixture(2, 1, "b");
    f.environment();
    f.effects(riskyMainCompleted(f.s));
    expect(f.ports.discardPlayerCards).not.toHaveBeenCalled();
    expect(f.s.scheme).toEqual({ code: "02005b", index: 1, threat: 2 });
  });
  it("loses on final main scheme completion and exposes no hook for an unrelated main scheme", () => {
    const f = fixture();
    f.s.scheme.code = "02005b";
    f.effects(riskyMainCompleted(f.s));
    expect(f.s.phase).toBe("lost");
    f.s.scheme.code = "01107";
    expect(riskyMainCompleted(f.s)).toBeNull();
  });
  it.each(["02007", "02008", "02009", "02011", "02012"])(
    "implements %s boost counter fallback for both environment faces",
    (code) => {
      let f = fixture();
      f.environment();
      f.effects(riskyBoost(f.s, f.piece(code)));
      expect(riskyCounters(f.s, "infamy")).toBe(3);
      f = fixture(1, 1, "b");
      f.environment();
      f.effects(riskyBoost(f.s, f.piece(code)));
      expect(riskyCounters(f.s, "madness")).toBe(1);
      expect(riskyVillainForm(f.s)).toBe("goblin");
    },
  );
  it("counter fallback flips immediately and prepares ongoing attack's Norman dash calculation", () => {
    const f = fixture(1, 1, "b");
    f.environment("02006b", 1);
    f.effects(riskyBoost(f.s, f.piece("02007")));
    expect(riskyVillainForm(f.s)).toBe("norman");
    expect(riskyCounters(f.s, "infamy")).toBe(2);
    expect(riskyBlankPower(f.s, "attack", f.s.villain.id)).toBe(true);
  });
  it("uses two counters on All in a Day's Work reveal, unlike its one-counter boost", () => {
    const f = fixture();
    f.environment();
    f.effects(riskyEncounterReveal(f.s, f.piece("02012")));
    expect(riskyCounters(f.s, "infamy")).toBe(4);
    f.s.villain.code = "02001b";
    f.s.environments[0].code = "02006b";
    f.s.environments[0].counters = 2;
    f.effects(riskyEncounterReveal(f.s, f.piece("02012")));
    expect(riskyVillainForm(f.s)).toBe("norman");
  });
  it("Hired Gun optionally adds two infamy or stores the actual facedown boost", () => {
    const f = fixture();
    f.environment();
    const boost = f.piece("02013");
    f.s.encounter.deck = [boost];
    f.effects(riskyEncounterReveal(f.s, f.piece("02007")));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["boost", "infamy"]);
    f.choose("boost");
    expect(f.s.encounter.storedBoosts).toEqual([boost]);
    expect(f.s.encounter.deck).toHaveLength(0);
    expect(riskyCounters(f.s, "infamy")).toBe(2);
  });
  it("does not offer unavailable infamy placement to Hired Gun while State of Madness is faceup", () => {
    const f = fixture(1, 1, "b");
    f.environment();
    f.effects(riskyEncounterReveal(f.s, f.piece("02007")));
    expect(f.s.prompt).toBeNull();
    expect(f.ports.giveBoost).toHaveBeenCalledWith(f.s, f.s.villain.id, "next");
  });
  it("Hired Gun infamy choice resolves the exact printed two counters", () => {
    const f = fixture();
    f.environment();
    f.effects(riskyEncounterReveal(f.s, f.piece("02007")));
    f.choose("infamy");
    expect(riskyCounters(f.s, "infamy")).toBe(4);
  });
  it.each(["a", "b"])(
    "Oscorp Manufacturing%s reveal adds threat only for Norman face",
    (side) => {
      const f = fixture(2, 1, side as "a" | "b");
      const scheme = f.piece("02010");
      scheme.counters = 4;
      f.s.sideSchemes.push(scheme);
      f.effects(riskyEncounterReveal(f.s, scheme));
      expect(scheme.counters).toBe(side === "a" ? 6 : 4);
    },
  );
  it("Mad Genius in Norman form discards only its revealer's deck for exact infamy", () => {
    const f = fixture(2);
    f.environment("02006a", 5);
    f.effects(riskyEncounterReveal(f.s, f.piece("02013")));
    expect(f.ports.discardPlayerCards).toHaveBeenCalledWith(f.s, "p1", 5);
    expect(f.ports.activate).not.toHaveBeenCalled();
  });
  it("Mad Genius chooses the lowest remaining-HP hero, excludes alter-egos and retains original revealer for callback", () => {
    const f = fixture(3, 1, "b");
    f.environment();
    f.s.players[0].player.hp = 5;
    f.s.players[1].player.hp = 3;
    f.s.players[2].player.form = "alter";
    f.s.players[2].player.hp = 1;
    f.effects(riskyEncounterReveal(f.s, f.piece("02013")));
    const request = vi.mocked(f.ports.activate).mock.calls[0][1];
    expect(request).toMatchObject({
      playerId: "p2",
      kind: "attack",
      modifier: 0,
      after: { revealerId: "p1", actorId: "p1" },
    });
    f.run({ ...request.after!, performed: false });
    f.drain();
  });
  it("Mad Genius tie belongs to first player and cancellation surges to the original revealer", () => {
    const f = fixture(2, 1, "b");
    f.environment();
    f.s.players[0].player.hp = f.s.players[1].player.hp = 5;
    f.s.firstPlayerId = "p2";
    f.s.encounter.deck = [f.piece("02007")];
    f.effects(riskyEncounterReveal(f.s, f.piece("02013")));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p2", "p1"]);
    f.choose("p2");
    const request = vi.mocked(f.ports.activate).mock.calls[0][1];
    f.run({ ...request.after!, performed: false });
    f.drain();
    expect(f.s.encounter.dealt[0].dealtTo).toBe("p1");
  });
  it("Mad Genius surges without an attack if no hero is eligible, and does not surge after an actual attack", () => {
    const f = fixture(2, 1, "b");
    f.environment();
    f.s.encounter.deck = [f.piece("02007")];
    f.s.players.forEach((seat) => {
      seat.player.form = "alter";
    });
    f.effects(riskyEncounterReveal(f.s, f.piece("02013")));
    expect(f.ports.activate).not.toHaveBeenCalled();
    expect(f.s.encounter.dealt[0].dealtTo).toBe("p1");
    const before = f.s.encounter.dealt.length;
    f.run({
      type: "risky:mad-genius-after",
      performed: true,
      revealerId: "p1",
    });
    f.drain();
    expect(f.s.encounter.dealt).toHaveLength(before);
  });
  it("guards constant zero-counter flips against duplicate queueing and stale flip effects", () => {
    const f = fixture();
    const env = f.environment("02006a", 0);
    expect(riskyEnvironmentEffects(f.s)).toEqual([
      { type: "risky:flip", id: env.id },
    ]);
    f.s.queue.push(...riskyEnvironmentEffects(f.s));
    expect(riskyEnvironmentEffects(f.s)).toEqual([]);
    env.counters = 1;
    f.drain();
    expect(env.code).toBe("02006a");
  });
  it("has explicit no-ability results for Guard/Crisis/Hazard and no invented scripts for foreign cards", () => {
    const f = fixture();
    for (const code of ["02008", "02009", "02011"])
      expect(riskyEncounterReveal(f.s, f.piece(code))).toEqual([]);
    for (const code of ["02010", "02013"])
      expect(riskyBoost(f.s, f.piece(code))).toEqual([]);
    expect(riskyBoost(f.s, f.piece("02035"))).toBeNull();
    expect(riskyEncounterReveal(f.s, f.piece("02035"))).toBeNull();
    expect(resolveRiskyEffect(f.s, { type: "foreign" }, f.ports)).toBe(false);
    expect(() =>
      resolveRiskyEffect(f.s, { type: "risky:unknown" }, f.ports),
    ).toThrow(/Unknown/);
  });
});
