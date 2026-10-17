import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { controller, seatView } from "../src/game/team.js";
import { playerSideSchemeLimit } from "../src/game/player-side-schemes.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  native,
  pay,
  reload,
} from "./dv-test-helpers.js";

function base(count = 1) {
  const heroes = ["spider_man", "captain_marvel", "black_panther", "she_hulk"]
    .slice(0, count)
    .map((heroId) => ({ heroId, aspect: "justice" as const }));
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    heroes,
    villainId: "rhino",
    seed: 421641,
    pacing: "expert",
  });
  for (let n = 0; n < count; n++) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.deck.push(...p.hand.splice(0));
    p.form = "hero";
  }
  s.villain.hp = s.villain.maxHp = 100;
  s.scheme.threat = 1;
  return s;
}
function hand(s: GameState, code: string, owner = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = owner;
  seatView(s, owner).player.hand.push(p);
  return p;
}
function playScheme(s: GameState, code: string): [GameState, Piece] {
  const p = hand(s, code);
  const resource = card(p).cost ? hand(s, "01088") : undefined;
  s = command(s, { type: "PLAY", id: p.id });
  s = pay(s, resource ? [resource] : []);
  return [s, p];
}
function occurrence(s: GameState, id: string) {
  return [
    ...s.sideSchemes,
    ...s.removed,
    ...(s.victoryDisplay || []),
    ...s.encounter.discard,
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
  ].filter((p) => p.id === id);
}
const settle = (s: GameState) => finish(s, (v) => v.prompt?.options[0]?.id);

describe("Player side schemes use one common physical zone", () => {
  it.each([1, 2, 3])(
    "paid play at %i players uses per-player threat and owner control",
    (count) => {
      let s = base(count);
      let p: Piece;
      [s, p] = playScheme(s, "41016");
      s = finish(reload(s));
      expect(s.sideSchemes.find((q) => q.id === p.id)).toMatchObject({
        counters: 3 * count,
        ownerId: "p1",
        playerSideSchemeController: "p1",
      });
      expect(controller(s, p.id)?.id).toBe("p1");
      expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
      expect(occurrence(s, p.id)).toHaveLength(1);
      expect(playerSideSchemeLimit(s)).toBe(count <= 2 ? 1 : 2);
    },
  );

  it("playing at the shared limit lets the playing seat discard either scheme without defeating it", () => {
    let s = base(2),
      first: Piece,
      second: Piece;
    [s, first] = playScheme(s, "41016");
    s = finish(s);
    s = finish(command(s, { type: "END_TURN" }));
    expect(s.activePlayerId).toBe("p2");
    [s, second] = playScheme(s, "42017");
    expect(s.prompt?.title).toBe("Player side scheme limit");
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([first.id, second.id]);
    s = finish(choose(reload(s), first.id));
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === first.id),
    ).toBe(true);
    expect(s.victoryDisplay || []).toHaveLength(0);
    expect(s.villain.hp).toBe(100);
    expect(s.sideSchemes.map((p) => p.id)).toEqual([second.id]);
    expect(occurrence(s, first.id)).toHaveLength(1);
  });

  it("Lay the Trap deals non-attack damage before its one physical card reaches Victory 0", () => {
    let s = base(),
      p: Piece;
    [s, p] = playScheme(s, "41016");
    s = finish(s);
    s.player.stunned = true;
    s = settle(
      native(reload(s), {
        type: "thwart",
        target: p.id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(95);
    expect(s.player.stunned).toBe(true);
    expect(s.victoryDisplay?.map((q) => q.id)).toContain(p.id);
    expect(s.sideSchemes.some((q) => q.id === p.id)).toBe(false);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(false);
    expect(occurrence(s, p.id)).toHaveLength(1);
  });

  it("an overflow outside card play belongs to the first player", () => {
    let s = base(2),
      p: Piece;
    [s, p] = playScheme(s, "41016");
    s = finish(s);
    s = finish(command(s, { type: "END_TURN" }));
    const added = makePiece(s, "42017");
    added.ownerId = added.playerSideSchemeController = "p2";
    added.counters = 6;
    s.sideSchemes.push(added);
    s = native(s, { type: "playerSideSchemeLimit" });
    expect(s.activePlayerId).toBe(s.firstPlayerId);
    expect(s.prompt?.title).toBe("Player side scheme limit");
    s = finish(choose(reload(s), added.id));
    expect(s.sideSchemes.map((q) => q.id)).toEqual([p.id]);
    expect(
      seatView(s, "p2").player.discard.some((q) => q.id === added.id),
    ).toBe(true);
  });

  it("Medical Aid remains in play through saved healing choices and gives each player their own five", () => {
    let s = base(2),
      p: Piece;
    [s, p] = playScheme(s, "42017");
    s = finish(s);
    const hp = s.players.map((seat) => seatView(s, seat).player.hp);
    for (const seat of s.players) seatView(s, seat).player.hp -= 5;
    s = native(s, {
      type: "thwart",
      target: p.id,
      amount: 6,
      source: "hero",
      actorId: "p2",
    });
    expect(s.prompt?.title).toBe("Render Medical Aid");
    expect(s.sideSchemes.find((q) => q.id === p.id)?.pendingDefeat).toBe(true);
    expect(s.victoryDisplay?.some((q) => q.id === p.id)).not.toBe(true);
    s = settle(reload(s));
    expect(s.players.map((seat) => seatView(s, seat).player.hp)).toEqual(hp);
    expect(s.victoryDisplay?.some((q) => q.id === p.id)).toBe(true);
    expect(occurrence(s, p.id)).toHaveLength(1);
  });

  it("eliminating an owner removes their scheme without reward and preserves the starting-player limit", () => {
    let s = base(3),
      p: Piece;
    [s, p] = playScheme(s, "41016");
    s = finish(s);
    s = settle(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 100,
        source: "villain",
        actorId: "p1",
      }),
    );
    expect(s.players[0].eliminated).toBe(true);
    expect(s.removed.some((q) => q.id === p.id)).toBe(true);
    expect(s.victoryDisplay || []).toHaveLength(0);
    expect(s.villain.hp).toBe(100);
    expect(playerSideSchemeLimit(s)).toBe(2);
    expect(occurrence(s, p.id)).toHaveLength(1);
  });

  it("a unique player side scheme cannot be played twice across seats", () => {
    let s = base(3);
    [s] = playScheme(s, "42017");
    s = finish(s);
    s = finish(command(s, { type: "END_TURN" }));
    const duplicate = hand(s, "42017");
    const result = dispatch(reload(s), { type: "PLAY", id: duplicate.id });
    expect(result.error).toMatch(/unique|already in play/i);
    expect(result.sideSchemes.filter((p) => p.code === "42017")).toHaveLength(
      1,
    );
  });
});
