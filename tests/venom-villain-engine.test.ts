/** Sinister Motives: the Venom scenario with Symbiotic Strength, exercised
 * with the original physical cards. Every command crosses a JSON
 * save/reload boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, MODULES, VILLAINS, card } from "../src/game/cards";
import { isTextBlank } from "../src/game/card-text";
import {
  abilityOptions,
  enemyStats,
  makePiece,
  newGame,
} from "../src/game/engine";
import {
  VENOM_VILLAIN_SCRIPT_CODES,
  bellTower,
  identityBoosts,
} from "../src/game/venom-villain";
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
  villainId = "venom",
  module?: string,
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 27073,
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
  villainId = "venom",
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
  // Remove Venom's tough status so attacks damage him.
  s.villain.tough = false;
  return reload(s);
}
const V = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `venomv:${type}`,
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
const tower = (s: GameState) => bellTower(s)!;
const attack = (s: GameState, amount: number): Effect => ({
  type: "damage",
  target: s.villain.id,
  amount,
  attack: true,
  source: "hero",
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const deal = (s: GameState) => (x: GameState) =>
  x.prompt?.options.find((o) => o.id === "damage")?.id;
const chime = (x: GameState) =>
  x.prompt?.options.find((o) => o.id === "chime")?.id;

describe("Venom original source", () => {
  it("registers every face of the Venom and Symbiotic Strength sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "sm" &&
        ["venom", "symbiotic_strength"].includes(c.set_code || ""),
    );
    expect(faces).toHaveLength(19);
    expect(new Set(VENOM_VILLAIN_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "venom")).toMatchObject({
      codes: ["27073", "27074", "27075"],
      schemes: ["27076b"],
      module: "down_to_earth",
      fixedSets: ["symbiotic_strength"],
    });
    expect(MODULES.map((m) => m.id)).toContain("symbiotic_strength");
  });
  it.each([1, 2, 3])(
    "puts the Bell Tower into play Quiet side faceup for %s players",
    (players) => {
      const s = settle(setup("standard", players));
      expect(tower(s)).toMatchObject({ code: "27077a", counters: 0 });
      expect(s.villain.code).toBe("27073");
      expect(s.villain.maxHp).toBe(17 * players);
      expect(s.villain.tough).toBe(true);
      expect(s.scheme).toMatchObject({ code: "27076b", threat: 2 * players });
      const all = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
        ...(s.environments || []),
      ];
      const count = (set: string) =>
        all.filter((p) => card(p).set_code === set).length;
      // Venom set without its villains and main scheme: 10 cards; Symbiotic
      // Strength 9 and Down to Earth 7.
      expect(count("venom")).toBe(10);
      expect(count("symbiotic_strength")).toBe(9);
      expect(count("down_to_earth")).toBe(7);
    },
  );
  it("Expert starts with Venom (II), who puts Tooth and Nail into play", () => {
    let s = settle(setup("expert"));
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.villain.code).toBe("27074");
    expect(s.sideSchemes.find((p) => p.code === "27081")?.counters).toBe(8);
  });
});

describe("Vengeance and the facedown boost cards", () => {
  it("an attack that damages Venom places a facedown boost card on your identity", () => {
    let s = started();
    const hp = s.villain.hp;
    s = settle(native(s, attack(s, 3)), deal(s));
    expect(s.villain.hp).toBe(hp - 3);
    expect(identityBoosts(s, "p1")).toHaveLength(1);
  });
  it("Retribution: Venom (III) places 2 for the first attack of the turn, then 1", () => {
    let s = started();
    s.villain.code = "27075";
    s = settle(native(s, attack(s, 2)), deal(s));
    expect(identityBoosts(s, "p1")).toHaveLength(2);
    s = settle(native(s, attack(s, 2)), deal(s));
    expect(identityBoosts(s, "p1")).toHaveLength(3);
  });
  it('"Leave Us Alone!" moves the facedown boost cards to Venom when he activates against you', () => {
    let s = started();
    s = settle(native(s, V("boost-identity", { playerId: "p1", amount: 2 })));
    expect(identityBoosts(s, "p1")).toHaveLength(2);
    const discard = s.encounter.discard.length;
    s = settle(native(s, villainAttack(s)));
    expect(identityBoosts(s, "p1")).toHaveLength(0);
    // His normal boost card and the two from the identity are discarded.
    expect(s.encounter.discard.length).toBeGreaterThanOrEqual(discard + 3);
  });
  it("Venom (III) places 2 facedown boost cards on each identity when revealed", () => {
    let s = started("standard", 2);
    s.villain.code = "27075";
    s = settle(native(s, V("boosts-each", { amount: 2 })));
    expect(identityBoosts(s, "p1")).toHaveLength(2);
    expect(identityBoosts(s, "p2")).toHaveLength(2);
  });
});

describe("The Bell Tower", () => {
  it("Quiet: an attack may place chime counters instead of damaging Venom; at 3 per player it rings", () => {
    let s = started();
    const hp = s.villain.hp;
    s = settle(native(s, attack(s, 2)), chime);
    expect(s.villain.hp).toBe(hp);
    expect(tower(s)).toMatchObject({ code: "27077a", counters: 2 });
    expect(identityBoosts(s, "p1")).toHaveLength(0);
    s = settle(native(s, attack(s, 1)), chime);
    expect(tower(s)).toMatchObject({ code: "27077b", counters: 3 });
  });
  it("Ringing: Venom takes 1 more damage and chime counters prevent his attack damage to an identity", () => {
    let s = started();
    tower(s).code = "27077b";
    tower(s).counters = 3;
    const hp = s.villain.hp;
    s = settle(native(s, attack(s, 2)));
    expect(s.villain.hp).toBe(hp - 3);
    // Set Vengeance's facedown boost card aside for an exact attack.
    s.encounter.discard.push(...s.venomVillain!.boosts.p1.splice(0));
    const heroHp = s.player.hp;
    stack(s, "01186");
    s = settle(native(s, villainAttack(s)));
    // Venom (I): ATK 2 plus the boost; chime counters prevent up to 3.
    expect(s.player.hp).toBeGreaterThanOrEqual(heroHp - 1);
    expect(tower(s).counters).toBeLessThan(3);
  });
  it("Ringing flips back to Quiet when its last chime counter is removed", () => {
    let s = started();
    tower(s).code = "27077b";
    tower(s).counters = 1;
    s = settle(native(s, V("chime-remove", { amount: 1 })));
    expect(tower(s)).toMatchObject({ code: "27077a", counters: 0 });
  });
  it("Guard the Bell Tower removes its counters, flips it Quiet and blanks its text", () => {
    let s = started();
    tower(s).code = "27077b";
    tower(s).counters = 2;
    s = settle(reveal(s, "27079"));
    expect(tower(s)).toMatchObject({ code: "27077a", counters: 0 });
    expect(isTextBlank(s, tower(s))).toBe(true);
    const hp = s.villain.hp;
    // No chime choice while its text is blank.
    s = settle(native(s, attack(s, 2)));
    expect(s.villain.hp).toBe(hp - 2);
  });
  it("For Whom the Bell Tolls: 1 damage while Quiet, 1 threat removed while Ringing", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(reveal(s, "27083"));
    expect(s.player.hp).toBe(hp - 1);
    tower(s).code = "27077b";
    tower(s).counters = 5;
    s.scheme.threat = 4;
    s = settle(reveal(s, "27083"));
    expect(tower(s).counters).toBe(3);
    expect(s.scheme.threat).toBe(3);
  });
});

describe("Venom's encounter cards", () => {
  it('"Now We\'re Angry!" gives Venom +1 ATK and overkill and leaves after two attacks damage him', () => {
    let s = started();
    const atk = enemyStats(s, s.villain).attack;
    s = settle(reveal(s, "27078"));
    const angry = s.attachments.find((p) => p.code === "27078")!;
    expect(angry).toMatchObject({ attachedTo: s.villain.id, counters: 2 });
    expect(enemyStats(s, s.villain).attack).toBe(atk + 1);
    s = settle(native(s, attack(s, 1)), deal(s));
    expect(s.attachments.find((p) => p.id === angry.id)?.counters).toBe(1);
    s = settle(native(s, attack(s, 1)), deal(s));
    expect(s.attachments.some((p) => p.id === angry.id)).toBe(false);
  });
  it("Lashing Out and Tooth and Nail lose threat equal to the damage Venom takes from an attack", () => {
    let s = started();
    s = settle(reveal(s, "27080"));
    const lashing = s.sideSchemes.find((p) => p.code === "27080")!;
    expect(lashing.counters).toBe(9);
    s = settle(native(s, attack(s, 3)), deal(s));
    expect(s.sideSchemes.find((p) => p.id === lashing.id)?.counters).toBe(6);
  });
  it("Biting Retort: Venom activates and each boost card gets +1 boost icon", () => {
    let s = started();
    s.player.form = "alter";
    // Two boost cards of 1 icon each become 2 icons each.
    s = settle(native(s, V("boost-identity", { playerId: "p1", amount: 1 })));
    stack(s, "01186", "01186");
    const threat = s.scheme.threat;
    s = settle(reveal(s, "27082"));
    const sch = enemyStats(s, s.villain).scheme;
    expect(s.scheme.threat).toBeGreaterThan(threat + sch);
    expect(s.flags.venomRetort).toBeUndefined();
  });
});

describe("Symbiotic Strength", () => {
  it("Improvised Weapons attaches to the villain and leaves through a Hero Action", () => {
    let s = started();
    s = settle(reveal(s, "27164"));
    const weapons = s.attachments.find((p) => p.code === "27164")!;
    expect(weapons.attachedTo).toBe(s.villain.id);
    expect(abilityOptions(s, weapons).map((o) => o.id)).toContain("discard");
    const pick = (kind: string) => {
      const i = s.player.deck.findIndex(
        (p) =>
          !!(card(p) as unknown as Record<string, unknown>)[
            `resource_${kind}`
          ] && !card(p).resource_wild,
      );
      return s.player.deck.splice(i, 1)[0];
    };
    const paid = [pick("mental"), pick("physical"), pick("energy")];
    s.player.hand.push(...paid);
    s = command(s, { type: "ABILITY", id: weapons.id, action: "discard" });
    expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("payment");
    s = command(s, { type: "PAY", ids: paid.map((p) => p.id) });
    s = settle(s);
    expect(s.attachments.some((p) => p.id === weapons.id)).toBe(false);
  });
  it("Violent Tendencies gives the villain a facedown boost card and leaves after 3 damage", () => {
    let s = started("standard", 1, "rhino", "symbiotic_strength");
    s = settle(reveal(s, "27165"));
    const violent = s.attachments.find((p) => p.code === "27165")!;
    expect(violent.attachedTo).toBe(s.villain.id);
    s = settle(native(s, attack(s, 2)));
    expect(s.encounter.storedBoosts || []).toHaveLength(1);
    expect(s.attachments.some((p) => p.id === violent.id)).toBe(true);
    s = settle(native(s, attack(s, 3)));
    expect(s.encounter.storedBoosts || []).toHaveLength(2);
    expect(s.attachments.some((p) => p.id === violent.id)).toBe(false);
  });
  it("Webbed Up replaces your hero's attack and stuns you", () => {
    let s = started("standard", 1, "rhino", "symbiotic_strength");
    s = settle(reveal(s, "27166"));
    expect(s.attachments.find((p) => p.code === "27166")?.attachedTo).toBe(
      "hero:p1",
    );
    const hp = s.villain.hp;
    s = settle(native(s, attack(s, 3)));
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((p) => p.code === "27166")).toBe(false);
    expect(s.player.stunned).toBeTruthy();
  });
  it("Enraged Symbiote's boost puts it into play engaged with you", () => {
    let s = started("standard", 1, "rhino", "symbiotic_strength");
    stack(s, "27167");
    s = settle(native(s, villainAttack(s)));
    expect(s.minions.find((p) => p.code === "27167")?.engagedWith).toBe("p1");
  });
  it("Swinging Assault changes an alter-ego to hero form and the villain attacks", () => {
    let s = started("standard", 1, "rhino", "symbiotic_strength");
    s.player.form = "alter";
    const hp = s.player.hp;
    s = settle(reveal(s, "27168"));
    expect(s.player.form).toBe("hero");
    expect(s.player.hp).toBeLessThan(hp);
  });
  it("Unstable Sentience gives the villain a facedown boost card and surges", () => {
    let s = started("standard", 1, "rhino", "symbiotic_strength");
    s = settle(reveal(s, "27169"));
    expect(s.encounter.storedBoosts || []).toHaveLength(1);
    expect(s.encounter.dealt.length).toBeGreaterThanOrEqual(1);
  });
  it("blank checks stay native", () => {
    const s = started();
    expect(makePiece(s, "27167").code).toBe("27167");
  });
});
