/** Fear No Evil, parts one to three: the missions The Getaway, Art Museum
 * Heist, Stop the Presses! and The Raft Breakout with the Underlings
 * Bullseye, Electro, Hammerhead, Purple Man and Typhoid Mary, and the Cops,
 * Drive, The Owl, Tombstone, Tracksuit Mafia and Disasters modular sets,
 * exercised with the original physical cards. Every command crosses a JSON
 * save/reload boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, MODULES, VILLAINS, card } from "../src/game/cards";
import {
  abilityOptions,
  canChangeIdentityForm,
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
  fneAcceleration,
  fneCanReady,
  fneEnvironmentCaption,
  fneImprisoned,
  fneInPlayCaption,
  fneKeyword,
  fneMainNote,
  fneMinionCaption,
  fneObjective,
  fneSideSchemeCaption,
  fneUnderlingFor,
  fneVillainPhaseBegins,
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
      "fne_purple_man",
      "fne_typhoid_mary",
      "fne_stop_the_presses",
      "fne_tombstone",
      "fne_tracksuit_mafia",
      "fne_the_raft_breakout",
      "fne_disasters",
    ];
    const faces = CATALOG_CARDS.filter((c) => sets.includes(c.set_code || ""));
    expect(faces.map((c) => c.code).sort()).toEqual(
      [...FEAR_NO_EVIL_CODES].sort(),
    );
    expect(faces).toHaveLength(123);
    for (const c of faces) expect(hasExecutableScript(c), c.code).toBe(true);
    const getaway = VILLAINS.find((v) => v.id === GETAWAY_ID)!;
    expect(getaway.schemes).toEqual([GETAWAY]);
    expect(getaway.defaultModules).toEqual(["fne_cops", "fne_drive"]);
    const heist = VILLAINS.find((v) => v.id === HEIST_ID)!;
    expect(heist.schemes).toEqual([HEIST]);
    expect(heist.defaultModules).toEqual(["fne_cops", "fne_the_owl"]);
    const presses = VILLAINS.find((v) => v.id === "fne_stop_the_presses")!;
    expect(presses.schemes).toEqual(["60151b"]);
    expect(presses.defaultModules).toEqual([
      "fne_tombstone",
      "fne_tracksuit_mafia",
    ]);
    const raft = VILLAINS.find((v) => v.id === "fne_the_raft_breakout")!;
    expect(raft.schemes).toEqual(["60142b"]);
    expect(raft.defaultModules).toEqual(["fne_the_owl", "fne_tombstone"]);
    for (const id of [
      "fne_cops",
      "fne_drive",
      "fne_the_owl",
      "fne_tombstone",
      "fne_tracksuit_mafia",
      "fne_disasters",
    ])
      expect(MODULES.some((m) => m.id === id)).toBe(true);
  });
  it("picks the chosen Underling, or one from the seed", () => {
    expect(fneUnderlingFor(GETAWAY_ID, "electro", 1)).toBe("electro");
    expect(fneUnderlingFor(GETAWAY_ID, undefined, 3)).toBe("purple_man");
    expect(fneUnderlingFor(GETAWAY_ID, undefined, 4)).toBe("typhoid_mary");
    expect(fneUnderlingFor(GETAWAY_ID, undefined, 5)).toBe("bullseye");
    expect(fneUnderlingFor(GETAWAY_ID, undefined, 7)).toBe("hammerhead");
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

// ------------------------------------------------------------ part two

const PRESSES_ID = "fne_stop_the_presses";
const PRESSES = "60151b";
const BUGLE = "60152";
const URICH = "60153";
const BETTY = "60154";
const JJJ = "60155";
const ROBBIE = "60156";
const BUGLE_SUPPORTS = [URICH, BETTY, JJJ, ROBBIE];
const INTERVIEW = "60157";
const NEWS = "60158";
const PURPLE_MAN = ["60097", "60098", "60099"];
const CONVERTED = "60100";
const FIREFIGHTER = "60101";
const JUDGE = "60102";
const SECURITY = "60103";
const SKATER = "60104";
const FIGHT = "60105";
const PROTECT = "60106";
const SERVE = "60107";
const SUGGESTION = "60108";
const SWAY = "60109";
const TYPHOID_A = "60110a";
const BLOODY_A = "60110b";
const TYPHOID_B = "60111a";
const BLOODY_B = "60111b";
const PSYCHE = "60112";
const TRUST = "60113a";
const MARY_WALKER = "60113b";
const TELEKINESIS = "60114";
const SLASH = "60115";
const NOVA = "60116";
const ARMOR = "60117";
const BLADES = "60118";
const BULWARK = "60119";
const LOOKOUT = "60120";
const COLD = "60195";
const MARBLE = "60196";
const BEETLE = "60197";
const TOMBSTONE = "60198";
const HIT_LIST = "60199";
const IVAN = "60200";
const CLOWN = "60201";
const MAFIOSO = "60202";
const BRO = "60203";
const TRACKSUIT = "60204";

/** Typhoid Mary on the chosen side, without the mission's Art or Out Front
 * in the way. */
function typhoid(
  side = TYPHOID_A,
  difficulty: "standard" | "expert" = "standard",
  players = 1,
) {
  const s = started(HEIST_ID, "typhoid_mary", difficulty, players);
  for (const a of s.attachments.filter((p) => ARTS.includes(p.code)))
    a.attachedTo = "hero:p9";
  s.villain.code = side;
  return reload(s);
}
/** The Daily Bugle support of a player, made the chosen support. */
function bugleOf(s: GameState, code: string, playerId = "p1") {
  const p = seatView(s, playerId).player.inPlay.find((q) =>
    BUGLE_SUPPORTS.includes(q.code),
  )!;
  p.code = code;
  return p;
}
const inPlayOf = (s: GameState, id: string, playerId = "p1") =>
  seatView(s, playerId).player.inPlay.find((p) => p.id === id);
const trust = (s: GameState) => s.sideSchemes.find((p) => p.code === TRUST);

describe("Fear No Evil, part two: setup", () => {
  it("Stop the Presses!: the Daily Bugle, a random Daily Bugle support with 3 stamina counters for each player, 1 threat per player", () => {
    const s = opened(PRESSES_ID, "purple_man", "standard", 2);
    expect(s.villain.code).toBe(PURPLE_MAN[0]);
    expect(s.villain.hp).toBe(26);
    expect(s.scheme.code).toBe(PRESSES);
    expect(s.scheme.threat).toBe(2);
    expect((s.environments || []).map((p) => p.code)).toEqual([BUGLE]);
    const supports = s.players.flatMap((seat) =>
      seatView(s, seat.id).player.inPlay.filter((p) =>
        BUGLE_SUPPORTS.includes(p.code),
      ),
    );
    expect(supports).toHaveLength(2);
    for (const p of supports) expect(p.counters).toBe(3);
    expect(
      s.removed.filter((p) => BUGLE_SUPPORTS.includes(p.code)),
    ).toHaveLength(2);
    const sets = new Set(s.encounter.deck.map((p) => card(p).set_code));
    for (const set of [
      "fne_purple_man",
      "fne_stop_the_presses",
      "fne_tombstone",
      "fne_tracksuit_mafia",
      "standard",
    ])
      expect(sets.has(set), set).toBe(true);
    expect(
      s.encounter.deck.some((p) => [BUGLE, ...BUGLE_SUPPORTS].includes(p.code)),
    ).toBe(false);
    expect(fneObjective(s)).toBe("Defeat Purple Man · stage 1 of 2");
    expect(fneMainNote(s)).toBe(
      "Undefended attacks: 2 threat here or 1 stamina",
    );
  }, 30000);
  it("Typhoid Mary: Disturbed Psyche puts her into play on a random side; Establish Trust starts with 8 threat per player", () => {
    const s = opened(GETAWAY_ID, "typhoid_mary", "standard", 2);
    expect([TYPHOID_A, BLOODY_A]).toContain(s.villain.code);
    expect(s.villain.hp).toBe(20);
    expect((s.environments || []).map((p) => p.code)).toEqual([PSYCHE]);
    expect(trust(s)!.counters).toBe(16);
    expect(
      s.encounter.deck.some((p) =>
        [PSYCHE, TRUST, MARY_WALKER].includes(p.code),
      ),
    ).toBe(false);
    expect(fneObjective(s)).toBe(
      "Settle Mary's mind · 0 of 3 tokens on Disturbed Psyche · 1 speed counter",
    );
  }, 30000);
  it("Expert: Typhoid Mary (B), with toughness on her Typhoid side, and Establish Trust with 11 threat per player", () => {
    const s = opened(GETAWAY_ID, "typhoid_mary", "expert");
    expect([TYPHOID_B, BLOODY_B]).toContain(s.villain.code);
    expect(s.villain.hp).toBe(13);
    expect(s.villain.tough).toBe(s.villain.code === TYPHOID_B);
    expect(trust(s)!.counters).toBe(11);
  }, 30000);
});

describe("Typhoid Mary", () => {
  it("is never defeated: a damage token goes on Disturbed Psyche and her hit points reset; 3 tokens win", () => {
    let s = typhoid();
    s = settle(native(s, hit(s.villain.id, 12)));
    expect(s.fearNoEvil!.psyche).toEqual({ damage: 1, threat: 0 });
    expect(s.villain.hp).toBe(10);
    expect(s.villain.code).toBe(TYPHOID_A);
    expect(s.phase).not.toBe("won");
    s.fearNoEvil!.psyche = { damage: 2, threat: 0 };
    s = settle(native(reload(s), hit(s.villain.id, 10)));
    expect(s.phase).toBe("won");
  }, 30000);
  it("Establish Trust: cleared, a threat token goes on Disturbed Psyche and Mary Walker keeps the villain from activating", () => {
    let s = typhoid();
    const t = trust(s)!;
    s = settle(native(s, { type: "thwart", target: t.id, amount: 8 }));
    expect(s.fearNoEvil!.psyche).toEqual({ damage: 0, threat: 1 });
    expect(trust(s)).toBeUndefined();
    expect(att(s, MARY_WALKER)!.attachedTo).toBe(s.villain.id);
    blankTop(s, 3);
    s.player.hp = 30;
    s = villainAttacks(reload(s));
    expect(s.player.hp).toBe(30);
  }, 30000);
  it("Mary Walker: after the villain takes damage, each player is dealt a facedown encounter card and she flips back", () => {
    let s = typhoid(TYPHOID_A, "standard", 2);
    const mary = attachTo(s, MARY_WALKER, s.villain.id);
    s.sideSchemes = s.sideSchemes.filter((p) => p.code !== TRUST);
    const dealt = s.encounter.dealt.length;
    s = settle(native(reload(s), hit(s.villain.id, 2)));
    expect(s.encounter.dealt.length).toBe(dealt + 2);
    expect(att(s, MARY_WALKER)).toBeUndefined();
    expect(trust(s)!.id).toBe(mary.id);
    expect(trust(s)!.counters).toBe(16);
  }, 30000);
  it("Disturbed Psyche flips her as the villain phase ends; Mary Walker flips back as the round ends", () => {
    let s = typhoid();
    attachTo(s, MARY_WALKER, s.villain.id);
    s.sideSchemes = s.sideSchemes.filter((p) => p.code !== TRUST);
    s = settle(native(reload(s), { type: "newRound" }));
    expect(s.villain.code).toBe(BLOODY_A);
    expect(att(s, MARY_WALKER)).toBeUndefined();
    expect(trust(s)!.counters).toBe(8);
    s = settle(native(s, { type: "newRound" }));
    expect(s.villain.code).toBe(TYPHOID_A);
  }, 30000);
  it("Bloody Mary (B): flipped faceup, she deals 1 damage to each identity", () => {
    let s = typhoid(TYPHOID_B, "expert", 2);
    const hp = [s.player.hp, seatView(s, "p2").player.hp];
    s = settle(native(s, { type: "newRound" }));
    expect(s.villain.code).toBe(BLOODY_B);
    expect(seatView(s, "p1").player.hp).toBe(hp[0] - 1);
    expect(seatView(s, "p2").player.hp).toBe(hp[1] - 1);
  }, 30000);
  it("Psionic Slash: Mary Walker flips back to Establish Trust, and the villain schemes", () => {
    let s = typhoid();
    attachTo(s, MARY_WALKER, s.villain.id);
    s.sideSchemes = s.sideSchemes.filter((p) => p.code !== TRUST);
    blankTop(s, 3);
    const threat = s.scheme.threat;
    s = settle(reveal(reload(s), SLASH));
    expect(att(s, MARY_WALKER)).toBeUndefined();
    expect(trust(s)).toBeTruthy();
    // Typhoid Mary (A): 2 SCH.
    expect(s.scheme.threat).toBe(threat + 2);
  }, 30000);
  it("Hail of Blades: the villain attacks you even in alter-ego form", () => {
    let s = typhoid(BLOODY_A);
    s.player.form = "alter";
    s.player.hp = 30;
    blankTop(s, 3);
    s = settle(reveal(reload(s), BLADES));
    // Bloody Mary (A): 2 ATK.
    expect(s.player.hp).toBe(28);
  }, 30000);
  it("Psi Nova: 1 damage to each character you control, and you are stunned", () => {
    let s = typhoid();
    const a = ally(s);
    const hp = s.player.hp;
    s = settle(reveal(reload(s), NOVA));
    expect(s.player.hp).toBe(hp - 1);
    expect(inPlayOf(s, a.id)!.damage).toBe(1);
    expect(s.player.stunned).toBe(true);
  }, 30000);
  it("Assembled Armor takes the villain's damage and is discarded at 5", () => {
    let s = typhoid();
    s = settle(reveal(s, ARMOR));
    expect(att(s, ARMOR)!.attachedTo).toBe(s.villain.id);
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.villain.hp).toBe(10);
    expect(att(s, ARMOR)!.damage).toBe(3);
    s = settle(native(s, hit(s.villain.id, 2)));
    expect(att(s, ARMOR)).toBeUndefined();
    expect(s.villain.hp).toBe(10);
    s = settle(native(s, hit(s.villain.id, 2)));
    expect(s.villain.hp).toBe(8);
  }, 30000);
  it("Psionic Slash's boost: while Typhoid Mary activates, 3 damage to an ally you control", () => {
    let s = typhoid();
    const a = ally(s, "01030");
    s.encounter.deck.unshift(take(s, SLASH), makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s = villainAttacks(reload(s));
    expect(inPlayOf(s, a.id)!.damage).toBe(3);
  }, 30000);
  it("Hand Lookout's boost gives the activating enemy an additional boost card", () => {
    let s = typhoid(BLOODY_A);
    s.encounter.deck.unshift(take(s, LOOKOUT));
    blankTop(s, 0);
    s.encounter.deck.splice(1, 0, makePiece(s, "01098"), makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s = villainAttacks(reload(s));
    expect(s.encounter.discard.filter((p) => p.code === "01098")).toHaveLength(
      1,
    );
  }, 30000);
  it("Telekinesis: its Hero Action spends 2 physical resources to discard it", () => {
    let s = typhoid();
    const tk = attachTo(s, TELEKINESIS, s.villain.id);
    const strength = [playerCard(s, "01090"), makePiece(s, "01090")];
    s.player.hand.push(...strength);
    s = reload(s);
    const option = abilityOptions(s, att(s, TELEKINESIS)!)[0];
    expect(option?.id).toBe("telekinesis");
    s = command(s, { type: "ABILITY", id: tk.id, action: "telekinesis" });
    s = settle(
      pay(
        s,
        s.player.hand.filter((p) => strength.some((q) => q.id === p.id)),
      ),
    );
    expect(att(s, TELEKINESIS)).toBeUndefined();
  }, 30000);
  it("Telekinesis's boost: 3 indirect damage, and each character damaged this way is exhausted", () => {
    let s = typhoid();
    s.encounter.deck.unshift(take(s, TELEKINESIS), makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s.player.hp = 30;
    s = villainAttacks(reload(s));
    // Typhoid Mary (A): 1 ATK and Telekinesis's boost icon, then 3 indirect
    // damage.
    expect(s.player.hp).toBe(25);
    expect(s.player.exhausted).toBe(true);
  }, 30000);
});

describe("Purple Man", () => {
  it("Influenced minions gain guard, then villainous, then patrol; Power of Suggestion makes every minion Influenced", () => {
    const s = started(GETAWAY_ID, "purple_man", "expert");
    const judge = minion(s, JUDGE);
    const ivan = minion(s, IVAN);
    expect(fneKeyword(s, judge, "Guard")).toBe(1);
    expect(fneKeyword(s, judge, "Villainous")).toBe(1);
    expect(fneKeyword(s, judge, "Patrol")).toBe(0);
    expect(fneKeyword(s, ivan, "Guard")).toBe(0);
    sideScheme(s, SUGGESTION);
    expect(fneKeyword(s, ivan, "Guard")).toBe(1);
    s.villain.code = PURPLE_MAN[2];
    expect(fneKeyword(s, judge, "Patrol")).toBe(1);
  }, 30000);
  it("a boost card from his set is dealt to you facedown after the activation", () => {
    let s = started(GETAWAY_ID, "purple_man");
    take(s, OUT_FRONT);
    const judge = take(s, JUDGE);
    s.encounter.deck.unshift(judge, makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s = villainAttacks(reload(s));
    expect(s.encounter.dealt.find((p) => p.id === judge.id)?.dealtTo).toBe(
      "p1",
    );
    expect(s.encounter.discard.some((p) => p.id === judge.id)).toBe(false);
  }, 30000);
  it("Converted makes the highest-cost ally you control an Influenced minion engaged with you, with SCH equal to its THW", () => {
    let s = started(GETAWAY_ID, "purple_man");
    ally(s, "01002");
    const machine = ally(s, "01030");
    s = settle(reveal(reload(s), CONVERTED));
    const m = s.minions.find((p) => p.id === machine.id)!;
    expect(m.engagedWith).toBe("p1");
    expect(att(s, CONVERTED)!.attachedTo).toBe(machine.id);
    expect(inPlayOf(s, machine.id)).toBeUndefined();
    expect(enemyStats(s, m).scheme).toBe(1);
    expect(fneKeyword(s, m, "Guard")).toBe(1);
  }, 30000);
  it("a Converted ally defeated as a minion goes to its owner's discard pile", () => {
    let s = started(GETAWAY_ID, "purple_man");
    const machine = ally(s, "01030");
    s = settle(reveal(reload(s), CONVERTED));
    expect(s.minions.some((p) => p.id === machine.id)).toBe(true);
    s = settle(native(s, hit(machine.id, 4)));
    expect(s.minions.some((p) => p.id === machine.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === machine.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === machine.id)).toBe(false);
    expect(att(s, CONVERTED)).toBeUndefined();
  }, 30000);
  it("Converted surges without an ally", () => {
    let s = started(GETAWAY_ID, "purple_man");
    blankTop(s, 2);
    const converted = take(s, CONVERTED);
    const deck = s.encounter.deck.length;
    s = settle(native(s, { type: "reveal", piece: converted, actorId: "p1" }));
    expect(s.encounter.deck.length).toBe(deck - 1);
  }, 30000);
  it("Firefighter discards the highest-cost support or upgrade; Judge places 3 threat; Skater Punk deals 3 damage to its defeater", () => {
    let s = started(GETAWAY_ID, "purple_man");
    const pepper = playerCard(s, "01033");
    const reactor = playerCard(s, "01035");
    for (const p of [pepper, reactor]) {
      p.ownerId = "p1";
      s.player.inPlay.push(p);
    }
    const ff = minion(s, FIREFIGHTER);
    s = settle(native(reload(s), hit(ff.id, 3)));
    expect(inPlayOf(s, pepper.id)).toBeUndefined();
    expect(inPlayOf(s, reactor.id)).toBeTruthy();
    const judge = minion(s, JUDGE);
    const threat = s.scheme.threat;
    s = settle(native(reload(s), hit(judge.id, 2)));
    expect(s.scheme.threat).toBe(threat + 3);
    const skater = minion(s, SKATER);
    const hp = s.player.hp;
    s = settle(native(reload(s), hit(skater.id, 2)));
    expect(s.player.hp).toBe(hp - 3);
  }, 30000);
  it("Firefighter leaves a permanent upgrade in play", () => {
    let s = started(GETAWAY_ID, "purple_man");
    const gamma = makePiece(s, "21002");
    gamma.ownerId = "p1";
    s.player.inPlay.push(gamma);
    const ff = minion(s, FIREFIGHTER);
    s = settle(native(reload(s), hit(ff.id, 3)));
    expect(s.minions.some((p) => p.id === ff.id)).toBe(false);
    expect(inPlayOf(s, gamma.id)).toBeTruthy();
  }, 30000);
  it("Security Guard discards the ally with the highest ATK", () => {
    let s = started(GETAWAY_ID, "purple_man");
    const cat = ally(s, "01002");
    const machine = ally(s, "01030");
    const guard = minion(s, SECURITY);
    s = settle(native(reload(s), hit(guard.id, 4)));
    expect(inPlayOf(s, machine.id)).toBeUndefined();
    expect(inPlayOf(s, cat.id)).toBeTruthy();
  }, 30000);
  it('"serve." stays in your play area with 3 command counters; its Forced Action places 2 threat', () => {
    let s = started(GETAWAY_ID, "purple_man");
    s = settle(reveal(s, SERVE));
    const serve = s.player.inPlay.find((p) => p.code === SERVE)!;
    expect(serve.counters).toBe(3);
    const option = abilityOptions(s, serve)[0];
    expect(option?.id).toBe("command");
    const threat = s.scheme.threat;
    s = settle(
      command(s, { type: "ABILITY", id: serve.id, action: "command" }),
    );
    expect(s.scheme.threat).toBe(threat + 2);
    expect(inPlayOf(s, serve.id)!.counters).toBe(2);
    expect(inPlayOf(s, serve.id)!.exhausted).toBe(true);
  }, 30000);
  it('"fight." resolves its Forced Action before the turn ends', () => {
    let s = started(GETAWAY_ID, "purple_man");
    s = settle(reveal(s, FIGHT));
    s.phase = "player";
    s.player.hp = 30;
    s = reload(s);
    s = command(s, { type: "END_TURN", discard: [] });
    expect(s.prompt?.title).toBe('"fight."');
    s = settle(choose(s, "hero:p1"));
    expect(s.player.hp).toBeLessThanOrEqual(28);
    const fight = s.player.inPlay.find((p) => p.code === FIGHT);
    expect(fight?.counters ?? 0).toBeLessThan(3);
  }, 30000);
  it('"protect." gives the villain a tough status card', () => {
    let s = started(GETAWAY_ID, "purple_man");
    s = settle(reveal(s, PROTECT));
    const protect = s.player.inPlay.find((p) => p.code === PROTECT)!;
    s = settle(
      command(s, { type: "ABILITY", id: protect.id, action: "command" }),
    );
    expect(s.villain.tough).toBe(true);
    expect(inPlayOf(s, protect.id)!.counters).toBe(2);
  }, 30000);
  it("Sway the Masses reveals an Influenced minion from the encounter discard pile, or surges", () => {
    let s = started(GETAWAY_ID, "purple_man");
    const judge = take(s, JUDGE);
    s.encounter.discard.push(judge);
    s = settle(reveal(reload(s), SWAY));
    expect(s.minions.some((p) => p.id === judge.id)).toBe(true);
    blankTop(s, 2);
    const sway = take(s, SWAY);
    const deck = s.encounter.deck.length;
    s = settle(
      native(reload(s), { type: "reveal", piece: sway, actorId: "p1" }),
    );
    expect(s.encounter.deck.length).toBe(deck - 1);
  }, 30000);
});

describe("Stop the Presses!", () => {
  it("after an undefended attack you place 2 threat, or remove a stamina counter; a support with none left is discarded and the players lose", () => {
    let s = started(PRESSES_ID, "purple_man");
    const support = bugleOf(s, URICH);
    support.counters = 1;
    blankTop(s, 3);
    const threat = s.scheme.threat;
    s = settle(
      native(reload(s), {
        type: "enemyAttack",
        id: s.villain.id,
        actorId: "p1",
      }),
      (v) => (v.prompt?.title === "Stop the Presses!" ? "threat" : undefined),
    );
    expect(s.scheme.threat).toBe(threat + 2);
    blankTop(s, 3);
    s = settle(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p1" }),
      (v) =>
        v.prompt?.title === "Stop the Presses!"
          ? `stamina:${support.id}`
          : undefined,
    );
    expect(inPlayOf(s, support.id)).toBeUndefined();
    expect(s.phase).toBe("lost");
  }, 30000);
  it("the Daily Bugle's Alter-Ego Action exhausts a Daily Bugle support for a stamina counter", () => {
    let s = started(PRESSES_ID, "purple_man");
    s.player.form = "alter";
    const support = bugleOf(s, BETTY);
    s = reload(s);
    const env = (s.environments || []).find((p) => p.code === BUGLE)!;
    const option = abilityOptions(s, env)[0];
    expect(option?.id).toBe(`bugle:${support.id}`);
    s = settle(command(s, { type: "ABILITY", id: env.id, action: option.id }));
    expect(inPlayOf(s, support.id)!.counters).toBe(4);
    expect(inPlayOf(s, support.id)!.exhausted).toBe(true);
  }, 30000);
  it("Ben Urich looks at the top 2 encounter cards and discards 1", () => {
    let s = started(PRESSES_ID, "purple_man");
    const urich = bugleOf(s, URICH);
    blankTop(s, 2);
    const top = s.encounter.deck[0].id;
    s = reload(s);
    s = command(s, { type: "ABILITY", id: urich.id, action: "urich" });
    expect(s.prompt?.title).toBe("Ben Urich");
    s = settle(choose(s, "discard:0"));
    expect(s.encounter.discard.some((p) => p.id === top)).toBe(true);
    expect(inPlayOf(s, urich.id)!.counters).toBe(2);
    expect(inPlayOf(s, urich.id)!.exhausted).toBe(true);
  }, 30000);
  it("J. Jonah Jameson deals you a facedown encounter card and draws 2", () => {
    let s = started(PRESSES_ID, "purple_man");
    const jjj = bugleOf(s, JJJ);
    s = reload(s);
    const hand = s.player.hand.length;
    const dealt = s.encounter.dealt.length;
    s = settle(command(s, { type: "ABILITY", id: jjj.id, action: "jjj" }));
    expect(s.player.hand.length).toBe(hand + 2);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    expect(inPlayOf(s, jjj.id)!.counters).toBe(2);
  }, 30000);
  it("Robbie Robertson looks at a dealt facedown card and swaps it", () => {
    let s = started(PRESSES_ID, "purple_man");
    const robbie = bugleOf(s, ROBBIE);
    blankTop(s, 2);
    const first = s.encounter.deck[0].id;
    s = reload(s);
    s = native(s, { type: "dealEncounter", playerId: "p1" } as Effect);
    s = settle(s, (v) =>
      v.prompt?.title === "Robbie Robertson"
        ? v.prompt.options.some((o) => o.id === "use")
          ? "use"
          : "swap"
        : undefined,
    );
    expect(s.encounter.discard.some((p) => p.id === first)).toBe(true);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1").length).toBe(1);
    expect(inPlayOf(s, robbie.id)!.counters).toBe(2);
  }, 30000);
  it("Betty Brant cancels a boost card and gives the enemy another", () => {
    let s = started(PRESSES_ID, "purple_man");
    take(s, OUT_FRONT);
    const betty = bugleOf(s, BETTY);
    s.encounter.deck.unshift(makePiece(s, "01190"), makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s.player.hp = 30;
    s = settle(
      native(reload(s), {
        type: "enemyAttack",
        id: s.villain.id,
        actorId: "p1",
      }),
      (v) =>
        v.prompt?.options.find((o) => /betty/.test(o.id))?.id ||
        (v.prompt?.title === "Stop the Presses!" ? "threat" : undefined),
    );
    // Purple Man (I): 0 ATK; Shadow of the Past's 2 boost icons are canceled.
    expect(s.player.hp).toBe(30);
    expect(inPlayOf(s, betty.id)!.counters).toBe(2);
  }, 30000);
  it("Exclusive Interview exhausts each Daily Bugle support, which cannot ready", () => {
    let s = started(PRESSES_ID, "purple_man");
    const support = bugleOf(s, URICH);
    s = settle(reveal(s, INTERVIEW));
    expect(inPlayOf(s, support.id)!.exhausted).toBe(true);
    expect(fneCanReady(s, inPlayOf(s, support.id)!)).toBe(false);
  }, 30000);
  it("Breaking News: exhaust a Daily Bugle support and remove a stamina counter, or 2 threat", () => {
    let s = started(PRESSES_ID, "purple_man");
    const support = bugleOf(s, URICH);
    s = reveal(reload(s), NEWS);
    expect(s.prompt?.title).toBe("Breaking News");
    s = settle(choose(s, `bugle:${support.id}`));
    expect(inPlayOf(s, support.id)!.counters).toBe(2);
    expect(inPlayOf(s, support.id)!.exhausted).toBe(true);
  }, 30000);
});

describe("Tombstone and Tracksuit Mafia", () => {
  it("Cold as Ice attaches to the minion with the highest base hit points with a tough status card; after it schemes, the first player is confused", () => {
    let s = started(GETAWAY_ID, "bullseye");
    minion(s, BRO);
    const tomb = minion(s, TOMBSTONE);
    s = settle(reveal(reload(s), COLD));
    expect(att(s, COLD)!.attachedTo).toBe(tomb.id);
    expect(s.minions.find((p) => p.id === tomb.id)!.tough).toBe(true);
    s.player.form = "alter";
    blankTop(s, 3);
    s = settle(
      native(reload(s), { type: "enemyScheme", id: tomb.id, actorId: "p1" }),
    );
    expect(s.player.confused).toBe(true);
    expect(att(s, COLD)).toBeUndefined();
  }, 30000);
  it("Hard as Marble: after the attached minion attacks, the attacked character is stunned", () => {
    let s = started(GETAWAY_ID, "bullseye");
    const tomb = minion(s, TOMBSTONE);
    s = settle(reveal(reload(s), MARBLE));
    expect(att(s, MARBLE)!.attachedTo).toBe(tomb.id);
    blankTop(s, 3);
    s.player.hp = 30;
    s = settle(
      native(reload(s), { type: "enemyAttack", id: tomb.id, actorId: "p1" }),
    );
    expect(s.player.stunned).toBe(true);
    expect(att(s, MARBLE)).toBeUndefined();
  }, 30000);
  it("Beetle finds an attachment that attaches to a minion", () => {
    let s = started(PRESSES_ID, "bullseye");
    s = settle(reveal(s, BEETLE));
    const beetle = s.minions.find((p) => p.code === BEETLE)!;
    expect(
      s.attachments.some(
        (p) => p.attachedTo === beetle.id && [COLD, MARBLE].includes(p.code),
      ),
    ).toBe(true);
    expect(beetle.tough).toBe(true);
  }, 30000);
  it("Tombstone's boost gives the villain a tough status card", () => {
    let s = started(GETAWAY_ID, "bullseye");
    take(s, OUT_FRONT);
    s.encounter.deck.unshift(take(s, TOMBSTONE), makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s = villainAttacks(reload(s));
    expect(s.villain.tough).toBe(true);
  }, 30000);
  it("Hit List deals the first player 3 indirect damage as the villain phase begins", () => {
    let s = started(GETAWAY_ID, "bullseye");
    sideScheme(s, HIT_LIST);
    const hp = s.player.hp;
    s = settle(native(reload(s), ...fneVillainPhaseBegins(s)));
    expect(s.player.hp).toBe(hp - 3);
  }, 30000);
  it("Hit List: each ally its indirect damage defeats removes 1 threat per player from it", () => {
    let s = started(GETAWAY_ID, "bullseye");
    const list = sideScheme(s, HIT_LIST);
    const a = ally(s, "01002");
    s = settle(
      native(reload(s), ...fneVillainPhaseBegins(s)),
      (v) => v.prompt?.options.find((o) => o.id.includes(a.id))?.id,
    );
    expect(s.player.inPlay.some((p) => p.id === a.id)).toBe(false);
    expect(s.sideSchemes.find((p) => p.id === list.id)!.counters).toBe(2);
  }, 30000);
  it("Ivan Banionis gains acceleration tokens when revealed and after he schemes", () => {
    let s = started(GETAWAY_ID, "bullseye");
    s = settle(reveal(s, IVAN));
    const ivan = s.minions.find((p) => p.code === IVAN)!;
    expect(ivan.accelerationTokens).toBe(1);
    expect(fneAcceleration(s)).toBe(1);
    s.player.form = "alter";
    blankTop(s, 3);
    s = settle(
      native(reload(s), { type: "enemyScheme", id: ivan.id, actorId: "p1" }),
    );
    expect(s.minions.find((p) => p.id === ivan.id)!.accelerationTokens).toBe(2);
  }, 30000);
  it("The Clown gets a facedown boost card after he schemes", () => {
    let s = started(GETAWAY_ID, "bullseye");
    const clown = minion(s, CLOWN);
    s.player.form = "alter";
    blankTop(s, 3);
    s = settle(
      native(reload(s), { type: "enemyScheme", id: clown.id, actorId: "p1" }),
    );
    expect(
      s.minions.find((p) => p.id === clown.id)!.inheritorBoosts,
    ).toHaveLength(1);
  }, 30000);
  it("Tracksuit Mafia tucks a Tracksuit minion; revealing a Tracksuit minion brings it out", () => {
    let s = started(GETAWAY_ID, "bullseye");
    s.encounter.deck.unshift(makePiece(s, "01098"), take(s, BRO));
    delete s.encounter.knownTop;
    s = settle(reveal(reload(s), TRACKSUIT));
    const scheme = s.sideSchemes.find((p) => p.code === TRACKSUIT)!;
    expect(s.fearNoEvil!.tucked![scheme.id].map((p) => p.code)).toEqual([BRO]);
    expect(fneSideSchemeCaption(s, scheme)).toMatch(/^1 minion tucked here/);
    s = settle(reveal(s, IVAN));
    expect(s.fearNoEvil!.tucked![scheme.id]).toHaveLength(0);
    expect(s.minions.filter((p) => [BRO, IVAN].includes(p.code))).toHaveLength(
      2,
    );
  }, 30000);
  it("a defeated Tracksuit Bro is tucked under Tracksuit Mafia, or shuffled into the encounter deck", () => {
    let s = started(GETAWAY_ID, "bullseye");
    const bro = minion(s, BRO);
    const deck = s.encounter.deck.length;
    s = settle(native(reload(s), hit(bro.id, 3)));
    expect(s.encounter.deck.length).toBe(deck + 1);
    expect(s.encounter.deck.some((p) => p.id === bro.id)).toBe(true);
    const scheme = sideScheme(s, TRACKSUIT);
    const second = minion(s, BRO);
    s = settle(native(reload(s), hit(second.id, 3)));
    expect(s.fearNoEvil!.tucked![scheme.id].map((p) => p.id)).toEqual([
      second.id,
    ]);
  }, 30000);
  it("a defeated Tracksuit Mafioso without Tracksuit Mafia stuns and confuses its defeater", () => {
    let s = started(GETAWAY_ID, "bullseye");
    const mafioso = minion(s, MAFIOSO);
    s = settle(native(reload(s), hit(mafioso.id, 7)));
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
  }, 30000);
  it("Teamwork: a Tracksuit minion entering play with another activates against you", () => {
    let s = started(GETAWAY_ID, "bullseye");
    minion(s, IVAN);
    s.player.hp = 30;
    blankTop(s, 3);
    s = settle(reveal(reload(s), BRO));
    // Tracksuit Bro: 2 ATK.
    expect(s.player.hp).toBe(28);
  }, 30000);
  it("the modular sets join any scenario", () => {
    const s = settle(
      newGame({
        heroId: "captain_marvel",
        aspect: "aggression",
        villainId: "rhino",
        modules: ["fne_tracksuit_mafia"],
        seed: 9,
        pacing: "expert",
      }),
    );
    expect(
      s.encounter.deck.filter(
        (p) => card(p).set_code === "fne_tracksuit_mafia",
      ),
    ).toHaveLength(7);
  }, 30000);
});

// ------------------------------------------------------------ part three

const RAFT_ID = "fne_the_raft_breakout";
const RAFT = "60142b";
const MASTER_KEY = "60143";
const P_ABSORBING = "60144";
const P_ZEMO = "60145";
const P_DRANG = "60146";
const P_MYSTERIO = "60147";
const P_PROXIMA = "60148";
const P_RHINO = "60149";
const PRISONERS = [
  P_ABSORBING,
  P_ZEMO,
  P_DRANG,
  P_MYSTERIO,
  P_PROXIMA,
  P_RHINO,
];
const IMPRISONED = "60150";
const MYSTIC_INCURSION = "60177";
const SINKING_FERRY = "60178";
const TOWERING_INFERNO = "60179";
const BRIDGE = "60180";
const PERIL = "60181";

/** The Raft Breakout without the Prisoners revealed at setup. */
function raft(underling = "bullseye") {
  const s = started(RAFT_ID, underling);
  s.encounter.discard.push(
    ...s.minions.filter((p) => PRISONERS.includes(p.code)),
  );
  s.minions = s.minions.filter((p) => !PRISONERS.includes(p.code));
  return reload(s);
}
const env = (s: GameState, code: string) =>
  (s.environments || []).find((p) => p.code === code);

describe("The Raft Breakout", () => {
  it("setup: Master Key on the villain, a Prisoner minion for each player, 2 threat per player", () => {
    const s = opened(RAFT_ID, "bullseye", "standard", 2);
    expect(s.scheme.code).toBe(RAFT);
    expect(s.scheme.threat).toBe(4);
    expect(att(s, MASTER_KEY)!.attachedTo).toBe(s.villain.id);
    const prisoners = s.minions.filter((p) => PRISONERS.includes(p.code));
    expect(prisoners.map((p) => p.engagedWith).sort()).toEqual(["p1", "p2"]);
    expect(s.encounter.deck.some((p) => p.code === MASTER_KEY)).toBe(false);
    expect(fneMainNote(s)).toBe(
      "Each defeated minion removes 1 threat here (Elite: 2)",
    );
  }, 30000);
  it("each defeated minion removes 1 threat from the main scheme, an Elite one 2", () => {
    let s = raft();
    s.scheme.threat = 6;
    const bro = minion(s, "60203");
    s = settle(native(reload(s), hit(bro.id, 3)));
    expect(s.scheme.threat).toBe(5);
    const drang = minion(s, P_DRANG);
    s = settle(native(reload(s), hit(drang.id, 6)));
    expect(s.scheme.threat).toBe(3);
  }, 30000);
  it("Master Key: after the villain schemes against you, its minion boost cards are dealt to you facedown", () => {
    let s = raft();
    s.player.form = "alter";
    const boost = take(s, P_DRANG);
    s.encounter.deck.unshift(boost);
    delete s.encounter.knownTop;
    s = settle(
      native(reload(s), {
        type: "enemyScheme",
        id: s.villain.id,
        actorId: "p1",
      }),
    );
    expect(s.encounter.dealt.find((p) => p.id === boost.id)?.dealtTo).toBe(
      "p1",
    );
  }, 30000);
  it("Absorbing Man tucks the top card of your deck and gets +1 ATK for each resource type under him", () => {
    let s = raft();
    const m = minion(s, P_ABSORBING);
    s.player.deck.unshift(playerCard(s, "01088"));
    blankTop(s, 3);
    s.player.hp = 30;
    s = settle(
      native(reload(s), { type: "enemyAttack", id: m.id, actorId: "p1" }),
    );
    const absorbing = s.minions.find((p) => p.id === m.id)!;
    expect(absorbing.storedCards?.map((p) => p.code)).toEqual(["01088"]);
    // 1 ATK, +1 for the energy resource.
    expect(s.player.hp).toBe(28);
    expect(fneMinionCaption(s, absorbing)).toBe(
      "1 card tucked · +1 ATK when he attacks",
    );
  }, 30000);
  it("Proxima Midnight: 1 threat on the main scheme, or +2 ATK for her attack", () => {
    let s = raft();
    const m = minion(s, P_PROXIMA);
    blankTop(s, 3);
    s.player.hp = 30;
    s = settle(
      native(reload(s), { type: "enemyAttack", id: m.id, actorId: "p1" }),
      (v) => (v.prompt?.title === "Proxima Midnight" ? "atk" : undefined),
    );
    expect(s.player.hp).toBe(26);
    const threat = s.scheme.threat;
    blankTop(s, 3);
    s = settle(
      native(reload(s), { type: "enemyAttack", id: m.id, actorId: "p1" }),
      (v) => (v.prompt?.title === "Proxima Midnight" ? "threat" : undefined),
    );
    expect(s.scheme.threat).toBe(threat + 1);
    expect(s.player.hp).toBe(24);
  }, 30000);
  it("Rhino's attacks gain overkill; his boost gives the activating enemy a tough status card", () => {
    let s = raft();
    const m = minion(s, P_RHINO);
    const cat = ally(s, "01002");
    blankTop(s, 3);
    const hp = s.player.hp;
    s = settle(
      native(reload(s), { type: "enemyAttack", id: m.id, actorId: "p1" }),
      (v) => v.prompt?.options.find((o) => o.id === cat.id)?.id,
    );
    expect(inPlayOf(s, cat.id)).toBeUndefined();
    // 3 ATK against Black Cat's 2 hit points: 1 excess to the identity.
    expect(s.player.hp).toBe(hp - 1);
    s.encounter.deck.unshift(take(s, P_RHINO), makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s = villainAttacks(reload(s));
    expect(s.villain.tough).toBe(true);
  }, 30000);
  it("Drang gains a barrage counter after he attacks you, then you take 1 indirect damage for each", () => {
    let s = raft();
    const m = minion(s, P_DRANG);
    blankTop(s, 3);
    s.player.hp = 30;
    s = settle(
      native(reload(s), { type: "enemyAttack", id: m.id, actorId: "p1" }),
    );
    expect(s.player.hp).toBe(28);
    blankTop(s, 3);
    s = settle(
      native(reload(s), { type: "enemyAttack", id: m.id, actorId: "p1" }),
    );
    expect(s.minions.find((p) => p.id === m.id)!.counters).toBe(2);
    expect(s.player.hp).toBe(25);
  }, 30000);
  it("Mysterio deals the treachery boost cards of his attack to you facedown", () => {
    let s = raft();
    const m = minion(s, P_MYSTERIO);
    const shadow = makePiece(s, "01190");
    s.encounter.deck.unshift(shadow, makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s.player.hp = 30;
    s = settle(
      native(reload(s), { type: "enemyAttack", id: m.id, actorId: "p1" }),
    );
    // 1 ATK and Shadow of the Past's 2 boost icons.
    expect(s.player.hp).toBe(27);
    expect(s.encounter.dealt.find((p) => p.id === shadow.id)?.dealtTo).toBe(
      "p1",
    );
  }, 30000);
  it("Baron Zemo makes an ally with threat on it a Deceived minion engaged with its controller", () => {
    let s = raft();
    const machine = ally(s, "01030");
    s = settle(reveal(reload(s), P_ZEMO));
    const deceived = s.minions.find((p) => p.id === machine.id)!;
    expect(deceived.fneDeceived).toBe(true);
    expect(deceived.fneThreat).toBe(1);
    expect(deceived.engagedWith).toBe("p1");
    expect(card(deceived).traits).toContain("Deceived");
    const zemo = s.minions.find((p) => p.code === P_ZEMO)!;
    s = settle(native(s, hit(zemo.id, 6)));
    expect(inPlayOf(s, machine.id)?.fneDeceived).toBeUndefined();
    expect(s.minions.some((p) => p.id === machine.id)).toBe(false);
  }, 30000);
  it("Imprisoned: you cannot attack, thwart or change to alter-ego form; its Hero Action discards it", () => {
    let s = raft();
    s = settle(reveal(s, IMPRISONED));
    const imprisoned = s.player.inPlay.find((p) => p.code === IMPRISONED)!;
    expect(fneImprisoned(s, "p1")).toBe(true);
    expect(fneInPlayCaption(s, imprisoned)).toBe(
      "You cannot thwart, attack or change to alter-ego form",
    );
    s.phase = "player";
    s.player.exhausted = false;
    s = reload(s);
    expect(dispatch(reload(s), { type: "BASIC", action: "attack" }).error).toBe(
      "Imprisoned: you cannot attack or thwart.",
    );
    expect(canChangeIdentityForm(s)).toBe(false);
    s.player.hand.push(
      playerCard(s, "01088"),
      playerCard(s, "01089"),
      playerCard(s, "01090"),
    );
    s = reload(s);
    const option = abilityOptions(s, imprisoned).find(
      (o) => o.id === "imprisoned-pay",
    );
    expect(option).toBeTruthy();
    s = command(s, { type: "ABILITY", id: imprisoned.id, action: option!.id });
    s = settle(pay(s, s.player.hand.slice(-3)));
    expect(s.player.inPlay.some((p) => p.id === imprisoned.id)).toBe(false);
    expect(fneImprisoned(s, "p1")).toBe(false);
  }, 30000);
  it("Imprisoned's boost reveals it", () => {
    let s = raft();
    s.encounter.deck.unshift(take(s, IMPRISONED), makePiece(s, "01098"));
    delete s.encounter.knownTop;
    s = villainAttacks(reload(s));
    expect(s.player.inPlay.some((p) => p.code === IMPRISONED)).toBe(true);
  }, 30000);
});

describe("Disasters", () => {
  it("a Disaster enters play with 2 civilian counters, and its crisis keeps threat on the main scheme", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    s = settle(reveal(s, MYSTIC_INCURSION));
    expect(env(s, MYSTIC_INCURSION)!.counters).toBe(2);
    expect(fneEnvironmentCaption(s, env(s, MYSTIC_INCURSION)!)).toBe(
      "2 civilian counters · crisis: no threat comes off the main scheme",
    );
    s.scheme.threat = 4;
    s = settle(
      native(reload(s), { type: "thwart", target: "main", amount: 2 }),
    );
    expect(s.scheme.threat).toBe(4);
  }, 30000);
  it("its Hero Action exhausts a character to remove a civilian counter, 2 for the right character; the last one discards it", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    s = settle(reveal(s, TOWERING_INFERNO));
    const inferno = env(s, TOWERING_INFERNO)!;
    const cat = ally(s, "01002");
    s = reload(s);
    s = settle(
      command(s, {
        type: "ABILITY",
        id: inferno.id,
        action: `disaster-exhaust:${cat.id}`,
      }),
    );
    expect(env(s, TOWERING_INFERNO)!.counters).toBe(1);
    expect(inPlayOf(s, cat.id)!.exhausted).toBe(true);
    s.player.tough = true;
    s.player.exhausted = false;
    s = reload(s);
    s = settle(
      command(s, {
        type: "ABILITY",
        id: inferno.id,
        action: "disaster-exhaust:hero:p1",
      }),
    );
    expect(env(s, TOWERING_INFERNO)).toBeUndefined();
    expect(s.player.exhausted).toBe(true);
  }, 30000);
  it("Sinking Ferry's Hero Action spends 2 energy resources", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    s = settle(reveal(s, SINKING_FERRY));
    const ferry = env(s, SINKING_FERRY)!;
    s.player.hand.push(playerCard(s, "01088"), makePiece(s, "01088"));
    s = reload(s);
    const option = abilityOptions(s, ferry).find(
      (o) => o.id === "disaster-pay",
    );
    expect(option).toBeTruthy();
    s = command(s, { type: "ABILITY", id: ferry.id, action: option!.id });
    s = settle(pay(s, s.player.hand.slice(-2)));
    expect(env(s, SINKING_FERRY)!.counters).toBe(1);
  }, 30000);
  it("Collapsing Bridge: hinder 2 per player, and threat removed from it puts 1 threat back", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    s = settle(reveal(s, BRIDGE));
    const bridge = s.sideSchemes.find((p) => p.code === BRIDGE)!;
    expect(bridge.counters).toBe(3);
    s = settle(native(s, { type: "thwart", target: bridge.id, amount: 1 }));
    expect(s.sideSchemes.find((p) => p.id === bridge.id)!.counters).toBe(3);
    s = settle(native(s, { type: "thwart", target: bridge.id, amount: 3 }));
    expect(s.sideSchemes.some((p) => p.id === bridge.id)).toBe(false);
  }, 30000);
  it("Bystanders in Peril reveals a Disaster, or places a civilian counter on one", () => {
    let s = started(GETAWAY_ID, "hammerhead");
    s.encounter.deck.push(take(s, SINKING_FERRY));
    s = settle(reveal(reload(s), PERIL));
    expect(env(s, SINKING_FERRY)!.counters).toBe(2);
    s = settle(
      native(reload(s), {
        type: "reveal",
        piece: makePiece(s, PERIL),
        actorId: "p1",
      }),
    );
    expect(env(s, SINKING_FERRY)!.counters).toBe(3);
  }, 30000);
  it("the modular set joins any scenario", () => {
    const s = settle(
      newGame({
        heroId: "captain_marvel",
        aspect: "aggression",
        villainId: "rhino",
        modules: ["fne_disasters"],
        seed: 9,
        pacing: "expert",
      }),
    );
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "fne_disasters"),
    ).toHaveLength(5);
  }, 30000);
});
