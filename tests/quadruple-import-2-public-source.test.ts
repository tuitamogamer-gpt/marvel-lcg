import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentBrowser } from "../src/ContentBrowser.js";
import { CATALOG_HEROES } from "../src/game/catalog.js";

const renderSource = (code: string) =>
  renderToStaticMarkup(
    createElement(ContentBrowser, {
      initialHeroCode: code,
      assignedHeroIds: [],
      onChooseHero: () => {},
      onInspect: () => {},
    }),
  );

describe("second four-pack source launch through the public catalog", () => {
  it.each([
    ["37001a", "Gambit", 40],
    ["38001a", "Rogue", 41],
    ["41001a", "Psylocke", 40],
    ["42001a", "Angel", 40],
  ] as const)(
    "offers the exact native original source for %s",
    (code, name, size) => {
      const markup = renderSource(code);
      expect(markup).toContain(`Choose ${name} for mission`);
      expect(markup).toContain(
        `Mission setup will load this exact ${size}-card source preconstructed list.`,
      );
      expect(markup).not.toContain(`Choose ${name} with app starter`);
    },
  );

  it("explains that Rogue's Touched counts and is set aside after the mulligan", () => {
    const markup = renderSource("38001a");
    expect(markup).toContain("Touched counts toward your deck size.");
    expect(markup).toContain("41 cards in deck");
    expect(markup).not.toContain("STARTS IN PLAY");
  });

  it("keeps Psylocke's two physical Psi-Energy cards outside the 40-card count", () => {
    const markup = renderSource("41001a");
    expect(markup).toContain("42 cards in the starter composition");
    expect(markup).toContain("including 2 that start in play");
    expect(markup).toContain(
      "enter play Psi-Knife side up after your mulligan",
    );
  });

  it("rejects a source with a missing physical Psylocke Permanent", () => {
    const source = CATALOG_HEROES.find((hero) => hero.id === "psylocke")!
      .decks[0];
    const original = source.setupCards;
    try {
      source.setupCards = { "41002a": 1 };
      const markup = renderSource("41001a");
      expect(markup).toContain("Choose Psylocke with app starter");
      expect(markup).toContain(
        "This list requires additional setup or special decks.",
      );
      expect(markup).not.toContain("Choose Psylocke for mission");
    } finally {
      source.setupCards = original;
    }
  });

  it("rejects an encounter scheme substituted for the supported player side scheme", () => {
    const source = CATALOG_HEROES.find((hero) => hero.id === "psylocke")!
      .decks[0];
    const original = source.cards;
    try {
      source.cards = { ...original, "01097": 1 };
      delete source.cards["41016"];
      const markup = renderSource("41001a");
      expect(markup).toContain("Choose Psylocke with app starter");
      expect(markup).not.toContain("Choose Psylocke for mission");
    } finally {
      source.cards = original;
    }
  });

  it("offers all three of Angel's printed identity faces", () => {
    const markup = renderSource("42001a");
    expect(markup).toContain('value="42001a"');
    expect(markup).toContain('value="42001b"');
    expect(markup).toContain('value="42001c"');
    expect(markup).toContain("Archangel");
  });
});
