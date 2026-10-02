import { describe, expect, it } from "vitest";
import rawCards from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine";
import {
  identityMatch,
  uniqueConflict,
  uniqueMatches,
} from "../src/game/unique";
import type { Card } from "../src/game/types";
const cards = new Map((rawCards as unknown as Card[]).map((c) => [c.code, c]));
const c = (code: string) => cards.get(code)!;

describe("RRG1.8 matching unique cards", () => {
  it("matches reprints and unique places/items but never treats a nonunique title as unique", () => {
    expect(uniqueMatches(c("03012"), c("01066"))).toBe(true);
    expect(uniqueMatches(c("06019"), c("06019"))).toBe(true);
    expect(uniqueMatches({ ...c("06019"), is_unique: false }, c("06019"))).toBe(
      false,
    );
    expect(uniqueMatches(c("01054"), c("01054"))).toBe(false);
  });
  it("allows the same hero title when different subtitles identify different characters", () => {
    expect(uniqueMatches(c("04045"), c("13019"))).toBe(false);
    expect(uniqueMatches(c("12011"), c("13002"))).toBe(false);
    expect(uniqueMatches(c("04045"), c("27049"))).toBe(true);
    expect(uniqueMatches(c("01040a"), c("51001a"))).toBe(false);
    expect(uniqueMatches(c("01040b"), c("51001b"))).toBe(false);
  });
  it("matches a subtitle to another card's title and ignores typographic apostrophe differences", () => {
    expect(uniqueMatches(c("23012"), c("51002"))).toBe(true);
    expect(uniqueMatches(c("51002"), c("23012"))).toBe(true);
    expect(identityMatch("black_panther", c("51002"))).toBe(true);
    expect(identityMatch("black_panther", c("23012"))).toBe(true);
    expect(identityMatch("black_panther_shuri", c("23012"))).toBe(false);
  });
  it("identities match their ally from either face and canonical/alias IDs", () => {
    for (const id of [
      "captain_america",
      "cap:captain_america",
      "03001a",
      "03001b",
    ])
      expect(identityMatch(id, c("21011"))).toBe(true);
    expect(uniqueMatches(c("10001a"), c("01050"))).toBe(true);
    expect(uniqueMatches(c("10001b"), c("01050"))).toBe(true);
    expect(identityMatch("hulk", c("62020"))).toBe(true);
    expect(identityMatch("spider_man", c("13019"))).toBe(false);
    expect(identityMatch("spider_man", c("04045"))).toBe(true);
  });
  it("blocks entry against matching controlled cards, enemies, and all live identities", () => {
    const s = newGame({
      heroId: "captain_america",
      aspect: "leadership",
      villainId: "rhino",
      seed: 8,
    });
    expect(uniqueConflict(s, c("21011"))).toBe(true);
    s.player.form = "alter";
    expect(uniqueConflict(s, c("54012"))).toBe(true);
    s.player.inPlay.push(makePiece(s, "03012"));
    expect(uniqueConflict(s, c("01066"))).toBe(true);
    s.minions.push(makePiece(s, "56185"));
    expect(uniqueConflict(s, c("01059"))).toBe(true);
    expect(uniqueConflict(s, c("13019"))).toBe(false);
  });
  it("eliminated identities leave play, while a matching villain is allowed to enter", () => {
    const s = newGame({
      heroId: "hulk",
      aspect: "aggression",
      villainId: "rhino",
      seed: 8,
    });
    expect(uniqueConflict(s, c("01050"))).toBe(true);
    s.players[0].eliminated = true;
    expect(uniqueConflict(s, c("01050"))).toBe(false);
    s.players[0].eliminated = false;
    expect(uniqueConflict(s, { ...c("10001a"), type_code: "villain" })).toBe(
      false,
    );
  });
  it("can exclude a newly placed unique piece while still detecting another matching card", () => {
    const s = newGame({
      heroId: "hulk",
      aspect: "aggression",
      villainId: "rhino",
      seed: 8,
    });
    const enemy = makePiece(s, "56185");
    s.minions.push(enemy);
    expect(uniqueConflict(s, c("56185"))).toBe(true);
    expect(uniqueConflict(s, c("56185"), enemy.id)).toBe(false);
    s.player.inPlay.push(makePiece(s, "01059"));
    expect(uniqueConflict(s, c("56185"), enemy.id)).toBe(true);
  });
});
