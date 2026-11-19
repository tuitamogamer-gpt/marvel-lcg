/** Sinister Motives: Venom Goblin with Goblin Gear, exercised with the
 * original physical cards. Every command crosses a JSON save/reload
 * boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  pieceHP,
} from "../src/game/cards";
import { abilityOptions, enemyStats, newGame } from "../src/game/engine";
import {
  VENOM_GOBLIN_SCRIPT_CODES,
  symbioteEnvironments,
  vgScheme,
  vgSchemes,
  vgTarget,
  type GliderKey,
} from "../src/game/venom-goblin";
import { hasExecutableScript } from "../src/game/script-registry";
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
  villainId = "venom_goblin",
  module?: string,
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 27113,
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
  villainId = "venom_goblin",
  module?: string,
) {
  let s = settle(setup(difficulty, players, villainId, module));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seat.id === s.activePlayerId ? s.player : seat.player;
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
const threatOf = (s: GameState, key: GliderKey) => vgScheme(s, key)?.threat;
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const G = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `vgob:${type}`,
  ...args,
});
/** Put threat on a main scheme wherever the focus is. */
function setThreat(s: GameState, key: GliderKey, threat: number) {
  const st = s.venomGoblin!;
  if (st.focus === key) s.scheme.threat = threat;
  else st.bench[key]!.threat = threat;
}

describe("Venom Goblin original source", () => {
  it("registers every face of the Venom Goblin and Goblin Gear sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "sm" &&
        ["venom_goblin", "goblin_gear"].includes(c.set_code || ""),
    );
    expect(faces).toHaveLength(24);
    expect(new Set(VENOM_GOBLIN_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "venom_goblin")).toMatchObject({
      codes: ["27113", "27114", "27115"],
      module: "goblin_gear",
      fixedSets: ["symbiotic_strength"],
    });
    expect(MODULES.map((m) => m.id)).toContain("goblin_gear");
  });
  it.each([1, 2, 3])(
    "puts the three Manhattan main schemes into play for %s players, the glider on Midtown",
    (players) => {
      const s = settle(setup("standard", players));
      expect(s.villain.code).toBe("27113");
      expect(s.villain.hp).toBe(16 * players);
      expect(s.scheme.code).toBe("27118a");
      expect(s.venomGoblin).toMatchObject({
        glider: "midtown",
        focus: "midtown",
        flipped: [],
      });
      expect(vgSchemes(s).map((x) => [x.key, x.code, x.threat])).toEqual([
        ["lower", "27117a", players],
        ["midtown", "27118a", 2 * players],
        ["upper", "27119a", 0],
      ]);
      const all = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
      ];
      const count = (set: string) =>
        all.filter((p) => card(p).set_code === set).length;
      expect(count("venom_goblin")).toBe(12);
      expect(count("goblin_gear")).toBe(6);
      expect(count("symbiotic_strength")).toBeGreaterThan(0);
      expect(all.some((p) => card(p).type_code === "environment")).toBe(false);
    },
  );
  it("Venom Goblin (II) deals 2 facedown encounter cards to each player in Expert", () => {
    let s = settle(setup("expert", 2));
    expect(s.villain.code).toBe("27114");
    for (let i = 0; i < 2; i++)
      s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    for (const seat of s.players)
      expect(
        s.encounter.dealt.filter((p) => p.dealtTo === seat.id).length,
        seat.id,
      ).toBeGreaterThanOrEqual(2);
  });
});

describe("Three main schemes and the glider counter", () => {
  it("each main scheme accumulates its own threat every round", () => {
    let s = started();
    s = settle(native(s, { type: "villainStepOne", actorId: "p1" }));
    expect(threatOf(s, "lower")).toBe(2);
    expect(threatOf(s, "midtown")).toBe(3);
    expect(threatOf(s, "upper")).toBe(1);
    expect(s.scheme.code).toBe("27118a");
  });
  it("threat can be removed from a main scheme without the glider", () => {
    let s = started();
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(
      expect.arrayContaining(["main", vgTarget("lower")]),
    );
    s = settle(choose(s, vgTarget("lower")));
    expect(threatOf(s, "lower")).toBe(0);
    expect(threatOf(s, "midtown")).toBe(2);
    expect(s.scheme.code).toBe("27118a");
    s = settle(
      native(s, {
        type: "thwart",
        target: vgTarget("upper"),
        amount: 1,
        source: "hero",
      }),
    );
    expect(threatOf(s, "upper")).toBe(0);
  });
  it("Venom Goblin (I) moves the glider to the least threat after activating and places 2 threat there", () => {
    let s = started();
    stack(s, "01186");
    s = settle(
      native(s, villainAttack(s)),
      (s) => s.prompt?.options.find((o) => o.id === "threat")?.id,
    );
    expect(s.venomGoblin!.glider).toBe("upper");
    expect(s.scheme.code).toBe("27119a");
    expect(threatOf(s, "upper")).toBe(2);
  });
  it("a completed main scheme flips to its Symbiote environment; a second one loses the game", () => {
    let s = started();
    setThreat(s, "upper", 9);
    s = settle(
      native(s, { type: "threat", target: vgTarget("upper"), amount: 1 }),
    );
    expect(s.venomGoblin!.flipped).toEqual(["upper"]);
    expect(s.environments?.map((p) => p.code)).toContain("27119b");
    expect(vgSchemes(s).map((x) => x.key)).toEqual(["lower", "midtown"]);
    expect(s.venomGoblin!.glider).toBe("midtown");
    expect(symbioteEnvironments(s)).toBe(1);
    expect(s.phase).toBe("player");
    setThreat(s, "lower", 10);
    s = settle(
      native(s, { type: "threat", target: vgTarget("lower"), amount: 1 }),
    );
    expect(s.phase).toBe("lost");
  });
  it("when the glider's main scheme flips, the glider and its acceleration tokens move to the least threat", () => {
    let s = started();
    s.encounter.acceleration = 2;
    setThreat(s, "lower", 3);
    s.scheme.threat = 11;
    s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.venomGoblin!.flipped).toEqual(["midtown"]);
    expect(s.venomGoblin!.glider).toBe("upper");
    expect(s.scheme.code).toBe("27119a");
    expect(s.encounter.acceleration).toBe(2);
  });
  it("each main scheme's Special ability", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(native(s, G("special", { key: "midtown", playerId: "p1" })));
    expect(s.player.hp).toBe(hp - 2);
    s = settle(native(s, G("glider", { key: "lower" })));
    expect(s.scheme.code).toBe("27117a");
    s = settle(native(s, G("special", { key: "lower", playerId: "p1" })));
    expect(threatOf(s, "lower")).toBe(2);
    s.player.hand.push(s.player.deck.shift()!);
    s = settle(native(s, G("glider", { key: "upper" })));
    s = settle(native(s, G("special", { key: "upper", playerId: "p1" })));
    expect(s.player.hand).toHaveLength(0);
  });
});

describe("Venom Goblin encounter cards", () => {
  it("Symbiote environments strengthen the Symbiote minions; Festering Mass counts alone", () => {
    let s = started();
    s = settle(reveal(s, "27122"));
    const monstrosity = s.minions.find((p) => p.code === "27122")!;
    expect(pieceHP(s, monstrosity)).toBe(6);
    s = settle(reveal(s, "27124"));
    expect(symbioteEnvironments(s)).toBe(1);
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.code === "27122")!,
      ),
    ).toBe(9);
  });
  it("Joy Ride moves the glider to the most threat and resolves that Special", () => {
    let s = started();
    setThreat(s, "lower", 5);
    s = settle(reveal(s, "27125"));
    expect(s.venomGoblin!.glider).toBe("lower");
    expect(threatOf(s, "lower")).toBe(6);
  });
  it("Spreading Panic resolves the glider's Special and surges", () => {
    let s = started();
    const hp = s.player.hp;
    const dealt = s.encounter.dealt.length;
    s = settle(reveal(s, "27126"));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
  });
  it("We Are One gives Venom Goblin +3 ATK and +3 SCH until a hero pays to discard it", () => {
    let s = started();
    const before = enemyStats(s, s.villain);
    s = settle(reveal(s, "27120"));
    const we = s.attachments.find((p) => p.code === "27120")!;
    expect(we.attachedTo).toBe(s.villain.id);
    expect(enemyStats(s, s.villain).attack).toBe(before.attack + 3);
    expect(enemyStats(s, s.villain).scheme).toBe(before.scheme + 3);
    expect(abilityOptions(s, we).length).toBeGreaterThan(0);
  });
  it("Symbiotic Thrall's boost places 1 threat on each main scheme without the glider", () => {
    let s = started();
    s = settle(native(s, G("thrall-boost")));
    expect(threatOf(s, "lower")).toBe(2);
    expect(threatOf(s, "midtown")).toBe(2);
    expect(threatOf(s, "upper")).toBe(1);
  });
});

describe("Goblin Gear", () => {
  it("Incendiary Bombs deal 2 indirect damage after the villain attacks, until their counters run out", () => {
    let s = started();
    s = settle(reveal(s, "27138"));
    const bombs = s.attachments.find((p) => p.code === "27138")!;
    expect(bombs.counters).toBe(2);
    s = settle(native(s, G("bomb", { id: bombs.id, playerId: "p1" })));
    expect(s.attachments.find((p) => p.code === "27138")?.counters).toBe(1);
    s = settle(native(s, G("bomb", { id: bombs.id, playerId: "p1" })));
    expect(s.attachments.some((p) => p.code === "27138")).toBe(false);
  });
  it("Remote Navigation finds Advanced Glider, which then lets the villain activate again once per round", () => {
    let s = started();
    s = settle(reveal(s, "27141"));
    const glider = s.attachments.find((p) => p.code === "27136");
    expect(glider?.attachedTo).toBe(s.villain.id);
    const hp = s.player.hp;
    stack(s, "01186", "01186");
    s = settle(
      native(s, villainAttack(s)),
      (s) => s.prompt?.options.find((o) => o.id === "threat")?.id,
    );
    expect(s.player.hp).toBeLessThan(hp);
    expect(
      Object.keys(s.flags).filter((k) => k.startsWith("vgGlider:")),
    ).toHaveLength(1);
  });
  it("Concussive Bombs exhaust an upgrade and a support you control", () => {
    let s = started();
    for (const type of ["upgrade", "support"]) {
      const i = s.player.deck.findIndex((p) => card(p).type_code === type);
      expect(i, type).toBeGreaterThanOrEqual(0);
      const [p] = s.player.deck.splice(i, 1);
      p.ownerId = "p1";
      s.player.inPlay.push(p);
    }
    s = settle(reveal(s, "27137"));
    const bombs = s.attachments.find((p) => p.code === "27137")!;
    s = settle(native(s, G("bomb", { id: bombs.id, playerId: "p1" })));
    expect(
      s.player.inPlay
        .filter((p) => ["upgrade", "support"].includes(card(p).type_code))
        .every((p) => p.exhausted),
    ).toBe(true);
    expect(s.attachments.find((p) => p.code === "27137")?.counters).toBe(1);
  });
  it("Limitless Supply gives each Tech attachment surge", () => {
    let s = started();
    s = settle(reveal(s, "27140"));
    const dealt = s.encounter.dealt.length;
    s = settle(reveal(s, "27139"));
    expect(s.attachments.some((p) => p.code === "27139")).toBe(true);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
  });
  it("Goblin Gear can be chosen in another scenario", () => {
    const s = settle(setup("standard", 1, "rhino", "goblin_gear"));
    expect(s.modules).toEqual(["goblin_gear"]);
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "goblin_gear"),
    ).toHaveLength(6);
  });
});
