/** MojoMania: Mojo with the Wheel of Genres and threat on characters, and
 * the one-card Longshot modular set, exercised with the original physical
 * cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModuleCount,
} from "../src/game/cards";
import { allyCount, enemyStats, newGame } from "../src/game/engine";
import {
  LONGSHOT_CODES,
  MOJO_SCRIPT_CODES,
  characterThreat,
  mojoDealStep,
  mojoKeyword,
} from "../src/game/mojo";
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

const team = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "she_hulk", aspect: "aggression" as const },
];
const SHOWS = ["39035", "39041", "39047", "39053", "39060", "39066"];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  modules?: string[],
  villainId = "mojo",
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 39022,
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
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  modules?: string[],
  villainId = "mojo",
) {
  let s = settle(setup(difficulty, players, modules, villainId));
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
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function stack(s: GameState, ...pieces: Piece[]) {
  s.encounter.deck.unshift(...pieces);
  delete s.encounter.knownTop;
}
/** Original encounter cards from outside the Mojo set without boost
 * abilities, taken out of the encounter deck. */
function outsiders(s: GameState, n: number) {
  const out: Piece[] = [];
  for (const p of [...s.encounter.deck]) {
    const c = card(p);
    if (out.length < n && c.set_code !== "mojo" && !c.boost_star) {
      s.encounter.deck.splice(s.encounter.deck.indexOf(p), 1);
      out.push(p);
    }
  }
  expect(out).toHaveLength(n);
  return out;
}
/** An original card from outside the Mojo set with no boost ability, put
 * on top of the encounter deck; returns its boost icons, including one for
 * each Amplify icon in play (A Game of Mojo's has one). */
function plainBoost(s: GameState) {
  const [p] = outsiders(s, 1);
  stack(s, p);
  const amplify = [s.villain, ...(s.environments || []), ...s.attachments]
    .map((q) => card(q))
    .filter((c) => (c as { scheme_amplify?: boolean }).scheme_amplify).length;
  return (card(p).boost || 0) + amplify;
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
function fromDeck(s: GameState, code: string, playerId = s.activePlayerId) {
  const view = seatView(s, playerId).player;
  const i = view.deck.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.hand.push(p);
  return p;
}
/** Put an original ally from the player's deck into play. */
function ally(s: GameState, code: string, playerId = s.activePlayerId) {
  const view = seatView(s, playerId).player;
  const i = view.deck.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.inPlay.push(p);
  return p;
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
const place = (target: string, amount: number): Effect => ({
  type: "mojo:place",
  target,
  amount,
});
const threatOn = (s: GameState, target: string) => characterThreat(s, target);
const show = (s: GameState) =>
  (s.environments || []).filter((p) => SHOWS.includes(p.code));
const wheel = (s: GameState) =>
  (s.environments || []).find((p) => p.code.startsWith("39026"));
const setOf = (p: Piece | string) => card(p).set_code;

describe("MojoMania: original source", () => {
  it("registers every face of the Mojo set and Longshot", () => {
    const faces = CATALOG_CARDS.filter(
      (c) => c.pack_code === "mojo" && c.set_code === "mojo",
    );
    expect(faces).toHaveLength(15);
    expect(new Set(MOJO_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    const longshot = CATALOG_CARDS.filter((c) => c.set_code === "longshot");
    expect(longshot.map((c) => c.code)).toEqual([...LONGSHOT_CODES]);
    for (const c of [...faces, ...longshot])
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    const mojo = VILLAINS.find((v) => v.id === "mojo");
    expect(mojo).toMatchObject({
      codes: ["39022", "39023", "39024"],
      schemes: ["39025b"],
      moduleCount: 1,
      moduleCountPerHero: 1,
      defaultModules: [
        "crime",
        "fantasy",
        "horror",
        "sci-fi",
        "sitcom",
        "western",
      ],
    });
    expect([1, 2, 3, 4].map((n) => scenarioModuleCount(mojo, n))).toEqual([
      2, 3, 4, 5,
    ]);
    expect(MODULES.at(-1)).toMatchObject({ id: "longshot", name: "Longshot" });
  });

  it("sets aside one modular set plus one per player and brings one in", () => {
    for (const players of [1, 2, 3]) {
      const s = started("standard", players);
      expect(s.villain).toMatchObject({ code: "39022", hp: 16 * players });
      expect(s.scheme).toMatchObject({ code: "39025b", threat: 10 * players });
      expect(s.modules).toHaveLength(players + 1);
      expect(s.mojo!.setAside).toHaveLength(players);
      expect(wheel(s)?.code).toBe("39026a");
      // The brought-in set's Show is in play and its other cards are in
      // the encounter deck; the set-aside sets are not.
      expect(show(s)).toHaveLength(1);
      const brought = setOf(show(s)[0]);
      const deckSets = new Set(s.encounter.deck.map(setOf));
      expect(deckSets.has(brought)).toBe(true);
      for (const group of s.mojo!.setAside) {
        expect(deckSets.has(group.set), group.set).toBe(false);
        expect(group.pieces.length).toBeGreaterThan(0);
        expect(group.pieces.some((p) => SHOWS.includes(p.code))).toBe(true);
      }
      expect([brought, ...s.mojo!.setAside.map((g) => g.set)].sort()).toEqual(
        [...(s.modules || [])].sort(),
      );
    }
  });

  it("Expert starts with Mojo (II), who puts 2 threat on each identity", () => {
    const s = started("expert", 2);
    expect(s.villain).toMatchObject({ code: "39023", hp: 36 });
    expect(threatOn(s, "hero:p1")).toBe(2);
    expect(threatOn(s, "hero:p2")).toBe(2);
  });
});

describe("Mojo", () => {
  it("after your turn ends in hero form, discards 3 and puts threat on your hero for cards from other sets", () => {
    let s = started("standard", 2);
    const [a, b] = outsiders(s, 2);
    stack(s, a, take(s, "39032"), b);
    s = reload(s);
    s = settle(command(s, { type: "END_TURN" }));
    expect(s.activePlayerId).toBe("p2");
    expect(threatOn(s, "hero:p1")).toBe(2);
    const discarded = s.encounter.discard.map((p) => p.code);
    for (const code of [a.code, "39032", b.code])
      expect(discarded, code).toContain(code);
  });

  it("does nothing after the turn of a hero in alter-ego form", () => {
    let s = started("standard", 2);
    s.player.form = "alter";
    const top = s.encounter.deck.slice(0, 3).map((p) => p.id);
    s = settle(command(reload(s), { type: "END_TURN" }));
    expect(threatOn(s, "hero:p1")).toBe(0);
    expect(s.encounter.deck.slice(0, 3).map((p) => p.id)).toEqual(top);
  });

  it("Mojo (II) puts 2 threat on each friendly character when he enters", () => {
    let s = started("standard", 2);
    const daredevil = ally(s, "01058");
    s = settle(native(reload(s), hit(s.villain.id, s.villain.hp)));
    expect(s.villain.code).toBe("39023");
    expect(threatOn(s, "hero:p1")).toBe(2);
    expect(threatOn(s, "hero:p2")).toBe(2);
    expect(threatOn(s, daredevil.id)).toBe(2);
  });

  it("Mojo (III) puts 3 threat on each friendly character when he enters", () => {
    let s = started("expert", 2);
    const daredevil = ally(s, "01058");
    s = settle(native(reload(s), hit(s.villain.id, s.villain.hp)));
    expect(s.villain.code).toBe("39024");
    expect(threatOn(s, "hero:p1")).toBe(5);
    expect(threatOn(s, "hero:p2")).toBe(5);
    expect(threatOn(s, daredevil.id)).toBe(3);
  });

  it("an identity that flips moves its threat to the main scheme", () => {
    let s = started();
    s = settle(native(s, place("hero:p1", 3)));
    const threat = s.scheme.threat;
    s = settle(command(s, { type: "FLIP" }));
    expect(s.player.form).toBe("alter");
    expect(threatOn(s, "hero:p1")).toBe(0);
    expect(s.scheme.threat).toBe(threat + 3);
  });

  it("an ally that leaves play moves its threat to the main scheme", () => {
    let s = started();
    const daredevil = ally(s, "01058");
    s = settle(native(reload(s), place(daredevil.id, 2)));
    const threat = s.scheme.threat;
    s = settle(native(s, hit(daredevil.id, 10)));
    expect(s.player.inPlay.some((p) => p.id === daredevil.id)).toBe(false);
    expect(s.scheme.threat).toBe(threat + 2);
  });
});

describe("Threat on a defeated hero", () => {
  it("moves to the main scheme when the hero is defeated", () => {
    let s = started("standard", 2);
    s = settle(native(s, place("hero:p2", 3)));
    const threat = s.scheme.threat;
    s = settle(
      native(s, {
        type: "damage",
        target: "hero:p2",
        amount: 99,
        source: s.villain.id,
      }),
    );
    expect(s.players.find((p) => p.id === "p2")?.eliminated).toBe(true);
    expect(threatOn(s, "hero:p2")).toBe(0);
    expect(s.scheme.threat).toBe(threat + 3);
  });
});

describe("The Wheel of Genres", () => {
  it("stops when the encounter deck resets", () => {
    let s = started();
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s = settle(native(reload(s), { type: "dealEncounter", playerId: "p1" }));
    expect(s.encounter.acceleration).toBe(1);
    expect(wheel(s)?.code).toBe("39026b");
    expect(s.phase).not.toBe("lost");
  });

  it("the players lose when the deck resets with no set-aside set left", () => {
    let s = started();
    s.mojo!.setAside = [];
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s = settle(native(reload(s), { type: "dealEncounter", playerId: "p1" }));
    expect(s.phase).toBe("lost");
  });

  it("Stopped: brings in a set-aside set on top of the deck and deals the first player 2 cards", () => {
    let s = started("standard", 2);
    wheel(s)!.code = "39026b";
    const before = show(s)[0];
    const sets = s.mojo!.setAside.map((g) => g.set);
    s = settle(native(reload(s), ...mojoDealStep(s)));
    expect(s.mojo!.setAside).toHaveLength(1);
    const now = show(s);
    expect(now).toHaveLength(1);
    expect(now[0].code).not.toBe(before.code);
    const brought = setOf(now[0]);
    expect(sets).toContain(brought);
    // The previous Show is a Setting and is discarded.
    expect(s.encounter.discard.map((p) => p.code)).toContain(before.code);
    const dealt = s.encounter.dealt.filter((p) => p.dealtTo === "p1");
    expect(dealt).toHaveLength(2);
    for (const p of dealt) expect(setOf(p)).toBe(brought);
    expect(wheel(s)?.code).toBe("39026a");
  });

  it("Stopped: the engine spins it at the start of step three of the villain phase", () => {
    let s = started();
    wheel(s)!.code = "39026b";
    s = settle(
      native(reload(s), { type: "dealEncounters", actorId: s.firstPlayerId }),
    );
    expect(s.mojo!.setAside).toHaveLength(0);
    expect(wheel(s)?.code).toBe("39026a");
    expect(s.log.some((l) => /Wheel of Genres lands on/.test(l.text))).toBe(
      true,
    );
  });
});

describe("Mojo encounter cards", () => {
  it("Major Domo: +1 ATK and SCH, and discards encounter cards equal to the damage of Mojo's attacks", () => {
    let s = started();
    const stats = enemyStats(s, s.villain);
    s = settle(reveal(s, "39027"));
    expect(s.attachments.find((a) => a.code === "39027")?.attachedTo).toBe(
      s.villain.id,
    );
    expect(enemyStats(s, s.villain)).toMatchObject({
      attack: stats.attack + 1,
      scheme: stats.scheme + 1,
    });
    const icons = plainBoost(s);
    const deck = s.encounter.deck.length;
    const hp = s.player.hp;
    s = settle(native(reload(s), villainAttack(s)));
    const damage = hp - s.player.hp;
    expect(damage).toBe(stats.attack + 1 + icons);
    // The boost card, then one card per damage.
    expect(deck - s.encounter.deck.length).toBe(1 + damage);
  });

  it("Major Domo's Hero Action spends energy, mental and physical to discard it", () => {
    let s = started();
    s = settle(reveal(s, "39027"));
    const domo = s.attachments.find((a) => a.code === "39027")!;
    const energy = fromDeck(s, "01063");
    const mental = fromDeck(s, "01004");
    const physical = fromDeck(s, "01003");
    s = reload(s);
    s = command(s, { type: "ABILITY", id: domo.id, action: "discard" });
    s = settle(pay(s, [energy, mental, physical]));
    expect(s.attachments.some((a) => a.id === domo.id)).toBe(false);
    expect(s.encounter.discard.map((p) => p.code)).toContain("39027");
  });

  it("Stinger Tail: retaliate 2 and takes the damage dealt to Mojo until it holds 5", () => {
    let s = started();
    s = settle(reveal(s, "39028"));
    const tail = s.attachments.find((a) => a.code === "39028")!;
    expect(mojoKeyword(s, s.villain, "Retaliate")).toBe(2);
    const hp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.find((a) => a.id === tail.id)?.damage).toBe(3);
    s = settle(native(s, hit(s.villain.id, 2)));
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((a) => a.id === tail.id)).toBe(false);
    s = settle(native(s, hit(s.villain.id, 2)));
    expect(s.villain.hp).toBe(hp - 2);
  });

  it("Stinger Tail's retaliate damages a hero who attacks Mojo", () => {
    let s = started();
    s = settle(reveal(s, "39028"));
    const hp = s.player.hp;
    s = settle(command(s, { type: "BASIC", action: "attack" }), (v) =>
      v.prompt?.options.some((o) => o.id === v.villain.id)
        ? v.villain.id
        : undefined,
    );
    expect(s.player.hp).toBe(hp - 2);
    expect(s.attachments.find((a) => a.code === "39028")?.damage).toBe(2);
  });

  it("Stinger Tail's boost attaches it to Mojo", () => {
    let s = started();
    stack(s, take(s, "39028"));
    s = settle(native(reload(s), villainAttack(s)));
    expect(s.attachments.find((a) => a.code === "39028")?.attachedTo).toBe(
      s.villain.id,
    );
  });

  it("Supporting Actor puts 2 threat on itself after it activates against you", () => {
    let s = started();
    s = settle(reveal(s, "39029"));
    const actor = s.minions.find((m) => m.code === "39029")!;
    s = settle(native(s, { type: "enemyScheme", id: actor.id, actorId: "p1" }));
    expect(threatOn(s, actor.id)).toBe(2);
    // A minion is a character: its threat moves to the main scheme when it
    // leaves play.
    const threat = s.scheme.threat;
    s = settle(native(s, hit(actor.id, 10)));
    expect(s.scheme.threat).toBe(threat + 2);
  });

  it("Supporting Actor's boost puts 1 threat on each character you control", () => {
    let s = started();
    const daredevil = ally(s, "01058");
    stack(s, take(s, "39029"));
    s = settle(native(reload(s), villainAttack(s)));
    expect(threatOn(s, "hero:p1")).toBe(1);
    expect(threatOn(s, daredevil.id)).toBe(1);
  });

  it("Paparazzi: Hinder 10 in your play area, removed by its Action and moved to the main scheme at the end of your turn", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "39030"));
    const paparazzi = s.player.inPlay.find((p) => p.code === "39030")!;
    expect(paparazzi.counters).toBe(10);
    fromDeck(s, "01003");
    s = reload(s);
    s = command(s, { type: "ABILITY", id: paparazzi.id, action: "discard" });
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === paparazzi.id)?.counters).toBe(
      8,
    );
    s = settle(
      command(s, { type: "ABILITY", id: paparazzi.id, action: "exhaust" }),
      (v) =>
        v.prompt?.options.some((o) => o.id === "hero") ? "hero" : undefined,
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === paparazzi.id)?.counters).toBe(
      6,
    );
    const threat = s.scheme.threat;
    s = settle(command(s, { type: "END_TURN" }));
    expect(s.scheme.threat).toBe(threat + 6);
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === paparazzi.id),
    ).toBe(false);
    expect(s.encounter.discard.map((p) => p.code)).toContain("39030");
  });

  it("Paparazzi removes 3 threat in alter-ego form", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(reveal(reload(s), "39030"));
    const paparazzi = s.player.inPlay.find((p) => p.code === "39030")!;
    fromDeck(s, "01003");
    s = settle(
      command(reload(s), {
        type: "ABILITY",
        id: paparazzi.id,
        action: "discard",
      }),
    );
    expect(s.player.inPlay.find((p) => p.id === paparazzi.id)?.counters).toBe(
      7,
    );
  });

  it("Undercover Mojo: damage to Mojo removes threat from it instead", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "39031"));
    const undercover = s.sideSchemes.find((p) => p.code === "39031")!;
    // Fixed 2 plus Hinder 2 per player.
    expect(undercover.counters).toBe(6);
    const hp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 4)));
    expect(s.villain.hp).toBe(hp);
    expect(s.sideSchemes.find((p) => p.id === undercover.id)?.counters).toBe(2);
  });

  it("Curtain Call moves the threat of the character with the most threat to the main scheme", () => {
    let s = started("standard", 2);
    s = settle(native(s, place("hero:p1", 2), place("hero:p2", 4)));
    const threat = s.scheme.threat;
    s = settle(reveal(s, "39032"));
    expect(threatOn(s, "hero:p2")).toBe(0);
    expect(threatOn(s, "hero:p1")).toBe(2);
    expect(s.scheme.threat).toBe(threat + 4);
  });

  it("Curtain Call with no threat on any character puts 1 threat on each character you control", () => {
    let s = started();
    const daredevil = ally(s, "01058");
    s = settle(reveal(reload(s), "39032"));
    expect(threatOn(s, "hero:p1")).toBe(1);
    expect(threatOn(s, daredevil.id)).toBe(1);
  });

  it("Director's Directions: take 1 damage per threat on your identity, with surge below 2", () => {
    let s = started();
    s = settle(native(s, place("hero:p1", 3)));
    const hp = s.player.hp;
    s = reveal(s, "39033");
    s = settle(choose(s, "damage"));
    expect(s.player.hp).toBe(hp - 3);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1")).toHaveLength(0);
    // With 1 threat the card gains surge.
    s.encounter.discard.push(...s.encounter.dealt.splice(0));
    s = settle(native(reload(s), place("hero:p1", -2)));
    expect(threatOn(s, "hero:p1")).toBe(1);
    s = reveal(s, "39033");
    s = settle(choose(s, "damage"));
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1")).toHaveLength(1);
  });

  it("Director's Directions: spend two different resources, or Mojo schemes", () => {
    let s = started();
    const energy = fromDeck(s, "01063");
    const mental = fromDeck(s, "01004");
    s = resolveEncounter(reveal(reload(s), "39033"));
    s = choose(s, "pay");
    if (s.prompt?.kind === "choice") s = choose(s, "energy+mental");
    s = settle(pay(s, [energy, mental]));
    expect(s.player.discard.map((p) => p.code)).toEqual(
      expect.arrayContaining(["01063", "01004"]),
    );
    const threat = s.scheme.threat;
    const icons = plainBoost(s);
    s = reveal(reload(s), "39033");
    expect(s.prompt?.options.map((o) => o.id)).not.toContain("pay");
    s = settle(choose(s, "scheme"));
    expect(s.scheme.threat).toBe(
      threat + enemyStats(s, s.villain).scheme + icons,
    );
  });

  it("Top Billing heals 1 and puts 2 threat on each character you control", () => {
    let s = started();
    const daredevil = ally(s, "01058");
    daredevil.damage = 2;
    s.player.hp -= 2;
    const hp = s.player.hp;
    s = settle(reveal(reload(s), "39034"));
    expect(s.player.hp).toBe(hp + 1);
    expect(s.player.inPlay.find((p) => p.id === daredevil.id)?.damage).toBe(1);
    expect(threatOn(s, "hero:p1")).toBe(2);
    expect(threatOn(s, daredevil.id)).toBe(2);
  });
});

describe("Longshot", () => {
  it("enters play under your control with surge, outside the ally limit, with piercing attacks", () => {
    let s = started("standard", 1, ["longshot"], "rhino");
    const allies = allyCount(s);
    s = settle(reveal(s, "39071"));
    const longshot = s.player.inPlay.find((p) => p.code === "39071")!;
    expect(longshot).toBeTruthy();
    expect(allyCount(s)).toBe(allies);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1")).toHaveLength(1);
    // When he is defeated he returns to the encounter discard pile.
    s = settle(native(s, hit(longshot.id, 3)));
    expect(s.player.inPlay.some((p) => p.id === longshot.id)).toBe(false);
    expect(s.encounter.discard.map((p) => p.code)).toContain("39071");
  });

  it("as a boost card has no boost icons", () => {
    let s = started("standard", 1, ["longshot"], "rhino");
    stack(s, take(s, "39071"));
    const hp = s.player.hp;
    const atk = enemyStats(s, s.villain).attack;
    s = settle(native(reload(s), villainAttack(s)));
    expect(s.player.hp).toBe(hp - atk);
  });
});
