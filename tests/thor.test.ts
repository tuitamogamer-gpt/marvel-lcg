import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { activateSeat, seatView } from "../src/game/team";
import { compileCardScript } from "../src/game/scripts/compiler";
import catalog from "../src/data/catalog-cards.json";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types";
import type { PaymentSource } from "../src/game/payment";
import {
  THOR_SCRIPT_CODES,
  THOR_CORE_ALIASES,
  THOR_COMPILED_CODES,
  thorStats,
  thorAllyDiscount,
  thorSchemeLimitModifier,
  thorMainSchemeAdvances,
  thorPlayRestriction,
  thorLightningPaymentOptions,
  thorEvent,
  thorAllyEnter,
  thorCardEntered,
  thorAbilityOptions,
  thorResourceSources,
  thorResourceSpent,
  thorEngagementResponses,
  thorBasicPowerWindow,
  thorAfterHeroAttack,
  thorMinionDefeated,
  thorPreventsDefeat,
  thorEncounterReveal,
  thorAsgardCards,
  thorBoost,
  resolveThorEffect,
  type ThorEnginePorts,
} from "../src/game/thor";

function fixture() {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "aggression",
    seed: 87,
  });
  s.heroId = s.players[0].heroId = "thor";
  s.phase = "player";
  s.player.form = "hero";
  s.player.hp = 14;
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.queue = [];
  s.prompt = null;
  const sources = (state: GameState, exclude?: string): PaymentSource[] =>
    state.player.hand
      .filter((p) => p.id !== exclude)
      .map((p) => {
        const c = card(p);
        return {
          id: p.id,
          code: p.code,
          name: c.name,
          description: "Printed resources",
          kind: "card",
          resources: (
            ["energy", "mental", "physical", "wild"] as Resource[]
          ).flatMap((r) =>
            Array(
              Number(
                (c as unknown as Record<string, number>)["resource_" + r] || 0,
              ),
            ).fill(r),
          ),
        };
      });
  const ports: ThorEnginePorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options, cancelable) => {
      state.prompt = { kind: "choice", title, text, options, cancelable };
    },
    revealHidden: vi.fn((state: GameState) => {
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    }),
    aerial: (state) => thorStats(state).aerial,
    recycleEncounter: vi.fn(),
    shufflePlayerDeck: vi.fn(),
    discardHand: (state, id) => {
      const index = state.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Not in hand");
      state.player.discard.push(state.player.hand.splice(index, 1)[0]);
    },
    discardPiece: (state, id) => {
      const index = state.player.inPlay.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Not in play");
      state.player.discard.push(state.player.inPlay.splice(index, 1)[0]);
    },
    returnUpgrade: vi.fn((state: GameState, id: string) => {
      const index = state.player.inPlay.findIndex((p) => p.id === id);
      const [p] = state.player.inPlay.splice(index, 1);
      p.exhausted = false;
      state.player.hand.push(p);
    }),
    discardEncounterTop: vi.fn((state: GameState) => {
      const p = state.encounter.deck.shift();
      if (p) {
        state.encounter.discard.push(p);
        ports.revealHidden(state);
      }
      const emptied = !state.encounter.deck.length;
      if (emptied) ports.recycleEncounter(state);
      return { piece: p, emptied };
    }),
    putMinion: vi.fn((state: GameState, p: Piece, playerId: string) => {
      state.encounter.discard = state.encounter.discard.filter(
        (other) => other.id !== p.id,
      );
      p.engagedWith = playerId;
      state.minions.push(p);
      ports.queue(state, ...thorEngagementResponses(state, p));
    }),
    engageMinion: vi.fn((state: GameState, id: string, playerId: string) => {
      const p = state.minions.find((p) => p.id === id)!;
      const old = p.engagedWith;
      if (old === playerId) return;
      p.engagedWith = playerId;
      ports.queue(state, ...thorEngagementResponses(state, p, old, false));
    }),
    mill: vi.fn((state: GameState, count: number) => {
      const discarded = state.player.deck.splice(0, count);
      state.player.discard.push(...discarded);
      return discarded;
    }),
    canChangeForm: () => true,
    flip: vi.fn((state: GameState) => {
      state.player.form = state.player.form === "hero" ? "alter" : "hero";
    }),
    identityMaxHP: () => 14,
    allyPower: (_, p, kind) =>
      (card(p)[kind] || 0) +
      (kind === "attack" ? p.bonusAtk || 0 : p.bonusThw || 0),
    paymentSources: sources,
    canPay: (state, cost, requirements = [], exclude) => {
      const resources = sources(state, exclude).flatMap((p) => p.resources);
      return (
        resources.length >= cost &&
        requirements.every(
          (r) =>
            resources.filter((v) => v === r || v === "wild").length >=
            requirements.filter((v) => v === r).length,
        )
      );
    },
    transferControl: vi.fn((state: GameState, id: string, playerId: string) => {
      const p = state.player.inPlay.find((p) => p.id === id)!;
      state.player.inPlay = state.player.inPlay.filter((p) => p.id !== id);
      seatView(state, playerId).player.inPlay.push(p);
    }),
    log: vi.fn(),
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((code) => makePiece(s, code));
    return [...s.player.hand];
  };
  const play = (code: string) => {
    const p = makePiece(s, code);
    s.player.inPlay.push(p);
    return p;
  };
  const minion = (code: string, playerId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.engagedWith = playerId;
    s.minions.push(p);
    return p;
  };
  const run = (effect: Effect) => {
    if (effect.actorId) activateSeat(s, effect.actorId);
    expect(resolveThorEffect(s, effect, ports)).toBe(true);
  };
  const drainThor = () => {
    let guard = 0;
    while (s.queue[0]?.type.startsWith("thor:") && !s.prompt && guard++ < 30)
      run(s.queue.shift()!);
  };
  const choose = (id: string) => {
    const o = s.prompt?.options.find((o) => o.id === id);
    expect(o).toBeTruthy();
    s.prompt = null;
    s.queue.unshift(...o!.effects);
    drainThor();
  };
  return { s, ports, hand, play, minion, run, choose, drainThor };
}

describe("Thor's complete printed retail product module", () => {
  it("accounts for all35 imported faces with exactly one existing or explicit owner", () => {
    const source = (catalog as unknown as Card[]).filter(
      (c) => c.pack_code === "thor",
    );
    const assigned = [
      ...THOR_SCRIPT_CODES,
      ...THOR_CORE_ALIASES,
      ...THOR_COMPILED_CODES,
    ];
    expect(source).toHaveLength(35);
    expect(new Set(assigned).size).toBe(35);
    expect(assigned.slice().sort()).toEqual(source.map((c) => c.code).sort());
    for (const code of THOR_CORE_ALIASES)
      expect(compileCardScript(card(code)).implementation).toBe("core");
    for (const code of THOR_COMPILED_CODES)
      expect(compileCardScript(card(code)).implementation).toBe("script");
    expect(card("06029").boost_star).toBe(true);
    for (const code of ["06026", "06027", "06028", "06030"])
      expect(card(code).boost_star).toBeFalsy();
  });
  it("Mjolnir grants Thor ATK and Aerial only in Thor form; existing generic cards retain their own modifiers", () => {
    const { s, play } = fixture();
    play("06009");
    expect(thorStats(s)).toEqual({ atk: 1, aerial: true });
    s.player.form = "alter";
    expect(thorStats(s)).toEqual({ atk: 0, aerial: false });
    s.heroId = "spider_man";
    s.player.form = "hero";
    expect(thorStats(s)).toEqual({ atk: 0, aerial: false });
  });
  it("Worthy chooses the actual Mjolnir instance, reveals its search and shuffles once per round", () => {
    const { s, ports, run, choose, drainThor } = fixture();
    s.player.form = "alter";
    const hammer = makePiece(s, "06009");
    s.player.discard = [hammer];
    s.player.deck = [makePiece(s, "06022")];
    run(thorAbilityOptions(s, "identity")[0].effects[0]);
    drainThor();
    expect(thorAbilityOptions(s, "identity")).toEqual([]);
    expect(ports.revealHidden).toHaveBeenCalledOnce();
    expect(s.prompt?.options.map((o) => o.id)).toEqual([hammer.id]);
    choose(hammer.id);
    expect(s.player.hand).toEqual([hammer]);
    expect(s.player.discard).toEqual([]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    s.round++;
    expect(thorAbilityOptions(s, "identity")).toHaveLength(1);
  });
  it("For Asgard offers both deck and discard traits, while an unsuccessful search still shuffles", () => {
    const { s, ports, run, choose } = fixture();
    s.player.form = "alter";
    const sif = makePiece(s, "06002"),
      hammer = makePiece(s, "06009");
    s.player.deck = [sif, makePiece(s, "06022")];
    s.player.discard = [hammer];
    run(thorEvent(s, makePiece(s, "06004"), ["energy"])![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([sif.id, hammer.id]);
    choose(sif.id);
    expect(s.player.hand).toEqual([sif]);
    s.player.deck = [];
    s.player.discard = [];
    run(thorEvent(s, makePiece(s, "06004"), ["energy"])![0]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledTimes(2);
  });
  it("Have at thee is optional, consumes only the accepted phase limit and excludes a same-seat re-engagement", () => {
    const { s, run, minion } = fixture();
    const p = minion("06029");
    const response = thorEngagementResponses(s, p)[0];
    expect(response.type).toBe("optional");
    expect(thorEngagementResponses(s, p)).toHaveLength(1);
    run(response.effects[0]);
    expect(s.queue).toEqual([{ type: "draw", amount: 2 }]);
    expect(thorEngagementResponses(s, p)).toEqual([]);
    s.phase = "villain";
    expect(thorEngagementResponses(s, p)).toHaveLength(1);
    expect(thorEngagementResponses(s, p, "p1", false)).toEqual([]);
    s.player.form = "alter";
    expect(thorEngagementResponses(s, p, "p2", false)).toEqual([]);
  });
  it("Defender pays engagement before thwart, inserts the optional engagement response and stops at deck exhaustion", () => {
    const { s, ports, run } = fixture();
    const p = makePiece(s, "06029");
    s.encounter.deck = [makePiece(s, "06030"), p, makePiece(s, "06030")];
    run(thorEvent(s, makePiece(s, "06003"), [])![0]);
    expect(ports.discardEncounterTop).toHaveBeenCalledTimes(2);
    expect(s.minions).toContain(p);
    expect(s.queue[0].type).toBe("optional");
    expect(s.queue[1].action).toMatchObject({
      type: "thwart",
      amount: 3,
      action: true,
    });
    s.queue = [];
    s.minions = [];
    s.encounter.deck = [makePiece(s, "06030")];
    run(thorEvent(s, makePiece(s, "06003"), [])![0]);
    expect(s.queue).toEqual([]);
    expect(ports.log).toHaveBeenCalledWith(
      s,
      expect.stringContaining("cost was not paid"),
    );
  });
  it("Hammer Throw exhausts its additional cost before Stunned and leaves Mjolnir in play when canceled", () => {
    const { s, play, run } = fixture();
    const hammer = play("06009");
    s.player.stunned = true;
    s.player.stunCards = 1;
    run(
      thorEvent(s, makePiece(s, "06005"), ["mental", "mental", "energy"])![0],
    );
    expect(hammer.exhausted).toBe(true);
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(0);
    expect(s.queue).toEqual([]);
    expect(thorPlayRestriction(s, makePiece(s, "06005"))).toContain(
      "ready Mjolnir",
    );
  });
  it("Hammer Throw queues8-overkill attack then returns the same upgrade instance", () => {
    const { s, play, run, ports } = fixture();
    const hammer = play("06009");
    run(
      thorEvent(s, makePiece(s, "06005"), ["mental", "mental", "energy"])![0],
    );
    const target = s.queue.shift()!;
    run({ ...target.action, target: s.villain.id });
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: 8,
      attack: true,
      overkill: true,
    });
    s.queue.shift();
    run(s.queue.shift()!);
    expect(ports.returnUpgrade).toHaveBeenCalledWith(s, hammer.id);
    expect(s.player.hand[0]).toBe(hammer);
  });
  it("Lightning Strike atomically pays printedcost1+Xenergy including a split double Energy card", () => {
    const { s, ports, hand } = fixture();
    const [lightning, energy] = hand("06006", "06022");
    const options = thorLightningPaymentOptions(s, lightning, 1, ports);
    expect(options.map((o) => o.id)).toEqual(["1"]);
    expect(options[0].effects[0]).toMatchObject({
      type: "payRequest",
      cost: 2,
      requirements: ["energy"],
      piece: lightning,
      cancelable: true,
    });
    expect(options[0].effects[0].after[0]).toMatchObject({
      type: "play",
      piece: lightning,
      lightningX: 1,
    });
    expect(s.player.hand).toEqual([lightning, energy]);
    expect(() => thorEvent(s, lightning, ["mental"], 1)).toThrow("atomic");
    expect(thorEvent(s, lightning, ["energy", "energy"], 1)).toEqual([
      { type: "thor:lightning", amount: 1 },
    ]);
  });
  it("Lightning damage ignores Tough without piercing or attack flags and excludes other players' engaged minions", () => {
    const { s, ports, play, minion, run } = fixture();
    play("06009");
    const own = minion("06029"),
      other = minion("01101", "p2");
    run(
      thorEvent(
        s,
        makePiece(s, "06006"),
        ["energy", "energy", "energy"],
        2,
      )![0],
    );
    expect(s.queue.map((e) => e.target)).toEqual([s.villain.id, own.id]);
    expect(
      s.queue.every(
        (e) => e.attack === false && e.ignoreTough === true && !e.piercing,
      ),
    ).toBe(true);
    expect(s.queue.some((e) => e.target === other.id)).toBe(false);
    ports.aerial = () => false;
    s.queue = [];
    run(thorEvent(s, makePiece(s, "06006"), ["energy", "energy"], 1)![0]);
    expect(s.queue.every((e) => e.ignoreTough === false)).toBe(true);
  });
  it("Hercules discounts only engaged minions and Valkyrie uses actual energy payment for its optional entry response", () => {
    const { s, minion, play } = fixture();
    minion("06029");
    minion("01101", "p2");
    expect(thorAllyDiscount(s, card("06011"))).toBe(1);
    expect(thorAllyDiscount(s, card("06012"))).toBe(0);
    const valkyrie = play("06012");
    const [response] = thorAllyEnter(s, valkyrie, [
      "energy",
      "mental",
      "physical",
    ])!;
    expect(response.type).toBe("optional");
    expect(response.effects[0].action).toMatchObject({
      amount: 3,
      source: valkyrie.id,
    });
    expect(thorAllyEnter(s, valkyrie, [])![0].effects[0].action.amount).toBe(2);
  });
  it("Lady Sif readies the named identity in either form and leaves that response optional", () => {
    const { s, play, run } = fixture();
    s.player.form = "alter";
    s.player.exhausted = true;
    const sif = play("06002");
    const response = thorAllyEnter(s, sif)![0];
    expect(response.type).toBe("optional");
    run(response.effects[0]);
    expect(s.queue[0]).toEqual({
      type: "ready",
      target: "hero",
      actorId: "p1",
    });
    s.player.exhausted = false;
    expect(thorAllyEnter(s, sif)).toEqual([]);
  });
  it("Get Over Here uses the host's Aerial sources, does not transfer defeated minions and never re-engages the same seat", () => {
    const { s, ports, minion, run } = fixture();
    s.heroId = "iron_man";
    ports.aerial = () => true;
    const p = minion("06029", "p2");
    const target = thorEvent(s, makePiece(s, "06014"), [])![0];
    run({ ...target.action, target: p.id });
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: 1,
      attack: true,
    });
    s.queue.shift();
    run(s.queue.shift()!);
    expect(ports.engageMinion).toHaveBeenCalledWith(s, p.id, "p1");
    expect(p.engagedWith).toBe("p1");
    s.minions = [];
    s.queue = [];
    run({ type: "thor:engage-target", target: p.id, aerial: true });
    expect(ports.engageMinion).toHaveBeenCalledTimes(1);
  });
  it("Mean Swing pays a chosen Weapon exhaust and buffs only the current basic attack packet", () => {
    const { s, hand, play, run, choose } = fixture();
    const hammer = play("06009");
    const [mean] = hand("06015");
    const packet = { type: "damage", amount: 3, attack: true, source: "hero" };
    run(thorBasicPowerWindow(s, packet, "attack")[0]);
    choose(mean.id);
    choose(hammer.id);
    expect(hammer.exhausted).toBe(true);
    expect(s.queue[0]).toMatchObject({
      type: "resolveHandEvent",
      id: mean.id,
      after: [],
      continuation: [{ type: "thor:basic-window", packet: { amount: 6 } }],
    });
    expect(thorStats(s).atk).toBe(1);
    s.player.stunned = true;
    expect(thorBasicPowerWindow(s, packet, "attack")).toEqual([packet]);
    expect(thorPlayRestriction(s, mean)).toContain("interrupt");
  });
  it("Teamwork exhausts the selected controlled ally and uses its current matching power without consequence", () => {
    const { s, hand, play, run, choose } = fixture();
    const ally = play("06011");
    ally.bonusThw = 2;
    const [teamwork] = hand("06032");
    const packet = { type: "thwart", amount: 1, action: true, source: "hero" };
    run(thorBasicPowerWindow(s, packet, "thwart")[0]);
    choose(teamwork.id);
    choose(ally.id);
    expect(ally.exhausted).toBe(true);
    expect(ally.damage).toBe(0);
    expect(s.queue[0].continuation[0].packet.amount).toBe(4);
  });
  it("Hall glory is optional and identity-attributed, then exhausts and spends3 to draw as Odinson", () => {
    const { s, play, run } = fixture();
    const hall = play("06017");
    expect(thorMinionDefeated(s, false)).toEqual([]);
    const response = thorMinionDefeated(s, true)[0];
    expect(response.type).toBe("optional");
    expect(hall.counters).toBe(0);
    run(response.effects[0]);
    run(response.effects[0]);
    run(response.effects[0]);
    expect(thorAbilityOptions(s, hall.id)).toEqual([]);
    s.player.form = "alter";
    run(thorAbilityOptions(s, hall.id)[0].effects[0]);
    expect(hall).toMatchObject({ counters: 0, exhausted: true });
    expect(s.queue[0]).toEqual({ type: "draw", amount: 3 });
  });
  it("Battle Fury and Jarnbjorn share an ordered optional window and retain actual costs", () => {
    const { s, ports, play, hand, run, choose } = fixture();
    const fury = play("06018"),
      axe = play("06019");
    hand("06024");
    s.player.exhausted = true;
    const snapshot = {
      target: "defeated-minion",
      defeatedMinion: true,
      actorId: "p1",
    };
    run(thorAfterHeroAttack(s, snapshot)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      fury.id,
      axe.id,
      "continue",
    ]);
    choose(axe.id);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 1,
      requirements: ["physical"],
      cancelable: false,
    });
    expect(s.queue[0].after[0].action).toMatchObject({
      type: "damage",
      amount: 2,
      source: axe.id,
    });
    expect(s.player.inPlay).toContain(axe);
    s.queue = [];
    run({ type: "thor:fury", id: fury.id });
    expect(ports.discardPiece).toBeDefined();
    expect(s.player.discard).toContain(fury);
    expect(s.queue).toEqual([
      { type: "damage", target: "hero", amount: 1, source: fury.id },
      { type: "ready", target: "hero" },
    ]);
  });
  it("Heimdall reveals exactly top3, discards the chosen instance and preserves explicit remaining order", () => {
    const { s, ports, play, run, choose } = fixture();
    const heimdall = play("06020");
    const top = ["06030", "06029", "06027", "06026"].map((c) =>
      makePiece(s, c),
    );
    s.encounter.deck = [...top];
    run(thorAllyEnter(s, heimdall)![0].effects[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(
      top.slice(0, 3).map((p) => p.id),
    );
    expect(ports.revealHidden).toHaveBeenCalledOnce();
    choose(top[1].id);
    choose(top[2].id);
    expect(s.encounter.deck).toEqual([top[2], top[0], top[3]]);
    expect(s.encounter.discard.at(-1)).toBe(top[1]);
    expect(ports.recycleEncounter).toHaveBeenCalledOnce();
  });
  it("Odin's Anger offers a voluntary forced flip without using allowance, and excludes missing Mjolnir target", () => {
    const { s, ports, run, choose } = fixture();
    const obligation = makePiece(s, "06026");
    s.player.flipped = true;
    run(thorEncounterReveal(s, obligation)![0]);
    choose("flip");
    expect(ports.flip).toHaveBeenCalledWith(s, false);
    expect(s.player.flipped).toBe(true);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["exhaust"]);
    choose("exhaust");
    expect(s.queue).toEqual([
      { type: "exhaust", id: "hero" },
      { type: "removeEncounter", piece: obligation },
    ]);
  });
  it("Odin's Anger can discard Mjolnir from hand or play, but never invents a target", () => {
    for (const zone of ["hand", "inPlay"] as const) {
      const { s, run, choose } = fixture();
      const hammer = makePiece(s, "06009");
      s.player[zone].push(hammer);
      const obligation = makePiece(s, "06026");
      run(thorEncounterReveal(s, obligation)![0]);
      choose("stay");
      choose("discard");
      expect(s.player.discard).toContain(hammer);
      expect(s.queue[0]).toMatchObject({ type: "status", status: "stunned" });
    }
    const { s, run, choose } = fixture();
    run(thorEncounterReveal(s, makePiece(s, "06026"))![0]);
    choose("stay");
    expect(s.prompt).toBeNull();
    expect(s.queue[0].type).toBe("discardEncounter");
  });
  it("Odin's Anger omits a forbidden form change but preserves existing alter-ego choices", () => {
    for (const form of ["hero", "alter"] as const) {
      const { s, ports, run, drainThor } = fixture();
      s.player.form = form;
      ports.canChangeForm = () => false;
      const obligation = makePiece(s, "06026");
      run(thorEncounterReveal(s, obligation)![0]);
      drainThor();
      expect(ports.flip).not.toHaveBeenCalled();
      if (form === "hero") {
        expect(s.prompt).toBeNull();
        expect(s.queue).toEqual([
          { type: "discardEncounter", piece: obligation },
        ]);
      } else {
        expect(s.prompt?.options.map((option) => option.id)).toEqual([
          "exhaust",
        ]);
      }
    }
  });
  it("Odin's Anger revalidates a restored flip choice before changing form", () => {
    const { s, ports, run, choose } = fixture();
    run(thorEncounterReveal(s, makePiece(s, "06026"))![0]);
    ports.canChangeForm = () => false;
    expect(() => choose("flip")).toThrow("cannot change to Odinson");
    expect(ports.flip).not.toHaveBeenCalled();
    expect(s.player.form).toBe("hero");
  });
  it("Family Feud counts Asgard identities and in-play cards, including Loki, while Trickster counts types rather than copies", () => {
    const { s, play, minion, run } = fixture();
    play("06009");
    play("06007");
    minion("06028");
    s.player.hand = [makePiece(s, "06002")];
    expect(thorAsgardCards(s)).toBe(4);
    const feud = makePiece(s, "06027");
    expect(thorEncounterReveal(s, feud)).toEqual([
      { type: "threat", target: feud.id, amount: 4 },
    ]);
    s.player.deck = ["06003", "06005", "06009"].map((c) => makePiece(s, c));
    run(thorEncounterReveal(s, makePiece(s, "06030"))![0]);
    expect(s.queue[0]).toEqual({ type: "threat", target: "main", amount: 2 });
    expect(s.player.discard).toHaveLength(3);
  });
  it("Loki's forced replacement actually discards the hidden top and only prevents defeat for a treachery", () => {
    const { s, ports, minion } = fixture();
    const loki = minion("06028");
    loki.damage = 9;
    const treachery = makePiece(s, "06030");
    s.encounter.deck = [treachery, makePiece(s, "06029")];
    expect(thorPreventsDefeat(s, loki, ports)).toBe(true);
    expect(loki.damage).toBe(0);
    expect(s.encounter.discard.at(-1)).toBe(treachery);
    loki.damage = 5;
    expect(thorPreventsDefeat(s, loki, ports)).toBe(false);
    expect(loki.damage).toBe(5);
    s.minions = [];
    expect(thorPreventsDefeat(s, loki, ports)).toBe(false);
    expect(ports.discardEncounterTop).toHaveBeenCalledTimes(2);
  });
  it("Frost Giant's boost waits for villain attack damage and includes an Overkill-damaged identity", () => {
    const { s, play, run } = fixture();
    const defender = play("06011");
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      base: 5,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 5,
      identityDamage: 1,
      defender: defender.id,
      overkill: true,
    };
    expect(thorBoost(s, makePiece(s, "06029"))).toEqual([]);
    expect(s.queue).toEqual([]);
    run(s.attack.boostEffects[0]);
    expect(s.queue).toEqual([
      { type: "status", target: defender.id, status: "stunned" },
      { type: "status", target: "hero", status: "stunned" },
    ]);
    s.attack = null;
    s.queue = [];
    expect(thorBoost(s, makePiece(s, "06029"))).toEqual([]);
    expect(s.queue).toEqual([]);
  });
  it("Under Surveillance is attached to the actual main-scheme face and is discarded before its replacement", () => {
    const { s, play } = fixture();
    const surveillance = play("06031");
    thorCardEntered(s, surveillance);
    expect(surveillance.attachedTo).toBe("main:" + s.scheme.code);
    expect(thorSchemeLimitModifier(s)).toBe(4);
    expect(thorPlayRestriction(s, makePiece(s, "06031"))).toContain("already");
    expect(thorMainSchemeAdvances(s)).toEqual([
      { type: "discardPiece", id: surveillance.id },
    ]);
    s.scheme.code = "01110b";
    expect(thorSchemeLimitModifier(s)).toBe(0);
  });
  it("Second Wind chooses an identity and uses paid mental, while Enhanced Physique enforces hero form and real uses", () => {
    const { s, play, run, ports } = fixture();
    s.player.hp = 10;
    run(
      thorEvent(s, makePiece(s, "06033"), [
        "mental",
        "physical",
        "physical",
      ])![0],
    );
    expect(s.prompt?.options[0].effects[0]).toEqual({
      type: "heal",
      target: "hero",
      amount: 5,
      actorId: "p1",
    });
    s.player.hp = 14;
    expect(thorPlayRestriction(s, makePiece(s, "06033"), ports)).toContain(
      "No identity",
    );
    const physique = play("06034");
    thorCardEntered(s, physique);
    expect(physique.counters).toBe(3);
    expect(thorResourceSources(s)[0].resources).toEqual(["physical"]);
    expect(thorResourceSpent(s, physique)).toEqual([]);
    expect(thorResourceSpent(s, physique)).toEqual([]);
    expect(thorResourceSpent(s, physique)).toEqual([
      { type: "discardPiece", id: physique.id },
    ]);
    s.player.form = "alter";
    expect(thorResourceSources(s)).toEqual([]);
    expect(() => thorResourceSpent(s, physique)).toThrow("usable");
  });
});
