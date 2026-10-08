/** Native damage accounting against RRG 1.8 pp.14,31,32,35.
 * Every command and saved continuation crosses a JSON reload boundary.
 * Original source IDs are conserved; injected encounter positions use real
 * printed cards. Kree Combat Armor remains outside the supported import scope.
 */
import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { Effect, GameState } from "../src/game/types.js";
import {
  attach,
  base,
  command,
  finish,
  hand,
  minion,
  native,
  physical,
  play,
  put,
  reload,
  respond,
  side,
  target,
} from "./dv-test-helpers.js";

function rocketPosition(villainId = "rhino") {
  let s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId,
    seed: 19028,
    pacing: "expert",
  });
  s = finish(command(s, { type: "MULLIGAN", ids: [] }));
  const originals = physical(s);
  expect(originals).toHaveLength(40);
  s.player.deck = originals;
  s.player.hand = [];
  s.player.discard = [];
  s.player.inPlay = [];
  for (const p of originals) p.ownerId = s.activePlayerId;
  s.player.form = "hero";
  s.player.hp = 1;
  s.player.exhausted = false;
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 6;
  s.villain.hp = s.villain.maxHp = 50;
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  (s as GameState & { dvSourceIds: Record<string, string[]> }).dvSourceIds = {
    [s.activePlayerId]: originals.map((p) => p.id),
  };
  const [schadenfreude, resource] = hand(s, "16032", "16049");
  return finish(play(s, schadenfreude, [resource]));
}
function damage(
  s: GameState,
  targetId: string,
  amount: number,
  fields: Partial<Effect> = {},
) {
  return finish(
    native(s, {
      type: "damage",
      target: targetId,
      amount,
      source: "hero",
      ...fields,
    }),
  );
}

describe("native dealt damage survives taken prevention", () => {
  it("Schadenfreude heals through Tough without inventing an excess draw", () => {
    let s = rocketPosition();
    const enemy = minion(s, "01103");
    enemy.tough = true;
    const handIds = s.player.hand.map((p) => p.id);
    s = damage(s, enemy.id, 4, { attack: true });
    expect(s.player.hp).toBe(3);
    expect(s.minions.find((p) => p.id === enemy.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
    expect(s.player.hand.map((p) => p.id)).toEqual(handIds);
  });

  it("Schadenfreude heals when a constant reduction prevents the entire packet", () => {
    let s = rocketPosition();
    const enemy = minion(s, "01103");
    attach(s, "14027", enemy.id);
    s = damage(s, enemy.id, 1, { attack: true });
    expect(s.player.hp).toBe(3);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
  });

  it("zero dealt damage causes neither healing nor a Challenge response", () => {
    let s = rocketPosition();
    s = damage(s, s.villain.id, 0, { attack: true });
    expect(s.player.hp).toBe(1);
    let d = base("drax");
    const challenge = attach(d, "19028", d.villain.id);
    d = damage(d, d.villain.id, 0, { attack: true });
    expect(d.attachments.some((p) => p.id === challenge.id)).toBe(true);
  });

  it("a native saved queue retains dealt, taken and excess independently", () => {
    let s = rocketPosition();
    const enemy = minion(s, "01103");
    enemy.tough = true;
    s.pacing = "guided";
    s.guided = true;
    s.queue = [
      {
        type: "damage",
        target: enemy.id,
        amount: 4,
        source: "hero",
        attack: true,
      },
    ];
    s.prompt = {
      kind: "choice",
      title: "Resolve saved attack",
      text: "",
      options: [{ id: "go", label: "Resolve", effects: [] }],
    };
    s = dispatch(reload(s), { type: "CHOOSE", id: "go" });
    expect(s.error).toBeUndefined();
    expect(s.review).toBeTruthy();
    const response = s.queue.find((e) => e.type === "rocketDamageResponses");
    expect(response?.snapshot).toMatchObject({
      damageDealt: 4,
      actualDamage: 0,
      excessDamage: 0,
      playerId: "p1",
    });
    s = command(reload(s), { type: "PROCEED" });
    s = finish(s);
    expect(s.player.hp).toBe(3);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
  });
});

describe("prohibitions and dealt replacements precede Tough", () => {
  it.each([false, true])(
    "Robot damage prohibition preserves Tough (piercing=%s)",
    (piercing) => {
      let s = rocketPosition();
      const robot = minion(s, "05028");
      robot.tough = true;
      s = damage(s, robot.id, 4, {
        attack: true,
        attackAlreadyInitiated: true,
        piercing,
      });
      expect(s.minions.find((p) => p.id === robot.id)).toMatchObject({
        damage: 0,
        tough: true,
      });
      expect(s.player.hp).toBe(1);
    },
  );

  it("Madame Hydra's active protection preserves Tough for nonattack damage", () => {
    let s = rocketPosition();
    const hydra = minion(s, "01181");
    hydra.tough = true;
    side(s, "01180");
    s = damage(s, hydra.id, 4);
    expect(s.minions.find((p) => p.id === hydra.id)).toMatchObject({
      damage: 0,
      tough: true,
    });
    expect(s.player.hp).toBe(1);
  });

  it("a prohibited Drax damage clause does not satisfy Challenge", () => {
    let s = base("drax");
    const robot = minion(s, "05028"),
      challenge = attach(s, "19028", robot.id);
    robot.tough = true;
    s = damage(s, robot.id, 4, { attack: true, attackAlreadyInitiated: true });
    expect(s.attachments.some((p) => p.id === challenge.id)).toBe(true);
    expect(s.minions.find((p) => p.id === robot.id)?.tough).toBe(true);
  });

  it.each([false, true])(
    "Rhino Armor replaces dealt damage before Tough (piercing=%s)",
    (piercing) => {
      let s = rocketPosition();
      const armor = attach(s, "01098", s.villain.id);
      s.villain.tough = true;
      s = damage(s, s.villain.id, 4, { attack: true, piercing });
      expect(s.attachments.find((p) => p.id === armor.id)?.damage).toBe(4);
      expect(s.villain.tough).toBe(true);
      expect(s.villain.hp).toBe(50);
      expect(s.player.hp).toBe(1);
    },
  );

  it("Rhino Armor receives the dealt amount before Vibration changes taken damage", () => {
    let s = rocketPosition();
    const armor = attach(s, "01098", s.villain.id);
    attach(s, "14027", s.villain.id);
    s = damage(s, s.villain.id, 4, { attack: true });
    expect(s.attachments.find((p) => p.id === armor.id)?.damage).toBe(4);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hp).toBe(1);
  });

  it("an Armor replacement never satisfies Drax's four-damage condition", () => {
    let s = base("drax");
    const armor = attach(s, "01098", s.villain.id),
      challenge = attach(s, "19028", s.villain.id);
    s.villain.tough = true;
    s = damage(s, s.villain.id, 4, { attack: true });
    expect(s.attachments.find((p) => p.id === armor.id)?.damage).toBe(4);
    expect(s.attachments.some((p) => p.id === challenge.id)).toBe(true);
  });
});

describe("Norman replaces damage taken rather than damage dealt", () => {
  it.each(["ordinary", "tough", "resistance"] as const)(
    "retains positive dealt damage through %s while respecting Tough precedence",
    (protection) => {
      let s = rocketPosition("risky_business");
      const enterprise = s.environments!.find((p) => p.code === "02006a")!;
      expect(enterprise).toBeTruthy();
      enterprise.counters = 8;
      if (protection === "tough") s.villain.tough = true;
      if (protection === "resistance") attach(s, "14027", s.villain.id);
      s = damage(s, s.villain.id, 4, { attack: true });
      expect(s.villain.hp).toBe(50);
      expect(s.player.hp).toBe(3);
      expect(
        s.environments!.find((p) => p.id === enterprise.id)?.counters,
      ).toBe(protection === "tough" ? 8 : protection === "resistance" ? 5 : 4);
      expect(s.villain.tough).toBe(false);
    },
  );

  it("Norman's taken replacement retains an unprevented Overkill spill", () => {
    let s = rocketPosition("risky_business");
    const enterprise = s.environments!.find((p) => p.code === "02006a")!;
    enterprise.counters = 8;
    const enemy = minion(s, "19027");
    s = damage(s, enemy.id, 9, { attack: true, overkill: true });
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hp).toBe(5); // Minion damage and unprevented damage dealt to Norman.
    expect(s.environments!.find((p) => p.id === enterprise.id)?.counters).toBe(
      4,
    );
  });
});

describe("Drax damage attribution and attack-origin Overkill", () => {
  it.each(["ordinary", "tough", "resistance"] as const)(
    "one physical Knife Leap preserves the specific Overkill accounting through %s",
    (protection) => {
      let s = base("drax");
      s.flags.draxVengeanceCounters = 3;
      hand(s, "19005");
      const yotat = minion(s, "19027"),
        challenge = attach(s, "19028", s.villain.id);
      attach(s, "01119", s.villain.id); // Retaliate must not treat the spill as another attack.
      if (protection === "tough") s.villain.tough = true;
      if (protection === "resistance") attach(s, "14027", s.villain.id);
      s = target(command(s, { type: "BASIC", action: "attack" }), yotat.id);
      s = finish(target(respond(s, /Knife Leap/i), yotat.id));
      expect(s.minions.some((p) => p.id === yotat.id)).toBe(false);
      expect(s.villain.hp).toBe(
        protection === "tough" ? 50 : protection === "resistance" ? 47 : 46,
      );
      expect(s.player.hp).toBe(14);
      // P31's specific exception: prevented excess is not dealt to the spill
      // recipient. Ordinary attacked-target prevention still follows p35.
      expect(s.attachments.some((p) => p.id === challenge.id)).toBe(
        protection !== "ordinary",
      );
      expect(
        s.encounter.discard.filter((p) => p.id === challenge.id),
      ).toHaveLength(protection === "ordinary" ? 1 : 0);
    },
  );

  it("a saved minion's prevented defeat creates no Overkill packet", () => {
    let s = base("drax");
    const loki = minion(s, "06028"),
      challenge = attach(s, "19028", s.villain.id);
    s.encounter.deck.unshift(makePiece(s, "01104")); // Treachery saves Loki instead of defeat.
    s = damage(s, loki.id, 8, { attack: true, overkill: true });
    expect(s.minions.some((p) => p.id === loki.id)).toBe(true);
    expect(s.villain.hp).toBe(50);
    expect(s.attachments.some((p) => p.id === challenge.id)).toBe(true);
  });

  it("another player's attack is not attributed to Drax", () => {
    let s = base("drax", "vnm");
    const challenge = attach(s, "19028", s.villain.id);
    s = damage(s, s.villain.id, 4, { attack: true, actorId: "p2" });
    expect(s.villain.hp).toBe(46);
    expect(s.attachments.some((p) => p.id === challenge.id)).toBe(true);
    expect(seatView(s, "p1").heroId).toBe("drax");
  });

  it("an ally's attack and identity nonattack damage do not satisfy Challenge", () => {
    let s = base("drax");
    const mantis = put(s, "19002"),
      challenge = attach(s, "19028", s.villain.id);
    s = damage(s, s.villain.id, 4, { attack: true, source: mantis.id });
    s = damage(s, s.villain.id, 4);
    expect(s.villain.hp).toBe(42);
    expect(s.attachments.some((p) => p.id === challenge.id)).toBe(true);
  });

  it("separate two-damage attacks do not combine into a four-damage attack", () => {
    let s = base("drax");
    const challenge = attach(s, "19028", s.villain.id);
    s = damage(s, s.villain.id, 2, { attack: true });
    s = damage(s, s.villain.id, 2, { attack: true });
    expect(s.villain.hp).toBe(46);
    expect(s.attachments.some((p) => p.id === challenge.id)).toBe(true);
  });
});
