import { describe, expect, it, vi } from "vitest";
import importedCards from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { rulesCode } from "../src/game/rules-code";
import { compileCardScript } from "../src/game/scripts";
import { activateSeat, controller, seatView } from "../src/game/team";
import { HULK_SCRIPT_CODES } from "../src/game/hulk";
import {
  HULK_PACK_CORE_ALIASES,
  HULK_PACK_COMPILED_CODES,
  HULK_PACK_SCRIPT_CODES,
  hulkPackModifiers,
  hulkPackPlayRestriction,
  hulkPackEvent,
  hulkPackAllyEnter,
  hulkPackAllyResponse,
  hulkPackCardEntered,
  hulkPackAbilityOptions,
  hulkPackResourceSources,
  hulkPackResourceSpent,
  hulkPackAttackResponseOptions,
  hulkPackAfterEnemyAttack,
  resolveHulkPackEffect,
  type HulkPackAttackSnapshot,
  type HulkPackPorts,
} from "../src/game/hulk-pack";
import type { Effect, GameState, Piece } from "../src/game/types";

function fixture(team = false) {
  const s = newGame({
    heroId: "hulk",
    villainId: "rhino",
    aspect: "aggression",
    seed: 438,
    ...(team
      ? {
          heroes: [
            { heroId: "hulk", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.player.form = "hero";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  for (const seat of s.players.slice(1)) {
    seat.player.hand = [];
    seat.player.inPlay = [];
    seat.player.discard = [];
  }
  s.queue = [];
  s.prompt = null;
  s.sideSchemes = [];
  s.minions = [];
  s.scheme.threat = 3;
  const ports: HulkPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    discardPiece: (state, id) => {
      const owner = controller(state, id)!;
      const pile = seatView(state, owner).player.inPlay;
      const p = pile.splice(
        pile.findIndex((p) => p.id === id),
        1,
      )[0];
      p.counters = 0;
      seatView(state, p.ownerId || owner.id).player.discard.push(p);
    },
    dealEncounter: vi.fn((state: GameState, playerId: string) => {
      const p = state.encounter.deck.shift()!;
      p.dealtTo = playerId;
      state.encounter.dealt.push(p);
    }),
    transferControl: vi.fn((state: GameState, id: string, playerId: string) => {
      const from = controller(state, id)!;
      const pile = seatView(state, from).player.inPlay;
      const [p] = pile.splice(
        pile.findIndex((p) => p.id === id),
        1,
      );
      seatView(state, playerId).player.inPlay.push(p);
    }),
    moveThreat: vi.fn((state: GameState, target: string, n: number) => {
      if (target === "main") {
        const amount = Math.min(n, state.scheme.threat);
        state.scheme.threat -= amount;
        return amount;
      }
      const scheme = state.sideSchemes.find((p) => p.id === target)!;
      const amount = Math.min(n, scheme.counters);
      scheme.counters -= amount;
      return amount;
    }),
    cardCost: (_, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
  };
  const run = (effect: Effect) => resolveHulkPackEffect(s, effect, ports);
  const choose = (id: string) => {
    const selected = s.prompt!.options.find((o) => o.id === id);
    if (!selected) throw Error("Invalid fixture choice.");
    s.prompt = null;
    for (const effect of selected.effects) {
      if (effect.type.startsWith("hulk-pack:")) run(effect);
      else s.queue.push(effect);
    }
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((code) => makePiece(s, code));
    return [...s.player.hand];
  };
  const play = (code: string, seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = s.activePlayerId;
    seatView(s, seatId).player.inPlay.push(p);
    return p;
  };
  const minion = (code = "01110") => {
    const p = makePiece(s, code);
    p.engagedWith = s.activePlayerId;
    s.minions.push(p);
    return p;
  };
  const attack = (
    changes: Partial<HulkPackAttackSnapshot> = {},
  ): HulkPackAttackSnapshot => ({
    attacker: s.villain.id,
    attackerCode: s.villain.code,
    attackerStage: card(s.villain).stage,
    isVillain: true,
    playerId: s.activePlayerId,
    heroDamage: 3,
    heroDefended: true,
    ...changes,
  });
  return { s, ports, run, choose, hand, play, minion, attack };
}

describe("the entire Hulk Hero Pack's printed non-signature cards", () => {
  it("closes all33 catalog faces with15 hero-set,10 hooks,2 exact programs and6 verified Core reprints", () => {
    const imported = importedCards
      .filter((c) => c.pack_code === "hlk")
      .map((c) => c.code)
      .sort();
    expect(
      [
        ...HULK_SCRIPT_CODES,
        ...HULK_PACK_SCRIPT_CODES,
        ...HULK_PACK_COMPILED_CODES,
        ...HULK_PACK_CORE_ALIASES,
      ].sort(),
    ).toEqual(imported);
    expect(imported).toHaveLength(33);
    expect(imported).not.toContain("10033");
    for (const code of HULK_PACK_CORE_ALIASES)
      expect(rulesCode(code)).toMatch(/^01/);
    for (const code of HULK_PACK_COMPILED_CODES)
      expect(compileCardScript(card(code)).status).toBe("supported");
  });

  it("Sentry's mandatory entrance deals an encounter card to its controller without revealing it", () => {
    const { s, ports, play, run } = fixture();
    const sentry = play("10012");
    const top = s.encounter.deck[0];
    const effects = hulkPackAllyEnter(s, sentry)!;
    expect(effects[0].type).not.toBe("optional");
    run(effects[0]);
    expect(ports.dealEncounter).toHaveBeenCalledWith(s, s.activePlayerId);
    expect(s.encounter.dealt).toContain(top);
    expect(top.dealtTo).toBe(s.activePlayerId);
    expect(s.prompt).toBeNull();
  });

  it("She-Hulk's ATK bonus follows her actual current damage in any player's control zone", () => {
    const { s, play } = fixture(true);
    const sheHulk = play("10013", "p2");
    expect(hulkPackModifiers(s, sheHulk.id).attack).toBe(0);
    sheHulk.damage = 3;
    expect(hulkPackModifiers(s, sheHulk.id).attack).toBe(3);
    sheHulk.damage = 1;
    expect(hulkPackModifiers(s, sheHulk.id).attack).toBe(1);
    expect(hulkPackModifiers(s, "hero").attack).toBe(0);
  });

  it("Brawn has an optional remove-threat response after attacking, not after thwarting", () => {
    const { s, play } = fixture();
    const brawn = play("10011");
    const effects = hulkPackAllyResponse(s, brawn, true);
    expect(effects[0]).toMatchObject({
      type: "optional",
      actorId: "p1",
      effects: [
        {
          type: "target",
          action: { type: "thwart", amount: 1, source: brawn.id },
        },
      ],
    });
    expect(effects[0].effects[0].action.action).toBeUndefined();
    expect(hulkPackAllyResponse(s, brawn, false)).toEqual([]);
    s.scheme.threat = 0;
    expect(hulkPackAllyResponse(s, brawn, true)).toEqual([]);
  });

  it("Toe to Toe waits for the chosen enemy's complete attack before the ongoing5damage", () => {
    const { s, run, minion } = fixture();
    const enemy = minion();
    const program = hulkPackEvent(s, makePiece(s, "10015"))!;
    expect(program[0]).toMatchObject({
      type: "target",
      group: "enemy",
      action: { attack: true },
    });
    run({ ...program[0].action, target: enemy.id });
    expect(s.queue[0]).toMatchObject({ type: "enemyAttack", id: enemy.id });
    const followup = s.queue[1];
    s.queue = [];
    s.player.stunned = true;
    run(followup);
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: 5,
      attack: true,
      attackInitiated: true,
      target: enemy.id,
    });
    expect(s.player.stunned).toBe(true);
  });

  it("Toe damage follows a same-title next villain stage but does not hit a defeated minion", () => {
    const { s, run, minion } = fixture();
    const originalCode = s.villain.code;
    const next = importedCards.find(
      (c) =>
        c.type_code === "villain" &&
        c.name === card(originalCode).name &&
        c.code !== originalCode,
    )!;
    s.villain.code = next.code;
    run({
      type: "hulk-pack:toe-damage",
      target: s.villain.id,
      code: originalCode,
    });
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      target: s.villain.id,
      amount: 5,
    });
    s.queue = [];
    const enemy = minion();
    s.minions = [];
    run({ type: "hulk-pack:toe-damage", target: enemy.id, code: enemy.code });
    expect(s.queue).toEqual([]);
  });

  it("Martial Prowess is offered only for an Attack-trait event, in either identity form", () => {
    const { s, play } = fixture();
    const prowess = play("10018");
    expect(hulkPackResourceSources(s, "10015")[0]).toMatchObject({
      id: prowess.id,
      resources: ["physical"],
    });
    for (const code of [undefined, "10003", "10011", "10019", "10023"])
      expect(hulkPackResourceSources(s, code)).toEqual([]);
    s.player.form = "alter";
    expect(hulkPackResourceSources(s, "10015")).toHaveLength(1);
    prowess.exhausted = true;
    expect(hulkPackResourceSources(s, "10015")).toEqual([]);
    expect(() => hulkPackResourceSpent(s, prowess, "10019")).toThrow(
      /Attack event/,
    );
  });

  it("Resourceful can be discarded as a wild payment source even when already exhausted", () => {
    const { s, play } = fixture();
    const resourceful = play("10032");
    resourceful.exhausted = true;
    expect(hulkPackResourceSources(s)[0]).toMatchObject({
      id: resourceful.id,
      resources: ["wild"],
      description: expect.stringContaining("Discard"),
    });
    expect(hulkPackResourceSpent(s, resourceful)).toEqual([
      { type: "discardPiece", id: resourceful.id },
    ]);
    s.player.inPlay = [];
    expect(() => hulkPackResourceSpent(s, resourceful)).toThrow(/control/);
  });

  it("recipient upgrades can be played for another player who lacks a copy, preserving original ownership", () => {
    const { s, play, hand, run, choose } = fixture(true);
    play("10018");
    const [second] = hand("10018");
    expect(hulkPackPlayRestriction(s, second)).toBeNull();
    s.player.inPlay.push(second);
    run(hulkPackCardEntered(s, second)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["p2"]);
    choose("p2");
    expect(controller(s, second.id)?.id).toBe("p2");
    expect(second.ownerId).toBe("p1");
    const [third] = hand("10018");
    expect(hulkPackPlayRestriction(s, third)).toContain("already controls");
  });

  it("Beat Cop moves actual threat, stores only the returned amount, and is unaffected by Confused", () => {
    const { s, ports, play, run, choose } = fixture();
    const cop = play("10029");
    s.player.confused = true;
    run(hulkPackAbilityOptions(s, cop.id)[0].effects[0]);
    expect(cop.exhausted).toBe(false);
    choose("main");
    expect(ports.moveThreat).toHaveBeenCalledWith(s, "main", 1);
    expect(cop.exhausted).toBe(true);
    expect(cop.counters).toBe(1);
    expect(s.scheme.threat).toBe(2);
    expect(s.player.confused).toBe(true);
    cop.exhausted = false;
    vi.mocked(ports.moveThreat).mockReturnValueOnce(0);
    run(hulkPackAbilityOptions(s, cop.id)[0].effects[0]);
    choose("main");
    expect(cop.counters).toBe(1);
  });

  it("Beat Cop ignores Patrol but honors Crisis and Abomination's Total Destruction lock", () => {
    const { s, play, minion } = fixture();
    const cop = play("10029");
    const patrol = importedCards.find(
      (c) => c.type_code === "minion" && c.text?.includes("Patrol."),
    )!;
    minion(patrol.code);
    expect(hulkPackAbilityOptions(s, cop.id).map((o) => o.id)).toContain(
      "cop-move",
    );
    const crisis = importedCards.find(
      (c) => c.type_code === "side_scheme" && c.scheme_crisis,
    )!;
    const side = makePiece(s, crisis.code);
    side.counters = 0;
    s.sideSchemes = [side];
    expect(hulkPackAbilityOptions(s, cop.id)).toEqual([]);
    const total = makePiece(s, "10027");
    total.counters = 10;
    minion("10026");
    s.sideSchemes = [total];
    s.scheme.threat = 0;
    expect(hulkPackAbilityOptions(s, cop.id)).toEqual([]);
  });

  it("Beat Cop pays exhaust-and-discard before its stored-threat damage, which is not an attack", () => {
    const { s, play, minion, run, choose } = fixture();
    const cop = play("10029");
    cop.counters = 4;
    const target = minion();
    s.player.stunned = true;
    run(
      hulkPackAbilityOptions(s, cop.id).find((o) => o.id === "cop-damage")!
        .effects[0],
    );
    expect(cop.counters).toBe(4);
    choose(target.id);
    expect(s.player.inPlay).not.toContain(cop);
    expect(s.player.discard).toContain(cop);
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: 4,
      target: target.id,
    });
    expect(s.queue[0].attack).toBeUndefined();
    expect(s.player.stunned).toBe(true);
  });

  it("Inspiring Presence requires the current Avenger identity and offers only allies it can affect", () => {
    const { s, play, run, choose } = fixture(true);
    const ally = play("10011", "p2");
    const event = makePiece(s, "10030");
    expect(hulkPackPlayRestriction(s, event)).toContain("damaged or exhausted");
    ally.exhausted = true;
    expect(hulkPackPlayRestriction(s, event)).toBeNull();
    s.player.form = "alter";
    expect(hulkPackPlayRestriction(s, event)).toContain("Avenger");
    s.player.form = "hero";
    run(hulkPackEvent(s, event)![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([ally.id]);
    choose(ally.id);
    expect(s.queue).toEqual([
      { type: "heal", target: ally.id, amount: 1 },
      { type: "ready", target: ally.id },
    ]);
  });

  it("Electrostatic Armor responds to identity defense, including defense-event defense, but not an ally defender", () => {
    const { s, play, attack, ports, run } = fixture();
    const armor = play("10031");
    expect(
      hulkPackAttackResponseOptions(s, attack({ heroDefended: false }), ports),
    ).toEqual([]);
    const snapshot = attack({ heroDamage: 0 });
    const opts = hulkPackAttackResponseOptions(s, snapshot, ports);
    expect(opts.map((o) => o.id)).toEqual([armor.id]);
    run(opts[0].effects[0]);
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      target: s.villain.id,
      amount: 1,
      source: armor.id,
    });
    expect(s.queue[0].attack).toBeUndefined();
    expect(
      hulkPackAttackResponseOptions(s, snapshot, ports, [armor.id]),
    ).toEqual([]);
  });

  it("Armor uses the defending controller rather than the original card owner or original attacked player", () => {
    const { s, play, attack, ports, run } = fixture(true);
    const armor = play("10031", "p2");
    const snapshot = attack({ playerId: "p2" });
    const options = hulkPackAttackResponseOptions(s, snapshot, ports);
    expect(options[0].effects[0].actorId).toBe("p2");
    activateSeat(s, "p2");
    run(options[0].effects[0]);
    expect(s.queue[0]).toMatchObject({ source: armor.id, amount: 1 });
  });

  it("You'll Pay is a paid optional villain-attack response using actual identity damage capped at5", () => {
    const { s, hand, attack, ports, run } = fixture();
    const [event] = hand("10016", "10007");
    expect(hulkPackPlayRestriction(s, event)).toContain("after the villain");
    expect(
      hulkPackAttackResponseOptions(s, attack({ isVillain: false }), ports),
    ).toEqual([]);
    expect(
      hulkPackAttackResponseOptions(s, attack({ heroDamage: 0 }), ports),
    ).toEqual([]);
    const options = hulkPackAttackResponseOptions(
      s,
      attack({ heroDamage: 8, heroDefended: false }),
      ports,
    );
    expect(options[0].label).toContain("5 threat");
    run(options[0].effects[0]);
    expect(s.player.hand).toHaveLength(2);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 1,
      piece: event,
      after: [
        {
          type: "resolveHandEvent",
          id: event.id,
          after: [
            {
              type: "target",
              action: { type: "thwart", amount: 5, action: true },
            },
          ],
        },
      ],
    });
    expect(ports.canPay).toHaveBeenCalledWith(s, 1, event.id, event.code);
    s.player.form = "alter";
    expect(hulkPackAttackResponseOptions(s, attack(), ports)).toEqual([]);
  });

  it("the response window excludes unaffordable events and remembers Armor already used in this attack", () => {
    const { s, play, hand, attack, ports, run, choose } = fixture();
    const armor = play("10031");
    hand("10016");
    vi.mocked(ports.canPay).mockReturnValue(false);
    run(hulkPackAfterEnemyAttack(s, attack())[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([armor.id, "pass"]);
    choose(armor.id);
    expect(s.prompt).toBeNull();
    expect(s.queue[0]).toMatchObject({ type: "damage", amount: 1 });
  });

  it("unrelated effects fall through, while unknown claimed pack effects fail closed", () => {
    const { run } = fixture();
    expect(run({ type: "draw", amount: 1 })).toBe(false);
    expect(() => run({ type: "hulk-pack:invented" })).toThrow(
      /Unknown Hulk pack effect/,
    );
  });
});
