import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { card, deckCodes, heroStats, maxHP } from "../src/game/cards.js";
import {
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  playable,
  dispatch,
} from "../src/game/engine.js";
import {
  heroStarterCodes,
  heroSupplementaryCards,
  isPermanent,
} from "../src/game/hero-runtime.js";
import { x23AttachmentTargets } from "../src/game/x23.js";
import { deckErrors } from "../src/game/decks.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { paymentSources } from "../src/game/payment.js";
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
} from "./dv-test-helpers.js";
import type { GameState } from "../src/game/types.js";
const base = (alter = false, team = false) => {
  let s = newGame({
    heroId: "x23",
    aspect: "aggression",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 43001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "x23", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  if (!alter) s = finish(command(s, { type: "FLIP" }));
  s.player.flipped = false;
  s.player.deck.push(...s.player.hand.splice(0));
  s.villain.hp = s.villain.maxHp = 80;
  s.scheme.threat = 15;
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
};
const cast = (s: GameState, code: string, ...payments: string[]) => {
  const ps = hand(s, code, ...payments);
  return play(s, ps[0], ps.slice(1));
};
const reveal = (s: GameState, code: string) => {
  const z = s.player.setAside || [];
  const i = z.findIndex((p) => p.code === code);
  return native(s, {
    type: "reveal",
    piece: i >= 0 ? z.splice(i, 1)[0] : makePiece(s, code),
  });
};
describe("X-23 full retail pack", () => {
  it("registers every face and retains the40+Permanent source composition and four physical linked upgrades", () => {
    const pack = catalog.filter((c) => c.pack_code === "x23");
    expect(pack).toHaveLength(41);
    expect(pack.filter((c) => !hasExecutableScript(c.code))).toEqual([]);
    expect(heroStarterCodes("x23")).toHaveLength(41);
    expect(deckCodes("x23", "aggression")).toEqual(heroStarterCodes("x23"));
    expect(deckErrors("x23", "aggression", heroStarterCodes("x23"))).toEqual(
      [],
    );
    expect(Object.keys(heroSupplementaryCards("x23"))).toEqual([
      "43034",
      "43035",
      "43036",
      "43037",
    ]);
    const s = base();
    expect(s.player.inPlay.filter((p) => p.code === "43002")).toHaveLength(1);
    expect(
      s.player.deck.length + s.player.hand.length + s.player.discard.length,
    ).toBe(40);
    expect(
      s.player.setAside?.filter((p) =>
        ["43034", "43035", "43036", "43037"].includes(p.code),
      ),
    ).toHaveLength(4);
  });
  it("pays Claws damage then optionally readies once per phase, retaining the round ATK modifier", () => {
    let s = base();
    s.player.exhausted = true;
    const claws = s.player.inPlay.find((p) => p.code === "43002")!;
    const hp = s.player.hp;
    s = command(s, { type: "ABILITY", id: claws.id, action: "claws" });
    expect(s.player.hp).toBe(hp - 2);
    expect(heroStats(s).attack).toBe(3);
    s = finish(respond(s, /Living Weapon/));
    expect(s.player.exhausted).toBe(false);
    s.player.exhausted = true;
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    expect(s.prompt).toBeNull();
    expect(s.player.exhausted).toBe(true);
    s.phase = "villain";
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    s = finish(respond(s, /Living Weapon/));
    expect(s.player.exhausted).toBe(false);
  });
  it("cannot pay a TAKE cost through Tough and fully prevented damage never readies", () => {
    let s = base();
    s.player.tough = true;
    s.player.exhausted = true;
    const claws = s.player.inPlay.find((p) => p.code === "43002")!;
    expect(nativeHeroAbilityOptions(s, claws.id)).toEqual([]);
    s = finish(native(s, { type: "damage", target: "hero", amount: 2 }));
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(true);
  });
  it("Honey Badger readies X-23 after surviving consequential damage, but not lethal damage", () => {
    let s = base();
    const b = put(s, "43003");
    s.player.exhausted = true;
    s = native(s, {
      type: "damage",
      target: b.id,
      amount: 1,
      source: "consequential",
    });
    s = finish(respond(s, /Honey Badger/));
    expect(s.player.exhausted).toBe(false);
    s.player.exhausted = true;
    s = finish(
      native(s, {
        type: "damage",
        target: b.id,
        amount: 1,
        source: "consequential",
      }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === b.id)).toBe(true);
  });
  it("Grim Resolve readies before a paid event resolves, and Pain Tolerance includes itself", () => {
    let s = base();
    s.player.hp = 7;
    s = cast(s, "43011", "43023");
    s = finish(respond(s, /Pain Tolerance/));
    expect(s.player.hp).toBe(8);
    const grim = put(s, "43010");
    s.player.exhausted = true;
    const [mastery] = hand(s, "43005");
    s = command(s, { type: "PLAY", id: mastery.id });
    expect(
      paymentSources(s, mastery.id, mastery.code).some((p) => p.id === grim.id),
    ).toBe(true);
    s = pay(s, [grim]);
    expect(s.player.hp).toBe(7);
    expect(heroStats(s).attack).toBe(1);
    s = respond(s, /Living Weapon/);
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(heroStats(s).attack).toBe(3);
  });
  it("Animal Instinct adds current ATK to ordinary THW and does not boost Assault", () => {
    let s = base();
    s.flags.x23ClawBonus = 2;
    const [animal] = hand(s, "43004");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, animal.id);
    s = pay(s, []);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(10);
    s = base();
    s.flags.x23ClawBonus = 2;
    const scheme = side(s, "43018", 10);
    const [a] = hand(s, "43004");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, a.id);
    s = pay(s, []);
    s = finish(target(s, scheme.id));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(7);
  });
  it("Sisterly Bond adds the named hero matching power to Honey Badger's attack", () => {
    let s = base();
    const b = put(s, "43003");
    s.flags.x23ClawBonus = 2;
    const [bond] = hand(s, "43007");
    s = command(s, { type: "ABILITY", id: b.id, action: "attack" });
    s = target(s, s.villain.id);
    s = choose(s, bond.id);
    s = pay(s, []);
    s = finish(s);
    expect(s.villain.hp).toBe(76);
    expect(s.player.inPlay.find((p) => p.id === b.id)?.damage).toBe(1);
  });
  it("Claw Mastery is max one per round and overkill requires Honey Badger in play", () => {
    let s = base();
    s = finish(cast(s, "43005", "43022"));
    expect(heroStats(s).attack).toBe(3);
    const [another] = hand(s, "43005");
    expect(playable(s, another)).toMatch(/one per round/i);
    put(s, "43003");
    const m = minion(s, "01103");
    m.damage = 2;
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(target(s, m.id));
    expect(s.villain.hp).toBe(78);
  });
  it("Regenerative Longevity distributes healing between actual characters", () => {
    let s = base();
    s.player.hp = 6;
    const b = put(s, "43003");
    b.damage = 1;
    s = cast(s, "43006", "43022");
    s = choose(s, b.id);
    s = choose(s, "hero");
    s = choose(s, "hero");
    s = finish(choose(s, "hero"));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === b.id)?.damage).toBe(0);
  });
  it("Laura Kinney shuffles a physical family card and draws once per round", () => {
    let s = base(true);
    const [b] = hand(s, "43003");
    s.player.hand = s.player.hand.filter((p) => p.id !== b.id);
    s.player.discard.push(b);
    s = command(s, { type: "ABILITY", id: "hero", action: "family" });
    s = finish(choose(s, b.id));
    expect(s.player.hand).toHaveLength(1);
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
    expect(
      [...s.player.hand, ...s.player.deck].filter((p) => p.id === b.id),
    ).toHaveLength(1);
  });
  it("Adamantium Lacing adjusts maximum and current HP and pierces Tough on basic attacks", () => {
    let s = base();
    s = finish(cast(s, "43009", "43022"));
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(12);
    s.villain.tough = true;
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(79);
    expect(s.villain.tough).toBe(false);
  });
  it("Specialized Training moves linked physical upgrades and newly granted Surveillance can draw", () => {
    let s = base();
    const scheme = side(s, "43021", 2);
    const original = s.player.setAside!.find((p) => p.code === "43037")!.id;
    const before = s.player.hand.length;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = target(s, scheme.id);
    s = choose(s, original);
    s = finish(respond(s, /Surveillance Specialist/));
    expect(s.player.inPlay.find((p) => p.id === original)?.exhausted).toBe(
      true,
    );
    expect(s.player.hand.length).toBe(before + 1);
    expect(s.victoryDisplay?.some((p) => p.id === scheme.id)).toBe(true);
    expect(heroStats(s).thwart).toBe(3);
  });
  it("Puncture Wound requires this turn's attack, reduces ATK, then deals3 and discards at phase start", () => {
    let s = base();
    const [w] = hand(s, "43012");
    expect(playable(s, w)).toMatch(/attacked/);
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(target(s, s.villain.id));
    s = play(s, w, []);
    s = finish(choose(s, s.villain.id));
    expect(s.player.inPlay.find((p) => p.id === w.id)?.attachedTo).toBe(
      s.villain.id,
    );
  });
  it("put-into-play attachment eligibility retains Puncture Wound's attack history", () => {
    let s = base();
    const [w] = hand(s, "43012");
    const untouched = minion(s, "01103");
    const ports = {
      permanent: (_: GameState, p: typeof w) => isPermanent(card(p)),
    };
    expect(x23AttachmentTargets(s, w, ports)).toEqual([]);
    expect(x23AttachmentTargets(s, makePiece(s, "43009"), ports)).toBeNull();
    s = finish(
      target(command(s, { type: "BASIC", action: "attack" }), s.villain.id),
    );
    expect(x23AttachmentTargets(s, w, ports)?.map((q) => q.id)).toEqual([
      s.villain.id,
    ]);
    expect(
      x23AttachmentTargets(s, w, ports)?.some((q) => q.id === untouched.id),
    ).toBe(false);
    // An attack in the previous player's turn cannot authorize this entry.
    s.turnPlayerId = "next-player";
    expect(x23AttachmentTargets(s, w, ports)).toEqual([]);
  });
  it("put-into-play attachment eligibility excludes main/permanent/occupied side schemes", () => {
    const s = base(false, true);
    s.sideSchemes = [];
    const approach = makePiece(s, "43020");
    const ports = {
      permanent: (_: GameState, p: typeof approach) => isPermanent(card(p)),
    };
    expect(x23AttachmentTargets(s, approach, ports)).toEqual([]);
    side(s, "34030", 10);
    expect(x23AttachmentTargets(s, approach, ports)).toEqual([]);
    const occupied = side(s, "01107", 10);
    const existing = makePiece(s, "43020");
    existing.attachedTo = occupied.id;
    seatView(s, s.players[1]).player.inPlay.push(existing);
    expect(x23AttachmentTargets(s, approach, ports)).toEqual([]);
    const eligible = side(s, "43018", 10);
    expect(x23AttachmentTargets(s, approach, ports)?.map((q) => q.id)).toEqual([
      eligible.id,
    ]);
    s.player.inPlay.push(approach);
    approach.attachedTo = eligible.id;
    expect(x23AttachmentTargets(s, approach, ports)?.map((q) => q.id)).toEqual([
      eligible.id,
    ]);
  });
  it("Rictor counts printed icons and only damages his controller's engaged minions", () => {
    let s = base(false, true);
    const r = put(s, "43014"),
      m = minion(s, "01103"),
      other = minion(s, "01103");
    m.engagedWith = "p1";
    other.engagedWith = "p2";
    top(s, "43022");
    s = command(s, { type: "ABILITY", id: r.id, action: "attack" });
    s = target(s, s.villain.id);
    s = finish(respond(s, /Rictor/));
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(2);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(0);
  });
  it("Self-Isolation stores the exact Honey Badger and basic recovery discards both", () => {
    let s = base(true);
    const b = put(s, "43003");
    s.player.hp = 5;
    s = reveal(s, "43028");
    s = finish(s);
    const obligation = s.player.inPlay.find((p) => p.code === "43028")!;
    expect(obligation.storedCards?.map((p) => p.id)).toEqual([b.id]);
    s = command(s, { type: "BASIC", action: "recover" });
    s = finish(respond(s, /Self-Isolation/));
    expect(s.player.discard.some((p) => p.id === b.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
  });
  it("Hack 'n' Slash and its boost discard one physical random card and damage by printed resources", () => {
    let s = base();
    hand(s, "43022");
    s = finish(reveal(s, "43033"));
    expect(s.player.hp).toBe(8);
    expect(s.player.hand).toHaveLength(0);
  });
  it("Cybermods returns the defeated physical Lady Deathstrike to encounter deck and removes its attachment", () => {
    let s = base();
    s = finish(reveal(s, "43029"));
    const m = s.minions.find((p) => p.code === "43029")!;
    s = finish(reveal(s, "43031"));
    expect(s.attachments.find((p) => p.code === "43031")?.attachedTo).toBe(
      m.id,
    );
    s = finish(native(s, { type: "damage", target: m.id, amount: 5 }));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.encounter.deck.some((p) => p.id === m.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.code === "43031")).toBe(true);
  });
});

describe("X-23 retail additional cards and shared ownership", () => {
  it("Boom Boom adds counters without damage until the optional detonation", () => {
    let s = base();
    const boom = put(s, "43013"),
      m = minion(s, "01103");
    s = finish(command(s, { type: "ABILITY", id: boom.id, action: "boom" }));
    expect(s.player.inPlay.find((p) => p.id === boom.id)?.counters).toBe(1);
    expect(s.villain.hp).toBe(80);
    s.player.inPlay.find((p) => p.id === boom.id)!.exhausted = false;
    s = command(s, { type: "ABILITY", id: boom.id, action: "boom" });
    s = finish(respond(s, /Boom Boom/));
    expect(s.villain.hp).toBe(78);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(2);
    expect(s.player.discard.some((p) => p.id === boom.id)).toBe(true);
  });
  it("Shatterstar engages another player's minion without gaining the already-engaged bonus", () => {
    let s = base(false, true);
    const star = put(s, "43015"),
      m = minion(s, "01103");
    m.engagedWith = "p2";
    s = command(s, { type: "ABILITY", id: star.id, action: "attack" });
    s = finish(respond(target(s, m.id), /Shatterstar/));
    expect(s.minions.find((p) => p.id === m.id)?.engagedWith).toBe("p1");
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(2);
    s = base();
    const r = put(s, "43015"),
      own = minion(s, "01103");
    s = command(s, { type: "ABILITY", id: r.id, action: "attack" });
    s = finish(respond(target(s, own.id), /Shatterstar/));
    expect(s.minions.some((p) => p.id === own.id)).toBe(false);
  });
  it("Critical Hit is a paid victory-gated attack response and does not attack again", () => {
    let s = base();
    const [hit, energy] = hand(s, "43016", "43022");
    expect(playable(s, hit)).toMatch(/response window/);
    s.victoryDisplay = [makePiece(s, "43018")];
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, s.villain.id);
    s = respond(s, /Critical Hit/);
    s = finish(pay(s, [energy]));
    expect(s.villain.hp).toBe(79);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.discard.some((p) => p.id === hit.id)).toBe(true);
  });
  it("Moment of Triumph reprint heals actual excess damage from the same attack", () => {
    let s = base();
    s.player.hp = 4;
    s.flags.x23ClawBonus = 2;
    const m = minion(s, "01103");
    m.damage = 2;
    hand(s, "43017");
    s = command(s, { type: "BASIC", action: "attack" });
    s = target(s, m.id);
    s = respond(s, /Moment of Triumph/);
    s = finish(pay(s, []));
    expect(s.player.hp).toBe(6);
  });
  it("The Direct Approach uses ATK for a basic thwart and keeps the same attached physical card", () => {
    let s = base();
    s.flags.x23ClawBonus = 2;
    const scheme = side(s, "01107", 7);
    s = cast(s, "43020", "43022");
    s = finish(choose(s, scheme.id));
    s = command(s, { type: "BASIC", action: "thwart" });
    s = finish(target(s, scheme.id));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(4);
  });
  it("Keep Them Busy and Rally the Troops resolve native When Defeated effects", () => {
    let s = base();
    const busy = side(s, "43018", 1);
    s = command(s, { type: "BASIC", action: "thwart" });
    s = finish(target(s, busy.id));
    expect(s.scheme.threat).toBe(10);
    expect(s.victoryDisplay?.some((p) => p.id === busy.id)).toBe(true);
    const b = put(s, "43003");
    b.damage = 1;
    const r = put(s, "43015");
    r.damage = 3;
    const rally = side(s, "43039", 1);
    s = finish(native(s, { type: "thwart", target: rally.id, amount: 1 }));
    expect(s.player.inPlay.find((p) => p.id === b.id)?.damage).toBe(0);
    expect(s.player.inPlay.find((p) => p.id === r.id)?.damage).toBe(1);
  });
  it("Now I'm Mad compares current HP with printed starting HP, ignoring Endurance", () => {
    let s = base();
    put(s, "43019");
    put(s, "43027");
    s.player.hp = 5;
    expect(heroStats(s).attack).toBe(1);
    s.player.hp = 4;
    expect(heroStats(s).attack).toBe(2);
    expect(heroStats(s).thwart).toBe(1);
  });
  it("Predictable Ploy cancels only a revealed encounter-deck treachery with a victory scheme", () => {
    let s = base();
    s.victoryDisplay = [makePiece(s, "43018")];
    const [event, energy] = hand(s, "43038", "43022");
    const treachery = makePiece(s, "01112");
    s = native(s, {
      type: "reveal",
      piece: treachery,
      fromEncounterDeck: true,
    });
    s = respond(s, /Predictable Ploy/);
    s = finish(pay(s, [energy]));
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(
      s.encounter.discard.filter((p) => p.id === treachery.id),
    ).toHaveLength(1);
  });
  it("Anticipated Attack gives Tough during attack initiation and becomes an event defense", () => {
    let s = base();
    s.victoryDisplay = [makePiece(s, "43018")];
    const [event, energy] = hand(s, "43040", "43022");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Anticipated Attack/);
    s = pay(s, [energy]);
    s = finish(s);
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Specialized Training grants other players ownership, and discarded linked upgrades may be played normally", () => {
    let s = base(false, true);
    const scheme = side(s, "43021", 1);
    s = native(s, { type: "thwart", target: scheme.id, amount: 1 });
    const a = s.player.setAside!.find((p) => p.code === "43034")!,
      b = s.player.setAside!.find((p) => p.code === "43036")!;
    s = choose(s, a.id);
    s = finish(choose(s, b.id));
    const other = seatView(s, "p2");
    expect(other.player.inPlay.find((p) => p.id === b.id)?.ownerId).toBe("p2");
    expect(maxHP(other)).toBe(14);
    expect(other.player.hp).toBe(14);
    activateSeat(s, "p1");
    s = finish(native(s, { type: "discardPiece", id: a.id }));
    const [upgrade, energy] = hand(s, "43034", "43022");
    expect(upgrade.id).toBe(a.id);
    expect(playable(s, upgrade)).toBeFalsy();
    s = finish(play(s, upgrade, [energy]));
    expect(s.player.inPlay.some((p) => p.id === a.id)).toBe(true);
  });
  it("Honey Badger's response follows her current controller and the named X-23 seat", () => {
    let s = base(false, true);
    const b = put(s, "43003");
    s.player.inPlay = s.player.inPlay.filter((p) => p.id !== b.id);
    seatView(s, "p2").player.inPlay.push(b);
    seatView(s, "p2").player.form = "hero";
    s.player.exhausted = true;
    s = native(s, { type: "damage", target: b.id, amount: 1 });
    s = finish(respond(s, /Honey Badger/));
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === b.id)?.damage,
    ).toBe(1);
  });
  it("Critical Wound discards and damages exactly its attached identity at that player's turn end", () => {
    let s = base(false, true);
    s = finish(reveal(s, "43032"));
    s = command(s, { type: "END_TURN" });
    s = finish(s);
    expect(seatView(s, "p1").player.hp).toBe(6);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.attachments.some((p) => p.code === "43032")).toBe(false);
  });
  it("IPAC reprint uses its native shared support action and X-Force requirement", () => {
    let s = base();
    s = finish(cast(s, "43025", "43022"));
    const ipac = s.player.inPlay.find((p) => p.code === "43025")!;
    s = command(s, { type: "ABILITY", id: ipac.id, action: "ipac" });
    s = finish(choose(s, "p1"));
    expect(s.player.hand).toHaveLength(2);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === ipac.id)?.exhausted).toBe(true);
  });
});

describe("X-23 timing and conservation regressions", () => {
  it("multiple Animal Instinct interrupts add THW for one basic thwart", () => {
    let s = base();
    const [a, b] = hand(s, "43004", "43004");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, a.id);
    s = pay(s, []);
    s = choose(s, b.id);
    s = pay(s, []);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(11);
    expect(
      s.player.discard.filter((p) => [a.id, b.id].includes(p.id)),
    ).toHaveLength(2);
  });
  it("Assault ally thwarts use printed ATK consequential damage and thwart modifiers", () => {
    let s = base();
    const ally = put(s, "43015"),
      scheme = side(s, "43018", 10);
    s = command(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    s = finish(target(s, scheme.id));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(8);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("Puncture Wound resolves exactly once at the next player phase and attack history expires at turn end", () => {
    let s = base();
    const [w] = hand(s, "43012");
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(target(s, s.villain.id));
    s = finish(choose(play(s, w, []), s.villain.id));
    const hp = s.villain.hp;
    s = finish(native(s, { type: "newRound" }));
    expect(s.villain.hp).toBe(hp - 3);
    expect(s.player.discard.some((p) => p.id === w.id)).toBe(true);
    const [other] = hand(s, "43012");
    expect(playable(s, other)).toMatch(/attacked/);
  });
  it("Critical Wound is one physical attachment across save reload and end-turn resolution", () => {
    let s = base(false, true);
    s = finish(reveal(s, "43032"));
    const a = s.attachments.find((p) => p.code === "43032")!;
    expect(s.attachments.filter((p) => p.id === a.id)).toHaveLength(1);
    s = finish(command(reload(s), { type: "END_TURN" }));
    expect(s.encounter.discard.filter((p) => p.id === a.id)).toHaveLength(1);
    expect(seatView(s, "p1").player.hp).toBe(6);
  });
  it("Sisterhood discards an actual signature card and searches both owned zones", () => {
    let s = base();
    const support = put(s, "43008"),
      [bond] = hand(s, "43007");
    const original = [...s.player.deck, ...s.player.discard].find(
      (p) => p.code === "43003",
    )!.id;
    s = command(s, { type: "ABILITY", id: support.id, action: "sisterhood" });
    s = finish(choose(s, bond.id));
    expect(s.player.hand.map((p) => p.id)).toEqual([original]);
    expect(s.player.discard.some((p) => p.id === bond.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === support.id)?.exhausted).toBe(
      true,
    );
  });
  it("Front Line Specialist draws only after actual enemy-attack damage, in either form", () => {
    let s = base(true);
    put(s, "43036");
    s.player.hp = 14;
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    expect(s.prompt).toBeNull();
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }), (v) =>
      v.prompt?.title === "Front Line Specialist" ? "yes" : undefined,
    );
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.code === "43036")?.exhausted).toBe(
      true,
    );
  });
  it("Shadows of the Past moves all five original nemesis instances instead of fabricating cards", () => {
    let s = base();
    const originals = s.player
      .setAside!.filter((p) => card(p).set_code === "x23_nemesis")
      .map((p) => p.id);
    s = finish(reveal(s, "01190"));
    const all = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.encounter.deck,
      ...s.encounter.discard,
      ...s.resolving,
    ];
    for (const id of originals)
      expect(all.filter((p) => p.id === id)).toHaveLength(1);
    expect(s.minions.some((p) => p.code === "43029")).toBe(true);
    expect(s.sideSchemes.some((p) => p.code === "43030")).toBe(true);
  });
});
it("Sisterly Bond adds THW for a thwart, which Assault does not use", () => {
  let s = base();
  s.flags.x23ClawBonus = 2;
  const b = put(s, "43003"),
    scheme = side(s, "43018", 10);
  const [bond] = hand(s, "43007");
  s = command(s, { type: "ABILITY", id: b.id, action: "thwart" });
  s = target(s, scheme.id);
  s = choose(s, bond.id);
  s = pay(s, []);
  s = finish(s);
  expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(9);
  expect(s.player.inPlay.find((p) => p.id === b.id)?.damage).toBe(1);
});
