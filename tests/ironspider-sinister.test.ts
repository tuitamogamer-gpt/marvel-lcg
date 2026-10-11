import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Effect, GameState, Piece } from "../src/game/types.js";
import {
  IRONSPIDER_SINISTER_SCRIPT_CODES,
  IRONSPIDER_SINISTER_SET,
  ironspiderSinisterActionEffects,
  ironspiderSinisterActions,
  ironspiderSinisterActivationResponses,
  ironspiderSinisterAttackDamageReplacement,
  ironspiderSinisterAttackReplacement,
  ironspiderSinisterBoost,
  ironspiderSinisterCriminalSurge,
  ironspiderSinisterDamageResponses,
  ironspiderSinisterDefeatResponses,
  ironspiderSinisterEngagementResponses,
  ironspiderSinisterHealthBonus,
  ironspiderSinisterOverkill,
  ironspiderSinisterReveal,
  ironspiderSinisterThwartBlocked,
  resolveIronspiderSinisterEffect,
  type IronspiderSinisterPorts,
} from "../src/game/ironspider-sinister.js";

const source = catalog.filter((p) => p.set_code === IRONSPIDER_SINISTER_SET);
function fixture(team = false) {
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    seed: 31030,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.player.form = "hero";
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.environments = [];
  s.queue = [];
  s.prompt = null;
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.hand = [];
    p.inPlay = [];
  }
  const ports: IronspiderSinisterPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    pay: vi.fn(),
    canPay: () => !s.flags.testCannotPay,
    discardTop: vi.fn((state: GameState) => {
      const piece = state.encounter.deck.shift();
      if (piece) state.encounter.discard.push(piece);
      const emptied = !!piece && !state.encounter.deck.length;
      if (emptied) {
        state.encounter.acceleration++;
        state.encounter.deck = state.encounter.discard.splice(0);
      }
      return { piece, emptied };
    }),
    putMinion: vi.fn(),
    discardPiece: vi.fn(),
    shuffleIntoEncounter: vi.fn(),
    hasTrait: (state, id, trait) => {
      if (state.flags[`testTrait:${id}:${trait}`]) return true;
      const p = state.minions.find((q) => q.id === id);
      return (
        !!p &&
        !!catalog.find((c) => c.code === p.code)?.traits?.includes(`${trait}.`)
      );
    },
    controlledCharacters: (state) => [
      { id: `hero:${state.activePlayerId}`, label: state.heroId },
      ...state.player.inPlay
        .filter((p) => !p.treatedAsMinion)
        .map((p) => ({
          id: p.id,
          label: p.code,
          code: p.code,
        })),
    ],
    enemyAttack: vi.fn(() => 2),
    attachHand: vi.fn((state: GameState, p: Piece, enemyId: string) => {
      const index = state.player.hand.findIndex((q) => q.id === p.id);
      state.player.hand.splice(index, 1);
      p.attachedTo = enemyId;
      state.attachments.push(p);
    }),
    indirect: vi.fn(),
    attackDamage: vi.fn(),
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    expect(resolveIronspiderSinisterEffect(s, e, ports), e.type).toBe(true);
  };
  const drain = () => {
    for (let n = 0; s.queue.length && !s.prompt && n < 100; n++)
      run(s.queue.shift()!);
  };
  const effects = (list: Effect[] | null) => {
    expect(list).not.toBeNull();
    ports.queue(s, ...list!);
    drain();
  };
  const choose = (id: string) => {
    const option = s.prompt?.options.find((p) => p.id === id);
    expect(option, JSON.stringify(s.prompt)).toBeDefined();
    s.prompt = null;
    ports.queue(s, ...option!.effects);
    drain();
  };
  const piece = (code: string) => makePiece(s, code);
  const minion = (code: string, seatId = "p1") => {
    const p = piece(code);
    p.engagedWith = seatId;
    s.minions.push(p);
    return p;
  };
  const environment = () => {
    const p = piece("31037");
    s.environments!.push(p);
    return p;
  };
  const blank = (p: Piece) => {
    s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
  };
  return {
    get s() {
      return s;
    },
    ports,
    piece,
    minion,
    environment,
    blank,
    run,
    effects,
    choose,
    reload() {
      s = JSON.parse(JSON.stringify(s));
    },
  };
}

describe("Original Iron Spider's Sinister Six authored rules", () => {
  it("bounds the unchanged eight source faces and quantities", () => {
    expect(source.map((p) => p.code)).toEqual([
      ...IRONSPIDER_SINISTER_SCRIPT_CODES,
    ]);
    expect(source).toHaveLength(8);
    expect(source.reduce((n, p) => n + p.quantity, 0)).toBe(8);
    expect(source[0]).toMatchObject({
      base_threat: 4,
      base_threat_fixed: true,
      scheme_crisis: 1,
    });
  });
  it("claims all and only the eight source reveals", () => {
    const f = fixture();
    for (const p of source)
      expect(ironspiderSinisterReveal(f.s, f.piece(p.code))).toEqual([]);
    expect(ironspiderSinisterReveal(f.s, f.piece("01103"))).toBeNull();
    expect(ironspiderSinisterBoost(f.s, f.piece("01103"))).toBeNull();
    expect(
      resolveIronspiderSinisterEffect(f.s, { type: "other" }, f.ports),
    ).toBe(false);
    expect(() => f.run({ type: "ironspider-sinister:unknown" })).toThrow(
      "Unknown Iron Spider",
    );
  });
  it("locks every removal from physical Grand Larceny for another seat's criminal", () => {
    const f = fixture(true);
    const p = f.piece("31030");
    f.s.sideSchemes.push(p);
    f.minion("31036", "p2");
    expect(ironspiderSinisterThwartBlocked(f.s, p, f.ports)).toBe(true);
    f.s.minions = [];
    expect(ironspiderSinisterThwartBlocked(f.s, p, f.ports)).toBe(false);
  });
  it("does not lock other schemes, inactive copies or noncriminals", () => {
    const f = fixture();
    const p = f.piece("31030");
    f.s.sideSchemes.push(p);
    f.minion("01110");
    expect(ironspiderSinisterThwartBlocked(f.s, p, f.ports)).toBe(false);
    f.minion("31031");
    expect(
      ironspiderSinisterThwartBlocked(f.s, f.piece("31030"), f.ports),
    ).toBe(false);
    expect(
      ironspiderSinisterThwartBlocked(f.s, f.piece("01107"), f.ports),
    ).toBe(false);
  });
  it("uses native granted Criminal traits and current minion type", () => {
    const f = fixture();
    const p = f.piece("31030");
    f.s.sideSchemes.push(p);
    const ally = f.minion("01093");
    ally.treatedAsMinion = true;
    f.s.flags[`testTrait:${ally.id}:Criminal`] = true;
    expect(ironspiderSinisterThwartBlocked(f.s, p, f.ports)).toBe(true);
  });
  it("grants Criminal Surge through one active physical environment", () => {
    const f = fixture();
    const p = f.minion("31031");
    expect(ironspiderSinisterCriminalSurge(f.s, p, f.ports)).toBe(false);
    f.environment();
    expect(ironspiderSinisterCriminalSurge(f.s, p, f.ports)).toBe(true);
    expect(
      ironspiderSinisterCriminalSurge(f.s, f.piece("01110"), f.ports),
    ).toBe(false);
  });
  it("preserves ordinary boost faces and retains only Spot's physical boost", () => {
    const f = fixture();
    for (const code of ["31030", "31032", "31033", "31034", "31037"])
      expect(ironspiderSinisterBoost(f.s, f.piece(code))).toEqual({
        effects: [],
        retainsCard: false,
      });
    const spot = f.piece("31036");
    const result = ironspiderSinisterBoost(f.s, spot)!;
    expect(result.retainsCard).toBe(true);
    f.effects(result.effects);
    expect(f.ports.putMinion).toHaveBeenCalledWith(f.s, spot, "p1");
  });
  it("Bombshell boost visits every living player and requests actual-damage exhaustion", () => {
    const f = fixture(true);
    const p = f.piece("31031");
    f.effects(ironspiderSinisterBoost(f.s, p)!.effects);
    expect(f.ports.indirect).toHaveBeenCalledTimes(2);
    expect(f.ports.indirect).toHaveBeenNthCalledWith(
      1,
      f.s,
      expect.objectContaining({
        playerId: "p1",
        amount: 1,
        sourceId: p.id,
        exhaustDamaged: true,
      }),
    );
    expect(f.ports.indirect).toHaveBeenNthCalledWith(
      2,
      f.s,
      expect.objectContaining({
        playerId: "p2",
        amount: 1,
        exhaustDamaged: true,
      }),
    );
  });
  it("does not include eliminated seats in Bombshell's each-player boost", () => {
    const f = fixture(true);
    f.s.players[1].eliminated = true;
    expect(
      ironspiderSinisterBoost(f.s, f.piece("31031"))!.effects,
    ).toHaveLength(1);
  });
  it("counts printed Energy icons of actual Electro attachments", () => {
    const f = fixture();
    const electro = f.minion("31032");
    const double = f.piece("01088");
    double.attachedTo = electro.id;
    const one = f.piece("01006");
    one.attachedTo = electro.id;
    const wild = f.piece("01011");
    wild.attachedTo = electro.id;
    const other = f.piece("01088");
    other.attachedTo = "elsewhere";
    f.s.attachments.push(double, one, wild, other);
    expect(ironspiderSinisterHealthBonus(f.s, electro)).toBe(3);
    expect(ironspiderSinisterHealthBonus(f.s, f.minion("31031"))).toBe(0);
  });
  it("forces only an actual printed Energy hand card on Electro engagement, with saved choice", () => {
    const f = fixture();
    const electro = f.minion("31032");
    const energy = f.piece("01088");
    const wild = f.piece("01011");
    const mental = f.piece("01089");
    f.s.player.hand.push(energy, wild, mental);
    f.effects(ironspiderSinisterEngagementResponses(f.s, electro));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([energy.id]);
    f.reload();
    f.choose(energy.id);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([wild.id, mental.id]);
    expect(f.s.attachments).toContainEqual(
      expect.objectContaining({ id: energy.id, attachedTo: electro.id }),
    );
    expect(ironspiderSinisterHealthBonus(f.s, f.s.minions[0])).toBe(2);
  });
  it("skips Electro's forced response when no printed Energy remains", () => {
    const f = fixture();
    const electro = f.minion("31032");
    f.s.player.hand.push(f.piece("01011"));
    f.effects(ironspiderSinisterEngagementResponses(f.s, electro));
    expect(f.s.prompt).toBeNull();
    expect(f.ports.attachHand).not.toHaveBeenCalled();
  });
  it("retains the actual new engaged seat in a saved engagement response", () => {
    const f = fixture(true);
    const electro = f.minion("31032");
    expect(ironspiderSinisterEngagementResponses(f.s, electro, "p2")).toEqual([
      expect.objectContaining({ id: electro.id, actorId: "p2" }),
    ]);
  });
  it("does not mistake Haywire replaced mental icons for printed Energy", () => {
    const f = fixture();
    const electro = f.minion("31032");
    f.s.player.hand.push(f.piece("01089"));
    const haywire = f.piece("29038");
    haywire.attachedTo = "hero:p1";
    f.s.attachments.push(haywire);
    f.effects(ironspiderSinisterEngagementResponses(f.s, electro));
    expect(f.s.prompt).toBeNull();
  });
  it("offers Electro's forced after-activation response only for the live source", () => {
    const f = fixture();
    const electro = f.minion("31032");
    expect(ironspiderSinisterActivationResponses(f.s, electro.id)).toHaveLength(
      1,
    );
    expect(ironspiderSinisterActivationResponses(f.s, "absent")).toEqual([]);
    expect(
      ironspiderSinisterActivationResponses(f.s, f.minion("31031").id),
    ).toEqual([]);
  });
  it("rejects stale Electro attachment choices without moving another card", () => {
    const f = fixture();
    const electro = f.minion("31032");
    const energy = f.piece("01088");
    f.s.player.hand.push(energy);
    f.effects(ironspiderSinisterEngagementResponses(f.s, electro));
    f.s.player.hand = [];
    expect(() => f.choose(energy.id)).toThrow("actual hand card");
    expect(f.ports.attachHand).not.toHaveBeenCalled();
  });
  it("Hobgoblin requests current native ATK and indirect boost icons, never boost stars", () => {
    const f = fixture();
    const hob = f.minion("31033");
    vi.mocked(f.ports.enemyAttack).mockReturnValue(3);
    f.s.encounter.deck.push(
      f.piece("31030"),
      f.piece("31036"),
      f.piece("31033"),
      f.piece("01103"),
    );
    f.effects(ironspiderSinisterAttackReplacement(f.s, hob));
    expect(f.ports.enemyAttack).toHaveBeenCalledWith(f.s, hob);
    expect(f.ports.discardTop).toHaveBeenCalledTimes(3);
    expect(f.ports.indirect).toHaveBeenCalledWith(
      f.s,
      expect.objectContaining({ amount: 5, playerId: "p1", sourceId: hob.id }),
    );
    expect(f.s.encounter.deck).toHaveLength(1);
    expect(f.ports.putMinion).not.toHaveBeenCalled();
  });
  it("Hobgoblin stops at the actual exhaustion boundary even after immediate reset", () => {
    const f = fixture();
    const hob = f.minion("31033");
    vi.mocked(f.ports.enemyAttack).mockReturnValue(4);
    f.s.encounter.deck.push(f.piece("31030"), f.piece("31032"));
    f.effects(ironspiderSinisterAttackReplacement(f.s, hob));
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.ports.indirect).toHaveBeenCalledWith(
      f.s,
      expect.objectContaining({ amount: 4 }),
    );
    expect(f.s.encounter.acceleration).toBe(1);
  });
  it("zero current ATK or zero discarded boost icons deals no indirect damage", () => {
    const f = fixture();
    const hob = f.minion("31033");
    vi.mocked(f.ports.enemyAttack).mockReturnValue(0);
    f.effects(ironspiderSinisterAttackReplacement(f.s, hob));
    expect(f.ports.discardTop).not.toHaveBeenCalled();
    vi.mocked(f.ports.enemyAttack).mockReturnValue(1);
    f.s.encounter.deck.push(f.piece("31036"));
    f.effects(ironspiderSinisterAttackReplacement(f.s, hob));
    expect(f.ports.indirect).not.toHaveBeenCalled();
  });
  it("Iron Spider alone receives his active Overkill grant", () => {
    const f = fixture();
    expect(ironspiderSinisterOverkill(f.s, f.minion("31034"))).toBe(true);
    expect(ironspiderSinisterOverkill(f.s, f.minion("31033"))).toBe(false);
  });
  it("Bombshell equally allocates ordinary attack damage to every controlled character", () => {
    const f = fixture();
    const bomb = f.minion("31031");
    const ally = f.piece("01093");
    f.s.player.inPlay.push(ally);
    const after = { type: "native-after-attack", token: 123 };
    f.effects(ironspiderSinisterAttackDamageReplacement(f.s, bomb, 6, after));
    expect(f.s.prompt).toBeNull();
    expect(f.ports.indirect).not.toHaveBeenCalled();
    expect(f.ports.attackDamage).toHaveBeenCalledWith(f.s, {
      sourceId: bomb.id,
      playerId: "p1",
      allocations: [
        { target: "hero:p1", amount: 3 },
        { target: ally.id, amount: 3 },
      ],
      after,
    });
  });
  it("saves Bombshell's remainder allocation and never adds a second extra point to one recipient", () => {
    const f = fixture();
    const bomb = f.minion("31031");
    const allies = [f.piece("01093"), f.piece("01067")];
    f.s.player.inPlay.push(...allies);
    f.effects(ironspiderSinisterAttackDamageReplacement(f.s, bomb, 5));
    expect(f.s.prompt?.options).toHaveLength(3);
    f.reload();
    f.choose(allies[0].id);
    expect(f.s.prompt?.options.map((p) => p.id)).toEqual([
      "hero:p1",
      allies[1].id,
    ]);
    f.reload();
    f.choose("hero:p1");
    expect(f.ports.attackDamage).toHaveBeenCalledWith(
      f.s,
      expect.objectContaining({
        allocations: [
          { target: "hero:p1", amount: 2 },
          { target: allies[0].id, amount: 2 },
          { target: allies[1].id, amount: 1 },
        ],
      }),
    );
  });
  it("includes zero-share controlled characters and does not redirect a low-HP ally's share", () => {
    const f = fixture();
    const bomb = f.minion("31031");
    const ally = f.piece("01093");
    ally.damage = 2;
    f.s.player.inPlay.push(ally);
    f.effects(ironspiderSinisterAttackDamageReplacement(f.s, bomb, 1));
    f.choose(ally.id);
    expect(f.ports.attackDamage).toHaveBeenCalledWith(
      f.s,
      expect.objectContaining({
        allocations: [
          { target: "hero:p1", amount: 0 },
          { target: ally.id, amount: 1 },
        ],
      }),
    );
  });
  it("uses the final attacked seat, excluding teammates' allies", () => {
    const f = fixture(true);
    const bomb = f.minion("31031", "p1");
    f.s.player.inPlay.push(f.piece("01093"));
    const other = f.piece("01050");
    seatView(f.s, "p2").player.inPlay.push(other);
    activateSeat(f.s, "p2");
    f.effects(ironspiderSinisterAttackDamageReplacement(f.s, bomb, 4));
    expect(f.ports.attackDamage).toHaveBeenCalledWith(
      f.s,
      expect.objectContaining({
        playerId: "p2",
        allocations: [
          { target: "hero:p2", amount: 2 },
          { target: other.id, amount: 2 },
        ],
      }),
    );
  });
  it("Sandman's surviving actual attack damage discards seven through the native port", () => {
    const f = fixture();
    const sand = f.minion("31035");
    f.s.encounter.deck.push(
      ...Array.from({ length: 9 }, () => f.piece("31033")),
    );
    f.effects(
      ironspiderSinisterDamageResponses(f.s, {
        piece: sand,
        actualDamage: 1,
        fromAttack: true,
      }),
    );
    expect(f.ports.discardTop).toHaveBeenCalledTimes(7);
    expect(f.s.encounter.deck).toHaveLength(2);
  });
  it("Sandman's lethal defeat does not initiate his Forced Response, per FFG June 2023 #17", () => {
    const f = fixture();
    const sand = f.minion("31035");
    f.s.minions = [];
    f.s.encounter.discard.push(sand);
    expect(
      ironspiderSinisterDamageResponses(f.s, {
        piece: sand,
        actualDamage: 7,
        fromAttack: true,
      }),
    ).toEqual([]);
    expect(f.ports.discardTop).not.toHaveBeenCalled();
  });
  it.each(["defeated", "blanked"])(
    "Sandman's retained response cannot initiate after its actual source is %s",
    (condition) => {
      const f = fixture();
      const sand = f.minion("31035");
      const effects = ironspiderSinisterDamageResponses(f.s, {
        piece: sand,
        actualDamage: 2,
        fromAttack: true,
      });
      expect(effects[0].sourceId).toBe(sand.id);
      if (condition === "defeated") {
        f.s.minions = [];
        f.s.encounter.discard.push(sand);
      } else f.blank(sand);
      f.effects(effects);
      expect(f.ports.discardTop).not.toHaveBeenCalled();
    },
  );
  it("Sandman ignores zero/prevented damage and nonattack damage", () => {
    const f = fixture();
    const sand = f.minion("31035");
    expect(
      ironspiderSinisterDamageResponses(f.s, {
        piece: sand,
        actualDamage: 0,
        fromAttack: true,
      }),
    ).toEqual([]);
    expect(
      ironspiderSinisterDamageResponses(f.s, {
        piece: sand,
        actualDamage: 1,
        fromAttack: false,
      }),
    ).toEqual([]);
  });
  it("Sandman's boost discards seven and stops at exhaustion without replaying boost abilities", () => {
    const f = fixture();
    const sand = f.piece("31035");
    f.s.encounter.deck.push(f.piece("31036"), f.piece("31031"));
    f.effects(ironspiderSinisterBoost(f.s, sand)!.effects);
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.ports.putMinion).not.toHaveBeenCalled();
    expect(f.ports.indirect).not.toHaveBeenCalled();
  });
  it("Spot shuffles the same actual physical card when defeated exactly, even after cleanup", () => {
    const f = fixture();
    const spot = f.minion("31036");
    const effects = ironspiderSinisterDefeatResponses(f.s, spot, 0);
    f.s.minions = [];
    f.s.encounter.discard.push(spot);
    f.effects(effects);
    expect(f.ports.shuffleIntoEncounter).toHaveBeenCalledWith(f.s, spot);
  });
  it("Spot with actual positive excess keeps the ordinary discard destination", () => {
    const f = fixture();
    const spot = f.minion("31036");
    expect(ironspiderSinisterDefeatResponses(f.s, spot, 1)).toEqual([]);
    expect(
      ironspiderSinisterDefeatResponses(f.s, f.minion("31035"), 0),
    ).toEqual([]);
  });
  it("offers Surge in Crime removal only for hero, active source, no Criminal and payable cost", () => {
    const f = fixture();
    const env = f.environment();
    expect(ironspiderSinisterActions(f.s, env, f.ports)).toHaveLength(1);
    f.s.player.form = "alter";
    expect(ironspiderSinisterActions(f.s, env, f.ports)).toEqual([]);
    f.s.player.form = "hero";
    f.s.flags.testCannotPay = true;
    expect(ironspiderSinisterActions(f.s, env, f.ports)).toEqual([]);
    delete f.s.flags.testCannotPay;
    f.minion("31031");
    expect(ironspiderSinisterActions(f.s, env, f.ports)).toEqual([]);
    expect(
      ironspiderSinisterActionEffects(f.s, env, "other", f.ports),
    ).toBeNull();
  });
  it("requests a cancelable atomic two-resource payment before any environment discard", () => {
    const f = fixture();
    const env = f.environment();
    f.effects(
      ironspiderSinisterActionEffects(
        f.s,
        env,
        "ironspider-sinister-remove",
        f.ports,
      ),
    );
    expect(f.ports.pay).toHaveBeenCalledWith(
      f.s,
      2,
      [],
      [
        expect.objectContaining({
          type: "ironspider-sinister:remove-paid",
          id: env.id,
        }),
      ],
      "Surge in Crime",
      true,
    );
    expect(f.ports.discardPiece).not.toHaveBeenCalled();
    const after = vi.mocked(f.ports.pay).mock.calls[0][3];
    f.effects(after);
    expect(f.ports.discardPiece).toHaveBeenCalledWith(f.s, env.id);
  });
  it("checks the no-Criminal condition again before committing a forged removal", () => {
    const f = fixture();
    const env = f.environment();
    f.minion("31034");
    expect(() =>
      f.run({ type: "ironspider-sinister:remove-pay", id: env.id }),
    ).toThrow("no Criminal");
    expect(f.ports.pay).not.toHaveBeenCalled();
    expect(() =>
      f.run({ type: "ironspider-sinister:remove-paid", id: env.id }),
    ).toThrow("no longer");
    expect(f.ports.discardPiece).not.toHaveBeenCalled();
  });
  it("blanked Grand Larceny loses its removal lock while retaining its crisis metadata", () => {
    const f = fixture();
    const p = f.piece("31030");
    f.s.sideSchemes.push(p);
    f.minion("31031");
    f.blank(p);
    expect(ironspiderSinisterThwartBlocked(f.s, p, f.ports)).toBe(false);
    expect(source[0].scheme_crisis).toBe(1);
  });
  it("a blanked Criminal still gains Surge, but a blanked environment grants none", () => {
    const f = fixture();
    const p = f.minion("31031");
    const env = f.environment();
    f.blank(p);
    expect(ironspiderSinisterCriminalSurge(f.s, p, f.ports)).toBe(true);
    f.blank(env);
    expect(ironspiderSinisterCriminalSurge(f.s, p, f.ports)).toBe(false);
  });
  it("blanking Electro disables new responses and HP bonus without detaching owned cards", () => {
    const f = fixture();
    const electro = f.minion("31032");
    const energy = f.piece("01088");
    energy.attachedTo = electro.id;
    f.s.attachments.push(energy);
    f.blank(electro);
    expect(ironspiderSinisterHealthBonus(f.s, electro)).toBe(0);
    expect(ironspiderSinisterEngagementResponses(f.s, electro)).toEqual([]);
    expect(ironspiderSinisterActivationResponses(f.s, electro.id)).toEqual([]);
    expect(f.s.attachments.map((p) => p.id)).toEqual([energy.id]);
  });
  it("blanking Hobgoblin and Bombshell restores the ordinary attack paths", () => {
    const f = fixture();
    const hob = f.minion("31033");
    const bomb = f.minion("31031");
    f.blank(hob);
    f.blank(bomb);
    expect(ironspiderSinisterAttackReplacement(f.s, hob)).toBeNull();
    expect(ironspiderSinisterAttackDamageReplacement(f.s, bomb, 3)).toBeNull();
  });
  it("blanking Iron Spider, Sandman and Spot suppresses their active text", () => {
    const f = fixture();
    const iron = f.minion("31034");
    const sand = f.minion("31035");
    const spot = f.minion("31036");
    for (const p of [iron, sand, spot]) f.blank(p);
    expect(ironspiderSinisterOverkill(f.s, iron)).toBe(false);
    expect(
      ironspiderSinisterDamageResponses(f.s, {
        piece: sand,
        actualDamage: 1,
        fromAttack: true,
      }),
    ).toEqual([]);
    expect(ironspiderSinisterDefeatResponses(f.s, spot, 0)).toEqual([]);
  });
  it("blanked environment has no printed Hero Action", () => {
    const f = fixture();
    const env = f.environment();
    f.blank(env);
    expect(ironspiderSinisterActions(f.s, env, f.ports)).toEqual([]);
  });
});
