import { describe, expect, it } from "vitest";
import catalogCards from "../src/data/catalog-cards.json";
import { deckCodes } from "../src/game/cards";
import {
  HERO_RUNTIME,
  heroRuntime,
  heroStarterAspects,
  heroStarterCodes,
  heroDeckAspects,
  validateHeroDeck,
  isPermanent,
} from "../src/game/hero-runtime";
import type { Card } from "../src/game/types";
const cards = catalogCards as unknown as Card[];
const byCode = new Map(cards.map((c) => [c.code, c]));

describe("imported hero definitions and printed starter legality", () => {
  it("has exactly 69 canonical identities without treating alternate forms as new heroes", () => {
    expect(HERO_RUNTIME).toHaveLength(69);
    expect(new Set(HERO_RUNTIME.map((h) => h.id)).size).toBe(69);
    expect(heroRuntime("cap:captain_america")?.id).toBe("captain_america");
    expect(heroRuntime("03001a")?.id).toBe("captain_america");
    expect(heroRuntime("31001b")?.id).toBe("spdr");
    expect(heroRuntime("31002b")?.id).toBe("spdr");
    expect(heroRuntime("ironheart")?.forms).toHaveLength(6);
    expect(heroRuntime("ant")?.forms).toHaveLength(3);
  });
  it("imported identities stay unautomated until their full runtime is installed", () => {
    expect(
      HERO_RUNTIME.filter((h) => h.scripted).map((h) => h.id),
    ).toHaveLength(13);
    expect(heroRuntime("captain_america")?.scripted).toBe(true);
    expect(heroRuntime("daredevil")?.scripted).toBe(false);
  });
  for (const hero of HERO_RUNTIME)
    it(`${hero.name} starter follows its printed deck rules`, () => {
      const result = validateHeroDeck(
        hero.id,
        heroStarterAspects(hero.id),
        heroStarterCodes(hero.id),
      );
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      expect(result.deckSize).toBe(hero.starters[0].deckSize);
      expect(hero.obligationCodes.length).toBeGreaterThan(0);
      expect(hero.nemesisCodes.length).toBeGreaterThan(0);
    });
  it("uses Spider-Woman's colored signature set independently of her two chosen aspects", () => {
    expect(heroStarterAspects("spider_woman").sort()).toEqual([
      "aggression",
      "justice",
    ]);
    const hero = heroRuntime("spider_woman")!;
    expect(
      Object.keys(hero.signatureCards).some(
        (code) => byCode.get(code)?.faction_code === "protection",
      ),
    ).toBe(true);
    const codes = heroStarterCodes(hero.id);
    codes[codes.indexOf("04049")] = "01050";
    expect(
      validateHeroDeck(hero.id, ["aggression", "justice"], codes).errors.join(
        " ",
      ),
    ).toContain("equal number");
  });
  it("counts chosen-color signatures in equality while retaining other required signature colors", () => {
    const signatures = heroStarterCodes("spider_woman").filter(
      (code) => byCode.get(code)?.set_code === "spider_woman",
    );
    const codes = [
      ...signatures,
      ...deckCodes("spider_man", "leadership").filter(
        (code) => byCode.get(code)?.faction_code === "basic",
      ),
      "01066",
      "01067",
      "01068",
      "01069",
      "01069",
      "01070",
      "01070",
      ...Array(3).fill("44017"),
      ...Array(3).fill("44021"),
      ...Array(3).fill("44029"),
    ];
    expect(heroDeckAspects("spider_woman", codes, "leadership")).toEqual([
      "leadership",
      "pool",
    ]);
    expect(
      validateHeroDeck("spider_woman", ["leadership", "pool"], codes).errors,
    ).toEqual([]);
    codes[codes.indexOf("44017")] = "01085";
    expect(
      validateHeroDeck(
        "spider_woman",
        ["leadership", "pool"],
        codes,
      ).errors.join(" "),
    ).toContain("including signature cards");
  });
  it("offers exact Rise source starters and balanced alternate two-aspect compositions", () => {
    expect(deckCodes("hawkeye", "leadership").sort()).toEqual(
      heroStarterCodes("hawkeye").sort(),
    );
    expect(deckCodes("spider_woman", "aggression").sort()).toEqual(
      heroStarterCodes("spider_woman").sort(),
    );
    for (const pair of [
      ["leadership", "protection"],
      ["justice", "leadership"],
      ["aggression", "protection"],
    ] as const) {
      const codes = deckCodes("spider_woman", pair[0], [...pair]);
      expect(codes).toHaveLength(40);
      expect(validateHeroDeck("spider_woman", [...pair], codes).errors).toEqual(
        [],
      );
      expect(heroDeckAspects("spider_woman", codes, pair[0]).sort()).toEqual(
        [...pair].sort(),
      );
    }
    expect(() =>
      deckCodes("spider_woman", "aggression", ["aggression", "aggression"]),
    ).toThrow("two distinct aspects");
  });
  it("matching identity allies remain illegal across typographic differences in alter-ego names", () => {
    const codes = deckCodes("black_panther", "leadership");
    codes[codes.indexOf("01066")] = "23012";
    expect(
      validateHeroDeck("black_panther", ["leadership"], codes).errors.join(" "),
    ).toContain("matches this identity");
  });
  it("a hero deck may include two same-title unique allies with different secondary identities", () => {
    const codes = heroStarterCodes("captain_america");
    codes[codes.indexOf("03011")] = "27049";
    codes[codes.indexOf("03013")] = "13019";
    expect(
      validateHeroDeck("captain_america", ["leadership"], codes).errors,
    ).toEqual([]);
  });
  it("Adam Warlock requires all four aspects and singleton cards outside his signature set", () => {
    const codes = heroStarterCodes("warlock");
    expect(validateHeroDeck("warlock", ["aggression"], codes).valid).toBe(
      false,
    );
    const flexible = codes.filter(
      (code) => byCode.get(code)?.set_code !== "warlock",
    );
    codes[codes.indexOf(flexible[1])] = flexible[0];
    expect(
      validateHeroDeck(
        "warlock",
        heroStarterAspects("warlock"),
        codes,
      ).errors.some((e) => e.includes("deck limit is 1")),
    ).toBe(true);
  });
  it("Permanent signature cards are required but excluded from the 40–50 card size", () => {
    const spectrum = heroRuntime("spectrum")!;
    const codes = heroStarterCodes(spectrum.id);
    expect(codes).toHaveLength(43);
    expect(codes.filter((code) => isPermanent(byCode.get(code)!))).toHaveLength(
      3,
    );
    expect(
      validateHeroDeck(spectrum.id, heroStarterAspects(spectrum.id), codes)
        .deckSize,
    ).toBe(40);
    codes.splice(codes.indexOf(Object.keys(spectrum.setupCards)[0]), 1);
    expect(
      validateHeroDeck(spectrum.id, heroStarterAspects(spectrum.id), codes)
        .valid,
    ).toBe(false);
  });
  it("a supplementary deck never enters the draw-deck composition", () => {
    for (const id of ["storm", "doctor_strange", "daredevil", "hercules"]) {
      const hero = heroRuntime(id)!;
      expect(Object.keys(hero.supplementaryCards).length).toBeGreaterThan(0);
      expect(
        Object.keys(hero.supplementaryCards).some((code) =>
          heroStarterCodes(id).includes(code),
        ),
      ).toBe(false);
    }
  });
  it("rejects omitted signature cards, encounter cards, wrong aspects and illegal Team-Up identities", () => {
    const codes = heroStarterCodes("captain_america");
    codes[codes.indexOf("03009")] = "03028";
    const invalid = validateHeroDeck("captain_america", ["justice"], codes);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((e) => e.includes("Shield"))).toBe(true);
    expect(invalid.errors.some((e) => e.includes("not a customizable"))).toBe(
      true,
    );
    const original = heroStarterCodes("captain_america");
    original[original.indexOf("03025")] = "12020";
    expect(
      validateHeroDeck("captain_america", ["leadership"], original).errors.some(
        (e) => e.includes("Team-Up"),
      ),
    ).toBe(true);
  });
});
