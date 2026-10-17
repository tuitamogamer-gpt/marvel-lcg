import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import sourceDecks from "../src/data/catalog-decks.json";
import {
  card,
  deckCodes,
  handSize,
  heroCard,
  imageFor,
  maxHP,
} from "../src/game/cards.js";
import { CATALOG_HEROES, STARTER_DECKS } from "../src/game/catalog.js";
import {
  copyLimit,
  countsFor,
  deckErrors,
  deckOptions,
  deckSizeFor,
} from "../src/game/decks.js";
import { dispatch, newGame } from "../src/game/engine.js";
import { SCRIPTED_HERO_IDS } from "../src/game/engine-support.js";
import {
  heroRequiredCards,
  heroRuntime,
  heroSetupCards,
  heroStarterAspects,
  isPermanent,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { identityMatch } from "../src/game/unique.js";
import type { Aspect, Card, GameState, Piece } from "../src/game/types.js";

type SourceCard = Card & { duplicate_of?: string };
const raw = (code: string) =>
  catalog.find((c) => c.code === code)! as SourceCard;
const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((total, count) => total + count, 0);
const range = (first: number, last: number) =>
  Array.from({ length: last - first + 1 }, (_, index) => String(first + index));
const composition = (codes: Record<string, number>) =>
  Object.entries(codes).flatMap(([code, quantity]) =>
    Array<string>(quantity).fill(code),
  );
const specs: {
  id: string;
  pack: string;
  first: number;
  last: number;
  faces: number;
  physical: number;
  aspect: Aspect;
  composition: number;
  required: Record<string, number>;
  setup: Record<string, number>;
  factions: Record<string, number>;
  obligation: string;
  nemesis: Record<string, number>;
  stats: { attack: number; thwart: number; defense: number; recover: number };
  hp: number;
}[] = [
  {
    id: "cable",
    pack: "next_evol",
    first: 40001,
    last: 40036,
    faces: 37,
    physical: 47,
    aspect: "leadership",
    composition: 40,
    required: {
      "40002": 1,
      "40003": 3,
      "40004": 1,
      "40005": 2,
      "40006": 1,
      "40007": 1,
      "40008": 1,
      "40009": 1,
      "40010": 1,
      "40011": 1,
      "40012": 1,
      "40013": 1,
    },
    setup: {},
    factions: {
      hero: 15,
      leadership: 12,
      basic: 11,
      aggression: 1,
      protection: 1,
    },
    obligation: "40031",
    nemesis: { "40032": 1, "40033": 1, "40034": 1, "40035": 1, "40036": 1 },
    stats: { attack: 2, thwart: 2, defense: 2, recover: 4 },
    hp: 12,
  },
  {
    id: "domino",
    pack: "next_evol",
    first: 40037,
    last: 40069,
    faces: 34,
    physical: 47,
    aspect: "justice",
    composition: 40,
    required: {
      "40038": 1,
      "40039": 1,
      "40040": 2,
      "40041": 1,
      "40042": 2,
      "40043": 1,
      "40044": 1,
      "40045": 1,
      "40046": 2,
      "40047": 1,
      "40048": 1,
      "40049": 1,
    },
    setup: {},
    factions: { hero: 15, justice: 12, basic: 13 },
    obligation: "40065",
    nemesis: { "40066": 1, "40067": 1, "40068": 1, "40069": 2 },
    stats: { attack: 2, thwart: 1, defense: 3, recover: 3 },
    hp: 9,
  },
  {
    id: "x23",
    pack: "x23",
    first: 43001,
    last: 43040,
    faces: 41,
    physical: 59,
    aspect: "aggression",
    composition: 41,
    required: {
      "43002": 1,
      "43003": 1,
      "43004": 2,
      "43005": 3,
      "43006": 2,
      "43007": 1,
      "43008": 1,
      "43009": 1,
      "43010": 1,
      "43011": 1,
      "43012": 2,
    },
    setup: { "43002": 1 },
    factions: { hero: 15, aggression: 16, basic: 9 },
    obligation: "43028",
    nemesis: { "43029": 1, "43030": 1, "43031": 1, "43032": 1, "43033": 1 },
    stats: { attack: 1, thwart: 2, defense: 2, recover: 6 },
    hp: 10,
  },
  {
    id: "deadpool",
    pack: "deadpool",
    first: 44001,
    last: 44058,
    faces: 59,
    physical: 77,
    aspect: "pool",
    composition: 40,
    required: {
      "44002": 1,
      "44003": 1,
      "44004": 2,
      "44005": 1,
      "44006": 2,
      "44007": 1,
      "44008": 1,
      "44009": 1,
      "44010": 2,
      "44011": 1,
      "44012": 2,
    },
    setup: {},
    factions: { hero: 15, pool: 24, basic: 1 },
    obligation: "44032",
    nemesis: { "44033": 1, "44034": 1, "44035": 1, "44036": 2 },
    stats: { attack: 2, thwart: 2, defense: 1, recover: 8 },
    hp: 9,
  },
];
const source = (spec: (typeof specs)[number]) =>
  sourceDecks.find((deck) => deck.heroCode === `${spec.first}a`)!;
const original = (spec: (typeof specs)[number]) =>
  composition(source(spec).cards);
const playerZones = (player: GameState["player"]): Piece[] => [
  ...player.hand,
  ...player.deck,
  ...player.discard,
  ...player.inPlay,
  ...(player.setAside || []),
];
const game = (selected = [specs[0]]) =>
  newGame({
    heroId: selected[0].id,
    aspect: selected[0].aspect,
    heroes: selected.map((spec) => ({
      heroId: spec.id,
      aspect: spec.aspect,
      deckCards: original(spec),
    })),
    villainId: "rhino",
    modules: ["bomb_scare"],
    seed: 404344,
    pacing: "expert",
  });
const inScope = (c: { code: string }) =>
  specs.some(
    (spec) =>
      Number(c.code.slice(0, 5)) >= spec.first &&
      Number(c.code.slice(0, 5)) <= spec.last,
  );

describe("batch three: independent immutable source contract", () => {
  it("keeps imported cards, original source lists and artwork map byte-identical", () => {
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

  it("covers exactly 171 faces and 230 physical cards without claiming the rest of NeXt Evolution", () => {
    let faces = 0,
      physical = 0;
    for (const spec of specs) {
      const rows = catalog.filter(
        (c) =>
          Number(c.code.slice(0, 5)) >= spec.first &&
          Number(c.code.slice(0, 5)) <= spec.last,
      );
      expect(rows.map((c) => c.code)).toEqual([
        `${spec.first}a`,
        `${spec.first}b`,
        ...range(spec.first + 1, spec.last),
      ]);
      expect(rows).toHaveLength(spec.faces);
      const count = rows
        .filter((c) => !c.code.endsWith("b"))
        .reduce((total, c) => total + c.quantity, 0);
      expect(count, spec.id).toBe(spec.physical);
      faces += rows.length;
      physical += count;
      for (const c of rows)
        expect(hasExecutableScript(c.code), c.code).toBe(true);
    }
    expect(faces).toBe(171);
    expect(physical).toBe(230);
    for (const code of ["40070a", "40103a", "40190a", "40204"])
      expect(hasExecutableScript(code), code).toBe(false);
  });

  it("preserves printed numeric fields, traits, resources and source affiliations", () => {
    const fields = [
      "quantity",
      "type_code",
      "set_code",
      "pack_code",
      "faction_code",
      "position",
      "attack",
      "attack_star",
      "attack_cost",
      "scheme",
      "scheme_star",
      "thwart",
      "thwart_star",
      "thwart_cost",
      "defense",
      "defense_star",
      "recover",
      "recover_star",
      "cost",
      "health",
      "hand_size",
      "traits",
      "deck_limit",
      "is_unique",
      "base_threat",
      "base_threat_fixed",
      "scheme_crisis",
      "scheme_hazard",
      "scheme_acceleration",
      "scheme_amplify",
      "boost",
      "boost_star",
      "resource_energy",
      "resource_mental",
      "resource_physical",
      "resource_wild",
      "back_link",
    ];
    for (const imported of catalog.filter(inScope))
      for (const field of fields)
        expect(
          (card(imported.code) as unknown as Record<string, unknown>)[field],
          `${imported.code}.${field}`,
        ).toEqual((imported as Record<string, unknown>)[field]);
    // The English scan and original imported JSON both show Mental.
    expect(raw("43016").resource_mental).toBe(1);
    expect(card("43016").resource_mental).toBe(1);
  });

  it("retains all fourteen reprint codes and the already supported Power of the Mind printing", () => {
    const reprints = {
      "40030": "23035",
      "40052": "30014",
      "40055": "30019",
      "40061": "01088",
      "40062": "01089",
      "40063": "01090",
      "43017": "12030",
      "43022": "01088",
      "43023": "01089",
      "43024": "01090",
      "43025": "41022",
      "43026": "41023",
      "43027": "05023",
      "44031": "40026",
    };
    expect(Object.keys(reprints)).toHaveLength(14);
    for (const [code, base] of Object.entries(reprints)) {
      expect(raw(code).duplicate_of, code).toBe(base);
      expect(raw(code).name).toBe(raw(base).name);
      expect(card(code).code).toBe(code);
      expect(hasExecutableScript(code), code).toBe(true);
      expect(hasExecutableScript(base), base).toBe(true);
    }
    expect(raw("41021").duplicate_of).toBe("40028");
    expect(raw("41021").text).toBe(raw("40028").text);
    expect(hasExecutableScript("40028")).toBe(true);
  });

  it.each([
    ["40006", 0, 5, true],
    ["40018", 1, 3, false],
    ["40019", 1, 2, false],
    ["40020", 1, 2, false],
    ["40027", 1, 3, false],
    ["40054", 0, 4, false],
    ["40059", 1, 3, false],
    ["43018", 1, 3, false],
    ["43021", 1, 5, false],
    ["43039", 0, 3, false],
    ["44024", 0, 3, false],
  ] as const)(
    "keeps source player side scheme %s cost/threat/scale",
    (code, cost, threat, fixed) => {
      expect(card(code)).toMatchObject({
        type_code: "player_side_scheme",
        cost,
        base_threat: threat,
      });
      expect(Boolean(card(code).base_threat_fixed)).toBe(fixed);
      expect(card(code).text).toContain("Victory 0");
      expect(copyLimit(card(code))).toBe(1);
    },
  );
});

for (const spec of specs)
  describe(`${spec.id}: original identity and physical source composition`, () => {
    const hero = `${spec.first}a`,
      alter = `${spec.first}b`;
    it("enables one identity and retains both correct original scans and base statistics", () => {
      expect(SCRIPTED_HERO_IDS.has(spec.id)).toBe(true);
      expect(CATALOG_HEROES.filter((h) => h.id === spec.id)).toHaveLength(1);
      expect(CATALOG_HEROES.find((h) => h.id === spec.id)).toMatchObject({
        code: hero,
        alter,
        packCode: spec.pack,
        automated: true,
      });
      for (const alias of [spec.id, `${spec.pack}:${spec.id}`, hero, alter])
        expect(heroRuntime(alias)?.id, alias).toBe(spec.id);
      expect(heroRuntime(spec.id)?.identityCodes).toEqual([hero, alter]);
      expect(heroStarterAspects(spec.id)).toEqual([spec.aspect]);
      for (const code of [hero, alter])
        expect(imageFor(code)).toBe(`/cards/catalog/${code}.webp`);
      expect(raw(hero)).toMatchObject({
        attack: spec.stats.attack,
        thwart: spec.stats.thwart,
        defense: spec.stats.defense,
        health: spec.hp,
        hand_size: 5,
        back_link: alter,
      });
      expect(raw(alter)).toMatchObject({
        recover: spec.stats.recover,
        health: spec.hp,
        hand_size: 6,
      });
    });

    it("keeps the exact original source printing quantities and all mandatory signatures", () => {
      const codes = deckCodes(spec.id, spec.aspect);
      expect(STARTER_DECKS.find((d) => d.heroCode === hero)?.cards).toEqual(
        source(spec).cards,
      );
      expect(codes).toEqual(original(spec));
      expect(countsFor(codes)).toEqual(source(spec).cards);
      expect(codes).toHaveLength(spec.composition);
      expect(deckSizeFor(codes)).toBe(40);
      expect(heroRequiredCards(spec.id)).toEqual(spec.required);
      expect(heroSetupCards(spec.id)).toEqual(spec.setup);
      expect(source(spec).setupCards).toEqual(spec.setup);
      expect(source(spec).supplementaryCards).toEqual({});
      expect(
        countsFor(
          codes
            .filter((code) => !isPermanent(card(code)))
            .map((code) => card(code).faction_code),
        ),
      ).toEqual(spec.factions);
      expect(deckErrors(spec.id, spec.aspect, codes)).toEqual([]);
      expect(validateHeroDeck(spec.id, [spec.aspect], codes)).toMatchObject({
        valid: true,
        deckSize: 40,
        compositionSize: spec.composition,
      });
    });

    it("rejects missing or extra signatures, identity faces and unchosen ordinary aspect cards", () => {
      const codes = original(spec),
        first = Object.keys(spec.required)[0];
      expect(
        validateHeroDeck(
          spec.id,
          [spec.aspect],
          codes.filter((code) => code !== first),
        ).valid,
      ).toBe(false);
      expect(
        validateHeroDeck(spec.id, [spec.aspect], [...codes, first]).valid,
      ).toBe(false);
      for (const code of [hero, alter, ...range(43034, 43037)]) {
        expect(
          validateHeroDeck(spec.id, [spec.aspect], [...codes, code]).valid,
          code,
        ).toBe(false);
        expect(
          deckOptions(spec.id, spec.aspect).map((c) => c.code),
          code,
        ).not.toContain(code);
      }
      expect(
        validateHeroDeck(spec.id, ["leadership", "justice"], codes).valid,
      ).toBe(false);
    });

    it("retains all original physical pieces, ownership, obligation and five nemeses through serialization", () => {
      const s = game([spec]);
      expect(s.error).toBeUndefined();
      expect(s.phase).toBe("mulligan");
      expect(s.player.hand).toHaveLength(6);
      expect(heroCard(s).code).toBe(alter);
      expect(handSize(s)).toBe(6);
      expect(maxHP(s)).toBe(spec.hp);
      const all = playerZones(s.player),
        own = all.filter((p) => Object.hasOwn(source(spec).cards, p.code));
      expect(countsFor(own.map((p) => p.code))).toEqual(source(spec).cards);
      expect(new Set(own.map((p) => p.id)).size).toBe(spec.composition);
      expect(own.every((p) => p.ownerId === s.activePlayerId)).toBe(true);
      const nemesis = all.filter((p) => Object.hasOwn(spec.nemesis, p.code));
      expect(countsFor(nemesis.map((p) => p.code))).toEqual(spec.nemesis);
      expect(new Set(nemesis.map((p) => p.id)).size).toBe(5);
      expect(heroRuntime(spec.id)?.obligationCodes).toEqual([spec.obligation]);
      expect(heroRuntime(spec.id)?.nemesisCodes).toEqual(
        Object.keys(spec.nemesis),
      );
      expect(
        s.encounter.deck.filter((p) => p.code === spec.obligation),
      ).toHaveLength(1);
      const restored = JSON.parse(JSON.stringify(s)) as GameState;
      expect(playerZones(restored.player)).toEqual(all);
      restored.player.form = "hero";
      expect(heroCard(restored).code).toBe(hero);
      expect(handSize(restored)).toBe(5);
    });
  });

describe("batch three: cross-product source and setup constraints", () => {
  it("lets Cable choose any aspect's player side schemes while keeping Leadership as his source aspect", () => {
    const codes = original(specs[0]);
    expect(source(specs[0]).aspect).toBe("multi");
    expect(heroStarterAspects("cable")).toEqual(["leadership"]);
    const options = deckOptions("cable", "leadership").map((c) => c.code);
    for (const code of [
      "40019",
      "40020",
      "41016",
      "42017",
      "43018",
      "43039",
      "44024",
    ]) {
      expect(options, code).toContain(code);
      if (!codes.includes(code))
        expect(
          validateHeroDeck("cable", ["leadership"], [...codes, code]).valid,
          code,
        ).toBe(true);
    }
    for (const code of ["40052", "43016", "44017"])
      expect(
        validateHeroDeck("cable", ["leadership"], [...codes, code]).valid,
        code,
      ).toBe(false);
  });

  it("preserves the original single Permanent Claws piece without drawing or duplicating it", () => {
    let s = game([specs[2]]);
    expect(isPermanent(card("43002"))).toBe(true);
    expect(card("43002").cost).toBeUndefined();
    const before = playerZones(s.player).filter((p) => p.code === "43002");
    expect(before).toHaveLength(1);
    expect(
      [...s.player.hand, ...s.player.deck].some((p) => p.code === "43002"),
    ).toBe(false);
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    expect(s.error).toBeUndefined();
    expect(s.player.inPlay.filter((p) => p.code === "43002")).toEqual(before);
    expect(
      playerZones(s.player).filter((p) => p.code === "43002"),
    ).toHaveLength(1);
  });

  it("supplies linked Specializations per actual Training deck, outside the playing deck", () => {
    const linked = range(43034, 43037);
    const sourceGame = game([specs[2]]);
    const reserve = playerZones(sourceGame.player).filter((p) =>
      linked.includes(p.code),
    );
    expect(countsFor(reserve.map((p) => p.code))).toEqual({
      "43034": 1,
      "43035": 1,
      "43036": 1,
      "43037": 1,
    });
    expect(new Set(reserve.map((p) => p.id)).size).toBe(4);
    expect(
      [...sourceGame.player.hand, ...sourceGame.player.deck].some((p) =>
        linked.includes(p.code),
      ),
    ).toBe(false);

    const withoutTraining = newGame({
      heroId: "x23",
      aspect: "aggression",
      heroes: [
        {
          heroId: "x23",
          aspect: "aggression",
          deckCards: original(specs[2]).map((code) =>
            code === "43021" ? "40060" : code,
          ),
        },
      ],
      villainId: "rhino",
      modules: ["bomb_scare"],
      seed: 4340,
    });
    expect(withoutTraining.error).toBeUndefined();
    expect(
      playerZones(withoutTraining.player).some((p) => linked.includes(p.code)),
    ).toBe(false);

    const twoDecks = newGame({
      heroId: "x23",
      aspect: "aggression",
      heroes: [
        { heroId: "x23", aspect: "aggression", deckCards: original(specs[2]) },
        {
          heroId: "domino",
          aspect: "justice",
          deckCards: [...original(specs[1]), "43021"],
        },
      ],
      villainId: "rhino",
      modules: ["bomb_scare"],
      seed: 4341,
    });
    expect(twoDecks.error).toBeUndefined();
    const allLinked = twoDecks.players
      .flatMap((seat) =>
        playerZones(
          seat.id === twoDecks.activePlayerId ? twoDecks.player : seat.player,
        ),
      )
      .filter((p) => linked.includes(p.code));
    expect(countsFor(allLinked.map((p) => p.code))).toEqual({
      "43034": 2,
      "43035": 2,
      "43036": 2,
      "43037": 2,
    });
    expect(new Set(allLinked.map((p) => p.id)).size).toBe(8);
    expect(JSON.parse(JSON.stringify(allLinked))).toEqual(allLinked);
  });

  it("adds one shared Dreadpool set for chosen 'Pool, including two 'Pool players, and none for off-aspect inclusion", () => {
    const reserve = (s: GameState) =>
      (s as GameState & { deadpool?: { poolSetAside?: Piece[] } }).deadpool
        ?.poolSetAside || [];
    const checkPoolSetup = (s: GameState) => {
      expect(s.error).toBeUndefined();
      const active = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
      ].filter((p) => range(44037, 44042).includes(p.code));
      expect(countsFor(active.map((p) => p.code))).toEqual({ "44037": 1 });
      expect(countsFor(reserve(s).map((p) => p.code))).toEqual({
        "44038": 1,
        "44039": 1,
        "44040": 1,
        "44041": 2,
        "44042": 1,
      });
      expect(new Set([...active, ...reserve(s)].map((p) => p.id)).size).toBe(7);
      expect(reserve(JSON.parse(JSON.stringify(s)) as GameState)).toEqual(
        reserve(s),
      );
    };
    checkPoolSetup(game([specs[3]]));
    checkPoolSetup(
      newGame({
        heroId: "deadpool",
        aspect: "pool",
        heroes: [
          { heroId: "deadpool", aspect: "pool", deckCards: original(specs[3]) },
          {
            heroId: "domino",
            aspect: "pool",
            deckCards: deckCodes("domino", "pool"),
          },
        ],
        villainId: "rhino",
        modules: ["bomb_scare"],
        seed: 4440,
      }),
    );
    const offAspect = newGame({
      heroId: "cable",
      aspect: "leadership",
      heroes: [
        {
          heroId: "cable",
          aspect: "leadership",
          deckCards: [...original(specs[0]), "44024"],
        },
      ],
      villainId: "rhino",
      modules: ["bomb_scare"],
      seed: 4441,
    });
    expect(offAspect.error).toBeUndefined();
    expect(
      [...offAspect.encounter.deck, ...reserve(offAspect)].some((p) =>
        range(44037, 44042).includes(p.code),
      ),
    ).toBe(false);
    const nonPoolDeadpool = newGame({
      heroId: "deadpool",
      aspect: "justice",
      heroes: [
        {
          heroId: "deadpool",
          aspect: "justice",
          deckCards: deckCodes("deadpool", "justice"),
        },
      ],
      villainId: "rhino",
      modules: ["bomb_scare"],
      seed: 4442,
    });
    expect(nonPoolDeadpool.error).toBeUndefined();
    expect(
      [...nonPoolDeadpool.encounter.deck, ...reserve(nonPoolDeadpool)].some(
        (p) => range(44037, 44042).includes(p.code),
      ),
    ).toBe(false);

    const warlockSource = sourceDecks.find((d) => d.heroCode === "21031a")!;
    const warlockCodes = [
      ...composition(warlockSource.cards).filter(
        (code) => raw(code).faction_code !== "protection",
      ),
      "44013",
      "44014",
      "44015",
      "44016",
      "44017",
      "44018",
    ];
    expect(
      validateHeroDeck(
        "warlock",
        ["leadership", "aggression", "justice", "pool"],
        warlockCodes,
      ).valid,
    ).toBe(true);
    checkPoolSetup(
      newGame({
        heroId: "warlock",
        aspect: "leadership",
        // The primary aspect alone is insufficient to recognize this chosen
        // four-aspect composition; the physical deck proves 'Pool is selected.
        heroes: [
          { heroId: "warlock", aspect: "leadership", deckCards: warlockCodes },
        ],
        villainId: "rhino",
        modules: ["bomb_scare"],
        seed: 4443,
      }),
    );
  });

  it("retains source Team-Up allies, shared title limits and all four Live Dangerously icons", () => {
    expect(original(specs[0])).toContain("40024");
    expect(original(specs[3])).toContain("44002");
    expect(identityMatch("deadpool", card("40024"))).toBe(true);
    expect(identityMatch("cable", card("44002"))).toBe(true);
    expect(
      deckErrors("cable", "leadership", [...original(specs[0]), "44031"]).some(
        (e) => e.includes("Frenemies"),
      ),
    ).toBe(true);
    expect(
      deckErrors("deadpool", "pool", [...original(specs[3]), "40026"]).some(
        (e) => e.includes("Frenemies"),
      ),
    ).toBe(true);
    expect(
      deckErrors("cable", "leadership", [...original(specs[0]), "41021"]).some(
        (e) => e.includes("The Power of the Mind"),
      ),
    ).toBe(true);
    expect(card("44024")).toMatchObject({
      scheme_crisis: 1,
      scheme_hazard: 1,
      scheme_acceleration: 1,
      scheme_amplify: 1,
    });
    expect(card("43036").text).toContain("Your identity gets +4 hit points");
  });

  it("keeps the four-deck physical total at 161 and its counted total at 160", () => {
    expect(
      specs.reduce((total, spec) => total + original(spec).length, 0),
    ).toBe(161);
    expect(
      specs.reduce((total, spec) => total + deckSizeFor(original(spec)), 0),
    ).toBe(160);
    expect(
      sum({
        "44037": 1,
        "44038": 1,
        "44039": 1,
        "44040": 1,
        "44041": 2,
        "44042": 1,
      }),
    ).toBe(7);
    for (const spec of specs)
      expect(
        original(spec).some((code) => range(44037, 44042).includes(code)),
      ).toBe(false);
  });
});
