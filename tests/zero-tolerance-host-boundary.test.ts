/** Independent native boundaries retain the real custom40, scenario/module
 * pieces and double-sided Mall/Jubilee source through every JSON command. */
import { describe, expect, it } from "vitest";
import { card, deckCodes } from "../src/game/cards.js";
import { newGame } from "../src/game/engine.js";
import { isTextBlank } from "../src/game/card-text.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  actualEncounter,
  choose,
  command,
  native,
  operation,
  passId,
  physical,
  reload,
  respond,
  until,
} from "./project-wideawake-test-helpers.js";

type Fixture = GameState & { zeroBoundaryIds?: string[] };
function exact(s: GameState) {
  const ids = physical(s)
    .map((p) => p.id)
    .sort();
  expect(new Set(ids).size).toBe(ids.length);
  if ((s as Fixture).zeroBoundaryIds)
    expect(ids).toEqual([...(s as Fixture).zeroBoundaryIds!].sort());
  return s;
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 160; n++) {
    const id =
      prefer?.(s) ||
      passId(s) ||
      (/forced|order|search/i.test(s.prompt.title) ||
      s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return exact(s);
}
function base(module = "sentinels", villainId = "project_wideawake") {
  const deckCards = deckCodes("spider_man", "leadership");
  const slot = deckCards.findIndex(
    (c) => card(c).faction_code === "leadership",
  );
  expect(slot).toBeGreaterThanOrEqual(0);
  deckCards[slot] = "19032";
  let s = newGame({
    heroId: "spider_man",
    aspect: "leadership",
    heroes: [{ heroId: "spider_man", aspect: "leadership", deckCards }],
    villainId,
    module,
    ...(villainId === "project_wideawake" ? { captureAllocation: [0] } : {}),
    seed: 321042,
    pacing: "expert",
  });
  s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  const source = [
    ...s.player.deck,
    ...s.player.hand,
    ...s.player.discard,
    ...s.player.inPlay,
  ];
  expect(source).toHaveLength(40);
  expect(source.map((p) => p.code).sort()).toEqual(deckCards.slice().sort());
  s.player.deck = source;
  s.player.hand = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.player.form = "hero";
  s.player.exhausted = false;
  s.scheme.threat = 0;
  (s as Fixture).zeroBoundaryIds = physical(s).map((p) => p.id);
  const regroup = takePlayer(s, "19032");
  s.player.inPlay.push(regroup);
  return { s: exact(reload(s)), regroupId: regroup.id };
}
function takePlayer(s: GameState, code: string): Piece {
  for (const zone of [
    s.player.deck,
    s.player.hand,
    s.player.discard,
    s.player.inPlay,
  ]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing original custom40 player source ${code}`);
}
function jubilee(s: GameState) {
  const mall = s.sideSchemes.find((p) => p.code === "32088a")!;
  expect(mall).toBeTruthy();
  s = settle(
    native(s, {
      type: "thwart",
      target: mall.id,
      amount: mall.counters,
      source: "hero",
    }),
    (v) =>
      v.prompt?.title === "Search encounter cards"
        ? v.prompt.options.find((o) => o.image === "32093")?.id
        : undefined,
  );
  const p = s.player.inPlay.find((p) => p.id === mall.id)!;
  expect(p.code).toBe("32088b");
  p.damage = card(p).health! - 1;
  return { s, id: p.id };
}
function attack(s: GameState, id = s.villain.id) {
  return native(s, {
    type: "enemyAttack",
    id,
    activation: { enemyId: id, playerId: "p1", kind: "attack" },
    actorId: "p1",
  });
}
function defender(s: GameState, id: string) {
  return choose(
    until(s, (v) => !!v.prompt?.options.some((o) => o.id === id)),
    id,
  );
}
function sentinelWithBarrier(s: GameState) {
  const sentinel = s.minions.find((p) => p.code === "32093")!;
  expect(sentinel).toBeTruthy();
  const barrier = actualEncounter(s, "32103");
  s = settle(native(s, { type: "reveal", piece: barrier, skip: true }));
  expect(s.attachments.find((p) => p.id === barrier.id)?.attachedTo).toBe(
    sentinel.id,
  );
  const actual = s.minions.find((p) => p.id === sentinel.id)!;
  actual.tough = false;
  actual.toughCards = 0;
  return { s, id: sentinel.id, barrierId: barrier.id };
}

describe("OZT independent Victory, removal and boost boundaries", () => {
  it("an ordinary classic encounter ally defeat leaves no unsupported OZT receipt ledger", () => {
    const initial = base("bomb_scare", "rhino");
    let s = initial.s;
    const ally = takePlayer(s, "01084");
    ally.damage = card(ally).health! - 1;
    s.player.inPlay.push(ally);
    const boost = actualEncounter(s, "01187");
    s.encounter.deck.unshift(boost);
    s = defender(attack(s), ally.id);
    s = settle(choose(s, "defeat"));
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(Object.keys(s.zeroToleranceDefeats || {})).toEqual([]);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
  });

  it("active Victory Jubilee never offers Regroup and enters Victory before the actual OZT response", () => {
    const initial = base(),
      rescued = jubilee(initial.s),
      attacker = sentinelWithBarrier(rescued.s);
    let s = defender(attack(attacker.s, attacker.id), rescued.id);
    expect(s.prompt?.title).toBe("Forced responses");
    expect(s.prompt?.options.some((o) => /Regroup/i.test(o.label))).toBe(false);
    expect(s.victoryDisplay?.filter((p) => p.id === rescued.id)).toHaveLength(
      1,
    );
    expect(operation(s).captured || []).toHaveLength(0);
    exact(reload(s));
    s = settle(respond(s, /Operation Zero Tolerance/));
    expect(s.victoryDisplay?.some((p) => p.id === rescued.id)).toBe(false);
    expect(
      operation(s).captured?.filter((p) => p.id === rescued.id),
    ).toHaveLength(1);
    expect(s.player.inPlay.some((p) => p.id === initial.regroupId)).toBe(true);
    expect(s.removed.some((p) => p.id === rescued.id)).toBe(false);
  });

  it.each([false, true])(
    "a saved blanked-Victory Jubilee goes to RFG and stays there after enemy attack, Regroup=%s",
    (useRegroup) => {
      const initial = base(),
        rescued = jubilee(initial.s),
        attacker = sentinelWithBarrier(rescued.s);
      let s = attacker.s;
      s.flags[`novaIronheartPackBlank:${rescued.id}`] = s.round;
      expect(
        isTextBlank(
          s,
          s.player.inPlay.find((p) => p.id === rescued.id)!,
        ),
      ).toBe(true);
      s = defender(attack(s, attacker.id), rescued.id);
      expect(s.prompt?.title).toBe("Jubilee");
      expect(s.prompt?.options.some((o) => o.id === initial.regroupId)).toBe(
        true,
      );
      s = choose(s, useRegroup ? initial.regroupId : "defeat");
      s = settle(s);
      expect(s.removed.filter((p) => p.id === rescued.id)).toHaveLength(1);
      expect(
        operation(s).captured?.some((p) => p.id === rescued.id),
      ).toBeFalsy();
      expect(s.victoryDisplay?.some((p) => p.id === rescued.id)).toBeFalsy();
      expect(s.player.hand.some((p) => p.id === rescued.id)).toBe(false);
      expect(s.player.discard.some((p) => p.id === rescued.id)).toBe(false);
      expect(s.enemyAttackCounts?.[attacker.id]).toBe(1);
    },
  );

  it("the actual Concussive Blast boost defeats an ordinary ally without generating an OZT enemy-attack defeat", () => {
    const initial = base("under_attack");
    let s = initial.s;
    const ally = takePlayer(s, "01084");
    ally.damage = card(ally).health! - 1;
    s.player.inPlay.push(ally);
    const boost = actualEncounter(s, "01154");
    s.encounter.deck.unshift(boost);
    s = settle(defender(attack(s), "hero"));
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(operation(s).captured || []).toHaveLength(0);
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    expect(s.player.inPlay.some((p) => p.id === initial.regroupId)).toBe(true);
  });

  it("Jubilee defeated by the actual boost enters Victory and stays there rather than being captured after the villain attack", () => {
    const initial = base("under_attack"),
      rescued = jubilee(initial.s);
    let s = rescued.s;
    const boost = actualEncounter(s, "01154");
    s.encounter.deck.unshift(boost);
    s = settle(defender(attack(s), "hero"));
    expect(s.victoryDisplay?.filter((p) => p.id === rescued.id)).toHaveLength(
      1,
    );
    expect(operation(s).captured || []).toHaveLength(0);
    expect(s.removed.some((p) => p.id === rescued.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
  });
});
