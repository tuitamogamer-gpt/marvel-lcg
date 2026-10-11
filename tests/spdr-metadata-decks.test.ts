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
import { SCRIPTED_HERO_IDS } from "../src/game/engine-support.js";
import {
  heroRequiredCards,
  heroRuntime,
  heroSetupCards,
  heroStarterAspects,
  heroSupplementaryCards,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import type { Card, GameState, Piece } from "../src/game/types.js";

const raw = (code: string) =>
  importedCards.find((c) => c.code === code)! as Card & {
    octgn_id?: string;
    duplicate_of?: string;
  };
const required = {
  "31003": 1,
  "31004": 3,
  "31005": 2,
  "31006": 2,
  "31007": 1,
  "31008": 1,
  "31009": 1,
  "31010": 1,
  "31011": 1,
  "31012": 1,
  "31013": 1,
};
const originalCards = {
  ...required,
  "31014": 1,
  "31015": 1,
  "31016": 3,
  "31017": 3,
  "31018": 3,
  "31019": 3,
  "31020": 3,
  "31021": 1,
  "31022": 1,
  "31023": 3,
  "31024": 3,
};
const identityFaces = ["31001a", "31001b", "31002a", "31002b"];
const source = () => STARTER_DECKS.find((d) => d.id === "starter-31001a")!;
const game = () =>
  newGame({
    heroId: "spdr",
    aspect: "protection",
    villainId: "rhino",
    seed: 31001,
    pacing: "expert",
    heroes: [
      {
        heroId: "spdr",
        aspect: "protection",
        deckCards: catalogDeckCodes(source()),
      },
    ],
  });
const physicalPieces = (s: GameState): Piece[] => [
  ...s.player.hand,
  ...s.player.deck,
  ...s.player.discard,
  ...s.player.inPlay,
  ...(s.player.setAside || []).filter(
    (p) => card(p.code).faction_code !== "encounter",
  ),
  ...((s.player as typeof s.player & { spdrIdentity?: Piece }).spdrIdentity
    ? [(s.player as typeof s.player & { spdrIdentity: Piece }).spdrIdentity]
    : []),
];

describe("SP//dr original printing and physical source-deck contract", () => {
  it("registers one canonical identity with four faces on two reversible pieces", () => {
    expect(SCRIPTED_HERO_IDS.has("spdr")).toBe(true);
    expect(CATALOG_HEROES.filter((h) => h.id === "spdr")).toHaveLength(1);
    expect(CATALOG_HEROES.find((h) => h.id === "spdr")).toMatchObject({
      code: "31001a",
      alter: "31002a",
      identity: "Peni Parker",
      automated: true,
      packCode: "spdr",
      product: { date_release: "2022-07-15", soldSeparately: true },
    });
    for (const alias of ["spdr", "spdr:spdr", ...identityFaces])
      expect(heroRuntime(alias)?.id, alias).toBe("spdr");
    expect(heroRuntime("spdr")?.identityCodes.slice().sort()).toEqual(
      identityFaces,
    );
    expect(heroRuntime("spdr")?.scripted).toBe(true);
    expect(heroStarterAspects("spdr")).toEqual(["protection"]);
    expect(raw("31001a").back_link).toBe("31001b");
    expect(raw("31002a").back_link).toBe("31002b");
    expect(raw("31001a").octgn_id).toBe(raw("31001b").octgn_id);
    expect(raw("31002a").octgn_id).toBe(raw("31002b").octgn_id);
    expect(raw("31001a").octgn_id).not.toBe(raw("31002a").octgn_id);
  });

  it("retains all forty original printings: fifteen signatures, seventeen Protection and eight Basic", () => {
    const deck = source(),
      codes = deckCodes("spdr", "protection");
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
    expect(heroRequiredCards("spdr")).toEqual(required);
    expect(heroSetupCards("spdr")).toEqual({});
    expect(heroSupplementaryCards("spdr")).toEqual({});
    for (const [faction, count] of [
      ["hero", 15],
      ["protection", 17],
      ["basic", 8],
    ] as const)
      expect(
        codes.filter((code) => card(code).faction_code === faction),
        faction,
      ).toHaveLength(count);
    expect(deckErrors("spdr", "protection", codes)).toEqual([]);
    expect(importedDecks.find((d) => d.heroCode === "31001a")?.cards).toEqual(
      originalCards,
    );
    expect(codes).not.toContain("31029");
  });

  it.each(["aggression", "justice", "leadership", "protection"] as const)(
    "keeps every mandatory signature in a legal %s starter and excludes setup/encounter faces",
    (aspect) => {
      const codes = deckCodes("spdr", aspect);
      expect(codes).toHaveLength(40);
      expect(deckErrors("spdr", aspect, codes)).toEqual([]);
      for (const [code, quantity] of Object.entries(required))
        expect(
          codes.filter((c) => c === code),
          code,
        ).toHaveLength(quantity);
      for (const code of [...identityFaces, "31025", "31026", "31027", "31028"])
        expect(codes, code).not.toContain(code);
    },
  );

  it("rejects altered signature counts, two aspects and either permanent setup face in the playing deck", () => {
    const codes = deckCodes("spdr", "protection");
    expect(
      validateHeroDeck(
        "spdr",
        ["protection"],
        codes.filter((c) => c !== "31003"),
      ).valid,
    ).toBe(false);
    expect(
      validateHeroDeck("spdr", ["protection"], [...codes, "31003"]).valid,
    ).toBe(false);
    expect(
      validateHeroDeck("spdr", ["protection", "leadership"], codes).errors,
    ).toContain("Choose exactly one aspect for this hero.");
    for (const code of identityFaces) {
      expect(
        validateHeroDeck("spdr", ["protection"], [...codes, code]).valid,
        code,
      ).toBe(false);
      expect(
        deckErrors("spdr", "protection", [...codes, code]).length,
        code,
      ).toBeGreaterThan(0);
    }
  });

  it("offers the exact playable source in the browser and locks all fifteen signatures in the account editor", () => {
    const editor = renderToStaticMarkup(
      createElement(DeckEditor, {
        initial: {
          id: "spdr",
          name: "Original source",
          heroId: "spdr",
          aspect: "protection",
          cards: deckCodes("spdr", "protection"),
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
    for (const code of identityFaces)
      expect(
        deckOptions("spdr", "protection").some((c) => c.code === code),
        code,
      ).toBe(false);
    const browser = renderToStaticMarkup(
      createElement(ContentBrowser, {
        initialHeroCode: "31001a",
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

  it("starts with four actual cards plus owned Peni and inactive Suit pieces outside the forty-card composition", () => {
    const s = game();
    expect(s.error).toBeUndefined();
    expect(s.phase).toBe("mulligan");
    expect(heroCard(s).code).toBe("31002a");
    expect(s.player.hand).toHaveLength(4);
    expect(handSize(s)).toBe(4);
    expect(maxHP(s)).toBe(14);
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      recover: 4,
    });
    const pieces = physicalPieces(s);
    const identities = pieces.filter((p) => identityFaces.includes(p.code));
    const playing = pieces.filter((p) => !identityFaces.includes(p.code));
    expect(identities.map((p) => p.code).sort()).toEqual(["31001b", "31002a"]);
    expect(s.player.inPlay.filter((p) => p.code === "31001b")).toHaveLength(1);
    expect(playing).toHaveLength(40);
    expect(countsFor(playing.map((p) => p.code))).toEqual(originalCards);
    expect(pieces).toHaveLength(42);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(42);
    expect(pieces.every((p) => p.ownerId === s.activePlayerId)).toBe(true);
    const saved = JSON.parse(JSON.stringify(s)) as GameState;
    expect(physicalPieces(saved)).toEqual(pieces);
    expect(new Set(physicalPieces(saved).map((p) => p.id)).size).toBe(42);
  });

  it("retains the printed obligation and all five actual nemesis reserve pieces outside the deck", () => {
    expect(heroRuntime("spdr")?.obligationCodes).toEqual(["31025"]);
    expect(heroRuntime("spdr")?.nemesisCodes).toEqual([
      "31026",
      "31027",
      "31028",
    ]);
    for (const [code, quantity] of [
      ["31025", 1],
      ["31026", 1],
      ["31027", 1],
      ["31028", 3],
    ] as const)
      expect(raw(code).quantity, code).toBe(quantity);
    expect(raw("31026")).toMatchObject({
      base_threat: 4,
      base_threat_fixed: true,
      scheme_crisis: 1,
      boost: 3,
    });
    expect(raw("31027")).toMatchObject({
      scheme: 2,
      attack: 2,
      health: 6,
      boost: 2,
    });
    expect(raw("31027").is_unique).toBeUndefined();
    expect(raw("31028").boost).toBe(1);
    const s = game();
    const reserve = (s.player.setAside || []).filter((p) =>
      ["31026", "31027", "31028"].includes(p.code),
    );
    expect(reserve).toHaveLength(5);
    expect(countsFor(reserve.map((p) => p.code))).toEqual({
      "31026": 1,
      "31027": 1,
      "31028": 3,
    });
    expect(new Set(reserve.map((p) => p.id)).size).toBe(5);
    expect(reserve.every((p) => p.ownerId === s.activePlayerId)).toBe(true);
    expect(
      [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) => p.code === "31025",
      ),
    ).toHaveLength(1);
  });

  it("preserves the original identity powers, hand sizes, hit points and permanent faces", () => {
    expect(raw("31001a")).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      health: 14,
      hand_size: 3,
      traits: "Active. Web-Warrior.",
      is_unique: true,
    });
    expect(raw("31002a")).toMatchObject({
      recover: 4,
      health: 14,
      hand_size: 4,
      traits: "Civilian.",
      is_unique: true,
    });
    expect(raw("31001b")).toMatchObject({
      type_code: "support",
      permanent: true,
      is_unique: true,
    });
    expect(raw("31002b")).toMatchObject({
      type_code: "upgrade",
      permanent: true,
      is_unique: true,
      resource_wild: 1,
    });
    for (const code of ["31001b", "31002b"])
      expect(raw(code).text, code).toContain(
        "This card's printed text box cannot be treated as if it were blank",
      );
  });

  it("allows supplemental Clarity of Purpose in a legal custom Leadership deck while retaining its actual printing", () => {
    const codes = deckCodes("spdr", "leadership"),
      basic = codes.findIndex((code) => card(code).faction_code === "basic");
    expect(basic).toBeGreaterThanOrEqual(0);
    codes[basic] = "31029";
    expect(codes).toHaveLength(40);
    expect(deckErrors("spdr", "leadership", codes)).toEqual([]);
    expect(card("31029")).toMatchObject({
      code: "31029",
      faction_code: "leadership",
      cost: 1,
      resource_mental: 1,
      quantity: 3,
      deck_limit: 3,
    });
    expect(source().cards).not.toHaveProperty("31029");
  });

  it.each([
    ["31003", 1, 1, 1, 1, 3, "Addy Brock"],
    ["31014", 2, 1, 2, 1, 3, undefined],
    ["31015", -1, -1, 1, 1, 3, undefined],
    ["31021", 2, 2, 0, 0, 3, "Peter Porker"],
    ["31022", 1, 2, 1, 2, 2, "Otto Octavius"],
  ] as const)(
    "preserves scan-verified ally stats and consequential icons for %s",
    (code, thwart, attack, thwartCost, attackCost, health, subname) => {
      for (const c of [raw(code), card(code)]) {
        expect(c).toMatchObject({
          thwart,
          attack,
          thwart_cost: thwartCost,
          attack_cost: attackCost,
          health,
          is_unique: true,
        });
        expect(c.subname).toBe(subname);
      }
    },
  );

  it("preserves original costs, resources, traits and uniqueness across all player printings", () => {
    const printed = [
      ["31003", 4, "energy", "", true],
      ["31004", 1, "energy", "", false],
      ["31005", 2, "mental", "Thwart.", false],
      ["31006", 2, "energy", "Attack.", false],
      ["31007", 1, "mental", "Persona.", true],
      ["31008", 0, "physical", "Tactic.", false],
      ["31009", 1, "mental", "Location.", false],
      ["31010", 3, "wild", "Interface. Spider.", false],
      ["31011", 2, "mental", "Interface. Tech.", false],
      ["31012", 1, "physical", "Interface. Tech.", false],
      ["31013", 2, "energy", "Interface. Tech.", false],
      ["31014", 2, "physical", "", true],
      ["31015", 3, "energy", "Web-Warrior.", true],
      ["31016", 0, "energy", "Skill.", false],
      ["31017", 2, "mental", "Superpower.", false],
      ["31018", 2, "energy", "Item. Tech.", false],
      ["31019", 3, "energy", "Tech.", false],
      ["31020", 1, "mental", "Superpower.", false],
      ["31021", 3, "physical", "Cartoon. Web-Warrior.", true],
      ["31022", 2, "mental", "Web-Warrior.", true],
      ["31023", 1, "physical", "Superpower.", false],
      ["31024", 1, "physical", "Condition. Superpower.", false],
      ["31029", 1, "mental", "Condition.", false],
    ] as const;
    for (const [code, cost, resource, traits, unique] of printed)
      for (const c of [raw(code), card(code)]) {
        expect(c.cost, code).toBe(cost);
        expect(c[`resource_${resource}`], code).toBe(1);
        expect(
          (c.resource_energy || 0) +
            (c.resource_mental || 0) +
            (c.resource_physical || 0) +
            (c.resource_wild || 0),
          code,
        ).toBe(1);
        expect(c.traits || "", code).toBe(traits);
        expect(!!c.is_unique, code).toBe(unique);
      }
    expect(raw("31003").traits).toBeUndefined();
    expect(raw("31010").traits).not.toContain("Tech.");
    expect(raw("31002b")).toMatchObject({
      resource_wild: 1,
      traits: "Interface. Pilot.",
      permanent: true,
    });
    expect(raw("31001b")).toMatchObject({
      traits: "Inactive. Tech.",
      permanent: true,
    });
  });

  it("preserves all encounter stat and boost symbols, including the fixed four-threat modular crisis", () => {
    expect(raw("31030")).toMatchObject({
      base_threat: 4,
      base_threat_fixed: true,
      scheme_crisis: 1,
      boost: 3,
    });
    for (const [code, scheme, attack, health, boost, star] of [
      ["31031", 2, 3, 4, 0, true],
      ["31032", 1, 2, 3, 1, false],
      ["31033", 2, 2, 5, 2, false],
      ["31034", 2, 2, 6, 3, false],
      ["31035", 1, 1, 7, 1, true],
      ["31036", 1, 1, 4, 0, true],
    ] as const)
      for (const c of [raw(code), card(code)]) {
        expect(c).toMatchObject({ scheme, attack, health, is_unique: true });
        expect(c.boost || 0, code).toBe(boost);
        expect(!!c.boost_star, code).toBe(star);
        expect(c.traits?.includes("Criminal."), code).toBe(true);
      }
    expect(raw("31034").traits).toBe("Criminal. Elite.");
    expect(raw("31037")).toMatchObject({
      type_code: "environment",
      boost: 2,
      quantity: 1,
    });
  });

  it("closes every one of the thirty-nine retail faces and retains actual Energy Barrier and Forcefield Generator codes", () => {
    const faces = importedCards.filter((c) => c.pack_code === "spdr");
    expect(faces).toHaveLength(39);
    expect(
      faces.filter((c) => c.set_code === "ironspider_sinister"),
    ).toHaveLength(8);
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(raw("31018").duplicate_of).toBe("05017");
    expect(card("31018").code).toBe("31018");
    expect(raw("31019").duplicate_of).toBeUndefined();
    expect(
      importedCards.filter((c) => c.name === "Forcefield Generator"),
    ).toHaveLength(1);
    expect(card("31019").code).toBe("31019");
  });

  it("applies the published RRG1.8 MORBIUS correction while retaining the original downloaded text", () => {
    expect(raw("31027").text).toContain(
      "After the engaged hero generates any number of resources",
    );
    expect(card("31027").text).toContain(
      "After the engaged player generates any number of resources",
    );
    expect(card("31027").text).toContain("damage to that player's hero");
    expect(card("31001b").text).toContain(
      "moving all counters on this card and cards attached to this card to her",
    );
  });

  it("leaves downloaded card and source-deck bytes unchanged", () => {
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
