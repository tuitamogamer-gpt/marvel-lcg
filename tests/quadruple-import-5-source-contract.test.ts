import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import importedDecks from "../src/data/catalog-decks.json";
import images from "../src/data/catalog-images.json";

const raw = (code: string) => catalog.find((c) => c.code === code)!;
const sum = (values: Record<string, number | undefined>) =>
  Object.values(values).reduce<number>((n, value) => n + (value ?? 0), 0);
const decks = importedDecks as unknown as {
  heroCode: string;
  packCode: string;
  aspect: string;
  aspects: string[];
  cards: Record<string, number>;
  setupCards: Record<string, number>;
  supplementaryCards: Record<string, number>;
  deckSize: number;
  sourceType: string;
  sourceUrl: string;
  sourceUrls: string[];
}[];
const specs = [
  {
    id: "nightcrawler",
    pack: "ncrawler",
    first: 48001,
    last: 48038,
    faces: 39,
    physical: 59,
    name: "Nightcrawler",
    identity: "Kurt Wagner",
    stats: [1, 2, 3, 3, 9],
    aspect: "protection",
    aspects: ["protection"],
    factions: { hero: 15, protection: 20, basic: 5 },
    obligation: "48026",
    nemesis: { "48027": 1, "48028": 1, "48029": 1, "48030": 2 },
    source: {
      "48002": 1,
      "48003": 1,
      "48004": 1,
      "48005": 1,
      "48006": 3,
      "48007": 2,
      "48008": 1,
      "48009": 2,
      "48010": 1,
      "48011": 2,
      "48012": 1,
      "48013": 1,
      "48014": 3,
      "48015": 3,
      "48016": 3,
      "48017": 3,
      "48018": 3,
      "48019": 2,
      "48020": 1,
      "48021": 1,
      "48022": 1,
      "48023": 1,
      "48024": 1,
      "48025": 1,
    },
    setup: {},
  },
  {
    id: "magneto",
    pack: "magneto",
    first: 49001,
    last: 49042,
    faces: 43,
    physical: 59,
    name: "Magneto",
    identity: "Erik Lehnsherr",
    stats: [2, 2, 2, 3, 10],
    aspect: "leadership",
    aspects: ["leadership"],
    factions: { hero: 15, leadership: 17, basic: 8 },
    obligation: "49027",
    nemesis: { "49028": 1, "49029": 1, "49030": 1, "49031": 1, "49032": 1 },
    source: {
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
    },
    setup: {},
  },
  {
    id: "maria_hill",
    pack: "aos",
    first: 50001,
    last: 50033,
    faces: 34,
    physical: 48,
    name: "Maria Hill",
    identity: "Maria Hill",
    stats: [1, 2, 2, 3, 9],
    aspect: "multi",
    aspects: ["leadership", "aggression", "justice", "protection"],
    factions: {
      hero: 15,
      leadership: 12,
      aggression: 1,
      justice: 1,
      protection: 1,
      basic: 10,
    },
    obligation: "50029",
    nemesis: { "50030": 1, "50031": 1, "50032": 1, "50033": 2 },
    source: {
      "50002": 1,
      "50003": 2,
      "50004": 2,
      "50005": 3,
      "50006": 1,
      "50007": 2,
      "50008": 1,
      "50009": 1,
      "50010": 1,
      "50011": 1,
      "50012": 1,
      "50013": 1,
      "50014": 3,
      "50015": 3,
      "50016": 3,
      "50017": 1,
      "50018": 1,
      "50019": 1,
      "50020": 1,
      "50021": 1,
      "50022": 1,
      "50023": 1,
      "50024": 1,
      "50025": 1,
      "50026": 1,
      "50027": 1,
      "50028": 3,
    },
    setup: {},
  },
  {
    id: "nick_fury",
    pack: "aos",
    first: 50034,
    last: 50063,
    faces: 32,
    physical: 47,
    name: "Nick Fury",
    identity: "Nick Fury",
    stats: [2, 2, 2, 4, 10],
    aspect: "justice",
    aspects: ["justice"],
    factions: { hero: 15, justice: 17, basic: 8 },
    obligation: "50059",
    nemesis: { "50060": 1, "50061": 1, "50062": 2, "50063": 1 },
    source: {
      "50024": 1,
      "50035a": 1,
      "50036": 1,
      "50037": 2,
      "50038": 3,
      "50039": 2,
      "50040": 1,
      "50041": 1,
      "50042": 1,
      "50043": 1,
      "50044": 1,
      "50045": 1,
      "50046": 1,
      "50047": 1,
      "50048": 1,
      "50049": 3,
      "50050": 3,
      "50051": 3,
      "50052": 3,
      "50053": 3,
      "50054": 1,
      "50055": 1,
      "50056": 1,
      "50057": 1,
      "50058": 3,
    },
    setup: { "50035a": 1 },
  },
];
const scoped = (spec: (typeof specs)[number]) =>
  catalog.filter(
    (c) =>
      c.pack_code === spec.pack &&
      Number(c.code.slice(0, 5)) >= spec.first &&
      Number(c.code.slice(0, 5)) <= spec.last,
  );
const batch = specs.flatMap(scoped);
const physical = (cards: typeof catalog) =>
  cards.filter((c) => !c.hidden).reduce((n, c) => n + c.quantity, 0);

describe("batch five: independent immutable source contract", () => {
  it("preserves imported records, original source lists and artwork mapping bytes", () => {
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

  it("pins 148 unique faces on 213 physical cards, respecting declared hidden reverse faces", () => {
    expect(batch).toHaveLength(148);
    expect(new Set(batch.map((c) => c.code)).size).toBe(148);
    expect(physical(batch)).toBe(213);
    expect(
      batch
        .filter((c) => c.hidden)
        .map((c) => c.code)
        .sort(),
    ).toEqual(["48001b", "49001b", "50001b", "50034b", "50035b"]);
  });

  for (const spec of specs) {
    const source = decks.find((deck) => deck.heroCode === `${spec.first}a`)!;
    const cards = scoped(spec);

    it(`${spec.id}: retains its exact source face boundary, quantities and local original artwork`, () => {
      expect(cards).toHaveLength(spec.faces);
      expect(physical(cards)).toBe(spec.physical);
      for (const c of cards) {
        expect(c.quantity, c.code).toBeGreaterThan(0);
        expect(c.pack_code, c.code).toBe(spec.pack);
        const image = (images as Record<string, string>)[c.code];
        expect(image, c.code).toBe(`/cards/catalog/${c.code}.webp`);
        expect(
          existsSync(new URL(`../public${image}`, import.meta.url)),
          c.code,
        ).toBe(true);
      }
    });

    it(`${spec.id}: matches the visually inspected hero/alter scans and printed stats`, () => {
      const hero = raw(`${spec.first}a`),
        alter = raw(`${spec.first}b`);
      expect(hero.name).toBe(spec.name);
      expect(alter.name).toBe(spec.identity);
      expect(hero.type_code).toBe("hero");
      expect(alter.type_code).toBe("alter_ego");
      expect(hero.back_link).toBe(alter.code);
      expect([
        hero.attack,
        hero.thwart,
        hero.defense,
        alter.recover,
        hero.health,
      ]).toEqual(spec.stats);
      expect(alter.health).toBe(hero.health);
      expect([hero.hand_size, alter.hand_size]).toEqual([5, 6]);
    });

    it(`${spec.id}: preserves the exact source printings, counted forty-card deck and starter aspect metadata`, () => {
      expect(source.sourceType).toBe("source-preconstructed");
      expect(source.sourceUrl).toBe(
        "https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747",
      );
      expect(source.cards).toEqual(spec.source);
      expect(source.setupCards).toEqual(spec.setup);
      expect(source.supplementaryCards).toEqual({});
      expect(source.packCode).toBe(spec.pack);
      expect(source.aspect).toBe(spec.aspect);
      expect(source.aspects).toEqual(spec.aspects);
      expect(source.deckSize).toBe(40);
      expect(sum(source.cards) - sum(source.setupCards)).toBe(40);
      const factions: Record<string, number> = {};
      for (const [code, quantity] of Object.entries(source.cards)) {
        const c = raw(code);
        expect(
          batch.some((face) => face.code === code),
          code,
        ).toBe(true);
        expect(c.quantity, code).toBeGreaterThanOrEqual(quantity);
        expect(
          [
            "hero",
            "alter_ego",
            "obligation",
            "minion",
            "treachery",
            "side_scheme",
          ],
          code,
        ).not.toContain(c.type_code);
        if (source.setupCards[code]) continue;
        factions[c.faction_code] = (factions[c.faction_code] || 0) + quantity;
      }
      expect(factions).toEqual(spec.factions);
    });

    it(`${spec.id}: pins its original obligation and five physical nemesis cards`, () => {
      expect(raw(spec.obligation).type_code).toBe("obligation");
      expect(raw(spec.obligation).set_code).toBe(spec.id);
      const nemesis = Object.fromEntries(
        cards
          .filter((c) => c.set_code === `${spec.id}_nemesis`)
          .map((c) => [c.code, c.quantity]),
      );
      expect(nemesis).toEqual(spec.nemesis);
      expect(sum(nemesis)).toBe(5);
    });
  }

  it("does not mistake Nightcrawler's three counted Bamf copies for an extra reserve", () => {
    expect(raw("48006").quantity).toBe(3);
    expect(raw("48006").text).not.toContain("Permanent.");
    expect(decks.find((d) => d.heroCode === "48001a")!.cards["48006"]).toBe(3);
  });

  it("retains all four New allies outside Magneto's forty-card source and their printed Linked condition", () => {
    const source = decks.find((d) => d.heroCode === "49001a")!;
    for (const code of ["49033", "49034", "49035", "49036"]) {
      expect(raw(code).type_code).toBe("ally");
      expect(raw(code).quantity).toBe(1);
      expect(raw(code).text).toContain("Linked (New Recruits)");
      expect(source.cards[code]).toBeUndefined();
    }
    expect(raw("49020").text).toContain("set-aside");
  });

  it("splits the two actual Super Spies printings one per SHIELD source without duplication", () => {
    const maria = decks.find((d) => d.heroCode === "50001a")!;
    const nick = decks.find((d) => d.heroCode === "50034a")!;
    expect(raw("50024").quantity).toBe(2);
    expect(maria.cards["50024"]).toBe(1);
    expect(nick.cards["50024"]).toBe(1);
    expect(maria.cards["50024"] + nick.cards["50024"]).toBe(
      raw("50024").quantity,
    );
    expect(nick.sourceUrls).toContain(
      "https://images-cdn.fantasyflightgames.com/filer_public/79/12/7912adc3-2461-4ea2-8606-4715880b8d1d/mc50_rulebook-web.pdf#page=7",
    );
  });

  it("retains one physical Permanent Assault/Stealth suit outside Nick's playing deck", () => {
    const source = decks.find((d) => d.heroCode === "50034a")!;
    expect(raw("50035a").back_link).toBe("50035b");
    expect(raw("50035b").hidden).toBe(true);
    expect(raw("50035a").text).toContain("Permanent.");
    expect(raw("50035b").text).toContain("Permanent.");
    expect(source.cards["50035a"]).toBe(1);
    expect(source.cards["50035b"]).toBeUndefined();
    expect(sum(source.cards)).toBe(41);
    expect(source.setupCards).toEqual({ "50035a": 1 });
  });

  it("keeps Maria's three printed off-aspect SHIELD supports in her Leadership starter", () => {
    const source = decks.find((d) => d.heroCode === "50001a")!;
    const offAspect = Object.entries(source.cards).filter(([code]) =>
      ["aggression", "justice", "protection"].includes(raw(code).faction_code),
    );
    expect(offAspect).toEqual([
      ["50018", 1],
      ["50019", 1],
      ["50020", 1],
    ]);
    for (const [code] of offAspect)
      expect(raw(code).traits).toContain("S.H.I.E.L.D.");
    expect(raw("50001b").text).toContain("3");
  });

  it("includes exactly Crazy Gang and Hellfire from the two complete hero packs", () => {
    const crazy = batch.filter((c) => c.set_code === "crazy_gang");
    const hellfire = batch.filter((c) => c.set_code === "hellfire");
    expect(crazy.map((c) => c.code)).toEqual([
      "48033",
      "48034",
      "48035",
      "48036",
      "48037",
      "48038",
    ]);
    expect(hellfire.map((c) => c.code)).toEqual([
      "49038",
      "49039",
      "49040",
      "49041",
      "49042",
    ]);
    expect(physical(crazy)).toBe(6);
    expect(physical(hellfire)).toBe(5);
  });

  it("restricts Agents of SHIELD to66 of221 hero/player/obligation/nemesis faces", () => {
    const box = catalog.filter((c) => c.pack_code === "aos");
    const imported = batch.filter((c) => c.pack_code === "aos");
    expect(box).toHaveLength(221);
    expect(imported).toHaveLength(66);
    expect(physical(imported)).toBe(95);
    expect(box.filter((c) => Number(c.code.slice(0, 5)) >= 50064)).toHaveLength(
      155,
    );
    expect(imported.some((c) => c.type_code === "villain")).toBe(false);
  });
});
