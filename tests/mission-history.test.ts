import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccountHandler, validateGame } from "../server/account.js";
import { sqliteStore } from "../server/storage.js";
import type { Store } from "../server/storage.js";
import { newGame } from "../src/game/engine.js";
import { upgradeSave } from "../src/game/team.js";
import {
  HISTORY_KEY,
  missionRecord,
  readHistory,
  replaySetup,
  writeHistory,
} from "../src/mission-history.js";
import type { GuestRecord } from "../src/mission-history.js";

const source = () =>
  newGame({
    heroId: "colossus",
    aspect: "protection",
    villainId: "sabretooth",
    heroes: [
      { heroId: "colossus", aspect: "protection" },
      { heroId: "shadowcat", aspect: "aggression" },
    ],
    difficulty: "expert",
    modules: ["mystique", "bomb_scare"],
    senatorDamage: 0,
    heroic: 2,
    seed: 3266123,
    pacing: "expert",
  });
function completed() {
  const s = source();
  s.phase = "lost";
  s.accountMission = {
    id: "sabretooth-replay",
    startedAt: "2026-10-13T00:00:00Z",
  };
  return s;
}
function storage(records?: unknown[]) {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  if (records) data.set(HISTORY_KEY, JSON.stringify(records));
  return data;
}
afterEach(() => vi.unstubAllGlobals());
const replay = (record: GuestRecord) =>
  newGame({
    heroId: record.heroes[0].heroId,
    aspect: record.heroes[0].aspect,
    ...replaySetup(record),
  });

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

describe("native Sabretooth saved setup and replay", () => {
  it("replays the exact custom module pair, zero starting damage and actual two-seat opening", () => {
    storage();
    const original = source();
    const record = missionRecord(completed());
    expect(writeHistory([record])).toBe(true);
    const [loaded] = readHistory();
    expect(loaded).toMatchObject({
      module: "mystique",
      modules: ["mystique", "bomb_scare"],
      senatorDamage: 0,
    });
    const restored = replay(loaded);
    expect(restored.modules).toEqual(original.modules);
    expect(restored.sabretooth).toEqual(original.sabretooth);
    expect(restored.encounter.deck).toEqual(original.encounter.deck);
    expect(restored.sideSchemes).toEqual(original.sideSchemes);
    expect(restored.players.map((p) => p.player.hand)).toEqual(
      original.players.map((p) => p.player.hand),
    );
    expect(restored.players.map((p) => p.player.deck)).toEqual(
      original.players.map((p) => p.player.deck),
    );
  });

  it("keeps history and replay arrays independent of the game and each other", () => {
    const original = completed();
    const record = missionRecord(original);
    const setup = replaySetup(record);
    setup.modules!.reverse();
    setup.heroes[0].deckCards!.pop();
    expect(record.modules).toEqual(["mystique", "bomb_scare"]);
    expect(original.modules).toEqual(["mystique", "bomb_scare"]);
    expect(record.heroes[0].deckCards).toHaveLength(40);
    record.modules!.reverse();
    expect(original.modules).toEqual(["mystique", "bomb_scare"]);
  });

  it("derives the primary from a plural-only record before restoring the lobby", () => {
    const record = missionRecord(completed());
    delete record.module;
    storage([record]);
    const [loaded] = readHistory();
    expect(replaySetup(loaded).module).toBe("mystique");
    expect(replay(loaded).modules).toEqual(["mystique", "bomb_scare"]);
  });

  it("restores a genuine legacy primary-only record with a distinct recommended second set", () => {
    const record = missionRecord(completed());
    delete record.modules;
    delete record.senatorDamage;
    storage([record]);
    const [loaded] = readHistory();
    const restored = replay(loaded);
    expect(restored.modules).toEqual(["mystique", "brotherhood"]);
    expect(restored.sabretooth!.startingDamage).toBe(3);
    expect(restored.sabretooth!.kelly!.damage).toBe(3);
  });

  it("preserves saved setup and singleton NPC identity through JSON/team restoration", () => {
    const original = source();
    const restored = upgradeSave(JSON.parse(JSON.stringify(original)));
    expect(restored.modules).toEqual(["mystique", "bomb_scare"]);
    expect(restored.module).toBe("mystique");
    expect(restored.sabretooth).toEqual(original.sabretooth);
    expect(
      restored.players
        .flatMap((p) => p.player.inPlay)
        .some((p) => p.id === restored.sabretooth!.kellyId),
    ).toBe(false);
  });

  it.each([
    ["duplicate", ["mystique", "mystique"]],
    ["too few", ["mystique"]],
    ["too many", ["mystique", "brotherhood", "bomb_scare"]],
    ["unsupported", ["mystique", "future_past"]],
    ["inconsistent primary", ["brotherhood", "mystique"]],
  ])(
    "rejects a %s saved modular pair in guest history and the account validator",
    (_label, modules) => {
      const valid = missionRecord(completed());
      storage([{ ...valid, modules }, valid]);
      expect(readHistory()).toEqual([valid]);
      const state = source();
      state.modules = modules;
      expect(() => validateGame(state)).toThrow(/modular/i);
    },
  );

  it.each([-1, 9, 1.5, null, "0"])(
    "rejects invalid Kelly starting damage %s in history and accounts",
    (startingDamage) => {
      const valid = missionRecord(completed());
      storage([{ ...valid, senatorDamage: startingDamage }, valid]);
      expect(readHistory()).toEqual([valid]);
      const state = source();
      Object.assign(state.sabretooth!, { startingDamage });
      expect(() => validateGame(state)).toThrow(/Kelly/i);
    },
  );

  it.each([0, 8])(
    "accepts the exact starting-damage boundary %s",
    (senatorDamage) => {
      const state = newGame({
        heroId: "colossus",
        aspect: "protection",
        villainId: "sabretooth",
        senatorDamage,
      });
      expect(() => validateGame(state)).not.toThrow();
      expect(state.sabretooth!.startingDamage).toBe(senatorDamage);
    },
  );

  it("retains legacy single-module saves without widening other scenarios to two slots", () => {
    const state = newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "rhino",
    });
    delete state.modules;
    expect(() => validateGame(state)).not.toThrow();
    state.modules = ["bomb_scare", "mystique"];
    expect(() => validateGame(state)).toThrow(/modular/i);
  });

  it("keeps legacy Sabretooth plural metadata absent instead of inventing an invalid one-slot pair", async () => {
    const state = completed();
    delete state.modules;
    const record = missionRecord(state);
    storage();
    writeHistory([record]);
    const [loaded] = readHistory();
    expect(loaded.modules).toBeUndefined();
    expect(replay(loaded).modules).toEqual(["mystique", "brotherhood"]);
    expect(replay(loaded).sabretooth!.startingDamage).toBe(0);

    const store = await sqliteStore(":memory:");
    const registered = await request(store, {
      action: "register",
      username: "legacy_sabretooth",
      displayName: "Legacy",
      password: "a long testing passphrase",
    });
    const saved = await request(
      store,
      {
        action: "mission.save",
        id: "legacy-sabretooth",
        revision: 0,
        accountId: registered.data.user.id,
        startedAt: "2026-10-13T00:00:00Z",
        state,
      },
      registered.cookie,
    );
    expect(saved.status).toBe(200);
    expect(saved.data.library.missions[0]).toMatchObject({
      module: "mystique",
      senatorDamage: 0,
    });
    expect(saved.data.library.missions[0]).not.toHaveProperty("modules");
  });

  it("projects the exact pair and zero override for active and completed account missions", async () => {
    const store = await sqliteStore(":memory:");
    const registered = await request(store, {
      action: "register",
      username: "sabretooth_replay",
      displayName: "Replay",
      password: "a long testing passphrase",
    });
    expect(registered.status).toBe(200);
    const state = source();
    const body = {
      action: "mission.save",
      id: "saved-sabretooth",
      revision: 0,
      accountId: registered.data.user.id,
      startedAt: "2026-10-13T00:00:00Z",
      state,
    };
    const active = await request(store, body, registered.cookie);
    expect(active.status).toBe(200);
    expect(active.data.library.missions[0]).toMatchObject({
      module: "mystique",
      modules: ["mystique", "bomb_scare"],
      senatorDamage: 0,
      outcome: "active",
    });
    expect(active.data.library.missions[0].state.sabretooth.kelly.id).toBe(
      state.sabretooth!.kellyId,
    );
    const finished = await request(
      store,
      {
        ...body,
        revision: 1,
        state: { ...state, phase: "lost", result: "Robert Kelly left play." },
      },
      registered.cookie,
    );
    expect(finished.status).toBe(200);
    expect(finished.data.library.missions[0]).toMatchObject({
      module: "mystique",
      modules: ["mystique", "bomb_scare"],
      senatorDamage: 0,
      outcome: "lost",
    });
    expect(finished.data.library.missions[0]).not.toHaveProperty("state");
  });
});
