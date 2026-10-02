import { describe, expect, it } from "vitest";
import { card, heroStats, handSize } from "../src/game/cards";
import {
  dispatch,
  makePiece,
  newGame,
  playable,
  paymentSources,
} from "../src/game/engine";
import { heroStarterCodes } from "../src/game/hero-runtime";
import { seatView } from "../src/game/team";
import type { Command, Effect, GameState } from "../src/game/types";

function command(input: GameState, c: Command) {
  let s = dispatch(input, c);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  let guard = 0;
  while (s.review && guard++ < 80) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function base(team = false, villainId = "rhino") {
  let s = newGame({
    heroId: "black_widow",
    aspect: "justice",
    villainId,
    seed: 81,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "black_widow", aspect: "justice" as const },
            { heroId: "spider_man", aspect: "leadership" as const },
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
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.encounter.discard = [];
  s.encounter.dealt = [];
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
function minion(s: GameState, code = "08026", playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
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
function afterPrep(s: GameState) {
  if (s.prompt?.title === "After your Preparation resolves")
    return choose(s, "continue");
  return s;
}
function startAttack(s: GameState, boostCode = "08020") {
  s.encounter.deck = [makePiece(s, boostCode), makePiece(s, "08020")];
  s = native(s, { type: "enemyAttack", id: s.villain.id });
  return choose(s, "take");
}

describe("Black Widow's full retail pack through actual engine commands", () => {
  it("launches the published40-card deck with its original printing IDs and correct9HP/hand sizes", () => {
    const codes = heroStarterCodes("black_widow");
    expect(codes).toHaveLength(40);
    const s = newGame({
      heroId: "black_widow",
      aspect: "justice",
      villainId: "rhino",
      seed: 81,
      heroes: [{ heroId: "black_widow", aspect: "justice", deckCards: codes }],
    });
    expect(
      [...s.player.deck, ...s.player.hand].map((p) => p.code).sort(),
    ).toEqual(codes.slice().sort());
    expect(s.player.hp).toBe(9);
    expect(handSize(s)).toBe(6);
    s.player.form = "hero";
    expect(handSize(s)).toBe(5);
  });
  it("uses Gauntlet resources only for preparations and preserves their state on canceled payment", () => {
    let s = base();
    s.player.form = "alter";
    const gauntlet = play(s, "08007"),
      h = hand(s, "08006", "08004", "08020");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(
      paymentSources(s, h[0].id, s.prompt?.paymentTarget).some(
        (source) => source.id === gauntlet.id,
      ),
    ).toBe(true);
    s = command(s, { type: "CANCEL" });
    expect(s.player.inPlay.find((p) => p.id === gauntlet.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(true);
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [gauntlet.id] });
    expect(s.prompt?.title).toBe("Mission Prep");
    s = choose(s, "skip");
    expect(s.player.inPlay.find((p) => p.id === gauntlet.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
    expect(paymentSources(s).some((source) => source.id === gauntlet.id)).toBe(
      false,
    );
  });
  it("Mission Prep draws only after accepted real play, once per phase, with decline preserving the opportunity", () => {
    let s = base();
    s.player.form = "alter";
    const glove1 = play(s, "08007"),
      glove2 = play(s, "08007");
    const h = hand(s, "08006", "08010");
    const top = makePiece(s, "08020");
    s.player.deck = [top, makePiece(s, "08021")];
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [glove1.id] });
    s = choose(s, "skip");
    expect(s.player.hand.map((p) => p.id)).toEqual([h[1].id]);
    s = command(s, { type: "PLAY", id: h[1].id });
    s = command(s, { type: "PAY", ids: [glove2.id] });
    s = choose(s, "yes");
    expect(s.player.hand).toEqual([top]);
    expect(s.flags.bwMissionPrepPhase).toBe(`${s.round}:player`);
  });
  it("Winter Soldier's actual printed payment cost counts controlled preparations; Synth-Suit changes real defense", () => {
    let s = base();
    play(s, "08006");
    play(s, "08010");
    play(s, "08017");
    play(s, "08009");
    const h = hand(s, "08002", "08020");
    expect(heroStats(s).defense).toBe(3);
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.cost).toBe(1);
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.player.inPlay.find((p) => p.id === h[0].id)).toMatchObject({
      code: "08002",
      damage: 0,
    });
    s.player.form = "alter";
    expect(heroStats(s).defense).toBe(2);
  });
  it("Safe House exhausts to move a chosen physical preparation from discard into hand", () => {
    let s = base();
    s.player.form = "alter";
    const house = play(s, "08005"),
      prep = makePiece(s, "08006");
    s.player.discard = [prep, makePiece(s, "08020")];
    s = command(s, { type: "ABILITY", id: house.id, action: "safe-house" });
    s = choose(s, prep.id);
    expect(s.player.hand).toEqual([prep]);
    expect(s.player.inPlay.find((p) => p.id === house.id)?.exhausted).toBe(
      true,
    );
    expect(
      dispatch(s, { type: "ABILITY", id: house.id, action: "safe-house" })
        .error,
    ).toBeTruthy();
  });
  it("Dance of Death pays once and resolves all3 independently targeted attacks in order", () => {
    let s = base();
    const h = hand(s, "08004", "08020", "08021");
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    for (const expected of [1, 3, 6]) {
      expect(s.prompt?.title).toBe("Dance of Death");
      s = choose(s, s.villain.id);
      expect(s.villain.hp).toBe(hp - expected);
    }
    expect(s.prompt).toBeNull();
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });
  it("Stunned replaces the first Dance attack while its second and third still resolve", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    const h = hand(s, "08004", "08020", "08021"),
      hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.prompt?.text).toContain("attack 2");
    expect(s.player.stunned).toBe(false);
    s = choose(s, s.villain.id);
    s = choose(s, s.villain.id);
    expect(s.villain.hp).toBe(hp - 5);
    expect(s.player.stunCards).toBe(0);
  });
  it("Dance finishes one attack's Retaliate and optional Jarnbjorn before starting the next attack", () => {
    let s = base();
    const axe = play(s, "06019");
    const blasts = makePiece(s, "01153");
    blasts.attachedTo = s.villain.id;
    s.attachments.push(blasts);
    const h = hand(s, "08004", "08020", "08021", "08022");
    const hp = s.player.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    s = choose(s, s.villain.id);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.prompt?.title).toBe("After your hero attacks");
    s = choose(s, axe.id);
    s = command(s, { type: "PAY", ids: [h[3].id] });
    expect(s.prompt?.title).toBe("Dance of Death");
    expect(s.prompt?.text).toContain("attack 2");
  });
  it("Attacrobatics discards its physical preparation, cancels2 icons and resolves Widowmaker/Synth-Suit optionally", () => {
    let s = base();
    const prep = play(s, "08006"),
      suit = play(s, "08009");
    s.player.exhausted = true;
    const villainHP = s.villain.hp,
      heroHP = s.player.hp;
    s = startAttack(s, "01100");
    expect(s.prompt?.title).toBe("Boost card revealed");
    s = choose(s, prep.id);
    expect(s.villain.hp).toBe(villainHP - 2);
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
    s = choose(s, "widowmaker");
    s = choose(s, s.villain.id);
    expect(s.villain.hp).toBe(villainHP - 3);
    s = choose(s, suit.id);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === suit.id)?.exhausted).toBe(true);
    expect(s.player.hp).toBe(heroHP - 2);
  });
  it("Stunned consumes an attack preparation cost while leaving all boost icons and followers untouched", () => {
    let s = base();
    const prep = play(s, "08006");
    s.player.stunned = true;
    s.player.stunCards = 1;
    const hp = s.player.hp,
      villainHP = s.villain.hp;
    s = startAttack(s, "01100");
    s = choose(s, prep.id);
    expect(s.player.hp).toBe(hp - 4);
    expect(s.villain.hp).toBe(villainHP);
    expect(s.player.stunned).toBe(false);
    expect(s.prompt).toBeNull();
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
  });
  it("Guard does not prevent Attacrobatics from canceling boost icons, while its villain attack is blocked", () => {
    let s = base();
    const prep = play(s, "08006");
    minion(s, "08028");
    const hp = s.player.hp,
      villainHP = s.villain.hp;
    s = startAttack(s, "01100");
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.villain.hp).toBe(villainHP);
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
  });
  it("Target Acquired cancels Taskmaster's boost effect before it increases the attack", () => {
    let s = base();
    const prep = play(s, "08024");
    play(s, "08009");
    const hp = s.player.hp;
    s = startAttack(s, "08026");
    expect(s.prompt?.title).toBe("Boost ability");
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
  });
  it("a global Attacrobatics controller resumes the attacked teammate's activation after resolving her own responses", () => {
    let s = base(true);
    const prep = play(s, "08006"),
      hp = s.player.hp;
    const teammateHP = seatView(s, "p2").player.hp;
    s.encounter.deck = [makePiece(s, "01100"), makePiece(s, "08020")];
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" });
    s = choose(s, "take");
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(seatView(s, "p1").player.hp).toBe(hp);
    expect(seatView(s, "p2").player.hp).toBe(teammateHP - 2);
    expect(seatView(s, "p1").player.discard.some((p) => p.id === prep.id)).toBe(
      true,
    );
  });
  it("Grappling Hook cancels every effect of a locally revealed treachery and has no replacement encounter", () => {
    let s = base();
    const prep = play(s, "08008"),
      hp = s.player.hp;
    const upgrade = play(s, "08009");
    const next = makePiece(s, "08026");
    s.encounter.deck = [next];
    s = reveal(s, "08029", false);
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(true);
    expect(s.encounter.deck).toEqual([next]);
    expect(s.encounter.discard.filter((p) => p.code === "08029")).toHaveLength(
      1,
    );
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
  });
  it("Spycraft works in alter ego, cancels the original minion and reveals the exact replacement", () => {
    let s = base();
    s.player.form = "alter";
    const prep = play(s, "08018");
    const replacement = makePiece(s, "08026");
    s.encounter.deck = [replacement, makePiece(s, "08020")];
    s = reveal(s, "08028", false);
    s = choose(s, prep.id);
    expect(s.minions.map((p) => p.id)).toEqual([replacement.id]);
    expect(s.encounter.discard.filter((p) => p.code === "08028")).toHaveLength(
      1,
    );
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
    expect(s.prompt).toBeNull();
  });
  it("Espionage draws2 before the native Surge deals its additional encounter, without canceling Surge", () => {
    let s = base();
    s.player.form = "alter";
    const prep = play(s, "08033");
    const top = [makePiece(s, "08020"), makePiece(s, "08021")];
    s.player.deck = [...top, makePiece(s, "08022")];
    const replacement = makePiece(s, "08026");
    s.encounter.deck = [replacement, makePiece(s, "08020")];
    s = reveal(s, "01121");
    expect(s.prompt?.title).toBe("Surge resolved");
    s = choose(s, prep.id);
    expect(s.player.hand.map((p) => p.id)).toEqual(top.map((p) => p.id));
    expect(s.encounter.dealt.some((p) => p.id === replacement.id)).toBe(true);
    expect(s.minions.some((p) => p.code === "01121")).toBe(true);
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
  });
  it("Espionage's discard cost can supply its draw when the controller has no other deck or discard cards", () => {
    let s = base();
    s.player.form = "alter";
    s.player.deck = [];
    s.player.discard = [];
    const prep = play(s, "08033");
    s.encounter.deck = [
      makePiece(s, "08026"),
      makePiece(s, "08027"),
      makePiece(s, "08029"),
    ];
    s = reveal(s, "01121");
    s = choose(s, prep.id);
    expect(s.player.hand.map((p) => p.id)).toEqual([prep.id]);
    expect(s.encounter.dealt).toHaveLength(2);
  });
  it("an Attacrobatics defeat before damage resumes the same-title villain's attack with the new stage's printed ATK", () => {
    let s = base();
    const prep = play(s, "08006"),
      hp = s.player.hp;
    s.villain.hp = 1;
    s = startAttack(s, "01100");
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.villain.stage).toBe(2);
    expect(s.player.hp).toBe(hp - card(s.villain).attack!);
  });
  it("Widow's Bite occurs after Quickstrike and damages/stuns the surviving entering minion", () => {
    let s = base();
    const prep = play(s, "08010"),
      hp = s.player.hp;
    s = reveal(s, "01167");
    expect(s.prompt?.title).not.toBe("Minion entered play");
    s = choose(s, "take");
    expect(s.player.hp).toBe(hp - 3);
    expect(s.prompt?.title).toBe("Minion entered play");
    const vulture = s.minions.find((p) => p.code === "01167")!;
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.minions.find((p) => p.id === vulture.id)).toMatchObject({
      damage: 2,
      stunned: true,
    });
  });
  it("Counterintelligence prevents only3 main threat and cannot prevent side-scheme threat", () => {
    let s = base();
    const prep = play(s, "08017");
    const before = s.scheme.threat;
    s = native(s, { type: "threat", target: "main", amount: 4 });
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.scheme.threat).toBe(before + 1);
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
  });
  it("Defensive Stance prevents3 from real attack damage and consumes its prep before the optional followers", () => {
    let s = base();
    const prep = play(s, "08032"),
      hp = s.player.hp;
    s = startAttack(s, "01100");
    expect(s.prompt?.title).toBe("Incoming attack");
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
  });
  it("Defensive Stance also prevents a non-attack damage packet without recursively charging its cost", () => {
    let s = base();
    const prep = play(s, "08032"),
      hp = s.player.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 5,
      source: "test",
    });
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.discard.filter((p) => p.id === prep.id)).toHaveLength(1);
  });
  it("Counterattack responds to actual enemy attack damage and does not respond to unrelated card damage", () => {
    let s = base();
    const prep = play(s, "08030"),
      villainHP = s.villain.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 1,
      source: "test",
    });
    expect(s.prompt).toBeNull();
    s = startAttack(s);
    s = choose(s, prep.id);
    s = afterPrep(s);
    expect(s.villain.hp).toBe(villainHP - 2);
    expect(s.player.discard.some((p) => p.id === prep.id)).toBe(true);
  });
  it("Quake exhausts after a minion schemes, then deals2 non-attack damage", () => {
    let s = base();
    s.player.form = "alter";
    const quake = play(s, "08012"),
      target = minion(s, "08026");
    play(s, "08009");
    const before = s.scheme.threat;
    s = native(s, { type: "enemyScheme", id: target.id });
    expect(s.scheme.threat).toBe(before + 1);
    expect(s.prompt?.title).toBe("Quake");
    s = choose(s, quake.id);
    expect(s.minions.find((p) => p.id === target.id)?.damage).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === quake.id)?.exhausted).toBe(
      true,
    );
  });
  it("Coulson's real search reveals hidden information and preserves the chosen discard-pile instance", () => {
    let s = base();
    const p = makePiece(s, "08010");
    s.player.discard = [p];
    const h = hand(s, "08011", "08020", "08021"),
      hidden = s.hiddenInfo || 0;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    s = choose(s, "yes");
    s = choose(s, p.id);
    expect(s.player.hand).toContainEqual(p);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
  });
  it("Rapid Response returns the exact ally with reset state and1damage before that ally's entrance response", () => {
    let s = base();
    const prep = play(s, "08031"),
      coulson = play(s, "08011");
    coulson.damage = 2;
    coulson.exhausted = true;
    coulson.stunned = true;
    coulson.stunCards = 1;
    s = native(s, {
      type: "damage",
      target: coulson.id,
      amount: 1,
      source: "test",
    });
    expect(s.prompt?.title).toBe("Ally defeated");
    s = choose(s, prep.id);
    const returned = s.player.inPlay.find((p) => p.id === coulson.id)!;
    expect(returned).toMatchObject({
      damage: 1,
      exhausted: false,
      stunned: false,
    });
    expect(returned.stunCards || 0).toBe(0);
    expect(s.prompt?.title).toBe("Agent Coulson");
    s = choose(s, "skip");
    s = afterPrep(s);
    expect(s.player.discard.filter((p) => p.id === prep.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === coulson.id)).toBe(false);
  });
  it("Quincarrier requires current Avenger identity on play, then generateswild in either form", () => {
    let s = base();
    const h = hand(s, "08023", "08020", "08021");
    s.player.form = "alter";
    expect(playable(s, h[0])).toContain("current identity");
    s.player.form = "hero";
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    s.player.form = "alter";
    expect(paymentSources(s).find((p) => p.id === h[0].id)?.resources).toEqual([
      "wild",
    ]);
  });
  it("Burn Notice selects the highest printed-cost preparation and preserves lower-cost ones", () => {
    let s = base();
    const lower = play(s, "08010"),
      higher = play(s, "08017");
    s = reveal(s, "08025");
    s = choose(s, "stay");
    s = choose(s, "discard");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([higher.id]);
    s = choose(s, higher.id);
    expect(s.player.inPlay.some((p) => p.id === lower.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === higher.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.code === "08025")).toBe(true);
  });
  it("Burn Notice's legal alter-ego exhaust branch removes the actual obligation from the game", () => {
    let s = base();
    s = reveal(s, "08025");
    s = choose(s, "flip");
    s = choose(s, "exhaust");
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((p) => p.code === "08025")).toBe(true);
    expect(s.encounter.discard.some((p) => p.code === "08025")).toBe(false);
  });
  it("Taskmaster has actual upgrade-based ATK/SCH and Killer for Hire adds multiplayer threat", () => {
    let s = base(true);
    const taskmaster = minion(s);
    play(s, "08009");
    play(s, "08006");
    play(s, "08005");
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: taskmaster.id });
    s = choose(s, "take");
    expect(s.player.hp).toBe(hp - 2);
    s = reveal(s, "08027");
    expect(s.sideSchemes.find((p) => p.code === "08027")?.counters).toBe(5);
  });
  it("Deadly Shot chooses a real upgrade and applies its hero or alter-ego remaining effect even when there is no upgrade", () => {
    let s = base();
    const upgrade = play(s, "08009"),
      hp = s.player.hp;
    s = reveal(s, "08029");
    s = choose(s, upgrade.id);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.discard.some((p) => p.id === upgrade.id)).toBe(true);
    s.player.form = "alter";
    const threat = s.scheme.threat;
    s = reveal(s, "08029");
    expect(s.scheme.threat).toBe(threat + 1);
  });
  it("Covert Ops uses the complete shared thwart/confuse program in alter ego and Stealth Strike uses actual defeat outcome", () => {
    let s = base();
    s.player.form = "alter";
    s.scheme.threat = 5;
    const h = hand(s, "08003", "08020", "08021");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.scheme.threat).toBe(1);
    expect(s.villain.confused).toBe(true);
    s.player.form = "hero";
    s.scheme.threat = 3;
    const target = minion(s, "08028"),
      strike = hand(s, "08013", "08020", "08021");
    s = command(s, { type: "PLAY", id: strike[0].id });
    s = command(s, { type: "PAY", ids: [strike[1].id, strike[2].id] });
    expect(s.minions.some((p) => p.id === target.id)).toBe(false);
    expect(s.scheme.threat).toBe(1);
  });
});
