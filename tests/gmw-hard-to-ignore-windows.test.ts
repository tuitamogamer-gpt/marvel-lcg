/** Each actual response copy rechecks the live main scheme before offering. */
import { describe, expect, it } from "vitest";
import { card, deckCodes } from "../src/game/cards.js";
import { newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import { choose, command, native, reload } from "./dv-test-helpers.js";

function physical(s: GameState): Piece[] {
  const walk = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(walk),
    ...(p.captured || []).flatMap(walk),
    ...(p.droneCard ? walk(p.droneCard) : []),
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
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.resolving,
    ...s.removed,
  ].flatMap(walk);
}
function audit(s: GameState, ids: string[]) {
  const all = physical(s);
  for (const id of ids)
    expect(
      all.filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function pass(s: GameState) {
  for (let n = 0; s.prompt && n < 100; n++) {
    const id = s.prompt.options.find((o) =>
      ["pass", "skip", "no", "continue", "take", "resolve"].includes(o.id),
    )?.id;
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function base(threat: number) {
  let s = newGame({
    heroId: "groot",
    aspect: "protection",
    villainId: "risky_business",
    difficulty: "expert",
    module: "zzzax",
    seed: 21420,
    pacing: "expert",
  });
  s = pass(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.deck.push(...s.player.hand.splice(0));
  s.player.form = "hero";
  s.player.exhausted = false;
  s.player.confused = true;
  const source = [...s.player.deck, ...s.player.discard, ...s.player.inPlay];
  expect(source).toHaveLength(40);
  expect(source.map((p) => p.code).sort()).toEqual(
    deckCodes("groot", "protection").sort(),
  );
  const originalIds = physical(s).map((p) => p.id);
  const hard = s.player.deck.filter((p) => p.code === "16017").slice(0, 2);
  expect(hard).toHaveLength(2);
  for (const p of hard) {
    s.player.deck.splice(
      s.player.deck.findIndex((x) => x.id === p.id),
      1,
    );
    s.player.inPlay.push(p);
  }
  const enemy =
    s.minions.find((p) => p.code === "02007") ||
    s.encounter.deck.find((p) => p.code === "02007")!;
  expect(enemy).toBeTruthy();
  if (!s.minions.some((p) => p.id === enemy.id)) {
    s.encounter.deck.splice(
      s.encounter.deck.findIndex((p) => p.id === enemy.id),
      1,
    );
    s = native(s, { type: "reveal", piece: enemy, skip: true });
    s = pass(choose(s, "boost"));
  }
  s.scheme.threat = threat;
  audit(s, originalIds);
  s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "hero");
  expect(s.prompt?.title).toBe("Hard to Ignore");
  return { s, hard, originalIds };
}

describe("Hard to Ignore's live native response windows", () => {
  it.each([1, 2])(
    "two original copies offer exactly %i legal uses at the live threat limit",
    (threat) => {
      const fixture = base(threat);
      let s = fixture.s;
      const hp = s.player.hp;
      for (let n = 0; n < threat; n++) {
        expect(s.prompt?.title).toBe("Hard to Ignore");
        s = choose(reload(s), "yes");
        audit(s, fixture.originalIds);
      }
      // The queued second copy must not open a stale 'yes' after the first copy
      // removed the last threat. Its actual card and readiness remain intact.
      expect(s.prompt?.title).not.toBe("Hard to Ignore");
      s = pass(s);
      expect(s.scheme.threat).toBe(0);
      expect(s.player.hp).toBe(hp);
      expect(s.player.confused).toBe(true);
      expect(
        s.player.inPlay.find((p) => p.id === fixture.hard[0].id)?.exhausted,
      ).toBe(true);
      expect(
        s.player.inPlay.find((p) => p.id === fixture.hard[1].id)?.exhausted,
      ).toBe(threat === 2);
      audit(s, fixture.originalIds);
    },
  );
  it("passing the first saved copy preserves its readiness while a later actual copy removes the last threat", () => {
    const fixture = base(1);
    let s = choose(reload(fixture.s), "skip");
    expect(s.prompt?.title).toBe("Hard to Ignore");
    s = choose(reload(s), "yes");
    expect(s.prompt?.title).not.toBe("Hard to Ignore");
    s = pass(s);
    expect(s.scheme.threat).toBe(0);
    expect(
      s.player.inPlay.find((p) => p.id === fixture.hard[0].id)?.exhausted,
    ).toBe(false);
    expect(
      s.player.inPlay.find((p) => p.id === fixture.hard[1].id)?.exhausted,
    ).toBe(true);
    audit(s, fixture.originalIds);
  });
});
