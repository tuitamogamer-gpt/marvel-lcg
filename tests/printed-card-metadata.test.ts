import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { printedCardMetadata } from "../src/game/printed-card-metadata";
import type { Card } from "../src/game/types";

function printing(code: string): Card {
  return catalog.find((c) => c.code === code)! as Card;
}

describe("verified original Drax printing metadata", () => {
  // Original English scans: public/cards/catalog/19025.webp–19029.webp.
  it.each([
    ["19025", 2],
    ["19026", 2],
    ["19027", 3],
    ["19028", 1],
    ["19029", 2],
  ] as const)(
    "%s retains its source while gaining %i boost icons",
    (code, boost) => {
      const raw = printing(code);
      const before = structuredClone(raw);
      const frozen = Object.freeze({ ...raw });
      const face = printedCardMetadata(frozen);

      expect(raw.boost).toBeUndefined();
      expect(face.boost).toBe(boost);
      expect(face.boost_star).toBeUndefined();
      expect(face).not.toBe(frozen);
      expect(raw).toEqual(before);
      expect(frozen).toEqual(before);
      expect(face.text).toBe(raw.text);
      expect(face.quantity).toBe(raw.quantity);
      expect(face.code).toBe(raw.code);
    },
  );

  it("restores Challenge Accepted's printed ATK modifier independently of its text", () => {
    // public/cards/catalog/19028.webp has +2 ATK outside the ability text box.
    const raw = printing("19028");
    const face = printedCardMetadata(raw);

    expect(raw.attack).toBeUndefined();
    expect(face.attack).toBe(2);
    expect(face.text).toBe(raw.text);
    expect(face.errata).toBeUndefined();
  });

  it("leaves unrelated source cards unchanged", () => {
    const raw = printing("19001a");
    expect(printedCardMetadata(raw)).toBe(raw);
  });
});

describe("verified Venom encounter metadata needs no correction", () => {
  it("preserves its printed numeric boosts, star-only minion and four copies", () => {
    // Original English scans: public/cards/catalog/20023.webp–20025.webp.
    const obligation = printing("20023");
    const scheme = printing("20024");
    const symbiote = printing("20025");

    expect(obligation.boost).toBe(2);
    expect(scheme.boost).toBe(3);
    expect(symbiote.boost ?? 0).toBe(0);
    expect(symbiote.boost_star).toBe(true);
    expect(symbiote.quantity).toBe(4);
    for (const raw of [obligation, scheme, symbiote]) {
      expect(printedCardMetadata(raw)).toBe(raw);
    }
  });
});
