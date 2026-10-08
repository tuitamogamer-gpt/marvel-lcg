import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { DeckEditor } from "../src/account/AccountPage.js";
import { ContentBrowser } from "../src/ContentBrowser.js";
import {
  card,
  deckCodes,
  handSize,
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
import { makePiece, newGame } from "../src/game/engine.js";
import {
  EXPLICIT_CARD_SCRIPTS,
  SCRIPTED_HERO_IDS,
} from "../src/game/engine-support.js";
import {
  heroRequiredCards,
  heroRuntime,
  heroSetupCards,
  heroStarterAspects,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { hasCoreScript, rulesCode } from "../src/game/rules-code.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { uniqueMatches } from "../src/game/unique.js";
import { GHOST_SPIDER_SCRIPT_CODES } from "../src/game/ghost-spider.js";
import { MILES_MORALES_SCRIPT_CODES } from "../src/game/miles-morales.js";
import {
  SINISTER_PLAYER_PACK_CORE_ALIASES,
  SINISTER_PLAYER_PACK_SCRIPT_CODES,
  sinisterPlayerPackHazards,
} from "../src/game/sinister-player-pack.js";
import type { Aspect, Card } from "../src/game/types.js";

const raw = (code: string) => catalog.find((c) => c.code === code)! as Card;
const aliases = {
  "27020": "01088",
  "27021": "01089",
  "27022": "01090",
  "27045": "01064",
  "27051": "01088",
  "27052": "01089",
  "27053": "01090",
};
const specs: {
  id: string;
  hero: string;
  alter: string;
  aspect: Aspect;
  aspectCount: number;
  basicCount: number;
  required: Record<string, number>;
}[] = [
  {
    id: "ghost_spider",
    hero: "27001a",
    alter: "27001b",
    aspect: "protection" as Aspect,
    aspectCount: 15,
    basicCount: 10,
    required: {
      "27002": 3,
      "27003": 1,
      "27004": 3,
      "27005": 2,
      "27006": 2,
      "27007": 1,
      "27008": 1,
      "27009": 2,
    },
  },
  {
    id: "spider_man_morales",
    hero: "27030a",
    alter: "27030b",
    aspect: "justice" as Aspect,
    aspectCount: 13,
    basicCount: 12,
    required: {
      "27031": 2,
      "27032": 2,
      "27033": 2,
      "27034": 3,
      "27035": 1,
      "27036": 1,
      "27037": 1,
      "27038": 1,
      "27039": 2,
    },
  },
];
const source = (hero: string) =>
  STARTER_DECKS.find((d) => d.heroCode === hero)!;
const game = (id = "ghost_spider", aspect: Aspect = "protection") =>
  newGame({
    heroId: id,
    aspect,
    villainId: "rhino",
    heroes: [{ heroId: id, aspect, deckCards: deckCodes(id, aspect) }],
    seed: 27001,
    pacing: "expert",
  });

for (const spec of specs)
  describe(`${spec.id} original metadata and source`, () => {
    it("uses canonical box/set identity aliases and the printed two-face identity", () => {
      expect(SCRIPTED_HERO_IDS.has(spec.id)).toBe(true);
      expect(CATALOG_HEROES.find((h) => h.id === spec.id)).toMatchObject({
        code: spec.hero,
        alter: spec.alter,
      });
      for (const id of [spec.id, `sm:${spec.id}`, spec.hero, spec.alter])
        expect(heroRuntime(id)?.id).toBe(spec.id);
      expect(heroRuntime(spec.id)?.scripted).toBe(true);
      expect(heroRuntime(spec.id)?.identityCodes).toEqual([
        spec.hero,
        spec.alter,
      ]);
      expect(heroStarterAspects(spec.id)).toEqual([spec.aspect]);
      expect(card(spec.hero).pack_code).toBe("sm");
    });
    it("keeps the exact forty physical source cards and no setup or supplementary pieces", () => {
      const original = source(spec.hero),
        codes = deckCodes(spec.id, spec.aspect);
      expect(codes).toEqual(catalogDeckCodes(original));
      expect(codes).toHaveLength(40);
      expect(deckSizeFor(codes)).toBe(40);
      expect(countsFor(codes)).toEqual(original.cards);
      expect(heroRequiredCards(spec.id)).toEqual(spec.required);
      expect(heroSetupCards(spec.id)).toEqual({});
      expect(original.setupCards).toEqual({});
      expect(original.supplementaryCards).toEqual({});
      for (const [faction, count] of [
        ["hero", 15],
        [spec.aspect, spec.aspectCount],
        ["basic", spec.basicCount],
      ] as const)
        expect(
          codes.filter((c) => card(c).faction_code === faction),
        ).toHaveLength(count);
      expect(codes).not.toContain("27190");
      expect(codes).not.toContain("27191");
      expect(deckErrors(spec.id, spec.aspect, codes)).toEqual([]);
    });
    it.each(["aggression", "justice", "leadership", "protection"] as const)(
      "retains fifteen signatures in a legal %s app/source starter",
      (aspect) => {
        const codes = deckCodes(spec.id, aspect);
        expect(codes).toHaveLength(40);
        expect(deckErrors(spec.id, aspect, codes)).toEqual([]);
        for (const [code, count] of Object.entries(spec.required))
          expect(
            codes.filter((c) => c === code),
            code,
          ).toHaveLength(count);
      },
    );
    it("rejects missing or extra signatures and a second selected aspect", () => {
      const codes = deckCodes(spec.id, spec.aspect),
        signature = Object.keys(spec.required)[0];
      expect(
        validateHeroDeck(
          spec.id,
          [spec.aspect],
          codes.filter((c) => c !== signature),
        ).valid,
      ).toBe(false);
      expect(
        validateHeroDeck(spec.id, [spec.aspect], [...codes, signature]).valid,
      ).toBe(false);
      expect(
        validateHeroDeck(spec.id, ["protection", "justice"], codes).errors,
      ).toContain("Choose exactly one aspect for this hero.");
    });
    it("renders exact source launch and a forty-card editor with fifteen locked signatures", () => {
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
      if (spec.id === "spider_man_morales") {
        expect(markup).toContain("Spider-Man · Miles Morales");
        expect(markup).toContain("Spider-Man · Peter Parker");
      }
    });
    it("initializes forty unique actual owned player pieces from that exact source", () => {
      const s = game(spec.id, spec.aspect);
      expect(s.error).toBeUndefined();
      expect(s.phase).toBe("mulligan");
      expect(s.player.hand).toHaveLength(6);
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
    });
  });

describe("Sinister shared registration, printings and identity limits", () => {
  it("registers exactly the sixty-four hero/player/encounter faces, leaving box scenarios outside this scope", () => {
    expect(GHOST_SPIDER_SCRIPT_CODES).toHaveLength(15);
    expect(MILES_MORALES_SCRIPT_CODES).toHaveLength(16);
    expect(SINISTER_PLAYER_PACK_SCRIPT_CODES).toHaveLength(26);
    expect(SINISTER_PLAYER_PACK_CORE_ALIASES).toHaveLength(7);
    const supported = [
      ...GHOST_SPIDER_SCRIPT_CODES,
      ...MILES_MORALES_SCRIPT_CODES,
      ...SINISTER_PLAYER_PACK_SCRIPT_CODES,
      ...SINISTER_PLAYER_PACK_CORE_ALIASES,
    ];
    expect(new Set(supported).size).toBe(64);
    for (const code of supported) expect(raw(code).pack_code).toBe("sm");
    for (const code of [
      ...GHOST_SPIDER_SCRIPT_CODES,
      ...MILES_MORALES_SCRIPT_CODES,
      ...SINISTER_PLAYER_PACK_SCRIPT_CODES,
    ]) {
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
      expect(hasExecutableScript(code), code).toBe(true);
      expect(hasCoreScript(code), code).toBe(code === "27039");
    }
    for (const [code, core] of Object.entries(aliases)) {
      expect(rulesCode(code), code).toBe(core);
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(false);
      expect(card(code).code).toBe(code);
    }
    expect(rulesCode("27013")).toBe("27013");
    expect(rulesCode("27050")).toBe("27050");
    expect(EXPLICIT_CARD_SCRIPTS.has("27061")).toBe(false);
  });
  it("matches all sixteen printed fields across seven supplementary Core pairs and Web-Shooter", () => {
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
    for (const [code, core] of Object.entries({ ...aliases, "27039": "01008" }))
      for (const field of fields)
        expect(raw(code)[field], `${code}:${field}`).toEqual(raw(core)[field]);
  });
  it("preserves original printed identity stats and Ticket's two wild resources without an overlay", () => {
    expect(raw("27001a")).toMatchObject({
      health: 10,
      attack: 2,
      thwart: 1,
      defense: 3,
      hand_size: 5,
    });
    expect(raw("27001b")).toMatchObject({ recover: 3, hand_size: 6 });
    expect(raw("27030a")).toMatchObject({
      health: 9,
      attack: 2,
      thwart: 2,
      defense: 2,
      hand_size: 5,
    });
    expect(raw("27030b")).toMatchObject({ recover: 4, hand_size: 6 });
    expect(raw("27008").resource_wild).toBe(2);
    expect(card("27008").resource_wild).toBe(2);
    for (const code of [
      ...GHOST_SPIDER_SCRIPT_CODES,
      ...MILES_MORALES_SCRIPT_CODES,
    ])
      for (const field of [
        "attack",
        "thwart",
        "defense",
        "recover",
        "health",
        "hand_size",
        "boost",
        "resource_wild",
      ] as const)
        expect(card(code)[field], `${code}:${field}`).toEqual(raw(code)[field]);
  });
  it("shares Young Love's one-copy limit across both physical printings", () => {
    expect(copyLimit(card("27019"))).toBe(1);
    expect(copyLimit(card("27050"))).toBe(1);
    expect(
      deckErrors("ghost_spider", "protection", [
        ...deckCodes("ghost_spider", "protection"),
        "27050",
      ]).some((e) => e.includes("Young Love") && e.includes("1")),
    ).toBe(true);
    expect(
      deckErrors("spider_man_morales", "justice", [
        ...deckCodes("spider_man_morales", "justice"),
        "27019",
      ]).some((e) => e.includes("Young Love") && e.includes("1")),
    ).toBe(true);
  });
  it("distinguishes each Spider identity's matching ally from differently subtitled Spider allies", () => {
    expect(uniqueMatches(card("27030a"), card("27011"))).toBe(true);
    expect(uniqueMatches(card("27001a"), card("27048"))).toBe(true);
    expect(uniqueMatches(card("27030a"), card("27049"))).toBe(false);
    expect(uniqueMatches(card("27030a"), card("27017"))).toBe(false);
    expect(uniqueMatches(card("01001a"), card("27049"))).toBe(true);
    expect(
      deckOptions("ghost_spider", "protection").some((c) => c.code === "27048"),
    ).toBe(false);
    expect(
      deckOptions("spider_man_morales", "protection").some(
        (c) => c.code === "27011",
      ),
    ).toBe(false);
    expect(
      deckOptions("spider_man_morales", "justice").some(
        (c) => c.code === "27049",
      ),
    ).toBe(true);
  });
  it("makes campaign player printings optional counted cards without injecting them into either source", () => {
    for (const code of ["27190", "27191"]) {
      expect(
        deckOptions("ghost_spider", "protection").some((c) => c.code === code),
      ).toBe(true);
      expect(copyLimit(card(code))).toBe(1);
    }
    expect(
      deckSizeFor([...deckCodes("ghost_spider", "protection"), "27191"]),
    ).toBe(41);
    expect(card("27191").permanent).toBeUndefined();
    expect(card("27190").scheme_hazard).toBe(1);
    expect(card("27191").scheme_hazard).toBe(1);
  });
  it("derives one actual Symbiote Suit's numeric modifiers without compiler double counting", () => {
    const s = game();
    const baseline = heroStats(s),
      baseHP = maxHP(s),
      baseHand = handSize(s);
    const suit = makePiece(s, "27191");
    s.player.inPlay.push(suit);
    expect(heroStats(s)).toEqual({
      attack: baseline.attack + 1,
      thwart: baseline.thwart + 1,
      defense: baseline.defense + 1,
      recover: baseline.recover + 1,
    });
    expect(maxHP(s)).toBe(baseHP + 10);
    expect(handSize(s)).toBe(baseHand + 1);
    expect(sinisterPlayerPackHazards(s)).toBe(1);
    s.player.form = "hero";
    expect(handSize(s)).toBe(6);
    expect(maxHP(s)).toBe(20);
    s.player.inPlay = s.player.inPlay.filter((p) => p.id !== suit.id);
    expect(maxHP(s)).toBe(10);
    expect(handSize(s)).toBe(5);
  });
  it("applies the same Suit hand-size bonus to Iron Man's separate Tech branch", () => {
    const s = game("iron_man", "leadership");
    s.player.form = "hero";
    const before = handSize(s);
    s.player.inPlay.push(makePiece(s, "27191"));
    expect(handSize(s)).toBe(before + 1);
  });
});
