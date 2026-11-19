import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { onSeatActivated, playerOrder, seatView } from "./team.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** The Once and Future Kang scenario pack: the Kang scenario, the Expert
 * Kang villains and the Temporal, Master of Time and Anachronauts modular
 * sets. */
export const KANG_SCENARIO_CODES = [
  "11001",
  "11002",
  "11003",
  "11004",
  "11005",
  "11006",
  "11007a",
  "11007b",
  "11008a",
  "11008b",
  "11009a",
  "11009b",
  "11010a",
  "11010b",
  "11011a",
  "11011b",
  "11012a",
  "11012b",
  "11013a",
  "11013b",
  "11014",
  "11015",
  "11016",
  "11017",
  "11018",
  "11019",
  "11020",
  "11021",
  "11022",
  "11023",
  "11024",
  "11025",
  "11026",
  "11027",
  "11028",
  "11029",
  "11034",
  "11035",
  "11036",
  "11037",
  "11038",
  "11039",
] as const;
export const KANG_MODULE_CODES = [
  "11030",
  "11031",
  "11032",
  "11033",
  "11040",
  "11041",
  "11042",
  "11043",
  "11044",
  "11045",
  "11046",
  "11047",
  "11048",
  "11049",
  "11050",
  "11051",
] as const;
export const KANG_SCRIPT_CODES = [
  ...KANG_SCENARIO_CODES,
  ...KANG_MODULE_CODES,
] as const;

/** Standard and Expert versions of each villain card. */
export const KANG_I = ["11001", "11034"] as const;
export const KANG_III = ["11006", "11039"] as const;
const IMMORTUS = ["11002", "11035"];
const IRON_LAD = ["11003", "11036"];
const RAMA_TUT = ["11004", "11037"];
const CENTURION = ["11005", "11038"];
export const KANG_ARRIVAL = "11007b";
export const MASTER_OF_TIME_STAGE = "11008b";
export const KANGS_WRATH = "11013b";
/** Each stage 3 scheme and the Kang (II) it adds to its game area. */
export const KANG_STAGE_THREE: readonly {
  scheme: string;
  villain: readonly string[];
}[] = [
  { scheme: "11009b", villain: IMMORTUS },
  { scheme: "11010b", villain: IRON_LAD },
  { scheme: "11011b", villain: RAMA_TUT },
  { scheme: "11012b", villain: CENTURION },
];
const TEMPORAL_SHIELD = "11014";
const FUTURE_WEAPON = "11015";
const FROZEN_IN_TIME = "11016";
const MACROBOTS = "11017";
const WEAKENED = "11018";
const STOLEN_MEMORIES = "11019";
const DEPOWERED = "11020";
const HIJINKS = "11021";
const CORRUPTED = "11022";
export const KANGS_DOMINION = "11023";
const PINNED_DOWN = "11024";
const RAMPAGE = "11025";
const ENERGY_BLAST = "11026";
const MANIPULATED = "11027";
const TACTICS = "11028";
const MACHINATIONS = "11029";
const ANCIENT_WARRIOR = "11030";
const CHITAURI = "11031";
const TREX = "11032";
const TIME_PORTAL = "11033";
const APOCRYPHUS = "11040";
const DEATHUNT = "11041";
const RASTON = "11042";
const TERMINATRIX = "11043";
const WILDRUN = "11044";
const ANACHRONAUTS = "11045";
const KANGS_CHOSEN = "11046";
export const MASTER_OF_TIME = "11047";
const DISPLACED = "11048";
const FEAR_OF_KANG = "11049";
const SPHERE = "11050";
const GRUDGE = "11051";
/** Encounter obligations that stay in their player's play area. */
export const KANG_IN_PLAY_OBLIGATIONS = [
  WEAKENED,
  STOLEN_MEMORIES,
  DEPOWERED,
  HIJINKS,
  FEAR_OF_KANG,
] as const;

type Villain = GameState["villain"];

/** One player's game area in stage 3: its own Kang (II), stage 3 scheme,
 * side schemes and minions. The area of the active player is the native
 * game state; the record of every other area holds its cards. */
export interface KangArea {
  id: string;
  players: string[];
  villain?: Villain;
  scheme?: GameState["scheme"];
  sideSchemes?: Piece[];
  minions?: Piece[];
  /** The physical stage 3 card. */
  stage: Piece;
  /** Kang (II) was defeated: no villain is in play in this game area. */
  villainGone?: boolean;
  /** The stage 3 scheme was completed or removed from the game. */
  schemeDone?: boolean;
  /** At the end of the phase the area joins or combines with another. */
  leaving?: "defeated" | "completed";
}
export interface KangState {
  stage: 1 | 3 | 4;
  /** The physical main scheme card in play: stage 1, 2 or 4. */
  currentMain: Piece;
  /** The Master of Time and Kang's Wrath, set aside until they advance. */
  mainDeck: Piece[];
  /** Physical stage 3A cards not yet revealed. */
  stageThree: Piece[];
  /** Set-aside Kang (II) and Kang (III) villain cards. */
  setAside: Piece[];
  /** Set-aside Kang's Dominion side schemes. */
  dominions: Piece[];
  /** Kang's Dominion facedown under stage 4A. */
  underWrath: Piece[];
  /** Kang (I) was defeated: the main scheme advances at the end of the
   * phase, and until then no villain is in play. */
  advancing?: boolean;
  /** Stage 3: the game areas and the one that is native. */
  areas?: KangArea[];
  focus?: string;
  /** Players whose set-aside nemesis minion Kang's Wrath put into play. */
  nemesisOut?: string[];
}

export interface KangPorts extends MutagenEnginePorts {
  revealHidden(s: GameState): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  resetPiece(p: Piece): Piece;
  endGame(s: GameState, won: boolean, text: string): void;
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  heroName(s: GameState, playerId: string): string;
  indirect(s: GameState, playerId: string, amount: number, source: Piece): void;
  randomDiscard(s: GameState, playerId: string): Piece | undefined;
  discardHandCard(s: GameState, playerId: string, id: string): void;
  allies(s: GameState, playerId: string): Piece[];
  cost(p: Piece): number;
  canDiscard(s: GameState, p: Piece): boolean;
  /** Put this player's nemesis minion into play engaged with them, from the
   * encounter deck, the discard pile or the set-aside area. Returns true when
   * a set-aside card that Shadow of the Past would reveal entered play. */
  nemesisMinion(s: GameState, playerId: string): boolean;
  giveTough(s: GameState, p: Piece): void;
  /** A Kang villain leaves play: its attachments are discarded (permanent
   * player cards return to their owners), with the native cleanup. */
  villainLeft(s: GameState, id: string): void;
  /** Discard the attachments of the main scheme that leaves play. */
  mainChanged(s: GameState): void;
  /** When game areas combine, discard copies of unique cards (first player
   * order keeps the first copy). */
  combineUniques(s: GameState, playerIds: string[]): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const typeOf = (p: Piece) => def(p)?.type_code;
const K = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `kang:${type}`,
  ...args,
});
const scripted = new Set<string>(KANG_SCRIPT_CODES);
const known = (p: Piece) => scripted.has(p.code);
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const version = (s: GameState) => (s.difficulty === "expert" ? 1 : 0);
const hasTrait = (p: Piece, trait: string) =>
  (def(p)?.traits || "").split(/\.\s*/).includes(trait);
/** Every enemy titled Kang: each Kang villain and Kang (Master of Time). */
export const titledKang = (p: Piece) => /^Kang(?: \(|$)/.test(name(p));

// ---------------------------------------------------------------- areas

/** Stage 3 splits the table into separate game areas. */
export function kangSeparate(s: GameState) {
  return !!s.kang?.areas?.length;
}
export function kangAreaOf(s: GameState, playerId: string) {
  return s.kang?.areas?.find((a) => a.players.includes(playerId));
}
/** Players in this player's game area, in player order ("each player" in
 * stage 3 means the players in the same game area). */
export function kangAreaPlayers(s: GameState, playerId: string): string[] {
  const order = playerOrder(s).map((seat) => seat.id);
  const area = kangAreaOf(s, playerId);
  return area ? order.filter((id) => area.players.includes(id)) : order;
}
export function kangSameArea(s: GameState, a: string, b: string) {
  if (!kangSeparate(s)) return true;
  const area = kangAreaOf(s, a);
  return !!area && area.players.includes(b);
}
/** Store the native fields into the native area's record. */
function storeFocus(s: GameState) {
  const k = s.kang;
  const area = k?.areas?.find((a) => a.id === k.focus);
  if (!area) return;
  area.villain = s.villain;
  area.scheme = s.scheme;
  area.sideSchemes = s.sideSchemes;
  area.minions = s.minions;
}
/** Make an area native and clear the record's copies, so a save never holds
 * the same card twice. */
function loadFocus(s: GameState, area: KangArea) {
  s.villain = area.villain!;
  s.scheme = area.scheme!;
  s.sideSchemes = area.sideSchemes || [];
  s.minions = area.minions || [];
  delete area.villain;
  delete area.scheme;
  delete area.sideSchemes;
  delete area.minions;
}
export function kangFocus(s: GameState, id: string) {
  const k = s.kang;
  if (!k?.areas || k.focus === id) return;
  const next = k.areas.find((a) => a.id === id);
  if (!next) return;
  storeFocus(s);
  loadFocus(s, next);
  k.focus = id;
}
/** The active player's game area is native. */
export function kangFocusSeat(s: GameState) {
  const area = kangAreaOf(s, s.activePlayerId);
  if (area) kangFocus(s, area.id);
}
onSeatActivated((s) => {
  if (s.kang?.areas) kangFocusSeat(s);
});
/** Run fn with each game area native in turn, then restore the focus. */
export function kangEachArea<T>(s: GameState, fn: (area: KangArea) => T): T[] {
  const k = s.kang;
  if (!k?.areas) return [];
  const original = k.focus;
  const out: T[] = [];
  for (const area of [...k.areas]) {
    kangFocus(s, area.id);
    out.push(fn(area));
  }
  if (original) kangFocus(s, original);
  return out;
}
/** The live fields of an area, wherever the focus is. */
export function kangAreaView(s: GameState, area: KangArea) {
  const focused = s.kang?.focus === area.id;
  return {
    villain: focused ? s.villain : area.villain!,
    scheme: focused ? s.scheme : area.scheme!,
    sideSchemes: focused ? s.sideSchemes : area.sideSchemes || [],
    minions: focused ? s.minions : area.minions || [],
  };
}
/** The scenario's cards outside the native zones, for physical audits. */
export function kangStoredPieces(s: GameState): Piece[] {
  const k = s.kang;
  if (!k) return [];
  return [
    k.currentMain,
    ...k.mainDeck,
    ...k.stageThree,
    ...k.setAside,
    ...k.dominions,
    ...k.underWrath,
    ...(k.areas || []).flatMap((a) => [
      a.stage,
      ...(a.id === k.focus
        ? []
        : [
            ...(a.villain ? [a.villain] : []),
            ...(a.sideSchemes || []),
            ...(a.minions || []),
          ]),
    ]),
  ];
}
/** No villain in play: after Kang (I) is defeated until the main scheme
 * advances, or in a game area whose Kang (II) was defeated. */
export function kangVillainAbsent(s: GameState) {
  const k = s.kang;
  if (!k) return false;
  if (k.stage === 1) return !!k.advancing;
  if (k.stage === 3)
    return !!k.areas?.find((a) => a.id === k.focus)?.villainGone;
  return false;
}

// ------------------------------------------------------------- setup

/** Kang's Arrival (1B): When Revealed, deal each player an encounter card. */
export function kangSetupEffects(s: GameState): Effect[] {
  return playerOrder(s).map((seat) =>
    K("deal", { playerId: seat.id, actorId: seat.id }),
  );
}

// ---------------------------------------------------------- villains

/** Kang (I) and (III): when Kang attacks you, place 1 threat on the main
 * scheme or he gets +2 ATK. Chitauri Soldier: when it attacks you, discard
 * the top encounter card and take indirect damage for its boost icons. */
export function kangAttackInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
): Effect[] {
  if (
    s.kang &&
    enemyId === s.villain.id &&
    !kangVillainAbsent(s) &&
    [...KANG_I, ...KANG_III].includes(s.villain.code as never) &&
    !isTextBlank(s, s.villain)
  )
    return [K("conqueror", { playerId, actorId: playerId })];
  const chitauri = s.minions.find((m) => m.id === enemyId);
  if (chitauri?.code === CHITAURI && !isTextBlank(s, chitauri))
    return [K("chitauri", { id: chitauri.id, playerId, actorId: playerId })];
  return [];
}
export function kangKeyword(s: GameState, p: Piece, keyword: string): number {
  if (isTextBlank(s, p)) return 0;
  if (keyword === "Piercing")
    return (s.kang && CENTURION.includes(p.code)) ||
      p.code === TREX ||
      p.code === TERMINATRIX
      ? 1
      : 0;
  if (keyword === "Overkill")
    return s.attack?.attacker === p.id &&
      s.attachments.some(
        (a) =>
          a.code === FUTURE_WEAPON &&
          a.attachedTo === p.id &&
          !isTextBlank(s, a),
      )
      ? 1
      : 0;
  return 0;
}
/** Obligations in a player's play area. */
export function kangObligations(s: GameState, playerId: string): number {
  if (!alive(s, playerId)) return 0;
  return seatView(s, playerId).player.inPlay.filter(
    (p) => typeOf(p) === "obligation",
  ).length;
}
/** Rama-Tut: +1 ATK for each obligation in play (in his game area). Kang
 * (Master of Time): +1 ATK and SCH for each obligation in your play area. */
export function kangEnemyStat(
  s: GameState,
  p: Piece,
  kind: "attack" | "scheme",
  playerId: string,
): number {
  if (isTextBlank(s, p)) return 0;
  if (s.kang && RAMA_TUT.includes(p.code) && kind === "attack")
    return kangAreaPlayers(s, s.activePlayerId).reduce(
      (n, id) => n + kangObligations(s, id),
      0,
    );
  if (p.code === MASTER_OF_TIME) return kangObligations(s, playerId);
  return 0;
}
/** Kang cannot take damage while Kang's Dominion is in play; Immortus while
 * a minion is in play; and no villain is in play during the gaps. */
export function kangDamageProhibited(
  s: GameState,
  target: string,
): string | undefined {
  if (!s.kang || target !== s.villain.id) return undefined;
  if (kangVillainAbsent(s)) return "No villain is in play.";
  if (
    s.sideSchemes.some((p) => p.code === KANGS_DOMINION && !isTextBlank(s, p))
  )
    return "Kang's Dominion: Kang cannot take damage.";
  if (
    IMMORTUS.includes(s.villain.code) &&
    !isTextBlank(s, s.villain) &&
    s.minions.length
  )
    return "Kang (Immortus) cannot take damage while a minion is in play.";
  return undefined;
}
/** Temporal Shield: when Kang is attacked, discard it to prevent all damage
 * from the attack and deal 1 damage to the attacker (max 1 per attack). */
export function kangPreventAttackDamage(
  s: GameState,
  target: string,
  amount: number,
  attackKey: string,
): { amount: number; discardId?: string } {
  if (!s.kang || target !== s.villain.id || amount <= 0) return { amount };
  const used = `kangShield:${attackKey}`;
  if (s.flags[used]) return { amount: 0 };
  const shield = s.attachments.find(
    (a) =>
      a.code === TEMPORAL_SHIELD &&
      a.attachedTo === target &&
      !isTextBlank(s, a),
  );
  if (!shield) return { amount };
  s.flags[used] = true;
  return { amount: 0, discardId: shield.id };
}
/** Fear of Kang: you cannot attack Kang. */
export function kangAttackForbidden(s: GameState, targetId: string) {
  if (
    !s.player.inPlay.some((p) => p.code === FEAR_OF_KANG && !isTextBlank(s, p))
  )
    return false;
  const target =
    targetId === s.villain.id
      ? s.villain
      : s.minions.find((m) => m.id === targetId);
  return !!target && titledKang(target);
}
/** Depowered: you cannot play hero-specific cards. */
export function kangPlayRestriction(s: GameState, p: Piece): string | null {
  if (
    def(p)?.faction_code === "hero" &&
    s.player.inPlay.some((q) => q.code === DEPOWERED && !isTextBlank(s, q))
  )
    return "Depowered prevents you from playing hero-specific cards.";
  return null;
}
/** Frozen in Time: when your identity would ready, discard it instead. */
export function kangFrozenInTime(s: GameState, playerId: string) {
  return s.attachments.find(
    (a) =>
      a.code === FROZEN_IN_TIME &&
      a.attachedTo === `hero:${playerId}` &&
      !isTextBlank(s, a),
  );
}
/** Weakened: after you use a basic hero power, take 1 damage. */
export function kangAfterBasicPower(s: GameState): Effect[] {
  const count = s.player.inPlay.filter(
    (p) => p.code === WEAKENED && !isTextBlank(s, p),
  ).length;
  return count && s.player.form === "hero"
    ? Array.from({ length: count }, () => ({
        type: "damage",
        target: "hero",
        amount: 1,
        source: "encounter",
        actorId: s.activePlayerId,
      }))
    : [];
}
/** When a player is eliminated in stage 3, the minions engaged with them stay
 * in their game area: the next player there, or nobody until it combines. */
export function kangEngagementHeir(
  s: GameState,
  playerId: string,
  next: string,
): string {
  const area = kangAreaOf(s, playerId);
  if (!area) return next;
  return (
    playerOrder(s)
      .map((seat) => seat.id)
      .find((id) => id !== playerId && area.players.includes(id)) || playerId
  );
}

// ------------------------------------------------------------ defeats

/** A Kang villain is defeated. Attachments and status cards are discarded;
 * they do not carry over to the next Kang. */
export function kangVillainDefeated(s: GameState, ports: KangPorts) {
  const k = s.kang;
  if (!k || kangVillainAbsent(s) || over(s)) return;
  const old = s.villain;
  if ((KANG_III as readonly string[]).includes(old.code)) {
    ports.endGame(s, true, "Kang the Conqueror is defeated in every era.");
    return;
  }
  ports.villainLeft(s, old.id);
  Object.assign(old, ports.resetPiece({ ...old }), {
    hp: 0,
    tough: false,
    stunned: false,
    confused: false,
  });
  if ((KANG_I as readonly string[]).includes(old.code)) {
    k.advancing = true;
    ports.log(
      s,
      "Kang is defeated. The main scheme advances to stage 2 at the end of the phase.",
      "good",
    );
    return;
  }
  const area = k.areas?.find((a) => a.id === k.focus);
  if (!area) return;
  area.villainGone = true;
  if (!area.schemeDone)
    ports.log(
      s,
      `${name(old)} is defeated: ${name(s.scheme.code)} is removed from the game, and this game area joins another at the end of the phase.`,
      "good",
    );
  area.schemeDone = true;
  area.leaving ??= "defeated";
}
/** A main scheme is completed. */
export function kangMainCompleted(s: GameState, ports: KangPorts) {
  const k = s.kang;
  if (!k || over(s)) return;
  if (s.scheme.code === KANG_ARRIVAL) {
    ports.endGame(
      s,
      false,
      "Kang's Arrival is complete. Kang conquers the present.",
    );
    return;
  }
  if (s.scheme.code === KANGS_WRATH) {
    ports.endGame(
      s,
      false,
      "Kang's Wrath is complete. Every era bows to Kang.",
    );
    return;
  }
  const area = k.areas?.find((a) => a.id === k.focus);
  if (area && !area.schemeDone) completeArea(s, area, ports);
}
/** Stage 3B is completed: a Kang's Dominion goes facedown under stage 4A,
 * and the area combines with another at the end of the phase. */
function completeArea(s: GameState, area: KangArea, ports: KangPorts) {
  const k = s.kang!;
  area.schemeDone = true;
  area.leaving ??= "completed";
  const dominion = k.dominions.shift();
  if (dominion) k.underWrath.push(dominion);
  ports.log(
    s,
    `${name(area.stage.code.replace(/a$/, "b"))} is complete: a Kang's Dominion goes facedown under Kang's Wrath, and this game area combines with another at the end of the phase.`,
    "bad",
  );
}
/** "If all the players at this stage are defeated, this stage is completed." */
export function kangCheck(s: GameState, ports: KangPorts) {
  const k = s.kang;
  if (!k?.areas || over(s)) return;
  for (const area of k.areas)
    if (
      !area.schemeDone &&
      area.players.length &&
      area.players.every((id) => !alive(s, id))
    )
      completeArea(s, area, ports);
}

// --------------------------------------------------------- phases

/** At the end of each phase: stage 2, or game areas joining others. */
export function kangPhaseEnded(s: GameState): Effect[] {
  const k = s.kang;
  if (!k || over(s)) return [];
  if (k.advancing)
    return [K("stage-two", { mandatory: true, actorId: s.firstPlayerId })];
  if (k.areas?.some((a) => a.leaving))
    return [K("areas-leave", { mandatory: true, actorId: s.firstPlayerId })];
  return [];
}
/** Step one in stage 3: each game area's main scheme gains its own threat.
 * The acceleration tokens are on stage 2B and add none until stage 4. */
export function kangStepOne(s: GameState): Effect[] | null {
  const k = s.kang;
  if (!k?.areas) return null;
  return k.areas
    .filter((a) => !a.schemeDone)
    .flatMap((a) => {
      const actor = kangAreaPlayers(s, a.players[0]).find((id) =>
        a.players.includes(id),
      );
      return actor && alive(s, actor)
        ? [{ type: "villainStepOne", kangArea: a.id, actorId: actor }]
        : [];
    });
}

// ------------------------------------------------------- responses

export interface KangAttackReceipt {
  token: string;
  attackerId: string;
  playerId: string;
  performed: boolean;
  identityDamaged: boolean;
}
/** Future Weapon: if the attack damaged a hero, that hero is stunned; after
 * the attack it is discarded. */
export function kangAttackResponses(
  s: GameState,
  r: KangAttackReceipt,
): MutagenForcedResponse[] {
  const weapons = s.attachments.filter(
    (a) =>
      a.code === FUTURE_WEAPON &&
      a.attachedTo === r.attackerId &&
      !isTextBlank(s, a),
  );
  if (!weapons.length) return [];
  return [
    {
      id: `${r.token}:future-weapon`,
      title: name(FUTURE_WEAPON),
      effects: [
        ...(r.identityDamaged && r.performed && alive(s, r.playerId)
          ? [
              {
                type: "status",
                target: "hero",
                status: "stunned",
                actorId: r.playerId,
              },
            ]
          : []),
        ...weapons.map((a) => ({ type: "discardPiece", id: a.id })),
      ],
    },
  ];
}
/** When Defeated of the side schemes. */
export function kangSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case KANGS_DOMINION:
      return [K("deal", { playerId, actorId: playerId })];
    case RAMPAGE:
    case SPHERE:
      return [K("dig-minion", { playerId, actorId: playerId })];
    case ANACHRONAUTS:
      return [K("anachronauts", { actorId: playerId })];
    default:
      return [];
  }
}
/** Time Portal is shuffled into the encounter deck instead of discarded. */
export function kangSchemeRetained(s: GameState, p: Piece) {
  return p.code === TIME_PORTAL && !isTextBlank(s, p);
}

// --------------------------------------------------------- actions

const OBLIGATION_COSTS: Record<string, (c: Piece) => boolean> = {
  [WEAKENED]: (c) => !!(def(c)?.resource_physical || def(c)?.resource_wild),
  [STOLEN_MEMORIES]: (c) =>
    !!(def(c)?.resource_mental || def(c)?.resource_wild),
  [HIJINKS]: (c) => !!(def(c)?.resource_energy || def(c)?.resource_wild),
  [DEPOWERED]: (c) => def(c)?.faction_code === "hero",
};
/** Alter-Ego Actions that discard the encounter obligations. */
export function kangActions(s: GameState, p: Piece): Option[] {
  if (
    !(KANG_IN_PLAY_OBLIGATIONS as readonly string[]).includes(p.code) ||
    isTextBlank(s, p) ||
    s.player.form !== "alter" ||
    !s.player.inPlay.some((q) => q.id === p.id) ||
    s.sideSchemes.some((q) => q.code === CORRUPTED && !isTextBlank(s, q))
  )
    return [];
  if (p.code === FEAR_OF_KANG)
    return s.player.hand.length
      ? [
          {
            id: "discard",
            label: `Discard a random card · discard ${name(p)}`,
            image: p.code,
            effects: [K("fear-pay", { id: p.id })],
          },
        ]
      : [];
  if (!s.player.hand.some(OBLIGATION_COSTS[p.code])) return [];
  const resource =
    p.code === WEAKENED
      ? "physical resource"
      : p.code === STOLEN_MEMORIES
        ? "mental resource"
        : p.code === HIJINKS
          ? "energy resource"
          : "hero-specific card";
  return [
    {
      id: "discard",
      label: `Discard a ${resource} · discard ${name(p)}`,
      image: p.code,
      effects: [K("obligation-pay", { id: p.id })],
    },
  ];
}

// ---------------------------------------------------- reveal & boosts

export function kangReveal(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  const playerId = s.activePlayerId;
  if (p.code === TEMPORAL_SHIELD || p.code === FUTURE_WEAPON)
    return [K("attach-kang", { piece: p })];
  if (p.code === FROZEN_IN_TIME)
    return [K("attach-identity", { piece: p, playerId })];
  if (isTextBlank(s, p)) return [];
  const hero = s.player.form === "hero";
  switch (p.code) {
    case STOLEN_MEMORIES:
      return [K("stolen", { id: p.id, playerId })];
    case HIJINKS:
      return [K("hijinks", { id: p.id, playerId })];
    case CORRUPTED:
      return [
        K("corrupted", { id: p.id, remaining: kangAreaPlayers(s, playerId) }),
      ];
    case PINNED_DOWN:
      return [K("pinned", { id: p.id, playerId })];
    case ENERGY_BLAST:
      return hero
        ? [K("villain-attack", { playerId })]
        : [K("energy-blast", { playerId, sourceCode: p.code })];
    case MANIPULATED:
      return [K("manipulated", { playerId, sourceCode: p.code })];
    case TACTICS:
      return [
        K("tactics", { id: p.id, remaining: kangAreaPlayers(s, playerId) }),
      ];
    case MACHINATIONS:
      return [
        K("machinations", {
          remaining: kangAreaPlayers(s, playerId),
          used: [],
        }),
      ];
    case APOCRYPHUS:
      return [K("discard-ally-support", { playerId })];
    case WILDRUN:
      return [K("random-discard", { playerId })];
    case KANGS_CHOSEN:
      return [K("chosen", { playerId })];
    case GRUDGE:
      return [K("grudge", { playerId })];
    default:
      return [];
  }
}

export function kangBoost(s: GameState, p: Piece): Effect[] | null {
  if (!known(p)) return null;
  if (isTextBlank(s, p)) return [];
  const a = s.attack || s.scheming;
  const playerId =
    s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
  const enemyId = a?.attacker;
  const more = (n: number): Effect[] =>
    enemyId ? [K("more-boosts", { enemyId, amount: n })] : [];
  switch (p.code) {
    case FROZEN_IN_TIME:
      return [K("attach-identity", { piece: p, playerId, boost: true })];
    case MACROBOTS:
      return [K("kang-tough")];
    case TACTICS:
      return [K("tactics-boost", { playerId })];
    case ANCIENT_WARRIOR:
      return [
        {
          type: "status",
          target: "hero",
          status: "stunned",
          actorId: playerId,
        },
      ];
    case APOCRYPHUS:
      return [K("exhaust-character", { playerId }), ...more(1)];
    case DEATHUNT:
      return enemyId
        ? [{ type: "status", target: enemyId, status: "tough" }, ...more(1)]
        : [];
    case RASTON:
      return [
        {
          type: "damage",
          target: "hero",
          amount: 1,
          source: "encounter",
          actorId: playerId,
        },
        ...more(1),
      ];
    case TERMINATRIX:
      return more(2);
    case WILDRUN:
      return [K("random-discard", { playerId }), ...more(1)];
    case DISPLACED:
      return [K("deal", { playerId, actorId: playerId })];
    default:
      return [];
  }
}

// ---------------------------------------------------------- resolver

export function resolveKangEffect(
  s: GameState,
  e: Effect,
  ports: KangPorts,
): boolean {
  if (!e.type.startsWith("kang:")) return false;
  switch (e.type) {
    case "kang:deal":
      if (alive(s, e.playerId) && !over(s)) ports.dealEncounter(s, e.playerId);
      break;
    case "kang:conqueror": {
      if (!alive(s, e.playerId) || over(s) || kangVillainAbsent(s)) break;
      ports.choose(
        s,
        name(s.villain),
        `${ports.heroName(s, e.playerId)}: place 1 threat on the main scheme, or Kang gets +2 ATK for this attack.`,
        [
          {
            id: "threat",
            label: "Place 1 threat on the main scheme",
            effects: [
              {
                type: "threat",
                target: "main",
                amount: 1,
                actorId: e.playerId,
              },
            ],
          },
          {
            id: "attack",
            label: "Kang gets +2 ATK for this attack",
            image: s.villain.code,
            effects: [K("conqueror-attack")],
          },
        ],
      );
      break;
    }
    case "kang:conqueror-attack": {
      const a = s.attack;
      if (!a || a.attacker !== s.villain.id) break;
      a.modifier = (a.modifier || 0) + 2;
      // The attack's initiation window carries its modifier forward.
      for (const q of s.queue)
        if (
          q.type === "enemyAttackInitiationWindow" &&
          q.attacker === a.attacker
        )
          q.modifier = (Number(q.modifier) || 0) + 2;
      break;
    }
    case "kang:chitauri": {
      if (!alive(s, e.playerId)) break;
      const { piece } = ports.discardTop(s);
      if (!piece) break;
      const icons = def(piece)?.boost || 0;
      const source = s.minions.find((m) => m.id === e.id) || {
        id: e.id,
        code: CHITAURI,
      };
      ports.log(
        s,
        `Chitauri Soldier discards ${name(piece)} (${icons} boost icon${icons === 1 ? "" : "s"}).`,
        "bad",
      );
      if (icons) ports.indirect(s, e.playerId, icons, source as Piece);
      break;
    }
    case "kang:stage-two":
      stageTwo(s, ports);
      break;
    case "kang:areas-leave":
      areasLeave(s, ports, e.choice, e.leaving);
      break;
    case "kang:attach-kang": {
      const p = e.piece as Piece;
      if (s.kang && !kangVillainAbsent(s)) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "kang:attach-identity": {
      const p = e.piece as Piece;
      if (e.boost) {
        // The boost card stays in play attached to the identity.
        const activation = s.attack || s.scheming;
        if (activation && !activation.retainedBoostIds?.includes(p.id))
          (activation.retainedBoostIds ||= []).push(p.id);
      }
      if (!alive(s, e.playerId)) ports.discardPiece(s, p.id);
      else ports.attach(s, p, `hero:${e.playerId}`);
      break;
    }
    case "kang:kang-tough":
      if (s.kang && !kangVillainAbsent(s)) ports.giveTough(s, s.villain);
      break;
    case "kang:villain-attack":
      if (
        alive(s, e.playerId) &&
        s.kang &&
        !kangVillainAbsent(s) &&
        titledKang(s.villain)
      )
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind: "attack",
          modifier: 0,
        });
      break;
    case "kang:energy-blast":
    case "kang:discard-ally-support": {
      if (!alive(s, e.playerId)) break;
      const options = seatView(s, e.playerId).player.inPlay.filter(
        (p) =>
          ["ally", "support"].includes(typeOf(p) || "") &&
          ports.canDiscard(s, p),
      );
      if (!options.length) {
        if (e.type === "kang:energy-blast")
          ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
        break;
      }
      if (options.length === 1) {
        ports.discardPiece(s, options[0].id);
        break;
      }
      ports.choose(
        s,
        "Discard",
        `${ports.heroName(s, e.playerId)}: discard an ally or support you control.`,
        options.map((p) => ({
          id: p.id,
          label: name(p),
          image: p.code,
          effects: [{ type: "discardPiece", id: p.id }],
        })),
      );
      break;
    }
    case "kang:manipulated": {
      if (!alive(s, e.playerId)) break;
      const events = seatView(s, e.playerId).player.hand.filter(
        (p) => typeOf(p) === "event",
      );
      for (const p of events) ports.discardHandCard(s, e.playerId, p.id);
      if (events.length)
        ports.log(
          s,
          `Manipulated Timestream discards ${events.length} event${events.length === 1 ? "" : "s"}.`,
          "bad",
        );
      else ports.queue(s, { type: "surge", sourceCode: e.sourceCode });
      break;
    }
    case "kang:random-discard":
      if (alive(s, e.playerId)) ports.randomDiscard(s, e.playerId);
      break;
    case "kang:stolen": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      const p = view.inPlay.find((q) => q.id === e.id);
      if (!p) break;
      const taken = view.deck.splice(0, 8);
      if (taken.length) ports.revealHidden(s);
      (p.storedCards ||= []).push(...taken);
      ports.log(
        s,
        `Stolen Memories takes ${taken.length} card${taken.length === 1 ? "" : "s"} facedown from the top of the deck.`,
        "bad",
      );
      break;
    }
    case "kang:hijinks": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      if (!view.inPlay.some((q) => q.id === e.id)) break;
      const candidates = view.inPlay.filter(
        (q) =>
          q.id !== e.id &&
          typeOf(q) !== "obligation" &&
          def(q)?.faction_code !== "encounter" &&
          ports.canDiscard(s, q),
      );
      if (!candidates.length) break;
      const top = Math.max(...candidates.map((q) => ports.cost(q)));
      const tied = candidates.filter((q) => ports.cost(q) === top);
      const pick = (q: Piece) => [
        K("hijinks-store", { id: e.id, target: q.id, playerId: e.playerId }),
      ];
      if (tied.length === 1) ports.queue(s, ...pick(tied[0]));
      else
        ports.choose(
          s,
          name(HIJINKS),
          "Choose the highest-cost card you control to discard.",
          tied.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: pick(q),
          })),
        );
      break;
    }
    case "kang:hijinks-store": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      if (!view.inPlay.some((q) => q.id === e.target)) break;
      ports.discardPiece(s, e.target);
      const holder = view.inPlay.find((q) => q.id === e.id);
      for (const seat of s.players) {
        const discard = seatView(s, seat).player.discard;
        const i = discard.findIndex((q) => q.id === e.target);
        if (i < 0) continue;
        const [taken] = discard.splice(i, 1);
        if (holder) (holder.storedCards ||= []).push(taken);
        else discard.splice(i, 0, taken);
        ports.log(
          s,
          `Time-Travel Hijinks places ${name(taken)} facedown under itself.`,
          "bad",
        );
        break;
      }
      break;
    }
    case "kang:obligation-pay": {
      const p = s.player.inPlay.find((q) => q.id === e.id);
      if (!p) throw Error("This obligation is no longer in play.");
      const fits = s.player.hand.filter(OBLIGATION_COSTS[p.code]);
      if (!fits.length) throw Error("No card in your hand pays this cost.");
      ports.choose(
        s,
        name(p),
        "Choose the card to discard from your hand.",
        fits.map((c) => ({
          id: c.id,
          label: name(c),
          image: c.code,
          effects: [K("obligation-discard", { id: p.id, card: c.id })],
        })),
      );
      break;
    }
    case "kang:obligation-discard": {
      const p = s.player.inPlay.find((q) => q.id === e.id);
      if (!p || !s.player.hand.some((c) => c.id === e.card)) break;
      ports.discardHandCard(s, s.activePlayerId, e.card);
      ports.discardPiece(s, p.id);
      ports.log(s, `${name(p)} is discarded.`, "good");
      break;
    }
    case "kang:fear-pay": {
      const p = s.player.inPlay.find((q) => q.id === e.id);
      if (!p) throw Error("Fear of Kang is no longer in play.");
      const card = ports.randomDiscard(s, s.activePlayerId);
      if (!card) throw Error("There is no card in your hand to discard.");
      ports.discardPiece(s, p.id);
      ports.log(s, `${name(p)} is discarded.`, "good");
      break;
    }
    case "kang:corrupted": {
      const [playerId, ...rest] = (e.remaining as string[]) || [];
      if (!playerId || over(s)) break;
      if (rest.length) ports.queue(s, { ...e, remaining: rest });
      if (!alive(s, playerId)) break;
      const scheme = s.sideSchemes.find((p) => p.id === e.id);
      const options: Option[] = [];
      if (seatView(s, playerId).player.hand.length)
        options.push({
          id: "discard",
          label: "Discard 1 random card from your hand",
          effects: [K("random-discard", { playerId, actorId: playerId })],
        });
      if (scheme)
        options.push({
          id: "threat",
          label: `Place 2 threat on ${name(scheme)}`,
          image: scheme.code,
          effects: [
            { type: "threat", target: scheme.id, amount: 2, actorId: playerId },
          ],
        });
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else if (options.length)
        ports.choose(
          s,
          name(CORRUPTED),
          `${ports.heroName(s, playerId)}: discard a random card from your hand, or place 2 threat here.`,
          options,
        );
      break;
    }
    case "kang:pinned": {
      const scheme = s.sideSchemes.find((p) => p.id === e.id);
      if (!scheme) break;
      const count = kangAreaPlayers(s, e.playerId).reduce(
        (n, id) => n + kangObligations(s, id),
        0,
      );
      if (count)
        ports.queue(s, {
          type: "threat",
          target: scheme.id,
          amount: 2 * count,
        });
      break;
    }
    case "kang:tactics": {
      const source = { id: e.id, code: TACTICS } as Piece;
      for (const playerId of (e.remaining as string[]) || []) {
        const n = kangObligations(s, playerId);
        if (n && alive(s, playerId)) ports.indirect(s, playerId, n, source);
      }
      break;
    }
    case "kang:tactics-boost": {
      const a = s.attack || s.scheming;
      const n = kangObligations(s, e.playerId);
      if (!a || !n) break;
      a.extraBoostIcons = (Number(a.extraBoostIcons) || 0) + n;
      ports.log(
        s,
        `Time-Travel Tactics gains ${n} boost icon${n === 1 ? "" : "s"}.`,
        "bad",
      );
      break;
    }
    case "kang:machinations": {
      // Each player in turn searches for a different obligation and reveals
      // it; then the encounter deck is shuffled.
      const remaining = ((e.remaining as string[]) || []).filter((id) =>
        alive(s, id),
      );
      const used = (e.used as string[]) || [];
      const [playerId, ...rest] = remaining;
      if (!playerId) {
        ports.shuffleEncounter(s);
        break;
      }
      const titles = [
        ...new Set(
          [...s.encounter.deck, ...s.encounter.discard]
            .filter(
              (p) => typeOf(p) === "obligation" && !used.includes(name(p)),
            )
            .map((p) => name(p)),
        ),
      ];
      const next = K("machinations", { remaining: rest, used });
      if (!titles.length) {
        ports.queue(s, next);
        break;
      }
      const pick = (title: string) => [
        K("machinations-pick", {
          playerId,
          title,
          remaining: rest,
          used: [...used, title],
        }),
      ];
      if (titles.length === 1) ports.queue(s, ...pick(titles[0]));
      else
        ports.choose(
          s,
          name(MACHINATIONS),
          `${ports.heroName(s, playerId)}: search for an obligation and reveal it.`,
          titles.map((title) => {
            const sample = [...s.encounter.deck, ...s.encounter.discard].find(
              (p) => name(p) === title,
            )!;
            return {
              id: sample.code,
              label: title,
              image: sample.code,
              effects: pick(title),
            };
          }),
        );
      break;
    }
    case "kang:machinations-pick": {
      const next = K("machinations", {
        remaining: e.remaining,
        used: e.used,
      });
      let piece: Piece | undefined;
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const i = zone.findIndex(
          (p) => typeOf(p) === "obligation" && name(p) === e.title,
        );
        if (i < 0) continue;
        piece = zone[i];
        break;
      }
      ports.queue(s, next);
      if (piece && alive(s, e.playerId)) {
        ports.revealHidden(s);
        ports.reveal(s, piece, e.playerId);
      }
      break;
    }
    case "kang:chosen":
    case "kang:dig-minion": {
      if (!alive(s, e.playerId)) break;
      // Stop when the deck runs out, like other native searches.
      for (let guard = 0; guard < 200; guard++) {
        const last = s.encounter.deck.length <= 1;
        const { piece, emptied } = ports.discardTop(s);
        if (!piece) break;
        const found =
          typeOf(piece) === "minion" &&
          (e.type === "kang:dig-minion" || hasTrait(piece, "Temporal"));
        if (found) {
          if (e.type === "kang:chosen") ports.reveal(s, piece, e.playerId);
          else ports.putMinion(s, piece, e.playerId);
          break;
        }
        if (emptied || last) break;
      }
      break;
    }
    case "kang:anachronauts": {
      const temporal = s.encounter.discard.filter((p) =>
        hasTrait(p, "Temporal"),
      );
      if (!temporal.length) break;
      for (const p of temporal) ports.shuffleIntoEncounter(s, p);
      ports.log(
        s,
        `The Anachronauts shuffle ${temporal.length} Temporal card${temporal.length === 1 ? "" : "s"} into the encounter deck.`,
        "bad",
      );
      break;
    }
    case "kang:grudge": {
      if (!alive(s, e.playerId)) break;
      const master = s.minions.find((m) => m.code === MASTER_OF_TIME);
      if (master) {
        ports.activate(s, {
          enemyId: master.id,
          playerId: e.playerId,
          kind:
            seatView(s, e.playerId).player.form === "hero"
              ? "attack"
              : "scheme",
          modifier: 0,
        });
        break;
      }
      const found = [...s.encounter.deck, ...s.encounter.discard].find(
        (p) => p.code === MASTER_OF_TIME,
      );
      if (found) {
        ports.revealHidden(s);
        ports.putMinion(s, found, e.playerId);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "kang:more-boosts":
      for (let i = 0; i < (Number(e.amount) || 0); i++)
        if (
          s.attack?.attacker === e.enemyId ||
          s.scheming?.attacker === e.enemyId
        )
          ports.giveBoost(s, e.enemyId, "current");
      break;
    case "kang:exhaust-character": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId);
      const allies = ports.allies(s, e.playerId).filter((a) => !a.exhausted);
      const ready = [
        ...(!view.player.exhausted ? ["hero"] : []),
        ...allies.map((a) => a.id),
      ];
      if (!ready.length) break;
      if (ready.length === 1) {
        ports.queue(s, { type: "exhaust", id: ready[0], actorId: e.playerId });
        break;
      }
      ports.choose(
        s,
        name(APOCRYPHUS),
        `${ports.heroName(s, e.playerId)}: exhaust a character you control.`,
        ready.map((id) => ({
          id,
          label:
            id === "hero"
              ? ports.heroName(s, e.playerId)
              : name(allies.find((a) => a.id === id)!),
          effects: [{ type: "exhaust", id, actorId: e.playerId }],
        })),
      );
      break;
    }
    default:
      return false;
  }
  return true;
}

/** Stage 2A: an acceleration token for each side scheme in play, which are
 * discarded; each player reveals a random stage 3A in player order and
 * creates a game area with its Kang (II); then stage 2B. */
function stageTwo(s: GameState, ports: KangPorts) {
  const k = s.kang;
  if (!k?.advancing || over(s)) return;
  delete k.advancing;
  const sides = s.sideSchemes.filter((p) => !p.playerSideSchemeController);
  s.encounter.acceleration += sides.length;
  ports.log(
    s,
    `The Master of Time: ${sides.length} acceleration token${sides.length === 1 ? "" : "s"} for the side schemes in play, which are discarded.`,
    "bad",
  );
  for (const p of sides)
    if (ports.canDiscard(s, p)) ports.discardPiece(s, p.id);
  // Player side schemes and permanent side schemes stay in play.
  const remaining = s.sideSchemes.splice(0);
  // Kang (I) and Kang's Arrival leave play.
  ports.mainChanged(s);
  s.removed.push(ports.resetPiece(s.villain), ports.resetPiece(k.currentMain));
  k.currentMain = k.mainDeck.shift()!;
  k.currentMain.code = MASTER_OF_TIME_STAGE;
  const minions = s.minions.splice(0);
  const areas: KangArea[] = [];
  for (const seat of playerOrder(s)) {
    const [stage] = ports.shuffle(s, [...k.stageThree]);
    if (!stage) break;
    k.stageThree = k.stageThree.filter((p) => p.id !== stage.id);
    const link = KANG_STAGE_THREE.find(
      (x) => x.scheme === stage.code.replace(/a$/, "b"),
    )!;
    stage.code = link.scheme;
    const code = link.villain[version(s)];
    const i = k.setAside.findIndex((p) => p.code === code);
    const health = def(code)!.health!;
    const villain = Object.assign(k.setAside.splice(i, 1)[0], {
      hp: health,
      maxHp: health,
      stage: 2,
      damage: 0,
    }) as Villain;
    areas.push({
      id: seat.id,
      players: [seat.id],
      villain,
      scheme: {
        code: link.scheme,
        threat: def(link.scheme)!.base_threat || 0,
        index: 2,
      },
      sideSchemes: [],
      minions: minions.filter((m) => m.engagedWith === seat.id),
      stage,
    });
    ports.log(
      s,
      `${ports.heroName(s, seat.id)} reveals ${name(link.scheme)} and faces ${name(code)} in their own game area.`,
      "bad",
    );
  }
  const stranded = minions.filter(
    (m) => !areas.some((a) => a.minions!.includes(m)),
  );
  if (stranded.length && areas.length) areas[0].minions!.push(...stranded);
  for (const p of remaining)
    (
      areas.find((a) => a.id === p.playerSideSchemeController) || areas[0]
    )?.sideSchemes!.push(p);
  // Unused stage 3 schemes are removed from the game.
  s.removed.push(...k.stageThree.splice(0).map((p) => ports.resetPiece(p)));
  k.stage = 3;
  k.areas = areas;
  delete k.focus;
  const first = areas.find((a) => a.id === s.activePlayerId) || areas[0];
  if (first) {
    loadFocus(s, first);
    k.focus = first.id;
  }
  for (const area of [...areas].reverse())
    ports.queue(s, K("deal", { playerId: area.id, actorId: area.id }));
}

/** At the end of the phase each leaving area joins another game area. When
 * no other area remains, every player is in stage 2B's area and the main
 * scheme advances to stage 4A. */
function areasLeave(
  s: GameState,
  ports: KangPorts,
  choice?: string,
  leavingId?: string,
) {
  const k = s.kang;
  if (!k?.areas || over(s)) return;
  const leaving = leavingId
    ? k.areas.find((a) => a.id === leavingId && a.leaving)
    : k.areas.find((a) => a.leaving);
  if (!leaving) return;
  const staying = k.areas.filter((a) => !a.leaving);
  if (!staying.length) {
    stageFour(s, ports);
    return;
  }
  const target =
    staying.find((a) => a.id === choice) ||
    (staying.length === 1 ? staying[0] : undefined);
  if (!target) {
    const chooser =
      leaving.players.find((id) => alive(s, id)) || s.firstPlayerId;
    ports.choose(
      s,
      "Join another game area",
      `${leaving.players.map((id) => ports.heroName(s, id)).join(" and ")}: choose the game area to join.`,
      staying.map((a) => ({
        id: a.id,
        label: `${a.players.map((id) => ports.heroName(s, id)).join(" and ")} · ${name(kangAreaView(s, a).villain)}`,
        image: kangAreaView(s, a).villain.code,
        effects: [
          K("areas-leave", {
            choice: a.id,
            leaving: leaving.id,
            actorId: chooser,
          }),
        ],
      })),
    );
    return;
  }
  // Move the cards with every area out of focus, then refocus.
  storeFocus(s);
  const focus = k.focus;
  const leavingVillain = leaving.villain!;
  if (!leaving.villainGone) ports.villainLeft(s, leavingVillain.id);
  s.removed.push(
    ports.resetPiece(leavingVillain),
    ports.resetPiece(leaving.stage),
  );
  const heir =
    playerOrder(s).find((seat) => target.players.includes(seat.id))?.id ||
    target.players[0];
  for (const m of leaving.minions || [])
    if (!m.engagedWith || !alive(s, m.engagedWith)) m.engagedWith = heir;
  target.players.push(...leaving.players);
  (target.sideSchemes ||= []).push(...(leaving.sideSchemes || []));
  (target.minions ||= []).push(...(leaving.minions || []));
  delete leaving.villain;
  delete leaving.scheme;
  delete leaving.sideSchemes;
  delete leaving.minions;
  k.areas = k.areas.filter((a) => a.id !== leaving.id);
  // Reload the native area: the active player's, now possibly the target.
  delete k.focus;
  const native =
    k.areas.find((a) => a.id === focus) ||
    kangAreaOf(s, s.activePlayerId) ||
    k.areas[0];
  loadFocus(s, native);
  k.focus = native.id;
  kangFocusSeat(s);
  ports.log(
    s,
    `${leaving.players.map((id) => ports.heroName(s, id)).join(" and ")} join${leaving.players.length === 1 ? "s" : ""} ${target.players
      .filter((id) => !leaving.players.includes(id))
      .map((id) => ports.heroName(s, id))
      .join(" and ")}'s game area.`,
  );
  ports.combineUniques(s, target.players);
  if (k.areas.some((a) => a.leaving))
    ports.queue(
      s,
      K("areas-leave", { mandatory: true, actorId: s.firstPlayerId }),
    );
}

/** Stage 4A: Kang (III) enters, each facedown Kang's Dominion under this
 * stage is revealed; 4B: each player's nemesis minion enters engaged. */
function stageFour(s: GameState, ports: KangPorts) {
  const k = s.kang!;
  storeFocus(s);
  const sideSchemes: Piece[] = [];
  const minions: Piece[] = [];
  const order = playerOrder(s).map((seat) => seat.id);
  for (const area of k.areas || []) {
    const villain = area.villain!;
    if (!area.villainGone) ports.villainLeft(s, villain.id);
    s.removed.push(ports.resetPiece(villain), ports.resetPiece(area.stage));
    sideSchemes.push(...(area.sideSchemes || []));
    const heir = order.find((id) => area.players.includes(id)) || order[0];
    for (const m of area.minions || []) {
      if (!m.engagedWith || !alive(s, m.engagedWith)) m.engagedWith = heir;
      minions.push(m);
    }
  }
  delete k.areas;
  delete k.focus;
  k.stage = 4;
  // The Master of Time leaves; its acceleration tokens stay in play.
  s.removed.push(ports.resetPiece(k.currentMain));
  k.currentMain = k.mainDeck.shift()!;
  k.currentMain.code = KANGS_WRATH;
  const code = KANG_III[version(s)];
  const i = k.setAside.findIndex((p) => p.code === code);
  const hp = def(code)!.health! * s.playerCount;
  s.villain = Object.assign(k.setAside.splice(i, 1)[0], {
    hp,
    maxHp: hp,
    stage: 3,
    damage: 0,
  }) as Villain;
  s.scheme = {
    code: KANGS_WRATH,
    threat: def(KANGS_WRATH)?.base_threat || 0,
    index: 3,
  };
  s.sideSchemes = sideSchemes;
  s.minions = minions;
  ports.log(
    s,
    "Every hero has returned to the present: Kang the Conqueror enters play. Kang's Wrath.",
    "bad",
  );
  const dominions = k.underWrath.splice(0);
  for (const p of dominions) ports.putSideScheme(s, p);
  if (dominions.length)
    ports.log(
      s,
      `${dominions.length} Kang's Dominion${dominions.length === 1 ? " is" : "s are"} revealed: Kang cannot take damage while one is in play.`,
      "bad",
    );
  for (const playerId of order)
    if (alive(s, playerId) && ports.nemesisMinion(s, playerId))
      (k.nemesisOut ||= []).push(playerId);
  ports.shuffleEncounter(s);
}
