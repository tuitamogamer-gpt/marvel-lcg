/** Actual Vision source, native commands, save/reload and physical owned IDs. */
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import {
  aerial,
  card,
  deckCodes,
  handSize,
  heroCard,
  heroStats,
} from "../src/game/cards.js";
import { STARTER_DECKS, catalogDeckCodes } from "../src/game/catalog.js";
import {
  dispatch,
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
  playable,
  paymentSources,
} from "../src/game/engine.js";
import { printedKeyword } from "../src/game/keywords.js";
import { activateSeat, seatView } from "../src/game/team.js";
import { visionMassForm } from "../src/game/vision.js";
import type { Card, GameState, Piece } from "../src/game/types.js";
import {
  attach,
  choose,
  command,
  finish,
  hand,
  minion,
  native,
  pay,
  play,
  put,
  reload,
  respond,
  side,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

const raw = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
function starting(other?: "spider_man", visionSeat = "p1") {
  const vision = { heroId: "vision", aspect: "protection" as const },
    teammate = { heroId: "spider_man", aspect: "justice" as const };
  return newGame({
    ...vision,
    villainId: "rhino",
    seed: 26001,
    pacing: "expert",
    ...(other
      ? {
          heroes: visionSeat === "p1" ? [vision, teammate] : [teammate, vision],
        }
      : {}),
  });
}
function allPhysical(s: GameState) {
  const zones = [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.hand, p.deck, p.discard, p.inPlay, p.setAside || []];
    }),
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.environments || [],
    s.resolving,
    s.removed,
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
  ];
  const walk = (p: Piece): Piece[] => [
    p,
    ...(p.droneCard ? walk(p.droneCard) : []),
    ...(p.storedCards || []).flatMap(walk),
    ...(p.captured || []).flatMap(walk),
  ];
  return zones.flatMap((zone) => zone.flatMap(walk));
}
const ownedSource = (s: GameState, seat = s.activePlayerId) =>
  allPhysical(s).filter(
    (p) => p.ownerId === seat && raw.get(p.code)?.faction_code !== "encounter",
  );
function exact(s: GameState, pieces: Piece[]) {
  const all = allPhysical(s);
  expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
  for (const p of pieces)
    expect(
      all.filter((q) => q.id === p.id),
      `${p.code}:${p.id}`,
    ).toHaveLength(1);
}
function base(other?: "spider_man", visionSeat = "p1") {
  let s = starting(other, visionSeat);
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat),
      source = ownedSource(s, seat.id),
      mass = source.find((p) => ["26002", "26002b"].includes(p.code));
    v.player.deck = source.filter((p) => p.id !== mass?.id);
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = mass ? [mass] : [];
    if (mass) mass.code = "26002";
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.flipped = false;
    v.player.hp = 11;
    v.player.stunned = v.player.confused = v.player.tough = false;
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.environments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 8;
  activateSeat(s, visionSeat);
  s.turnPlayerId = visionSeat;
  return s;
}
const mass = (s: GameState) =>
  s.player.inPlay.find((p) => ["26002", "26002b"].includes(p.code))!;
function dense(s: GameState) {
  mass(s).code = "26002b";
  return s;
}
function actualEncounter(s: GameState, code: string, seat = s.activePlayerId) {
  const z = seatView(s, seat).player.setAside || [],
    i = z.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  return z.splice(i, 1)[0];
}

describe("Vision original source and printed setup timing", () => {
  it("creates the same41 physical source IDs, keeps Mass outside40 and opening hand5, then places it after mulligan", () => {
    let s = starting(),
      starter = STARTER_DECKS.find((d) => d.id === "starter-26001a")!;
    const original = ownedSource(s),
      p = original.find((p) => p.code === "26002")!;
    expect(deckCodes("vision", "protection").sort()).toEqual(
      catalogDeckCodes(starter).sort(),
    );
    expect(original).toHaveLength(41);
    expect(s.player.hand).toHaveLength(5);
    expect(s.player.deck).toHaveLength(35);
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(false);
    expect(s.player.setAside?.some((q) => q.id === p.id)).toBe(true);
    expect(handSize(s)).toBe(5);
    expect(heroCard(s).recover).toBe(3);
    expect(s.player.hp).toBe(11);
    s = finish(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.player.hand).toHaveLength(5);
    expect(handSize(s)).toBe(6);
    expect(mass(s).id).toBe(p.id);
    expect(visionMassForm(s)).toBe("intangible");
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "26029",
      "26030",
      "26031",
      "26032",
      "26032",
    ]);
    exact(s, original);
  });
  it("the original playable source has15 Hero17 Protection8 Basic without a reverse-face clone", () => {
    const s = starting(),
      source = ownedSource(s).filter((p) => p.code !== "26002");
    expect(source).toHaveLength(40);
    expect(
      source.filter((p) => raw.get(p.code)?.faction_code === "hero"),
    ).toHaveLength(15);
    expect(
      source.filter((p) => raw.get(p.code)?.faction_code === "protection"),
    ).toHaveLength(17);
    expect(
      source.filter((p) => raw.get(p.code)?.faction_code === "basic"),
    ).toHaveLength(8);
    expect(allPhysical(s).some((p) => p.code === "26002b")).toBe(false);
  });
  it("Density Manipulation flips the original physical card once per round without exhausting or consuming Hero/AE flip", () => {
    let s = base(),
      original = ownedSource(s),
      p = mass(s);
    s.player.flipped = true;
    s = command(s, { type: "ABILITY", id: "identity", action: "density" });
    s = finish(s);
    expect(mass(s)).toMatchObject({
      id: p.id,
      code: "26002b",
      exhausted: false,
    });
    expect(s.player.exhausted).toBe(false);
    expect(s.player.flipped).toBe(true);
    expect(nativeHeroAbilityOptions(s)).not.toContainEqual(
      expect.objectContaining({ id: "density" }),
    );
    const failed = dispatch(reload(s), {
      type: "ABILITY",
      id: "identity",
      action: "density",
    });
    expect(failed.error).toBeTruthy();
    expect(mass(failed).code).toBe("26002b");
    exact(s, original);
  });
  it("Dense supplies Hero2 ATK2 DEF and AE REC3+2 while Intangible supplies only AE hand+1", () => {
    let s = dense(base());
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 2 });
    s = command(s, { type: "FLIP" });
    expect(heroStats(s).recover).toBe(5);
    expect(handSize(s)).toBe(5);
    mass(s).code = "26002";
    expect(heroStats(s).recover).toBe(3);
    expect(handSize(s)).toBe(6);
  });
});

describe("Vision actual attacks, prevention, keywords and typed events", () => {
  it("Intangible rejects a Stunned basic attack before any exhaust/status mutation", () => {
    const s = base();
    s.player.stunned = true;
    const failed = dispatch(reload(s), { type: "BASIC", action: "attack" });
    expect(failed.error).toMatch(/cannot.*attack|intangible/i);
    expect(failed.player.stunned).toBe(true);
    expect(failed.player.exhausted).toBe(false);
  });
  it("Intangible cannot declare identity defense but still permits an ally defender", () => {
    let s = base();
    const ally = put(s, "26003"),
      enemy = minion(s, "01103");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === ally.id));
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(false);
    expect(s.prompt?.options.some((o) => o.id === ally.id)).toBe(true);
    s = finish(choose(s, ally.id));
  });
  it("constant Intangible reduction prevents the whole two-point attack before Tough", () => {
    let s = base();
    const enemy = minion(s, "01103");
    s.player.tough = true;
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: enemy.id }));
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(true);
  });
  it("nonattack damage is not reduced by Intangible", () => {
    let s = base();
    const hp = s.player.hp;
    s = finish(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 2,
        source: "01103",
        attack: false,
      }),
    );
    expect(s.player.hp).toBe(hp - 2);
  });
  it("native overkill reaching Vision is reduced without reducing the defending ally's packet", () => {
    let s = base();
    const ally = put(s, "26003"),
      hp = s.player.hp;
    ally.damage = 1;
    const charge = attach(s, "01099", s.villain.id);
    expect(card(charge).name).toBe("Charge");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = finish(
      choose(
        until(s, (v) => !!v.prompt?.options.some((o) => o.id === ally.id)),
        ally.id,
      ),
    );
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Cape synchronizes Stalwart immediately, clears both statuses and ceases granting it after Dense", () => {
    let s = base();
    const p = put(s, "26006");
    s.player.stunned = s.player.confused = true;
    s = finish(native(s));
    expect(s.player.stunned).toBe(false);
    expect(s.player.confused).toBe(false);
    s = finish(
      native(
        s,
        { type: "status", target: "hero:p1", status: "stunned" },
        { type: "status", target: "hero:p1", status: "confused" },
      ),
    );
    expect(s.player.stunned).toBe(false);
    expect(s.player.confused).toBe(false);
    s = finish(
      command(s, { type: "ABILITY", id: "identity", action: "density" }),
    );
    s = finish(
      native(s, { type: "status", target: "hero:p1", status: "stunned" }),
    );
    expect(s.player.stunned).toBe(true);
    exact(s, [p]);
  });
  it("Dense Cape retaliates only after the actual identity survives being attacked", () => {
    let s = dense(base());
    const cape = put(s, "26006"),
      enemy = minion(s, "01103"),
      hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: enemy.id }));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    exact(s, [cape]);
  });
  it.each([false, true])(
    "Solar Beam resolves only its native current branch (Dense=%s)",
    (isDense) => {
      let s = base();
      if (isDense) dense(s);
      const original = ownedSource(s),
        [event, a, b] = hand(s, "26008", "26025", "26026");
      s = finish(
        target(play(s, event, [a, b]), isDense ? s.villain.id : "main"),
      );
      expect(isDense ? s.villain.hp : s.scheme.threat).toBe(isDense ? 43 : 3);
      expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
      exact(s, original);
    },
  );
  it.each([false, true])(
    "Solar Beam only consumes its matching status after paying its actual cost (Dense=%s)",
    (isDense) => {
      let s = base();
      if (isDense) dense(s);
      s.player.stunned = s.player.confused = true;
      const [event, a, b] = hand(s, "26008", "26025", "26026"),
        hp = s.villain.hp,
        threat = s.scheme.threat;
      s = finish(play(s, event, [a, b]));
      expect(s.player.stunned).toBe(!isDense);
      expect(s.player.confused).toBe(isDense);
      expect(s.villain.hp).toBe(hp);
      expect(s.scheme.threat).toBe(threat);
      expect(s.player.discard.map((p) => p.id)).toEqual(
        expect.arrayContaining([event.id, a.id, b.id]),
      );
    },
  );
  it("Just Passing Through ignores both actual Patrol and Crisis without changing generic thwart restrictions", () => {
    let s = base();
    const patrol = [...raw.values()].find(
        (c) => c.type_code === "minion" && printedKeyword(c, "Patrol"),
      )!,
      crisis = [...raw.values()].find(
        (c) => c.type_code === "side_scheme" && c.scheme_crisis,
      )!;
    minion(s, patrol.code);
    side(s, crisis.code, 5);
    const [event, r] = hand(s, "26010", "26027");
    s = play(s, event, [r]);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(true);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(5);
  });
  it("Superdense Strike's native Piercing removes Tough before dealing five", () => {
    let s = dense(base());
    s.villain.tough = true;
    const [event, r] = hand(s, "26009", "26027");
    s = finish(target(play(s, event, [r]), s.villain.id));
    expect(s.villain.tough).toBe(false);
    expect(s.villain.hp).toBe(45);
  });
  it("Phase Disruption confuses and discards only a matching attachment on that actual enemy", () => {
    let s = base();
    const eligible = [...raw.values()].find(
        (c) =>
          c.type_code === "attachment" &&
          /Hero\s+Action/.test((c.text || "").replace(/<[^>]*>/g, "")),
      )!,
      p = attach(s, eligible.code, s.villain.id),
      other = attach(s, "01105", s.villain.id);
    const [event, r] = hand(s, "26011", "26025");
    s = play(s, event, [r]);
    s = target(s, s.villain.id);
    s = finish(target(s, p.id));
    expect(s.villain.confused).toBe(true);
    expect(s.attachments.some((q) => q.id === p.id)).toBe(false);
    expect(s.attachments.some((q) => q.id === other.id)).toBe(true);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
  });
});

describe("Vision actual upgrades, response order and ownership", () => {
  it("Solar Gem generates exactly one actual wild and exhausts for paid event cost", () => {
    let s = base();
    const gem = put(s, "26005"),
      [event] = hand(s, "26010");
    expect(aerial(s)).toBe(true);
    expect(
      paymentSources(s, event.id, event.code).find((p) => p.id === gem.id)
        ?.resources,
    ).toEqual(["wild"]);
    s = command(s, { type: "PLAY", id: event.id });
    s = finish(target(pay(s, [], undefined, [gem.id]), "main"));
    expect(s.player.inPlay.find((p) => p.id === gem.id)?.exhausted).toBe(true);
    expect(s.scheme.threat).toBe(5);
    exact(s, [gem, event]);
  });
  it("Density Control can retrieve the same discarded event before Dense draw, after saved choices", () => {
    let s = base();
    const original = ownedSource(s),
      p = mass(s),
      control = put(s, "26007"),
      event = hand(s, "26008")[0];
    s.player.discard.push(s.player.hand.splice(0, 1)[0]);
    const next = top(s, "26024");
    s = command(s, { type: "ABILITY", id: "identity", action: "density" });
    s = respond(s, /Density Control/, "26007");
    s = target(s, event.id);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === p.id));
    s = choose(s, p.id);
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual(
      expect.arrayContaining([event.id, next.id]),
    );
    expect(s.player.discard.some((p) => p.id === control.id)).toBe(true);
    exact(s, original);
  });
  it("AE Lane retrieves the original Android ally from discard and advances actual shuffle information", () => {
    let s = base();
    const original = ownedSource(s),
      lane = put(s, "26004"),
      ally = hand(s, "26003")[0];
    s.player.discard.push(s.player.hand.splice(0, 1)[0]);
    s = command(s, { type: "FLIP" });
    const hidden = s.hiddenInfo || 0;
    s = command(s, { type: "ABILITY", id: lane.id, action: "search" });
    s = finish(target(s, ally.id));
    expect(s.player.hand.map((p) => p.id)).toContain(ally.id);
    expect(s.player.inPlay.find((p) => p.id === lane.id)?.exhausted).toBe(true);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    exact(s, original);
  });
  it("Mass Increase prevents the actual defended attack and stuns only its original enemy afterward", () => {
    let s = dense(base());
    const original = ownedSource(s),
      [event, r] = hand(s, "26012", "26027"),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(
      until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero")),
      "hero",
    );
    s = respond(s, /Mass Increase/, "26012");
    s = finish(pay(s, [r]));
    expect(s.player.hp).toBe(hp);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    exact(s, original);
  });
  it("Mass Increase belongs to the actual Vision teammate who defends another player's attack", () => {
    let s = dense(base("spider_man", "p2"));
    const original = [...ownedSource(s, "p1"), ...ownedSource(s, "p2")],
      [event, resource] = hand(s, "26012", "26027"),
      visionHp = seatView(s, "p2").player.hp,
      teammateHp = seatView(s, "p1").player.hp;
    attach(s, "01099", s.villain.id);
    activateSeat(s, "p1");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(
      until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero:p2")),
      "hero:p2",
    );
    s = respond(s, /Mass Increase/, "26012");
    expect(s.activePlayerId).toBe("p2");
    s = finish(pay(s, [resource]));
    expect(seatView(s, "p2").player.hp).toBe(visionHp);
    expect(seatView(s, "p1").player.hp).toBe(teammateHp);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.discard.map((p) => p.id)).toContain(
      event.id,
    );
    expect(seatView(s, "p1").player.discard.map((p) => p.id)).not.toContain(
      event.id,
    );
    expect(s.villain.stunned).toBe(true);
    exact(s, original);
  });
  it("Mass Increase prevents attack damage while the real Whirlwind boost still deals separate nonattack damage", () => {
    let s = dense(base());
    const original = ownedSource(s),
      [event, resource] = hand(s, "26012", "26027"),
      boost = makePiece(s, "01130"),
      hp = s.player.hp;
    expect(card(boost).name).toBe("Whirlwind");
    expect(card(boost).boost_star).toBe(true);
    attach(s, "01099", s.villain.id);
    s.encounter.deck.unshift(boost);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(
      until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero")),
      "hero",
    );
    s = respond(s, /Mass Increase/, "26012");
    s = finish(pay(s, [resource]));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.villain.stunned).toBe(true);
    expect(s.encounter.discard.map((p) => p.id)).toContain(boost.id);
    exact(s, original);
    exact(s, [boost]);
  });
  it("Corrupted Programming goes to the actual Vision owner when another player reveals it", () => {
    let s = dense(base("spider_man", "p2"));
    const original = ownedSource(s, "p2"),
      massId = mass(s).id,
      obligation = makePiece(s, "26028");
    activateSeat(s, "p1");
    s = finish(native(s, { type: "reveal", piece: obligation }));
    activateSeat(s, "p2");
    expect(s.player.inPlay.some((p) => p.id === obligation.id)).toBe(true);
    expect(heroStats(s)).toMatchObject({ attack: 0, defense: 0 });
    expect(mass(s)).toMatchObject({ id: massId, code: "26002b" });
    s = command(s, { type: "FLIP" });
    expect(heroStats(s).recover).toBe(5);
    s = command(s, { type: "ABILITY", id: obligation.id, action: "remove" });
    s = finish(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((p) => p.id === obligation.id)).toBe(true);
    exact(s, original);
  });
});

describe("Vision physical nemesis, environment and original Drone cards", () => {
  it.each([
    ["26028", 2],
    ["26029", 2],
    ["26030", 3],
    ["26031", 0],
    ["26032", 2],
  ] as const)(
    "the actual %s boost supplies printed numeric value %s without resolving its encounter text",
    (code, icons) => {
      let s = base();
      const original = ownedSource(s),
        boost =
          code === "26028" ? makePiece(s, code) : actualEncounter(s, code),
        hp = s.player.hp;
      expect(card(boost).boost || 0).toBe(icons);
      expect(card(boost).boost_star).toBeFalsy();
      s.encounter.deck.unshift(boost);
      s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
      // Rhino's printed two ATK is reduced by Intangible; only numeric boost
      // damage remains. The card's When Revealed/Forced text never resolves.
      expect(s.player.hp).toBe(hp - icons);
      expect(s.minions).toHaveLength(0);
      expect(s.sideSchemes).toHaveLength(0);
      expect(s.environments).toHaveLength(0);
      expect(s.player.inPlay.map((p) => p.code)).toEqual(["26002"]);
      expect(s.encounter.discard.map((p) => p.id)).toContain(boost.id);
      exact(s, original);
      exact(s, [boost]);
    },
  );
  it("Shadows conserves five actual nemeses and places the original top-card Drone once", () => {
    let s = base();
    const original = ownedSource(s),
      nemeses = [...(s.player.setAside || [])],
      next = top(s, "26024");
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "01190") }));
    expect(s.minions.some((p) => p.code === "26029")).toBe(true);
    expect(s.sideSchemes.some((p) => p.code === "26030")).toBe(true);
    expect(s.environments?.map((p) => p.code)).toContain("26031");
    expect(s.encounter.deck.filter((p) => p.code === "26032")).toHaveLength(2);
    const drone = s.minions.find((p) => p.code === "drone")!;
    expect(drone.droneCard).toMatchObject({ id: next.id, ownerId: "p1" });
    exact(s, original);
    exact(s, nemeses);
    s = finish(
      native(s, {
        type: "damage",
        target: drone.id,
        amount: 1,
        source: "hero",
        attack: false,
      }),
    );
    expect(s.player.discard.some((p) => p.id === next.id)).toBe(true);
    exact(s, original);
    exact(s, nemeses);
  });
  it("Unleashed uses every actual owner's top card and exact environment in multiplayer", () => {
    let s = base("spider_man");
    const original = [...ownedSource(s, "p1"), ...ownedSource(s, "p2")],
      env = s.player.setAside!.find((p) => p.code === "26031")!,
      scheme = actualEncounter(s, "26030"),
      a = top(s, "26024", "p1"),
      b = top(s, "01088", "p2");
    s = finish(native(s, { type: "reveal", piece: scheme }));
    expect(s.environments?.some((p) => p.id === env.id)).toBe(true);
    expect(
      s.minions
        .filter((p) => p.code === "drone")
        .map((p) => ({
          id: p.droneCard?.id,
          owner: p.droneCard?.ownerId,
          engaged: p.engagedWith,
        })),
    ).toEqual([
      { id: a.id, owner: "p1", engaged: "p1" },
      { id: b.id, owner: "p2", engaged: "p2" },
    ]);
    exact(s, original);
  });
  it("Ultron's native attack interrupt takes the attacked player's real top card before attack defense", () => {
    let s = base();
    const env = actualEncounter(s, "26031"),
      ultron = actualEncounter(s, "26029"),
      next = top(s, "26024");
    s = finish(
      native(
        s,
        { type: "reveal", piece: env },
        { type: "reveal", piece: ultron },
      ),
    );
    s = native(s, { type: "enemyAttack", id: ultron.id });
    expect(
      s.minions.some((p) => p.code === "drone" && p.droneCard?.id === next.id),
    ).toBe(true);
    s = finish(s);
    exact(s, [next, env, ultron]);
  });
  it("Relentless takes two real top cards when the named environment is in play", () => {
    let s = base();
    const env = actualEncounter(s, "26031"),
      treachery = actualEncounter(s, "26032"),
      b = top(s, "26025"),
      a = top(s, "26024");
    s = finish(
      native(
        s,
        { type: "reveal", piece: env },
        { type: "reveal", piece: treachery },
      ),
    );
    expect(
      s.minions.filter((p) => p.code === "drone").map((p) => p.droneCard?.id),
    ).toEqual([a.id, b.id]);
    exact(s, [a, b, env, treachery]);
  });
});

describe("Vision native Permanent destinations", () => {
  it("Electric Whip Attack counts the actual Permanent but cannot offer it as a discard", () => {
    let s = base();
    const original = ownedSource(s),
      p = mass(s);
    s = native(s, { type: "reveal", piece: makePiece(s, "01173") });
    s = until(s, (v) => v.prompt?.title === "Electric Whip Attack");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["damage"]);
    s = finish(choose(reload(s), "damage"));
    expect(s.player.hp).toBe(10);
    expect(mass(s).id).toBe(p.id);
    s = finish(native(s, { type: "chooseDiscard", filter: "upgrade" }));
    expect(mass(s).id).toBe(p.id);
    exact(s, original);
  });
  it("ordinary player elimination removes the same Permanent and retains the surviving teammate", () => {
    let s = base("spider_man");
    const original = ownedSource(s),
      p = mass(s);
    s = finish(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 99,
        source: "01103",
        attack: false,
      }),
    );
    expect(s.players.find((seat) => seat.id === "p1")?.eliminated).toBe(true);
    expect(s.players.find((seat) => seat.id === "p2")?.eliminated).toBe(false);
    expect(s.phase).toBe("player");
    expect(s.removed.filter((q) => q.id === p.id)).toHaveLength(1);
    exact(s, original);
  });
});
