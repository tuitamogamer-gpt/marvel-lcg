/** The shared optional initiation decision keeps the attacked seat's receipt,
 * hidden boosts and serialized continuation through a teammate's interrupt. */
import { describe, expect, it } from "vitest";
import { dispatch, makePiece } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { Command, GameState } from "../src/game/types.js";
import {
  base,
  finish,
  hand,
  native,
  pay,
  reload,
  top,
} from "./dv-test-helpers.js";

function click(s: GameState, command: Command) {
  const result = dispatch(reload(s), command);
  expect(result.error).toBeUndefined();
  return result;
}
function attackPosition() {
  let s = base("drax", "spider_man");
  const [subdue, resource] = hand(s, "19018", "19023");
  const drawn = top(s, "01004", "p2"),
    boost = makePiece(s, "01103");
  s.encounter.deck.unshift(boost);
  s.guided = true;
  s.pacing = "guided";
  s = native(s, {
    type: "enemyAttack",
    id: s.villain.id,
    actorId: "p2",
  });
  expect(s.review).toBeNull();
  expect(s.prompt?.title).toBe("Enemy initiates attack");
  expect(s.prompt?.context?.attack?.target).toMatchObject({
    code: "01001a",
    name: "Spider-Man",
    playerId: "p2",
  });
  expect(s.prompt?.context?.cards).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: drawn.id, kind: "drawn" }),
    ]),
  );
  expect(s.prompt?.context?.cards?.some((c) => c.id === boost.id)).not.toBe(
    true,
  );
  return { s, subdue, resource, boost, drawn };
}

describe("shared initiation choices preserve native guided attack context", () => {
  it("passing an actual teammate interrupt goes directly to the hidden-boost defender choice", () => {
    const position = attackPosition();
    let s = click(position.s, { type: "CHOOSE", id: "continue" });
    expect(s.review).toBeNull();
    expect(s.prompt?.title).toBe("Rhino attacks");
    expect(s.prompt?.context?.attack?.target.playerId).toBe("p2");
    expect(
      s.prompt?.context?.cards?.some((c) => c.id === position.drawn.id),
    ).toBe(true);
    expect(
      s.prompt?.context?.cards?.some((c) => c.id === position.boost.id),
    ).not.toBe(true);
    expect(s.attack?.pendingBoosts?.map((p) => p.id)).toEqual([
      position.boost.id,
    ]);
    expect(
      seatView(s, "p1").player.hand.some((p) => p.id === position.subdue.id),
    ).toBe(true);
    s = finish(s);
    expect(s.attack).toBeNull();
  });

  it("paying another seat's Subdue resumes the attacked identity and keeps its boosts hidden", () => {
    const position = attackPosition();
    const choice = position.s.prompt!.options.find((o) => o.image === "19018")!;
    expect(choice).toBeTruthy();
    let s = click(position.s, { type: "CHOOSE", id: choice.id });
    expect(s.activePlayerId).toBe("p1");
    expect(s.review).toBeNull();
    expect(s.prompt?.kind).toBe("payment");
    s = pay(s, [position.resource]);
    expect(s.review).toBeNull();
    expect(s.prompt?.title).toBe("Rhino attacks");
    expect(s.activePlayerId).toBe("p2");
    expect(s.attack?.modifier).toBe(-3);
    expect(s.prompt?.context?.attack?.target).toMatchObject({
      code: "01001a",
      name: "Spider-Man",
      playerId: "p2",
    });
    expect(
      s.prompt?.context?.cards?.some((c) => c.id === position.boost.id),
    ).not.toBe(true);
    s = finish(s);
    // Rhino's 2 ATK plus Shocker's 2 boosts still deals 1 after Subdue.
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(
      seatView(s, "p1").player.discard.filter(
        (p) => p.id === position.subdue.id,
      ),
    ).toHaveLength(1);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
  });
});
