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
import { printedCardMetadata } from "../src/game/printed-card-metadata.js";
import { hasCoreScript, rulesCode } from "../src/game/rules-code.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import {
  WAR_MACHINE_SCRIPT_CODES,
  warMachineInitializeNemesis,
} from "../src/game/war-machine.js";
import {
  WAR_MACHINE_PACK_CORE_ALIASES,
  WAR_MACHINE_PACK_SCRIPT_CODES,
} from "../src/game/war-machine-pack.js";
import type { Card } from "../src/game/types.js";

const source = STARTER_DECKS.find((d) => d.id === "starter-23001a")!;
const raw = (code: string) => catalog.find((c) => c.code === code)! as Card;
const aliases = {
  "23020": "01071",
  "23022": "01083",
  "23025": "01088",
  "23026": "01089",
  "23027": "01090",
};
const game = () =>
  newGame({
    heroId: "warm",
    aspect: "leadership",
    villainId: "rhino",
    seed: 23001,
    pacing: "expert",
  });

describe("War Machine's original retail metadata and source deck", () => {
  it("registers canonical warm and the two actual identity faces", () => {
    expect(SCRIPTED_HERO_IDS.has("warm")).toBe(true);
    expect(SCRIPTED_HERO_IDS.has("wmach")).toBe(false);
    expect(CATALOG_HEROES.find((h) => h.id === "warm")).toMatchObject({
      code: "23001a",
      alter: "23001b",
      automated: true,
    });
    for (const id of ["warm", "warm:warm", "23001a", "23001b"])
      expect(heroRuntime(id)?.id).toBe("warm");
    expect(heroRuntime("wmach")).toBeUndefined();
    expect(heroRuntime("warm")?.identityCodes).toEqual(["23001a", "23001b"]);
    expect(card("23001a")).toMatchObject({
      attack: 2,
      thwart: 1,
      defense: 2,
      health: 10,
      hand_size: 5,
    });
    expect(card("23001b")).toMatchObject({
      recover: 3,
      health: 10,
      hand_size: 6,
    });
    expect(heroSetupCards("warm")).toEqual({});
    expect(heroStarterAspects("warm")).toEqual(["leadership"]);
  });

  it("preserves the exact 15-signature +19Leadership +6Basic forty-card original list", () => {
    const codes = deckCodes("warm", "leadership");
    expect(countsFor(codes)).toEqual(source.cards);
    expect(codes).toEqual(catalogDeckCodes(source));
    expect(codes).toHaveLength(40);
    expect(deckSizeFor(codes)).toBe(40);
    expect(codes.every((code) => code.startsWith("23"))).toBe(true);
    expect(codes.filter((code) => card(code).set_code === "warm")).toHaveLength(
      15,
    );
    expect(
      codes.filter((code) => card(code).faction_code === "leadership"),
    ).toHaveLength(19);
    expect(
      codes.filter((code) => card(code).faction_code === "basic"),
    ).toHaveLength(6);
    expect(heroRequiredCards("warm")).toEqual({
      "23002": 1,
      "23003": 1,
      "23004": 1,
      "23005": 2,
      "23006": 1,
      "23007": 1,
      "23008": 2,
      "23009": 2,
      "23010": 2,
      "23011": 2,
    });
    expect(deckErrors("warm", "leadership", codes)).toEqual([]);
    expect(validateHeroDeck("warm", ["leadership"], codes)).toMatchObject({
      valid: true,
      deckSize: 40,
      compositionSize: 40,
    });
  });

  it("accounts for all36 retail faces through16 identity,15 dedicated pool and5 exactCore aliases", () => {
    const retail = catalog.filter((c) => c.pack_code === "warm");
    expect(retail).toHaveLength(36);
    expect(WAR_MACHINE_SCRIPT_CODES).toHaveLength(16);
    expect(WAR_MACHINE_PACK_SCRIPT_CODES).toHaveLength(15);
    expect(WAR_MACHINE_PACK_CORE_ALIASES).toHaveLength(5);
    const supported = [
      ...WAR_MACHINE_SCRIPT_CODES,
      ...WAR_MACHINE_PACK_SCRIPT_CODES,
      ...WAR_MACHINE_PACK_CORE_ALIASES,
    ];
    expect(new Set(supported).size).toBe(36);
    expect([...supported].sort()).toEqual(retail.map((c) => c.code).sort());
    for (const code of [
      ...WAR_MACHINE_SCRIPT_CODES,
      ...WAR_MACHINE_PACK_SCRIPT_CODES,
    ]) {
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
      expect(hasExecutableScript(code), code).toBe(true);
      expect(hasCoreScript(code), code).toBe(false);
    }
    for (const [code, core] of Object.entries(aliases)) {
      expect(rulesCode(code), code).toBe(core);
      expect(hasCoreScript(code), code).toBe(true);
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(false);
      expect(card(code).code).toBe(code);
    }
    for (const code of ["23014", "23015", "23021", "23023"])
      expect(rulesCode(code), code).toBe(code);
  });

  it.each(["aggression", "justice", "leadership", "protection"] as const)(
    "keeps the exact required signatures in a legal %s starter",
    (aspect) => {
      const codes = deckCodes("warm", aspect);
      expect(deckSizeFor(codes)).toBe(40);
      expect(deckErrors("warm", aspect, codes)).toEqual([]);
      for (const [code, quantity] of Object.entries(heroRequiredCards("warm")))
        expect(
          codes.filter((c) => c === code),
          code,
        ).toHaveLength(quantity);
    },
  );

  it("requires the exact signature counts and one selected aspect", () => {
    const codes = deckCodes("warm", "leadership");
    expect(
      deckErrors(
        "warm",
        "leadership",
        codes.filter((c) => c !== "23006"),
      ),
    ).toContain(
      "Include exactly 1 Missile Launcher from the hero’s signature set.",
    );
    expect(deckErrors("warm", "leadership", [...codes, "23005"])).toContain(
      "Include exactly 2 Gauntlet Gun from the hero’s signature set.",
    );
    expect(
      validateHeroDeck("warm", ["leadership", "justice"], codes).errors,
    ).toContain("Choose exactly one aspect for this hero.");
  });

  it("enforces printed limits across actual reprints and excludes the matching identity ally", () => {
    const codes = deckCodes("warm", "leadership");
    for (const code of ["23021", "23024", "23025", "23026", "23027"])
      expect(copyLimit(card(code), "warm"), code).toBe(1);
    expect(copyLimit(card("23033"), "warm")).toBe(2);
    for (const code of ["21058", "03011", "04013", "08023", "01088", "23024"]) {
      const errors = deckErrors("warm", "leadership", [...codes, code]);
      expect(
        errors.some((e) => e.includes(card(code).name) && e.includes("1")),
        code,
      ).toBe(true);
    }
    const options = deckOptions("warm", "leadership");
    expect(options.some((c) => c.code === "04020")).toBe(false);
    expect(
      validateHeroDeck("warm", ["leadership"], [...codes, "04020"]).errors.some(
        (e) => e.includes("War Machine") && e.includes("identity"),
      ),
    ).toBe(true);
    expect(
      deckErrors("warm", "leadership", [...codes, "09039"]).some(
        (e) => e.includes("Iron Man") && e.includes("1"),
      ),
    ).toBe(true);
  });

  it("shows exact original printings and locks required signatures in the native deck editor", () => {
    const options = deckOptions("warm", "leadership");
    for (const code of Object.keys(source.cards))
      expect(
        options.some((c) => c.code === code),
        code,
      ).toBe(true);
    const markup = renderToStaticMarkup(
      createElement(DeckEditor, {
        initial: {
          id: "war-machine",
          name: "Original Leadership",
          heroId: "warm",
          aspect: "leadership",
          cards: deckCodes("warm", "leadership"),
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
    expect(markup).toContain("Missile Launcher");
    expect(markup).toContain("Gauntlet Gun");
    expect(markup).not.toContain('aria-label="Copies of Missile Launcher"');
    expect(markup).not.toContain('aria-label="Second aspect"');
    expect(markup).toContain('aria-label="Aspect"');
  });

  it("offers the complete original source deck through the generic collection browser", () => {
    const markup = renderToStaticMarkup(
      createElement(ContentBrowser, {
        initialHeroCode: "23001a",
        assignedHeroIds: [],
        onChooseHero: () => {},
        onInspect: () => {},
      }),
    );
    expect(markup).toContain("Choose War Machine for mission");
    expect(markup).toContain(
      "Mission setup will load this exact 40-card source preconstructed list.",
    );
    expect(markup).not.toContain("Choose War Machine with app starter");
    expect(markup).not.toContain("starts in play");
  });

  it("creates forty distinct owned player pieces and exactly five distinct physical nemesis cards", () => {
    const s = game();
    expect(s.error).toBeUndefined();
    const playing = [
      ...s.player.hand,
      ...s.player.deck,
      ...s.player.discard,
      ...s.player.inPlay,
    ];
    expect(playing).toHaveLength(40);
    expect(new Set(playing.map((p) => p.id)).size).toBe(40);
    expect(countsFor(playing.map((p) => p.code))).toEqual(source.cards);
    expect(playing.every((p) => p.ownerId === "p1")).toBe(true);
    warMachineInitializeNemesis(s, { makePiece });
    expect(s.player.setAside?.map((p) => p.code)).toEqual([
      "23029",
      "23030",
      "23031",
      "23031",
      "23031",
    ]);
    expect(new Set(s.player.setAside?.map((p) => p.id)).size).toBe(5);
    const saved = JSON.parse(JSON.stringify(s));
    const ids = saved.player.setAside.map((p: { id: string }) => p.id);
    warMachineInitializeNemesis(saved, { makePiece });
    expect(saved.player.setAside.map((p: { id: string }) => p.id)).toEqual(ids);
    saved.player.setAside = [];
    warMachineInitializeNemesis(saved, { makePiece });
    expect(saved.player.setAside).toEqual([]);
    expect(heroRuntime("warm")?.obligationCodes).toEqual(["23028"]);
    expect(heroRuntime("warm")?.nemesisCodes).toEqual([
      "23029",
      "23030",
      "23031",
    ]);
  });
});

describe("War Machine's scan-verified printed metadata", () => {
  it("preserves THREE Deadly Light Show numeric boosts and ONE Laser Strike boost plus its separate star", () => {
    for (const [code, boost] of [
      ["23028", 2],
      ["23029", 2],
      ["23030", 3],
      ["23031", 1],
    ] as const) {
      const imported = raw(code),
        before = structuredClone(imported);
      const runtime = printedCardMetadata(Object.freeze({ ...imported }));
      expect(imported.boost, code).toBe(boost);
      expect(runtime.boost, code).toBe(boost);
      expect(card(code).boost, code).toBe(boost);
      expect(runtime.text).toBe(imported.text);
      expect(imported).toEqual(before);
    }
    expect(card("23031")).toMatchObject({
      boost: 1,
      boost_star: true,
      quantity: 3,
    });
    expect(card("23030")).toMatchObject({ boost: 3, quantity: 1 });
  });

  it("keeps earlier verified Drax and Nebula numeric corrections without rewriting imports", () => {
    for (const [code, boost] of [
      ["19025", 2],
      ["19026", 2],
      ["19027", 3],
      ["19028", 1],
      ["19029", 2],
    ] as const)
      expect(card(code).boost, code).toBe(boost);
    expect(card("19028").attack).toBe(2);
    expect(raw("22030").attack).toBeUndefined();
    expect(card("22030")).toMatchObject({ attack: 1, boost: 2 });
  });

  it("derives Aerial from active Upgraded Chassis only in hero form, preserving printed stats", () => {
    const s = game();
    s.player.form = "hero";
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 1, defense: 2 });
    expect(maxHP(s)).toBe(10);
    expect(aerial(s)).toBe(false);
    s.player.inPlay.push({ ...makePiece(s, "23004"), ownerId: "p1" });
    expect(aerial(s)).toBe(true);
    s.sideSchemes.push(makePiece(s, "12026"));
    expect(aerial(s)).toBe(false);
    s.sideSchemes = [];
    s.player.form = "alter";
    expect(aerial(s)).toBe(false);
  });
});
