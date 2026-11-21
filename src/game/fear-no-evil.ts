import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { printedKeyword } from "./keywords.js";
import type {
  MutagenEnginePorts,
  MutagenForcedResponse,
} from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

/** Fear No Evil, part one. A mission main scheme replaces the villain's own
 * scenario: The Getaway or Art Museum Heist, played against a chosen
 * Underling villain (Bullseye, Electro or Hammerhead). The Cops, Drive and
 * The Owl modular sets can join any scenario. */

// ------------------------------------------------------------------ codes

export const GETAWAY_ID = "fne_the_getaway";
export const HEIST_ID = "fne_art_museum_heist";
/** The mission scenarios, each played against a chosen Underling. */
export const FNE_MISSION_IDS = [GETAWAY_ID, HEIST_ID];

export const UNDERLINGS = {
  bullseye: {
    name: "Bullseye",
    set: "fne_bullseye",
    codes: ["60065", "60066", "60067"],
  },
  electro: {
    name: "Electro",
    set: "fne_electro",
    codes: ["60076", "60077", "60078"],
  },
  hammerhead: {
    name: "Hammerhead",
    set: "fne_hammerhead",
    codes: ["60086", "60087", "60088"],
  },
} as const;
export type Underling = keyof typeof UNDERLINGS;
export const UNDERLING_IDS = Object.keys(UNDERLINGS) as Underling[];

// The Getaway
export const GETAWAY = "60128b";
export const OUT_FRONT = "60129a";
export const ALONGSIDE = "60129b";
const ESCORT = "60130";
const TANKER = "60131";
const BURNING = "60132";
const PEDESTRIANS = "60133";
// Art Museum Heist
export const HEIST = "60121b";
const IMPOSSIBLE = "60122";
const POTTERY = "60123";
const REPLICA = "60124";
const LANDSCAPE = "60125";
export const ARTS = [IMPOSSIBLE, POTTERY, REPLICA, LANDSCAPE];
const ART_THIEF = "60126";
const TUG = "60127";
// Bullseye
export const SPINE = "60068a";
export const DAMAGED_SPINE = "60068b";
const STAKES = "60069";
const SAI = "60070";
const PURSUIT = "60071";
const LADY = "60072";
const BLOODLUST = "60073";
const WEAPON = "60074";
const DESIRE = "60075";
// Electro
export const CHARGE = "60079";
const DRAINED = "60080";
const WHIPLASH = "60081";
const CHARGING = "60082";
const CHAIN = "60083";
const OVERLOAD = "60084";
const SHOCKING = "60085";
// Hammerhead
const GATLING = "60089";
const HARDHEADED = "60090";
const CHAMELEON = "60091";
const ENFORCERS = "60092";
const UNDERBOSS = "60093";
const CONSOLIDATE = "60094";
const STRUGGLE = "60095";
const HEAD_FIRST = "60096";
// Cops
const COP = "60182";
const CROOKED = "60183";
export const WANTED = "60184";
const CORDON = "60185";
// Drive
const SPORTS_CAR = "60186";
const MOTORCYCLE = "60187";
const VAN = "60188";
const TRAFFIC = "60189";
const CARJACKING = "60190";
// The Owl
const SERUM = "60191";
const FISH = "60192";
const OWL = "60193";
const SWOOP = "60194";

/** Every face registered by this import. */
export const FEAR_NO_EVIL_CODES = [
  "60065",
  "60066",
  "60067",
  SPINE,
  DAMAGED_SPINE,
  STAKES,
  SAI,
  PURSUIT,
  LADY,
  BLOODLUST,
  WEAPON,
  DESIRE,
  "60076",
  "60077",
  "60078",
  CHARGE,
  DRAINED,
  WHIPLASH,
  CHARGING,
  CHAIN,
  OVERLOAD,
  SHOCKING,
  "60086",
  "60087",
  "60088",
  GATLING,
  HARDHEADED,
  CHAMELEON,
  ENFORCERS,
  UNDERBOSS,
  CONSOLIDATE,
  STRUGGLE,
  HEAD_FIRST,
  "60121a",
  HEIST,
  IMPOSSIBLE,
  POTTERY,
  REPLICA,
  LANDSCAPE,
  ART_THIEF,
  TUG,
  "60128a",
  GETAWAY,
  OUT_FRONT,
  ALONGSIDE,
  ESCORT,
  TANKER,
  BURNING,
  PEDESTRIANS,
  COP,
  CROOKED,
  WANTED,
  CORDON,
  SPORTS_CAR,
  MOTORCYCLE,
  VAN,
  TRAFFIC,
  CARJACKING,
  SERUM,
  FISH,
  OWL,
  SWOOP,
] as const;

/** The encounter cards scripted here: everything that can be revealed. */
export const FNE_SCRIPT_CODES: readonly string[] = [
  SPINE,
  STAKES,
  SAI,
  PURSUIT,
  LADY,
  BLOODLUST,
  WEAPON,
  DESIRE,
  CHARGE,
  DRAINED,
  WHIPLASH,
  CHARGING,
  CHAIN,
  OVERLOAD,
  SHOCKING,
  GATLING,
  HARDHEADED,
  CHAMELEON,
  ENFORCERS,
  UNDERBOSS,
  CONSOLIDATE,
  STRUGGLE,
  HEAD_FIRST,
  ...ARTS,
  ART_THIEF,
  TUG,
  ESCORT,
  TANKER,
  BURNING,
  PEDESTRIANS,
  COP,
  CROOKED,
  WANTED,
  CORDON,
  SPORTS_CAR,
  MOTORCYCLE,
  VAN,
  TRAFFIC,
  CARJACKING,
  SERUM,
  FISH,
  OWL,
  SWOOP,
];
/** The attachments among them, which enter play through their own entry. */
export const FNE_ATTACHMENT_CODES: readonly string[] = [
  SPINE,
  STAKES,
  SAI,
  PURSUIT,
  CHARGE,
  DRAINED,
  GATLING,
  HARDHEADED,
  ...ARTS,
  SPORTS_CAR,
  MOTORCYCLE,
  VAN,
  SERUM,
];
/** The attachments with a Hero Action, offered on the card. */
export const FNE_ACTION_CODES: readonly string[] = [
  "60122",
  "60123",
  "60124",
  "60125",
  "60079",
  "60090",
  "60191",
];
/** The modular sets, usable in any scenario. */
export const FNE_MODULAR_SETS = [
  "fne_cops",
  "fne_drive",
  "fne_the_owl",
] as const;
/** Wanted stays in its player's play area. */
export const FNE_IN_PLAY_OBLIGATIONS = [WANTED] as const;
const VEHICLES = [SPORTS_CAR, MOTORCYCLE, VAN];
const VEHICLE_LIMIT: Record<string, number> = {
  [SPORTS_CAR]: 4,
  [MOTORCYCLE]: 3,
  [VAN]: 6,
};
/** The Art attachments' Forced Response after attaching to a character. */
const ART_STATUS: Record<string, "confused" | "tough" | "stunned"> = {
  [IMPOSSIBLE]: "confused",
  [REPLICA]: "tough",
  [LANDSCAPE]: "stunned",
};
/** The resource each Art's Hero Action spends. */
const ART_RESOURCE: Record<string, Resource> = {
  [IMPOSSIBLE]: "mental",
  [POTTERY]: "wild",
  [REPLICA]: "physical",
  [LANDSCAPE]: "energy",
};

export interface FearNoEvilState {
  /** The mission scenario: The Getaway or Art Museum Heist. */
  mission: string;
  /** The chosen Underling villain and its three stages. */
  underling: Underling;
  codes: string[];
  /** Speed counters on The Getaway. */
  speed: number;
  /** Adamantium-Laced Spine, set aside by Bullseye (I). */
  setAside: Piece[];
  /** Deranged Bloodlust's boost: reveal it after this activation. */
  bloodlust?: string;
  /** "Head First!": the attack it starts gains overkill. */
  headFirst?: boolean;
}

export interface FearNoEvilPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  reveal(s: GameState, p: Piece, playerId: string): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  /** Discard the top cards of a player's deck; returns them. */
  mill(s: GameState, playerId: string, n: number): Piece[];
  shuffle<T>(s: GameState, items: T[]): T[];
  makePiece(s: GameState, code: string): Piece;
  heroName(s: GameState, playerId: string): string;
  canAddStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  /** Remove a card in play from the game. */
  removeFromGame(s: GameState, id: string): void;
  /** Discard a card from a player's hand. */
  discardHandCard(s: GameState, playerId: string, id: string): void;
  /** Defeat a minion in play. */
  defeatMinion(s: GameState, id: string): void;
  /** An enemy's current ATK or SCH, and its remaining hit points. */
  enemyStat(s: GameState, id: string, stat: "attack" | "scheme"): number;
  remainingHealth(s: GameState, id: string): number;
  /** An identity's remaining hit points. */
  identityHealth(s: GameState, playerId: string): number;
  /** An enemy attacks a character directly (the identity or an ally). */
  attackCharacter(
    s: GameState,
    enemyId: string,
    playerId: string,
    targetId: string,
  ): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const F = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `fne:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece | { id: string; code: string }) =>
  !isTextBlank(s, p as Piece);
const over = (s: GameState) => ["won", "lost"].includes(s.phase);
const expert = (s: GameState) => s.difficulty === "expert";
const activation = (s: GameState) => s.scheming || s.attack;
const boostPlayer = (s: GameState) =>
  s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const identityOf = (playerId: string) => `hero:${playerId}`;
const typeOf = (p: Piece | string) => def(p)?.type_code;
const printedTraits = (p: Piece | string) =>
  (def(p)?.traits || "")
    .split(".")
    .map((t) => t.trim())
    .filter(Boolean);
const RESOURCE_TYPES: Resource[] = ["energy", "mental", "physical"];
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, ...(image ? { image } : {}) });

export const fearNoEvil = (s: GameState) => !!s.fearNoEvil;
export const fneMission = (villainId: string) =>
  FNE_MISSION_IDS.includes(villainId);
/** The Underling in play is this one, with its text active. */
const underlingIs = (s: GameState, u: Underling) =>
  s.fearNoEvil?.underling === u &&
  !!s.villain &&
  (UNDERLINGS[u].codes as readonly string[]).includes(s.villain.code) &&
  active(s, s.villain);
const villainAttachment = (s: GameState, code: string) =>
  s.villain
    ? s.attachments.find(
        (a) => a.code === code && a.attachedTo === s.villain.id,
      )
    : undefined;
const attached = (s: GameState, target: string, codes: readonly string[]) =>
  s.attachments.filter(
    (a) => codes.includes(a.code) && a.attachedTo === target && active(s, a),
  );
/** Electric Charge on Electro. */
const chargeCard = (s: GameState) =>
  s.attachments.find((a) => a.code === CHARGE);
const allies = (s: GameState, playerId: string) =>
  alive(s, playerId)
    ? seatView(s, playerId).player.inPlay.filter((q) => typeOf(q) === "ally")
    : [];
const allAllies = (s: GameState) =>
  playerOrder(s).flatMap((seat) =>
    allies(s, seat.id).map((p) => ({ p, playerId: seat.id })),
  );
/** The identity and allies a player controls, as damage/status targets. */
const characters = (s: GameState, playerId: string) => [
  identityOf(playerId),
  ...allies(s, playerId).map((p) => p.id),
];
const characterName = (s: GameState, target: string, ports: FearNoEvilPorts) =>
  target.startsWith("hero:")
    ? ports.heroName(s, target.slice(5))
    : name(findCharacter(s, target) || target);
const findCharacter = (s: GameState, id: string) => {
  for (const seat of playerOrder(s)) {
    const p = seatView(s, seat.id).player.inPlay.find((q) => q.id === id);
    if (p) return p;
  }
  return undefined;
};
const allyOwner = (s: GameState, id: string) =>
  playerOrder(s).find((seat) =>
    seatView(s, seat.id).player.inPlay.some((q) => q.id === id),
  )?.id;
const speed = (s: GameState) => s.fearNoEvil?.speed || 0;
const enemyIds = (s: GameState) => [
  ...(s.villain ? [s.villain.id] : []),
  ...s.minions.map((m) => m.id),
];
const enemyName = (s: GameState, id: string) =>
  id === s.villain?.id
    ? name(s.villain.code)
    : name(s.minions.find((m) => m.id === id) || id);
const artOn = (s: GameState, target: string) =>
  s.attachments.filter((a) => ARTS.includes(a.code) && a.attachedTo === target);
const identitiesWithArt = (s: GameState) =>
  playerOrder(s)
    .map((seat) => seat.id)
    .filter((id) => alive(s, id) && artOn(s, identityOf(id)).length > 0);
const energyCards = (s: GameState, playerId: string) =>
  alive(s, playerId)
    ? seatView(s, playerId).player.hand.filter(
        (q) => (def(q)?.resource_energy || 0) > 0,
      )
    : [];
const hasVehicle = (s: GameState, target: string) =>
  attached(s, target, VEHICLES).length > 0;
const isHero = (s: GameState, playerId: string) =>
  alive(s, playerId) && seatView(s, playerId).player.form === "hero";

// ------------------------------------------------------------------ setup

/** The Underling a mission is played against: the chosen one, otherwise
 * one picked from the game's seed. */
export function fneUnderlingFor(
  villainId: string,
  chosen: string | undefined,
  seed: number,
): Underling | undefined {
  if (!fneMission(villainId)) return undefined;
  if (chosen && (UNDERLING_IDS as string[]).includes(chosen))
    return chosen as Underling;
  return UNDERLING_IDS[(seed >>> 0) % UNDERLING_IDS.length];
}
/** Cards kept out of the encounter deck: the flip sides and Out Front,
 * which attaches at setup. */
export function fneSetupCard(code: string) {
  return [DAMAGED_SPINE, OUT_FRONT, ALONGSIDE].includes(code);
}
/** Put the chosen Underling in play as the villain: (I) in Standard, (II)
 * in Expert. */
export function fneInitVillain(s: GameState, underling: Underling) {
  const codes = [...UNDERLINGS[underling].codes];
  const code = codes[s.villain.stage - 1];
  s.fearNoEvil = {
    mission: s.villainId,
    underling,
    codes,
    speed: 0,
    setAside: [],
  };
  s.villain.code = code;
  s.villain.maxHp = (def(code)?.health || 14) * s.playerCount;
  s.villain.hp = s.villain.maxHp;
  s.villain.tough = printedKeyword(def(code)!, "Toughness") > 0;
}
/** The Underling's stage cards, in place of the scenario's. */
export function fneVillainCodes(s: GameState, fallback: readonly string[]) {
  return s.fearNoEvil?.codes || fallback;
}
/** The mission's Setup: The Getaway's speed counters and Out Front; Art
 * Museum Heist's random Art on the villain. */
export function fearNoEvilSetup(s: GameState, ports: FearNoEvilPorts) {
  const st = s.fearNoEvil;
  if (!st) return;
  // The mission's stage 1B starts with its printed threat per player.
  const main = def(s.scheme.code);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
  if (st.mission === GETAWAY_ID) {
    st.speed = expert(s) ? 2 : 1;
    const out = ports.makePiece(s, OUT_FRONT);
    out.attachedTo = s.villain.id;
    s.attachments.push(out);
    ports.log(
      s,
      `The Getaway: ${plural(st.speed, "speed counter")}. Out Front attaches to ${name(s.villain.code)}.`,
    );
  } else if (st.mission === HEIST_ID) {
    const arts = s.encounter.deck.filter((p) => ARTS.includes(p.code));
    const pick = ports.shuffle(s, arts)[0];
    if (pick) attachArt(s, pick, s.villain.id, ports);
  }
}

// ------------------------------------------------------------- villain

/** The Underling stages' When Revealed abilities. */
export function fneVillainRevealed(s: GameState): Effect[] {
  if (!s.fearNoEvil || !s.villain || isTextBlank(s, s.villain)) return [];
  switch (s.villain.code) {
    case "60065":
      return [F("spine-aside")];
    case "60066":
      return [F("spine-attach")];
    case "60067":
      return [F("find-reveal", { code: BLOODLUST })];
    case "60076":
    case "60077":
      return [F("charge-find", { n: 2 * s.playerCount })];
    case "60078":
      return [F("charge", { n: 3 * s.playerCount })];
    default:
      return [];
  }
}

// ------------------------------------------------------------ interface

export function fneUnderlingName(s: GameState) {
  return s.fearNoEvil ? UNDERLINGS[s.fearNoEvil.underling].name : "";
}
/** The objective: the Underling's stage and the mission's counters. */
export function fneObjective(s: GameState) {
  const st = s.fearNoEvil;
  if (!st) return "";
  const last = expert(s) ? 3 : 2;
  const parts = [
    `Defeat ${UNDERLINGS[st.underling].name} · stage ${s.villain.stage} of ${last}`,
  ];
  if (st.mission === GETAWAY_ID) parts.push(plural(st.speed, "speed counter"));
  if (st.mission === HEIST_ID)
    parts.push(
      `${plural(artOn(s, s.villain.id).length, "Art")} on the villain`,
    );
  return parts.join(" · ");
}
/** The main scheme's note. */
export function fneMainNote(s: GameState) {
  const st = s.fearNoEvil;
  if (!st) return "";
  if (s.scheme.code === GETAWAY)
    return `${plural(st.speed, "speed counter")} · round end: +1, Alongside flips back`;
  if (s.scheme.code === HEIST)
    return `Acceleration X = 1 + ${artOn(s, s.villain.id).length} Art on the villain`;
  return "";
}
/** A caption for the counters and damage on this import's attachments. */
export function fneAttachmentCaption(s: GameState, p: Piece) {
  if (p.code === SPINE || p.code === DAMAGED_SPINE)
    return `${p.damage || 0} damage${p.code === SPINE ? " · flips at 6" : ""}`;
  if (p.code === CHARGE) return plural(p.counters || 0, "charge counter");
  if (p.code === DRAINED) return plural(p.counters || 0, "drain counter");
  if (VEHICLES.includes(p.code))
    return `${p.damage || 0} of ${VEHICLE_LIMIT[p.code]} damage`;
  if (p.code === OUT_FRONT) return "Damage removes main scheme threat";
  return "";
}

// ---------------------------------------------------------------- rules

/** Art Museum Heist's acceleration: X is 1 more than the Art attachments on
 * the villain, per player. */
export function fneEscalation(s: GameState): number | undefined {
  if (!s.fearNoEvil || s.scheme.code !== HEIST) return undefined;
  return (1 + artOn(s, s.villain.id).length) * s.playerCount;
}
/** Granted keywords. */
export function fneKeyword(
  s: GameState,
  p: { id: string; code: string },
  keyword: string,
): number {
  const minion = s.minions.find((m) => m.id === p.id);
  if (minion) {
    // Police Cordon: each Police minion gains guard and patrol.
    if (
      (keyword === "Guard" || keyword === "Patrol") &&
      printedTraits(minion).includes("Police") &&
      s.sideSchemes.some((q) => q.code === CORDON && active(s, q))
    )
      return 1;
    if (!active(s, minion)) return stalwartFromArt(s, p.id, keyword);
    if (
      minion.code === FISH &&
      (keyword === "Piercing" || keyword === "Ranged")
    )
      return 1;
    if (minion.code === OWL && keyword === "Piercing") return 1;
    // Escort Vehicle by the speed counters on the main scheme.
    if (minion.code === ESCORT) {
      if (keyword === "Toughness" && speed(s) >= 3) return 1;
      if (keyword === "Quickstrike" && speed(s) >= 6) return 1;
    }
    return stalwartFromArt(s, p.id, keyword);
  }
  if (!s.villain || p.id !== s.villain.id) return 0;
  if (keyword === "Stalwart" && attached(s, p.id, [POTTERY, HARDHEADED]).length)
    return 1;
  if (keyword === "Ranged") {
    // Out Front: the attached villain's attacks gain ranged.
    if (attached(s, p.id, [OUT_FRONT]).length) return 1;
    // Bullseye: his attacks gain ranged.
    if (underlingIs(s, "bullseye") && s.attack?.attacker === p.id) return 1;
  }
  // Deadly Sai: Bullseye's attacks gain piercing.
  if (keyword === "Piercing" && attached(s, p.id, [SAI]).length) return 1;
  return 0;
}
const stalwartFromArt = (s: GameState, id: string, keyword: string) =>
  keyword === "Stalwart" && attached(s, id, [POTTERY]).length ? 1 : 0;
/** Deadly Sai: Bullseye's attacks lose ranged. */
export function fneLosesRanged(s: GameState, source: string) {
  return (
    !!s.villain &&
    source === s.villain.id &&
    attached(s, source, [SAI]).length > 0
  );
}
/** Inspiring Pottery on an identity: it gains stalwart. */
export function fneIdentityStalwart(s: GameState, playerId: string) {
  return attached(s, identityOf(playerId), [POTTERY]).length > 0;
}
/** Flight Serum: the attached enemy gains Aerial. */
export function fneTrait(s: GameState, target: string, trait: string) {
  return trait === "Aerial" && attached(s, target, [SERUM]).length > 0;
}
/** Chameleon's and Maggia Enforcers' SCH. */
export function fneEnemyStat(
  s: GameState,
  p: Piece | { id: string; code: string },
  kind: "attack" | "scheme",
  ports: {
    highestThwart(): number;
    hasTrait(id: string, trait: string): boolean;
  },
): number {
  if (kind !== "scheme" || !s.minions.some((m) => m.id === p.id)) return 0;
  if (!active(s, p)) return 0;
  if (p.code === CHAMELEON) return Math.max(0, ports.highestThwart());
  if (p.code === ENFORCERS)
    return enemyIds(s).filter((id) => ports.hasTrait(id, "Maggia")).length;
  return 0;
}
/** Bullseye: each of his boost cards gains a boost icon. */
export function fneBoostIcons(s: GameState, _p: Piece): number {
  const a = activation(s);
  return a &&
    s.villain &&
    a.attacker === s.villain.id &&
    underlingIs(s, "bullseye")
    ? 1
    : 0;
}
/** "Otherwise, this card gains surge" and the conditional surges. */
export function fneRevealCard(s: GameState, p: Piece, c: Card): Card {
  if (!FNE_SCRIPT_CODES.includes(p.code) || printedKeyword(c, "Surge") > 0)
    return c;
  return gainsSurge(s, p) ? { ...c, text: `Surge.\n${c.text || ""}` } : c;
}
function gainsSurge(s: GameState, p: Piece) {
  const playerId = s.activePlayerId;
  switch (p.code) {
    case ESCORT:
      return speed(s) >= 9;
    case PURSUIT:
      return !pursuitTargets(s).length;
    case SPORTS_CAR:
    case MOTORCYCLE:
    case VAN:
      return !vehicleCandidates(s).length;
    case SERUM:
      return !serumTargets(s).length;
    case OVERLOAD:
      return !energyCards(s, playerId).length;
    case HEAD_FIRST:
      return !isHero(s, playerId);
    default:
      return false;
  }
}
const pursuitTargets = (s: GameState) =>
  allAllies(s).filter(
    ({ p }) =>
      !s.attachments.some((a) => a.code === PURSUIT && a.attachedTo === p.id),
  );
const vehicleCandidates = (s: GameState) =>
  enemyIds(s).filter(
    (id) =>
      !s.attachments.some(
        (a) => VEHICLES.includes(a.code) && a.attachedTo === id,
      ),
  );
const serumTargets = (s: GameState) =>
  enemyIds(s).filter((id) => !aerialEnemy(s, id));
function aerialEnemy(s: GameState, id: string) {
  const code =
    id === s.villain?.id
      ? s.villain.code
      : s.minions.find((m) => m.id === id)?.code;
  return (
    (!!code && printedTraits(code).includes("Aerial")) ||
    attached(s, id, [SERUM]).length > 0
  );
}

// ---------------------------------------------------------------- damage

/** Jackknifed Tanker Truck: the villain cannot be dealt damage. */
export function fneDamageProhibited(
  s: GameState,
  target: string,
): string | undefined {
  if (!s.villain || target !== s.villain.id) return undefined;
  const truck = s.sideSchemes.find((q) => q.code === TANKER && active(s, q));
  return truck
    ? `${name(truck)}: ${name(s.villain.code)} cannot be dealt damage.`
    : undefined;
}
/** Out Front: damage the villain would be dealt removes that much threat
 * from the main scheme instead, ignoring crisis icons. */
export function fneOutFrontReplace(
  s: GameState,
  target: string,
  dealt: number,
  ports: Pick<FearNoEvilPorts, "log">,
): boolean {
  if (!s.villain || target !== s.villain.id || dealt <= 0) return false;
  const out = attached(s, target, [OUT_FRONT])[0];
  if (!out) return false;
  const removed = Math.min(dealt, Math.max(0, s.scheme.threat));
  s.scheme.threat -= removed;
  ports.log(
    s,
    `Out Front: ${dealt} damage to ${name(s.villain.code)} removes ${plural(removed, "threat")} from the main scheme instead.`,
    "good",
  );
  return true;
}
/** Vehicle attachments take the damage instead; Adamantium-Laced Spine
 * prevents all but 3 of Bullseye's damage. Returns the damage taken. */
export function fneDamageTaken(
  s: GameState,
  target: string,
  n: number,
  ports: Pick<FearNoEvilPorts, "log" | "discardPiece">,
): number {
  if (n <= 0) return n;
  const vehicle = attached(s, target, VEHICLES)[0];
  if (vehicle) {
    vehicle.damage = (vehicle.damage || 0) + n;
    ports.log(s, `${name(vehicle)} takes ${n} damage instead.`);
    if (vehicle.damage >= VEHICLE_LIMIT[vehicle.code]) {
      ports.log(s, `${name(vehicle)} is discarded.`, "good");
      ports.discardPiece(s, vehicle.id);
    }
    return 0;
  }
  if (s.villain && target === s.villain.id && underlingIs(s, "bullseye")) {
    const spine = attached(s, target, [SPINE])[0];
    if (spine && n > 3) {
      const prevented = n - 3;
      spine.damage = (spine.damage || 0) + prevented;
      ports.log(
        s,
        `Adamantium-Laced Spine prevents ${prevented} damage and holds it.`,
      );
      if (spine.damage >= 6) {
        spine.code = DAMAGED_SPINE;
        ports.log(s, "Adamantium-Laced Spine flips to Damaged Spine.", "good");
      }
      return 3;
    }
  }
  return n;
}
/** Out Front flips to Alongside once the main scheme has no threat; its
 * When Revealed follows. */
export function fneCheck(s: GameState, ports: FearNoEvilPorts) {
  if (!s.fearNoEvil || over(s) || !s.villain) return;
  const out = villainAttachment(s, OUT_FRONT);
  if (!out || s.scheme.threat > 0) return;
  out.code = ALONGSIDE;
  ports.log(
    s,
    `Out Front flips to Alongside: the heroes pull up beside ${name(s.villain.code)}.`,
    "good",
  );
  ports.queue(s, {
    type: "damage",
    target: s.villain.id,
    amount: 2 * s.playerCount,
    source: out.id,
    origin: "encounter",
  });
  for (const seat of [...playerOrder(s)].reverse())
    if (alive(s, seat.id))
      ports.indirect(s, seat.id, 1, out.id, name(ALONGSIDE));
}
/** The Getaway's Forced Interrupt when the round ends. */
export function fneRoundEnded(s: GameState, ports: FearNoEvilPorts) {
  const st = s.fearNoEvil;
  if (!st || over(s) || s.scheme.code !== GETAWAY || s.scheme.threat <= 0)
    return;
  st.speed += 1;
  const along = villainAttachment(s, ALONGSIDE);
  if (along) {
    along.code = OUT_FRONT;
    ports.log(s, "The Getaway: Alongside flips back to Out Front.", "bad");
  } else st.speed += 1;
  ports.log(s, `The Getaway: ${plural(st.speed, "speed counter")}.`, "bad");
}
/** Traffic Jam: a character with a Vehicle attachment adds its threat here
 * instead. */
export function fneSchemeTarget(s: GameState, p: { id: string }) {
  const jam = s.sideSchemes.find((q) => q.code === TRAFFIC && active(s, q));
  return jam && hasVehicle(s, p.id) ? jam.id : undefined;
}
/** Traffic Jam: an identity with a Vehicle attachment removes threat from
 * it instead. */
export function fneThwartTarget(s: GameState, e: Effect): string | undefined {
  const jam = s.sideSchemes.find((q) => q.code === TRAFFIC && active(s, q));
  if (!jam || e.target === jam.id) return undefined;
  const source = e.source as string | undefined;
  let playerId: string | undefined;
  if (!source || source === "hero") playerId = s.activePlayerId;
  else if (source.startsWith("hero:")) playerId = source.slice(5);
  else if (
    s.resolving.some((q) => q.id === source && !!q.ownerId) &&
    typeOf(s.resolving.find((q) => q.id === source)!) === "event"
  )
    playerId = s.activePlayerId;
  return playerId && hasVehicle(s, identityOf(playerId)) ? jam.id : undefined;
}
/** Cop: when it would scheme, it attacks the villain instead. */
export function fneCopAttacksInstead(s: GameState, id: string) {
  const m = s.minions.find((q) => q.id === id);
  return !!m && m.code === COP && active(s, m) && !!s.villain && !over(s);
}
/** Incessant Pursuit: the villain attacks the attached ally instead. */
export function fneAttackRedirect(
  s: GameState,
  enemyId: string,
  playerId: string,
): Piece[] {
  if (!s.villain || enemyId !== s.villain.id) return [];
  return allies(s, playerId).filter(
    (p) => attached(s, p.id, [PURSUIT]).length > 0,
  );
}

// ------------------------------------------------------------ activations

/** Forced Interrupts as an enemy activates. */
export function fneActivationInitiated(
  s: GameState,
  id: string,
  playerId: string,
  kind: "attack" | "scheme",
): Effect[] {
  const effects: Effect[] = [];
  const m = s.minions.find((q) => q.id === id);
  // Maggia Underboss: an additional boost card against a stunned player.
  if (
    m?.code === UNDERBOSS &&
    active(s, m) &&
    alive(s, playerId) &&
    seatView(s, playerId).player.stunned
  )
    effects.push(F("extra-boost", { enemyId: id, source: UNDERBOSS }));
  const a = s.attack;
  if (!s.villain || id !== s.villain.id || kind !== "attack" || !a)
    return effects;
  if (a.attacker !== id) return effects;
  // Electric Charge: a charge counter for an additional boost card and
  // overkill.
  if (underlingIs(s, "electro")) {
    const charge = chargeCard(s);
    if (charge && (charge.counters || 0) > 0 && active(s, charge))
      effects.push(F("electric-charge", { id: charge.id }));
  }
  // Raise the Stakes: an additional boost card.
  const stakes = attached(s, id, [STAKES])[0];
  if (stakes) effects.push(F("stakes", { id: stakes.id }));
  // "Head First!": this attack gains overkill.
  if (s.fearNoEvil?.headFirst) {
    a.overkill = true;
    delete s.fearNoEvil.headFirst;
  }
  // Incessant Pursuit: the redirected attack gains overkill.
  if (a.originalTarget && attached(s, a.originalTarget, [PURSUIT]).length) {
    a.overkill = true;
    a.fnePursuit = a.originalTarget;
  }
  return effects;
}
/** Lady Bullseye: 1 additional boost card if her attack is undefended. */
export function fneBoostsResolving(
  s: GameState,
  ports: Pick<FearNoEvilPorts, "giveBoost" | "log">,
) {
  const a = s.attack;
  if (!a || a.fneLady) return;
  const m = s.minions.find((q) => q.id === a.attacker);
  if (!m || m.code !== LADY || !active(s, m)) return;
  if ((a.defender && a.defender !== "none") || a.eventDefense) return;
  a.fneLady = true;
  extraBoost(s, m.id, ports);
  ports.log(
    s,
    "Lady Bullseye: the attack is undefended, so she gets an additional boost card.",
  );
}

export interface FneAttackReceipt {
  token: string;
  attackerId: string;
  /** `hero:<player>` or the attacked ally. */
  targetId: string;
  playerId: string;
  damageTaken: number;
  undefended: boolean;
  defeatedAlly: boolean;
  /** The identity defended this attack. */
  heroDefended: boolean;
  pursuit?: string;
  stakes?: string;
}
/** Forced Responses after an enemy attacks. */
export function fneAfterAttack(
  s: GameState,
  r: FneAttackReceipt,
): MutagenForcedResponse[] {
  const responses: MutagenForcedResponse[] = [];
  const respond = (
    key: string,
    title: string,
    effects: Effect[],
    sourceId?: string,
  ) =>
    responses.push({
      id: `${r.token}:fne-${key}`,
      title,
      effects,
      ...(sourceId ? { sourceId } : {}),
    });
  const villainAttack = !!s.villain && r.attackerId === s.villain.id;
  const actorId = r.playerId;
  if (villainAttack && underlingIs(s, "hammerhead") && r.damageTaken > 0)
    respond("hammerhead", "Hammerhead", [
      F("hammerhead", { target: r.targetId, actorId }),
    ]);
  if (villainAttack) {
    const gun = attached(s, r.attackerId, [GATLING])[0];
    if (gun)
      respond(
        "gatling",
        name(GATLING),
        [
          F("gatling", {
            id: gun.id,
            target: r.targetId,
            playerId: r.playerId,
            actorId,
          }),
        ],
        gun.id,
      );
  }
  if (
    s.fearNoEvil &&
    s.scheme.code === HEIST &&
    r.undefended &&
    r.targetId.startsWith("hero:")
  )
    respond("heist", "Art Museum Heist", [
      F("art-taken", { target: r.targetId, actorId }),
    ]);
  if (villainAttack && r.heroDefended) {
    const sai = attached(s, r.attackerId, [SAI])[0];
    if (sai)
      respond(
        "sai",
        name(SAI),
        [F("sai-offer", { id: sai.id, playerId: r.playerId, actorId })],
        sai.id,
      );
  }
  if (r.pursuit && r.defeatedAlly && r.targetId === r.pursuit)
    respond("pursuit", name(PURSUIT), [
      F("remove-defeated", { id: r.pursuit, source: PURSUIT }),
    ]);
  if (r.stakes)
    respond("stakes", name(STAKES), [
      F("stakes-end", {
        id: r.stakes,
        allyId: r.defeatedAlly ? r.targetId : undefined,
        playerId: r.playerId,
      }),
    ]);
  if (s.fearNoEvil?.bloodlust)
    respond("bloodlust", name(BLOODLUST), [
      F("bloodlust-reveal", { playerId: r.playerId, actorId }),
    ]);
  return responses;
}
/** Forced Responses after an enemy schemes. */
export function fneSchemed(
  s: GameState,
  id: string,
  playerId: string,
): Effect[] {
  const effects: Effect[] = [];
  if (s.villain && id === s.villain.id) {
    if (underlingIs(s, "electro") && chargeCard(s))
      effects.push(F("charge", { n: s.villain.code === "60078" ? 2 : 1 }));
    const damaged = attached(s, id, [DAMAGED_SPINE])[0];
    if (damaged && underlingIs(s, "bullseye"))
      effects.push(F("spine-repair", { id: damaged.id }));
  }
  if (s.fearNoEvil?.bloodlust)
    effects.push(F("bloodlust-reveal", { playerId, actorId: playerId }));
  return effects;
}
/** Whiplash's Forced Interrupt when a character attacks him. */
export function fneEnemyAttacked(
  s: GameState,
  target: string,
  source: string,
  playerId: string,
): Effect[] {
  const m = s.minions.find((q) => q.id === target);
  if (!m || m.code !== WHIPLASH || !active(s, m)) return [];
  const charge = chargeCard(s);
  if (!charge || (charge.counters || 0) <= 0) return [];
  return [
    F("whiplash", {
      id: m.id,
      chargeId: charge.id,
      attacker:
        source === "hero" || source.startsWith("hero:")
          ? source === "hero"
            ? identityOf(playerId)
            : source
          : source,
      actorId: playerId,
    }),
  ];
}
/** When Defeated abilities of minions, and Consolidate Power. */
export function fneMinionDefeated(
  s: GameState,
  m: Piece,
  textWasBlank: boolean,
  defeaterId: string,
): Effect[] {
  const effects: Effect[] = [];
  if (!textWasBlank && m.code === COP)
    effects.push({ type: "threat", target: "main", amount: 2 });
  if (!textWasBlank && m.code === CROOKED && alive(s, defeaterId))
    effects.push(F("deal", { playerId: defeaterId, actorId: defeaterId }));
  if (s.sideSchemes.some((q) => q.code === CONSOLIDATE && active(s, q)))
    effects.push(F("consolidate", { id: m.id }));
  return effects;
}
/** When Defeated: Charging Up. */
export function fneSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (p.code === CHARGING && !isTextBlank(s, p) && chargeCard(s))
    return [F("charge", { n: 3 })];
  return [];
}

// ------------------------------------------------------- Drained of Power

const drainedOn = (s: GameState, playerId: string) =>
  attached(s, identityOf(playerId), [DRAINED])[0];
/** The exhausted upgrades Drained of Power keeps from readying. */
export function fneDrainedUpgrades(s: GameState, playerId: string): string[] {
  if (!drainedOn(s, playerId)) return [];
  return seatView(s, playerId)
    .player.inPlay.filter((q) => q.exhausted && typeOf(q) === "upgrade")
    .map((q) => q.id);
}
/** Offer to pay for each upgrade Drained of Power held back. */
export function fneReadyUpgrades(
  s: GameState,
  playerId: string,
  ids: string[],
): Effect[] {
  return ids.length
    ? [F("drained-step", { ids, playerId, actorId: playerId })]
    : [];
}
/** Drained of Power intercepts an upgrade a card would ready. */
export function fneReadyCost(s: GameState, e: Effect): Effect[] | null {
  if (e.fneDrainedPaid) return null;
  const target = (e.target || e.id) as string | undefined;
  if (!target || target === "hero" || target.startsWith("hero:")) return null;
  const owner = playerOrder(s).find((seat) =>
    seatView(s, seat.id).player.inPlay.some(
      (q) => q.id === target && typeOf(q) === "upgrade" && q.exhausted,
    ),
  );
  if (!owner || !drainedOn(s, owner.id)) return null;
  return [
    F("drained-step", { ids: [target], playerId: owner.id, actorId: owner.id }),
  ];
}

// ---------------------------------------------------------------- actions

export function fneActions(
  s: GameState,
  p: Piece,
  ports?: Pick<FearNoEvilPorts, "canPay">,
): Option[] {
  if (s.phase !== "player" || !active(s, p)) return [];
  const playerId = s.activePlayerId;
  const hero = s.player.form === "hero";
  const canPay = (cost: number, req: Resource[]) =>
    !ports || ports.canPay(s, cost, req);
  if (ARTS.includes(p.code) && s.attachments.some((q) => q.id === p.id)) {
    if (!hero || p.attachedTo === identityOf(playerId)) return [];
    const resource = ART_RESOURCE[p.code];
    const options: Option[] = [];
    if (canPay(1, resource === "wild" ? [] : [resource]))
      options.push(
        option(
          `art-pay`,
          `Hero Action · spend ${resource === "wild" ? "a wild" : `a ${resource}`} resource: attach ${name(p)} to your hero`,
          [F("art-pay", { id: p.id, resource, actorId: playerId })],
          p.code,
        ),
      );
    if (!s.player.exhausted)
      options.push(
        option(
          `art-exhaust`,
          `Hero Action · exhaust your hero: attach ${name(p)} to your hero`,
          [F("art-claim", { id: p.id, exhaust: true, actorId: playerId })],
          p.code,
        ),
      );
    return options;
  }
  if (p.code === CHARGE && s.attachments.some((q) => q.id === p.id)) {
    if (!hero || (p.counters || 0) <= 0) return [];
    const options: Option[] = [];
    if (canPay(1, ["energy"]))
      options.push(
        option(
          "charge-energy",
          "Hero Action · spend an energy resource: remove 1 charge counter",
          [
            F("charge-pay", {
              id: p.id,
              cost: 1,
              req: ["energy"],
              actorId: playerId,
            }),
          ],
          p.code,
        ),
      );
    if (canPay(2, []))
      options.push(
        option(
          "charge-two",
          "Hero Action · spend 2 resources: remove 1 charge counter",
          [F("charge-pay", { id: p.id, cost: 2, req: [], actorId: playerId })],
          p.code,
        ),
      );
    return options;
  }
  if (p.code === HARDHEADED && s.attachments.some((q) => q.id === p.id)) {
    if (!hero || !canPay(3, ["energy", "mental", "physical"])) return [];
    return [
      option(
        "hardheaded",
        "Hero Action · spend energy, mental and physical resources: discard Hardheaded",
        [F("hardheaded-pay", { id: p.id, actorId: playerId })],
        p.code,
      ),
    ];
  }
  if (p.code === SERUM && s.attachments.some((q) => q.id === p.id)) {
    if (!hero) return [];
    return s.player.hand
      .filter(
        (q) => typeOf(q) === "event" && printedTraits(q).includes("Attack"),
      )
      .map((q) =>
        option(
          `serum:${q.id}`,
          `Hero Action · discard ${name(q)} from your hand: discard Flight Serum`,
          [F("serum", { id: p.id, cardId: q.id, actorId: playerId })],
          p.code,
        ),
      );
  }
  if (p.code === WANTED && s.player.inPlay.some((q) => q.id === p.id)) {
    if (!hero) return [];
    return [
      option(
        "wanted",
        "Hero Action · discard until a Police minion engages you, then discard Wanted",
        [F("wanted", { id: p.id, playerId, actorId: playerId })],
        p.code,
      ),
    ];
  }
  return [];
}
export function fneActionSource(s: GameState, id: string): Piece | undefined {
  return (
    s.attachments.find(
      (p) =>
        p.id === id &&
        (ARTS.includes(p.code) || [CHARGE, HARDHEADED, SERUM].includes(p.code)),
    ) || s.player.inPlay.find((p) => p.id === id && p.code === WANTED)
  );
}

// ----------------------------------------------------------------- reveals

export function fneReveal(s: GameState, p: Piece): Effect[] | null {
  if (!FNE_SCRIPT_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  if (FNE_ATTACHMENT_CODES.includes(p.code)) {
    if (resolving)
      return [F("attach", { piece: p, playerId, actorId: playerId })];
    // Drained of Power's When Revealed, once it is attached.
    return p.code === DRAINED && !isTextBlank(s, p)
      ? [F("drained-revealed", { playerId, actorId: playerId })]
      : [];
  }
  if (isTextBlank(s, p)) return [];
  const hero = isHero(s, playerId);
  switch (p.code) {
    case CHAMELEON:
      return [F("chameleon", { id: p.id, playerId, actorId: playerId })];
    case ART_THIEF:
      return [F("art-thief", { actorId: playerId })];
    case FISH:
      return [F("fish", { id: p.id, actorId: s.firstPlayerId })];
    case BLOODLUST:
      return [F("bloodlust", { id: p.id })];
    case STRUGGLE:
      return [F("struggle", { playerId, actorId: playerId })];
    case CORDON:
      return [F("cordon", { playerId, actorId: playerId })];
    case WEAPON:
      return hero
        ? [F("weapon", { playerId, actorId: playerId })]
        : [
            F("indirect", {
              playerId,
              amount: 2,
              source: WEAPON,
              actorId: playerId,
            }),
          ];
    case DESIRE:
      return [F("desire", { id: p.id, playerId, actorId: playerId })];
    case CHAIN:
      return [
        F("chain-step", {
          ids: characters(s, playerId),
          playerId,
          source: p.id,
          actorId: playerId,
        }),
      ];
    case OVERLOAD: {
      const ids = energyCards(s, playerId).map((q) => q.id);
      return ids.length
        ? [F("overload-step", { ids, playerId, actorId: playerId })]
        : [];
    }
    case SHOCKING:
      return [F("shocking", { playerId, actorId: playerId })];
    case HEAD_FIRST:
      return hero ? [F("head-first", { playerId, actorId: playerId })] : [];
    case TUG:
      return [F("tug", { id: p.id, playerId, actorId: playerId })];
    case BURNING:
      return speed(s) > 0
        ? [F("burning-step", { n: speed(s), playerId, actorId: playerId })]
        : [];
    case PEDESTRIANS:
      return speed(s) > 0
        ? [F("pedestrians-step", { n: speed(s), playerId, actorId: playerId })]
        : [];
    case CARJACKING:
      return [F("carjacking", { playerId, actorId: playerId })];
    case SWOOP:
      return [F("swoop", { playerId, hero, actorId: playerId })];
    default:
      return [];
  }
}
export function fneBoost(s: GameState, p: Piece): Effect[] | null {
  if (!FNE_SCRIPT_CODES.includes(p.code)) return null;
  if (isTextBlank(s, p) || !activation(s)) return [];
  const a = s.attack;
  switch (p.code) {
    case BLOODLUST:
      return s.fearNoEvil ? [F("bloodlust-later", { id: p.id })] : [];
    case WEAPON:
      return a &&
        s.villain &&
        a.attacker === s.villain.id &&
        underlingIs(s, "bullseye")
        ? [F("weapon-boost")]
        : [];
    case DESIRE:
      return a ? [F("attack-keyword", { keyword: "overkill" })] : [];
    case OWL:
      return a ? [F("attack-keyword", { keyword: "piercing" })] : [];
    case HARDHEADED: {
      const enemy = activation(s)!.attacker;
      return [{ type: "status", target: enemy, status: "tough" }];
    }
    case ART_THIEF:
      return [F("art-to-villain", { actorId: boostPlayer(s) })];
    case CROOKED: {
      const playerId = boostPlayer(s);
      return alive(s, playerId)
        ? [
            F("indirect", {
              playerId,
              amount: 2,
              source: CROOKED,
              actorId: playerId,
            }),
          ]
        : [];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------- helpers

/** Attach an Art to a character; its Forced Response follows. */
function attachArt(
  s: GameState,
  p: Piece,
  target: string,
  ports: FearNoEvilPorts,
) {
  if (s.attachments.some((q) => q.id === p.id)) p.attachedTo = target;
  else ports.attach(s, p, target);
  const who =
    target === s.villain?.id
      ? name(s.villain.code)
      : target.startsWith("hero:")
        ? ports.heroName(s, target.slice(5))
        : enemyName(s, target);
  ports.log(s, `${name(p)} attaches to ${who}.`);
  const status = ART_STATUS[p.code];
  if (status && !isTextBlank(s, p) && ports.canAddStatus(s, target, status))
    ports.queue(s, { type: "status", target, status });
}
/** Move an Art from an identity to the villain (the owner chooses which). */
function artToVillain(s: GameState, ports: FearNoEvilPorts, chooserId: string) {
  const holders = identitiesWithArt(s);
  if (!holders.length || !s.villain) return false;
  const arts = holders.flatMap((id) => artOn(s, identityOf(id)));
  if (arts.length === 1) {
    attachArt(s, arts[0], s.villain.id, ports);
    return true;
  }
  ports.choose(
    s,
    "Art Museum Heist",
    "Choose an Art attachment to move from an identity to the villain.",
    arts.map((a) =>
      option(
        a.id,
        `${name(a)} · ${ports.heroName(s, a.attachedTo!.slice(5))}`,
        [F("art-move", { id: a.id, target: s.villain.id, actorId: chooserId })],
        a.code,
      ),
    ),
  );
  return true;
}
/** Search the encounter deck and discard pile for a card. */
function findEncounter(s: GameState, test: (p: Piece) => boolean) {
  const inDeck = s.encounter.deck.find(test);
  return {
    piece: inDeck || s.encounter.discard.find(test),
    fromDeck: !!inDeck,
  };
}
/** Discard from the encounter deck until a card passes the test. */
function discardUntil(
  s: GameState,
  ports: FearNoEvilPorts,
  test: (p: Piece) => boolean,
) {
  const discarded: Piece[] = [];
  let found: Piece | undefined;
  for (let i = 0; i < 200; i++) {
    const { piece, emptied } = ports.discardTop(s);
    if (piece) discarded.push(piece);
    if (piece && test(piece)) {
      found = piece;
      break;
    }
    if (emptied || !piece) break;
  }
  if (discarded.length)
    ports.log(
      s,
      `Discarded from the encounter deck: ${discarded.map((q) => name(q)).join(", ")}.`,
    );
  return found;
}
/** An additional boost card for this activation; before the attack's boost
 * cards are dealt, it joins them. */
function extraBoost(
  s: GameState,
  enemyId: string,
  ports: Pick<FearNoEvilPorts, "giveBoost">,
) {
  const a = s.attack;
  if (a && a.attacker === enemyId && !a.pendingBoosts) {
    a.fneExtraBoosts = (a.fneExtraBoosts || 0) + 1;
    return;
  }
  ports.giveBoost(s, enemyId, "current");
}
function addCharge(s: GameState, n: number, ports: FearNoEvilPorts) {
  const charge = chargeCard(s);
  if (!charge || n <= 0) return;
  charge.counters = (charge.counters || 0) + n;
  ports.log(
    s,
    `Electric Charge: ${plural(n, "charge counter")} placed (${charge.counters}).`,
    "bad",
  );
}
function removeCharge(s: GameState, ports: FearNoEvilPorts) {
  const charge = chargeCard(s);
  if (!charge || (charge.counters || 0) <= 0) return false;
  charge.counters -= 1;
  ports.log(
    s,
    `Electric Charge: a charge counter is removed (${charge.counters}).`,
  );
  return true;
}
/** Put a defeated ally from its owner's discard pile out of the game. */
function removeDefeatedAlly(s: GameState, id: string, ports: FearNoEvilPorts) {
  for (const seat of playerOrder(s)) {
    const player = seatView(s, seat.id).player;
    const i = player.discard.findIndex((q) => q.id === id);
    if (i < 0) continue;
    const [p] = player.discard.splice(i, 1);
    s.removed.push(p);
    ports.log(s, `${name(p)} is removed from the game.`, "bad");
    return true;
  }
  return false;
}
/** Give an encounter card to the villain as a facedown boost card for its
 * next activation. */
function storeBoost(s: GameState, p: Piece) {
  s.resolving = s.resolving.filter((q) => q.id !== p.id);
  s.encounter.discard = s.encounter.discard.filter((q) => q.id !== p.id);
  (s.encounter.storedBoosts ||= []).push(p);
}
function damageEffect(
  target: string,
  amount: number,
  source: string,
  actorId: string,
): Effect {
  return target.startsWith("hero:")
    ? {
        type: "damage",
        target: "hero",
        amount,
        source,
        origin: "encounter",
        actorId: target.slice(5),
      }
    : { type: "damage", target, amount, source, origin: "encounter", actorId };
}

// ---------------------------------------------------------------- resolver

export function resolveFearNoEvilEffect(
  s: GameState,
  e: Effect,
  ports: FearNoEvilPorts,
): boolean {
  if (!e.type.startsWith("fne:")) return false;
  const st = s.fearNoEvil;
  switch (e.type) {
    // ------------------------------------------------------ villain stages
    case "fne:spine-aside": {
      // Bullseye (I): set aside Adamantium-Laced Spine.
      if (!st) break;
      const { piece } = findEncounter(s, (q) => q.code === SPINE);
      if (!piece) break;
      s.encounter.deck = s.encounter.deck.filter((q) => q.id !== piece.id);
      s.encounter.discard = s.encounter.discard.filter(
        (q) => q.id !== piece.id,
      );
      st.setAside.push(piece);
      ports.log(s, "Bullseye sets Adamantium-Laced Spine aside.");
      break;
    }
    case "fne:spine-attach": {
      // Bullseye (II): find Adamantium-Laced Spine and attach it to him.
      if (!st || !s.villain) break;
      if (
        s.attachments.some((q) => q.code === SPINE || q.code === DAMAGED_SPINE)
      )
        break;
      let piece = st.setAside.find((q) => q.code === SPINE);
      if (piece) st.setAside = st.setAside.filter((q) => q !== piece);
      else {
        const found = findEncounter(s, (q) => q.code === SPINE);
        piece = found.piece;
        if (found.fromDeck) ports.shuffleEncounter(s);
      }
      if (!piece) break;
      piece.damage = 0;
      ports.attach(s, piece, s.villain.id);
      ports.log(s, "Adamantium-Laced Spine attaches to Bullseye.", "bad");
      break;
    }
    case "fne:find-reveal": {
      const { piece, fromDeck } = findEncounter(s, (q) => q.code === e.code);
      if (!piece) break;
      ports.reveal(s, piece, s.firstPlayerId);
      if (fromDeck) ports.shuffleEncounter(s);
      break;
    }
    case "fne:charge-find": {
      // Electro (I) and (II): find Electric Charge, attach it to Electro and
      // place charge counters on it.
      if (!s.villain) break;
      let charge = chargeCard(s);
      if (!charge) {
        const found = findEncounter(s, (q) => q.code === CHARGE);
        if (found.piece) {
          found.piece.counters = 0;
          ports.attach(s, found.piece, s.villain.id);
          ports.log(s, "Electric Charge attaches to Electro.", "bad");
          if (found.fromDeck) ports.shuffleEncounter(s);
        }
        charge = chargeCard(s);
      }
      addCharge(s, Number(e.n) || 0, ports);
      break;
    }
    case "fne:charge":
      addCharge(s, Number(e.n) || 0, ports);
      break;
    case "fne:spine-repair": {
      // Damaged Spine: 3 damage comes off; at 0 it flips back.
      const p = s.attachments.find(
        (q) => q.id === e.id && q.code === DAMAGED_SPINE,
      );
      if (!p) break;
      p.damage = Math.max(0, (p.damage || 0) - 3);
      ports.log(s, `Damaged Spine: 3 damage is removed (${p.damage}).`, "bad");
      if (!p.damage) {
        p.code = SPINE;
        ports.log(
          s,
          "Damaged Spine flips back to Adamantium-Laced Spine.",
          "bad",
        );
      }
      break;
    }
    // ------------------------------------------------------- activations
    case "fne:extra-boost": {
      const a = activation(s);
      if (!a || a.attacker !== e.enemyId) break;
      extraBoost(s, String(e.enemyId), ports);
      ports.log(
        s,
        `${name(String(e.source))}: an additional boost card.`,
        "bad",
      );
      break;
    }
    case "fne:electric-charge": {
      const a = s.attack;
      if (!a || !s.villain || a.attacker !== s.villain.id) break;
      if (!removeCharge(s, ports)) break;
      extraBoost(s, s.villain.id, ports);
      a.overkill = true;
      ports.log(
        s,
        "Electric Charge: an additional boost card, and the attack gains overkill.",
        "bad",
      );
      break;
    }
    case "fne:stakes": {
      const a = s.attack;
      if (!a || !s.villain || a.attacker !== s.villain.id) break;
      if (!s.attachments.some((q) => q.id === e.id)) break;
      a.fneStakes = String(e.id);
      extraBoost(s, s.villain.id, ports);
      ports.log(
        s,
        "Raise the Stakes: Bullseye gets an additional boost card.",
        "bad",
      );
      break;
    }
    case "fne:weapon-boost": {
      const a = s.attack;
      if (!a || !s.villain || a.attacker !== s.villain.id) break;
      extraBoost(s, s.villain.id, ports);
      a.piercing = true;
      ports.log(
        s,
        "Everything Is A Weapon: an additional boost card, and the attack gains piercing.",
        "bad",
      );
      break;
    }
    case "fne:attack-keyword": {
      const a = s.attack;
      if (!a) break;
      if (e.keyword === "overkill") a.overkill = true;
      if (e.keyword === "piercing") a.piercing = true;
      ports.log(s, `The attack gains ${e.keyword}.`, "bad");
      break;
    }
    case "fne:bloodlust-later":
      if (st) st.bloodlust = String(e.id);
      break;
    case "fne:bloodlust-reveal": {
      // Deranged Bloodlust's boost: after this activation, reveal it.
      if (!st?.bloodlust) break;
      const id = st.bloodlust;
      delete st.bloodlust;
      const p =
        s.encounter.discard.find((q) => q.id === id) ||
        s.resolving.find((q) => q.id === id);
      if (!p) break;
      ports.reveal(
        s,
        p,
        alive(s, String(e.playerId)) ? String(e.playerId) : s.firstPlayerId,
      );
      break;
    }
    case "fne:bloodlust": {
      // When Revealed: additional threat equal to Bullseye's stage number.
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (!p || !s.villain || !underlingIsAny(s, "bullseye")) break;
      p.counters = (p.counters || 0) + s.villain.stage;
      ports.log(
        s,
        `Deranged Bloodlust: ${plural(s.villain.stage, "additional threat")}.`,
        "bad",
      );
      break;
    }
    case "fne:hammerhead": {
      // Stun the damaged character; an already stunned one takes damage.
      if (!s.villain) break;
      const target = String(e.target);
      const stunned = target.startsWith("hero:")
        ? alive(s, target.slice(5)) &&
          seatView(s, target.slice(5)).player.stunned
        : !!findCharacter(s, target)?.stunned;
      if (
        target.startsWith("hero:")
          ? !alive(s, target.slice(5))
          : !findCharacter(s, target)
      )
        break;
      if (stunned) {
        const n = s.villain.code === "60088" ? 2 : 1;
        ports.log(
          s,
          `Hammerhead: ${characterName(s, target, ports)} was already stunned and takes ${n} damage.`,
          "bad",
        );
        ports.queue(
          s,
          damageEffect(target, n, s.villain.id, String(e.actorId)),
        );
      } else if (ports.canAddStatus(s, target, "stunned")) {
        ports.log(
          s,
          `Hammerhead stuns ${characterName(s, target, ports)}.`,
          "bad",
        );
        ports.queue(s, { type: "status", target, status: "stunned" });
      }
      break;
    }
    case "fne:gatling": {
      // Energy Gatling Gun: if the attacked character was not defeated,
      // discard it and attack that character again.
      const gun = s.attachments.find((q) => q.id === e.id);
      if (!gun || !s.villain || over(s)) break;
      const target = String(e.target);
      const playerId = target.startsWith("hero:")
        ? target.slice(5)
        : allyOwner(s, target);
      if (!playerId || !alive(s, playerId)) break;
      if (!target.startsWith("hero:") && !findCharacter(s, target)) break;
      ports.discardPiece(s, gun.id);
      ports.log(s, "Energy Gatling Gun: Hammerhead attacks again.", "bad");
      ports.attackCharacter(s, s.villain.id, playerId, target);
      break;
    }
    case "fne:art-taken": {
      // Art Museum Heist: an Art on the undefended identity goes to the
      // villain.
      const target = String(e.target);
      const arts = artOn(s, target);
      if (!arts.length || !s.villain) break;
      if (arts.length === 1) attachArt(s, arts[0], s.villain.id, ports);
      else
        ports.choose(
          s,
          "Art Museum Heist",
          "The attack was undefended. Choose an Art attachment on your identity to attach to the villain.",
          arts.map((a) =>
            option(
              a.id,
              name(a),
              [
                F("art-move", {
                  id: a.id,
                  target: s.villain.id,
                  actorId: e.actorId,
                }),
              ],
              a.code,
            ),
          ),
        );
      break;
    }
    case "fne:art-move": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (p) attachArt(s, p, String(e.target), ports);
      break;
    }
    case "fne:art-to-villain":
      artToVillain(s, ports, String(e.actorId || s.activePlayerId));
      break;
    case "fne:sai-offer": {
      // Deadly Sai's Hero Response: spend 2 different resources to discard
      // it.
      const sai = s.attachments.find((q) => q.id === e.id);
      const playerId = String(e.playerId);
      if (!sai || !alive(s, playerId) || !isHero(s, playerId)) break;
      const pairs: [Resource, Resource][] = [
        ["energy", "mental"],
        ["energy", "physical"],
        ["mental", "physical"],
      ];
      const options = pairs
        .filter((pair) => ports.canPay(s, 2, pair))
        .map((pair) =>
          option(
            `sai:${pair.join("-")}`,
            `Spend ${pair[0]} and ${pair[1]} resources: discard Deadly Sai`,
            [F("sai-pay", { id: sai.id, req: pair, actorId: playerId })],
            sai.code,
          ),
        );
      if (!options.length) break;
      ports.choose(
        s,
        name(SAI),
        "You defended against Bullseye. Discard Deadly Sai?",
        [...options, option("decline", "Keep it in play", [])],
      );
      break;
    }
    case "fne:sai-pay": {
      const queue = [...s.queue];
      ports.pay(
        s,
        2,
        e.req as Resource[],
        [F("discard-attachment", { id: e.id })],
        name(SAI),
        true,
      );
      if (s.prompt?.kind === "payment") s.prompt.cancellationQueue = queue;
      break;
    }
    case "fne:discard-attachment":
      if (s.attachments.some((q) => q.id === e.id))
        ports.discardPiece(s, String(e.id));
      break;
    case "fne:remove-defeated":
      removeDefeatedAlly(s, String(e.id), ports);
      break;
    case "fne:stakes-end": {
      // Raise the Stakes leaves the game with a character it defeated;
      // otherwise it goes back into the encounter deck.
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      const playerId = String(e.playerId);
      const defeated = !!e.allyId || !alive(s, playerId);
      if (e.allyId) removeDefeatedAlly(s, String(e.allyId), ports);
      s.attachments = s.attachments.filter((q) => q.id !== p.id);
      delete p.attachedTo;
      if (defeated) {
        s.removed.push(p);
        ports.log(s, "Raise the Stakes is removed from the game.");
      } else {
        ports.shuffleIntoEncounter(s, p);
        ports.log(s, "Raise the Stakes is shuffled into the encounter deck.");
      }
      break;
    }
    case "fne:whiplash": {
      // Whiplash: a charge counter discards the top encounter card, and its
      // boost icons damage the attacker.
      if (!removeCharge(s, ports)) break;
      const { piece } = ports.discardTop(s);
      if (!piece) break;
      const n = def(piece)?.boost || 0;
      ports.log(
        s,
        `Whiplash discards ${name(piece)} (${plural(n, "boost icon")}).`,
        "bad",
      );
      const attacker = String(e.attacker);
      if (
        n > 0 &&
        (attacker.startsWith("hero:")
          ? alive(s, attacker.slice(5))
          : !!findCharacter(s, attacker))
      )
        ports.queue(
          s,
          damageEffect(attacker, n, String(e.id), String(e.actorId)),
        );
      break;
    }
    case "fne:deal":
      if (alive(s, String(e.playerId))) {
        ports.dealEncounter(s, String(e.playerId));
        ports.log(
          s,
          `Crooked Cop: ${ports.heroName(s, String(e.playerId))} is dealt a facedown encounter card.`,
          "bad",
        );
      }
      break;
    case "fne:consolidate": {
      // Consolidate Power: the defeated minion becomes the villain's
      // facedown boost card.
      const p = s.encounter.discard.find((q) => q.id === e.id);
      if (!p) break;
      storeBoost(s, p);
      ports.log(
        s,
        `Consolidate Power: ${name(p)} is given to the villain as a facedown boost card.`,
        "bad",
      );
      break;
    }
    // -------------------------------------------------- Drained of Power
    case "fne:drained-revealed": {
      // Exhaust each upgrade you control.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      for (const q of seatView(s, playerId).player.inPlay)
        if (typeOf(q) === "upgrade") q.exhausted = true;
      ports.log(
        s,
        "Drained of Power exhausts each upgrade you control.",
        "bad",
      );
      break;
    }
    case "fne:drained-step": {
      const [id, ...rest] = (e.ids as string[]) || [];
      if (!id) break;
      const playerId = String(e.playerId);
      const next = rest.length ? [F("drained-step", { ...e, ids: rest })] : [];
      const drained = alive(s, playerId) ? drainedOn(s, playerId) : undefined;
      const p = alive(s, playerId)
        ? seatView(s, playerId).player.inPlay.find(
            (q) => q.id === id && q.exhausted,
          )
        : undefined;
      if (!p || !drained) {
        if (p) p.exhausted = false;
        ports.queue(s, ...next);
        break;
      }
      const options: Option[] = [];
      if (ports.canPay(s, 1, ["energy"]))
        options.push(
          option(
            "energy",
            `Spend an energy resource · ready ${name(p)}`,
            [
              F("drained-pay", {
                id,
                cost: 1,
                req: ["energy"],
                drainedId: drained.id,
                next,
                actorId: playerId,
              }),
            ],
            p.code,
          ),
        );
      if (ports.canPay(s, 2, []))
        options.push(
          option(
            "two",
            `Spend 2 resources · ready ${name(p)}`,
            [
              F("drained-pay", {
                id,
                cost: 2,
                req: [],
                drainedId: drained.id,
                next,
                actorId: playerId,
              }),
            ],
            p.code,
          ),
        );
      if (!options.length) {
        ports.log(s, `${name(p)} stays exhausted: Drained of Power.`);
        ports.queue(s, ...next);
        break;
      }
      ports.choose(s, name(DRAINED), `Spend resources to ready ${name(p)}?`, [
        ...options,
        option("leave", `Leave ${name(p)} exhausted`, next),
      ]);
      break;
    }
    case "fne:drained-pay": {
      // Canceling the payment leaves the upgrade exhausted.
      const queue = [...s.queue];
      const next = (e.next as Effect[]) || [];
      ports.pay(
        s,
        Number(e.cost) || 1,
        (e.req as Resource[]) || [],
        [F("drained-ready", { id: e.id, drainedId: e.drainedId }), ...next],
        name(DRAINED),
        true,
      );
      if (s.prompt?.kind === "payment")
        s.prompt.cancellationQueue = [...next, ...queue];
      break;
    }
    case "fne:drained-ready": {
      const p = s.player.inPlay.find((q) => q.id === e.id);
      if (p) p.exhausted = false;
      const drained = s.attachments.find((q) => q.id === e.drainedId);
      if (!drained) break;
      drained.counters = Math.max(0, (drained.counters || 0) - 1);
      ports.log(
        s,
        `Drained of Power: a drain counter is removed (${drained.counters}).`,
        "good",
      );
      if (!drained.counters) ports.discardPiece(s, drained.id);
      break;
    }
    // ------------------------------------------------------------ actions
    case "fne:art-pay": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      const queue = [...s.queue];
      const resource = e.resource as Resource;
      ports.pay(
        s,
        1,
        resource === "wild" ? [] : [resource],
        [F("art-claim", { id: p.id, actorId: e.actorId })],
        name(p),
        true,
      );
      if (s.prompt?.kind === "payment") s.prompt.cancellationQueue = queue;
      break;
    }
    case "fne:art-claim": {
      const p = s.attachments.find((q) => q.id === e.id);
      if (!p) break;
      if (e.exhaust) s.player.exhausted = true;
      attachArt(s, p, identityOf(s.activePlayerId), ports);
      break;
    }
    case "fne:charge-pay": {
      const queue = [...s.queue];
      ports.pay(
        s,
        Number(e.cost) || 1,
        (e.req as Resource[]) || [],
        [F("charge-remove")],
        name(CHARGE),
        true,
      );
      if (s.prompt?.kind === "payment") s.prompt.cancellationQueue = queue;
      break;
    }
    case "fne:charge-remove":
      removeCharge(s, ports);
      break;
    case "fne:hardheaded-pay": {
      const queue = [...s.queue];
      ports.pay(
        s,
        3,
        ["energy", "mental", "physical"],
        [F("discard-attachment", { id: e.id })],
        name(HARDHEADED),
        true,
      );
      if (s.prompt?.kind === "payment") s.prompt.cancellationQueue = queue;
      break;
    }
    case "fne:serum": {
      const serum = s.attachments.find((q) => q.id === e.id);
      if (!serum || !s.player.hand.some((q) => q.id === e.cardId)) break;
      ports.discardHandCard(s, s.activePlayerId, String(e.cardId));
      ports.discardPiece(s, serum.id);
      ports.log(s, "Flight Serum is discarded.", "good");
      break;
    }
    case "fne:wanted": {
      // Wanted: a Police minion engages you; then Wanted is discarded.
      const playerId = String(e.playerId);
      const wanted = s.player.inPlay.find((q) => q.id === e.id);
      if (!wanted || !alive(s, playerId)) break;
      const cop = discardUntil(
        s,
        ports,
        (q) => typeOf(q) === "minion" && printedTraits(q).includes("Police"),
      );
      ports.discardPiece(s, wanted.id);
      if (cop) ports.putMinion(s, cop, playerId);
      break;
    }
    // ------------------------------------------------------------ attach
    case "fne:attach":
      resolveAttach(s, e, ports);
      break;
    case "fne:attach-to": {
      const p = e.piece as Piece;
      if (!s.resolving.some((q) => q.id === p.id)) break;
      attachTo(s, p, String(e.target), ports);
      break;
    }
    // ----------------------------------------------------------- reveals
    case "fne:chameleon": {
      const m = s.minions.find((q) => q.id === e.id);
      const playerId = String(e.playerId);
      if (!m || !alive(s, playerId)) break;
      ports.activate(s, {
        enemyId: m.id,
        playerId,
        kind: "scheme",
        modifier: 0,
      });
      break;
    }
    case "fne:art-thief": {
      if (!s.villain) break;
      const { piece, fromDeck } = findEncounter(s, (q) =>
        ARTS.includes(q.code),
      );
      if (piece) {
        attachArt(s, piece, s.villain.id, ports);
        if (fromDeck) ports.shuffleEncounter(s);
        break;
      }
      ports.shuffleEncounter(s);
      artToVillain(s, ports, String(e.actorId || s.activePlayerId));
      break;
    }
    case "fne:fish": {
      // Mister Fish engages the player whose identity has the fewest
      // remaining hit points.
      const m = s.minions.find((q) => q.id === e.id);
      if (!m) break;
      const living = playerOrder(s)
        .map((seat) => seat.id)
        .filter((id) => alive(s, id));
      if (!living.length) break;
      const low = Math.min(...living.map((id) => ports.identityHealth(s, id)));
      const tied = living.filter((id) => ports.identityHealth(s, id) === low);
      if (tied.length === 1) {
        engage(s, m, tied[0], ports);
        break;
      }
      ports.choose(
        s,
        name(FISH),
        "Mister Fish engages the player whose identity has the fewest remaining hit points. Choose among the tied players.",
        tied.map((id) =>
          option(id, ports.heroName(s, id), [
            F("engage", { id: m.id, playerId: id }),
          ]),
        ),
      );
      break;
    }
    case "fne:engage": {
      const m = s.minions.find((q) => q.id === e.id);
      if (m) engage(s, m, String(e.playerId), ports);
      break;
    }
    case "fne:struggle": {
      // Power Struggle: defeat the weakest minion, then reveal the next
      // minion discarded from the encounter deck.
      const playerId = String(e.playerId);
      if (!e.defeated && s.minions.length) {
        const hp = (m: Piece) => ports.remainingHealth(s, m.id);
        const low = Math.min(...s.minions.map(hp));
        const tied = s.minions.filter((m) => hp(m) === low);
        const next = F("struggle", { ...e, defeated: true });
        if (tied.length === 1) {
          ports.defeatMinion(s, tied[0].id);
          ports.queue(s, next);
        } else
          ports.choose(
            s,
            name(STRUGGLE),
            "Defeat the minion with the fewest remaining hit points. Choose among the tied minions.",
            tied.map((m) =>
              option(m.id, name(m), [F("defeat", { id: m.id }), next], m.code),
            ),
          );
        break;
      }
      const minion = discardUntil(s, ports, (q) => typeOf(q) === "minion");
      if (minion)
        ports.reveal(
          s,
          minion,
          alive(s, playerId) ? playerId : s.firstPlayerId,
        );
      break;
    }
    case "fne:defeat":
      if (s.minions.some((q) => q.id === e.id))
        ports.defeatMinion(s, String(e.id));
      break;
    case "fne:cordon": {
      const playerId = String(e.playerId);
      const { piece } = findEncounter(
        s,
        (q) => typeOf(q) === "minion" && printedTraits(q).includes("Police"),
      );
      if (piece)
        ports.reveal(s, piece, alive(s, playerId) ? playerId : s.firstPlayerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "fne:indirect":
      if (alive(s, String(e.playerId)))
        ports.indirect(
          s,
          String(e.playerId),
          Number(e.amount) || 0,
          String(e.source),
          name(String(e.source)),
        );
      break;
    case "fne:weapon": {
      // Everything Is A Weapon: Bullseye activates against you, or remove
      // an ally you control from the game.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || !s.villain) break;
      const activate = option(
        "activate",
        `${name(s.villain.code)} activates against you`,
        [
          F("activate", {
            enemyId: s.villain.id,
            playerId,
            modifier: 0,
            actorId: playerId,
          }),
        ],
      );
      const removal = allies(s, playerId).map((q) =>
        option(
          `remove:${q.id}`,
          `Remove ${name(q)} from the game`,
          [F("remove", { id: q.id })],
          q.code,
        ),
      );
      if (!removal.length) {
        ports.queue(s, ...activate.effects);
        break;
      }
      ports.choose(
        s,
        name(WEAPON),
        "Choose: Bullseye activates against you, or remove an ally you control from the game.",
        [activate, ...removal],
      );
      break;
    }
    case "fne:activate": {
      const playerId = String(e.playerId);
      const enemyId = String(e.enemyId);
      if (!alive(s, playerId) || !enemyIds(s).includes(enemyId)) break;
      ports.activate(s, {
        enemyId,
        playerId,
        kind:
          e.kind === "scheme" || (!e.kind && !isHero(s, playerId))
            ? "scheme"
            : "attack",
        modifier: Number(e.modifier) || 0,
      });
      break;
    }
    case "fne:remove": {
      const owner = allyOwner(s, String(e.id));
      if (!owner) break;
      const p = findCharacter(s, String(e.id))!;
      ports.removeFromGame(s, p.id);
      ports.log(s, `${name(p)} is removed from the game.`, "bad");
      break;
    }
    case "fne:desire": {
      // Unerring Desire: the villain's facedown boost card, or remove a
      // Persona support you control from the game.
      const playerId = String(e.playerId);
      const p = s.resolving.find((q) => q.id === e.id);
      const supports = alive(s, playerId)
        ? seatView(s, playerId).player.inPlay.filter(
            (q) =>
              typeOf(q) === "support" && printedTraits(q).includes("Persona"),
          )
        : [];
      const give = option(
        "boost",
        "Give Unerring Desire to the villain as a facedown boost card",
        [F("desire-boost", { id: e.id })],
      );
      if (!supports.length) {
        if (p) ports.queue(s, ...give.effects);
        break;
      }
      ports.choose(
        s,
        name(DESIRE),
        "Choose: the villain's facedown boost card, or remove a Persona support you control from the game.",
        [
          ...(p ? [give] : []),
          ...supports.map((q) =>
            option(
              `remove:${q.id}`,
              `Remove ${name(q)} from the game`,
              [F("remove-support", { id: q.id })],
              q.code,
            ),
          ),
        ],
      );
      break;
    }
    case "fne:desire-boost": {
      const p = s.resolving.find((q) => q.id === e.id);
      if (!p) break;
      storeBoost(s, p);
      ports.log(
        s,
        "Unerring Desire is given to the villain as a facedown boost card.",
        "bad",
      );
      break;
    }
    case "fne:remove-support":
      if (findCharacter(s, String(e.id))) {
        ports.log(
          s,
          `${name(findCharacter(s, String(e.id))!)} is removed from the game.`,
          "bad",
        );
        ports.removeFromGame(s, String(e.id));
      }
      break;
    case "fne:chain-step": {
      // Chain Lightning: exhaust each character you control, or damage it
      // (3 with charge counters on Electric Charge) and remove a charge
      // counter.
      const [target, ...rest] = (e.ids as string[]) || [];
      if (!target) break;
      const playerId = String(e.playerId);
      const next = rest.length ? [F("chain-step", { ...e, ids: rest })] : [];
      const isIdentity = target.startsWith("hero:");
      const piece = isIdentity ? undefined : findCharacter(s, target);
      if (!alive(s, playerId) || (!isIdentity && !piece)) {
        ports.queue(s, ...next);
        break;
      }
      const exhausted = isIdentity
        ? seatView(s, playerId).player.exhausted
        : !!piece!.exhausted;
      const charged = (chargeCard(s)?.counters || 0) > 0;
      const amount = charged ? 3 : 1;
      const label = characterName(s, target, ports);
      const damage = option("damage", `Deal ${amount} damage to ${label}`, [
        F("chain-damage", {
          target,
          amount,
          source: e.source,
          actorId: playerId,
        }),
        ...next,
      ]);
      if (exhausted) {
        ports.queue(s, ...damage.effects);
        break;
      }
      ports.choose(s, name(CHAIN), `Chain Lightning: ${label}.`, [
        option("exhaust", `Exhaust ${label}`, [
          isIdentity
            ? { type: "exhaust", id: "hero", actorId: playerId }
            : { type: "exhaust", id: target },
          ...next,
        ]),
        damage,
      ]);
      break;
    }
    case "fne:chain-damage":
      removeCharge(s, ports);
      ports.queue(
        s,
        damageEffect(
          String(e.target),
          Number(e.amount) || 0,
          String(e.source || CHAIN),
          String(e.actorId),
        ),
      );
      break;
    case "fne:overload-step": {
      // Energy Overload: discard each energy card, or stun a character you
      // control.
      const [id, ...rest] = (e.ids as string[]) || [];
      if (!id) break;
      const playerId = String(e.playerId);
      const next = rest.length ? [F("overload-step", { ...e, ids: rest })] : [];
      const hand = alive(s, playerId) ? seatView(s, playerId).player.hand : [];
      const p = hand.find((q) => q.id === id);
      if (!p) {
        ports.queue(s, ...next);
        break;
      }
      const stuns = characters(s, playerId)
        .filter((t) => ports.canAddStatus(s, t, "stunned"))
        .map((t) =>
          option(`stun:${t}`, `Stun ${characterName(s, t, ports)}`, [
            { type: "status", target: t, status: "stunned" },
            ...next,
          ]),
        );
      ports.choose(s, name(OVERLOAD), `Energy Overload: ${name(p)}.`, [
        option(
          "discard",
          `Discard ${name(p)}`,
          [
            F("discard-hand", { id: p.id, playerId, actorId: playerId }),
            ...next,
          ],
          p.code,
        ),
        ...stuns,
      ]);
      break;
    }
    case "fne:discard-hand":
      if (alive(s, String(e.playerId)))
        ports.discardHandCard(s, String(e.playerId), String(e.id));
      break;
    case "fne:shocking": {
      // Shocking Revelation: discard a card from your deck for each card you
      // control; each energy card discarded costs you.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      const view = seatView(s, playerId).player;
      const controlled =
        1 +
        view.inPlay.filter(
          (q) => !!q.ownerId && def(q)?.faction_code !== "encounter",
        ).length;
      const milled = ports.mill(s, playerId, controlled);
      const energy = milled.filter(
        (q) => (def(q)?.resource_energy || 0) > 0,
      ).length;
      ports.log(
        s,
        `Shocking Revelation discards ${plural(milled.length, "card")}, ${energy} with an energy resource.`,
        "bad",
      );
      if (energy)
        ports.queue(
          s,
          F("shocking-step", { n: energy, playerId, actorId: playerId }),
        );
      break;
    }
    case "fne:shocking-step": {
      const n = Number(e.n) || 0;
      const playerId = String(e.playerId);
      if (n <= 0 || !alive(s, playerId)) break;
      const next = n > 1 ? [F("shocking-step", { ...e, n: n - 1 })] : [];
      const take = option("indirect", "Take 1 indirect damage", [
        F("indirect", {
          playerId,
          amount: 1,
          source: SHOCKING,
          actorId: playerId,
        }),
        ...next,
      ]);
      if (!chargeCard(s)) {
        ports.queue(s, ...take.effects);
        break;
      }
      ports.choose(
        s,
        name(SHOCKING),
        `Shocking Revelation: ${plural(n, "energy card")} left.`,
        [
          take,
          option("charge", "Place 1 charge counter on Electric Charge", [
            F("charge", { n: 1 }),
            ...next,
          ]),
        ],
      );
      break;
    }
    case "fne:head-first": {
      // "Head First!": Hammerhead attacks you; stunned, +2 ATK and overkill.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || !s.villain) break;
      const stunned = seatView(s, playerId).player.stunned;
      if (stunned && st) st.headFirst = true;
      if (stunned)
        ports.log(
          s,
          '"Head First!": you are stunned, so Hammerhead gets +2 ATK and overkill.',
          "bad",
        );
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId,
        kind: "attack",
        modifier: stunned ? 2 : 0,
      });
      break;
    }
    case "fne:tug": {
      // Tug of War: spend 3 physical resources to take an Art from the
      // villain; otherwise an Art goes to the villain and this card surges.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || !s.villain) break;
      const decline = [
        F("tug-lose", { id: e.id, playerId, actorId: playerId }),
      ];
      const villainArts = artOn(s, s.villain.id);
      if (
        !villainArts.length ||
        !ports.canPay(s, 3, ["physical", "physical", "physical"])
      ) {
        ports.queue(s, ...decline);
        break;
      }
      ports.choose(
        s,
        name(TUG),
        "Spend 3 physical resources to move an Art attachment from the villain to your identity?",
        [
          option("pay", "Spend 3 physical resources", [
            F("tug-pay", { id: e.id, playerId, actorId: playerId }),
          ]),
          option("decline", "Decline", decline),
        ],
      );
      break;
    }
    case "fne:tug-pay": {
      // Canceling the payment takes the card's "otherwise" branch.
      const queue = [...s.queue];
      ports.pay(
        s,
        3,
        ["physical", "physical", "physical"],
        [F("tug-win", { playerId: e.playerId, actorId: e.actorId })],
        name(TUG),
        true,
      );
      if (s.prompt?.kind === "payment")
        s.prompt.cancellationQueue = [
          F("tug-lose", { id: e.id, playerId: e.playerId, actorId: e.actorId }),
          ...queue,
        ];
      break;
    }
    case "fne:tug-win": {
      const playerId = String(e.playerId);
      if (!s.villain || !alive(s, playerId)) break;
      const arts = artOn(s, s.villain.id);
      if (arts.length === 1) attachArt(s, arts[0], identityOf(playerId), ports);
      else if (arts.length)
        ports.choose(
          s,
          name(TUG),
          "Choose an Art attachment to take from the villain.",
          arts.map((a) =>
            option(
              a.id,
              name(a),
              [
                F("art-move", {
                  id: a.id,
                  target: identityOf(playerId),
                  actorId: playerId,
                }),
              ],
              a.code,
            ),
          ),
        );
      break;
    }
    case "fne:tug-lose":
      ports.queue(s, { type: "surge", sourceCode: TUG, sourceId: e.id });
      artToVillain(s, ports, String(e.playerId));
      break;
    case "fne:burning-step": {
      // Burning Rubber: for each speed counter, spend a resource or place 1
      // threat on the main scheme.
      const n = Number(e.n) || 0;
      const playerId = String(e.playerId);
      if (n <= 0 || !alive(s, playerId)) break;
      const next = n > 1 ? [F("burning-step", { ...e, n: n - 1 })] : [];
      const threat = option("threat", "Place 1 threat on the main scheme", [
        { type: "threat", target: "main", amount: 1 },
        ...next,
      ]);
      if (!ports.canPay(s, 1, [])) {
        ports.queue(s, ...threat.effects);
        break;
      }
      ports.choose(
        s,
        name(BURNING),
        `Burning Rubber: ${plural(n, "speed counter")} left.`,
        [
          option("pay", "Spend 1 resource", [
            F("burning-pay", { next, actorId: playerId }),
          ]),
          threat,
        ],
      );
      break;
    }
    case "fne:burning-pay": {
      // Canceling the resource places the threat instead.
      const queue = [...s.queue];
      const next = (e.next as Effect[]) || [];
      ports.pay(s, 1, [], next, name(BURNING), true);
      if (s.prompt?.kind === "payment")
        s.prompt.cancellationQueue = [
          { type: "threat", target: "main", amount: 1 },
          ...next,
          ...queue,
        ];
      break;
    }
    case "fne:pedestrians-step": {
      // Pedestrians: for each speed counter, exhaust a character you control
      // or take 1 indirect damage.
      const n = Number(e.n) || 0;
      const playerId = String(e.playerId);
      if (n <= 0 || !alive(s, playerId)) break;
      const next = n > 1 ? [F("pedestrians-step", { ...e, n: n - 1 })] : [];
      const view = seatView(s, playerId).player;
      const ready = [
        ...(!view.exhausted ? [identityOf(playerId)] : []),
        ...allies(s, playerId)
          .filter((q) => !q.exhausted)
          .map((q) => q.id),
      ];
      ports.choose(
        s,
        name(PEDESTRIANS),
        `Pedestrians: ${plural(n, "speed counter")} left.`,
        [
          ...ready.map((t) =>
            option(`exhaust:${t}`, `Exhaust ${characterName(s, t, ports)}`, [
              t.startsWith("hero:")
                ? { type: "exhaust", id: "hero", actorId: playerId }
                : { type: "exhaust", id: t },
              ...next,
            ]),
          ),
          option("indirect", "Take 1 indirect damage", [
            F("indirect", {
              playerId,
              amount: 1,
              source: PEDESTRIANS,
              actorId: playerId,
            }),
            ...next,
          ]),
        ],
      );
      break;
    }
    case "fne:carjacking": {
      // Carjacking: discard until a Vehicle attachment, then reveal it or
      // pay 3 resources of one type to attach it to your identity.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      const vehicle = discardUntil(s, ports, (q) => VEHICLES.includes(q.code));
      if (!vehicle) break;
      const reveal = option(
        "reveal",
        `Reveal ${name(vehicle)}`,
        [
          F("reveal-discarded", {
            id: vehicle.id,
            playerId,
            actorId: playerId,
          }),
        ],
        vehicle.code,
      );
      const options = hasVehicle(s, identityOf(playerId))
        ? []
        : RESOURCE_TYPES.filter((r) => ports.canPay(s, 3, [r, r, r])).map((r) =>
            option(
              `take:${r}`,
              `Spend 3 ${r} resources: attach ${name(vehicle)} to your identity`,
              [
                F("carjack-pay", {
                  id: vehicle.id,
                  resource: r,
                  playerId,
                  actorId: playerId,
                }),
              ],
              vehicle.code,
            ),
          );
      if (!options.length) {
        ports.queue(s, ...reveal.effects);
        break;
      }
      ports.choose(s, name(CARJACKING), `${name(vehicle)} was discarded.`, [
        ...options,
        reveal,
      ]);
      break;
    }
    case "fne:carjack-pay": {
      // Canceling the payment reveals the Vehicle instead.
      const r = e.resource as Resource;
      const queue = [...s.queue];
      ports.pay(
        s,
        3,
        [r, r, r],
        [F("carjack", { id: e.id, playerId: e.playerId, actorId: e.actorId })],
        name(CARJACKING),
        true,
      );
      if (s.prompt?.kind === "payment")
        s.prompt.cancellationQueue = [
          F("reveal-discarded", {
            id: e.id,
            playerId: e.playerId,
            actorId: e.actorId,
          }),
          ...queue,
        ];
      break;
    }
    case "fne:carjack": {
      const p = s.encounter.discard.find((q) => q.id === e.id);
      const playerId = String(e.playerId);
      if (!p || !alive(s, playerId)) break;
      p.damage = 0;
      ports.attach(s, p, identityOf(playerId));
      ports.log(
        s,
        `${name(p)} attaches to ${ports.heroName(s, playerId)}.`,
        "good",
      );
      break;
    }
    case "fne:reveal-discarded": {
      const p = s.encounter.discard.find((q) => q.id === e.id);
      if (p)
        ports.reveal(
          s,
          p,
          alive(s, String(e.playerId)) ? String(e.playerId) : s.firstPlayerId,
        );
      break;
    }
    case "fne:swoop": {
      // Swoop Down: the villain and each minion engaged with you activate;
      // Aerial enemies get +2.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      const kind = e.hero ? "attack" : "scheme";
      const ids = [
        ...(s.villain ? [s.villain.id] : []),
        ...s.minions.filter((m) => m.engagedWith === playerId).map((m) => m.id),
      ];
      ports.queue(
        s,
        ...ids.map((id) =>
          F("activate", {
            enemyId: id,
            playerId,
            kind,
            modifier: aerialEnemy(s, id) ? 2 : 0,
            actorId: playerId,
          }),
        ),
      );
      break;
    }
    default:
      throw Error(`Unknown Fear No Evil effect: ${e.type}`);
  }
  return true;
}
const underlingIsAny = (s: GameState, u: Underling) =>
  s.fearNoEvil?.underling === u;
function engage(
  s: GameState,
  m: Piece,
  playerId: string,
  ports: FearNoEvilPorts,
) {
  if (!alive(s, playerId)) return;
  m.engagedWith = playerId;
  ports.log(s, `${name(m)} engages ${ports.heroName(s, playerId)}.`, "bad");
}
/** The attachments' entry: each finds its own host or surges. */
function resolveAttach(s: GameState, e: Effect, ports: FearNoEvilPorts) {
  const p = e.piece as Piece;
  if (!s.resolving.some((q) => q.id === p.id)) return;
  const playerId = String(e.playerId);
  const discard = () => ports.discardPiece(s, p.id);
  switch (p.code) {
    case DRAINED:
      if (!alive(s, playerId)) return discard();
      p.counters = 3;
      return attachTo(s, p, identityOf(playerId), ports);
    case PURSUIT: {
      const targets = pursuitTargets(s);
      if (!targets.length) return discard();
      if (targets.length === 1) return attachTo(s, p, targets[0].p.id, ports);
      return ports.choose(
        s,
        name(PURSUIT),
        "Attach Incessant Pursuit to an ally without one.",
        targets.map(({ p: ally, playerId: owner }) =>
          option(
            ally.id,
            s.playerCount > 1
              ? `${name(ally)} · ${ports.heroName(s, owner)}`
              : name(ally),
            [F("attach-to", { piece: p, target: ally.id })],
            ally.code,
          ),
        ),
      );
    }
    case SPORTS_CAR:
    case MOTORCYCLE:
    case VAN: {
      const candidates = vehicleCandidates(s);
      if (!candidates.length) return discard();
      const value = (id: string) =>
        p.code === VAN
          ? -ports.remainingHealth(s, id)
          : ports.enemyStat(s, id, p.code === SPORTS_CAR ? "attack" : "scheme");
      const best = Math.max(...candidates.map(value));
      const tied = candidates.filter((id) => value(id) === best);
      if (tied.length === 1) return attachTo(s, p, tied[0], ports);
      return ports.choose(
        s,
        name(p),
        `Attach ${name(p)} to one of the tied enemies.`,
        tied.map((id) =>
          option(id, enemyName(s, id), [
            F("attach-to", { piece: p, target: id }),
          ]),
        ),
      );
    }
    case SERUM: {
      const targets = serumTargets(s);
      if (!targets.length) return discard();
      if (targets.length === 1) return attachTo(s, p, targets[0], ports);
      return ports.choose(
        s,
        name(SERUM),
        "Attach Flight Serum to a non-Aerial enemy.",
        targets.map((id) =>
          option(id, enemyName(s, id), [
            F("attach-to", { piece: p, target: id }),
          ]),
        ),
      );
    }
    default:
      // Attach to the villain (Bullseye, Electro or Hammerhead).
      if (!s.villain) return discard();
      if (p.code === CHARGE) p.counters = p.counters || 0;
      if (ARTS.includes(p.code)) {
        attachArt(s, p, s.villain.id, ports);
        return;
      }
      return attachTo(s, p, s.villain.id, ports);
  }
}
function attachTo(
  s: GameState,
  p: Piece,
  target: string,
  ports: FearNoEvilPorts,
) {
  ports.attach(s, p, target);
  const host = target.startsWith("hero:")
    ? ports.heroName(s, target.slice(5))
    : enemyIds(s).includes(target)
      ? enemyName(s, target)
      : name(findCharacter(s, target) || target);
  ports.log(s, `${name(p)} attaches to ${host}.`, "bad");
}
