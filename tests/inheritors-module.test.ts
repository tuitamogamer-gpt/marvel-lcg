import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import corePlayers from "../src/data/core-player.json";
import { makePiece, newGame } from "../src/game/engine";
import { activateSeat, seatView } from "../src/game/team";
import type { Card, Effect, GameState, Piece } from "../src/game/types";
import {
  INHERITORS_SCRIPT_CODES,
  INHERITORS_SET,
  inheritorsBoost,
  inheritorsModifiers,
  inheritorsQualifyingPlayers,
  inheritorsReveal,
  inheritorsVillainPhaseInterrupts,
  resolveInheritorsEffect,
  type InheritorsPorts,
} from "../src/game/inheritors";

const definitions = new Map(
  ([...catalog, ...corePlayers] as Card[]).map((c) => [c.code, c]),
);

function fixture(count = 1) {
  let s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 30030,
    pacing: "expert",
  });
  s.phase = "player";
  s.player.form = "hero";
  s.player.inPlay = [];
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.playerCount = count;
  s.flags = {};
  s.players[0].player = s.player;
  s.players[0].flags = s.flags;
  for (let i = 1; i < count; i++)
    s.players.push({
      ...s.players[0],
      id: `p${i + 1}`,
      player: structuredClone(s.player),
      flags: {},
      eliminated: false,
    });
  s.scheme.threat = 0;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.resolving = [];
  s.queue = [];
  s.prompt = null;
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };

  const ports: InheritorsPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    hasTrait: (state, target, trait) => {
      const identity = target === "hero" || target.startsWith("hero:");
      const canonical =
        target === "hero" ? `hero:${state.activePlayerId}` : target;
      if (state.flags[`testTrait:${canonical}:${trait}`]) return true;
      if (identity)
        return (
          state.heroId === "ghost_spider" &&
          state.player.form === "hero" &&
          trait === "Web-Warrior"
        );
      const piece = state.player.inPlay.find((p) => p.id === target);
      return (
        !!piece && !!definitions.get(piece.code)?.traits?.includes(`${trait}.`)
      );
    },
    controlledCharacters: (state) => [
      { id: `hero:${state.activePlayerId}`, label: state.heroId },
      ...state.player.inPlay
        .filter(
          (p) =>
            !p.treatedAsMinion && definitions.get(p.code)?.type_code === "ally",
        )
        .map((p) => ({
          id: p.id,
          label: definitions.get(p.code)!.name,
          code: p.code,
        })),
    ],
    statusEligible: (state, target) => {
      const p = target.startsWith("hero:")
        ? seatView(state, target.slice(5)).player
        : state.player.inPlay.find((p) => p.id === target);
      return !!p && !p.stunned && !state.flags[`testImmune:${target}`];
    },
    canDiscardControlled: (state, p) =>
      state.player.inPlay.some((x) => x.id === p.id) &&
      !definitions.get(p.code)?.permanent &&
      !state.flags[`testCannotDiscard:${p.id}`],
    discardControlled: vi.fn((state: GameState, id: string) => {
      const index = state.player.inPlay.findIndex((p) => p.id === id);
      if (index >= 0)
        state.player.discard.push(...state.player.inPlay.splice(index, 1));
    }),
    discardTop: vi.fn((state: GameState) => {
      const piece = state.encounter.deck.shift();
      if (piece) state.encounter.discard.push(piece);
      const emptied = !!piece && !state.encounter.deck.length;
      if (emptied) {
        state.encounter.acceleration++;
        // Match the host's immediate native recycle, with deterministic order.
        state.encounter.deck = state.encounter.discard.splice(0);
      }
      return { piece, emptied };
    }),
    putMinion: vi.fn((state: GameState, piece: Piece, playerId: string) => {
      for (const zone of [state.encounter.deck, state.encounter.discard]) {
        const index = zone.findIndex((p) => p.id === piece.id);
        if (index >= 0) zone.splice(index, 1);
      }
      piece.engagedWith = playerId;
      if (!state.minions.some((p) => p.code === piece.code))
        state.minions.push(piece);
      // Deliberately no reveal call: the authored hook must never require one.
    }),
    giveBoost: vi.fn(),
    damageSimultaneously: vi.fn(),
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    if (resolveInheritorsEffect(s, e, ports)) return;
    if (e.type === "threat") {
      if (e.target === "main") s.scheme.threat += e.amount;
      else s.sideSchemes.find((p) => p.id === e.target)!.counters += e.amount;
    } else if (e.type === "status") {
      const p = e.target.startsWith("hero:")
        ? seatView(s, e.target.slice(5)).player
        : e.target === "hero"
          ? s.player
          : [...s.minions, ...s.player.inPlay].find((p) => p.id === e.target)!;
      p[e.status as "stunned" | "tough"] = true;
    } else if (e.type === "damage") {
      expect(e.source).toBeDefined();
      s.player.hp -= e.amount;
    } else throw Error(`Unknown fixture effect: ${e.type}`);
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
  const side = (code = "30030", threat = 6) => {
    const p = piece(code);
    p.counters = threat;
    s.sideSchemes.push(p);
    return p;
  };
  const controlled = (code: string, playerId = s.activePlayerId) => {
    const p = piece(code);
    p.ownerId = playerId;
    seatView(s, playerId).player.inPlay.push(p);
    return p;
  };
  const web = (playerId = "p1", form: "hero" | "alter" = "hero") => {
    s.players.find((p) => p.id === playerId)!.heroId = "ghost_spider";
    seatView(s, playerId).player.form = form;
    if (s.activePlayerId === playerId) s.heroId = "ghost_spider";
  };
  const deck = (...codes: string[]) => {
    s.encounter.deck = codes.map(piece);
    return [...s.encounter.deck];
  };
  return {
    get s() {
      return s;
    },
    ports,
    piece,
    minion,
    side,
    controlled,
    web,
    deck,
    run,
    drain,
    effects,
    choose,
    reload() {
      s = JSON.parse(JSON.stringify(s)) as GameState;
    },
  };
}

describe("Inheritors module authored hooks and native port contracts", () => {
  it("bounds exactly nine unchanged source faces and nine physical cards, with no boost abilities", () => {
    const source = catalog.filter((c) => c.set_code === INHERITORS_SET);
    expect([...INHERITORS_SCRIPT_CODES]).toEqual(source.map((c) => c.code));
    expect(source).toHaveLength(9);
    expect(source.reduce((n, c) => n + c.quantity, 0)).toBe(9);
    expect(source.find((c) => c.code === "30030")!.base_threat_fixed).toBe(
      true,
    );
    expect(source.every((c) => !(c as Card).boost_star)).toBe(true);
    const f = fixture();
    for (const c of source)
      expect(inheritorsBoost(f.s, f.piece(c.code))).toEqual([]);
    expect(inheritorsBoost(f.s, f.piece("01103"))).toBeNull();
    expect(inheritorsReveal(f.s, f.piece("01103"))).toBeNull();
  });

  it("grants all eight global auras to every Inheritor, including self, without a Web-Warrior", () => {
    const f = fixture(2);
    const recipients = INHERITORS_SCRIPT_CODES.slice(1).map((code, i) =>
      f.minion(code, i % 2 ? "p2" : "p1"),
    );
    const expected = {
      attack: 1,
      acceleration: 1,
      patrol: true,
      stalwart: true,
      guard: true,
      overkill: true,
      piercing: true,
      villainous: true,
      retaliate: 1,
    };
    for (const p of recipients)
      expect(inheritorsModifiers(f.s, p)).toEqual(expected);
    const unrelated = f.minion("01103");
    expect(
      Object.values(inheritorsModifiers(f.s, unrelated)).some(Boolean),
    ).toBe(false);
    expect(
      Object.values(inheritorsModifiers(f.s, f.s.villain)).some(Boolean),
    ).toBe(false);
    expect(
      Object.values(inheritorsModifiers(f.s, f.piece("30036"))).some(Boolean),
    ).toBe(false);
  });

  it("updates numeric grants on source removal/blanking and retains incoming grants on blanked recipients", () => {
    const f = fixture();
    const target = f.minion("30034");
    const a = f.minion("30036"),
      b = f.minion("30036");
    const bora = f.minion("30031"),
      verna = f.minion("30038");
    expect(inheritorsModifiers(f.s, target).attack).toBe(2);
    a.treatedAsMinion = true; // Native blanking, preserving printed traits.
    expect(inheritorsModifiers(f.s, target).attack).toBe(1);
    target.treatedAsMinion = true;
    expect(inheritorsModifiers(f.s, target)).toMatchObject({
      attack: 1,
      acceleration: 1,
      retaliate: 1,
      guard: false,
    });
    f.s.minions = f.s.minions.filter((p) => p.id !== b.id && p.id !== bora.id);
    expect(inheritorsModifiers(f.s, target)).toMatchObject({
      attack: 0,
      acceleration: 0,
      retaliate: 1,
    });
    delete a.treatedAsMinion;
    expect(inheritorsModifiers(f.s, target).attack).toBe(1);
    f.s.minions = f.s.minions.filter((p) => p.id !== verna.id);
    expect(inheritorsModifiers(f.s, target).retaliate).toBe(0);
  });

  it("counts actual current-face identities/allies across seats, excluding supports, inactive faces and eliminated seats", () => {
    const f = fixture(3);
    f.controlled("27023", "p1");
    f.web("p2", "alter");
    expect(inheritorsQualifyingPlayers(f.s, f.ports)).toEqual([]);
    f.web("p2");
    expect(inheritorsQualifyingPlayers(f.s, f.ports).map((p) => p.id)).toEqual([
      "p2",
    ]);
    const ally = f.controlled("27010", "p3");
    expect(inheritorsQualifyingPlayers(f.s, f.ports).map((p) => p.id)).toEqual([
      "p2",
      "p3",
    ]);
    ally.treatedAsMinion = true;
    f.s.players[1].eliminated = true;
    expect(inheritorsQualifyingPlayers(f.s, f.ports)).toEqual([]);
    delete ally.treatedAsMinion;
    activateSeat(f.s, "p3");
    expect(inheritorsQualifyingPlayers(f.s, f.ports).map((p) => p.id)).toEqual([
      "p3",
    ]);
  });

  it("honors a native trait grant on an actual ally or current identity, including an alter ego", () => {
    const f = fixture(2);
    const ally = f.controlled("01083");
    f.s.flags[`testTrait:${ally.id}:Web-Warrior`] = true;
    expect(inheritorsQualifyingPlayers(f.s, f.ports).map((p) => p.id)).toEqual([
      "p1",
    ]);
    f.s.flags = f.s.players[0].flags = {};
    f.web("p2", "alter");
    seatView(f.s, "p2").flags["testTrait:hero:p2:Web-Warrior"] = true;
    expect(inheritorsQualifyingPlayers(f.s, f.ports).map((p) => p.id)).toEqual([
      "p2",
    ]);
  });

  it.each(INHERITORS_SCRIPT_CODES.slice(1))(
    "%s reveal does nothing without any Web-Warrior character",
    (code) => {
      const f = fixture(2);
      f.web("p2", "alter");
      f.controlled("27023");
      f.controlled("01092");
      const p = f.minion(code);
      f.side();
      const hp = f.s.player.hp;
      f.effects(inheritorsReveal(f.s, p));
      expect(f.s.prompt).toBeNull();
      expect(f.s.scheme.threat).toBe(0);
      expect(f.s.sideSchemes[0].counters).toBe(6);
      expect(f.s.player.hp).toBe(hp);
      expect(p.tough).toBe(false);
      expect(f.ports.giveBoost).not.toHaveBeenCalled();
      expect(f.ports.damageSimultaneously).not.toHaveBeenCalled();
      expect(f.ports.discardControlled).not.toHaveBeenCalled();
    },
  );

  it("Bora and Brix use another player's Web-Warrior and native source-attributed scheme threat", () => {
    const f = fixture(2);
    f.web("p2");
    const mainSide = f.side(),
      other = f.side("01107", 2);
    const bora = f.minion("30031");
    f.effects(inheritorsReveal(f.s, bora));
    expect(f.s.scheme.threat).toBe(1);
    expect(mainSide.counters).toBe(7);
    expect(other.counters).toBe(3);
    f.effects(inheritorsReveal(f.s, f.minion("30032")));
    expect(f.s.scheme.threat).toBe(3);
    expect(mainSide.counters).toBe(7);
    expect(f.s.activePlayerId).toBe("p1");
  });

  it("Daemos prompts only eligible controlled characters and keeps the revealer through hydration", () => {
    const f = fixture(2);
    f.web("p2");
    f.s.player.form = "alter";
    const legal = f.controlled("01083"),
      stunned = f.controlled("27010");
    stunned.stunned = true;
    f.controlled("01092");
    f.s.flags["testImmune:hero:p1"] = true;
    f.effects(inheritorsReveal(f.s, f.minion("30033")));
    expect(f.s.prompt?.title).toBe("Daemos");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([legal.id]);
    f.reload();
    activateSeat(f.s, "p2");
    f.choose(legal.id);
    expect(
      seatView(f.s, "p1").player.inPlay.find((p) => p.id === legal.id)!.stunned,
    ).toBe(true);
    expect(seatView(f.s, "p2").player.stunned).toBe(false);
  });

  it("Daemos includes the revealer's alter-ego identity and avoids empty or stale status choices", () => {
    const f = fixture(2);
    f.web("p2");
    f.s.player.form = "alter";
    const daemos = f.minion("30033");
    f.effects(inheritorsReveal(f.s, daemos));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["hero:p1"]);
    f.s.player.stunned = true;
    expect(() => f.choose("hero:p1")).toThrow(/cannot receive a stun/);
    f.s.prompt = null;
    f.effects(inheritorsReveal(f.s, daemos));
    expect(f.s.prompt).toBeNull();
  });

  it("Jennix's native tough targets its actual instance and Morlun damages only the original revealer", () => {
    const f = fixture(2);
    f.web("p2");
    const jennix = f.minion("30034");
    f.effects(inheritorsReveal(f.s, jennix));
    expect(jennix.tough).toBe(true);
    const hp = f.s.player.hp,
      otherHp = seatView(f.s, "p2").player.hp;
    f.effects(inheritorsReveal(f.s, f.minion("30036")));
    expect(f.s.player.hp).toBe(hp - 2);
    expect(seatView(f.s, "p2").player.hp).toBe(otherHp);
  });

  it("Karn discards an actual eligible controlled support/upgrade and revalidates native restrictions", () => {
    const f = fixture(2);
    f.web("p2");
    const support = f.controlled("01092"),
      upgrade = f.controlled("01057");
    f.controlled("01083");
    const other = f.controlled("01092", "p2");
    const restricted = f.controlled("01057");
    f.s.flags[`testCannotDiscard:${restricted.id}`] = true;
    const karn = f.minion("30035");
    f.effects(inheritorsReveal(f.s, karn));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      support.id,
      upgrade.id,
    ]);
    f.reload();
    activateSeat(f.s, "p2");
    f.choose(support.id);
    expect(vi.mocked(f.ports.discardControlled).mock.calls[0][1]).toBe(
      support.id,
    );
    expect(seatView(f.s, "p1").player.discard.map((p) => p.id)).toContain(
      support.id,
    );
    expect(seatView(f.s, "p2").player.inPlay.map((p) => p.id)).toContain(
      other.id,
    );
    f.effects(inheritorsReveal(f.s, karn));
    f.s.flags[`testCannotDiscard:${upgrade.id}`] = true;
    expect(() => f.choose(upgrade.id)).toThrow(/cannot be discarded/);
  });

  it("Karn has no invented penalty or empty prompt when no support or upgrade can be discarded", () => {
    const f = fixture();
    f.web();
    f.controlled("01083");
    f.effects(inheritorsReveal(f.s, f.minion("30035")));
    expect(f.s.prompt).toBeNull();
    expect(f.ports.discardControlled).not.toHaveBeenCalled();
  });

  it("Solus assigns a retained physical boost to its own existing minion instance", () => {
    const f = fixture();
    f.web();
    const solus = f.minion("30037");
    f.effects(inheritorsReveal(f.s, solus));
    expect(vi.mocked(f.ports.giveBoost).mock.calls[0]).toEqual([f.s, solus.id]);
    f.effects(inheritorsReveal(f.s, f.piece("30037")));
    expect(f.ports.giveBoost).toHaveBeenCalledTimes(1);
  });

  it("Verna requests one simultaneous native damage batch for the revealer's identity and actual allies", () => {
    const f = fixture(2);
    f.web("p2");
    f.s.player.form = "alter";
    const a = f.controlled("01083"),
      b = f.controlled("27010");
    f.controlled("01092");
    f.controlled("01057");
    const minionAlly = f.controlled("27010");
    minionAlly.treatedAsMinion = true;
    f.controlled("01083", "p2");
    const verna = f.minion("30038");
    f.effects(inheritorsReveal(f.s, verna));
    expect(vi.mocked(f.ports.damageSimultaneously).mock.calls).toEqual([
      [f.s, ["hero:p1", a.id, b.id], 1, verna.id],
    ]);
  });

  it("Hunting discards exactly the top three then PUTs only discarded Inheritors without reveal penalties", () => {
    const f = fixture(2);
    f.web("p2");
    const hunt = f.side();
    const [bora, unrelated, solus, untouched] = f.deck(
      "30031",
      "01103",
      "30037",
      "30036",
    );
    f.effects(inheritorsVillainPhaseInterrupts(f.s));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(3);
    expect(f.s.minions.map((p) => [p.id, p.engagedWith])).toEqual([
      [bora.id, "p2"],
      [solus.id, "p2"],
    ]);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual([untouched.id]);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([unrelated.id]);
    expect(hunt.counters).toBe(6);
    expect(f.s.scheme.threat).toBe(0);
    expect(f.ports.giveBoost).not.toHaveBeenCalled();
    expect(f.s.prompt).toBeNull();
    expect(inheritorsReveal(f.s, hunt)).toEqual([]);
  });

  it("Hunting prompts the first player for each eligible recipient and retains actual IDs across reload", () => {
    const f = fixture(2);
    f.web("p1");
    f.web("p2");
    f.s.firstPlayerId = "p2";
    f.side();
    const [bora, karn] = f.deck("30031", "30035", "01103", "01110");
    f.effects(inheritorsVillainPhaseInterrupts(f.s));
    expect(f.s.activePlayerId).toBe("p2");
    expect(f.s.prompt?.title).toBe("Hunting the Spider-Totems");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p2", "p1"]);
    f.reload();
    f.choose("p1");
    expect(f.s.minions[0]).toMatchObject({ id: bora.id, engagedWith: "p1" });
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p2", "p1"]);
    f.reload();
    f.choose("p2");
    expect(f.s.minions[1]).toMatchObject({ id: karn.id, engagedWith: "p2" });
    const actual = [
      ...f.s.minions,
      ...f.s.encounter.deck,
      ...f.s.encounter.discard,
    ];
    expect(actual.filter((p) => p.id === bora.id)).toHaveLength(1);
    expect(actual.filter((p) => p.id === karn.id)).toHaveLength(1);
    expect(f.s.prompt).toBeNull();
  });

  it("Hunting falls back to the first player and never counts a Web-Warrior support or inactive hero face", () => {
    const f = fixture(2);
    f.s.firstPlayerId = "p2";
    f.web("p1", "alter");
    f.controlled("27023", "p1");
    f.side();
    const [morlun] = f.deck("30036", "01103", "01110", "30038");
    f.effects(inheritorsVillainPhaseInterrupts(f.s));
    expect(f.s.minions[0]).toMatchObject({ id: morlun.id, engagedWith: "p2" });
    expect(f.s.prompt).toBeNull();
  });

  it("Hunting stops at the native exhaustion boundary and removes reshuffled physical instances before entry", () => {
    const f = fixture();
    f.side();
    const unrelatedInheritor = f.piece("30036");
    f.s.encounter.discard.push(unrelatedInheritor);
    const [bora, verna] = f.deck("30031", "30038");
    f.effects(inheritorsVillainPhaseInterrupts(f.s));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual([
      unrelatedInheritor.id,
    ]);
    expect(f.s.minions.map((p) => p.id)).toEqual([bora.id, verna.id]);
    expect(f.s.encounter.discard).toEqual([]);
  });

  it("Hunting revalidates a saved seat choice and source before initiating, but completes after its source leaves", () => {
    const f = fixture(2);
    f.web("p1");
    f.web("p2");
    const hunt = f.side();
    f.deck("30031", "01103", "01110", "30035");
    f.effects(inheritorsVillainPhaseInterrupts(f.s));
    const choice = f.s.prompt!.options.find((o) => o.id === "p2")!.effects[0];
    f.s.prompt = null;
    f.s.players[1].eliminated = true;
    f.s.sideSchemes = [];
    f.effects([JSON.parse(JSON.stringify(choice))]);
    expect(f.s.minions[0].engagedWith).toBe("p1");
    const before = vi.mocked(f.ports.discardTop).mock.calls.length;
    f.effects([{ type: "inheritors:hunt", id: hunt.id, actorId: "p1" }]);
    expect(f.ports.discardTop).toHaveBeenCalledTimes(before);
  });

  it("omits blanked Hunting and reveal sources, and dispatches only its own effect namespace", () => {
    const f = fixture();
    const hunt = f.side();
    hunt.treatedAsMinion = true;
    expect(inheritorsVillainPhaseInterrupts(f.s)).toEqual([]);
    const bora = f.minion("30031");
    bora.treatedAsMinion = true;
    expect(inheritorsReveal(f.s, bora)).toEqual([]);
    expect(
      resolveInheritorsEffect(f.s, { type: "draw", amount: 1 }, f.ports),
    ).toBe(false);
    expect(() =>
      resolveInheritorsEffect(f.s, { type: "inheritors:unknown" }, f.ports),
    ).toThrow(/Unknown Inheritors/);
  });
});
