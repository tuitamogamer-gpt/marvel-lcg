import { describe, expect, it } from "vitest";
import {
  CARDS,
  CATALOG_CARDS,
  HEROES,
  card,
  deckCodes,
} from "../src/game/cards";
import {
  CATALOG_HEROES,
  PRODUCTS,
  STARTER_DECKS,
  catalogDeckCodes,
  productForCard,
  productsForDeck,
} from "../src/game/catalog";
import { deckErrors, deckOptions } from "../src/game/decks";
import { hasExecutableScript } from "../src/game/script-registry";

describe("released content and original product provenance", () => {
  it("includes released boxes, packs and the free modular set without announced future products", () => {
    expect(PRODUCTS).toHaveLength(63);
    expect(PRODUCTS.map((p) => p.code)).toEqual(
      expect.arrayContaining(["core", "ron", "cw", "fne", "jj", "luke_cage"]),
    );
    expect(PRODUCTS.every((p) => p.date_release <= "2026-09-30")).toBe(true);
    expect(
      PRODUCTS.some((p) => /shadowland|elektra|iron fist/i.test(p.name)),
    ).toBe(false);
    expect(PRODUCTS.find((p) => p.code === "cw")?.typeLabel).toBe(
      "Custom Scenario Expansion",
    );
  });

  it("has one database entry per face, with an imported source product for every face", () => {
    expect(CATALOG_CARDS).toHaveLength(4551);
    expect(new Set(CATALOG_CARDS.map((c) => c.code)).size).toBe(
      CATALOG_CARDS.length,
    );
    expect(CATALOG_CARDS.filter((c) => !productForCard(c.code))).toEqual([]);
    for (const product of PRODUCTS) {
      expect(CATALOG_CARDS.some((c) => c.pack_code === product.code)).toBe(
        true,
      );
    }
    expect(card("01029a").errata).toBeDefined();
    expect(card("26002").back_link).toBe("26002b");
    expect(card("26002b").name).toBe("Dense");
  });

  it("groups alternate identity forms without merging two characters sharing a hero name", () => {
    expect(CATALOG_HEROES).toHaveLength(69);
    expect(CATALOG_HEROES.filter((h) => h.name === "Ironheart")).toHaveLength(
      1,
    );
    expect(
      CATALOG_HEROES.find((h) => h.name === "Ironheart")?.identityCodes,
    ).toHaveLength(6);
    const panthers = CATALOG_HEROES.filter((h) => h.name === "Black Panther");
    expect(panthers).toHaveLength(2);
    expect(panthers.map((h) => h.identity)).toEqual(
      expect.arrayContaining(["T’Challa", "Shuri"]),
    );
    expect(
      CATALOG_HEROES.filter((h) => h.automated)
        .map((h) => h.id)
        .sort(),
    ).toEqual(HEROES.map((h) => h.id).sort());
  });

  it("distinguishes boxed heroes and separately sold Hero Packs", () => {
    const daredevil = CATALOG_HEROES.find((h) => h.name === "Daredevil")!;
    const jessica = CATALOG_HEROES.find((h) => h.name === "Jessica Jones")!;
    expect(daredevil.product.name).toBe("Fear No Evil");
    expect(daredevil.product.soldSeparately).toBe(false);
    expect(jessica.product.typeLabel).toBe("Hero Pack");
    expect(jessica.product.soldSeparately).toBe(true);
    expect(productForCard("drone")).toBeUndefined();
    expect(productForCard("unknown")).toBeUndefined();
  });

  it("includes all six Fear No Evil scenarios from the supplementary maintained source", () => {
    const villains = CATALOG_CARDS.filter(
      (c) => c.pack_code === "fne" && c.type_code === "villain",
    );
    expect([...new Set(villains.map((c) => c.name))]).toEqual(
      expect.arrayContaining([
        "Bullseye",
        "Electro",
        "Hammerhead",
        "Purple Man",
        "Typhoid Mary",
        "Kingpin",
      ]),
    );
    const schemes = CATALOG_CARDS.filter(
      (c) => c.pack_code === "fne" && c.type_code === "main_scheme",
    );
    expect(schemes.length).toBeGreaterThanOrEqual(12);
    expect(card("60001a").thwart).toBe(2);
    expect(card("60001a").text).toMatch(/Forced Interrupt/);
    expect(card("60001a").text).toMatch(/bottom/);
  });

  it("keeps complete source deck lists and reports every product used by their actual printings", () => {
    expect(
      STARTER_DECKS.filter((d) => d.sourceType === "app-starter"),
    ).toHaveLength(HEROES.length);
    expect(
      STARTER_DECKS.filter((d) => d.sourceType === "source-preconstructed"),
    ).toHaveLength(69);
    for (const deck of STARTER_DECKS) {
      const codes = catalogDeckCodes(deck);
      expect(codes.every((code) => !!card(code))).toBe(true);
      expect(
        Object.values(deck.cards).every(
          (n) => Number.isSafeInteger(n) && n > 0,
        ),
      ).toBe(true);
      const setup = Object.entries(deck.setupCards || {});
      expect(setup.every(([code, n]) => deck.cards[code] === n)).toBe(true);
      const drawDeckSize =
        codes.length - setup.reduce((sum, [, n]) => sum + n, 0);
      expect(drawDeckSize).toBeGreaterThanOrEqual(40);
      expect(drawDeckSize).toBeLessThanOrEqual(50);
      expect(
        Object.keys(deck.supplementaryCards || {}).every(
          (code) => !!card(code) && !deck.cards[code],
        ),
      ).toBe(true);
      expect(CATALOG_HEROES.some((hero) => hero.code === deck.heroCode)).toBe(
        true,
      );
      expect(
        productsForDeck(codes)
          .map((p) => p.code)
          .sort(),
      ).toEqual([...new Set(codes.map((code) => card(code).pack_code))].sort());
      if (deck.sourceType !== "app-starter")
        expect(deck.sourceUrl).toMatch(/^https:\/\//);
    }
  });
  it("preserves printed starter corrections and separate hero special decks", () => {
    expect(card("61033b").name).toContain("[physical]");
    expect(card("61033b").text).toContain("[physical]");
    expect(card("61033c").name).toContain("[mental]");
    expect(card("61033c").text).toContain("[mental]");
    expect(
      STARTER_DECKS.find(
        (d) =>
          d.heroCode === "22001a" && d.sourceType === "source-preconstructed",
      )?.cards["22017"],
    ).toBe(2);
    expect(
      STARTER_DECKS.find(
        (d) =>
          d.heroCode === "50034a" && d.sourceType === "source-preconstructed",
      )?.cards["50024"],
    ).toBe(1);
    for (const [heroCode, count] of [
      ["09001a", 5],
      ["60001a", 5],
      ["36001a", 4],
    ] as const) {
      const deck = STARTER_DECKS.find(
        (d) =>
          d.heroCode === heroCode && d.sourceType === "source-preconstructed",
      )!;
      expect(
        Object.values(deck.supplementaryCards || {}).reduce(
          (sum, n) => sum + n,
          0,
        ),
      ).toBe(count);
    }
  });
});

describe("imported data never silently gains automated rules support", () => {
  it("preserves the complete supported core pool and starter-deck recipes", () => {
    expect(CARDS).toHaveLength(209);
    expect(
      deckOptions("spider_man", "justice").every((c) => hasExecutableScript(c)),
    ).toBe(true);
    expect(
      deckErrors("spider_man", "justice", deckCodes("spider_man", "justice")),
    ).toEqual([]);
  });

  it("rejects an imported card from an otherwise valid core deck", () => {
    const imported = CATALOG_CARDS.find(
      (c) =>
        c.pack_code !== "core" &&
        !hasExecutableScript(c) &&
        c.faction_code === "basic" &&
        c.type_code === "event",
    )!;
    const deck = deckCodes("spider_man", "justice");
    const index = deck.findIndex((code) => card(code).faction_code === "basic");
    deck[index] = imported.code;
    expect(card(imported.code)).toBeDefined();
    expect(deckErrors("spider_man", "justice", deck)).not.toEqual([]);
    expect(deckErrors("daredevil", "justice", deck)).not.toEqual([]);
  });
});
