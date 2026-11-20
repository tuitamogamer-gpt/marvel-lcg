import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Trickster Takeover's first scenario: Enchantress casts a hypnotic gaze
 * on each hero, and the charm counters it gathers can put that hero into a
 * trance. With the Trickster Magic modular set, whose four beguiled minions
 * join the players as allies once defeated. */

export const ENCHANTRESS_CODES = [
  "55001",
  "55002",
  "55003",
  "55004a",
  "55004b",
  "55005a",
  "55005b",
  "55006",
  "55007a",
  "55007b",
  "55008a",
  "55008b",
  "55009a",
  "55009b",
  "55010a",
  "55010b",
  "55011a",
  "55011b",
  "55012",
  "55013",
  "55014",
  "55015",
  "55016",
  "55017",
  "55018",
  "55019",
  "55020",
  "55021",
  "55022",
  "55023",
  "55024",
  "55025",
  "55026",
] as const;
export const TRICKSTER_MAGIC_CODES = [
  "55056",
  "55057",
  "55058",
  "55059",
  "55060",
  "55061",
  "55062",
  "55063",
  "55064",
  "55065",
  "55066",
] as const;
export const ENCHANTRESS_MODULAR_SETS = ["trickster_magic"] as const;

const ENCHANTRESSES = ["55001", "55002", "55003"];
export const PRIME = "55004b";
export const SOVEREIGN = "55005b";
export const DESPAIR = "55006";
/** Hypnotic Gaze, each with its Trance on the back. */
export const GAZES: Record<string, string> = {
  "55007a": "55007b",
  "55008a": "55008b",
  "55009a": "55009b",
  "55010a": "55010b",
  "55011a": "55011b",
};
export const TRANCES = ["55007b", "55008b", "55009b", "55010b", "55011b"];
const ENVY = "55007b";
const GREED = "55008b";
const PRIDE = "55009b";
const SLOTH = "55010b";
const WRATH = "55011b";
const ALLURING = "55012";
const KISS = "55013";
const LOVE = "55014";
export const TEMPTATIONS = [ALLURING, KISS, LOVE];
/** Seduced reprints the Enchantress nemesis card: its rules live with
 * Valkyrie. */
const SEDUCED = "55015";
export const CROWN = "55016";
const LACKEY = "55017";
const BRUTE = "55018";
const SINDR = "55019";
const ULIK = "55020";
const LAW = "55021";
const SPELLBOUND = "55022";
const BIDDING = "55023";
const RESTRAINTS = "55024";
const BLAST = "55025";
const SHARDS = "55026";
// Trickster Magic
const ABSORBING = "55056";
const TITANIA = "55057";
const WHIRLWIND = "55058";
const ZZZAX = "55059";
const TANGO = "55060";
export const PUPPET = "55061";
export const TRIANGLE = "55062";
const CREEL = "55063";
const MARY = "55064";
const CANNON = "55065";
const ZZZAX_ALLY = "55066";
/** Each beguiled minion and the ally it becomes once defeated. */
const ALLY_OF: Record<string, string> = {
  [ABSORBING]: CREEL,
  [TITANIA]: MARY,
  [WHIRLWIND]: CANNON,
  [ZZZAX]: ZZZAX_ALLY,
};
/** Linked: set aside, out of every deck, until their minions fall. */
export const LINKED_ALLIES = [CREEL, MARY, CANNON, ZZZAX_ALLY];
const BEGUILED = Object.keys(ALLY_OF);
/** The encounter cards scripted here: every face but Seduced and the
 * allies. */
export const ENCHANTRESS_SCRIPT_CODES: readonly string[] = [
  ...ENCHANTRESS_CODES,
  ...TRICKSTER_MAGIC_CODES,
].filter((code) => code !== SEDUCED && !LINKED_ALLIES.includes(code));

export interface EnchantressState {
  /** Future of Despair until Enchantress puts it into play. */
  despair?: Piece;
  /** The Hypnotic Gazes no identity received. */
  gazes: Piece[];
  /** Ulik's attacks waiting for the card or activation in progress. */
  ulik?: { id: string; playerId: string }[];
}
/** The Trickster Magic set's allies, set aside until their minions fall. */
export interface TricksterMagicState {
  allies: Piece[];
}

export interface EnchantressPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
  heal(s: GameState, target: string, n: number): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  discardFromHand(s: GameState, playerId: string, id: string): void;
  randomDiscard(s: GameState, playerId: string): void;
  /** Discard the top cards of a player's deck; returns them. */
  mill(s: GameState, playerId: string, n: number): Piece[];
  /** The non-permanent player cards a player controls in play. */
  controlledCards(s: GameState, playerId: string): Piece[];
  canAddStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  /** Remove threat from a scheme; returns the threat removed. */
  removeThreat(s: GameState, target: string, n: number, source: string): number;
  shuffle<T>(s: GameState, items: T[]): T[];
  makePiece(s: GameState, code: string): Piece;
  heroName(s: GameState, playerId: string): string;
  /** Draw cards for the active player. */
  draw(s: GameState, n: number): void;
  /** Whether the active player can play this hand card, costing less. */
  playable(s: GameState, p: Piece, discount: number): boolean;
  /** Play a hand card of the active player, costing less. */
  play(s: GameState, id: string, discount: number): void;
  /** Put a set-aside ally into play under a player's control. */
  putAlly(s: GameState, p: Piece, playerId: string): void;
  /** Reveal the resolving boost card as an encounter card. */
  revealBoostCard(s: GameState, p: Piece): void;
  /** End the active player's turn, after its forced actions. */
  endTurn(s: GameState, discard: string[]): void;
  /** Shuffle the active player's deck. */
  shufflePlayerDeck(s: GameState): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const N = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `ench:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const seats = (s: GameState) => playerOrder(s).filter((x) => !x.eliminated);
const over = (s: GameState) => ["won", "lost"].includes(s.phase);
const expert = (s: GameState) => s.difficulty === "expert";
const activation = (s: GameState) => s.scheming || s.attack;
const boostPlayer = (s: GameState) =>
  s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
const hasTrait = (p: Piece | string, trait: string) =>
  (def(p)?.traits || "")
    .split(".")
    .map((t) => t.trim())
    .includes(trait);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const printedEnergy = (p: Piece) => Number(def(p)?.resource_energy || 0);
const identityOf = (playerId: string) => `hero:${playerId}`;
const attachedTo = (s: GameState, host: string) =>
  s.attachments.filter((a) => a.attachedTo === host);

export const enchantress = (s: GameState) => !!s.enchantress;
/** Enchantress is the villain in play, with her text. */
const enchantressInPlay = (s: GameState) =>
  !!s.villain && ENCHANTRESSES.includes(s.villain.code) && active(s, s.villain);
const despairInPlay = (s: GameState) =>
  s.sideSchemes.some((q) => q.code === DESPAIR && active(s, q));
/** The Enchantment card in a player's play area: the Hypnotic Gaze or its
 * Trance attached to their identity. */
export function enchantment(s: GameState, playerId: string) {
  return s.attachments.find(
    (a) =>
      a.attachedTo === identityOf(playerId) &&
      (!!GAZES[a.code] || TRANCES.includes(a.code)),
  );
}
/** A Hypnotic Gaze gives its identity the Defiant trait; a Trance, the
 * Enthralled trait. */
export function defiant(s: GameState, playerId: string) {
  const p = enchantment(s, playerId);
  return !!p && !!GAZES[p.code];
}
export function enthralled(s: GameState, playerId: string) {
  const p = enchantment(s, playerId);
  return !!p && TRANCES.includes(p.code);
}
/** The identity traits the Enchantments give. */
export function enchantressTrait(
  s: GameState,
  target: string,
  trait: string,
): boolean {
  if (trait !== "Defiant" && trait !== "Enthralled") return false;
  const playerId =
    target === "hero"
      ? s.activePlayerId
      : target.startsWith("hero:")
        ? target.slice(5)
        : undefined;
  if (!playerId) return false;
  return trait === "Defiant" ? defiant(s, playerId) : enthralled(s, playerId);
}

// ------------------------------------------------------------- interface

export function enchantressCaption(s: GameState) {
  if (!s.enchantress || !enchantressInPlay(s)) return "";
  return `After she attacks you: 1 charm counter on your Enchantment${despairInPlay(s) ? " · Future of Despair: stalwart, takes no damage" : ""}`;
}
export function enchantressObjective(s: GameState) {
  if (!s.enchantress) return "";
  const all = seats(s);
  const entranced = all.filter((seat) => enthralled(s, seat.id)).length;
  return `Defeat Enchantress · ${entranced} of ${all.length} ${all.length === 1 ? "hero" : "heroes"} entranced`;
}
export function enchantressMainNote(s: GameState) {
  if (!s.enchantress) return "";
  if (s.scheme.code === PRIME)
    return "An Enthralled hero's charm counters come here as threat";
  if (s.scheme.code === SOVEREIGN)
    return "Enthralled charm counters come here as threat · completed: the players lose";
  return "";
}
/** The Enchantment's caption: its charm counters, or its Forced Action. */
export function enchantmentCaption(p: Piece) {
  if (GAZES[p.code])
    return `${plural(p.counters || 0, "charm counter")} of 5 · Defiant`;
  if (TRANCES.includes(p.code))
    return `Enthralled · Forced Action ${p.exhausted ? "used this round" : "due this turn"}`;
  if (TEMPTATIONS.includes(p.code))
    return `Forced Action ${p.exhausted ? "used this round" : "due this turn"}`;
  return "";
}

// --------------------------------------------------------------- setup

/** Prime Real Estate (1A): Future of Despair is set aside, and each identity
 * gets a random Hypnotic Gaze; the rest are set aside. */
export function enchantressSetup(
  s: GameState,
  ports: Pick<EnchantressPorts, "shuffle" | "makePiece">,
) {
  const take = (code: string) => {
    const i = s.encounter.deck.findIndex((p) => p.code === code);
    return i >= 0 ? s.encounter.deck.splice(i, 1)[0] : ports.makePiece(s, code);
  };
  const despair = take(DESPAIR);
  const gazes = ports.shuffle(s, Object.keys(GAZES).map(take));
  s.encounter.deck = s.encounter.deck.filter(
    (p) => !GAZES[p.code] && !TRANCES.includes(p.code) && p.code !== DESPAIR,
  );
  for (const seat of seats(s)) {
    const gaze = gazes.shift();
    if (!gaze) break;
    gaze.counters = 0;
    gaze.exhausted = false;
    gaze.attachedTo = identityOf(seat.id);
    s.attachments.push(gaze);
  }
  s.enchantress = { despair, gazes };
  const main = def(PRIME);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
}
/** An Enchantment that leaves play with its eliminated player is set aside
 * again, Hypnotic Gaze side up. Returns whether it was. */
export function enchantressSetAside(s: GameState, p: Piece): boolean {
  if (!s.enchantress) return false;
  const front = GAZES[p.code]
    ? p.code
    : Object.keys(GAZES).find((code) => GAZES[code] === p.code);
  if (!front) return false;
  s.enchantress.gazes.push({ ...p, code: front, counters: 0 });
  return true;
}
/** Trickster Magic: its linked allies are set aside. */
export function tricksterMagicSetup(
  s: GameState,
  ports: Pick<EnchantressPorts, "makePiece">,
) {
  if (s.tricksterMagic) return;
  s.encounter.deck = s.encounter.deck.filter(
    (p) => !LINKED_ALLIES.includes(p.code),
  );
  s.tricksterMagic = {
    allies: LINKED_ALLIES.map((code) => ports.makePiece(s, code)),
  };
}

// ------------------------------------------------------- charm counters

/** Place a charm counter on a player's Enchantment. With an Enthralled
 * identity, the main scheme's Forced Interrupt turns it into threat. */
function charm(s: GameState, playerId: string, n = 1): Effect[] {
  return alive(s, playerId) && n > 0
    ? [N("charm", { playerId, n, actorId: playerId })]
    : [];
}

// ------------------------------------------------------------ the villain

/** Enchantress (II) in Standard and (III): Future of Despair enters play. */
export function enchantressVillainRevealed(s: GameState): Effect[] {
  if (!s.enchantress || !s.villain) return [];
  if (s.villain.code === "55002" && !expert(s))
    return [N("despair", { extra: 3 })];
  if (s.villain.code === "55003") return [N("despair", { extra: 4 })];
  return [];
}
/** Forced Responses after an enemy attacks you: Enchantress, the
 * Enthralled Lackey and Whirlwind. */
export function enchantressAttacked(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  if (!playerId || !alive(s, playerId) || over(s)) return [];
  if (attackerId === s.villain?.id)
    return s.enchantress && enchantressInPlay(s) ? charm(s, playerId) : [];
  const m = s.minions.find((q) => q.id === attackerId);
  if (!m || !active(s, m)) return [];
  if (m.code === LACKEY) return charm(s, playerId);
  if (m.code === WHIRLWIND && s.sideSchemes.length)
    return [
      N("indirect", {
        playerId,
        n: s.sideSchemes.length,
        source: WHIRLWIND,
        actorId: playerId,
      }),
    ];
  return [];
}
/** Crown of the Enchantress's Forced Response after she schemes against
 * you. */
export function enchantressSchemed(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (enemyId !== s.villain?.id || !playerId || !alive(s, playerId) || over(s))
    return [];
  return s.attachments.some(
    (a) => a.code === CROWN && a.attachedTo === enemyId && active(s, a),
  )
    ? charm(s, playerId)
    : [];
}
/** Keywords: Titania's overkill, Titania's ally's overkill and piercing,
 * Ulik's toughness in Expert, and stalwart for the villain from Future of
 * Despair, the Crown in Expert and The Trickster Tango. */
export function enchantressKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (keyword === "Overkill" && p.code === TITANIA && active(s, p)) return 1;
  if (
    (keyword === "Overkill" || keyword === "Piercing") &&
    p.code === MARY &&
    active(s, p)
  )
    return 1;
  if (
    keyword === "Toughness" &&
    p.code === ULIK &&
    expert(s) &&
    s.minions.some((m) => m.id === p.id) &&
    active(s, p)
  )
    return 1;
  if (keyword === "Stalwart" && p.id === s.villain?.id) {
    if (s.sideSchemes.some((q) => q.code === TANGO && active(s, q))) return 1;
    if (enchantressInPlay(s) && despairInPlay(s)) return 1;
    if (
      expert(s) &&
      s.attachments.some(
        (a) => a.code === CROWN && a.attachedTo === p.id && active(s, a),
      )
    )
      return 1;
  }
  return 0;
}
/** Future of Despair: Enchantress cannot take damage. */
export const enchantressImmune = (s: GameState, target: string) =>
  target === s.villain?.id && enchantressInPlay(s) && despairInPlay(s);
/** Ulik's Forced Response after a player deals damage to Enchantress. */
export function enchantressDamaged(
  s: GameState,
  target: string,
  amount: number,
  playerId: string | undefined,
): Effect[] {
  if (
    amount <= 0 ||
    !playerId ||
    target !== s.villain?.id ||
    !enchantressInPlay(s) ||
    !alive(s, playerId) ||
    over(s)
  )
    return [];
  return s.minions
    .filter((m) => m.code === ULIK && active(s, m))
    .map((m) => N("ulik", { id: m.id, playerId, actorId: playerId }));
}
/** A player card being played or resolving, or an enemy activation in
 * progress. */
const busy = (s: GameState) =>
  !!s.attack ||
  !!s.scheming ||
  s.queue.some((e) => e.type === "play") ||
  s.resolving.some((p) => def(p)?.faction_code !== "encounter");
/** Ulik's waiting attacks, once nothing is resolving. */
export function enchantressFlush(s: GameState): Effect[] {
  const waiting = s.enchantress?.ulik;
  if (!waiting?.length || busy(s) || over(s)) return [];
  s.enchantress!.ulik = [];
  return waiting.map((w) =>
    N("ulik", { id: w.id, playerId: w.playerId, actorId: w.playerId }),
  );
}
/** Sindr's attacks deal indirect damage. */
export const enchantressIndirectAttack = (s: GameState, id: string) =>
  s.minions.some((m) => m.id === id && m.code === SINDR && active(s, m));
/** Enthralled Brute: +3 hit points engaged with an Enthralled player. */
export function enchantressHealth(s: GameState, p: Piece): number {
  return p.code === BRUTE &&
    !!p.engagedWith &&
    !isTextBlank(s, p) &&
    s.minions.some((m) => m.id === p.id) &&
    enthralled(s, p.engagedWith)
    ? 3
    : 0;
}
/** Absorbing Man: +X ATK engaged with you, X being the printed cost of the
 * highest-cost card you control. */
export function enchantressEnemyStat(
  s: GameState,
  p: Piece,
  kind: "attack" | "scheme",
): number {
  if (
    kind !== "attack" ||
    p.code !== ABSORBING ||
    !active(s, p) ||
    !p.engagedWith ||
    !alive(s, p.engagedWith)
  )
    return 0;
  return Math.max(
    0,
    ...seatView(s, p.engagedWith).player.inPlay.map(
      (q) => Number(def(q)?.cost) || 0,
    ),
  );
}
/** When Defeated: the beguiled minions' allies, and Ulik. */
export function enchantressMinionDefeated(
  s: GameState,
  m: Piece,
  textWasBlank: boolean,
  playerId: string,
): Effect[] {
  if (textWasBlank || over(s) || !alive(s, playerId)) return [];
  if (ALLY_OF[m.code])
    return [N("free", { code: ALLY_OF[m.code], playerId, actorId: playerId })];
  if (m.code === ULIK && s.enchantress && enchantressInPlay(s))
    return [N("ulik-defeated", { playerId, actorId: playerId })];
  return [];
}
/** Victory 1 for the beguiled minions. */
export const enchantressVictoryMinion = (m: Piece) => BEGUILED.includes(m.code);
/** Victory 0 for their allies. */
export const enchantressVictoryAlly = (s: GameState, p: Piece) =>
  LINKED_ALLIES.includes(p.code) && active(s, p);
/** The Trickster Magic allies do not count against the ally limit. */
export const enchantressAllyExcluded = (s: GameState, p: Piece) =>
  LINKED_ALLIES.includes(p.code) && active(s, p);
/** Love Triangle: the attached ally cannot attack the villain. Puppet
 * Master: allies cannot thwart it. */
export function enchantressAllyCanTarget(
  s: GameState,
  ally: Piece,
  kind: "attack" | "thwart",
  target: string,
): boolean {
  if (
    kind === "attack" &&
    target === s.villain?.id &&
    s.attachments.some(
      (a) => a.code === TRIANGLE && a.attachedTo === ally.id && active(s, a),
    )
  )
    return false;
  if (
    kind === "thwart" &&
    s.sideSchemes.some(
      (q) => q.id === target && q.code === PUPPET && active(s, q),
    )
  )
    return false;
  return true;
}
/** Love Triangle and Puppet Master: no defending against the villain's
 * attacks. */
export function enchantressAllyCanDefend(
  s: GameState,
  ally: Piece,
  attackerId: string,
): boolean {
  if (attackerId !== s.villain?.id) return true;
  if (s.sideSchemes.some((q) => q.code === PUPPET && active(s, q)))
    return false;
  return !s.attachments.some(
    (a) => a.code === TRIANGLE && a.attachedTo === ally.id && active(s, a),
  );
}
/** Puppet Master gains hinder 1 per player in Expert. */
export function enchantressRevealCard(s: GameState, p: Piece, c: Card): Card {
  if (p.code !== PUPPET || !expert(s) || /^Hinder \d/m.test(c.text || ""))
    return c;
  return { ...c, text: `Hinder 1[per_hero].\n${c.text || ""}` };
}
/** The players' optional interrupts as one of the Trickster Magic allies
 * attacks or thwarts: Absorbing Man and Whirlwind. The packet carries the
 * use's amount. */
export function enchantressAllyOptions(
  s: GameState,
  p: Piece,
  packet: Effect,
): Option[] {
  if (packet.enchAllyHandled || !active(s, p)) return [];
  const attack = packet.kind === "attack";
  const after = { ...packet, enchAllyHandled: true };
  if (p.code === CREEL)
    return s.player.inPlay
      .filter(
        (q) =>
          q.id !== p.id &&
          !q.exhausted &&
          ["upgrade", "support"].includes(def(q)?.type_code || ""),
      )
      .map((q) => {
        const x = Math.min(3, Number(def(q)?.cost) || 0);
        return {
          id: `creel:${q.id}`,
          label: `Exhaust ${name(q)} · +${x} ${attack ? "ATK" : "THW"}`,
          image: q.code,
          effects: [
            { type: "exhaust", id: q.id },
            { ...after, amount: (Number(packet.amount) || 0) + x },
          ],
        };
      });
  if (
    p.code === CANNON &&
    attack &&
    (s.scheme.threat > 0 || s.sideSchemes.some((q) => q.counters > 0))
  )
    return [
      {
        id: "whirlwind",
        label: "Remove 1 threat from each scheme · +1 ATK for each",
        image: p.code,
        effects: [N("whirlwind", { source: p.id, packet: after })],
      },
    ];
  return [];
}
/** Zzzax's Response after it enters play. */
export function enchantressAllyEntered(s: GameState, p: Piece): Effect[] {
  return p.code === ZZZAX_ALLY && active(s, p)
    ? [N("zzzax-search", { playerId: s.activePlayerId })]
    : [];
}

// --------------------------------------------------------- main scheme

/** Sovereign Sorceress (2A): stun each identity with the Crown in play;
 * otherwise find the Crown and reveal it. */
export function enchantressMainAdvanced(s: GameState): Effect[] {
  return s.enchantress && s.scheme.code === SOVEREIGN
    ? [N("sovereign", { actorId: s.firstPlayerId })]
    : [];
}

// -------------------------------------------------------- forced actions

/** The Forced Actions a player still has to take before their turn ends:
 * the Trance and each Temptation attached to their identity. */
export function enchantressForcedActions(
  s: GameState,
  playerId: string,
): Effect[] {
  if (!alive(s, playerId) || over(s)) return [];
  return attachedTo(s, identityOf(playerId))
    .filter(
      (a) =>
        (TRANCES.includes(a.code) || TEMPTATIONS.includes(a.code)) &&
        !a.exhausted &&
        active(s, a),
    )
    .map((a) => N("forced", { id: a.id, playerId, actorId: playerId }));
}
/** The remaining forced actions resolve before the turn ends. */
export function enchantressTurnEnding(
  s: GameState,
  playerId: string,
  discard: string[],
): Effect[] {
  const forced = enchantressForcedActions(s, playerId);
  return forced.length
    ? [forced[0], N("end-turn", { discard, actorId: playerId })]
    : [];
}
/** The ready step readies the player's exhausted Trance and Temptations. */
export function enchantressReady(s: GameState, playerId: string) {
  for (const a of attachedTo(s, identityOf(playerId)))
    if (TRANCES.includes(a.code) || TEMPTATIONS.includes(a.code))
      a.exhausted = false;
}
const FORCED_TEXT: Record<string, string> = {
  [ENVY]: "boost card to Enchantress, ready your hero",
  [GREED]: "draw 1 and play it, or take 1 damage",
  [PRIDE]: "1 threat here, 2 off a side scheme",
  [SLOTH]: "heal her 1, draw 1 and discard 1",
  [WRATH]: "1 indirect damage, 2 to a minion",
  [ALLURING]: "charm, play a card for 1 less",
  [KISS]: "charm, draw 1 and discard 1",
  [LOVE]: "charm, ready your hero",
};

// ----------------------------------------------------------------- actions

export function enchantressActions(
  s: GameState,
  p: Piece,
  ports?: Pick<EnchantressPorts, "canPay">,
): Option[] {
  if (s.phase !== "player" || !active(s, p)) return [];
  if (!s.attachments.some((a) => a.id === p.id)) return [];
  const mine = p.attachedTo === identityOf(s.activePlayerId);
  const options: Option[] = [];
  if (
    mine &&
    (TRANCES.includes(p.code) || TEMPTATIONS.includes(p.code)) &&
    !p.exhausted
  )
    options.push({
      id: "forced",
      label: `Forced Action · ${FORCED_TEXT[p.code]}`,
      image: p.code,
      effects: [
        N("forced", {
          id: p.id,
          playerId: s.activePlayerId,
          actorId: s.activePlayerId,
        }),
      ],
    });
  if (
    mine &&
    TEMPTATIONS.includes(p.code) &&
    !p.exhausted &&
    s.player.form === "alter"
  )
    options.push({
      id: "shake-off",
      label: "Alter-Ego Action · discard it",
      image: p.code,
      effects: [N("shake-off", { id: p.id })],
    });
  if (
    p.code === CROWN &&
    s.player.form === "hero" &&
    seats(s).every((seat) => !seatView(s, seat.id).player.exhausted)
  )
    options.push({
      id: "crown",
      label: "Hero Action · all exhaust, take 1 · discard",
      image: p.code,
      effects: [N("crown", { id: p.id, actorId: s.activePlayerId })],
    });
  if (p.code === TRIANGLE && s.player.form === "alter") {
    const ally = s.player.inPlay.find((q) => q.id === p.attachedTo);
    if (ally && !ally.exhausted && (!ports || ports.canPay(s, 1, ["mental"])))
      options.push({
        id: "triangle",
        label: `Alter-Ego Action · exhaust ${name(ally)}, spend mental · discard`,
        image: p.code,
        effects: [
          N("triangle-pay", {
            id: p.id,
            ally: ally.id,
            actorId: s.activePlayerId,
          }),
        ],
      });
  }
  return options;
}
export function enchantressActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return s.attachments.find(
    (p) =>
      p.id === id &&
      (TRANCES.includes(p.code) ||
        TEMPTATIONS.includes(p.code) ||
        p.code === CROWN ||
        p.code === TRIANGLE),
  );
}

// ----------------------------------------------------------------- reveals

export function enchantressReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ENCHANTRESS_SCRIPT_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  if (TEMPTATIONS.includes(p.code) || p.code === CROWN || p.code === TRIANGLE)
    return s.resolving.some((q) => q.id === p.id)
      ? [N("attach", { piece: p, playerId, actorId: playerId })]
      : [];
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case SINDR:
      return [N("sindr", { id: p.id, playerId, actorId: playerId })];
    case ZZZAX:
      return [N("zzzax-mill", { playerId, actorId: playerId })];
    case LAW:
      return [N("law", { playerId, actorId: playerId })];
    case SPELLBOUND:
      return [N("spellbound", { actorId: s.firstPlayerId })];
    case DESPAIR:
      return [N("despair-revealed")];
    case BIDDING:
    case RESTRAINTS:
    case BLAST:
      return [N("choice", { code: p.code, playerId, actorId: playerId })];
    case SHARDS:
      return [
        N("shards", {
          playerId,
          hp: seatView(s, playerId).player.hp,
          actorId: playerId,
        }),
      ];
    default:
      return [];
  }
}
export function enchantressBoost(s: GameState, p: Piece): Effect[] | null {
  if (!ENCHANTRESS_SCRIPT_CODES.includes(p.code)) return null;
  if (
    ![...TEMPTATIONS, LACKEY, BRUTE, LAW, SHARDS, TANGO].includes(p.code) ||
    isTextBlank(s, p) ||
    !activation(s)
  )
    return [];
  const playerId = boostPlayer(s);
  if (!alive(s, playerId)) return [];
  if (TEMPTATIONS.includes(p.code))
    return [N("boost-reveal", { id: p.id, playerId, actorId: playerId })];
  if (p.code === LACKEY || p.code === BRUTE)
    return [N("boost-choice", { code: p.code, playerId, actorId: playerId })];
  if (p.code === TANGO) return [N("tango")];
  return charm(s, playerId);
}

// ---------------------------------------------------------------- resolver

export function resolveEnchantressEffect(
  s: GameState,
  e: Effect,
  ports: EnchantressPorts,
): boolean {
  if (!e.type.startsWith("ench:")) return false;
  const st = s.enchantress;
  switch (e.type) {
    case "ench:charm": {
      // A charm counter on the Enchantment; an Enthralled identity's goes
      // on the main scheme as threat instead.
      const playerId = String(e.playerId);
      const n = Number(e.n) || 0;
      const p = enchantment(s, playerId);
      if (!p || n <= 0 || over(s) || !alive(s, playerId)) break;
      if (TRANCES.includes(p.code)) {
        if (s.scheme.code === PRIME || s.scheme.code === SOVEREIGN) {
          ports.log(
            s,
            `${ports.heroName(s, playerId)} is Enthralled: the charm counter becomes threat on the main scheme.`,
            "bad",
          );
          ports.queue(s, { type: "threat", target: "main", amount: n });
        }
        break;
      }
      p.counters = (p.counters || 0) + n;
      ports.log(
        s,
        `${plural(n, "charm counter")} on ${ports.heroName(s, playerId)}'s Hypnotic Gaze (${p.counters} of 5).`,
        "bad",
      );
      if (p.counters >= 5 && active(s, p))
        ports.queue(s, N("trance", { id: p.id, playerId, actorId: playerId }));
      break;
    }
    case "ench:trance": {
      // Hypnotic Gaze flips to its Trance: the identity becomes Enthralled
      // and the Trance's When Revealed resolves.
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p || !GAZES[p.code] || (p.counters || 0) < 5) break;
      p.counters = 0;
      p.code = GAZES[p.code];
      p.exhausted = false;
      ports.log(
        s,
        `${ports.heroName(s, String(e.playerId))} falls into a trance: ${name(p)}.`,
        "bad",
      );
      ports.queue(
        s,
        N("trance-revealed", {
          code: p.code,
          playerId: e.playerId,
          actorId: e.playerId,
        }),
      );
      break;
    }
    case "ench:trance-revealed": {
      // "X. Otherwise, Y": Y resolves when X cannot resolve at all.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || over(s)) break;
      const view = seatView(s, playerId).player;
      const hero = identityOf(playerId);
      switch (e.code) {
        case ENVY: {
          const pool = ports.controlledCards(s, playerId);
          if (!pool.length) ports.mill(s, playerId, 8);
          else if (pool.length === 1) ports.discardPiece(s, pool[0].id);
          else
            ports.choose(
              s,
              name(ENVY),
              "Discard a card you control.",
              pool.map((q) => ({
                id: q.id,
                label: name(q),
                image: q.code,
                effects: [N("discard", { id: q.id })],
              })),
            );
          break;
        }
        case GREED:
          ports.queue(
            s,
            ports.canAddStatus(s, hero, "confused")
              ? { type: "status", target: hero, status: "confused" }
              : { type: "damage", target: hero, amount: 2, source: GREED },
          );
          break;
        case PRIDE:
          if (!view.exhausted) view.exhausted = true;
          else ports.randomDiscard(s, playerId);
          break;
        case SLOTH:
          ports.queue(
            s,
            ports.canAddStatus(s, hero, "stunned")
              ? { type: "status", target: hero, status: "stunned" }
              : { type: "threat", target: "main", amount: 2 },
          );
          break;
        case WRATH: {
          const top = s.encounter.deck.slice(0, 5);
          if (!top.length) break;
          ports.choose(
            s,
            name(WRATH),
            "Search the top 5 cards of the encounter deck for a card to reveal.",
            top.map((q) => ({
              id: q.id,
              label: name(q),
              image: q.code,
              effects: [
                N("wrath-reveal", { id: q.id, playerId, actorId: playerId }),
              ],
            })),
          );
          break;
        }
      }
      break;
    }
    case "ench:wrath-reveal": {
      const p = s.encounter.deck.find((q) => q.id === e.id);
      if (!p) break;
      ports.reveal(s, p, String(e.playerId));
      ports.shuffleEncounter(s);
      break;
    }
    case "ench:forced": {
      // A Forced Action: exhaust the card, then its effect.
      const p = s.attachments.find((q) => q.id === e.id);
      const playerId = String(e.playerId);
      if (!p || p.exhausted || !active(s, p) || !alive(s, playerId) || over(s))
        break;
      p.exhausted = true;
      ports.log(
        s,
        `${ports.heroName(s, playerId)} resolves ${name(p)}'s Forced Action.`,
      );
      const hero = identityOf(playerId);
      const effects: Effect[] = TEMPTATIONS.includes(p.code)
        ? charm(s, playerId)
        : [];
      switch (p.code) {
        case ENVY:
          if (s.villain) ports.giveBoost(s, s.villain.id, "next");
          effects.push({ type: "ready", target: hero });
          break;
        case GREED:
          effects.push(N("greed", { playerId, actorId: playerId }));
          break;
        case PRIDE:
          effects.push(
            { type: "threat", target: "main", amount: 1 },
            N("pride", { playerId, actorId: playerId }),
          );
          break;
        case SLOTH:
          if (s.villain && enchantressInPlay(s))
            effects.push(N("heal-villain", { n: 1 }));
          effects.push(
            { type: "draw", amount: 1, actorId: playerId },
            N("discard-one", { playerId, actorId: playerId }),
          );
          break;
        case WRATH:
          effects.push(
            N("indirect", { playerId, n: 1, source: WRATH, actorId: playerId }),
            N("wrath", { playerId, actorId: playerId }),
          );
          break;
        case ALLURING:
          effects.push(N("alluring", { playerId, actorId: playerId }));
          break;
        case KISS:
          effects.push(
            { type: "draw", amount: 1, actorId: playerId },
            N("discard-one", { playerId, actorId: playerId }),
          );
          break;
        case LOVE:
          effects.push({ type: "ready", target: hero });
          break;
      }
      ports.queue(s, ...effects);
      break;
    }
    case "ench:greed": {
      // Trance of Greed: draw 1 card and play it, paying its cost; if you
      // cannot, take 1 damage.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || over(s)) break;
      const before = new Set(s.player.hand.map((q) => q.id));
      ports.draw(s, 1);
      const drawn = s.player.hand.find((q) => !before.has(q.id));
      if (drawn && ports.playable(s, drawn, 0)) ports.play(s, drawn.id, 0);
      else
        ports.queue(s, {
          type: "damage",
          target: identityOf(playerId),
          amount: 1,
          source: GREED,
        });
      break;
    }
    case "ench:pride": {
      const schemes = s.sideSchemes.filter((q) => q.counters > 0);
      const remove = (id: string): Effect => N("remove", { target: id, n: 2 });
      if (schemes.length === 1) ports.queue(s, remove(schemes[0].id));
      else if (schemes.length)
        ports.choose(
          s,
          name(PRIDE),
          "Remove 2 threat from a side scheme.",
          schemes.map((q) => ({
            id: q.id,
            label: `Remove 2 threat from ${name(q)}`,
            image: q.code,
            effects: [remove(q.id)],
          })),
        );
      break;
    }
    case "ench:remove":
      ports.removeThreat(s, String(e.target), Number(e.n) || 0, PRIDE);
      break;
    case "ench:wrath": {
      const hit = (id: string): Effect => ({
        type: "damage",
        target: id,
        amount: 2,
        source: WRATH,
      });
      if (s.minions.length === 1) ports.queue(s, hit(s.minions[0].id));
      else if (s.minions.length)
        ports.choose(
          s,
          name(WRATH),
          "Deal 2 damage to a minion.",
          s.minions.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: [hit(m.id)],
          })),
        );
      break;
    }
    case "ench:alluring": {
      // Alluring Call: play a card from your hand for 1 less.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || over(s)) break;
      const playable = s.player.hand.filter((q) => ports.playable(s, q, 1));
      if (!playable.length) break;
      ports.choose(
        s,
        name(ALLURING),
        "Play a card from your hand, reducing its resource cost by 1.",
        playable.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [N("play", { id: q.id, discount: 1, actorId: playerId })],
        })),
      );
      break;
    }
    case "ench:play": {
      const p = s.player.hand.find((q) => q.id === e.id);
      if (p && ports.playable(s, p, Number(e.discount) || 0))
        ports.play(s, p.id, Number(e.discount) || 0);
      break;
    }
    case "ench:discard-one": {
      // Discard 1 card from your hand.
      const playerId = String(e.playerId);
      const hand = alive(s, playerId) ? seatView(s, playerId).player.hand : [];
      if (!hand.length) break;
      if (hand.length === 1) {
        ports.discardFromHand(s, playerId, hand[0].id);
        break;
      }
      ports.choose(
        s,
        "Discard a card",
        "Discard 1 card from your hand.",
        hand.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            N("discard-hand", { id: q.id, playerId, actorId: playerId }),
          ],
        })),
      );
      break;
    }
    case "ench:discard-hand":
      ports.discardFromHand(s, String(e.playerId), String(e.id));
      break;
    case "ench:end-turn": {
      // The forced actions resolve one at a time, any new one too, before
      // the turn ends.
      const playerId = String(e.actorId || s.activePlayerId);
      if (over(s) || !alive(s, playerId)) break;
      const more = enchantressForcedActions(s, playerId);
      if (more.length) {
        ports.queue(s, more[0], { ...e });
        break;
      }
      ports.endTurn(
        s,
        ((e.discard as string[]) || []).filter((id) =>
          s.player.hand.some((q) => q.id === id),
        ),
      );
      break;
    }
    case "ench:heal-villain":
      if (s.villain) ports.heal(s, s.villain.id, Number(e.n) || 0);
      break;
    case "ench:indirect":
      if (alive(s, String(e.playerId)) && Number(e.n) > 0 && !over(s))
        ports.indirect(
          s,
          String(e.playerId),
          Number(e.n),
          String(e.source || ""),
          name(String(e.source || "")),
        );
      break;
    case "ench:discard":
      if (
        s.attachments.some((q) => q.id === e.id) ||
        s.players.some((seat) =>
          seatView(s, seat).player.inPlay.some((q) => q.id === e.id),
        )
      )
        ports.discardPiece(s, String(e.id));
      break;
    case "ench:shake-off": {
      // A Temptation's Alter-Ego Action: exhaust it, then discard it.
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p || p.exhausted) break;
      p.exhausted = true;
      ports.discardPiece(s, p.id);
      break;
    }
    case "ench:despair": {
      // Enchantress (II)/(III): Future of Despair is put into play, with
      // additional threat per player.
      if (!st?.despair || over(s)) break;
      const p = st.despair;
      st.despair = undefined;
      ports.putSideScheme(s, p);
      const placed = s.sideSchemes.find((q) => q.id === p.id);
      if (placed) placed.counters += (Number(e.extra) || 0) * s.playerCount;
      ports.log(s, "Future of Despair enters play.", "bad");
      break;
    }
    case "ench:despair-revealed":
      ports.queue(
        s,
        ...seats(s).flatMap((seat) =>
          enchantment(s, seat.id) ? charm(s, seat.id) : [],
        ),
      );
      break;
    case "ench:sovereign": {
      // Sovereign Sorceress (2A).
      if (s.attachments.some((a) => a.code === CROWN && active(s, a))) {
        ports.queue(
          s,
          ...seats(s).map((seat) => ({
            type: "status",
            target: identityOf(seat.id),
            status: "stunned",
          })),
        );
        break;
      }
      const crown =
        s.encounter.deck.find((q) => q.code === CROWN) ||
        s.encounter.discard.find((q) => q.code === CROWN);
      if (crown) ports.reveal(s, crown, s.firstPlayerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "ench:attach": {
      // Temptations attach to your identity, the Crown to Enchantress, and
      // Love Triangle to an ally you control (otherwise it gains surge).
      const p = e.piece as Piece;
      const playerId = String(e.playerId);
      if (!s.resolving.some((q) => q.id === p.id)) break;
      if (p.code === CROWN) {
        if (s.villain) ports.attach(s, p, s.villain.id);
        else ports.discardPiece(s, p.id);
        break;
      }
      if (p.code === TRIANGLE) {
        const allies = alive(s, playerId)
          ? seatView(s, playerId).player.inPlay.filter(
              (q) => def(q)?.type_code === "ally",
            )
          : [];
        if (!allies.length) {
          ports.discardPiece(s, p.id);
          ports.queue(s, { type: "surge", sourceCode: TRIANGLE });
          break;
        }
        if (allies.length === 1) {
          ports.attach(s, p, allies[0].id);
          break;
        }
        ports.choose(
          s,
          name(TRIANGLE),
          "Attach Love Triangle to an ally you control.",
          allies.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [N("attach-to", { piece: p, target: q.id })],
          })),
        );
        break;
      }
      if (alive(s, playerId)) {
        p.exhausted = false;
        ports.attach(s, p, identityOf(playerId));
      } else ports.discardPiece(s, p.id);
      break;
    }
    case "ench:attach-to": {
      const p = e.piece as Piece;
      if (s.resolving.some((q) => q.id === p.id))
        ports.attach(s, p, String(e.target));
      break;
    }
    case "ench:boost-reveal": {
      // A Temptation's boost: it is revealed, attaching to your identity.
      const p = s.resolving.find((q) => q.id === e.id);
      if (p && alive(s, String(e.playerId))) ports.revealBoostCard(s, p);
      break;
    }
    case "ench:boost-choice": {
      // Enthralled Lackey and Brute's boosts: a charm counter, or confuse
      // or exhaust your identity.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || over(s)) break;
      const hero = identityOf(playerId);
      ports.choose(s, name(String(e.code)), "Choose one.", [
        {
          id: "charm",
          label: "Place 1 charm counter on your Enchantment",
          effects: charm(s, playerId),
        },
        e.code === LACKEY
          ? {
              id: "confuse",
              label: "Confuse your identity",
              effects: [{ type: "status", target: hero, status: "confused" }],
            }
          : {
              id: "exhaust",
              label: "Exhaust your identity",
              effects: [N("exhaust-identity", { playerId })],
            },
      ]);
      break;
    }
    case "ench:exhaust-identity": {
      const playerId = String(e.playerId);
      if (alive(s, playerId)) seatView(s, playerId).player.exhausted = true;
      break;
    }
    case "ench:tango":
      if (s.attack) s.attack.overkill = true;
      break;
    case "ench:sindr": {
      // Sindr: a Defiant identity's player is activated against; an
      // Enthralled one gives him a tough status card.
      const m = s.minions.find((q) => q.id === e.id);
      const playerId = String(e.playerId);
      if (!m || !alive(s, playerId) || over(s)) break;
      if (enthralled(s, playerId))
        ports.queue(s, { type: "status", target: m.id, status: "tough" });
      if (defiant(s, playerId))
        ports.activate(s, {
          enemyId: m.id,
          playerId,
          kind:
            seatView(s, playerId).player.form === "hero" ? "attack" : "scheme",
          modifier: 0,
        });
      break;
    }
    case "ench:ulik": {
      const m = s.minions.find((q) => q.id === e.id);
      if (!m || !alive(s, String(e.playerId)) || over(s)) break;
      // A card being played or an activation in progress finishes first.
      if (busy(s)) {
        (s.enchantress ||= { gazes: [] }).ulik ||= [];
        s.enchantress.ulik!.push({ id: m.id, playerId: String(e.playerId) });
        break;
      }
      ports.activate(s, {
        enemyId: m.id,
        playerId: String(e.playerId),
        kind: "attack",
        modifier: 0,
      });
      break;
    }
    case "ench:ulik-defeated":
      if (!s.villain || !alive(s, String(e.playerId)) || over(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: String(e.playerId),
        kind: "attack",
        modifier: 1,
      });
      break;
    case "ench:free": {
      // A beguiled minion's ally enters play under its defeater's control.
      const allies = s.tricksterMagic?.allies || [];
      const i = allies.findIndex((q) => q.code === e.code);
      if (i < 0 || !alive(s, String(e.playerId))) break;
      const [ally] = allies.splice(i, 1);
      ports.log(
        s,
        `${name(ally)} breaks free of the spell and joins ${ports.heroName(s, String(e.playerId))}.`,
        "good",
      );
      ports.putAlly(s, ally, String(e.playerId));
      break;
    }
    case "ench:whirlwind": {
      // Whirlwind's ally removes 1 threat from each scheme in play, then
      // attacks with +1 ATK for each threat removed.
      const packet = e.packet as Effect;
      let removed = 0;
      if (s.scheme.threat > 0)
        removed += ports.removeThreat(s, "main", 1, String(e.source));
      for (const q of [...s.sideSchemes])
        if (q.counters > 0)
          removed += ports.removeThreat(s, q.id, 1, String(e.source));
      ports.queue(s, {
        ...packet,
        amount: (Number(packet.amount) || 0) + removed,
      });
      break;
    }
    case "ench:zzzax-mill": {
      // Zzzax: discard the top 4 cards of your deck; 1 indirect damage for
      // each printed energy resource.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      const n = ports
        .mill(s, playerId, 4)
        .reduce((sum, q) => sum + printedEnergy(q), 0);
      if (n > 0)
        ports.queue(
          s,
          N("indirect", { playerId, n, source: ZZZAX, actorId: playerId }),
        );
      break;
    }
    case "ench:zzzax-search": {
      // Zzzax's ally: search the top 5 cards of your deck for a card with a
      // printed energy resource and add it to your hand.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || playerId !== s.activePlayerId) break;
      const picks = s.player.deck
        .slice(0, 5)
        .filter((q) => printedEnergy(q) > 0);
      if (!picks.length) {
        ports.shufflePlayerDeck(s);
        break;
      }
      ports.choose(
        s,
        name(ZZZAX_ALLY),
        "Add a card with a printed energy resource to your hand?",
        [
          ...picks.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [N("zzzax-take", { id: q.id, actorId: playerId })],
          })),
          {
            id: "pass",
            label: "Take nothing",
            effects: [N("zzzax-take", { actorId: playerId })],
          },
        ],
      );
      break;
    }
    case "ench:zzzax-take": {
      const i = s.player.deck.findIndex((q) => q.id === e.id);
      if (i >= 0) s.player.hand.push(...s.player.deck.splice(i, 1));
      ports.shufflePlayerDeck(s);
      break;
    }
    case "ench:law": {
      // Law of Attraction: discard from the encounter deck until an
      // Enthralled minion is discarded, then reveal it.
      for (let n = 0; n < 200; n++) {
        const { piece, emptied } = ports.discardTop(s);
        if (
          piece &&
          def(piece)?.type_code === "minion" &&
          hasTrait(piece, "Enthralled")
        ) {
          ports.reveal(s, piece, String(e.playerId));
          break;
        }
        if (!piece || emptied) break;
      }
      break;
    }
    case "ench:spellbound":
      // Spellbound: each Defiant player places a charm counter; each
      // Enthralled player discards a card they control.
      ports.queue(
        s,
        ...seats(s).flatMap((seat) =>
          defiant(s, seat.id)
            ? charm(s, seat.id)
            : enthralled(s, seat.id)
              ? [N("discard-control", { playerId: seat.id, actorId: seat.id })]
              : [],
        ),
      );
      break;
    case "ench:discard-control": {
      const playerId = String(e.playerId);
      const pool = alive(s, playerId) ? ports.controlledCards(s, playerId) : [];
      if (!pool.length) break;
      if (pool.length === 1) {
        ports.discardPiece(s, pool[0].id);
        break;
      }
      ports.choose(
        s,
        name(SPELLBOUND),
        "Discard a card you control.",
        pool.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [N("discard", { id: q.id })],
        })),
      );
      break;
    }
    case "ench:choice": {
      // "Do My Bidding", Magical Restraints and Spell Blast: a Defiant
      // identity chooses one; an Enthralled one does both, in any order.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || over(s)) break;
      const [a, b] = choiceBullets(s, String(e.code), playerId);
      if (enthralled(s, playerId))
        ports.choose(s, name(String(e.code)), "Do both, in any order.", [
          {
            id: "ab",
            label: `${a.label}, then ${b.label.toLowerCase()}`,
            effects: [...a.effects, ...b.effects],
          },
          {
            id: "ba",
            label: `${b.label}, then ${a.label.toLowerCase()}`,
            effects: [...b.effects, ...a.effects],
          },
        ]);
      else if (defiant(s, playerId))
        ports.choose(s, name(String(e.code)), "Choose one.", [a, b]);
      break;
    }
    case "ench:find": {
      // Search the encounter deck and discard pile for a minion or a side
      // scheme and reveal it.
      const type = String(e.kind);
      const found = [...s.encounter.deck, ...s.encounter.discard].filter(
        (q) => def(q)?.type_code === type,
      );
      const choices = found.filter(
        (q, i) => found.findIndex((x) => x.code === q.code) === i,
      );
      if (choices.length > 1) {
        ports.choose(
          s,
          `Reveal a ${type === "minion" ? "minion" : "side scheme"}`,
          "Search the encounter deck and discard pile.",
          choices.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              N("found", {
                id: q.id,
                playerId: e.playerId,
                actorId: e.actorId,
              }),
            ],
          })),
        );
        break;
      }
      if (choices.length) ports.reveal(s, choices[0], String(e.playerId));
      ports.shuffleEncounter(s);
      break;
    }
    case "ench:found": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      if (p) ports.reveal(s, p, String(e.playerId));
      ports.shuffleEncounter(s);
      break;
    }
    case "ench:activate":
      if (!s.villain || !alive(s, String(e.playerId)) || over(s)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: String(e.playerId),
        kind: e.kind === "scheme" ? "scheme" : "attack",
        modifier: expert(s) ? 1 : 0,
      });
      break;
    case "ench:shards": {
      // Spell Shards: 3 indirect damage; a charm counter if the identity
      // took any of it.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || over(s)) break;
      ports.queue(
        s,
        N("indirect", { playerId, n: 3, source: SHARDS, actorId: playerId }),
        N("shards-check", { playerId, hp: e.hp, actorId: playerId }),
      );
      break;
    }
    case "ench:shards-check": {
      const playerId = String(e.playerId);
      if (alive(s, playerId) && seatView(s, playerId).player.hp < Number(e.hp))
        ports.queue(s, ...charm(s, playerId));
      break;
    }
    case "ench:crown": {
      // Each player exhausts their identity and takes 1 damage, then the
      // Crown is discarded.
      const crown = s.attachments.find((q) => q.id === e.id);
      if (!crown) break;
      for (const seat of seats(s)) seatView(s, seat.id).player.exhausted = true;
      ports.queue(
        s,
        ...seats(s).map((seat) => ({
          type: "damage",
          target: identityOf(seat.id),
          amount: 1,
          source: CROWN,
        })),
        N("discard", { id: crown.id }),
      );
      break;
    }
    case "ench:triangle-pay":
      ports.pay(
        s,
        1,
        ["mental"],
        [{ type: "exhaust", id: e.ally }, N("discard", { id: e.id })],
        "Love Triangle · discard",
        true,
      );
      break;
    default:
      throw Error(`Unknown Enchantress effect: ${e.type}`);
  }
  return true;
}
/** The two bulleted choices of "Do My Bidding", Magical Restraints and
 * Spell Blast. */
function choiceBullets(
  s: GameState,
  code: string,
  playerId: string,
): [Option, Option] {
  const hero = identityOf(playerId);
  if (code === BIDDING)
    return [
      {
        id: "minion",
        label: "Search for a minion and reveal it",
        effects: [N("find", { kind: "minion", playerId, actorId: playerId })],
      },
      {
        id: "scheme",
        label: "Search for a side scheme and reveal it",
        effects: [
          N("find", { kind: "side_scheme", playerId, actorId: playerId }),
        ],
      },
    ];
  if (code === RESTRAINTS)
    return [
      {
        id: "stunned",
        label: "You are stunned and place 1 charm counter",
        effects: [
          { type: "status", target: hero, status: "stunned" },
          ...charm(s, playerId),
        ],
      },
      {
        id: "confused",
        label: "You are confused and place 1 charm counter",
        effects: [
          { type: "status", target: hero, status: "confused" },
          ...charm(s, playerId),
        ],
      },
    ];
  return [
    {
      id: "scheme",
      label: `Enchantress schemes${expert(s) ? " with +1 SCH" : ""}`,
      effects: [N("activate", { kind: "scheme", playerId, actorId: playerId })],
    },
    {
      id: "attack",
      label: `Enchantress attacks you${expert(s) ? " with +1 ATK" : ""}`,
      effects: [N("activate", { kind: "attack", playerId, actorId: playerId })],
    },
  ];
}
