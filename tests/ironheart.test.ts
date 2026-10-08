import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import decks from "../src/data/catalog-decks.json" with { type: "json" };
import {
  IRONHEART_SCRIPT_CODES,
  ironheartAbility,
  ironheartAbilityOptions,
  ironheartBoost,
  ironheartCostReduction,
  ironheartEncounterReveal,
  ironheartEncounterTopVisible,
  ironheartEnemyKeywords,
  ironheartEnemyStats,
  ironheartEvent,
  ironheartEventAction,
  ironheartIdentityCode,
  ironheartIdentityPiece,
  ironheartInitialize,
  ironheartPlayRestriction,
  ironheartProgress,
  ironheartResourceCardSpent,
  ironheartResourceSources,
  ironheartResourceSpent,
  ironheartSchemeIcons,
  ironheartShadowOfPast,
  ironheartSignatureHPBonus,
  ironheartVersion,
  ironheartVillainPhaseEnded,
  resolveIronheartEffect,
  type IronheartPorts,
} from "../src/game/ironheart.js";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const I = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `ironheart:${type}`,
  ...args,
});
function fixture() {
  const s: GameState = {
    version: 1,
    seed: 29,
    nextId: 1,
    heroId: "ironheart",
    aspect: "leadership",
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
    player: {
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
    },
    villain: {
      id: "villain",
      code: "01094",
      hp: 40,
      maxHp: 40,
      stage: 1,
      exhausted: false,
      damage: 0,
      counters: 0,
      tough: false,
      stunned: false,
      confused: false,
    },
    scheme: { code: "01097", threat: 6, index: 0 },
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
      heroId: "ironheart",
      aspect: "leadership",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  const make = (code: string): Piece => ({
    id: `ih${s.nextId++}`,
    code,
    ownerId: "p1",
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: false,
    stunned: false,
    confused: false,
  });
  const f = {
    s,
    make,
    ports: {} as IronheartPorts,
    history: [] as string[],
    packets: [] as Effect[],
    affordable: true,
    blockReady: false,
    blockTough: false,
    cancelPayment: false,
    paymentFlip: false,
    actualAttackDefeat: undefined as boolean | undefined,
    actualLastThreat: undefined as boolean | undefined,
  };
  const target = (id: string) =>
    id === "hero"
      ? s.player
      : id === "villain"
        ? s.villain
        : s.minions.find((p) => p.id === id);
  const removeEncounter = (p: Piece) => {
    for (const zone of [
      s.resolving,
      s.attachments,
      s.encounter.deck,
      s.encounter.discard,
      s.encounter.dealt,
      s.removed,
    ]) {
      const i = zone.findIndex((x) => x.id === p.id);
      if (i >= 0) zone.splice(i, 1);
    }
  };
  const damage = (id: string, amount: number) => {
    const p = target(id);
    if (!p) return false;
    if (p.tough) {
      p.tough = false;
      return false;
    }
    if (id === "hero") {
      s.player.hp -= amount;
      return s.player.hp <= 0;
    }
    if (id === "villain") {
      s.villain.hp -= amount;
      return s.villain.hp <= 0;
    }
    const enemy = p as Piece;
    enemy.damage += amount;
    const defeated =
      enemy.damage >=
      (cards.get(enemy.code)?.health || 1) +
        ironheartEnemyStats(s, enemy).health;
    if (defeated) {
      s.minions.splice(s.minions.indexOf(enemy), 1);
      s.encounter.discard.push(enemy);
    }
    return defeated;
  };
  const thwart = (id: string, amount: number) => {
    const p = s.sideSchemes.find((p) => p.id === id);
    const before = id === "main" ? s.scheme.threat : p?.counters || 0;
    const removed = Math.min(before, amount);
    if (id === "main") s.scheme.threat -= removed;
    else if (p) {
      p.counters -= removed;
      if (!p.counters) {
        s.sideSchemes.splice(s.sideSchemes.indexOf(p), 1);
        s.encounter.discard.push(p);
      }
    }
    return { removed, lastThreatRemoved: before > 0 && removed === before };
  };
  f.ports = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    isIdentityTextBlank: (state) => !!state.flags.blankIdentity,
    makePiece: (_state, code) => make(code),
    canPay: (_state, cost, requirements = []) =>
      f.affordable && cost <= 2 && !requirements.includes("energy"),
    payAbility: (state, cost, requirements, after, commit = []) => {
      f.history.push(`pay:${cost}:${requirements.join(",")}`);
      if (f.cancelPayment) return;
      state.queue.unshift(
        ...commit,
        ...(f.paymentFlip ? [{ type: "fixture-flip" }] : []),
        ...after,
      );
    },
    canReadyIdentity: (state) => state.player.exhausted && !f.blockReady,
    canGiveStatus: (_state, id, status) =>
      status === "tough"
        ? !target(id)?.tough && !f.blockTough
        : !target(id)?.[status],
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some((p) => cards.get(p.code)?.text?.includes("Guard"))
        ? [{ id: state.villain.id, label: "Rhino" }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)?.name || p.code,
        code: p.code,
      })),
    ],
    schemeTargets: (state, isThwart) => [
      ...(!isThwart ||
      !state.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis)
        ? state.scheme.threat > 0
          ? [{ id: "main", label: "The Break-In!" }]
          : []
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)?.name || p.code,
          code: p.code,
        })),
    ],
    attack: (state, id, amount, continuation) => {
      f.packets.push({ type: "attack", target: id, amount });
      const defeatedEnemy = damage(id, amount);
      state.queue.unshift({
        ...continuation,
        defeatedEnemy: f.actualAttackDefeat ?? defeatedEnemy,
      });
    },
    thwart: (state, id, amount, continuation) => {
      f.packets.push({ type: "thwart", target: id, amount });
      const receipt = thwart(id, amount);
      state.queue.unshift({
        ...continuation,
        ...receipt,
        lastThreatRemoved: f.actualLastThreat ?? receipt.lastThreatRemoved,
      });
    },
    lookPlayerDeck: (state, count, continuation) => {
      f.history.push(`look:${count}`);
      state.queue.unshift({
        ...continuation,
        ids: state.player.deck.slice(0, count).map((p) => p.id),
      });
    },
    addDeckCardToHand: (state, id) => {
      const i = state.player.deck.findIndex((p) => p.id === id);
      if (i >= 0) state.player.hand.push(state.player.deck.splice(i, 1)[0]);
      f.history.push(`add:${id}`);
    },
    discardDeckCard: (state, id) => {
      const i = state.player.deck.findIndex((p) => p.id === id);
      if (i >= 0) state.player.discard.push(state.player.deck.splice(i, 1)[0]);
      f.history.push(`discard:${id}`);
    },
    shufflePlayerDeck: (state, after) => {
      f.history.push("shuffle-player");
      state.queue.unshift(...after);
    },
    shuffleEncounter: () => {
      f.history.push("shuffle-encounter");
    },
    enemyTraits: (state, p) =>
      String(state.flags[`traits:${p.id}`] || cards.get(p.code)?.traits || "")
        .split(".")
        .map((x) => x.trim())
        .filter(Boolean),
    attachEncounter: (state, p, targetId) => {
      removeEncounter(p);
      p.attachedTo = targetId;
      state.attachments.push(p);
    },
    giveObligation: (_state, _p, id) => {
      f.history.push(`obligation:${id}`);
    },
    discardEncounter: (state, p) => {
      removeEncounter(p);
      state.encounter.discard.push(p);
    },
    shuffleObligationIntoEncounter: (state, p) => {
      removeEncounter(p);
      state.encounter.deck.push(p);
      f.history.push("shuffle-encounter");
    },
    dealEncounter: (state, id) => {
      const p = state.encounter.deck.shift();
      if (p) {
        p.dealtTo = id;
        state.encounter.dealt.push(p);
      }
      f.history.push(`deal:${id}`);
    },
    dealBoostCard: (state, p, id) => {
      removeEncounter(p);
      p.dealtTo = id;
      state.encounter.dealt.push(p);
    },
    enemyScheme: (state, id, continuation) => {
      const p = state.minions.find((p) => p.id === id)!;
      if (p.confused) p.confused = false;
      else
        state.scheme.threat +=
          (cards.get(p.code)?.scheme || 0) +
          ironheartEnemyStats(state, p).scheme;
      f.history.push(`scheme:${id}`);
      state.queue.unshift(continuation);
    },
    placeThreat: (state, id, amount) => {
      state.sideSchemes.find((p) => p.id === id)!.counters += amount;
      f.history.push(`threat:${id}:${amount}`);
    },
    revealEncounter: (state, p, after) => {
      if (cards.get(p.code)?.type_code === "minion") state.minions.push(p);
      else {
        p.counters = cards.get(p.code)?.base_threat || 0;
        state.sideSchemes.push(p);
      }
      state.queue.unshift(...after);
    },
  };
  ironheartInitialize(s, f.ports);
  const run = () => {
    let n = 0;
    while (s.queue.length && !s.prompt) {
      if (++n > 200) throw Error("Ironheart fixture queue did not settle.");
      const e = s.queue.shift()!;
      if (resolveIronheartEffect(s, e, f.ports)) continue;
      if (e.type === "optional") {
        s.prompt = {
          kind: "choice",
          title: e.title,
          text: e.text,
          options: [
            { id: "yes", label: "Yes", effects: e.effects },
            { id: "no", label: "No", effects: [] },
          ],
        };
        continue;
      }
      if (e.type === "draw")
        for (let i = 0; i < e.amount; i++) {
          const p = s.player.deck.shift();
          if (p) s.player.hand.push(p);
          f.history.push("draw");
        }
      else if (e.type === "ready") s.player.exhausted = false;
      else if (e.type === "status") {
        const p = target(e.target);
        if (p) p[e.status as "tough"] = true;
      } else if (e.type === "damage") {
        f.packets.push(e);
        damage(e.target, e.amount);
      } else if (e.type === "thwart") {
        f.packets.push(e);
        thwart(e.target, e.amount);
      } else if (e.type === "heal")
        s.player.hp = Math.min(
          10 + ironheartSignatureHPBonus(s, f.ports),
          s.player.hp + e.amount,
        );
      else if (e.type === "surge") f.history.push("surge");
      else if (e.type === "fixture-flip") s.player.form = "hero";
      else if (e.type === "marker") f.history.push(e.value);
      else throw Error(`Unknown fixture effect ${e.type}`);
    }
  };
  const enqueue = (...effects: Effect[]) => {
    s.queue.unshift(...effects);
    run();
  };
  const choose = (id: string) => {
    const option = s.prompt?.options.find((o) => o.id === id);
    if (!option) throw Error(`Missing choice ${id}`);
    s.prompt = null;
    enqueue(...option.effects);
  };
  const play = (code: string, id?: string) => {
    enqueue(...ironheartEvent(s, make(code), {}, id)!);
  };
  const ability = (id: string) => {
    ironheartAbility(s, id, f.ports);
    run();
  };
  const add = (code: string) => {
    const p = make(code);
    s.player.inPlay.push(p);
    return p;
  };
  const level = (to: 2 | 3) => {
    s.player.ironheartIdentity!.counters = 7;
    s.player.form = "hero";
    ability("hero");
    expect(ironheartVersion(s)).toBe(to);
  };
  return Object.assign(f, { run, enqueue, choose, play, ability, add, level });
}

describe("Ironheart's original physical identity and three printed versions", () => {
  it("owns all identity/signature/obligation/nemesis faces without box modular cards", () => {
    expect(IRONHEART_SCRIPT_CODES).toHaveLength(21);
    expect(IRONHEART_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(IRONHEART_SCRIPT_CODES.some((code) => code >= "29036")).toBe(false);
  });
  it("keeps the original forty-card starter and fifteen signature cards", () => {
    const starter = decks.find((d) => d.heroCode === "29001a")!;
    expect(Object.values(starter.cards).reduce((a, b) => a + b, 0)).toBe(40);
    expect(
      Object.entries(starter.cards)
        .filter(([code]) => cards.get(code)?.set_code === "ironheart")
        .reduce((n, [, count]) => n + count, 0),
    ).toBe(15);
  });
  it("allocates three physical linked identities and five original nemeses outside the draw deck", () => {
    const { s } = fixture();
    expect(s.player.ironheartIdentity?.code).toBe("29001a");
    expect(s.player.setAside?.map((p) => p.code)).toEqual([
      "29002a",
      "29003a",
      "29029",
      "29030",
      "29031",
      "29032",
      "29032",
    ]);
    expect(
      new Set([
        s.player.ironheartIdentity!.id,
        ...s.player.setAside!.map((p) => p.id),
      ]).size,
    ).toBe(8);
    expect(s.player.deck).toEqual([]);
  });
  it("does not duplicate setup when loading the same saved physical pieces", () => {
    const f = fixture();
    const ids = f.s.player.setAside!.map((p) => p.id);
    ironheartInitialize(f.s, f.ports);
    expect(f.s.player.setAside!.map((p) => p.id)).toEqual(ids);
  });
  it("derives Version 1 from its actual physical card even when a legacy numeric flag is stale", () => {
    const f = fixture();
    f.s.flags.ironheartVersion = 3;
    expect(ironheartVersion(f.s)).toBe(1);
    expect(ironheartIdentityCode(f.s)).toBe("29001a");
  });
  it.each([
    [1, 1, 4],
    [2, 2, 5],
    [3, 3, 6],
  ])(
    "uses original Version %i's THW %i and hand size %i",
    (version, thw, hand) => {
      const f = fixture();
      if (version >= 2) f.level(2);
      if (version === 3) f.level(3);
      const c = cards.get(ironheartIdentityCode(f.s))!;
      expect([c.health, c.attack, c.defense, c.thwart, c.hand_size]).toEqual([
        10,
        2,
        3,
        thw,
        hand,
      ]);
      expect(cards.get(ironheartIdentityCode(f.s, "alter"))?.hand_size).toBe(6);
      expect(cards.get(ironheartIdentityCode(f.s, "alter"))?.recover).toBe(3);
    },
  );
  it("conserves all physical identity IDs and moves surplus progress/status/attached cards on Level Up", () => {
    const f = fixture();
    const initial = [f.s.player.ironheartIdentity!, ...f.s.player.setAside!]
      .map((p) => p.id)
      .sort();
    const original = f.s.player.ironheartIdentity!;
    original.counters = 9;
    original.storedCards = [f.make("29009")];
    original.tough = true;
    f.s.player.hp = 4;
    f.s.player.exhausted = true;
    f.s.player.stunned = true;
    f.s.player.confused = true;
    const attachment = f.make("29031");
    attachment.attachedTo = original.id;
    f.s.attachments.push(attachment);
    f.ability("hero");
    expect(ironheartProgress(f.s)).toBe(3);
    expect(f.s.player.hp).toBe(4);
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.stunned && f.s.player.confused).toBe(true);
    expect(ironheartIdentityPiece(f.s)?.storedCards?.[0].code).toBe("29009");
    expect(attachment.attachedTo).toBe(f.s.player.ironheartIdentity!.id);
    expect(
      [f.s.player.ironheartIdentity!, ...f.s.player.setAside!]
        .map((p) => p.id)
        .sort(),
    ).toEqual(initial);
    expect(
      f.s.player.setAside!.find((p) => p.id === original.id)?.counters,
    ).toBe(0);
  });
  it("Version 2 grants tough and upgrades even if already ready or already tough", () => {
    const f = fixture();
    f.level(2);
    f.s.player.tough = true;
    f.s.player.exhausted = false;
    f.level(3);
    expect(f.s.player.tough).toBe(true);
    expect(ironheartProgress(f.s)).toBe(1);
  });
  it("cannot spend nonexistent progress or replace a missing actual next version", () => {
    const f = fixture();
    f.s.player.ironheartIdentity!.counters = 5;
    expect(ironheartAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.s.player.ironheartIdentity!.counters = 6;
    f.s.player.setAside = f.s.player.setAside!.filter(
      (p) => p.code !== "29002a",
    );
    expect(() => f.ability("hero")).toThrow(/unavailable/);
    expect(ironheartProgress(f.s)).toBe(6);
  });
  it("continues a paid swap in alter ego if an intervening native effect changed form", () => {
    const f = fixture();
    f.s.player.ironheartIdentity!.counters = 7;
    resolveIronheartEffect(f.s, I("level-up"), f.ports);
    f.s.player.form = "alter";
    f.run();
    expect(ironheartVersion(f.s)).toBe(2);
    expect(ironheartIdentityCode(f.s)).toBe("29002b");
  });
});

describe("Ironheart's ability costs, physical limits, and resource SPEND responses", () => {
  it("Version 1 Child Prodigy requests one mental and gains progress only after actual payment", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.ability("hero");
    expect(f.history).toContain("pay:1:mental");
    expect(ironheartProgress(f.s)).toBe(1);
    expect(ironheartAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
  });
  it("Child Prodigy cancellation pays no counter, preserves the limit, and can be retried", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.cancelPayment = true;
    f.ability("hero");
    expect(ironheartProgress(f.s)).toBe(0);
    expect(ironheartAbilityOptions(f.s, "hero", f.ports)).toHaveLength(1);
  });
  it("preserves a used limit across ordinary flips on the same physical identity", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.ability("hero");
    f.s.player.form = "hero";
    f.s.player.form = "alter";
    expect(ironheartAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.s.round++;
    expect(ironheartAbilityOptions(f.s, "hero", f.ports)).toHaveLength(1);
  });
  it("a different physical version has its own Child Prodigy limit", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.ability("hero");
    f.level(2);
    f.s.player.form = "alter";
    expect(ironheartAbilityOptions(f.s, "hero", f.ports)).toHaveLength(1);
    f.ability("hero");
    f.choose("any");
    expect(f.history).toContain("pay:2:");
  });
  it("Version 2 permits mental-one or any-two and Version 3 permits any-one", () => {
    const f = fixture();
    f.level(2);
    f.s.player.form = "alter";
    f.ability("hero");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["mental", "any"]);
    f.choose("mental");
    f.level(3);
    f.s.player.form = "alter";
    f.ability("hero");
    expect(f.history).toContain("pay:1:");
  });
  it("does not recheck an alter-ego qualifier after resource responses change form", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.paymentFlip = true;
    f.ability("hero");
    expect(f.s.player.form).toBe("hero");
    expect(ironheartProgress(f.s)).toBe(1);
  });
  it("blanked identity text hides and rejects identity actions", () => {
    const f = fixture();
    f.s.flags.blankIdentity = true;
    f.s.player.ironheartIdentity!.counters = 8;
    expect(ironheartAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    expect(() => f.ability("hero")).toThrow();
  });
  it("Stroke of Genius is optional and needs a true spend token by its actual owner", () => {
    const f = fixture();
    const p = f.make("29009");
    f.s.player.deck.push(f.make("01088"));
    expect(
      ironheartResourceCardSpent(f.s, { token: "", playerId: "p1", piece: p }),
    ).toEqual([]);
    expect(
      ironheartResourceCardSpent(f.s, {
        token: "spend:1",
        playerId: "p2",
        piece: p,
      }),
    ).toEqual([]);
    f.enqueue(
      ...ironheartResourceCardSpent(f.s, {
        token: "spend:1",
        playerId: "p1",
        piece: p,
      }),
    );
    f.choose("yes");
    expect(ironheartProgress(f.s)).toBe(1);
    expect(f.s.player.hand).toHaveLength(1);
    expect(
      ironheartResourceCardSpent(f.s, {
        token: "spend:1",
        playerId: "p1",
        piece: p,
      }),
    ).toEqual([]);
  });
  it("passing Stroke of Genius draws nothing and awards no progress", () => {
    const f = fixture();
    f.enqueue(
      ...ironheartResourceCardSpent(f.s, {
        token: "zero-cost-spend",
        playerId: "p1",
        piece: f.make("29009"),
      }),
    );
    f.choose("no");
    expect(ironheartProgress(f.s)).toBe(0);
    expect(f.history).not.toContain("draw");
  });
  it("supports two distinct actual spent copies without merging their responses", () => {
    const f = fixture();
    const a = f.make("29009"),
      b = f.make("29009");
    f.enqueue(
      ...ironheartResourceCardSpent(f.s, {
        token: `spend:${a.id}`,
        playerId: "p1",
        piece: a,
      }),
      ...ironheartResourceCardSpent(f.s, {
        token: `spend:${b.id}`,
        playerId: "p1",
        piece: b,
      }),
    );
    f.choose("yes");
    f.choose("yes");
    expect(ironheartProgress(f.s)).toBe(2);
  });
  it("does not expose Stroke of Genius as an extra resource-generating ability", () => {
    const f = fixture();
    f.s.player.hand.push(f.make("29009"));
    expect(ironheartResourceSources(f.s)).toEqual([]);
  });
  it("Brawn's printed signature stats differ from the earlier aggression ally", () => {
    expect([
      cards.get("29004")?.attack,
      cards.get("29004")?.thwart,
      cards.get("29004")?.health,
    ]).toEqual([3, 2, 3]);
  });
  it("Brawn generates mental only while exhausted and once per phase", () => {
    const f = fixture();
    const p = f.add("29004");
    expect(ironheartResourceSources(f.s)).toEqual([]);
    p.exhausted = true;
    expect(ironheartResourceSources(f.s)[0].resources).toEqual(["mental"]);
    expect(ironheartResourceSpent(f.s, p.id)).toBe(true);
    expect(ironheartResourceSources(f.s)).toEqual([]);
    p.exhausted = false;
    p.exhausted = true;
    expect(() => ironheartResourceSpent(f.s, p.id)).toThrow(/once per phase/);
    f.s.phase = "villain";
    expect(ironheartResourceSources(f.s)).toHaveLength(1);
  });
  it("blanking Brawn removes his resource ability", () => {
    const f = fixture();
    const p = f.add("29004");
    p.exhausted = true;
    f.s.flags[`blank:${p.id}`] = true;
    expect(ironheartResourceSources(f.s, undefined, f.ports)).toEqual([]);
    expect(() =>
      ironheartResourceSpent(f.s, p.id, undefined, f.ports),
    ).toThrow();
  });
});

describe("Ironheart's event resolution and version-dependent signatures", () => {
  it.each([
    ["29005", "thwart"],
    ["29006", "attack"],
    ["29007", undefined],
    ["29008", undefined],
  ])("classifies %s correctly", (code, action) => {
    const f = fixture();
    expect(ironheartEventAction(f.make(code))).toBe(action);
  });
  it("Photon Beam deals four and places two progress only for this attack's defeat", () => {
    const f = fixture();
    const p = f.make("29030");
    f.s.minions.push(p);
    f.play("29006", p.id);
    expect(f.packets[0].amount).toBe(4);
    expect(ironheartProgress(f.s)).toBe(2);
  });
  it("Photon Beam hitting tough places one, not two, progress", () => {
    const f = fixture();
    const p = f.make("29030");
    p.tough = true;
    f.s.minions.push(p);
    f.play("29006", p.id);
    expect(p.damage).toBe(0);
    expect(p.tough).toBe(false);
    expect(ironheartProgress(f.s)).toBe(1);
  });
  it("uses the actual attack's defeat receipt rather than inferring another effect's removed enemy", () => {
    const f = fixture();
    const p = f.make("29030");
    f.s.minions.push(p);
    f.actualAttackDefeat = false;
    f.play("29006", p.id);
    expect(f.s.minions).toEqual([]);
    expect(ironheartProgress(f.s)).toBe(1);
  });
  it("Stun replaces Photon Beam's entire attack ability including progress", () => {
    const f = fixture();
    f.s.player.stunned = true;
    f.play("29006");
    expect(f.s.player.stunned).toBe(false);
    expect(f.packets).toEqual([]);
    expect(ironheartProgress(f.s)).toBe(0);
  });
  it("Fly Over removes three and places two progress if it removes the last threat", () => {
    const f = fixture();
    f.s.scheme.threat = 2;
    f.play("29005", "main");
    expect(f.s.scheme.threat).toBe(0);
    expect(ironheartProgress(f.s)).toBe(2);
  });
  it("Fly Over leaves excess threat and places one progress", () => {
    const f = fixture();
    f.play("29005", "main");
    expect(f.s.scheme.threat).toBe(3);
    expect(ironheartProgress(f.s)).toBe(1);
  });
  it("Fly Over needs this thwart's last-threat receipt rather than an empty-afterwards scheme", () => {
    const f = fixture();
    f.s.scheme.threat = 1;
    f.actualLastThreat = false;
    f.play("29005", "main");
    expect(ironheartProgress(f.s)).toBe(1);
  });
  it("Confuse replaces all of Fly Over's thwart ability and its progress", () => {
    const f = fixture();
    f.s.player.confused = true;
    f.play("29005");
    expect(f.s.player.confused).toBe(false);
    expect(f.s.scheme.threat).toBe(6);
    expect(ironheartProgress(f.s)).toBe(0);
  });
  it("permits a stunned/confused event for status replacement without an eligible target", () => {
    const f = fixture();
    f.s.player.stunned = true;
    f.ports.enemyTargets = () => [];
    expect(ironheartPlayRestriction(f.s, f.make("29006"), f.ports)).toBeNull();
    f.s.player.confused = true;
    f.ports.schemeTargets = () => [];
    expect(ironheartPlayRestriction(f.s, f.make("29005"), f.ports)).toBeNull();
  });
  it("checks hero form at PLAY initiation but still resolves after costs changed it", () => {
    const f = fixture();
    f.s.player.form = "alter";
    expect(ironheartPlayRestriction(f.s, f.make("29006"), f.ports)).toMatch(
      /hero form/,
    );
    f.play("29006", "villain");
    expect(f.s.villain.hp).toBe(36);
    expect(ironheartProgress(f.s)).toBe(1);
  });
  it("resolves remaining progress if a legal target disappeared after payment", () => {
    const f = fixture();
    f.ports.enemyTargets = () => [];
    f.play("29006");
    expect(ironheartProgress(f.s)).toBe(1);
    expect(f.packets).toEqual([]);
  });
  it.each([1, 2, 3])(
    "Sector Scan reduces by Version %i and expires at round end",
    (version) => {
      const f = fixture();
      if (version >= 2) f.level(2);
      if (version === 3) f.level(3);
      expect(ironheartCostReduction(f.s, f.make("29008"))).toBe(version);
      f.play("29008");
      expect(ironheartEncounterTopVisible(f.s)).toBe(true);
      f.s.round++;
      expect(ironheartEncounterTopVisible(f.s)).toBe(false);
    },
  );
  it("New and Improved chooses one option at Version 1 and does not auto-select others", () => {
    const f = fixture();
    f.s.player.exhausted = true;
    f.play("29007");
    f.choose("ready");
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.tough).toBe(false);
  });
  it("New and Improved chooses three distinct options, actually adds a signature, and shuffles", () => {
    const f = fixture();
    f.level(2);
    f.level(3);
    f.s.player.exhausted = true;
    const sig = f.make("29009"),
      other = f.make("01088");
    f.s.player.deck.push(sig, other);
    f.play("29007");
    f.choose("ready");
    expect(f.s.prompt?.options.some((o) => o.id === "ready")).toBe(false);
    f.choose("tough");
    f.choose("search");
    expect(f.s.prompt?.options.some((o) => o.id === other.id)).toBe(false);
    f.choose(sig.id);
    expect(f.s.player.hand).toContain(sig);
    expect(f.history).toContain("shuffle-player");
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.player.tough).toBe(true);
  });
  it("New and Improved can fail its search and still shuffles the actual deck", () => {
    const f = fixture();
    f.s.player.deck.push(f.make("01088"));
    f.play("29007");
    f.choose("search");
    f.choose("no-card");
    expect(f.s.player.hand).toEqual([]);
    expect(f.history).toContain("shuffle-player");
  });
  it("Ronnie is alter-ego only and exhausts the actual support to place progress", () => {
    const f = fixture();
    const p = f.add("29010");
    expect(ironheartAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    f.ability(p.id);
    f.choose("progress");
    expect(p.exhausted).toBe(true);
    expect(ironheartProgress(f.s)).toBe(1);
  });
  it("Ronnie heals at most two up to the actual modified hit-point maximum", () => {
    const f = fixture();
    const p = f.add("29010");
    f.add("29012");
    f.s.player.hp = 11;
    f.s.player.form = "alter";
    f.ability(p.id);
    f.choose("heal");
    expect(f.s.player.hp).toBe(12);
  });
  it("Tony adds one of the two actual top cards and discards the other without a draw", () => {
    const f = fixture();
    const t = f.add("29011"),
      a = f.make("29009"),
      b = f.make("01088"),
      c = f.make("01089");
    f.s.player.deck.push(a, b, c);
    f.ability(t.id);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    f.choose(b.id);
    expect(f.s.player.hand).toEqual([b]);
    expect(f.s.player.discard).toEqual([a]);
    expect(f.s.player.deck).toEqual([c]);
    expect(f.history).not.toContain("draw");
    expect(ironheartProgress(f.s)).toBe(0);
  });
  it("Tony looks at one remaining card without inventing a reset or extra discard", () => {
    const f = fixture();
    const t = f.add("29011"),
      a = f.make("01088");
    f.s.player.deck.push(a);
    f.ability(t.id);
    f.choose(a.id);
    expect(f.s.player.hand).toEqual([a]);
    expect(f.s.player.discard).toEqual([]);
    expect(f.history).not.toContain("shuffle-player");
  });
  it.each([1, 2, 3])(
    "Photon Blasters and Propulsion Jets use Version %i without being attack/thwart actions",
    (version) => {
      const f = fixture();
      if (version >= 2) f.level(2);
      if (version === 3) f.level(3);
      const a = f.add("29012"),
        b = f.add("29013");
      f.s.player.stunned = true;
      f.s.player.confused = true;
      f.ability(a.id);
      f.ability(b.id);
      expect(f.s.villain.hp).toBe(40 - version);
      expect(f.s.scheme.threat).toBe(6 - version);
      expect(f.s.player.stunned && f.s.player.confused).toBe(true);
      expect(f.packets.every((e) => e.type !== "attack" && !e.action)).toBe(
        true,
      );
    },
  );
  it("Photon Blasters and Propulsion Jets contribute two hit points each while unblanked", () => {
    const f = fixture();
    const a = f.add("29012");
    f.add("29013");
    expect(ironheartSignatureHPBonus(f.s, f.ports)).toBe(4);
    f.s.flags[`blank:${a.id}`] = true;
    expect(ironheartSignatureHPBonus(f.s, f.ports)).toBe(2);
  });
  it("Maximum Efficiency spends one progress for nonattack damage and ignores Stun", () => {
    const f = fixture();
    f.level(2);
    f.level(3);
    f.s.player.stunned = true;
    f.ability("hero");
    expect(ironheartProgress(f.s)).toBe(0);
    expect(f.s.villain.hp).toBe(38);
    expect(f.s.player.stunned).toBe(true);
    expect(f.packets[0].attack).toBeUndefined();
  });
});

describe("Ironheart's obligation and original five physical nemeses", () => {
  it("A Minor Setback removes one actual progress then discards the same obligation", () => {
    const f = fixture();
    const p = f.make("29028");
    f.s.resolving.push(p);
    f.s.player.ironheartIdentity!.counters = 2;
    f.enqueue(...ironheartEncounterReveal(f.s, p)!);
    expect(ironheartProgress(f.s)).toBe(1);
    expect(f.s.encounter.discard).toContain(p);
    expect(f.history).not.toContain("deal:p1");
  });
  it("A Minor Setback with no progress deals one encounter before shuffling that same obligation", () => {
    const f = fixture();
    const p = f.make("29028"),
      next = f.make("01100");
    f.s.resolving.push(p);
    f.s.encounter.deck.push(next);
    f.enqueue(...ironheartEncounterReveal(f.s, p)!);
    expect(f.s.encounter.dealt).toEqual([next]);
    expect(f.s.encounter.deck).toContain(p);
    expect(f.s.encounter.discard).not.toContain(p);
    expect(f.history.indexOf("deal:p1")).toBeLessThan(
      f.history.indexOf("shuffle-encounter"),
    );
  });
  it("Rule by Force has hazard with Lucia present and acceleration without her, even if Lucia is blanked", () => {
    const f = fixture();
    const scheme = f.make("29029"),
      lucia = f.make("29030");
    expect(ironheartSchemeIcons(f.s, scheme, f.ports)).toEqual({
      hazard: 0,
      acceleration: 1,
    });
    f.s.minions.push(lucia);
    f.s.flags[`blank:${lucia.id}`] = true;
    expect(ironheartSchemeIcons(f.s, scheme, f.ports)).toEqual({
      hazard: 1,
      acceleration: 0,
    });
    f.s.flags[`blank:${scheme.id}`] = true;
    expect(ironheartSchemeIcons(f.s, scheme, f.ports)).toEqual({
      hazard: 0,
      acceleration: 0,
    });
  });
  it("Lucia's +1 SCH/+1 ATK requires her tough status and unblanked text", () => {
    const f = fixture();
    const p = f.make("29030");
    expect(ironheartEnemyStats(f.s, p, f.ports).attack).toBe(0);
    p.tough = true;
    expect(ironheartEnemyStats(f.s, p, f.ports)).toEqual({
      attack: 1,
      scheme: 1,
      health: 0,
    });
    f.s.flags[`blank:${p.id}`] = true;
    expect(ironheartEnemyStats(f.s, p, f.ports).scheme).toBe(0);
  });
  it("Lucia gets tough after villain phase end, never from a canceled unrelated activation", () => {
    const f = fixture();
    const p = f.make("29030");
    f.s.minions.push(p);
    f.enqueue(...ironheartVillainPhaseEnded(f.s, f.ports));
    expect(p.tough).toBe(true);
    expect(ironheartVillainPhaseEnded(f.s, f.ports)).toEqual([]);
  });
  it("Cyborg Tech attaches to the minion with the most effective traits and adds three hit points plus retaliate", () => {
    const f = fixture();
    const a = f.make("29030"),
      b = f.make("drone"),
      p = f.make("29031");
    f.s.minions.push(a, b);
    f.s.flags[`traits:${b.id}`] = "Drone. Robot. Elite. Soldier.";
    f.s.resolving.push(p);
    f.enqueue(...ironheartEncounterReveal(f.s, p)!);
    expect(p.attachedTo).toBe(b.id);
    expect(ironheartEnemyStats(f.s, b, f.ports).health).toBe(3);
    expect(ironheartEnemyKeywords(f.s, b, f.ports).retaliate).toBe(1);
    f.s.flags[`blank:${p.id}`] = true;
    expect(ironheartEnemyStats(f.s, b, f.ports).health).toBe(0);
  });
  it("Cyborg Tech counts distinct traits and lets the revealer choose among actual ties", () => {
    const f = fixture();
    const a = f.make("29030"),
      b = f.make("drone"),
      p = f.make("29031");
    f.s.minions.push(a, b);
    f.s.flags[`traits:${a.id}`] = "Drone. Robot. Robot.";
    f.s.flags[`traits:${b.id}`] = "Soldier. Robot.";
    f.enqueue(...ironheartEncounterReveal(f.s, p)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    f.choose(a.id);
    expect(p.attachedTo).toBe(a.id);
  });
  it("Cyborg Tech surges if no minion is available", () => {
    const f = fixture();
    f.enqueue(...ironheartEncounterReveal(f.s, f.make("29031"))!);
    expect(f.history).toContain("surge");
  });
  it("Cyborg Tech's boost deals that same physical card, without creating a copy", () => {
    const f = fixture();
    const p = f.make("29031");
    f.s.resolving.push(p);
    f.enqueue(...ironheartBoost(f.s, p)!);
    expect(f.s.encounter.dealt).toEqual([p]);
    expect(f.s.resolving).toEqual([]);
    expect(p.dealtTo).toBe("p1");
  });
  it("Political Retribution resolves both scheme and threat clauses in their printed order", () => {
    const f = fixture();
    const a = f.make("29030"),
      b = f.make("29029");
    a.tough = true;
    b.counters = 4;
    f.s.minions.push(a);
    f.s.sideSchemes.push(b);
    f.enqueue(...ironheartEncounterReveal(f.s, f.make("29032"))!);
    expect(f.s.scheme.threat).toBe(9);
    expect(b.counters).toBe(7);
    expect(f.history.indexOf(`scheme:${a.id}`)).toBeLessThan(
      f.history.indexOf(`threat:${b.id}:3`),
    );
  });
  it("Political Retribution still adds side-scheme threat when Lucia's scheme is replaced by Confuse", () => {
    const f = fixture();
    const a = f.make("29030"),
      b = f.make("29029");
    a.confused = true;
    b.counters = 4;
    f.s.minions.push(a);
    f.s.sideSchemes.push(b);
    f.enqueue(...ironheartEncounterReveal(f.s, f.make("29032"))!);
    expect(a.confused).toBe(false);
    expect(f.s.scheme.threat).toBe(6);
    expect(b.counters).toBe(7);
  });
  it("Political Retribution surges only when neither printed nemesis is in play", () => {
    const f = fixture();
    f.enqueue(...ironheartEncounterReveal(f.s, f.make("29032"))!);
    expect(f.history).toContain("surge");
  });
  it("Shadows of the Past moves original nemeses and leaves all reserved identity versions untouched", () => {
    const f = fixture();
    const identities = f.s.player.setAside!.filter((p) => p.code.endsWith("a"));
    const nem = f.s.player
      .setAside!.filter((p) => !p.code.endsWith("a"))
      .map((p) => p.id)
      .sort();
    f.enqueue(...ironheartShadowOfPast(f.s)!);
    expect(f.s.player.setAside).toEqual(identities);
    expect(
      [...f.s.minions, ...f.s.sideSchemes, ...f.s.encounter.deck]
        .map((p) => p.id)
        .sort(),
    ).toEqual(nem);
    expect(f.s.encounter.deck.map((p) => p.code)).toEqual([
      "29031",
      "29032",
      "29032",
    ]);
    f.enqueue(...ironheartShadowOfPast(f.s)!);
    expect(f.history).toContain("surge");
  });
  it("unrelated card hooks decline without intercepting existing native modules", () => {
    const f = fixture();
    const p = f.make("01088");
    expect(ironheartEvent(f.s, p)).toBeNull();
    expect(ironheartEncounterReveal(f.s, p)).toBeNull();
    expect(ironheartBoost(f.s, p)).toBeNull();
    expect(
      resolveIronheartEffect(f.s, { type: "draw", amount: 1 }, f.ports),
    ).toBe(false);
  });
});
