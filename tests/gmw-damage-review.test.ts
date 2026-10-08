/** Independent native regression checks for RRG 1.8 damage timing. */
import { describe, expect, it } from "vitest";
import { newGame } from "../src/game/engine.js";
import type { GameState } from "../src/game/types.js";
import {
  base,
  choose,
  command,
  conserved,
  finish,
  hand,
  minion,
  native,
  owned,
  play,
  put,
  reload,
  respond,
  side,
  target,
  until,
} from "./gmw-test-helpers.js";

function murderedWindow(s: GameState) {
  return until(
    s,
    (state) => !!state.prompt && /Murdered You/i.test(state.prompt.title),
  );
}
function damageSetup() {
  const s = base("rocket");
  s.player.hp = 3;
  s.flags.rocketSchadenTurn = `${s.round}:${s.phase}:${s.turnPlayerId}`;
  s.flags.rocketSchadenAmount = 1;
  put(s, "16045");
  return s;
}
function giantWasp() {
  let s = newGame({
    heroId: "wsp",
    villainId: "rhino",
    aspect: "aggression",
    seed: 16046,
    pacing: "expert",
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  s.player.form = "hero";
  s.player.heroForm = "giant";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.player.deck = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.villain.hp = s.villain.maxHp = 50;
  return s;
}

describe("GMW damage adapter: actual damage and printed response timing", () => {
  it("discards Haymaker before Murdered You draws its reshuffled physical card, before Retaliate", () => {
    let s = base("rocket", "groot");
    const a = put(s, "01092"),
      b = put(s, "01092", "p2"),
      retaliation = owned(s, "01153");
    retaliation.attachedTo = s.villain.id;
    s.attachments.push(retaliation);
    // Two legal controllers each reduce this player's next card by one.
    s = choose(command(s, { type: "ABILITY", id: a.id }), "p1");
    s = choose(command(s, { type: "ABILITY", id: b.id, playerId: "p2" }), "p1");
    const haymaker = hand(s, "01087")[0];
    s.player.deck = [];
    s.player.discard = [];
    s.villain.hp = 2;
    s = murderedWindow(target(play(s, haymaker), s.villain.id));
    expect(s.player.hp).toBe(9);
    expect(s.villain.stage).toBe(2);
    expect(s.resolving.some((p) => p.id === haymaker.id)).toBe(false);
    // The host immediately recycles an exhausted deck after the event enters
    // the discard pile; the pending response can draw that very same copy.
    expect(s.player.deck.map((p) => p.id)).toEqual([haymaker.id]);
    expect(s.player.discard).toEqual([]);
    s = respond(reload(s), /Murdered You/i);
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual([haymaker.id]);
    expect(s.player.hp).toBe(8);
    expect(s.player.discard.some((p) => p.id === haymaker.id)).toBe(false);
    conserved(s, [haymaker, a]);
  });

  it("resolves Melee's first excess draw before its second enemy clause, retaining the event until that clause finishes", () => {
    let s = base("rocket");
    const first = minion(s, "01110"),
      second = minion(s, "01121"),
      top = s.player.deck.slice(0, 2);
    const h = hand(s, "05030", "16049", "16046");
    s = target(play(s, h[0], h.slice(1)), first.id);
    s = murderedWindow(s);
    expect(s.minions.some((p) => p.id === first.id)).toBe(false);
    expect(s.minions.find((p) => p.id === second.id)?.damage).toBe(0);
    expect(s.resolving.some((p) => p.id === h[0].id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === h[0].id)).toBe(false);
    s = respond(reload(s), /Murdered You/i);
    expect(s.player.hand.some((p) => p.id === top[0].id)).toBe(true);
    expect(s.prompt?.title).toMatch(/Melee.*another/i);
    s = murderedWindow(target(s, second.id));
    expect(s.resolving.some((p) => p.id === h[0].id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === h[0].id)).toBe(true);
    s = finish(respond(reload(s), /Murdered You/i));
    expect(s.player.hand.map((p) => p.id)).toEqual(top.map((p) => p.id));
    conserved(s, h);
  });

  it("Tough suppresses excess while positive dealt damage still triggers Schadenfreude", () => {
    let s = damageSetup();
    const enemy = minion(s, "01110");
    enemy.tough = true;
    s = native(s, {
      type: "damage",
      target: enemy.id,
      amount: 3,
      attack: true,
      source: "hero",
    });
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(5);
    expect(s.player.hand).toEqual([]);
    expect(s.minions.find((p) => p.id === enemy.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
  });

  it("Armored Rhino Suit absorbs a would-be excess packet without Follow Through, Murdered You or Schadenfreude", () => {
    let s = damageSetup();
    const armor = owned(s, "01098");
    armor.attachedTo = s.villain.id;
    s.attachments.push(armor);
    s.villain.hp = 1;
    s = native(s, {
      type: "damage",
      target: s.villain.id,
      amount: 4,
      attack: true,
      source: "hero",
    });
    expect(s.prompt).toBeNull();
    expect(s.villain.hp).toBe(1);
    expect(s.attachments.find((p) => p.id === armor.id)?.damage).toBe(4);
    expect(s.player.hp).toBe(3);
    expect(s.player.hand).toEqual([]);
  });

  it("protected Madame Hydra takes no damage and produces no false excess or Rocket responses", () => {
    let s = damageSetup();
    const enemy = minion(s, "01181", "p1", 5);
    side(s, "01180", 4);
    s = native(s, {
      type: "damage",
      target: enemy.id,
      amount: 3,
      attack: true,
      source: "hero",
    });
    expect(s.prompt).toBeNull();
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(5);
    expect(s.player.hp).toBe(3);
    expect(s.player.hand).toEqual([]);
  });

  it("Vibration Resistance removing the only excess prevents Follow Through and Murdered You while actual damage still heals", () => {
    let s = damageSetup();
    const enemy = minion(s, "01110"),
      reduction = owned(s, "14027");
    reduction.attachedTo = enemy.id;
    s.attachments.push(reduction);
    s = finish(
      native(s, {
        type: "damage",
        target: enemy.id,
        amount: 3,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.hp).toBe(5);
    expect(s.player.hand).toEqual([]);
  });

  it("a giant Wasp Hand Cannon split offers both Follow Through interrupts before either simultaneous packet is applied", () => {
    let s = giantWasp();
    const cannon = put(s, "16046"),
      follow = put(s, "16045"),
      first = minion(s, "01110", "p1", 1),
      second = minion(s, "01121", "p1", 1);
    cannon.counters = 3;
    s = respond(
      command(s, { type: "BASIC", action: "attack" }),
      /Hand Cannon/i,
      "16046",
    );
    expect(s.player.inPlay.find((p) => p.id === cannon.id)).toMatchObject({
      counters: 2,
      exhausted: true,
    });
    s = choose(s, `${first.id}:2`);
    s = choose(s, `${second.id}:2`);
    expect(s.minions.map((p) => p.damage)).toEqual([1, 1]);
    s = respond(s, /Follow Through/i, "16045");
    expect(s.prompt?.options.some((o) => o.id === follow.id)).toBe(true);
    expect(s.minions.map((p) => p.damage)).toEqual([1, 1]);
    s = respond(s, /Follow Through/i, "16045");
    s = finish(s);
    expect(s.minions).toEqual([]);
    expect(s.villain.hp).toBe(46);
    expect(s.player.inPlay.find((p) => p.id === follow.id)?.exhausted).toBe(
      false,
    );
    conserved(s, [cannon, follow]);
  });
});
