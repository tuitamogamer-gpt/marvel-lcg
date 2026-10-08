/** Native Rocket acceptance: physical GMW printings and every choice reloads. */
import { describe, expect, it } from "vitest";
import {
  aerial,
  handSize,
  heroCard,
  heroStats,
  maxHP,
} from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import { dispatch, newGame, playable } from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
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
  paidPlay,
  physical,
  play,
  put,
  reload,
  respond,
  side,
  target,
} from "./gmw-test-helpers.js";

describe("Rocket Raccoon's original Aggression source and printed identity", () => {
  it("launches forty physical GMW source cards and his actual obligation", () => {
    const source = STARTER_DECKS.find((d) => d.id === "starter-16029a")!;
    const codes = heroStarterCodes("rocket");
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("16"))).toBe(true);
    expect(deckErrors("rocket", "aggression", codes)).toEqual([]);
    const s = newGame({
      heroId: "rocket",
      aspect: "aggression",
      villainId: "rhino",
      seed: 16029,
    });
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.hp).toBe(9);
    expect(heroCard(s).code).toBe("16029b");
    expect(handSize(s)).toBe(6);
    expect(s.encounter.deck.filter((p) => p.code === "16053")).toHaveLength(1);
  });

  it("uses the printed stats and retains actual identity traits in both forms", () => {
    let s = base("rocket");
    expect(heroCard(s).code).toBe("16029a");
    expect(heroStats(s)).toMatchObject({
      attack: 1,
      thwart: 2,
      defense: 1,
      recover: 3,
    });
    expect(heroCard(s).traits).toContain("Guardian");
    s = command(s, { type: "FLIP" });
    expect(heroCard(s).code).toBe("16029b");
    expect(heroCard(s).traits).toContain("Genius");
    expect(handSize(s)).toBe(6);
  });

  it("Tinkering commits the selected physical Tech cost before drawing two", () => {
    let s = base("rocket");
    s.player.form = "alter";
    const tech = put(s, "16034"),
      other = put(s, "16039"),
      top = s.player.deck.slice(0, 2);
    s = command(s, { type: "ABILITY", id: "identity", action: "tinkering" });
    expect(s.prompt).toMatchObject({ kind: "select", min: 1, max: 1 });
    s = command(s, { type: "SELECT", ids: [tech.id] });
    expect(s.player.discard.find((p) => p.id === tech.id)).toBeTruthy();
    expect(s.player.inPlay.find((p) => p.id === other.id)).toBeTruthy();
    expect(s.player.hand.map((p) => p.id)).toEqual(top.map((p) => p.id));
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "tinkering",
      }).error,
    ).toBeTruthy();
    conserved(s, [tech, other, ...top]);
  });

  it("Tinkering cannot pay with an ordinary upgrade or fire in hero form", () => {
    let s = base("rocket");
    const tech = put(s, "16034"),
      ordinary = put(s, "16045");
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "tinkering",
      }).error,
    ).toBeTruthy();
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: "identity", action: "tinkering" });
    expect(s.prompt?.options.some((o) => o.id === tech.id)).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === ordinary.id)).toBe(false);
    expect(
      dispatch(reload(s), { type: "SELECT", ids: [ordinary.id] }).error,
    ).toBeTruthy();
  });

  it("the native round boundary refreshes Tinkering without duplicating its discarded Tech", () => {
    let s = base("rocket");
    s.player.form = "alter";
    const a = put(s, "16034"),
      b = put(s, "16039");
    s = command(s, { type: "ABILITY", id: "identity", action: "tinkering" });
    s = command(s, { type: "SELECT", ids: [a.id] });
    s.phase = "villain";
    s = finish(native(s, { type: "newRound" }));
    s = command(s, { type: "ABILITY", id: "identity", action: "tinkering" });
    s = command(s, { type: "SELECT", ids: [b.id] });
    expect(s.player.hand).toHaveLength(4);
    conserved(s, [a, b]);
  });
});

describe("Rocket's physical obligation and nemesis dispatch", () => {
  it("Crisis on Halfworld can remove its actual physical card by an alter-ego exhaust cost", () => {
    let s = base("rocket");
    const obligation = owned(s, "16053");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "flip");
    s = finish(choose(s, "remove"));
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
  });

  it("Crisis on Halfworld chooses among the actual highest printed-cost upgrades", () => {
    let s = base("rocket");
    const cheaper = put(s, "16034"),
      a = put(s, "16036"),
      b = put(s, "16037"),
      obligation = owned(s, "16053");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "stay");
    s = choose(s, "discard");
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    s = finish(choose(s, b.id));
    expect(s.player.inPlay.find((p) => p.id === cheaper.id)).toBeTruthy();
    expect(s.player.inPlay.find((p) => p.id === a.id)).toBeTruthy();
    expect(s.player.discard.find((p) => p.id === b.id)).toBeTruthy();
    expect(
      s.encounter.discard.find((p) => p.id === obligation.id),
    ).toBeTruthy();
    conserved(s, [cheaper, a, b]);
  });

  it("Blackjack's Bazooka attaches to the actual Blackjack before the villain", () => {
    let s = base("rocket");
    const enemy = minion(s, "16055"),
      attachment = owned(s, "16056");
    s = finish(native(s, { type: "reveal", piece: attachment, skip: true }));
    expect(s.attachments.find((p) => p.id === attachment.id)?.attachedTo).toBe(
      enemy.id,
    );
    const fallback = owned(s, "16056");
    s.minions = [];
    s = finish(native(s, { type: "reveal", piece: fallback, skip: true }));
    expect(s.attachments.find((p) => p.id === fallback.id)?.attachedTo).toBe(
      s.villain.id,
    );
  });

  it("Blackjack's Bazooka demands three actual mental resources through a saved native payment", () => {
    let s = base("rocket");
    const attachment = owned(s, "16056");
    attachment.attachedTo = s.villain.id;
    s.attachments.push(attachment);
    const h = hand(s, "16050", "16039", "16049");
    s = command(s, { type: "ABILITY", id: attachment.id });
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 3,
      requirements: ["mental", "mental", "mental"],
    });
    expect(
      dispatch(reload(s), { type: "PAY", ids: [h[0].id, h[2].id] }).error,
    ).toBeTruthy();
    s = finish(command(s, { type: "PAY", ids: [h[0].id, h[1].id] }));
    expect(s.attachments.find((p) => p.id === attachment.id)).toBeUndefined();
    expect(
      s.encounter.discard.filter((p) => p.id === attachment.id),
    ).toHaveLength(1);
  });

  it("Blackjack's villainous activation counts an actual boost plus Vendetta's Amplify", () => {
    let s = base("rocket");
    const enemy = minion(s, "16055");
    side(s, "16054", 2);
    s.encounter.deck.unshift(owned(s, "01107"));
    s = finish(
      choose(native(s, { type: "enemyAttack", id: enemy.id }), "take"),
    );
    expect(s.player.hp).toBe(5); // printed 1 ATK + two boost icons + Amplify.
  });

  it("Planetary Invasion reveals the selected physical minion before giving it Tough", () => {
    let s = base("rocket");
    const found = owned(s, "01103");
    s.encounter.deck.unshift(owned(s, "01104"), found);
    s = native(s, { type: "reveal", piece: owned(s, "16057"), skip: true });
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "text")?.id);
    expect(s.player.hp).toBe(8);
    expect(s.minions.find((p) => p.id === found.id)).toMatchObject({
      tough: true,
      code: "01103",
      engagedWith: "p1",
    });
    expect(s.encounter.deck.some((p) => p.id === found.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === found.id)).toBe(false);
  });
});

describe("Rocket's native Tech, attacks and damage responses", () => {
  it.each([
    ["16034", 2],
    ["16036", 2],
    ["16037", 2],
    ["16038", 3],
  ] as const)(
    "%s enters with its printed charges and preserves its own physical printing",
    (code, counters) => {
      let s = base("rocket");
      const h = hand(s, code, "16049", "16050");
      s = finish(play(s, h[0], [h[1], h[2]]));
      expect(s.player.inPlay.find((p) => p.id === h[0].id)).toMatchObject({
        code,
        counters,
      });
      conserved(s, h);
    },
  );

  it("Cybernetic Skeleton raises current and maximum HP, with hero-only attack", () => {
    let s = base("rocket");
    s.player.hp = 7;
    const h = hand(s, "16035", "16049");
    s = finish(play(s, h[0], [h[1]]));
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(10);
    expect(heroStats(s).attack).toBe(2);
    s = command(s, { type: "FLIP" });
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(10);
    expect(heroStats(s).attack).toBe(1);
  });

  it("Thruster Boots boosts hero thwart and the Aerial trait, not alter-ego", () => {
    let s = base("rocket");
    const h = hand(s, "16039", "16049");
    s = finish(play(s, h[0], [h[1]]));
    expect(heroStats(s).thwart).toBe(3);
    expect(aerial(s)).toBe(true);
    s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(3);
    s = command(s, { type: "FLIP" });
    expect(heroStats(s).thwart).toBe(2);
    expect(aerial(s)).toBe(false);
  });

  it("Battery Pack transfers a charge to a different physical Tech in either form", () => {
    let s = base("rocket");
    s.player.form = "alter";
    const battery = put(s, "16034"),
      gun = put(s, "16038");
    put(s, "16035");
    battery.counters = 2;
    gun.counters = 0;
    s = command(s, { type: "ABILITY", id: battery.id, action: "battery" });
    expect(s.prompt?.options.some((o) => o.id === battery.id)).toBe(false);
    s = choose(s, gun.id);
    expect(s.player.inPlay.find((p) => p.id === battery.id)).toMatchObject({
      counters: 1,
      exhausted: true,
    });
    expect(s.player.inPlay.find((p) => p.id === gun.id)?.counters).toBe(1);
  });

  it("Reload readies all actual Tech but leaves non-Tech exhausted", () => {
    let s = base("rocket");
    const a = put(s, "16034"),
      b = put(s, "16036"),
      c = put(s, "16045");
    a.exhausted = b.exhausted = c.exhausted = true;
    a.counters = 0;
    b.counters = 2;
    s = finish(paidPlay(s, "16031", "16049"));
    expect(s.player.inPlay.find((p) => p.id === a.id)?.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === b.id)?.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === c.id)?.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === b.id)?.counters).toBe(2);
  });

  it("a Pistol attack uses its exact source and remains in play with zero charges", () => {
    let s = base("rocket");
    const gun = put(s, "16038");
    gun.counters = 1;
    s = target(
      command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
      s.villain.id,
    );
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(s.player.inPlay.find((p) => p.id === gun.id)).toMatchObject({
      counters: 0,
      exhausted: true,
    });
    s.player.inPlay.find((p) => p.id === gun.id)!.exhausted = false;
    expect(
      dispatch(reload(s), { type: "ABILITY", id: gun.id, action: "weapon" })
        .error,
    ).toBeTruthy();
    conserved(s, [gun]);
  });

  it("Stunned replaces a Pistol attack after committing exhaust and charge costs", () => {
    let s = base("rocket");
    const gun = put(s, "16038");
    gun.counters = 2;
    s.player.stunned = true;
    s = finish(command(s, { type: "ABILITY", id: gun.id, action: "weapon" }));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === gun.id)).toMatchObject({
      counters: 1,
      exhausted: true,
    });
  });

  it("Particle Cannon is Ranged, so a surviving retaliate minion deals no retaliation", () => {
    let s = base("rocket");
    const gun = put(s, "16036"),
      enemy = minion(s, "01184");
    gun.counters = 2;
    s = target(
      command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
      enemy.id,
    );
    s = finish(s);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(4);
    expect(s.player.hp).toBe(9);
  });

  it("actual excess damage offers one optional Murdered You draw after defeat", () => {
    let s = base("rocket");
    const gun = put(s, "16036"),
      enemy = minion(s);
    gun.counters = 2;
    const top = s.player.deck[0];
    s = target(
      command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
      enemy.id,
    );
    s = respond(s, /Murdered You|draw 1 card/i);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === top.id)).toBe(true);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.villain.hp).toBe(49);
  });

  it("exact lethal damage and Tough prevention each produce no excess response", () => {
    let s = base("rocket");
    const gun = put(s, "16038"),
      enemy = minion(s);
    gun.counters = 2;
    enemy.damage = 1;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
        enemy.id,
      ),
    );
    expect(s.player.hand).toHaveLength(0);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    s.player.inPlay.find((p) => p.id === gun.id)!.exhausted = false;
    const tough = minion(s);
    tough.tough = true;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: gun.id, action: "weapon" }),
        tough.id,
      ),
    );
    expect(s.player.hand).toHaveLength(0);
    expect(s.minions.find((p) => p.id === tough.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
  });

  it("Rocket Launcher bypasses Guard and Stunned and affects only the chosen seat's minions", () => {
    let s = base("rocket", "groot");
    const launcher = put(s, "16037");
    launcher.counters = 2;
    const own = minion(s, "01101"),
      other = minion(s, "01103", "p2"),
      retaliate = minion(s, "01184", "p2");
    s.player.stunned = true;
    s = command(s, { type: "ABILITY", id: launcher.id, action: "launcher" });
    s = choose(s, "p2");
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBe(9);
    expect(s.minions.find((p) => p.id === own.id)?.damage).toBe(0);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === retaliate.id)?.damage).toBe(2);
  });

  it("Rocket Launcher's one simultaneous nonattack effect offers one excess draw for each damaged minion", () => {
    let s = base("rocket");
    const launcher = put(s, "16037"),
      a = minion(s),
      b = minion(s);
    launcher.counters = 1;
    a.damage = b.damage = 2;
    s = command(s, { type: "ABILITY", id: launcher.id, action: "launcher" });
    s = respond(s, /Murdered You|draw 1 card/i);
    s = respond(s, /Murdered You|draw 1 card/i);
    s = finish(s);
    expect(s.player.hand).toHaveLength(2);
    expect(s.minions).toHaveLength(0);
    expect(s.villain.hp).toBe(48);
    expect(s.player.inPlay.find((p) => p.id === launcher.id)?.counters).toBe(0);
  });

  it("Schadenfreude heals per enemy dealt damage by one Launcher activation, including Tough", () => {
    let s = base("rocket");
    s.player.hp = 1;
    const launcher = put(s, "16037");
    launcher.counters = 2;
    const a = minion(s),
      b = minion(s),
      tough = minion(s);
    tough.tough = true;
    s = finish(paidPlay(s, "16032", "16049"));
    s = command(s, { type: "ABILITY", id: launcher.id, action: "launcher" });
    s = finish(target(s, "p1"));
    expect(s.player.hp).toBe(9); // Four enemies were dealt damage; Tough changes damage taken (RRG1.8 p35).
    expect(s.minions.find((p) => p.id === a.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === b.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === tough.id)?.damage).toBe(0);
  });

  it("I've Got a Plan is paid only after an actual basic thwart and stacks phase THW", () => {
    let s = base("rocket");
    const h = hand(s, "16030", "16049");
    expect(playable(s, h[0])).toBeTruthy();
    s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
    s = respond(s, /I've Got a Plan|I’ve Got a Plan/i, "16030");
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(heroStats(s).thwart).toBe(3);
    s.scheme.threat = 8;
    const second = hand(s, "16030", "16050");
    s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
    s = respond(s, /I've Got a Plan|I’ve Got a Plan/i, "16030");
    s = finish(command(s, { type: "PAY", ids: [second[1].id] }));
    expect(s.scheme.threat).toBe(5);
    expect(heroStats(s).thwart).toBe(4);
  });

  it("Confused consumes a basic thwart without opening I've Got a Plan", () => {
    let s = base("rocket");
    hand(s, "16030", "16049");
    s.player.confused = true;
    s = finish(command(s, { type: "BASIC", action: "thwart" }));
    expect(s.player.confused).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.scheme.threat).toBe(6);
    expect(s.player.hand).toHaveLength(2);
  });

  it("Salvage responds to the actual spent resource and moves one exact Tech before card text", () => {
    let s = base("rocket");
    const tech = owned(s, "16038"),
      ordinary = owned(s, "16045");
    s.player.discard.push(tech, ordinary);
    const h = hand(s, "16035", "16033");
    s = play(s, h[0], [h[1]]);
    s = respond(s, /Salvage/i, "16033");
    expect(s.prompt?.options.some((o) => o.id === ordinary.id)).toBe(false);
    s = choose(s, tech.id);
    s = finish(s);
    expect(s.player.deck[0].id).toBe(tech.id);
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.code).toBe("16035");
    expect(s.player.discard.find((p) => p.id === h[1].id)?.code).toBe("16033");
    conserved(s, [tech, ordinary, ...h]);
  });

  it("Salvage has no spend response when merely discarded by an effect", () => {
    let s = base("rocket");
    const tech = owned(s, "16038"),
      salvage = owned(s, "16033");
    s.player.discard.push(tech);
    s.player.hand.push(salvage);
    s = finish(native(s, { type: "discardPiece", id: salvage.id }));
    expect(s.player.deck[0].id).not.toBe(tech.id);
    conserved(s, [tech, salvage]);
  });
});
