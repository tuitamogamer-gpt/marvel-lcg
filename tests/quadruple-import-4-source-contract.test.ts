import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import sourceDecks from "../src/data/catalog-decks.json";
import images from "../src/data/catalog-images.json";

type SourceCard = (typeof catalog)[number];
const raw = (code: string) => catalog.find((c) => c.code === code)!;
const sum = (counts: Record<string, number | undefined>) =>
  Object.values(counts).reduce<number>(
    (total, count) => total + (count ?? 0),
    0,
  );
const quantities = (cards: SourceCard[]) =>
  Object.fromEntries(cards.map((c) => [c.code, c.quantity]));
const resources = (code: string) => {
  const c = raw(code);
  return [
    c.resource_energy ?? 0,
    c.resource_mental ?? 0,
    c.resource_physical ?? 0,
    c.resource_wild ?? 0,
  ];
};
const specs = [
  {
    id: "bishop",
    pack: "aoa",
    first: 45001,
    last: 45029,
    faces: 30,
    physical: 47,
    name: "Bishop",
    alterEgo: "Lucas Bishop",
    aspect: "leadership",
    stats: [2, 2, 1, 4, 12],
    factions: { hero: 15, leadership: 20, basic: 5 },
    required: {
      "45002": 1,
      "45003": 1,
      "45004": 1,
      "45005": 1,
      "45006": 2,
      "45007": 2,
      "45008": 2,
      "45009": 2,
      "45010": 3,
    },
    obligation: "45025",
    nemesis: { "45026": 1, "45027": 1, "45028": 1, "45029": 2 },
    supplementary: {},
  },
  {
    id: "magik",
    pack: "aoa",
    first: 45030,
    last: 45058,
    faces: 30,
    physical: 47,
    name: "Magik",
    alterEgo: "Illyana Rasputin",
    aspect: "aggression",
    stats: [2, 1, 2, 3, 10],
    factions: { hero: 15, aggression: 16, basic: 9 },
    required: {
      "45031": 1,
      "45032": 1,
      "45033": 1,
      "45034": 1,
      "45035": 1,
      "45036": 1,
      "45037": 3,
      "45038": 2,
      "45039": 2,
      "45040": 2,
    },
    obligation: "45053",
    nemesis: {
      "45054": 1,
      "45055": 1,
      "45056": 1,
      "45057": 1,
      "45058": 1,
    },
    supplementary: {},
  },
  {
    id: "iceman",
    pack: "iceman",
    first: 46001,
    last: 46032,
    faces: 33,
    physical: 59,
    name: "Iceman",
    alterEgo: "Bobby Drake",
    aspect: "aggression",
    stats: [2, 1, 2, 4, 11],
    factions: { hero: 15, aggression: 15, basic: 10 },
    required: {
      "46003": 2,
      "46004": 1,
      "46005": 1,
      "46006": 1,
      "46007": 2,
      "46008": 1,
      "46009": 2,
      "46010": 2,
      "46011": 3,
    },
    obligation: "46024",
    nemesis: { "46025": 1, "46026": 1, "46027": 1, "46028": 2 },
    supplementary: { "46002": 6 },
  },
  {
    id: "jubilee",
    pack: "jubilee",
    first: 47001,
    last: 47034,
    faces: 41,
    physical: 59,
    name: "Jubilee",
    alterEgo: "Jubilation Lee",
    aspect: "justice",
    stats: [1, 1, 2, 3, 9],
    factions: { hero: 15, justice: 14, basic: 11 },
    required: {
      "47002": 1,
      "47003": 1,
      "47004": 1,
      "47005": 1,
      "47006": 1,
      "47007a": 1,
      "47007b": 1,
      "47007c": 1,
      "47008a": 1,
      "47008b": 1,
      "47008c": 1,
      "47009": 1,
      "47010a": 1,
      "47010b": 1,
      "47010c": 1,
    },
    obligation: "47023",
    nemesis: { "47024": 1, "47025": 1, "47026": 1, "47027": 2 },
    supplementary: {},
  },
];
const scopedCards = (spec: (typeof specs)[number]) =>
  catalog.filter(
    (c) =>
      c.pack_code === spec.pack &&
      Number(c.code.slice(0, 5)) >= spec.first &&
      Number(c.code.slice(0, 5)) <= spec.last,
  );
const allScopedCards = specs.flatMap(scopedCards);

describe("batch four: independent immutable source contract", () => {
  it("preserves the original catalog, published source compositions and artwork index byte for byte", () => {
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

  it("pins exactly 134 faces on 212 physical cards, counting only identity reverses as the same piece", () => {
    expect(allScopedCards).toHaveLength(134);
    expect(new Set(allScopedCards.map((c) => c.code)).size).toBe(134);
    expect(
      allScopedCards
        .filter((c) => c.type_code !== "alter_ego")
        .reduce((n, c) => n + c.quantity, 0),
    ).toBe(212);
    expect(
      allScopedCards.filter((c) => c.type_code === "alter_ego"),
    ).toHaveLength(4);
  });

  it("restricts Age of Apocalypse to its sixty hero/player/obligation/nemesis faces", () => {
    const boxed = allScopedCards.filter((c) => c.pack_code === "aoa");
    expect(boxed).toHaveLength(60);
    expect(Math.max(...boxed.map((c) => Number(c.code.slice(0, 5))))).toBe(
      45058,
    );
    expect(catalog.filter((c) => c.pack_code === "aoa")).toHaveLength(220);
    expect(
      catalog.filter(
        (c) => c.pack_code === "aoa" && Number(c.code.slice(0, 5)) >= 45059,
      ),
    ).toHaveLength(160);
    expect(boxed.some((c) => c.type_code === "villain")).toBe(false);
  });

  for (const spec of specs) {
    const source = sourceDecks.find(
      (deck) => deck.heroCode === `${spec.first}a`,
    )!;
    const cards = scopedCards(spec);

    it(`${spec.id}: pins its complete source slice, physical quantities and original printing IDs`, () => {
      expect(cards).toHaveLength(spec.faces);
      expect(
        cards
          .filter((c) => c.type_code !== "alter_ego")
          .reduce((n, c) => n + c.quantity, 0),
      ).toBe(spec.physical);
      for (const c of cards) {
        expect(c.quantity, c.code).toBeGreaterThan(0);
        expect(c.pack_code, c.code).toBe(spec.pack);
        expect(images[c.code as keyof typeof images], c.code).toBe(
          `/cards/catalog/${c.code}.webp`,
        );
        expect(
          existsSync(
            new URL(`../public/cards/catalog/${c.code}.webp`, import.meta.url),
          ),
          c.code,
        ).toBe(true);
      }
    });

    it(`${spec.id}: retains the visually checked identity faces and printed statistics`, () => {
      const hero = raw(`${spec.first}a`);
      const alterEgo = raw(`${spec.first}b`);
      expect(hero.name).toBe(spec.name);
      expect(alterEgo.name).toBe(spec.alterEgo);
      expect(hero.back_link).toBe(alterEgo.code);
      expect(hero.type_code).toBe("hero");
      expect(alterEgo.type_code).toBe("alter_ego");
      expect([
        hero.attack,
        hero.thwart,
        hero.defense,
        alterEgo.recover,
        hero.health,
      ]).toEqual(spec.stats);
      expect(alterEgo.health).toBe(hero.health);
      expect(hero.hand_size).toBe(5);
      expect(alterEgo.hand_size).toBe(6);
      expect(hero.image_url?.toLowerCase()).toContain(`${spec.first}a.jpg`);
      expect(alterEgo.image_url?.toLowerCase()).toContain(`${spec.first}b.jpg`);
    });

    it(`${spec.id}: preserves its exact forty-card published source and fifteen counted signatures`, () => {
      expect(source.sourceType).toBe("source-preconstructed");
      expect(source.sourceUrl).toBe(
        "https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747",
      );
      expect(source.packCode).toBe(spec.pack);
      expect(source.aspect).toBe(spec.aspect);
      expect(source.aspects).toEqual([spec.aspect]);
      expect(source.deckSize).toBe(40);
      expect(sum(source.cards)).toBe(40);
      expect(source.setupCards).toEqual({});
      expect(source.supplementaryCards).toEqual(spec.supplementary);
      const countedSignatures = Object.fromEntries(
        Object.entries(source.cards).filter(
          ([code]) => raw(code).faction_code === "hero",
        ),
      );
      expect(countedSignatures).toEqual(spec.required);
      expect(sum(countedSignatures)).toBe(15);
      const factions: Record<string, number> = {};
      for (const [code, count] of Object.entries(source.cards)) {
        if (!count) continue;
        const c = raw(code);
        expect(
          cards.some((candidate) => candidate.code === code),
          code,
        ).toBe(true);
        expect(c.quantity, code).toBeGreaterThanOrEqual(count);
        expect(["hero", "alter_ego", "obligation"], code).not.toContain(
          c.type_code,
        );
        expect(c.faction_code, code).not.toBe("encounter");
        expect(c.text ?? "", code).not.toMatch(/\bPermanent\./);
        factions[c.faction_code] = (factions[c.faction_code] ?? 0) + count;
      }
      expect(factions).toEqual(spec.factions);
    });

    it(`${spec.id}: pins one original obligation and five physical nemesis cards`, () => {
      expect(raw(spec.obligation).type_code).toBe("obligation");
      expect(raw(spec.obligation).quantity).toBe(1);
      expect(raw(spec.obligation).set_code).toBe(spec.id);
      const nemeses = cards.filter((c) => c.set_code === `${spec.id}_nemesis`);
      expect(quantities(nemeses)).toEqual(spec.nemesis);
      expect(sum(quantities(nemeses))).toBe(5);
    });
  }

  it("keeps Iceman's six actual Permanent Frostbites outside every forty-card playing composition", () => {
    const frostbite = raw("46002");
    expect(frostbite.quantity).toBe(6);
    expect(frostbite.type_code).toBe("upgrade");
    expect(frostbite.set_code).toBe("iceman_frostbite");
    expect(frostbite.text).toContain("Permanent.");
    expect(frostbite.text).toContain("Attached enemy gets -1 SCH and -1 ATK.");
    expect(frostbite.text).toContain("set this card aside");
    expect(raw("46001b").text).toContain(
      "begins the game with 6 Frostbite upgrades set aside",
    );
    for (const spec of specs) {
      const source = sourceDecks.find(
        (deck) => deck.heroCode === `${spec.first}a`,
      )!;
      expect(source.cards["46002"]).toBeUndefined();
    }
  });

  it("preserves nine separate Jubilee physical printings rather than mistaking their suffixes for reverse faces", () => {
    const expected: Record<string, number[]> = {
      "47007a": [1, 0, 0, 0],
      "47007b": [0, 1, 0, 0],
      "47007c": [0, 0, 1, 0],
      "47008a": [1, 0, 0, 0],
      "47008b": [0, 1, 0, 0],
      "47008c": [0, 0, 1, 0],
      "47010a": [1, 1, 0, 0],
      "47010b": [1, 0, 1, 0],
      "47010c": [0, 1, 1, 0],
    };
    const source = sourceDecks.find((deck) => deck.heroCode === "47001a")!;
    for (const [code, icons] of Object.entries(expected)) {
      expect(resources(code), code).toEqual(icons);
      expect(raw(code).quantity, code).toBe(1);
      expect(raw(code).back_link, code).toBeUndefined();
      expect(source.cards[code as keyof typeof source.cards], code).toBe(1);
    }
    expect(
      new Set(Object.keys(expected).map((code) => raw(code).octgn_id)).size,
    ).toBe(9);
    expect(source.cards["47022"]).toBe(1);
    expect(raw("47022").quantity).toBe(2);
    expect(raw("47022").text).toContain("Max 1 per deck.");
  });

  it("pins Sauron and Arcade as separate six-card and five-card modular sets", () => {
    const sauron = catalog.filter((c) => c.set_code === "sauron");
    expect(quantities(sauron)).toEqual({
      "46029": 1,
      "46030": 1,
      "46031": 1,
      "46032": 3,
    });
    expect(sum(quantities(sauron))).toBe(6);
    const arcade = catalog.filter((c) => c.set_code === "arcade");
    expect(quantities(arcade)).toEqual({
      "47030": 1,
      "47031": 1,
      "47032": 1,
      "47033": 1,
      "47034": 1,
    });
    expect(sum(quantities(arcade))).toBe(5);
  });

  it("distinguishes fixed Shopping Spree from per-player Victory schemes and the printed Trap hinder values", () => {
    expect(raw("47003").base_threat).toBe(2);
    expect(raw("47003").base_threat_fixed).toBe(true);
    expect(raw("47003").text).not.toMatch(/Victory/);
    expect(raw("47003").text).toContain(
      "Threat cannot be removed from this scheme by heroes or allies.",
    );
    expect(raw("47001b").text).toContain("Search your deck for");
    expect(raw("47001b").text).not.toMatch(/Setup|discard pile/);
    for (const [code, threat] of [
      ["46018", 2],
      ["47016", 3],
    ] as const) {
      expect(raw(code).base_threat).toBe(threat);
      expect(raw(code).base_threat_fixed).not.toBe(true);
      expect(raw(code).text).toContain("Victory 0.");
    }
    for (const code of ["47031", "47032", "47033"]) {
      expect(raw(code).base_threat).toBe(2);
      expect(raw(code).base_threat_fixed).toBe(true);
      expect(raw(code).text).toContain("Hinder 1[per_hero].");
      expect(raw(code).traits).toBe("Trap!");
    }
  });

  it("pins genuine reprint provenance while retaining original expansion printing IDs", () => {
    const expected = {
      "45013": "04016",
      "45018": "01070",
      "45019": "01072",
      "45022": "01088",
      "45023": "01089",
      "45024": "01090",
      "45046": "18012",
      "45047": "01055",
      "45052": "15019",
      "46017": "16043",
      "46021": "12024",
      "46022": "15031",
      "46023": "13024",
      "47017": "01062",
      "47020": "38019",
    };
    expect(
      Object.fromEntries(
        allScopedCards
          .filter((c) => c.duplicate_of)
          .map((c) => [c.code, c.duplicate_of]),
      ),
    ).toEqual(expected);
  });

  it("preserves printed boost stars separately from numeric boosts and Lost Child's printed SCH modifier", () => {
    for (const code of ["45058", "46028", "46029"]) {
      expect(raw(code).boost ?? 0, code).toBe(0);
      expect(raw(code).text, code).toContain("<b>Boost</b>");
    }
    expect(raw("47027").scheme).toBe(-1);
    expect(raw("47027").text).toContain("equal to its printed THW");
    expect(raw("47026").attack).toBe(1);
    expect(raw("47026").text).toContain("+3 hit points");
    expect(raw("45017").text).toContain("attached to that ally");
  });
});
