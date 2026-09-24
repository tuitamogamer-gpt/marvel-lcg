import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import type { Command, GameState } from "../src/game/types";

function game() {
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    seed: 34,
  });
  s = dispatch(s, { type: "MULLIGAN", ids: [] });
  s.player.form = "hero";
  s.guided = true;
  return s;
}
function send(s: GameState, c: Command) {
  const next = dispatch(s, c);
  expect(next.error).toBeUndefined();
  return next;
}
function enemy(s: GameState, defender = "hero") {
  s.attack = {
    attacker: "villain",
    targetPlayerId: s.activePlayerId,
    base: 3,
    boostCodes: [],
    boostEffects: [],
    defender,
    defense: 0,
    prevented: 0,
    damage: 0,
    overkill: false,
    isVillain: true,
  };
  s.prompt = {
    kind: "choice",
    title: "Resolve",
    text: "",
    options: [
      { id: "resolve", label: "Resolve", effects: [{ type: "finishAttack" }] },
    ],
  };
  return send(s, { type: "CHOOSE", id: "resolve" });
}

describe("combat presentation follows resolved attacks", () => {
  it("captures a hero strike once and does not replay it after a saved Proceed", () => {
    let s = send(game(), { type: "BASIC", action: "attack" });
    expect(s.combatEvents).toEqual([
      {
        attacker: { code: "01001a", name: "Spider-Man" },
        target: { code: "01094", name: "Rhino" },
        blocked: false,
        enemy: false,
      },
    ]);
    expect(s.villain.hp).toBe(12);
    s = send(JSON.parse(JSON.stringify(s)), { type: "PROCEED" });
    expect(s.combatEvents).toEqual([]);
    expect(s.villain.hp).toBe(12);
  });
  it("does not animate cancelled targeting or stun removal as a strike", () => {
    const s = game();
    s.player.stunned = true;
    const next = send(s, { type: "BASIC", action: "attack" });
    expect(next.combatEvents).toEqual([]);
    expect(next.villain.hp).toBe(14);
  });
  it.each(["tough", "armor"])("shows a blocked impact for %s", (protection) => {
    const s = game();
    if (protection === "tough") s.villain.tough = true;
    else {
      const armor = makePiece(s, "01098");
      armor.attachedTo = "villain";
      s.attachments.push(armor);
    }
    const next = send(s, { type: "BASIC", action: "attack" });
    expect(next.combatEvents?.[0].blocked).toBe(true);
    expect(next.villain.hp).toBe(14);
  });
  it("retains the defeated minion and ally attacker faces", () => {
    let s = game();
    const ally = makePiece(s, "01083"),
      minion = makePiece(s, "01110");
    s.player.inPlay.push(ally);
    minion.engagedWith = s.activePlayerId;
    minion.damage = 1;
    s.minions.push(minion);
    s = send(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.combatEvents).toEqual([]);
    s = send(s, { type: "CHOOSE", id: minion.id });
    expect(s.minions).toHaveLength(0);
    expect(s.combatEvents?.[0]).toMatchObject({
      attacker: { code: ally.code },
      target: { code: minion.code },
      blocked: false,
    });
  });
  it("retains the old villain stage in a finishing strike", () => {
    const s = game();
    s.villain.hp = 1;
    const next = send(s, { type: "BASIC", action: "attack" });
    expect(next.villain.stage).toBe(2);
    expect(next.combatEvents?.[0]).toMatchObject({
      target: { code: "01094" },
      blocked: false,
    });
  });
  it("targets the actual defending ally even when the ally is defeated", () => {
    const s = game(),
      ally = makePiece(s, "01083");
    ally.damage = 1;
    s.player.inPlay.push(ally);
    const next = enemy(s, ally.id);
    expect(next.player.inPlay).toHaveLength(0);
    expect(next.combatEvents?.[0]).toMatchObject({
      attacker: { name: "Rhino" },
      target: { code: ally.code },
      enemy: true,
      blocked: false,
    });
  });
  it("shows prevented enemy damage without inventing a hit", () => {
    const s = game();
    s.player.tough = true;
    const next = enemy(s);
    expect(next.player.hp).toBe(s.player.hp);
    expect(next.combatEvents?.[0]).toMatchObject({
      target: { code: "01001a" },
      enemy: true,
      blocked: true,
    });
  });
});
