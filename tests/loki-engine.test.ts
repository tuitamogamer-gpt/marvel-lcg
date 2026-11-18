/** Loki, the fifth scenario of The Mad Titan's Shadow, with the Infinity
 * Gauntlet set and the Enchantress modular set, exercised with the original
 * physical cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { dispatch, enemyStats, newGame } from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import { INFINITY_STONES, thanosStonesInPlay } from "../src/game/thanos";
import {
  LOKI_SCRIPT_CODES,
  LOKI_VILLAINS,
  lokiVictories,
} from "../src/game/loki";
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
  villainId = "loki",
  modules?: string[],
  heroic = 0,
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 21160,
    pacing: "expert",
    heroic,
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
  const l = s.loki!;
  const all = [...thanosStonesInPlay(s), ...l.stoneDeck, ...l.stoneDiscard];
  s.environments = (s.environments || []).filter(
    (p) => !(INFINITY_STONES as readonly string[]).includes(p.code),
  );
  l.stoneDiscard = [];
  l.stoneDeck = [
    ...codes.map((code) => all.find((p) => p.code === code)!),
    ...all.filter((p) => !codes.includes(p.code)),
  ];
}
function inPlay(s: GameState, ...codes: string[]) {
  stones(s, ...codes);
  for (const code of codes) {
    const i = s.loki!.stoneDeck.findIndex((p) => p.code === code);
    (s.environments ||= []).push(s.loki!.stoneDeck.splice(i, 1)[0]);
  }
}
/** Make this Loki the one in play, keeping the rest set aside. */
function as(s: GameState, code: string) {
  const l = s.loki!;
  if (s.villain.code === code) return s;
  const i = l.setAside.findIndex((p) => p.code === code);
  const next = l.setAside.splice(i, 1)[0];
  const old = s.villain;
  Object.assign(next, { hp: old.hp, maxHp: old.maxHp, stage: old.stage });
  for (const p of s.attachments)
    if (p.attachedTo === old.id) p.attachedTo = next.id;
  l.setAside.push({ ...old, hp: undefined, maxHp: undefined } as Piece);
  s.villain = next as GameState["villain"];
  return s;
}
function zones(s: GameState): Piece[][] {
  const l = s.loki!;
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
    [s.villain],
    l.setAside,
    l.stoneDeck,
    l.stoneDiscard,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** 20 Loki cards (five Lokis and fifteen encounter cards), the Infinity
 * Gauntlet and six Stones, five Enchantress and six Frost Giants cards each
 * stay in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "loki")).toHaveLength(20);
  expect(
    all.filter((p) => card(p).set_code === "infinity_gauntlet"),
  ).toHaveLength(7);
  expect(all.filter((p) => card(p).set_code === "enchantress")).toHaveLength(5);
  expect(all.filter((p) => card(p).set_code === "frost_giants")).toHaveLength(
    6,
  );
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
function playerCard(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  expect(i, `deck card ${code}`).toBeGreaterThanOrEqual(0);
  return p.deck.splice(i, 1)[0];
}
/** War in Asgard leaves play, so no side scheme is in play. */
function noSideSchemes(s: GameState) {
  s.encounter.discard.push(...s.sideSchemes.splice(0));
}
const onLoki = (s: GameState) =>
  s.attachments
    .filter((p) => p.attachedTo === s.villain.id)
    .map((p) => p.code)
    .sort();
const stored = (s: GameState) => s.encounter.storedBoosts?.length || 0;

describe("Loki original source", () => {
  it("registers every face of the scenario and the Enchantress set", () => {
    for (const set of ["loki", "enchantress"])
      for (const c of CATALOG_CARDS.filter(
        (c) => c.set_code === set && c.pack_code === "mts",
      )) {
        expect(LOKI_SCRIPT_CODES as readonly string[]).toContain(c.code);
        expect(hasExecutableScript(c.code), c.code).toBe(true);
      }
    expect(LOKI_SCRIPT_CODES).toHaveLength(21);
    expect(VILLAINS.find((v) => v.id === "loki")).toMatchObject({
      codes: ["21160", "21161", "21162", "21163", "21164"],
      schemes: ["21165b"],
      moduleCount: 2,
      defaultModules: ["enchantress", "frost_giants"],
      fixedSets: ["infinity_gauntlet"],
    });
    expect(MODULES.some((m) => m.id === "enchantress")).toBe(true);
    expect(scenarioModules("loki")).toHaveLength(MODULES.length);
  });
  it.each([1, 2, 3])(
    "reveals a random Loki, War in Asgard and the first Stone for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        expect(LOKI_VILLAINS as readonly string[]).toContain(s.villain.code);
        expect([s.villain.hp, s.villain.maxHp]).toEqual([
          20 * players,
          20 * players,
        ]);
        expect(s.scheme).toMatchObject({ code: "21165b", threat: players });
        expect(s.loki!.victoryCondition).toBe(difficulty === "expert" ? 3 : 2);
        expect(
          [s.villain.code, ...s.loki!.setAside.map((p) => p.code)].sort(),
        ).toEqual([...LOKI_VILLAINS]);
        expect(onLoki(s)).toEqual(["21129"]);
        expect(thanosStonesInPlay(s)).toHaveLength(1);
        expect(s.loki!.stoneDeck).toHaveLength(5);
        // Put into play, not revealed: no hinder.
        expect(s.sideSchemes.map((p) => [p.code, p.counters])).toEqual([
          ["21167", 6],
        ]);
        expect(
          s.encounter.deck.filter(
            (p) => isLokiCode(p.code) || p.code === "21167",
          ),
        ).toEqual([]);
        exact(reload(s));
      }
    },
  );
  it("needs four Lokis in Heroic", () => {
    const s = settle(setup("standard", 1, "loki", undefined, 1));
    expect(s.loki!.victoryCondition).toBe(4);
  });
});
const isLokiCode = (code: string) =>
  (LOKI_VILLAINS as readonly string[]).includes(code);

describe("The God of Mischief", () => {
  it("a defeated Loki goes to the victory display and a random set-aside Loki takes his place", () => {
    let s = started();
    as(s, "21161");
    noSideSchemes(s);
    s.villain.stunned = true;
    stack(s, "01186", "21169");
    const old = s.villain.id;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 20 }));
    expect(s.phase).not.toBe("won");
    expect(lokiVictories(s)).toBe(1);
    expect((s.victoryDisplay || []).map((p) => p.id)).toContain(old);
    expect(s.villain.id).not.toBe(old);
    expect(isLokiCode(s.villain.code)).toBe(true);
    expect(s.villain.hp).toBe(20);
    expect(s.loki!.setAside).toHaveLength(3);
    // The Infinity Gauntlet and the status cards move to the new Loki,
    // unless he is stalwart.
    expect(onLoki(s)).toEqual(["21129"]);
    if (!["21162", "21163"].includes(s.villain.code))
      expect(s.villain.stunned).toBe(true);
    // When Defeated: discard until a side scheme and reveal it.
    expect(s.sideSchemes.map((p) => p.code)).toEqual(["21169"]);
    expect(s.encounter.discard.some((p) => p.code === "01186")).toBe(true);
    exact(s);
  });
  it("the players win when the victory display holds as many Lokis as the victory condition", () => {
    let s = started();
    noSideSchemes(s);
    as(s, "21161");
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 20 }));
    noSideSchemes(s);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 20 }));
    expect(s.phase).toBe("won");
  });
  it("a defeated side scheme reveals the top Stone and swaps Loki, who keeps his damage and attachments", () => {
    let s = started();
    as(s, "21161");
    s.villain.hp -= 7;
    stones(s, "21130");
    const old = s.villain.id;
    const war = s.sideSchemes[0];
    s = settle(native(s, { type: "thwart", target: war.id, amount: 6 }));
    expect(s.villain.id).not.toBe(old);
    expect(s.villain.hp).toBe(13);
    expect(onLoki(s)).toEqual(["21129"]);
    expect(s.loki!.setAside.map((p) => p.id)).toContain(old);
    expect(thanosStonesInPlay(s).map((p) => p.code)).toEqual(["21130"]);
    exact(s);
  });
  it("a Loki who gains stalwart discards his stunned and confused status cards", () => {
    let s = started();
    as(s, "21161");
    for (const p of s.loki!.setAside)
      if (!["21162", "21163"].includes(p.code)) take(s, p.code).code;
    s.villain.stunned = s.villain.confused = true;
    s = settle(native(s, { type: "loki:swap" }));
    expect(["21162", "21163"]).toContain(s.villain.code);
    expect([s.villain.stunned, s.villain.confused]).toEqual([false, false]);
  });
  it("Loki (21160) cannot take damage while a side scheme is in play", () => {
    let s = started();
    as(s, "21160");
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 5 }));
    expect(s.villain.hp).toBe(20);
    noSideSchemes(s);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 5 }));
    expect(s.villain.hp).toBe(15);
  });
  it("Loki (21164) attacks with piercing; Loki (21161) has retaliate 1", () => {
    let s = started();
    as(s, "21164");
    // Without War in Asgard's amplify icon.
    noSideSchemes(s);
    s.player.tough = true;
    stack(s, "01186");
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.tough).toBe(false);
    // ATK 2 and the Infinity Gauntlet's +1.
    expect(s.player.hp).toBe(hp - 3);
    as(s, "21161");
    expect(enemyStats(s, s.villain)).toEqual({ attack: 2, scheme: 3 });
  });
  it("the Infinity Gauntlet resolves each Stone in play after Loki activates", () => {
    let s = started();
    s.player.form = "alter";
    inPlay(s, "21130");
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.player.confused).toBe(true);
    expect(s.loki!.stoneDiscard.map((p) => p.code)).toEqual(["21130"]);
    exact(s);
  });
  it("the players lose when All Hail King Loki is completed", () => {
    const s = native(started(), {
      type: "threat",
      target: "main",
      amount: 12,
    });
    expect(s.phase).toBe("lost");
  });
});

describe("Loki encounter cards", () => {
  it("Loki's Staff gives +1 ATK, attaches as a boost and leaves after a basic attack for energy and physical", () => {
    let s = started();
    as(s, "21161");
    noSideSchemes(s);
    const staff = attach(s, "21170");
    expect(enemyStats(s, s.villain).attack).toBe(1 + 1 + 1);
    const energy = playerCard(s, "01088");
    const strength = playerCard(s, "01090");
    s.player.hand.push(energy, strength);
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(
      s,
      (v) => (v.prompt?.title === "Loki's armor" ? staff.id : undefined),
      true,
    );
    s = settle(pay(s, [energy, strength]));
    expect(s.attachments.some((p) => p.id === staff.id)).toBe(false);
    exact(s);
    let t = started();
    stack(t, "21170");
    t = settle(native(t, { type: "enemyAttack", id: t.villain.id }));
    expect(onLoki(t)).toEqual(["21129", "21170"]);
    exact(t);
  });
  it("Loki's Cape gives him a tough status card after he is swapped", () => {
    let s = started();
    attach(s, "21172");
    s = settle(native(s, { type: "loki:swap" }));
    expect(s.villain.tough).toBe(true);
    expect(onLoki(s)).toEqual(["21129", "21172"]);
    exact(s);
  });
  it("Master of Illusions prevents an attack's damage when it discards a treachery", () => {
    let s = started();
    as(s, "21162");
    noSideSchemes(s);
    const illusions = attach(s, "21173");
    stack(s, "01186");
    s = settle(command(s, { type: "BASIC", action: "attack" }));
    expect(s.villain.hp).toBe(20);
    expect(s.attachments.some((p) => p.id === illusions.id)).toBe(false);
    exact(s);
    let t = started();
    as(t, "21162");
    noSideSchemes(t);
    attach(t, "21173");
    stack(t, "21157");
    t = settle(command(t, { type: "BASIC", action: "attack" }));
    expect(t.villain.hp).toBeLessThan(20);
    expect(onLoki(t)).toEqual(["21129", "21173"]);
    exact(t);
  });
  it("Devious Sorcery stuns you, or deals 2 damage to a stunned hero and 2 threat for a stunned alter-ego", () => {
    let s = started();
    s = settle(reveal(s, "21174"));
    expect(s.player.stunned).toBe(true);
    const hp = s.player.hp;
    s = settle(reveal(s, "21174"));
    expect(s.player.hp).toBe(hp - 2);
    let t = started();
    t.player.form = "alter";
    t.player.stunned = true;
    t = settle(reveal(t, "21174"));
    expect(t.scheme.threat).toBe(1 + 2);
    exact(t);
  });
  it("Infinite Mischief shuffles the Stone discard pile into the deck and reveals a Stone; as a boost it adds a Stone's icons", () => {
    let s = started();
    s.loki!.stoneDiscard.push(...s.loki!.stoneDeck.splice(0, 3));
    s = settle(reveal(s, "21175"));
    expect(thanosStonesInPlay(s)).toHaveLength(1);
    expect(s.loki!.stoneDiscard).toHaveLength(0);
    expect(s.loki!.stoneDeck).toHaveLength(5);
    exact(s);
    let t = started();
    as(t, "21161");
    noSideSchemes(t);
    stones(t, "21135");
    stack(t, "21175");
    const hp = t.player.hp;
    t = settle(native(t, { type: "enemyAttack", id: t.villain.id }));
    // ATK 1, the Infinity Gauntlet's +1 and the Time Stone's four icons.
    expect(t.player.hp).toBe(hp - 6);
    expect(t.loki!.stoneDiscard.map((p) => p.code)).toEqual(["21135"]);
    exact(t);
  });
  it("The Trickster swaps Loki and he activates against you; as a boost it adds a boost card and toughness", () => {
    let s = started();
    s.player.form = "alter";
    const old = s.villain.id;
    stack(s, "01186");
    s = settle(reveal(s, "21176"));
    expect(s.villain.id).not.toBe(old);
    expect(s.scheme.threat).toBeGreaterThan(1);
    exact(s);
    let t = started();
    as(t, "21161");
    stack(t, "21176", "01186");
    t = settle(native(t, { type: "enemyAttack", id: t.villain.id }));
    expect(t.villain.tough).toBe(true);
    expect(t.encounter.discard.map((p) => p.code)).toEqual(
      expect.arrayContaining(["21176", "01186"]),
    );
    exact(t);
  });
});

describe("Enchantress", () => {
  it("Enchantress attaches a Seduced to the revealing identity, which cannot basic attack until an alter-ego pays energy and mental", () => {
    let s = started();
    s = settle(reveal(s, "21177"));
    expect(s.minions.some((p) => p.code === "21177")).toBe(true);
    const seduced = s.attachments.find((p) => p.code === "21179")!;
    expect(seduced.attachedTo).toBe(`hero:${s.activePlayerId}`);
    expect(dispatch(reload(s), { type: "BASIC", action: "attack" }).error).toBe(
      "Seduced prevents basic attacks.",
    );
    s.player.form = "alter";
    const energy = playerCard(s, "01088");
    const genius = playerCard(s, "01089");
    s.player.hand.push(energy, genius);
    s = command(s, {
      type: "ABILITY",
      id: seduced.id,
      action: "remove-seduced",
    });
    s = settle(pay(s, [energy, genius]));
    expect(s.attachments.some((p) => p.id === seduced.id)).toBe(false);
    exact(s);
  });
  it("Beguiled turns your highest-cost ally into an Enthralled minion engaged with you", () => {
    let s = started();
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    s = settle(reveal(s, "21178"));
    const minion = s.minions.find((p) => p.id === cat.id)!;
    expect(minion.engagedWith).toBe(s.activePlayerId);
    expect(card(minion).type_code).toBe("minion");
    expect(card(minion).traits).toMatch(/Enthralled/);
    exact(s);
  });
  it("is a modular set for other scenarios", () => {
    const s = settle(setup("standard", 1, "rhino", ["enchantress"]));
    expect(s.modules).toEqual(["enchantress"]);
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "enchantress"),
    ).toHaveLength(5);
  });
});
