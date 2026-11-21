/** Daredevil (Fear No Evil): the Sense deck, signature cards, Sensory
 * Overload, Bullseye's nemesis set, and the starter deck's justice and basic
 * cards, exercised with the original physical cards. Every command crosses a
 * JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, HEROES, card, heroStats } from "../src/game/cards";
import {
  abilityOptions,
  cardCost,
  dispatch,
  enemyStats,
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
  playable,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { rulesCode } from "../src/game/rules-code";
import {
  DAREDEVIL_SCRIPT_CODES,
  daredevilStoredPlayable,
} from "../src/game/daredevil";
import {
  FNE_PLAYER_PACK_SCRIPT_CODES,
  fnePackStoredPlayable,
} from "../src/game/fne-player-pack";
import { catalogDeckCodes, CATALOG_HEROES } from "../src/game/catalog";
import { deckErrors, deckSizeFor } from "../src/game/decks";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  choose,
  command,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

const SENSES = ["60002", "60003", "60004", "60005", "60006"];
const TACTILITY = "60002";
const OLFACTION = "60003";
const HEARING = "60004";
const RADAR = "60005";
const TASTE = "60006";
const ELEKTRA = "60007";
const CROSS = "60008";
const DEPOSITION = "60009";
const LIE = "60010";
const HELL = "60011";
const FOCUS = "60012";
const FOGGY = "60013";
const KAREN = "60014";
const NELSON = "60015";
const MAGGIE = "60016";
const CLUB = "60017";
const FEARLESS = "60018";
const OVERLOAD = "60032";
const BULLSEYE = "60033";
const DEADLIEST = "60034";
const SAI = "60035";
const EYE = "60036";
const BLINDSPOT = "60019";
const CLOAK = "60020";
const DAGGER = "60021";
const GHOST = "60022";
const KNOW = "60023";
const DEESCALATION = "60024";
const CHANCE = "60025";
const LEGAL = "60026";
const SHADOW = "60027";
const STEALTH = "60028";
const STICK = "60029";
const CONTINGENCY = "60030";
const DANCE = "60031";
const ENERGY = "60057";
const GENIUS = "60058";
const STRENGTH = "60059";
const SHOCKER = "01103";
const BOMBER = "01110";
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
function setup(villainId = "rhino", seed = 60001) {
  return newGame({
    heroId: "daredevil",
    aspect: "justice",
    villainId,
    difficulty: "standard",
    seed,
    pacing: "expert",
    heroes: [{ heroId: "daredevil", aspect: "justice" }],
  });
}
/** Daredevil in hero form with an empty hand, mid player phase. */
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
function side(s: GameState, code = USURP, threat = 3) {
  const p = makePiece(s, code);
  delete p.ownerId;
  p.counters = threat;
  s.sideSchemes.push(p);
  return p;
}
const sense = (s: GameState, code: string) =>
  s.player.senseDeck!.find((p) => p.code === code)!;
/** Move a Sense card to the top of the Sense deck. */
function onTop(s: GameState, code: string) {
  const deck = s.player.senseDeck!;
  const i = deck.findIndex((p) => p.code === code);
  deck.unshift(...deck.splice(i, 1));
  return deck[0];
}
/** Play a card, paying with the listed resource cards from hand. */
function playCard(s: GameState, p: Piece, resources: Piece[] = []) {
  s = command(s, { type: "PLAY", id: p.id });
  return pay(s, resources);
}
const option = (s: GameState, pattern: RegExp) =>
  s.prompt?.options.find((o) => pattern.test(o.label))?.id;
function respond(s: GameState, pattern: RegExp) {
  for (let n = 0; s.prompt && n < 30; n++) {
    if (option(s, pattern)) return choose(s, option(s, pattern)!);
    if (
      pattern.test(s.prompt.title) &&
      s.prompt.options.some((o) => o.id === "yes")
    )
      return choose(s, "yes");
    s = choose(s, passId(s) || s.prompt.options[0].id);
  }
  throw Error(`No prompt matching ${pattern}`);
}
function useAbility(s: GameState, id: string, action: string) {
  return command(s, { type: "ABILITY", id, action });
}

describe("Daredevil: registration and setup", () => {
  it("registers every Daredevil face and starter card with native rules", () => {
    for (const code of [
      ...DAREDEVIL_SCRIPT_CODES,
      ...FNE_PLAYER_PACK_SCRIPT_CODES,
      CHANCE,
      FOGGY,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(rulesCode(CHANCE)).toBe("26034");
    expect(HEROES.find((h) => h.id === "daredevil")).toMatchObject({
      code: "60001a",
      alter: "60001b",
      identity: "Matt Murdock",
      aspect: "justice",
    });
    const deck = CATALOG_HEROES.find((h) => h.id === "daredevil")!.decks.find(
      (d) => d.sourceType !== "app-starter",
    )!;
    const codes = catalogDeckCodes(deck);
    expect(deckErrors("daredevil", "justice", codes)).toEqual([]);
    expect(deckSizeFor(codes)).toBe(40);
  });
  it("sets aside the five Sense upgrades as a separate Sense deck", () => {
    const s = settle(setup());
    expect(s.player.senseDeck?.map((p) => p.code).sort()).toEqual(SENSES);
    const all = [...s.player.hand, ...s.player.deck];
    expect(all).toHaveLength(40);
    expect(all.some((p) => SENSES.includes(p.code))).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.encounter.deck.some((p) => p.code === OVERLOAD)).toBe(true);
    // Matt Murdock: 6 cards, 3 recover.
    expect(s.player.form).toBe("alter");
    expect(s.player.hand).toHaveLength(6);
    expect(heroStats(s).recover).toBe(3);
  });
});

describe("Daredevil: the Sense deck", () => {
  it("Superhuman Senses plays the top card, paying its cost, onto a chosen card", () => {
    let s = started();
    const m = minion(s);
    const top = onTop(s, RADAR);
    expect(daredevilStoredPlayable(s).map((p) => p.id)).toEqual([top.id]);
    const r = hand(s, ENERGY);
    expect(nativeHeroAbilityOptions(s).some((o) => o.id === "senses")).toBe(
      true,
    );
    s = playCard(s, top, [r]);
    s = settle(s, (v) => v.prompt?.options.find((o) => o.id === m.id)?.id);
    expect(s.player.inPlay.find((p) => p.id === top.id)?.attachedTo).toBe(m.id);
    expect(s.player.senseDeck).toHaveLength(4);
    expect(s.player.discard.some((p) => p.id === r.id)).toBe(true);
  });
  it("is not available in alter-ego form, and only the top card plays", () => {
    const s = started();
    minion(s);
    s.player.form = "alter";
    expect(daredevilStoredPlayable(s)).toEqual([]);
    s.player.form = "hero";
    const second = s.player.senseDeck![1];
    expect(dispatch(reload(s), { type: "PLAY", id: second.id }).error).toMatch(
      /not available/i,
    );
  });
  it("a Sense upgrade leaving play goes to the bottom of the Sense deck", () => {
    let s = started();
    const m = minion(s, BOMBER);
    const radar = s.player.senseDeck!.splice(
      s.player.senseDeck!.findIndex((p) => p.code === RADAR),
      1,
    )[0];
    radar.attachedTo = m.id;
    s.player.inPlay.push(radar);
    s = reload(s);
    s = native(s, {
      type: "damage",
      target: m.id,
      amount: 5,
      source: "hero",
    } as Effect);
    s = settle(s);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.senseDeck!.at(-1)?.id).toBe(radar.id);
    expect(s.player.discard.some((p) => p.id === radar.id)).toBe(false);
  });
});

/** Put a Sense upgrade from the Sense deck straight into play. */
function attachSense(s: GameState, code: string, target: string) {
  const deck = s.player.senseDeck!;
  const [p] = deck.splice(
    deck.findIndex((q) => q.code === code),
    1,
  );
  p.attachedTo = target;
  s.player.inPlay.push(p);
  return p;
}

describe("Daredevil: the Sense upgrades", () => {
  it("Acute Tactility readies your identity when you defeat the attached enemy", () => {
    let s = started();
    const m = minion(s, BOMBER);
    const t = attachSense(s, TACTILITY, m.id);
    s.player.exhausted = true;
    s = reload(s);
    s = native(s, {
      type: "damage",
      target: m.id,
      amount: 5,
      source: "hero",
    } as Effect);
    s = respond(s, /Acute Tactility/);
    s = settle(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.senseDeck!.at(-1)?.id).toBe(t.id);
  });
  it("Enhanced Olfaction reduces your next card this phase by 2 after the last threat comes off its scheme", () => {
    let s = started();
    const scheme = side(s, USURP, 2);
    attachSense(s, OLFACTION, scheme.id);
    s = reload(s);
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: 2,
      action: true,
      source: "hero",
    } as Effect);
    s = respond(s, /Enhanced Olfaction/);
    s = settle(s);
    expect(cardCost(s, card(CROSS))).toBe(0);
    expect(cardCost(s, card(HELL))).toBe(0);
    const cross = hand(s, CROSS);
    minion(s, SHOCKER);
    s = reload(s);
    s = settle(playCard(s, cross));
    expect(cardCost(s, card(HELL))).toBe(2);
  });
  it("Heightened Hearing gives the attacking enemy -3 ATK and makes Daredevil its target and defender", () => {
    let s = started();
    s.villain.hp = 20;
    attachSense(s, HEARING, s.villain.id);
    s = reload(s);
    s = command(s, { type: "END_TURN", discard: [] });
    const before = s.log.length;
    s = respond(s, /Heightened Hearing/);
    const lines = s.log.slice(before).map((l) => l.text);
    const total = lines.find((l) => l.startsWith("Attack total:"))!;
    const damage = lines.find((l) => /incoming damage/.test(l))!;
    // Rhino's attack total less 3, with no defense: a defense-labeled
    // interrupt makes Daredevil the defender without his DEF.
    const atk = Number(/Attack total: (\d+)/.exec(total)![1]) - 3;
    expect(damage.startsWith(`${atk} ATK − 0 DEF`), damage).toBe(true);
    expect(s.player.senseDeck!.some((p) => p.code === HEARING)).toBe(true);
  });
  it("Radar Sense deals 3 damage after you attack the attached enemy", () => {
    let s = started();
    s.villain.hp = 20;
    const radar = attachSense(s, RADAR, s.villain.id);
    s = reload(s);
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Radar Sense/);
    s = settle(s);
    expect(s.villain.hp).toBe(20 - 2 - 3);
    expect(s.player.senseDeck!.at(-1)?.id).toBe(radar.id);
  });
  it("Superior Taste removes 2 threat after you thwart the attached scheme", () => {
    let s = started();
    const scheme = side(s, USURP, 5);
    attachSense(s, TASTE, scheme.id);
    s = reload(s);
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: 2,
      action: true,
      source: "hero",
    } as Effect);
    s = respond(s, /Superior Taste/);
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(1);
  });
});

describe("Daredevil: signature cards", () => {
  it("Elektra's consequential damage goes to Daredevil in hero form", () => {
    let s = started();
    s.villain.hp = 20;
    const elektra = inPlay(s, ELEKTRA);
    s = reload(s);
    s = useAbility(s, elektra.id, "attack");
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === elektra.id)?.damage).toBe(0);
    expect(s.player.hp).toBe(9);
    expect(s.villain.hp).toBe(18);
  });
  it("Cross-Examination deals 3 damage and 1 more for each upgrade attached", () => {
    let s = started();
    s.villain.hp = 20;
    attachSense(s, RADAR, s.villain.id);
    attachSense(s, HEARING, s.villain.id);
    const card1 = hand(s, CROSS);
    const r = hand(s, ENERGY);
    s = reload(s);
    s = playCard(s, card1, [r]);
    s = settle(
      s,
      (v) => v.prompt?.options.find((o) => o.id === v.villain.id)?.id,
    );
    expect(s.villain.hp).toBe(15);
  });
  it("Deposition plays a Sense upgrade for free in alter-ego form, then removes 2 threat", () => {
    let s = started();
    s.player.form = "alter";
    const scheme = side(s, USURP, 4);
    const card1 = hand(s, DEPOSITION);
    const r = hand(s, GENIUS);
    s = reload(s);
    s = playCard(s, card1, [r]);
    s = choose(s, option(s, /Superior Taste/)!);
    s = settle(s, (v) => v.prompt?.options.find((o) => o.id === scheme.id)?.id);
    expect(s.player.inPlay.find((p) => p.code === TASTE)?.attachedTo).toBe(
      scheme.id,
    );
    expect(s.player.senseDeck).toHaveLength(4);
    expect(
      s.sideSchemes.find((p) => p.id === scheme.id)?.counters,
    ).toBeLessThan(4);
  });
  it("Living Lie Detector removes 2 threat and 1 more for each upgrade on the scheme", () => {
    let s = started();
    const scheme = side(s, USURP, 6);
    attachSense(s, TASTE, scheme.id);
    attachSense(s, OLFACTION, scheme.id);
    const card1 = hand(s, LIE);
    const r = hand(s, GENIUS);
    s = reload(s);
    s = playCard(s, card1, [r]);
    s = settle(s, (v) => v.prompt?.options.find((o) => o.id === scheme.id)?.id);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
  });
  it("Raising Hell deals 2 damage per upgrade to each enemy, 3 with Aerial", () => {
    let s = started();
    s.villain.hp = 20;
    const m = minion(s, SHOCKER);
    m.damage = 0;
    attachSense(s, RADAR, s.villain.id);
    attachSense(s, HEARING, m.id);
    const club = inPlay(s, CLUB);
    const card1 = hand(s, HELL);
    const r1 = hand(s, ENERGY);
    const r2 = hand(s, STRENGTH);
    s = reload(s);
    // Billy Club: Daredevil gains Aerial until the end of the round.
    s = useAbility(s, club.id, "club");
    s = choose(s, "aerial");
    expect(s.player.hand.some((p) => p.id === club.id)).toBe(true);
    s = playCard(
      s,
      s.player.hand.find((p) => p.id === card1.id)!,
      [r1, r2],
    );
    s = settle(s);
    expect(s.villain.hp).toBe(17);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
  });
  it("Daredevil's Billy Club gives +1 ATK and deals 1 damage from your hand", () => {
    let s = started();
    s.villain.hp = 20;
    const club = inPlay(s, CLUB);
    s = reload(s);
    expect(heroStats(s).attack).toBe(3);
    s = useAbility(s, club.id, "club");
    s = choose(s, "damage");
    s = settle(s);
    expect(s.villain.hp).toBe(19);
    expect(heroStats(s).attack).toBe(2);
  });
  it("The Man Without Fear takes 1 damage to play a Sense upgrade free or ready Daredevil", () => {
    let s = started();
    const m = minion(s, SHOCKER);
    const fearless = inPlay(s, FEARLESS);
    s.player.exhausted = true;
    s = reload(s);
    s = useAbility(s, fearless.id, "fearless");
    s = choose(s, "ready");
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hp).toBe(9);
    s.player.inPlay.find((p) => p.id === fearless.id)!.exhausted = false;
    s = reload(s);
    s = useAbility(s, fearless.id, "fearless");
    s = settle(
      s,
      (v) =>
        option(v, /Play an upgrade/) ||
        option(v, /Play Radar Sense/) ||
        v.prompt?.options.find((o) => o.id === m.id)?.id,
    );
    expect(s.player.inPlay.some((p) => p.code === RADAR)).toBe(true);
    expect(s.player.hp).toBe(8);
  });
  it("Karen Page shuffles a Daredevil card into your deck and draws in alter-ego form", () => {
    let s = started();
    s.player.form = "alter";
    const karen = inPlay(s, KAREN);
    const cross = makePiece(s, CROSS);
    s.player.discard.push(cross);
    const handBefore = s.player.hand.length;
    s = reload(s);
    s = useAbility(s, karen.id, "karen");
    s = settle(s);
    expect(s.player.discard.some((p) => p.id === cross.id)).toBe(false);
    expect(
      [...s.player.deck, ...s.player.hand].some((p) => p.id === cross.id),
    ).toBe(true);
    expect(s.player.hand.length).toBe(handBefore + 1);
  });
  it("Sister Maggie gives Matt Murdock +3 REC and discards a status after recovering", () => {
    let s = started();
    s.player.form = "alter";
    inPlay(s, MAGGIE);
    s.player.hp = 2;
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = reload(s);
    expect(heroStats(s).recover).toBe(6);
    s = command(s, { type: "BASIC", action: "recover" });
    s = respond(s, /Sister Maggie/);
    s = settle(s);
    expect(s.player.hp).toBe(8);
    expect(s.player.stunned).toBe(false);
  });
  it("Nelson and Murdock confuses an enemy after Foggy Nelson defeats a side scheme", () => {
    let s = started();
    s.player.form = "alter";
    inPlay(s, NELSON);
    const foggy = inPlay(s, FOGGY);
    const scheme = side(s, USURP, 2);
    s = reload(s);
    const options = abilityOptions(
      s,
      s.player.inPlay.find((p) => p.id === foggy.id)!,
    );
    s = useAbility(s, foggy.id, options[0].id);
    s = settle(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === scheme.id)?.id ||
        (/Nelson and Murdock/.test(v.prompt?.title || "") ? "yes" : undefined),
    );
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.villain.confused).toBe(true);
  });
  it("Focus the Senses keeps its threat from anyone but Daredevil, and its defeat moves and fetches Sense upgrades", () => {
    let s = started();
    const m = minion(s, SHOCKER);
    const focus = makePiece(s, FOCUS);
    focus.counters = 4;
    focus.playerSideSchemeController = s.activePlayerId;
    s.sideSchemes.push(focus);
    attachSense(s, RADAR, m.id);
    s = reload(s);
    // An ally cannot remove its threat.
    const elektra = inPlay(s, ELEKTRA);
    s = reload(s);
    s = native(s, {
      type: "thwart",
      target: focus.id,
      amount: 1,
      source: elektra.id,
    } as Effect);
    expect(s.sideSchemes.find((p) => p.id === focus.id)?.counters).toBe(4);
    s = native(s, {
      type: "thwart",
      target: focus.id,
      amount: 4,
      action: true,
      source: "hero",
    } as Effect);
    s = settle(
      s,
      (v) =>
        option(v, /Move Radar Sense/) ||
        (v.prompt?.title === "Radar Sense" ? v.villain.id : undefined) ||
        option(v, /Put Superior Taste into play/) ||
        option(v, /Put no more/) ||
        option(v, /Move no more/),
    );
    expect(s.sideSchemes.some((p) => p.id === focus.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.code === RADAR)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.player.inPlay.some((p) => p.code === TASTE)).toBe(true);
  });
});

function encounter(s: GameState, code: string) {
  const p = makePiece(s, code);
  delete p.ownerId;
  return p;
}
const reveal = (s: GameState, p: Piece) =>
  native(s, { type: "reveal", piece: p } as Effect);

describe("Daredevil: Sensory Overload and Bullseye's nemesis set", () => {
  it("Sensory Overload stays with Matt Murdock, deals 1 damage per Sense upgrade entering play, and goes when he recovers", () => {
    let s = started();
    s.player.form = "alter";
    s = reload(s);
    s = settle(reveal(s, encounter(s, OVERLOAD)));
    const overload = s.player.inPlay.find((p) => p.code === OVERLOAD);
    expect(overload).toBeTruthy();
    s.player.form = "hero";
    minion(s, SHOCKER);
    const top = onTop(s, RADAR);
    const r = hand(s, ENERGY);
    s.player.hp = 10;
    s = reload(s);
    s = settle(playCard(s, top, [r]));
    expect(s.player.hp).toBe(9);
    s.player.form = "alter";
    s = reload(s);
    s = command(s, { type: "BASIC", action: "recover" });
    s = respond(s, /Sensory Overload/);
    s = settle(s);
    expect(s.player.inPlay.some((p) => p.code === OVERLOAD)).toBe(false);
  });
  it("Bullseye's When Revealed discards a Persona support you control, or he attacks you", () => {
    let s = started();
    const karen = inPlay(s, KAREN);
    s = reload(s);
    s = reveal(s, encounter(s, BULLSEYE));
    s = choose(s, "discard");
    s = settle(s);
    expect(s.player.discard.some((p) => p.id === karen.id)).toBe(true);
    expect(s.minions.some((p) => p.code === BULLSEYE)).toBe(true);
    // Without a Persona support, Bullseye attacks you even in alter-ego form.
    let t = started();
    t.player.form = "alter";
    t.player.hp = 10;
    t = reload(t);
    t = settle(reveal(t, encounter(t, BULLSEYE)));
    expect(t.player.hp).toBeLessThan(10);
  });
  it("Deadliest Man Alive gives Bullseye a facedown boost card when he attacks", () => {
    let s = started();
    const bullseye = minion(s, BULLSEYE);
    const dma = encounter(s, DEADLIEST);
    dma.counters = 5;
    s.sideSchemes.push(dma);
    s.encounter.deck.unshift(encounter(s, "01103"));
    s.player.hp = 10;
    s = reload(s);
    s = native(s, { type: "enemyAttack", id: bullseye.id } as Effect);
    s = settle(s);
    expect(s.log.some((l) => /Boost:/.test(l.text))).toBe(true);
  });
  it("Stolen Sai attaches to the enemy with the highest ATK, gives piercing, and can be taken for Elektra", () => {
    let s = started();
    const shocker = minion(s, SHOCKER);
    void shocker;
    s = reload(s);
    s = settle(reveal(s, encounter(s, SAI)));
    const sai = s.attachments.find((p) => p.code === SAI)!;
    expect(sai.attachedTo).toBe(s.villain.id);
    expect(enemyStats(s, s.villain).attack).toBe(3);
    const elektra = inPlay(s, ELEKTRA);
    const r1 = hand(s, STRENGTH);
    const r2 = hand(s, STRENGTH);
    s = reload(s);
    s = useAbility(s, sai.id, "sai");
    s = pay(s, [r1, r2]);
    s = choose(s, "elektra");
    expect(s.attachments.find((p) => p.id === sai.id)?.attachedTo).toBe(
      elektra.id,
    );
  });
  it("Eye on the Target removes an ally from the game, or finds and reveals Bullseye", () => {
    let s = started();
    const elektra = inPlay(s, ELEKTRA);
    s = reload(s);
    s = reveal(s, encounter(s, EYE));
    s = settle(
      s,
      (v) =>
        option(v, /Remove an ally/) ||
        v.prompt?.options.find((o) => o.id === elektra.id)?.id,
    );
    expect(s.removed.some((p) => p.id === elektra.id)).toBe(true);
    let t = started();
    const bullseye = encounter(t, BULLSEYE);
    t.encounter.discard.push(bullseye);
    t.player.hp = 10;
    t = reload(t);
    t = reveal(t, encounter(t, EYE));
    t = settle(t, (v) => option(v, /Find Bullseye/));
    expect(t.minions.some((p) => p.id === bullseye.id)).toBe(true);
  });
});

describe("Fear No Evil justice and basic cards", () => {
  it("Know Your Enemy costs 1 less for a Martial Artist and removes 1 threat twice", () => {
    let s = started();
    const a = side(s, USURP, 3);
    s.scheme.threat = 3;
    const know = hand(s, KNOW);
    s = reload(s);
    expect(cardCost(s, card(KNOW))).toBe(0);
    s = playCard(s, know);
    s = settle(s, (v) => v.prompt?.options.find((o) => o.id === a.id)?.id);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
  });
  it("Legal Trouble costs 1 less for an Attorney, attaches to a minion and gives it -2 SCH", () => {
    let s = started();
    s.player.form = "alter";
    // Scorpion: 3 SCH.
    const m = minion(s, "02038");
    const legal = hand(s, LEGAL);
    s = reload(s);
    expect(cardCost(s, card(LEGAL))).toBe(0);
    s.player.form = "hero";
    s = reload(s);
    expect(cardCost(s, card(LEGAL))).toBe(1);
    s.player.form = "alter";
    s = reload(s);
    s = settle(playCard(s, legal));
    expect(s.player.inPlay.find((p) => p.id === legal.id)?.attachedTo).toBe(
      m.id,
    );
    expect(
      enemyStats(
        s,
        s.minions.find((p) => p.id === m.id)!,
      ).scheme,
    ).toBe(1);
    // Max 1 per minion.
    const second = hand(s, LEGAL);
    s = reload(s);
    expect(
      playable(
        s,
        s.player.hand.find((p) => p.id === second.id)!,
      ),
    ).toMatch(/Legal Trouble/);
  });
  it("Move in Shadow removes 1 threat after you play a card, including itself, and is discarded at the end of the round", () => {
    let s = started();
    s.scheme.threat = 5;
    const shadow = hand(s, SHADOW);
    const r = hand(s, ENERGY);
    s = reload(s);
    expect(cardCost(s, card(SHADOW))).toBe(1);
    s = playCard(s, shadow, [r]);
    s = respond(s, /Move in Shadow/);
    s = settle(s);
    expect(s.scheme.threat).toBe(4);
    const cross = hand(s, KNOW);
    s.scheme.threat = 5;
    s = reload(s);
    s = playCard(s, cross);
    s = settle(s, (v) =>
      /Move in Shadow/.test(v.prompt?.title || "") ? "yes" : undefined,
    );
    expect(s.scheme.threat).toBe(2);
    s = settle(command(s, { type: "END_TURN", discard: [] }));
    expect(s.player.discard.some((p) => p.id === shadow.id)).toBe(true);
  });
  it("Stealth Training stuns an enemy after you thwart and exactly defeat a side scheme", () => {
    let s = started();
    const a = side(s, USURP, 2);
    inPlay(s, STEALTH);
    s = reload(s);
    s = command(s, { type: "BASIC", action: "thwart" });
    s = respond(s, /Stealth Training/);
    s = settle(s);
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(false);
    expect(s.villain.stunned).toBe(true);
    // Excess threat removal is not exact.
    let t = started();
    side(t, USURP, 1);
    inPlay(t, STEALTH);
    t = reload(t);
    t = command(t, { type: "BASIC", action: "thwart" });
    expect(t.prompt?.title || "").not.toMatch(/Stealth Training/);
  });
  it("Stick gives a Martial Artist's basic power +1 (exhausting), or -1 to ready itself", () => {
    let s = started();
    s.villain.hp = 20;
    const stick = inPlay(s, STICK);
    s = reload(s);
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, `${stick.id}:plus`);
    s = settle(s);
    expect(s.villain.hp).toBe(17);
    expect(s.player.inPlay.find((p) => p.id === stick.id)?.exhausted).toBe(
      true,
    );
  });
  it("Contingency Planning tucks an upgrade from hand and plays it as if from hand", () => {
    let s = started();
    const m = minion(s, SHOCKER);
    const plan = inPlay(s, CONTINGENCY);
    const legal = hand(s, LEGAL);
    const r = hand(s, ENERGY);
    s = reload(s);
    s = useAbility(s, plan.id, "tuck");
    s = choose(s, legal.id);
    expect(
      s.player.inPlay
        .find((p) => p.id === plan.id)
        ?.storedCards?.map((p) => p.id),
    ).toEqual([legal.id]);
    expect(fnePackStoredPlayable(s).map((p) => p.id)).toEqual([legal.id]);
    s = playCard(s, legal, [s.player.hand.find((p) => p.id === r.id)!]);
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === legal.id)?.attachedTo).toBe(
      m.id,
    );
    expect(
      s.player.inPlay.find((p) => p.id === plan.id)?.storedCards || [],
    ).toEqual([]);
  });
  it("Dance with the Devil needs Daredevil and Elektra in play, attaches to an enemy and deals 3 damage", () => {
    let s = started();
    s.villain.hp = 20;
    const dance = hand(s, DANCE);
    s = reload(s);
    expect(
      playable(
        s,
        s.player.hand.find((p) => p.id === dance.id)!,
      ),
    ).toMatch(/Team-Up/);
    inPlay(s, ELEKTRA);
    s = reload(s);
    s = settle(playCard(s, dance));
    expect(s.player.inPlay.find((p) => p.id === dance.id)?.attachedTo).toBe(
      s.villain.id,
    );
    s = useAbility(s, dance.id, "dance");
    s = settle(s);
    expect(s.villain.hp).toBe(17);
    expect(s.player.discard.some((p) => p.id === dance.id)).toBe(true);
  });
  it("Blindspot confuses an enemy with an upgrade attached after he thwarts", () => {
    let s = started();
    s.scheme.threat = 4;
    const blind = inPlay(s, BLINDSPOT);
    attachSense(s, RADAR, s.villain.id);
    s = reload(s);
    s = useAbility(s, blind.id, "thwart");
    s = respond(s, /Blindspot/);
    s = settle(s);
    expect(s.villain.confused).toBe(true);
  });
  it("Cloak finds Dagger and puts her into play; his acceleration icon counts until she is", () => {
    let s = started();
    const cloak = inPlay(s, CLOAK);
    const dagger = makePiece(s, DAGGER);
    s.player.deck.push(dagger);
    const r1 = hand(s, ENERGY);
    const r2 = hand(s, ENERGY);
    s = reload(s);
    s = useAbility(s, cloak.id, "cloak");
    s = pay(s, [r1, r2]);
    s = settle(s);
    // The starter deck's own Dagger is found first; one Dagger is in play.
    expect(s.player.inPlay.filter((p) => p.code === DAGGER)).toHaveLength(1);
    void dagger;
  });
  it("Ghost Rider spends an energy resource to confuse the minion he attacks", () => {
    let s = started();
    const m = minion(s, "02038");
    const ghost = inPlay(s, GHOST);
    const r = hand(s, ENERGY);
    s = reload(s);
    s = useAbility(s, ghost.id, "attack");
    for (let n = 0; s.prompt?.kind === "choice" && n < 10; n++)
      s = choose(
        s,
        s.prompt.options.find((o) => o.id === m.id)?.id ||
          (/Ghost Rider/.test(s.prompt.title) ? "yes" : passId(s)!),
      );
    s = pay(s, [r]);
    s = settle(s);
    expect(s.minions.find((p) => p.id === m.id)?.confused).toBe(true);
  });
  it("De-escalation removes an acceleration token when defeated", () => {
    let s = started();
    s.encounter.acceleration = 1;
    const de = makePiece(s, DEESCALATION);
    de.counters = 1;
    de.playerSideSchemeController = s.activePlayerId;
    s.sideSchemes.push(de);
    s = reload(s);
    s = native(s, {
      type: "thwart",
      target: de.id,
      amount: 1,
      action: true,
      source: "hero",
    } as Effect);
    s = settle(s);
    expect(s.encounter.acceleration).toBe(0);
    expect(s.victoryDisplay?.some((p) => p.id === de.id)).toBe(true);
  });
  it("Chance Encounter (Fear No Evil) attaches to a side scheme like Vision's printing", () => {
    let s = started();
    const a = side(s, USURP, 3);
    const chance = hand(s, CHANCE);
    s = reload(s);
    s = settle(playCard(s, chance));
    expect(s.player.inPlay.find((p) => p.id === chance.id)?.attachedTo).toBe(
      a.id,
    );
  });
});
