import catalog from "../data/catalog-cards.json" with { type: "json" };
import players from "../data/core-player.json" with { type: "json" };
import type { Card, GameState, Piece } from "./types.js";

const definitions = new Map(
  ([...catalog, ...players] as Card[]).map((c) => [c.code, c]),
);

/** Tech Theft blanks printed text, while retaining stats, traits and icons. */
export function isTextBlank(
  s: GameState,
  p: (Pick<Piece, "code"> & { id?: string }) | string,
) {
  if (!s.sideSchemes.some((scheme) => scheme.code === "12026")) return false;
  const code = typeof p === "string" ? p : p.code;
  const inPlay = [
    s.player,
    ...s.players
      .filter((seat) => seat.id !== s.activePlayerId)
      .map((seat) => seat.player),
  ].some((player) =>
    player.inPlay.some((piece) =>
      typeof p !== "string" && p.id ? piece.id === p.id : piece.code === code,
    ),
  );
  if (!inPlay) return false;
  const c = definitions.get(code);
  return (
    !!c &&
    c.faction_code !== "encounter" &&
    (c.traits || "").split(/\.\s*/).includes("Tech")
  );
}

/** Read-only view for older continuous-effect adapters. Physical zones in the
 * real state remain intact; only sources of printed continuous text are hidden. */
export function textActiveState(s: GameState): GameState {
  if (!s.sideSchemes.some((scheme) => scheme.code === "12026")) return s;
  const player = (p: GameState["player"]) => ({
    ...p,
    inPlay: p.inPlay.filter((piece) => !isTextBlank(s, piece)),
  });
  return {
    ...s,
    player: player(s.player),
    players: s.players.map((seat) => ({
      ...seat,
      player: player(seat.player),
    })),
  };
}
