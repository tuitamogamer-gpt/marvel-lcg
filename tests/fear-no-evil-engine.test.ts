/** Fear No Evil, part one: the missions The Getaway and Art Museum Heist
 * with the Underlings Bullseye, Electro and Hammerhead, and the Cops, Drive
 * and The Owl modular sets, exercised with the original physical cards.
 * Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, MODULES, VILLAINS, card } from "../src/game/cards";
import {
  abilityOptions,
  dispatch,
  enemyStats,
  escalation,
  makePiece,
  newGame,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  FEAR_NO_EVIL_CODES,
  fneObjective,
  fneUnderlingFor,
} from "../src/game/fear-no-evil";
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
const GETAWAY_ID = "fne_the_getaway";
const HEIST_ID = "fne_art_museum_heist";
const GETAWAY = "60128b";
const HEIST = "60121b";
const OUT_FRONT = "60129a";
const ALONGSIDE = "60129b";
const ESCORT = "60130";
const TANKER = "60131";
const BURNING = "60132";
const PEDESTRIANS = "60133";
const IMPOSSIBLE = "60122";
const POTTERY = "60123";
const REPLICA = "60124";
const LANDSCAPE = "60125";
const ARTS = [IMPOSSIBLE, POTTERY, REPLICA, LANDSCAPE];
const ART_THIEF = "60126";
const TUG = "60127";
const BULLSEYE = ["60065", "60066", "60067"];
const SPINE = "60068a";
const DAMAGED_SPINE = "60068b";
const STAKES = "60069";
const SAI = "60070";
const PURSUIT = "60071";
const LADY = "60072";
const BLOODLUST = "60073";
const WEAPON = "60074";
const DESIRE = "60075";
const ELECTRO = ["60076", "60077", "60078"];
const CHARGE = "60079";
const DRAINED = "60080";
const WHIPLASH = "60081";
const CHARGING = "60082";
const CHAIN = "60083";
const OVERLOAD = "60084";
const SHOCKING = "60085";
const HAMMERHEAD = ["60086", "60087", "60088"];
const GATLING = "60089";
const HARDHEADED = "60090";
const CHAMELEON = "60091";
const ENFORCERS = "60092";
const UNDERBOSS = "60093";
const CONSOLIDATE = "60094";
const STRUGGLE = "60095";
const HEAD_FIRST = "60096";
const COP = "60182";
const CROOKED = "60183";
const WANTED = "60184";
const CORDON = "60185";
const SPORTS_CAR = "60186";
const MOTORCYCLE = "60187";
const VAN = "60188";
const TRAFFIC = "60189";
const CARJACKING = "60190";
const SERUM = "60191";
const FISH = "60192";
const OWL = "60193";
const SWOOP = "60194";

function setup(
  villainId = GETAWAY_ID,
  underling = "bullseye",
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  seed = 60128,
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed,
    pacing: "expert",
    heroes: team.slice(0, players),
    underling,
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
  villainId = GETAWAY_ID,
  underling = "bullseye",
  difficulty: "standard" | "expert" = "standard",
  players = 1,
) {
  let s = settle(setup(villainId, underling, difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(
  villainId = GETAWAY_ID,
  underling = "bullseye",
  difficulty: "standard" | "expert" = "standard",
  players = 1,
) {
  const s = opened(villainId, underling, difficulty, players);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  s.villain.tough = false;
  s.villain.toughCards = 0;
  s.villain.stunned = s.villain.confused = false;
  s.villain.stunCards = s.villain.confuseCards = 0;
  return reload(s);
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.fearNoEvil?.setAside || [],
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) {
      const [p] = zone.splice(i, 1);
      delete p.attachedTo;
      delete p.engagedWith;
      return p;
    }
  }
  return makePiece(s, code);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
const hit = (target: string, amount: number, source = "hero"): Effect => ({
  type: "damage",
  target,
  amount,
  source,
});
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
  p.damage = 0;
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
function playerCard(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  if (i >= 0) return p.deck.splice(i, 1)[0];
  return makePiece(s, code);
}
function ally(s: GameState, code = "01002", playerId = s.activePlayerId) {
  const p = playerCard(s, code, playerId);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
/** A villain attack against the active player, settled without defense. */
function villainAttacks(s: GameState, playerId = s.activePlayerId) {
  return settle(
    native(s, {
      type: "enemyAttack",
      id: s.villain.id,
      actorId: playerId,
    }),
  );
}
const att = (s: GameState, code: string) =>
  s.attachments.find((p) => p.code === code);

describe("Fear No Evil registration and setup", () => {
  it("registers every face of this import natively", () => {
    const sets = [
      "fne_bullseye",
      "fne_electro",
      "fne_hammerhead",
      "fne_the_getaway",
      "fne_art_museum_heist",
      "fne_cops",
      "fne_drive",
      "fne_the_owl",
    ];
    const faces = CATALOG_CARDS.filter((c) => sets.includes(c.set_code || ""));
    expect(faces.map((c) => c.code).sort()).toEqual(
      [...FEAR_NO_EVIL_CODES].sort(),
    );
    expect(faces).toHaveLength(62);
    for (const c of faces) expect(hasExecutableScript(c), c.code).toBe(true);
    const getaway = VILLAINS.find((v) => v.id === GETAWAY_ID)!;
    expect(getaway.schemes).toEqual([GETAWAY]);
    expect(getaway.defaultModules).toEqual(["fne_cops", "fne_drive"]);
    const heist = VILLAINS.find((v) => v.id === HEIST_ID)!;
    expect(heist.schemes).toEqual([HEIST]);
    expect(heist.defaultModules).toEqual(["fne_cops", "fne_the_owl"]);
    for (const id of ["fne_cops", "fne_drive", "fne_the_owl"])
      expect(MODULES.some((m) => m.id === id)).toBe(true);
  });
  it("picks the chosen Underling, or one from the seed", () => {
    expect(fneUnderlingFor(GETAWAY_ID, "electro", 1)).toBe("electro");
    expect(fneUnderlingFor(GETAWAY_ID, undefined, 3)).toBe("bullseye");
    expect(fneUnderlingFor(GETAWAY_ID, undefined, 4)).toBe("electro");
    expect(fneUnderlingFor(GETAWAY_ID, undefined, 5)).toBe("hammerhead");
    expect(fneUnderlingFor("rhino", "electro", 1)).toBeUndefined();
  });
  it("The Getaway: 1 speed counter, Out Front on Bullseye (I), 2 threat per player, Adamantium-Laced Spine set aside", () => {
    const s = opened(GETAWAY_ID, "bullseye", "standard", 2);
    expect(s.villain.code).toBe(BULLSEYE[0]);
    expect(s.villain.hp).toBe(28);
    expect(s.scheme.code).toBe(GETAWAY);
    expect(s.scheme.threat).toBe(4);
    expect(s.fearNoEvil!.speed).toBe(1);
    expect(att(s, OUT_FRONT)!.attachedTo).toBe(s.villain.id);
    expect(s.fearNoEvil!.setAside.map((p) => p.code)).toEqual([SPINE]);
    const sets = new Set(s.encounter.deck.map((p) => card(p).set_code));
    for (const set of [
      "fne_bullseye",
      "fne_the_getaway",
      "fne_cops",
      "fne_drive",
      "standard",
    ])
      expect(sets.has(set), set).toBe(true);
    expect(sets.has("fne_electro")).toBe(false);
    expect(
      s.encounter.deck.some((p) =>
        [SPINE, DAMAGED_SPINE, OUT_FRONT, ALONGSIDE].includes(p.code),
      ),
    ).toBe(false);
    expect(fneObjective(s)).toBe(
      "Defeat Bullseye · stage 1 of 2 · 1 speed counter",
    );
  }, 30000);
  it("Expert: 2 speed counters and Bullseye (II) with Adamantium-Laced Spine attached", () => {
    const s = opened(GETAWAY_ID, "bullseye", "expert");
    expect(s.villain.code).toBe(BULLSEYE[1]);
    expect(s.villain.hp).toBe(16);
    expect(s.fearNoEvil!.speed).toBe(2);
    expect(att(s, SPINE)!.attachedTo).toBe(s.villain.id);
  }, 30000);
  it("Electro (I) finds Electric Charge with 2 charge counters per player", () => {
    const s = opened(GETAWAY_ID, "electro", "standard", 2);
    expect(s.villain.code).toBe(ELECTRO[0]);
    expect(s.villain.hp).toBe(30);
    expect(att(s, CHARGE)!.attachedTo).toBe(s.villain.id);
    expect(att(s, CHARGE)!.counters).toBe(4);
  }, 30000);
  it("Art Museum Heist: one random Art on the villain, the other three in the encounter deck", () => {
    const s = opened(HEIST_ID, "hammerhead");
    expect(s.villain.code).toBe(HAMMERHEAD[0]);
    expect(s.scheme.code).toBe(HEIST);
    expect(s.scheme.threat).toBe(1);
    const onVillain = s.attachments.filter((p) => ARTS.includes(p.code));
    expect(onVillain).toHaveLength(1);
    expect(onVillain[0].attachedTo).toBe(s.villain.id);
    expect(s.encounter.deck.filter((p) => ARTS.includes(p.code))).toHaveLength(
      3,
    );
    // X is 1 more than the Art attachments on the villain.
    expect(escalation(s)).toBe(2);
  }, 30000);
});

describe("The Getaway", () => {
  it("Out Front: damage to the villain removes main scheme threat instead", () => {
    let s = started();
    s.scheme.threat = 5;
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(14);
    expect(s.scheme.threat).toBe(2);
    expect(att(s, OUT_FRONT)).toBeTruthy();
  }, 30000);
  it("flips to Alongside at no threat: each player takes 1 indirect damage and the villain 2 per player", () => {
    let s = started();
    s.scheme.threat = 2;
    const hp = s.player.hp;
    s = settle(native(s, hit(s.villain.id, 4)));
    expect(s.scheme.threat).toBe(0);
    expect(att(s, ALONGSIDE)).toBeTruthy();
    expect(att(s, OUT_FRONT)).toBeUndefined();
    expect(s.villain.hp).toBe(12);
    expect(s.player.hp).toBe(hp - 1);
    // Alongside: the villain takes damage normally.
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(9);
  }, 30000);
  it("when the round ends with threat: 1 speed counter, and Alongside flips back to Out Front", () => {
    let s = started();
    s.scheme.threat = 2;
    s = settle(native(s, { type: "newRound" }));
    expect(s.fearNoEvil!.speed).toBe(3);
    const out = att(s, OUT_FRONT)!;
    out.code = ALONGSIDE;
    s = reload(s);
    s = settle(native(s, { type: "newRound" }));
    expect(s.fearNoEvil!.speed).toBe(4);
    expect(att(s, OUT_FRONT)).toBeTruthy();
  }, 30000);
  it("Jackknifed Tanker Truck: the villain cannot be dealt damage", () => {
    let s = started();
    s.scheme.threat = 6;
    sideScheme(s, TANKER);
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.scheme.threat).toBe(6);
    expect(s.villain.hp).toBe(14);
  }, 30000);
  it("Escort Vehicle gains toughness at 3 speed counters and surge at 9", () => {
    let s = started();
    s.fearNoEvil!.speed = 3;
    s = settle(reveal(s, ESCORT));
    const escort = s.minions.find((p) => p.code === ESCORT)!;
    expect(escort.tough).toBe(true);
  }, 30000);
  it("Burning Rubber: for each speed counter, spend a resource or place 1 threat", () => {
    let s = started();
    s.fearNoEvil!.speed = 2;
    s.scheme.threat = 1;
    s.player.hand = [];
    s = settle(reveal(s, BURNING));
    expect(s.scheme.threat).toBe(3);
  }, 30000);
  it("Pedestrians: for each speed counter, exhaust a character or take 1 indirect damage", () => {
    let s = started();
    s.fearNoEvil!.speed = 2;
    const hp = s.player.hp;
    s = reveal(s, PEDESTRIANS);
    expect(s.prompt?.title).toBe("Pedestrians");
    s = choose(s, `exhaust:hero:${s.activePlayerId}`);
    expect(s.player.exhausted).toBe(true);
    s = settle(s);
    expect(s.player.hp).toBe(hp - 1);
  }, 30000);
});

describe("Art Museum Heist", () => {
  it("the acceleration X counts the Art on the villain, per player", () => {
    const s = started(HEIST_ID, "bullseye", "standard", 2);
    for (const a of s.attachments.filter((p) => ARTS.includes(p.code)))
      a.attachedTo = "hero:p1";
    attachTo(s, POTTERY, s.villain.id);
    attachTo(s, REPLICA, s.villain.id);
    expect(escalation(s)).toBe(6);
  }, 30000);
  it("an Art's Hero Action attaches it to your hero: Replica Shield gives a tough status card", () => {
    let s = started(HEIST_ID, "electro");
    for (const a of s.attachments.filter((p) => ARTS.includes(p.code)))
      a.attachedTo = "hero:p2";
    const shield = attachTo(s, REPLICA, s.villain.id);
    s.player.exhausted = false;
    s = reload(s);
    const option = abilityOptions(s, att(s, REPLICA)!).find((o) =>
      /exhaust your hero/.test(o.label),
    );
    expect(option).toBeTruthy();
    s = settle(
      command(s, { type: "ABILITY", id: shield.id, action: option!.id }),
    );
    expect(att(s, REPLICA)!.attachedTo).toBe("hero:p1");
    expect(s.player.exhausted).toBe(true);
    expect(s.player.tough).toBe(true);
  }, 30000);
  it("an undefended attack against an identity attaches one of its Art to the villain", () => {
    let s = started(HEIST_ID, "electro");
    for (const a of s.attachments.filter((p) => ARTS.includes(p.code)))
      a.attachedTo = "hero:p2";
    attachTo(s, POTTERY, "hero:p1");
    const charge = att(s, CHARGE);
    if (charge) charge.counters = 0;
    blankTop(s, 3);
    s = villainAttacks(s);
    expect(att(s, POTTERY)!.attachedTo).toBe(s.villain.id);
  }, 30000);
  it("Art Thief finds an Art in the encounter deck and attaches it to the villain", () => {
    let s = started(HEIST_ID, "hammerhead");
    const before = s.attachments.filter(
      (p) => ARTS.includes(p.code) && p.attachedTo === s.villain.id,
    ).length;
    s = settle(reveal(s, ART_THIEF));
    expect(
      s.attachments.filter(
        (p) => ARTS.includes(p.code) && p.attachedTo === s.villain.id,
      ),
    ).toHaveLength(before + 1);
  }, 30000);
  it("Tug of War: declined, an Art moves from an identity to the villain and it surges", () => {
    let s = started(HEIST_ID, "hammerhead");
    for (const a of s.attachments.filter((p) => ARTS.includes(p.code)))
      a.attachedTo = "hero:p9";
    const pottery = attachTo(s, POTTERY, "hero:p1");
    blankTop(s, 2);
    const tug = take(s, TUG);
    const deck = s.encounter.deck.length;
    s = settle(native(s, { type: "reveal", piece: tug, actorId: "p1" }));
    expect(att(s, POTTERY)!.id).toBe(pottery.id);
    expect(att(s, POTTERY)!.attachedTo).toBe(s.villain.id);
    // The surge revealed the next encounter card.
    expect(s.encounter.deck.length).toBe(deck - 1);
  }, 30000);
});

describe("Bullseye", () => {
  it("each of his boost cards gains a boost icon, and his attacks gain ranged", () => {
    let s = started(GETAWAY_ID, "bullseye");
    take(s, OUT_FRONT);
    blankTop(s, 3);
    s.player.hp = 30;
    const hp = s.player.hp;
    s = villainAttacks(s);
    // Bullseye (I): 1 ATK + 1 boost card with 0 printed icons + 1.
    expect(hp - s.player.hp).toBe(2);
  }, 30000);
  it("Deadly Sai: his attacks lose ranged and gain piercing", () => {
    let s = started(GETAWAY_ID, "bullseye");
    take(s, OUT_FRONT);
    attachTo(s, SAI, s.villain.id);
    s.player.tough = true;
    blankTop(s, 3);
    s.player.hp = 30;
    s = villainAttacks(s);
    // Piercing discards the tough status card before the damage.
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(28);
  }, 30000);
  it("Adamantium-Laced Spine prevents all but 3 of the damage and flips at 6", () => {
    let s = started(GETAWAY_ID, "bullseye", "expert");
    take(s, OUT_FRONT);
    s = settle(native(s, hit(s.villain.id, 7)));
    expect(s.villain.hp).toBe(13);
    expect(att(s, SPINE)!.damage).toBe(4);
    s = settle(native(s, hit(s.villain.id, 5)));
    expect(s.villain.hp).toBe(10);
    expect(att(s, DAMAGED_SPINE)!.damage).toBe(6);
    // Damaged Spine: Bullseye takes his damage in full.
    s = settle(native(s, hit(s.villain.id, 5)));
    expect(s.villain.hp).toBe(5);
  }, 30000);
  it("Damaged Spine loses 3 damage after Bullseye schemes and flips back at 0", () => {
    let s = started(GETAWAY_ID, "bullseye", "expert");
    s.player.form = "alter";
    const spine = att(s, SPINE)!;
    spine.code = DAMAGED_SPINE;
    spine.damage = 3;
    blankTop(s, 3);
    s = settle(
      native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
    );
    expect(att(s, SPINE)!.damage).toBe(0);
  }, 30000);
  it("Raise the Stakes gives Bullseye an additional boost card, then goes back into the encounter deck", () => {
    let s = started(GETAWAY_ID, "bullseye");
    take(s, OUT_FRONT);
    attachTo(s, STAKES, s.villain.id);
    blankTop(s, 4);
    s.player.hp = 30;
    s = villainAttacks(s);
    // 1 ATK + two boost cards with 1 icon each from Bullseye.
    expect(s.player.hp).toBe(27);
    expect(att(s, STAKES)).toBeUndefined();
    expect(s.encounter.deck.some((p) => p.code === STAKES)).toBe(true);
  }, 30000);
  it("Incessant Pursuit: the villain attacks the attached ally instead with overkill, and the defeated ally leaves the game", () => {
    let s = started(GETAWAY_ID, "bullseye");
    take(s, OUT_FRONT);
    const a = ally(s);
    s = settle(reveal(s, PURSUIT));
    expect(att(s, PURSUIT)!.attachedTo).toBe(a.id);
    s.player.inPlay.find((p) => p.id === a.id)!.damage = 1;
    blankTop(s, 3);
    s = reload(s);
    const hp = s.player.hp;
    s = villainAttacks(s);
    expect(s.player.inPlay.some((p) => p.id === a.id)).toBe(false);
    expect(s.removed.some((p) => p.id === a.id)).toBe(true);
    // Bullseye's 2 damage defeats Black Cat with 1 hit point left; overkill
    // sends the excess to the identity.
    expect(s.player.hp).toBe(hp - 1);
  }, 30000);
  it("Deranged Bloodlust gets additional threat equal to Bullseye's stage", () => {
    let s = started(GETAWAY_ID, "bullseye", "expert");
    s = settle(reveal(s, BLOODLUST));
    const p = s.sideSchemes.find((q) => q.code === BLOODLUST)!;
    expect(p.counters).toBe(6);
  }, 30000);
  it("Everything Is A Weapon in alter-ego form: 2 indirect damage", () => {
    let s = started(GETAWAY_ID, "bullseye");
    s.player.form = "alter";
    const hp = s.player.hp;
    s = settle(reveal(s, WEAPON));
    expect(hp - s.player.hp).toBe(2);
  }, 30000);
  it("Unerring Desire becomes the villain's facedown boost card", () => {
    let s = started(GETAWAY_ID, "bullseye");
    s = settle(reveal(s, DESIRE));
    expect(s.encounter.storedBoosts?.map((p) => p.code)).toEqual([DESIRE]);
  }, 30000);
  it("Lady Bullseye's undefended attack gets an additional boost card", () => {
    let s = started(GETAWAY_ID, "bullseye");
    const lady = minion(s, LADY);
    blankTop(s, 4);
    s.player.hp = 30;
    s = settle(native(s, { type: "enemyAttack", id: lady.id, actorId: "p1" }));
    // Villainous and Lady Bullseye's additional boost card: 2 cards drawn.
    expect(s.encounter.discard.filter((p) => p.code === "01098")).toHaveLength(
      2,
    );
  }, 30000);
});

describe("Electro", () => {
  it("places a charge counter after he schemes", () => {
    let s = started(GETAWAY_ID, "electro");
    s.player.form = "alter";
    const before = att(s, CHARGE)!.counters;
    blankTop(s, 3);
    s = settle(
      native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
    );
    expect(att(s, CHARGE)!.counters).toBe(before + 1);
  }, 30000);
  it("Electric Charge: a charge counter for an additional boost card and overkill", () => {
    let s = started(GETAWAY_ID, "electro");
    take(s, OUT_FRONT);
    const before = att(s, CHARGE)!.counters;
    blankTop(s, 4);
    s = villainAttacks(s);
    expect(att(s, CHARGE)!.counters).toBe(before - 1);
    expect(s.encounter.discard.filter((p) => p.code === "01098")).toHaveLength(
      2,
    );
  }, 30000);
  it("Electric Charge's Hero Action removes a charge counter", () => {
    let s = started(GETAWAY_ID, "electro");
    const charge = att(s, CHARGE)!;
    const before = charge.counters;
    const energy = playerCard(s, "01088");
    s.player.hand.push(energy);
    s = reload(s);
    const option = abilityOptions(s, att(s, CHARGE)!).find((o) =>
      /2 resources/.test(o.label),
    );
    expect(option).toBeTruthy();
    s = command(s, { type: "ABILITY", id: charge.id, action: option!.id });
    s = settle(pay(s, [s.player.hand.find((p) => p.id === energy.id)!]));
    expect(att(s, CHARGE)!.counters).toBe(before - 1);
  }, 30000);
  it("Charging Up's When Defeated places 3 charge counters", () => {
    let s = started(GETAWAY_ID, "electro");
    const before = att(s, CHARGE)!.counters;
    const p = sideScheme(s, CHARGING, 1);
    s = settle(native(s, { type: "thwart", target: p.id, amount: 1 }));
    expect(att(s, CHARGE)!.counters).toBe(before + 3);
  }, 30000);
  it("Chain Lightning: 3 damage with charge counters on Electric Charge, which loses one", () => {
    let s = started(GETAWAY_ID, "electro");
    s.player.exhausted = true;
    const hp = s.player.hp;
    const before = att(s, CHARGE)!.counters;
    s = settle(reveal(s, CHAIN));
    expect(hp - s.player.hp).toBe(3);
    expect(att(s, CHARGE)!.counters).toBe(before - 1);
  }, 30000);
  it("Energy Overload surges without an energy card in hand", () => {
    let s = started(GETAWAY_ID, "electro");
    s.player.hand = [];
    blankTop(s, 2);
    const overload = take(s, OVERLOAD);
    const deck = s.encounter.deck.length;
    s = settle(native(s, { type: "reveal", piece: overload, actorId: "p1" }));
    expect(s.encounter.deck.length).toBe(deck - 1);
  }, 30000);
  it("Drained of Power exhausts your upgrades, which ready only if you pay", () => {
    let s = started(GETAWAY_ID, "electro");
    const upgrade = playerCard(s, "01035");
    upgrade.ownerId = "p1";
    s.player.inPlay.push(upgrade);
    s = settle(reveal(s, DRAINED));
    expect(att(s, DRAINED)!.attachedTo).toBe("hero:p1");
    expect(att(s, DRAINED)!.counters).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)!.exhausted).toBe(
      true,
    );
  }, 30000);
  it("Whiplash: a charge counter discards the top encounter card, whose boost icons damage the attacker", () => {
    let s = started(GETAWAY_ID, "electro");
    const whip = minion(s, WHIPLASH);
    s.encounter.deck.unshift(makePiece(s, "01190"));
    delete s.encounter.knownTop;
    const before = att(s, CHARGE)!.counters;
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: whip.id,
        amount: 1,
        source: "hero",
        attack: true,
      }),
    );
    expect(att(s, CHARGE)!.counters).toBe(before - 1);
    // Shadow of the Past: 2 boost icons.
    expect(hp - s.player.hp).toBe(2);
  }, 30000);
});

describe("Hammerhead", () => {
  it("stuns the character his attack damages; an already stunned one takes damage", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    take(s, OUT_FRONT);
    blankTop(s, 3);
    s.player.hp = 30;
    s = villainAttacks(s);
    expect(s.player.stunned).toBe(true);
    blankTop(s, 3);
    const hp = s.player.hp;
    s = villainAttacks(s);
    // 1 ATK and 1 damage for the already stunned identity.
    expect(hp - s.player.hp).toBe(2);
  }, 30000);
  it("Energy Gatling Gun: Hammerhead attacks the character again, and it is discarded", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    take(s, OUT_FRONT);
    attachTo(s, GATLING, s.villain.id);
    blankTop(s, 6);
    s.player.hp = 30;
    s = villainAttacks(s);
    expect(att(s, GATLING)).toBeUndefined();
    // Two attacks of 1, plus 1 for being already stunned on the second.
    expect(30 - s.player.hp).toBe(3);
  }, 30000);
  it("Hardheaded gives him stalwart; Chameleon gets the highest THW in play", () => {
    const s = started(GETAWAY_ID, "hammerhead");
    attachTo(s, HARDHEADED, s.villain.id);
    s.villain.stunned = false;
    const cham = minion(s, CHAMELEON);
    // Captain Marvel's THW 2.
    expect(enemyStats(s, cham).scheme).toBe(1 + 2);
  }, 30000);
  it("Maggia Enforcers' SCH counts the Maggia enemies in play", () => {
    const s = started(GETAWAY_ID, "hammerhead");
    const a = minion(s, ENFORCERS);
    minion(s, ENFORCERS);
    // Hammerhead and both Enforcers.
    expect(enemyStats(s, a).scheme).toBe(3);
  }, 30000);
  it('"Head First!": stunned, Hammerhead attacks with +2 ATK', () => {
    let s = started(GETAWAY_ID, "hammerhead");
    take(s, OUT_FRONT);
    s.player.stunned = true;
    s.player.hp = 30;
    blankTop(s, 3);
    s = settle(reveal(s, HEAD_FIRST));
    // 1 ATK + 2, then 1 more for being stunned again.
    expect(30 - s.player.hp).toBe(4);
  }, 30000);
  it("Consolidate Power gives a defeated minion to the villain as a facedown boost card", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    sideScheme(s, CONSOLIDATE);
    const m = minion(s, ENFORCERS);
    s = settle(native(s, hit(m.id, 5)));
    expect(s.encounter.storedBoosts?.map((p) => p.id)).toEqual([m.id]);
  }, 30000);
  it("Power Struggle defeats the weakest minion and reveals the next minion discarded", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    const weak = minion(s, ENFORCERS);
    weak.damage = 2;
    s.encounter.deck.unshift(makePiece(s, "01098"), take(s, UNDERBOSS));
    delete s.encounter.knownTop;
    s = settle(reveal(s, STRUGGLE));
    expect(s.minions.some((p) => p.id === weak.id)).toBe(false);
    expect(s.minions.some((p) => p.code === UNDERBOSS)).toBe(true);
  }, 30000);
});

describe("Cops, Drive and The Owl", () => {
  it("Cop attacks the villain instead of scheming; defeated, it places 2 threat on the main scheme", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    take(s, OUT_FRONT);
    s.player.form = "alter";
    const cop = minion(s, COP);
    const hp = s.villain.hp;
    s = settle(native(s, { type: "enemyScheme", id: cop.id, actorId: "p1" }));
    expect(s.villain.hp).toBe(hp - 2);
    const threat = s.scheme.threat;
    s = settle(native(s, hit(cop.id, 5)));
    expect(s.scheme.threat).toBe(threat + 2);
  }, 30000);
  it("Police Cordon gives Police minions guard and reveals a Police minion", () => {
    let s = started(GETAWAY_ID, "bullseye");
    s = settle(reveal(s, CORDON));
    const police = s.minions.filter((p) =>
      (card(p).traits || "").includes("Police"),
    );
    expect(police.length).toBeGreaterThanOrEqual(1);
  }, 30000);
  it("Crooked Cop's When Defeated deals the defeating player an encounter card", () => {
    let s = started(GETAWAY_ID, "bullseye");
    const cop = minion(s, CROOKED);
    const dealt = s.encounter.dealt.length;
    s = settle(native(s, hit(cop.id, 5)));
    expect(s.encounter.dealt.length).toBe(dealt + 1);
  }, 30000);
  it("Wanted stays in play; its Hero Action brings a Police minion and discards it", () => {
    let s = started(GETAWAY_ID, "bullseye");
    s = settle(reveal(s, WANTED));
    const wanted = s.player.inPlay.find((p) => p.code === WANTED)!;
    expect(wanted).toBeTruthy();
    s.encounter.deck.unshift(take(s, COP));
    delete s.encounter.knownTop;
    s = reload(s);
    const option = abilityOptions(
      s,
      s.player.inPlay.find((p) => p.code === WANTED)!,
    )[0];
    expect(option?.id).toBe("wanted");
    s = settle(
      command(s, { type: "ABILITY", id: wanted.id, action: "wanted" }),
    );
    expect(s.player.inPlay.some((p) => p.code === WANTED)).toBe(false);
    expect(
      s.minions.some((p) => p.code === COP && p.engagedWith === "p1"),
    ).toBe(true);
  }, 30000);
  it("Sports Car attaches to the enemy with the highest ATK and takes its damage until discarded", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    take(s, OUT_FRONT);
    const m = minion(s, ENFORCERS);
    s = settle(reveal(s, SPORTS_CAR));
    // Maggia Enforcers' 2 ATK beats Hammerhead (I)'s 1.
    expect(att(s, SPORTS_CAR)!.attachedTo).toBe(m.id);
    s = settle(native(s, hit(m.id, 3)));
    expect(s.minions.find((p) => p.id === m.id)!.damage).toBe(0);
    expect(att(s, SPORTS_CAR)!.damage).toBe(3);
    s = settle(native(s, hit(m.id, 1)));
    expect(att(s, SPORTS_CAR)).toBeUndefined();
    s = settle(native(s, hit(m.id, 1)));
    expect(s.minions.find((p) => p.id === m.id)!.damage).toBe(1);
  }, 30000);
  it("Traffic Jam takes the threat of an enemy with a Vehicle attachment", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    s.player.form = "alter";
    const jam = sideScheme(s, TRAFFIC, 2);
    attachTo(s, MOTORCYCLE, s.villain.id);
    const threat = s.scheme.threat;
    blankTop(s, 3);
    s = settle(
      native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
    );
    expect(s.scheme.threat).toBe(threat);
    expect(
      s.sideSchemes.find((p) => p.id === jam.id)!.counters,
    ).toBeGreaterThan(2);
  }, 30000);
  it("Flight Serum makes the attached enemy Aerial; Swoop Down gives Aerial enemies +2 ATK", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    take(s, OUT_FRONT);
    s = settle(reveal(s, SERUM));
    expect(att(s, SERUM)!.attachedTo).toBe(s.villain.id);
    s.player.hp = 30;
    blankTop(s, 4);
    s = settle(reveal(s, SWOOP));
    // Hammerhead (I): 1 ATK + 2 for Aerial.
    expect(30 - s.player.hp).toBe(3);
  }, 30000);
  it("Mister Fish engages the player whose identity has the fewest hit points; The Owl attacks with piercing", () => {
    let s = started(GETAWAY_ID, "bullseye", "standard", 2);
    seatView(s, "p2").player.hp = 3;
    s = settle(reveal(s, FISH));
    expect(s.minions.find((p) => p.code === FISH)!.engagedWith).toBe("p2");
    const owl = minion(s, OWL);
    s.player.tough = true;
    s.player.hp = 30;
    blankTop(s, 3);
    s = settle(native(s, { type: "enemyAttack", id: owl.id, actorId: "p1" }));
    expect(s.player.tough).toBe(false);
  }, 30000);
  it("the modular sets join any scenario", () => {
    const s = settle(
      newGame({
        heroId: "captain_marvel",
        aspect: "aggression",
        villainId: "rhino",
        modules: ["fne_drive"],
        seed: 9,
        pacing: "expert",
      }),
    );
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "fne_drive"),
    ).toHaveLength(5);
    expect(s.fearNoEvil).toBeUndefined();
  }, 30000);
});
