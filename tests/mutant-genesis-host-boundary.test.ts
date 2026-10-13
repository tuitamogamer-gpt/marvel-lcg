/** Independent native host boundaries. Every command crosses JSON save/reload;
 * original source cards are retained and extra fixture cards are explicitly owned. */
import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { shadowcatMassForm } from "../src/game/shadowcat.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  attach,
  choose,
  command,
  finish,
  hand,
  native,
  pay,
  physical,
  play,
  put,
  reload,
  respond,
  target,
  until,
} from "./dv-test-helpers.js";

function base(heroId = "shadowcat", team = false, aspect?: Aspect) {
  let s = newGame({
    heroId,
    aspect: aspect || (heroId === "shadowcat" ? "aggression" : "protection"),
    villainId: "rhino",
    seed: 320140,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "shadowcat", aspect: "aggression" as const },
            { heroId: "colossus", aspect: "protection" as const },
          ],
        }
      : {}),
  });
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s, (v) =>
    /setup/i.test(v.prompt?.title || "")
      ? v.prompt?.options.find((o) => o.image === "32006")?.id
      : undefined,
  );
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    const source = physical(s);
    const mass = s.player.inPlay.filter((p) =>
      ["32031a", "32031b"].includes(p.code),
    );
    s.player.deck = source.filter((p) => !mass.some((m) => m.id === p.id));
    s.player.hand = [];
    s.player.discard = [];
    s.player.inPlay = mass;
    s.player.form = "hero";
    s.player.exhausted = s.player.flipped = false;
    s.player.stunned = s.player.confused = s.player.tough = false;
    s.player.stunCards = s.player.confuseCards = s.player.toughCards = 0;
  }
  activateSeat(s, "p1");
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01186"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 8;
  return s;
}

function phased(s: GameState) {
  const p = s.player.inPlay.find((p) => ["32031a", "32031b"].includes(p.code));
  expect(p, "actual setup mass-form upgrade").toBeTruthy();
  p!.code = "32031b";
}

function nemesis(s: GameState, code: string): Piece {
  const zone = s.player.setAside || [];
  const i = zone.findIndex((p) => p.code === code);
  expect(i, `original nemesis ${code}`).toBeGreaterThanOrEqual(0);
  return zone.splice(i, 1)[0];
}

function attack(s: GameState, modifier = 0) {
  return native(s, {
    type: "enemyAttack",
    id: s.villain.id,
    activation: {
      playerId: s.activePlayerId,
      enemyId: s.villain.id,
      kind: "attack",
      modifier,
    },
  });
}

function basic(s: GameState, kind: "attack" | "thwart") {
  return finish(
    target(
      command(s, { type: "BASIC", action: kind }),
      kind === "attack" ? s.villain.id : "main",
    ),
  );
}

const hasNightcrawlerInterrupt = (s: GameState) =>
  !!s.prompt?.options.some(
    (o) => o.image === "32011" && /prevent.*damage/i.test(o.label),
  );

describe("Mutant Genesis independent host boundaries", () => {
  it.each([0, 1])(
    "keeps Tough on a Piercing attack dealing %s before a one-point constant reduction",
    (amount) => {
      let s = base("colossus");
      attach(s, "14027", s.villain.id);
      s.villain.tough = true;
      s.villain.toughCards = 1;
      s = finish(
        native(s, {
          type: "damage",
          target: s.villain.id,
          amount,
          source: "hero",
          attack: true,
          piercing: true,
        }),
      );
      expect(s.villain.hp).toBe(50);
      expect(s.villain.toughCards).toBe(1);
      expect(s.villain.tough).toBe(true);
    },
  );

  it("discards Tough when positive Piercing damage remains after reduction", () => {
    let s = base("colossus");
    attach(s, "14027", s.villain.id);
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = finish(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 2,
        source: "hero",
        attack: true,
        piercing: true,
      }),
    );
    expect(s.villain.hp).toBe(49);
    expect(s.villain.toughCards).toBe(0);
  });

  it("Organic Steel follows actual Piercing damage and keeps its new Tough", () => {
    let s = base("colossus");
    const steel = put(s, "32006");
    steel.counters = 2;
    s.player.tough = true;
    s.player.toughCards = 2;
    const unstoppable = nemesis(s, "32028");
    unstoppable.attachedTo = s.villain.id;
    s.attachments.push(unstoppable);
    const hp = s.player.hp;
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.image === "32006"),
    );
    expect(s.player.hp).toBe(hp - 4);
    expect(s.player.toughCards).toBe(0);
    s = finish(respond(s, /Organic Steel/, "32006"));
    const actualSteel = s.player.inPlay.find((p) => p.id === steel.id);
    expect(actualSteel?.exhausted).toBe(true);
    expect(actualSteel?.counters).toBe(1);
    expect(s.player.hp).toBe(hp - 4);
    expect(s.player.toughCards).toBe(1);
    expect(s.player.tough).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === unstoppable.id)).toBe(true);
  });

  it("Phased defense prohibits boost damage and attack damage without consuming Tough", () => {
    let s = base();
    phased(s);
    s.player.tough = true;
    s.player.toughCards = 1;
    s.encounter.deck.unshift(makePiece(s, "01130"));
    const hp = s.player.hp;
    s = attack(s, 2);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero"));
    s = finish(choose(s, "hero"));
    expect(s.player.hp).toBe(hp);
    expect(s.player.toughCards).toBe(1);
    expect(s.player.tough).toBe(true);
    expect(shadowcatMassForm(s)).toBe("solid");
  });

  it("a nested Powerful Punch completes its attack and flips mass before enemy defense completes", () => {
    let s = base();
    phased(s);
    const [punch, energy] = hand(s, "32014", "32022", "32040");
    const hp = s.player.hp;
    s = respond(attack(s), /Powerful Punch/, "32014");
    s = pay(s, [energy]);
    s = until(
      s,
      (v) =>
        !!v.attack && v.villain.hp === 46 && shadowcatMassForm(v) === "solid",
    );
    expect(s.attack?.defender).toBe("hero");
    expect(s.attack?.basicDefense).toBe(false);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hp).toBe(hp);
    s = finish(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.discard.some((p) => p.id === punch.id)).toBe(true);
  });

  it("defense still completes when Powerful Punch defeats the attacking minion", () => {
    let s = base();
    const pawn = nemesis(s, "32058");
    pawn.engagedWith = s.activePlayerId;
    s.minions.push(pawn);
    const [, energy] = hand(s, "32014", "32022", "32040");
    const hp = s.player.hp;
    s = respond(
      native(s, { type: "enemyAttack", id: pawn.id }),
      /Powerful Punch/,
      "32014",
    );
    s = pay(s, [energy]);
    s = respond(s, /Solid.*flip/, "32031a");
    expect(s.prompt?.options.some((o) => o.image === "32040")).toBeFalsy();
    s = finish(s);
    expect(s.minions.some((p) => p.id === pawn.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === pawn.id)).toBe(true);
    expect(s.player.hp).toBe(hp);
    expect(s.player.exhausted).toBe(false);
    expect(shadowcatMassForm(s)).toBe("solid");
    expect(s.attack).toBeNull();
  });

  it("returns to Solid after resolving a real Moment of Triumph attack response first", () => {
    let s = base();
    s.player.hp = 6;
    const pawn = nemesis(s, "32058");
    pawn.engagedWith = s.activePlayerId;
    pawn.damage = 2;
    s.minions.push(pawn);
    const [surprise, energy, triumph] = hand(s, "32037", "32052", "12030");
    s = target(play(s, surprise, [energy]), pawn.id);
    s = respond(s, /Other responses after attacking/);
    s = respond(s, /Moment of Triumph/, "12030");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "32031a"));
    expect(s.player.hp).toBe(8);
    expect(shadowcatMassForm(s)).toBe("solid");
    expect(s.player.discard.filter((p) => p.id === triumph.id)).toHaveLength(1);
    s = finish(respond(s, /Solid.*flip/, "32031a"));
    expect(shadowcatMassForm(s)).toBe("phased");
    expect(s.player.hp).toBe(8);
    expect(s.encounter.discard.filter((p) => p.id === pawn.id)).toHaveLength(1);
  });

  it("keeps other attack responses available after choosing Solid's flip first", () => {
    let s = base();
    s.player.hp = 6;
    const pawn = nemesis(s, "32058");
    pawn.engagedWith = s.activePlayerId;
    pawn.damage = 2;
    s.minions.push(pawn);
    const [surprise, energy, triumph] = hand(s, "32037", "32052", "12030");
    s = target(play(s, surprise, [energy]), pawn.id);
    s = respond(s, /Solid.*flip/, "32031a");
    s = finish(respond(s, /Moment of Triumph/, "12030"));
    expect(shadowcatMassForm(s)).toBe("phased");
    expect(s.player.hp).toBe(8);
    expect(s.player.discard.filter((p) => p.id === triumph.id)).toHaveLength(1);
    expect(s.encounter.discard.filter((p) => p.id === pawn.id)).toHaveLength(1);
  });

  it("returns to Solid's defense response after resolving Indomitable first", () => {
    let s = base("shadowcat", false, "protection");
    const indomitable = put(s, "01082");
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === "hero"),
    );
    s = choose(s, "hero");
    s = respond(s, /Indomitable/, "01082");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "32031a"));
    expect(s.player.exhausted).toBe(false);
    expect(shadowcatMassForm(s)).toBe("solid");
    expect(
      s.player.discard.filter((p) => p.id === indomitable.id),
    ).toHaveLength(1);
    s = finish(respond(s, /Solid.*flip/, "32031a"));
    expect(shadowcatMassForm(s)).toBe("phased");
    expect(s.player.exhausted).toBe(false);
  });

  // RRG1.8 p10 and p20: Phased's Forced Response and the surviving enemy's
  // Retaliate are simultaneous mandatory aftermath; the first player orders them.
  it.each([
    { first: "Phased", retaliateDamage: 1 },
    { first: "Retaliate", retaliateDamage: 0 },
  ])(
    "orders $first first when Powerful Punch triggers Phased and Retaliate together",
    ({ first, retaliateDamage }) => {
      let s = base();
      phased(s);
      const whiplash = makePiece(s, "01172");
      whiplash.engagedWith = s.activePlayerId;
      s.minions.push(whiplash);
      const gatekeeper = put(s, "32044");
      gatekeeper.attachedTo = whiplash.id;
      const [, energy] = hand(s, "32014", "32022", "32040");
      const hp = s.player.hp;
      s = respond(
        native(s, { type: "enemyAttack", id: whiplash.id }),
        /Powerful Punch/,
        "32014",
      );
      s = pay(s, [energy]);
      s = until(
        s,
        (v) =>
          !!v.prompt?.options.some((o) => /Phased/i.test(o.label)) &&
          !!v.prompt?.options.some((o) => /Retaliate/i.test(o.label)),
      );
      expect(s.player.hp).toBe(hp);
      const selected = s.prompt!.options.find((o) =>
        new RegExp(first, "i").test(o.label),
      );
      s = choose(s, selected!.id);
      s = until(
        s,
        (v) =>
          shadowcatMassForm(v) === "solid" &&
          !!v.prompt?.options.some((o) => o.image === "32040"),
      );
      expect(s.player.hp).toBe(hp - retaliateDamage);
      s = finish(s);
      expect(s.player.hp).toBe(hp - retaliateDamage - 3);
      expect(s.minions.find((p) => p.id === whiplash.id)?.damage).toBe(4);
    },
  );

  it("White Queen replenishes actual Confused cards and leaves the last card after she leaves", () => {
    let s = base();
    const queen = nemesis(s, "32056");
    queen.engagedWith = s.activePlayerId;
    s.minions.push(queen);
    s = finish(native(s, { type: "flag", key: "hostBoundary", value: true }));
    expect(s.player.confused).toBe(true);
    expect(s.player.confuseCards).toBe(1);
    s = basic(s, "thwart");
    expect(s.scheme.threat).toBe(8);
    expect(s.player.confuseCards).toBe(1);
    s = finish(native(s, { type: "discardPiece", id: queen.id }));
    expect(s.player.confused).toBe(true);
    expect(s.player.confuseCards).toBe(1);
    s = finish(native(s, { type: "ready", target: "hero" }));
    s = basic(s, "thwart");
    expect(s.scheme.threat).toBe(8);
    expect(s.player.confused).toBe(false);
    expect(s.player.confuseCards).toBe(0);
  });

  it("Telepathic Restraint replenishes Stun and canceled attacks never flip mass", () => {
    let s = base();
    phased(s);
    const restraint = nemesis(s, "32059");
    restraint.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(restraint);
    s = finish(native(s, { type: "flag", key: "hostBoundary", value: true }));
    expect(s.player.stunCards).toBe(1);
    s = basic(s, "attack");
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunCards).toBe(1);
    expect(shadowcatMassForm(s)).toBe("phased");
    s = finish(native(s, { type: "discardPiece", id: restraint.id }));
    expect(s.player.stunned).toBe(true);
    expect(s.player.stunCards).toBe(1);
    s = finish(native(s, { type: "ready", target: "hero" }));
    s = basic(s, "attack");
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(shadowcatMassForm(s)).toBe("phased");
    s = finish(native(s, { type: "ready", target: "hero" }));
    s = basic(s, "attack");
    expect(s.villain.hp).toBeLessThan(50);
    expect(shadowcatMassForm(s)).toBe("solid");
  });

  it("Stun replaces the whole paid Shadowcat Surprise without a ready or mass flip", () => {
    let s = base();
    phased(s);
    s.player.exhausted = true;
    s.player.stunned = true;
    s.player.stunCards = 1;
    const [surprise, energy] = hand(s, "32037", "32052");
    s = finish(play(s, surprise, [energy]));
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(0);
    expect(s.player.exhausted).toBe(true);
    expect(shadowcatMassForm(s)).toBe("phased");
    expect(s.player.discard.some((p) => p.id === surprise.id)).toBe(true);
  });

  it("Defensive Energy draws before Mutant Protectors selects its real hand ally", () => {
    let s = base();
    const [protectors, energy, lockheed] = hand(s, "32017", "32018", "32032");
    const polaris = makePiece(s, "32012");
    polaris.ownerId = s.activePlayerId;
    s.player.deck.unshift(polaris);
    s = respond(attack(s), /Mutant Protectors/, "32017");
    s = pay(s, [energy], "energy");
    s = respond(s, /Defensive Energy/, "32018");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === polaris.id));
    expect(s.player.hand.some((p) => p.id === polaris.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === lockheed.id)).toBe(true);
    s = choose(s, polaris.id);
    s = finish(
      s,
      (v) => v.prompt?.options.find((o) => /Polaris/.test(o.label))?.id,
    );
    const actual = s.player.inPlay.find((p) => p.id === polaris.id);
    expect(actual).toBeTruthy();
    expect(actual?.exhausted).toBe(true);
    expect(card(actual!)).toMatchObject({ code: "32012", name: "Polaris" });
    expect(s.player.discard.some((p) => p.id === protectors.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
  });

  it("Nightcrawler waits until attack damage, pays Energy, and returns the actual foreign-owned ally", () => {
    let s = base("shadowcat", true);
    const owner = seatView(s, "p2").player;
    const index = owner.deck.findIndex((p) => p.code === "32011");
    expect(
      index,
      "original Colossus starter Nightcrawler",
    ).toBeGreaterThanOrEqual(0);
    const nightcrawler = owner.deck.splice(index, 1)[0];
    s.player.inPlay.push(nightcrawler);
    const lockheed = put(s, "32032");
    const [energy, mental] = hand(s, "32052", "32053");
    const hp = s.player.hp;
    s.encounter.deck.unshift(makePiece(s, "01130"));
    s = attack(s);
    expect(hasNightcrawlerInterrupt(s)).toBe(false);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === lockheed.id));
    expect(hasNightcrawlerInterrupt(s)).toBe(false);
    s = choose(s, lockheed.id);
    s = until(s, hasNightcrawlerInterrupt);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.attack?.boostCodes).toContain("01130");
    s = respond(s, /Nightcrawler/, "32011");
    const rejected = dispatch(reload(s), { type: "PAY", ids: [mental.id] });
    expect(rejected.error).toMatch(/energy/i);
    expect(rejected.player.inPlay.some((p) => p.id === nightcrawler.id)).toBe(
      true,
    );
    expect(rejected.player.hand.some((p) => p.id === mental.id)).toBe(true);
    s = finish(pay(s, [energy], "energy"));
    expect(s.player.inPlay.some((p) => p.id === nightcrawler.id)).toBe(false);
    expect(s.player.hand.some((p) => p.id === nightcrawler.id)).toBe(false);
    expect(
      seatView(s, "p2").player.hand.filter((p) => p.id === nightcrawler.id),
    ).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === lockheed.id)?.damage).toBe(0);
    expect(s.player.hp).toBe(hp - 1);
  });

  it("Tough prevents the would-take window for Nightcrawler", () => {
    let s = base("colossus");
    const nightcrawler = put(s, "32011");
    hand(s, "32022");
    s.player.tough = true;
    s.player.toughCards = 1;
    const hp = s.player.hp;
    s = until(
      attack(s),
      (v) => !!v.prompt?.options.some((o) => o.id === "take"),
    );
    s = choose(s, "take");
    expect(hasNightcrawlerInterrupt(s)).toBe(false);
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.toughCards).toBe(0);
    expect(s.player.inPlay.some((p) => p.id === nightcrawler.id)).toBe(true);
  });

  it("Piercing removes Tough before Nightcrawler's late would-take interrupt", () => {
    let s = base("colossus");
    const nightcrawler = put(s, "32011");
    const [energy] = hand(s, "32022");
    const unstoppable = nemesis(s, "32028");
    unstoppable.attachedTo = s.villain.id;
    s.attachments.push(unstoppable);
    s.player.tough = true;
    s.player.toughCards = 2;
    const hp = s.player.hp;
    s = until(attack(s), hasNightcrawlerInterrupt);
    expect(s.player.toughCards).toBe(0);
    expect(s.player.hp).toBe(hp);
    s = respond(s, /Nightcrawler/, "32011");
    s = finish(pay(s, [energy], "energy"));
    expect(s.player.hp).toBe(hp);
    expect(s.player.toughCards).toBe(0);
    expect(s.player.inPlay.some((p) => p.id === nightcrawler.id)).toBe(false);
    expect(s.player.hand.filter((p) => p.id === nightcrawler.id)).toHaveLength(
      1,
    );
    expect(s.encounter.discard.some((p) => p.id === unstoppable.id)).toBe(true);
  });
});
