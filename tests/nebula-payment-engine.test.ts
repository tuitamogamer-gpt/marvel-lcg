import { describe, expect, it } from "vitest";
import { dispatch, newGame, playable } from "../src/game/engine.js";
import { statusCards } from "../src/game/keywords.js";
import type { GameState } from "../src/game/types.js";
import {
  choose,
  command,
  conserved,
  finish,
  hand,
  minion,
  physical,
  put,
  reload,
  respond,
  target,
} from "./dv-test-helpers.js";

function base() {
  let s = newGame({
    heroId: "nebu",
    aspect: "justice",
    villainId: "rhino",
    seed: 22011,
    pacing: "expert",
  });
  s = finish(command(s, { type: "MULLIGAN", ids: [] }));
  const source = physical(s);
  expect(source).toHaveLength(40);
  s.player.deck = source;
  s.player.hand = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.player.form = "hero";
  s.player.exhausted = false;
  s.scheme.threat = 3;
  s.villain.hp = s.villain.maxHp = 50;
  return s;
}

function shipPayment(s: GameState) {
  const ship = put(s, "22003");
  const [eros, determination] = hand(s, "22011", "22016");
  s = command(s, { type: "PLAY", id: eros.id });
  expect(s.prompt?.kind).toBe("payment");
  s = command(s, {
    type: "PAY",
    ids: [ship.id, determination.id],
    wildAs: "mental",
  });
  expect(s.prompt?.title).toBe("Allocate payment resources");
  return { s, ship, eros, determination };
}

describe("Nebula actual variable payment", () => {
  it("allocates the Ship and Determination wilds independently so Eros can be paid with exactly one Mental", () => {
    let state = base();
    const first = minion(state, "01101"),
      second = minion(state, "01101");
    const { s, ship, eros } = shipPayment(state);
    state = choose(reload(s), "energy+mental");
    state = respond(state, /Eros/);
    state = target(state, first.id);
    state = finish(state);
    expect(
      statusCards(
        state.minions.find((p) => p.id === first.id)!,
        "confused",
      ),
    ).toBe(1);
    expect(
      statusCards(
        state.minions.find((p) => p.id === second.id)!,
        "confused",
      ),
    ).toBe(0);
    expect(state.player.inPlay.find((p) => p.id === ship.id)?.exhausted).toBe(
      true,
    );
    expect(state.player.inPlay.some((p) => p.id === eros.id)).toBe(true);
    conserved(state, [ship, eros]);
  });

  it("cancels a saved allocation before either resource or Eros is committed", () => {
    const { s, ship, eros, determination } = shipPayment(base());
    const canceled = dispatch(reload(s), { type: "CANCEL" });
    expect(canceled.error).toBeUndefined();
    expect(
      canceled.player.inPlay.find((p) => p.id === ship.id)?.exhausted,
    ).toBe(false);
    expect(canceled.player.hand.some((p) => p.id === eros.id)).toBe(true);
    expect(canceled.player.inPlay.some((p) => p.id === eros.id)).toBe(false);
    expect(canceled.player.hand.some((p) => p.id === determination.id)).toBe(
      true,
    );
    conserved(canceled, [ship, eros, determination]);
  });

  it("disables Lethal Intent before play when a positive X cannot be paid", () => {
    const s = base();
    put(s, "22007");
    const [event] = hand(s, "22010");
    expect(playable(s, event)).toContain("payable positive X");
    const denied = dispatch(reload(s), { type: "PLAY", id: event.id });
    expect(denied.error).toContain("payable positive X");
    expect(denied.player.hand.some((p) => p.id === event.id)).toBe(true);
    conserved(denied, [event]);
  });
});
