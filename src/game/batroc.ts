import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Agents of S.H.I.E.L.D.'s second scenario: the mercenary Batroc guards the
 * A.I.M. Island embassy. The players do not win by defeating him but by
 * advancing through the three stages of the main scheme: they break into the
 * embassy, free the captives held there and escape with them, while the
 * Alert Level rises. With the Batroc's Brigade modular set, which joins any
 * scenario with modular sets. */

export const BATROC_CODES = [
  "50086a",
  "50086b",
  "50087a",
  "50087b",
  "50088a",
  "50088b",
  "50089a",
  "50089b",
  "50090a",
  "50090b",
  "50091",
  "50092",
  "50093",
  "50094",
  "50095",
  "50096",
  "50097",
] as const;
export const BATROCS_BRIGADE_CODES = [
  "50098",
  "50099",
  "50100",
  "50101",
  "50102",
] as const;
/** The modular set, which joins any scenario with modular sets. */
export const BATROC_MODULAR_SETS = ["batrocs_brigade"] as const;
const ALL_CODES: readonly string[] = [
  ...BATROC_CODES,
  ...BATROCS_BRIGADE_CODES,
];

/** Batroc (A) for Standard, (B) for Expert: one card with two sides. */
const BATROCS = ["50086a", "50086b"];
export const INFILTRATE = "50087b";
const LOCATE_A = "50088a";
export const LOCATE = "50088b";
const EXTRACT_A = "50089a";
export const EXTRACT = "50089b";
export const ALERT_LOW = "50090a";
export const ALERT_HIGH = "50090b";
export const CAPTIVE = "50091";
export const REFLEXES = "50092";
const GUARD = "50093";
const PATROL = "50094";
const SECURITY_OFFICE = "50095";
const LEAPING_KICK = "50096";
const CAMERAS = "50097";
const MACHETE = "50098";
const RAPIDO = "50099";
const ZARAN = "50100";
export const BRIGADE = "50101";
const SOLDIERS = "50102";

export interface BatrocState {
  /** The main scheme stage in play. */
  currentMain: Piece;
  /** Facedown main scheme stages still to come (2A, then 3A). */
  mainDeck: Piece[];
  /** The Rescued Captive allies still set aside. */
  captives: Piece[];
  /** Locate Missing Person's Forced Interrupt is waiting for the players. */
  freeing?: boolean;
  /** Leaping Kick's attack gains overkill. */
  kick?: boolean;
}

export interface BatrocPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** Reveal an encounter card, removing it from its zone first. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  /** The characters a player controls: their identity, then their allies. */
  characters(s: GameState, playerId: string): string[];
  allies(s: GameState, playerId: string): Piece[];
  remainingHP(s: GameState, id: string): number;
  /** Put a Rescued Captive into play exhausted under a player's control. */
  putCaptive(s: GameState, p: Piece, playerId: string): void;
  /** Attach a boost card of the current activation to the villain. */
  attachBoost(s: GameState, id: string, enemyId: string): void;
  /** The players advance the main scheme to its next stage. */
  advanceMain(s: GameState): void;
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
const B = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `btc:${type}`,
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
/** Permanent cards cannot leave play (the hero runtime's test, without its
 * import cycle). */
const permanent = (p: Piece) => {
  const c = def(p) as (Card & { permanent?: boolean }) | undefined;
  return (
    c?.permanent === true ||
    /(?:^|[.\n])\s*Permanent\b/.test((c?.text || "").replace(/<[^>]*>/g, ""))
  );
};

export const batroc = (s: GameState) => !!s.batroc;
/** Batroc is the villain in play, with his text. */
const batrocInPlay = (s: GameState) =>
  !!s.villain && BATROCS.includes(s.villain.code) && active(s, s.villain);
export const alertLevel = (s: GameState) =>
  (s.environments || []).find(
    (p) => p.code === ALERT_LOW || p.code === ALERT_HIGH,
  );
/** Alert Level is on its High side. */
export const alertHigh = (s: GameState) => alertLevel(s)?.code === ALERT_HIGH;
/** The threat on Alert Level that flips it, or on its High side loses. */
export const alertLimit = (s: GameState) => 4 * s.playerCount;
const brigadeInPlay = (s: GameState) =>
  s.sideSchemes.some((p) => p.code === BRIGADE && active(s, p));
/** The main scheme's current stage, 1 to 3. */
export const batrocStage = (s: GameState) =>
  s.batroc ? s.scheme.index + 1 : 0;
/** Each Rescued Captive in play, with its controller. */
export function captivesInPlay(s: GameState) {
  return s.players
    .filter((seat) => !seat.eliminated)
    .flatMap((seat) =>
      seatView(s, seat.id)
        .player.inPlay.filter((p) => p.code === CAPTIVE)
        .map((p) => ({ p, playerId: seat.id })),
    );
}

// ------------------------------------------------------------- interface

/** The line under Batroc's stats. */
export const BATROC_CAPTION =
  "Never defeated: his hit points reset and 6 threat comes off the main scheme · +1 Alert after each attack";
/** Alert Level's caption: its threat against the limit and what follows. */
export function alertCaption(s: GameState) {
  const level = alertLevel(s);
  const n = level?.counters || 0;
  return alertHigh(s)
    ? `Alert ${n} of ${alertLimit(s)} · at the limit the players lose · Batroc +1 ATK and +1 SCH`
    : `Alert ${n} of ${alertLimit(s)} · at the limit it flips to High`;
}
/** The main scheme's note: how each stage is won and lost. */
export function batrocMainNote(s: GameState) {
  switch (s.scheme.code) {
    case INFILTRATE:
      return "Remove every threat to advance · completed: the players lose";
    case LOCATE:
      return `Remove every threat to free a captive (${s.batroc?.captives.length || 0} left), then advance or free another`;
    case EXTRACT:
      return `Remove every threat to escape and win · lose with no Rescued Captive in play (${captivesInPlay(s).length})`;
    default:
      return "";
  }
}

// --------------------------------------------------------------- setup

/** Infiltrate A.I.M. Island Embassy (1A): each Rescued Captive is set
 * aside, Alert Level enters play on its Low side (with 2 threat per player
 * in Expert), and the main scheme deck holds the next two stages. Batroc's
 * hit points are printed without a per-player icon. */
export function batrocSetup(
  s: GameState,
  ports: {
    makePiece(s: GameState, code: string): Piece;
    putEnvironment(s: GameState, p: Piece): void;
  },
) {
  const captives = s.encounter.deck.filter((p) => p.code === CAPTIVE);
  const level = s.encounter.deck.find(
    (p) => p.code === ALERT_LOW || p.code === ALERT_HIGH,
  );
  s.encounter.deck = s.encounter.deck.filter(
    (p) => p.code !== CAPTIVE && p !== level,
  );
  const quantity = def(CAPTIVE)?.quantity || 4;
  while (captives.length < quantity) captives.push(ports.makePiece(s, CAPTIVE));
  s.batroc = {
    currentMain: ports.makePiece(s, INFILTRATE),
    mainDeck: [ports.makePiece(s, LOCATE_A), ports.makePiece(s, EXTRACT_A)],
    captives,
  };
  const main = def(INFILTRATE);
  s.scheme.threat =
    (main?.base_threat || 0) * (main?.base_threat_fixed ? 1 : s.playerCount);
  const hp = def(s.villain.code)?.health || 0;
  s.villain.hp = hp;
  s.villain.maxHp = hp;
  const alert = level || ports.makePiece(s, ALERT_LOW);
  alert.code = ALERT_LOW;
  alert.counters = s.difficulty === "expert" ? 2 * s.playerCount : 0;
  ports.putEnvironment(s, alert);
}

// ------------------------------------------------------------ the villain

/** Batroc's Forced Interrupt when he would be defeated: his hit points
 * reset to 8 (12 in Expert) instead, then 6 threat comes off the main
 * scheme. A blank Batroc is defeated. */
export function batrocWouldBeDefeated(
  s: GameState,
): Effect[] | "defeated" | null {
  if (!s.batroc || !s.villain || !BATROCS.includes(s.villain.code)) return null;
  if (!active(s, s.villain)) return "defeated";
  const hp = def(s.villain.code)?.health || 0;
  s.villain.hp = hp;
  s.villain.maxHp = hp;
  s.villain.damage = 0;
  return [
    {
      type: "thwart",
      target: "main",
      amount: 6,
      source: s.villain.id,
    },
  ];
}
/** Batroc's and Zaran's stats: Alert Level's High side gives Batroc +1 ATK
 * and +1 SCH; Zaran gets +X ATK, X being the printed cost of the card
 * tucked under him. */
export function batrocEnemyStat(
  s: GameState,
  p: Piece,
  stat: "attack" | "scheme",
): number {
  let n = 0;
  if (
    s.batroc &&
    s.villain &&
    p.id === s.villain.id &&
    BATROCS.includes(p.code) &&
    active(s, p) &&
    alertHigh(s) &&
    active(s, alertLevel(s)!)
  )
    n += 1;
  if (stat === "attack" && p.code === ZARAN && active(s, p))
    n += (p.storedCards || []).reduce(
      (sum, q) => sum + Math.max(0, Number(def(q)?.cost) || 0),
      0,
    );
  return n;
}
/** Granted keywords: Extract Captives gives each minion quickstrike in
 * Expert, Batroc's Brigade gives each minion toughness, Machete's attacks
 * gain piercing and Rapido's ranged. */
export function batrocKeyword(s: GameState, p: Piece, keyword: string): number {
  const minion = s.minions.some((m) => m.id === p.id);
  if (
    keyword === "Quickstrike" &&
    minion &&
    s.batroc &&
    s.difficulty === "expert" &&
    s.scheme.code === EXTRACT &&
    active(s, s.batroc.currentMain)
  )
    return 1;
  if (keyword === "Toughness" && minion && brigadeInPlay(s)) return 1;
  if (keyword === "Piercing" && p.code === MACHETE && active(s, p)) return 1;
  if (keyword === "Ranged" && p.code === RAPIDO && active(s, p)) return 1;
  return 0;
}
/** Embassy Guard gains surge and Embassy Patrol incite 1 while Alert
 * Level is on its High side: the revealed card carries the keyword. */
export function batrocRevealCard(s: GameState, p: Piece, c: Card): Card {
  const level = alertLevel(s);
  if (!level || level.code !== ALERT_HIGH || !active(s, level)) return c;
  if (p.code === GUARD && !/^Surge\./m.test(c.text || ""))
    return { ...c, text: `Surge.\n${c.text || ""}` };
  if (p.code === PATROL && !/^Incite \d/m.test(c.text || ""))
    return { ...c, text: `Incite 1.\n${c.text || ""}` };
  return c;
}
/** Rapido's attacks deal indirect damage. */
export function batrocIndirectAttack(s: GameState, id: string): boolean {
  const p = s.minions.find((m) => m.id === id);
  return !!p && p.code === RAPIDO && active(s, p);
}
/** Heightened Reflexes' Forced Interrupt when Batroc would take damage: 2 of
 * it is prevented and a leap counter comes off; with none left it is
 * discarded. Returns the damage he still takes. */
export function batrocDamageTaken(
  s: GameState,
  target: string,
  n: number,
  ports: Pick<BatrocPorts, "discardPiece" | "log">,
): number {
  if (n <= 0 || !s.villain || target !== s.villain.id) return n;
  const reflexes = s.attachments.find(
    (a) => a.code === REFLEXES && a.attachedTo === target && active(s, a),
  );
  if (!reflexes) return n;
  const prevented = Math.min(2, n);
  reflexes.counters = Math.max(0, (reflexes.counters || 0) - 1);
  ports.log(
    s,
    `Heightened Reflexes prevents ${prevented} damage (${reflexes.counters} leap counters left).`,
    "bad",
  );
  if (!reflexes.counters) ports.discardPiece(s, reflexes.id);
  return n - prevented;
}
/** Leaping Kick's attack gains overkill. */
export function batrocAttackInitiated(s: GameState, attackerId: string) {
  const st = s.batroc;
  if (!st?.kick || !s.attack || attackerId !== s.villain?.id) return [];
  delete st.kick;
  s.attack.overkill = true;
  return [];
}
/** Batroc's Forced Response after he attacks: 1 threat on Alert Level. */
export function batrocAttacked(s: GameState, attackerId: string): Effect[] {
  if (!s.batroc || attackerId !== s.villain?.id || !batrocInPlay(s)) return [];
  return [B("alert-up", { n: 1 })];
}
/** Extract Captives' Forced Interrupt: an enemy attack goes to a Rescued
 * Captive instead. The choices, or none. */
export function batrocAttackRedirect(
  s: GameState,
  target: string | undefined,
): { p: Piece; playerId: string }[] {
  if (
    !s.batroc ||
    s.scheme.code !== EXTRACT ||
    !active(s, s.batroc.currentMain)
  )
    return [];
  const captives = captivesInPlay(s);
  if (!captives.length || captives.some(({ p }) => p.id === target)) return [];
  return captives;
}

// -------------------------------------------------------- Rescued Captive

/** Rescued Captives do not count against the ally limit. */
export const batrocAllyExcluded = (s: GameState, p: Piece) =>
  p.code === CAPTIVE && active(s, p);
/** Victory -1: a defeated Rescued Captive enters the victory display. */
export const batrocVictoryAlly = (s: GameState, p: Piece) =>
  p.code === CAPTIVE && active(s, p);

// ------------------------------------------------------------------ checks

/** Alert Level's constant abilities, Extract Captives' win and loss, and
 * the Forced Interrupts when the last threat leaves a main scheme stage.
 * Returns true when the game ended. */
export function batrocCheck(s: GameState, ports: BatrocPorts): boolean {
  const st = s.batroc;
  if (!st || ["won", "lost"].includes(s.phase)) return false;
  const level = alertLevel(s);
  if (level && active(s, level) && level.counters >= alertLimit(s)) {
    if (level.code === ALERT_HIGH) {
      ports.endGame(
        s,
        false,
        "The Alert Level peaks. The embassy is locked down and the heroes are caught.",
      );
      return true;
    }
    // Low: remove all threat from here and flip this card.
    level.counters = 0;
    level.code = ALERT_HIGH;
    ports.log(s, "Alert Level flips to its High side.", "bad");
  }
  if (s.pendingMainCompletion || !active(s, st.currentMain)) return false;
  if (st.currentMain.code === EXTRACT) {
    if (!captivesInPlay(s).length) {
      ports.endGame(
        s,
        false,
        "No Rescued Captive is left in play. The heroes fail to extract the captives.",
      );
      return true;
    }
    if (s.scheme.threat <= 0) {
      ports.endGame(
        s,
        true,
        "There is no threat on Extract Captives. The heroes escape the embassy with the captives.",
      );
      return true;
    }
    return false;
  }
  if (s.scheme.threat > 0) return false;
  if (st.currentMain.code === INFILTRATE) {
    ports.advanceMain(s);
    return false;
  }
  if (st.currentMain.code === LOCATE && !st.freeing) {
    st.freeing = true;
    ports.queue(s, B("free", { actorId: s.firstPlayerId }));
  }
  return false;
}

// ------------------------------------------------------------- main scheme

/** The next main scheme stage's A side, for the engine to put in play. */
export function batrocNextMain(s: GameState): Piece | undefined {
  return s.batroc?.mainDeck.shift();
}
/** When Revealed abilities of the next stage's A side, then its B side. */
export function batrocMainRevealed(s: GameState, p: Piece): Effect[] {
  return [
    ...(p.code === EXTRACT_A ? [B("extract")] : []),
    B("main-back", { actorId: s.firstPlayerId }),
  ];
}

// ----------------------------------------------------------------- actions

/** Hero Actions: Alert Level's (spend 1 resource: 1 threat off it) and each
 * Rescued Captive's (exhaust it: 1 threat per player off the main scheme). */
export function batrocActions(
  s: GameState,
  p: Piece,
  ports?: Pick<BatrocPorts, "canPay">,
): Option[] {
  if (s.phase !== "player" || s.player.form !== "hero" || !active(s, p))
    return [];
  if (p.code === ALERT_LOW || p.code === ALERT_HIGH) {
    if (!(p.counters > 0) || (ports && !ports.canPay(s, 1, []))) return [];
    return [
      {
        id: "lower",
        label:
          "Hero Action · spend 1 resource · remove 1 threat from Alert Level",
        image: p.code,
        effects: [B("alert-pay", { actorId: s.activePlayerId })],
      },
    ];
  }
  if (
    p.code === CAPTIVE &&
    !p.exhausted &&
    s.player.inPlay.some((q) => q.id === p.id)
  )
    return [
      {
        id: "rescue",
        label: `Hero Action · exhaust · remove ${s.playerCount} threat from the main scheme`,
        image: p.code,
        effects: [
          { type: "exhaust", id: p.id },
          {
            type: "thwart",
            target: "main",
            amount: s.playerCount,
            source: CAPTIVE,
          },
        ],
      },
    ];
  return [];
}
export function batrocActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return (
    (s.environments || []).find(
      (p) => p.id === id && (p.code === ALERT_LOW || p.code === ALERT_HIGH),
    ) || s.player.inPlay.find((p) => p.id === id && p.code === CAPTIVE)
  );
}

// ----------------------------------------------------------------- windows

/** Batroc's Brigade's Hero Interrupt when you reveal a non-Elite minion:
 * spend 3 resources to cancel its effects and discard it. */
export function batrocRevealInterrupts(
  s: GameState,
  p: Piece,
  revealingId: string,
  canPay: (s: GameState, playerId: string, cost: number) => boolean,
): Option[] {
  const c = def(p);
  if (
    !brigadeInPlay(s) ||
    c?.type_code !== "minion" ||
    traits(p).includes("Elite") ||
    !alive(s, revealingId) ||
    !canPay(s, revealingId, 3)
  )
    return [];
  return [
    {
      id: "batrocs-brigade",
      label: `Batroc's Brigade · spend 3 resources · cancel and discard ${c.name}`,
      image: BRIGADE,
      effects: [
        {
          type: "payRequest",
          actorId: revealingId,
          title: "Batroc's Brigade",
          cost: 3,
          after: [{ type: "cancelEncounter", actorId: revealingId, piece: p }],
        },
      ],
    },
  ];
}
/** Read before a minion leaves play: the card tucked under Zaran goes to
 * its owner's discard pile. */
export function batrocMinionDefeating(s: GameState, m: Piece) {
  if (m.code !== ZARAN || !m.storedCards?.length) return;
  for (const q of m.storedCards.splice(0)) {
    const owner = s.players.find(
      (seat) => seat.id === q.ownerId && !seat.eliminated,
    );
    if (owner) seatView(s, owner.id).player.discard.push(q);
    else s.removed.push(q);
  }
}
/** When Defeated: Embassy Guard and Embassy Patrol place 1 threat on Alert
 * Level, and Machete is shuffled into the encounter deck. */
export function batrocMinionDefeated(
  s: GameState,
  m: Piece,
  textWasBlank: boolean,
): Effect[] {
  if (textWasBlank) return [];
  if (m.code === GUARD || m.code === PATROL)
    return [B("alert-up", { n: 1, source: m.code })];
  if (m.code === MACHETE) return [B("machete", { id: m.id })];
  return [];
}
/** Alert Level's Forced Response after a character is defeated, except by
 * consequential damage: 1 threat on it. */
export function batrocCharacterDefeated(
  s: GameState,
  source: string,
): Effect[] {
  const level = alertLevel(s);
  if (!s.batroc || !level || !active(s, level) || source === "consequential")
    return [];
  return [B("alert-up", { n: 1 })];
}
/** Commandeer Security Office's When Defeated: 1 threat per player off
 * Alert Level. */
export function batrocSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (p.code !== SECURITY_OFFICE || !active(s, p)) return [];
  return [B("alert-down", { n: s.playerCount })];
}

// ----------------------------------------------------------------- reveals

export function batrocReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  // Heightened Reflexes attaches to Batroc with 4 leap counters.
  if (p.code === REFLEXES)
    return resolving ? [B("reflexes", { piece: p })] : [];
  if (isTextBlank(s, p)) return [];
  const hero = seatView(s, playerId).player.form === "hero";
  switch (p.code) {
    case SECURITY_OFFICE:
      return [B("office", { id: p.id })];
    case LEAPING_KICK:
      return hero
        ? [B("kick", { playerId })]
        : [B("activate", { playerId, kind: "scheme" })];
    case CAMERAS:
      return hero
        ? [B("cameras", { playerId, used: [] })]
        : [
            B("alert-down", { n: 1 }),
            { type: "surge", sourceCode: p.code, sourceId: p.id },
          ];
    case RAPIDO:
      return [B("rapido", { playerId })];
    case ZARAN:
      return [B("zaran", { id: p.id, playerId })];
    case BRIGADE:
      return [B("brigade")];
    case SOLDIERS:
      return [B("soldiers", { playerId, actorId: playerId })];
    default:
      return [];
  }
}
export function batrocBoost(s: GameState, p: Piece): Effect[] | null {
  if (![REFLEXES, RAPIDO, SOLDIERS].includes(p.code)) return null;
  if (isTextBlank(s, p) || !activation(s)) return [];
  const playerId = boostPlayer(s);
  switch (p.code) {
    case REFLEXES:
      return [B("reflexes-boost", { id: p.id })];
    case RAPIDO:
      return [B("rapido", { playerId })];
    default:
      return [B("soldiers-boost", { id: p.id, playerId, actorId: playerId })];
  }
}
/** Soldiers of Fortune's chosen boost icons. */
export function batrocBoostIcons(s: GameState, p: Piece): number {
  const a = activation(s);
  return a ? Number(s.flags[`btcIcons:${a.id}:${p.id}`] || 0) : 0;
}

// ---------------------------------------------------------------- resolver

export function resolveBatrocEffect(
  s: GameState,
  e: Effect,
  ports: BatrocPorts,
): boolean {
  if (!e.type.startsWith("btc:")) return false;
  const st = s.batroc;
  switch (e.type) {
    case "btc:alert-up": {
      const level = alertLevel(s);
      if (!level || !active(s, level)) break;
      level.counters = (level.counters || 0) + Number(e.n);
      ports.log(
        s,
        `+${e.n} threat on Alert Level (${level.counters} of ${alertLimit(s)}).`,
        "bad",
      );
      break;
    }
    case "btc:alert-down": {
      const level = alertLevel(s);
      if (!level || !active(s, level)) break;
      const n = Math.min(level.counters || 0, Number(e.n));
      level.counters = (level.counters || 0) - n;
      if (n) ports.log(s, `${n} threat comes off Alert Level.`, "good");
      break;
    }
    case "btc:alert-pay":
      ports.pay(
        s,
        1,
        [],
        [B("alert-down", { n: 1 })],
        "Alert Level · spend 1 resource",
        true,
      );
      break;
    case "btc:main-back": {
      // Flip the new stage to its B side, with its starting threat.
      if (!st) break;
      const main = st.currentMain;
      const back = def(main)?.back_link;
      if (back) main.code = back;
      s.scheme.code = main.code;
      const c = def(main);
      s.scheme.threat =
        (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
      break;
    }
    case "btc:free": {
      // Locate Missing Person (2B): put a set-aside Rescued Captive into
      // play exhausted under any player's control, then the players may
      // advance; otherwise 3 threat per player here.
      if (!st) break;
      const captive = st.captives[0];
      const players = seats(s);
      if (captive && players.length === 1)
        ports.queue(
          s,
          B("captive", { playerId: players[0].id }),
          B("advance-choice"),
        );
      else if (captive)
        ports.choose(
          s,
          name(LOCATE),
          "Put a Rescued Captive into play exhausted under a player's control.",
          players.map((seat) => ({
            id: seat.id,
            label: `${ports.heroName(s, seat.id)} takes it`,
            effects: [B("captive", { playerId: seat.id }), B("advance-choice")],
          })),
        );
      else ports.queue(s, B("advance-choice"));
      break;
    }
    case "btc:captive": {
      if (!st || !alive(s, e.playerId)) break;
      const p = st.captives.shift();
      if (!p) break;
      ports.putCaptive(s, p, e.playerId);
      ports.log(s, "A Rescued Captive joins the heroes.", "good");
      break;
    }
    case "btc:advance-choice": {
      if (!st) break;
      const stay: Option = {
        id: "stay",
        label: `Free another captive · place ${3 * s.playerCount} threat here`,
        effects: [B("stay")],
      };
      const advance: Option = {
        id: "advance",
        label: "Advance to Extract Captives",
        effects: [B("advance")],
      };
      // Advancing with no Rescued Captive in play loses at once.
      ports.choose(
        s,
        name(LOCATE),
        "Advance to stage 3, or stay to free another captive.",
        captivesInPlay(s).length ? [advance, stay] : [stay, advance],
      );
      break;
    }
    case "btc:stay":
      // The Forced Interrupt can trigger again once the threat is placed.
      if (!st) break;
      ports.queue(
        s,
        { type: "threat", target: "main", amount: 3 * s.playerCount },
        B("freed"),
      );
      break;
    case "btc:freed":
      if (st) delete st.freeing;
      break;
    case "btc:advance":
      if (!st) break;
      delete st.freeing;
      ports.advanceMain(s);
      break;
    case "btc:extract": {
      // Extract Captives (3A): with Alert Level on its High side, each player
      // is dealt a facedown encounter card; otherwise all its threat comes
      // off and it flips to High. In Expert, 2 threat per player on it.
      const level = alertLevel(s);
      if (level && active(s, level)) {
        if (level.code === ALERT_HIGH)
          for (const seat of seats(s)) ports.dealEncounter(s, seat.id);
        else {
          level.counters = 0;
          level.code = ALERT_HIGH;
          ports.log(s, "Alert Level flips to its High side.", "bad");
        }
      }
      if (s.difficulty === "expert")
        ports.queue(s, B("alert-up", { n: 2 * s.playerCount }));
      break;
    }
    case "btc:reflexes": {
      const p = e.piece as Piece;
      if (s.villain) {
        p.counters = 4;
        ports.attach(s, p, s.villain.id);
        p.counters = 4;
      } else ports.discardPiece(s, p.id);
      break;
    }
    case "btc:reflexes-boost": {
      if (!s.villain || !activation(s)) break;
      ports.attachBoost(s, String(e.id), s.villain.id);
      break;
    }
    case "btc:office": {
      // When Revealed: with Alert Level on its High side, an acceleration
      // token here.
      const p = s.sideSchemes.find((q) => q.id === e.id);
      if (p && alertHigh(s))
        p.accelerationTokens = Number(p.accelerationTokens || 0) + 1;
      break;
    }
    case "btc:activate":
      if (!alive(s, e.playerId) || !s.villain) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
      });
      break;
    case "btc:kick": {
      // Leaping Kick (hero): Batroc attacks the ally with the most remaining
      // hit points, with overkill; with no ally in play, he attacks you.
      if (!alive(s, e.playerId) || !s.villain) break;
      const allies = seats(s).flatMap((seat) =>
        ports.allies(s, seat.id).map((q) => ({ q, playerId: seat.id })),
      );
      if (!allies.length) {
        ports.queue(s, B("activate", { playerId: e.playerId, kind: "attack" }));
        break;
      }
      const most = Math.max(...allies.map((a) => ports.remainingHP(s, a.q.id)));
      const tied = allies.filter((a) => ports.remainingHP(s, a.q.id) === most);
      const attack = (a: { q: Piece; playerId: string }): Effect =>
        B("kick-attack", { allyId: a.q.id, playerId: a.playerId });
      if (tied.length === 1) ports.queue(s, attack(tied[0]));
      else
        ports.choose(
          s,
          name(LEAPING_KICK),
          "Batroc attacks the ally with the most remaining hit points.",
          tied.map((a) => ({
            id: a.q.id,
            label: name(a.q),
            image: a.q.code,
            effects: [attack(a)],
          })),
        );
      break;
    }
    case "btc:kick-attack":
      if (!st || !alive(s, e.playerId) || !s.villain) break;
      st.kick = true;
      // A stunned Batroc does not attack: the overkill does not carry over.
      ports.queue(
        s,
        {
          type: "enemyAttack",
          id: s.villain.id,
          actorId: e.playerId,
          originalTarget: e.allyId,
        },
        B("kick-end"),
      );
      break;
    case "btc:kick-end":
      if (st) delete st.kick;
      break;
    case "btc:cameras": {
      // Security Cameras (hero): for each character you control, exhaust it
      // or place 1 threat on Alert Level (2 on its High side).
      if (!alive(s, e.playerId)) break;
      const used = (e.used as string[]) || [];
      const view = seatView(s, e.playerId).player;
      const c = ports.characters(s, e.playerId).find((x) => !used.includes(x));
      if (!c) break;
      const next = B("cameras", { playerId: e.playerId, used: [...used, c] });
      const n = alertHigh(s) ? 2 : 1;
      const ally = c.startsWith("hero:")
        ? undefined
        : view.inPlay.find((q) => q.id === c);
      const ready = ally ? !ally.exhausted : !view.exhausted;
      const label = ally ? name(ally) : "your identity";
      if (!ready) {
        ports.queue(s, B("alert-up", { n }), next);
        break;
      }
      ports.choose(
        s,
        name(CAMERAS),
        `Exhaust ${label}, or place ${n} threat on Alert Level.`,
        [
          {
            id: "exhaust",
            label: `Exhaust ${label}`,
            effects: [
              {
                type: "exhaust",
                id: ally ? ally.id : "hero",
                actorId: e.playerId,
              },
              next,
            ],
          },
          {
            id: "alert",
            label: `Place ${n} threat on Alert Level`,
            effects: [B("alert-up", { n }), next],
          },
        ],
      );
      break;
    }
    case "btc:machete": {
      // When Defeated: shuffle Machete into the encounter deck.
      const p = s.encounter.discard.find((q) => q.id === e.id);
      if (p) {
        ports.shuffleIntoEncounter(s, p);
        ports.log(s, "Machete is shuffled into the encounter deck.", "bad");
      }
      break;
    }
    case "btc:rapido":
      // 1 damage to each character you control.
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        ...ports.characters(s, e.playerId).map((target) => ({
          type: "damage",
          target: target.startsWith("hero:") ? "hero" : target,
          amount: 1,
          source: RAPIDO,
          actorId: e.playerId,
        })),
      );
      break;
    case "btc:zaran": {
      // Tuck a Weapon upgrade you control under Zaran; otherwise the top
      // card of your deck.
      const zaran = s.minions.find((m) => m.id === e.id);
      if (!zaran || !alive(s, e.playerId)) break;
      const view = seatView(s, e.playerId).player;
      // A Permanent upgrade cannot leave play.
      const weapons = view.inPlay.filter(
        (q) =>
          def(q)?.type_code === "upgrade" &&
          traits(q).includes("Weapon") &&
          !permanent(q),
      );
      const tuck = (q: Piece): Effect =>
        B("zaran-tuck", { id: e.id, card: q.id, playerId: e.playerId });
      if (!weapons.length) {
        ports.queue(s, B("zaran-top", { id: e.id, playerId: e.playerId }));
        break;
      }
      if (weapons.length === 1) ports.queue(s, tuck(weapons[0]));
      else
        ports.choose(
          s,
          name(ZARAN),
          "Tuck a Weapon upgrade you control under Zaran.",
          weapons.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [tuck(q)],
          })),
        );
      break;
    }
    case "btc:zaran-tuck": {
      // The upgrade leaves play, then goes under Zaran instead of the
      // discard pile.
      const zaran = s.minions.find((m) => m.id === e.id);
      const view = seatView(s, e.playerId).player;
      if (!zaran || !view.inPlay.some((q) => q.id === e.card)) break;
      ports.discardPiece(s, String(e.card));
      const i = view.discard.findIndex((q) => q.id === e.card);
      if (i < 0) break;
      const [q] = view.discard.splice(i, 1);
      q.ownerId ||= e.playerId;
      (zaran.storedCards ||= []).push(q);
      ports.log(s, `${name(q)} is tucked under Zaran.`, "bad");
      break;
    }
    case "btc:zaran-top": {
      const zaran = s.minions.find((m) => m.id === e.id);
      const view = seatView(s, e.playerId).player;
      if (!zaran || !view.deck.length) break;
      const q = view.deck.shift()!;
      q.ownerId ||= e.playerId;
      (zaran.storedCards ||= []).push(q);
      ports.log(s, `The top card of the deck is tucked under Zaran.`, "bad");
      break;
    }
    case "btc:brigade":
      // When Revealed: each enemy gets a tough status card.
      ports.queue(
        s,
        ...[s.villain, ...s.minions]
          .filter((m): m is Piece => !!m && !m.tough)
          .map((m) => ({ type: "status", target: m.id, status: "tough" })),
      );
      break;
    case "btc:soldiers": {
      // Choose: spend 3 resources, or find a Mercenary minion and reveal it;
      // if no minion entered play this way, this card gains surge.
      if (!alive(s, e.playerId)) break;
      const options: Option[] = [
        {
          id: "find",
          label: "Find a Mercenary minion and reveal it",
          effects: [B("mercenary", { playerId: e.playerId })],
        },
      ];
      if (ports.canPay(s, 3, []))
        options.push({
          id: "spend",
          label: "Spend 3 resources",
          effects: [
            B("soldiers-pay", { playerId: e.playerId, actorId: e.playerId }),
          ],
        });
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else ports.choose(s, name(SOLDIERS), "Choose one.", options);
      break;
    }
    case "btc:soldiers-pay":
      ports.pay(s, 3, [], [], "Soldiers of Fortune · spend 3 resources", false);
      break;
    case "btc:mercenary": {
      const found = [...s.encounter.deck, ...s.encounter.discard].filter(
        (q) =>
          def(q)?.type_code === "minion" && traits(q).includes("Mercenary"),
      );
      const choices = found.filter(
        (q, i) => found.findIndex((x) => x.code === q.code) === i,
      );
      const surge: Effect = {
        type: "surge",
        sourceCode: SOLDIERS,
      };
      if (!choices.length) {
        ports.queue(s, surge);
        break;
      }
      const reveal = (q: Piece): Effect[] => [
        B("mercenary-reveal", { id: q.id, playerId: e.playerId }),
        B("mercenary-check", { id: q.id }),
      ];
      if (choices.length === 1) ports.queue(s, ...reveal(choices[0]));
      else
        ports.choose(
          s,
          name(SOLDIERS),
          "Find a Mercenary minion and reveal it.",
          choices.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: reveal(q),
          })),
        );
      break;
    }
    case "btc:mercenary-reveal": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      if (!p || !alive(s, e.playerId)) break;
      const fromDeck = s.encounter.deck.some((q) => q.id === p.id);
      ports.reveal(s, p, e.playerId);
      if (fromDeck) ports.shuffleEncounter(s);
      break;
    }
    case "btc:mercenary-check":
      if (!s.minions.some((m) => m.id === e.id))
        ports.queue(s, { type: "surge", sourceCode: SOLDIERS });
      break;
    case "btc:soldiers-boost": {
      // Choose: spend 1 resource, or this card gains three boost icons.
      if (!activation(s) || !alive(s, e.playerId)) break;
      const options: Option[] = [
        {
          id: "icons",
          label: "Soldiers of Fortune gains three boost icons",
          effects: [B("icons", { id: e.id, n: 3 })],
        },
      ];
      if (ports.canPay(s, 1, []))
        options.push({
          id: "spend",
          label: "Spend 1 resource",
          effects: [
            B("soldiers-boost-pay", {
              playerId: e.playerId,
              actorId: e.playerId,
            }),
          ],
        });
      if (options.length === 1) ports.queue(s, ...options[0].effects);
      else ports.choose(s, name(SOLDIERS), "Choose one.", options);
      break;
    }
    case "btc:soldiers-boost-pay":
      ports.pay(s, 1, [], [], "Soldiers of Fortune · spend 1 resource", false);
      break;
    case "btc:icons": {
      const a = activation(s);
      if (!a) break;
      const key = `btcIcons:${a.id}:${e.id}`;
      s.flags[key] = Number(s.flags[key] || 0) + Number(e.n);
      (a.afterActivation ||= []).push(B("clear-icons", { key }));
      break;
    }
    case "btc:clear-icons":
      delete s.flags[String(e.key)];
      break;
    default:
      throw Error(`Unknown Batroc effect: ${e.type}`);
  }
  return true;
}
