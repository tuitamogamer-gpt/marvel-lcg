/**
 * Pending acceptance fixtures for a hero deliberately unavailable in the
 * installed engine. The final pre-publication run failed at launch/integration.
 * Activate as *.test.ts after native adapters and deck rules are implemented.
 * These fixtures are not evidence of playable support.
 */
import { describe, expect, it } from "vitest";
import { card, handSize, heroStats } from "../src/game/cards";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine";
import {
  heroRequiredCards,
  heroStarterCodes,
  validateHeroDeck,
} from "../src/game/hero-runtime";
import { spiderWomanHasAerial } from "../src/game/spider-woman";
import { seatView } from "../src/game/team";
import type { Command, Effect, GameState, Piece } from "../src/game/types";

function command(input: GameState, c: Command) {
  let s = dispatch(input, c);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  let guard = 0;
  while (s.review && guard++ < 80) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function base(team = false) {
  let s = newGame({
    heroId: "spider_woman",
    aspect: "aggression",
    villainId: "rhino",
    seed: 41,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "spider_woman", aspect: "aggression" as const },
            { heroId: "black_widow", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (team) s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.hand = [];
    view.player.inPlay = [];
    view.player.discard = [];
    view.player.deck = [
      makePiece(s, "04050"),
      makePiece(s, "04051"),
      makePiece(s, "04052"),
    ];
  }
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.scheme.threat = 0;
  return s;
}
function put(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function minion(s: GameState, code = "04056", playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function scheme(s: GameState, code = "04055", counters = 3) {
  const p = makePiece(s, code);
  p.counters = counters;
  s.sideSchemes.push(p);
  return p;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function reveal(s: GameState, code: string, skip = true) {
  return native(s, { type: "reveal", piece: makePiece(s, code), skip });
}
function playPaid(s: GameState, p: Piece, ids: string[], agility = "yes") {
  s = command(s, { type: "PLAY", id: p.id });
  if (s.prompt?.kind === "payment") s = command(s, { type: "PAY", ids });
  if (s.prompt?.title === "Superhuman Agility") s = choose(s, agility);
  return s;
}
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

describe("Spider-Woman's full retail set through actual engine commands", () => {
  it("launches the published 40-card, two-aspect deck with 11HP and correct forms", () => {
    const codes = heroStarterCodes("spider_woman");
    expect(codes).toHaveLength(40);
    const s = newGame({
      heroId: "spider_woman",
      aspect: "aggression",
      villainId: "rhino",
      seed: 41,
      heroes: [
        { heroId: "spider_woman", aspect: "aggression", deckCards: codes },
      ],
    });
    expect(
      [...s.player.hand, ...s.player.deck].map((p) => p.code).sort(),
    ).toEqual(codes.slice().sort());
    expect(s.player.hp).toBe(11);
    expect(handSize(s)).toBe(6);
    expect(
      validateHeroDeck("spider_woman", ["aggression", "justice"], codes).valid,
    ).toBe(true);
    s.player.form = "hero";
    expect(handSize(s)).toBe(5);
    expect(heroStats(s)).toMatchObject({ attack: 1, thwart: 1, defense: 1 });
  });
  it("counts chosen colored signatures when enforcing equality, including the Pool aspect", () => {
    const signatures = Object.entries(
      heroRequiredCards("spider_woman"),
    ).flatMap(([code, count]) => Array<string>(count).fill(code));
    const leadership = [
      ...Array<string>(3).fill("01069"),
      ...Array<string>(3).fill("01070"),
      ...Array<string>(3).fill("01071"),
      "01072",
    ];
    const pool = [
      ...Array<string>(3).fill("44017"),
      ...Array<string>(3).fill("44021"),
      ...Array<string>(3).fill("44029"),
      "44025",
      "44026",
      "44027",
    ];
    const legal = [
      ...signatures,
      ...leadership,
      ...pool,
      "04050",
      "04051",
      "04052",
    ];
    expect(legal).toHaveLength(40);
    expect(
      validateHeroDeck("spider_woman", ["leadership", "pool"], legal),
    ).toMatchObject({ valid: true, errors: [] });
    const unequal = [
      ...signatures,
      ...leadership,
      ...pool.slice(0, 10),
      "04050",
      "04051",
      "04052",
      "01086",
      "01086",
    ];
    expect(unequal).toHaveLength(40);
    expect(
      validateHeroDeck("spider_woman", ["leadership", "pool"], unequal).valid,
    ).toBe(false);
  });
  it("accepts each colored signature interrupt before its effect and grants four basic-power bonuses", () => {
    let s = base();
    s.scheme.threat = 4;
    s.player.hp = 7;
    const initial = heroStats(s);
    for (const [code, faction] of [
      ["04035", "aggression"],
      ["04036", "leadership"],
      ["04037", "protection"],
      ["04038", "justice"],
    ]) {
      const h = hand(s, code, "04050");
      s = playPaid(s, h[0], [h[1].id]);
      expect(s.flags[`swAgility:${faction}`]).toBe(s.round);
      if (["04035", "04036"].includes(code)) s = choose(s, s.villain.id);
      if (code === "04038") s = choose(s, "main:3");
    }
    expect(heroStats(s)).toMatchObject({
      attack: initial.attack + 4,
      thwart: initial.thwart + 4,
      defense: initial.defense + 4,
    });
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(true);
    expect(s.villain.stunned).toBe(true);
    expect(s.villain.confused).toBe(true);
    expect(s.scheme.threat).toBe(1);
  });
  it("declining Agility preserves that aspect's later interrupt and resources spent do not qualify", () => {
    let s = base();
    let h = hand(s, "04035", "04050");
    s = playPaid(s, h[0], [h[1].id], "skip");
    s = choose(s, s.villain.id);
    expect(s.flags["swAgility:aggression"]).toBeUndefined();
    h = hand(s, "04035", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    s = choose(s, s.villain.id);
    expect(heroStats(s).attack).toBe(2);
    h = hand(s, "04035", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    expect(s.prompt?.title).not.toBe("Superhuman Agility");
    s = choose(s, s.villain.id);
    expect(heroStats(s).attack).toBe(2);
  });
  it("Finesse pays only for aspect cards in hero form and canceled payment never exhausts it", () => {
    let s = base();
    const finesse = put(s, "04033");
    const h = hand(s, "04038", "04039", "04050");
    s.scheme.threat = 3;
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(
      paymentSources(s, h[0].id, s.prompt?.paymentTarget).some(
        (p) => p.id === finesse.id,
      ),
    ).toBe(true);
    s = command(s, { type: "CANCEL" });
    expect(s.player.inPlay.find((p) => p.id === finesse.id)?.exhausted).toBe(
      false,
    );
    s = command(s, { type: "PLAY", id: h[1].id });
    expect(
      paymentSources(s, h[1].id, s.prompt?.paymentTarget).some(
        (p) => p.id === finesse.id,
      ),
    ).toBe(false);
    s = command(s, { type: "CANCEL" });
    s = playPaid(s, h[0], [finesse.id]);
    s = choose(s, "main:3");
    expect(s.player.inPlay.find((p) => p.id === finesse.id)?.exhausted).toBe(
      true,
    );
    s.player.inPlay.find((p) => p.id === finesse.id)!.exhausted = false;
    s.player.form = "alter";
    expect(
      paymentSources(s, undefined, "04038").some((p) => p.id === finesse.id),
    ).toBe(false);
  });
  it("Jessica Drew looks at an encounter top card once per round without moving or shuffling it", () => {
    let s = base();
    s.player.form = "alter";
    const top = makePiece(s, "04057");
    s.encounter.deck = [top, makePiece(s, "04056")];
    const ids = s.encounter.deck.map((p) => p.id);
    const hidden = s.hiddenInfo || 0;
    s = command(s, { type: "ABILITY", id: "identity", action: "double-agent" });
    expect(s.prompt?.options.every((o) => !o.image)).toBe(true);
    const id = s.prompt!.options.find((o) => /encounter/i.test(o.label))!.id;
    s = choose(reload(s), id);
    expect(s.prompt?.options[0].image).toBe("04057");
    s = choose(reload(s), "done");
    expect(s.encounter.deck.map((p) => p.id)).toEqual(ids);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    expect(
      dispatch(s, { type: "ABILITY", id: "identity", action: "double-agent" })
        .error,
    ).toBeTruthy();
  });
  it("Apartment searches exactly the first five cards and reload keeps the exact chosen instance", () => {
    let s = base();
    s.player.form = "alter";
    const house = put(s, "04034");
    s.player.deck = ["04050", "04039", "04032", "04033", "04035", "04038"].map(
      (code) => makePiece(s, code),
    );
    const chosen = s.player.deck[4],
      outside = s.player.deck[5];
    const oldIds = s.player.deck.map((p) => p.id);
    s = command(s, { type: "ABILITY", id: house.id, action: "apartment" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([chosen.id]);
    expect(s.player.inPlay.find((p) => p.id === house.id)?.exhausted).toBe(
      true,
    );
    s = choose(reload(s), chosen.id);
    expect(s.player.hand).toContainEqual(chosen);
    expect(s.player.hand).not.toContainEqual(outside);
    expect(s.player.deck.map((p) => p.id).sort()).toEqual(
      oldIds.filter((id) => id !== chosen.id).sort(),
    );
  });
  it("Inconspicuous commits its entire distribution before any side-scheme defeat response", () => {
    let s = base();
    const a = scheme(s, "04055", 1),
      b = scheme(s, "01110", 2);
    const investigator = put(s, "04047");
    const top = s.player.deck[0];
    const h = hand(s, "04038", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    s = choose(s, `${a.id}:1`);
    expect(s.sideSchemes.map((p) => [p.id, p.counters])).toEqual([
      [a.id, 1],
      [b.id, 2],
    ]);
    s = choose(reload(s), `${b.id}:2`);
    expect(s.sideSchemes).toHaveLength(0);
    expect(s.prompt?.title).toBe("Skilled Investigator");
    s = choose(s, "yes");
    expect(s.player.hand).toContainEqual(top);
    expect(
      s.player.inPlay.find((p) => p.id === investigator.id)?.exhausted,
    ).toBe(true);
    if (s.prompt?.title === "Skilled Investigator") s = choose(s, "skip");
    expect(s.prompt).toBeNull();
  });
  it("initial Crisis and Patrol legality prevents simultaneous Inconspicuous main-scheme allocation", () => {
    let s = base();
    s.scheme.threat = 3;
    const crisis = scheme(s, "01108", 1),
      other = scheme(s, "04055", 2);
    const h = hand(s, "04038", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    expect(s.prompt?.options.some((o) => o.id.startsWith("main:"))).toBe(false);
    s = choose(s, `${crisis.id}:1`);
    expect(s.prompt?.options.some((o) => o.id.startsWith("main:"))).toBe(false);
    s = choose(s, `${other.id}:2`);
    expect(s.scheme.threat).toBe(3);
    expect(s.sideSchemes).toHaveLength(0);
  });
  it("Confused consumes the single Inconspicuous thwart while its play interrupt still applies", () => {
    let s = base();
    s.player.confused = true;
    s.player.confuseCards = 1;
    s.scheme.threat = 3;
    const h = hand(s, "04038", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(3);
    expect(s.flags["swAgility:justice"]).toBe(s.round);
    expect(s.prompt).toBeNull();
  });
  it("Glide grants Aerial until round end, readies the identity and survives a form change", () => {
    let s = base();
    s.player.exhausted = true;
    const h = hand(s, "04039", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    expect(s.player.exhausted).toBe(false);
    expect(spiderWomanHasAerial(s)).toBe(true);
    expect(heroStats(s).attack).toBe(1);
    s = command(s, { type: "FLIP" });
    expect(spiderWomanHasAerial(s)).toBe(true);
    s.round++;
    expect(spiderWomanHasAerial(s)).toBe(false);
  });
  it("Contaminant Immunity heals three and gives Tough, but cannot be played when neither part changes state", () => {
    let s = base();
    s.player.hp = 8;
    let h = hand(s, "04037", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    expect(s.player.hp).toBe(11);
    expect(s.player.tough).toBe(true);
    h = hand(s, "04037", "04050");
    expect(playable(s, h[0])).toContain("Tough");
    const before = reload(s);
    const rejected = dispatch(s, { type: "PLAY", id: h[0].id });
    expect(rejected.error).toBeTruthy();
    expect(rejected.player.hand).toEqual(before.player.hand);
  });
  it("Press the Advantage draws after a surviving stunned enemy and never after the target leaves play", () => {
    let s = base();
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    let h = hand(s, "04043", "04050");
    const top = s.player.deck[0];
    s = playPaid(s, h[0], [h[1].id]);
    s = choose(s, s.villain.id);
    expect(s.player.hand).toContainEqual(top);
    const target = minion(s);
    target.stunned = true;
    target.stunCards = 1;
    target.damage = (card(target).health || 0) - 1;
    h = hand(s, "04043", "04050");
    const before = s.player.deck.length;
    s = playPaid(s, h[0], [h[1].id]);
    s = choose(s, target.id);
    expect(s.minions.some((p) => p.id === target.id)).toBe(false);
    expect(s.player.deck).toHaveLength(before);
  });
  it("Captain Marvel draws before lethal consequential damage after a real basic attack", () => {
    let s = base();
    const ally = put(s, "04032");
    ally.damage = (card(ally).health || 0) - 1;
    const top = s.player.deck[0];
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    if (s.prompt?.title !== "Captain Marvel") s = choose(s, s.villain.id);
    expect(s.prompt?.title).toBe("Captain Marvel");
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    s = choose(reload(s), "yes");
    expect(s.player.hand).toContainEqual(top);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
  });
  it("Captain Marvel's canceled Stunned basic power never grants a draw or consequential damage", () => {
    let s = base();
    const ally = put(s, "04032");
    ally.stunned = true;
    ally.stunCards = 1;
    const hp = s.villain.hp,
      before = s.player.deck.length;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    if (s.prompt) s = choose(s, s.villain.id);
    expect(s.villain.hp).toBe(hp);
    expect(s.player.deck).toHaveLength(before);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      stunned: false,
      damage: 0,
    });
  });
  it("Spider-Girl's real hand play stuns and confuses a chosen minion, while put-into-play does not", () => {
    let s = base();
    const target = minion(s);
    let h = hand(s, "04040", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    expect(s.prompt?.title).toBe("Spider-Girl");
    s = choose(s, "yes");
    s = choose(s, target.id);
    expect(s.minions.find((p) => p.id === target.id)).toMatchObject({
      stunned: true,
      confused: true,
    });
    s = base();
    const handPiece = hand(s, "04040")[0];
    minion(s);
    s = native(s, { type: "putAlly", id: handPiece.id });
    expect(s.prompt?.title).not.toBe("Spider-Girl");
  });
  it("Spider-Man's hand-play response removes six threat in two-player play without using a thwart power", () => {
    let s = base(true);
    s.player.confused = true;
    const target = scheme(s, "04055", 6);
    const h = hand(s, "04045", "04050", "04051", "04052");
    s = playPaid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(s.prompt?.title).toBe("Spider-Man");
    s = choose(s, "yes");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([target.id]);
    s = choose(s, target.id);
    expect(s.sideSchemes).toHaveLength(0);
    expect(s.player.confused).toBe(true);
    expect(s.scheme.threat).toBe(0);
  });
  it("Skilled Investigator responds for another hero's controller and obeys its printed one-per-player limit", () => {
    let s = base(true);
    const other = s.players[1].id,
      investigator = put(s, "04047", other);
    const side = scheme(s, "04055", 1);
    const top = seatView(s, other).player.deck[0];
    s = native(s, { type: "thwart", target: side.id, amount: 1 });
    expect(s.prompt?.title).toBe("Skilled Investigator");
    s = choose(reload(s), "yes");
    expect(seatView(s, other).player.hand).toContainEqual(top);
    expect(
      seatView(s, other).player.inPlay.find((p) => p.id === investigator.id)
        ?.exhausted,
    ).toBe(true);
    s = base();
    put(s, "04047");
    const duplicate = hand(s, "04047")[0];
    expect(playable(s, duplicate)).toContain("maximum 1");
  });
  it("the original Piercing Strike face removes Tough and deals its full three damage", () => {
    let s = base();
    s.villain.tough = true;
    s.villain.toughCards = 1;
    const h = hand(s, "04044", "04050"),
      hp = s.villain.hp;
    s = playPaid(s, h[0], [h[1].id]);
    s = choose(s, s.villain.id);
    expect(s.villain.hp).toBe(hp - 3);
    expect(s.villain.tough).toBe(false);
    expect(s.player.discard.find((p) => p.id === h[0].id)?.code).toBe("04044");
  });
  it("Clear the Area draws only after removing the last threat on its actual target", () => {
    let s = base();
    s.scheme.threat = 2;
    let h = hand(s, "04049", "04050"),
      top = s.player.deck[0];
    s = playPaid(s, h[0], [h[1].id]);
    s = choose(s, "main");
    expect(s.scheme.threat).toBe(0);
    expect(s.player.hand).toContainEqual(top);
    s.scheme.threat = 3;
    h = hand(s, "04049", "04050");
    const count = s.player.deck.length;
    s = playPaid(s, h[0], [h[1].id]);
    s = choose(s, "main");
    expect(s.scheme.threat).toBe(1);
    expect(s.player.deck).toHaveLength(count);
  });
  it("Combat Training and Heroic Intuition preserve printing IDs and grant their actual core modifiers", () => {
    let s = base();
    let h = hand(s, "04041", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    expect(s.player.inPlay.some((p) => p.code === "04041")).toBe(true);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 2, defense: 2 });
    h = hand(s, "04046", "04050");
    s = playPaid(s, h[0], [h[1].id]);
    expect(heroStats(s)).toMatchObject({ attack: 4, thwart: 4, defense: 3 });
    h = hand(s, "04041");
    expect(playable(s, h[0])).toBeTruthy();
  });
  it("Tac Team initializes three counters and its third real use discards that physical support", () => {
    let s = base();
    const h = hand(s, "04042", "04050", "04051");
    const hp = s.villain.hp;
    s = playPaid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.counters).toBe(3);
    for (let use = 1; use <= 3; use++) {
      s.player.inPlay.find((p) => p.id === h[0].id)!.exhausted = false;
      s = command(s, { type: "ABILITY", id: h[0].id });
      s = choose(s, s.villain.id);
      expect(s.villain.hp).toBe(hp - use * 2);
    }
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(false);
    expect(s.player.discard.find((p) => p.id === h[0].id)?.code).toBe("04042");
  });
  it("Interrogation Room's printed alias triggers only after an actual minion defeat and exhausts", () => {
    let s = base();
    const room = put(s, "04048"),
      target = minion(s);
    s.scheme.threat = 2;
    s = native(s, {
      type: "damage",
      target: target.id,
      amount: 10,
      attack: true,
      source: "hero",
    });
    expect(s.prompt?.title).toBe("Interrogation Room");
    s = choose(s, "yes");
    s = choose(s, "main");
    expect(s.scheme.threat).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === room.id)?.exhausted).toBe(true);
  });
  it("all three printed double-resource cards generate exactly their original resources", () => {
    const s = base();
    const h = hand(s, "04050", "04051", "04052");
    expect(
      h.map(
        (p) =>
          paymentSources(s).find((source) => source.id === p.id)?.resources,
      ),
    ).toEqual([
      ["energy", "energy"],
      ["mental", "mental"],
      ["physical", "physical"],
    ]);
  });
  it("Uncertain Loyalties offers no unprinted form flip and charges its actual branch", () => {
    let s = base();
    s = reveal(s, "04053");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["threat"]);
    s = choose(s, "threat");
    expect(s.player.form).toBe("hero");
    expect(s.scheme.threat).toBe(3);
    expect(s.encounter.discard.some((p) => p.code === "04053")).toBe(true);
    s = base();
    s.player.form = "alter";
    s = reveal(s, "04053");
    s = choose(s, "exhaust");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((p) => p.code === "04053")).toBe(true);
    expect(s.scheme.threat).toBe(0);
  });
  it("Viper reduces only its engaged player's actual hand size in both forms and ends on defeat", () => {
    let s = base(true);
    const other = s.players[1].id;
    const viper = minion(s, "04054", other);
    expect(handSize(s)).toBe(5);
    expect(handSize(seatView(s, other))).toBe(4);
    seatView(s, other).player.form = "alter";
    expect(handSize(seatView(s, other))).toBe(5);
    s = native(s, {
      type: "damage",
      target: viper.id,
      amount: 100,
      source: "test",
    });
    expect(handSize(seatView(s, other))).toBe(6);
  });
  it("Ambition places its printed fixed two threat plus one per player and revealed Regular uses Incite", () => {
    let s = base(true);
    s = reveal(s, "04055");
    expect(s.sideSchemes.find((p) => p.code === "04055")?.counters).toBe(4);
    const before = s.scheme.threat;
    s = reveal(s, "04056");
    expect(s.scheme.threat).toBe(before + 1);
    expect(s.minions.some((p) => p.code === "04056")).toBe(true);
  });
  it("Hail Hydra attacks only Hydra minions engaged with heroes, then searches for unattacked players without Incite", () => {
    let s = base(true);
    const first = s.activePlayerId,
      other = s.players[1].id;
    seatView(s, other).player.form = "alter";
    const attacker = minion(s, "04056", first);
    minion(s, "04056", other);
    minion(s, "01103", first);
    const searched = makePiece(s, "04056");
    s.encounter.deck = [searched, makePiece(s, "08020")];
    s.encounter.discard = [];
    const hp = s.player.hp,
      threat = s.scheme.threat;
    s = reveal(s, "04057");
    expect(s.attack?.attacker).toBe(attacker.id);
    s = choose(s, "take");
    expect(seatView(s, first).player.hp).toBe(
      hp - (card(attacker).attack || 0),
    );
    expect(s.prompt?.title).toBe("Hail Hydra!");
    s = choose(reload(s), searched.id);
    expect(s.minions.find((p) => p.id === searched.id)?.engagedWith).toBe(
      other,
    );
    expect(s.scheme.threat).toBe(threat);
    expect(s.prompt).toBeNull();
  });
  it("Hail Hydra counts the hero who defended as attacked and makes the original engaged player search", () => {
    let s = base(true);
    const first = s.activePlayerId,
      other = s.players[1].id;
    minion(s, "04056", first);
    const searched = makePiece(s, "04056");
    s.encounter.deck = [searched, makePiece(s, "08020")];
    s = reveal(s, "04057");
    s = choose(reload(s), `hero:${other}`);
    expect(s.prompt?.title).toBe("Hail Hydra!");
    expect(s.prompt?.text).toContain(first);
    s = choose(reload(s), searched.id);
    expect(s.minions.find((p) => p.id === searched.id)?.engagedWith).toBe(
      first,
    );
    expect(s.prompt).toBeNull();
  });
  it("another player's ally defense redirects Hail Hydra's attacked-player condition without Captain Marvel drawing", () => {
    let s = base(true);
    const first = s.activePlayerId,
      other = s.players[1].id;
    minion(s, "04056", first);
    const defender = put(s, "04032", other),
      searched = makePiece(s, "04056");
    s.encounter.deck = [searched, makePiece(s, "08020")];
    const deckLength = seatView(s, other).player.deck.length;
    s = reveal(s, "04057");
    s = choose(reload(s), defender.id);
    expect(s.prompt?.title).toBe("Hail Hydra!");
    expect(s.prompt?.text).toContain(first);
    expect(seatView(s, other).player.deck).toHaveLength(deckLength);
    s = choose(s, searched.id);
    expect(s.minions.find((p) => p.id === searched.id)?.engagedWith).toBe(
      first,
    );
    expect(s.prompt).toBeNull();
  });
  it("Hail Hydra keeps resolving when its original revealing player is eliminated by its minion attack", () => {
    let s = base(true);
    const first = s.activePlayerId,
      other = s.players[1].id;
    s.player.hp = 1;
    minion(s, "04056", first);
    const searched = makePiece(s, "04056");
    s.encounter.deck = [searched, makePiece(s, "08020")];
    s = reveal(s, "04057");
    s = choose(reload(s), "take");
    expect(s.players.find((p) => p.id === first)?.eliminated).toBe(true);
    expect(s.result).toBeUndefined();
    expect(s.prompt?.title).toBe("Hail Hydra!");
    expect(s.prompt?.text).toContain(other);
    s = choose(reload(s), searched.id);
    expect(s.minions.find((p) => p.id === searched.id)?.engagedWith).toBe(
      other,
    );
    expect(s.prompt).toBeNull();
  });
  it("a Hail Hydra searched Quickstrike minion runs its native entry activation without When Revealed", () => {
    let s = base();
    const searched = makePiece(s, "03028");
    searched.damage = 2;
    searched.exhausted = true;
    s.encounter.discard = [searched];
    s.encounter.deck = [makePiece(s, "08020")];
    const hp = s.player.hp;
    s = reveal(s, "04057");
    s = choose(reload(s), searched.id);
    expect(s.minions.find((p) => p.id === searched.id)).toMatchObject({
      damage: 0,
      exhausted: false,
    });
    expect(s.attack?.attacker).toBe(searched.id);
    s = choose(s, "take");
    expect(s.player.hp).toBe(hp - (card(searched).attack || 0));
    expect(s.prompt).toBeNull();
  });
  it("a Stunned Hydra activation is not an attack and therefore that player must search", () => {
    let s = base();
    const target = minion(s);
    target.stunned = true;
    target.stunCards = 1;
    const searched = makePiece(s, "04056");
    s.encounter.deck = [searched, makePiece(s, "08020")];
    const hp = s.player.hp;
    s = reveal(s, "04057");
    expect(s.attack).toBeNull();
    expect(s.player.hp).toBe(hp);
    expect(s.minions[0].stunned).toBe(false);
    expect(s.prompt?.title).toBe("Hail Hydra!");
    s = choose(reload(s), searched.id);
    expect(s.minions.some((p) => p.id === searched.id)).toBe(true);
    expect(s.scheme.threat).toBe(0);
  });
});
