import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sourceDecks from "../src/data/catalog-decks.json" with { type: "json" };
import images from "../src/data/catalog-images.json" with { type: "json" };
import { card, HEROES, MODULES } from "../src/game/cards.js";
import { heroRuntime } from "../src/game/hero-runtime.js";
import { rulesCode } from "../src/game/rules-code.js";
import { MAGNETO_HERO_SCRIPT_CODES } from "../src/game/magneto-hero.js";
import { deckOptions } from "../src/game/decks.js";
const raw = (code: string) => catalog.find((c) => c.code === code)!;
// Transcribed from the original English product's faces; the native registry is
// checked against this independent source, not used to construct its inventory.
const faces = [
  ["49001a", "Magneto", "hero", 1],
  ["49001b", "Erik Lehnsherr", "alter_ego", 1],
  ["49002", "Asteroid M", "support", 1],
  ["49003", "Magneto's Helmet", "upgrade", 1],
  ["49004", "Magneto's Armor", "upgrade", 1],
  ["49005", "Magneto's Cape", "upgrade", 1],
  ["49006", "Magnetic Bubble", "upgrade", 1],
  ["49007", "Wrapped in Metal", "upgrade", 2],
  ["49008", "Electromagnetic Blast", "event", 2],
  ["49009", "Metal Shards", "event", 2],
  ["49010", "Magnetic Missile", "event", 2],
  ["49011", "Master of Magnetism", "resource", 2],
  ["49012", "M", "ally", 1],
  ["49013", "Kid Omega", "ally", 1],
  ["49014", "Phoenix", "ally", 1],
  ["49015", "Cyclops", "ally", 1],
  ["49016", "Won't Stay Down", "support", 3],
  ["49017", "Squared Off", "event", 3],
  ["49018", "Noble Sacrifice", "event", 3],
  ["49019", '"You Got This!"', "event", 3],
  ["49020", "New Recruits", "player_side_scheme", 1],
  ["49021", "White Queen", "ally", 1],
  ["49022", "Face the Past", "event", 1],
  ["49023", "Deft Focus", "upgrade", 3],
  ["49024", "Energy", "resource", 1],
  ["49025", "Genius", "resource", 1],
  ["49026", "Strength", "resource", 1],
  ["49027", "Old Grievances", "obligation", 1],
  ["49028", "Exodus", "minion", 1],
  ["49029", "Martyr for Mutants", "side_scheme", 1],
  ["49030", "Fabian Cortez", "minion", 1],
  ["49031", "Frenzy", "minion", 1],
  ["49032", "Angry Acolyte", "treachery", 1],
  ["49033", "Surge", "ally", 1],
  ["49034", "Anole", "ally", 1],
  ["49035", "Bling!", "ally", 1],
  ["49036", "Indra", "ally", 1],
  ["49037", "Children of the Atom", "support", 3],
  ["49038", "Sebastian Shaw", "minion", 1],
  ["49039", "Selene", "minion", 1],
  ["49040", "Hellfire Pawn", "minion", 1],
  ["49041", "The Inner Circle", "side_scheme", 1],
  ["49042", "Power and Decadence", "treachery", 1],
] as const;
const original40 = {
  "49002": 1,
  "49003": 1,
  "49004": 1,
  "49005": 1,
  "49006": 1,
  "49007": 2,
  "49008": 2,
  "49009": 2,
  "49010": 2,
  "49011": 2,
  "49012": 1,
  "49013": 1,
  "49014": 1,
  "49015": 1,
  "49016": 3,
  "49017": 3,
  "49018": 3,
  "49019": 3,
  "49020": 1,
  "49021": 1,
  "49022": 1,
  "49023": 3,
  "49024": 1,
  "49025": 1,
  "49026": 1,
};
describe("Magneto hero independent original-source contract", () => {
  it.each(faces)(
    "pins original face %s and its English artwork",
    (code, name, type_code, quantity) => {
      expect(raw(code)).toMatchObject({
        name,
        type_code,
        quantity,
        pack_code: "magneto",
      });
      expect((images as Record<string, string>)[code]).toBe(
        `/cards/catalog/${code}.webp`,
      );
      const art = readFileSync(
        new URL(`../public/cards/catalog/${code}.webp`, import.meta.url),
      );
      expect(art.subarray(0, 4).toString()).toBe("RIFF");
      expect(art.length).toBeGreaterThan(30_000);
    },
  );
  it("pins43faces/59physical including five Hellfire cards", () => {
    expect(
      catalog.filter((c) => c.pack_code === "magneto").map((c) => c.code),
    ).toEqual(faces.map(([code]) => code));
    expect([...MAGNETO_HERO_SCRIPT_CODES]).toEqual(faces.map(([code]) => code));
    expect(
      faces
        .filter(([code]) => code !== "49001b")
        .reduce((n, [, , , q]) => n + q, 0),
    ).toBe(59);
    expect(
      catalog.filter((c) => c.set_code === "hellfire").map((c) => c.code),
    ).toEqual(["49038", "49039", "49040", "49041", "49042"]);
    expect(MODULES.find((m) => m.id === "hellfire")).toBeDefined();
    expect(HEROES.find((h) => h.id === "magneto")).toMatchObject({
      code: "49001a",
      alter: "49001b",
      aspect: "leadership",
    });
  });
  it("pins exact40=15signature+17Leadership+8Basic without rewriting the missing raw Linked metadata", () => {
    const source = sourceDecks.find((s) => s.heroCode === "49001a")!;
    expect(source.cards).toEqual(original40);
    expect(source.setupCards).toEqual({});
    expect(source.supplementaryCards).toEqual({});
    expect(heroRuntime("magneto")?.supplementaryCards).toEqual({
      "49033": 1,
      "49034": 1,
      "49035": 1,
      "49036": 1,
    });
    for (const aspect of [
      "aggression",
      "justice",
      "leadership",
      "protection",
      "pool",
    ] as const)
      expect(
        deckOptions("magneto", aspect).some((c) => /^4903[3-6]$/.test(c.code)),
      ).toBe(false);
  });
  it("pins hero numbers, resource icons and the four printed New ally stat lines", () => {
    expect(raw("49001a")).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      health: 10,
      hand_size: 5,
      traits: "X-Men.",
    });
    expect(raw("49001b")).toMatchObject({
      recover: 3,
      hand_size: 6,
      health: 10,
      traits: "Mutant.",
    });
    expect(raw("49011")).toMatchObject({
      resource_energy: 1,
      resource_mental: 1,
      quantity: 2,
    });
    for (const code of ["49033", "49034", "49035", "49036"]) {
      expect(raw(code)).toMatchObject({
        cost: 2,
        attack: 2,
        thwart: 2,
        health: 2,
        traits: "New. X-Men.",
      });
      expect(raw(code).text).toContain("Linked (New Recruits)");
    }
    expect(raw("49020")).toMatchObject({ base_threat: 2 });
    expect(raw("49020").text).toContain("Victory 0");
  });
  it("applies the published Magnetic Missile THEN erratum while retaining its printed arrow", () => {
    expect(raw("49010").text).toContain("→ deal 5 damage");
    expect(card("49010").text).toContain("attached. Then, deal 5 damage");
    expect(card("49010").errata).toMatchObject({
      reference: "FFG Rules Reference 1.8, p. 69",
    });
    expect(card("49010").errata?.url).toContain("#page=69");
  });
  it("pins native Deft Focus reprint identity and all nemesis/Hellfire boost numbers", () => {
    expect(rulesCode("49023")).toBe("16024");
    for (const [code, number, star] of [
      ["49027", 2, false],
      ["49028", 3, false],
      ["49029", 3, false],
      ["49030", 0, true],
      ["49031", 0, true],
      ["49032", 2, false],
      ["49038", 3, false],
      ["49039", 0, true],
      ["49040", 0, true],
      ["49041", 2, false],
      ["49042", 0, true],
    ] as const) {
      expect(raw(code).boost || 0, code).toBe(number);
      expect(!!raw(code).boost_star, code).toBe(star);
    }
    expect(raw("49028")).toMatchObject({ scheme: 2, attack: 2, health: 6 });
    expect(raw("49038")).toMatchObject({ scheme: 1, attack: 2, health: 5 });
    expect(raw("49039")).toMatchObject({ scheme: 1, attack: 1, health: 4 });
    expect(raw("49040")).toMatchObject({ scheme: 1, attack: 2, health: 3 });
  });
  it("preserves the three imported catalog/deck/image snapshots byte for byte", () => {
    const hashes = {
      "catalog-cards.json":
        "c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb",
      "catalog-decks.json":
        "6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886",
      "catalog-images.json":
        "fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d",
    };
    for (const [file, hash] of Object.entries(hashes))
      expect(
        createHash("sha256")
          .update(readFileSync(new URL(`../src/data/${file}`, import.meta.url)))
          .digest("hex"),
      ).toBe(hash);
  });
});
