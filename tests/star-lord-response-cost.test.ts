import { describe, expect, it } from "vitest";
import { handSize } from "../src/game/cards.js";
import { seatView } from "../src/game/team.js";
import {
  base,
  choose,
  command,
  conserved,
  facedown,
  finish,
  hand,
  minion,
  native,
  owned,
  put,
  respond,
  target,
} from "./sg-test-helpers.js";

describe("Star-Lord's native hand-play interrupts and changing refill limit", () => {
  it("plays First Hit without ordinary resources, paying a real encounter cost before defeating the initiating minion", () => {
    let s = base("stld");
    s.aspect = s.players[0].aspect = "protection";
    const enemy = minion(s, "01103", "p1", 1),
      event = hand(s, "18015")[0],
      encounter = s.encounter.deck[0];
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = respond(s, /First Hit/i, "18015");
    expect(s.prompt?.title).toContain("What could go wrong");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["starlord-discount"]);
    s = finish(respond(s, /What could go wrong/i));
    expect(s.encounter.dealt.map((p) => p.id)).toEqual([encounter.id]);
    expect(s.encounter.dealt[0].dealtTo).toBe("p1");
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.attack).toBeNull();
    expect(s.flags.starlordCostRound).toBe(s.round);
    expect(s.flags.starlordDiscountCardId).toBeUndefined();
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    conserved(s, [event]);
  });

  it("declining the reaction's cost interrupt pays exactly its ordinary cost and never reopens the interrupt", () => {
    let s = base("stld");
    s.aspect = s.players[0].aspect = "protection";
    const enemy = minion(s, "01103", "p1", 1),
      [event, resource] = hand(s, "18015", "18003");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = respond(s, /First Hit/i, "18015");
    s = choose(s, "continue");
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(1);
    expect(s.prompt?.card?.id).toBe(event.id);
    s = finish(command(s, { type: "PAY", ids: [resource.id] }));
    expect(s.encounter.dealt).toEqual([]);
    expect(s.flags.starlordCostRound).toBeUndefined();
    expect(s.flags.starlordDiscountCardId).toBeUndefined();
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    conserved(s, [event, resource]);
  });

  it("a Stunned First Hit still deals its cost encounter and plays the physical event before the surviving minion attacks", () => {
    let s = base("stld");
    s.aspect = s.players[0].aspect = "protection";
    const enemy = minion(s, "01103", "p1", 1),
      event = hand(s, "18015")[0];
    s.player.stunned = true;
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = respond(s, /First Hit/i, "18015");
    s = respond(s, /What could go wrong/i);
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => ["take", "resolve"].includes(o.id))?.id,
    );
    expect(s.player.stunned).toBe(false);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(s.player.hp).toBe(8);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    conserved(s, [event]);
  });

  it("an already used identity interrupt never offers an unaffordable second reaction", () => {
    let s = base("stld");
    s.aspect = s.players[0].aspect = "protection";
    const enemy = minion(s, "01103"),
      event = hand(s, "18015")[0];
    s.flags.starlordCostRound = s.round;
    s = native(s, { type: "enemyAttack", id: enemy.id });
    expect(
      s.prompt?.options.some((o) => /First Hit/i.test(o.label)),
    ).toBeFalsy();
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => ["take", "resolve"].includes(o.id))?.id,
    );
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.encounter.dealt).toEqual([]);
    expect(s.player.hp).toBe(8);
  });

  it("the Core Get Behind Me hand interrupt is affordable through Star-Lord even with no resource card", () => {
    let s = base("stld");
    s.aspect = s.players[0].aspect = "protection";
    const event = hand(s, "01078")[0],
      treachery = owned(s, "17027"),
      encounter = s.encounter.deck[0];
    s.scheme.threat = 0;
    s.phase = "villain";
    s = native(s, {
      type: "reveal",
      piece: treachery,
      fromEncounterDeck: true,
    });
    s = respond(s, /Get Behind Me/i, "01078");
    s = respond(s, /What could go wrong/i);
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => ["take", "resolve"].includes(o.id))?.id,
    );
    expect(s.encounter.dealt.map((p) => p.id)).toEqual([encounter.id]);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === treachery.id)).toBe(true);
    expect(s.scheme.threat).toBe(0);
    expect(s.flags.starlordDiscountCardId).toBeUndefined();
    conserved(s, [event]);
  });

  it("Element Gun's ability spends Power in All of Us as one wild resource with no card payment target", () => {
    let s = base("stld");
    const gun = put(s, "17007"),
      resource = hand(s, "13024")[0];
    s = command(s, { type: "ABILITY", id: gun.id, action: "element-gun" });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(1);
    expect(s.prompt?.paymentTarget).toBeUndefined();
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(47);
    expect(
      s.log.some((line) =>
        line.text.startsWith("Paid 1 resource for Element Gun:"),
      ),
    ).toBe(true);
    expect(
      s.log.some((line) =>
        line.text.startsWith("Paid 2 resources for Element Gun:"),
      ),
    ).toBe(false);
    expect(s.encounter.dealt).toEqual([]);
    conserved(s, [gun, resource]);
  });

  it("drawing up to Helmet's hand size continues after the player deck empties and its own new encounter raises the limit", () => {
    let s = base("stld");
    const helmet = put(s, "17010"),
      top = owned(s, "17003"),
      encounter = s.encounter.deck[0];
    s.player.hand = [];
    s.player.deck = [top];
    s.player.discard = Array.from({ length: 8 }, () => owned(s, "18003"));
    const cards = [top, ...s.player.discard];
    expect(handSize(s)).toBe(5);
    s = finish(native(s, { type: "refill" }));
    expect(s.encounter.dealt.map((p) => p.id)).toEqual([encounter.id]);
    expect(handSize(s)).toBe(6);
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.hand.some((p) => p.id === top.id)).toBe(true);
    expect(s.player.deck).toHaveLength(3);
    conserved(s, [helmet, ...cards]);
  });

  it("another player's deck exhaustion adds its own encounter without increasing Star-Lord's refill limit", () => {
    let s = base("stld", "spider_man");
    put(s, "17010");
    const other = seatView(s, "p2"),
      top = owned(s, "18003", "p2");
    other.player.hand = [];
    other.player.deck = [top];
    other.player.discard = Array.from({ length: 8 }, () =>
      owned(s, "18003", "p2"),
    );
    s = finish(native(s, { type: "refill", actorId: "p2" }));
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.encounter.dealt[0].dealtTo).toBe("p2");
    expect(handSize(seatView(s, "p1"))).toBe(5);
    expect(seatView(s, "p2").player.hand).toHaveLength(5);
  });

  it("Helmet's three-card cap does not grow again when the fourth encounter is dealt while refilling", () => {
    let s = base("stld");
    put(s, "17010");
    facedown(s, 3);
    s.player.hand = [];
    s.player.deck = [owned(s, "17003")];
    s.player.discard = Array.from({ length: 10 }, () => owned(s, "18003"));
    s = finish(native(s, { type: "refill" }));
    expect(s.encounter.dealt).toHaveLength(4);
    expect(handSize(s)).toBe(8);
    expect(s.player.hand).toHaveLength(8);
  });
});
