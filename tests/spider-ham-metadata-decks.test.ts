import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import importedCards from "../src/data/catalog-cards.json";
import importedDecks from "../src/data/catalog-decks.json";
import { DeckEditor } from "../src/account/AccountPage.js";
import { ContentBrowser } from "../src/ContentBrowser.js";
import {
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
import type { Card } from "../src/game/types.js";

const raw = (code: string) =>
  importedCards.find((c) => c.code === code)! as Card;
const required = {
  "30002": 1,
  "30003": 2,
  "30004": 1,
  "30005": 1,
  "30006": 2,
  "30007": 3,
  "30008": 1,
  "30009": 2,
  "30010": 1,
  "30011": 1,
};
const originalCards = {
  ...required,
  "30012": 1,
  "30013": 1,
  "30014": 3,
  "30015": 2,
  "30016": 3,
  "30017": 3,
  "30018": 3,
  "30019": 3,
  "30020": 1,
  "30021": 1,
  "30022": 3,
  "30023": 1,
};
const source = () => STARTER_DECKS.find((d) => d.id === "starter-30001a")!;
const game = () =>
  newGame({
    heroId: "spiderham",
    aspect: "justice",
    villainId: "rhino",
    seed: 30001,
    pacing: "expert",
    heroes: [
      {
        heroId: "spiderham",
        aspect: "justice",
        deckCards: catalogDeckCodes(source()),
      },
    ],
  });

describe("Spider-Ham original printing and source-deck contract", () => {
  it("registers the canonical hero and both original identity faces", () => {
    expect(SCRIPTED_HERO_IDS.has("spiderham")).toBe(true);
    expect(CATALOG_HEROES.filter((h) => h.id === "spiderham")).toHaveLength(1);
    expect(CATALOG_HEROES.find((h) => h.id === "spiderham")).toMatchObject({
      code: "30001a",
      alter: "30001b",
      identity: "Peter Porker",
      automated: true,
      packCode: "spiderham",
      product: { date_release: "2022-07-15", soldSeparately: true },
    });
    for (const alias of [
      "spiderham",
      "spiderham:spiderham",
      "30001a",
      "30001b",
    ])
      expect(heroRuntime(alias)?.id, alias).toBe("spiderham");
    expect(heroRuntime("spiderham")?.identityCodes).toEqual([
      "30001a",
      "30001b",
    ]);
    expect(heroRuntime("spiderham")?.scripted).toBe(true);
    expect(heroStarterAspects("spiderham")).toEqual(["justice"]);
  });

  it("retains all forty source printings with fifteen signatures, nineteen Justice and six Basic cards", () => {
    const deck = source(),
      codes = deckCodes("spiderham", "justice");
    expect(deck.cards).toEqual(originalCards);
    expect(deck).toMatchObject({
      sourceType: "source-preconstructed",
      deckSize: 40,
      setupCards: {},
      supplementaryCards: {},
      sourceUrl:
        "https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747",
    });
    expect(codes).toEqual(catalogDeckCodes(deck));
    expect(codes).toHaveLength(40);
    expect(deckSizeFor(codes)).toBe(40);
    expect(countsFor(codes)).toEqual(originalCards);
    expect(heroRequiredCards("spiderham")).toEqual(required);
    expect(heroSetupCards("spiderham")).toEqual({});
    expect(heroSupplementaryCards("spiderham")).toEqual({});
    for (const [faction, count] of [
      ["hero", 15],
      ["justice", 19],
      ["basic", 6],
    ] as const)
      expect(
        codes.filter((code) => card(code).faction_code === faction),
        faction,
      ).toHaveLength(count);
    expect(deckErrors("spiderham", "justice", codes)).toEqual([]);
    expect(importedDecks.find((d) => d.heroCode === "30001a")?.cards).toEqual(
      originalCards,
    );
  });

  it.each(["aggression", "justice", "leadership", "protection"] as const)(
    "keeps every mandatory signature in a legal %s starter",
    (aspect) => {
      const codes = deckCodes("spiderham", aspect);
      expect(codes).toHaveLength(40);
      expect(deckErrors("spiderham", aspect, codes)).toEqual([]);
      for (const [code, quantity] of Object.entries(required))
        expect(
          codes.filter((c) => c === code),
          code,
        ).toHaveLength(quantity);
      for (const code of [
        "30001a",
        "30001b",
        "30024",
        "30025",
        "30026",
        "30027",
        "30028",
      ])
        expect(codes, code).not.toContain(code);
    },
  );

  it("rejects missing or excess signatures, two aspects and identity cards in the player deck", () => {
    const codes = deckCodes("spiderham", "justice");
    expect(
      validateHeroDeck(
        "spiderham",
        ["justice"],
        codes.filter((c) => c !== "30002"),
      ).valid,
    ).toBe(false);
    expect(
      validateHeroDeck("spiderham", ["justice"], [...codes, "30002"]).valid,
    ).toBe(false);
    expect(
      validateHeroDeck("spiderham", ["justice", "aggression"], codes).errors,
    ).toContain("Choose exactly one aspect for this hero.");
    expect(
      validateHeroDeck("spiderham", ["justice"], [...codes, "30001a"]).valid,
    ).toBe(false);
  });

  it("offers the exact source and locks its fifteen signatures in the account editor", () => {
    const editor = renderToStaticMarkup(
      createElement(DeckEditor, {
        initial: {
          id: "spiderham",
          name: "Original source",
          heroId: "spiderham",
          aspect: "justice",
          cards: deckCodes("spiderham", "justice"),
          revision: 1,
          updatedAt: "2026-10-11T00:00:00Z",
        },
        busy: false,
        error: "",
        onSave: () => {},
        onCancel: () => {},
      }),
    );
    expect(editor).toContain("40 / 50 cards");
    expect(editor).toContain("Keep all 15 hero cards");
    for (const code of Object.keys(required))
      expect(editor).not.toContain(`aria-label="Copies of ${card(code).name}"`);
    for (const code of ["30001a", "30001b"])
      expect(
        deckOptions("spiderham", "justice").some((c) => c.code === code),
        code,
      ).toBe(false);
    const browser = renderToStaticMarkup(
      createElement(ContentBrowser, {
        initialHeroCode: "30001a",
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
  });

  it("preserves all forty owned physical pieces and the six-card alter-ego opener through JSON", () => {
    const s = game();
    expect(s.error).toBeUndefined();
    expect(s.phase).toBe("mulligan");
    expect(heroCard(s).code).toBe("30001b");
    expect(s.player.hand).toHaveLength(6);
    expect(handSize(s)).toBe(6);
    expect(maxHP(s)).toBe(12);
    expect(heroStats(s)).toMatchObject({
      attack: 1,
      thwart: 2,
      defense: 1,
      recover: 5,
    });
    const pieces = [
      ...s.player.hand,
      ...s.player.deck,
      ...s.player.discard,
      ...s.player.inPlay,
    ];
    expect(pieces).toHaveLength(40);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(40);
    expect(countsFor(pieces.map((p) => p.code))).toEqual(originalCards);
    expect(pieces.every((p) => p.ownerId === s.activePlayerId)).toBe(true);
    const saved = JSON.parse(JSON.stringify(s)) as typeof s;
    expect([
      ...saved.player.hand,
      ...saved.player.deck,
      ...saved.player.discard,
      ...saved.player.inPlay,
    ]).toEqual(pieces);
    expect(saved.player.setAside || []).toEqual(s.player.setAside || []);
  });

  it("retains the original obligation and five nemesis pieces outside the player composition", () => {
    expect(heroRuntime("spiderham")?.obligationCodes).toEqual(["30024"]);
    expect(heroRuntime("spiderham")?.nemesisCodes).toEqual([
      "30025",
      "30026",
      "30027",
      "30028",
    ]);
    for (const [code, quantity] of [
      ["30024", 1],
      ["30025", 1],
      ["30026", 1],
      ["30027", 1],
      ["30028", 2],
    ] as const)
      expect(raw(code).quantity, code).toBe(quantity);
    expect(raw("30025")).toMatchObject({
      base_threat: 3,
      base_threat_fixed: true,
      scheme_hazard: 1,
      boost: 2,
    });
    expect(raw("30026")).toMatchObject({
      scheme: 1,
      attack: 2,
      health: 4,
      is_unique: true,
      boost: 3,
    });
    expect(raw("30027")).toMatchObject({ scheme: 1, attack: 1, boost: 2 });
  });

  it.each([
    ["30002", 2, 2, 1, 1, 3, "Steve Mouser"],
    ["30012", 2, 2, 2, 2, 4, "May Reilly"],
    ["30013", 1, 1, 1, 1, 3, "Pavitr Prabhakar"],
    ["30020", 1, 2, 1, 1, 4, "Kaine"],
    ["30021", 2, 1, 2, 1, 2, "Peni Parker"],
  ] as const)(
    "preserves original scan-verified ally stats and consequential icons for %s",
    (code, thwart, attack, thwartCost, attackCost, health, subname) => {
      expect(raw(code)).toMatchObject({
        thwart,
        attack,
        thwart_cost: thwartCost,
        attack_cost: attackCost,
        health,
        subname,
        is_unique: true,
      });
      expect(card(code)).toMatchObject({
        thwart,
        attack,
        thwart_cost: thwartCost,
        attack_cost: attackCost,
        health,
        subname,
        is_unique: true,
      });
    },
  );

  it("closes all thirty-nine pack faces while preserving the one exact Core printing", () => {
    const faces = importedCards.filter((c) => c.pack_code === "spiderham");
    expect(faces).toHaveLength(39);
    expect(faces.filter((c) => c.set_code === "inheritors")).toHaveLength(9);
    expect(faces.filter((c) => EXPLICIT_CARD_SCRIPTS.has(c.code))).toHaveLength(
      38,
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(rulesCode(raw("30015"))).toBe("01061");
    expect(hasCoreScript(raw("30015"))).toBe(true);
    expect(EXPLICIT_CARD_SCRIPTS.has("30015")).toBe(false);
  });

  it("leaves downloaded catalog and source-deck bytes unchanged", () => {
    for (const [file, expected] of [
      [
        "catalog-cards.json",
        "c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb",
      ],
      [
        "catalog-decks.json",
        "6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886",
      ],
    ])
      expect(
        createHash("sha256")
          .update(readFileSync(new URL(`../src/data/${file}`, import.meta.url)))
          .digest("hex"),
        file,
      ).toBe(expected);
  });
});
