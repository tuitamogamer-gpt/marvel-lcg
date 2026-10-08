import type { GameState } from "./game/types";
import { ironheartVersion } from "./game/ironheart";
export interface Milestone {
  title: string;
  detail: string;
  kind: "victory" | "defeat" | "stage" | "upgrade";
}
export function significantEvent(
  before: GameState,
  after: GameState,
): Milestone | null {
  if (
    before.phase !== after.phase &&
    (after.phase === "won" || after.phase === "lost")
  )
    return {
      title: after.phase === "won" ? "VICTORY!" : "MISSION ENDED",
      detail:
        after.phase === "won" ? "The heroes prevail" : "A new challenge awaits",
      kind: after.phase === "won" ? "victory" : "defeat",
    };
  if (after.villain.stage > before.villain.stage)
    return {
      title: "NEXT STAGE",
      detail: `Villain stage ${after.villain.stage}`,
      kind: "stage",
    };
  for (const seat of after.players) {
    const previous = before.players.find((p) => p.id === seat.id);
    if (seat.heroId !== "ironheart" || !previous) continue;
    const version = ironheartVersion({
      ...after,
      player: seat.player,
      flags: seat.flags,
    });
    if (
      version >
      ironheartVersion({
        ...before,
        player: previous.player,
        flags: previous.flags,
      })
    )
      return {
        title: "SUIT UPGRADED",
        detail: `Ironheart · Version ${version}`,
        kind: "upgrade",
      };
  }
  return null;
}
