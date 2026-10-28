import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasExecutableScript } from "../src/game/script-registry";
import {
  EXPLICIT_CARD_SCRIPTS,
  SCRIPTED_HERO_IDS,
} from "../src/game/engine-support";
import { CATALOG_CARDS, HEROES, MODULES, VILLAINS } from "../src/game/cards";
import {
  candidatePatterns,
  normalizeRules,
  printedKeywords,
  semanticFingerprint,
} from "../scripts/audit-engine-expansion.mjs";

const read = (file: string) =>
  JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const cards = read("src/data/catalog-cards.json");
const inventory = read("docs/engine-expansion-inventory.json");
const byCode = new Map<string, object>(
  cards.map((card: { code: string }) => [card.code, card]),
);
interface AuditedCard {
  code: string;
  mechanics: string[];
  installedRegistry: {
    code: string;
    executable: boolean;
    mechanism: string;
    compilerStatus: string;
  };
}
const audited = new Map<string, AuditedCard>(
  inventory.cards.map((card: AuditedCard) => [card.code, card]),
);

describe("complete expansion rules inventory", () => {
  it("records scan-verified printed metadata separately from text errata", () => {
    const corrections = inventory.runtimeMetadataCorrections;
    expect(corrections.map((entry: { code: string }) => entry.code)).toEqual([
      "04061b",
      "04145",
      "04150",
      "13018",
      "19025",
      "19026",
      "19027",
      "19028",
      "19029",
      "22030",
      "29001a",
      "32048",
      "32086",
      "32088a",
      "32092",
      "32106",
      "32153",
      "34028",
      "34031",
      "35021",
    ]);
    for (const [code, boost] of [
      ["04145", 1],
      ["19025", 2],
      ["19026", 2],
      ["19027", 3],
      ["19028", 1],
      ["19029", 2],
    ] as const) {
      const correction = corrections.find(
        (entry: { code: string }) => entry.code === code,
      );
      expect(correction.source).toBe("Original English card scan");
      expect(correction.url).toContain(`/official/${code}.jpg`);
      expect(correction.changes).toContainEqual({
        field: "boost",
        imported: null,
        runtime: boost,
      });
    }
    expect(
      corrections.find((entry: { code: string }) => entry.code === "04061b"),
    ).toMatchObject({
      source: "Original English card scan",
      url: "https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/04061B.jpg",
      changes: [
        {
          field: "text",
          imported: null,
          runtime:
            "<b>When Revealed</b>: Reveal the top card of the Experimental Weapons deck.",
        },
      ],
    });
    expect(
      corrections.find((entry: { code: string }) => entry.code === "04150"),
    ).toMatchObject({
      source: "Original English card scan",
      url: "https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/04150.jpg",
      changes: [
        {
          field: "text",
          imported: cards.find(
            (entry: { code: string }) => entry.code === "04150",
          ).text,
          runtime:
            "<b>When Revealed (Alter-Ego)</b>: The villain schemes. If they have a [[Weapon]] attachment, this card gains surge.\n<b>When Revealed (Hero)</b>: The villain attacks you. If they have a [[Weapon]] attachment, this card gains surge.",
        },
      ],
    });
    expect(
      corrections.find((entry: { code: string }) => entry.code === "19028")
        .changes,
    ).toContainEqual({
      field: "attack",
      imported: null,
      runtime: 2,
    });
    expect(
      corrections.find((entry: { code: string }) => entry.code === "22030")
        .changes,
    ).toEqual([{ field: "attack", imported: null, runtime: 1 }]);
    expect(
      corrections.find((entry: { code: string }) => entry.code === "13018"),
    ).toMatchObject({
      url: "https://hallofheroeslcg.com/wp-content/uploads/2020/12/a8.jpg",
      changes: [{ field: "subname", imported: null, runtime: "Riri Williams" }],
    });
    expect(
      corrections.find((entry: { code: string }) => entry.code === "29001a"),
    ).toMatchObject({
      url: "https://hallofheroeslcg.com/wp-content/uploads/2022/05/i0d.jpg",
      changes: [{ field: "is_unique", imported: false, runtime: true }],
    });
    expect(
      corrections.find((entry: { code: string }) => entry.code === "32048"),
    ).toMatchObject({
      url: "https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/32048.jpg",
      changes: [
        { field: "subname", imported: null, runtime: "Piotr Rasputin" },
      ],
    });
    expect(
      corrections.find((entry: { code: string }) => entry.code === "35021"),
    ).toMatchObject({
      url: "https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/35021.jpg",
      changes: [
        { field: "subname", imported: null, runtime: "Piotr Rasputin" },
      ],
    });
    expect(
      corrections.find((entry: { code: string }) => entry.code === "32088a"),
    ).toMatchObject({
      changes: [{ field: "boost", imported: null, runtime: 1 }],
    });
    expect(
      corrections.find((entry: { code: string }) => entry.code === "32106"),
    ).toMatchObject({
      changes: [{ field: "health", imported: 6, runtime: 5 }],
    });
    for (const code of ["32086", "32092", "34028", "34031"]) {
      const correction = inventory.runtimeRuleCorrections.find(
        (entry: { code: string }) => entry.code === code,
      );
      expect(correction.reference).toBe("Original English card scan");
      expect(correction.url).toContain(`/official/${code}.jpg`);
    }
    expect(
      corrections.some((entry: { code: string }) =>
        entry.code.startsWith("20"),
      ),
    ).toBe(false);
  });
  it("separates live installed registry, compiler recognition, hero/scenario registration and campaign gaps", () => {
    const coverage = inventory.installedRegistryCoverage;
    expect(coverage.total).toBe(cards.length);
    expect(coverage.executableFaces + coverage.unsupportedFaces).toBe(
      cards.length,
    );
    expect(coverage.faces).toHaveLength(cards.length);
    expect(coverage.dedicatedCodes).toEqual([...EXPLICIT_CARD_SCRIPTS].sort());
    expect(coverage.registeredHeroIds).toEqual([...SCRIPTED_HERO_IDS].sort());
    expect(coverage.registeredScenarioIds).toEqual(
      VILLAINS.map((scenario) => scenario.id).sort(),
    );
    expect(
      coverage.registeredHeroes
        .map((hero: { code: string }) => hero.code)
        .sort(),
    ).toEqual(
      HEROES.filter((hero) => SCRIPTED_HERO_IDS.has(hero.id))
        .map((hero) => hero.code)
        .sort(),
    );
    expect(coverage.campaignSupport).toEqual([]);
    expect(coverage.products).toHaveLength(63);
    expect(
      coverage.products.reduce(
        (n: number, pack: { faceCount: number }) => n + pack.faceCount,
        0,
      ),
    ).toBe(cards.length);
    const goblin = coverage.products.find(
      (pack: { code: string }) => pack.code === "gob",
    );
    expect(goblin).toMatchObject({
      faceCount: 57,
      executableFaces: 57,
      installedCardClosure: true,
      unsupportedFaceCodes: [],
    });
    for (const [code, faceCount] of [
      ["bkw", 34],
      ["ant", 35],
      ["wsp", 36],
      ["qsv", 33],
      ["scw", 32],
      ["drs", 40],
      ["stld", 32],
      ["gam", 33],
      ["drax", 34],
      ["vnm", 30],
      ["nebu", 36],
      ["warm", 36],
      ["valk", 37],
      ["vision", 38],
      ["nova", 33],
      ["ironheart", 43],
      ["spiderham", 39],
      ["spdr", 39],
      ["cyclops", 36],
      ["phoenix", 37],
      ["wolv", 38],
      ["storm", 40],
      ["gambit", 36],
      ["rogue", 36],
      ["psylocke", 35],
      ["angel", 34],
      ["x23", 41],
      ["deadpool", 59],
      ["ncrawler", 39],
      ["magneto", 43],
    ] as const) {
      expect(
        coverage.products.find((pack: { code: string }) => pack.code === code),
      ).toMatchObject({
        faceCount,
        executableFaces: faceCount,
        installedCardClosure: true,
        unsupportedFaceCodes: [],
      });
    }
    const gmw = coverage.products.find(
      (pack: { code: string }) => pack.code === "gmw",
    );
    expect(gmw).toMatchObject({
      faceCount: 207,
      executableFaces: 60,
      installedCardClosure: false,
    });
    expect(gmw.unsupportedFaceCodes).toHaveLength(147);
    expect(gmw.unsupportedFaceCodes).toContain("16058");
    const gmwPlayerFaces = cards.filter(
      (entry: { pack_code: string; position: number }) =>
        entry.pack_code === "gmw" && entry.position <= 57,
    );
    expect(gmwPlayerFaces).toHaveLength(59);
    for (const entry of gmwPlayerFaces)
      expect(gmw.unsupportedFaceCodes, entry.code).not.toContain(entry.code);
    for (const id of ["groot", "rocket"])
      expect(
        inventory.heroes.find(
          (hero: { id: string }) => hero.id === `gmw:${id}`,
        ),
      ).toMatchObject({
        registeredHeroIds: [id],
        installedCardClosure: true,
        installedUnsupportedDependencies: [],
      });
    for (const id of [
      "stld",
      "gam",
      "drax",
      "vnm",
      "nebu",
      "warm",
      "valk",
      "vision",
    ])
      expect(
        inventory.heroes.find(
          (hero: { id: string }) => hero.id === `${id}:${id}`,
        ),
      ).toMatchObject({
        registeredHeroIds: [id],
        installedCardClosure: true,
        installedUnsupportedDependencies: [],
      });
    const mts = coverage.products.find(
      (pack: { code: string }) => pack.code === "mts",
    );
    expect(mts).toMatchObject({
      faceCount: 213,
      executableFaces: 73,
      installedCardClosure: false,
    });
    expect(mts.unsupportedFaceCodes).toHaveLength(140);
    expect(mts.unsupportedFaceCodes).toContain("21071");
    const mtsHeroFaces = cards.filter(
      (entry: { pack_code: string; position: number }) =>
        entry.pack_code === "mts" && entry.position <= 70,
    );
    expect(mtsHeroFaces).toHaveLength(72);
    for (const entry of mtsHeroFaces)
      expect(mts.unsupportedFaceCodes, entry.code).not.toContain(entry.code);
    for (const id of ["spectrum", "warlock"])
      expect(
        inventory.heroes.find(
          (hero: { id: string }) => hero.id === `mts:${id}`,
        ),
      ).toMatchObject({
        registeredHeroIds: [id],
        installedCardClosure: true,
        installedUnsupportedDependencies: [],
      });
    for (const [pack, hero] of [
      ["cyclops", "cyclops"],
      ["phoenix", "phoenix"],
      ["wolv", "wolverine"],
      ["storm", "storm"],
      ["gambit", "gambit"],
      ["rogue", "rogue"],
      ["psylocke", "psylocke"],
      ["angel", "angel"],
      ["next_evol", "cable"],
      ["next_evol", "domino"],
      ["x23", "x23"],
      ["deadpool", "deadpool"],
      ["aoa", "bishop"],
      ["aoa", "magik"],
      ["iceman", "iceman"],
      ["jubilee", "jubilee"],
      ["ncrawler", "nightcrawler"],
      ["magneto", "magneto"],
      ["aos", "maria_hill"],
      ["aos", "nick_fury"],
    ])
      expect(
        inventory.heroes.find(
          (entry: { id: string }) => entry.id === `${pack}:${hero}`,
        ),
      ).toMatchObject({
        registeredHeroIds: [hero],
        installedCardClosure: true,
        installedUnsupportedDependencies: [],
      });
    expect(MODULES).toHaveLength(30);
    expect(MODULES.map((module) => module.id)).toEqual(
      expect.arrayContaining([
        "deathstrike",
        "shadow_king",
        "exodus",
        "reavers",
        "sauron",
        "arcade",
        "crazy_gang",
        "hellfire",
        "exper_weapon",
        "hydra_assault",
        "weap_master",
        "hydra_patrol",
      ]),
    );
    expect(coverage.executableFaces).toBe(2337);
    expect(coverage.unsupportedFaces).toBe(2214);
    expect(coverage.dedicatedFaces).toBe(1898);
    expect(coverage.registeredHeroIds).toHaveLength(57);
    const mutant = coverage.products.find(
      (pack: { code: string }) => pack.code === "mut_gen",
    );
    expect(mutant).toMatchObject({
      faceCount: 224,
      executableFaces: 190,
      installedCardClosure: false,
    });
    expect(mutant.unsupportedFaceCodes).toEqual(
      cards
        .filter(
          (entry: { pack_code: string; position: number; code: string }) =>
            entry.pack_code === "mut_gen" &&
            entry.position > 158 &&
            !(entry.position >= 159 && entry.position <= 165) &&
            entry.code !== "32172b",
        )
        .map((entry: { code: string }) => entry.code)
        .sort(),
    );
    for (const id of ["colossus", "shadowcat"])
      expect(
        inventory.heroes.find(
          (hero: { id: string }) => hero.id === `mut_gen:${id}`,
        ),
      ).toMatchObject({
        registeredHeroIds: [id],
        installedCardClosure: true,
        installedUnsupportedDependencies: [],
      });
    for (const id of ["hawkeye", "spider_woman"]) {
      expect(
        coverage.registeredHeroes.some(
          (hero: { id: string }) => hero.id === id,
        ),
      ).toBe(true);
      expect(
        inventory.heroes.find(
          (hero: { id: string }) => hero.id === `trors:${id}`,
        ).installedCardClosure,
      ).toBe(true);
    }
    expect(goblin.automationCertification).toContain(
      "registration_closure_only",
    );
    expect(coverage.scope).toContain(
      "does not certify the full imported collection",
    );
    for (const face of coverage.faces)
      expect(face.executable, face.code).toBe(hasExecutableScript(face.code));
    for (const code of coverage.dedicatedCodes)
      expect(byCode.has(code), code).toBe(true);
    const hulk = inventory.heroes.find(
      (hero: { id: string }) => hero.id === "hlk:hulk",
    );
    expect(hulk.registeredHeroIds).toEqual(["hulk"]);
    expect(hulk.installedCardClosure).toBe(true);
    expect(hulk.compiledCardClosure).toBe(false);
    expect(
      inventory.scenarioSets.find(
        (scenario: { id: string }) => scenario.id === "mutagen_formula",
      ).registered,
    ).toBe(true);
  });
  it("closes the Age of Apocalypse hero slice and both complete retail Hero Packs", () => {
    const products = inventory.installedRegistryCoverage.products;
    const apocalypse = products.find(
      (pack: { code: string }) => pack.code === "aoa",
    );
    expect(apocalypse).toMatchObject({
      faceCount: 220,
      executableFaces: 60,
      installedCardClosure: false,
    });
    expect(apocalypse.unsupportedFaceCodes).toEqual(
      cards
        .filter(
          (entry: { pack_code: string; position: number }) =>
            entry.pack_code === "aoa" && entry.position > 58,
        )
        .map((entry: { code: string }) => entry.code)
        .sort(),
    );
    for (const [code, count] of [
      ["iceman", 33],
      ["jubilee", 41],
    ] as const)
      expect(
        products.find((pack: { code: string }) => pack.code === code),
      ).toMatchObject({
        faceCount: count,
        executableFaces: count,
        unsupportedFaceCodes: [],
        installedCardClosure: true,
      });
  });
  it("closes all 148 fifth-batch source faces while retaining the Agents of SHIELD scenario and campaign gaps", () => {
    const coverage = inventory.installedRegistryCoverage;
    const shield = coverage.products.find(
      (pack: { code: string }) => pack.code === "aos",
    );
    expect(shield).toMatchObject({
      faceCount: 221,
      executableFaces: 66,
      installedCardClosure: false,
    });
    expect(shield.unsupportedFaceCodes).toEqual(
      cards
        .filter(
          (entry: { pack_code: string; position: number }) =>
            entry.pack_code === "aos" && entry.position > 63,
        )
        .map((entry: { code: string }) => entry.code)
        .sort(),
    );
    expect(shield.unsupportedFaceCodes).toHaveLength(155);
    const slice = cards.filter(
      (entry: { pack_code: string; position: number }) =>
        ["ncrawler", "magneto"].includes(entry.pack_code) ||
        (entry.pack_code === "aos" && entry.position <= 63),
    );
    expect(slice).toHaveLength(148);
    for (const face of slice)
      expect(
        audited.get(face.code)?.installedRegistry.executable,
        face.code,
      ).toBe(true);
    // These eleven source faces were executable in the batch-four audit.
    const alreadyRegistered = new Set([
      "48019",
      "48023",
      "48024",
      "48025",
      "49011",
      "49024",
      "49025",
      "49026",
      "50025",
      "50026",
      "50027",
    ]);
    expect(
      slice.filter(
        (entry: { code: string }) => !alreadyRegistered.has(entry.code),
      ),
    ).toHaveLength(137);
    const laterModularFaces = coverage.registeredModules
      .filter((module: { id: string }) =>
        [
          "exper_weapon",
          "hydra_assault",
          "weap_master",
          "hydra_patrol",
        ].includes(module.id),
      )
      .flatMap((module: { faceCodes: string[] }) => module.faceCodes);
    expect(
      coverage.executableFaces - laterModularFaces.length - 16 - 18 - 17 - 2135,
    ).toBe(137);
    expect(MODULES.slice(24, 26).map((module) => module.id)).toEqual([
      "crazy_gang",
      "hellfire",
    ]);
    // Linked allies and Nick's reversible suit remain native dependencies even
    // when the immutable import has no supplementary-map entry for Linked.
    for (const code of [
      "49033",
      "49034",
      "49035",
      "49036",
      "50024",
      "50035a",
      "50035b",
    ])
      expect(audited.get(code)?.installedRegistry.executable, code).toBe(true);
    expect(coverage.campaignSupport).toEqual([]);
  });
  it("closes both NeXt Evolution hero sections while retaining the boxed scenario and campaign gaps", () => {
    const next = inventory.installedRegistryCoverage.products.find(
      (pack: { code: string }) => pack.code === "next_evol",
    );
    expect(next).toMatchObject({
      faceCount: 235,
      executableFaces: 72,
      installedCardClosure: false,
    });
    const heroFaces = cards.filter(
      (entry: { pack_code: string; position: number }) =>
        entry.pack_code === "next_evol" && entry.position <= 69,
    );
    expect(heroFaces).toHaveLength(71);
    for (const entry of heroFaces) {
      expect(next.unsupportedFaceCodes, entry.code).not.toContain(entry.code);
      expect(
        audited.get(entry.code)?.installedRegistry.executable,
        entry.code,
      ).toBe(true);
    }
    // Pouches already has a declarative resource registration; this does not
    // supply campaign automation or close any of the remaining box sections.
    expect(audited.get("40196")?.installedRegistry).toMatchObject({
      executable: true,
      mechanism: "declarative",
    });
    expect(next.unsupportedFaceCodes).toEqual(
      cards
        .filter(
          (entry: { pack_code: string; position: number; code: string }) =>
            entry.pack_code === "next_evol" &&
            entry.position > 69 &&
            entry.code !== "40196",
        )
        .map((entry: { code: string }) => entry.code)
        .sort(),
    );
    expect(next.unsupportedFaceCodes).toEqual(
      expect.arrayContaining(["40070a", "40204"]),
    );
    expect(MODULES.map((module) => module.id)).not.toContain("dreadpool");
  });
  it("retains the independent nine-card Inheritors closure beside the complete Spider-Ham pack", () => {
    const codes = [
      "30030",
      "30031",
      "30032",
      "30033",
      "30034",
      "30035",
      "30036",
      "30037",
      "30038",
    ];
    const source = cards.filter(
      (entry: { set_code?: string }) => entry.set_code === "inheritors",
    );
    expect(source.map((entry: { code: string }) => entry.code)).toEqual(codes);
    expect(
      source.reduce(
        (n: number, entry: { quantity: number }) => n + entry.quantity,
        0,
      ),
    ).toBe(9);
    for (const code of codes) {
      const record = audited.get(code);
      if (!record) throw new Error(`Missing audited Inheritors face ${code}`);
      expect(record.installedRegistry).toMatchObject({
        executable: true,
        mechanism: "dedicated-module",
        compilerStatus: "unsupported",
      });
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
    }
    expect(MODULES.filter((module) => module.id === "inheritors")).toEqual([
      { id: "inheritors", name: "The Inheritors", difficulty: 5 },
    ]);
    expect(
      MODULES.filter((module) =>
        ["inheritors", "ironspider_sinister"].includes(module.id),
      ).map((module) => module.id),
    ).toEqual(["inheritors", "ironspider_sinister"]);
    const pack = inventory.installedRegistryCoverage.products.find(
      (entry: { code: string }) => entry.code === "spiderham",
    );
    expect(pack).toMatchObject({
      faceCount: 39,
      executableFaces: 39,
      installedCardClosure: true,
    });
    expect(pack.unsupportedFaceCodes).toEqual([]);
    expect(
      inventory.heroes.find(
        (hero: { id: string }) => hero.id === "spiderham:spiderham",
      ),
    ).toMatchObject({
      registeredHeroIds: ["spiderham"],
      installedCardClosure: true,
      installedUnsupportedDependencies: [],
    });
  });
  it("records selectable modular closure and all four original Experimental Weapons cards", () => {
    const coverage = inventory.installedRegistryCoverage;
    expect(coverage.registeredModuleIds).toEqual(
      MODULES.map((module) => module.id).sort(),
    );
    expect(coverage.registeredModules).toHaveLength(30);
    for (const module of coverage.registeredModules) {
      const source = cards
        .filter(
          (entry: { faction_code: string; set_code: string }) =>
            entry.faction_code === "encounter" && entry.set_code === module.id,
        )
        .map((entry: { code: string }) => entry.code)
        .sort();
      expect(module.faceCodes, module.id).toEqual(source);
      expect(module.faceCount, module.id).toBe(source.length);
      expect(module.unsupportedFaceCodes, module.id).toEqual(
        source.filter((code: string) => !hasExecutableScript(code)),
      );
      expect(module.installedCardClosure, module.id).toBe(true);
    }
    const codes = ["04072", "04073", "04074", "04075"];
    const source = cards.filter(
      (entry: { set_code: string }) => entry.set_code === "exper_weapon",
    );
    expect(source.map((entry: { code: string }) => entry.code).sort()).toEqual(
      codes,
    );
    expect(
      source.every(
        (entry: { pack_code: string; quantity: number }) =>
          entry.pack_code === "trors" && entry.quantity === 1,
      ),
    ).toBe(true);
    expect(MODULES[26]?.id).toBe("exper_weapon");
    expect(
      coverage.registeredModules.find(
        (module: { id: string }) => module.id === "exper_weapon",
      ),
    ).toMatchObject({
      name: "Experimental Weapons",
      faceCount: 4,
      faceCodes: codes,
      unsupportedFaceCodes: [],
      installedCardClosure: true,
    });
    for (const code of codes) {
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
      expect(audited.get(code)?.installedRegistry, code).toMatchObject({
        executable: true,
        mechanism: "dedicated-module",
      });
    }
    expect(inventory.sourceHashes["src/game/experimental-weapons.ts"]).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
  it("closes all three remaining Rise of Red Skull modules with their original physical quantities", () => {
    const expected = [
      ["hydra_assault", ["04145", "04146", "04147"], [3, 2, 1]],
      ["weap_master", ["04148", "04149", "04150", "04151"], [1, 1, 2, 1]],
      ["hydra_patrol", ["04152", "04153", "04154"], [2, 3, 1]],
    ] as const;
    expect(MODULES.slice(27).map((module) => module.id)).toEqual(
      expected.map(([id]) => id),
    );
    let faces = 0;
    let physical = 0;
    for (const [id, codes, quantities] of expected) {
      const source = cards
        .filter((entry: { set_code: string }) => entry.set_code === id)
        .sort((a: { code: string }, b: { code: string }) =>
          a.code.localeCompare(b.code),
        );
      expect(
        source.map((entry: { code: string }) => entry.code),
        id,
      ).toEqual(codes);
      expect(
        source.map((entry: { quantity: number }) => entry.quantity),
        id,
      ).toEqual(quantities);
      expect(
        source.every(
          (entry: { pack_code: string }) => entry.pack_code === "trors",
        ),
        id,
      ).toBe(true);
      expect(
        inventory.installedRegistryCoverage.registeredModules.find(
          (module: { id: string }) => module.id === id,
        ),
      ).toMatchObject({
        faceCount: codes.length,
        faceCodes: [...codes],
        unsupportedFaceCodes: [],
        installedCardClosure: true,
      });
      for (const code of codes) {
        expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
        expect(audited.get(code)?.installedRegistry, code).toMatchObject({
          executable: true,
          mechanism: "dedicated-module",
        });
      }
      faces += codes.length;
      physical += quantities.reduce<number>(
        (sum, quantity) => sum + quantity,
        0,
      );
    }
    expect(faces).toBe(10);
    expect(physical).toBe(17);
    const newCodes = new Set<string>(
      expected.flatMap(([, codes]) => [...codes]),
    );
    const retainedExecutable = inventory.cards
      .filter(
        (entry: AuditedCard) =>
          entry.installedRegistry.executable &&
          !(entry.code >= "04076" && entry.code <= "04108") &&
          !newCodes.has(entry.code) &&
          !(
            entry.code >= "04058" &&
            entry.code <= "04071" &&
            entry.code !== "04066"
          ),
      )
      .map((entry: AuditedCard) => entry.code)
      .sort();
    expect(retainedExecutable).toHaveLength(2276);
    expect(
      createHash("sha256").update(retainedExecutable.join("\n")).digest("hex"),
    ).toBe("280993fb6807622a1e4f2d8e7e00e4bb9969c0fd74e0a0a33c84aaab5a34cae2");
    expect(inventory.sourceHashes["src/game/red-skull-modules.ts"]).toMatch(
      /^[a-f0-9]{64}$/,
    );
    const product = inventory.installedRegistryCoverage.products.find(
      (entry: { code: string }) => entry.code === "trors",
    );
    expect(product).toMatchObject({
      faceCount: 181,
      executableFaces: 125,
      installedCardClosure: false,
    });
    expect(product.unsupportedFaceCodes).toHaveLength(56);
    expect(product.unsupportedFaceCodes).toEqual(
      expect.arrayContaining(["04109", "04125"]),
    );
    expect(inventory.installedRegistryCoverage.campaignSupport).toEqual([]);
  });
  it("registers exactly the Crossbones scenario while preserving every prior executable face", () => {
    const source = cards.filter(
      (entry: { set_code: string }) => entry.set_code === "crossbones",
    );
    const codes = new Set<string>(
      source.map((entry: { code: string }) => entry.code),
    );
    expect(codes.size).toBe(17);
    for (const code of codes) {
      expect(EXPLICIT_CARD_SCRIPTS.has(code), code).toBe(true);
      expect(audited.get(code)?.installedRegistry, code).toMatchObject({
        executable: true,
        mechanism: "dedicated-module",
      });
    }
    const retained = inventory.cards
      .filter(
        (entry: AuditedCard) =>
          entry.installedRegistry.executable &&
          !(entry.code >= "04076" && entry.code <= "04108") &&
          (!codes.has(entry.code) || entry.code === "04066"),
      )
      .map((entry: AuditedCard) => entry.code)
      .sort();
    expect(retained).toHaveLength(2286);
    expect(createHash("sha256").update(retained.join("\n")).digest("hex")).toBe(
      "ea2fc0b75068a1f7044abbe840aafcad024d8aea3d2ffe6dc96baaf1537440cb",
    );
    expect(
      inventory.installedRegistryCoverage.registeredScenarioIds,
    ).toHaveLength(13);
    expect(
      inventory.installedRegistryCoverage.registeredScenarios.find(
        (entry: { id: string }) => entry.id === "crossbones",
      ),
    ).toMatchObject({
      codes: ["04058", "04059", "04060"],
      schemes: ["04061b", "04062b", "04063b"],
      defaultModule: "hydra_assault",
      moduleCount: 3,
      defaultModules: ["hydra_assault", "weap_master", "legions_of_hydra"],
      fixedSets: [],
      reservedSets: ["exper_weapon"],
    });
    expect(inventory.sourceHashes["src/game/crossbones.ts"]).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(inventory.installedRegistryCoverage.campaignSupport).toEqual([]);
  });
  it("records live compiler outcomes separately from inventory and whole-game certification", () => {
    const coverage = inventory.compilerCoverage;
    expect(coverage.total).toBe(cards.length);
    expect(coverage.native + coverage.declarative + coverage.unsupported).toBe(
      cards.length,
    );
    expect(coverage.faces).toHaveLength(cards.length);
    expect(coverage.scope).toContain("Neither compiled-card closure");
    for (const record of inventory.cards) {
      expect(record.compiler.code).toBe(record.code);
      expect(["supported", "unsupported"]).toContain(record.compiler.status);
      if (record.compiler.status === "unsupported")
        expect(record.compiler.reason).toBeTruthy();
    }
    for (const hero of inventory.heroes) {
      expect(hero.automationCertification).toBe(
        "requires_dedicated_rules_and_integration_evidence",
      );
      expect(hero.compiledCardClosure).toBe(
        hero.compilerUnsupportedDependencies.length === 0,
      );
    }
  });
  it("accounts for every imported face exactly once without implying playability", () => {
    expect(inventory.interpretation.inventoryOnly).toBe(true);
    expect(inventory.cards).toHaveLength(cards.length);
    expect(audited.size).toBe(cards.length);
    expect([...audited.keys()].sort()).toEqual([...byCode.keys()].sort());
    expect(inventory.summary.faces).toBe(4551);
    expect(inventory.summary.products).toBe(63);
    expect(inventory.summary.heroes).toBe(69);
    expect(inventory.importSnapshot).toMatchObject({
      asOf: "2026-09-30",
      provenanceFile: "src/data/catalog-provenance.json",
    });
    expect(
      inventory.cards.every((card: { baseline: string }) =>
        ["native_core_baseline", "imported_requires_implementation"].includes(
          card.baseline,
        ),
      ),
    ).toBe(true);
  });

  it("pins data and runtime hashes so the checked inventory cannot silently drift", () => {
    expect(Object.keys(inventory.sourceHashes)).toHaveLength(131);
    for (const [file, expected] of Object.entries(inventory.sourceHashes)) {
      const actual = createHash("sha256")
        .update(readFileSync(new URL(`../${file}`, import.meta.url)))
        .digest("hex");
      expect(actual, file).toBe(expected);
    }
  });

  it("records runtime rules corrections without rewriting the imported printing", () => {
    const runtime = new Map(CATALOG_CARDS.map((card) => [card.code, card]));
    for (const code of ["08001a", "08009"]) {
      const correction = inventory.runtimeRuleCorrections.find(
        (entry: { code: string }) => entry.code === code,
      );
      expect(correction).toMatchObject({
        code,
        reference: "FFG Rules Reference 1.8, p. 66",
      });
      expect(correction.importedText).toContain(
        "After you trigger the ability",
      );
      expect(correction.runtimeText).toContain("After you resolve the ability");
      expect(correction.runtimeText).not.toContain(
        "After you trigger the ability",
      );
      expect(correction.url).toContain("#page=66");
      expect(normalizeRules(runtime.get(code)?.text)).toBe(
        correction.runtimeText,
      );
      expect(normalizeRules((byCode.get(code) as { text: string }).text)).toBe(
        correction.importedText,
      );
    }
    const eros = inventory.runtimeRuleCorrections.find(
      (entry: { code: string }) => entry.code === "22011",
    );
    expect(eros).toMatchObject({
      code: "22011",
      reference: "FFG Rules Reference 1.8, p. 67",
    });
    expect(eros.url).toContain("#page=67");
    expect(eros.importedText).toContain("confuse a minion for each");
    expect(eros.runtimeText).toContain(
      "for each [mental] resource you used to pay for him, choose a minion and confuse it",
    );
    expect(normalizeRules(runtime.get("22011")?.text)).toBe(eros.runtimeText);
    expect(normalizeRules((byCode.get("22011") as { text: string }).text)).toBe(
      eros.importedText,
    );
    const steelFist = inventory.runtimeRuleCorrections.find(
      (entry: { code: string }) => entry.code === "32008",
    );
    expect(steelFist).toMatchObject({
      code: "32008",
      reference: "FFG Rules Reference 1.8, p. 67",
    });
    expect(steelFist.url).toContain("#page=67");
    expect(steelFist.importedText).not.toContain("(attack)");
    expect(steelFist.runtimeText).toContain("Hero Action (attack):");
    expect(normalizeRules(runtime.get("32008")?.text)).toBe(
      steelFist.runtimeText,
    );
    for (const file of [
      "src/game/black-widow.ts",
      "src/game/doctor-strange.ts",
      "src/game/wasp.ts",
      "src/game/wasp-pack.ts",
      "src/game/quicksilver.ts",
      "src/game/quicksilver-pack.ts",
      "src/game/scarlet-witch.ts",
      "src/game/scarlet-witch-pack.ts",
      "src/game/groot.ts",
      "src/game/rocket.ts",
      "src/game/gmw-player-pack.ts",
      "src/game/star-lord.ts",
      "src/game/gamora.ts",
      "src/game/star-lord-pack.ts",
      "src/game/gamora-pack.ts",
      "src/game/drax.ts",
      "src/game/drax-pack.ts",
      "src/game/venom.ts",
      "src/game/venom-pack.ts",
      "src/game/spectrum.ts",
      "src/game/warlock.ts",
      "src/game/mts-player-pack.ts",
      "src/game/nebula.ts",
      "src/game/nebula-pack.ts",
      "src/game/war-machine.ts",
      "src/game/war-machine-pack.ts",
      "src/game/valkyrie.ts",
      "src/game/valkyrie-pack.ts",
      "src/game/vision.ts",
      "src/game/vision-pack.ts",
      "src/game/armadillo.ts",
      "src/game/zzzax.ts",
      "src/game/inheritors.ts",
      "src/game/spider-ham.ts",
      "src/game/spider-ham-pack.ts",
      "src/game/spdr.ts",
      "src/game/spdr-pack.ts",
      "src/game/ironspider-sinister.ts",
      "src/game/colossus.ts",
      "src/game/shadowcat.ts",
      "src/game/cyclops.ts",
      "src/game/phoenix.ts",
      "src/game/wolverine.ts",
      "src/game/storm.ts",
      "src/game/gambit.ts",
      "src/game/rogue.ts",
      "src/game/psylocke.ts",
      "src/game/angel.ts",
      "src/game/cable.ts",
      "src/game/domino.ts",
      "src/game/x23.ts",
      "src/game/deadpool.ts",
      "src/game/player-side-schemes.ts",
      "src/game/mutant-genesis-player-pack.ts",
      "src/game/sabretooth.ts",
      "src/game/brotherhood.ts",
      "src/game/mystique.ts",
      "src/game/master-mold.ts",
      "src/game/mansion-attack.ts",
      "src/game/card-definitions.ts",
      "src/game/printed-card-metadata.ts",
      "src/game/expansion-errata.ts",
      "src/game/reveal-window.ts",
      "src/game/payment.ts",
      "src/game/team.ts",
      "src/game/review.ts",
      "src/game/lookahead.ts",
      "src/game/types.ts",
    ])
      expect(inventory.sourceHashes[file], file).toMatch(/^[a-f0-9]{64}$/);
  });

  it("links every ability block back to its source card", () => {
    const abilities = new Map(
      inventory.abilityBlocks.map((ability: { id: string }) => [
        ability.id,
        ability,
      ]),
    );
    for (const card of inventory.cards) {
      for (const id of card.abilityIds) {
        expect((abilities.get(id) as { codes: string[] }).codes).toContain(
          card.code,
        );
      }
    }
  });

  it("keeps multi-form identities and actual setup/supplementary dependencies", () => {
    expect(inventory.heroes).toHaveLength(69);
    expect(
      new Set(inventory.heroes.map((hero: { id: string }) => hero.id)).size,
    ).toBe(69);
    const ironheart = inventory.heroes.find(
      (hero: { id: string }) => hero.id === "ironheart:ironheart",
    );
    expect(ironheart.identityCodes).toHaveLength(6);
    const spdr = inventory.heroes.find(
      (hero: { id: string }) => hero.id === "spdr:spdr",
    );
    expect(spdr.starterDependencyCodes).toEqual(
      expect.arrayContaining(["31001a", "31001b", "31002a", "31002b"]),
    );
    const strange = inventory.heroes.find(
      (hero: { id: string }) => hero.id === "drs:doctor_strange",
    );
    expect(strange.requiredMechanics).toContain("special_decks");
    expect(strange.starterDependencyCodes).toEqual(
      expect.arrayContaining(["09032", "09033", "09034", "09035", "09036"]),
    );
    expect(
      inventory.heroes.filter(
        (hero: { name: string }) => hero.name === "Black Panther",
      ),
    ).toHaveLength(2);
  });

  it("rejects partial event interpretation and a global trigger mistaken for self entrance", () => {
    expect(candidatePatterns(byCode.get("03002")!)).toContain(
      "simple_self_entrance_ally",
    );
    expect(candidatePatterns(byCode.get("52033")!)).not.toContain(
      "simple_self_entrance_ally",
    );
    expect(candidatePatterns(byCode.get("01013")!)).not.toContain(
      "simple_attack_event",
    );
    expect(candidatePatterns(byCode.get("60040a")!)).toEqual([]);
    expect(
      printedKeywords({ text: "Hero Action: This attack gains overkill." }),
    ).not.toContain("Overkill");
    expect(
      printedKeywords({
        text: "While in this form, ignore the guard and patrol keywords.",
      }),
    ).toEqual([]);
  });

  it("distinguishes mechanical scaling, amplification and deck metadata in reprint keys", () => {
    const base = { ...(byCode.get("01054") as object) };
    expect(semanticFingerprint(base)).not.toBe(
      semanticFingerprint({ ...base, cost_per_hero: true }),
    );
    expect(semanticFingerprint(base)).not.toBe(
      semanticFingerprint({ ...base, health_per_hero: true }),
    );
    expect(semanticFingerprint(base)).not.toBe(
      semanticFingerprint({ ...base, scheme_amplify: 1 }),
    );
    expect(semanticFingerprint(base)).not.toBe(
      semanticFingerprint({ ...base, deck_options: [{ aspect: "justice" }] }),
    );
    expect(semanticFingerprint(base)).toBe(
      semanticFingerprint({
        ...base,
        code: "reprint",
        quantity: 2,
        position: 99,
        image_url: "different",
      }),
    );
  });

  it("retains unimplemented structural rule types and concrete hard dependencies", () => {
    const mechanics = (code: string) =>
      (audited.get(code) as { mechanics: string[] }).mechanics;
    expect(mechanics("60001a")).toEqual(
      expect.arrayContaining([
        "special_decks",
        "copying_play_permissions",
        "interrupt_replacement",
      ]),
    );
    expect(mechanics("60037a")).toContain("cards_under");
    expect(mechanics("62001b")).toContain("status_cards");
    expect(mechanics("33001a")).toContain("structured_deck_rules");
    expect(mechanics("55041")).toContain("printed_scaling");
    expect(inventory.summary.types.environment).toBe(108);
    expect(inventory.summary.types.player_side_scheme).toBe(39);
    expect(inventory.summary.types.leader).toBe(24);
    expect(inventory.campaignProducts).toHaveLength(9);
    expect(
      inventory.campaignProducts.every(
        (product: { status: string }) =>
          product.status === "requires_campaign_rules_and_state",
      ),
    ).toBe(true);
  });
});
