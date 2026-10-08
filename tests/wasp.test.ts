import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  WASP_SCRIPT_CODES,
  resolveWaspEffect,
  waspAbility,
  waspAbilityOptions,
  waspAllyStats,
  waspAllyTraits,
  waspBasicAttackCost,
  waspBasicPiercing,
  waspBasicPower,
  waspDamageOptions,
  waspDefeatInterrupt,
  waspDefeated,
  waspDefenseOptions,
  waspEncounterReveal,
  waspEnemyHP,
  waspEvent,
  waspForm,
  waspHeroTraits,
  waspPlayRestriction,
  waspResourceSpent,
  waspRetaliate,
  waspStats,
  type WaspPorts,
} from "../src/game/wasp.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
let nextId = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `wasp${++nextId}`,
  code,
  ownerId: "p1",
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ...patch,
});
function fixture() {
  const player: GameState["player"] = {
    form: "hero",
    heroForm: "tiny",
    hp: 7,
    exhausted: false,
    flipped: false,
    tough: false,
    stunned: false,
    confused: false,
    hand: [],
    deck: [],
    discard: [],
    inPlay: [],
  };
  const s: GameState = {
    version: 1,
    seed: 13,
    nextId: 1,
    heroId: "wsp",
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
    playerCount: 1,
    guided: false,
    review: null,
    reviewCount: 0,
    player,
    villain: { ...piece("01094"), hp: 14, maxHp: 14, stage: 1 },
    scheme: { code: "01097", threat: 5, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
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
      heroId: "wsp",
      aspect: "aggression",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  let formLocked = false;
  const recorded: Effect[] = [];
  const ports: WaspPorts = {
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
        options: pieces.map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          image: p.code,
          effects: [],
        })),
      };
    },
    canChangeForm: () => !formLocked,
    flip: vi.fn((state, counts, form) => {
      if (formLocked) throw Error("Locked");
      state.player.form = form === "alter" ? "alter" : "hero";
      if (form !== "alter") state.player.heroForm = form || "tiny";
      if (counts) state.player.flipped = true;
    }),
    canReadyIdentity: () => true,
    canPay: vi.fn(() => true),
    canGiveStatus: () => true,
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some((p) => p.code === "13028" || p.code === "01101")
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)?.name || p.code,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...((!thwart || !state.sideSchemes.some((p) => p.code === "01104")) &&
      state.scheme.threat > 0
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
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    discardHand: (state, id) => {
      const index = state.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Missing hand card");
      state.player.discard.push(state.player.hand.splice(index, 1)[0]);
    },
    discardPiece: (state, id) => {
      for (const zone of [
        state.player.inPlay,
        state.minions,
        state.attachments,
      ]) {
        const index = zone.findIndex((p) => p.id === id);
        if (index < 0) continue;
        const p = zone.splice(index, 1)[0];
        (cards.get(p.code)?.faction_code === "encounter"
          ? state.encounter.discard
          : state.player.discard
        ).push(p);
        return;
      }
    },
    revealHidden: vi.fn(),
    recycleEncounter: vi.fn(),
    log: vi.fn(),
    attackProgram: (state, effects, after) =>
      ports.queue(state, ...effects, ...after),
    cardCost: (_state, p) => cards.get(p.code)?.cost || 0,
    heroStat: (state, power) => {
      const c = cards.get(
        state.player.heroForm === "giant" ? "13001c" : "13001a",
      )!;
      return Number(c[power] || 0) + waspStats(state)[power];
    },
    shufflePlayerDeck: vi.fn((state) => {
      state.player.deck.reverse();
    }),
    shuffleEncounter: vi.fn(),
    attackDistribution: vi.fn(),
    thwartDistribution: vi.fn(),
    preventDamage: vi.fn(),
    startEnemyAttack: vi.fn(() => true),
    finishMinionDefeat: vi.fn(),
  };
  function run() {
    for (let count = 0; s.queue.length && !s.prompt; count++) {
      if (count > 100) throw Error("Non-terminating effects");
      const e = s.queue.shift()!;
      if (resolveWaspEffect(s, e, ports)) continue;
      recorded.push(e);
      if (e.type === "optional")
        ports.choose(s, e.title, e.text, [
          { id: "yes", label: "Use", effects: e.effects },
          { id: "skip", label: "Skip", effects: [] },
        ]);
      else if (e.type === "payRequest")
        s.prompt = {
          kind: "payment",
          title: e.title,
          text: "Pay",
          cost: e.cost,
          requirements: e.requirements,
          card: e.piece,
          after: e.after,
          options: [],
          cancelable: e.cancelable,
        };
      else if (e.type === "resolveHandEvent") {
        const index = s.player.hand.findIndex((p) => p.id === e.id);
        const [p] = s.player.hand.splice(index, 1);
        s.resolving.push(p);
        ports.queue(
          s,
          ...e.after,
          { type: "finish-test-event", id: p.id },
          ...(e.continuation || []),
        );
      } else if (e.type === "finish-test-event") {
        const index = s.resolving.findIndex((p) => p.id === e.id);
        s.player.discard.push(s.resolving.splice(index, 1)[0]);
      } else if (e.type === "damage" && e.target === s.villain.id)
        s.villain.hp -= e.amount;
      else if (e.type === "heal")
        s.player.hp = Math.min(11, s.player.hp + e.amount);
      else if (e.type === "draw")
        s.player.hand.push(...s.player.deck.splice(0, e.amount));
    }
  }
  const choose = (id: string) => {
    const o = s.prompt?.options.find((p) => p.id === id);
    if (!o) throw Error(`Missing choice ${id}`);
    s.prompt = null;
    ports.queue(s, ...o.effects);
    run();
  };
  const pay = () => {
    const prompt = s.prompt;
    if (prompt?.kind !== "payment") throw Error("Missing payment");
    s.prompt = null;
    ports.queue(s, ...(prompt.after || []));
    run();
  };
  const enqueue = (...effects: Effect[]) => {
    ports.queue(s, ...effects);
    run();
  };
  return {
    s,
    ports,
    recorded,
    run,
    choose,
    pay,
    enqueue,
    lock: () => {
      formLocked = true;
    },
  };
}

describe("native Wasp adapter", () => {
  it("registers all three actual identity faces, signatures and nemesis faces", () => {
    expect(WASP_SCRIPT_CODES).toHaveLength(18);
    expect(new Set(WASP_SCRIPT_CODES).size).toBe(18);
    expect(WASP_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
  });
  it("grants each form's printed upgrade and Ant-Man ally bonuses", () => {
    const { s } = fixture();
    s.player.inPlay.push(piece("13010"), piece("13008"), piece("13009"));
    const ant = piece("13002");
    expect(waspStats(s)).toMatchObject({ attack: 1, thwart: 0 });
    expect(waspBasicPiercing(s)).toBe(true);
    expect(waspRetaliate(s)).toBe(0);
    expect(waspAllyStats(s, ant)).toEqual({ attack: 0, thwart: 1 });
    expect(waspAllyTraits(s, ant)).toEqual(["Tiny"]);
    expect(waspHeroTraits(s)).toEqual(["Aerial"]);
    s.player.heroForm = "giant";
    expect(waspStats(s)).toMatchObject({ attack: 0, thwart: 1 });
    expect(waspAllyStats(s, ant)).toEqual({ attack: 1, thwart: 0 });
    expect(waspAllyTraits(s, ant)).toEqual(["Giant"]);
    expect(waspBasicPiercing(s)).toBe(false);
    expect(waspRetaliate(s)).toBe(1);
    s.player.form = "alter";
    expect(waspForm(s)).toBe("alter");
    expect(waspHeroTraits(s)).toEqual([]);
    expect(waspAllyTraits(s, ant)).toEqual([]);
  });
  it("G.I.R.L. selects mental icons, preserves physical cards, and expires by round", () => {
    const { s, ports, enqueue } = fixture();
    s.player.form = "alter";
    const a = piece("13003"),
      b = piece("13003"),
      wild = piece("13024");
    s.player.discard.push(a, b, wild);
    enqueue(...waspAbility(s, "identity", "girl", ports)!);
    expect(s.prompt?.kind).toBe("select");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    const action = s.prompt!.selectAction!;
    s.prompt = null;
    enqueue({ ...action, ids: [a.id, b.id] });
    expect(s.player.deck).toEqual([b, a]);
    expect(s.player.deck[0]).toBe(b);
    expect(s.player.discard).toEqual([wild]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    s.player.discard.push(piece("13022"));
    expect(waspAbilityOptions(s, "hero", ports)).toEqual([]);
    s.round++;
    expect(waspAbilityOptions(s, "hero", ports)).toHaveLength(1);
  });
  it("G.I.R.L. rejects a wild icon and duplicate physical selections without mutations", () => {
    const { s, ports } = fixture();
    s.player.form = "alter";
    const mental = piece("13022"),
      wild = piece("13024");
    s.player.discard.push(mental, wild);
    expect(() =>
      resolveWaspEffect(
        s,
        { type: "wasp:girl-selected", selected: [wild.id] },
        ports,
      ),
    ).toThrow("printed mental");
    expect(() =>
      resolveWaspEffect(
        s,
        { type: "wasp:girl-selected", selected: [mental.id, mental.id] },
        ports,
      ),
    ).toThrow("actual discarded");
    expect(s.player.discard).toEqual([mental, wild]);
    expect(s.player.deck).toEqual([]);
    expect(s.flags.waspGirlRound).toBeUndefined();
  });
  it("Tiny's response distinguishes identity, owned event and upgrade sources from allies and other players", () => {
    const { s } = fixture();
    const ally = piece("13002"),
      upgrade = piece("13008"),
      support = piece("13016"),
      event = piece("13004");
    s.player.inPlay.push(ally, upgrade, support);
    s.resolving.push(event);
    expect(waspDefeated(s, "minion", "hero")).toHaveLength(1);
    expect(waspDefeated(s, "side_scheme", event.code, event.id)).toHaveLength(
      1,
    );
    expect(waspDefeated(s, "minion", upgrade.id)).toHaveLength(1);
    expect(waspDefeated(s, "minion", ally.id)).toEqual([]);
    expect(waspDefeated(s, "side_scheme", support.id)).toEqual([]);
    event.ownerId = "p2";
    expect(waspDefeated(s, "minion", event.id, event.id)).toEqual([]);
    expect(waspDefeated(s, "minion", "hero", event.id)).toEqual([]);
    upgrade.attachedTo = ally.id;
    expect(waspDefeated(s, "minion", upgrade.id)).toEqual([]);
    s.player.heroForm = "giant";
    expect(waspDefeated(s, "minion", "hero")).toEqual([]);
  });
  it("Small but Mighty is optional, deals nonattack damage, and defers attack responses", () => {
    const { s, enqueue, choose, recorded } = fixture();
    const response = waspDefeated(s, "minion", "hero", undefined, true)[0];
    expect(response).toMatchObject({ mandatory: false, afterAttack: true });
    enqueue(response);
    choose("yes");
    expect(s.villain.hp).toBe(13);
    expect(recorded.find((e) => e.type === "damage")).toMatchObject({
      target: s.villain.id,
      amount: 1,
    });
    expect(recorded.find((e) => e.type === "damage")?.attack).toBeUndefined();
  });
  it("counts controlled enemy/scheme upgrades as identity extensions but excludes other friendly characters", () => {
    const { s } = fixture();
    const scheme = piece("13027", { counters: 2 }),
      followed = piece("03032", { attachedTo: scheme.id }),
      tracer = piece("01007", { attachedTo: s.villain.id }),
      ally = piece("13002");
    s.sideSchemes.push(scheme);
    s.player.inPlay.push(followed, tracer, ally);
    expect(waspDefeated(s, "minion", followed.id)).toHaveLength(1);
    expect(waspDefeated(s, "side_scheme", tracer.id)).toHaveLength(1);
    followed.attachedTo = "main";
    expect(waspDefeated(s, "minion", followed.id)).toHaveLength(1);
    followed.attachedTo = ally.id;
    expect(waspDefeated(s, "minion", followed.id)).toEqual([]);
    const other = structuredClone(s.players[0]);
    other.id = "p2";
    other.player.inPlay = [];
    s.players.push(other);
    followed.attachedTo = "hero:p2";
    expect(waspDefeated(s, "minion", followed.id)).toEqual([]);
    followed.attachedTo = "hero:p1";
    expect(waspDefeated(s, "minion", followed.id)).toHaveLength(1);
  });
  it("Pinpoint Strike gains Tiny overkill but never Tiny basic piercing", () => {
    const { s, ports, enqueue, recorded } = fixture();
    s.player.inPlay.push(piece("13008"));
    enqueue(...waspEvent(s, piece("13004"))!);
    expect(recorded.at(-1)).toMatchObject({
      type: "damage",
      amount: 8,
      overkill: true,
      attack: true,
    });
    expect(recorded.at(-1)?.piercing).toBeUndefined();
    s.player.heroForm = "giant";
    enqueue(...waspEvent(s, piece("13004"))!);
    expect(recorded.at(-1)).toMatchObject({ amount: 7, overkill: false });
    expect(waspPlayRestriction(s, piece("13005"), ports)).toContain(
      "only be played",
    );
  });
  it("Giant basic attacks snapshot Guard and commit one simultaneous distribution", () => {
    const { s, ports, enqueue, choose } = fixture();
    s.player.heroForm = "giant";
    const guard = piece("13028"),
      other = piece("01100");
    s.minions.push(guard, other);
    enqueue(...waspBasicPower(s, "attack")!);
    expect(s.prompt?.title).toBe("Basic attack");
    expect(s.prompt?.options.some((o) => o.id.startsWith(s.villain.id))).toBe(
      false,
    );
    choose(`${guard.id}:1`);
    expect(ports.attackDistribution).toHaveBeenCalledWith(
      s,
      [
        { target: guard.id, amount: 1 },
        { target: other.id, amount: 1 },
      ],
      { basic: true, piercing: false },
    );
    expect(ports.attackDistribution).toHaveBeenCalledOnce();
  });
  it("Giant Help snapshots Crisis and doesn't permit the main scheme in the same division", () => {
    const { s, ports, enqueue, choose } = fixture();
    s.player.heroForm = "giant";
    const crisis = piece("01104", { counters: 2 }),
      other = piece("13027", { counters: 3 });
    s.sideSchemes.push(crisis, other);
    enqueue(...waspEvent(s, piece("13003"))!);
    expect(s.prompt?.options.some((o) => o.id.startsWith("main:"))).toBe(false);
    choose(`${crisis.id}:2`);
    expect(ports.thwartDistribution).toHaveBeenCalledWith(s, [
      { target: crisis.id, amount: 2 },
      { target: other.id, amount: 2 },
    ]);
  });
  it("rejects forged distribution totals and targets without partially dealing damage", () => {
    const { s, ports } = fixture();
    const effect = {
      type: "wasp:division-commit",
      power: "attack",
      total: 4,
      legal: [{ id: s.villain.id }],
      packets: [{ target: s.villain.id, amount: 3 }],
    };
    expect(() => resolveWaspEffect(s, effect, ports)).toThrow(
      "Invalid target division",
    );
    expect(() =>
      resolveWaspEffect(
        s,
        { ...effect, packets: [{ target: "missing", amount: 4 }] },
        ports,
      ),
    ).toThrow("Invalid target division");
    expect(ports.attackDistribution).not.toHaveBeenCalled();
  });
  it("Rapid Growth recomputes Giant stats, stacks physical copies, and has no later lasting bonus", () => {
    const { s, ports, enqueue, choose, pay } = fixture();
    const a = piece("13005"),
      b = piece("13005");
    s.player.hand.push(a, b);
    s.player.inPlay.push(piece("13010"));
    enqueue(...waspBasicPower(s, "thwart")!);
    choose(a.id);
    expect(s.prompt?.cancelable).toBe(false);
    pay();
    choose(b.id);
    pay();
    expect(s.player.heroForm).toBe("giant");
    expect(s.player.flipped).toBe(false);
    expect(ports.flip).toHaveBeenCalledTimes(1);
    expect(ports.thwartDistribution).toHaveBeenLastCalledWith(s, [
      { target: "main", amount: 7 },
    ]);
    expect(s.player.discard.map((p) => p.id)).toEqual([a.id, b.id]);
    enqueue(...waspBasicPower(s, "thwart")!);
    expect(ports.thwartDistribution).toHaveBeenLastCalledWith(s, [
      { target: "main", amount: 3 },
    ]);
  });
  it.each([
    ["attack", -1, "draxPackLeadingBlows", 5],
    ["thwart", 2, "venomPackEntrances", 8],
  ] as const)(
    "preserves %s pack receipts and bonuses through stacked Rapid Growth payments and JSON reload",
    (power, bonus, receipt, amount) => {
      const { s, ports, enqueue, choose, pay } = fixture();
      const first = piece("13005"),
        second = piece("13005");
      const metadata = {
        basic: true,
        gmwBasicBonus: bonus,
        [receipt]: ["physical-pack-event"],
      };
      s.player.hand.push(first, second);
      enqueue(
        ...waspBasicPower(s, power, bonus, {
          overkill: power === "attack",
          metadata,
        })!,
      );
      choose(first.id);
      Object.assign(s, JSON.parse(JSON.stringify(s)));
      s.players[0].player = s.player;
      s.players[0].flags = s.flags;
      pay();
      choose(second.id);
      Object.assign(s, JSON.parse(JSON.stringify(s)));
      s.players[0].player = s.player;
      s.players[0].flags = s.flags;
      pay();
      const packets = [
        { target: power === "attack" ? s.villain.id : "main", amount },
      ];
      if (power === "attack")
        expect(ports.attackDistribution).toHaveBeenLastCalledWith(s, packets, {
          basic: true,
          piercing: false,
          overkill: true,
          metadata,
        });
      else
        expect(ports.thwartDistribution).toHaveBeenLastCalledWith(
          s,
          packets,
          metadata,
        );
      expect(s.player.discard.map((p) => p.id)).toEqual([first.id, second.id]);
      expect(s.player.heroForm).toBe("giant");
      expect(ports.flip).toHaveBeenCalledOnce();
    },
  );
  it("Rapid Growth independently adds two while a form lock preserves Tiny", () => {
    const { s, ports, enqueue, choose, pay, lock, recorded } = fixture();
    const growth = piece("13005");
    s.player.hand.push(growth);
    lock();
    enqueue(...waspBasicPower(s, "attack")!);
    choose(growth.id);
    pay();
    expect(s.player.heroForm).toBe("tiny");
    expect(ports.flip).not.toHaveBeenCalled();
    expect(recorded.find((e) => e.type === "damage")).toMatchObject({
      amount: 3,
      basic: true,
    });
  });
  it("combines shared basic interrupt bonuses with the current form and Growth bonus", () => {
    const { s, ports, enqueue } = fixture();
    s.player.heroForm = "giant";
    enqueue({
      type: "wasp:basic-resolve",
      power: "attack",
      amount: 3,
      bonus: 2,
    });
    expect(ports.attackDistribution).toHaveBeenCalledWith(
      s,
      [{ target: s.villain.id, amount: 7 }],
      { basic: true, piercing: false },
    );
  });
  it("stun and confuse each replace one entire use before Growth or division", () => {
    const { s, ports, enqueue } = fixture();
    s.player.heroForm = "giant";
    s.player.hand.push(piece("13005"));
    s.player.stunned = true;
    enqueue(...waspBasicPower(s, "attack")!);
    expect(s.player.stunned).toBe(false);
    expect(s.prompt).toBeNull();
    expect(ports.attackDistribution).not.toHaveBeenCalled();
    s.player.confused = true;
    enqueue(...waspEvent(s, piece("13003"))!);
    expect(s.player.confused).toBe(false);
    expect(ports.thwartDistribution).not.toHaveBeenCalled();
    expect(s.player.hand).toHaveLength(1);
  });
  it("defense Growth grants +2 to this actual attack and moves to Giant", () => {
    const { s, ports, enqueue, pay } = fixture();
    const growth = piece("13005");
    s.player.hand.push(growth);
    s.attack = {
      attacker: s.villain.id,
      base: 3,
      boostCodes: [],
      boostEffects: [],
      defender: "hero",
      defense: 2,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
      basicDefense: true,
    };
    const options = waspDefenseOptions(s, [{ type: "boostAttack" }], ports);
    expect(options).toHaveLength(1);
    enqueue(...options[0].effects);
    pay();
    expect(s.attack.defenseBonus).toBe(2);
    expect(s.player.heroForm).toBe("giant");
    expect(s.player.discard[0]).toBe(growth);
    s.attack.basicDefense = false;
    s.player.hand.push(piece("13005"));
    expect(waspDefenseOptions(s, [], ports)).toEqual([]);
  });
  it("Wings observes Tiny, Tough priority, positive damage, exhaustion and blanking", () => {
    const { s, ports, enqueue } = fixture();
    const wings = piece("13009"),
      packet = {
        type: "damage",
        target: "hero",
        amount: 2,
        damageWindowId: "d1",
      };
    s.player.inPlay.push(wings);
    s.player.tough = true;
    expect(waspDamageOptions(s, packet, 2, [], ports)).toEqual([]);
    s.player.tough = false;
    expect(waspDamageOptions(s, packet, 0, [], ports)).toEqual([]);
    const options = waspDamageOptions(
      s,
      packet,
      2,
      [{ type: "resume" }],
      ports,
    );
    enqueue(...options[0].effects);
    expect(wings.exhausted).toBe(true);
    expect(ports.preventDamage).toHaveBeenCalledWith(s, packet, 1);
    expect(waspDamageOptions(s, packet, 2, [], ports)).toEqual([]);
    wings.exhausted = false;
    s.flags[`blank:${wings.id}`] = true;
    expect(waspDamageOptions(s, packet, 2, [], ports)).toEqual([]);
  });
  it("Wasp Pym Particles responds in the applicable form only", () => {
    const { s, ports, enqueue, choose } = fixture();
    const particles = piece("13007"),
      draw = piece("13004");
    s.player.deck.push(draw);
    enqueue(...waspResourceSpent(s, particles, ports));
    choose("yes");
    expect(s.player.hand[0]).toBe(draw);
    s.player.heroForm = "giant";
    enqueue(...waspResourceSpent(s, particles, ports));
    choose("yes");
    expect(s.player.hp).toBe(9);
    s.player.form = "alter";
    expect(waspResourceSpent(s, particles, ports)).toEqual([]);
  });
  it("Red Dreams discards all printed mental copies while preserving wild cards", () => {
    const { s, ports, enqueue, choose, recorded } = fixture();
    const obligation = piece("13026"),
      mental = piece("13022"),
      wild = piece("13007"),
      double = piece("13003");
    s.player.hand.push(mental, wild, double);
    enqueue(...waspEncounterReveal(s, obligation)!);
    choose("stay");
    choose("discard");
    expect(s.player.hand).toEqual([wild]);
    expect(s.player.discard).toEqual([mental, double]);
    expect(recorded.at(-1)).toMatchObject({
      type: "damage",
      target: "hero",
      amount: 1,
    });
    expect(ports.flip).not.toHaveBeenCalled();
  });
  it("Red Dreams exhaustion removes the exact obligation and survives lack of hand resources", () => {
    const { s, enqueue, choose } = fixture();
    const obligation = piece("13026");
    s.resolving.push(obligation);
    enqueue(...waspEncounterReveal(s, obligation)!);
    choose("flip");
    choose("remove");
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.map((p) => p.id)).toEqual([obligation.id]);
    expect(s.resolving).toEqual([]);
  });
  it("Beetle asks the actual defeating player to pay physical or shuffle that minion", () => {
    const { s, ports, enqueue, choose, pay } = fixture();
    const beetle = piece("13028");
    s.minions.push(beetle);
    enqueue(...waspDefeatInterrupt(s, beetle, "hero", true)!);
    choose("pay");
    expect(s.prompt?.requirements).toEqual(["physical"]);
    pay();
    expect(ports.finishMinionDefeat).toHaveBeenCalledWith(
      s,
      beetle.id,
      "hero",
      true,
      false,
    );
    vi.mocked(ports.canPay).mockReturnValue(false);
    enqueue(...waspDefeatInterrupt(s, beetle, "hero", true)!);
    expect(s.prompt?.options.map((p) => p.id)).toEqual(["shuffle"]);
    choose("shuffle");
    expect(ports.finishMinionDefeat).toHaveBeenLastCalledWith(
      s,
      beetle.id,
      "hero",
      true,
      true,
    );
  });
  it("Armor attaches to Beetle before the villain and contributes exactly four HP", () => {
    const { s, enqueue } = fixture();
    const beetle = piece("13028"),
      armor = piece("13029");
    s.minions.push(beetle);
    s.attachments.push(armor);
    enqueue(...waspEncounterReveal(s, armor)!);
    expect(armor.attachedTo).toBe(beetle.id);
    expect(waspEnemyHP(s, beetle)).toBe(4);
    expect(s.villain.hp).toBe(14);
    s.minions.length = 0;
    const villainArmor = piece("13029");
    s.attachments.push(villainArmor);
    enqueue(...waspEncounterReveal(s, villainArmor)!);
    expect(villainArmor.attachedTo).toBe(s.villain.id);
    expect(s.villain.hp).toBe(18);
    expect(s.villain.maxHp).toBe(18);
  });
  it("Mother's Orders charges all identities and Mania surges only without an actual attack", () => {
    const { s, ports, enqueue, recorded } = fixture();
    s.heroId = "spider_man";
    s.sideSchemes.push(piece("13027"));
    expect(waspBasicAttackCost(s)).toBe(1);
    enqueue(...waspEncounterReveal(s, piece("13030"))!);
    expect(recorded.at(-1)?.type).toBe("surge");
    const beetle = piece("13028");
    s.minions.push(beetle);
    enqueue(...waspEncounterReveal(s, piece("13030"))!);
    expect(ports.startEnemyAttack).toHaveBeenCalledWith(s, beetle.id, 1);
    vi.mocked(ports.startEnemyAttack).mockReturnValue(false);
    enqueue(...waspEncounterReveal(s, piece("13030"))!);
    expect(recorded.at(-1)?.type).toBe("surge");
  });
});
