import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { makePiece, newGame } from "../src/game/engine.js";
import { nickFurySuit } from "../src/game/nick-fury.js";
import { activateSeat, seatView, syncSeat } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  finish,
  native,
  pay,
  reload,
  respond,
  target,
} from "./dv-test-helpers.js";

type Hero = { heroId: string; aspect: Aspect };
const maria: Hero = { heroId: "maria_hill", aspect: "leadership" };
const nick: Hero = { heroId: "nick_fury", aspect: "justice" };
const magneto: Hero = { heroId: "magneto", aspect: "leadership" };
const iceman: Hero = { heroId: "iceman", aspect: "aggression" };

function base(first: Hero, second: Hero) {
  let s = newGame({
    ...first,
    heroes: [first, second],
    villainId: "rhino",
    module: "bomb_scare",
    seed: 50049,
    pacing: "expert",
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const view = seatView(s, seat);
    const permanent = view.player.inPlay.filter((p) =>
      ["50035a", "50035b"].includes(p.code),
    );
    view.player.deck = [
      ...view.player.deck,
      ...view.player.hand,
      ...view.player.discard,
      ...view.player.inPlay.filter((p) => !permanent.includes(p)),
    ];
    expect(view.player.deck).toHaveLength(40);
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = permanent;
    view.player.form = "hero";
    view.player.exhausted = false;
    view.player.flipped = false;
  }
  syncSeat(s);
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.attack = null;
  delete s.scheming;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.environments = [];
  s.villain.hp = s.villain.maxHp = 90;
  s.scheme.threat = 3;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01107"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}

/** Move an existing source instance; these fixtures never manufacture a player card. */
function take(s: GameState, playerId: string, code: string): Piece {
  const p = seatView(s, playerId).player;
  for (const zone of [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []]) {
    const i = zone.findIndex((q) => q.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original source ${playerId}:${code}`);
}
function put(s: GameState, playerId: string, code: string) {
  const p = take(s, playerId, code);
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function hand(s: GameState, playerId: string, code: string) {
  const p = take(s, playerId, code);
  seatView(s, playerId).player.hand.push(p);
  return p;
}
function pieces(s: GameState): Piece[] {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
  ];
}
function sourceIds(s: GameState) {
  return s.players.flatMap((seat) =>
    seatView(s, seat).player.deck.map((p) => p.id),
  );
}
function conserve(s: GameState, ids: string[]) {
  const all = pieces(s);
  for (const id of ids)
    expect(
      all.filter((p) => p.id === id),
      `original source ${id}`,
    ).toHaveLength(1);
}

describe("batch 5 merged native cross-pack acceptance", () => {
  it("Magnetic Missile discards the same owned Controlled player card without its defeat penalty", () => {
    let s = base(magneto, maria);
    const ids = sourceIds(s),
      controlled = take(s, "p2", "50007"),
      environment = take(s, "p2", "50032"),
      wrapped = put(s, "p1", "49007"),
      event = hand(s, "p1", "49010"),
      resource = hand(s, "p1", "49024");
    controlled.mariaControlled = true;
    controlled.engagedWith = "p1";
    controlled.damage = 0;
    controlled.counters = 0;
    s.minions.push(controlled);
    s.environments!.push(environment);
    wrapped.attachedTo = controlled.id;
    const threat = s.scheme.threat;
    s = command(reload(s), { type: "PLAY", id: event.id });
    s = pay(s, [resource]);
    s = target(s, controlled.id);
    s = finish(target(s, s.villain.id));
    const returned = seatView(s, "p2").player.discard.find(
      (p) => p.id === controlled.id,
    );
    expect(returned).toMatchObject({
      id: controlled.id,
      code: "50007",
      ownerId: "p2",
    });
    expect(returned?.mariaControlled).toBeFalsy();
    expect(s.minions.some((p) => p.id === controlled.id)).toBe(false);
    expect(s.scheme.threat).toBe(threat);
    expect(s.villain.hp).toBe(85);
    expect(s.villain.stunned).toBe(true);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === wrapped.id),
    ).toBe(true);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === event.id),
    ).toBe(true);
    expect(pieces(s).filter((p) => p.id === controlled.id)).toHaveLength(1);
    conserve(reload(s), ids);
  });

  it("Super Spies distributes across a teammate's support and suit without converting AP counters into threat", () => {
    let s = base(maria, nick);
    const ids = sourceIds(s),
      event = hand(s, "p1", "50024"),
      support = put(s, "p2", "50057"),
      suit = nickFurySuit(seatView(s, "p2"))!,
      nickEvent = seatView(s, "p2").player.deck.find(
        (p) => p.code === "50024",
      )!;
    expect(nickEvent.id).not.toBe(event.id);
    suit.counters = 2;
    s = command(reload(s), { type: "PLAY", id: event.id });
    s = choose(reload(s), `${support.id}:counter`);
    s = choose(reload(s), `${suit.id}:counter`);
    s = finish(choose(reload(s), `${suit.id}:threat`));
    const view = seatView(s, "p2"),
      actualSupport = view.player.inPlay.find((p) => p.id === support.id)!,
      actualSuit = nickFurySuit(view)!;
    expect(actualSupport).toMatchObject({
      id: support.id,
      code: "50057",
      ownerId: "p2",
      counters: 1,
    });
    expect(actualSupport.nickThreatTokens || 0).toBe(0);
    expect(actualSuit).toMatchObject({
      id: suit.id,
      code: "50035a",
      ownerId: "p2",
      counters: 3,
      nickAllPurposeCounters: 1,
    });
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === event.id),
    ).toHaveLength(1);
    expect(view.player.deck.some((p) => p.id === nickEvent.id)).toBe(true);
    expect(pieces(s).filter((p) => p.id === suit.id)).toHaveLength(1);
    expect(s.scheme.threat).toBe(3);
    expect(reload(s)).toEqual(s);
    conserve(s, ids);
  });

  it("Nick's completed Stealth scheme returns Iceman's actual Frostbite, while Stunned retains it", () => {
    for (const stunned of [false, true]) {
      let s = base(nick, iceman);
      const ids = sourceIds(s),
        suit = nickFurySuit(s)!,
        frostbite = seatView(s, "p2").player.setAside!.find(
          (p) => p.code === "46002",
        )!;
      suit.code = "50035b";
      activateSeat(s, "p2");
      s.turnPlayerId = "p2";
      s = command(s, { type: "BASIC", action: "attack" });
      s = target(s, s.villain.id);
      s = finish(respond(s, /Freeze!/));
      expect(
        seatView(s, "p2").player.inPlay.find((p) => p.id === frostbite.id)
          ?.attachedTo,
      ).toBe(s.villain.id);
      expect(
        seatView(s, "p2").player.setAside!.filter((p) => p.code === "46002"),
      ).toHaveLength(5);
      activateSeat(s, "p1");
      s.turnPlayerId = "p1";
      s.phase = "villain";
      s.villain.stunned = stunned;
      const hp = s.player.hp;
      s = finish(native(reload(s), { type: "enemyAttack", id: s.villain.id }));
      const owner = seatView(s, "p2").player,
        reserve = owner.setAside!.filter((p) => p.code === "46002"),
        attached = owner.inPlay.find((p) => p.id === frostbite.id);
      expect(s.player.hp).toBe(hp);
      expect(s.attack).toBeNull();
      expect(s.scheming).toBeFalsy();
      if (stunned) {
        expect(s.villain.stunned).toBe(false);
        expect(attached).toMatchObject({
          id: frostbite.id,
          code: "46002",
          ownerId: "p2",
          attachedTo: s.villain.id,
        });
        expect(reserve).toHaveLength(5);
        expect(nickFurySuit(seatView(s, "p1"))!.counters).toBe(0);
        expect(s.scheme.threat).toBe(3);
      } else {
        expect(attached).toBeUndefined();
        expect(reserve).toHaveLength(6);
        expect(reserve.find((p) => p.id === frostbite.id)).toMatchObject({
          id: frostbite.id,
          code: "46002",
          ownerId: "p2",
        });
        expect(nickFurySuit(seatView(s, "p1"))!.counters).toBe(1);
        expect(s.scheme.threat).toBe(4);
        expect(s.log.some((l) => /schemes for 2 threat/.test(l.text))).toBe(
          true,
        );
      }
      expect(owner.discard.some((p) => p.id === frostbite.id)).toBe(false);
      expect(pieces(s).filter((p) => p.id === frostbite.id)).toHaveLength(1);
      expect(card(frostbite).name).toBe("Frostbite");
      conserve(reload(s), ids);
    }
  });
});
