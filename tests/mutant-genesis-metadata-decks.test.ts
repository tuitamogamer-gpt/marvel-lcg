import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import sourceDecks from "../src/data/catalog-decks.json";
import { DeckEditor } from "../src/account/AccountPage.js";
import { ContentBrowser } from "../src/ContentBrowser.js";
import {
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
import {
  EXPLICIT_CARD_SCRIPTS,
  SCRIPTED_HERO_IDS,
} from "../src/game/engine-support.js";
import {
  heroRequiredCards,
  heroRuntime,
  heroSetupCards,
  heroStarterAspects,
  heroSupplementaryCards,
  isPermanent,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { hasCoreScript, rulesCode } from "../src/game/rules-code.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { identityMatch, uniqueMatches } from "../src/game/unique.js";
import type { Aspect, Card, GameState, Piece } from "../src/game/types.js";

const raw = (code: string) => catalog.find((c) => c.code === code)! as Card;
const coreAliases = {
  "32022": "01088",
  "32023": "01089",
  "32024": "01090",
  "32052": "01088",
  "32053": "01089",
  "32054": "01090",
};
const inheritedPairs = {
  "32015": "15030",
  "32016": "13033",
  "32046": "10015",
  "32051": "21022",
};
const specs: {
  id: string;
  hero: string;
  alter: string;
  aspect: Aspect;
  aspectCount: number;
  basicCount: number;
  required: Record<string, number>;
  setup: Record<string, number>;
  obligation: string;
  nemesis: Record<string, number>;
  stats: { attack: number; thwart: number; defense: number; recover: number };
  hp: number;
  heroHand: number;
}[] = [
  {
    id: "colossus",
    hero: "32001a",
    alter: "32001b",
    aspect: "protection",
    aspectCount: 19,
    basicCount: 6,
    required: {
      "32002": 1,
      "32003": 1,
      "32004": 1,
      "32005": 1,
      "32006": 2,
      "32007": 2,
      "32008": 3,
      "32009": 2,
      "32010": 2,
    },
    setup: {},
    obligation: "32025",
    nemesis: { "32026": 1, "32027": 1, "32028": 2, "32029": 1 },
    stats: { attack: 2, thwart: 1, defense: 2, recover: 4 },
    hp: 14,
    heroHand: 4,
  },
  {
    id: "shadowcat",
    hero: "32030a",
    alter: "32030b",
    aspect: "aggression",
    aspectCount: 16,
    basicCount: 9,
    required: {
      "32031a": 1,
      "32032": 1,
      "32033": 1,
      "32034": 1,
      "32035": 1,
      "32036": 2,
      "32037": 3,
      "32038": 2,
      "32039": 2,
      "32040": 2,
    },
    setup: { "32031a": 1 },
    obligation: "32055",
    nemesis: { "32056": 1, "32057": 1, "32058": 2, "32059": 1 },
    stats: { attack: 2, thwart: 2, defense: 2, recover: 3 },
    hp: 9,
    heroHand: 5,
  },
];
const source = (hero: string) =>
  STARTER_DECKS.find((d) => d.id === `starter-${hero}`)!;
const game = (spec = specs[0], seed = 32001) =>
  newGame({
    heroId: spec.id,
    aspect: spec.aspect,
    villainId: "rhino",
    seed,
    pacing: "expert",
    heroes: [
      {
        heroId: spec.id,
        aspect: spec.aspect,
        deckCards: catalogDeckCodes(source(spec.hero)),
      },
    ],
  });
const playingPieces = (s: GameState): Piece[] => [
  ...s.player.hand,
  ...s.player.deck,
  ...s.player.discard,
  ...s.player.inPlay,
];

for (const spec of specs)
  describe(`${spec.id} original metadata/source/editor`, () => {
    it("registers one canonical identity and both linked identity faces", () => {
      expect(SCRIPTED_HERO_IDS.has(spec.id)).toBe(true);
      expect(CATALOG_HEROES.filter((h) => h.id === spec.id)).toHaveLength(1);
      expect(CATALOG_HEROES.find((h) => h.id === spec.id)).toMatchObject({
        code: spec.hero,
        alter: spec.alter,
        automated: true,
      });
      for (const id of [spec.id, `mut_gen:${spec.id}`, spec.hero, spec.alter])
        expect(heroRuntime(id)?.id, id).toBe(spec.id);
      expect(heroRuntime(spec.id)?.identityCodes).toEqual([
        spec.hero,
        spec.alter,
      ]);
      expect(heroRuntime(spec.id)?.scripted).toBe(true);
      expect(heroStarterAspects(spec.id)).toEqual([spec.aspect]);
    });

    it("retains the exact original forty playing cards and separate physical setup quantity", () => {
      const original = source(spec.hero),
        codes = deckCodes(spec.id, spec.aspect);
      expect(codes).toEqual(catalogDeckCodes(original));
      expect(codes).toHaveLength(40 + Object.values(spec.setup).length);
      expect(deckSizeFor(codes)).toBe(40);
      expect(countsFor(codes)).toEqual(original.cards);
      expect(heroRequiredCards(spec.id)).toEqual(spec.required);
      expect(heroSetupCards(spec.id)).toEqual(spec.setup);
      expect(heroSupplementaryCards(spec.id)).toEqual({});
      expect(original.setupCards).toEqual(spec.setup);
      for (const [faction, count] of [
        ["hero", 15],
        [spec.aspect, spec.aspectCount],
        ["basic", spec.basicCount],
      ] as const)
        expect(
          codes.filter(
            (code) =>
              !isPermanent(card(code)) && card(code).faction_code === faction,
          ),
          faction,
        ).toHaveLength(count);
      expect(deckErrors(spec.id, spec.aspect, codes)).toEqual([]);
      const imported = sourceDecks.find((d) => d.heroCode === spec.hero)!;
      expect(imported.cards).toEqual(original.cards);
      expect(imported.setupCards).toEqual(spec.setup);
      expect(imported.supplementaryCards).toEqual({});
      for (const code of [spec.hero, spec.alter, "32031b"])
        expect(codes, code).not.toContain(code);
    });

    it.each(["aggression", "justice", "leadership", "protection"] as const)(
      "keeps every signature copy and physical setup card in a legal %s starter",
      (aspect) => {
        const codes = deckCodes(spec.id, aspect);
        expect(deckSizeFor(codes)).toBe(40);
        expect(deckErrors(spec.id, aspect, codes)).toEqual([]);
        for (const [code, count] of Object.entries(spec.required))
          expect(
            codes.filter((c) => c === code),
            code,
          ).toHaveLength(count);
        for (const code of [spec.hero, spec.alter, "32031b"])
          expect(codes, code).not.toContain(code);
      },
    );

    it("rejects missing or surplus signatures, mixed aspects and identity pieces", () => {
      const codes = deckCodes(spec.id, spec.aspect),
        first = Object.keys(spec.required)[0];
      expect(
        validateHeroDeck(
          spec.id,
          [spec.aspect],
          codes.filter((code) => code !== first),
        ).valid,
      ).toBe(false);
      expect(
        validateHeroDeck(spec.id, [spec.aspect], [...codes, first]).valid,
      ).toBe(false);
      expect(
        validateHeroDeck(spec.id, ["aggression", "protection"], codes).errors,
      ).toContain("Choose exactly one aspect for this hero.");
      for (const code of [spec.hero, spec.alter, "32031b"])
        expect(
          validateHeroDeck(spec.id, [spec.aspect], [...codes, code]).valid,
          code,
        ).toBe(false);
    });

    it("shows the exact source launch and locks all fifteen counted signatures", () => {
      const markup = renderToStaticMarkup(
        createElement(DeckEditor, {
          initial: {
            id: spec.id,
            name: "Original Mutant Genesis source",
            heroId: spec.id,
            aspect: spec.aspect,
            cards: deckCodes(spec.id, spec.aspect),
            revision: 1,
            updatedAt: "2026-10-13T00:00:00Z",
          },
          busy: false,
          error: "",
          onSave: () => {},
          onCancel: () => {},
        }),
      );
      expect(markup).toContain("40 / 50 cards");
      expect(markup).toContain("Keep all 15 hero cards");
      expect(markup).toContain("25–35 aspect or basic cards");
      expect(markup).not.toContain('aria-label="Second aspect"');
      for (const code of Object.keys(spec.required))
        expect(markup).not.toContain(
          `aria-label="Copies of ${card(code).name}"`,
        );
      if (spec.id === "shadowcat") {
        expect(markup).toContain("1 Permanent setup card");
        expect(markup).toContain("Solid");
        expect(markup).toContain("It enters play Solid after your mulligan.");
        expect(markup).not.toContain('aria-label="Copies of Phased"');
        expect(markup).not.toContain("Permanent energy forms");
      } else expect(markup).not.toContain("Permanent setup card");
      const browser = renderToStaticMarkup(
        createElement(ContentBrowser, {
          initialHeroCode: spec.hero,
          assignedHeroIds: [],
          onChooseHero: () => {},
          onInspect: () => {},
        }),
      );
      expect(browser).toContain(
        "Mission setup will load this exact 40-card source preconstructed list.",
      );
      expect(browser).not.toContain(
        "This list requires additional setup or special decks.",
      );
      if (spec.id === "shadowcat")
        expect(browser).toContain("It enters play Solid after your mulligan.");
    });

    it("draws six actual source pieces while preserving forty unique playing IDs through JSON", () => {
      const s = game(spec);
      expect(s.error).toBeUndefined();
      expect(s.phase).toBe("mulligan");
      expect(s.player.form).toBe("alter");
      expect(heroCard(s).code).toBe(spec.alter);
      expect(s.player.hand).toHaveLength(6);
      expect(handSize(s)).toBe(6);
      const pieces = playingPieces(s);
      expect(pieces).toHaveLength(40);
      expect(new Set(pieces.map((p) => p.id)).size).toBe(40);
      expect(pieces.every((p) => p.ownerId === s.activePlayerId)).toBe(true);
      const setupPieces = (s.player.setAside || []).filter((p) =>
        Object.hasOwn(spec.setup, p.code),
      );
      expect(countsFor([...pieces, ...setupPieces].map((p) => p.code))).toEqual(
        source(spec.hero).cards,
      );
      const restored = JSON.parse(JSON.stringify(s));
      expect(playingPieces(restored)).toEqual(pieces);
      expect(restored.player.setAside || []).toEqual(s.player.setAside || []);
      expect(heroStats(restored)).toEqual(spec.stats);
      expect(maxHP(restored)).toBe(spec.hp);
      restored.player.form = "hero";
      expect(heroCard(restored).code).toBe(spec.hero);
      expect(handSize(restored)).toBe(spec.heroHand);
    });

    it("keeps one obligation and five physical nemesis pieces outside the player composition", () => {
      expect(heroRuntime(spec.id)?.obligationCodes).toEqual([spec.obligation]);
      expect(heroRuntime(spec.id)?.nemesisCodes).toEqual(
        Object.keys(spec.nemesis),
      );
      const s = game(spec),
        nemeses = (s.player.setAside || []).filter((p) =>
          Object.hasOwn(spec.nemesis, p.code),
        );
      expect(countsFor(nemeses.map((p) => p.code))).toEqual(spec.nemesis);
      expect(new Set(nemeses.map((p) => p.id)).size).toBe(5);
      for (const [code, count] of Object.entries(spec.nemesis))
        expect(raw(code).quantity, code).toBe(count);
      expect(raw(spec.obligation).quantity).toBe(1);
      expect(
        [spec.obligation, ...Object.keys(spec.nemesis)].every(
          (code) => !deckCodes(spec.id, spec.aspect).includes(code),
        ),
      ).toBe(true);
    });
  });

describe("Mutant Genesis printed scope and physical forms", () => {
  it("registers exactly the sixty-two original hero-scope faces without enabling box scenarios", () => {
    const scoped = catalog.filter(
      (c) => c.pack_code === "mut_gen" && c.position <= 59,
    );
    expect(scoped).toHaveLength(62);
    const pool = scoped.filter((c) =>
      ["aggression", "protection", "basic"].includes(c.faction_code),
    );
    expect(pool).toHaveLength(28);
    expect(scoped.filter((c) => c.set_code === "colossus")).toHaveLength(12);
    expect(
      scoped.filter((c) => c.set_code === "colossus_nemesis"),
    ).toHaveLength(4);
    expect(scoped.filter((c) => c.set_code === "shadowcat")).toHaveLength(14);
    expect(
      scoped.filter((c) => c.set_code === "shadowcat_nemesis"),
    ).toHaveLength(4);
    for (const c of scoped) {
      expect(hasExecutableScript(c.code), c.code).toBe(true);
      expect(EXPLICIT_CARD_SCRIPTS.has(c.code), c.code).toBe(
        !Object.hasOwn(coreAliases, c.code),
      );
    }
    for (const c of catalog.filter(
      (c) => c.pack_code === "mut_gen" && c.position > 59,
    )) {
      expect(hasExecutableScript(c.code), c.code).toBe(false);
      expect(EXPLICIT_CARD_SCRIPTS.has(c.code), c.code).toBe(false);
    }
  });

  it("matches sixteen printed fields for six Core resources, four inherited reprints and both team-up printings", () => {
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
      "thwart",
      "defense",
      "health",
      "deck_limit",
      "is_unique",
    ];
    for (const [code, base] of Object.entries({
      ...coreAliases,
      ...inheritedPairs,
      "32050": "32021",
    }))
      for (const field of fields)
        expect(raw(code)[field], `${code}:${field}`).toEqual(raw(base)[field]);
    for (const [code, core] of Object.entries(coreAliases)) {
      expect(rulesCode(code), code).toBe(core);
      expect(hasCoreScript(code), code).toBe(true);
      expect(card(code).code).toBe(code);
    }
    for (const [code, base] of Object.entries(inheritedPairs)) {
      expect(rulesCode(code), code).toBe(base);
      expect(hasCoreScript(code), code).toBe(false);
      expect(card(code).code).toBe(code);
    }
    for (const code of ["32021", "32050"]) {
      expect(rulesCode(code), code).toBe(code);
      expect(hasCoreScript(code), code).toBe(false);
    }
  });

  it("enforces shared reprint limits without replacing either retail code", () => {
    const colossus = deckCodes("colossus", "protection");
    expect(copyLimit(card("32018"), "colossus")).toBe(2);
    expect(copyLimit(card("32047"), "shadowcat")).toBe(2);
    expect(copyLimit(card("32021"), "colossus")).toBe(1);
    expect(
      deckErrors("colossus", "protection", [...colossus, "32052"]).some(
        (e) => e.includes("Energy") && e.includes("1"),
      ),
    ).toBe(true);
    expect(
      deckErrors("colossus", "protection", [...colossus, "32050"]).some(
        (e) => e.includes("Shadow and Steel") && e.includes("1"),
      ),
    ).toBe(true);
    expect(
      deckErrors("colossus", "protection", [...colossus, "32018"]).some(
        (e) => e.includes("Defensive Energy") && e.includes("2"),
      ),
    ).toBe(true);
    expect(card("32021").code).toBe("32021");
    expect(card("32050").code).toBe("32050");
  });

  it("corrects the original Colossus ally subtitle and excludes both matching identities' allies", () => {
    expect(raw("32048").subname).toBeUndefined();
    expect(card("32048").subname).toBe("Piotr Rasputin");
    expect(identityMatch("colossus", card("32048"))).toBe(true);
    expect(identityMatch("shadowcat", card("32002"))).toBe(true);
    expect(uniqueMatches(card("32001a"), card("32048"))).toBe(true);
    expect(uniqueMatches(card("32030a"), card("32002"))).toBe(true);
    expect(identityMatch("shadowcat", card("32048"))).toBe(false);
    for (const [hero, aspect, ally] of [
      ["colossus", "protection", "32048"],
      ["shadowcat", "aggression", "32002"],
    ] as const) {
      expect(deckOptions(hero, aspect).some((c) => c.code === ally)).toBe(
        false,
      );
      expect(
        validateHeroDeck(hero, [aspect], [...deckCodes(hero, aspect), ally])
          .valid,
      ).toBe(false);
    }
    expect(
      deckErrors("colossus", "protection", [
        ...deckCodes("colossus", "protection"),
        "32048",
      ]).some((e) => e.includes("matches this identity")),
    ).toBe(true);
  });

  it("preserves every original uniqueness flag and encounter numeric field", () => {
    const unique = new Set([
      "32001a",
      "32001b",
      "32002",
      "32003",
      "32011",
      "32012",
      "32019",
      "32020",
      "32026",
      "32030a",
      "32030b",
      "32032",
      "32033",
      "32041",
      "32042",
      "32048",
      "32049",
      "32056",
    ]);
    for (const c of catalog.filter(
      (c) => c.pack_code === "mut_gen" && c.position <= 59,
    ))
      expect(!!card(c.code).is_unique, c.code).toBe(unique.has(c.code));
    for (const [code, boost, star] of [
      ["32025", 2, false],
      ["32026", 2, true],
      ["32027", 3, false],
      ["32028", 2, false],
      ["32029", 2, true],
      ["32055", 2, false],
      ["32056", 1, true],
      ["32057", 3, false],
      ["32058", 0, true],
      ["32059", 2, false],
    ] as const) {
      expect(card(code).boost ?? 0, code).toBe(boost);
      expect(!!card(code).boost_star, code).toBe(star);
    }
    expect(card("32026")).toMatchObject({ attack: 4, scheme: 1, health: 8 });
    expect(card("32028")).toMatchObject({ attack: 2, attack_star: true });
    expect(card("32056")).toMatchObject({ attack: 1, scheme: 1, health: 5 });
    expect(card("32058")).toMatchObject({ attack: 2, scheme: 1, health: 3 });
    expect(card("32027")).toMatchObject({ base_threat: 2, scheme_amplify: 1 });
    expect(card("32057")).toMatchObject({
      base_threat: 2,
      scheme_acceleration: 1,
    });
  });

  it("uses the current Steel Fist attack label and Armor Up pre-activation text", () => {
    // RRG 1.8 p67: the imported Steel Fist omitted its attack label.
    expect(raw("32008").text).not.toContain("(attack)");
    expect(card("32008").text).toMatch(/Hero Action.*\(attack\)/);
    expect(card("32008").text).toContain(
      "You may discard a tough status card from your hero to stun and confuse that enemy.",
    );
    expect(card("32010").text).toContain("When the villain would activate");
    expect(card("32008").traits).toBe(raw("32008").traits);
  });

  it("shows the correct hero and alter-ego art despite reversed downloaded identity image labels", () => {
    // Original asset 32001b shows Colossus; 32001a shows Piotr Rasputin.
    // Original asset 32030b shows Shadowcat; 32030a shows Kitty Pryde.
    expect(imageFor("32001a")).toBe("/cards/catalog/32001b.webp");
    expect(imageFor("32001b")).toBe("/cards/catalog/32001a.webp");
    expect(imageFor("32030a")).toBe("/cards/catalog/32030b.webp");
    expect(imageFor("32030b")).toBe("/cards/catalog/32030a.webp");
    expect(imageFor("32031a")).toBe("/cards/catalog/32031a.webp");
    expect(imageFor("32031b")).toBe("/cards/catalog/32031b.webp");
  });

  it("keeps downloaded card, source-deck and image-index bytes immutable", () => {
    for (const [file, hash] of [
      [
        "catalog-cards.json",
        "c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb",
      ],
      [
        "catalog-decks.json",
        "6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886",
      ],
      [
        "catalog-images.json",
        "fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d",
      ],
    ])
      expect(
        createHash("sha256")
          .update(readFileSync(new URL(`../src/data/${file}`, import.meta.url)))
          .digest("hex"),
        file,
      ).toBe(hash);
  });

  it("constructs one Solid/Phased Permanent and rejects an extra or substituted reverse face", () => {
    const codes = deckCodes("shadowcat", "aggression");
    expect(isPermanent(card("32031a"))).toBe(true);
    expect(isPermanent(card("32031b"))).toBe(true);
    expect(codes.filter((code) => code === "32031a")).toHaveLength(1);
    expect(
      deckOptions("shadowcat", "aggression").filter((c) => c.code === "32031a"),
    ).toHaveLength(1);
    expect(
      deckOptions("shadowcat", "aggression").some((c) => c.code === "32031b"),
    ).toBe(false);
    expect(
      validateHeroDeck("shadowcat", ["aggression"], [...codes, "32031b"]).valid,
    ).toBe(false);
    expect(
      validateHeroDeck(
        "shadowcat",
        ["aggression"],
        codes.map((code) => (code === "32031a" ? "32031b" : code)),
      ).valid,
    ).toBe(false);
  });

  it("holds the same physical mass card before six opening cards and puts it Solid after mulligan", () => {
    const s = game(specs[1]),
      held = s.player.setAside?.filter((p) => p.code === "32031a") || [];
    expect(held).toHaveLength(1);
    expect(playingPieces(s)).toHaveLength(40);
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.inPlay.some((p) => p.code === "32031a")).toBe(false);
    const next = dispatch(JSON.parse(JSON.stringify(s)), {
      type: "MULLIGAN",
      ids: [],
    });
    expect(next.error).toBeUndefined();
    const mass = next.player.inPlay.filter((p) => p.code === "32031a");
    expect(mass).toHaveLength(1);
    expect(mass[0]).toMatchObject({
      id: held[0].id,
      ownerId: s.activePlayerId,
    });
    expect(next.player.setAside?.some((p) => p.id === held[0].id)).toBe(false);
    expect(next.player.hand).toHaveLength(6);
    expect(playingPieces(next)).toHaveLength(41);
    expect(new Set(playingPieces(next).map((p) => p.id)).size).toBe(41);
    expect(countsFor(playingPieces(next).map((p) => p.code))).toEqual(
      source("32030a").cards,
    );
  });

  it("searches for one actual Organic Steel after the six-card opener and mulligan", () => {
    const opening = game(specs[0]),
      actualIds = playingPieces(opening)
        .map((p) => p.id)
        .sort(),
      candidates = opening.player.deck.filter((p) => p.code === "32006");
    expect(opening.player.hand).toHaveLength(6);
    expect(candidates.length).toBeGreaterThan(0);
    expect(opening.prompt).toBeNull();
    let s = dispatch(JSON.parse(JSON.stringify(opening)), {
      type: "MULLIGAN",
      ids: [],
    });
    expect(s.error).toBeUndefined();
    expect(s.prompt?.kind).toBe("choice");
    expect(s.prompt?.title).toBe("Piotr Rasputin setup");
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      candidates.map((p) => p.id).sort(),
    );
    expect(s.player.hand).toHaveLength(6);
    const found = candidates[0];
    s = dispatch(JSON.parse(JSON.stringify(s)), {
      type: "CHOOSE",
      id: found.id,
    });
    expect(s.error).toBeUndefined();
    expect(s.player.hand).toHaveLength(7);
    expect(s.player.hand.find((p) => p.id === found.id)).toEqual(found);
    expect(s.player.deck.some((p) => p.id === found.id)).toBe(false);
    expect(
      playingPieces(s)
        .map((p) => p.id)
        .sort(),
    ).toEqual(actualIds);
    expect(countsFor(playingPieces(s).map((p) => p.code))).toEqual(
      source("32001a").cards,
    );
  });
});
