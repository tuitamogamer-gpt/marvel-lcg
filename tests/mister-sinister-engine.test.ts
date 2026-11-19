/** NeXt Evolution: Mister Sinister with his superpower sets and Hope
 * Summers, exercised with the original physical cards. Every command
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
  allyCount,
  enemyStats,
  newGame,
} from "../src/game/engine";
import {
  FLIGHT_CODES,
  MISTER_SINISTER_SCRIPT_CODES,
  POWERS,
  STAGE_TWO,
  SUPER_STRENGTH_CODES,
  TELEPATHY_CODES,
  sinisterKeyword,
  superpowers,
  villainHas,
} from "../src/game/mister-sinister";
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
  villainId = "mister_sinister",
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
  villainId = "mister_sinister",
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
const atk = (s: GameState) => enemyStats(s, s.villain).attack;
/** Give the villain this stage 2's superpower straight from the set-aside
 * pile. */
function power(s: GameState, stage: string) {
  const { set, power: code } = POWERS[stage];
  const group = s.sinister!.setAside.find((g) => g.set === set)!;
  const p = group.pieces.find((q) => q.code === code)!;
  group.pieces = group.pieces.filter((q) => q !== p);
  p.attachedTo = s.villain.id;
  s.attachments.push(p);
  return reload(s);
}
/** Clear the villain's tough status cards. */
function untough(s: GameState) {
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return reload(s);
}
/** Put a set-aside card into the encounter deck. */
function unsetAside(s: GameState, code: string) {
  for (const group of s.sinister!.setAside) {
    const p = group.pieces.find((q) => q.code === code);
    if (p) {
      group.pieces = group.pieces.filter((q) => q !== p);
      s.encounter.deck.unshift(p);
      return p;
    }
  }
  return undefined;
}

describe("Mister Sinister: original source", () => {
  it("registers every face of the Mister Sinister, Flight, Super Strength and Telepathy sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "next_evol" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(MISTER_SINISTER_SCRIPT_CODES)).toEqual(
      new Set(faces("mister_sinister")),
    );
    expect(new Set(FLIGHT_CODES)).toEqual(new Set(faces("flight")));
    expect(new Set(SUPER_STRENGTH_CODES)).toEqual(
      new Set(faces("super_strength")),
    );
    expect(new Set(TELEPATHY_CODES)).toEqual(new Set(faces("telepathy")));
    for (const code of [
      ...MISTER_SINISTER_SCRIPT_CODES,
      ...FLIGHT_CODES,
      ...SUPER_STRENGTH_CODES,
      ...TELEPATHY_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "mister_sinister")).toMatchObject({
      codes: ["40136", "40137", "40138"],
      module: "nasty_boys",
    });
    expect(scenarioModules("mister_sinister")).toHaveLength(MODULES.length);
  });

  it("removes a random stage 2, starts on another with its superpower attached, and puts Hope Summers beside the first player", () => {
    for (const [difficulty, code] of [
      ["standard", "40136"],
      ["expert", "40137"],
    ] as const)
      for (const players of [1, 2]) {
        const s = started(difficulty, players);
        expect(s.villain.code).toBe(code);
        const st = s.sinister!;
        expect(STAGE_TWO).toContain(st.removed);
        expect(st.visited).toHaveLength(1);
        expect(st.visited[0]).not.toBe(st.removed);
        expect(s.scheme.code).toBe(st.visited[0]);
        // Mister Sinister (II)'s When Revealed adds 2 threat per player with
        // fewer than 2 superpowers.
        expect(s.scheme.threat).toBe(
          players * (difficulty === "expert" ? 3 : 1),
        );
        const { power: attached, set } = POWERS[st.visited[0]];
        expect(s.attachments.find((a) => a.code === attached)?.attachedTo).toBe(
          s.villain.id,
        );
        expect(superpowers(s)).toBe(1);
        // The rest of that set is in the encounter deck; the other two sets
        // stay aside.
        expect(st.setAside.map((g) => g.set).sort()).toEqual(
          ["flight", "super_strength", "telepathy"]
            .filter((x) => x !== set)
            .sort(),
        );
        expect(s.encounter.deck.some((p) => card(p).set_code === set)).toBe(
          true,
        );
        const first = seatView(s, s.firstPlayerId).player;
        expect(first.inPlay.filter((p) => p.code === "40130")).toHaveLength(1);
        expect(allyCount(s)).toBe(0);
      }
  });
});

describe("Mister Sinister's main scheme", () => {
  it("a completed stage 2 advances to the other, then to Sinister Ends, which loses when completed", () => {
    let s = started();
    const st = s.sinister!;
    const first = st.visited[0];
    s.scheme.threat = 5 - 1;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.phase).not.toBe("lost");
    const second = s.sinister!.visited[1];
    expect(second).toBeTruthy();
    expect([first, s.sinister!.removed]).not.toContain(second);
    expect(s.scheme.code).toBe(second);
    expect(superpowers(s)).toBe(2);
    s.scheme.threat = 5 - 1;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.scheme.code).toBe("40143b");
    // Sinister Ends (3A) dealt each player an encounter card.
    s.scheme.threat = 7 - 1;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.phase).toBe("lost");
  });

  it("each status card placed on Mister Sinister places threat on the main scheme", () => {
    let s = started();
    const threat = s.scheme.threat;
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.scheme.threat).toBe(threat + 1);
  });

  it("Sinister Ends: Mister Sinister attacks Hope Summers instead", () => {
    let s = started();
    s.scheme.code = "40143b";
    s.scheme.index = 4;
    s.scheme.threat = 0;
    s = reload(s);
    const p = hope(s)!;
    const hp = s.player.hp;
    s = settle(native(s, villainAttack(s)));
    expect(s.player.hp).toBe(hp);
    // Hope took the attack (or was defeated, losing the game).
    const after = hope(s);
    expect(!after || (after.damage || 0) > 0 || s.phase === "lost").toBe(true);
    expect(p).toBeTruthy();
  });
});

describe("Superpowers", () => {
  it("Flight gives Aerial and overkill, Super Strength Brute and steady, Telepathy Psionic and retaliate 1", () => {
    let s = started();
    for (const stage of STAGE_TWO)
      if (!s.attachments.some((a) => a.code === POWERS[stage].power))
        if (s.sinister!.setAside.some((g) => g.set === POWERS[stage].set))
          s = power(s, stage);
    expect(villainHas(s, "Aerial")).toBe(true);
    expect(villainHas(s, "Brute")).toBe(true);
    expect(villainHas(s, "Psionic")).toBe(true);
    expect(sinisterKeyword(s, s.villain, "Overkill")).toBe(1);
    expect(sinisterKeyword(s, s.villain, "Retaliate")).toBe(1);
    expect(superpowers(s)).toBe(3);
  });
});

describe("Mister Sinister encounter cards", () => {
  it("Teleported Away: the villain cannot take damage and schemes instead of attacking", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, "40146")));
    const hp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(hp);
    const heroHp = s.player.hp;
    const threat = s.scheme.threat;
    s = settle(native(s, villainAttack(s)));
    expect(s.player.hp).toBe(heroHp);
    expect(s.scheme.threat).toBeGreaterThanOrEqual(threat);
  });

  it("Sinister Disguise: without 2 mental resources the damage goes to the friendly character with the fewest hit points", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, "40144")));
    expect(s.attachments.find((a) => a.code === "40144")?.attachedTo).toBe(
      s.villain.id,
    );
    const hp = s.villain.hp;
    s = native(s, hit(s.villain.id, 2));
    s = settle(s, (v) =>
      v.prompt?.options.some((o) => o.id === "redirect")
        ? "redirect"
        : undefined,
    );
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((a) => a.code === "40144")).toBe(false);
    // Hope Summers (3 hit points) is the weakest friendly character.
    const p = hope(s);
    expect(!p || (p.damage || 0) === 2).toBe(true);
  });

  it("Molecular Control gives Mister Sinister a tough status card", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, "40148")));
    expect(s.villain.tough).toBe(true);
  });

  it("Sinister Strike: in hero form Mister Sinister attacks you", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "40150")));
    expect(s.player.hp).toBeLessThan(hp);
  });
});

describe("Superpower encounter cards", () => {
  it("Out of Reach: the villain takes no damage unless the attack is Aerial or ranged", () => {
    let s = untough(started());
    unsetAside(s, "40153");
    s = settle(resolveEncounter(reveal(reload(s), "40153")));
    expect(s.attachments.find((a) => a.code === "40153")?.attachedTo).toBe(
      s.villain.id,
    );
    const hp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(hp);
  });

  it("Impervious: 1 less damage from each attack", () => {
    let s = untough(started());
    unsetAside(s, "40156");
    s = settle(resolveEncounter(reveal(reload(s), "40156")));
    const hp = s.villain.hp;
    s = settle(command(s, { type: "BASIC", action: "attack" }), (v) =>
      v.prompt?.options.some((o) => o.id === v.villain.id)
        ? v.villain.id
        : undefined,
    );
    expect(hp - s.villain.hp).toBe(heroStats(s).attack - 1);
  });

  it("Thrown Object gives the villain ranged and is discarded after he attacks", () => {
    let s = started();
    unsetAside(s, "40157");
    s = settle(resolveEncounter(reveal(reload(s), "40157")));
    expect(sinisterKeyword(s, s.villain, "Ranged")).toBe(1);
    s = settle(native(s, villainAttack(s)));
    expect(s.attachments.some((a) => a.code === "40157")).toBe(false);
  });

  it('"I\'ll Take That" discards your lowest-cost upgrade', () => {
    let s = started();
    const upgrade = ally(s, "01008");
    unsetAside(s, "40158");
    s = settle(resolveEncounter(reveal(reload(s), "40158")));
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(false);
  });

  it("Sowing Discord exhausts your allies, stays in play, and keeps them from readying", () => {
    let s = started();
    const code = s.player.deck.find((p) => card(p).type_code === "ally")!.code;
    const spiderWoman = ally(s, code);
    unsetAside(s, "40161");
    s = settle(resolveEncounter(reveal(reload(s), "40161")));
    expect(s.player.inPlay.some((p) => p.code === "40161")).toBe(true);
    expect(
      s.player.inPlay.find((p) => p.id === spiderWoman.id)?.exhausted,
    ).toBe(true);
    s = settle(native(s, { type: "ready", id: spiderWoman.id }));
    expect(
      s.player.inPlay.find((p) => p.id === spiderWoman.id)?.exhausted,
    ).toBe(true);
  });

  it("One Step Ahead discards a random card from your hand", () => {
    let s = started();
    fromDeck(s, "01003");
    fromDeck(s, "01004");
    s = reload(s);
    const hand = s.player.hand.length;
    unsetAside(s, "40162");
    s = settle(resolveEncounter(reveal(reload(s), "40162")));
    expect(s.player.hand.length).toBe(hand - (villainHas(s, "Aerial") ? 2 : 1));
  });
});
