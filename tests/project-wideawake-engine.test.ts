import { describe, expect, it } from "vitest";
import { abilityOptions, enemyStats } from "../src/game/engine.js";
import { isTextBlank } from "../src/game/card-text.js";
import {
  actualEncounter,
  base,
  captive,
  choose,
  command,
  conserved,
  hand,
  native,
  pay,
  respond,
  settle,
} from "./project-wideawake-test-helpers.js";

describe("Project Wideawake actual native card rules", () => {
  it("Jubilee retains both basic powers while her paid energy action is available", () => {
    let s = base();
    const mall = s.sideSchemes.find((p) => p.code === "32088a")!;
    s = settle(
      native(s, { type: "thwart", target: mall.id, amount: 4, source: "hero" }),
    );
    const jubilee = s.player.inPlay.find((p) => p.id === mall.id)!;
    expect(jubilee.code).toBe("32088b");
    hand(s, "01088");
    const options = abilityOptions(s, jubilee);
    expect(options.map((o) => o.id)).toEqual([
      "attack",
      "thwart",
      `wideawake-jubilee:${jubilee.id}`,
    ]);
    expect(options.every((o) => !o.disabled)).toBe(true);
    conserved(s);
  });
  it.each([
    ["32094", "01090", "01003", "physical"],
    ["32095", "01089", "01005", "mental"],
    ["32096", "01088", "01006", "energy"],
  ])(
    "%s attaches its original card and pays its real typed removal cost",
    (code, double, single) => {
      let s = base();
      const p = actualEncounter(s, code);
      const hp = s.villain.hp;
      s = settle(native(s, { type: "reveal", piece: p, skip: true }));
      expect(s.attachments.find((q) => q.id === p.id)?.attachedTo).toBe(
        s.villain.id,
      );
      if (code === "32094") expect(enemyStats(s, s.villain).attack).toBe(3);
      if (code === "32095") expect(enemyStats(s, s.villain).scheme).toBe(3);
      if (code === "32096") expect(s.villain.maxHp).toBe(hp + 8);
      const resources = hand(s, double, single);
      const option = abilityOptions(
        s,
        s.attachments.find((q) => q.id === p.id)!,
      )[0];
      expect(option).toBeTruthy();
      s = command(s, { type: "ABILITY", id: p.id, action: option.id });
      expect(s.prompt?.kind).toBe("payment");
      s = command(s, { type: "CANCEL" });
      expect(s.attachments.some((q) => q.id === p.id)).toBe(true);
      expect(
        resources.every((p) => s.player.hand.some((q) => q.id === p.id)),
      ).toBe(true);
      s = command(s, { type: "ABILITY", id: p.id, action: option.id });
      s = settle(pay(s, resources));
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
      expect(s.attachments.some((q) => q.id === p.id)).toBe(false);
      expect(s.villain.maxHp).toBe(hp);
      conserved(s);
    },
  );

  it("Adaptive Armor preserves damage when blanked, restored, advanced and discarded", () => {
    let s = base();
    const armor = actualEncounter(s, "32096");
    s = settle(native(s, { type: "reveal", piece: armor, skip: true }));
    expect(s.villain.maxHp).toBe(24);
    s.villain.hp -= 5;
    // Apply the shared native text-blank state to this exact source.
    s.flags[`novaIronheartPackBlank:${armor.id}`] = s.round;
    expect(isTextBlank(s, armor)).toBe(true);
    s = settle(native(s, { type: "flag", key: "armorCheck", value: true }));
    expect(s.villain.maxHp).toBe(16);
    expect(s.villain.hp).toBe(11);
    delete s.flags[`novaIronheartPackBlank:${armor.id}`];
    s = settle(native(s, { type: "flag", key: "armorCheck", value: false }));
    expect(s.villain.maxHp).toBe(24);
    expect(s.villain.hp).toBe(19);
    s.villain.tough = false;
    s.villain.toughCards = 0;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 19,
        source: "hero",
      }),
    );
    expect(s.villain.code).toBe("32085");
    expect(s.villain.maxHp).toBe(26);
    s = settle(native(s, { type: "discardPiece", id: armor.id }));
    expect(s.villain.maxHp).toBe(18);
    expect(s.villain.hp).toBe(18);
    conserved(s);
  });

  it("Self-Repair removes both Steady statuses, restores Tough and heals actual damage", () => {
    let s = base();
    s.villain.code = "32085";
    s.villain.stage = 2;
    s.villain.maxHp = 18;
    s.villain.hp = 11;
    s.villain.stunned = s.villain.confused = true;
    s.villain.stunCards = s.villain.confuseCards = 2;
    const repair = actualEncounter(s, "32097");
    s = settle(native(s, { type: "reveal", piece: repair, skip: true }));
    expect(s.villain).toMatchObject({
      hp: 16,
      stunned: false,
      confused: false,
      stunCards: 0,
      confuseCards: 0,
      tough: true,
      toughCards: 1,
    });
    expect(s.encounter.discard.some((p) => p.id === repair.id)).toBe(true);
    conserved(s);
  });

  it("Rictor's actual attack response damages the villain and only his engaged minions", () => {
    let s = base("spider_man", true);
    const rictor = captive(s, "32089"),
      own = actualEncounter(s, "32101"),
      other = actualEncounter(s, "32105");
    own.engagedWith = "p1";
    other.engagedWith = "p2";
    s.minions.push(own, other);
    s.villain.tough = false;
    s.villain.toughCards = 0;
    const hp = s.villain.hp;
    s = command(s, { type: "ABILITY", id: rictor.id, action: "attack" });
    s = choose(s, own.id);
    s = respond(s, /Rictor/);
    s = settle(s);
    expect(s.villain.hp).toBe(hp - 1);
    expect(s.minions.some((p) => p.id === own.id)).toBe(false);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(0);
    expect(s.player.inPlay.find((p) => p.id === rictor.id)?.damage).toBe(1);
    conserved(s);
  });

  it.each([false, true])(
    "Learning A.I. grants Retaliate for Boom's actual attack, but not her delayed bomb (blanked %s)",
    (blanked) => {
      let s = base();
      const boom = captive(s, "32090"),
        ai = actualEncounter(s, "32095");
      s = settle(native(s, { type: "reveal", piece: ai, skip: true }));
      if (blanked) s.flags[`novaIronheartPackBlank:${ai.id}`] = s.round;
      s.villain.tough = false;
      s.villain.toughCards = 0;
      const hp = s.villain.hp;
      s = command(s, { type: "ABILITY", id: boom.id, action: "attack" });
      if (s.prompt?.options.some((o) => o.id === s.villain.id))
        s = choose(s, s.villain.id);
      s = settle(respond(s, /Boom Boom/));
      expect(s.villain.hp).toBe(hp - 1);
      expect(s.player.inPlay.find((p) => p.id === boom.id)?.damage).toBe(
        blanked ? 1 : 2,
      );
      expect(s.projectWideawake?.bombs).toEqual([
        { enemyId: s.villain.id, count: 1 },
      ]);
      expect(s.projectWideawake?.delayedBombs).toHaveLength(1);
      s = command(s, { type: "END_TURN" });
      expect(s.phase).toBe("villain");
      expect(s.villain.hp).toBe(hp - 3);
      expect(s.player.inPlay.find((p) => p.id === boom.id)?.damage).toBe(
        blanked ? 1 : 2,
      );
      expect(s.projectWideawake?.bombs).toEqual([]);
      expect(s.projectWideawake?.delayedBombs).toEqual([]);
      conserved(s);
    },
  );

  it.each([0, 2])(
    "Cannonball reduces consequence only for an actual minion defeat (starting damage %s)",
    (damage) => {
      let s = base();
      const ally = captive(s, "32091"),
        minion = actualEncounter(s, "32093");
      minion.damage = damage;
      minion.engagedWith = s.activePlayerId;
      s.minions.push(minion);
      s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
      s = settle(s.prompt ? choose(s, minion.id) : s);
      expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(
        damage ? 0 : 1,
      );
      expect(s.minions.some((p) => p.id === minion.id)).toBe(!damage);
      conserved(s);
    },
  );

  it("Wolfsbane's actual native attack pierces the minion's Tough", () => {
    let s = base();
    const ally = captive(s, "32092"),
      minion = actualEncounter(s, "32101");
    minion.engagedWith = s.activePlayerId;
    minion.tough = true;
    minion.toughCards = 1;
    s.minions.push(minion);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = settle(choose(s, minion.id));
    expect(s.minions.some((p) => p.id === minion.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    conserved(s);
  });
});
