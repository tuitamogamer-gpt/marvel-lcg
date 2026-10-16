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

describe("original four-pack source launch through the public catalog", () => {
  it.each([
    ["33001a", "Cyclops"],
    ["34001a", "Phoenix"],
    ["35001a", "Wolverine"],
    ["36001a", "Storm"],
  ])("offers the exact native original source for %s", (code, name) => {
    const markup = renderSource(code);
    expect(markup).toContain(`Choose ${name} for mission`);
    expect(markup).toContain(
      "Mission setup will load this exact 40-card source preconstructed list.",
    );
    expect(markup).not.toContain(`Choose ${name} with app starter`);
  });

  it("keeps Cyclops's actual off-aspect X-Men validation in the source gate", () => {
    const source = CATALOG_HEROES.find((hero) => hero.id === "cyclops")!
      .decks[0];
    const original = source.cards;
    try {
      // Replace Justice X-Men ally Blindfold with Justice ally Daredevil.
      // The same 40-card mixed source is illegal without the X-Men trait.
      source.cards = { ...original, "01058": 1 };
      delete source.cards["33014"];
      const markup = renderSource("33001a");
      expect(markup).toContain("Choose Cyclops with app starter");
      expect(markup).toContain("The displayed source list cannot launch yet.");
      expect(markup).not.toContain("Choose Cyclops for mission");
    } finally {
      source.cards = original;
    }
  });
});
