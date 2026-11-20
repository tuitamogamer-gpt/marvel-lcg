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

/** Trickster Takeover's second scenario in Single Group Mode: Loki, God of
 * Lies hides beyond the heroes' reach while his Avatars spread mischief and
 * mayhem. Each Avatar that would be defeated shatters an illusion, and only
 * the shatter counters it gathered ever wound the God of Lies. */

export const GOD_OF_LIES_CODES = [
  "55027a",
  "55027b",
  "55028a",
  "55028b",
  "55029a",
  "55029b",
  "55030a",
  "55030b",
  "55031a",
  "55031b",
  "55032a",
  "55032b",
  "55033a",
  "55033b",
  "55034a",
  "55034b",
  "55035",
  "55036",
  "55037",
  "55038",
  "55039",
  "55040",
  "55041",
  "55042",
  "55043",
  "55044",
  "55045",
  "55046",
  "55047",
  "55048",
  "55049",
  "55050",
  "55051",
  "55052",
  "55053",
  "55054",
  "55055",
] as const;

/** Loki, God of Lies, outside the group's game area. */
export const LOKI = "55027a";
export const LOKI_FLIPPED = "55027b";
export const WORLDS = "55028b";
export const RASCAL = "55029a";
export const MISCREANT = "55030a";
export const KNAVE = "55031a";
export const WRETCH = "55032a";
/** The Avatars of Loki, each with its Fading Figment on the back. */
export const AVATARS = [RASCAL, MISCREANT, KNAVE, WRETCH];
export const FIGMENT_OF: Record<string, string> = {
  [RASCAL]: "55029b",
  [MISCREANT]: "55030b",
  [KNAVE]: "55031b",
  [WRETCH]: "55032b",
};
export const FIGMENTS = Object.values(FIGMENT_OF);
export const MISCHIEF = "55033b";
export const INTENSE = "55034a";
export const TOTAL = "55034b";
export const CHAINS = "55035";
export const SCEPTER = "55036";
const DRAUGR = "55037";
const GRENDELL = "55038";
const MALEKITH = "55039";
const MINOTAUR = "55040";
const MANGOG = "55041";
const FENRIS = "55042";
const HRAESVELGR = "55043";
const LAUFEY = "55044";
const AURA = "55045";
export const DOOR = "55046";
const LOFTY = "55047";
const JOTUNHEIM = "55048";
const DARK_ARTS = "55049";
const DIRTY = "55050";
const STORIES = "55051";
export const DOMINEERING = "55052";
export const FEIGNED = "55053";
export const MOUNTING = "55054";
export const UNIFIED = "55055";
/** The Synergy environments, put into play at setup. */
export const SYNERGY = [DOMINEERING, FEIGNED, MOUNTING, UNIFIED];
/** The environment each Fading Figment fills with synergy counters. */
const FIGMENT_SYNERGY: Record<string, string> = {
  "55029b": UNIFIED,
  "55030b": MOUNTING,
  "55031b": DOMINEERING,
  "55032b": FEIGNED,
};
/** The encounter cards scripted here: everything shuffled into the deck. */
export const GOD_OF_LIES_SCRIPT_CODES: readonly string[] = [
  CHAINS,
  SCEPTER,
  DRAUGR,
  GRENDELL,
  MALEKITH,
  MINOTAUR,
  MANGOG,
  FENRIS,
  HRAESVELGR,
  LAUFEY,
  AURA,
  DOOR,
  LOFTY,
  JOTUNHEIM,
  DARK_ARTS,
  DIRTY,
  STORIES,
];
/** Door Between Worlds: Victory 1. */
export const GOD_OF_LIES_VICTORY_SCHEMES = [DOOR];
/** Worlds Collide's target threat: 2 per group, one group here. */
export const WORLDS_TARGET = 2;

export interface GodOfLiesState {
  /** Loki, God of Lies and his hit point dial. */
  loki: { code: string; hp: number; maxHp: number };
  /** Threat on Worlds Collide. */
  worlds: number;
  /** Shatter counters on the Avatar of Loki in play. */
  shatter: number;
  /** The set-aside Avatars of Loki, Avatar side up. */
  avatars: string[];
  /** Intense Focus while it is set aside (Standard). */
  focus?: Piece;
  /** The hit points Intense or Total Focus currently adds. */
  bonus: number;
  /** Worlds Collide reached its target during a player phase: unless Loki
   * falls first, the players lose when the phase ends. */
  doomed?: boolean;
  /** Treacheries resolving, with the player who revealed each. */
  resolving?: Record<string, string>;
  /** Players whose defeated identity changes to alter-ego once the attack,
   * activation or card in progress has finished. */
  alterEgo?: string[];
}

export interface GodOfLiesPorts extends MutagenEnginePorts {
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
  endGame(s: GameState, won: boolean, reason: string): void;
  putEnvironment(s: GameState, p: Piece): void;
  canAddStatus(
    s: GameState,
    target: string,
    status: "stunned" | "confused" | "tough",
  ): boolean;
  /** Deal an actual encounter card to a player facedown. */
  dealFacedown(s: GameState, p: Piece, playerId: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const G = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `gol:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const over = (s: GameState) => ["won", "lost"].includes(s.phase);
const expert = (s: GameState) => s.difficulty === "expert";
const activation = (s: GameState) => s.scheming || s.attack;
const boostPlayer = (s: GameState) =>
  s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const identityOf = (playerId: string) => `hero:${playerId}`;
const treachery = (p?: Piece) => !!p && def(p)?.type_code === "treachery";
const RESOURCE_TYPES: Resource[] = ["energy", "mental", "physical"];

export const godOfLies = (s: GameState) => !!s.godOfLies;
/** An Avatar of Loki is the villain in play (not his Fading Figment). */
export const avatarInPlay = (s: GameState) =>
  !!s.godOfLies && !!s.villain && AVATARS.includes(s.villain.code);
const avatarActive = (s: GameState, code: string) =>
  avatarInPlay(s) && s.villain.code === code && active(s, s.villain);
const villainAttachment = (s: GameState, codes: string[]) =>
  s.attachments.find(
    (a) =>
      codes.includes(a.code) && a.attachedTo === s.villain?.id && active(s, a),
  );
/** Intense or Total Focus on the Avatar of Loki. */
const focusInPlay = (s: GameState) =>
  avatarInPlay(s) ? villainAttachment(s, [INTENSE, TOTAL]) : undefined;
/** Dark Scepter on the Avatar of Loki. */
const scepterInPlay = (s: GameState) =>
  !!s.godOfLies && !!villainAttachment(s, [SCEPTER]);
const synergy = (s: GameState, code: string) =>
  (s.environments || []).find((p) => p.code === code && active(s, p));
/** Max 1 synergy counter per player on each Synergy environment. */
const synergyMax = (s: GameState) => s.playerCount;
const characters = (s: GameState, playerId: string) =>
  1 +
  seatView(s, playerId).player.inPlay.filter(
    (q) => def(q)?.type_code === "ally",
  ).length;

// ------------------------------------------------------------- interface

/** The objective: Loki, God of Lies's hit points and Worlds Collide. */
export function godOfLiesObjective(s: GameState) {
  const st = s.godOfLies;
  if (!st) return "";
  return `Defeat Loki, God of Lies · ${Math.max(0, st.loki.hp)} of ${st.loki.maxHp} hit points · Worlds Collide ${st.worlds} of ${WORLDS_TARGET}`;
}
const AVATAR_TEXT: Record<string, string> = {
  [RASCAL]:
    "A treachery boost in his activation: deal it to yourself facedown or spend 1 resource",
  [MISCREANT]:
    "After you resolve a treachery: 1 threat here and 1 on a side scheme",
  [KNAVE]:
    "After you resolve a treachery: 1 damage to your identity and to an ally",
  [WRETCH]:
    "Activating: discard the top encounter card, +1 SCH and ATK for a treachery",
};
/** The Avatar's caption: his shatter counters and his Forced ability. */
export function godOfLiesCaption(s: GameState) {
  const st = s.godOfLies;
  if (!st || !s.villain) return "";
  if (!AVATARS.includes(s.villain.code)) return "The illusion is shattering";
  return `${plural(st.shatter, "shatter counter")} · ${AVATAR_TEXT[s.villain.code]}`;
}
export function godOfLiesMainNote(s: GameState) {
  if (!s.godOfLies || s.scheme.code !== MISCHIEF) return "";
  return "Completed: 1 threat on Worlds Collide instead";
}
/** What removing a synergy counter from a Synergy environment does. */
export function synergyUse(p: Piece) {
  return p.code === DOMINEERING
    ? "an attack deals 4 more damage"
    : p.code === FEIGNED
      ? "prevent 4 damage to an identity"
      : p.code === MOUNTING
        ? "a thwart removes 4 more threat"
        : p.code === UNIFIED
          ? "2 wild resources"
          : "";
}
/** A Synergy environment's caption: its counters and their use. */
export function synergyCaption(s: GameState, p: Piece) {
  if (!SYNERGY.includes(p.code)) return "";
  return `${p.counters || 0} of ${synergyMax(s)} synergy counters · remove 1: ${synergyUse(p)}`;
}
/** Worlds Collide and Loki, God of Lies for the scenario panel. */
export function godOfLiesPanel(s: GameState) {
  const st = s.godOfLies;
  if (!st) return null;
  return {
    loki: st.loki.code,
    hp: Math.max(0, st.loki.hp),
    maxHp: st.loki.maxHp,
    flipAt: 10 * s.playerCount,
    worlds: st.worlds,
    target: WORLDS_TARGET,
    shatter: st.shatter,
    avatars: [...st.avatars],
    doomed: !!st.doomed,
  };
}

// --------------------------------------------------------------- setup

/** Worlds Collide (A) and Mischief and Mayhem (1A): a random Avatar of Loki
 * in play, the others set aside; each Synergy environment in play; Intense
 * Focus set aside in Standard and attached to the Avatar in Expert. */
export function godOfLiesSetup(
  s: GameState,
  ports: Pick<GodOfLiesPorts, "shuffle" | "makePiece" | "putEnvironment">,
) {
  const players = s.playerCount;
  const take = (code: string) => {
    const i = s.encounter.deck.findIndex((p) => p.code === code);
    return i >= 0 ? s.encounter.deck.splice(i, 1)[0] : ports.makePiece(s, code);
  };
  const focus = take(INTENSE);
  focus.exhausted = false;
  focus.counters = 0;
  s.encounter.deck = s.encounter.deck.filter(
    (p) =>
      p.code !== INTENSE &&
      p.code !== TOTAL &&
      !SYNERGY.includes(p.code) &&
      !AVATARS.includes(p.code) &&
      !FIGMENTS.includes(p.code),
  );
  const order = ports.shuffle(s, [...AVATARS]);
  s.villain.code = order[0];
  s.villain.maxHp = (def(order[0])?.health || 15) * players;
  s.villain.hp = s.villain.maxHp;
  s.villain.damage = 0;
  s.villain.tough = false;
  for (const code of SYNERGY) {
    const p = ports.makePiece(s, code);
    p.counters = 0;
    ports.putEnvironment(s, p);
  }
  const loki = (def(LOKI)?.health || 20) * players;
  const st: GodOfLiesState = {
    loki: { code: LOKI, hp: loki, maxHp: loki },
    worlds: 0,
    shatter: 0,
    avatars: order.slice(1),
    bonus: 0,
  };
  if (expert(s)) {
    focus.attachedTo = s.villain.id;
    s.attachments.push(focus);
    st.bonus = 2 * players;
    s.villain.maxHp += st.bonus;
    s.villain.hp += st.bonus;
  } else st.focus = focus;
  s.godOfLies = st;
  s.scheme.threat = 0;
}

/** Intense Focus gives the Avatar of Loki 2 more hit points per player,
 * Total Focus 3. Returns true when the bonus went down. */
export function godOfLiesSyncHealth(s: GameState): boolean {
  const st = s.godOfLies;
  if (!st || !s.villain) return false;
  const focus = focusInPlay(s);
  const wanted = focus ? (focus.code === TOTAL ? 3 : 2) * s.playerCount : 0;
  if (wanted === st.bonus) return false;
  const change = wanted - st.bonus;
  st.bonus = wanted;
  s.villain.maxHp += change;
  s.villain.hp += change;
  return change < 0;
}

// ------------------------------------------------------------- keywords

/** Intense and Total Focus give the Avatar steady; Dark Scepter, stalwart. */
export function godOfLiesKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (!s.godOfLies || p.id !== s.villain?.id || !avatarInPlay(s)) return 0;
  if (keyword === "Steady" && focusInPlay(s)) return 1;
  if (keyword === "Stalwart" && villainAttachment(s, [SCEPTER])) return 1;
  return 0;
}
/** Dark Scepter: treacheries cannot be canceled. */
export function godOfLiesUncancelable(s: GameState, p: Piece) {
  return treachery(p) && scepterInPlay(s);
}
/** Wrapped in Chains: the attached identity cannot ready. */
export function godOfLiesCanReadyIdentity(s: GameState, playerId: string) {
  return !s.attachments.some(
    (a) =>
      a.code === CHAINS &&
      a.attachedTo === identityOf(playerId) &&
      active(s, a),
  );
}
/** Dark Arts gains incite 1 in Expert. */
export function godOfLiesRevealCard(s: GameState, p: Piece, c: Card): Card {
  if (p.code !== DARK_ARTS || !expert(s) || /^Incite \d/m.test(c.text || ""))
    return c;
  return { ...c, text: `Incite 1.\n${c.text || ""}` };
}

// --------------------------------------------------------- shattering

function shatter(s: GameState, n: number, ports: Pick<GodOfLiesPorts, "log">) {
  const st = s.godOfLies;
  if (!st || !n || over(s)) return;
  const before = st.shatter;
  st.shatter = Math.max(0, st.shatter + n);
  const placed = st.shatter - before;
  if (!placed) return;
  ports.log(
    s,
    placed > 0
      ? `${plural(placed, "shatter counter")} on the Avatar of Loki (${st.shatter}).`
      : `${plural(-placed, "shatter counter")} removed from the Avatar of Loki (${st.shatter}).`,
    placed > 0 ? "good" : "bad",
  );
}
/** Place synergy counters on a Synergy environment, up to its maximum. */
function placeSynergy(
  s: GameState,
  code: string,
  n: number,
  ports: Pick<GodOfLiesPorts, "log">,
) {
  const p = synergy(s, code);
  if (!p || n <= 0) return;
  const before = p.counters || 0;
  p.counters = Math.min(synergyMax(s), before + n);
  if (p.counters > before)
    ports.log(
      s,
      `${plural(p.counters - before, "synergy counter")} on ${name(p)} (${p.counters} of ${synergyMax(s)}).`,
      "good",
    );
}
/** 1 synergy counter on one of the Synergy environments, the first player
 * choosing among those with room. */
function chooseSynergy(s: GameState, ports: GodOfLiesPorts) {
  const open = SYNERGY.map((code) => synergy(s, code)).filter(
    (p): p is Piece => !!p && (p.counters || 0) < synergyMax(s),
  );
  if (!open.length) return;
  if (open.length === 1) {
    placeSynergy(s, open[0].code, 1, ports);
    return;
  }
  ports.choose(
    s,
    "Synergy",
    "Place 1 synergy counter on one of your Synergy environments.",
    open.map((p) => ({
      id: p.code,
      label: `${name(p)} (${p.counters || 0} of ${synergyMax(s)})`,
      image: p.code,
      effects: [G("synergy", { code: p.code, n: 1 })],
    })),
  );
}

/** Mischief and Mayhem and the Avatars' Forced Interrupt: an Avatar of Loki
 * that would be defeated gains 5 shatter counters per player and flips to
 * its Fading Figment instead, whose When Revealed shatters the illusion. */
export function godOfLiesVillainWouldBeDefeated(
  s: GameState,
  ports: GodOfLiesPorts,
) {
  const st = s.godOfLies;
  if (!st || !s.villain || over(s)) return;
  if (!AVATARS.includes(s.villain.code)) {
    // A Fading Figment is only in play while its illusion shatters.
    s.villain.hp = Math.max(1, s.villain.hp);
    return;
  }
  const avatar = s.villain.code;
  const figment = FIGMENT_OF[avatar];
  ports.log(
    s,
    `${name(avatar)} would be defeated: he flips to his Fading Figment instead.`,
    "good",
  );
  shatter(s, 5 * s.playerCount, ports);
  s.villain.code = figment;
  s.villain.maxHp = def(figment)?.health || 99;
  s.villain.hp = s.villain.maxHp;
  s.villain.damage = 0;
  st.bonus = 0;
  ports.queue(s, G("figment", { code: figment, actorId: s.firstPlayerId }));
}

/** Swap the Avatar of Loki in play with a random set-aside one, which takes
 * his hit point dial, attachments, status cards and counters. */
function swapAvatar(s: GameState, ports: Pick<GodOfLiesPorts, "shuffle">) {
  const st = s.godOfLies!;
  if (!st.avatars.length) return undefined;
  const next = ports.shuffle(s, [...st.avatars])[0];
  const previous = AVATARS.includes(s.villain.code)
    ? s.villain.code
    : AVATARS.find((code) => FIGMENT_OF[code] === s.villain.code);
  st.avatars = [
    ...st.avatars.filter((code) => code !== next),
    ...(previous ? [previous] : []),
  ];
  s.villain.code = next;
  return { previous, next };
}

function damageLoki(s: GameState, n: number, ports: GodOfLiesPorts) {
  const st = s.godOfLies!;
  if (n <= 0) return;
  st.loki.hp = Math.max(0, st.loki.hp - n);
  ports.log(
    s,
    `The illusion shatters: Loki, God of Lies takes ${n} damage (${st.loki.hp} of ${st.loki.maxHp} hit points).`,
    "good",
  );
  if (st.loki.hp <= 0)
    ports.endGame(
      s,
      true,
      "Loki, God of Lies is defeated. Every illusion fades, and the worlds are safe.",
    );
}

// ------------------------------------------------- Worlds Collide, defeat

/** Place threat on Worlds Collide. At its target the players lose at once
 * in the villain phase; in the player phase, once it ends, unless Loki, God
 * of Lies falls first. */
function worldsCollide(s: GameState, n: number, ports: GodOfLiesPorts) {
  const st = s.godOfLies;
  if (!st || n <= 0 || over(s)) return;
  st.worlds += n;
  ports.log(
    s,
    `+${n} threat on Worlds Collide (${st.worlds} of ${WORLDS_TARGET}).`,
    "bad",
  );
  if (st.worlds < WORLDS_TARGET) return;
  if (s.phase === "player") {
    if (!st.doomed)
      ports.log(
        s,
        "Worlds Collide is complete: defeat Loki, God of Lies before the player phase ends.",
        "bad",
      );
    st.doomed = true;
    return;
  }
  ports.endGame(
    s,
    false,
    "Worlds Collide is complete. Loki, God of Lies wins his trickster takeover.",
  );
}
/** Mischief and Mayhem's first Forced Interrupt: completed, it loses its
 * threat and places 1 threat on Worlds Collide instead. */
export function godOfLiesMainCompleted(s: GameState, ports: GodOfLiesPorts) {
  ports.log(
    s,
    "Mischief and Mayhem would be completed: its threat is removed and 1 threat goes on Worlds Collide.",
    "bad",
  );
  s.scheme.threat = 0;
  worldsCollide(s, 1, ports);
}
/** Its second Forced Interrupt: an identity that would be defeated changes
 * to alter-ego with 1 hit point, and 1 threat goes on Worlds Collide.
 * Returns the effects to queue, or null when it does not apply. */
export function godOfLiesIdentityWouldBeDefeated(
  s: GameState,
  playerId: string,
  ports: GodOfLiesPorts,
): Effect[] | null {
  const st = s.godOfLies;
  if (!st || s.scheme.code !== MISCHIEF || over(s)) return null;
  const view = seatView(s, playerId).player;
  view.hp = 1;
  ports.log(
    s,
    `${ports.heroName(s, playerId)} would be defeated: Mischief and Mayhem changes them to alter-ego with 1 hit point.`,
    "bad",
  );
  worldsCollide(s, 1, ports);
  if (
    view.form !== "alter" &&
    !(st.alterEgo || []).includes(playerId) &&
    !s.queue.some((e) => e.type === "gol:alter-ego" && e.playerId === playerId)
  )
    (st.alterEgo ||= []).push(playerId);
  return godOfLiesFlush(s);
}
/** A player card being played or resolving, a payment, or an enemy
 * activation in progress. */
const busy = (s: GameState) =>
  !!s.attack ||
  !!s.scheming ||
  s.prompt?.kind === "payment" ||
  s.queue.some((e) => e.type === "play") ||
  s.resolving.some((p) => def(p)?.faction_code !== "encounter");
/** The defeated identities change to alter-ego once nothing is in
 * progress: the attack, activation or card that defeated them finishes
 * first, with its responses. */
export function godOfLiesFlush(s: GameState): Effect[] {
  const st = s.godOfLies;
  if (!st?.alterEgo?.length || busy(s) || over(s)) return [];
  return st.alterEgo
    .splice(0)
    .map((playerId) => G("alter-ego", { playerId, actorId: playerId }));
}
/** The player phase ends with Worlds Collide complete: the players lose. */
export function godOfLiesPlayerPhaseEnded(s: GameState, ports: GodOfLiesPorts) {
  if (!s.godOfLies?.doomed || over(s)) return false;
  ports.endGame(
    s,
    false,
    "Worlds Collide is complete and Loki, God of Lies still stands.",
  );
  return true;
}

// ------------------------------------------------ villain and minions

/** Loki the Wretch's Forced Interrupt as he activates against you, and
 * Grendell's as he attacks. */
export function godOfLiesActivationInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
  kind: "attack" | "scheme",
): Effect[] {
  if (!s.godOfLies || over(s) || !alive(s, playerId)) return [];
  if (enemyId === s.villain?.id && avatarActive(s, WRETCH))
    return [G("wretch", { kind, enemyId, playerId, actorId: playerId })];
  const m = s.minions.find((q) => q.id === enemyId);
  if (kind === "attack" && m?.code === GRENDELL && active(s, m))
    return [G("grendell", { enemyId, actorId: playerId })];
  return [];
}
/** Malekith's Forced Response after he attacks you. */
export function godOfLiesAttacked(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  if (!playerId || !alive(s, playerId) || over(s)) return [];
  const m = s.minions.find((q) => q.id === attackerId);
  return m?.code === MALEKITH && active(s, m)
    ? [G("malekith", { playerId, actorId: playerId })]
    : [];
}
/** Laufey's Forced Response after a character attacks her. */
export function godOfLiesCharacterAttacked(
  s: GameState,
  targetId: string,
  attacker: string,
): Effect[] {
  if (over(s)) return [];
  const m = s.minions.find((q) => q.id === targetId);
  return m?.code === LAUFEY && active(s, m)
    ? [G("laufey", { attacker, mandatory: true, afterAttack: true })]
    : [];
}
/** When Defeated: shatter counters, synergy counters and Draugr Buddy. */
export function godOfLiesMinionDefeated(
  s: GameState,
  m: Piece,
  textWasBlank: boolean,
  playerId: string,
): Effect[] {
  if (!s.godOfLies || textWasBlank || over(s)) return [];
  switch (m.code) {
    case DRAUGR:
      return alive(s, playerId)
        ? [G("draugr", { id: m.id, playerId, actorId: playerId })]
        : [];
    case GRENDELL:
      return [G("shatter", { n: 3 })];
    case MALEKITH:
    case MINOTAUR:
      return [G("shatter", { n: 2 })];
    case MANGOG:
      return [
        G("shatter", { n: 3 }),
        G("synergy-choose", { actorId: s.firstPlayerId }),
      ];
    case FENRIS:
      return [G("shatter", { n: 3 }), G("synergy", { code: MOUNTING, n: 1 })];
    case HRAESVELGR:
      return [
        G("shatter", { n: 3 }),
        G("synergy", { code: DOMINEERING, n: 1 }),
      ];
    case LAUFEY:
      return [G("shatter", { n: 3 }), G("synergy", { code: UNIFIED, n: 1 })];
    default:
      return [];
  }
}
/** The Mangog: Victory 1. */
export const godOfLiesVictoryMinion = (m: Piece) => m.code === MANGOG;
/** When Defeated: the side schemes' shatter and synergy counters. */
export function godOfLiesSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (!s.godOfLies || over(s)) return [];
  switch (p.code) {
    case DOOR:
      return [
        G("shatter", { n: 3 }),
        G("synergy-choose", { actorId: s.firstPlayerId }),
      ];
    case LOFTY:
      return [G("shatter", { n: 2 })];
    case JOTUNHEIM:
      return [G("shatter", { n: 3 }), G("synergy", { code: FEIGNED, n: 1 })];
    default:
      return [];
  }
}

// ---------------------------------------------------------- treacheries

/** A treachery begins resolving: its resolution is tracked so that the
 * responses "after you resolve a treachery" follow it. */
export function godOfLiesTreacheryRevealed(s: GameState, p: Piece) {
  if (s.godOfLies && treachery(p))
    (s.godOfLies.resolving ||= {})[p.id] = s.activePlayerId;
}
/** A tracked treachery finished resolving: the player who revealed it. */
export function godOfLiesTreacheryFinished(
  s: GameState,
  id: string,
): string | undefined {
  const playerId = s.godOfLies?.resolving?.[id];
  if (playerId !== undefined) delete s.godOfLies!.resolving![id];
  return playerId;
}
/** After you resolve a treachery: Loki the Miscreant, Loki the Knave and
 * Dark Scepter's Hero Response. */
export function godOfLiesTreacheryResolved(
  s: GameState,
  playerId: string,
  ports?: Pick<GodOfLiesPorts, "canPay">,
): Effect[] {
  if (!s.godOfLies || over(s) || !alive(s, playerId)) return [];
  const effects: Effect[] = [];
  if (avatarActive(s, MISCREANT))
    effects.push(G("miscreant", { playerId, actorId: playerId }));
  if (avatarActive(s, KNAVE))
    effects.push(G("knave", { playerId, actorId: playerId }));
  if (
    scepterInPlay(s) &&
    seatView(s, playerId).player.form === "hero" &&
    (!ports || RESOURCE_TYPES.some((r) => ports.canPay(s, 2, [r, r])))
  )
    effects.push(G("scepter-response", { playerId, actorId: playerId }));
  return effects;
}
/** Loki the Rascal's Forced Response after you resolve a treachery boost
 * card during his activation. */
export function godOfLiesBoostResolved(s: GameState, p?: Piece): Effect[] {
  const a = activation(s);
  if (
    !p ||
    !treachery(p) ||
    !a ||
    a.attacker !== s.villain?.id ||
    !avatarActive(s, RASCAL) ||
    over(s)
  )
    return [];
  const playerId = s.attack ? boostPlayer(s) : s.activePlayerId;
  return alive(s, playerId)
    ? [G("rascal", { id: p.id, playerId, actorId: playerId })]
    : [];
}

// ---------------------------------------------------------------- synergy

/** Domineering Force and Mounting Resistance as an identity's or ally's
 * basic attack or thwart, or an ally's attack or thwart: remove a synergy
 * counter for 4 more damage or threat removed. `after` carries the amount. */
export function godOfLiesPowerOptions(
  s: GameState,
  power: "attack" | "thwart",
  after: Effect,
): Option[] {
  if (!s.godOfLies || over(s)) return [];
  const code = power === "attack" ? DOMINEERING : MOUNTING;
  const p = synergy(s, code);
  if (!p || (p.counters || 0) <= 0) return [];
  return [
    {
      id: `synergy:${code}`,
      label:
        power === "attack"
          ? "Domineering Force · remove a synergy counter: this attack deals 4 more damage"
          : "Mounting Resistance · remove a synergy counter: this thwart removes 4 more threat",
      image: code,
      effects: [
        G("synergy-spend", { code }),
        { ...after, amount: (Number(after.amount) || 0) + 4 },
      ],
    },
  ];
}
/** Feigned Retreat as an identity would take damage, from an attack or
 * otherwise: remove a synergy counter to prevent 4 of it, once for each
 * instance of damage. */
export function godOfLiesDamageOptions(
  s: GameState,
  packet: Effect,
  amount: number,
  after: Effect[],
): Option[] {
  if (!s.godOfLies || amount <= 0 || over(s)) return [];
  const p = synergy(s, FEIGNED);
  if (!p || (p.counters || 0) <= 0) return [];
  const used = packet.damageWindowId
    ? String(s.flags[`msUsed:${packet.damageWindowId}`] || "")
        .split(",")
        .includes(FEIGNED_ID)
    : !!s.attack?.interruptsUsed?.includes(FEIGNED_ID);
  if (used || (!packet.damageWindowId && !s.attack)) return [];
  const n = Math.min(4, amount);
  return [
    {
      id: FEIGNED_ID,
      label: `Feigned Retreat · remove a synergy counter: prevent ${n} damage`,
      image: FEIGNED,
      effects: [
        G("synergy-spend", { code: FEIGNED }),
        G("prevent", { packet, amount: n }),
        ...after,
      ],
    },
  ];
}
const FEIGNED_ID = "feigned-retreat";
/** Unified Front's Resource ability: remove a synergy counter to generate
 * 2 wild resources. */
export function godOfLiesResourceSources(s: GameState) {
  const p = s.godOfLies ? synergy(s, UNIFIED) : undefined;
  if (!p || (p.counters || 0) <= 0 || over(s)) return [];
  return [
    {
      id: p.id,
      name: "Unified Front",
      code: UNIFIED,
      resources: ["wild", "wild"] as Resource[],
      description: `Remove 1 of ${p.counters} synergy counters · 2 wild resources`,
      kind: "ability" as const,
    },
  ];
}
/** Unified Front is spent: its synergy counter comes off. */
export function godOfLiesResourceSpent(s: GameState, id: string) {
  const p = (s.environments || []).find(
    (q) => q.id === id && q.code === UNIFIED,
  );
  if (!p || !s.godOfLies) return false;
  p.counters = Math.max(0, (p.counters || 0) - 1);
  return true;
}

// ----------------------------------------------------------------- actions

export function godOfLiesActions(
  s: GameState,
  p: Piece,
  ports?: Pick<GodOfLiesPorts, "canPay">,
): Option[] {
  if (s.phase !== "player" || !s.godOfLies || !active(s, p)) return [];
  if (
    p.code !== CHAINS ||
    p.attachedTo !== identityOf(s.activePlayerId) ||
    s.player.form !== "hero"
  )
    return [];
  return RESOURCE_TYPES.filter((r) => !ports || ports.canPay(s, 2, [r, r])).map(
    (r) => ({
      id: `chains:${r}`,
      label: `Hero Action · spend 2 ${r} resources: discard it, 1 shatter counter`,
      image: p.code,
      effects: [
        G("chains-pay", { id: p.id, resource: r, actorId: s.activePlayerId }),
      ],
    }),
  );
}
export function godOfLiesActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return s.godOfLies
    ? s.attachments.find((p) => p.id === id && p.code === CHAINS)
    : undefined;
}

// ----------------------------------------------------------------- reveals

export function godOfLiesReveal(s: GameState, p: Piece): Effect[] | null {
  if (!GOD_OF_LIES_SCRIPT_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  if (p.code === CHAINS || p.code === SCEPTER) {
    if (s.resolving.some((q) => q.id === p.id))
      return [G("attach", { piece: p, playerId, actorId: playerId })];
    // Wrapped in Chains' When Revealed, once it is attached.
    return p.code === CHAINS && !isTextBlank(s, p)
      ? [{ type: "exhaust", id: "hero", actorId: playerId }]
      : [];
  }
  if (isTextBlank(s, p)) return [];
  switch (p.code) {
    case MINOTAUR:
      return [G("minotaur", { id: p.id, playerId, actorId: playerId })];
    case HRAESVELGR:
      return [G("hraesvelgr", { playerId, actorId: playerId })];
    case AURA:
      return [G("aura", { playerId, actorId: playerId })];
    case DARK_ARTS:
      return [G("dark-arts", { playerId, actorId: playerId })];
    case DIRTY:
      return [G("dirty", { playerId, actorId: playerId })];
    case STORIES:
      return [G("stories", { playerId, actorId: playerId })];
    default:
      return [];
  }
}
export function godOfLiesBoost(s: GameState, p: Piece): Effect[] | null {
  if (!GOD_OF_LIES_SCRIPT_CODES.includes(p.code)) return null;
  if (![LOFTY, DARK_ARTS, DIRTY].includes(p.code) || isTextBlank(s, p))
    return [];
  if (!activation(s)) return [];
  const playerId = boostPlayer(s);
  if (!alive(s, playerId)) return [];
  return [
    G("per-character", {
      playerId,
      kind: p.code === DARK_ARTS ? "threat" : "indirect",
      source: p.code,
      actorId: playerId,
    }),
  ];
}

// ---------------------------------------------------------------- resolver

/** Discard up to n cards from the top of the encounter deck, stopping when
 * it runs out; returns the cards discarded. */
function discardTop(s: GameState, n: number, ports: GodOfLiesPorts) {
  const discarded: Piece[] = [];
  for (let i = 0; i < n; i++) {
    const { piece, emptied } = ports.discardTop(s);
    if (piece) discarded.push(piece);
    if (emptied || !piece) break;
  }
  if (discarded.length)
    ports.log(
      s,
      `Discarded from the encounter deck: ${discarded.map((q) => name(q)).join(", ")}.`,
    );
  return discarded;
}
/** Raise an activation's ATK or SCH, carrying it through the attack's
 * initiation window. */
function bumpActivation(
  s: GameState,
  enemyId: string,
  kind: "attack" | "scheme",
  n: number,
) {
  if (kind === "attack") {
    const a = s.attack;
    if (!a || a.attacker !== enemyId) return;
    a.modifier = (a.modifier || 0) + n;
    for (const q of s.queue)
      if (q.type === "enemyAttackInitiationWindow" && q.attacker === enemyId)
        q.modifier = (Number(q.modifier) || 0) + n;
  } else if (s.scheming?.attacker === enemyId)
    s.scheming.modifier = (s.scheming.modifier || 0) + n;
}
/** Take an encounter card from the discard pile and deal it facedown. */
function dealFromDiscard(
  s: GameState,
  id: string,
  playerId: string,
  ports: GodOfLiesPorts,
) {
  const p = s.encounter.discard.find((q) => q.id === id);
  if (!p || !alive(s, playerId)) return false;
  ports.dealFacedown(s, p, playerId);
  ports.log(
    s,
    `${name(p)} is dealt to ${ports.heroName(s, playerId)} as a facedown encounter card.`,
    "bad",
  );
  return true;
}

export function resolveGodOfLiesEffect(
  s: GameState,
  e: Effect,
  ports: GodOfLiesPorts,
): boolean {
  if (!e.type.startsWith("gol:")) return false;
  const st = s.godOfLies;
  if (!st || over(s)) return true;
  switch (e.type) {
    case "gol:figment": {
      // Fading Figment's When Revealed: shatter the illusion, then the
      // synergy counters for the group.
      if (s.villain.code !== e.code) break;
      // Shatter the Illusion: the shatter counters come off and wound Loki,
      // God of Lies; a random set-aside Avatar takes the Figment's place at
      // his starting hit points.
      const n = st.shatter;
      st.shatter = 0;
      damageLoki(s, n, ports);
      if (over(s)) break;
      const swap = swapAvatar(s, ports);
      if (swap) {
        s.villain.maxHp = (def(swap.next)?.health || 15) * s.playerCount;
        s.villain.hp = s.villain.maxHp;
        s.villain.damage = 0;
        st.bonus = 0;
        ports.log(s, `${name(swap.next)} takes his place.`, "bad");
      }
      placeSynergy(s, FIGMENT_SYNERGY[String(e.code)], s.playerCount, ports);
      // Loki flips once the illusion has fully shattered.
      if (st.loki.code === LOKI && st.loki.hp <= 10 * s.playerCount) {
        st.loki.code = LOKI_FLIPPED;
        ports.log(
          s,
          "Loki, God of Lies has 10 or fewer hit points per player: he flips and turns his whole focus on the heroes.",
          "bad",
        );
        ports.queue(s, G("loki-revealed", { actorId: s.firstPlayerId }));
      }
      break;
    }
    case "gol:loki-revealed": {
      // Standard: the set-aside Intense Focus attaches to the Avatar.
      // Expert: Intense Focus flips to Total Focus. Either way its When
      // Revealed resolves.
      if (!expert(s)) {
        const focus = st.focus;
        if (focus && s.villain) {
          delete st.focus;
          ports.attach(s, focus, s.villain.id);
        }
        ports.queue(s, G("focus-revealed", { code: INTENSE }));
        break;
      }
      const focus = s.attachments.find(
        (a) => a.code === INTENSE || a.code === TOTAL,
      );
      if (focus) focus.code = TOTAL;
      ports.queue(s, G("focus-revealed", { code: TOTAL }));
      break;
    }
    case "gol:focus-revealed": {
      // Discard the top 2 per player encounter cards and the top 5 cards of
      // each player deck; Total Focus also finds Dark Scepter.
      discardTop(s, 2 * s.playerCount, ports);
      for (const seat of playerOrder(s).filter((x) => !x.eliminated))
        ports.mill(s, seat.id, 5);
      if (e.code === TOTAL) ports.queue(s, G("scepter-find"));
      break;
    }
    case "gol:scepter-find": {
      const fromDeck = s.encounter.deck.find((q) => q.code === SCEPTER);
      const p = fromDeck || s.encounter.discard.find((q) => q.code === SCEPTER);
      if (p) {
        ports.reveal(s, p, s.firstPlayerId);
        if (fromDeck) ports.shuffleEncounter(s);
        break;
      }
      if (s.villain && ports.canAddStatus(s, s.villain.id, "tough"))
        ports.queue(s, {
          type: "status",
          target: s.villain.id,
          status: "tough",
        });
      break;
    }
    case "gol:shatter":
      shatter(s, Number(e.n) || 0, ports);
      break;
    case "gol:synergy":
      placeSynergy(s, String(e.code), Number(e.n) || 0, ports);
      break;
    case "gol:synergy-choose":
      chooseSynergy(s, ports);
      break;
    case "gol:synergy-spend": {
      const p = synergy(s, String(e.code));
      if (!p || (p.counters || 0) <= 0) break;
      p.counters -= 1;
      ports.log(s, `${name(p)}: a synergy counter is removed.`, "good");
      break;
    }
    case "gol:alter-ego": {
      // Mischief and Mayhem: the defeated identity changes to alter-ego.
      const playerId = String(e.playerId);
      if (!alive(s, playerId) || seatView(s, playerId).player.form === "alter")
        break;
      ports.queue(s, {
        type: "flip",
        counts: false,
        target: "alter",
        actorId: playerId,
      });
      break;
    }
    case "gol:prevent": {
      // Feigned Retreat prevents damage in the window it was used in.
      const packet = e.packet as Effect | undefined;
      const n = Number(e.amount) || 0;
      if (packet?.damageWindowId) {
        const prevent = `msPrevent:${packet.damageWindowId}`;
        const used = `msUsed:${packet.damageWindowId}`;
        s.flags[prevent] = Number(s.flags[prevent] || 0) + n;
        s.flags[used] = [
          ...String(s.flags[used] || "")
            .split(",")
            .filter(Boolean),
          FEIGNED_ID,
        ].join(",");
      } else if (s.attack) {
        s.attack.prevented += n;
        (s.attack.interruptsUsed ||= []).push(FEIGNED_ID);
      }
      break;
    }
    case "gol:miscreant": {
      // 1 threat on the main scheme and 1 on a side scheme.
      ports.queue(s, { type: "threat", target: "main", amount: 1 });
      const sides = s.sideSchemes;
      if (sides.length === 1)
        ports.queue(s, { type: "threat", target: sides[0].id, amount: 1 });
      else if (sides.length > 1)
        ports.choose(
          s,
          name(MISCREANT),
          "Place 1 threat on a side scheme.",
          sides.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [{ type: "threat", target: q.id, amount: 1 }],
          })),
        );
      break;
    }
    case "gol:knave": {
      // 1 damage to your identity and 1 to an ally you control.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      const allies = seatView(s, playerId).player.inPlay.filter(
        (q) => def(q)?.type_code === "ally",
      );
      if (allies.length === 1)
        ports.queue(s, {
          type: "damage",
          target: allies[0].id,
          amount: 1,
          source: KNAVE,
        });
      else if (allies.length > 1)
        ports.choose(
          s,
          name(KNAVE),
          "Deal 1 damage to an ally you control.",
          allies.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              { type: "damage", target: q.id, amount: 1, source: KNAVE },
            ],
          })),
        );
      ports.queue(s, {
        type: "damage",
        target: identityOf(playerId),
        amount: 1,
        source: KNAVE,
      });
      break;
    }
    case "gol:scepter-response": {
      // Dark Scepter's Hero Response: spend 2 resources of the same type to
      // discard it.
      const playerId = String(e.playerId);
      const scepter = villainAttachment(s, [SCEPTER]);
      if (!scepter || seatView(s, playerId).player.form !== "hero") break;
      const options = RESOURCE_TYPES.filter((r) =>
        ports.canPay(s, 2, [r, r]),
      ).map((r) => ({
        id: r,
        label: `Spend 2 ${r} resources: discard Dark Scepter`,
        image: SCEPTER,
        effects: [G("scepter-pay", { id: scepter.id, resource: r })],
      }));
      if (!options.length) break;
      ports.choose(s, name(SCEPTER), "Use its Hero Response?", [
        ...options,
        { id: "decline", label: "Keep it in play", effects: [] },
      ]);
      break;
    }
    case "gol:scepter-pay": {
      // Canceling the payment declines the response: the rest of the queue
      // resumes.
      const r = e.resource as Resource;
      const queue = [...s.queue];
      ports.pay(
        s,
        2,
        [r, r],
        [G("discard-attachment", { id: e.id })],
        name(SCEPTER),
        true,
      );
      if (s.prompt?.kind === "payment") s.prompt.cancellationQueue = queue;
      break;
    }
    case "gol:discard-attachment":
      if (s.attachments.some((q) => q.id === e.id))
        ports.discardPiece(s, String(e.id));
      break;
    case "gol:chains-pay": {
      const p = s.attachments.find((q) => q.id === e.id && q.code === CHAINS);
      if (!p) break;
      const r = e.resource as Resource;
      const queue = [...s.queue];
      ports.pay(
        s,
        2,
        [r, r],
        [G("chains-free", { id: p.id })],
        name(CHAINS),
        true,
      );
      if (s.prompt?.kind === "payment") s.prompt.cancellationQueue = queue;
      break;
    }
    case "gol:chains-free":
      if (!s.attachments.some((q) => q.id === e.id)) break;
      ports.discardPiece(s, String(e.id));
      shatter(s, 1, ports);
      break;
    case "gol:rascal": {
      // Deal the treachery to yourself facedown, or spend 1 resource.
      const playerId = String(e.playerId);
      const p = s.encounter.discard.find((q) => q.id === e.id);
      if (!p || !alive(s, playerId)) break;
      const deal: Option = {
        id: "deal",
        label: `Deal ${name(p)} to yourself facedown`,
        image: p.code,
        effects: [G("deal-discarded", { id: p.id, playerId })],
      };
      if (!ports.canPay(s, 1, [])) {
        dealFromDiscard(s, p.id, playerId, ports);
        break;
      }
      ports.choose(s, name(RASCAL), "Choose one.", [
        deal,
        {
          id: "pay",
          label: "Spend 1 resource of any type",
          effects: [G("rascal-pay", { id: p.id, playerId })],
        },
      ]);
      break;
    }
    case "gol:rascal-pay":
      ports.pay(s, 1, [], [], name(RASCAL), false);
      break;
    case "gol:deal-discarded":
      dealFromDiscard(s, String(e.id), String(e.playerId), ports);
      break;
    case "gol:wretch": {
      // Discard the top encounter card: a treachery gives him +1 SCH and +1
      // ATK for this activation.
      const [p] = discardTop(s, 1, ports);
      if (!treachery(p)) break;
      bumpActivation(s, String(e.enemyId), e.kind, 1);
      ports.log(s, `${name(WRETCH)} gets +1 SCH and +1 ATK.`, "bad");
      break;
    }
    case "gol:grendell": {
      const n = discardTop(s, 3, ports).filter(treachery).length;
      if (!n) break;
      bumpActivation(s, String(e.enemyId), "attack", n);
      ports.log(s, `${name(GRENDELL)} gets +${n} ATK for this attack.`, "bad");
      break;
    }
    case "gol:malekith": {
      const [p] = discardTop(s, 1, ports);
      if (treachery(p)) dealFromDiscard(s, p.id, String(e.playerId), ports);
      break;
    }
    case "gol:laufey": {
      const [p] = discardTop(s, 1, ports);
      if (!treachery(p)) break;
      const attacker = String(e.attacker || "");
      if (!attacker) break;
      ports.log(s, `${name(LAUFEY)} stuns the attacker.`, "bad");
      ports.queue(s, { type: "status", target: attacker, status: "stunned" });
      break;
    }
    case "gol:draugr": {
      // The defeating player discards the top encounter card; a treachery
      // deals Draugr Buddy to them facedown.
      const [p] = discardTop(s, 1, ports);
      if (treachery(p))
        dealFromDiscard(s, String(e.id), String(e.playerId), ports);
      break;
    }
    case "gol:attach": {
      // Wrapped in Chains attaches to your identity; Dark Scepter to the
      // Avatar of Loki.
      const p = e.piece as Piece;
      if (!s.resolving.some((q) => q.id === p.id)) break;
      const playerId = String(e.playerId);
      if (p.code === SCEPTER) {
        if (s.villain) ports.attach(s, p, s.villain.id);
        else ports.discardPiece(s, p.id);
        break;
      }
      if (alive(s, playerId)) ports.attach(s, p, identityOf(playerId));
      else ports.discardPiece(s, p.id);
      break;
    }
    case "gol:minotaur": {
      // With 5 or more treacheries in the encounter discard pile, Minotaur
      // activates against you.
      const m = s.minions.find((q) => q.id === e.id);
      const playerId = String(e.playerId);
      if (!m || !alive(s, playerId)) break;
      if (s.encounter.discard.filter(treachery).length < 5) break;
      ports.activate(s, {
        enemyId: m.id,
        playerId,
        kind:
          seatView(s, playerId).player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
      });
      break;
    }
    case "gol:hraesvelgr": {
      const playerId = String(e.playerId);
      if (discardTop(s, 3, ports).some(treachery) && alive(s, playerId))
        ports.indirect(s, playerId, 2, HRAESVELGR, name(HRAESVELGR));
      break;
    }
    case "gol:aura": {
      const playerId = String(e.playerId);
      if (
        discardTop(s, expert(s) ? 3 : 2, ports).some(treachery) &&
        alive(s, playerId)
      )
        ports.queue(s, { type: "exhaust", id: "hero", actorId: playerId });
      break;
    }
    case "gol:dark-arts": {
      // A minion from the encounter discard pile is revealed; otherwise 3
      // threat on the main scheme.
      const playerId = String(e.playerId);
      const minions = s.encounter.discard.filter(
        (q) => def(q)?.type_code === "minion",
      );
      if (!minions.length) {
        ports.queue(s, { type: "threat", target: "main", amount: 3 });
        break;
      }
      const distinct = minions.filter(
        (q, i) => minions.findIndex((x) => x.code === q.code) === i,
      );
      if (distinct.length === 1) {
        ports.reveal(s, distinct[0], playerId);
        break;
      }
      ports.choose(
        s,
        name(DARK_ARTS),
        "Search the encounter discard pile for a minion and reveal it.",
        distinct.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [G("reveal-discarded", { id: q.id, playerId })],
        })),
      );
      break;
    }
    case "gol:reveal-discarded": {
      const p = s.encounter.discard.find((q) => q.id === e.id);
      if (p) ports.reveal(s, p, String(e.playerId));
      break;
    }
    case "gol:dirty": {
      // 1 shatter counter comes off the Avatar; take 2 damage (3 in Expert).
      const playerId = String(e.playerId);
      shatter(s, -1, ports);
      if (alive(s, playerId))
        ports.queue(s, {
          type: "damage",
          target: identityOf(playerId),
          amount: expert(s) ? 3 : 2,
          source: DIRTY,
        });
      break;
    }
    case "gol:stories": {
      // Swap the Avatar with a random set-aside one; Knave and Miscreant
      // scheme, Rascal and Wretch attack you (+1 in Expert).
      const playerId = String(e.playerId);
      if (!s.villain || !AVATARS.includes(s.villain.code)) break;
      const swap = swapAvatar(s, ports);
      if (!swap) break;
      ports.log(
        s,
        `Stories and Lies: ${name(swap.previous || "")} swaps places with ${name(swap.next)}.`,
        "bad",
      );
      if (!alive(s, playerId)) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId,
        kind: [KNAVE, MISCREANT].includes(swap.next) ? "scheme" : "attack",
        modifier: expert(s) ? 1 : 0,
      });
      break;
    }
    case "gol:per-character": {
      // Lofty Goals and Dirty Trick: 1 indirect damage for each character
      // you control; Dark Arts: 1 threat for each.
      const playerId = String(e.playerId);
      if (!alive(s, playerId)) break;
      const n = characters(s, playerId);
      if (e.kind === "threat")
        ports.queue(s, { type: "threat", target: "main", amount: n });
      else
        ports.indirect(
          s,
          playerId,
          n,
          String(e.source),
          name(String(e.source)),
        );
      break;
    }
  }
  return true;
}
