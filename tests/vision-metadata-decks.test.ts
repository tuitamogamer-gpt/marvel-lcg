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
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
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
import { VISION_SCRIPT_CODES } from "../src/game/vision.js";
import {
  VISION_PACK_CORE_ALIASES,
  VISION_PACK_SCRIPT_CODES,
} from "../src/game/vision-pack.js";
import type { Card } from "../src/game/types.js";

const source = STARTER_DECKS.find((d) => d.id === "starter-26001a")!;
const raw = (code: string) => catalog.find((c) => c.code === code)! as Card;
const aliases = {
  "26017": "01082",
  "26020": "01078",
  "26023": "01091",
  "26025": "01088",
  "26026": "01089",
  "26027": "01090",
};
const game = (codes = catalogDeckCodes(source)) =>
  newGame({
    heroId: "vision",
    aspect: "protection",
    villainId: "rhino",
    heroes: [{ heroId: "vision", aspect: "protection", deckCards: codes }],
    seed: 26001,
    pacing: "expert",
  });

describe("Vision metadata/source/editor", () => {
  it("uses canonical vision with its two unchanged printed identity faces and REC3", () => {
    expect(SCRIPTED_HERO_IDS.has("vision")).toBe(true);
    expect(CATALOG_HEROES.find((h) => h.id === "vision")).toMatchObject({
      code: "26001a",
      alter: "26001b",
    });
    for (const id of ["vision", "vision:vision", "26001a", "26001b"])
      expect(heroRuntime(id)?.id).toBe("vision");
    expect(heroRuntime("vision")?.scripted).toBe(true);
    expect(heroRuntime("vision")?.identityCodes).toEqual(["26001a", "26001b"]);
    expect(heroStarterAspects("vision")).toEqual(["protection"]);
    expect(raw("26001a")).toMatchObject({
      attack: 0,
      thwart: 2,
      defense: 0,
      health: 11,
      hand_size: 5,
    });
    expect(raw("26001b")).toMatchObject({
      recover: 3,
      health: 11,
      hand_size: 5,
    });
    expect(card("26001b").recover).toBe(3);
  });

  it("retains the exact forty-card playing source plus one physical Permanent", () => {
    const codes = deckCodes("vision", "protection");
    expect(codes).toEqual(catalogDeckCodes(source));
    expect(codes).toHaveLength(41);
    expect(deckSizeFor(codes)).toBe(40);
    expect(countsFor(codes)).toEqual(source.cards);
    for (const [faction, count] of [
      ["hero", 15],
      ["protection", 17],
      ["basic", 8],
    ] as const)
      expect(
        codes.filter(
          (code) =>
            !isPermanent(card(code)) && card(code).faction_code === faction,
        ),
      ).toHaveLength(count);
    expect(heroRequiredCards("vision")).toEqual({
      "26002": 1,
      "26003": 1,
      "26004": 1,
      "26005": 1,
      "26006": 1,
      "26007": 2,
      "26008": 3,
      "26009": 2,
      "26010": 2,
      "26011": 1,
      "26012": 1,
    });
    expect(heroSetupCards("vision")).toEqual({ "26002": 1 });
    expect(deckErrors("vision", "protection", codes)).toEqual([]);
  });

  it("offers only the physical front printing and rejects an extra or substituted reverse face", () => {
    const codes = catalogDeckCodes(source);
    expect(isPermanent(card("26002"))).toBe(true);
    expect(isPermanent(card("26002b"))).toBe(true);
    expect(
      deckOptions("vision", "protection").filter((c) => c.code === "26002"),
    ).toHaveLength(1);
    expect(
      deckOptions("vision", "protection").some((c) => c.code === "26002b"),
    ).toBe(false);
    expect(
      validateHeroDeck("vision", ["protection"], [...codes, "26002b"]).valid,
    ).toBe(false);
    expect(
      validateHeroDeck(
        "vision",
        ["protection"],
        codes.map((code) => (code === "26002" ? "26002b" : code)),
      ).valid,
    ).toBe(false);
    expect(
      deckErrors(
        "vision",
        "protection",
        codes.filter((code) => code !== "26002"),
      ),
    ).toContain("Include exactly 1 Intangible from the hero’s signature set.");
    expect(deckErrors("vision", "protection", [...codes, "26002"])).toContain(
      "Include exactly 1 Intangible from the hero’s signature set.",
    );
  });

  it("registers all thirty-eight faces without treating linked mass forms as separate deck pieces", () => {
    const retail = catalog.filter((c) => c.pack_code === "vision");
    expect(retail).toHaveLength(38);
    expect(VISION_SCRIPT_CODES).toHaveLength(19);
    expect(VISION_PACK_SCRIPT_CODES).toHaveLength(13);
    expect(VISION_PACK_CORE_ALIASES).toHaveLength(6);
    const supported = [
      ...VISION_SCRIPT_CODES,
      ...VISION_PACK_SCRIPT_CODES,
      ...VISION_PACK_CORE_ALIASES,
    ];
    expect(new Set(supported).size).toBe(38);
    expect([...supported].sort()).toEqual(retail.map((c) => c.code).sort());
    for (const code of [...VISION_SCRIPT_CODES, ...VISION_PACK_SCRIPT_CODES]) {
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
      expect(hasExecutableScript(code), code).toBe(true);
      expect(hasCoreScript(code), code).toBe(false);
    }
    for (const [code, core] of Object.entries(aliases)) {
      expect(rulesCode(code), code).toBe(core);
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(false);
      expect(card(code).code).toBe(code);
    }
    for (const code of ["26019", "26021"])
      expect(rulesCode(code), code).toBe(code);
  });

  it("matches all sixteen printed fields on each exact Core pair", () => {
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
      for (const field of fields)
        expect(raw(code)[field], `${code}:${field}`).toEqual(raw(core)[field]);
  });

  it.each(["aggression", "justice", "leadership", "protection"] as const)(
    "retains one physical mass form and fifteen playing signatures in a legal %s app/source starter",
    (aspect) => {
      const codes = deckCodes("vision", aspect);
      expect(codes).toHaveLength(41);
      expect(deckSizeFor(codes)).toBe(40);
      expect(codes.filter((code) => code === "26002")).toHaveLength(1);
      expect(codes).not.toContain("26002b");
      expect(deckErrors("vision", aspect, codes)).toEqual([]);
      for (const [code, count] of Object.entries(heroRequiredCards("vision")))
        expect(
          codes.filter((c) => c === code),
          code,
        ).toHaveLength(count);
      if (aspect === "leadership") expect(codes).not.toContain("01068");
    },
  );

  it("keeps source quantity and one chosen aspect fixed in custom decks", () => {
    const codes = deckCodes("vision", "protection");
    expect(
      deckErrors(
        "vision",
        "protection",
        codes.filter((code) => code !== "26011"),
      ),
    ).toContain(
      "Include exactly 1 Phase Disruption from the hero’s signature set.",
    );
    expect(deckErrors("vision", "protection", [...codes, "26009"])).toContain(
      "Include exactly 2 Superdense Strike from the hero’s signature set.",
    );
    expect(
      validateHeroDeck("vision", ["protection", "justice"], codes).errors,
    ).toContain("Choose exactly one aspect for this hero.");
  });

  it("limits Preservation across reprints and excludes the matching Core Vision ally", () => {
    const codes = deckCodes("vision", "protection");
    expect(copyLimit(card("26021"), "vision")).toBe(1);
    expect(
      deckErrors("vision", "protection", [...codes, "21064"]).some(
        (e) => e.includes("Preservation") && e.includes("1"),
      ),
    ).toBe(true);
    expect(
      deckOptions("vision", "leadership").some((c) => c.code === "01068"),
    ).toBe(false);
    expect(
      validateHeroDeck(
        "vision",
        ["leadership"],
        [...deckCodes("vision", "leadership"), "01068"],
      ).errors.some((e) => e.includes("Vision") && e.includes("identity")),
    ).toBe(true);
  });

  it("shows forty playing cards and one locked physical setup row in the native editor", () => {
    const markup = renderToStaticMarkup(
      createElement(DeckEditor, {
        initial: {
          id: "vision",
          name: "Original Protection",
          heroId: "vision",
          aspect: "protection",
          cards: catalogDeckCodes(source),
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
    expect(markup).toContain("1 Permanent setup card");
    expect(markup).toContain("It enters play Intangible after your mulligan.");
    expect(markup).not.toContain("Permanent energy forms");
    expect(markup).toContain("Intangible");
    expect(markup).not.toContain('aria-label="Copies of Intangible"');
    expect(markup).not.toContain('aria-label="Copies of Dense"');
    expect(markup).not.toContain('aria-label="Second aspect"');
  });

  it("offers the exact Protection playing source through the actual collection browser", () => {
    const markup = renderToStaticMarkup(
      createElement(ContentBrowser, {
        initialHeroCode: "26001a",
        assignedHeroIds: [],
        onChooseHero: () => {},
        onInspect: () => {},
      }),
    );
    expect(markup).toContain("Choose Vision for mission");
    expect(markup).toContain(
      "Mission setup will load this exact 40-card source preconstructed list.",
    );
    expect(markup).not.toContain("Choose Vision with app starter");
    expect(markup).toContain("It enters play Intangible after your mulligan.");
  });

  it("keeps the inherited Valkyrie editor's sixteen counted signatures and no Permanent setup label", () => {
    const markup = renderToStaticMarkup(
      createElement(DeckEditor, {
        initial: {
          id: "valk-preserved",
          name: "Valkyrie Aggression",
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
    expect(markup).toContain("Keep all 16 hero cards");
    expect(markup).toContain("24–34 aspect or basic cards");
    expect(markup).not.toContain("Permanent setup card");
  });
});

describe("Vision native source setup and static providers", () => {
  it("extracts the same physical mass card before five opening cards and puts it Intangible only after mulligan", () => {
    const s = game();
    expect(s.error).toBeUndefined();
    expect(s.phase).toBe("mulligan");
    expect(s.player.hand).toHaveLength(5);
    expect(handSize(s)).toBe(5);
    const normal = [
      ...s.player.hand,
      ...s.player.deck,
      ...s.player.discard,
      ...s.player.inPlay,
    ];
    expect(normal).toHaveLength(40);
    const held = s.player.setAside?.filter((p) => p.code === "26002") || [];
    expect(held).toHaveLength(1);
    expect(countsFor([...normal, ...held].map((p) => p.code))).toEqual(
      source.cards,
    );
    const next = dispatch(JSON.parse(JSON.stringify(s)), {
      type: "MULLIGAN",
      ids: [],
    });
    expect(next.error).toBeUndefined();
    const mass = next.player.inPlay.filter((p) => p.code === "26002");
    expect(mass).toHaveLength(1);
    expect(mass[0].id).toBe(held[0].id);
    expect(next.player.setAside?.some((p) => p.id === held[0].id)).toBe(false);
    expect(next.player.hand).toHaveLength(5);
    expect(handSize(next)).toBe(6);
    expect(
      new Set(
        [
          ...next.player.hand,
          ...next.player.deck,
          ...next.player.discard,
          ...next.player.inPlay,
        ].map((p) => p.id),
      ).size,
    ).toBe(41);
  });

  it("derives Dense powers and AE REC from the same mass piece without overriding printed REC3", () => {
    let s = game();
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    const mass = s.player.inPlay.find((p) => p.code === "26002")!;
    expect(mass).toBeDefined();
    expect(heroStats(s).recover).toBe(3);
    expect(handSize(s)).toBe(6);
    mass.code = "26002b";
    expect(heroStats(s).recover).toBe(5);
    expect(handSize(s)).toBe(5);
    s.player.form = "hero";
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 2 });
    expect(maxHP(s)).toBe(11);
    s.player.inPlay.push({ ...makePiece(s, "26005"), ownerId: "p1" });
    expect(aerial(s)).toBe(true);
    s.player.form = "alter";
    expect(aerial(s)).toBe(true);
    expect(card("26001b").recover).toBe(3);
  });
});
