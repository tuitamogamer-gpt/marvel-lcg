import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { DeckEditor } from "../src/account/AccountPage.js";
import { ContentBrowser } from "../src/ContentBrowser.js";
import {
  aerial,
  card,
  deckCodes,
  heroStats,
  maxHP,
  resources,
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
  isPermanent,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { hasCoreScript, rulesCode } from "../src/game/rules-code.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import {
  VALKYRIE_SCRIPT_CODES,
  valkyrieInitializeNemesis,
} from "../src/game/valkyrie.js";
import {
  VALKYRIE_PACK_CORE_ALIASES,
  VALKYRIE_PACK_SCRIPT_CODES,
} from "../src/game/valkyrie-pack.js";
import type { Card } from "../src/game/types.js";

const source = STARTER_DECKS.find((d) => d.id === "starter-25001a")!;
const raw = (code: string) => catalog.find((c) => c.code === code)! as Card;
const aliases = {
  "25017": "01057",
  "25022": "01055",
  "25025": "01088",
  "25026": "01089",
  "25027": "01090",
};
const game = (codes = catalogDeckCodes(source)) =>
  newGame({
    heroId: "valk",
    aspect: "aggression",
    villainId: "rhino",
    seed: 25001,
    heroes: [{ heroId: "valk", aspect: "aggression", deckCards: codes }],
  });

describe("Valkyrie's actual source composition and registry", () => {
  it("uses canonical valk, both original identity faces and one chosen aspect", () => {
    expect(SCRIPTED_HERO_IDS.has("valk")).toBe(true);
    expect(CATALOG_HEROES.find((h) => h.id === "valk")).toMatchObject({
      code: "25001a",
      alter: "25001b",
    });
    for (const id of ["valk", "valk:valk", "25001a", "25001b"])
      expect(heroRuntime(id)?.id).toBe("valk");
    expect(heroRuntime("valk")?.identityCodes).toEqual(["25001a", "25001b"]);
    expect(heroRuntime("valk")?.scripted).toBe(true);
    expect(heroStarterAspects("valk")).toEqual(["aggression"]);
    expect(raw("25001a")).toMatchObject({
      attack: 2,
      thwart: 1,
      defense: 1,
      health: 12,
      hand_size: 5,
    });
    expect(raw("25001b")).toMatchObject({
      recover: 4,
      health: 12,
      hand_size: 6,
    });
  });

  it("preserves all 41 printed source cards as sixteen Hero, eighteen Aggression and seven Basic", () => {
    const codes = deckCodes("valk", "aggression");
    expect(codes).toEqual(catalogDeckCodes(source));
    expect(source.deckSize).toBe(41);
    expect(codes).toHaveLength(41);
    expect(countsFor(codes)).toEqual(source.cards);
    for (const [faction, count] of [
      ["hero", 16],
      ["aggression", 18],
      ["basic", 7],
    ] as const)
      expect(
        codes.filter((code) => card(code).faction_code === faction),
      ).toHaveLength(count);
    expect(heroRequiredCards("valk")).toEqual({
      "25002": 1,
      "25003": 1,
      "25004": 1,
      "25005": 1,
      "25006": 1,
      "25007": 1,
      "25008": 2,
      "25009": 1,
      "25010": 2,
      "25011": 2,
      "25012": 3,
    });
    expect(deckErrors("valk", "aggression", codes)).toEqual([]);
  });

  it("counts Death-Glow in constructed deck size and never treats it as Permanent setup", () => {
    const codes = catalogDeckCodes(source);
    expect(isPermanent(card("25002"))).toBe(false);
    expect(heroSetupCards("valk")).toEqual({});
    expect(deckSizeFor(codes)).toBe(41);
    expect(deckSizeFor(codes.filter((c) => c !== "25002"))).toBe(40);
    expect(
      deckErrors(
        "valk",
        "aggression",
        codes.filter((c) => c !== "25002"),
      ),
    ).toContain("Include exactly 1 Death-Glow from the hero’s signature set.");
    expect(deckErrors("valk", "aggression", [...codes, "25002"])).toContain(
      "Include exactly 1 Death-Glow from the hero’s signature set.",
    );
  });

  it("covers 37 retail faces as eighteen identity, fourteen dedicated pool and five exact Core aliases", () => {
    const retail = catalog.filter((c) => c.pack_code === "valk");
    expect(retail).toHaveLength(37);
    expect(VALKYRIE_SCRIPT_CODES).toHaveLength(18);
    expect(VALKYRIE_PACK_SCRIPT_CODES).toHaveLength(14);
    expect(VALKYRIE_PACK_CORE_ALIASES).toHaveLength(5);
    const supported = [
      ...VALKYRIE_SCRIPT_CODES,
      ...VALKYRIE_PACK_SCRIPT_CODES,
      ...VALKYRIE_PACK_CORE_ALIASES,
    ];
    expect(new Set(supported).size).toBe(37);
    expect([...supported].sort()).toEqual(retail.map((c) => c.code).sort());
    for (const code of [
      ...VALKYRIE_SCRIPT_CODES,
      ...VALKYRIE_PACK_SCRIPT_CODES,
    ]) {
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
      expect(hasExecutableScript(code), code).toBe(true);
      expect(hasCoreScript(code), code).toBe(false);
    }
    for (const [code, core] of Object.entries(aliases)) {
      expect(rulesCode(code), code).toBe(core);
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(false);
      expect(card(code).code).toBe(code);
    }
    for (const code of ["25015", "25016", "25018", "25020"])
      expect(rulesCode(code), code).toBe(code);
  });

  it("matches every complete printed Core-alias field, including Power's typed-resource restriction", () => {
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
    for (const [code, core] of Object.entries(aliases))
      for (const key of fields)
        expect(raw(code)[key], `${code}:${key}`).toEqual(raw(core)[key]);
    expect(resources(card("25022"), card("25018"))).toEqual(["wild", "wild"]);
    expect(resources(card("25022"), card("25024"))).toEqual(["wild"]);
  });

  it.each(["aggression", "justice", "leadership", "protection"] as const)(
    "locks all sixteen signatures in a legal %s composition",
    (aspect) => {
      const codes = deckCodes("valk", aspect);
      expect(deckSizeFor(codes)).toBe(41);
      expect(deckErrors("valk", aspect, codes)).toEqual([]);
      for (const [code, quantity] of Object.entries(heroRequiredCards("valk")))
        expect(
          codes.filter((c) => c === code),
          code,
        ).toHaveLength(quantity);
    },
  );

  it("permits a legal custom forty-card composition while preserving Death-Glow", () => {
    const codes = catalogDeckCodes(source);
    codes.splice(codes.indexOf("25020"), 1);
    expect(deckSizeFor(codes)).toBe(40);
    expect(countsFor(codes)["25002"]).toBe(1);
    expect(validateHeroDeck("valk", ["aggression"], codes).errors).toEqual([]);
    expect(deckErrors("valk", "aggression", codes)).toEqual([]);
    expect(
      validateHeroDeck("valk", ["aggression", "justice"], codes).errors,
    ).toContain("Choose exactly one aspect for this hero.");
  });

  it("enforces Audacity's one-copy limit and rejects the matching Brunnhilde ally", () => {
    const codes = deckCodes("valk", "aggression");
    expect(copyLimit(card("25021"), "valk")).toBe(1);
    expect(copyLimit(card("25022"), "valk")).toBe(2);
    expect(
      deckErrors("valk", "aggression", [...codes, "25021"]).some(
        (e) => e.includes("Audacity") && e.includes("1"),
      ),
    ).toBe(true);
    expect(
      validateHeroDeck("valk", ["aggression"], [...codes, "62014"]).errors.some(
        (e) => e.includes("Valkyrie") && e.includes("identity"),
      ),
    ).toBe(true);
  });

  it("shows a 41-card source and a locked Death-Glow signature in the actual deck editor", () => {
    const options = deckOptions("valk", "aggression");
    for (const code of Object.keys(source.cards))
      expect(
        options.some((c) => c.code === code),
        code,
      ).toBe(true);
    const markup = renderToStaticMarkup(
      createElement(DeckEditor, {
        initial: {
          id: "valkyrie",
          name: "Original Aggression",
          heroId: "valk",
          aspect: "aggression",
          cards: deckCodes("valk", "aggression"),
          revision: 1,
          updatedAt: "2026-10-08T00:00:00Z",
        },
        busy: false,
        error: "",
        onSave: () => {},
        onCancel: () => {},
      }),
    );
    expect(markup).toContain("41 / 50 cards");
    expect(markup).toContain("Death-Glow");
    expect(markup).not.toContain('aria-label="Copies of Death-Glow"');
    expect(markup).not.toContain("Permanent setup");
    expect(markup).not.toContain('aria-label="Second aspect"');
  });

  it("offers the original forty-one-card source without a false starts-in-play label", () => {
    const markup = renderToStaticMarkup(
      createElement(ContentBrowser, {
        initialHeroCode: "25001a",
        assignedHeroIds: [],
        onChooseHero: () => {},
        onInspect: () => {},
      }),
    );
    expect(markup).toContain("Choose Valkyrie for mission");
    expect(markup).toContain(
      "Mission setup will load this exact 41-card source preconstructed list.",
    );
    expect(markup).not.toContain("Choose Valkyrie with app starter");
    expect(markup).not.toContain("starts in play");
  });

  it("moves the same owned Death-Glow out of the actual source before drawing and preserves all 41 source IDs", () => {
    const s = game();
    expect(s.error).toBeUndefined();
    const ordinary = [
      ...s.player.hand,
      ...s.player.deck,
      ...s.player.discard,
      ...s.player.inPlay,
    ];
    expect(ordinary).toHaveLength(40);
    const glow = s.player.setAside?.filter((p) => p.code === "25002") || [];
    expect(glow).toHaveLength(1);
    const composition = [...ordinary, ...glow];
    expect(new Set(composition.map((p) => p.id)).size).toBe(41);
    expect(countsFor(composition.map((p) => p.code))).toEqual(source.cards);
    expect(composition.every((p) => p.ownerId === "p1")).toBe(true);
    const saved = JSON.parse(JSON.stringify(s));
    expect(
      saved.player.setAside
        .filter((p: { code: string }) => p.code === "25002")
        .map((p: { id: string }) => p.id),
    ).toEqual(glow.map((p) => p.id));
  });

  it("keeps thirty-nine ordinary cards for a legal custom forty-card deck after actual setup", () => {
    const codes = catalogDeckCodes(source);
    codes.splice(codes.indexOf("25020"), 1);
    const s = game(codes);
    expect(s.error).toBeUndefined();
    expect([
      ...s.player.hand,
      ...s.player.deck,
      ...s.player.discard,
      ...s.player.inPlay,
    ]).toHaveLength(39);
    expect(s.player.setAside?.filter((p) => p.code === "25002")).toHaveLength(
      1,
    );
  });

  it("initializes exactly five physical nemesis cards separately and never recreates saved ones", () => {
    const s = game();
    valkyrieInitializeNemesis(s, { makePiece });
    const codes = ["25029", "25030", "25031", "25032", "25032"];
    const nemeses =
      s.player.setAside?.filter((p) => codes.includes(p.code)) || [];
    expect(nemeses.map((p) => p.code)).toEqual(codes);
    expect(new Set(nemeses.map((p) => p.id)).size).toBe(5);
    const saved = JSON.parse(JSON.stringify(s));
    valkyrieInitializeNemesis(saved, { makePiece });
    expect(
      saved.player.setAside
        .filter((p: { code: string }) => codes.includes(p.code))
        .map((p: { id: string }) => p.id),
    ).toEqual(nemeses.map((p) => p.id));
    expect(heroRuntime("valk")?.obligationCodes).toEqual(["25028"]);
    expect(heroRuntime("valk")?.nemesisCodes).toEqual([
      "25029",
      "25030",
      "25031",
      "25032",
    ]);
  });

  it("applies base weapon stats separately from marked-enemy bonuses and Aragorn in both forms", () => {
    const s = game();
    s.player.form = "hero";
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 1, defense: 1 });
    expect(maxHP(s)).toBe(12);
    s.player.inPlay.push(
      ...["25005", "25006", "25007"].map((code) => ({
        ...makePiece(s, code),
        ownerId: "p1",
      })),
    );
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 1, defense: 2 });
    expect(maxHP(s)).toBe(16);
    expect(aerial(s)).toBe(true);
    s.player.form = "alter";
    expect(maxHP(s)).toBe(16);
    expect(aerial(s)).toBe(true);
  });
});
