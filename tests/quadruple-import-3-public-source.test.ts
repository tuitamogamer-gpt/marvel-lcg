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

describe("third four-pack source launch through the public catalog", () => {
  it.each([
    ["40001a", "Cable", 40],
    ["40037a", "Domino", 40],
    ["43001a", "X-23", 40],
    ["44001a", "Deadpool", 40],
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

  it("rejects an X-23 source missing its physical Permanent Claws", () => {
    const source = CATALOG_HEROES.find((hero) => hero.id === "x23")!.decks[0];
    const original = source.cards;
    try {
      source.cards = { ...original };
      delete source.cards["43002"];
      const markup = renderSource("43001a");
      expect(markup).toContain("Choose X-23 with app starter");
      expect(markup).not.toContain("Choose X-23 for mission");
    } finally {
      source.cards = original;
    }
  });
});
