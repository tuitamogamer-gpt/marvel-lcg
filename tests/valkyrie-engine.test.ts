/** Native original Valkyrie source, physical Death-Glow and current encounter rules. */
import { describe, expect, it } from "vitest";
import {
  aerial,
  card,
  deckCodes,
  heroStats,
  maxHP,
} from "../src/game/cards.js";
import { STARTER_DECKS, catalogDeckCodes } from "../src/game/catalog.js";
import { adviseAction } from "../src/game/advisor.js";
import {
  dispatch,
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
  playable,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  finish,
  hand,
  minion,
  native,
  pay,
  physical,
  play,
  put,
  reload,
  respond,
  side,
  target,
  until,
} from "./dv-test-helpers.js";
const starting = (other?: "spider_man", valkSeat = "p1") =>
  newGame({
    heroId: "valk",
    aspect: "aggression",
    villainId: "rhino",
    pacing: "expert",
    seed: 25001,
    ...(other
      ? {
          heroes:
            valkSeat === "p1"
              ? [
                  { heroId: "valk", aspect: "aggression" },
                  { heroId: other, aspect: "justice" },
                ]
              : [
                  { heroId: other, aspect: "justice" },
                  { heroId: "valk", aspect: "aggression" },
                ],
        }
      : {}),
  });
function source(s: GameState, seat = s.activePlayerId) {
  const v = seatView(s, seat);
  return [
    ...physical(s, seat),
    ...(v.player.setAside || []).filter(
      (p) => card(p).faction_code !== "encounter",
    ),
  ];
}
function exact(s: GameState, pieces: Piece[], seat = s.activePlayerId) {
  const all = source(s, seat);
  for (const p of pieces)
    expect(
      all.filter((q) => q.id === p.id),
      p.code + ":" + p.id,
    ).toHaveLength(1);
}
function base(other?: "spider_man", valkSeat = "p1") {
  let s = starting(other, valkSeat);
  for (const seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const view = seatView(s, seat),
      cards = physical(s, seat.id);
    view.player.deck = cards;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.form = "hero";
    view.player.exhausted = false;
    view.player.flipped = false;
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01174"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 8;
  activateSeat(s, valkSeat);
  s.turnPlayerId = valkSeat;
  return s;
}
function glow(s: GameState, enemy = s.villain.id) {
  const p = s.player.setAside!.find((p) => p.code === "25002")!;
  s.player.setAside = s.player.setAside!.filter((q) => q.id !== p.id);
  s.player.inPlay.push(p);
  p.attachedTo = enemy;
  return p;
}
function actualEncounter(s: GameState, code: string) {
  const p = s.player.setAside!.find((p) => p.code === code)!;
  s.player.setAside = s.player.setAside!.filter((q) => q.id !== p.id);
  return p;
}
function reveal(s: GameState, p: Piece) {
  return native(s, { type: "reveal", piece: p });
}

describe("Valkyrie actual retail setup and Death Perception", () => {
  it("creates all41 actual source IDs, sets the original Death-Glow aside before the opening hand, and initializes five real nemeses", () => {
    const s = starting(),
      starter = STARTER_DECKS.find((d) => d.id === "starter-25001a")!;
    expect(deckCodes("valk", "aggression").sort()).toEqual(
      catalogDeckCodes(starter).sort(),
    );
    expect(source(s)).toHaveLength(41);
    expect(physical(s)).toHaveLength(40);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "25002",
      "25029",
      "25030",
      "25031",
      "25032",
      "25032",
    ]);
    expect(new Set(source(s).map((p) => p.id)).size).toBe(41);
    expect(s.player.hand.some((p) => p.code === "25002")).toBe(false);
    expect(s.player.hp).toBe(12);
  });
  it("normal paid PLAY and cancellation keep Death-Glow's physical set-aside ID and source41", () => {
    let s = base();
    const original = source(s),
      p = s.player.setAside!.find((p) => p.code === "25002")!;
    const [r] = hand(s, "25024");
    s = command(s, {
      type: "ABILITY",
      id: "identity",
      action: "play-death-glow",
    });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.card?.id).toBe(p.id);
    const cancelled = command(reload(s), { type: "CANCEL" });
    expect(cancelled.player.setAside?.some((q) => q.id === p.id)).toBe(true);
    expect(cancelled.player.hand.map((q) => q.id)).toContain(r.id);
    s = finish(pay(reload(s), [r]));
    expect(s.player.inPlay.find((q) => q.id === p.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.player.setAside?.some((q) => q.id === p.id)).toBe(false);
    exact(s, original);
  });
  it("actual Brunnhilde action detaches the same card directly to setAside and can play it again later", () => {
    let s = base();
    const p = glow(s);
    p.counters = 3;
    p.damage = 2;
    s = command(s, { type: "FLIP" });
    s = command(s, {
      type: "ABILITY",
      id: "identity",
      action: "detach-death-glow",
    });
    expect(s.player.setAside?.find((q) => q.id === p.id)).toMatchObject({
      counters: 0,
      damage: 0,
    });
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(false);
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
    exact(s, [p]);
  });
  it("Death Perception is an actual paid Hero Action during a teammate's turn", () => {
    let s = base("spider_man", "p2");
    const p = s.player.setAside!.find((p) => p.code === "25002")!,
      [r] = hand(s, "25024");
    s.turnPlayerId = "p1";
    activateSeat(s, "p1");
    s = command(s, {
      type: "ABILITY",
      playerId: "p2",
      id: "identity",
      action: "play-death-glow",
    });
    expect(s.prompt?.kind).toBe("payment");
    s = finish(pay(s, [r]));
    expect(
      seatView(s, "p2").player.inPlay.find((q) => q.id === p.id)?.attachedTo,
    ).toBe(s.villain.id);
    expect(s.activePlayerId).toBe("p1");
    exact(s, [p, r], "p2");
  });
});

describe("Valkyrie actual target-scoped stats and defeat timing", () => {
  it("adds Dragonfang's second ATK only against the Death-Glow target and keeps fixed Have at Thee7 unchanged", () => {
    for (const marked of [false, true]) {
      let s = base();
      const original = source(s),
        sword = put(s, "25006"),
        m = minion(s, "01131"),
        p = glow(s, marked ? m.id : s.villain.id);
      expect(heroStats(s).attack).toBe(3);
      s = command(s, { type: "BASIC", action: "attack" });
      s = finish(target(s, m.id));
      expect(s.minions.find((q) => q.id === m.id)?.damage).toBe(marked ? 4 : 3);
      exact(s, original);
    }
    let s = base();
    const sword = put(s, "25006"),
      m = minion(s, "01131"),
      p = glow(s, m.id),
      [event, a, b] = hand(s, "25012", "25024", "25025");
    s = finish(target(play(s, event, [a, b]), m.id));
    expect(s.minions.some((q) => q.id === m.id)).toBe(false);
    expect(s.villain.hp).toBe(49);
    exact(s, [sword, p, event, a, b]);
  });
  it("captures Death-Glow before physical enemy cleanup, readies first, then resolves saved Valhalla and both Flight copies", () => {
    let s = base();
    const original = source(s),
      m = minion(s, "01103"),
      p = glow(s, m.id),
      sword = put(s, "25006"),
      hall = put(s, "25004"),
      flights = [put(s, "25008"), put(s, "25008")];
    s.player.hp = 10;
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, m.id);
    s = until(s, (v) => v.prompt?.title === "Death-Glow defeat responses");
    expect(s.player.exhausted).toBe(false);
    expect(s.player.setAside?.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(false);
    s = choose(reload(s), hall.id);
    expect(s.player.hp).toBe(11);
    for (const flight of flights) {
      s = choose(reload(s), flight.id);
      s = target(s, "main");
    }
    s = finish(s);
    expect(s.scheme.threat).toBe(0);
    expect(s.player.inPlay.find((q) => q.id === hall.id)?.exhausted).toBe(true);
    expect(
      s.player.discard.filter((q) => flights.some((p) => p.id === q.id)),
    ).toHaveLength(2);
    exact(s, original);
  });
  it("an ally's actual defeat of the marked enemy sets Glow aside without readying Valkyrie or offering Valhalla", () => {
    let s = base();
    const m = minion(s, "01103"),
      p = glow(s, m.id),
      hall = put(s, "25004"),
      ally = put(s, "25003");
    s.player.exhausted = true;
    s = finish(
      native(s, {
        type: "damage",
        target: m.id,
        amount: 3,
        source: ally.id,
        attack: true,
      }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.player.setAside?.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.inPlay.find((q) => q.id === hall.id)?.exhausted).toBe(
      false,
    );
    exact(s, [p, hall, ally]);
  });
  it("discarding a marked enemy performs no defeat response and sends attached Glow to its ordinary discard", () => {
    let s = base();
    const m = minion(s, "01103"),
      p = glow(s, m.id);
    s.player.exhausted = true;
    s = finish(native(s, { type: "discardPiece", id: m.id }));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.setAside?.some((q) => q.id === p.id)).toBe(false);
    exact(s, [p]);
  });
  it("defeating a marked villain stage commits the physical forced interrupt before stage advancement", () => {
    let s = base();
    const p = glow(s);
    s.villain.hp = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(target(s, s.villain.id));
    expect(s.villain.stage).toBe(2);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.setAside?.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(false);
    exact(s, [p]);
  });
  it("Aragorn grants actual +4 current/maxHP and Aerial in both forms, then reduces the wounded dial on actual leave", () => {
    let s = base();
    const [p, a, b] = hand(s, "25007", "25024", "25025");
    s = finish(play(s, p, [a, b]));
    expect(s.player.hp).toBe(16);
    expect(maxHP(s)).toBe(16);
    expect(aerial(s)).toBe(true);
    s = command(s, { type: "FLIP" });
    expect(maxHP(s)).toBe(16);
    expect(aerial(s)).toBe(true);
    s.player.hp = 10;
    s = finish(native(s, { type: "discardPiece", id: p.id }));
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(6);
    expect(aerial(s)).toBe(false);
    exact(s, [p, a, b]);
  });
});

describe("Valkyrie Shieldmaiden, actual searches and original encounter faces", () => {
  it("actual Shadows moves the same five nemesis IDs and Enchantress attaches a real set-aside Seduced", () => {
    let s = base();
    const nemeses = s.player.setAside!.filter(
        (p) => card(p).faction_code === "encounter",
      ),
      glow = s.player.setAside!.find((p) => p.code === "25002")!;
    s = finish(reveal(s, makePiece(s, "01190")));
    expect(s.minions.find((p) => p.code === "25029")?.id).toBe(
      nemeses.find((p) => p.code === "25029")!.id,
    );
    expect(s.sideSchemes.find((p) => p.code === "25030")?.id).toBe(
      nemeses.find((p) => p.code === "25030")!.id,
    );
    const seduced = s.attachments.find((p) => p.code === "25032")!;
    expect(nemeses.map((p) => p.id)).toContain(seduced.id);
    expect(seduced.attachedTo).toBe("hero:p1");
    expect(s.player.setAside?.map((p) => p.id)).toEqual([glow.id]);
    const zones = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.attachments,
      ...s.encounter.deck,
      ...s.encounter.discard,
      ...s.resolving,
    ];
    for (const p of nemeses)
      expect(zones.filter((q) => q.id === p.id)).toHaveLength(1);
    exact(s, [glow]);
  });
  it("paid p2 Shieldmaiden declares an already exhausted Valkyrie with marked Spear DEF5 before native boosts", () => {
    let s = base("spider_man", "p2");
    const spear = put(s, "25005"),
      p = glow(s),
      [event, r] = hand(s, "25011", "25024");
    s.player.exhausted = true;
    activateSeat(s, "p1");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    const opt = s.prompt?.options.find((o) => o.image === "25011")!;
    expect(opt).toBeTruthy();
    s = choose(reload(s), opt.id);
    expect(s.activePlayerId).toBe("p2");
    s = pay(s, [r]);
    s = finish(s);
    expect(seatView(s, "p2").player.hp).toBe(12);
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(
      seatView(s, "p2").player.discard.some((q) => q.id === event.id),
    ).toBe(true);
    expect(s.log.some((entry) => entry.text.includes("5 DEF"))).toBe(true);
    exact(s, [spear, p, event, r], "p2");
  });
  it("Chooser puts an actual Quickstrike minion without reveal and completes the entry cost before drawing2", () => {
    let s = base();
    const [event] = hand(s, "25010"),
      m = makePiece(s, "23029");
    s.encounter.deck.unshift(m);
    const oldHand = s.player.hand.length,
      top = s.player.deck.slice(0, 2).map((p) => p.id);
    s = play(s, event);
    s = choose(s, m.id);
    expect(s.prompt?.title).toContain("Living Laser attacks");
    expect(s.player.hand).toHaveLength(oldHand - 1);
    s = finish(choose(s, "take"));
    expect(s.player.hp).toBe(10);
    expect(s.player.hand.map((p) => p.id)).toEqual(top);
    expect(s.minions.find((p) => p.id === m.id)?.engagedWith).toBe("p1");
    exact(s, [event]);
  });
  it("a saved Annabelle action exhausts the actual source and retrieves only an actual signature among the searched five", () => {
    let s = base();
    s.player.form = "alter";
    const annabelle = put(s, "25003"),
      chosen = s.player.deck.find((p) => p.code === "25012")!;
    s.player.deck = [
      chosen,
      ...s.player.deck.filter((p) => p.id !== chosen.id),
    ];
    s = command(s, {
      type: "ABILITY",
      id: annabelle.id,
      action: "annabelle-search",
    });
    expect(s.player.inPlay.find((p) => p.id === annabelle.id)?.exhausted).toBe(
      true,
    );
    expect(
      s.prompt?.options.every(
        (o) => o.id === "none" || card(o.image!).set_code === "valk",
      ),
    ).toBe(true);
    s = finish(choose(reload(s), chosen.id));
    expect(s.player.hand.map((p) => p.id)).toContain(chosen.id);
    exact(s, [annabelle, chosen]);
  });
  it("the advisor chooses a legal thwart under Seduced and preserves Stun and original source IDs", () => {
    let s = base();
    const original = source(s),
      seduced = actualEncounter(s, "25032");
    s = finish(reveal(s, seduced));
    s.scheme.threat = 1;
    s.player.stunned = true;
    const advice = adviseAction(reload(s));
    expect(advice?.command).toEqual({ type: "BASIC", action: "thwart" });
    s = finish(command(reload(s), advice!.command));
    expect(s.scheme.threat).toBe(0);
    expect(s.player.stunned).toBe(true);
    expect(s.player.exhausted).toBe(true);
    exact(s, original);
    s.player.exhausted = false;
    s.player.flipped = true;
    expect(adviseAction(reload(s))?.command).not.toEqual({
      type: "BASIC",
      action: "attack",
    });
    expect(s.player.stunned).toBe(true);
  });
  it("Seduced prevents a stunned basic attack and Attack-event play; Powerful Enchantments blocks generic friendly attachment discard", () => {
    let s = base();
    const seduced = actualEncounter(s, "25032");
    s = finish(reveal(s, seduced));
    s.player.stunned = true;
    const [event] = hand(s, "25012");
    expect(playable(s, event)).toMatch(/Seduced/);
    const refused = dispatch(reload(s), {
      type: "BASIC",
      action: "attack",
    });
    expect(refused.error).toMatch(/Seduced/);
    expect(refused.player.stunned).toBe(true);
    side(s, "25030");
    const blocked = dispatch(
      {
        ...reload(s),
        queue: [{ type: "discardPiece", id: seduced.id }],
        prompt: {
          kind: "choice",
          title: "fixture",
          text: "",
          options: [{ id: "go", label: "go", effects: [] }],
        },
      },
      { type: "CHOOSE", id: "go" },
    );
    expect(blocked.error).toMatch(/Powerful Enchantments/);
    expect(blocked.attachments.some((p) => p.id === seduced.id)).toBe(true);
  });
  it("actual Beguiled converts the highest-cost ally with the same ID and restores its original controller after re-engagement", () => {
    let s = base("spider_man");
    const ally = put(s, "01084", "p2"),
      small = put(s, "25003"),
      beguiled = actualEncounter(s, "25031");
    ally.damage = 1;
    ally.counters = 2;
    s = choose(reveal(s, beguiled), ally.id);
    const transformed = s.minions.find((p) => p.id === ally.id)!;
    expect(card(transformed).type_code).toBe("minion");
    expect(card(transformed).scheme).toBe(card(ally.code).thwart);
    expect(card(transformed).text).toBe("");
    expect(card(transformed).traits).toContain("Enthralled");
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === ally.id)).toBe(
      false,
    );
    transformed.engagedWith = "p1";
    s = finish(native(reload(s), { type: "discardPiece", id: beguiled.id }));
    expect(s.minions.some((p) => p.id === ally.id)).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ally.id),
    ).toMatchObject({ damage: 1, counters: 2 });
    expect(
      card(seatView(s, "p2").player.inPlay.find((p) => p.id === ally.id)!)
        .type_code,
    ).toBe("ally");
    exact(s, [ally], "p2");
    exact(s, [small]);
  });
  it("a defeated Beguiled ally goes to its actual owner discard, never encounter discard or restoration", () => {
    let s = base("spider_man");
    const ally = put(s, "01084", "p2"),
      beguiled = actualEncounter(s, "25031");
    s = choose(reveal(s, beguiled), ally.id);
    s = finish(
      native(reload(s), {
        type: "damage",
        target: ally.id,
        amount: 4,
        source: "hero",
        attack: true,
      }),
    );
    expect(seatView(s, "p2").player.discard.some((p) => p.id === ally.id)).toBe(
      true,
    );
    expect(s.encounter.discard.some((p) => p.id === ally.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === beguiled.id)).toBe(true);
    expect(s.minions.some((p) => p.id === ally.id)).toBe(false);
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === ally.id)).toBe(
      false,
    );
    exact(s, [ally], "p2");
  });
  it("Nick Fury's existing end-of-round discard still removes the same physical Beguiled minion to its owner", () => {
    let s = base("spider_man");
    const ally = put(s, "01084", "p2"),
      beguiled = actualEncounter(s, "25031");
    s = choose(reveal(s, beguiled), ally.id);
    s.phase = "villain";
    s = finish(native(reload(s), { type: "newRound" }));
    expect(s.minions.some((p) => p.id === ally.id)).toBe(false);
    expect(seatView(s, "p2").player.discard.some((p) => p.id === ally.id)).toBe(
      true,
    );
    expect(s.encounter.discard.some((p) => p.id === ally.id)).toBe(false);
    const valk = seatView(s, "p1");
    expect(valk.flags.valkyrieSetupComplete).toBe(true);
    expect(valk.flags.valkyrieNemesisSetupComplete).toBe(true);
    expect(
      valk.player.setAside?.filter((p) => p.code === "25002"),
    ).toHaveLength(1);
    exact(s, [ally], "p2");
  });
});
