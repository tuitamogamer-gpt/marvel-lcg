import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

/** Agents of S.H.I.E.L.D.'s fourth scenario: Citizen V and his Thunderbolts
 * come to arrest the heroes. Citizen V cannot be defeated until one
 * Thunderbolt minion per player is in the victory display. With the six
 * modular sets that each bring an Elite Thunderbolt minion: Gravitational
 * Pull, Hard Sound, Pale Little Spider, Power of the Atom, Supersonic and
 * The Leaper. */

export const THUNDERBOLTS_CODES = [
  "50129a",
  "50129b",
  "50130a",
  "50130b",
  "50131a",
  "50131b",
  "50132",
  "50133",
  "50134",
  "50135",
  "50136",
  "50137",
  "50138",
] as const;
export const GRAVITATIONAL_PULL_CODES = [
  "50139",
  "50140",
  "50141",
  "50142",
] as const;
export const HARD_SOUND_CODES = [
  "50143",
  "50144",
  "50145",
  "50146",
  "50147",
] as const;
export const PALE_LITTLE_SPIDER_CODES = [
  "50148",
  "50149",
  "50150",
  "50151",
] as const;
export const POWER_OF_THE_ATOM_CODES = [
  "50152",
  "50153",
  "50154",
  "50155",
] as const;
export const SUPERSONIC_CODES = [
  "50156",
  "50157",
  "50158",
  "50159",
  "50160",
] as const;
export const THE_LEAPER_CODES = ["50161", "50162", "50163", "50164"] as const;
/** The six modular sets with an Elite Thunderbolt minion, which also join
 * any other scenario with modular sets. */
export const THUNDERBOLTS_MODULAR_SETS = [
  "gravitational_pull",
  "hard_sound",
  "pale_little_spider",
  "power_of_the_atom",
  "supersonic",
  "the_leaper",
] as const;
export const ELITE_THUNDERBOLT_CODES = [
  ...GRAVITATIONAL_PULL_CODES,
  ...HARD_SOUND_CODES,
  ...PALE_LITTLE_SPIDER_CODES,
  ...POWER_OF_THE_ATOM_CODES,
  ...SUPERSONIC_CODES,
  ...THE_LEAPER_CODES,
] as const;
const ALL_CODES: readonly string[] = [
  ...THUNDERBOLTS_CODES,
  ...ELITE_THUNDERBOLT_CODES,
];
/** Innocent Bystanders stays in its player's play area. */
export const THUNDERBOLTS_IN_PLAY_OBLIGATIONS = ["50134"] as const;

/** Citizen V (A) for Standard, (B) for Expert: one card with two sides. */
const CITIZEN_V = ["50129a", "50129b"];
export const APPREHENDING = "50130b";
const JUSTICE = "50131a";
export const BACKUP = "50131b";
const SWORD = "50132";
export const JOLT = "50133";
export const BYSTANDERS = "50134";
const COMING_STORM = "50135";
const RUMBLING_THUNDER = "50136";
const DOWN_NOT_OUT = "50137";
const TAP_IN = "50138";
const MOONSTONE = "50139";
const RULE_THE_SKIES = "50140";
const GRAVITATIONAL_PULL = "50141";
const MANIPULATION = "50142";
const SONGBIRD = "50143";
const CONSTRUCTS = "50144";
const BINDINGS = "50145";
const SONIC_BUBBLE = "50146";
const HARD_SOUND = "50147";
const WIDOW = "50148";
const HANDSPRING = "50149";
const PRIDE = "50150";
const PALE_SPIDER = "50151";
const RADIOACTIVE_MAN = "50152";
const EXPOSURE = "50153";
const RUNAWAY = "50154";
const POWER_OF_THE_ATOM = "50155";
const MACH_IV = "50156";
const BLASTERS = "50157";
const MISSILES = "50158";
const DOGFIGHT = "50159";
const SUPERSONIC = "50160";
const BATROC = "50161";
const COUP = "50162";
const LEAPER = "50163";
const PARCOURS = "50164";
/** The Elite Thunderbolt minion of each modular set. */
export const ELITE_MINIONS: Record<string, string> = {
  gravitational_pull: MOONSTONE,
  hard_sound: SONGBIRD,
  pale_little_spider: WIDOW,
  power_of_the_atom: RADIOACTIVE_MAN,
  supersonic: MACH_IV,
  the_leaper: BATROC,
};
/** Each treachery that finds an Elite Thunderbolt minion and reveals it. */
const FINDERS: Record<string, string> = {
  [GRAVITATIONAL_PULL]: MOONSTONE,
  [HARD_SOUND]: SONGBIRD,
  [PALE_SPIDER]: WIDOW,
  [POWER_OF_THE_ATOM]: RADIOACTIVE_MAN,
  [SUPERSONIC]: MACH_IV,
  [LEAPER]: BATROC,
};
/** Attachments revealed from the encounter deck, with their hosts. */
const ATTACHMENTS = [
  SWORD,
  CONSTRUCTS,
  BINDINGS,
  HANDSPRING,
  EXPOSURE,
  BLASTERS,
  MISSILES,
];

export interface ThunderboltsState {
  /** The Elite Thunderbolt minions set aside at setup, until Justice, Like
   * Lightning reveals them. */
  aside: Piece[];
  /** Justice, Like Lightning, until it is revealed and flips to Thunderbolt
   * Backup. */
  justice?: Piece;
}

export interface ThunderboltsPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** Reveal an encounter card, removing it from its zone first. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  /** A minion in play engages a player, with its engagement abilities. */
  engage(s: GameState, id: string, playerId: string): void;
  putEnvironment(s: GameState, p: Piece): void;
  heal(s: GameState, target: string, n: number): void;
  /** The characters a player controls: their identity, then their allies. */
  characters(s: GameState, playerId: string): string[];
  remainingHP(s: GameState, id: string): number;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  discardFromHand(s: GameState, playerId: string, id: string): void;
  /** Discard the top cards of a player's deck; the cards discarded. */
  mill(s: GameState, playerId: string, n: number): Piece[];
  removeFromGame(s: GameState, id: string): void;
  shuffle<T>(s: GameState, items: T[]): T[];
  /** A player's hero's current ATK. */
  heroAttack(s: GameState, playerId: string): number;
  /** An enemy's current ATK, with its modifiers. */
  enemyAttack(s: GameState, id: string): number;
  /** The number of boost icons an encounter card in play shows. */
  boostIcons(s: GameState, p: Piece): number;
  exhaustIdentity(s: GameState, playerId: string): void;
  endGame(s: GameState, won: boolean, reason: string): void;
  heroName(s: GameState, playerId: string): string;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const T = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `tb:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const seats = (s: GameState) => playerOrder(s).filter((x) => !x.eliminated);
const activation = (s: GameState) => s.scheming || s.attack;
/** The player a boost card's activation is against. */
const boostPlayer = (s: GameState) =>
  s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
const traits = (p: Piece | string) => def(p)?.traits || "";
const hasPrintedTrait = (p: Piece | string, trait: string) =>
  traits(p)
    .split(/\.\s*/)
    .map((t) => t.trim())
    .includes(trait);
const isThunderbolt = (p: Piece) => hasPrintedTrait(p, "Thunderbolt");
/** Permanent cards cannot leave play. */
const permanent = (p: Piece) => {
  const c = def(p) as (Card & { permanent?: boolean }) | undefined;
  return (
    c?.permanent === true ||
    /(?:^|[.\n])\s*Permanent\b/.test((c?.text || "").replace(/<[^>]*>/g, ""))
  );
};
const over = (s: GameState) => ["won", "lost"].includes(s.phase);

export const thunderbolts = (s: GameState) => !!s.thunderbolts;
/** Citizen V is the villain in play, with his text. */
const citizenInPlay = (s: GameState) =>
  !!s.villain && CITIZEN_V.includes(s.villain.code) && active(s, s.villain);
const backupEnv = (s: GameState) =>
  (s.environments || []).find((p) => p.code === BACKUP);
/** The Thunderbolt minion attached to Thunderbolt Backup. */
export const backupMinion = (s: GameState) =>
  s.minions.find((p) => p.thunderboltBackup);
/** The Thunderbolt minions in play, the one attached to Thunderbolt Backup
 * included. */
const thunderboltMinions = (s: GameState) => s.minions.filter(isThunderbolt);
const mainActive = (s: GameState) =>
  !!s.thunderbolts && s.scheme.code === APPREHENDING;
const attachedTo = (s: GameState, code: string, id: string) =>
  s.attachments.filter(
    (a) => a.code === code && a.attachedTo === id && active(s, a),
  );
const sideScheme = (s: GameState, code: string) =>
  s.sideSchemes.find((p) => p.code === code && active(s, p));
const engagedWith = (s: GameState, playerId: string) =>
  s.minions.filter((m) => !m.thunderboltBackup && m.engagedWith === playerId);
/** The Thunderbolt minions in the victory display. */
export const thunderboltsVictories = (s: GameState) =>
  (s.victoryDisplay || []).filter(
    (p) => def(p)?.type_code === "minion" && isThunderbolt(p),
  ).length;
/** Citizen V's printed heal for his Forced Interrupt. */
const citizenHeal = (s: GameState) => (s.villain?.code === "50129b" ? 6 : 4);

// ------------------------------------------------------------- interface

export function citizenCaption(s: GameState) {
  const n = s.playerCount;
  return `Defeated only with ${n} Thunderbolt${n === 1 ? "" : "s"} in the victory display · heals ${citizenHeal(s)} instead of activating against a player engaged with a Thunderbolt`;
}
/** The objective line: the Thunderbolts left to defeat, then Citizen V. */
export function thunderboltsObjective(s: GameState) {
  const n = s.playerCount;
  const have = thunderboltsVictories(s);
  return have >= n
    ? "Defeat Citizen V"
    : `Defeat ${n} Thunderbolt${n === 1 ? "" : "s"}, then Citizen V · ${have} of ${n}`;
}
/** The main scheme's note. */
export function thunderboltsMainNote(s: GameState) {
  return mainActive(s)
    ? "Each Thunderbolt minion has guard and engages the player who attacks it"
    : "";
}
/** Thunderbolt Backup's caption: the minion it holds and its swap. */
export function backupCaption(s: GameState) {
  const p = backupMinion(s);
  const heal = (s.difficulty === "expert" ? 2 : 1) * s.playerCount;
  return `${p ? `Holds ${name(p)}` : "Empty"} · at the end of the round the most-damaged Thunderbolt swaps in and heals ${heal}`;
}
/** Jolt's parley counters. */
export const parleyCaption = (p: Piece) =>
  `${p.counters || 0} of 3 parley counters · removed from the game at 3`;
/** Innocent Bystanders' remaining counters. */
export const bystanderCaption = (s: GameState, p: Piece) =>
  `${p.counters || 0} bystander counter${p.counters === 1 ? "" : "s"} · after you attack or are attacked: spend a resource or ${s.difficulty === "expert" ? 2 : 1} threat`;

// --------------------------------------------------------------- setup

/** Apprehending Rogue Agents (1A): the Elite Thunderbolt minion of each
 * chosen modular set is set aside. */
export function thunderboltsSetup(
  s: GameState,
  ports: { makePiece(s: GameState, code: string): Piece },
) {
  const take = (code: string) => {
    const i = s.encounter.deck.findIndex((p) => p.code === code);
    return i >= 0 ? s.encounter.deck.splice(i, 1)[0] : ports.makePiece(s, code);
  };
  s.thunderbolts = { aside: [] };
  for (const set of s.modules || []) {
    const code = ELITE_MINIONS[set];
    if (code) s.thunderbolts.aside.push(take(code));
  }
  // Justice, Like Lightning is revealed at setup, not shuffled in.
  const justice = take(JUSTICE);
  justice.code = JUSTICE;
  s.thunderbolts.justice = justice;
  s.encounter.deck = s.encounter.deck.filter(
    (p) => ![JUSTICE, BACKUP].includes(p.code),
  );
  const main = def(APPREHENDING);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
}
/** Justice, Like Lightning is revealed after the players' hands. */
export function thunderboltsSetupEffects(s: GameState): Effect[] {
  return s.thunderbolts ? [T("justice", { actorId: s.firstPlayerId })] : [];
}

// ------------------------------------------------------------ the villain

/** Citizen V cannot be defeated unless at least 1 Thunderbolt minion per
 * player is in the victory display; when he is, the players win. */
export function thunderboltsWouldBeDefeated(
  s: GameState,
): "immune" | "won" | null {
  if (!s.thunderbolts || !s.villain || !CITIZEN_V.includes(s.villain.code))
    return null;
  return citizenInPlay(s) && thunderboltsVictories(s) < s.playerCount
    ? "immune"
    : "won";
}
/** Citizen V is at 0 hit points and can now be defeated. */
export function thunderboltsDefeatReady(s: GameState) {
  return (
    !!s.thunderbolts &&
    !over(s) &&
    !!s.villain &&
    CITIZEN_V.includes(s.villain.code) &&
    s.villain.hp <= 0 &&
    thunderboltsWouldBeDefeated(s) === "won"
  );
}
/** Innocent Bystanders enters its player's play area with its uses. */
export function thunderboltsObligationEntered(p: Piece) {
  if (p.code === BYSTANDERS) p.counters = 4;
}
/** Citizen V's Forced Interrupt when he would activate against a player
 * during the villain phase: if that player is engaged with a Thunderbolt
 * minion, he heals instead. */
export function thunderboltsSkipsActivation(
  s: GameState,
  ports: Pick<ThunderboltsPorts, "heal" | "log">,
): boolean {
  if (!s.thunderbolts || !citizenInPlay(s)) return false;
  if (!engagedWith(s, s.activePlayerId).some(isThunderbolt)) return false;
  const n = citizenHeal(s);
  ports.log(
    s,
    `Citizen V does not activate against a player engaged with a Thunderbolt and heals ${n} damage instead.`,
    "bad",
  );
  ports.heal(s, s.villain.id, n);
  return true;
}

// ----------------------------------------------------------------- stats

/** Granted keywords: guard on each Thunderbolt minion at stage 1B, and
 * Blasters' overkill and ranged. */
export function thunderboltsKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (
    keyword === "Guard" &&
    mainActive(s) &&
    s.minions.some((m) => m.id === p.id) &&
    isThunderbolt(p)
  )
    return 1;
  if (
    (keyword === "Overkill" || keyword === "Ranged") &&
    attachedTo(s, BLASTERS, p.id).length
  )
    return 1;
  return 0;
}
/** Solid Sound Constructs: the attached enemy loses stalwart. */
export const thunderboltsLosesStalwart = (s: GameState, p: Piece) =>
  attachedTo(s, CONSTRUCTS, p.id).length > 0;
/** Solid Sound Constructs' Forced Interrupt: it is discarded instead of a
 * confused or stunned status card being placed on the attached enemy. */
export function thunderboltsStatusPrevented(
  s: GameState,
  p: Piece,
  kind: string,
  ports: Pick<ThunderboltsPorts, "discardPiece" | "log">,
): boolean {
  if (kind !== "stunned" && kind !== "confused") return false;
  const constructs = attachedTo(s, CONSTRUCTS, p.id)[0];
  if (!constructs) return false;
  ports.log(
    s,
    `Solid Sound Constructs is discarded instead of ${name(p)} being ${kind}.`,
  );
  ports.discardPiece(s, constructs.id);
  return true;
}
/** Rule the Skies: each Aerial character gets +1 ATK. */
const ruleTheSkies = (s: GameState) =>
  s.sideSchemes.filter((p) => p.code === RULE_THE_SKIES && active(s, p)).length;
/** Enemy stats: Rule the Skies on each Aerial enemy. */
export function thunderboltsEnemyStat(
  s: GameState,
  p: Piece,
  stat: "attack" | "scheme",
  aerial: boolean,
): number {
  return stat === "attack" && aerial ? ruleTheSkies(s) : 0;
}
/** An identity's stats: Rule the Skies, and Radiation Exposure's -1 ATK
 * (+1 ATK on a Gamma identity) and -1 THW. */
export function thunderboltsIdentityStats(
  s: GameState,
  playerId: string,
  heroTraits: string,
  hero: boolean,
): { attack: number; thwart: number } {
  const has = (t: string) =>
    heroTraits
      .split(/\.\s*/)
      .map((x) => x.trim())
      .includes(t);
  const exposure = attachedTo(s, EXPOSURE, `hero:${playerId}`).length;
  return {
    attack:
      (hero && has("Aerial") ? ruleTheSkies(s) : 0) +
      (has("Gamma") ? exposure : -exposure),
    thwart: -exposure,
  };
}
/** An ally's ATK: Rule the Skies on an Aerial ally. */
export const thunderboltsAllyAttack = (s: GameState, aerial: boolean) =>
  aerial ? ruleTheSkies(s) : 0;
/** MACH-IV: a character without the Aerial trait cannot make basic
 * defenses against his attacks. */
export function thunderboltsBlocksBasicDefense(
  s: GameState,
  attackerId: string,
  defenderAerial: boolean,
): boolean {
  const p = s.minions.find((m) => m.id === attackerId);
  return !!p && p.code === MACH_IV && active(s, p) && !defenderAerial;
}
/** Songbird's Forced Interrupt: 1 additional boost card when she
 * activates. */
export function thunderboltsAdditionalBoosts(s: GameState, enemyId: string) {
  const p = s.minions.find((m) => m.id === enemyId);
  return p && p.code === SONGBIRD && active(s, p) ? 1 : 0;
}

// ---------------------------------------------------------------- damage

/** Damage replacements: Handspring sends attack damage back to the
 * attacker, Sonic Bubble takes the damage to any enemy as threat, and
 * Aerial Dogfight reduces attack damage to an Aerial character by 2.
 * Returns the damage the target still takes. */
export function thunderboltsDamageTaken(
  s: GameState,
  target: string,
  n: number,
  info: {
    playerAttack: boolean;
    enemyAttack: boolean;
    attacker?: string;
    attackerAerial: boolean;
    ranged: boolean;
    targetAerial: boolean;
    enemy: boolean;
  },
  ports: Pick<ThunderboltsPorts, "discardPiece" | "log" | "queue">,
): number {
  if (n <= 0) return n;
  if (
    (info.playerAttack || info.enemyAttack) &&
    info.targetAerial &&
    !info.attackerAerial &&
    !info.ranged &&
    s.sideSchemes.some((p) => p.code === DOGFIGHT && active(s, p))
  ) {
    const dogfights = s.sideSchemes.filter(
      (p) => p.code === DOGFIGHT && active(s, p),
    ).length;
    n = Math.max(0, n - 2 * dogfights);
    ports.log(s, "Aerial Dogfight reduces the damage by 2.");
    if (!n) return 0;
  }
  if (info.enemy && info.playerAttack && info.attacker) {
    const handspring = attachedTo(s, HANDSPRING, target)[0];
    if (handspring) {
      ports.discardPiece(s, handspring.id);
      ports.log(
        s,
        `Handspring: the ${n} damage is dealt to the attacking character instead.`,
        "bad",
      );
      ports.queue(s, {
        type: "damage",
        target: info.attacker,
        amount: n,
        source: HANDSPRING,
      });
      return 0;
    }
  }
  if (info.enemy) {
    const bubble = sideScheme(s, SONIC_BUBBLE);
    if (bubble && bubble.counters > 0) {
      const removed = Math.min(bubble.counters, n);
      bubble.counters -= removed;
      ports.log(
        s,
        `Sonic Bubble loses ${removed} threat instead of the damage being dealt.`,
        "good",
      );
      if (bubble.counters <= 0)
        ports.queue(s, { type: "defeatScheme", id: bubble.id });
      return 0;
    }
  }
  return n;
}
/** Runaway Nuclear Reaction's Forced Response after Radioactive Man is dealt
 * damage. */
export function thunderboltsDamaged(
  s: GameState,
  target: string,
  n: number,
): Effect[] {
  if (n <= 0) return [];
  const p = s.minions.find((m) => m.id === target);
  if (!p || p.code !== RADIOACTIVE_MAN) return [];
  return s.sideSchemes
    .filter((q) => q.code === RUNAWAY && active(s, q))
    .map((q) => T("runaway", { id: q.id, n }));
}

// ----------------------------------------------------------------- windows

/** Thunderbolt Backup's Forced Interrupt when the round ends. */
export function thunderboltsRoundEnded(s: GameState): Effect[] {
  const env = backupEnv(s);
  return s.thunderbolts && env && active(s, env) && !over(s)
    ? [T("backup-round")]
    : [];
}
/** After a player's character attacks an enemy: stage 1B engages an
 * attacked Thunderbolt minion with that player; Citizen V's Sword's and
 * Blasters' Hero Responses after you attack and damage the enemy; Innocent
 * Bystanders after you attack. */
export function thunderboltsEnemyAttacked(
  s: GameState,
  target: string,
  source: string,
  playerId: string,
  damage: number,
): Effect[] {
  if (over(s) || !alive(s, playerId)) return [];
  const out: Effect[] = [];
  const minion = s.minions.find((m) => m.id === target);
  if (
    minion &&
    isThunderbolt(minion) &&
    mainActive(s) &&
    (minion.thunderboltBackup || minion.engagedWith !== playerId)
  )
    out.push(T("engage", { id: minion.id, playerId }));
  const identity = source === "hero" || source === `hero:${playerId}`;
  if (identity && damage > 0) {
    for (const code of [SWORD, BLASTERS])
      for (const a of attachedTo(s, code, target))
        out.push(T("attachment-response", { id: a.id, playerId }));
  }
  if (identity) out.push(...bystanders(s, playerId));
  return out;
}
/** Innocent Bystanders' Forced Response for each copy in a player's area. */
function bystanders(s: GameState, playerId: string): Effect[] {
  if (!alive(s, playerId)) return [];
  return seatView(s, playerId)
    .player.inPlay.filter((p) => p.code === BYSTANDERS && active(s, p))
    .map((p) => T("bystander", { id: p.id, playerId, actorId: playerId }));
}
/** After an enemy attacks a player: Heat-Seeking Missiles and Innocent
 * Bystanders. */
export function thunderboltsAttackedYou(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  if (over(s) || !alive(s, playerId)) return [];
  return [
    ...attachedTo(s, MISSILES, attackerId).map((a) =>
      T("missiles", { id: a.id, playerId, actorId: playerId }),
    ),
    ...bystanders(s, playerId),
  ];
}
/** After an enemy activates against a player: Moonstone gets a tough status
 * card, and Radioactive Man deals 1 damage to each of that player's
 * characters. */
export function thunderboltsActivated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  const p = s.minions.find((m) => m.id === enemyId);
  if (!p || !active(s, p) || over(s)) return [];
  if (p.code === MOONSTONE && !p.tough)
    return [{ type: "status", target: p.id, status: "tough" }];
  if (p.code === RADIOACTIVE_MAN && alive(s, playerId))
    return [T("radiation", { playerId, actorId: playerId })];
  return [];
}
/** Black Widow's Forced Response after she schemes against you. */
export function thunderboltsSchemed(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  const p = s.minions.find((m) => m.id === enemyId);
  return p && p.code === WIDOW && active(s, p) && alive(s, playerId)
    ? [T("widow", { id: p.id, playerId, actorId: playerId })]
    : [];
}
/** When a minion engages a player: Batroc's Forced Interrupt and Coup de
 * Foudre's. */
export function thunderboltsMinionEngaged(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (over(s) || !alive(s, playerId) || p.thunderboltBackup) return [];
  const out: Effect[] = [];
  if (p.code === BATROC && active(s, p))
    out.push(T("batroc", { playerId, actorId: playerId }));
  for (const coup of s.sideSchemes.filter(
    (q) => q.code === COUP && active(s, q),
  ))
    out.push(
      T("coup", { id: coup.id, minion: p.id, playerId, actorId: playerId }),
    );
  return out;
}
/** Radiation Exposure's Forced Response after you recover. */
export function thunderboltsRecovered(
  s: GameState,
  playerId = s.activePlayerId,
): Effect[] {
  if (!alive(s, playerId)) return [];
  return attachedTo(s, EXPOSURE, `hero:${playerId}`).map((a) =>
    T("exposure", { id: a.id, playerId, actorId: playerId }),
  );
}
/** Hard Sound Bindings is attached to this player's identity. */
export const thunderboltsBound = (s: GameState, playerId: string) =>
  attachedTo(s, BINDINGS, `hero:${playerId}`).length > 0;
/** Hard Sound Bindings' Forced Interrupt when you would attack: it is
 * discarded instead, then you are stunned. */
export function thunderboltsBindingsReplace(
  s: GameState,
  playerId: string,
  ports: Pick<ThunderboltsPorts, "discardPiece" | "log">,
): Effect[] {
  const a = attachedTo(s, BINDINGS, `hero:${playerId}`)[0];
  if (!a) return [];
  ports.discardPiece(s, a.id);
  ports.log(
    s,
    "Hard Sound Bindings is discarded instead of the attack. You are stunned.",
    "bad",
  );
  return [{ type: "status", target: "hero", status: "stunned" }];
}

// --------------------------------------------------------------- minions

/** Victory 1: each Elite Thunderbolt minion enters the victory display when
 * defeated. */
export const thunderboltsVictoryMinion = (p: Piece) =>
  Object.values(ELITE_MINIONS).includes(p.code);
/** Jolt's When Defeated: 3 threat on the main scheme. */
export function thunderboltsMinionDefeated(
  s: GameState,
  m: Piece,
  textWasBlank: boolean,
): Effect[] {
  if (textWasBlank || m.code !== JOLT) return [];
  return [{ type: "threat", target: "main", amount: 3 }];
}

// ----------------------------------------------------------------- actions

/** Jolt's Hero Action: exhaust your hero to place a parley counter. */
export function thunderboltsActions(s: GameState, p: Piece): Option[] {
  if (
    s.phase !== "player" ||
    s.player.form !== "hero" ||
    s.player.exhausted ||
    p.code !== JOLT ||
    !active(s, p) ||
    !s.minions.some((m) => m.id === p.id)
  )
    return [];
  return [
    {
      id: "parley",
      label: "Hero Action · exhaust your hero · place a parley counter on Jolt",
      image: p.code,
      effects: [T("parley", { id: p.id, playerId: s.activePlayerId })],
    },
  ];
}
export function thunderboltsActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return s.minions.find((p) => p.id === id && p.code === JOLT);
}

// ----------------------------------------------------------------- reveals

export function thunderboltsReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  if (ATTACHMENTS.includes(p.code))
    return resolving ? [T("attach", { piece: p, playerId })] : [];
  if (isTextBlank(s, p)) return [];
  const hero = seatView(s, playerId).player.form === "hero";
  if (FINDERS[p.code])
    return [T("find", { code: FINDERS[p.code], source: p.code, playerId })];
  switch (p.code) {
    case COMING_STORM:
    case RUMBLING_THUNDER:
    case PARCOURS:
      return [T("rotate")];
    case DOWN_NOT_OUT:
      return [T("down", { id: p.id, playerId })];
    case TAP_IN:
      return [T("tap", { playerId })];
    case MANIPULATION:
      return hero
        ? [T("manipulation", { playerId })]
        : [T("manipulation-alter", { playerId })];
    case PRIDE:
      return [T("pride", { id: p.id })];
    default:
      return [];
  }
}
export function thunderboltsBoost(s: GameState, p: Piece): Effect[] | null {
  if (
    ![
      GRAVITATIONAL_PULL,
      RULE_THE_SKIES,
      BINDINGS,
      HARD_SOUND,
      PALE_SPIDER,
      POWER_OF_THE_ATOM,
      SUPERSONIC,
      LEAPER,
      PARCOURS,
    ].includes(p.code)
  )
    return null;
  const a = activation(s);
  if (isTextBlank(s, p) || !a) return [];
  const playerId = boostPlayer(s);
  switch (p.code) {
    case GRAVITATIONAL_PULL:
      return [T("exhaust-one", { playerId, actorId: playerId })];
    case RULE_THE_SKIES:
      return [T("skies-boost", { enemyId: a.attacker })];
    case BINDINGS:
      return [T("bindings-boost", { playerId, enemyId: a.attacker })];
    case HARD_SOUND:
      return [T("extra-boost", { enemyId: a.attacker })];
    case PALE_SPIDER:
      return [T("spider-boost", { playerId })];
    case POWER_OF_THE_ATOM:
      return [T("indirect", { playerId, n: 2, source: p.code })];
    case SUPERSONIC:
      return s.attack ? [T("supersonic-boost")] : [];
    case LEAPER:
      return [T("discard-one", { playerId, actorId: playerId })];
    default:
      // Parcours du Combattant: after this attack resolves, engage a minion
      // in play that is not engaged with you.
      return s.attack
        ? [
            T("after", {
              effects: [T("parcours", { playerId, actorId: playerId })],
            }),
          ]
        : [];
  }
}

// ---------------------------------------------------------------- resolver

export function resolveThunderboltsEffect(
  s: GameState,
  e: Effect,
  ports: ThunderboltsPorts,
): boolean {
  if (!e.type.startsWith("tb:")) return false;
  const st = s.thunderbolts;
  switch (e.type) {
    case "tb:justice": {
      // Justice, Like Lightning: each player reveals a random set-aside
      // Thunderbolt minion, and the remaining one attaches here faceup. In
      // expert mode each of them gets a tough status card. Then it flips.
      if (!st) break;
      const pool = ports.shuffle(s, st.aside.splice(0));
      const revealed: string[] = [];
      const reveals: Effect[] = [];
      for (const seat of seats(s)) {
        const p = pool.shift();
        if (!p) break;
        revealed.push(p.id);
        reveals.push(T("justice-reveal", { piece: p, playerId: seat.id }));
      }
      const env = st.justice;
      delete st.justice;
      if (env) {
        env.code = BACKUP;
        env.counters = 0;
        ports.putEnvironment(s, env);
      }
      const held = pool.shift();
      if (held) {
        held.thunderboltBackup = true;
        delete held.engagedWith;
        s.minions.push(held);
        revealed.push(held.id);
        ports.log(s, `${name(held)} is attached to Thunderbolt Backup.`, "bad");
      }
      // A minion beyond one per player and the attached one stays aside.
      st.aside.push(...pool);
      ports.queue(
        s,
        ...reveals,
        ...(s.difficulty === "expert"
          ? [T("justice-tough", { ids: revealed })]
          : []),
      );
      break;
    }
    case "tb:justice-reveal": {
      const p = e.piece as Piece;
      if (!alive(s, e.playerId)) {
        st?.aside.push(p);
        break;
      }
      ports.reveal(s, p, e.playerId);
      break;
    }
    case "tb:justice-tough":
      for (const id of (e.ids as string[]) || []) {
        const p = s.minions.find((m) => m.id === id);
        if (p && !p.tough)
          ports.queue(s, { type: "status", target: p.id, status: "tough" });
      }
      break;
    case "tb:backup-round": {
      // Attach the Thunderbolt minion with the most damage, swapping it with
      // the attached one, then heal the attached minion.
      const minions = thunderboltMinions(s);
      if (!minions.length) break;
      const most = Math.max(...minions.map((p) => p.damage || 0));
      const tied = minions.filter((p) => (p.damage || 0) === most);
      const held = backupMinion(s);
      if (held && tied.some((p) => p.id === held.id)) {
        ports.queue(s, T("backup-heal", { id: held.id }));
        break;
      }
      const swap = (p: Piece): Effect[] => [
        T("backup-swap", { id: p.id }),
        T("backup-heal", { id: p.id }),
      ];
      if (tied.length === 1) ports.queue(s, ...swap(tied[0]));
      else
        ports.choose(
          s,
          name(BACKUP),
          "Attach the Thunderbolt minion with the most damage.",
          tied.map((p) => ({
            id: p.id,
            label: name(p),
            image: p.code,
            effects: swap(p),
          })),
        );
      break;
    }
    case "tb:backup-swap": {
      const p = s.minions.find((m) => m.id === e.id);
      if (!p || p.thunderboltBackup) break;
      const player =
        p.engagedWith && alive(s, p.engagedWith)
          ? p.engagedWith
          : s.firstPlayerId;
      const old = backupMinion(s);
      p.thunderboltBackup = true;
      delete p.engagedWith;
      ports.log(s, `${name(p)} is attached to Thunderbolt Backup.`, "bad");
      if (old) {
        delete old.thunderboltBackup;
        ports.log(s, `${name(old)} leaves Thunderbolt Backup.`, "bad");
        ports.engage(s, old.id, player);
      }
      break;
    }
    case "tb:backup-heal": {
      const p = s.minions.find((m) => m.id === e.id && m.thunderboltBackup);
      if (!p) break;
      const expert = s.difficulty === "expert";
      ports.heal(s, p.id, (expert ? 2 : 1) * s.playerCount);
      if (expert && !p.tough)
        ports.queue(s, { type: "status", target: p.id, status: "tough" });
      break;
    }
    case "tb:engage": {
      const p = s.minions.find((m) => m.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      if (p.thunderboltBackup) {
        delete p.thunderboltBackup;
        ports.log(s, `${name(p)} leaves Thunderbolt Backup.`, "bad");
      }
      ports.engage(s, p.id, e.playerId);
      break;
    }
    case "tb:attach": {
      // Each attachment finds its host; one with none is discarded.
      const p = e.piece as Piece;
      const playerId = e.playerId as string;
      const minion = (code: string) =>
        s.minions.find((m) => m.code === code && active(s, m));
      let host: string | undefined;
      switch (p.code) {
        case SWORD:
          host = s.villain?.id;
          break;
        case CONSTRUCTS:
          host = minion(SONGBIRD)?.id || s.villain?.id;
          break;
        case HANDSPRING:
          host = minion(WIDOW)?.id || s.villain?.id;
          break;
        case MISSILES:
          host = minion(MACH_IV)?.id || s.villain?.id;
          break;
        case BINDINGS:
        case EXPOSURE:
          host = alive(s, playerId) ? `hero:${playerId}` : undefined;
          break;
        case BLASTERS: {
          const mach = minion(MACH_IV);
          if (mach) {
            host = mach.id;
            break;
          }
          // The enemy with the highest ATK; the players choose among ties.
          const enemies = [s.villain, ...s.minions].filter(
            (q): q is Piece => !!q,
          );
          const best = Math.max(
            ...enemies.map((q) => ports.enemyAttack(s, q.id)),
          );
          const tied = enemies.filter(
            (q) => ports.enemyAttack(s, q.id) === best,
          );
          if (tied.length > 1) {
            ports.choose(
              s,
              name(BLASTERS),
              "Attach Blasters to the enemy with the highest ATK.",
              tied.map((q) => ({
                id: q.id,
                label: name(q),
                image: q.code,
                effects: [T("attach-to", { piece: p, host: q.id })],
              })),
            );
            return true;
          }
          host = tied[0]?.id;
          break;
        }
      }
      ports.queue(s, T("attach-to", { piece: p, host, playerId }));
      break;
    }
    case "tb:attach-to": {
      const p = e.piece as Piece;
      if (!e.host) {
        ports.discardPiece(s, p.id);
        break;
      }
      ports.attach(s, p, String(e.host));
      if (p.code === MISSILES) p.counters = 4;
      // Citizen V's Sword: he activates against you.
      if (p.code === SWORD && e.playerId && alive(s, e.playerId))
        ports.queue(
          s,
          T("activate", { enemyId: s.villain.id, playerId: e.playerId }),
        );
      break;
    }
    case "tb:activate": {
      const enemy =
        e.enemyId === s.villain?.id
          ? s.villain
          : s.minions.find((m) => m.id === e.enemyId);
      if (!enemy || !alive(s, e.playerId) || over(s)) break;
      ports.activate(s, {
        enemyId: enemy.id,
        playerId: e.playerId,
        kind:
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "tb:attachment-response": {
      // Citizen V's Sword (2 physical) and Blasters (2 energy): after you
      // attack and damage the attached enemy, you may pay to discard it.
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a || !alive(s, e.playerId)) break;
      const need: Resource[] =
        a.code === SWORD ? ["physical", "physical"] : ["energy", "energy"];
      if (!ports.canPay(s, need.length, need)) break;
      const label = need
        .map((r) => r[0].toUpperCase() + r.slice(1))
        .join(" + ");
      ports.choose(s, name(a), `Spend ${label} to discard ${name(a)}?`, [
        {
          id: "discard",
          label: `Spend ${label} · discard ${name(a)}`,
          image: a.code,
          effects: [T("attachment-pay", { id: a.id, need })],
        },
        { id: "pass", label: "Pass", effects: [] },
      ]);
      break;
    }
    case "tb:attachment-pay": {
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a) break;
      const need = (e.need as Resource[]) || [];
      ports.pay(
        s,
        need.length,
        need,
        [T("discard", { id: a.id })],
        `${name(a)} · discard`,
        true,
      );
      break;
    }
    case "tb:discard":
      if (
        s.attachments.some((q) => q.id === e.id) ||
        s.minions.some((q) => q.id === e.id)
      )
        ports.discardPiece(s, String(e.id));
      break;
    case "tb:find": {
      // Find the Elite Thunderbolt minion and reveal it; if it is already in
      // play, it engages you. It activates against you; if no enemy
      // activated this way, this card gains surge.
      const playerId = e.playerId as string;
      if (!alive(s, playerId)) break;
      const surge: Effect = { type: "surge", sourceCode: e.source };
      const inPlay = s.minions.find((m) => m.code === e.code);
      if (inPlay) {
        ports.queue(
          s,
          T("engage", { id: inPlay.id, playerId }),
          T("find-activate", { id: inPlay.id, playerId, source: e.source }),
        );
        break;
      }
      const p =
        st?.aside.find((q) => q.code === e.code) ||
        s.encounter.deck.find((q) => q.code === e.code) ||
        s.encounter.discard.find((q) => q.code === e.code);
      const fromDeck = !!p && s.encounter.deck.some((q) => q.id === p.id);
      if (!p) {
        ports.queue(s, surge);
        break;
      }
      ports.queue(
        s,
        T("find-reveal", { id: p.id, playerId, shuffle: fromDeck }),
        T("find-activate", { id: p.id, playerId, source: e.source }),
      );
      break;
    }
    case "tb:find-reveal": {
      const i = st?.aside.findIndex((q) => q.id === e.id) ?? -1;
      const p =
        i >= 0
          ? st!.aside.splice(i, 1)[0]
          : [...s.encounter.deck, ...s.encounter.discard].find(
              (q) => q.id === e.id,
            );
      if (!p || !alive(s, e.playerId)) {
        if (p && i >= 0) st!.aside.push(p);
        break;
      }
      ports.reveal(s, p, e.playerId);
      if (e.shuffle) ports.shuffleEncounter(s);
      break;
    }
    case "tb:find-activate": {
      const p = s.minions.find((m) => m.id === e.id);
      if (!p || !alive(s, e.playerId) || over(s)) {
        if (!over(s)) ports.queue(s, { type: "surge", sourceCode: e.source });
        break;
      }
      ports.queue(s, T("activate", { enemyId: p.id, playerId: e.playerId }));
      break;
    }
    case "tb:bystander": {
      // Spend 1 resource of any type, or place 1 threat (2 in expert) on the
      // main scheme; then 1 bystander counter comes off.
      const p = seatView(s, e.playerId).player.inPlay.find(
        (q) => q.id === e.id,
      );
      if (!p || !alive(s, e.playerId)) break;
      const n = s.difficulty === "expert" ? 2 : 1;
      const counter = T("bystander-counter", {
        id: p.id,
        playerId: e.playerId,
      });
      const options: Option[] = [
        {
          id: "threat",
          label: `Place ${n} threat on the main scheme`,
          effects: [{ type: "threat", target: "main", amount: n }, counter],
        },
      ];
      if (ports.canPay(s, 1, []))
        options.push({
          id: "spend",
          label: "Spend 1 resource",
          effects: [T("bystander-pay", { id: p.id, playerId: e.playerId })],
        });
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else
        ports.choose(
          s,
          name(BYSTANDERS),
          "Spend 1 resource of any type, or place threat on the main scheme.",
          options,
        );
      break;
    }
    case "tb:bystander-pay":
      ports.pay(
        s,
        1,
        [],
        [T("bystander-counter", { id: e.id, playerId: e.playerId })],
        "Innocent Bystanders · spend 1 resource",
        false,
      );
      break;
    case "tb:bystander-counter": {
      const p = seatView(s, e.playerId).player.inPlay.find(
        (q) => q.id === e.id,
      );
      if (!p) break;
      p.counters = Math.max(0, (p.counters || 0) - 1);
      if (p.counters <= 0) ports.discardPiece(s, p.id);
      break;
    }
    case "tb:missiles": {
      // Heat-Seeking Missiles: 1 missile counter comes off, then you take 2
      // indirect damage; with none left, it is discarded.
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a || !alive(s, e.playerId)) break;
      a.counters = Math.max(0, (a.counters || 0) - 1);
      ports.indirect(s, e.playerId, 2, MISSILES, name(MISSILES));
      if (a.counters <= 0) ports.discardPiece(s, a.id);
      break;
    }
    case "tb:radiation": {
      // Radioactive Man: 1 damage to each character you control.
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        ...ports.characters(s, e.playerId).map((id) => ({
          type: "damage",
          target: id,
          amount: 1,
          source: RADIOACTIVE_MAN,
        })),
      );
      break;
    }
    case "tb:widow": {
      // Black Widow: a Handspring from the encounter deck or discard pile
      // attaches to her; otherwise you are confused.
      const widow = s.minions.find((m) => m.id === e.id);
      if (!alive(s, e.playerId)) break;
      const fromDeck = s.encounter.deck.find((q) => q.code === HANDSPRING);
      const handspring =
        fromDeck || s.encounter.discard.find((q) => q.code === HANDSPRING);
      if (widow && handspring) {
        ports.attach(s, handspring, widow.id);
        if (fromDeck) ports.shuffleEncounter(s);
        ports.log(s, "Handspring attaches to Black Widow.", "bad");
        break;
      }
      if (fromDeck) ports.shuffleEncounter(s);
      ports.queue(s, {
        type: "status",
        target: "hero",
        status: "confused",
        actorId: e.playerId,
      });
      break;
    }
    case "tb:batroc": {
      // Batroc: when he engages you, discard 1 card from your hand.
      const hand = seatView(s, e.playerId).player.hand;
      if (!hand.length || !alive(s, e.playerId)) break;
      if (hand.length === 1) {
        ports.discardFromHand(s, e.playerId, hand[0].id);
        break;
      }
      ports.choose(
        s,
        name(BATROC),
        "Discard 1 card from your hand.",
        hand.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [T("hand-discard", { playerId: e.playerId, id: q.id })],
        })),
      );
      break;
    }
    case "tb:hand-discard":
      ports.discardFromHand(s, e.playerId, String(e.id));
      break;
    case "tb:coup": {
      // Coup de Foudre: discard the top X cards of your deck, X being the
      // minion's boost icons; 1 threat here per printed energy resource.
      const coup = s.sideSchemes.find((q) => q.id === e.id);
      const minion = s.minions.find((m) => m.id === e.minion);
      if (!coup || !minion || !alive(s, e.playerId)) break;
      const x = ports.boostIcons(s, minion);
      if (x <= 0) break;
      const discarded = ports.mill(s, e.playerId, x);
      const energy = discarded.reduce(
        (n, q) => n + (def(q)?.resource_energy || 0),
        0,
      );
      if (energy > 0) {
        coup.counters += energy;
        ports.log(
          s,
          `Coup de Foudre gains ${energy} threat from discarded energy resources.`,
          "bad",
        );
      }
      break;
    }
    case "tb:exposure": {
      // Radiation Exposure: discard 1 card from your hand to discard it.
      const a = s.attachments.find((q) => q.id === e.id);
      const hand = seatView(s, e.playerId).player.hand;
      if (!a || !hand.length || !alive(s, e.playerId)) break;
      ports.choose(
        s,
        name(EXPOSURE),
        "Discard 1 card from your hand to discard Radiation Exposure.",
        hand.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            T("hand-discard", { playerId: e.playerId, id: q.id }),
            T("discard", { id: a.id }),
          ],
        })),
      );
      break;
    }
    case "tb:rotate": {
      // Each player engages each minion engaged with the player clockwise
      // from them.
      const order = seats(s);
      if (order.length < 2) break;
      const moves: [string, string][] = [];
      order.forEach((seat, i) => {
        const next = order[(i + 1) % order.length];
        for (const m of engagedWith(s, next.id)) moves.push([m.id, seat.id]);
      });
      for (const [id, playerId] of moves) ports.engage(s, id, playerId);
      break;
    }
    case "tb:down": {
      // Down but Not Out: a random Thunderbolt minion from the victory
      // display is revealed with 5 hit points remaining; this card is
      // removed from the game, with surge if no minion entered play.
      const pool = (s.victoryDisplay || []).filter(
        (q) => def(q)?.type_code === "minion" && isThunderbolt(q),
      );
      const [p] = ports.shuffle(s, pool);
      ports.queue(s, T("remove", { id: e.id }));
      if (!p || !alive(s, e.playerId)) {
        ports.queue(s, { type: "surge", sourceCode: DOWN_NOT_OUT });
        break;
      }
      ports.queue(
        s,
        T("down-reveal", { id: p.id, playerId: e.playerId }),
        T("down-damage", { id: p.id }),
      );
      break;
    }
    case "tb:down-reveal": {
      const p = (s.victoryDisplay || []).find((q) => q.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      s.victoryDisplay = (s.victoryDisplay || []).filter((q) => q.id !== p.id);
      ports.reveal(s, p, e.playerId);
      break;
    }
    case "tb:down-damage": {
      const p = s.minions.find((m) => m.id === e.id);
      if (!p) {
        ports.queue(s, { type: "surge", sourceCode: DOWN_NOT_OUT });
        break;
      }
      const remaining = ports.remainingHP(s, p.id);
      if (remaining > 5) p.damage = (p.damage || 0) + (remaining - 5);
      break;
    }
    case "tb:remove": {
      const i = s.resolving.findIndex((q) => q.id === e.id);
      if (i >= 0) s.removed.push(s.resolving.splice(i, 1)[0]);
      break;
    }
    case "tb:tap": {
      // Tap In: the Thunderbolt minion with the least damage not engaged
      // with you engages you and activates against you; otherwise Citizen V
      // activates against you.
      const playerId = e.playerId as string;
      if (!alive(s, playerId)) break;
      const pool = thunderboltMinions(s).filter(
        (m) => m.thunderboltBackup || m.engagedWith !== playerId,
      );
      if (!pool.length) {
        ports.queue(s, T("activate", { enemyId: s.villain.id, playerId }));
        break;
      }
      const least = Math.min(...pool.map((m) => m.damage || 0));
      const tied = pool.filter((m) => (m.damage || 0) === least);
      const tap = (m: Piece): Effect[] => [
        T("engage", { id: m.id, playerId }),
        T("tap-activate", { id: m.id, playerId }),
      ];
      if (tied.length === 1) ports.queue(s, ...tap(tied[0]));
      else
        ports.choose(
          s,
          name(TAP_IN),
          "Engage the Thunderbolt minion with the least damage.",
          tied.map((m) => ({
            id: m.id,
            label: name(m),
            image: m.code,
            effects: tap(m),
          })),
        );
      break;
    }
    case "tb:tap-activate": {
      const p = s.minions.find((m) => m.id === e.id);
      ports.queue(
        s,
        T("activate", {
          enemyId: p ? p.id : s.villain.id,
          playerId: e.playerId,
        }),
      );
      break;
    }
    case "tb:parley": {
      // Jolt: exhaust your hero to place a parley counter; with 3 or more,
      // she is removed from the game (not defeated).
      const p = s.minions.find((m) => m.id === e.id);
      if (!p || !alive(s, e.playerId)) break;
      ports.exhaustIdentity(s, e.playerId);
      p.counters = (p.counters || 0) + 1;
      ports.log(s, `Jolt has ${p.counters} parley counters.`, "good");
      if (p.counters >= 3) {
        ports.log(s, "Jolt is removed from the game.", "good");
        ports.removeFromGame(s, p.id);
      }
      break;
    }
    case "tb:manipulation-alter": {
      // Psychological Manipulation (alter-ego): discard an ally or support
      // you control; otherwise this card gains surge. A Permanent card
      // cannot leave play.
      const view = seatView(s, e.playerId).player;
      const choices = view.inPlay.filter(
        (q) =>
          ["ally", "support"].includes(def(q)?.type_code || "") &&
          !permanent(q),
      );
      if (!choices.length || !alive(s, e.playerId)) {
        ports.queue(s, { type: "surge", sourceCode: MANIPULATION });
        break;
      }
      if (choices.length === 1) {
        ports.discardPiece(s, choices[0].id);
        break;
      }
      ports.choose(
        s,
        name(MANIPULATION),
        "Discard an ally or support you control.",
        choices.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [T("discard-own", { id: q.id })],
        })),
      );
      break;
    }
    case "tb:discard-own":
      ports.discardPiece(s, String(e.id));
      break;
    case "tb:manipulation": {
      // Psychological Manipulation (hero): X damage to the friendly
      // character with the fewest remaining hit points, X being your hero's
      // ATK.
      if (!alive(s, e.playerId)) break;
      const x = ports.heroAttack(s, e.playerId);
      const chars = seats(s).flatMap((seat) =>
        ports.characters(s, seat.id).map((id) => ({
          id,
          hp: id.startsWith("hero:")
            ? seatView(s, id.slice(5)).player.hp
            : ports.remainingHP(s, id),
          label: id.startsWith("hero:")
            ? ports.heroName(s, id.slice(5))
            : name(
                seatView(s, seat.id).player.inPlay.find((q) => q.id === id) ||
                  id,
              ),
        })),
      );
      if (!chars.length || x <= 0) break;
      const least = Math.min(...chars.map((c) => c.hp));
      const tied = chars.filter((c) => c.hp === least);
      const hit = (id: string): Effect => ({
        type: "damage",
        target: id,
        amount: x,
        source: MANIPULATION,
      });
      if (tied.length === 1) ports.queue(s, hit(tied[0].id));
      else
        ports.choose(
          s,
          name(MANIPULATION),
          `Deal ${x} damage to the friendly character with the fewest remaining hit points.`,
          tied.map((c) => ({
            id: c.id,
            label: c.label,
            effects: [hit(c.id)],
          })),
        );
      break;
    }
    case "tb:pride": {
      // Pride of the Red Room: 1 more threat for each Preparation card in
      // play.
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p) break;
      const n = [...s.attachments, ...s.minions, ...s.sideSchemes].filter((q) =>
        hasPrintedTrait(q, "Preparation"),
      ).length;
      if (n > 0) p.counters += n;
      break;
    }
    case "tb:runaway": {
      // Runaway Nuclear Reaction: threat equal to the damage; at 10 or more,
      // 10 damage to each character and it is discarded.
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p) break;
      p.counters += Number(e.n) || 0;
      if (p.counters < 10) break;
      ports.log(
        s,
        "Runaway Nuclear Reaction deals 10 damage to each character.",
        "bad",
      );
      ports.discardPiece(s, p.id);
      const everyone = [
        ...seats(s).flatMap((seat) => ports.characters(s, seat.id)),
        ...(s.villain ? [s.villain.id] : []),
        ...s.minions.map((m) => m.id),
      ];
      ports.queue(
        s,
        ...everyone.map((id) => ({
          type: "damage",
          target: id,
          amount: 10,
          source: RUNAWAY,
        })),
      );
      break;
    }
    case "tb:exhaust-one": {
      // Gravitational Pull (boost): exhaust a character you control.
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      const options: Option[] = [];
      if (!view.exhausted)
        options.push({
          id: "hero",
          label: `Exhaust ${ports.heroName(s, e.playerId)}`,
          effects: [{ type: "exhaust", id: "hero", actorId: e.playerId }],
        });
      for (const q of view.inPlay.filter(
        (q) => def(q)?.type_code === "ally" && !q.exhausted,
      ))
        options.push({
          id: q.id,
          label: `Exhaust ${name(q)}`,
          image: q.code,
          effects: [{ type: "exhaust", id: q.id, actorId: e.playerId }],
        });
      if (!options.length) break;
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else
        ports.choose(
          s,
          name(GRAVITATIONAL_PULL),
          "Exhaust a character you control.",
          options,
        );
      break;
    }
    case "tb:skies-boost": {
      // Rule the Skies (boost): an Aerial activating enemy gets another
      // boost card.
      const enemy =
        e.enemyId === s.villain?.id
          ? s.villain
          : s.minions.find((m) => m.id === e.enemyId);
      if (enemy && e.aerial !== false && hasPrintedTrait(enemy, "Aerial"))
        ports.queue(s, T("extra-boost", { enemyId: enemy.id }));
      break;
    }
    case "tb:extra-boost":
      if (activation(s)?.attacker === e.enemyId)
        ports.giveBoost(s, String(e.enemyId), "current");
      break;
    case "tb:bindings-boost": {
      // Hard Sound Bindings (boost): you are stunned; if you already were,
      // the activating enemy gets another boost card.
      if (!alive(s, e.playerId)) break;
      if (seatView(s, e.playerId).player.stunned)
        ports.queue(s, T("extra-boost", { enemyId: e.enemyId }));
      else
        ports.queue(s, {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: e.playerId,
        });
      break;
    }
    case "tb:spider-boost": {
      // Pale Little Spider (boost): you are confused; if you already were, 1
      // threat on the main scheme.
      if (!alive(s, e.playerId)) break;
      if (seatView(s, e.playerId).player.confused)
        ports.queue(s, { type: "threat", target: "main", amount: 1 });
      else
        ports.queue(s, {
          type: "status",
          target: "hero",
          status: "confused",
          actorId: e.playerId,
        });
      break;
    }
    case "tb:indirect":
      if (alive(s, e.playerId))
        ports.indirect(
          s,
          e.playerId,
          Number(e.n),
          String(e.source),
          name(String(e.source)),
        );
      break;
    case "tb:supersonic-boost":
      if (s.attack) {
        s.attack.overkill = true;
        s.attack.ranged = true;
      }
      break;
    case "tb:discard-one": {
      // Batroc the Leaper (boost): discard 1 card from your hand.
      const hand = seatView(s, e.playerId).player.hand;
      if (!hand.length || !alive(s, e.playerId)) break;
      if (hand.length === 1) ports.discardFromHand(s, e.playerId, hand[0].id);
      else
        ports.choose(
          s,
          name(LEAPER),
          "Discard 1 card from your hand.",
          hand.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [T("hand-discard", { playerId: e.playerId, id: q.id })],
          })),
        );
      break;
    }
    case "tb:after": {
      // After this attack resolves.
      const a = activation(s);
      if (!a) break;
      (a.afterActivation ||= []).push(...((e.effects as Effect[]) || []));
      break;
    }
    case "tb:parcours": {
      // Parcours du Combattant (boost): engage a minion in play that is not
      // engaged with you.
      if (!alive(s, e.playerId)) break;
      const pool = s.minions.filter(
        (m) => m.thunderboltBackup || m.engagedWith !== e.playerId,
      );
      if (!pool.length) break;
      if (pool.length === 1) {
        ports.queue(s, T("engage", { id: pool[0].id, playerId: e.playerId }));
        break;
      }
      ports.choose(
        s,
        name(PARCOURS),
        "Engage a minion in play that is not engaged with you.",
        pool.map((m) => ({
          id: m.id,
          label: name(m),
          image: m.code,
          effects: [T("engage", { id: m.id, playerId: e.playerId })],
        })),
      );
      break;
    }
    default:
      throw Error(`Unknown Thunderbolts effect: ${e.type}`);
  }
  return true;
}
