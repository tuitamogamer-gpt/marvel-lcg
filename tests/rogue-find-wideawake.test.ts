import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { CATALOG_HEROES, catalogDeckCodes } from "../src/game/catalog.js";
import { newGame, playable } from "../src/game/engine.js";
import { rogueTouched } from "../src/game/rogue.js";
import type { GameState } from "../src/game/types.js";
import { command, choose, finish, pay, reload } from "./dv-test-helpers.js";
import { operation, physical } from "./project-wideawake-test-helpers.js";

const missions = [
  { difficulty: "standard", module: "running_interference", seed: 46602 },
  { difficulty: "standard", module: "zzzax", seed: 46610 },
  { difficulty: "expert", module: "a_mess_of_things", seed: 46610 },
] as const;

const originalCards = (s: GameState) =>
  physical(s).filter(
    (p) => p.ownerId === "p1" && card(p).faction_code !== "encounter",
  );
const ids = (pieces: { id: string }[]) => pieces.map((p) => p.id).sort();

describe("Rogue FIND in original Project Wideawake release missions", () => {
  it.each(missions)(
    "$difficulty/$module seed$seed retrieves the captured original Touched and plays Energy Transfer",
    (mission) => {
      const deck = CATALOG_HEROES.find((h) => h.id === "rogue")!.decks.find(
        (d) => d.sourceType !== "app-starter",
      )!;
      const codes = catalogDeckCodes(deck);
      expect(codes).toHaveLength(41);
      let s = newGame({
        ...mission,
        heroId: "rogue",
        aspect: "protection",
        villainId: "project_wideawake",
        pacing: "expert",
        heroes: [{ heroId: "rogue", aspect: "protection", deckCards: codes }],
      });
      expect(s.phase).toBe("mulligan");
      const originals = originalCards(s);
      expect(originals.map((p) => p.code).sort()).toEqual([...codes].sort());
      expect(new Set(ids(originals)).size).toBe(41);
      const capturedBefore = operation(s).captured!;
      const touched = capturedBefore.find((p) => p.code === "38002")!;
      expect(touched).toMatchObject({ code: "38002", ownerId: "p1" });
      const handBefore = ids(s.player.hand);
      const deckBefore = ids(s.player.deck);
      const remainingCaptured = capturedBefore.filter(
        (p) => p.id !== touched.id,
      );

      s = finish(command(reload(s), { type: "MULLIGAN", ids: [] }));
      expect(s.phase).toBe("player");
      expect(s.player.setAside?.filter((p) => p.id === touched.id)).toEqual([
        expect.objectContaining({
          id: touched.id,
          code: "38002",
          ownerId: "p1",
        }),
      ]);
      expect(operation(s).captured).toHaveLength(capturedBefore.length - 1);
      expect(ids(operation(s).captured!)).toEqual(ids(remainingCaptured));
      expect(ids(s.player.hand)).toEqual(handBefore);
      expect(ids(s.player.deck)).toEqual(deckBefore);
      expect(ids(originalCards(s))).toEqual(ids(originals));

      s = finish(command(reload(s), { type: "FLIP" }));
      // The running-interference seed draws Energy Transfer later. After all
      // setup/hand assertions, stage that original deck instance for its play.
      if (!s.player.hand.some((p) => p.code === "38007")) {
        const index = s.player.deck.findIndex((p) => p.code === "38007");
        expect(index).toBeGreaterThanOrEqual(0);
        s.player.hand.push(s.player.deck.splice(index, 1)[0]);
      }
      const event = s.player.hand.find((p) => p.code === "38007")!;
      expect(event).toBeTruthy();
      expect(playable(s, event)).toBeNull();
      const payment = s.player.hand
        .filter((p) => p.id !== event.id && card(p).type_code !== "resource")
        .slice(0, 2);
      expect(payment).toHaveLength(2);
      s.player.hp -= 2;
      const woundedHP = s.player.hp;
      s.player.exhausted = true;
      s = command(s, { type: "PLAY", id: event.id });
      expect(s.prompt?.kind).toBe("payment");
      s = pay(reload(s), payment);
      s = finish(choose(reload(s), s.villain.id));
      expect(rogueTouched(s)).toMatchObject({
        id: touched.id,
        code: "38002",
        ownerId: "p1",
        attachedTo: s.villain.id,
      });
      expect(s.player.hp).toBe(woundedHP + 2);
      expect(s.player.exhausted).toBe(false);
      expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
      for (const p of payment)
        expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
      expect(ids(originalCards(reload(s)))).toEqual(ids(originals));
      expect(ids(operation(s).captured!)).toEqual(ids(remainingCaptured));
    },
  );
});
