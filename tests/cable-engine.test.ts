import { captainPackHasTrait } from "../src/game/captain-pack.js";
import { describe, it, expect } from "vitest";
import { card, deckCodes, heroStats, resources } from "../src/game/cards.js";
import {
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  playable,
  cardCost,
  nativeCanPutIntoPlay,
  nativePutIntoPlay,
} from "../src/game/engine.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { deckErrors, deckOptions } from "../src/game/decks.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import {
  CABLE_SCRIPT_CODES,
  cableCanRemoveThreat,
  cableCanDamage,
  cableVictoryCount,
} from "../src/game/cable.js";
import { paymentSources } from "../src/game/payment.js";
import { seatView } from "../src/game/team.js";
import type { GameState } from "../src/game/types.js";
import {
  command,
  until,
  choose,
  finish,
  native,
  hand,
  put,
  play,
  pay,
  target,
  respond,
  reload,
  minion,
  side,
} from "./dv-test-helpers.js";
function starting(team = false) {
  return newGame({
    heroId: "cable",
    aspect: "leadership",
    villainId: "rhino",
    module: "bomb_scare",
    pacing: "expert",
    seed: 40001,
    ...(team
      ? {
          heroes: [
            { heroId: "cable", aspect: "leadership" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
}
function base(form: "hero" | "alter" = "hero", team = false) {
  let s = starting(team);
  for (let n = 0; s.phase === "mulligan" && n < 4; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  if (form === "hero") s = finish(command(s, { type: "FLIP" }));
  s.player.deck.push(...s.player.hand.splice(0));
  s.player.flipped = false;
  s.villain.hp = s.villain.maxHp = 80;
  s.scheme.threat = 2;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
function cast(s: GameState, code: string, ...paid: string[]) {
  const p = hand(s, code, ...paid);
  return play(s, p[0], p.slice(1));
}
function victory(s: GameState, code = "40006") {
  const p = makePiece(s, code);
  p.ownerId = s.activePlayerId;
  (s.victoryDisplay ||= []).push(p);
  return p;
}
function reveal(s: GameState, code: string) {
  const zone = s.player.setAside || [],
    i = zone.findIndex((p) => p.code === code);
  return native(s, {
    type: "reveal",
    piece: i < 0 ? makePiece(s, code) : zone.splice(i, 1)[0],
  });
}

describe("Cable source and setup", () => {
  it("registers37faces and original40including off-aspect player side schemes", () => {
    expect(CABLE_SCRIPT_CODES).toHaveLength(37);
    expect(CABLE_SCRIPT_CODES.filter((c) => !hasExecutableScript(c))).toEqual(
      [],
    );
    expect(heroStarterCodes("cable")).toHaveLength(40);
    expect(
      deckErrors("cable", "leadership", heroStarterCodes("cable")),
    ).toEqual([]);
    expect(
      deckOptions("cable", "leadership").some((p) => p.code === "40019"),
    ).toBe(true);
    expect(
      deckOptions("cable", "leadership").some((p) => p.code === "40020"),
    ).toBe(true);
  });
  it.each(["aggression", "justice", "leadership", "protection"] as const)(
    "builds legal %s deck",
    (aspect) => {
      expect(deckErrors("cable", aspect, deckCodes("cable", aspect))).toEqual(
        [],
      );
    },
  );
  it("sets aside five physical nemesis cards and searches only deck/discard after mulligan", () => {
    let s = starting();
    expect(s.player.setAside?.map((p) => p.code)).toEqual([
      "40032",
      "40033",
      "40034",
      "40035",
      "40036",
    ]);
    const ids = new Set([...s.player.deck, ...s.player.hand].map((p) => p.id));
    s = command(s, {
      type: "MULLIGAN",
      ids: s.player.hand.filter((p) => p.code === "40020").map((p) => p.id),
    });
    expect(s.prompt?.title).toBe("Soldier X");
    const option = s.prompt!.options.find((o) => o.image === "40020")!;
    expect(option).toBeTruthy();
    const original = option.id;
    s = finish(choose(reload(s), original));
    expect(s.sideSchemes.find((p) => p.id === original)).toMatchObject({
      code: "40020",
      counters: 2,
      ownerId: "p1",
    });
    expect(ids.has(original)).toBe(true);
    expect(
      [...s.player.deck, ...s.player.hand].some((p) => p.id === original),
    ).toBe(false);
  });
  it("Purge grants stats and Psionic only while physically in victory display", () => {
    const s = base();
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 2 });
    victory(s);
    expect(heroStats(reload(s))).toMatchObject({
      attack: 3,
      thwart: 3,
      defense: 3,
    });
    s.victoryDisplay = [];
    expect(heroStats(s).attack).toBe(2);
  });
});
describe("Cable side schemes and responses", () => {
  it("Establish Perimeter resolves tough and victory, then hero can ready once per phase", () => {
    let s = base();
    const p = side(s, "40020", 2);
    p.ownerId = "p1";
    s.player.exhausted = true;
    s = native(s, {
      type: "thwart",
      target: p.id,
      amount: 2,
      basic: true,
      source: "hero",
    });
    s = finish(respond(s, /Cable/));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.tough).toBe(true);
    expect(s.victoryDisplay?.some((q) => q.id === p.id)).toBe(true);
    s.player.exhausted = true;
    const p2 = side(s, "01107", 1);
    s = finish(
      native(s, { type: "thwart", target: p2.id, amount: 1, source: "hero" }),
    );
    expect(s.player.exhausted).toBe(true);
  });
  it("Cable cannot ready for an ally defeating a scheme", () => {
    let s = base();
    const ally = put(s, "40024"),
      p = side(s, "01107", 1);
    s.player.exhausted = true;
    s = finish(
      native(s, { type: "thwart", target: p.id, amount: 1, source: ally.id }),
    );
    expect(s.player.exhausted).toBe(true);
  });
  it("Graymalkin can generate energy in either form and ready after any side scheme defeat", () => {
    let s = base("alter");
    const p = put(s, "40007");
    expect(paymentSources(s).find((q) => q.id === p.id)?.resources).toEqual([
      "energy",
    ]);
    p.exhausted = true;
    const scheme = side(s, "01107", 1);
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: 1,
      source: "support",
    });
    s = finish(respond(s, /Graymalkin/));
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(false);
  });
  it("Mission Leader discounts Soldier and draws for every player after defeat", () => {
    let s = base("hero", true);
    const p = put(s, "40023");
    expect(cardCost(s, card(p), p)).toBe(1);
    const before = [s.player.hand.length, seatView(s, "p2").player.hand.length],
      q = side(s, "01107", 1);
    s = native(s, { type: "thwart", target: q.id, amount: 1 });
    s = finish(respond(s, /Mission Leader/));
    expect(s.player.hand).toHaveLength(before[0] + 1);
    expect(seatView(s, "p2").player.hand).toHaveLength(before[1] + 1);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Forced Amnesia retains original side scheme and upgrade in victory display", () => {
    let s = base();
    const p = put(s, "40010"),
      q = side(s, "01107", 1);
    s = native(s, { type: "thwart", target: q.id, amount: 1 });
    s = finish(respond(s, /Forced Amnesia/));
    expect(s.victoryDisplay?.map((p) => p.id)).toEqual(
      expect.arrayContaining([p.id, q.id]),
    );
    expect(s.encounter.discard.some((p) => p.id === q.id)).toBe(false);
    expect(cableVictoryCount(s)).toBe(1);
  });
  it("Call for Backup finds the physical ally and triggers its enters-play response", () => {
    let s = base();
    const q = side(s, "40018", 1);
    q.ownerId = "p1";
    const ally = s.player.deck.find((p) => p.code === "40015")!;
    s = native(s, { type: "thwart", target: q.id, amount: 1 });
    s = respond(s, /Call for Backup/);
    s = choose(s, ally.id);
    s = respond(s, /Fantomex/);
    const eva = s.prompt!.options.find((o) => o.image === "40021")!;
    s = finish(choose(s, eva.id));
    expect(s.player.inPlay.map((p) => p.code)).toEqual(
      expect.arrayContaining(["40015", "40021"]),
    );
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
  });
  it("Purge forbids allies, allows Cable hero events and any player's independent support", () => {
    const s = base("hero", true),
      q = side(s, "40006", 5),
      ally = put(s, "40024"),
      eva = put(s, "40021");
    expect(cableCanRemoveThreat(s, q.id)).toBe(true);
    expect(cableCanRemoveThreat(s, q.id, ally.id)).toBe(false);
    expect(cableCanRemoveThreat(seatView(s, "p2"), q.id)).toBe(false);
    expect(cableCanRemoveThreat(seatView(s, "p2"), q.id, eva.id)).toBe(true);
  });
});
describe("Cable native actions and events", () => {
  it("Mind Scan scales with only side schemes in victory display", () => {
    let s = base();
    s.scheme.threat = 6;
    victory(s);
    victory(s, "40010");
    s = target(cast(s, "40003", "01088"), "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(2);
  });
  it("Telekinetic Blast scales damage", () => {
    let s = base();
    victory(s);
    const before = s.villain.hp;
    s = finish(target(cast(s, "40005", "01088", "01089"), s.villain.id));
    expect(s.villain.hp).toBe(before - 7);
  });
  it("Precognition discards an actual encounter card and orders remaining originals through reload", () => {
    let s = base();
    victory(s);
    victory(s, "40020");
    victory(s, "40018");
    const ids = s.encounter.deck.slice(0, 3).map((p) => p.id);
    s = cast(s, "40004");
    s = choose(reload(s), ids[1]);
    s = choose(reload(s), ids[2]);
    s = finish(choose(reload(s), ids[0]));
    expect(s.encounter.deck.slice(0, 2).map((p) => p.id)).toEqual([
      ids[2],
      ids[0],
    ]);
    expect(s.encounter.discard.some((p) => p.id === ids[1])).toBe(true);
  });
  it("Professor exhausts to draw in alter ego", () => {
    let s = base("alter"),
      p = put(s, "40008");
    s = command(s, { type: "ABILITY", id: p.id, action: "professor" });
    s = finish(choose(s, "draw"));
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Plasma Rifle requires energy and exhausts, caps ranged damage at4", () => {
    let s = base();
    for (let i = 0; i < 6; i++) victory(s);
    const p = put(s, "40011"),
      r = hand(s, "01088")[0],
      before = s.villain.hp;
    s = command(s, { type: "ABILITY", id: p.id, action: "plasma" });
    s = pay(s, [r]);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(before - 4);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Power of the Mind doubles only for Psionic", () => {
    expect(resources(card("40028"), card("40003"))).toEqual([
      "mental",
      "mental",
    ]);
    expect(resources(card("40028"), card("40007"))).toEqual(["mental"]);
  });
  it("Psimitar responds once to another Psionic card and resolves native attack", () => {
    let s = base();
    const p = put(s, "40029"),
      before = s.villain.hp;
    s = target(cast(s, "40003", "01088"), "main");
    s = respond(s, /Psimitar/);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(before - 2);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Bodyslide changes Cable without spending the once-round voluntary change", () => {
    let s = base();
    s = finish(cast(s, "40002"));
    expect(s.player.form).toBe("alter");
    expect(s.player.flipped).toBe(false);
  });
  it("EVA is discarded when Fantomex leaves", () => {
    let s = base();
    const p = put(s, "40015"),
      eva = put(s, "40021");
    s = finish(native(s, { type: "discardPiece", id: p.id }));
    expect(s.player.inPlay.some((q) => q.id === eva.id)).toBe(false);
  });
});
describe("Cable defensive upgrades and nemesis", () => {
  it("Telekinetic Force Field protects a teammate and preserves actual owner", () => {
    let s = base("hero", true);
    const p = put(s, "40012"),
      hp = seatView(s, "p2").player.hp;
    s = native(s, { type: "damage", target: "hero:p2", amount: 4 });
    s = respond(s, /Telekinetic Force Field/);
    s = finish(s);
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(
      s.player.discard.some((q) => q.id === p.id && q.ownerId === "p1"),
    ).toBe(true);
  });
  it("Temporal Leap moves preexisting threat before pending placement and removes physical upgrade", () => {
    let s = base();
    const p = put(s, "40013"),
      q = victory(s, "40020");
    s.scheme.threat = 6;
    s = native(s, { type: "threat", target: "main", amount: 2 });
    s = respond(s, /Temporal Leap/);
    s = choose(reload(s), q.id);
    s = finish(s);
    expect(s.phase).not.toBe("lost");
    expect(s.scheme.threat).toBe(4);
    expect(s.sideSchemes.find((p) => p.id === q.id)?.counters).toBe(6);
    expect(s.removed.some((q) => q.id === p.id)).toBe(true);
  });
  it("Temporal Leap can still lose when pending threat exceeds the moved threat", () => {
    let s = base();
    put(s, "40013");
    const q = victory(s, "40020");
    s.scheme.threat = 6;
    s = native(s, { type: "threat", target: "main", amount: 6 });
    s = respond(s, /Temporal Leap/);
    s = finish(choose(s, q.id));
    expect(s.phase).toBe("lost");
  });
  it("Stryfe cancels Psionic event after payment and takes1damage", () => {
    let s = base();
    const p = minion(s, "40032"),
      before = s.villain.hp;
    s = finish(cast(s, "40005", "01088", "01089"));
    expect(s.villain.hp).toBe(before);
    expect(s.minions.find((q) => q.id === p.id)?.damage).toBe(1);
    expect(s.player.discard.some((p) => p.code === "40005")).toBe(true);
  });
  it("enemy force field prevents each packet and leaves after preventing2or more", () => {
    let s = base(),
      m = minion(s, "40032");
    s = finish(reveal(s, "40034"));
    expect(s.attachments.find((p) => p.code === "40034")?.attachedTo).toBe(
      m.id,
    );
    s = finish(native(s, { type: "damage", target: m.id, amount: 1 }));
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(0);
    expect(s.attachments.some((p) => p.code === "40034")).toBe(true);
    s = finish(native(s, { type: "damage", target: m.id, amount: 2 }));
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(0);
    expect(s.attachments.some((p) => p.code === "40034")).toBe(false);
  });
  it("Back to the Future enforces player damage and threat restrictions", () => {
    const s = base("hero", true),
      q = side(s, "40033", 4),
      a = minion(s, "01103", "p1"),
      b = minion(s, "01103", "p2");
    expect(cableCanDamage(s, a.id)).toBe(true);
    expect(cableCanDamage(s, b.id)).toBe(false);
    expect(cableCanDamage(s, s.villain.id)).toBe(false);
    expect(cableCanDamage(seatView(s, "p2"), a.id)).toBe(false);
    expect(cableCanRemoveThreat(s, q.id)).toBe(true);
    expect(cableCanRemoveThreat(s, "main")).toBe(false);
  });
  it("obligation retrieves original Purge from victory and removes bonuses", () => {
    let s = base();
    const q = s.player.deck.splice(
      s.player.deck.findIndex((p) => p.code === "40006"),
      1,
    )[0];
    (s.victoryDisplay ||= []).push(q);
    s = finish(reveal(s, "40031"));
    expect(s.sideSchemes.find((p) => p.id === q.id)?.counters).toBe(5);
    expect(s.attachments.find((p) => p.code === "40031")?.attachedTo).toBe(
      q.id,
    );
    expect(heroStats(s).attack).toBe(2);
  });
  it("nemesis introduction uses original set aside cards", () => {
    let s = base();
    const ids = s.player.setAside!.map((p) => p.id);
    s = finish(reveal(s, "01190"));
    expect(s.player.setAside).toHaveLength(0);
    const cards = [...s.minions, ...s.sideSchemes, ...s.encounter.deck];
    for (const id of ids)
      expect(cards.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("Deadpool replaces lethal consequential damage with heal3and acceleration", () => {
    let s = base(),
      p = put(s, "40024");
    p.damage = 2;
    s = finish(
      native(s, {
        type: "damage",
        target: p.id,
        amount: 1,
        source: "consequential",
      }),
    );
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(0);
    expect(s.encounter.acceleration).toBe(1);
  });
  it("Deadpool can be defeated by ordinary damage", () => {
    let s = base(),
      p = put(s, "40024");
    p.damage = 2;
    s = finish(
      native(s, { type: "damage", target: p.id, amount: 1, source: "test" }),
    );
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
  });
});

describe("Cable shared cards and saved native entry", () => {
  it("Caliban discards until the next qualifying actual ally and returns it", () => {
    let s = base();
    const [caliban, energy] = hand(s, "40014", "01088");
    const other = hand(s, "40024")[0];
    s.player.hand = [caliban, energy];
    s.player.deck = s.player.deck.filter(
      (p) => p.id !== caliban.id && p.id !== energy.id && p.id !== other.id,
    );
    const top = makePiece(s, "40003");
    top.ownerId = "p1";
    s.player.deck.unshift(top, other);
    const extra = makePiece(s, "01090");
    extra.ownerId = "p1";
    s.player.hand.push(extra);
    s = play(s, caliban, [energy, extra]);
    s = finish(respond(s, /Caliban/));
    expect(s.player.hand.some((p) => p.id === other.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === top.id)).toBe(true);
  });
  it("Sunspot counts actual energy paid and damages only chosen seat's minions plus villain", () => {
    let s = base("hero", true);
    const mine = minion(s, "01103", "p1"),
      theirs = minion(s, "01103", "p2"),
      hp = s.villain.hp;
    const cards = hand(s, "40016", "01088", "40007");
    s = play(s, cards[0], cards.slice(1));
    s = respond(s, /Sunspot/);
    s = finish(choose(s, "p2"));
    expect(s.villain.hp).toBe(hp - 3);
    expect(s.minions.find((p) => p.id === mine.id)?.damage).toBe(0);
    expect(s.minions.some((p) => p.id === theirs.id)).toBe(false);
  });
  it("Mission Planning prevents consequential damage only until phase ends", () => {
    let s = base();
    victory(s);
    const ally = put(s, "40024");
    s = finish(cast(s, "40017", "01088"));
    s = finish(
      native(s, {
        type: "allyConsequence",
        id: ally.id,
        amount: 1,
        attack: true,
      }),
    );
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    s.phase = "villain";
    s = finish(
      native(s, {
        type: "allyConsequence",
        id: ally.id,
        amount: 1,
        attack: true,
      }),
    );
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("Uncanny X-Force increases THW and reduces side-scheme consequential damage", () => {
    let s = base();
    put(s, "40022");
    const ally = put(s, "40024"),
      scheme = side(s, "01107", 4);
    s = finish(
      target(
        command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
        scheme.id,
      ),
    );
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
  });
  it("Uncanny X-Force does not prevent main-scheme consequence", () => {
    let s = base();
    put(s, "40022");
    const ally = put(s, "40024");
    s.scheme.threat = 5;
    s = finish(
      target(
        command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
        "main",
      ),
    );
    expect(s.scheme.threat).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("Frenemies deals damage to both named characters and thwarts two different schemes", () => {
    let s = base();
    const deadpool = put(s, "40024"),
      scheme = side(s, "01107", 5);
    s.scheme.threat = 5;
    const hp = s.player.hp;
    s = cast(s, "40026", "40028");
    s = choose(s, "main");
    s = finish(choose(s, scheme.id));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.inPlay.find((p) => p.id === deadpool.id)?.damage).toBe(1);
    expect(s.scheme.threat).toBe(2);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
  });
  it("Sidearm reprint attaches once and increases the original ally's attack", () => {
    let s = base();
    const ally = put(s, "40024"),
      hp = s.villain.hp;
    s = cast(s, "40030", "40028");
    s = finish(target(s, ally.id));
    s = finish(
      target(
        command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.villain.hp).toBe(hp - 3);
    expect(s.player.inPlay.find((p) => p.code === "40030")?.attachedTo).toBe(
      ally.id,
    );
  });
  it("Build Support puts the original support into play without spending resources", () => {
    let s = base(),
      q = side(s, "40027", 1);
    q.ownerId = "p1";
    const support = s.player.deck.find((p) => p.code === "40007")!;
    s = native(s, { type: "thwart", target: q.id, amount: 1 });
    s = respond(s, /Build Support/);
    s = finish(choose(s, support.id));
    expect(s.player.inPlay.find((p) => p.id === support.id)).toMatchObject({
      code: "40007",
      ownerId: "p1",
    });
  });
  it("Lock and Load puts a physical weapon in play and enforces Restricted", () => {
    let s = base(),
      q = side(s, "40019", 1);
    q.ownerId = "p1";
    put(s, "40011");
    put(s, "40029");
    const extra = makePiece(s, "06009");
    extra.ownerId = "p1";
    s.player.deck.push(extra);
    s = native(s, { type: "thwart", target: q.id, amount: 1 });
    s = respond(s, /Lock and Load/);
    s = choose(s, extra.id);
    expect(s.prompt?.title).toBe("Restricted limit");
    s = finish(choose(s, extra.id));
    expect(s.player.discard.some((p) => p.id === extra.id)).toBe(true);
  });
  it("Deathlok recovers an ally attachment from another player's discard without changing owner", () => {
    let s = base("hero", true);
    const attachment = makePiece(s, "40030");
    attachment.ownerId = "p2";
    seatView(s, "p2").player.discard.push(attachment);
    const p = hand(s, "40025", "01088", "01089");
    s = play(s, p[0], p.slice(1));
    s = respond(s, /Deathlok/);
    s = finish(choose(reload(s), attachment.id));
    expect(s.player.inPlay.find((p) => p.id === attachment.id)).toMatchObject({
      ownerId: "p2",
      attachedTo: p[0].id,
    });
  });
  it("Askani'son only triggers for an actual hero defense and pays energy", () => {
    let s = base();
    const p = put(s, "40009"),
      r = hand(s, "01088")[0];
    s.scheme.threat = 5;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (q) => !!q.prompt?.options.some((o) => o.id === "hero"));
    s = choose(s, "hero");
    s = respond(s, /Askani/);
    s = pay(s, [r]);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(3);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Deadpool Tough prevents consequential damage without healing or acceleration", () => {
    let s = base();
    const p = put(s, "40024");
    p.damage = 2;
    p.tough = true;
    s = finish(
      native(s, {
        type: "damage",
        target: p.id,
        amount: 1,
        source: "consequential",
      }),
    );
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(2);
    expect(s.encounter.acceleration).toBe(0);
  });
});

describe("Cable rules-reference regressions", () => {
  it("Deadpool heals after the entire consequential packet, preserving excess damage", () => {
    let s = base();
    const p = put(s, "40024");
    p.damage = 2;
    s = finish(
      native(s, {
        type: "damage",
        target: p.id,
        amount: 2,
        source: "consequential",
      }),
    );
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
    expect(s.encounter.acceleration).toBe(1);
  });
  it("Deadpool still leaves play if one heal cannot cover lethal consequential damage", () => {
    let s = base();
    const p = put(s, "40024");
    p.damage = 2;
    s = finish(
      native(s, {
        type: "damage",
        target: p.id,
        amount: 4,
        source: "consequential",
      }),
    );
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
    expect(s.encounter.acceleration).toBe(1);
  });
  it("nemesis introduction retains unrelated set-aside physical cards", () => {
    let s = base();
    const other = makePiece(s, "41002a");
    s.player.setAside!.push(other);
    s = finish(reveal(s, "01190"));
    expect(s.player.setAside?.map((p) => p.id)).toEqual([other.id]);
  });
  it("Crisis prevents Temporal Leap before any card is removed", () => {
    let s = base();
    const p = put(s, "40013");
    victory(s, "40020");
    side(s, "01108", 3);
    expect(card("01108").scheme_crisis).toBeTruthy();
    s.scheme.threat = 6;
    s = finish(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.phase).toBe("lost");
    expect(s.removed.some((q) => q.id === p.id)).toBe(false);
  });
  it("Caliban retrieves the actual last-card ally after immediate deck recycling", () => {
    let s = base();
    const caliban = put(s, "40014"),
      last = makePiece(s, "40024");
    last.ownerId = "p1";
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck.push(last);
    const dealt = s.encounter.dealt.length;
    s = finish(native(s, { type: "cable:enter", id: caliban.id }));
    expect(s.player.hand.filter((p) => p.id === last.id)).toHaveLength(1);
    expect(s.player.deck.some((p) => p.id === last.id)).toBe(false);
    expect(s.encounter.dealt).toHaveLength(dealt + 1);
  });
  it("an already-in-play Purge receives the obligation without resetting its threat", () => {
    let s = base();
    const p = s.player.deck.splice(
      s.player.deck.findIndex((p) => p.code === "40006"),
      1,
    )[0];
    p.counters = 2;
    s.sideSchemes.push(p);
    const dealt = s.encounter.dealt.length;
    s = finish(reveal(s, "40031"));
    expect(s.sideSchemes.find((q) => q.id === p.id)?.counters).toBe(2);
    expect(s.attachments.find((q) => q.code === "40031")?.attachedTo).toBe(
      p.id,
    );
    expect(s.encounter.dealt).toHaveLength(dealt);
  });
  it("Technovirus Resurgence lets first player discard Purge and then deals the owner an encounter", () => {
    let s = base("hero", true);
    s.firstPlayerId = "p2";
    const existing = side(s, "40020", 4);
    existing.ownerId = "p2";
    s = reveal(s, "40031");
    expect(s.prompt?.title).toBe("Player side scheme limit");
    expect(s.activePlayerId).toBe("p2");
    const purge = s.sideSchemes.find((p) => p.code === "40006")!;
    s = finish(choose(reload(s), purge.id));
    expect(s.sideSchemes.some((p) => p.id === existing.id)).toBe(true);
    expect(s.attachments.some((p) => p.code === "40031")).toBe(false);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p1")).toHaveLength(1);
  });
  it("Stryfe's own damage is not prohibited by another player's Back to the Future", () => {
    let s = base("hero", true);
    const stryfe = minion(s, "40032", "p1");
    side(s, "40033", 4);
    s = finish(
      native(s, {
        type: "damage",
        target: stryfe.id,
        amount: 1,
        source: stryfe.id,
        actorId: "p2",
      }),
    );
    expect(s.minions.find((p) => p.id === stryfe.id)?.damage).toBe(1);
  });
});

describe("Telekinetic Force Field replacement timing", () => {
  it("ordinary Tough consumes its status without offering or discarding the field", () => {
    let s = base();
    const p = put(s, "40012");
    s.player.tough = true;
    const hp = s.player.hp;
    s = native(s, { type: "damage", target: "hero", amount: 3 });
    expect(s.prompt?.title).not.toBe("Telekinetic Force Field");
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
  });
  it("teammate Tough resolves before Cable can spend their field", () => {
    let s = base("hero", true);
    const p = put(s, "40012");
    seatView(s, "p2").player.tough = true;
    const hp = seatView(s, "p2").player.hp;
    s = native(s, { type: "damage", target: "hero:p2", amount: 3 });
    expect(s.prompt?.title).not.toBe("Telekinetic Force Field");
    s = finish(s);
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(seatView(s, "p2").player.tough).toBe(false);
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
  });
  it("enemy attack Tough resolves before optional field prevention", () => {
    let s = base();
    const p = put(s, "40012");
    s.player.tough = true;
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
  });
});

describe("Shared put-into-play entry", () => {
  it("native entry initializes uses and applies current/max HP together", () => {
    let s = base();
    const web = makePiece(s, "01008"),
      armor = makePiece(s, "01036");
    const hp = s.player.hp;
    nativePutIntoPlay(s, web);
    nativePutIntoPlay(s, armor);
    s = finish(native(s, ...s.queue));
    expect(s.player.inPlay.find((p) => p.id === web.id)?.counters).toBe(3);
    expect(s.player.hp).toBe(hp + 6);
  });
  it("a native enemy attachment can enter without transferring its owner to that enemy", () => {
    let s = base(),
      enemy = minion(s, "01103"),
      tracer = makePiece(s, "01007");
    nativePutIntoPlay(s, tracer);
    s = finish(choose(s, enemy.id));
    expect(s.player.inPlay.find((p) => p.id === tracer.id)).toMatchObject({
      ownerId: "p1",
      attachedTo: enemy.id,
    });
  });
  it("Mind Control put into play obeys non-Elite attachment constraints", () => {
    const s = base();
    minion(s, "40032");
    const elite = minion(s, "01102");
    expect(card(elite).traits).toContain("Elite");
    const mind = makePiece(s, "34009");
    s.minions = s.minions.filter((p) => p.id === elite.id);
    expect(nativeCanPutIntoPlay(s, mind)).toBe(false);
  });
  it("Mind Control applies its native control entry after choosing the original minion", () => {
    let s = base();
    const enemy = minion(s, "01103"),
      mind = makePiece(s, "34009");
    nativePutIntoPlay(s, mind);
    s = finish(choose(s, enemy.id));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === enemy.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === mind.id)?.attachedTo).toBe(
      enemy.id,
    );
  });
});

it("Purge supplies Psionic to shared trait consumers in both identity forms", () => {
  const s = base();
  victory(s);
  expect(captainPackHasTrait(s, "hero", "Psionic")).toBe(true);
  s.player.form = "alter";
  expect(captainPackHasTrait(s, "hero", "Psionic")).toBe(true);
  s.victoryDisplay = [];
  expect(captainPackHasTrait(s, "hero", "Psionic")).toBe(false);
});
