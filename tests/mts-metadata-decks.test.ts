import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeckEditor } from "../src/account/AccountPage.js";
import { ContentBrowser } from "../src/ContentBrowser.js";
import { card, deckCodes } from "../src/game/cards.js";
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
import {
  heroDeckAspects,
  heroRequiredCards,
  heroRuntime,
  heroSetupCards,
  heroStarterAspects,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { hasCoreScript, rulesCode } from "../src/game/rules-code.js";
import { newGame } from "../src/game/engine.js";
import type { Aspect } from "../src/game/types.js";

const aspects: Aspect[] = ["aggression", "justice", "leadership", "protection"];
const source = (heroCode: string) =>
  STARTER_DECKS.find(
    (d) => d.heroCode === heroCode && d.sourceType === "source-preconstructed",
  )!;
const editor = (heroId: string, aspect: Aspect) =>
  renderToStaticMarkup(
    createElement(DeckEditor, {
      initial: {
        id: "mts",
        name: "Original source",
        heroId,
        aspect,
        cards: deckCodes(heroId, aspect),
        revision: 1,
        updatedAt: "2026-10-07T00:00:00Z",
      },
      busy: false,
      error: "",
      onSave: () => {},
      onCancel: () => {},
    }),
  );

describe("Mad Titan's Shadow identity metadata and native deck composition", () => {
  it("uses actual catalog identities and both printed faces", () => {
    for (const [id, code, alter] of [
      ["spectrum", "21001a", "21001b"],
      ["warlock", "21031a", "21031b"],
    ] as const) {
      expect(CATALOG_HEROES.find((h) => h.id === id)).toMatchObject({
        code,
        alter,
        automated: true,
      });
      expect(heroRuntime(alter)?.id).toBe(id);
      expect(heroRuntime(id)?.identityCodes).toEqual([code, alter]);
    }
    expect(card("21001a")).toMatchObject({
      health: 11,
      attack: 1,
      thwart: 1,
      defense: 1,
      hand_size: 5,
    });
    expect(card("21031a")).toMatchObject({
      health: 11,
      attack: 1,
      thwart: 1,
      defense: 2,
      hand_size: 5,
    });
    for (const code of ["21001b", "21031b"])
      expect(card(code)).toMatchObject({ recover: 3, hand_size: 6 });
  });
  it("preserves Spectrum's original43 physical player cards with three Permanent setup forms outside40", () => {
    const deck = source("21001a"),
      codes = deckCodes("spectrum", "leadership");
    expect(countsFor(codes)).toEqual(deck.cards);
    expect(codes).toHaveLength(43);
    expect(deckSizeFor(codes)).toBe(40);
    expect(heroSetupCards("spectrum")).toEqual({
      "21002": 1,
      "21003": 1,
      "21004": 1,
    });
    expect(validateHeroDeck("spectrum", ["leadership"], codes)).toMatchObject({
      valid: true,
      deckSize: 40,
      compositionSize: 43,
    });
    expect(deckErrors("spectrum", "leadership", codes)).toEqual([]);
    expect(
      Object.values(heroRequiredCards("spectrum")).reduce((a, b) => a + b, 0),
    ).toBe(18);
  });
  it.each(aspects)(
    "retains all three physical setup forms outside the opening deck for %s",
    (aspect) => {
      const codes = deckCodes("spectrum", aspect);
      expect(deckSizeFor(codes)).toBe(40);
      expect(codes).toHaveLength(43);
      expect(deckErrors("spectrum", aspect, codes)).toEqual([]);
      const s = newGame({
        heroId: "spectrum",
        aspect,
        villainId: "rhino",
        seed: 21002,
      });
      const source = [...s.player.deck, ...s.player.hand, ...s.player.inPlay];
      expect(source).toHaveLength(43);
      expect(new Set(source.map((p) => p.id)).size).toBe(43);
      expect(s.player.hand).toHaveLength(6);
      expect(s.player.deck).toHaveLength(34);
      for (const code of Object.keys(heroSetupCards("spectrum"))) {
        expect(codes.filter((c) => c === code)).toHaveLength(1);
        expect(s.player.inPlay.filter((p) => p.code === code)).toHaveLength(1);
        expect(
          [...s.player.deck, ...s.player.hand].some((p) => p.code === code),
        ).toBe(false);
      }
    },
  );
  it("rejects a missing or duplicated locked Permanent form", () => {
    const codes = deckCodes("spectrum", "leadership");
    expect(
      deckErrors(
        "spectrum",
        "leadership",
        codes.filter((c) => c !== "21002"),
      ),
    ).toContain("Include exactly 1 Gamma from the hero’s signature set.");
    expect(deckErrors("spectrum", "leadership", [...codes, "21002"])).toContain(
      "Include exactly 1 Gamma from the hero’s signature set.",
    );
  });
  it("preserves Warlock's exact40 source with six cards from every aspect", () => {
    const codes = deckCodes("warlock", "aggression");
    expect(countsFor(codes)).toEqual(source("21031a").cards);
    expect(codes).toHaveLength(40);
    expect(heroStarterAspects("warlock")).toEqual(aspects);
    expect(heroDeckAspects("warlock", codes, "justice")).toEqual(aspects);
    expect(deckErrors("warlock", "aggression", codes)).toEqual([]);
    expect(deckErrors("warlock", "justice", codes, aspects)).toEqual([]);
    for (const aspect of aspects)
      expect(codes.filter((c) => card(c).faction_code === aspect)).toHaveLength(
        6,
      );
    expect(
      Object.values(heroRequiredCards("warlock")).reduce((a, b) => a + b, 0),
    ).toBe(15);
  });
  it("rejects unequal colors and any explicit aspect list that omits one of four", () => {
    const codes = deckCodes("warlock", "aggression");
    const changed = [...codes];
    changed[changed.indexOf("21065")] = "01050";
    expect(
      deckErrors("warlock", "aggression", changed).some((e) =>
        e.includes("equal number"),
      ),
    ).toBe(true);
    expect(
      deckErrors("warlock", "aggression", codes, ["aggression", "justice"]),
    ).toEqual([
      "Choose distinct supported aspects, including the primary aspect.",
    ]);
  });
  it("enforces non-signature singleton limits across physical reprints while preserving multi-copy signatures", () => {
    const codes = deckCodes("warlock", "aggression"),
      changed = [...codes];
    changed[changed.indexOf("21065")] = "01057";
    expect(deckErrors("warlock", "aggression", changed)).toContain(
      "Combat Training has 2 copies; its deck limit is 1.",
    );
    expect(copyLimit(card("21045"), "warlock")).toBe(1);
    expect(copyLimit(card("01057"), "warlock")).toBe(1);
    expect(codes.filter((c) => c === "21038")).toHaveLength(3);
    expect(deckErrors("warlock", "aggression", codes)).toEqual([]);
  });
  it("exposes all four automatically selected Warlock pools and the fixed signatures", () => {
    const options = deckOptions("warlock", "aggression");
    for (const code of Object.keys(source("21031a").cards))
      expect(
        options.some((c) => c.code === code),
        code,
      ).toBe(true);
    const markup = editor("warlock", "aggression");
    expect(markup).toContain("All four aspects");
    expect(markup).not.toContain('aria-label="Second aspect"');
    expect(markup).not.toContain('aria-label="Aspect"');
    expect(markup).toContain("Aggression 6");
    expect(markup).toContain("Protection 6");
    expect(markup).toContain("only one copy");
    expect(markup).toContain("40 / 50 cards");
  });
  it("shows Spectrum's playing deck size and locked setup rows separately", () => {
    const markup = editor("spectrum", "leadership");
    expect(markup).toContain("40 / 50 cards");
    expect(markup).toContain("3 Permanent setup cards");
    for (const name of ["Gamma", "Photon", "Pulsar"]) {
      expect(markup).toContain(name);
      expect(markup).not.toContain(`aria-label="Copies of ${name}"`);
    }
    expect(markup).toContain("starts in play");
    expect(catalogDeckCodes(source("21001a"))).toHaveLength(43);
  });
  it.each([
    ["21001a", "Spectrum"],
    ["21031a", "Adam Warlock"],
  ])("offers the actual source launch for %s", (code, name) => {
    const markup = renderToStaticMarkup(
      createElement(ContentBrowser, {
        initialHeroCode: code,
        assignedHeroIds: [],
        onChooseHero: () => {},
        onInspect: () => {},
      }),
    );
    expect(markup).toContain(`Choose ${name} for mission`);
    expect(markup).toContain(
      "Mission setup will load this exact 40-card source preconstructed list.",
    );
    expect(markup).not.toContain(`Choose ${name} with app starter`);
    if (code === "21001a") {
      expect(markup).toContain(
        "43 cards in the starter composition, including 3 that start in play.",
      );
      expect(markup).toContain("STARTS IN PLAY · 3");
    } else
      expect(markup).toContain(
        "aggression / justice / leadership / protection",
      );
  });
  it("distinguishes twelve exact Core aliases from two physical native expansion reprints", () => {
    for (const [physical, canonical] of [
      ["21021", "01091"],
      ["21023", "01088"],
      ["21024", "01089"],
      ["21025", "01090"],
      ["21044", "01054"],
      ["21045", "01057"],
      ["21049", "01060"],
      ["21051", "01065"],
      ["21056", "01071"],
      ["21057", "01074"],
      ["21062", "01077"],
      ["21063", "01081"],
    ]) {
      expect(rulesCode(physical)).toBe(canonical);
      expect(hasCoreScript(physical)).toBe(true);
    }
    for (const code of ["21017", "21020"]) {
      expect(rulesCode(code)).toBe(code);
      expect(hasCoreScript(code)).toBe(false);
    }
  });
});
