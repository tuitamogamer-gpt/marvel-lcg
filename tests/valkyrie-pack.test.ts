import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { consumeTough, statusCards } from "../src/game/keywords.js";
import { paymentStatus } from "../src/game/payment.js";
import {
  activateSeat,
  allInPlay,
  seatView,
  syncSeat,
} from "../src/game/team.js";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";
import {
  VALKYRIE_PACK_CORE_ALIASES,
  VALKYRIE_PACK_SCRIPT_CODES,
  resolveValkyriePackEffect,
  valkyriePackAbility,
  valkyriePackAbilityOptions,
  valkyriePackAllyAttackOptions,
  valkyriePackAllyEnter,
  valkyriePackBeforeEvent,
  valkyriePackCardEntered,
  valkyriePackDefenseOptions,
  valkyriePackEngagementOptions,
  valkyriePackEvent,
  valkyriePackMinionDefeated,
  valkyriePackPlayRestriction,
  valkyriePackResourcesSpent,
  type ValkyriePackCharacter,
  type ValkyriePackPorts,
} from "../src/game/valkyrie-pack.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `valkyrie-pack:${type}`,
  ...args,
});
let serial = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `vp${++serial}`,
  code,
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ...patch,
});
const player = (): GameState["player"] => ({
  form: "hero",
  hp: 12,
  exhausted: false,
  flipped: false,
  tough: false,
  stunned: false,
  confused: false,
  hand: [],
  deck: [],
  discard: [],
  inPlay: [],
  setAside: [],
});
function take(zones: Piece[][], id: string) {
  const zone = zones.find((z) => z.some((p) => p.id === id));
  return zone?.splice(
    zone.findIndex((p) => p.id === id),
    1,
  )[0];
}
function fixture(team = false) {
  let s: GameState = {
    version: 1,
    seed: 25,
    nextId: 1,
    heroId: "valk",
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
    playerCount: team ? 2 : 1,
    guided: false,
    review: null,
    reviewCount: 0,
    player: player(),
    villain: { ...piece("01094"), hp: 40, maxHp: 40, stage: 1 },
    scheme: { code: "01097", threat: 10, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    removed: [],
    resolving: [],
    queue: [],
    prompt: null,
    flags: { heroTraits: "Asgard,Avenger", heroThwart: 1 },
    log: [],
    attack: null,
  };
  s.players = [
    {
      id: "p1",
      heroId: "valk",
      aspect: "aggression",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  if (team)
    s.players.push({
      id: "p2",
      heroId: "gamora",
      aspect: "justice",
      player: player(),
      flags: { heroTraits: "Guardian", heroThwart: 2 },
      ended: false,
      eliminated: false,
      mulliganDone: true,
    });
  const native: Effect[] = [],
    history: string[] = [],
    registered: Piece[] = [];
  const local = (state: GameState, id: string) =>
    id.startsWith("hero:")
      ? seatView(state, id.slice(5)).player
      : allInPlay(state).find((p) => p.id === id);
  const generated = (p: Piece, targetCode?: string): Resource[] => {
    const c = cards.get(p.code)!,
      target = targetCode && cards.get(targetCode);
    const factor =
      p.code === "25022" && target && target.faction_code === "aggression"
        ? 2
        : 1;
    return (["energy", "mental", "physical", "wild"] as const).flatMap((type) =>
      Array(Number(c[`resource_${type}`] || 0) * factor).fill(type),
    );
  };
  const ports: ValkyriePackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    hasTrait: (state, id, trait) =>
      id.startsWith("hero:")
        ? String(seatView(state, id.slice(5)).flags.heroTraits)
            .split(",")
            .includes(trait)
        : (
            cards.get(allInPlay(state).find((p) => p.id === id)?.code || "")
              ?.traits || ""
          )
            .split(/\.\s*/)
            .includes(trait),
    characters: (state) =>
      state.players
        .filter((seat) => !seat.eliminated)
        .flatMap((seat) => {
          const view = seatView(state, seat);
          return [
            {
              id: `hero:${seat.id}`,
              label: seat.id,
              playerId: seat.id,
              type: view.player.form === "hero" ? "hero" : "alter_ego",
              exhausted: view.player.exhausted,
            },
            ...view.player.inPlay
              .filter((p) => cards.get(p.code)?.type_code === "ally")
              .map((p) => ({
                id: p.id,
                code: p.code,
                label: cards.get(p.code)!.name,
                playerId: seat.id,
                type: "ally",
                exhausted: p.exhausted,
              })),
          ] as ValkyriePackCharacter[];
        }),
    characterThwart: (state, id) =>
      id.startsWith("hero:")
        ? seatView(state, id.slice(5)).player.form === "hero"
          ? Number(seatView(state, id.slice(5)).flags.heroThwart)
          : 0
        : Number(cards.get((local(state, id) as Piece).code)?.thwart || 0) +
          Number((local(state, id) as Piece).bonusThw || 0),
    exhaustCharacter: vi.fn((state, id) => {
      const p = local(state, id);
      if (!p || p.exhausted) return false;
      p.exhausted = true;
      history.push(`exhaust:${id}`);
      return true;
    }),
    canReady: (state, id) =>
      !!local(state, id) && !state.flags[`readyLocked:${id}`],
    canDiscardPiece: (state, p) => !state.flags[`discardBlocked:${p.id}`],
    discardPiece: vi.fn((state, id) => {
      for (const seat of state.players) {
        const view = seatView(state, seat),
          p = take([view.player.inPlay], id);
        if (p) {
          seatView(state, p.ownerId || seat.id).player.discard.push(p);
          history.push(`discard:${id}`);
          return;
        }
      }
    }),
    enemyTargets: (state, attack) => [
      ...(!attack || !state.flags.guard
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(state.scheme.threat > 0 && (!thwart || !state.flags.crisis)
        ? [{ id: "main", label: "Main scheme", code: state.scheme.code }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    heroAttack: (state, target, attacking = false) =>
      Number(state.flags.heroAttack ?? 2) +
      state.player.inPlay.filter(
        (p) => p.code === "25006" && !ports.isTextBlank(state, p),
      ).length +
      (attacking &&
      state.player.inPlay.some(
        (p) => p.code === "25002" && p.attachedTo === target,
      )
        ? state.player.inPlay.filter(
            (p) => p.code === "25006" && !ports.isTextBlank(state, p),
          ).length
        : 0),
    maxHeroHP: () => 12,
    cardCost: (state, p) =>
      Math.max(
        0,
        Number(cards.get(p.code)?.cost || 0) -
          Number(state.flags.discount || 0),
      ),
    canPay: (
      state,
      cost,
      requirements = [],
      excludeId,
      targetCode,
      alliance = false,
    ) => {
      if (state.flags.payBlocked) return false;
      const views = alliance
        ? state.players
            .filter((p) => !p.eliminated)
            .map((p) => seatView(state, p))
        : [state];
      const sources = views.flatMap((view) =>
        view.player.hand
          .filter((p) => p.id !== excludeId)
          .map((p) => ({
            id: p.id,
            code: p.code,
            name: cards.get(p.code)!.name,
            resources: generated(p, targetCode),
            description: "actual hand card",
            kind: "card" as const,
          })),
      );
      return paymentStatus(
        sources,
        sources.map((p) => p.id),
        cost,
        requirements,
      ).ready;
    },
    revealHidden: vi.fn(() => history.push("hidden")),
    shuffleEncounter: vi.fn((state) => {
      state.encounter.deck.reverse();
      history.push("shuffle-encounter");
    }),
    shufflePlayerDeck: vi.fn((state, after) => {
      state.player.deck.reverse();
      history.push("shuffle-player");
      ports.queue(state, ...after);
    }),
    canPutMinion: (state, p) => !state.flags[`entryBlocked:${p.id}`],
    putMinion: vi.fn((state, id, playerId, after) => {
      if (state.flags.putFailed) return false;
      const p = take([state.encounter.deck, state.encounter.discard], id);
      if (!p) return false;
      p.engagedWith = playerId;
      state.minions.push(p);
      history.push(`put:${id}`);
      ports.queue(state, { type: "fixture:entry", id }, ...after);
      return true;
    }),
    canPlayDeckAlly: (state, p) =>
      !state.flags[`playBlocked:${p.id}`] &&
      ports.canPay(state, ports.cardCost(state, p), [], p.id, p.code),
    playDeckAlly: vi.fn((state: GameState, id: string, after: Effect[]) => {
      const p = state.player.deck.find((p) => p.id === id)!;
      ports.queue(state, {
        type: "payRequest",
        title: "The Bifrost",
        cost: ports.cardCost(state, p),
        piece: p,
        cancelable: true,
        after: [{ type: "fixture:play-deck", id, after }],
        cancellationQueue: after,
      });
    }),
    attackProgram: vi.fn((state, effects, after) => {
      history.push("attack-program");
      ports.queue(state, ...effects, ...after);
    }),
    thwartBatch: vi.fn(
      (state: GameState, ids: string[], amount: number, after: Effect[]) => {
        history.push(`thwart-batch:${ids.join(",")}`);
        for (const id of ids) {
          if (id === "main")
            state.scheme.threat = Math.max(0, state.scheme.threat - amount);
          else {
            const p = state.sideSchemes.find((p) => p.id === id)!;
            p.counters = Math.max(0, p.counters - amount);
          }
        }
        history.push("all-threat-committed");
        ports.queue(state, ...after);
      },
    ),
    allyAttackBatch: vi.fn(
      (state: GameState, allyId: string, ids: string[], after: Effect[]) => {
        history.push(`ally-batch:${ids.join(",")}`);
        const p = state.player.inPlay.find((p) => p.id === allyId)!;
        const amount =
          Number(cards.get(p.code)?.attack || 0) + Number(p.bonusAtk || 0);
        for (const id of ids) {
          const target = state.minions.find((p) => p.id === id);
          if (target && !consumeTough(target)) target.damage += amount;
        }
        p.damage += Number(cards.get(p.code)?.attack_cost || 0);
        ports.queue(state, ...after);
      },
    ),
    useAttackForDefense: vi.fn((state) => {
      state.attack!.defense = ports.heroAttack(state, undefined, false);
      state.flags.attackDefense = true;
    }),
    usesAttackForDefense: (state) => !!state.flags.attackDefense,
    discardIdentityStatus: vi.fn((state, status) => {
      const key =
        status === "tough"
          ? "toughCards"
          : status === "stunned"
            ? "stunCards"
            : "confuseCards";
      state.player[key] = Math.max(0, statusCards(state.player, status) - 1);
      state.player[status] =
        state.player[key] >= Number(state.flags.steady ? 2 : 1);
    }),
  };
  function run(state = s) {
    state = JSON.parse(JSON.stringify(state));
    const seat = state.players.find((p) => p.id === state.activePlayerId)!;
    seat.player = state.player;
    seat.flags = state.flags;
    for (let n = 0; state.queue.length && !state.prompt && n < 100; n++) {
      const e = state.queue.shift()!;
      if (e.actorId && e.actorId !== state.activePlayerId)
        activateSeat(state, e.actorId);
      if (resolveValkyriePackEffect(state, e, ports)) continue;
      native.push(e);
      if (e.type === "optional")
        ports.choose(state, e.title, e.text, [
          { id: "yes", label: "Use response", effects: e.effects },
          { id: "no", label: "Pass", effects: [] },
        ]);
      else if (e.type === "payRequest")
        state.prompt = {
          kind: "payment",
          title: e.title,
          text: "",
          options: [],
          cost: e.cost,
          card: e.piece,
          requirements: e.requirements,
          after: e.after,
          cancelable: e.cancelable,
          abilityCost: e.abilityCost,
          cancellationQueue: e.cancellationQueue,
        };
      else if (e.type === "fixture:play-deck") {
        const p = take([state.player.deck], e.id)!;
        state.player.inPlay.push(p);
        history.push(`play-deck:${p.id}`);
        ports.queue(
          state,
          ...valkyriePackCardEntered(state, p),
          ...(valkyriePackAllyEnter(state, p, ports) || []),
          ...e.after,
        );
      } else if (e.type === "resolveHandEvent") {
        const p = take([state.player.hand], e.id)!;
        state.resolving.push(p);
        ports.queue(
          state,
          ...e.after,
          { type: "fixture:finish-event", id: p.id },
          ...(e.continuation || []),
        );
      } else if (e.type === "fixture:finish-event") {
        const p = take([state.resolving], e.id)!;
        state.player.discard.push(p);
      } else if (e.type === "draw") {
        for (let i = 0; i < e.amount; i++) {
          const p = state.player.deck.shift();
          if (p) state.player.hand.push(p);
        }
        history.push(`draw:${e.amount}`);
      } else if (e.type === "heal") {
        const p = e.target === "hero" ? state.player : local(state, e.target);
        if (p && "hp" in p) p.hp = Math.min(12, p.hp + e.amount);
        else if (p) p.damage = Math.max(0, p.damage - e.amount);
      } else if (e.type === "ready") {
        const p = local(state, e.target);
        if (p && ports.canReady(state, e.target)) p.exhausted = false;
      } else if (e.type === "status") {
        const p = local(state, e.target);
        if (p) {
          p[e.status as "tough"] = true;
          if (e.status === "tough") p.toughCards = 1;
        }
      } else if (e.type === "damage") {
        if (e.target === state.villain.id)
          state.villain.hp = Math.max(0, state.villain.hp - e.amount);
        else {
          const p = state.minions.find((p) => p.id === e.target);
          if (p && !consumeTough(p)) p.damage += e.amount;
        }
      } else if (e.type === "thwart") {
        if (e.target === "main")
          state.scheme.threat = Math.max(0, state.scheme.threat - e.amount);
        else {
          const p = state.sideSchemes.find((p) => p.id === e.target);
          if (p) p.counters = Math.max(0, p.counters - e.amount);
        }
      } else if (e.type === "fixture:entry") history.push(`entry:${e.id}`);
      else if (e.type === "fixture:resume") history.push("resume");
      else if (e.type === "fixture:receipt") native.push(e);
    }
    s = state;
    syncSeat(s);
    return s;
  }
  const f = {
    get s() {
      return s;
    },
    ports,
    native,
    history,
    add(
      code: string,
      zone: "inPlay" | "hand" | "deck" | "discard" = "inPlay",
      playerId = "p1",
      patch: Partial<Piece> = {},
    ) {
      const p = piece(code, { ownerId: playerId, ...patch });
      seatView(s, playerId).player[zone].push(p);
      registered.push(p);
      return p;
    },
    minion(code = "01102", playerId = "p1", patch: Partial<Piece> = {}) {
      const p = piece(code, { engagedWith: playerId, ...patch });
      s.minions.push(p);
      return p;
    },
    encounter(code: string, patch: Partial<Piece> = {}) {
      const p = piece(code, patch);
      s.encounter.deck.push(p);
      return p;
    },
    side(threat: number, code = "01108") {
      const p = piece(code, { counters: threat });
      s.sideSchemes.push(p);
      return p;
    },
    step(effects: Effect | Effect[]) {
      s.queue.unshift(...(Array.isArray(effects) ? effects : [effects]));
      return run();
    },
    choose(id: string) {
      const choice = s.prompt!.options.find((o) => o.id === id);
      expect(choice, JSON.stringify(s.prompt)).toBeTruthy();
      s.prompt = null;
      s.queue.unshift(...choice!.effects);
      return run();
    },
    pay(ids: string[]) {
      const prompt = s.prompt!;
      expect(prompt.kind).toBe("payment");
      const selected = ids.map((id) => s.player.hand.find((p) => p.id === id)!);
      expect(selected.every(Boolean)).toBe(true);
      const sources = selected.map((p) => ({
        id: p.id,
        code: p.code,
        name: cards.get(p.code)!.name,
        resources: generated(
          p,
          prompt.abilityCost ? undefined : prompt.card?.code,
        ),
        description: "actual",
        kind: "card" as const,
      }));
      expect(
        paymentStatus(sources, ids, prompt.cost!, prompt.requirements || [])
          .ready,
      ).toBe(true);
      for (const p of selected)
        s.player.discard.push(take([s.player.hand], p.id)!);
      s.prompt = null;
      s.queue.unshift(...prompt.after!);
      return run();
    },
    cancel() {
      const prompt = s.prompt!;
      expect(prompt.cancelable).toBe(true);
      s.prompt = null;
      s.queue.unshift(...(prompt.cancellationQueue || []));
      return run();
    },
    conserve() {
      const zones = [
        ...s.players.flatMap((seat) => {
          const p = seatView(s, seat).player;
          return [
            ...p.deck,
            ...p.hand,
            ...p.discard,
            ...p.inPlay,
            ...(p.setAside || []),
          ];
        }),
        ...s.resolving,
        ...s.removed,
        ...s.minions,
      ];
      for (const p of registered)
        expect(
          zones.filter((a) => a.id === p.id),
          p.id,
        ).toHaveLength(1);
    },
  };
  return f;
}

describe("Valkyrie original supplementary faces", () => {
  it("partitions exactly19 printed faces into14 adapters and five exact Core aliases", () => {
    const faces = (catalog as unknown as Card[])
      .filter(
        (c) =>
          c.pack_code === "valk" &&
          [
            "aggression",
            "justice",
            "leadership",
            "protection",
            "basic",
          ].includes(c.faction_code),
      )
      .map((c) => c.code)
      .sort();
    expect(
      [...VALKYRIE_PACK_SCRIPT_CODES, ...VALKYRIE_PACK_CORE_ALIASES].sort(),
    ).toEqual(faces);
    expect(VALKYRIE_PACK_SCRIPT_CODES).toHaveLength(14);
    expect(VALKYRIE_PACK_CORE_ALIASES).toHaveLength(5);
  });
  it("keeps Angela, Hall of Heroes and Audacity as actual-code reprint adapters", () => {
    for (const code of ["25015", "25016", "25021"])
      expect(VALKYRIE_PACK_SCRIPT_CODES).toContain(code);
    expect(cards.get("25021")!.resource_wild).toBe(1);
    expect(cards.get("25013")!.attack_cost).toBe(2);
  });
});

describe("actual ally entry and spent resource responses", () => {
  it("Throg responds to either PLAY or PUT while a minion is engaged with his controller", () => {
    const f = fixture(),
      throg = f.add("25014");
    f.minion();
    f.step(valkyriePackAllyEnter(f.s, throg, f.ports)!);
    expect(f.s.prompt!.title).toBe("Throg");
    f.choose("yes");
    expect(f.s.player.inPlay[0].tough).toBe(true);
    f.conserve();
  });
  it("Throg does not use another player's minion or a blank printed ability", () => {
    const f = fixture(true),
      throg = f.add("25014");
    f.minion("01102", "p2");
    expect(valkyriePackAllyEnter(f.s, throg, f.ports)).toEqual([]);
    f.minion();
    f.s.flags[`blank:${throg.id}`] = true;
    expect(valkyriePackAllyEnter(f.s, throg, f.ports)).toEqual([]);
  });
  it("Throg's optional response may be declined without altering a physical card", () => {
    const f = fixture(),
      throg = f.add("25014");
    f.minion();
    f.step(valkyriePackAllyEnter(f.s, throg, f.ports)!);
    f.choose("no");
    expect(f.s.player.inPlay[0].tough).toBe(false);
    f.conserve();
  });
  it("Angela searches only the actual top10, performs forced PUT and never reveals the minion", () => {
    const f = fixture(),
      angela = f.add("25015");
    for (let n = 0; n < 9; n++) f.encounter("01190");
    const minion = f.encounter("01102"),
      outside = f.encounter("01102");
    f.step(valkyriePackAllyEnter(f.s, angela, f.ports)!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([minion.id, "none"]);
    f.choose(minion.id);
    expect(f.s.minions[0]).toMatchObject({ id: minion.id, engagedWith: "p1" });
    expect(f.s.encounter.deck.some((p) => p.id === outside.id)).toBe(true);
    expect(f.native.some((e) => e.type === "reveal")).toBe(false);
    expect(f.history.indexOf(`put:${minion.id}`)).toBeLessThan(
      f.history.indexOf(`entry:${minion.id}`),
    );
    f.conserve();
  });
  it("Angela with no legal top10 minion shuffles then discards the same ally", () => {
    const f = fixture(),
      angela = f.add("25015");
    for (let n = 0; n < 10; n++) f.encounter("01190");
    f.encounter("01102");
    f.step(valkyriePackAllyEnter(f.s, angela, f.ports)!);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([angela.id]);
    expect(f.history.indexOf("shuffle-encounter")).toBeLessThan(
      f.history.indexOf(`discard:${angela.id}`),
    );
    f.conserve();
  });
  it("Angela's hidden search may fail, and failed native entry never retains the ally", () => {
    const f = fixture(),
      angela = f.add("25015"),
      minion = f.encounter("01102");
    f.step(valkyriePackAllyEnter(f.s, angela, f.ports)!);
    f.s.flags.putFailed = true;
    f.choose(minion.id);
    expect(f.s.minions).toHaveLength(0);
    expect(f.s.player.discard[0].id).toBe(angela.id);
    f.conserve();
  });
  it("Angela cannot select an illegal unique minion even though it appears in the top10", () => {
    const f = fixture(),
      angela = f.add("25015"),
      minion = f.encounter("01102");
    f.s.flags[`entryBlocked:${minion.id}`] = true;
    f.step(valkyriePackAllyEnter(f.s, angela, f.ports)!);
    expect(f.s.player.discard[0].id).toBe(angela.id);
    expect(f.ports.putMinion).not.toHaveBeenCalled();
  });
  it("blank Angela has no forced entry search and unknown ally faces defer to other adapters", () => {
    const f = fixture(),
      angela = f.add("25015");
    f.s.flags[`blank:${angela.id}`] = true;
    expect(valkyriePackAllyEnter(f.s, angela, f.ports)).toEqual([]);
    expect(valkyriePackAllyEnter(f.s, piece("01084"), f.ports)).toBeNull();
  });
  it("the printed Audacity reprint generates one wild and responds only after actual Hero SPEND", () => {
    const f = fixture(),
      resource = f.add("25021", "discard");
    f.s.player.stunned = f.s.player.confused = true;
    f.step(valkyriePackResourcesSpent(f.s, [resource]));
    f.choose("yes");
    expect(f.s.villain.hp).toBe(39);
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.player.confused).toBe(true);
    expect(f.native.find((e) => e.type === "damage")).toMatchObject({
      attack: false,
      amount: 1,
      source: "hero",
      abilitySource: resource.id,
      sourceCode: resource.code,
    });
    f.conserve();
  });
  it("Audacity in alter-ego or an unrelated printed resource grants no response", () => {
    const f = fixture();
    f.s.player.form = "alter";
    expect(valkyriePackResourcesSpent(f.s, [piece("25021")])).toEqual([]);
    f.s.player.form = "hero";
    expect(valkyriePackResourcesSpent(f.s, [piece("25025")])).toEqual([]);
  });
});

describe("physical Hall of Heroes and Leadership Training", () => {
  it("Hall glory belongs to the actual identity killer, never an ally or support", () => {
    const f = fixture(true),
      hall = f.add("25016", "inPlay", "p2");
    valkyriePackCardEntered(f.s, hall);
    expect(valkyriePackMinionDefeated(f.s, false, "p2")).toEqual([]);
    const effects = valkyriePackMinionDefeated(f.s, true, "p2");
    expect(effects[0].actorId).toBe("p2");
    f.step(effects);
    f.choose("yes");
    expect(seatView(f.s, "p2").player.inPlay[0].counters).toBe(1);
    f.conserve();
  });
  it("Hall's optional glory may be passed, and its exact three-counter AE cost precedes draw3", () => {
    const f = fixture(),
      hall = f.add("25016", "inPlay", "p1", { counters: 4 });
    f.step(valkyriePackMinionDefeated(f.s, true));
    f.choose("no");
    expect(f.s.player.inPlay[0].counters).toBe(4);
    f.s.player.form = "alter";
    for (let i = 0; i < 3; i++) f.add("25024", "deck");
    expect(valkyriePackAbility(f.s, hall.id, f.ports)).toBe(true);
    f.step([]);
    expect(f.s.player.inPlay[0]).toMatchObject({
      counters: 1,
      exhausted: true,
    });
    expect(f.s.player.hand).toHaveLength(3);
    f.conserve();
  });
  it("Hall rejects insufficient glory, hero form, exhausted state and blanking", () => {
    const f = fixture(),
      hall = f.add("25016", "inPlay", "p1", { counters: 3 });
    expect(valkyriePackAbilityOptions(f.s, hall.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    hall.counters = 2;
    expect(valkyriePackAbilityOptions(f.s, hall.id, f.ports)).toEqual([]);
    hall.counters = 3;
    hall.exhausted = true;
    expect(valkyriePackAbilityOptions(f.s, hall.id, f.ports)).toEqual([]);
    hall.exhausted = false;
    f.s.flags[`blank:${hall.id}`] = true;
    expect(valkyriePackAbilityOptions(f.s, hall.id, f.ports)).toEqual([]);
  });
  it("Leadership Training starts with2 actual counters and shuffles the selected discarded blue event", () => {
    const f = fixture(),
      training = f.add("25034"),
      event = f.add("23017", "discard"),
      wrong = f.add("25018", "discard");
    valkyriePackCardEntered(f.s, training);
    f.s.player.form = "alter";
    valkyriePackAbility(f.s, training.id, f.ports);
    f.step([]);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([event.id]);
    f.choose(event.id);
    expect(f.s.player.inPlay[0]).toMatchObject({
      counters: 1,
      exhausted: true,
    });
    expect(f.s.player.deck[0].id).toBe(event.id);
    expect(f.s.player.discard[0].id).toBe(wrong.id);
    expect(f.ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    f.conserve();
  });
  it("Leadership Training's final use discards its actual Uses source and does not reshuffle that support", () => {
    const f = fixture(),
      training = f.add("25034", "inPlay", "p1", { counters: 1 }),
      event = f.add("23017", "discard");
    f.s.player.form = "alter";
    valkyriePackAbility(f.s, training.id, f.ports);
    f.step([]);
    f.choose(event.id);
    expect(f.s.player.inPlay).toHaveLength(0);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([training.id]);
    expect(f.s.player.deck.map((p) => p.id)).toEqual([event.id]);
    f.conserve();
  });
  it("Leadership Training requires an actual Leadership event and alter-ego form", () => {
    const f = fixture(),
      training = f.add("25034", "inPlay", "p1", { counters: 2 });
    f.add("25018", "discard");
    f.s.player.form = "alter";
    expect(valkyriePackAbilityOptions(f.s, training.id, f.ports)).toEqual([]);
    f.add("23017", "discard");
    f.s.player.form = "hero";
    expect(valkyriePackAbilityOptions(f.s, training.id, f.ports)).toEqual([]);
  });
});

describe("The Bifrost's paid actual deck PLAY", () => {
  it("Bifrost's play restriction checks the identity's Asgard trait in either form", () => {
    const f = fixture(),
      bifrost = f.add("25023", "hand");
    for (const form of ["hero", "alter"] as const) {
      f.s.player.form = form;
      expect(valkyriePackPlayRestriction(f.s, bifrost, f.ports)).toBeNull();
    }
    f.s.flags.heroTraits = "Avenger";
    expect(valkyriePackPlayRestriction(f.s, bifrost, f.ports)).toContain(
      "Asgard",
    );
  });
  it("Bifrost exhausts before search, plays the same ally from deck paying its real cost, then shuffles", () => {
    const f = fixture(),
      bifrost = f.add("25023"),
      thor = f.add("25013", "deck"),
      energy = f.add("25025", "hand"),
      physical = f.add("25024", "hand");
    valkyriePackAbility(f.s, bifrost.id, f.ports);
    f.step([]);
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
    f.choose(thor.id);
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      cost: 3,
      card: { id: thor.id },
    });
    expect(f.s.player.deck.some((p) => p.id === thor.id)).toBe(true);
    f.pay([energy.id, physical.id]);
    expect(f.s.player.inPlay.find((p) => p.id === thor.id)).toBeTruthy();
    expect(f.history.indexOf(`play-deck:${thor.id}`)).toBeLessThan(
      f.history.indexOf("shuffle-player"),
    );
    f.conserve();
  });
  it("canceling Bifrost payment retains the actual deck ally, still shuffles and does not refund exhaustion", () => {
    const f = fixture(),
      bifrost = f.add("25023"),
      throg = f.add("25014", "deck");
    f.add("25025", "hand");
    valkyriePackAbility(f.s, bifrost.id, f.ports);
    f.step([]);
    f.choose(throg.id);
    f.cancel();
    expect(f.s.player.deck.map((p) => p.id)).toEqual([throg.id]);
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
    expect(f.ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    f.conserve();
  });
  it("Bifrost never treats deck PLAY as PLAY from hand or allows a non-Asgard ally", () => {
    const f = fixture(),
      bifrost = f.add("25023"),
      angela = f.add("25015", "deck"),
      nick = f.add("01084", "deck");
    valkyriePackAbility(f.s, bifrost.id, f.ports);
    f.step([]);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([angela.id, "none"]);
    f.choose("none");
    expect(f.s.player.deck.some((p) => p.id === nick.id)).toBe(true);
    expect(f.ports.playDeckAlly).not.toHaveBeenCalled();
    f.conserve();
  });
  it("Bifrost rejects unaffordable or native illegal unique allies before exhaustion", () => {
    const f = fixture(),
      bifrost = f.add("25023"),
      thor = f.add("25013", "deck");
    expect(valkyriePackAbilityOptions(f.s, bifrost.id, f.ports)).toEqual([]);
    f.add("25025", "hand");
    f.add("25024", "hand");
    f.s.flags[`playBlocked:${thor.id}`] = true;
    expect(valkyriePackAbilityOptions(f.s, bifrost.id, f.ports)).toEqual([]);
    expect(bifrost.exhausted).toBe(false);
  });
});

describe("actual ATK event values and printed additional costs", () => {
  it("Quick Strike uses Dragonfang's target-specific current ATK but neither exhausts nor pays basic attack costs", () => {
    const f = fixture(),
      event = f.add("25018", "hand");
    f.add("25006");
    f.add("25002", "inPlay", "p1", { attachedTo: f.s.villain.id });
    const other = f.minion();
    f.step(valkyriePackEvent(f.s, event)!);
    f.choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(36);
    expect(f.s.player.exhausted).toBe(false);
    expect(f.native.find((e) => e.type === "damage")).toMatchObject({
      amount: 4,
      attack: true,
      attackInitiated: true,
      abilitySource: event.id,
    });
    expect(other.damage).toBe(0);
  });
  it("Quick Strike against an unmarked minion gets only Dragonfang's unconditional+1", () => {
    const f = fixture(),
      event = f.add("25018", "hand");
    f.add("25006");
    f.add("25002", "inPlay", "p1", { attachedTo: f.s.villain.id });
    const minion = f.minion();
    f.step(valkyriePackEvent(f.s, event)!);
    f.choose(minion.id);
    expect(f.s.minions[0].damage).toBe(3);
  });
  it("Stun replaces Quick Strike once before targeting, and Guard still limits un-replaced attacks", () => {
    const f = fixture(),
      event = f.add("25018", "hand");
    f.s.player.stunned = true;
    f.s.flags.guard = true;
    f.step(valkyriePackEvent(f.s, event)!);
    expect(f.s.player.stunned).toBe(false);
    expect(f.s.prompt).toBeNull();
    expect(f.s.villain.hp).toBe(40);
    expect(f.ports.attackProgram).not.toHaveBeenCalled();
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain(
      "target",
    );
  });
  it("Smash pays actual hero exhaustion before Confuse replaces the thwart", () => {
    const f = fixture(),
      event = f.add("25019", "hand");
    f.s.player.confused = true;
    f.step(valkyriePackBeforeEvent(f.s, event, [{ type: "fixture:receipt" }])!);
    expect(f.s.player.exhausted).toBe(true);
    const receipt = f.native.find(
      (e) => e.type === "fixture:receipt",
    )!.valkyriePackReceipt;
    f.step(valkyriePackEvent(f.s, event, receipt)!);
    expect(f.s.player.confused).toBe(false);
    expect(f.s.scheme.threat).toBe(10);
    expect(f.s.player.exhausted).toBe(true);
  });
  it("Smash's ATK value does not gain Dragonfang's conditional attacking bonus", () => {
    const f = fixture(),
      event = f.add("25019", "hand");
    f.add("25006");
    f.add("25002", "inPlay", "p1", { attachedTo: f.s.villain.id });
    f.step(valkyriePackBeforeEvent(f.s, event, [{ type: "fixture:receipt" }])!);
    const receipt = f.native.find(
      (e) => e.type === "fixture:receipt",
    )!.valkyriePackReceipt;
    expect(receipt.amount).toBe(3);
    f.step(valkyriePackEvent(f.s, event, receipt)!);
    f.choose("main");
    expect(f.s.scheme.threat).toBe(7);
    expect(f.native.find((e) => e.type === "thwart")).toMatchObject({
      basic: false,
      thwartInitiated: true,
    });
  });
  it("Smash cannot exhaust an already exhausted hero or create a zero-thwart event", () => {
    const f = fixture(),
      event = f.add("25019", "hand");
    f.s.player.exhausted = true;
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain("ready");
    f.s.player.exhausted = false;
    f.s.flags.heroAttack = 0;
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain(
      "scheme",
    );
    f.s.player.confused = true;
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toBeNull();
  });
  it("Smash evaluates the benefit's ATK after its actual exhaustion cost commits", () => {
    const f = fixture(),
      event = f.add("25019", "hand");
    f.ports.exhaustCharacter = (state, id) => {
      expect(id).toBe("hero:p1");
      state.player.exhausted = true;
      state.flags.heroAttack = 4;
      return true;
    };
    f.step(valkyriePackBeforeEvent(f.s, event, [{ type: "fixture:receipt" }])!);
    expect(
      f.native.find((e) => e.type === "fixture:receipt")!.valkyriePackReceipt
        .amount,
    ).toBe(4);
  });
});

describe("Alliance's distinct physical character costs and benefits", () => {
  it("Problem Solvers can use another player's actual ready Guardian and snapshots combined modified THW", () => {
    const f = fixture(true),
      event = f.add("25033", "hand"),
      throg = f.add("25014", "inPlay", "p2", { bonusThw: 2 });
    f.step(valkyriePackBeforeEvent(f.s, event, [{ type: "fixture:receipt" }])!);
    const pair = `hero:p1|${throg.id}`;
    expect(f.s.prompt!.options.map((o) => o.id)).toContain(pair);
    f.choose(pair);
    expect(f.s.player.exhausted).toBe(true);
    expect(seatView(f.s, "p2").player.inPlay[0].exhausted).toBe(true);
    expect(
      f.native.find((e) => e.type === "fixture:receipt")!.valkyriePackReceipt
        .amount,
    ).toBe(4);
    f.conserve();
  });
  it("a single dual-trait character cannot pay both Problem Solvers exhaustion costs", () => {
    const f = fixture(),
      event = f.add("25033", "hand");
    f.s.flags.heroTraits = "Avenger,Guardian";
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain(
      "distinct",
    );
  });
  it("Problem Solvers pays both exhaustion costs before Confuse replaces one complete thwart attempt", () => {
    const f = fixture(true),
      event = f.add("25033", "hand");
    f.s.player.confused = true;
    f.step(valkyriePackBeforeEvent(f.s, event, [{ type: "fixture:receipt" }])!);
    f.choose("hero:p1|hero:p2");
    const receipt = f.native.find(
      (e) => e.type === "fixture:receipt",
    )!.valkyriePackReceipt;
    f.step(valkyriePackEvent(f.s, event, receipt)!);
    expect(f.s.player.confused).toBe(false);
    expect(f.s.player.exhausted).toBe(true);
    expect(seatView(f.s, "p2").player.exhausted).toBe(true);
    expect(f.ports.thwartBatch).not.toHaveBeenCalled();
  });
  it("Problem Solvers uses a single simultaneous native batch and leaves Crisis-blocked main threat", () => {
    const f = fixture(),
      event = f.add("25033", "hand"),
      a = f.side(2),
      b = f.side(4);
    f.s.flags.crisis = true;
    f.step(valkyriePackEvent(f.s, event, { amount: 3 })!);
    expect(f.ports.thwartBatch).toHaveBeenCalledWith(
      expect.anything(),
      [a.id, b.id],
      3,
      [],
    );
    expect(f.s.scheme.threat).toBe(10);
    expect(f.s.sideSchemes.map((p) => p.counters)).toEqual([0, 1]);
    expect(f.history).toContain("all-threat-committed");
  });
  it("an alter-ego with a qualifying trait contributes exhaustion but no unprinted THW", () => {
    const f = fixture(true),
      event = f.add("25033", "hand");
    seatView(f.s, "p2").player.form = "alter";
    f.step(valkyriePackBeforeEvent(f.s, event, [{ type: "fixture:receipt" }])!);
    f.choose("hero:p1|hero:p2");
    expect(
      f.native.find((e) => e.type === "fixture:receipt")!.valkyriePackReceipt
        .amount,
    ).toBe(1);
  });
  it("Problem Solvers evaluates combined THW after both exhaustion costs commit", () => {
    const f = fixture(true),
      event = f.add("25033", "hand");
    f.ports.characterThwart = (state, id) =>
      seatView(state, id.slice(5)).player.exhausted ? 3 : 1;
    f.step(valkyriePackBeforeEvent(f.s, event, [{ type: "fixture:receipt" }])!);
    f.choose("hero:p1|hero:p2");
    expect(
      f.native.find((e) => e.type === "fixture:receipt")!.valkyriePackReceipt
        .amount,
    ).toBe(6);
  });
  it("Cosmic Alliance readies distinct qualified characters across seats, including alter-egos", () => {
    const f = fixture(true),
      event = f.add("25036", "hand");
    f.s.player.exhausted = true;
    seatView(f.s, "p2").player.exhausted = true;
    seatView(f.s, "p2").player.form = "alter";
    f.step(valkyriePackEvent(f.s, event)!);
    f.choose("hero:p1|hero:p2");
    expect(f.s.player.exhausted).toBe(false);
    expect(seatView(f.s, "p2").player.exhausted).toBe(false);
  });
  it("Cosmic Alliance permits one already ready partner while readying the other", () => {
    const f = fixture(true),
      event = f.add("25036", "hand");
    f.s.player.exhausted = true;
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toBeNull();
    f.step(valkyriePackEvent(f.s, event)!);
    f.choose("hero:p1|hero:p2");
    expect(f.s.player.exhausted).toBe(false);
    expect(seatView(f.s, "p2").player.exhausted).toBe(false);
  });
  it("Cosmic Alliance rejects no-benefit, ready-locked and single dual-trait targets", () => {
    const f = fixture(true),
      event = f.add("25036", "hand");
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain("ready");
    f.s.player.exhausted = true;
    f.s.flags["readyLocked:hero:p1"] = true;
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain("ready");
    const solo = fixture();
    solo.s.player.exhausted = true;
    solo.s.flags.heroTraits = "Avenger,Guardian";
    expect(
      valkyriePackPlayRestriction(solo.s, piece("25036"), solo.ports),
    ).toContain("distinct");
  });
});

describe("Godlike Stamina's actual optional single-status discard", () => {
  it("heals2 in either form before offering the status choice, without requiring an attack or thwart", () => {
    for (const form of ["hero", "alter"] as const) {
      const f = fixture(),
        event = f.add("25024", "hand");
      f.s.player.form = form;
      f.s.player.hp = 8;
      f.s.player.stunned = true;
      f.step(valkyriePackEvent(f.s, event)!);
      expect(f.s.player.hp).toBe(10);
      expect(f.s.prompt!.title).toBe("Godlike Stamina");
      f.choose("none");
      expect(f.s.player.stunned).toBe(true);
    }
  });
  it("a full-health Asgard identity may play it to discard one actual status", () => {
    const f = fixture(),
      event = f.add("25024", "hand");
    f.s.player.confused = true;
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toBeNull();
    f.step(valkyriePackEvent(f.s, event)!);
    f.choose("confused");
    expect(f.s.player.hp).toBe(12);
    expect(f.s.player.confused).toBe(false);
  });
  it("one of two Steady stun cards is discarded, instead of clearing both", () => {
    const f = fixture(),
      event = f.add("25024", "hand");
    f.s.flags.steady = true;
    f.s.player.stunned = true;
    f.s.player.stunCards = 2;
    f.step(valkyriePackEvent(f.s, event)!);
    f.choose("stunned");
    expect(f.s.player.stunCards).toBe(1);
    expect(f.s.player.stunned).toBe(false);
    expect(f.ports.discardIdentityStatus).toHaveBeenCalledWith(
      expect.anything(),
      "stunned",
    );
  });
  it("Tough can be the optional discard and other statuses remain intact", () => {
    const f = fixture(),
      event = f.add("25024", "hand");
    f.s.player.stunned = true;
    f.s.player.confused = true;
    f.s.player.tough = true;
    f.step(valkyriePackEvent(f.s, event)!);
    f.choose("tough");
    expect(f.s.player.tough).toBe(false);
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.player.confused).toBe(true);
  });
  it("non-Asgard identities and an undamaged status-free identity cannot play Godlike Stamina", () => {
    const f = fixture(),
      event = f.add("25024", "hand");
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain(
      "damage",
    );
    f.s.player.hp = 8;
    f.s.flags.heroTraits = "Guardian";
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain(
      "Asgard",
    );
  });
});

describe("native defense substitution and engagement interrupt ports", () => {
  it("The Best Defense pays/plays its actual event and replaces DEF with ordinary ATK", () => {
    const f = fixture(),
      event = f.add("25020", "hand");
    f.add("25006");
    f.add("25002", "inPlay", "p1", { attachedTo: f.s.villain.id });
    f.s.player.exhausted = true;
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 6,
      boostCodes: [],
      pendingBoosts: [],
      boostEffects: [],
      defender: "hero",
      defense: 5,
      defenseBonus: 2,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    f.step(
      valkyriePackDefenseOptions(f.s, [{ type: "fixture:resume" }], f.ports)[0]
        .effects,
    );
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      cost: 0,
      card: { id: event.id },
    });
    f.pay([]);
    expect(f.s.attack!.defense).toBe(3);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.player.discard.map((p) => p.id)).toContain(event.id);
    expect(f.history.at(-1)).toBe("resume");
    f.conserve();
  });
  it("The Best Defense is absent for ally/undefended attacks or alter-ego and cannot PLAY as an Action", () => {
    const f = fixture(),
      event = f.add("25020", "hand");
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 6,
      boostCodes: [],
      pendingBoosts: [],
      boostEffects: [],
      defender: "none",
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    expect(valkyriePackDefenseOptions(f.s, [], f.ports)).toEqual([]);
    f.s.attack.defender = "hero";
    f.s.player.form = "alter";
    expect(valkyriePackDefenseOptions(f.s, [], f.ports)).toEqual([]);
    expect(valkyriePackPlayRestriction(f.s, event, f.ports)).toContain(
      "defends",
    );
  });
  it("The Best Defense does not offer another copy after the same substitution is already active", () => {
    const f = fixture();
    f.add("25020", "hand");
    f.s.attack = {
      attacker: f.s.villain.id,
      base: 6,
      boostCodes: [],
      pendingBoosts: [],
      boostEffects: [],
      defender: "hero",
      defense: 2,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    f.s.flags.attackDefense = true;
    expect(valkyriePackDefenseOptions(f.s, [], f.ports)).toEqual([]);
  });
  it("Anticipation pays its actual discard before readying the engaging hero", () => {
    const f = fixture(),
      anticipation = f.add("25035"),
      minion = f.minion();
    f.s.player.exhausted = true;
    f.step(
      valkyriePackEngagementOptions(
        f.s,
        minion.id,
        [{ type: "fixture:resume" }],
        f.ports,
      )[0].effects,
    );
    expect(f.s.player.discard.map((p) => p.id)).toEqual([anticipation.id]);
    expect(f.s.player.exhausted).toBe(false);
    expect(f.history).toEqual([`discard:${anticipation.id}`, "resume"]);
    f.conserve();
  });
  it("Anticipation requires Hero, actual ready benefit, unblank text and payable discard", () => {
    const f = fixture(),
      anticipation = f.add("25035");
    expect(valkyriePackEngagementOptions(f.s, "enemy", [], f.ports)).toEqual(
      [],
    );
    f.s.player.exhausted = true;
    f.s.player.form = "alter";
    expect(valkyriePackEngagementOptions(f.s, "enemy", [], f.ports)).toEqual(
      [],
    );
    f.s.player.form = "hero";
    f.s.flags[`discardBlocked:${anticipation.id}`] = true;
    expect(valkyriePackEngagementOptions(f.s, "enemy", [], f.ports)).toEqual(
      [],
    );
    delete f.s.flags[`discardBlocked:${anticipation.id}`];
    f.s.flags[`blank:${anticipation.id}`] = true;
    expect(valkyriePackEngagementOptions(f.s, "enemy", [], f.ports)).toEqual(
      [],
    );
  });
});

describe("Thor's one attack against ordered minions", () => {
  it("spends a real energy resource, orders all same-player minions, and pays consequential damage once", () => {
    const f = fixture(true),
      thor = f.add("25013"),
      energy = f.add("25025", "hand"),
      a = f.minion("01102", "p2"),
      b = f.minion("01102", "p2"),
      other = f.minion("01102", "p1");
    thor.exhausted = true;
    f.step(
      valkyriePackAllyAttackOptions(
        f.s,
        thor,
        a.id,
        [{ type: "fixture:resume" }],
        f.ports,
      )[0].effects,
    );
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      cost: 1,
      requirements: ["energy"],
      abilityCost: true,
    });
    f.pay([energy.id]);
    expect(f.s.prompt!.options.map((o) => o.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    f.choose(b.id);
    f.choose(a.id);
    expect(f.ports.allyAttackBatch).toHaveBeenCalledWith(
      expect.anything(),
      thor.id,
      [b.id, a.id],
      [{ type: "fixture:resume" }],
    );
    expect(
      f.s.minions.filter((m) => m.engagedWith === "p2").map((m) => m.damage),
    ).toEqual([3, 3]);
    expect(f.s.minions.find((m) => m.id === other.id)!.damage).toBe(0);
    expect(f.s.player.inPlay[0].damage).toBe(2);
    expect(f.s.player.discard[0].id).toBe(energy.id);
    f.conserve();
  });
  it("a wild resource can pay Thor's energy requirement, while physical-only resources cannot", () => {
    const f = fixture(),
      thor = f.add("25013"),
      minion = f.minion();
    f.add("25027", "hand");
    expect(
      valkyriePackAllyAttackOptions(f.s, thor, minion.id, [], f.ports),
    ).toEqual([]);
    const wild = f.add("25021", "hand");
    expect(
      valkyriePackAllyAttackOptions(f.s, thor, minion.id, [], f.ports),
    ).toHaveLength(1);
    f.step(
      valkyriePackAllyAttackOptions(f.s, thor, minion.id, [], f.ports)[0]
        .effects,
    );
    f.pay([wild.id]);
    f.choose(minion.id);
    expect(f.s.minions[0].damage).toBe(3);
  });
  it("Thor cannot use the villain, another ally face, blank text or unavailable physical source", () => {
    const f = fixture(),
      thor = f.add("25013"),
      minion = f.minion();
    f.add("25025", "hand");
    expect(
      valkyriePackAllyAttackOptions(f.s, thor, f.s.villain.id, [], f.ports),
    ).toEqual([]);
    expect(
      valkyriePackAllyAttackOptions(
        f.s,
        piece("25014"),
        minion.id,
        [],
        f.ports,
      ),
    ).toEqual([]);
    f.s.flags[`blank:${thor.id}`] = true;
    expect(
      valkyriePackAllyAttackOptions(f.s, thor, minion.id, [], f.ports),
    ).toEqual([]);
  });
  it("a saved Thor order contains each actual snapshot ID once and never adds a later minion", () => {
    const f = fixture(),
      thor = f.add("25013"),
      energy = f.add("25025", "hand"),
      a = f.minion(),
      b = f.minion();
    f.step(
      valkyriePackAllyAttackOptions(f.s, thor, a.id, [], f.ports)[0].effects,
    );
    f.pay([energy.id]);
    const late = f.minion();
    f.choose(a.id);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([b.id]);
    f.choose(b.id);
    expect(f.s.minions.find((p) => p.id === late.id)!.damage).toBe(0);
    expect(f.ports.allyAttackBatch).toHaveBeenCalledWith(
      expect.anything(),
      thor.id,
      [a.id, b.id],
      [],
    );
  });
  it("unknown namespace effects defer without altering state", () => {
    const f = fixture();
    expect(resolveValkyriePackEffect(f.s, { type: "unknown" }, f.ports)).toBe(
      false,
    );
    expect(resolveValkyriePackEffect(f.s, P("unknown"), f.ports)).toBe(false);
  });
});
