import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import images from "../src/data/catalog-images.json";
import { card, MODULES, scenarioModules, VILLAINS } from "../src/game/cards.js";
import { EXPLICIT_CARD_SCRIPTS } from "../src/game/engine-support.js";
import { keywordDeclarations } from "../src/game/keywords.js";
import { MAGNETO_SCRIPT_CODES } from "../src/game/magneto.js";
import { hasExecutableScript } from "../src/game/script-registry.js";

const raw = (code: string) => catalog.find((c) => c.code === code)!;
// Independent transcription of the English retail scans, not an enumeration
// derived from the scenario implementation or its executable registry.
const faces = [
  ["32138", "Magneto", "villain", 1],
  ["32139", "Magneto", "villain", 1],
  ["32140", "Magneto", "villain", 1],
  ["32141a", "Asteroid M", "main_scheme", 1],
  ["32141b", "Asteroid M", "main_scheme", 1],
  ["32142a", "Factory Online", "main_scheme", 1],
  ["32142b", "Factory Online", "main_scheme", 1],
  ["32143a", "The Rule of Magnus", "main_scheme", 1],
  ["32143b", "The Rule of Magnus", "main_scheme", 1],
  ["32144a", "Boarding Party", "side_scheme", 1],
  ["32144b", "Sabotage Master Mold", "side_scheme", 1],
  ["32145a", "Orbital Decay", "side_scheme", 1],
  ["32145b", "Physical Strain", "attachment", 1],
  ["32146", "M-Type Sentinel", "minion", 4],
  ["32147", "Magneto's Helmet", "attachment", 1],
  ["32148", "Magneto's Armor", "attachment", 1],
  ["32149", "Magnetic Bubble", "attachment", 1],
  ["32150", "Wrapped in Metal", "attachment", 1],
  ["32151", "Master of Magnetism", "treachery", 3],
  ["32152", "Electric Shock", "treachery", 2],
  ["32153", "Electromagnetic Blast", "treachery", 2],
  ["32154", "Metal Shards", "treachery", 2],
  ["32155", "Magnetic Missile", "treachery", 2],
  ["32156", "Magnetic Mayhem", "side_scheme", 1],
  ["32157", "Magnetically Sealed", "side_scheme", 1],
  ["32158", "Seized!", "side_scheme", 1],
] as const;
const codes = faces.map(([code]) => code);
const shuffled = {
  "32146": 4,
  "32147": 1,
  "32148": 1,
  "32149": 1,
  "32150": 1,
  "32151": 3,
  "32152": 2,
  "32153": 2,
  "32154": 2,
  "32155": 2,
  "32156": 1,
  "32157": 1,
  "32158": 1,
};

describe("Magneto independent original English source contract", () => {
  it("preserves the downloaded card, player-deck and image-index bytes", () => {
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
        file,
      ).toBe(hash);
  });

  it.each(faces)(
    "pins retail face %s, its physical quantity and original local artwork",
    (code, name, type_code, quantity) => {
      expect(raw(code)).toMatchObject({
        name,
        type_code,
        quantity,
        pack_code: "mut_gen",
        set_code: "magneto_villain",
      });
      expect((images as Record<string, string>)[code]).toBe(
        `/cards/catalog/${code}.webp`,
      );
      const artwork = readFileSync(
        new URL(`../public/cards/catalog/${code}.webp`, import.meta.url),
      );
      expect(artwork.subarray(0, 4).toString()).toBe("RIFF");
      expect(artwork.subarray(8, 12).toString()).toBe("WEBP");
      expect(artwork.length).toBeGreaterThan(70_000);
    },
  );

  it("accounts for 26 faces, 30 retail physical cards and 22 shuffled cards", () => {
    const originals = catalog.filter((c) => c.set_code === "magneto_villain");
    expect(originals.map((c) => c.code)).toEqual(codes);
    expect(originals).toHaveLength(26);
    const physical = originals.filter((c) => !/[b]$/.test(c.code));
    expect(physical.reduce((total, c) => total + c.quantity, 0)).toBe(30);
    expect(
      Object.values(shuffled).reduce((total, quantity) => total + quantity, 0),
    ).toBe(22);
    for (const [code, quantity] of Object.entries(shuffled))
      expect(raw(code).quantity, code).toBe(quantity);
    for (const front of ["32141a", "32142a", "32143a", "32144a", "32145a"])
      expect(raw(front).back_link).toBe(`${front.slice(0, -1)}b`);
  });

  it.each([
    ["32138", "I", 2, 2, 18],
    ["32139", "II", 2, 3, 20],
    ["32140", "III", 3, 3, 22],
  ] as const)(
    "pins %s printed villain statistics",
    (code, stage, sch, atk, hp) => {
      expect(raw(code)).toMatchObject({
        stage,
        scheme: sch,
        attack: atk,
        health: hp,
        health_per_hero: true,
        attack_star: true,
        is_unique: true,
        traits: "Brotherhood of Mutants.",
      });
      expect(keywordDeclarations(raw(code)).map((k) => k.name)).toEqual([
        "Steady",
        "Toughness",
      ]);
      expect(raw(code).text).toContain("After Magneto attacks you");
      expect(
        raw(code).text.includes("Deal each player a facedown encounter card"),
      ).toBe(stage !== "I");
    },
  );

  it.each([
    ["32141b", 5],
    ["32142b", 6],
    ["32143b", 7],
  ] as const)("pins %s per-player main-scheme numbers", (code, limit) => {
    expect(raw(code)).toMatchObject({
      base_threat: 1,
      escalation_threat: 1,
      threat: limit,
    });
    expect(raw(code).base_threat_fixed).not.toBe(true);
    expect(raw(code).escalation_threat_fixed).not.toBe(true);
    expect(raw(code).threat_fixed).not.toBe(true);
  });

  it("pins the three 3N progress schemes and their 6N/12N/18N damage ceilings", () => {
    for (const [code, ceiling] of [
      ["32144a", 6],
      ["32144b", 12],
      ["32145a", 18],
    ] as const) {
      expect(raw(code).base_threat).toBe(3);
      expect(raw(code).base_threat_fixed).not.toBe(true);
      expect(raw(code).text).toContain(`${ceiling}[per_hero] sustained damage`);
    }
    expect(raw("32144b").text).toContain(
      "Add this card to the victory display",
    );
    expect(raw("32145b")).toMatchObject({
      type_code: "attachment",
      permanent: true,
      traits: "Condition.",
    });
    expect(raw("32145b").text).toContain("Magneto loses steady");
  });

  it("pins the minion, attachment modifiers, all boost icons and side icons", () => {
    expect(raw("32146")).toMatchObject({ scheme: 2, attack: 2, health: 5 });
    expect(raw("32146").text).toContain("Guard.");
    expect(raw("32147")).toMatchObject({ scheme: 1, is_unique: true });
    expect(raw("32148")).toMatchObject({ attack: 1, is_unique: true });
    const boosts = [
      ["32146", 0, true],
      ["32147", 3, false],
      ["32148", 3, false],
      ["32149", 2, false],
      ["32150", 2, false],
      ["32151", 2, false],
      ["32152", 2, false],
      ["32153", 0, true],
      ["32154", 0, true],
      ["32155", 1, false],
      ["32156", 4, false],
      ["32157", 0, true],
      ["32158", 3, false],
    ] as const;
    for (const [code, numeric, star] of boosts) {
      expect(raw(code).boost || 0, code).toBe(numeric);
      expect(!!raw(code).boost_star, code).toBe(star);
    }
    expect(raw("32156")).toMatchObject({
      base_threat: 4,
      base_threat_fixed: true,
      scheme_amplify: 1,
    });
    expect(raw("32157")).toMatchObject({
      base_threat: 2,
      base_threat_fixed: true,
      scheme_crisis: 1,
    });
    expect(raw("32158")).toMatchObject({
      base_threat: 3,
      scheme_acceleration: 1,
    });
    expect(raw("32158").base_threat_fixed).not.toBe(true);
  });

  it("does not infer Magnetic from a card's name", () => {
    expect(
      codes.filter((code) => /\bMagnetic\./.test(raw(code).traits || "")),
    ).toEqual([
      "32147",
      "32148",
      "32149",
      "32150",
      "32152",
      "32153",
      "32154",
      "32155",
      "32156",
      "32157",
      "32158",
    ]);
    expect(raw("32151").traits).toBeUndefined();
    expect(raw("32146").traits).toBe("Sentinel.");
  });

  it("preserves printed restrictions, paid basic-attack responses and THEN gating", () => {
    expect(raw("32147").text).toContain("Magneto cannot be confused");
    expect(raw("32148").text).toContain("Magneto cannot be stunned");
    for (const code of ["32147", "32148"]) {
      expect(raw(code).text).toContain("After your hero makes a basic attack");
      expect(raw(code).text).toContain(
        "spend [energy] [mental] [physical] resources → discard this card",
      );
    }
    expect(raw("32149").text).toContain("would take any amount of damage");
    expect(raw("32149").text).toContain("8 or more damage here");
    expect(raw("32150").text).toContain(
      "cannot thwart, attack, defend, or recover",
    );
    expect(raw("32150").text).toContain(
      "Exhaust your identity and spend a [physical]",
    );
    expect(raw("32155").text).toContain(
      "Defeat a [[Sentinel]] minion in play. Then, take 5 damage",
    );
    expect(keywordDeclarations(raw("32155")).map((k) => k.name)).toContain(
      "Surge",
    );
    expect(raw("32158").text).toContain("the player who defeated this scheme");
    expect(raw("32158").text).toContain("Discard cards under here");
  });
});

describe("Magneto source corrections and exact standalone registration", () => {
  it.each(["32141b", "32142b", "32143b"])(
    "applies current RRG 1.8 p68 errata to %s without changing the old printing",
    (code) => {
      expect(raw(code).text).toContain("Reveal that card, then remove 3");
      expect(card(code).text).toContain(
        "remove 3 of them and discard cards from the encounter deck",
      );
      expect(card(code).text).not.toContain("Reveal that card, then remove");
      expect(card(code).errata).toMatchObject({
        reference: "FFG Rules Reference 1.8, p. 68",
      });
      expect(card(code).errata?.url).toContain("#page=68");
    },
  );

  it("repairs the missing printed word MAGNET without rewriting its source snapshot", () => {
    expect(raw("32153").text).toContain("Place 1 counter on the main scheme");
    expect(card("32153").text).toContain(
      "Place 1 magnet counter on the main scheme",
    );
    expect(card("32153").errata).toBeUndefined();
  });

  it("registers exactly the 26 original scenario faces", () => {
    expect([...MAGNETO_SCRIPT_CODES]).toEqual(codes);
    for (const code of codes) {
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
      expect(hasExecutableScript(code), code).toBe(true);
    }
  });

  it("selects two ordinary villain stages and one replaceable Acolytes slot", () => {
    const scenario = VILLAINS.find((v) => v.id === "magneto");
    expect(scenario).toMatchObject({
      codes: ["32138", "32139", "32140"],
      schemes: ["32141b", "32142b", "32143b"],
      module: "acolytes",
    });
    expect(scenario?.fixedSets || []).toEqual([]);
    expect(scenarioModules("magneto")).toEqual(MODULES);
    expect(raw("32141a").text).toContain("One modular set");
    expect(raw("32141a").text).toContain(
      "Magneto (II) and Magneto (III) for expert",
    );
    expect(raw("32141a").text).toContain(
      "Set the Orbital Decay side scheme aside",
    );
    expect(raw("32141a").text).toContain(
      "Reveal the Boarding Party side scheme",
    );
  });
});
