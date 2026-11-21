/** Agents of S.H.I.E.L.D.: Baron Zemo with the S.H.I.E.L.D. and S.H.I.E.L.D.
 * Executive Board sets and the evidence, exercised with the original
 * physical cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  HEROES,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import {
  abilityOptions,
  cardCost,
  enemyStats,
  makePiece,
  newGame,
} from "../src/game/engine";
import { attachmentsFor } from "../src/game/presentation";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  COMBINATIONS,
  MEANS,
  MOTIVES,
  OPPORTUNITIES,
  ZEMO_CODES,
  ZEMO_MODULAR_SETS,
  boardAttachments,
  boardEnvironments,
  moleCombination,
  remainingCombinations,
  zemoAttacked,
  zemoBoost,
  zemoPlayerPhaseEnded,
} from "../src/game/baron-zemo";
import type { Effect, GameState, Piece, Resource } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
const team: Seat[] = [
  { heroId: "captain_marvel", aspect: "aggression" },
  { heroId: "spider_man", aspect: "justice" },
];
const MASKED = "50165a";
const UNMASKED = "50165b";
const MANIPULATIONS = "50167b";
const FIGHTING = "50169b";
const SWORD = "50170";
const FOE = "50171";
const AGENT = "50172";
const DIVIDED = "50173";
const UNDERMINE = "50174";
const WITS = "50175";
const MIGHT = "50176";
const ENDS = "50177";
const TROOPER = "50178";
const WARRANT = "50179";
const DISAVOWED = "50180";
const CMO = "50181a";
const CSO = "50182a";
const CTO = "50183a";
const AIM_ENERGY = "50184a";
const MOCKINGBIRD = "01083";
const HELICARRIER = "01092";

function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "baron_zemo",
  extra: { modules?: string[]; executiveBoard?: boolean } = {},
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 50165,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...extra,
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
  villainId = "baron_zemo",
  extra: { modules?: string[]; executiveBoard?: boolean } = {},
) {
  let s = settle(setup(difficulty, players, villainId, extra));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "baron_zemo",
  extra: { modules?: string[]; executiveBoard?: boolean } = {},
) {
  const s = opened(difficulty, players, villainId, extra);
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
/** An original encounter card from any encounter zone or from play. */
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
const Z = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `zemo:${type}`,
  ...args,
});
const board = (s: GameState, code: string) =>
  boardEnvironments(s).find((p) => p.code === code)!;
const counters = (s: GameState) =>
  Object.fromEntries(
    [...boardEnvironments(s), ...boardAttachments(s)].map((p) => [
      p.code,
      p.counters,
    ]),
  );
const total = (s: GameState) =>
  boardEnvironments(s).reduce((n, p) => n + p.counters, 0);
/** Player cards with this printed resource into the first player's hand. */
function handOf(s: GameState, resource: Resource, n: number) {
  const view = s.player;
  const picked: Piece[] = [];
  for (const p of [...view.deck, ...view.discard]) {
    const c = card(p);
    if ((c[`resource_${resource}`] || 0) >= 1 && !c.resource_wild) {
      picked.push(p);
      view.deck = view.deck.filter((q) => q.id !== p.id);
      view.discard = view.discard.filter((q) => q.id !== p.id);
      if (picked.length === n) break;
    }
  }
  expect(picked).toHaveLength(n);
  view.hand = picked;
  return picked;
}
/** A player card put into play under the first player's control. */
function own(s: GameState, code: string) {
  const p = makePiece(s, code);
  p.ownerId = s.activePlayerId;
  s.player.inPlay.push(p);
  return p;
}
function sideScheme(s: GameState, code: string) {
  const p = take(s, code);
  const c = card(p);
  p.counters = (c.base_threat || 0) * (c.base_threat_fixed ? 1 : s.playerCount);
  s.sideSchemes.push(p);
  return p;
}
function minion(s: GameState, code: string, playerId = "p1") {
  const p = take(s, code);
  p.engagedWith = playerId;
  p.damage = 0;
  s.minions.push(p);
  return p;
}
/** Advance through The Accusation, answering each guess. */
/** S.H.I.E.L.D. Troopers on top of the encounter deck: boost cards
 * without abilities. */
function plainBoosts(s: GameState, n = 2) {
  for (let i = 0; i < n; i++) s.encounter.deck.unshift(take(s, TROOPER));
  return s;
}
function accuse(s: GameState, guess?: [string, string, string]) {
  s = native(s, Z("advance"));
  for (
    let n = 0;
    s.prompt && /Guess the mole/.test(s.prompt.text) && n < 3;
    n++
  ) {
    const step = /means/.test(s.prompt.text)
      ? 0
      : /motive/.test(s.prompt.text)
        ? 1
        : 2;
    s = choose(s, guess?.[step] || s.prompt.options[0].id);
  }
  return s;
}

describe("Baron Zemo: original source", () => {
  it("registers every face of the Baron Zemo, S.H.I.E.L.D., Executive Board and evidence sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "aos" &&
        [
          "baron_zemo",
          "s.h.i.e.l.d.",
          "s.h.i.e.l.d._executive_board",
          "executive_board_evidence",
        ].includes(c.set_code || ""),
    ).map((c) => c.code);
    expect(new Set(ZEMO_CODES)).toEqual(new Set(faces));
    expect(ZEMO_CODES).toHaveLength(39);
    for (const code of ZEMO_CODES)
      expect(hasExecutableScript(code), code).toBe(true);
    expect(MODULES.at(-5)?.id).toBe("s.h.i.e.l.d.");
    expect([...ZEMO_MODULAR_SETS]).toEqual(["s.h.i.e.l.d."]);
    expect(
      scenarioModules("baron_zemo").some(
        (m) => m.id === "s.h.i.e.l.d._executive_board",
      ),
    ).toBe(false);
    expect(VILLAINS.find((v) => v.id === "baron_zemo")).toMatchObject({
      codes: [MASKED, "50166a"],
      schemes: [MANIPULATIONS],
      moduleCount: 2,
      defaultModules: ["scientist_supreme", "s.h.i.e.l.d."],
      fixedSets: ["s.h.i.e.l.d._executive_board"],
    });
  });

  it("the campaign log lists each of the 27 combinations once, nine for each board member", () => {
    const keys = COMBINATIONS.map((c) => c.slice(0, 3).join("+"));
    expect(new Set(keys).size).toBe(27);
    for (const a of MEANS)
      for (const b of MOTIVES)
        for (const c of OPPORTUNITIES) expect(keys).toContain(`${a}+${b}+${c}`);
    for (const member of [CMO, CSO, CTO])
      expect(COMBINATIONS.filter((c) => c[3] === member)).toHaveLength(9);
  });

  it("setup prepares the evidence and puts each board member into play with 2 secret counters; Baron Zemo (A1) has 12 hit points", () => {
    for (const players of [1, 2]) {
      const s = opened("standard", players);
      expect(s.villain.code).toBe(MASKED);
      expect(s.villain.hp).toBe(12);
      expect(s.scheme.code).toBe(MANIPULATIONS);
      expect(s.scheme.threat).toBe(2 * players);
      expect(s.modules).toEqual(["scientist_supreme", "s.h.i.e.l.d."]);
      expect(counters(s)).toEqual({ [CMO]: 2, [CSO]: 2, [CTO]: 2 });
      const z = s.zemo!;
      expect(z.aim.map((p) => p.code).sort()).toEqual(
        [
          z.aim.find((p) => MEANS.includes(p.code))!.code,
          z.aim.find((p) => MOTIVES.includes(p.code))!.code,
          z.aim.find((p) => OPPORTUNITIES.includes(p.code))!.code,
        ].sort(),
      );
      expect(z.shield).toHaveLength(6);
      expect(z.gained).toHaveLength(0);
      expect(moleCombination(s)).toBeTruthy();
      expect(remainingCombinations(s)).toHaveLength(27);
      const all = [
        ...s.encounter.deck,
        ...s.encounter.dealt,
        ...s.encounter.discard,
      ].map((p) => p.code);
      for (const code of [AIM_ENERGY, "50184b", "50184c", TROOPER, WARRANT])
        expect(all).toContain(code);
      for (const code of ["50181b", "50182b", "50183b", CMO, "50185"])
        expect(all).not.toContain(code);
    }
  });

  it("Expert: Baron Zemo (B1) with 16 hit points, and a board member joins him at 3 secret counters", () => {
    let s = started("expert", 2);
    expect(s.villain.code).toBe("50166a");
    expect(s.villain.hp).toBe(16);
    s = settle(native(s, Z("secret", { id: board(s, CSO).id, n: 1 })));
    expect(boardAttachments(s).map((p) => p.code)).toEqual(["50182b"]);
  });
});

describe("Baron Zemo", () => {
  it("masked, Baron Zemo resets to 12 hit points instead of being defeated, and 3 secret counters come off the board members", () => {
    let s = started();
    s = settle(native(s, hit(s.villain.id, 40)));
    expect(s.phase).not.toBe("won");
    expect(s.villain.code).toBe(MASKED);
    expect(s.villain.hp).toBe(12);
    expect(total(s)).toBe(3);
  });

  it("Chief Tactical Officer's Hero Action spends 2 physical resources to remove a secret counter, then deals 2 damage to an enemy; never in alter-ego form", () => {
    let s = started();
    const hp = s.player.hp;
    const physical = handOf(s, "physical", 2);
    const before = s.villain.hp;
    s = command(reload(s), {
      type: "ABILITY",
      id: board(s, CTO).id,
      action: "investigate",
    });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(command(s, { type: "PAY", ids: physical.map((p) => p.id) }));
    expect(board(s, CTO).counters).toBe(1);
    expect(s.villain.hp).toBe(before - 2);
    expect(s.player.hp).toBe(hp);
    // Not in alter-ego form, and not without counters.
    s.player.form = "alter";
    expect(abilityOptions(s, board(s, CSO))).toHaveLength(0);
  });

  it("Chief Medical Officer heals 1 damage and Chief Surveillance Officer removes 2 threat", () => {
    let s = started();
    s.player.hp -= 3;
    const hp = s.player.hp;
    const energy = handOf(s, "energy", 2);
    s = command(reload(s), {
      type: "ABILITY",
      id: board(s, CMO).id,
      action: "investigate",
    });
    s = settle(command(s, { type: "PAY", ids: energy.map((p) => p.id) }));
    expect(s.player.hp).toBe(hp + 1);
    s.scheme.threat = 5;
    const mental = handOf(s, "mental", 2);
    s = command(reload(s), {
      type: "ABILITY",
      id: board(s, CSO).id,
      action: "investigate",
    });
    s = settle(command(s, { type: "PAY", ids: mental.map((p) => p.id) }));
    expect(board(s, CSO).counters).toBe(1);
    expect(s.scheme.threat).toBe(3);
  });

  it("a board member with 4 secret counters joins the villain with them, giving him its printed ATK or SCH", () => {
    let s = started();
    const atk = enemyStats(s, s.villain).attack;
    const sch = enemyStats(s, s.villain).scheme;
    s = settle(native(s, Z("secret", { id: board(s, CMO).id, n: 2 })));
    expect(boardEnvironments(s).map((p) => p.code)).toEqual([CSO, CTO]);
    expect(boardAttachments(s).map((p) => [p.code, p.counters])).toEqual([
      ["50181b", 4],
    ]);
    expect(enemyStats(s, s.villain).attack).toBe(atk + 1);
    s = settle(native(s, Z("secret", { id: board(s, CSO).id, n: 2 })));
    expect(enemyStats(s, s.villain).scheme).toBe(sch + 1);
    expect(attachmentsFor(s, s.villain.id).map((p) => p.code)).toEqual([
      "50181b",
      "50182b",
    ]);
  });

  it("after a secret counter is placed on a joined board member: Surveillance places 2 threat, Tactical deals 2 damage, Medical heals the villain or deals 1 damage", () => {
    let s = started();
    s = settle(native(s, Z("secret", { id: board(s, CSO).id, n: 2 })));
    const surveillance = boardAttachments(s)[0];
    const threat = s.scheme.threat;
    s = settle(native(s, Z("secret", { id: surveillance.id, n: 1 })));
    expect(s.scheme.threat).toBe(threat + 2);
    s = settle(native(s, Z("secret", { id: board(s, CTO).id, n: 2 })));
    const tactical = boardAttachments(s).find((p) => p.code === "50183b")!;
    const hp = s.player.hp;
    s = settle(native(s, Z("secret", { id: tactical.id, n: 1 })));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.phase).not.toBe("lost");
  });

  it("the players lose with all three board members on the villain's side", () => {
    let s = started();
    for (const code of [CMO, CSO, CTO])
      s = settle(native(s, Z("secret", { id: board(s, code).id, n: 2 })));
    expect(s.phase).toBe("lost");
  });

  it("after the player phase, 2 secret counters on a board member without any gain 2 evidence cards, crossing out their combinations; then the players may accuse", () => {
    let s = started();
    board(s, CSO).counters = 0;
    expect(zemoPlayerPhaseEnded(s).map((e) => e.type)).toEqual([
      "zemo:respond",
    ]);
    s = native(reload(s), Z("respond", { actorId: "p1" }));
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      `evidence:${board(s, CSO).id}`,
      "accuse",
      "pass",
    ]);
    s = choose(s, `evidence:${board(s, CSO).id}`);
    expect(board(s, CSO).counters).toBe(2);
    expect(s.zemo!.gained).toHaveLength(2);
    expect(s.zemo!.shield).toHaveLength(4);
    const left = remainingCombinations(s);
    expect(left.length).toBeLessThan(27);
    const mole = moleCombination(s)!;
    expect(left).toContainEqual(mole);
    expect(s.prompt?.text).toMatch(/accusation now/);
    s = settle(choose(s, "pass"));
    expect(s.scheme.code).toBe(MANIPULATIONS);
  });

  it("the response follows the end of each player phase on Zemo's Manipulations", () => {
    let s = started();
    s = command(s, {
      type: "END_TURN",
      discard: s.player.hand.map((p) => p.id),
    });
    for (
      let n = 0;
      n < 40 && s.prompt && s.prompt.title !== "Zemo's Manipulations";
      n++
    )
      s = choose(s, noDefense(s) || passId(s) || s.prompt.options[0].id);
    expect(s.prompt?.title).toBe("Zemo's Manipulations");
  });

  it("a correct accusation places no secret counters; Fighting Zemo unmasks him with 18 hit points per player, attaches his Sword and the mole", () => {
    let s = started("standard", 2);
    s.zemo!.gained.push(...s.zemo!.shield.splice(0));
    const mole = moleCombination(s)!;
    expect(remainingCombinations(s)).toEqual([mole]);
    const before = counters(s);
    s = settle(accuse(s));
    expect(s.zemo!.accusation).toEqual({
      means: mole[0],
      motive: mole[1],
      opportunity: mole[2],
      member: mole[3],
    });
    expect(s.villain.code).toBe(UNMASKED);
    expect(s.villain.hp).toBe(36);
    expect(s.scheme.code).toBe(FIGHTING);
    expect(s.attachments.find((p) => p.code === SWORD)?.attachedTo).toBe(
      s.villain.id,
    );
    const back = { [CMO]: "50181b", [CSO]: "50182b", [CTO]: "50183b" }[
      mole[3]
    ]!;
    expect(boardAttachments(s).map((p) => p.code)).toEqual([back]);
    // 1 threat per player for each secret counter on the joined members.
    expect(s.scheme.threat).toBe(before[mole[3]] * 2);
  });

  it("each wrong guess places a secret counter on each board member, and 3 more go on a wrongly accused board member", () => {
    let s = started();
    for (const p of boardEnvironments(s)) p.counters = 0;
    const mole = moleCombination(s)!;
    // The combination that differs from the mole's in the fewest guesses.
    const wrongs = (c: readonly string[]) =>
      c.filter((code, i) => code !== mole[i]).length;
    const guess = COMBINATIONS.filter((c) => wrongs(c) > 0).sort(
      (a, b) => wrongs(a) - wrongs(b),
    )[0];
    const n = wrongs(guess);
    s = settle(accuse(s, [guess[0], guess[1], guess[2]]));
    expect(s.zemo!.accusation?.member).toBe(guess[3]);
    const after = counters(s);
    for (const code of [CMO, CSO, CTO]) {
      if (code === guess[3] && guess[3] !== mole[3]) continue;
      expect(after[code] ?? after[code.replace("a", "b")]).toBe(n);
    }
    if (guess[3] !== mole[3]) {
      const accused = { [CMO]: "50181b", [CSO]: "50182b", [CTO]: "50183b" }[
        guess[3]
      ]!;
      // n + 3 secret counters: the accused joins the villain.
      expect(boardAttachments(s).map((p) => p.code)).toContain(accused);
    }
    expect(s.villain.code).toBe(UNMASKED);
  });

  it("unmasked, Baron Zemo is defeated and the players win", () => {
    let s = started();
    s.zemo!.gained.push(...s.zemo!.shield.splice(0));
    s = settle(accuse(s));
    s = settle(native(s, hit(s.villain.id, 18)));
    expect(s.phase).toBe("won");
  });

  it("unmasked, when Baron Zemo activates against you he places 1 secret counter on a board member or gets another boost card", () => {
    let s = started();
    s.zemo!.gained.push(...s.zemo!.shield.splice(0));
    s = settle(accuse(s));
    const env = boardEnvironments(s)[0];
    const before = env.counters;
    s = native(reload(plainBoosts(s)), { type: "villainActivate" });
    for (let n = 0; n < 10 && s.prompt?.text !== "Choose one."; n++)
      s = choose(s, passId(s) || s.prompt!.options[0].id);
    expect(s.prompt?.options.map((o) => o.id)).toContain("boost");
    s = settle(choose(s, env.id));
    expect(boardEnvironments(s).find((p) => p.id === env.id)?.counters).toBe(
      before + 1,
    );
    // The boost choice gives his attack an additional boost card.
    let t = started();
    t.zemo!.gained.push(...t.zemo!.shield.splice(0));
    t = settle(accuse(t));
    t = native(reload(plainBoosts(t)), { type: "villainActivate" });
    for (let n = 0; n < 10 && t.prompt?.text !== "Choose one."; n++)
      t = choose(t, passId(t) || t.prompt!.options[0].id);
    const discard = t.encounter.discard.length;
    t = settle(choose(t, "boost"));
    // His attack dealt 2 boost cards, both discarded after it.
    expect(t.flags.zemoExtraBoosts).toBeUndefined();
    expect(t.encounter.discard.length).toBe(discard + 2);
  });

  it("S.H.I.E.L.D. Agent places a secret counter on the board member with the fewest when it activates or is defeated", () => {
    let s = started();
    board(s, CTO).counters = 0;
    const agent = minion(s, AGENT);
    s = settle(native(reload(s), hit(agent.id, 10)));
    expect(s.minions.some((m) => m.id === agent.id)).toBe(false);
    expect(board(s, CTO).counters).toBe(1);
  });

  it("Baron Zemo's Sword: after he attacks and defeats a character, a secret counter goes on the board member with the fewest; its Hero Action discards it", () => {
    let s = started();
    s.zemo!.gained.push(...s.zemo!.shield.splice(0));
    s = settle(accuse(s));
    expect(zemoAttacked(s, s.villain.id, true).map((e) => e.type)).toEqual([
      "zemo:secret-fewest",
    ]);
    expect(zemoAttacked(s, s.villain.id, false)).toEqual([]);
    const physical = handOf(s, "physical", 3);
    const sword = s.attachments.find((p) => p.code === SWORD)!;
    const before = total(s);
    s = command(reload(s), {
      type: "ABILITY",
      id: sword.id,
      action: "sword-physical",
    });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(command(s, { type: "PAY", ids: physical.map((p) => p.id) }));
    expect(s.attachments.some((p) => p.code === SWORD)).toBe(false);
    expect(total(s)).toBe(before - 1);
  });

  it("Reluctant Foe: a hero from the collection enters play engaged with you as an Elite, villainous minion with SCH equal to its THW; when defeated both are removed from the game", () => {
    let s = started();
    s = resolveEncounter(reveal(s, FOE));
    expect(s.prompt?.title).toBe("Reluctant Foe");
    const hulk = HEROES.find((h) => h.id === "hulk")!.code;
    expect(
      s.prompt?.options.some(
        (o) => o.id === HEROES.find((h) => h.id === "captain_marvel")!.code,
      ),
    ).toBe(false);
    s = settle(choose(s, hulk));
    const foe = s.minions.find((m) => m.code === hulk)!;
    expect(foe.reluctantFoe).toBe(true);
    expect(foe.engagedWith).toBe("p1");
    const printed = CATALOG_CARDS.find((c) => c.code === hulk)!;
    expect(card(foe).type_code).toBe("minion");
    expect(card(foe).traits).toMatch(/Elite/);
    expect(enemyStats(s, foe).scheme).toBe(printed.thwart);
    expect(enemyStats(s, foe).attack).toBe(printed.attack);
    expect(s.attachments.find((p) => p.code === FOE)?.attachedTo).toBe(foe.id);
    s = settle(native(reload(s), hit(foe.id, printed.health || 0)));
    expect(s.minions.some((m) => m.id === foe.id)).toBe(false);
    expect(s.removed.map((p) => p.code)).toEqual(
      expect.arrayContaining([hulk, FOE]),
    );
    expect(s.encounter.discard.some((p) => p.code === hulk)).toBe(false);
  });

  it("Divided Loyalties: attacking or defending with an ally costs 1 more resource; when defeated, 1 secret counter per player comes off", () => {
    let s = started();
    sideScheme(s, DIVIDED);
    const ally = own(s, MOCKINGBIRD);
    s.player.hand = [];
    expect(
      abilityOptions(reload(s), ally).find((o) => o.id === "attack")?.disabled,
    ).toMatch(/Divided Loyalties/);
    const [resource] = handOf(s, "physical", 1);
    s = command(reload(s), { type: "ABILITY", id: ally.id, action: "attack" });
    for (let n = 0; n < 5 && s.prompt?.kind === "choice"; n++)
      s = choose(s, s.villain.id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.title).toMatch(/Divided Loyalties/);
    const hp = s.villain.hp;
    s = settle(command(s, { type: "PAY", ids: [resource.id] }));
    expect(s.villain.hp).toBeLessThan(hp);
    // When defeated: 1 secret counter per player comes off.
    const divided = s.sideSchemes.find((p) => p.code === DIVIDED)!;
    const before = total(s);
    s = settle(
      native(reload(s), { type: "thwart", target: divided.id, amount: 9 }),
    );
    expect(s.sideSchemes.some((p) => p.code === DIVIDED)).toBe(false);
    expect(total(s)).toBe(before - 1);
  });

  it("Divided Loyalties: the ally defense option costs a resource", () => {
    let s = started();
    sideScheme(s, DIVIDED);
    own(s, MOCKINGBIRD);
    handOf(s, "physical", 1);
    s = native(reload(s), { type: "villainActivate" });
    for (
      let n = 0;
      n < 10 && s.prompt && !s.prompt.options.some((o) => o.id === "take");
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    const defend = s.prompt?.options.find((o) =>
      /Defend with Mockingbird/.test(o.label),
    );
    expect(defend?.label).toMatch(/spend 1 resource/);
    expect(defend?.effects[0].type).toBe("zemo:defend-pay");
  });

  it("Undermine Support: in the ready step each exhausted support readies only if its player spends 1 resource", () => {
    let s = started();
    sideScheme(s, UNDERMINE);
    const support = own(s, HELICARRIER);
    support.exhausted = true;
    handOf(s, "physical", 1);
    s = native(reload(s), { type: "refill" });
    for (
      let n = 0;
      n < 10 && s.prompt && s.prompt.title !== "Undermine Support";
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    expect(s.prompt?.title).toBe("Undermine Support");
    s = settle(choose(s, "leave"));
    expect(s.player.inPlay.find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
  });

  it("Battle of Wits: Baron Zemo schemes, and each mental resource spent prevents 1 of that threat and removes 1 secret counter", () => {
    let s = started();
    const mental = handOf(s, "mental", 1);
    const threat = s.scheme.threat;
    const before = total(s);
    s = resolveEncounter(reveal(plainBoosts(s), WITS));
    for (
      let n = 0;
      n < 10 && s.prompt && s.prompt.title !== "Battle of Wits";
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    expect(s.prompt?.title).toBe("Battle of Wits");
    const incoming = Number(s.prompt?.text.match(/(\d+) threat/)?.[1]);
    s = choose(s, "wits");
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: mental.map((p) => p.id) });
    s = settle(s);
    expect(s.scheme.threat).toBe(threat + incoming - 1);
    expect(total(s)).toBe(before - 1);
  });

  it("Might Makes Right: in alter-ego form 2 secret counters go on the board member with the fewest; in hero form Zemo attacks and, without damage, 3 come off", () => {
    let s = started();
    s.player.form = "alter";
    board(s, CSO).counters = 1;
    s = settle(resolveEncounter(reveal(reload(s), MIGHT)));
    expect(board(s, CSO).counters).toBe(3);
    let t = started();
    t.player.tough = true;
    const before = total(t);
    t = settle(resolveEncounter(reveal(reload(plainBoosts(t)), MIGHT)));
    expect(total(t)).toBe(before - 3);
  });

  it("The Ends Justify the Means: Zemo defeats the minion with the fewest hit points and schemes, or you discard an ally to remove secret counters equal to its cost", () => {
    let s = started();
    const trooper = minion(s, TROOPER);
    const threat = s.scheme.threat;
    s = resolveEncounter(reveal(reload(s), ENDS));
    s = settle(
      s.prompt?.options.some((o) => o.id === "defeat")
        ? choose(s, "defeat")
        : s,
    );
    expect(s.minions.some((m) => m.id === trooper.id)).toBe(false);
    expect(s.scheme.threat).toBeGreaterThan(threat);
    let t = started();
    const ally = own(t, MOCKINGBIRD);
    t = resolveEncounter(reveal(reload(t), ENDS));
    const before = total(t);
    t = settle(choose(t, ally.id));
    expect(t.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(total(t)).toBe(before - 3);
  });

  it("A.I.M. Interference places a secret counter on each board member, and each matching resource spent prevents one; as a boost it resolves too", () => {
    let s = started();
    s.player.hand = [];
    s = settle(resolveEncounter(reveal(reload(s), AIM_ENERGY)));
    expect(counters(s)).toEqual({ [CMO]: 3, [CSO]: 3, [CTO]: 3 });
    let t = started();
    const energy = handOf(t, "energy", 1);
    t = resolveEncounter(reveal(reload(t), AIM_ENERGY));
    // Incite 1 and the When Revealed ability resolve in either order.
    for (
      let n = 0;
      n < 5 && t.prompt && t.prompt.title !== "A.I.M. Interference";
      n++
    )
      t = choose(t, t.prompt.options[0].id);
    expect(t.prompt?.title).toBe("A.I.M. Interference");
    t = choose(t, "prevent");
    t = command(t, { type: "PAY", ids: energy.map((p) => p.id) });
    t = settle(t);
    expect(total(t)).toBe(8);
    const boost = makePiece(t, AIM_ENERGY);
    expect(zemoBoost(t, boost)).toEqual([]);
    t.attack = { attacker: t.villain.id } as GameState["attack"];
    expect(zemoBoost(t, boost)?.map((e) => e.type)).toEqual([
      "zemo:interference",
    ]);
  });

  it("Disavowed: each S.H.I.E.L.D. card costs 1 more, and it enters with 1 threat for each S.H.I.E.L.D. card in play", () => {
    let s = started();
    own(s, HELICARRIER);
    const cost = cardCost(s, card(MOCKINGBIRD));
    s = settle(resolveEncounter(reveal(reload(s), DISAVOWED)));
    const disavowed = s.sideSchemes.find((p) => p.code === DISAVOWED)!;
    // 2, +1 for the Helicarrier and +1 for Disavowed itself.
    expect(disavowed.counters).toBe(4);
    expect(cardCost(s, card(MOCKINGBIRD))).toBe(cost + 1);
  });

  it("S.H.I.E.L.D. Trooper: when defeated the engaged player discards a S.H.I.E.L.D. ally or support, or 2 threat goes on the main scheme", () => {
    let s = started();
    const trooper = minion(s, TROOPER);
    const threat = s.scheme.threat;
    s = settle(native(reload(s), hit(trooper.id, 10)));
    expect(s.scheme.threat).toBe(threat + 2);
    let t = started();
    const helicarrier = own(t, HELICARRIER);
    const second = minion(t, TROOPER);
    t = settle(native(reload(t), hit(second.id, 10)));
    expect(t.player.inPlay.some((p) => p.id === helicarrier.id)).toBe(false);
  });

  it("Arrest Warrant stays in your play area; its Alter-Ego Action exhausts your identity to reveal a S.H.I.E.L.D. minion and discards it", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(resolveEncounter(reveal(reload(s), WARRANT)));
    const warrant = s.player.inPlay.find((p) => p.code === WARRANT)!;
    expect(warrant).toBeTruthy();
    s = command(reload(s), {
      type: "ABILITY",
      id: warrant.id,
      action: "warrant-identity",
    });
    s = settle(s);
    expect(s.player.inPlay.some((p) => p.code === WARRANT)).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.minions.some((m) => m.code === TROOPER)).toBe(true);
  });

  it("the S.H.I.E.L.D. Executive Board joins another scenario without counting as a modular set, and its board members stay with the villain through his stages", () => {
    let s = started("standard", 1, "rhino", { executiveBoard: true });
    expect(s.modules).toHaveLength(1);
    expect(counters(s)).toEqual({ [CMO]: 2, [CSO]: 2, [CTO]: 2 });
    expect(
      s.encounter.deck.filter((p) =>
        ["50184a", "50184b", "50184c"].includes(p.code),
      ),
    ).toHaveLength(3);
    s = settle(native(s, Z("secret", { id: board(s, CTO).id, n: 2 })));
    const atk = enemyStats(s, s.villain).attack;
    s = settle(native(reload(s), hit(s.villain.id, s.villain.hp)));
    expect(s.villain.stage).toBe(2);
    expect(boardAttachments(s).map((p) => p.code)).toEqual(["50183b"]);
    expect(attachmentsFor(s, s.villain.id).map((p) => p.code)).toContain(
      "50183b",
    );
    expect(atk).toBe((card("01094").attack || 0) + 1);
    expect(enemyStats(s, s.villain).attack).toBe(
      (card(s.villain.code).attack || 0) + 1,
    );
    // Not without the option, nor in The Wrecking Crew.
    expect(opened("standard", 1, "rhino").executiveBoard).toBeUndefined();
    expect(
      setup("standard", 1, "the_wrecking_crew", { executiveBoard: true })
        .executiveBoard,
    ).toBeUndefined();
  });
});
