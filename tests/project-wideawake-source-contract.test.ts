import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import images from "../src/data/catalog-images.json";
import { card, MODULES, scenarioModules, VILLAINS } from "../src/game/cards.js";
import { countsFor } from "../src/game/decks.js";
import { dispatch, newGame, schemeLimit } from "../src/game/engine.js";
import { EXPLICIT_CARD_SCRIPTS } from "../src/game/engine-support.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { PROJECT_WIDEAWAKE_SCRIPT_CODES } from "../src/game/project-wideawake.js";
import {
  ZERO_TOLERANCE_SCRIPT_CODES,
  zeroToleranceIsPermanent,
} from "../src/game/zero-tolerance.js";
import { SENTINELS_SCRIPT_CODES } from "../src/game/sentinels.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";

const raw = (code: string) => catalog.find((c) => c.code === code)!;
const scenarioCodes = [
  "32084",
  "32085",
  "32086",
  "32087a",
  "32087b",
  "32088a",
  "32088b",
  "32089",
  "32090",
  "32091",
  "32092",
  "32093",
  "32094",
  "32095",
  "32096",
  "32097",
  "32098",
  "32099",
  "32100",
];
const zeroCodes = ["32101", "32102", "32103", "32104"];
const sentinelCodes = ["32105", "32106", "32107", "32108"];
const codes = [...scenarioCodes, ...zeroCodes, ...sentinelCodes];
const physicalEncounterCounts = {
  "32088a": 1,
  "32089": 1,
  "32090": 1,
  "32091": 1,
  "32092": 1,
  "32093": 2,
  "32094": 2,
  "32095": 1,
  "32096": 1,
  "32097": 1,
  "32098": 2,
  "32099": 2,
  "32100": 4,
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
  { heroId: "colossus", aspect: "protection" as Aspect },
  { heroId: "shadowcat", aspect: "aggression" as Aspect },
  { heroId: "spider_man", aspect: "justice" as Aspect },
];
const create = (
  players = 1,
  difficulty: "standard" | "expert" = "standard",
  extra: Partial<Parameters<typeof newGame>[0]> = {},
) => {
  let s = newGame({
    heroId: seats[0].heroId,
    aspect: seats[0].aspect,
    heroes: seats.slice(0, players),
    villainId: "project_wideawake",
    difficulty,
    modules: ["sentinels"],
    seed: 32084,
    pacing: "expert",
    ...extra,
  });
  // A native search may offer the four real Abduction copies. Resolve only
  // that setup choice, before opening hands and any player Setup abilities.
  for (let guard = 0; s.prompt && guard < 8; guard++) {
    expect(s.players.every((p) => p.player.hand.length === 0)).toBe(true);
    expect(s.prompt.options.length).toBeGreaterThan(0);
    expect(s.prompt.options.every((o) => o.image === "32100")).toBe(true);
    s = dispatch(s, { type: "CHOOSE", id: s.prompt.options[0].id });
  }
  expect(s.prompt).toBeNull();
  return s;
};
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
    ...(s.projectWideawake?.setAsideCaptives || []),
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

describe("Project Wideawake original retail evidence", () => {
  it("freezes original catalog, decks and artwork bytes", () => {
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

  it("has exactly nineteen scenario faces, four Zero Tolerance faces and four Sentinels faces", () => {
    expect(
      catalog
        .filter(
          (c) =>
            c.pack_code === "mut_gen" && c.position >= 84 && c.position <= 108,
        )
        .map((c) => c.code),
    ).toEqual(codes);
    expect(scenarioCodes).toHaveLength(19);
    expect(zeroCodes).toHaveLength(4);
    expect(sentinelCodes).toHaveLength(4);
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

  it("counts reversible faces once and preserves each actual retail quantity", () => {
    const physical = (selected: string[]) =>
      selected.reduce(
        (sum, code) =>
          sum +
          (code.endsWith("b") && selected.includes(code.slice(0, -1) + "a")
            ? 0
            : raw(code).quantity),
        0,
      );
    expect(physical(scenarioCodes)).toBe(24);
    expect(physical(zeroCodes)).toBe(7);
    expect(physical(sentinelCodes)).toBe(7);
    expect(physical(codes)).toBe(38);
    for (const [code, quantity] of Object.entries(physicalEncounterCounts))
      expect(raw(code).quantity, code).toBe(quantity);
    for (const [a, b] of [
      ["32087a", "32087b"],
      ["32088a", "32088b"],
    ]) {
      expect(raw(a)).toMatchObject({ quantity: 1, back_link: b });
      expect(raw(b).quantity).toBe(1);
    }
  });

  it.each([
    ["32084", 2, 2, 16, "I"],
    ["32085", 2, 3, 18, "II"],
    ["32086", 3, 3, 22, "III"],
  ])(
    "preserves non-unique Sentinel stage %s and its printed per-player HP",
    (code, scheme, attack, health, stage) => {
      expect(raw(String(code))).toMatchObject({
        scheme,
        attack,
        health,
        health_per_hero: true,
        stage,
      });
      expect(raw(String(code)).is_unique).toBeUndefined();
      expect(raw(String(code)).text).toContain("Toughness");
    },
  );

  it("keeps the no-limit main scheme and fixed bases distinct from per-player threat", () => {
    expect(raw("32087b")).toMatchObject({
      base_threat: 1,
      escalation_threat: 1,
    });
    expect(raw("32087b").threat).toBeUndefined();
    expect(raw("32087b").base_threat_fixed).toBeUndefined();
    expect(raw("32087b").escalation_threat_fixed).toBeUndefined();
    expect(raw("32088a")).toMatchObject({
      base_threat: 4,
      base_threat_fixed: true,
      scheme_acceleration: 1,
    });
    expect(raw("32100")).toMatchObject({
      base_threat: 2,
      base_threat_fixed: true,
      scheme_crisis: 1,
      quantity: 4,
      boost: 2,
    });
    expect(raw("32100").text).toContain("Hinder 2[per_hero]. Victory 2.");
    for (const code of ["32104", "32108"]) {
      expect(raw(code).base_threat).toBe(3);
      expect(raw(code).base_threat_fixed).toBeUndefined();
    }
    expect(raw("32108").scheme_hazard).toBe(1);
  });

  it.each([
    ["32088b", 0, 1, 1, "Jubilation Lee"],
    ["32089", 2, 1, 1, "Julio Richter"],
    ["32090", 2, 1, 1, "Tabitha Smith"],
    ["32091", 2, 1, 2, "Sam Guthrie"],
    ["32092", 2, 1, 2, "Rahne Sinclair"],
  ])(
    "retains the actual ally %s's unique name, resources and consequential costs",
    (code, cost, thwart, attack, subname) => {
      expect(raw(String(code))).toMatchObject({
        type_code: "ally",
        cost,
        thwart,
        attack,
        health: 3,
        attack_cost: 1,
        thwart_cost: 1,
        resource_wild: 1,
        is_unique: true,
        subname,
      });
      if (code !== "32088b") {
        expect(raw(String(code)).attack_star).toBe(true);
        expect(raw(String(code)).traits).toBe("Captive. X-Men.");
      }
    },
  );

  it.each([
    ["32093", 2, 2, 4],
    ["32101", 1, 2, 2],
    ["32102", 2, 3, 3],
    ["32105", 1, 3, 5],
  ])(
    "retains the original minion %s's SCH/ATK/HP",
    (code, scheme, attack, health) => {
      expect(raw(String(code))).toMatchObject({
        scheme,
        attack,
        health,
        quantity: 2,
      });
      expect(raw(String(code)).is_unique).toBeUndefined();
    },
  );

  it("preserves star-only boosts as zero and the Gauntlet's star plus one triangle", () => {
    for (const code of ["32093", "32095", "32096", "32097", "32102", "32106"]) {
      expect(raw(code).boost_star, code).toBe(true);
      expect(raw(code).boost, code).toBeUndefined();
      expect(card(code).boost || 0, code).toBe(0);
    }
    expect(raw("32094")).toMatchObject({
      boost: 1,
      boost_star: true,
      attack: 1,
      attack_star: true,
      quantity: 2,
    });
    expect(raw("32095").scheme).toBe(1);
    expect(raw("32103")).toMatchObject({
      attack: 2,
      attack_star: true,
      boost: 1,
    });
    expect(raw("32096").health).toBeUndefined();
    expect(raw("32096").text).toContain("+8 hit points");
    for (const code of ["32098", "32099", "32100", "32105", "32107"])
      expect(raw(code).boost, code).toBe(2);
    for (const code of ["32104", "32108"])
      expect(raw(code).boost, code).toBe(3);
  });

  it("corrects Stage III's scan transcription without rewriting the downloaded text", () => {
    expect(raw("32085").text).toContain("Deal each other player");
    expect(card("32085").text).toContain("Deal each other player");
    expect(raw("32086").text).toContain("Deal each other player");
    expect(card("32086").text).toContain(
      "Deal each player a facedown encounter card.",
    );
    expect(card("32086").errata).toBeUndefined();
  });

  it("restores Mall's printed boost separately from its published ally-only erratum", () => {
    expect(raw("32088a").boost).toBeUndefined();
    expect(card("32088a").boost).toBe(1);
    expect(raw("32088a").text).toContain("any other version of Jubilee");
    expect(card("32088a").text).toContain("any other ally version of Jubilee");
    expect(card("32088a").errata).toMatchObject({
      reference: "FFG Rules Reference 1.8, p. 68",
    });
    expect(card("32088a").errata?.url).toContain("#page=68");
    expect(raw("32088b").text).toContain("Victory -1.");
    expect(card("32088b").text).toContain("Victory -1.");
  });

  it("corrects Wolfsbane spelling and Mark VI's five printed HP as printing metadata", () => {
    expect(raw("32092").text).toBe("[star] Wolfbane's attacks gain piercing.");
    expect(card("32092").text).toBe(
      "[star] Wolfsbane's attacks gain piercing.",
    );
    expect(raw("32106")).toMatchObject({
      health: 6,
      scheme: 2,
      attack: 2,
      quantity: 2,
    });
    expect(card("32106").health).toBe(5);
    expect(card("32092").errata).toBeUndefined();
    expect(card("32106").errata).toBeUndefined();
  });

  it("retains every other imported numeric and uniqueness field in the runtime database", () => {
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
    ];
    for (const code of codes)
      for (const field of fields) {
        if (
          (code === "32088a" && field === "boost") ||
          (code === "32106" && field === "health")
        )
          continue;
        expect(
          (card(code) as unknown as Record<string, unknown>)[field],
          `${code}.${field}`,
        ).toEqual((raw(code) as Record<string, unknown>)[field]);
      }
  });
});

describe("Project Wideawake executable source acceptance", () => {
  it("registers all twenty-seven exact faces without promising unsupported later box faces", () => {
    expect(PROJECT_WIDEAWAKE_SCRIPT_CODES).toEqual(scenarioCodes);
    expect(ZERO_TOLERANCE_SCRIPT_CODES).toEqual(zeroCodes);
    expect(SENTINELS_SCRIPT_CODES).toEqual(sentinelCodes);
    for (const code of codes) {
      expect(hasExecutableScript(code), code).toBe(true);
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
    }
    for (const c of catalog.filter(
      (c) =>
        c.pack_code === "mut_gen" && c.position > 120 && c.code !== "32172b",
    ))
      expect(hasExecutableScript(c.code), c.code).toBe(false);
    expect(
      VILLAINS.filter((v) =>
        ["mansion_attack", "magneto_villain"].includes(v.id),
      ),
    ).toEqual([]);
  });

  it("requires fixed Zero Tolerance and exactly one separate replaceable modular set", () => {
    expect(VILLAINS.find((v) => v.id === "project_wideawake")).toMatchObject({
      codes: ["32084", "32085", "32086"],
      schemes: ["32087b"],
      module: "sentinels",
      fixedSets: ["zero_tolerance"],
    });
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["zero_tolerance", "sentinels"]),
    );
    expect(scenarioModules("project_wideawake").map((m) => m.id)).toContain(
      "sentinels",
    );
    expect(scenarioModules("project_wideawake").map((m) => m.id)).not.toContain(
      "zero_tolerance",
    );
    for (const modules of [
      [],
      ["zero_tolerance"],
      ["sentinels", "zero_tolerance"],
      ["future_past"],
    ])
      expect(() => create(1, "standard", { modules })).toThrow();
  });

  it.each([1, 2, 3])(
    "constructs exact Standard source pieces for %s players before mulligan",
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
        code: "32084",
        hp: 16 * players,
        stage: 1,
        tough: true,
      });
      expect(s.scheme).toMatchObject({ code: "32087b", threat: players });
      expect(schemeLimit(s)).toBe(0);
      expect(s.sideSchemes.find((p) => p.code === "32088a")?.counters).toBe(4);
      const operation = s.sideSchemes.find((p) => p.code === "32104")!;
      expect(operation.counters).toBe(3 * players);
      expect(zeroToleranceIsPermanent(s, operation)).toBe(true);
      expect(s.sideSchemes.filter((p) => p.code === "32100")).toHaveLength(1);
      expect(s.sideSchemes.find((p) => p.code === "32100")?.counters).toBe(
        2 + 2 * players,
      );
      expect(s.encounter.deck).toHaveLength(34 + players);
      expect(s.modules).toEqual(["sentinels"]);
      expect(
        s.projectWideawake?.setAsideCaptives.map((p) => p.code).sort(),
      ).toEqual(["32089", "32090", "32091", "32092"]);
      expect(
        pieces.some(
          (p) =>
            raw(p.code)?.pack_code === "mut_gen" && raw(p.code).position > 108,
        ),
      ).toBe(false);
    },
  );

  it.each([1, 2, 3])(
    "constructs exact Expert initial Stage II and encounter deals for %s players",
    (players) => {
      const s = create(players, "expert");
      expect(s.villain).toMatchObject({
        code: "32085",
        hp: 18 * players,
        stage: 2,
        tough: true,
      });
      expect(s.sideSchemes.find((p) => p.code === "32100")?.counters).toBe(
        2 + 2 * players,
      );
      expect(s.encounter.dealt).toHaveLength(players - 1);
      expect(s.encounter.dealt.map((p) => p.dealtTo)).toEqual(
        seats.slice(1, players).map((_, i) => `p${i + 2}`),
      );
      expect(s.encounter.deck.length + s.encounter.dealt.length).toBe(
        37 + players,
      );
      expect(s.projectWideawake?.captureAllocation).toEqual([
        2,
        ...Array(players - 1).fill(0),
      ]);
    },
  );

  it("captures the recommended group total, supports zero and records chosen owners without losing forty-card decks", () => {
    for (const [difficulty, heroic, total] of [
      ["standard", 0, 1],
      ["expert", 0, 2],
      ["standard", 1, 3],
    ] as const) {
      const s = create(3, difficulty, { heroic });
      const ozt = s.sideSchemes.find((p) => p.code === "32104")!;
      expect(ozt.captured).toHaveLength(total);
      expect(ozt.captured?.every((p) => p.ownerId === "p1")).toBe(true);
      expect(s.projectWideawake?.captureAllocation).toEqual([total, 0, 0]);
    }
    const s = create(3, "expert", { captureAllocation: [0, 1, 1] });
    const ozt = s.sideSchemes.find((p) => p.code === "32104")!;
    expect(ozt.captured?.map((p) => p.ownerId)).toEqual(["p2", "p3"]);
    expect(s.projectWideawake?.captureAllocation).toEqual([0, 1, 1]);
    const all = physicalPieces(s);
    for (const seat of s.players) {
      const owned = all.filter(
        (p) =>
          p.ownerId === seat.id &&
          card(p).type_code !== "hero" &&
          card(p).type_code !== "alter_ego" &&
          !card(p).permanent &&
          !card(p).text?.includes("Permanent."),
      );
      expect(owned, seat.id).toHaveLength(40);
    }
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(restored.projectWideawake?.captureAllocation).toEqual([0, 1, 1]);
    expect(
      restored.sideSchemes
        .find((p) => p.id === ozt.id)
        ?.captured?.map((p) => ({ id: p.id, ownerId: p.ownerId })),
    ).toEqual(ozt.captured?.map((p) => ({ id: p.id, ownerId: p.ownerId })));
    expect(
      create(3, "expert", { captureAllocation: [0, 0, 0] }).sideSchemes.find(
        (p) => p.code === "32104",
      )?.captured || [],
    ).toEqual([]);
  });

  it("rejects malformed, negative, fractional or immediately terminal setup allocations", () => {
    for (const captureAllocation of [
      [],
      [1],
      [0, -1, 0],
      [0, 0.5, 0],
      [0, 6, 0],
    ])
      expect(() => create(3, "standard", { captureAllocation })).toThrow();
  });
});
