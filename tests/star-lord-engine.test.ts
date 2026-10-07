/** Native Star-Lord acceptance: actual retail sources and saved payment choices. */
import { describe, expect, it } from "vitest";
import { aerial, handSize, heroCard, heroStats } from "../src/game/cards.js";
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
  facedown,
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

describe("Star-Lord's original source and printed identity setup", () => {
  it("launches forty physical original Leadership cards and Banishment", () => {
    const source = STARTER_DECKS.find((d) => d.id === "starter-17001a")!;
    const codes = heroStarterCodes("stld");
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("17"))).toBe(true);
    expect(deckErrors("stld", "leadership", codes)).toEqual([]);
    const s = newGame({
      heroId: "stld",
      aspect: "leadership",
      villainId: "rhino",
      seed: 17001,
    });
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.hp).toBe(10);
    expect(heroCard(s).code).toBe("17001b");
    expect(handSize(s)).toBe(6);
    expect(s.encounter.deck.filter((p) => p.code === "17024")).toHaveLength(1);
  });

  it("setup searches an actual remaining Element Gun after mulligan and keeps forty physical cards", () => {
    let s = newGame({
      heroId: "stld",
      aspect: "leadership",
      villainId: "rhino",
      seed: 17001,
      pacing: "expert",
    });
    const all = physical(s),
      gun = s.player.deck.find((p) => p.code === "17007")!;
    expect(gun).toBeTruthy();
    const opening = s.player.hand.length;
    s = command(s, { type: "MULLIGAN", ids: [] });
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === gun.id) ? gun.id : undefined,
    );
    expect(s.player.hand.some((p) => p.id === gun.id)).toBe(true);
    expect(s.player.hand).toHaveLength(opening + 1);
    expect(physical(s)).toHaveLength(40);
    conserved(s, all);
  });

  it("uses the printed identity stats in both forms", () => {
    let s = base("stld");
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 1,
      recover: 3,
    });
    expect(heroCard(s).traits).toContain("Guardian");
    expect(handSize(s)).toBe(5);
    s = command(s, { type: "FLIP" });
    expect(heroCard(s).code).toBe("17001b");
    expect(heroCard(s).traits).toContain("Outlaw");
    expect(handSize(s)).toBe(6);
  });

  it("Smooth Talker swaps exact physical cards rather than drawing or discarding", () => {
    let s = base("stld");
    s.player.form = "alter";
    const h = hand(s, "17005", "17004"),
      top = s.player.deck[0],
      second = s.player.deck[1];
    s = command(s, {
      type: "ABILITY",
      id: "identity",
      action: "smooth-talker",
    });
    s = finish(choose(s, h[1].id));
    expect(s.player.hand.map((p) => p.id)).toEqual([h[0].id, top.id]);
    expect(s.player.deck[0].id).toBe(h[1].id);
    expect(s.player.deck[1].id).toBe(second.id);
    expect(s.player.discard).toHaveLength(0);
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "smooth-talker",
      }).error,
    ).toBeTruthy();
    conserved(s, [...h, top, second]);
  });

  it("Smooth Talker cannot use an absent top card or fire in hero form", () => {
    let s = base("stld");
    hand(s, "17005");
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "smooth-talker",
      }).error,
    ).toBeTruthy();
    s.player.form = "alter";
    s.player.deck = [];
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "smooth-talker",
      }).error,
    ).toBeTruthy();
  });
});

describe("Star-Lord's native facedown encounter costs", () => {
  it("What could go wrong makes a three-cost hand upgrade playable, committing a real encounter card first", () => {
    let s = base("stld");
    const gun = hand(s, "17007")[0],
      encounter = s.encounter.deck[0];
    expect(playable(s, gun)).toBeNull();
    s = command(s, { type: "PLAY", id: gun.id });
    s = respond(s, /What could go wrong/i);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === gun.id)?.code).toBe("17007");
    expect(s.encounter.dealt.find((p) => p.id === encounter.id)?.dealtTo).toBe(
      "p1",
    );
    expect(s.encounter.deck.some((p) => p.id === encounter.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === encounter.id)).toBe(false);
    conserved(s, [gun]);
  });

  it("What could go wrong leaves an actual two-resource payment for Nova Prime", () => {
    let s = base("stld");
    const h = hand(s, "17002", "18022");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = respond(s, /What could go wrong/i);
    expect(s.prompt).toMatchObject({ kind: "payment", cost: 2 });
    s = finish(command(s, { type: "PAY", ids: [h[1].id] }));
    expect(s.player.inPlay.some((p) => p.id === h[0].id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(1);
    conserved(s, h);
  });

  it("the cost interrupt cannot be used twice in the same round", () => {
    let s = base("stld");
    const gun = hand(s, "17007")[0];
    s = command(s, { type: "PLAY", id: gun.id });
    s = finish(respond(s, /What could go wrong/i));
    const boots = hand(s, "17008")[0];
    expect(playable(s, boots)).toBeTruthy();
    expect(
      dispatch(reload(s), { type: "PLAY", id: boots.id }).error,
    ).toBeTruthy();
    expect(s.encounter.dealt).toHaveLength(1);
  });

  it("the round boundary restores the cost interrupt while preserving controlled cards", () => {
    let s = base("stld");
    const gun = hand(s, "17007")[0];
    s = command(s, { type: "PLAY", id: gun.id });
    s = finish(respond(s, /What could go wrong/i));
    s.phase = "villain";
    s = finish(native(s, { type: "newRound" }));
    const boots = hand(s, "17008")[0];
    s = command(s, { type: "PLAY", id: boots.id });
    s = finish(respond(s, /What could go wrong/i));
    expect(s.encounter.dealt).toHaveLength(2);
    conserved(s, [gun, boots]);
  });

  it("a canceled ordinary payment keeps the dealt encounter cost and round limit", () => {
    let s = base("stld");
    const h = hand(s, "17002", "18022");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = respond(s, /What could go wrong/i);
    s = command(s, { type: "CANCEL" });
    expect(s.player.hand.some((p) => p.id === h[0].id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.inPlay).toHaveLength(0);
    // The reduction was committed to the canceled attempt, not this same card forever.
    expect(playable(s, h[0])).toBeTruthy();
    const gun = hand(s, "17007")[0];
    expect(playable(s, gun)).toBeTruthy();
  });

  it("Daring Escape pays its actual facedown cost before readying and drawing the exact top card", () => {
    let s = base("stld");
    s.player.exhausted = true;
    const event = hand(s, "17003")[0],
      top = s.player.deck[0],
      encounter = s.encounter.deck[0];
    s = finish(play(s, event));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual([top.id]);
    expect(s.encounter.dealt.find((p) => p.id === encounter.id)?.dealtTo).toBe(
      "p1",
    );
    conserved(s, [event, top]);
  });

  it("Gutsy Move reads only that player's current facedown cards after the play-cost interrupt", () => {
    let s = base("stld", "gam");
    facedown(s, 1);
    facedown(s, 3, "p2");
    s.scheme.threat = 10;
    const event = hand(s, "17004")[0];
    s = command(s, { type: "PLAY", id: event.id });
    s = respond(s, /What could go wrong/i);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(4);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1")).toHaveLength(2);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p2")).toHaveLength(3);
  });

  it("Sliding Shot requires an actual controlled Element Gun and scales with facedown cards", () => {
    let s = base("stld");
    const h = hand(s, "17005", "18022", "18021");
    expect(playable(s, h[0])).toBeTruthy();
    put(s, "17007");
    facedown(s, 2);
    s = finish(target(play(s, h[0], [h[1], h[2]]), "villain"));
    expect(s.villain.hp).toBe(41);
    conserved(s, h);
  });
});

describe("Star-Lord's native upgrades and ally responses", () => {
  it("Element Gun exhausts and pays an actual resource, then pierces Tough", () => {
    let s = base("stld");
    const gun = put(s, "17007"),
      payment = hand(s, "17004")[0];
    s.villain.tough = true;
    s = command(s, { type: "ABILITY", id: gun.id, action: "element-gun" });
    expect(s.prompt).toMatchObject({ kind: "payment", cost: 1 });
    expect(s.player.inPlay.find((p) => p.id === gun.id)?.exhausted).toBe(true);
    s = command(s, { type: "PAY", ids: [payment.id] });
    s = finish(target(s, "villain"));
    expect(s.villain.tough).toBe(false);
    expect(s.villain.hp).toBe(47);
    conserved(s, [gun, payment]);
  });

  it("Stunned cancels Element Gun's attack after its exhaust/resource costs", () => {
    let s = base("stld");
    const gun = put(s, "17007"),
      payment = hand(s, "17004")[0];
    s.player.stunned = true;
    s = command(s, { type: "ABILITY", id: gun.id, action: "element-gun" });
    s = finish(command(s, { type: "PAY", ids: [payment.id] }));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === gun.id)?.exhausted).toBe(true);
    conserved(s, [gun, payment]);
  });

  it("Jet Boots grants Aerial in hero form and prevents only the owner's current facedown count", () => {
    let s = base("stld", "gam");
    const boots = put(s, "17008");
    facedown(s, 2);
    facedown(s, 4, "p2");
    expect(aerial(s)).toBe(true);
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: "fixture",
    });
    s = finish(respond(s, /Jet Boots/i, "17008"));
    expect(s.player.hp).toBe(8);
    expect(s.player.inPlay.find((p) => p.id === boots.id)?.exhausted).toBe(
      true,
    );
    s.player.form = "alter";
    expect(aerial(s)).toBe(false);
  });

  it("Tough prevents damage before Jet Boots is offered or exhausted", () => {
    let s = base("stld");
    const boots = put(s, "17008");
    facedown(s, 2);
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
    expect(s.player.inPlay.find((p) => p.id === boots.id)?.exhausted).toBe(
      false,
    );
  });

  it("Star-Lord's Helmet counts owned facedown cards, caps at three, and stops in alter-ego", () => {
    let s = base("stld", "gam");
    put(s, "17010");
    facedown(s, 2);
    facedown(s, 5, "p2");
    expect(handSize(s)).toBe(7);
    facedown(s, 3);
    expect(handSize(s)).toBe(8);
    s = command(s, { type: "FLIP" });
    expect(handSize(s)).toBe(6);
  });

  it("Leader of the Guardians uses dynamically granted ally traits and printed Guardian traits", () => {
    let s = base("stld");
    put(s, "17009");
    const bill = put(s, "17012"),
      yondu = put(s, "17013");
    expect(heroStats(s).thwart).toBe(3);
    s = finish(
      target(
        command(s, { type: "ABILITY", id: bill.id, action: "thwart" }),
        "main",
      ),
    );
    expect(s.scheme.threat).toBe(4);
    s = command(s, { type: "FLIP" });
    s.player.inPlay.find((p) => p.id === bill.id)!.exhausted = false;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: bill.id, action: "thwart" }),
        "main",
      ),
    );
    expect(s.scheme.threat).toBe(3);
    s = finish(
      target(
        command(s, { type: "ABILITY", id: yondu.id, action: "thwart" }),
        "main",
      ),
    );
    expect(s.scheme.threat).toBe(0);
  });

  it("Nova Prime defeats an Ultron Drone and returns its captured physical source card to discard", () => {
    let s = base("stld");
    s.flags.starlordCostRound = s.round;
    s = native(s, { type: "drone" });
    const drone = s.minions.find((p) => p.code === "drone")!;
    const captured = drone.droneCard!;
    const [nova, energy, genius, strength] = hand(
      s,
      "17002",
      "01088",
      "01089",
      "01090",
    );
    s = play(s, nova, [energy, genius, strength]);
    s = respond(s, /Nova Prime/);
    s = finish(target(s, drone.id));
    expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === captured.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === nova.id)).toBe(true);
  });
  it("Nova Prime explicitly defeats a Tough non-Elite minion after actual hand play", () => {
    let s = base("stld");
    const enemy = minion(s),
      elite = minion(s, "17026"),
      h = hand(s, "17002", "18021", "18022", "18023");
    enemy.tough = true;
    s = play(s, h[0], h.slice(1));
    s = respond(s, /Nova Prime/i, "17002");
    expect(s.prompt?.options.some((o) => o.id === elite.id)).not.toBe(true);
    s = finish(target(s, enemy.id));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.minions.some((p) => p.id === elite.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === enemy.id)).toBe(true);
    conserved(s, h);
  });

  it("Bad Boy prevents all villain attack damage before its forced form change and actual draw", () => {
    let s = base("stld");
    const boy = put(s, "17006"),
      top = s.player.deck.slice(0, 2);
    s = choose(native(s, { type: "enemyAttack", id: "villain" }), "take");
    s = finish(respond(s, /Bad Boy/i, "17006"));
    expect(s.player.hp).toBe(10);
    expect(s.player.form).toBe("alter");
    expect(s.player.hand.map((p) => p.id)).toEqual(top.map((p) => p.id));
    expect(s.player.discard.some((p) => p.id === boy.id)).toBe(true);
    conserved(s, [boy, ...top]);
  });

  it("Bad Boy cannot interrupt damage from an actual minion attack", () => {
    let s = base("stld");
    const boy = put(s, "17006"),
      enemy = minion(s);
    s = finish(
      choose(native(s, { type: "enemyAttack", id: enemy.id }), "take"),
    );
    expect(s.player.hp).toBe(8);
    expect(s.player.form).toBe("hero");
    expect(s.player.inPlay.some((p) => p.id === boy.id)).toBe(true);
  });
});

describe("Star-Lord's actual obligation and nemesis dispatch", () => {
  it("Banishment may remove its physical card for an alter-ego exhaust", () => {
    let s = base("stld");
    const obligation = owned(s, "17024");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "flip");
    s = finish(choose(s, "remove"));
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
  });

  it("Banishment chooses one actual controlled Gun and keeps the other physical copy", () => {
    let s = base("stld");
    const a = put(s, "17007"),
      b = put(s, "17007"),
      obligation = owned(s, "17024");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(s, "stay");
    s = choose(s, "discard");
    s = finish(choose(s, a.id));
    expect(s.player.inPlay.some((p) => p.id === b.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === a.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
    expect(s.scheme.threat).toBe(6);
    conserved(s, [a, b]);
  });

  it("Banishment places three threat when no actual Gun can be discarded", () => {
    let s = base("stld");
    s.scheme.threat = 0;
    s = native(s, { type: "reveal", piece: owned(s, "17024"), skip: true });
    s = finish(choose(choose(s, "stay"), "discard"));
    expect(s.scheme.threat).toBe(3);
  });

  it("Budding Crime Syndicate applies its printed Hinder per starting player", () => {
    let s = base("stld", "gam");
    const scheme = owned(s, "17025");
    s = finish(native(s, { type: "reveal", piece: scheme, skip: true }));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(6);
  });

  it("Spartoi Cunning discards one actual hand card, damages the revealing hero, and adds threat", () => {
    let s = base("stld");
    s.scheme.threat = 0;
    const h = hand(s, "17004", "17005");
    s = finish(
      native(s, { type: "reveal", piece: owned(s, "17027"), skip: true }),
    );
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.discard).toHaveLength(1);
    expect(s.player.hp).toBe(9);
    expect(s.scheme.threat).toBe(1);
    conserved(s, h);
  });

  it("Mister Knife gives Surge to exactly the first treachery revealed by his engaged player in the villain phase", () => {
    let s = base("stld");
    s.phase = "villain";
    s.scheme.threat = 0;
    minion(s, "17026");
    const top = s.encounter.deck[0];
    s = finish(
      native(s, { type: "reveal", piece: owned(s, "17027"), skip: true }),
      (v) =>
        v.prompt?.options.find((o) => o.id === "text" || o.id === "surge")?.id,
    );
    expect(s.encounter.dealt.map((p) => p.id)).toEqual([top.id]);
    s = finish(
      native(s, { type: "reveal", piece: owned(s, "17027"), skip: true }),
      (v) =>
        v.prompt?.options.find((o) => o.id === "text" || o.id === "surge")?.id,
    );
    expect(s.encounter.dealt).toHaveLength(1);
  });

  it("a treachery revealed before Mister Knife entered still consumes the engaged player's first-treachery timing", () => {
    let s = base("stld");
    s.phase = "villain";
    s.scheme.threat = 0;
    s = finish(
      native(s, { type: "reveal", piece: owned(s, "17027"), skip: true }),
    );
    minion(s, "17026");
    s = finish(
      native(s, { type: "reveal", piece: owned(s, "17027"), skip: true }),
    );
    expect(s.encounter.dealt).toHaveLength(0);
  });

  it("Mister Knife's gained Surge does not stack with Surge gained by the same treachery's text", () => {
    let s = base("stld");
    s.phase = "villain";
    minion(s, "17026");
    s.player.confused = true;
    s = finish(
      native(s, { type: "reveal", piece: owned(s, "01112"), skip: true }),
      (v) =>
        v.prompt?.options.find((o) => o.id === "text" || o.id === "surge")?.id,
    );
    expect(s.encounter.dealt).toHaveLength(1);
  });

  it("canceling the first treachery still consumes Mister Knife's first-reveal timing for its actual engaged player", () => {
    let s = base("stld", "spider_man");
    s.phase = "villain";
    s.scheme.threat = 0;
    minion(s, "17026", "p2");
    const cancel = owned(s, "01004", "p2"),
      resource = owned(s, "18022", "p2"),
      first = owned(s, "17027"),
      second = owned(s, "17027");
    seatView(s, "p2").player.hand.push(cancel, resource);
    s = native(s, {
      type: "reveal",
      piece: first,
      actorId: "p2",
      fromEncounterDeck: true,
    });
    s = choose(s, "01004");
    s = finish(command(s, { type: "PAY", ids: [resource.id] }));
    expect(s.encounter.dealt).toHaveLength(0);
    s = finish(
      native(s, { type: "reveal", piece: second, skip: true, actorId: "p2" }),
    );
    expect(s.encounter.dealt).toHaveLength(0);
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(
      s.encounter.discard.filter(
        (p) => p.id === first.id || p.id === second.id,
      ),
    ).toHaveLength(2);
    conserved(s, [cancel, resource], "p2");
  });
});
