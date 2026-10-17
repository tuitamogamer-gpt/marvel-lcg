import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import sourceDecks from "../src/data/catalog-decks.json";
import {
  MODULES,
  card,
  deckCodes,
  handSize,
  heroCard,
  imageFor,
  maxHP,
} from "../src/game/cards.js";
import {
  CATALOG_HEROES,
  STARTER_DECKS,
  catalogDeckCodes,
} from "../src/game/catalog.js";
import {
  copyLimit,
  countsFor,
  deckErrors,
  deckOptions,
  deckSizeFor,
} from "../src/game/decks.js";
import { dispatch, newGame } from "../src/game/engine.js";
import { SCRIPTED_HERO_IDS } from "../src/game/engine-support.js";
import {
  heroRequiredCards,
  heroRuntime,
  heroSetupCards,
  heroStarterAspects,
  heroSupplementaryCards,
  isPermanent,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { identityMatch } from "../src/game/unique.js";
import type { Aspect, Card, GameState, Piece } from "../src/game/types.js";

type SourceCard = Card & { duplicate_of?: string };
const raw = (code: string) =>
  catalog.find((c) => c.code === code)! as SourceCard;
const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((total, quantity) => total + quantity, 0);
const aspects: Aspect[] = ["aggression", "justice", "leadership", "protection"];
const specs: {
  id: string;
  prefix: string;
  last: number;
  faces: number;
  physical: number;
  aspect: Aspect;
  playing: number;
  composition: number;
  heroHand: number;
  required: Record<string, number>;
  setup: Record<string, number>;
  factions: Record<string, number>;
  obligation: string;
  nemesis: Record<string, number>;
  stats: { attack: number; thwart: number; defense: number; recover: number };
  hp: number;
}[] = [
  {
    id: "gambit",
    prefix: "37",
    last: 35,
    faces: 36,
    physical: 59,
    aspect: "justice",
    playing: 40,
    composition: 40,
    heroHand: 5,
    required: {
      "37002": 1,
      "37003": 1,
      "37004": 1,
      "37005": 1,
      "37006": 3,
      "37007": 2,
      "37008": 2,
      "37009": 2,
      "37010": 2,
    },
    setup: {},
    factions: { hero: 15, justice: 13, basic: 12 },
    obligation: "37025",
    nemesis: { "37026": 1, "37027": 1, "37028": 2, "37029": 1 },
    stats: { attack: 2, thwart: 1, defense: 3, recover: 3 },
    hp: 9,
  },
  {
    id: "rogue",
    prefix: "38",
    last: 35,
    faces: 36,
    physical: 59,
    aspect: "protection",
    playing: 41,
    composition: 41,
    heroHand: 5,
    required: {
      "38002": 1,
      "38003": 1,
      "38004": 1,
      "38005": 3,
      "38006": 3,
      "38007": 2,
      "38008": 2,
      "38009": 3,
    },
    setup: {},
    factions: { hero: 16, protection: 17, basic: 8 },
    obligation: "38024",
    nemesis: { "38025": 1, "38026": 1, "38027": 3 },
    stats: { attack: 2, thwart: 2, defense: 2, recover: 3 },
    hp: 11,
  },
  {
    id: "psylocke",
    prefix: "41",
    last: 33,
    faces: 35,
    physical: 59,
    aspect: "justice",
    playing: 40,
    composition: 42,
    heroHand: 4,
    required: {
      "41002a": 2,
      "41003": 1,
      "41004": 3,
      "41005": 3,
      "41006": 2,
      "41007": 2,
      "41008": 1,
      "41009": 1,
      "41010": 1,
      "41011": 1,
    },
    setup: { "41002a": 2 },
    factions: { hero: 15, justice: 12, basic: 13 },
    obligation: "41025",
    nemesis: { "41026": 1, "41027": 1, "41028": 1, "41029": 2 },
    stats: { attack: 1, thwart: 1, defense: 2, recover: 3 },
    hp: 10,
  },
  {
    id: "angel",
    prefix: "42",
    last: 32,
    faces: 34,
    physical: 59,
    aspect: "protection",
    playing: 40,
    composition: 40,
    heroHand: 5,
    required: {
      "42002": 1,
      "42003": 2,
      "42004": 2,
      "42005": 2,
      "42006": 2,
      "42007": 2,
      "42008": 2,
      "42009": 1,
      "42010": 1,
    },
    setup: {},
    factions: { hero: 15, protection: 17, basic: 8 },
    obligation: "42024",
    nemesis: { "42025": 1, "42026": 1, "42027": 1, "42028": 2 },
    stats: { attack: 1, thwart: 2, defense: 2, recover: 3 },
    hp: 12,
  },
];
const source = (spec: (typeof specs)[number]) =>
  STARTER_DECKS.find((d) => d.id === `starter-${spec.prefix}001a`)!;
const originalCodes = (spec: (typeof specs)[number]) =>
  catalogDeckCodes(source(spec));
const game = (selected = [specs[0]], module = "bomb_scare", seed = 37384142) =>
  newGame({
    heroId: selected[0].id,
    aspect: selected[0].aspect,
    heroes: selected.map((spec) => ({
      heroId: spec.id,
      aspect: spec.aspect,
      deckCards: originalCodes(spec),
    })),
    villainId: "rhino",
    modules: [module],
    seed,
    pacing: "expert",
  });
const playerZones = (player: GameState["player"]): Piece[] => [
  ...player.hand,
  ...player.deck,
  ...player.discard,
  ...player.inPlay,
  ...(player.setAside || []),
];
const reprints = {
  "37014": "08013",
  "37016": "34020",
  "37017": "32019",
  "37018": "32049",
  "37020": "18020",
  "37022": "01088",
  "37023": "01089",
  "37024": "01090",
  "38013": "09020",
  "38015": "05014",
  "38017": "32018",
  "38020": "37019",
  "38021": "01088",
  "38022": "01089",
  "38023": "01090",
  "41014": "05031",
  "41021": "40028",
  "42015": "17030",
  "42021": "41020",
};
const moduleSpecs: { id: string; counts: Record<string, number> }[] = [
  { id: "exodus", counts: { "37032": 1, "37033": 1, "37034": 2, "37035": 2 } },
  {
    id: "reavers",
    counts: {
      "38029": 1,
      "38030": 1,
      "38031": 1,
      "38032": 1,
      "38033": 1,
      "38034": 1,
      "38035": 2,
    },
  },
];
const excluded = (spec: (typeof specs)[number]) => [
  `${spec.prefix}001a`,
  `${spec.prefix}001b`,
  ...(spec.id === "angel" ? ["42001c"] : []),
  "41002b",
];

describe("four complete Hero Packs, batch two: immutable source contract", () => {
  it("preserves the exact imported catalog, source decks and artwork map bytes", () => {
    const hashes = {
      "catalog-cards.json":
        "c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb",
      "catalog-decks.json":
        "6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886",
      "catalog-images.json":
        "fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d",
    };
    for (const [file, hash] of Object.entries(hashes))
      expect(
        createHash("sha256")
          .update(readFileSync(new URL(`../src/data/${file}`, import.meta.url)))
          .digest("hex"),
        file,
      ).toBe(hash);
  });

  it("covers all 141 faces and 236 physical cards, including both modules and extra player cards", () => {
    let faces = 0,
      physical = 0;
    for (const spec of specs) {
      const pack = catalog.filter((c) => c.pack_code === spec.id);
      const expected = Array.from({ length: spec.last }, (_, i) => {
        const code = `${spec.prefix}${String(i + 1).padStart(3, "0")}`;
        if (i === 0)
          return spec.id === "angel"
            ? [`${code}a`, `${code}b`, `${code}c`]
            : [`${code}a`, `${code}b`];
        if (spec.id === "psylocke" && i === 1) return [`${code}a`, `${code}b`];
        return [code];
      }).flat();
      expect(
        pack.map((c) => c.code),
        spec.id,
      ).toEqual(expected);
      expect(pack, spec.id).toHaveLength(spec.faces);
      const quantity = pack
        .filter((c) => !/[bc]$/.test(c.code))
        .reduce((total, c) => total + c.quantity, 0);
      expect(quantity, spec.id).toBe(spec.physical);
      faces += pack.length;
      physical += quantity;
      for (const c of pack)
        expect(hasExecutableScript(c.code), c.code).toBe(true);
    }
    expect(faces).toBe(141);
    expect(physical).toBe(236);
  });

  it("retains every printed numeric, resource, faction, trait and link field on all faces", () => {
    const fields = [
      "quantity",
      "type_code",
      "set_code",
      "pack_code",
      "faction_code",
      "position",
      "attack",
      "attack_star",
      "attack_cost",
      "scheme",
      "scheme_star",
      "thwart",
      "thwart_star",
      "thwart_cost",
      "defense",
      "defense_star",
      "recover",
      "recover_star",
      "cost",
      "health",
      "hand_size",
      "traits",
      "deck_limit",
      "is_unique",
      "base_threat",
      "base_threat_fixed",
      "scheme_crisis",
      "scheme_hazard",
      "scheme_acceleration",
      "scheme_amplify",
      "boost",
      "boost_star",
      "resource_energy",
      "resource_mental",
      "resource_physical",
      "resource_wild",
      "back_link",
    ];
    for (const imported of catalog.filter((c) =>
      specs.some((spec) => spec.id === c.pack_code),
    ))
      for (const field of fields)
        expect(
          (card(imported.code) as unknown as Record<string, unknown>)[field],
          `${imported.code}.${field}`,
        ).toEqual((imported as Record<string, unknown>)[field]);
  });

  it("keeps all nineteen reprint codes and their printed mechanics", () => {
    const fields: (keyof Card)[] = [
      "name",
      "type_code",
      "faction_code",
      "cost",
      "traits",
      "text",
      "resource_energy",
      "resource_mental",
      "resource_physical",
      "resource_wild",
      "attack",
      "attack_cost",
      "thwart",
      "thwart_cost",
      "health",
      "deck_limit",
      "is_unique",
    ];
    expect(Object.keys(reprints)).toHaveLength(19);
    for (const [code, base] of Object.entries(reprints)) {
      expect(raw(code).duplicate_of, code).toBe(base);
      expect(card(code).code).toBe(code);
      expect(hasExecutableScript(code), code).toBe(true);
      expect(hasExecutableScript(base), base).toBe(true);
      for (const field of fields)
        expect(raw(code)[field], `${code}/${base}.${field}`).toEqual(
          raw(base)[field],
        );
    }
  });
});

for (const spec of specs)
  describe(`${spec.id}: original identity, deck and physical setup`, () => {
    const hero = `${spec.prefix}001a`,
      alter = `${spec.prefix}001b`;
    it("registers one executable identity with every original face and correct artwork", () => {
      const identities = [
        hero,
        alter,
        ...(spec.id === "angel" ? ["42001c"] : []),
      ];
      expect(SCRIPTED_HERO_IDS.has(spec.id)).toBe(true);
      expect(CATALOG_HEROES.filter((h) => h.id === spec.id)).toHaveLength(1);
      expect(CATALOG_HEROES.find((h) => h.id === spec.id)).toMatchObject({
        code: hero,
        alter,
        packCode: spec.id,
        automated: true,
      });
      for (const alias of [spec.id, `${spec.id}:${spec.id}`, ...identities])
        expect(heroRuntime(alias)?.id, alias).toBe(spec.id);
      expect(heroRuntime(spec.id)?.identityCodes).toEqual(identities);
      expect(heroStarterAspects(spec.id)).toEqual([spec.aspect]);
      expect(raw(hero).back_link).toBe(alter);
      // Only Gambit and Rogue's retail scans reverse the catalog's a/b convention.
      const swapped = spec.id === "gambit" || spec.id === "rogue";
      expect(imageFor(hero)).toBe(
        `/cards/catalog/${swapped ? alter : hero}.webp`,
      );
      expect(imageFor(alter)).toBe(
        `/cards/catalog/${swapped ? hero : alter}.webp`,
      );
      if (spec.id === "angel")
        expect(imageFor("42001c")).toBe("/cards/catalog/42001c.webp");
      expect(raw(hero)).toMatchObject({
        attack: spec.stats.attack,
        thwart: spec.stats.thwart,
        defense: spec.stats.defense,
        health: spec.hp,
        hand_size: spec.heroHand,
      });
      expect(raw(alter)).toMatchObject({
        recover: spec.stats.recover,
        health: spec.hp,
        hand_size: 6,
      });
    });

    it("keeps the exact original deck, including Rogue's counted Touched and Psylocke's excluded Permanents", () => {
      const imported = sourceDecks.find((d) => d.heroCode === hero)!;
      const codes = deckCodes(spec.id, spec.aspect);
      expect(source(spec).cards).toEqual(imported.cards);
      expect(codes).toEqual(originalCodes(spec));
      expect(countsFor(codes)).toEqual(imported.cards);
      expect(codes).toHaveLength(spec.composition);
      expect(deckSizeFor(codes)).toBe(spec.playing);
      expect(heroRequiredCards(spec.id)).toEqual(spec.required);
      expect(heroSetupCards(spec.id)).toEqual(spec.setup);
      expect(heroSupplementaryCards(spec.id)).toEqual({});
      expect(source(spec).setupCards).toEqual(spec.setup);
      expect(source(spec).supplementaryCards).toEqual({});
      const counted = codes.filter((code) => !isPermanent(card(code)));
      expect(countsFor(counted.map((code) => card(code).faction_code))).toEqual(
        spec.factions,
      );
      expect(deckErrors(spec.id, spec.aspect, codes)).toEqual([]);
      expect(validateHeroDeck(spec.id, [spec.aspect], codes)).toMatchObject({
        valid: true,
        deckSize: spec.playing,
        compositionSize: spec.composition,
      });
      for (const code of excluded(spec))
        expect(codes, code).not.toContain(code);
    });

    it.each(aspects)(
      "retains every mandatory physical signature in a legal %s deck",
      (aspect) => {
        const codes = deckCodes(spec.id, aspect);
        expect(deckSizeFor(codes)).toBe(
          aspect === spec.aspect ? spec.playing : 40,
        );
        expect(deckErrors(spec.id, aspect, codes)).toEqual([]);
        for (const [code, quantity] of Object.entries(spec.required))
          expect(
            codes.filter((c) => c === code),
            code,
          ).toHaveLength(quantity);
        const options = deckOptions(spec.id, aspect).map((c) => c.code);
        for (const code of excluded(spec))
          expect(options, code).not.toContain(code);
      },
    );

    it("rejects missing/surplus signatures, extra identity faces and a second aspect", () => {
      const codes = originalCodes(spec),
        first = Object.keys(spec.required)[0];
      expect(
        validateHeroDeck(
          spec.id,
          [spec.aspect],
          codes.filter((c) => c !== first),
        ).valid,
      ).toBe(false);
      expect(
        validateHeroDeck(spec.id, [spec.aspect], [...codes, first]).valid,
      ).toBe(false);
      expect(
        validateHeroDeck(spec.id, ["leadership", "justice"], codes).valid,
      ).toBe(false);
      for (const code of excluded(spec))
        expect(
          validateHeroDeck(spec.id, [spec.aspect], [...codes, code]).valid,
          code,
        ).toBe(false);
    });

    it("draws the actual source cards and retains physical ownership and five nemesis cards through JSON", () => {
      const s = game([spec]);
      expect(s.phase).toBe("mulligan");
      expect(s.error).toBeUndefined();
      expect(s.player.hand).toHaveLength(6);
      expect(heroCard(s).code).toBe(alter);
      expect(handSize(s)).toBe(6);
      expect(maxHP(s)).toBe(spec.hp);
      const all = playerZones(s.player),
        original = all.filter((p) => Object.hasOwn(source(spec).cards, p.code));
      expect(countsFor(original.map((p) => p.code))).toEqual(
        source(spec).cards,
      );
      expect(new Set(original.map((p) => p.id)).size).toBe(spec.composition);
      expect(original.every((p) => p.ownerId === s.activePlayerId)).toBe(true);
      const nemesis = all.filter((p) => Object.hasOwn(spec.nemesis, p.code));
      expect(countsFor(nemesis.map((p) => p.code))).toEqual(spec.nemesis);
      expect(new Set(nemesis.map((p) => p.id)).size).toBe(5);
      expect(heroRuntime(spec.id)?.obligationCodes).toEqual([spec.obligation]);
      expect(heroRuntime(spec.id)?.nemesisCodes).toEqual(
        Object.keys(spec.nemesis),
      );
      expect(
        s.encounter.deck.filter((p) => p.code === spec.obligation),
      ).toHaveLength(1);
      for (const code of [spec.obligation, ...Object.keys(spec.nemesis)])
        expect(originalCodes(spec)).not.toContain(code);
      const restored = JSON.parse(JSON.stringify(s)) as GameState;
      expect(playerZones(restored.player)).toEqual(all);
      restored.player.form = "hero";
      expect(heroCard(restored).code).toBe(hero);
      expect(handSize(restored)).toBe(spec.heroHand);
    });
  });

describe("batch two: special setup and cross-pack source constraints", () => {
  it("keeps Touched as a counted, non-Permanent signature and sets it aside only after mulligan", () => {
    expect(isPermanent(card("38002"))).toBe(false);
    expect(card("38002").cost).toBeUndefined();
    // Across these deterministic openings Touched occurs in both hand and deck.
    const origins = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      let s = game([specs[1]], "bomb_scare", seed);
      const original = playerZones(s.player).filter((p) => p.code === "38002");
      expect(original).toHaveLength(1);
      const inHand = s.player.hand.some((p) => p.id === original[0].id);
      origins.add(inHand ? "hand" : "deck");
      expect(
        [...s.player.hand, ...s.player.deck].some(
          (p) => p.id === original[0].id,
        ),
      ).toBe(true);
      s = dispatch(s, { type: "MULLIGAN", ids: [] });
      expect(s.error).toBeUndefined();
      expect(s.phase).toBe("player");
      expect(s.player.setAside?.find((p) => p.code === "38002")).toMatchObject({
        id: original[0].id,
        ownerId: s.activePlayerId,
      });
      expect(s.player.hand).toHaveLength(inHand ? 5 : 6);
      expect(
        [...s.player.hand, ...s.player.deck].some((p) => p.code === "38002"),
      ).toBe(false);
      expect(
        playerZones(s.player).filter((p) => p.code === "38002"),
      ).toHaveLength(1);
      expect(JSON.parse(JSON.stringify(s)).player.setAside).toEqual(
        s.player.setAside,
      );
    }
    expect([...origins].sort()).toEqual(["deck", "hand"]);
  });

  it("puts the same two distinct Psi-Knife cards in play without adding reverse-face copies", () => {
    let s = game([specs[2]]);
    const before = playerZones(s.player).filter((p) => p.code === "41002a");
    expect(before).toHaveLength(2);
    expect(new Set(before.map((p) => p.id)).size).toBe(2);
    expect(
      [...s.player.hand, ...s.player.deck].some((p) =>
        p.code.startsWith("41002"),
      ),
    ).toBe(false);
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    expect(s.error).toBeUndefined();
    expect(s.phase).toBe("player");
    const after = s.player.inPlay.filter((p) => p.code === "41002a");
    expect(after.map((p) => p.id).sort()).toEqual(
      before.map((p) => p.id).sort(),
    );
    expect(after.every((p) => p.ownerId === s.activePlayerId)).toBe(true);
    expect(playerZones(s.player).some((p) => p.code === "41002b")).toBe(false);
    for (const code of ["41002a", "41002b"]) {
      expect(isPermanent(card(code))).toBe(true);
      expect(imageFor(code)).toBe(`/cards/catalog/${code}.webp`);
    }
  });

  it("keeps Archangel's printed third face and acceleration icon without adding a deck card", () => {
    expect(card("42001c")).toMatchObject({
      name: "Archangel",
      attack: 2,
      thwart: 0,
      defense: 3,
      health: 12,
      hand_size: 5,
      scheme_acceleration: 1,
    });
    expect(heroRuntime("angel")?.forms.map((c) => c.code)).toEqual([
      "42001a",
      "42001b",
      "42001c",
    ]);
    expect(originalCodes(specs[3])).not.toContain("42001c");
  });

  it("shares title-based limits across the original team-ups and reprinted resources", () => {
    const cases: [string, Aspect, string, string][] = [
      ["gambit", "justice", "38020", "Beauty and the Thief"],
      ["rogue", "protection", "37019", "Beauty and the Thief"],
      ["psylocke", "justice", "42021", "Soaring Hearts"],
      ["angel", "protection", "41020", "Soaring Hearts"],
      ["gambit", "justice", "34020", "Passion for Justice"],
      ["rogue", "protection", "32018", "Defensive Energy"],
      ["psylocke", "justice", "40028", "The Power of the Mind"],
    ];
    for (const [hero, aspect, extra, title] of cases)
      expect(
        deckErrors(hero, aspect, [...deckCodes(hero, aspect), extra]).some(
          (error) => error.includes(title),
        ),
        `${hero}:${extra}`,
      ).toBe(true);
    for (const code of ["37019", "38020", "41020", "42021", "41016", "42017"])
      expect(copyLimit(card(code))).toBe(1);
    for (const code of ["37016", "38017"])
      expect(copyLimit(card(code))).toBe(2);
    for (const code of ["41021", "40028", "42022"])
      expect(copyLimit(card(code))).toBe(3);
  });

  it("retains the four identity-matching signature allies in their actual source decks", () => {
    const pairs = [
      ["rogue", "37002"],
      ["gambit", "38003"],
      ["angel", "41003"],
      ["psylocke", "42002"],
    ];
    for (const [hero, code] of pairs)
      expect(identityMatch(hero, card(code)), code).toBe(true);
    for (const [index, code] of ["37002", "38003", "41003", "42002"].entries())
      expect(originalCodes(specs[index])).toContain(code);
  });

  it.each(moduleSpecs)(
    "loads the exact $id modular quantities with distinct physical IDs",
    ({ id, counts }) => {
      expect(MODULES.filter((m) => m.id === id)).toHaveLength(1);
      const s = game([specs[0]], id);
      expect(s.modules).toEqual([id]);
      const pieces = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
      ].filter((p) => Object.hasOwn(counts, p.code));
      expect(countsFor(pieces.map((p) => p.code))).toEqual(counts);
      expect(new Set(pieces.map((p) => p.id)).size).toBe(sum(counts));
      for (const [code, quantity] of Object.entries(counts))
        expect(raw(code).quantity).toBe(quantity);
    },
  );

  it.each([
    [0, 1, 2],
    [1, 2, 3],
  ])(
    "keeps separate physical source cards and JSON ownership for roster %j",
    (...indices) => {
      const selected = indices.map((index) => specs[index]),
        s = game(selected);
      expect(s.players).toHaveLength(3);
      const ids: string[] = [];
      for (const [index, seat] of s.players.entries()) {
        const spec = selected[index],
          player = seat.id === s.activePlayerId ? s.player : seat.player;
        const owned = playerZones(player).filter((p) =>
          Object.hasOwn(source(spec).cards, p.code),
        );
        expect(countsFor(owned.map((p) => p.code)), spec.id).toEqual(
          source(spec).cards,
        );
        expect(
          owned.every((p) => p.ownerId === seat.id),
          spec.id,
        ).toBe(true);
        expect(owned).toHaveLength(spec.composition);
        ids.push(...owned.map((p) => p.id));
      }
      expect(new Set(ids).size).toBe(ids.length);
      const restored = JSON.parse(JSON.stringify(s)) as GameState;
      expect(restored.players).toEqual(s.players);
      expect(restored.player).toEqual(s.player);
    },
  );
});
