import { describe, expect, it } from "vitest";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  attach,
  base,
  choose,
  command,
  conserved,
  encounterConserved,
  finish,
  hand,
  minion,
  native,
  pay,
  put,
  respond,
  top,
} from "./dv-test-helpers.js";

function commandMinion(s: GameState, attacker: Piece, target: string) {
  const moondragon = put(s, "19013");
  s = command(s, {
    type: "ABILITY",
    id: moondragon.id,
    action: "command-minion",
  });
  s = choose(s, attacker.id);
  s = choose(s, target);
  return { s, moondragon };
}

describe("Moondragon's native enemy attacks share the initiation window", () => {
  it("First Hit defeats the initiating minion before its redirected attack", () => {
    let s = base("drax");
    const attacker = minion(s, "01110"),
      h = hand(s, "18015", "20018");
    const activation = commandMinion(s, attacker, s.villain.id);
    s = respond(activation.s, /First Hit/i);
    s = finish(pay(s, [h[1]]));
    expect(s.minions.some((p) => p.id === attacker.id)).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hp).toBe(14);
    expect(s.enemyAttackCounts?.[attacker.id] || 0).toBe(0);
    expect(s.flags.draxVengeanceCounters || 0).toBe(0);
    expect(s.attack).toBeNull();
    conserved(s, [...h, activation.moondragon]);
    encounterConserved(s, [attacker]);
  });

  it("Subdue reduces the minion's attack against the villain without defending a hero", () => {
    let s = base("drax");
    const attacker = minion(s, "01103"),
      h = hand(s, "19018", "20018");
    const activation = commandMinion(s, attacker, s.villain.id);
    s = respond(activation.s, /Subdue/i);
    s = finish(pay(s, [h[1]]));
    expect(s.villain.hp).toBe(50);
    expect(s.player.hp).toBe(14);
    expect(s.player.exhausted).toBe(false);
    expect(s.enemyAttackCounts?.[attacker.id]).toBe(1);
    expect(s.flags.draxVengeanceCounters || 0).toBe(0);
    expect(s.attack).toBeNull();
    conserved(s, [...h, activation.moondragon]);
  });

  it.each([false, true])(
    "Retaliate resolves once when the enemy target has Tough=%s",
    (tough) => {
      let s = base("drax");
      const attacker = minion(s, "20025"),
        target = minion(s, "17026");
      target.tough = tough;
      const activation = commandMinion(s, attacker, target.id);
      s = finish(activation.s);
      expect(s.minions.find((p) => p.id === target.id)?.damage).toBe(
        tough ? 0 : 2,
      );
      expect(s.minions.find((p) => p.id === target.id)?.tough).toBe(false);
      expect(s.minions.find((p) => p.id === attacker.id)?.damage).toBe(1);
      expect(s.player.hp).toBe(14);
      expect(s.flags.draxVengeanceCounters || 0).toBe(0);
      expect(s.attack).toBeNull();
      conserved(s, [activation.moondragon]);
      encounterConserved(s, [attacker, target]);
    },
  );

  it("uses actual attack damage for Vibration Resistance", () => {
    let s = base("drax");
    const attacker = minion(s, "01103"),
      resistance = attach(s, "14027", s.villain.id);
    const activation = commandMinion(s, attacker, s.villain.id);
    s = finish(activation.s);
    expect(s.villain.hp).toBe(49);
    expect(s.player.hp).toBe(14);
    expect(s.enemyAttackCounts?.[attacker.id]).toBe(1);
    encounterConserved(s, [attacker, resistance]);
  });

  it("enemy Guard does not prohibit an enemy's redirected attack against the villain", () => {
    let s = base("drax");
    const attacker = minion(s, "01101");
    const activation = commandMinion(s, attacker, s.villain.id);
    s = finish(activation.s);
    expect(s.villain.hp).toBe(49);
    expect(s.player.hp).toBe(14);
    expect(s.attack).toBeNull();
  });

  it("saved Piercing removes enemy Tough and does not duplicate Retaliate", () => {
    let s = base("drax");
    const attacker = minion(s, "20025"),
      target = minion(s, "17026");
    target.tough = true;
    hand(s, "18015", "20018"); // Keep the real initiation window open for a saved keyword grant.
    const activation = commandMinion(s, attacker, target.id);
    s = activation.s;
    expect(s.prompt?.title).toBe("Enemy initiates attack");
    s.attack!.piercing = true;
    s = finish(choose(s, "continue"));
    expect(s.minions.find((p) => p.id === target.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === target.id)?.tough).toBe(false);
    expect(s.minions.find((p) => p.id === attacker.id)?.damage).toBe(1);
    expect(s.player.hp).toBe(14);
    encounterConserved(s, [attacker, target]);
  });

  it("saved Overkill against an enemy minion spills excess damage to the villain", () => {
    let s = base("drax");
    const attacker = minion(s, "01102"),
      target = minion(s, "01110");
    hand(s, "18015", "20018");
    const activation = commandMinion(s, attacker, target.id);
    s = activation.s;
    expect(s.prompt?.title).toBe("Enemy initiates attack");
    s.attack!.overkill = true;
    s = finish(choose(s, "continue"));
    expect(s.minions.some((p) => p.id === target.id)).toBe(false);
    expect(s.villain.hp).toBe(49);
    expect(s.player.hp).toBe(14);
    expect(s.enemyAttackCounts?.[attacker.id]).toBe(1);
    encounterConserved(s, [attacker, target]);
  });
});

describe("Venom and pack interrupts use one saved native attack window", () => {
  it("Spider-Sense draws Tendrils, Subdue resumes the window, and Tendrils cancels before boosts", () => {
    let s = base("vnm", "drax");
    const sense = put(s, "20009"),
      h = hand(s, "19018", "20018", "20019");
    const tendrils = top(s, "20003"),
      topBoost = s.encounter.deck[0];
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      /Spider-Sense/i,
    );
    expect(s.player.hand.some((p) => p.id === tendrils.id)).toBe(true);
    s = respond(s, /Subdue/i);
    s = pay(s, [h[1]]);
    expect(s.attack?.modifier).toBe(-3);
    expect(s.prompt?.options.some((o) => /Spider-Sense/i.test(o.label))).toBe(
      false,
    );
    s = respond(s, /Grasping Tendrils/i);
    s = finish(pay(s, [h[2]], "physical"));
    expect(s.attack).toBeNull();
    expect(s.villain.stunned).toBe(true);
    expect(s.player.hp).toBe(12);
    expect(s.player.exhausted).toBe(false);
    expect(s.encounter.deck[0].id).toBe(topBoost.id);
    expect(s.enemyAttackCounts?.[s.villain.id] || 0).toBe(0);
    expect(seatView(s, "p2").flags.draxVengeanceCounters || 0).toBe(0);
    conserved(s, [sense, tendrils, ...h]);
  });
});
