/** Age of Apocalypse: Four Horsemen with the Hounds modular set, exercised
 * with the original physical cards. Every command crosses a JSON
 * save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { identityTextBlank } from "../src/game/card-text";
import { newGame } from "../src/game/engine";
import {
  FOUR_HORSEMEN_SCRIPT_CODES,
  HOUNDS_CODES,
  horsemanVillain,
  horsemenVillains,
  type HorsemanKey,
} from "../src/game/four-horsemen";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

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
  villainId = "four_horsemen",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 45081,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...(modules ? { modules } : {}),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
  untilPayment = false,
) {
  for (let n = 0; s.prompt && n < 200; n++) {
    if (untilPayment && s.prompt.kind === "payment") return s;
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve", "done"].includes(o.id),
        )?.id ||
        s.prompt.options.find((o) => o.id !== "pay")?.id ||
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
  villainId = "four_horsemen",
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
  villainId = "four_horsemen",
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
function own(s: GameState, type: string) {
  const view = s.player;
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
const villain = (s: GameState, key: HorsemanKey) => horsemanVillain(s, key)!;
/** Clear a Horseman's tough status cards. */
function untough(s: GameState, key?: HorsemanKey) {
  for (const v of key ? [villain(s, key)] : horsemenVillains(s)) {
    v.tough = false;
    v.toughCards = 0;
  }
  return reload(s);
}
/** Make `key` the active Horseman. */
function activate(s: GameState, key: HorsemanKey) {
  s.horsemen!.active = key;
  return reload(s);
}

describe("Four Horsemen: original source", () => {
  it("registers every face of the Four Horsemen and Hounds sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aoa" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(FOUR_HORSEMEN_SCRIPT_CODES)).toEqual(
      new Set(faces("four_horsemen")),
    );
    expect(new Set(HOUNDS_CODES)).toEqual(new Set(faces("hounds")));
    for (const code of [...FOUR_HORSEMEN_SCRIPT_CODES, ...HOUNDS_CODES])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "four_horsemen")).toMatchObject({
      schemes: ["45085b"],
      moduleCount: 2,
      defaultModules: ["dystopian_nightmare", "hounds"],
    });
    expect(MODULES.at(-17)?.id).toBe("hounds");
    expect(scenarioModules("four_horsemen")).toHaveLength(MODULES.length);
  });

  it("starts with the four Horsemen in a random row and a Four Horsemen side scheme per player", () => {
    for (const [difficulty, side, hp] of [
      ["standard", "a", 9],
      ["expert", "b", 12],
    ] as const)
      for (const players of [1, 2]) {
        const s = started(difficulty, players);
        const st = s.horsemen!;
        expect(new Set(st.row)).toEqual(
          new Set(["war", "famine", "pestilence", "death"]),
        );
        expect(st.active).toBe(st.row[0]);
        expect(st.focus).toBe(st.row[0]);
        const villains = horsemenVillains(s);
        expect(villains).toHaveLength(4);
        for (const v of villains) {
          expect(v.code.endsWith(side), v.code).toBe(true);
          expect(v.hp).toBe(hp * players);
        }
        expect(s.scheme.code).toBe("45085b");
        expect(
          s.sideSchemes.filter((p) =>
            ["45086", "45087", "45088", "45089"].includes(p.code),
          ),
        ).toHaveLength(players);
        expect(
          s.encounter.deck.some((p) => card(p).type_code === "villain"),
        ).toBe(false);
      }
  });
});

describe("Four Horsemen", () => {
  it("passes the active counter to the next villain after each activation", () => {
    let s = started();
    const row = s.horsemen!.row;
    s = settle(native(s, attack(s.villain.id)));
    expect(s.horsemen!.active).toBe(row[1]);
    expect(s.villain.code).toBe(villain(s, row[1]).code);
    s = activate(s, row[3]);
    s = settle(native(s, attack(villain(s, row[3]).id)));
    expect(s.horsemen!.active).toBe(row[0]);
  });

  it("no Horseman is defeated while another has hit points; the last one falling wins", () => {
    let s = untough(started());
    const row = s.horsemen!.row;
    for (const key of row.slice(0, 3)) {
      s = settle(native(s, hit(villain(s, key).id, villain(s, key).hp)));
      expect(villain(s, key).hp).toBe(0);
      expect(s.phase).not.toBe("won");
    }
    expect(horsemenVillains(s)).toHaveLength(4);
    const last = villain(s, row[3]);
    s = settle(native(s, hit(last.id, last.hp)));
    expect(s.phase).toBe("won");
  });

  it("War: after he attacks you, you discard an upgrade or support you control", () => {
    let s = activate(started(), "war");
    const upgrade = own(s, "upgrade");
    s = settle(native(reload(s), attack(villain(s, "war").id)));
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(false);
  });

  it("Famine: after she attacks you, you discard the top 10 cards of your deck", () => {
    let s = activate(started(), "famine");
    const deck = s.player.deck.length;
    s = settle(native(s, attack(villain(s, "famine").id)));
    expect(s.player.deck.length).toBeLessThanOrEqual(deck - 10);
  });

  it("Pestilence: your identity's text box is blank until the next villain phase", () => {
    let s = activate(started(), "pestilence");
    s = settle(native(s, attack(villain(s, "pestilence").id)));
    expect(s.horsemen!.blank).toEqual(["p1"]);
    expect(identityTextBlank(s)).toBe(true);
    s = settle(command(s, { type: "END_TURN" }));
    expect(s.horsemen!.blank || []).toEqual([]);
  });

  it("Death: after he attacks you, each character you control takes 1 damage", () => {
    let s = activate(started(), "death");
    const ally = own(s, "ally");
    s = reload(s);
    const icons = plain(s);
    const hp = s.player.hp;
    const death = villain(s, "death");
    s = settle(native(s, attack(death.id)));
    // The attack, then 1 more damage from his Forced Response.
    expect(hp - s.player.hp).toBe(card(death).attack! + icons + 1);
    const after = s.player.inPlay.find((p) => p.id === ally.id);
    expect(after ? after.damage : 1).toBe(1);
  });

  it("a Horseman at 0 hit points does not resolve his Forced Response", () => {
    let s = untough(activate(started(), "famine"));
    const famine = villain(s, "famine");
    famine.hp = 0;
    const deck = s.player.deck.length;
    s = settle(native(reload(s), attack(famine.id)));
    expect(s.player.deck.length).toBeGreaterThan(deck - 10);
  });
});

describe("Four Horsemen encounter cards", () => {
  it("Golden Horse rides the non-Aerial villain with the fewest hit points, who counts as having 1", () => {
    let s = untough(started());
    const row = s.horsemen!.row.filter((k) => k !== "death");
    const weakest = row[1];
    villain(s, weakest).hp -= 3;
    s = settle(resolveEncounter(reveal(reload(s), "45090")));
    const horse = s.attachments.find((a) => a.code === "45090");
    expect(horse?.attachedTo).toBe(villain(s, weakest).id);
    // Bring every other Horseman to 0: the mounted one still counts.
    for (const v of horsemenVillains(s).filter(
      (q) => q.id !== villain(s, weakest).id,
    ))
      s = settle(native(s, hit(v.id, v.hp)));
    s = settle(native(s, hit(villain(s, weakest).id, villain(s, weakest).hp)));
    expect(s.phase).not.toBe("won");
  });

  it("Metal Wings rides Death, takes the active counter and gives him retaliate 1", () => {
    let s = untough(started());
    s = settle(resolveEncounter(reveal(s, "45091")));
    expect(s.attachments.find((a) => a.code === "45091")?.attachedTo).toBe(
      villain(s, "death").id,
    );
    expect(s.horsemen!.active).toBe("death");
    expect(s.villain.code.startsWith("45084")).toBe(true);
    const hp = s.player.hp;
    s = settle(
      command(s, { type: "BASIC", action: "attack" }),
      (v) => v.prompt?.options.find((o) => o.id === villain(v, "death").id)?.id,
    );
    expect(s.player.hp).toBe(hp - 1);
  });

  it("Horseman of War heals War 2, gives him a tough status card and he activates against you", () => {
    let s = untough(started());
    const war = villain(s, "war");
    war.hp -= 5;
    s = reload(s);
    const warHp = villain(s, "war").hp;
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "45092")));
    expect(villain(s, "war").hp).toBe(warHp + 2);
    expect(villain(s, "war").tough).toBe(true);
    expect(s.player.hp).toBeLessThan(hp);
  });

  it("Horseman of Famine's boost: Famine activates against you after the activation, without a boost card", () => {
    let s = untough(started());
    // War attacks (his Forced Response has nothing to discard), and Famine
    // follows.
    s = activate(s, "war");
    const war = villain(s, "war");
    // Under it, the card the follow-up activation must not take as a boost.
    plain(s);
    const marker = s.encounter.deck[0];
    stack(s, take(s, "45093"));
    const deck = s.player.deck.length;
    const hp = s.player.hp;
    s = settle(native(reload(s), attack(war.id)));
    // Famine attacked too and her Forced Response discarded 10 cards.
    expect(s.player.hp).toBeLessThan(hp);
    expect(s.player.deck.length).toBeLessThanOrEqual(deck - 10);
    expect(s.encounter.deck[0]?.id).toBe(marker.id);
  });

  it("Rough Riders resolves the active villain's Forced Response, then the next one's", () => {
    let s = activate(started(), "famine");
    const row = s.horsemen!.row;
    const next = row[(row.indexOf("famine") + 1) % 4];
    const deck = s.player.deck.length;
    s = settle(resolveEncounter(reveal(s, "45096")));
    expect(s.horsemen!.active).toBe(next);
    expect(s.player.deck.length).toBeLessThanOrEqual(deck - 10);
  });

  it("A Time of Famine: the player who defeats it discards the top 10 cards of their deck", () => {
    let s = started();
    let scheme = s.sideSchemes.find((p) => p.code === "45087");
    if (!scheme) {
      s = settle(resolveEncounter(reveal(s, "45087")));
      scheme = s.sideSchemes.find((p) => p.code === "45087")!;
    }
    const deck = s.player.deck.length;
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: scheme.counters,
        source: "hero",
      }),
    );
    expect(s.sideSchemes.some((p) => p.id === scheme!.id)).toBe(false);
    expect(s.player.deck.length).toBeLessThanOrEqual(deck - 10);
  });
});

describe("Hounds", () => {
  it("Ahab reveals Release the Hounds, or adds 3 threat to it", () => {
    let s = started("standard", 1, "rhino", ["hounds"]);
    s = settle(resolveEncounter(reveal(s, "45097")));
    const scheme = s.sideSchemes.find((p) => p.code === "45100")!;
    expect(scheme).toBeTruthy();
    const threat = scheme.counters;
    const ahab = s.minions.find((m) => m.code === "45097")!;
    s.minions = s.minions.filter((m) => m.id !== ahab.id);
    s.encounter.deck.push(ahab);
    s = settle(resolveEncounter(reveal(reload(s), "45097")));
    expect(s.sideSchemes.find((p) => p.code === "45100")?.counters).toBe(
      threat + 3,
    );
  });

  it("Hound attacks you in hero form and changes you to hero form otherwise", () => {
    let s = started("standard", 1, "rhino", ["hounds"]);
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, "45098")));
    expect(s.player.hp).toBe(hp - 2);
    s.player.form = "alter";
    s = settle(resolveEncounter(reveal(reload(s), "45098")));
    expect(s.player.form).toBe("hero");
  });

  it("Release the Hounds gives the phase's first Hound surge and deals a Hound to the player who defeats it", () => {
    let s = started("standard", 1, "rhino", ["hounds"]);
    s = settle(resolveEncounter(reveal(s, "45100")));
    const scheme = s.sideSchemes.find((p) => p.code === "45100")!;
    const hound = take(s, "45098");
    const deck = s.encounter.deck.length;
    s = settle(
      resolveEncounter(
        native(s, { type: "reveal", piece: hound, actorId: "p1" }),
      ),
    );
    expect(s.encounter.deck.length).toBe(deck - 1);
    const next = take(s, "45098");
    const before = s.encounter.deck.length;
    s = settle(
      resolveEncounter(
        native(s, { type: "reveal", piece: next, actorId: "p1" }),
      ),
    );
    expect(s.encounter.deck.length).toBe(before);
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: s.sideSchemes.find((p) => p.id === scheme.id)!.counters,
        source: "hero",
      }),
    );
    expect(s.encounter.dealt.some((p) => p.code === "45098")).toBe(true);
  });

  it("Ahab's Energy Spear: the attack gains overkill and piercing, then the Spear is discarded", () => {
    let s = started("standard", 1, "rhino", ["hounds"]);
    s = settle(resolveEncounter(reveal(s, "45099")));
    const spear = s.attachments.find((a) => a.code === "45099")!;
    expect(spear.attachedTo).toBe(s.villain.id);
    s.player.tough = true;
    const icons = plain(s);
    const hp = s.player.hp;
    s = settle(native(reload(s), attack(s.villain.id)));
    expect(s.player.tough).toBe(false);
    expect(hp - s.player.hp).toBe(card(s.villain).attack! + 2 + icons);
    expect(s.attachments.some((a) => a.id === spear.id)).toBe(false);
  });
});
