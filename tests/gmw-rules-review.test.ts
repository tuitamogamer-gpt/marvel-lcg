/** Independent printed-rules regressions: RRG 1.8 and the official GMW FAQ. */
import { describe, expect, it } from "vitest";
import { aerial, heroStats, maxHP } from "../src/game/cards.js";
import { cardCost, dispatch, playable } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import {
  base,
  choose,
  command,
  conserved,
  finish,
  growth,
  hand,
  minion,
  native,
  owned,
  paidPlay,
  play,
  put,
  reload,
  respond,
  side,
  target,
  until,
} from "./gmw-test-helpers.js";
import { card } from "../src/game/cards.js";

describe("GMW independent damage, status and excess review", () => {
  it("direct damage to the other seat spends only the actual Groot recipient's growth", () => {
    let s = base("rocket", "groot");
    growth(s, 5, "p2");
    s = finish(
      native(s, {
        type: "damage",
        target: "hero:p2",
        amount: 3,
        source: "fixture",
      }),
    );
    expect(growth(s, undefined, "p2")).toBe(2);
    expect(growth(s, undefined, "p1")).toBe(0);
    expect(seatView(s, "p1").player.hp).toBe(9);
    expect(seatView(s, "p2").player.hp).toBe(10);
  });

  it("a Groot defender in the second seat owns the Vine Shield and Lashing Vines costs", () => {
    let s = base("rocket", "groot");
    growth(s, 5, "p2");
    const shield = put(s, "16010", "p2"),
      lash = put(s, "16009", "p2"),
      enemy = minion(s);
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "hero:p2");
    s = respond(s, /Vine Shield/i, "16010");
    s = respond(s, /Lashing Vines/i, "16009");
    s = finish(s);
    expect(growth(s, undefined, "p2")).toBe(2);
    expect(growth(s, undefined, "p1")).toBe(0);
    expect(seatView(s, "p1").player.hp).toBe(9);
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === shield.id)
        ?.exhausted,
    ).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === lash.id)?.exhausted,
    ).toBe(true);
  });

  it("Groot's Tough prevents Fan the Flames' entire combined indirect damage before growth", () => {
    let s = base("groot");
    growth(s, 6);
    s.player.tough = true;
    side(s, "16026", 3);
    minion(s, "16027");
    s = native(s, { type: "reveal", piece: owned(s, "16028"), skip: true });
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "hero")?.id);
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(growth(s)).toBe(6);
  });

  it("indirect allocation caps ignore Growth and Tough and emit one packet per chosen character", () => {
    let s = base("groot");
    s.player.hp = 1;
    growth(s, 5);
    s.player.tough = true;
    const ally = put(s, "16012");
    ally.damage = 1; // two remaining HP.
    s = native(s, { type: "indirect", amount: 3, source: "fixture" });
    s = choose(s, "hero");
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(false);
    s = choose(s, ally.id);
    s = choose(s, ally.id);
    s = respond(s, /Starhawk/i, "16012");
    s = finish(s);
    expect(s.player.hp).toBe(1);
    expect(growth(s)).toBe(5);
    expect(s.player.tough).toBe(false);
    expect(s.player.hand.find((p) => p.id === ally.id)).toMatchObject({
      code: "16012",
      damage: 0,
    });
  });

  it("Follow Through increases only actual excess, and each physical copy may trigger once", () => {
    let s = base("rocket");
    const a = put(s, "16045"),
      b = put(s, "16045"),
      gun = put(s, "16036"),
      enemy = minion(s);
    gun.counters = 2;
    s = target(
      command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
      enemy.id,
    );
    s = respond(s, /Follow Through/i, "16045");
    const remaining =
      s.prompt?.options.filter((o) => o.image === "16045") || [];
    expect(
      remaining.some((o) => o.id === a.id) &&
        remaining.some((o) => o.id === b.id),
    ).toBe(false);
    s = respond(s, /Follow Through/i, "16045");
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    expect(s.player.inPlay.find((p) => p.id === a.id)?.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === b.id)?.exhausted).toBe(false);
  });

  it("Follow Through cannot turn an exact lethal attack into excess damage", () => {
    let s = base("rocket");
    put(s, "16045");
    const gun = put(s, "16038"),
      enemy = minion(s);
    gun.counters = 1;
    enemy.damage = 1;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
        enemy.id,
      ),
    );
    expect(s.villain.hp).toBe(50);
    expect(s.player.hand).toHaveLength(0);
  });

  it("Into the Fray's actual GMW printing counts modified excess and keeps physical ownership", () => {
    let s = base("rocket");
    put(s, "16045");
    const enemy = minion(s),
      h = hand(s, "16042", "16049", "16050");
    s = target(play(s, h[0], [h[1], h[2]]), enemy.id);
    s = respond(s, /Follow Through/i, "16045");
    s = finish(s);
    expect(s.scheme.threat).toBe(2);
    expect(s.villain.hp).toBe(50);
    conserved(s, h);
  });

  it("Loki's replacement prevents the RRG 1.8 overkill transfer while Rocket may respond to actual excess", () => {
    let s = base("rocket");
    const gun = put(s, "16036"),
      enemy = minion(s, "06028");
    gun.counters = 2;
    enemy.damage = 3;
    s.encounter.deck.unshift(owned(s, "01104"));
    s = target(
      command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
      enemy.id,
    );
    s = respond(s, /Murdered You|draw 1 card/i);
    s = finish(s);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
    // RRG 1.8 p31 and FFG's September 2026 "Mission Updates" supersede
    // the archived pre-1.5 Loki ruling: overkill requires actual defeat.
    expect(s.villain.hp).toBe(50);
    expect(s.player.hand).toHaveLength(1);
  });

  it("Overkill to a one-HP villain creates a second independent excess draw", () => {
    let s = base("rocket");
    const gun = put(s, "16036"),
      enemy = minion(s);
    gun.counters = 2;
    enemy.damage = 2;
    s.villain.hp = 1;
    s = target(
      command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
      enemy.id,
    );
    s = respond(s, /Murdered You|draw 1 card/i);
    s = respond(s, /Murdered You|draw 1 card/i);
    s = finish(s);
    expect(s.player.hand).toHaveLength(2);
    expect(s.villain.stage).toBe(2);
  });

  it("Battery Pack can move a charge to Tech without printed charge mechanics", () => {
    let s = base("rocket");
    const battery = put(s, "16034"),
      skeleton = put(s, "16035");
    battery.counters = 2;
    s = command(s, { type: "ABILITY", id: battery.id, action: "battery" });
    s = finish(target(s, skeleton.id));
    expect(s.player.inPlay.find((p) => p.id === skeleton.id)?.counters).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === battery.id)?.counters).toBe(1);
  });

  it("Booster Boots prevent only the residual packet after Groot's forced growth prevention", () => {
    let s = base("groot");
    growth(s, 1);
    const boots = put(s, "16052"),
      top = s.player.deck[0],
      enemy = minion(s);
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "take");
    s = respond(s, /Booster Boots/i, "16052");
    s = finish(s);
    expect(growth(s)).toBe(0);
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.find((p) => p.id === boots.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.discard.find((p) => p.id === top.id)).toBeTruthy();
  });

  it("Tough and sufficient growth each prevent a Booster Boots interrupt from opening", () => {
    let s = base("groot");
    growth(s, 5);
    s.player.tough = true;
    const boots = put(s, "16052"),
      enemy = minion(s);
    s = finish(
      choose(native(s, { type: "enemyAttack", id: enemy.id }), "take"),
    );
    expect(growth(s)).toBe(5);
    expect(s.player.tough).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === boots.id)?.exhausted).toBe(
      false,
    );
    s = finish(
      choose(native(s, { type: "enemyAttack", id: enemy.id }), "take"),
    );
    expect(growth(s)).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === boots.id)?.exhausted).toBe(
      false,
    );
  });
});

describe("GMW native allies, defense and health thresholds", () => {
  it("the actual Rocket ally's minion attack gains optional +3 ATK and overkill", () => {
    let s = base("groot");
    const ally = put(s, "16019"),
      enemy = minion(s);
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      enemy.id,
    );
    s = respond(s, /Rocket Raccoon/i, "16019");
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });

  it("the actual Groot ally may heal after defending and surviving an attack", () => {
    let s = base("rocket");
    const ally = put(s, "16047"),
      enemy = minion(s);
    ally.damage = 1;
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), ally.id);
    s = respond(s, /Groot/i, "16047");
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    expect(s.player.hp).toBe(9);
  });

  it("Starhawk's exact lethal interrupt returns his physical card before normal defeat", () => {
    let s = base("groot");
    const ally = put(s, "16012");
    ally.damage = 1;
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 2,
      source: "fixture",
    });
    s = respond(s, /Starhawk/i, "16012");
    s = finish(s);
    expect(s.player.hand.find((p) => p.id === ally.id)).toMatchObject({
      code: "16012",
      damage: 0,
      exhausted: false,
    });
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(false);
    conserved(s, [ally]);
  });

  it("Starhawk returns on exact consequential damage after a thwart", () => {
    let s = base("groot");
    const ally = put(s, "16012");
    ally.damage = 2;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
      "main",
    );
    s = respond(s, /Starhawk/i, "16012");
    s = finish(s);
    expect(s.scheme.threat).toBe(5);
    expect(s.player.hand.find((p) => p.id === ally.id)).toBeTruthy();
    conserved(s, [ally]);
  });

  it("Starhawk returns on his exact two consequential attack damage", () => {
    let s = base("groot");
    const ally = put(s, "16012");
    ally.damage = 1;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      s.villain.id,
    );
    s = respond(s, /Starhawk/i, "16012");
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(s.player.hand.find((p) => p.id === ally.id)).toBeTruthy();
  });

  it("greater-than-lethal damage cannot trigger Starhawk, while Tough prevents his trigger", () => {
    let s = base("groot");
    const ally = put(s, "16012");
    ally.damage = 2;
    s = finish(
      native(s, {
        type: "damage",
        target: ally.id,
        amount: 2,
        source: "fixture",
      }),
    );
    expect(s.player.discard.find((p) => p.id === ally.id)).toBeTruthy();
    expect(s.player.hand).toHaveLength(0);
    const tough = put(s, "16012");
    tough.tough = true;
    s = finish(
      native(s, {
        type: "damage",
        target: tough.id,
        amount: 3,
        source: "fixture",
      }),
    );
    expect(s.player.inPlay.find((p) => p.id === tough.id)).toMatchObject({
      tough: false,
      damage: 0,
    });
  });

  it("Bug heals after a real basic hero attack, including zero actual damage", () => {
    let s = base("rocket");
    const bug = put(s, "16040");
    bug.damage = 1;
    s.villain.tough = true;
    s = target(command(s, { type: "BASIC", action: "attack" }), s.villain.id);
    s = respond(s, /Bug/i, "16040");
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === bug.id)?.damage).toBe(0);
    expect(s.villain.hp).toBe(50);
  });

  it("Stunned replacement and event attacks never count as Bug's basic trigger", () => {
    let s = base("rocket");
    const bug = put(s, "16040"),
      gun = put(s, "16038");
    bug.damage = 1;
    gun.counters = 1;
    s.player.stunned = true;
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    s = finish(
      target(
        command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
        s.villain.id,
      ),
    );
    expect(s.player.inPlay.find((p) => p.id === bug.id)?.damage).toBe(1);
  });

  it("Fighting Fit compares current HP to printed starting HP, not modified maximum HP", () => {
    let s = base("rocket");
    put(s, "16035");
    s.player.hp = 10;
    expect(maxHP(s)).toBe(12);
    s = finish(target(paidPlay(s, "16014", "16049"), s.villain.id));
    expect(s.villain.hp).toBe(45);
    s.player.hp = 8;
    s = finish(target(paidPlay(s, "16014", "16050"), s.villain.id));
    expect(s.villain.hp).toBe(43);
  });

  it("Dauntless retaliates only while current HP still meets printed starting HP after damage", () => {
    let s = base("rocket");
    put(s, "16035");
    put(s, "16016");
    const enemy = minion(s, "01101");
    s.player.hp = 12;
    s = finish(
      choose(native(s, { type: "enemyAttack", id: enemy.id }), "take"),
    );
    expect(s.player.hp).toBe(11);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    s.player.hp = 9;
    s = finish(
      choose(native(s, { type: "enemyAttack", id: enemy.id }), "take"),
    );
    expect(s.player.hp).toBe(8);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
  });

  it("each Hard to Ignore is optional non-thwart threat removal after a zero-damage defense", () => {
    let s = base("groot");
    const a = put(s, "16017"),
      b = put(s, "16017"),
      enemy = minion(s);
    s.player.confused = true;
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "hero");
    s = respond(s, /Hard to Ignore/i, "16017");
    s = respond(s, /Hard to Ignore/i, "16017");
    s = finish(s);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.confused).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === a.id)?.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === b.id)?.exhausted).toBe(true);
  });

  it("Crisis blocks Hard to Ignore's main-scheme removal even though it is not a thwart", () => {
    let s = base("groot");
    const upgrade = put(s, "16017"),
      enemy = minion(s);
    side(s, "01108", 2);
    s = finish(
      choose(native(s, { type: "enemyAttack", id: enemy.id }), "hero"),
    );
    expect(s.scheme.threat).toBe(6);
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.exhausted).toBe(
      false,
    );
  });
});

describe("GMW shared paid cards, Team-Up, and cost windows", () => {
  it("Looking for Trouble finds a physical minion, puts it in play as cost, and does not reveal its text", () => {
    let s = base("rocket");
    const found = owned(s, "01103");
    s.encounter.deck.unshift(owned(s, "01104"), found);
    const event = hand(s, "16043")[0];
    s = finish(play(s, event));
    expect(s.scheme.threat).toBe(3);
    expect(s.player.hp).toBe(9);
    expect(s.minions.find((p) => p.id === found.id)).toMatchObject({
      code: "01103",
      engagedWith: "p1",
    });
    conserved(s, [event]);
  });

  it("Looking for Trouble still pays its minion cost before Confused replaces the thwart", () => {
    let s = base("rocket");
    s.player.confused = true;
    const found = owned(s, "01103");
    s.encounter.deck.unshift(found);
    s = finish(paidPlay(s, "16043"));
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(6);
    expect(s.minions.some((p) => p.id === found.id)).toBe(true);
  });

  it("Hand Cannon uses a saved physical counter cost, grants overkill, and discards on its last charge", () => {
    let s = base("rocket");
    const cannon = put(s, "16046"),
      enemy = minion(s);
    cannon.counters = 1;
    enemy.damage = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Hand Cannon/i, "16046");
    s = finish(target(s, enemy.id));
    expect(s.villain.hp).toBe(49);
    expect(s.player.discard.find((p) => p.id === cannon.id)).toBeTruthy();
    conserved(s, [cannon]);
  });

  it("a Hand Cannon enters with Uses 3 and is not an interrupt for a Stunned replacement", () => {
    let s = base("rocket");
    const h = hand(s, "16046", "16049");
    s = finish(play(s, h[0], [h[1]]));
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.counters).toBe(3);
    s.player.stunned = true;
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.inPlay.find((p) => p.id === h[0].id)).toMatchObject({
      counters: 3,
      exhausted: false,
    });
  });

  it("Flora and Fauna binds Groot and Rocket identities across actual seats and refills the chosen upgrade", () => {
    let s = base("groot", "rocket");
    growth(s, 5);
    s.player.exhausted = true;
    const gun = put(s, "16036", "p2");
    gun.counters = 0;
    gun.exhausted = true;
    const h = hand(s, "16020", "16021");
    s = play(s, h[0], [h[1]]);
    s = finish(choose(s, gun.id));
    expect(growth(s)).toBe(5);
    expect(s.player.exhausted).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === gun.id),
    ).toMatchObject({ counters: 2, exhausted: false });
    conserved(s, h);
  });

  it("Flora and Fauna can ready the actual Groot identity in another player's alter-ego form", () => {
    let s = base("rocket", "groot");
    const groot = seatView(s, "p2");
    groot.player.form = "alter";
    groot.player.exhausted = true;
    growth(s, 9, "p2");
    s = paidPlay(s, "16048", "16049");
    s = finish(choose(s, "hero:p2"));
    expect(growth(s, undefined, "p2")).toBe(10);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
  });

  it("Flora and Fauna requires both named characters and refuses an unmatched hero", () => {
    const s = base("rocket"),
      h = hand(s, "16048", "16049");
    expect(playable(s, h[0])).toBeTruthy();
    put(s, "16047");
    expect(playable(s, h[0])).toBeNull();
  });

  it("Flora and Fauna can place growth on the actual Groot ally and ready that ally", () => {
    let s = base("rocket");
    const ally = put(s, "16047");
    ally.exhausted = true;
    s = paidPlay(s, "16048", "16049");
    s = finish(choose(s, ally.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      counters: 2,
      exhausted: false,
    });
  });

  it("Deft Focus survives a non-Superpower play and reduces the next actual Superpower only", () => {
    let s = base("groot");
    const focus = put(s, "16024");
    growth(s, 3);
    s = command(s, { type: "ABILITY", id: focus.id, action: "deft-focus" });
    expect(cardCost(s, card("16004"))).toBe(1);
    expect(cardCost(s, card("16012"))).toBe(2);
    s = finish(paidPlay(s, "16012", "16021"));
    expect(cardCost(s, card("16004"))).toBe(1);
    s = finish(target(paidPlay(s, "16004", "16007"), s.villain.id));
    expect(s.villain.hp).toBe(47);
    expect(cardCost(s, card("16004"))).toBe(2);
  });

  it("zero-cost Fruition still consumes Deft Focus's next-Superpower reduction", () => {
    let s = base("groot");
    const focus = put(s, "16024");
    s = command(s, { type: "ABILITY", id: focus.id, action: "deft-focus" });
    s = finish(paidPlay(s, "16002"));
    expect(growth(s)).toBe(2);
    expect(cardCost(s, card("16004"))).toBe(2);
  });

  it("Deft Focus is a hero action, Max 1 per player, and its reduction ends with the turn", () => {
    let s = base("groot");
    const focus = put(s, "16024");
    s.player.form = "alter";
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: focus.id,
        action: "deft-focus",
      }).error,
    ).toBeTruthy();
    s.player.form = "hero";
    const h = hand(s, "16024", "16021");
    expect(playable(s, h[0])).toBeTruthy();
    s = command(s, { type: "ABILITY", id: focus.id, action: "deft-focus" });
    s.scheme.threat = 0;
    s = command(s, { type: "END_TURN" });
    expect(cardCost(s, card("16004"))).toBe(2);
  });
});
