/** Agents of S.H.I.E.L.D.: M.O.D.O.K. with the Scientist Supreme set,
 * exercised with the original physical cards. Every command crosses a JSON
 * save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import {
  abilityOptions,
  dispatch,
  makePiece,
  newGame,
  targets,
} from "../src/game/engine";
import {
  MODOK_CODES,
  SCIENTIST_SUPREME_CODES,
  holdingCell,
} from "../src/game/modok";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
// Captain Marvel first: Spider-Man's Spider-Sense would draw the card a
// test puts on top of the deck when the villain attacks.
const team: Seat[] = [
  { heroId: "captain_marvel", aspect: "aggression" },
  { heroId: "spider_man", aspect: "justice" },
];
const ADAPTOIDS_SCHEME = "50104b";
const CELLS = ["50105a", "50106a", "50107a", "50108a"];
const INHUMANS = ["50105b", "50106b", "50107b", "50108b"];
const FLYING = "50109";
const PSIONIC = "50110";
const GARZA = "50111";
const STRONG = "50112";
const ADAPTOID = "50113";
const MOBILE_UNIT = "50114";
const CRYSTAL = "50115";
const NANOBOTS = "50116";
const FORCE_FIELD = "50117";
const MACHETES = "50118";
const REVERSE = "50119";
const JAILER = "50120";
const HOSTAGE = "50121";
const ENHANCEMENT = "50122";
const ALIVE = "50123";
const BLAST = "50124";
const SUPREME = "50125";
const MONICA = "50126";
const IMMUNITY = "50127";
const SANCTIONS = "50128";
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "modok",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 50103,
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
function opened(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "modok",
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
  villainId = "modok",
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
/** An original encounter card from any encounter zone. */
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
/** Put an original encounter card on top of the encounter deck. */
function onTop(s: GameState, code: string) {
  const p = take(s, code);
  s.encounter.deck.unshift(p);
  delete s.encounter.knownTop;
  return p;
}
function own(s: GameState, type: string, playerId = "p1") {
  const view = seatView(s, playerId).player;
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
const scheme = (id: string, playerId = "p1"): Effect => ({
  type: "enemyScheme",
  id,
  actorId: playerId,
});
const thwart = (amount: number, target = "main"): Effect => ({
  type: "thwart",
  target,
  amount,
  source: "hero",
});
function untough(s: GameState, p: Piece = s.villain) {
  p.tough = false;
  p.toughCards = 0;
  return reload(s);
}
/** A minion of the code put into play engaged with the first player. */
function minion(s: GameState, code: string) {
  const p = take(s, code);
  p.engagedWith = "p1";
  p.tough = false;
  p.toughCards = 0;
  s.minions.push(p);
  return p;
}
const sideScheme = (s: GameState, code: string) =>
  s.sideSchemes.find((p) => p.code === code);
/** Clear the Adaptoids engaged at setup and every dealt card, so a test
 * controls the board. */
function clean(s: GameState) {
  s.encounter.deck.push(...s.minions.splice(0), ...s.encounter.dealt.splice(0));
  for (const p of s.encounter.deck) {
    delete p.engagedWith;
    p.damage = 0;
  }
  return reload(s);
}
const cell = (s: GameState) => holdingCell(s)!;
const env = (s: GameState, code: string) =>
  (s.environments || []).find((p) => p.code === code);
/** Put an Adaptoid environment in play, from the set-aside ones. */
function upgrade(s: GameState, code: string) {
  const i = s.modok!.upgrades.findIndex((p) => p.code === code);
  if (i >= 0) s.environments!.push(s.modok!.upgrades.splice(i, 1)[0]);
  else expect(env(s, code), `${code} is set aside or in play`).toBeTruthy();
  return reload(s);
}
/** Free the Holding Cell in play: its Inhuman joins the first player. */
function freeCell(s: GameState) {
  const n = cell(s).counters;
  return settle(native(s, { type: "mdk:unlock", n }));
}

describe("M.O.D.O.K.: original source", () => {
  it("registers every face of the M.O.D.O.K. and Scientist Supreme sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aos" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(MODOK_CODES)).toEqual(new Set(faces("m.o.d.o.k.")));
    expect(new Set(SCIENTIST_SUPREME_CODES)).toEqual(
      new Set(faces("scientist_supreme")),
    );
    for (const code of [...MODOK_CODES, ...SCIENTIST_SUPREME_CODES])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(MODULES.at(-15)?.id).toBe("scientist_supreme");
    expect(scenarioModules("modok")).toHaveLength(MODULES.length);
    expect(VILLAINS.find((v) => v.id === "modok")).toMatchObject({
      codes: ["50103a", "50103b"],
      schemes: [ADAPTOIDS_SCHEME],
      moduleCount: 1,
      defaultModules: ["scientist_supreme"],
    });
  });

  it("M.O.D.O.K. (A) with 10 hit points, a Holding Cell with 2 locks per player, one Adaptoid upgrade and an Adaptoid engaged with each player", () => {
    for (const players of [1, 2]) {
      const s = opened("standard", players);
      expect(s.villain.code).toBe("50103a");
      expect(s.villain.hp).toBe(10);
      expect(s.scheme.code).toBe(ADAPTOIDS_SCHEME);
      expect(s.scheme.threat).toBe(players);
      expect(CELLS).toContain(cell(s).code);
      expect(cell(s).counters).toBe(2 * players);
      expect(s.modok!.cells).toHaveLength(3);
      expect(
        (s.environments || []).filter((p) =>
          [FLYING, PSIONIC, GARZA, STRONG].includes(p.code),
        ),
      ).toHaveLength(1);
      expect(s.modok!.upgrades).toHaveLength(3);
      for (const seat of s.players)
        expect(
          s.minions.some(
            (m) => m.code === ADAPTOID && m.engagedWith === seat.id,
          ),
        ).toBe(true);
    }
  });

  it("Expert: M.O.D.O.K. (B) with 14 hit points and two Adaptoid upgrades", () => {
    const s = opened("expert");
    expect(s.villain.code).toBe("50103b");
    expect(s.villain.hp).toBe(14);
    expect(s.modok!.upgrades).toHaveLength(2);
  });
});

describe("M.O.D.O.K.", () => {
  it("with a Holding Cell in play he resets instead of being defeated: 2 locks come off and the attachments that say so are discarded", () => {
    let s = untough(clean(started("standard", 2)));
    s = settle(resolveEncounter(reveal(s, CRYSTAL)));
    expect(s.attachments.some((a) => a.code === CRYSTAL)).toBe(true);
    s = settle(native(s, hit(s.villain.id, 30)));
    expect(s.phase).not.toBe("won");
    expect(s.villain.hp).toBe(10);
    expect(cell(s).counters).toBe(2);
    expect(s.attachments.some((a) => a.code === CRYSTAL)).toBe(false);
  });

  it("the last lock frees the Inhuman under a player's control, and the next Holding Cell enters with its locks", () => {
    let s = clean(started());
    const first = cell(s);
    const inhuman = INHUMANS[CELLS.indexOf(first.code)];
    s = freeCell(s);
    expect(s.player.inPlay.find((p) => p.id === first.id)?.code).toBe(inhuman);
    expect(cell(s).id).not.toBe(first.id);
    expect(cell(s).counters).toBe(2);
    expect(s.modok!.cells).toHaveLength(2);
  });

  it("an Inhuman that leaves play goes back to the bottom of the Holding Cell deck", () => {
    let s = clean(started());
    const first = cell(s);
    s = freeCell(s);
    s = settle(native(s, hit(first.id, 20, s.villain.id)));
    expect(s.player.inPlay.some((p) => p.id === first.id)).toBe(false);
    expect(s.modok!.cells.at(-1)?.id).toBe(first.id);
    expect(CELLS).toContain(s.modok!.cells.at(-1)?.code);
  });

  it("with every Inhuman free, defeating M.O.D.O.K. wins; an Inhuman leaving play then brings a Holding Cell back", () => {
    let s = untough(clean(started()));
    for (let i = 0; i < 4; i++) s = freeCell(s);
    expect(holdingCell(s)).toBeUndefined();
    const freed = s.player.inPlay.find((p) => INHUMANS.includes(p.code))!;
    let back = settle(native(reload(s), hit(freed.id, 20, s.villain.id)));
    expect(holdingCell(back)?.id).toBe(freed.id);
    expect(holdingCell(back)?.counters).toBe(2);
    s = settle(native(s, hit(s.villain.id, 30)));
    expect(s.phase).toBe("won");
  });

  it("a Holding Cell's Hero Action spends its resources or 3 of any type to remove a lock", () => {
    let s = clean(started());
    const pay = s.player.deck.splice(0, 3);
    s.player.hand = pay;
    s = reload(s);
    const options = abilityOptions(s, cell(s)).map((o) => o.id);
    expect(options).toContain("unlock-any");
    s = command(s, { type: "ABILITY", id: cell(s).id, action: "unlock-any" });
    if (s.prompt?.kind === "payment")
      s = command(s, {
        type: "PAY",
        ids: pay.map((p) => p.id),
        wildAs: "energy",
      });
    s = settle(s);
    expect(cell(s).counters).toBe(1);
  });

  it("Upgrading Adaptoids would be completed: another upgrade enters play, the threat comes off and the discarded Adaptoids are shuffled in; the last one loses", () => {
    let s = clean(started());
    const adaptoid = take(s, ADAPTOID);
    s.encounter.discard.push(adaptoid);
    s = reload(s);
    s = settle(native(s, { type: "threat", target: "main", amount: 7 }));
    expect(s.scheme.threat).toBe(0);
    expect(s.modok!.upgrades).toHaveLength(2);
    expect(s.encounter.deck.some((p) => p.id === adaptoid.id)).toBe(true);
    s = settle(native(s, { type: "threat", target: "main", amount: 7 }));
    expect(s.modok!.upgrades).toHaveLength(1);
    s = settle(native(s, { type: "threat", target: "main", amount: 7 }));
    expect(s.phase).toBe("lost");
  });

  it("Adaptoid upgrades: Flying gives +1 SCH, incite 1 and Aerial; Strong +1 ATK and toughness; an Adaptoid's defeat takes a lock off", () => {
    let s = clean(started());
    s = upgrade(s, FLYING);
    s = upgrade(s, STRONG);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, ADAPTOID)));
    expect(s.scheme.threat).toBe(threat + 1);
    const adaptoid = s.minions.find((m) => m.code === ADAPTOID)!;
    expect(adaptoid.tough).toBe(true);
    const locks = cell(s).counters;
    adaptoid.tough = false;
    s = reload(s);
    s = settle(native(s, hit(adaptoid.id, 10)));
    expect(cell(s).counters).toBe(locks - 1);
  });

  it("an Adaptoid's boost is shuffled into the encounter deck after the activation", () => {
    let s = clean(started());
    const p = onTop(s, ADAPTOID);
    s = settle(native(reload(s), attack(s.villain.id)));
    expect(s.encounter.deck.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(false);
  });

  it("Automated Mobile Unit gives +5 hit points until his reset discards it", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, MOBILE_UNIT)));
    expect(s.villain.maxHp).toBe(15);
    expect(s.villain.hp).toBe(15);
    s = settle(native(s, hit(s.villain.id, 30)));
    expect(s.attachments.some((a) => a.code === MOBILE_UNIT)).toBe(false);
    expect(s.villain.maxHp).toBe(10);
    expect(s.villain.hp).toBe(10);
  });

  it("Psionic Force Field: damage to M.O.D.O.K. is placed on it until 5, and he is stalwart", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, FORCE_FIELD)));
    const field = s.attachments.find((a) => a.code === FORCE_FIELD)!;
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(10);
    expect(s.attachments.find((a) => a.id === field.id)?.damage).toBe(3);
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.attachments.some((a) => a.id === field.id)).toBe(false);
    expect(s.villain.hp).toBe(10);
  });

  it("Reverse Engineering tucks an upgrade or the top card of the deck; Nanobots heal him after he activates", () => {
    let s = untough(clean(started()));
    const top = s.player.deck[0];
    s = settle(resolveEncounter(reveal(s, REVERSE)));
    const re = s.attachments.find((a) => a.code === REVERSE)!;
    expect(re.storedCards?.map((p) => p.id)).toEqual([top.id]);
    s = settle(resolveEncounter(reveal(s, NANOBOTS)));
    s.villain.hp -= 3;
    s = reload(s);
    const hp = s.villain.hp;
    s = settle(native(s, scheme(s.villain.id)));
    expect(s.villain.hp).toBe(hp + 1);
  });

  it("A.I.M. Jailer attacks the Rescued ally with the fewest remaining hit points; with none, a lock goes on the Holding Cell", () => {
    let s = clean(started());
    const locks = cell(s).counters;
    s = settle(resolveEncounter(reveal(s, JAILER)));
    expect(cell(s).counters).toBe(locks + 1);
    s.encounter.deck.push(...s.minions.splice(0));
    s = freeCell(reload(s));
    const inhuman = s.player.inPlay.find((p) => INHUMANS.includes(p.code))!;
    s = settle(resolveEncounter(reveal(s, JAILER)));
    const after = s.player.inPlay.find((p) => p.id === inhuman.id);
    expect(!after || after.damage > 0).toBe(true);
  });

  it("Hostage Situation holds a Rescued ally, and M.O.D.O.K. cannot take damage until the defeating player frees it", () => {
    let s = untough(clean(started()));
    s = freeCell(s);
    const inhuman = s.player.inPlay.find((p) => INHUMANS.includes(p.code))!;
    s = settle(resolveEncounter(reveal(s, HOSTAGE)));
    const scheme = sideScheme(s, HOSTAGE)!;
    expect(scheme.storedCards?.map((p) => p.id)).toEqual([inhuman.id]);
    expect(s.player.inPlay.some((p) => p.id === inhuman.id)).toBe(false);
    s = settle(native(s, hit(s.villain.id, 4)));
    expect(s.villain.hp).toBe(10);
    s = settle(native(s, thwart(scheme.counters, scheme.id)));
    expect(sideScheme(s, HOSTAGE)).toBeUndefined();
    expect(s.player.inPlay.some((p) => p.id === inhuman.id)).toBe(true);
  });

  it("Psionic Enhancement as a boost gives the activating enemy another boost card", () => {
    let s = clean(started());
    onTop(s, ENHANCEMENT);
    s = reload(s);
    const deck = s.encounter.deck.length;
    s = settle(native(s, attack(s.villain.id)));
    expect(s.encounter.deck.length).toBeLessThanOrEqual(deck - 2);
  });

  it("It's Alive!: each player reveals an Adaptoid; without one, a facedown encounter card", () => {
    let s = clean(started());
    s = settle(resolveEncounter(reveal(s, ALIVE)));
    expect(s.minions.some((m) => m.code === ADAPTOID)).toBe(true);
    s.removed.push(
      ...s.encounter.deck.filter((p) => p.code === ADAPTOID),
      ...s.encounter.discard.filter((p) => p.code === ADAPTOID),
    );
    s.encounter.deck = s.encounter.deck.filter((p) => p.code !== ADAPTOID);
    s.encounter.discard = s.encounter.discard.filter(
      (p) => p.code !== ADAPTOID,
    );
    s = reload(s);
    const dealt = s.encounter.dealt.length;
    s = settle(resolveEncounter(reveal(s, ALIVE)));
    expect(s.encounter.dealt.length).toBe(dealt + 1);
  });

  it("Psionic Blast: in alter-ego you are confused and he schemes; in hero form X indirect damage confuses each damaged character", () => {
    let s = clean(started());
    s.player.form = "alter";
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, BLAST)));
    expect(s.player.confused).toBe(true);
    expect(s.scheme.threat).toBeGreaterThan(threat);
    s.player.form = "hero";
    s.player.confused = false;
    s = reload(s);
    const hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, BLAST)));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.confused).toBe(true);
  });

  it("Flying Inhuman's and Psionic Inhuman's Responses after they thwart", () => {
    let s = clean(started());
    // Put the two Inhumans on top of the Holding Cell deck order.
    const all = [cell(s), ...s.modok!.cells];
    const flying = all.find((p) => p.code === "50105a")!;
    const psionic = all.find((p) => p.code === "50106a")!;
    for (const p of [flying, psionic]) {
      p.code = INHUMANS[CELLS.indexOf(p.code)];
      p.exhausted = false;
      s.environments = (s.environments || []).filter((q) => q.id !== p.id);
      s.modok!.cells = s.modok!.cells.filter((q) => q.id !== p.id);
      s.player.inPlay.push(p);
    }
    if (!holdingCell(s)) {
      const next = s.modok!.cells.shift()!;
      next.counters = 2;
      s.environments!.push(next);
    }
    s.scheme.threat = 5;
    s = reload(s);
    const locks = cell(s).counters;
    s = command(s, { type: "ABILITY", id: psionic.id, action: "thwart" });
    s = settle(s, (s) =>
      s.prompt?.options.some((o) => o.id === "unlock") ? "unlock" : undefined,
    );
    expect(cell(s).counters).toBe(locks - 1);
  });
});

describe("Scientist Supreme", () => {
  it("Scientist Supreme and Monica Rappaccini enter the victory display; Diplomatic Immunity and Diplomatic Sanctions count the A.I.M. minions there", () => {
    let s = clean(started("standard", 1, "rhino", ["scientist_supreme"]));
    const supreme = minion(s, SUPREME);
    s = reload(s);
    s = settle(native(s, hit(supreme.id, 10)));
    expect(s.victoryDisplay?.some((p) => p.id === supreme.id)).toBe(true);
    s = settle(resolveEncounter(reveal(s, IMMUNITY)));
    expect(sideScheme(s, IMMUNITY)?.accelerationTokens).toBe(1);
    const hand = s.player.deck.splice(0, 2);
    s.player.hand = hand;
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, SANCTIONS)));
    expect(s.player.hand).toHaveLength(1);
  });

  it("Scientist Supreme's attacks gain piercing", () => {
    let s = clean(started("standard", 1, "rhino", ["scientist_supreme"]));
    const supreme = minion(s, SUPREME);
    s.player.tough = true;
    s = reload(s);
    const hp = s.player.hp;
    s = settle(native(s, attack(supreme.id)));
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBeLessThan(hp);
  });
});
