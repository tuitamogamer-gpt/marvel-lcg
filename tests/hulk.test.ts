import { describe, expect, it, vi } from "vitest";
import { newGame, makePiece } from "../src/game/engine";
import { card } from "../src/game/cards";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  HULK_SCRIPT_CODES,
  hulkStats,
  hulkFormChanged,
  hulkTurnEnds,
  hulkAbilityOptions,
  hulkResourceSources,
  hulkCanSpendCard,
  hulkPaymentAllowed,
  hulkPlayRestriction,
  hulkBasicAttackWindow,
  hulkEvent,
  hulkThreatLocked,
  hulkAfterEnemyAttack,
  hulkEncounterReveal,
  resolveHulkEffect,
  type HulkEnginePorts,
} from "../src/game/hulk";

function fixture() {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "aggression",
    seed: 319,
  });
  s.heroId = s.players[0].heroId = "hulk";
  s.phase = "player";
  s.player.form = "hero";
  s.player.hp = 18;
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.queue = [];
  s.prompt = null;
  const ports: HulkEnginePorts = {
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
        options: pieces.map((piece) => ({
          id: piece.id,
          label: card(piece).name,
          effects: [],
        })),
      };
    },
    discardHand: (state, id) => {
      const index = state.player.hand.findIndex((piece) => piece.id === id);
      if (index < 0) throw Error("Card is not in hand");
      state.player.discard.push(state.player.hand.splice(index, 1)[0]);
    },
    discardPiece: (state, id) => {
      const index = state.player.inPlay.findIndex((piece) => piece.id === id);
      if (index < 0) throw Error("Card is not in play");
      state.player.discard.push(state.player.inPlay.splice(index, 1)[0]);
    },
    mill: vi.fn((state, count) => {
      const pieces = state.player.deck.splice(0, count);
      state.player.discard.push(...pieces);
      return pieces;
    }),
    heroATK: () => 3 + hulkStats(s).atk,
    enemyATK: (_, piece) => card(piece).attack || 0,
    allyATK: (_, piece) => card(piece).attack || 0,
    cardCost: (_, piece) => card(piece).cost || 0,
    canPay: (state, cost, exclude) =>
      state.player.hand
        .filter(
          (piece) => piece.id !== exclude && hulkCanSpendCard(state, piece),
        )
        .reduce(
          (sum, piece) =>
            sum +
            [
              "resource_physical",
              "resource_mental",
              "resource_energy",
              "resource_wild",
            ].reduce(
              (count, key) =>
                count +
                Number(
                  (card(piece) as unknown as Record<string, unknown>)[key] || 0,
                ),
              0,
            ),
          0,
        ) >= cost,
    flip: (state) => {
      state.player.form = state.player.form === "hero" ? "alter" : "hero";
      state.queue.unshift(...hulkFormChanged(state));
    },
    startEnemyAttack: vi.fn((state: GameState, id: string) => {
      const piece =
        id === state.villain.id
          ? state.villain
          : state.minions.find((piece) => piece.id === id);
      if (!piece || piece.stunned) {
        if (piece) piece.stunned = false;
        return false;
      }
      return true;
    }),
  };
  const run = (effect: Effect) => resolveHulkEffect(s, effect, ports);
  const drain = () => {
    while (!s.prompt && s.queue[0]?.type.startsWith("hulk:"))
      run(s.queue.shift()!);
  };
  const choose = (id: string) => {
    const selected = s.prompt?.options.find((candidate) => candidate.id === id);
    if (!selected) throw Error("Invalid choice");
    s.prompt = null;
    s.queue.unshift(...selected.effects);
    drain();
  };
  const select = (...ids: string[]) => {
    const action = s.prompt!.selectAction!;
    s.prompt = null;
    run({ ...action, ids });
    drain();
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((code) => makePiece(s, code));
    return [...s.player.hand];
  };
  const play = (code: string) => {
    const piece = makePiece(s, code);
    s.player.inPlay.push(piece);
    return piece;
  };
  const minion = (code: string) => {
    const piece = makePiece(s, code);
    s.minions.push(piece);
    return piece;
  };
  return { s, ports, run, drain, choose, select, hand, play, minion };
}

describe("Hulk's exact printed identity, signature and encounter hooks", () => {
  it("covers all15 faces and uses printed numeric boosts without invented boost abilities", () => {
    expect(HULK_SCRIPT_CODES).toHaveLength(15);
    for (const code of HULK_SCRIPT_CODES) expect(card(code)).toBeDefined();
    for (const code of ["10025", "10026", "10027", "10028"]) {
      expect(card(code).boost).toBe(3);
      expect(card(code).boost_star).toBeFalsy();
    }
  });

  it("Enraged discards the actual entire hand at Hulk's turn end but does nothing as Banner", () => {
    const { s, hand, run } = fixture();
    const pieces = hand("10002", "10007", "10003");
    run(hulkTurnEnds(s)[0]);
    expect(s.player.hand).toEqual([]);
    expect(s.player.discard).toEqual(pieces);
    s.player.form = "alter";
    hand("10002");
    expect(hulkTurnEnds(s)).toEqual([]);
  });

  it("Experimental Research draws first and then requires an explicit chosen discard once per round", () => {
    const { s, hand, run, select } = fixture();
    s.player.form = "alter";
    const initial = hand("10003")[0];
    const drawn = makePiece(s, "10007");
    s.player.deck.push(drawn);
    run(hulkAbilityOptions(s, "identity")[0].effects[0]);
    expect(s.queue[0]).toMatchObject({ type: "draw", amount: 1 });
    expect(hulkAbilityOptions(s, "identity")).toEqual([]);
    s.queue.shift();
    s.player.hand.push(s.player.deck.shift()!);
    run(s.queue.shift()!);
    expect(s.prompt?.kind).toBe("select");
    expect(s.prompt?.options.map((option) => option.id)).toEqual([
      initial.id,
      drawn.id,
    ]);
    select(drawn.id);
    expect(s.player.hand).toEqual([initial]);
    expect(s.player.discard).toEqual([drawn]);
    s.round++;
    expect(hulkAbilityOptions(s, "identity")).toHaveLength(1);
    s.player.form = "hero";
    expect(hulkAbilityOptions(s, "identity")).toEqual([]);
  });

  it("Banner's Laboratory grants only Banner REC and an exhausted alter-ego payment source", () => {
    const { s, play } = fixture();
    const laboratory = play("10008");
    expect(hulkStats(s).recover).toBe(0);
    expect(hulkResourceSources(s)).toEqual([]);
    s.player.form = "alter";
    expect(hulkStats(s).recover).toBe(2);
    expect(hulkResourceSources(s)[0]).toMatchObject({
      id: laboratory.id,
      resources: ["mental"],
    });
    laboratory.exhausted = true;
    expect(hulkResourceSources(s)).toEqual([]);
  });

  it("Boundless Rage is hero-only and discarded after any form change; Immovable HP lasts in both forms", () => {
    const { s, play } = fixture();
    const rage = play("10009");
    play("10010");
    expect(hulkStats(s)).toEqual({
      atk: 1,
      recover: 0,
      health: 4,
      retaliate: 1,
    });
    s.player.form = "alter";
    expect(hulkFormChanged(s)).toEqual([{ type: "discardPiece", id: rage.id }]);
    expect(hulkStats(s)).toEqual({
      atk: 0,
      recover: 0,
      health: 4,
      retaliate: 0,
    });
    expect(hulkPlayRestriction(s, rage)).toContain("hero form");
  });

  it("Limitless Strength is3 printed physical resources and cannot be spent as Banner", () => {
    const { s } = fixture();
    const resource = makePiece(s, "10007");
    expect(card(resource).resource_physical).toBe(3);
    expect(hulkCanSpendCard(s, resource)).toBe(true);
    s.player.form = "alter";
    expect(hulkCanSpendCard(s, resource)).toBe(false);
  });

  it("Crushing Blow rejects any nonphysical cost but allows zero cost and declared wild", () => {
    const { s, run } = fixture();
    const piece = makePiece(s, "10002");
    expect(hulkPaymentAllowed(piece, ["physical", "mental"], "physical")).toBe(
      false,
    );
    expect(hulkPaymentAllowed(piece, ["wild"], "physical")).toBe(true);
    expect(hulkPaymentAllowed(piece, ["wild"], "mental")).toBe(false);
    expect(hulkPaymentAllowed(piece, [], "physical")).toBe(true);
    expect(() => hulkEvent(s, piece, ["mental"])).toThrow("physical");
    run(hulkEvent(s, piece, [])![0]);
    expect(s.queue[0].action).toMatchObject({
      type: "damage",
      amount: 3,
      attack: true,
    });
  });

  it("Sub-Orbital Leap and Unstoppable Force only get bonuses from a nonempty all-physical payment", () => {
    const { s } = fixture();
    const leap = makePiece(s, "10004");
    const force = makePiece(s, "10006");
    expect(
      hulkEvent(s, leap, ["physical", "physical", "physical"])![0].action
        .amount,
    ).toBe(5);
    expect(
      hulkEvent(s, leap, ["physical", "mental", "physical"])![0].action.amount,
    ).toBe(3);
    expect(hulkEvent(s, leap, [])![0].action.amount).toBe(3);
    expect(hulkEvent(s, force, [])).toEqual([
      { type: "ready", target: "hero" },
    ]);
    expect(hulkEvent(s, force, ["physical", "physical"])).toEqual([
      { type: "ready", target: "hero" },
      { type: "draw", amount: 1 },
    ]);
  });

  it("Thunderclap selects up to3 distinct enemies and never attacks or consumes Stunned", () => {
    const { s, run, select, minion } = fixture();
    const guard = minion("01101");
    const second = minion("01103");
    s.player.stunned = true;
    run(
      hulkEvent(s, makePiece(s, "10005"), ["mental", "energy", "physical"])![0],
    );
    expect(s.prompt).toMatchObject({ min: 0, max: 3 });
    expect(s.prompt?.options.map((option) => option.id)).toContain(
      s.villain.id,
    );
    select(s.villain.id, guard.id, second.id);
    expect(s.queue).toHaveLength(3);
    expect(
      s.queue.every(
        (effect) =>
          effect.type === "damage" &&
          effect.amount === 3 &&
          effect.attack === false,
      ),
    ).toBe(true);
    expect(s.player.stunned).toBe(true);
    expect(() =>
      run({ type: "hulk:thunderclap-targets", ids: [guard.id, guard.id] }),
    ).toThrow("different");
  });

  it("Hulk Smash opens a payment window before giving a bonus, and cannot be played as a free action", () => {
    const { s, hand, run, choose } = fixture();
    const [smash] = hand("10003", "10007");
    const attack = {
      type: "damage",
      target: s.villain.id,
      amount: 3,
      attack: true,
      source: "hero",
    };
    expect(hulkPlayRestriction(s, smash)).toContain("interrupt");
    expect(() => hulkEvent(s, smash, [])).toThrow("interrupt");
    run(hulkBasicAttackWindow(s, attack)[0]);
    expect(s.prompt?.kind).toBe("choice");
    choose(smash.id);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 3,
      cancelable: false,
    });
    expect(s.player.hand).toHaveLength(2);
    expect(s.villain.hp).toBe(s.villain.maxHp);
    const request = s.queue.shift()!;
    expect(() => run({ ...request.after[0], paid: [] })).toThrow("payment");
    run({ ...request.after[0], paid: ["physical", "physical", "physical"] });
    expect(s.queue[0]).toMatchObject({
      type: "resolveHandEvent",
      id: smash.id,
    });
    expect(s.queue[0].after[0].attack).toMatchObject({
      amount: 13,
      overkill: true,
    });
    expect(hulkStats(s).atk).toBe(0);
  });

  it("a mixed-resource Hulk Smash adds10 ATK without overkill; Stunned does not open its interrupt", () => {
    const { s, hand, run } = fixture();
    const [smash] = hand("10003", "10007");
    const attack = { type: "damage", amount: 3, attack: true };
    run({
      type: "hulk:smash-paid",
      id: smash.id,
      cost: 3,
      paid: ["physical", "mental", "physical"],
      attack,
    });
    expect(s.queue[0].after[0].attack).toMatchObject({
      amount: 13,
      overkill: false,
    });
    s.player.stunned = true;
    expect(hulkBasicAttackWindow(s, attack)).toEqual([attack]);
  });

  it("Inner Demons forces a flip without using the voluntary allowance, then exhausts Hulk or selects Banner discards", () => {
    const { s, run, drain, hand, select, ports } = fixture();
    s.player.flipped = true;
    const pieces = hand("10002", "10003", "10007");
    const obligation = makePiece(s, "10025");
    run(hulkEncounterReveal(s, obligation)![0]);
    drain();
    expect(s.player.form).toBe("alter");
    expect(s.player.flipped).toBe(true);
    expect(s.prompt).toMatchObject({ min: 2, max: 2 });
    select(pieces[0].id, pieces[2].id);
    expect(s.player.hand).toEqual([pieces[1]]);
    expect(s.queue[0].type).toBe("discardEncounter");
    s.queue = [];
    run(hulkEncounterReveal(s, obligation)![0]);
    drain();
    expect(s.player.form).toBe("hero");
    expect(s.queue).toEqual([
      { type: "exhaust", id: "hero" },
      { type: "discardEncounter", piece: obligation },
    ]);
  });

  it("Abomination discards only the top card and punishes printed physical, not printed wild", () => {
    for (const code of ["10007", "01055"]) {
      const { s, minion, run, ports } = fixture();
      const abomination = minion("10026");
      const top = makePiece(s, code);
      s.player.deck.push(top);
      run(hulkAfterEnemyAttack(s, abomination)[0]);
      expect(ports.mill).toHaveBeenCalledWith(s, 1);
      expect(s.player.discard).toContain(top);
      expect(s.queue).toEqual(
        code === "10007"
          ? [
              {
                type: "damage",
                target: "hero",
                amount: 2,
                source: "Abomination",
              },
            ]
          : [],
      );
    }
  });

  it("Abomination's not-yet-initiated response disappears if an earlier simultaneous response defeats it", () => {
    const { s, hand, run, minion, ports } = fixture();
    hand("10003");
    s.player.deck = [makePiece(s, "10007")];
    const abomination = minion("10026");
    const deferred = hulkAfterEnemyAttack(s, abomination)[0];
    s.minions = [];
    run(deferred);
    expect(ports.mill).not.toHaveBeenCalled();
    expect(s.player.deck).toHaveLength(1);
    expect(s.queue).toEqual([]);
  });

  it("Total Destruction's threat is locked while Abomination is in play anywhere", () => {
    const { s, minion } = fixture();
    const scheme = makePiece(s, "10027");
    s.sideSchemes.push(scheme);
    const abomination = minion("10026");
    abomination.engagedWith = "another-player";
    expect(hulkThreatLocked(s, scheme.id)).toBe(true);
    s.minions = [];
    expect(hulkThreatLocked(s, scheme.id)).toBe(false);
  });

  it("Clash chooses the highest current ATK ally and preserves that original ally target", () => {
    const { s, play, minion, run, drain, ports } = fixture();
    const abomination = minion("10026");
    const ally = play("01050");
    ports.allyATK = () => 8;
    run(hulkEncounterReveal(s, makePiece(s, "10028"))![0]);
    drain();
    expect(ports.startEnemyAttack).toHaveBeenCalledWith(
      s,
      abomination.id,
      ally.id,
      s.activePlayerId,
    );
    expect(s.prompt).toBeNull();
  });

  it("Clash requires first-player choices for ties and surges if the chosen highest enemy cannot attack", () => {
    const { s, minion, run, choose, ports } = fixture();
    const abomination = minion("10026");
    const shocker = minion("01103");
    ports.enemyATK = (_, piece) => (piece.id === s.villain.id ? 2 : 3);
    abomination.stunned = true;
    run(hulkEncounterReveal(s, makePiece(s, "10028"))![0]);
    expect(s.prompt?.options.map((option) => option.id)).toEqual([
      abomination.id,
      shocker.id,
    ]);
    choose(abomination.id);
    expect(ports.startEnemyAttack).toHaveBeenCalledWith(
      s,
      abomination.id,
      "hero",
      s.activePlayerId,
    );
    expect(abomination.stunned).toBe(false);
    expect(s.queue[0]).toMatchObject({
      type: "surge",
      actorId: s.activePlayerId,
    });
  });

  it("Clash surges without inventing a hero target when all identities are alter-egos and no allies exist", () => {
    const { s, run, drain, ports } = fixture();
    s.player.form = "alter";
    run(hulkEncounterReveal(s, makePiece(s, "10028"))![0]);
    drain();
    expect(ports.startEnemyAttack).not.toHaveBeenCalled();
    expect(s.queue[0].type).toBe("surge");
  });
});
