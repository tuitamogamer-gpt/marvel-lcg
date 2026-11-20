/** Trickster Takeover: God of Lies in Single Group Mode, exercised with the
 * original physical cards. Every command crosses a JSON save/reload
 * boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, VILLAINS, card } from "../src/game/cards";
import {
  abilityOptions,
  dispatch,
  enemyStats,
  makePiece,
  newGame,
} from "../src/game/engine";
import { paymentSources } from "../src/game/payment";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  AVATARS,
  GOD_OF_LIES_CODES,
  godOfLiesObjective,
} from "../src/game/god-of-lies";
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
  { heroId: "captain_marvel", aspect: "aggression" },
  { heroId: "spider_man", aspect: "justice" },
];
const LOKI = "55027a";
const LOKI_FLIPPED = "55027b";
const RASCAL = "55029a";
const MISCREANT = "55030a";
const KNAVE = "55031a";
const WRETCH = "55032a";
const MISCHIEF = "55033b";
const INTENSE = "55034a";
const TOTAL = "55034b";
const CHAINS = "55035";
const SCEPTER = "55036";
const DRAUGR = "55037";
const GRENDELL = "55038";
const MALEKITH = "55039";
const MINOTAUR = "55040";
const MANGOG = "55041";
const FENRIS = "55042";
const HRAESVELGR = "55043";
const LAUFEY = "55044";
const AURA = "55045";
const DOOR = "55046";
const LOFTY = "55047";
const JOTUNHEIM = "55048";
const DARK_ARTS = "55049";
const DIRTY = "55050";
const STORIES = "55051";
const DOMINEERING = "55052";
const FEIGNED = "55053";
const MOUNTING = "55054";
const UNIFIED = "55055";
/** A Standard treachery with no text of its own beyond surge-free effects:
 * Advance (core Standard set). */
const ADVANCE = "01186";

function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  seed = 55027,
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId: "god_of_lies",
    difficulty,
    seed,
    pacing: "expert",
    heroes: team.slice(0, players),
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
function opened(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  const s = opened(difficulty, players);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  s.villain.tough = false;
  s.villain.toughCards = 0;
  // Loki the Rascal answers only treachery boost cards in his activation.
  useAvatar(s, RASCAL);
  return reload(s);
}
function zones(s: GameState): Piece[][] {
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
    s.godOfLies?.focus ? [s.godOfLies.focus] : [],
    s.tricksterMagic?.allies || [],
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** Each physical card stays in exactly one zone: the 22 encounter cards of
 * the God of Lies set, Intense Focus and the four Synergy environments. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "god_of_lies")).toHaveLength(
    27,
  );
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.minions,
    s.sideSchemes,
    s.attachments,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) {
      const [p] = zone.splice(i, 1);
      delete p.attachedTo;
      delete p.engagedWith;
      return p;
    }
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
const hit = (target: string, amount: number, source = "hero"): Effect => ({
  type: "damage",
  target,
  amount,
  source,
});
const G = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `gol:${type}`,
  ...args,
});
/** Put this Avatar of Loki in play, swapping him with the one in play. */
function useAvatar(s: GameState, code: string) {
  const st = s.godOfLies!;
  if (s.villain.code !== code) {
    st.avatars = [...st.avatars.filter((c) => c !== code), s.villain.code];
    s.villain.code = code;
  }
  return s.villain;
}
function minion(s: GameState, code: string, playerId = "p1") {
  const p = take(s, code);
  p.engagedWith = playerId;
  p.damage = 0;
  s.minions.push(p);
  return p;
}
function sideScheme(s: GameState, code: string, counters?: number) {
  const p = take(s, code);
  const c = card(p);
  p.counters =
    counters ??
    (c.base_threat || 0) * (c.base_threat_fixed ? 1 : s.playerCount);
  s.sideSchemes.push(p);
  return p;
}
function attachTo(s: GameState, code: string, target: string) {
  const p = take(s, code);
  p.attachedTo = target;
  s.attachments.push(p);
  return p;
}
/** Blank cards on top of the encounter deck: no boost icons and not a
 * treachery (Armored Rhino Suit). */
function blankTop(s: GameState, n = 1) {
  for (let i = 0; i < n; i++) s.encounter.deck.unshift(makePiece(s, "01098"));
  delete s.encounter.knownTop;
  return s;
}
/** A plain treachery on top of the encounter deck (Advance). */
function treacheryTop(s: GameState, n = 1) {
  for (let i = 0; i < n; i++) s.encounter.deck.unshift(makePiece(s, ADVANCE));
  delete s.encounter.knownTop;
  return s;
}
function playerCard(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  if (i >= 0) return p.deck.splice(i, 1)[0];
  return makePiece(s, code);
}
const synergyOf = (s: GameState, code: string) =>
  (s.environments || []).find((p) => p.code === code)!;

describe("God of Lies registration and setup", () => {
  it("registers every God of Lies face natively", () => {
    const set = CATALOG_CARDS.filter((c) => c.set_code === "god_of_lies");
    expect(set.map((c) => c.code).sort()).toEqual(
      [...GOD_OF_LIES_CODES].sort(),
    );
    for (const c of set) expect(hasExecutableScript(c), c.code).toBe(true);
    const v = VILLAINS.find((v) => v.id === "god_of_lies")!;
    expect(v.codes).toEqual([LOKI, LOKI]);
    expect(v.schemes).toEqual([MISCHIEF]);
    expect(v.defaultModules).toEqual(["trickster_magic"]);
  });
  it("puts a random Avatar of Loki into play, the Synergy environments too, and sets Intense Focus aside", () => {
    const s = opened("standard", 1);
    const st = s.godOfLies!;
    expect(AVATARS).toContain(s.villain.code);
    expect(s.villain.hp).toBe(15);
    expect(s.scheme.code).toBe(MISCHIEF);
    expect(s.scheme.threat).toBe(0);
    expect(st.loki).toEqual({ code: LOKI, hp: 20, maxHp: 20 });
    expect(st.worlds).toBe(0);
    expect(st.shatter).toBe(0);
    expect([...st.avatars, s.villain.code].sort()).toEqual([...AVATARS].sort());
    expect(st.focus!.code).toBe(INTENSE);
    expect(
      (s.environments || []).map((p) => [p.code, p.counters]).sort(),
    ).toEqual([
      [DOMINEERING, 0],
      [FEIGNED, 0],
      [MOUNTING, 0],
      [UNIFIED, 0],
    ]);
    expect(
      s.encounter.deck.some((p) =>
        [INTENSE, TOTAL, DOMINEERING, FEIGNED, MOUNTING, UNIFIED].includes(
          p.code,
        ),
      ),
    ).toBe(false);
    // 22 God of Lies encounter cards are shuffled in with the Standard and
    // Trickster Magic sets.
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "god_of_lies"),
    ).toHaveLength(22);
    expect(godOfLiesObjective(s)).toBe(
      "Defeat Loki, God of Lies · 20 of 20 hit points · Worlds Collide 0 of 2",
    );
    exact(s);
  }, 30000);
  it("attaches Intense Focus to the Avatar in Expert: 2 more hit points per player and steady", () => {
    const s = opened("expert", 2);
    const focus = s.attachments.find((p) => p.code === INTENSE)!;
    expect(focus.attachedTo).toBe(s.villain.id);
    expect(s.villain.maxHp).toBe(34);
    expect(s.villain.hp).toBe(34);
    expect(s.godOfLies!.loki.hp).toBe(40);
    expect(s.godOfLies!.focus).toBeUndefined();
    // Intense Focus: +1 ATK and +1 SCH.
    const v = enemyStats(s, s.villain);
    expect(v.attack).toBe((card(s.villain).attack || 0) + 1);
    exact(s);
  }, 30000);
});

describe("Shattering the illusion", () => {
  it("an Avatar that would be defeated gains 5 shatter counters per player and flips; the illusion shatters", () => {
    let s = started();
    useAvatar(s, RASCAL);
    s.godOfLies!.shatter = 3;
    s = settle(native(s, hit(s.villain.id, 15)));
    const st = s.godOfLies!;
    // 3 + 5 shatter counters wound Loki, God of Lies.
    expect(st.loki.hp).toBe(12);
    expect(st.shatter).toBe(0);
    expect([MISCREANT, KNAVE, WRETCH]).toContain(s.villain.code);
    expect(s.villain.hp).toBe(15);
    expect(s.villain.maxHp).toBe(15);
    expect(st.avatars).toContain(RASCAL);
    // Loki the Rascal's Fading Figment: synergy counters on Unified Front.
    expect(synergyOf(s, UNIFIED).counters).toBe(1);
    expect(s.phase).toBe("player");
    exact(s);
  }, 30000);
  it("each Fading Figment fills its own Synergy environment", () => {
    for (const [avatar, env] of [
      [MISCREANT, MOUNTING],
      [KNAVE, DOMINEERING],
      [WRETCH, FEIGNED],
    ]) {
      let s = started("standard", 2);
      useAvatar(s, avatar);
      s = settle(native(s, hit(s.villain.id, 30)));
      expect(synergyOf(s, env).counters, avatar).toBe(2);
      expect(s.godOfLies!.loki.hp).toBe(30);
    }
  }, 60000);
  it("Loki, God of Lies flips at 10 hit points per player: Intense Focus attaches in Standard", () => {
    let s = started();
    s.godOfLies!.loki.hp = 14;
    blankTop(s, 2);
    const deck = s.player.deck.length;
    s = settle(native(s, hit(s.villain.id, 15)));
    const st = s.godOfLies!;
    expect(st.loki.hp).toBe(9);
    expect(st.loki.code).toBe(LOKI_FLIPPED);
    const focus = s.attachments.find((p) => p.code === INTENSE)!;
    expect(focus.attachedTo).toBe(s.villain.id);
    expect(st.focus).toBeUndefined();
    // The new Avatar gets 2 more hit points and steady.
    expect(s.villain.maxHp).toBe(17);
    expect(s.villain.hp).toBe(17);
    // Its When Revealed: the top 2 encounter cards and top 5 player cards.
    expect(s.player.deck.length).toBe(deck - 5);
    exact(s);
  }, 30000);
  it("in Expert, Loki flips Intense Focus to Total Focus, which finds Dark Scepter", () => {
    let s = started("expert");
    s.godOfLies!.loki.hp = 14;
    s = settle(native(s, hit(s.villain.id, 17)));
    const st = s.godOfLies!;
    expect(st.loki.code).toBe(LOKI_FLIPPED);
    const focus = s.attachments.find((p) => p.code === TOTAL)!;
    expect(focus.attachedTo).toBe(s.villain.id);
    expect(s.villain.maxHp).toBe(18);
    const scepter = s.attachments.find((p) => p.code === SCEPTER)!;
    expect(scepter.attachedTo).toBe(s.villain.id);
    expect(s.villain.tough).toBe(false);
    exact(s);
  }, 30000);
  it("Total Focus gives a tough status card when Dark Scepter is already in play", () => {
    let s = started("expert");
    attachTo(s, SCEPTER, s.villain.id);
    s.godOfLies!.loki.hp = 14;
    s = settle(native(s, hit(s.villain.id, 17)));
    expect(s.attachments.filter((p) => p.code === SCEPTER)).toHaveLength(1);
    expect(s.villain.tough).toBe(true);
    exact(s);
  }, 30000);
  it("the players win when the shatter counters defeat Loki, God of Lies", () => {
    let s = started();
    s.godOfLies!.loki.hp = 5;
    s = native(s, hit(s.villain.id, 15));
    for (let n = 0; s.prompt && n < 20; n++)
      s = choose(reload(s), passId(s) || s.prompt.options[0].id);
    expect(s.phase).toBe("won");
  }, 30000);
});

describe("Mischief and Mayhem and Worlds Collide", () => {
  it("completing Mischief and Mayhem removes its threat and places 1 threat on Worlds Collide", () => {
    let s = started();
    s = settle(native(s, { type: "threat", target: "main", amount: 8 }));
    expect(s.scheme.threat).toBe(0);
    expect(s.godOfLies!.worlds).toBe(1);
    expect(s.phase).toBe("player");
    exact(s);
  }, 30000);
  it("a defeated identity changes to alter-ego with 1 hit point and places 1 threat on Worlds Collide", () => {
    let s = started("standard", 2);
    s = settle(native(s, hit("hero:p1", 99)));
    const p1 = seatView(s, "p1").player;
    expect(s.players.find((x) => x.id === "p1")!.eliminated).toBeFalsy();
    expect(p1.hp).toBe(1);
    expect(p1.form).toBe("alter");
    expect(s.godOfLies!.worlds).toBe(1);
    exact(s);
  }, 30000);
  it("Worlds Collide completed in the villain phase loses the game at once", () => {
    let s = started();
    s.godOfLies!.worlds = 1;
    s.phase = "villain";
    s = native(s, { type: "threat", target: "main", amount: 8 });
    expect(s.phase).toBe("lost");
  }, 30000);
  it("completed in the player phase, the players lose when it ends unless Loki falls", () => {
    let s = started();
    s.godOfLies!.worlds = 1;
    s = settle(native(s, { type: "threat", target: "main", amount: 8 }));
    expect(s.phase).toBe("player");
    expect(s.godOfLies!.doomed).toBe(true);
    let t = reload(s);
    s = command(s, { type: "END_TURN", discard: [] });
    expect(s.phase).toBe("lost");
    // Defeating Loki before the phase ends wins.
    t.godOfLies!.loki.hp = 5;
    t = native(t, hit(t.villain.id, 15));
    for (let n = 0; t.prompt && n < 20; n++)
      t = choose(reload(t), passId(t) || t.prompt.options[0].id);
    expect(t.phase).toBe("won");
  }, 30000);
});

describe("The Avatars of Loki", () => {
  it("Loki the Miscreant: after you resolve a treachery, 1 threat on the main scheme and 1 on a side scheme", () => {
    let s = started();
    useAvatar(s, MISCREANT);
    const lofty = sideScheme(s, LOFTY);
    const threat = s.scheme.threat;
    s = settle(reveal(s, DIRTY));
    expect(s.scheme.threat).toBe(threat + 1);
    expect(s.sideSchemes.find((p) => p.id === lofty.id)!.counters).toBe(6);
    exact(s);
  }, 30000);
  it("Loki the Knave: after you resolve a treachery, 1 damage to your identity and to an ally", () => {
    let s = started();
    useAvatar(s, KNAVE);
    const ally = makePiece(s, "01083");
    ally.ownerId = "p1";
    s.player.inPlay.push(ally);
    const hp = s.player.hp;
    s = settle(reveal(s, DIRTY));
    // Dirty Trick's 2 damage, then the Knave's 1.
    expect(s.player.hp).toBe(hp - 3);
    expect(s.player.inPlay.find((p) => p.id === ally.id)!.damage).toBe(1);
    exact(s);
  }, 30000);
  it("Loki the Rascal: a treachery boost card in his activation is dealt to you, or costs a resource", () => {
    let s = started();
    useAvatar(s, RASCAL);
    stack(s, STORIES);
    s = settle(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === "deal")?.id,
    );
    expect(s.encounter.dealt.map((p) => p.code)).toEqual([STORIES]);
    expect(s.encounter.dealt[0].dealtTo).toBe("p1");
    exact(s);
  }, 30000);
  it("Loki the Wretch: activating, a discarded treachery gives him +1 ATK", () => {
    let s = started();
    useAvatar(s, WRETCH);
    blankTop(s, 1);
    treacheryTop(s, 1);
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    // ATK 1 + 1, and a blank boost card.
    expect(hp - s.player.hp).toBe(2);
    exact(s);
  }, 30000);
  it("Stories and Lies swaps the Avatar, keeping damage, status and shatter, then he schemes or attacks", () => {
    let s = started();
    useAvatar(s, RASCAL);
    s.villain.hp = 9;
    s.villain.stunned = false;
    s.godOfLies!.shatter = 4;
    blankTop(s, 2);
    const threat = s.scheme.threat;
    const hp = s.player.hp;
    s = settle(reveal(s, STORIES));
    const st = s.godOfLies!;
    expect([MISCREANT, KNAVE, WRETCH]).toContain(s.villain.code);
    expect(st.avatars).toContain(RASCAL);
    expect(s.villain.hp).toBe(9);
    expect(st.shatter).toBe(4);
    if ([KNAVE, MISCREANT].includes(s.villain.code))
      expect(s.scheme.threat).toBeGreaterThan(threat);
    else expect(s.player.hp).toBeLessThan(hp);
    exact(s);
  }, 30000);
});

describe("God of Lies encounter cards", () => {
  it("Dark Scepter: a treachery cannot be canceled while it is in play", () => {
    const base = started();
    const behind = playerCard(base, "01078");
    const energy = makePiece(base, "01088");
    for (const p of [behind, energy]) p.ownerId = "p1";
    base.player.hand.push(behind, energy);
    // Get Behind Me! cancels a treachery's When Revealed...
    const s = reveal(reload(base), DIRTY);
    expect(
      s.prompt?.options.some((o) => o.label.includes("Get Behind Me!")),
      JSON.stringify(s.prompt),
    ).toBe(true);
    // ... but not with Dark Scepter on the Avatar.
    const t = reload(base);
    attachTo(t, SCEPTER, t.villain.id);
    const u = reveal(t, DIRTY);
    expect(
      !!u.prompt?.options.some((o) => o.label.includes("Get Behind Me!")),
    ).toBe(false);
  }, 30000);
  it("Loki the Rascal: the player may spend a resource instead of taking the treachery", () => {
    let s = started();
    const energy = makePiece(s, "01088");
    energy.ownerId = "p1";
    s.player.hand.push(energy);
    stack(s, STORIES);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    for (
      let n = 0;
      s.prompt && n < 30 && !s.prompt.options.some((o) => o.id === "pay");
      n++
    )
      s = choose(
        reload(s),
        noDefense(s) || passId(s) || s.prompt.options[0].id,
      );
    s = choose(s, "pay");
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(s, [energy]));
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.encounter.discard.some((p) => p.code === STORIES)).toBe(true);
    exact(s);
  }, 30000);
  it("Wrapped in Chains attaches, exhausts you, keeps you from readying and frees you for 2 resources of a type", () => {
    let s = started();
    s = settle(reveal(s, CHAINS));
    const chains = s.attachments.find((p) => p.code === CHAINS)!;
    expect(chains.attachedTo).toBe("hero:p1");
    expect(s.player.exhausted).toBe(true);
    s = settle(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(true);
    const energy = [makePiece(s, "01088"), makePiece(s, "01088")];
    for (const p of energy) p.ownerId = "p1";
    s.player.hand.push(...energy);
    const options = abilityOptions(s, chains).map((o) => o.id);
    expect(options).toContain("chains:energy");
    s = command(s, { type: "ABILITY", id: chains.id, action: "chains:energy" });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(s, energy));
    expect(s.attachments.some((p) => p.code === CHAINS)).toBe(false);
    expect(s.godOfLies!.shatter).toBe(1);
    exact(s);
  }, 30000);
  it("Dark Scepter attaches to the Avatar: stalwart, treacheries cannot be canceled, and its Hero Response discards it", () => {
    let s = started();
    s = settle(reveal(s, SCEPTER));
    const scepter = s.attachments.find((p) => p.code === SCEPTER)!;
    expect(scepter.attachedTo).toBe(s.villain.id);
    expect(enemyStats(s, s.villain).attack).toBe(
      (card(s.villain).attack || 0) + 1,
    );
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    const mental = [makePiece(s, "01089"), makePiece(s, "01089")];
    for (const p of mental) p.ownerId = "p1";
    s.player.hand.push(...mental);
    s = native(s, { type: "reveal", piece: take(s, DIRTY), actorId: "p1" });
    for (
      let n = 0;
      s.prompt && n < 20 && !s.prompt.options.some((o) => o.id === "mental");
      n++
    )
      s = choose(reload(s), passId(s) || s.prompt.options[0].id);
    expect(s.prompt?.title).toBe("Dark Scepter");
    s = choose(s, "mental");
    s = settle(pay(s, mental));
    expect(s.attachments.some((p) => p.code === SCEPTER)).toBe(false);
    exact(s);
  }, 30000);
  it("Draugr Buddy's When Defeated deals it to its defeater when a treachery is discarded", () => {
    let s = started();
    const draugr = minion(s, DRAUGR);
    treacheryTop(s);
    s = settle(native(s, hit(draugr.id, 2)));
    expect(s.encounter.dealt.map((p) => p.id)).toEqual([draugr.id]);
    exact(s);
  }, 30000);
  it("Grendell attacks with +1 ATK for each treachery among the top 3 and leaves 3 shatter counters", () => {
    let s = started();
    const grendell = minion(s, GRENDELL);
    blankTop(s, 1);
    treacheryTop(s, 2);
    // Two treacheries among the top 3: ATK 1 + 2.
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: grendell.id }));
    expect(hp - s.player.hp).toBe(3);
    s = settle(native(s, hit(grendell.id, 6)));
    expect(s.godOfLies!.shatter).toBe(3);
    exact(s);
  }, 30000);
  it("Malekith deals a discarded treachery to you after attacking, and leaves 2 shatter counters", () => {
    let s = started();
    const malekith = minion(s, MALEKITH);
    treacheryTop(s);
    s = settle(native(s, { type: "enemyAttack", id: malekith.id }));
    expect(s.encounter.dealt.map((p) => p.code)).toEqual([ADVANCE]);
    s = settle(native(s, hit(malekith.id, 5)));
    expect(s.godOfLies!.shatter).toBe(2);
    exact(s);
  }, 30000);
  it("Minotaur activates against you with 5 treacheries in the encounter discard pile", () => {
    let s = started();
    for (let i = 0; i < 5; i++) s.encounter.discard.push(makePiece(s, ADVANCE));
    blankTop(s, 1);
    const hp = s.player.hp;
    s = settle(reveal(s, MINOTAUR));
    expect(s.player.hp).toBe(hp - 2);
    const minotaur = s.minions.find((p) => p.code === MINOTAUR)!;
    // Toughness.
    expect(minotaur.tough).toBe(true);
    exact(s);
  }, 30000);
  it("The Mangog is Victory 1 and leaves 3 shatter counters and a synergy counter", () => {
    let s = started();
    const mangog = minion(s, MANGOG);
    s = settle(
      native(s, hit(mangog.id, 10)),
      (v) => v.prompt?.options.find((o) => o.id === FEIGNED)?.id,
    );
    expect(s.victoryDisplay!.map((p) => p.code)).toContain(MANGOG);
    expect(s.godOfLies!.shatter).toBe(3);
    expect(synergyOf(s, FEIGNED).counters).toBe(1);
    exact(s);
  }, 30000);
  it("Fenris Wolf, Hraesvelgr and Laufey each leave 3 shatter counters and a synergy counter", () => {
    for (const [code, env] of [
      [FENRIS, MOUNTING],
      [HRAESVELGR, DOMINEERING],
      [LAUFEY, UNIFIED],
    ]) {
      let s = started();
      const m = minion(s, code);
      s = settle(native(s, hit(m.id, 7)));
      expect(s.godOfLies!.shatter, code).toBe(3);
      expect(synergyOf(s, env).counters, code).toBe(1);
      exact(s);
    }
  }, 60000);
  it("Hraesvelgr deals 2 indirect damage when a treachery is among the top 3", () => {
    let s = started();
    treacheryTop(s, 1);
    blankTop(s, 2);
    const hp = s.player.hp;
    s = settle(reveal(s, HRAESVELGR));
    expect(s.player.hp).toBe(hp - 2);
    exact(s);
  }, 30000);
  it("Laufey stuns the character who attacks her when the top card is a treachery", () => {
    let s = started();
    const laufey = minion(s, LAUFEY);
    treacheryTop(s);
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(choose(s, laufey.id));
    expect(s.player.stunned).toBe(true);
    exact(s);
  }, 30000);
  it("Aura of Stasis exhausts you when a treachery is among the top 2 (3 in Expert)", () => {
    let s = started();
    blankTop(s, 1);
    treacheryTop(s, 1);
    s = settle(reveal(s, AURA));
    expect(s.player.exhausted).toBe(true);
    let t = started("expert");
    treacheryTop(t, 1);
    blankTop(t, 2);
    t = settle(reveal(t, AURA));
    expect(t.player.exhausted).toBe(true);
    let u = started();
    treacheryTop(u, 1);
    blankTop(u, 2);
    u = settle(reveal(u, AURA));
    expect(u.player.exhausted).toBe(false);
  }, 30000);
  it("Door Between Worlds is Victory 1 and its defeat leaves shatter and synergy counters", () => {
    let s = started();
    const door = sideScheme(s, DOOR);
    expect(door.counters).toBe(7);
    s = settle(
      native(s, { type: "thwart", target: door.id, amount: 7 }),
      (v) => v.prompt?.options.find((o) => o.id === MOUNTING)?.id,
    );
    expect(s.victoryDisplay!.map((p) => p.code)).toContain(DOOR);
    expect(s.godOfLies!.shatter).toBe(3);
    expect(synergyOf(s, MOUNTING).counters).toBe(1);
    exact(s);
  }, 30000);
  it("Lofty Goals and New Jotunheim leave their shatter counters", () => {
    let s = started();
    const lofty = sideScheme(s, LOFTY);
    const jotun = sideScheme(s, JOTUNHEIM);
    s = settle(native(s, { type: "thwart", target: lofty.id, amount: 5 }));
    expect(s.godOfLies!.shatter).toBe(2);
    s = settle(native(s, { type: "thwart", target: jotun.id, amount: 6 }));
    expect(s.godOfLies!.shatter).toBe(5);
    expect(synergyOf(s, FEIGNED).counters).toBe(1);
    exact(s);
  }, 30000);
  it("Dark Arts reveals a minion from the encounter discard pile, otherwise places 3 threat", () => {
    let s = started();
    const threat = s.scheme.threat;
    s = settle(reveal(s, DARK_ARTS));
    expect(s.scheme.threat).toBe(threat + 3);
    let t = started();
    const draugr = take(t, DRAUGR);
    t.encounter.discard.push(draugr);
    t = settle(reveal(t, DARK_ARTS));
    expect(t.minions.some((p) => p.id === draugr.id)).toBe(true);
    exact(t);
  }, 30000);
  it("Dark Arts gains incite 1 in Expert", () => {
    let s = started("expert");
    const threat = s.scheme.threat;
    s = settle(reveal(s, DARK_ARTS));
    expect(s.scheme.threat).toBe(threat + 4);
  }, 30000);
  it("Dirty Trick removes a shatter counter and deals 2 damage (3 in Expert)", () => {
    let s = started();
    s.godOfLies!.shatter = 2;
    const hp = s.player.hp;
    s = settle(reveal(s, DIRTY));
    expect(s.godOfLies!.shatter).toBe(1);
    expect(s.player.hp).toBe(hp - 2);
    let t = started("expert");
    const thp = t.player.hp;
    t = settle(reveal(t, DIRTY));
    expect(t.player.hp).toBe(thp - 3);
  }, 30000);
  it("the boosts: Lofty Goals and Dirty Trick deal indirect damage per character, Dark Arts places threat per character", () => {
    let s = started();
    useAvatar(s, KNAVE);
    const ally = makePiece(s, "01083");
    ally.ownerId = "p1";
    s.player.inPlay.push(ally);
    stack(s, LOFTY);
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    // Knave ATK 1 and 2 indirect damage, spread by the player.
    const taken =
      hp - s.player.hp + s.player.inPlay.find((p) => p.id === ally.id)!.damage;
    expect(taken).toBe(3);
    let t = started();
    useAvatar(t, KNAVE);
    stack(t, DARK_ARTS);
    const threat = t.scheme.threat;
    t.player.form = "alter";
    t = settle(native(t, { type: "enemyScheme", id: t.villain.id }));
    // Knave SCH 2 and 1 threat per character.
    expect(t.scheme.threat).toBe(threat + 3);
  }, 30000);
});

describe("Synergy environments", () => {
  it("Domineering Force: remove a synergy counter for 4 more damage on a basic attack", () => {
    let s = started();
    synergyOf(s, DOMINEERING).counters = 1;
    const hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === `synergy:${DOMINEERING}`)?.id ||
        v.prompt?.options.find((o) => o.id === "villain")?.id,
    );
    expect(hp - s.villain.hp).toBe(4 + (card("01010a").attack || 0));
    expect(synergyOf(s, DOMINEERING).counters).toBe(0);
    exact(s);
  }, 30000);
  it("Mounting Resistance: remove a synergy counter for 4 more threat removed on a basic thwart", () => {
    let s = started();
    synergyOf(s, MOUNTING).counters = 1;
    s.scheme.threat = 7;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = settle(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === `synergy:${MOUNTING}`)?.id ||
        v.prompt?.options.find((o) => o.id === "main")?.id,
    );
    expect(s.scheme.threat).toBe(7 - 4 - (card("01010a").thwart || 0));
    expect(synergyOf(s, MOUNTING).counters).toBe(0);
    exact(s);
  }, 30000);
  it("Feigned Retreat: remove a synergy counter to prevent 4 damage to an identity", () => {
    let s = started();
    synergyOf(s, FEIGNED).counters = 1;
    const hp = s.player.hp;
    s = settle(
      native(s, hit("hero:p1", 6, "encounter")),
      (v) => v.prompt?.options.find((o) => o.id === "feigned-retreat")?.id,
    );
    expect(synergyOf(s, FEIGNED).counters).toBe(0);
    expect(s.player.hp).toBe(hp - 2);
    // An attack's damage, once per attack.
    let t = started("standard", 2);
    useAvatar(t, MISCREANT);
    synergyOf(t, FEIGNED).counters = 2;
    blankTop(t, 2);
    const thp = t.player.hp;
    t = settle(
      native(t, { type: "enemyAttack", id: t.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === "feigned-retreat")?.id,
    );
    expect(synergyOf(t, FEIGNED).counters).toBe(1);
    expect(t.player.hp).toBe(thp);
    exact(t);
  }, 30000);
  it("Unified Front: remove a synergy counter for 2 wild resources", () => {
    let s = started();
    const front = synergyOf(s, UNIFIED);
    front.counters = 1;
    const source = paymentSources(s).find((x) => x.id === front.id)!;
    expect(source.resources).toEqual(["wild", "wild"]);
    const helicarrier = playerCard(s, "01092");
    const resource = makePiece(s, "01088");
    resource.ownerId = "p1";
    s.player.hand.push(helicarrier, resource);
    s = command(s, { type: "PLAY", id: helicarrier.id });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(s, [resource], undefined, [front.id]));
    expect(s.player.inPlay.some((p) => p.id === helicarrier.id)).toBe(true);
    expect(synergyOf(s, UNIFIED).counters).toBe(0);
    exact(s);
  }, 30000);
  it("synergy counters stop at 1 per player", () => {
    let s = started();
    s = settle(native(s, G("synergy", { code: UNIFIED, n: 3 })));
    expect(synergyOf(s, UNIFIED).counters).toBe(1);
  }, 30000);
});
