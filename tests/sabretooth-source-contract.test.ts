import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { card, MODULES, VILLAINS } from "../src/game/cards.js";
import { countsFor } from "../src/game/decks.js";
import { dispatch, newGame, schemeLimit } from "../src/game/engine.js";
import { EXPLICIT_CARD_SCRIPTS } from "../src/game/engine-support.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { BROTHERHOOD_SCRIPT_CODES } from "../src/game/brotherhood.js";
import { MYSTIQUE_SCRIPT_CODES } from "../src/game/mystique.js";
import { SABRETOOTH_SCRIPT_CODES } from "../src/game/sabretooth.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";

const raw = (code: string) => catalog.find((c) => c.code === code)!;
const scenarioCodes = [
  "32060",
  "32061",
  "32062",
  "32063a",
  "32063b",
  "32064a",
  "32064b",
  "32065a",
  "32065b",
  "32066",
  "32067",
  "32068",
  "32069",
  "32070",
  "32071",
  "32072",
];
const brotherhoodCodes = [
  "32073",
  "32074",
  "32075",
  "32076",
  "32077",
  "32078",
  "32079",
];
const mystiqueCodes = ["32080", "32081", "32082", "32083"];
const codes = [...scenarioCodes, ...brotherhoodCodes, ...mystiqueCodes];
const encounterCounts = {
  "32067": 1,
  "32068": 1,
  "32069": 2,
  "32070": 3,
  "32071": 2,
  "32072": 1,
  "32073": 1,
  "32074": 1,
  "32075": 1,
  "32076": 1,
  "32077": 2,
  "32078": 1,
  "32079": 1,
  "32080": 1,
  "32081": 1,
  "32082": 2,
  "32083": 1,
};
const seats = [
  { heroId: "colossus", aspect: "protection" as Aspect },
  { heroId: "shadowcat", aspect: "aggression" as Aspect },
  { heroId: "spider_man", aspect: "justice" as Aspect },
];
const create = (
  players = 1,
  difficulty: "standard" | "expert" = "standard",
  extra: Partial<Parameters<typeof newGame>[0]> = {},
) =>
  newGame({
    heroId: seats[0].heroId,
    aspect: seats[0].aspect,
    heroes: seats.slice(0, players),
    villainId: "sabretooth",
    difficulty,
    modules: ["brotherhood", "mystique"],
    seed: 32060,
    pacing: "expert",
    ...extra,
  });
function allEncounterPieces(s: GameState): Piece[] {
  return [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
  ];
}

describe("Sabretooth original retail source contract", () => {
  it("freezes imported catalog, deck and image bytes", () => {
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

  it("imports exactly the sixteen scenario, seven Brotherhood and four Mystique faces", () => {
    expect(
      catalog
        .filter(
          (c) =>
            c.pack_code === "mut_gen" && c.position >= 60 && c.position <= 83,
        )
        .map((c) => c.code),
    ).toEqual(codes);
    expect(SABRETOOTH_SCRIPT_CODES).toEqual(scenarioCodes);
    expect(BROTHERHOOD_SCRIPT_CODES).toEqual(brotherhoodCodes);
    expect(MYSTIQUE_SCRIPT_CODES).toEqual(mystiqueCodes);
    for (const code of codes) {
      expect(hasExecutableScript(code), code).toBe(true);
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
    }
    for (const c of catalog.filter(
      (c) =>
        c.pack_code === "mut_gen" &&
        c.position > 137 &&
        c.set_code !== "acolytes" &&
        c.code !== "32172b",
    ))
      expect(hasExecutableScript(c.code), c.code).toBe(false);
    expect(VILLAINS.filter((v) => v.id === "magneto_villain")).toEqual([]);
  });

  it("counts double faces once: seventeen scenario and thirteen modular physical pieces", () => {
    const physical = (selected: string[]) =>
      selected.reduce(
        (total, code) =>
          total +
          (code.endsWith("b") && selected.includes(code.slice(0, -1) + "a")
            ? 0
            : raw(code).quantity),
        0,
      );
    expect(physical(scenarioCodes)).toBe(17);
    expect(physical(brotherhoodCodes)).toBe(8);
    expect(physical(mystiqueCodes)).toBe(5);
    expect(physical(codes)).toBe(30);
    for (const [a, b] of [
      ["32063a", "32063b"],
      ["32064a", "32064b"],
      ["32065a", "32065b"],
    ]) {
      expect(raw(a)).toMatchObject({ quantity: 1, back_link: b });
      expect(raw(b).quantity).toBe(1);
    }
    for (const [code, quantity] of Object.entries(encounterCounts))
      expect(raw(code).quantity, code).toBe(quantity);
  });

  it("retains all printed numerical and uniqueness metadata as imported", () => {
    const fields = [
      "quantity",
      "type_code",
      "set_code",
      "attack",
      "attack_star",
      "scheme",
      "scheme_star",
      "thwart",
      "cost",
      "health",
      "health_per_hero",
      "is_unique",
      "base_threat",
      "base_threat_fixed",
      "threat",
      "threat_fixed",
      "escalation_threat",
      "escalation_threat_fixed",
      "scheme_crisis",
      "scheme_hazard",
      "scheme_acceleration",
      "scheme_amplify",
      "boost",
      "boost_star",
      "back_link",
    ];
    for (const code of codes)
      for (const field of fields)
        expect(
          (card(code) as unknown as Record<string, unknown>)[field],
          `${code}.${field}`,
        ).toEqual((raw(code) as Record<string, unknown>)[field]);
  });

  it.each([
    ["32060", 1, 2, 13, "I"],
    ["32061", 2, 2, 15, "II"],
    ["32062", 2, 3, 18, "III"],
  ])(
    "preserves Sabretooth stage %s's per-player HP and stars",
    (code, scheme, attack, health, stage) => {
      expect(raw(String(code))).toMatchObject({
        scheme,
        attack,
        health,
        stage,
        health_per_hero: true,
        is_unique: true,
        scheme_star: true,
        attack_star: true,
        quantity: 1,
      });
    },
  );

  it("preserves Kelly's unique nine HP, dash powers and one physical mission flip", () => {
    expect(raw("32066")).toMatchObject({
      is_unique: true,
      health: 9,
      cost: 0,
      attack: null,
      thwart: null,
      quantity: 1,
    });
    for (const field of [
      "resource_energy",
      "resource_mental",
      "resource_physical",
      "resource_wild",
    ])
      expect((raw("32066") as Record<string, unknown>)[field]).toBeUndefined();
    expect(raw("32065a")).toMatchObject({
      base_threat: 5,
      scheme_crisis: 1,
      back_link: "32065b",
    });
    expect(raw("32065b").type_code).toBe("environment");
  });

  it("keeps fixed printed base threat separate from per-player Hinder", () => {
    expect(raw("32071")).toMatchObject({
      base_threat: 2,
      base_threat_fixed: true,
      scheme_acceleration: 1,
      quantity: 2,
    });
    expect(raw("32072")).toMatchObject({
      base_threat: 4,
      base_threat_fixed: true,
      scheme_crisis: 1,
    });
    expect(raw("32079")).toMatchObject({
      base_threat: 3,
      base_threat_fixed: true,
      scheme_hazard: 1,
    });
    expect(raw("32081")).toMatchObject({
      base_threat: 3,
      base_threat_fixed: true,
      scheme_amplify: 1,
    });
    expect(raw("32071").text).toContain("Hinder 2");
    expect(raw("32079").text).toContain("Hinder 2");
    expect(raw("32071").text).toContain("Victory 1");
  });

  it("does not turn printed boost stars into numerical icons", () => {
    for (const code of ["32067", "32068", "32069"]) {
      expect(raw(code).boost_star, code).toBe(true);
      expect(card(code).boost || 0, code).toBe(0);
    }
    for (const code of ["32073", "32076", "32077"])
      expect(raw(code)).toMatchObject({ boost: 1, boost_star: true });
    expect(raw("32067")).toMatchObject({ attack: 1, attack_star: true });
  });

  it("retains unique Brotherhood stars and variable Mystique stats", () => {
    const minions = [
      ["32073", 1, 3, 5],
      ["32074", 1, 2, 6],
      ["32075", 2, 0, 4],
      ["32076", 2, 2, 3],
    ];
    for (const [code, scheme, attack, health] of minions)
      expect(raw(String(code))).toMatchObject({
        scheme,
        attack,
        health,
        attack_star: true,
        is_unique: true,
      });
    expect(raw("32080")).toMatchObject({
      health: 9,
      is_unique: true,
      scheme_star: true,
      attack_star: true,
      boost: 3,
    });
    expect(raw("32080").attack).toBeUndefined();
    expect(raw("32080").scheme).toBeUndefined();
    expect(raw("32080").text).toContain("cannot attack the villain");
    expect(raw("32080").text).not.toContain("Guard");
  });

  it("keeps original Shapeshifter text and printed boost counts without fake player resources", () => {
    for (const [code, boost, quantity] of [
      ["32082", 1, 2],
      ["32083", 2, 1],
    ] as const) {
      expect(raw(code)).toMatchObject({
        boost,
        quantity,
        traits: "Shapeshifter.",
      });
      for (const field of [
        "resource_energy",
        "resource_mental",
        "resource_physical",
        "resource_wild",
      ])
        expect((raw(code) as Record<string, unknown>)[field]).toBeUndefined();
    }
    // A source transcription typo is retained; execution follows the original scan's "and reveal her".
    expect(raw("32083").text).toContain("an reveal her");
  });

  it("registers a two-stage standalone scenario with two distinct modular slots", () => {
    expect(VILLAINS.find((v) => v.id === "sabretooth")).toMatchObject({
      codes: ["32060", "32061", "32062"],
      schemes: ["32063b", "32064b"],
      module: "brotherhood",
      moduleCount: 2,
      defaultModules: ["brotherhood", "mystique"],
    });
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["brotherhood", "mystique"]),
    );
    expect(() => create(1, "standard", { modules: ["brotherhood"] })).toThrow();
    expect(() =>
      create(1, "standard", { modules: ["brotherhood", "brotherhood"] }),
    ).toThrow();
    expect(() =>
      create(1, "standard", { modules: ["brotherhood", "future_past"] }),
    ).toThrow();
  });

  it.each([1, 2, 3])(
    "creates exact normal encounter quantities for %s players and no campaign pieces",
    (players) => {
      const s = create(players);
      const encounters = allEncounterPieces(s);
      expect(
        countsFor(
          encounters
            .filter((p) => Object.hasOwn(encounterCounts, p.code))
            .map((p) => p.code),
        ),
      ).toEqual(encounterCounts);
      expect(s.encounter.deck).toHaveLength(30 + players);
      expect(s.modules).toEqual(["brotherhood", "mystique"]);
      expect(s.module).toBe("brotherhood");
      expect(s.villain).toMatchObject({
        code: "32060",
        hp: 13 * players,
        stage: 1,
      });
      expect(s.scheme).toMatchObject({ code: "32063b", threat: 0, index: 0 });
      expect(schemeLimit(s)).toBe(0);
      expect(
        encounters.some((p) =>
          ["32060", "32061", "32062", "32066", "32065b"].includes(p.code),
        ),
      ).toBe(false);
      expect(
        encounters.some(
          (p) =>
            raw(p.code)?.pack_code === "mut_gen" && raw(p.code).position >= 84,
        ),
      ).toBe(false);
    },
  );

  it.each([1, 2, 3])(
    "creates exact expert staging for %s players",
    (players) => {
      const s = create(players, "expert");
      expect(s.villain).toMatchObject({
        code: "32061",
        hp: 15 * players,
        stage: 2,
        tough: true,
      });
      expect(s.encounter.deck).toHaveLength(33 + players);
      expect(s.sabretooth?.startingDamage).toBe(2);
    },
  );

  it("defaults Kelly damage by recommended difficulty, allows zero and persists the exact override", () => {
    expect(create().sabretooth?.startingDamage).toBe(1);
    expect(
      create(1, "standard", { heroic: 1 }).sabretooth?.startingDamage,
    ).toBe(3);
    for (const senatorDamage of [0, 8]) {
      const s = create(1, "expert", { senatorDamage });
      expect(s.sabretooth?.startingDamage).toBe(senatorDamage);
      expect(s.sabretooth?.kelly?.damage).toBe(senatorDamage);
      expect(JSON.parse(JSON.stringify(s)).sabretooth.startingDamage).toBe(
        senatorDamage,
      );
    }
    for (const senatorDamage of [-1, 9, 1.5])
      expect(() => create(1, "standard", { senatorDamage })).toThrow();
  });

  it("keeps one uncontrolled attached Kelly and the same physical Find through opening confirmation", () => {
    const initial = create();
    const kellyId = initial.sabretooth!.kelly!.id;
    const findId = initial.sideSchemes.find((p) => p.code === "32065a")!.id;
    expect(initial.sabretooth!.kelly).toMatchObject({
      code: "32066",
      attachedTo: findId,
      damage: 1,
    });
    expect(initial.sabretooth!.controllerId).toBeUndefined();
    expect(
      initial.players
        .flatMap((p) => p.player.inPlay)
        .some((p) => p.id === kellyId),
    ).toBe(false);
    const ready = dispatch(initial, { type: "MULLIGAN", ids: [] });
    expect(ready.sabretooth!.kelly!.id).toBe(kellyId);
    expect(ready.sideSchemes.find((p) => p.code === "32065a")!.id).toBe(findId);
    expect(ready.sideSchemes.find((p) => p.id === findId)!.counters).toBe(5);
  });

  it("restores legacy primary selection with its distinct recommended second set", () => {
    const s = create(1, "standard", { modules: undefined, module: "mystique" });
    expect(s.modules).toEqual(["mystique", "brotherhood"]);
    expect(
      countsFor(
        allEncounterPieces(s)
          .filter((p) => Object.hasOwn(encounterCounts, p.code))
          .map((p) => p.code),
      ),
    ).toEqual(encounterCounts);
  });
});
