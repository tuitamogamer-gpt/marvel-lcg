import { ASPECTS, HEROES, MODULES, VILLAINS, deckCodes } from "./game/cards";
import { deckErrors } from "./game/decks";
import type { Aspect, GameState } from "./game/types";
import { readStorage, writeStorage } from "./browser-storage";

export const HISTORY_KEY = "champions.history.v1";
export type GuestRecord = {
  id: string;
  date: string;
  heroes: {
    heroId: string;
    aspect: Aspect;
    deckCards?: string[];
    deckAspects?: Aspect[];
  }[];
  villainId: string;
  /** Older history entries did not record the modular set or deck composition. */
  module?: string;
  difficulty: "standard" | "expert";
  heroic: number;
  round: number;
  outcome: "won" | "lost";
  seed: number;
};

function validRecord(value: unknown): value is GuestRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as GuestRecord;
  return (
    typeof record.id === "string" &&
    !!record.id &&
    typeof record.date === "string" &&
    Number.isFinite(Date.parse(record.date)) &&
    VILLAINS.some((v) => v.id === record.villainId) &&
    (record.module === undefined ||
      MODULES.some((m) => m.id === record.module)) &&
    ["standard", "expert"].includes(record.difficulty) &&
    [0, 1, 2, 3].includes(record.heroic) &&
    Number.isInteger(record.round) &&
    record.round >= 1 &&
    ["won", "lost"].includes(record.outcome) &&
    Number.isInteger(record.seed) &&
    record.seed >= 0 &&
    record.seed <= 0xffffffff &&
    Array.isArray(record.heroes) &&
    record.heroes.length >= 1 &&
    record.heroes.length <= 3 &&
    record.heroes.every(
      (seat) =>
        seat &&
        HEROES.some((h) => h.id === seat.heroId) &&
        ASPECTS.some((a) => a.id === seat.aspect) &&
        (seat.deckAspects === undefined ||
          (Array.isArray(seat.deckAspects) &&
            seat.deckAspects.every((aspect) =>
              ASPECTS.some((a) => a.id === aspect),
            ))) &&
        (seat.deckCards === undefined ||
          !deckErrors(
            seat.heroId,
            seat.aspect,
            seat.deckCards,
            seat.deckAspects,
          ).length),
    ) &&
    new Set(record.heroes.map((seat) => seat.heroId)).size ===
      record.heroes.length
  );
}

export function readHistory(): GuestRecord[] {
  try {
    const records: unknown = JSON.parse(readStorage(HISTORY_KEY) || "[]");
    return Array.isArray(records)
      ? records.filter(validRecord).slice(0, 30)
      : [];
  } catch {
    return [];
  }
}

export function writeHistory(records: GuestRecord[]) {
  return writeStorage(HISTORY_KEY, JSON.stringify(records.slice(0, 30)));
}

export function missionRecord(game: GameState): GuestRecord {
  return {
    id: game.accountMission!.id,
    date: new Date().toISOString(),
    heroes: game.players.map((seat) => ({
      heroId: seat.heroId,
      aspect: seat.aspect,
      // Keep the original ordering: the same seed must reproduce the same shuffle.
      deckCards: [...(seat.deckCards || deckCodes(seat.heroId, seat.aspect))],
      ...(seat.deckAspects ? { deckAspects: [...seat.deckAspects] } : {}),
    })),
    villainId: game.villainId,
    module: game.module,
    difficulty: game.difficulty,
    heroic: game.heroic || 0,
    round: game.round,
    outcome: game.phase as "won" | "lost",
    seed: game.startSeed || 0,
  };
}

export function replaySetup(record: GuestRecord) {
  return {
    heroes: record.heroes.map((seat) => ({
      ...seat,
      ...(seat.deckCards ? { deckCards: [...seat.deckCards] } : {}),
      ...(seat.deckAspects ? { deckAspects: [...seat.deckAspects] } : {}),
    })),
    villainId: record.villainId,
    module:
      record.module || VILLAINS.find((v) => v.id === record.villainId)!.module,
    difficulty: record.difficulty,
    heroic: record.heroic,
    seed: record.seed || undefined,
  };
}
