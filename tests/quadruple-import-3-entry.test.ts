import { describe, expect, it } from "vitest";
import {
  makePiece,
  nativeCanPutIntoPlay,
  nativePutIntoPlay,
  newGame,
} from "../src/game/engine.js";
import { maxHP } from "../src/game/cards.js";
import { seatView } from "../src/game/team.js";
import {
  choose,
  command,
  finish,
  hand,
  minion,
  native,
  put,
  side,
  target,
} from "./dv-test-helpers.js";
import type { GameState, Piece } from "../src/game/types.js";

function position(team = false) {
  let s = newGame({
    heroId: "x23",
    aspect: "aggression",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 4301243,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "x23", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  s = finish(command(s, { type: "FLIP" }));
  s.player.deck.push(...s.player.hand.splice(0));
  s.villain.hp = s.villain.maxHp = 80;
  return s;
}

/** The calling search/recursion ability has already removed this original card
 * from its source zone before handing it to the shared entry adapter. */
function takeFromHand(s: GameState, code: string): Piece {
  const [p] = hand(s, code);
  s.player.hand = s.player.hand.filter((q) => q.id !== p.id);
  return p;
}

function runEntry(s: GameState) {
  return native(s, ...s.queue);
}

describe("quadruple import 3 shared put-into-play entry", () => {
  it("rejects Puncture Wound before an attack without inserting the original card", () => {
    const s = position();
    const wound = takeFromHand(s, "43012");
    expect(nativeCanPutIntoPlay(s, wound)).toBe(false);
    expect(() => nativePutIntoPlay(s, wound)).toThrow(/cannot enter play/i);
    expect(s.player.inPlay.some((p) => p.id === wound.id)).toBe(false);
  });

  it("uses the actual basic attack receipt and X-23 entry hook to offer only attacked enemies", () => {
    let s = position();
    const untouched = minion(s, "01103");
    s = finish(
      target(command(s, { type: "BASIC", action: "attack" }), s.villain.id),
    );
    const wound = takeFromHand(s, "43012");
    expect(nativeCanPutIntoPlay(s, wound)).toBe(true);
    put(s, "43011");
    s.player.hp = maxHP(s) - 3;
    const hpBeforeEntry = s.player.hp;

    nativePutIntoPlay(s, wound);
    s = runEntry(s);
    expect(s.prompt?.title).toBe("Puncture Wound");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([s.villain.id]);
    expect(s.prompt?.options.some((o) => o.id === untouched.id)).toBe(false);
    s = finish(choose(s, s.villain.id));

    expect(s.player.inPlay.filter((p) => p.id === wound.id)).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === wound.id)).toMatchObject({
      code: "43012",
      attachedTo: s.villain.id,
      ownerId: s.activePlayerId,
    });
    // Puncture Wound is an X-23 card, but putting it into play is not playing it.
    expect(s.player.hp).toBe(hpBeforeEntry);
  });

  it("retains an already chosen legal enemy when an ability supplies the attachment target", () => {
    let s = position();
    s = finish(
      target(command(s, { type: "BASIC", action: "attack" }), s.villain.id),
    );
    const wound = takeFromHand(s, "43012");
    nativePutIntoPlay(s, wound, s.villain.id);
    s = finish(runEntry(s));
    expect(s.prompt).toBeNull();
    expect(s.player.inPlay.find((p) => p.id === wound.id)?.attachedTo).toBe(
      s.villain.id,
    );
  });

  it("The Direct Approach excludes the main scheme, Permanent schemes, and a teammate's occupied scheme", () => {
    let s = position(true);
    s.sideSchemes = [];
    const approach = takeFromHand(s, "43020");
    expect(nativeCanPutIntoPlay(s, approach)).toBe(false);
    const permanent = side(s, "34030", 0);
    expect(nativeCanPutIntoPlay(s, approach)).toBe(false);

    const occupied = side(s, "01107", 6);
    const other = makePiece(s, "43020");
    other.ownerId = s.players[1].id;
    other.attachedTo = occupied.id;
    seatView(s, s.players[1]).player.inPlay.push(other);
    expect(nativeCanPutIntoPlay(s, approach)).toBe(false);

    const eligible = side(s, "43018", 8);
    expect(nativeCanPutIntoPlay(s, approach)).toBe(true);
    nativePutIntoPlay(s, approach);
    s = runEntry(s);
    expect(s.prompt?.title).toBe("The Direct Approach");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([eligible.id]);
    for (const illegal of ["main", permanent.id, occupied.id])
      expect(s.prompt?.options.some((o) => o.id === illegal)).toBe(false);
    s = finish(choose(s, eligible.id));
    expect(s.player.inPlay.find((p) => p.id === approach.id)).toMatchObject({
      ownerId: s.activePlayerId,
      attachedTo: eligible.id,
    });
    expect(nativeCanPutIntoPlay(s, makePiece(s, "43020"))).toBe(false);
  });

  it("Front Line Specialist increases current and maximum HP once, preserving existing damage", () => {
    let s = position();
    const reserve = s.player.setAside!;
    const index = reserve.findIndex((p) => p.code === "43036");
    expect(index).toBeGreaterThanOrEqual(0);
    const specialist = reserve.splice(index, 1)[0];
    const previousMax = maxHP(s);
    s.player.hp = previousMax - 3;
    const previousHP = s.player.hp;

    expect(nativeCanPutIntoPlay(s, specialist)).toBe(true);
    nativePutIntoPlay(s, specialist);
    s = finish(runEntry(s));
    expect(maxHP(s)).toBe(previousMax + 4);
    expect(s.player.hp).toBe(previousHP + 4);
    expect(maxHP(s) - s.player.hp).toBe(3);
    expect(s.player.inPlay.filter((p) => p.id === specialist.id)).toHaveLength(
      1,
    );
    expect(s.player.setAside?.some((p) => p.id === specialist.id)).toBe(false);
  });
});
