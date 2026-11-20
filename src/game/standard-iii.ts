import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Age of Apocalypse's Standard III encounter set: it replaces the core
 * Standard set in any scenario that uses it and changes the way nemesis sets
 * enter the game. Pursued by the Past (Permanent, Setup) collects pursuit
 * counters; at 3 more than the number of players, the player who placed the
 * last one is attacked by their nemesis minion or brings their nemesis set
 * in. */

export const STANDARD_III_CODES = [
  "45075a",
  "45075b",
  "45076",
  "45077",
  "45078",
  "45079",
  "45080",
] as const;
export const PURSUED = "45075a";
const PURSUED_B = "45075b";
const DARK_DESIGNS = "45076";
const SINISTER_STRIKE = "45077";
const EVIL_ALLIANCE = "45078";
const NOWHERE_IS_SAFE = "45079";
export const DRAWING_NEAR = "45080";
/** Drawing Near stays in its player's play area. */
export const STANDARD_III_IN_PLAY_OBLIGATIONS = [DRAWING_NEAR] as const;

export interface StandardIIIPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** Pursued by the Past's B side for the player: their nemesis minion is
   * found and revealed, their nemesis side scheme revealed and the rest of
   * their set-aside nemesis set shuffled into the encounter deck. */
  nemesisArrives(s: GameState, playerId: string): void;
  /** Discard the top cards of the player's deck and return them. */
  mill(s: GameState, playerId: string, n: number): Piece[];
  /** The player discards an upgrade or support they control, of their
   * choice. */
  discardUpgradeOrSupport(s: GameState, playerId: string): void;
  discardFromHand(s: GameState, playerId: string, id: string): void;
  /** Whether the card is specific to an identity. */
  identitySpecific(p: Piece): boolean;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `std3:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
export const standardIII = (s: GameState) => !!s.standardIII;
/** Pursued by the Past, on either side. */
export const pursued = (s: GameState) =>
  (s.environments || []).find(
    (p) => p.code === PURSUED || p.code === PURSUED_B,
  );
/** Pursuit counters it takes: 3 more than the number of players. */
export const pursuitLimit = (s: GameState) => s.playerCount + 3;
export const pursuitCount = (s: GameState) => pursued(s)?.counters || 0;
const nemesisSet = (s: GameState, playerId: string) =>
  `${seatView(s, playerId).heroId}_nemesis`;
const isNemesisMinion = (p: Piece) =>
  (def(p)?.set_code || "").endsWith("_nemesis") &&
  def(p)?.type_code === "minion";
/** Pursued by the Past's caption. */
export const pursuedCaption = (s: GameState) =>
  `Pursuit ${pursuitCount(s)} of ${pursuitLimit(s)} · then the placing player's nemesis attacks, or their nemesis set enters`;

// --------------------------------------------------------------- setup

/** Pursued by the Past (Setup) is not shuffled into the encounter deck. */
export const standardIIISetupCard = (code: string) =>
  code === PURSUED || code === PURSUED_B;
/** Standard III replaces the Standard set; Pursued by the Past (Permanent,
 * Setup) begins the game in play. */
export function standardIIISetup(
  s: GameState,
  ports: { makePiece(s: GameState, code: string): Piece },
) {
  s.standardIII = true;
  if (pursued(s)) return;
  const p = ports.makePiece(s, PURSUED);
  p.counters = 0;
  (s.environments ||= []).push(p);
}

// ----------------------------------------------------------------- reveals

/** Place a pursuit counter, then the rest of the card if Pursued by the
 * Past still has counters (its Forced Response may have just removed them). */
const pursuitThen = (playerId: string, then: Effect[]) => [
  E("pursuit", { n: 1, playerId }),
  E("if-counters", { effects: then }),
];

export function standardIIIReveal(s: GameState, p: Piece): Effect[] | null {
  if (!(STANDARD_III_CODES as readonly string[]).includes(p.code)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.activePlayerId;
  const hero = seatView(s, playerId).player.form === "hero";
  switch (p.code) {
    case DARK_DESIGNS:
      return pursuitThen(playerId, [
        E("activate", { playerId, kind: "scheme" }),
      ]);
    case SINISTER_STRIKE:
      return pursuitThen(
        playerId,
        hero
          ? [E("activate", { playerId, kind: "attack" })]
          : [{ type: "surge", sourceCode: p.code }],
      );
    case EVIL_ALLIANCE:
      return [E("alliance", { playerId })];
    case NOWHERE_IS_SAFE:
      return pursuitThen(playerId, [E("discard-own", { playerId })]);
    default:
      return [];
  }
}

export function standardIIIBoost(s: GameState, p: Piece): Effect[] | null {
  if (![DARK_DESIGNS, EVIL_ALLIANCE, NOWHERE_IS_SAFE].includes(p.code))
    return null;
  if (isTextBlank(s, p)) return [];
  const a = s.attack || s.scheming;
  if (!a) return [];
  const playerId =
    s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;
  // After this activation resolves, 1 pursuit counter.
  return [E("after", { effects: [E("pursuit", { n: 1, playerId })] })];
}

// ------------------------------------------------------------- windows

/** Drawing Near's Forced Response after your turn begins: the top card of
 * your deck is discarded, 1 pursuit counter for each printed resource icon
 * on it. */
export function standardIIITurnBegan(s: GameState, playerId: string): Effect[] {
  return seatView(s, playerId)
    .player.inPlay.filter((p) => p.code === DRAWING_NEAR && active(s, p))
    .map((p) => E("drawing-near", { id: p.id, playerId }));
}
export function standardIIIActionSource(
  s: GameState,
  id: string,
): Piece | undefined {
  return s.player.inPlay.find((p) => p.id === id && p.code === DRAWING_NEAR);
}
/** Drawing Near's Alter-Ego Action: discard an identity-specific card from
 * your hand → discard Drawing Near. */
export function standardIIIActions(
  s: GameState,
  p: Piece,
  ports: Pick<StandardIIIPorts, "identitySpecific">,
): Option[] {
  if (s.phase !== "player" || p.code !== DRAWING_NEAR || !active(s, p))
    return [];
  if (
    s.player.form !== "alter" ||
    !s.player.inPlay.some((q) => q.id === p.id) ||
    !s.player.hand.some((q) => ports.identitySpecific(q))
  )
    return [];
  return [
    {
      id: "discard",
      label:
        "Alter-Ego Action · discard an identity-specific card from your hand · discard Drawing Near",
      image: p.code,
      effects: [E("near-action", { id: p.id, playerId: s.activePlayerId })],
    },
  ];
}

// ---------------------------------------------------------------- resolver

const icons = (p: Piece) => {
  const c = def(p);
  return (
    Number(c?.resource_energy || 0) +
    Number(c?.resource_mental || 0) +
    Number(c?.resource_physical || 0) +
    Number(c?.resource_wild || 0)
  );
};

export function resolveStandardIIIEffect(
  s: GameState,
  e: Effect,
  ports: StandardIIIPorts,
): boolean {
  if (!e.type.startsWith("std3:")) return false;
  switch (e.type) {
    case "std3:pursuit": {
      // Pursuit counters; at 3 more than the number of players, its Forced
      // Response removes them and the placing player's nemesis comes.
      const p = pursued(s);
      const n = Number(e.n) || 0;
      if (!p || n <= 0) break;
      p.counters += n;
      ports.log(
        s,
        `Pursued by the Past gains ${n} pursuit ${n === 1 ? "counter" : "counters"} (${p.counters} of ${pursuitLimit(s)}).`,
        "bad",
      );
      if (p.code !== PURSUED || !active(s, p) || p.counters < pursuitLimit(s))
        break;
      p.counters = 0;
      ports.queue(s, E("nemesis", { playerId: e.playerId }));
      break;
    }
    case "std3:nemesis": {
      // Your nemesis minion in play activates against you; otherwise
      // Pursued by the Past flips and brings your nemesis in.
      if (!alive(s, e.playerId)) break;
      const set = nemesisSet(s, e.playerId);
      const minions = s.minions.filter((m) => def(m)?.set_code === set);
      if (minions.length) {
        const kind =
          seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme";
        for (const m of minions)
          ports.activate(s, {
            enemyId: m.id,
            playerId: e.playerId,
            kind,
            modifier: 0,
          });
        break;
      }
      const p = pursued(s);
      if (!p) break;
      p.code = PURSUED_B;
      ports.log(
        s,
        "Pursued by the Past flips: your nemesis catches up with you.",
        "bad",
      );
      ports.queue(s, E("flip-back", { id: p.id }));
      ports.nemesisArrives(s, e.playerId);
      break;
    }
    case "std3:flip-back": {
      const p = (s.environments || []).find((q) => q.id === e.id);
      if (p) p.code = PURSUED;
      break;
    }
    case "std3:if-counters":
      if (pursuitCount(s) > 0) ports.queue(s, ...(e.effects as Effect[]));
      break;
    case "std3:activate":
      // The villain schemes against you or attacks you.
      if (!alive(s, e.playerId) || !s.villain) break;
      ports.activate(s, {
        enemyId: s.villain.id,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
      });
      break;
    case "std3:alliance": {
      // Each nemesis minion in play activates against you; with none, 3
      // pursuit counters.
      if (!alive(s, e.playerId)) break;
      const minions = s.minions.filter(isNemesisMinion);
      if (!minions.length) {
        ports.queue(s, E("pursuit", { n: 3, playerId: e.playerId }));
        break;
      }
      const kind =
        seatView(s, e.playerId).player.form === "hero" ? "attack" : "scheme";
      for (const m of minions)
        ports.activate(s, {
          enemyId: m.id,
          playerId: e.playerId,
          kind,
          modifier: 0,
        });
      break;
    }
    case "std3:discard-own":
      if (alive(s, e.playerId))
        ports.discardUpgradeOrSupport(s, String(e.playerId));
      break;
    case "std3:after": {
      const a = s.attack || s.scheming;
      if (a) (a.afterActivation ||= []).push(...(e.effects as Effect[]));
      break;
    }
    case "std3:drawing-near": {
      if (!alive(s, e.playerId)) break;
      const [p] = ports.mill(s, e.playerId, 1);
      if (!p) break;
      const n = icons(p);
      ports.log(s, `Drawing Near discards ${name(p)}.`, "bad");
      if (n > 0) ports.queue(s, E("pursuit", { n, playerId: e.playerId }));
      break;
    }
    case "std3:near-action": {
      const hand = seatView(s, e.playerId).player.hand.filter((q) =>
        ports.identitySpecific(q),
      );
      if (!hand.length) break;
      ports.choose(
        s,
        name(DRAWING_NEAR),
        "Discard an identity-specific card from your hand.",
        hand.map((q): Option => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            E("near-discard", {
              id: e.id,
              cardId: q.id,
              playerId: e.playerId,
              actorId: e.playerId,
            }),
          ],
        })),
      );
      break;
    }
    case "std3:near-discard":
      ports.discardFromHand(s, e.playerId, e.cardId);
      ports.discardPiece(s, e.id);
      break;
    default:
      throw Error(`Unknown Standard III effect: ${e.type}`);
  }
  return true;
}
