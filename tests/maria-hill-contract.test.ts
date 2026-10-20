import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sourceCards from "../src/data/catalog-cards.json";
import sourceDecks from "../src/data/catalog-decks.json";
import { card } from "../src/game/card-definitions.js";
import {
  heroStarterAspects,
  heroStarterCodes,
} from "../src/game/hero-runtime.js";
import { MARIA_HILL_SCRIPT_CODES } from "../src/game/maria-hill.js";

describe("Maria Hill original source contract", () => {
  it("preserves the exact original starter and shared Super Spies allocation", () => {
    const starter = sourceDecks.find((d) => d.heroCode === "50001a")!;
    const ids = Object.entries(starter.cards).flatMap(([id, qty]) =>
      Array(Number(qty)).fill(id),
    );
    expect(ids).toHaveLength(40);
    expect(heroStarterCodes("maria_hill").sort()).toEqual(ids.sort());
    expect(starter.aspect).toBe("multi");
    expect(heroStarterAspects("maria_hill")).toEqual(["leadership"]);
    expect(starter.cards["50024"]).toBe(1);
    expect(sourceCards.find((c) => c.code === "50024")?.quantity).toBe(2);
    expect(MARIA_HILL_SCRIPT_CODES).not.toContain("50024");
    expect(new Set(MARIA_HILL_SCRIPT_CODES).size).toBe(33);
  });

  it("preserves the Controller's scan-verified printed statistics", () => {
    const raw = JSON.parse(
      readFileSync(
        new URL("../src/data/catalog-cards.json", import.meta.url),
        "utf8",
      ),
    ) as typeof sourceCards;
    const original = raw.find((c) => c.code === "50030")!;
    expect(original.scheme).toBe(2);
    expect(card("50030").scheme).toBe(2);
    expect(card("50030").scheme_star).toBe(true);
    expect(card("50030").boost).toBe(3);
  });
});
