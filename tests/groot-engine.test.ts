/** Native Groot acceptance: original cards, actual damage packets, saved choices. */
import { describe, expect, it } from "vitest";
import { handSize, heroCard, heroStats } from "../src/game/cards.js";
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
  growth,
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
  until,
} from "./gmw-test-helpers.js";

describe("Groot's original Protection source and persistent growth", () => {
  it("launches his original forty physical cards and actual Wilt obligation", () => {
    const source = STARTER_DECKS.find((d) => d.id === "starter-16001a")!;
    const codes = heroStarterCodes("groot");
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("16"))).toBe(true);
    expect(deckErrors("groot", "protection", codes)).toEqual([]);
    const s = newGame({
      heroId: "groot",
      aspect: "protection",
      villainId: "rhino",
      seed: 16001,
    });
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.hp).toBe(10);
    expect(heroCard(s).code).toBe("16001b");
    expect(handSize(s)).toBe(6);
    expect(growth(s)).toBe(0);
    expect(s.encounter.deck.filter((p) => p.code === "16025")).toHaveLength(1);
  });

  it("Growth Spurt is an optional alter-ego action once per round, capped at ten", () => {
    let s = base("groot");
    s.player.form = "alter";
    growth(s, 9);
    s = command(s, { type: "ABILITY", id: "identity", action: "growth-spurt" });
    expect(growth(s)).toBe(10);
    expect(s.player.exhausted).toBe(false);
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "growth-spurt",
      }).error,
    ).toBeTruthy();
    s.round++;
    growth(s, 5);
    s = command(s, { type: "ABILITY", id: "identity", action: "growth-spurt" });
    expect(growth(s)).toBe(7);
  });

  it("the native round boundary preserves growth and refreshes Growth Spurt", () => {
    let s = base("groot");
    s.player.form = "alter";
    growth(s, 3);
    s = command(s, { type: "ABILITY", id: "identity", action: "growth-spurt" });
    const previous = s.round;
    s.phase = "villain";
    s = finish(native(s, { type: "newRound" }));
    expect(s.round).toBe(previous + 1);
    expect(growth(s)).toBe(5);
    s = command(s, { type: "ABILITY", id: "identity", action: "growth-spurt" });
    expect(growth(s)).toBe(7);
  });

  it("growth persists through form change and does not grant alter-ego damage prevention", () => {
    let s = base("groot");
    growth(s, 5);
    s = command(s, { type: "FLIP" });
    s = finish(
      native(s, { type: "damage", target: "hero", amount: 3, source: "test" }),
    );
    expect(s.player.hp).toBe(7);
    expect(growth(s)).toBe(5);
    s.player.flipped = false;
    s = command(s, { type: "FLIP" });
    expect(heroCard(s).traits).toContain("Guardian");
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 1, defense: 3 });
    expect(growth(s)).toBe(5);
  });

  it.each([2, 5])(
    "Flora Colossus prevents %i direct damage by removing only available growth",
    (amount) => {
      let s = base("groot");
      growth(s, 3);
      s = finish(
        native(s, { type: "damage", target: "hero", amount, source: "test" }),
      );
      expect(growth(s)).toBe(Math.max(0, 3 - amount));
      expect(s.player.hp).toBe(10 - Math.max(0, amount - 3));
    },
  );

  it("Tough has priority over Flora Colossus and preserves all growth counters", () => {
    let s = base("groot");
    growth(s, 3);
    s.player.tough = true;
    s = finish(
      native(s, { type: "damage", target: "hero", amount: 5, source: "test" }),
    );
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(growth(s)).toBe(3);
  });

  it("Fruition works in either form, does not exhaust Groot, and caps growth", () => {
    let s = base("groot");
    growth(s, 9);
    const first = hand(s, "16002")[0];
    s = finish(play(s, first));
    expect(growth(s)).toBe(10);
    expect(s.player.exhausted).toBe(false);
    s = command(s, { type: "FLIP" });
    growth(s, 1);
    const second = hand(s, "16002")[0];
    s = finish(play(s, second));
    expect(growth(s)).toBe(3);
    conserved(s, [first, second]);
  });

  it("Fertile Ground is an actual alter-ego exhaust cost followed by growth and a draw", () => {
    let s = base("groot");
    const support = put(s, "16007"),
      top = s.player.deck[0];
    growth(s, 9);
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: support.id,
        action: "fertile-ground",
      }).error,
    ).toBeTruthy();
    s.player.form = "alter";
    s = command(s, {
      type: "ABILITY",
      id: support.id,
      action: "fertile-ground",
    });
    expect(growth(s)).toBe(10);
    expect(s.player.hand.find((p) => p.id === top.id)).toBeTruthy();
    expect(s.player.inPlay.find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
  });
});

describe("Groot's native signature events and basic power windows", () => {
  it("the actual GMW Power of Protection printing pays two resources for Starhawk", () => {
    let s = base("groot");
    const h = hand(s, "16012", "16015");
    s = finish(play(s, h[0], [h[1]]));
    expect(s.player.inPlay.find((p) => p.id === h[0].id)?.code).toBe("16012");
    expect(s.player.discard.find((p) => p.id === h[1].id)?.code).toBe("16015");
    conserved(s, h);
  });

  it("the GMW Desperate Defense printing resolves its native paid defense and ready response", () => {
    let s = base("groot");
    const enemy = minion(s),
      h = hand(s, "16013", "16021");
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "hero");
    s = respond(s, /Desperate Defense/i, "16013");
    s = finish(command(s, { type: "PAY", ids: [h[1].id] }));
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(false);
    conserved(s, h);
    expect(s.player.discard.find((p) => p.id === h[0].id)?.code).toBe("16013");
  });

  it("I am Groot removes the actual growth amount without spending counters", () => {
    let s = base("groot");
    growth(s, 4);
    s.scheme.threat = 8;
    s = finish(target(paidPlay(s, "16003", "16021", "16022"), "main"));
    expect(s.scheme.threat).toBe(4);
    expect(growth(s)).toBe(4);
  });

  it("I. AM. GROOT! attacks for actual growth and retains counters", () => {
    let s = base("groot");
    growth(s, 6);
    s = finish(target(paidPlay(s, "16004", "16021"), s.villain.id));
    expect(s.villain.hp).toBe(44);
    expect(growth(s)).toBe(6);
  });

  it("Stunned and Confused replace the signature attack and thwart without spending growth", () => {
    let s = base("groot");
    growth(s, 6);
    s.player.stunned = true;
    s = finish(paidPlay(s, "16004", "16021"));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(growth(s)).toBe(6);
    s.player.confused = true;
    s = finish(paidPlay(s, "16003", "16021", "16022"));
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(6);
    expect(growth(s)).toBe(6);
  });

  it("Root Stomp gains one growth only when its actual attack defeats its exact target", () => {
    let s = base("groot");
    growth(s, 4);
    const enemy = minion(s);
    s = finish(target(paidPlay(s, "16005", "16021"), enemy.id));
    expect(growth(s)).toBe(5);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    const tough = minion(s);
    tough.tough = true;
    s = finish(target(paidPlay(s, "16005", "16022"), tough.id));
    expect(growth(s)).toBe(5);
    expect(s.minions.find((p) => p.id === tough.id)).toMatchObject({
      tough: false,
      damage: 0,
    });
  });

  it("We Are Groot pays growth once and gives Tough to distinct actual friendly characters", () => {
    let s = base("groot", "rocket");
    growth(s, 4);
    const ally = put(s, "16012"),
      h = hand(s, "16006", "16021");
    s = play(s, h[0], [h[1]]);
    s = choose(s, "2");
    expect(growth(s)).toBe(2);
    s = choose(s, "hero");
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(false);
    s = finish(choose(s, ally.id));
    expect(s.player.tough).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.tough).toBe(true);
    expect(seatView(s, "p2").player.tough).toBe(false);
    conserved(s, h);
  });

  it.each([
    ["attack", "16011", 4],
    ["thwart", "16008", 3],
  ] as const)(
    "%s Vines are optional physical interrupts that pay one growth and exhaust",
    (action, code, amount) => {
      let s = base("groot");
      growth(s, 5);
      const vine = put(s, code);
      s = command(s, { type: "BASIC", action });
      s = respond(s, /Vine/i, code);
      s = finish(target(s, action === "attack" ? s.villain.id : "main"));
      expect(growth(s)).toBe(4);
      expect(s.player.inPlay.find((p) => p.id === vine.id)?.exhausted).toBe(
        true,
      );
      expect(action === "attack" ? s.villain.hp : s.scheme.threat).toBe(
        action === "attack" ? 50 - amount : 6 - amount,
      );
    },
  );

  it.each([
    ["attack", "16011", "stunned"],
    ["thwart", "16008", "confused"],
  ] as const)(
    "%s status replacement precedes the optional Vines cost",
    (action, code, status) => {
      let s = base("groot");
      growth(s, 5);
      const vine = put(s, code),
        lash = put(s, "16009");
      s.player[status] = true;
      s = finish(command(s, { type: "BASIC", action }));
      expect(growth(s)).toBe(5);
      expect(s.player.inPlay.find((p) => p.id === vine.id)?.exhausted).toBe(
        false,
      );
      expect(s.player.inPlay.find((p) => p.id === lash.id)?.exhausted).toBe(
        false,
      );
      expect(s.player.exhausted).toBe(true);
    },
  );

  it("Lashing Vines responds after an actual basic power and pays exactly two growth", () => {
    let s = base("groot");
    growth(s, 5);
    const lash = put(s, "16009");
    s = target(command(s, { type: "BASIC", action: "attack" }), s.villain.id);
    s = respond(s, /Lashing Vines/i, "16009");
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(growth(s)).toBe(3);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === lash.id)?.exhausted).toBe(true);
  });

  it("Vine Shield modifies a real basic defense, and Lashing Vines then readies Groot", () => {
    let s = base("groot");
    growth(s, 5);
    const shield = put(s, "16010"),
      lash = put(s, "16009"),
      enemy = minion(s);
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "hero");
    s = respond(s, /Vine Shield/i, "16010");
    s = respond(s, /Lashing Vines/i, "16009");
    s = finish(s);
    expect(s.player.hp).toBe(10);
    expect(growth(s)).toBe(2);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === shield.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.find((p) => p.id === lash.id)?.exhausted).toBe(true);
  });
});

describe("Groot's native obligation and nemesis", () => {
  it("Blazing Inferno forces its indirect damage before the villain phase's regular threat", () => {
    let s = base("groot");
    growth(s, 5);
    s.scheme.threat = 0;
    side(s, "16026", 3);
    s = native(s, { type: "beginVillain" });
    expect(s.scheme.threat).toBe(0);
    s = choose(s, "hero");
    expect(s.scheme.threat).toBe(0);
    expect(growth(s)).toBe(5);
    s = choose(s, "hero");
    expect(growth(s)).toBe(3);
    expect(s.player.hp).toBe(10);
    expect(s.scheme.threat).toBe(1);
  });

  it("Wilt's remove option flips to alter-ego and exhausts the actual identity", () => {
    let s = base("groot");
    growth(s, 5);
    const obligation = owned(s, "16025");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "flip");
    s = choose(s, "remove");
    s = finish(s);
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.find((p) => p.id === obligation.id)).toBeTruthy();
    expect(growth(s)).toBe(5);
  });

  it("Wilt removes up to three actual counters and surges only when none were removed", () => {
    let s = base("groot");
    growth(s, 2);
    const obligation = owned(s, "16025");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "stay");
    s = finish(choose(s, "growth"));
    expect(growth(s)).toBe(0);
    expect(
      s.encounter.discard.find((p) => p.id === obligation.id),
    ).toBeTruthy();
    expect(s.encounter.deck).toHaveLength(15);
    const empty = owned(s, "16025");
    s = native(s, { type: "reveal", piece: empty, skip: true });
    s = choose(s, "stay");
    s = choose(s, "growth");
    expect(s.encounter.deck.length).toBeLessThan(15);
  });

  it("Fan the Flames allocates one combined indirect packet with independent nemesis bonuses", () => {
    let s = base("groot");
    growth(s, 5);
    side(s, "16026", 3);
    minion(s, "16027");
    s = native(s, { type: "reveal", piece: owned(s, "16028"), skip: true });
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "hero")?.id);
    expect(growth(s)).toBe(1);
    expect(s.player.hp).toBe(10);
  });

  it("Furnax's actual scheme activation deals indirect damage separately to each player", () => {
    let s = base("groot", "rocket");
    growth(s, 5);
    s.scheme.threat = 0;
    const enemy = minion(s, "16027");
    s = native(s, { type: "enemyScheme", id: enemy.id });
    s = finish(s, (v) => v.prompt?.options.find((o) => o.id === "hero")?.id);
    expect(s.scheme.threat).toBe(2);
    expect(growth(s)).toBe(3);
    expect(s.player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(7);
  });

  it("Confused replaces Furnax's scheme and does not trigger its after-activation response", () => {
    let s = base("groot", "rocket");
    growth(s, 5);
    s.scheme.threat = 0;
    const enemy = minion(s, "16027");
    enemy.confused = true;
    s = finish(native(s, { type: "enemyScheme", id: enemy.id }));
    expect(s.scheme.threat).toBe(0);
    expect(growth(s)).toBe(5);
    expect(seatView(s, "p2").player.hp).toBe(9);
  });
});
