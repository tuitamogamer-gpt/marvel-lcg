import { describe, expect, it } from "vitest";
import { makePiece } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import {
  base,
  choose,
  command,
  finish,
  hand,
  minion,
  native,
  put,
  respond,
  side,
  target,
} from "./sg-test-helpers.js";

function hero(id = "gam") {
  const s = base("gam");
  s.heroId = id;
  s.players[0].heroId = id;
  return s;
}

describe("Drax and Venom native basic/ally adapters", () => {
  for (const [code, boost] of [
    ["19025", 2],
    ["19026", 2],
    ["19027", 3],
    ["19028", 1],
    ["19029", 2],
  ] as const) {
    it(`uses the verified printed boost on ${code} for Leading Blow`, () => {
      let s = hero();
      put(s, "16046").counters = 3;
      const [event] = hand(s, "19017");
      const top = makePiece(s, code);
      s.encounter.deck.unshift(top);
      s = command(s, { type: "BASIC", action: "attack" });
      s = respond(s, /Hand Cannon/);
      s = respond(s, /Leading Blow/);
      s = finish(target(s, s.villain.id));
      expect(s.villain.hp).toBe(50 - (4 - boost));
      expect(s.player.exhausted).toBe(false);
      expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
      expect(s.encounter.discard.some((p) => p.id === top.id)).toBe(true);
    });
  }
  it("readies after Leading Blow deals positive damage prevented by Tough", () => {
    let s = hero();
    s.villain.tough = true;
    hand(s, "19017");
    s.encounter.deck.unshift(makePiece(s, "19028"));
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Leading Blow/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(50);
    expect(s.villain.tough).toBe(false);
    expect(s.player.exhausted).toBe(false);
  });
  it("does not ready after Leading Blow reduces actual basic ATK to zero", () => {
    let s = hero();
    hand(s, "19017");
    s.encounter.deck.unshift(makePiece(s, "19025"));
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Leading Blow/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(50);
    expect(s.player.exhausted).toBe(true);
  });
  it("preserves a negative Leading Blow modifier before a later Godslayer boost", () => {
    let s = hero();
    put(s, "18018");
    hand(s, "19017");
    s.encounter.deck.unshift(makePiece(s, "19027"));
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Leading Blow/);
    s = target(s, s.villain.id);
    s = respond(s, /Godslayer/);
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.player.exhausted).toBe(false);
  });
  it("grants Venom's general Restricted slot in both identity forms", () => {
    for (const form of ["hero", "alter"] as const) {
      let s = hero("vnm");
      s.player.form = form;
      put(s, "17007");
      put(s, "19008");
      put(s, "19009");
      s = native(s, { type: "restrictedLimit" });
      expect(s.prompt).toBeNull();
      expect(s.player.inPlay).toHaveLength(3);
    }
  });
  it("allocates Side Holster's extra slot only to Restricted Weapons", () => {
    let s = hero();
    put(s, "20021");
    put(s, "03009");
    put(s, "19008");
    put(s, "19009");
    s = native(s, { type: "restrictedLimit" });
    expect(s.prompt).toBeNull();
    const extra = put(s, "17007");
    s = native(s, { type: "restrictedLimit" });
    expect(s.prompt?.title).toBe("Restricted limit");
    s = choose(s, extra.id);
    expect(s.prompt).toBeNull();
    expect(s.player.inPlay.filter((p) => p.code !== "20021")).toHaveLength(3);
  });
  it("rechecks the Weapon allowance when Side Holster leaves play", () => {
    let s = hero();
    const holster = put(s, "20021");
    put(s, "17007");
    put(s, "19008");
    put(s, "19009");
    s = native(s, { type: "restrictedLimit" });
    expect(s.prompt).toBeNull();
    s = native(s, { type: "discardPiece", id: holster.id });
    expect(s.prompt?.title).toBe("Restricted limit");
  });
  it("uses Star-Lord ally's ranged attack to suppress Retaliate", () => {
    let s = hero();
    const ally = put(s, "20016");
    const enemy = minion(s, "01172");
    const hp = s.player.hp;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(target(s, enemy.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    expect(s.player.hp).toBe(hp);
  });
  it("adds Jack Flag's optional ammo only after an actual basic thwart", () => {
    let s = hero();
    const ally = put(s, "20011");
    s = command(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    s = target(s, "main");
    s = respond(s, /Jack Flag/);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      counters: 1,
      damage: 1,
    });
    expect(s.scheme.threat).toBe(4);
  });
  it("gives Martyr Tough after a defeated enemy and positive consequential damage", () => {
    let s = hero();
    const ally = put(s, "19012");
    const enemy = minion(s, "01110");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, enemy.id);
    s = respond(s, /Martyr/);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
      tough: true,
    });
  });
  it("counts the defeated villain stage before its physical code advances", () => {
    let s = hero();
    const ally = put(s, "19012");
    s.villain.hp = 2;
    const stage = s.villain.stage;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, s.villain.id);
    s = respond(s, /Martyr/);
    s = finish(s);
    expect(s.villain.stage).toBe(stage + 1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
      tough: true,
    });
  });
  it("does not offer Martyr when Tough prevents consequential damage", () => {
    let s = hero();
    const ally = put(s, "19012");
    ally.tough = true;
    const enemy = minion(s, "01110");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(target(s, enemy.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
  });
  it("does not offer Martyr when the minion survives via Biomechanical Upgrades", () => {
    let s = hero();
    const ally = put(s, "19012"),
      enemy = minion(s, "01110");
    const upgrade = makePiece(s, "01185");
    upgrade.attachedTo = enemy.id;
    s.attachments.push(upgrade);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(target(s, enemy.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
      tough: false,
    });
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
  });
  it("returns the declared ally defender through Regroup after real defeat and preserves Overkill", () => {
    let s = hero();
    const support = put(s, "19032"),
      ally = put(s, "20011");
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      defender: ally.id,
      base: 5,
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: true,
      boostCodes: [],
      boostEffects: [],
    };
    const hp = s.player.hp;
    s = native(s, { type: "finishAttack" });
    expect(s.player.hp).toBe(hp - 2);
    s = respond(s, /Regroup/);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === support.id)).toBe(true);
  });
  it("does not offer Regroup for lethal consequential damage", () => {
    let s = hero();
    put(s, "19032");
    const ally = put(s, "20011");
    ally.damage = 2;
    s = finish(native(s, { type: "allyConsequence", id: ally.id, amount: 1 }));
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(false);
  });
  it("does not treat damage from an enemy's card ability as an enemy attack", () => {
    let s = hero();
    put(s, "19032");
    const ally = put(s, "20011");
    s = finish(
      native(s, {
        type: "damage",
        target: ally.id,
        amount: 3,
        source: s.villain.id,
      }),
    );
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(false);
  });
  it("does not trigger Rapid Response after Regroup places the defeated ally in its owner's hand", () => {
    let s = hero();
    const regroup = put(s, "19032"),
      rapid = put(s, "08031"),
      ally = put(s, "20011");
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      defender: ally.id,
      base: 4,
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      boostCodes: [],
      boostEffects: [],
    };
    s = native(s, { type: "finishAttack" });
    s = respond(s, /Regroup/);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.inPlay.map((p) => p.id)).toEqual(
      expect.arrayContaining([regroup.id, rapid.id]),
    );
  });
  it("returns a transferred ally to its physical owner while retaining the attacked player's context", () => {
    let s = base("gam", "stld");
    put(s, "19032", "p1");
    const ally = put(s, "20011", "p1");
    seatView(s, "p1").player.inPlay = seatView(s, "p1").player.inPlay.filter(
      (p) => p.id !== ally.id,
    );
    seatView(s, "p2").player.inPlay.push(ally);
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      defender: ally.id,
      base: 5,
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: true,
      boostCodes: [],
      boostEffects: [],
    };
    const hp = seatView(s, "p2").player.hp;
    s = native(s, { type: "finishAttack", actorId: "p2" });
    s = respond(s, /Regroup/);
    s = finish(s);
    expect(seatView(s, "p1").player.hand.some((p) => p.id === ally.id)).toBe(
      true,
    );
    expect(seatView(s, "p2").player.hand.some((p) => p.id === ally.id)).toBe(
      false,
    );
    expect(seatView(s, "p2").player.hp).toBe(hp - 2);
  });
  it("uses Drax's verified printed boost when Wiccan discards that actual encounter card", () => {
    let s = hero("scw");
    const ally = put(s, "15011");
    const top = makePiece(s, "19027");
    s.encounter.deck.unshift(top);
    s = command(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    s = target(s, "main");
    s = respond(s, /Wiccan/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(47);
    expect(s.encounter.discard.some((p) => p.id === top.id)).toBe(true);
  });
  it("uses the same scan-verified boost for Captain America's Hit Squad discard", () => {
    let s = hero("captain_america");
    const hp = s.player.hp,
      top = makePiece(s, "19027");
    s.encounter.deck.unshift(top);
    s = finish(native(s, { type: "cap:hit-squad" }));
    expect(s.player.hp).toBe(hp - 3);
    expect(s.encounter.discard.some((p) => p.id === top.id)).toBe(true);
  });
  it("heals only after Making an Entrance actually clears the selected scheme", () => {
    let s = hero();
    s.player.hp = 5;
    s.scheme.threat = 4;
    const [event, resource] = hand(s, "20013", "01088");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = respond(s, /Making an Entrance/);
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(0);
    expect(s.player.hp).toBe(7);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("does not heal if the bonus thwart leaves threat or Confused replaces the thwart", () => {
    let s = hero();
    s.player.hp = 5;
    s.scheme.threat = 5;
    const [, resource] = hand(s, "20013", "01088");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = respond(s, /Making an Entrance/);
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(target(s, "main"));
    expect(s.player.hp).toBe(5);
    expect(s.scheme.threat).toBe(1);
    s.player.exhausted = false;
    s.player.confused = true;
    hand(s, "20013", "01088");
    s = finish(command(s, { type: "BASIC", action: "thwart" }));
    expect(s.player.hand.some((p) => p.code === "20013")).toBe(true);
    expect(s.player.hp).toBe(5);
  });
  it("remembers a single heal after Giant Wasp divides her bonus thwart", () => {
    let s = hero("wsp");
    s.player.heroForm = "giant";
    s.player.hp = 5;
    s.scheme.threat = 8;
    const scheme = side(s, "01107", 1);
    const [, resource] = hand(s, "20013", "01088");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = respond(s, /Making an Entrance/);
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = choose(s, `${scheme.id}:1`);
    s = finish(s);
    expect(s.player.hp).toBe(7);
    expect(s.scheme.threat).toBe(5);
    expect(s.sideSchemes).toHaveLength(0);
  });
  it("readies once after Leading Blow modifies Giant Wasp's whole simultaneous attack", () => {
    let s = hero("wsp");
    s.player.heroForm = "giant";
    put(s, "16046").counters = 3;
    hand(s, "19017");
    s.encounter.deck.unshift(makePiece(s, "19028"));
    const first = minion(s, "01110"),
      second = minion(s, "01103");
    s = command(s, { type: "BASIC", action: "attack" });
    s = respond(s, /Hand Cannon/);
    s = respond(s, /Leading Blow/);
    s = choose(s, `${first.id}:1`);
    s = finish(choose(s, `${second.id}:2`));
    expect(s.minions.find((p) => p.id === first.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === second.id)?.damage).toBe(2);
    expect(s.player.exhausted).toBe(false);
  });
  it("offers Shake it Off after surviving attack damage taken by a Guardian identity", () => {
    let s = hero();
    const [, resource] = hand(s, "20028", "01088");
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      defender: "none",
      base: 2,
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      boostCodes: [],
      boostEffects: [],
    };
    const hp = s.player.hp;
    s = native(s, { type: "finishAttack" });
    s = respond(s, /Shake it Off/);
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.tough).toBe(true);
  });
  it("allows another Hero player to play Shake it Off for the actual damaged Guardian", () => {
    let s = base("gam", "stld");
    const [, resource] = hand(s, "20028", "01088");
    const hp = seatView(s, "p2").player.hp;
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      defender: "none",
      base: 2,
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      boostCodes: [],
      boostEffects: [],
    };
    s = native(s, { type: "finishAttack", actorId: "p2" });
    s = respond(s, /Shake it Off/);
    expect(s.activePlayerId).toBe("p1");
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(s);
    expect(seatView(s, "p2").player).toMatchObject({ hp: hp - 2, tough: true });
    expect(seatView(s, "p1").player.tough).toBe(false);
  });
  it("does not offer Shake it Off for attack damage fully prevented by Tough", () => {
    let s = hero();
    s.player.tough = true;
    const [event] = hand(s, "20028", "01088");
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      defender: "none",
      base: 2,
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      boostCodes: [],
      boostEffects: [],
    };
    const hp = s.player.hp;
    s = finish(native(s, { type: "finishAttack" }));
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
  });
  it("offers Shake it Off for Overkill damage to the surviving Guardian after its ally is defeated", () => {
    let s = hero();
    const ally = put(s, "20011");
    const [, resource] = hand(s, "20028", "01088");
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      defender: ally.id,
      base: 5,
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: true,
      boostCodes: [],
      boostEffects: [],
    };
    const hp = s.player.hp;
    s = native(s, { type: "finishAttack" });
    s = respond(s, /Shake it Off/);
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.tough).toBe(true);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
  });
  it("responds to actual direct attack damage on a surviving Guardian ally", () => {
    let s = hero();
    const ally = put(s, "20011"),
      enemy = minion(s, "01110");
    const [, resource] = hand(s, "20028", "01088");
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 1,
      source: enemy.id,
      attack: true,
      attackInitiated: true,
    });
    s = respond(s, /Shake it Off/);
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
      tough: true,
    });
  });
});
