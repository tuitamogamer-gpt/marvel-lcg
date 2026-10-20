import { describe, expect, it } from "vitest";
import {
  abilityOptions,
  dispatch,
  makePiece,
  newGame,
  paymentSources,
} from "../src/game/engine.js";
import { heroStats } from "../src/game/cards.js";
import { magikRevealedTop, magikTopPlayable } from "../src/game/magik.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  attach,
  choose,
  command,
  finish,
  hand,
  minion,
  native,
  pay,
  physical,
  put,
  reload,
  respond,
  side,
  target,
  top,
} from "./dv-test-helpers.js";

function base() {
  let s = newGame({
    heroId: "magik",
    aspect: "aggression",
    villainId: "rhino",
    seed: 45037,
    pacing: "expert",
  });
  s = finish(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.deck = physical(s);
  s.player.hand = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.player.form = "hero";
  s.player.exhausted = false;
  s.player.flipped = false;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.villain.hp = s.villain.maxHp = 90;
  s.scheme.threat = 15;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01186"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
function played(s: GameState, p: Piece) {
  expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
  expect(physical(s).filter((q) => q.id === p.id)).toHaveLength(1);
  expect(s.player.hand.some((q) => q.id === p.id)).toBe(false);
  expect(s.resolving.some((q) => q.id === p.id)).toBe(false);
  expect(magikTopPlayable(s)).toBeUndefined();
  expect(s.flags.magikTopPhase).toBe(`${s.round}:${s.phase}`);
}

describe("Magik top-card play through other packs' native windows", () => {
  it("plays the actual top Moxie after flipping and consumes the phase before a second top response", () => {
    let s = base();
    s.player.form = "alter";
    const next = top(s, "13033"),
      p = top(s, "12016");
    const before = heroStats({ ...s, player: { ...s.player, form: "hero" } });
    s = command(s, { type: "FLIP" });
    s = finish(respond(reload(s), /Moxie/));
    played(s, p);
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.deck[0].id).toBe(next.id);
    expect(s.player.tough).toBe(false);
    expect(heroStats(s)).toMatchObject({
      attack: before.attack + 1,
      thwart: before.thwart + 1,
      defense: before.defense + 1,
    });
  });

  it("resumes a paid Lay Down the Law from its exact staged event after reload", () => {
    let s = base();
    s.player.form = "alter";
    attach(s, "15026", "hero"); // Magical Suspension adds one to its discounted cost.
    const [resource] = hand(s, "01091"),
      next = top(s, "45033"),
      p = top(s, "12031");
    s = respond(command(s, { type: "FLIP" }), /Lay Down the Law/);
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 1,
      cancelable: false,
    });
    expect(s.resolving.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(magikRevealedTop(s)?.id).toBe(next.id);
    expect(dispatch(reload(s), { type: "CANCEL" }).error).toMatch(
      /already revealed/,
    );
    s = pay(reload(s), [resource]);
    s = finish(target(s, "main"));
    played(s, p);
    expect(s.scheme.threat).toBe(11);
    expect(s.player.discard.filter((q) => q.id === resource.id)).toHaveLength(
      1,
    );
    expect(s.player.deck[0].id).toBe(next.id);
  });

  it.each(["13014", "13033"])(
    "plays Wasp form response %s from the eligible top",
    (code) => {
      let s = base();
      s.player.form = "alter";
      const p = top(s, code);
      s = command(s, { type: "FLIP" });
      s = respond(s, code === "13014" ? /Surprise Attack/ : /Perseverance/);
      s = finish(target(s, s.villain.id));
      played(s, p);
      if (code === "13014") expect(s.villain.hp).toBe(87);
      else expect(s.player.tough).toBe(true);
    },
  );

  it("heals actual excess basic-attack damage through top Moment of Triumph", () => {
    let s = base();
    s.player.hp = 3;
    const enemy = minion(s, "01103", s.activePlayerId, 2),
      p = top(s, "12030"),
      attack = heroStats(s).attack;
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, enemy.id);
    s = finish(respond(reload(s), /Moment of Triumph/));
    played(s, p);
    expect(s.player.hp).toBe(3 + attack - 1);
    expect(s.minions.some((q) => q.id === enemy.id)).toBe(false);
  });

  it("interrupts the actual initiating minion with top First Hit before continuing its attack", () => {
    let s = base();
    s.phase = "villain";
    const enemy = minion(s, "01103"),
      p = top(s, "18015");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = finish(respond(reload(s), /First Hit/));
    played(s, p);
    expect(s.minions.find((q) => q.id === enemy.id)?.damage).toBe(2);
    expect(s.player.hp).toBeLessThan(10);
  });

  it("plays top True Grit after actual hero defense using current THW", () => {
    let s = base();
    s.phase = "villain";
    const p = top(s, "18031"),
      thwart = heroStats(s).thwart;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    s = respond(s, /True Grit/);
    s = finish(target(reload(s), "main"));
    played(s, p);
    expect(s.scheme.threat).toBe(15 - thwart);
    expect(s.player.exhausted).toBe(true);
  });

  it("plays top You'll Pay for That only after actual villain attack damage", () => {
    let s = base();
    s.phase = "villain";
    const p = top(s, "10016"),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /You'll Pay for That/);
    const damage = hp - s.player.hp;
    s = finish(target(s, "main"));
    played(s, p);
    expect(damage).toBeGreaterThan(0);
    expect(s.scheme.threat).toBe(15 - Math.min(5, damage));
  });

  it("stages top Mean Swing before exhausting the actual Weapon and performs event PLAY", () => {
    let s = base();
    const weapon = put(s, "06019"),
      next = top(s, "45033"),
      p = top(s, "35019"),
      attack = heroStats(s).attack;
    weapon.attachedTo = "hero";
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(respond(reload(s), /Mean Swing/));
    played(s, p);
    expect(s.player.inPlay.find((q) => q.id === weapon.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.deck[0].id).toBe(next.id);
    expect(s.villain.hp).toBe(90 - attack - 3);
    expect(s.log.some((l) => l.text === "Play Mean Swing.")).toBe(true);
  });

  it("recycles when the directly played Mean Swing was the last deck card", () => {
    let s = base();
    const weapon = put(s, "06019"),
      p = top(s, "35019");
    weapon.attachedTo = "hero";
    s.player.discard.push(...s.player.deck.splice(1));
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(respond(s, /Mean Swing/));
    played(s, p);
    expect(s.player.deck.length).toBeGreaterThan(0);
    expect(s.encounter.dealt).toHaveLength(1);
  });

  it("pays Mean Swing's increased resource cost after staging its actual top and preserves the pending play across reload", () => {
    let s = base();
    attach(s, "09027", "hero");
    const weapon = put(s, "06019"),
      [resource] = hand(s, "01090"),
      next = top(s, "45033"),
      p = top(s, "35019"),
      attack = heroStats(s).attack;
    weapon.attachedTo = "hero";
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Mean Swing/);
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 2,
      cancelable: false,
    });
    expect(s.resolving.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.player.deck[0].id).toBe(next.id);
    expect(s.player.inPlay.find((q) => q.id === weapon.id)?.exhausted).toBe(
      true,
    );
    s = finish(pay(reload(s), [resource]));
    played(s, p);
    expect(s.villain.hp).toBe(90 - attack - 3);
    expect(s.attachments.some((q) => q.code === "09027")).toBe(false);
    expect(s.player.discard.filter((q) => q.id === resource.id)).toHaveLength(
      1,
    );
  });

  it("does not offer an unaffordable top Mean Swing or exhaust its Weapon", () => {
    let s = base();
    attach(s, "09027", "hero");
    const weapon = put(s, "06019"),
      p = top(s, "35019");
    weapon.attachedTo = "hero";
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.deck[0].id).toBe(p.id);
    expect(s.player.inPlay.find((q) => q.id === weapon.id)?.exhausted).toBe(
      false,
    );
    expect(magikTopPlayable(s)?.id).toBe(p.id);
  });

  it("recalculates Soulsword's ATK after the top Mean Swing exposes a different resource", () => {
    let s = base();
    const sword = put(s, "45034"),
      next = top(s, "45033"),
      p = top(s, "35019");
    sword.attachedTo = "hero";
    expect(heroStats(s).attack).toBe(3);
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(respond(s, /Mean Swing/));
    played(s, p);
    expect(s.player.deck[0].id).toBe(next.id);
    expect(heroStats(s).attack).toBe(2);
    expect(s.villain.hp).toBe(85);
  });

  it("pays the Weapon cost but grants no bonus when Counterspell cancels top Mean Swing", () => {
    let s = base();
    attach(s, "09030", "hero");
    const weapon = put(s, "06019"),
      p = top(s, "35019"),
      attack = heroStats(s).attack;
    weapon.attachedTo = "hero";
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(respond(s, /Mean Swing/));
    played(s, p);
    expect(s.villain.hp).toBe(90 - attack);
    expect(s.player.inPlay.find((q) => q.id === weapon.id)?.exhausted).toBe(
      true,
    );
    expect(s.attachments.some((q) => q.code === "09030")).toBe(false);
  });

  it("plays top Aerial Intervention and pays the actual controlled Aerial exhaust cost", () => {
    let s = base();
    const ally = put(s, "42020"),
      p = top(s, "42014"),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Aerial Intervention/);
    s = finish(target(reload(s), ally.id));
    played(s, p);
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.find((q) => q.id === ally.id)?.exhausted).toBe(true);
  });

  it("Warpath plays a paid top Hero Action in the villain phase after the player-phase allowance was used", () => {
    let s = base();
    s.flags.magikTopPhase = `${s.round}:player`;
    s.phase = "villain";
    const ally = put(s, "42013"),
      [resource] = hand(s, "01091"),
      next = top(s, "45033"),
      p = top(s, "45039");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, ally.id);
    s = respond(s, /Warpath/);
    s = choose(s, p.id);
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 1,
      cancelable: false,
    });
    expect(s.resolving.some((q) => q.id === p.id)).toBe(true);
    expect(magikRevealedTop(s)?.id).toBe(next.id);
    s = pay(reload(s), [resource]);
    s = finish(target(s, s.villain.id));
    played(s, p);
    expect(s.villain.hp).toBe(86);
  });

  it("replaces an encounter-deck treachery with the actual top Get in Front of Me", () => {
    let s = base();
    s.phase = "villain";
    const p = top(s, "44047"),
      treachery = makePiece(s, "01105");
    s = native(s, {
      type: "reveal",
      piece: treachery,
      fromEncounterDeck: true,
    });
    s = finish(respond(s, /Get in Front of Me/));
    played(s, p);
    expect(
      s.encounter.discard.filter((q) => q.id === treachery.id),
    ).toHaveLength(1);
    expect(s.player.hp).toBeLessThan(10);
  });

  it("top Barely a Scratch prevents attack damage using current printed icons", () => {
    let s = base();
    side(s, "01107");
    const p = top(s, "44017"),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = finish(respond(s, /Barely a Scratch/));
    played(s, p);
    expect(s.player.hp).toBe(hp - 1);
  });

  it("top Not my Responsibility replaces actual threat with damage to a controlled ally", () => {
    let s = base();
    const ally = put(s, "45041"),
      p = top(s, "44022");
    s = native(s, { type: "threat", target: "main", amount: 2 });
    s = respond(s, /Not my Responsibility/);
    s = finish(choose(reload(s), ally.id));
    played(s, p);
    expect(s.scheme.threat).toBe(15);
    expect(s.player.inPlay.find((q) => q.id === ally.id)?.damage).toBe(2);
  });

  it("Spider-Ham Team-Building Exercise plays an eligible top ally with both discounts", () => {
    let s = base();
    const exercise = put(s, "30022"),
      next = top(s, "45033"),
      p = top(s, "45042");
    s = command(s, {
      type: "ABILITY",
      id: exercise.id,
      action: "team-building",
    });
    s = finish(choose(reload(s), p.id));
    expect(s.player.inPlay.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(physical(s).filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.player.inPlay.find((q) => q.id === exercise.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.deck[0].id).toBe(next.id);
    expect(s.player.hand).toHaveLength(0);
    expect(magikTopPlayable(s)).toBeUndefined();
  });

  it("does not offer the top for resource payment, a physical hand discard cost or putting a hand ally into play", () => {
    const s = base(),
      ship = put(s, "44049"),
      plan = put(s, "27024"),
      p = top(s, "44002");
    expect(magikTopPlayable(s)?.id).toBe(p.id);
    expect(paymentSources(s).some((q) => q.id === p.id)).toBe(false);
    expect(abilityOptions(s, plan)).toEqual([]);
    expect(abilityOptions(s, ship)).toEqual([]);
    const bad = dispatch(reload(s), {
      type: "ABILITY",
      id: ship.id,
      action: "ship",
    });
    expect(bad.error).toBeTruthy();
    expect(bad.player.deck[0].id).toBe(p.id);
    expect(bad.player.inPlay.find((q) => q.id === ship.id)?.exhausted).toBe(
      false,
    );
  });
});
