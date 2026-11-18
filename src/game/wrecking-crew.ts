import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** The Wrecking Crew scenario pack: Breakout, with four villains, four
 * signature side schemes and four encounter decks in play at once. */
export const WRECKING_CREW_SCENARIO_CODES = [
  "07001a",
  "07001b",
  "07002",
  "07003",
  "07004",
  "07005",
  "07006",
  "07007",
  "07008",
  "07009",
  "07010",
  "07011",
  "07012",
  "07013",
  "07014",
  "07015",
  "07016",
  "07017",
  "07018",
  "07019",
  "07020",
  "07021",
  "07022",
  "07023",
  "07024",
  "07025",
  "07026",
  "07027",
  "07028",
  "07029",
  "07030",
  "07031",
  "07032",
  "07033",
  "07034",
  "07035",
  "07036",
  "07037",
  "07038",
  "07039",
  "07040",
  "07041",
  "07042",
  "07043",
  "07044",
  "07045",
  "07046",
  "07047",
  "07048",
  "07049",
  "07050",
  "07051",
  "07052",
  "07053",
  "07054",
  "07055",
  "07056",
  "07057",
  "07058",
  "07059",
] as const;
export const WRECKING_CREW_SCRIPT_CODES = WRECKING_CREW_SCENARIO_CODES;

export type CrewKey = "wrecker" | "thunderball" | "piledriver" | "bulldozer";
/** The four villains, each with version A (standard) and B (expert). */
export const CREW_KEYS: readonly CrewKey[] = [
  "wrecker",
  "thunderball",
  "piledriver",
  "bulldozer",
];
export const CREW_VILLAINS: Readonly<Record<CrewKey, readonly string[]>> = {
  wrecker: ["07002", "07003"],
  thunderball: ["07017", "07018"],
  piledriver: ["07032", "07033"],
  bulldozer: ["07046", "07047"],
};
/** Each villain's signature side scheme. */
export const CREW_SCHEMES: Readonly<Record<CrewKey, string>> = {
  wrecker: "07004",
  thunderball: "07019",
  piledriver: "07034",
  bulldozer: "07048",
};
export const BREAKOUT_SETUP = "07001a";
export const BREAKOUT = "07001b";
const HELD_HOSTAGE = ["07005", "07021", "07036", "07050"];
const MAGIC_CROWBAR = "07006";
const WRECKERS_COMMAND = "07007";
const ESCAPED_CONVICT = ["07009", "07024", "07038", "07053"];
const BUDDY_SYSTEM = ["07010", "07025", "07039", "07054"];
const CHAOS = ["07011", "07026", "07056"];
const CROWBAR_TOSS = "07012";
const GET_WRECKED = ["07013", "07028", "07040", "07057"];
const WAITING = ["07014", "07029", "07041"];
const MYSTICAL_LINK = "07015";
const DEAD_MEAT = "07016";
const BALL_AND_CHAIN = "07020";
const RADIOACTIVE = "07022";
const PROJECTILES = "07027";
const LIGHTNING = "07030";
const PROWESS = "07031";
export const DISTRACTING_TAUNTS = "07035";
const HANDS = "07042";
const ESCAPE_PLAN = "07043";
const PUMMEL = "07044";
const RESILIENCE = "07045";
const HELMET = "07049";
const RAMMING = "07051";
const BULL_RUSH = "07055";
const HEADBUTT = "07058";
const CHARGE = "07059";
/** Attachments that attach to one named villain. */
const ATTACHES_TO: Readonly<Record<string, CrewKey>> = {
  [MAGIC_CROWBAR]: "wrecker",
  [WRECKERS_COMMAND]: "wrecker",
  [BALL_AND_CHAIN]: "thunderball",
  [RADIOACTIVE]: "thunderball",
  [DISTRACTING_TAUNTS]: "piledriver",
  [HELMET]: "bulldozer",
  [RAMMING]: "bulldozer",
};
/** Hero Action: exhaust your hero and discard 1 card at random. */
const WEAPON_ACTIONS = [MAGIC_CROWBAR, BALL_AND_CHAIN, HELMET];

type Villain = GameState["villain"];
interface CrewPile {
  deck: Piece[];
  discard: Piece[];
  knownTop?: GameState["encounter"]["knownTop"];
}

/** Four villains are in play at once. The villain in focus occupies native
 * `s.villain`; the others wait on the bench. Outside a focus window the focus
 * is the active villain, the one with the active counter. The native
 * encounter deck and discard pile always belong to the active villain; the
 * other villains' decks wait in `decks`. */
export interface WreckingCrewState {
  active: CrewKey;
  focus: CrewKey;
  bench: Partial<Record<CrewKey, Villain>>;
  /** Whose encounter deck is the native `s.encounter` deck and discard. */
  deckOwner: CrewKey;
  decks: Partial<Record<CrewKey, CrewPile>>;
  defeated: CrewKey[];
  /** Open focus windows. When the last one closes the active villain is
   * in focus again. */
  windows?: number;
  /** Signature side schemes whose 10-threat Forced Response is queued. */
  pending?: string[];
  /** Breakout's Forced Response resolves completely before the side
   * schemes' Forced Responses that it triggers. */
  holdHits?: boolean;
  /** Distracting Taunts hit point bonuses applied, by villain piece ID. */
  taunts?: Record<string, string[]>;
}

export interface WreckingCrewPorts extends MutagenEnginePorts {
  revealHidden(s: GameState): void;
  /** Reveal an encounter card already removed from its deck. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  /** The current ATK or SCH of an enemy, as for its own activation. */
  villainStat(
    s: GameState,
    p: Piece,
    kind: "attack" | "scheme",
    playerId: string,
  ): number;
  /** Defeat the villain in focus (it has no hit points remaining). */
  defeatVillain(s: GameState): void;
  /** Remove a card in play from the game; its attachments are discarded. */
  removeFromGame(s: GameState, id: string): void;
  /** Encounter and player cards attached to a card. */
  attachmentsOn(s: GameState, id: string): Piece[];
  resetPiece(p: Piece): Piece;
  endGame(s: GameState, won: boolean, text: string): void;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  heroName(s: GameState, playerId: string): string;
  /** Discard the top cards of a player's deck and return them. */
  mill(s: GameState, playerId: string, amount: number): Piece[];
  /** Discard a random card from a player's hand and return it. */
  randomDiscard(s: GameState, playerId: string): Piece | undefined;
  /** Allies a player controls. */
  allies(s: GameState, playerId: string): Piece[];
  /** Remaining hit points of `hero:<player>` or of an ally in play. */
  remaining(s: GameState, target: string): number;
  inPlay(s: GameState, id: string): boolean;
  /** Printed cost of a card (0 without one). */
  cost(p: Piece): number;
  canDiscard(s: GameState, p: Piece): boolean;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const name = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code)?.name ||
  (typeof p === "string" ? p : p.code);
const typeOf = (p: Piece) => definitions.get(p.code)?.type_code;
const C = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `crew:${type}`,
  ...args,
});
const scripted = new Set<string>(WRECKING_CREW_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const seats = (s: GameState) => playerOrder(s).map((seat) => seat.id);

export function isWreckingCrew(s: GameState) {
  return !!s.wreckingCrew;
}
/** The villain a Wrecking Crew villain card belongs to. */
export function crewKeyOf(p?: Piece | string): CrewKey | undefined {
  const code = typeof p === "string" ? p : p?.code;
  if (!code) return undefined;
  return CREW_KEYS.find((key) => CREW_VILLAINS[key].includes(code));
}
/** The villain whose encounter deck an encounter card belongs to. */
export function crewDeckOwner(code: string): CrewKey | undefined {
  const c = definitions.get(code);
  if (!c || c.pack_code !== "twc") return undefined;
  if (["villain", "side_scheme", "main_scheme"].includes(c.type_code))
    return undefined;
  return CREW_KEYS.find((key) => key === c.set_code);
}
export const crewSchemeKey = (code: string) =>
  CREW_KEYS.find((key) => CREW_SCHEMES[key] === code);

/** The villains still in play, in printed order. */
export function crewLiving(s: GameState): CrewKey[] {
  const wc = s.wreckingCrew;
  return wc ? CREW_KEYS.filter((key) => !wc.defeated.includes(key)) : [];
}
/** The live piece of one villain, wherever the focus is. */
export function crewVillain(s: GameState, key: CrewKey): Villain | undefined {
  const wc = s.wreckingCrew;
  if (!wc || wc.defeated.includes(key)) return undefined;
  return wc.focus === key ? s.villain : wc.bench[key];
}
export function crewVillains(s: GameState): Villain[] {
  return crewLiving(s)
    .map((key) => crewVillain(s, key))
    .filter((v): v is Villain => !!v);
}
/** The villains out of focus. */
export function crewBench(s: GameState): Villain[] {
  const wc = s.wreckingCrew;
  return wc
    ? CREW_KEYS.map((key) => wc.bench[key]).filter((v): v is Villain => !!v)
    : [];
}
export function crewKeyOfId(s: GameState, id: string): CrewKey | undefined {
  return crewLiving(s).find((key) => crewVillain(s, key)?.id === id);
}
export function crewBenchKey(s: GameState, id: string): CrewKey | undefined {
  const wc = s.wreckingCrew;
  if (!wc) return undefined;
  return CREW_KEYS.find((key) => wc.bench[key]?.id === id);
}
/** A villain's signature side scheme in play. */
export function crewScheme(s: GameState, key: CrewKey): Piece | undefined {
  return s.sideSchemes.find((p) => p.code === CREW_SCHEMES[key]);
}
const threatOn = (s: GameState, key: CrewKey) =>
  crewScheme(s, key)?.counters ?? 0;
export function crewActiveVillain(s: GameState) {
  return s.wreckingCrew ? crewVillain(s, s.wreckingCrew.active) : undefined;
}
/** Encounter side schemes in play (never player side schemes). */
const encounterSchemes = (s: GameState) =>
  s.sideSchemes.filter((p) => !p.playerSideSchemeController);

/** Villains whose side scheme has the most or the least threat. */
export function crewByThreat(s: GameState, kind: "most" | "least"): CrewKey[] {
  const keys = crewLiving(s).filter((key) => crewScheme(s, key));
  if (!keys.length) return [];
  const values = keys.map((key) => threatOn(s, key));
  const target = kind === "most" ? Math.max(...values) : Math.min(...values);
  return keys.filter((key) => threatOn(s, key) === target);
}

/** Swap the bench so that `key` is native `s.villain`. */
export function crewFocus(s: GameState, key: CrewKey) {
  const wc = s.wreckingCrew;
  if (!wc || wc.focus === key) return;
  const next = wc.bench[key];
  if (!next) return;
  if (!wc.defeated.includes(wc.focus)) wc.bench[wc.focus] = s.villain;
  delete wc.bench[key];
  s.villain = next;
  wc.focus = key;
}
/** After a window closes: the outer window's villain, or the active one. */
function settleFocus(s: GameState, previous?: CrewKey) {
  const wc = s.wreckingCrew;
  if (!wc) return;
  const target =
    (wc.windows || 0) > 0 && previous && !wc.defeated.includes(previous)
      ? previous
      : wc.active;
  crewFocus(s, target);
}
/** Open a focus window on `key`; returns the focus to restore. */
export function wreckingCrewOpenWindow(s: GameState, key: CrewKey): CrewKey {
  const wc = s.wreckingCrew!;
  const previous = wc.focus;
  wc.windows = (wc.windows || 0) + 1;
  crewFocus(s, key);
  return previous;
}
export function wreckingCrewCloseWindow(s: GameState, previous: CrewKey) {
  const wc = s.wreckingCrew;
  if (!wc) return;
  wc.windows = Math.max(0, (wc.windows || 0) - 1);
  settleFocus(s, previous);
}
/** Run synchronous engine code with `key` in focus, then restore. */
export function withCrewFocus<R>(s: GameState, key: CrewKey, fn: () => R): R {
  const wc = s.wreckingCrew;
  if (!wc || wc.focus === key || !wc.bench[key]) return fn();
  const previous = wreckingCrewOpenWindow(s, key);
  try {
    return fn();
  } finally {
    wreckingCrewCloseWindow(s, previous);
  }
}

/** `crewVillainId` keeps a deferred defeat with the villain it belongs to. */
const focusFields = ["target", "targetId", "enemyId", "crewVillainId"];
const activationTypes = [
  "enemyAttack",
  "enemyScheme",
  "ghostNativeEnemyAttack",
  "ghostNativeEnemyScheme",
];
/** An effect that names a villain out of focus resolves inside a focus
 * window on that villain. */
export function wreckingCrewWindowKey(
  s: GameState,
  e: Effect,
): CrewKey | undefined {
  const wc = s.wreckingCrew;
  if (!wc || e.type.startsWith("crew:")) return undefined;
  const fields = activationTypes.includes(e.type)
    ? [...focusFields, "id"]
    : focusFields;
  return CREW_KEYS.find((key) => {
    const v = wc.bench[key];
    return !!v && fields.some((field) => e[field] === v.id);
  });
}

/** Native encounter piles belong to `deckOwner`; others wait in `decks`. */
function pileOf(s: GameState, key: CrewKey): CrewPile {
  const wc = s.wreckingCrew!;
  if (wc.deckOwner === key)
    return { deck: s.encounter.deck, discard: s.encounter.discard };
  return (wc.decks[key] ||= { deck: [], discard: [] });
}
/** Encounter cards that leave play go to their own villain's discard pile. */
export function wreckingCrewSyncDiscards(s: GameState) {
  const wc = s.wreckingCrew;
  if (!wc) return;
  const discard = s.encounter.discard;
  const stay: Piece[] = [];
  let moved = false;
  for (const p of discard) {
    const owner = crewDeckOwner(p.code);
    if (owner && owner !== wc.deckOwner) {
      (wc.decks[owner] ||= { deck: [], discard: [] }).discard.push(p);
      moved = true;
    } else stay.push(p);
  }
  if (moved) discard.splice(0, discard.length, ...stay);
}
/** Make `key`'s encounter deck and discard pile the native ones. */
function useDeck(s: GameState, key: CrewKey) {
  const wc = s.wreckingCrew!;
  if (wc.deckOwner === key) return;
  wreckingCrewSyncDiscards(s);
  wc.decks[wc.deckOwner] = {
    deck: s.encounter.deck,
    discard: s.encounter.discard,
    ...(s.encounter.knownTop ? { knownTop: s.encounter.knownTop } : {}),
  };
  const next = wc.decks[key] || { deck: [], discard: [] };
  delete wc.decks[key];
  s.encounter.deck = next.deck;
  s.encounter.discard = next.discard;
  if (next.knownTop) s.encounter.knownTop = next.knownTop;
  else delete s.encounter.knownTop;
  wc.deckOwner = key;
}
/** The top card of one villain's encounter deck. An empty deck reshuffles
 * its discard pile and places an acceleration token on the main scheme. */
function takeTop(
  s: GameState,
  key: CrewKey,
  ports: WreckingCrewPorts,
): Piece | undefined {
  const wc = s.wreckingCrew!;
  wreckingCrewSyncDiscards(s);
  const native = wc.deckOwner === key;
  const pile = pileOf(s, key);
  if (!pile.deck.length && pile.discard.length) {
    pile.deck.push(...ports.shuffle(s, pile.discard.splice(0)));
    if (native) delete s.encounter.knownTop;
    else delete pile.knownTop;
    s.encounter.acceleration++;
    ports.log(
      s,
      `${name(crewVillain(s, key) || CREW_VILLAINS[key][0])}'s encounter deck reshuffles: +1 acceleration token.`,
      "bad",
    );
  }
  const p = pile.deck.shift();
  if (!p) return undefined;
  ports.revealHidden(s);
  if (native && s.encounter.knownTop?.id === p.id) delete s.encounter.knownTop;
  if (!native && pile.knownTop?.id === p.id) delete pile.knownTop;
  return p;
}
/** Cards in each villain's encounter deck and discard pile. */
export function crewDeckCounts(s: GameState, key: CrewKey) {
  const wc = s.wreckingCrew;
  if (!wc) return { deck: 0, discard: 0 };
  const pile =
    wc.deckOwner === key
      ? { deck: s.encounter.deck, discard: s.encounter.discard }
      : wc.decks[key] || { deck: [], discard: [] };
  return {
    deck: pile.deck.length,
    discard: pile.discard.filter((p) => crewDeckOwner(p.code) === key).length,
  };
}
/** Every card of the stored decks, for physical audits. */
export function crewStoredPieces(s: GameState): Piece[] {
  const wc = s.wreckingCrew;
  if (!wc) return [];
  return CREW_KEYS.flatMap((key) => [
    ...(wc.decks[key]?.deck || []),
    ...(wc.decks[key]?.discard || []),
  ]);
}

/** Move the active counter; the encounter deck follows it. */
function setActive(s: GameState, key: CrewKey, ports: WreckingCrewPorts) {
  const wc = s.wreckingCrew;
  if (!wc || wc.defeated.includes(key)) return;
  const v = crewVillain(s, key);
  if (wc.active === key) {
    ports.log(s, `The active counter stays on ${name(v!)}.`);
    return;
  }
  wc.active = key;
  useDeck(s, key);
  if (!(wc.windows || 0)) crewFocus(s, key);
  ports.log(s, `The active counter moves to ${name(v!)}.`, "bad");
}

/** Signature side schemes cannot leave play while their villain is in
 * play, so they are not discarded without threat. */
export function wreckingCrewSchemeLocked(s: GameState, p: Piece): boolean {
  const wc = s.wreckingCrew;
  if (!wc) return false;
  const key = crewSchemeKey(p.code);
  return (
    !!key &&
    s.sideSchemes.some((q) => q.id === p.id) &&
    !wc.defeated.includes(key) &&
    !isTextBlank(s, p)
  );
}
/** Held Hostage: threat cannot be removed from the attached scheme by
 * thwarting. */
export function wreckingCrewThwartLocked(s: GameState, target: string) {
  return (
    !!s.wreckingCrew &&
    s.attachments.some(
      (a) =>
        HELD_HOSTAGE.includes(a.code) &&
        a.attachedTo === target &&
        !isTextBlank(s, a),
    )
  );
}
/** Distracting Taunts: players cannot attack villains other than
 * Piledriver. */
export function wreckingCrewAttackForbidden(s: GameState, id: string) {
  if (!s.wreckingCrew) return false;
  const key = crewKeyOfId(s, id);
  if (!key || key === "piledriver") return false;
  const piledriver = crewVillain(s, "piledriver");
  return (
    !!piledriver &&
    s.attachments.some(
      (a) =>
        a.code === DISTRACTING_TAUNTS &&
        a.attachedTo === piledriver.id &&
        !isTextBlank(s, a),
    )
  );
}
/** "When [villain] schemes, place the threat on his side scheme instead of
 * the main scheme." */
export function wreckingCrewSchemeTarget(
  s: GameState,
  p: Piece,
): string | undefined {
  if (!s.wreckingCrew || isTextBlank(s, p)) return undefined;
  const key = crewKeyOf(p);
  return key ? crewScheme(s, key)?.id : undefined;
}
/** Wrecker: +2 ATK while attacking if the attack is undefended. */
export function wreckingCrewAttackBonus(s: GameState, p: Piece): number {
  const a = s.attack;
  if (
    !s.wreckingCrew ||
    !a ||
    a.attacker !== p.id ||
    crewKeyOf(p) !== "wrecker" ||
    isTextBlank(s, p)
  )
    return 0;
  return a.defender === "none" && !a.eventDefense ? 2 : 0;
}
/** Bulldozer's attacks gain overkill. */
export function wreckingCrewKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (!s.wreckingCrew || isTextBlank(s, p)) return 0;
  if (keyword === "Overkill")
    return crewKeyOf(p) === "bulldozer" && s.attack?.attacker === p.id ? 1 : 0;
  return 0;
}
/** Ramming Speed: you must defend against Bulldozer with an ally you
 * control, if able. */
export function wreckingCrewMustDefendWithAlly(
  s: GameState,
  attackerId: string,
): boolean {
  if (!s.wreckingCrew) return false;
  const bulldozer = crewVillain(s, "bulldozer");
  return (
    !!bulldozer &&
    bulldozer.id === attackerId &&
    s.attachments.some(
      (a) =>
        a.code === RAMMING && a.attachedTo === attackerId && !isTextBlank(s, a),
    )
  );
}

/** Breakout's Forced Response, after step one of the villain phase. */
export function wreckingCrewStepOne(s: GameState): Effect[] {
  if (
    !s.wreckingCrew ||
    s.scheme.code !== BREAKOUT ||
    isTextBlank(s, { code: s.scheme.code, id: "main" })
  )
    return [];
  return [C("breakout", { mandatory: true, actorId: s.firstPlayerId })];
}

/** Queue the 10-threat Forced Responses of the signature side schemes. */
function schemeHits(s: GameState): Effect[] {
  const wc = s.wreckingCrew;
  if (!wc || wc.holdHits || over(s)) return [];
  const out: Effect[] = [];
  for (const key of CREW_KEYS) {
    const p = crewScheme(s, key);
    if (!p || p.counters < 10 || isTextBlank(s, p)) continue;
    if ((wc.pending ||= []).includes(p.id)) continue;
    wc.pending.push(p.id);
    out.push(C("hit", { id: p.id, mandatory: true, actorId: s.firstPlayerId }));
  }
  return out;
}
/** Distracting Taunts: Piledriver gets +3 hit points per copy. */
function syncTaunts(s: GameState) {
  const wc = s.wreckingCrew!;
  wc.taunts ||= {};
  for (const v of crewVillains(s)) {
    const now = s.attachments
      .filter(
        (a) =>
          a.code === DISTRACTING_TAUNTS &&
          a.attachedTo === v.id &&
          !isTextBlank(s, a),
      )
      .map((a) => a.id);
    const before = wc.taunts[v.id] || [];
    const change =
      3 *
      (now.filter((id) => !before.includes(id)).length -
        before.filter((id) => !now.includes(id)).length);
    if (change) {
      v.maxHp += change;
      v.hp += change;
    }
    if (now.length) wc.taunts[v.id] = now;
    else delete wc.taunts[v.id];
  }
}
/** Continuous checks after every effect. */
export function wreckingCrewCheck(
  s: GameState,
  ports: WreckingCrewPorts,
): Effect[] {
  const wc = s.wreckingCrew;
  if (!wc || over(s)) return [];
  wreckingCrewSyncDiscards(s);
  syncTaunts(s);
  // A villain without hit points whose defeat is not already on its way
  // (an interrupt before a defeat keeps it in the queue) is defeated now.
  const pending = (v: Villain) => s.queue.some((e) => e.crewVillainId === v.id);
  if (
    s.villain.hp <= 0 &&
    !wc.defeated.includes(wc.focus) &&
    !pending(s.villain)
  )
    ports.defeatVillain(s);
  for (const key of CREW_KEYS) {
    const v = s.wreckingCrew?.bench[key];
    if (v && v.hp <= 0 && !pending(v) && !over(s))
      withCrewFocus(s, key, () => ports.defeatVillain(s));
  }
  return schemeHits(s);
}

/** A villain is defeated: it and its side scheme are removed from the game.
 * When the active villain is defeated, the active counter moves to the
 * villain whose side scheme has the most threat. */
export function wreckingCrewVillainDefeated(
  s: GameState,
  ports: WreckingCrewPorts,
) {
  const wc = s.wreckingCrew;
  if (!wc) return;
  const key = wc.focus;
  const old = s.villain;
  if (wc.defeated.includes(key)) return;
  wc.defeated.push(key);
  if (wc.taunts) delete wc.taunts[old.id];
  for (const a of ports.attachmentsOn(s, old.id)) ports.discardPiece(s, a.id);
  const scheme = crewScheme(s, key);
  if (scheme) ports.removeFromGame(s, scheme.id);
  s.removed.push(ports.resetPiece(old));
  ports.log(
    s,
    `${name(old)} is defeated. ${name(CREW_SCHEMES[key])} is removed from the game.`,
    "good",
  );
  const living = crewLiving(s);
  if (!living.length) {
    ports.endGame(
      s,
      true,
      "The Wrecking Crew is defeated. The breakout at Ryker's Island is over.",
    );
    return;
  }
  const place = (next: CrewKey) => {
    const v = wc.bench[next]!;
    delete wc.bench[next];
    s.villain = v;
    wc.focus = next;
  };
  if (key !== wc.active) {
    place(wc.active);
    return;
  }
  const tied = crewByThreat(s, "most");
  const next = tied[0] ?? living[0];
  wc.active = next;
  useDeck(s, next);
  place(next);
  ports.log(
    s,
    `The active counter moves to ${name(s.villain)}, whose side scheme has the most threat.`,
    "bad",
  );
  if (tied.length > 1)
    ports.queue(
      s,
      C("pick", {
        kind: "most",
        title: "The active villain is defeated",
        then: [C("set-active")],
        actorId: s.firstPlayerId,
      }),
    );
}

/** Thunderball, Magic Crowbar, Ball and Chain, Radioactive Buildup,
 * Bulldozer's Helmet, Ramming Speed and Lightning Blast. */
export interface WreckingCrewAttackReceipt {
  token: string;
  attackerId: string;
  attackerCode: string;
  playerId: string;
  performed: boolean;
  textBlank: boolean;
  undefended: boolean;
  damagePlaced: number;
  excess: number;
  marker?: string;
}
export function wreckingCrewAttackResponses(
  s: GameState,
  r: WreckingCrewAttackReceipt,
  ports: Pick<WreckingCrewPorts, "allies">,
): MutagenForcedResponse[] {
  if (!s.wreckingCrew || !r.performed) return [];
  const key = crewKeyOf(r.attackerCode);
  if (!key) return [];
  const on = (code: string) =>
    s.attachments.filter(
      (a) =>
        a.code === code && a.attachedTo === r.attackerId && !isTextBlank(s, a),
    );
  const out: MutagenForcedResponse[] = [];
  if (key === "thunderball" && !r.textBlank && alive(s, r.playerId))
    out.push({
      id: `${r.token}:thunderball`,
      title: "Thunderball",
      effects: friendlyDamage(s, r.playerId, 1, ports),
    });
  for (const p of on(MAGIC_CROWBAR))
    out.push({
      id: `${r.token}:${p.id}`,
      title: name(p),
      effects: [C("scheme-threat", { kind: "least", amount: 1 })],
    });
  for (const p of on(BALL_AND_CHAIN))
    out.push({
      id: `${r.token}:${p.id}`,
      title: name(p),
      effects: [{ type: "threat", target: "main", amount: 1 }],
    });
  for (const p of on(RADIOACTIVE)) {
    const scheme = crewScheme(s, "thunderball");
    out.push({
      id: `${r.token}:${p.id}`,
      title: name(p),
      effects: [
        ...(r.excess > 0 && scheme
          ? [{ type: "threat", target: scheme.id, amount: r.excess }]
          : []),
        { type: "discardPiece", id: p.id },
      ],
    });
  }
  for (const p of on(HELMET))
    if (r.damagePlaced > 0 && alive(s, r.playerId))
      out.push({
        id: `${r.token}:${p.id}`,
        title: name(p),
        effects: [
          { type: "mill", amount: r.damagePlaced, actorId: r.playerId },
        ],
      });
  const rams = on(RAMMING);
  if (rams.length)
    out.push({
      id: `${r.token}:ramming`,
      title: name(RAMMING),
      effects: rams.map((p) => ({ type: "discardPiece", id: p.id })),
    });
  if (r.marker === "crew:lightning" && r.undefended)
    out.push({
      id: `${r.token}:lightning`,
      title: name(LIGHTNING),
      effects: [C("scheme-of", { key: "thunderball", amount: 3 })],
    });
  return out;
}
/** Wrecker's Command, after Wrecker schemes. */
export function wreckingCrewSchemed(s: GameState, id: string): Effect[] {
  const wrecker = s.wreckingCrew ? crewVillain(s, "wrecker") : undefined;
  if (!wrecker || wrecker.id !== id) return [];
  const commands = s.attachments.filter(
    (a) =>
      a.code === WRECKERS_COMMAND && a.attachedTo === id && !isTextBlank(s, a),
  );
  const others = crewLiving(s)
    .filter((key) => key !== "wrecker")
    .map((key) => crewScheme(s, key))
    .filter((p): p is Piece => !!p);
  return commands.flatMap(() =>
    others.map((p) => ({ type: "threat", target: p.id, amount: 1 })),
  );
}
/** Distracting Taunts' Response, after your hero attacks Piledriver. */
export function wreckingCrewAfterHeroAttack(
  s: GameState,
  targetId: string,
  ports?: Pick<WreckingCrewPorts, "canPay">,
): Effect[] {
  const piledriver = s.wreckingCrew ? crewVillain(s, "piledriver") : undefined;
  if (!piledriver || piledriver.id !== targetId || s.player.form !== "hero")
    return [];
  return tauntOptions(s, ports).length
    ? [C("taunts-response", { actorId: s.activePlayerId, mandatory: false })]
    : [];
}
function tauntOptions(
  s: GameState,
  ports?: Pick<WreckingCrewPorts, "canPay">,
): Option[] {
  const piledriver = crewVillain(s, "piledriver");
  if (!piledriver || (ports && !ports.canPay(s, 2, ["physical", "physical"])))
    return [];
  return s.attachments
    .filter(
      (a) =>
        a.code === DISTRACTING_TAUNTS &&
        a.attachedTo === piledriver.id &&
        !isTextBlank(s, a),
    )
    .map((a) => ({
      id: a.id,
      label: `Spend physical and physical · discard ${name(a)}`,
      image: a.code,
      effects: [C("pay", { id: a.id })],
    }));
}

/** Hero Actions of Held Hostage, Magic Crowbar, Wrecker's Command, Ball and
 * Chain and Bulldozer's Helmet. */
export function wreckingCrewActions(
  s: GameState,
  p: Piece,
  ports?: Pick<WreckingCrewPorts, "canPay">,
): Option[] {
  if (
    !s.wreckingCrew ||
    !known(p) ||
    isTextBlank(s, p) ||
    s.player.form !== "hero" ||
    !s.attachments.some((a) => a.id === p.id)
  )
    return [];
  if (HELD_HOSTAGE.includes(p.code)) {
    const scheme = s.sideSchemes.find((q) => q.id === p.attachedTo);
    const key = scheme && crewSchemeKey(scheme.code);
    const v = key && crewVillain(s, key);
    if (!key || !v) return [];
    return [
      {
        id: "hostage",
        label: `${name(v)} attacks you · discard ${name(p)}`,
        image: p.code,
        effects: [
          C("activate", { key, kind: "attack", playerId: s.activePlayerId }),
          { type: "discardPiece", id: p.id },
        ],
      },
    ];
  }
  if (WEAPON_ACTIONS.includes(p.code)) {
    if (s.player.exhausted || !s.player.hand.length) return [];
    return [
      {
        id: "remove",
        label: `Exhaust your hero, discard 1 random card · discard ${name(p)}`,
        image: p.code,
        effects: [
          { type: "exhaust", id: "hero" },
          { type: "randomDiscard" },
          { type: "discardPiece", id: p.id },
        ],
      },
    ];
  }
  if (p.code === WRECKERS_COMMAND) {
    if (ports && !ports.canPay(s, 2, ["physical", "physical"])) return [];
    return [
      {
        id: "remove",
        label: `Spend physical and physical · discard ${name(p)}`,
        image: p.code,
        effects: [C("pay", { id: p.id })],
      },
    ];
  }
  return [];
}

/** 1 damage (or more) to a player's identity and each ally they control. */
function friendlyDamage(
  s: GameState,
  playerId: string,
  amount: number,
  ports: Pick<WreckingCrewPorts, "allies">,
): Effect[] {
  return [
    {
      type: "damage",
      target: "hero",
      amount,
      source: "encounter",
      actorId: playerId,
    },
    ...ports.allies(s, playerId).map((a) => ({
      type: "damage",
      target: a.id,
      amount,
      source: "encounter",
      actorId: playerId,
    })),
  ];
}

export function wreckingCrewReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const host = ATTACHES_TO[p.code];
  if (host) return [C("attach", { piece: p, key: host })];
  if (HELD_HOSTAGE.includes(p.code)) return [C("attach-scheme", { piece: p })];
  if (isTextBlank(s, p)) return [];
  const playerId = s.activePlayerId;
  const hero = s.player.form === "hero";
  if (BUDDY_SYSTEM.includes(p.code))
    return [
      C("pick", {
        kind: "least",
        title: name(p),
        then: [C("buddy", { playerId })],
      }),
    ];
  if (CHAOS.includes(p.code))
    return [C("chaos", { playerId, sourceCode: p.code })];
  if (GET_WRECKED.includes(p.code))
    return [
      C("pick", {
        kind: hero ? "least" : "most",
        title: name(p),
        then: [C("activate", { kind: hero ? "attack" : "scheme", playerId })],
      }),
    ];
  if (WAITING.includes(p.code)) return [C("waiting")];
  switch (p.code) {
    case CROWBAR_TOSS:
      return [
        C("activate", {
          key: "wrecker",
          kind: hero ? "attack" : "scheme",
          playerId,
        }),
        C("pick", { kind: "least", title: name(p), then: [C("set-active")] }),
      ];
    case MYSTICAL_LINK:
      return encounterSchemes(s).map((q) => ({
        type: "threat",
        target: q.id,
        amount: 2,
      }));
    case DEAD_MEAT:
      return [C("dead-meat", { playerId })];
    case PROJECTILES:
      return [C("projectiles", { playerId })];
    case LIGHTNING:
      return hero
        ? [
            C("activate", {
              key: "thunderball",
              kind: "attack",
              playerId,
              after: C("lightning"),
            }),
          ]
        : [C("scheme-threat", { kind: "most", amount: 3 })];
    case PROWESS:
      return [C("prowess-from", { sourceCode: p.code })];
    case HANDS:
      return [
        C("discard-highest", {
          playerId,
          types: ["support"],
          mode: "highest",
          fallback: [C("scheme-of", { active: true, amount: 2 })],
        }),
      ];
    case ESCAPE_PLAN:
      return [C("escape-plan", { playerId })];
    case PUMMEL:
      return [
        C("activate", {
          key: "piledriver",
          kind: hero ? "attack" : "scheme",
          playerId,
          toughBonus: true,
        }),
      ];
    case RESILIENCE:
      return [C("resilience", { sourceCode: p.code })];
    case BULL_RUSH:
      return [
        C("activate", {
          key: "bulldozer",
          kind: hero ? "attack" : "scheme",
          playerId,
          after: C("bull-rush", {
            playerId,
            by: hero ? "damage" : "threat",
          }),
        }),
      ];
    case HEADBUTT:
      return [C("headbutt", { playerId })];
    case CHARGE:
      return [C("charge", { playerId })];
    default:
      return [];
  }
}

export function wreckingCrewBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const a = s.attack;
  const playerId = a?.originalPlayerId || a?.targetPlayerId || s.activePlayerId;
  if (ESCAPED_CONVICT.includes(p.code))
    return [
      C("pick", {
        kind: "least",
        title: name(p),
        then: [
          C("set-active"),
          ...(a && s.player.form === "hero"
            ? [
                C("after-activation", {
                  kind: "attack",
                  playerId,
                  omitNormalBoost: true,
                }),
              ]
            : []),
        ],
      }),
    ];
  if (BUDDY_SYSTEM.includes(p.code))
    return [
      C("pick", { kind: "least", title: name(p), then: [C("set-active")] }),
    ];
  if (CHAOS.includes(p.code)) return a ? [C("chaos-boost", { playerId })] : [];
  if (WAITING.includes(p.code))
    return [
      C("pick", {
        kind: "least",
        title: name(p),
        then: [
          C("set-active"),
          C("after-activation", { kind: "scheme", playerId }),
        ],
      }),
    ];
  switch (p.code) {
    case MYSTICAL_LINK:
      return a ? [C("mystical-boost", { playerId })] : [];
    case PROJECTILES:
      return a ? [C("projectiles-boost")] : [];
    case HANDS:
      return [
        C("discard-highest", { playerId, types: ["support"], mode: "any" }),
      ];
    case ESCAPE_PLAN:
      return [C("escape-boost")];
    case RESILIENCE:
      return [
        {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: playerId,
        },
      ];
    default:
      // Numeric boost icons only.
      return [];
  }
}

export function resolveWreckingCrewEffect(
  s: GameState,
  e: Effect,
  ports: WreckingCrewPorts,
): boolean {
  if (!e.type.startsWith("crew:")) return false;
  const wc = s.wreckingCrew;
  switch (e.type) {
    case "crew:focus":
      if (!wc) break;
      wc.windows = (wc.windows || 0) + 1;
      crewFocus(s, e.key);
      break;
    case "crew:focus-back":
      wreckingCrewCloseWindow(s, e.key);
      break;
    case "crew:breakout": {
      if (!wc || over(s)) break;
      wc.holdHits = true;
      ports.log(
        s,
        "Breakout: 1 threat on each side scheme, then the active counter moves to the villain whose scheme has the most threat.",
        "bad",
      );
      ports.queue(
        s,
        ...encounterSchemes(s).map((p) => ({
          type: "threat",
          target: p.id,
          amount: 1,
        })),
        C("pick", {
          kind: "most",
          title: "Breakout",
          then: [C("set-active")],
          actorId: s.firstPlayerId,
        }),
        C("release-hits", { mandatory: true }),
      );
      break;
    }
    case "crew:release-hits":
      if (wc) wc.holdHits = false;
      break;
    case "crew:pick": {
      if (!wc || over(s)) break;
      const candidates = crewByThreat(s, e.kind);
      if (!candidates.length) break;
      const fill = (key: CrewKey) =>
        ((e.then as Effect[]) || []).map((x) => ({ ...x, key }));
      if (candidates.length === 1) {
        ports.queue(s, ...fill(candidates[0]));
        break;
      }
      ports.choose(
        s,
        e.title || "Tie",
        `Choose the villain whose side scheme has the ${e.kind} threat.`,
        candidates.map((key) => ({
          id: key,
          label: name(crewVillain(s, key)!),
          detail: `${threatOn(s, key)} threat on ${name(CREW_SCHEMES[key])}`,
          image: crewVillain(s, key)!.code,
          effects: fill(key),
        })),
      );
      break;
    }
    case "crew:set-active":
      setActive(s, e.key, ports);
      break;
    case "crew:activate": {
      const v = wc && e.key ? crewVillain(s, e.key) : undefined;
      if (!wc || !v || !alive(s, e.playerId) || over(s)) {
        if (e.after)
          ports.queue(s, {
            ...e.after,
            performed: false,
            damagePlaced: 0,
            threatPlaced: 0,
          });
        break;
      }
      if (wc.focus !== e.key) {
        ports.queue(
          s,
          C("focus", { key: e.key, mandatory: true }),
          { ...e },
          C("focus-back", { key: wc.focus, mandatory: true }),
        );
        break;
      }
      ports.activate(s, {
        enemyId: v.id,
        playerId: e.playerId,
        kind: e.kind,
        modifier: (Number(e.modifier) || 0) + (e.toughBonus && v.tough ? 2 : 0),
        ...(e.omitNormalBoost ? { omitNormalBoost: true } : {}),
        ...(e.after ? { after: e.after } : {}),
      });
      break;
    }
    case "crew:after-activation": {
      if (!wc || !e.key) break;
      const effect = C("activate", {
        key: e.key,
        kind: e.kind,
        playerId: e.playerId,
        ...(e.omitNormalBoost ? { omitNormalBoost: true } : {}),
      });
      const activation = s.attack || s.scheming;
      if (activation) (activation.afterActivation ||= []).push(effect);
      else ports.queue(s, effect);
      break;
    }
    case "crew:hit": {
      if (!wc) break;
      // The scheme stays pending until its threat is reset, so the
      // continuous check does not trigger it again in the meantime.
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p || p.counters < 10 || isTextBlank(s, p) || over(s)) {
        wc.pending = (wc.pending || []).filter((id) => id !== e.id);
        break;
      }
      const players = seats(s);
      let effects: Effect[] = [];
      switch (p.code) {
        case CREW_SCHEMES.wrecker:
          ports.log(
            s,
            "Hard Hitter: 2 damage to each friendly character.",
            "bad",
          );
          effects = players.flatMap((id) => friendlyDamage(s, id, 2, ports));
          break;
        case CREW_SCHEMES.thunderball:
          ports.log(
            s,
            "Gamma Blast: each friendly character is stunned.",
            "bad",
          );
          effects = players.flatMap((id) => [
            { type: "status", target: "hero", status: "stunned", actorId: id },
            ...ports.allies(s, id).map((a) => ({
              type: "status",
              target: a.id,
              status: "stunned",
              actorId: id,
            })),
          ]);
          break;
        case CREW_SCHEMES.piledriver:
          ports.log(
            s,
            "Pile Drive: each player discards their highest-cost upgrade or support.",
            "bad",
          );
          effects = players.map((id) =>
            C("discard-highest", {
              playerId: id,
              types: ["upgrade", "support"],
              mode: "highest",
              actorId: id,
            }),
          );
          break;
        case CREW_SCHEMES.bulldozer:
          ports.log(
            s,
            "Charge!: each player discards the top 10 cards of their deck.",
            "bad",
          );
          effects = players.map((id) => ({
            type: "mill",
            amount: 10,
            actorId: id,
          }));
          break;
      }
      ports.queue(s, ...effects, C("reset", { id: p.id, mandatory: true }));
      break;
    }
    case "crew:reset": {
      if (wc) wc.pending = (wc.pending || []).filter((id) => id !== e.id);
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p || p.counters <= 3) break;
      p.counters = 3;
      ports.log(s, `Remove all but 3 threat from ${name(p)}.`);
      break;
    }
    case "crew:attach": {
      const p = e.piece as Piece;
      const host = e.key ? crewVillain(s, e.key) : undefined;
      if (host) ports.attach(s, p, host.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "crew:attach-scheme": {
      const p = e.piece as Piece;
      const scheme = wc ? crewScheme(s, wc.active) : undefined;
      if (scheme) ports.attach(s, p, scheme.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "crew:buddy": {
      if (!wc || !e.key) break;
      const count = crewLiving(s).length === 1 ? 2 : 1;
      ports.queue(
        s,
        C("reveal-top", { key: e.key, remaining: count, playerId: e.playerId }),
      );
      break;
    }
    case "crew:reveal-top": {
      if (!wc || over(s) || !(Number(e.remaining) > 0)) break;
      if (!alive(s, e.playerId) || wc.defeated.includes(e.key)) break;
      const p = takeTop(s, e.key, ports);
      if (!p) break;
      ports.log(
        s,
        `Buddy System reveals the top card of ${name(crewVillain(s, e.key)!)}'s deck.`,
      );
      ports.queue(s, { ...e, remaining: Number(e.remaining) - 1 });
      ports.reveal(s, p, e.playerId);
      break;
    }
    case "crew:chaos": {
      if (!wc || !alive(s, e.playerId)) break;
      const upgrades = controlled(s, e.playerId, ["upgrade"], ports);
      const all = seatView(s, e.playerId).player.inPlay.filter(
        (p) => typeOf(p) === "upgrade",
      );
      if (!all.length) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      const scheme = crewScheme(s, wc.active);
      const options: Option[] = [];
      if (upgrades.length)
        options.push({
          id: "discard",
          label: "Discard an upgrade you control",
          effects: [
            C("discard-highest", {
              playerId: e.playerId,
              types: ["upgrade"],
              mode: "any",
            }),
          ],
        });
      if (scheme)
        options.push({
          id: "threat",
          label: `Place ${all.length} threat on ${name(scheme)}`,
          image: scheme.code,
          effects: [{ type: "threat", target: scheme.id, amount: all.length }],
        });
      if (options.length > 1)
        ports.choose(
          s,
          "Chaos in the Prison",
          `${ports.heroName(s, e.playerId)}: discard an upgrade, or place 1 threat per upgrade you control.`,
          options,
        );
      else if (options.length) ports.queue(s, ...options[0].effects);
      break;
    }
    case "crew:chaos-boost": {
      const a = s.attack;
      if (!a || a.defender !== "none" || a.eventDefense) break;
      ports.queue(
        s,
        C("discard-highest", {
          playerId: e.playerId,
          types: ["upgrade"],
          mode: "any",
        }),
      );
      break;
    }
    case "crew:discard-highest": {
      if (!alive(s, e.playerId)) break;
      const candidates = controlled(s, e.playerId, e.types as string[], ports);
      if (!candidates.length) {
        if (e.fallback) ports.queue(s, ...(e.fallback as Effect[]));
        break;
      }
      const top = Math.max(...candidates.map((p) => ports.cost(p)));
      const pool =
        e.mode === "highest"
          ? candidates.filter((p) => ports.cost(p) === top)
          : candidates;
      if (pool.length === 1) {
        ports.discardPiece(s, pool[0].id);
        break;
      }
      ports.choose(
        s,
        "Discard",
        `${ports.heroName(s, e.playerId)}: choose the ${(e.types as string[]).join(" or ")} to discard.`,
        pool.map((p) => ({
          id: p.id,
          label: name(p),
          image: p.code,
          effects: [{ type: "discardPiece", id: p.id }],
        })),
      );
      break;
    }
    case "crew:scheme-threat": {
      // The side scheme with the most or least threat.
      const schemes = encounterSchemes(s);
      if (!schemes.length) break;
      const values = schemes.map((p) => p.counters);
      const target =
        e.kind === "most" ? Math.max(...values) : Math.min(...values);
      const tied = schemes.filter((p) => p.counters === target);
      const place = (p: Piece) => [
        { type: "threat", target: p.id, amount: Number(e.amount) || 0 },
      ];
      if (tied.length === 1) ports.queue(s, ...place(tied[0]));
      else
        ports.choose(
          s,
          "Side scheme",
          `Choose the side scheme with the ${e.kind} threat.`,
          tied.map((p) => ({
            id: p.id,
            label: name(p),
            image: p.code,
            effects: place(p),
          })),
        );
      break;
    }
    case "crew:scheme-of": {
      const key: CrewKey | undefined = e.active ? wc?.active : e.key;
      const scheme = key ? crewScheme(s, key) : undefined;
      if (scheme)
        ports.queue(s, {
          type: "threat",
          target: scheme.id,
          amount: Number(e.amount) || 0,
        });
      break;
    }
    case "crew:waiting": {
      const v = crewActiveVillain(s);
      if (!v) break;
      ports.queue(
        s,
        { type: "heal", target: v.id, amount: 3 },
        { type: "status", target: v.id, status: "tough" },
      );
      break;
    }
    case "crew:dead-meat": {
      const characters = seats(s).flatMap((id) => [
        ...(seatView(s, id).player.form === "hero" ? [`hero:${id}`] : []),
        ...ports.allies(s, id).map((a) => a.id),
      ]);
      if (!characters.length) break;
      const values = characters.map((t) => ports.remaining(s, t));
      const low = Math.min(...values);
      const tied = characters.filter((t) => ports.remaining(s, t) === low);
      const hit = (target: string) => [
        C("dead-meat-hit", { target, playerId: e.playerId }),
      ];
      if (tied.length === 1) ports.queue(s, ...hit(tied[0]));
      else
        ports.choose(
          s,
          "You're Dead Meat!",
          "Choose the hero or ally with the fewest remaining hit points.",
          tied.map((target) => {
            const seat = target.startsWith("hero:") ? target.slice(5) : "";
            const ally = seat ? undefined : findAlly(s, target, ports);
            return {
              id: target,
              label: seat ? ports.heroName(s, seat) : name(ally || target),
              ...(ally ? { image: ally.code } : {}),
              effects: hit(target),
            };
          }),
        );
      break;
    }
    case "crew:dead-meat-hit":
      ports.queue(
        s,
        { type: "damage", target: e.target, amount: 1, source: "encounter" },
        C("dead-meat-check", { target: e.target }),
      );
      break;
    case "crew:dead-meat-check": {
      const target = String(e.target);
      const defeated = target.startsWith("hero:")
        ? !alive(s, target.slice(5)) ||
          seatView(s, target.slice(5)).player.hp <= 0
        : !ports.inPlay(s, target);
      if (defeated)
        ports.queue(s, C("scheme-of", { key: "wrecker", amount: 3 }));
      break;
    }
    case "crew:projectiles":
      if (alive(s, e.playerId))
        ports.queue(s, ...friendlyDamage(s, e.playerId, 1, ports));
      break;
    case "crew:projectiles-boost": {
      const a = s.attack;
      if (!a || !a.defender || a.defender === "none") break;
      ports.queue(s, {
        type: "damage",
        target:
          a.defender === "hero"
            ? `hero:${a.targetPlayerId || s.activePlayerId}`
            : a.defender,
        amount: 1,
        source: "encounter",
      });
      break;
    }
    case "crew:lightning":
      // Marks Lightning Blast's attack; its response reads the receipt.
      break;
    case "crew:prowess-from": {
      const schemes = encounterSchemes(s);
      if (schemes.length < 2) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      const low = Math.min(...schemes.map((p) => p.counters));
      const tied = schemes.filter((p) => p.counters === low);
      const next = (p: Piece) => [
        C("prowess-to", { from: p.id, sourceCode: e.sourceCode }),
      ];
      if (tied.length === 1) ports.queue(s, ...next(tied[0]));
      else
        ports.choose(
          s,
          "Tactical Prowess",
          "Choose the side scheme with the least threat.",
          tied.map((p) => ({
            id: p.id,
            label: name(p),
            image: p.code,
            effects: next(p),
          })),
        );
      break;
    }
    case "crew:prowess-to": {
      const others = encounterSchemes(s).filter((p) => p.id !== e.from);
      if (!others.length) {
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      const high = Math.max(...others.map((p) => p.counters));
      const tied = others.filter((p) => p.counters === high);
      const move = (p: Piece) => [
        C("prowess-move", { from: e.from, to: p.id, sourceCode: e.sourceCode }),
      ];
      if (tied.length === 1) ports.queue(s, ...move(tied[0]));
      else
        ports.choose(
          s,
          "Tactical Prowess",
          "Choose the side scheme with the most threat.",
          tied.map((p) => ({
            id: p.id,
            label: name(p),
            image: p.code,
            effects: move(p),
          })),
        );
      break;
    }
    case "crew:prowess-move": {
      const from = s.sideSchemes.find((p) => p.id === e.from);
      const to = s.sideSchemes.find((p) => p.id === e.to);
      let triggered = false;
      if (from && to) {
        const amount = from.counters;
        from.counters = 0;
        to.counters += amount;
        ports.log(
          s,
          `Tactical Prowess moves ${amount} threat from ${name(from)} to ${name(to)}.`,
          "bad",
        );
        triggered =
          amount > 0 &&
          to.counters >= 10 &&
          !!crewSchemeKey(to.code) &&
          !isTextBlank(s, to);
      }
      if (!triggered)
        ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
      break;
    }
    case "crew:escape-plan": {
      if (!alive(s, e.playerId)) break;
      const confused = seatView(s, e.playerId).player.confused;
      ports.queue(
        s,
        {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: e.playerId,
        },
        ...(confused
          ? [
              C("activate", {
                key: "piledriver",
                kind: "scheme",
                playerId: e.playerId,
              }),
            ]
          : []),
      );
      break;
    }
    case "crew:escape-boost": {
      const v = crewActiveVillain(s);
      if (!v || !wc) break;
      if (v.tough) {
        const scheme = crewScheme(s, wc.active);
        if (scheme)
          ports.queue(s, { type: "threat", target: scheme.id, amount: 2 });
      } else ports.queue(s, { type: "status", target: v.id, status: "tough" });
      break;
    }
    case "crew:resilience": {
      let removed = 0;
      for (const v of crewVillains(s)) {
        if (v.stunned || v.confused) removed++;
        v.stunned = false;
        v.confused = false;
        delete v.stunCards;
        delete v.confuseCards;
      }
      if (removed)
        ports.log(
          s,
          "Uncanny Resilience: each villain's stunned and confused status cards are removed.",
          "bad",
        );
      else ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
      break;
    }
    case "crew:bull-rush": {
      const amount =
        e.by === "damage"
          ? Number(e.damagePlaced) || 0
          : Number(e.threatPlaced) || 0;
      if (amount > 0 && alive(s, e.playerId))
        ports.queue(s, { type: "mill", amount, actorId: e.playerId });
      break;
    }
    case "crew:headbutt": {
      if (!alive(s, e.playerId)) break;
      const p = ports.randomDiscard(s, e.playerId);
      if (!p) break;
      const cost = ports.cost(p);
      ports.log(s, `Headbutt discards ${name(p)} (cost ${cost}).`, "bad");
      if (!cost) break;
      if (seatView(s, e.playerId).player.form === "hero")
        ports.queue(s, {
          type: "damage",
          target: "hero",
          amount: cost,
          source: "encounter",
          actorId: e.playerId,
        });
      else ports.queue(s, C("scheme-of", { key: "bulldozer", amount: cost }));
      break;
    }
    case "crew:charge": {
      if (!alive(s, e.playerId)) break;
      const bulldozer = crewVillain(s, "bulldozer");
      const x = bulldozer
        ? Math.max(0, ports.villainStat(s, bulldozer, "attack", e.playerId))
        : 0;
      if (!x) break;
      const cards = ports.mill(s, e.playerId, x);
      const types = new Set(cards.map((p) => typeOf(p)).filter(Boolean));
      ports.log(
        s,
        `Leading the Charge discards ${cards.length} card${cards.length === 1 ? "" : "s"} of ${types.size} different type${types.size === 1 ? "" : "s"}.`,
        "bad",
      );
      if (types.size)
        ports.queue(
          s,
          C("scheme-of", { key: "bulldozer", amount: types.size }),
        );
      break;
    }
    case "crew:mystical-boost": {
      const a = s.attack;
      const wrecker = crewVillain(s, "wrecker");
      if (!a || !wrecker || a.attacker !== wrecker.id) break;
      const scheme = crewScheme(s, "wrecker");
      if (!scheme) {
        ports.queue(s, C("mystical-atk"));
        break;
      }
      ports.choose(
        s,
        "Mystical Link",
        `${ports.heroName(s, e.playerId)}: Wrecker gets +3 ATK for this activation unless you place 2 threat on ${name(scheme)}.`,
        [
          {
            id: "threat",
            label: `Place 2 threat on ${name(scheme)}`,
            image: scheme.code,
            effects: [{ type: "threat", target: scheme.id, amount: 2 }],
          },
          {
            id: "attack",
            label: "Wrecker gets +3 ATK for this activation",
            image: wrecker.code,
            effects: [C("mystical-atk")],
          },
        ],
      );
      break;
    }
    case "crew:mystical-atk": {
      const a = s.attack;
      const wrecker = crewVillain(s, "wrecker");
      if (!a || !wrecker || a.attacker !== wrecker.id) break;
      a.modifier = (a.modifier || 0) + 3;
      ports.log(
        s,
        "Mystical Link: Wrecker gets +3 ATK for this activation.",
        "bad",
      );
      break;
    }
    case "crew:taunts-response": {
      const options = tauntOptions(s, ports);
      if (!options.length) break;
      ports.choose(s, "Distracting Taunts", "Discard Distracting Taunts?", [
        ...options,
        { id: "pass", label: "Do not respond", effects: [] },
      ]);
      break;
    }
    case "crew:pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) throw Error(`${name(e.id)} is no longer attached.`);
      ports.pay(
        s,
        2,
        ["physical", "physical"],
        [{ type: "discardPiece", id: p.id }],
        name(p),
        true,
      );
      break;
    }
    default:
      return false;
  }
  return true;
}

/** Upgrades or supports a player controls that can be discarded. */
function controlled(
  s: GameState,
  playerId: string,
  types: string[],
  ports: Pick<WreckingCrewPorts, "canDiscard">,
): Piece[] {
  return seatView(s, playerId).player.inPlay.filter(
    (p) => types.includes(typeOf(p) || "") && ports.canDiscard(s, p),
  );
}
function findAlly(
  s: GameState,
  id: string,
  ports: Pick<WreckingCrewPorts, "allies">,
): Piece | undefined {
  return seats(s)
    .flatMap((seat) => ports.allies(s, seat))
    .find((a) => a.id === id);
}
