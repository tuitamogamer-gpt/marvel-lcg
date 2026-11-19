/** NeXt Evolution: Morlock Siege with its Marauders villain deck, Routed
 * and the Morlocks, and the Military Grade and Mutant Slayers modular sets,
 * exercised with the original physical cards. Every command crosses a JSON
 * save/reload boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, MODULES, VILLAINS, card } from "../src/game/cards";
import { allyCount, enemyStats, newGame } from "../src/game/engine";
import { isTextBlank } from "../src/game/card-text";
import { captainAbilityOptions } from "../src/game/captain-america";
import {
  MILITARY_GRADE_CODES,
  MORLOCK_SIEGE_SCRIPT_CODES,
  MUTANT_SLAYERS_CODES,
  morlockKeyword,
  morlockStatusModifiers,
} from "../src/game/morlock-siege";
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
  villainId = "morlock_siege",
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
  villainId = "morlock_siege",
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

describe("Morlock Siege: original source", () => {
  it("registers every face of the Marauders, Morlock Siege, Military Grade and Mutant Slayers sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "next_evol" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(MORLOCK_SIEGE_SCRIPT_CODES)).toEqual(
      new Set([...faces("marauders"), ...faces("morlock_siege")]),
    );
    expect(MORLOCK_SIEGE_SCRIPT_CODES).toHaveLength(30);
    expect(new Set(MILITARY_GRADE_CODES)).toEqual(
      new Set(faces("military_grade")),
    );
    expect(new Set(MUTANT_SLAYERS_CODES)).toEqual(
      new Set(faces("mutant_slayers")),
    );
    for (const code of [
      ...MORLOCK_SIEGE_SCRIPT_CODES,
      ...MILITARY_GRADE_CODES,
      ...MUTANT_SLAYERS_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "morlock_siege")).toMatchObject({
      schemes: ["40077b", "40078b"],
      moduleCount: 2,
      defaultModules: ["military_grade", "mutant_slayers"],
    });
    expect(MODULES.slice(-2).map((m) => m.id)).toEqual([
      "military_grade",
      "mutant_slayers",
    ]);
  });

  it("shuffles the seven Marauders into the villain deck and sets Hide! and the Morlocks aside", () => {
    for (const [difficulty, side, env] of [
      ["standard", "a", "40081a"],
      ["expert", "b", "40081b"],
    ] as const)
      for (const players of [1, 2]) {
        const s = started(difficulty, players);
        const st = s.morlockSiege!;
        expect(s.villain.code.endsWith(side)).toBe(true);
        expect(s.villain.hp).toBe(card(s.villain).health! * players);
        expect(st.villainDeck).toHaveLength(6);
        expect(
          new Set(
            [s.villain, ...st.villainDeck].map((p) => p.code.slice(0, 5)),
          ),
        ).toEqual(
          new Set([
            "40070",
            "40071",
            "40072",
            "40073",
            "40074",
            "40075",
            "40076",
          ]),
        );
        expect(routedCard(s)?.code).toBe(env);
        expect(st.setAside.map((p) => p.code).sort()).toEqual([
          "40079",
          "40079",
          "40079",
          "40079",
          "40080",
        ]);
        const deck = s.encounter.deck.map((p) => p.code);
        expect(deck).not.toContain("40079");
        expect(deck).not.toContain("40080");
        expect(s.scheme).toMatchObject({ code: "40077b", threat: players });
      }
  });
});

describe("Routed and the villain deck", () => {
  it("routes the defeated villain, discards minions sharing the next one's title and activates the next against each player", () => {
    let s = started("standard", 2);
    const next = s.morlockSiege!.villainDeck[0];
    // A Mutant Slayers minion with the next villain's title.
    const minionCode = {
      "40070a": "40094",
      "40071a": "40095",
      "40072a": "40096",
      "40073a": "40097",
      "40074a": "40098",
      "40075a": "40099",
      "40076a": "40100",
    }[next.code]!;
    const minion = take(s, minionCode);
    s.minions.push(minion);
    const before = s.players.map((seat) => seatView(s, seat).player.hp);
    const threat = s.scheme.threat;
    const old = s.villain.code;
    s = settle(native(reload(s), hit(s.villain.id, s.villain.hp)));
    expect(routed(s)).toBe(1);
    expect(s.morlockSiege!.routed[0].code).toBe(old);
    expect(s.villain.code).toBe(next.code);
    expect(s.villain.hp).toBe(card(next).health! * 2);
    expect(s.minions.some((m) => m.id === minion.id)).toBe(false);
    // Activated against each hero: an attack or, with SCH and no ATK,
    // threat.
    const after = s.players.map((seat) => seatView(s, seat).player.hp);
    const attacked = after.filter((hp, i) => hp < before[i]).length;
    expect(attacked + (s.scheme.threat > threat ? 1 : 0)).toBeGreaterThan(0);
  });

  it("the players win when the third villain is routed", () => {
    let s = started();
    for (let i = 0; i < 3; i++) {
      expect(s.phase).not.toBe("won");
      s.villain.hp = 1;
      s = settle(native(reload(s), hit(s.villain.id, 1)));
    }
    expect(routed(s)).toBe(3);
    expect(s.phase).toBe("won");
  });

  it("a defeated villain's attachments and status cards do not carry over", () => {
    let s = started();
    s = settle(reveal(s, "40082"));
    s.villain.confused = true;
    const old = s.villain.id;
    s = settle(native(reload(s), hit(s.villain.id, s.villain.hp)));
    expect(s.villain.id).not.toBe(old);
    expect(s.attachments.some((a) => a.code === "40082")).toBe(false);
    expect(s.encounter.discard.map((p) => p.code)).toContain("40082");
    expect(s.morlockSiege!.routed[0].confused).toBe(false);
  });

  it("Routed (expert): the villain gains retaliate 1 for each villain under it", () => {
    let s = started("expert");
    expect(morlockKeyword(s, s.villain, "Retaliate")).toBe(0);
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(routed(s)).toBe(2);
    expect(morlockKeyword(s, s.villain, "Retaliate")).toBe(2);
  });
});

describe("The main schemes", () => {
  it("Knock, Knock: a knock counter after step one; the third advances to Mutant Massacre with tough Morlocks", () => {
    let s = started("standard", 1);
    for (let i = 0; i < 3; i++)
      s = settle(native(reload(s), { type: "msg:knock", actorId: "p1" }));
    expect(s.scheme.code).toBe("40078b");
    expect(s.scheme.threat).toBe(0);
    // Two Morlocks in a solo game, each with a tough status card.
    const morlocks = s.player.inPlay.filter((p) => p.code === "40079");
    expect(morlocks).toHaveLength(2);
    expect(morlocks.every((p) => p.tough)).toBe(true);
    expect(s.encounter.deck.map((p) => p.code)).toContain("40080");
  });

  it("the villain phase places the knock counter after step one", () => {
    let s = started();
    s = settle(native(s, { type: "villainStepOne", actorId: "p1" }));
    expect(s.morlockSiege!.knocks).toBe(1);
  });

  it("completing Knock, Knock advances to Mutant Massacre without tough Morlocks, one per player", () => {
    let s = started("standard", 2);
    s.scheme.threat = 11;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.scheme.code).toBe("40078b");
    for (const seat of s.players) {
      const morlocks = seatView(s, seat).player.inPlay.filter(
        (p) => p.code === "40079",
      );
      expect(morlocks).toHaveLength(1);
      expect(morlocks[0].tough).toBe(false);
    }
  });

  it("Mutant Massacre: the players lose with no Morlock left in play", () => {
    let s = started();
    s.scheme.threat = 6;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 0 }),
    );
    s = settle(native(reload(s), { type: "msg:knock", actorId: "p1" }));
    s.morlockSiege!.knocks = 2;
    s = settle(native(reload(s), { type: "msg:knock", actorId: "p1" }));
    const morlocks = s.player.inPlay.filter((p) => p.code === "40079");
    expect(morlocks).toHaveLength(2);
    // Advanced by knock counters: each Morlock has a tough status card.
    for (const m of morlocks) m.tough = false;
    s = settle(native(reload(s), hit(morlocks[0].id, 10)));
    expect(s.phase).not.toBe("lost");
    // Victory -1: the defeated Morlock enters the victory display.
    expect(s.victoryDisplay?.map((p) => p.code)).toContain("40079");
    s = settle(native(s, hit(morlocks[1].id, 10)));
    expect(s.phase).toBe("lost");
  });

  it("Mutant Massacre's Action exhausts a Morlock to shuffle Hide! back into the encounter deck", () => {
    let s = started();
    s.morlockSiege!.knocks = 2;
    s = settle(native(reload(s), { type: "msg:knock", actorId: "p1" }));
    const hide = take(s, "40080");
    s.encounter.discard.push(hide);
    const m = s.player.inPlay.find((p) => p.code === "40079")!;
    s = settle(
      command(reload(s), { type: "ABILITY", id: m.id, action: "hide" }),
    );
    expect(s.player.inPlay.find((p) => p.id === m.id)?.exhausted).toBe(true);
    expect(s.encounter.deck.map((p) => p.code)).toContain("40080");
    expect(s.encounter.discard.map((p) => p.code)).not.toContain("40080");
  });
});

describe("The Morlocks", () => {
  it("do not count against the ally limit and take the enemy attacks instead of you", () => {
    let s = started();
    const before = allyCount(s);
    const m = morlock(s);
    expect(allyCount(reload(s))).toBe(before);
    const hp = s.player.hp;
    s = lead(s, "40071");
    s = settle(native(s, villainAttack(s)), (v) =>
      v.prompt?.options.some((o) => o.id === "bonus") ? "bonus" : undefined,
    );
    expect(s.player.hp).toBe(hp);
    expect(
      s.player.inPlay.find((p) => p.id === m.id)?.damage ?? 5,
    ).toBeGreaterThan(0);
  });
});

describe("Morlock actions", () => {
  it("a Morlock attacks like any other ally", () => {
    let s = started();
    const m = morlock(s);
    const hp = s.villain.hp;
    s = settle(
      command(reload(s), { type: "ABILITY", id: m.id, action: "attack" }),
    );
    expect(s.villain.hp).toBe(hp - 1);
    expect(s.player.inPlay.find((p) => p.id === m.id)?.exhausted).toBe(true);
  });
});

describe("The Marauders' Forced Interrupts", () => {
  it("Blockbuster: a tough status card or +2 ATK", () => {
    let s = lead(started(), "40071");
    const icons = plainBoost(s);
    const hp = s.player.hp;
    s = settle(native(reload(s), villainAttack(s)), (v) =>
      v.prompt?.options.some((o) => o.id === "bonus") ? "bonus" : undefined,
    );
    expect(hp - s.player.hp).toBe(2 + 2 + icons);
    s = lead(started(), "40071");
    s = settle(native(s, villainAttack(s)), (v) =>
      v.prompt?.options.some((o) => o.id === "tough") ? "tough" : undefined,
    );
    expect(s.villain.tough).toBe(true);
  });

  it("Arclight: confuse a character you control", () => {
    let s = lead(started(), "40070");
    s = settle(
      native(s, villainAttack(s)),
      (v) => v.prompt?.options.find((o) => o.id.startsWith("confused:"))?.id,
    );
    expect(s.player.confused).toBe(true);
  });

  it("Vertigo: stun a character you control", () => {
    let s = lead(started(), "40076");
    s = settle(
      native(s, villainAttack(s)),
      (v) => v.prompt?.options.find((o) => o.id.startsWith("stunned:"))?.id,
    );
    expect(s.player.stunned).toBe(true);
  });

  it("Riptide: 2 threat on the main scheme and 1 on each side scheme", () => {
    let s = lead(started(), "40075");
    s = settle(reveal(s, "40084"));
    const scheme = s.sideSchemes.find((p) => p.code === "40084")!;
    const side = scheme.counters;
    const main = s.scheme.threat;
    s = settle(native(s, villainAttack(s)), (v) =>
      v.prompt?.options.some((o) => o.id === "threat") ? "threat" : undefined,
    );
    expect(s.scheme.threat).toBe(main + 2);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(
      side + 1,
    );
  });

  it("Harpoon: 2 indirect damage or an additional boost card", () => {
    let s = lead(started(), "40074");
    const hp = s.player.hp;
    s = settle(native(s, villainAttack(s)), (v) =>
      v.prompt?.options.some((o) => o.id === "indirect")
        ? "indirect"
        : undefined,
    );
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(2);
    s = lead(started(), "40074");
    const deck = s.encounter.deck.length;
    s = settle(native(s, villainAttack(s)), (v) =>
      v.prompt?.options.some((o) => o.id === "bonus") ? "bonus" : undefined,
    );
    // Two boost cards instead of one.
    expect(deck - s.encounter.deck.length).toBe(2);
  });

  it("Greycrow: discard the highest-cost card you control, or +X ATK", () => {
    let s = lead(started(), "40073");
    const daredevil = ally(s, "01058");
    const tracer = ally(s, "01007");
    s = settle(native(reload(s), villainAttack(s)), (v) =>
      v.prompt?.options.some((o) => o.id === "discard") ? "discard" : undefined,
    );
    // Daredevil costs 4, Spider-Tracer 1.
    expect(s.player.inPlay.some((p) => p.id === daredevil.id)).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === tracer.id)).toBe(true);
  });

  it("Chimera: spend a mental resource, or +2 ATK", () => {
    let s = lead(started(), "40072");
    const mental = fromDeck(s, "01004");
    s = toPayment(native(reload(s), villainAttack(s)), (v) =>
      v.prompt?.options.some((o) => o.id === "mental") ? "mental" : undefined,
    );
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(s, [mental]));
    expect(s.player.discard.map((p) => p.code)).toContain("01004");
  });
});

describe("Morlock Siege encounter cards", () => {
  it("Hide!: surge and a tough status card for a Morlock", () => {
    let s = started();
    const m = morlock(s);
    s = settle(reveal(reload(s), "40080"));
    expect(s.player.inPlay.find((p) => p.id === m.id)?.tough).toBe(true);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1")).toHaveLength(1);
  });

  it("Bolstered by Wrath: +1 ATK and SCH; its boost counts the villains under Routed", () => {
    let s = started();
    const stats = enemyStats(s, s.villain);
    s = settle(reveal(s, "40082"));
    expect(enemyStats(s, s.villain)).toMatchObject({
      attack: stats.attack + 1,
      scheme: stats.scheme + 1,
    });
  });

  it("Bolstered by Wrath's Hero Action: exhaust a character and spend X resources", () => {
    let s = started();
    s = settle(reveal(s, "40082"));
    const bolstered = s.attachments.find((a) => a.code === "40082")!;
    // No villain under Routed: X is 0.
    s = settle(
      command(reload(s), {
        type: "ABILITY",
        id: bolstered.id,
        action: "discard",
      }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.attachments.some((a) => a.id === bolstered.id)).toBe(false);
  });

  it("Pushed to the Limit: steady with 1 villain under Routed, stalwart with 2", () => {
    let s = started();
    s = settle(reveal(s, "40083"));
    expect(morlockStatusModifiers(s, s.villain)).toEqual({});
    s.morlockSiege!.routed.push(s.morlockSiege!.villainDeck.pop()!);
    expect(morlockStatusModifiers(reload(s), s.villain)).toEqual({
      steady: true,
    });
    s.morlockSiege!.routed.push(s.morlockSiege!.villainDeck.pop()!);
    expect(morlockStatusModifiers(reload(s), s.villain)).toEqual({
      stalwart: true,
    });
  });

  it("Pushed to the Limit's Hero Action: the villain attacks you, then it is discarded", () => {
    let s = started();
    s = settle(reveal(s, "40083"));
    const pushed = s.attachments.find((a) => a.code === "40083")!;
    const hp = s.player.hp;
    s = settle(
      command(reload(s), { type: "ABILITY", id: pushed.id, action: "discard" }),
      (v) =>
        v.prompt?.options.some((o) => o.id === "bonus") ? "bonus" : undefined,
    );
    expect(s.player.hp).toBeLessThan(hp);
    expect(s.attachments.some((a) => a.id === pushed.id)).toBe(false);
  });

  it("the side schemes gain 1 threat per player for each villain under Routed", () => {
    let s = started("standard", 2);
    s.morlockSiege!.routed.push(s.morlockSiege!.villainDeck.pop()!);
    s = settle(reveal(reload(s), "40085"));
    // Fixed 3, plus 2 for one villain under Routed with two players.
    expect(s.sideSchemes.find((p) => p.code === "40085")?.counters).toBe(5);
  });

  it("Territorial Control has assault: basic thwarts use ATK", () => {
    let s = started();
    s = settle(reveal(s, "40087"));
    const scheme = s.sideSchemes.find((p) => p.code === "40087")!;
    const threat = scheme.counters;
    s = settle(command(s, { type: "BASIC", action: "thwart" }), (v) =>
      v.prompt?.options.some((o) => o.id === scheme.id) ? scheme.id : undefined,
    );
    // Spider-Man's ATK 2 instead of his THW 1.
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters ?? 0).toBe(
      Math.max(0, threat - 2),
    );
  });

  it("Back in Action: a tough villain and threat equal to the villains under Routed", () => {
    let s = started();
    s.morlockSiege!.routed.push(s.morlockSiege!.villainDeck.pop()!);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(reload(s), "40088")));
    expect(s.villain.tough).toBe(true);
    expect(s.scheme.threat).toBe(threat + 1);
  });

  it("Seek the Weak: surge in alter-ego form, an attack in hero form", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(resolveEncounter(reveal(reload(s), "40089")));
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1")).toHaveLength(1);
    s = started();
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "40089")), (v) =>
      v.prompt?.options.some((o) => o.id === "bonus") ? "bonus" : undefined,
    );
    expect(s.player.hp).toBeLessThan(hp);
  });
});

describe("Military Grade", () => {
  it("Heavy Armament attaches to the enemy with the highest ATK: +2 ATK and retaliate 2", () => {
    let s = started("standard", 1, "rhino", ["military_grade"]);
    const atk = enemyStats(s, s.villain).attack;
    s = settle(reveal(s, "40090"));
    const armament = s.attachments.find((a) => a.code === "40090")!;
    expect(armament.attachedTo).toBe(s.villain.id);
    expect(enemyStats(s, s.villain).attack).toBe(atk + 2);
    expect(morlockKeyword(s, s.villain, "Retaliate")).toBe(2);
  });

  it("Heavy Armament: after you attack the attached enemy, spend 2 resources of the same type to discard it", () => {
    let s = started("standard", 1, "rhino", ["military_grade"]);
    s = settle(reveal(s, "40090"));
    const armament = s.attachments.find((a) => a.code === "40090")!;
    const a = fromDeck(s, "01003");
    const b = fromDeck(s, "01008");
    s = reload(s);
    s = command(s, { type: "BASIC", action: "attack" });
    s = toPayment(s, (v) =>
      v.prompt?.options.some((o) => o.id === v.villain.id)
        ? v.villain.id
        : v.prompt?.options.some((o) => o.id === "physical")
          ? "physical"
          : undefined,
    );
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(s, [a, b]));
    expect(s.attachments.some((q) => q.id === armament.id)).toBe(false);
  });

  it("Titanium Exoskeleton: the attached enemy takes no more than 2 damage from a single attack", () => {
    let s = started("standard", 1, "rhino", ["military_grade"]);
    s = settle(reveal(s, "40091"));
    const hp = s.villain.hp;
    s = settle(native(s, { ...hit(s.villain.id, 5), attack: true } as Effect));
    expect(hp - s.villain.hp).toBeLessThanOrEqual(2);
  });

  it("Inhibitor Collar blanks your identity's text and gives -1 ATK; its Action discards it", () => {
    let s = started("standard", 1, "rhino", ["military_grade"]);
    s = settle(reveal(s, "40092"));
    const collar = s.attachments.find((a) => a.code === "40092")!;
    expect(collar.attachedTo).toBe("hero:p1");
    expect(isTextBlank(s, "01001a")).toBe(true);
    const hp = s.player.hp;
    s = settle(
      command(reload(s), { type: "ABILITY", id: collar.id, action: "damage" }),
    );
    expect(s.player.hp).toBe(hp - 3);
    expect(s.attachments.some((a) => a.id === collar.id)).toBe(false);
    expect(isTextBlank(s, "01001a")).toBe(false);
  });

  it("Inhibitor Collar hides the abilities of the identity it blanks", () => {
    let s = started(
      "standard",
      1,
      "rhino",
      ["military_grade"],
      [{ heroId: "captain_america", aspect: "leadership" }],
    );
    s.player.exhausted = true;
    fromDeck(s, s.player.deck[0].code);
    s = reload(s);
    expect(captainAbilityOptions(s, "identity")).toHaveLength(1);
    s = settle(reveal(s, "40092"));
    expect(captainAbilityOptions(s, "identity")).toHaveLength(0);
  });

  it("The Senator's Support: Hinder, and when defeated an attachment is discarded and revealed", () => {
    let s = started("standard", 2, "rhino", ["military_grade"]);
    s = settle(reveal(s, "40093"));
    const senator = s.sideSchemes.find((p) => p.code === "40093")!;
    // Fixed 3 plus Hinder 1 per player.
    expect(senator.counters).toBe(5);
    s = settle(
      native(s, {
        type: "thwart",
        target: senator.id,
        amount: 5,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.some((p) => p.id === senator.id)).toBe(false);
    const attachments = s.attachments.filter((a) =>
      ["40090", "40091", "40092"].includes(a.code),
    );
    expect(attachments.length).toBeGreaterThan(0);
  });
});

describe("Mutant Slayers", () => {
  it("the Mutant Slayers side scheme gives each Marauder minion quickstrike and counts mutant characters", () => {
    let s = started(
      "standard",
      2,
      "rhino",
      ["mutant_slayers"],
      [
        { heroId: "spider_man", aspect: "justice" as const },
        { heroId: "colossus", aspect: "protection" as const },
      ],
    );
    s = settle(reveal(s, "40101"));
    const scheme = s.sideSchemes.find((p) => p.code === "40101")!;
    // Fixed 3, plus Colossus (X-Men).
    expect(scheme.counters).toBeGreaterThanOrEqual(4);
    const minion = take(s, "40094");
    s.minions.push(minion);
    expect(morlockKeyword(reload(s), minion, "Quickstrike")).toBe(1);
  });

  it("Bound by Business puts a Marauder minion into play engaged with you", () => {
    let s = started("standard", 1, "rhino", ["mutant_slayers"]);
    s = settle(resolveEncounter(reveal(s, "40102")));
    expect(s.minions.some((m) => card(m).traits?.includes("Marauder"))).toBe(
      true,
    );
  });

  it("a Marauder minion's Forced Interrupt offers its choice", () => {
    let s = started("standard", 1, "rhino", ["mutant_slayers"]);
    const blockbuster = take(s, "40095");
    s.minions.push(blockbuster);
    s = settle(
      native(reload(s), {
        type: "enemyAttack",
        id: blockbuster.id,
        actorId: "p1",
      }),
      (v) =>
        v.prompt?.options.some((o) => o.id === "tough") ? "tough" : undefined,
    );
    expect(s.minions.find((m) => m.id === blockbuster.id)?.tough).toBe(true);
  });
});
