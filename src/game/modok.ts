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

/** Agents of S.H.I.E.L.D.'s third scenario: M.O.D.O.K. holds four Inhumans
 * in the Holding Cell deck on A.I.M. Island and copies their powers into
 * his Adaptoids. The players free each Inhuman by removing the lock
 * counters from its Holding Cell, then defeat M.O.D.O.K. With the Scientist
 * Supreme modular set, which joins any scenario with modular sets. */

export const MODOK_CODES = [
  "50103a",
  "50103b",
  "50104a",
  "50104b",
  "50105a",
  "50105b",
  "50106a",
  "50106b",
  "50107a",
  "50107b",
  "50108a",
  "50108b",
  "50109",
  "50110",
  "50111",
  "50112",
  "50113",
  "50114",
  "50115",
  "50116",
  "50117",
  "50118",
  "50119",
  "50120",
  "50121",
  "50122",
  "50123",
  "50124",
] as const;
export const SCIENTIST_SUPREME_CODES = [
  "50125",
  "50126",
  "50127",
  "50128",
] as const;
/** The modular set, which joins any scenario with modular sets. */
export const MODOK_MODULAR_SETS = ["scientist_supreme"] as const;
const ALL_CODES: readonly string[] = [
  ...MODOK_CODES,
  ...SCIENTIST_SUPREME_CODES,
];

/** M.O.D.O.K. (A) for Standard, (B) for Expert: one card with two sides. */
const MODOKS = ["50103a", "50103b"];
export const UPGRADING_ADAPTOIDS = "50104b";
/** The Holding Cells and the Inhuman ally on the back of each. */
export const CELLS = ["50105a", "50106a", "50107a", "50108a"];
export const INHUMANS = ["50105b", "50106b", "50107b", "50108b"];
const FLYING_INHUMAN = "50105b";
const PSIONIC_INHUMAN = "50106b";
const SARAH_GARZA = "50107b";
/** Each Holding Cell's own payment for its Hero Action. */
const CELL_COST: Record<string, Resource[]> = {
  "50105a": ["energy", "energy"],
  "50106a": ["mental", "mental"],
  "50107a": ["wild"],
  "50108a": ["physical", "physical"],
};
const FLYING_UPGRADE = "50109";
const PSIONIC_UPGRADE = "50110";
const GARZA_UPGRADE = "50111";
const STRONG_UPGRADE = "50112";
export const UPGRADES = [
  FLYING_UPGRADE,
  PSIONIC_UPGRADE,
  GARZA_UPGRADE,
  STRONG_UPGRADE,
];
const ADAPTOID = "50113";
const MOBILE_UNIT = "50114";
const CRYSTAL = "50115";
const NANOBOTS = "50116";
const FORCE_FIELD = "50117";
const MACHETES = "50118";
const REVERSE_ENGINEERING = "50119";
const ATTACHMENTS = [
  MOBILE_UNIT,
  CRYSTAL,
  NANOBOTS,
  FORCE_FIELD,
  MACHETES,
  REVERSE_ENGINEERING,
];
/** The attachments discarded after M.O.D.O.K.'s hit points are reset. */
const RESET_DISCARDS = [
  MOBILE_UNIT,
  CRYSTAL,
  NANOBOTS,
  MACHETES,
  REVERSE_ENGINEERING,
];
const JAILER = "50120";
export const HOSTAGE_SITUATION = "50121";
const PSIONIC_ENHANCEMENT = "50122";
const ITS_ALIVE = "50123";
const PSIONIC_BLAST = "50124";
const SCIENTIST_SUPREME = "50125";
const MONICA = "50126";
const IMMUNITY = "50127";
const SANCTIONS = "50128";

export interface ModokState {
  /** The rest of the Holding Cell deck, under the Holding Cell in play. */
  cells: Piece[];
  /** The Adaptoid environments set aside. */
  upgrades: Piece[];
}

export interface ModokPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** Reveal an encounter card, removing it from its zone first. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  /** The characters a player controls: their identity, then their allies. */
  characters(s: GameState, playerId: string): string[];
  allies(s: GameState, playerId: string): Piece[];
  remainingHP(s: GameState, id: string): number;
  /** Put an Inhuman ally into play under a player's control. */
  putInhuman(s: GameState, p: Piece, playerId: string): void;
  putEnvironment(s: GameState, p: Piece): void;
  /** Attach a boost card of the current activation to an enemy. */
  attachBoost(s: GameState, id: string, enemyId: string): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  discardFromHand(s: GameState, playerId: string, id: string): void;
  shuffle<T>(s: GameState, items: T[]): T[];
  heal(s: GameState, target: string, n: number): void;
  /** An enemy's current SCH, with its modifiers. */
  schemeValue(s: GameState, id: string): number;
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
const M = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mdk:${type}`,
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
/** Permanent cards cannot leave play. */
const permanent = (p: Piece) => {
  const c = def(p) as (Card & { permanent?: boolean }) | undefined;
  return (
    c?.permanent === true ||
    /(?:^|[.\n])\s*Permanent\b/.test((c?.text || "").replace(/<[^>]*>/g, ""))
  );
};

export const modok = (s: GameState) => !!s.modok;
/** M.O.D.O.K. is the villain in play, with his text. */
const modokInPlay = (s: GameState) =>
  !!s.villain && MODOKS.includes(s.villain.code) && active(s, s.villain);
/** The Holding Cell in play: the top card of the Holding Cell deck. */
export const holdingCell = (s: GameState) =>
  (s.environments || []).find((p) => CELLS.includes(p.code));
/** The Adaptoid environments in play. */
const upgradesInPlay = (s: GameState) =>
  (s.environments || []).filter(
    (p) => UPGRADES.includes(p.code) && active(s, p),
  );
const upgradeInPlay = (s: GameState, code: string) =>
  upgradesInPlay(s).some((p) => p.code === code);
const isAdaptoid = (s: GameState, p: Piece) =>
  traits(p).includes("Adaptoid") && s.minions.some((m) => m.id === p.id);
const hostage = (s: GameState) =>
  s.sideSchemes.find((p) => p.code === HOSTAGE_SITUATION && active(s, p));
/** Each Rescued ally in play under a player's control. */
function rescuedAllies(s: GameState) {
  return seats(s).flatMap((seat) =>
    seatView(s, seat.id)
      .player.inPlay.filter(
        (p) =>
          def(p)?.type_code === "ally" &&
          traits(p).includes("Rescued") &&
          active(s, p),
      )
      .map((p) => ({ p, playerId: seat.id })),
  );
}
/** A.I.M. minions in the victory display. */
export const aimVictories = (s: GameState) =>
  (s.victoryDisplay || []).filter(
    (p) => def(p)?.type_code === "minion" && traits(p).includes("A.I.M."),
  ).length;

// ------------------------------------------------------------- interface

/** The line under M.O.D.O.K.'s stats. */
export const MODOK_CAPTION =
  "With a Holding Cell in play he resets instead of being defeated, and 2 locks come off it";
/** The Holding Cell's caption: its locks and the Inhumans still held. */
export function cellCaption(s: GameState) {
  const cell = holdingCell(s);
  const held = (s.modok?.cells.length || 0) + (cell ? 1 : 0);
  return cell
    ? `${cell.counters} lock${cell.counters === 1 ? "" : "s"} · ${held} Inhuman${held === 1 ? "" : "s"} held · frees ${name(def(cell)?.back_link || cell.code)}`
    : "Every Inhuman is free · defeat M.O.D.O.K.";
}
/** What each Adaptoid upgrade gives every Adaptoid. */
export const ADAPTOID_UPGRADE_CAPTIONS: Record<string, string> = {
  "50109": "Each Adaptoid: +1 SCH and incite 1 · Aerial",
  "50110": "Each Adaptoid: villainous · Psionic",
  "50111": "Each Adaptoid: +1 ATK, overkill and ranged · Elite",
  "50112": "Each Adaptoid: +1 ATK and toughness · Brute",
};
/** The objective line: the Inhumans still held, then M.O.D.O.K. */
export function modokObjective(s: GameState) {
  const held = (s.modok?.cells.length || 0) + (holdingCell(s) ? 1 : 0);
  return held
    ? `Free the Inhumans · ${4 - held} of 4 free`
    : "Defeat M.O.D.O.K. · every Inhuman is free";
}
/** Hostage Situation's caption: the ally it holds. */
export function hostageCaption(s: GameState, p: Piece) {
  const held = (p.storedCards || []).map((q) => name(q));
  return held.length
    ? `Holding ${held.join(", ")} · M.O.D.O.K. cannot take damage`
    : "M.O.D.O.K. cannot take damage";
}
/** The main scheme's note: the Adaptoid upgrades left. */
export function modokMainNote(s: GameState) {
  if (!s.modok || s.scheme.code !== UPGRADING_ADAPTOIDS) return "";
  const n = s.modok.upgrades.length;
  return n > 1
    ? `Completed: another Adaptoid upgrade instead (${n} set aside); the last one loses`
    : "Completed: the last Adaptoid upgrade enters and the players lose";
}

// --------------------------------------------------------------- setup

/** Upgrading Adaptoids (1A): the Holding Cell deck is shuffled and its top
 * card enters play with 2 lock counters per player; 1 random Adaptoid
 * environment enters play (2 in Expert) and the others are set aside.
 * M.O.D.O.K.'s hit points are printed without a per-player icon. */
export function modokSetup(
  s: GameState,
  ports: Pick<ModokPorts, "putEnvironment" | "shuffle"> & {
    makePiece(s: GameState, code: string): Piece;
  },
) {
  const take = (code: string) => {
    const i = s.encounter.deck.findIndex((p) => p.code === code);
    return i >= 0 ? s.encounter.deck.splice(i, 1)[0] : ports.makePiece(s, code);
  };
  const cells = ports.shuffle(
    s,
    CELLS.map((code) => {
      const p = take(code);
      p.code = code;
      return p;
    }),
  );
  // An Inhuman back face never sits in the encounter deck.
  s.encounter.deck = s.encounter.deck.filter((p) => !INHUMANS.includes(p.code));
  const upgrades = ports.shuffle(s, UPGRADES.map(take));
  const first = cells.shift()!;
  s.modok = { cells, upgrades: [] };
  const n = s.difficulty === "expert" ? 2 : 1;
  for (const p of upgrades.slice(0, n)) ports.putEnvironment(s, p);
  s.modok.upgrades = upgrades.slice(n);
  first.counters = 2 * s.playerCount;
  ports.putEnvironment(s, first);
  const main = def(UPGRADING_ADAPTOIDS);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
  const hp = def(s.villain.code)?.health || 0;
  s.villain.hp = hp;
  s.villain.maxHp = hp;
}
/** Each player searches the encounter deck for an Adaptoid and reveals
 * it. */
export function modokSetupEffects(s: GameState): Effect[] {
  return s.modok
    ? seats(s).map((seat) =>
        M("adaptoid-search", { playerId: seat.id, actorId: seat.id }),
      )
    : [];
}

// ------------------------------------------------------------ the villain

/** M.O.D.O.K.'s Forced Interrupt when he would be defeated: with a Holding
 * Cell in play, 2 lock counters come off it and his hit points reset to 10
 * (14 in Expert) instead; the attachments that say so are discarded after
 * the reset. Otherwise, the players win. */
export function modokWouldBeDefeated(
  s: GameState,
  ports: Pick<ModokPorts, "discardPiece">,
): Effect[] | "won" | null {
  if (!s.modok || !s.villain || !MODOKS.includes(s.villain.code)) return null;
  const cell = holdingCell(s);
  if (!active(s, s.villain) || !cell) return "won";
  for (const a of s.attachments.filter(
    (a) => a.attachedTo === s.villain.id && RESET_DISCARDS.includes(a.code),
  ))
    ports.discardPiece(s, a.id);
  const hp = def(s.villain.code)?.health || 0;
  s.villain.maxHp = hp + mobileUnitBonus(s);
  s.villain.hp = s.villain.maxHp;
  s.villain.damage = 0;
  return [M("unlock", { n: 2 })];
}
/** Automated Mobile Unit: +5 hit points while it is attached. */
const mobileUnitBonus = (s: GameState) =>
  5 *
  s.attachments.filter(
    (a) =>
      a.code === MOBILE_UNIT && a.attachedTo === s.villain?.id && active(s, a),
  ).length;
/** An Automated Mobile Unit leaving M.O.D.O.K. takes its hit points. */
export function modokAttachmentLeft(s: GameState, p: Piece) {
  if (
    p.code !== MOBILE_UNIT ||
    !s.villain ||
    p.attachedTo !== s.villain.id ||
    !(p as Piece & { modokHp?: boolean }).modokHp
  )
    return;
  delete (p as Piece & { modokHp?: boolean }).modokHp;
  s.villain.maxHp -= 5;
  s.villain.hp = Math.min(s.villain.hp, s.villain.maxHp);
}
/** Stats: the Adaptoid environments' bonuses on each Adaptoid, and Reverse
 * Engineering's X on M.O.D.O.K. (its printed -1 stands for X). */
export function modokEnemyStat(
  s: GameState,
  p: Piece,
  stat: "attack" | "scheme",
): number {
  let n = 0;
  if (isAdaptoid(s, p) && active(s, p)) {
    if (stat === "scheme" && upgradeInPlay(s, FLYING_UPGRADE)) n += 1;
    if (stat === "attack" && upgradeInPlay(s, GARZA_UPGRADE)) n += 1;
    if (stat === "attack" && upgradeInPlay(s, STRONG_UPGRADE)) n += 1;
  }
  for (const a of s.attachments)
    if (a.code === REVERSE_ENGINEERING && a.attachedTo === p.id)
      n +=
        1 +
        (a.storedCards || []).reduce(
          (sum, q) => sum + Math.max(0, Number(def(q)?.cost) || 0),
          0,
        );
  return n;
}
/** Granted keywords: from the Adaptoid environments, Psionic Force Field,
 * Psionic Machetes, Sarah Garza, Scientist Supreme and Monica Rappaccini. */
export function modokKeyword(s: GameState, p: Piece, keyword: string): number {
  if (isAdaptoid(s, p) && active(s, p)) {
    if (keyword === "Villainous" && upgradeInPlay(s, PSIONIC_UPGRADE)) return 1;
    if (
      (keyword === "Overkill" || keyword === "Ranged") &&
      upgradeInPlay(s, GARZA_UPGRADE)
    )
      return 1;
    if (keyword === "Toughness" && upgradeInPlay(s, STRONG_UPGRADE)) return 1;
  }
  const attached = (code: string) =>
    s.attachments.some(
      (a) => a.code === code && a.attachedTo === p.id && active(s, a),
    );
  if (keyword === "Stalwart" && attached(FORCE_FIELD)) return 1;
  if (keyword === "Piercing" && attached(MACHETES)) return 1;
  if (
    (keyword === "Overkill" || keyword === "Ranged") &&
    p.code === SARAH_GARZA &&
    active(s, p)
  )
    return 1;
  if (
    (keyword === "Piercing" || keyword === "Ranged") &&
    p.code === SCIENTIST_SUPREME &&
    active(s, p)
  )
    return 1;
  if (
    keyword === "Villainous" &&
    p.code === MONICA &&
    active(s, p) &&
    (s.victoryDisplay || []).some((q) => q.code === SCIENTIST_SUPREME)
  )
    return 1;
  return 0;
}
/** The traits each Adaptoid gains from the Adaptoid environments. */
export function modokTrait(
  s: GameState,
  target: string,
  trait: string,
): boolean {
  const p = s.minions.find((m) => m.id === target);
  if (!p || !isAdaptoid(s, p) || !active(s, p)) return false;
  const t = trait.replace(/\.$/, "");
  return (
    (t === "Aerial" && upgradeInPlay(s, FLYING_UPGRADE)) ||
    (t === "Psionic" && upgradeInPlay(s, PSIONIC_UPGRADE)) ||
    (t === "Elite" && upgradeInPlay(s, GARZA_UPGRADE)) ||
    (t === "Brute" && upgradeInPlay(s, STRONG_UPGRADE))
  );
}
/** Flying Upgrade: each Adaptoid gains incite 1, carried by the revealed
 * card. */
export function modokRevealCard(s: GameState, p: Piece, c: Card): Card {
  if (
    p.code === ADAPTOID &&
    upgradeInPlay(s, FLYING_UPGRADE) &&
    !/^Incite \d/m.test(c.text || "")
  )
    return { ...c, text: `Incite 1.\n${c.text || ""}` };
  return c;
}
/** Hostage Situation: M.O.D.O.K. cannot take damage. Psionic Force Field:
 * damage to the attached enemy is placed on it instead, and it is
 * discarded with at least 5. Returns the damage the target still takes. */
export function modokDamageTaken(
  s: GameState,
  target: string,
  n: number,
  ports: Pick<ModokPorts, "discardPiece" | "log">,
): number {
  if (n <= 0) return n;
  if (s.modok && target === s.villain?.id && modokInPlay(s) && hostage(s)) {
    ports.log(s, "Hostage Situation: M.O.D.O.K. cannot take damage.", "bad");
    return 0;
  }
  const field = s.attachments.find(
    (a) => a.code === FORCE_FIELD && a.attachedTo === target && active(s, a),
  );
  if (!field) return n;
  field.damage = (field.damage || 0) + n;
  ports.log(
    s,
    `Psionic Force Field takes ${n} damage (${field.damage} of 5).`,
    "bad",
  );
  if (field.damage >= 5) ports.discardPiece(s, field.id);
  return 0;
}
/** Nanobots' Forced Response after M.O.D.O.K. activates: heal 1 damage. */
export function modokActivated(s: GameState, enemyId: string): Effect[] {
  if (!s.villain || enemyId !== s.villain.id) return [];
  return s.attachments.some(
    (a) => a.code === NANOBOTS && a.attachedTo === enemyId && active(s, a),
  )
    ? [M("nanobots")]
    : [];
}
/** Upgrading Adaptoids' Forced Interrupt when it would be completed. */
export function modokMainCompleted(s: GameState): Effect[] | null {
  if (!s.modok || s.scheme.code !== UPGRADING_ADAPTOIDS) return null;
  return [M("upgrade")];
}

// ------------------------------------------------------------ the Inhumans

/** The Inhumans do not count against the ally limit. */
export const modokAllyExcluded = (s: GameState, p: Piece) =>
  INHUMANS.includes(p.code) && active(s, p);
/** An Inhuman that leaves play flips and goes to the bottom of the Holding
 * Cell deck; with no Holding Cell in play it is the top, and enters play
 * with its lock counters. */
export function modokInhumanLeft(
  s: GameState,
  p: Piece,
  ports: Pick<ModokPorts, "putEnvironment" | "log">,
) {
  const back = def(p)?.back_link;
  const cell = CELLS.find((code) => def(code)?.back_link === p.code) || back;
  p.code = cell || p.code;
  if (!s.modok) {
    s.removed.push(p);
    return;
  }
  delete p.ownerId;
  p.exhausted = false;
  p.damage = 0;
  s.modok.cells.push(p);
  ports.log(
    s,
    `${name(INHUMANS[CELLS.indexOf(p.code)] || p.code)} returns to the Holding Cell deck.`,
    "bad",
  );
  if (!holdingCell(s)) nextCell(s, ports);
}
/** The next Holding Cell enters play with 2 lock counters per player. */
function nextCell(s: GameState, ports: Pick<ModokPorts, "putEnvironment">) {
  const p = s.modok?.cells.shift();
  if (!p) return;
  p.counters = 2 * s.playerCount;
  ports.putEnvironment(s, p);
}
/** Flying Inhuman's and Psionic Inhuman's Response after it thwarts. */
export function modokAllyThwarted(
  s: GameState,
  p: Piece,
  target: string,
): Effect[] {
  if (!active(s, p)) return [];
  if (p.code === FLYING_INHUMAN)
    return [M("flying", { target, actorId: s.activePlayerId })];
  if (p.code === PSIONIC_INHUMAN && holdingCell(s))
    return [M("psionic", { actorId: s.activePlayerId })];
  return [];
}

// ----------------------------------------------------------------- actions

/** Each Holding Cell's Hero Action: spend its resources, or 3 of any type,
 * to remove 1 lock counter. */
export function modokActions(
  s: GameState,
  p: Piece,
  ports?: Pick<ModokPorts, "canPay">,
): Option[] {
  if (
    s.phase !== "player" ||
    s.player.form !== "hero" ||
    !CELLS.includes(p.code) ||
    !active(s, p) ||
    !(p.counters > 0)
  )
    return [];
  const own = CELL_COST[p.code];
  const label = own.map((r) => r[0].toUpperCase() + r.slice(1)).join(" + ");
  const options: Option[] = [];
  if (!ports || ports.canPay(s, own.length, own))
    options.push({
      id: "unlock",
      label: `Hero Action · spend ${label} · remove 1 lock counter`,
      image: p.code,
      effects: [M("cell-pay", { id: p.id, cost: own.length, own: true })],
    });
  if (!ports || ports.canPay(s, 3, []))
    options.push({
      id: "unlock-any",
      label: "Hero Action · spend 3 resources · remove 1 lock counter",
      image: p.code,
      effects: [M("cell-pay", { id: p.id, cost: 3, own: false })],
    });
  return options;
}
export function modokActionSource(s: GameState, id: string): Piece | undefined {
  return (s.environments || []).find(
    (p) => p.id === id && CELLS.includes(p.code),
  );
}

// ----------------------------------------------------------------- windows

/** Hostage Situation's When Defeated: the defeating player takes control
 * of the attached ally, before the scheme leaves play. */
export function modokSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
  ports: Pick<ModokPorts, "putInhuman">,
): Effect[] {
  if (p.code === HOSTAGE_SITUATION && active(s, p) && p.storedCards?.length)
    for (const q of p.storedCards.splice(0))
      ports.putInhuman(s, q, alive(s, playerId) ? playerId : s.firstPlayerId);
  return [];
}
/** Victory -1: Scientist Supreme and Monica Rappaccini enter the victory
 * display when defeated. */
export const modokVictoryMinion = (p: Piece) =>
  p.code === SCIENTIST_SUPREME || p.code === MONICA;
/** Adaptoid's When Defeated: 1 all-purpose counter comes off an
 * environment. */
export function modokMinionDefeated(
  s: GameState,
  m: Piece,
  textWasBlank: boolean,
): Effect[] {
  if (textWasBlank || m.code !== ADAPTOID) return [];
  return [M("counter-off", { actorId: s.activePlayerId })];
}

// ----------------------------------------------------------------- reveals

export function modokReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  // The attachments attach to M.O.D.O.K.; Reverse Engineering then tucks a
  // card under itself.
  if (ATTACHMENTS.includes(p.code))
    return resolving
      ? [
          M("attach", { piece: p }),
          ...(p.code === REVERSE_ENGINEERING && !isTextBlank(s, p)
            ? [M("tuck", { id: p.id, playerId })]
            : []),
        ]
      : [];
  if (isTextBlank(s, p)) return [];
  const hero = seatView(s, playerId).player.form === "hero";
  switch (p.code) {
    case JAILER:
      return [M("jailer", { id: p.id, playerId })];
    case HOSTAGE_SITUATION:
      return [M("hostage", { id: p.id, playerId, actorId: playerId })];
    case ITS_ALIVE:
      return seats(s).map((seat) =>
        M("alive", { playerId: seat.id, actorId: seat.id }),
      );
    case PSIONIC_BLAST:
      return hero
        ? [M("blast", { playerId })]
        : [
            {
              type: "status",
              target: "hero",
              status: "confused",
              actorId: playerId,
            },
            M("activate", { playerId, kind: "scheme" }),
          ];
    case IMMUNITY:
      return [M("immunity", { id: p.id })];
    case SANCTIONS:
      return [M("sanctions", { playerId, n: aimVictories(s) })];
    default:
      return [];
  }
}
export function modokBoost(s: GameState, p: Piece): Effect[] | null {
  if (![ADAPTOID, FORCE_FIELD, MACHETES, PSIONIC_ENHANCEMENT].includes(p.code))
    return null;
  const a = activation(s);
  if (isTextBlank(s, p) || !a) return [];
  switch (p.code) {
    case ADAPTOID:
      // After this activation, shuffle Adaptoid into the encounter deck.
      return [
        M("after", { id: p.id, effects: [M("reshuffle", { id: p.id })] }),
      ];
    case FORCE_FIELD:
      return [M("field-boost", { id: p.id, enemyId: a.attacker })];
    case MACHETES:
      return s.attack ? [M("machetes-boost")] : [];
    default:
      // Psionic Enhancement: the activating enemy gets an additional boost
      // card.
      return [M("enhance", { enemyId: a.attacker })];
  }
}
/** Diplomatic Sanctions' boost icons: one for each A.I.M. minion in the
 * victory display. */
export function modokBoostIcons(s: GameState, p: Piece): number {
  return p.code === SANCTIONS && active(s, p) && activation(s)
    ? aimVictories(s)
    : 0;
}

// ---------------------------------------------------------------- resolver

export function resolveModokEffect(
  s: GameState,
  e: Effect,
  ports: ModokPorts,
): boolean {
  if (!e.type.startsWith("mdk:")) return false;
  const st = s.modok;
  switch (e.type) {
    case "mdk:adaptoid-search": {
      // Setup: search the encounter deck for an Adaptoid and reveal it.
      if (!alive(s, e.playerId)) break;
      const p = s.encounter.deck.find((q) => q.code === ADAPTOID);
      if (!p) break;
      ports.reveal(s, p, e.playerId);
      ports.shuffleEncounter(s);
      break;
    }
    case "mdk:unlock": {
      // Remove lock counters from the Holding Cell in play; its last one
      // frees the Inhuman on its back.
      const cell = holdingCell(s);
      if (!cell) break;
      const n = Math.min(cell.counters || 0, Number(e.n));
      cell.counters = (cell.counters || 0) - n;
      if (n)
        ports.log(
          s,
          `${n} lock counter${n === 1 ? "" : "s"} come${n === 1 ? "s" : ""} off the Holding Cell.`,
          "good",
        );
      if (cell.counters <= 0) ports.queue(s, M("free", { id: cell.id }));
      break;
    }
    case "mdk:free": {
      // Flip the Holding Cell and put its Inhuman into play under any
      // player's control.
      const cell = (s.environments || []).find((q) => q.id === e.id);
      if (!cell || cell.counters > 0) break;
      const players = seats(s);
      if (players.length === 1)
        ports.queue(s, M("free-to", { id: cell.id, playerId: players[0].id }));
      else
        ports.choose(
          s,
          name(def(cell)?.back_link || cell.code),
          "Put the freed Inhuman into play under a player's control.",
          players.map((seat) => ({
            id: seat.id,
            label: `${ports.heroName(s, seat.id)} takes them`,
            effects: [M("free-to", { id: cell.id, playerId: seat.id })],
          })),
        );
      break;
    }
    case "mdk:free-to": {
      const i = (s.environments || []).findIndex((q) => q.id === e.id);
      if (i < 0 || !alive(s, e.playerId)) break;
      const [cell] = s.environments!.splice(i, 1);
      const back = def(cell)?.back_link;
      if (back) cell.code = back;
      cell.counters = 0;
      ports.putInhuman(s, cell, e.playerId);
      ports.log(s, `${name(cell)} is free and joins the heroes.`, "good");
      nextCell(s, ports);
      break;
    }
    case "mdk:cell-pay": {
      const cell = (s.environments || []).find((q) => q.id === e.id);
      if (!cell) break;
      ports.pay(
        s,
        Number(e.cost),
        e.own ? CELL_COST[cell.code] || [] : [],
        [M("unlock", { n: 1 })],
        "Holding Cell · remove 1 lock counter",
        true,
      );
      break;
    }
    case "mdk:upgrade": {
      // Upgrading Adaptoids would be completed: a random set-aside Adaptoid
      // environment enters play instead; with none left set aside, the
      // players lose; otherwise all threat comes off and each Adaptoid in
      // the encounter discard pile is shuffled into the encounter deck.
      if (!st) break;
      const pool = ports.shuffle(s, st.upgrades.splice(0));
      const p = pool.shift();
      st.upgrades = pool;
      if (p) {
        ports.putEnvironment(s, p);
        ports.log(s, `${name(p)} enters play.`, "bad");
      }
      const rest = s.modok?.upgrades || [];
      if (!rest.length) {
        ports.endGame(
          s,
          false,
          "Every Adaptoid upgrade is complete. M.O.D.O.K.'s Adaptoids overwhelm the heroes.",
        );
        break;
      }
      s.scheme.threat = 0;
      const discarded = s.encounter.discard.filter((q) => q.code === ADAPTOID);
      for (const q of discarded) ports.shuffleIntoEncounter(s, q);
      break;
    }
    case "mdk:attach": {
      const p = e.piece as Piece;
      if (!s.villain) {
        ports.discardPiece(s, p.id);
        break;
      }
      ports.attach(s, p, s.villain.id);
      if (p.code === MOBILE_UNIT && !isTextBlank(s, p)) {
        (p as Piece & { modokHp?: boolean }).modokHp = true;
        s.villain.maxHp += 5;
        s.villain.hp += 5;
      }
      break;
    }
    case "mdk:tuck": {
      // Reverse Engineering: tuck an upgrade you control under it; otherwise
      // the top card of your deck. A Permanent upgrade cannot leave play.
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a || !alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      const upgrades = view.inPlay.filter(
        (q) => def(q)?.type_code === "upgrade" && !permanent(q),
      );
      if (!upgrades.length) {
        ports.queue(s, M("tuck-top", { id: e.id, playerId: e.playerId }));
        break;
      }
      const tuck = (q: Piece): Effect =>
        M("tuck-card", { id: e.id, card: q.id, playerId: e.playerId });
      if (upgrades.length === 1) ports.queue(s, tuck(upgrades[0]));
      else
        ports.choose(
          s,
          name(REVERSE_ENGINEERING),
          "Tuck an upgrade you control under Reverse Engineering.",
          upgrades.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [tuck(q)],
          })),
        );
      break;
    }
    case "mdk:tuck-card": {
      const a = s.attachments.find((q) => q.id === e.id);
      const view = seatView(s, e.playerId).player;
      if (!a || !view.inPlay.some((q) => q.id === e.card)) break;
      ports.discardPiece(s, String(e.card));
      const i = view.discard.findIndex((q) => q.id === e.card);
      if (i < 0) break;
      const [q] = view.discard.splice(i, 1);
      q.ownerId ||= e.playerId;
      (a.storedCards ||= []).push(q);
      ports.log(s, `${name(q)} is tucked under Reverse Engineering.`, "bad");
      break;
    }
    case "mdk:tuck-top": {
      const a = s.attachments.find((q) => q.id === e.id);
      const view = seatView(s, e.playerId).player;
      if (!a || !view.deck.length) break;
      const q = view.deck.shift()!;
      q.ownerId ||= e.playerId;
      (a.storedCards ||= []).push(q);
      ports.log(
        s,
        "The top card of the deck is tucked under Reverse Engineering.",
        "bad",
      );
      break;
    }
    case "mdk:nanobots":
      if (s.villain) ports.heal(s, s.villain.id, 1);
      break;
    case "mdk:jailer": {
      // A.I.M. Jailer attacks the Rescued ally with the fewest remaining hit
      // points; otherwise 1 lock counter on a Holding Cell.
      const jailer = s.minions.find((m) => m.id === e.id);
      const allies = rescuedAllies(s);
      if (!jailer || !allies.length) {
        const cell = holdingCell(s);
        if (cell) {
          cell.counters = (cell.counters || 0) + 1;
          ports.log(s, "A lock counter is placed on the Holding Cell.", "bad");
        }
        break;
      }
      const least = Math.min(
        ...allies.map((a) => ports.remainingHP(s, a.p.id)),
      );
      const tied = allies.filter((a) => ports.remainingHP(s, a.p.id) === least);
      const attack = (a: { p: Piece; playerId: string }): Effect => ({
        type: "enemyAttack",
        id: jailer.id,
        actorId: a.playerId,
        originalTarget: a.p.id,
      });
      if (tied.length === 1) ports.queue(s, attack(tied[0]));
      else
        ports.choose(
          s,
          name(JAILER),
          "A.I.M. Jailer attacks the Rescued ally with the fewest remaining hit points.",
          tied.map((a) => ({
            id: a.p.id,
            label: name(a.p),
            image: a.p.code,
            effects: [attack(a)],
          })),
        );
      break;
    }
    case "mdk:hostage": {
      // Attach 1 Rescued ally faceup here; it is under no player's control.
      const scheme = s.sideSchemes.find((q) => q.id === e.id);
      const allies = rescuedAllies(s);
      if (!scheme || !allies.length) break;
      const take = (a: { p: Piece; playerId: string }): Effect =>
        M("hostage-take", {
          id: e.id,
          ally: a.p.id,
          playerId: a.playerId,
        });
      if (allies.length === 1) ports.queue(s, take(allies[0]));
      else
        ports.choose(
          s,
          name(HOSTAGE_SITUATION),
          "Attach a Rescued ally to Hostage Situation.",
          allies.map((a) => ({
            id: a.p.id,
            label: name(a.p),
            image: a.p.code,
            effects: [take(a)],
          })),
        );
      break;
    }
    case "mdk:hostage-take": {
      const scheme = s.sideSchemes.find((q) => q.id === e.id);
      const view = seatView(s, e.playerId).player;
      const i = view.inPlay.findIndex((q) => q.id === e.ally);
      if (!scheme || i < 0) break;
      const [p] = view.inPlay.splice(i, 1);
      for (const a of s.attachments.filter((q) => q.attachedTo === p.id))
        ports.discardPiece(s, a.id);
      (scheme.storedCards ||= []).push(p);
      ports.log(s, `${name(p)} is held hostage.`, "bad");
      break;
    }
    case "mdk:alive": {
      // "It's Alive!": find an Adaptoid and reveal it; a player who does not
      // engage a minion this way is dealt a facedown encounter card.
      if (!alive(s, e.playerId)) break;
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.code === ADAPTOID,
      );
      if (!p) {
        ports.dealEncounter(s, e.playerId);
        break;
      }
      ports.queue(
        s,
        M("alive-reveal", { id: p.id, playerId: e.playerId }),
        M("alive-check", { id: p.id, playerId: e.playerId }),
      );
      break;
    }
    case "mdk:alive-reveal": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      if (!p || !alive(s, e.playerId)) break;
      const fromDeck = s.encounter.deck.some((q) => q.id === p.id);
      ports.reveal(s, p, e.playerId);
      if (fromDeck) ports.shuffleEncounter(s);
      break;
    }
    case "mdk:alive-check":
      if (
        alive(s, e.playerId) &&
        !s.minions.some((m) => m.id === e.id && m.engagedWith === e.playerId)
      )
        ports.dealEncounter(s, e.playerId);
      break;
    case "mdk:blast": {
      // Psionic Blast (hero): X indirect damage, X being M.O.D.O.K.'s SCH;
      // each character that takes damage this way is confused.
      if (!alive(s, e.playerId) || !s.villain) break;
      const x = ports.schemeValue(s, s.villain.id);
      const hp = (c: string) =>
        c.startsWith("hero:")
          ? seatView(s, e.playerId).player.hp
          : ports.remainingHP(s, c);
      const before = ports
        .characters(s, e.playerId)
        .map((c) => [c, hp(c)] as [string, number]);
      ports.queue(
        s,
        M("blast-damage", { playerId: e.playerId, n: x }),
        M("blast-confuse", { playerId: e.playerId, before }),
      );
      break;
    }
    case "mdk:blast-damage":
      if (alive(s, e.playerId) && Number(e.n) > 0)
        ports.indirect(
          s,
          e.playerId,
          Number(e.n),
          PSIONIC_BLAST,
          name(PSIONIC_BLAST),
        );
      break;
    case "mdk:blast-confuse": {
      if (!alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      for (const [c, hp] of (e.before as [string, number][]) || []) {
        if (c.startsWith("hero:")) {
          if (view.hp < hp)
            ports.queue(s, {
              type: "status",
              target: "hero",
              status: "confused",
              actorId: e.playerId,
            });
        } else if (
          view.inPlay.some((q) => q.id === c) &&
          ports.remainingHP(s, c) < hp
        )
          ports.queue(s, { type: "status", target: c, status: "confused" });
      }
      break;
    }
    case "mdk:activate":
      if (!alive(s, e.playerId) || !s.villain) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
      });
      break;
    case "mdk:immunity": {
      // An acceleration token for each A.I.M. minion in the victory display.
      const p = s.sideSchemes.find((q) => q.id === e.id);
      const n = aimVictories(s);
      if (p && n) p.accelerationTokens = Number(p.accelerationTokens || 0) + n;
      break;
    }
    case "mdk:sanctions": {
      // Discard 1 card from your hand for each A.I.M. minion in the victory
      // display.
      if (!alive(s, e.playerId) || Number(e.n) <= 0) break;
      const hand = seatView(s, e.playerId).player.hand;
      if (!hand.length) break;
      const next = (id: string): Effect[] => [
        M("hand-discard", { playerId: e.playerId, id }),
        M("sanctions", {
          playerId: e.playerId,
          n: Number(e.n) - 1,
          actorId: e.playerId,
        }),
      ];
      if (hand.length === 1) ports.queue(s, ...next(hand[0].id));
      else
        ports.choose(
          s,
          name(SANCTIONS),
          "Discard a card from your hand.",
          hand.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: next(q.id),
          })),
        );
      break;
    }
    case "mdk:hand-discard":
      ports.discardFromHand(s, e.playerId, String(e.id));
      break;
    case "mdk:counter-off": {
      // Adaptoid's When Defeated: 1 all-purpose counter off an environment,
      // a Holding Cell's lock counter first.
      const cell = holdingCell(s);
      if (cell && cell.counters > 0) {
        ports.queue(s, M("unlock", { n: 1 }));
        break;
      }
      const other = (s.environments || []).find((q) => q.counters > 0);
      if (other) other.counters -= 1;
      break;
    }
    case "mdk:flying": {
      // Flying Inhuman: after it thwarts, 1 threat off another scheme.
      const schemes = [
        ...(e.target !== "main" && s.scheme.threat > 0
          ? [{ id: "main", label: name(s.scheme.code) }]
          : []),
        ...s.sideSchemes
          .filter((q) => q.id !== e.target && q.counters > 0)
          .map((q) => ({ id: q.id, label: name(q) })),
      ];
      if (!schemes.length) break;
      ports.choose(
        s,
        name(FLYING_INHUMAN),
        "Remove 1 threat from another scheme?",
        [
          ...schemes.map((c) => ({
            id: c.id,
            label: `Remove 1 threat from ${c.label}`,
            effects: [
              {
                type: "thwart",
                target: c.id,
                amount: 1,
                source: FLYING_INHUMAN,
              },
            ],
          })),
          { id: "pass", label: "Pass", effects: [] },
        ],
      );
      break;
    }
    case "mdk:psionic":
      if (!holdingCell(s)) break;
      ports.choose(
        s,
        name(PSIONIC_INHUMAN),
        "Remove 1 lock counter from the Holding Cell?",
        [
          {
            id: "unlock",
            label: "Remove 1 lock counter",
            effects: [M("unlock", { n: 1 })],
          },
          { id: "pass", label: "Pass", effects: [] },
        ],
      );
      break;
    case "mdk:after": {
      // After this activation; the boost card stays out of the discard pile
      // until then.
      const a = activation(s);
      if (!a) break;
      if (e.id && !a.retainedBoostIds?.includes(e.id))
        (a.retainedBoostIds ||= []).push(e.id);
      (a.afterActivation ||= []).push(...((e.effects as Effect[]) || []));
      break;
    }
    case "mdk:reshuffle": {
      const p = [...s.resolving, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      if (p) {
        ports.shuffleIntoEncounter(s, p);
        ports.log(s, "Adaptoid is shuffled into the encounter deck.", "bad");
      }
      break;
    }
    case "mdk:field-boost": {
      // Psionic Force Field as a boost attaches to the activating enemy.
      const enemy =
        e.enemyId === s.villain?.id
          ? s.villain
          : s.minions.find((m) => m.id === e.enemyId);
      if (enemy && activation(s)) ports.attachBoost(s, String(e.id), enemy.id);
      break;
    }
    case "mdk:machetes-boost":
      if (s.attack) s.attack.piercing = true;
      break;
    case "mdk:enhance":
      if (e.enemyId && activation(s))
        ports.giveBoost(s, String(e.enemyId), "current");
      break;
    default:
      throw Error(`Unknown M.O.D.O.K. effect: ${e.type}`);
  }
  return true;
}
