/** Melee in the Mojo-seum: MaGog with The Champion and The Challengers,
 * exercised with the original physical cards. Every command crosses a JSON
 * save/reload boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, MODULES, VILLAINS } from "../src/game/cards";
import { enemyStats, newGame } from "../src/game/engine";
import {
  MAGOG_SCRIPT_CODES,
  magogCheering,
  magogCrowd,
  magogKeyword,
  magogRatings,
  type MagogCrowd,
} from "../src/game/magog";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

const team = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
];
function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "magog",
    difficulty,
    seed: 39001,
    pacing: "expert",
    heroes: team.slice(0, players),
    module: "western",
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
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
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
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function stack(s: GameState, ...codes: string[]) {
  s.encounter.deck.unshift(...codes.map((code) => take(s, code)));
  delete s.encounter.knownTop;
}
const ratings = (s: GameState, side: MagogCrowd) => magogRatings(s, side);
function setRatings(s: GameState, side: MagogCrowd, n: number) {
  magogCrowd(s, side)!.counters = n;
}
const M = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `magog:${type}`,
  ...args,
});
const hit = (target: string, amount: number): Effect => ({
  type: "damage",
  target,
  amount,
  source: "hero",
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const status = (target: string, kind: string): Effect => ({
  type: "status",
  target,
  status: kind,
  actorId: "p1",
});
const hand = (s: GameState, playerId: string) =>
  seatView(s, playerId).player.hand.length;

describe("Melee in the Mojo-seum: original source", () => {
  it("registers every face of the MaGog set", () => {
    const faces = CATALOG_CARDS.filter(
      (c) => c.pack_code === "mojo" && c.set_code === "magog",
    );
    expect(faces).toHaveLength(15);
    expect(new Set(MAGOG_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "magog")).toMatchObject({
      codes: ["39001a", "39001b"],
      schemes: ["39002b"],
    });
    const magog = VILLAINS.find((v) => v.id === "magog")!;
    expect(MODULES.map((m) => m.id)).toContain(magog.module);
  });

  it("puts both crowds into play on their Booing Crowd sides", () => {
    for (const [difficulty, code] of [
      ["standard", "39001a"],
      ["expert", "39001b"],
    ] as const) {
      const s = started(difficulty, 2);
      expect(s.villain.code).toBe(code);
      expect(s.villain.hp).toBe(20);
      expect(magogCrowd(s, "champion")).toMatchObject({
        code: "39003a",
        counters: 0,
      });
      expect(magogCrowd(s, "challengers")).toMatchObject({
        code: "39004a",
        counters: 0,
      });
      expect(s.scheme).toMatchObject({ code: "39002b", threat: 2 });
      const deck = s.encounter.deck.map((p) => p.code);
      for (const c of ["39005", "39006", "39007", "39008", "39009", "39011"])
        expect(deck.filter((x) => x === c)).toHaveLength(1);
      expect(deck.filter((x) => x === "39010")).toHaveLength(2);
      expect(deck.some((x) => /^3900[1-4]/.test(x))).toBe(false);
    }
  });
});

describe("MaGog", () => {
  it("resets his hit points instead of being defeated", () => {
    let s = started("standard", 2);
    s = settle(native(s, hit(s.villain.id, 25)));
    expect(s.phase).not.toBe("won");
    expect(s.villain).toMatchObject({ code: "39001a", hp: 20, maxHp: 20 });
    // 3 ratings counters per player on The Challengers and 1 facedown
    // encounter card for each player.
    expect(ratings(s, "challengers")).toBe(6);
    expect(s.encounter.dealt.map((p) => p.dealtTo).sort()).toEqual([
      "p1",
      "p2",
    ]);
    s = started("expert");
    s = settle(native(s, hit(s.villain.id, 12)));
    expect(s.villain).toMatchObject({ code: "39001b", hp: 10 });
    expect(ratings(s, "challengers")).toBe(2);
  });

  it("wows The Champion after he attacks and damages a character", () => {
    let s = started("standard");
    stack(s, "39010");
    s = settle(native(s, villainAttack(s)));
    expect(ratings(s, "champion")).toBe(1);
    s = started("expert");
    stack(s, "39010");
    s = settle(native(s, villainAttack(s)));
    expect(ratings(s, "champion")).toBe(2);
    // No damage, no ratings counters.
    s = started("standard");
    s = settle(native(s, status("hero", "tough")));
    stack(s, "39010");
    s = settle(native(s, villainAttack(s)));
    expect(ratings(s, "champion")).toBe(0);
  });
});

describe("Melee in the Mojo-seum", () => {
  it("wows The Champion and removes all threat instead of completing", () => {
    let s = started("standard", 2);
    s.scheme.threat = 11;
    s = settle(native(s, { type: "threat", target: "main", amount: 3 }));
    expect(s.phase).not.toBe("lost");
    expect(s.scheme.threat).toBe(0);
    expect(ratings(s, "champion")).toBe(4);
  });

  it("flips The Champion at 5 per player and loses at 10 per player", () => {
    let s = started("standard", 2);
    setRatings(s, "champion", 8);
    s = settle(native(s, M("ratings", { side: "champion", n: 2 })));
    expect(magogCrowd(s, "champion")).toMatchObject({
      code: "39003b",
      counters: 10,
    });
    // Underdogs: each player draws 1 card.
    expect([hand(s, "p1"), hand(s, "p2")]).toEqual([1, 1]);
    expect(s.phase).not.toBe("lost");
    s = settle(native(s, M("ratings", { side: "champion", n: 10 })));
    expect(s.phase).toBe("lost");
  });

  it("flips The Challengers at 5 per player and wins at 10 per player", () => {
    let s = started("standard", 2);
    setRatings(s, "challengers", 9);
    s = settle(native(s, M("ratings", { side: "challengers", n: 1 })));
    expect(magogCheering(s, "challengers")).toBe(true);
    // Tag Team: Surprise Contender enters engaged with the first player.
    expect(s.minions.find((m) => m.code === "39007")?.engagedWith).toBe(
      s.firstPlayerId,
    );
    expect(s.phase).not.toBe("won");
    s = settle(native(s, M("ratings", { side: "challengers", n: 10 })));
    expect(s.phase).toBe("won");
  });

  it("gives Surprise Contender a tough status when it is already in play", () => {
    let s = started("standard");
    s = settle(reveal(s, "39007"));
    setRatings(s, "challengers", 4);
    s = settle(native(s, M("ratings", { side: "challengers", n: 1 })));
    expect(s.minions.filter((m) => m.code === "39007")).toHaveLength(1);
    expect(s.minions.find((m) => m.code === "39007")?.tough).toBe(true);
  });
});

describe("MaGog encounter cards", () => {
  it("Jolt of Adrenaline: retaliate 1 and stalwart until MaGog resets", () => {
    let s = started("standard");
    s = settle(reveal(s, "39005"));
    expect(s.attachments.find((a) => a.code === "39005")?.attachedTo).toBe(
      s.villain.id,
    );
    expect(magogKeyword(s, s.villain, "Retaliate")).toBe(1);
    expect(magogKeyword(s, s.villain, "Stalwart")).toBe(1);
    s = settle(native(s, status(s.villain.id, "stunned")));
    expect(s.villain.stunned).toBe(false);
    s = settle(native(s, hit(s.villain.id, 10)));
    expect(s.villain.hp).toBe(10);
    // 3 per player from MaGog, then 1 per player from Jolt of Adrenaline.
    expect(ratings(s, "challengers")).toBe(4);
    expect(s.attachments.some((a) => a.code === "39005")).toBe(false);
    expect(s.encounter.discard.some((p) => p.code === "39005")).toBe(true);
  });

  it("Jolt of Adrenaline's retaliate damages a hero who attacks MaGog", () => {
    let s = started("standard");
    s = settle(reveal(s, "39005"));
    const hp = s.player.hp;
    s = settle(command(s, { type: "BASIC", action: "attack" }), (v) =>
      v.prompt?.options.some((o) => o.id === v.villain.id)
        ? v.villain.id
        : undefined,
    );
    // Spider-Man's ATK 2, then retaliate 1.
    expect(s.villain.hp).toBe(10 - 2);
    expect(s.player.hp).toBe(hp - 1);
  });

  it("a blanked Jolt of Adrenaline grants nothing and stays after a reset", () => {
    let s = started("standard");
    s = settle(reveal(s, "39005"));
    const jolt = s.attachments.find((a) => a.code === "39005")!;
    // Vivian blanks an attachment's printed text until the end of the round.
    const key = `novaIronheartPackBlank:${jolt.id}`;
    s.flags[key] = s.round;
    seatView(s, s.activePlayerId).flags[key] = s.round;
    s = reload(s);
    expect(magogKeyword(s, s.villain, "Retaliate")).toBe(0);
    expect(magogKeyword(s, s.villain, "Stalwart")).toBe(0);
    s = settle(native(s, hit(s.villain.id, 10)));
    expect(ratings(s, "challengers")).toBe(3);
    expect(s.attachments.some((a) => a.id === jolt.id)).toBe(true);
  });

  it("Surge of Aggression: +1 ATK and +1 SCH until MaGog resets", () => {
    let s = started("standard");
    const before = enemyStats(s, s.villain);
    s = settle(reveal(s, "39006"));
    expect(enemyStats(s, s.villain)).toEqual({
      attack: before.attack + 1,
      scheme: before.scheme + 1,
    });
    s = settle(native(s, hit(s.villain.id, 10)));
    expect(ratings(s, "challengers")).toBe(4);
    expect(s.attachments.some((a) => a.code === "39006")).toBe(false);
  });

  it("reveals Jolt of Adrenaline when it is a boost card", () => {
    let s = started("standard");
    stack(s, "39005");
    s = settle(native(s, villainAttack(s)));
    expect(s.attachments.find((a) => a.code === "39005")?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.encounter.discard.some((p) => p.code === "39005")).toBe(false);
  });

  it("Surprise Contender wows The Champion and, defeated, The Challengers", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "39007"));
    const contender = s.minions.find((m) => m.code === "39007")!;
    expect(contender.engagedWith).toBe("p1");
    stack(s, "39010");
    s = settle(
      native(s, { type: "enemyAttack", id: contender.id, actorId: "p1" }),
    );
    expect(ratings(s, "champion")).toBe(1);
    s = settle(native(s, hit(contender.id, 14)));
    expect(s.minions.some((m) => m.code === "39007")).toBe(false);
    expect(ratings(s, "challengers")).toBe(4);
  });

  it("Pump Up the Crowd gains threat while The Champion cheers", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "39008"));
    expect(s.sideSchemes.find((p) => p.code === "39008")?.counters).toBe(8);
    s = started("standard", 2);
    magogCrowd(s, "champion")!.code = "39003b";
    s = settle(reveal(s, "39008"));
    const pump = s.sideSchemes.find((p) => p.code === "39008")!;
    expect(pump.counters).toBe(10);
    s = settle(
      native(s, {
        type: "thwart",
        target: pump.id,
        amount: 10,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.some((p) => p.code === "39008")).toBe(false);
    expect(ratings(s, "challengers")).toBe(2);
  });

  it("Break a Leg stuns you and trades damage for The Champion's counters", () => {
    let s = started("standard");
    const hp = s.player.hp;
    s = reveal(s, "39009");
    expect(s.player.stunned).toBe(true);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "ratings-0",
      "ratings-1",
      "ratings-2",
    ]);
    s = settle(choose(s, "ratings-1"));
    expect(s.player.hp).toBe(hp - 1);
    expect(ratings(s, "champion")).toBe(1);
    // 4 damage while The Challengers have more ratings counters.
    s = started("standard");
    setRatings(s, "challengers", 2);
    s = reveal(s, "39009");
    expect(s.prompt?.options).toHaveLength(5);
    s = settle(choose(s, "ratings-0"));
    expect(s.player.hp).toBe(hp - 4);
    expect(ratings(s, "champion")).toBe(0);
  });

  it("Defend the Title wows The Champion against an alter-ego", () => {
    let s = started("standard");
    s.player.form = "alter";
    s = settle(reveal(reload(s), "39010"));
    expect(ratings(s, "champion")).toBe(2);
  });

  it("Defend the Title: a hero who defends without damage wows The Challengers", () => {
    const defend = (v: GameState) =>
      v.prompt?.options.find((o) => o.id === "hero")?.id;
    let s = started("standard");
    s = settle(native(s, status("hero", "tough")));
    stack(s, "39009");
    s = settle(reveal(s, "39010"), defend);
    expect(ratings(s, "challengers")).toBe(2);
    expect(ratings(s, "champion")).toBe(0);
    // Taking the attack undefended wows nobody but The Champion.
    s = started("standard");
    stack(s, "39009");
    s = settle(reveal(s, "39010"));
    expect(ratings(s, "challengers")).toBe(0);
    expect(ratings(s, "champion")).toBe(1);
  });

  it("Stage Fright confuses you and adds 2 or 4 threat", () => {
    let s = started("standard");
    const threat = s.scheme.threat;
    s = settle(reveal(s, "39011"));
    expect(s.player.confused).toBe(true);
    expect(s.scheme.threat).toBe(threat + 2);
    s = started("standard");
    setRatings(s, "challengers", 1);
    s = settle(reveal(s, "39011"));
    expect(s.scheme.threat).toBe(threat + 4);
  });

  it("Stage Fright's boost confuses you", () => {
    let s = started("standard");
    stack(s, "39011");
    s = settle(native(s, villainAttack(s)));
    expect(s.player.confused).toBe(true);
  });
});
