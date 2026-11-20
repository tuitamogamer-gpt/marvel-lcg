/** Age of Apocalypse: Unus with the Infinites and Dystopian Nightmare
 * modular sets, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  pieceHP,
  scenarioModules,
} from "../src/game/cards";
import { abilityOptions, enemyStats, newGame } from "../src/game/engine";
import {
  DYSTOPIAN_NIGHTMARE_CODES,
  INFINITES_CODES,
  UNUS_SCRIPT_CODES,
  genePoolLevel,
  unusAmplify,
  unusHazard,
} from "../src/game/unus";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
const team: Seat[] = [
  { heroId: "spider_man", aspect: "justice" },
  { heroId: "captain_marvel", aspect: "aggression" },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "unus",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 45059,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...(modules ? { modules } : {}),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
  untilPayment = false,
) {
  for (let n = 0; s.prompt && n < 200; n++) {
    if (untilPayment && s.prompt.kind === "payment") return s;
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve", "done"].includes(o.id),
        )?.id ||
        s.prompt.options.find((o) => o.id !== "pay")?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
/** Setup through the mulligans, before the dealt cards are revealed. */
function opened(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "unus",
  modules?: string[],
) {
  let s = settle(setup(difficulty, players, villainId, modules));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "unus",
  modules?: string[],
) {
  const s = opened(difficulty, players, villainId, modules);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
/** Decline the player interrupts offered before an encounter card's When
 * Revealed ability resolves. */
function resolveEncounter(s: GameState) {
  for (
    let n = 0;
    n < 5 &&
    s.prompt?.options.some((o) => o.id === "resolve") &&
    /interrupt available/i.test(s.prompt.text);
    n++
  )
    s = choose(s, "resolve");
  return s;
}
function stack(s: GameState, ...pieces: Piece[]) {
  s.encounter.deck.unshift(...pieces);
  delete s.encounter.knownTop;
}
/** An original encounter card with boost icons but no boost ability on top
 * of the encounter deck. */
function plain(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) =>
      !card(p).boost_star &&
      (card(p).boost || 0) >= 1 &&
      card(p).type_code !== "minion",
  );
  const [p] = s.encounter.deck.splice(i, 1);
  stack(s, p);
  return card(p).boost || 0;
}
function playerCard(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  expect(i, `deck card ${code}`).toBeGreaterThanOrEqual(0);
  return p.deck.splice(i, 1)[0];
}
function ally(s: GameState, playerId = s.activePlayerId) {
  const view = seatView(s, playerId).player;
  const i = view.deck.findIndex((p) => card(p).type_code === "ally");
  expect(i).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.inPlay.push(p);
  return p;
}
function attach(s: GameState, code: string, target = s.villain.id) {
  const p = take(s, code);
  p.attachedTo = target;
  s.attachments.push(p);
  return p;
}
function engage(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = take(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
const hit = (target: string, amount: number, source = "hero"): Effect => ({
  type: "damage",
  target,
  amount,
  source,
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const pool = (s: GameState) => s.sideSchemes.find((p) => p.code === "45071");
/** Set the threat on Gene Pool. */
function poolAt(s: GameState, n: number) {
  pool(s)!.counters = n;
  return reload(s);
}
/** Clear the villain's tough status cards. */
function untough(s: GameState) {
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return reload(s);
}

describe("Unus: original source", () => {
  it("registers every face of the Unus, Infinites and Dystopian Nightmare sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aoa" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(UNUS_SCRIPT_CODES)).toEqual(new Set(faces("unus")));
    expect(new Set(INFINITES_CODES)).toEqual(new Set(faces("infinites")));
    expect(new Set(DYSTOPIAN_NIGHTMARE_CODES)).toEqual(
      new Set(faces("dystopian_nightmare")),
    );
    for (const code of [
      ...UNUS_SCRIPT_CODES,
      ...INFINITES_CODES,
      ...DYSTOPIAN_NIGHTMARE_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "unus")).toMatchObject({
      codes: ["45059", "45060", "45061"],
      schemes: ["45062b"],
      defaultModules: ["dystopian_nightmare"],
      fixedSets: ["infinites"],
    });
    expect(MODULES.slice(-20, -18).map((m) => m.id)).toEqual([
      "infinites",
      "dystopian_nightmare",
    ]);
    // Infinites is required: Unus cannot take it as its modular set.
    expect(scenarioModules("unus").map((m) => m.id)).not.toContain("infinites");
  });

  it("starts with Gene Pool in play at 4 threat, out of the encounter deck", () => {
    for (const [difficulty, code] of [
      ["standard", "45059"],
      ["expert", "45060"],
    ] as const)
      for (const players of [1, 2]) {
        const s = started(difficulty, players);
        expect(s.villain.code).toBe(code);
        expect(s.villain.tough).toBe(true);
        expect(s.scheme.code).toBe("45062b");
        expect(s.scheme.threat).toBe(0);
        expect(pool(s)?.counters).toBe(4);
        const deck = s.encounter.deck.map((p) => p.code);
        expect(deck).not.toContain("45071");
        expect(deck.filter((c) => c === "45069")).toHaveLength(5);
        for (const c of ["45063", "45064", "45072", "45073", "45074"])
          expect(deck, c).toContain(c);
      }
  });

  it("expert mode deals each player a facedown encounter card", () => {
    for (const players of [1, 2]) {
      expect(opened("standard", players).encounter.dealt).toHaveLength(0);
      const s = opened("expert", players);
      expect(
        s.players.map(
          (seat) =>
            s.encounter.dealt.filter((p) => p.dealtTo === seat.id).length,
        ),
      ).toEqual(Array(players).fill(1));
    }
  });

  it("Gene Pool joins any scenario with the Infinites modular set", () => {
    const s = started("standard", 1, "rhino", ["infinites"]);
    expect(pool(s)?.counters).toBe(4);
    const deck = s.encounter.deck.map((p) => p.code);
    expect(deck).not.toContain("45071");
    expect(deck.filter((c) => c === "45069")).toHaveLength(5);
    expect(deck.filter((c) => c === "45070")).toHaveLength(2);
    // Without the Infinites set there is no Gene Pool.
    expect(pool(started("standard", 1, "rhino"))).toBeUndefined();
  });
});

describe("Unus and Gene Pool", () => {
  it("Hunting Gene Traitors places 1 threat on Gene Pool after step one", () => {
    let s = started();
    const main = s.scheme.threat;
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBeGreaterThan(main);
    expect(pool(s)?.counters).toBe(5);
  });

  it("Gene Pool gains 3 threat after an ally is defeated, but not by consequential damage", () => {
    let s = started();
    const first = ally(s);
    s = settle(native(reload(s), hit(first.id, 9, s.villain.id)));
    expect(s.player.inPlay.some((p) => p.id === first.id)).toBe(false);
    expect(pool(s)?.counters).toBe(7);
    const second = ally(s);
    s = settle(native(reload(s), hit(second.id, 9, "consequential")));
    expect(s.player.inPlay.some((p) => p.id === second.id)).toBe(false);
    expect(pool(s)?.counters).toBe(7);
  });

  it("Unus gains retaliate 1 with 3 threat on Gene Pool", () => {
    let s = untough(poolAt(started(), 2));
    const hp = s.player.hp;
    s = settle(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.hp).toBe(hp);
    s = untough(poolAt(s, 3));
    s.player.exhausted = false;
    s = settle(command(reload(s), { type: "BASIC", action: "attack" }));
    expect(s.player.hp).toBe(hp - 1);
  });

  it("Unus gains stalwart with 6 threat on Gene Pool", () => {
    let s = poolAt(started(), 5);
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(true);
    s.villain.stunned = false;
    s.villain.stunCards = 0;
    s = poolAt(s, 6);
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
  });

  it("Unus gains an amplify icon with 9 threat on Gene Pool", () => {
    let s = poolAt(started(), 8);
    expect(unusAmplify(s)).toBe(0);
    const icons = plain(s);
    const hp = s.player.hp;
    s = settle(native(s, villainAttack(s)));
    const without = hp - s.player.hp;
    expect(without).toBe(card(s.villain).attack! + icons);
    s = poolAt(s, 9);
    expect(unusAmplify(s)).toBe(1);
    s.player.hp = hp;
    const again = plain(s);
    s = settle(native(reload(s), villainAttack(s)));
    expect(hp - s.player.hp).toBe(card(s.villain).attack! + again + 1);
  });

  it("Infinite Soldier gains quickstrike, surge and 3 hit points from Gene Pool", () => {
    let s = poolAt(started(), 0);
    let soldier = engage(s, "45069");
    s = reload(s);
    expect(genePoolLevel(s)).toBe(0);
    expect(
      pieceHP(
        s,
        s.minions.find((m) => m.id === soldier.id)!,
      ),
    ).toBe(3);
    s = poolAt(s, 9);
    soldier = s.minions.find((m) => m.id === soldier.id)!;
    expect(pieceHP(s, soldier)).toBe(6);
    // Quickstrike: the next soldier attacks as it engages you.
    s = poolAt(s, 3);
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "45069")));
    expect(s.player.hp).toBe(hp - 2);
    // Surge with 6 threat: another encounter card is revealed.
    s = poolAt(s, 6);
    const next = take(s, "45069");
    const deck = s.encounter.deck.length;
    s = settle(
      resolveEncounter(
        native(s, { type: "reveal", piece: next, actorId: "p1" }),
      ),
    );
    expect(s.minions.some((m) => m.id === next.id)).toBe(true);
    expect(s.encounter.deck.length).toBe(deck - 1);
    // Without 6 threat it does not surge.
    s = poolAt(s, 3);
    const last = take(s, "45069");
    const before = s.encounter.deck.length;
    s = settle(
      resolveEncounter(
        native(s, { type: "reveal", piece: last, actorId: "p1" }),
      ),
    );
    expect(s.encounter.deck.length).toBe(before);
  });
});

describe("Unus encounter cards", () => {
  it("Infinite Hunter deals 3 damage to an ally you control", () => {
    let s = poolAt(started(), 0);
    const target = ally(s);
    s = reload(s);
    const hp = pieceHP(s, target);
    s = settle(resolveEncounter(reveal(s, "45065")));
    const after = s.player.inPlay.find((p) => p.id === target.id);
    if (hp > 3) expect(after?.damage).toBe(3);
    else {
      expect(after).toBeUndefined();
      expect(pool(s)?.counters).toBe(3);
    }
  });

  it("Genetic Experiments: +2 hit points, +1 SCH and ATK, and 2 threat on Gene Pool when the minion is defeated", () => {
    let s = poolAt(started(), 0);
    const soldier = engage(s, "45069");
    s = settle(resolveEncounter(reveal(reload(s), "45066")));
    const experiments = s.attachments.find((a) => a.code === "45066");
    expect(experiments?.attachedTo).toBe(soldier.id);
    const m = s.minions.find((q) => q.id === soldier.id)!;
    expect(pieceHP(s, m)).toBe(5);
    expect(enemyStats(s, m).attack).toBe(3);
    s = settle(native(s, hit(soldier.id, 5)));
    expect(s.minions.some((q) => q.id === soldier.id)).toBe(false);
    expect(pool(s)?.counters).toBe(2);
  });

  it("Genetic Experiments surges without an Infinite minion", () => {
    let s = poolAt(started(), 0);
    const deck = s.encounter.deck.length;
    s = settle(resolveEncounter(reveal(s, "45066")));
    expect(s.attachments.some((a) => a.code === "45066")).toBe(false);
    expect(s.encounter.discard.some((p) => p.code === "45066")).toBe(true);
    expect(s.encounter.deck.length).toBeLessThan(deck);
  });

  it("Infinite Prelate: Unus activates against you, then gets a tough status card and heals 3", () => {
    let s = untough(poolAt(started(), 6));
    s.villain.hp -= 5;
    s = reload(s);
    const villainHp = s.villain.hp;
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "45067")));
    expect(s.player.hp).toBeLessThan(hp);
    expect(s.villain.tough).toBe(true);
    expect(s.villain.hp).toBe(villainHp + 3);
  });

  it("Boosts: Genetic Experiments attaches to an Infinite minion, Infinite Hunter adds 2 SCH and ATK or 2 threat, Culling the Weak adds 2 threat", () => {
    let s = poolAt(started(), 0);
    const soldier = engage(s, "45069");
    stack(s, take(s, "45066"));
    s = settle(native(reload(s), villainAttack(s)));
    const experiments = s.attachments.find((a) => a.code === "45066");
    expect(experiments?.attachedTo).toBe(soldier.id);
    expect(s.encounter.discard.some((p) => p.code === "45066")).toBe(false);
    // Infinite Hunter's boost: +2 ATK for the activation.
    s = untough(poolAt(s, 0));
    stack(s, take(s, "45065"));
    let hp = s.player.hp;
    s = settle(
      native(reload(s), villainAttack(s)),
      (v) => v.prompt?.options.find((o) => o.id === "stats")?.id,
    );
    expect(hp - s.player.hp).toBe(card(s.villain).attack! + 2);
    // Or 2 threat on Gene Pool.
    stack(s, take(s, "45065"));
    hp = s.player.hp;
    s = settle(
      native(reload(s), villainAttack(s)),
      (v) => v.prompt?.options.find((o) => o.id === "pool")?.id,
    );
    expect(hp - s.player.hp).toBe(card(s.villain).attack!);
    expect(pool(s)?.counters).toBe(2);
    // Culling the Weak's boost: 2 threat on Gene Pool.
    stack(s, take(s, "45070"));
    s = settle(native(reload(s), villainAttack(s)));
    expect(pool(s)?.counters).toBe(4);
  });

  it("Culling the Weak places 4 threat on Gene Pool", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "45070")));
    expect(pool(s)?.counters).toBe(8);
  });

  it("Endless Ranks places 3 threat on Gene Pool when defeated", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "45068")));
    const ranks = s.sideSchemes.find((p) => p.code === "45068")!;
    expect(ranks.counters).toBe(4);
    s = settle(
      native(s, {
        type: "thwart",
        target: ranks.id,
        amount: ranks.counters,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.some((p) => p.id === ranks.id)).toBe(false);
    expect(pool(s)?.counters).toBe(7);
  });

  it("Gene Pool is permanent: clearing its threat leaves it in play", () => {
    let s = started();
    const p = pool(s)!;
    s = settle(
      native(s, { type: "thwart", target: p.id, amount: 4, source: "hero" }),
    );
    expect(pool(s)?.counters).toBe(0);
  });

  it("Prelate Armor: +1 SCH, and Unus gets a tough status card after he schemes", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, "45064")));
    expect(s.attachments.find((a) => a.code === "45064")?.attachedTo).toBe(
      s.villain.id,
    );
    expect(enemyStats(s, s.villain).scheme).toBe(card(s.villain).scheme! + 1);
    s = untough(s);
    s.player.form = "alter";
    s = settle(
      native(reload(s), {
        type: "enemyScheme",
        id: s.villain.id,
        actorId: "p1",
      }),
    );
    expect(s.villain.tough).toBe(true);
  });

  it("Prelate Sidearm and Prelate Armor leave after a basic attack against Unus for their resources", () => {
    let s = untough(poolAt(started(), 0));
    const sidearm = attach(s, "45063");
    const energy = playerCard(s, "01088");
    const strength = playerCard(s, "01090");
    s.player.hand.push(energy, strength);
    s = command(reload(s), { type: "BASIC", action: "attack" });
    s = settle(
      s,
      (v) =>
        v.prompt?.options.some((o) => o.id === sidearm.id)
          ? sidearm.id
          : undefined,
      true,
    );
    s = settle(pay(s, [energy, strength]));
    expect(s.attachments.some((p) => p.id === sidearm.id)).toBe(false);
  });

  it("Prelate Sidearm places 1 threat on Gene Pool after Unus defeats an ally", () => {
    let s = poolAt(started(), 0);
    attach(s, "45063");
    const defender = ally(s);
    defender.damage = pieceHP(s, defender) - 1;
    s = settle(
      native(reload(s), villainAttack(s)),
      (v) => v.prompt?.options.find((o) => o.id === defender.id)?.id,
    );
    expect(s.player.inPlay.some((p) => p.id === defender.id)).toBe(false);
    expect(pool(s)?.counters).toBe(4);
  });
});

describe("Dystopian Nightmare", () => {
  it("Hunted stays in your play area with its hazard icon; its Alter-Ego Action discards a card from your hand", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "45072")));
    const hunted = s.player.inPlay.find((p) => p.code === "45072")!;
    expect(hunted).toBeTruthy();
    expect(unusHazard(s)).toBe(1);
    s.player.form = "alter";
    s.player.hand.push(s.player.deck.shift()!);
    s = reload(s);
    const options = abilityOptions(s, hunted);
    expect(options).toHaveLength(1);
    const hand = s.player.hand.length;
    s = settle(command(s, { type: "ABILITY", id: hunted.id }));
    expect(s.player.hand).toHaveLength(hand - 1);
    expect(s.player.inPlay.some((p) => p.id === hunted.id)).toBe(false);
    expect(unusHazard(s)).toBe(0);
  });

  it("War-Weary stuns you, or deals 2 damage if you are already stunned", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "45073")));
    expect(s.player.stunned).toBe(true);
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "45073")));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.stunned).toBe(true);
  });

  it("Targeted for Extermination confuses the player who defeats it", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "45074")));
    const scheme = s.sideSchemes.find((p) => p.code === "45074")!;
    expect(scheme.counters).toBe(3);
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: scheme.counters,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.player.confused).toBe(true);
  });
});
