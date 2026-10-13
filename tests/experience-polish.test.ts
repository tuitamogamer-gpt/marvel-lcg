import { afterEach, describe, expect, it, vi } from "vitest";
import { readStorage, writeStorage } from "../src/browser-storage";
import { matchesSearch, searchTerms, searchText } from "../src/search";
import {
  HISTORY_KEY,
  missionRecord,
  readHistory,
  replaySetup,
  writeHistory,
} from "../src/mission-history";
import { deckCodes, VILLAINS } from "../src/game/cards";
import { newGame } from "../src/game/engine";

afterEach(() => vi.unstubAllGlobals());

function browserStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  return data;
}

function completedMission() {
  const game = newGame({
    heroId: "spider_man",
    aspect: "justice",
    heroes: [
      {
        heroId: "spider_man",
        aspect: "justice",
        deckCards: [...deckCodes("spider_man", "justice")].reverse(),
      },
      {
        heroId: "spider_woman",
        aspect: "aggression",
        deckCards: deckCodes("spider_woman", "aggression", [
          "aggression",
          "justice",
        ]),
        deckAspects: ["aggression", "justice"],
      },
    ],
    villainId: "rhino",
    module: "zzzax",
    difficulty: "expert",
    heroic: 2,
    seed: 123456,
  });
  game.accountMission = {
    id: "replay-fixture",
    startedAt: "2026-10-13T00:00:00Z",
  };
  return game;
}

describe("forgiving catalog search", () => {
  it.each([
    ["Spider-Man Peter Parker", "peter spider man"],
    ["SP//dr Peni Parker", "spdr"],
    ["T’Challa Black Panther", "t'challa"],
    ["S.H.I.E.L.D. Agent", "shield"],
    ["01005 Swinging Web Kick", "#01005"],
    ["Péni Parker", "peni"],
  ])("finds %s using %s", (text, query) => {
    expect(matchesSearch(searchText(text), searchTerms(query))).toBe(true);
  });
  it("requires every search term and accepts empty queries", () => {
    expect(
      matchesSearch(
        searchText("Spider-Man Peter Parker"),
        searchTerms("spider miles"),
      ),
    ).toBe(false);
    expect(matchesSearch(searchText("Spider-Man"), searchTerms("  "))).toBe(
      true,
    );
  });
});

describe("guest mission history", () => {
  it("recreates the same opening hands, deck order, aspects, encounter set and seed", () => {
    browserStorage();
    const original = completedMission();
    const originalHands = structuredClone(
      original.players.map((seat) => seat.player.hand),
    );
    const originalDecks = structuredClone(
      original.players.map((seat) => seat.player.deck),
    );
    original.phase = "won";
    writeHistory([missionRecord(original)]);
    const [record] = readHistory();
    const replay = newGame({
      heroId: record.heroes[0].heroId,
      aspect: record.heroes[0].aspect,
      ...replaySetup(record),
    });
    expect(replay.players.map((seat) => seat.player.hand)).toEqual(
      originalHands,
    );
    expect(replay.players.map((seat) => seat.player.deck)).toEqual(
      originalDecks,
    );
    expect(replay.players[1].deckAspects).toEqual(["aggression", "justice"]);
    expect(replay.encounter.deck).toEqual(original.encounter.deck);
    expect(replay.module).toBe("zzzax");
    expect(replay.difficulty).toBe("expert");
    expect(replay.heroic).toBe(2);
    expect(replay.startSeed).toBe(123456);
  });

  it("captures default starter compositions and does not share mutable deck arrays", () => {
    const game = newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "rhino",
    });
    game.accountMission = { id: "default", startedAt: "2026-10-13T00:00:00Z" };
    game.phase = "lost";
    const record = missionRecord(game);
    expect(record.heroes[0].deckCards).toEqual(
      deckCodes("spider_man", "justice"),
    );
    const replay = replaySetup(record);
    replay.heroes[0].deckCards!.pop();
    expect(record.heroes[0].deckCards).toHaveLength(40);
  });

  it("loads legacy history using the scenario's default module", () => {
    const data = browserStorage();
    const game = completedMission();
    game.phase = "lost";
    const record = missionRecord(game);
    delete record.module;
    record.heroes = record.heroes.map(({ heroId, aspect }) => ({
      heroId,
      aspect,
    }));
    data.set(HISTORY_KEY, JSON.stringify([record]));
    const loaded = readHistory();
    expect(loaded).toHaveLength(1);
    expect(replaySetup(loaded[0]).module).toBe(
      VILLAINS.find((v) => v.id === "rhino")!.module,
    );
  });

  it("ignores corrupt records without discarding valid results", () => {
    const data = browserStorage();
    const game = completedMission();
    game.phase = "won";
    const record = missionRecord(game);
    data.set(
      HISTORY_KEY,
      JSON.stringify([
        null,
        { id: "incomplete" },
        { ...record, heroes: null },
        { ...record, heroes: [{ heroId: "missing", aspect: "justice" }] },
        { ...record, module: "unknown" },
        {
          ...record,
          heroes: [{ ...record.heroes[0], deckCards: ["invalid"] }],
        },
        record,
      ]),
    );
    expect(readHistory()).toEqual([record]);
    data.set(HISTORY_KEY, "{");
    expect(readHistory()).toEqual([]);
  });
});

describe("unavailable browser storage", () => {
  it("keeps reads and preference/history writes safe when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Full", "QuotaExceededError");
      },
    });
    expect(readStorage("champions.sound")).toBeNull();
    expect(writeStorage("champions.sound", "on")).toBe(false);
    expect(readHistory()).toEqual([]);
    expect(writeHistory([])).toBe(false);
  });
});
