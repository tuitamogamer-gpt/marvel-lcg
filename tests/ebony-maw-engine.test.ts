/** Ebony Maw and the Black Order and Armies of Titan modular sets exercised
 * with the original physical cards. Every command crosses a JSON save/reload
 * boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { abilityOptions, newGame } from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  EBONY_MAW_SCRIPT_CODES,
  EBONY_MAW_SPELLS,
  ebonyMawSpells,
} from "../src/game/ebony-maw";
import type { GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

const players3 = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "ebony_maw",
  modules?: string[],
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 21071,
    pacing: "expert",
    ...(modules ? { modules } : {}),
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
          ["none", "hero", "damage", "allow", "resolve"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
/** Started table: hands go back into the decks and every identity is a
 * hero, so each fixture chooses its own cards. Setup's Spells return to the
 * encounter deck. */
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  for (const spell of [...(s.environments || [])]) {
    s.environments = s.environments!.filter((p) => p.id !== spell.id);
    delete spell.playAreaOf;
    spell.counters = 0;
    s.encounter.deck.push(spell);
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
    [s.ebonyMaw!.currentMain],
    s.ebonyMaw!.mainDeck,
    s.ebonyMaw!.villainDeck,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** 21 scenario cards, four Black Order cards and six Armies of Titan cards
 * each stay in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "ebony_maw")).toHaveLength(21);
  expect(all.filter((p) => card(p).set_code === "black_order")).toHaveLength(4);
  expect(
    all.filter((p) => card(p).set_code === "armies_of_titan"),
  ).toHaveLength(6);
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
/** Put an original Spell into a player's play area. */
function spell(
  s: GameState,
  code: string,
  playerId = s.activePlayerId,
  counters = EBONY_MAW_SPELLS[code],
) {
  const p = take(s, code);
  p.playAreaOf = playerId;
  p.counters = counters;
  (s.environments ||= []).push(p);
  return p;
}
function engage(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = take(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function playerCard(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  expect(i, `deck card ${code}`).toBeGreaterThanOrEqual(0);
  return p.deck.splice(i, 1)[0];
}

describe("Ebony Maw original source", () => {
  it("registers every face of the scenario, Black Order and Armies of Titan", () => {
    for (const set of ["ebony_maw", "black_order", "armies_of_titan"])
      for (const c of CATALOG_CARDS.filter(
        (c) => c.set_code === set && c.pack_code === "mts",
      )) {
        expect(EBONY_MAW_SCRIPT_CODES as readonly string[]).toContain(c.code);
        expect(hasExecutableScript(c.code), c.code).toBe(true);
      }
    expect(EBONY_MAW_SCRIPT_CODES).toHaveLength(23);
    expect(VILLAINS.find((v) => v.id === "ebony_maw")).toMatchObject({
      codes: ["21071", "21072", "21073"],
      schemes: ["21074b"],
      moduleCount: 2,
      defaultModules: ["armies_of_titan", "black_order"],
    });
    expect(MODULES.some((m) => m.id === "black_order")).toBe(true);
    expect(MODULES.some((m) => m.id === "armies_of_titan")).toBe(true);
    expect(scenarioModules("ebony_maw")).toHaveLength(MODULES.length);
  });
  it.each([1, 2, 3])(
    "puts one Spell per player into play for %s players, two in expert",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        expect(s.villain.code).toBe(
          difficulty === "expert" ? "21072" : "21071",
        );
        expect(s.villain.hp).toBe(
          (difficulty === "expert" ? 18 : 14) * players,
        );
        expect(s.scheme.code).toBe("21074b");
        expect(s.scheme.threat).toBe(players);
        expect(s.modules).toEqual(["armies_of_titan", "black_order"]);
        for (const seat of s.players) {
          const spells = ebonyMawSpells(s, seat.id);
          expect(spells).toHaveLength(difficulty === "expert" ? 2 : 1);
          for (const p of spells)
            expect(p.counters).toBe(EBONY_MAW_SPELLS[p.code]);
        }
        // Attack on Knowhere shuffles the encounter discard pile back.
        expect(s.encounter.discard).toHaveLength(0);
        exact(reload(s));
      }
    },
  );
  it("advances to The Power Stone, gives each player a Spell and loses when it completes", () => {
    let s = started("standard", 2);
    s.encounter.discard.push(take(s, "21080"));
    s = settle(native(s, { type: "threat", target: "main", amount: 12 }));
    expect(s.scheme.code).toBe("21075b");
    expect(s.scheme.threat).toBe(2);
    for (const seat of s.players)
      expect(ebonyMawSpells(s, seat.id)).toHaveLength(1);
    // The Power Stone (2A) shuffles the discard pile in before the Spells.
    expect(s.encounter.discard.some((p) => p.code === "21080")).toBe(false);
    exact(reload(s));
    s = settle(native(s, { type: "threat", target: "main", amount: 18 }));
    expect(s.phase).toBe("lost");
  });
  it("advances Ebony Maw's stages, gives each player a Spell and wins after the last one", () => {
    let s = started("standard", 2);
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.villain.code).toBe("21072");
    expect(s.villain.hp).toBe(36);
    for (const seat of s.players)
      expect(ebonyMawSpells(s, seat.id)).toHaveLength(1);
    exact(reload(s));
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.phase).toBe("won");
  });
});

describe("Spells and invocation counters", () => {
  it("Ebony Maw removes an invocation counter from each Spell of the player he activates against", () => {
    let s = started("standard", 2);
    const [p1, p2] = s.players.map((seat) => seat.id);
    const a = spell(s, "21076", p1);
    const b = spell(s, "21078", p1);
    const c = spell(s, "21079", p2);
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    const counters = (p: Piece) =>
      s.environments!.find((q) => q.id === p.id)?.counters;
    expect(counters(a)).toBe(3);
    expect(counters(b)).toBe(2);
    expect(counters(c)).toBe(3);
    exact(reload(s));
  });
  it("a stunned Ebony Maw removes the status card instead and leaves the counters", () => {
    let s = started("standard");
    const a = spell(s, "21076");
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.villain.stunned).toBe(false);
    expect(s.environments!.find((q) => q.id === a.id)?.counters).toBe(4);
  });
  it("Fireball deals 4 damage to your identity when its last counter is removed", () => {
    let s = started("standard");
    s.player.form = "alter";
    const p = spell(s, "21076", s.activePlayerId, 1);
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.hp).toBe(hp - 4);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    expect(ebonyMawSpells(s, s.activePlayerId)).toHaveLength(0);
    exact(s);
  });
  it("Manipulation discards a random card and confuses you", () => {
    let s = started("standard");
    s.player.form = "alter";
    s.player.hand.push(...s.player.deck.splice(0, 3));
    spell(s, "21077", s.activePlayerId, 1);
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.hand).toHaveLength(2);
    expect(s.player.confused).toBe(true);
    exact(s);
  });
  it("Pacification exhausts each upgrade you control and stuns you", () => {
    let s = started("standard");
    s.player.form = "alter";
    const shooter = playerCard(s, "01008");
    s.player.inPlay.push(shooter);
    spell(s, "21078", s.activePlayerId, 1);
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.inPlay.find((p) => p.id === shooter.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.stunned).toBe(true);
    exact(s);
  });
  it("Rubblestorm deals 2 damage to each character you control", () => {
    let s = started("standard");
    s.player.form = "alter";
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    spell(s, "21079", s.activePlayerId, 1);
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.inPlay.some((p) => p.id === cat.id)).toBe(false);
    exact(s);
  });
  it("Agent of Thanos counts your Spells, or surges without any", () => {
    let s = started("standard");
    s.player.form = "alter";
    spell(s, "21076");
    spell(s, "21077");
    const threat = s.scheme.threat;
    s = settle(reveal(s, "21080"));
    expect(s.scheme.threat).toBe(threat + 2);
    s.player.form = "hero";
    const hp = s.player.hp;
    const other = s.encounter.discard.find((p) => p.code === "21080")!;
    s.encounter.discard = s.encounter.discard.filter((p) => p.id !== other.id);
    s.encounter.deck.push(other);
    s = settle(reveal(s, "21080"));
    expect(s.player.hp).toBe(hp - 2);
    exact(s);
  });
  it("Agent of Thanos surges when you have no Spell", () => {
    let s = started("standard");
    s.player.form = "alter";
    const deck = s.encounter.deck.length;
    s = settle(reveal(s, "21080"));
    expect(s.encounter.deck.length).toBeLessThan(deck - 1);
  });
  it("Channeling Trance removes a counter from each Spell, or puts a Spell into play without surge", () => {
    let s = started("standard");
    s.player.form = "alter";
    const top = take(s, "21078");
    const filler = take(s, "21084");
    const first = take(s, "21081");
    s.encounter.deck.unshift(filler, top);
    const deck = s.encounter.deck.length;
    s = settle(
      native(s, { type: "reveal", piece: first, actorId: s.activePlayerId }),
    );
    const spells = ebonyMawSpells(s, s.activePlayerId);
    expect(spells.map((p) => p.id)).toEqual([top.id]);
    expect(spells[0].counters).toBe(3);
    // Only the discarded side scheme and the Spell left the deck: the Spell
    // was put into play, so its Surge did not reveal another card.
    expect(s.encounter.deck.length).toBe(deck - 2);
    expect(s.encounter.discard.some((p) => p.id === filler.id)).toBe(true);
    const trance = s.encounter.discard.find((p) => p.code === "21081")!;
    s.encounter.discard = s.encounter.discard.filter((p) => p.id !== trance.id);
    s.encounter.deck.push(trance);
    s = settle(reveal(s, "21081"));
    expect(ebonyMawSpells(s, s.activePlayerId)[0].counters).toBe(2);
    exact(s);
  });
  it("a revealed Spell enters the revealing player's play area and surges", () => {
    let s = started("standard", 2);
    const p2 = s.players[1].id;
    const deck = s.encounter.deck.length;
    s = settle(reveal(s, "21079", p2));
    expect(ebonyMawSpells(s, p2).map((p) => p.code)).toContain("21079");
    expect(s.encounter.deck.length).toBeLessThan(deck - 1);
    exact(s);
  });
  it("a defeated player's Spells are discarded", () => {
    let s = started("standard", 2);
    const p2 = s.players[1].id;
    spell(s, "21076", p2);
    s = settle(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 99,
        source: "encounter",
        actorId: p2,
      }),
    );
    expect(s.players[1].eliminated).toBe(true);
    expect(ebonyMawSpells(s, p2)).toHaveLength(0);
    exact(s);
  });
});

describe("Ebony Maw's attachments and side schemes", () => {
  it("Abjuration prevents all damage and leaves after preventing 2 from one attack", () => {
    let s = started("standard");
    s = settle(reveal(s, "21082"));
    const shield = s.attachments.find((p) => p.code === "21082")!;
    expect(shield.attachedTo).toBe(s.villain.id);
    const hp = s.villain.hp;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 3 }));
    expect(s.villain.hp).toBe(hp);
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((p) => p.id === shield.id)).toBe(true);
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((p) => p.id === shield.id)).toBe(false);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 2 }));
    expect(s.villain.hp).toBe(hp - 2);
    exact(s);
  });
  it("Restrained exhausts the friendly character with the highest ATK, keeps it exhausted and leaves for energy and physical", () => {
    let s = started("standard");
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    s = settle(reveal(s, "21083"));
    const bonds = s.attachments.find((p) => p.code === "21083")!;
    expect(bonds.attachedTo).toBe(`hero:${s.activePlayerId}`);
    expect(s.player.exhausted).toBe(true);
    s = settle(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(true);
    const energy = playerCard(s, "01088");
    const strength = playerCard(s, "01090");
    s.player.hand.push(energy, strength);
    expect(abilityOptions(s, bonds).map((o) => o.id)).toEqual(["remove"]);
    s = command(s, { type: "ABILITY", id: bonds.id, action: "remove" });
    s = settle(pay(s, [energy, strength]));
    expect(s.attachments.some((p) => p.id === bonds.id)).toBe(false);
    s = settle(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(false);
    exact(s);
  });
  it("Restrained can attach to an ally and stops it readying", () => {
    let s = started("standard");
    s.player.form = "alter";
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    s = settle(reveal(s, "21083"));
    const bonds = s.attachments.find((p) => p.code === "21083")!;
    expect(bonds.attachedTo).toBe(cat.id);
    expect(s.player.inPlay.find((p) => p.id === cat.id)?.exhausted).toBe(true);
    s = settle(native(s, { type: "ready", target: cat.id }));
    expect(s.player.inPlay.find((p) => p.id === cat.id)?.exhausted).toBe(true);
    exact(s);
  });
  it("Reactor Overload makes each player take 2 damage or place 2 threat on it", () => {
    let s = started("standard", 2);
    const [p1, p2] = s.players.map((seat) => seat.id);
    const hp1 = seatView(s, p1).player.hp;
    const hp2 = seatView(s, p2).player.hp;
    s = reveal(s, "21084");
    expect(s.prompt?.title).toBe("Reactor Overload");
    s = choose(s, "damage");
    expect(s.prompt?.title).toBe("Reactor Overload");
    s = settle(choose(s, "threat"));
    expect(seatView(s, p1).player.hp).toBe(hp1 - 2);
    expect(seatView(s, p2).player.hp).toBe(hp2);
    expect(s.sideSchemes.find((p) => p.code === "21084")?.counters).toBe(3 + 2);
    exact(s);
  });
});

describe("Black Order and Armies of Titan", () => {
  it("Black Dwarf's attack gains overkill", () => {
    let s = started("standard");
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    engage(s, "21085");
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "enemyAttack",
        id: s.minions.find((p) => p.code === "21085")!.id,
      }),
      (v) => v.prompt?.options.find((o) => o.id === cat.id)?.id,
    );
    // Black Cat has 2 hit points; the third damage carries to the hero.
    expect(s.player.inPlay.some((p) => p.id === cat.id)).toBe(false);
    expect(s.player.hp).toBe(hp - 1);
    exact(s);
  });
  it("Supergiant stuns the character its attack damages", () => {
    let s = started("standard");
    const giant = engage(s, "21086");
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: giant.id }));
    expect(s.player.hp).toBeLessThan(hp);
    expect(s.player.stunned).toBe(true);
    exact(s);
  });
  it("The Black Order keeps its threat while a Black Order minion is in play", () => {
    let s = started("standard");
    s = settle(reveal(s, "21087"));
    const scheme = s.sideSchemes.find((p) => p.code === "21087")!;
    expect(scheme.counters).toBe(2);
    const infantry = engage(s, "21089");
    s = settle(native(s, { type: "thwart", target: scheme.id, amount: 1 }));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
    s.minions = s.minions.filter((p) => p.id !== infantry.id);
    s.encounter.discard.push(infantry);
    s = settle(native(s, { type: "thwart", target: scheme.id, amount: 1 }));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(1);
    exact(s);
  });
  it("Blood to Spare activates engaged minions and engages a Black Order minion with each other player", () => {
    let s = started("standard", 2);
    const [p1, p2] = s.players.map((seat) => seat.id);
    const rider = engage(s, "21090", p1);
    const hp = seatView(s, p1).player.hp;
    s = settle(reveal(s, "21088"), (v) =>
      v.prompt?.title === "Blood to Spare"
        ? v.prompt.options.find((o) => o.image === "21085")?.id
        : undefined,
    );
    expect(seatView(s, p1).player.hp).toBeLessThan(hp);
    expect(s.minions.find((p) => p.id === rider.id)?.engagedWith).toBe(p1);
    expect(
      s.minions.find((p) => p.code === "21085")?.engagedWith,
      "Black Dwarf engages the unengaged player",
    ).toBe(p2);
    exact(s);
  });
  it("Black Order Infantry gives the villain a tough status card when defeated and as a boost", () => {
    let s = started("standard");
    const infantry = engage(s, "21089");
    s = settle(native(s, { type: "damage", target: infantry.id, amount: 4 }));
    expect(s.villain.tough).toBe(true);
    s.villain.tough = false;
    s.villain.toughCards = 0;
    const boost = take(s, "21089");
    s.encounter.deck.unshift(boost);
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.villain.tough).toBe(true);
    exact(s);
  });
  it("Outrider discards a random card when revealed and as a boost", () => {
    let s = started("standard");
    s.player.hand.push(...s.player.deck.splice(0, 3));
    s = settle(reveal(s, "21090"));
    expect(s.player.hand).toHaveLength(2);
    const boost = take(s, "21090");
    s.encounter.deck.unshift(boost);
    s.player.form = "alter";
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.hand).toHaveLength(1);
    exact(s);
  });
  it("Landing Craft puts the next discarded minion into play engaged with the player who defeats it", () => {
    let s = started("standard");
    s = settle(reveal(s, "21091"));
    const craft = s.sideSchemes.find((p) => p.code === "21091")!;
    const filler = take(s, "21084");
    const giant = take(s, "21086");
    s.encounter.deck.unshift(filler, giant);
    s.player.form = "alter";
    s = settle(
      native(s, { type: "thwart", target: craft.id, amount: craft.counters }),
    );
    expect(s.sideSchemes.some((p) => p.id === craft.id)).toBe(false);
    expect(s.minions.find((p) => p.id === giant.id)?.engagedWith).toBe(
      s.activePlayerId,
    );
    expect(s.encounter.discard.some((p) => p.id === filler.id)).toBe(true);
    exact(s);
  });
  it("Black Order and Armies of Titan work as modular sets in other scenarios", () => {
    for (const module of ["black_order", "armies_of_titan"]) {
      const s = settle(setup("standard", 1, "rhino", [module]));
      const set = s.encounter.deck.filter((p) => card(p).set_code === module);
      expect(set).toHaveLength(module === "black_order" ? 4 : 6);
    }
  });
});
