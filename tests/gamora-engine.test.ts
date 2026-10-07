/** Gamora acceptance uses physical retail printings and reloads every command. */
import { describe, expect, it } from "vitest";
import { handSize, heroCard, heroStats } from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import {
  dispatch,
  newGame,
  playable,
  paymentSources,
} from "../src/game/engine.js";
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
} from "./sg-test-helpers.js";

describe("Gamora's source deck and identity", () => {
  it("launches her complete forty-card three-aspect source and actual obligation", () => {
    const source = STARTER_DECKS.find((d) => d.id === "starter-18001a")!;
    const codes = heroStarterCodes("gam");
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((c) => c.startsWith("18"))).toBe(true);
    expect(deckErrors("gam", "aggression", codes)).toEqual([]);
    const s = newGame({
      heroId: "gam",
      aspect: "aggression",
      villainId: "rhino",
      seed: 18001,
    });
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.encounter.deck.filter((p) => p.code === "18024")).toHaveLength(1);
    expect(s.player.hp).toBe(10);
    expect(heroCard(s).code).toBe("18001b");
    expect(handSize(s)).toBe(6);
  });

  it("uses her printed balanced hero stats and alter-ego recovery", () => {
    let s = base("gam");
    expect(heroCard(s).code).toBe("18001a");
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      recover: 3,
    });
    expect(handSize(s)).toBe(5);
    s = command(s, { type: "FLIP" });
    expect(heroCard(s).code).toBe("18001b");
    expect(heroCard(s).traits).toContain("Outlaw");
    expect(handSize(s)).toBe(6);
  });

  it.each(["18003", "18005", "18020"])(
    "Skilled Tactician draws the actual %s attack/thwart top card once per round",
    (code) => {
      let s = base("gam");
      s.player.form = "alter";
      const top = owned(s, code),
        second = owned(s, "18003");
      s.player.deck.unshift(top, second);
      s = finish(
        command(s, {
          type: "ABILITY",
          id: "identity",
          action: "skilled-tactician",
        }),
      );
      expect(s.player.hand.map((p) => p.id)).toEqual([top.id]);
      expect(s.player.deck[0].id).toBe(second.id);
      expect(
        dispatch(reload(s), {
          type: "ABILITY",
          id: "identity",
          action: "skilled-tactician",
        }).error,
      ).toBeTruthy();
      conserved(s, [top, second]);
    },
  );

  it("Skilled Tactician preserves a non-event top card and still spends its round use", () => {
    let s = base("gam");
    s.player.form = "alter";
    const top = owned(s, "18009");
    s.player.deck.unshift(top);
    s = finish(
      command(s, {
        type: "ABILITY",
        id: "identity",
        action: "skilled-tactician",
      }),
    );
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.deck[0].id).toBe(top.id);
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "skilled-tactician",
      }).error,
    ).toBeTruthy();
  });

  it("Conditioning Room returns the bottommost qualifying physical event before healing", () => {
    let s = base("gam");
    s.player.form = "alter";
    s.player.hp = 6;
    const room = put(s, "18008"),
      oldest = owned(s, "18003"),
      later = owned(s, "18005"),
      ordinary = owned(s, "18013");
    // Engine discard piles append new cards; index zero is the bottommost card.
    s.player.discard.push(ordinary, oldest, later);
    s = finish(command(s, { type: "ABILITY", id: room.id }));
    expect(s.player.hand.map((p) => p.id)).toEqual([oldest.id]);
    expect(s.player.discard.some((p) => p.id === later.id)).toBe(true);
    expect(s.player.hp).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === room.id)?.exhausted).toBe(true);
    conserved(s, [room, oldest, later, ordinary]);
  });
});

describe("Gamora's native event responses and paid resources", () => {
  it("an actual attack event offers optional Finesse after its damage and only once this phase", () => {
    let s = base("gam");
    const a = hand(s, "18003")[0];
    s = target(play(s, a), "villain");
    s = respond(s, /Finesse/i);
    s = finish(target(s, "main"));
    expect(s.villain.hp).toBe(48);
    expect(s.scheme.threat).toBe(5);
    const b = hand(s, "18003")[0];
    s = finish(target(play(s, b), "villain"));
    expect(s.villain.hp).toBe(46);
    expect(s.scheme.threat).toBe(5);
    conserved(s, [a, b]);
  });

  it("an actual thwart event offers optional Precision against any enemy without an attack", () => {
    let s = base("gam");
    s.player.stunned = true;
    const guard = minion(s, "01101"),
      a = hand(s, "18005")[0];
    s = target(play(s, a), "main");
    s = respond(s, /Precision/i);
    s = finish(target(s, "villain"));
    expect(s.scheme.threat).toBe(5);
    expect(s.villain.hp).toBe(49);
    expect(s.player.stunned).toBe(true);
    expect(s.minions.find((p) => p.id === guard.id)?.damage).toBe(0);
  });

  it("declining Finesse does not consume its phase limit", () => {
    let s = base("gam");
    s = finish(target(paidPlay(s, "18003"), "villain"));
    s = target(paidPlay(s, "18003"), "villain");
    s = respond(s, /Finesse/i);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(5);
  });

  it("the native round boundary restores the actual identity's response uses", () => {
    let s = base("gam");
    s = target(paidPlay(s, "18003"), "villain");
    s = respond(s, /Finesse/i);
    s = finish(target(s, "main"));
    s.phase = "villain";
    s = finish(native(s, { type: "newRound" }));
    s = target(paidPlay(s, "18003"), "villain");
    s = respond(s, /Finesse/i);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(4);
  });

  it("Keen Instincts is a native Wild source for Attack and Thwart events only", () => {
    let s = base("gam");
    const instincts = put(s, "18009"),
      h = hand(s, "18006", "18022");
    expect(
      paymentSources(s, h[0].id, h[0].code).some((p) => p.id === instincts.id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "18008").some((p) => p.id === instincts.id),
    ).toBe(false);
    s = finish(target(play(s, h[0], [instincts, h[1]]), "villain"));
    expect(s.villain.hp).toBe(46);
    expect(s.player.inPlay.find((p) => p.id === instincts.id)?.exhausted).toBe(
      true,
    );
    conserved(s, [instincts, ...h]);
  });

  it("two physical Keen Instincts can pay Crosscounter during damage in hero form", () => {
    let s = base("gam");
    const a = put(s, "18009"),
      b = put(s, "18009"),
      event = hand(s, "18004")[0];
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: "fixture",
    });
    s = respond(s, /Crosscounter/i, "18004");
    s = command(s, { type: "PAY", ids: [a.id] });
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === "villain" || o.id === "main")
          ?.id,
    );
    expect(s.player.hp).toBe(9);
    expect(s.villain.hp).toBe(49);
    expect(s.scheme.threat).toBe(5);
    expect(s.player.inPlay.find((p) => p.id === a.id)?.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === b.id)?.exhausted).toBe(false);
    conserved(s, [a, b, event]);
  });

  it("Gamora's Sword is optional on each attack event and remains separate from Finesse", () => {
    let s = base("gam");
    const sword = put(s, "18010");
    s = target(paidPlay(s, "18003"), "villain");
    s = respond(s, /Gamora.*Sword|Sword/i, "18010");
    s = finish(target(s, "villain"));
    s = target(paidPlay(s, "18003"), "villain");
    s = respond(s, /Gamora.*Sword|Sword/i, "18010");
    s = finish(target(s, "villain"));
    expect(s.villain.hp).toBe(44);
    expect(s.scheme.threat).toBe(6);
    expect(s.player.inPlay.find((p) => p.id === sword.id)?.exhausted).toBe(
      false,
    );
  });

  it("Nebula searches the actual physical Attack/Thwart card and shuffles the remaining deck", () => {
    let s = base("gam");
    const attack = owned(s, "18003"),
      tactic = owned(s, "18013");
    s.player.deck.unshift(attack, tactic);
    const h = hand(s, "18002", "18022");
    s = play(s, h[0], [h[1]]);
    s = respond(s, /Nebula/i, "18002");
    expect(s.prompt?.options.some((o) => o.id === tactic.id)).toBe(false);
    s = finish(choose(s, attack.id));
    expect(s.player.hand.some((p) => p.id === attack.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
    conserved(s, [attack, tactic, ...h]);
  });
});

describe("Gamora's printed turn history and physical nemesis", () => {
  it.each([
    ["18006", 4],
    ["18007", 3],
  ] as const)(
    "%s uses its base amount without the matching event this turn",
    (code, amount) => {
      let s = base("gam");
      s = target(
        paidPlay(s, code, "18022"),
        code === "18006" ? "villain" : "main",
      );
      s = finish(s);
      expect(code === "18006" ? 50 - s.villain.hp : 6 - s.scheme.threat).toBe(
        amount,
      );
    },
  );

  it("Decisive Blow gains its printed seven damage after a thwart event even if Precision was declined", () => {
    let s = base("gam");
    s = finish(target(paidPlay(s, "18005"), "main"));
    s = finish(target(paidPlay(s, "18006", "18022"), "villain"));
    expect(s.villain.hp).toBe(43);
  });

  it("Forward Momentum gains its printed five threat after an attack event even if Finesse was declined", () => {
    let s = base("gam");
    s = finish(target(paidPlay(s, "18003"), "villain"));
    s = finish(target(paidPlay(s, "18007", "18022"), "main"));
    expect(s.scheme.threat).toBe(1);
  });

  it("a basic thwart is not a played Thwart event for Decisive Blow", () => {
    let s = base("gam");
    s = finish(target(command(s, { type: "BASIC", action: "thwart" }), "main"));
    s = finish(target(paidPlay(s, "18006", "18022"), "villain"));
    expect(s.villain.hp).toBe(46);
  });

  it("Unfulfilled Destiny removes its actual physical obligation for an alter-ego exhaust", () => {
    let s = base("gam");
    const obligation = owned(s, "18024");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "flip");
    s = finish(choose(s, "remove"));
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
  });

  it("Unfulfilled Destiny discards exactly two selected physical events", () => {
    let s = base("gam");
    const h = hand(s, "18003", "18005", "18009"),
      obligation = owned(s, "18024");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "stay");
    s = choose(s, "events");
    expect(s.prompt).toMatchObject({ kind: "select", min: 2, max: 2 });
    expect(s.prompt?.options.some((o) => o.id === h[2].id)).toBe(false);
    s = finish(command(s, { type: "SELECT", ids: [h[0].id, h[1].id] }));
    expect(s.player.hand.map((p) => p.id)).toEqual([h[2].id]);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
    conserved(s, h);
  });

  it("Nemesis Nebula discards the physical unique ally before entering play", () => {
    let s = base("gam");
    const ally = put(s, "18002"),
      enemy = owned(s, "18026");
    s = finish(native(s, { type: "reveal", piece: enemy, skip: true }));
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.minions.find((p) => p.id === enemy.id)?.engagedWith).toBe("p1");
    conserved(s, [ally]);
  });

  it("Waylay gives both statuses and only surges when a status already existed", () => {
    let s = base("gam");
    s = finish(
      native(s, { type: "reveal", piece: owned(s, "18028"), skip: true }),
    );
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
    expect(s.encounter.deck).toHaveLength(15);
  });

  it("In a Bind attaches to the actual Gamora and suppresses her printed response text", () => {
    let s = base("gam");
    const bind = owned(s, "18027");
    s = finish(native(s, { type: "reveal", piece: bind, skip: true }));
    s = finish(target(paidPlay(s, "18003"), "villain"));
    expect(s.villain.hp).toBe(48);
    expect(s.scheme.threat).toBe(6);
    expect(s.attachments.find((p) => p.id === bind.id)).toBeTruthy();
  });

  it("In a Bind spends the chosen actual Attack event and one damage before discarding itself", () => {
    let s = base("gam");
    const bind = owned(s, "18027"),
      h = hand(s, "18003", "18005");
    s = finish(native(s, { type: "reveal", piece: bind, skip: true }));
    expect(
      dispatch(reload(s), { type: "ABILITY", id: bind.id, action: h[1].id })
        .error,
    ).toBeTruthy();
    s = command(s, { type: "ABILITY", id: bind.id, action: h[0].id });
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.player.discard.some((p) => p.id === h[0].id)).toBe(true);
    expect(s.attachments.some((p) => p.id === bind.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === bind.id)).toBe(true);
    conserved(s, h);
  });
});
