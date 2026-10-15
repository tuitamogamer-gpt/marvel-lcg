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
import {
  MANSION_ATTACK_SCRIPT_CODES,
  type MansionAttackGameState,
} from "../src/game/mansion-attack.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import type { Aspect, Piece } from "../src/game/types.js";

const raw = (code: string) => catalog.find((c) => c.code === code)!;
// Independent transcription of the original English retail set, including
// the two side schemes beyond the four named-villain treacheries.
const codes = [
  "32121a",
  "32121b",
  "32122a",
  "32122b",
  "32123a",
  "32123b",
  "32124a",
  "32124b",
  "32125a",
  "32125b",
  "32126a",
  "32126b",
  "32127a",
  "32127b",
  "32128a",
  "32128b",
  "32129a",
  "32129b",
  "32130",
  "32131",
  "32132",
  "32133",
  "32134",
  "32135",
  "32136",
  "32137",
];
const roomFronts = ["32126a", "32127a", "32128a", "32129a"];
const roomBacks = ["32126b", "32127b", "32128b", "32129b"];
const physicalScenarioCounts = {
  "32121": 1,
  "32122": 1,
  "32123": 1,
  "32124": 1,
  "32125": 1,
  "32126": 1,
  "32127": 1,
  "32128": 1,
  "32129": 1,
  "32130": 1,
  "32131": 3,
  "32132": 2,
  "32133": 2,
  "32134": 2,
  "32135": 2,
  "32136": 2,
  "32137": 2,
};
const shuffledScenarioCounts = {
  "32131": 3,
  "32132": 2,
  "32133": 2,
  "32134": 2,
  "32135": 2,
  "32136": 2,
  "32137": 2,
};
const brotherhoodCounts = {
  "32073": 1,
  "32074": 1,
  "32075": 1,
  "32076": 1,
  "32077": 2,
  "32078": 1,
  "32079": 1,
};
const mystiqueCounts = {
  "32080": 1,
  "32081": 1,
  "32082": 2,
  "32083": 1,
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
    villainId: "mansion_attack",
    difficulty,
    modules: ["mystique"],
    seed: 32121,
    pacing: "expert",
    ...extra,
  });
  for (let guard = 0; (s.prompt || s.review) && guard < 32; guard++) {
    if (s.review) {
      s = dispatch(s, { type: "PROCEED" });
      continue;
    }
    expect(s.players.every((p) => p.player.hand.length === 0)).toBe(true);
    expect(s.prompt!.options.length).toBeGreaterThan(0);
    s = dispatch(s, { type: "CHOOSE", id: s.prompt!.options[0].id });
  }
  expect(s.prompt).toBeNull();
  expect(s.review).toBeNull();
  return s as MansionAttackGameState;
}

function physicalPieces(s: MansionAttackGameState): Piece[] {
  const roots = [
    s.villain,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.victoryDisplay || []),
    ...(s.mansionAttack?.villainDeck || []),
    ...(s.mansionAttack?.mainDeck || []),
    ...(s.mansionAttack?.currentMain ? [s.mansionAttack.currentMain] : []),
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
    ...(p.inheritorBoosts || []).flatMap(nested),
  ];
  return roots.flatMap(nested);
}
const physicalCode = (code: string) => code.replace(/[ab]$/, "");

describe("Mansion Attack original retail evidence", () => {
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

  it("contains all twenty-six faces and twenty-five actual retail cards", () => {
    expect(
      catalog.filter((c) => c.set_code === "mansion_attack").map((c) => c.code),
    ).toEqual(codes);
    expect(codes).toHaveLength(26);
    expect(
      Object.values(physicalScenarioCounts).reduce(
        (n, quantity) => n + quantity,
      ),
    ).toBe(25);
    for (const code of codes) {
      expect(raw(code).quantity, code).toBe(
        physicalScenarioCounts[
          physicalCode(code) as keyof typeof physicalScenarioCounts
        ],
      );
      expect((images as Record<string, string>)[code]).toBe(
        `/cards/catalog/${code}.webp`,
      );
      expect(
        existsSync(
          new URL(`../public/cards/catalog/${code}.webp`, import.meta.url),
        ),
        code,
      ).toBe(true);
      if (code.endsWith("a"))
        expect(raw(code).back_link).toBe(`${code.slice(0, -1)}b`);
    }
  });

  it("uses fifteen shuffled scenario cards, eight Brotherhood and five Mystique", () => {
    expect(
      Object.values(shuffledScenarioCounts).reduce(
        (n, quantity) => n + quantity,
      ),
    ).toBe(15);
    for (const [set, expected] of [
      ["brotherhood", brotherhoodCounts],
      ["mystique", mystiqueCounts],
    ] as const)
      expect(
        Object.fromEntries(
          catalog
            .filter((c) => c.set_code === set)
            .map((c) => [c.code, c.quantity]),
        ),
      ).toEqual(expected);
    expect(Object.values(brotherhoodCounts).reduce((n, q) => n + q)).toBe(8);
    expect(Object.values(mystiqueCounts).reduce((n, q) => n + q)).toBe(5);
  });

  it.each([
    ["32121a", "Avalanche", 2, 3, 15, "A"],
    ["32121b", "Avalanche", 2, 4, 18, "B"],
    ["32122a", "Blob", 1, 2, 16, "A"],
    ["32122b", "Blob", 2, 2, 19, "B"],
    ["32123a", "Pyro", 2, 0, 14, "A"],
    ["32123b", "Pyro", 2, 1, 17, "B"],
    ["32124a", "Toad", 2, 2, 13, "A"],
    ["32124b", "Toad", 3, 2, 16, "B"],
  ])(
    "retains original villain face %s",
    (code, name, scheme, attack, hp, stage) => {
      expect(raw(String(code))).toMatchObject({
        name,
        scheme,
        attack,
        attack_star: true,
        health: hp,
        health_per_hero: true,
        is_unique: true,
        stage,
        traits: "Brotherhood of Mutants.",
        quantity: 1,
      });
      expect(raw(String(code)).text).toContain("Toughness. Victory 2.");
      expect(raw(String(code)).text).not.toContain("When Revealed");
    },
  );

  it("retains the four distinct villain attack conditions", () => {
    for (const side of ["a", "b"]) {
      expect(raw(`32121${side}`).text).toContain(
        "After Avalanche attacks you, exhaust an ally you control.",
      );
      expect(raw(`32122${side}`).text).toContain(
        "After Blob attacks and damages a character, stun that character.",
      );
      expect(raw(`32123${side}`).text).toContain(
        "Take 1 indirect damage for each printed resource icon discarded this way.",
      );
      expect(raw(`32124${side}`).text).toContain(
        "After Toad attacks and damages a character you control, discard 1 random card from your hand.",
      );
    }
  });

  it("corrects only the four identical front titles without mutating their originals", () => {
    const originalFront = readFileSync(
      new URL("../public/cards/catalog/32126a.webp", import.meta.url),
    );
    expect(createHash("sha256").update(originalFront).digest("hex")).toBe(
      "49888914087cf09fe1d44cf5e401e1f9c2fccc6d90e3c8f6b3f664fd03fea9d1",
    );
    for (const code of roomFronts) {
      expect(
        createHash("sha256")
          .update(
            readFileSync(
              new URL(`../public/cards/catalog/${code}.webp`, import.meta.url),
            ),
          )
          .digest("hex"),
      ).toBe(
        "49888914087cf09fe1d44cf5e401e1f9c2fccc6d90e3c8f6b3f664fd03fea9d1",
      );
      expect(raw(code).name).toBe(raw(`${code.slice(0, -1)}b`).name);
      expect(card(code).name).toBe("Attack on Xavier's");
      expect(card(code).errata).toBeUndefined();
      expect(raw(code).text).toBe("<b>When Revealed</b>: Flip this card.");
    }
  });

  it.each([
    ["32126b", "The Atrium", "Each character gains steady."],
    ["32127b", "The Cafeteria", "Each character gains retaliate 1."],
    ["32128b", "The Basketball Court", "Each ally and minion gains toughness."],
    ["32129b", "The Courtyard", "Each character gains +1 ATK."],
  ])("retains original room threat and grant on %s", (code, name, text) => {
    const c = raw(code);
    expect(c).toMatchObject({
      name,
      base_threat: 1,
      escalation_threat: 1,
      threat: 7,
      stage: "2B",
    });
    expect(c.base_threat_fixed).toBeUndefined();
    expect(c.escalation_threat_fixed).toBeUndefined();
    expect(c.threat_fixed).toBeUndefined();
    expect(c.text).toContain(text);
    expect(c.text).toContain(
      "If there are 3 main schemes in the victory display",
    );
    expect(c.text).toContain("Add this scheme to the victory display.");
  });

  it("keeps the explicit opening deal, physical advancement and rulebook X", () => {
    expect(raw("32125a").text).toContain("Brotherhood, and Standard sets.");
    expect(raw("32125a").text).toContain("One modular set (<i>Mystique</i>).");
    expect(raw("32125a").text).toContain("Shuffle the villains together");
    expect(raw("32125a").text).toContain("without looking");
    expect(raw("32125b").text).toBe(
      "<b>When Revealed</b>: Deal each player a facedown encounter card. Advance to the next card in the main scheme deck. Add this card to the victory display.",
    );
    expect(raw("32130").text).toContain(
      "if there are X villains in the victory display",
    );
    expect(raw("32130").text).toContain("See rulebook, page 15.");
    expect(raw("32130").text).toContain("engaged with a player");
    expect(raw("32130").text).toContain(
      "the villain activates against that player",
    );
    expect(raw("32130").text).not.toContain("Permanent");
  });

  it.each([
    ["32132", "Avalanche"],
    ["32133", "Blob"],
    ["32134", "Pyro"],
    ["32135", "Toad"],
  ])(
    "retains both activation/search and matching-villain boost on %s",
    (code, name) => {
      expect(raw(code)).toMatchObject({
        quantity: 2,
        boost: 1,
        boost_star: true,
      });
      expect(raw(code).text).toContain(`${name} activates against you.`);
      expect(raw(code).text).toContain(
        "search the encounter deck and discard pile",
      );
      expect(raw(code).text).toContain(`${name} minion and reveal him.`);
      expect(raw(code).text).toContain(`If the villain is ${name}`);
      expect(raw(code).text).toContain(
        "an additional boost card for this activation",
      );
    },
  );

  it("retains Beatdown's complete named-enemy checklist and ordinary boost", () => {
    expect(raw("32131")).toMatchObject({ quantity: 3, boost: 2 });
    expect(raw("32131").boost_star).toBeUndefined();
    for (const text of [
      "For each of the following enemies in play:",
      "Avalanche, exhaust your identity.",
      "Blob, you are stunned.",
      "Pyro, take 2 indirect damage.",
      "Toad, discard 1 random card from your hand.",
    ])
      expect(raw("32131").text).toContain(text);
  });

  it("retains both two-copy side schemes and their actual threat/icons", () => {
    expect(raw("32136")).toMatchObject({
      quantity: 2,
      base_threat: 2,
      base_threat_fixed: true,
      scheme_crisis: 1,
      boost: 2,
    });
    expect(raw("32136").text).toContain("Hinder 2[per_hero].");
    expect(raw("32136").text).toContain(
      "The player who defeated this scheme searches their deck and discard pile for an ally and adds it to their hand.",
    );
    expect(raw("32137")).toMatchObject({
      quantity: 2,
      base_threat: 0,
      scheme_acceleration: 1,
      boost: 3,
    });
    expect(raw("32137").text).toContain(
      "Place 3 threat on this scheme for each [[Brotherhood of Mutants]] character in play.",
    );
  });

  it("retains scanned runtime metadata without inventing card text errata", () => {
    const fields = [
      "quantity",
      "type_code",
      "set_code",
      "attack",
      "attack_star",
      "scheme",
      "health",
      "health_per_hero",
      "is_unique",
      "traits",
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
      "text",
    ];
    for (const code of codes) {
      for (const field of fields)
        expect(
          (card(code) as unknown as Record<string, unknown>)[field],
          `${code}.${field}`,
        ).toEqual((raw(code) as Record<string, unknown>)[field]);
      if (!roomFronts.includes(code))
        expect(card(code).name).toBe(raw(code).name);
      expect(card(code).errata, code).toBeUndefined();
    }
  });
});

describe("Mansion Attack executable source acceptance", () => {
  it("registers the complete scenario and leaves later campaign/villain faces unsupported", () => {
    expect(MANSION_ATTACK_SCRIPT_CODES).toEqual(codes);
    for (const code of codes) {
      expect(hasExecutableScript(code), code).toBe(true);
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
    }
    for (const c of catalog.filter(
      (c) =>
        c.pack_code === "mut_gen" && c.position > 137 && c.code !== "32172b",
    ))
      expect(hasExecutableScript(c.code), c.code).toBe(false);
    expect(VILLAINS.some((v) => v.id === "magneto_villain")).toBe(false);
  });

  it("requires Brotherhood plus exactly one independently replaceable modular slot", () => {
    expect(VILLAINS.find((v) => v.id === "mansion_attack")).toMatchObject({
      codes: ["32121a", "32122a", "32123a", "32124a"],
      schemes: ["32125b", "32126b", "32127b", "32128b", "32129b"],
      module: "mystique",
      fixedSets: ["brotherhood"],
    });
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["brotherhood", "mystique"]),
    );
    expect(scenarioModules("mansion_attack").map((m) => m.id)).toContain(
      "mystique",
    );
    expect(scenarioModules("mansion_attack").map((m) => m.id)).not.toContain(
      "brotherhood",
    );
    for (const modules of [
      [],
      ["brotherhood"],
      ["brotherhood", "mystique"],
      ["future_past"],
    ])
      expect(() => create(1, "standard", { modules })).toThrow();
  });

  it.each([
    [1, "standard", 2],
    [2, "standard", 2],
    [3, "standard", 2],
    [1, "expert", 3],
    [2, "expert", 3],
    [3, "expert", 3],
  ] as const)(
    "constructs exact original %s-player %s setup with X=%s",
    (players, difficulty, x) => {
      const s = create(players, difficulty);
      const pieces = physicalPieces(s);
      expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
      expect(
        countsFor(
          pieces
            .filter((p) => codes.includes(p.code))
            .map((p) => physicalCode(p.code)),
        ),
      ).toEqual(physicalScenarioCounts);
      for (const counts of [
        shuffledScenarioCounts,
        brotherhoodCounts,
        mystiqueCounts,
      ])
        expect(
          countsFor(
            pieces
              .filter((p) => Object.hasOwn(counts, p.code))
              .map((p) => p.code),
          ),
        ).toEqual(counts);
      expect(s.mansionAttack?.winTarget).toBe(x);
      expect(s.mansionAttack?.villainDeck).toHaveLength(3);
      expect(s.mansionAttack?.mainDeck).toHaveLength(3);
      expect(roomBacks).toContain(s.scheme.code);
      expect(s.scheme.threat).toBe(players);
      expect(schemeLimit(s)).toBe(7 * players);
      expect(s.victoryDisplay?.filter((p) => p.code === "32125b")).toHaveLength(
        1,
      );
      expect(s.environments?.filter((p) => p.code === "32130")).toHaveLength(1);
      expect(s.encounter.dealt).toHaveLength(players);
      expect(s.modules).toEqual(["mystique"]);
      expect(s.phase).toBe("mulligan");
      expect(s.minions).toHaveLength(0);
      for (const villain of [s.villain, ...s.mansionAttack!.villainDeck])
        expect(
          villain.code.endsWith(difficulty === "standard" ? "a" : "b"),
        ).toBe(true);
      expect(s.villain.hp).toBe(raw(s.villain.code).health! * players);
      expect(s.villain.tough).toBe(true);
      const encounterPieces = pieces.filter(
        (p) => card(p).faction_code === "encounter",
      );
      expect(encounterPieces).toHaveLength(
        (difficulty === "standard" ? 45 : 48) + players,
      );
      expect(s.encounter.deck.length + s.encounter.dealt.length).toBe(
        (difficulty === "standard" ? 35 : 38) + players,
      );
      for (const [index, seat] of s.players.entries()) {
        const playerCards = pieces.filter(
          (p) =>
            p.ownerId === seat.id &&
            card(p).faction_code !== "encounter" &&
            !["hero", "alter_ego"].includes(card(p).type_code) &&
            !card(p).permanent &&
            !card(p).text?.includes("Permanent."),
        );
        expect(playerCards, seat.id).toHaveLength(40);
        const expected = Object.fromEntries(
          Object.entries(sourceFor(seats[index].heroCode).cards).filter(
            ([code]) =>
              !card(code).permanent && !card(code).text?.includes("Permanent."),
          ),
        );
        expect(countsFor(playerCards.map((p) => p.code)), seat.id).toEqual(
          expected,
        );
      }
      const restored = JSON.parse(JSON.stringify(s)) as MansionAttackGameState;
      expect(physicalPieces(restored).map((p) => [p.id, p.code])).toEqual(
        pieces.map((p) => [p.id, p.code]),
      );
    },
  );

  it("retains fixed Brotherhood when recommended Mystique is replaced", () => {
    const s = create(2, "standard", { modules: ["bomb_scare"] });
    const pieces = physicalPieces(s);
    expect(s.modules).toEqual(["bomb_scare"]);
    expect(
      countsFor(
        pieces
          .filter((p) => Object.hasOwn(brotherhoodCounts, p.code))
          .map((p) => p.code),
      ),
    ).toEqual(brotherhoodCounts);
    expect(pieces.some((p) => Object.hasOwn(mystiqueCounts, p.code))).toBe(
      false,
    );
    expect(s.environments?.filter((p) => p.code === "32130")).toHaveLength(1);
    expect(s.mansionAttack?.villainDeck).toHaveLength(3);
  });
});
