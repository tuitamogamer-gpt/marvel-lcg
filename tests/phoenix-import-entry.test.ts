import { describe, expect, it, vi } from "vitest";

describe("Phoenix native card definitions do not depend on module entry order", () => {
  it.each(["engine", "cards", "phoenix", "engine-support"])(
    "initializes the registry and an actual Phoenix game when %s loads first",
    async (entry) => {
      vi.resetModules();
      if (entry === "engine") await import("../src/game/engine.js");
      else if (entry === "cards") await import("../src/game/cards.js");
      else if (entry === "phoenix") await import("../src/game/phoenix.js");
      else await import("../src/game/engine-support.js");
      const { newGame } = await import("../src/game/engine.js");
      const { card } = await import("../src/game/cards.js");
      const { PHOENIX_SCRIPT_CODES, phoenixForce } =
        await import("../src/game/phoenix.js");
      const { EXPLICIT_CARD_SCRIPTS } =
        await import("../src/game/engine-support.js");
      expect(PHOENIX_SCRIPT_CODES.length).toBeGreaterThan(0);
      expect(
        PHOENIX_SCRIPT_CODES.every((code) => EXPLICIT_CARD_SCRIPTS.has(code)),
      ).toBe(true);
      expect(card("drone")).toMatchObject({
        name: "Ultron Drone",
        type_code: "minion",
        attack: 1,
        scheme: 1,
        health: 1,
        traits: "Drone.",
      });
      const state = newGame({
        heroId: "phoenix",
        aspect: "justice",
        villainId: "rhino",
        seed: 34001,
      });
      expect(state.error).toBeUndefined();
      expect(phoenixForce(state)).toMatchObject({
        code: "34002a",
        counters: 4,
      });
    },
  );
});
