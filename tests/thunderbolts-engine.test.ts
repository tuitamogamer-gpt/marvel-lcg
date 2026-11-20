/** Agents of S.H.I.E.L.D.: Thunderbolts with the six Elite Thunderbolt
 * modular sets, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  heroStats,
  scenarioModules,
} from "../src/game/cards";
import {
  abilityOptions,
  enemyStats,
  makePiece,
  newGame,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  ELITE_THUNDERBOLT_CODES,
  THUNDERBOLTS_CODES,
  THUNDERBOLTS_MODULAR_SETS,
  backupMinion,
  thunderboltsAdditionalBoosts,
  thunderboltsKeyword,
  thunderboltsLosesStalwart,
} from "../src/game/thunderbolts";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
// Captain Marvel first: Spider-Man's Spider-Sense would draw the card a
// test puts on top of the deck when an enemy attacks.
const team: Seat[] = [
  { heroId: "captain_marvel", aspect: "aggression" },
  { heroId: "spider_man", aspect: "justice" },
];
const APPREHENDING = "50130b";
const BACKUP = "50131b";
const SWORD = "50132";
const JOLT = "50133";
const BYSTANDERS = "50134";
const COMING_STORM = "50135";
const DOWN_NOT_OUT = "50137";
const TAP_IN = "50138";
const MOONSTONE = "50139";
const RULE_THE_SKIES = "50140";
const GRAVITATIONAL_PULL = "50141";
const MANIPULATION = "50142";
const SONGBIRD = "50143";
const CONSTRUCTS = "50144";
const BINDINGS = "50145";
const SONIC_BUBBLE = "50146";
const WIDOW = "50148";
const HANDSPRING = "50149";
const PRIDE = "50150";
const RADIOACTIVE_MAN = "50152";
const EXPOSURE = "50153";
const RUNAWAY = "50154";
const MACH_IV = "50156";
const BLASTERS = "50157";
const MISSILES = "50158";
const DOGFIGHT = "50159";
const BATROC = "50161";
const COUP = "50162";
const LEAPER = "50163";
const PARCOURS = "50164";
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "thunderbolts",
  modules?: string[],
  heroes: Seat[] = team,
) {
  return newGame({
    heroId: heroes[0].heroId,
    aspect: heroes[0].aspect,
    villainId,
    difficulty,
    seed: 50129,
    pacing: "expert",
    heroes: heroes.slice(0, players),
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
  villainId = "thunderbolts",
  modules?: string[],
  heroes: Seat[] = team,
) {
  let s = settle(setup(difficulty, players, villainId, modules, heroes));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "thunderbolts",
  modules?: string[],
  heroes: Seat[] = team,
) {
  const s = opened(difficulty, players, villainId, modules, heroes);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return reload(s);
}
/** An original encounter card from any encounter zone, set aside or in
 * play. */
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.thunderbolts?.aside || [],
    s.minions,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) {
      const [p] = zone.splice(i, 1);
      delete p.thunderboltBackup;
      delete p.engagedWith;
      return p;
    }
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
/** A minion of the code put into play engaged with a player. */
function minion(s: GameState, code: string, playerId = "p1") {
  const p = take(s, code);
  p.engagedWith = playerId;
  p.tough = false;
  p.toughCards = 0;
  p.damage = 0;
  s.minions.push(p);
  return p;
}
/** Every minion back into the encounter deck, so a test controls the
 * board. */
function clean(s: GameState) {
  for (const p of s.minions.splice(0)) {
    delete p.thunderboltBackup;
    delete p.engagedWith;
    p.damage = 0;
    s.encounter.deck.push(p);
  }
  s.encounter.deck.push(...(s.thunderbolts?.aside.splice(0) || []));
  return reload(s);
}
const hit = (
  target: string,
  amount: number,
  source = "hero",
  attack = false,
): Effect => ({
  type: "damage",
  target,
  amount,
  source,
  ...(attack ? { attack: true } : {}),
});
const sideScheme = (s: GameState, code: string) =>
  s.sideSchemes.find((p) => p.code === code);
const inPlay = (s: GameState, code: string) =>
  s.minions.find((p) => p.code === code);
const attachment = (s: GameState, code: string) =>
  s.attachments.find((p) => p.code === code);
/** Move player cards with these printed resources into the first player's
 * hand. */
function handOf(s: GameState, resource: "physical" | "energy", n: number) {
  const view = s.player;
  const picked: Piece[] = [];
  for (const p of [...view.deck]) {
    const c = card(p);
    if ((c[`resource_${resource}`] || 0) >= 1 && !c.resource_wild) {
      picked.push(p);
      view.deck.splice(view.deck.indexOf(p), 1);
      if (picked.length === n) break;
    }
  }
  expect(picked).toHaveLength(n);
  view.hand = picked;
  return picked;
}

describe("Thunderbolts: original source", () => {
  it("registers every face of the Thunderbolts set and the six Elite Thunderbolt sets", () => {
    const faces = (...sets: string[]) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aos" && sets.includes(c.set_code || ""),
      ).map((c) => c.code);
    expect(new Set(THUNDERBOLTS_CODES)).toEqual(new Set(faces("thunderbolts")));
    expect(new Set(ELITE_THUNDERBOLT_CODES)).toEqual(
      new Set(faces(...THUNDERBOLTS_MODULAR_SETS)),
    );
    for (const code of [...THUNDERBOLTS_CODES, ...ELITE_THUNDERBOLT_CODES])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(MODULES.slice(-6).map((m) => m.id)).toEqual([
      ...THUNDERBOLTS_MODULAR_SETS,
    ]);
    expect(scenarioModules("thunderbolts").map((m) => m.id)).toEqual([
      ...THUNDERBOLTS_MODULAR_SETS,
    ]);
    expect(VILLAINS.find((v) => v.id === "thunderbolts")).toMatchObject({
      codes: ["50129a", "50129b"],
      schemes: [APPREHENDING],
      moduleCount: 1,
      moduleCountPerHero: 1,
    });
  });

  it("Citizen V (A) with 12 hit points per player; each player reveals a set-aside Elite Thunderbolt and the remaining one is attached to Thunderbolt Backup", () => {
    for (const players of [1, 2]) {
      const s = opened("standard", players);
      expect(s.villain.code).toBe("50129a");
      expect(s.villain.hp).toBe(12 * players);
      expect(s.scheme.code).toBe(APPREHENDING);
      expect(s.scheme.threat).toBe(players);
      expect(s.modules).toHaveLength(1 + players);
      expect(s.environments?.some((p) => p.code === BACKUP)).toBe(true);
      const held = backupMinion(s)!;
      expect(held).toBeTruthy();
      expect(held.engagedWith).toBeUndefined();
      for (const seat of s.players)
        expect(
          s.minions.filter(
            (m) => m.engagedWith === seat.id && !m.thunderboltBackup,
          ),
        ).toHaveLength(1);
      expect(s.minions).toHaveLength(players + 1);
      expect(s.thunderbolts!.aside).toHaveLength(0);
    }
  });

  it("Expert: Citizen V (B) with 16 hit points per player, and each of those minions gets a tough status card", () => {
    const s = opened("expert", 2);
    expect(s.villain.code).toBe("50129b");
    expect(s.villain.hp).toBe(32);
    expect(s.minions).toHaveLength(3);
    for (const m of s.minions) expect(m.tough).toBe(true);
  });
});

describe("Thunderbolts", () => {
  it("Citizen V cannot be defeated until 1 Thunderbolt minion per player is in the victory display; then he is", () => {
    let s = started();
    const moonstone = s.minions.find((m) => !m.thunderboltBackup)!;
    s = settle(native(s, hit(s.villain.id, 60)));
    expect(s.phase).not.toBe("won");
    expect(s.villain.hp).toBe(0);
    s = settle(native(s, hit(moonstone.id, 30)));
    expect(s.victoryDisplay?.some((p) => p.id === moonstone.id)).toBe(true);
    expect(s.phase).toBe("won");
  });

  it("Citizen V does not activate against a player engaged with a Thunderbolt minion and heals instead", () => {
    let s = started();
    s.villain.hp = 5;
    s = settle(native(reload(s), { type: "villainActivate" }));
    expect(s.villain.hp).toBe(9);
    // Engaged with no Thunderbolt, he activates as usual.
    let t = clean(started());
    t.villain.hp = 5;
    const before = t.player.hp;
    t = settle(native(reload(t), { type: "villainActivate" }));
    expect(t.villain.hp).toBe(5);
    expect(t.player.hp).toBeLessThan(before);
  });

  it("each Thunderbolt minion has guard, and an attacked Thunderbolt minion engages the attacking player", () => {
    let s = started();
    const held = backupMinion(s)!;
    const engaged = s.minions.find((m) => !m.thunderboltBackup)!;
    expect(thunderboltsKeyword(s, engaged, "Guard")).toBe(1);
    s = settle(native(s, hit(held.id, 1, "hero", true)));
    const after = s.minions.find((m) => m.id === held.id)!;
    expect(after.thunderboltBackup).toBeFalsy();
    expect(after.engagedWith).toBe("p1");
    expect(backupMinion(s)).toBeUndefined();
  });

  it("Thunderbolt Backup: at the end of the round the most-damaged Thunderbolt swaps in and heals 1 per player, and the attached one engages its player", () => {
    let s = started();
    const held = backupMinion(s)!;
    const engaged = s.minions.find((m) => !m.thunderboltBackup)!;
    engaged.damage = 3;
    s = settle(native(reload(s), { type: "tb:backup-round" }));
    const swapped = s.minions.find((m) => m.id === engaged.id)!;
    expect(swapped.thunderboltBackup).toBe(true);
    expect(swapped.engagedWith).toBeUndefined();
    expect(swapped.damage).toBe(2);
    expect(s.minions.find((m) => m.id === held.id)?.engagedWith).toBe("p1");
    // The most-damaged minion is already attached: it stays and heals.
    swapped.damage = 4;
    s = settle(native(reload(s), { type: "tb:backup-round" }));
    expect(backupMinion(s)?.id).toBe(engaged.id);
    expect(backupMinion(s)?.damage).toBe(3);
  });

  it("Jolt: her Hero Action places parley counters and removes her from the game at 3; When Defeated, 3 threat on the main scheme", () => {
    let s = started();
    const jolt = minion(s, JOLT);
    s = reload(s);
    for (let i = 1; i <= 3; i++) {
      expect(
        abilityOptions(
          s,
          s.minions.find((m) => m.id === jolt.id)!,
        ),
      ).toHaveLength(1);
      s = settle(
        command(s, { type: "ABILITY", id: jolt.id, action: "parley" }),
      );
      expect(s.player.exhausted).toBe(true);
      s.player.exhausted = false;
      s = reload(s);
    }
    expect(s.minions.some((m) => m.id === jolt.id)).toBe(false);
    expect(s.removed.some((p) => p.id === jolt.id)).toBe(true);
    let t = started();
    const other = minion(t, JOLT);
    t = reload(t);
    const threat = t.scheme.threat;
    t = settle(native(t, hit(other.id, 10)));
    expect(t.scheme.threat).toBe(threat + 3);
  });

  it("Innocent Bystanders enters your play area with 4 counters; after you attack, you place threat or spend a resource and a counter comes off", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, BYSTANDERS)));
    const p = s.player.inPlay.find((q) => q.code === BYSTANDERS)!;
    expect(p.counters).toBe(4);
    const engaged = s.minions.find((m) => !m.thunderboltBackup)!;
    const threat = s.scheme.threat;
    s = settle(native(s, hit(engaged.id, 1, "hero", true)), (v) =>
      v.prompt?.options.some((o) => o.id === "threat") ? "threat" : undefined,
    );
    expect(s.scheme.threat).toBe(threat + 1);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.counters).toBe(3);
  });

  it("The Coming Storm: each player engages each minion engaged with the player clockwise from them", () => {
    let s = started("standard", 2);
    const p1 = s.minions.find((m) => m.engagedWith === "p1")!;
    const p2 = s.minions.find((m) => m.engagedWith === "p2")!;
    s = settle(resolveEncounter(reveal(s, COMING_STORM)));
    expect(s.minions.find((m) => m.id === p1.id)?.engagedWith).toBe("p2");
    expect(s.minions.find((m) => m.id === p2.id)?.engagedWith).toBe("p1");
    expect(sideScheme(s, COMING_STORM)?.counters).toBe(4);
  });

  it("Down but Not Out: a random Thunderbolt from the victory display returns with 5 hit points remaining and the card is removed from the game", () => {
    let s = started();
    const engaged = s.minions.find((m) => !m.thunderboltBackup)!;
    s = settle(native(s, hit(engaged.id, 30)));
    expect(s.victoryDisplay?.some((p) => p.id === engaged.id)).toBe(true);
    s = settle(resolveEncounter(reveal(s, DOWN_NOT_OUT)));
    const back = s.minions.find((m) => m.id === engaged.id)!;
    expect(back.engagedWith).toBe("p1");
    expect(card(back).health! - back.damage).toBe(5);
    expect(s.removed.filter((p) => p.code === DOWN_NOT_OUT)).toHaveLength(1);
    expect(s.victoryDisplay?.some((p) => p.id === engaged.id)).toBe(false);
  });

  it("Tap In: the least-damaged Thunderbolt not engaged with you engages you and activates; with none, Citizen V activates", () => {
    let s = started();
    const held = backupMinion(s)!;
    s = settle(resolveEncounter(reveal(s, TAP_IN)));
    expect(s.minions.find((m) => m.id === held.id)?.engagedWith).toBe("p1");
    expect(backupMinion(s)).toBeUndefined();
    let t = clean(started());
    const before = t.player.hp;
    t = settle(resolveEncounter(reveal(t, TAP_IN)));
    expect(t.player.hp).toBeLessThan(before);
  });

  it("Citizen V's Sword attaches to him and he activates against you; after you attack and damage him you may spend 2 physical to discard it", () => {
    // No guard minion stands in the way.
    let s = clean(started());
    const before = s.player.hp;
    s = settle(resolveEncounter(reveal(s, SWORD)));
    const sword = attachment(s, SWORD)!;
    expect(sword.attachedTo).toBe(s.villain.id);
    expect(s.player.hp).toBeLessThan(before);
    const pay = handOf(s, "physical", 2);
    s = reload(s);
    s = native(s, hit(s.villain.id, 2, "hero", true));
    for (
      let n = 0;
      n < 10 && !s.prompt?.options.some((o) => o.id === "discard");
      n++
    )
      s = choose(s, passId(s) || s.prompt!.options[0].id);
    s = choose(s, "discard");
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: pay.map((p) => p.id) });
    s = settle(s);
    expect(attachment(s, SWORD)).toBeUndefined();
  });

  it("Gravitational Pull finds Moonstone and she activates against you, then gets a tough status card; Rule the Skies gives each Aerial enemy +1 ATK", () => {
    let s = clean(started());
    s = settle(resolveEncounter(reveal(s, GRAVITATIONAL_PULL)));
    const moonstone = inPlay(s, MOONSTONE)!;
    expect(moonstone.engagedWith).toBe("p1");
    expect(moonstone.tough).toBe(true);
    const atk = enemyStats(s, moonstone).attack;
    s = settle(resolveEncounter(reveal(s, RULE_THE_SKIES)));
    expect(enemyStats(s, inPlay(s, MOONSTONE)!).attack).toBe(atk + 1);
  });

  it("Psychological Manipulation: in hero form X damage to the friendly character with the fewest hit points; in alter-ego form an ally or support is discarded", () => {
    let s = clean(started());
    const before = s.player.hp;
    const atk = heroStats(s).attack;
    s = settle(resolveEncounter(reveal(s, MANIPULATION)));
    expect(s.player.hp).toBe(before - atk);
    let t = clean(started());
    t.player.form = "alter";
    const ally = t.player.deck.find((p) => card(p).type_code === "ally")!;
    t.player.deck.splice(t.player.deck.indexOf(ally), 1);
    t.player.inPlay.push(ally);
    t = settle(resolveEncounter(reveal(reload(t), MANIPULATION)));
    expect(t.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(t.player.discard.some((p) => p.id === ally.id)).toBe(true);
    // A Permanent support cannot leave play: with nothing else to discard,
    // the card gains surge.
    let u = clean(started());
    u.player.form = "alter";
    const storm = makePiece(u, "36004");
    storm.ownerId = "p1";
    u.player.inPlay.push(storm);
    u = reload(u);
    const deck = u.encounter.deck.length;
    u = settle(resolveEncounter(reveal(u, MANIPULATION)));
    expect(u.player.inPlay.some((p) => p.id === storm.id)).toBe(true);
    expect(u.encounter.deck.length).toBeLessThan(deck - 1);
  });

  it("Songbird gets an additional boost card; Solid Sound Constructs takes away stalwart and is discarded instead of a stun", () => {
    let s = clean(started());
    const songbird = minion(s, SONGBIRD);
    s = reload(s);
    expect(thunderboltsAdditionalBoosts(s, songbird.id)).toBe(1);
    s = settle(resolveEncounter(reveal(s, CONSTRUCTS)));
    const constructs = attachment(s, CONSTRUCTS)!;
    expect(constructs.attachedTo).toBe(songbird.id);
    expect(thunderboltsLosesStalwart(s, inPlay(s, SONGBIRD)!)).toBe(true);
    s = settle(
      native(s, { type: "status", target: songbird.id, status: "stunned" }),
    );
    expect(inPlay(s, SONGBIRD)?.stunned).toBe(false);
    expect(attachment(s, CONSTRUCTS)).toBeUndefined();
  });

  it("Hard Sound Bindings is discarded instead of your attack and you are stunned; Sonic Bubble takes the damage to an enemy as threat", () => {
    let s = clean(started());
    const songbird = minion(s, SONGBIRD);
    s = settle(resolveEncounter(reveal(reload(s), BINDINGS)));
    expect(attachment(s, BINDINGS)?.attachedTo).toBe("hero:p1");
    s = settle(native(s, hit(songbird.id, 3, "hero", true)));
    expect(attachment(s, BINDINGS)).toBeUndefined();
    expect(s.player.stunned).toBe(true);
    expect(inPlay(s, SONGBIRD)?.damage).toBe(0);
    s = settle(resolveEncounter(reveal(s, SONIC_BUBBLE)));
    expect(sideScheme(s, SONIC_BUBBLE)?.counters).toBe(3);
    s = settle(native(s, hit(songbird.id, 2)));
    expect(sideScheme(s, SONIC_BUBBLE)?.counters).toBe(1);
    expect(inPlay(s, SONGBIRD)?.damage).toBe(0);
  });

  it("Black Widow attaches a Handspring after she schemes, which sends attack damage back to the attacker; Pride of the Red Room counts each Preparation", () => {
    let s = clean(
      started("standard", 1, "thunderbolts", [
        "pale_little_spider",
        "power_of_the_atom",
      ]),
    );
    s.player.form = "alter";
    const widow = minion(s, WIDOW);
    s = settle(
      native(reload(s), { type: "enemyScheme", id: widow.id, actorId: "p1" }),
    );
    const handspring = attachment(s, HANDSPRING)!;
    expect(handspring.attachedTo).toBe(widow.id);
    s.player.form = "hero";
    s = reload(s);
    const hp = s.player.hp;
    s = settle(native(s, hit(widow.id, 3, "hero", true)));
    expect(inPlay(s, WIDOW)?.damage).toBe(0);
    // The 3 damage comes back to the attacker, with Black Widow's
    // retaliate 1.
    expect(s.player.hp).toBe(hp - 4);
    expect(attachment(s, HANDSPRING)).toBeUndefined();
    s = settle(
      native(reload(s), { type: "enemyScheme", id: widow.id, actorId: "p1" }),
    );
    expect(attachment(s, HANDSPRING)).toBeTruthy();
    s = settle(resolveEncounter(reveal(s, PRIDE)));
    expect(sideScheme(s, PRIDE)?.counters).toBe(5);
  });

  it("Radioactive Man deals 1 damage to each of your characters after he activates; Radiation Exposure lowers ATK and THW until you recover and discard a card; Runaway Nuclear Reaction", () => {
    let s = clean(
      started("standard", 1, "thunderbolts", [
        "power_of_the_atom",
        "supersonic",
      ]),
    );
    s.player.form = "alter";
    const man = minion(s, RADIOACTIVE_MAN);
    const hp = s.player.hp;
    s = settle(
      native(reload(s), { type: "minionActivate", id: man.id, playerId: "p1" }),
    );
    expect(s.player.hp).toBe(hp - 1);
    const stats = heroStats(s);
    s = settle(resolveEncounter(reveal(s, EXPOSURE)));
    expect(attachment(s, EXPOSURE)?.attachedTo).toBe("hero:p1");
    expect(heroStats(s).attack).toBe(stats.attack - 1);
    expect(heroStats(s).thwart).toBe(stats.thwart - 1);
    s.player.hand = s.player.deck.splice(0, 2);
    s.player.exhausted = false;
    s = reload(s);
    s = settle(command(s, { type: "BASIC", action: "recover" }));
    expect(attachment(s, EXPOSURE)).toBeUndefined();
    expect(s.player.hand).toHaveLength(1);
    s = settle(resolveEncounter(reveal(s, RUNAWAY)));
    expect(sideScheme(s, RUNAWAY)?.counters).toBe(5);
    s = settle(native(s, hit(man.id, 4)));
    expect(sideScheme(s, RUNAWAY)?.counters).toBe(9);
    const villainHp = s.villain.hp;
    s = settle(native(s, hit(man.id, 1)));
    expect(sideScheme(s, RUNAWAY)).toBeUndefined();
    expect(s.villain.hp).toBe(villainHp - 10);
  });

  it("MACH-IV: no basic defense without the Aerial trait; Blasters, Heat-Seeking Missiles and Aerial Dogfight", () => {
    let s = clean(
      started("standard", 1, "thunderbolts", ["supersonic", "the_leaper"]),
    );
    const mach = minion(s, MACH_IV);
    s = native(reload(s), {
      type: "minionActivate",
      id: mach.id,
      playerId: "p1",
    });
    for (
      let n = 0;
      n < 10 && !s.prompt?.options.some((o) => o.id === "take");
      n++
    )
      s = choose(s, passId(s) || s.prompt!.options[0].id);
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(false);
    s = settle(s);
    s = settle(resolveEncounter(reveal(s, BLASTERS)));
    expect(attachment(s, BLASTERS)?.attachedTo).toBe(mach.id);
    expect(thunderboltsKeyword(s, inPlay(s, MACH_IV)!, "Overkill")).toBe(1);
    expect(thunderboltsKeyword(s, inPlay(s, MACH_IV)!, "Ranged")).toBe(1);
    s = settle(resolveEncounter(reveal(s, MISSILES)));
    expect(attachment(s, MISSILES)?.counters).toBe(4);
    const hp = s.player.hp;
    s = settle(
      native(s, { type: "minionActivate", id: mach.id, playerId: "p1" }),
    );
    expect(attachment(s, MISSILES)?.counters).toBe(3);
    expect(s.player.hp).toBeLessThan(hp - 1);
    s = settle(resolveEncounter(reveal(s, DOGFIGHT)));
    expect(sideScheme(s, DOGFIGHT)?.counters).toBe(5);
    const damage = inPlay(s, MACH_IV)!.damage;
    s = settle(native(s, hit(mach.id, 3, "hero", true)));
    expect(inPlay(s, MACH_IV)!.damage).toBe(damage + 1);
    s = settle(native(s, { ...hit(mach.id, 3, "hero", true), ranged: true }));
    expect(inPlay(s, MACH_IV)!.damage).toBe(damage + 4);
  });

  it("Batroc: you discard a card when he engages you; Coup de Foudre; Parcours du Combattant rotates engagements and surges", () => {
    let s = clean(
      started("standard", 1, "thunderbolts", ["the_leaper", "supersonic"]),
    );
    s.player.hand = s.player.deck.splice(0, 3);
    s = settle(resolveEncounter(reveal(reload(s), COUP)));
    expect(sideScheme(s, COUP)?.counters).toBe(5);
    const deck = s.player.deck.length;
    s = settle(resolveEncounter(reveal(s, LEAPER)));
    expect(inPlay(s, BATROC)?.engagedWith).toBe("p1");
    expect(s.player.hand.length).toBeLessThan(3);
    expect(s.player.deck.length).toBeLessThan(deck - 3);
    let t = started("standard", 2, "thunderbolts", [
      "the_leaper",
      "supersonic",
      "hard_sound",
    ]);
    const p1 = t.minions.find((m) => m.engagedWith === "p1")!;
    const p2 = t.minions.find((m) => m.engagedWith === "p2")!;
    t = settle(resolveEncounter(reveal(t, PARCOURS)));
    expect(t.minions.find((m) => m.id === p1.id)?.engagedWith).toBe("p2");
    expect(t.minions.find((m) => m.id === p2.id)?.engagedWith).toBe("p1");
  });

  it("the Elite Thunderbolt sets join another scenario: Gravitational Pull finds Moonstone in Rhino's encounter deck", () => {
    let s = started("standard", 1, "rhino", ["gravitational_pull"]);
    expect(s.thunderbolts).toBeUndefined();
    s = settle(resolveEncounter(reveal(s, GRAVITATIONAL_PULL)));
    expect(inPlay(s, MOONSTONE)?.engagedWith).toBe("p1");
    // Victory 1: Moonstone enters the victory display.
    // She got a tough status card after activating.
    const moonstone = inPlay(s, MOONSTONE)!;
    moonstone.tough = false;
    moonstone.toughCards = 0;
    s = settle(native(reload(s), hit(moonstone.id, 30)));
    expect(s.victoryDisplay?.some((p) => p.code === MOONSTONE)).toBe(true);
  });
});
