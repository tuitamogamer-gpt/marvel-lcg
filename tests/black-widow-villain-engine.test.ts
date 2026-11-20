/** Agents of S.H.I.E.L.D.: Black Widow with the A.I.M. Abduction and A.I.M.
 * Science sets, exercised with the original physical cards. Every command
 * crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  pieceHP,
  scenarioModules,
} from "../src/game/cards";
import { dispatch, newGame, targets } from "../src/game/engine";
import {
  AIM_ABDUCTION_CODES,
  AIM_SCIENCE_CODES,
  BLACK_WIDOW_VILLAIN_CODES,
} from "../src/game/black-widow-villain";
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
const WEB = "50067b";
const GAUNTLET = "50068";
const HOOK = "50069";
const GOGGLES = "50070";
const STUN_NET = "50071";
const COMMANDO = "50072";
const GRUNT = "50073";
const DEFENSES = "50074";
const EVIDENCE = "50075";
const ATTACROBATICS = "50076";
const COVERT_OPS = "50077";
const DANCE = "50078";
const BITE = "50079";
const ABDUCTOR = "50080";
const ABDUCT = "50081";
const NABBED = "50082";
const SCIENTIST = "50083";
const SOLDIER = "50084";
const MAD_SCIENCE = "50085";
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "black_widow_villain",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 50064,
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
  villainId = "black_widow_villain",
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
  villainId = "black_widow_villain",
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
/** A boost card with no boost ability on top of the encounter deck. */
function plainTop(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) => !card(p).boost_star && card(p).type_code !== "minion",
  );
  expect(i).toBeGreaterThanOrEqual(0);
  const [p] = s.encounter.deck.splice(i, 1);
  s.encounter.deck.unshift(p);
  delete s.encounter.knownTop;
  return p;
}
/** A card of the player's deck with exactly one kind of printed resource
 * put on top of it. */
function resourceTop(
  s: GameState,
  kind: "energy" | "mental" | "physical",
  playerId = "p1",
) {
  const deck = seatView(s, playerId).player.deck;
  const kinds = ["energy", "mental", "physical", "wild"] as const;
  const i = deck.findIndex((p) => {
    const c = card(p) as unknown as Record<string, number | undefined>;
    return kinds.every((k) =>
      k === kind ? (c[`resource_${k}`] || 0) > 0 : !c[`resource_${k}`],
    );
  });
  expect(i, kind).toBeGreaterThanOrEqual(0);
  const [p] = deck.splice(i, 1);
  deck.unshift(p);
  return p;
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
const scheme = (id: string, playerId = "p1"): Effect => ({
  type: "enemyScheme",
  id,
  actorId: playerId,
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
/** Clear the setup minions and the encounter cards so a test controls the
 * top of the encounter deck. */
function clean(s: GameState) {
  s.encounter.deck.push(...s.minions.splice(0));
  for (const p of s.encounter.deck) {
    delete p.engagedWith;
    p.damage = 0;
  }
  return s;
}
const sideScheme = (s: GameState, code: string) =>
  s.sideSchemes.find((p) => p.code === code);
const basicAttack = (s: GameState) =>
  command(reload(s), { type: "BASIC", action: "attack" });
const attacks = (s: GameState) => Number(s.flags.attacksPerformed || 0);

describe("Black Widow: original source", () => {
  it("registers every face of the Black Widow, A.I.M. Abduction and A.I.M. Science sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "aos" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(BLACK_WIDOW_VILLAIN_CODES)).toEqual(
      new Set(faces("black_widow_villain")),
    );
    expect(new Set(AIM_ABDUCTION_CODES)).toEqual(
      new Set(faces("a.i.m._abduction")),
    );
    expect(new Set(AIM_SCIENCE_CODES)).toEqual(
      new Set(faces("a.i.m._science")),
    );
    for (const code of [
      ...BLACK_WIDOW_VILLAIN_CODES,
      ...AIM_ABDUCTION_CODES,
      ...AIM_SCIENCE_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(MODULES.slice(-4, -2).map((m) => m.id)).toEqual([
      "a.i.m._abduction",
      "a.i.m._science",
    ]);
    expect(scenarioModules("black_widow_villain")).toHaveLength(MODULES.length);
    expect(VILLAINS.find((v) => v.id === "black_widow_villain")).toMatchObject({
      codes: ["50064", "50065", "50066"],
      schemes: [WEB],
      moduleCount: 2,
      defaultModules: ["a.i.m._abduction", "a.i.m._science"],
    });
  });

  it("Black Widow (I), The Widow's Web with 2 threat per player, and a minion engaged with each player", () => {
    for (const players of [1, 2]) {
      const s = opened("standard", players);
      expect(s.villain.code).toBe("50064");
      expect(s.villain.hp).toBe(13 * players);
      expect(s.scheme.code).toBe(WEB);
      for (const seat of s.players)
        expect(s.minions.some((m) => m.engagedWith === seat.id)).toBe(true);
    }
  });

  it("Expert starts with Black Widow (II), whose When Revealed adds 2 threat per player", () => {
    for (const players of [1, 2]) {
      const s = opened("expert", players);
      expect(s.villain.code).toBe("50065");
      expect(s.villain.hp).toBe(16 * players);
      expect(s.scheme.threat).toBe(4 * players);
    }
  });
});

describe("Black Widow", () => {
  it("The Widow's Web gains her stage in threat per player each villain phase", () => {
    let s = untough(clean(started()));
    let threat = s.scheme.threat;
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(threat + 1);
    // Black Widow (II): 2 per player when revealed, then 2 each phase.
    threat = s.scheme.threat;
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.villain.code).toBe("50065");
    expect(s.scheme.threat).toBe(threat + 2);
    threat = s.scheme.threat;
    s = settle(native(untough(s), { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(threat + 2);
  });

  it("attacking her removes 1 threat, then the top card's Preparation resolves: Black Widow's Gauntlet attaches with retaliate 1", () => {
    let s = untough(clean(started()));
    const top = onTop(s, GAUNTLET);
    s = reload(s);
    const threat = s.scheme.threat;
    const hp = s.player.hp;
    s = settle(basicAttack(s));
    expect(s.scheme.threat).toBe(threat - 1);
    expect(s.attachments.find((a) => a.id === top.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.player.hp).toBe(hp - 1);
  });

  it("with no threat on the main scheme, her Forced Interrupt resolves nothing", () => {
    let s = untough(clean(started()));
    s.scheme.threat = 0;
    const top = onTop(s, ATTACROBATICS);
    s = reload(s);
    const hp = s.villain.hp;
    s = settle(basicAttack(s));
    expect(s.villain.hp).toBeLessThan(hp);
    expect(s.encounter.deck[0].id).toBe(top.id);
  });

  it("Attacrobatics' Preparation prevents all damage from the attack; in Expert the attacker takes it", () => {
    let s = untough(clean(started()));
    onTop(s, ATTACROBATICS);
    s = reload(s);
    let hp = s.villain.hp;
    s = settle(basicAttack(s));
    expect(s.villain.hp).toBe(hp);
    let x = untough(clean(started("expert")));
    onTop(x, ATTACROBATICS);
    x = reload(x);
    hp = x.villain.hp;
    const hero = x.player.hp;
    x = settle(basicAttack(x));
    expect(x.villain.hp).toBe(hp);
    expect(hero - x.player.hp).toBe(2);
  });

  it("A.I.M. Grunt's Preparation: it engages you and the attack resolves against it instead", () => {
    let s = untough(clean(started()));
    const grunt = onTop(s, GRUNT);
    s = reload(s);
    const hp = s.villain.hp;
    s = settle(basicAttack(s));
    expect(s.villain.hp).toBe(hp);
    const g = s.minions.find((m) => m.id === grunt.id);
    expect(g?.engagedWith).toBe("p1");
    expect(g?.damage).toBe(2);
  });

  it("A.I.M. Commando and Widow's Bite: after the attack it engages you and you are stunned", () => {
    let s = untough(clean(started()));
    const commando = onTop(s, COMMANDO);
    s = reload(s);
    const hp = s.villain.hp;
    s = settle(basicAttack(s));
    expect(s.villain.hp).toBe(hp - 2);
    expect(s.minions.find((m) => m.id === commando.id)?.engagedWith).toBe("p1");
    s.player.exhausted = false;
    s.minions = [];
    onTop(s, BITE);
    s = reload(s);
    s = settle(basicAttack(s));
    expect(s.player.stunned).toBe(true);
  });

  it("Covert Ops and Dance of Death as Preparations: threat on each scheme, damage to each of your characters", () => {
    let s = untough(clean(started()));
    onTop(s, COVERT_OPS);
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(basicAttack(s));
    // 1 removed by her Forced Interrupt, 1 placed by Covert Ops.
    expect(s.scheme.threat).toBe(threat);
    s.player.exhausted = false;
    onTop(s, DANCE);
    s = reload(s);
    const hero = s.player.hp;
    s = settle(basicAttack(s));
    expect(s.player.hp).toBe(hero - 1);
  });

  it("Night Vision Goggles: a card without a Preparation prevents all damage from the attack, then the Goggles are discarded", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, GOGGLES)));
    const goggles = s.attachments.find((a) => a.code === GOGGLES)!;
    expect(goggles.attachedTo).toBe(s.villain.id);
    onTop(s, EVIDENCE);
    s = reload(s);
    const hp = s.villain.hp;
    s = settle(basicAttack(s));
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((a) => a.id === goggles.id)).toBe(false);
  });

  it("Automated Defenses: a card without a Preparation deals 1 damage to the attacker", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, DEFENSES)));
    expect(sideScheme(s, DEFENSES)).toBeTruthy();
    onTop(s, EVIDENCE);
    s = reload(s);
    const hero = s.player.hp;
    const hp = s.villain.hp;
    s = settle(basicAttack(s));
    expect(s.player.hp).toBe(hero - 1);
    expect(s.villain.hp).toBe(hp - 2);
  });

  it("Black Widow's Gauntlet: after an attack without a Preparation you may discard it", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, GAUNTLET)));
    const gauntlet = s.attachments.find((a) => a.code === GAUNTLET)!;
    onTop(s, EVIDENCE);
    s = reload(s);
    s = settle(
      basicAttack(s),
      (v) => v.prompt?.options.find((o) => o.id === "discard")?.id,
    );
    expect(s.attachments.some((a) => a.id === gauntlet.id)).toBe(false);
  });

  it("Stun Net's Preparation attaches to the attacking ally, which then cannot attack", () => {
    let s = untough(clean(started()));
    const ally = own(s, "ally");
    onTop(s, STUN_NET);
    s = reload(s);
    s = settle(command(s, { type: "ABILITY", id: ally.id, action: "attack" }));
    const net = s.attachments.find((a) => a.code === STUN_NET)!;
    expect(net.attachedTo).toBe(ally.id);
    const after = s.player.inPlay.find((p) => p.id === ally.id)!;
    after.exhausted = false;
    s = reload(s);
    const blocked = dispatch(reload(s), {
      type: "ABILITY",
      id: ally.id,
      action: "attack",
    });
    expect(blocked.error).toBeTruthy();
  });
});

describe("Black Widow encounter cards", () => {
  it("Stun Net attaches to your identity: you cannot attack until a character you control is exhausted to discard it", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, STUN_NET)));
    const net = s.attachments.find((a) => a.code === STUN_NET)!;
    expect(net.attachedTo).toBe("hero:p1");
    const blocked = dispatch(reload(s), { type: "BASIC", action: "attack" });
    expect(blocked.error).toMatch(/Stun Net/);
    s = settle(command(s, { type: "ABILITY", id: net.id, action: "discard" }));
    expect(s.attachments.some((a) => a.id === net.id)).toBe(false);
    expect(s.player.exhausted).toBe(true);
  });

  it("Grappling Hook cancels the next event played, then is discarded", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, HOOK)));
    const hook = s.attachments.find((a) => a.code === HOOK)!;
    expect(hook.attachedTo).toBe(s.villain.id);
    s.player.hp -= 3;
    const aid = s.player.deck.findIndex((p) => p.code === "01086");
    expect(aid).toBeGreaterThanOrEqual(0);
    const [firstAid] = s.player.deck.splice(aid, 1);
    const [pay] = s.player.deck.splice(0, 1);
    s.player.hand = [firstAid, pay];
    s = reload(s);
    const hp = s.player.hp;
    s = command(s, { type: "PLAY", id: firstAid.id });
    if (s.prompt?.kind === "payment")
      s = command(s, { type: "PAY", ids: [pay.id], wildAs: "energy" });
    s = settle(s);
    expect(s.player.hp).toBe(hp);
    expect(s.attachments.some((a) => a.id === hook.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === firstAid.id)).toBe(true);
  });

  it("Attacrobatics: in alter-ego you change to hero form, and she attacks you with an additional boost card", () => {
    let s = untough(clean(started()));
    s.player.form = "alter";
    s = reload(s);
    const before = attacks(s);
    const deck = s.encounter.deck.length;
    s = settle(resolveEncounter(reveal(s, ATTACROBATICS)));
    expect(s.player.form).toBe("hero");
    expect(attacks(s)).toBe(before + 1);
    // Attacrobatics itself and two boost cards left the deck.
    expect(s.encounter.deck.length).toBeLessThanOrEqual(deck - 3);
  });

  it("Covert Ops confuses you and she schemes; Widow's Bite stuns you and deals 1 damage, 2 if you were stunned", () => {
    let s = untough(clean(started()));
    s.player.form = "alter";
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, COVERT_OPS)));
    expect(s.player.confused).toBe(true);
    expect(s.scheme.threat).toBeGreaterThan(threat);
    s.player.form = "hero";
    s = reload(s);
    let hp = s.player.hp;
    s = settle(resolveEncounter(reveal(s, BITE)));
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBe(hp - 1);
    hp = s.player.hp;
    s.encounter.deck.push(...s.encounter.discard.splice(0));
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, BITE)));
    expect(s.player.hp).toBe(hp - 2);
  });

  it("Dance of Death: 1, 2 and 3 damage to different characters you control", () => {
    let s = untough(clean(started()));
    const ally = own(s, "ally");
    s = reload(s);
    const hp = s.player.hp;
    s = settle(
      resolveEncounter(reveal(s, DANCE)),
      (v) => v.prompt?.options.find((o) => o.id === "hero:p1")?.id,
    );
    expect(s.player.hp).toBe(hp - 1);
    const left = s.player.inPlay.find((p) => p.id === ally.id);
    if (left) expect(left.damage).toBe(2);
    else expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
  });

  it("Destroy Evidence gives each other encounter card incite 1", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, EVIDENCE)));
    expect(sideScheme(s, EVIDENCE)).toBeTruthy();
    s.player.form = "alter";
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, GAUNTLET)));
    expect(s.scheme.threat).toBe(threat + 1);
  });
});

describe("A.I.M. Abduction and A.I.M. Science", () => {
  it("A.I.M. Abductor tucks your healthiest ally under Abduct Superhumans; Nabbed! digs one out of your deck; defeating the scheme frees them", () => {
    let s = untough(clean(started()));
    const ally = own(s, "ally");
    s = reload(s);
    s = settle(resolveEncounter(reveal(s, ABDUCTOR)));
    let abduct = sideScheme(s, ABDUCT)!;
    expect(abduct).toBeTruthy();
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect((abduct.storedCards || []).map((p) => p.id)).toContain(ally.id);
    expect(abduct.accelerationTokens).toBe(1);
    expect(abduct.counters).toBe(2 + Math.max(0, Number(card(ally).cost) || 0));
    // Nabbed!: the next ally of your deck is tucked too.
    s = settle(resolveEncounter(reveal(s, NABBED)));
    abduct = sideScheme(s, ABDUCT)!;
    expect(abduct.storedCards?.length).toBe(2);
    expect(abduct.accelerationTokens).toBe(2);
    const tucked = abduct.storedCards!.map((p) => p.id);
    s = settle(
      native(s, {
        type: "thwart",
        target: abduct.id,
        amount: abduct.counters,
        source: "hero",
      }),
    );
    expect(sideScheme(s, ABDUCT)).toBeUndefined();
    for (const id of tucked)
      expect(s.player.inPlay.some((p) => p.id === id)).toBe(true);
  });

  it("A.I.M. Abductor without an ally places 2 threat on Abduct Superhumans; an ally defeated while it is in play is tucked", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, ABDUCTOR)));
    const abduct = sideScheme(s, ABDUCT)!;
    expect(abduct.counters).toBe(4);
    const ally = own(s, "ally");
    s = reload(s);
    s = settle(native(s, hit(ally.id, 10, s.villain.id)));
    const after = sideScheme(s, ABDUCT)!;
    expect((after.storedCards || []).map((p) => p.id)).toContain(ally.id);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(false);
  });

  it("Nabbed!: an ally discarded as the last card of your deck is tucked, not reshuffled into the new deck", () => {
    let s = untough(clean(started()));
    const deck = s.player.deck;
    const [ally] = deck.splice(
      deck.findIndex((p) => card(p).type_code === "ally"),
      1,
    );
    s.player.discard.push(...deck.splice(0));
    deck.push(ally);
    s = settle(resolveEncounter(reveal(reload(s), NABBED)));
    expect((sideScheme(s, ABDUCT)!.storedCards || []).map((p) => p.id)).toEqual(
      [ally.id],
    );
    expect(
      [
        ...s.player.deck,
        ...s.player.discard,
        ...s.player.hand,
        ...s.player.inPlay,
      ].some((p) => p.id === ally.id),
    ).toBe(false);
  });

  it("Nabbed! with no ally in your deck or discard pile discards each card once, then stops", () => {
    let s = untough(clean(started()));
    const isAlly = (p: Piece) => card(p).type_code === "ally";
    s.removed.push(
      ...s.player.deck.filter(isAlly),
      ...s.player.discard.filter(isAlly),
    );
    s.player.deck = s.player.deck.filter((p) => !isAlly(p));
    s.player.discard = s.player.discard.filter((p) => !isAlly(p));
    const reshuffles = (s: GameState) =>
      s.log.filter((l) =>
        /Your deck reshuffles/.test(
          typeof l === "string" ? l : (l as { text: string }).text,
        ),
      ).length;
    const before = reshuffles(s);
    s = settle(resolveEncounter(reveal(reload(s), NABBED)));
    expect(sideScheme(s, ABDUCT)!.storedCards || []).toHaveLength(0);
    expect(reshuffles(s) - before).toBe(1);
  });

  it("A.I.M. Soldier brings A.I.M. Scientist in, which cannot be attacked while you are engaged with another minion; Mad Science accelerates", () => {
    let s = untough(clean(started()));
    s = settle(resolveEncounter(reveal(s, SOLDIER)));
    const scientist = s.minions.find((m) => m.code === SCIENTIST);
    expect(scientist?.engagedWith).toBe("p1");
    expect(targets(s, "enemy", true).map((t) => t.id)).not.toContain(
      scientist!.id,
    );
    // A second Soldier: the Scientist is already in play, so 1 threat.
    s.encounter.deck.push(...s.encounter.discard.splice(0));
    s = reload(s);
    const threat = s.scheme.threat;
    s = settle(resolveEncounter(reveal(s, SOLDIER)));
    expect(s.scheme.threat).toBeGreaterThan(threat);
    // Mad Science: an acceleration icon on each A.I.M. minion.
    s = settle(resolveEncounter(reveal(s, MAD_SCIENCE)));
    const aim = s.minions.filter((m) =>
      card(m).traits?.includes("A.I.M."),
    ).length;
    const before = s.scheme.threat;
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat - before).toBeGreaterThanOrEqual(1 + aim);
  });
});
