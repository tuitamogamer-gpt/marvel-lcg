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
  heroStats,
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
import { identityMatch, uniqueMatches } from "../src/game/unique.js";
import type { Aspect, Card, GameState, Piece } from "../src/game/types.js";

type SourceCard = Card & { duplicate_of?: string };
const raw = (code: string) =>
  catalog.find((c) => c.code === code)! as SourceCard;
const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((total, quantity) => total + quantity, 0);
const aspects: Aspect[] = ["aggression", "justice", "leadership", "protection"];
const specs: {
  id: string;
  pack: string;
  prefix: string;
  last: number;
  faces: number;
  physical: number;
  aspect: Aspect;
  required: Record<string, number>;
  setup: Record<string, number>;
  supplementary: Record<string, number>;
  factions: Record<string, number>;
  obligation: string;
  nemesis: Record<string, number>;
  stats: { attack: number; thwart: number; defense: number; recover: number };
  hp: number;
}[] = [
  {
    id: "cyclops",
    pack: "cyclops",
    prefix: "33",
    last: 35,
    faces: 36,
    physical: 59,
    aspect: "leadership",
    required: {
      "33002": 1,
      "33003": 1,
      "33004": 1,
      "33005": 2,
      "33006": 2,
      "33007": 2,
      "33008": 1,
      "33009": 2,
      "33010": 3,
    },
    setup: {},
    supplementary: {},
    factions: {
      hero: 15,
      leadership: 12,
      aggression: 1,
      protection: 1,
      justice: 1,
      basic: 10,
    },
    obligation: "33027",
    nemesis: { "33028": 1, "33029": 1, "33030": 2, "33031": 1 },
    stats: { attack: 1, thwart: 2, defense: 2, recover: 3 },
    hp: 10,
  },
  {
    id: "phoenix",
    pack: "phoenix",
    prefix: "34",
    last: 35,
    faces: 37,
    physical: 58,
    aspect: "justice",
    required: {
      "34002a": 1,
      "34003": 1,
      "34004": 1,
      "34005": 1,
      "34006": 1,
      "34007": 1,
      "34008": 1,
      "34009": 1,
      "34010": 2,
      "34011": 2,
      "34012": 2,
      "34013": 2,
    },
    setup: { "34002a": 1 },
    supplementary: {},
    factions: { hero: 15, justice: 16, basic: 9 },
    obligation: "34028",
    nemesis: { "34029": 1, "34030": 1, "34031": 3 },
    stats: { attack: 1, thwart: 3, defense: 2, recover: 3 },
    hp: 9,
  },
  {
    id: "wolverine",
    pack: "wolv",
    prefix: "35",
    last: 37,
    faces: 38,
    physical: 58,
    aspect: "aggression",
    required: {
      "35002": 1,
      "35003": 1,
      "35004": 1,
      "35005": 1,
      "35006": 1,
      "35007": 1,
      "35008": 2,
      "35009": 2,
      "35010": 2,
      "35011": 2,
      "35012": 2,
    },
    setup: { "35002": 1 },
    supplementary: {},
    factions: { hero: 15, aggression: 19, basic: 6 },
    obligation: "35027",
    nemesis: { "35028": 1, "35029": 1, "35030": 2, "35031": 1 },
    stats: { attack: 2, thwart: 2, defense: 2, recover: 6 },
    hp: 10,
  },
  {
    id: "storm",
    pack: "storm",
    prefix: "36",
    last: 39,
    faces: 40,
    physical: 59,
    aspect: "leadership",
    required: {
      "36006": 1,
      "36007": 1,
      "36008": 1,
      "36009": 3,
      "36010": 3,
      "36011": 2,
      "36012": 2,
      "36013": 2,
    },
    setup: {},
    supplementary: { "36002": 1, "36003": 1, "36004": 1, "36005": 1 },
    factions: { hero: 15, leadership: 15, basic: 10 },
    obligation: "36030",
    nemesis: { "36031": 1, "36032": 1, "36033": 1, "36034": 2 },
    stats: { attack: 2, thwart: 1, defense: 1, recover: 3 },
    hp: 10,
  },
];
const source = (spec: (typeof specs)[number]) =>
  STARTER_DECKS.find((d) => d.id === `starter-${spec.prefix}001a`)!;
const originalCodes = (spec: (typeof specs)[number]) =>
  catalogDeckCodes(source(spec));
const game = (selected = [specs[0]], module = "bomb_scare") =>
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
    seed: 33343536,
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
  "33017": "06032",
  "33024": "01088",
  "33025": "01089",
  "33026": "01090",
  "34019": "15014",
  "34023": "33023",
  "34024": "05033",
  "34025": "01088",
  "34026": "01089",
  "34027": "01090",
  "35015": "06018",
  "35019": "06015",
  "35020": "32047",
  "35021": "32048",
  "35024": "01088",
  "35025": "01089",
  "35026": "01090",
  "36021": "33018",
  "36023": "32020",
  "36024": "33020",
  "36025": "32049",
  "36026": "05023",
  "36027": "01088",
  "36028": "01089",
  "36029": "01090",
};
const moduleSpecs: { id: string; counts: Record<string, number> }[] = [
  {
    id: "deathstrike",
    counts: { "35034": 1, "35035": 1, "35036": 2, "35037": 2 },
  },
  {
    id: "shadow_king",
    counts: { "36036": 1, "36037": 1, "36038": 2, "36039": 1 },
  },
];

describe("four full X-Men Hero Packs: immutable original-source contract", () => {
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

  it("covers all 151 faces and 234 physical cards, including extra player cards and modular sets", () => {
    let faces = 0,
      physical = 0;
    for (const spec of specs) {
      const pack = catalog.filter((c) => c.pack_code === spec.pack);
      const expected = Array.from({ length: spec.last }, (_, i) => {
        const code = `${spec.prefix}${String(i + 1).padStart(3, "0")}`;
        return i === 0 || (spec.id === "phoenix" && i === 1)
          ? [`${code}a`, `${code}b`]
          : [code];
      }).flat();
      expect(
        pack.map((c) => c.code),
        spec.pack,
      ).toEqual(expected);
      expect(pack, spec.pack).toHaveLength(spec.faces);
      const quantity = pack
        .filter((c) => !c.code.endsWith("b"))
        .reduce((total, c) => total + c.quantity, 0);
      expect(quantity, spec.pack).toBe(spec.physical);
      faces += pack.length;
      physical += quantity;
      for (const c of pack)
        expect(hasExecutableScript(c.code), c.code).toBe(true);
    }
    expect(faces).toBe(151);
    expect(physical).toBe(234);
  });

  it("keeps every printed numerical, faction, trait and link field on all imported faces", () => {
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
      specs.some((spec) => spec.pack === c.pack_code),
    ))
      for (const field of fields)
        expect(
          (card(imported.code) as unknown as Record<string, unknown>)[field],
          `${imported.code}.${field}`,
        ).toEqual((imported as Record<string, unknown>)[field]);
  });

  it("retains 25 reprint codes and inherits their printed mechanics without changing ownership", () => {
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
    expect(Object.keys(reprints)).toHaveLength(25);
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

  it("repairs Colossus's printed subtitle in both reprints without changing source JSON", () => {
    expect(raw("35021").subname).toBeUndefined();
    expect(card("35021").subname).toBe("Piotr Rasputin");
    expect(uniqueMatches(card("35021"), card("32048"))).toBe(true);
    expect(identityMatch("colossus", card("35021"))).toBe(true);
    expect(identityMatch("cyclops", card("35021"))).toBe(false);
  });
});

for (const spec of specs)
  describe(`${spec.id}: original identity, source deck and physical setup`, () => {
    const hero = `${spec.prefix}001a`,
      alter = `${spec.prefix}001b`;

    it("registers one executable hero with both original faces and correct identity artwork", () => {
      expect(SCRIPTED_HERO_IDS.has(spec.id)).toBe(true);
      expect(CATALOG_HEROES.filter((h) => h.id === spec.id)).toHaveLength(1);
      expect(CATALOG_HEROES.find((h) => h.id === spec.id)).toMatchObject({
        code: hero,
        alter,
        packCode: spec.pack,
        automated: true,
      });
      for (const alias of [spec.id, `${spec.pack}:${spec.id}`, hero, alter])
        expect(heroRuntime(alias)?.id, alias).toBe(spec.id);
      expect(heroRuntime(spec.id)?.identityCodes).toEqual([hero, alter]);
      expect(heroStarterAspects(spec.id)).toEqual([spec.aspect]);
      expect(raw(hero).back_link).toBe(alter);
      // The scanned retail A side is alter-ego; the imported A code is hero.
      expect(imageFor(hero)).toBe(`/cards/catalog/${alter}.webp`);
      expect(imageFor(alter)).toBe(`/cards/catalog/${hero}.webp`);
    });

    it("keeps the exact original forty playing cards plus separate physical setup", () => {
      const imported = sourceDecks.find((d) => d.heroCode === hero)!;
      const codes = deckCodes(spec.id, spec.aspect);
      expect(source(spec).cards).toEqual(imported.cards);
      expect(codes).toEqual(originalCodes(spec));
      expect(countsFor(codes)).toEqual(imported.cards);
      expect(codes).toHaveLength(40 + sum(spec.setup));
      expect(deckSizeFor(codes)).toBe(40);
      expect(heroRequiredCards(spec.id)).toEqual(spec.required);
      expect(heroSetupCards(spec.id)).toEqual(spec.setup);
      expect(heroSupplementaryCards(spec.id)).toEqual(spec.supplementary);
      expect(source(spec).setupCards).toEqual(spec.setup);
      expect(source(spec).supplementaryCards).toEqual(spec.supplementary);
      const counted = codes.filter((code) => !isPermanent(card(code)));
      expect(countsFor(counted.map((code) => card(code).faction_code))).toEqual(
        spec.factions,
      );
      expect(deckErrors(spec.id, spec.aspect, codes)).toEqual([]);
      expect(validateHeroDeck(spec.id, [spec.aspect], codes)).toMatchObject({
        valid: true,
        deckSize: 40,
        compositionSize: codes.length,
      });
      for (const code of [
        hero,
        alter,
        "34002b",
        ...Object.keys(spec.supplementary),
      ])
        expect(codes, code).not.toContain(code);
    });

    it.each(aspects)(
      "keeps all signatures and setup in a legal %s deck",
      (aspect) => {
        const codes = deckCodes(spec.id, aspect);
        expect(deckSizeFor(codes)).toBe(40);
        expect(deckErrors(spec.id, aspect, codes)).toEqual([]);
        for (const [code, quantity] of Object.entries(spec.required))
          expect(
            codes.filter((c) => c === code),
            code,
          ).toHaveLength(quantity);
        const options = deckOptions(spec.id, aspect).map((c) => c.code);
        for (const excluded of [
          hero,
          alter,
          "34002b",
          ...Object.keys(spec.supplementary),
        ])
          expect(options, excluded).not.toContain(excluded);
      },
    );

    it("rejects surplus/missing signatures, identity faces and an extra selected aspect", () => {
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
      for (const code of [
        hero,
        alter,
        "34002b",
        ...Object.keys(spec.supplementary),
      ])
        expect(
          validateHeroDeck(spec.id, [spec.aspect], [...codes, code]).valid,
          code,
        ).toBe(false);
    });

    it("draws the actual source deck and preserves setup and five nemesis cards through saves", () => {
      const s = game([spec]);
      expect(s.phase).toBe("mulligan");
      expect(s.error).toBeUndefined();
      expect(s.player.hand).toHaveLength(6);
      expect(heroCard(s).code).toBe(alter);
      expect(handSize(s)).toBe(6);
      expect(maxHP(s)).toBe(spec.hp);
      expect(heroStats(s)).toEqual(spec.stats);
      const all = playerZones(s.player);
      const original = all.filter((p) =>
        Object.hasOwn(source(spec).cards, p.code),
      );
      expect(countsFor(original.map((p) => p.code))).toEqual(
        source(spec).cards,
      );
      expect(new Set(original.map((p) => p.id)).size).toBe(
        40 + sum(spec.setup),
      );
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
      expect(handSize(restored)).toBe(5);
    });
  });

describe("cross-pack deck rules and encounter composition", () => {
  it.each([
    { index: 1, code: "34002a", counters: 4 },
    { index: 2, code: "35002", counters: 0 },
  ])(
    "puts the same physical Permanent $code into play after setup",
    ({ index, code, counters }) => {
      let s = game([specs[index]]);
      const original = playerZones(s.player).filter((p) => p.code === code);
      expect(original).toHaveLength(1);
      expect(s.player.hand.some((p) => p.code === code)).toBe(false);
      expect(s.player.deck.some((p) => p.code === code)).toBe(false);
      s = dispatch(s, { type: "MULLIGAN", ids: [] });
      expect(s.error).toBeUndefined();
      expect(s.phase).toBe("player");
      expect(s.player.inPlay.find((p) => p.code === code)).toMatchObject({
        id: original[0].id,
        ownerId: s.activePlayerId,
        counters,
      });
      expect(playerZones(s.player).filter((p) => p.code === code)).toHaveLength(
        1,
      );
    },
  );

  it("keeps all four physical Weather supports outside Storm's forty-card deck and moves the chosen one", () => {
    const spec = specs[3];
    let s = game([spec]);
    const weather = playerZones(s.player).filter((p) =>
      Object.hasOwn(spec.supplementary, p.code),
    );
    expect(countsFor(weather.map((p) => p.code))).toEqual(spec.supplementary);
    expect(new Set(weather.map((p) => p.id)).size).toBe(4);
    expect(
      [...s.player.hand, ...s.player.deck].some((p) =>
        Object.hasOwn(spec.supplementary, p.code),
      ),
    ).toBe(false);
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    expect(s.error).toBeUndefined();
    const choices = s.prompt?.options || [];
    expect(choices.map((option) => option.label).sort()).toEqual([
      "Blizzard",
      "Clear Skies",
      "Hurricane",
      "Thunderstorm",
    ]);
    s = dispatch(s, {
      type: "CHOOSE",
      id: choices.find((option) => option.label === "Clear Skies")!.id,
    });
    expect(s.error).toBeUndefined();
    expect(s.player.inPlay.find((p) => p.code === "36002")?.id).toBe(
      weather.find((p) => p.code === "36002")?.id,
    );
    expect(
      (s.player.setAside || []).filter((p) =>
        Object.hasOwn(spec.supplementary, p.code),
      ),
    ).toHaveLength(3);
    expect(
      playerZones(s.player)
        .filter((p) => Object.hasOwn(spec.supplementary, p.code))
        .map((p) => p.id)
        .sort(),
    ).toEqual(weather.map((p) => p.id).sort());
    // Setup moves the Weather support; it does not resolve Clear Skies' draw Special.
    expect(s.player.hand).toHaveLength(6);
  });

  it("uses one Cyclops aspect while allowing X-Men allies from all four aspects", () => {
    expect(source(specs[0]).aspect).toBe("multi");
    expect(source(specs[0]).aspects).toEqual([
      "leadership",
      "aggression",
      "protection",
      "justice",
    ]);
    expect(heroRuntime("cyclops")?.deckRule).toEqual({
      aspects: "one",
      exception: "x-men-allies",
    });
    const codes = originalCodes(specs[0]);
    const options = deckOptions("cyclops", "leadership").map((c) => c.code);
    for (const code of ["33012", "33013", "33014", "34014", "35013"])
      expect(options, code).toContain(code);
    for (const code of ["33032", "33033", "33034", "01050"])
      expect(options, code).not.toContain(code);
    expect(
      validateHeroDeck("cyclops", ["leadership"], [...codes, "34014"]).valid,
    ).toBe(true);
    for (const code of ["33032", "33033", "33034", "01050"])
      expect(
        validateHeroDeck("cyclops", ["leadership"], [...codes, code]).valid,
        code,
      ).toBe(false);
  });

  it("shares non-unique and unique copy limits across both packs' physical printings", () => {
    const cases: [string, Aspect, string, string][] = [
      ["cyclops", "leadership", "36021", "Effective Leadership"],
      ["storm", "leadership", "33018", "Effective Leadership"],
      ["cyclops", "leadership", "36024", "Utopia"],
      ["storm", "leadership", "33020", "Utopia"],
      ["cyclops", "leadership", "34023", "Psychic Rapport"],
      ["phoenix", "justice", "33023", "Psychic Rapport"],
      ["wolverine", "aggression", "32047", "Aggressive Energy"],
      ["wolverine", "aggression", "32048", "Colossus"],
    ];
    for (const [hero, aspect, extra, title] of cases)
      expect(
        deckErrors(hero, aspect, [...deckCodes(hero, aspect), extra]).some(
          (error) => error.includes(title),
        ),
        `${hero}:${extra}`,
      ).toBe(true);
    for (const code of ["33018", "36021", "35020", "34020"])
      expect(copyLimit(card(code))).toBe(2);
    for (const code of ["33023", "34023", "35023", "34035"])
      expect(copyLimit(card(code))).toBe(1);
  });

  it("retains identity-matching allies in other heroes' original decks without permitting them in their own decks", () => {
    const pairs = [
      ["phoenix", "33002"],
      ["cyclops", "34003"],
      ["storm", "34021"],
      ["colossus", "35021"],
    ];
    for (const [hero, code] of pairs)
      expect(identityMatch(hero, card(code)), code).toBe(true);
    expect(originalCodes(specs[0])).toContain("33002");
    expect(originalCodes(specs[1])).toContain("34003");
    expect(originalCodes(specs[1])).toContain("34021");
    expect(originalCodes(specs[2])).toContain("35021");
  });

  it.each(moduleSpecs)(
    "loads the exact $id modular quantity into a source mission",
    ({ id, counts }) => {
      expect(MODULES.filter((m) => m.id === id)).toHaveLength(1);
      const s = game([specs[0]], id);
      expect(s.modules).toEqual([id]);
      const modulePieces = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
      ].filter((p) => Object.hasOwn(counts, p.code));
      expect(countsFor(modulePieces.map((p) => p.code))).toEqual(counts);
      expect(new Set(modulePieces.map((p) => p.id)).size).toBe(sum(counts));
      for (const [code, quantity] of Object.entries(counts))
        expect(raw(code).quantity).toBe(quantity);
    },
  );

  it.each([
    [0, 1, 2],
    [0, 1, 3],
  ])(
    "keeps independent physical source cards for the three-seat roster %j",
    (...indices) => {
      const selected = indices.map((index) => specs[index]);
      const s = game(selected);
      expect(s.players).toHaveLength(3);
      const ids: string[] = [];
      for (const [index, seat] of s.players.entries()) {
        const spec = selected[index];
        const player = seat.id === s.activePlayerId ? s.player : seat.player;
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
        ids.push(...owned.map((p) => p.id));
      }
      expect(new Set(ids).size).toBe(ids.length);
    },
  );
});
