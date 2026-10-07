import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { allInPlay, seatView } from "../src/game/team";
import { statusCards, syncStatuses } from "../src/game/keywords";
import { compileCardScript } from "../src/game/scripts/compiler";
import {
  WASP_PACK_CORE_ALIASES,
  WASP_PACK_COMPILED_CODES,
  WASP_PACK_SCRIPT_CODES,
  waspPackEnergyOverpayRange,
  waspPackAllyPlayed,
  waspPackAllyHP,
  waspPackResourceSources,
  waspPackPhaseEnded,
  waspPackAllyEnter,
  waspPackPlayRestriction,
  waspPackEvent,
  waspPackFormResponseOptions,
  waspPackFormChanged,
  waspPackMinionEngaged,
  resolveWaspPackEffect,
  type WaspPackPorts,
} from "../src/game/wasp-pack";
import type { Effect, GameState } from "../src/game/types";

function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "aggression",
    seed: 113,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "aggression" as const },
            { heroId: "captain_marvel", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.player.form = "hero";
  s.queue = [];
  s.prompt = null;
  s.sideSchemes = [];
  s.minions = [];
  s.scheme.threat = 5;
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.inPlay = [];
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
  }
  const ports: WaspPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    discardPiece: vi.fn((state: GameState, id: string) => {
      const index = state.player.inPlay.findIndex((p) => p.id === id);
      if (index >= 0)
        state.player.discard.push(...state.player.inPlay.splice(index, 1));
    }),
    discardHeroStatus: vi.fn(
      (state: GameState, kind: "stunned" | "confused") => {
        state.player[kind === "stunned" ? "stunCards" : "confuseCards"] =
          statusCards(state.player, kind) - 1;
        syncStatuses(state.player, {
          text: state.flags.fixtureSteady ? "Steady." : "",
        });
      },
    ),
    hasTrait: vi.fn((state: GameState, target: string, trait: string) =>
      target === "hero"
        ? state.player.form === "hero" && trait === "Avenger"
        : !!allInPlay(state).find(
            (p) =>
              p.id === target &&
              (card(p).traits || "").split(/\.\s*/).includes(trait),
          ),
    ),
    enemyTargets: vi.fn((state: GameState) => [
      { id: state.villain.id, label: "Villain", code: state.villain.code },
      ...state.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ]),
    minionTargets: vi.fn((state: GameState) =>
      state.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ),
    schemeTargets: vi.fn((state: GameState) =>
      state.scheme.threat > 0 ? [{ id: "main", label: "Main scheme" }] : [],
    ),
    canGiveStatus: (state) => !state.player.tough,
    cardCost: (_, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
  };
  const run = (effect: Effect) => resolveWaspPackEffect(s, effect, ports);
  const choose = (id: string) => {
    const selected = s.prompt!.options.find((o) => o.id === id);
    if (!selected) throw Error("Invalid fixture choice: " + id);
    s.prompt = null;
    for (const effect of selected.effects) {
      if (effect.type.startsWith("wasp-pack:")) run(effect);
      else s.queue.push(effect);
    }
  };
  const play = (code: string, seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = s.activePlayerId;
    seatView(s, seatId).player.inPlay.push(p);
    return p;
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((code) => makePiece(s, code));
    return [...s.player.hand];
  };
  const minion = (code = "01100", seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.engagedWith = seatId;
    s.minions.push(p);
    return p;
  };
  return { s, ports, run, choose, play, hand, minion };
}

describe("Wasp Hero Pack supplementary cards", () => {
  it("assigns every supplementary printing to native rules, exact reprints, or complete compiler programs", () => {
    expect(WASP_PACK_SCRIPT_CODES).toHaveLength(13);
    expect(WASP_PACK_CORE_ALIASES).toEqual([
      "13015",
      "13021",
      "13022",
      "13023",
    ]);
    expect(WASP_PACK_COMPILED_CODES).toEqual(["13016"]);
    const codes = [
      ...WASP_PACK_SCRIPT_CODES,
      ...WASP_PACK_CORE_ALIASES,
      ...WASP_PACK_COMPILED_CODES,
      "13020",
    ];
    expect(new Set(codes).size).toBe(19);
    for (const code of WASP_PACK_CORE_ALIASES) {
      expect(compileCardScript(card(code))).toMatchObject({
        status: "supported",
        implementation: "core",
      });
    }
    expect(compileCardScript(card("13016"))).toMatchObject({
      status: "supported",
      implementation: "script",
      trigger: "static",
      constraints: { playUnderAnyPlayer: true, maxPerPlayer: 1 },
      modifiers: [{ target: "controlled-allies", stat: "attack", amount: 1 }],
    });
  });

  it("Janet's entry interrupt counts only allocated energy overpayment, caps at three, and gives no HP for put-into-play", () => {
    const { s, play } = fixture();
    const wasp = play("13012");
    waspPackAllyPlayed(s, wasp, ["energy", "mental", "physical", "energy"]);
    expect(wasp.counters).toBe(2);
    expect(waspPackAllyHP(s, wasp)).toBe(2);
    waspPackAllyPlayed(s, wasp, ["energy", "energy", "energy", "energy"]);
    expect(waspPackAllyHP(s, wasp)).toBe(3);
    waspPackAllyPlayed(s, wasp, ["physical", "mental"]);
    expect(waspPackAllyHP(s, wasp)).toBe(0);
    waspPackAllyPlayed(s, wasp);
    expect(wasp.counters).toBe(0);
    expect(waspPackAllyHP(s, play("13011"))).toBe(0);
  });

  it("keeps final-cost allocation separate from excess resource types and rejects impossible pym amounts", () => {
    const { s, play } = fixture();
    const wasp = play("13012");
    const paid = ["energy", "energy", "physical"] as const;
    expect(waspPackEnergyOverpayRange([...paid], 2)).toEqual({
      min: 0,
      max: 1,
    });
    waspPackAllyPlayed(s, wasp, [...paid], 2, 1);
    expect(wasp.counters).toBe(1);
    waspPackAllyPlayed(s, wasp, [...paid], 2, 0);
    expect(wasp.counters).toBe(0);
    expect(() => waspPackAllyPlayed(s, wasp, [...paid], 2, 2)).toThrow(
      /energy resources overpaid/,
    );
    expect(() => waspPackAllyPlayed(s, wasp, ["energy"], 0, 0)).toThrow(
      /energy resources overpaid/,
    );
  });

  it("the expansion Quincarrier reprint requires an Avenger to play, but generates wild resources in either form once controlled", () => {
    const { s, play, ports } = fixture();
    const carrier = play("13025");
    expect(waspPackPlayRestriction(s, carrier, ports)).toBeNull();
    expect(waspPackResourceSources(s)).toEqual([
      expect.objectContaining({
        id: carrier.id,
        code: "13025",
        resources: ["wild"],
        kind: "ability",
      }),
    ]);
    s.player.form = "alter";
    expect(waspPackPlayRestriction(s, carrier, ports)).toContain("Avenger");
    expect(waspPackResourceSources(s)).toHaveLength(1);
    carrier.exhausted = true;
    expect(waspPackResourceSources(s)).toEqual([]);
  });

  it("Thor's optional hand-play response uses the paid physical resource without making an attack", () => {
    const { s, play } = fixture(true);
    const thor = play("13011", "p2");
    expect(waspPackAllyEnter(s, thor, ["physical"], false)).toEqual([]);
    expect(waspPackAllyEnter(s, thor, ["physical"], true)).toEqual([
      expect.objectContaining({
        type: "optional",
        actorId: "p2",
        title: "Thor",
        effects: [
          { type: "damage", target: s.villain.id, amount: 3, source: thor.id },
        ],
      }),
    ]);
    const regular = waspPackAllyEnter(s, thor, ["energy"], true)![0];
    expect(regular.effects[0].amount).toBe(2);
    expect(regular.effects[0].attack).toBeUndefined();
  });

  it("Ironheart and Miles respond only to hand play and unclaimed allies fall through", () => {
    const { s, play } = fixture();
    const ironheart = play("13018");
    expect(waspPackAllyEnter(s, ironheart)).toEqual([]);
    expect(waspPackAllyEnter(s, ironheart, [], true)![0]).toMatchObject({
      type: "optional",
      effects: [{ type: "draw", amount: 1 }],
    });
    const miles = play("13019");
    expect(waspPackAllyEnter(s, miles, [], true)![0].effects[0]).toEqual({
      type: "wasp-pack:miles-choose",
      id: miles.id,
    });
    expect(waspPackAllyEnter(s, play("13012"), [], true)).toEqual([]);
    expect(waspPackAllyEnter(s, play("01084"), [], true)).toBeNull();
  });

  it("Miles lets the controller choose one power and preserves other existing phase bonuses", () => {
    const { s, play, run, choose } = fixture();
    const miles = play("13019");
    miles.bonusAtk = 1;
    run({ type: "wasp-pack:miles-choose", id: miles.id });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["attack", "thwart"]);
    choose("attack");
    expect(miles.bonusAtk).toBe(3);
    expect(miles.bonusThw).toBeUndefined();
    expect(() =>
      run({ type: "wasp-pack:miles-power", id: miles.id, power: "defense" }),
    ).toThrow(/chosen power/);
    s.player.inPlay = [];
    run({ type: "wasp-pack:miles-choose", id: miles.id });
    expect(s.prompt).toBeNull();
  });

  it("Miles's established power bonuses expire at the phase boundary for his controlling seat", () => {
    const { s, play, run } = fixture(true);
    const miles = play("13019");
    const otherMiles = play("13019", "p2");
    const vision = play("01050");
    vision.bonusAtk = 2;
    otherMiles.bonusThw = 2;
    run({ type: "wasp-pack:miles-power", id: miles.id, power: "attack" });
    miles.exhausted = true;
    waspPackPhaseEnded(s);
    expect(miles.bonusAtk).toBe(0);
    expect(miles.bonusThw).toBe(0);
    expect(vision.bonusAtk).toBe(2);
    expect(otherMiles.bonusThw).toBe(2);
    waspPackPhaseEnded(seatView(s, "p2"));
    expect(otherMiles.bonusThw).toBe(0);
  });

  it("Into the Fray demands a minion and marks its attack for actual excess-damage threat removal", () => {
    const { s, ports, minion } = fixture();
    const fray = makePiece(s, "13013");
    expect(waspPackPlayRestriction(s, fray, ports)).toContain("minion");
    minion();
    expect(waspPackPlayRestriction(s, fray, ports)).toBeNull();
    expect(waspPackEvent(s, fray)).toEqual([
      {
        type: "target",
        group: "minion",
        title: "Into the Fray",
        action: {
          type: "damage",
          amount: 6,
          attack: true,
          source: "hero",
          excessToMain: true,
        },
      },
    ]);
    s.minions = [];
    s.player.stunned = true;
    expect(waspPackPlayRestriction(s, fray, ports)).toBeNull();
  });

  it("Surprise Attack uses complete paid types and Perseverance gives tough to the acting hero", () => {
    const { s } = fixture();
    const surprise = makePiece(s, "13014");
    expect(waspPackEvent(s, surprise, ["physical"])![0].action).toMatchObject({
      amount: 4,
      attack: true,
      source: "hero",
    });
    expect(waspPackEvent(s, surprise, ["energy"])![0].action.amount).toBe(3);
    expect(waspPackEvent(s, makePiece(s, "13033"))).toEqual([
      { type: "status", target: "hero", status: "tough" },
    ]);
  });

  it("form responses honor hero form, useful tough, affordability, and attack legality unless Stun replaces the attack", () => {
    const { s, hand, ports } = fixture();
    const [surprise, perseverance] = hand("13014", "13033");
    expect(waspPackFormResponseOptions(s, ports).map((o) => o.id)).toEqual([
      surprise.id,
      perseverance.id,
    ]);
    expect(waspPackPlayRestriction(s, surprise, ports)).toContain("after");
    expect(waspPackPlayRestriction(s, perseverance, ports)).toContain("after");
    s.player.tough = true;
    vi.mocked(ports.enemyTargets).mockReturnValue([]);
    expect(waspPackFormResponseOptions(s, ports)).toEqual([]);
    s.player.stunned = true;
    expect(waspPackFormResponseOptions(s, ports).map((o) => o.id)).toEqual([
      surprise.id,
    ]);
    vi.mocked(ports.canPay).mockReturnValue(false);
    expect(waspPackFormResponseOptions(s, ports)).toEqual([]);
    s.player.form = "alter";
    expect(waspPackFormChanged(s)).toEqual([]);
  });

  it("form response payment resumes the shared window only after native event resolution", () => {
    const { s, hand, ports, run } = fixture();
    const [surprise] = hand("13014");
    const continuation = [{ type: "host:form-window", used: [surprise.id] }];
    run({
      ...waspPackFormResponseOptions(s, ports)[0].effects[0],
      continuation,
    });
    const payment = s.queue.shift()!;
    expect(payment).toMatchObject({
      type: "payRequest",
      cost: 1,
      piece: surprise,
      cancelable: false,
    });
    run({ ...payment.after[0], paid: ["physical"] });
    expect(s.queue[0]).toMatchObject({
      type: "resolveHandEvent",
      id: surprise.id,
      continuation,
      after: [{ action: { amount: 4 } }],
    });
  });

  it("a standalone form window permits sequential distinct response cards and filters ones already used", () => {
    const { s, hand, run, choose } = fixture();
    const [surprise, perseverance] = hand("13014", "13033");
    run(waspPackFormChanged(s)[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      surprise.id,
      perseverance.id,
      "pass",
    ]);
    choose(surprise.id);
    const payment = s.queue.shift()!;
    run({ ...payment.after[0], paid: ["energy"] });
    const resolution = s.queue.shift()!;
    expect(resolution.continuation[0]).toEqual({
      type: "wasp-pack:form-responses",
      used: [surprise.id],
    });
    run(resolution.continuation[0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      perseverance.id,
      "pass",
    ]);
    choose("pass");
    expect(s.queue).toEqual([]);
  });

  it("Lie in Wait belongs to the engaged hero's window and discards itself before its attack", () => {
    const { s, play, minion, run, ports } = fixture(true);
    const lie = play("13017");
    const target = minion();
    const response = waspPackMinionEngaged(s, target)[0];
    expect(response).toMatchObject({
      type: "optional",
      actorId: "p1",
      title: "Lie in Wait",
    });
    run(response.effects[0]);
    expect(ports.discardPiece).toHaveBeenCalledWith(s, lie.id);
    expect(s.player.discard).toEqual([lie]);
    expect(s.queue).toEqual([
      {
        type: "damage",
        target: target.id,
        amount: 3,
        attack: true,
        source: "hero",
      },
    ]);
    expect(waspPackMinionEngaged(s, minion("01100", "p2"))).toEqual([]);
    s.player.form = "alter";
    play("13017");
    expect(waspPackMinionEngaged(s, target)).toEqual([]);
  });

  it("Lie in Wait cannot pay its discard cost after the engaged minion has left play", () => {
    const { s, play, minion, run, ports } = fixture();
    const lie = play("13017");
    const target = minion();
    const response = waspPackMinionEngaged(s, target)[0];
    s.minions = [];
    expect(() => run(response.effects[0])).toThrow(/minion that engaged/);
    expect(ports.discardPiece).not.toHaveBeenCalled();
    expect(s.player.inPlay).toContain(lie);
  });

  it("Running Interference requires an Avenger, removes only main threat, and caps the extra amount at three", () => {
    const { s, ports } = fixture();
    const event = makePiece(s, "13031");
    for (const [stage, amount] of [
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 5],
    ]) {
      s.villain.stage = stage;
      expect(waspPackEvent(s, event)).toEqual([
        {
          type: "thwart",
          target: "main",
          amount,
          action: true,
          source: "hero",
        },
      ]);
    }
    expect(waspPackPlayRestriction(s, event, ports)).toBeNull();
    vi.mocked(ports.schemeTargets).mockReturnValue([
      { id: "side", label: "Side scheme" },
    ]);
    expect(waspPackPlayRestriction(s, event, ports)).toContain("main scheme");
    s.player.confused = true;
    expect(waspPackPlayRestriction(s, event, ports)).toBeNull();
    vi.mocked(ports.hasTrait).mockReturnValue(false);
    expect(waspPackPlayRestriction(s, event, ports)).toContain("Avenger");
  });

  it("All for One selects distinct ready controlled Avengers, permits zero, and commits exhausts with its final damage", () => {
    const { s, play, run, choose } = fixture(true);
    const thor = play("13011");
    const miles = play("13019");
    const allyElsewhere = play("12013", "p2");
    run({ type: "wasp-pack:all-for-one", target: s.villain.id, selected: [] });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "hero",
      thor.id,
      "finish",
    ]);
    choose("hero");
    expect(s.player.exhausted).toBe(false);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([thor.id, "finish"]);
    choose(thor.id);
    expect(s.queue[0]).toMatchObject({
      type: "wasp-pack:all-for-one-finish",
      selected: ["hero", thor.id],
    });
    run(s.queue.shift()!);
    expect(s.player.exhausted).toBe(true);
    expect(thor.exhausted).toBe(true);
    expect(miles.exhausted).toBe(false);
    expect(allyElsewhere.exhausted).toBe(false);
    expect(s.queue[0]).toEqual({
      type: "damage",
      target: s.villain.id,
      amount: 5,
      attack: true,
      source: "hero",
    });
    s.queue = [];
    run({ type: "wasp-pack:all-for-one", target: s.villain.id, selected: [] });
    run(s.queue.shift()!);
    expect(s.queue[0].amount).toBe(3);
  });

  it("All for One cannot exhaust another player's ally, a Champion, a used Avenger, or the same character twice", () => {
    const { s, play, run } = fixture(true);
    const used = play("13011");
    used.exhausted = true;
    const miles = play("13019");
    const foreign = play("12013", "p2");
    for (const selected of [
      [used.id],
      [miles.id],
      [foreign.id],
      ["hero", "hero"],
    ]) {
      expect(() =>
        run({
          type: "wasp-pack:all-for-one-finish",
          target: s.villain.id,
          selected,
        }),
      ).toThrow(/distinct ready Avenger/);
    }
    expect(s.player.exhausted).toBe(false);
    expect(s.queue).toEqual([]);
  });

  it("Athletic Conditioning discards one chosen physical status card, including a partial Steady status", () => {
    const { s, run, choose, ports } = fixture();
    const event = makePiece(s, "13034");
    expect(waspPackPlayRestriction(s, event, ports)).toContain(
      "no stun or confuse",
    );
    s.flags.fixtureSteady = true;
    s.player.stunCards = 2;
    s.player.stunned = true;
    s.player.confuseCards = 1;
    s.player.confused = false;
    expect(waspPackPlayRestriction(s, event, ports)).toBeNull();
    run(waspPackEvent(s, event)![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["stunned", "confused"]);
    choose("stunned");
    expect(s.player.stunCards).toBe(1);
    expect(s.player.stunned).toBe(false);
    expect(s.player.confuseCards).toBe(1);
    run({ type: "wasp-pack:conditioning" });
    choose("confused");
    expect(s.player.confuseCards).toBe(0);
    expect(s.player.stunCards).toBe(1);
  });

  it("unrelated effects fall through and invented effects fail closed", () => {
    const { s, run } = fixture();
    expect(waspPackEvent(s, makePiece(s, "01084"))).toBeNull();
    expect(run({ type: "draw", amount: 1 })).toBe(false);
    expect(() => run({ type: "wasp-pack:invented" })).toThrow(
      /Unknown Wasp pack effect/,
    );
  });
});
