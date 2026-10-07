import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeckEditor } from "../src/account/AccountPage.js";
import type { SavedDeck } from "../src/account/types.js";
import { card, deckCodes } from "../src/game/cards.js";
import { copyLimit, deckErrors, deckOptions } from "../src/game/decks.js";
import { heroRequiredCards } from "../src/game/hero-runtime.js";
import type { Aspect } from "../src/game/types.js";

const savedDeck = (
  heroId = "spider_woman",
  aspect: Aspect = "leadership",
  aspects?: Aspect[],
): SavedDeck => ({
  id: "saved-deck",
  name: "Two-aspect patrol",
  heroId,
  aspect,
  aspects,
  cards: deckCodes(heroId, aspect, aspects || ["leadership", "protection"]),
  revision: 1,
  updatedAt: "2026-10-05T12:00:00Z",
});

const render = (initial: SavedDeck) =>
  renderToStaticMarkup(
    createElement(DeckEditor, {
      initial,
      busy: false,
      error: "",
      onSave: () => {},
      onCancel: () => {},
    }),
  );

function selectedOption(html: string, label: string) {
  const select = new RegExp(`<label>${label}<select[^>]*>(.*?)</select>`).exec(
    html,
  )?.[1];
  expect(select, `Missing ${label} selector`).toBeDefined();
  return /<option value="([^"]+)" selected=""/.exec(select!)?.[1];
}

describe("saved deck editor", () => {
  it("infers a legacy Spider-Woman Leadership/Protection pair and exposes both pools", () => {
    const html = render(savedDeck());
    expect(selectedOption(html, "Aspect")).toBe("leadership");
    expect(selectedOption(html, "Second aspect")).toBe("protection");
    expect(html).toContain("<h3>LEADERSHIP</h3>");
    expect(html).toContain("<h3>PROTECTION</h3>");
    expect(html).not.toContain("<h3>AGGRESSION</h3>");
    expect(html).not.toContain("<h3>JUSTICE</h3>");
    expect(html).toContain('aria-label="Copies of Vision"');
    expect(html).toContain('aria-label="Copies of Med Team"');
    expect(html).toContain("Deck ready. All card and copy limits are valid.");
  });

  it.each([
    ["aggression", "justice"],
    ["leadership", "protection"],
  ] as [Aspect, Aspect][])(
    "keeps all 15 required cards visible and locked for %s/%s, including other colors",
    (primary, secondary) => {
      const html = render(
        savedDeck("spider_woman", primary, [primary, secondary]),
      );
      const heroSection = /<section><h3>HERO<\/h3>(.*?)<\/section>/.exec(
        html,
      )?.[1];
      expect(heroSection).toBeDefined();
      const required = heroRequiredCards("spider_woman");
      expect(
        Object.values(required).reduce((total, count) => total + count, 0),
      ).toBe(15);
      for (const [code, count] of Object.entries(required)) {
        const row = new RegExp(
          `<div class="account-card-row"><span data-card-preview="${code}"[^>]*>(.*?)</div>`,
        ).exec(heroSection!)?.[1];
        expect(row, `Missing required ${card(code).name}`).toBeDefined();
        expect(row).toContain(
          `<strong class="account-fixed-count">×${count}</strong>`,
        );
        expect(row).not.toContain("<select");
        expect(
          html.match(new RegExp(`data-card-preview="${code}"`, "g")),
        ).toHaveLength(1);
      }
    },
  );

  it("honors stored aspect metadata when an all-basic customizable pool cannot prove the pair", () => {
    const deck = savedDeck("spider_woman", "leadership", [
      "leadership",
      "protection",
    ]);
    deck.cards = Object.entries(heroRequiredCards(deck.heroId)).flatMap(
      ([code, count]) => Array<string>(count).fill(code),
    );
    const titles = new Set<string>();
    const basics = deckOptions(deck.heroId, deck.aspect, deck.aspects)
      .filter((c) => {
        if (c.faction_code !== "basic" || titles.has(c.name)) return false;
        titles.add(c.name);
        return true;
      })
      .flatMap((c) => Array<string>(copyLimit(c)).fill(c.code));
    deck.cards.push(...basics.slice(0, 25));
    expect(
      deckErrors(deck.heroId, deck.aspect, deck.cards, deck.aspects),
    ).toEqual([]);
    const html = render(deck);
    expect(selectedOption(html, "Second aspect")).toBe("protection");
    expect(html).toContain("Deck ready. All card and copy limits are valid.");
  });

  it("keeps a single aspect selector for ordinary heroes and locks their signatures", () => {
    const deck = savedDeck("hawkeye", "leadership", ["leadership"]);
    const html = render(deck);
    expect(selectedOption(html, "Aspect")).toBe("leadership");
    expect(html).not.toContain("Second aspect");
    expect(html.match(/<h3>/g)).toHaveLength(3);
    const heroSection = /<section><h3>HERO<\/h3>(.*?)<\/section>/.exec(
      html,
    )?.[1];
    expect(heroSection).toBeDefined();
    expect(heroSection).not.toContain("<select");
    for (const code of Object.keys(heroRequiredCards("hawkeye"))) {
      expect(heroSection).toContain(`data-card-preview="${code}"`);
    }
  });
  it("shows Gamora's source off-aspect events with one chosen aspect and a six-event allowance", () => {
    const html = render(savedDeck("gam", "aggression", ["aggression"]));
    expect(selectedOption(html, "Aspect")).toBe("aggression");
    expect(html).not.toContain("Second aspect");
    expect(html).toContain("up to 6 Attack or Thwart events from other");
    expect(html).toContain("6 / 6 selected.");
    expect(html).toContain("<h3>PROTECTION</h3>");
    expect(html).toContain("<h3>JUSTICE</h3>");
    expect(html).toContain('aria-label="Copies of First Hit"');
    expect(html).toContain('aria-label="Copies of Impede"');
    expect(html).toContain('aria-label="Copies of For Justice!"');
    expect(html).toContain('aria-label="Copies of Counter-Punch"');
    expect(html).not.toContain('aria-label="Copies of Heroic Intuition"');
    expect(html).toContain("Deck ready. All card and copy limits are valid.");
  });
  it("counts Gamora's off-aspect copies while leaving her chosen-aspect events outside the allowance", () => {
    const deck = savedDeck("gam", "aggression", ["aggression"]);
    deck.cards.push("17028");
    expect(render(deck)).toContain("6 / 6 selected.");
    deck.cards.push("01060");
    const html = render(deck);
    expect(html).toContain("7 / 6 selected.");
    expect(html).toContain("at most 6 off-aspect Attack/Thwart events");
    expect(html).toContain('<button class="primary-button" disabled="">');
  });
});
