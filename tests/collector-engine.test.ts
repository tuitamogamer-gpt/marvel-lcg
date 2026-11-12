/** Infiltrate the Museum, Galactic Artifacts and Menagerie Medley exercised with
 * the original physical cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  card,
  heroStats,
  scenarioModules,
} from "../src/game/cards";
import { abilityOptions, newGame, schemeLimit } from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import { COLLECTOR_SCRIPT_CODES } from "../src/game/collector";
import type { GameState, Piece, Resource } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "infiltrate_the_museum",
    difficulty,
    seed: 16070,
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
          ["none", "hero", "damage", "allow", "resolve", "collect"].includes(
            o.id,
          ),
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
    s.collector!.villainDeck,
    [s.collector!.currentMain],
    s.collector!.collection,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** Twelve selected scenario cards and the nine Galactic Artifacts stay in
 * exactly one zone each, including The Collection. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(
    all.filter((p) => card(p).set_code === "infiltrate_the_museum"),
  ).toHaveLength(12);
  expect(
    all.filter((p) => card(p).set_code === "galactic_artifacts"),
  ).toHaveLength(9);
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
function resource(s: GameState, type: Resource) {
  const p = s.player.deck.find((p) => card(p)[`resource_${type}`])!;
  expect(p).toBeTruthy();
  s.player.deck.splice(s.player.deck.indexOf(p), 1);
  s.player.hand.push(p);
  return p;
}
function ally(s: GameState) {
  const p = s.player.deck.find((p) => card(p).type_code === "ally")!;
  s.player.deck.splice(s.player.deck.indexOf(p), 1);
  s.player.inPlay.push(p);
  return p;
}
const collection = (s: GameState) => s.collector!.collection;

describe("Infiltrate the Museum original source", () => {
  it("registers every face of the scenario, Galactic Artifacts and Menagerie Medley", () => {
    for (const set of [
      "infiltrate_the_museum",
      "galactic_artifacts",
      "menagerie_medley",
    ])
      for (const c of CATALOG_CARDS.filter(
        (c) => c.set_code === set && c.pack_code === "gmw",
      ))
        expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(COLLECTOR_SCRIPT_CODES).toHaveLength(22);
    expect(scenarioModules("infiltrate_the_museum")).toHaveLength(34);
  });
  it.each([1, 2, 3])(
    "creates The Collection with each player's top card for %i players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        expect(s.modules).toEqual(["menagerie_medley"]);
        expect(s.villain.code).toBe(
          difficulty === "expert" ? "16071" : "16070",
        );
        expect(s.scheme).toMatchObject({ code: "16073b", threat: 4 * players });
        expect(schemeLimit(s)).toBe(10 * players);
        // Expert's Collector (II): each player chose to add a card instead
        // of taking 3 damage, so expert adds a second card per player.
        expect(collection(s)).toHaveLength(
          (difficulty === "expert" ? 2 : 1) * players,
        );
        for (const p of collection(s))
          expect(card(p).faction_code).not.toBe("encounter");
        expect(
          s.encounter.deck.filter(
            (p) => card(p).set_code === "galactic_artifacts",
          ),
        ).toHaveLength(9);
        exact(reload(s));
      }
    },
  );
  it("advances the physical Collector stages and wins after the last one", () => {
    let s = started("standard");
    const old = s.villain.id;
    s = settle(
      native(s, { type: "damage", target: old, amount: s.villain.hp }),
    );
    expect(s.villain.code).toBe("16071");
    expect(s.removed.some((p) => p.id === old)).toBe(true);
    exact(reload(s));
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.phase).toBe("won");
  });
  it("loses when The Grand Collection completes", () => {
    let s = started();
    s = settle(native(s, { type: "threat", target: "main", amount: 10 }));
    expect(s.phase).toBe("lost");
  });
});

describe("The Collection", () => {
  it("collects player and encounter cards that would be discarded from play", () => {
    let s = started();
    const before = collection(s).length;
    const helper = ally(s);
    s = settle(native(s, { type: "discardPiece", id: helper.id }));
    expect(collection(s).at(-1)?.id).toBe(helper.id);
    expect(collection(s).at(-1)?.ownerId).toBe("p1");
    s = settle(reveal(s, "16136"));
    const bot = s.minions.find((p) => p.code === "16136")!;
    s = settle(native(s, { type: "damage", target: bot.id, amount: 3 }));
    expect(s.minions.some((p) => p.id === bot.id)).toBe(false);
    expect(collection(s).map((p) => p.id)).toContain(bot.id);
    expect(collection(s)).toHaveLength(before + 2);
    exact(s);
  });
  it("does not collect a card that returns to hand or shuffles into a deck", () => {
    let s = started();
    const before = collection(s).length;
    const returned = ally(s);
    s = settle(native(s, { type: "ms:red-return", id: returned.id }));
    expect(s.player.hand.map((p) => p.id)).toContain(returned.id);
    expect(collection(s)).toHaveLength(before);
    exact(s);
  });
  it("sends Victory 0 artifacts to the victory display and rewards their defeater", () => {
    let s = started();
    s.player.hp = 5;
    s = settle(reveal(s, "16128"));
    const teapot = s.sideSchemes.find((p) => p.code === "16128")!;
    expect(teapot.counters).toBe(3 + 2);
    s = native(s, {
      type: "thwart",
      target: teapot.id,
      amount: teapot.counters,
    });
    s = settle(
      s,
      (state) => state.prompt?.options.find((o) => o.id === "yes")?.id,
    );
    expect((s.victoryDisplay || []).map((p) => p.id)).toContain(teapot.id);
    expect(collection(s).map((p) => p.id)).not.toContain(teapot.id);
    expect(s.player.hp).toBe(9);
    exact(s);
  });
  it("adds 1 threat for each collected discard while Collector (III) is in play", () => {
    let s = started("expert");
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.villain.code).toBe("16072");
    const threat = s.scheme.threat;
    const helper = ally(s);
    s = settle(native(s, { type: "discardPiece", id: helper.id }));
    expect(s.scheme.threat).toBe(threat + 1);
  });
  it("loses with five cards per player in The Collection", () => {
    let s = started("standard", 1);
    while (collection(s).length < 4) collection(s).push(s.player.deck.pop()!);
    const helper = ally(s);
    s = settle(native(s, { type: "discardPiece", id: helper.id }));
    expect(s.phase).toBe("lost");
  });
  it("returns a card to its owner's discard pile with the once-per-round Hero Action", () => {
    let s = started();
    const main = s.collector!.currentMain;
    const first = collection(s)[0];
    expect(abilityOptions(s, main).map((o) => o.id)).toEqual(
      expect.arrayContaining(["release-exhaust"]),
    );
    s = settle(
      command(reload(s), {
        type: "ABILITY",
        id: main.id,
        action: "release-exhaust",
      }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(collection(s).some((p) => p.id === first.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === first.id)).toBe(true);
    // Once per round per player.
    collection(s).push(s.player.deck.pop()!);
    s.player.exhausted = false;
    expect(abilityOptions(s, s.collector!.currentMain)).toEqual([]);
    exact(s);
  });
});

describe("Collector's encounter cards", () => {
  it("Biogram Image prevents damage to the Collector and becomes threat", () => {
    let s = started();
    s = settle(reveal(s, "16074"));
    const biogram = s.attachments.find((p) => p.code === "16074")!;
    expect(biogram.attachedTo).toBe(s.villain.id);
    const hp = s.villain.hp,
      threat = s.scheme.threat;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 4 }));
    expect(s.villain.hp).toBe(hp);
    expect(s.scheme.threat).toBe(threat + 4);
    expect(collection(s).map((p) => p.id)).toContain(biogram.id);
    exact(s);
  });
  it("Inconspicuous Box collects the lowest cost card you control, or surges", () => {
    let s = started();
    const helper = ally(s);
    s = settle(reveal(s, "16076"));
    expect(collection(s).map((p) => p.id)).toContain(helper.id);
    expect(s.player.inPlay.some((p) => p.id === helper.id)).toBe(false);
    exact(s);
  });
  it("View the Cosmos collects or discards the highest cost card in hand", () => {
    let s = started();
    const cheap = resource(s, "energy");
    const pricey = s.player.deck.find((p) => (card(p).cost || 0) >= 3)!;
    s.player.deck.splice(s.player.deck.indexOf(pricey), 1);
    s.player.hand.push(pricey);
    const threat = s.scheme.threat;
    s = reveal(s, "16077");
    s = settle(choose(s, `discard:${pricey.id}`));
    expect(s.player.discard.map((p) => p.id)).toContain(pricey.id);
    expect(s.player.hand.map((p) => p.id)).toContain(cheap.id);
    expect(s.scheme.threat).toBe(threat + card(pricey).cost!);
    exact(s);
  });
  it("Stay Awhile in alter-ego spends two physical or collects the top card", () => {
    let s = started();
    s.player.form = "alter";
    const before = collection(s).length;
    s = reveal(s, "16078");
    s = settle(choose(s, "collect"));
    expect(collection(s)).toHaveLength(before + 1);
    exact(s);
  });
  it("Stay Awhile in hero form attacks with +1 ATK and collects after damage", () => {
    let s = started();
    const before = collection(s).length,
      hp = s.player.hp;
    s = settle(
      reveal(s, "16078"),
      (state) =>
        state.prompt?.options.find((o) => /take|no defender/i.test(o.label))
          ?.id,
    );
    // Collector (I) 1 ATK + 1, plus the attack's ordinary boost card.
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(2);
    expect(collection(s)).toHaveLength(before + 1);
    exact(s);
  });
  it("Collector (III) collects each player's top card and threatens for the whole Collection", () => {
    let s = started("standard", 2);
    s.collector!.villainDeck = [];
    const threat = s.scheme.threat;
    s.villain.code = "16072";
    s = settle(
      native(
        s,
        ...[
          { type: "collector:top", playerId: "p1" },
          { type: "collector:top", playerId: "p2" },
          { type: "collector:threat-per-card" },
        ],
      ),
    );
    expect(collection(s)).toHaveLength(4);
    expect(s.scheme.threat).toBe(threat + 4);
  });
});

describe("Galactic Artifacts", () => {
  it("attaches enemy artifacts by ATK and SCH and discards them into The Collection", () => {
    let s = started();
    s = settle(reveal(s, "16136"));
    s = settle(reveal(s, "16122"));
    const cloak = s.attachments.find((p) => p.code === "16122")!;
    // Servant Bot (1 ATK) has a lower ATK than the Collector (1 ATK): tied, chosen.
    expect([s.villain.id, s.minions[0].id]).toContain(cloak.attachedTo);
    s = settle(reveal(s, "16124"));
    expect(s.attachments.find((p) => p.code === "16124")?.attachedTo).toBe(
      s.villain.id,
    );
    const paid = [
      resource(s, "physical"),
      resource(s, "physical"),
      resource(s, "physical"),
    ];
    s = command(reload(s), { type: "ABILITY", id: cloak.id, action: "remove" });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(command(s, { type: "PAY", ids: paid.map((p) => p.id) }));
    expect(s.attachments.some((p) => p.id === cloak.id)).toBe(false);
    // Collector's Forced Interrupt: the discarded artifact joins The Collection.
    expect(collection(s).map((p) => p.id)).toContain(cloak.id);
    exact(s);
  });
  it("Obedience Potion gives the attached identity -1 ATK, THW and DEF", () => {
    let s = started();
    const base = heroStats(s);
    s = settle(reveal(s, "16123"));
    expect(s.attachments.find((p) => p.code === "16123")?.attachedTo).toBe(
      "hero:p1",
    );
    const stats = heroStats(s);
    expect(stats.attack).toBe(base.attack - 1);
    expect(stats.thwart).toBe(base.thwart - 1);
    expect(stats.defense).toBe(base.defense - 1);
  });
  it("The Poison adds a counter and deals that much damage when your turn begins", () => {
    let s = started();
    s = settle(reveal(s, "16125"));
    const hp = s.player.hp;
    s = settle(native(s, { type: "beginTurn", actorId: "p1" }));
    expect(s.player.hp).toBe(hp - 1);
    s = settle(native(s, { type: "beginTurn", actorId: "p1" }));
    expect(s.player.hp).toBe(hp - 3);
  });
});

describe("Menagerie Medley", () => {
  it("Psionic Ghost confuses you, or deals 1 damage if you are already confused", () => {
    let s = started();
    s = settle(reveal(s, "16135"));
    expect(s.player.confused).toBe(true);
    const hp = s.player.hp;
    s = settle(reveal(s, "16135"));
    expect(s.player.hp).toBe(hp - 1);
  });
  it("Starshark's attack deals indirect damage", () => {
    let s = started();
    const helper = ally(s);
    const titles: string[] = [];
    const hp = s.player.hp;
    s = settle(reveal(s, "16137"), (state) => {
      titles.push(state.prompt?.title || "");
      return state.prompt?.options.find((o) =>
        /take|no defender/i.test(o.label),
      )?.id;
    });
    expect(s.minions.some((p) => p.code === "16137")).toBe(true);
    // Quickstrike attack: its damage is assigned as indirect damage.
    expect(titles.some((t) => /Starshark|indirect/i.test(t))).toBe(true);
    const allyDamage =
      s.player.inPlay.find((p) => p.id === helper.id)?.damage ??
      card(helper).health ??
      0;
    expect(hp - s.player.hp + allyDamage).toBeGreaterThanOrEqual(3);
    exact(s);
  });
});
