/** Sinister Motives: the Osborn Tech and Sinister Assault modular sets,
 * exercised with the original physical cards in another scenario. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, MODULES, card } from "../src/game/cards";
import { abilityOptions, newGame } from "../src/game/engine";
import {
  SINISTER_MODULAR_SCRIPT_CODES,
  sinisterModularCannotDefend,
  sinisterModularKeyword,
} from "../src/game/sinister-modulars";
import { hasExecutableScript } from "../src/game/script-registry";
import type { Effect, GameState } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

function setup(module: string, difficulty: "standard" | "expert" = "standard") {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    difficulty,
    seed: 27147,
    pacing: "expert",
    heroes: [{ heroId: "spider_man", aspect: "justice" }],
    module,
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
  module: string,
  difficulty: "standard" | "expert" = "standard",
) {
  let s = settle(setup(module, difficulty));
  s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.form = "hero";
  s.player.deck.push(...s.player.hand.splice(0));
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
const enemyAttack = (id: string): Effect => ({
  type: "enemyAttack",
  id,
  actorId: "p1",
});

describe("Osborn Tech and Sinister Assault original source", () => {
  it("registers every face of both sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "sm" &&
        ["osborn_tech", "sinister_assault"].includes(c.set_code || ""),
    );
    expect(faces).toHaveLength(12);
    expect(new Set(SINISTER_MODULAR_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["osborn_tech", "sinister_assault"]),
    );
  });
});

describe("Osborn Tech", () => {
  it("each attachment surges and attaches to the villain", () => {
    let s = started("osborn_tech");
    const dealt = s.encounter.dealt.length;
    s = settle(reveal(s, "27149"));
    const armor = s.attachments.find((p) => p.code === "27149")!;
    expect(armor.attachedTo).toBe(s.villain.id);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
  });
  it("Kinetic Armor's Hero Action deals you 3 indirect damage to discard it", () => {
    let s = started("osborn_tech");
    s = settle(reveal(s, "27149"));
    const armor = s.attachments.find((p) => p.code === "27149")!;
    const hp = s.player.hp;
    expect(abilityOptions(s, armor).length).toBeGreaterThan(0);
    s = settle(
      command(s, { type: "ABILITY", id: armor.id, action: "discard" }),
    );
    expect(s.attachments.some((p) => p.code === "27149")).toBe(false);
    expect(s.player.hp).toBe(hp - 3);
  });
  it("Ionic Boots place 2 threat after the villain damages your identity", () => {
    let s = started("osborn_tech");
    s = settle(reveal(s, "27148"));
    const threat = s.scheme.threat;
    stack(s, "01186");
    s = settle(native(s, enemyAttack(s.villain.id)));
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 2);
  });
});

describe("Osborn Tech constants", () => {
  it("Arm Cannon gives the villain's attacks overkill and piercing; Kinetic Armor retaliate 1", () => {
    let s = started("osborn_tech");
    s = settle(reveal(s, "27147"));
    expect(sinisterModularKeyword(s, s.villain, "Overkill")).toBe(1);
    expect(sinisterModularKeyword(s, s.villain, "Piercing")).toBe(1);
    s = settle(reveal(s, "27149"));
    expect(sinisterModularKeyword(s, s.villain, "Retaliate")).toBe(1);
    const hp = s.player.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(
      s,
      (s) => s.prompt?.options.find((o) => o.id === s.villain.id)?.id,
    );
    expect(s.player.hp).toBe(hp - 1);
  });
  it("Neocarbon Scales reduce the damage of each attack on the villain by 1", () => {
    let s = started("osborn_tech");
    s = settle(reveal(s, "27150"));
    const hp = s.villain.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(hp - 2);
  });
  it("Tracking Display keeps every character from defending against the villain", () => {
    let s = started("osborn_tech");
    s = settle(reveal(s, "27152"));
    expect(sinisterModularCannotDefend(s, s.villain.id)).toBe(true);
    stack(s, "01186");
    s = native(s, enemyAttack(s.villain.id));
    for (let n = 0; s.prompt && n < 40; n++) {
      expect(
        s.prompt.options.some((o) => /^Defend/i.test(o.label)),
        JSON.stringify(s.prompt.options.map((o) => o.label)),
      ).toBe(false);
      s = choose(
        reload(s),
        noDefense(s) || passId(s) || s.prompt.options[0].id,
      );
    }
  });
});

describe("Sinister Assault", () => {
  it("Vulture discards a random card after activating against you", () => {
    let s = started("sinister_assault");
    s = settle(reveal(s, "27163"));
    const vulture = s.minions.find((p) => p.code === "27163")!;
    s.player.hand.push(s.player.deck.shift()!, s.player.deck.shift()!);
    const hand = s.player.hand.length;
    stack(s, "01186");
    s = settle(native(s, enemyAttack(vulture.id)));
    expect(s.player.hand.length).toBe(hand - 1);
  });
  it("Hobgoblin deals 2 indirect damage after attacking you", () => {
    let s = started("sinister_assault");
    s = settle(reveal(s, "27160"));
    const hob = s.minions.find((p) => p.code === "27160")!;
    const hp = s.player.hp;
    stack(s, "01186");
    s = settle(native(s, enemyAttack(hob.id)));
    expect(s.player.hp).toBeLessThanOrEqual(hp - 2);
  });
  it("Scorpion stuns the character he damages", () => {
    let s = started("sinister_assault");
    s = settle(reveal(s, "27162"));
    const scorpion = s.minions.find((p) => p.code === "27162")!;
    stack(s, "01186");
    s = settle(native(s, enemyAttack(scorpion.id)));
    expect(s.player.stunned).toBe(true);
  });
  it("Kraven the Hunter discards an upgrade or support after damaging you", () => {
    let s = started("sinister_assault");
    const i = s.player.deck.findIndex((p) => card(p).type_code === "support");
    const [support] = s.player.deck.splice(i, 1);
    support.ownerId = "p1";
    s.player.inPlay.push(support);
    s = settle(reveal(s, "27161"));
    const kraven = s.minions.find((p) => p.code === "27161")!;
    stack(s, "01186");
    s = settle(native(s, enemyAttack(kraven.id)));
    expect(s.player.inPlay.some((p) => p.id === support.id)).toBe(false);
  });
  it("Electro discards from the top of your deck until an energy or wild resource when he engages you", () => {
    let s = started("sinister_assault");
    const deck = s.player.deck;
    const energy = deck.findIndex(
      (p) => card(p).resource_energy && card(p).type_code === "resource",
    );
    const discard = s.player.discard.length;
    s = settle(reveal(s, "27159"));
    expect(s.minions.some((p) => p.code === "27159")).toBe(true);
    expect(s.player.discard.length).toBeGreaterThan(discard);
    expect(energy).toBeGreaterThanOrEqual(-1);
    const last = s.player.discard[s.player.discard.length - 1];
    expect(
      !!(card(last).resource_energy || card(last).resource_wild) ||
        s.player.deck.length === 0,
    ).toBe(true);
  });
  it("Doctor Octopus places 1 threat on each scheme after activating", () => {
    let s = started("sinister_assault");
    s = settle(reveal(s, "27158"));
    const ock = s.minions.find((p) => p.code === "27158")!;
    const threat = s.scheme.threat;
    stack(s, "01186");
    s = settle(native(s, enemyAttack(ock.id)));
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 1);
    expect(card(ock).set_code).toBe("sinister_assault");
  });
});
