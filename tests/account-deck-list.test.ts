import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeckEditor } from "../src/account/AccountPage.js";
import {
  deckSummary,
  fetchMarvelCdbDeck,
  formatDeckList,
  groupPrintings,
  importSlots,
  marvelCdbLink,
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

// The published Core Set Black Panther starter (MarvelCDB decklist 1).
const blackPantherStarter = {
  id: 1,
  name: "Black Panther - Protection - Starter Deck",
  hero_code: "01040a",
  hero_name: "Black Panther",
  meta: '{"aspect":"protection"}',
  slots: {
    "01041": 1,
    "01042": 1,
    "01043a": 1,
    "01043b": 1,
    "01043c": 1,
    "01043d": 2,
    "01044": 3,
    "01045": 1,
    "01046": 1,
    "01047": 1,
    "01048": 1,
    "01049": 1,
    "01075": 1,
    "01076": 1,
    "01077": 2,
    "01078": 2,
    "01079": 2,
    "01080": 2,
    "01081": 2,
    "01082": 2,
    "01083": 1,
    "01084": 1,
    "01085": 1,
    "01086": 1,
    "01087": 1,
    "01088": 1,
    "01089": 1,
    "01090": 1,
    "01091": 1,
    "01092": 1,
    "01093": 1,
  },
};
const json = (body: unknown, type = "application/json") =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    headers: { "content-type": type },
  });

describe("MarvelCDB decks", () => {
  it("recognizes published and shared deck links", () => {
    expect(
      marvelCdbLink("https://marvelcdb.com/decklist/view/40000/phoenix-1.0"),
    ).toEqual({ kind: "decklist", id: "40000" });
    expect(marvelCdbLink(" marvelcdb.com/deck/view/123 ")).toEqual({
      kind: "deck",
      id: "123",
    });
    expect(marvelCdbLink("3x Energy (Core Set)")).toBeNull();
  });

  it("reads a public deck and rejects missing ones", async () => {
    const urls: string[] = [];
    const fetcher = (async (url: string) => {
      urls.push(url);
      return json(blackPantherStarter);
    }) as unknown as typeof fetch;
    const deck = await fetchMarvelCdbDeck(
      { kind: "decklist", id: "1" },
      fetcher,
    );
    expect(urls).toEqual(["https://marvelcdb.com/api/public/decklist/1"]);
    expect(deck.heroCode).toBe("01040a");
    expect(deck.aspects).toEqual(["protection"]);
    expect(Object.values(deck.slots).reduce((a, b) => a + b, 0)).toBe(40);
    // A missing deck answers with MarvelCDB's HTML page.
    await expect(
      fetchMarvelCdbDeck({ kind: "decklist", id: "9" }, (async () =>
        json("<html></html>", "text/html")) as unknown as typeof fetch),
    ).rejects.toThrow("no public deck");
    await expect(
      fetchMarvelCdbDeck({ kind: "deck", id: "9" }, (async () => {
        throw TypeError("Failed to fetch");
      }) as unknown as typeof fetch),
    ).rejects.toThrow(
      "no public deck at this link, or it could not be reached",
    );
  });

  it("turns the starter's slots into a valid deck for the same hero", async () => {
    const options = deckOptions("black_panther", "protection");
    const fixed = heroRequiredCards("black_panther");
    const parsed = importSlots(blackPantherStarter.slots, {
      heroId: "black_panther",
      options,
      fixed,
    });
    expect(parsed.unknown).toEqual([]);
    expect(parsed.unavailable).toEqual([]);
    expect(parsed.limited).toEqual([]);
    const deck = [
      ...deckCodes("black_panther", "protection").filter((code) =>
        Object.hasOwn(fixed, code),
      ),
      ...parsed.codes,
    ];
    expect(deck).toHaveLength(40);
    expect(deckErrors("black_panther", "protection", deck)).toEqual([]);
  });

  it("maps reprint codes to the card's row and reports unknown codes", () => {
    const parsed = importSlots(
      { "21049": 2, "99999": 1 },
      { heroId: "spider_man", options, fixed: required },
    );
    expect(parsed.codes.map((code) => card(code).name)).toEqual([
      "For Justice!",
      "For Justice!",
    ]);
    expect(parsed.unknown).toEqual(["99999"]);
  });
});
