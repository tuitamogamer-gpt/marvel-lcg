import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccountHandler, validateGame } from "../server/account.js";
import { sqliteStore, type Store } from "../server/storage.js";
import sourceDecks from "../src/data/catalog-decks.json";
import { card, scenarioModules } from "../src/game/cards.js";
import { catalogDeckCodes, type CatalogDeck } from "../src/game/catalog.js";
import { newGame, schemeLimit } from "../src/game/engine.js";
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
import { choose, native, passId } from "./dv-test-helpers.js";

const seats = [
  { heroId: "colossus", heroCode: "32001a", aspect: "protection" as Aspect },
  { heroId: "spider_man", heroCode: "01001a", aspect: "justice" as Aspect },
];
const villainCodes = (difficulty: "standard" | "expert") =>
  ["32121", "32122", "32123", "32124"].map(
    (code) => `${code}${difficulty === "expert" ? "b" : "a"}`,
  );
const roomCodes = ["32126", "32127", "32128", "32129"];

function source(
  count = 2,
  difficulty: "standard" | "expert" = "expert",
  module = "mystique",
) {
  const heroes = seats.slice(0, count).map(({ heroId, heroCode, aspect }) => ({
    heroId,
    aspect,
    deckCards: catalogDeckCodes(
      (sourceDecks as unknown as CatalogDeck[]).find(
        (deck) => deck.heroCode === heroCode,
      )!,
    ),
  }));
  expect(heroes.map((hero) => hero.deckCards.length)).toEqual(
    Array(count).fill(40),
  );
  return newGame({
    heroId: heroes[0].heroId,
    aspect: heroes[0].aspect,
    heroes,
    villainId: "mansion_attack",
    difficulty,
    modules: [module],
    seed: 32125172,
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

function archived(state: GameState): GuestRecord {
  const finished = structuredClone(state);
  finished.phase = "lost";
  finished.accountMission = {
    id: "mansion-attack-replay",
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
function playerPieces(state: GameState, playerId: string): Piece[] {
  const player = seatView(state, playerId).player;
  return [
    ...player.deck,
    ...player.hand,
    ...player.discard,
    ...player.inPlay,
    ...(player.setAside || []),
  ];
}
function encounterPieces(state: GameState): Piece[] {
  return [
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...state.resolving,
    ...state.minions,
    ...state.sideSchemes,
    ...state.attachments,
  ];
}
function physicalPieces(state: GameState): Piece[] {
  const scenario = state.mansionAttack!;
  return [
    state.villain,
    ...(scenario.currentMain ? [scenario.currentMain] : []),
    ...scenario.villainDeck,
    ...scenario.mainDeck,
    ...(state.environments || []),
    ...(state.victoryDisplay || []),
    ...state.removed,
    ...encounterPieces(state),
    ...state.players.flatMap((seat) => playerPieces(state, seat.id)),
  ];
}
function setupSnapshot(state: GameState) {
  return {
    mansionAttack: state.mansionAttack,
    villain: state.villain,
    scheme: state.scheme,
    encounter: state.encounter,
    environments: state.environments,
    victoryDisplay: state.victoryDisplay,
    minions: state.minions,
    sideSchemes: state.sideSchemes,
    attachments: state.attachments,
    prompt: state.prompt,
    queue: state.queue,
    seed: state.seed,
    nextId: state.nextId,
    players: state.players.map((seat) => ({
      ...seat,
      player: seatView(state, seat).player,
    })),
  };
}
function settle(state: GameState) {
  for (let attempts = 0; state.prompt && attempts < 30; attempts++) {
    const id =
      passId(state) ||
      (state.prompt.options.length === 1
        ? state.prompt.options[0].id
        : undefined);
    expect(id, JSON.stringify(state.prompt)).toBeDefined();
    state = choose(state, id!);
  }
  expect(state.prompt).toBeNull();
  return state;
}
function expectStartingOpposition(
  state: GameState,
  difficulty: "standard" | "expert",
) {
  const scenario = state.mansionAttack!;
  expect(scenario).toBeDefined();
  expect(scenario.winTarget).toBe(difficulty === "expert" ? 3 : 2);
  expect(state.villain.id).toMatch(/^c\d+$/);
  expect(
    [state.villain, ...scenario.villainDeck].map((p) => p.code).sort(),
  ).toEqual(villainCodes(difficulty));
  expect(scenario.villainDeck).toHaveLength(3);
  expect(scenario.currentMain?.code).toBe(state.scheme.code);
  expect(scenario.currentMain?.code).toMatch(/^3212[6-9]b$/);
  expect(scenario.currentMain?.id).toMatch(/^c\d+$/);
  expect(
    [scenario.currentMain!, ...scenario.mainDeck]
      .map((piece) => piece.code.slice(0, -1))
      .sort(),
  ).toEqual(roomCodes);
  expect(scenario.mainDeck).toHaveLength(3);
  expect(state.environments?.map((piece) => piece.code)).toEqual(["32130"]);
  expect(state.environments?.[0].id).toMatch(/^c\d+$/);
  expect(state.victoryDisplay?.map((piece) => piece.code)).toEqual(["32125b"]);
  expect(state.encounter.dealt.map((piece) => piece.dealtTo).sort()).toEqual(
    state.players.map((seat) => seat.id).sort(),
  );
  const all = physicalPieces(state);
  expect(new Set(all.map((piece) => piece.id)).size).toBe(all.length);
  expect(() => validateGame(state)).not.toThrow();
}

async function request(
  store: Store,
  body: Record<string, unknown>,
  cookie = "",
) {
  const req = Readable.from([JSON.stringify(body)]) as IncomingMessage;
  req.method = "POST";
  req.headers = {
    host: "localhost:5186",
    origin: "http://localhost:5186",
    "content-type": "application/json",
    "x-champions-client": "1",
    cookie,
  };
  Object.defineProperty(req, "socket", {
    value: { remoteAddress: "127.0.0.1" },
  });
  let payload = "";
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
    },
    end(value: string) {
      payload = value;
    },
  };
  await createAccountHandler(store)(req, res as unknown as ServerResponse);
  return {
    status: res.statusCode,
    data: JSON.parse(payload),
    cookie: res.headers["set-cookie"]?.split(";")[0] || cookie,
  };
}

describe("Mansion Attack guest replay and account saves", () => {
  it("replays a source40 solo Standard mission's actual villain, room and opening cards", () => {
    storage();
    const original = source(1, "standard");
    expectStartingOpposition(original, "standard");
    expect(writeHistory([archived(original)])).toBe(true);
    const [record] = readHistory();
    expect(record).toMatchObject({
      villainId: "mansion_attack",
      difficulty: "standard",
      module: "mystique",
      modules: ["mystique"],
      seed: 32125172,
    });
    expect(record.heroes[0].deckCards).toHaveLength(40);
    const restored = replay(record);
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(original));
    expectStartingOpposition(restored, "standard");
  });

  it("recreates both source40 seats, the Expert B-side villain deck and the same shuffled rooms", () => {
    storage();
    const original = source();
    expectStartingOpposition(original, "expert");
    expect(writeHistory([archived(original)])).toBe(true);
    const [record] = readHistory();
    expect(record.heroes.map((hero) => hero.deckCards?.length)).toEqual([
      40, 40,
    ]);
    expect(record.modules).toEqual(["mystique"]);
    const restored = replay(record);
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(original));
    expectStartingOpposition(restored, "expert");
  });

  it("retains alternate Bomb Scare alongside fixed Brotherhood in history and valid account state", () => {
    storage();
    const original = source(2, "expert", "bomb_scare");
    expect(
      scenarioModules("mansion_attack").map((module) => module.id),
    ).toContain("mystique");
    expect(
      scenarioModules("mansion_attack").map((module) => module.id),
    ).not.toContain("brotherhood");
    expect(writeHistory([archived(original)])).toBe(true);
    const [record] = readHistory();
    expect(record.modules).toEqual(["bomb_scare"]);
    const restored = replay(record);
    expect(restored.module).toBe("bomb_scare");
    expect(restored.modules).toEqual(["bomb_scare"]);
    const sets = new Set(
      encounterPieces(restored).map((piece) => card(piece).set_code),
    );
    expect(sets.has("brotherhood")).toBe(true);
    expect(sets.has("bomb_scare")).toBe(true);
    expect(sets.has("mystique")).toBe(false);
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(original));
    expect(() => validateGame(restored)).not.toThrow();
  });

  it.each([
    { name: "fixed Brotherhood", modules: ["brotherhood"] },
    { name: "fixed and recommended", modules: ["mystique", "brotherhood"] },
    { name: "duplicate slot", modules: ["mystique", "mystique"] },
    { name: "extra slot", modules: ["mystique", "bomb_scare"] },
    { name: "unsupported slot", modules: ["future_past"] },
  ])(
    "rejects $name at setup, history and account boundaries",
    ({ modules }) => {
      const original = source();
      const valid = archived(original);
      expect(() =>
        newGame({
          heroId: "colossus",
          aspect: "protection",
          villainId: "mansion_attack",
          modules,
          seed: 32125172,
        }),
      ).toThrow(/modular/i);
      storage([{ ...valid, module: modules[0], modules }, valid]);
      expect(readHistory()).toEqual([valid]);
      const saved = structuredClone(original);
      saved.module = modules[0];
      saved.modules = modules;
      expect(() => validateGame(saved)).toThrow(/mission|modular/i);
    },
  );

  it("uses recommended Mystique when replaying a legacy record without modular fields", () => {
    const original = source(1, "standard");
    const legacy = archived(original);
    delete legacy.module;
    delete legacy.modules;
    storage([legacy]);
    const [record] = readHistory();
    expect(record).toEqual(legacy);
    const restored = replay(record);
    expect(restored.modules).toEqual(["mystique"]);
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(original));
  });

  it("hydrates original physical villains, current and hidden mains, environment, source40 cards and receipts once", () => {
    const original = source();
    const scenario = original.mansionAttack!;
    original.villain.damage = 3;
    original.villain.hp -= 3;
    scenario.currentMain!.counters = 2;
    scenario.mainDeck[0].counters = 1;
    original.environments![0].counters = 4;
    scenario.handledVillainDefeats.push("saved-completed-villain");
    scenario.handledMainCompletions.push("saved-completed-main");
    scenario.handledAttackResponses.push("saved-completed-attack");
    const ids = physicalPieces(original)
      .map((piece) => piece.id)
      .sort();
    const ownedIds = original.players.map((seat) =>
      playerPieces(original, seat.id)
        .filter(
          (piece) =>
            piece.ownerId === seat.id && seat.deckCards?.includes(piece.code),
        )
        .map((piece) => piece.id)
        .sort(),
    );
    expect(ownedIds.map((pieces) => pieces.length)).toEqual([40, 40]);
    const restored = upgradeSave(JSON.parse(JSON.stringify(original)));
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(original));
    expect(restored.player).toBe(
      restored.players.find((seat) => seat.id === restored.activePlayerId)!
        .player,
    );
    expect(
      physicalPieces(restored)
        .map((piece) => piece.id)
        .sort(),
    ).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect(restored.villain).toMatchObject({
      id: original.villain.id,
      code: original.villain.code,
      damage: 3,
      hp: original.villain.hp,
    });
    expect(restored.mansionAttack!.currentMain).toMatchObject({
      id: scenario.currentMain!.id,
      code: original.scheme.code,
      counters: 2,
    });
    expect(restored.environments![0]).toMatchObject({
      id: original.environments![0].id,
      code: "32130",
      counters: 4,
    });
    expect(
      restored.players.map((seat) =>
        playerPieces(restored, seat.id)
          .filter(
            (piece) =>
              piece.ownerId === seat.id && seat.deckCards?.includes(piece.code),
          )
          .map((piece) => piece.id)
          .sort(),
      ),
    ).toEqual(ownedIds);
    expect(() => validateGame(restored)).not.toThrow();
  });

  it("hydrates completed villains and rooms in the victory display alongside the next original sources", () => {
    let state = source(1, "standard");
    state.phase = "player";
    state.player.form = "hero";
    const originalIds = physicalPieces(state)
      .map((piece) => piece.id)
      .sort();
    const defeatedId = state.villain.id;
    const completedId = state.mansionAttack!.currentMain!.id;
    const environmentId = state.environments![0].id;
    state.villain.tough = false;
    state.villain.toughCards = 0;
    state = settle(
      native(state, {
        type: "damage",
        target: state.villain.id,
        amount: state.villain.hp,
        source: "hero",
      }),
    );
    expect(state.villain.id).not.toBe(defeatedId);
    state = settle(
      native(state, {
        type: "threat",
        target: "main",
        amount: schemeLimit(state),
      }),
    );
    expect(state.phase).toBe("player");
    expect(state.mansionAttack!.currentMain!.id).not.toBe(completedId);
    expect(state.mansionAttack!.handledVillainDefeats).toHaveLength(1);
    expect(state.mansionAttack!.handledMainCompletions).toHaveLength(1);
    const restored = upgradeSave(JSON.parse(JSON.stringify(state)));
    expect(setupSnapshot(restored)).toEqual(setupSnapshot(state));
    for (const id of [defeatedId, completedId]) {
      expect(
        restored.victoryDisplay?.filter((piece) => piece.id === id),
      ).toHaveLength(1);
      expect(
        physicalPieces(restored).filter((piece) => piece.id === id),
      ).toHaveLength(1);
    }
    expect(restored.environments![0].id).toBe(environmentId);
    expect(
      physicalPieces(restored)
        .map((piece) => piece.id)
        .sort(),
    ).toEqual(originalIds);
    expect(() => validateGame(restored)).not.toThrow();
  });

  it("saves exact active physical state and completes Mansion Attack account metadata", async () => {
    const store = await sqliteStore(":memory:");
    const registered = await request(store, {
      action: "register",
      username: "mansion_replay",
      displayName: "Mansion Replay",
      password: "a long mansion testing passphrase",
    });
    expect(registered.status).toBe(200);
    const state = source(2, "expert", "bomb_scare");
    state.mansionAttack!.handledAttackResponses.push("saved-earned-attack");
    const body = {
      action: "mission.save",
      id: "saved-mansion-attack",
      revision: 0,
      accountId: registered.data.user.id,
      startedAt: "2026-10-15T00:00:00Z",
      state,
    };
    const active = await request(store, body, registered.cookie);
    expect(active.status).toBe(200);
    const saved = active.data.library.missions[0];
    expect(saved).toMatchObject({
      villainId: "mansion_attack",
      difficulty: "expert",
      module: "bomb_scare",
      modules: ["bomb_scare"],
      outcome: "active",
    });
    const hydrated = upgradeSave(saved.state);
    expect(setupSnapshot(hydrated)).toEqual(setupSnapshot(state));
    expect(() => validateGame(hydrated)).not.toThrow();
    const finished = await request(
      store,
      { ...body, revision: 1, state: { ...state, phase: "won" } },
      registered.cookie,
    );
    expect(finished.status).toBe(200);
    expect(finished.data.library.missions[0]).toMatchObject({
      villainId: "mansion_attack",
      difficulty: "expert",
      modules: ["bomb_scare"],
      outcome: "won",
      revision: 2,
    });
    expect(finished.data.library.missions[0]).not.toHaveProperty("state");
  });
});
