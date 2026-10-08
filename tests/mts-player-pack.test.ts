import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card, resources } from "../src/game/cards";
import { rulesCode } from "../src/game/rules-code";
import { allInPlay, controller, playerOrder, seatView } from "../src/game/team";
import * as pack from "../src/game/mts-player-pack";
import type { Effect, GameState, Piece, Resource } from "../src/game/types";

const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "mts-pack:" + type,
  ...args,
});
function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "leadership",
    seed: 21031,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "leadership" as const },
            { heroId: "captain_marvel", aspect: "protection" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.scheme.threat = 6;
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.hp = 10;
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.flags.fixtureTraits = "Avenger";
  }
  const port: pack.MtsPlayerPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    discardPiece: vi.fn((state, id) => {
      const seat = controller(state, id)!;
      const view = seatView(state, seat);
      const i = view.player.inPlay.findIndex((p) => p.id === id);
      if (i >= 0) view.player.discard.push(...view.player.inPlay.splice(i, 1));
    }),
    characterTraits: (state, target) => {
      if (target === "hero")
        return String(state.flags.fixtureTraits || "").split(",");
      if (target.startsWith("hero:"))
        return String(
          seatView(state, target.slice(5)).flags.fixtureTraits || "",
        ).split(",");
      const p = allInPlay(state).find((p) => p.id === target);
      return p ? (card(p).traits || "").split(/\.\s*/).filter(Boolean) : [];
    },
    hasTrait: (state, target, trait) =>
      port.characterTraits(state, target).includes(trait),
    enemyTargets: (state) => [
      { id: state.villain.id, label: "Rhino", code: state.villain.code },
      ...state.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ],
    schemeTargets: (state) => [
      { id: "main", label: "Main Scheme" },
      ...state.sideSchemes.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ],
    friendlyTargets: (state) => [
      ...playerOrder(state).map((seat) => ({
        id: seat.id === state.activePlayerId ? "hero" : "hero:" + seat.id,
        label: seat.heroId,
      })),
      ...allInPlay(state)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    heroAttack: (state) => 2 + pack.mtsPlayerPackHeroStats(state).attack,
    allyAttack: (state, p) =>
      Number(card(p).attack || 0) +
      pack.mtsPlayerPackModifiers(state, p.id, port).attack,
    maxHeroHP: () => 10,
    canReady: vi.fn((state, target) =>
      target === "hero"
        ? state.player.exhausted
        : target.startsWith("hero:")
          ? seatView(state, target.slice(5)).player.exhausted
          : !!allInPlay(state).find((p) => p.id === target)?.exhausted,
    ),
    cardCost: (_state, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    discardPlayerTop: vi.fn((state) => {
      const piece = state.player.deck.shift();
      if (piece) state.player.discard.push(piece);
      const emptied = !state.player.deck.length;
      if (emptied && piece) {
        state.player.deck = [...state.player.discard];
        state.player.discard = [];
      }
      return { piece, emptied };
    }),
    shufflePlayerDeck: vi.fn((state) => {
      state.player.deck.reverse();
    }),
    revealHidden: vi.fn(),
    canPutAlly: vi.fn(() => true),
    putAllyFromDiscard: vi.fn((state: GameState, id: string) => {
      const i = state.player.discard.findIndex((p) => p.id === id);
      if (i >= 0)
        state.player.inPlay.push(...state.player.discard.splice(i, 1));
    }),
    transferControl: vi.fn((state, id, playerId) => {
      const seat = controller(state, id)!;
      const zone = seatView(state, seat).player.inPlay;
      const i = zone.findIndex((p) => p.id === id);
      seatView(state, playerId).player.inPlay.push(...zone.splice(i, 1));
    }),
    shuffleResolvingIntoEncounter: vi.fn((state: GameState, id: string) => {
      const i = state.resolving.findIndex((p) => p.id === id);
      if (i >= 0) state.encounter.deck.push(...state.resolving.splice(i, 1));
    }),
    removeResolvingOwnedToRemoved: vi.fn((state: GameState, id: string) => {
      const i = state.resolving.findIndex((p) => p.id === id);
      if (i >= 0) {
        const p = state.resolving.splice(i, 1)[0];
        state.removed.push(p);
      }
    }),
    preventAllAttackDamage: vi.fn(),
    claimDefense: vi.fn(),
  };
  const piece = (code: string, state = s) => {
    const p = makePiece(state, code);
    p.ownerId = state.activePlayerId;
    return p;
  };
  const play = (code: string, seatId = s.activePlayerId) => {
    const view = seatView(s, seatId);
    const p = piece(code, view);
    view.player.inPlay.push(p);
    return p;
  };
  const hand = (code: string) => {
    const p = piece(code);
    s.player.hand.push(p);
    return p;
  };
  const deck = (...codes: string[]) => {
    const ps = codes.map((code) => piece(code));
    s.player.deck.push(...ps);
    return ps;
  };
  const run = (e: Effect, state = s) =>
    pack.resolveMtsPlayerPackEffect(state, e, port);
  const choose = (id: string, state = s) => {
    const o = state.prompt!.options.find((o) => o.id === id)!;
    expect(o).toBeDefined();
    state.prompt = null;
    for (const e of o.effects) if (!run(e, state)) state.queue.push(e);
  };
  return { s, port, piece, play, hand, deck, run, choose };
}

describe("The Mad Titan's Shadow shared player pool", () => {
  it("owns exactly 28 dedicated faces and twelve exact Core aliases", () => {
    expect(pack.MTS_PLAYER_PACK_SCRIPT_CODES).toHaveLength(28);
    expect(pack.MTS_PLAYER_PACK_CORE_ALIASES).toHaveLength(12);
    expect(
      new Set([
        ...pack.MTS_PLAYER_PACK_SCRIPT_CODES,
        ...pack.MTS_PLAYER_PACK_CORE_ALIASES,
      ]).size,
    ).toBe(40);
    expect(pack.MTS_PLAYER_PACK_CORE_ALIASES.map(rulesCode)).toEqual([
      "01091",
      "01088",
      "01089",
      "01090",
      "01054",
      "01057",
      "01060",
      "01065",
      "01071",
      "01074",
      "01077",
      "01081",
    ]);
    expect(pack.MTS_PLAYER_PACK_SCRIPT_CODES).toContain("21017");
    expect(pack.MTS_PLAYER_PACK_SCRIPT_CODES).toContain("21020");
  });
  it("does not claim an unrelated event, ally, boost or program", () => {
    const { s, port, piece, run } = fixture();
    const p = piece("01084");
    expect(pack.mtsPlayerPackEvent(s, p)).toBeNull();
    expect(pack.mtsPlayerPackAllyEnter(s, p)).toBeNull();
    expect(pack.mtsPlayerPackBoost(s, p)).toBeNull();
    expect(pack.mtsPlayerPackCardResources(s, p)).toBeNull();
    expect(pack.mtsPlayerPackAbility(s, p.id, port)).toBe(false);
    expect(run({ type: "other:effect" })).toBe(false);
    expect(() => run(P("unknown"))).toThrow("Unknown Mad Titan");
  });
});

describe("Avenger characters, Team control and ally resources", () => {
  it("Captain America counts the identity and Avenger allies, excluding Avenger supports and the other player's characters", () => {
    const { s, port, play, piece } = fixture(true);
    play("21020");
    play("21012");
    play("21019");
    play("21013", s.players[1].id);
    expect(pack.mtsPlayerPackCardCostReduction(s, piece("21011"), port)).toBe(
      3,
    );
    s.flags.fixtureTraits = "Scientist";
    expect(pack.mtsPlayerPackCardCostReduction(s, piece("21011"), port)).toBe(
      2,
    );
  });
  it("Mighty Avengers needs every current character to be an Avenger and ignores support traits", () => {
    const { s, port, play } = fixture();
    play("21015");
    play("20020");
    const ally = play("21012");
    expect(pack.mtsPlayerPackModifiers(s, ally.id, port)).toEqual({
      attack: 1,
      thwart: 1,
      defense: 0,
    });
    const guardian = play("21047");
    expect(pack.mtsPlayerPackModifiers(s, ally.id, port).attack).toBe(0);
    s.player.inPlay = s.player.inPlay.filter((p) => p.id !== guardian.id);
    s.flags.fixtureTraits = "Scientist";
    expect(pack.mtsPlayerPackModifiers(s, ally.id, port).thwart).toBe(0);
  });
  it("Mighty Avengers boosts only the controller's allies", () => {
    const { s, port, play } = fixture(true);
    play("21015");
    const a = play("21012"),
      b = play("21013", s.players[1].id);
    expect(pack.mtsPlayerPackModifiers(s, a.id, port).attack).toBe(1);
    expect(pack.mtsPlayerPackModifiers(s, b.id, port).attack).toBe(0);
  });
  it("limits Mighty Avengers against every printed Team card", () => {
    const { s, port, play, piece, run } = fixture(true);
    play("22033");
    const p = play("21015");
    run(pack.mtsPlayerPackCardEntered(s, p)[0]);
    expect(port.transferControl).toHaveBeenCalledWith(s, p.id, s.players[1].id);
    expect(
      pack.mtsPlayerPackPlayRestriction(s, piece("21015"), port),
    ).toContain("Team");
  });
  it("Ready to Rumble can be assigned to another eligible player and revalidates saved control choice", () => {
    const { s, play, run, choose } = fixture(true);
    const p = play("21022");
    run(pack.mtsPlayerPackCardEntered(s, p)[0]);
    const other = s.players[1].id;
    expect(s.prompt!.options.map((o) => o.id)).toContain(other);
    choose(other);
    expect(seatView(s, other).player.inPlay.some((q) => q.id === p.id)).toBe(
      true,
    );
    const next = play("21022");
    expect(() =>
      run(P("control-to", { id: next.id, playerId: other })),
    ).toThrow("cannot control");
  });
  it.each([0, 1, 2, 3, 4])(
    "Band Together generates min(3,%i) wild resources for the payer's own allies",
    (count) => {
      const { s, play, piece } = fixture(true);
      for (let i = 0; i < count; i++) play("21012");
      play("21013", s.players[1].id);
      expect(pack.mtsPlayerPackCardResources(s, piece("21018"))).toEqual(
        Array(Math.min(3, count)).fill("wild"),
      );
    },
  );
  it("Tower's ally-limit condition includes zero allies and fails on one non-Avenger", () => {
    const { s, port, play } = fixture();
    play("21020");
    expect(pack.mtsPlayerPackAllyLimit(s, port)).toBe(1);
    play("21012");
    expect(pack.mtsPlayerPackAllyLimit(s, port)).toBe(1);
    play("21047");
    expect(pack.mtsPlayerPackAllyLimit(s, port)).toBe(0);
  });
  it("Tower works in alter-ego, retains its discount through non-Avenger plays, and expires at phase end", () => {
    const { s, port, play, piece } = fixture();
    const tower = play("21020");
    s.player.form = "alter";
    expect(pack.mtsPlayerPackAbility(s, tower.id, port, "tower")).toBe(true);
    const e = s.queue.shift()!;
    pack.resolveMtsPlayerPackEffect(s, e, port);
    expect(tower.exhausted).toBe(true);
    expect(pack.mtsPlayerPackCardCostReduction(s, piece("21013"), port)).toBe(
      1,
    );
    pack.mtsPlayerPackCardPlayed(s, card("21047"));
    expect(pack.mtsPlayerPackCardCostReduction(s, piece("21013"), port)).toBe(
      1,
    );
    pack.mtsPlayerPackCardPlayed(s, card("21013"));
    expect(pack.mtsPlayerPackCardCostReduction(s, piece("21013"), port)).toBe(
      0,
    );
    s.flags.mtsPackTowerDiscount = 2;
    s.flags.mtsPackTowerPhase = `${s.round}:${s.phase}`;
    pack.mtsPlayerPackPhaseEnded(s);
    expect(s.flags.mtsPackTowerDiscount).toBeUndefined();
  });
  it("Martinex checks the actual identity's Guardian trait in either form", () => {
    const { s, port, piece } = fixture();
    const p = piece("21065");
    s.flags.fixtureTraits = "Mystic,Guardian";
    expect(pack.mtsPlayerPackCardCostReduction(s, p, port)).toBe(1);
    s.player.form = "alter";
    s.flags.fixtureTraits = "Mystic";
    expect(pack.mtsPlayerPackCardCostReduction(s, p, port)).toBe(0);
  });
});

describe("Ally enter-play searches and phase bonuses", () => {
  it("Power Man enters with two chi and can spend either or both while exhausted in alter-ego", () => {
    const { s, port, play, run } = fixture();
    const p = play("21012");
    pack.mtsPlayerPackCardEntered(s, p);
    p.exhausted = true;
    s.player.form = "alter";
    expect(p.counters).toBe(2);
    expect(
      pack.mtsPlayerPackAbilityOptions(s, p.id, port).map((o) => o.id),
    ).toEqual(["chi-1", "chi-2"]);
    run(P("chi", { id: p.id, amount: 1 }));
    run(P("chi", { id: p.id, amount: 1 }));
    expect(p.counters).toBe(0);
    expect(pack.mtsPlayerPackModifiers(s, p.id, port).attack).toBe(4);
    expect(() => run(P("chi", { id: p.id, amount: 1 }))).toThrow(
      "chi counters",
    );
    pack.mtsPlayerPackPhaseEnded(s);
    expect(pack.mtsPlayerPackModifiers(s, p.id, port).attack).toBe(0);
  });
  it("a new Power Man instance clears that physical ID's old chi modifiers from every seat and receives two fresh counters", () => {
    const { s, port, play } = fixture(true),
      p = play("21012");
    s.flags["mtsPackChi:" + p.id] = 4;
    seatView(s, s.players[1].id).flags["mtsPackChi:" + p.id] = 2;
    p.counters = 0;
    pack.mtsPlayerPackCardEntered(s, p);
    expect(p.counters).toBe(2);
    expect(pack.mtsPlayerPackModifiers(s, p.id, port).attack).toBe(0);
    for (const seat of s.players)
      expect(seatView(s, seat).flags["mtsPackChi:" + p.id]).toBeUndefined();
  });
  it.each([
    ["01094", 1],
    ["01095", 2],
    ["01096", 3],
  ] as const)(
    "White Tiger played from hand draws villain %s's capped stage %i",
    (code, amount) => {
      const { s, play } = fixture();
      s.villain.code = code;
      const p = play("21013");
      expect(pack.mtsPlayerPackAllyEnter(s, p, true)![0].effects).toEqual([
        { type: "draw", amount },
      ]);
      expect(pack.mtsPlayerPackAllyEnter(s, p, false)).toEqual([]);
    },
  );
  it("White Tiger treats a villain without a stage number as stage one", () => {
    const { s, play } = fixture();
    s.villain.code = "01011";
    expect(
      pack.mtsPlayerPackAllyEnter(s, play("21013"), true)![0].effects[0].amount,
    ).toBe(1);
  });
  it("Kaluu chooses an actual event from only the top five, adds it to hand, then shuffles the entire remaining deck", () => {
    const { s, port, play, deck, run, choose } = fixture();
    const p = play("21014");
    const ps = deck(
      "21012",
      "21017",
      "21013",
      "21043",
      "21020",
      "21055",
      "01086",
    );
    run(P("kaluu", { id: p.id }));
    expect(s.prompt!.options.map((o) => o.id)).toEqual([ps[1].id, ps[3].id]);
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    choose(ps[3].id, restored);
    expect(restored.player.hand.map((p) => p.id)).toEqual([ps[3].id]);
    expect(port.shufflePlayerDeck).toHaveBeenCalledWith(restored);
    expect(restored.player.deck).toHaveLength(6);
    expect(restored.player.discard).toHaveLength(0);
    expect(restored.player.deck[0].id).toBe(ps[6].id);
  });
  it("Kaluu still shuffles after finding no event, without discarding any searched card", () => {
    const { s, port, play, deck, run } = fixture();
    const ps = deck("21012", "21020", "21013", "21014", "21019", "21017");
    const p = play("21014");
    run(P("kaluu", { id: p.id }));
    expect(s.prompt).toBeNull();
    expect(port.shufflePlayerDeck).toHaveBeenCalledOnce();
    expect(s.player.deck.map((p) => p.id).sort()).toEqual(
      ps.map((p) => p.id).sort(),
    );
    expect(s.player.hand).toHaveLength(0);
  });
  it("Kaluu revalidates a saved choice against only the searched top five", () => {
    const { play, deck, run } = fixture();
    const p = play("21014");
    const ps = deck("21012", "21043", "21019", "21020", "21014", "21017");
    run(P("kaluu", { id: p.id }));
    expect(() => run(P("kaluu-take", { id: ps[5].id }))).toThrow("top five");
  });
  it("Quasar removes one threat from every existing scheme through native threat effects without a thwart label", () => {
    const { s, piece, play } = fixture();
    const a = piece("01107"),
      b = piece("01108");
    s.sideSchemes = [a, b];
    const effects = pack.mtsPlayerPackAllyEnter(s, play("21047"))![0]
      .effects as Effect[];
    expect(effects.map((e) => e.target)).toEqual(["main", a.id, b.id]);
    expect(effects.every((e) => e.amount === 1 && !e.action)).toBe(true);
  });
});

describe("Mass Attack exhausts allies as costs without using their powers", () => {
  it("accepts each ally's different shared hero trait, computes current boosted ATK and does not exhaust the hero", () => {
    const { s, port, play, hand, run, choose } = fixture();
    s.flags.fixtureTraits = "Avenger,Guardian";
    s.flags.mtsPackMoxie = 1;
    const a = play("21012"),
      b = play("21047"),
      c = play("21065");
    a.counters = 2;
    run(P("chi", { id: a.id, amount: 2 }));
    const event = hand("21016");
    expect(pack.mtsPlayerPackPlayRestriction(s, event, port)).toBeNull();
    run(
      pack.mtsPlayerPackBeforeEvent(s, event, [{ type: "cost-complete" }])[0],
    );
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    const groupId = [a, b, c].map((p) => p.id).join("+");
    choose(groupId, restored);
    expect(restored.player.inPlay.every((p) => p.exhausted)).toBe(true);
    expect(restored.player.exhausted).toBe(false);
    expect(restored.queue).toEqual([{ type: "cost-complete" }]);
    run(pack.mtsPlayerPackEvent(restored, event)![0], restored);
    const target = restored.queue[0];
    expect(target.title).toBe("Mass Attack");
    expect(target.action.amount).toBe(
      3 + 4 + Number(card(b).attack) + Number(card(c).attack),
    );
    expect(target.action).toMatchObject({
      attack: true,
      attackInitiated: true,
      source: "hero",
    });
    expect(target.action.basic).toBeUndefined();
  });
  it("rejects an ally sharing no hero trait, fewer than three allies or an exhausted third ally", () => {
    const { s, port, play, hand } = fixture();
    const event = hand("21016");
    play("21012");
    play("21019");
    expect(pack.mtsPlayerPackPlayRestriction(s, event, port)).toContain(
      "three ready",
    );
    const p = play("21047");
    expect(pack.mtsPlayerPackPlayRestriction(s, event, port)).toContain(
      "three ready",
    );
    s.flags.fixtureTraits = "Avenger,Guardian";
    p.exhausted = true;
    expect(pack.mtsPlayerPackPlayRestriction(s, event, port)).toContain(
      "three ready",
    );
  });
  it("pays all three exhaust costs even if Stun will replace the attack, then clears canceled event cost data", () => {
    const { s, play, hand, run, choose } = fixture();
    s.player.stunned = true;
    const ps = [play("21012"), play("21013"), play("21019")],
      event = hand("21016");
    run(pack.mtsPlayerPackBeforeEvent(s, event, [{ type: "status-gate" }])[0]);
    choose(ps.map((p) => p.id).join("+"));
    expect(ps.every((p) => p.exhausted)).toBe(true);
    expect(s.queue).toEqual([{ type: "status-gate" }]);
    expect(s.flags["mtsPackEventCost:" + event.id]).toBeTypeOf("string");
    pack.mtsPlayerPackEventFinished(s, event);
    expect(s.flags["mtsPackEventCost:" + event.id]).toBeUndefined();
  });
  it("revalidates a serialized exhaust-cost option before spending any ally", () => {
    const { s, play, hand, run, choose } = fixture();
    const ps = [play("21012"), play("21013"), play("21019")],
      event = hand("21016");
    run(pack.mtsPlayerPackBeforeEvent(s, event, [])[0]);
    ps[0].exhausted = true;
    expect(() => choose(ps.map((p) => p.id).join("+"))).toThrow("remain ready");
    expect(ps.slice(1).every((p) => !p.exhausted)).toBe(true);
  });
});

describe("Form-change responses and actual spent-resource responses", () => {
  it("combines physical Moxie and Rumble choices and preserves their saved response continuation", () => {
    const { s, port, play, hand, run } = fixture();
    s.player.exhausted = true;
    const m = hand("21017"),
      r = play("21022"),
      after = [{ type: "spectrum:form-response", id: "actual-form" }];
    const choices = pack.mtsPlayerPackFormResponseOptions(s, after, port);
    expect(choices.map((o) => o.id)).toEqual([m.id, r.id]);
    run(choices[0].effects[0]);
    expect(s.queue[0].after[0]).toEqual({
      type: "resolveHandEvent",
      id: m.id,
      continuation: after,
    });
    s.queue = [];
    run(choices[1].effects[0]);
    expect(s.player.discard.map((p) => p.id)).toContain(r.id);
    expect(s.queue).toEqual([{ type: "ready", target: "hero" }, ...after]);
  });
  it("Moxie stacks until round end, survives phase cleanup, and Rumble has no ready response when already ready or in alter-ego", () => {
    const { s, port, play, hand, run } = fixture();
    const r = play("21022");
    hand("21017");
    run(P("moxie"));
    run(P("moxie"));
    expect(pack.mtsPlayerPackHeroStats(s)).toEqual({
      attack: 2,
      thwart: 2,
      defense: 2,
    });
    pack.mtsPlayerPackPhaseEnded(s);
    expect(pack.mtsPlayerPackHeroStats(s).attack).toBe(2);
    expect(
      pack
        .mtsPlayerPackFormResponseOptions(s, [], port)
        .some((o) => o.id === r.id),
    ).toBe(false);
    s.player.form = "alter";
    expect(pack.mtsPlayerPackFormResponseOptions(s, [], port)).toEqual([]);
    pack.mtsPlayerPackRoundEnded(s);
    expect(pack.mtsPlayerPackHeroStats(s).attack).toBe(0);
  });
  it("all four physical resource cards produce optional Hero Responses even when spent beyond a zero cost", () => {
    const { s, port, piece, play } = fixture();
    s.player.hp = 8;
    play("21012").damage = 1;
    const ps = ["21046", "21052", "21058", "21064"].map((code) => piece(code));
    const response = pack.mtsPlayerPackResourcesSpent(s, ps, port);
    expect(response.map((e) => e.title)).toEqual([
      "Audacity",
      "Determination",
      "Innovation",
      "Preservation",
    ]);
    expect(response[0].effects[0]).toMatchObject({
      type: "damage",
      amount: 1,
      target: s.villain.id,
    });
    expect(response[0].effects[0].attack).toBeUndefined();
    expect(response[1].effects[0]).toMatchObject({
      type: "thwart",
      target: "main",
      amount: 1,
    });
    expect(response[1].effects[0].action).toBeUndefined();
    expect(response[3].effects[0]).toEqual({
      type: "heal",
      target: "hero",
      amount: 1,
    });
  });
  it("resources do not respond in alter-ego, Innovation only heals damaged own allies, Preservation needs hero damage", () => {
    const { s, port, piece, play, run, choose } = fixture(true);
    const ps = [piece("21058"), piece("21064")];
    const other = play("21012", s.players[1].id);
    other.damage = 1;
    expect(pack.mtsPlayerPackResourcesSpent(s, ps, port)).toEqual([]);
    const own = play("21013");
    own.damage = 1;
    run(P("innovation"));
    expect(s.prompt!.options.map((o) => o.id)).toEqual([own.id]);
    choose(own.id);
    expect(s.queue[0]).toEqual({ type: "heal", target: own.id, amount: 1 });
    s.player.form = "alter";
    expect(pack.mtsPlayerPackResourcesSpent(s, [piece("21046")], port)).toEqual(
      [],
    );
  });
});

describe("Mystic event costs consume actual top cards before event effects", () => {
  it.each(["21043", "21050", "21055"])(
    "%s requires the current identity's Mystic trait",
    (code) => {
      const { s, port, piece, deck } = fixture();
      deck("21012");
      expect(pack.mtsPlayerPackPlayRestriction(s, piece(code), port)).toContain(
        "Mystic",
      );
      s.flags.fixtureTraits = "Mystic";
      expect(
        pack.mtsPlayerPackPlayRestriction(s, piece(code), port),
      ).toBeNull();
    },
  );
  it.each([
    ["21043", 5, "damage"],
    ["21050", 4, "thwart"],
  ] as const)(
    "%s saves target plus actual discarded count, capped at %i",
    (code, maximum, type) => {
      const { s, hand, deck, run, choose } = fixture();
      s.flags.fixtureTraits = "Mystic";
      const event = hand(code);
      const ps = deck("01086", "01087", "21012", "21013", "21014", "21019");
      run(pack.mtsPlayerPackBeforeEvent(s, event, [{ type: "event-gate" }])[0]);
      choose(type === "damage" ? s.villain.id : "main");
      expect(s.prompt!.options.map((o) => o.id)).toEqual(
        Array.from({ length: maximum }, (_, i) => String(i + 1)),
      );
      const saved = JSON.parse(JSON.stringify(s)) as GameState;
      choose(String(maximum), saved);
      expect(saved.player.discard.map((p) => p.id)).toEqual(
        ps.slice(0, maximum).map((p) => p.id),
      );
      expect(saved.queue).toEqual([{ type: "event-gate" }]);
      run(pack.mtsPlayerPackEvent(saved, event)![0], saved);
      expect(saved.queue[0]).toMatchObject({
        type,
        amount: maximum,
        target: type === "damage" ? s.villain.id : "main",
        source: "hero",
      });
      expect(saved.queue[0].basic).toBeUndefined();
      expect(
        type === "damage" ? saved.queue[0].attack : saved.queue[0].action,
      ).toBe(true);
    },
  );
  it("discard costs stop at the original deck boundary despite immediate recycling and remain paid before Stun cancels the body", () => {
    const { s, hand, deck, run, choose, port } = fixture();
    s.player.stunned = true;
    const event = hand("21043");
    const ps = deck("21012", "21013");
    s.player.discard.push(makePiece(s, "01086"));
    run(pack.mtsPlayerPackBeforeEvent(s, event, [{ type: "status-gate" }])[0]);
    choose(s.villain.id);
    choose("2");
    expect(port.discardPlayerTop).toHaveBeenCalledTimes(2);
    expect(s.player.deck).toHaveLength(3);
    expect(s.queue).toEqual([{ type: "status-gate" }]);
    expect(
      JSON.parse(String(s.flags["mtsPackEventCost:" + event.id])).amount,
    ).toBe(2);
    expect(
      s.player.deck.filter((p) => ps.some((q) => q.id === p.id)),
    ).toHaveLength(2);
  });
  it("up-to additional costs require at least one actual deck card and reject zero before mutation", () => {
    const { s, hand, deck, run, choose, port } = fixture();
    const event = hand("21050");
    deck("21012");
    run(pack.mtsPlayerPackBeforeEvent(s, event, [])[0]);
    choose("main");
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["1"]);
    expect(() =>
      run(
        P("spell-discard-cost", {
          id: event.id,
          code: event.code,
          target: "main",
          amount: 0,
        }),
      ),
    ).toThrow("cost is unavailable");
    expect(port.discardPlayerTop).not.toHaveBeenCalled();
    expect(s.player.deck).toHaveLength(1);
  });
  it("Summoning Spell discards only through the first ally and puts that exact piece into play without playing it", () => {
    const { s, hand, deck, run, port } = fixture();
    const event = hand("21055"),
      ps = deck("01086", "21042", "21014", "21012");
    run(pack.mtsPlayerPackBeforeEvent(s, event, [{ type: "event-gate" }])[0]);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      ps.slice(0, 3).map((p) => p.id),
    );
    expect(s.player.deck.map((p) => p.id)).toEqual([ps[3].id]);
    expect(port.putAllyFromDiscard).not.toHaveBeenCalled();
    run(pack.mtsPlayerPackEvent(s, event)![0]);
    expect(s.player.inPlay[0].id).toBe(ps[2].id);
    expect(port.putAllyFromDiscard).toHaveBeenCalledWith(s, ps[2].id);
  });
  it("Summoning Spell recovers the exact last discarded ally after a deck recycle", () => {
    const { s, hand, deck, run } = fixture();
    const event = hand("21055"),
      ps = deck("01086", "21014");
    run(pack.mtsPlayerPackBeforeEvent(s, event, [])[0]);
    expect(s.player.discard.map((p) => p.id)).toEqual([ps[1].id]);
    expect(s.player.deck.map((p) => p.id)).toEqual([ps[0].id]);
    const saved = JSON.parse(JSON.stringify(s)) as GameState;
    run(pack.mtsPlayerPackEvent(saved, event)![0], saved);
    expect(saved.player.inPlay[0].id).toBe(ps[1].id);
  });
  it("Summoning Spell stops at a unique ally that cannot enter and never skips to the next ally", () => {
    const { s, hand, deck, run, port } = fixture();
    const event = hand("21055"),
      ps = deck("21014", "21012");
    vi.mocked(port.canPutAlly).mockReturnValue(false);
    run(pack.mtsPlayerPackBeforeEvent(s, event, [])[0]);
    run(pack.mtsPlayerPackEvent(s, event)![0]);
    expect(s.player.discard.map((p) => p.id)).toEqual([ps[0].id]);
    expect(s.player.deck.map((p) => p.id)).toEqual([ps[1].id]);
    expect(port.putAllyFromDiscard).not.toHaveBeenCalled();
  });
  it("Summoning Spell ends at original deck exhaustion with no ally instead of searching the reshuffle", () => {
    const { s, hand, deck, run, port } = fixture();
    const event = hand("21055");
    deck("01086");
    const oldAlly = makePiece(s, "21012");
    s.player.discard.push(oldAlly);
    run(pack.mtsPlayerPackBeforeEvent(s, event, [])[0]);
    run(pack.mtsPlayerPackEvent(s, event)![0]);
    expect(port.discardPlayerTop).toHaveBeenCalledOnce();
    expect(s.player.inPlay).toHaveLength(0);
    expect(s.player.deck.some((p) => p.id === oldAlly.id)).toBe(true);
  });
});

describe("Blade, Marvel Boy, Major Victory and Shield Spell timing", () => {
  it("Blade's forced response works in alter-ego and its payment is strictly from hand, including wild", () => {
    const { s, port, play, run, choose } = fixture();
    const blade = play("21019");
    s.player.form = "alter";
    expect(pack.mtsPlayerPackAfterAllyBasic(s, blade)[0]).toMatchObject({
      mandatory: true,
      forced: true,
    });
    run(pack.mtsPlayerPackAfterAllyBasic(s, blade)[0]);
    expect(port.canPay).toHaveBeenCalledWith(
      s,
      1,
      "",
      "21019",
      ["physical"],
      true,
    );
    choose("pay");
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 1,
      targetCode: "21019",
      requirements: ["physical"],
      handOnly: true,
      cancelable: false,
    });
    expect(resources(card("13024"), card("21019"))).toEqual(["wild", "wild"]);
  });
  it("Blade discards automatically when no hand resource can pay, without offering in-play generators", () => {
    const { s, port, play, run } = fixture();
    const blade = play("21019");
    play("20020");
    vi.mocked(port.canPay).mockReturnValue(false);
    run(pack.mtsPlayerPackAfterAllyBasic(s, blade)[0]);
    expect(s.prompt).toBeNull();
    expect(s.queue[0]).toEqual({
      type: "discardPiece",
      id: blade.id,
      mandatory: true,
    });
  });
  it("Marvel Boy's optional physical payment retains the native attack packet with piercing/ranged and no repeat", () => {
    const { s, port, play, run } = fixture();
    const p = play("21041"),
      packet = {
        type: "ally",
        id: p.id,
        action: "attack",
        target: s.villain.id,
      },
      after = [{ type: "next" }];
    const options = pack.mtsPlayerPackAllyBasicOptions(
      s,
      p,
      packet,
      after,
      port,
    );
    expect(options).toHaveLength(1);
    run(options[0].effects[0]);
    const req = s.queue[0];
    expect(req).toMatchObject({
      type: "payRequest",
      targetCode: "21041",
      requirements: ["physical"],
      cost: 1,
    });
    expect(req.after).toEqual([
      { ...packet, piercing: true, ranged: true, mtsMarvelBoyHandled: true },
      ...after,
    ]);
    expect(
      pack.mtsPlayerPackAllyBasicOptions(s, p, req.after[0], [], port),
    ).toEqual([]);
    expect(
      pack.mtsPlayerPackAllyBasicOptions(
        s,
        p,
        { ...packet, action: "thwart" },
        [],
        port,
      ),
    ).toEqual([]);
    p.stunned = true;
    expect(pack.mtsPlayerPackAllyBasicOptions(s, p, packet, [], port)).toEqual(
      [],
    );
    expect(resources(card("01055"), card(p))).toEqual(["wild", "wild"]);
  });
  it("Major Victory offers an actual ready friendly Guardian in another seat before the saved defeat continuation", () => {
    const { s, port, play } = fixture(true);
    const p = play("21053"),
      a = play("21041", s.players[1].id);
    a.exhausted = true;
    seatView(s, s.players[1].id).flags.fixtureTraits = "Guardian";
    seatView(s, s.players[1].id).player.exhausted = true;
    const after = [{ type: "finish-defeat", id: p.id }],
      options = pack.mtsPlayerPackAllyDefeatOptions(s, p, after, port);
    expect(options.map((o) => o.id)).toEqual(["hero:" + s.players[1].id, a.id]);
    expect(options[1].effects).toEqual([
      { type: "ready", target: a.id },
      ...after,
    ]);
    expect(
      pack.mtsPlayerPackAllyDefeatOptions(s, play("21012"), after, port),
    ).toEqual([]);
  });
  it("Shield Spell needs a Mystic hero, own attack damage, and the entire original deck discard cost", () => {
    const { s, port, hand, deck } = fixture();
    const p = hand("21061"),
      packet = { type: "damage", target: "hero", amount: 3, attack: true };
    deck("01086", "01087", "21012");
    expect(pack.mtsPlayerPackDamageOptions(s, packet, 3, [], port)).toEqual([]);
    s.flags.fixtureTraits = "Mystic";
    expect(pack.mtsPlayerPackDamageOptions(s, packet, 3, [], port)[0].id).toBe(
      p.id,
    );
    expect(pack.mtsPlayerPackDamageOptions(s, packet, 4, [], port)).toEqual([]);
    expect(
      pack.mtsPlayerPackDamageOptions(
        s,
        { ...packet, attack: false },
        3,
        [],
        port,
      ),
    ).toEqual([]);
    expect(
      pack.mtsPlayerPackDamageOptions(
        s,
        { ...packet, target: "hero:someone-else" },
        3,
        [],
        port,
      ),
    ).toEqual([]);
    s.player.form = "alter";
    expect(pack.mtsPlayerPackDamageOptions(s, packet, 3, [], port)).toEqual([]);
  });
  it("Shield Spell pays the full exact discard cost before defending and preventing the actual attack packet", () => {
    const { s, port, hand, deck, run } = fixture();
    s.flags.fixtureTraits = "Mystic";
    const p = hand("21061");
    deck("01086", "01087");
    const packet = {
      type: "damageWindow",
      attack: true,
      target: "hero",
      amount: 2,
      damageWindowId: "exact-window",
    };
    run(
      pack.mtsPlayerPackDamageOptions(
        s,
        packet,
        2,
        [{ type: "resume-attack" }],
        port,
      )[0].effects[0],
    );
    const req = s.queue[0];
    expect(req.piece.id).toBe(p.id);
    expect(req.after[0].continuation).toEqual([{ type: "resume-attack" }]);
    const body = req.after[0].after[0],
      saved = JSON.parse(JSON.stringify(s)) as GameState;
    run(body, saved);
    expect(port.discardPlayerTop).toHaveBeenCalledTimes(2);
    expect(port.claimDefense).toHaveBeenCalledWith(saved, packet);
    expect(port.preventAllAttackDamage).toHaveBeenCalledWith(saved, packet, 2);
    expect(
      vi.mocked(port.discardPlayerTop).mock.invocationCallOrder[1],
    ).toBeLessThan(vi.mocked(port.claimDefense).mock.invocationCallOrder[0]);
  });
  it("Shield Spell never partially discards an unavailable cost", () => {
    const { s, port, deck, run } = fixture();
    deck("01086");
    expect(() =>
      run(P("shield", { amount: 2, packet: { type: "damageWindow" } })),
    ).toThrow("full attack-damage");
    expect(port.discardPlayerTop).not.toHaveBeenCalled();
    expect(port.preventAllAttackDamage).not.toHaveBeenCalled();
  });
});

describe("Cosmic Entity ownership and encounter disposition", () => {
  it.each(["21042", "21048", "21054", "21060"])(
    "%s shuffles the same actual resolving event into the encounter deck in either identity form",
    (code) => {
      const { s, piece, run } = fixture();
      s.player.form = "alter";
      const p = piece(code);
      s.resolving.push(p);
      run(pack.mtsPlayerPackEvent(s, p)![0]);
      expect(s.resolving).toHaveLength(0);
      expect(s.encounter.deck.find((q) => q.id === p.id)).toBe(p);
      expect(p.ownerId).toBe(s.activePlayerId);
      expect(pack.mtsIsCosmicEntity(p)).toBe(true);
    },
  );
  it.each([
    ["21042", "damage", 2],
    ["21048", "thwart", 2],
    ["21054", "draw", 1],
    ["21060", "heal", 2],
  ] as const)(
    "%s reveals its uncancelable %s effect then removes that physical owned event",
    (code, type, amount) => {
      const { s, piece, run } = fixture(true);
      const p = piece(code);
      p.ownerId = s.players[1].id;
      s.resolving.push(p);
      const effects = pack.mtsPlayerPackEncounterReveal(s, p)!;
      expect(effects[0]).toMatchObject({
        type,
        amount,
        mandatory: true,
        cannotCancel: true,
      });
      expect(effects[0].attack).toBeUndefined();
      expect(effects[0].action).toBeUndefined();
      run(effects[1]);
      expect(s.resolving).toHaveLength(0);
      expect(s.removed.find((q) => q.id === p.id)).toBe(p);
      expect(s.removed.find((q) => q.id === p.id)?.ownerId).toBe(
        s.players[1].id,
      );
      if (type === "heal") expect(effects[0].target).toBe("hero");
      if (type === "damage") expect(effects[0].target).toBe(s.villain.id);
    },
  );
  it("a Cosmic Entity boost has zero icons and no When Revealed program; the host classifier selects encounter discard", () => {
    const { s, piece } = fixture();
    const p = piece("21048");
    expect(pack.mtsPlayerPackBoost(s, p)).toEqual([]);
    expect(pack.mtsIsCosmicEntity(p)).toBe(true);
    expect(pack.mtsIsCosmicEntity("21054")).toBe(true);
    expect(pack.mtsIsCosmicEntity("21055")).toBe(false);
    expect(card(p).boost || 0).toBe(0);
  });
  it("Living Tribunal uses the normal player threat effect so Crisis continues to apply", () => {
    const { s, piece } = fixture();
    const e = pack.mtsPlayerPackEncounterReveal(s, piece("21048"))![0];
    expect(e).toMatchObject({
      type: "thwart",
      target: "main",
      source: "cosmic-entity",
    });
    expect(e.ignoreCrisis).toBeUndefined();
    expect(e.encounter).toBeUndefined();
  });
});

describe("Mystic Spell target requirements before payment", () => {
  it.each([
    ["21043", "stunned", "confused", "enemy"],
    ["21050", "confused", "stunned", "scheme"],
  ] as const)(
    "%s rejects unavailable effect targets unless its matching status replaces the body",
    (code, matching, other, target) => {
      const { s, hand, deck, port, run, choose } = fixture();
      s.flags.fixtureTraits = "Mystic";
      const event = hand(code),
        [milled] = deck("01086", "01087");
      port.enemyTargets = () => [];
      port.schemeTargets = () => [];
      expect(pack.mtsPlayerPackPlayRestriction(s, event, port)).toContain(
        `eligible ${target}`,
      );
      s.player[other] = true;
      expect(pack.mtsPlayerPackPlayRestriction(s, event, port)).toContain(
        `eligible ${target}`,
      );
      s.player[matching] = true;
      expect(pack.mtsPlayerPackPlayRestriction(s, event, port)).toBeNull();
      run(
        pack.mtsPlayerPackBeforeEvent(s, event, [{ type: "status-gate" }])[0],
      );
      run(s.queue.shift()!);
      expect(s.prompt?.options.map((o) => o.id)).toEqual(["1", "2"]);
      choose("1");
      expect(port.discardPlayerTop).toHaveBeenCalledTimes(1);
      expect(s.player.discard.some((p) => p.id === milled.id)).toBe(true);
      expect(s.queue).toEqual([{ type: "status-gate" }]);
    },
  );
});
