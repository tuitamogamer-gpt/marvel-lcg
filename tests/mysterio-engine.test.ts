/** Sinister Motives: the Mysterio scenario with Personal Nightmare and
 * Whispers of Paranoia, exercised with the original physical cards. Every
 * command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  handSize,
} from "../src/game/cards";
import { isTextBlank } from "../src/game/card-text";
import {
  abilityOptions,
  enemyStats,
  makePiece,
  newGame,
} from "../src/game/engine";
import { MYSTERIO_SCRIPT_CODES } from "../src/game/mysterio";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

const team = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "mysterio",
  module?: string,
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 27084,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...(module ? { module } : {}),
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
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "mysterio",
  module?: string,
) {
  let s = settle(setup(difficulty, players, villainId, module));
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
const V = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mysterio:${type}`,
  ...args,
});
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
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
const attack = (s: GameState, target: string, amount: number): Effect => ({
  type: "damage",
  target,
  amount,
  attack: true,
  source: "hero",
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const encounterInDeck = (s: GameState, playerId = "p1") =>
  seatView(s, playerId).player.deck.filter(
    (p) => card(p).faction_code === "encounter",
  );

describe("Mysterio original source", () => {
  it("registers every face of the Mysterio, Personal Nightmare and Whispers of Paranoia sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "sm" &&
        ["mysterio", "personal_nightmare", "whispers_of_paranoia"].includes(
          c.set_code || "",
        ),
    );
    expect(faces).toHaveLength(21);
    expect(new Set(MYSTERIO_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "mysterio")).toMatchObject({
      codes: ["27084", "27085", "27086"],
      schemes: ["27087b", "27088b"],
      module: "whispers_of_paranoia",
      fixedSets: ["personal_nightmare"],
    });
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["personal_nightmare", "whispers_of_paranoia"]),
    );
  });
  it.each([1, 2, 3])(
    "engages a Shifting Apparition with each of %s players",
    (players) => {
      const s = settle(setup("standard", players));
      expect(s.villain.code).toBe("27084");
      expect(s.scheme).toMatchObject({ code: "27087b", threat: 2 * players });
      const apparitions = s.minions.filter((p) => p.code === "27091");
      expect(apparitions.map((p) => p.engagedWith).sort()).toEqual(
        s.players.map((p) => p.id).sort(),
      );
      const all = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
        ...s.minions,
      ];
      const count = (set: string) =>
        all.filter((p) => card(p).set_code === set).length;
      expect(count("mysterio")).toBe(11);
      expect(count("personal_nightmare")).toBe(7);
      expect(count("whispers_of_paranoia")).toBe(5);
    },
  );
  it("Expert starts with Mysterio (II), who shuffles an encounter card into each deck", () => {
    let s = settle(setup("expert"));
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.villain.code).toBe("27085");
    const inPlayerZones = [
      ...s.player.deck,
      ...s.player.hand,
      ...s.encounter.dealt,
    ];
    expect(
      inPlayerZones.some((p) => card(p).faction_code === "encounter"),
    ).toBe(true);
  });
});

describe("Maze of Mirrors", () => {
  it("an encounter card drawn from your deck is dealt to you facedown and you draw another", () => {
    let s = started();
    const p = take(s, "27093");
    s.player.deck.unshift(p);
    const hand = s.player.hand.length;
    s = settle(native(s, { type: "draw", amount: 1 }));
    expect(s.player.hand).toHaveLength(hand + 1);
    expect(s.player.hand.some((q) => q.id === p.id)).toBe(false);
    expect(s.encounter.dealt.find((q) => q.id === p.id)?.dealtTo).toBe("p1");
  });
  it("an encounter card discarded from your deck is dealt facedown and you draw 1 card", () => {
    let s = started();
    const p = take(s, "27093");
    s.player.deck.unshift(p);
    const hand = s.player.hand.length;
    s = settle(native(s, V("mill", { playerId: "p1", count: 1 })));
    expect(s.encounter.dealt.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(false);
    expect(s.player.hand).toHaveLength(hand + 1);
  });
  it("Edge of Reality shuffles the top 2 encounter cards into each player's deck", () => {
    let s = started();
    const before = encounterInDeck(s).length;
    s.scheme.threat = 7;
    s = settle(native(s, { type: "threat", target: "main", amount: 2 }));
    expect(s.scheme.code).toBe("27088b");
    expect(s.scheme.threat).toBe(3);
    expect(encounterInDeck(s).length).toBe(before + 2);
  });
});

describe("Mysterio and his encounter cards", () => {
  it("Seeds of Fear: an Illusion boost card goes to your discard pile", () => {
    let s = started();
    stack(s, "27091");
    const id = s.encounter.deck[0].id;
    s = settle(native(s, villainAttack(s)));
    expect(s.player.discard.some((p) => p.id === id)).toBe(true);
  });
  it("Bound by Fear: Mysterio (III) puts an Illusion boost card on top of your deck", () => {
    let s = started();
    s.villain.code = "27086";
    stack(s, "27091");
    const id = s.encounter.deck[0].id;
    s = settle(native(s, villainAttack(s)));
    expect(s.player.deck[0]?.id).toBe(id);
  });
  it("Masterful Mirage discards the top 4 cards of your deck instead of Mysterio taking damage", () => {
    let s = started();
    // Shifting Apparition's guard would prevent attacking Mysterio.
    s.encounter.discard.push(...s.minions.splice(0));
    s = settle(reveal(s, "27090"));
    const hp = s.villain.hp;
    const discard = s.player.discard.length;
    s = settle(native(s, attack(s, s.villain.id, 3)));
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((p) => p.code === "27090")).toBe(false);
    expect(s.player.discard.length).toBeGreaterThanOrEqual(discard + 3);
  });
  it("Shifting Apparition defeated with excess damage shuffles an encounter card into your deck", () => {
    let s = started();
    const apparition = s.minions.find((p) => p.code === "27091")!;
    const before = encounterInDeck(s).length;
    s = settle(native(s, attack(s, apparition.id, 3)));
    expect(s.minions.some((p) => p.id === apparition.id)).toBe(false);
    expect(encounterInDeck(s).length).toBe(before + 1);
  });
  it("Déjà Vu deals 1 damage or 1 threat and is shuffled into a player's deck", () => {
    let s = started();
    const hp = s.player.hp;
    const p = take(s, "27092");
    s = settle(native(s, { type: "reveal", piece: p, actorId: "p1" }));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.deck.some((q) => q.id === p.id)).toBe(true);
  });
  it("Fearmonger discards your hand and draws up to your hand size", () => {
    let s = started();
    s.player.hand.push(...s.player.deck.splice(0, 2));
    s = settle(reveal(s, "27093"));
    expect(s.player.hand.length).toBe(handSize(s));
  });
});

describe("Personal Nightmare", () => {
  it("Fool's Paradise gives each identity +2 hand size", () => {
    let s = started();
    const size = handSize(s);
    s = settle(reveal(s, "27155"));
    expect(handSize(s)).toBe(size + 2);
  });
  it("Evil Doppelgänger gets +1 ATK and SCH for each identity-specific card in hand", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(reveal(s, "27154"));
    const doppel = s.minions.find((p) => p.code === "27154")!;
    const base = enemyStats(s, doppel);
    const own = s.player.deck
      .filter((p) => card(p).faction_code === "hero")
      .slice(0, 2);
    s.player.deck = s.player.deck.filter((p) => !own.includes(p));
    s.player.hand.push(...own);
    expect(enemyStats(s, doppel).attack).toBe(base.attack + 2);
    expect(enemyStats(s, doppel).scheme).toBe(base.scheme + 2);
  });
  it("Weakness from Within gets 1 more threat for each card in hand", () => {
    let s = started();
    s.player.hand.push(...s.player.deck.splice(0, 3));
    s = settle(reveal(s, "27156"));
    expect(s.sideSchemes.find((p) => p.code === "27156")?.counters).toBe(1 + 3);
  });
  it("Induced Panic blanks the hero's printed text and leaves through its Alter-Ego Action", () => {
    let s = started();
    s = settle(reveal(s, "27153"));
    const panic = s.attachments.find((p) => p.code === "27153")!;
    expect(panic.attachedTo).toBe("hero:p1");
    expect(isTextBlank(s, "01001a")).toBe(true);
    s.player.form = "alter";
    const own = s.player.deck.find((p) => card(p).faction_code === "hero")!;
    s.player.deck = s.player.deck.filter((p) => p !== own);
    s.player.hand.push(own);
    expect(abilityOptions(s, panic).map((o) => o.id)).toContain("discard");
    s = settle(
      command(s, { type: "ABILITY", id: panic.id, action: "discard" }),
    );
    expect(s.attachments.some((p) => p.id === panic.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === own.id)).toBe(true);
  });
});

describe("Whispers of Paranoia", () => {
  it("Manipulated Mind turns your lowest-cost ally into a minion engaged with you", () => {
    let s = started();
    const ally = s.player.deck.find((p) => card(p).type_code === "ally")!;
    s.player.deck = s.player.deck.filter((p) => p !== ally);
    ally.ownerId = "p1";
    s.player.inPlay.push(ally);
    s = settle(reveal(s, "27171"));
    const minion = s.minions.find((p) => p.id === ally.id)!;
    expect(minion).toMatchObject({ treatedAsMinion: true, engagedWith: "p1" });
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.attachments.find((p) => p.code === "27171")?.attachedTo).toBe(
      ally.id,
    );
  });
  it("Manipulated Mind gains surge without an ally", () => {
    let s = started();
    s = settle(reveal(s, "27171"));
    expect(s.attachments.some((p) => p.code === "27171")).toBe(false);
    expect(s.encounter.dealt.length).toBeGreaterThanOrEqual(1);
  });
  it("Delusion of Collusion keeps your allies from readying", () => {
    let s = started();
    const ally = s.player.deck.find((p) => card(p).type_code === "ally")!;
    s.player.deck = s.player.deck.filter((p) => p !== ally);
    ally.ownerId = "p1";
    ally.exhausted = true;
    s.player.inPlay.push(ally);
    s = settle(reveal(s, "27170"));
    s = settle(native(s, { type: "ready", target: ally.id }));
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
  });
  it("Old Grudge reveals your nemesis minion with Old Grudge attached", () => {
    let s = started();
    s = settle(reveal(s, "27172"));
    const nemesis = s.minions.find(
      (p) => card(p).set_code === "spider_man_nemesis",
    );
    expect(nemesis).toBeTruthy();
    expect(s.attachments.find((p) => p.code === "27172")?.attachedTo).toBe(
      nemesis!.id,
    );
  });
});
