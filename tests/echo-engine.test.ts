/** Echo (Fear No Evil): Watch and Learn's tucked events, Photographic
 * Reflexes, her signature cards, Raised by the Kingpin, Kingpin's nemesis
 * set and the starter deck's protection and basic cards, exercised with the
 * original physical cards. Every command crosses a JSON save/reload
 * boundary. */
import { describe, expect, it } from "vitest";
import { HEROES, card, heroStats } from "../src/game/cards";
import {
  cardCost,
  dispatch,
  makePiece,
  newGame,
  playable,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { rulesCode } from "../src/game/rules-code";
import { paymentSources } from "../src/game/payment";
import {
  ECHO_SCRIPT_CODES,
  echoEventFinished,
  echoStoredPlayable,
} from "../src/game/echo";
import { FNE_PLAYER_PACK_SCRIPT_CODES } from "../src/game/fne-player-pack";
import { catalogDeckCodes, CATALOG_HEROES } from "../src/game/catalog";
import { deckErrors, deckSizeFor } from "../src/game/decks";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  choose,
  command,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

const INNATE = "60038";
const DD_ALLY = "60039";
const REFLEXES = ["60040a", "60040b", "60040c"];
const TAPE = "60041";
const REZ = "60042";
const ASL = "60043";
const CHOREO = "60044";
const KATANA = "60045";
const IMPROV = "60046";
const MUSCLE = "60047";
const ARMY = "60048";
const ATTENTION = "60049";
const HARM = "60050";
const PUNCH = "60051";
const OFFENSE = "60052";
const RONIN = "60053";
const STAND = "60054";
const SEE_NO_EVIL = "60055";
const TRAINING = "60056";
const ENERGY = "60057";
const GENIUS = "60058";
const STRENGTH = "60059";
const RAISED = "60060";
const KINGPIN = "60061";
const MANIPULATOR = "60062";
const HENCHMAN = "60063";
const PAWN = "60064";
const KNOW = "60023";
const SHOCKER = "01103";
const USURP = "01156";

function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 200; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "done"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  return s;
}
function setup(villainId = "rhino", seed = 60037) {
  return newGame({
    heroId: "echo",
    aspect: "protection",
    villainId,
    difficulty: "standard",
    seed,
    pacing: "expert",
    heroes: [{ heroId: "echo", aspect: "protection" }],
  });
}
/** Echo in hero form with an empty hand, mid player phase. */
function started(villainId = "rhino") {
  let s = settle(setup(villainId));
  s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.form = "hero";
  s.player.deck.push(...s.player.hand.splice(0));
  s.villain.tough = s.villain.stunned = s.villain.confused = false;
  s.villain.toughCards = s.villain.stunCards = s.villain.confuseCards = 0;
  s.scheme.threat = 0;
  return reload(s);
}
function hand(s: GameState, code: string) {
  const p = makePiece(s, code);
  s.player.hand.push(p);
  return p;
}
function inPlay(s: GameState, code: string, attachedTo?: string) {
  const p = makePiece(s, code);
  if (attachedTo) p.attachedTo = attachedTo;
  s.player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code = SHOCKER) {
  const p = makePiece(s, code);
  delete p.ownerId;
  p.tough = false;
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
function encounter(s: GameState, code: string) {
  const p = makePiece(s, code);
  delete p.ownerId;
  return p;
}
const reveal = (s: GameState, p: Piece) =>
  native(s, { type: "reveal", piece: p } as Effect);
function playCard(s: GameState, p: Piece, resources: Piece[] = []) {
  s = command(s, { type: "PLAY", id: p.id });
  return pay(s, resources);
}
const option = (s: GameState, pattern: RegExp) =>
  s.prompt?.options.find((o) => pattern.test(o.label))?.id;
/** Pass other prompts until one offers an option matching the pattern. */
function reach(s: GameState, pattern: RegExp) {
  for (let n = 0; s.prompt && n < 40; n++) {
    if (option(s, pattern)) return s;
    if (
      pattern.test(s.prompt.title) &&
      s.prompt.options.some((o) => o.id === "yes")
    )
      return s;
    s = choose(s, passId(s) || s.prompt.options[0].id);
  }
  throw Error(`No prompt matching ${pattern}`);
}
function respond(s: GameState, pattern: RegExp) {
  s = reach(s, pattern);
  return choose(s, option(s, pattern) || "yes");
}
function useAbility(s: GameState, id: string, action: string) {
  return command(s, { type: "ABILITY", id, action });
}

describe("Echo: registration and setup", () => {
  it("registers every Echo face and starter card with native rules", () => {
    for (const code of [
      ...ECHO_SCRIPT_CODES,
      ...FNE_PLAYER_PACK_SCRIPT_CODES,
      PUNCH,
      TRAINING,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(rulesCode(PUNCH)).toBe("32014");
    expect(rulesCode(TRAINING)).toBe("40059");
    expect(HEROES.find((h) => h.id === "echo")).toMatchObject({
      code: "60037a",
      alter: "60037b",
      identity: "Maya Lopez",
      aspect: "protection",
    });
    const deck = CATALOG_HEROES.find((h) => h.id === "echo")!.decks.find(
      (d) => d.sourceType !== "app-starter",
    )!;
    const codes = catalogDeckCodes(deck);
    expect(deckErrors("echo", "protection", codes)).toEqual([]);
    expect(deckSizeFor(codes)).toBe(40);
  });
  it("begins as Maya Lopez, with Raised by the Kingpin in the encounter deck and Innate Reflexes as a Starting card", () => {
    let s = setup();
    s = settle(s, (v) =>
      v.prompt?.title === "Innate Reflexes" ? "yes" : undefined,
    );
    expect(s.player.form).toBe("alter");
    expect(s.player.hp).toBe(9);
    expect(heroStats(s).recover).toBe(3);
    // Starting: the first card of the six-card starting hand.
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.hand[0].code).toBe(INNATE);
    expect([...s.player.hand, ...s.player.deck]).toHaveLength(40);
    expect(s.encounter.deck.some((p) => p.code === RAISED)).toBe(true);
    // Declining keeps it in the deck.
    const t = settle(setup());
    expect(t.player.hand).toHaveLength(6);
    expect(
      [...t.player.hand, ...t.player.deck].filter((p) => p.code === INNATE),
    ).toHaveLength(1);
  });
});

describe("Echo: Watch and Learn and Photographic Reflexes", () => {
  it("Watch and Learn tucks an aspect or basic event a player plays, from that player's discard pile", () => {
    let s = started();
    s.player.exhausted = true;
    const army = hand(s, ARMY);
    const r = hand(s, ENERGY);
    s = reload(s);
    s = playCard(s, army, [r]);
    s = respond(s, /Tuck Army of One/);
    s = settle(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.echoTucked?.map((p) => p.id)).toEqual([army.id]);
    expect(s.player.discard.some((p) => p.id === army.id)).toBe(false);
  });
  it("keeps no more than three tucked cards: the player discards the extra one", () => {
    let s = started();
    const old = [HARM, ATTENTION, SEE_NO_EVIL].map((code) =>
      makePiece(s, code),
    );
    s.player.echoTucked = old;
    s.player.exhausted = true;
    const army = hand(s, ARMY);
    const r = hand(s, ENERGY);
    s = reload(s);
    s = playCard(s, army, [r]);
    s = respond(s, /Tuck Army of One/);
    expect(s.prompt?.title).toBe("Watch and Learn");
    s = choose(s, old[0].id);
    s = settle(s);
    expect(s.player.echoTucked?.map((p) => p.id)).toEqual([
      old[1].id,
      old[2].id,
      army.id,
    ]);
    expect(s.player.discard.some((p) => p.id === old[0].id)).toBe(true);
  });
  it("does not tuck Echo's own events, nor in alter-ego form", () => {
    let s = started();
    const tape = hand(s, TAPE);
    s = reload(s);
    s = settle(playCard(s, tape));
    expect(s.player.echoTucked || []).toEqual([]);
    expect(s.player.discard.some((p) => p.id === tape.id)).toBe(true);
    s.player.form = "alter";
    expect(echoEventFinished(s, makePiece(s, ARMY))).toEqual([]);
    s.player.form = "hero";
    expect(echoEventFinished(s, makePiece(s, ARMY))).toHaveLength(1);
  });
  it("Photographic Reflexes plays a tucked event as if from hand for 2 less, discarding itself, and Watch and Learn does not trigger", () => {
    let s = started();
    s.scheme.threat = 6;
    s.villain.hp = 20;
    const harm = makePiece(s, HARM);
    s.player.echoTucked = [harm];
    const first = hand(s, REFLEXES[0]);
    const second = hand(s, REFLEXES[1]);
    s = reload(s);
    expect(echoStoredPlayable(s).map((p) => p.id)).toEqual([harm.id]);
    expect(cardCost(s, card(harm), harm)).toBe(1);
    expect(
      playable(
        s,
        s.player.hand.find((p) => p.id === first.id)!,
      ),
    ).toMatch(/Photographic Reflexes/);
    s = command(s, { type: "PLAY", id: harm.id });
    expect(s.prompt?.kind).toBe("payment");
    // The copy it discards cannot also pay for the event.
    expect(
      dispatch(reload(s), { type: "PAY", ids: [first.id] }).error,
    ).toBeTruthy();
    s = pay(s, [second]);
    // In Harm's Way: X is Echo's DEF (2).
    expect(s.prompt).toBeNull();
    expect(s.villain.hp).toBe(18);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([first.id, second.id, harm.id]),
    );
    expect(s.player.echoTucked).toEqual([]);
  });
  it("tucks a teammate's event from that player's discard pile; played with Photographic Reflexes, it returns to its owner", () => {
    let s = newGame({
      heroId: "echo",
      aspect: "protection",
      villainId: "rhino",
      difficulty: "standard",
      seed: 60037,
      pacing: "expert",
      heroes: [
        { heroId: "echo", aspect: "protection" },
        { heroId: "daredevil", aspect: "justice" },
      ],
    });
    s = settle(s);
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    const echoSeat = s.players.find((p) => p.heroId === "echo")!.id;
    const ddSeat = s.players.find((p) => p.heroId === "daredevil")!.id;
    expect(s.activePlayerId).toBe(echoSeat);
    for (const seat of s.players) seatView(s, seat).player.form = "hero";
    s.scheme.threat = 5;
    const know = makePiece(s, KNOW);
    know.ownerId = ddSeat;
    seatView(s, ddSeat).player.hand.push(know);
    s = reload(s);
    s = command(s, { type: "PLAY", id: know.id, playerId: ddSeat });
    s = pay(s, []);
    s = respond(s, /Tuck Know Your Enemy/);
    s = settle(s);
    const tucked = seatView(s, echoSeat).player.echoTucked || [];
    expect(tucked.map((p) => p.id)).toEqual([know.id]);
    expect(tucked[0].ownerId).toBe(ddSeat);
    expect(
      seatView(s, ddSeat).player.discard.some((p) => p.id === know.id),
    ).toBe(false);
    expect(s.activePlayerId).toBe(echoSeat);
    const pr = makePiece(s, REFLEXES[0]);
    pr.ownerId = echoSeat;
    s.player.hand.push(pr);
    s.scheme.threat = 5;
    s = reload(s);
    s = command(s, { type: "PLAY", id: know.id });
    s = settle(pay(s, []));
    expect(s.scheme.threat).toBe(3);
    expect(
      seatView(s, ddSeat).player.discard.some((p) => p.id === know.id),
    ).toBe(true);
    expect(
      seatView(s, echoSeat).player.discard.some((p) => p.id === pr.id),
    ).toBe(true);
  });
  it("is unavailable without Photographic Reflexes in hand or in alter-ego form", () => {
    const s = started();
    s.player.echoTucked = [makePiece(s, HARM)];
    expect(echoStoredPlayable(s)).toEqual([]);
    hand(s, REFLEXES[2]);
    expect(echoStoredPlayable(s)).toHaveLength(1);
    s.player.form = "alter";
    expect(echoStoredPlayable(s)).toEqual([]);
  });
  it("plays a tucked Get Their Attention when an enemy initiates an attack", () => {
    let s = started();
    s.scheme.threat = 5;
    const attention = makePiece(s, ATTENTION);
    s.player.echoTucked = [attention];
    const pr = hand(s, REFLEXES[0]);
    s = reload(s);
    s = command(s, { type: "END_TURN", discard: [] });
    s = reach(s, /Get Their Attention/);
    // The tucked copy costs 0: Photographic Reflexes reduces it by 2.
    const tucked = s.prompt!.options.find((o) => o.id.endsWith(attention.id))!;
    expect(tucked.label).toMatch(/\(0 resources\)/);
    const before = s.scheme.threat;
    s = choose(s, tucked.id);
    s = pay(s, []);
    expect(s.scheme.threat).toBe(Math.max(0, before - 3));
    expect(s.player.discard.some((p) => p.id === pr.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === attention.id)).toBe(true);
    expect(s.player.echoTucked).toEqual([]);
  });
});

describe("Echo: Maya Lopez and the signature cards", () => {
  it("Practice Makes Perfect searches the deck for an aspect or basic event as Maya changes to hero form", () => {
    let s = started();
    s.player.form = "alter";
    s.player.flipped = false;
    s = reload(s);
    s = command(s, { type: "FLIP" });
    expect(s.prompt?.title).toBe("Practice Makes Perfect");
    const o = s.prompt!.options.find((o) => o.image === HARM)!;
    s = choose(s, o.id);
    s = settle(s);
    expect(s.player.form).toBe("hero");
    expect(s.player.hand.some((p) => p.id === o.id)).toBe(true);
  });
  it("Daredevil (ally) makes the next event you play this round cost 1 less after a basic power", () => {
    let s = started();
    s.scheme.threat = 5;
    const dd = inPlay(s, DD_ALLY);
    s = reload(s);
    expect(cardCost(s, card(HARM))).toBe(4);
    s = settle(useAbility(s, dd.id, "thwart"));
    expect(cardCost(s, card(HARM))).toBe(3);
    expect(cardCost(s, card(ATTENTION))).toBe(1);
    expect(cardCost(s, card(INNATE))).toBe(1);
    s.player.exhausted = true;
    const army = hand(s, ARMY);
    const r = hand(s, ENERGY);
    s = reload(s);
    expect(cardCost(s, card(army), army)).toBe(1);
    s = settle(playCard(s, army, [r]));
    expect(cardCost(s, card(HARM))).toBe(4);
  });
  it("Study the Tape adds an aspect event, a basic event or Photographic Reflexes from a discard pile to your hand", () => {
    let s = started();
    const harm = makePiece(s, HARM);
    s.player.discard.push(harm);
    const tape = hand(s, TAPE);
    s = reload(s);
    s = settle(playCard(s, tape), (v) =>
      v.prompt?.title === "Study the Tape" ? harm.id : undefined,
    );
    expect(s.player.hand.some((p) => p.id === harm.id)).toBe(true);
  });
  it("The Rez heals Maya Lopez by the highest cost among her tucked cards", () => {
    let s = started();
    s.player.form = "alter";
    s.player.hp = 3;
    s.player.echoTucked = [makePiece(s, HARM), makePiece(s, ARMY)];
    const rez = inPlay(s, REZ);
    s = reload(s);
    s = settle(useAbility(s, rez.id, "rez"));
    expect(s.player.hp).toBe(6);
    expect(s.player.inPlay.find((p) => p.id === rez.id)?.exhausted).toBe(true);
  });
  it("American Sign Language generates a wild resource only for an event", () => {
    let s = started();
    s.player.exhausted = true;
    const asl = inPlay(s, ASL);
    const army = hand(s, ARMY);
    s = reload(s);
    expect(
      paymentSources(s, undefined, INNATE).some((p) => p.id === asl.id),
    ).toBe(false);
    s = command(s, { type: "PLAY", id: army.id });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(s, [], undefined, [asl.id]));
    expect(s.player.inPlay.find((p) => p.id === asl.id)?.exhausted).toBe(true);
    expect(s.player.exhausted).toBe(false);
  });
  it("Choreography shuffles an aspect or basic event into your deck, and draws in alter-ego form", () => {
    let s = started();
    s.player.form = "alter";
    const harm = makePiece(s, HARM);
    s.player.discard.push(harm);
    const ch = inPlay(s, CHOREO);
    s = reload(s);
    s = settle(useAbility(s, ch.id, "choreography"), (v) =>
      v.prompt?.title === "Choreography" ? harm.id : undefined,
    );
    expect(s.player.discard.some((p) => p.id === harm.id)).toBe(false);
    expect(
      [...s.player.deck, ...s.player.hand].some((p) => p.id === harm.id),
    ).toBe(true);
    expect(s.player.hand).toHaveLength(1);
  });
  it("Echo's Katana deals damage equal to the event's printed cost, with piercing", () => {
    let s = started();
    s.villain.hp = 20;
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s.player.exhausted = true;
    const katana = inPlay(s, KATANA);
    const army = hand(s, ARMY);
    const r = hand(s, ENERGY);
    s = reload(s);
    s = playCard(s, army, [r]);
    s = respond(s, /Echo's Katana/);
    s = settle(s);
    expect(s.villain.tough).toBe(false);
    expect(s.villain.hp).toBe(19);
    expect(s.player.inPlay.find((p) => p.id === katana.id)?.exhausted).toBe(
      true,
    );
  });
  it("Improvisation heals after an Attack event and deals 1 damage after a Thwart event", () => {
    let s = started();
    s.player.hp = 5;
    s.villain.hp = 20;
    s.scheme.threat = 5;
    inPlay(s, IMPROV);
    const harm = hand(s, HARM);
    const r1 = hand(s, ENERGY);
    const r2 = hand(s, GENIUS);
    s = reload(s);
    s = playCard(s, harm, [r1, r2]);
    s = respond(s, /Improvisation/);
    s = settle(s);
    expect(s.player.hp).toBe(6);
    expect(s.villain.hp).toBe(17);
    expect(s.scheme.threat).toBe(3);
  });
  it("Muscle Memory adds a tucked event to your hand", () => {
    let s = started();
    const harm = makePiece(s, HARM);
    s.player.echoTucked = [harm];
    const mm = inPlay(s, MUSCLE);
    s = reload(s);
    s = settle(useAbility(s, mm.id, "muscle"), (v) =>
      v.prompt?.title === "Muscle Memory" ? harm.id : undefined,
    );
    expect(s.player.hand.some((p) => p.id === harm.id)).toBe(true);
    expect(s.player.echoTucked).toEqual([]);
  });
});

describe("Echo: Raised by the Kingpin and Kingpin's nemesis set", () => {
  it("Raised by the Kingpin stays with Maya Lopez, finds Kingpin, keeps her from damaging him and leaves after 4 threat", () => {
    let s = started();
    const raised = encounter(s, RAISED);
    s = reload(s);
    s = settle(reveal(s, raised));
    expect(s.player.inPlay.some((p) => p.id === raised.id)).toBe(true);
    const k = s.minions.find((p) => p.code === KINGPIN)!;
    expect(k.engagedWith).toBe(s.activePlayerId);
    s = settle(
      native(s, {
        type: "damage",
        target: k.id,
        amount: 3,
        source: "hero",
      } as Effect),
    );
    expect(s.minions.find((p) => p.id === k.id)?.damage).toBe(0);
    s.scheme.threat = 6;
    s = reload(s);
    s = settle(
      native(s, {
        type: "thwart",
        target: "main",
        amount: 3,
        action: true,
        source: "hero",
      } as Effect),
    );
    expect(s.player.inPlay.find((p) => p.id === raised.id)?.counters).toBe(3);
    s = settle(
      native(s, {
        type: "thwart",
        target: "main",
        amount: 1,
        action: true,
        source: "hero",
      } as Effect),
    );
    expect(s.player.inPlay.some((p) => p.id === raised.id)).toBe(false);
    expect(s.removed.some((p) => p.id === raised.id)).toBe(true);
    s = settle(
      native(s, {
        type: "damage",
        target: k.id,
        amount: 2,
        source: "hero",
      } as Effect),
    );
    expect(s.minions.find((p) => p.id === k.id)?.damage).toBe(2);
  });
  it("finds Kingpin, not a Kingpin's Henchman, as Echo's nemesis minion", () => {
    let s = started();
    const h = encounter(s, HENCHMAN);
    s.encounter.deck.unshift(h);
    const k = encounter(s, KINGPIN);
    s.encounter.deck.push(k);
    s = reload(s);
    s = settle(reveal(s, encounter(s, RAISED)));
    expect(s.minions.map((p) => p.id)).toEqual([k.id]);
    expect(s.encounter.deck.some((p) => p.id === h.id)).toBe(true);
  });
  it("Kingpin schemes instead of attacking the Maya Lopez player", () => {
    let s = started();
    const k = minion(s, KINGPIN);
    s = reload(s);
    s = settle(native(s, { type: "enemyAttack", id: k.id } as Effect));
    expect(s.scheme.threat).toBe(3);
  });
  it("Master Manipulator finds Kingpin, who cannot take damage while it is in play", () => {
    let s = started();
    const mm = encounter(s, MANIPULATOR);
    s = reload(s);
    s = settle(reveal(s, mm));
    expect(s.sideSchemes.find((p) => p.id === mm.id)?.counters).toBe(2);
    const k = s.minions.find((p) => p.code === KINGPIN)!;
    expect(k).toBeTruthy();
    s = settle(
      native(s, {
        type: "damage",
        target: k.id,
        amount: 3,
        source: "hero",
      } as Effect),
    );
    expect(s.minions.find((p) => p.id === k.id)?.damage).toBe(0);
  });
  it("Master Manipulator's boost reveals it while Kingpin is in play", () => {
    let s = started();
    minion(s, KINGPIN);
    const mm = encounter(s, MANIPULATOR);
    s.encounter.deck.unshift(mm);
    s = reload(s);
    s = settle(command(s, { type: "END_TURN", discard: [] }));
    expect(s.sideSchemes.some((p) => p.id === mm.id)).toBe(true);
  });
  it("Kingpin's Henchman keeps Kingpin from taking damage", () => {
    let s = started();
    const k = minion(s, KINGPIN);
    const h = minion(s, HENCHMAN);
    s = reload(s);
    s = settle(
      native(s, {
        type: "damage",
        target: k.id,
        amount: 2,
        source: "hero",
      } as Effect),
    );
    expect(s.minions.find((p) => p.id === k.id)?.damage).toBe(0);
    s.minions = s.minions.filter((p) => p.id !== h.id);
    s = reload(s);
    s = settle(
      native(s, {
        type: "damage",
        target: k.id,
        amount: 2,
        source: "hero",
      } as Effect),
    );
    expect(s.minions.find((p) => p.id === k.id)?.damage).toBe(2);
  });
  it("Pawn of the Kingpin: in alter-ego form Kingpin schemes (or it surges); in hero form it deals damage equal to your ATK", () => {
    let s = started();
    s.player.form = "alter";
    minion(s, KINGPIN);
    s = reload(s);
    s = settle(reveal(s, encounter(s, PAWN)));
    expect(s.scheme.threat).toBe(3);
    let t = started();
    t.player.form = "alter";
    const deckBefore = t.encounter.deck.length;
    t = reload(t);
    t = settle(reveal(t, encounter(t, PAWN)));
    expect(t.encounter.deck.length).toBe(deckBefore - 1);
    let u = started();
    const hp = u.player.hp;
    u = settle(reveal(u, encounter(u, PAWN)));
    expect(u.player.hp).toBe(hp - 2);
  });
});

describe("Fear No Evil protection and basic cards", () => {
  it("Innate Reflexes and Ronin give +1 DEF; Ronin retaliates without allies", () => {
    const s = started();
    expect(heroStats(s).defense).toBe(2);
    inPlay(s, INNATE);
    expect(heroStats(s).defense).toBe(3);
    inPlay(s, RONIN);
    expect(heroStats(s).defense).toBe(4);
    inPlay(s, DD_ALLY);
    expect(heroStats(s).defense).toBe(3);
  });
  it("The Best Offense... gives +1 DEF, uses DEF for ATK and THW, and is discarded at the end of the round", () => {
    let s = started();
    const offense = inPlay(s, OFFENSE);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 3 });
    s = reload(s);
    s = settle(command(s, { type: "END_TURN", discard: [] }));
    expect(s.player.inPlay.some((p) => p.id === offense.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === offense.id)).toBe(true);
  });
  it("Army of One costs 1 more for each ally you control and readies your hero", () => {
    let s = started();
    const army = hand(s, ARMY);
    expect(playable(s, army)).toMatch(/not exhausted/);
    s.player.exhausted = true;
    expect(cardCost(s, card(ARMY))).toBe(1);
    inPlay(s, DD_ALLY);
    expect(cardCost(s, card(ARMY))).toBe(2);
    const r = hand(s, ENERGY);
    s = reload(s);
    s = settle(playCard(s, army, [r]));
    expect(s.player.exhausted).toBe(false);
  });
  it("Get Their Attention removes 3 threat when an enemy initiates an attack, and Echo defends", () => {
    let s = started();
    s.scheme.threat = 5;
    const attention = hand(s, ATTENTION);
    const r = hand(s, ENERGY);
    s = reload(s);
    expect(playable(s, attention)).toMatch(/reaction window/);
    s = command(s, { type: "END_TURN", discard: [] });
    s = reach(s, /Get Their Attention/);
    const before = s.scheme.threat;
    s = choose(s, option(s, /Get Their Attention/)!);
    s = pay(s, [s.player.hand.find((p) => p.id === r.id)!]);
    expect(s.scheme.threat).toBe(Math.max(0, before - 3));
    expect(s.attack?.defender).toBe("hero");
  });
  it("Stand Alone readies your hero when an enemy attacks you and you control no allies", () => {
    let s = started();
    const stand = inPlay(s, STAND);
    // Exhausted (after defending an earlier attack), Echo is attacked again.
    s.player.exhausted = true;
    s = reload(s);
    s = native(s, { type: "enemyAttack", id: s.villain.id } as Effect);
    s = respond(s, /Stand Alone/);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === stand.id)?.exhausted).toBe(
      true,
    );
  });
  it("See No Evil, Hear No Evil needs Daredevil and Echo, and resolves two choices", () => {
    let s = started();
    s.villain.hp = 20;
    s.scheme.threat = 6;
    const sne = hand(s, SEE_NO_EVIL);
    expect(playable(s, sne)).toMatch(/Team-Up/);
    inPlay(s, DD_ALLY);
    const r = hand(s, STRENGTH);
    s = reload(s);
    s = playCard(s, sne, [r]);
    s = choose(s, "damage-threat");
    s = settle(s);
    expect(s.villain.hp).toBe(17);
    expect(s.scheme.threat).toBe(3);
  });
  it("Powerful Punch (Fear No Evil) and Superpower Training resolve through their original rules codes", () => {
    let s = started();
    s.villain.hp = 20;
    const punch = hand(s, PUNCH);
    const r = hand(s, STRENGTH);
    s = reload(s);
    expect(playable(s, punch)).toMatch(/reaction window/);
    s = command(s, { type: "END_TURN", discard: [] });
    s = respond(s, /Powerful Punch/);
    s = pay(s, [s.player.hand.find((p) => p.id === r.id)!]);
    expect(s.villain.hp).toBe(16);
  });
});
