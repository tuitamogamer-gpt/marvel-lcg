/** The free Kree Fanatic modular set, exercised with the original physical
 * cards in another scenario. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, MODULES, card } from "../src/game/cards";
import { newGame } from "../src/game/engine";
import { KREE_FANATIC_SCRIPT_CODES } from "../src/game/kree-fanatic";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

const team = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
];
function setup(players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    difficulty: "standard",
    seed: 90001,
    pacing: "expert",
    heroes: team.slice(0, players),
    module: "kree_fanatic",
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 150; n++) {
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
function started(players = 1) {
  let s = settle(setup(players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
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
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: take(s, code), actorId: "p1" });
}
function stack(s: GameState, ...codes: string[]) {
  s.encounter.deck.unshift(...codes.map((code) => take(s, code)));
  delete s.encounter.knownTop;
}
const villainAttack = (s: GameState): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: "p1",
});
const K = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `kfan:${type}`,
  ...args,
});

describe("Kree Fanatic original source", () => {
  it("registers every face of the free Kree Fanatic set", () => {
    const faces = CATALOG_CARDS.filter((c) => c.set_code === "kree_fanatic");
    expect(faces).toHaveLength(5);
    expect(new Set(KREE_FANATIC_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(MODULES.map((m) => m.id)).toContain("kree_fanatic");
    const s = settle(setup());
    expect(s.modules).toEqual(["kree_fanatic"]);
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "kree_fanatic"),
    ).toHaveLength(7);
  });
});

describe("Ronan the Accuser", () => {
  it("cannot be stunned", () => {
    let s = started();
    s = settle(reveal(s, "90001"));
    const ronan = s.minions.find((p) => p.code === "90001")!;
    expect(ronan.tough).toBe(true);
    s = settle(
      native(s, { type: "status", target: ronan.id, status: "stunned" }),
    );
    expect(s.minions.find((p) => p.code === "90001")?.stunned).toBeFalsy();
  });
  it("engages the hero with the fewest hit points when the villain phase begins", () => {
    let s = started(2);
    s = settle(reveal(s, "90001"));
    const ronan = s.minions.find((p) => p.code === "90001")!;
    expect(ronan.engagedWith).toBe("p1");
    seatView(s, "p2").player.hp = 3;
    s = settle(native(s, K("engage", { id: ronan.id })));
    expect(s.minions.find((p) => p.code === "90001")?.engagedWith).toBe("p2");
  });
  it("The Accused gives attacks on your identity +1 ATK and is discarded when Ronan is defeated", () => {
    let s = started();
    s = settle(reveal(s, "90003"));
    const accused = s.attachments.find((p) => p.code === "90003")!;
    expect(accused.attachedTo).toBe("hero:p1");
    const hp = s.player.hp;
    stack(s, "01186");
    s = settle(native(s, villainAttack(s)));
    expect(s.player.hp).toBe(hp - 3);
    s = settle(reveal(s, "90001"));
    const ronan = s.minions.find((p) => p.code === "90001")!;
    // Toughness prevents the first damage.
    for (let n = 0; n < 2; n++)
      s = settle(
        native(s, {
          type: "damage",
          target: ronan.id,
          amount: 20,
          source: "hero",
        }),
      );
    expect(s.minions.some((p) => p.code === "90001")).toBe(false);
    expect(s.attachments.some((p) => p.code === "90003")).toBe(false);
  });
});

describe("Kree Fanatic encounter cards", () => {
  it("Bring the Hammer Down has Ronan attack, or surges without him", () => {
    let s = started();
    const dealt = s.encounter.dealt.length;
    s = settle(reveal(s, "90004"));
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s = settle(reveal(s, "90001"));
    const hp = s.player.hp;
    stack(s, "01186");
    s = settle(reveal(s, "90004"));
    expect(s.player.hp).toBeLessThan(hp);
  });
  it("You Dare Oppose Me? deals you each Kree Fanatic card it discards", () => {
    let s = started();
    stack(s, "90001", "01186", "90002");
    const dealt = s.encounter.dealt.length;
    s = settle(reveal(s, "90005"));
    const mine = s.encounter.dealt.filter(
      (p) => card(p).set_code === "kree_fanatic" && p.dealtTo === "p1",
    );
    expect(mine.map((p) => p.code).sort()).toEqual(
      expect.arrayContaining(["90001", "90002"]),
    );
    expect(s.encounter.dealt.length).toBeGreaterThanOrEqual(dealt + 2);
  });
  it("Judge, Jury, Executioner's boost puts it into play", () => {
    let s = started();
    const judge = take(s, "90002");
    s.resolving.push(judge);
    s = settle(native(s, K("judge-boost", { id: judge.id })));
    expect(s.sideSchemes.some((p) => p.code === "90002")).toBe(true);
  });
});
