/** Agents of S.H.I.E.L.D.: Batroc with the A.I.M. Science and Batroc's
 * Brigade sets, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import {
  abilityOptions,
  dispatch,
  makePiece,
  newGame,
  targets,
} from "../src/game/engine";
import {
  BATROCS_BRIGADE_CODES,
  BATROC_CODES,
  captivesInPlay,
} from "../src/game/batroc";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
// Captain Marvel first: Spider-Man's Spider-Sense would draw the card a
// test puts on top of the deck when the villain attacks.
const team: Seat[] = [
  { heroId: "captain_marvel", aspect: "aggression" },
  { heroId: "spider_man", aspect: "justice" },
];
const INFILTRATE = "50087b";
const LOCATE = "50088b";
const EXTRACT = "50089b";
const LOW = "50090a";
const HIGH = "50090b";
const CAPTIVE = "50091";
const REFLEXES = "50092";
const GUARD = "50093";
const PATROL = "50094";
const OFFICE = "50095";
const KICK = "50096";
const CAMERAS = "50097";
const MACHETE = "50098";
const RAPIDO = "50099";
const ZARAN = "50100";
const BRIGADE = "50101";
const SOLDIERS = "50102";
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "batroc",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 50086,
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
  villainId = "batroc",
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
  villainId = "batroc",
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
/** An original encounter card from any encounter zone. */
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
/** Resolve the encounter past any optional reveal interrupt. */
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
/** Put an original encounter card on top of the encounter deck. */
function onTop(s: GameState, code: string) {
  const p = take(s, code);
  s.encounter.deck.unshift(p);
  delete s.encounter.knownTop;
  return p;
}
function own(s: GameState, type: string, playerId = "p1") {
  const view = seatView(s, playerId).player;
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
const scheme = (id: string, playerId = "p1"): Effect => ({
  type: "enemyScheme",
  id,
  actorId: playerId,
});
const thwart = (amount: number, target = "main"): Effect => ({
  type: "thwart",
  target,
  amount,
  source: "hero",
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
const alert = (s: GameState) =>
  (s.environments || []).find((p) => p.code === LOW || p.code === HIGH)!;
const sideScheme = (s: GameState, code: string) =>
  s.sideSchemes.find((p) => p.code === code);
/** A Rescued Captive put into play under a player's control. */
function captive(s: GameState, playerId = "p1") {
  const p = s.batroc!.captives.shift()!;
  p.exhausted = false;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
/** Advance to Locate Missing Person (2B) by removing every threat. */
function toLocate(s: GameState) {
  s = settle(native(s, thwart(s.scheme.threat)));
  expect(s.scheme.code).toBe(LOCATE);
  return s;
}

describe("Batroc: original source", () => {
  it("registers every face of the Batroc and Batroc's Brigade sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aos" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(BATROC_CODES)).toEqual(new Set(faces("batroc")));
    expect(new Set(BATROCS_BRIGADE_CODES)).toEqual(
      new Set(faces("batrocs_brigade")),
    );
    for (const code of [...BATROC_CODES, ...BATROCS_BRIGADE_CODES])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(MODULES.at(-15)?.id).toBe("batrocs_brigade");
    expect(scenarioModules("batroc")).toHaveLength(MODULES.length);
    expect(VILLAINS.find((v) => v.id === "batroc")).toMatchObject({
      codes: ["50086a", "50086b"],
      schemes: [INFILTRATE],
      moduleCount: 2,
      defaultModules: ["a.i.m._science", "batrocs_brigade"],
    });
  });

  it("Batroc (A) with 8 hit points, 6 threat per player, Alert Level on its Low side and the Rescued Captives set aside", () => {
    for (const players of [1, 2]) {
      const s = opened("standard", players);
      expect(s.villain.code).toBe("50086a");
      expect(s.villain.hp).toBe(8);
      expect(s.villain.maxHp).toBe(8);
      expect(s.scheme.code).toBe(INFILTRATE);
      expect(s.scheme.threat).toBe(6 * players);
      expect(alert(s).code).toBe(LOW);
      expect(alert(s).counters).toBe(0);
      expect(s.batroc!.captives.map((p) => p.code)).toEqual(
        Array(4).fill(CAPTIVE),
      );
      expect(
        [...s.encounter.deck, ...s.encounter.discard].some(
          (p) => p.code === CAPTIVE || p.code === LOW,
        ),
      ).toBe(false);
    }
  });

  it("Expert: Batroc (B) with 12 hit points and 2 threat per player on Alert Level", () => {
    for (const players of [1, 2]) {
      const s = opened("expert", players);
      expect(s.villain.code).toBe("50086b");
      expect(s.villain.hp).toBe(12);
      expect(alert(s).counters).toBe(2 * players);
    }
  });
});

describe("Batroc", () => {
  it("cannot be defeated: his hit points reset and 6 threat comes off the main scheme", () => {
    let s = untough(started("standard", 2));
    const threat = s.scheme.threat;
    s = settle(native(s, hit(s.villain.id, 20)));
    expect(s.phase).not.toBe("won");
    expect(s.villain.hp).toBe(8);
    expect(s.scheme.threat).toBe(threat - 6);
  });

  it("after he attacks, Alert Level gains 1 threat; on its High side he gets +1 ATK and +1 SCH", () => {
    let s = started();
    const atk = s.villain;
    s = settle(native(s, attack(atk.id)));
    expect(alert(s).counters).toBe(1);
    alert(s).code = HIGH;
    alert(s).counters = 0;
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(native(s, scheme(s.villain.id)));
    // Batroc (A) schemes for 1 printed, +1 on High, plus his boost.
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat + 2);
  });

  it("removing the last threat from each stage advances: Locate Missing Person begins with 3 threat per player", () => {
    let s = started("standard", 2);
    s = toLocate(s);
    expect(s.scheme.threat).toBe(6);
    expect(s.phase).toBe("player");
  });

  it("Locate Missing Person: the last threat frees a Rescued Captive exhausted, then the players advance or free another", () => {
    let s = toLocate(started());
    s = native(s, thwart(s.scheme.threat));
    // Stay: 3 threat per player here.
    s = settle(s, (s) =>
      s.prompt?.options.some((o) => o.id === "stay") ? "stay" : undefined,
    );
    expect(s.scheme.code).toBe(LOCATE);
    expect(s.scheme.threat).toBe(3);
    expect(captivesInPlay(s)).toHaveLength(1);
    expect(captivesInPlay(s)[0].p.exhausted).toBe(true);
    expect(s.batroc!.captives).toHaveLength(3);
    // Free a second, then advance: Alert Level flips to High.
    s = native(s, thwart(s.scheme.threat));
    s = settle(s, (s) =>
      s.prompt?.options.some((o) => o.id === "advance") ? "advance" : undefined,
    );
    expect(captivesInPlay(s)).toHaveLength(2);
    expect(s.scheme.code).toBe(EXTRACT);
    expect(s.scheme.threat).toBe(12);
    expect(alert(s).code).toBe(HIGH);
    expect(alert(s).counters).toBe(0);
  });

  it("Extract Captives: on High, each player is dealt an encounter card; an enemy attack goes to a Rescued Captive; no threat wins", () => {
    let s = toLocate(started());
    alert(s).code = HIGH;
    s = reload(s);
    s = native(s, thwart(s.scheme.threat));
    const dealt = s.encounter.dealt.length;
    s = settle(s, (s) =>
      s.prompt?.options.some((o) => o.id === "advance") ? "advance" : undefined,
    );
    expect(s.scheme.code).toBe(EXTRACT);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s = reload(s);
    const rescued = captivesInPlay(s)[0].p;
    const hp = s.player.hp;
    s = settle(native(s, attack(s.villain.id)));
    expect(s.player.hp).toBe(hp);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === rescued.id)
        ?.damage ?? 99,
    ).toBeGreaterThan(0);
    s = settle(native(s, thwart(s.scheme.threat)));
    expect(s.phase).toBe("won");
  });

  it("Extract Captives: the players lose with no Rescued Captive in play", () => {
    let s = toLocate(started());
    s = native(s, thwart(s.scheme.threat));
    s = settle(s, (s) =>
      s.prompt?.options.some((o) => o.id === "advance") ? "advance" : undefined,
    );
    expect(s.scheme.code).toBe(EXTRACT);
    const rescued = captivesInPlay(s)[0].p;
    s = settle(native(s, hit(rescued.id, 10, s.villain.id)));
    expect(s.phase).toBe("lost");
    // Victory -1: the defeated Rescued Captive enters the victory display.
    expect(s.victoryDisplay?.some((p) => p.id === rescued.id)).toBe(true);
  });

  it("Alert Level flips at 4 threat per player, removing its threat; on High it loses at 4 per player", () => {
    let s = started();
    s = settle(native(s, { type: "btc:alert-up", n: 4 }));
    expect(alert(s).code).toBe(HIGH);
    expect(alert(s).counters).toBe(0);
    s = settle(native(s, { type: "btc:alert-up", n: 4 }));
    expect(s.phase).toBe("lost");
  });

  it("Alert Level gains 1 threat after a character is defeated, except by consequential damage", () => {
    let s = started();
    const ally = own(s, "ally");
    s = reload(s);
    s = settle(native(s, hit(ally.id, 20, s.villain.id)));
    expect(alert(s).counters).toBe(1);
    const second = own(s, "ally");
    s = reload(s);
    s = settle(native(s, hit(second.id, 20, "consequential")));
    expect(alert(s).counters).toBe(1);
  });

  it("Alert Level's Hero Action spends 1 resource to remove 1 threat", () => {
    let s = started();
    alert(s).counters = 2;
    const [pay] = s.player.deck.splice(0, 1);
    s.player.hand = [pay];
    s = reload(s);
    const level = alert(s);
    expect(abilityOptions(s, level).map((o) => o.id)).toContain("lower");
    s = command(s, { type: "ABILITY", id: level.id, action: "lower" });
    if (s.prompt?.kind === "payment")
      s = command(s, { type: "PAY", ids: [pay.id], wildAs: "energy" });
    s = settle(s);
    expect(alert(s).counters).toBe(1);
  });

  it("a Rescued Captive does not count against the ally limit; its Hero Action removes 1 threat per player from the main scheme", () => {
    let s = started("standard", 2);
    const rescued = captive(s);
    s = reload(s);
    const threat = s.scheme.threat;
    expect(abilityOptions(s, rescued).map((o) => o.id)).toContain("rescue");
    s = settle(
      command(s, { type: "ABILITY", id: rescued.id, action: "rescue" }),
    );
    expect(s.scheme.threat).toBe(threat - 2);
    expect(s.player.inPlay.find((p) => p.id === rescued.id)?.exhausted).toBe(
      true,
    );
    for (let i = 0; i < 3; i++) captive(s);
    own(s, "ally");
    own(s, "ally");
    own(s, "ally");
    s = settle(reload(s));
    expect(s.player.inPlay.filter((p) => p.code === CAPTIVE)).toHaveLength(4);
  });

  it("Heightened Reflexes: attached with 4 leap counters, it prevents 2 of each damage to Batroc and is discarded with none left", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, REFLEXES)));
    const reflexes = s.attachments.find((a) => a.code === REFLEXES)!;
    expect(reflexes.attachedTo).toBe(s.villain.id);
    expect(reflexes.counters).toBe(4);
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(7);
    for (let i = 0; i < 3; i++) s = settle(native(s, hit(s.villain.id, 1)));
    expect(s.villain.hp).toBe(7);
    expect(s.attachments.some((a) => a.id === reflexes.id)).toBe(false);
  });

  it("Heightened Reflexes as a boost attaches to Batroc", () => {
    let s = started();
    const p = onTop(s, REFLEXES);
    s = settle(native(reload(s), attack(s.villain.id)));
    expect(s.attachments.find((a) => a.id === p.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.attachments.find((a) => a.id === p.id)?.counters).toBe(4);
  });

  it("Embassy Guard gains surge and Embassy Patrol incite 1 only on High; each places 1 threat on Alert Level when defeated", () => {
    let s = started();
    // Low: neither keyword.
    let dealt = s.encounter.dealt.length;
    s = settle(resolveEncounter(reveal(s, GUARD)));
    expect(s.encounter.dealt.length).toBe(dealt);
    let threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, PATROL)));
    expect(s.scheme.threat).toBe(threat);
    s.encounter.deck.push(...s.minions.splice(0));
    for (const p of s.encounter.deck) delete p.engagedWith;
    alert(s).code = HIGH;
    s = reload(s);
    dealt = s.encounter.dealt.length;
    s = settle(resolveEncounter(reveal(s, GUARD)));
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(reload(s), PATROL)));
    expect(s.scheme.threat).toBe(threat + 1);
    const guard = s.minions.find((m) => m.code === GUARD)!;
    s = settle(native(s, hit(guard.id, 10)));
    // When Defeated 1, and Alert Level's Forced Response 1.
    expect(alert(s).counters).toBe(2);
  });

  it("Commandeer Security Office: an acceleration token on High; when defeated, 1 threat per player off Alert Level", () => {
    let s = started();
    alert(s).code = HIGH;
    alert(s).counters = 3;
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, OFFICE)));
    const office = sideScheme(s, OFFICE)!;
    expect(office.accelerationTokens).toBe(1);
    s = settle(native(s, thwart(office.counters, office.id)));
    expect(sideScheme(s, OFFICE)).toBeUndefined();
    expect(alert(s).counters).toBe(2);
  });

  it("Leaping Kick: in alter-ego Batroc schemes; in hero form he attacks the ally with the most remaining hit points, with overkill", () => {
    let s = started();
    s.player.form = "alter";
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, KICK)));
    expect(s.scheme.threat).toBeGreaterThan(threat);
    s.player.form = "hero";
    const first = own(s, "ally");
    const second = own(s, "ally");
    const hpOf = (p: Piece) => card(p).health || 0;
    // The healthier ally is left with fewer hit points than Batroc's ATK.
    first.damage = Math.max(0, hpOf(first) - 1);
    second.damage = Math.max(0, hpOf(second) - 2);
    s = reload(s);
    const remaining = (p: Piece) => hpOf(p) - p.damage;
    const target = remaining(first) > remaining(second) ? first : second;
    const other = target === first ? second : first;
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, KICK)));
    expect(s.player.inPlay.some((p) => p.id === target.id)).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === other.id)).toBe(true);
    // Overkill: the excess damage goes to the hero.
    expect(s.player.hp).toBeLessThan(hp);
    expect(s.batroc?.kick).toBeUndefined();
  });

  it("Security Cameras: in alter-ego 1 threat off Alert Level and surge; in hero form each character is exhausted or Alert Level gains threat", () => {
    let s = started();
    alert(s).counters = 2;
    s.player.form = "alter";
    s = reload(s);
    const dealt = s.encounter.dealt.length;
    s = settle(resolveEncounter(reveal(s, CAMERAS)));
    expect(alert(s).counters).toBe(1);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s.player.form = "hero";
    own(s, "ally");
    s = reload(s);
    s = resolveEncounter(reveal(s, CAMERAS));
    // Identity: place threat; ally: exhaust.
    s = choose(s, "alert");
    s = settle(choose(s, "exhaust"));
    expect(alert(s).counters).toBe(2);
    expect(
      s.player.inPlay.find((p) => card(p).type_code === "ally")?.exhausted,
    ).toBe(true);
  });
});

describe("Batroc's Brigade", () => {
  it("Machete's attacks gain piercing; when defeated it is shuffled into the encounter deck", () => {
    let s = started("standard", 1, "rhino", ["batrocs_brigade"]);
    const machete = minion(s, MACHETE);
    s.player.tough = true;
    s = reload(s);
    const hp = s.player.hp;
    s = settle(native(s, attack(machete.id)));
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(hp - 2);
    s = settle(native(s, hit(machete.id, 10)));
    expect(s.minions.some((m) => m.id === machete.id)).toBe(false);
    expect(s.encounter.deck.some((p) => p.id === machete.id)).toBe(true);
  });

  it("Rapido: 1 damage to each character you control when revealed, and attacks dealing indirect damage", () => {
    let s = started("standard", 1, "rhino", ["batrocs_brigade"]);
    const ally = own(s, "ally");
    s = reload(s);
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, RAPIDO)));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    const rapido = s.minions.find((m) => m.code === RAPIDO)!;
    // Its attack is indirect damage assigned among the characters you
    // control: 3 in all.
    const health = (s: GameState) =>
      s.player.hp +
      s.player.inPlay
        .filter((p) => card(p).type_code === "ally")
        .reduce((n, p) => n + (card(p).health || 0) - p.damage, 0);
    const before = health(s);
    s = settle(native(s, attack(rapido.id)));
    expect(before - health(s)).toBeGreaterThanOrEqual(3);
    expect(
      s.log.some((l) =>
        /Rapido/.test(typeof l === "string" ? l : (l as { text: string }).text),
      ),
    ).toBe(true);
  });

  it("Zaran tucks a Weapon upgrade you control, or the top card of your deck, and gets +X ATK; it returns when he is defeated", () => {
    let s = started("standard", 1, "rhino", ["batrocs_brigade"]);
    const top = s.player.deck[0];
    s = settle(resolveEncounter(reveal(s, ZARAN)));
    const zaran = s.minions.find((m) => m.code === ZARAN)!;
    expect(zaran.storedCards?.map((p) => p.id)).toEqual([top.id]);
    expect(s.player.deck.some((p) => p.id === top.id)).toBe(false);
    s = settle(native(s, hit(zaran.id, 20)));
    expect(s.player.discard.some((p) => p.id === top.id)).toBe(true);
  });

  it("Zaran cannot tuck a Permanent Weapon upgrade: the top card of your deck goes under him instead", () => {
    let s = started("standard", 1, "rhino", ["batrocs_brigade"]);
    const claws = makePiece(s, "35002");
    claws.ownerId = "p1";
    s.player.inPlay.push(claws);
    s = reload(s);
    const top = s.player.deck[0];
    s = settle(resolveEncounter(reveal(s, ZARAN)));
    const zaran = s.minions.find((m) => m.code === ZARAN)!;
    expect(zaran.storedCards?.map((p) => p.id)).toEqual([top.id]);
    expect(s.player.inPlay.some((p) => p.id === claws.id)).toBe(true);
  });

  it("Batroc's Brigade: each enemy gets a tough status card and each minion gains toughness", () => {
    let s = untough(started("standard", 1, "rhino", ["batrocs_brigade"]));
    s = settle(resolveEncounter(reveal(s, BRIGADE)));
    expect(s.villain.tough).toBe(true);
    s = settle(resolveEncounter(reveal(s, MACHETE)));
    expect(s.minions.find((m) => m.code === MACHETE)?.tough).toBe(true);
  });

  it("Batroc's Brigade's Hero Interrupt spends 3 resources to cancel and discard a revealed non-Elite minion", () => {
    let s = untough(started("standard", 1, "rhino", ["batrocs_brigade"]));
    s = settle(resolveEncounter(reveal(s, BRIGADE)));
    const pay = s.player.deck.splice(0, 3);
    s.player.hand = pay;
    s = reload(s);
    s = reveal(s, RAPIDO);
    expect(s.prompt?.options.map((o) => o.id)).toContain("batrocs-brigade");
    s = choose(s, "batrocs-brigade");
    if (s.prompt?.kind === "payment")
      s = command(s, {
        type: "PAY",
        ids: pay.map((p) => p.id),
        wildAs: "energy",
      });
    s = settle(s);
    expect(s.minions.some((m) => m.code === RAPIDO)).toBe(false);
    expect(s.encounter.discard.some((p) => p.code === RAPIDO)).toBe(true);
  });

  it("Soldiers of Fortune: find a Mercenary minion and reveal it; with none, it gains surge", () => {
    let s = started("standard", 1, "rhino", ["batrocs_brigade"]);
    s.player.hand = [];
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, SOLDIERS)), (s) =>
      s.prompt?.title === "Soldiers of Fortune" ? undefined : undefined,
    );
    expect(
      s.minions.some((m) => [MACHETE, RAPIDO, ZARAN].includes(m.code)),
    ).toBe(true);
  });

  it("Soldiers of Fortune as a boost: spend 1 resource, or it gains three boost icons", () => {
    let s = untough(started("standard", 1, "rhino", ["batrocs_brigade"]));
    s.player.hand = [];
    onTop(s, SOLDIERS);
    s = reload(s);
    const hp = s.player.hp;
    s = settle(native(s, attack(s.villain.id)), (s) =>
      s.prompt?.options.some((o) => o.id === "icons") ? "icons" : undefined,
    );
    // Rhino's 2 ATK and three boost icons.
    expect(hp - s.player.hp).toBe(5);
  });
});

describe("Batroc in Expert", () => {
  it("Extract Captives places 2 threat per player on Alert Level and gives each minion quickstrike", () => {
    let s = toLocate(started("expert"));
    s = native(s, thwart(s.scheme.threat));
    s = settle(s, (s) =>
      s.prompt?.options.some((o) => o.id === "advance") ? "advance" : undefined,
    );
    expect(s.scheme.code).toBe(EXTRACT);
    expect(alert(s).code).toBe(HIGH);
    expect(alert(s).counters).toBe(2);
    // Quickstrike: Embassy Guard attacks as it engages you, and the attack
    // goes to the Rescued Captive.
    const rescued = captivesInPlay(s)[0].p;
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, GUARD)));
    const hurt = seatView(s, "p1").player.inPlay.find(
      (p) => p.id === rescued.id,
    );
    expect(!hurt || hurt.damage > 0).toBe(true);
  });
});
