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
  aerial,
  card,
  deckCodes,
  handSize,
  heroCard,
  heroStats,
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
import { newGame } from "../src/game/engine.js";
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
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { hasCoreScript, rulesCode } from "../src/game/rules-code.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { identityMatch, uniqueMatches } from "../src/game/unique.js";
import type { Aspect, Card } from "../src/game/types.js";

const raw = (code: string) => catalog.find((c) => c.code === code)! as Card;
const coreAliases = {
  "28011": "01052",
  "28015": "01055",
  "29021": "01072",
  "29026": "01092",
};
const inheritedPairs = { "29019": "05032", "29022": "27046" };
const specs: {
  id: string;
  pack: string;
  hero: string;
  alter: string;
  identities: string[];
  aspect: Aspect;
  aspectCount: number;
  basicCount: number;
  required: Record<string, number>;
  supplementary: Record<string, number>;
  obligation: string;
  nemesis: Record<string, number>;
}[] = [
  {
    id: "nova",
    pack: "nova",
    hero: "28001a",
    alter: "28001b",
    identities: ["28001a", "28001b"],
    aspect: "aggression",
    aspectCount: 20,
    basicCount: 5,
    required: {
      "28002": 1,
      "28003": 2,
      "28004": 3,
      "28005": 3,
      "28006": 2,
      "28007": 2,
      "28008": 1,
      "28009": 1,
    },
    supplementary: {},
    obligation: "28021",
    nemesis: { "28022": 1, "28023": 1, "28024": 2, "28025": 1 },
  },
  {
    id: "ironheart",
    pack: "ironheart",
    hero: "29001a",
    alter: "29001b",
    identities: ["29001a", "29001b", "29002a", "29002b", "29003a", "29003b"],
    aspect: "leadership",
    aspectCount: 17,
    basicCount: 8,
    required: {
      "29004": 1,
      "29005": 2,
      "29006": 3,
      "29007": 2,
      "29008": 1,
      "29009": 2,
      "29010": 1,
      "29011": 1,
      "29012": 1,
      "29013": 1,
    },
    supplementary: { "29002a": 1, "29003a": 1 },
    obligation: "29028",
    nemesis: { "29029": 1, "29030": 1, "29031": 1, "29032": 2 },
  },
];
const source = (hero: string) =>
  STARTER_DECKS.find((d) => d.id === `starter-${hero}`)!;
const game = (spec = specs[0]) =>
  newGame({
    heroId: spec.id,
    aspect: spec.aspect,
    villainId: "rhino",
    seed: 28001,
    pacing: "expert",
    heroes: [
      {
        heroId: spec.id,
        aspect: spec.aspect,
        deckCards: catalogDeckCodes(source(spec.hero)),
      },
    ],
  });

for (const spec of specs)
  describe(`${spec.id} original metadata/source/editor`, () => {
    it("registers one canonical identity with every linked printed identity face", () => {
      expect(SCRIPTED_HERO_IDS.has(spec.id)).toBe(true);
      expect(CATALOG_HEROES.filter((h) => h.id === spec.id)).toHaveLength(1);
      expect(CATALOG_HEROES.find((h) => h.id === spec.id)).toMatchObject({
        code: spec.hero,
        alter: spec.alter,
        automated: true,
      });
      for (const id of [spec.id, `${spec.pack}:${spec.id}`, ...spec.identities])
        expect(heroRuntime(id)?.id, id).toBe(spec.id);
      expect(heroRuntime(spec.id)?.scripted).toBe(true);
      expect(heroRuntime(spec.id)?.identityCodes).toEqual(spec.identities);
      expect(heroStarterAspects(spec.id)).toEqual([spec.aspect]);
    });
    it("retains the exact forty printed player cards and separates supplementary identity pieces", () => {
      const original = source(spec.hero),
        codes = deckCodes(spec.id, spec.aspect);
      expect(codes).toEqual(catalogDeckCodes(original));
      expect(codes).toHaveLength(40);
      expect(deckSizeFor(codes)).toBe(40);
      expect(countsFor(codes)).toEqual(original.cards);
      expect(heroRequiredCards(spec.id)).toEqual(spec.required);
      expect(Object.values(spec.required).reduce((a, b) => a + b, 0)).toBe(15);
      expect(original.setupCards).toEqual({});
      expect(heroSetupCards(spec.id)).toEqual({});
      expect(original.supplementaryCards).toEqual(spec.supplementary);
      expect(heroSupplementaryCards(spec.id)).toEqual(spec.supplementary);
      for (const code of spec.identities)
        expect(codes, code).not.toContain(code);
      for (const [faction, count] of [
        ["hero", 15],
        [spec.aspect, spec.aspectCount],
        ["basic", spec.basicCount],
      ] as const)
        expect(
          codes.filter((c) => card(c).faction_code === faction),
          faction,
        ).toHaveLength(count);
      expect(deckErrors(spec.id, spec.aspect, codes)).toEqual([]);
      const imported = sourceDecks.find((d) => d.heroCode === spec.hero)!;
      expect(imported.cards).toEqual(original.cards);
      expect(imported.supplementaryCards).toEqual({});
    });
    it.each(["aggression", "justice", "leadership", "protection"] as const)(
      "retains the same fifteen mandatory signature copies in a legal %s starter",
      (aspect) => {
        const codes = deckCodes(spec.id, aspect);
        expect(codes).toHaveLength(40);
        expect(deckErrors(spec.id, aspect, codes)).toEqual([]);
        for (const [code, count] of Object.entries(spec.required))
          expect(
            codes.filter((c) => c === code),
            code,
          ).toHaveLength(count);
        for (const code of spec.identities)
          expect(codes, code).not.toContain(code);
      },
    );
    it("rejects missing or surplus signature copies, extra aspects and a supplementary identity in the player deck", () => {
      const codes = deckCodes(spec.id, spec.aspect),
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
        validateHeroDeck(spec.id, ["aggression", "leadership"], codes).errors,
      ).toContain("Choose exactly one aspect for this hero.");
      for (const code of spec.identities)
        expect(
          validateHeroDeck(spec.id, [spec.aspect], [...codes, code]).valid,
          code,
        ).toBe(false);
    });
    it("offers exact source launch and an editor with all fifteen signatures locked", () => {
      const markup = renderToStaticMarkup(
        createElement(DeckEditor, {
          initial: {
            id: spec.id,
            name: "Original source",
            heroId: spec.id,
            aspect: spec.aspect,
            cards: deckCodes(spec.id, spec.aspect),
            revision: 1,
            updatedAt: "2026-10-08T00:00:00Z",
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
      expect(markup).not.toContain("Permanent setup card");
      for (const code of Object.keys(spec.required))
        expect(markup).not.toContain(
          `aria-label="Copies of ${card(code).name}"`,
        );
      for (const code of spec.identities)
        expect(
          deckOptions(spec.id, spec.aspect).some((c) => c.code === code),
          code,
        ).toBe(false);
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
      if (spec.id === "ironheart")
        expect(browser).toContain("HERO’S ADDITIONAL CARDS · 2");
    });
    it("draws six actual original-source cards while conserving all forty unique source IDs through JSON", () => {
      const s = game(spec);
      expect(s.error).toBeUndefined();
      expect(s.phase).toBe("mulligan");
      expect(s.player.form).toBe("alter");
      expect(heroCard(s).code).toBe(spec.alter);
      expect(s.player.hand).toHaveLength(6);
      expect(handSize(s)).toBe(6);
      const pieces = [
        ...s.player.hand,
        ...s.player.deck,
        ...s.player.discard,
        ...s.player.inPlay,
      ];
      expect(pieces).toHaveLength(40);
      expect(new Set(pieces.map((p) => p.id)).size).toBe(40);
      expect(countsFor(pieces.map((p) => p.code))).toEqual(
        source(spec.hero).cards,
      );
      expect(pieces.every((p) => p.ownerId === s.activePlayerId)).toBe(true);
      const saved = JSON.parse(JSON.stringify(s));
      expect([
        ...saved.player.hand,
        ...saved.player.deck,
        ...saved.player.discard,
        ...saved.player.inPlay,
      ]).toEqual(pieces);
      expect(saved.player.setAside || []).toEqual(s.player.setAside || []);
    });
    it("keeps the obligation and all five physical nemesis cards outside the forty-card player composition", () => {
      const hero = heroRuntime(spec.id)!;
      expect(hero.obligationCodes).toEqual([spec.obligation]);
      expect(hero.nemesisCodes).toEqual(Object.keys(spec.nemesis));
      for (const [code, count] of Object.entries(spec.nemesis))
        expect(raw(code).quantity, code).toBe(count);
      expect(Object.values(spec.nemesis).reduce((a, b) => a + b, 0)).toBe(5);
      expect(raw(spec.obligation).quantity).toBe(1);
      for (const code of [spec.obligation, ...Object.keys(spec.nemesis)])
        expect(deckCodes(spec.id, spec.aspect), code).not.toContain(code);
    });
  });

describe("Nova and Ironheart printings, scope and physical identities", () => {
  it("preserves sixty-six hero-scope faces and independently tracks Armadillo and pending Zzzax", () => {
    const nova = catalog.filter((c) => c.pack_code === "nova"),
      ironheart = catalog.filter((c) => c.pack_code === "ironheart");
    expect(nova).toHaveLength(33);
    expect(ironheart).toHaveLength(43);
    const excluded = new Set(["armadillo", "zzzax"]);
    const supported = [...nova, ...ironheart].filter(
      (c) => !excluded.has(c.set_code || ""),
    );
    expect(supported).toHaveLength(66);
    for (const c of supported) {
      expect(hasExecutableScript(c.code), c.code).toBe(true);
      expect(EXPLICIT_CARD_SCRIPTS.has(c.code), c.code).toBe(
        !Object.hasOwn(coreAliases, c.code),
      );
    }
    const modular = [...nova, ...ironheart].filter((c) =>
      excluded.has(c.set_code || ""),
    );
    expect(modular).toHaveLength(10);
    for (const c of modular) {
      expect(EXPLICIT_CARD_SCRIPTS.has(c.code), c.code).toBe(
        c.set_code === "armadillo",
      );
    }
    for (const [code, core] of Object.entries(coreAliases)) {
      expect(rulesCode(code), code).toBe(core);
      expect(hasCoreScript(code), code).toBe(true);
      expect(card(code).code).toBe(code);
    }
    for (const code of Object.keys(inheritedPairs))
      expect(hasCoreScript(code), code).toBe(false);
  });
  it("matches sixteen complete printed fields on all four Core pairs and both inherited non-Core pairs", () => {
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
    }))
      for (const field of fields)
        expect(raw(code)[field], `${code}:${field}`).toEqual(raw(base)[field]);
    expect(raw("29022").quantity).toBe(1);
    expect(raw("29026").quantity).toBe(1);
    expect(raw("01092").quantity).toBe(4);
    expect(card("29022").code).toBe("29022");
  });
  it("preserves Nova's printed 1/1/2 powers, ten HP and six/five-card hand sizes", () => {
    expect(raw("28001a")).toMatchObject({
      attack: 1,
      thwart: 1,
      defense: 2,
      health: 10,
      hand_size: 5,
    });
    expect(raw("28001b")).toMatchObject({
      recover: 3,
      health: 10,
      hand_size: 6,
    });
    const s = game();
    expect(heroStats(s)).toEqual({
      attack: 1,
      thwart: 1,
      defense: 2,
      recover: 3,
    });
    expect(maxHP(s)).toBe(10);
    s.phase = "player";
    s.player.form = "hero";
    expect(handSize(s)).toBe(
      5 + s.player.hand.filter((p) => p.code === "28007").length,
    );
    expect(aerial(s)).toBe(false);
  });
  it("keeps all three Ironheart printed stat lines and all three distinct alter-ego costs unchanged", () => {
    for (const [version, thwart, hand] of [
      [1, 1, 4],
      [2, 2, 5],
      [3, 3, 6],
    ] as const) {
      const hero = `2900${version}a`,
        alter = `2900${version}b`;
      expect(raw(hero)).toMatchObject({
        attack: 2,
        thwart,
        defense: 3,
        health: 10,
        hand_size: hand,
        back_link: alter,
      });
      expect(raw(alter)).toMatchObject({
        recover: 3,
        health: 10,
        hand_size: 6,
      });
      expect(raw(hero).traits).toContain(`Version ${version}.`);
      expect(raw(hero).traits?.includes("Aerial.")).toBe(version > 1);
    }
    expect(raw("29001b").text).toContain("Spend a [mental] resource →");
    expect(raw("29002b").text).toContain(
      "Spend a [mental] resource or 2 resources of any type →",
    );
    expect(raw("29003b").text).toContain("Spend 1 resource of any type →");
    expect(raw("29009").resource_mental).toBe(1);
    expect(raw("29003a").text).not.toContain("Limit");
  });
  it("starts with one actual Version 1 identity and two owned set-aside identities rather than four extra face pieces", () => {
    const s = game(specs[1]),
      active = s.player.ironheartIdentity!;
    expect(active).toMatchObject({ code: "29001a", ownerId: s.activePlayerId });
    const aside = s.player.setAside!;
    expect(
      aside.filter((p) => card(p).type_code === "hero").map((p) => p.code),
    ).toEqual(["29002a", "29003a"]);
    expect(
      countsFor(
        aside
          .filter((p) => card(p).faction_code === "encounter")
          .map((p) => p.code),
      ),
    ).toEqual(specs[1].nemesis);
    expect(aside).toHaveLength(7);
    expect(
      aside
        .filter((p) => card(p).type_code === "hero")
        .every((p) => p.ownerId === s.activePlayerId),
    ).toBe(true);
    const pieces = [
      active,
      ...s.player.setAside!,
      ...s.player.hand,
      ...s.player.deck,
      ...s.player.discard,
      ...s.player.inPlay,
    ];
    expect(pieces).toHaveLength(48);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(48);
    for (const code of ["29001b", "29002b", "29003b"])
      expect(
        pieces.some((p) => p.code === code),
        code,
      ).toBe(false);
    const restored = JSON.parse(JSON.stringify(s));
    expect(restored.player.ironheartIdentity).toEqual(active);
    expect(restored.player.setAside).toEqual(s.player.setAside);
    expect(heroCard(restored).code).toBe("29001b");
    expect(heroStats(restored)).toEqual({
      attack: 2,
      thwart: 1,
      defense: 3,
      recover: 3,
    });
    restored.player.form = "hero";
    expect(heroCard(restored).code).toBe("29001a");
    expect(handSize(restored)).toBe(4);
    expect(aerial(restored)).toBe(false);
  });
  it("corrects only the two confirmed original printed metadata defects while preserving the downloaded source bytes", () => {
    expect(raw("29001a").is_unique).toBe(false);
    expect(card("29001a").is_unique).toBe(true);
    expect(raw("13018").subname).toBeUndefined();
    expect(card("13018").subname).toBe("Riri Williams");
    const runtime = card("29001a");
    for (const field of [
      "attack",
      "thwart",
      "defense",
      "health",
      "hand_size",
      "traits",
      "text",
    ] as const)
      expect(runtime[field], field).toEqual(raw("29001a")[field]);
    expect(
      createHash("sha256")
        .update(
          readFileSync(
            new URL("../src/data/catalog-cards.json", import.meta.url),
          ),
        )
        .digest("hex"),
    ).toBe("c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb");
    expect(
      createHash("sha256")
        .update(
          readFileSync(
            new URL("../src/data/catalog-decks.json", import.meta.url),
          ),
        )
        .digest("hex"),
    ).toBe("6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886");
  });
  it("excludes each matching Champion ally while allowing differently subtitled Falcon and Wasp printings", () => {
    expect(identityMatch("nova", card("05012"))).toBe(true);
    expect(identityMatch("ironheart", card("13018"))).toBe(true);
    expect(uniqueMatches(card("29001a"), card("13018"))).toBe(true);
    expect(
      deckOptions("nova", "protection").some((c) => c.code === "05012"),
    ).toBe(false);
    expect(
      deckOptions("ironheart", "leadership").some((c) => c.code === "13018"),
    ).toBe(false);
    expect(
      deckErrors("ironheart", "leadership", [
        ...deckCodes("ironheart", "leadership"),
        "13018",
      ]),
    ).toContain(
      "Ironheart matches this identity and cannot be included as an ally.",
    );
    expect(uniqueMatches(card("29015"), card("03011"))).toBe(false);
    expect(uniqueMatches(card("29015"), card("23014"))).toBe(false);
    expect(uniqueMatches(card("29034"), card("12002"))).toBe(true);
    expect(uniqueMatches(card("29034"), card("13012"))).toBe(false);
    expect(identityMatch("wsp", card("29034"))).toBe(true);
    expect(deckOptions("wsp", "justice").some((c) => c.code === "29034")).toBe(
      false,
    );
    expect(
      deckOptions("ironheart", "leadership").some((c) => c.code === "03011"),
    ).toBe(true);
    expect(
      deckErrors("ironheart", "leadership", [
        ...deckCodes("ironheart", "leadership"),
        "03011",
      ]),
    ).toEqual([]);
  });
  it("shares Agent 13 and Go for Champions limits across equivalent printings without conflating differently subtitled Falcons", () => {
    expect(copyLimit(card("29025"))).toBe(1);
    expect(copyLimit(card("29022"))).toBe(1);
    expect(
      deckErrors("ironheart", "leadership", [
        ...deckCodes("ironheart", "leadership"),
        "27046",
      ]).some((e) => e.includes("Agent 13") && e.includes("limit is 1")),
    ).toBe(true);
    expect(
      deckErrors("ironheart", "leadership", [
        ...deckCodes("ironheart", "leadership"),
        "29025",
      ]).some(
        (e) => e.includes("Go for Champions") && e.includes("limit is 1"),
      ),
    ).toBe(true);
  });
});
