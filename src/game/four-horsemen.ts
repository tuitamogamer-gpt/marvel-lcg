import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Piece } from "./types.js";

type Villain = GameState["villain"];

/** Age of Apocalypse's second scenario, Four Horsemen: War, Famine,
 * Pestilence and Death are in play in a row. Only the villain with the
 * active counter activates, the counter moves on after each villain
 * activation, and no Horseman can be defeated while another has hit points;
 * with the Hounds modular set, which joins any scenario with modular sets. */

export const FOUR_HORSEMEN_SCRIPT_CODES = [
  "45081a",
  "45081b",
  "45082a",
  "45082b",
  "45083a",
  "45083b",
  "45084a",
  "45084b",
  "45085a",
  "45085b",
  "45086",
  "45087",
  "45088",
  "45089",
  "45090",
  "45091",
  "45092",
  "45093",
  "45094",
  "45095",
  "45096",
] as const;
export const HOUNDS_CODES = ["45097", "45098", "45099", "45100"] as const;
/** The Hounds modular set joins any scenario with modular sets. */
export const HORSEMEN_MODULAR_SETS = ["hounds"] as const;

export type HorsemanKey = "war" | "famine" | "pestilence" | "death";
export const HORSEMEN: readonly HorsemanKey[] = [
  "war",
  "famine",
  "pestilence",
  "death",
];
/** Each Horseman's A side (Standard) and B side (Expert). */
export const HORSEMAN_CODES: Readonly<Record<HorsemanKey, [string, string]>> = {
  war: ["45081a", "45081b"],
  famine: ["45082a", "45082b"],
  pestilence: ["45083a", "45083b"],
  death: ["45084a", "45084b"],
};
/** The side scheme mirroring each Horseman's Forced Response. */
const HORSEMAN_SCHEMES: Readonly<Record<HorsemanKey, string>> = {
  war: "45086",
  famine: "45087",
  pestilence: "45088",
  death: "45089",
};
/** Horseman of War, Famine, Pestilence and Death. */
const HORSEMAN_TREACHERIES: Readonly<Record<string, HorsemanKey>> = {
  "45092": "war",
  "45093": "famine",
  "45094": "pestilence",
  "45095": "death",
};
export const HORSEMEN_OF_APOCALYPSE = "45085b";
export const GOLDEN_HORSE = "45090";
export const METAL_WINGS = "45091";
const ROUGH_RIDERS = "45096";
export const AHAB = "45097";
export const HOUND = "45098";
const ENERGY_SPEAR = "45099";
export const RELEASE_THE_HOUNDS = "45100";

export interface HorsemenState {
  /** The four Horsemen from left to right, by key. */
  row: HorsemanKey[];
  /** Villains out of focus, by key. */
  bench: Partial<Record<HorsemanKey, Villain>>;
  /** The Horseman that is native `s.villain`. */
  focus: HorsemanKey;
  /** The Horseman with the active counter. */
  active: HorsemanKey;
  /** Open focus windows. */
  windows?: number;
  /** Players whose identity text box is blank until the next villain phase
   * begins (Pestilence). */
  blank?: string[];
  /** Horseman boosts: activations owed after the current activation. */
  pending?: { key: HorsemanKey; playerId: string }[];
}

export interface HorsemenPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** A fresh villain piece with its printed hit points per player. */
  makeVillain(s: GameState, code: string): Villain;
  pick(s: GameState, n: number): number;
  /** Upgrades and supports the player controls that can be discarded. */
  ownCards(s: GameState, playerId: string): Piece[];
  /** Discard the top cards of a player's deck. */
  mill(s: GameState, playerId: string, n: number): void;
  /** The player's identity and the allies they control. */
  characters(s: GameState, playerId: string): string[];
  /** Reveal an encounter card already removed from its zone. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  /** Deal this encounter card facedown to the player. */
  dealFacedown(s: GameState, p: Piece, playerId: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const H = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `horsemen:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const fourHorsemen = (s: GameState) => !!s.horsemen;
export const horsemanKey = (code: string): HorsemanKey | undefined =>
  HORSEMEN.find((key) => HORSEMAN_CODES[key].includes(code));

// ------------------------------------------------------------------ focus

/** The live villain piece of one Horseman, wherever the focus is. */
export function horsemanVillain(
  s: GameState,
  key: HorsemanKey,
): Villain | undefined {
  const st = s.horsemen;
  if (!st) return undefined;
  return st.focus === key ? s.villain : st.bench[key];
}
/** The four Horsemen in row order. */
export function horsemenVillains(s: GameState): Villain[] {
  const st = s.horsemen;
  if (!st) return [];
  return st.row
    .map((key) => horsemanVillain(s, key))
    .filter((v): v is Villain => !!v);
}
export function horsemenBench(s: GameState): Villain[] {
  return Object.values(s.horsemen?.bench || {}).filter(
    (v): v is Villain => !!v,
  );
}
export function horsemenBenchKey(
  s: GameState,
  id: string,
): HorsemanKey | undefined {
  const st = s.horsemen;
  if (!st) return undefined;
  return HORSEMEN.find((key) => st.bench[key]?.id === id);
}
export function horsemenActiveVillain(s: GameState): Villain | undefined {
  return s.horsemen ? horsemanVillain(s, s.horsemen.active) : undefined;
}
/** Swap the bench so that `key` is native `s.villain`. */
export function horsemenFocus(s: GameState, key: HorsemanKey) {
  const st = s.horsemen;
  if (!st || st.focus === key) return;
  const next = st.bench[key];
  if (!next) return;
  st.bench[st.focus] = s.villain;
  delete st.bench[key];
  s.villain = next;
  st.focus = key;
}
/** Run synchronous engine code with `key` in focus, then restore. */
export function withHorsemenFocus<R>(
  s: GameState,
  key: HorsemanKey,
  fn: () => R,
): R {
  const st = s.horsemen;
  if (!st || st.focus === key || !st.bench[key]) return fn();
  const previous = st.focus;
  st.windows = (st.windows || 0) + 1;
  horsemenFocus(s, key);
  try {
    return fn();
  } finally {
    st.windows = Math.max(0, (st.windows || 0) - 1);
    if (st.focus === key && st.bench[previous]) horsemenFocus(s, previous);
  }
}
/** Open a focus window on `key`; returns the focus to restore. */
export function horsemenOpenWindow(
  s: GameState,
  key: HorsemanKey,
): HorsemanKey {
  const st = s.horsemen!;
  const previous = st.focus;
  st.windows = (st.windows || 0) + 1;
  horsemenFocus(s, key);
  return previous;
}
/** Close a window: back to the outer window's villain, or the active one. */
export function horsemenCloseWindow(s: GameState, previous: HorsemanKey) {
  const st = s.horsemen;
  if (!st) return;
  st.windows = Math.max(0, (st.windows || 0) - 1);
  horsemenFocus(s, st.windows > 0 ? previous : st.active);
}
const focusFields = ["target", "targetId", "enemyId", "crewVillainId"];
const activationTypes = [
  "enemyAttack",
  "enemyScheme",
  "ghostNativeEnemyAttack",
  "ghostNativeEnemyScheme",
];
/** An effect that names a Horseman out of focus resolves inside a focus
 * window on that Horseman. */
export function horsemenWindowKey(
  s: GameState,
  e: Effect,
): HorsemanKey | undefined {
  const st = s.horsemen;
  if (!st || e.type.startsWith("horsemen:")) return undefined;
  const fields = activationTypes.includes(e.type)
    ? [...focusFields, "id"]
    : focusFields;
  return HORSEMEN.find((key) => {
    const v = st.bench[key];
    return !!v && fields.some((field) => e[field] === v.id);
  });
}
/** The active Horseman is in focus outside any window. */
export function horsemenFocusActive(s: GameState) {
  const st = s.horsemen;
  if (!st || st.windows) return;
  horsemenFocus(s, st.active);
}

// ------------------------------------------------------------- hit points

/** Golden Horse and Metal Wings: the attached villain is considered to have
 * at least 1 hit point. */
const mounted = (s: GameState, v: Piece) =>
  s.attachments.some(
    (a) =>
      (a.code === GOLDEN_HORSE || a.code === METAL_WINGS) &&
      a.attachedTo === v.id &&
      active(s, a),
  );
/** A Horseman with at least 1 hit point, or considered to have one. */
export function horsemanStanding(s: GameState, v: Villain): boolean {
  return (v.hp || 0) >= 1 || mounted(s, v);
}
/** Each Horseman cannot be defeated while another villain has at least 1
 * hit point; the players win once none has. */
export function horsemenDefeatCheck(s: GameState): "immune" | "won" | null {
  const st = s.horsemen;
  if (!st) return null;
  const others = horsemenVillains(s).filter((v) => v.id !== s.villain.id);
  if (mounted(s, s.villain) || others.some((v) => horsemanStanding(s, v)))
    return "immune";
  return "won";
}
/** Golden Horse: the attached villain gains the Aerial trait. */
export function horsemenAerial(s: GameState, id: string): boolean {
  return s.attachments.some(
    (a) => a.code === GOLDEN_HORSE && a.attachedTo === id && active(s, a),
  );
}
/** Metal Wings: Death gains retaliate 1. */
export function horsemenKeyword(
  s: GameState,
  p: Piece,
  keyword: string,
): number {
  if (keyword !== "Retaliate" || horsemanKey(p.code) !== "death") return 0;
  return s.attachments.some(
    (a) => a.code === METAL_WINGS && a.attachedTo === p.id && active(s, a),
  )
    ? 1
    : 0;
}

// ------------------------------------------------------------------ setup

/** The Horsemen of Apocalypse (1A): the four Horsemen, side A in Standard
 * and side B in Expert, shuffled into a row; the leftmost has the active
 * counter. */
export function horsemenSetup(
  s: GameState,
  ports: Pick<HorsemenPorts, "makeVillain" | "pick">,
): void {
  const pool = [...HORSEMEN];
  const row: HorsemanKey[] = [];
  while (pool.length) row.push(pool.splice(ports.pick(s, pool.length), 1)[0]);
  const side = s.difficulty === "expert" ? 1 : 0;
  const bench: HorsemenState["bench"] = {};
  for (const key of row.slice(1))
    bench[key] = ports.makeVillain(s, HORSEMAN_CODES[key][side]);
  s.villain = ports.makeVillain(s, HORSEMAN_CODES[row[0]][side]);
  s.horsemen = { row, bench, focus: row[0], active: row[0] };
}
/** The Horsemen of Apocalypse (1A): each player reveals a random side
 * scheme from the Four Horsemen encounter set. */
export function horsemenSetupEffects(s: GameState): Effect[] {
  if (!s.horsemen) return [];
  return playerOrder(s)
    .filter((seat) => !seat.eliminated)
    .map((seat) => H("random-scheme", { playerId: seat.id }));
}

// ------------------------------------------------------------- activation

/** Before a villain activation, the active Horseman is in focus. */
export function horsemenBeforeActivation(s: GameState) {
  horsemenFocusActive(s);
}
/** The Horsemen of Apocalypse (1B): after a villain activates, move the
 * active counter to the next villain. */
export function horsemenActivated(s: GameState, id: string): Effect[] {
  const st = s.horsemen;
  if (!st) return [];
  const out: Effect[] = [];
  if (
    s.scheme.code === HORSEMEN_OF_APOCALYPSE &&
    horsemenVillains(s).some((v) => v.id === id)
  )
    out.push(H("advance"));
  // Horseman boosts: the owed activations, without a boost card.
  for (const owed of (st.pending || []).splice(0)) {
    const v = horsemanVillain(s, owed.key);
    if (v && alive(s, owed.playerId))
      out.push(activation(s, v, owed.playerId, true));
  }
  return out;
}
/** Ahab's Energy Spear: the attached enemy's attack gains overkill and
 * piercing; the Spear is discarded at the end of the attack. */
export function horsemenAttackInitiated(
  s: GameState,
  attackerId: string,
): Effect[] {
  if (
    s.attack &&
    s.attachments.some(
      (a) =>
        a.code === ENERGY_SPEAR && a.attachedTo === attackerId && active(s, a),
    )
  ) {
    s.attack.overkill = true;
    s.attack.piercing = true;
  }
  return [];
}
export function horsemenAttackEnded(
  s: GameState,
  attackerId: string,
): Effect[] {
  return s.attachments
    .filter((a) => a.code === ENERGY_SPEAR && a.attachedTo === attackerId)
    .map((a) => ({ type: "discardPiece", id: a.id }));
}
function advance(s: GameState, ports: HorsemenPorts) {
  const st = s.horsemen;
  if (!st) return;
  const i = st.row.indexOf(st.active);
  st.active = st.row[(i + 1) % st.row.length];
  ports.log(
    s,
    `The active counter moves to ${name(horsemanVillain(s, st.active)!)}.`,
    "bad",
  );
  horsemenFocusActive(s);
}
/** A Horseman's Forced Response after it attacks you, if it has at least 1
 * hit point. */
export function horsemenAttacked(
  s: GameState,
  attackerId: string,
  playerId: string,
): Effect[] {
  const v = horsemenVillains(s).find((q) => q.id === attackerId);
  if (!v || !active(s, v) || !horsemanStanding(s, v) || !alive(s, playerId))
    return [];
  return [H("forced", { key: horsemanKey(v.code), playerId })];
}
/** The effect each Horseman's Forced Response resolves for a player. */
function forced(key: HorsemanKey, playerId: string): Effect {
  return H(`${key}-effect`, { playerId, actorId: playerId });
}

// ---------------------------------------------------------------- reveals

export function horsemenReveal(s: GameState, p: Piece): Effect[] | null {
  const code = p.code;
  if (
    !(FOUR_HORSEMEN_SCRIPT_CODES as readonly string[]).includes(code) &&
    !(HOUNDS_CODES as readonly string[]).includes(code)
  )
    return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  if (code === GOLDEN_HORSE || code === METAL_WINGS)
    return resolving ? [H("mount", { piece: p, playerId })] : [];
  if (code === ENERGY_SPEAR) return resolving ? [H("spear", { piece: p })] : [];
  if (isTextBlank(s, p)) return [];
  const treachery = HORSEMAN_TREACHERIES[code];
  if (treachery)
    return [H("horseman", { key: treachery, playerId, heal: true })];
  switch (code) {
    case ROUGH_RIDERS:
      return [H("rough-riders", { playerId })];
    case AHAB:
      return [H("ahab", { playerId })];
    case HOUND:
      return [H("hound", { id: p.id, playerId })];
    default:
      return [];
  }
}
/** Release the Hounds: the first copy of Hound revealed each phase gains
 * surge. The engine marks the phase's first Hound as it is revealed. */
export function horsemenRevealCard(s: GameState, p: Piece, c: Card): Card {
  if (
    p.code === HOUND &&
    s.flags.firstHound === p.id &&
    s.sideSchemes.some((q) => q.code === RELEASE_THE_HOUNDS && active(s, q)) &&
    !/^Surge\./m.test(c.text || "")
  )
    return { ...c, text: `Surge.\n${c.text || ""}` };
  return c;
}
/** Record the phase's first revealed Hound. */
export function horsemenHoundRevealed(s: GameState, p: Piece) {
  if (p.code === HOUND && !s.flags.houndThisPhase) {
    s.flags.houndThisPhase = true;
    s.flags.firstHound = p.id;
  }
}
export function horsemenBoost(s: GameState, p: Piece): Effect[] | null {
  const key = HORSEMAN_TREACHERIES[p.code];
  if (!key) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  // After this activation, the Horseman activates against you without a
  // boost card.
  return [H("after-activation", { key, playerId })];
}
/** When Defeated: the player who defeated a Four Horsemen side scheme
 * suffers its Horseman's Forced Response; Release the Hounds deals them a
 * Hound. */
export function horsemenSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  if (!alive(s, playerId)) return [];
  const key = HORSEMEN.find((k) => HORSEMAN_SCHEMES[k] === p.code);
  if (key) return [forced(key, playerId)];
  if (p.code === RELEASE_THE_HOUNDS) return [H("deal-hound", { playerId })];
  return [];
}
/** Golden Horse and Metal Wings: Hero Response after you attack the
 * attached villain. */
export function horsemenAfterHeroAttack(
  s: GameState,
  targetId: string,
): Effect[] {
  if (!s.horsemen) return [];
  const mounts = s.attachments.filter(
    (a) =>
      (a.code === GOLDEN_HORSE || a.code === METAL_WINGS) &&
      a.attachedTo === targetId &&
      active(s, a),
  );
  return mounts.length
    ? [
        H("mount-response", {
          target: targetId,
          playerId: s.activePlayerId,
          actorId: s.activePlayerId,
          mandatory: false,
        }),
      ]
    : [];
}
/** Pestilence: the identity's text box is blank until the next villain
 * phase begins. */
export function horsemenIdentityBlank(s: GameState, playerId: string) {
  return !!s.horsemen?.blank?.includes(playerId);
}
/** The villain phase begins: Pestilence's blank text boxes end. */
export function horsemenVillainPhaseBegins(s: GameState) {
  if (s.horsemen) delete s.horsemen.blank;
  horsemenPhaseBegins(s);
}
/** Each phase: Release the Hounds' first Hound is counted again. */
export function horsemenPhaseBegins(s: GameState) {
  delete s.flags.houndThisPhase;
  delete s.flags.firstHound;
}

// --------------------------------------------------------------- resolver

const activation = (
  s: GameState,
  v: Piece,
  playerId: string,
  omitNormalBoost = false,
): Effect => {
  const kind =
    seatView(s, playerId).player.form === "hero" ? "attack" : "scheme";
  return {
    type: kind === "attack" ? "enemyAttack" : "enemyScheme",
    id: v.id,
    actorId: playerId,
    activation: {
      enemyId: v.id,
      playerId,
      kind,
      modifier: 0,
      ...(omitNormalBoost ? { omitNormalBoost: true } : {}),
    },
  };
};

export function resolveHorsemenEffect(
  s: GameState,
  e: Effect,
  ports: HorsemenPorts,
): boolean {
  if (!e.type.startsWith("horsemen:")) return false;
  const st = s.horsemen;
  switch (e.type) {
    case "horsemen:advance":
      advance(s, ports);
      break;
    case "horsemen:focus-back":
      horsemenCloseWindow(s, e.key);
      break;
    case "horsemen:random-scheme": {
      // Each player reveals a random Four Horsemen side scheme.
      if (!alive(s, e.playerId)) break;
      const codes = Object.values(HORSEMAN_SCHEMES);
      const pool = s.encounter.deck.filter((q) => codes.includes(q.code));
      if (!pool.length) break;
      const p = pool[ports.pick(s, pool.length)];
      ports.reveal(s, p, e.playerId);
      break;
    }
    case "horsemen:forced":
      if (alive(s, e.playerId)) ports.queue(s, forced(e.key, e.playerId));
      break;
    case "horsemen:forced-active":
      // Rough Riders: the next Horseman's Forced Response.
      if (st && alive(s, e.playerId))
        ports.queue(s, forced(st.active, e.playerId));
      break;
    case "horsemen:war-effect": {
      // Discard an upgrade or support you control.
      if (!alive(s, e.playerId)) break;
      const cards = ports.ownCards(s, e.playerId);
      if (cards.length === 1)
        ports.queue(s, { type: "discardPiece", id: cards[0].id });
      else if (cards.length)
        ports.choose(
          s,
          "War",
          "Discard an upgrade or support you control.",
          cards.map((q) => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [{ type: "discardPiece", id: q.id }],
          })),
        );
      break;
    }
    case "horsemen:famine-effect":
      // Discard the top 10 cards of your deck.
      if (alive(s, e.playerId)) ports.mill(s, e.playerId, 10);
      break;
    case "horsemen:pestilence-effect":
      // Your identity's text box is blank until the next villain phase.
      if (st && alive(s, e.playerId) && !st.blank?.includes(e.playerId))
        (st.blank ||= []).push(e.playerId);
      break;
    case "horsemen:death-effect":
      // Deal 1 damage to each character you control.
      if (!alive(s, e.playerId)) break;
      ports.queue(
        s,
        ...ports.characters(s, e.playerId).map((target) => ({
          type: "damage",
          target,
          amount: 1,
          source: "45084a",
          actorId: e.playerId,
        })),
      );
      break;
    case "horsemen:mount": {
      // Golden Horse: the villain with the fewest hit points without the
      // Aerial trait. Metal Wings: Death, who takes the active counter.
      const p = e.piece as Piece;
      if (!st) {
        ports.discardPiece(s, p.id);
        break;
      }
      if (p.code === METAL_WINGS) {
        const death = horsemanVillain(s, "death");
        if (!death) {
          ports.discardPiece(s, p.id);
          break;
        }
        ports.attach(s, p, death.id);
        st.active = "death";
        horsemenFocusActive(s);
        ports.log(s, "Metal Wings: Death takes the active counter.", "bad");
        break;
      }
      const candidates = horsemenVillains(s).filter(
        (v) =>
          !(def(v)?.traits || "").includes("Aerial") &&
          !horsemenAerial(s, v.id),
      );
      if (!candidates.length) {
        ports.discardPiece(s, p.id);
        break;
      }
      const fewest = Math.min(...candidates.map((v) => v.hp || 0));
      const targets = candidates.filter((v) => (v.hp || 0) === fewest);
      if (targets.length === 1) ports.attach(s, p, targets[0].id);
      else
        ports.choose(
          s,
          name(GOLDEN_HORSE),
          "Attach Golden Horse to a villain with the fewest hit points.",
          targets.map((v) => ({
            id: v.id,
            label: name(v),
            image: v.code,
            effects: [H("mount-attach", { piece: p, target: v.id })],
          })),
        );
      break;
    }
    case "horsemen:mount-attach":
      ports.attach(s, e.piece as Piece, e.target);
      break;
    case "horsemen:mount-response": {
      // Hero Response: resolve the attached villain's Forced Response as if
      // it just attacked you, then discard the Golden Horse or Metal Wings.
      const v = horsemenVillains(s).find((q) => q.id === e.target);
      const mount = s.attachments.find(
        (a) =>
          (a.code === GOLDEN_HORSE || a.code === METAL_WINGS) &&
          a.attachedTo === e.target,
      );
      if (!v || !mount || !alive(s, e.playerId)) break;
      const key = horsemanKey(v.code)!;
      ports.choose(s, name(mount), `Discard ${name(mount)}?`, [
        {
          id: "discard",
          label: `Resolve ${name(v)}'s Forced Response · discard ${name(mount)}`,
          image: mount.code,
          effects: [
            forced(key, e.playerId),
            { type: "discardPiece", id: mount.id },
          ],
        },
        { id: "pass", label: "Do not respond", effects: [] },
      ]);
      break;
    }
    case "horsemen:horseman": {
      // Horseman of War/Famine/Pestilence/Death: heal 2, a tough status
      // card, then that Horseman activates against you.
      const v = horsemanVillain(s, e.key);
      if (!v || !alive(s, e.playerId) || over(s)) break;
      ports.queue(
        s,
        { type: "heal", target: v.id, amount: 2, origin: "encounter" },
        { type: "status", target: v.id, status: "tough" },
        activation(s, v, e.playerId),
      );
      break;
    }
    case "horsemen:after-activation":
      // Its boost: after this activation, the Horseman activates against
      // you without a boost card.
      if (st) (st.pending ||= []).push({ key: e.key, playerId: e.playerId });
      break;
    case "horsemen:rough-riders": {
      // The active villain's Forced Response, then the next one's.
      if (!st || !alive(s, e.playerId)) break;
      ports.queue(
        s,
        forced(st.active, e.playerId),
        H("advance"),
        H("forced-active", { playerId: e.playerId }),
      );
      break;
    }
    case "horsemen:ahab": {
      // Release the Hounds gains 3 threat; otherwise it is found and
      // revealed.
      const scheme = s.sideSchemes.find((q) => q.code === RELEASE_THE_HOUNDS);
      if (scheme) {
        ports.queue(s, { type: "threat", target: scheme.id, amount: 3 });
        break;
      }
      for (const zone of [s.encounter.deck, s.encounter.discard]) {
        const p = zone.find((q) => q.code === RELEASE_THE_HOUNDS);
        if (p) {
          ports.reveal(s, p, e.playerId);
          break;
        }
      }
      break;
    }
    case "horsemen:hound": {
      // In hero form, Hound attacks you; otherwise you change to hero form.
      const hound = s.minions.find((m) => m.id === e.id);
      if (!alive(s, e.playerId)) break;
      if (seatView(s, e.playerId).player.form === "hero") {
        if (hound)
          ports.queue(s, {
            type: "enemyAttack",
            id: hound.id,
            actorId: e.playerId,
          });
      } else ports.queue(s, { type: "flip", actorId: e.playerId });
      break;
    }
    case "horsemen:spear": {
      // Attach to Ahab, otherwise to the villain.
      const p = e.piece as Piece;
      const ahab = s.minions.find((m) => m.code === AHAB);
      ports.attach(s, p, ahab ? ahab.id : s.villain.id);
      break;
    }
    case "horsemen:deal-hound": {
      // Search the encounter deck and discard pile for a Hound and deal it
      // to yourself facedown.
      if (!alive(s, e.playerId)) break;
      const inDeck = s.encounter.deck.find((q) => q.code === HOUND);
      const p = inDeck || s.encounter.discard.find((q) => q.code === HOUND);
      if (p) ports.dealFacedown(s, p, e.playerId);
      if (inDeck) ports.shuffleEncounter(s);
      break;
    }
    default:
      throw Error(`Unknown Four Horsemen effect: ${e.type}`);
  }
  return true;
}
