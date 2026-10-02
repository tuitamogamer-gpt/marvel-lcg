import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine";
import { card } from "../src/game/cards";
import { heroStarterCodes } from "../src/game/hero-runtime";
import { seatView } from "../src/game/team";
import type { Command, Effect, GameState } from "../src/game/types";

function command(input: GameState, cmd: Command) {
  let state = dispatch(input, cmd);
  expect(state.error, JSON.stringify(state.prompt)).toBeUndefined();
  let n = 0;
  while (state.review && n++ < 50) state = dispatch(state, { type: "PROCEED" });
  expect(state.error).toBeUndefined();
  return state;
}
function base(team = false, villainId = "rhino") {
  let state = newGame({
    heroId: "hulk",
    aspect: "aggression",
    villainId,
    seed: 439,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "hulk", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  state = command(state, { type: "MULLIGAN", ids: [] });
  if (team) state = command(state, { type: "MULLIGAN", ids: [] });
  for (const seat of state.players) {
    const view = seatView(state, seat);
    view.player.form = "hero";
    view.player.hand = [];
    view.player.inPlay = [];
    view.player.discard = [];
  }
  state.queue = [];
  state.prompt = null;
  state.review = null;
  state.sideSchemes = [];
  state.minions = [];
  return state;
}
function native(state: GameState, ...effects: Effect[]) {
  state.queue = effects;
  state.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return command(state, { type: "CHOOSE", id: "go" });
}
function hand(state: GameState, ...codes: string[]) {
  state.player.hand = codes.map((code) => makePiece(state, code));
  return [...state.player.hand];
}
function inPlay(state: GameState, code: string) {
  const p = makePiece(state, code);
  state.player.inPlay.push(p);
  return p;
}
function minion(state: GameState, code: string) {
  const p = makePiece(state, code);
  p.engagedWith = state.activePlayerId;
  state.minions.push(p);
  return p;
}
function choose(state: GameState, id: string) {
  expect(state.prompt?.kind).toBe("choice");
  return command(state, { type: "CHOOSE", id });
}
function zeroBoosts(state: GameState) {
  state.encounter.deck = Array.from({ length: 8 }, () =>
    makePiece(state, "01186"),
  );
}

describe("all printed Hulk Hero Pack extras through actual mission commands", () => {
  it("accepts and preserves the complete published40-card Hulk starter", () => {
    const codes = heroStarterCodes("hulk");
    expect(codes).toHaveLength(40);
    const state = newGame({
      heroId: "hulk",
      aspect: "aggression",
      villainId: "rhino",
      seed: 439,
      heroes: [{ heroId: "hulk", aspect: "aggression", deckCards: codes }],
    });
    expect(
      [...state.player.hand, ...state.player.deck].map((p) => p.code).sort(),
    ).toEqual(codes.sort());
  });

  it("Brawn's real attack offers threat removal before consequential damage, and Stunned cancels both", () => {
    let state = base();
    const brawn = inPlay(state, "10011");
    state.scheme.threat = 3;
    const hp = state.villain.hp;
    state = command(state, { type: "ABILITY", id: brawn.id, action: "attack" });
    expect(state.villain.hp).toBe(hp - 1);
    expect(state.player.inPlay[0].damage).toBe(0);
    state = choose(state, "yes");
    expect(state.scheme.threat).toBe(2);
    expect(state.player.inPlay[0].damage).toBe(1);
    state.player.inPlay[0].exhausted = false;
    state.player.inPlay[0].stunned = true;
    state = command(state, { type: "ABILITY", id: brawn.id, action: "attack" });
    expect(state.villain.hp).toBe(hp - 1);
    expect(state.scheme.threat).toBe(2);
    expect(state.player.inPlay[0]).toMatchObject({
      damage: 1,
      exhausted: true,
      stunned: false,
    });
  });

  it("Sentry's paid entry deals its compulsory encounter card without opening a response or revealing it", () => {
    let state = base();
    const h = hand(state, "10012", "10007", "10020");
    const top = state.encounter.deck[0];
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(state.player.inPlay.some((p) => p.code === "10012")).toBe(true);
    expect(state.encounter.dealt.find((p) => p.id === top.id)?.dealtTo).toBe(
      "p1",
    );
    expect(state.prompt).toBeNull();
  });

  it("She-Hulk's actual basic attack includes current damage and later consequential damage changes her next ATK", () => {
    let state = base();
    const sheHulk = inPlay(state, "10013");
    sheHulk.damage = 2;
    const hp = state.villain.hp;
    state = command(state, {
      type: "ABILITY",
      id: sheHulk.id,
      action: "attack",
    });
    expect(state.villain.hp).toBe(hp - 3);
    expect(state.player.inPlay[0].damage).toBe(3);
  });

  it("Drop Kick's real physical payment damages, stuns and draws while mixed payment only damages", () => {
    for (const physical of [true, false]) {
      let state = base();
      const h = hand(
        state,
        "10014",
        ...(physical ? ["10007"] : ["10020", "10021"]),
      );
      const hp = state.villain.hp;
      const deck = state.player.deck.length;
      state = command(state, { type: "PLAY", id: h[0].id });
      state = command(state, { type: "PAY", ids: h.slice(1).map((p) => p.id) });
      expect(state.villain.hp).toBe(hp - 4);
      expect(state.villain.stunned).toBe(physical);
      expect(state.player.deck.length).toBe(deck - Number(physical));
    }
  });

  it("Toe to Toe fully resolves the chosen Guard minion's attack and only then deals its5damage", () => {
    let state = base();
    const guard = minion(state, "01101");
    const h = hand(state, "10015", "10021");
    const villainHP = state.villain.hp;
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id] });
    expect(state.minions[0].damage).toBe(0);
    state = choose(state, "take");
    expect(state.player.hp).toBe(17);
    expect(state.minions.some((p) => p.id === guard.id)).toBe(false);
    expect(state.villain.hp).toBe(villainHP);
  });

  it("Toe to Toe still damages an enemy whose Stunned status replaced its attack", () => {
    let state = base();
    const guard = minion(state, "01101");
    guard.stunned = true;
    const h = hand(state, "10015", "10021");
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id] });
    expect(state.player.hp).toBe(18);
    expect(state.minions).toEqual([]);
    expect(state.prompt).toBeNull();
  });

  it("Stunned acquired from Klaw's Sonic Converter does not retroactively cancel ongoing Toe damage", () => {
    let state = base(false, "klaw");
    const sonic = makePiece(state, "01118");
    sonic.attachedTo = state.villain.id;
    state.attachments.push(sonic);
    zeroBoosts(state);
    const h = hand(state, "10015", "10021");
    const hp = state.villain.hp;
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id] });
    state = choose(state, "take");
    expect(state.villain.hp).toBe(hp - 5);
    expect(state.player.stunned).toBe(true);
    state = command(state, { type: "BASIC", action: "attack" });
    expect(state.villain.hp).toBe(hp - 5);
    expect(state.player.stunned).toBe(false);
  });

  it("Toe damage continues against Rhino's next same-title stage after Retaliate defeats the previous stage", () => {
    let state = base();
    inPlay(state, "10010");
    state.villain.hp = 1;
    state.encounter.deck = [
      makePiece(state, "01186"),
      makePiece(state, "01107"),
    ];
    const h = hand(state, "10015", "10021");
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id] });
    state = choose(state, "take");
    expect(state.villain.code).toBe("01095");
    expect(state.villain.hp).toBe(10);
    expect(state.sideSchemes.some((p) => p.code === "01107")).toBe(true);
  });

  it("the first player orders Abomination and Retaliate, and defeating its source first suppresses the deferred response", () => {
    for (const abominationFirst of [false, true]) {
      let state = base();
      inPlay(state, "10010");
      state.player.hp = 22;
      const enemy = minion(state, "10026");
      enemy.damage = 5;
      const top = makePiece(state, "10007");
      state.player.deck = [top, makePiece(state, "10021")];
      state = native(state, { type: "enemyAttack", id: enemy.id });
      state = choose(state, "hero");
      expect(state.prompt?.title).toBe("Forced responses");
      expect(state.prompt?.options.map((p) => p.label).sort()).toEqual([
        "Abomination",
        "Retaliate",
      ]);
      state = choose(state, abominationFirst ? "hulk-forced" : "retaliate");
      expect(state.minions).toEqual([]);
      expect(state.player.hp).toBe(abominationFirst ? 20 : 22);
      expect(state.player.deck.some((p) => p.id === top.id)).toBe(
        !abominationFirst,
      );
      expect(state.prompt).toBeNull();
    }
  });

  it("Martial Prowess pays only Attack-trait events and its physical payment enables Drop Kick's complete bonus", () => {
    let state = base();
    const prowess = inPlay(state, "10018");
    const h = hand(state, "10014", "10022");
    expect(
      paymentSources(state, h[0].id, h[0].code).some(
        (p) => p.id === prowess.id,
      ),
    ).toBe(true);
    expect(
      paymentSources(state, undefined, "10003").some(
        (p) => p.id === prowess.id,
      ),
    ).toBe(false);
    expect(
      paymentSources(state, undefined, "10019").some(
        (p) => p.id === prowess.id,
      ),
    ).toBe(false);
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id, prowess.id] });
    expect(
      state.player.inPlay.find((p) => p.id === prowess.id)?.exhausted,
    ).toBe(true);
    expect(state.villain.stunned).toBe(true);
    expect(state.player.hand).toHaveLength(1);
  });

  it("The Power of Aggression doubles its wild resources for Drop Kick and declared physical wilds qualify for the bonus", () => {
    let state = base();
    const h = hand(state, "10014", "10017", "10002");
    expect(
      paymentSources(state, h[0].id, h[0].code).find((p) => p.id === h[1].id)
        ?.resources,
    ).toEqual(["wild", "wild"]);
    expect(
      paymentSources(state, undefined, "10019").find((p) => p.id === h[1].id)
        ?.resources,
    ).toEqual(["wild"]);
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, {
      type: "PAY",
      ids: [h[1].id, h[2].id],
      wildAs: "physical",
    });
    expect(state.villain.stunned).toBe(true);
    expect(state.player.hand).toHaveLength(1);
  });

  it("Martial Prowess can be given to another player despite the payer already controlling a copy", () => {
    let state = base(true);
    inPlay(state, "10018");
    const h = hand(state, "10018", "10020");
    expect(playable(state, h[0])).toBeNull();
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id] });
    state = choose(state, "p2");
    expect(state.player.inPlay.filter((p) => p.code === "10018")).toHaveLength(
      1,
    );
    expect(state.players[1].player.inPlay[0]).toMatchObject({
      code: "10018",
      ownerId: "p1",
    });
    expect(
      paymentSources(seatView(state, "p2"), undefined, "10015").some(
        (p) => p.id === h[0].id,
      ),
    ).toBe(true);
  });

  it("To the Rescue's complete printed thwart removes2threat through the shared interpreter", () => {
    let state = base();
    state.scheme.threat = 5;
    const h = hand(state, "10019", "10021");
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id] });
    expect(state.scheme.threat).toBe(3);
  });

  it("Beat Cop accumulates real removed threat, then exhausts and discards before non-attack minion damage", () => {
    let state = base();
    const cop = inPlay(state, "10029");
    state.scheme.threat = 5;
    state.player.confused = true;
    state = command(state, { type: "ABILITY", id: cop.id, action: "cop-move" });
    state = choose(state, "main");
    expect(state.scheme.threat).toBe(4);
    expect(state.player.inPlay[0]).toMatchObject({
      counters: 1,
      exhausted: true,
    });
    expect(state.player.confused).toBe(true);
    state.player.inPlay[0].exhausted = false;
    state.player.inPlay[0].counters = 3;
    const target = minion(state, "01101");
    state.player.stunned = true;
    state = command(state, {
      type: "ABILITY",
      id: cop.id,
      action: "cop-damage",
    });
    state = choose(state, target.id);
    expect(state.player.inPlay.some((p) => p.id === cop.id)).toBe(false);
    expect(state.player.discard.some((p) => p.id === cop.id)).toBe(true);
    expect(state.minions.some((p) => p.id === target.id)).toBe(false);
    expect(state.player.stunned).toBe(true);
  });

  it("Inspiring Presence heals and readies a teammate's chosen ally and enforces the identity trait before paying", () => {
    let state = base(true);
    const ally = makePiece(state, "10011");
    ally.damage = 2;
    ally.exhausted = true;
    ally.ownerId = "p2";
    state.players[1].player.inPlay.push(ally);
    const h = hand(state, "10030", "10021");
    state.player.form = "alter";
    expect(playable(state, h[0])).toContain("Avenger");
    state.player.form = "hero";
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id] });
    state = choose(state, ally.id);
    expect(state.players[1].player.inPlay[0]).toMatchObject({
      damage: 1,
      exhausted: false,
    });
  });

  it("Electrostatic Armor deals its optional response damage after a zero-damage identity defense", () => {
    let state = base();
    const armor = inPlay(state, "10031");
    const hp = state.villain.hp;
    zeroBoosts(state);
    state = native(state, { type: "enemyAttack", id: state.villain.id });
    state = choose(state, "hero");
    expect(state.player.hp).toBe(18);
    expect(state.prompt?.options.map((p) => p.id)).toContain(armor.id);
    state = choose(state, armor.id);
    expect(state.villain.hp).toBe(hp - 1);
    expect(state.prompt).toBeNull();
  });

  it("a teammate's Backflip counts as identity defense for their controlled Armor without exhausting their hero", () => {
    let state = base(true);
    const armor = makePiece(state, "10031");
    armor.ownerId = "p1";
    const backflip = makePiece(state, "01003");
    backflip.ownerId = "p2";
    const other = seatView(state, "p2");
    other.player.inPlay.push(armor);
    other.player.hand = [backflip];
    other.player.deck = [makePiece(state, "01089")];
    zeroBoosts(state);
    const hp = state.villain.hp;
    state = native(state, {
      type: "enemyAttack",
      id: state.villain.id,
      actorId: "p2",
    });
    state = choose(state, "take");
    state = choose(state, "backflip");
    expect(state.players[1].player).toMatchObject({ hp: 10, exhausted: false });
    expect(state.prompt?.options.map((p) => p.id)).toContain(armor.id);
    state = choose(state, armor.id);
    expect(state.villain.hp).toBe(hp - 1);
    expect(state.players[1].player.inPlay[0]).toMatchObject({
      ownerId: "p1",
      code: "10031",
    });
    expect(state.players[0].player.hp).toBe(18);
  });

  it("You'll Pay uses actual Overkill damage to the identity rather than damage absorbed by an ally", () => {
    let state = base();
    const brawn = inPlay(state, "10011");
    brawn.damage = 4;
    inPlay(state, "10031");
    const charge = makePiece(state, "01099");
    charge.attachedTo = state.villain.id;
    state.attachments.push(charge);
    state.scheme.threat = 6;
    zeroBoosts(state);
    const h = hand(state, "10016", "10021");
    state = native(state, { type: "enemyAttack", id: state.villain.id });
    state = choose(state, brawn.id);
    expect(state.player.hp).toBe(14);
    expect(
      state.prompt?.options.filter((p) => p.id !== "pass").map((p) => p.id),
    ).toEqual([h[0].id]);
    state = choose(state, h[0].id);
    expect(state.prompt).toMatchObject({ kind: "payment", cost: 1 });
    state = command(state, { type: "PAY", ids: [h[1].id] });
    expect(state.scheme.threat).toBe(2);
    expect(state.player.discard.some((p) => p.id === h[0].id)).toBe(true);
  });

  it("a Confused identity can initiate You'll Pay's zero-damage thwart response to remove Confused", () => {
    let state = base();
    state.player.confused = true;
    state.scheme.threat = 6;
    zeroBoosts(state);
    const h = hand(state, "10016", "10021");
    state = native(state, { type: "enemyAttack", id: state.villain.id });
    state = choose(state, "hero");
    expect(state.player.hp).toBe(18);
    state = choose(state, h[0].id);
    state = command(state, { type: "PAY", ids: [h[1].id] });
    expect(state.player.confused).toBe(false);
    expect(state.scheme.threat).toBe(6);
  });

  it("Resourceful supplies a wild resource while exhausted and is discarded before the played effect resolves", () => {
    let state = base();
    const resourceful = inPlay(state, "10032");
    resourceful.exhausted = true;
    const h = hand(state, "10024", "10021");
    expect(
      paymentSources(state, h[0].id, h[0].code).find(
        (p) => p.id === resourceful.id,
      )?.resources,
    ).toEqual(["wild"]);
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [resourceful.id, h[1].id] });
    expect(state.player.inPlay.some((p) => p.id === resourceful.id)).toBe(
      false,
    );
    expect(state.player.discard.some((p) => p.id === resourceful.id)).toBe(
      true,
    );
    expect(state.player.inPlay.some((p) => p.code === "10024")).toBe(true);
    expect(paymentSources(state).some((p) => p.id === resourceful.id)).toBe(
      false,
    );
  });

  it("the printed basic-resource and support aliases preserve the native playable behavior", () => {
    let state = base();
    const h = hand(state, "10023", "10020", "10021");
    state = command(state, { type: "PLAY", id: h[0].id });
    state = command(state, { type: "PAY", ids: [h[1].id, h[2].id] });
    const before = state.player.hand.length;
    state = command(state, { type: "ABILITY", id: h[0].id });
    if (state.prompt) state = choose(state, "p1");
    expect(state.player.hand).toHaveLength(before + 1);
    expect(card(h[0]).name).toBe("Avengers Mansion");
  });
});
