import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { DeckEditor } from "../src/account/AccountPage.js";
import { ContentBrowser } from "../src/ContentBrowser.js";
import {
  card,
  deckCodes,
  heroStats,
  maxHP,
  pieceHP,
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
  heroRequiredCards,
  heroRuntime,
  heroSetupCards,
  heroStarterAspects,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import {
  EXPLICIT_CARD_SCRIPTS,
  SCRIPTED_HERO_IDS,
} from "../src/game/engine-support.js";
import { NEBULA_SCRIPT_CODES } from "../src/game/nebula.js";
import {
  NEBULA_PACK_CORE_ALIASES,
  NEBULA_PACK_SCRIPT_CODES,
} from "../src/game/nebula-pack.js";
import { printedCardMetadata } from "../src/game/printed-card-metadata.js";
import { hasCoreScript, rulesCode } from "../src/game/rules-code.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import type { Card } from "../src/game/types.js";

const source = STARTER_DECKS.find((d) => d.id === "starter-22001a")!;
const raw = (code: string) => catalog.find((c) => c.code === code)! as Card;
const aliases = {
  "22017": "01062",
  "22019": "01065",
  "22023": "01086",
  "22024": "01088",
  "22025": "01089",
  "22026": "01090",
};

describe("Nebula's original retail metadata and source deck", () => {
  it("registers the actual canonical identity and both printed faces", () => {
    expect(SCRIPTED_HERO_IDS.has("nebu")).toBe(true);
    expect(CATALOG_HEROES.find((h) => h.id === "nebu")).toMatchObject({
      code: "22001a",
      alter: "22001b",
      automated: true,
    });
    for (const id of ["nebu", "nebu:nebu", "22001a", "22001b"])
      expect(heroRuntime(id)?.id).toBe("nebu");
    expect(heroRuntime("nebu")?.identityCodes).toEqual(["22001a", "22001b"]);
    expect(card("22001a")).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      health: 9,
      hand_size: 5,
    });
    expect(card("22001b")).toMatchObject({
      recover: 3,
      health: 9,
      hand_size: 6,
    });
    expect(heroSetupCards("nebu")).toEqual({});
    expect(heroStarterAspects("nebu")).toEqual(["justice"]);
  });

  it("preserves exact original 15-signature +17Justice +8Basic forty physical printing codes", () => {
    const codes = deckCodes("nebu", "justice");
    expect(countsFor(codes)).toEqual(source.cards);
    expect(codes).toEqual(catalogDeckCodes(source));
    expect(codes).toHaveLength(40);
    expect(deckSizeFor(codes)).toBe(40);
    expect(codes.every((code) => code.startsWith("22"))).toBe(true);
    expect(codes.filter((code) => card(code).set_code === "nebu")).toHaveLength(
      15,
    );
    expect(
      codes.filter((code) => card(code).faction_code === "justice"),
    ).toHaveLength(17);
    expect(
      codes.filter((code) => card(code).faction_code === "basic"),
    ).toHaveLength(8);
    expect(heroRequiredCards("nebu")).toEqual({
      "22002": 1,
      "22003": 1,
      "22004": 2,
      "22005": 1,
      "22006": 1,
      "22007": 2,
      "22008": 2,
      "22009": 2,
      "22010": 3,
    });
    expect(deckErrors("nebu", "justice", codes)).toEqual([]);
    expect(validateHeroDeck("nebu", ["justice"], codes)).toMatchObject({
      valid: true,
      deckSize: 40,
      compositionSize: 40,
    });
  });

  it("accounts for all36 retail faces as16 identity-module,14 dedicated pool and6 exactCore aliases", () => {
    const retail = catalog.filter((c) => c.pack_code === "nebu");
    expect(retail).toHaveLength(36);
    expect(NEBULA_SCRIPT_CODES).toHaveLength(16);
    expect(NEBULA_PACK_SCRIPT_CODES).toHaveLength(14);
    expect(NEBULA_PACK_CORE_ALIASES).toHaveLength(6);
    const supported = [
      ...NEBULA_SCRIPT_CODES,
      ...NEBULA_PACK_SCRIPT_CODES,
      ...NEBULA_PACK_CORE_ALIASES,
    ];
    expect(new Set(supported).size).toBe(36);
    expect([...supported].sort()).toEqual(retail.map((c) => c.code).sort());
    for (const code of [...NEBULA_SCRIPT_CODES, ...NEBULA_PACK_SCRIPT_CODES]) {
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
      expect(hasExecutableScript(code), code).toBe(true);
      expect(hasCoreScript(code), code).toBe(false);
    }
    for (const [code, core] of Object.entries(aliases)) {
      expect(rulesCode(code)).toBe(core);
      expect(hasCoreScript(code)).toBe(true);
      expect(card(code).code).toBe(code);
    }
    for (const code of ["22016", "22020", "22021"])
      expect(rulesCode(code)).toBe(code);
  });

  it.each(["aggression", "justice", "leadership", "protection"] as const)(
    "retains all original Techniques and validates an alternate %s deck",
    (aspect) => {
      const codes = deckCodes("nebu", aspect);
      expect(deckSizeFor(codes)).toBe(40);
      expect(deckErrors("nebu", aspect, codes)).toEqual([]);
      for (const [code, quantity] of Object.entries(heroRequiredCards("nebu")))
        expect(codes.filter((c) => c === code)).toHaveLength(quantity);
    },
  );

  it("locks exact signature counts and detects ordinary copy limits across reprints", () => {
    const codes = deckCodes("nebu", "justice");
    expect(
      deckErrors(
        "nebu",
        "justice",
        codes.filter((code) => code !== "22005"),
      ),
    ).toContain(
      "Include exactly 1 Evasive Maneuvering from the hero’s signature set.",
    );
    expect(deckErrors("nebu", "justice", [...codes, "22004"])).toContain(
      "Include exactly 2 Cutthroat Ambition from the hero’s signature set.",
    );
    const daughters = [...codes];
    daughters[daughters.indexOf("22023")] = "22022";
    expect(copyLimit(card("22022"), "nebu")).toBe(1);
    expect(
      deckErrors("nebu", "justice", daughters).some(
        (error) => error.includes("Daughters of Thanos") && error.includes("1"),
      ),
    ).toBe(true);
    const powers = [...codes];
    powers[powers.indexOf("22023")] = "01062";
    expect(
      deckErrors("nebu", "justice", powers).some(
        (error) =>
          error.includes("The Power of Justice") && error.includes("2"),
      ),
    ).toBe(true);
  });

  it("exposes every exact original source printing in the generic native deck editor", () => {
    const options = deckOptions("nebu", "justice");
    for (const code of Object.keys(source.cards))
      expect(
        options.some((c) => c.code === code),
        code,
      ).toBe(true);
    const markup = renderToStaticMarkup(
      createElement(DeckEditor, {
        initial: {
          id: "nebula",
          name: "Original Justice",
          heroId: "nebu",
          aspect: "justice",
          cards: deckCodes("nebu", "justice"),
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
    expect(markup).toContain("Combat Ready");
    expect(markup).toContain("Evasive Maneuvering");
    expect(markup).not.toContain('aria-label="Copies of Evasive Maneuvering"');
    expect(markup).not.toContain('aria-label="Second aspect"');
    expect(markup).toContain('aria-label="Aspect"');
  });

  it("offers the complete exact source deck as a mission launch through the generic browser", () => {
    const markup = renderToStaticMarkup(
      createElement(ContentBrowser, {
        initialHeroCode: "22001a",
        assignedHeroIds: [],
        onChooseHero: () => {},
        onInspect: () => {},
      }),
    );
    expect(markup).toContain("Choose Nebula for mission");
    expect(markup).toContain(
      "Mission setup will load this exact 40-card source preconstructed list.",
    );
    expect(markup).not.toContain("Choose Nebula with app starter");
    expect(markup).not.toContain("starts in play");
  });
});

describe("Nebula verified printed metadata and current published text", () => {
  it("restores Lethal Weapon's printed +1ATK while preserving its downloaded source", () => {
    const imported = raw("22030"),
      before = structuredClone(imported);
    const corrected = printedCardMetadata(Object.freeze({ ...imported }));
    expect(imported.attack).toBeUndefined();
    expect(corrected).toMatchObject({ attack: 1, boost: 2 });
    expect(card("22030").attack).toBe(1);
    expect(corrected.text).toBe(imported.text);
    expect(corrected.quantity).toBe(imported.quantity);
    expect(corrected.errata).toBeUndefined();
    expect(imported).toEqual(before);
  });

  it("preserves all scan-verified encounter boosts, count and attack-star metadata", () => {
    for (const [code, boost] of [
      ["22027", 2],
      ["22028", 3],
      ["22029", 2],
      ["22030", 2],
      ["22031", 1],
    ] as const)
      expect(card(code).boost).toBe(boost);
    expect(card("22028")).toMatchObject({
      attack: 2,
      attack_star: true,
      scheme: 2,
      health: 6,
    });
    expect(card("22031").quantity).toBe(2);
    expect(heroRuntime("nebu")?.obligationCodes).toEqual(["22027"]);
    expect(heroRuntime("nebu")?.nemesisCodes).toEqual([
      "22028",
      "22029",
      "22030",
      "22031",
    ]);
  });

  it("applies RRG1.8p67 Eros's per-paid-Mental minion selection without rewriting original text", () => {
    const imported = raw("22011");
    expect(imported.text).toContain("confuse a minion for each");
    expect(card("22011").text).toBe(
      "<b>Response:</b> After you play Eros from your hand, for each [mental] resource you used to pay for him, choose a minion and confuse it.",
    );
    expect(card("22011").errata).toMatchObject({
      reference: "FFG Rules Reference 1.8, p. 67",
    });
    expect(card("22011").errata?.url).toContain("#page=67");
    expect(imported.text).not.toContain("choose a minion and confuse it");
    expect(card("22020").text).toBe(raw("22020").text);
    expect(card("22020").text).toContain("a player deck or the encounter deck");
  });

  it("derives Technique and named-character modifiers once and Honorary Guardian health from actual attachments", () => {
    const s = newGame({
      heroId: "nebu",
      aspect: "justice",
      villainId: "rhino",
      seed: 22001,
      pacing: "expert",
    });
    expect(s.error).toBeUndefined();
    s.player.form = "hero";
    s.player.inPlay.push({ ...makePiece(s, "22006"), ownerId: "p1" });
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 2 });
    s.sideSchemes.push(makePiece(s, "22029"));
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 1 });
    const guardian = {
      ...makePiece(s, "22035"),
      ownerId: "p1",
      attachedTo: "hero:p1",
    };
    s.player.inPlay.push(guardian);
    expect(maxHP(s)).toBe(10);
    const ally = { ...makePiece(s, "22002"), ownerId: "p1" };
    s.player.inPlay.push(ally, {
      ...makePiece(s, "22035"),
      ownerId: "p1",
      attachedTo: ally.id,
    });
    expect(pieceHP(s, ally)).toBe(4);
  });
});
