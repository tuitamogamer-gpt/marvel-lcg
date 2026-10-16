import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import sourceDecks from "../src/data/catalog-decks.json";
import images from "../src/data/catalog-images.json";
import { card, MODULES, scenarioModules, VILLAINS } from "../src/game/cards.js";
import { countsFor } from "../src/game/decks.js";
import { dispatch, newGame, schemeLimit } from "../src/game/engine.js";
import { EXPLICIT_CARD_SCRIPTS } from "../src/game/engine-support.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { MASTER_MOLD_SCRIPT_CODES } from "../src/game/master-mold.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";

const raw = (code: string) => catalog.find((c) => c.code === code)!;
const scenarioCodes = [
  "32109",
  "32110",
  "32111",
  "32112a",
  "32112b",
  "32113a",
  "32113b",
  "32114",
  "32115",
  "32116",
  "32117",
  "32118",
  "32119",
  "32120",
];
const codes = [...scenarioCodes, "32172b"];
const physicalEncounterCounts = {
  "32114": 2,
  "32115": 2,
  "32116": 2,
  "32117": 2,
  "32118": 2,
  "32119": 1,
  "32120": 2,
  "32101": 2,
  "32102": 2,
  "32103": 2,
  "32104": 1,
  "32105": 2,
  "32106": 2,
  "32107": 2,
  "32108": 1,
};
const seats = [
  { heroId: "colossus", heroCode: "32001a", aspect: "protection" as Aspect },
  { heroId: "shadowcat", heroCode: "32030a", aspect: "aggression" as Aspect },
  { heroId: "spider_man", heroCode: "01001a", aspect: "justice" as Aspect },
];
const sourceFor = (heroCode: string) =>
  sourceDecks.find((d) => d.heroCode === heroCode)!;
function create(
  players = 1,
  difficulty: "standard" | "expert" = "standard",
  extra: Partial<Parameters<typeof newGame>[0]> = {},
) {
  let s = newGame({
    heroId: seats[0].heroId,
    aspect: seats[0].aspect,
    heroes: seats.slice(0, players).map(({ heroId, heroCode, aspect }) => ({
      heroId,
      aspect,
      deckCards: Object.entries(sourceFor(heroCode).cards).flatMap(
        ([code, quantity]) => Array(quantity).fill(code) as string[],
      ),
    })),
    villainId: "master_mold",
    difficulty,
    modules: ["zero_tolerance"],
    seed: 32109,
    pacing: "expert",
    ...extra,
  });
  for (let guard = 0; s.prompt && guard < 16; guard++) {
    expect(s.players.every((p) => p.player.hand.length === 0)).toBe(true);
    expect(s.prompt.options.length).toBeGreaterThan(0);
    s = dispatch(s, { type: "CHOOSE", id: s.prompt.options[0].id });
  }
  expect(s.prompt).toBeNull();
  return s;
}
function physicalPieces(s: GameState): Piece[] {
  const roots = [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.victoryDisplay || []),
    ...s.players.flatMap((seat) => [
      ...seat.player.deck,
      ...seat.player.hand,
      ...seat.player.discard,
      ...seat.player.inPlay,
    ]),
  ];
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.captured || []).flatMap(nested),
    ...(p.storedCards || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  return roots.flatMap(nested);
}

describe("Master Mold original retail evidence", () => {
  it("preserves original catalog, deck and image-index bytes", () => {
    const hashes = {
      "catalog-cards.json":
        "c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb",
      "catalog-decks.json":
        "6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886",
      "catalog-images.json":
        "fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d",
    };
    for (const [file, expected] of Object.entries(hashes))
      expect(
        createHash("sha256")
          .update(readFileSync(new URL(`../src/data/${file}`, import.meta.url)))
          .digest("hex"),
        file,
      ).toBe(expected);
  });

  it("has fourteen original scenario faces and one separately required ally face", () => {
    expect(
      catalog.filter((c) => c.set_code === "master_mold").map((c) => c.code),
    ).toEqual(scenarioCodes);
    expect(scenarioCodes).toHaveLength(14);
    expect(codes).toHaveLength(15);
    expect(raw("32172b")).toMatchObject({
      faction_code: "campaign",
      set_code: "mut_gen_campaign",
      type_code: "ally",
    });
    expect(raw("32172a")).toMatchObject({
      type_code: "side_scheme",
      name: "Enemy of My Enemy",
      back_link: "32172b",
    });
    for (const code of codes) {
      expect((images as Record<string, string>)[code]).toBe(
        `/cards/catalog/${code}.webp`,
      );
      expect(
        existsSync(
          new URL(`../public/cards/catalog/${code}.webp`, import.meta.url),
        ),
        code,
      ).toBe(true);
    }
  });

  it("counts eighteen scenario cards and thirteen shuffled scenario cards", () => {
    const physical = scenarioCodes.reduce(
      (total, code) =>
        total +
        (code.endsWith("b") && scenarioCodes.includes(`${code.slice(0, -1)}a`)
          ? 0
          : raw(code).quantity),
      0,
    );
    expect(physical).toBe(18);
    expect(physical + raw("32172b").quantity).toBe(19);
    expect(
      Object.entries(physicalEncounterCounts)
        .filter(([code]) => Number(code) >= 32114)
        .reduce((total, [, quantity]) => total + quantity, 0),
    ).toBe(13);
    for (const [code, quantity] of Object.entries(physicalEncounterCounts))
      expect(raw(code).quantity, code).toBe(quantity);
    for (const [a, b] of [
      ["32112a", "32112b"],
      ["32113a", "32113b"],
    ]) {
      expect(raw(a)).toMatchObject({ quantity: 1, back_link: b });
      expect(raw(b).quantity).toBe(1);
    }
  });

  it.each([
    ["32109", 1, 2, 12, "I"],
    ["32110", 2, 3, 14, "II"],
    ["32111", 3, 4, 16, "III"],
  ])(
    "retains printed unique villain stage %s",
    (code, scheme, attack, health, stage) => {
      expect(raw(String(code))).toMatchObject({
        scheme,
        scheme_star: true,
        attack,
        health,
        health_per_hero: true,
        is_unique: true,
        stage,
        traits: "Sentinel.",
      });
      expect(raw(String(code)).text).toContain("Stalwart. Toughness.");
      expect(raw(String(code)).text).toContain(
        "Do not give Master Mold a boost card",
      );
      expect(raw(String(code)).text).not.toContain("When Revealed");
    },
  );

  it.each([
    ["32112b", 6],
    ["32113b", 8],
  ])(
    "preserves per-player main threat and Sentinel-only Guard on %s",
    (code, limit) => {
      const c = raw(String(code));
      expect(c).toMatchObject({
        base_threat: 1,
        escalation_threat: 1,
        threat: limit,
      });
      expect(c.base_threat_fixed).toBeUndefined();
      expect(c.escalation_threat_fixed).toBeUndefined();
      expect(c.threat_fixed).toBeUndefined();
      expect(c.text).toContain("Each [[Sentinel]] minion gains guard.");
    },
  );

  it("retains actual side-scheme threat, icons and Victory", () => {
    expect(raw("32119")).toMatchObject({
      base_threat: 3,
      scheme_crisis: 1,
      boost: 3,
    });
    expect(raw("32119").base_threat_fixed).toBeUndefined();
    expect(raw("32120")).toMatchObject({
      base_threat: 2,
      base_threat_fixed: true,
      scheme_acceleration: 1,
      boost: 2,
      quantity: 2,
    });
    expect(raw("32120").text).toContain("Hinder 2[per_hero]. Victory 1.");
    expect(raw("32120").text).toContain(
      "Deal 2 damage to each [[Sentinel]] enemy.",
    );
  });

  it("retains actual minion and printed attachment values separately from text", () => {
    expect(raw("32114")).toMatchObject({
      scheme: 3,
      attack: 3,
      health: 8,
      boost: 2,
    });
    expect(raw("32114").text).toContain("After this minion engages you");
    expect(raw("32115")).toMatchObject({
      scheme: 1,
      attack: 1,
      boost_star: true,
    });
    expect(raw("32115").boost).toBeUndefined();
    expect(raw("32115").health).toBeUndefined();
    expect(raw("32115").text).toContain("+2 hit points and gains retaliate 1");
    expect(raw("32116")).toMatchObject({
      attack: 1,
      attack_star: true,
      boost: 2,
    });
    expect(raw("32116").text).toContain("without Stun Beam attached");
    expect(raw("32116").text).toContain("attacks and damages a character");
    expect(raw("32117").boost).toBe(1);
    expect(raw("32118").boost_star).toBe(true);
    expect(raw("32118").boost).toBeUndefined();
  });

  it("preserves Magneto's dash cost, ordinary ally powers and limited optional heal", () => {
    expect(raw("32172b")).toMatchObject({
      is_unique: true,
      subname: "Erik Lehnsherr",
      thwart: 2,
      attack: 3,
      attack_star: true,
      thwart_cost: 1,
      attack_cost: 1,
      health: 5,
      resource_wild: 1,
    });
    expect(raw("32172b").cost).toBeUndefined();
    expect(raw("32172b").text).toContain("Victory 1.");
    expect(raw("32172b").text).toContain("The first player controls Magneto.");
    expect(raw("32172b").text).toContain(
      "does not count against your ally limit",
    );
    expect(raw("32172b").text).toContain(
      "attacks and defeats a [[SENTINEL]] minion",
    );
    expect(raw("32172b").text).not.toContain("Hero Response");
  });

  it("retains scanned metadata in runtime presentation without inventing errata", () => {
    const fields = [
      "quantity",
      "type_code",
      "set_code",
      "attack",
      "attack_star",
      "scheme",
      "scheme_star",
      "thwart",
      "attack_cost",
      "thwart_cost",
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
      "boost",
      "boost_star",
      "back_link",
      "resource_wild",
      "text",
    ];
    for (const code of codes) {
      for (const field of fields)
        expect(
          (card(code) as unknown as Record<string, unknown>)[field],
          `${code}.${field}`,
        ).toEqual((raw(code) as Record<string, unknown>)[field]);
      expect(card(code).errata, code).toBeUndefined();
    }
  });
});

describe("Master Mold executable source acceptance", () => {
  it("registers the required ally without claiming its reverse or later scenarios", () => {
    expect(MASTER_MOLD_SCRIPT_CODES).toEqual(codes);
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

  it("requires fixed Sentinels and exactly one independently replaceable modular slot", () => {
    expect(VILLAINS.find((v) => v.id === "master_mold")).toMatchObject({
      codes: ["32109", "32110", "32111"],
      schemes: ["32112b", "32113b"],
      module: "zero_tolerance",
      fixedSets: ["sentinels"],
    });
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["sentinels", "zero_tolerance"]),
    );
    expect(scenarioModules("master_mold").map((m) => m.id)).toContain(
      "zero_tolerance",
    );
    expect(scenarioModules("master_mold").map((m) => m.id)).not.toContain(
      "sentinels",
    );
    for (const modules of [
      [],
      ["sentinels"],
      ["sentinels", "zero_tolerance"],
      ["future_past"],
    ])
      expect(() => create(1, "standard", { modules })).toThrow();
  });

  it.each([1, 2, 3])(
    "constructs exact Standard source pieces for %s players",
    (players) => {
      const s = create(players);
      const pieces = physicalPieces(s);
      expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
      expect(
        countsFor(
          pieces
            .filter((p) => Object.hasOwn(physicalEncounterCounts, p.code))
            .map((p) => p.code),
        ),
      ).toEqual(physicalEncounterCounts);
      expect(s.phase).toBe("mulligan");
      expect(s.villain).toMatchObject({
        code: "32109",
        hp: 12 * players,
        stage: 1,
        tough: true,
      });
      expect(s.scheme).toMatchObject({ code: "32112b", threat: players });
      expect(schemeLimit(s)).toBe(6 * players);
      expect(s.modules).toEqual(["zero_tolerance"]);
      expect(s.minions).toHaveLength(players);
      for (const [index, seat] of s.players.entries()) {
        const engaged = s.minions.filter((p) => p.engagedWith === seat.id);
        expect(engaged, seat.id).toHaveLength(1);
        expect(card(engaged[0]).traits).toContain("Sentinel.");
        const deckPieces = pieces.filter(
          (p) =>
            p.ownerId === seat.id &&
            p.code !== "32172b" &&
            !["hero", "alter_ego"].includes(card(p).type_code) &&
            !card(p).permanent &&
            !card(p).text?.includes("Permanent."),
        );
        expect(deckPieces, seat.id).toHaveLength(40);
        const source = sourceFor(seats[index].heroCode);
        const expected = Object.fromEntries(
          Object.entries(source.cards).filter(
            ([code]) =>
              !card(code).permanent && !card(code).text?.includes("Permanent."),
          ),
        );
        expect(countsFor(deckPieces.map((p) => p.code)), seat.id).toEqual(
          expected,
        );
      }
      expect(
        s.players[0].player.inPlay.filter((p) => p.code === "32172b"),
      ).toHaveLength(1);
      expect(pieces.filter((p) => p.code === "32172b")).toHaveLength(1);
      expect(s.sideSchemes.some((p) => p.code === "32104")).toBe(false);
      expect(s.projectWideawake).toBeUndefined();
      expect(pieces.some((p) => p.code === "32172a")).toBe(false);
      const encounterPieces = pieces.filter(
        (p) => card(p).faction_code === "encounter",
      );
      expect(encounterPieces).toHaveLength(34 + players);
      const restored = JSON.parse(JSON.stringify(s)) as GameState;
      expect(physicalPieces(restored).map((p) => [p.id, p.code])).toEqual(
        pieces.map((p) => [p.id, p.code]),
      );
    },
  );

  it.each([1, 2, 3])(
    "starts Expert at actual Stage II for %s players without invented encounter deals",
    (players) => {
      const s = create(players, "expert");
      expect(s.villain).toMatchObject({
        code: "32110",
        hp: 14 * players,
        stage: 2,
        tough: true,
      });
      expect(s.encounter.dealt).toHaveLength(0);
      expect(
        physicalPieces(s).filter((p) => card(p).faction_code === "encounter"),
      ).toHaveLength(37 + players);
    },
  );

  it("retains required Sentinels when recommended Zero Tolerance is replaced", () => {
    const s = create(2, "standard", { modules: ["bomb_scare"] });
    const pieces = physicalPieces(s);
    expect(s.modules).toEqual(["bomb_scare"]);
    for (const code of ["32105", "32106", "32107", "32108"])
      expect(pieces.filter((p) => p.code === code)).toHaveLength(
        raw(code).quantity,
      );
    expect(
      pieces.some((p) => ["32101", "32102", "32103", "32104"].includes(p.code)),
    ).toBe(false);
    expect(pieces.filter((p) => p.code === "32172b")).toHaveLength(1);
    expect(s.minions).toHaveLength(2);
  });
});
