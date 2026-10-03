/**
 * Pending acceptance fixtures for a hero deliberately unavailable in the
 * installed engine. The final pre-publication run failed at launch/integration.
 * Activate as *.test.ts after native adapters and deck rules are implemented.
 * These fixtures are not evidence of playable support.
 */
import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  playable,
  paymentSources,
} from "../src/game/engine.js";
import { card, heroStats, handSize, pieceHP } from "../src/game/cards.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { deckErrors } from "../src/game/decks.js";
import { seatView } from "../src/game/team.js";
import { hawkeyeStoredPlayable } from "../src/game/hawkeye.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

function command(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  let guard = 0;
  while (s.review && guard++ < 80) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt!.options.some((p) => p.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function base(team = false) {
  let s = newGame({
    heroId: "hawkeye",
    aspect: "leadership",
    villainId: "rhino",
    seed: 401,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "hawkeye", aspect: "leadership" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (team) s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = [];
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.villain.hp = s.villain.maxHp = 40;
  return s;
}
function play(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function minion(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: makePiece(s, code), skip: true });
}
function finishAttack(s: GameState) {
  let guard = 0;
  while (s.prompt?.kind === "choice" && guard++ < 20) {
    const chosen = ["take", "continue", "allow", "pass"].find((id) =>
      s.prompt!.options.some((o) => o.id === id),
    );
    expect(chosen, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, chosen!);
  }
  expect(s.attack).toBeNull();
  return s;
}
function json(s: GameState) {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
describe("Hawkeye full source starter through actual engine commands", () => {
  it("launches the exact published40-card precon with original printing IDs and9HP", () => {
    const codes = heroStarterCodes("hawkeye");
    expect(codes).toHaveLength(40);
    expect(deckErrors("hawkeye", "leadership", codes)).toEqual([]);
    const s = newGame({
      heroId: "hawkeye",
      aspect: "leadership",
      villainId: "rhino",
      seed: 401,
      heroes: [{ heroId: "hawkeye", aspect: "leadership", deckCards: codes }],
    });
    expect(
      [...s.player.hand, ...s.player.deck].map((p) => p.code).sort(),
    ).toEqual([...codes].sort());
    expect(s.player.hp).toBe(9);
    expect(handSize(s)).toBe(6);
    s.player.form = "hero";
    expect(handSize(s)).toBe(5);
  });
  it("Weapon of Choice native payment is cancelable, then retrieves the physical Bow and blocks its phase repeat", () => {
    let s = base();
    s.player.form = "alter";
    const [resource] = hand(s, "04023"),
      bow = makePiece(s, "04002");
    s.player.discard = [bow];
    s = command(s, {
      type: "ABILITY",
      id: "identity",
      action: "weapon-of-choice",
    });
    expect(s.prompt?.cost).toBe(1);
    s = command(s, { type: "CANCEL" });
    expect(s.player.discard).toContainEqual(bow);
    s = command(s, {
      type: "ABILITY",
      id: "identity",
      action: "weapon-of-choice",
    });
    s = command(json(s), { type: "PAY", ids: [resource.id] });
    expect(s.player.hand.map((p) => p.id)).toEqual([bow.id]);
    expect(s.flags.hawkeyeWeaponPhase).toBe(`${s.round}:player`);
    s.player.hand = [];
    s.player.discard.push(bow);
    hand(s, "04023");
    expect(
      dispatch(s, {
        type: "ABILITY",
        id: "identity",
        action: "weapon-of-choice",
      }).error,
    ).toBeTruthy();
  });
  it("zero-cost Bow enters Restricted state, grants real ATK, and Quick Draw exhausts hero to ready it", () => {
    let s = base();
    const [bow] = hand(s, "04002");
    s = command(s, { type: "PLAY", id: bow.id });
    expect(heroStats(s).attack).toBe(3);
    s.player.inPlay[0].exhausted = true;
    s = command(s, { type: "ABILITY", id: "identity", action: "quick-draw" });
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay[0].exhausted).toBe(false);
    s.player.form = "alter";
    expect(heroStats(s).attack).toBe(2);
  });
  it("Quiver selects top5 and plays its exact attached Arrow with Marksman sources, preserving it through canceled/reloaded payment", () => {
    let s = base();
    play(s, "04002");
    const quiver = play(s, "04003"),
      marksman = play(s, "04010"),
      other = play(s, "04010");
    const arrow = makePiece(s, "04005"),
      filler = makePiece(s, "04023");
    s.player.deck = [
      filler,
      arrow,
      makePiece(s, "04024"),
      makePiece(s, "04025"),
      makePiece(s, "04023"),
      makePiece(s, "04009"),
    ];
    s = command(s, { type: "ABILITY", id: quiver.id, action: "quiver" });
    expect(
      s.prompt?.options.filter((o) => o.id !== "none").map((p) => p.id),
    ).toEqual([arrow.id]);
    s = choose(json(s), arrow.id);
    expect(hawkeyeStoredPlayable(s).map((p) => p.id)).toEqual([arrow.id]);
    expect(s.player.hand).toEqual([]);
    s = command(s, { type: "PLAY", id: arrow.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(paymentSources(s, arrow.id, "04005").map((p) => p.id)).toEqual([
      marksman.id,
      other.id,
    ]);
    s = command(s, { type: "CANCEL" });
    expect(hawkeyeStoredPlayable(s).map((p) => p.id)).toEqual([arrow.id]);
    expect(
      s.player.inPlay
        .filter((p) => p.code === "04010")
        .every((p) => !p.exhausted),
    ).toBe(true);
    s = command(s, { type: "PLAY", id: arrow.id });
    s = command(json(s), { type: "PAY", ids: [marksman.id, other.id] });
    expect(s.villain.hp).toBe(37);
    expect(s.villain.confused).toBe(true);
    expect(hawkeyeStoredPlayable(s)).toEqual([]);
    expect(s.player.discard.filter((p) => p.id === arrow.id)).toHaveLength(1);
    expect(
      s.player.inPlay
        .filter((p) => p.code === "04010")
        .every((p) => p.exhausted),
    ).toBe(true);
  });
  it.each([
    ["04005", "confused"],
    ["04007", "stunned"],
  ] as const)(
    "%s applies status and3 damage, or5 if already %s",
    (code, status) => {
      let s = base();
      play(s, "04002");
      const h = hand(s, code, "04023");
      s = command(s, { type: "PLAY", id: h[0].id });
      s = command(s, { type: "PAY", ids: [h[1].id] });
      expect(s.villain.hp).toBe(37);
      expect(s.villain[status]).toBe(true);
      s.player.inPlay.find((p) => p.code === "04002")!.exhausted = false;
      const h2 = hand(s, code, "04023");
      s = command(s, { type: "PLAY", id: h2[0].id });
      s = command(s, { type: "PAY", ids: [h2[1].id] });
      expect(s.villain.hp).toBe(32);
    },
  );
  it("native Stunned replacement still exhausts Bow, pays and discards the event exactly once", () => {
    let s = base();
    const bow = play(s, "04002"),
      h = hand(s, "04007", "04023");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.villain.hp).toBe(40);
    expect(s.villain.stunned).toBe(false);
    expect(s.player.stunned).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === bow.id)?.exhausted).toBe(true);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });
  it("Vibranium Arrow pierces Tough and Bow ignores Retaliate on an actual enemy", () => {
    let s = base();
    play(s, "04002");
    const enemy = minion(s, "01172");
    enemy.tough = true;
    const hp = s.player.hp,
      h = hand(s, "04009", "04023");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    if (s.prompt) s = choose(s, enemy.id);
    expect(s.player.hp).toBe(hp);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === enemy.id)).toBe(true);
  });
  it("Cable Arrow removes3 from main through Crisis while retaining the Crisis side scheme and event lifecycle", () => {
    let s = base();
    play(s, "04002");
    const crisis = makePiece(s, "01108");
    expect(card(crisis).scheme_crisis).toBe(1);
    crisis.counters = 5;
    s.sideSchemes = [crisis];
    s.scheme.threat = 6;
    const h = hand(s, "04008", "04024");
    expect(playable(s, h[0])).toBeNull();
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, "main");
    expect(s.scheme.threat).toBe(3);
    expect(s.sideSchemes[0].counters).toBe(5);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });
  it("Explosive Arrow damages villain and chosen teammate's minions without consuming Stunned", () => {
    let s = base(true);
    play(s, "04002");
    const mine = minion(s, "01101"),
      theirs = minion(s, "01101", "p2"),
      h = hand(s, "04006", "04023");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, "p2");
    expect(s.villain.hp).toBe(37);
    expect(s.player.stunned).toBe(true);
    expect(s.minions.find((p) => p.id === mine.id)?.damage).toBe(0);
    expect(s.minions.some((p) => p.id === theirs.id)).toBe(false);
  });
  it("Kate Bishop deals the chosen card's printed resources with no consequential or attack damage", () => {
    let s = base();
    const kate = play(s, "04011"),
      [energy] = hand(s, "04023");
    const hp = s.player.hp;
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: kate.id, action: "kate-bishop" });
    s = choose(s, energy.id);
    expect(s.villain.hp).toBe(38);
    expect(s.player.inPlay.find((p) => p.id === kate.id)).toMatchObject({
      exhausted: true,
      damage: 0,
    });
    expect(s.player.hp).toBe(hp);
  });
  it("Black Knight piercing and War Machine ranged affect real basic attacks", () => {
    let s = base();
    const knight = play(s, "04012");
    s.villain.tough = true;
    s = command(s, { type: "ABILITY", id: knight.id, action: "attack" });
    expect(s.villain.hp).toBe(38);
    expect(s.villain.tough).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === knight.id)?.damage).toBe(1);
    const war = play(s, "04020"),
      enemy = minion(s, "01172");
    s = command(s, { type: "ABILITY", id: war.id, action: "attack" });
    if (s.prompt) s = choose(s, enemy.id);
    expect(s.player.inPlay.find((p) => p.id === war.id)?.damage).toBe(1);
  });
  it("Goliath native action adds4ATK, then its delayed discard occurs at the phase boundary", () => {
    let s = base();
    const goliath = play(s, "04013");
    s = command(s, { type: "ABILITY", id: goliath.id, action: "goliath" });
    s = command(s, { type: "ABILITY", id: goliath.id, action: "attack" });
    expect(s.villain.hp).toBe(35);
    s = native(json(s), { type: "beginVillain" });
    expect(s.player.inPlay.some((p) => p.id === goliath.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === goliath.id)).toBe(true);
  });
  it("Team Training printed under-player permission changes native ally HP and preserves owner through transfer", () => {
    let s = base(true);
    const ally = play(s, "04020", "p2"),
      h = hand(s, "04016", "04023");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = choose(s, "p2");
    expect(
      pieceHP(
        s,
        seatView(s, "p2").player.inPlay.find((p) => p.id === ally.id)!,
      ),
    ).toBe(4);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === h[0].id)?.ownerId,
    ).toBe("p1");
  });
  it("Sky Cycle requires an Avenger ally, attaches across players, and native action readies its ally", () => {
    let s = base(true);
    const ally = play(s, "04020", "p2"),
      h = hand(s, "04015", "04023");
    ally.exhausted = true;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.attachedTo).toBe(
      ally.id,
    );
    s = command(s, { type: "ABILITY", id: h[0].id, action: "sky-cycle" });
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ally.id)?.exhausted,
    ).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.exhausted).toBe(true);
  });
  it("Ready for Action gives Tough to a controlled ally through native play", () => {
    let s = base();
    const ally = play(s, "04011"),
      h = hand(s, "04017", "04023");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.tough).toBe(true);
  });
  it("Earth's Mightiest Heroes exhausts an ally to ready Hawkeye without readying that cost ally", () => {
    let s = base();
    const ally = play(s, "04011"),
      [event] = hand(s, "04022");
    s.player.exhausted = true;
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  });
  it("Mockingbird pays/returns herself at initiation and prevents all damage after boost while the boost effect still resolves", () => {
    let s = base();
    const bobbi = play(s, "04004"),
      [resource] = hand(s, "04023");
    s.encounter.deck = [makePiece(s, "01178"), makePiece(s, "04030")];
    const hp = s.player.hp,
      threat = s.scheme.threat;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    const option = s.prompt!.options.find(
      (o) => o.image === "04004" || o.id === bobbi.id,
    )!;
    expect(option).toBeTruthy();
    s = choose(s, option.id);
    expect(s.prompt?.kind).toBe("payment");
    s = command(json(s), { type: "PAY", ids: [resource.id] });
    s = finishAttack(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.hand.map((p) => p.id)).toContain(bobbi.id);
    expect(s.player.inPlay.some((p) => p.id === bobbi.id)).toBe(false);
    expect(s.scheme.threat).toBe(threat + 1);
  });
  it("Criminal Past resolves optional flip independently and removes the exact physical obligation through exhaustion", () => {
    let s = base();
    s = reveal(s, "04026");
    s = choose(s, "flip");
    s = choose(s, "remove");
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((p) => p.code === "04026")).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.code === "04026")).toBe(false);
  });
  it("Marked for Death tucks physical Mockingbird, cleans her upgrades, survives save and returns exactly her after thwart", () => {
    let s = base();
    const bobbi = play(s, "04004"),
      cycle = play(s, "04015");
    cycle.attachedTo = bobbi.id;
    s = reveal(s, "04028");
    const scheme = s.sideSchemes.find((p) => p.code === "04028")!;
    expect(scheme.storedCards?.map((p) => p.id)).toEqual([bobbi.id]);
    expect(s.player.inPlay.some((p) => p.id === bobbi.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === cycle.id)).toBe(true);
    s = native(json(s), { type: "thwart", target: scheme.id, amount: 5 });
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.player.hand.filter((p) => p.id === bobbi.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === bobbi.id)).toBe(false);
  });
  it("Crossfire Quickstrike pierces Tough immediately and Rifle ranged prevents U.S. Agent's Retaliate", () => {
    let s = base();
    s.player.tough = true;
    const hp = s.player.hp;
    s = reveal(s, "04027");
    s = finishAttack(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.tough).toBe(false);
    s = reveal(s, "04029");
    const crossfire = s.minions.find((p) => p.code === "04027")!,
      us = play(s, "04014");
    s = native(s, { type: "enemyAttack", id: crossfire.id });
    s = choose(s, us.id);
    s = finishAttack(s);
    expect(s.minions.find((p) => p.id === crossfire.id)?.damage).toBe(0);
  });
  it("Crossfire's Rifle actual payment requires a printed wild and pays identity exhaustion", () => {
    let s = base();
    s = reveal(s, "04029");
    const rifle = s.attachments.find((p) => p.code === "04029")!,
      [wild] = hand(s, "04002");
    s = command(s, { type: "ABILITY", id: rifle.id, action: "discard-rifle" });
    expect(s.prompt?.requirements).toEqual(["wild"]);
    s = command(s, { type: "PAY", ids: [wild.id] });
    expect(s.player.exhausted).toBe(true);
    expect(s.attachments.some((p) => p.id === rifle.id)).toBe(false);
  });
  it("Crossfire's boost makes a native villain attack piercing, even after JSON hydration", () => {
    let s = base();
    s.player.tough = true;
    const hp = s.player.hp;
    s.encounter.deck = [makePiece(s, "04027"), makePiece(s, "04030")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = finishAttack(json(s));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.tough).toBe(false);
  });
  it("Sniper Shot resolves3damage in hero and3main threat in alter-ego through reveal lifecycle", () => {
    let s = base();
    const hp = s.player.hp;
    s = reveal(s, "04030");
    expect(s.player.hp).toBe(hp - 3);
    const threat = s.scheme.threat;
    s.player.form = "alter";
    s = reveal(s, "04030");
    expect(s.scheme.threat).toBe(threat + 3);
    expect(s.encounter.discard.filter((p) => p.code === "04030")).toHaveLength(
      2,
    );
  });
  it("Tower reprint changes actual ally limit and reduction using its existing complete native owner", () => {
    let s = base();
    const tower = play(s, "04021"),
      h = hand(s, "04011", "04023");
    s = command(s, { type: "ABILITY", id: tower.id, action: "tower" });
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.cost).toBe(1);
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
  });
});
