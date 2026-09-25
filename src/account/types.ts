import type { Aspect, GameState } from "../game/types";

export interface SavedDeck {
  id: string;
  name: string;
  heroId: string;
  aspect: Aspect;
  cards: string[];
  revision: number;
  updatedAt: string;
}
export interface MissionRecord {
  id: string;
  revision: number;
  startedAt: string;
  updatedAt: string;
  heroes: { heroId: string; aspect: Aspect }[];
  villainId: string;
  difficulty: "standard" | "expert";
  module: string;
  round: number;
  outcome: "active" | "won" | "lost";
  result?: string;
  state?: GameState;
}
export interface Library {
  decks: SavedDeck[];
  missions: MissionRecord[];
}
export interface AccountSession {
  user: {
    id: string;
    username: string;
    displayName: string;
    createdAt: string;
  } | null;
  library: Library;
  storage: "local" | "cloud" | "unavailable";
  recoveryCode?: string;
}
export interface DeckDraft {
  id?: string;
  revision?: number;
  name: string;
  heroId: string;
  aspect: Aspect;
  cards: string[];
}
export interface MissionIdentity {
  id: string;
  startedAt: string;
}
