import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { activateSeat, playerOrder, seatView } from "../src/game/team";
import type { Card, Effect, Piece } from "../src/game/types";
import {
  MANSION_ATTACK_SCRIPT_CODES,
  MANSION_ATTACK_SET,
  mansionAttackAfterEnemyAttack,
  mansionAttackBoost,
  mansionAttackCheckOutcome,
  mansionAttackMainCompleted,
  mansionAttackMainThreatLimit,
  mansionAttackModifiers,
  mansionAttackReveal,
  mansionAttackSetup,
  mansionAttackSideSchemeBaseThreat,
  mansionAttackSideSchemeDefeated,
  mansionAttackVillainDefeated,
  resolveMansionAttackEffect,
  type MansionAttackEnemyAttackReceipt,
  type MansionAttackGameState,
  type MansionAttackPorts,
} from "../src/game/mansion-attack";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const piece = (code: string, id = `original-${code}`): Piece => ({
  code,
  id,
  damage: 0,
  counters: 0,
  exhausted: false,
  tough: false,
  stunned: false,
  confused: false,
});
const M = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mansion:${name}`,
  ...args,
});
function fixture(count = 1, difficulty: "standard" | "expert" = "standard") {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    heroId: "spider_man",
    aspect: "justice",
    flags: {},
    eliminated: false,
    ended: false,
    player: {
      form: "hero",
      hp: 10,
      exhausted: false,
      stunned: false,
      hand: [],
      deck: [],
      discard: [],
      inPlay: [],
    },
  }));
  const s = {
    villainId: MANSION_ATTACK_SET,
    difficulty,
    playerCount: count,
    activePlayerId: "p1",
    firstPlayerId: "p1",
    players,
    player: players[0].player,
    flags: players[0].flags,
    phase: "player",
    nextId: 1,
    villain: {
      ...piece("32121a"),
      hp: 15 * count,
      maxHp: 15 * count,
      stage: 1,
    },
    scheme: { code: "32125a", threat: 0, index: 0 },
    sideSchemes: [],
    minions: [],
    attachments: [],
    environments: [],
    resolving: [],
    removed: [],
    victoryDisplay: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    queue: [],
    prompt: null,
  } as unknown as MansionAttackGameState;
  const blank = new Set<string>();
  const events: string[] = [];
  const inputs = {
    villains: ["32121a", "32122a", "32123a", "32124a"].map((c) => piece(c)),
    rooms: ["32126a", "32127a", "32128a", "32129a"].map((c) => piece(c)),
    opening: piece("32125a"),
    saveSchool: piece("32130"),
  };
  const allZones = () => [
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.environments!,
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.resolving,
    s.removed,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.hand, p.deck, p.discard, p.inPlay];
    }),
  ];
  const take = (id: string) => {
    for (const zone of allZones()) {
      const i = zone.findIndex((p) => p.id === id);
      if (i >= 0) return zone.splice(i, 1)[0];
    }
    return undefined;
  };
  const ports: MansionAttackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (_state, p) => blank.has(p.id || p.code) || blank.has(p.code),
    hasTrait: (_state, id, trait) => {
      const p = [s.villain, ...allZones().flat()].find((p) => p.id === id);
      return (
        !!p && (cards.get(p.code)?.traits || "").split(/\.\s*/).includes(trait)
      );
    },
    isEngagedWith: (_state, p, playerId) =>
      (p.engagedWith || "p1") === playerId,
    randomIndex: vi.fn((_state, length) => length - 1),
    putEnvironment: (_state, p) => s.environments!.push(p),
    revealVillain: vi.fn((_state, p, after) => {
      const c = cards.get(p.code)!;
      s.villain = Object.assign(p, {
        hp: c.health! * count,
        maxHp: c.health! * count,
        stage: p.code.endsWith("b") ? 2 : 1,
      });
      s.villain.tough = true;
      s.mansionAttack!.activeVillainRetired = false;
      events.push(`villain:${p.id}:${p.code}`);
      ports.queue(s, ...after);
    }),
    revealMain: vi.fn((_state, p, after) => {
      p.code = p.code.replace(/a$/, "b");
      s.scheme = {
        code: p.code,
        threat: p.code === "32125b" ? 0 : count,
        index: 0,
      };
      events.push(`main:${p.id}:${p.code}`);
      ports.queue(s, ...(mansionAttackReveal(s, p, ports) || []), ...after);
    }),
    addToVictory: vi.fn((_state, p) => {
      if (p.id === s.villain.id) s.mansionAttack!.activeVillainRetired = true;
      s.victoryDisplay!.push(p);
      events.push(`victory:${p.id}`);
    }),
    removeDefeatedVillain: vi.fn((_state, p) => {
      s.mansionAttack!.activeVillainRetired = true;
      s.removed.push(p);
    }),
    dealEncounter: vi.fn((_state, playerId) => {
      const p = s.encounter.deck.shift();
      if (p) {
        p.dealtTo = playerId;
        s.encounter.dealt.push(p);
      }
      events.push(`deal:${playerId}`);
    }),
    win: vi.fn(() => {
      s.phase = "won";
      events.push("won");
    }),
    lose: vi.fn(() => {
      s.phase = "lost";
      events.push("lost");
    }),
    discardPiece: vi.fn((_state, id) => {
      const p = take(id);
      if (p) s.encounter.discard.push(p);
      events.push(`discard:${id}`);
    }),
    activateEnemy: vi.fn((_state, enemyId, playerId, kind) =>
      events.push(`${kind}:${enemyId}:${playerId}`),
    ),
    searchAndRevealMinion: vi.fn((_state, name, playerId, after) => {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (p) =>
          cards.get(p.code)?.type_code === "minion" &&
          cards.get(p.code)?.name === name,
      );
      if (p) {
        take(p.id);
        p.engagedWith = playerId;
        s.minions.push(p);
      }
      events.push(`search:${name}:${playerId}`);
      ports.queue(s, ...after);
    }),
    additionalBoost: vi.fn(() => events.push("boost")),
    exhaustIdentity: vi.fn((_state, playerId) => {
      seatView(s, playerId).player.exhausted = true;
      events.push(`exhaust:${playerId}`);
    }),
    stun: vi.fn((_state, id) => events.push(`stun:${id}`)),
    indirectDamage: vi.fn((_state, playerId, amount) =>
      events.push(`indirect:${playerId}:${amount}`),
    ),
    discardRandomHand: vi.fn((_state, playerId) => {
      const p = seatView(s, playerId).player.hand.shift();
      if (p) seatView(s, playerId).player.discard.push(p);
      events.push(`random-discard:${playerId}`);
    }),
    exhaustAlly: vi.fn((_state, id) => {
      const p = allZones()
        .flat()
        .find((p) => p.id === id);
      if (p) p.exhausted = true;
      events.push(`exhaust-ally:${id}`);
    }),
    discardPlayerTop: vi.fn((_state, playerId, amount, after) => {
      const player = seatView(s, playerId).player;
      const discarded = player.deck.splice(0, amount);
      player.discard.push(...discarded);
      const printedResourceIcons = discarded.reduce((sum, p) => {
        const c = cards.get(p.code)!;
        return (
          sum +
          (c.resource_energy || 0) +
          (c.resource_mental || 0) +
          (c.resource_physical || 0) +
          (c.resource_wild || 0)
        );
      }, 0);
      ports.queue(
        s,
        ...after.map((e: Effect) => ({ ...e, printedResourceIcons })),
      );
    }),
    searchPlayerAlly: vi.fn((_state, playerId) =>
      events.push(`ally-search:${playerId}`),
    ),
    addSideThreat: vi.fn((_state, id, amount) => {
      const p = s.sideSchemes.find((p) => p.id === id);
      if (p) p.counters += amount;
      events.push(`threat:${id}:${amount}`);
    }),
  };
  function drain() {
    let steps = 0;
    while (s.queue.length && !s.prompt && !["won", "lost"].includes(s.phase)) {
      if (++steps > 100) throw Error("Mansion test queue did not settle");
      const effect = s.queue.shift()!;
      if (effect.actorId) {
        activateSeat(s, effect.actorId);
      }
      expect(resolveMansionAttackEffect(s, effect, ports)).toBe(true);
    }
  }
  function start(winTarget?: number) {
    mansionAttackSetup(s, inputs, ports, winTarget);
    drain();
    events.length = 0;
  }
  function run(...effects: Effect[]) {
    ports.queue(s, ...effects);
    drain();
  }
  function choose(index = 0) {
    const option = s.prompt!.options[index];
    s.prompt = null;
    run(...option.effects);
  }
  function setVillain(code: string) {
    Object.assign(s.villain, {
      code,
      hp: cards.get(code)!.health! * count,
      maxHp: cards.get(code)!.health! * count,
    });
  }
  function attack(overrides: Partial<MansionAttackEnemyAttackReceipt> = {}) {
    return {
      token: `attack-${s.nextId++}`,
      enemyId: s.villain.id,
      enemyCode: s.villain.code,
      playerId: "p1",
      performed: true,
      damagedTargets: [],
      ...overrides,
    } satisfies MansionAttackEnemyAttackReceipt;
  }
  function defeat() {
    run(
      ...mansionAttackVillainDefeated(
        s,
        { token: `defeat-${s.nextId++}`, piece: s.villain },
        ports,
      ),
    );
  }
  function complete() {
    run(
      ...mansionAttackMainCompleted(
        s,
        { token: `complete-${s.nextId++}`, schemeCode: s.scheme.code },
        ports,
      ),
    );
  }
  const idsInPlay = () =>
    [
      ...(!s.mansionAttack?.activeVillainRetired ? [s.villain] : []),
      ...allZones().flat(),
      ...(s.victoryDisplay || []),
      ...(s.mansionAttack?.villainDeck || []),
      ...(s.mansionAttack?.mainDeck || []),
      ...(s.mansionAttack?.currentMain ? [s.mansionAttack.currentMain] : []),
    ].map((p) => p.id);
  return {
    s,
    inputs,
    ports,
    events,
    blank,
    start,
    run,
    drain,
    choose,
    setVillain,
    attack,
    defeat,
    complete,
    idsInPlay,
  };
}

describe("Mansion Attack physical setup and objective", () => {
  it("registers every actual scenario face without claiming Brotherhood", () => {
    expect(new Set(MANSION_ATTACK_SCRIPT_CODES)).toEqual(
      new Set(
        (catalog as Card[])
          .filter((c) => c.set_code === MANSION_ATTACK_SET)
          .map((c) => c.code),
      ),
    );
  });
  it.each(["standard", "expert"] as const)(
    "uses four original %s villain sides",
    (difficulty) => {
      const f = fixture(1, difficulty);
      f.start();
      expect(
        [f.s.villain, ...f.s.mansionAttack!.villainDeck].map((p) => p.code),
      ).toEqual(
        ["32121", "32122", "32123", "32124"].map(
          (c) => c + (difficulty === "expert" ? "b" : "a"),
        ),
      );
      expect(f.s.villain.id).toBe(f.inputs.villains[0].id);
    },
  );
  it.each([1, 2, 3, 4])(
    "starts at printed health per hero with %i players",
    (n) => {
      const f = fixture(n);
      f.start();
      expect(f.s.villain.hp).toBe(15 * n);
      expect(f.s.villain.tough).toBe(true);
    },
  );
  it("keeps the opening scheme and eight hidden originals in actual zones", () => {
    const f = fixture();
    const original = [
      ...f.inputs.villains,
      ...f.inputs.rooms,
      f.inputs.opening,
      f.inputs.saveSchool,
    ].map((p) => p.id);
    f.start();
    expect(f.s.victoryDisplay!.map((p) => p.code)).toEqual(["32125b"]);
    expect(f.s.mansionAttack!.currentMain).toBe(f.inputs.rooms[0]);
    expect(f.s.mansionAttack!.villainDeck).toHaveLength(3);
    expect(f.s.mansionAttack!.mainDeck).toHaveLength(3);
    expect(f.idsInPlay().sort()).toEqual(original.sort());
  });
  it("deals a real facedown encounter to each player before exposing the first room", () => {
    const f = fixture(2);
    const cards = [
      piece("32131", "encounter-1"),
      piece("32131", "encounter-2"),
    ];
    f.s.encounter.deck.push(...cards);
    mansionAttackSetup(f.s, f.inputs, f.ports);
    f.drain();
    expect(f.s.encounter.dealt).toEqual(cards);
    expect(cards.map((p) => p.dealtTo)).toEqual(["p1", "p2"]);
    expect(f.events.indexOf("deal:p2")).toBeLessThan(
      f.events.indexOf("main:original-32126a:32126b"),
    );
  });
  it("shuffles both hidden stacks through the seeded host random source", () => {
    const f = fixture();
    f.ports.randomIndex = vi.fn(() => 0);
    f.start();
    expect(f.ports.randomIndex).toHaveBeenCalledTimes(6);
    expect(f.s.villain.code).toBe("32122a");
    expect(f.s.scheme.code).toBe("32127b");
  });
  it("does not shuffle, deal, or duplicate setup when called again after saving", () => {
    const f = fixture();
    f.start();
    const snapshot = JSON.parse(JSON.stringify(f.s));
    mansionAttackSetup(f.s, f.inputs, f.ports);
    expect(f.s).toEqual(snapshot);
    expect(f.events).toEqual([]);
  });
  it("rejects a repeated setup with different original cards", () => {
    const f = fixture();
    f.start();
    f.inputs.villains[0] = piece("32121a", "another-avalanche");
    expect(() => mansionAttackSetup(f.s, f.inputs, f.ports)).toThrow(
      /different physical/,
    );
  });
  it("rejects a missing room without inventing a replacement", () => {
    const f = fixture();
    f.inputs.rooms.pop();
    expect(() => mansionAttackSetup(f.s, f.inputs, f.ports)).toThrow(
      /ten distinct/,
    );
  });
  it.each([
    ["standard", 2],
    ["expert", 3],
  ] as const)(
    "%s wins after the fixed objective of %i villains",
    (difficulty, target) => {
      const f = fixture(4, difficulty);
      f.start();
      expect(f.s.mansionAttack!.winTarget).toBe(target);
      for (let n = 1; n <= target; n++) {
        f.defeat();
        expect(f.s.phase).toBe(n === target ? "won" : "player");
      }
      expect(
        f.s.victoryDisplay!.filter(
          (p) => cards.get(p.code)?.type_code === "villain",
        ),
      ).toHaveLength(target);
    },
  );
  it("a defeated villain enters victory rather than encounter discard", () => {
    const f = fixture();
    f.start();
    const original = f.s.villain;
    f.defeat();
    expect(f.s.victoryDisplay).toContain(original);
    expect(f.s.encounter.discard).not.toContain(original);
    expect(f.s.villain.id).not.toBe(original.id);
  });
  it("deals every surviving player an encounter before revealing the next original villain", () => {
    const f = fixture(3);
    f.start();
    f.s.players[1].eliminated = true;
    f.defeat();
    expect(f.events.filter((e) => e.startsWith("deal:"))).toEqual([
      "deal:p1",
      "deal:p3",
    ]);
    expect(f.events.indexOf("deal:p3")).toBeLessThan(
      f.events.findIndex((e) => e.startsWith("villain:")),
    );
  });
  it("does not deal encounters or expose another villain after victory", () => {
    const f = fixture();
    f.start(1);
    f.defeat();
    expect(f.s.phase).toBe("won");
    expect(
      f.events.some((e) => e.startsWith("deal:") || e.startsWith("villain:")),
    ).toBe(false);
    expect(f.s.mansionAttack!.villainDeck).toHaveLength(3);
  });
  it("defeat receipts remain idempotent after JSON save/load", () => {
    const f = fixture();
    f.start();
    const receipt = { token: "one-actual-defeat", piece: f.s.villain };
    f.run(...mansionAttackVillainDefeated(f.s, receipt, f.ports));
    const before = f.s.victoryDisplay!.length;
    f.s.mansionAttack = JSON.parse(JSON.stringify(f.s.mansionAttack));
    f.run(M("villain-defeated", { receipt }));
    expect(f.s.victoryDisplay).toHaveLength(before);
  });
  it("does not infer a villain defeat from a missing or mismatched source", () => {
    const f = fixture();
    f.start();
    expect(
      mansionAttackVillainDefeated(
        f.s,
        { token: "missing", piece: piece("32122a", "not-active") },
        f.ports,
      ),
    ).toEqual([]);
    expect(f.s.phase).toBe("player");
  });
  it("discards a matching ENGAGED minion then activates the new villain against that player", () => {
    const f = fixture(2);
    f.start();
    const blob = {
      ...piece("32074", "physical-blob-minion"),
      engagedWith: "p2",
    };
    f.s.minions.push(blob);
    f.defeat();
    expect(f.s.encounter.discard).toContain(blob);
    expect(f.events).toContain(`attack:${f.s.villain.id}:p2`);
    expect(f.events.indexOf(`discard:${blob.id}`)).toBeLessThan(
      f.events.indexOf(`attack:${f.s.villain.id}:p2`),
    );
  });
  it("uses a scheme activation against the matched minion's alter-ego player", () => {
    const f = fixture(2);
    f.start();
    seatView(f.s, "p2").player.form = "alter";
    f.s.minions.push({ ...piece("32074"), engagedWith: "p2" });
    f.defeat();
    expect(f.events).toContain(`scheme:${f.s.villain.id}:p2`);
  });
  it("preserves a same-title ally controlled through Karma", () => {
    const f = fixture();
    f.start();
    const ally = piece("32074", "karma-blob");
    f.s.player.inPlay.push(ally);
    f.defeat();
    expect(f.s.player.inPlay).toContain(ally);
    expect(f.events.some((e) => e.startsWith("attack:"))).toBe(false);
  });
  it("does not discard a different Brotherhood minion", () => {
    const f = fixture();
    f.start();
    const pyro = piece("32075");
    f.s.minions.push(pyro);
    f.defeat();
    expect(f.s.minions).toContain(pyro);
  });
});

describe("Mansion Attack rooms", () => {
  it.each([1, 2, 3, 4])(
    "uses fixed 7 per-player room limits at %i players",
    (count) => {
      const f = fixture(count);
      f.start();
      expect(mansionAttackMainThreatLimit(f.s)).toBe(7 * count);
      expect(f.s.scheme.threat).toBe(count);
    },
  );
  it("adds the actual completed room to victory and exposes the next actual front", () => {
    const f = fixture();
    f.start();
    const first = f.s.mansionAttack!.currentMain;
    f.complete();
    expect(f.s.victoryDisplay).toContain(first);
    expect(f.s.mansionAttack!.currentMain).toBe(f.inputs.rooms[1]);
    expect(f.s.scheme.code).toBe("32127b");
    expect(f.s.phase).toBe("player");
  });
  it("loses after two rooms because the opening scheme already counts", () => {
    const f = fixture();
    f.start();
    f.complete();
    f.complete();
    expect(f.s.phase).toBe("lost");
    expect(
      f.s.victoryDisplay!.filter(
        (p) => cards.get(p.code)?.type_code === "main_scheme",
      ),
    ).toHaveLength(3);
    expect(f.s.mansionAttack!.mainDeck).toHaveLength(2);
  });
  it("does not count defeated villains toward the three-main loss", () => {
    const f = fixture();
    f.start(4);
    f.defeat();
    f.defeat();
    f.complete();
    expect(f.s.phase).toBe("player");
  });
  it("suppresses duplicate main-completion receipts", () => {
    const f = fixture();
    f.start();
    const receipt = {
      token: "room-actual-complete",
      schemeCode: f.s.scheme.code,
    };
    const effect = mansionAttackMainCompleted(f.s, receipt, f.ports)[0];
    f.run(effect);
    f.run(effect);
    expect(f.s.phase).toBe("player");
    expect(f.s.victoryDisplay).toHaveLength(2);
  });
  it("rejects a completion receipt for a different room", () => {
    const f = fixture();
    f.start();
    expect(
      mansionAttackMainCompleted(
        f.s,
        { token: "stale", schemeCode: "32128b" },
        f.ports,
      ),
    ).toEqual([]);
  });
  it.each(["01001a", "01050", "32075", "32121a"])(
    "Atrium grants steady to character %s",
    (code) => {
      const f = fixture();
      f.start();
      expect(mansionAttackModifiers(f.s, piece(code), f.ports).steady).toBe(
        true,
      );
    },
  );
  it("supports native identity target strings", () => {
    const f = fixture();
    f.start();
    expect(mansionAttackModifiers(f.s, "hero:p1", f.ports).steady).toBe(true);
  });
  it("Cafeteria grants retaliate 1 to each character", () => {
    const f = fixture();
    f.start();
    f.s.scheme.code = "32127b";
    expect(mansionAttackModifiers(f.s, f.s.villain, f.ports).retaliate).toBe(1);
    expect(mansionAttackModifiers(f.s, "hero", f.ports).retaliate).toBe(1);
  });
  it.each([
    ["01050", true],
    ["32075", true],
    ["01001a", false],
    ["32121a", false],
  ] as const)("Basketball Court toughness eligibility %s", (code, expected) => {
    const f = fixture();
    f.start();
    f.s.scheme.code = "32128b";
    expect(mansionAttackModifiers(f.s, piece(code), f.ports).toughness).toBe(
      expected,
    );
  });
  it("a new Basketball Court does not retroactively grant existing cards tough", () => {
    const f = fixture();
    f.start();
    const ally = piece("01050");
    f.s.player.inPlay.push(ally);
    f.s.scheme.code = "32128b";
    mansionAttackModifiers(f.s, ally, f.ports);
    expect(ally.tough).toBe(false);
  });
  it("Courtyard grants exactly +1 ATK to characters", () => {
    const f = fixture();
    f.start();
    f.s.scheme.code = "32129b";
    expect(mansionAttackModifiers(f.s, "hero", f.ports).attack).toBe(1);
    expect(mansionAttackModifiers(f.s, f.s.villain, f.ports).attack).toBe(1);
  });
  it("blanking a room suppresses its continuous keyword", () => {
    const f = fixture();
    f.start();
    f.blank.add(f.s.mansionAttack!.currentMain!.id);
    expect(mansionAttackModifiers(f.s, "hero", f.ports).steady).toBe(false);
  });
});

describe("Mansion Attack villain attack responses", () => {
  it("Avalanche exhausts a ready controlled ally even if attack dealt no damage", () => {
    const f = fixture();
    f.start();
    const ally = piece("01050");
    f.s.player.inPlay.push(ally);
    f.run(...mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports));
    expect(ally.exhausted).toBe(true);
  });
  it("Avalanche lets the attacked player choose which ally to exhaust", () => {
    const f = fixture(2);
    f.start();
    const ally1 = piece("01050"),
      ally2 = piece("01051");
    seatView(f.s, "p2").player.inPlay.push(ally1, ally2);
    f.run(
      ...mansionAttackAfterEnemyAttack(
        f.s,
        f.attack({ playerId: "p2" }),
        f.ports,
      ),
    );
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([ally1.id, ally2.id]);
    f.choose(1);
    expect(ally1.exhausted).toBe(false);
    expect(ally2.exhausted).toBe(true);
    expect(f.s.activePlayerId).toBe("p2");
  });
  it("Avalanche cannot exhaust another player's ally", () => {
    const f = fixture(2);
    f.start();
    seatView(f.s, "p2").player.inPlay.push(piece("01050"));
    f.run(...mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports));
    expect(f.ports.exhaustAlly).not.toHaveBeenCalled();
  });
  it("Blob stuns each actually damaged character including Overkill hero", () => {
    const f = fixture();
    f.start();
    f.setVillain("32122a");
    f.run(
      ...mansionAttackAfterEnemyAttack(
        f.s,
        f.attack({
          damagedTargets: [
            { targetId: "defeated-ally", actualDamage: 2, playerId: "p1" },
            { targetId: "hero:p1", actualDamage: 1, playerId: "p1" },
          ],
        }),
        f.ports,
      ),
    );
    expect(f.events).toEqual(["stun:defeated-ally", "stun:hero:p1"]);
  });
  it("Blob does not stun for prevented or separate boost damage", () => {
    const f = fixture();
    f.start();
    f.setVillain("32122b");
    expect(
      mansionAttackAfterEnemyAttack(
        f.s,
        f.attack({
          damagedTargets: [
            { targetId: "hero:p1", actualDamage: 0, playerId: "p1" },
          ],
        }),
        f.ports,
      ),
    ).toEqual([]);
  });
  it("Pyro counts all printed icons on actual discarded cards", () => {
    const f = fixture();
    f.start();
    f.setVillain("32123a");
    const cards = [piece("01088"), piece("01089")];
    f.s.player.deck.push(...cards);
    f.run(...mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports));
    expect(f.s.player.discard).toEqual(cards);
    expect(f.events).toContain("indirect:p1:4");
  });
  it("Pyro's zero attack still triggers its response", () => {
    const f = fixture();
    f.start();
    f.setVillain("32123a");
    f.s.player.deck.push(piece("01085"));
    f.run(...mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports));
    expect(f.ports.discardPlayerTop).toHaveBeenCalled();
    expect(f.events).toContain("indirect:p1:1");
  });
  it("Pyro does not invent resources if there are no cards to discard", () => {
    const f = fixture();
    f.start();
    f.setVillain("32123a");
    f.run(...mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports));
    expect(f.ports.indirectDamage).not.toHaveBeenCalled();
  });
  it("Toad discards once after damaging multiple controlled characters", () => {
    const f = fixture();
    f.start();
    f.setVillain("32124a");
    f.s.player.hand.push(piece("01088"), piece("01089"));
    f.run(
      ...mansionAttackAfterEnemyAttack(
        f.s,
        f.attack({
          damagedTargets: [
            { targetId: "ally", actualDamage: 1, playerId: "p1" },
            { targetId: "hero:p1", actualDamage: 2, playerId: "p1" },
          ],
        }),
        f.ports,
      ),
    );
    expect(f.s.player.hand).toHaveLength(1);
    expect(f.ports.discardRandomHand).toHaveBeenCalledTimes(1);
  });
  it("Toad does not discard for damage to a different player's character", () => {
    const f = fixture(2);
    f.start();
    f.setVillain("32124b");
    expect(
      mansionAttackAfterEnemyAttack(
        f.s,
        f.attack({
          damagedTargets: [
            { targetId: "hero:p2", actualDamage: 2, playerId: "p2" },
          ],
        }),
        f.ports,
      ),
    ).toEqual([]);
  });
  it.each(["32121a", "32122a", "32123a", "32124a"])(
    "a canceled %s attack never triggers the response",
    (code) => {
      const f = fixture();
      f.start();
      f.setVillain(code);
      expect(
        mansionAttackAfterEnemyAttack(
          f.s,
          f.attack({
            performed: false,
            damagedTargets: [
              { targetId: "hero:p1", actualDamage: 2, playerId: "p1" },
            ],
          }),
          f.ports,
        ),
      ).toEqual([]);
    },
  );
  it("blanking the actual villain suppresses its attack text", () => {
    const f = fixture();
    f.start();
    f.blank.add(f.s.villain.id);
    expect(mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports)).toEqual([]);
  });
  it("replaying the same physical attack receipt cannot repeat Pyro", () => {
    const f = fixture();
    f.start();
    f.setVillain("32123b");
    f.s.player.deck.push(piece("01088"), piece("01089"), piece("01090"));
    const effect = mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports)[0];
    f.run(effect);
    f.run(effect);
    expect(f.ports.discardPlayerTop).toHaveBeenCalledTimes(1);
  });
});

describe("Mansion Attack encounter cards", () => {
  it("Brotherhood Beatdown applies every named enemy present", () => {
    const f = fixture();
    f.start();
    f.s.minions.push(piece("32074"), piece("32075"), piece("32076"));
    const treachery = piece("32131");
    f.run(...mansionAttackReveal(f.s, treachery, f.ports)!);
    expect(f.events).toEqual([
      "exhaust:p1",
      "stun:hero:p1",
      "indirect:p1:2",
      "random-discard:p1",
    ]);
  });
  it("Beatdown triggers a name only once even if its unique copies are improperly duplicated", () => {
    const f = fixture();
    f.start();
    f.s.minions.push(piece("32073", "second-avalanche"));
    f.run(...mansionAttackReveal(f.s, piece("32131"), f.ports)!);
    expect(f.ports.exhaustIdentity).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["32132", "32121a", "Avalanche"],
    ["32133", "32122b", "Blob"],
    ["32134", "32123a", "Pyro"],
    ["32135", "32124b", "Toad"],
  ])("%s activates an in-play %s by title", (code, villain, _name) => {
    const f = fixture();
    f.start();
    f.setVillain(villain);
    f.run(...mansionAttackReveal(f.s, piece(code), f.ports)!);
    expect(f.events).toContain(`attack:${f.s.villain.id}:p1`);
    expect(f.ports.searchAndRevealMinion).not.toHaveBeenCalled();
  });
  it("named activation schemes against the revealing alter-ego player", () => {
    const f = fixture(2);
    f.start();
    activateSeat(f.s, "p2");
    seatView(f.s, "p2").player.form = "alter";
    f.run(...mansionAttackReveal(f.s, piece("32132"), f.ports)!);
    expect(f.events).toContain(`scheme:${f.s.villain.id}:p2`);
  });
  it("an in-play named minion activates even if engaged with someone else", () => {
    const f = fixture(2);
    f.start();
    const blob = { ...piece("32074"), engagedWith: "p1" };
    f.s.minions.push(blob);
    activateSeat(f.s, "p2");
    f.run(...mansionAttackReveal(f.s, piece("32133"), f.ports)!);
    expect(f.events).toContain(`attack:${blob.id}:p2`);
  });
  it("searches and reveals the actual named minion from discard if absent", () => {
    const f = fixture();
    f.start();
    const blob = piece("32074", "discard-blob");
    f.s.encounter.discard.push(blob);
    f.run(...mansionAttackReveal(f.s, piece("32133"), f.ports)!);
    expect(f.s.minions).toContain(blob);
    expect(f.s.encounter.discard).not.toContain(blob);
    expect(f.ports.activateEnemy).not.toHaveBeenCalled();
  });
  it("an unsuccessful search never creates a named minion", () => {
    const f = fixture();
    f.start();
    f.run(...mansionAttackReveal(f.s, piece("32134"), f.ports)!);
    expect(f.s.minions).toEqual([]);
  });
  it.each([
    ["32132", "32121a"],
    ["32133", "32122b"],
    ["32134", "32123a"],
    ["32135", "32124b"],
  ])("%s adds one boost only for its matching villain", (code, villain) => {
    const f = fixture();
    f.start();
    f.setVillain(villain);
    f.run(...mansionAttackBoost(f.s, piece(code))!);
    expect(f.ports.additionalBoost).toHaveBeenCalledTimes(1);
  });
  it("a named minion activating does not make its matching boost give the wrong villain a card", () => {
    const f = fixture();
    f.start();
    f.s.minions.push(piece("32074"));
    f.run(...mansionAttackBoost(f.s, piece("32133"))!);
    expect(f.ports.additionalBoost).not.toHaveBeenCalled();
  });
  it("Protect the Students uses fixed two base threat before native Hinder", () => {
    const f = fixture(4);
    expect(mansionAttackSideSchemeBaseThreat(f.s, piece("32136"))).toBe(2);
  });
  it("Protect the Students searches the actual defeating player's deck and discard", () => {
    const f = fixture(2);
    f.start();
    f.run(
      ...mansionAttackSideSchemeDefeated(f.s, piece("32136"), "p2", f.ports)!,
    );
    expect(f.events).toEqual(["ally-search:p2"]);
    expect(f.s.activePlayerId).toBe("p2");
  });
  it("Under Siege counts all Brotherhood characters across the table", () => {
    const f = fixture(3);
    f.start();
    f.s.minions.push(piece("32074"), piece("32075"));
    const side = piece("32137");
    f.s.sideSchemes.push(side);
    f.run(...mansionAttackReveal(f.s, side, f.ports)!);
    expect(side.counters).toBe(9);
  });
  it("Under Siege grants no automatic per-player threat", () => {
    const f = fixture(4);
    expect(mansionAttackSideSchemeBaseThreat(f.s, piece("32137"))).toBe(0);
  });
  it("blank encounter text suppresses the entire reveal ability", () => {
    const f = fixture();
    f.start();
    const p = piece("32131");
    f.blank.add(p.id);
    expect(mansionAttackReveal(f.s, p, f.ports)).toEqual([]);
  });
  it("does not claim another set's reveal or boost handler", () => {
    const f = fixture();
    f.start();
    expect(mansionAttackReveal(f.s, piece("32075"), f.ports)).toBeNull();
    expect(mansionAttackBoost(f.s, piece("32075"))).toBeNull();
    expect(
      resolveMansionAttackEffect(
        f.s,
        { type: "brotherhood:response" },
        f.ports,
      ),
    ).toBe(false);
  });
  it("never mutates the shared readonly catalog while flipping original pieces", () => {
    const before = JSON.stringify(
      (catalog as Card[]).filter((c) => c.set_code === MANSION_ATTACK_SET),
    );
    const f = fixture(2, "expert");
    f.start();
    f.defeat();
    f.complete();
    expect(
      JSON.stringify(
        (catalog as Card[]).filter((c) => c.set_code === MANSION_ATTACK_SET),
      ),
    ).toBe(before);
  });
});

describe("Mansion Attack timing and ownership boundaries", () => {
  it("a queued attack response does not initiate after Retaliate defeats that villain", () => {
    const f = fixture();
    f.start();
    const ally = piece("01050");
    f.s.player.inPlay.push(ally);
    const response = mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports);
    f.defeat();
    f.run(...response);
    expect(ally.exhausted).toBe(false);
    expect(f.s.mansionAttack!.handledAttackResponses).toEqual([]);
  });
  it("a retired final villain cannot create a fresh attack response", () => {
    const f = fixture();
    f.start(1);
    const receipt = f.attack();
    f.defeat();
    expect(mansionAttackAfterEnemyAttack(f.s, receipt, f.ports)).toEqual([]);
  });
  it("an already initiated Avalanche choice can finish after its source leaves", () => {
    const f = fixture();
    f.start();
    const a = piece("01050"),
      b = piece("01051");
    f.s.player.inPlay.push(a, b);
    f.run(...mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports));
    f.s.mansionAttack!.activeVillainRetired = true;
    f.choose(1);
    expect(b.exhausted).toBe(true);
  });
  it("Blob never places two stun cards for duplicate damage entries on the same character", () => {
    const f = fixture();
    f.start();
    f.setVillain("32122a");
    f.run(
      ...mansionAttackAfterEnemyAttack(
        f.s,
        f.attack({
          damagedTargets: [
            { targetId: "hero:p1", playerId: "p1", actualDamage: 1 },
            { targetId: "hero:p1", playerId: "p1", actualDamage: 2 },
          ],
        }),
        f.ports,
      ),
    );
    expect(f.ports.stun).toHaveBeenCalledTimes(1);
  });
  it("Avalanche may exhaust a minion currently controlled as an ally", () => {
    const f = fixture();
    f.start();
    const controlledBlob = piece("32074", "karma-blob");
    f.s.player.inPlay.push(controlledBlob);
    f.run(...mansionAttackAfterEnemyAttack(f.s, f.attack(), f.ports));
    expect(controlledBlob.exhausted).toBe(true);
  });
  it("Under Siege counts a Brotherhood minion currently controlled as an ally", () => {
    const f = fixture();
    f.start();
    f.s.player.inPlay.push(piece("32074", "karma-blob"));
    const siege = piece("32137");
    f.s.sideSchemes.push(siege);
    f.run(...mansionAttackReveal(f.s, siege, f.ports)!);
    expect(siege.counters).toBe(6);
  });
  it("Beatdown recognizes Iceman's Pyro nemesis by its printed title", () => {
    const f = fixture();
    f.start();
    f.s.minions.push(piece("46025"));
    f.run(...mansionAttackReveal(f.s, piece("32131"), f.ports)!);
    expect(f.events).toContain("indirect:p1:2");
  });
  it("Beatdown does not treat a player-controlled Blob ally as an enemy", () => {
    const f = fixture();
    f.start();
    f.s.player.inPlay.push(piece("32074", "karma-blob"));
    f.run(...mansionAttackReveal(f.s, piece("32131"), f.ports)!);
    expect(f.ports.stun).not.toHaveBeenCalled();
  });
  it("the existing victory-display win condition survives blanked Save the School", () => {
    const f = fixture();
    f.start();
    f.s.victoryDisplay!.push(piece("32123a"), piece("32124a"));
    f.blank.add(f.inputs.saveSchool.id);
    expect(mansionAttackCheckOutcome(f.s, f.ports)).toBe(true);
    expect(f.s.phase).toBe("won");
  });
  it("the existing three-main loss survives a blanked current room", () => {
    const f = fixture();
    f.start();
    f.s.victoryDisplay!.push(piece("32128b"), piece("32129b"));
    f.blank.add(f.s.mansionAttack!.currentMain!.id);
    expect(mansionAttackCheckOutcome(f.s, f.ports)).toBe(true);
    expect(f.s.phase).toBe("lost");
  });
  it("blanked Save the School does not blank the villain's ordinary Victory keyword", () => {
    const f = fixture();
    f.start();
    f.blank.add(f.inputs.saveSchool.id);
    const defeated = f.s.villain;
    f.defeat();
    expect(f.s.victoryDisplay).toContain(defeated);
    expect(f.s.mansionAttack!.villainDeck).toHaveLength(3);
    expect(f.events.some((e) => e.startsWith("deal:"))).toBe(false);
  });
  it("a blanked Victory keyword never shuffles a defeated villain into encounters", () => {
    const f = fixture();
    f.start();
    const defeated = f.s.villain;
    f.blank.add(defeated.id);
    f.defeat();
    expect(f.s.removed).toContain(defeated);
    expect(f.s.victoryDisplay).not.toContain(defeated);
    expect(f.s.encounter.discard).not.toContain(defeated);
    expect(f.s.villain.id).not.toBe(defeated.id);
  });
});
