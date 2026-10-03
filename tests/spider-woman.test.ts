import { describe, expect, it, vi } from "vitest";
import { card } from "../src/game/cards";
import { makePiece, newGame } from "../src/game/engine";
import { activateSeat, playerOrder, seatView } from "../src/game/team";
import { consumeStatus, giveStatus } from "../src/game/keywords";
import { compileCardScript } from "../src/game/scripts/compiler";
import {
  heroRuntime,
  heroStarterAspects,
  heroStarterCodes,
  validateHeroDeck,
} from "../src/game/hero-runtime";
import catalog from "../src/data/catalog-cards.json";
import type { Card, Effect, GameState, Piece } from "../src/game/types";
import {
  SPIDER_WOMAN_SCRIPT_CODES,
  SPIDER_WOMAN_CORE_ALIASES,
  SPIDER_WOMAN_COMPILED_CODES,
  spiderWomanStats,
  spiderWomanHasAerial,
  spiderWomanHandSize,
  spiderWomanCardPlayed,
  spiderWomanAbilityOptions,
  spiderWomanAbility,
  spiderWomanResourceSources,
  spiderWomanResourceSpent,
  spiderWomanPlayRestriction,
  spiderWomanEvent,
  spiderWomanAllyEnter,
  spiderWomanAllyBasicUsed,
  spiderWomanSchemeDefeated,
  spiderWomanEncounterReveal,
  spiderWomanBoost,
  resolveSpiderWomanEffect,
  type SpiderWomanPorts,
} from "../src/game/spider-woman";

function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 207,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "she_hulk", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  s.heroId = s.players[0].heroId = "spider_woman";
  s.phase = "player";
  s.prompt = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.scheme.threat = 4;
  s.encounter.deck = [];
  s.encounter.discard = [];
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.inPlay = [];
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
    view.player.hp = 11;
  }
  const ports: SpiderWomanPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    revealHidden: vi.fn((state) => {
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    }),
    shufflePlayerDeck: vi.fn(),
    shuffleEncounter: vi.fn(),
    identityMaxHP: () => 11,
    canReadyIdentity: () => true,
    canGiveStatus: (state, id, kind) => {
      const p =
        id === "hero"
          ? state.player
          : [state.villain, ...state.minions].find((p) => p.id === id);
      return !!p && !p[kind];
    },
    enemyTargets: (state, attack) =>
      [
        ...(!attack || !state.minions.some((p) => p.code === "01100")
          ? [state.villain]
          : []),
        ...state.minions,
      ].map((p) => ({ id: p.id, code: p.code, label: card(p).name })),
    schemeTargets: (state, thwart) => [
      ...(!state.sideSchemes.some((p) => card(p).scheme_crisis) &&
      !(thwart && state.minions.some((p) => p.code === "03027")) &&
      state.scheme.threat > 0
        ? [
            {
              id: "main",
              code: state.scheme.code,
              label: card(state.scheme.code).name,
            },
          ]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({ id: p.id, code: p.code, label: card(p).name })),
    ],
    peekableDecks: (state) => [
      ...playerOrder(state).map((seat) => ({
        id: `player:${seat.id}`,
        label: `${seat.id}'s player deck`,
        top: seatView(state, seat).player.deck[0],
      })),
      {
        id: "encounter",
        label: "Encounter deck",
        top: state.encounter.deck[0],
      },
      ...playerOrder(state)
        .filter((seat) => seatView(state, seat).player.invocationDeck?.length)
        .map((seat) => ({
          id: `invocation:${seat.id}`,
          label: `${seat.id}'s Invocation deck`,
          top: seatView(state, seat).player.invocationDeck![0],
        })),
    ],
    thwartDistribution: vi.fn(
      (state: GameState, packets: { target: string; amount: number }[]) => {
        for (const { target, amount } of packets) {
          if (target === "main") state.scheme.threat -= amount;
          else
            state.sideSchemes.find((p) => p.id === target)!.counters -= amount;
        }
      },
    ),
    attackMinion: vi.fn(
      (state: GameState, id: string, _playerId: string, after: Effect) => {
        const p = state.minions.find((p) => p.id === id)!;
        const performed = !p.stunned;
        if (p.stunned) consumeStatus(p, "stunned");
        state.queue.unshift({ ...after, performed });
      },
    ),
    putMinion: vi.fn((state: GameState, p: Piece, playerId: string) => {
      state.encounter.deck = state.encounter.deck.filter((x) => x.id !== p.id);
      state.encounter.discard = state.encounter.discard.filter(
        (x) => x.id !== p.id,
      );
      p.engagedWith = playerId;
      p.damage = 0;
      p.stunned = false;
      p.confused = false;
      state.minions.push(p);
    }),
    log: vi.fn(),
  };
  const play = (code: string, playerId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = playerId;
    seatView(s, playerId).player.inPlay.push(p);
    return p;
  };
  const minion = (code = "04056", playerId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.engagedWith = playerId;
    s.minions.push(p);
    return p;
  };
  const scheme = (code = "04055", threat = 3) => {
    const p = makePiece(s, code);
    p.counters = threat;
    s.sideSchemes.push(p);
    return p;
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    expect(resolveSpiderWomanEffect(s, e, ports)).toBe(true);
  };
  const drain = () => {
    let guard = 0;
    while (s.queue[0]?.type.startsWith("sw:") && !s.prompt && guard++ < 100)
      run(s.queue.shift()!);
    expect(guard).toBeLessThan(100);
  };
  const choose = (id: string) => {
    const o = s.prompt?.options.find((o) => o.id === id);
    expect(o).toBeTruthy();
    s.prompt = null;
    s.queue.unshift(...o!.effects);
    drain();
  };
  return { s, ports, play, minion, scheme, run, drain, choose };
}

describe("Spider-Woman's complete Rise of Red Skull hero and starter dependency contracts", () => {
  it("assigns all28 faces once and closes the published40-card aggression/justice starter", () => {
    const source = (catalog as unknown as Card[]).filter(
      (c) => c.pack_code === "trors" && c.position! >= 31 && c.position! <= 57,
    );
    const codes = [
      ...SPIDER_WOMAN_SCRIPT_CODES,
      ...SPIDER_WOMAN_CORE_ALIASES,
      ...SPIDER_WOMAN_COMPILED_CODES,
    ];
    expect(source).toHaveLength(28);
    expect(new Set(codes).size).toBe(28);
    expect(codes.slice().sort()).toEqual(source.map((c) => c.code).sort());
    for (const code of SPIDER_WOMAN_CORE_ALIASES)
      expect(compileCardScript(card(code)).implementation).toBe("core");
    for (const code of SPIDER_WOMAN_COMPILED_CODES)
      expect(compileCardScript(card(code)).implementation).toBe("script");
    expect(heroStarterAspects("spider_woman").sort()).toEqual([
      "aggression",
      "justice",
    ]);
    expect(heroStarterCodes("spider_woman")).toHaveLength(40);
    expect(
      validateHeroDeck(
        "spider_woman",
        ["aggression", "justice"],
        heroStarterCodes("spider_woman"),
      ).errors,
    ).toEqual([]);
    expect(heroRuntime("spider_woman")?.supplementaryCards).toEqual({});
  });
  it("Superhuman Agility is optional, counts each signature aspect separately and persists for exactly its round", () => {
    const { s, run } = fixture();
    for (const code of ["04035", "04036", "04037", "04038"]) {
      const effects = spiderWomanCardPlayed(s, card(code));
      expect(effects[0].type).toBe("optional");
      expect(spiderWomanCardPlayed(s, card(code))).toHaveLength(1);
      run(effects[0].effects[0]);
      expect(spiderWomanCardPlayed(s, card(code))).toEqual([]);
    }
    expect(spiderWomanStats(s)).toEqual({ attack: 4, thwart: 4, defense: 4 });
    s.player.form = "alter";
    expect(spiderWomanStats(s).attack).toBe(0);
    s.player.form = "hero";
    expect(spiderWomanStats(s).attack).toBe(4);
    s.round++;
    expect(spiderWomanStats(s).attack).toBe(0);
    expect(spiderWomanCardPlayed(s, card("04035"))).toHaveLength(1);
  });
  it("Agility doesn't trigger for basic/hero cards, a spent aspect resource or an alter-ego play", () => {
    const { s } = fixture();
    expect(spiderWomanCardPlayed(s, card("04033"))).toEqual([]);
    expect(spiderWomanCardPlayed(s, card("04050"))).toEqual([]);
    s.player.form = "alter";
    expect(spiderWomanCardPlayed(s, card("04035"))).toEqual([]);
    // Power-of is an aspect card if actually played; payment never calls this hook.
    s.player.form = "hero";
    expect(spiderWomanCardPlayed(s, card("01055"))).toHaveLength(1);
  });
  it("Finesse pays only aspect cards and their abilities in hero form, including signature aspect events", () => {
    const { s, play } = fixture();
    const first = play("04033"),
      second = play("04033");
    expect(spiderWomanResourceSources(s, "04035").map((p) => p.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(spiderWomanResourceSources(s, "06018")).toHaveLength(2);
    expect(spiderWomanResourceSources(s, "04039")).toEqual([]);
    expect(spiderWomanResourceSources(s)).toEqual([]);
    first.exhausted = true;
    expect(spiderWomanResourceSources(s, "04037")).toHaveLength(1);
    s.player.form = "alter";
    expect(spiderWomanResourceSources(s, "04035")).toEqual([]);
    expect(() => spiderWomanResourceSpent(s, second, "04035")).toThrow(
      "hero form",
    );
    s.player.form = "hero";
    expect(() => spiderWomanResourceSpent(s, second, "04039")).toThrow(
      "aspect card",
    );
  });
  it("Jessica looks at another player's deck privately without drawing, shuffling or resetting an empty deck", () => {
    const { s, ports, run, choose } = fixture(true);
    s.player.form = "alter";
    const p = makePiece(s, "04043");
    seatView(s, "p2").player.deck = [p];
    run(spiderWomanAbility(s, "identity", "double-agent", ports)![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["player:p2"]);
    expect(s.prompt?.options[0].image).toBeUndefined();
    expect(ports.revealHidden).not.toHaveBeenCalled();
    choose("player:p2");
    expect(s.prompt?.options[0].image).toBe(p.code);
    expect(s.prompt?.options[0].label).toBe("Press the Advantage");
    expect(seatView(s, "p2").player.deck).toEqual([p]);
    expect(ports.revealHidden).toHaveBeenCalledOnce();
    expect(ports.shufflePlayerDeck).not.toHaveBeenCalled();
    expect(ports.log).not.toHaveBeenCalled();
    expect(spiderWomanAbilityOptions(s, "identity", ports)).toEqual([]);
    choose("done");
  });
  it("look selects encounter and invocation decks and rejects stale deck choices before spending its limit", () => {
    const { s, ports, run } = fixture();
    s.player.form = "alter";
    s.encounter.deck = [makePiece(s, "04056")];
    s.player.invocationDeck = [makePiece(s, "09032")];
    run({ type: "sw:peek" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "encounter",
      "invocation:p1",
    ]);
    s.encounter.deck = [];
    expect(() => run({ type: "sw:peek-deck", deck: "encounter" })).toThrow(
      "top card",
    );
    expect(s.flags.swPeekRound).toBeUndefined();
    expect(ports.revealHidden).not.toHaveBeenCalled();
  });
  it("Apartment searches only its actual top5, finds Power-of and signature aspects, exhausts once and shuffles the whole remaining deck", () => {
    const { s, ports, play, run, choose } = fixture();
    s.player.form = "alter";
    const apartment = play("04034");
    const top = ["04050", "01055", "04038", "04033", "04039", "04040"].map(
      (code) => makePiece(s, code),
    );
    s.player.deck = [...top];
    run(spiderWomanAbility(s, apartment.id, undefined, ports)![0]);
    expect(apartment.exhausted).toBe(true);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([top[1].id, top[2].id]);
    choose(top[2].id);
    expect(s.player.hand).toEqual([top[2]]);
    expect(s.player.deck).toEqual(top.filter((p) => p !== top[2]));
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    expect(spiderWomanAbilityOptions(s, apartment.id, ports)).toEqual([]);
  });
  it("Apartment failed searches still exhaust and shuffle and never refill the inspected top5 from discard", () => {
    const { s, ports, play, run } = fixture();
    s.player.form = "alter";
    const p = play("04034");
    s.player.deck = [makePiece(s, "04050")];
    s.player.discard = [makePiece(s, "04035")];
    run({ type: "sw:apartment", id: p.id });
    expect(p.exhausted).toBe(true);
    expect(s.prompt).toBeNull();
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    expect(s.player.discard).toHaveLength(1);
    expect(s.player.hand).toEqual([]);
  });
  it("Apartment stale search selection fails before moving a different card or shuffling", () => {
    const { s, ports, play, run } = fixture();
    s.player.form = "alter";
    const p = play("04034");
    const target = makePiece(s, "04035");
    s.player.deck = [target];
    run({ type: "sw:apartment", id: p.id });
    s.player.deck = Array.from({ length: 5 }, () =>
      makePiece(s, "04050"),
    ).concat(target);
    expect(() =>
      run({ type: "sw:apartment-found", id: target.id, top: [target.id] }),
    ).toThrow("top 5");
    expect(s.player.hand).toEqual([]);
    expect(ports.shufflePlayerDeck).not.toHaveBeenCalled();
  });
  it("Inconspicuous allocates one3-threat thwart before reductions, splitting its amount exactly", () => {
    const { s, ports, scheme, run, choose } = fixture();
    const side = scheme("04055", 2);
    run(spiderWomanEvent(s, makePiece(s, "04038"))![0]);
    choose(`${side.id}:2`);
    expect(side.counters).toBe(2);
    expect(s.scheme.threat).toBe(4);
    expect(ports.thwartDistribution).not.toHaveBeenCalled();
    choose("main:1");
    expect(ports.thwartDistribution).toHaveBeenCalledWith(s, [
      { target: side.id, amount: 2 },
      { target: "main", amount: 1 },
    ]);
    expect(side.counters).toBe(0);
    expect(s.scheme.threat).toBe(3);
  });
  it("Inconspicuous cannot allocate to the main scheme while Crisis existed, even if this distribution clears that crisis", () => {
    const { s, ports, scheme, run, choose } = fixture();
    const crisis = scheme("01108", 1),
      other = scheme("04055", 3);
    expect(card(crisis).scheme_crisis).toBe(1);
    run({ type: "sw:inconspicuous", remaining: 3, assigned: {} });
    expect(s.prompt?.options.some((o) => o.id.startsWith("main:"))).toBe(false);
    choose(`${crisis.id}:1`);
    expect(s.prompt?.options.some((o) => o.id.startsWith("main:"))).toBe(false);
    choose(`${other.id}:2`);
    expect(s.scheme.threat).toBe(4);
    expect(ports.thwartDistribution).toHaveBeenCalledOnce();
  });
  it("Inconspicuous removes all available threat when fewer than3 remain and rejects over-allocation atomically", () => {
    const { s, ports, run, choose } = fixture();
    s.scheme.threat = 1;
    run({ type: "sw:inconspicuous", remaining: 3, assigned: {} });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["main:1"]);
    expect(() =>
      run({
        type: "sw:inconspicuous-assign",
        remaining: 3,
        assigned: {},
        legal: ["main"],
        target: "main",
        amount: 2,
      }),
    ).toThrow("no longer legal");
    expect(s.scheme.threat).toBe(1);
    choose("main:1");
    expect(s.scheme.threat).toBe(0);
    expect(ports.thwartDistribution).toHaveBeenCalledWith(s, [
      { target: "main", amount: 1 },
    ]);
  });
  it("Glide grants Aerial through the round and can grant Aerial even if already ready or ready-locked", () => {
    const { s, ports, run } = fixture();
    s.player.exhausted = false;
    ports.canReadyIdentity = () => false;
    expect(
      spiderWomanPlayRestriction(s, makePiece(s, "04039"), ports),
    ).toBeNull();
    run(spiderWomanEvent(s, makePiece(s, "04039"))![0]);
    expect(spiderWomanHasAerial(s)).toBe(true);
    expect(s.queue).toEqual([{ type: "ready", target: "hero" }]);
    expect(
      spiderWomanPlayRestriction(s, makePiece(s, "04039"), ports),
    ).toContain("cannot ready");
    s.player.form = "alter";
    expect(spiderWomanHasAerial(s)).toBe(true);
    s.player.form = "hero";
    s.round++;
    expect(spiderWomanHasAerial(s)).toBe(false);
  });
  it("Contaminant Immunity requires at least healing or Tough to change and schedules both printed clauses", () => {
    const { s, ports } = fixture();
    s.player.tough = true;
    expect(
      spiderWomanPlayRestriction(s, makePiece(s, "04037"), ports),
    ).toContain("requires damage");
    s.player.hp = 8;
    expect(
      spiderWomanPlayRestriction(s, makePiece(s, "04037"), ports),
    ).toBeNull();
    expect(spiderWomanEvent(s, makePiece(s, "04037"))).toEqual([
      { type: "heal", target: "hero", amount: 3 },
      { type: "status", target: "hero", status: "tough" },
    ]);
  });
  it("Press the Advantage draws only if its attacked enemy still exists and has the status after damage", () => {
    const { s, minion, run } = fixture();
    const p = minion();
    p.stunned = true;
    run({ type: "sw:press", target: p.id });
    expect(s.queue.shift()).toEqual({
      type: "damage",
      target: p.id,
      amount: 2,
      attack: true,
      source: "hero",
    });
    run(s.queue.shift()!);
    expect(s.queue.shift()).toEqual({ type: "draw", amount: 1 });
    run({ type: "sw:press", target: p.id });
    s.queue.shift();
    s.minions = [];
    run(s.queue.shift()!);
    expect(s.queue).toEqual([]);
    s.villain.stunned = true;
    run({ type: "sw:press", target: s.villain.id });
    s.queue.shift();
    s.villain.code = "01095";
    run(s.queue.shift()!);
    expect(s.queue.shift()?.type).toBe("draw");
  });
  it("Captain Marvel draws after actual basic attack/thwart in either form, before consequential damage, never from defending", () => {
    const { s, play } = fixture(true);
    const p = play("04032", "p2");
    seatView(s, "p2").player.form = "alter";
    for (const kind of ["attack", "thwart"] as const) {
      const e = spiderWomanAllyBasicUsed(s, p, kind)[0];
      expect(e.actorId).toBe("p2");
      expect(e.effects).toEqual([{ type: "draw", amount: 1, actorId: "p2" }]);
    }
    expect(spiderWomanAllyBasicUsed(s, p, "defense")).toEqual([]);
  });
  it("Spider-Girl and Spider-Man respond only to an actual play from hand; Spider-Man scales with starting players and is not a thwart", () => {
    const { s, play, scheme, run, choose } = fixture(true);
    const girl = play("04040"),
      man = play("04045");
    expect(spiderWomanAllyEnter(s, girl)).toEqual([]);
    expect(spiderWomanAllyEnter(s, man, false)).toEqual([]);
    expect(spiderWomanAllyEnter(s, girl, true)![0].effects[0].type).toBe(
      "sw:spider-girl",
    );
    const side = scheme("04055", 8);
    run(spiderWomanAllyEnter(s, man, true)![0].effects[0]);
    choose(side.id);
    expect(s.queue).toEqual([{ type: "thwart", target: side.id, amount: 6 }]);
    expect(s.queue[0].action).toBeUndefined();
  });
  it("Skilled Investigator opens independent hero-only owner responses and validates its exhaust before drawing", () => {
    const { s, ports, play, scheme, run } = fixture(true);
    const a = play("04047"),
      b = play("04047", "p2");
    seatView(s, "p2").player.form = "alter";
    const responses = spiderWomanSchemeDefeated(s, scheme());
    expect(responses).toHaveLength(1);
    run(responses[0].effects[0]);
    expect(a.exhausted).toBe(true);
    expect(b.exhausted).toBe(false);
    expect(s.queue.shift()).toEqual({ type: "draw", amount: 1 });
    expect(() => run(responses[0].effects[0])).toThrow("unavailable");
    expect(
      spiderWomanPlayRestriction(s, makePiece(s, "04047"), ports),
    ).toContain("maximum 1");
  });
  it("Uncertain Loyalties has no implicit form flip and always offers3 main threat, while alter-ego can pay its exhaust", () => {
    const { s, run, choose } = fixture();
    const p = makePiece(s, "04053");
    run(spiderWomanEncounterReveal(s, p)![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["threat"]);
    choose("threat");
    expect(s.queue).toEqual([
      { type: "threat", target: "main", amount: 3 },
      { type: "discardEncounter", piece: p },
    ]);
    s.queue = [];
    s.player.form = "alter";
    run({ type: "sw:obligation", piece: p });
    choose("exhaust");
    expect(s.player.exhausted).toBe(true);
    expect(s.queue).toEqual([{ type: "removeEncounter", piece: p }]);
  });
  it("Viper hand-size penalty follows its engaged player in both forms and ends immediately on leaving play", () => {
    const { s, minion } = fixture(true);
    const p = minion("04054", "p2");
    expect(spiderWomanHandSize(s)).toBe(0);
    expect(spiderWomanHandSize(seatView(s, "p2"))).toBe(-1);
    seatView(s, "p2").player.form = "alter";
    expect(spiderWomanHandSize(seatView(s, "p2"))).toBe(-1);
    p.engagedWith = "p1";
    expect(spiderWomanHandSize(s)).toBe(-1);
    s.minions = [];
    expect(spiderWomanHandSize(s)).toBe(0);
  });
  it("Viper's Ambition adds player-scaled threat to its fixed2 base; Regular's Incite belongs only to reveal keywords", () => {
    const { s } = fixture(true);
    const side = makePiece(s, "04055");
    expect(spiderWomanEncounterReveal(s, side)).toEqual([
      { type: "threat", target: side.id, amount: 2 },
    ]);
    expect(spiderWomanEncounterReveal(s, makePiece(s, "04056"))).toEqual([]);
    for (const code of ["04053", "04054", "04055", "04056", "04057"])
      expect(spiderWomanBoost(s, makePiece(s, code))).toEqual([]);
  });
  it("Hail Hydra attacks only Hydra minions engaged with heroes and explicitly searches for every un-attacked player", () => {
    const { s, ports, minion, run, drain, choose } = fixture(true);
    const hydra = minion("04056", "p1");
    minion("01102", "p1");
    seatView(s, "p2").player.form = "alter";
    const found = makePiece(s, "04054");
    s.encounter.deck = [found];
    run(spiderWomanEncounterReveal(s, makePiece(s, "04057"))![0]);
    drain();
    expect(ports.attackMinion).toHaveBeenCalledWith(
      s,
      hydra.id,
      "p1",
      expect.objectContaining({ type: "sw:hydra-after-attack" }),
    );
    expect(s.prompt?.options.map((o) => o.id)).toEqual([found.id]);
    choose(found.id);
    expect(found.engagedWith).toBe("p2");
    expect(s.encounter.deck).toEqual([]);
    expect(ports.shuffleEncounter).toHaveBeenCalledOnce();
    expect(s.queue).toEqual([]);
  });
  it("Hail Hydra counts the defending player's redirected attack and searches for the originally engaged hero", () => {
    const { s, ports, minion, run, drain, choose } = fixture(true);
    minion("04056", "p1");
    const found = makePiece(s, "04056");
    s.encounter.deck = [found];
    ports.attackMinion = (state, _id, _playerId, after) => {
      state.queue.unshift({
        ...after,
        performed: true,
        attackedPlayerId: "p2",
      });
    };
    run({ type: "sw:hydra", origin: "p1" });
    drain();
    choose(found.id);
    expect(found.engagedWith).toBe("p1");
    expect(s.minions.filter((p) => p.engagedWith === "p2")).toEqual([]);
    expect(s.prompt).toBeNull();
  });
  it("a stunned Hydra attack does not count, so Hail Hydra also searches for its hero and never fires a found Regular's Incite", () => {
    const { s, ports, minion, run, drain, choose } = fixture();
    const hydra = minion();
    giveStatus(hydra, card(hydra), "stunned");
    const found = makePiece(s, "04056");
    s.encounter.discard = [found];
    run({ type: "sw:hydra", origin: "p1" });
    drain();
    expect(hydra.stunned).toBe(false);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([found.id]);
    const threatBefore = s.scheme.threat;
    choose(found.id);
    expect(s.minions).toContain(found);
    expect(s.scheme.threat).toBe(threatBefore);
    expect(ports.shuffleEncounter).not.toHaveBeenCalled();
  });
  it("Hail Hydra respects unique conflicts, completes failed searches and restores its origin after another player's engagement", () => {
    const { s, ports, minion, run, drain } = fixture(true);
    s.player.form = "alter";
    seatView(s, "p2").player.form = "alter";
    minion("04054");
    s.encounter.deck = [makePiece(s, "04054"), makePiece(s, "01102")];
    run({ type: "sw:hydra", origin: "p1" });
    drain();
    expect(s.prompt).toBeNull();
    expect(ports.putMinion).not.toHaveBeenCalled();
    expect(ports.shuffleEncounter).toHaveBeenCalledOnce();
    expect(s.activePlayerId).toBe("p1");
  });
  it("reloadable effects retain all allocation/attack context; unmatched native namespaces fail closed", () => {
    const { s, ports, run } = fixture();
    const serialized = JSON.stringify({
      type: "sw:inconspicuous",
      remaining: 1,
      legal: ["main"],
      assigned: { main: 2 },
    });
    run(JSON.parse(serialized));
    expect(s.prompt?.options[0].id).toBe("main:1");
    expect(
      resolveSpiderWomanEffect(s, { type: "another-module:effect" }, ports),
    ).toBe(false);
    expect(() => run({ type: "sw:unknown" })).toThrow(
      "Unimplemented Spider-Woman",
    );
  });
});
