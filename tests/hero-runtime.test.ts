import { describe, expect, it } from "vitest";
import catalogCards from "../src/data/catalog-cards.json";
import { deckCodes } from "../src/game/cards";
import { rulesCode } from "../src/game/rules-code";
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
    expect(heroRuntime("13001c")?.id).toBe("wsp");
    expect(heroRuntime("wsp")?.forms).toHaveLength(3);
    expect(heroRuntime("14001b")?.id).toBe("qsv");
    expect(heroRuntime("qsv")?.forms).toHaveLength(2);
    expect(heroRuntime("15001b")?.id).toBe("scw");
    expect(heroRuntime("scw")?.forms).toHaveLength(2);
    expect(heroRuntime("16001b")?.id).toBe("groot");
    expect(heroRuntime("groot")?.forms).toHaveLength(2);
    expect(heroRuntime("16029b")?.id).toBe("rocket");
    expect(heroRuntime("rocket")?.forms).toHaveLength(2);
  });
  it("imported identities stay unautomated until their full runtime is installed", () => {
    expect(
      HERO_RUNTIME.filter((h) => h.scripted).map((h) => h.id),
    ).toHaveLength(19);
    expect(heroRuntime("captain_america")?.scripted).toBe(true);
    expect(heroRuntime("wsp")?.scripted).toBe(true);
    expect(heroRuntime("qsv")?.scripted).toBe(true);
    expect(heroRuntime("scw")?.scripted).toBe(true);
    expect(heroRuntime("groot")?.scripted).toBe(true);
    expect(heroRuntime("rocket")?.scripted).toBe(true);
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
  it("preserves Quicksilver's exact forty-card Protection source starter and physical retail printing quantities", () => {
    const codes = deckCodes("qsv", "protection");
    expect(codes).toHaveLength(40);
    expect(codes.slice().sort()).toEqual(heroStarterCodes("qsv").sort());
    expect(validateHeroDeck("qsv", ["protection"], codes).errors).toEqual([]);
    const quantities = new Map<string, number>();
    for (const code of codes)
      quantities.set(code, (quantities.get(code) || 0) + 1);
    expect(Object.fromEntries(quantities)).toMatchObject({
      "14003": 4,
      "14012": 3,
      "14014": 3,
      "14015": 3,
      "14016": 2,
      "14017": 3,
      "14018": 1,
      "14019": 1,
      "14020": 1,
      "14021": 1,
    });
    expect(codes.every((code) => byCode.get(code)?.pack_code === "qsv")).toBe(
      true,
    );
  });
  it("preserves Scarlet Witch's exact forty-card Justice source starter and physical retail printing quantities", () => {
    const codes = deckCodes("scw", "justice");
    expect(codes).toHaveLength(40);
    expect(codes.slice().sort()).toEqual(heroStarterCodes("scw").sort());
    expect(validateHeroDeck("scw", ["justice"], codes).errors).toEqual([]);
    const quantities = new Map<string, number>();
    for (const code of codes)
      quantities.set(code, (quantities.get(code) || 0) + 1);
    expect(Object.fromEntries(quantities)).toEqual({
      "15002": 1,
      "15003": 1,
      "15004": 4,
      "15005": 3,
      "15006": 1,
      "15007": 1,
      "15008": 3,
      "15009": 1,
      "15010": 1,
      "15011": 1,
      "15012": 3,
      "15013": 3,
      "15014": 3,
      "15015": 3,
      "15016": 2,
      "15017": 2,
      "15018": 1,
      "15019": 3,
      "15020": 1,
      "15021": 1,
      "15022": 1,
    });
    expect(codes.every((code) => byCode.get(code)?.pack_code === "scw")).toBe(
      true,
    );
    expect(byCode.get("15001a")).toMatchObject({
      health: 10,
      attack: 1,
      thwart: 2,
      defense: 2,
      hand_size: 5,
      traits: "Avenger. Mystic.",
    });
    expect(byCode.get("15001b")).toMatchObject({
      recover: 3,
      hand_size: 6,
      traits: "Mystic.",
    });
  });
  it("uses only whole-equivalent Core handlers for Scarlet Witch's five retail reprints", () => {
    expect(
      Object.fromEntries(
        ["15016", "15017", "15020", "15021", "15022"].map((code) => [
          code,
          rulesCode(code),
        ]),
      ),
    ).toEqual({
      "15016": "01062",
      "15017": "01065",
      "15020": "01088",
      "15021": "01089",
      "15022": "01090",
    });
  });
  for (const { id, aspect, quantities } of [
    {
      id: "groot",
      aspect: "protection" as const,
      quantities: {
        "16002": 2,
        "16003": 2,
        "16004": 2,
        "16005": 3,
        "16006": 1,
        "16007": 1,
        "16008": 1,
        "16009": 1,
        "16010": 1,
        "16011": 1,
        "16012": 1,
        "16013": 3,
        "16014": 3,
        "16015": 2,
        "16016": 3,
        "16017": 3,
        "16018": 2,
        "16019": 1,
        "16020": 1,
        "16021": 1,
        "16022": 1,
        "16023": 1,
        "16024": 3,
      },
    },
    {
      id: "rocket",
      aspect: "aggression" as const,
      quantities: {
        "16030": 2,
        "16031": 2,
        "16032": 1,
        "16033": 2,
        "16034": 2,
        "16035": 1,
        "16036": 1,
        "16037": 1,
        "16038": 2,
        "16039": 1,
        "16040": 1,
        "16041": 2,
        "16042": 3,
        "16043": 3,
        "16044": 2,
        "16045": 3,
        "16046": 3,
        "16047": 1,
        "16048": 1,
        "16049": 1,
        "16050": 1,
        "16051": 1,
        "16052": 3,
      },
    },
  ])
    it(`preserves ${id}'s exact forty-card GMW source starter and physical printing quantities`, () => {
      const codes = deckCodes(id, aspect);
      expect(codes).toHaveLength(40);
      expect(codes.slice().sort()).toEqual(heroStarterCodes(id).sort());
      expect(validateHeroDeck(id, [aspect], codes).errors).toEqual([]);
      const actual: Record<string, number> = {};
      for (const code of codes) actual[code] = (actual[code] || 0) + 1;
      expect(actual).toEqual(quantities);
      expect(codes.every((code) => byCode.get(code)?.pack_code === "gmw")).toBe(
        true,
      );
    });
  it("uses the ten exact Core GMW player reprints without aliasing new operative clauses", () => {
    const aliases = {
      "16015": "01079",
      "16018": "01082",
      "16021": "01088",
      "16022": "01089",
      "16023": "01090",
      "16041": "01052",
      "16044": "01053",
      "16049": "01088",
      "16050": "01089",
      "16051": "01090",
    };
    expect(
      Object.fromEntries(
        Object.keys(aliases).map((code) => [code, rulesCode(code)]),
      ),
    ).toEqual(aliases);
    for (const code of [
      "16012",
      "16013",
      "16014",
      "16016",
      "16019",
      "16024",
      "16042",
      "16043",
      "16052",
    ])
      expect(rulesCode(code)).toBe(code);
  });
  it("keeps Guardian eligibility tied to the two actual hero faces", () => {
    expect(byCode.get("16001a")).toMatchObject({
      health: 10,
      attack: 2,
      thwart: 1,
      defense: 3,
      hand_size: 5,
      traits: "Guardian.",
    });
    expect(byCode.get("16001b")).toMatchObject({
      recover: 4,
      hand_size: 6,
      traits: "Outlaw.",
    });
    expect(byCode.get("16029a")).toMatchObject({
      health: 9,
      attack: 1,
      thwart: 2,
      defense: 1,
      hand_size: 5,
      traits: "Guardian.",
    });
    expect(byCode.get("16029b")).toMatchObject({
      recover: 3,
      hand_size: 6,
      traits: "Genius. Outlaw.",
    });
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
