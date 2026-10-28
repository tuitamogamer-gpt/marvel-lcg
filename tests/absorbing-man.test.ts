import { describe, expect, it } from "vitest";
import {
  ABSORBING_MAN_SCRIPT_CODES,
  absorbingTraits,
} from "../src/game/absorbing-man";
import { card, CATALOG_CARDS, scenarioModules } from "../src/game/cards";
import {
  abilityOptions,
  dispatch,
  enemyStats,
  newGame,
  schemeLimit,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "absorbing_man",
    difficulty,
    seed: 4076,
    pacing: "expert",
    heroes: [
      { heroId: "spider_man", aspect: "justice" },
      ...(players >= 2
        ? [{ heroId: "captain_marvel", aspect: "aggression" as const }]
        : []),
      ...(players >= 3
        ? [{ heroId: "iron_man", aspect: "leadership" as const }]
        : []),
    ],
  });
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let i = 0; s.prompt && i < 150; i++) {
    const id =
      prefer?.(s) ||
      passId(s) ||
      s.prompt.options.find((o) =>
        ["none", "hero", "damage", "allow", "resolve"].includes(o.id),
      )?.id ||
      s.prompt.options[0]?.id;
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.form = "hero";
  return reload(s);
}
function zones(s: GameState): Piece[][] {
  return [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
    s.resolving,
    s.removed,
    s.attachments,
    s.sideSchemes,
    s.minions,
    s.environments || [],
    [s.villain],
    s.absorbingMan!.villainDeck,
    [s.absorbingMan!.currentMain],
  ];
}
function take(s: GameState, code: string) {
  for (const zone of zones(s)) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing original ${code}`);
}
function reveal(s: GameState, code: string) {
  const p = take(s, code);
  return native(s, { type: "reveal", piece: p });
}
function environment(s: GameState, code: string) {
  return native(s, { type: "absorbing:environment", piece: take(s, code) });
}
function exact(s: GameState) {
  const pieces = zones(s)
    .flat()
    .filter((p) => card(p).set_code === "absorbing_man");
  expect(pieces).toHaveLength(24);
  expect(new Set(pieces.map((p) => p.id)).size).toBe(24);
}
function boost(s: GameState, code?: string) {
  const p = code
    ? take(s, code)
    : s.encounter.deck.splice(
        s.encounter.deck.findIndex(
          (p) => !card(p).boost && !card(p).boost_star,
        ),
        1,
      )[0];
  expect(p).toBeTruthy();
  s.encounter.deck.unshift(p);
  return p;
}
function attack(s: GameState) {
  return native(s, {
    type: "enemyAttack",
    id: s.villain.id,
    actorId: "p1",
    activation: { enemyId: s.villain.id, playerId: "p1", kind: "attack" },
  });
}
describe("Absorbing Man original-source scenario", () => {
  it("registers all eighteen faces without changing the 25-card source", () => {
    const original = CATALOG_CARDS.filter(
      (c) => c.set_code === "absorbing_man",
    );
    expect(original.map((c) => c.code).sort()).toEqual(
      [...ABSORBING_MAN_SCRIPT_CODES].sort(),
    );
    for (const code of ABSORBING_MAN_SCRIPT_CODES)
      expect(hasExecutableScript(code), code).toBe(true);
    expect(
      original.filter((c) => !c.hidden).reduce((n, c) => n + c.quantity, 0),
    ).toBe(25);
  });
  it.each([1, 2, 3])(
    "sets up original environments and scales printed stats for %i players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = setup(difficulty, players);
        expect(s.environments).toHaveLength(1);
        expect(s.encounter.dealt).toHaveLength(0);
        expect(s.encounter.acceleration).toBe(0);
        expect(s.absorbingMan!.delay).toBe(0);
        expect(s.scheme.threat).toBe(2 * players);
        expect(schemeLimit(s)).toBe(12 * players);
        expect(s.villain.hp).toBe(
          (difficulty === "standard" ? 14 : 15) * players,
        );
        expect(s.sideSchemes.some((p) => p.code === "04092")).toBe(
          difficulty === "expert",
        );
        exact(reload(s));
      }
    },
  );
  it("supports each legal module and keeps scenario environments", () => {
    for (const m of scenarioModules("absorbing_man")) {
      const s = newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "absorbing_man",
        module: m.id,
        seed: 7,
      });
      expect(s.modules).toEqual([m.id]);
      exact(s);
    }
  });
  it("replaces the original environment without revealing or surging when put into play", () => {
    let s = started();
    const original = s.environments![0];
    const nextCode = original.code === "04080" ? "04081" : "04080";
    s = environment(s, nextCode);
    expect(s.environments?.map((p) => p.code)).toEqual([nextCode]);
    expect(s.encounter.discard.some((p) => p.id === original.id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(0);
    expect(absorbingTraits(s)).toEqual([nextCode === "04080" ? "Wood" : "Ice"]);
    exact(reload(s));
  });
  it("gains all four traits from Super Absorbing Power, retaining the same villain stages", () => {
    let s = started();
    const id = s.villain.id;
    s = settle(native(s, { type: "damage", target: id, amount: 99 }));
    expect(s.villain.code).toBe("04077");
    expect(s.villain.id).not.toBe(id);
    expect(s.removed.some((p) => p.id === id)).toBe(true);
    expect(absorbingTraits(s).sort()).toEqual([
      "Ice",
      "Metal",
      "Stone",
      "Wood",
    ]);
    exact(s);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.phase).toBe("won");
    exact(s);
  });
  it("deals one encounter per player when stage II finds Power already in play", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "04092"));
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.encounter.dealt.map((p) => p.dealtTo).sort()).toEqual(
      s.players.map((p) => p.id).sort(),
    );
    exact(s);
  });
  it("counts a delay after villain step one and loses on the printed main-scheme limit", () => {
    let s = started();
    s = native(s, { type: "villainStepOne" });
    expect(s.absorbingMan!.delay).toBe(1);
    expect(s.scheme.threat).toBe(3);
    s = native(reload(s), { type: "threat", target: "main", amount: 9 });
    expect(s.phase).toBe("lost");
  });
  it.each([0, 1, 4, 5, 8])(
    "Stall Tactics places floor(delay/2) threat at delay %i",
    (delay) => {
      let s = started();
      s.absorbingMan!.delay = delay;
      const before = s.scheme.threat;
      s = settle(reveal(s, "04085"));
      expect(s.scheme.threat).toBe(before + Math.floor(delay / 2));
      expect(s.encounter.dealt).toHaveLength(delay < 2 ? 1 : 0);
      exact(s);
    },
  );
  it.each([
    ["04080", 3],
    ["04083", 4],
  ])("Steel Kick uses current traits with %s", (env, damage) => {
    let s = environment(started(), String(env));
    const before = s.player.hp;
    s = settle(reveal(s, "04087"));
    expect(s.player.hp).toBe(before - Number(damage));
    exact(s);
  });
  it("Omni-Morph applies all four conditions and retains a physical facedown boost", () => {
    let s = started("expert");
    s.villain.hp -= 3;
    const hp = s.villain.hp,
      hand = s.player.hand.length;
    s = settle(reveal(s, "04089"));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toHaveLength(hand - 1);
    expect(s.villain.tough).toBe(true);
    expect(s.villain.hp).toBe(hp + 1);
    expect(s.encounter.storedBoosts).toHaveLength(1);
    exact(reload(s));
  });
  it("Icy Grip stuns and adds its Ice indirect damage", () => {
    let s = environment(started(), "04081");
    const hp = s.player.hp;
    s = settle(reveal(s, "04090"));
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBe(hp - 2);
    exact(s);
  });
  it("Avalanche resolves independently for every player and survives saved choices", () => {
    let s = started("standard", 3);
    s.absorbingMan!.delay = 5;
    const hp = s.players.map((p) => seatView(s, p).player.hp);
    s = settle(reload(reveal(s, "04091")));
    expect(s.players.map((p) => seatView(s, p).player.hp)).toEqual(
      hp.map((n) => n - 3),
    );
    exact(s);
  });
  it("Ball and Chain attaches with printed modifiers and a native typed removal payment", () => {
    let s = started();
    const attack = enemyStats(s, s.villain).attack;
    s = settle(reveal(s, "04084"));
    const p = s.attachments.find((p) => p.code === "04084")!;
    expect(enemyStats(s, s.villain).attack).toBe(attack + 1);
    expect(abilityOptions(s, p).map((o) => o.id)).toContain("remove");
    const resource = s.player.deck.find((p) => card(p).resource_physical)!;
    s.player.deck = s.player.deck.filter((p) => p.id !== resource.id);
    s.player.hand.push(resource);
    s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "PAY", ids: [resource.id] });
    expect(s.attachments.some((p) => p.code === "04084")).toBe(false);
    expect(s.encounter.deck.some((q) => q.id === p.id)).toBe(true);
    exact(s);
  });
  it.each([4, 5])(
    "Dense Forest's undefended damage checks the five-delay threshold (%i)",
    (delay) => {
      let s = environment(started(), "04080");
      s.absorbingMan!.delay = delay;
      const hp = s.player.hp;
      boost(s);
      s = settle(attack(s));
      expect(s.player.hp).toBe(hp - 2 - (delay >= 5 ? 2 : 1));
      exact(s);
    },
  );
  it("defending prevents environment responses, and Stun replaces the entire activation", () => {
    let s = environment(started(), "04081");
    s.absorbingMan!.delay = 5;
    const threat = s.scheme.threat;
    boost(s);
    s = settle(attack(s), (s) =>
      s.prompt?.options.some((o) => o.id === "take") ? "hero" : undefined,
    );
    expect(s.scheme.threat).toBe(threat);
    expect(s.player.exhausted).toBe(true);
    // Also test the unconditional activation replacement independent of defense UI labels.
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    const before = s.scheme.threat;
    s = settle(attack(s));
    expect(s.scheme.threat).toBe(before);
    expect(s.villain.stunned).toBe(false);
    exact(s);
    expect(threat).toBe(2);
  });
  it.each(["04080", "04081", "04082", "04083"])(
    "a %s boost puts the same environment in play without Surge",
    (code) => {
      let s = started();
      const p = boost(s, code);
      s = settle(attack(s));
      expect(s.environments?.map((p) => p.id)).toEqual([p.id]);
      expect(s.encounter.dealt).toHaveLength(0);
      exact(reload(s));
    },
  );
  it.each(["04084", "04092"])(
    "a %s boost reveals and retains the same physical card",
    (code) => {
      let s = started();
      const p = boost(s, code);
      s = settle(attack(s));
      expect(
        [...s.attachments, ...s.sideSchemes].some((q) => q.id === p.id),
      ).toBe(true);
      exact(s);
    },
  );
  it("stage III applies both trait groups after a complete attack and scheme", () => {
    let s = started("expert");
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.villain.code).toBe("04078");
    s = environment(s, "04082");
    const hp = s.player.hp,
      threat = s.scheme.threat;
    boost(s);
    s = settle(attack(s));
    expect(s.player.hp).toBe(hp - 4);
    expect(s.scheme.threat).toBe(threat + 1);
    exact(s);
    s.player.form = "alter";
    boost(s);
    const before = s.scheme.threat,
      health = s.player.hp;
    s = settle(
      native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
    );
    expect(s.scheme.threat).toBe(before + 3);
    expect(s.player.hp).toBe(health - 1);
    exact(s);
  });
  it("Swinging Stone adds only one activation's Stone modifier", () => {
    let s = environment(started(), "04082");
    s.player.form = "alter";
    const threat = s.scheme.threat;
    boost(s);
    s = settle(reveal(s, "04086"));
    expect(s.scheme.threat).toBe(threat + 2);
    expect(enemyStats(s, s.villain).scheme).toBe(1);
    exact(s);
  });
  it("Piercing Thorns discards a random hand card and a chosen controlled card with Wood", () => {
    let s = environment(started(), "04080");
    const ally = s.player.deck.splice(
      s.player.deck.findIndex((p) => card(p).type_code === "ally"),
      1,
    )[0];
    s.player.inPlay.push(ally);
    const hand = s.player.hand.length;
    s = reveal(s, "04088");
    while (s.prompt?.options.some((o) => o.id === "resolve"))
      s = choose(s, "resolve");
    expect(s.prompt?.text).toBe("Discard 1 card you control.");
    s = choose(reload(s), ally.id);
    expect(s.player.hand).toHaveLength(hand - 1);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    exact(s);
  });
  it("preserves pending typed payment and cancellation without removing Ball and Chain", () => {
    let s = settle(reveal(started(), "04084"));
    const p = s.attachments.find((p) => p.code === "04084")!;
    const source = s.player.deck.find((p) => card(p).resource_physical)!;
    s.player.deck = s.player.deck.filter((p) => p.id !== source.id);
    s.player.hand.push(source);
    s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
    const saved = reload(s);
    expect(saved.prompt?.kind).toBe("payment");
    s = command(saved, { type: "CANCEL" });
    expect(s.player.hand.some((p) => p.id === source.id)).toBe(true);
    expect(s.attachments.some((q) => q.id === p.id)).toBe(true);
    exact(s);
  });
  it("an ally defeated by attack damage still prevents undefended environment responses", () => {
    let s = environment(started(), "04081");
    const ally = s.player.deck.splice(
      s.player.deck.findIndex((p) => card(p).type_code === "ally"),
      1,
    )[0];
    ally.damage = card(ally).health! - 1;
    s.player.inPlay.push(ally);
    boost(s);
    const threat = s.scheme.threat;
    s = settle(attack(s), (v) =>
      v.prompt?.options.some((o) => o.id === ally.id) ? ally.id : undefined,
    );
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.scheme.threat).toBe(threat);
    exact(s);
  });
});
