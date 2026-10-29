import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import sourceDecks from "../src/data/catalog-decks.json";
import images from "../src/data/catalog-images.json";
import { card, MODULES, scenarioModules, VILLAINS } from "../src/game/cards.js";
import { countsFor } from "../src/game/decks.js";
import { dispatch, newGame, schemeLimit } from "../src/game/engine.js";
import { EXPLICIT_CARD_SCRIPTS } from "../src/game/engine-support.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { seatView } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";

const scenarioCodes = [
  "04058",
  "04059",
  "04060",
  "04061a",
  "04061b",
  "04062a",
  "04062b",
  "04063a",
  "04063b",
  "04064",
  "04065",
  "04066",
  "04067",
  "04068",
  "04069",
  "04070",
  "04071",
];
const weaponCodes = ["04072", "04073", "04074", "04075"];
const defaultModules = ["hydra_assault", "weap_master", "legions_of_hydra"];
const encounterCounts = {
  "04064": 1,
  "04065": 1,
  "04066": 2,
  "04067": 2,
  "04068": 2,
  "04069": 2,
  "04070": 2,
  "04071": 1,
};
const raw = (code: string) => catalog.find((c) => c.code === code)!;
const seats = [
  { heroId: "hawkeye", heroCode: "04001a", aspect: "leadership" as Aspect },
  { heroId: "spider_man", heroCode: "01001a", aspect: "justice" as Aspect },
  { heroId: "iron_man", heroCode: "01029a", aspect: "aggression" as Aspect },
];
const sourceFor = (heroCode: string) =>
  sourceDecks.find((d) => d.heroCode === heroCode)!;
function create(
  players = 1,
  difficulty: "standard" | "expert" = "standard",
  extra: Partial<Parameters<typeof newGame>[0]> = {},
) {
  let s = newGame({
    heroId: seats[0].heroId,
    aspect: seats[0].aspect,
    heroes: seats.slice(0, players).map(({ heroId, heroCode, aspect }) => ({
      heroId,
      aspect,
      deckCards: Object.entries(sourceFor(heroCode).cards).flatMap(
        ([code, quantity]) => Array(quantity).fill(code) as string[],
      ),
    })),
    villainId: "crossbones",
    difficulty,
    seed: 4058,
    pacing: "expert",
    ...extra,
  });
  for (let guard = 0; s.prompt && guard < 16; guard++) {
    expect(s.prompt.options.length).toBeGreaterThan(0);
    s = dispatch(s, { type: "CHOOSE", id: s.prompt.options[0].id });
    expect(s.error).toBeUndefined();
  }
  expect(s.prompt).toBeNull();
  return s;
}
function physicalPieces(s: GameState): Piece[] {
  const roots = [
    s.villain,
    ...(s.crossbones?.villainDeck || []),
    ...(s.crossbones?.mainDeck || []),
    ...(s.crossbones?.currentMain ? [s.crossbones.currentMain] : []),
    ...(s.crossbones?.weaponDeck || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.victoryDisplay || []),
    ...s.removed,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
  ];
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.captured || []).flatMap(nested),
    ...(p.storedCards || []).flatMap(nested),
  ];
  return roots.flatMap(nested);
}

describe("Crossbones original retail source contract", () => {
  it("preserves original catalog, starter lists and image mappings", () => {
    const hashes = {
      "catalog-cards.json":
        "c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb",
      "catalog-decks.json":
        "6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886",
      "catalog-images.json":
        "fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d",
    };
    for (const [file, expected] of Object.entries(hashes))
      expect(
        createHash("sha256")
          .update(readFileSync(new URL(`../src/data/${file}`, import.meta.url)))
          .digest("hex"),
        file,
      ).toBe(expected);
  });
  it("retains seventeen faces on nineteen physical cards and four separate weapons", () => {
    const source = catalog.filter((c) => c.set_code === "crossbones");
    expect(source.map((c) => c.code)).toEqual(scenarioCodes);
    expect(
      source
        .filter((c) => !c.code.endsWith("b"))
        .reduce((n, c) => n + c.quantity, 0),
    ).toBe(19);
    expect(
      Object.values(encounterCounts).reduce((n, count) => n + count, 0),
    ).toBe(13);
    for (const [code, quantity] of Object.entries(encounterCounts))
      expect(raw(code).quantity, code).toBe(quantity);
    for (const code of [...scenarioCodes, ...weaponCodes]) {
      expect((images as Record<string, string>)[code]).toBe(
        `/cards/catalog/${code}.webp`,
      );
      expect(
        existsSync(
          new URL(`../public/cards/catalog/${code}.webp`, import.meta.url),
        ),
        code,
      ).toBe(true);
    }
    for (const code of weaponCodes)
      expect(raw(code)).toMatchObject({
        pack_code: "trors",
        set_code: "exper_weapon",
        quantity: 1,
      });
    for (const [front, back] of [
      ["04061a", "04061b"],
      ["04062a", "04062b"],
      ["04063a", "04063b"],
    ])
      expect(raw(front)).toMatchObject({ back_link: back, quantity: 1 });
  });
  it.each([
    ["04058", 1, 1, 12, "I"],
    ["04059", 2, 2, 14, "II"],
    ["04060", 2, 3, 16, "III"],
  ])(
    "retains Crossbones stage %s and its conditional piercing",
    (code, scheme, attack, health, stage) => {
      expect(raw(String(code))).toMatchObject({
        scheme,
        attack,
        attack_star: true,
        health,
        health_per_hero: true,
        is_unique: true,
        stage,
        traits: "Hydra. Mercenary.",
      });
      expect(raw(String(code)).text).toContain(
        "While Crossbones has a [[Weapon]] attachment",
      );
    },
  );
  it("restores the scanned first-scheme reveal without changing the incomplete import", () => {
    expect(
      createHash("sha256")
        .update(
          readFileSync(
            new URL("../public/cards/catalog/04061b.webp", import.meta.url),
          ),
        )
        .digest("hex"),
    ).toBe("2f2de0a7fe0173b9bdcdd5befa23b12e25c7e9390238a4e7d7712699b4b38b50");
    expect(raw("04061b").text).toBeUndefined();
    expect(card("04061b").text).toBe(
      "<b>When Revealed</b>: Reveal the top card of the Experimental Weapons deck.",
    );
    expect(raw("04061a").text).toContain(
      "Hydra Assault, Weapon Master, and Legions of Hydra",
    );
    expect(raw("04061a").errata).toContain("RRG 1.4");
  });
  it.each([
    ["04061b", 0, 3],
    ["04062b", 1, 6],
    ["04063b", 1, 5],
  ])("retains main scheme %s scaling", (code, base, limit) => {
    expect(raw(String(code))).toMatchObject({
      base_threat: base,
      escalation_threat: 1,
      threat: limit,
    });
    expect(raw(String(code)).threat_fixed).toBeUndefined();
    expect(raw(String(code)).escalation_threat_fixed).toBeUndefined();
  });
  it("retains printed attachment, boost and side-scheme metadata", () => {
    expect(raw("04064")).toMatchObject({
      attack: 0,
      attack_star: true,
      boost: 3,
      is_unique: true,
      traits: "Weapon.",
    });
    expect(raw("04064").text).toContain("Uses (2[per_hero] ammo counters)");
    expect(raw("04065")).toMatchObject({
      attack: 1,
      scheme: 1,
      boost: 3,
      is_unique: true,
      traits: "Armor.",
    });
    expect(raw("04066")).toMatchObject({
      attack: 1,
      scheme: 1,
      health: 2,
      boost: 1,
    });
    expect(raw("04068").boost_star).toBe(true);
    expect(raw("04068").boost).toBeUndefined();
    expect(raw("04070")).toMatchObject({
      base_threat: 2,
      scheme_acceleration: 1,
      boost: 2,
    });
    expect(raw("04070").base_threat_fixed).toBeUndefined();
    expect(raw("04071")).toMatchObject({
      base_threat: 3,
      base_threat_fixed: true,
      scheme_crisis: 1,
      boost: 2,
    });
  });
});

describe("Crossbones executable setup and source acceptance", () => {
  it("retains Crossbones support and the still-pending official campaign gaps", () => {
    for (const code of scenarioCodes) {
      expect(hasExecutableScript(code), code).toBe(true);
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
    }
    for (const code of ["04155", "04159a", "04159b", "04163"])
      expect(hasExecutableScript(code), code).toBe(false);
    expect(VILLAINS[10]).toMatchObject({
      id: "crossbones",
      codes: ["04058", "04059", "04060"],
      schemes: ["04061b", "04062b", "04063b"],
      moduleCount: 3,
      defaultModules,
      reservedSets: ["exper_weapon"],
    });
    expect(MODULES).toHaveLength(30);
    expect(scenarioModules("crossbones")).toHaveLength(29);
    expect(
      scenarioModules("crossbones").some((m) => m.id === "exper_weapon"),
    ).toBe(false);
  });
  it.each([1, 2, 3])(
    "constructs all original Standard physical pieces for %s players",
    (players) => {
      const s = create(players);
      const pieces = physicalPieces(s);
      expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
      const source = pieces.filter((p) => card(p).set_code === "crossbones");
      expect(source).toHaveLength(18); // The unused third villain is outside this difficulty's game.
      expect(
        countsFor(
          source
            .filter((p) => Object.hasOwn(encounterCounts, p.code))
            .map((p) => p.code),
        ),
      ).toEqual(encounterCounts);
      expect(
        countsFor(
          source
            .filter((p) => !Object.hasOwn(encounterCounts, p.code))
            .map((p) => p.code.replace(/[ab]$/, "")),
        ),
      ).toEqual({ "04058": 1, "04059": 1, "04061": 1, "04062": 1, "04063": 1 });
      expect(s.villain).toMatchObject({
        code: "04058",
        hp: 12 * players,
        stage: 1,
      });
      expect(s.scheme).toMatchObject({ code: "04061b", threat: 0 });
      expect(schemeLimit(s)).toBe(3 * players);
      expect(s.modules).toEqual(defaultModules);
      for (const set of [...defaultModules, "standard"]) {
        const original = catalog.filter((c) => c.set_code === set);
        expect(
          countsFor(
            pieces.filter((p) => card(p).set_code === set).map((p) => p.code),
          ),
          set,
        ).toEqual(
          Object.fromEntries(original.map((c) => [c.code, c.quantity])),
        );
      }
      expect(pieces.some((p) => card(p).set_code === "expert")).toBe(false);
      expect(s.crossbones?.weaponDeck).toHaveLength(3);
      expect(
        pieces
          .filter((p) => card(p).set_code === "exper_weapon")
          .map((p) => p.code)
          .sort(),
      ).toEqual(weaponCodes);
      expect(
        s.attachments.filter((p) => weaponCodes.includes(p.code)),
      ).toHaveLength(1);
      for (const [index, seat] of s.players.entries()) {
        const owned = pieces.filter((p) => p.ownerId === seat.id);
        expect(countsFor(owned.map((p) => p.code))).toEqual(
          sourceFor(seats[index].heroCode).cards,
        );
      }
      const restored = JSON.parse(JSON.stringify(s)) as GameState;
      expect(physicalPieces(restored).map((p) => [p.id, p.code])).toEqual(
        pieces.map((p) => [p.id, p.code]),
      );
    },
  );
  it.each([1, 2, 3])(
    "starts Expert stage II with the same actual Machine Gun for %s players",
    (players) => {
      const s = create(players, "expert");
      const pieces = physicalPieces(s);
      expect(s.villain).toMatchObject({
        code: "04059",
        hp: 14 * players,
        stage: 2,
      });
      expect(s.crossbones?.villainDeck.map((p) => p.code)).toEqual(["04060"]);
      expect(
        pieces.filter((p) => card(p).set_code === "crossbones"),
      ).toHaveLength(18);
      expect(pieces.filter((p) => p.code === "04064")).toHaveLength(1);
      expect(s.attachments.find((p) => p.code === "04064")).toMatchObject({
        counters: 2 * players,
      });
      expect(
        s.attachments.filter((p) => weaponCodes.includes(p.code)),
      ).toHaveLength(1);
      expect(s.crossbones?.weaponDeck).toHaveLength(3);
    },
  );
  it("accepts three distinct substitutions and rejects duplicates, missing slots and the reserved deck", () => {
    const modules = ["bomb_scare", "hydra_patrol", "goblin_gimmicks"];
    const s = create(1, "standard", { modules });
    expect(s.modules).toEqual(modules);
    const pieces = physicalPieces(s);
    for (const set of defaultModules)
      expect(pieces.some((p) => card(p).set_code === set)).toBe(false);
    expect(
      pieces.filter((p) => card(p).set_code === "exper_weapon"),
    ).toHaveLength(4);
    for (const bad of [
      [],
      ["bomb_scare"],
      ["bomb_scare", "hydra_patrol"],
      ["bomb_scare", "hydra_patrol", "exper_weapon"],
      ["bomb_scare", "bomb_scare", "hydra_patrol"],
      [...modules, "weap_master"],
    ])
      expect(() => create(1, "standard", { modules: bad })).toThrow();
  });
  it("fills legal remaining slots deterministically when the legacy primary module is selected", () => {
    for (const module of scenarioModules("crossbones")) {
      const s = create(1, "standard", { module: module.id });
      expect(s.modules?.[0]).toBe(module.id);
      expect(s.modules).toHaveLength(3);
      expect(new Set(s.modules).size).toBe(3);
      expect(s.modules).not.toContain("exper_weapon");
      expect(s.crossbones?.weaponDeck).toHaveLength(3);
    }
  });
});
