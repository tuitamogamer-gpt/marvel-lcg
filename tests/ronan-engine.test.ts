/** Ronan the Accuser and the Kree Militants modular set exercised with the
 * original physical cards. Every command crosses a JSON save/reload boundary. */
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
import { RONAN_SCRIPT_CODES, ronanHazard } from "../src/game/ronan";
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
    villainId: "ronan",
    difficulty,
    seed: 16103,
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
    [s.ronan!.currentMain],
    s.ronan!.mainDeck,
    s.ronan!.villainDeck,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** 19 scenario cards, the Power Stone, seven Ship Command cards and nine
 * Kree Militants cards each stay in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "ronan")).toHaveLength(19);
  expect(all.filter((p) => card(p).set_code === "power_stone")).toHaveLength(1);
  expect(all.filter((p) => card(p).set_code === "ship_command")).toHaveLength(
    7,
  );
  expect(all.filter((p) => card(p).set_code === "kree_militant")).toHaveLength(
    9,
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
/** Clear Ronan's Toughness status card for a damage fixture. */
function untough(s: GameState) {
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return s;
}
const stone = (s: GameState) => s.attachments.find((p) => p.code === "16149")!;
const weapon = (s: GameState) => s.attachments.find((p) => p.code === "16109");
const milano = (s: GameState) =>
  s.players
    .flatMap((seat) => seatView(s, seat).player.inPlay)
    .find((p) => p.code === "16142");

describe("Ronan the Accuser original source", () => {
  it("registers every face of the scenario and Kree Militants", () => {
    for (const set of ["ronan", "kree_militant"])
      for (const c of CATALOG_CARDS.filter(
        (c) => c.set_code === set && c.pack_code === "gmw",
      )) {
        expect(RONAN_SCRIPT_CODES as readonly string[]).toContain(c.code);
        expect(hasExecutableScript(c.code), c.code).toBe(true);
      }
    expect(RONAN_SCRIPT_CODES).toHaveLength(20);
    expect(VILLAINS.find((v) => v.id === "ronan")).toMatchObject({
      codes: ["16103", "16104", "16105"],
      schemes: ["16106b"],
      module: "kree_militant",
      fixedSets: ["power_stone", "ship_command"],
    });
    expect(MODULES.some((m) => m.id === "kree_militant")).toBe(true);
    expect(scenarioModules("ronan")).toHaveLength(MODULES.length);
  });
  it.each([1, 2, 3])(
    "sets up the Kree Command Ship, the Milano, the Universal Weapon and the Power Stone for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        expect(s.villain.code).toBe(
          difficulty === "expert" ? "16104" : "16103",
        );
        expect(s.villain.hp).toBe(
          (difficulty === "expert" ? 18 : 14) * players,
        );
        expect(s.villain.tough).toBe(true);
        expect(s.scheme.code).toBe("16106b");
        expect(s.scheme.threat).toBe(2 * players);
        expect((s.environments || []).map((p) => p.code)).toEqual(["16108"]);
        expect(milano(s)).toBeTruthy();
        expect(weapon(s)?.attachedTo).toBe(s.villain.id);
        expect(stone(s).attachedTo).toBe(`hero:${s.firstPlayerId}`);
        // Ronan (II) reveals Cut the Power.
        expect(s.sideSchemes.some((p) => p.code === "16111")).toBe(
          difficulty === "expert",
        );
        expect(ronanHazard(s)).toBe(1);
        exact(reload(s));
      }
    },
  );
  it('advances to "Take What Is Mine", locks its threat while Ronan holds the Power Stone and loses when it completes', () => {
    let s = started("standard");
    s = settle(native(s, { type: "threat", target: "main", amount: 5 }));
    expect(s.scheme.code).toBe("16107b");
    expect(s.scheme.threat).toBe(1);
    expect(stone(s).attachedTo).toBe(s.villain.id);
    s = settle(native(s, { type: "thwart", target: "main", amount: 1 }));
    expect(s.scheme.threat).toBe(1);
    exact(reload(s));
    s = settle(native(s, { type: "threat", target: "main", amount: 9 }));
    expect(s.phase).toBe("lost");
  });
  it("gives Ronan a facedown boost card when the Power Stone is already his", () => {
    let s = started("standard");
    stone(s).attachedTo = s.villain.id;
    s = settle(native(s, { type: "threat", target: "main", amount: 5 }));
    expect(s.encounter.storedBoosts).toHaveLength(1);
    exact(s);
  });
  it("advances Ronan's stages, reveals Superior Tactics and wins after the last one", () => {
    let s = untough(started("expert"));
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.villain.code).toBe("16105");
    expect(s.sideSchemes.some((p) => p.code === "16113")).toBe(true);
    expect(stone(s).attachedTo).toBe(s.villain.id);
    exact(reload(s));
    untough(s);
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.phase).toBe("won");
  });
  it("Interception Imminent's First Player Action exhausts the Milano for 3 threat", () => {
    let s = started("standard");
    s.scheme.threat = 5;
    const main = s.ronan!.currentMain;
    expect(abilityOptions(s, main).map((o) => o.id)).toContain("milano");
    s = settle(
      command(reload(s), { type: "ABILITY", id: main.id, action: "milano" }),
    );
    expect(s.scheme.threat).toBe(2);
    expect(milano(s)!.exhausted).toBe(true);
  });
});

describe("Ronan and the Power Stone", () => {
  it("gets an additional boost card when he activates against the Power Stone's holder", () => {
    let s = started("standard", 2);
    const deck = s.encounter.deck.length;
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    const holder = deck - s.encounter.deck.length;
    const other = s.players[1].id;
    const before = s.encounter.deck.length;
    s = settle(
      native(s, { type: "enemyScheme", id: s.villain.id, actorId: other }),
    );
    expect(holder).toBe(2);
    expect(before - s.encounter.deck.length).toBe(1);
    exact(s);
  });
  it("Superior Tactics keeps the Power Stone on Ronan and threatens if it already is", () => {
    let s = started("standard");
    s = settle(reveal(s, "16113"));
    expect(stone(s).attachedTo).toBe(s.villain.id);
    untough(s);
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 4,
        attack: true,
        source: "hero",
      }),
    );
    expect(stone(s).attachedTo).toBe(s.villain.id);
    const tactics = s.sideSchemes.find((p) => p.code === "16113")!;
    s.sideSchemes = s.sideSchemes.filter((p) => p.id !== tactics.id);
    s.encounter.deck.push(tactics);
    s = settle(reveal(s, "16113"));
    expect(s.sideSchemes.find((p) => p.code === "16113")?.counters).toBe(2 + 1);
    exact(s);
  });
  it("Single-Minded Fury attacks the Power Stone's holder, or surges when Ronan holds it", () => {
    let s = started("standard");
    s.player.form = "alter";
    const hp = s.player.hp;
    s = settle(reveal(s, "16114"));
    expect(s.player.hp).toBeLessThan(hp);
    stone(s).attachedTo = s.villain.id;
    const deck = s.encounter.deck.length;
    s = settle(reveal(s, "16114"));
    expect(s.encounter.deck.length).toBeLessThan(deck - 1);
    exact(s);
  });
});

describe("Ronan's attachments and encounter cards", () => {
  it("Universal Weapon gives stalwart and leaves for 2 damage and a facedown encounter card", () => {
    let s = started("standard");
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    const p = weapon(s)!;
    const hp = s.player.hp;
    expect(abilityOptions(s, p).map((o) => o.id)).toEqual(["remove"]);
    s = settle(
      command(reload(s), { type: "ABILITY", id: p.id, action: "remove" }),
    );
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(weapon(s)).toBeUndefined();
    expect(s.encounter.deck.some((q) => q.id === p.id)).toBe(true);
    exact(s);
  });
  it("Fanaticism gives Ronan's attacks overkill and piercing, then loses a fury counter", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "16110"));
    const fanaticism = s.attachments.find((p) => p.code === "16110")!;
    expect(fanaticism.attachedTo).toBe(s.villain.id);
    expect(fanaticism.counters).toBe(3);
    expect(enemyStats(s, s.villain).attack).toBe(2 + 1);
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.attachments.find((p) => p.id === fanaticism.id)?.counters).toBe(2);
    exact(s);
  });
  it("Kree Physiology gives Ronan tough, or deals you 1 damage if he already is", () => {
    let s = started("standard");
    untough(s);
    s = settle(reveal(s, "16115"));
    expect(s.villain.tough).toBe(true);
    const hp = s.player.hp;
    s = settle(reveal(s, "16115"));
    expect(s.player.hp).toBe(hp - 1);
  });
  it('"You Stand Accused!" makes Ronan scheme against an alter-ego with +1 SCH', () => {
    let s = started("standard");
    s.player.form = "alter";
    const threat = s.scheme.threat;
    s = settle(reveal(s, "16116"));
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 3);
    exact(s);
  });
  it("Kree Command Ship cancels a revealed treachery's When Revealed for the Milano and 1 resource", () => {
    let s = started("standard");
    s.player.form = "alter";
    s.player.hand.push(...s.player.deck.splice(0, 2));
    const accused = take(s, "16116");
    s.encounter.dealt.push(accused);
    const threat = s.scheme.threat;
    s = native(s, { type: "revealDealt" });
    expect(s.prompt?.options.map((o) => o.id)).toContain("kree-command-ship");
    s = choose(s, "kree-command-ship");
    expect(milano(s)!.exhausted).toBe(true);
    s = settle(pay(s, s.player.hand.slice(0, 1)));
    expect(s.scheme.threat).toBe(threat);
    expect(s.encounter.discard.some((p) => p.id === accused.id)).toBe(true);
    exact(s);
  });
  it("Cut the Power's boost exhausts the Milano or places 2 threat", () => {
    let s = started("standard");
    const cut = take(s, "16111");
    s.encounter.deck.unshift(cut);
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }), (state) =>
      state.prompt?.title === "Cut the Power" ? "milano" : undefined,
    );
    expect(milano(s)!.exhausted).toBe(true);
    exact(s);
  });
});

describe("Kree Militants", () => {
  it("Kree Combat Armor reduces attack damage and leaves for 3 resources of one type", () => {
    let s = started("standard");
    untough(s);
    s = settle(reveal(s, "16131"));
    const armor = s.attachments.find((p) => p.code === "16131")!;
    expect(armor.attachedTo).toBe(s.villain.id);
    untough(s);
    const hp = s.villain.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        attack: true,
        source: "hero",
      }),
    );
    expect(hp - s.villain.hp).toBe(2);
    exact(s);
  });
  it("Kree Private, Commando and Lieutenant enter with their native keywords", () => {
    let s = started("standard");
    s = settle(reveal(s, "16133"));
    s = settle(reveal(s, "16132"));
    expect(
      s.minions.filter((p) => ["16132", "16133"].includes(p.code)),
    ).toHaveLength(2);
    exact(s);
  });
});
