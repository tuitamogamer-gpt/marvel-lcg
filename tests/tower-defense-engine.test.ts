/** Tower Defense, the second scenario of The Mad Titan's Shadow, exercised with
 * the original physical cards: two villains, two main schemes, Focused Defense
 * and Avengers Tower. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  VILLAINS,
  card,
  scenarioModules,
  MODULES,
} from "../src/game/cards";
import {
  abilityOptions,
  makePiece,
  newGame,
  targets,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import { uniqueConflict } from "../src/game/unique";
import {
  TOWER_DEFENSE_SCRIPT_CODES,
  TOWER_OTHER_MAIN,
  towerDefenseKeyword,
  towerDefenseTower,
  towerScheme,
  towerVillain,
} from "../src/game/tower-defense";
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
function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "tower_defense",
    difficulty,
    seed: 21092,
    pacing: "expert",
    heroes: players3.slice(0, players),
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
        (["Black Order Besieger", "Proxima Midnight"].includes(s.prompt.title)
          ? "tower"
          : undefined) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
/** Started table: hands go back into the decks, every identity is a hero,
 * setup's Besiegers return to the encounter deck and the Tower is repaired. */
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  for (const m of [...s.minions]) {
    s.minions = s.minions.filter((q) => q.id !== m.id);
    delete m.engagedWith;
    s.encounter.deck.push(m);
  }
  towerDefenseTower(s)!.damage = 0;
  return reload(s);
}
function zones(s: GameState): Piece[][] {
  const td = s.towerDefense!;
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
    [s.villain, td.other.villain],
    [td.mains.proxima, td.mains.corvus],
    td.villainDecks.proxima,
    td.villainDecks.corvus,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** 25 scenario cards and six Armies of Titan cards each stay in exactly one
 * zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "tower_defense")).toHaveLength(
    25,
  );
  expect(
    all.filter((p) => card(p).set_code === "armies_of_titan"),
  ).toHaveLength(6);
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
/** Stack original cards on top of the encounter deck, first card on top. */
function stack(s: GameState, ...codes: string[]) {
  s.encounter.deck.unshift(...codes.map((code) => take(s, code)));
  delete s.encounter.knownTop;
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
const proxima = (s: GameState) => towerVillain(s, "proxima")!;
const corvus = (s: GameState) => towerVillain(s, "corvus")!;
const underSiege = (s: GameState) => towerScheme(s, "proxima")!;
const armies = (s: GameState) => towerScheme(s, "corvus")!;
const tower = (s: GameState) => towerDefenseTower(s)!;
/** Back at rest, the active villain and its main scheme are native. */
function atRest(s: GameState) {
  const td = s.towerDefense!;
  expect(td.focus).toBe(td.active);
  expect(towerVillain(s, td.active)!.id).toBe(s.villain.id);
  return s;
}

describe("Tower Defense original source", () => {
  it("registers every face of the scenario", () => {
    for (const c of CATALOG_CARDS.filter(
      (c) => c.set_code === "tower_defense" && c.pack_code === "mts",
    )) {
      expect(TOWER_DEFENSE_SCRIPT_CODES as readonly string[]).toContain(c.code);
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    }
    expect(TOWER_DEFENSE_SCRIPT_CODES).toHaveLength(22);
    expect(VILLAINS.find((v) => v.id === "tower_defense")).toMatchObject({
      codes: ["21092", "21093", "21094"],
      schemes: ["21098b", "21099b"],
      module: "armies_of_titan",
    });
    expect(scenarioModules("tower_defense")).toHaveLength(MODULES.length);
  });
  it.each([1, 2, 3])(
    "sets up both villains, both main schemes, Avengers Tower and a Besieger for each of %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        const td = s.towerDefense!;
        const stage = difficulty === "expert" ? 1 : 0;
        expect(td.active).toBe("corvus");
        atRest(s);
        expect(corvus(s).code).toBe(["21095", "21096"][stage]);
        expect(corvus(s).hp).toBe([8, 11][stage] * players);
        expect(proxima(s).code).toBe(["21092", "21093"][stage]);
        expect(proxima(s).hp).toBe([9, 12][stage] * players);
        expect(td.villainDecks.proxima.map((p) => p.code)).toEqual([
          ["21093", "21094"][stage],
        ]);
        expect(armies(s)).toMatchObject({ code: "21099b", threat: players });
        expect(underSiege(s)).toMatchObject({
          code: "21098b",
          threat: players,
        });
        expect(tower(s).code).toBe("21100a");
        // Each player chose to damage the Tower for their Besieger.
        expect(tower(s).damage).toBe(players);
        expect(s.attachments.find((p) => p.code === "21101")?.attachedTo).toBe(
          "main:21099b",
        );
        expect(s.minions.map((p) => [p.code, p.engagedWith])).toEqual(
          s.players.map((seat) => ["21102", seat.id]),
        );
        expect(s.encounter.deck.some((p) => p.code === "21101")).toBe(false);
        expect(s.modules).toEqual(["armies_of_titan"]);
        exact(reload(s));
      }
    },
  );
  it("a Besieger can deal 2 damage to your identity instead", () => {
    const s = settle(setup("standard"), (v) =>
      v.prompt?.title === "Black Order Besieger" ? "identity" : undefined,
    );
    expect(s.player.hp).toBe(10 - 2);
    expect(tower(s).damage).toBe(0);
  });
});

describe("Two villains and Focused Defense", () => {
  it("Focused Defense moves after each player phase and only the active villain activates", () => {
    let s = started("standard");
    s.player.form = "alter";
    stack(s, "01186", "21109");
    s = settle(command(s, { type: "END_TURN" }));
    // Round 1: Proxima Midnight became active before the villain phase.
    expect(s.towerDefense!.active).toBe("proxima");
    expect(s.attachments.find((p) => p.code === "21101")?.attachedTo).toBe(
      "main:21098b",
    );
    atRest(s);
    // Step 1 gave each main scheme 1 threat; only Proxima schemed (SCH 1).
    expect(underSiege(s).threat).toBe(1 + 1 + 1);
    expect(armies(s).threat).toBe(1 + 1);
    // The dealt Rain Fire damaged the Tower.
    expect(tower(s).damage).toBe(3);
    s.player.form = "alter";
    stack(s, "01186", "21109");
    s = settle(command(s, { type: "END_TURN" }));
    expect(s.towerDefense!.active).toBe("corvus");
    atRest(s);
    expect(underSiege(s).threat).toBe(3 + 1);
    // Corvus Glaive schemes for SCH 2.
    expect(armies(s).threat).toBe(2 + 1 + 2);
    exact(s);
  });
  it("each main scheme gains threat and acceleration in step 1", () => {
    let s = started("standard", 2);
    s.encounter.acceleration = 1;
    s = settle(native(s, { type: "villainStepOne" }));
    expect(underSiege(s).threat).toBe(2 + 2 + 1);
    expect(armies(s).threat).toBe(2 + 2 + 1);
    atRest(s);
  });
  it("a villain schemes on its own main scheme; a minion on the scheme with Focused Defense", () => {
    let s = started("standard");
    s.player.form = "alter";
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(armies(s).threat).toBe(1 + 2);
    stack(s, "01186");
    s = settle(
      native(s, {
        type: "tower:activate",
        key: "proxima",
        playerId: s.activePlayerId,
      }),
    );
    expect(underSiege(s).threat).toBe(1 + 1);
    atRest(s);
    const besieger = engage(s, "21102");
    s = settle(native(s, { type: "enemyScheme", id: besieger.id }));
    expect(armies(s).threat).toBe(3 + 1);
    expect(underSiege(s).threat).toBe(2);
    exact(s);
  });
  it("players can attack either villain and thwart either main scheme", () => {
    let s = started("standard");
    expect(targets(s, "enemy", true).map((t) => t.id)).toEqual([
      corvus(s).id,
      proxima(s).id,
    ]);
    expect(targets(s, "scheme", false, true).map((t) => t.id)).toEqual([
      "main",
      TOWER_OTHER_MAIN,
    ]);
    const target = proxima(s).id;
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(choose(s, target));
    expect(proxima(s).hp).toBe(9 - 2);
    expect(corvus(s).hp).toBe(8);
    atRest(s);
    s.player.exhausted = false;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = settle(choose(s, TOWER_OTHER_MAIN));
    expect(underSiege(s).threat).toBe(0);
    expect(armies(s).threat).toBe(1);
    atRest(s);
    exact(s);
  });
  it("statuses and damage reach the villain out of focus", () => {
    let s = started("standard");
    const id = proxima(s).id;
    s = settle(native(s, { type: "status", target: id, status: "stunned" }));
    expect(proxima(s).stunned).toBe(true);
    expect(corvus(s).stunned).toBe(false);
    // A stunned Proxima loses the status card instead of attacking.
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "tower:activate",
        key: "proxima",
        playerId: s.activePlayerId,
      }),
    );
    expect(proxima(s).stunned).toBe(false);
    expect(s.player.hp).toBe(hp);
    atRest(s);
  });
  it("neither villain can be defeated while the other has hit points; both advance together and win at the end", () => {
    let s = started("standard", 2);
    s = settle(
      native(s, { type: "damage", target: proxima(s).id, amount: 99 }),
    );
    expect(proxima(s)).toMatchObject({ code: "21092", hp: 0 });
    s = settle(native(s, { type: "damage", target: proxima(s).id, amount: 3 }));
    expect(proxima(s)).toMatchObject({ code: "21092", hp: 0 });
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(proxima(s)).toMatchObject({ code: "21093", hp: 24, stage: 2 });
    expect(corvus(s)).toMatchObject({ code: "21096", hp: 22, stage: 2 });
    atRest(s);
    exact(s);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.phase).toBe("player");
    s = settle(
      native(s, { type: "damage", target: proxima(s).id, amount: 99 }),
    );
    expect(s.phase).toBe("won");
  });
  it("expert starts at stage II and wins after stage III", () => {
    let s = started("expert");
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    s = settle(
      native(s, { type: "damage", target: proxima(s).id, amount: 99 }),
    );
    expect(proxima(s).code).toBe("21094");
    expect(corvus(s).code).toBe("21097");
    s = settle(
      native(s, { type: "damage", target: proxima(s).id, amount: 99 }),
    );
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.phase).toBe("won");
  });
});

describe("Main schemes and Avengers Tower", () => {
  it("Under Siege removes its threat instead of completing and damages the Tower", () => {
    let s = started("standard");
    s = settle(
      native(s, { type: "threat", target: TOWER_OTHER_MAIN, amount: 5 }),
    );
    expect(underSiege(s).threat).toBe(0);
    expect(tower(s).damage).toBe(6);
    expect(s.phase).toBe("player");
    atRest(s);
  });
  it("The Armies of Thanos removes its threat instead and deals each player an encounter card", () => {
    let s = started("standard", 2);
    s = settle(native(s, { type: "threat", target: "main", amount: 10 }));
    expect(armies(s).threat).toBe(0);
    expect(s.encounter.dealt.map((p) => p.dealtTo)).toEqual(
      s.players.map((seat) => seat.id),
    );
    exact(s);
  });
  it("Avengers Tower flips at 9 damage per player, discards Avengers Tower supports, and its Damaged side loses the game", () => {
    let s = started("standard", 2);
    const [p1, p2] = s.players.map((seat) => seat.id);
    const a = makePiece(s, "03024");
    const b = makePiece(s, "21020");
    b.ownerId = p2;
    seatView(s, p1).player.inPlay.push(a);
    seatView(s, p2).player.inPlay.push(b);
    // The unique rule does not apply to Avengers Tower on its Stronghold side.
    expect(uniqueConflict(s, card("03024"), a.id)).toBe(false);
    s = settle(native(s, { type: "tower:damage", amount: 17 }));
    expect(tower(s)).toMatchObject({ code: "21100a", damage: 17 });
    s = settle(native(s, { type: "tower:damage", amount: 2 }));
    expect(tower(s)).toMatchObject({ code: "21100b", damage: 0 });
    expect(seatView(s, p1).player.discard.some((p) => p.id === a.id)).toBe(
      true,
    );
    expect(seatView(s, p2).player.discard.some((p) => p.id === b.id)).toBe(
      true,
    );
    expect(uniqueConflict(s, card("03024"))).toBe(true);
    s = settle(native(s, { type: "tower:damage", amount: 18 }));
    expect(s.phase).toBe("lost");
  });
});

describe("Proxima Midnight and Corvus Glaive", () => {
  it("Proxima's Forced Interrupt: damage the Tower or +2 ATK for the attack", () => {
    let s = started("standard");
    s = settle(native(s, { type: "tower:focused-defense" }));
    expect(s.villain.id).toBe(proxima(s).id);
    stack(s, "01186");
    let hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(tower(s).damage).toBe(1);
    expect(s.player.hp).toBe(hp - 2);
    stack(s, "01186");
    hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }), (v) =>
      v.prompt?.title === "Proxima Midnight" ? "attack" : undefined,
    );
    expect(tower(s).damage).toBe(1);
    expect(s.player.hp).toBe(hp - 4);
    exact(s);
  });
  it("Corvus's undefended attack discards the top card and damages the Tower per boost icon", () => {
    let s = started("standard");
    stack(s, "01186", "21103");
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(10 - 1);
    expect(tower(s).damage).toBe(3);
    expect(s.encounter.discard.some((p) => p.code === "21103")).toBe(true);
    // A defended attack leaves the Tower alone.
    stack(s, "01186", "21104");
    s = settle(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => /defend/i.test(o.label))?.id,
    );
    expect(tower(s).damage).toBe(3);
    exact(s);
  });
});

describe("Tower Defense encounter cards", () => {
  it("Proxima's Power makes the villain out of focus activate against you", () => {
    let s = started("standard");
    stack(s, "01186");
    s = settle(reveal(s, "21106"));
    expect(s.player.hp).toBe(10 - 2);
    expect(tower(s).damage).toBe(1);
    atRest(s);
    s.player.form = "alter";
    stack(s, "01186");
    s = settle(reveal(s, "21106"));
    expect(underSiege(s).threat).toBe(1 + 1);
    expect(armies(s).threat).toBe(1);
    atRest(s);
    exact(s);
  });
  it("Corvus's Cunning activates Corvus; as a boost it adds the other villain's SCH and ATK", () => {
    let s = started("standard", 2);
    s.player.form = "alter";
    stack(s, "01186");
    s = settle(reveal(s, "21107"));
    expect(armies(s).threat).toBe(2 + 2);
    stack(s, "21107");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    // Corvus Glaive SCH 2 plus Proxima Midnight's SCH 1.
    expect(armies(s).threat).toBe(4 + 3);
    s.player.form = "hero";
    stack(s, "21106");
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    // Corvus Glaive ATK 1 plus Proxima Midnight's ATK 2.
    expect(s.player.hp).toBe(10 - 3);
    exact(s);
  });
  it("Bound by Blood heals and toughens each villain; its boost only the active villain", () => {
    let s = started("standard");
    s = settle(native(s, { type: "damage", target: proxima(s).id, amount: 4 }));
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 4 }));
    s = settle(reveal(s, "21108"));
    expect(proxima(s)).toMatchObject({ hp: 9 - 2, tough: true });
    expect(corvus(s)).toMatchObject({ hp: 8 - 2, tough: true });
    for (const v of [proxima(s), corvus(s)]) {
      v.tough = false;
      v.toughCards = 0;
    }
    s.player.form = "alter";
    stack(s, "21108");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(corvus(s)).toMatchObject({ hp: 8, tough: true });
    expect(proxima(s)).toMatchObject({ hp: 7, tough: false });
    exact(s);
  });
  it("Rain Fire damages the Tower; as a boost, when the attack defeats an ally", () => {
    let s = started("standard");
    s = settle(reveal(s, "21109"));
    expect(tower(s).damage).toBe(3);
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    stack(s, "21109");
    s = settle(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === cat.id)?.id,
    );
    expect(s.player.inPlay.some((p) => p.id === cat.id)).toBe(false);
    expect(tower(s).damage).toBe(6);
    exact(s);
  });
  it("Direct Assault attaches to the villain out of focus, gives its next attack ranged and +2 ATK, then leaves", () => {
    let s = started("standard");
    s = settle(reveal(s, "21105"));
    const assault = s.attachments.find((p) => p.code === "21105")!;
    expect(assault.attachedTo).toBe(proxima(s).id);
    s.attack = { attacker: proxima(s).id } as GameState["attack"];
    expect(towerDefenseKeyword(s, proxima(s), "Ranged")).toBe(1);
    s.attack = null;
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    stack(s, "01186");
    s = settle(
      native(s, {
        type: "tower:activate",
        key: "proxima",
        playerId: s.activePlayerId,
      }),
      (v) => v.prompt?.options.find((o) => o.id === cat.id)?.id,
    );
    expect(s.player.inPlay.some((p) => p.id === cat.id)).toBe(false);
    // Proxima's interrupt (1) and the defeated ally (3).
    expect(tower(s).damage).toBe(1 + 3);
    expect(s.attachments.some((p) => p.id === assault.id)).toBe(false);
    atRest(s);
    exact(s);
  });
  it("Proxima's Spear gives her attacks overkill and piercing and leaves for 1 damage, energy and mental", () => {
    let s = started("standard");
    s = settle(reveal(s, "21103"));
    const spear = s.attachments.find((p) => p.code === "21103")!;
    expect(spear.attachedTo).toBe(proxima(s).id);
    s.attack = { attacker: proxima(s).id } as GameState["attack"];
    expect(towerDefenseKeyword(s, proxima(s), "Overkill")).toBe(1);
    expect(towerDefenseKeyword(s, proxima(s), "Piercing")).toBe(1);
    s.attack = null;
    const energy = playerCard(s, "01088");
    const genius = playerCard(s, "01089");
    s.player.hand.push(energy, genius);
    expect(abilityOptions(s, spear).map((o) => o.id)).toEqual(["remove"]);
    s = command(s, { type: "ABILITY", id: spear.id, action: "remove" });
    s = settle(pay(s, [energy, genius]));
    expect(s.attachments.some((p) => p.id === spear.id)).toBe(false);
    expect(s.player.hp).toBe(10 - 1);
    exact(s);
  });
  it("Corvus's Glaive gives Corvus retaliate 1, also out of focus, and leaves for 1 damage, energy and physical", () => {
    let s = started("standard");
    s = settle(reveal(s, "21104"));
    const glaive = s.attachments.find((p) => p.code === "21104")!;
    expect(glaive.attachedTo).toBe(corvus(s).id);
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(choose(s, corvus(s).id));
    expect(s.player.hp).toBe(10 - 1);
    // Make Proxima active: Corvus is now out of focus and still retaliates.
    s = settle(native(s, { type: "tower:focused-defense" }));
    s.player.exhausted = false;
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(choose(s, corvus(s).id));
    expect(s.player.hp).toBe(10 - 2);
    expect(corvus(s).hp).toBe(8 - 4);
    atRest(s);
    const energy = playerCard(s, "01088");
    const strength = playerCard(s, "01090");
    s.player.hand.push(energy, strength);
    s = command(s, { type: "ABILITY", id: glaive.id, action: "remove" });
    s = settle(pay(s, [energy, strength]));
    expect(s.attachments.some((p) => p.id === glaive.id)).toBe(false);
    expect(s.player.hp).toBe(10 - 3);
    exact(s);
  });
  it("City Under Attack hinders, blocks thwarting either main scheme and draws a card when defeated", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "21110"));
    const city = s.sideSchemes.find((p) => p.code === "21110")!;
    expect(city.counters).toBe(2 + 2);
    expect(targets(s, "scheme", false, true).map((t) => t.id)).toEqual([
      city.id,
    ]);
    const hand = s.player.hand.length;
    s = settle(native(s, { type: "thwart", target: city.id, amount: 4 }));
    expect(s.sideSchemes.some((p) => p.id === city.id)).toBe(false);
    expect(s.player.hand).toHaveLength(hand + 1);
    exact(s);
  });
  it("a revealed Black Order Besieger engages you and asks for its price", () => {
    let s = started("standard");
    s = settle(reveal(s, "21102"), (v) =>
      v.prompt?.title === "Black Order Besieger" ? "identity" : undefined,
    );
    expect(s.minions.map((p) => p.code)).toEqual(["21102"]);
    expect(s.player.hp).toBe(10 - 2);
    exact(s);
  });
});
