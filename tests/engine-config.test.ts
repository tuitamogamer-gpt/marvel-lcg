import { describe, expect, it } from "vitest";
import { newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import type { Aspect } from "../src/game/types";

const setup = {
  heroId: "captain_america",
  aspect: "leadership" as Aspect,
  villainId: "mutagen_formula",
  seed: 12,
};

describe("complete mission dependency checks", () => {
  it("rejects unimplemented modular sets instead of silently omitting their cards", () => {
    expect(() => newGame({ ...setup, module: "space_pirates" })).toThrow(
      "This modular set’s complete rules are not implemented yet.",
    );
  });

  it("rejects an invalid aspect even when the default deck is requested", () => {
    expect(() => newGame({ ...setup, aspect: "pool" as Aspect })).toThrow(
      "Choose a valid aspect for every hero.",
    );
    expect(() =>
      newGame({
        ...setup,
        heroes: [
          { heroId: "captain_america", aspect: "leadership" },
          { heroId: "hulk", aspect: "pool" as Aspect },
        ],
      }),
    ).toThrow("Choose a valid aspect for every hero.");
  });

  it("rejects invalid runtime difficulty rather than applying Standard setup", () => {
    expect(() =>
      newGame({ ...setup, difficulty: "unknown" as "standard" }),
    ).toThrow("Choose Standard or Expert difficulty.");
  });

  it("keeps the implemented scenario’s complete default modular set", () => {
    const state = newGame(setup);
    expect(state.module).toBe("goblin_gimmicks");
    expect(
      [...state.encounter.deck, ...state.encounter.discard].some(
        (p) => card(p).set_code === "goblin_gimmicks",
      ),
    ).toBe(true);
  });
});
