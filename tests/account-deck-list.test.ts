import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeckEditor } from "../src/account/AccountPage.js";
import {
  deckSummary,
  formatDeckList,
  groupPrintings,
  parseDeckList,
  setRowCount,
} from "../src/account/deck-list.js";
import { card, deckCodes } from "../src/game/cards.js";
import { deckErrors, deckOptions } from "../src/game/decks.js";
import { heroRequiredCards } from "../src/game/hero-runtime.js";

const options = deckOptions("spider_man", "justice");
const required = heroRequiredCards("spider_man");
const starter = deckCodes("spider_man", "justice");

describe("deck builder printings", () => {
  it("lists every reprint of a card once", () => {
    const rows = groupPrintings(options);
    const energy = rows.filter((row) => row.card.name === "Energy");
    expect(energy).toHaveLength(1);
    expect(energy[0].card.code).toBe("01088");
    expect(energy[0].codes.length).toBeGreaterThan(10);
    expect(rows.length).toBeLessThan(options.length);
    // Different cards that share a title keep separate rows.
    expect(
      rows.filter((row) => row.card.name === "Spider-Woman").length,
    ).toBeLessThanOrEqual(
      options.filter((c) => c.name === "Spider-Woman").length,
    );
  });

  it("changes a row without swapping printings already in the deck", () => {
    const row = groupPrintings(options).find(
      (r) => r.card.name === "For Justice!",
    )!;
    const reprint = row.codes.find((code) => code !== row.card.code)!;
    const base = ["x", reprint, "y"];
    expect(setRowCount(base, row, 3)).toEqual([
      "x",
      "y",
      reprint,
      row.card.code,
      row.card.code,
    ]);
    expect(setRowCount(base, row, 1)).toEqual(["x", "y", reprint]);
    expect(setRowCount(base, row, 0)).toEqual(["x", "y"]);
  });

  it("renders one Energy selector limited to its printed one copy", () => {
    const html = renderToStaticMarkup(
      createElement(DeckEditor, {
        busy: false,
        error: "",
        onSave: () => {},
        onCancel: () => {},
      }),
    );
    expect(html.match(/aria-label="Copies of Energy"/g)).toHaveLength(1);
    const select = /aria-label="Copies of Energy"[^>]*>(.*?)<\/select>/.exec(
      html,
    )![1];
    expect(select.match(/<option/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Deck at a glance"');
    expect(html).not.toContain("cost -1");
  });
});

describe("deck summary", () => {
  it("counts the playing deck's curve, types and printed resources", () => {
    const summary = deckSummary(starter);
    const curved = Object.values(summary.curve).reduce((a, b) => a + b, 0);
    const typed = summary.types.reduce((a, t) => a + t.count, 0);
    expect(typed).toBe(40);
    expect(curved).toBe(
      starter.filter((code) => card(code).cost !== undefined).length,
    );
    expect(summary.types[0].label).toBe("Ally");
    expect(summary.averageCost).toBeGreaterThan(0);
    expect(summary.resources.energy).toBeGreaterThan(0);
    expect(deckSummary([]).averageCost).toBeNull();
  });
});

describe("plain-text deck lists", () => {
  it("round-trips the starter deck", () => {
    const text = formatDeckList({
      name: "Queens patrol",
      heading: "Spider-Man (Peter Parker) · Justice",
      codes: starter,
    });
    expect(text.split("\n")[0]).toBe("Queens patrol");
    expect(text).toContain("3x Swinging Web Kick (Core Set)");
    const parsed = parseDeckList(text, {
      heroId: "spider_man",
      options,
      fixed: required,
    });
    expect(parsed.unknown).toEqual([]);
    expect(parsed.unavailable).toEqual([]);
    expect(parsed.limited).toEqual([]);
    const rebuilt = [
      ...starter.filter((code) => Object.hasOwn(required, code)),
      ...parsed.codes,
    ];
    expect(rebuilt.length).toBe(starter.length);
    expect(deckErrors("spider_man", "justice", rebuilt)).toEqual([]);
  });

  it("reads loose lines, keeps limits and reports what it skipped", () => {
    const parsed = parseDeckList(
      [
        "Hero: Spider-Man",
        "Allies (3)",
        "2 x Mockingbird",
        "1 nick fury (core set)",
        "3x For Justice!",
        "2× For Justice!",
        "1x Wakanda Forever!",
        "1x Definitely Not A Card",
        "2x Backflip",
        "",
      ].join("\n"),
      { heroId: "spider_man", options, fixed: required },
    );
    expect(parsed.codes.filter((c) => card(c).name === "Mockingbird")).toEqual([
      "01083",
    ]);
    expect(parsed.codes.filter((c) => card(c).name === "Nick Fury")).toEqual([
      "01084",
    ]);
    expect(
      parsed.codes.filter((c) => card(c).name === "For Justice!"),
    ).toHaveLength(3);
    expect(parsed.limited).toEqual([
      "Mockingbird (max 1)",
      "For Justice! (max 3)",
    ]);
    expect(parsed.unavailable).toEqual(["Wakanda Forever!"]);
    expect(parsed.unknown).toEqual(["Definitely Not A Card"]);
    // Backflip is a fixed Spider-Man card: it stays as the deck has it.
    expect(parsed.fixed).toBe(1);
    expect(parsed.codes.some((c) => card(c).name === "Backflip")).toBe(false);
  });
});
