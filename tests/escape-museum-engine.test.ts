/** Escape the Museum with the original physical cards: Collector's wounded
 * side, the three reversed main scheme stages, Library Labyrinth / Museum
 * Ship and the set-aside Ship Command set. Every command crosses a JSON
 * save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { abilityOptions, enemyStats, newGame } from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import { ESCAPE_SCRIPT_CODES } from "../src/game/escape-museum";
import type { GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "escape_the_museum",
    difficulty,
    seed: 16080,
    pacing: "expert",
    heroes: [
      { heroId: "spider_man", aspect: "justice" },
      ...(players >= 2
        ? [{ heroId: "captain_marvel", aspect: "aggression" as const }]
        : []),
      ...(players >= 3
        ? [{ heroId: "iron_man", aspect: "leadership" as const }]
        : []),
    ],
  });
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 150; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  return reload(s);
}
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
    [s.escape!.currentMain],
    s.escape!.mainDeck,
    s.escape!.setAside,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** Eleven scenario cards (one villain, three main schemes, Library Labyrinth
 * and six treacheries), nine Galactic Artifacts and seven Ship Command cards
 * each stay in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(
    all.filter((p) => card(p).set_code === "escape_the_museum"),
  ).toHaveLength(11);
  expect(
    all.filter((p) => card(p).set_code === "galactic_artifacts"),
  ).toHaveLength(9);
  expect(all.filter((p) => card(p).set_code === "ship_command")).toHaveLength(
    7,
  );
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of zones(s)) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function ally(s: GameState) {
  const p = s.player.deck.find((p) => card(p).type_code === "ally")!;
  s.player.deck.splice(s.player.deck.indexOf(p), 1);
  s.player.inPlay.push(p);
  return p;
}
const labyrinth = (s: GameState) =>
  (s.environments || []).find((p) => ["16085a", "16085b"].includes(p.code))!;
const milano = (s: GameState) =>
  s.players
    .flatMap((seat) => seatView(s, seat).player.inPlay)
    .find((p) => p.code === "16142");
/** Remove every threat from the current main scheme stage. */
function clearMain(s: GameState) {
  return settle(
    native(s, { type: "thwart", target: "main", amount: s.scheme.threat }),
  );
}

describe("Escape the Museum original source", () => {
  it("registers every face and the scenario with its fixed sets", () => {
    const source = CATALOG_CARDS.filter(
      (c) => c.set_code === "escape_the_museum" && c.pack_code === "gmw",
    ).map((c) => c.code);
    expect([...ESCAPE_SCRIPT_CODES].sort()).toEqual(source.sort());
    for (const code of ESCAPE_SCRIPT_CODES)
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "escape_the_museum")).toMatchObject({
      codes: ["16080a", "16081a"],
      schemes: ["16082b"],
      module: "menagerie_medley",
      fixedSets: ["galactic_artifacts", "ship_command"],
    });
    expect(scenarioModules("escape_the_museum")).toHaveLength(MODULES.length);
    expect(
      scenarioModules("escape_the_museum").some(
        (m) => m.id === "menagerie_medley",
      ),
    ).toBe(true);
  });
  it.each([1, 2, 3])(
    "sets up Collector, The Missing Milano and Library Labyrinth for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        expect(s.villain.code).toBe(
          difficulty === "expert" ? "16081a" : "16080a",
        );
        expect(s.villain.hp).toBe((difficulty === "expert" ? 10 : 8) * players);
        expect(s.scheme.code).toBe("16082b");
        expect(s.scheme.threat).toBe(7 * players);
        expect(labyrinth(s).code).toBe("16085a");
        expect(s.escape!.setAside.map((p) => p.code).sort()).toEqual([
          "16142",
          "16143",
          "16144",
          "16145",
          "16146",
          "16147",
          "16148",
        ]);
        expect(milano(s)).toBeUndefined();
        expect(
          s.encounter.deck.filter(
            (p) => card(p).set_code === "escape_the_museum",
          ),
        ).toHaveLength(6);
        expect(
          s.encounter.deck.some((p) => card(p).set_code === "ship_command"),
        ).toBe(false);
        exact(reload(s));
      }
    },
  );
  it("gives Collector +X ATK and SCH, X the main scheme's stage", () => {
    let s = started("standard");
    expect(enemyStats(s, s.villain)).toEqual({ attack: 2, scheme: 2 });
    s = clearMain(s);
    expect(s.scheme.code).toBe("16083b");
    expect(enemyStats(s, s.villain)).toEqual({ attack: 3, scheme: 3 });
  });
});

describe("Collector cannot be defeated", () => {
  it("flips instead, removes 3 threat per player and recovers when the round ends", () => {
    let s = started("standard", 2);
    s.scheme.threat = 10;
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.phase).not.toBe("won");
    expect(s.villain.code).toBe("16080b");
    expect(s.scheme.threat).toBe(10 - 6);
    expect(enemyStats(s, s.villain)).toEqual({ attack: 0, scheme: 0 });
    // The wounded side cannot be defeated.
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 5 }));
    expect(s.phase).not.toBe("won");
    expect(s.villain.code).toBe("16080b");
    expect(s.scheme.threat).toBe(4);
    s = settle(native(s, { type: "newRound", badoonEnded: true }));
    expect(s.villain.code).toBe("16080a");
    expect(s.villain.hp).toBe(16);
    exact(s);
  });
  it("advances when wounding Collector removes the last threat", () => {
    let s = started("standard");
    s.scheme.threat = 2;
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.scheme.code).toBe("16083b");
    expect(s.scheme.threat).toBe(11);
  });
});

describe("The reversed main scheme", () => {
  it("advances through all three stages and wins with no threat on The Great Escape", () => {
    let s = started("standard", 2);
    s = clearMain(s);
    expect(s.scheme.code).toBe("16083b");
    expect(s.scheme.threat).toBe(22);
    // Lost in the Museum (2A): the set-aside Milano enters under the first player.
    expect(milano(s)).toBeTruthy();
    expect(
      seatView(s, s.firstPlayerId).player.inPlay.some(
        (p) => p.code === "16142",
      ),
    ).toBe(true);
    const acceleration = s.encounter.acceleration;
    s = clearMain(s);
    expect(s.scheme.code).toBe("16084b");
    expect(s.scheme.threat).toBe(16);
    // The Great Escape (3A): flip Library Labyrinth, accelerate and shuffle
    // the rest of Ship Command into the encounter deck.
    expect(labyrinth(s).code).toBe("16085b");
    expect(s.encounter.acceleration).toBe(acceleration + 1);
    expect(s.escape!.setAside).toEqual([]);
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "ship_command"),
    ).toHaveLength(6);
    exact(reload(s));
    // First Player Action: exhaust the Milano → remove 3 threat.
    const main = s.escape!.currentMain;
    expect(abilityOptions(s, main).map((o) => o.id)).toContain("milano");
    s = settle(
      command(reload(s), { type: "ABILITY", id: main.id, action: "milano" }),
    );
    expect(s.scheme.threat).toBe(13);
    expect(milano(s)!.exhausted).toBe(true);
    s = clearMain(s);
    expect(s.phase).toBe("won");
  });
  it("loses when a stage is completed", () => {
    let s = started("standard");
    s = settle(native(s, { type: "threat", target: "main", amount: 4 }));
    expect(s.phase).toBe("lost");
  });
});

describe("Library Labyrinth and Museum Ship", () => {
  it("Library Labyrinth deals a facedown encounter card and removes 5 threat once per round", () => {
    let s = started("standard", 2);
    const place = labyrinth(s);
    expect(abilityOptions(s, place).map((o) => o.id)).toEqual(["labyrinth"]);
    const dealt = s.encounter.dealt.length;
    s = settle(
      command(reload(s), {
        type: "ABILITY",
        id: place.id,
        action: "labyrinth",
      }),
    );
    expect(s.scheme.threat).toBe(14 - 5);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    expect(abilityOptions(s, labyrinth(s))).toEqual([]);
    exact(s);
  });
  it("Museum Ship exhausts the Milano or assigns indirect damage among players when the villain phase begins", () => {
    let s = started("standard", 2);
    s = clearMain(clearMain(s));
    expect(labyrinth(s).code).toBe("16085b");
    const hp = s.players.map((seat) => seatView(s, seat).player.hp);
    s = native(s, {
      type: "escape:museum-ship",
      id: labyrinth(s).id,
      actorId: s.firstPlayerId,
    });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["milano", "damage"]);
    s = choose(s, "milano");
    expect(milano(s)!.exhausted).toBe(true);
    // Assign 2 per player: 1 to each hero, then the rest to the first.
    s = choose(s, `one:${s.players[1].id}`);
    s = choose(s, `all:${s.players[0].id}`);
    s = settle(s);
    const lost = s.players.map(
      (seat, i) => hp[i] - seatView(s, seat).player.hp,
    );
    expect(lost).toEqual([3, 1]);
    // Without a ready Milano only the 3-per-player option remains.
    s = native(s, {
      type: "escape:museum-ship",
      id: labyrinth(s).id,
      actorId: s.firstPlayerId,
    });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["damage"]);
    s = choose(s, "damage");
    s = choose(s, `all:${s.players[1].id}`);
    s = settle(s);
    expect(hp[1] - seatView(s, s.players[1]).player.hp).toBe(1 + 6);
  });
});

describe("Escape the Museum treacheries", () => {
  it("I Have You Now! exhausts an alter-ego and Collector schemes", () => {
    let s = started("standard");
    s.player.form = "alter";
    const threat = s.scheme.threat;
    s = settle(reveal(s, "16086"));
    expect(s.player.exhausted).toBe(true);
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 2);
    exact(s);
  });
  it("I Have You Now! stuns a hero and Collector attacks", () => {
    let s = started("standard");
    const hp = s.player.hp;
    s = settle(
      reveal(s, "16086"),
      (state) =>
        state.prompt?.options.find((o) => /take|no defender/i.test(o.label))
          ?.id,
    );
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBeLessThan(hp);
  });
  it("I Have You Now!'s boost gives Collector a tough status card", () => {
    let s = started("standard");
    const boost = take(s, "16086");
    s = settle(native(s, { type: "boostEffect", piece: boost }));
    expect(s.villain.tough).toBe(true);
  });
  it("Impossible Geometry incites 1 and confuses you, or makes you discard a card you control", () => {
    let s = started("standard");
    const threat = s.scheme.threat;
    s = settle(reveal(s, "16087"));
    expect(s.scheme.threat).toBe(threat + 1);
    expect(s.player.confused).toBe(true);
    const helper = ally(s);
    s = reveal(s, "16087");
    s = settle(s, (state) =>
      state.prompt?.title === "Impossible Geometry" ? helper.id : undefined,
    );
    expect(s.player.inPlay.some((p) => p.id === helper.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === helper.id)).toBe(true);
    exact(s);
  });
});
