/**
 * Fear No Evil's aspect and basic player cards from the two hero starter
 * decks. Daredevil's justice and basic cards: Blindspot, Cloak and Dagger,
 * Ghost Rider, Know Your Enemy, De-escalation, Legal Trouble, Move in Shadow,
 * Stealth Training, Stick, Contingency Planning and Dance with the Devil.
 * Echo's protection and basic cards: Innate Reflexes, Army of One, Get Their
 * Attention, In Harm's Way, The Best Offense..., Ronin, Stand Alone and See
 * No Evil, Hear No Evil. Chance Encounter (60025), Powerful Punch (60051) and
 * Superpower Training (60056) reprint 26034, 32014 and 40059 and resolve
 * through their native rules codes.
 *
 * Keywords new in Fear No Evil (rules insert):
 * - Discount X (traits): the card costs X less if your identity has one of
 *   the listed traits.
 * - Temporary: discard this card from play at the end of the round.
 * - Team-Up (A and B): playable only while friendly characters titled A
 *   and B are in play (deck building also needs one of them as identity).
 * - Tuck: tucked cards are faceup, not in play, and are discarded when the
 *   card they are under leaves play.
 * - Starting: before drawing their starting hand, a player may search their
 *   deck for its card with Starting and add it as the first card of that
 *   hand. It counts against the hand size and can be mulliganed.
 */
import { card } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { deadpoolTriggeredBlocked } from "./deadpool.js";
import { allInPlay, controller, playerOrder, seatView } from "./team.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

export const BLINDSPOT = "60019";
export const CLOAK = "60020";
export const DAGGER = "60021";
export const GHOST_RIDER = "60022";
export const KNOW_YOUR_ENEMY = "60023";
export const DE_ESCALATION = "60024";
export const CHANCE_ENCOUNTER = "60025";
export const LEGAL_TROUBLE = "60026";
export const MOVE_IN_SHADOW = "60027";
export const STEALTH_TRAINING = "60028";
export const STICK = "60029";
export const CONTINGENCY_PLANNING = "60030";
export const DANCE_WITH_THE_DEVIL = "60031";
export const INNATE_REFLEXES = "60038";
export const ARMY_OF_ONE = "60048";
export const GET_THEIR_ATTENTION = "60049";
export const IN_HARMS_WAY = "60050";
export const BEST_OFFENSE = "60052";
export const RONIN = "60053";
export const STAND_ALONE = "60054";
export const SEE_NO_EVIL = "60055";
/** Daredevil's starter deck: justice and basic cards with native rules.
 * Chance Encounter is registered as a reprint of 26034. */
export const FNE_JUSTICE_CODES: readonly string[] = [
  BLINDSPOT,
  CLOAK,
  DAGGER,
  GHOST_RIDER,
  KNOW_YOUR_ENEMY,
  DE_ESCALATION,
  LEGAL_TROUBLE,
  MOVE_IN_SHADOW,
  STEALTH_TRAINING,
];
export const FNE_BASIC_CODES: readonly string[] = [
  STICK,
  CONTINGENCY_PLANNING,
  DANCE_WITH_THE_DEVIL,
];
/** Echo's starter deck: protection and basic cards with native rules.
 * Powerful Punch and Superpower Training are registered as reprints. */
export const FNE_PROTECTION_CODES: readonly string[] = [
  INNATE_REFLEXES,
  ARMY_OF_ONE,
  GET_THEIR_ATTENTION,
  IN_HARMS_WAY,
  BEST_OFFENSE,
  RONIN,
  STAND_ALONE,
];
export const FNE_ECHO_BASIC_CODES: readonly string[] = [SEE_NO_EVIL];
export const FNE_PLAYER_PACK_SCRIPT_CODES: readonly string[] = [
  ...FNE_JUSTICE_CODES,
  ...FNE_BASIC_CODES,
  ...FNE_PROTECTION_CODES,
  ...FNE_ECHO_BASIC_CODES,
];
/** Events played only in their reaction window. */
export const FNE_REACTION_CODES: readonly string[] = [GET_THEIR_ATTENTION];

export interface FnePackTarget {
  id: string;
  label: string;
  code?: string;
}
export interface FnePackPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  find(s: GameState, id: string): Piece | undefined;
  enemies(s: GameState, attack: boolean): FnePackTarget[];
  schemes(s: GameState, thwart: boolean): FnePackTarget[];
  canAttach(s: GameState, p: Piece, target: string): boolean;
  canStatus(
    s: GameState,
    id: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  hasTrait(s: GameState, id: string, trait: string): boolean;
  heroName(s: GameState, playerId: string): string;
  canPay(s: GameState, cost: number, requirements: Resource[]): boolean;
  pay(
    s: GameState,
    title: string,
    cost: number,
    requirements: Resource[],
    after: Effect[],
  ): void;
  canPutIntoPlay(s: GameState, p: Piece): boolean;
  putIntoPlay(s: GameState, p: Piece): void;
  discard(s: GameState, id: string): void;
  attack(s: GameState, effects: Effect[], after: Effect[]): void;
  transferControl(s: GameState, id: string, playerId: string): void;
  heroDefense(s: GameState): number;
  canReadyIdentity(s: GameState): boolean;
  cardCost(s: GameState, p: Piece): number;
  canPayCard(s: GameState, p: Piece): boolean;
  /** Events playable now from the hand or as if from hand. */
  eventSources(s: GameState): Piece[];
  shuffleDeck(s: GameState): void;
  /** Play a reaction event from its source as if from hand: pay its cost,
   * resolve these effects, then continue with `after`. */
  playReaction(
    s: GameState,
    p: Piece,
    effects: Effect[],
    after: Effect[],
  ): void;
}

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  ...args,
  type,
});
const P = (type: string, args: Record<string, unknown> = {}) =>
  E(`fnep:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const name = (p: Piece | string) => card(p).name;
const plain = (text = "") => text.replace(/<[^>]*>/g, "");
const live = (s: GameState, p: Piece) => !isTextBlank(s, p);
const alive = (s: GameState, playerId: string) =>
  s.players.some((seat) => seat.id === playerId && !seat.eliminated);
const traitsOf = (p: Piece | string) =>
  (card(p).traits || "").replace(/\.$/, "").split(/\.\s*/).filter(Boolean);
const own = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && live(s, p));
const inPlay = (s: GameState, code: string) =>
  allInPlay(s).some((p) => p.code === code && live(s, p));

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

/** Discount X (traits): the printed traits named in the keyword. */
export function fnePackDiscount(
  c: Card,
): { amount: number; traits: string[] } | null {
  const m = /Discount\s+(\d+)\s*\(([^)]*)\)/i.exec(plain(c.text));
  if (!m) return null;
  const traits = [...m[2].matchAll(/\[\[([^\]]+)\]\]/g)].map((x) =>
    x[1].trim(),
  );
  return { amount: Number(m[1]), traits };
}
/** Discount X: less to play when the identity has a listed trait. */
export function fnePackCostModifier(
  s: GameState,
  c: Card,
  identityHasTrait: (trait: string) => boolean,
): number {
  // Army of One and In Harm's Way: 1 more for each ally you control.
  if (c.code === ARMY_OF_ONE || c.code === IN_HARMS_WAY)
    return alliesControlled(s);
  const discount = fnePackDiscount(c);
  if (!discount || !FNE_PLAYER_PACK_SCRIPT_CODES.includes(c.code)) return 0;
  return discount.traits.some(identityHasTrait) ? -discount.amount : 0;
}
const alliesControlled = (s: GameState) =>
  s.player.inPlay.filter((p) => card(p).type_code === "ally").length;
export const isStarting = (p: Piece | string) =>
  /(?:^|[.\n])\s*Starting\b/.test(plain(card(p).text));
/** Starting: the card a player may add as the first card of their starting
 * hand (each deck holds at most one). */
export function fnePackStartingCard(s: GameState): Piece | undefined {
  return s.player.deck.find(
    (p) => isStarting(p) && FNE_PLAYER_PACK_SCRIPT_CODES.includes(p.code),
  );
}
/** Innate Reflexes, The Best Offense... and Ronin: +1 DEF; The Best
 * Offense... uses DEF in place of THW and ATK, ignoring their modifiers. */
export function fnePackHeroStats<
  T extends { attack: number; thwart: number; defense: number },
>(s: GameState, stats: T): T {
  const count = (code: string) =>
    s.player.inPlay.filter((p) => p.code === code && live(s, p)).length;
  const offense = count(BEST_OFFENSE);
  const defense =
    stats.defense +
    count(INNATE_REFLEXES) +
    offense +
    (alliesControlled(s) ? 0 : count(RONIN));
  return offense
    ? { ...stats, defense, attack: defense, thwart: defense }
    : { ...stats, defense };
}
/** Ronin: retaliate 1 while you do not control any allies. */
export function fnePackRetaliate(s: GameState): number {
  return !alliesControlled(s) &&
    s.player.inPlay.some((p) => p.code === RONIN && live(s, p))
    ? 1
    : 0;
}
export const isTemporary = (p: Piece | string) =>
  /(?:^|[.\n])\s*Temporary\b/.test(plain(card(p).text));
/** Temporary: discarded from play at the end of the round. */
export function fnePackRoundEnded(s: GameState): Effect[] {
  return allInPlay(s)
    .filter(
      (p) =>
        isTemporary(p) &&
        FNE_PLAYER_PACK_SCRIPT_CODES.includes(p.code) &&
        !isTextBlank(s, p),
    )
    .map((p) => E("discardPiece", { id: p.id }));
}
/** Team-Up (A and B): a friendly character titled (or subtitled) A and one
 * titled B are in play. */
export function fnePackTeamUp(
  s: GameState,
  names: string[],
  heroName: (s: GameState, playerId: string) => string,
): boolean {
  const characters: { title: string; subtitle?: string }[] = [
    // An identity in hero form is titled with its hero name.
    ...playerOrder(s)
      .filter((seat) => seatView(s, seat).player.form === "hero")
      .map((seat) => ({ title: heroName(s, seat.id) })),
    ...allInPlay(s)
      .filter(
        (p) =>
          card(p).type_code === "ally" && card(p).faction_code !== "encounter",
      )
      .map((p) => ({
        title: card(p).name,
        subtitle: (card(p) as Card & { subname?: string }).subname,
      })),
  ];
  return names.every((n) =>
    characters.some((c) => c.title === n || c.subtitle === n),
  );
}
export function fnePackTeamUpNames(p: Piece | string): string[] | null {
  const m = /Team-Up\s*\(([^)]+)\)/i.exec(plain(card(p).text));
  return m ? m[1].split(/\s+and\s+/i).map((n) => n.trim()) : null;
}

// ---------------------------------------------------------------------------
// Playing and entering play
// ---------------------------------------------------------------------------

const minionTargets = (s: GameState, p: Piece, ports: FnePackPorts) =>
  s.minions
    .filter(
      (m) =>
        !allInPlay(s).some(
          (q) =>
            q.code === LEGAL_TROUBLE && q.attachedTo === m.id && q.id !== p.id,
        ) && ports.canAttach(s, p, m.id),
    )
    .map((m) => ({ id: m.id, label: name(m), code: m.code }));
const enemyTargets = (s: GameState, p: Piece, ports: FnePackPorts) =>
  ports.enemies(s, false).filter((t) => ports.canAttach(s, p, t.id));
/** Where an upgrade of this pack attaches. Null for any other card. */
export function fnePackAttachmentTargets(
  s: GameState,
  p: Piece,
  ports: FnePackPorts,
): FnePackTarget[] | null {
  if (p.code === LEGAL_TROUBLE) return minionTargets(s, p, ports);
  if (p.code === DANCE_WITH_THE_DEVIL) return enemyTargets(s, p, ports);
  return null;
}
export function fnePackPlayRestriction(
  s: GameState,
  p: Piece,
  ports: FnePackPorts,
): string | null {
  const targets = fnePackAttachmentTargets(s, p, ports);
  if (targets && !targets.length)
    return p.code === LEGAL_TROUBLE
      ? "Legal Trouble needs a minion without Legal Trouble."
      : `${name(p)} has no enemy to attach to.`;
  const team = fnePackTeamUpNames(p);
  if (
    team &&
    FNE_PLAYER_PACK_SCRIPT_CODES.includes(p.code) &&
    !fnePackTeamUp(s, team, ports.heroName)
  )
    return `Team-Up: ${team.join(" and ")} must both be in play.`;
  if (
    p.code === KNOW_YOUR_ENEMY &&
    !s.player.confused &&
    !ports.schemes(s, true).length
  )
    return "There is no threat to remove.";
  if (
    p.code === ARMY_OF_ONE &&
    (!s.player.exhausted || !ports.canReadyIdentity(s))
  )
    return "Your hero is not exhausted.";
  return null;
}
export function fnePackEvent(s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case KNOW_YOUR_ENEMY: {
      const thwart = schemeThwart("Know Your Enemy", 1);
      return [thwart, thwart];
    }
    case ARMY_OF_ONE:
      return [E("ready", { target: "hero" })];
    case IN_HARMS_WAY:
      return [P("harm")];
    case SEE_NO_EVIL:
      return [P("see-no-evil")];
  }
  return null;
}
/** A thwart-labeled removal from a scheme the player chooses. */
const schemeThwart = (title: string, amount: number) =>
  E("target", {
    group: "scheme",
    title,
    action: E("thwart", { amount, action: true }),
  });
/** Attack-labeled damage to an enemy the player chooses. */
const enemyAttack = (title: string, amount: number) =>
  E("target", {
    group: "enemy",
    title,
    action: E("damage", {
      amount,
      attack: true,
      source: "hero",
      attackInitiated: true,
    }),
  });
/** Get Their Attention (Hero Interrupt, defense/thwart) and Stand Alone
 * (Hero Interrupt) when an enemy initiates an attack. Get Their Attention
 * comes from the hand or any source that plays events as if from hand. */
export function fnePackAttackInitiatedOptions(
  s: GameState,
  attackedPlayerId: string,
  sources: Piece[],
  ports: FnePackPorts,
): Option[] {
  if (s.player.form !== "hero" || deadpoolTriggeredBlocked(s)) return [];
  const attention = sources
    .filter((p) => p.code === GET_THEIR_ATTENTION && ports.canPayCard(s, p))
    .map((p) =>
      O(
        `attention:${p.id}`,
        `Get Their Attention · remove 3 threat (${ports.cardCost(s, p)} resources)`,
        [P("attention-play", { id: p.id })],
        p.code,
      ),
    );
  const stand =
    s.activePlayerId === attackedPlayerId &&
    !alliesControlled(s) &&
    s.player.exhausted &&
    ports.canReadyIdentity(s)
      ? own(s, STAND_ALONE)
          .filter((q) => !q.exhausted)
          .map((q) =>
            O(
              `stand-alone:${q.id}`,
              "Stand Alone · exhaust it: ready your hero",
              [P("stand-alone", { id: q.id })],
              q.code,
            ),
          )
      : [];
  return [...attention, ...stand];
}
export function fnePackEntered(s: GameState, p: Piece): Effect[] {
  if (p.code === LEGAL_TROUBLE || p.code === DANCE_WITH_THE_DEVIL)
    return p.attachedTo ? [] : [P("attach", { id: p.id })];
  if (p.code === STEALTH_TRAINING && s.playerCount > 1)
    return [P("stealth-control", { id: p.id })];
  return [];
}
/** Contingency Planning: the upgrade tucked here plays as if in hand. */
export function fnePackStoredPlayable(s: GameState): Piece[] {
  return own(s, CONTINGENCY_PLANNING).flatMap((p) => p.storedCards || []);
}
export function fnePackTakeStored(s: GameState, id: string): Piece | undefined {
  for (const p of own(s, CONTINGENCY_PLANNING)) {
    const i = (p.storedCards || []).findIndex((q) => q.id === id);
    if (i >= 0) return p.storedCards!.splice(i, 1)[0];
  }
  return undefined;
}
/** Contingency Planning tucks an upgrade that can attach to a minion or a
 * side scheme. */
const tuckable = (p: Piece) =>
  card(p).type_code === "upgrade" &&
  /Attach to (?:a |an )?(?:minion|side scheme|enemy|scheme)/i.test(
    plain(card(p).text),
  );
/** Move in Shadow: after you play a card (including this one). */
export function fnePackCardPlayed(s: GameState, p: Piece): Effect[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  const sources = [
    ...own(s, MOVE_IN_SHADOW).filter((q) => q.id !== p.id),
    ...(p.code === MOVE_IN_SHADOW ? [p] : []),
  ];
  return sources.map((q) =>
    E("optional", {
      title: "Move in Shadow",
      text: "Remove 1 threat from a scheme?",
      effects: [
        E("target", {
          group: "scheme",
          title: "Move in Shadow",
          action: E("thwart", { amount: 1, action: true }),
        }),
      ],
      sourceId: q.id,
      image: q.code,
    }),
  );
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

function findDagger(s: GameState): Piece | undefined {
  return [
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.discard,
    ...(s.player.setAside || []),
  ].find((p) => p.code === DAGGER);
}
export function fnePackAbilityOptions(
  s: GameState,
  id: string,
  ports: FnePackPorts,
): Option[] {
  const p = s.player.inPlay.find((q) => q.id === id);
  if (!p || !live(s, p) || deadpoolTriggeredBlocked(s)) return [];
  if (p.code === CLOAK && !p.exhausted) {
    const dagger = findDagger(s);
    return dagger &&
      !inPlay(s, DAGGER) &&
      ports.canPay(s, 2, ["energy", "energy"]) &&
      ports.canPutIntoPlay(s, dagger)
      ? [
          O(
            "cloak",
            "Cloak · exhaust and spend 2 energy resources: find Dagger and put her into play",
            [E("exhaust", { id }), P("cloak-pay", { id })],
            p.code,
          ),
        ]
      : [];
  }
  if (
    p.code === CONTINGENCY_PLANNING &&
    !(p.storedCards || []).length &&
    s.player.hand.some(tuckable)
  )
    return [
      O(
        "tuck",
        "Contingency Planning · tuck an upgrade from your hand",
        [P("tuck", { id })],
        p.code,
      ),
    ];
  if (
    p.code === DANCE_WITH_THE_DEVIL &&
    s.player.form === "hero" &&
    p.attachedTo
  )
    return [
      O(
        "dance",
        "Dance with the Devil · discard it: deal 3 damage to the attached enemy",
        [P("dance", { id, target: p.attachedTo })],
        p.code,
      ),
    ];
  return [];
}
// ---------------------------------------------------------------------------
// Triggered abilities and constant effects
// ---------------------------------------------------------------------------

/** Legal Trouble: the attached minion gets -2 SCH. */
export function fnePackEnemyStat(
  s: GameState,
  p: Piece,
  stat: "attack" | "scheme",
): number {
  if (stat !== "scheme") return 0;
  return (
    -2 *
    allInPlay(s).filter(
      (q) => q.code === LEGAL_TROUBLE && q.attachedTo === p.id && live(s, q),
    ).length
  );
}
/** Dagger takes 1 less consequential damage after a basic power while
 * Cloak is in play. */
export function fnePackConsequentialReduction(s: GameState, p: Piece): number {
  return p.code === DAGGER && live(s, p) && inPlay(s, CLOAK) ? 1 : 0;
}
/** Blindspot: after he thwarts, confuse an enemy with an upgrade attached. */
export function fnePackAfterAllyThwart(
  s: GameState,
  p: Piece,
  ports: FnePackPorts,
): Effect[] {
  if (p.code !== BLINDSPOT || !live(s, p) || deadpoolTriggeredBlocked(s))
    return [];
  return upgradedEnemies(s, ports).some((t) =>
    ports.canStatus(s, t.id, "confused"),
  )
    ? [
        E("optional", {
          title: "Blindspot",
          text: "Confuse an enemy with an upgrade attached?",
          effects: [P("blindspot")],
          sourceId: p.id,
          image: p.code,
        }),
      ]
    : [];
}
function upgradedEnemies(s: GameState, ports: FnePackPorts) {
  return ports
    .enemies(s, false)
    .filter((t) =>
      allInPlay(s).some(
        (q) => card(q).type_code === "upgrade" && q.attachedTo === t.id,
      ),
    );
}
/** Ghost Rider: when he attacks an enemy, spend an energy resource (two
 * against the villain) to confuse it. Stick: a Martial Artist ally's basic
 * power. */
export function fnePackBeforeAlly(
  s: GameState,
  p: Piece,
  e: Effect,
  ports: FnePackPorts,
): Effect[] | null {
  if (deadpoolTriggeredBlocked(s)) return null;
  const attack = e.kind === "attack";
  if (
    attack &&
    p.code === GHOST_RIDER &&
    !e.fnepGhostHandled &&
    !p.stunned &&
    live(s, p) &&
    e.target
  ) {
    const villain = e.target === s.villain.id;
    const cost = villain ? 2 : 1;
    const requirements = Array(cost).fill("energy") as Resource[];
    if (
      ports.canPay(s, cost, requirements) &&
      ports.canStatus(s, String(e.target), "confused")
    )
      return [
        E("optional", {
          title: "Ghost Rider",
          text: `Spend ${cost === 1 ? "an energy resource" : "2 energy resources"} to confuse the enemy Ghost Rider attacks?`,
          effects: [P("ghost-pay", { target: e.target, cost })],
          image: p.code,
        }),
        { ...e, fnepGhostHandled: true },
      ];
  }
  const stick = stickOptions(
    s,
    traitsOf(p).includes("Martial Artist") &&
      !(attack ? p.stunned : p.confused),
    e,
    "fnepStickHandled",
    (delta) => ({
      ...e,
      amount: Math.max(0, Number(e.amount ?? 0) + delta),
      fnepStickHandled: true,
    }),
  );
  if (stick) return stick;
  return null;
}
function stickOptions(
  s: GameState,
  martialArtist: boolean,
  e: Effect,
  flag: string,
  next: (delta: number) => Effect,
): Effect[] | null {
  if (!martialArtist || e[flag]) return null;
  const sticks = playerOrder(s).flatMap((seat) =>
    seatView(s, seat)
      .player.inPlay.filter((q) => q.code === STICK && live(s, q))
      .map((q) => ({ q, seat: seat.id })),
  );
  if (!sticks.length) return null;
  const options: Option[] = sticks.flatMap(({ q, seat }) =>
    q.exhausted
      ? [
          O(
            `${q.id}:minus`,
            "Stick · -1 to this basic power and ready Stick",
            [E("ready", { id: q.id, actorId: seat }), next(-1)],
            q.code,
          ),
        ]
      : [
          O(
            `${q.id}:plus`,
            "Stick · exhaust Stick: +1 to this basic power",
            [E("exhaust", { id: q.id, actorId: seat }), next(1)],
            q.code,
          ),
        ],
  );
  return [
    P("choose", {
      title: "Stick",
      text: "Interrupt this Martial Artist's basic power?",
      options: [...options, O("continue", "Continue", [next(0)])],
    }),
  ];
}
/** Stick: the identity's basic attack or thwart (a Martial Artist). */
export function fnePackBasicOptions(
  s: GameState,
  packet: Effect,
  identityIsMartialArtist: boolean,
): Effect[] | null {
  if (deadpoolTriggeredBlocked(s)) return null;
  return stickOptions(
    s,
    identityIsMartialArtist,
    packet,
    "fnepStickHandled",
    (delta) => ({
      ...packet,
      amount: Math.max(0, Number(packet.amount ?? 0) + delta),
      fnepStickHandled: true,
    }),
  );
}
/** Stealth Training: after you thwart and exactly defeat a side scheme. */
export function fnePackAfterThwart(
  s: GameState,
  receipt: { target: string; amount: number; before: number; removed: number },
  ports: FnePackPorts,
): Effect[] {
  if (deadpoolTriggeredBlocked(s)) return [];
  const side = receipt.target !== "main";
  if (
    !side ||
    receipt.before <= 0 ||
    receipt.removed !== receipt.before ||
    receipt.amount !== receipt.before
  )
    return [];
  if (!ports.enemies(s, false).some((t) => ports.canStatus(s, t.id, "stunned")))
    return [];
  return own(s, STEALTH_TRAINING)
    .filter((q) => !q.exhausted)
    .map((q) =>
      E("optional", {
        title: "Stealth Training",
        text: "Exhaust Stealth Training to stun an enemy?",
        effects: [
          E("exhaust", { id: q.id }),
          E("target", {
            group: "enemy",
            title: "Stealth Training",
            action: E("status", { status: "stunned" }),
          }),
        ],
        sourceId: q.id,
        image: q.code,
      }),
    );
}
/** De-escalation: When Defeated, remove an acceleration token from play. */
export function fnePackSchemeDefeated(s: GameState, p: Piece): Effect[] {
  return p.code === DE_ESCALATION ? [P("de-escalation")] : [];
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export function resolveFnePackEffect(
  s: GameState,
  e: Effect,
  ports: FnePackPorts,
): boolean {
  if (!e.type.startsWith("fnep:")) return false;
  switch (e.type) {
    case "fnep:choose":
      ports.choose(s, String(e.title), String(e.text), e.options || []);
      break;
    case "fnep:attach": {
      const p = ports.find(s, String(e.id));
      if (!p || p.attachedTo || !s.player.inPlay.some((q) => q.id === p.id))
        break;
      const list = fnePackAttachmentTargets(s, p, ports) || [];
      if (!list.length) {
        ports.log(s, `${name(p)} has nothing to attach to.`);
        ports.discard(s, p.id);
        break;
      }
      if (list.length === 1) {
        p.attachedTo = list[0].id;
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
            [P("attach-to", { id: p.id, target: t.id })],
            t.code,
          ),
        ),
      );
      break;
    }
    case "fnep:attach-to": {
      const p = ports.find(s, String(e.id));
      if (!p || p.attachedTo) break;
      if (
        !(fnePackAttachmentTargets(s, p, ports) || []).some(
          (t) => t.id === e.target,
        )
      ) {
        ports.queue(s, P("attach", { id: p.id }));
        break;
      }
      p.attachedTo = String(e.target);
      break;
    }
    case "fnep:stealth-control": {
      // Play under any player's control: one without Stealth Training.
      const p = ports.find(s, String(e.id));
      if (!p) break;
      const seats = playerOrder(s).filter(
        (seat) =>
          !seatView(s, seat).player.inPlay.some(
            (q) => q.code === STEALTH_TRAINING && q.id !== p.id,
          ),
      );
      if (seats.length < 2) break;
      ports.choose(
        s,
        "Stealth Training",
        "Choose the player who controls Stealth Training.",
        seats.map((seat) =>
          O(
            seat.id,
            ports.heroName(s, seat.id),
            seat.id === controller(s, p.id)?.id
              ? []
              : [P("control", { id: p.id, playerId: seat.id })],
          ),
        ),
      );
      break;
    }
    case "fnep:control":
      if (ports.find(s, String(e.id)) && alive(s, String(e.playerId)))
        ports.transferControl(s, String(e.id), String(e.playerId));
      break;
    case "fnep:cloak-pay":
      ports.pay(
        s,
        "Cloak",
        2,
        ["energy", "energy"],
        [P("cloak", { id: e.id })],
      );
      break;
    case "fnep:cloak": {
      const dagger = findDagger(s);
      if (!dagger || inPlay(s, DAGGER)) {
        ports.log(s, "Dagger cannot be found.");
        break;
      }
      for (const zone of [
        s.player.hand,
        s.player.deck,
        s.player.discard,
        s.player.setAside || [],
      ]) {
        const i = zone.findIndex((q) => q.id === dagger.id);
        if (i >= 0) zone.splice(i, 1);
      }
      ports.putIntoPlay(s, dagger);
      ports.log(s, "Cloak finds Dagger and puts her into play.", "good");
      break;
    }
    case "fnep:tuck": {
      const p = ports.find(s, String(e.id));
      if (!p || (p.storedCards || []).length) break;
      const list = s.player.hand.filter(tuckable);
      ports.choose(
        s,
        "Contingency Planning",
        "Tuck an upgrade from your hand under Contingency Planning.",
        list.map((q) =>
          O(
            q.id,
            name(q),
            [P("tuck-card", { id: p.id, cardId: q.id })],
            q.code,
          ),
        ),
      );
      break;
    }
    case "fnep:tuck-card": {
      const p = ports.find(s, String(e.id));
      const i = s.player.hand.findIndex((q) => q.id === e.cardId);
      if (!p || i < 0 || (p.storedCards || []).length) break;
      const [tucked] = s.player.hand.splice(i, 1);
      (p.storedCards ||= []).push(tucked);
      ports.log(
        s,
        `${name(tucked)} is tucked under Contingency Planning.`,
        "good",
      );
      break;
    }
    case "fnep:dance": {
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
    case "fnep:blindspot": {
      const list = upgradedEnemies(s, ports).filter((t) =>
        ports.canStatus(s, t.id, "confused"),
      );
      if (!list.length) break;
      if (list.length === 1) {
        ports.queue(s, E("status", { target: list[0].id, status: "confused" }));
        break;
      }
      ports.choose(
        s,
        "Blindspot",
        "Confuse an enemy with an upgrade attached.",
        list.map((t) =>
          O(
            t.id,
            t.label,
            [E("status", { target: t.id, status: "confused" })],
            t.code,
          ),
        ),
      );
      break;
    }
    case "fnep:ghost-pay": {
      const cost = Number(e.cost || 1);
      ports.pay(
        s,
        "Ghost Rider",
        cost,
        Array(cost).fill("energy") as Resource[],
        [E("status", { target: e.target, status: "confused" })],
      );
      break;
    }
    case "fnep:starting": {
      // Starting: the first card of the starting hand.
      const i = s.player.deck.findIndex((q) => q.id === e.id);
      if (i < 0) break;
      const [p] = s.player.deck.splice(i, 1);
      s.player.hand.push(p);
      s.flags.fnepStarting = Number(s.flags.fnepStarting || 0) + 1;
      ports.shuffleDeck(s);
      ports.log(s, `Starting: ${name(p)} begins in your hand.`, "good");
      break;
    }
    case "fnep:attention-play": {
      // Played from hand (or as if from hand): pay, then remove 3 threat.
      const after = (e.after as Effect[] | undefined) || [];
      const p = ports
        .eventSources(s)
        .find((q) => q.id === e.id && q.code === GET_THEIR_ATTENTION);
      if (p) ports.playReaction(s, p, [P("attention")], after);
      else ports.queue(s, ...after);
      break;
    }
    case "fnep:attention":
      ports.queue(s, schemeThwart("Get Their Attention", 3));
      break;
    case "fnep:stand-alone": {
      const p = own(s, STAND_ALONE).find((q) => q.id === e.id);
      if (p && !p.exhausted && ports.canReadyIdentity(s))
        ports.queue(
          s,
          E("exhaust", { id: p.id }),
          E("ready", { target: "hero" }),
          ...((e.after as Effect[] | undefined) || []),
        );
      else ports.queue(s, ...((e.after as Effect[] | undefined) || []));
      break;
    }
    case "fnep:harm": {
      // X is your DEF: deal X damage to an enemy, then remove X threat.
      const x = ports.heroDefense(s);
      ports.attack(
        s,
        [enemyAttack("In Harm's Way", x)],
        [schemeThwart("In Harm's Way", x)],
      );
      break;
    }
    case "fnep:see-no-evil":
      ports.choose(
        s,
        "See No Evil, Hear No Evil",
        "Choose 2 (the same option may be chosen twice).",
        [
          O("damage-damage", "Deal 3 damage to an enemy, twice", [
            P("see-no-evil-resolve", { damage: 2, threat: 0 }),
          ]),
          O("damage-threat", "Deal 3 damage and remove 3 threat", [
            P("see-no-evil-resolve", { damage: 1, threat: 1 }),
          ]),
          O("threat-threat", "Remove 3 threat from a scheme, twice", [
            P("see-no-evil-resolve", { damage: 0, threat: 2 }),
          ]),
        ],
      );
      break;
    case "fnep:see-no-evil-resolve": {
      const damage = Number(e.damage || 0);
      const threat = Array.from({ length: Number(e.threat || 0) }, () =>
        schemeThwart("See No Evil, Hear No Evil", 3),
      );
      if (damage)
        ports.attack(
          s,
          Array.from({ length: damage }, () =>
            enemyAttack("See No Evil, Hear No Evil", 3),
          ),
          threat,
        );
      else ports.queue(s, ...threat);
      break;
    }
    case "fnep:de-escalation": {
      if (s.encounter.acceleration > 0) {
        s.encounter.acceleration--;
        ports.log(s, "De-escalation removes an acceleration token.", "good");
        break;
      }
      const scheme = s.sideSchemes.find(
        (p) => Number(p.accelerationTokens) > 0,
      );
      if (scheme) {
        scheme.accelerationTokens = Number(scheme.accelerationTokens) - 1;
        ports.log(s, "De-escalation removes an acceleration token.", "good");
      }
      break;
    }
    default:
      return false;
  }
  return true;
}
