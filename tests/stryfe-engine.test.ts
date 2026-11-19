/** NeXt Evolution: Stryfe with Hope Summers and the Extreme Measures and
 * Mutant Insurrection modular sets, exercised with the original physical
 * cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  handSize,
  heroStats,
  scenarioModules,
} from "../src/game/cards";
import {
  abilityOptions,
  allyCount,
  cardCost,
  enemyStats,
  newGame,
} from "../src/game/engine";
import {
  EXTREME_MEASURES_CODES,
  MUTANT_INSURRECTION_CODES,
  STRYFE_SCRIPT_CODES,
  commonType,
} from "../src/game/stryfe";
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
  villainId = "stryfe",
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
  villainId = "stryfe",
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
/** An original encounter card with boost icons but no boost ability on top
 * of the encounter deck. */
function plain(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) =>
      !card(p).boost_star &&
      (card(p).boost || 0) >= 1 &&
      card(p).type_code !== "minion",
  );
  const [p] = s.encounter.deck.splice(i, 1);
  stack(s, p);
  return card(p).boost || 0;
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
const hit = (target: string, amount: number, source = "hero"): Effect => ({
  type: "damage",
  target,
  amount,
  source,
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const hope = (s: GameState) =>
  s.players
    .flatMap((seat) => seatView(s, seat).player.inPlay)
    .find((p) => p.code === "40130");
const grasp = (s: GameState) =>
  s.sideSchemes.find((p) => p.code.startsWith("40168"));
/** Clear the villain's tough status cards. */
function untough(s: GameState) {
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return reload(s);
}
/** Put cards of one type from the deck into the hand. */
function handOf(s: GameState, type: string, n: number) {
  const cards = s.player.deck.filter((p) => card(p).type_code === type);
  for (const p of cards.slice(0, n)) fromDeck(s, p.code);
  return reload(s);
}

describe("Stryfe: original source", () => {
  it("registers every face of the Stryfe, Extreme Measures and Mutant Insurrection sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "next_evol" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(STRYFE_SCRIPT_CODES)).toEqual(new Set(faces("stryfe")));
    expect(new Set(EXTREME_MEASURES_CODES)).toEqual(
      new Set(faces("extreme_measures")),
    );
    expect(new Set(MUTANT_INSURRECTION_CODES)).toEqual(
      new Set(faces("mutant_insurrection")),
    );
    for (const code of [
      ...STRYFE_SCRIPT_CODES,
      ...EXTREME_MEASURES_CODES,
      ...MUTANT_INSURRECTION_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "stryfe")).toMatchObject({
      codes: ["40163", "40164", "40165"],
      defaultModules: ["extreme_measures", "mutant_insurrection"],
    });
    expect(MODULES.slice(-6, -4).map((m) => m.id)).toEqual([
      "extreme_measures",
      "mutant_insurrection",
    ]);
  });

  it("starts with Hope Summers beside the first player and Stryfe's Grasp in play", () => {
    for (const [difficulty, code] of [
      ["standard", "40163"],
      ["expert", "40164"],
    ] as const)
      for (const players of [1, 2]) {
        const s = started(difficulty, players);
        expect(s.villain.code).toBe(code);
        expect(s.scheme.code).toBe("40166b");
        const g = grasp(s)!;
        expect(g.code).toBe("40168a");
        // 4 threat and hinder 6 per player.
        expect(g.counters).toBe(4 + 6 * players);
        expect(s.encounter.deck.some((p) => p.code.startsWith("40168"))).toBe(
          false,
        );
        const first = seatView(s, s.firstPlayerId).player;
        expect(first.inPlay.filter((p) => p.code === "40130")).toHaveLength(1);
      }
  });
});

describe("Stryfe", () => {
  it("gets +X ATK while attacking you, X being your most common card type", () => {
    let s = handOf(started(), "event", 3);
    expect(commonType(s, "p1")).toBeGreaterThanOrEqual(3);
    const hp = s.player.hp;
    s = settle(native(s, villainAttack(s)));
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(
      card(s.villain).attack! + 3,
    );
  });

  it("Uncontrollable Power: after step one each player places threat equal to their most common card type", () => {
    let s = handOf(started(), "event", 2);
    const x = commonType(s, "p1");
    const threat = s.scheme.threat;
    s = settle(
      native(s, { type: "stryfe:power", playerId: "p1", actorId: "p1" }),
    );
    expect(s.scheme.threat).toBe(threat + x);
  });

  it("removing the last threat from Stryfe's Grasp flips it to Living Bomb and advances to Left to Your Fate", () => {
    let s = started();
    const g = grasp(s)!;
    s = settle(
      native(s, {
        type: "thwart",
        target: g.id,
        amount: g.counters,
        source: "hero",
      }),
    );
    expect(grasp(s)?.code).toBe("40168b");
    expect(grasp(s)?.counters).toBe(3);
    expect(s.scheme.code).toBe("40167b");
  });

  it("Living Bomb: Stryfe cannot be defeated until it is gone", () => {
    let s = untough(started("expert"));
    const g = grasp(s)!;
    s = settle(
      native(s, {
        type: "thwart",
        target: g.id,
        amount: g.counters,
        source: "hero",
      }),
    );
    s = untough(s);
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.phase).not.toBe("won");
    expect(s.villain.hp).toBe(0);
    const bomb = grasp(s)!;
    s = settle(
      native(s, {
        type: "thwart",
        target: bomb.id,
        amount: bomb.counters,
        source: "hero",
      }),
    );
    expect(s.villain.code).toBe("40165");
  });

  it("defeating Stryfe flips Stryfe's Grasp with its threat", () => {
    let s = untough(started());
    const threat = grasp(s)!.counters;
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.villain.code).toBe("40164");
    expect(grasp(s)?.code).toBe("40168b");
    expect(grasp(s)?.counters).toBe(3 + threat);
    expect(s.scheme.code).toBe("40167b");
  });

  it("Left to Your Fate: +2 hand size, player cards cost 1 more, Stryfe is stalwart", () => {
    let s = started();
    const before = handSize(s);
    s.scheme.code = "40167b";
    s.scheme.index = 1;
    s = reload(s);
    expect(handSize(s)).toBe(before + 2);
    const c = card(s.player.deck.find((p) => card(p).cost)!);
    expect(cardCost(s, c)).toBeGreaterThanOrEqual((c.cost || 0) + 1);
  });
});

describe("Stryfe encounter cards", () => {
  it("Psychic Inertia gives your hero -1 ATK and -1 THW", () => {
    let s = started();
    const atk = heroStats(s).attack;
    const thw = heroStats(s).thwart;
    s = settle(resolveEncounter(reveal(s, "40173")));
    expect(heroStats(s).attack).toBe(atk - 1);
    expect(heroStats(s).thwart).toBe(thw - 1);
  });

  it("Mental Transferal: after Stryfe takes damage, Hope Summers takes as much", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, "40169")));
    expect(s.attachments.find((a) => a.code === "40169")?.attachedTo).toBe(
      hope(s)!.id,
    );
    s = settle(native(s, hit(s.villain.id, 1)));
    expect(hope(s)?.damage).toBe(1);
    expect(s.attachments.some((a) => a.code === "40169")).toBe(false);
  });

  it("Telepathic Camouflage takes threat equal to each player's most common card type", () => {
    let s = handOf(started(), "event", 2);
    const x = commonType(s, "p1");
    s = settle(resolveEncounter(reveal(s, "40176")));
    const scheme = s.sideSchemes.find((p) => p.code === "40176")!;
    expect(scheme.counters).toBe(card("40176").base_threat! + x);
  });

  it("Mutant Insurrection: 2 threat for each Mutant Liberation Front character, or surge", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "40189")));
    const scheme = s.sideSchemes.find((p) => p.code === "40189")!;
    // Stryfe himself is a Mutant Liberation Front villain.
    expect(scheme.counters).toBeGreaterThanOrEqual(
      card("40189").base_threat! + 2,
    );
  });

  it("Mutant Insurrection gives each minion entering play toughness", () => {
    let s = started("standard", 1, "rhino", ["mutant_insurrection"]);
    const scheme = take(s, "40189");
    scheme.counters = 5;
    s.sideSchemes.push(scheme);
    s = settle(resolveEncounter(reveal(reload(s), "40185")));
    expect(s.minions.find((m) => m.code === "40185")?.tough).toBe(true);
  });

  it("Thumbelina returns your highest-cost upgrade to your hand", () => {
    let s = started();
    const upgrade = ally(
      s,
      s.player.deck.find((p) => card(p).type_code === "upgrade")!.code,
    );
    s = settle(resolveEncounter(reveal(reload(s), "40182")));
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(false);
    expect(s.player.hand.some((p) => p.id === upgrade.id)).toBe(true);
  });
});
