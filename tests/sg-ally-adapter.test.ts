import { describe, expect, it } from "vitest";
import { abilityOptions, allyLimit, makePiece } from "../src/game/engine.js";
import { pieceHP } from "../src/game/cards.js";
import { seatView } from "../src/game/team.js";
import {
  base,
  choose,
  command,
  finish,
  hand,
  minion,
  native,
  owned,
  put,
  respond,
  target,
} from "./sg-test-helpers.js";

describe("Star-Lord and Gamora native ally and attack adapters", () => {
  it("adds Knowhere's ally limit and Comms Implant's actual ally hit point", () => {
    const s = base("stld");
    put(s, "17022");
    const ally = put(s, "17013");
    const comms = put(s, "18030");
    comms.attachedTo = ally.id;
    expect(allyLimit(s)).toBe(4);
    expect(pieceHP(s, ally)).toBe(3);
  });
  it("uses Leader, Blaze, and Comms modifiers on a dynamically granted Guardian ally", () => {
    let s = base("stld");
    put(s, "17009");
    const ally = put(s, "01067");
    const comms = put(s, "18030");
    comms.attachedTo = ally.id;
    s.flags.starPackBlazePhase = "player";
    s.scheme.threat = 10;
    s = command(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(4);
  });
  it("keeps Yondu's ranged attack separate from Laser Blaster's Overkill", () => {
    let s = base("stld");
    const ally = put(s, "17013");
    const laser = put(s, "17019");
    laser.attachedTo = ally.id;
    const enemy = minion(s, "01172", undefined, 3);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(target(s, enemy.id));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.villain.hp).toBe(49);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
  });
  it("offers and stacks physical Target Practice supports before an ally's declared attack", () => {
    let s = base("stld");
    const ally = put(s, "17013");
    const laser = put(s, "17019");
    laser.attachedTo = ally.id;
    const first = put(s, "17017"),
      second = put(s, "17017");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, s.villain.id);
    s = respond(s, /Target Practice/);
    s = respond(s, /Target Practice/);
    s = finish(s);
    expect(s.villain.hp).toBe(44);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );
  });
  it("does not offer ally interrupts or consequential damage when Stun replaces the use", () => {
    let s = base("stld");
    const ally = put(s, "17020");
    ally.stunned = true;
    const laser = put(s, "17019");
    laser.attachedTo = ally.id;
    const practice = put(s, "17017");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      stunned: false,
      damage: 0,
    });
    expect(s.player.inPlay.some((p) => p.id === practice.id)).toBe(true);
  });
  it("saves Cosmo's named type and chosen physical player deck before replacing consequential damage", () => {
    let s = base("stld");
    const ally = put(s, "17020");
    const top = s.player.deck[0];
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, s.villain.id);
    s = respond(s, /Cosmo/);
    s = choose(s, "resource");
    s = choose(s, s.activePlayerId);
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    expect(s.player.discard.some((p) => p.id === top.id)).toBe(true);
  });
  it("offers Beta Ray Bill only after the attacked physical minion is actually defeated", () => {
    let s = base("stld");
    const ally = put(s, "17012");
    const enemy = minion(s, "01101");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, enemy.id);
    s = respond(s, /Beta Ray Bill/);
    s = finish(s);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("does not trigger Beta Ray Bill when Biomechanical Upgrades saves the minion", () => {
    let s = base("stld");
    const ally = put(s, "17012");
    const enemy = minion(s, "01101");
    const bio = makePiece(s, "01185");
    bio.attachedTo = enemy.id;
    s.attachments.push(bio);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(target(s, enemy.id));
    expect(s.scheme.threat).toBe(6);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
  });
  it("resolves Adam Warlock's optional random discard and printed mental resource before consequential damage", () => {
    let s = base("stld");
    const ally = put(s, "17011");
    const [resource] = hand(s, "18022");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, s.villain.id);
    s = respond(s, /Adam Warlock/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(s.player.discard.some((p) => p.id === resource.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("offers Godslayer after a unique enemy is selected and consumes its physical exhaust", () => {
    let s = base("gam");
    const upgrade = put(s, "18018");
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    s = respond(s, /Godslayer/);
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.exhausted).toBe(
      true,
    );
  });
  it("does not exhaust Godslayer when Stun replaces a basic attack", () => {
    let s = base("gam");
    const upgrade = put(s, "18018");
    s.player.stunned = true;
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.exhausted).toBe(
      false,
    );
  });
  it("does not offer Godslayer against a non-unique minion", () => {
    let s = base("gam");
    const upgrade = put(s, "18018");
    const enemy = minion(s, "01110");
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(target(s, enemy.id));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.exhausted).toBe(
      false,
    );
  });
  it("blocks Drax's attack while Guard leaves him without a legal villain target", () => {
    const s = base("gam");
    const ally = put(s, "18019");
    minion(s, "01101");
    expect(
      abilityOptions(s, ally).find((o) => o.id === "attack")?.disabled,
    ).toBe("No legal enemy to attack.");
    expect(ally.exhausted).toBe(false);
  });
  it("lets Stun replace Drax's attempted attack even while Guard blocks the villain", () => {
    let s = base("gam");
    const ally = put(s, "18019");
    ally.stunned = true;
    minion(s, "01101");
    expect(
      abilityOptions(s, ally).find((o) => o.id === "attack")?.disabled,
    ).toBeUndefined();
    s = finish(command(s, { type: "ABILITY", id: ally.id, action: "attack" }));
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      stunned: false,
      exhausted: true,
      damage: 0,
    });
    expect(s.villain.hp).toBe(50);
  });
  it("offers First Hit for an ordinary minion's actual attack initiation", () => {
    let s = base("gam");
    const [event, resource] = hand(s, "18015", "18021");
    const enemy = minion(s, "01110");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = respond(s, /First Hit/);
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(s);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("lets another live hero play First Hit against the initiating minion with that player's resources", () => {
    let s = base("gam", "stld");
    const teammate = s.players[1];
    const event = owned(s, "18015", teammate.id),
      resource = owned(s, "18021", teammate.id);
    seatView(s, teammate).player.hand.push(event, resource);
    const enemy = minion(s, "01110");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = respond(s, /First Hit/);
    expect(s.activePlayerId).toBe(teammate.id);
    if (s.prompt?.title === '"What could go wrong?"') s = choose(s, "continue");
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(s);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(
      seatView(s, teammate.id).player.discard.some((p) => p.id === event.id),
    ).toBe(true);
  });
  it("uses First Hit during Quickstrike after minion entry bookkeeping", () => {
    let s = base("gam");
    const [event, resource] = hand(s, "18015", "18021");
    const enemy = minion(s, "01167");
    s = native(s, { type: "minionEntered", id: enemy.id });
    s = respond(s, /First Hit/);
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "take")?.id);
    expect(s.minions.find((p) => p.id === enemy.id)).toMatchObject({
      engagedWith: s.players[0].id,
      damage: 2,
    });
    expect(s.player.hp).toBe(7);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("does not offer First Hit when Stun replaces the minion's attempted attack", () => {
    let s = base("gam");
    const [event] = hand(s, "18015", "18021");
    const enemy = minion(s, "01110");
    enemy.stunned = true;
    s = finish(native(s, { type: "enemyAttack", id: enemy.id }));
    expect(s.minions.find((p) => p.id === enemy.id)?.stunned).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
  });
});
