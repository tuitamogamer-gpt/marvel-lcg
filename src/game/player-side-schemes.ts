import { card } from "./card-definitions.js";
import type { Effect, GameState, Piece } from "./types.js";

/** These cards have one physical home in the common scheme area. */
export const isPlayerSideScheme = (p: Piece | string) =>
  card(p)?.type_code === "player_side_scheme";

export const playerSideSchemes = (s: GameState) =>
  s.sideSchemes.filter(isPlayerSideScheme);

/** The starting player count is unchanged when a player is eliminated. */
export const playerSideSchemeLimit = (s: GameState) =>
  s.playerCount <= 2 ? 1 : 2;

export function enterPlayerSideScheme(s: GameState, p: Piece): Effect[] {
  p.ownerId ||= s.activePlayerId;
  p.playerSideSchemeController = p.ownerId;
  p.counters =
    (card(p).base_threat || 0) *
    (card(p).base_threat_fixed ? 1 : s.playerCount);
  s.sideSchemes.push(p);
  return [
    { type: "playerSideSchemeLimit", actorId: s.activePlayerId },
    { type: "playerSideSchemeCheckDefeat", id: p.id },
  ];
}

/** When Defeated is a forced interrupt: keep the source until it finishes. */
export function beginPlayerSideSchemeDefeat(
  s: GameState,
  p: Piece,
  source: string,
): Effect[] {
  if (p.pendingDefeat) return [];
  p.pendingDefeat = true;
  return [
    {
      type: "playerSideSchemeReward",
      id: p.id,
      actorId: s.activePlayerId,
    },
    {
      type: "playerSideSchemeFinishDefeat",
      id: p.id,
      source,
      actorId: s.activePlayerId,
    },
  ];
}

export const playerSideSchemeHasVictory = (p: Piece) =>
  /\bVictory\s+\d+/i.test(card(p).text || "");
