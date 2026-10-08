import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import decks from "../src/data/catalog-decks.json" with { type: "json" };
import { consumeTough } from "../src/game/keywords.js";
import {
  activateSeat,
  seatView,
  syncSeat,
  upgradeSave,
} from "../src/game/team.js";
import {
  NOVA_SCRIPT_CODES,
  NOVA_ORIGINAL_SOURCE,
  NOVA_RULINGS_SOURCE,
  novaAbility,
  novaAbilityOptions,
  novaAchievement,
  novaAfterBasicPower,
  novaAfterEventPlayed,
  novaBasicPowerOptions,
  novaBoost,
  novaCanReadyPiece,
  novaCardPlayCommitted,
  novaDamageOptions,
  novaEncounterReveal,
  novaEnemyAttackModifiers,
  novaEvent,
  novaEventAction,
  novaEventPlayedOptions,
  novaForcefieldEffects,
  novaHandSize,
  novaHeroAbility,
  novaHeroAbilityOptions,
  novaInitializeNemesis,
  novaPaymentResources,
  novaPlayRestriction,
  novaResourceSources,
  novaResourceSpent,
  novaRoundEnded,
  novaShadowOfPast,
  novaTraits,
  resolveNovaEffect,
  type NovaAchievementReceipt,
  type NovaBasicReceipt,
  type NovaDamageContext,
  type NovaEventReceipt,
  type NovaPaymentReceipt,
  type NovaPorts,
} from "../src/game/nova.js";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const starter = decks.find((d) => d.heroCode === "28001a")!;
const N = (type: string, patch: Record<string, unknown> = {}): Effect => ({
  type: `nova:${type}`,
  ...patch,
});
const basic = (patch: Partial<NovaBasicReceipt> = {}): NovaBasicReceipt => ({
  token: "basic1",
  playerId: "p1",
  power: "attack",
  performed: true,
  wasHero: true,
  ...patch,
});
const achievement = (
  patch: Partial<NovaAchievementReceipt> = {},
): NovaAchievementReceipt => ({
  token: "hit1",
  playerId: "p1",
  kind: "enemy-defeat",
  targetId: "enemy1",
  attributedToIdentity: true,
  performed: true,
  ...patch,
});
const damage = (patch: Partial<NovaDamageContext> = {}): NovaDamageContext => ({
  token: "attack1",
  playerId: "p1",
  targetId: "hero:p1",
  fromAttack: true,
  amount: 7,
  friendly: true,
  ...patch,
});
function fixture(multiplayer = false) {
  const player = (): GameState["player"] => ({
    form: "hero",
    hp: 10,
    exhausted: false,
    flipped: false,
    tough: false,
    stunned: false,
    confused: false,
    hand: [],
    deck: [],
    discard: [],
    inPlay: [],
  });
  let s: GameState = {
    version: 1,
    seed: 28,
    nextId: 1,
    heroId: "nova",
    aspect: "aggression",
    villainId: "rhino",
    difficulty: "standard",
    module: "bomb_scare",
    phase: "player",
    round: 1,
    players: [],
    activePlayerId: "p1",
    firstPlayerId: "p1",
    turnPlayerId: "p1",
    playerCount: multiplayer ? 2 : 1,
    guided: false,
    review: null,
    reviewCount: 0,
    player: player(),
    villain: {
      id: "villain",
      code: "01094",
      hp: 50,
      maxHp: 50,
      stage: 1,
      damage: 0,
      counters: 0,
      exhausted: false,
      tough: false,
      stunned: false,
      confused: false,
    },
    scheme: { code: "01097", threat: 5, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
    environments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    removed: [],
    resolving: [],
    queue: [],
    prompt: null,
    flags: {},
    log: [],
    attack: null,
  };
  s.players = [
    {
      id: "p1",
      heroId: "nova",
      aspect: "aggression",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  if (multiplayer)
    s.players.push({
      id: "p2",
      heroId: "spider_man",
      aspect: "justice",
      player: player(),
      flags: {},
      ended: false,
      eliminated: false,
      mulliganDone: true,
    });
  const make = (state: GameState, code: string): Piece => ({
    id: `n${state.nextId++}`,
    code,
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: false,
    stunned: false,
    confused: false,
    ownerId: state.activePlayerId,
  });
  for (const [code, quantity] of Object.entries(starter.cards))
    for (let n = 0; n < quantity; n++) s.player.deck.push(make(s, code));
  const original = s.player.deck.map((p) => p.id);
  const f = {
    s,
    history: [] as string[],
    packets: [] as Effect[],
    generatedForCard: ["wild"] as Resource[],
    pendingDamage: 7,
    ports: {} as NovaPorts,
  };
  const remove = (state: GameState, id: string): Piece | undefined => {
    for (const seat of state.players) {
      const p = seatView(state, seat).player;
      for (const zone of [
        p.hand,
        p.deck,
        p.discard,
        p.inPlay,
        p.setAside || [],
      ]) {
        const i = zone.findIndex((p) => p.id === id);
        if (i >= 0) return zone.splice(i, 1)[0];
      }
    }
    for (const zone of [
      state.resolving,
      state.attachments,
      state.sideSchemes,
      state.minions,
      state.encounter.deck,
      state.encounter.discard,
      state.removed,
    ]) {
      const i = zone.findIndex((p) => p.id === id);
      if (i >= 0) return zone.splice(i, 1)[0];
    }
    return undefined;
  };
  f.ports = {
    queue: (state, ...effects) =>
      state.queue.unshift(
        ...effects.map((e) => ({ actorId: state.activePlayerId, ...e })),
      ),
    choose: (state, title, text, options) => {
      state.prompt = {
        kind: "choice",
        title,
        text,
        options: options.map((o) => ({
          ...o,
          effects: o.effects.map((e) => ({
            actorId: state.activePlayerId,
            ...e,
          })),
        })),
      };
    },
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    isIdentityTextBlank: (state) => !!state.flags.identityBlank,
    canReadyIdentity: (state) => !state.flags.cannotReady,
    canReadyPiece: (state, p) => !state.flags[`cannotReady:${p.id}`],
    canDraw: (state) =>
      !state.flags.cannotDraw &&
      state.player.deck.length + state.player.discard.length > 0,
    cardCost: (_state, p) => cards.get(p.code)?.cost || 0,
    canPay: (state, _cost, requirements) =>
      !state.flags.cannotPay &&
      (!requirements?.includes("wild") || !state.flags.noWild),
    pay: (state, title, cost, requirements, after) => {
      f.history.push(`pay:${title}:${cost}:${requirements.join()}`);
      f.ports.queue(
        state,
        ...after.map((e) => ({ ...e, generatedForCard: f.generatedForCard })),
      );
    },
    enemyTargets: (state, attack) => [
      ...(attack && state.minions.some((p) => p.code === "01103")
        ? []
        : [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]),
      ...state.minions.map((p) => ({
        id: p.id,
        code: p.code,
        label: cards.get(p.code)?.name || "Ultron Drone",
      })),
    ],
    schemeTargets: (state) => [
      ...(state.scheme.threat > 0 &&
      !state.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis)
        ? [{ id: "main", label: "Main scheme", code: state.scheme.code }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)?.name || p.code,
          code: p.code,
        })),
    ],
    attackProgram: (state, effects, after) => {
      f.history.push("attack-program");
      f.ports.queue(state, ...effects, ...after);
    },
    shufflePlayerDeck: (state, after) => {
      state.player.deck.reverse();
      f.history.push("shuffle-player");
      f.ports.queue(state, ...after);
    },
    shuffleEncounter: (state) => {
      state.encounter.deck.reverse();
      f.history.push("shuffle-encounter");
    },
    makePiece: make,
    putPlayerCard: (state, p, after) => {
      state.player.inPlay.push(p);
      f.history.push(`put:${p.id}`);
      f.ports.queue(state, ...after);
    },
    canDiscardPiece: (state, p) =>
      !state.flags[`cannotDiscard:${p.id}`] && !cards.get(p.code)?.permanent,
    discardPiece: (state, id) => {
      const p = remove(state, id);
      if (!p) return;
      (cards.get(p.code)?.faction_code === "encounter"
        ? state.encounter.discard
        : seatView(state, p.ownerId || state.activePlayerId).player.discard
      ).push(p);
      f.history.push(`discard:${id}`);
    },
    canPayAllyDamageCost: (state, p, amount) =>
      !p.exhausted &&
      !p.tough &&
      !state.flags[`preventCost:${p.id}`] &&
      (cards.get(p.code)?.health || 0) - p.damage >= amount,
    payAllyDamageCost: (state, id, amount, after) => {
      const p = state.player.inPlay.find((p) => p.id === id)!;
      expect(f.ports.canPayAllyDamageCost(state, p, amount)).toBe(true);
      p.exhausted = true;
      p.damage += amount;
      f.history.push(`ally-cost:${id}:${amount}`);
      if (p.damage >= cards.get(p.code)!.health!)
        f.ports.discardPiece(state, id);
      f.ports.queue(state, ...after);
    },
    reactionEvents: (state) => [
      ...state.player.hand,
      ...state.player.inPlay
        .filter((p) => p.code === "27007" && !f.ports.isTextBlank(state, p))
        .flatMap((p) => p.storedCards || []),
    ],
    canPlayDamageReaction: (state) => !state.flags.cannotPlay,
    playDamageReaction: (state, id, context, after) => {
      const p =
        remove(state, id) ||
        state.player.inPlay
          .flatMap((p) => p.storedCards || [])
          .find((p) => p.id === id);
      if (!p) throw Error("Actual reaction piece missing");
      for (const source of state.player.inPlay)
        source.storedCards = source.storedCards?.filter((q) => q.id !== id);
      state.resolving.push(p);
      f.ports.queue(
        state,
        ...novaForcefieldEffects(state, p, context, {
          generatedForCard: f.generatedForCard,
        }),
        { type: "fixture:discard", id },
        ...after,
      );
    },
    preventAttackDamage: (_state, context, amount) => {
      f.pendingDamage = Math.max(0, f.pendingDamage - amount);
      f.history.push(`prevent:${context.token}:${context.targetId}:${amount}`);
    },
    giveObligation: (state, p, id) => {
      remove(state, p.id);
      p.dealtTo = id;
      seatView(state, id).player.inPlay.push(p);
    },
    removeEncounter: (state, p) => {
      remove(state, p.id);
      state.removed.push(p);
    },
    controlledCards: (state) =>
      state.player.inPlay.filter(
        (p) => cards.get(p.code)?.faction_code !== "encounter",
      ),
    enemyAttack: (state, enemyId, playerId, allowAlter, continuation) => {
      f.history.push(`enemy-attack:${enemyId}:${playerId}:${allowAlter}`);
      f.ports.queue(state, continuation);
      return !state.flags.noAttack;
    },
    discardEncounterTop: (state, count, after) => {
      f.history.push(`encounter-discard:${count}`);
      for (let n = 0; n < count; n++) {
        if (!state.encounter.deck.length && state.encounter.discard.length) {
          state.encounter.deck.push(...state.encounter.discard.splice(0));
          state.encounter.acceleration++;
        }
        if (!state.encounter.deck.length) break;
        state.encounter.discard.push(state.encounter.deck.shift()!);
      }
      f.ports.queue(state, ...after);
    },
  };
  const pump = () => {
    for (let n = 0; !f.s.prompt && f.s.queue.length; n++) {
      if (n > 250) throw Error("Pure continuation loop");
      const e = f.s.queue.shift()!,
        previous = f.s.activePlayerId;
      if (e.actorId) activateSeat(f.s, e.actorId);
      try {
        if (resolveNovaEffect(f.s, e, f.ports)) continue;
        switch (e.type) {
          case "damage": {
            f.packets.push(e);
            if (e.target === f.s.villain.id) {
              if (!consumeTough(f.s.villain)) f.s.villain.hp -= e.amount;
            } else {
              const p = f.s.minions.find((p) => p.id === e.target);
              if (p && !consumeTough(p)) {
                p.damage += e.amount;
                if (p.damage >= (cards.get(p.code)?.health || 1))
                  f.ports.discardPiece(f.s, p.id);
              }
            }
            break;
          }
          case "ready": {
            if (e.target?.startsWith("hero:"))
              seatView(f.s, e.target.slice(5)).player.exhausted = false;
            else {
              const p = f.s.player.inPlay.find((p) => p.id === e.id);
              if (
                p &&
                novaCanReadyPiece(f.s, p, f.ports) &&
                f.ports.canReadyPiece(f.s, p)
              )
                p.exhausted = false;
            }
            break;
          }
          case "draw": {
            const view = e.playerId ? seatView(f.s, e.playerId) : f.s;
            if (view.flags.cannotDraw) break;
            for (let i = 0; i < e.amount && view.player.deck.length; i++)
              view.player.hand.push(view.player.deck.shift()!);
            break;
          }
          case "thwart":
            f.packets.push(e);
            if (e.target === "main")
              f.s.scheme.threat = Math.max(0, f.s.scheme.threat - e.amount);
            else {
              const p = f.s.sideSchemes.find((p) => p.id === e.target);
              if (p) p.counters = Math.max(0, p.counters - e.amount);
            }
            break;
          case "threat":
            if (e.target === "main") f.s.scheme.threat += e.amount;
            else {
              const p = f.s.sideSchemes.find((p) => p.id === e.target);
              if (p) p.counters += e.amount;
            }
            break;
          case "fixture:discard":
            f.ports.discardPiece(f.s, e.id);
            break;
          case "fixture:after":
            f.history.push("after");
            break;
          case "surge":
            f.history.push(`surge:${e.sourceCode}`);
            break;
          case "reveal": {
            const p: Piece = e.piece,
              c = cards.get(p.code)!;
            if (c.type_code === "minion") {
              p.engagedWith = f.s.activePlayerId;
              f.s.minions.push(p);
            } else if (c.type_code === "side_scheme") {
              p.counters = c.base_threat || 0;
              f.s.sideSchemes.push(p);
            } else f.s.resolving.push(p);
            f.history.push(`reveal:${p.id}`);
            f.ports.queue(f.s, ...(novaEncounterReveal(f.s, p) || []));
            break;
          }
          default:
            throw Error(`Unknown fixture effect: ${e.type}`);
        }
      } finally {
        activateSeat(f.s, previous);
      }
    }
  };
  const choose = (id: string) => {
    const o = f.s.prompt?.options.find((o) => o.id === id);
    expect(o, `actual choice ${id}`).toBeDefined();
    f.s.prompt = null;
    f.ports.queue(f.s, ...o!.effects);
    pump();
  };
  const run = (...effects: Effect[]) => {
    f.ports.queue(f.s, ...effects);
    pump();
  };
  const take = (
    code: string,
    zone: "hand" | "discard" | "inPlay" = "inPlay",
  ) => {
    const i = f.s.player.deck.findIndex((p) => p.code === code);
    expect(i, `source ${code}`).toBeGreaterThanOrEqual(0);
    const p = f.s.player.deck.splice(i, 1)[0];
    f.s.player[zone].push(p);
    return p;
  };
  const add = (code: string, zone: Piece[] = f.s.player.inPlay) => {
    const p = make(f.s, code);
    zone.push(p);
    return p;
  };
  const save = () => {
    syncSeat(f.s);
    f.s = upgradeSave(JSON.parse(JSON.stringify(f.s)));
  };
  const conserved = () => {
    function walk(this: void, p: Piece): Piece[] {
      return [
        p,
        ...(p.storedCards || []).flatMap(walk),
        ...(p.droneCard ? walk(p.droneCard) : []),
      ];
    }
    const all = [
      ...f.s.players.flatMap((seat) => {
        const p = seatView(f.s, seat).player;
        return [
          ...p.hand,
          ...p.deck,
          ...p.discard,
          ...p.inPlay,
          ...(p.setAside || []),
        ];
      }),
      ...f.s.resolving,
      ...f.s.removed,
      ...f.s.minions,
      ...f.s.sideSchemes,
      ...f.s.attachments,
      ...f.s.encounter.deck,
      ...f.s.encounter.discard,
    ].flatMap(walk);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    for (const id of original)
      expect(
        all.filter((p) => p.id === id),
        `original source ${id}`,
      ).toHaveLength(1);
  };
  const eventReceipt = (
    p: Piece,
    patch: Partial<NovaEventReceipt> = {},
  ): NovaEventReceipt => ({
    token: "play1",
    playerId: "p1",
    eventId: p.id,
    code: p.code,
    played: true,
    ...patch,
  });
  return {
    f,
    take,
    add,
    make,
    choose,
    run,
    pump,
    save,
    conserved,
    eventReceipt,
  };
}

describe("Nova original retail source and printed resource model", () => {
  it("pins all fifteen implemented faces, original signature quantities and source forty", () => {
    const signature = Object.entries(starter.cards).filter(
      ([code]) => cards.get(code)?.set_code === "nova",
    );
    expect(Object.fromEntries(signature)).toEqual({
      "28002": 1,
      "28003": 2,
      "28004": 3,
      "28005": 3,
      "28006": 2,
      "28007": 2,
      "28008": 1,
      "28009": 1,
    });
    expect(signature.reduce((n, [, q]) => n + q, 0)).toBe(15);
    expect(Object.values(starter.cards).reduce((n, q) => n + q, 0)).toBe(40);
    expect(starter.setupCards).toEqual({});
    expect(NOVA_SCRIPT_CODES).toHaveLength(15);
    expect(new Set(NOVA_SCRIPT_CODES).size).toBe(15);
    expect(NOVA_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(
      NOVA_SCRIPT_CODES.some(
        (code) => cards.get(code)?.set_code === "armadillo",
      ),
    ).toBe(false);
    expect(NOVA_ORIGINAL_SOURCE).toBe(
      "https://hallofheroeslcg.com/sam-alexander-nova/",
    );
    expect(NOVA_RULINGS_SOURCE).toContain("#nova");
  });
  it("preserves original Champion/Civilian forms and 1/1/2/3 statistics", () => {
    expect(cards.get("28001a")).toMatchObject({
      name: "Nova",
      traits: "Champion.",
      attack: 1,
      thwart: 1,
      defense: 2,
      health: 10,
      hand_size: 5,
    });
    expect(cards.get("28001b")).toMatchObject({
      name: "Sam Alexander",
      traits: "Civilian.",
      recover: 3,
      hand_size: 6,
    });
    expect(cards.get("28009")?.text).toContain("generate a [wild] resource");
  });
  it.each(["28004", "28005"])(
    "doubles only every generated Wild paying %s, preserving other types",
    (code) => {
      expect(
        novaPaymentResources(code, ["mental", "wild", "energy", "wild"]),
      ).toEqual(["mental", "wild", "wild", "energy", "wild", "wild"]);
      expect(novaPaymentResources(code, ["wild"], true)).toEqual(["wild"]);
    },
  );
  it.each(["28003", "28006", "28009", "28001b", "01011", undefined])(
    "does not invent a Helmet/Nova blanket doubling for %s",
    (code) => {
      expect(novaPaymentResources(code, ["wild", "physical"])).toEqual([
        "wild",
        "physical",
      ]);
    },
  );
  it("Helmet grants Hero Aerial, provides exactly one Wild, exhausts actual piece and obeys blanking", () => {
    const { f, take, conserved } = fixture(),
      p = take("28009");
    expect(novaTraits(f.s, f.ports)).toEqual(["Aerial"]);
    expect(novaResourceSources(f.s, f.ports)).toEqual([
      expect.objectContaining({
        id: p.id,
        resources: ["wild"],
        kind: "ability",
      }),
    ]);
    novaResourceSpent(f.s, p.id, f.ports);
    expect(p.exhausted).toBe(true);
    expect(novaResourceSources(f.s, f.ports)).toEqual([]);
    expect(() => novaResourceSpent(f.s, p.id, f.ports)).toThrow("unavailable");
    p.exhausted = false;
    f.s.flags[`blank:${p.id}`] = true;
    expect(novaTraits(f.s, f.ports)).toEqual([]);
    expect(novaResourceSources(f.s, f.ports)).toEqual([]);
    delete f.s.flags[`blank:${p.id}`];
    f.s.player.form = "alter";
    expect(novaTraits(f.s, f.ports)).toEqual([]);
    expect(novaResourceSources(f.s, f.ports)).toEqual([]);
    conserved();
  });
  it("Connection changes reset size immediately for each actual hand copy, not stored cards", () => {
    const { f, take, add, conserved } = fixture();
    const p = take("28007", "hand");
    expect(novaHandSize(f.s, 5, f.ports)).toBe(6);
    take("28007", "hand");
    expect(novaHandSize(f.s, 6, f.ports)).toBe(8);
    f.s.flags[`blank:${p.id}`] = true;
    expect(novaHandSize(f.s, 5, f.ports)).toBe(6);
    const george = add("27007");
    george.storedCards = [f.s.player.hand.pop()!];
    expect(novaHandSize(f.s, 5, f.ports)).toBe(5);
    conserved();
  });
  it("Worldmind is suppressed during fixed opening setup, then the same hydrated hand piece is ignored after Keep", () => {
    const { f, take, save, conserved } = fixture(),
      connection = take("28007", "hand");
    f.s.player.form = "alter";
    f.s.phase = "mulligan";
    expect(novaHandSize(f.s, 6, f.ports)).toBe(6);
    save();
    expect(f.s.player.hand[0].id).toBe(connection.id);
    expect(novaHandSize(f.s, 6, f.ports)).toBe(6);
    f.s.phase = "player";
    expect(novaHandSize(f.s, 6, f.ports)).toBe(7);
    conserved();
  });
});

describe("Nova completed basic powers and Weight of the World", () => {
  it.each(["attack", "thwart", "defense"] as const)(
    "readies actual exhausted Helmet after performed %s, once per trigger",
    (power) => {
      const { f, take, run, choose, save, conserved } = fixture(),
        p = take("28009");
      p.exhausted = true;
      run(...novaAfterBasicPower(f.s, basic({ power }), f.ports));
      expect(p.exhausted).toBe(true);
      save();
      choose(p.id);
      expect(f.s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(
        false,
      );
      f.s.player.inPlay.find((q) => q.id === p.id)!.exhausted = true;
      expect(novaBasicPowerOptions(f.s, basic({ power }), [], f.ports)).toEqual(
        [],
      );
      expect(
        novaBasicPowerOptions(
          f.s,
          basic({ token: "basic2", power }),
          [],
          f.ports,
        ),
      ).toHaveLength(1);
      conserved();
    },
  );
  it.each([
    { performed: false },
    { wasHero: false },
    { power: "recover" as const },
    { playerId: "p2" },
    { token: "" },
  ])("rejects nonperformed/REC/other-player receipts %j", (patch) => {
    const { f, take } = fixture();
    take("28009").exhausted = true;
    expect(novaAfterBasicPower(f.s, basic(patch), f.ports)).toEqual([]);
  });
  it("declining does not consume a later basic response; identity blank blocks, Helmet text blank does not", () => {
    const { f, take, run, choose } = fixture(),
      p = take("28009");
    p.exhausted = true;
    run(...novaAfterBasicPower(f.s, basic(), f.ports));
    choose("skip");
    expect(
      novaBasicPowerOptions(f.s, basic({ token: "later" }), [], f.ports),
    ).toHaveLength(1);
    f.s.flags[`blank:${p.id}`] = true;
    expect(novaBasicPowerOptions(f.s, basic(), [], f.ports)).toHaveLength(1);
    f.s.flags.identityBlank = true;
    expect(novaBasicPowerOptions(f.s, basic(), [], f.ports)).toEqual([]);
  });
  it("global obligation still locks the same Helmet transferred to a teammate, but never unrelated cards", () => {
    const { f, take, add } = fixture(true),
      helmet = take("28009"),
      obligation = add("28021");
    helmet.exhausted = true;
    const view = seatView(f.s, "p2"),
      other = add("01065", view.player.inPlay);
    other.ownerId = "p2";
    expect(novaCanReadyPiece(f.s, helmet, f.ports)).toBe(false);
    expect(novaCanReadyPiece(f.s, other, f.ports)).toBe(true);
    expect(novaAfterBasicPower(f.s, basic(), f.ports)).toEqual([]);
    f.s.player.inPlay.splice(f.s.player.inPlay.indexOf(helmet), 1);
    view.player.inPlay.push(helmet);
    expect(novaCanReadyPiece(view, helmet, f.ports)).toBe(false);
    f.s.flags[`blank:${obligation.id}`] = true;
    expect(novaCanReadyPiece(view, helmet, f.ports)).toBe(true);
  });

  it("revealed Weight goes to actual Sam seat, has no invented free flip, and AE exhaustion removes same ID", () => {
    const { f, add, run, save, conserved } = fixture(true),
      p = add("28021", f.s.resolving);
    activateSeat(f.s, "p2");
    const effects = novaEncounterReveal(f.s, p)!;
    expect(effects[0].actorId).toBe("p1");
    run(...effects);
    expect(f.s.prompt).toBe(null);
    activateSeat(f.s, "p1");
    expect(novaAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    save();
    novaAbility(f.s, p.id, f.ports, "remove");
    run();
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed.some((q) => q.id === p.id)).toBe(true);
    conserved();
  });
});

describe("Sam search and Jesse paid ordering", () => {
  it.each([false, true])(
    "Sam retains exact Helmet from discard, native put=%s, and shuffles searched deck",
    (wild) => {
      const { f, take, run, choose, save, conserved } = fixture(),
        p = take("28009", "discard");
      f.s.player.form = "alter";
      f.generatedForCard = [wild ? "wild" : "energy"];
      novaHeroAbility(f.s, f.ports, "sam-search");
      run();
      expect(f.history[0]).toBe("pay:Sam Alexander:1:");
      save();
      choose(p.id);
      expect(
        f.s.player[wild ? "inPlay" : "hand"].find((q) => q.id === p.id)?.code,
      ).toBe("28009");
      expect(f.history.at(-1)).toBe("shuffle-player");
      expect(f.s.player.flipped).toBe(false);
      conserved();
    },
  );
  it("overpaid Wild is not allocated Wild and cannot change Sam's search destination", () => {
    const { f, take, run, choose } = fixture(),
      p = take("28009", "discard");
    f.s.player.form = "alter";
    run(
      N("sam-search", {
        generatedForCard: ["energy"],
        paid: ["energy", "wild"],
      }),
    );
    choose(p.id);
    expect(f.s.player.hand.some((q) => q.id === p.id)).toBe(true);
    expect(f.s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
  });
  it("Sam requires available actual search card/payment and unblanked AE, with no exhaustion requirement", () => {
    const { f, take } = fixture();
    f.s.player.form = "alter";
    f.s.player.exhausted = true;
    expect(novaHeroAbilityOptions(f.s, f.ports)).toHaveLength(1);
    f.s.flags.cannotPay = true;
    expect(novaHeroAbilityOptions(f.s, f.ports)).toEqual([]);
    delete f.s.flags.cannotPay;
    f.s.flags.identityBlank = true;
    expect(novaHeroAbilityOptions(f.s, f.ports)).toEqual([]);
    delete f.s.flags.identityBlank;
    take("28009", "hand");
    expect(novaHeroAbilityOptions(f.s, f.ports)).toEqual([]);
  });
  it("Jesse exhausts before one actual discard copy is shuffled, then draws; other copy stays discard", () => {
    const { f, take, run, choose, save, conserved } = fixture(),
      jesse = take("28008"),
      first = take("28007", "discard"),
      second = take("28007", "discard");
    f.s.player.form = "alter";
    novaAbility(f.s, jesse.id, f.ports, "jesse");
    run();
    expect(jesse.exhausted).toBe(true);
    save();
    choose(first.id);
    expect(f.s.player.discard.some((q) => q.id === second.id)).toBe(true);
    expect(f.s.player.hand.some((q) => q.id === first.id)).toBe(true);
    expect(novaAbilityOptions(f.s, jesse.id, f.ports)).toEqual([]);
    conserved();
  });
  it("Jesse can resolve independent draw with no Worldmind; exhausted Jesse never draws free", () => {
    const { f, take, run } = fixture(),
      p = take("28008");
    f.s.player.form = "alter";
    novaAbility(f.s, p.id, f.ports);
    run();
    expect(f.s.player.hand).toHaveLength(1);
    expect(p.exhausted).toBe(true);
    expect(() => novaAbility(f.s, p.id, f.ports)).toThrow("unavailable");
    expect(f.s.player.hand).toHaveLength(1);
  });
});

describe("Nova native ordinary event programs and Unleash lasting attribution", () => {
  it.each(["28004", "28005"])(
    "ordinary %s retains printed action and distinct attack/thwart native program",
    (code) => {
      const { f, take, run, choose } = fixture(),
        p = take(code, "hand");
      expect(novaEventAction(p)).toBe(code === "28005" ? "attack" : "thwart");
      expect(novaPlayRestriction(f.s, p, f.ports)).toBe(null);
      run(...novaEvent(f.s, p)!);
      choose(code === "28005" ? "villain" : "main");
      expect(f.packets[0]).toMatchObject({
        amount: code === "28005" ? 4 : 3,
        source: "hero",
        ...(code === "28005"
          ? { attack: true, attackInitiated: true }
          : { action: true, thwartInitiated: true }),
      });
      expect(f.history.includes("attack-program")).toBe(code === "28005");
      f.s.player.form = "alter";
      expect(novaPlayRestriction(f.s, p, f.ports)).toContain("hero form");
    },
  );
  it("Lightspeed zero threat rejects until Confuse replacement; Forcefield has no free manual action", () => {
    const { f, take } = fixture(),
      flight = take("28004", "hand"),
      forcefield = take("28003", "hand");
    f.s.scheme.threat = 0;
    expect(novaPlayRestriction(f.s, flight, f.ports)).toContain("legal scheme");
    f.s.player.confused = true;
    expect(novaPlayRestriction(f.s, flight, f.ports)).toBe(null);
    expect(novaPlayRestriction(f.s, forcefield, f.ports)).toContain(
      "actual friendly",
    );
  });
  it("Unleash PLAY maximum includes canceled committed card and eliminated players, idempotent same PLAY only", () => {
    const { f, take } = fixture(true),
      p = take("28006", "hand");
    novaCardPlayCommitted(f.s, p, "play1");
    novaCardPlayCommitted(f.s, p, "play1");
    expect(f.s.flags.novaUnleashRound).toBeUndefined();
    expect(novaPlayRestriction(f.s, p, f.ports)).toContain("max 1");
    expect(() => novaCardPlayCommitted(f.s, p, "play2")).toThrow("max 1");
    f.s.players[0].eliminated = true;
    activateSeat(f.s, "p2");
    expect(() => novaCardPlayCommitted(f.s, p, "other-seat")).toThrow("max 1");
    f.s.round++;
    expect(() => novaCardPlayCommitted(f.s, p, "next-round")).not.toThrow();
  });
  it("Unleash resolves each actual enemy/scheme occurrence, including simultaneous different targets and repeat target later", () => {
    const { f, take, run, save, conserved } = fixture(),
      p = take("28006", "hand");
    novaCardPlayCommitted(f.s, p, "unleash1");
    run(...novaEvent(f.s, p, { playToken: "unleash1" })!);
    f.s.player.exhausted = true;
    run(...novaAchievement(f.s, achievement()));
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.hand).toHaveLength(2);
    save();
    run(...novaAchievement(f.s, achievement()));
    expect(f.s.player.hand).toHaveLength(2);
    run(...novaAchievement(f.s, achievement({ targetId: "enemy2" })));
    expect(f.s.player.hand).toHaveLength(3);
    run(...novaAchievement(f.s, achievement({ token: "again" })));
    expect(f.s.player.hand).toHaveLength(4);
    run(
      ...novaAchievement(
        f.s,
        achievement({ token: "scheme", kind: "last-threat", targetId: "main" }),
      ),
    );
    expect(f.s.player.hand).toHaveLength(5);
    conserved();
  });
  it.each([
    { attributedToIdentity: false },
    { performed: false },
    { playerId: "p2" },
    { token: "" },
  ])(
    "never invents Unleash achievements for allied/prevented/misattributed %j",
    (patch) => {
      const { f } = fixture(true);
      f.s.flags.novaUnleashRound = f.s.round;
      expect(novaAchievement(f.s, achievement(patch))).toEqual([]);
    },
  );
  it("lasting Unleash independently draws when ready forbidden and readies when draw forbidden; round expires", () => {
    const { f, run } = fixture();
    f.s.flags.novaUnleashRound = f.s.round;
    f.s.flags.cannotReady = true;
    f.s.player.exhausted = true;
    run(...novaAchievement(f.s, achievement()));
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.hand).toHaveLength(1);
    delete f.s.flags.cannotReady;
    f.s.flags.cannotDraw = true;
    run(...novaAchievement(f.s, achievement({ token: "second" })));
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.hand).toHaveLength(1);
    novaRoundEnded(f.s);
    expect(novaAchievement(f.s, achievement({ token: "expired" }))).toEqual([]);
  });
  it("established Unleash survives later identity blanking and is scoped to the actual Nova seat", () => {
    const { f, run } = fixture(true);
    f.s.flags.novaUnleashRound = f.s.round;
    f.s.flags.identityBlank = true;
    activateSeat(f.s, "p2");
    run(...novaAchievement(f.s, achievement()));
    expect(seatView(f.s, "p1").player.hand).toHaveLength(1);
    expect(seatView(f.s, "p2").player.hand).toHaveLength(0);
  });
});

describe("Ms. Marvel actual event and Forcefield reaction", () => {
  it("Ms. Marvel can pay her last HP, leave play, then recover the exact event from discard", () => {
    const { f, take, eventReceipt, run, choose, save, conserved } = fixture(),
      ally = take("28002"),
      event = take("28005", "discard");
    ally.damage = 2;
    run(...novaAfterEventPlayed(f.s, eventReceipt(event), f.ports));
    save();
    choose(ally.id);
    expect(f.s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(f.s.player.hand.some((p) => p.id === event.id)).toBe(true);
    conserved();
  });
  it.each([
    "tough",
    "exhausted",
    "blank",
    "alter",
    "missing",
    "unplayed",
    "other-player",
  ])("Ms. Marvel respects actual %s restriction", (restriction) => {
    const { f, take, eventReceipt } = fixture(),
      ally = take("28002"),
      event = take("28004", "discard"),
      receipt = eventReceipt(event);
    if (restriction === "tough") ally.tough = true;
    if (restriction === "exhausted") ally.exhausted = true;
    if (restriction === "blank") f.s.flags[`blank:${ally.id}`] = true;
    if (restriction === "alter") f.s.player.form = "alter";
    if (restriction === "missing") {
      f.s.player.discard.splice(f.s.player.discard.indexOf(event), 1);
      f.s.player.hand.push(event);
    }
    if (restriction === "unplayed") receipt.played = false;
    if (restriction === "other-player") receipt.playerId = "p2";
    expect(novaEventPlayedOptions(f.s, receipt, [], f.ports)).toEqual([]);
  });
  it("new PLAY token allows same physical event to be returned again after legitimate ally ready", () => {
    const { f, take, eventReceipt, run, choose } = fixture(),
      ally = take("28002"),
      event = take("28003", "discard");
    run(...novaAfterEventPlayed(f.s, eventReceipt(event), f.ports));
    choose(ally.id);
    f.s.player.hand.splice(f.s.player.hand.indexOf(event), 1);
    f.s.player.discard.push(event);
    ally.exhausted = false;
    expect(
      novaEventPlayedOptions(f.s, eventReceipt(event), [], f.ports),
    ).toEqual([]);
    expect(
      novaEventPlayedOptions(
        f.s,
        eventReceipt(event, { token: "play2" }),
        [],
        f.ports,
      ),
    ).toHaveLength(1);
  });
  it.each([
    { fromAttack: false },
    { friendly: false },
    { amount: 0 },
    { token: "" },
  ])("Forcefield rejects false damage context %j", (patch) => {
    const { f, take } = fixture();
    take("28003", "hand");
    expect(novaDamageOptions(f.s, damage(patch), [], f.ports)).toEqual([]);
  });
  it.each([false, true])(
    "Forcefield prevention keeps friendly ally victim and adds independent nonattack damage only if wild=%s",
    (wild) => {
      const { f, take, add, run, choose, save, conserved } = fixture(),
        event = take("28003", "hand"),
        ally = take("28002");
      add("01103", f.s.minions);
      f.generatedForCard = [wild ? "wild" : "energy"];
      run(
        ...novaForcefieldEffects(f.s, event, damage({ targetId: ally.id }), {
          generatedForCard: f.generatedForCard,
        }),
      );
      expect(f.pendingDamage).toBe(4);
      if (wild) {
        expect(f.s.prompt?.options.some((o) => o.id === "villain")).toBe(true);
        save();
        choose("villain");
        expect(f.packets[0]).toMatchObject({
          amount: 3,
          attack: false,
          target: "villain",
        });
      } else expect(f.packets).toEqual([]);
      expect(f.history[0]).toBe(`prevent:attack1:${ally.id}:3`);
      conserved();
    },
  );
  it("wild overpayment gives no Forcefield damage and converted cost Wild retains original bonus", () => {
    const { f, take, run } = fixture(),
      p = take("28003", "hand");
    run(
      ...novaForcefieldEffects(f.s, p, damage(), {
        generatedForCard: ["energy"],
        paidForCard: ["wild"],
      }),
    );
    expect(f.s.prompt).toBe(null);
    run(
      ...novaForcefieldEffects(f.s, p, damage({ token: "attack2" }), {
        generatedForCard: ["wild"],
        paidForCard: ["mental"],
      }),
    );
    expect(f.s.prompt?.options.some((o) => o.id === "villain")).toBe(true);
  });
  it("owned unblanked George storage is PLAY-only available; replay same actual Forcefield has no invented per-window maximum", () => {
    const { f, take, add } = fixture(),
      p = take("28003", "hand"),
      george = add("27007");
    f.s.player.hand.splice(f.s.player.hand.indexOf(p), 1);
    george.storedCards = [p];
    expect(
      novaDamageOptions(f.s, damage(), [], f.ports).map((o) => o.id),
    ).toContain(p.id);
    f.s.flags[`blank:${george.id}`] = true;
    expect(novaDamageOptions(f.s, damage(), [], f.ports)).toEqual([]);
    delete f.s.flags[`blank:${george.id}`];
    expect(
      novaDamageOptions(f.s, damage({ amount: 4 }), [], f.ports),
    ).toHaveLength(1);
    expect(
      novaResourceSources(f.s, f.ports).some((source) => source.id === p.id),
    ).toBe(false);
  });
});

describe("Nova physical nemesis and printed-wild encounter semantics", () => {
  it("initializes exactly five physical nemesis cards once, reveals actual minion/scheme and shuffles same remaining IDs", () => {
    const { f, run, conserved, save } = fixture();
    novaInitializeNemesis(f.s, f.ports);
    const ids = f.s.player.setAside!.map((p) => p.id);
    expect(f.s.player.setAside!.map((p) => p.code).sort()).toEqual([
      "28022",
      "28023",
      "28024",
      "28024",
      "28025",
    ]);
    novaInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual(ids);
    save();
    run(...novaShadowOfPast(f.s)!);
    expect(f.s.minions[0].code).toBe("28023");
    expect(f.s.sideSchemes[0]).toMatchObject({ code: "28022", counters: 2 });
    expect(f.s.encounter.deck).toHaveLength(3);
    expect(
      new Set(
        [...f.s.minions, ...f.s.sideSchemes, ...f.s.encounter.deck].map(
          (p) => p.id,
        ),
      ),
    ).toEqual(new Set(ids));
    run(...novaShadowOfPast(f.s)!);
    expect(f.history).toContain("surge:01190");
    conserved();
  });
  it("Warbringer counts printed-Wild CARDS in attacked player's hand, not number of icons/inPlay/discard or current seat", () => {
    const { f, take, add } = fixture(true),
      minion = add("28023", f.s.minions);
    take("28007", "hand");
    add("01044", f.s.player.hand);
    take("28007", "discard");
    add("10032");
    expect(novaEnemyAttackModifiers(f.s, minion, "p1", f.ports)).toEqual({
      attack: 2,
      overkill: true,
    });
    expect(novaEnemyAttackModifiers(f.s, minion, "p2", f.ports)).toEqual({
      attack: 0,
      overkill: true,
    });
    f.s.flags[`blank:${minion.id}`] = true;
    expect(novaEnemyAttackModifiers(f.s, minion, "p1", f.ports)).toEqual({
      attack: 0,
      overkill: false,
    });
  });
  it("War Delivery boost counts printed-wild cards not icons and resolves main threat once", () => {
    const { f, take, add, run } = fixture();
    take("28007", "hand");
    add("01044", f.s.player.hand);
    const boost = add("28024", f.s.encounter.discard);
    expect(novaBoost(f.s, boost)).toEqual([
      { type: "threat", target: "main", amount: 2 },
    ]);
    run(...novaBoost(f.s, boost)!);
    expect(f.s.scheme.threat).toBe(7);
  });
  it("Bring the War visits both actual seats and places one threat only per actual in-play discard", () => {
    const { f, add, run, choose, save, conserved } = fixture(true),
      first = add("10032"),
      second = add("10032", seatView(f.s, "p2").player.inPlay);
    second.ownerId = "p2";
    takeControlHandOnly();
    function takeControlHandOnly() {
      add("01044", f.s.player.hand);
    }
    const side = add("28022", f.s.sideSchemes);
    side.counters = 2;
    run(...novaEncounterReveal(f.s, side)!);
    choose(first.id);
    save();
    choose(second.id);
    expect(side.counters).toBe(3);
    expect(f.s.sideSchemes.find((p) => p.id === side.id)?.counters).toBe(4);
    expect(
      seatView(f.s, "p1").player.discard.some((p) => p.id === first.id),
    ).toBe(true);
    expect(
      seatView(f.s, "p2").player.discard.some((p) => p.id === second.id),
    ).toBe(true);
    conserved();
  });
  it("Bring the War cannot reach hand/deck/discard/George storage or undiscardable controlled cards", () => {
    const { f, take, add, run } = fixture(),
      george = add("27007"),
      wild = add("10032");
    f.s.flags[`cannotDiscard:${wild.id}`] = true;
    take("28007", "hand");
    take("28007", "discard");
    george.storedCards = [f.s.player.hand.pop()!];
    const side = add("28022", f.s.sideSchemes);
    side.counters = 2;
    run(...novaEncounterReveal(f.s, side)!);
    expect(f.s.prompt).toBe(null);
    expect(side.counters).toBe(2);
  });
  it("War Delivery spends required actual Wild or serially activates villain and surviving actual Warbringer, even AE", () => {
    const { f, add, run, choose } = fixture(),
      war = add("28023", f.s.minions),
      delivery = add("28024", f.s.resolving);
    f.s.player.form = "alter";
    run(...novaEncounterReveal(f.s, delivery)!);
    choose("attack");
    expect(f.history.filter((line) => line.startsWith("enemy-attack"))).toEqual(
      ["enemy-attack:villain:p1:true", `enemy-attack:${war.id}:p1:true`],
    );
    run(...novaEncounterReveal(f.s, delivery)!);
    choose("pay");
    expect(f.history).toContain("pay:War Delivery:1:wild");
    expect(
      f.history.filter((line) => line.startsWith("enemy-attack")),
    ).toHaveLength(2);
  });
  it("War Delivery without Wild still offers attacks and never invents a Warbringer", () => {
    const { f, add, run, choose } = fixture(),
      delivery = add("28024", f.s.resolving);
    f.s.flags.noWild = true;
    run(...novaEncounterReveal(f.s, delivery)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["attack"]);
    choose("attack");
    expect(f.history).toContain("enemy-attack:villain:p1:true");
  });
  it("War's Been Brought counts printed-Wild ICONS in hand/control/discard exactly once and crosses encounter exhaustion", () => {
    const { f, take, add, run, conserved } = fixture();
    take("28007", "hand");
    take("28007", "discard");
    add("01044", f.s.player.hand);
    add("10032");
    take("28009");
    for (let n = 0; n < 3; n++) add("01181", f.s.encounter.deck);
    const event = add("28025", f.s.resolving);
    run(...novaEncounterReveal(f.s, event)!);
    expect(f.history).toContain("encounter-discard:5");
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.s.encounter.deck).toHaveLength(1);
    conserved();
  });
  it("all encounter faces have explicit reveal/boost dispatch and unknown effects reject", () => {
    const { f, add } = fixture();
    for (const code of ["28021", "28022", "28023", "28024", "28025"]) {
      const p = add(code);
      expect(novaEncounterReveal(f.s, p)).not.toBe(null);
      expect(novaBoost(f.s, p)).not.toBe(null);
    }
    expect(resolveNovaEffect(f.s, { type: "ordinary" }, f.ports)).toBe(false);
    expect(() => resolveNovaEffect(f.s, N("unknown"), f.ports)).toThrow(
      "Unknown Nova",
    );
  });
});
