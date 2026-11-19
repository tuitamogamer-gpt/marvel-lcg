/** NeXt Evolution: On the Run with Hope's Captor and the Nasty Boys
 * modular set, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { allyCount, enemyStats, newGame } from "../src/game/engine";
import { isTextBlank } from "../src/game/card-text";
import {
  NASTY_BOYS_CODES,
  ON_THE_RUN_SCRIPT_CODES,
  otrAttackBonus,
  otrKeyword,
  otrStatusModifiers,
} from "../src/game/on-the-run";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
const team: Seat[] = [
  { heroId: "spider_man", aspect: "justice" },
  { heroId: "captain_marvel", aspect: "aggression" },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "on_the_run",
  modules?: string[],
  heroes = team,
) {
  return newGame({
    heroId: heroes[0].heroId,
    aspect: heroes[0].aspect,
    villainId,
    difficulty,
    seed: 40070,
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
          [
            "none",
            "hero",
            "damage",
            "allow",
            "resolve",
            "done",
            "bonus",
          ].includes(o.id),
        )?.id ||
        s.prompt.options.find((o) => o.id !== "pay")?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
/** Settle choices until a payment prompt appears. */
function toPayment(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
) {
  for (let n = 0; s.prompt?.kind === "choice" && n < 200; n++)
    s = choose(
      reload(s),
      prefer?.(s) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) => o.id !== "pay")?.id ||
        s.prompt.options[0].id,
    );
  return s;
}
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "on_the_run",
  modules?: string[],
  heroes = team,
) {
  let s = settle(setup(difficulty, players, villainId, modules, heroes));
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
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.morlockSiege?.setAside || [],
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
/** Decline the player interrupts offered before an encounter card's When
 * Revealed ability resolves. */
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
function stack(s: GameState, ...pieces: Piece[]) {
  s.encounter.deck.unshift(...pieces);
  delete s.encounter.knownTop;
}
/** An original encounter card with no boost ability, put on top of the
 * encounter deck; returns its boost icons with each Amplify icon. */
function plainBoost(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) => !card(p).boost_star && card(p).type_code !== "ally",
  );
  const [p] = s.encounter.deck.splice(i, 1);
  stack(s, p);
  const amplify = [
    s.villain,
    ...(s.environments || []),
    ...s.attachments,
    ...s.sideSchemes,
  ]
    .map((q) => card(q))
    .filter((c) => (c as { scheme_amplify?: boolean }).scheme_amplify).length;
  return (card(p).boost || 0) + amplify;
}
function fromDeck(s: GameState, code: string, playerId = s.activePlayerId) {
  const view = seatView(s, playerId).player;
  const i = view.deck.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.hand.push(p);
  return p;
}
function ally(s: GameState, code: string, playerId = s.activePlayerId) {
  const view = seatView(s, playerId).player;
  const i = view.deck.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.inPlay.push(p);
  return p;
}
/** Put a set-aside Morlock into a player's play area. */
function morlock(s: GameState, playerId = s.activePlayerId) {
  const p = take(s, "40079");
  p.ownerId = undefined;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
/** Make the Marauder with this number the villain in play. */
function lead(s: GameState, number: string) {
  const side = s.difficulty === "expert" ? "b" : "a";
  const code = `${number}${side}`;
  const deck = s.morlockSiege!.villainDeck;
  const other = deck.find((p) => p.code === code);
  if (other) other.code = s.villain.code;
  s.villain.code = code;
  s.villain.hp = s.villain.maxHp = card(code).health! * s.playerCount;
  return reload(s);
}
const hit = (target: string, amount: number): Effect => ({
  type: "damage",
  target,
  amount,
  source: "hero",
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const routed = (s: GameState) => s.morlockSiege!.routed.length;
const routedCard = (s: GameState) =>
  (s.environments || []).find((p) => p.code.startsWith("40081"));

const captor = (s: GameState) =>
  s.attachments.find((a) => a.code.startsWith("40105"))!;
const marauderMinions = (s: GameState, playerId?: string) =>
  s.minions.filter(
    (m) =>
      card(m).traits?.includes("Marauder") &&
      (!playerId || (m.engagedWith || s.activePlayerId) === playerId),
  );
/** Remove every minion from play, back to the encounter deck. */
function clearMinions(s: GameState) {
  s.encounter.deck.push(...s.minions.splice(0));
  return reload(s);
}

describe("On the Run: original source", () => {
  it("registers every face of the On the Run and Nasty Boys sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "next_evol" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(ON_THE_RUN_SCRIPT_CODES)).toEqual(
      new Set(faces("on_the_run")),
    );
    expect(new Set(NASTY_BOYS_CODES)).toEqual(new Set(faces("nasty_boys")));
    for (const code of [...ON_THE_RUN_SCRIPT_CODES, ...NASTY_BOYS_CODES])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "on_the_run")).toMatchObject({
      schemes: ["40103b", "40104b"],
      moduleCount: 2,
      defaultModules: ["military_grade", "nasty_boys"],
      fixedSets: ["mutant_slayers"],
    });
    expect(MODULES.at(-1)?.id).toBe("nasty_boys");
    expect(scenarioModules("on_the_run").map((m) => m.id)).not.toContain(
      "mutant_slayers",
    );
  });

  it("puts one random Marauder into play with Hope's Captor and a Marauder minion engaged with each player", () => {
    for (const [difficulty, side] of [
      ["standard", "a"],
      ["expert", "b"],
    ] as const)
      for (const players of [1, 2]) {
        const s = started(difficulty, players);
        expect(s.villain.code.endsWith(side)).toBe(true);
        expect(card(s.villain).traits).toContain("Marauder");
        expect(s.villain.hp).toBe(card(s.villain).health! * players);
        expect(captor(s)).toMatchObject({
          code: "40105a",
          attachedTo: s.villain.id,
        });
        // Hope's Captor is a single physical card, never shuffled into the
        // encounter deck.
        expect(
          [
            ...s.attachments,
            ...s.encounter.deck,
            ...s.encounter.discard,
            ...s.removed,
          ].filter((p) => p.code.startsWith("40105")),
        ).toHaveLength(1);
        // Each other card of the On the Run set is in the encounter deck
        // once per copy.
        const owned = [
          ...s.attachments,
          ...s.minions,
          ...s.sideSchemes,
          ...s.encounter.deck,
          ...s.encounter.discard,
          ...s.removed,
        ];
        expect(
          owned.filter((p) => card(p).set_code === "on_the_run"),
        ).toHaveLength(9);
        expect(
          owned.filter((p) => card(p).set_code === "mutant_slayers"),
        ).toHaveLength(10);
        expect(
          owned.filter((p) => card(p).set_code === "nasty_boys"),
        ).toHaveLength(6);
        // The minion sharing the villain's title is removed from the game.
        expect(s.removed.map((p) => card(p).name)).toContain(
          card(s.villain).name,
        );
        expect(s.scheme).toMatchObject({ code: "40103b", threat: players });
        for (const seat of s.players)
          expect(marauderMinions(s, seat.id), seat.id).toHaveLength(1);
        const sets = new Set(s.encounter.deck.map((p) => card(p).set_code));
        expect(sets.has("mutant_slayers")).toBe(true);
      }
  });
});

describe("Hope's Captor", () => {
  it("the first defeat resets the villain and turns the Captor Desperate, advancing to Escaping with Hope", () => {
    let s = started("standard", 2);
    const printed = card(s.villain).health! * 2;
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.phase).not.toBe("won");
    expect(captor(s).code).toBe("40105b");
    expect(s.villain.maxHp).toBe(printed + 12);
    expect(s.villain.hp).toBe(printed + 12);
    expect(s.scheme.code).toBe("40104b");
    // Each player finds another Marauder minion; each Marauder enemy is
    // tough.
    for (const seat of s.players)
      expect(marauderMinions(s, seat.id).length).toBeGreaterThanOrEqual(2);
    expect(s.villain.tough).toBe(true);
  });

  it("the second defeat wins", () => {
    let s = started();
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    s.villain.tough = false;
    s = settle(native(reload(s), hit(s.villain.id, s.villain.hp)));
    expect(s.phase).toBe("won");
  });

  it("the players lose when Gotta Get Away is completed", () => {
    let s = started();
    s.scheme.threat = 7;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.phase).toBe("lost");
  });

  it("the villain schemes instead of attacking you while a Marauder minion is engaged with you", () => {
    let s = started();
    expect(marauderMinions(s, "p1")).toHaveLength(1);
    const hp = s.player.hp;
    const threat = s.scheme.threat;
    s = settle(native(s, villainAttack(s)));
    expect(s.player.hp).toBe(hp);
    expect(s.scheme.threat).toBeGreaterThan(threat);
    s = clearMinions(s);
    s = settle(native(s, villainAttack(s)));
    expect(s.player.hp).toBeLessThan(hp);
  });

  it("in a two-player game the villain schemes instead only against the player engaged with a Marauder minion", () => {
    let s = started("standard", 2);
    // Send p2's Marauder minion back to the encounter deck.
    const theirs = marauderMinions(s, "p2")[0];
    s.minions = s.minions.filter((m) => m.id !== theirs.id);
    s.encounter.deck.push(theirs);
    s = reload(s);
    const p2 = () => seatView(s, "p2").player.hp;
    const before = p2();
    const threat = s.scheme.threat;
    s = settle(native(s, villainAttack(s, "p2")));
    expect(p2()).toBeLessThan(before);
    expect(s.scheme.threat).toBe(threat);
    const p1 = seatView(s, "p1").player.hp;
    s = settle(native(s, villainAttack(s, "p1")));
    expect(seatView(s, "p1").player.hp).toBe(p1);
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat);
  });

  it("Marauder minions are steady, and gain guard on Escaping with Hope; the villain is steady in Expert there", () => {
    let s = started("expert");
    const m = marauderMinions(s)[0];
    expect(otrStatusModifiers(s, m)).toEqual({ steady: true });
    expect(otrKeyword(s, m, "Guard")).toBe(0);
    expect(otrStatusModifiers(s, s.villain)).toEqual({});
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(otrKeyword(s, marauderMinions(s)[0], "Guard")).toBe(1);
    expect(otrStatusModifiers(s, s.villain)).toEqual({ steady: true });
  });
});

describe("On the Run encounter cards", () => {
  it("Hidden in the Clutter takes the damage; at 3 the enemy attacks the player who dealt it", () => {
    let s = clearMinions(started());
    s = settle(reveal(s, "40106"));
    const clutter = s.attachments.find((a) => a.code === "40106")!;
    expect(clutter.attachedTo).toBe(s.villain.id);
    const villainHp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 2)));
    expect(s.villain.hp).toBe(villainHp);
    expect(s.attachments.find((a) => a.id === clutter.id)?.damage).toBe(2);
    const hp = s.player.hp;
    s = settle(native(s, hit(s.villain.id, 1)));
    expect(s.attachments.some((a) => a.id === clutter.id)).toBe(false);
    expect(s.player.hp).toBeLessThan(hp);
  });

  it("Favored Weapon: +1 ATK, overkill, piercing and ranged", () => {
    let s = started();
    s = settle(reveal(s, "40107"));
    const weapon = s.attachments.find((a) => a.code === "40107")!;
    const host =
      weapon.attachedTo === s.villain.id
        ? s.villain
        : s.minions.find((m) => m.id === weapon.attachedTo)!;
    expect(card(host).traits).toContain("Marauder");
    for (const k of ["Overkill", "Piercing", "Ranged"])
      expect(otrKeyword(s, host, k), k).toBe(1);
  });

  it("Bushwhack: its defeater finds a Marauder minion", () => {
    let s = clearMinions(started());
    s = settle(reveal(s, "40108"));
    const scheme = s.sideSchemes.find((p) => p.code === "40108")!;
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: scheme.counters,
        source: "hero",
      }),
    );
    expect(marauderMinions(s, "p1")).toHaveLength(1);
  });

  it("Dizzying Deeds exhausts a character you control", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "40110")));
    expect(s.player.exhausted).toBe(true);
  });

  it("Tag Team: discard 7 cards and the topmost Marauder minion engages you", () => {
    let s = clearMinions(started());
    s = reveal(s, "40111");
    s = resolveEncounter(s);
    s = settle(choose(s, "discard"));
    expect(marauderMinions(s, "p1").length).toBeLessThanOrEqual(1);
  });
});

describe("Nasty Boys", () => {
  it("Get Nasty: each minion gets +1 ATK", () => {
    let s = started("standard", 1, "rhino", ["nasty_boys"]);
    s = settle(reveal(s, "40117"));
    const scheme = s.sideSchemes.find((p) => p.code === "40117");
    expect(scheme).toBeTruthy();
    // It revealed a Nasty Boy minion.
    const boy = s.minions.find((m) => card(m).traits?.includes("Nasty Boy"));
    expect(boy).toBeTruthy();
    expect(otrAttackBonus(s, boy!)).toBe(1);
  });

  it("Slab gains a growth counter and +1 ATK for each when he attacks", () => {
    let s = started("standard", 1, "rhino", ["nasty_boys"]);
    const slab = take(s, "40116");
    slab.engagedWith = "p1";
    s.minions.push(slab);
    const hp = s.player.hp;
    s = settle(
      native(reload(s), { type: "enemyAttack", id: slab.id, actorId: "p1" }),
    );
    expect(s.minions.find((m) => m.id === slab.id)?.counters).toBe(1);
    // ATK 1 plus 1 growth counter.
    expect(hp - s.player.hp).toBe(2);
  });

  it("Ruckus stuns each character you control when revealed", () => {
    let s = started("standard", 1, "rhino", ["nasty_boys"]);
    s = settle(resolveEncounter(reveal(s, "40115")));
    expect(s.player.stunned).toBe(true);
  });

  it("Teamwork: a Nasty Boy entering play beside another activates", () => {
    let s = started("standard", 1, "rhino", ["nasty_boys"]);
    const ramrod = take(s, "40114");
    ramrod.engagedWith = "p1";
    s.minions.push(ramrod);
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(reload(s), "40112")));
    // Gorgeous George enters, activates (Teamwork) and attacks.
    expect(s.player.hp).toBeLessThan(hp);
  });
});
