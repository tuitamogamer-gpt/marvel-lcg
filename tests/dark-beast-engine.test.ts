/** Age of Apocalypse: Dark Beast with the Savage Land, Genosha and Blue
 * Moon sets, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  pieceHP,
  scenarioModules,
} from "../src/game/cards";
import { newGame, targets } from "../src/game/engine";
import {
  BLUE_MOON_CODES,
  DARK_BEAST_SCRIPT_CODES,
  GENOSHA_CODES,
  SAVAGE_LAND_CODES,
  darkBeastSetting,
  escapedMutantHolder,
} from "../src/game/dark-beast";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
const team: Seat[] = [
  { heroId: "spider_man", aspect: "justice" },
  { heroId: "captain_marvel", aspect: "aggression" },
];
const SAVAGE_LAND = "45127";
const GENOSHA = "45133";
const BLUE_AREA = "45139";
const SETTINGS = [SAVAGE_LAND, GENOSHA, BLUE_AREA];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "dark_beast",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 45118,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...(modules ? { modules } : {}),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 200; n++) {
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
function opened(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "dark_beast",
  modules?: string[],
) {
  let s = settle(setup(difficulty, players, villainId, modules));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "dark_beast",
  modules?: string[],
) {
  const s = opened(difficulty, players, villainId, modules);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
/** An original encounter card from any encounter zone or set-aside set. */
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    ...(s.darkBeast?.setAside.map((g) => g.pieces) || []),
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function resolveEncounter(s: GameState) {
  for (
    let n = 0;
    n < 5 &&
    s.prompt?.options.some((o) => o.id === "resolve") &&
    /interrupt available/i.test(s.prompt.text);
    n++
  )
    s = choose(s, "resolve");
  return s;
}
/** Put a Setting in play in place of any other. */
function setting(s: GameState, code: string) {
  for (const p of (s.environments || []).filter((q) =>
    SETTINGS.includes(q.code),
  )) {
    s.environments = s.environments!.filter((q) => q.id !== p.id);
    s.encounter.discard.push(p);
  }
  const p = take(s, code);
  (s.environments ||= []).push(p);
  return reload(s);
}
function own(s: GameState, type: string) {
  const view = s.player;
  const i = view.deck.findIndex((p) => card(p).type_code === type);
  expect(i, type).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.inPlay.push(p);
  return p;
}
const hit = (target: string, amount: number, source = "hero"): Effect => ({
  type: "damage",
  target,
  amount,
  source,
});
const attack = (id: string, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id,
  actorId: playerId,
});
function untough(s: GameState, p: Piece = s.villain) {
  p.tough = false;
  p.toughCards = 0;
  return reload(s);
}
/** A minion of the code put into play engaged with the first player. */
function minion(s: GameState, code: string) {
  const p = take(s, code);
  p.engagedWith = "p1";
  p.tough = false;
  p.toughCards = 0;
  s.minions.push(p);
  return p;
}

describe("Dark Beast: original source", () => {
  it("registers every face of the Dark Beast, Savage Land, Genosha and Blue Moon sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aoa" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(DARK_BEAST_SCRIPT_CODES)).toEqual(
      new Set(faces("dark_beast")),
    );
    expect(new Set(SAVAGE_LAND_CODES)).toEqual(new Set(faces("savage_land")));
    expect(new Set(GENOSHA_CODES)).toEqual(new Set(faces("genosha")));
    expect(new Set(BLUE_MOON_CODES)).toEqual(new Set(faces("blue_moon")));
    for (const code of [
      ...DARK_BEAST_SCRIPT_CODES,
      ...SAVAGE_LAND_CODES,
      ...GENOSHA_CODES,
      ...BLUE_MOON_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(MODULES.slice(-17, -14).map((m) => m.id)).toEqual([
      "savage_land",
      "genosha",
      "blue_moon",
    ]);
    expect(scenarioModules("dark_beast")).toHaveLength(MODULES.length - 3);
    expect(VILLAINS.find((v) => v.id === "dark_beast")).toMatchObject({
      codes: ["45118", "45119", "45120"],
      schemes: ["45121b"],
      defaultModules: ["dystopian_nightmare"],
      fixedSets: ["savage_land", "genosha", "blue_moon"],
    });
  });

  it("Dark Beast (I) reveals a random Setting at setup and shuffles the rest of its set in; the other two stay aside", () => {
    for (const players of [1, 2]) {
      const s = opened("standard", players);
      expect(s.villain.code).toBe("45118");
      expect(s.villain.hp).toBe(15 * players);
      expect(s.scheme.code).toBe("45121b");
      expect(s.scheme.threat).toBe(players);
      const env = darkBeastSetting(s)!;
      expect(env).toBeTruthy();
      const set = card(env).set_code;
      expect(s.darkBeast!.setAside.map((g) => g.set).sort()).toEqual(
        ["savage_land", "genosha", "blue_moon"].filter((x) => x !== set).sort(),
      );
      // The rest of the revealed set is among the encounter cards.
      const codes = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
        ...s.minions,
        ...s.sideSchemes,
      ].map((p) => card(p).set_code);
      expect(codes).toContain(set);
      // Standard: Dark Beast (I) deals no encounter cards.
      expect(s.encounter.dealt).toHaveLength(0);
    }
  });

  it("Expert starts with Dark Beast (II), deals each player a card and attaches High-Tech Goggles", () => {
    for (const players of [1, 2]) {
      const s = opened("expert", players);
      expect(s.villain.code).toBe("45119");
      expect(s.villain.hp).toBe(18 * players);
      expect(darkBeastSetting(s)).toBeTruthy();
      expect(s.darkBeast!.setAside).toHaveLength(2);
      expect(
        s.attachments.some(
          (a) => a.code === "45122" && a.attachedTo === s.villain.id,
        ),
      ).toBe(true);
      expect(s.encounter.dealt.length).toBe(players);
    }
  });
});

describe("Dark Beast", () => {
  it("each Setting's Special: discard 3 cards, 1 threat on the main scheme, or 1 damage to your identity", () => {
    let s = setting(started(), SAVAGE_LAND);
    const deck = s.player.deck.length;
    s = settle(native(s, { type: "db:special", playerId: "p1" }));
    expect(s.player.deck.length).toBe(deck - 3);
    s = setting(s, GENOSHA);
    const threat = s.scheme.threat;
    s = settle(native(s, { type: "db:special", playerId: "p1" }));
    expect(s.scheme.threat).toBe(threat + 1);
    s = setting(s, BLUE_AREA);
    const hp = s.player.hp;
    s = settle(native(s, { type: "db:special", playerId: "p1" }));
    expect(s.player.hp).toBe(hp - 1);
  });

  it("when Dark Beast attacks you, the Setting's Special resolves for you first", () => {
    let s = setting(started(), GENOSHA);
    const threat = s.scheme.threat;
    s = settle(native(s, attack(s.villain.id)));
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 1);
  });

  it("a revealed Setting discards each other Setting in play", () => {
    let s = setting(started(), SAVAGE_LAND);
    s = settle(resolveEncounter(reveal(s, GENOSHA)));
    expect((s.environments || []).map((p) => p.code)).toContain(GENOSHA);
    expect((s.environments || []).map((p) => p.code)).not.toContain(
      SAVAGE_LAND,
    );
    expect(s.encounter.discard.map((p) => p.code)).toContain(SAVAGE_LAND);
  });

  it("the Settings' constant abilities: retaliate 1, steady and guard", () => {
    // The Savage Land: attacking Dark Beast costs 1 damage.
    let s = untough(setting(started(), SAVAGE_LAND));
    let hp = s.player.hp;
    s = settle(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.hp).toBe(hp - 1);
    // Genosha: no retaliate, and he can hold two stunned status cards.
    s = untough(setting(s, GENOSHA));
    s.player.exhausted = false;
    s = reload(s);
    hp = s.player.hp;
    s = settle(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.hp).toBe(hp);
    for (let i = 0; i < 2; i++)
      s = settle(
        native(s, { type: "status", target: s.villain.id, status: "stunned" }),
      );
    expect(s.villain.stunCards).toBe(2);
    // Blue Area of the Moon: each minion gains guard.
    s = setting(s, BLUE_AREA);
    minion(s, "45128");
    s = reload(s);
    expect(targets(s, "enemy", true).map((t) => t.id)).not.toContain(
      s.villain.id,
    );
  });

  it("Dark Beast (II) reveals another Setting and deals each player an encounter card", () => {
    let s = untough(started());
    const first = darkBeastSetting(s)!.code;
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.villain.code).toBe("45119");
    const second = darkBeastSetting(s);
    expect(second).toBeTruthy();
    expect(second!.code).not.toBe(first);
    expect(s.darkBeast!.setAside).toHaveLength(1);
    expect(s.encounter.dealt).toHaveLength(1);
  });
});

describe("Dark Beast encounter cards", () => {
  it("Cruel Experiment rides the next minion discarded with 2 hit points and guard", () => {
    let s = setting(started(), GENOSHA);
    const pool = s.encounter.deck.filter((p) => card(p).type_code === "minion");
    expect(pool.length).toBeGreaterThan(0);
    s = settle(resolveEncounter(reveal(s, "45124")));
    const cruel = s.attachments.find((a) => a.code === "45124");
    expect(cruel).toBeTruthy();
    const host = s.minions.find((m) => m.id === cruel!.attachedTo)!;
    expect(host).toBeTruthy();
    expect(pieceHP(s, host)).toBe((card(host).health || 0) + 2);
    if (host.engagedWith === "p1")
      expect(targets(s, "enemy", true).map((t) => t.id)).not.toContain(
        s.villain.id,
      );
  });

  it("Evil Genius: in alter-ego Dark Beast schemes and gets a tough status card", () => {
    let s = untough(started());
    s.player.form = "alter";
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, "45125")));
    expect(s.villain.tough).toBe(true);
    expect(s.scheme.threat).toBeGreaterThan(threat);
  });

  it("Evil Genius: in hero form Dark Beast attacks you with an additional boost card", () => {
    let s = untough(started());
    // Two cards without boost abilities on top of the encounter deck.
    const plain = s.encounter.deck.filter(
      (p) => !card(p).boost_star && card(p).type_code !== "minion",
    );
    expect(plain.length).toBeGreaterThanOrEqual(2);
    s.encounter.deck = [
      ...plain.slice(0, 2),
      ...s.encounter.deck.filter((p) => !plain.slice(0, 2).includes(p)),
    ];
    delete s.encounter.knownTop;
    const genius = take(s, "45125");
    s = reload(s);
    const deck = s.encounter.deck.length;
    s = settle(
      resolveEncounter(
        native(s, { type: "reveal", piece: genius, actorId: "p1" }),
      ),
    );
    // The normal boost card and Evil Genius' additional one.
    expect(s.encounter.deck.length).toBe(deck - 2);
    expect(s.flags.darkBeastExtraBoost).toBeUndefined();
  });

  it("Time-Travel Shenanigans: its defeater reveals the next card from the Setting's set", () => {
    let s = setting(started(), GENOSHA);
    // Put the rest of the Genosha set into the deck.
    for (const g of s.darkBeast!.setAside.filter((x) => x.set === "genosha"))
      s.encounter.deck.push(...g.pieces.filter((p) => p.code !== GENOSHA));
    s.darkBeast!.setAside = s.darkBeast!.setAside.filter(
      (x) => x.set !== "genosha",
    );
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, "45126")));
    const scheme = s.sideSchemes.find((p) => p.code === "45126")!;
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: scheme.counters,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    const revealed = [...s.minions, ...s.sideSchemes, ...s.attachments].some(
      (p) => card(p).set_code === "genosha",
    );
    expect(revealed).toBe(true);
  });

  it("Pterosaur's When Revealed and Giant Ape's When Defeated resolve the Special", () => {
    let s = setting(started(), GENOSHA);
    let threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, "45128")));
    expect(s.scheme.threat).toBe(threat + 1);
    const ape = minion(s, "45130");
    s = reload(s);
    threat = s.scheme.threat;
    s = settle(native(s, hit(ape.id, 20)));
    expect(s.scheme.threat).toBe(threat + 1);
  });

  it("Velociraptor gets +1 ATK for each resource icon on the card it discards", () => {
    let s = started();
    const raptor = minion(s, "45129");
    // Two printed resources on top of the deck.
    const i = s.player.deck.findIndex(
      (p) =>
        Number(card(p).resource_energy || 0) +
          Number(card(p).resource_mental || 0) +
          Number(card(p).resource_physical || 0) +
          Number(card(p).resource_wild || 0) ===
        2,
    );
    expect(i).toBeGreaterThanOrEqual(0);
    s.player.deck.unshift(...s.player.deck.splice(i, 1));
    s = reload(s);
    const hp = s.player.hp;
    s = settle(native(s, attack(raptor.id)));
    // ATK 1, +2 for the discarded card's two resource icons.
    expect(hp - s.player.hp).toBe(3);
  });

  it("Land Out of Time: with The Savage Land its Special and indirect damage; otherwise The Savage Land is revealed", () => {
    // The Savage Land was revealed earlier and replaced by Genosha.
    let s = setting(setting(started(), SAVAGE_LAND), GENOSHA);
    s = settle(resolveEncounter(reveal(s, "45131")));
    expect(darkBeastSetting(s)?.code).toBe(SAVAGE_LAND);
    const deck = s.player.deck.length;
    s = settle(resolveEncounter(reveal(s, "45131")));
    expect(s.player.deck.length).toBe(deck - 3);
  });

  it("Magistrate's When Defeated attaches Escaped Mutant to its defeater, whose Alter-Ego Action resolves the Special", () => {
    let s = setting(started(), GENOSHA);
    const magistrate = minion(s, "45134");
    s = reload(s);
    s = settle(native(s, hit(magistrate.id, 20, "hero:p1")));
    expect(escapedMutantHolder(s)).toBe("p1");
    s.player.form = "alter";
    s = reload(s);
    const mutant = s.attachments.find((a) => a.code === "45137")!;
    const threat = s.scheme.threat;
    s = settle(
      command(s, { type: "ABILITY", id: mutant.id, action: "special" }),
    );
    expect(s.scheme.threat).toBe(threat + 1);
    expect(s.attachments.some((a) => a.id === mutant.id)).toBe(false);
  });

  it("Oracle confuses you, and resolves the Special if you already were", () => {
    let s = setting(started(), GENOSHA);
    s = settle(resolveEncounter(reveal(s, "45141")));
    expect(s.player.confused).toBe(true);
    // Return it to the encounter deck and reveal it again while confused.
    const oracle = s.minions.find((m) => m.code === "45141")!;
    s.minions = s.minions.filter((m) => m.id !== oracle.id);
    s.encounter.deck.unshift(oracle);
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, "45141")));
    expect(s.scheme.threat).toBe(threat + 1);
  });

  it("Imperial Guardsman: +4 hit points, the Imperial Guard trait, and the Special when its minion is defeated", () => {
    let s = setting(started(), GENOSHA);
    const ape = minion(s, "45130");
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, "45145")));
    const host = s.minions.find((m) => m.id === ape.id)!;
    expect(pieceHP(s, host)).toBe(5 + 4);
    const threat = s.scheme.threat;
    s = settle(native(s, hit(ape.id, 20)));
    // Giant Ape and the Guardsman each resolve the Special.
    expect(s.scheme.threat).toBe(threat + 2);
  });

  it("Gladiator cannot take damage while Trial by Combat is in play", () => {
    let s = started();
    const gladiator = minion(s, "45140");
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, "45146")));
    s = settle(native(s, hit(gladiator.id, 3)));
    expect(s.minions.find((m) => m.id === gladiator.id)!.damage).toBe(0);
  });

  it("High-Tech Goggles' Hero Action exhausts your hero, resolves the Special and discards it", () => {
    let s = setting(started(), GENOSHA);
    s = settle(resolveEncounter(reveal(s, "45122")));
    const goggles = s.attachments.find((a) => a.code === "45122")!;
    expect(goggles.attachedTo).toBe(s.villain.id);
    const threat = s.scheme.threat;
    s = settle(
      command(s, { type: "ABILITY", id: goggles.id, action: "special" }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.scheme.threat).toBe(threat + 1);
    expect(s.attachments.some((a) => a.id === goggles.id)).toBe(false);
  });

  it("in another scenario each chosen set's Setting begins the game in play", () => {
    const s = opened("standard", 1, "rhino", ["savage_land"]);
    expect((s.environments || []).map((p) => p.code)).toContain(SAVAGE_LAND);
    expect(s.encounter.deck.map((p) => p.code)).not.toContain(SAVAGE_LAND);
  });
});
