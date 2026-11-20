/** Age of Apocalypse: Apocalypse with his Prelates and the Dark Riders
 * modular set, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { enemyStats, newGame } from "../src/game/engine";
import {
  APOCALYPSE_SCRIPT_CODES,
  DARK_RIDERS_CODES,
  PRELATE_CODES,
  apocalypseCaption,
  apocalypseCitadel,
  apocalypseStage,
  noLongerWorthy,
  prelates,
} from "../src/game/apocalypse";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

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
  villainId = "apocalypse",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 45101,
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
function opened(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "apocalypse",
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
  villainId = "apocalypse",
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
function own(s: GameState, type: string) {
  const view = s.player;
  const i = view.deck.findIndex((p) => card(p).type_code === type);
  expect(i, type).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.inPlay.push(p);
  return p;
}
const hit = (target: string, amount: number, source = "hero"): Effect => ({
  type: "damage",
  target,
  amount,
  source,
});
const attack = (id: string, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id,
  actorId: playerId,
});
/** Clear Apocalypse's tough status cards. */
function untough(s: GameState) {
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return reload(s);
}
const scheme = (s: GameState, code: string) =>
  s.sideSchemes.find((p) => p.code === code);
/** Remove every Prelate from play to the encounter discard pile. */
function noPrelates(s: GameState) {
  for (const m of prelates(s)) {
    s.minions = s.minions.filter((q) => q.id !== m.id);
    s.encounter.discard.push(m);
  }
  return reload(s);
}
const limit = (s: GameState) => 9 * s.playerCount;

describe("Apocalypse: original source", () => {
  it("registers every face of the Apocalypse, Prelates and Dark Riders sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aoa" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(APOCALYPSE_SCRIPT_CODES)).toEqual(
      new Set(faces("apocalypse")),
    );
    expect(new Set(PRELATE_CODES)).toEqual(new Set(faces("prelates")));
    expect(new Set(DARK_RIDERS_CODES)).toEqual(new Set(faces("dark_riders")));
    for (const code of [
      ...APOCALYPSE_SCRIPT_CODES,
      ...PRELATE_CODES,
      ...DARK_RIDERS_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "apocalypse")).toMatchObject({
      codes: ["45101b", "45102a", "45102b"],
      schemes: ["45103b"],
      defaultModules: ["dark_riders", "infinites"],
      fixedSets: ["prelates"],
    });
    expect(MODULES.at(-8)?.id).toBe("dark_riders");
    expect(scenarioModules("apocalypse")).toHaveLength(MODULES.length);
  });

  it("starts with Heart of the Empire, a Prelate engaged with the first player and the rest set aside", () => {
    for (const [difficulty, code, stage, hp] of [
      ["standard", "45101b", 2, 9],
      ["expert", "45102a", 3, 10],
    ] as const)
      for (const players of [1, 2]) {
        const s = started(difficulty, players);
        expect(s.villain.code).toBe(code);
        expect(apocalypseStage(s)).toBe(stage);
        expect(s.villain.stage).toBe(stage);
        expect(s.villain.hp).toBe(hp * players);
        expect(s.scheme.code).toBe("45103b");
        expect(s.scheme.threat).toBe(players);
        expect(scheme(s, "45104a")?.counters).toBe(2);
        const list = prelates(s);
        expect(list).toHaveLength(1);
        expect(list[0].engagedWith).toBe(s.firstPlayerId);
        expect(s.apocalypse!.prelates).toHaveLength(4);
        expect(s.apocalypse!.throne?.code).toBe("45105a");
        const deck = s.encounter.deck.map((p) => p.code);
        for (const c of [
          "45104a",
          "45104b",
          "45105a",
          "45105b",
          ...PRELATE_CODES,
        ])
          expect(deck, c).not.toContain(c);
      }
  });
});

describe("Apocalypse", () => {
  it("The Age of Apocalypse: instead of being defeated he discards his attachments, heals and the scheme loses X threat", () => {
    let s = untough(started());
    stack(s, take(s, "45107"));
    s = settle(resolveEncounter(reveal(s, "45107")));
    expect(s.attachments.some((a) => a.code === "45107")).toBe(true);
    s.scheme.threat = 15;
    s = reload(s);
    const max = s.villain.maxHp;
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.phase).not.toBe("won");
    expect(s.villain.hp).toBe(max);
    expect(s.attachments.some((a) => a.code === "45107")).toBe(false);
    expect(s.scheme.threat).toBe(15 - 9);
  });

  it("each completed main scheme reveals the next Apocalypse; Apocalypse (IV) loses", () => {
    let s = started();
    s.scheme.threat = limit(s) - 1;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.villain.code).toBe("45102a");
    expect(s.villain.hp).toBe(10 * s.playerCount);
    expect(s.scheme.threat).toBe(0);
    s.scheme.threat = 10 * s.playerCount - 1;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.villain.code).toBe("45102b");
    expect(s.scheme.threat).toBe(0);
    s.scheme.threat = 11 * s.playerCount - 1;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.phase).toBe("lost");
  });

  it("the citadel's schemes keep their threat while a Prelate is in play and lead to No Longer Worthy", () => {
    let s = started();
    const heart = scheme(s, "45104a")!;
    expect(apocalypseCitadel(s)).toBe(0);
    expect(apocalypseCaption(s)).toBe(
      "At 0 he heals and the main scheme loses 9 threat",
    );
    s = settle(
      native(s, {
        type: "thwart",
        target: heart.id,
        amount: 2,
        source: "hero",
      }),
    );
    expect(scheme(s, "45104a")?.counters).toBe(2);
    s = noPrelates(s);
    s = settle(
      native(s, {
        type: "thwart",
        target: heart.id,
        amount: 2,
        source: "hero",
      }),
    );
    expect(scheme(s, "45104a")).toBeUndefined();
    const citadel = scheme(s, "45104b")!;
    expect(citadel.id).toBe(heart.id);
    expect(citadel.counters).toBe(3);
    expect(apocalypseCitadel(s)).toBe(1);
    expect(prelates(s)).toHaveLength(1);
    s = noPrelates(s);
    s = settle(
      native(s, {
        type: "thwart",
        target: citadel.id,
        amount: 3,
        source: "hero",
      }),
    );
    const throne = scheme(s, "45105a")!;
    expect(throne.counters).toBe(4);
    expect(apocalypseCitadel(s)).toBe(2);
    s = noPrelates(untough(s));
    s.villain.hp -= 6;
    s = reload(s);
    const hp = s.villain.hp;
    s = settle(
      native(s, {
        type: "thwart",
        target: throne.id,
        amount: 4,
        source: "hero",
      }),
    );
    const worthy = s.attachments.find((a) => a.code === "45105b");
    expect(worthy?.attachedTo).toBe(s.villain.id);
    expect(apocalypseCitadel(s)).toBe(3);
    expect(noLongerWorthy(s)).toBe(true);
    expect(apocalypseCaption(s)).toBe(
      "No Longer Worthy · no damage while a Prelate is in play",
    );
    expect(s.villain.hp).toBe(Math.min(s.villain.maxHp, hp + 5));
    // He cannot take damage while a Prelate is in play.
    expect(prelates(s)).toHaveLength(1);
    s = untough(s);
    const before = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(before);
    s = noPrelates(s);
    expect(apocalypseCaption(s)).toBe("No Longer Worthy · defeat him to win");
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.phase).toBe("won");
  });
});

describe("Apocalypse encounter cards", () => {
  it("Cyberpathy: after Apocalypse schemes, 1 threat on each side scheme", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "45106")));
    expect(enemyStats(s, s.villain).scheme).toBe(card(s.villain).scheme! + 1);
    const heart = scheme(s, "45104a")!.counters;
    s.player.form = "alter";
    s = settle(
      native(reload(s), {
        type: "enemyScheme",
        id: s.villain.id,
        actorId: "p1",
      }),
    );
    expect(scheme(s, "45104a")?.counters).toBe(heart + 1);
  });

  it("Molecular Control gives Apocalypse retaliate 1 and stalwart", () => {
    let s = untough(noPrelates(started()));
    s = settle(resolveEncounter(reveal(s, "45108")));
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    const hp = s.player.hp;
    s = settle(command(untough(s), { type: "BASIC", action: "attack" }));
    expect(s.player.hp).toBe(hp - 1);
  });

  it("The Fittest rides the minion with the highest printed hit points with a tough status card, or surges", () => {
    let s = started();
    const prelate = prelates(s)[0];
    s = settle(resolveEncounter(reveal(s, "45109")));
    const fittest = s.attachments.find((a) => a.code === "45109");
    expect(fittest?.attachedTo).toBe(prelate.id);
    expect(s.minions.find((m) => m.id === prelate.id)?.tough).toBe(true);
    s = noPrelates(s);
    const deck = s.encounter.deck.length;
    const next = take(s, "45109");
    const remaining = s.encounter.deck.length;
    s = settle(
      resolveEncounter(
        native(s, { type: "reveal", piece: next, actorId: "p1" }),
      ),
    );
    expect(deck).toBe(remaining + 1);
    expect(s.encounter.deck.length).toBe(remaining - 1);
    expect(s.encounter.discard.some((p) => p.id === next.id)).toBe(true);
  });

  it("Wolf Among Sheep: the Prelate activates against you, otherwise Apocalypse", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "45110")));
    expect(s.player.hp).toBeLessThan(hp);
    s = noPrelates(s);
    const next = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "45110")));
    expect(s.player.hp).toBeLessThan(next);
  });

  it("The Apocalypse Solution: its defeater's When Defeated discards the top X encounter cards", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "45111")));
    const solution = scheme(s, "45111")!;
    const deck = s.encounter.deck.length;
    s = settle(
      native(s, {
        type: "thwart",
        target: solution.id,
        amount: solution.counters,
        source: "hero",
      }),
    );
    expect(deck - s.encounter.deck.length).toBeGreaterThanOrEqual(
      Math.min(9, deck),
    );
  });

  it("Prelates go to the victory display", () => {
    let s = started();
    const prelate = prelates(s)[0];
    prelate.tough = false;
    prelate.toughCards = 0;
    s = settle(native(reload(s), hit(prelate.id, 50)));
    expect(s.victoryDisplay?.some((p) => p.id === prelate.id)).toBe(true);
  });

  it("Abyss attaches the top card of your deck facedown after he activates, with 2 hit points each", () => {
    let s = started();
    for (const m of prelates(s)) {
      s.minions = s.minions.filter((q) => q.id !== m.id);
      s.encounter.discard.push(m);
    }
    const abyss = s.apocalypse!.prelates.find((p) => p.code === "45181b")!;
    s.apocalypse!.prelates = s.apocalypse!.prelates.filter(
      (p) => p.id !== abyss.id,
    );
    abyss.engagedWith = "p1";
    abyss.tough = false;
    s.minions.push(abyss);
    s = reload(s);
    const deck = s.player.deck.length;
    s = settle(native(s, attack(abyss.id)));
    const after = s.minions.find((m) => m.id === abyss.id)!;
    expect(after.storedCards).toHaveLength(1);
    expect(s.player.deck.length).toBe(deck - 1);
    s = settle(native(s, hit(abyss.id, 100)));
    expect(
      s.player.discard.some((p) => p.id === after.storedCards![0].id),
    ).toBe(true);
  });
});

describe("Dark Riders", () => {
  it("The Dark Riders reveals a Dark Rider, who gains toughness", () => {
    let s = started("standard", 1, "rhino", ["dark_riders"]);
    s = settle(resolveEncounter(reveal(s, "45117")));
    expect(scheme(s, "45117")).toBeTruthy();
    const rider = s.minions.find((m) =>
      ["45112", "45113", "45114", "45115", "45116"].includes(m.code),
    );
    expect(rider).toBeTruthy();
    expect(rider!.tough).toBe(true);
  });

  it("Tusk stuns you and Psynapse confuses you after attacking", () => {
    let s = started("standard", 1, "rhino", ["dark_riders"]);
    const tusk = take(s, "45115");
    tusk.engagedWith = "p1";
    s.minions.push(tusk);
    s = settle(native(reload(s), attack(tusk.id)));
    expect(s.player.stunned).toBe(true);
    const psynapse = take(s, "45116");
    psynapse.engagedWith = "p1";
    s.minions.push(psynapse);
    s = settle(native(reload(s), attack(psynapse.id)));
    expect(s.player.confused).toBe(true);
  });

  it("Hard-Drive places 1 threat on each scheme after attacking", () => {
    let s = started("standard", 1, "rhino", ["dark_riders"]);
    const drive = take(s, "45114");
    drive.engagedWith = "p1";
    s.minions.push(drive);
    const main = s.scheme.threat;
    s = settle(native(reload(s), attack(drive.id)));
    expect(s.scheme.threat).toBe(main + 1);
  });
});
