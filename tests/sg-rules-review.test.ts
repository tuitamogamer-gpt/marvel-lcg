/** Independent integration review against RRG 1.8, especially canceled events. */
import { describe, expect, it } from "vitest";
import { heroStats } from "../src/game/cards.js";
import { deckErrors, deckOptions } from "../src/game/decks.js";
import { dispatch, newGame, playable } from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
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
  paidPlay,
  play,
  put,
  reload,
  respond,
  side,
  target,
} from "./sg-test-helpers.js";

describe("Gamora's six-event deck exception in native deck validation", () => {
  it("accepts her exact source with three Protection and three Justice attack/thwart events", () => {
    const codes = heroStarterCodes("gam");
    expect(deckErrors("gam", "aggression", codes)).toEqual([]);
    expect(() =>
      newGame({
        heroId: "gam",
        aspect: "aggression",
        villainId: "rhino",
        heroes: [{ heroId: "gam", aspect: "aggression", deckCards: codes }],
      }),
    ).not.toThrow();
  });
  it("rejects a seventh off-aspect event even when it has a printed Attack trait", () => {
    const codes = heroStarterCodes("gam");
    codes[codes.indexOf("18013")] = "18029";
    expect(deckErrors("gam", "aggression", codes).join(" ")).toMatch(/6|six/i);
  });
  it("does not grant off-aspect upgrades, allies, or events lacking Attack/Thwart traits", () => {
    const allowed = new Set(
      deckOptions("gam", "aggression").map((p) => p.code),
    );
    expect(allowed.has("18015")).toBe(true);
    expect(allowed.has("18016")).toBe(true);
    expect(allowed.has("18029")).toBe(true);
    expect(allowed.has("18030")).toBe(false);
    expect(allowed.has("17013")).toBe(false);
    expect(allowed.has("17015")).toBe(false);
  });
  it("keeps printed card-title copy limits across her source and Core printings", () => {
    const codes = heroStarterCodes("gam");
    codes[codes.indexOf("18013")] = "01054";
    expect(deckErrors("gam", "aggression", codes)).toEqual([]);
    codes[codes.lastIndexOf("18013")] = "01054";
    expect(deckErrors("gam", "aggression", codes).join(" ")).toMatch(
      /Uppercut|copies/i,
    );
  });
});

describe("RRG 1.8 labels, status cancellation and after-play responses", () => {
  it.each(["stunned", "confused", "both"] as const)(
    "Hit and Run under %s cancels its entire printed ability but remains played for both identity responses",
    (status) => {
      let s = base("gam");
      s.player.stunned = status !== "confused";
      s.player.confused = status !== "stunned";
      const h = hand(s, "18020", "18021", "18022");
      s = play(s, h[0], h.slice(1));
      s = respond(s, /Finesse/i);
      s = target(s, "main");
      s = respond(s, /Precision/i);
      s = finish(target(s, "villain"));
      expect(s.player.stunned).toBe(false);
      expect(s.player.confused).toBe(false);
      expect(s.villain.hp).toBe(49);
      expect(s.scheme.threat).toBe(5);
      conserved(s, h);
    },
  );

  it("Hit and Run finishes both printed clauses before optional Finesse/Precision/Sword responses", () => {
    let s = base("gam");
    put(s, "18010");
    s = target(paidPlay(s, "18020", "18021", "18022"), "villain");
    s = target(s, "main");
    expect(s.villain.hp).toBe(48);
    expect(s.scheme.threat).toBe(4);
    s = respond(s, /Finesse/i);
    s = target(s, "main");
    s = respond(s, /Precision/i);
    s = target(s, "villain");
    s = respond(s, /Gamora.*Sword|Sword/i, "18010");
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(46);
    expect(s.scheme.threat).toBe(3);
  });

  it("a canceled thwart event still satisfies Decisive Blow's played-event history", () => {
    let s = base("gam");
    s.player.confused = true;
    s = finish(paidPlay(s, "18005"));
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(6);
    s = finish(target(paidPlay(s, "18006", "18022"), "villain"));
    expect(s.villain.hp).toBe(43);
  });

  it("Crosscounter under both statuses pays its cost, cancels prevention and both clauses, and still offers both after-play responses", () => {
    let s = base("gam");
    s.player.stunned = true;
    s.player.confused = true;
    const h = hand(s, "18004", "18003");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: "fixture",
    });
    s = respond(s, /Crosscounter/i, "18004");
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = respond(s, /Finesse/i);
    s = target(s, "main");
    s = respond(s, /Precision/i);
    s = finish(target(s, "villain"));
    expect(s.player.hp).toBe(6);
    expect(s.villain.hp).toBe(49);
    expect(s.scheme.threat).toBe(5);
    expect(s.player.stunned).toBe(false);
    expect(s.player.confused).toBe(false);
    conserved(s, h);
  });

  it("Tough handles the packet before Crosscounter becomes available", () => {
    let s = base("gam");
    const h = hand(s, "18004", "18003");
    s.player.tough = true;
    s = finish(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 4,
        source: "fixture",
      }),
    );
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
  });

  it("Crosscounter's true defense enables True Grit even without a basic exhaust", () => {
    let s = base("gam");
    const enemy = minion(s, "17026"),
      h = hand(s, "18004", "18031", "18021", "18022");
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "take");
    s = respond(s, /Crosscounter/i, "18004");
    s = command(s, { type: "PAY", ids: [h[2].id] });
    s = target(s, "villain");
    s = target(s, "main");
    s = respond(s, /True Grit/i, "18031");
    s = command(s, { type: "PAY", ids: [h[3].id] });
    s = finish(target(s, "main"));
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(false);
    expect(s.scheme.threat).toBe(3);
    conserved(s, h);
  });

  it("Crosscounter can prevent direct damage outside an attack without enabling True Grit", () => {
    let s = base("gam");
    const h = hand(s, "18004", "18031", "18021");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: "retaliate",
    });
    s = respond(s, /Crosscounter/i, "18004");
    s = command(s, { type: "PAY", ids: [h[2].id] });
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === "villain" || o.id === "main")
          ?.id,
    );
    expect(s.player.hp).toBe(9);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.some((p) => p.id === h[1].id)).toBe(true);
    expect(s.scheme.threat).toBe(5);
    expect(s.attack).toBeNull();
    conserved(s, h);
  });

  it("Crosscounter prevents ally-defended Overkill without becoming the defender or enabling True Grit", () => {
    let s = base("gam");
    const ally = put(s, "18002"),
      charge = owned(s, "01099"),
      h = hand(s, "18004", "18031", "18021");
    ally.damage = 1;
    charge.attachedTo = "villain";
    s.attachments.push(charge);
    s = choose(native(s, { type: "enemyAttack", id: "villain" }), ally.id);
    s = respond(s, /Crosscounter/i, "18004");
    expect(s.attack?.defender).toBe(ally.id);
    s = command(s, { type: "PAY", ids: [h[2].id] });
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === "villain" || o.id === "main")
          ?.id,
    );
    expect(s.player.hp).toBe(9); // Rhino 2 + Charge 3, minus ally's 1 HP and prevention 3.
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === h[1].id)).toBe(true);
    expect(s.scheme.threat).toBe(5);
    conserved(s, [ally, ...h]);
  });

  it("Finesse removes threat without a thwart, leaving Confused and bypassing Patrol", () => {
    let s = base("gam");
    minion(s, "16119");
    s.player.confused = true;
    s = target(paidPlay(s, "18003"), "villain");
    s = respond(s, /Finesse/i);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(5);
    expect(s.player.confused).toBe(true);
  });

  it("Crisis still forbids Finesse from removing main threat", () => {
    let s = base("gam");
    const crisis = side(s, "01108", 3);
    s = target(paidPlay(s, "18003"), "villain");
    s = respond(s, /Finesse/i);
    expect(s.prompt?.options.some((o) => o.id === "main")).not.toBe(true);
    s = finish(target(s, crisis.id));
    expect(s.scheme.threat).toBe(6);
  });

  it("In a Bind suppresses the identity response while an independent Sword can still respond", () => {
    let s = base("gam");
    put(s, "18010");
    s = finish(
      native(s, { type: "reveal", piece: owned(s, "18027"), skip: true }),
    );
    s = target(paidPlay(s, "18003"), "villain");
    s = respond(s, /Sword/i, "18010");
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(47);
    expect(s.scheme.threat).toBe(6);
  });
});

describe("Actual player control and saved turn history", () => {
  it("Gamora's out-of-turn event owns her response, payment and physical discard", () => {
    let s = base("stld", "gam");
    const event = owned(s, "18003", "p2");
    seatView(s, "p2").player.hand.push(event);
    s = command(s, { type: "PLAY", id: event.id, playerId: "p2" });
    s = target(s, "villain");
    s = respond(s, /Finesse/i);
    s = finish(target(s, "main"));
    expect(s.activePlayerId).toBe("p1");
    expect(s.turnPlayerId).toBe("p1");
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === event.id),
    ).toBe(true);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === event.id),
    ).toBe(false);
    expect(s.scheme.threat).toBe(5);
    conserved(s, [event], "p2");
  });

  it("played-event history expires at the actual turn boundary even during the same hero phase", () => {
    let s = base("gam", "stld");
    s = finish(target(paidPlay(s, "18005"), "main"));
    s = command(s, { type: "END_TURN" });
    expect(s.turnPlayerId).toBe("p2");
    const event = owned(s, "18006", "p1"),
      payment = owned(s, "18022", "p1");
    seatView(s, "p1").player.hand.push(event, payment);
    s = command(s, { type: "PLAY", id: event.id, playerId: "p1" });
    s = command(s, { type: "PAY", ids: [payment.id] });
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(46);
  });

  it("Star-Lord's cost interrupt on another player's turn deals to and debits the actual Star-Lord seat", () => {
    let s = base("gam", "stld");
    const event = owned(s, "17004", "p2");
    seatView(s, "p2").player.hand.push(event);
    s = command(s, { type: "PLAY", id: event.id, playerId: "p2" });
    s = respond(s, /What could go wrong/i);
    s = finish(target(s, "main"));
    expect(s.encounter.dealt[0].dealtTo).toBe("p2");
    expect(s.activePlayerId).toBe("p1");
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === event.id),
    ).toBe(true);
    conserved(s, [event], "p2");
  });

  it("Sibling Rivalry cannot be thwarted by the other hero's basic power", () => {
    let s = base("stld", "gam");
    const scheme = side(s, "18025", 3);
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.options.some((o) => o.id === scheme.id)).not.toBe(true);
    s = finish(target(s, "main"));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(3);
  });

  it("Crosscounter interrupts damage to the second-seat Gamora using only her physical payment and identity responses", () => {
    let s = base("stld", "gam");
    const event = owned(s, "18004", "p2"),
      resource = owned(s, "18003", "p2");
    seatView(s, "p2").player.hand.push(event, resource);
    s = native(s, {
      type: "damage",
      target: "hero:p2",
      amount: 4,
      source: "fixture",
    });
    s = respond(s, /Crosscounter/i, "18004");
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === "villain" || o.id === "main")
          ?.id,
    );
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(s.scheme.threat).toBe(5);
    expect(s.villain.hp).toBe(49);
    expect(s.activePlayerId).toBe("p1");
    conserved(s, [event, resource], "p2");
  });

  it("a teammate's ordinary Hero Action pays their own Attack event to remove In a Bind from Gamora", () => {
    let s = base("stld", "gam");
    const bind = owned(s, "18027"),
      event = hand(s, "17005")[0];
    s = finish(native(s, { type: "reveal", piece: bind, skip: true }));
    expect(s.attachments.find((p) => p.id === bind.id)?.attachedTo).toBe(
      "hero:p2",
    );
    s = finish(command(s, { type: "ABILITY", id: bind.id, action: event.id }));
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === event.id),
    ).toBe(true);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === event.id),
    ).toBe(false);
    expect(s.attachments.some((p) => p.id === bind.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === bind.id)).toHaveLength(1);
    expect(s.activePlayerId).toBe("p1");
    conserved(s, [event], "p1");
  });
});

describe("Original player-pack cards through native engine ports", () => {
  it.each([
    ["18012", "villain"],
    ["18016", "main"],
  ] as const)(
    "the first-round %s returns its exact physical card after effects resolve",
    (code, selected) => {
      let s = base("gam");
      const h = hand(s, code, "18022");
      s = finish(target(play(s, h[0], [h[1]]), selected));
      expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(true);
      expect(s.player.discard.some((p) => p.id === h[0].id)).toBe(false);
      expect(code === "18012" ? s.villain.hp : s.scheme.threat).toBe(
        code === "18012" ? 47 : 3,
      );
      conserved(s, h);
    },
  );

  it("spending a resource is not playing a card, but a played upgrade consumes Clobber's first-card opportunity", () => {
    let s = base("gam");
    s = finish(paidPlay(s, "18009", "18021"));
    const h = hand(s, "18012", "18022");
    s = finish(target(play(s, h[0], [h[1]]), "villain"));
    expect(s.player.discard.some((p) => p.id === h[0].id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(false);
    conserved(s, h);
  });

  it("replaying the same physical Clobber in its first round does not repeat the first-card return", () => {
    let s = base("gam");
    const h = hand(s, "18012", "18022");
    s = finish(target(play(s, h[0], [h[1]]), "villain"));
    expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(true);
    const secondPayment = owned(s, "18022");
    s.player.hand.push(secondPayment);
    s = finish(target(play(s, h[0], [secondPayment]), "villain"));
    expect(s.villain.hp).toBe(44);
    expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
    conserved(s, [...h, secondPayment]);
  });

  it("a first-round Clobber canceled by Stunned does not execute its conditional return", () => {
    let s = base("gam");
    s.player.stunned = true;
    const h = hand(s, "18012", "18022");
    s = finish(play(s, h[0], [h[1]]));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
    conserved(s, h);
  });

  it("First Hit can defeat the initiating minion before a defense window or incoming damage exists", () => {
    let s = base("gam");
    const enemy = minion(s, "01103", "p1", 1),
      h = hand(s, "18015", "18003");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = respond(s, /First Hit/i, "18015");
    s = finish(command(s, { type: "PAY", ids: [h[1].id] }));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.attack).toBeNull();
    conserved(s, h);
  });

  it("a Stunned First Hit still pays and is played, then the surviving minion's attack continues", () => {
    let s = base("gam");
    s.player.stunned = true;
    const enemy = minion(s),
      h = hand(s, "18015", "18003");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = respond(s, /First Hit/i, "18015");
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "take")?.id);
    expect(s.player.stunned).toBe(false);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
    expect(s.player.hp).toBe(8);
    conserved(s, h);
  });

  it("Drax cannot target minions with his actual basic attack", () => {
    let s = base("gam");
    const ally = put(s, "18019"),
      enemy = minion(s);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.prompt?.options.some((o) => o.id === enemy.id)).not.toBe(true);
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(47);
  });

  it("Godslayer is optional for a basic attack against a unique villain and does not alter printed ATK", () => {
    let s = base("gam");
    const sword = put(s, "18018");
    s = target(command(s, { type: "BASIC", action: "attack" }), "villain");
    s = finish(respond(s, /Godslayer/i, "18018"));
    expect(s.villain.hp).toBe(46);
    expect(s.player.inPlay.find((p) => p.id === sword.id)?.exhausted).toBe(
      true,
    );
    expect(heroStats(s).attack).toBe(2);
  });

  it("Cosmo names a type before selecting the actual other player's deck and discards that exact card", () => {
    let s = base("stld", "gam");
    const ally = put(s, "17020"),
      otherTop = seatView(s, "p2").player.deck[0];
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      "villain",
    );
    s = respond(s, /Cosmo/i, "17020");
    s = choose(s, "resource");
    s = finish(choose(s, "p2"));
    expect(s.villain.hp).toBe(49);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === otherTop.id),
    ).toBe(true);
    conserved(s, [otherTop], "p2");
  });

  it("Knowhere exhausts under its owner's control and draws for the actual player who played a Guardian ally", () => {
    let s = base("stld", "gam");
    const location = put(s, "17022"),
      ally = owned(s, "18002", "p2"),
      payment = owned(s, "18022", "p2"),
      top = seatView(s, "p2").player.deck[0];
    seatView(s, "p2").player.hand.push(ally, payment);
    s = command(s, { type: "END_TURN" });
    expect(s.turnPlayerId).toBe("p2");
    s = command(s, { type: "PLAY", id: ally.id, playerId: "p2" });
    s = command(s, { type: "PAY", ids: [payment.id] });
    s = respond(s, /Knowhere/i, "17022");
    s = finish(s);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === location.id)
        ?.exhausted,
    ).toBe(true);
    expect(seatView(s, "p2").player.hand.some((p) => p.id === top.id)).toBe(
      true,
    );
    expect(seatView(s, "p1").player.hand).toHaveLength(0);
    conserved(s, [ally, payment, top], "p2");
  });

  it("Air Supremacy damages selected enemies without an attack, bypassing Guard, Stunned and Retaliate", () => {
    let s = base("stld");
    put(s, "17008");
    put(s, "17011");
    const guard = minion(s, "01101"),
      enemy = minion(s, "01184");
    s.player.stunned = true;
    s = paidPlay(s, "17014", "18022");
    s = choose(s, "villain");
    s = finish(choose(s, enemy.id));
    expect(s.villain.hp).toBe(47);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(3);
    expect(s.minions.find((p) => p.id === guard.id)?.damage).toBe(0);
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBe(10);
  });

  it("Pulse Grenade counts printed boost icons without resolving boost-star abilities", () => {
    let s = base("stld");
    const grenade = put(s, "17023"),
      a = owned(s, "01107"),
      b = owned(s, "01121");
    s.encounter.deck.unshift(a, b);
    s = command(s, { type: "ABILITY", id: grenade.id, action: "grenade" });
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(48);
    expect(s.encounter.discard.some((p) => p.id === a.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === b.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === grenade.id)).toBe(true);
    conserved(s, [grenade]);
  });

  it("another player's Target Practice pays its own physical discard while the attacking ally retains its controller", () => {
    let s = base("stld", "spider_man");
    const ally = put(s, "17012"),
      laser = put(s, "17019"),
      practice = put(s, "17017", "p2");
    laser.attachedTo = ally.id;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      "villain",
    );
    s = respond(s, /Target Practice/i, "17017");
    s = finish(s);
    expect(s.villain.hp).toBe(44);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === ally.id)?.damage,
    ).toBe(1);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === practice.id),
    ).toBe(true);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === practice.id),
    ).toBe(false);
    expect(s.activePlayerId).toBe("p1");
    conserved(s, [ally, laser], "p1");
    conserved(s, [practice], "p2");
  });

  it("Pulse Grenade stops its specified discard when the encounter deck empties instead of discarding from the recycled deck", () => {
    let s = base("stld");
    const grenade = put(s, "17023"),
      last = owned(s, "01107"),
      recycled = owned(s, "01121");
    s.encounter.deck = [last];
    s.encounter.discard = [recycled];
    s = command(s, { type: "ABILITY", id: grenade.id, action: "grenade" });
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(48);
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck.map((p) => p.id).sort()).toEqual(
      [last.id, recycled.id].sort(),
    );
    expect(s.encounter.discard).toHaveLength(0);
    expect(s.minions).toHaveLength(0);
  });

  it("Adam Warlock resolves Salvage's distinct Mental and Wild resources as two independent effects", () => {
    let s = base("stld");
    const ally = put(s, "17011"),
      salvage = hand(s, "16033")[0];
    s.scheme.threat = 6;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      "villain",
    );
    s = respond(s, /Adam Warlock/i, "17011");
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find(
          (o) => o.id === "physical" || o.id === "villain" || o.id === "main",
        )?.id,
    );
    expect(s.villain.hp).toBe(46); // 1 basic ATK plus mandatory mental-resource damage 3.
    expect(s.scheme.threat).toBe(3); // Wild chooses the physical-resource effect.
    expect(s.player.discard.filter((p) => p.id === salvage.id)).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    conserved(s, [ally, salvage]);
  });
});
