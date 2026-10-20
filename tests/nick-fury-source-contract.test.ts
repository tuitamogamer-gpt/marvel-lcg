import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import decks from "../src/data/catalog-decks.json" with { type: "json" };
import images from "../src/data/catalog-images.json" with { type: "json" };
import { HEROES, deckCodes } from "../src/game/cards.js";
import { heroRuntime } from "../src/game/hero-runtime.js";
import { NICK_FURY_SCRIPT_CODES } from "../src/game/nick-fury.js";
import { NATIVE_SCRIPT_REPRINTS } from "../src/game/rules-code.js";
const raw = (code: string) => catalog.find((c) => c.code === code)!;
const counts = {
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
};
describe("Nick Fury original source boundary", () => {
  it("registers only the32 positional faces and sole shared Super Spies script", () => {
    const faces = catalog.filter(
      (c) => c.pack_code === "aos" && c.position >= 34 && c.position <= 63,
    );
    expect(faces).toHaveLength(32);
    expect([...NICK_FURY_SCRIPT_CODES].sort()).toEqual(
      ["50024", ...faces.map((c) => c.code)].sort(),
    );
    expect(NICK_FURY_SCRIPT_CODES).not.toContain("50064");
  });
  it("preserves the exact Justice starter and one separately prepared Permanent suit", () => {
    const d = decks.find((d) => d.heroCode === "50034a")!;
    expect(d.cards).toEqual(counts);
    expect(d.setupCards).toEqual({ "50035a": 1 });
    expect(d.deckSize).toBe(40);
    expect(d.aspect).toBe("justice");
    const expanded = Object.entries(counts).flatMap(([code, n]) =>
      Array(n).fill(code),
    );
    expect(deckCodes("nick_fury", "justice").sort()).toEqual(expanded.sort());
    expect(expanded.filter((c) => c !== "50035a")).toHaveLength(40);
  });
  it("keeps both reverse faces linked and preserves printed identity statistics", () => {
    expect(raw("50034a")).toMatchObject({
      back_link: "50034b",
      attack: 2,
      thwart: 2,
      defense: 2,
      health: 10,
      hand_size: 5,
    });
    expect(raw("50034b")).toMatchObject({ recover: 4, hand_size: 6 });
    expect(raw("50035a")).toMatchObject({
      back_link: "50035b",
      permanent: true,
    });
    expect(raw("50035b")).toMatchObject({ permanent: true });
    expect(HEROES.find((h) => h.id === "nick_fury")).toMatchObject({
      code: "50034a",
      alter: "50034b",
      aspect: "justice",
    });
  });
  it("reserves exactly the printed five nemesis physical cards and one obligation", () => {
    const r = heroRuntime("nick_fury")!;
    expect(r.nemesisCodes.sort()).toEqual(["50060", "50061", "50062", "50063"]);
    expect(r.obligationCodes).toEqual(["50059"]);
    expect(raw("50062").quantity).toBe(2);
    expect(raw("50061")).toMatchObject({
      base_threat: 5,
      base_threat_fixed: true,
    });
  });
  it("splits the shared two Super Spies source copies one per hero without rewriting the source", () => {
    expect(raw("50024").quantity).toBe(2);
    expect(decks.find((d) => d.heroCode === "50001a")!.cards["50024"]).toBe(1);
    expect(counts["50024"]).toBe(1);
    expect(raw("50024").text).not.toMatch(/respectively/i);
  });
  it.each([
    "50034a",
    "50034b",
    "50035a",
    "50035b",
    "50042",
    "50050",
    "50051",
    "50052",
    "50058",
    "50060",
    "50063",
  ])("retains original local scan for%s", (code) => {
    const path = (images as Record<string, string>)[code];
    expect(path).toBeTruthy();
    expect(existsSync(`public${path}`)).toBe(true);
    expect(raw(code).image_url).toMatch(/official\//);
  });
  it("aliases only rules execution while preserving actual reprint codes", () => {
    for (const [a, b] of [
      ["50047", "08011"],
      ["50048", "08012"],
      ["50049", "27043"],
      ["50053", "06031"],
      ["50057", "27055"],
    ]) {
      expect(NATIVE_SCRIPT_REPRINTS[a]).toBe(b);
      expect(raw(a).name).toBe(raw(b).name);
    }
  });
});
