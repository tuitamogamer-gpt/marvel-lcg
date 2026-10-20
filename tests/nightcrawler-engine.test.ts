import { describe, expect, it } from "vitest";
import raw from "../src/data/catalog-cards.json" with { type: "json" };
import { card, deckCodes, heroStats, pieceHP } from "../src/game/cards.js";
import {
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  paymentSources,
  playable,
  dispatch,
} from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { deckErrors } from "../src/game/decks.js";
import { seatView, activateSeat } from "../src/game/team.js";
import {
  command,
  choose,
  finish,
  native,
  play,
  pay,
  respond,
  target,
  hand,
  put,
  minion,
  side,
  top,
  reload,
  conserved,
} from "./dv-test-helpers.js";
import type { GameState, Piece } from "../src/game/types.js";

function base(alter = false, team = false) {
  let s = newGame({
    heroId: "nightcrawler",
    aspect: "protection",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 48001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "nightcrawler", aspect: "protection" as const },
            { heroId: "bishop", aspect: "leadership" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  if (!alter) s = finish(command(s, { type: "FLIP" }));
  s.player.flipped = false;
  s.player.deck.push(...s.player.hand.splice(0));
  s.villain.hp = s.villain.maxHp = 100;
  s.scheme.threat = 5;
  s.encounter.deck = Array.from({ length: 24 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
const attack = (s: GameState, id = s.villain.id, playerId = s.activePlayerId) =>
  native(s, { type: "enemyAttack", id, actorId: playerId });
function attach(
  s: GameState,
  p: Piece,
  targetId: string,
  resources: Piece[] = [],
) {
  s = command(s, { type: "PLAY", id: p.id });
  s = choose(s, targetId);
  return finish(pay(s, resources));
}

describe("Nightcrawler original source contract", () => {
  it("installs all39faces and preserves the original40-card Protection deck", () => {
    expect(raw.filter((c) => c.pack_code === "ncrawler")).toHaveLength(39);
    expect(
      raw
        .filter(
          (c) => c.pack_code === "ncrawler" && !hasExecutableScript(c.code),
        )
        .map((c) => c.code),
    ).toEqual([]);
    const codes = heroStarterCodes("nightcrawler");
    expect(codes).toHaveLength(40);
    expect(deckCodes("nightcrawler", "protection")).toEqual(codes);
    expect(deckErrors("nightcrawler", "protection", codes)).toEqual([]);
    expect(
      base(true)
        .player.setAside?.map((p) => p.code)
        .sort(),
    ).toEqual(["48027", "48028", "48029", "48030", "48030"]);
  });
  it.each([
    "aggression",
    "justice",
    "leadership",
    "protection",
    "pool",
  ] as const)("constructs a supported %s deck", (aspect) => {
    expect(
      deckErrors("nightcrawler", aspect, deckCodes("nightcrawler", aspect)),
    ).toEqual([]);
  });
  it("Kurt searches the actual source Bamf!, shuffles, survives reload and cannot search twice that round", () => {
    let s = base(true);
    const ids = s.player.deck
      .filter((p) => p.code === "48006")
      .map((p) => p.id);
    s = command(s, { type: "ABILITY", id: "identity", action: "find-bamf" });
    s = finish(choose(reload(s), ids[0]));
    expect(s.player.hand.map((p) => p.id)).toContain(ids[0]);
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
    conserved(
      s,
      ids.map((id) => ({ id }) as Piece),
    );
  });
});

describe("Bamf! and the actual defense windows", () => {
  it("Bamf! runs Synch's actual basic-defense interrupt without exhausting Nightcrawler", () => {
    let s = base();
    const synch = put(s, "47018");
    const [bamf] = hand(s, "48006");
    s = attach(s, bamf, s.villain.id);
    s = respond(attack(s), /Bamf!/);
    expect(s.prompt?.title).toBe("Synch");
    s = respond(s, /Synch/);
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === synch.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.hp).toBe(9);
  });
  it("the unchanged original source naturally searches, attaches and defends through public end-turn commands", () => {
    let s = newGame({
      heroId: "nightcrawler",
      aspect: "protection",
      villainId: "rhino",
      module: "bomb_scare",
      seed: 48001,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    s = command(s, { type: "ABILITY", id: "identity", action: "find-bamf" });
    const id = s.prompt!.options[0].id;
    s = choose(reload(s), id);
    const bamf = s.player.hand.find((p) => p.id === id)!;
    s = attach(s, bamf, s.villain.id);
    s = finish(command(s, { type: "FLIP" }));
    s = command(s, {
      type: "END_TURN",
      discard: s.player.hand
        .slice(0, Math.max(0, s.player.hand.length - 5))
        .map((p) => p.id),
    });
    s = respond(s, /Bamf!/);
    expect(
      s.log.some(
        (l) => l.text === "Bamf!: Nightcrawler defends without exhausting.",
      ),
    ).toBe(true);
    expect(s.player.discard.some((p) => p.id === id)).toBe(true);
  });
  it.each([false, true])(
    "uses basic DEF without changing an initially exhausted=%s identity",
    (exhausted) => {
      let s = base();
      const [bamf] = hand(s, "48006");
      s = attach(s, bamf, s.villain.id);
      s.player.exhausted = exhausted;
      s = respond(attack(s), /Bamf!/);
      // The public choice resolves the basic defense through attack completion.
      s = finish(s);
      expect(s.player.hp).toBe(9);
      expect(s.player.exhausted).toBe(exhausted);
      expect(s.player.discard.some((p) => p.id === bamf.id)).toBe(true);
      expect(
        s.log.some(
          (l) => l.text === "Bamf!: Nightcrawler defends without exhausting.",
        ),
      ).toBe(true);
    },
  );
  it("Tally Ho! is optional, pays its own resource cost, returns that same discarded Bamf! and deals3", () => {
    let s = base();
    const [bamf, tally, resource] = hand(s, "48006", "48011", "48023");
    s = attach(s, bamf, s.villain.id);
    s = respond(attack(s), /Bamf!/);
    expect(s.prompt?.title).toBe("After Bamf! declares Nightcrawler");
    expect(s.player.discard.some((p) => p.id === bamf.id)).toBe(true);
    s = choose(reload(s), tally.id);
    s = finish(pay(s, [resource]));
    expect(s.villain.hp).toBe(97);
    expect(s.player.hand.some((p) => p.id === bamf.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === bamf.id)).toBe(false);
    expect(
      s.player.discard.filter((p) => p.id === tally.id || p.id === resource.id),
    ).toHaveLength(2);
    conserved(s, [bamf, tally, resource]);
  });
  it("can decline Tally Ho! without spending it or returning Bamf!", () => {
    let s = base();
    const [bamf, tally, resource] = hand(s, "48006", "48011", "48023");
    s = attach(s, bamf, s.villain.id);
    s = finish(respond(attack(s), /Bamf!/));
    expect(s.player.discard.some((p) => p.id === bamf.id)).toBe(true);
    expect(
      s.player.hand.filter((p) => [tally.id, resource.id].includes(p.id)),
    ).toHaveLength(2);
    expect(s.villain.hp).toBe(100);
  });
  it("Bamf! intercepts another player's attack without exhausting Nightcrawler", () => {
    let s = base(false, true);
    const [bamf] = hand(s, "48006");
    s = attach(s, bamf, s.villain.id);
    seatView(s, "p2").player.form = "hero";
    s = finish(respond(attack(s, s.villain.id, "p2"), /Bamf!/));
    expect(seatView(s, "p1").player.hp).toBe(9);
    expect(seatView(s, "p2").player.hp).toBe(12);
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(seatView(s, "p1").player.discard.some((p) => p.id === bamf.id)).toBe(
      true,
    );
  });
  it("Merc blocks an off-turn Bamf! ability", () => {
    let s = base(false, true);
    const [bamf] = hand(s, "48006");
    s = attach(s, bamf, s.villain.id);
    s.turnPlayerId = "p2";
    put(s, "44032", "p2");
    s = attack(s, s.villain.id, "p2");
    expect(s.prompt?.options.some((o) => o.label.includes("Bamf!"))).toBe(
      false,
    );
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === bamf.id)).toBe(
      true,
    );
  });
});

describe("Nightcrawler costs, attachments and source allies", () => {
  it("Alliance pays from another player's hand while exhausting distinct mixed-owner characters and using modified THW", () => {
    let s = base(false, true);
    const force = put(s, "45011", "p2"),
      inspired = put(s, "01074", "p2");
    inspired.attachedTo = force.id;
    const [event] = hand(s, "48032");
    activateSeat(s, "p2");
    const [resource] = hand(s, "45022");
    activateSeat(s, "p1");
    s = choose(
      command(s, { type: "PLAY", id: event.id }),
      `${force.id}|hero:p1`,
    );
    const contribution = paymentSources(
      s,
      event.id,
      event.code,
      false,
      true,
    ).find((p) => p.playerId === "p2" && p.localId === resource.id)!;
    expect(contribution).toBeDefined();
    s = command(reload(s), { type: "PAY", ids: [contribution.id] });
    for (let n = 0; n < 5; n++) s = choose(reload(s), "main");
    for (let n = 0; n < 5; n++) s = choose(reload(s), s.villain.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(0);
    expect(s.villain.hp).toBe(95);
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === force.id)?.exhausted,
    ).toBe(true);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === resource.id),
    ).toBe(true);
  });
  it("a dual-trait character still cannot pay both exhaustion costs", () => {
    let s = base();
    const rogue = put(s, "48012"),
      force = put(s, "45011");
    s = finish(
      choose(
        command(s, { type: "ABILITY", id: rogue.id, action: "absorb" }),
        force.id,
      ),
    );
    const [event, resource] = hand(s, "48032", "48023");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.options.some((o) => o.id === `${rogue.id}|hero:p1`)).toBe(
      true,
    );
    expect(
      s.prompt?.options.some((o) => o.id === `${rogue.id}|${rogue.id}`),
    ).toBe(false);
    s = command(s, { type: "CANCEL" });
    expect(s.player.hand.some((p) => p.id === resource.id)).toBe(true);
  });
  it("Gunboat can exhaust a printed-dash character, counting its THW as unmodifiable0 without enabling basic thwarting", () => {
    let s = base();
    const clone = put(s, "46003"),
      force = put(s, "45011");
    const [lead, energy] = hand(s, "01070", "48023");
    s = finish(target(play(s, lead, [energy]), "p1"));
    let forbidden = dispatch(reload(s), {
      type: "ABILITY",
      id: clone.id,
      action: "thwart",
    });
    if (
      !forbidden.error &&
      forbidden.prompt?.options.some((o) => o.id === "main")
    )
      forbidden = dispatch(reload(forbidden), { type: "CHOOSE", id: "main" });
    expect(forbidden.error).toMatch(/printed dash/i);
    const [event, resource] = hand(s, "48032", "48024");
    s = choose(
      command(s, { type: "PLAY", id: event.id }),
      `${force.id}|${clone.id}`,
    );
    s = pay(s, [resource]);
    for (let n = 0; n < 3; n++) s = choose(reload(s), "main");
    for (let n = 0; n < 3; n++) s = choose(reload(s), s.villain.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(2);
    expect(s.villain.hp).toBe(97);
    expect(s.player.inPlay.find((p) => p.id === clone.id)?.exhausted).toBe(
      true,
    );
  });
  it("Bub retains a successful entry cost if Hawkeye defeats the minion before its post-arrow effects", () => {
    let s = base();
    const hawkeye = put(s, "01066");
    hawkeye.counters = 3;
    const minion = makePiece(s, "01110");
    s.encounter.deck.unshift(minion);
    s.player.hp = 3;
    const [event] = hand(s, "48016");
    s = play(s, event);
    s = finish(respond(s, /Hawkeye/));
    expect(s.minions.some((p) => p.id === minion.id)).toBe(false);
    expect(s.player).toMatchObject({ hp: 6, tough: true });
    expect(s.log.some((l) => l.text === 'Play "Come Get Me, Bub!".')).toBe(
      true,
    );
  });
  it("Bub pays its hidden minion cost before Counterspell cancels its healing and Tough", () => {
    let s = base();
    s.player.hp = 3;
    const counterspell = makePiece(s, "09030");
    counterspell.attachedTo = "hero:p1";
    s.attachments.push(counterspell);
    const minion = makePiece(s, "48035");
    s.encounter.deck.unshift(minion);
    const [event] = hand(s, "48016");
    s = finish(play(s, event));
    expect(s.minions.find((p) => p.id === minion.id)?.engagedWith).toBe("p1");
    expect(s.player).toMatchObject({ hp: 3, tough: false });
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(s.attachments.some((p) => p.id === counterspell.id)).toBe(false);
  });
  it("Bub fails its uncertain cost at the old encounter-deck boundary without being played or granting benefits", () => {
    let s = base();
    s.player.hp = 3;
    const discarded = makePiece(s, "01107"),
      minion = makePiece(s, "48035");
    s.encounter.deck = [discarded];
    s.encounter.discard = [minion];
    const [event] = hand(s, "48016");
    const played = s.stats?.cardsPlayed || 0;
    s = finish(play(s, event));
    expect(s.player).toMatchObject({ hp: 3, tough: false });
    expect(s.minions).toHaveLength(0);
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck.map((p) => p.id).sort()).toEqual(
      [discarded.id, minion.id].sort(),
    );
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(s.stats?.cardsPlayed || 0).toBe(played);
    expect(s.log.some((l) => l.text === 'Play "Come Get Me, Bub!".')).toBe(
      false,
    );
  });
  it("a failed Magik top Bub attempt reveals the next physical card and releases pending/top-use locks without played responses", () => {
    let s = newGame({
      heroId: "magik",
      aspect: "aggression",
      villainId: "rhino",
      module: "bomb_scare",
      seed: 45030,
      pacing: "expert",
    });
    s = finish(command(s, { type: "MULLIGAN", ids: [] }));
    s = finish(command(s, { type: "FLIP" }));
    const event = top(s, "48016"),
      next = s.player.deck[1];
    const minion = makePiece(s, "48035");
    s.encounter.deck = [makePiece(s, "01107")];
    s.encounter.discard = [minion];
    const played = s.stats?.cardsPlayed || 0;
    s = finish(command(s, { type: "PLAY", id: event.id }));
    expect(s.player.deck[0]?.id).toBe(next.id);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(s.flags[`magikPending:${event.id}`]).toBeUndefined();
    expect(s.flags.magikTopPhase).not.toBe(`${s.round}:${s.phase}`);
    expect(s.stats?.cardsPlayed || 0).toBe(played);
  });
  it("Change of Fortune can be given to a teammate and draws for that controller after their villain-phase defeat", () => {
    let s = base(false, true);
    const [upgrade, resource] = hand(s, "48014", "48023");
    s = finish(choose(play(s, upgrade, [resource]), "p2"));
    expect(
      seatView(s, "p2").player.inPlay.some((p) => p.id === upgrade.id),
    ).toBe(true);
    const enemy = minion(s, "48035");
    s.phase = "villain";
    const before = seatView(s, "p2").player.hand.length;
    s = native(s, {
      type: "damage",
      target: enemy.id,
      amount: 5,
      source: "hero:p2",
      actorId: "p2",
    });
    s = finish(respond(s, /Change of Fortune/));
    expect(seatView(s, "p2").player.hand).toHaveLength(before + 2);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === upgrade.id)
        ?.exhausted,
    ).toBe(true);
  });
  it("Astonishing X-Men responds to an X-Men ally's no-damage defense and its real defeat stuns/confuses all enemies", () => {
    let s = base();
    const [scheme, resource] = hand(s, "48020", "48023");
    s = finish(play(s, scheme, [resource]));
    const actual = s.sideSchemes.find((p) => p.id === scheme.id)!;
    actual.counters = 1;
    const northstar = put(s, "48013");
    northstar.tough = true;
    const enemy = minion(s, "48035");
    s = respond(choose(attack(s), northstar.id), /Astonishing X-Men/);
    s = finish(s);
    expect(s.victoryDisplay?.some((p) => p.id === scheme.id)).toBe(true);
    expect(s.villain).toMatchObject({ stunned: true, confused: true });
    expect(s.minions.find((p) => p.id === enemy.id)).toMatchObject({
      stunned: true,
      confused: true,
    });
  });
  it("Combine Forces exhausts two distinct eligible characters before defeating a non-Elite minion", () => {
    let s = base();
    const force = put(s, "45011"),
      enemy = minion(s, "48035");
    const [event, resource] = hand(s, "48031", "48023");
    s = command(s, { type: "PLAY", id: event.id });
    expect(
      s.prompt?.options.some((o) => o.id === `${force.id}|${force.id}`),
    ).toBe(false);
    s = choose(reload(s), `${force.id}|hero:p1`);
    expect(s.player.exhausted).toBe(false);
    s = pay(s, [resource]);
    s = finish(choose(reload(s), enemy.id));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === force.id)?.exhausted).toBe(
      true,
    );
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
  });
  it("Gunboat Diplomacy commits real THW costs, divides both effects and survives every allocation reload", () => {
    let s = base();
    const force = put(s, "45011"),
      enemy = minion(s, "48035");
    const [event, resource] = hand(s, "48032", "48023");
    s = choose(
      command(s, { type: "PLAY", id: event.id }),
      `${force.id}|hero:p1`,
    );
    s = pay(s, [resource]);
    for (let n = 0; n < 4; n++) s = choose(reload(s), "main");
    s = choose(reload(s), s.villain.id);
    s = choose(reload(s), s.villain.id);
    s = choose(reload(s), s.villain.id);
    s = finish(choose(reload(s), enemy.id));
    expect(s.scheme.threat).toBe(1);
    expect(s.villain.hp).toBe(97);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === force.id)?.exhausted).toBe(
      true,
    );
    conserved(s, [event, resource, force]);
  });
  it("Kurt's Chapel adds REC and draws for the selected teammate only after a real basic recovery", () => {
    let s = base(true, true);
    const chapel = put(s, "48003");
    s.player.hp = 3;
    expect(heroStats(s).recover).toBe(4);
    s = respond(
      command(s, { type: "BASIC", action: "recover" }),
      /Kurt's Chapel/,
    );
    s = finish(choose(reload(s), "p2"));
    expect(s.player.hp).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === chapel.id)?.exhausted).toBe(
      true,
    );
    expect(seatView(s, "p2").player.hand).toHaveLength(7);
  });
  it("Cutlasses supplies +1ATK/+1DEF/Retaliate and occupies2 Restricted slots; Tail supplies the third", () => {
    let s = base();
    put(s, "48005");
    const cutlasses = put(s, "48004");
    expect(heroStats(s)).toMatchObject({ attack: 2, defense: 4 });
    const pistol = hand(s, "20022", "48023");
    s = finish(play(s, pistol[0], [pistol[1]]));
    expect(s.player.inPlay.some((p) => p.id === cutlasses.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === pistol[0].id)).toBe(true);
    s = attack(s);
    s = finish(choose(s, "hero"));
    expect(s.villain.hp).toBe(99);
  });
  it("Daytripper searches the real Bamf!, attaches it and damages every Bamf! enemy", () => {
    let s = base();
    const m = minion(s, "01103");
    const first = put(s, "48006");
    first.attachedTo = s.villain.id;
    const second = top(s, "48006");
    const [ally, resource] = hand(s, "48002", "48023");
    s = respond(play(s, ally, [resource]), /^Daytripper$/);
    s = choose(reload(s), second.id);
    s = finish(choose(reload(s), m.id));
    expect(s.player.inPlay.find((p) => p.id === second.id)?.attachedTo).toBe(
      m.id,
    );
    expect(s.villain.hp).toBe(99);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(1);
    conserved(s, [first, second, ally, resource]);
  });
  it("Port and Punch deals its first3 plus3 again to the same Bamf! target", () => {
    let s = base();
    const bamf = put(s, "48006");
    bamf.attachedTo = s.villain.id;
    const [event, resource] = hand(s, "48007", "48023");
    s = finish(target(play(s, event, [resource]), s.villain.id));
    expect(s.villain.hp).toBe(94);
  });
  it("Scout Ahead optionally discards an actual hand Bamf! to thwart a different scheme", () => {
    let s = base();
    const scheme = side(s, "01107", 4);
    const [event, bamf, resource] = hand(s, "48009", "48006", "48023");
    s = target(play(s, event, [resource]), "main");
    s = respond(s, /Scout Ahead/);
    s = choose(reload(s), bamf.id);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
    s = finish(choose(reload(s), scheme.id));
    expect(s.scheme.threat).toBe(2);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(1);
    expect(s.player.discard.some((p) => p.id === bamf.id)).toBe(true);
  });
  it("Port Away pays its actual hand Bamf! then changes form and readies", () => {
    let s = base();
    s.player.exhausted = true;
    const [event, bamf] = hand(s, "48010", "48006");
    s = play(s, event);
    s = finish(choose(reload(s), bamf.id));
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(false);
    expect(
      s.player.discard.filter((p) => [event.id, bamf.id].includes(p.id)),
    ).toHaveLength(2);
  });
  it("Northstar's DEAL damage cost can remove Tough while canceling the real faceup boost icons", () => {
    let s = base();
    const northstar = put(s, "48013");
    northstar.tough = true;
    const boost = makePiece(s, "01107");
    s.encounter.deck.unshift(boost);
    s = choose(attack(s), "hero");
    s = finish(respond(reload(s), /Northstar/));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === northstar.id)).toMatchObject({
      tough: false,
      damage: 0,
    });
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
  });
  it("Under Control deals4 only after an actual hero defense takes no damage", () => {
    let s = base();
    const enemy = minion(s, "01103"),
      upgrade = put(s, "48015");
    upgrade.attachedTo = enemy.id;
    s = respond(choose(attack(s, enemy.id), "hero"), /Under Control/);
    s = finish(s);
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === upgrade.id)).toBe(true);
  });
  it("Come Get Me Bub puts rather than reveals its discarded minion, then heals and gives Tough", () => {
    let s = base();
    s.player.hp = 4;
    const enemy = makePiece(s, "48035");
    s.encounter.deck.unshift(enemy);
    const [event] = hand(s, "48016");
    s = finish(play(s, event));
    expect(s.player).toMatchObject({ hp: 7, tough: true, confused: false });
    expect(s.minions.find((p) => p.id === enemy.id)?.engagedWith).toBe("p1");
  });
  it("Gambit looks at3 without discarding them, tucks one physical boost and uses its boost count for both powers", () => {
    let s = base();
    const [a, b, c] = ["01104", "01107", "01105"].map((code) =>
      makePiece(s, code),
    );
    s.encounter.deck.unshift(a, b, c);
    const [ally, r1, r2] = hand(s, "48021", "48023", "48024");
    s = respond(play(s, ally, [r1, r2]), /^Gambit$/);
    expect(s.encounter.discard).toHaveLength(0);
    s = choose(reload(s), b.id);
    s = choose(s, a.id);
    s = finish(choose(s, c.id));
    expect(s.encounter.deck.slice(0, 2).map((p) => p.id)).toEqual([c.id, a.id]);
    expect(
      s.player.inPlay
        .find((p) => p.id === ally.id)
        ?.storedCards?.map((p) => p.id),
    ).toEqual([b.id]);
    s = finish(
      target(
        command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.villain.hp).toBe(100 - card(b).boost!);
  });
  it("Moira's original48022 printing responds to Kurt changing from Mutant alter-ego", () => {
    let s = base(true);
    const [moira, resource] = hand(s, "48022", "48023");
    s = finish(play(s, moira, [resource]));
    s = finish(respond(command(s, { type: "FLIP" }), /Moira/));
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === moira.id)?.exhausted).toBe(
      true,
    );
  });
  it("the original48017 Powerful Punch plays at initiation and defends for its controller", () => {
    let s = base();
    const [event, resource] = hand(s, "48017", "48023");
    s = respond(attack(s), /Powerful Punch/);
    s = finish(pay(s, [resource]));
    expect(s.villain.hp).toBe(96);
    expect(s.player.hp).toBe(7);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Rapid Teleportation spends a real resource and retrieves a real discard once per phase", () => {
    let s = base();
    const [bamf, resource] = hand(s, "48006", "48023");
    s.player.hand.splice(s.player.hand.indexOf(bamf), 1);
    s.player.discard.push(bamf);
    s = command(s, {
      type: "ABILITY",
      id: "identity",
      action: "rapid-teleportation",
    });
    s = pay(s, [resource]);
    s = finish(choose(reload(s), bamf.id));
    expect(s.player.hand.some((p) => p.id === bamf.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === resource.id)).toBe(true);
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
  });
  it("Prehensile Tail generates only for an event's resource cost, and exhausts on commit", () => {
    let s = base();
    const tail = put(s, "48005");
    const [event] = hand(s, "48009");
    expect(
      paymentSources(s, event.id, event.code).some((p) => p.id === tail.id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "48003").some((p) => p.id === tail.id),
    ).toBe(false);
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.player.inPlay.find((p) => p.id === tail.id)?.exhausted).toBe(
      false,
    );
    s = command(s, { type: "PAY", ids: [tail.id] });
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === tail.id)?.exhausted).toBe(true);
  });
  it("Teleport Drop discards the actual attached Bamf! with its resource payment and stuns its enemy", () => {
    let s = base();
    const [bamf, event, resource] = hand(s, "48006", "48008", "48023");
    s = attach(s, bamf, s.villain.id);
    s = command(s, { type: "PLAY", id: event.id });
    s = choose(s, bamf.id);
    expect(s.player.inPlay.some((p) => p.id === bamf.id)).toBe(true);
    s = finish(pay(reload(s), [resource]));
    expect(s.villain.hp).toBe(92);
    expect(s.villain.stunned).toBe(true);
    expect(
      s.player.discard.filter((p) =>
        [bamf.id, event.id, resource.id].includes(p.id),
      ),
    ).toHaveLength(3);
  });
  it("canceling Teleport Drop payment preserves its Bamf!, event and resource", () => {
    let s = base();
    const [bamf, event, resource] = hand(s, "48006", "48008", "48023");
    s = attach(s, bamf, s.villain.id);
    s = choose(command(s, { type: "PLAY", id: event.id }), bamf.id);
    s = command(s, { type: "CANCEL" });
    expect(s.player.inPlay.some((p) => p.id === bamf.id)).toBe(true);
    expect(
      s.player.hand.filter((p) => [event.id, resource.id].includes(p.id)),
    ).toHaveLength(2);
  });
  it("Rogue pays DEAL damage through Tough, copies printed powers dynamically and loses them when the target leaves", () => {
    let s = base();
    const rogue = put(s, "48012"),
      northstar = put(s, "48013");
    northstar.tough = true;
    s = choose(
      command(s, { type: "ABILITY", id: rogue.id, action: "absorb" }),
      northstar.id,
    );
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === northstar.id)).toMatchObject({
      tough: false,
      damage: 0,
    });
    s = finish(
      target(
        command(s, { type: "ABILITY", id: rogue.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.villain.hp).toBe(96);
    s = finish(native(s, { type: "discardPiece", id: northstar.id }));
    const actual = s.player.inPlay.find((p) => p.id === rogue.id)!;
    actual.exhausted = false;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: rogue.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.villain.hp).toBe(94);
  });
  it("Riposte's delayed damage can follow Retaliate to clear Tough first", () => {
    let s = base();
    put(s, "48004");
    const [riposte, resource] = hand(s, "48018", "48023");
    s.villain.tough = true;
    s = attack(s);
    s = choose(s, "hero");
    s = respond(s, /Riposte/);
    s = pay(s, [resource]);
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.label === "Retaliate")?.id ||
        v.prompt?.options.find((o) => o.label === "Riposte")?.id,
    );
    expect(s.player.hp).toBe(9);
    expect(s.villain.hp).toBe(97);
    expect(s.player.discard.some((p) => p.id === riposte.id)).toBe(true);
  });
});
