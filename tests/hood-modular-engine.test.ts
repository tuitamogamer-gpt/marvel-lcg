/** The Hood scenario pack's nine modular encounter sets, exercised with the
 * original physical cards in an ordinary scenario. Every command crosses a
 * JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  heroStats,
  pieceHP,
} from "../src/game/cards";
import { enemyStats, newGame } from "../src/game/engine";
import { HOOD_MODULAR_CODES } from "../src/game/hood-modular";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

const SETS = [
  "beasty_boys",
  "brothers_grimm",
  "crossfire_crew",
  "mister_hyde",
  "ransacked_armory",
  "sinister_syndicate",
  "state_of_emergency",
  "streets_of_mayhem",
  "wrecking_crew_modular",
];
const team = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
];
function setup(module: string, players = 1, villainId = "rhino") {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty: "standard",
    seed: 24014,
    pacing: "expert",
    heroes: team.slice(0, players),
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
/** Started table: hands go back into the decks and every identity is a hero. */
function started(module: string, players = 1) {
  let s = settle(setup(module, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
const M = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `hoodmod:${type}`,
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
/** Put this player card from the player's deck into play. */
function ally(s: GameState, code: string, playerId = "p1"): Piece {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  expect(i, `ally ${code} in deck`).toBeGreaterThanOrEqual(0);
  const piece = p.deck.splice(i, 1)[0];
  p.inPlay.push(piece);
  return piece;
}
const minion = (s: GameState, code: string) =>
  s.minions.find((p) => p.code === code)!;
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
function minionAttack(s: GameState, code: string, playerId = "p1"): Effect {
  return { type: "enemyAttack", id: minion(s, code).id, actorId: playerId };
}
/** The first ally in this player's deck. */
const deckAlly = (s: GameState, playerId = "p1") =>
  seatView(s, playerId).player.deck.find((p) => card(p).type_code === "ally")!;

describe("The Hood modular sets: original source", () => {
  it("registers every face of the nine modular sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) => c.pack_code === "hood" && SETS.includes(c.set_code || ""),
    );
    expect(faces).toHaveLength(47);
    expect(new Set(HOOD_MODULAR_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(MODULES.filter((m) => SETS.includes(m.id))).toHaveLength(9);
    expect(VILLAINS.find((v) => v.id === "the_hood")).toMatchObject({
      module: "streets_of_mayhem",
      defaultModules: [
        "streets_of_mayhem",
        "brothers_grimm",
        "ransacked_armory",
        "state_of_emergency",
        "beasty_boys",
        "mister_hyde",
        "sinister_syndicate",
      ],
    });
  });
  it.each(SETS)(
    "builds the %s encounter set with its printed quantities",
    (set) => {
      const s = settle(setup(set));
      const expected = CATALOG_CARDS.filter((c) => c.set_code === set).reduce(
        (n, c) => n + (c.quantity || 1),
        0,
      );
      const all = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
        ...s.minions,
        ...s.sideSchemes,
        ...s.attachments,
        ...(s.environments || []),
      ];
      expect(all.filter((p) => card(p).set_code === set)).toHaveLength(
        expected,
      );
    },
  );
});

describe("Streets of Mayhem", () => {
  it("keeps one Setting in play and applies its constant effects", () => {
    let s = started("streets_of_mayhem");
    const atk = heroStats(s).attack;
    const rhinoAtk = enemyStats(s, s.villain).attack;
    s = settle(reveal(s, "24060"));
    expect((s.environments || []).map((p) => p.code)).toEqual(["24060"]);
    expect(heroStats(s).attack).toBe(atk + 1);
    expect(enemyStats(s, s.villain).attack).toBe(rhinoAtk + 1);
    s = settle(reveal(s, "24061"));
    // Back-Alley Enclave is discarded; Secret Lair adds THW and acceleration.
    expect((s.environments || []).map((p) => p.code)).toEqual(["24061"]);
    expect(s.encounter.discard.map((p) => p.code)).toContain("24060");
    expect(heroStats(s).attack).toBe(atk);
    s = settle(reveal(s, "24063"));
    expect((s.environments || []).map((p) => p.code)).toEqual(["24063"]);
    // Warehouse District: a steady hero is stunned only with two stun cards.
    s = settle(
      native(s, { type: "status", target: "hero", status: "stunned" }),
    );
    expect(s.player.stunCards).toBe(1);
    expect(s.player.stunned).toBe(false);
    s = settle(
      native(s, { type: "status", target: "hero", status: "stunned" }),
    );
    expect(s.player.stunCards).toBe(2);
    expect(s.player.stunned).toBe(true);
  });
  it("Secret Lair gives each enemy an acceleration icon and heroes and allies +1 THW", () => {
    let s = started("streets_of_mayhem");
    const thw = heroStats(s).thwart;
    s = settle(reveal(s, "24061"));
    expect(heroStats(s).thwart).toBe(thw + 1);
    s.player.form = "alter";
    const threat = s.scheme.threat;
    s = settle(native(s, { type: "villainStepOne" }));
    // 1 threat per player plus one acceleration icon for Rhino.
    expect(s.scheme.threat - threat).toBeGreaterThanOrEqual(2);
  });
  it("Sewer Tunnels gives the hero retaliate 1 against an attacking enemy", () => {
    let s = started("streets_of_mayhem");
    s = settle(reveal(s, "24062"));
    const hp = s.villain.hp;
    s = settle(native(s, villainAttack(s)));
    expect(s.villain.hp).toBe(hp - 1);
  });
  it("each Setting surges", () => {
    let s = started("streets_of_mayhem");
    const deck = s.encounter.deck.length;
    s = settle(reveal(s, "24062"));
    // Its surge revealed another encounter card.
    expect(s.encounter.deck.length).toBeLessThan(deck - 1);
  });
});

describe("Beasty Boys", () => {
  it("Mandrill confuses each character you control and retaliates for each confused character", () => {
    let s = started("beasty_boys");
    const friend = ally(s, deckAlly(s).code);
    s = settle(reveal(s, "24016"));
    expect(s.player.confused).toBe(true);
    const mandrill = minion(s, "24016");
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === friend.id)?.confused,
    ).toBe(true);
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: mandrill.id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    // Retaliate 2: the confused hero and the confused ally.
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Double Trouble stuns and confuses a character you control", () => {
    let s = started("beasty_boys");
    s = settle(reveal(s, "24017"));
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
  });
  it("Beast Mode adds 1 to damage a stunned or confused friendly character takes", () => {
    let s = started("beasty_boys");
    s = settle(reveal(s, "24014"));
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 1,
        source: "encounter",
      }),
    );
    expect(s.player.hp).toBe(hp - 1);
    s = settle(
      native(s, { type: "status", target: "hero", status: "confused" }),
    );
    s = settle(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 1,
        source: "encounter",
      }),
    );
    expect(s.player.hp).toBe(hp - 3);
  });
  it("Griffin's Quickstrike attack stuns the damaged hero, and he returns to the deck while a friendly character is stunned", () => {
    let s = started("beasty_boys");
    const hp = s.player.hp;
    s = settle(reveal(s, "24015"));
    const griffin = minion(s, "24015");
    expect(s.player.hp).toBe(hp - 3);
    expect(s.player.stunned).toBe(true);
    s = settle(
      native(s, {
        type: "damage",
        target: griffin.id,
        amount: 7,
        source: "hero",
      }),
    );
    expect(s.minions.some((p) => p.id === griffin.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === griffin.id)).toBe(false);
    expect(s.encounter.deck.some((p) => p.id === griffin.id)).toBe(true);
  });
});

describe("Brothers Grimm", () => {
  it("Brothers Grimm discards until an attachment, which attaches to him, and the item responds after his activation", () => {
    let s = started("brothers_grimm");
    s = settle(reveal(s, "24018"));
    const grimm = minion(s, "24018");
    stack(s, "24021");
    const filler = s.encounter.deck.find(
      (p) => card(p).type_code !== "attachment",
    );
    if (filler) {
      s.encounter.deck = [
        filler,
        ...s.encounter.deck.filter((p) => p !== filler),
      ];
    }
    const dealt = s.encounter.dealt.length;
    s = settle(native(s, minionAttack(s, "24018")));
    // Paralytic Stardust attached to the Mystic minion, then discarded itself
    // after his activation: the hero is stunned and dealt a card.
    expect(s.attachments.some((p) => p.code === "24021")).toBe(false);
    expect(s.encounter.discard.map((p) => p.code)).toContain("24021");
    expect(s.player.stunned).toBe(true);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    expect(s.minions.some((p) => p.id === grimm.id)).toBe(true);
  });
  it("an item attaches to the villain without a Mystic minion and responds after his activation", () => {
    let s = started("brothers_grimm");
    seatView(s, "p1").player.hand.push(
      ...seatView(s, "p1").player.deck.splice(0, 3),
    );
    s = settle(reveal(s, "24019"));
    expect(s.attachments.find((p) => p.code === "24019")?.attachedTo).toBe(
      s.villain.id,
    );
    // Spider-Sense draws a card when the villain attacks; Blackbird Pellets
    // discards one at random.
    const discard = s.player.discard.length;
    const dealt = s.encounter.dealt.length;
    s = settle(native(s, villainAttack(s)));
    expect(s.attachments.some((p) => p.code === "24019")).toBe(false);
    expect(s.player.discard.length).toBe(discard + 1);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
  });
  it("as a boost, Brothers Grimm enters play engaged with the first player after the activation", () => {
    let s = started("brothers_grimm");
    stack(s, "24018");
    s = settle(native(s, villainAttack(s)));
    const grimm = minion(s, "24018");
    expect(grimm?.engagedWith).toBe(s.firstPlayerId);
    expect(s.encounter.discard.some((p) => p.code === "24018")).toBe(false);
  });
});

describe("Crossfire's Crew", () => {
  it("Out for Blood damages the weakest friendly character and repeats when it is defeated", () => {
    let s = started("crossfire_crew");
    const friend = ally(s, deckAlly(s).code);
    friend.damage = pieceHP(s, friend) - 1;
    const hp = s.player.hp;
    s = settle(reveal(s, "24023"));
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === friend.id),
    ).toBe(false);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.sideSchemes.map((p) => p.code)).toContain("24023");
  });
  it("Controller's attack adds the damaged character's ATK", () => {
    let s = started("crossfire_crew");
    s = settle(reveal(s, "24024"));
    const hp = s.player.hp;
    const atk = heroStats(s).attack;
    s = settle(native(s, minionAttack(s, "24024")));
    expect(s.player.hp).toBe(hp - 1 - atk);
  });
  it("Corruptor exhausts each ally you control and places 1 threat for each", () => {
    let s = started("crossfire_crew");
    const allies = seatView(s, "p1")
      .player.deck.filter((p) => card(p).type_code === "ally")
      .slice(0, 2)
      .map((p) => ally(s, p.code));
    const threat = s.scheme.threat;
    s = settle(reveal(s, "24025"));
    for (const a of allies)
      expect(
        seatView(s, "p1").player.inPlay.find((p) => p.id === a.id)?.exhausted,
      ).toBe(true);
    expect(s.scheme.threat).toBe(threat + allies.length);
  });
  it("Crossfire attacks the friendly character with the fewest remaining hit points", () => {
    let s = started("crossfire_crew");
    const friend = ally(s, deckAlly(s).code);
    friend.damage = pieceHP(s, friend) - 2;
    const hp = s.player.hp;
    // Quickstrike: he attacks when he enters play engaged with a hero.
    s = settle(reveal(s, "24026"));
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === friend.id),
    ).toBe(false);
    expect(s.player.hp).toBe(hp);
  });
  it("Crossfire's overkill deals the excess damage from his attack on an ally to its controller", () => {
    let s = started("crossfire_crew");
    const friend = ally(s, deckAlly(s).code);
    friend.damage = pieceHP(s, friend) - 1;
    const hp = s.player.hp;
    s = settle(reveal(s, "24026"));
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === friend.id),
    ).toBe(false);
    expect(s.player.hp).toBe(hp - 1);
  });
  it("Mister Fear makes the engaged player spend a mental resource to ready", () => {
    let s = started("crossfire_crew");
    s = settle(reveal(s, "24027"));
    const mental = s.player.deck.find(
      (p) => card(p).resource_mental && !card(p).resource_wild,
    )!;
    s.player.deck = s.player.deck.filter((p) => p !== mental);
    s.player.hand.push(mental);
    s.player.exhausted = true;
    s = native(s, { type: "ready", target: "hero", actorId: "p1" });
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: [mental.id] });
    s = settle(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === mental.id)).toBe(true);
  });
  it("Caught in the Crossfire reveals a Crossfire's Crew minion and deals indirect damage for each", () => {
    let s = started("crossfire_crew");
    stack(s, "24027");
    const hp = s.player.hp;
    s = settle(reveal(s, "24028"));
    expect(s.minions.map((p) => p.code)).toContain("24027");
    expect(s.player.hp).toBe(hp - 1);
  });
});

describe("Mister Hyde", () => {
  it("Self-Experimentation reveals Mister Hyde, and damage to a Brute removes its threat instead", () => {
    let s = started("mister_hyde");
    const hp = s.player.hp;
    s = settle(reveal(s, "24033"));
    const hyde = minion(s, "24035");
    expect(hyde.tough).toBe(true);
    expect(s.player.hp).toBe(hp - 1);
    const scheme = s.sideSchemes.find((p) => p.code === "24033")!;
    const threat = scheme.counters;
    s = settle(
      native(s, { type: "damage", target: hyde.id, amount: 3, source: "hero" }),
    );
    expect(s.sideSchemes.find((p) => p.code === "24033")?.counters).toBe(
      threat - 3,
    );
    expect(minion(s, "24035").damage).toBe(0);
    expect(minion(s, "24035").tough).toBe(true);
  });
  it("Self-Experimentation without threat no longer replaces damage to a Brute", () => {
    let s = started("mister_hyde");
    s = settle(reveal(s, "24033"));
    const hyde = minion(s, "24035");
    hyde.tough = false;
    s.sideSchemes.find((p) => p.code === "24033")!.counters = 0;
    s = settle(
      native(s, { type: "damage", target: hyde.id, amount: 3, source: "hero" }),
    );
    expect(minion(s, "24035").damage).toBe(3);
  });
  it("Calvin Zabo with Mister Hyde in play is discarded and Hyde attacks with +2 ATK", () => {
    let s = started("mister_hyde");
    s = settle(reveal(s, "24035"));
    const hp = s.player.hp;
    s = settle(reveal(s, "24034"));
    expect(s.minions.some((p) => p.code === "24034")).toBe(false);
    expect(s.encounter.discard.map((p) => p.code)).toContain("24034");
    expect(s.player.hp).toBe(hp - 5);
  });
  it("a defeated Calvin Zabo brings Mister Hyde into play engaged with his player", () => {
    let s = started("mister_hyde");
    s = settle(reveal(s, "24034"));
    const zabo = minion(s, "24034");
    s = settle(
      native(s, { type: "damage", target: zabo.id, amount: 4, source: "hero" }),
    );
    expect(minion(s, "24035")?.engagedWith).toBe("p1");
    // Put into play, not revealed: no tough status card.
    expect(minion(s, "24035").tough).toBeFalsy();
  });
  it("Mister Hyde replaces an engaged Calvin Zabo, gains tough and damages each hero and ally", () => {
    let s = settle(setup("mister_hyde", 2));
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    for (const seat of s.players) seatView(s, seat).player.form = "hero";
    s = settle(reveal(s, "24034", "p2"));
    expect(minion(s, "24034").engagedWith).toBe("p2");
    const hp = [seatView(s, "p1").player.hp, seatView(s, "p2").player.hp];
    s = settle(reveal(s, "24035", "p1"));
    expect(s.minions.some((p) => p.code === "24034")).toBe(false);
    expect(minion(s, "24035")).toMatchObject({
      engagedWith: "p2",
      tough: true,
    });
    expect([seatView(s, "p1").player.hp, seatView(s, "p2").player.hp]).toEqual([
      hp[0] - 1,
      hp[1] - 1,
    ]);
  });
  it("Hyde Formula: Zabo schemes with +3 SCH and takes 4 damage; Hyde then gains tough and attacks", () => {
    let s = started("mister_hyde");
    s = settle(reveal(s, "24036"));
    // Neither is in play: it surges.
    expect(s.encounter.discard.map((p) => p.code)).toContain("24036");
    s = started("mister_hyde");
    s = settle(reveal(s, "24034"));
    const threat = s.scheme.threat;
    const hp = s.player.hp;
    s = settle(reveal(s, "24036"));
    expect(s.scheme.threat).toBe(threat + 6);
    // Zabo was defeated by 4 damage and brought Hyde, who then attacked.
    expect(s.minions.some((p) => p.code === "24034")).toBe(false);
    expect(minion(s, "24035")).toMatchObject({
      engagedWith: "p1",
      tough: true,
    });
    expect(s.player.hp).toBe(hp - 3);
  });
});

describe("Ransacked Armory", () => {
  it("Flamethrower attaches to the minion with the most hit points and its attacks deal indirect damage", () => {
    let s = started("ransacked_armory");
    s = settle(reveal(s, "24041"));
    const guard = minion(s, "24041");
    s = settle(reveal(s, "24037"));
    expect(s.attachments.find((p) => p.code === "24037")?.attachedTo).toBe(
      guard.id,
    );
    expect(enemyStats(s, minion(s, "24041")).attack).toBe(4);
    const hp = s.player.hp;
    s = settle(native(s, minionAttack(s, "24041")));
    expect(s.player.hp).toBe(hp - 4);
  });
  it("without a minion, Flamethrower finds one and attaches to it; Jetpack surges", () => {
    let s = started("ransacked_armory");
    s = settle(reveal(s, "24037"));
    expect(s.minions).toHaveLength(1);
    expect(s.attachments.find((p) => p.code === "24037")?.attachedTo).toBe(
      s.minions[0].id,
    );
    s = started("ransacked_armory");
    const deck = s.encounter.deck.length;
    s = settle(reveal(s, "24039"));
    expect(s.attachments.some((p) => p.code === "24039")).toBe(false);
    expect(s.encounter.deck.length).toBeLessThan(deck - 1);
  });
  it("Holoshield Generator gives +4 hit points and retaliate 2", () => {
    let s = started("ransacked_armory");
    s = settle(reveal(s, "24041"));
    s = settle(reveal(s, "24038"));
    const guard = minion(s, "24041");
    expect(pieceHP(s, guard)).toBe(7);
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: guard.id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Jetpack reduces attack damage by the boost icons of the discarded top card", () => {
    let s = started("ransacked_armory");
    s = settle(reveal(s, "24041"));
    s = settle(reveal(s, "24039"));
    const guard = minion(s, "24041");
    guard.tough = false;
    stack(s, "24037");
    s = settle(
      native(s, {
        type: "damage",
        target: guard.id,
        amount: 3,
        attack: true,
        source: "hero",
      }),
    );
    expect(minion(s, "24041").damage).toBe(1);
    expect(s.encounter.discard.map((p) => p.code)).toContain("24037");
  });
  it("Tech Gauntlets give +3 hit points, +1 ATK and overkill", () => {
    let s = started("ransacked_armory");
    s = settle(reveal(s, "24041"));
    s = settle(reveal(s, "24040"));
    const guard = minion(s, "24041");
    expect(pieceHP(s, guard)).toBe(6);
    expect(enemyStats(s, guard).attack).toBe(2);
  });
});

describe("Sinister Syndicate", () => {
  it("Crime Pays puts a Criminal minion into play engaged with you", () => {
    let s = started("sinister_syndicate");
    const minions = s.minions.length;
    s = settle(reveal(s, "24042"));
    expect(s.minions.length).toBe(minions + 1);
    expect(card(s.minions.at(-1)!).traits).toContain("Criminal");
    expect(s.sideSchemes.map((p) => p.code)).toContain("24042");
  });
  it("Beetle discards your lowest-cost upgrade after damaging you", () => {
    let s = started("sinister_syndicate");
    const upgrade = s.player.deck.find(
      (p) => card(p).type_code === "upgrade" && !card(p).permanent,
    )!;
    s.player.deck = s.player.deck.filter((p) => p !== upgrade);
    s.player.inPlay.push(upgrade);
    s = settle(reveal(s, "24043"));
    s = settle(native(s, minionAttack(s, "24043")));
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(false);
  });
  it("Boomerang deals 1 damage to each ally you control after attacking you", () => {
    let s = started("sinister_syndicate");
    const friend = ally(s, deckAlly(s).code);
    s = settle(reveal(s, "24044"));
    s = settle(native(s, minionAttack(s, "24044")));
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === friend.id)?.damage,
    ).toBe(1);
  });
  it("Shocker stuns the character that attacked him", () => {
    let s = started("sinister_syndicate");
    s = settle(reveal(s, "24045"));
    s = settle(
      native(s, {
        type: "damage",
        target: minion(s, "24045").id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.player.stunned).toBe(true);
  });
  it("Speed Demon attacks the attacking character first", () => {
    let s = started("sinister_syndicate");
    s = settle(reveal(s, "24046"));
    const demon = minion(s, "24046");
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: demon.id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.player.hp).toBe(hp - 2);
    expect(minion(s, "24046").damage).toBe(1);
  });
  it("a stunned hero's attack only removes the stun, so Speed Demon does not attack", () => {
    let s = started("sinister_syndicate");
    s = settle(reveal(s, "24046"));
    s.player.stunned = true;
    s.player.stunCards = 1;
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: minion(s, "24046").id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.player.hp).toBe(hp);
    expect(s.player.stunned).toBe(false);
    expect(minion(s, "24046").damage).toBe(0);
  });
  it("White Rabbit discards a random card from your hand when she attacks you", () => {
    let s = started("sinister_syndicate");
    s.player.hand.push(...s.player.deck.splice(0, 3));
    s = settle(reveal(s, "24047"));
    const discard = s.player.discard.length;
    s = settle(native(s, minionAttack(s, "24047")));
    expect(s.player.discard.length).toBe(discard + 1);
  });
  it("Sinister Onslaught makes each Criminal enemy attack a hero", () => {
    let s = started("sinister_syndicate");
    s = settle(reveal(s, "24043"));
    const hp = s.player.hp;
    s = settle(reveal(s, "24048"));
    // Beetle (2) and Rhino, a Criminal villain, attack.
    expect(s.player.hp).toBeLessThanOrEqual(hp - 2 - 2);
  });
});

describe("State of Emergency", () => {
  it("Feisty Heist discards the highest-cost card from your hand", () => {
    let s = started("state_of_emergency");
    s.player.hand.push(...s.player.deck.splice(0, 4));
    const top = Math.max(
      ...s.player.hand.map((p) => Number(card(p).cost) || 0),
    );
    s = settle(reveal(s, "24055"));
    const discarded = s.player.discard.at(-1)!;
    expect(Number(card(discarded).cost) || 0).toBe(top);
  });
  it("Disaster at the Docks deals 3 indirect damage", () => {
    let s = started("state_of_emergency");
    const hp = s.player.hp;
    s = settle(reveal(s, "24056"));
    expect(s.player.hp).toBe(hp - 3);
  });
  it("Offshore Inferno discards the lowest-cost card you control", () => {
    let s = started("state_of_emergency");
    const friend = ally(s, deckAlly(s).code);
    s = settle(reveal(s, "24057"));
    expect(s.player.inPlay.some((p) => p.id === friend.id)).toBe(false);
  });
  it("Hot Pursuit puts the first discarded minion into play engaged with you", () => {
    let s = started("state_of_emergency");
    const minionCard = s.encounter.deck.find(
      (p) => card(p).type_code === "minion",
    )!;
    s.encounter.deck = [
      minionCard,
      ...s.encounter.deck.filter((p) => p !== minionCard),
    ];
    s = settle(reveal(s, "24058"));
    expect(s.minions.find((p) => p.id === minionCard.id)?.engagedWith).toBe(
      "p1",
    );
  });
  it("Citywide Crisis resolves the When Revealed abilities of side schemes in play, otherwise 2 threat on each scheme", () => {
    let s = started("state_of_emergency");
    const threat = s.scheme.threat;
    s = settle(reveal(s, "24059"));
    expect(s.scheme.threat).toBe(threat + 2);
    s = started("state_of_emergency");
    s.player.hand.push(...s.player.deck.splice(0, 4));
    s = settle(reveal(s, "24055"));
    const hand = s.player.hand.length;
    const heist = s.sideSchemes.find((p) => p.code === "24055")!.counters;
    s = settle(reveal(s, "24059"));
    expect(s.player.hand.length).toBe(hand - 1);
    expect(s.sideSchemes.find((p) => p.code === "24055")?.counters).toBe(heist);
  });
});

describe("Wrecking Crew", () => {
  it("Top Talent hinders and gives the villain and each Elite minion retaliate 1", () => {
    let s = started("wrecking_crew_modular");
    s = settle(reveal(s, "24064"));
    expect(s.sideSchemes.find((p) => p.code === "24064")?.counters).toBe(5);
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.player.hp).toBe(hp - 1);
  });
  it("Wrecker gets +2 ATK on an undefended attack and receives a boost card", () => {
    let s = started("wrecking_crew_modular");
    s = settle(reveal(s, "24065"));
    stack(s, "01186");
    const hp = s.player.hp;
    s = settle(native(s, minionAttack(s, "24065")));
    expect(s.player.hp).toBe(hp - 4);
  });
  it("Thunderball deals 1 damage to each character you control after attacking you", () => {
    let s = started("wrecking_crew_modular");
    const friend = ally(s, deckAlly(s).code);
    s = settle(reveal(s, "24068"));
    stack(s, "01186");
    const hp = s.player.hp;
    s = settle(native(s, minionAttack(s, "24068")));
    expect(s.player.hp).toBe(hp - 1 - 1);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === friend.id)?.damage,
    ).toBe(1);
  });
  it("Combined Effort activates each Elite minion, otherwise surges; its boost counts Elite minions", () => {
    let s = started("wrecking_crew_modular");
    const deck = s.encounter.deck.length;
    s = settle(reveal(s, "24069"));
    expect(s.encounter.deck.length).toBeLessThan(deck - 1);
    s = started("wrecking_crew_modular");
    s = settle(reveal(s, "24066"));
    const hp = s.player.hp;
    stack(s, "01186");
    s = settle(reveal(s, "24069"));
    expect(s.player.hp).toBeLessThan(hp);
  });
  it("Magic Muscle gives each Brute enemy a tough status card", () => {
    let s = started("wrecking_crew_modular");
    s = settle(reveal(s, "24070"));
    expect(s.villain.tough).toBe(true);
    // Every Brute is tough: discard until a Brute minion and reveal it.
    s = settle(reveal(s, "24070"));
    expect(s.minions.some((p) => card(p).traits?.includes("Brute"))).toBe(true);
  });
});

describe("The Hood modular sets: boosts", () => {
  it("Shocker's boost stuns the character you control with the highest ATK", () => {
    let s = started("sinister_syndicate");
    stack(s, "24045");
    s = settle(native(s, villainAttack(s)));
    expect(s.player.stunned).toBe(true);
  });
  it("Mister Fear's boost discards from your deck until an ally", () => {
    let s = started("crossfire_crew");
    stack(s, "24027");
    const discard = s.player.discard.length;
    s = settle(native(s, villainAttack(s)));
    expect(s.player.discard.length).toBeGreaterThan(discard);
    expect(card(s.player.discard.at(-1)!).type_code).toBe("ally");
  });
  it("Combined Effort's boost gets a boost icon for each Elite minion", () => {
    let s = started("wrecking_crew_modular");
    s = settle(reveal(s, "24066"));
    stack(s, "24069");
    const hp = s.player.hp;
    s = settle(native(s, villainAttack(s)));
    // Rhino's 2 ATK, Combined Effort's printed boost icon and one more for
    // Bulldozer, the Elite minion in play.
    expect(s.player.hp).toBe(hp - 2 - 1 - 1);
  });
});
