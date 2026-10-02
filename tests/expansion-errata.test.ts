import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { card } from "../src/game/cards";

describe("published Black Widow timing corrections", () => {
  it.each(["08001a", "08009"])(
    "%s responds to resolution and retains the original printing",
    (code) => {
      const printing = catalog.find((c) => c.code === code)!;
      expect(printing.text).toContain("After you trigger the ability");
      expect(card(code).text).toContain("After you resolve the ability");
      expect(card(code).errata?.reference).toContain("1.8");
    },
  );
});
