/** The Nebula scenario, Power Stone and Space Pirates exercised with the
 * original physical cards. Every command crosses a JSON save/reload boundary. */
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
  escalation,
  newGame,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import { NEBULA_VILLAIN_SCRIPT_CODES } from "../src/game/nebula-villain";
import type { GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "nebula",
    difficulty,
    seed: 16088,
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
  // Start each case without setup Techniques on Nebula.
  for (const p of s.attachments.filter((a) => a.code !== "16149"))
    s.encounter.deck.push(p);
  s.attachments = s.attachments.filter((a) => a.code === "16149");
  for (const p of s.attachments) delete p.attachedTo;
  for (const p of s.attachments) p.attachedTo = s.villain.id;
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
    [s.nebulaVillain!.currentMain],
    s.nebulaVillain!.mainDeck,
    s.nebulaVillain!.villainDeck,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** 21 scenario cards, the Power Stone, seven Ship Command cards and eight
 * Space Pirates cards each stay in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "nebula")).toHaveLength(21);
  expect(all.filter((p) => card(p).set_code === "power_stone")).toHaveLength(1);
  expect(all.filter((p) => card(p).set_code === "ship_command")).toHaveLength(
    7,
  );
  expect(all.filter((p) => card(p).set_code === "space_pirates")).toHaveLength(
    8,
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
function technique(s: GameState, code: string) {
  const p = take(s, code);
  p.attachedTo = s.villain.id;
  s.attachments.push(p);
  return p;
}
const ship = (s: GameState) =>
  (s.environments || []).find((p) => p.code === "16093")!;
const stone = (s: GameState) => s.attachments.find((p) => p.code === "16149")!;
const milano = (s: GameState) =>
  s.players
    .flatMap((seat) => seatView(s, seat).player.inPlay)
    .find((p) => p.code === "16142");
const villainAttack = (s: GameState) =>
  settle(native(s, { type: "enemyAttack", id: s.villain.id }));

describe("Nebula original source", () => {
  it("registers every face of the scenario, Power Stone and Space Pirates", () => {
    for (const set of ["nebula", "power_stone", "space_pirates"])
      for (const c of CATALOG_CARDS.filter(
        (c) => c.set_code === set && c.pack_code === "gmw",
      )) {
        expect(NEBULA_VILLAIN_SCRIPT_CODES as readonly string[]).toContain(
          c.code,
        );
        expect(hasExecutableScript(c.code), c.code).toBe(true);
      }
    expect(NEBULA_VILLAIN_SCRIPT_CODES).toHaveLength(22);
    expect(VILLAINS.find((v) => v.id === "nebula")).toMatchObject({
      codes: ["16088", "16089", "16090"],
      schemes: ["16091b"],
      module: "space_pirates",
      fixedSets: ["power_stone", "ship_command"],
    });
    expect(MODULES.some((m) => m.id === "space_pirates")).toBe(true);
    expect(scenarioModules("nebula")).toHaveLength(MODULES.length);
    expect(scenarioModules("crossbones").map((m) => m.id)).toContain(
      "space_pirates",
    );
  });
  it.each([1, 2, 3])(
    "sets up Nebula's Ship, the Milano, the Power Stone and setup Techniques for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        expect(s.villain.code).toBe(
          difficulty === "expert" ? "16089" : "16088",
        );
        expect(s.villain.hp).toBe(
          (difficulty === "expert" ? 17 : 14) * players,
        );
        expect(s.scheme.code).toBe("16091b");
        expect(s.scheme.threat).toBe(2 * players);
        expect(ship(s).counters).toBe(0);
        expect(
          seatView(s, s.firstPlayerId).player.inPlay.some(
            (p) => p.code === "16142",
          ),
        ).toBe(true);
        expect(stone(s).attachedTo).toBe(s.villain.id);
        expect(s.encounter.deck.some((p) => p.code === "16149")).toBe(false);
        expect(s.encounter.deck.some((p) => p.code === "16143")).toBe(true);
        // Setup discards the top 2 cards per player; Techniques attach.
        const techniques = s.attachments.filter((p) =>
          ["16094", "16095", "16096", "16097", "16098"].includes(p.code),
        );
        expect(
          techniques.length + s.encounter.discard.length,
        ).toBeGreaterThanOrEqual(Math.min(2 * players, 2 * players));
        for (const p of techniques) expect(p.attachedTo).toBe(s.villain.id);
        exact(reload(s));
      }
    },
  );
  it("accelerates by the evasion counters on Nebula's Ship per player", () => {
    const s = started("standard", 2);
    expect(escalation(s)).toBe(0);
    ship(s).counters = 2;
    expect(escalation(s)).toBe(4);
  });
  it("advances to Warp Drive Initiated, discards for evasion and loses when it completes", () => {
    let s = started("standard", 1);
    ship(s).counters = 1;
    const deck = s.player.deck.length;
    s = settle(native(s, { type: "threat", target: "main", amount: 6 }));
    expect(s.scheme.code).toBe("16092b");
    expect(s.scheme.threat).toBe(3);
    expect(ship(s).counters).toBe(3);
    expect(s.player.deck.length).toBeLessThanOrEqual(deck - 6);
    exact(reload(s));
    s = settle(native(s, { type: "threat", target: "main", amount: 9 }));
    expect(s.phase).toBe("lost");
  });
  it("advances Nebula's stages and wins after the last one", () => {
    let s = started("standard");
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.villain.code).toBe("16089");
    expect(stone(s).attachedTo).toBe(s.villain.id);
    exact(reload(s));
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.phase).toBe("won");
  });
});

describe("Techniques", () => {
  it("attach when revealed and the first each round gains surge", () => {
    let s = started("standard");
    const first = take(s, "16094");
    const second = take(s, "16097");
    const deck = s.encounter.deck.length;
    s = settle(native(s, { type: "reveal", piece: first, actorId: "p1" }));
    expect(s.attachments.find((p) => p.id === first.id)?.attachedTo).toBe(
      s.villain.id,
    );
    // Surge revealed one more encounter card.
    expect(s.encounter.deck.length).toBeLessThan(deck);
    const after = s.encounter.deck.length;
    s = settle(native(s, { type: "reveal", piece: second, actorId: "p1" }));
    expect(s.attachments.find((p) => p.id === second.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.encounter.deck.length).toBe(after);
    exact(s);
  });
  it("Nebula (I) resolves every Special when she activates, then discards them", () => {
    let s = started("standard");
    technique(s, "16094");
    technique(s, "16097");
    const threat = s.scheme.threat,
      hp = s.player.hp;
    s = villainAttack(s);
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 1);
    expect(s.player.hp).toBeLessThanOrEqual(hp - 1);
    expect(s.attachments.some((p) => ["16094", "16097"].includes(p.code))).toBe(
      false,
    );
    exact(s);
  });
  it("Nebula (II) discards only the chosen Technique", () => {
    let s = started("expert");
    const keep = technique(s, "16096");
    const drop = technique(s, "16098");
    s = native(s, { type: "enemyScheme", id: s.villain.id });
    s = settle(s, (state) =>
      state.prompt?.title === "Nebula" ? drop.id : undefined,
    );
    expect(s.attachments.some((p) => p.id === keep.id)).toBe(true);
    expect(s.attachments.some((p) => p.id === drop.id)).toBe(false);
    // Unyielding Persistence gave Nebula a tough status card.
    expect(s.villain.tough).toBe(true);
    exact(s);
  });
  it("Nebula (III) may remove your top card from the game to discard one", () => {
    let s = started("expert");
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.villain.code).toBe("16090");
    const p = technique(s, "16094");
    const top = s.player.deck[0];
    s = native(s, { type: "enemyScheme", id: s.villain.id });
    s = settle(s, (state) =>
      state.prompt?.title === "Nebula" ? p.id : undefined,
    );
    expect(s.removed.some((q) => q.id === top.id)).toBe(true);
    expect(s.attachments.some((q) => q.id === p.id)).toBe(false);
    exact(s);
  });
  it("grant stalwart and retaliate, reduce attack damage and cap it at 5", () => {
    let s = started("standard");
    technique(s, "16095");
    technique(s, "16097");
    technique(s, "16098");
    technique(s, "16094");
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    const hp = s.villain.hp,
      heroHp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 9,
        attack: true,
        source: "hero",
      }),
    );
    // 9 - 1 (Wide Stance) capped at 5 (Cutthroat Ambition).
    expect(hp - s.villain.hp).toBe(5);
    // Weapon Mastery: retaliate 1.
    expect(heroHp - s.player.hp).toBe(1);
    exact(s);
  });
  it("as a boost, attach after the activation and resolve its Special", () => {
    let s = started("standard");
    const boost = take(s, "16094");
    s.encounter.deck.unshift(boost);
    const threat = s.scheme.threat;
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.attachments.find((p) => p.id === boost.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 1 + 1);
    exact(s);
  });
});

describe("Technique boosts after an activation", () => {
  it("give a facedown boost card to Nebula's next activation", () => {
    let s = started("standard");
    s.villain.tough = true;
    const boost = take(s, "16096");
    s.encounter.deck.unshift(boost);
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.attachments.find((p) => p.id === boost.id)?.attachedTo).toBe(
      s.villain.id,
    );
    // Unyielding Persistence: Nebula is already tough, so she gets 1 facedown
    // boost card for her next activation instead of the finished one.
    expect(s.encounter.storedBoosts).toHaveLength(1);
    exact(s);
  });
});

describe("Nebula's Ship and encounter cards", () => {
  it("places an evasion counter when the villain phase begins and the Milano shoots the thrusters", () => {
    let s = started("standard");
    s = settle(
      native(s, {
        type: "nebula-villain:ship-phase",
        id: ship(s).id,
        actorId: s.firstPlayerId,
      }),
    );
    expect(ship(s).counters).toBe(1);
    ship(s).counters = 3;
    s.player.hand.push(...s.player.deck.splice(0, 4));
    const options = abilityOptions(s, ship(s)).map((o) => o.id);
    expect(options).toEqual(["thrusters-1", "thrusters-2"]);
    s = command(reload(s), {
      type: "ABILITY",
      id: ship(s).id,
      action: "thrusters-2",
    });
    expect(milano(s)!.exhausted).toBe(true);
    s = settle(pay(s, s.player.hand.slice(0, 2)));
    expect(ship(s).counters).toBe(1);
    expect(milano(s)!.exhausted).toBe(true);
    exact(s);
  });
  it("Barrel Roll and Ruthless place evasion counters", () => {
    let s = started("standard");
    s = settle(reveal(s, "16100"));
    expect(ship(s).counters).toBeGreaterThanOrEqual(1);
    const before = ship(s).counters;
    s = settle(reveal(s, "16102"));
    // Ruthless against a hero: Nebula attacks and damage places a counter.
    expect(ship(s).counters).toBeGreaterThanOrEqual(before + 1);
    exact(s);
  });
  it("Combat Ready and Lethal Intent find and reveal a Technique", () => {
    let s = started("standard");
    const threat = s.scheme.threat;
    const cutthroat = take(s, "16094");
    s.encounter.deck.unshift(cutthroat);
    s = settle(reveal(s, "16101"));
    expect(s.attachments.find((p) => p.id === cutthroat.id)?.attachedTo).toBe(
      s.villain.id,
    );
    // Its Special placed 1 threat.
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 1);
    const stance = take(s, "16098");
    s.encounter.deck.unshift(stance);
    s = settle(reveal(s, "16099"));
    expect(s.sideSchemes.some((p) => p.code === "16099")).toBe(true);
    expect(s.attachments.find((p) => p.id === stance.id)?.attachedTo).toBe(
      s.villain.id,
    );
    exact(s);
  });
  it("Power Stone moves to a hero who deals 3 damage with an attack, and back to the villain", () => {
    let s = started("standard");
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        attack: true,
        source: "hero",
      }),
    );
    expect(stone(s).attachedTo).toBe(`hero:${s.activePlayerId}`);
    s.player.hp = 20;
    s.villain.code = "16090";
    s = villainAttack(s);
    expect(stone(s).attachedTo).toBe(s.villain.id);
    exact(s);
  });
});

describe("Power Stone on an eliminated hero", () => {
  it("returns to the villain instead of leaving play", () => {
    let s = started("standard", 2);
    stone(s).attachedTo = `hero:${s.players[1].id}`;
    seatView(s, s.players[1]).player.hp = 1;
    s = settle(
      native(s, {
        type: "damage",
        target: `hero:${s.players[1].id}`,
        amount: 5,
        source: "encounter",
      }),
    );
    expect(s.players[1].eliminated).toBe(true);
    expect(stone(s).attachedTo).toBe(s.villain.id);
  });
});

describe("Space Pirates", () => {
  it("Pirate Lackey removes your top card after it damages you", () => {
    let s = started("standard");
    const top = s.player.deck[0];
    s = settle(reveal(s, "16139"));
    expect(s.minions.some((p) => p.code === "16139")).toBe(true);
    expect(s.removed.some((p) => p.id === top.id)).toBe(true);
    exact(s);
  });
  it("Pirate Commander removes a random card in your hand after it damages you", () => {
    let s = started("standard");
    s.player.hand.push(...s.player.deck.splice(0, 3));
    s = settle(reveal(s, "16138"));
    expect(s.player.hand).toHaveLength(2);
    expect(
      s.removed.filter((p) => card(p).faction_code !== "encounter"),
    ).toHaveLength(1);
    exact(s);
  });
  it("Sound the Alarms gives each enemy +1 ATK", () => {
    let s = started("standard");
    const atk = enemyStats(s, s.villain).attack;
    s = settle(reveal(s, "16140"));
    expect(enemyStats(s, s.villain).attack).toBe(atk + 1);
  });
  it("Honor Among Thieves reveals a Criminal minion with a tough status card", () => {
    let s = started("standard");
    const lackey = take(s, "16139");
    s.encounter.deck.unshift(lackey);
    s = settle(reveal(s, "16141"));
    const minion = s.minions.find((p) => p.id === lackey.id);
    expect(minion?.tough).toBe(true);
    expect(s.encounter.storedBoosts?.length).toBeGreaterThanOrEqual(1);
    exact(s);
  });
});
