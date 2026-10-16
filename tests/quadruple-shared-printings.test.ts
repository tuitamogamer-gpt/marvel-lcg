import { describe, expect, it } from "vitest";
import { deckErrors } from "../src/game/decks.js";
import { allyLimit, newGame } from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  finish,
  play,
  respond,
  target,
  until,
} from "./dv-test-helpers.js";

type Hero = "cyclops" | "phoenix" | "storm";
const aspects: Record<Hero, Aspect> = {
  cyclops: "leadership",
  phoenix: "justice",
  storm: "leadership",
};
function opening(heroes: Hero[]) {
  let s = newGame({
    heroId: heroes[0],
    aspect: aspects[heroes[0]],
    villainId: "rhino",
    module: "bomb_scare",
    seed: 343633,
    pacing: "expert",
    heroes: heroes.map((heroId) => ({
      heroId,
      aspect: aspects[heroId],
      deckCards: heroStarterCodes(heroId),
    })),
  });
  for (let n = 0; s.phase === "mulligan" && n < 5; n++) {
    s = command(s, { type: "MULLIGAN", ids: [] });
    if (s.prompt)
      s = finish(
        s,
        (v) => v.prompt?.options.find((o) => o.image === "36002")?.id,
      );
  }
  s = finish(s, (v) => v.prompt?.options.find((o) => o.image === "36002")?.id);
  expect(s.phase).toBe("player");
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.deck.push(...view.player.hand.splice(0));
  }
  return s;
}
function take(s: GameState, code: string, playerId = s.activePlayerId): Piece {
  const p = seatView(s, playerId).player;
  for (const zone of [p.deck, p.hand, p.discard]) {
    const index = zone.findIndex((piece) => piece.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing actual original source ${code} for ${playerId}`);
}
function hand(s: GameState, codes: string[], playerId = s.activePlayerId) {
  const pieces = codes.map((code) => take(s, code, playerId));
  seatView(s, playerId).player.hand.push(...pieces);
  return pieces;
}
function pieces(s: GameState): Piece[] {
  const nested = (piece: Piece): Piece[] => [
    piece,
    ...(piece.storedCards || []).flatMap(nested),
    ...(piece.captured || []).flatMap(nested),
    ...(piece.droneCard ? nested(piece.droneCard) : []),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.attachments,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.sideSchemes,
    ...(s.environments || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
const snapshot = (s: GameState) =>
  pieces(s).map(({ id, code, ownerId }) => ({ id, code, ownerId }));
function conserved(s: GameState, originals: ReturnType<typeof snapshot>) {
  const actual = pieces(s);
  expect(
    new Set(actual.map((p) => p.id)).size,
    "One physical instance per actual zone",
  ).toBe(actual.length);
  expect(actual.map((p) => p.id).sort()).toEqual(
    originals.map((p) => p.id).sort(),
  );
  for (const original of originals) {
    const found = actual.find((p) => p.id === original.id)!;
    expect(found.ownerId).toBe(original.ownerId);
    expect(
      ["34002a", "34002b"].includes(original.code)
        ? ["34002a", "34002b"].includes(found.code)
        : found.code === original.code,
      "Original printing or opposite face of the same physical Phoenix Force",
    ).toBe(true);
  }
}
function reload(s: GameState) {
  const restored: GameState = JSON.parse(JSON.stringify(s));
  expect(restored).toEqual(s);
  return restored;
}

describe("shared adapters with original Storm and Phoenix source printings", () => {
  it("spends Storm's Effective Leadership on its actual Pixie and applies the grant once to her native attack", () => {
    let s = opening(["storm"]);
    const originals = snapshot(s);
    const [pixie, effective, resource] = hand(s, ["36017", "36021", "36009"]);
    const other = take(s, "36016");
    s.player.inPlay.push(other);
    s = play(s, pixie, [effective, resource]);
    s = until(s, (v) => /Effective Leadership/.test(v.prompt?.title || ""));
    s = reload(s);
    s = finish(respond(s, /Effective Leadership/));
    const entered = s.player.inPlay.find((p) => p.id === pixie.id)!;
    expect(entered).toMatchObject({
      code: "36017",
      ownerId: "p1",
      bonusAtk: 1,
      bonusThw: 1,
    });
    expect(s.player.inPlay.find((p) => p.id === other.id)?.bonusAtk || 0).toBe(
      0,
    );
    expect(s.player.discard.filter((p) => p.id === effective.id)).toHaveLength(
      1,
    );
    const before = s.villain.hp;
    s = finish(
      target(
        command(reload(s), { type: "ABILITY", id: pixie.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.villain.hp).toBe(before - 3);
    // Pixie's printed attack has two consequential damage: the boosted
    // three-damage attack still defeats her two-health physical card.
    expect(s.player.inPlay.some((p) => p.id === pixie.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === pixie.id)).toHaveLength(1);
    conserved(s, originals);
  });

  it("Storm's actual Utopia responds to a teammate's paid ally and preserves its controller and the original turn", () => {
    let s = opening(["cyclops", "storm"]);
    const originals = snapshot(s),
      utopia = take(s, "36024", "p2");
    seatView(s, "p2").player.inPlay.push(utopia);
    expect(allyLimit(seatView(s, "p2"))).toBe(4);
    s.player.exhausted = true;
    const [angel, energy] = hand(s, ["33019", "33024"]);
    s = play(s, angel, [energy]);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === utopia.id));
    s = choose(s, utopia.id);
    expect(s.activePlayerId).toBe("p2");
    expect(s.turnPlayerId).toBe("p1");
    s = finish(choose(reload(s), "hero:p1"));
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === utopia.id),
    ).toMatchObject({ code: "36024", ownerId: "p2", exhausted: true });
    expect(
      seatView(s, "p1").player.inPlay.filter((p) => p.id === angel.id),
    ).toHaveLength(1);
    expect(s.activePlayerId).toBe("p1");
    expect(s.turnPlayerId).toBe("p1");
    conserved(s, originals);
  });

  it.each([false, true])(
    "Phoenix's original Psychic Rapport readies both named characters with Cyclops hero=%s and restores her same Force",
    (teammate) => {
      let s = opening(teammate ? ["phoenix", "cyclops"] : ["phoenix"]);
      const originals = snapshot(s);
      const force = s.player.inPlay.find((p) => p.code === "34002a")!;
      expect(force).toBeTruthy();
      force.code = "34002b";
      force.counters = 2;
      s.player.exhausted = true;
      let allyId: string | undefined;
      if (teammate) seatView(s, "p2").player.exhausted = true;
      else {
        const ally = take(s, "34003");
        ally.exhausted = true;
        s.player.inPlay.push(ally);
        allyId = ally.id;
      }
      const [rapport, energy] = hand(s, ["34023", "34025"]);
      s = play(s, rapport, [energy]);
      s = until(s, (v) => v.prompt?.title === "Psychic Rapport");
      expect(s.player.exhausted).toBe(false);
      if (teammate) expect(seatView(s, "p2").player.exhausted).toBe(false);
      else
        expect(s.player.inPlay.find((p) => p.id === allyId)?.exhausted).toBe(
          false,
        );
      expect(s.prompt?.options.some((o) => o.id === force.id)).toBe(true);
      s = finish(choose(reload(s), force.id));
      expect(s.player.inPlay.find((p) => p.id === force.id)).toMatchObject({
        code: "34002a",
        ownerId: "p1",
        counters: 4,
      });
      expect(s.player.discard.filter((p) => p.id === rapport.id)).toHaveLength(
        1,
      );
      expect(s.player.discard.find((p) => p.id === rapport.id)?.code).toBe(
        "34023",
      );
      conserved(s, originals);
    },
  );

  it("enforces Psychic Rapport's shared max-one limit across its two physical printings", () => {
    const source = heroStarterCodes("phoenix"),
      modified = [...source];
    expect(source.includes("34023")).toBe(true);
    expect(deckErrors("phoenix", "justice", source)).toEqual([]);
    const index = modified.indexOf("34027");
    expect(index).toBeGreaterThanOrEqual(0);
    modified[index] = "33023";
    expect(modified).toHaveLength(source.length);
    expect(
      deckErrors("phoenix", "justice", modified).some((error) =>
        /Psychic Rapport/.test(error),
      ),
    ).toBe(true);
  });
});
