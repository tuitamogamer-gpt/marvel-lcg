import { afterEach, describe, expect, it, vi } from "vitest";
import sourceDecks from "../src/data/catalog-decks.json";
import { validateGame } from "../server/account.js";
import { card, scenarioModules } from "../src/game/cards.js";
import { catalogDeckCodes, type CatalogDeck } from "../src/game/catalog.js";
import { newGame } from "../src/game/engine.js";
import { seatView, upgradeSave } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  HISTORY_KEY,
  missionRecord,
  readHistory,
  replaySetup,
  writeHistory,
  type GuestRecord,
} from "../src/mission-history.js";

const seats = [
  { heroId: "colossus", heroCode: "32001a", aspect: "protection" as Aspect },
  { heroId: "spider_man", heroCode: "01001a", aspect: "justice" as Aspect },
];
function source(
  count = 2,
  difficulty: "standard" | "expert" = "expert",
  module = "zero_tolerance",
) {
  const heroes = seats.slice(0, count).map(({ heroId, heroCode, aspect }) => ({
    heroId,
    aspect,
    deckCards: catalogDeckCodes(
      (sourceDecks as unknown as CatalogDeck[]).find(
        (d) => d.heroCode === heroCode,
      )!,
    ),
  }));
  expect(heroes.every((p) => p.deckCards.length === 40)).toBe(true);
  return newGame({
    heroId: heroes[0].heroId,
    aspect: heroes[0].aspect,
    heroes,
    villainId: "master_mold",
    difficulty,
    modules: [module],
    seed: 32115172,
    pacing: "expert",
  });
}
function storage(records: unknown[] = []) {
  const data = new Map<string, string>([
    [HISTORY_KEY, JSON.stringify(records)],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
}
afterEach(() => vi.unstubAllGlobals());
function archived(s: GameState): GuestRecord {
  const finished = structuredClone(s);
  finished.phase = "lost";
  finished.accountMission = {
    id: "master-mold-replay",
    startedAt: "2026-10-15T00:00:00Z",
  };
  return missionRecord(finished);
}
function replay(record: GuestRecord) {
  return newGame({
    heroId: record.heroes[0].heroId,
    aspect: record.heroes[0].aspect,
    ...replaySetup(record),
    pacing: "expert",
  });
}
function playerPieces(s: GameState, id: string): Piece[] {
  const p = seatView(s, id).player;
  return [
    ...p.deck,
    ...p.hand,
    ...p.discard,
    ...p.inPlay,
    ...(p.setAside || []),
  ];
}
function encounterPieces(s: GameState): Piece[] {
  return [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.resolving,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
  ];
}
function setupSnapshot(s: GameState) {
  return {
    masterMold: s.masterMold,
    villain: s.villain,
    scheme: s.scheme,
    encounter: s.encounter,
    minions: s.minions,
    attachments: s.attachments,
    prompt: s.prompt,
    queue: s.queue,
    players: s.players.map((p) => ({ ...p, player: seatView(s, p).player })),
  };
}

describe("Master Mold guest replay and account saves", () => {
  it("replays a source40 solo Standard mission's actual starting opposition and opening cards", () => {
    storage();
    const original = source(1, "standard");
    expect(original.prompt).toBeNull();
    expect(writeHistory([archived(original)])).toBe(true);
    const [record] = readHistory();
    expect(record).toMatchObject({
      villainId: "master_mold",
      difficulty: "standard",
      modules: ["zero_tolerance"],
    });
    expect(record.heroes[0].deckCards).toHaveLength(40);
    const restored = replay(record);
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(original));
    expect(() => validateGame(restored)).not.toThrow();
  });
  it("recreates the two-seat Expert setup before its first player order decision", () => {
    storage();
    const original = source();
    expect(original.prompt?.title).toBe("Master Mold · each player");
    expect(original.players.map((p) => p.player.hand.length)).toEqual([0, 0]);
    expect(writeHistory([archived(original)])).toBe(true);
    const [record] = readHistory();
    expect(record.heroes.map((p) => p.deckCards?.length)).toEqual([40, 40]);
    const restored = replay(record);
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(original));
    expect(restored.villain.code).toBe("32110");
    expect(() => validateGame(restored)).not.toThrow();
  });
  it("retains an alternate Bomb Scare slot alongside fixed Sentinels in history and valid account state", () => {
    storage();
    const original = source(2, "expert", "bomb_scare");
    expect(scenarioModules("master_mold").map((p) => p.id)).not.toContain(
      "sentinels",
    );
    expect(writeHistory([archived(original)])).toBe(true);
    const [record] = readHistory();
    expect(record.modules).toEqual(["bomb_scare"]);
    const restored = replay(record);
    expect(restored.module).toBe("bomb_scare");
    expect(restored.modules).toEqual(["bomb_scare"]);
    const sets = new Set(
      encounterPieces(restored).map((p) => card(p).set_code),
    );
    expect(sets.has("sentinels")).toBe(true);
    expect(sets.has("bomb_scare")).toBe(true);
    expect(sets.has("zero_tolerance")).toBe(false);
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(original));
    expect(() => validateGame(restored)).not.toThrow();
  });
  it("rejects fixed Sentinels and duplicate or extra modular slots at setup, history and account boundaries", () => {
    const original = source();
    const valid = archived(original);
    const invalid = [
      ["sentinels"],
      ["zero_tolerance", "sentinels"],
      ["zero_tolerance", "zero_tolerance"],
    ];
    for (const modules of invalid) {
      expect(() =>
        newGame({
          heroId: "colossus",
          aspect: "protection",
          villainId: "master_mold",
          modules,
          seed: 32115172,
        }),
      ).toThrow(/modular/i);
      storage([{ ...valid, module: modules[0], modules }, valid]);
      expect(readHistory()).toEqual([valid]);
      const saved = structuredClone(original);
      saved.module = modules[0];
      saved.modules = modules;
      expect(() => validateGame(saved)).toThrow(/mission|modular/i);
    }
  });
  it("hydrates one physical Magneto, source40 player pieces, queued setup and handled receipt metadata", () => {
    const original = source();
    expect(original.prompt?.title).toBe("Master Mold · each player");
    const magneto = original.players
      .flatMap((p) => seatView(original, p).player.inPlay)
      .find((p) => p.id === original.masterMold?.magnetoId)!;
    expect(magneto.code).toBe("32172b");
    magneto.damage = 2;
    magneto.exhausted = true;
    original.masterMold!.handledSchemes.push("saved-completed-scheme");
    original.masterMold!.usedMagnetoResponses.push("saved-earned-response");
    const ids = original.players.map((seat) =>
      playerPieces(original, seat.id)
        .filter(
          (p) => p.ownerId === seat.id && seat.deckCards?.includes(p.code),
        )
        .map((p) => p.id)
        .sort(),
    );
    expect(ids.map((p) => p.length)).toEqual([40, 40]);
    const restored = upgradeSave(JSON.parse(JSON.stringify(original)));
    expect(restored.masterMold).toEqual(original.masterMold);
    expect(restored.queue).toEqual(original.queue);
    expect(restored.prompt).toEqual(original.prompt);
    expect(restored.player).toBe(
      restored.players.find((p) => p.id === restored.activePlayerId)!.player,
    );
    expect(
      restored.players.map((seat) =>
        playerPieces(restored, seat.id)
          .filter(
            (p) => p.ownerId === seat.id && seat.deckCards?.includes(p.code),
          )
          .map((p) => p.id)
          .sort(),
      ),
    ).toEqual(ids);
    const all = [
      ...encounterPieces(restored),
      ...restored.players.flatMap((seat) => playerPieces(restored, seat.id)),
    ];
    const allies = all.filter((p) => p.id === magneto.id);
    expect(allies).toHaveLength(1);
    expect(allies[0]).toMatchObject({
      code: "32172b",
      damage: 2,
      exhausted: true,
    });
    expect(allies[0].ownerId).toBeUndefined();
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(() => validateGame(restored)).not.toThrow();
  });
});
