/** Thanos, the third scenario of The Mad Titan's Shadow, with the Infinity
 * Gauntlet set and the Children of Thanos modular set, exercised with the
 * original physical cards. Every command crosses a JSON save/reload
 * boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { newGame } from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  INFINITY_STONES,
  THANOS_SCRIPT_CODES,
  thanosStonesInPlay,
} from "../src/game/thanos";
import type { GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

const players3 = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "thanos",
  modules?: string[],
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 21111,
    pacing: "expert",
    ...(modules ? { modules } : {}),
    heroes: players3.slice(0, players),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
  untilPayment = false,
) {
  for (let n = 0; s.prompt && n < 150; n++) {
    if (untilPayment && s.prompt.kind === "payment") return s;
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
/** Started table: hands go back into the decks, every identity is a hero
 * and every Infinity Stone is back in the stone deck. */
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  stones(s);
  return reload(s);
}
/** Put every Infinity Stone in the stone deck, these codes on top. */
function stones(s: GameState, ...codes: string[]) {
  const th = s.thanos!;
  const all = [...thanosStonesInPlay(s), ...th.stoneDeck, ...th.stoneDiscard];
  s.environments = (s.environments || []).filter(
    (p) => !(INFINITY_STONES as readonly string[]).includes(p.code),
  );
  th.stoneDiscard = [];
  th.stoneDeck = [
    ...codes.map((code) => all.find((p) => p.code === code)!),
    ...all.filter((p) => !codes.includes(p.code)),
  ];
}
function inPlay(s: GameState, ...codes: string[]) {
  stones(s, ...codes);
  for (const code of codes) {
    const i = s.thanos!.stoneDeck.findIndex((p) => p.code === code);
    (s.environments ||= []).push(s.thanos!.stoneDeck.splice(i, 1)[0]);
  }
}
function zones(s: GameState): Piece[][] {
  const th = s.thanos!;
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
    s.victoryDisplay || [],
    [s.villain, th.currentMain],
    th.mainDeck,
    th.villainDeck,
    th.stoneDeck,
    th.stoneDiscard,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** 18 Thanos cards, the Infinity Gauntlet and six Stones, four Black Order
 * and five Children of Thanos cards each stay in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "thanos")).toHaveLength(18);
  expect(
    all.filter((p) => card(p).set_code === "infinity_gauntlet"),
  ).toHaveLength(7);
  expect(all.filter((p) => card(p).set_code === "black_order")).toHaveLength(4);
  expect(
    all.filter((p) => card(p).set_code === "children_of_thanos"),
  ).toHaveLength(5);
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of zones(s)) {
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
function attach(s: GameState, code: string) {
  const p = take(s, code);
  p.attachedTo = s.villain.id;
  s.attachments.push(p);
  return p;
}
function engage(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = take(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function playerCard(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  expect(i, `deck card ${code}`).toBeGreaterThanOrEqual(0);
  return p.deck.splice(i, 1)[0];
}
/** Sanctuary leaves play so player cards can hurt Thanos. */
function noSanctuary(s: GameState) {
  const p = s.sideSchemes.find((q) => q.code === "21116")!;
  s.sideSchemes = s.sideSchemes.filter((q) => q.id !== p.id);
  s.encounter.discard.push(p);
}
const stored = (s: GameState) => s.encounter.storedBoosts?.length || 0;

describe("Thanos original source", () => {
  it("registers every face of the scenario, Children of Thanos and the Infinity Gauntlet", () => {
    for (const set of ["thanos", "children_of_thanos", "infinity_gauntlet"])
      for (const c of CATALOG_CARDS.filter(
        (c) => c.set_code === set && c.pack_code === "mts",
      )) {
        expect(THANOS_SCRIPT_CODES as readonly string[]).toContain(c.code);
        expect(hasExecutableScript(c.code), c.code).toBe(true);
      }
    expect(THANOS_SCRIPT_CODES).toHaveLength(27);
    expect(VILLAINS.find((v) => v.id === "thanos")).toMatchObject({
      codes: ["21111", "21112", "21113"],
      schemes: ["21114b", "21115b"],
      moduleCount: 2,
      defaultModules: ["black_order", "children_of_thanos"],
      fixedSets: ["infinity_gauntlet"],
    });
    expect(MODULES.some((m) => m.id === "children_of_thanos")).toBe(true);
    expect(MODULES.some((m) => m.id === "infinity_gauntlet")).toBe(false);
    expect(scenarioModules("thanos")).toHaveLength(MODULES.length);
  });
  it.each([1, 2, 3])(
    "sets up the Infinity Gauntlet, a first Stone and Sanctuary for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        const expert = difficulty === "expert";
        expect(s.villain.code).toBe(expert ? "21112" : "21111");
        expect(s.villain.hp).toBe((expert ? 23 : 16) * players);
        expect(s.villain.tough).toBe(expert);
        expect(s.scheme).toMatchObject({ code: "21114b", threat: 0 });
        const onThanos = s.attachments
          .filter((p) => p.attachedTo === s.villain.id)
          .map((p) => p.code)
          .sort();
        expect(onThanos).toEqual(expert ? ["21118", "21129"] : ["21129"]);
        expect(thanosStonesInPlay(s)).toHaveLength(1);
        expect(s.thanos!.stoneDeck).toHaveLength(5);
        expect(s.sideSchemes.find((p) => p.code === "21116")?.counters).toBe(
          3 + players,
        );
        expect(
          s.encounter.deck.some(
            (p) => card(p).set_code === "infinity_gauntlet",
          ),
        ).toBe(false);
        expect(s.modules).toEqual(["black_order", "children_of_thanos"]);
        exact(reload(s));
      }
    },
  );
});

describe("The Infinity Gauntlet and the Infinity Stones", () => {
  it("puts the top Stone into play when none is in play after Thanos activates", () => {
    let s = started();
    s.player.form = "alter";
    stones(s, "21133");
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(thanosStonesInPlay(s).map((p) => p.code)).toEqual(["21133"]);
    exact(s);
  });
  it("resolves each Stone in play against the player and discards it", () => {
    let s = started();
    s.player.form = "alter";
    inPlay(s, "21130", "21131");
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.confused).toBe(true);
    expect(s.player.stunned).toBe(true);
    expect(thanosStonesInPlay(s)).toHaveLength(0);
    expect(s.thanos!.stoneDiscard.map((p) => p.code).sort()).toEqual([
      "21130",
      "21131",
    ]);
    exact(s);
  });
  it("Mind Stone discards a random card from a confused player; Power Stone deals 3 to a stunned one", () => {
    let s = started();
    s.player.form = "alter";
    s.player.confused = true;
    s.player.stunned = true;
    s.player.hand.push(...s.player.deck.splice(0, 3));
    inPlay(s, "21130", "21131");
    stack(s, "01186");
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.hand).toHaveLength(2);
    expect(s.player.hp).toBe(hp - 3);
    exact(s);
  });
  it("Reality Stone discards an ally, upgrade or support you control", () => {
    let s = started();
    s.player.form = "alter";
    const cat = playerCard(s, "01002");
    const may = playerCard(s, "01006");
    s.player.inPlay.push(cat, may);
    inPlay(s, "21132");
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }), (v) =>
      v.prompt?.title === "Reality Stone" ? may.id : undefined,
    );
    expect(s.player.inPlay.map((p) => p.id)).toEqual([cat.id]);
    exact(s);
  });
  it("Soul Stone heals Thanos 3 and gives him a facedown boost card", () => {
    let s = started();
    s.player.form = "alter";
    s.villain.hp -= 5;
    inPlay(s, "21133");
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.villain.hp).toBe(s.villain.maxHp - 2);
    expect(stored(s)).toBe(1);
    exact(s);
  });
  it("Space Stone discards until a minion and engages it with you", () => {
    let s = started();
    s.player.form = "alter";
    inPlay(s, "21134");
    stack(s, "01186", "21120", "21125");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.minions.map((p) => [p.code, p.engagedWith])).toEqual([
      ["21125", s.activePlayerId],
    ]);
    expect(s.encounter.discard.some((p) => p.code === "21120")).toBe(true);
    exact(s);
  });
  it("Time Stone discards your top 4 cards and places 1 threat per card type", () => {
    let s = started();
    s.player.form = "alter";
    const top = ["01088", "01002", "01008", "01006"].map((code) =>
      playerCard(s, code),
    );
    s.player.deck.unshift(...top);
    inPlay(s, "21135");
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    // Thanos schemes for SCH 1 + 1 (Infinity Gauntlet), then four
    // different card types.
    expect(s.scheme.threat).toBe(2 + 4);
    expect(s.player.discard.map((p) => p.id)).toEqual(top.map((p) => p.id));
    exact(s);
  });
  it("gives Thanos a facedown boost card whenever the Stone deck runs out", () => {
    let s = started();
    const th = s.thanos!;
    th.stoneDiscard.push(...th.stoneDeck.splice(1));
    s = settle(native(s, { type: "thanos:stone" }));
    expect(thanosStonesInPlay(s)).toHaveLength(1);
    expect(stored(s)).toBe(1);
    // The discard pile became the new Stone deck.
    expect(s.thanos!.stoneDeck).toHaveLength(5);
    expect(s.thanos!.stoneDiscard).toHaveLength(0);
    exact(s);
  });
});

describe("Thanos, Sanctuary and his armor", () => {
  it("Sanctuary stops damage from player cards; its When Defeated spends physical resources for 2 damage each", () => {
    let s = started();
    const hp = s.villain.hp;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 5 }));
    expect(s.villain.hp).toBe(hp);
    const strength = playerCard(s, "01090");
    const energy = playerCard(s, "01088");
    s.player.hand.push(strength, energy);
    s.villain.tough = true;
    s.villain.toughCards = 1;
    const sanctuary = s.sideSchemes.find((p) => p.code === "21116")!;
    s = settle(
      native(s, {
        type: "thwart",
        target: sanctuary.id,
        amount: sanctuary.counters,
      }),
      (v) =>
        v.prompt?.title === "Sanctuary"
          ? v.prompt.options.find((o) => o.id === strength.id)?.id || "done"
          : undefined,
    );
    expect(s.victoryDisplay?.some((p) => p.id === sanctuary.id)).toBe(true);
    // Strength's two physical resources: 4 damage, ignoring tough.
    expect(s.villain.hp).toBe(hp - 4);
    expect(s.villain.tough).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual([energy.id]);
    exact(s);
  });
  it("Thanos's Armor reduces damage by 1 and leaves after a basic attack for energy and physical", () => {
    let s = started();
    noSanctuary(s);
    const armor = attach(s, "21117");
    const hp = s.villain.hp;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 3 }));
    expect(s.villain.hp).toBe(hp - 2);
    const energy = playerCard(s, "01088");
    const strength = playerCard(s, "01090");
    s.player.hand.push(energy, strength);
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(
      s,
      (v) => (v.prompt?.title === "Thanos's armor" ? armor.id : undefined),
      true,
    );
    s = settle(pay(s, [energy, strength]));
    expect(s.villain.hp).toBe(hp - 2 - 1);
    expect(s.attachments.some((p) => p.id === armor.id)).toBe(false);
    exact(s);
  });
  it("Thanos's Helmet gives him retaliate 1 and leaves after a basic attack for mental and physical", () => {
    let s = started();
    noSanctuary(s);
    const helmet = attach(s, "21118");
    const genius = playerCard(s, "01089");
    const strength = playerCard(s, "01090");
    s.player.hand.push(genius, strength);
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(
      s,
      (v) => (v.prompt?.title === "Thanos's armor" ? helmet.id : undefined),
      true,
    );
    s = settle(pay(s, [genius, strength]));
    expect(s.player.hp).toBe(10 - 1);
    expect(s.attachments.some((p) => p.id === helmet.id)).toBe(false);
    exact(s);
  });
  it("Master of the Stones puts a Stone into play when Thanos activates and leaves afterwards", () => {
    let s = started();
    s.player.form = "alter";
    const master = attach(s, "21119");
    stones(s, "21130", "21131");
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    // Master's Stone entered and the Gauntlet resolved it at once.
    expect(s.player.confused).toBe(true);
    expect(s.attachments.some((p) => p.id === master.id)).toBe(false);
    // SCH 1, the Infinity Gauntlet's +1 and Master of the Stones' +1.
    expect(s.scheme.threat).toBe(3);
    exact(s);
  });
  it("Thanos is stalwart", () => {
    let s = started();
    s = settle(
      native(
        s,
        { type: "status", target: s.villain.id, status: "stunned" },
        { type: "status", target: s.villain.id, status: "confused" },
      ),
    );
    expect(s.villain.stunned).toBe(false);
    expect(s.villain.confused).toBe(false);
  });
  it("advances to Thanos (II), who finds his Helmet, and wins after the last stage", () => {
    let s = started("standard", 2);
    noSanctuary(s);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.villain).toMatchObject({ code: "21112", hp: 46, tough: true });
    expect(
      s.attachments
        .filter((p) => p.attachedTo === s.villain.id)
        .map((p) => p.code)
        .sort(),
    ).toEqual(["21118", "21129"]);
    exact(s);
    s.villain.tough = false;
    s.villain.toughCards = 0;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.phase).toBe("won");
  });
  it("advances to Balance the Scales, which halves each player's deck, and loses when it completes", () => {
    let s = started("standard", 2);
    const [p1, p2] = s.players.map((seat) => seat.id);
    const before = [p1, p2].map((id) => {
      const p = seatView(s, id).player;
      p.discard.push(...p.deck.splice(0, 4));
      return p.deck.length + p.discard.length;
    });
    s = settle(native(s, { type: "threat", target: "main", amount: 24 }));
    expect(s.scheme).toMatchObject({ code: "21115b", threat: 0 });
    [p1, p2].forEach((id, i) => {
      const p = seatView(s, id).player;
      expect(p.discard).toHaveLength(0);
      expect(p.deck).toHaveLength(Math.ceil(before[i] / 2));
    });
    exact(s);
    s = settle(native(s, { type: "threat", target: "main", amount: 24 }));
    expect(s.phase).toBe("lost");
  });
});

describe("Thanos encounter cards", () => {
  it("Avatar of Death: Thanos attacks with overkill and piercing, or schemes", () => {
    let s = started();
    const cat = playerCard(s, "01002");
    cat.tough = true;
    cat.toughCards = 1;
    s.player.inPlay.push(cat);
    stack(s, "01186");
    s = settle(
      reveal(s, "21120"),
      (v) => v.prompt?.options.find((o) => o.id === cat.id)?.id,
    );
    // ATK 2 + 1 (Infinity Gauntlet): piercing discards Black Cat's tough, she
    // takes 2 and overkill carries the third to Spider-Man.
    expect(s.player.inPlay.some((p) => p.id === cat.id)).toBe(false);
    expect(s.player.hp).toBe(10 - 1);
    s.player.form = "alter";
    stack(s, "01186");
    const threat = s.scheme.threat;
    s = settle(reveal(s, "21120"));
    // SCH 1 + 1 (Infinity Gauntlet).
    expect(s.scheme.threat).toBe(threat + 2);
    exact(s);
  });
  it("Deviant Syndrome gives Thanos tough, or places 2 threat; incite 1; its boost gives tough", () => {
    let s = started();
    s = settle(reveal(s, "21121"));
    expect(s.villain.tough).toBe(true);
    expect(s.scheme.threat).toBe(1);
    s = settle(reveal(s, "21121"));
    expect(s.scheme.threat).toBe(1 + 1 + 2);
    s.villain.tough = false;
    s.villain.toughCards = 0;
    s.player.form = "alter";
    stack(s, "21121");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.villain.tough).toBe(true);
    exact(s);
  });
  it('"I Am Inevitable" gives a facedown boost; as a boost it adds the top Stone\'s icons', () => {
    let s = started();
    s = settle(reveal(s, "21122"));
    expect(stored(s)).toBe(1);
    s.encounter.deck.unshift(...s.encounter.storedBoosts!.splice(0));
    s.player.form = "alter";
    stack(s, "21122");
    stones(s, "21135", "21133");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    // The face-down boost (0 icons) and Inevitable discarding the Time Stone
    // (4 icons) before the Gauntlet puts the Soul Stone into play.
    expect(s.scheme.threat).toBeGreaterThanOrEqual(1 + 4);
    expect(s.thanos!.stoneDiscard.map((p) => p.code)).toContain("21135");
    exact(s);
  });
  it("The Mad Titan puts a Stone into play; as a boost when the attack defeats an ally", () => {
    let s = started();
    stones(s, "21130", "21131", "21132");
    s = settle(reveal(s, "21123"));
    expect(thanosStonesInPlay(s).map((p) => p.code)).toEqual(["21130"]);
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    stack(s, "21123");
    s = settle(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === cat.id)?.id,
    );
    expect(s.player.inPlay.some((p) => p.id === cat.id)).toBe(false);
    // The boost's Power Stone entered, then the Gauntlet resolved both Stones.
    expect(s.player.confused).toBe(true);
    expect(s.player.stunned).toBe(true);
    exact(s);
  });
  it("The Titan's Throne discards the Stone in play you choose", () => {
    let s = started();
    inPlay(s, "21130", "21131");
    s = settle(reveal(s, "21124"), (v) =>
      v.prompt?.title === "The Titan's Throne"
        ? thanosStonesInPlay(v).find((p) => p.code === "21131")?.id
        : undefined,
    );
    expect(thanosStonesInPlay(s).map((p) => p.code)).toEqual(["21130"]);
    expect(s.thanos!.stoneDiscard.map((p) => p.code)).toEqual(["21131"]);
    exact(s);
  });
});

describe("Children of Thanos", () => {
  it("Corvus Glaive's and Proxima Midnight's boosts discard a card you control", () => {
    let s = started();
    s.player.form = "alter";
    const cat = playerCard(s, "01002");
    const may = playerCard(s, "01006");
    const shooter = playerCard(s, "01008");
    s.player.inPlay.push(cat, may, shooter);
    stack(s, "21125");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }), (v) =>
      v.prompt?.title === "Corvus Glaive" ? may.id : undefined,
    );
    expect(s.player.inPlay.map((p) => p.id)).toEqual([cat.id, shooter.id]);
    stack(s, "21126");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }), (v) =>
      v.prompt?.title === "Proxima Midnight" ? shooter.id : undefined,
    );
    expect(s.player.inPlay.map((p) => p.id)).toEqual([cat.id]);
    exact(s);
  });
  it("Ebony Maw is villainous and his boost gives one more boost card", () => {
    let s = started();
    s.player.form = "alter";
    const maw = engage(s, "21127");
    stack(s, "21128", "21088");
    s = settle(native(s, { type: "enemyScheme", id: maw.id }));
    // SCH 1 plus Tribute's 2 boost icons, from the villainous boost card.
    expect(s.scheme.threat).toBe(1 + 2);
    s.player.form = "alter";
    stack(s, "21127", "21128");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    // SCH 1 + 1 (Infinity Gauntlet), Ebony Maw's 1 icon and the extra
    // boost card's 2.
    expect(s.scheme.threat).toBe(3 + 2 + 1 + 2);
    exact(s);
  });
  it("Proxima Midnight's attacks gain piercing", () => {
    let s = started();
    const proxima = engage(s, "21126");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = settle(native(s, { type: "enemyAttack", id: proxima.id }));
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(10 - 3);
    exact(s);
  });
  it("Tribute deals the player who defeats it a facedown encounter card", () => {
    let s = started();
    s = settle(reveal(s, "21128"));
    const tribute = s.sideSchemes.find((p) => p.code === "21128")!;
    s = settle(
      native(s, {
        type: "thwart",
        target: tribute.id,
        amount: tribute.counters,
      }),
    );
    expect(s.encounter.dealt.map((p) => p.dealtTo)).toEqual([s.activePlayerId]);
    exact(s);
  });
  it("Children of Thanos works as a modular set in another scenario", () => {
    const s = settle(setup("standard", 1, "rhino", ["children_of_thanos"]));
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "children_of_thanos"),
    ).toHaveLength(5);
  });
});
