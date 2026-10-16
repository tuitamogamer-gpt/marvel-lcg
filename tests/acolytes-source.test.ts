import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import images from "../src/data/catalog-images.json" with { type: "json" };
import { keywordDeclarations } from "../src/game/keywords.js";
import { ACOLYTES_SCRIPT_CODES } from "../src/game/acolytes.js";

describe("Acolytes independent printed source contract", () => {
  const expected = [
    ["32159", "Fabian Cortez", 1, 1, 4, 3, ["Teamwork", "Villainous"]],
    ["32160", "Amelia Voght", 2, 1, 5, 2, ["Stalwart", "Teamwork"]],
    ["32161", "Senyaka", 1, 3, 3, 3, ["Teamwork"]],
    ["32162", "Delgado", 1, 2, 6, 2, ["Retaliate", "Teamwork"]],
    ["32163", "Unuscione", 2, 2, 4, 2, ["Teamwork", "Toughness"]],
  ] as const;
  it.each(expected)(
    "pins original %s stats and intrinsic keywords",
    (code, name, scheme, attack, health, boost, keywords) => {
      const c = catalog.find((c) => c.code === code)!;
      expect(c).toMatchObject({
        name,
        scheme,
        attack,
        health,
        boost,
        quantity: 1,
        set_code: "acolytes",
        pack_code: "mut_gen",
        type_code: "minion",
        is_unique: true,
      });
      expect(keywordDeclarations(c).map((k) => k.name)).toEqual([...keywords]);
      expect(
        keywordDeclarations(c)
          .find((k) => k.name === "Teamwork")
          ?.argument?.toLowerCase(),
      ).toBe("acolyte");
    },
  );
  it("pins the seven single physical cards and local source images", () => {
    const cards = catalog.filter(
      (c) => c.pack_code === "mut_gen" && c.set_code === "acolytes",
    );
    expect(cards.map((c) => c.code)).toEqual([...ACOLYTES_SCRIPT_CODES]);
    expect(cards.reduce((n, c) => n + c.quantity, 0)).toBe(7);
    for (const c of cards) {
      expect(
        readFileSync(`public/cards/catalog/${c.code}.webp`).length,
      ).toBeGreaterThan(1000);
      expect(JSON.stringify(images)).toContain(c.code);
    }
  });
  it("pins treachery and hazard side scheme instead of inferring generic effects", () => {
    expect(catalog.find((c) => c.code === "32164")).toMatchObject({
      type_code: "treachery",
      quantity: 1,
      boost: 1,
    });
    expect(catalog.find((c) => c.code === "32165")).toMatchObject({
      type_code: "side_scheme",
      base_threat: 3,
      scheme_hazard: 1,
      boost_star: true,
      quantity: 1,
    });
  });
  it("preserves the downloaded catalog bytes", () => {
    // Baseline source before this import: no rewritten rules or synthetic faces.
    expect(
      createHash("sha256")
        .update(readFileSync("src/data/catalog-cards.json"))
        .digest("hex"),
    ).toBe("c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb");
  });
});
