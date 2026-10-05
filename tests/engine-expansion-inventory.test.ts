import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasExecutableScript } from "../src/game/script-registry";
import {
  EXPLICIT_CARD_SCRIPTS,
  SCRIPTED_HERO_IDS,
} from "../src/game/engine-support";
import { CATALOG_CARDS, HEROES, VILLAINS } from "../src/game/cards";
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
const audited = new Map(
  inventory.cards.map((card: { code: string }) => [card.code, card]),
);

describe("complete expansion rules inventory", () => {
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
      ["drs", 40],
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
    expect(coverage.executableFaces).toBe(743);
    expect(coverage.unsupportedFaces).toBe(3808);
    expect(coverage.dedicatedFaces).toBe(264);
    expect(coverage.registeredHeroIds).toHaveLength(13);
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

  it("pins data hashes so the checked inventory cannot silently drift from the import", () => {
    for (const [file, expected] of Object.entries(inventory.sourceHashes)) {
      // Engine adapters are implemented concurrently; their hash is diagnostic.
      if (!file.startsWith("src/data/")) continue;
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
    for (const file of [
      "src/game/black-widow.ts",
      "src/game/doctor-strange.ts",
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
