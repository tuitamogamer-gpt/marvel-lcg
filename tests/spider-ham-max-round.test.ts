import { describe, expect, it } from "vitest";
import { deckCodes } from "../src/game/cards.js";
import { dispatch, newGame, playable } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import { choose, command, native, play, reload } from "./dv-test-helpers.js";

type SourceState = GameState & { maximumOriginalIds?: string[] };
function physical(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
    ...(p.inheritorBoosts || []).flatMap(nested),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.spiderHamIdentity ? [p.spiderHamIdentity] : []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function conserved(s: GameState) {
  for (const id of (s as SourceState).maximumOriginalIds || [])
    expect(
      physical(s).filter((p) => p.id === id),
      id,
    ).toHaveLength(1);
}
function settle(s: GameState) {
  for (let n = 0; s.prompt && n < 100; n++) {
    expect(s.prompt.kind).toBe("choice");
    const id =
      s.prompt.options.find((o) =>
        /^(skip|pass|none|done|continue|no|decline|take|resolve|allow)$/.test(
          o.id,
        ),
      )?.id ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  conserved(s);
  return s;
}
function base(first: "spiderham" | "nebu") {
  const other = first === "spiderham" ? "nebu" : "spiderham";
  let s = newGame({
    heroId: first,
    aspect: "justice",
    villainId: "rhino",
    module: "inheritors",
    heroes: [
      { heroId: first, aspect: "justice" },
      { heroId: other, aspect: "justice" },
    ],
    seed: 30017,
    pacing: "expert",
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    const p = seatView(s, seat).player,
      originals = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    expect(originals).toHaveLength(40);
    expect(originals.map((p) => p.code).sort()).toEqual(
      deckCodes(seat.heroId, "justice").sort(),
    );
    expect(originals.every((p) => p.ownerId === seat.id)).toBe(true);
    p.deck = originals;
    p.hand = [];
    p.discard = [];
    p.inPlay = [];
    p.form = "hero";
    p.exhausted = p.tough = p.stunned = p.confused = false;
  }
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  s.scheme.threat = 0;
  (s as SourceState).maximumOriginalIds = physical(s).map((p) => p.id);
  return s;
}
function hand(s: GameState, code: string): Piece {
  const index = s.player.deck.findIndex((p) => p.code === code);
  expect(index).toBeGreaterThanOrEqual(0);
  const [p] = s.player.deck.splice(index, 1);
  s.player.hand.push(p);
  return p;
}

describe("One Way or Another maximum survives a player's elimination", () => {
  it.each([
    ["spiderham", "30017", "22015"],
    ["nebu", "22015", "30017"],
  ] as const)(
    "%s's actual %s PLAY blocks surviving teammate's %s that round",
    (hero, playedCode, blockedCode) => {
      let s = base(hero);
      const event = hand(s, playedCode),
        side = s.encounter.deck.find((p) => p.code === "01108")!;
      expect(playable(s, event)).toBeNull();
      s = play(s, event);
      expect(s.prompt?.options.some((o) => o.id === side.id)).toBe(true);
      s = settle(choose(s, side.id));
      expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
      expect(s.flags.nebulaPackOneWayRound).toBe(s.round);
      const playedRound = s.round;
      s = settle(
        native(s, {
          type: "damage",
          target: "hero",
          amount: s.player.hp,
          actorId: "p1",
          source: "maximum-elimination-control",
        }),
      );
      expect(s.players.find((seat) => seat.id === "p1")?.eliminated).toBe(true);
      expect(s.players.find((seat) => seat.id === "p2")?.eliminated).toBe(
        false,
      );
      expect(s.round).toBe(playedRound);
      activateSeat(s, "p2");
      s.turnPlayerId = "p2";
      const other = hand(s, blockedCode);
      expect(playable(s, other)).toMatch(/maximum|limited.*round/i);
      const rejected = dispatch(reload(s), { type: "PLAY", id: other.id });
      expect(rejected.error).toMatch(/maximum|limited.*round/i);
      expect(
        rejected.player.hand.filter((p) => p.id === other.id),
      ).toHaveLength(1);
      expect(rejected.player.discard.some((p) => p.id === other.id)).toBe(
        false,
      );
      conserved(rejected);
    },
  );
});
