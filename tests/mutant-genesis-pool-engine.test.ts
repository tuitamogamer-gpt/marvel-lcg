/** Actual starter pieces, native commands, JSON reload at every decision. */
import { describe, expect, it } from "vitest";
import { card, heroStats, pieceHP } from "../src/game/cards.js";
import {
  abilityOptions,
  cardCost,
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { activateSeat, allInPlay, seatView } from "../src/game/team.js";
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
  respond,
  reload,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

type SourceState = GameState & { dvSourceIds?: Record<string, string[]> };
function base(
  heroId = "shadowcat",
  other?: "colossus" | "shadowcat" | "spider_man",
) {
  const aspect = heroId === "shadowcat" ? "aggression" : "protection";
  let s = newGame({
    heroId,
    aspect,
    villainId: "rhino",
    seed: 32041,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            { heroId, aspect },
            {
              heroId: other,
              aspect:
                other === "shadowcat"
                  ? ("aggression" as const)
                  : other === "colossus"
                    ? ("protection" as const)
                    : ("justice" as const),
            },
          ],
        }
      : {}),
  });
  for (let i = 0; i < s.players.length; i++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s, (v) =>
    /setup/i.test(v.prompt?.title || "")
      ? v.prompt?.options.find((o) => o.image === "32006")?.id
      : undefined,
  );
  const ids: Record<string, string[]> = {};
  for (const seat of s.players) {
    const v = seatView(s, seat),
      source = physical(s, seat.id),
      mass = source.filter((p) => ["32031a", "32031b"].includes(p.code));
    ids[seat.id] = source.map((p) => p.id);
    expect(source.filter((p) => !mass.includes(p))).toHaveLength(40);
    v.player.deck = source.filter((p) => !mass.includes(p));
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = mass;
    v.player.form = "hero";
    v.player.exhausted =
      v.player.flipped =
      v.player.tough =
      v.player.stunned =
      v.player.confused =
        false;
    v.player.toughCards = v.player.stunCards = v.player.confuseCards = 0;
  }
  (s as SourceState).dvSourceIds = ids;
  s.phase = "player";
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01186"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.scheme.threat = 12;
  s.villain.hp = s.villain.maxHp = 60;
  return s;
}
function actual(s: GameState, id: string) {
  return allInPlay(s).find((p) => p.id === id)!;
}
function beginTurn(s: GameState, playerId = s.activePlayerId) {
  return native(s, { type: "beginTurn", actorId: playerId });
}
function nextRound(s: GameState) {
  return native(s, { type: "newRound" });
}
function allyAttack(s: GameState, p: Piece, targetId = s.villain.id) {
  return target(
    command(s, { type: "ABILITY", id: p.id, action: "attack" }),
    targetId,
  );
}

describe("Mutant Genesis native player pool", () => {
  it("Team Strike cancellation before PAY keeps selected hero/allies and every resource ready", () => {
    let s = base();
    const w = put(s, "32041"),
      [event, energy] = hand(s, "32045", "32052");
    s = choose(command(s, { type: "PLAY", id: event.id }), w.id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.player.exhausted).toBe(false);
    expect(actual(s, w.id).exhausted).toBe(false);
    s = command(s, { type: "CANCEL" });
    expect(s.prompt).toBeNull();
    expect(s.player.exhausted).toBe(false);
    expect(actual(s, w.id).exhausted).toBe(false);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === energy.id)).toBe(true);
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.title).toBe("Team Strike");
    expect(s.prompt?.options.some((o) => o.id === w.id)).toBe(true);
  });
  it("Team Strike commits hero/allies and resource together before Aggressive Energy interrupt and PLAY", () => {
    let s = base();
    const w = put(s, "32041"),
      [event, energy] = hand(s, "32045", "32047");
    s = choose(command(s, { type: "PLAY", id: event.id }), w.id);
    expect(s.player.exhausted).toBe(false);
    expect(actual(s, w.id).exhausted).toBe(false);
    s = pay(s, [energy]);
    expect(s.prompt?.title).toBe("Aggressive Energy");
    expect(s.player.exhausted).toBe(true);
    expect(actual(s, w.id).exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    s = choose(s, "yes");
    s = target(s, s.villain.id);
    s = target(s, "6");
    s = finish(s);
    expect(s.villain.hp).toBe(54);
    expect(actual(s, w.id).damage).toBe(0);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Team Strike Stun replacement retains all actually paid exhaust and resource costs", () => {
    let s = base();
    const w = put(s, "32041"),
      [event, energy] = hand(s, "32045", "32052");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = choose(command(s, { type: "PLAY", id: event.id }), w.id);
    expect(s.player.exhausted).toBe(false);
    expect(actual(s, w.id).exhausted).toBe(false);
    s = finish(pay(s, [energy]));
    expect(s.player.stunned).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(actual(s, w.id).exhausted).toBe(true);
    expect(actual(s, w.id).damage).toBe(0);
    expect(s.villain.hp).toBe(60);
    expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Team Strike invalid typed native payment leaves every staged character and physical hand card untouched", () => {
    let s = base();
    const w = put(s, "32041"),
      [event, energy] = hand(s, "32045", "32052");
    s = choose(command(s, { type: "PLAY", id: event.id }), w.id);
    // Exercise the generic typed payment preflight on this real pending cost;
    // Team Strike's own printed resource cost is generic.
    s.prompt!.requirements = ["mental"];
    const before = s.player.hand.map((p) => p.id),
      failed = dispatch(reload(s), { type: "PAY", ids: [energy.id] });
    expect(failed.error).toMatch(/mental/);
    expect(failed.player.hand.map((p) => p.id)).toEqual(before);
    expect(failed.player.exhausted).toBe(false);
    expect(actual(failed, w.id).exhausted).toBe(false);
    expect(failed.player.discard.some((p) => p.id === energy.id)).toBe(false);
  });
  it("Team Strike preflights all staged characters before mutating any real selected resource", () => {
    let s = base();
    const w = put(s, "32041"),
      [event, energy] = hand(s, "32045", "32052");
    s = choose(command(s, { type: "PLAY", id: event.id }), w.id);
    actual(s, w.id).exhausted = true;
    const failed = dispatch(reload(s), { type: "PAY", ids: [energy.id] });
    expect(failed.error).toMatch(/staged/);
    expect(failed.player.exhausted).toBe(false);
    expect(failed.player.hand.some((p) => p.id === energy.id)).toBe(true);
    expect(failed.player.discard.some((p) => p.id === energy.id)).toBe(false);
  });
  it("zero-resource Team Strike still commits its actual exhaust cost only on successful PAY", () => {
    let s = base();
    const w = put(s, "32041"),
      [event] = hand(s, "32045");
    const carrier = put(s, "01092");
    s = finish(command(s, { type: "ABILITY", id: carrier.id }));
    s = choose(command(s, { type: "PLAY", id: event.id }), w.id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(0);
    expect(s.player.exhausted).toBe(false);
    expect(actual(s, w.id).exhausted).toBe(false);
    s = command(s, { type: "PAY", ids: [] });
    expect(s.player.exhausted).toBe(true);
    expect(actual(s, w.id).exhausted).toBe(true);
    s = target(s, s.villain.id);
    s = finish(target(s, "5"));
    expect(s.villain.hp).toBe(55);
  });
  it("plays source Attack Training, preserves controller, and changes actual ally ATK/HP", () => {
    let s = base();
    const w = put(s, "32041");
    const [training, r] = hand(s, "32043", "32052");
    s = target(play(s, training, [r]), w.id);
    s = finish(s);
    expect(actual(s, training.id).attachedTo).toBe(w.id);
    expect(pieceHP(s, actual(s, w.id))).toBe(6);
    const hp = s.villain.hp;
    s = finish(allyAttack(s, actual(s, w.id)));
    expect(s.villain.hp).toBe(hp - 4);
    expect(actual(s, w.id).damage).toBe(2);
  });
  it("plays source Protective Training on teammate and respects Training maximum across different printings", () => {
    let s = base("colossus", "shadowcat");
    const w = put(s, "32041", "p2");
    const [training, r] = hand(s, "32013", "32022");
    s = finish(target(play(s, training, [r]), w.id));
    expect(pieceHP(s, actual(s, w.id))).toBe(7);
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === training.id),
    ).toBe(true);
    activateSeat(s, "p2");
    const [other] = hand(s, "32043", "32052");
    s.turnPlayerId = "p2";
    expect(playable(s, other)).toMatch(/target/);
  });
  it("Wolverine's native basic attack Pierces Tough once and takes exactly printed consequential damage", () => {
    let s = base();
    const w = put(s, "32041");
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = finish(allyAttack(s, w));
    expect(s.villain.hp).toBe(57);
    expect(s.villain.toughCards).toBe(0);
    expect(actual(s, w.id).damage).toBe(2);
  });
  it("Wolverine begins controller turn healing before actions and retains physical ally", () => {
    let s = base();
    const w = put(s, "32041");
    w.damage = 2;
    s = finish(respond(beginTurn(s), /Wolverine/, "32041"));
    expect(actual(s, w.id).damage).toBe(1);
  });
  it("Wolverine healing belongs to controller's turn, excluding teammate turn", () => {
    let s = base("shadowcat", "colossus");
    const w = put(s, "32041");
    w.damage = 2;
    s = finish(beginTurn(s, "p2"));
    expect(actual(s, w.id).damage).toBe(2);
  });
  it("Magik actual source PLAY pays separate Mental and shuffles physical teammate minion", () => {
    let s = base("shadowcat", "colossus");
    const enemy = minion(s, "01103", "p2"),
      [magik, strength, cost, mental] = hand(
        s,
        "32042",
        "32054",
        "32043",
        "32053",
      );
    s = play(s, magik, [strength, cost]);
    s = respond(s, /Magik/, "32042");
    s = pay(s, [mental], "mental");
    s = finish(target(s, enemy.id));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.encounter.deck.some((p) => p.id === enemy.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === mental.id)).toBe(true);
    expect(actual(s, magik.id).code).toBe("32042");
  });
  it("Magik sends an actual player ally treated as minion to its owner's player deck", () => {
    let s = base("shadowcat", "colossus");
    const ownedAlly = put(s, "32012", "p2");
    seatView(s, "p2").player.inPlay.splice(
      seatView(s, "p2").player.inPlay.indexOf(ownedAlly),
      1,
    );
    ownedAlly.treatedAsMinion = true;
    ownedAlly.engagedWith = "p1";
    s.minions.push(ownedAlly);
    const [magik, strength, cost, mental] = hand(
      s,
      "32042",
      "32054",
      "32043",
      "32053",
    );
    s = respond(play(s, magik, [strength, cost]), /Magik/, "32042");
    s = pay(s, [mental], "mental");
    s = finish(target(s, ownedAlly.id));
    expect(
      seatView(s, "p2").player.deck.filter((p) => p.id === ownedAlly.id),
    ).toHaveLength(1);
    expect(s.encounter.deck.some((p) => p.id === ownedAlly.id)).toBe(false);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === ownedAlly.id),
    ).toBe(false);
    expect(s.minions.some((p) => p.id === ownedAlly.id)).toBe(false);
  });
  it("Magik shuffles the actual owned Ultron Drone card into owner deck and removes its synthetic wrapper", () => {
    let s = base("shadowcat", "colossus");
    const ownerView = seatView(s, "p2"),
      actualCard = ownerView.player.deck.splice(
        ownerView.player.deck.findIndex((p) => p.code === "32013"),
        1,
      )[0];
    expect(actualCard.code).toBe("32013");
    const drone = makePiece(s, "drone");
    drone.droneCard = actualCard;
    drone.engagedWith = "p1";
    s.minions.push(drone);
    const [magik, strength, cost, mental] = hand(
      s,
      "32042",
      "32054",
      "32043",
      "32053",
    );
    s = respond(play(s, magik, [strength, cost]), /Magik/, "32042");
    s = pay(s, [mental], "mental");
    s = finish(target(s, drone.id));
    expect(
      seatView(s, "p2").player.deck.filter((p) => p.id === actualCard.id),
    ).toHaveLength(1);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === actualCard.id),
    ).toBe(false);
    expect(
      s.encounter.deck.some((p) => p.id === actualCard.id || p.id === drone.id),
    ).toBe(false);
    expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
  });
  it("Magik cannot shuffle an Elite minion through its native PLAY response", () => {
    let s = base();
    const enemy = minion(s, "01102"),
      [magik, strength, cost] = hand(s, "32042", "32054", "32043", "32053");
    s = finish(play(s, magik, [strength, cost]));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(true);
  });
  it("Gatekeeper source attachment increases actual HP and blocks basic main thwart with Patrol", () => {
    let s = base();
    const enemy = minion(s, "01103"),
      [gate] = hand(s, "32044");
    s = play(s, gate);
    s = finish(target(s, enemy.id));
    expect(pieceHP(s, s.minions[0])).toBe(card(enemy).health! + 2);
    const side = makePiece(s, "01107");
    side.counters = 3;
    s.sideSchemes.push(side);
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.options.some((o) => o.id === "main")).not.toBe(true);
  });
  it("Gatekeeper native defeat interrupt removes threat before actual attachment leaves", () => {
    let s = base();
    const enemy = minion(s, "01103"),
      [gate] = hand(s, "32044");
    s = finish(target(play(s, gate), enemy.id));
    s = respond(
      native(s, {
        type: "damage",
        target: enemy.id,
        amount: 6,
        source: "hero",
        attack: true,
      }),
      /Gatekeeper/,
      "32044",
    );
    s = finish(s);
    expect(s.scheme.threat).toBe(8);
    expect(s.player.discard.some((p) => p.id === gate.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === enemy.id)).toBe(true);
  });
  it("Professor X forced entry readies actual teammate X-Men and later round discards same original ally", () => {
    let s = base("colossus", "shadowcat");
    seatView(s, "p2").player.exhausted = true;
    const [professor, energy, cost] = hand(s, "32019", "32022", "32013");
    s = play(s, professor, [energy, cost]);
    s = choose(s, "ready:hero:p2");
    s = finish(s);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    s = finish(nextRound(s));
    expect(s.player.inPlay.some((p) => p.id === professor.id)).toBe(false);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === professor.id),
    ).toBe(true);
  });
  it("Professor X forced entry stuns an actual minion rather than manufacturing a villain status", () => {
    let s = base("colossus");
    const enemy = minion(s),
      [professor, energy, cost] = hand(s, "32019", "32022", "32013");
    s = finish(choose(play(s, professor, [energy, cost]), `stun:${enemy.id}`));
    expect(s.minions[0].stunned).toBe(true);
    expect(s.villain.confused).toBe(false);
  });
  it("Colossus source ally receives correct Mutant/X-Men discount and native Toughness", () => {
    let s = base();
    const [ally, energy, cost] = hand(s, "32048", "32052", "32043");
    expect(cardCost(s, card(ally), ally)).toBe(3);
    s = finish(play(s, ally, [energy, cost]));
    expect(actual(s, ally.id).tough).toBe(true);
    expect(
      Number(actual(s, ally.id).toughCards || actual(s, ally.id).tough),
    ).toBe(1);
  });
  it("X-Jet teammate source pays actual X-Men hero card and exhausts actual controller's Jet", () => {
    let s = base("colossus", "shadowcat");
    const jet = put(s, "32020", "p1");
    activateSeat(s, "p2");
    const [event] = hand(s, "32045");
    const source = paymentSources(s, event.id, event.code).find(
      (source) => source.localId === jet.id || source.id === jet.id,
    )!;
    expect(source).toBeTruthy();
    expect(source.playerId).toBe("p1");
    s = command(s, { type: "PLAY", id: event.id });
    s = choose(s, "hero");
    s = pay(s, [], "physical", [source.id]);
    s = target(s, s.villain.id);
    s = target(s, String(heroStats(s).attack));
    s = finish(s);
    expect(actual(s, jet.id).exhausted).toBe(true);
    expect(actual(s, jet.id).ownerId).toBe("p1");
  });
  it("X-Jet excludes actual payer whose current identity lacks X-Men", () => {
    const s = base("colossus", "spider_man"),
      jet = put(s, "32020");
    activateSeat(s, "p2");
    expect(
      paymentSources(s).some(
        (source) => source.localId === jet.id || source.id === jet.id,
      ),
    ).toBe(false);
  });
  it("X-Mansion shared Alter-Ego action heals actual teammate and spends controller's exhaust", () => {
    let s = base("shadowcat", "colossus");
    const mansion = put(s, "32049");
    activateSeat(s, "p2");
    s.player.form = "alter";
    seatView(s, "p1").player.hp -= 1;
    s = command(s, { type: "ABILITY", id: mansion.id, action: "heal" });
    s = finish(target(s, "hero:p1"));
    expect(actual(s, mansion.id).exhausted).toBe(true);
    expect(seatView(s, "p1").player.hp).toBe(9);
  });
  it("X-Mansion does not expose its shared action to a non-Mutant teammate", () => {
    const s = base("shadowcat", "spider_man"),
      mansion = put(s, "32049");
    activateSeat(s, "p2");
    s.player.form = "alter";
    s.player.hp -= 1;
    expect(abilityOptions(s, mansion)).toEqual([]);
  });
  it("Gatekeeper's effective Patrol blocks original Colossus Bait and Switch before any payment", () => {
    const s = base("colossus", "shadowcat"),
      enemy = minion(s, "01103"),
      gate = put(s, "32044", "p2");
    const source = seatView(s, "p2").player.inPlay;
    source.splice(source.indexOf(gate), 1);
    s.player.inPlay.push(gate);
    gate.attachedTo = enemy.id;
    const [event, energy] = hand(s, "32015", "32022");
    const before = s.player.hand.map((p) => p.id);
    expect(playable(s, event)).toMatch(/Patrol/);
    const failed = dispatch(reload(s), { type: "PLAY", id: event.id });
    expect(failed.error).toMatch(/Patrol/);
    expect(failed.prompt).toBeNull();
    expect(failed.player.hand.map((p) => p.id)).toEqual(before);
    expect(failed.player.discard.some((p) => p.id === energy.id)).toBe(false);
    expect(
      failed.player.hand.some((p) => p.id === event.id && p.code === "32015"),
    ).toBe(true);
    expect(actual(failed, gate.id).ownerId).toBe("p2");
  });
  it("printed Patrol blocks Solid but permits actual Phased Shadowcat Bait and Switch", () => {
    let s = base();
    minion(s, "16119");
    const [event, energy] = hand(s, "32015", "32052");
    expect(playable(s, event)).toMatch(/Patrol/);
    const failed = dispatch(reload(s), { type: "PLAY", id: event.id });
    expect(failed.error).toMatch(/Patrol/);
    expect(failed.player.hand.some((p) => p.id === energy.id)).toBe(true);
    s.player.form = "alter";
    s = finish(
      command(s, { type: "ABILITY", id: "identity", action: "phase-control" }),
    );
    s = finish(command(s, { type: "FLIP" }));
    expect(s.player.inPlay.some((p) => p.code === "32031b")).toBe(true);
    expect(playable(s, event)).toBeNull();
    s = finish(play(s, event, [energy]));
    expect(s.scheme.threat).toBe(8);
    expect(
      s.player.discard.some((p) => p.id === event.id && p.code === "32015"),
    ).toBe(true);
    expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
  });
  it("source Bait and Switch printing attacks before removing threat", () => {
    let s = base("colossus");
    const [event, r] = hand(s, "32015", "32022");
    s = finish(play(s, event, [r]));
    expect(s.scheme.threat).toBe(8);
    expect(
      s.player.discard.some((p) => p.id === event.id && p.code === "32015"),
    ).toBe(true);
  });
  it("source Toe to Toe printing executes chosen actual enemy attack then5damage", () => {
    let s = base();
    const [event, r] = hand(s, "32046", "32052");
    s = target(play(s, event, [r]), s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(55);
    expect(
      s.player.discard.some((p) => p.id === event.id && p.code === "32046"),
    ).toBe(true);
  });
  it("source Perseverance printing is available only in real form response", () => {
    let s = base("colossus");
    s.player.form = "alter";
    const [event, r] = hand(s, "32016", "32022");
    s = respond(command(s, { type: "FLIP" }), /Perseverance/, "32016");
    s = finish(pay(s, [r]));
    expect(s.player.tough).toBe(true);
    expect(
      s.player.discard.some((p) => p.id === event.id && p.code === "32016"),
    ).toBe(true);
  });
  it("source Ready to Rumble printing shares native form response and physical discard", () => {
    let s = base();
    const [upgrade, r] = hand(s, "32051", "32052");
    s = finish(play(s, upgrade, [r]));
    s.player.form = "alter";
    s.player.exhausted = true;
    s = finish(
      respond(command(s, { type: "FLIP" }), /Ready to Rumble/, "32051"),
    );
    expect(s.player.exhausted).toBe(false);
    expect(
      s.player.discard.some((p) => p.id === upgrade.id && p.code === "32051"),
    ).toBe(true);
  });
});
