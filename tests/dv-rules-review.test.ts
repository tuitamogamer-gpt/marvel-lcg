/** Independent saved native reviews of common Drax/Venom pack rules. */
import { describe, expect, it } from "vitest";
import { card, heroStats } from "../src/game/cards.js";
import { dispatch, playable } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import {
  attach,
  base,
  choose,
  command,
  conserved,
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
  target,
  top,
  until,
} from "./dv-test-helpers.js";

describe("printed dealt costs, consequential damage and ownership", () => {
  it("Mantis pays DEAL1 through Tough and heals a damaged teammate's actual identity", () => {
    let s = base("drax", "vnm");
    const mantis = put(s, "19002");
    mantis.tough = true;
    seatView(s, "p2").player.hp = 5;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: mantis.id, action: "mantis" }),
        "hero:p2",
      ),
    );
    expect(seatView(s, "p2").player.hp).toBe(8);
    expect(s.player.hp).toBe(14);
    expect(s.player.inPlay.find((p) => p.id === mantis.id)).toMatchObject({
      damage: 0,
      tough: false,
      exhausted: true,
    });
    conserved(s, [mantis]);
  });

  it("Mantis's lethal damage cost still resolves the chosen heal after her defeat", () => {
    let s = base("drax");
    s.player.hp = 5;
    const mantis = put(s, "19002");
    mantis.damage = 2;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: mantis.id, action: "mantis" }),
        "hero",
      ),
    );
    expect(s.player.hp).toBe(8);
    expect(s.player.inPlay.some((p) => p.id === mantis.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === mantis.id)).toBe(true);
    conserved(s, [mantis]);
  });

  it("Martyr gains Tough only after actual consequential damage from a defeating attack", () => {
    let s = base("drax");
    const martyr = put(s, "19012"),
      enemy = minion(s, "01110");
    s = target(
      command(s, { type: "ABILITY", id: martyr.id, action: "attack" }),
      enemy.id,
    );
    s = finish(respond(s, /Martyr/i, "19012"));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === martyr.id)).toMatchObject({
      damage: 1,
      tough: true,
    });
    conserved(s, [martyr]);
  });

  it("Tough-prevented consequential damage cannot retrigger Martyr's response", () => {
    let s = base("drax");
    const martyr = put(s, "19012"),
      enemy = minion(s, "01110");
    martyr.tough = true;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: martyr.id, action: "attack" }),
        enemy.id,
      ),
    );
    expect(s.player.inPlay.find((p) => p.id === martyr.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
  });

  it("lethal consequential damage defeats Martyr before her optional Tough response", () => {
    let s = base("drax");
    const martyr = put(s, "19012"),
      enemy = minion(s, "01110");
    martyr.damage = 2;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: martyr.id, action: "attack" }),
        enemy.id,
      ),
    );
    expect(s.player.inPlay.some((p) => p.id === martyr.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === martyr.id)).toBe(true);
  });

  it("Regroup returns an enemy-attack-defeated ally to its owner, not its controller", () => {
    let s = base("drax", "vnm");
    const ally = put(s, "19002"),
      regroup = put(s, "19032", "p2");
    ally.damage = 2;
    s.player.inPlay = s.player.inPlay.filter((p) => p.id !== ally.id);
    seatView(s, "p2").player.inPlay.push(ally);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === ally.id));
    s = choose(s, ally.id);
    s = finish(respond(s, /Regroup/i, "19032"));
    expect(s.player.hand.find((p) => p.id === ally.id)).toMatchObject({
      damage: 0,
      exhausted: false,
      tough: false,
    });
    expect(seatView(s, "p2").player.hand.some((p) => p.id === ally.id)).toBe(
      false,
    );
    expect(
      seatView(s, "p2").player.inPlay.some((p) => p.id === regroup.id),
    ).toBe(true);
    conserved(s, [ally]);
    conserved(s, [regroup], "p2");
  });

  it("Regroup ignores consequential defeat and discards at the actual round boundary", () => {
    let s = base("drax");
    const regroup = put(s, "19032"),
      ally = put(s, "19012");
    ally.damage = 2;
    const enemy = minion(s, "01110");
    s = finish(
      target(
        command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
        enemy.id,
      ),
    );
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(false);
    s = finish(native(s, { type: "newRound" }));
    expect(s.player.inPlay.some((p) => p.id === regroup.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === regroup.id)).toBe(true);
    conserved(s, [regroup, ally]);
  });
});

describe("native Drax common event and ally chains", () => {
  it("Leading Blow's real discarded boost adjusts the attack and readies even through Tough", () => {
    let s = base("drax");
    s.flags.draxVengeanceCounters = 2;
    const leading = hand(s, "19017")[0],
      boost = owned(s, "19028");
    s.encounter.deck.unshift(boost);
    s.villain.tough = true;
    s = target(command(s, { type: "BASIC", action: "attack" }), "villain");
    s = finish(target(respond(s, /Leading Blow/i, "19017"), "villain"));
    expect(s.player.exhausted).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.villain.tough).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === leading.id)).toBe(true);
    conserved(s, [leading]);
  });

  it("Leading Blow fails to ready only when printed boosts reduce actual dealt damage to zero", () => {
    let s = base("drax");
    const leading = hand(s, "19017")[0],
      boost = owned(s, "19027");
    s.encounter.deck.unshift(boost);
    s = target(command(s, { type: "BASIC", action: "attack" }), "villain");
    s = finish(target(respond(s, /Leading Blow/i, "19017"), "villain"));
    expect(s.villain.hp).toBe(50);
    expect(s.player.exhausted).toBe(true);
    conserved(s, [leading]);
  });

  it("Subdue reduces a real enemy activation without exhausting or defending with Drax", () => {
    let s = base("drax");
    const h = hand(s, "19018", "19021");
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      /Subdue/i,
      "19018",
    );
    s = pay(s, [h[1]]);
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "take")?.id);
    expect(s.player.hp).toBe(14);
    expect(s.player.exhausted).toBe(false);
    conserved(s, h);
  });

  it("Deflection prevents only chosen attack damage and mills that actual amount", () => {
    let s = base("drax");
    const h = hand(s, "19015", "19023"),
      before = s.player.deck.slice(0, 2);
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      /Deflection/i,
      "19015",
    );
    s = pay(s, [h[1]]);
    const amount = s.prompt?.options.find(
      (o) => o.id === "2" || /prevent 2/i.test(o.label),
    );
    expect(amount, JSON.stringify(s.prompt)).toBeTruthy();
    s = finish(choose(s, amount!.id));
    expect(s.player.hp).toBe(14);
    expect(s.player.exhausted).toBe(false);
    for (const p of before)
      expect(s.player.discard.some((c) => c.id === p.id)).toBe(true);
    conserved(s, [...h, ...before]);
  });

  it("Moondragon discards herself as cost, then a minion attacks another enemy without player Guard", () => {
    let s = base("drax");
    const moon = put(s, "19013"),
      attacker = minion(s, "01103"),
      guard = minion(s, "19027");
    s = command(s, { type: "ABILITY", id: moon.id, action: "command-minion" });
    s = target(s, attacker.id);
    expect(s.player.discard.some((p) => p.id === moon.id)).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === attacker.id)).not.toBe(true);
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(48);
    expect(s.minions.some((p) => p.id === guard.id)).toBe(true);
    conserved(s, [moon]);
  });

  it("a Stunned commanded minion consumes Stun without attacking the enemy", () => {
    let s = base("drax");
    const moon = put(s, "19013"),
      attacker = minion(s);
    attacker.stunned = true;
    s = target(
      command(s, { type: "ABILITY", id: moon.id, action: "command-minion" }),
      attacker.id,
    );
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(50);
    expect(s.minions.find((p) => p.id === attacker.id)?.stunned).toBe(false);
  });

  it("Gamora ally discards actual cards only until the first event and adds that physical event", () => {
    let s = base("drax");
    const ally = put(s, "19020"),
      event = top(s, "19003"),
      a = top(s, "19022"),
      b = top(s, "19008");
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
      "main",
    );
    s = finish(respond(s, /Gamora/i, "19020"));
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === a.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === b.id)).toBe(true);
    conserved(s, [ally, event, a, b]);
  });

  it("Bring It counts only the acting seat's engaged minions and is globally max one per phase", () => {
    let s = base("drax", "vnm");
    minion(s);
    minion(s, "01110");
    minion(s, "01103", "p2");
    const h = hand(s, "19030"),
      draws = s.player.deck.slice(0, 2);
    s = finish(play(s, h[0]));
    expect(s.player.hand.map((p) => p.id)).toEqual(draws.map((p) => p.id));
    const second = hand(s, "19030")[0];
    expect(playable(s, second)).toBeTruthy();
    conserved(s, [...h, ...draws]);
  });

  it("Think Fast's effect confuses after Tough prevents its independent one damage", () => {
    let s = base("drax");
    s.player.tough = true;
    s = finish(paidPlay(s, "19031", "19021"));
    expect(s.player.hp).toBe(14);
    expect(s.player.tough).toBe(false);
    expect(s.villain.confused).toBe(true);
  });

  it("Hard Knocks gives Tough only after its own attack actually defeats the enemy", () => {
    let s = base("drax");
    const enemy = minion(s, "01103"),
      h = hand(s, "19016", "19022", "19021");
    s = finish(target(play(s, h[0], h.slice(1)), enemy.id));
    expect(s.player.tough).toBe(true);
    conserved(s, h);
    s.player.tough = false;
    const toughEnemy = minion(s);
    toughEnemy.tough = true;
    s = finish(target(paidPlay(s, "19016", "19023", "19021"), toughEnemy.id));
    expect(s.player.tough).toBe(false);
  });
});

describe("native Venom common Weapons, costs and control", () => {
  it("Sonic Rifle initializes two actual charges, confuses, then deals nonattack damage and discards empty", () => {
    let s = base("vnm");
    const h = hand(s, "20015", "20017", "20004");
    s = finish(play(s, h[0], h.slice(1)));
    const rifle = s.player.inPlay.find((p) => p.id === h[0].id)!;
    expect(rifle.counters).toBe(2);
    s.player.stunned = true;
    minion(s);
    s = finish(
      target(
        command(s, { type: "ABILITY", id: rifle.id, action: "sonic" }),
        "villain",
      ),
    );
    expect(s.villain.confused).toBe(true);
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(true);
    s.player.inPlay.find((p) => p.id === rifle.id)!.exhausted = false;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: rifle.id, action: "sonic" }),
        "villain",
      ),
    );
    expect(s.villain.hp).toBe(47);
    expect(s.player.stunned).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === rifle.id)).toBe(false);
    conserved(s, h);
  });

  it("Plasma Pistol's three charge abilities are nonattacks and preserve Stun", () => {
    let s = base("vnm");
    const h = hand(s, "20022", "20018");
    s = finish(play(s, h[0], [h[1]]));
    s.player.stunned = true;
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.counters).toBe(3);
    for (let n = 0; n < 3; n++) {
      s.player.inPlay.find((p) => p.id === h[0].id)!.exhausted = false;
      s = finish(
        target(
          command(s, { type: "ABILITY", id: h[0].id, action: "plasma" }),
          "villain",
        ),
      );
    }
    expect(s.villain.hp).toBe(47);
    expect(s.player.stunned).toBe(true);
    expect(s.player.discard.some((p) => p.id === h[0].id)).toBe(true);
    conserved(s, h);
  });

  it("Jack Flag earns ammo from actual thwart, then spends it on nonattack damage", () => {
    let s = base("vnm");
    const jack = put(s, "20011");
    s = target(
      command(s, { type: "ABILITY", id: jack.id, action: "thwart" }),
      "main",
    );
    s = finish(respond(s, /Jack Flag/i, "20011"));
    expect(s.player.inPlay.find((p) => p.id === jack.id)?.counters).toBe(1);
    s.player.inPlay.find((p) => p.id === jack.id)!.exhausted = false;
    s.player.stunned = true;
    minion(s);
    s = finish(
      target(
        command(s, { type: "ABILITY", id: jack.id, action: "ammo" }),
        "villain",
      ),
    );
    expect(s.villain.hp).toBe(48);
    expect(s.player.stunned).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === jack.id)?.counters).toBe(0);
  });

  it("Side Holster moves its physical card to another controller but preserves ownership and max one", () => {
    let s = base("vnm", "drax");
    const h = hand(s, "20021");
    s = finish(target(play(s, h[0]), "p2"));
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === h[0].id)?.ownerId,
    ).toBe("p1");
    const second = hand(s, "20021")[0];
    s = play(s, second);
    expect(s.prompt?.options.some((o) => o.id === "p2")).not.toBe(true);
    s = finish(target(s, "p1"));
  });

  it("Side Holster permits four Restricted cards and playing a fifth forces a physical discard", () => {
    let s = base("vnm");
    put(s, "20010");
    put(s, "20010");
    put(s, "20008");
    put(s, "20021");
    const h = hand(s, "20022", "20018");
    expect(playable(s, h[0])).toBeNull();
    s = finish(play(s, h[0], [h[1]]));
    expect(
      s.player.inPlay.filter((p) => card(p).text?.includes("Restricted")),
    ).toHaveLength(4);
    const extra = hand(s, "03009", "20017");
    expect(card(extra[0]).traits).not.toContain("Weapon");
    s = play(s, extra[0], [extra[1]]);
    expect(s.prompt?.title).toBe("Restricted limit");
    s = finish(choose(s, extra[0].id));
    expect(
      s.player.inPlay.filter((p) => card(p).text?.includes("Restricted")),
    ).toHaveLength(4);
    expect(s.player.discard.some((p) => p.id === extra[0].id)).toBe(true);
    conserved(s, extra);
  });

  it("Fusillade exhausts its additional-cost Weapon before Stun cancels its whole attack", () => {
    let s = base("vnm");
    const weapon = put(s, "20010"),
      h = hand(s, "20026", "20018");
    s.player.stunned = true;
    s = play(s, h[0], [h[1]]);
    s = finish(target(s, weapon.id));
    expect(s.player.inPlay.find((p) => p.id === weapon.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    conserved(s, [weapon, ...h]);
  });

  it("Crew Quarters can be controlled by a teammate and heals only a damaged alter-ego", () => {
    let s = base("vnm", "drax");
    const h = hand(s, "20029", "20004");
    s = finish(target(play(s, h[0], [h[1]]), "p2"));
    seatView(s, "p2").player.form = "alter";
    seatView(s, "p2").player.hp = 5;
    s = finish(
      target(
        command(s, {
          type: "ABILITY",
          id: h[0].id,
          action: "heal-alter-ego",
          playerId: "p2",
        }),
        "p2",
      ),
    );
    expect(seatView(s, "p2").player.hp).toBe(6);
    expect(s.player.hp).toBe(12);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === h[0].id)?.exhausted,
    ).toBe(true);
  });

  it("Welcome Aboard reduces the next actual teammate ally play and is global max one per round", () => {
    let s = base("vnm", "drax");
    const event = hand(s, "20027")[0];
    s = finish(play(s, event));
    s = finish(native(s, { type: "beginTurn", actorId: "p2" }));
    expect(s.activePlayerId).toBe("p2");
    const h = hand(s, "19002");
    expect(playable(s, h[0])).toBeNull();
    s = finish(play(s, h[0]));
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
    const other = hand(s, "20027")[0];
    expect(playable(s, other)).toBeTruthy();
  });

  it("Making an Entrance heals after its actual basic thwart clears all threat", () => {
    let s = base("vnm");
    s.player.hp = 5;
    s.scheme.threat = 3;
    const h = hand(s, "20013", "20004");
    s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
    s = respond(s, /Making an Entrance/i, "20013");
    s = finish(target(pay(s, [h[1]]), "main"));
    expect(s.scheme.threat).toBe(0);
    expect(s.player.hp).toBe(7);
    expect(heroStats(s).thwart).toBe(1);
    conserved(s, h);
  });

  it("Making an Entrance does not heal for a thwart that leaves threat", () => {
    let s = base("vnm");
    s.player.hp = 5;
    const h = hand(s, "20013", "20004");
    s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
    s = respond(s, /Making an Entrance/i, "20013");
    s = finish(target(pay(s, [h[1]]), "main"));
    expect(s.scheme.threat).toBe(3);
    expect(s.player.hp).toBe(5);
  });

  it("Shake It Off requires actual Guardian attack damage, not Tough prevention or consequential damage", () => {
    let s = base("vnm");
    const h = hand(s, "20028", "20004");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Shake.*Off/i, "20028");
    s = finish(pay(s, [h[1]]));
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(true);
    conserved(s, h);
    const next = hand(s, "20028", "20004");
    s = finish(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === "take")?.id,
    );
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(s.player.hand.some((p) => p.id === next[0].id)).toBe(true);
  });

  it("Scare Tactic's attack targets only an actually confused enemy", () => {
    let s = base("vnm");
    const enemy = minion(s, "01110"),
      h = hand(s, "20012", "20004");
    s.villain.confused = true;
    s = play(s, h[0], [h[1]]);
    expect(s.prompt?.options.some((o) => o.id === enemy.id)).not.toBe(true);
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(47);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
  });
});

describe("native teammate defender and phase boundaries", () => {
  it("Venom's actual Pistol modifies teammate defense without triggering initial-target Spider-Sense", () => {
    let s = base("drax", "vnm");
    const pistol = put(s, "20010", "p2"),
      sense = put(s, "20009", "p2");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero:p2"));
    expect(seatView(s, "p2").player.hand).toHaveLength(0);
    s = choose(s, "hero:p2");
    s = finish(respond(s, /Venom.*Pistol/i, "20010"));
    expect(seatView(s, "p2").player.hp).toBe(12);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === pistol.id)
        ?.exhausted,
    ).toBe(true);
    expect(seatView(s, "p2").player.hand).toHaveLength(0);
    expect(s.player.hp).toBe(14);
    expect(s.flags.draxVengeanceCounters || 0).toBe(0);
    conserved(s, [pistol, sense], "p2");
  });

  it("Symbiotic Bond's once-per-phase use resets at the actual native round boundary", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20004");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = pay(s, [h[1]], "mental", ["symbiotic-bond"]);
    s = finish(target(target(s, "main"), "villain"));
    expect(s.player.hp).toBe(11);
    const round = s.round;
    s = finish(native(s, { type: "newRound" }));
    expect(s.round).toBe(round + 1);
    const next = hand(s, "20002", "20004");
    s.scheme.threat = 6;
    s = command(s, { type: "PLAY", id: next[0].id });
    s = pay(s, [next[1]], "mental", ["symbiotic-bond"]);
    s = finish(target(target(s, "main"), "villain"));
    expect(s.player.hp).toBe(10);
  });
});
