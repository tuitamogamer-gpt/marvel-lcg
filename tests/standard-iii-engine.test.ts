/** Age of Apocalypse's Standard III encounter set, exercised with the
 * original physical cards. Every command crosses a JSON save/reload
 * boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, card } from "../src/game/cards";
import { newGame } from "../src/game/engine";
import {
  DRAWING_NEAR,
  PURSUED,
  STANDARD_III_CODES,
  pursued,
  pursuitLimit,
} from "../src/game/standard-iii";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
const team: Seat[] = [
  { heroId: "captain_marvel", aspect: "aggression" },
  { heroId: "spider_man", aspect: "justice" },
];
const DARK_DESIGNS = "45076";
const SINISTER_STRIKE = "45077";
const EVIL_ALLIANCE = "45078";
const NOWHERE_IS_SAFE = "45079";
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "rhino",
  extra: Record<string, unknown> = { standardIII: true },
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 45075,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...extra,
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 200; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve", "done"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
function opened(players = 1, villainId = "rhino") {
  let s = settle(setup("standard", players, villainId));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(players = 1, villainId = "rhino") {
  const s = opened(players, villainId);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function resolveEncounter(s: GameState) {
  for (
    let n = 0;
    n < 5 &&
    s.prompt?.options.some((o) => o.id === "resolve") &&
    /interrupt available/i.test(s.prompt.text);
    n++
  )
    s = choose(s, "resolve");
  return s;
}
function plainTop(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) => !card(p).boost_star && card(p).type_code !== "minion",
  );
  expect(i).toBeGreaterThanOrEqual(0);
  const [p] = s.encounter.deck.splice(i, 1);
  s.encounter.deck.unshift(p);
  delete s.encounter.knownTop;
  return p;
}
const pursuit = (s: GameState, n: number, playerId = "p1"): Effect => ({
  type: "std3:pursuit",
  n,
  playerId,
});
const nemesis = (s: GameState, heroId = team[0].heroId) =>
  s.minions.filter((m) => card(m).set_code === `${heroId}_nemesis`);
const attacks = (s: GameState) => Number(s.flags.attacksPerformed || 0);

describe("Standard III: original source", () => {
  it("registers every face of the Standard III set", () => {
    expect(new Set(STANDARD_III_CODES)).toEqual(
      new Set(
        CATALOG_CARDS.filter(
          (c) => c.pack_code === "aoa" && c.set_code === "standard_iii",
        ).map((c) => c.code),
      ),
    );
    for (const code of STANDARD_III_CODES)
      expect(hasExecutableScript(code), code).toBe(true);
  });

  it("replaces the core Standard set and starts with Pursued by the Past in play", () => {
    for (const players of [1, 2]) {
      const s = opened(players);
      expect(s.standardIII).toBe(true);
      expect(pursued(s)?.code).toBe(PURSUED);
      expect(pursued(s)?.counters).toBe(0);
      const sets = new Set(
        [...s.encounter.deck, ...s.encounter.discard, ...s.encounter.dealt].map(
          (p) => card(p).set_code,
        ),
      );
      expect(sets.has("standard_iii")).toBe(true);
      expect(sets.has("standard")).toBe(false);
      expect(pursuitLimit(s)).toBe(players + 3);
    }
  });
});

describe("Pursued by the Past", () => {
  it("at 3 more than the number of players: the counters come off and the nemesis set enters", () => {
    let s = started();
    s = settle(native(s, pursuit(s, 3)));
    expect(pursued(s)?.counters).toBe(3);
    expect(nemesis(s)).toHaveLength(0);
    s = settle(resolveEncounter(native(s, pursuit(s, 1))));
    expect(pursued(s)?.counters).toBe(0);
    expect(pursued(s)?.code).toBe(PURSUED);
    expect(nemesis(s).length).toBeGreaterThan(0);
    expect(
      s.sideSchemes.some(
        (p) => card(p).set_code === `${team[0].heroId}_nemesis`,
      ),
    ).toBe(true);
    // Next time the nemesis minion in play activates against you.
    plainTop(s);
    s = reload(s);
    const before = attacks(s);
    s = settle(native(s, pursuit(s, 4)));
    expect(attacks(s)).toBe(before + nemesis(s).length);
  });
});

describe("Standard III encounter cards", () => {
  it("cannot be combined with Standard II, and Expert keeps the core Expert set", () => {
    expect(() =>
      setup("standard", 1, "rhino", { standardII: true, standardIII: true }),
    ).toThrow(/Standard II or Standard III/);
    const s = settle(setup("expert", 1));
    const sets = new Set(
      [...s.encounter.deck, ...s.encounter.discard, ...s.encounter.dealt].map(
        (p) => card(p).set_code,
      ),
    );
    expect(sets.has("standard_iii")).toBe(true);
    expect(sets.has("expert")).toBe(true);
    expect(sets.has("standard")).toBe(false);
  });

  it("Dark Designs: a pursuit counter, then the villain schemes unless the counters just came off", () => {
    let s = started();
    s.player.form = "alter";
    plainTop(s);
    s = reload(s);
    let threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, DARK_DESIGNS)));
    expect(pursued(s)?.counters).toBe(1);
    expect(s.scheme.threat).toBeGreaterThan(threat);
    // At the limit the Forced Response removes the counters first.
    pursued(s)!.counters = pursuitLimit(s) - 1;
    s.encounter.deck.push(...s.encounter.discard.splice(0));
    plainTop(s);
    s = reload(s);
    threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, DARK_DESIGNS)));
    expect(pursued(s)?.counters).toBe(0);
    expect(nemesis(s).length).toBeGreaterThan(0);
  });

  it("Sinister Strike: the villain attacks you in hero form, and it surges in alter-ego form", () => {
    let s = started();
    plainTop(s);
    s = reload(s);
    const before = attacks(s);
    s = settle(resolveEncounter(reveal(s, SINISTER_STRIKE)));
    expect(pursued(s)?.counters).toBe(1);
    expect(attacks(s)).toBe(before + 1);
    s.player.form = "alter";
    s.encounter.deck.push(...s.encounter.discard.splice(0));
    s = reload(s);
    const deck = s.encounter.deck.length;
    s = settle(resolveEncounter(reveal(s, SINISTER_STRIKE)));
    expect(pursued(s)?.counters).toBe(2);
    // Surge: another encounter card is revealed.
    expect(s.encounter.deck.length).toBeLessThan(deck - 1);
  });

  it("Evil Alliance: each nemesis minion in play activates against you; with none, 3 pursuit counters", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, EVIL_ALLIANCE)));
    expect(pursued(s)?.counters).toBe(3);
    // Bring the nemesis in, then Evil Alliance makes it activate.
    s = settle(resolveEncounter(native(s, pursuit(s, 1))));
    expect(nemesis(s).length).toBeGreaterThan(0);
    s.encounter.deck.push(...s.encounter.discard.splice(0));
    plainTop(s);
    s = reload(s);
    const before = attacks(s);
    s = settle(resolveEncounter(reveal(s, EVIL_ALLIANCE)));
    expect(attacks(s)).toBe(before + nemesis(s).length);
    expect(pursued(s)?.counters).toBe(0);
  });

  it("Nowhere is Safe: a pursuit counter, then you discard an upgrade or support you control", () => {
    let s = started();
    const i = s.player.deck.findIndex((p) =>
      ["upgrade", "support"].includes(card(p).type_code),
    );
    expect(i).toBeGreaterThanOrEqual(0);
    const [own] = s.player.deck.splice(i, 1);
    s.player.inPlay.push(own);
    s = reload(s);
    s = settle(
      resolveEncounter(reveal(s, NOWHERE_IS_SAFE)),
      (v) => v.prompt?.options.find((o) => o.id === own.id)?.id,
    );
    expect(pursued(s)?.counters).toBe(1);
    expect(s.player.inPlay.some((p) => p.id === own.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === own.id)).toBe(true);
  });

  it("the boosts: a pursuit counter after the activation resolves", () => {
    let s = started();
    const p = take(s, DARK_DESIGNS);
    s.encounter.deck.unshift(p);
    delete s.encounter.knownTop;
    s = reload(s);
    s = settle(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p1" }),
    );
    expect(pursued(s)?.counters).toBe(1);
  });

  it("Drawing Near stays in play: after your turn begins your top card adds pursuit counters, and its Alter-Ego Action discards it", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, DRAWING_NEAR)));
    const near = s.player.inPlay.find((p) => p.code === DRAWING_NEAR)!;
    expect(near).toBeTruthy();
    // Two printed resource icons on top of the deck.
    const i = s.player.deck.findIndex(
      (p) =>
        Number(card(p).resource_energy || 0) +
          Number(card(p).resource_mental || 0) +
          Number(card(p).resource_physical || 0) +
          Number(card(p).resource_wild || 0) ===
        2,
    );
    if (i >= 0) s.player.deck.unshift(...s.player.deck.splice(i, 1));
    const top = s.player.deck[0];
    const icons =
      Number(card(top).resource_energy || 0) +
      Number(card(top).resource_mental || 0) +
      Number(card(top).resource_physical || 0) +
      Number(card(top).resource_wild || 0);
    s = reload(s);
    s = settle(native(s, { type: "beginTurn", actorId: "p1" }));
    expect(s.player.discard.some((p) => p.id === top.id)).toBe(true);
    expect(pursued(s)?.counters).toBe(icons);
    // Alter-Ego Action: discard an identity-specific card.
    s.player.form = "alter";
    const own = s.player.deck.findIndex(
      (p) => card(p).set_code === team[0].heroId,
    );
    expect(own).toBeGreaterThanOrEqual(0);
    const [specific] = s.player.deck.splice(own, 1);
    s.player.hand.push(specific);
    s = reload(s);
    s = settle(
      command(s, { type: "ABILITY", id: near.id, action: "discard" }),
      (v) => v.prompt?.options.find((o) => o.id === specific.id)?.id,
    );
    expect(s.player.inPlay.some((p) => p.id === near.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === specific.id)).toBe(true);
  });

  it("with two players, the player who places the last counter is the one pursued", () => {
    let s = started(2);
    expect(pursuitLimit(s)).toBe(5);
    s = settle(native(s, pursuit(s, 4, "p1")));
    s = settle(resolveEncounter(native(s, pursuit(s, 1, "p2"))));
    expect(nemesis(s, team[1].heroId).length).toBeGreaterThan(0);
    expect(nemesis(s, team[0].heroId)).toHaveLength(0);
  });
});
