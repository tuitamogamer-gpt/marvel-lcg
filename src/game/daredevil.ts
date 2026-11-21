/**
 * Daredevil, Fear No Evil's first hero: Matt Murdock's Sense deck, his
 * signature cards, Sensory Overload and Bullseye's nemesis set.
 *
 * Rules: the Fear No Evil rules insert and the printed card texts. Matt
 * Murdock begins the game with a Sense deck: the five Sense upgrades are
 * shuffled faceup beside the identity. Its order is open information and
 * cannot change. Superhuman Senses plays its top card as if it were in your
 * hand, paying its cost, and a Sense upgrade that would leave play goes to
 * the bottom of the Sense deck instead (both sides of the identity).
 */
import { card } from "./card-definitions.js";
import { identityTextBlank, isTextBlank } from "./card-text.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

export const DAREDEVIL_ID = "daredevil";
export const DAREDEVIL_HERO = "60001a";
export const MATT_MURDOCK = "60001b";
export const ACUTE_TACTILITY = "60002";
export const ENHANCED_OLFACTION = "60003";
export const HEIGHTENED_HEARING = "60004";
export const RADAR_SENSE = "60005";
export const SUPERIOR_TASTE = "60006";
export const DAREDEVIL_SENSES: readonly string[] = [
  ACUTE_TACTILITY,
  ENHANCED_OLFACTION,
  HEIGHTENED_HEARING,
  RADAR_SENSE,
  SUPERIOR_TASTE,
];
export const ELEKTRA = "60007";
export const CROSS_EXAMINATION = "60008";
export const DEPOSITION = "60009";
export const LIVING_LIE_DETECTOR = "60010";
export const RAISING_HELL = "60011";
export const FOCUS_THE_SENSES = "60012";
export const KAREN_PAGE = "60014";
export const NELSON_AND_MURDOCK = "60015";
export const SISTER_MAGGIE = "60016";
export const BILLY_CLUB = "60017";
export const MAN_WITHOUT_FEAR = "60018";
export const SENSORY_OVERLOAD = "60032";
export const BULLSEYE = "60033";
export const DEADLIEST_MAN_ALIVE = "60034";
export const STOLEN_SAI = "60035";
export const EYE_ON_THE_TARGET = "60036";
/** Encounter cards whose reveal this module resolves. */
export const DAREDEVIL_ENCOUNTER_CODES: readonly string[] = [
  SENSORY_OVERLOAD,
  BULLSEYE,
  STOLEN_SAI,
  EYE_ON_THE_TARGET,
];
/** Every printed face this module implements (Foggy Nelson compiles). */
export const DAREDEVIL_SCRIPT_CODES: readonly string[] = [
  DAREDEVIL_HERO,
  MATT_MURDOCK,
  ...DAREDEVIL_SENSES,
  ELEKTRA,
  CROSS_EXAMINATION,
  DEPOSITION,
  LIVING_LIE_DETECTOR,
  RAISING_HELL,
  FOCUS_THE_SENSES,
  KAREN_PAGE,
  NELSON_AND_MURDOCK,
  SISTER_MAGGIE,
  BILLY_CLUB,
  MAN_WITHOUT_FEAR,
  SENSORY_OVERLOAD,
  BULLSEYE,
  DEADLIEST_MAN_ALIVE,
  STOLEN_SAI,
  EYE_ON_THE_TARGET,
];

export interface DaredevilTarget {
  id: string;
  label: string;
  code?: string;
}
export interface DaredevilActivation {
  enemyId: string;
  playerId: string;
  kind: "attack" | "scheme";
  modifier: number;
}
export interface DaredevilPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  makePiece(s: GameState, code: string): Piece;
  shuffle<T>(s: GameState, items: T[]): T[];
  find(s: GameState, id: string): Piece | undefined;
  /** No player card may attach to some cards (Kingpin, Robert Kelly...). */
  canAttach(s: GameState, p: Piece, target: string): boolean;
  /** The card can be played now, apart from its resource cost. */
  canPlay(s: GameState, p: Piece, ignoreCost: boolean): boolean;
  cardCost(s: GameState, p: Piece): number;
  /** Play this card from the Sense deck, ignoring its resource cost. */
  playFree(s: GameState, p: Piece): void;
  /** Put this card into play (it is not played). */
  putIntoPlay(s: GameState, p: Piece): void;
  discard(s: GameState, id: string): void;
  returnToHand(s: GameState, id: string): void;
  enemies(s: GameState, attack: boolean): DaredevilTarget[];
  schemes(s: GameState, thwart: boolean): DaredevilTarget[];
  /** Resolve attack effects; a stunned identity removes its stun instead. */
  attack(s: GameState, effects: Effect[], after: Effect[]): void;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  enemyAttack(s: GameState, id: string): number;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  activate(s: GameState, request: DaredevilActivation): void;
  canPay(s: GameState, cost: number, requirements: Resource[]): boolean;
  pay(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
  ): void;
  giveObligation(s: GameState, p: Piece, playerId: string): void;
  removeFromGame(s: GameState, id: string): void;
  attachEncounter(s: GameState, p: Piece, target: string): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
  shuffleIntoDeck(s: GameState, playerId: string, p: Piece): void;
  draw(s: GameState, playerId: string, n: number): void;
  removeStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): void;
  canDefend(s: GameState, playerId: string): boolean;
  /** The identity becomes the defender and the target of this attack. */
  claimDefense(s: GameState, playerId: string): void;
}

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  ...args,
  type,
});
const D = (type: string, args: Record<string, unknown> = {}) =>
  E(`dd:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const name = (p: Piece | string) => card(p).name;
const traitsOf = (p: Piece | string) =>
  (card(p).traits || "").replace(/\.$/, "").split(/\.\s*/).filter(Boolean);
export const isSenseUpgrade = (p: Piece | string) =>
  card(p).type_code === "upgrade" && traitsOf(p).includes("Sense");
const senseCode = (p: Piece) => DAREDEVIL_SENSES.includes(p.code);
const live = (s: GameState, p: Piece) => !isTextBlank(s, p);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The identity's printed text is active. */
const identityLive = (view: GameState) =>
  view.heroId === DAREDEVIL_ID && !identityTextBlank(view);
/** Its triggered abilities may be used. */
const triggersLive = (view: GameState) =>
  identityLive(view) && !deadpoolTriggeredBlocked(view);
const alive = (s: GameState, playerId: string) =>
  s.players.some((seat) => seat.id === playerId && !seat.eliminated);
/** The player whose identity, card or event is the source. */
function playerOf(s: GameState, source?: string): string {
  if (!source || source === "hero") return s.activePlayerId;
  if (source.startsWith("hero:")) return source.slice(5);
  return controller(s, source)?.id || s.activePlayerId;
}
const heroTarget = (playerId: string) => `hero:${playerId}`;
/** The main scheme's attachments use "main" or "main:<code>". */
function attachedTo(s: GameState, p: Piece, id: string) {
  return id === "main"
    ? ["main", `main:${s.scheme.code}`].includes(p.attachedTo || "")
    : p.attachedTo === id;
}
/** Upgrades attached to a card, in any player's play area. */
export function daredevilUpgradesOn(s: GameState, id: string): number {
  return allInPlay(s).filter(
    (p) => card(p).type_code === "upgrade" && attachedTo(s, p, id),
  ).length;
}

// ---------------------------------------------------------------------------
// The Sense deck
// ---------------------------------------------------------------------------

/** Setup: the five Sense upgrades are shuffled into the Sense deck. */
export function daredevilSetup(s: GameState, ports: DaredevilPorts) {
  if (s.heroId !== DAREDEVIL_ID || s.player.senseDeck) return;
  s.player.senseDeck = ports.shuffle(
    s,
    DAREDEVIL_SENSES.map((code) => ({
      ...ports.makePiece(s, code),
      ownerId: s.activePlayerId,
    })),
  );
}
export const daredevilSenseDeck = (s: GameState): Piece[] =>
  s.player.senseDeck || [];
export const daredevilSenseTop = (s: GameState): Piece | undefined =>
  s.player.senseDeck?.[0];
/** Superhuman Senses (hero Action): the top card plays as if in hand. */
export function daredevilStoredPlayable(s: GameState): Piece[] {
  const top = daredevilSenseTop(s);
  return top && s.player.form === "hero" && triggersLive(s) ? [top] : [];
}
export const daredevilInSenseDeck = (s: GameState, id: string) =>
  !!s.player.senseDeck?.some((p) => p.id === id);
/** Take a card out of the Sense deck to play or put it into play. */
export function daredevilTakeFromSense(
  s: GameState,
  id: string,
): Piece | undefined {
  const deck = s.player.senseDeck;
  const i = deck ? deck.findIndex((p) => p.id === id) : -1;
  return i >= 0 ? deck!.splice(i, 1)[0] : undefined;
}
/** Forced Interrupt: a Sense upgrade that would leave play goes to the
 * bottom of its owner's Sense deck instead. Returns true when it did. */
export function daredevilKeepsSense(
  s: GameState,
  ownerId: string,
  p: Piece,
): boolean {
  if (!senseCode(p)) return false;
  const seat = s.players.find((x) => x.id === ownerId && !x.eliminated);
  if (!seat) return false;
  const view = seatView(s, seat);
  if (!identityLive(view)) return false;
  (view.player.senseDeck ||= []).push(p);
  return true;
}
/** Where a Sense upgrade can attach. Null for any other card. */
export function daredevilAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: Pick<DaredevilPorts, "enemies" | "canAttach">,
): DaredevilTarget[] | null {
  if (!senseCode(p)) return null;
  const enemy = p.code !== SUPERIOR_TASTE;
  const scheme = [ACUTE_TACTILITY, ENHANCED_OLFACTION, SUPERIOR_TASTE].includes(
    p.code,
  );
  return [
    ...(enemy ? ports.enemies(s, false) : []),
    ...(scheme
      ? [
          { id: "main", label: name(s.scheme.code), code: s.scheme.code },
          ...s.sideSchemes.map((q) => ({
            id: q.id,
            label: name(q),
            code: q.code,
          })),
        ]
      : []),
  ].filter((t) => ports.canAttach(s, p, t.id));
}
/** Sense deck upgrades that can be played now, ignoring their cost. */
function freeSenses(s: GameState, ports: DaredevilPorts): Piece[] {
  return daredevilSenseDeck(s).filter(
    (p) =>
      (daredevilAttachmentTargets(s, p, ports) || []).length > 0 &&
      ports.canPlay(s, p, true),
  );
}
function sensoryOverloadHolders(s: GameState): string[] {
  return playerOrder(s)
    .filter((seat) =>
      seatView(s, seat).player.inPlay.some(
        (q) => q.code === SENSORY_OVERLOAD && !isTextBlank(s, q),
      ),
    )
    .map((seat) => seat.id);
}
/** A card entered play: Sense upgrades attach, and Sensory Overload deals
 * its damage after a Sense upgrade enters play. */
export function daredevilEntered(s: GameState, p: Piece): Effect[] {
  if (!isSenseUpgrade(p)) return [];
  return [
    ...(senseCode(p) && !p.attachedTo ? [D("attach", { id: p.id })] : []),
    ...sensoryOverloadHolders(s).map((playerId) =>
      D("overload", { playerId, actorId: playerId }),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Playing cards
// ---------------------------------------------------------------------------

function upgradedEnemies(s: GameState, ports: DaredevilPorts) {
  return ports.enemies(s, true).filter((t) => daredevilUpgradesOn(s, t.id) > 0);
}
export function daredevilPlayRestriction(
  s: GameState,
  p: Piece,
  ports: DaredevilPorts,
): string | null {
  if (senseCode(p) && !daredevilAttachmentTargets(s, p, ports)!.length)
    return `${name(p)} has no card it can attach to.`;
  switch (p.code) {
    case CROSS_EXAMINATION:
      return !s.player.stunned && !ports.enemies(s, true).length
        ? "There is no enemy to attack."
        : null;
    case LIVING_LIE_DETECTOR:
      return !s.player.confused && !ports.schemes(s, true).length
        ? "There is no threat to remove."
        : null;
    case DEPOSITION:
      return !s.player.confused &&
        !ports.schemes(s, true).length &&
        !freeSenses(s, ports).length
        ? "There is no threat to remove and no Sense upgrade to play."
        : null;
    case RAISING_HELL:
      return !s.player.stunned && !upgradedEnemies(s, ports).length
        ? "Raising Hell needs an enemy with an upgrade attached."
        : null;
  }
  return null;
}
export function daredevilEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case CROSS_EXAMINATION:
      return [D("cross")];
    case DEPOSITION:
      return [D("deposition")];
    case LIVING_LIE_DETECTOR:
      return [D("lie-detector")];
    case RAISING_HELL:
      return [D("raising-hell")];
  }
  return null;
}
/** Billy Club (+1 ATK) and Sister Maggie (+3 REC). */
export function daredevilStats(s: GameState) {
  const own = (code: string) =>
    s.player.inPlay.filter((p) => p.code === code && live(s, p)).length;
  return {
    attack:
      s.heroId === DAREDEVIL_ID && s.player.form === "hero"
        ? own(BILLY_CLUB)
        : 0,
    recover:
      s.heroId === DAREDEVIL_ID && s.player.form === "alter"
        ? 3 * own(SISTER_MAGGIE)
        : 0,
  };
}
/** Billy Club: Daredevil gains the Aerial trait until the end of the round. */
export function daredevilHasTrait(
  s: GameState,
  target: string,
  trait: string,
): boolean {
  if (trait.replace(/\.$/, "") !== "Aerial") return false;
  const playerId =
    target === "hero"
      ? s.activePlayerId
      : target.startsWith("hero:")
        ? target.slice(5)
        : "";
  if (!playerId || !alive(s, playerId)) return false;
  const view = seatView(s, playerId);
  return (
    view.heroId === DAREDEVIL_ID &&
    view.player.form === "hero" &&
    view.flags.ddAerialRound === s.round
  );
}
const olfactionKey = (s: GameState) => `${s.round}:${s.phase}`;
/** Enhanced Olfaction: the next card played this phase costs 2 less. */
export function daredevilCostModifier(s: GameState): number {
  return s.flags.ddOlfaction === olfactionKey(s) ? -2 : 0;
}
export function daredevilCardPlayed(s: GameState) {
  delete s.flags.ddOlfaction;
}
export function daredevilPhaseEnded(s: GameState) {
  for (const seat of s.players) delete seatView(s, seat).flags.ddOlfaction;
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

export function daredevilAbilityOptions(
  s: GameState,
  id: string,
  ports: DaredevilPorts,
): Option[] {
  if (id === "identity" || id === "hero") {
    const top = daredevilStoredPlayable(s)[0];
    return top && ports.canPlay(s, top, false)
      ? [
          O(
            "senses",
            `Superhuman Senses · play ${name(top)} (${plural(ports.cardCost(s, top), "resource")})`,
            [E("playRequest", { piece: top })],
            top.code,
          ),
        ]
      : [];
  }
  const sai = s.attachments.find((q) => q.id === id && q.code === STOLEN_SAI);
  if (sai)
    return s.player.form === "hero" &&
      live(s, sai) &&
      ports.canPay(s, 2, ["physical", "physical"])
      ? [
          O(
            "sai",
            "Stolen Sai · spend 2 physical resources to give it to Elektra or discard it",
            [D("sai-pay", { id })],
            sai.code,
          ),
        ]
      : [];
  const p = s.player.inPlay.find((q) => q.id === id);
  if (!p || !live(s, p) || deadpoolTriggeredBlocked(s)) return [];
  if (p.code === KAREN_PAGE && !p.exhausted) {
    const alter = s.player.form === "alter";
    return daredevilCards(s).length || alter
      ? [
          O(
            "karen",
            `Karen Page · shuffle a Daredevil card from your discard pile into your deck${alter ? " and draw 1" : ""}`,
            [E("exhaust", { id }), D("karen", { id })],
            p.code,
          ),
        ]
      : [];
  }
  if (p.code === BILLY_CLUB && s.player.form === "hero")
    return [
      O(
        "club",
        "Daredevil's Billy Club · return it to your hand: 1 damage or Aerial",
        [D("club", { id })],
        p.code,
      ),
    ];
  if (p.code === MAN_WITHOUT_FEAR && !p.exhausted && s.player.form === "hero") {
    const sense = freeSenses(s, ports).length > 0;
    const ready =
      s.player.exhausted && ports.canReadyIdentity(s, s.activePlayerId);
    return sense || ready
      ? [
          O(
            "fearless",
            "The Man Without Fear · exhaust and take 1 damage: play a Sense upgrade or ready",
            [E("exhaust", { id }), D("fearless", { id })],
            p.code,
          ),
        ]
      : [];
  }
  return [];
}
const daredevilCards = (s: GameState) =>
  s.player.discard.filter(
    (p) =>
      card(p).set_code === DAREDEVIL_ID &&
      !["hero", "alter_ego"].includes(card(p).type_code),
  );

// ---------------------------------------------------------------------------
// Triggered abilities
// ---------------------------------------------------------------------------

/** Acute Tactility and Enhanced Olfaction on an enemy its player defeats. */
function defeatOptions(s: GameState, enemyId: string, playerId: string) {
  if (!alive(s, playerId)) return [];
  const view = seatView(s, playerId);
  if (deadpoolTriggeredBlocked(view)) return [];
  return view.player.inPlay
    .filter(
      (p) =>
        [ACUTE_TACTILITY, ENHANCED_OLFACTION].includes(p.code) &&
        attachedTo(s, p, enemyId) &&
        live(s, p),
    )
    .map((p) =>
      E("optional", {
        title: name(p),
        text:
          p.code === ACUTE_TACTILITY
            ? "Discard Acute Tactility to ready your identity?"
            : "Discard Enhanced Olfaction to reduce the cost of the next card you play this phase by 2?",
        effects: [D("sense-reward", { id: p.id, playerId })],
        sourceId: p.id,
        image: p.code,
        actorId: playerId,
      }),
    );
}
/** Interrupt: when you defeat attached enemy (a minion). */
export function daredevilDefeatInterrupts(
  s: GameState,
  m: Piece,
  source: string,
): Effect[] {
  if (!s.minions.some((q) => q.id === m.id)) return [];
  return defeatOptions(s, m.id, playerOf(s, source));
}
/** Interrupt: when you defeat attached enemy (a villain stage). The choice
 * waits until the defeat and the next stage's own effects have resolved. */
export function daredevilVillainDefeated(
  s: GameState,
  source: string,
): Effect[] {
  const options = defeatOptions(s, s.villain.id, playerOf(s, source));
  return options.length ? [D("defer", { effects: options, n: 0 })] : [];
}
/** Interrupt: when you remove the last threat from attached scheme. */
export function daredevilLastThreat(
  s: GameState,
  schemeId: string,
  source?: string,
): Effect[] {
  return defeatOptions(s, schemeId, playerOf(s, source));
}
/** Focus the Senses: only Daredevil or Matt Murdock removes its threat. */
export function daredevilCanRemoveThreat(
  s: GameState,
  target: string,
  source?: string,
): boolean {
  const scheme = s.sideSchemes.find((p) => p.id === target);
  if (!scheme || scheme.code !== FOCUS_THE_SENSES || isTextBlank(s, scheme))
    return true;
  if (source && source !== "hero" && !source.startsWith("hero:")) return false;
  const playerId = playerOf(s, source);
  return alive(s, playerId) && seatView(s, playerId).heroId === DAREDEVIL_ID;
}
/** Radar Sense: after you attack attached enemy. */
export function daredevilAfterHeroAttack(
  s: GameState,
  targetId: string,
): Effect[] {
  if (deadpoolTriggeredBlocked(s) || s.player.form !== "hero") return [];
  const enemy =
    targetId === s.villain.id || s.minions.some((q) => q.id === targetId);
  if (!enemy) return [];
  return s.player.inPlay
    .filter(
      (p) => p.code === RADAR_SENSE && p.attachedTo === targetId && live(s, p),
    )
    .map((p) =>
      E("optional", {
        title: "Radar Sense",
        text: "Discard Radar Sense to deal 3 damage to the enemy you attacked?",
        effects: [D("radar", { id: p.id, target: targetId })],
        sourceId: p.id,
        image: p.code,
      }),
    );
}
/** Superior Taste: after you thwart attached scheme. */
export function daredevilAfterThwart(s: GameState, target: string): Effect[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  const threat =
    target === "main"
      ? s.scheme.threat
      : s.sideSchemes.find((q) => q.id === target)?.counters || 0;
  if (threat <= 0) return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === SUPERIOR_TASTE && attachedTo(s, p, target) && live(s, p),
    )
    .map((p) =>
      E("optional", {
        title: "Superior Taste",
        text: "Discard Superior Taste to remove 2 threat from the scheme you thwarted?",
        effects: [D("taste", { id: p.id, target })],
        sourceId: p.id,
        image: p.code,
      }),
    );
}
/** Heightened Hearing: Hero Interrupt (defense) when attached enemy attacks. */
export function daredevilAttackInitiatedOptions(
  s: GameState,
  attackerId: string,
  after: Effect[],
  ports: DaredevilPorts,
): Option[] {
  if (
    s.player.form !== "hero" ||
    deadpoolTriggeredBlocked(s) ||
    !ports.canDefend(s, s.activePlayerId)
  )
    return [];
  return s.player.inPlay
    .filter(
      (p) =>
        p.code === HEIGHTENED_HEARING &&
        p.attachedTo === attackerId &&
        live(s, p),
    )
    .map((p) =>
      O(
        p.id,
        "Heightened Hearing · discard it: the enemy gets -3 ATK and attacks you",
        [
          D("hearing", {
            id: p.id,
            attacker: attackerId,
            playerId: s.activePlayerId,
            after,
          }),
        ],
        p.code,
      ),
    );
}
/** Deadliest Man Alive: Bullseye gets a facedown boost card. */
export function daredevilAdditionalBoosts(
  s: GameState,
  attackerId: string,
): number {
  const attacker =
    attackerId === s.villain.id
      ? s.villain
      : s.minions.find((q) => q.id === attackerId);
  if (!attacker || name(attacker) !== "Bullseye") return 0;
  return s.sideSchemes.filter(
    (p) => p.code === DEADLIEST_MAN_ALIVE && !isTextBlank(s, p),
  ).length;
}
/** Stolen Sai: the attached character's attacks gain piercing. */
export function daredevilPiercing(s: GameState, attackerId: string): boolean {
  return s.attachments.some(
    (p) => p.code === STOLEN_SAI && p.attachedTo === attackerId && live(s, p),
  );
}
/** An ally holding Stolen Sai gets its printed ATK. */
export function daredevilAllyAttack(s: GameState, ally: Piece): number {
  return s.attachments
    .filter((p) => p.code === STOLEN_SAI && p.attachedTo === ally.id)
    .reduce((n, p) => n + Number(card(p).attack || 0), 0);
}
/** Elektra: Daredevil takes her consequential damage (in hero form). */
export function daredevilConsequentialTarget(
  s: GameState,
  ally: Piece,
): string | undefined {
  if (ally.code !== ELEKTRA || isTextBlank(s, ally)) return undefined;
  const playerId = controller(s, ally.id)?.id;
  if (!playerId || !alive(s, playerId)) return undefined;
  const view = seatView(s, playerId);
  return view.heroId === DAREDEVIL_ID &&
    view.player.form === "hero" &&
    !deadpoolTriggeredBlocked(view)
    ? heroTarget(playerId)
    : undefined;
}
/** After you recover: Sister Maggie and Sensory Overload. */
export function daredevilRecovered(s: GameState): Effect[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  const out: Effect[] = [];
  const status = !!s.player.stunned || !!s.player.confused || !!s.player.tough;
  for (const p of s.player.inPlay.filter(
    (q) => q.code === SISTER_MAGGIE && live(s, q),
  ))
    if (status)
      out.push(
        E("optional", {
          title: "Sister Maggie",
          text: "Discard a status card from your identity?",
          effects: [D("maggie")],
          sourceId: p.id,
          image: p.code,
        }),
      );
  if (s.player.form === "alter")
    for (const p of s.player.inPlay.filter(
      (q) => q.code === SENSORY_OVERLOAD && live(s, q),
    ))
      out.push(
        E("optional", {
          title: "Sensory Overload",
          text: "Discard Sensory Overload?",
          effects: [E("discardPiece", { id: p.id })],
          sourceId: p.id,
          image: p.code,
        }),
      );
  return out;
}
/** Focus the Senses: When Defeated. */
export function daredevilSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === FOCUS_THE_SENSES ? [D("focus")] : [];
}
/** Nelson and Murdock: after an Attorney character or support defeats a
 * side scheme, confuse an enemy. */
export function daredevilSideSchemeDefeated(
  s: GameState,
  scheme: Piece,
  source: string | undefined,
  ports: DaredevilPorts,
): Effect[] {
  if (card(scheme).type_code !== "side_scheme") return [];
  const attorney =
    !source || source === "hero" || source.startsWith("hero:")
      ? ports.hasTrait(s, heroTarget(playerOf(s, source)), "Attorney")
      : ports.hasTrait(s, source, "Attorney");
  if (!attorney) return [];
  return playerOrder(s).flatMap((seat) => {
    const view = seatView(s, seat);
    if (deadpoolTriggeredBlocked(view)) return [];
    return view.player.inPlay
      .filter((q) => q.code === NELSON_AND_MURDOCK && live(s, q))
      .map((q) =>
        E("optional", {
          title: "Nelson and Murdock",
          text: "Confuse an enemy?",
          effects: [D("nelson")],
          sourceId: q.id,
          image: q.code,
          actorId: seat.id,
        }),
      );
  });
}

// ---------------------------------------------------------------------------
// Encounter cards
// ---------------------------------------------------------------------------

export function daredevilEncounter(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case SENSORY_OVERLOAD:
      return [D("overload-give", { piece: p })];
    case BULLSEYE:
      return [D("bullseye", { id: p.id, playerId: s.activePlayerId })];
    case STOLEN_SAI:
      return [D("sai-attach", { id: p.id })];
    case EYE_ON_THE_TARGET:
      return [D("eye", { playerId: s.activePlayerId })];
  }
  return null;
}
/** Stolen Sai's boost: an attack gains piercing. */
export function daredevilBoost(s: GameState, p: Piece): Effect[] | null {
  if (p.code !== STOLEN_SAI) return null;
  if (s.attack && !isTextBlank(s, p)) s.attack.piercing = true;
  return [];
}
function bullseyeInPlay(s: GameState): Piece | undefined {
  return (
    s.minions.find((q) => q.code === BULLSEYE) ||
    (s.villain && name(s.villain) === "Bullseye" ? s.villain : undefined)
  );
}
function personaSupports(s: GameState) {
  return s.player.inPlay.filter(
    (q) =>
      card(q).type_code === "support" &&
      traitsOf(q).includes("Persona") &&
      card(q).faction_code !== "encounter",
  );
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** The main scheme's attachments are keyed by its current printing. */
function attachSense(s: GameState, p: Piece, target: string) {
  p.attachedTo = target === "main" ? `main:${s.scheme.code}` : target;
}
/** A thwart-labeled removal of threat from a scheme of the player's choice. */
function chooseSchemeThwart(
  s: GameState,
  title: string,
  amountFor: (id: string) => number,
  ports: DaredevilPorts,
) {
  if (s.player.confused) {
    // The confused identity removes its status instead of thwarting.
    ports.queue(
      s,
      E("thwart", { target: "", amount: 0, action: true, source: "hero" }),
    );
    return;
  }
  const list = ports.schemes(s, true);
  if (!list.length) return;
  const effect = (id: string) =>
    E("thwart", {
      target: id,
      amount: amountFor(id),
      action: true,
      source: "hero",
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
      O(
        t.id,
        `${t.label} · remove ${amountFor(t.id)} threat`,
        [effect(t.id)],
        t.code,
      ),
    ),
  );
}
function chooseEnemy(
  s: GameState,
  ports: DaredevilPorts,
  title: string,
  text: string,
  list: DaredevilTarget[],
  effects: (id: string) => Effect[],
  label: (t: DaredevilTarget) => string = (t) => t.label,
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
    list.map((t) => O(t.id, label(t), effects(t.id), t.code)),
  );
}

export function resolveDaredevilEffect(
  s: GameState,
  e: Effect,
  ports: DaredevilPorts,
): boolean {
  if (!e.type.startsWith("dd:")) return false;
  switch (e.type) {
    case "dd:defer": {
      // Resolve once everything already queued has resolved.
      const n = Number(e.n || 0);
      if (s.queue.length && n < 50) s.queue.push({ ...e, n: n + 1 });
      else ports.queue(s, ...(e.effects || []));
      break;
    }
    case "dd:attach": {
      const p = ports.find(s, String(e.id));
      if (!p || p.attachedTo || !s.player.inPlay.some((q) => q.id === p.id))
        break;
      const list = daredevilAttachmentTargets(s, p, ports) || [];
      if (!list.length) {
        ports.log(s, `${name(p)} has nothing to attach to.`);
        ports.discard(s, p.id);
        break;
      }
      if (list.length === 1) {
        attachSense(s, p, list[0].id);
        ports.log(s, `${name(p)} attaches to ${list[0].label}.`, "good");
        break;
      }
      ports.choose(
        s,
        name(p),
        `Attach ${name(p)} to a card.`,
        list.map((t) =>
          O(
            t.id,
            t.label,
            [D("attach-to", { id: p.id, target: t.id })],
            t.code,
          ),
        ),
      );
      break;
    }
    case "dd:attach-to": {
      const p = ports.find(s, String(e.id));
      if (!p || p.attachedTo) break;
      const target = String(e.target);
      if (
        !(daredevilAttachmentTargets(s, p, ports) || []).some(
          (t) => t.id === target,
        )
      ) {
        ports.queue(s, D("attach", { id: p.id }));
        break;
      }
      attachSense(s, p, target);
      ports.log(s, `${name(p)} attaches.`, "good");
      break;
    }
    case "dd:overload": {
      // Sensory Overload: take 1 damage after a Sense upgrade enters play.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      const holder = seatView(s, playerId).player.inPlay.find(
        (q) => q.code === SENSORY_OVERLOAD && !isTextBlank(s, q),
      );
      if (!holder) break;
      ports.queue(
        s,
        E("damage", {
          target: heroTarget(playerId),
          amount: 1,
          source: holder.id,
          origin: "encounter",
        }),
      );
      ports.log(s, "Sensory Overload deals 1 damage.", "bad");
      break;
    }
    case "dd:play-free": {
      const p = daredevilSenseDeck(s).find((q) => q.id === e.id);
      if (!p || !ports.canPlay(s, p, true)) break;
      ports.playFree(s, p);
      break;
    }
    case "dd:choose-free": {
      // Deposition and The Man Without Fear: any Sense upgrade, free.
      const free = freeSenses(s, ports);
      const after: Effect[] = e.after || [];
      if (!free.length) {
        ports.queue(s, ...after);
        break;
      }
      ports.choose(
        s,
        String(e.title || "Sense deck"),
        "Choose an upgrade from the Sense deck to play, ignoring its resource cost.",
        [
          ...free.map((p) =>
            O(
              p.id,
              `Play ${name(p)}`,
              [D("play-free", { id: p.id }), ...after],
              p.code,
            ),
          ),
          ...(e.optional ? [O("skip", "Play no Sense upgrade", after)] : []),
        ],
      );
      break;
    }
    case "dd:cross":
      ports.attack(s, [D("cross-target")], []);
      break;
    case "dd:cross-target":
      chooseEnemy(
        s,
        ports,
        "Cross-Examination",
        "Deal 3 damage to an enemy, and 1 more for each upgrade attached to it.",
        ports.enemies(s, true),
        (id) => [
          E("damage", {
            target: id,
            amount: 3 + daredevilUpgradesOn(s, id),
            attack: true,
            source: "hero",
            attackInitiated: true,
          }),
        ],
        (t) => `${t.label} · ${3 + daredevilUpgradesOn(s, t.id)} damage`,
      );
      break;
    case "dd:deposition":
      ports.queue(
        s,
        D("choose-free", {
          title: "Deposition",
          optional: true,
          after: [D("deposition-thwart")],
        }),
      );
      break;
    case "dd:deposition-thwart":
      chooseSchemeThwart(s, "Deposition", () => 2, ports);
      break;
    case "dd:lie-detector":
      chooseSchemeThwart(
        s,
        "Living Lie Detector",
        (id) => 2 + daredevilUpgradesOn(s, id),
        ports,
      );
      break;
    case "dd:raising-hell":
      ports.attack(s, [D("hell-hit")], []);
      break;
    case "dd:hell-hit": {
      const per = ports.hasTrait(s, "hero", "Aerial") ? 3 : 2;
      const hits = ports
        .enemies(s, true)
        .map((t) => ({ id: t.id, n: per * daredevilUpgradesOn(s, t.id) }))
        .filter((x) => x.n > 0);
      ports.queue(
        s,
        ...hits.map((x) =>
          E("damage", {
            target: x.id,
            amount: x.n,
            attack: true,
            source: "hero",
            attackInitiated: true,
          }),
        ),
      );
      break;
    }
    case "dd:karen": {
      const cards = daredevilCards(s);
      const draw =
        s.player.form === "alter"
          ? [D("draw", { playerId: s.activePlayerId, n: 1 })]
          : [];
      if (!cards.length) {
        ports.queue(s, ...draw);
        break;
      }
      ports.choose(
        s,
        "Karen Page",
        "Shuffle a Daredevil card from your discard pile into your deck.",
        cards.map((p) =>
          O(p.id, name(p), [D("karen-shuffle", { id: p.id }), ...draw], p.code),
        ),
      );
      break;
    }
    case "dd:karen-shuffle": {
      const i = s.player.discard.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = s.player.discard.splice(i, 1);
      ports.shuffleIntoDeck(s, s.activePlayerId, p);
      ports.log(s, `Karen Page shuffles ${name(p)} into the deck.`, "good");
      break;
    }
    case "dd:draw":
      ports.draw(s, String(e.playerId), Number(e.n || 1));
      break;
    case "dd:club": {
      const p = s.player.inPlay.find(
        (q) => q.id === e.id && q.code === BILLY_CLUB,
      );
      if (!p) break;
      ports.returnToHand(s, p.id);
      ports.log(s, "Daredevil's Billy Club returns to your hand.");
      const enemies = ports.enemies(s, false);
      ports.choose(s, "Daredevil's Billy Club", "Choose one.", [
        ...(enemies.length
          ? [
              O("damage", "Deal 1 damage to an enemy", [
                E("target", {
                  group: "enemy",
                  title: "Daredevil's Billy Club",
                  action: E("damage", { amount: 1, source: "hero" }),
                }),
              ]),
            ]
          : []),
        O(
          "aerial",
          "Daredevil gains the Aerial trait until the end of the round",
          [D("aerial")],
        ),
      ]);
      break;
    }
    case "dd:aerial":
      s.flags.ddAerialRound = s.round;
      ports.log(
        s,
        "Daredevil gains the Aerial trait until the end of the round.",
        "good",
      );
      break;
    case "dd:fearless": {
      const id = String(e.id);
      ports.queue(
        s,
        E("damage", { target: "hero", amount: 1, source: id }),
        D("fearless-choose", { id, playerId: s.activePlayerId }),
      );
      break;
    }
    case "dd:fearless-choose": {
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || s.player.form !== "hero") break;
      const free = freeSenses(s, ports);
      const ready = s.player.exhausted && ports.canReadyIdentity(s, playerId);
      const options = [
        ...(free.length
          ? [
              O(
                "sense",
                "Play an upgrade from the Sense deck, ignoring its cost",
                [D("choose-free", { title: "The Man Without Fear" })],
              ),
            ]
          : []),
        ...(ready
          ? [O("ready", "Ready Daredevil", [E("ready", { target: "hero" })])]
          : []),
      ];
      if (options.length)
        ports.choose(s, "The Man Without Fear", "Choose one.", options);
      break;
    }
    case "dd:sense-reward": {
      // Acute Tactility (ready your identity) or Enhanced Olfaction (the
      // next card you play this phase costs 2 less). Discarding is the
      // cost: the card goes to the bottom of the Sense deck.
      const playerId = String(e.playerId);
      const p = ports.find(s, String(e.id));
      const code = p?.code ?? String(e.code || "");
      if (p) ports.discard(s, p.id);
      if (!alive(s, playerId)) break;
      if (code === ACUTE_TACTILITY) {
        if (ports.canReadyIdentity(s, playerId))
          ports.queue(s, E("ready", { target: heroTarget(playerId) }));
      } else if (code === ENHANCED_OLFACTION) {
        seatView(s, playerId).flags.ddOlfaction = olfactionKey(s);
        ports.log(
          s,
          "Enhanced Olfaction: the next card you play this phase costs 2 less.",
          "good",
        );
      }
      break;
    }
    case "dd:radar": {
      const p = ports.find(s, String(e.id));
      const target = String(e.target);
      if (!p) break;
      ports.discard(s, p.id);
      if (target !== s.villain.id && !s.minions.some((q) => q.id === target))
        break;
      ports.attack(
        s,
        [
          E("damage", {
            target,
            amount: 3,
            attack: true,
            source: "hero",
            attackInitiated: true,
          }),
        ],
        [],
      );
      break;
    }
    case "dd:taste": {
      const p = ports.find(s, String(e.id));
      if (!p) break;
      ports.discard(s, p.id);
      ports.queue(
        s,
        E("thwart", {
          target: String(e.target),
          amount: 2,
          action: true,
          source: "hero",
        }),
      );
      break;
    }
    case "dd:hearing": {
      const p = ports.find(s, String(e.id));
      const a = s.attack;
      const after: Effect[] = e.after || [];
      if (!p || !a || a.attacker !== e.attacker) {
        ports.queue(s, ...after);
        break;
      }
      ports.discard(s, p.id);
      a.modifier = (a.modifier || 0) - 3;
      const playerId = String(e.playerId);
      if (ports.canDefend(s, playerId)) ports.claimDefense(s, playerId);
      ports.log(
        s,
        "Heightened Hearing: the attacking enemy gets -3 ATK, and Daredevil becomes its target.",
        "good",
      );
      ports.queue(
        s,
        ...after.map((x) =>
          x.type === "enemyAttackInitiationWindow"
            ? { ...x, modifier: a.modifier, playerId: a.targetPlayerId }
            : x,
        ),
      );
      break;
    }
    case "dd:maggie": {
      const status = (["stunned", "confused", "tough"] as const).filter(
        (x) => !!s.player[x],
      );
      if (!status.length) break;
      if (status.length === 1) {
        ports.removeStatus(s, "hero", status[0]);
        break;
      }
      ports.choose(
        s,
        "Sister Maggie",
        "Discard a status card from your identity.",
        status.map((x) =>
          O(x, `Discard ${x}`, [D("maggie-status", { status: x })]),
        ),
      );
      break;
    }
    case "dd:maggie-status":
      ports.removeStatus(
        s,
        "hero",
        e.status as "stunned" | "confused" | "tough",
      );
      break;
    case "dd:nelson":
      ports.queue(
        s,
        E("target", {
          group: "enemy",
          title: "Nelson and Murdock",
          action: E("status", { status: "confused" }),
        }),
      );
      break;
    case "dd:focus": {
      // When Defeated: move Sense upgrades in play, then put any from the
      // Sense deck into play.
      ports.queue(s, D("focus-move", { moved: [] }));
      break;
    }
    case "dd:focus-move": {
      const moved: string[] = e.moved || [];
      const movable = allInPlay(s).filter(
        (p) =>
          senseCode(p) &&
          s.player.inPlay.some((q) => q.id === p.id) &&
          !moved.includes(p.id) &&
          (daredevilAttachmentTargets(s, p, ports) || []).some(
            (t) => !attachedTo(s, p, t.id),
          ),
      );
      if (!movable.length) {
        ports.queue(s, D("focus-put"));
        break;
      }
      ports.choose(
        s,
        "Focus the Senses",
        "You may move a Sense upgrade in play to another card it can attach to.",
        [
          ...movable.map((p) =>
            O(
              p.id,
              `Move ${name(p)}`,
              [D("focus-move-pick", { id: p.id, moved })],
              p.code,
            ),
          ),
          O("done", "Move no more Sense upgrades", [D("focus-put")]),
        ],
      );
      break;
    }
    case "dd:focus-move-pick": {
      const p = ports.find(s, String(e.id));
      const moved: string[] = e.moved || [];
      if (!p) {
        ports.queue(s, D("focus-move", { moved }));
        break;
      }
      const list = (daredevilAttachmentTargets(s, p, ports) || []).filter(
        (t) => !attachedTo(s, p, t.id),
      );
      ports.choose(
        s,
        name(p),
        `Move ${name(p)} to another card.`,
        list.map((t) =>
          O(
            t.id,
            t.label,
            [
              D("focus-move-to", { id: p.id, target: t.id }),
              D("focus-move", { moved: [...moved, p.id] }),
            ],
            t.code,
          ),
        ),
      );
      break;
    }
    case "dd:focus-move-to": {
      const p = ports.find(s, String(e.id));
      if (p) attachSense(s, p, String(e.target));
      break;
    }
    case "dd:focus-put": {
      const ready = daredevilSenseDeck(s).filter(
        (p) => (daredevilAttachmentTargets(s, p, ports) || []).length > 0,
      );
      if (!ready.length) break;
      ports.choose(
        s,
        "Focus the Senses",
        "You may put an upgrade from the Sense deck into play.",
        [
          ...ready.map((p) =>
            O(
              p.id,
              `Put ${name(p)} into play`,
              [D("focus-put-card", { id: p.id }), D("focus-put")],
              p.code,
            ),
          ),
          O("done", "Put no more Sense upgrades into play", []),
        ],
      );
      break;
    }
    case "dd:focus-put-card": {
      const p = daredevilTakeFromSense(s, String(e.id));
      if (!p) break;
      ports.putIntoPlay(s, p);
      ports.log(s, `${name(p)} enters play from the Sense deck.`, "good");
      break;
    }
    case "dd:overload-give": {
      // Give to the Matt Murdock player.
      const p = e.piece as Piece;
      const holder = playerOrder(s).find(
        (seat) => seatView(s, seat).heroId === DAREDEVIL_ID,
      );
      if (!holder) {
        ports.removeFromGame(s, p.id);
        break;
      }
      ports.giveObligation(s, p, holder.id);
      ports.log(s, "Sensory Overload stays in play with Matt Murdock.", "bad");
      break;
    }
    case "dd:bullseye": {
      // When Revealed: discard a Persona support you control, or Bullseye
      // attacks you (even in alter-ego form).
      const playerId = String(e.playerId);
      const bullseye = s.minions.find((q) => q.id === e.id);
      if (!alive(s, playerId)) break;
      const attack = bullseye
        ? [
            O("attack", "Bullseye attacks you", [
              D("activate", { enemyId: bullseye.id, playerId, kind: "attack" }),
            ]),
          ]
        : [];
      const personas = personaSupports(s);
      const discard = personas.length
        ? [
            O("discard", "Discard a Persona support you control", [
              D("discard-persona", { remove: false }),
            ]),
          ]
        : [];
      const options = [...discard, ...attack];
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else if (options.length)
        ports.choose(s, "Bullseye", "When Revealed: choose one.", options);
      break;
    }
    case "dd:discard-persona": {
      const remove = !!e.remove;
      const list = remove
        ? [
            ...s.player.inPlay.filter(
              (q) =>
                card(q).type_code === "ally" &&
                card(q).faction_code !== "encounter",
            ),
            ...personaSupports(s),
          ]
        : personaSupports(s);
      if (!list.length) break;
      ports.choose(
        s,
        remove ? "Eye on the Target" : "Bullseye",
        remove
          ? "Remove an ally or Persona support you control from the game."
          : "Discard a Persona support you control.",
        list.map((q) =>
          O(
            q.id,
            name(q),
            [D(remove ? "remove-piece" : "discard-piece", { id: q.id })],
            q.code,
          ),
        ),
      );
      break;
    }
    case "dd:discard-piece":
      if (ports.find(s, String(e.id))) ports.discard(s, String(e.id));
      break;
    case "dd:remove-piece":
      if (ports.find(s, String(e.id))) {
        ports.log(
          s,
          `${name(ports.find(s, String(e.id))!)} is removed from the game.`,
          "bad",
        );
        ports.removeFromGame(s, String(e.id));
      }
      break;
    case "dd:activate": {
      const playerId = String(e.playerId);
      const enemy = String(e.enemyId);
      if (
        !alive(s, playerId) ||
        (enemy !== s.villain.id && !s.minions.some((q) => q.id === enemy))
      )
        break;
      ports.activate(s, {
        enemyId: enemy,
        playerId,
        kind: e.kind === "scheme" ? "scheme" : "attack",
        modifier: 0,
      });
      break;
    }
    case "dd:eye": {
      // When Revealed: remove an ally or Persona support you control from
      // the game, or Bullseye attacks you; if he is not in play, find him
      // and reveal him.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      const list = [
        ...s.player.inPlay.filter(
          (q) =>
            card(q).type_code === "ally" &&
            card(q).faction_code !== "encounter",
        ),
        ...personaSupports(s),
      ];
      const remove = list.length
        ? [
            O(
              "remove",
              "Remove an ally or Persona support you control from the game",
              [D("discard-persona", { remove: true })],
            ),
          ]
        : [];
      const attack = [
        O(
          "attack",
          bullseyeInPlay(s)
            ? "Bullseye attacks you"
            : "Find Bullseye and reveal him",
          [D("eye-attack", { playerId })],
        ),
      ];
      ports.choose(s, "Eye on the Target", "When Revealed: choose one.", [
        ...remove,
        ...attack,
      ]);
      break;
    }
    case "dd:eye-attack": {
      const playerId = String(e.playerId);
      const bullseye = bullseyeInPlay(s);
      if (bullseye) {
        ports.queue(
          s,
          D("activate", { enemyId: bullseye.id, playerId, kind: "attack" }),
        );
        break;
      }
      const zones = [
        s.encounter.deck,
        s.encounter.discard,
        ...s.players.map((seat) => seatView(s, seat).player.setAside || []),
      ];
      const zone = zones.find((z) => z.some((q) => q.code === BULLSEYE));
      if (!zone) {
        ports.log(s, "Bullseye cannot be found.");
        break;
      }
      const [found] = zone.splice(
        zone.findIndex((q) => q.code === BULLSEYE),
        1,
      );
      delete found.ownerId;
      ports.log(s, "Eye on the Target finds Bullseye.", "bad");
      ports.reveal(s, found, playerId);
      break;
    }
    case "dd:sai-attach": {
      // Attach to the enemy with the highest ATK. The revealed card is
      // still resolving until it attaches.
      const p =
        s.resolving.find((q) => q.id === e.id) ||
        s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      const enemies = ports.enemies(s, false);
      if (!enemies.length) break;
      const atk = (id: string) => ports.enemyAttack(s, id);
      const top = Math.max(...enemies.map((t) => atk(t.id)));
      const best = enemies.filter((t) => atk(t.id) === top);
      if (best.length === 1) {
        ports.queue(s, D("sai-to", { id: p.id, target: best[0].id }));
        break;
      }
      ports.choose(
        s,
        "Stolen Sai",
        "Attach to the enemy with the highest ATK.",
        best.map((t) =>
          O(t.id, t.label, [D("sai-to", { id: p.id, target: t.id })], t.code),
        ),
      );
      break;
    }
    case "dd:sai-to": {
      const p =
        s.resolving.find((q) => q.id === e.id) ||
        s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      s.attachments = s.attachments.filter((q) => q.id !== p.id);
      ports.attachEncounter(s, p, String(e.target));
      break;
    }
    case "dd:sai-pay":
      ports.pay(
        s,
        "Stolen Sai",
        2,
        ["physical", "physical"],
        [D("sai", { id: e.id })],
      );
      break;
    case "dd:sai": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      const elektra = allInPlay(s).find(
        (q) => q.code === ELEKTRA && q.id !== p.attachedTo,
      );
      ports.choose(s, "Stolen Sai", "Choose one.", [
        ...(elektra
          ? [
              O("elektra", "Attach Stolen Sai to Elektra", [
                D("sai-to", { id: p.id, target: elektra.id }),
              ]),
            ]
          : []),
        O("discard", "Discard Stolen Sai", [D("discard-piece", { id: p.id })]),
      ]);
      break;
    }
    default:
      return false;
  }
  return true;
}
