/**
 * Echo, Fear No Evil's second hero: Maya Lopez's tucked events, her
 * signature cards, Raised by the Kingpin and Kingpin's nemesis set.
 *
 * Rules: the Fear No Evil rules insert and the printed card texts. Watch and
 * Learn tucks an aspect or basic event that any player plays under Echo,
 * from that player's discard pile, keeping no more than three. Tucked cards
 * are faceup and not in play, and they keep their owner. Photographic
 * Reflexes is discarded from hand to play a tucked event as if it were in
 * hand, for 2 less, whenever that event could be played from hand; the event
 * then goes to its owner's discard pile, and Watch and Learn cannot trigger
 * for it.
 */
import { card } from "./card-definitions.js";
import { identityTextBlank, isTextBlank } from "./card-text.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { controller, playerOrder, seatView } from "./team.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

export const ECHO_ID = "echo";
export const ECHO_HERO = "60037a";
export const MAYA_LOPEZ = "60037b";
export const DAREDEVIL_ALLY = "60039";
export const PHOTOGRAPHIC_REFLEXES: readonly string[] = [
  "60040a",
  "60040b",
  "60040c",
];
export const STUDY_THE_TAPE = "60041";
export const THE_REZ = "60042";
export const AMERICAN_SIGN_LANGUAGE = "60043";
export const CHOREOGRAPHY = "60044";
export const ECHOS_KATANA = "60045";
export const IMPROVISATION = "60046";
export const MUSCLE_MEMORY = "60047";
export const RAISED_BY_THE_KINGPIN = "60060";
export const KINGPIN = "60061";
export const MASTER_MANIPULATOR = "60062";
export const KINGPINS_HENCHMAN = "60063";
export const PAWN_OF_THE_KINGPIN = "60064";
/** Watch and Learn keeps no more than three tucked cards. */
export const ECHO_TUCK_LIMIT = 3;
/** Every printed face this module implements. */
export const ECHO_SCRIPT_CODES: readonly string[] = [
  ECHO_HERO,
  MAYA_LOPEZ,
  DAREDEVIL_ALLY,
  ...PHOTOGRAPHIC_REFLEXES,
  STUDY_THE_TAPE,
  THE_REZ,
  AMERICAN_SIGN_LANGUAGE,
  CHOREOGRAPHY,
  ECHOS_KATANA,
  IMPROVISATION,
  MUSCLE_MEMORY,
  RAISED_BY_THE_KINGPIN,
  KINGPIN,
  MASTER_MANIPULATOR,
  KINGPINS_HENCHMAN,
  PAWN_OF_THE_KINGPIN,
];

export interface EchoTarget {
  id: string;
  label: string;
  code?: string;
}
export interface EchoActivation {
  enemyId: string;
  playerId: string;
  kind: "attack" | "scheme";
  modifier: number;
}
export interface EchoPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** A deck is searched: hidden information is revealed first. */
  revealHidden(s: GameState): void;
  shuffleDeck(s: GameState): void;
  enemies(s: GameState, attack: boolean): EchoTarget[];
  schemes(s: GameState, thwart: boolean): EchoTarget[];
  /** Resolve attack effects; a stunned identity removes its stun instead. */
  attack(s: GameState, effects: Effect[], after: Effect[]): void;
  heroAttack(s: GameState): number;
  /** The identity has damage that can be healed. */
  damaged(s: GameState): boolean;
  heroName(s: GameState, playerId: string): string;
  activate(s: GameState, request: EchoActivation): void;
  giveObligation(s: GameState, p: Piece, playerId: string): void;
  removeFromGame(s: GameState, id: string): void;
  /** The player's nemesis minion from the encounter deck, its discard pile
   * or the set-aside nemesis set. */
  takeNemesisMinion(s: GameState, playerId: string): Piece | undefined;
  putMinion(s: GameState, p: Piece, playerId: string): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
}

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  ...args,
  type,
});
const X = (type: string, args: Record<string, unknown> = {}) =>
  E(`echo:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const name = (p: Piece | string) => card(p).name;
const traitsOf = (p: Piece | string) =>
  (card(p).traits || "").replace(/\.$/, "").split(/\.\s*/).filter(Boolean);
const live = (s: GameState, p: Piece) => !isTextBlank(s, p);
const alive = (s: GameState, playerId: string) =>
  s.players.some((seat) => seat.id === playerId && !seat.eliminated);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const printedCost = (p: Piece | string) =>
  Math.max(0, Number(card(p).cost) || 0);
const ASPECTS = [
  "aggression",
  "justice",
  "leadership",
  "protection",
  "pool",
  "basic",
];
export const isReflexes = (p: Piece | string) =>
  PHOTOGRAPHIC_REFLEXES.includes(typeof p === "string" ? p : p.code);
/** An aspect or basic event (Watch and Learn, Study the Tape...). */
export const isAspectOrBasicEvent = (p: Piece | string) =>
  card(p).type_code === "event" && ASPECTS.includes(card(p).faction_code || "");

/** The identity's printed text is active. */
const identityLive = (view: GameState) =>
  view.heroId === ECHO_ID && !identityTextBlank(view);
/** Its triggered abilities may be used. */
const triggersLive = (view: GameState) =>
  identityLive(view) && !deadpoolTriggeredBlocked(view);
/** The Maya Lopez player (the player whose identity is Echo). */
const echoSeat = (s: GameState) =>
  playerOrder(s).find((seat) => seatView(s, seat).heroId === ECHO_ID);
/** A tucked card that leaves goes to its owner's discard pile. */
function discardToOwner(s: GameState, p: Piece) {
  const owner = s.players.find((seat) => seat.id === p.ownerId);
  if (owner?.eliminated) s.removed.push(p);
  else (owner ? seatView(s, owner) : s).player.discard.push(p);
}
/** Read and clear a flag set on any seat. */
function takeSeatFlag(s: GameState, key: string): boolean {
  let found = false;
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    if (flags[key]) found = true;
    delete flags[key];
  }
  return found;
}

// ---------------------------------------------------------------------------
// Tucked events and Photographic Reflexes
// ---------------------------------------------------------------------------

export const echoTucked = (s: GameState): Piece[] => s.player.echoTucked || [];
export const echoInTucked = (s: GameState, id: string) =>
  !!s.player.echoTucked?.some((p) => p.id === id);
/** The copy of Photographic Reflexes discarded to play a tucked event: the
 * first one in hand. It cannot also pay for that event. */
export const echoReflexesInHand = (s: GameState): Piece | undefined =>
  s.player.hand.find(isReflexes);
/** Paying for a tucked event: the Photographic Reflexes it discards. */
export function echoReservedReflexes(
  s: GameState,
  exclude?: string,
): string | undefined {
  return exclude && echoInTucked(s, exclude)
    ? echoReflexesInHand(s)?.id
    : undefined;
}
/** Photographic Reflexes: in hero form, with a copy in hand, each tucked
 * event can be played as if it were in hand. */
export function echoStoredPlayable(s: GameState): Piece[] {
  return s.heroId === ECHO_ID &&
    s.player.form === "hero" &&
    !!echoReflexesInHand(s)
    ? [...echoTucked(s)]
    : [];
}
/** Take a tucked event to play it, discarding Photographic Reflexes from
 * hand. Watch and Learn cannot trigger for that event. */
export function echoTakeTucked(
  s: GameState,
  id: string,
  ports: Pick<EchoPorts, "log">,
): Piece | undefined {
  const tucked = s.player.echoTucked || [];
  const i = tucked.findIndex((p) => p.id === id);
  const reflexes = echoReflexesInHand(s);
  if (i < 0 || !reflexes) return undefined;
  s.player.hand.splice(s.player.hand.indexOf(reflexes), 1);
  discardToOwner(s, reflexes);
  s.flags[`echoNoWatch:${id}`] = true;
  ports.log(
    s,
    `Photographic Reflexes is discarded to play ${name(tucked[i])} tucked under Echo.`,
    "good",
  );
  return tucked.splice(i, 1)[0];
}
/** Photographic Reflexes has no play ability of its own. */
export function echoPlayRestriction(s: GameState, p: Piece): string | null {
  return isReflexes(p)
    ? "Discard Photographic Reflexes from your hand to play an event tucked under Echo."
    : null;
}
const DISCOUNT = "echoDaredevilDiscount";
/** Daredevil (ally): the next event you play this round costs less. */
function daredevilDiscount(s: GameState): number {
  const [round, amount] = String(s.flags[DISCOUNT] || "")
    .split(":")
    .map(Number);
  return round === s.round ? amount || 0 : 0;
}
/** Photographic Reflexes plays a tucked event for 2 less; Daredevil makes
 * the next event cheaper. */
export function echoCostModifier(
  s: GameState,
  c: Card,
  physical?: Piece,
): number {
  return (
    (physical && echoInTucked(s, physical.id) ? -2 : 0) -
    (c.type_code === "event" ? daredevilDiscount(s) : 0)
  );
}
/** An event was played: Daredevil's reduction is used. */
export function echoCardPlayed(s: GameState, p: Piece) {
  if (card(p).type_code === "event") delete s.flags[DISCOUNT];
}
/** American Sign Language: a wild resource for an event played by any
 * player, from any Echo player in hero form. */
export function echoSignLanguageSources(
  s: GameState,
  targetCode?: string,
): PaymentSource[] {
  if (!targetCode || card(targetCode).type_code !== "event") return [];
  return playerOrder(s).flatMap((seat) => {
    const view = seatView(s, seat);
    if (view.player.form !== "hero") return [];
    const local = seat.id === s.activePlayerId;
    return view.player.inPlay
      .filter(
        (p) =>
          p.code === AMERICAN_SIGN_LANGUAGE &&
          !p.exhausted &&
          !isTextBlank(view, p),
      )
      .map((p) => ({
        id: local ? p.id : `alliance:${seat.id}:${p.id}`,
        ...(local ? {} : { localId: p.id, playerId: seat.id }),
        name: name(p),
        code: p.code,
        resources: ["wild"],
        description: "Hero Resource · exhaust · 1 wild for an event",
        kind: "ability" as const,
      }));
  });
}

// ---------------------------------------------------------------------------
// Triggered abilities
// ---------------------------------------------------------------------------

/** Watch and Learn (hero side, Response): after a player plays an aspect or
 * basic event, tuck it under Echo from that player's discard pile. */
export function echoEventFinished(s: GameState, p: Piece): Effect[] {
  if (takeSeatFlag(s, `echoNoWatch:${p.id}`)) return [];
  if (!isAspectOrBasicEvent(p)) return [];
  const ownerId = p.ownerId || s.activePlayerId;
  return playerOrder(s)
    .filter((seat) => {
      const view = seatView(s, seat);
      return triggersLive(view) && view.player.form === "hero";
    })
    .map((seat) => X("watch", { id: p.id, ownerId, actorId: seat.id }));
}
/** Practice Makes Perfect (alter-ego side, Interrupt): when you change to
 * hero form, search your deck for an aspect or basic event. */
export function echoBeforeFlip(
  s: GameState,
  counts: boolean,
  target?: string,
): Effect[] | null {
  if (
    !triggersLive(s) ||
    s.player.form !== "alter" ||
    target === "alter" ||
    !s.player.deck.some(isAspectOrBasicEvent)
  )
    return null;
  return [X("practice", { counts, target })];
}
/** Echo's Katana and Improvisation: Hero Responses after you play an
 * event. Each card responds once to each event. */
export function echoAfterEventOptions(
  s: GameState,
  p: Piece,
  used: string[],
  after: Effect[],
  ports: Pick<EchoPorts, "enemies" | "schemes">,
): Option[] {
  if (
    s.player.form !== "hero" ||
    card(p).type_code !== "event" ||
    deadpoolTriggeredBlocked(s)
  )
    return [];
  const again = (id: string) =>
    after.map((e) => ({ ...e, echoUsed: [...used, id] }));
  const result: Option[] = [];
  const cost = printedCost(p);
  if (cost > 0 && ports.enemies(s, true).length)
    for (const k of s.player.inPlay.filter(
      (q) =>
        q.code === ECHOS_KATANA &&
        !q.exhausted &&
        live(s, q) &&
        !used.includes(q.id),
    ))
      result.push(
        O(
          `katana:${k.id}`,
          `Echo's Katana · deal ${cost} damage (piercing)`,
          [
            E("exhaust", { id: k.id }),
            X("katana", { amount: cost }),
            ...again(k.id),
          ],
          k.code,
        ),
      );
  const traits = traitsOf(p);
  const attack = traits.includes("Attack");
  const defense = traits.includes("Defense");
  const thwart = traits.includes("Thwart");
  const parts = [
    ...(attack ? ["heal 1"] : []),
    ...(defense ? ["remove 1 threat"] : []),
    ...(thwart ? ["deal 1 damage"] : []),
  ];
  if (parts.length)
    for (const q of s.player.inPlay.filter(
      (q) => q.code === IMPROVISATION && live(s, q) && !used.includes(q.id),
    ))
      result.push(
        O(
          `improvisation:${q.id}`,
          `Improvisation · ${parts.join(", ")}`,
          [X("improvisation", { attack, defense, thwart }), ...again(q.id)],
          q.code,
        ),
      );
  return result;
}
/** Daredevil (ally): after he uses a basic power, the next event you play
 * this round costs 1 less. */
export function echoAfterAllyBasic(s: GameState, p: Piece): Effect[] {
  return p.code === DAREDEVIL_ALLY && live(s, p) && !deadpoolTriggeredBlocked(s)
    ? [X("daredevil", { id: p.id })]
    : [];
}
/** Raised by the Kingpin: after you thwart, the threat removed is placed on
 * it; with 4 or more, it is removed from the game. */
export function echoAfterThwart(s: GameState, removed: number): Effect[] {
  if (!(removed > 0)) return [];
  return s.player.inPlay
    .filter((q) => q.code === RAISED_BY_THE_KINGPIN && live(s, q))
    .map((q) => X("raised-threat", { id: q.id, amount: removed }));
}

// ---------------------------------------------------------------------------
// Abilities and events
// ---------------------------------------------------------------------------

/** The highest cost among the cards tucked under Echo. */
const rezAmount = (s: GameState) =>
  Math.max(0, ...echoTucked(s).map(printedCost));
export function echoAbilityOptions(
  s: GameState,
  id: string,
  ports: EchoPorts,
): Option[] {
  const p = s.player.inPlay.find((q) => q.id === id);
  if (!p || !live(s, p) || deadpoolTriggeredBlocked(s)) return [];
  if (p.code === THE_REZ && !p.exhausted && s.player.form === "alter") {
    const x = rezAmount(s);
    return x > 0 && ports.damaged(s)
      ? [
          O(
            "rez",
            `The Rez · heal ${x} damage from Maya Lopez`,
            [E("exhaust", { id }), E("heal", { target: "hero", amount: x })],
            p.code,
          ),
        ]
      : [];
  }
  if (p.code === CHOREOGRAPHY && !p.exhausted) {
    const alter = s.player.form === "alter";
    return s.player.discard.some(isAspectOrBasicEvent) || alter
      ? [
          O(
            "choreography",
            `Choreography · shuffle an aspect or basic event from your discard pile into your deck${alter ? " and draw 1" : ""}`,
            [E("exhaust", { id }), X("choreography")],
            p.code,
          ),
        ]
      : [];
  }
  if (
    p.code === MUSCLE_MEMORY &&
    !p.exhausted &&
    s.player.form === "hero" &&
    echoTucked(s).length
  )
    return [
      O(
        "muscle",
        "Muscle Memory · add an event tucked under Echo to your hand",
        [E("exhaust", { id }), X("muscle")],
        p.code,
      ),
    ];
  return [];
}
export function echoEvent(_s: GameState, p: Piece): Effect[] | null {
  return p.code === STUDY_THE_TAPE ? [X("study")] : null;
}

// ---------------------------------------------------------------------------
// Raised by the Kingpin and Kingpin's nemesis set
// ---------------------------------------------------------------------------

/** A card titled Kingpin in play: Echo's nemesis minion first, then a
 * minion or villain with that title. */
function kingpinInPlay(s: GameState): Piece | undefined {
  return (
    s.minions.find((q) => q.code === KINGPIN) ||
    s.minions.find((q) => name(q) === "Kingpin") ||
    (s.villain && name(s.villain) === "Kingpin" ? s.villain : undefined)
  );
}
/** The player whose identity or card deals this damage. */
function sourcePlayer(s: GameState, source: string): string | undefined {
  if (!source || source === "hero") return s.activePlayerId;
  if (source.startsWith("hero:")) return source.slice(5);
  return (
    controller(s, source)?.id ||
    s.resolving.find((p) => p.id === source)?.ownerId
  );
}
/** Master Manipulator and Kingpin's Henchman: Kingpin cannot take damage.
 * Raised by the Kingpin: its player cannot deal damage to Kingpin. */
export function echoKingpinImmune(
  s: GameState,
  target: string,
  source: string,
): boolean {
  const enemy =
    s.villain && target === s.villain.id
      ? s.villain
      : s.minions.find((q) => q.id === target);
  if (!enemy || name(enemy) !== "Kingpin") return false;
  if (s.sideSchemes.some((q) => q.code === MASTER_MANIPULATOR && live(s, q)))
    return true;
  if (s.minions.some((q) => q.code === KINGPINS_HENCHMAN && live(s, q)))
    return true;
  const playerId = sourcePlayer(s, source);
  if (!playerId || !alive(s, playerId)) return false;
  const view = seatView(s, playerId);
  return view.player.inPlay.some(
    (q) => q.code === RAISED_BY_THE_KINGPIN && !isTextBlank(view, q),
  );
}
/** Kingpin (Echo's nemesis minion): when he would attack the Maya Lopez
 * player, he schemes instead. */
export function echoKingpinSchemesInstead(
  s: GameState,
  enemyId: string,
): boolean {
  if (s.heroId !== ECHO_ID) return false;
  const p = s.minions.find((q) => q.id === enemyId && q.code === KINGPIN);
  return !!p && live(s, p);
}
export function echoEncounter(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case RAISED_BY_THE_KINGPIN:
      return [X("raised", { piece: p })];
    case MASTER_MANIPULATOR:
      return isTextBlank(s, p)
        ? []
        : [X("find-kingpin", { playerId: s.activePlayerId })];
    case PAWN_OF_THE_KINGPIN:
      return [X("pawn", { playerId: s.activePlayerId })];
  }
  return null;
}
/** Master Manipulator's boost: if Kingpin is in play, reveal this scheme. */
export function echoBoost(s: GameState, p: Piece): Effect[] | null {
  if (p.code !== MASTER_MANIPULATOR) return null;
  if (isTextBlank(s, p) || !kingpinInPlay(s)) return [];
  const activation = s.attack || s.scheming;
  if (activation && !activation.retainedBoostIds?.includes(p.id))
    (activation.retainedBoostIds ||= []).push(p.id);
  return [X("manipulator-reveal", { piece: p, playerId: s.activePlayerId })];
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** A thwart-labeled removal of threat from a scheme of the player's choice. */
function chooseSchemeThwart(
  s: GameState,
  title: string,
  amount: number,
  ports: EchoPorts,
  action = true,
) {
  if (action && s.player.confused) {
    // The confused identity removes its status instead of thwarting.
    ports.queue(
      s,
      E("thwart", { target: "", amount: 0, action: true, source: "hero" }),
    );
    return;
  }
  const list = ports.schemes(s, action);
  if (!list.length) return;
  const effect = (id: string) =>
    E("thwart", {
      target: id,
      amount,
      source: "hero",
      ...(action ? { action } : {}),
    });
  if (list.length === 1) {
    ports.queue(s, effect(list[0].id));
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a scheme.",
    list.map((t) =>
      O(t.id, `${t.label} · remove ${amount} threat`, [effect(t.id)], t.code),
    ),
  );
}
function chooseEnemy(
  s: GameState,
  ports: EchoPorts,
  title: string,
  text: string,
  list: EchoTarget[],
  effects: (id: string) => Effect[],
) {
  if (!list.length) return;
  if (list.length === 1) {
    ports.queue(s, ...effects(list[0].id));
    return;
  }
  ports.choose(
    s,
    title,
    text,
    list.map((t) => O(t.id, t.label, effects(t.id), t.code)),
  );
}
/** Distinct cards by printing, keeping the first copy of each. */
function distinct(pieces: Piece[]): Piece[] {
  const seen = new Set<string>();
  return pieces.filter((p) => !seen.has(p.code) && !!seen.add(p.code));
}

export function resolveEchoEffect(
  s: GameState,
  e: Effect,
  ports: EchoPorts,
): boolean {
  if (!e.type.startsWith("echo:")) return false;
  switch (e.type) {
    case "echo:watch": {
      // Watch and Learn: the Echo player may tuck the played event.
      if (!triggersLive(s) || s.player.form !== "hero") break;
      const ownerId = String(e.ownerId);
      if (!alive(s, ownerId)) break;
      const p = seatView(s, ownerId).player.discard.find((q) => q.id === e.id);
      if (!p) break;
      const pile =
        ownerId === s.activePlayerId
          ? "your discard pile"
          : `${ports.heroName(s, ownerId)}'s discard pile`;
      ports.choose(
        s,
        "Watch and Learn",
        `Tuck ${name(p)} under Echo from ${pile}?`,
        [
          O(
            "tuck",
            `Tuck ${name(p)} under Echo`,
            [X("tuck", { id: p.id, ownerId })],
            p.code,
          ),
          O("pass", "Pass", []),
        ],
      );
      break;
    }
    case "echo:tuck": {
      const ownerId = String(e.ownerId);
      if (!alive(s, ownerId)) break;
      const zone = seatView(s, ownerId).player.discard;
      const i = zone.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = zone.splice(i, 1);
      const tucked = (s.player.echoTucked ||= []);
      tucked.push(p);
      ports.log(s, `Watch and Learn: ${name(p)} is tucked under Echo.`, "good");
      if (tucked.length > ECHO_TUCK_LIMIT) ports.queue(s, X("trim"));
      break;
    }
    case "echo:trim": {
      // Then, if there are more than 3 tucked cards, discard all but 3.
      const tucked = echoTucked(s);
      if (tucked.length <= ECHO_TUCK_LIMIT) break;
      ports.choose(
        s,
        "Watch and Learn",
        `Keep ${ECHO_TUCK_LIMIT} tucked cards: choose one to discard.`,
        tucked.map((q) =>
          O(
            q.id,
            `Discard ${name(q)}`,
            [X("untuck", { id: q.id }), X("trim")],
            q.code,
          ),
        ),
      );
      break;
    }
    case "echo:untuck": {
      const tucked = echoTucked(s);
      const i = tucked.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = tucked.splice(i, 1);
      discardToOwner(s, p);
      ports.log(s, `${name(p)} is discarded from under Echo.`);
      break;
    }
    case "echo:practice": {
      // Practice Makes Perfect, before the form changes.
      const flip = E("flip", {
        counts: e.counts,
        target: e.target,
        magikHandled: true,
      });
      if (!triggersLive(s) || s.player.form !== "alter") {
        ports.queue(s, flip);
        break;
      }
      ports.revealHidden(s);
      const events = distinct(s.player.deck.filter(isAspectOrBasicEvent));
      if (!events.length) {
        ports.queue(s, flip);
        break;
      }
      ports.choose(
        s,
        "Practice Makes Perfect",
        "Search your deck for an aspect or basic event and add it to your hand before changing to hero form?",
        [
          ...events.map((p) =>
            O(p.id, name(p), [X("practice-take", { id: p.id }), flip], p.code),
          ),
          O("pass", "Change form without searching", [flip]),
        ],
      );
      break;
    }
    case "echo:practice-take": {
      const i = s.player.deck.findIndex((q) => q.id === e.id);
      if (i >= 0) {
        const [p] = s.player.deck.splice(i, 1);
        s.player.hand.push(p);
        ports.log(
          s,
          `Practice Makes Perfect: ${name(p)} is added to your hand.`,
          "good",
        );
      }
      ports.shuffleDeck(s);
      break;
    }
    case "echo:study": {
      // Study the Tape: 1 aspect event, 1 basic event or 1 copy of
      // Photographic Reflexes from any player's discard pile.
      const found = playerOrder(s).flatMap((seat) =>
        distinct(
          seatView(s, seat).player.discard.filter(
            (q) => isAspectOrBasicEvent(q) || isReflexes(q),
          ),
        ).map((q) => ({ q, ownerId: seat.id })),
      );
      if (!found.length) {
        ports.log(s, "Study the Tape finds no event in any discard pile.");
        break;
      }
      ports.choose(
        s,
        "Study the Tape",
        "Add an aspect event, a basic event or Photographic Reflexes from any player's discard pile to your hand.",
        found.map(({ q, ownerId }) =>
          O(
            q.id,
            ownerId === s.activePlayerId
              ? name(q)
              : `${name(q)} · ${ports.heroName(s, ownerId)}`,
            [X("study-take", { id: q.id, ownerId })],
            q.code,
          ),
        ),
      );
      break;
    }
    case "echo:study-take": {
      const ownerId = String(e.ownerId);
      if (!alive(s, ownerId)) break;
      const zone = seatView(s, ownerId).player.discard;
      const i = zone.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = zone.splice(i, 1);
      s.player.hand.push(p);
      ports.log(s, `Study the Tape: ${name(p)} is added to your hand.`, "good");
      break;
    }
    case "echo:choreography": {
      const draw = s.player.form === "alter" ? [E("draw", { amount: 1 })] : [];
      const events = distinct(s.player.discard.filter(isAspectOrBasicEvent));
      if (!events.length) {
        ports.queue(s, ...draw);
        break;
      }
      ports.choose(
        s,
        "Choreography",
        "Shuffle an aspect or basic event from your discard pile into your deck.",
        events.map((q) =>
          O(
            q.id,
            name(q),
            [X("choreography-shuffle", { id: q.id }), ...draw],
            q.code,
          ),
        ),
      );
      break;
    }
    case "echo:choreography-shuffle": {
      const i = s.player.discard.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = s.player.discard.splice(i, 1);
      s.player.deck.push(p);
      ports.shuffleDeck(s);
      ports.log(s, `Choreography: ${name(p)} is shuffled into your deck.`);
      break;
    }
    case "echo:muscle": {
      const tucked = echoTucked(s);
      if (!tucked.length) break;
      ports.choose(
        s,
        "Muscle Memory",
        "Add an event tucked under Echo to your hand.",
        tucked.map((q) =>
          O(q.id, name(q), [X("muscle-take", { id: q.id })], q.code),
        ),
      );
      break;
    }
    case "echo:muscle-take": {
      const tucked = echoTucked(s);
      const i = tucked.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = tucked.splice(i, 1);
      s.player.hand.push(p);
      ports.log(s, `Muscle Memory: ${name(p)} is added to your hand.`, "good");
      break;
    }
    case "echo:katana":
      ports.attack(s, [X("katana-hit", { amount: e.amount })], []);
      break;
    case "echo:katana-hit": {
      const amount = Number(e.amount || 0);
      chooseEnemy(
        s,
        ports,
        "Echo's Katana",
        `Deal ${amount} damage to an enemy. This attack gains piercing.`,
        ports.enemies(s, true),
        (id) => [
          E("damage", {
            target: id,
            amount,
            attack: true,
            source: "hero",
            attackInitiated: true,
            piercing: true,
          }),
        ],
      );
      break;
    }
    case "echo:improvisation": {
      const effects: Effect[] = [];
      if (e.attack) effects.push(E("heal", { target: "hero", amount: 1 }));
      if (e.defense) effects.push(X("improvisation-threat"));
      if (e.thwart) effects.push(X("improvisation-damage"));
      ports.queue(s, ...effects);
      break;
    }
    case "echo:improvisation-threat":
      chooseSchemeThwart(s, "Improvisation", 1, ports, false);
      break;
    case "echo:improvisation-damage":
      chooseEnemy(
        s,
        ports,
        "Improvisation",
        "Deal 1 damage to an enemy.",
        ports.enemies(s, false),
        (id) => [E("damage", { target: id, amount: 1, source: "hero" })],
      );
      break;
    case "echo:daredevil": {
      const amount = daredevilDiscount(s) + 1;
      s.flags[DISCOUNT] = `${s.round}:${amount}`;
      ports.log(
        s,
        `Daredevil: the next event you play this round costs ${amount} less.`,
        "good",
      );
      break;
    }
    case "echo:raised": {
      // Give to the Maya Lopez player; then find Kingpin.
      const p = e.piece as Piece;
      const holder = echoSeat(s);
      if (!holder) {
        ports.removeFromGame(s, p.id);
        break;
      }
      ports.giveObligation(s, p, holder.id);
      p.counters = 0;
      ports.log(
        s,
        "Raised by the Kingpin stays in play with Maya Lopez.",
        "bad",
      );
      if (!isTextBlank(s, p))
        ports.queue(
          s,
          X("find-kingpin", { playerId: holder.id, actorId: holder.id }),
        );
      break;
    }
    case "echo:find-kingpin": {
      // Find Kingpin and put him into play engaged with you.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      if (kingpinInPlay(s)) {
        ports.log(s, "Kingpin is already in play.");
        break;
      }
      // The physical card first: the encounter deck, its discard pile or a
      // set-aside nemesis set; otherwise Echo's nemesis set is still set
      // aside and Kingpin comes from it.
      let found: Piece | undefined;
      for (const zone of [
        s.encounter.deck,
        s.encounter.discard,
        ...s.players.map((seat) => seatView(s, seat).player.setAside || []),
      ]) {
        const i = zone.findIndex((q) => q.code === KINGPIN);
        if (i < 0) continue;
        if (zone === s.encounter.deck) ports.revealHidden(s);
        found = zone.splice(i, 1)[0];
        break;
      }
      const owner = echoSeat(s);
      if (!found && owner) found = ports.takeNemesisMinion(s, owner.id);
      if (!found) {
        ports.log(s, "Kingpin cannot be found.");
        break;
      }
      delete found.ownerId;
      ports.log(
        s,
        `Kingpin enters play engaged with ${ports.heroName(s, playerId)}.`,
        "bad",
      );
      ports.putMinion(s, found, playerId);
      break;
    }
    case "echo:raised-threat": {
      const p = s.player.inPlay.find((q) => q.id === e.id);
      if (!p) break;
      const amount = Number(e.amount || 0);
      p.counters = (p.counters || 0) + amount;
      ports.log(
        s,
        `Raised by the Kingpin: ${plural(amount, "threat")} placed here (${p.counters} in all).`,
      );
      if (p.counters >= 4) {
        ports.log(s, "Raised by the Kingpin is removed from the game.", "good");
        ports.removeFromGame(s, p.id);
      }
      break;
    }
    case "echo:manipulator-reveal":
      ports.log(
        s,
        "Master Manipulator's boost: Kingpin is in play, so the scheme is revealed.",
        "bad",
      );
      ports.reveal(s, e.piece as Piece, String(e.playerId));
      break;
    case "echo:pawn": {
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      if (s.player.form !== "hero") {
        // When Revealed (Alter-Ego).
        const k = kingpinInPlay(s);
        if (k) {
          ports.log(s, "Pawn of the Kingpin: Kingpin schemes.", "bad");
          ports.activate(s, {
            enemyId: k.id,
            playerId,
            kind: "scheme",
            modifier: 0,
          });
        } else {
          ports.log(
            s,
            "Pawn of the Kingpin gains surge: Kingpin is not in play.",
          );
          ports.queue(s, E("surge", { sourceCode: PAWN_OF_THE_KINGPIN }));
        }
        break;
      }
      // When Revealed (Hero): damage to a hero equal to your hero's ATK.
      const amount = ports.heroAttack(s);
      const heroes = playerOrder(s).filter(
        (seat) => seatView(s, seat).player.form === "hero",
      );
      if (amount <= 0 || !heroes.length) break;
      const hit = (seatId: string) => [
        E("damage", { target: `hero:${seatId}`, amount }),
      ];
      if (heroes.length === 1) {
        ports.queue(s, ...hit(heroes[0].id));
        break;
      }
      ports.choose(
        s,
        "Pawn of the Kingpin",
        `Deal ${amount} damage to a hero.`,
        heroes.map((seat) =>
          O(
            seat.id,
            `${ports.heroName(s, seat.id)} · ${amount} damage`,
            hit(seat.id),
          ),
        ),
      );
      break;
    }
    default:
      throw Error(`Unknown Echo effect: ${e.type}`);
  }
  return true;
}
