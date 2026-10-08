/** Native Drax acceptance against the original Protection starter and RRG1.8. */
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { card, handSize, heroCard, heroStats } from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import { dispatch, playable } from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
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
  owned,
  paidPlay,
  pay,
  physical,
  play,
  put,
  reload,
  respond,
  side,
  starting,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

describe("Drax's original retail source", () => {
  it("creates forty original Protection instances, printed stats and one obligation", () => {
    const codes = heroStarterCodes("drax");
    const source = STARTER_DECKS.find((d) => d.id === "starter-19001a")!;
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("19"))).toBe(true);
    expect(deckErrors("drax", "protection", codes)).toEqual([]);
    expect(catalog.filter((c) => c.pack_code === "drax")).toHaveLength(34);
    const s = starting("drax");
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.hp).toBe(14);
    expect(heroCard(s).code).toBe("19001b");
    expect(handSize(s)).toBe(6);
    expect(s.encounter.deck.filter((p) => p.code === "19025")).toHaveLength(1);
  });

  it("keeps all forty source IDs through mulligan and the printed hero stats", () => {
    let s = starting("drax");
    const source = physical(s);
    s = finish(
      command(s, {
        type: "MULLIGAN",
        ids: s.player.hand.slice(0, 2).map((p) => p.id),
      }),
    );
    expect(physical(s)).toHaveLength(40);
    conserved(s, source);
    s = command(s, { type: "FLIP" });
    expect(heroStats(s)).toMatchObject({
      attack: 1,
      thwart: 1,
      defense: 2,
      recover: 4,
    });
    expect(handSize(s)).toBe(4);
    expect(heroCard(s).traits).toContain("Guardian");
  });
});

describe("Drax's actual completed villain attacks and vengeance", () => {
  it("places one optional counter after each actual attack and adds it to ATK", () => {
    let s = base("drax");
    const source = physical(s);
    for (let count = 1; count <= 3; count++) {
      s = native(s, { type: "enemyAttack", id: s.villain.id });
      s = respond(s, /Vengeance/i);
      s = finish(s);
      expect(s.flags.draxVengeanceCounters).toBe(count);
      expect(heroStats(s).attack).toBe(1 + count);
    }
    expect(s.player.hp).toBe(8);
    conserved(s, source);
  });

  it("draws the actual top card instead of adding a fourth counter", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 3;
    const draw = s.player.deck[0];
    s = finish(
      respond(
        native(s, { type: "enemyAttack", id: s.villain.id }),
        /Vengeance/i,
      ),
    );
    expect(s.flags.draxVengeanceCounters).toBe(3);
    expect(s.player.hand.map((p) => p.id)).toEqual([draw.id]);
    conserved(s, [draw]);
  });

  it("retains counters beyond three placed by external effects and draws at that limit", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 4;
    expect(heroStats(s).attack).toBe(5);
    const draw = s.player.deck[0];
    s = finish(
      respond(
        native(s, { type: "enemyAttack", id: s.villain.id }),
        /Vengeance/i,
      ),
    );
    expect(s.flags.draxVengeanceCounters).toBe(4);
    expect(s.player.hand.some((p) => p.id === draw.id)).toBe(true);
  });

  it("Tough prevents damage while the villain still attacked Drax", () => {
    let s = base("drax");
    s.player.tough = true;
    s = finish(
      respond(
        native(s, { type: "enemyAttack", id: s.villain.id }),
        /Vengeance/i,
      ),
    );
    expect(s.player.hp).toBe(14);
    expect(s.player.tough).toBe(false);
    expect(s.flags.draxVengeanceCounters).toBe(1);
  });

  it("a minion attack or Stun-replaced villain activation gives no vengeance", () => {
    let s = base("drax");
    const enemy = minion(s);
    s = finish(
      native(s, { type: "enemyAttack", id: enemy.id }),
      (v) => v.prompt?.options.find((o) => o.id === "take")?.id,
    );
    expect(s.flags.draxVengeanceCounters || 0).toBe(0);
    const hp = s.player.hp;
    s.villain.stunned = true;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp);
    expect(s.flags.draxVengeanceCounters || 0).toBe(0);
  });

  it("declining the response preserves zero counters", () => {
    let s = base("drax");
    s = finish(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === "take")?.id,
    );
    expect(s.flags.draxVengeanceCounters || 0).toBe(0);
  });

  it("own ally defense allows Payback but never claims the named Drax response", () => {
    let s = base("drax");
    const ally = put(s, "19002"),
      event = hand(s, "19007")[0];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === ally.id));
    s = choose(s, ally.id);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "19007"));
    expect(s.prompt?.options.some((o) => o.id === "vengeance")).toBe(false);
    s = finish(respond(s, /Payback/i));
    expect(s.player.hp).toBe(14);
    expect(s.villain.hp).toBe(49);
    expect(s.flags.draxVengeanceCounters || 0).toBe(0);
    conserved(s, [ally, event]);
  });

  it("choosing vengeance before Payback increases that response's real damage", () => {
    let s = base("drax");
    hand(s, "19007");
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      /Vengeance/i,
    );
    s = finish(respond(s, /Payback/i));
    expect(s.villain.hp).toBe(48);
    expect(s.flags.draxVengeanceCounters).toBe(1);
  });

  it("changing to alter-ego removes every counter and heals two per counter", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 4;
    s.player.hp = 3;
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("alter");
    expect(s.player.hp).toBe(11);
    expect(s.flags.draxVengeanceCounters).toBe(0);
  });
});

describe("Drax's native knives, events and damage interrupts", () => {
  it("both printed Knife upgrades affect hero form only", () => {
    let s = base("drax");
    put(s, "19008");
    put(s, "19009");
    expect(heroStats(s).attack).toBe(2);
    s = finish(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === "take")?.id,
    );
    expect(s.villain.hp).toBe(49);
    s = command(s, { type: "FLIP" });
    expect(heroStats(s).attack).toBe(1);
  });

  it("Intimidation uses current ATK, and Confused cancels its entire thwart", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 3;
    put(s, "19008");
    s = finish(target(paidPlay(s, "19004", "19021"), "main"));
    expect(s.scheme.threat).toBe(1);
    s.player.confused = true;
    s = finish(paidPlay(s, "19004", "19021"));
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(1);
  });

  it("Fight Me Coward readies and draws before a real villain attack", () => {
    let s = base("drax");
    s.player.exhausted = true;
    const h = hand(s, "19003"),
      draw = s.player.deck[0];
    s = play(s, h[0]);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.some((p) => p.id === draw.id)).toBe(true);
    s = finish(respond(s, /Vengeance/i));
    expect(s.player.hp).toBe(12);
    conserved(s, [...h, draw]);
  });

  it("Knife Leap costs zero at three vengeance and pierces before overkill", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 3;
    const h = hand(s, "19005"),
      enemy = minion(s);
    enemy.tough = true;
    s = target(command(s, { type: "BASIC", action: "attack" }), enemy.id);
    s = finish(target(respond(s, /Knife Leap/i), enemy.id));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.villain.hp).toBe(50 - (9 - card(enemy).health!));
    expect(heroStats(s).attack).toBe(4);
    conserved(s, h);
  });

  it("two actual Knife Leaps stack for one basic use without permanent ATK", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 3;
    const h = hand(s, "19005", "19005");
    s = target(command(s, { type: "BASIC", action: "attack" }), "villain");
    s = respond(s, /Knife Leap/i);
    s = respond(s, /Knife Leap/i);
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(36);
    expect(heroStats(s).attack).toBe(4);
    conserved(s, h);
  });

  it("DWI Theet draws after a Tough-prevented real basic attack but not a Stun replacement", () => {
    let s = base("drax");
    put(s, "19010");
    s.villain.tough = true;
    const draw = s.player.deck[0];
    s = target(command(s, { type: "BASIC", action: "attack" }), "villain");
    s = finish(respond(s, /DWI Theet/i));
    expect(s.villain.hp).toBe(50);
    expect(s.player.hand.some((p) => p.id === draw.id)).toBe(true);
    s.player.exhausted = false;
    s.player.stunned = true;
    const count = s.player.hand.length;
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.player.hand).toHaveLength(count);
    expect(s.player.stunned).toBe(false);
  });

  it("Parry prevents double the actual ATK from direct damage without exhausting Drax", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 2;
    put(s, "19008");
    const event = hand(s, "19006")[0];
    s = finish(
      respond(
        native(s, {
          type: "damage",
          target: "hero",
          amount: 9,
          source: "encounter",
        }),
        /Parry/i,
      ),
    );
    expect(s.player.hp).toBe(13);
    expect(s.player.exhausted).toBe(false);
    conserved(s, [event]);
  });

  it("Tough consumes first and preserves the unplayed Parry", () => {
    let s = base("drax");
    s.player.tough = true;
    const event = hand(s, "19006")[0];
    s = finish(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 5,
        source: "encounter",
      }),
    );
    expect(s.player.hp).toBe(14);
    expect(s.player.tough).toBe(false);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
  });

  it("Too Stubborn replaces defeat, heals from all vengeance and removes the exact upgrade", () => {
    let s = base("drax");
    s.player.hp = 1;
    s.flags.draxVengeanceCounters = 3;
    const upgrade = put(s, "19011");
    s = finish(
      respond(
        native(s, {
          type: "damage",
          target: "hero",
          amount: 7,
          source: "encounter",
        }),
        /Too Stubborn/i,
        "19011",
      ),
    );
    expect(s.phase).not.toBe("lost");
    expect(s.player.form).toBe("alter");
    expect(s.player.hp).toBe(10);
    expect(s.flags.draxVengeanceCounters).toBe(0);
    expect(s.removed.filter((p) => p.id === upgrade.id)).toHaveLength(1);
    conserved(s, [upgrade]);
  });

  it("a forced-form prohibition preserves vengeance while Stubborn still sets four HP and removes itself", () => {
    let s = base("drax");
    s.player.hp = 1;
    s.flags.draxVengeanceCounters = 2;
    const upgrade = put(s, "19011"),
      lock = owned(s, "02048");
    lock.attachedTo = "hero:p1";
    s.attachments.push(lock);
    s = finish(
      respond(
        native(s, {
          type: "damage",
          target: "hero",
          amount: 4,
          source: "encounter",
        }),
        /Too Stubborn/i,
        "19011",
      ),
    );
    expect(s.player.hp).toBe(4);
    expect(s.player.form).toBe("hero");
    expect(s.flags.draxVengeanceCounters).toBe(2);
    expect(s.removed.some((p) => p.id === upgrade.id)).toBe(true);
  });

  it("signature interrupts cannot be played as ordinary player actions", () => {
    const s = base("drax");
    const cards = hand(s, "19005", "19006", "19007");
    for (const p of cards) expect(playable(s, p)).toBeTruthy();
  });
});

describe("Drax's native obligation and nemesis", () => {
  it("Memories can force alter-ego healing before exhausting and removing itself", () => {
    let s = base("drax");
    s.player.hp = 4;
    s.flags.draxVengeanceCounters = 3;
    const obligation = owned(s, "19025");
    s = native(s, { type: "reveal", piece: obligation });
    s = choose(s, "flip");
    s = finish(choose(s, "remove"));
    expect(s.player.form).toBe("alter");
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(true);
    expect(s.flags.draxVengeanceCounters).toBe(0);
    expect(s.removed.some((p) => p.id === obligation.id)).toBe(true);
    encounterConserved(s, [obligation]);
  });

  it("Shadows imports Yotat, Cull's per-player threat and all original nemesis quantities", () => {
    let s = base("drax", "vnm");
    const shadow = owned(s, "01190");
    s = finish(native(s, { type: "reveal", piece: shadow }));
    expect(s.minions.filter((p) => p.code === "19027")).toHaveLength(1);
    expect(s.sideSchemes.find((p) => p.code === "19026")?.counters).toBe(4);
    expect(s.encounter.deck.filter((p) => p.code === "19028")).toHaveLength(1);
    expect(s.encounter.deck.filter((p) => p.code === "19029")).toHaveLength(2);
  });

  it("Challenge attaches to the actual highest ATK and adds its printed two", () => {
    let s = base("drax");
    const yotat = minion(s, "19027");
    const challenge = owned(s, "19028");
    s = finish(
      target(native(s, { type: "reveal", piece: challenge }), yotat.id),
    );
    expect(s.attachments.find((p) => p.id === challenge.id)?.attachedTo).toBe(
      yotat.id,
    );
    s.player.tough = true;
    s = native(s, { type: "enemyAttack", id: yotat.id });
    expect(s.prompt?.text).toMatch(/5 base ATK|5.*ATK/);
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "take")?.id);
    encounterConserved(s, [challenge]);
  });

  it("Challenge discards after four damage DEALT even when Tough prevents all HP loss", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 3;
    const enemy = minion(s, "19027"),
      challenge = attach(s, "19028", enemy.id);
    enemy.tough = true;
    s = finish(
      target(command(s, { type: "BASIC", action: "attack" }), enemy.id),
    );
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
    expect(s.attachments.some((p) => p.id === challenge.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === challenge.id)).toBe(true);
  });

  it("records completed physical attacks through Tough, excluding Stun replacements", () => {
    let s = base("drax");
    const attacker = s.villain.id;
    s = finish(native(s, { type: "enemyAttack", id: attacker }));
    expect(s.enemyAttackCounts?.[attacker]).toBe(1);
    s.player.tough = true;
    s = finish(native(s, { type: "enemyAttack", id: attacker }));
    expect(s.enemyAttackCounts?.[attacker]).toBe(2);
    s.villain.stunned = true;
    s = finish(native(s, { type: "enemyAttack", id: attacker }));
    expect(s.enemyAttackCounts?.[attacker]).toBe(2);
  });

  it("I Will Destroy You uses Yotat's actual +1 attack instead of the villain", () => {
    let s = base("drax");
    const yotat = minion(s, "19027");
    s = finish(native(s, { type: "reveal", piece: owned(s, "19029") }));
    expect(s.player.hp).toBe(10);
    expect(s.enemyAttackCounts?.[yotat.id]).toBe(1);
    expect(s.enemyAttackCounts?.[s.villain.id] || 0).toBe(0);
    expect(s.flags.draxVengeanceCounters || 0).toBe(0);
  });

  it("a Stun-replaced Yotat attack causes the printed fallback villain attack", () => {
    let s = base("drax");
    const yotat = minion(s, "19027");
    yotat.stunned = true;
    s = finish(native(s, { type: "reveal", piece: owned(s, "19029") }));
    expect(s.player.hp).toBe(12);
    expect(s.minions.find((p) => p.id === yotat.id)?.stunned).toBe(false);
    expect(s.enemyAttackCounts?.[yotat.id] || 0).toBe(0);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
  });

  it("First Hit aborts Yotat before completion and the saved treachery resumes its fallback", () => {
    let s = base("drax");
    const yotat = minion(s, "19027", "p1", 3),
      h = hand(s, "18015", "19021");
    s = respond(
      native(s, { type: "reveal", piece: owned(s, "19029") }),
      /First Hit/i,
      "18015",
    );
    s = finish(pay(s, [h[1]]));
    expect(s.minions.some((p) => p.id === yotat.id)).toBe(false);
    expect(s.enemyAttackCounts?.[yotat.id] || 0).toBe(0);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    expect(s.player.hp).toBe(12);
    conserved(s, h);
  });

  it("Counter-Punch before Vengeance uses the old ATK, then preserves the identity response", () => {
    let s = base("drax");
    const h = hand(s, "19014");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    s = respond(s, /Counter.Punch/i, "19014");
    s = finish(respond(s, /Vengeance/i));
    expect(s.villain.hp).toBe(49);
    expect(s.flags.draxVengeanceCounters).toBe(1);
    expect(s.player.hp).toBe(14);
    conserved(s, h);
  });

  it("Vengeance before Counter-Punch uses the increased ATK in the same saved defense window", () => {
    let s = base("drax");
    const h = hand(s, "19014");
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "hero");
    s = respond(s, /Vengeance/i);
    s = finish(respond(reload(s), /Counter.Punch/i, "19014"));
    expect(s.villain.hp).toBe(48);
    expect(s.flags.draxVengeanceCounters).toBe(1);
    conserved(s, h);
  });

  it("declining Too Stubborn causes an actual solo defeat", () => {
    let s = base("drax");
    s.player.hp = 1;
    const upgrade = put(s, "19011");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "encounter",
    });
    expect(s.prompt?.title).toBe("Too Stubborn to Die");
    s = finish(choose(reload(s), "defeat"));
    expect(s.phase).toBe("lost");
    expect(s.players[0].eliminated).toBe(true);
    expect(s.player.form).toBe("hero");
    expect(s.removed.some((p) => p.id === upgrade.id)).toBe(false);
  });

  it("declining Too Stubborn eliminates only Drax while the teammate and original source IDs survive", () => {
    let s = base("drax", "vnm");
    s.player.hp = 1;
    put(s, "19011");
    const originals = physical(s),
      teammateHP = seatView(s, "p2").player.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "encounter",
    });
    s = finish(choose(reload(s), "defeat"));
    expect(s.phase).not.toBe("lost");
    expect(s.players[0].eliminated).toBe(true);
    expect(s.players[1].eliminated).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(teammateHP);
    conserved(s, originals, "p1");
  });
});
