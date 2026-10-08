import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import decks from "../src/data/catalog-decks.json" with { type: "json" };
import {
  consumeStatus,
  consumeTough,
  giveStatus,
  printedKeyword,
} from "../src/game/keywords.js";
import {
  activateSeat,
  seatView,
  syncSeat,
  upgradeSave,
} from "../src/game/team.js";
import {
  MILES_MORALES_SCRIPT_CODES,
  milesAbility,
  milesAbilityOptions,
  milesAfterBasicPower,
  milesBasicPowerOptions,
  milesBoost,
  milesCardEntered,
  milesCardPlayCommitted,
  milesEncounterReveal,
  milesEnemyAttackKeywords,
  milesEvent,
  milesEventAction,
  milesFormChanged,
  milesFormResponseOptions,
  milesInitializeNemesis,
  milesPlayRestriction,
  milesPaymentAllowed,
  milesResourceSources,
  milesResourceSpent,
  milesShadowOfPast,
  milesSpecialAvailable,
  milesSpecialEffects,
  resolveMilesMoralesEffect,
  type MilesBasicReceipt,
  type MilesFormReceipt,
  type MilesMoralesPorts,
  type MilesPaymentReceipt,
} from "../src/game/miles-morales.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const starter = decks.find((d) => d.heroCode === "27030a")!;
const crisisCode = [...cards.values()].find(
  (c) => c.type_code === "side_scheme" && c.scheme_crisis,
)!.code;
const M = (type: string, patch: Record<string, unknown> = {}): Effect => ({
  type: `miles:${type}`,
  ...patch,
});
function fixture(multiplayer = false, milesSeat = "p1") {
  const player = (): GameState["player"] => ({
    form: "hero",
    hp: 9,
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
    seed: 27,
    nextId: 1,
    heroId: "spider_man_morales",
    aspect: "justice",
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
      heroId: milesSeat === "p1" ? "spider_man_morales" : "spider_man",
      aspect: "justice",
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
      heroId: milesSeat === "p2" ? "spider_man_morales" : "spider_man",
      aspect: "justice",
      player: player(),
      flags: {},
      ended: false,
      eliminated: false,
      mulliganDone: true,
    });
  if (multiplayer) activateSeat(s, milesSeat);
  const make = (state: GameState, code: string): Piece => ({
    id: `mm${state.nextId++}`,
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
  const originals = s.player.deck.map((p) => p.id);
  const f = {
    s,
    history: [] as string[],
    packets: [] as Effect[],
    attackResult: { performed: true, defeatedCharacter: false },
    ports: {} as MilesMoralesPorts,
  };
  const character = (state: GameState, id: string) =>
    id === "hero"
      ? state.player
      : id.startsWith("hero:")
        ? seatView(state, id.slice(5)).player
        : id === state.villain.id
          ? state.villain
          : state.minions.find((p) => p.id === id);
  const characterCard = (state: GameState, id: string): Card => {
    const c =
      id === "hero" || id.startsWith("hero:")
        ? cards.get("27030a")!
        : cards.get((character(state, id) as Piece).code)!;
    return state.flags[`blank:${id}`] ? { ...c, text: "" } : c;
  };
  const remove = (state: GameState, id: string) => {
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
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some((p) => printedKeyword(cards.get(p.code)!, "Guard"))
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(state.scheme.threat > 0 &&
      (!thwart || !state.flags.patrol) &&
      !state.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis)
        ? [{ id: "main", label: "Main" }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    canGiveStatus: (state, id, status) => {
      const p = character(state, id);
      return (
        !!p &&
        !state.flags[`immune:${id}`] &&
        giveStatus(structuredClone(p), characterCard(state, id), status)
      );
    },
    canReadyIdentity: (state, id) => !seatView(state, id).flags.cannotReady,
    canChangeForm: (state) => !state.flags.formLocked,
    canPay: (state, _cost, requirements) =>
      !state.flags.cannotPay &&
      (!requirements?.includes("physical") || !state.flags.cannotPayPhysical),
    cardCost: (_state, p) => cards.get(p.code)?.cost || 0,
    canDiscardPiece: (state, p) =>
      !state.flags[`cannotDiscard:${p.id}`] &&
      !printedKeyword(cards.get(p.code)!, "Permanent"),
    discardPiece: (state, id) => {
      const p = remove(state, id);
      if (!p) return;
      f.history.push(`discard:${p.id}`);
      (cards.get(p.code)?.faction_code === "encounter"
        ? state.encounter.discard
        : seatView(state, p.ownerId || state.activePlayerId).player.discard
      ).push(p);
    },
    discardHand: (state, id) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i >= 0) state.player.discard.push(state.player.hand.splice(i, 1)[0]);
    },
    flip: (state, counts, after, target) => {
      const from = state.player.form;
      state.player.form = target || (from === "hero" ? "alter" : "hero");
      if (counts) state.player.flipped = true;
      f.history.push(`flip:${from}:${state.player.form}:${counts}`);
      const receipt: MilesFormReceipt = {
        token: `flip${state.nextId++}`,
        playerId: state.activePlayerId,
        from,
        to: state.player.form,
      };
      f.ports.queue(
        state,
        ...milesFormChanged(state, receipt, f.ports),
        ...after,
      );
    },
    shufflePlayerDeck: (state, after) => {
      state.player.deck.reverse();
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
      f.history.push("shuffle-player");
      f.ports.queue(state, ...after);
    },
    shuffleEncounter: (state) => {
      state.encounter.deck.reverse();
      f.history.push("shuffle-encounter");
    },
    makePiece: make,
    attackProgram: (state, effects, after) => {
      f.history.push("attack-program");
      f.ports.queue(state, ...effects, ...after);
    },
    enemyAttack: (state, enemyId, playerId, allowAlter, continuation) => {
      f.history.push(`enemy-attack:${enemyId}:${playerId}:${allowAlter}`);
      if (state.flags.noAttack) return false;
      const p = state.minions.find((p) => p.id === enemyId)!;
      const result = p.stunned
        ? (consumeStatus(p, "stunned"),
          { performed: false, defeatedCharacter: false })
        : f.attackResult;
      f.ports.queue(state, { ...continuation, ...result });
      return true;
    },
    placeAccelerationToken: (state, id, amount) => {
      const p = state.sideSchemes.find((p) => p.id === id)! as Piece & {
        accelerationTokens?: number;
      };
      p.accelerationTokens = (p.accelerationTokens || 0) + amount;
      f.history.push(`acceleration:${id}:${amount}`);
    },
    attachEncounter: (state, p, id) => {
      remove(state, p.id);
      p.attachedTo = id;
      state.attachments.push(p);
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
    discardEncounter: (state, p) => {
      remove(state, p.id);
      state.encounter.discard.push(p);
    },
  };
  const all = () => {
    const walk = (p: Piece): Piece[] => [
      p,
      ...(p.storedCards || []).flatMap(walk),
      ...(p.droneCard ? walk(p.droneCard) : []),
    ];
    return [
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
  };
  const conserved = () => {
    for (const id of originals)
      expect(
        all().filter((p) => p.id === id),
        `original source ${id}`,
      ).toHaveLength(1);
  };
  const save = () => {
    syncSeat(f.s);
    f.s = upgradeSave(JSON.parse(JSON.stringify(f.s)));
  };
  const pump = () => {
    for (let n = 0; !f.s.prompt && f.s.queue.length; n++) {
      if (n > 250) throw Error("Pure fixture continuation loop");
      const e = f.s.queue.shift()!,
        previous = f.s.activePlayerId;
      if (e.actorId) activateSeat(f.s, e.actorId);
      try {
        if (resolveMilesMoralesEffect(f.s, e, f.ports)) continue;
        switch (e.type) {
          case "damage": {
            f.packets.push(e);
            const p = character(f.s, e.target) as Piece | undefined;
            if (p && !consumeTough(p)) {
              if (p.id === f.s.villain.id) f.s.villain.hp -= e.amount;
              else {
                p.damage += e.amount;
                if (p.damage >= (cards.get(p.code)?.health || 1))
                  f.ports.discardPiece(f.s, p.id);
              }
            }
            break;
          }
          case "status": {
            const p = character(f.s, e.target);
            if (p && !f.s.flags[`immune:${e.target}`])
              giveStatus(p, characterCard(f.s, e.target), e.status);
            break;
          }
          case "ready": {
            const p = character(f.s, e.target);
            if (p) p.exhausted = false;
            break;
          }
          case "draw":
            for (let i = 0; i < e.amount && f.s.player.deck.length; i++)
              f.s.player.hand.push(f.s.player.deck.shift()!);
            break;
          case "thwart": {
            f.packets.push(e);
            if (e.target === "main")
              f.s.scheme.threat = Math.max(0, f.s.scheme.threat - e.amount);
            else {
              const p = f.s.sideSchemes.find((p) => p.id === e.target);
              if (p) p.counters = Math.max(0, p.counters - e.amount);
            }
            break;
          }
          case "optional":
            f.ports.choose(f.s, e.title, e.text, [
              { id: "yes", label: "Use response", effects: e.effects },
              { id: "skip", label: "Decline", effects: e.after || [] },
            ]);
            break;
          case "surge":
            f.history.push(`surge:${e.sourceCode}`);
            break;
          case "fixture:discard-event":
            f.ports.discardPiece(f.s, e.id);
            break;
          case "fixture:after":
            f.history.push("after");
            break;
          case "fixture:finish-encounter":
            if (f.s.resolving.some((p) => p.id === e.id))
              f.ports.discardPiece(f.s, e.id);
            break;
          case "reveal": {
            const p: Piece = e.piece,
              c = cards.get(p.code)!;
            f.history.push(`reveal:${p.code}:${p.id}`);
            if (c.type_code === "minion") {
              p.engagedWith = f.s.activePlayerId;
              f.s.minions.push(p);
            } else if (c.type_code === "side_scheme") {
              p.counters = c.base_threat || 0;
              f.s.sideSchemes.push(p);
            } else f.s.resolving.push(p);
            f.ports.queue(f.s, ...(milesEncounterReveal(f.s, p) || []), {
              type: "fixture:finish-encounter",
              id: p.id,
            });
            break;
          }
          default:
            throw Error(`Unhandled fixture ${e.type}`);
        }
      } finally {
        activateSeat(f.s, previous);
      }
    }
    conserved();
  };
  const run = (...effects: Effect[]) => {
    f.ports.queue(f.s, ...effects);
    pump();
  };
  const choose = (id: string) => {
    save();
    const o = f.s.prompt?.options.find((o) => o.id === id);
    expect(o, JSON.stringify(f.s.prompt)).toBeTruthy();
    f.s.prompt = null;
    run(...o!.effects);
  };
  const take = (code: string, seat = f.s.activePlayerId) => {
    const p = seatView(f.s, seat).player;
    for (const z of [p.deck, p.hand, p.discard, p.inPlay]) {
      const i = z.findIndex((p) => p.code === code);
      if (i >= 0) return z.splice(i, 1)[0];
    }
    const q = make(f.s, code);
    q.ownerId = seat;
    return q;
  };
  const put = (code: string, seat = f.s.activePlayerId) => {
    const p = take(code, seat);
    seatView(f.s, seat).player.inPlay.push(p);
    milesCardEntered(f.s, p);
    return p;
  };
  const discarded = (code: string) => {
    const p = take(code);
    f.s.player.discard.push(p);
    return p;
  };
  const minion = (code = "01103", patch: Partial<Piece> = {}) => {
    const p = { ...make(f.s, code), ...patch };
    f.s.minions.push(p);
    return p;
  };
  const side = (code = "01107", threat = 2) => {
    const p = make(f.s, code);
    p.counters = threat;
    f.s.sideSchemes.push(p);
    return p;
  };
  const event = (code: string, receipt: MilesPaymentReceipt = {}) => {
    const p = take(code);
    f.s.resolving.push(p);
    run(...milesEvent(f.s, p, receipt)!, {
      type: "fixture:discard-event",
      id: p.id,
    });
    return p;
  };
  const basic = (
    patch: Partial<MilesBasicReceipt> = {},
  ): MilesBasicReceipt => ({
    token: "basic1",
    playerId: f.s.activePlayerId,
    power: "attack",
    performed: true,
    wasHero: true,
    ...patch,
  });
  const form = (patch: Partial<MilesFormReceipt> = {}): MilesFormReceipt => ({
    token: "form1",
    playerId: f.s.activePlayerId,
    from: "hero",
    to: "alter",
    ...patch,
  });
  return {
    f,
    run,
    choose,
    save,
    all,
    conserved,
    take,
    put,
    discarded,
    minion,
    side,
    event,
    basic,
    form,
  };
}

describe("Miles original faces, source and physical nemeses", () => {
  it("registers the exact16 faces and original40 source with15 Hero13 Justice12 Basic", () => {
    const { f } = fixture();
    expect(MILES_MORALES_SCRIPT_CODES).toHaveLength(16);
    expect(new Set(MILES_MORALES_SCRIPT_CODES).size).toBe(16);
    expect(MILES_MORALES_SCRIPT_CODES.every((code) => cards.has(code))).toBe(
      true,
    );
    expect(f.s.player.deck).toHaveLength(40);
    for (const [faction, count] of [
      ["hero", 15],
      ["justice", 13],
      ["basic", 12],
    ] as const)
      expect(
        f.s.player.deck.filter(
          (p) => cards.get(p.code)?.faction_code === faction,
        ),
      ).toHaveLength(count);
    expect(cards.get("27030a")).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      health: 9,
      hand_size: 5,
      traits: "Champion. Web-Warrior.",
    });
    expect(cards.get("27030b")).toMatchObject({
      recover: 4,
      health: 9,
      hand_size: 6,
      traits: "Civilian.",
    });
  });
  it("initializes exactly five reserved actual nemeses once outside the forty cards", () => {
    const { f, all } = fixture();
    milesInitializeNemesis(f.s, f.ports);
    const ids = f.s.player.setAside!.map((p) => p.id);
    milesInitializeNemesis(f.s, f.ports);
    expect(f.s.player.setAside!.map((p) => p.code)).toEqual([
      "27057",
      "27058",
      "27059",
      "27060",
      "27060",
    ]);
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual(ids);
    expect(f.s.player.deck).toHaveLength(40);
    for (const id of ids)
      expect(all().filter((p) => p.id === id)).toHaveLength(1);
  });
  it("Shadows reveals same-ID Tracking Prey/Prowler and shuffles only the other three", () => {
    const { f, run, all } = fixture();
    f.s.player.form = "alter";
    milesInitializeNemesis(f.s, f.ports);
    const reserve = [...f.s.player.setAside!];
    run(...milesShadowOfPast(f.s)!);
    expect(f.s.sideSchemes).toHaveLength(1);
    expect(f.s.sideSchemes[0].counters).toBe(4);
    expect(
      (f.s.sideSchemes[0] as Piece & { accelerationTokens: number })
        .accelerationTokens,
    ).toBe(1);
    expect(f.s.minions[0]).toMatchObject({ code: "27058", tough: true });
    expect(f.s.encounter.deck.map((p) => p.code).sort()).toEqual([
      "27059",
      "27060",
      "27060",
    ]);
    expect(f.s.player.setAside).toEqual([]);
    expect(
      f.history
        .filter((entry) => entry.startsWith("reveal:"))
        .map((entry) => entry.split(":")[1]),
    ).toEqual(["27058", "27057"]);
    for (const p of reserve)
      expect(all().filter((q) => q.id === p.id)).toHaveLength(1);
    expect(milesShadowOfPast(f.s)).toEqual([
      { type: "surge", sourceCode: "01190" },
    ]);
  });
  it.each([
    ["27056", 2],
    ["27057", 3],
    ["27058", 2],
    ["27059", 2],
    ["27060", 1],
  ] as const)(
    "%s has only its printed%s numeric boost and no invented starred text",
    (code, boost) => {
      const { f, take } = fixture();
      const p = take(code);
      expect(cards.get(code)?.boost || 0).toBe(boost);
      expect(cards.get(code)?.boost_star).toBeFalsy();
      expect(milesBoost(f.s, p)).toEqual([]);
      expect(milesBoost(f.s, take("01103"))).toBeNull();
    },
  );
});

describe("Miles Specials are explicitly instructed nonattack abilities", () => {
  it("neither Special is exposed as an ordinary free identity action", () => {
    const { f } = fixture();
    expect(milesAbilityOptions(f.s, "identity", f.ports)).toEqual([]);
    expect(milesAbility(f.s, "identity", f.ports, "venom-blast")).toBe(false);
    expect(f.s.queue).toEqual([]);
  });
  it("Venom Blast ignores Guard, never consumes Stun, deals nonattack2 and stuns that actual enemy", () => {
    const { f, run, choose, minion } = fixture();
    minion("01101");
    f.s.player.stunned = true;
    run(...milesSpecialEffects(f.s, "venom-blast"));
    expect(f.s.prompt?.options.some((o) => o.id === f.s.villain.id)).toBe(true);
    choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(48);
    expect(f.s.villain.stunned).toBe(true);
    expect(f.s.player.stunned).toBe(true);
    expect(f.packets).toEqual([
      expect.objectContaining({ amount: 2, attack: false }),
    ]);
    expect(f.history).not.toContain("attack-program");
  });
  it("Tough can prevent Venom Blast damage while the same enemy is still stunned", () => {
    const { f, run, choose } = fixture();
    f.s.villain.tough = true;
    run(...milesSpecialEffects(f.s, "venom-blast"));
    choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(50);
    expect(f.s.villain.tough).toBe(false);
    expect(f.s.villain.stunned).toBe(true);
  });
  it("defeating the selected minion never redirects its following stun to the villain", () => {
    const { f, run, choose, minion } = fixture();
    const p = minion("01103", { damage: 2 });
    run(...milesSpecialEffects(f.s, "venom-blast"));
    choose(p.id);
    expect(f.s.minions.some((q) => q.id === p.id)).toBe(false);
    expect(f.s.villain.stunned).toBe(false);
  });
  it("Spider Camouflage gives actual Miles Tough and separately confuses a chosen enemy without consuming Confuse", () => {
    const { f, run, choose } = fixture();
    f.s.player.confused = true;
    run(...milesSpecialEffects(f.s, "spider-camouflage"));
    choose(f.s.villain.id);
    expect(f.s.player.tough).toBe(true);
    expect(f.s.player.confused).toBe(true);
    expect(f.s.villain.confused).toBe(true);
  });
  it("a different controller borrowing the printed instruction gives Tough to Miles, not that controller", () => {
    const { f, run, choose } = fixture(true, "p2");
    activateSeat(f.s, "p1");
    run(...milesSpecialEffects(f.s, "spider-camouflage"));
    choose(f.s.villain.id);
    expect(seatView(f.s, "p2").player.tough).toBe(true);
    expect(seatView(f.s, "p1").player.tough).toBe(false);
  });
  it("already-Tough Miles can resolve just Confuse; Stalwart enemies do not prevent the separate Tough effect", () => {
    const { f, run, choose, minion } = fixture();
    f.s.player.tough = true;
    run(...milesSpecialEffects(f.s, "spider-camouflage"));
    choose(f.s.villain.id);
    expect(f.s.villain.confused).toBe(true);
    minion("27058");
    f.s.player.tough = false;
    f.s.flags[`immune:${f.s.villain.id}`] = true;
    run(...milesSpecialEffects(f.s, "spider-camouflage"));
    expect(f.s.prompt).toBeNull();
    expect(f.s.player.tough).toBe(true);
  });
  it("an unavailable or blank identity Special skips while preserving its saved continuation", () => {
    const { f, run } = fixture();
    f.s.flags.identityBlank = true;
    expect(milesSpecialAvailable(f.s, "venom-blast", f.ports)).toBe(false);
    run(
      ...milesSpecialEffects(f.s, "venom-blast", [{ type: "fixture:after" }]),
    );
    expect(f.history).toEqual(["after"]);
    delete f.s.flags.identityBlank;
    f.s.player.form = "alter";
    expect(milesSpecialAvailable(f.s, "spider-camouflage", f.ports)).toBe(
      false,
    );
  });
});

describe("Miles printed events and allocated payment types", () => {
  it.each([
    [false, false, 2],
    [true, false, 5],
    [false, true, 5],
    [true, true, 8],
  ] as const)(
    "Arachnobatics deals one actual attack packet (stun=%s confuse=%s amount%s)",
    (stunned, confused, amount) => {
      const { f, event, choose } = fixture();
      f.s.villain.stunned = stunned;
      f.s.villain.confused = confused;
      event("27031");
      choose(f.s.villain.id);
      expect(f.s.villain.hp).toBe(50 - amount);
      expect(f.packets).toHaveLength(1);
      expect(f.packets[0]).toMatchObject({ attack: true, amount });
    },
  );
  it("Arachnobatics counts status CARD presence even when one Steady card does not make an enemy stunned/confused", () => {
    const { f, event, choose } = fixture();
    f.s.villain.stunCards = 1;
    f.s.villain.confuseCards = 1;
    f.s.villain.stunned = f.s.villain.confused = false;
    event("27031");
    choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(42);
  });
  it("Web-Shot's Energy clause makes a new nonattack target choice after its actual four-damage attack", () => {
    const { f, event, choose, minion } = fixture();
    const p = minion("01103");
    event("27034", { paidForCard: ["energy", "physical"] });
    choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(46);
    choose(p.id);
    expect(f.packets.map((e) => [e.amount, e.attack, e.target])).toEqual([
      [4, true, f.s.villain.id],
      [2, false, p.id],
    ]);
    expect(f.s.minions.find((q) => q.id === p.id)?.stunned).toBe(true);
  });
  it.each(["27031", "27034"])(
    "a Stunned %s ability is entirely replaced and cannot trigger a paid Special",
    (code) => {
      const { f, event } = fixture();
      f.s.player.stunned = true;
      event(code, { paidForCard: ["energy", "physical"] });
      expect(f.s.player.stunned).toBe(false);
      expect(f.packets).toEqual([]);
      expect(f.s.prompt).toBeNull();
      expect(f.s.villain.stunned).toBe(false);
    },
  );
  it("Swing In removes4 from a legal scheme then resolves Camouflage only for allocated Mental", () => {
    const { f, event, choose } = fixture();
    event("27033", { paidForCard: ["mental", "physical"] });
    choose("main");
    expect(f.s.scheme.threat).toBe(1);
    expect(f.s.player.tough).toBe(true);
    choose(f.s.villain.id);
    expect(f.s.villain.confused).toBe(true);
    expect(f.packets[0]).toMatchObject({
      action: true,
      thwartInitiated: true,
      amount: 4,
    });
  });
  it("a Confused Swing In replaces the entire ability, including its paid Camouflage clause", () => {
    const { f, event } = fixture();
    f.s.player.confused = true;
    event("27033", { paidForCard: ["mental", "physical"] });
    expect(f.s.player.confused).toBe(false);
    expect(f.s.player.tough).toBe(false);
    expect(f.s.scheme.threat).toBe(5);
    expect(f.s.prompt).toBeNull();
  });
  it.each([
    ["27034", "energy"],
    ["27033", "mental"],
  ] as const)(
    "overpaid%s/%s is excluded from conditional benefits",
    (code, type) => {
      const { f, event, choose } = fixture();
      event(code, {
        paid: [type, "physical", "physical"],
        paidForCard: ["physical", "physical"],
      });
      choose(code === "27033" ? "main" : f.s.villain.id);
      expect(f.s.prompt).toBeNull();
      expect(f.s.player.tough).toBe(false);
      expect(f.s.villain.stunned).toBe(false);
    },
  );
  it("Hero events respect their printed form and actual Guard/Patrol/Crisis preflight", () => {
    const { f, take, minion, side } = fixture();
    const attack = take("27034"),
      thwart = take("27033");
    f.s.resolving.push(attack, thwart);
    f.s.player.form = "alter";
    expect(milesPlayRestriction(f.s, attack, f.ports)).toMatch(/hero form/);
    expect(milesPlayRestriction(f.s, thwart, f.ports)).toMatch(/hero form/);
    f.s.player.form = "hero";
    minion("01101");
    expect(
      f.ports.enemyTargets(f.s, true).some((p) => p.id === f.s.villain.id),
    ).toBe(false);
    f.s.flags.patrol = true;
    side(crisisCode);
    expect(f.ports.schemeTargets(f.s, true).some((p) => p.id === "main")).toBe(
      false,
    );
    expect(milesEventAction(attack)).toBe("attack");
    expect(milesEventAction(thwart)).toBe("thwart");
  });
  it("Double Life changes form without consuming the normal flip and readies for allocated Physical", () => {
    const { f, event } = fixture();
    f.s.player.exhausted = true;
    f.s.player.flipped = true;
    event("27032", { paidForCard: ["physical"] });
    expect(f.s.player.form).toBe("alter");
    expect(f.s.player.flipped).toBe(true);
    expect(f.s.player.exhausted).toBe(false);
    expect(f.history).toContain("flip:hero:alter:false");
    expect(
      milesPlayRestriction(
        f.s,
        f.s.player.discard.find((p) => p.code === "27032")!,
        f.ports,
      ),
    ).toMatch(/max 1/);
  });
  it("Double Life does not ready from merely overpaid Physical, and resets its maximum next round", () => {
    const { f, event } = fixture();
    f.s.player.exhausted = true;
    event("27032", { paid: ["energy", "physical"], paidForCard: ["energy"] });
    expect(f.s.player.exhausted).toBe(true);
    f.s.round++;
    event("27032", { paidForCard: ["physical"] });
    expect(f.s.player.form).toBe("hero");
    expect(f.s.player.exhausted).toBe(false);
  });
  it("Double Life's independent Physical ready can still resolve under an absolute form lock", () => {
    const { f, take, event } = fixture();
    f.s.flags.formLocked = true;
    f.s.player.exhausted = true;
    const p = take("27032");
    f.s.player.hand.push(p);
    expect(milesPlayRestriction(f.s, p, f.ports)).toBeNull();
    event("27032", { paidForCard: ["physical"] });
    expect(f.s.player.form).toBe("hero");
    expect(f.s.player.exhausted).toBe(false);
    f.s.round++;
    expect(milesPlayRestriction(f.s, p, f.ports)).toMatch(/cannot change/);
  });
  it("locked Double Life requires actual allocated Physical before resource commitment", () => {
    const { f, take } = fixture();
    const p = take("27032");
    f.s.player.hand.push(p);
    f.s.flags.formLocked = true;
    f.s.player.exhausted = true;
    expect(
      milesPaymentAllowed(f.s, p, { paidForCard: ["physical"] }, f.ports),
    ).toBe(true);
    expect(
      milesPaymentAllowed(
        f.s,
        p,
        { paid: ["energy", "physical"], paidForCard: ["energy"] },
        f.ports,
      ),
    ).toBe(false);
    expect(milesPaymentAllowed(f.s, p, { paidForCard: [] }, f.ports)).toBe(
      false,
    );
  });
  it("zero-cost Double Life changes form but has no Physical ready benefit, and forbidden ready cannot qualify under a form lock", () => {
    const { f, event, take } = fixture();
    f.s.player.exhausted = true;
    event("27032", { paidForCard: [] });
    expect(f.s.player.form).toBe("alter");
    expect(f.s.player.exhausted).toBe(true);
    const p = take("27032");
    f.s.player.hand.push(p);
    f.s.flags.formLocked = true;
    f.s.flags.cannotReady = true;
    expect(
      milesPaymentAllowed(f.s, p, { paidForCard: ["physical"] }, f.ports),
    ).toBe(false);
  });
  it("Double Life's global maximum includes a different controller and its eliminated user's receipt", () => {
    const { f, take } = fixture(true);
    const p = take("27032");
    f.s.player.hand.push(p);
    milesCardPlayCommitted(f.s, p, "actual-play-1");
    f.s.players[0].eliminated = true;
    activateSeat(f.s, "p2");
    expect(milesPlayRestriction(f.s, p, f.ports)).toMatch(/max 1/);
    expect(() => milesCardPlayCommitted(f.s, p, "actual-play-2")).toThrow(
      /all players/,
    );
    f.s.round++;
    expect(milesPlayRestriction(f.s, p, f.ports)).toBeNull();
  });
  it("a canceled actual Double Life PLAY still consumes Max, while the same commit token is idempotent", () => {
    const { f, take } = fixture();
    const p = take("27032");
    f.s.player.hand.push(p);
    milesCardPlayCommitted(f.s, p, "actual-canceled-play");
    milesCardPlayCommitted(f.s, p, "actual-canceled-play");
    expect(f.s.player.form).toBe("hero");
    expect(milesPlayRestriction(f.s, p, f.ports)).toMatch(/max 1/);
  });
});

describe("Miles actual supports, Uses and alter-ego response", () => {
  it("Ganke exhausts before drawing and chooses a same-ID hand discard in Hero form after a save", () => {
    const { f, put, choose, run } = fixture();
    const p = put("27035"),
      top = f.s.player.deck[0];
    milesAbility(f.s, p.id, f.ports, "draw");
    run();
    expect(f.s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
    expect(f.s.player.hand.map((q) => q.id)).toContain(top.id);
    choose(top.id);
    expect(f.s.player.discard.map((q) => q.id)).toContain(top.id);
  });
  it("Ganke in AE draws without discarding and cannot be used again while exhausted or blank", () => {
    const { f, put, run } = fixture();
    f.s.player.form = "alter";
    const p = put("27035");
    milesAbility(f.s, p.id, f.ports);
    run();
    expect(f.s.player.hand).toHaveLength(1);
    expect(f.s.prompt).toBeNull();
    expect(milesAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    p.exhausted = false;
    f.s.flags[`blank:${p.id}`] = true;
    expect(milesAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
  });
  it("Jefferson cannot remove from a side scheme while the actual least scheme has zero threat", () => {
    const { f, put, side } = fixture();
    f.s.player.form = "alter";
    const p = put("27036");
    f.s.scheme.threat = 0;
    side("01107", 1);
    expect(milesAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    expect(p.exhausted).toBe(false);
  });
  it("Jefferson chooses a legal least-threat side, respects Crisis and ignores Patrol/Confuse", () => {
    const { f, put, side, run, choose } = fixture();
    f.s.player.form = "alter";
    f.s.player.confused = true;
    f.s.scheme.threat = 2;
    const p = put("27036"),
      a = side(crisisCode, 2),
      b = side("01107", 3);
    f.s.flags.patrol = true;
    milesAbility(f.s, p.id, f.ports);
    run();
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([a.id]);
    choose(a.id);
    expect(f.s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
    expect(f.s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(3);
    expect(f.s.player.confused).toBe(true);
    expect(f.packets[0]).toMatchObject({
      action: false,
      ignorePatrol: true,
    });
    expect(f.packets[0].ignoreCrisis).not.toBe(true);
  });
  it("Jefferson cannot pay exhaustion when Crisis blocks the unique least-threat main scheme", () => {
    const { f, put, side } = fixture();
    f.s.player.form = "alter";
    f.s.scheme.threat = 2;
    const p = put("27036");
    side(crisisCode, 4);
    expect(milesAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    expect(() => milesAbility(f.s, p.id, f.ports)).toThrow(/unavailable/);
    expect(p.exhausted).toBe(false);
  });
  it("Web-Shooter enters with3 Uses, generates one wild, and its final paid counter discards the actual card before later responses", () => {
    const { f, put } = fixture();
    const p = put("27039");
    expect(p.counters).toBe(3);
    expect(milesResourceSources(f.s, f.ports)[0]).toMatchObject({
      id: p.id,
      resources: ["wild"],
    });
    for (let n = 0; n < 3; n++) {
      p.exhausted = false;
      expect(milesResourceSpent(f.s, p.id, f.ports)).toBe(true);
    }
    expect(f.s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
    expect(f.s.player.discard.find((q) => q.id === p.id)?.counters).toBe(0);
    expect(milesResourceSources(f.s, f.ports)).toEqual([]);
  });
  it("Web-Shooter Hero Resource rejects AE, exhaustion, zero Uses and blank text without spending", () => {
    const { f, put } = fixture();
    const p = put("27039");
    for (const [key, value] of [
      ["form", "alter"],
      ["exhausted", true],
      ["counter", 0],
      ["blank", true],
    ] as const) {
      f.s.player.form = "hero";
      p.exhausted = false;
      p.counters = 3;
      delete f.s.flags[`blank:${p.id}`];
      if (key === "form") f.s.player.form = value as "alter";
      if (key === "exhausted") p.exhausted = true;
      if (key === "counter") p.counters = 0;
      if (key === "blank") f.s.flags[`blank:${p.id}`] = true;
      expect(milesResourceSources(f.s, f.ports)).toEqual([]);
      expect(() => milesResourceSpent(f.s, p.id, f.ports)).toThrow(
        /unavailable/,
      );
    }
  });
  it("AE response retrieves the same actual signature card, excludes pool/obligation cards and shuffles once", () => {
    const { f, discarded, form, run, choose, all } = fixture();
    f.s.player.form = "alter";
    const p = discarded("27034"),
      pool = discarded("27040"),
      obligation = discarded("27056"),
      receipt = form();
    run(
      ...milesFormResponseOptions(
        f.s,
        receipt,
        [{ type: "fixture:after" }],
        f.ports,
      )[0].effects,
    );
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([p.id]);
    choose(p.id);
    expect(f.s.player.deck.map((p) => p.id)).toContain(p.id);
    expect(f.s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([pool.id, obligation.id]),
    );
    expect(f.history).toEqual(["shuffle-player", "after"]);
    expect(all().filter((q) => q.id === p.id)).toHaveLength(1);
    expect(milesFormResponseOptions(f.s, receipt, [], f.ports)).toEqual([]);
  });
  it("AE response requires an actual owning Hero-to-AE change and unblank text, not setup or same form", () => {
    const { f, discarded, form } = fixture();
    f.s.player.form = "alter";
    discarded("27031");
    for (const r of [
      form({ from: "alter" }),
      form({ to: "hero" }),
      form({ playerId: "p2" }),
      form({ token: "" }),
    ])
      expect(milesFormResponseOptions(f.s, r, [], f.ports)).toEqual([]);
    f.s.flags.identityBlank = true;
    expect(milesFormChanged(f.s, form(), f.ports)).toEqual([]);
  });
  it("Double Life finishes AE shuffle choices before its Physical ready clause and never shuffles its resolving event", () => {
    const { f, discarded, event, choose } = fixture();
    const p = discarded("27031");
    f.s.player.exhausted = true;
    const played = event("27032", { paidForCard: ["physical"] });
    expect(f.s.player.exhausted).toBe(true);
    choose("yes");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([p.id]);
    choose(p.id);
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.discard.map((p) => p.id)).toContain(played.id);
  });
});

describe("Miles basic-power upgrade response receipts", () => {
  it("reusing the same physical upgrade during one trigger cannot repeat its response, while a new actual basic power can", () => {
    const { f, put, basic, run, choose } = fixture();
    const p = put("27037"),
      receipt = basic();
    run(...milesBasicPowerOptions(f.s, receipt, [], f.ports)[0].effects);
    choose(f.s.villain.id);
    put("27037");
    expect(milesBasicPowerOptions(f.s, receipt, [], f.ports)).toEqual([]);
    expect(
      milesBasicPowerOptions(f.s, basic({ token: "basic2" }), [], f.ports).map(
        (o) => o.id,
      ),
    ).toEqual([p.id]);
  });
  it.each(["attack", "thwart", "defense"] as const)(
    "Power Within responds to actual completed Hero%s and pays its same-ID discard before Special",
    (power) => {
      const { f, put, basic, run, choose } = fixture();
      const p = put("27037"),
        receipt = basic({ power });
      run(...milesAfterBasicPower(f.s, receipt, f.ports));
      choose(p.id);
      expect(f.s.player.discard.map((p) => p.id)).toContain(p.id);
      expect(f.s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
      choose(f.s.villain.id);
      expect(f.s.villain.hp).toBe(48);
      expect(f.s.villain.stunned).toBe(true);
      expect(f.s.flags[`milesBasic:${receipt.token}:${p.id}`]).toBe(true);
    },
  );
  it("both actual upgrades resolve in chosen order from one saved basic receipt", () => {
    const { f, put, basic, run, choose } = fixture();
    const attack = put("27037"),
      defense = put("27038");
    run(...milesAfterBasicPower(f.s, basic(), f.ports));
    choose(defense.id);
    choose(f.s.villain.id);
    choose(attack.id);
    choose(f.s.villain.id);
    expect(f.s.player.tough).toBe(true);
    expect(f.s.villain.confused).toBe(true);
    expect(f.s.villain.stunned).toBe(true);
    expect(f.s.prompt).toBeNull();
  });
  it("no response follows Stun/Confuse replacement, an ally power, AE recovery or another player's basic power", () => {
    const { f, put, basic } = fixture();
    put("27037");
    for (const r of [
      basic({ performed: false }),
      basic({ playerId: "p2" }),
      basic({ wasHero: false }),
      basic({ power: "recover" }),
      basic({ token: "" }),
    ])
      expect(milesBasicPowerOptions(f.s, r, [], f.ports)).toEqual([]);
  });
  it("a protected discard cost, blank upgrade or unavailable Special is never offered", () => {
    const { f, put, basic } = fixture();
    const p = put("27037");
    f.s.flags[`cannotDiscard:${p.id}`] = true;
    expect(milesBasicPowerOptions(f.s, basic(), [], f.ports)).toEqual([]);
    delete f.s.flags[`cannotDiscard:${p.id}`];
    f.s.flags[`blank:${p.id}`] = true;
    expect(milesBasicPowerOptions(f.s, basic(), [], f.ports)).toEqual([]);
    delete f.s.flags[`blank:${p.id}`];
    f.s.flags.identityBlank = true;
    expect(milesBasicPowerOptions(f.s, basic(), [], f.ports)).toEqual([]);
  });
});

describe("Miles obligation and original nemesis printed clauses", () => {
  it("Keeping Secrets revealed by another player goes to actual Miles, changes form, pays owning exhaust and removes same ID", () => {
    const { f, take, run, choose, all } = fixture(true, "p2");
    const p = take("27056");
    f.s.resolving.push(p);
    activateSeat(f.s, "p1");
    run(...milesEncounterReveal(f.s, p)!);
    choose("flip");
    choose("remove");
    expect(seatView(f.s, "p2").player.form).toBe("alter");
    expect(seatView(f.s, "p2").player.exhausted).toBe(true);
    expect(seatView(f.s, "p1").player.exhausted).toBe(false);
    expect(f.s.removed.find((q) => q.id === p.id)).toBeTruthy();
    expect(all().filter((q) => q.id === p.id)).toHaveLength(1);
  });
  it("Keeping Secrets discards both named supports from actual play including another controller, with no surge", () => {
    const { f, take, put, run, choose } = fixture(true);
    const a = put("27035"),
      b = put("27036");
    f.s.player.inPlay.splice(f.s.player.inPlay.indexOf(a), 1);
    seatView(f.s, "p2").player.inPlay.push(a);
    const p = take("27056");
    f.s.resolving.push(p);
    run(...milesEncounterReveal(f.s, p)!);
    choose("stay");
    choose("discard");
    expect(f.s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([a.id, b.id]),
    );
    expect(seatView(f.s, "p2").player.inPlay).toEqual([]);
    expect(f.history).not.toContain("surge:27056");
    expect(f.s.encounter.discard.find((q) => q.id === p.id)).toBeTruthy();
  });
  it("Keeping Secrets surges only when neither named support was actually discarded, including protected sources", () => {
    const { f, take, put, run, choose } = fixture();
    const a = put("27035");
    f.s.flags[`cannotDiscard:${a.id}`] = true;
    const p = take("27056");
    f.s.resolving.push(p);
    f.s.player.form = "alter";
    f.s.player.exhausted = true;
    run(...milesEncounterReveal(f.s, p)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
    choose("discard");
    expect(f.history).toContain("surge:27056");
    expect(f.s.player.inPlay.find((p) => p.id === a.id)).toBeTruthy();
  });
  it("Keeping Secrets under a form lock cannot offer an impossible flip", () => {
    const { f, take, run } = fixture();
    const p = take("27056");
    f.s.resolving.push(p);
    f.s.flags.formLocked = true;
    run(...milesEncounterReveal(f.s, p)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
  });
  it.each(["hero", "alter"] as const)(
    "Tracking Prey/Prowler check actual revealing player%s, not a different first player",
    (form) => {
      const { f, take, run } = fixture(true);
      f.s.player.form = form;
      seatView(f.s, "p2").player.form = form === "hero" ? "alter" : "hero";
      const tracking = take("27057"),
        prowler = take("27058");
      run(
        { type: "reveal", piece: tracking },
        { type: "reveal", piece: prowler },
      );
      expect(
        (f.s.sideSchemes[0] as Piece & { accelerationTokens?: number })
          .accelerationTokens || 0,
      ).toBe(form === "alter" ? 1 : 0);
      expect(f.s.minions[0].tough).toBe(form === "alter");
      expect(f.s.encounter.acceleration).toBe(0);
      expect(f.ports.canGiveStatus(f.s, prowler.id, "stunned")).toBe(false);
      expect(f.ports.canGiveStatus(f.s, prowler.id, "confused")).toBe(false);
    },
  );
  it("Razor Claws compares PRINTED hit points rather than remaining/modified HP and adds Piercing without duplicating printed2 ATK", () => {
    const { f, take, minion, run, choose } = fixture();
    const weak = minion("01103"),
      high = minion("27058", { damage: 4 }),
      p = take("27059");
    f.s.resolving.push(p);
    run(...milesEncounterReveal(f.s, p)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([high.id]);
    choose(high.id);
    expect(f.s.attachments.find((q) => q.id === p.id)?.attachedTo).toBe(
      high.id,
    );
    expect(milesEnemyAttackKeywords(f.s, high, f.ports)).toEqual({
      piercing: true,
    });
    expect(milesEnemyAttackKeywords(f.s, weak, f.ports)).toEqual({
      piercing: false,
    });
    f.s.flags[`blank:${p.id}`] = true;
    expect(milesEnemyAttackKeywords(f.s, high, f.ports)).toEqual({
      piercing: false,
    });
    expect(cards.get("27059")?.attack).toBe(2);
  });
  it("Razor Claws without a minion gains Surge; tied printed HP keeps distinct actual IDs", () => {
    const { f, take, minion, run, choose } = fixture();
    const p = take("27059");
    f.s.resolving.push(p);
    run(...milesEncounterReveal(f.s, p)!);
    expect(f.history).toContain("surge:27059");
    const a = minion("27058"),
      b = minion("27058");
    run(...milesEncounterReveal(f.s, p)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    choose(b.id);
    expect(f.s.attachments[0].attachedTo).toBe(b.id);
  });
  it("Razor and Slice accept an actual native Drone without inventing a catalog face", () => {
    const { f, minion, take, run, choose } = fixture();
    const drone = minion("drone"),
      claws = take("27059");
    f.s.resolving.push(claws);
    run(...milesEncounterReveal(f.s, claws)!);
    expect(f.s.prompt?.options).toMatchObject([
      { id: drone.id, label: "Ultron Drone", image: "drone" },
    ]);
    choose(drone.id);
    expect(f.s.attachments.find((p) => p.id === claws.id)?.attachedTo).toBe(
      drone.id,
    );
    const prowler = minion("27058");
    run(...milesEncounterReveal(f.s, take("27060"))!);
    expect(f.history).toContain(`enemy-attack:${prowler.id}:p1:true`);
    expect(f.history).not.toContain("surge:27060");
  });
  it("Slice and Dice attacks actual fewest-remaining-HP player even in AE", () => {
    const { f, minion, take, run } = fixture(true);
    const prowler = minion("27058");
    f.s.player.hp = 7;
    seatView(f.s, "p2").player.hp = 3;
    seatView(f.s, "p2").player.form = "alter";
    run(...milesEncounterReveal(f.s, take("27060"))!);
    expect(f.history).toContain(`enemy-attack:${prowler.id}:p2:true`);
    expect(f.history).not.toContain("surge:27060");
  });
  it("Slice and Dice preserves saved tied player choices rather than arbitrarily selecting the revealer", () => {
    const { f, minion, take, run, choose } = fixture(true);
    const p = minion("27058");
    f.s.player.hp = seatView(f.s, "p2").player.hp = 4;
    run(...milesEncounterReveal(f.s, take("27060"))!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    choose("p2");
    expect(f.history).toContain(`enemy-attack:${p.id}:p2:true`);
  });
  it.each([
    [false, false],
    [true, true],
  ] as const)(
    "Slice aftermath surges for no attack%s or actual character defeat%s",
    (performed, defeatedCharacter) => {
      const { f, minion, take, run } = fixture();
      minion("27058");
      f.attackResult = { performed, defeatedCharacter };
      run(...milesEncounterReveal(f.s, take("27060"))!);
      expect(f.history).toContain("surge:27060");
    },
  );
  it("missing Prowler, blocked startup, and a Stun-replaced attack each gain Surge", () => {
    const { f, minion, take, run } = fixture();
    run(...milesEncounterReveal(f.s, take("27060"))!);
    expect(f.history).toContain("surge:27060");
    const p = minion("27058");
    f.history.length = 0;
    f.s.flags.noAttack = true;
    run(...milesEncounterReveal(f.s, take("27060"))!);
    expect(f.history).toContain("surge:27060");
    delete f.s.flags.noAttack;
    f.history.length = 0;
    f.s.flags[`blank:${p.id}`] = true;
    p.stunCards = 1;
    p.stunned = true;
    run(...milesEncounterReveal(f.s, take("27060"))!);
    expect(f.history).toContain("surge:27060");
    expect(p.stunned).toBe(false);
  });
  it("an unrelated effect is not swallowed and unknown owned namespace effects fail explicitly", () => {
    const { f } = fixture();
    expect(
      resolveMilesMoralesEffect(f.s, { type: "other:effect" }, f.ports),
    ).toBe(false);
    expect(() => resolveMilesMoralesEffect(f.s, M("invalid"), f.ports)).toThrow(
      /Unknown Miles/,
    );
  });
});
