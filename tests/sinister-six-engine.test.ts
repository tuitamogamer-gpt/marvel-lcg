/** Sinister Motives: The Sinister Six with Guerrilla Tactics, exercised with
 * the original physical cards. Every command crosses a JSON save/reload
 * boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  handSize,
} from "../src/game/cards";
import { isTextBlank, uncancelableText } from "../src/game/card-text";
import {
  abilityOptions,
  enemyStats,
  makePiece,
  newGame,
} from "../src/game/engine";
import {
  SINISTER_SIX_SCRIPT_CODES,
  sixVillains,
} from "../src/game/sinister-six";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

const team = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "sinister_six",
  module?: string,
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 27094,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...(module ? { module } : {}),
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
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "sinister_six",
  module?: string,
) {
  let s = settle(setup(difficulty, players, villainId, module));
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
const V = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `six:${type}`,
  ...args,
});
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function stack(s: GameState, ...codes: string[]) {
  s.encounter.deck.unshift(...codes.map((code) => take(s, code)));
  delete s.encounter.knownTop;
}
const attack = (s: GameState, target: string, amount: number): Effect => ({
  type: "damage",
  target,
  amount,
  attack: true,
  source: "hero",
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const light = (s: GameState) =>
  s.sideSchemes.find((p) => p.code.startsWith("27102"))!;

describe("The Sinister Six original source", () => {
  it("registers every face of The Sinister Six and Guerrilla Tactics sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "sm" &&
        ["sinister_six", "guerrilla_tactics"].includes(c.set_code || ""),
    );
    expect(faces).toHaveLength(27);
    expect(new Set(SINISTER_SIX_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "sinister_six")).toMatchObject({
      schemes: ["27100b", "27101b"],
      moduleCount: 0,
      fixedSets: ["guerrilla_tactics"],
    });
    expect(MODULES.map((m) => m.id)).toContain("guerrilla_tactics");
  });
  it.each([1, 2, 3])(
    "puts one more villain than %s players into play and Light at the End, Trap! side",
    (players) => {
      const s = settle(setup("standard", players));
      const villains = sixVillains(s);
      expect(villains).toHaveLength(players + 1);
      expect(s.sinisterSix!.active).toBe(villains[0].code);
      expect(s.sinisterSix!.setAside).toHaveLength(5 - players);
      expect(light(s)).toMatchObject({
        code: "27102a",
        counters: 10 + 10 * players,
      });
      expect(s.scheme).toMatchObject({ code: "27100b", threat: 2 * players });
      const all = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
      ];
      const count = (set: string) =>
        all.filter((p) => card(p).set_code === set).length;
      expect(count("sinister_six")).toBe(16);
      expect(count("guerrilla_tactics")).toBe(7);
    },
  );
});

describe("The active counter, defeat and Ambush!", () => {
  it("the active villain's attack that damages you passes the active counter on", () => {
    let s = started("standard", 2);
    const [first, second] = sixVillains(s);
    expect(s.sinisterSix!.active).toBe(first.code);
    stack(s, "01186");
    s = settle(native(s, villainAttack(s)));
    expect(s.sinisterSix!.active).toBe(second.code);
  });
  it("a defeated villain is set aside and removes threat from a side scheme", () => {
    let s = started("standard", 2);
    const target = sixVillains(s)[0];
    const setAside = s.sinisterSix!.setAside.length;
    const before = light(s).counters;
    s = settle(
      native(s, {
        type: "damage",
        target: target.id,
        amount: 20,
        source: "hero",
      }),
    );
    expect(sixVillains(s).some((v) => v.id === target.id)).toBe(false);
    expect(s.sinisterSix!.setAside).toHaveLength(setAside + 1);
    expect(light(s).counters).toBe(before - 4);
    expect(s.phase).toBe("player");
  });
  it("with no villain in play, the next activation ambushes you first", () => {
    let s = started();
    for (const v of sixVillains(s))
      s = settle(
        native(s, { type: "damage", target: v.id, amount: 20, source: "hero" }),
      );
    expect(sixVillains(s)).toHaveLength(0);
    expect(s.sinisterSix!.absent).toBe(true);
    s = settle(native(s, { type: "villainActivate", actorId: "p1" }));
    expect(sixVillains(s)).toHaveLength(1);
  });
  it("Light at the End flips to the Chase when cleared, and clearing the Chase wins", () => {
    let s = started();
    const villains = sixVillains(s).length;
    s = settle(
      native(s, {
        type: "thwart",
        target: light(s).id,
        amount: 99,
        source: "hero",
      }),
    );
    expect(light(s)).toMatchObject({ code: "27102b", counters: 15 });
    expect(sixVillains(s)).toHaveLength(villains + 1);
    s = settle(
      native(s, {
        type: "thwart",
        target: light(s).id,
        amount: 99,
        source: "hero",
      }),
    );
    expect(s.phase).toBe("won");
  });
});

describe("Sinister Six encounter cards", () => {
  it("Take One for the Team keeps you from attacking other villains", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "27106"));
    const taking = s.attachments.find((p) => p.code === "27106")!;
    const other = sixVillains(s).find((v) => v.id !== taking.attachedTo)!;
    const hp = other.hp;
    s = settle(native(s, attack(s, other.id, 3)));
    expect(sixVillains(s).find((v) => v.id === other.id)?.hp).toBe(hp);
  });
  it("Brute Force Barricade keeps threat on the other side schemes", () => {
    let s = started();
    s = settle(reveal(s, "27107"));
    expect(abilityOptions(s, light(s))).toBeDefined();
    s = command(s, { type: "BASIC", action: "thwart" });
    if (s.prompt)
      expect(s.prompt.options.map((o) => o.id)).not.toContain(light(s).id);
  });
  it("Robotic Enhancements puts Doctor Octopus and Scorpion into play", () => {
    let s = started();
    for (const code of ["27094", "27098"])
      if (!s.sinisterSix!.setAside.includes(code))
        s.sinisterSix!.setAside.push(code);
    s.sinisterSix!.setAside = [...new Set(s.sinisterSix!.setAside)];
    s = settle(reveal(s, "27110"));
    const codes = sixVillains(s).map((v) => v.code);
    expect(codes).toEqual(expect.arrayContaining(["27094", "27098"]));
  });
  it("From Every Direction places 1 threat on the main scheme for each enemy", () => {
    let s = started("standard", 2);
    const threat = s.scheme.threat;
    const enemies = sixVillains(s).length + s.minions.length;
    s = settle(reveal(s, "27146"));
    expect(s.scheme.threat).toBe(threat + enemies);
  });
  it("Teamwork Makes the Dream Work gives each enemy +1 ATK and +1 SCH", () => {
    let s = started();
    const v = sixVillains(s)[0];
    const before = enemyStats(s, v);
    s = settle(reveal(s, "27145"));
    expect(enemyStats(s, v).attack).toBe(before.attack + 1);
    expect(enemyStats(s, v).scheme).toBe(before.scheme + 1);
  });
  it("Life-Size Decoy keeps its engaged player from thwarting side schemes", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(reveal(s, "27142"));
    s.player.form = "hero";
    s = command(s, { type: "BASIC", action: "thwart" });
    if (s.prompt)
      expect(s.prompt.options.map((o) => o.id)).not.toContain(light(s).id);
  });
});
describe("Sinister Six expert mode", () => {
  it("the pair treacheries gain incite 1 and, with Surprise!, cannot be canceled", () => {
    for (const code of ["27108", "27109", "27110", "27112"]) {
      expect(
        uncancelableText({ difficulty: "standard" }, card(code).text),
      ).toBe(false);
      expect(uncancelableText({ difficulty: "expert" }, card(code).text)).toBe(
        true,
      );
    }
    // A card that cannot be canceled in every mode stays that way.
    expect(
      uncancelableText({ difficulty: "standard" }, card("21042").text),
    ).toBe(true);
    for (const difficulty of ["standard", "expert"] as const) {
      let s = started(difficulty);
      const threat = s.scheme.threat;
      s = settle(reveal(s, "27108"));
      expect(s.scheme.threat, difficulty).toBe(
        threat + (difficulty === "expert" ? 1 : 0),
      );
    }
  });
  it("Surprise! and From Every Direction gain surge", () => {
    for (const code of ["27112", "27146"])
      for (const difficulty of ["standard", "expert"] as const) {
        let s = started(difficulty);
        const dealt = s.encounter.dealt.length;
        s = settle(reveal(s, code));
        expect(s.encounter.dealt.length, `${code} ${difficulty}`).toBe(
          dealt + (difficulty === "expert" ? 1 : 0),
        );
      }
  });
  it("Life-Size Decoy gains toughness", () => {
    for (const difficulty of ["standard", "expert"] as const) {
      let s = started(difficulty);
      s.player.form = "alter";
      s = settle(reveal(s, "27142"));
      expect(s.minions.find((m) => m.code === "27142")?.tough, difficulty).toBe(
        difficulty === "expert",
      );
    }
  });
});
