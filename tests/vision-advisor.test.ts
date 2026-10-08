/** Native advice must respect absolute attack prohibitions before status replacement. */
import { expect, it } from "vitest";
import { adviseAction } from "../src/game/advisor.js";
import { card } from "../src/game/cards.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import {
  command,
  finish,
  native,
  physical,
  reload,
} from "./dv-test-helpers.js";
import type { GameState } from "../src/game/types.js";

function fixture(heroId: "vision" | "valk") {
  let s = newGame({
    heroId,
    aspect: heroId === "valk" ? "aggression" : "protection",
    villainId: "rhino",
    seed: 26032,
    pacing: "expert",
  });
  s = finish(command(s, { type: "MULLIGAN", ids: [] }));
  s = finish(command(s, { type: "FLIP" }));
  const mass = s.player.inPlay.filter((p) =>
    ["26002", "26002b"].includes(p.code),
  );
  s.player.deck.push(
    ...s.player.hand.splice(0),
    ...s.player.discard.splice(0),
    ...s.player.inPlay.filter((p) => !mass.includes(p)),
  );
  s.player.inPlay = mass;
  s.player.exhausted = false;
  s.player.flipped = true;
  s.player.stunned = true;
  s.scheme.threat = 1;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.attack = null;
  return s;
}
function sourceIds(s: GameState) {
  return [...physical(s), ...(s.player.setAside || [])]
    .filter(
      (p) =>
        p.ownerId === s.activePlayerId && card(p).faction_code !== "encounter",
    )
    .map((p) => p.id);
}
function proveLegalThwart(s: GameState) {
  const original = sourceIds(s);
  const advice = adviseAction(reload(s));
  expect(advice?.command).toEqual({ type: "BASIC", action: "thwart" });
  const forbidden = dispatch(reload(s), { type: "BASIC", action: "attack" });
  expect(forbidden.error).toBeTruthy();
  expect(forbidden.player.stunned).toBe(true);
  s = finish(command(reload(s), advice!.command));
  expect(s.scheme.threat).toBe(0);
  expect(s.player.stunned).toBe(true);
  expect(s.player.exhausted).toBe(true);
  const after = sourceIds(s);
  for (const id of original)
    expect(after.filter((x) => x === id)).toHaveLength(1);
  return s;
}
it("actual Intangible Vision advice chooses a legal thwart and preserves Stun and the same Permanent", () => {
  const s = fixture("vision"),
    mass = s.player.inPlay.find((p) => p.code === "26002")!;
  expect(mass).toBeDefined();
  const after = proveLegalThwart(s);
  expect(after.player.inPlay.find((p) => p.id === mass.id)?.code).toBe("26002");
});
it("actual Seduced Valkyrie advice chooses a legal thwart and preserves Stun and the original forty-one source IDs", () => {
  let s = fixture("valk");
  const seduced = makePiece(s, "25032");
  s = finish(native(s, { type: "reveal", piece: seduced }));
  expect(
    s.attachments.some(
      (p) => p.id === seduced.id && p.attachedTo === "hero:p1",
    ),
  ).toBe(true);
  expect(sourceIds(s)).toHaveLength(41);
  proveLegalThwart(s);
});
