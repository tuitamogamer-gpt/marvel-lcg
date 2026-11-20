/** The Once and Future Kang scenario pack: Kang (I-III), the separate game
 * areas of stage 3, and the Temporal, Master of Time and Anachronauts
 * modular sets, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import {
  abilityOptions,
  enemyStats,
  newGame,
  playable,
  schemeLimit,
  targets,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { activateSeat, seatView } from "../src/game/team";
import {
  KANG_I,
  KANG_III,
  KANG_SCRIPT_CODES,
  KANG_STAGE_THREE,
  KANGS_DOMINION,
  kangAreaOf,
  kangAreaView,
  kangStoredPieces,
  kangVillainAbsent,
} from "../src/game/kang";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

const players3 = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  modules = ["temporal"],
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "kang",
    difficulty,
    modules,
    seed: 11001,
    pacing: "expert",
    heroes: players3.slice(0, players),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 150; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve", "done"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
/** Started table: hands go back into the decks, every identity is a hero,
 * and the cards dealt at setup return to the encounter deck. */
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
const K = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `kang:${type}`,
  ...args,
});
/** Every physical zone of the scenario. */
function zones(s: GameState): Piece[][] {
  return [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
    s.resolving,
    s.removed,
    s.attachments,
    s.sideSchemes,
    s.minions,
    s.environments || [],
    s.victoryDisplay || [],
    [s.villain],
    kangStoredPieces(s),
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** The 43 cards of the Kang set (Expert swaps the six villains) stay in
 * exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(
    all.filter((p) => ["kang", "exp_kang"].includes(card(p).set_code || "")),
  ).toHaveLength(43);
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.kang?.dominions || [],
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function stack(s: GameState, ...codes: string[]) {
  s.encounter.deck.unshift(...codes.map((code) => take(s, code)));
  delete s.encounter.knownTop;
}
/** Defeat Kang (I) with an attack. */
function defeatKang(s: GameState) {
  s.villain.tough = false;
  return settle(
    native(s, {
      type: "damage",
      target: s.villain.id,
      amount: s.villain.hp,
      source: "hero",
      attack: true,
    }),
  );
}
/** Defeat Kang (I) and advance the main scheme as the phase ends. */
function stageThree(s: GameState) {
  s = defeatKang(s);
  return settle(native(s, K("stage-two", { actorId: s.firstPlayerId })));
}

describe("The Once and Future Kang original source", () => {
  it("registers every face of the pack and three modular sets", () => {
    const faces = CATALOG_CARDS.filter((c) => c.pack_code === "toafk");
    expect(faces).toHaveLength(58);
    for (const c of faces) {
      expect(KANG_SCRIPT_CODES as readonly string[], c.code).toContain(c.code);
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    }
    expect(KANG_SCRIPT_CODES).toHaveLength(58);
    expect(VILLAINS.find((v) => v.id === "kang")).toMatchObject({
      codes: ["11001", "11034"],
      schemes: ["11007b"],
      module: "temporal",
    });
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["temporal", "mot", "anachronauts"]),
    );
    expect(scenarioModules("kang")).toHaveLength(84);
  });
  it.each([1, 2, 3])(
    "sets up Kang (I), Kang's Arrival and the set-aside cards for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        const version = difficulty === "expert" ? 1 : 0;
        expect(s.villain.code).toBe(KANG_I[version]);
        expect([s.villain.hp, s.villain.maxHp]).toEqual([
          card(KANG_I[version]).health! * players,
          card(KANG_I[version]).health! * players,
        ]);
        expect(s.villain.tough).toBe(true);
        expect(s.scheme).toMatchObject({ code: "11007b", threat: 0 });
        expect(schemeLimit(s)).toBe(7 * players);
        const k = s.kang!;
        expect(k.stage).toBe(1);
        expect(k.setAside.map((p) => p.code).sort()).toEqual(
          [
            ...KANG_STAGE_THREE.map((x) => x.villain[version]),
            KANG_III[version],
          ].sort(),
        );
        expect(k.dominions.map((p) => p.code)).toEqual(
          Array(4).fill(KANGS_DOMINION),
        );
        expect(k.stageThree.map((p) => p.code).sort()).toEqual([
          "11009a",
          "11010a",
          "11011a",
          "11012a",
        ]);
        expect(k.mainDeck.map((p) => p.code)).toEqual(["11008a", "11013a"]);
        // 1B deals each player an encounter card.
        expect(s.encounter.dealt).toHaveLength(players);
        const encounter = [...s.encounter.deck, ...s.encounter.dealt];
        // Kang's Dominions are set aside; obligations are the Kang set's.
        expect(encounter.some((p) => p.code === KANGS_DOMINION)).toBe(false);
        expect(
          encounter
            .filter((p) => card(p).type_code === "obligation")
            .every((p) => card(p).set_code === "kang"),
        ).toBe(true);
        expect(
          encounter.filter((p) => card(p).set_code === "temporal"),
        ).toHaveLength(7);
        expect(encounter.some((p) => card(p).set_code === "expert")).toBe(
          difficulty === "expert",
        );
        exact(reload(s));
      }
    },
  );
});

describe("Kang (I)", () => {
  it("makes the attacked player choose 1 threat on the main scheme or +2 ATK", () => {
    let s = started();
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }), (v) =>
      v.prompt?.title === "Kang (The Conqueror)" ? "threat" : undefined,
    );
    expect(s.scheme.threat).toBe(1);
    s = started();
    const hp = s.player.hp;
    s.encounter.deck = s.encounter.deck.filter((p) => !card(p).boost);
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }), (v) =>
      v.prompt?.title === "Kang (The Conqueror)" ? "attack" : undefined,
    );
    // Base ATK 2 + 2, no boost icons in the deck.
    expect(hp - s.player.hp).toBe(4);
    expect(s.scheme.threat).toBe(0);
  });
  it("leaves no villain in play until the main scheme advances at the end of the phase", () => {
    let s = started();
    s = defeatKang(s);
    expect(s.phase).toBe("player");
    expect(s.kang!.advancing).toBe(true);
    expect(kangVillainAbsent(s)).toBe(true);
    expect(targets(s, "enemy", true).map((t) => t.id)).not.toContain(
      s.villain.id,
    );
    // Damage and activations have no villain to affect.
    const before = s.villain.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(before);
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(seatView(s, s.activePlayerId).player.hp);
    exact(reload(s));
  });
  it("advances to stage 2 when the player phase ends", () => {
    let s = started();
    s = defeatKang(s);
    s = command(s, { type: "END_TURN" });
    s = settle(s);
    expect(s.kang!.stage).toBe(3);
    expect(s.kang!.areas).toHaveLength(1);
    expect(KANG_I as readonly string[]).not.toContain(s.villain.code);
    exact(reload(s));
  });
});

describe("The Master of Time (stage 2)", () => {
  it("turns each side scheme into an acceleration token and gives each player a game area", () => {
    for (const players of [1, 2, 3]) {
      let s = started("standard", players);
      const portal = take(s, "11033");
      portal.counters = 2;
      s.sideSchemes.push(portal);
      s = stageThree(s);
      const k = s.kang!;
      expect(k.stage).toBe(3);
      expect(s.encounter.acceleration).toBe(1);
      expect(s.encounter.discard.map((p) => p.code)).toContain("11033");
      expect(k.areas).toHaveLength(players);
      expect(k.currentMain.code).toBe("11008b");
      expect(k.stageThree).toEqual([]);
      // Each area has its own Kang (II) and stage 3B scheme.
      const villains = k.areas!.map((a) => kangAreaView(s, a).villain.code);
      const schemes = k.areas!.map((a) => kangAreaView(s, a).scheme.code);
      expect(new Set(villains).size).toBe(players);
      for (const [i, area] of k.areas!.entries()) {
        const link = KANG_STAGE_THREE.find((x) => x.scheme === schemes[i])!;
        expect(villains[i]).toBe(link.villain[0]);
        const v = kangAreaView(s, area).villain;
        expect([v.hp, v.maxHp]).toEqual([18, 18]);
        expect(kangAreaView(s, area).scheme.threat).toBe(
          card(link.scheme).base_threat,
        );
      }
      // Each player is dealt an encounter card by their stage 3A.
      expect(s.encounter.dealt).toHaveLength(players);
      // Kang (I), Kang's Arrival and the unused stage 3 cards left the game.
      expect(s.removed.map((p) => p.code)).toEqual(
        expect.arrayContaining(["11001", "11007b"]),
      );
      expect(
        s.removed.filter((p) => /^110(09|10|11|12)/.test(p.code)),
      ).toHaveLength(4 - players);
      exact(reload(s));
    }
  });
  it("makes the active player's game area native and keeps the others apart", () => {
    let s = started("standard", 2);
    s = stageThree(s);
    const [a, b] = s.kang!.areas!;
    activateSeat(s, "p1");
    const v1 = s.villain;
    expect(kangAreaOf(s, "p1")!.id).toBe(a.id);
    activateSeat(s, "p2");
    expect(s.villain.id).not.toBe(v1.id);
    expect(s.villain.id).toBe(kangAreaView(s, b).villain.id);
    // Damage in one area does not reach the other. Kang (II) enters with a
    // tough status card (Toughness).
    expect(s.villain.tough).toBe(true);
    s.villain.tough = false;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 5,
        source: "hero",
        actorId: "p2",
      }),
    );
    expect(kangAreaView(s, s.kang!.areas![1]).villain.hp).toBe(13);
    expect(kangAreaView(s, s.kang!.areas![0]).villain.hp).toBe(18);
    // A save keeps each card once.
    s = reload(s);
    exact(s);
    activateSeat(s, "p1");
    expect(s.villain.id).toBe(v1.id);
    expect(targets(s, "enemy").map((t) => t.id)).not.toContain(
      kangAreaView(s, s.kang!.areas![1]).villain.id,
    );
  });
  it("places each stage 3 scheme's own threat in step one, without the acceleration tokens", () => {
    let s = started("standard", 2);
    s.encounter.acceleration = 2;
    s = stageThree(s);
    const before = s.kang!.areas!.map((a) => kangAreaView(s, a).scheme.threat);
    s = settle(native(s, { type: "villainStepOne" }));
    const after = s.kang!.areas!.map((a) => kangAreaView(s, a).scheme.threat);
    expect(after.map((n, i) => n - before[i])).toEqual([1, 1]);
  });
});

describe("Joining another game area", () => {
  it("moves a player whose Kang (II) is defeated into another area at the end of the phase", () => {
    let s = started("standard", 2);
    s = stageThree(s);
    activateSeat(s, "p2");
    s.villain.tough = false;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 18,
        source: "hero",
        actorId: "p2",
      }),
    );
    activateSeat(s, "p2");
    expect(kangVillainAbsent(s)).toBe(true);
    // Kang (Immortus) would not take damage while a minion is in play.
    const minion = take(s, "11030");
    minion.engagedWith = "p2";
    s.minions.push(minion);
    const side = take(s, "11025");
    side.counters = 4;
    s.sideSchemes.push(side);
    expect(kangAreaOf(s, "p2")!.leaving).toBe("defeated");
    // No Kang's Dominion goes under stage 4A for a defeated Kang (II).
    expect(s.kang!.underWrath).toEqual([]);
    s = settle(native(s, K("areas-leave", { actorId: s.firstPlayerId })));
    expect(s.kang!.areas).toHaveLength(1);
    expect(s.kang!.areas![0].players.sort()).toEqual(["p1", "p2"]);
    activateSeat(s, "p1");
    expect(s.minions.find((m) => m.id === minion.id)?.engagedWith).toBe("p2");
    expect(s.sideSchemes.map((p) => p.id)).toContain(side.id);
    exact(reload(s));
  });
  it("lets the leaving player choose among several areas", () => {
    let s = started("standard", 3);
    s = stageThree(s);
    activateSeat(s, "p3");
    s.villain.tough = false;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 18,
        source: "hero",
        actorId: "p3",
      }),
    );
    s = native(s, K("areas-leave", { actorId: s.firstPlayerId }));
    expect(s.prompt?.title).toBe("Join another game area");
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(["p1", "p2"]);
    s = settle(choose(s, "p1"));
    expect(kangAreaOf(s, "p3")!.id).toBe("p1");
    expect(s.kang!.areas).toHaveLength(2);
    exact(reload(s));
  });
  it("puts a Kang's Dominion under stage 4A when a stage 3 scheme is completed, without losing", () => {
    let s = started("standard", 2);
    s = stageThree(s);
    activateSeat(s, "p1");
    s = settle(
      native(s, { type: "threat", target: "main", amount: 9, actorId: "p1" }),
    );
    expect(s.phase).toBe("player");
    expect(s.kang!.underWrath).toHaveLength(1);
    expect(s.kang!.dominions).toHaveLength(3);
    expect(kangAreaOf(s, "p1")!.leaving).toBe("completed");
    s = settle(native(s, K("areas-leave", { actorId: s.firstPlayerId })));
    expect(s.kang!.areas).toHaveLength(1);
    expect(kangAreaOf(s, "p1")!.id).toBe("p2");
    exact(reload(s));
  });
});

describe("Kang's Wrath (stage 4)", () => {
  it("brings in Kang (III), reveals each Dominion and each player's nemesis minion", () => {
    let s = started("standard", 2);
    s.encounter.acceleration = 1;
    s = stageThree(s);
    activateSeat(s, "p1");
    s = settle(
      native(s, { type: "threat", target: "main", amount: 9, actorId: "p1" }),
    );
    activateSeat(s, "p2");
    s.villain.tough = false;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 18,
        source: "hero",
        actorId: "p2",
      }),
    );
    s = settle(native(s, K("areas-leave", { actorId: s.firstPlayerId })));
    expect(s.kang!.stage).toBe(4);
    expect(s.kang!.areas).toBeUndefined();
    expect(s.villain.code).toBe(KANG_III[0]);
    expect([s.villain.hp, s.villain.maxHp]).toEqual([40, 40]);
    expect(s.scheme).toMatchObject({ code: "11013b", threat: 0 });
    expect(schemeLimit(s)).toBe(20);
    const dominions = s.sideSchemes.filter((p) => p.code === KANGS_DOMINION);
    expect(dominions).toHaveLength(1);
    expect(dominions[0].counters).toBe(6);
    // Kang cannot take damage while a Dominion is in play.
    s.villain.tough = false;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 5,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(40);
    // Each player's nemesis minion is engaged with them.
    for (const id of ["p1", "p2"]) {
      const hero = seatView(s, id).heroId;
      expect(
        s.minions.some(
          (m) => card(m).set_code === `${hero}_nemesis` && m.engagedWith === id,
        ),
        hero,
      ).toBe(true);
    }
    // The acceleration token from stage 2B now adds threat.
    const threat = s.scheme.threat;
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat - threat).toBe(2 + 1);
    exact(reload(s));
  });
  it("wins when Kang (III) is defeated and loses when a stage 1B or 4B scheme completes", () => {
    let s = started();
    s = settle(native(s, { type: "threat", target: "main", amount: 7 }));
    expect(s.phase).toBe("lost");
    s = started();
    s = stageThree(s);
    s.villain.tough = false;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 18,
        source: "hero",
      }),
    );
    s = settle(native(s, K("areas-leave", { actorId: s.firstPlayerId })));
    expect(s.kang!.stage).toBe(4);
    const wrath = reload(s);
    s = settle(native(s, { type: "threat", target: "main", amount: 10 }));
    expect(s.phase).toBe("lost");
    s = wrath;
    s.villain.tough = false;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 20,
        source: "hero",
      }),
    );
    expect(s.phase).toBe("won");
  });
});

/** A started table with these modular sets. */
function startedWith(modules: string[], players = 1) {
  let s = settle(setup("standard", players, modules));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
/** Stage 3 with this stage 3 scheme for a single player. */
function soloStage(scheme: string) {
  let s = started();
  const k = s.kang!;
  s.removed.push(...k.stageThree.filter((p) => !p.code.startsWith(scheme)));
  k.stageThree = k.stageThree.filter((p) => p.code.startsWith(scheme));
  s = stageThree(s);
  expect(s.scheme.code).toBe(`${scheme}b`);
  return s;
}
function inPlay(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = take(s, code);
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function fromDeck(
  s: GameState,
  test: (code: string) => boolean,
  playerId = s.activePlayerId,
) {
  const deck = seatView(s, playerId).player.deck;
  const i = deck.findIndex((p) => test(p.code));
  expect(i, "a matching player card").toBeGreaterThanOrEqual(0);
  return deck.splice(i, 1)[0];
}
const resource = (kind: string) => (code: string) =>
  !!(card(code) as unknown as Record<string, unknown>)[`resource_${kind}`] &&
  !card(code).resource_wild;
const attack = (s: GameState, amount: number, target = s.villain.id) =>
  settle(
    native(s, { type: "damage", target, amount, source: "hero", attack: true }),
  );
/** Kang attacks undefended; Kang (I)'s choice places threat. */
function kangAttacks(s: GameState) {
  return settle(native(s, { type: "enemyAttack", id: s.villain.id }), (v) =>
    /^Kang \(/.test(v.prompt?.title || "") &&
    v.prompt?.options.some((o) => o.id === "threat")
      ? "threat"
      : undefined,
  );
}
const noBoosts = (s: GameState) => {
  s.encounter.discard.push(...s.encounter.deck.filter((p) => card(p).boost));
  s.encounter.deck = s.encounter.deck.filter((p) => !card(p).boost);
  return s;
};

describe("Kang (II)", () => {
  it("Immortus cannot take damage while a minion is in play", () => {
    let s = soloStage("11009");
    expect(s.villain.code).toBe("11002");
    s.villain.tough = false;
    const minion = take(s, "11030");
    minion.engagedWith = "p1";
    s.minions.push(minion);
    s = attack(s, 4);
    expect(s.villain.hp).toBe(18);
    s.minions = [];
    s.encounter.discard.push(minion);
    s = attack(s, 4);
    expect(s.villain.hp).toBe(14);
  });
  it("Rama-Tut gets +1 ATK for each obligation in his game area", () => {
    const s = soloStage("11011");
    expect(enemyStats(s, s.villain).attack).toBe(2);
    inPlay(s, "11018");
    inPlay(s, "11020");
    expect(enemyStats(s, s.villain).attack).toBe(4);
  });
  it("Scarlet Centurion's attack pierces the defender's tough status", () => {
    let s = noBoosts(soloStage("11012"));
    expect(s.villain.code).toBe("11005");
    s.player.tough = true;
    const hp = s.player.hp;
    s = kangAttacks(s);
    expect(s.player.tough).toBe(false);
    expect(hp - s.player.hp).toBe(3);
  });
});

describe("Kang's attachments", () => {
  it("Temporal Shield prevents all damage from an attack and deals 1 damage to the attacker", () => {
    let s = started();
    s = reveal(s, "11014");
    const shield = s.attachments.find((p) => p.code === "11014")!;
    expect(shield.attachedTo).toBe(s.villain.id);
    s.villain.tough = false;
    const [hp, hero] = [s.villain.hp, s.player.hp];
    s = attack(s, 5);
    expect(s.villain.hp).toBe(hp);
    expect(hero - s.player.hp).toBe(1);
    expect(s.attachments.some((p) => p.id === shield.id)).toBe(false);
    expect(s.encounter.discard.map((p) => p.id)).toContain(shield.id);
    s = attack(s, 5);
    expect(s.villain.hp).toBe(hp - 5);
    exact(reload(s));
  });
  it("Future Weapon gives +2 ATK, stuns the damaged hero and is discarded after the attack", () => {
    let s = noBoosts(started());
    s = reveal(s, "11015");
    const weapon = s.attachments.find((p) => p.code === "11015")!;
    expect(enemyStats(s, s.villain).attack).toBe(4);
    const hp = s.player.hp;
    s = kangAttacks(s);
    expect(hp - s.player.hp).toBe(4);
    expect(s.player.stunned).toBe(true);
    expect(s.attachments.some((p) => p.id === weapon.id)).toBe(false);
    exact(reload(s));
  });
  it("Frozen in Time is discarded instead of readying the identity", () => {
    let s = started();
    s = reveal(s, "11016");
    const frozen = s.attachments.find((p) => p.code === "11016")!;
    expect(frozen.attachedTo).toBe("hero:p1");
    s.player.exhausted = true;
    s = settle(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(true);
    expect(s.attachments.some((p) => p.id === frozen.id)).toBe(false);
    s = settle(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(false);
  });
});

describe("Kang's obligations", () => {
  it("stay in the player's play area and leave through their Alter-Ego Actions", () => {
    let s = started();
    s = reveal(s, "11018");
    const weakened = s.player.inPlay.find((p) => p.code === "11018")!;
    expect(weakened).toBeTruthy();
    // Weakened: after a basic hero power, take 1 damage.
    s.scheme.threat = 3;
    const hp = s.player.hp;
    s = settle(command(s, { type: "BASIC", action: "thwart" }));
    expect(hp - s.player.hp).toBe(1);
    // Alter-Ego Action: discard a physical resource.
    s.player.form = "alter";
    const physical = fromDeck(s, resource("physical"));
    s.player.hand.push(physical);
    s = command(s, { type: "ABILITY", id: weakened.id, action: "discard" });
    s = settle(choose(s, physical.id));
    expect(s.player.inPlay.some((p) => p.id === weakened.id)).toBe(false);
    expect(s.player.discard.map((p) => p.id)).toContain(physical.id);
    exact(reload(s));
  });
  it("Stolen Memories holds the top 8 cards facedown until it is discarded", () => {
    let s = started();
    const deck = s.player.deck.length;
    s = reveal(s, "11019");
    const stolen = s.player.inPlay.find((p) => p.code === "11019")!;
    expect(stolen.storedCards).toHaveLength(8);
    expect(s.player.deck).toHaveLength(deck - 8);
    s.player.form = "alter";
    const mental = fromDeck(s, resource("mental"));
    s.player.hand.push(mental);
    s = command(s, { type: "ABILITY", id: stolen.id, action: "discard" });
    s = settle(choose(s, mental.id));
    expect(s.player.discard).toHaveLength(9);
    exact(reload(s));
  });
  it("Depowered stops hero-specific cards; Fear of Kang stops attacks on Kang", () => {
    let s = started();
    s = reveal(s, "11020");
    const web = fromDeck(s, (code) => code === "01008");
    s.player.hand.push(web);
    expect(s.player.inPlay.some((p) => p.code === "11020")).toBe(true);
    expect(playable(s, web)).toMatch(/Depowered/);
    s = startedWith(["mot"]);
    s = reveal(s, "11049");
    expect(targets(s, "enemy", true).map((t) => t.id)).not.toContain(
      s.villain.id,
    );
    expect(targets(s, "enemy").map((t) => t.id)).toContain(s.villain.id);
  });
  it("Time-Travel Hijinks discards the highest-cost card and holds it facedown", () => {
    let s = started();
    const cat = fromDeck(s, (code) => code === "01002");
    const may = fromDeck(s, (code) => code === "01006");
    s.player.inPlay.push(cat, may);
    s = reveal(s, "11021");
    const hijinks = s.player.inPlay.find((p) => p.code === "11021")!;
    expect(hijinks.storedCards?.map((p) => p.id)).toEqual([cat.id]);
    expect(s.player.inPlay.some((p) => p.id === cat.id)).toBe(false);
    s.player.form = "alter";
    const energy = fromDeck(s, resource("energy"));
    s.player.hand.push(energy);
    s = command(s, { type: "ABILITY", id: hijinks.id, action: "discard" });
    s = settle(choose(s, energy.id));
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([cat.id, energy.id]),
    );
    exact(reload(s));
  });
  it("Corrupted Timestream blocks the Alter-Ego Actions on obligations", () => {
    let s = started();
    s = reveal(s, "11018");
    s = settle(reveal(s, "11022"), (v) =>
      v.prompt?.options.some((o) => o.id === "threat") ? "threat" : undefined,
    );
    const corrupted = s.sideSchemes.find((p) => p.code === "11022")!;
    expect(corrupted.counters).toBe(4);
    s.player.form = "alter";
    s.player.hand.push(fromDeck(s, resource("physical")));
    const weakened = s.player.inPlay.find((p) => p.code === "11018")!;
    expect(abilityOptions(s, weakened).map((o) => o.id)).not.toContain(
      "discard",
    );
    s.sideSchemes = s.sideSchemes.filter((p) => p.id !== corrupted.id);
    s.encounter.discard.push(corrupted);
    expect(abilityOptions(s, weakened).map((o) => o.id)).toContain("discard");
  });
});

describe("Kang's treacheries and side schemes", () => {
  it("Energy Blast: Kang attacks a hero; an alter-ego discards an ally or support, or it gains surge", () => {
    let s = noBoosts(started());
    const hp = s.player.hp;
    s = settle(reveal(s, "11026"), (v) =>
      v.prompt?.options.some((o) => o.id === "threat") ? "threat" : undefined,
    );
    expect(hp - s.player.hp).toBe(2);
    s = started();
    s.player.form = "alter";
    const cat = fromDeck(s, (code) => code === "01002");
    s.player.inPlay.push(cat);
    s = settle(reveal(s, "11026"));
    expect(s.player.discard.map((p) => p.id)).toContain(cat.id);
    expect(s.encounter.dealt).toHaveLength(0);
    s = settle(reveal(s, "11026"));
    expect(s.encounter.dealt).toHaveLength(1);
    exact(reload(s));
  });
  it("Manipulated Timestream discards each event, or gains surge", () => {
    let s = started();
    const events = s.player.deck.filter((p) => card(p).type_code === "event");
    s.player.hand.push(...events.splice(0, 2));
    s.player.deck = s.player.deck.filter(
      (p) => !s.player.hand.some((q) => q.id === p.id),
    );
    s = settle(reveal(s, "11027"));
    expect(s.player.hand.filter((p) => card(p).type_code === "event")).toEqual(
      [],
    );
    expect(s.encounter.dealt).toHaveLength(0);
    s = settle(reveal(s, "11027"));
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Time-Travel Tactics deals indirect damage for each obligation in each player's play area", () => {
    let s = started();
    inPlay(s, "11018");
    inPlay(s, "11020");
    const hp = s.player.hp;
    s = settle(reveal(s, "11028"));
    expect(hp - s.player.hp).toBe(2);
    // Surge.
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Past Machinations reveals a different obligation for each player", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "11029"));
    const titles = ["p1", "p2"].map(
      (id) =>
        seatView(s, id)
          .player.inPlay.filter((p) => card(p).type_code === "obligation")
          .map((p) => card(p).name)[0],
    );
    expect(titles.every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(2);
    // Incite 1.
    expect(s.scheme.threat).toBe(1);
    exact(reload(s));
  });
  it("Pinned Down places 2 threat for each obligation in play", () => {
    let s = started();
    inPlay(s, "11019");
    s = settle(reveal(s, "11024"));
    expect(s.sideSchemes.find((p) => p.code === "11024")?.counters).toBe(4);
  });
  it("Rampage and Kang's Dominion reward the player who defeats them", () => {
    let s = started();
    const rampage = take(s, "11025");
    rampage.counters = 0;
    s.sideSchemes.push(rampage);
    stack(s, "11027", "11030");
    s = settle(native(s, { type: "defeatScheme", id: rampage.id }));
    expect(s.minions.find((m) => m.code === "11030")?.engagedWith).toBe("p1");
    expect(s.encounter.discard.map((p) => p.code)).toContain("11027");
    s = stageThree(s);
    s = settle(
      native(s, { type: "threat", target: "main", amount: 9, actorId: "p1" }),
    );
    s = settle(native(s, K("areas-leave", { actorId: s.firstPlayerId })));
    const dominion = s.sideSchemes.find((p) => p.code === KANGS_DOMINION)!;
    dominion.counters = 0;
    const dealt = s.encounter.dealt.length;
    s = settle(native(s, { type: "defeatScheme", id: dominion.id }));
    expect(s.encounter.dealt).toHaveLength(dealt + 1);
    exact(reload(s));
  });
  it("Macrobots' boost gives Kang a tough status card", () => {
    let s = started();
    s.villain.tough = false;
    stack(s, "11017");
    s = kangAttacks(s);
    expect(s.villain.tough).toBe(true);
  });
});

describe("The Temporal modular set", () => {
  it("Ancient Warrior's boost stuns you; Chitauri Soldier deals indirect damage for boost icons", () => {
    let s = started();
    stack(s, "11030");
    s = kangAttacks(s);
    expect(s.player.stunned).toBe(true);
    s = started();
    const chitauri = take(s, "11031");
    chitauri.engagedWith = "p1";
    s.minions.push(chitauri);
    // Rampage has 2 boost icons.
    stack(s, "11025", "11027");
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: chitauri.id }));
    expect(s.encounter.discard.map((p) => p.code)).toContain("11025");
    // 2 indirect damage, then the attack: minions take no boost cards.
    expect(hp - s.player.hp).toBe(2 + 1);
  });
  it("Tyrannosaurus Rex pierces; Time Portal is shuffled back into the encounter deck", () => {
    let s = noBoosts(started());
    const rex = take(s, "11032");
    rex.engagedWith = "p1";
    s.minions.push(rex);
    s.player.tough = true;
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: rex.id }));
    expect(s.player.tough).toBe(false);
    expect(hp - s.player.hp).toBe(3);
    const portal = take(s, "11033");
    portal.counters = 0;
    s.sideSchemes.push(portal);
    s = settle(native(s, { type: "defeatScheme", id: portal.id }));
    expect(s.encounter.deck.map((p) => p.id)).toContain(portal.id);
    expect(s.encounter.discard.map((p) => p.id)).not.toContain(portal.id);
  });
});

describe("The Anachronauts modular set", () => {
  it("Apocryphus and Wildrun discard when revealed; Kang's Chosen reveals the next Temporal minion", () => {
    let s = startedWith(["anachronauts"]);
    const cat = fromDeck(s, (code) => code === "01002");
    s.player.inPlay.push(cat);
    s = settle(reveal(s, "11040"));
    expect(s.player.discard.map((p) => p.id)).toContain(cat.id);
    s.player.hand.push(...s.player.deck.splice(0, 2));
    s = settle(reveal(s, "11044"));
    expect(s.player.hand).toHaveLength(1);
    stack(s, "11027", "11042");
    s = settle(reveal(s, "11046"));
    expect(s.minions.map((m) => m.code)).toContain("11042");
    expect(s.encounter.discard.map((p) => p.code)).toContain("11027");
    exact(reload(s));
  });
  it("their boosts exhaust, toughen, damage and give more boost cards", () => {
    let s = startedWith(["anachronauts"]);
    stack(s, "11041", "11027");
    s.villain.tough = false;
    s = kangAttacks(s);
    expect(s.villain.tough).toBe(true);
    expect(s.encounter.discard.map((p) => p.code)).toEqual(
      expect.arrayContaining(["11041", "11027"]),
    );
    s = startedWith(["anachronauts"]);
    stack(s, "11043", "11027", "11029");
    s = kangAttacks(s);
    expect(s.encounter.discard.map((p) => p.code)).toEqual(
      expect.arrayContaining(["11043", "11027", "11029"]),
    );
    s = startedWith(["anachronauts"]);
    stack(s, "11040", "11027");
    s = kangAttacks(s);
    expect(s.player.exhausted).toBe(true);
  });
  it("The Anachronauts shuffle each Temporal card from the discard pile back into the deck", () => {
    let s = startedWith(["anachronauts"]);
    const warrior = take(s, "11042");
    s.encounter.discard.push(warrior);
    const scheme = take(s, "11045");
    scheme.counters = 0;
    s.sideSchemes.push(scheme);
    s = settle(native(s, { type: "defeatScheme", id: scheme.id }));
    expect(s.encounter.deck.map((p) => p.id)).toContain(warrior.id);
  });
});

describe("The Master of Time modular set", () => {
  it("Kang (Master of Time) grows with your obligations and Ancient Grudge brings him in", () => {
    let s = startedWith(["mot"]);
    s = settle(reveal(s, "11051"));
    const master = s.minions.find((m) => m.code === "11047")!;
    expect(master.engagedWith).toBe("p1");
    expect(enemyStats(s, master)).toMatchObject({ attack: 1, scheme: 1 });
    inPlay(s, "11049");
    inPlay(s, "11018");
    expect(enemyStats(s, master)).toMatchObject({ attack: 3, scheme: 3 });
    // Fear of Kang: you cannot attack Kang (Master of Time) either.
    expect(targets(s, "enemy", true).map((t) => t.id)).not.toContain(master.id);
    exact(reload(s));
  });
  it("Time-Displaced Soldier's boost deals you a card; the Sphere brings a minion", () => {
    let s = startedWith(["mot"]);
    stack(s, "11048");
    s = kangAttacks(s);
    expect(s.encounter.dealt).toHaveLength(1);
    const sphere = take(s, "11050");
    sphere.counters = 0;
    s.sideSchemes.push(sphere);
    stack(s, "11027", "11048");
    s = settle(native(s, { type: "defeatScheme", id: sphere.id }));
    expect(s.minions.map((m) => m.code)).toContain("11048");
  });
});

describe("Separate game areas with several players", () => {
  it("keeps each player's effects, defenders and hazard icons in their own game area", () => {
    let s = started("standard", 2);
    s = stageThree(s);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    // Time-Travel Tactics in p1's area hurts only p1.
    activateSeat(s, "p1");
    inPlay(s, "11018", "p1");
    inPlay(s, "11020", "p2");
    const [hp1, hp2] = ["p1", "p2"].map((id) => seatView(s, id).player.hp);
    s = settle(reveal(s, "11028", "p1"));
    expect(hp1 - seatView(s, "p1").player.hp).toBe(1);
    expect(seatView(s, "p2").player.hp).toBe(hp2);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    // Only p1's hero can defend p1.
    activateSeat(s, "p1");
    s.villain.stunned = false;
    let attack = native(s, { type: "enemyAttack", id: s.villain.id });
    for (let n = 0; attack.prompt && n < 10; n++) {
      if (/attacks/.test(attack.prompt.title)) break;
      attack = choose(
        attack,
        attack.prompt.options.find((o) => o.id === "threat")?.id ||
          attack.prompt.options[0].id,
      );
    }
    const ids = attack.prompt!.options.map((o) => o.id);
    expect(ids).toContain("hero");
    expect(ids.some((id) => id === "hero:p2")).toBe(false);
    // A hazard icon deals an extra card in its own area only: p1, p2,
    // then p2's hazard, each an obligation that stays in play.
    activateSeat(s, "p2");
    const portal = take(s, "11033");
    portal.counters = 2;
    s.sideSchemes.push(portal);
    const before = ["p1", "p2"].map(
      (id) =>
        seatView(s, id).player.inPlay.filter(
          (p) => card(p).type_code === "obligation",
        ).length,
    );
    stack(s, "11019", "11019", "11021");
    s = settle(native(s, { type: "dealEncounters" }));
    const after = ["p1", "p2"].map(
      (id) =>
        seatView(s, id).player.inPlay.filter(
          (p) => card(p).type_code === "obligation",
        ).length,
    );
    expect(after.map((n, i) => n - before[i])).toEqual([1, 2]);
    exact(reload(s));
  });
  it("completes a stage 3 scheme when every player at it is defeated", () => {
    let s = started("standard", 2);
    s = stageThree(s);
    seatView(s, "p2").player.hp = 0;
    s = settle(native(s, { type: "threat", target: "main", amount: 0 }));
    expect(s.players.find((p) => p.id === "p2")?.eliminated).toBe(true);
    expect(kangAreaOf(s, "p2")!.schemeDone).toBe(true);
    expect(s.kang!.underWrath).toHaveLength(1);
    s = settle(native(s, K("areas-leave", { actorId: s.firstPlayerId })));
    expect(s.kang!.areas).toHaveLength(1);
    exact(reload(s));
  });
});

describe("Kang's rules interactions", () => {
  it("Weakened also follows a basic defense, after the attack", () => {
    let s = noBoosts(started());
    inPlay(s, "11018");
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }), (v) =>
      v.prompt?.options.some((o) => o.id === "threat")
        ? "threat"
        : v.prompt?.options.some((o) => o.id === "hero")
          ? "hero"
          : undefined,
    );
    // Kang's 2 ATK against Spider-Man's 3 DEF, then Weakened's 1 damage.
    expect(hp - s.player.hp).toBe(1);
    expect(s.player.exhausted).toBe(true);
  });
  it("Fear of Kang leaves through a random discard", () => {
    let s = startedWith(["mot"]);
    s = reveal(s, "11049");
    const fear = s.player.inPlay.find((p) => p.code === "11049")!;
    s.player.form = "alter";
    s.player.hand.push(...s.player.deck.splice(0, 2));
    s = settle(command(s, { type: "ABILITY", id: fear.id, action: "discard" }));
    expect(s.player.inPlay.some((p) => p.id === fear.id)).toBe(false);
    expect(s.player.hand).toHaveLength(1);
  });
  it("Shadow of the Past does not bring a second nemesis minion after Kang's Wrath", () => {
    let s = started();
    s = stageThree(s);
    s.villain.tough = false;
    s = attack(s, 18);
    s = settle(native(s, K("areas-leave", { actorId: s.firstPlayerId })));
    expect(s.minions.filter((m) => m.code === "01167")).toHaveLength(1);
    expect(s.kang!.nemesisOut).toEqual(["p1"]);
    s = settle(reveal(s, "01190"));
    expect(s.minions.filter((m) => m.code === "01167")).toHaveLength(1);
    expect(s.sideSchemes.map((p) => p.code)).toContain("01166");
  });
  it("skips Kang's activations after he is defeated in the villain phase, then advances", () => {
    let s = started("standard", 2);
    s.scheme.threat = 0;
    s.villain.tough = false;
    s.villain.hp = 1;
    const hp = seatView(s, "p2").player.hp;
    // Kang is defeated before the second player's activation.
    s = settle(
      native(
        s,
        {
          type: "damage",
          target: s.villain.id,
          amount: 1,
          source: "hero",
          attack: true,
        },
        { type: "villainActivate", actorId: "p2" },
        { type: "newRound", actorId: s.firstPlayerId },
      ),
    );
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(s.scheme.code).not.toBe("11007b");
    expect(s.kang!.stage).toBe(3);
    expect(s.kang!.areas).toHaveLength(2);
    exact(reload(s));
  });
  it("discards duplicate unique cards when game areas combine", () => {
    let s = started("standard", 2);
    s = stageThree(s);
    const cat = fromDeck(s, (code) => code === "01002", "p1");
    seatView(s, "p1").player.inPlay.push(cat);
    const twin = { ...cat, id: "twin-cat", ownerId: "p2" };
    seatView(s, "p2").player.inPlay.push(twin);
    activateSeat(s, "p2");
    s.villain.tough = false;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 18,
        source: "hero",
        actorId: "p2",
      }),
    );
    s = settle(native(s, K("areas-leave", { actorId: s.firstPlayerId })));
    const cats = s.players.flatMap((seat) =>
      seatView(s, seat).player.inPlay.filter((p) => p.code === "01002"),
    );
    expect(cats).toHaveLength(1);
  });
});
