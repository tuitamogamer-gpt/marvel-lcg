/** Native acceptance: original source40, actual nemesis instances and JSON
 * reload before every command. No pure resolver or synthetic identity fallback. */
import { describe, expect, it } from "vitest";
import {
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
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  attach,
  choose,
  command,
  conserved,
  encounterConserved,
  encounterPhysical,
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
  top,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & {
  dvSourceIds?: Record<string, string[]>;
  milesOriginalEncounters?: Piece[];
};
function starting(milesSeat = "p1", team = false, villainId = "rhino") {
  const miles = { heroId: "spider_man_morales", aspect: "justice" as const };
  const peter = { heroId: "spider_man", aspect: "justice" as const };
  return newGame({
    ...miles,
    villainId,
    seed: 27030,
    pacing: "expert",
    ...(team
      ? { heroes: milesSeat === "p1" ? [miles, peter] : [peter, miles] }
      : {}),
  });
}
function base(milesSeat = "p1", team = false, villainId = "rhino") {
  let s = starting(milesSeat, team, villainId);
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  const obligation = s.encounter.deck.find((p) => p.code === "27056");
  expect(obligation, "original Keeping Secrets instance").toBeTruthy();
  const encounters = [
    ...(seatView(s, milesSeat).player.setAside || []),
    obligation!,
  ];
  expect(encounters).toHaveLength(6);
  for (const seat of s.players) {
    const view = seatView(s, seat),
      originals = physical(s, seat.id);
    expect(originals).toHaveLength(40);
    originals.forEach((p) => (p.ownerId = seat.id));
    view.player.deck = originals;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.form = "hero";
    view.player.exhausted = view.player.flipped = false;
  }
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [
    ...Array.from({ length: 20 }, () => makePiece(s, "01186")),
    obligation!,
  ];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  (s as Fixture).milesOriginalEncounters = encounters;
  activateSeat(s, milesSeat);
  s.turnPlayerId = milesSeat;
  return s;
}
function done(s: GameState, prefer?: (s: GameState) => string | undefined) {
  s = finish(s, prefer);
  encounterConserved(s, (s as Fixture).milesOriginalEncounters || []);
  return s;
}
function takeEncounter(s: GameState, code: string): Piece {
  for (const seat of s.players) {
    const z = seatView(s, seat).player.setAside || [],
      i = z.findIndex((p) => p.code === code);
    if (i >= 0) return z.splice(i, 1)[0];
  }
  for (const z of [s.encounter.deck, s.encounter.dealt, s.encounter.discard]) {
    const i = z.findIndex((p) => p.code === code);
    if (i >= 0) return z.splice(i, 1)[0];
  }
  throw Error(`Original physical encounter ${code} missing`);
}
function reveal(s: GameState, p: Piece) {
  return native(s, { type: "reveal", piece: p });
}
function basic(
  s: GameState,
  action: "attack" | "thwart",
  id = action === "attack" ? s.villain.id : "main",
) {
  return target(command(s, { type: "BASIC", action }), id);
}
function enemy(s: GameState) {
  const p = takeEncounter(s, "27058");
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
const surged = (s: GameState) =>
  [...s.encounter.dealt, ...s.encounter.discard].some(
    (p) => p.code === "01186",
  );
function select(s: GameState, id: string) {
  s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === id));
  return choose(s, id);
}

describe("Miles actual original source and native setup", () => {
  it("creates source40 as15Hero13Justice12Basic and reserves five physical nemeses", () => {
    const s = starting(),
      source = STARTER_DECKS.find((d) => d.id === "starter-27030a")!;
    expect(deckCodes("spider_man_morales", "justice").sort()).toEqual(
      catalogDeckCodes(source).sort(),
    );
    expect(physical(s)).toHaveLength(40);
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual(catalogDeckCodes(source).sort());
    const factions = { hero: 0, justice: 0, basic: 0 };
    for (const p of physical(s))
      factions[card(p).faction_code as keyof typeof factions]++;
    expect(factions).toEqual({ hero: 15, justice: 13, basic: 12 });
    expect(s.player.hp).toBe(9);
    expect(heroCard(s).code).toBe("27030b");
    expect(handSize(s)).toBe(6);
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      recover: 4,
    });
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "27057",
      "27058",
      "27059",
      "27060",
      "27060",
    ]);
    expect(new Set(s.player.setAside?.map((p) => p.id)).size).toBe(5);
    expect(s.encounter.deck.filter((p) => p.code === "27056")).toHaveLength(1);
  });
  it("mulligan retains six actual cards and creates no extra setup card", () => {
    let s = starting();
    const source = physical(s);
    s = done(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.inPlay).toEqual([]);
    conserved(s, source);
  });
  it("Shadows reveals actual Prowler first and shuffles the three remaining physical IDs", () => {
    let s = base();
    const source = physical(s),
      nemesis = [...s.player.setAside!];
    s = done(reveal(s, makePiece(s, "01190")));
    expect(s.minions.find((p) => p.code === "27058")?.id).toBe(
      nemesis.find((p) => p.code === "27058")!.id,
    );
    expect(s.sideSchemes.find((p) => p.code === "27057")).toMatchObject({
      id: nemesis.find((p) => p.code === "27057")!.id,
      counters: 4,
    });
    expect(
      s.encounter.deck
        .filter((p) => ["27059", "27060"].includes(p.code))
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      nemesis
        .filter((p) => ["27059", "27060"].includes(p.code))
        .map((p) => p.id)
        .sort(),
    );
    expect(s.player.setAside).toEqual([]);
    conserved(s, source);
    encounterConserved(s, nemesis);
    expect(new Set(encounterPhysical(s).map((p) => p.id)).size).toBe(
      encounterPhysical(s).length,
    );
  });
  it("JSON migration does not replenish a consumed reserve", () => {
    let s = base("p2", true);
    s = done(reveal(s, makePiece(s, "01190")));
    const next = s.nextId;
    activateSeat(s, "p1");
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    expect(seatView(s, "p2").player.setAside).toEqual([]);
    expect(s.nextId).toBe(next);
  });
});

describe("performed native basic power receipts and independent Specials", () => {
  it("a performed native basic defense can pay PowerWithin after the actual attack completes", () => {
    let s = base();
    put(s, "27037");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = select(s, "hero");
    s = respond(s, /Power Within/, "27037");
    expect(s.player.hp).toBe(9);
    s = done(select(s, s.villain.id));
    expect(s.villain.hp).toBe(48);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.exhausted).toBe(true);
  });
  it("basicATK2 then PowerWithin VenomBlast2 ignores Guard and leaves personal Stun untouched", () => {
    let s = base();
    const source = physical(s),
      power = put(s, "27037");
    s = basic(s, "attack");
    expect(s.villain.hp).toBe(48);
    s.player.stunned = true;
    s.player.stunCards = 1;
    minion(s, "01101");
    s = respond(s, /Power Within/, "27037");
    expect(s.player.discard.map((p) => p.id)).toContain(power.id);
    s = done(select(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.stunned).toBe(true);
    conserved(s, source);
  });
  it("basicTHW2 then DefenseMechanism grants Tough and independent Confuse", () => {
    let s = base();
    const upgrade = put(s, "27038");
    s = basic(s, "thwart");
    expect(s.scheme.threat).toBe(4);
    s.player.confused = true;
    s.player.confuseCards = 1;
    s = respond(s, /Defense Mechanism/, "27038");
    s = done(select(s, s.villain.id));
    expect(s.player.tough).toBe(true);
    expect(s.villain.confused).toBe(true);
    expect(s.player.confused).toBe(true);
    expect(s.player.discard.map((p) => p.id)).toContain(upgrade.id);
  });
  it("a Stun-replaced basic attack offers no performed basic-power response", () => {
    let s = base();
    const p = put(s, "27037");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = done(basic(s, "attack"));
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(s.player.inPlay.map((q) => q.id)).toContain(p.id);
  });
  it("Venom Blast removes Tough, then gives Stun without damage", () => {
    let s = base();
    put(s, "27037");
    s = basic(s, "thwart");
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = respond(s, /Power Within/, "27037");
    s = done(select(s, s.villain.id));
    expect(s.villain.hp).toBe(50);
    expect(s.villain.tough).toBe(false);
    expect(s.villain.stunned).toBe(true);
  });
  it("Venom Blast defeating its target does not redirect Stun to the villain", () => {
    let s = base();
    put(s, "27037");
    const m = minion(s, "01103", s.activePlayerId, 1);
    s = basic(s, "thwart");
    s = respond(s, /Power Within/, "27037");
    s = done(select(s, m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.villain.stunned).toBe(false);
  });
  it("both actual upgrades can respond to one power and are physically paid once", () => {
    let s = base();
    const a = put(s, "27037"),
      b = put(s, "27038");
    s = basic(s, "thwart");
    s = respond(s, /Power Within/, "27037");
    s = select(s, s.villain.id);
    s = respond(s, /Defense Mechanism/, "27038");
    s = done(select(s, s.villain.id));
    expect(s.villain.hp).toBe(48);
    expect(s.villain.stunned && s.villain.confused && s.player.tough).toBe(
      true,
    );
    expect(
      s.player.discard.filter((p) => [a.id, b.id].includes(p.id)),
    ).toHaveLength(2);
  });
});

describe("three printed paid-for-card conditional benefits", () => {
  it("WebShot4 attack and VenomBlast2 select distinct actual enemies", () => {
    let s = base();
    const m = minion(s, "01103");
    const [event, energy] = hand(s, "27034", "27051");
    s = play(s, event, [energy]);
    s = select(s, m.id);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    s = done(select(s, s.villain.id));
    expect(s.villain.hp).toBe(48);
    expect(s.villain.stunned).toBe(true);
  });
  it("WebShot Energy overpayment allocated away from cost gives no VenomBlast", () => {
    let s = base();
    const [event, mental, energy] = hand(s, "27034", "27052", "27051");
    s = play(s, event, [mental, energy]);
    expect(s.prompt?.title).toMatch(/Allocate payment/);
    s = choose(s, "mental");
    s = done(select(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(s.villain.stunned).toBe(false);
  });
  it("SwingIn4 Mental cost grants Camouflage while Energy-only cost does not", () => {
    let s = base();
    const [event, mental] = hand(s, "27033", "27052");
    s = play(s, event, [mental]);
    s = select(s, "main");
    expect(s.scheme.threat).toBe(2);
    s = done(select(s, s.villain.id));
    expect(s.player.tough && s.villain.confused).toBe(true);
    s = base();
    const [other, energy] = hand(s, "27033", "27051");
    s = done(select(play(s, other, [energy]), "main"));
    expect(s.scheme.threat).toBe(2);
    expect(s.player.tough || s.villain.confused).toBe(false);
  });
  it("SwingIn Mental overpayment allocated as Energy gives no Camouflage", () => {
    let s = base();
    const [event, mental, energy] = hand(s, "27033", "27052", "27051");
    s = play(s, event, [mental, energy]);
    s = choose(s, "energy");
    s = done(select(s, "main"));
    expect(s.scheme.threat).toBe(2);
    expect(s.player.tough || s.villain.confused).toBe(false);
  });
  it.each([
    ["27034", "stunned", "27051"],
    ["27033", "confused", "27052"],
  ] as const)(
    "status replaces the whole%s event including its conditional Special",
    (code, status, resource) => {
      let s = base();
      const [event, r] = hand(s, code, resource);
      s.player[status] = true;
      if (status === "stunned") s.player.stunCards = 1;
      else s.player.confuseCards = 1;
      s = done(play(s, event, [r]));
      expect(s.player[status]).toBe(false);
      expect(s.villain.hp).toBe(50);
      expect(s.scheme.threat).toBe(6);
      expect(s.villain.stunned || s.villain.confused || s.player.tough).toBe(
        false,
      );
      expect(s.player.discard.map((p) => p.id)).toContain(event.id);
    },
  );
  it("Arachnobatics makes one8damage packet through both actual status cards", () => {
    let s = base();
    const [event, resource] = hand(s, "27031", "27035");
    s.villain.stunned = s.villain.confused = true;
    s.villain.stunCards = s.villain.confuseCards = 1;
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = done(select(play(s, event, [resource], "mental"), s.villain.id));
    expect(s.villain.hp).toBe(50);
    expect(s.villain.tough).toBe(false);
    expect(s.villain.stunned && s.villain.confused).toBe(true);
  });
});

describe("DoubleLife actual PLAY receipt, global Max and form response", () => {
  it("an actual Helicarrier discount to zero leaves no Physical cost allocation or ready benefit", () => {
    let s = base();
    const carrier = put(s, "01092");
    s = command(s, { type: "ABILITY", id: carrier.id });
    s = done(target(s, "p1"));
    const [event] = hand(s, "27032");
    s.player.exhausted = true;
    s = done(play(s, event));
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.map((p) => p.id)).toContain(event.id);
  });
  it("the next actual native round permits another copy with a distinct PLAY token", () => {
    let s = base();
    const [first, strength] = hand(s, "27032", "27053");
    s = done(play(s, first, [strength]));
    const token = s.flags.milesDoubleLifePlayToken;
    s = done(native(s, { type: "newRound" }));
    const [second, energy] = hand(s, "27032", "27051");
    expect(playable(s, second)).toBeNull();
    s = done(play(s, second, [energy]));
    expect(s.player.form).toBe("hero");
    expect(s.flags.milesDoubleLifeRound).toBe(s.round);
    expect(s.flags.milesDoubleLifePlayToken).not.toBe(token);
  });
  it("changes form despite the voluntary flip budget and readies with Physical cost", () => {
    let s = base();
    const [event, physicalResource] = hand(s, "27032", "27053");
    s.player.exhausted = s.player.flipped = true;
    s = done(play(s, event, [physicalResource]));
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(false);
    expect(s.player.flipped).toBe(true);
    expect(s.flags.milesDoubleLifeRound).toBe(s.round);
    expect(s.flags.milesDoubleLifePlayToken).toEqual(expect.any(String));
    expect(String(s.flags.milesDoubleLifePlayToken)).not.toMatch(/^legacy:/);
  });
  it("DoubleLife Physical overpayment allocated as Energy changes form without readying", () => {
    let s = base();
    const [event, energy, strength] = hand(s, "27032", "27051", "27053");
    s.player.exhausted = true;
    s = play(s, event, [energy, strength]);
    s = choose(s, "energy");
    s = done(s);
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
  });
  it("canceling a payment before actual PLAY commit leaves Max available", () => {
    let s = base();
    const [event] = hand(s, "27032", "27053");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "CANCEL" });
    expect(s.flags.milesDoubleLifeRound).toBeUndefined();
    expect(playable(s, event)).toBeNull();
    expect(s.player.hand.map((p) => p.id)).toContain(event.id);
  });
  it("actual Counterspell cancellation consumes Max and keeps one nonlegacy PLAY token across reload", () => {
    let s = base("p2", true);
    const counter = attach(s, "09030", "hero:p2");
    const [event, resource] = hand(s, "27032", "27053");
    s.player.exhausted = true;
    s = done(play(s, event, [resource]));
    expect(s.player.form).toBe("hero");
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.map((p) => p.id)).toContain(event.id);
    expect(s.encounter.discard.map((p) => p.id)).toContain(counter.id);
    expect(s.flags.milesDoubleLifeRound).toBe(s.round);
    const token = s.flags.milesDoubleLifePlayToken;
    expect(token).toEqual(expect.any(String));
    expect(String(token)).not.toMatch(/^legacy:/);
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    expect(s.flags.milesDoubleLifePlayToken).toBe(token);
    const [second] = hand(s, "27032", "27053");
    expect(playable(s, second)).toMatch(/Max|maximum|round|Double Life/i);
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    const [third] = hand(s, "27032", "01090");
    expect(playable(s, third)).toMatch(/Max|maximum|round|Double Life/i);
    s.players.find((seat) => seat.id === "p2")!.eliminated = true;
    expect(playable(s, third)).toMatch(/Max|maximum|round|Double Life/i);
  });
  it("Hero-to-AE shuffles the selected actual signature but not the resolving DoubleLife", () => {
    let s = base();
    const [event, signature, resource] = hand(s, "27032", "27034", "27053");
    s.player.hand.splice(
      s.player.hand.findIndex((p) => p.id === signature.id),
      1,
    );
    s.player.discard.push(signature);
    s = play(s, event, [resource]);
    s = respond(s, /Miles Morales|shuffle/i);
    expect(s.prompt?.options.some((o) => o.id === event.id)).toBe(false);
    s = select(s, signature.id);
    s = done(s);
    expect(s.player.deck.map((p) => p.id)).toContain(signature.id);
    expect(s.player.discard.map((p) => p.id)).toContain(event.id);
    expect(s.player.deck.filter((p) => p.id === signature.id)).toHaveLength(1);
  });
});

describe("actual support/resource sources", () => {
  it("Ganke exhausts, draws the actual top card, then chooses an actual hand discard in Hero", () => {
    let s = base();
    const ganke = put(s, "27035"),
      draw = top(s, "27034");
    s = command(s, { type: "ABILITY", id: ganke.id, action: "draw" });
    expect(s.player.inPlay.find((p) => p.id === ganke.id)?.exhausted).toBe(
      true,
    );
    s = done(select(s, draw.id));
    expect(s.player.discard.map((p) => p.id)).toContain(draw.id);
  });
  it("Ganke in AE draws without a discard and exhausted source cannot be reused", () => {
    let s = base();
    const ganke = put(s, "27035"),
      draw = top(s, "27034");
    s.player.form = "alter";
    s = done(command(s, { type: "ABILITY", id: ganke.id, action: "draw" }));
    expect(s.player.hand.map((p) => p.id)).toContain(draw.id);
    const bad = dispatch(reload(s), {
      type: "ABILITY",
      id: ganke.id,
      action: "draw",
    });
    expect(bad.error).toBeTruthy();
  });
  it("Jefferson compares every scheme, respects Crisis, and does not consume Confuse", () => {
    let s = base();
    const jefferson = put(s, "27036"),
      crisis = side(s, "01108", 2);
    s.scheme.threat = 2;
    s.player.form = "alter";
    s.player.confused = true;
    s.player.confuseCards = 1;
    s = done(
      command(s, { type: "ABILITY", id: jefferson.id, action: "threat" }),
    );
    expect(s.sideSchemes.find((p) => p.id === crisis.id)?.counters).toBe(1);
    expect(s.player.confused).toBe(true);
    expect(s.scheme.threat).toBe(2);
    s = base();
    const j = put(s, "27036");
    side(s, "01108", 0);
    s.player.form = "alter";
    const bad = dispatch(reload(s), {
      type: "ABILITY",
      id: j.id,
      action: "threat",
    });
    expect(bad.error).toBeTruthy();
    expect(s.scheme.threat).toBe(6);
  });
  it("Jefferson cannot exhaust when Crisis blocks the unique least-threat main scheme", () => {
    const s = base(),
      jefferson = put(s, "27036");
    side(s, "01108", 4);
    s.scheme.threat = 2;
    s.player.form = "alter";
    const bad = dispatch(reload(s), {
      type: "ABILITY",
      id: jefferson.id,
      action: "threat",
    });
    expect(bad.error).toMatch(/unavailable/);
    expect(
      bad.player.inPlay.find((p) => p.id === jefferson.id)?.exhausted,
    ).toBe(false);
    expect(bad.scheme.threat).toBe(2);
  });
  it("WebShooter native PLAY initializes three Uses and actual last spend discards that physical ID", () => {
    let s = base();
    const [shooter, resource] = hand(s, "27039", "27035");
    s = done(play(s, shooter, [resource], "physical"));
    expect(s.player.inPlay.find((p) => p.id === shooter.id)?.counters).toBe(3);
    s.player.inPlay.find((p) => p.id === shooter.id)!.counters = 1;
    const [event] = hand(s, "27031");
    expect(paymentSources(s, event.id).some((p) => p.id === shooter.id)).toBe(
      true,
    );
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [], "mental", [shooter.id]);
    expect(s.player.inPlay.some((p) => p.id === shooter.id)).toBe(false);
    expect(s.player.discard.map((p) => p.id)).toContain(shooter.id);
    s = done(select(s, s.villain.id));
    expect(s.villain.hp).toBe(48);
  });
});

describe("actual nemesis/obligation encounter instances and attack receipts", () => {
  it.each([
    ["27056", 2],
    ["27057", 3],
    ["27058", 2],
    ["27059", 2],
    ["27060", 1],
  ] as const)(
    "actual%s boost uses its printed%s icons without a revealed-card ability",
    (code, icons) => {
      let s = base();
      const actual = takeEncounter(s, code);
      expect(card(actual).boost).toBe(icons);
      expect(card(actual).boost_star).toBeFalsy();
      s.encounter.deck.unshift(actual);
      s = done(native(s, { type: "enemyAttack", id: s.villain.id }));
      expect(s.player.hp).toBe(9 - 2 - icons);
      expect(s.encounter.discard.map((p) => p.id)).toContain(actual.id);
      expect(s.sideSchemes).toEqual([]);
      expect(s.attachments).toEqual([]);
      expect(s.minions).toEqual([]);
      expect(s.removed).toEqual([]);
      expect(surged(s)).toBe(false);
    },
  );
  it("Slice does not gain Surge when separate native Retaliate defeats the attacking Prowler", () => {
    let s = base();
    const p = enemy(s);
    p.damage = 4;
    put(s, "16016");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = done(reveal(s, takeEncounter(s, "27060")));
    expect(s.player.hp).toBe(9);
    expect(s.minions.some((m) => m.id === p.id)).toBe(false);
    expect(s.encounter.discard.map((m) => m.id)).toContain(p.id);
    expect(surged(s)).toBe(false);
  });
  it("Slice ignores a real Drone when finding the actual Prowler attack source", () => {
    let s = base("p1", false, "ultron");
    s = done(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.code === "drone")!;
    const prowler = enemy(s);
    s = done(reveal(s, takeEncounter(s, "27060")));
    expect(s.player.hp).toBe(7);
    expect(surged(s)).toBe(false);
    expect(s.minions.map((p) => p.id)).toEqual(
      expect.arrayContaining([drone.id, prowler.id]),
    );
  });
  it("TrackingPrey in AE puts a physical token on that scheme, with no global token", () => {
    let s = base();
    s.player.form = "alter";
    const tracking = takeEncounter(s, "27057");
    s = done(reveal(s, tracking));
    expect(s.sideSchemes.find((p) => p.id === tracking.id)).toMatchObject({
      counters: 4,
      accelerationTokens: 1,
    });
    expect(s.encounter.acceleration).toBe(0);
    s.scheme.threat = 0;
    s = done(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(3);
    s.player.form = "hero";
    const [swing, resource] = hand(s, "27033", "27051");
    s = done(select(play(s, swing, [resource]), tracking.id));
    expect(s.sideSchemes.some((p) => p.id === tracking.id)).toBe(false);
    expect(s.encounter.discard.map((p) => p.id)).toContain(tracking.id);
    s.scheme.threat = 0;
    s = done(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(1);
    expect(s.encounter.acceleration).toBe(0);
  });
  it("TrackingPrey in Hero has only its printed acceleration icon", () => {
    let s = base();
    const p = takeEncounter(s, "27057");
    s = done(reveal(s, p));
    expect(
      (s.sideSchemes[0] as Piece & { accelerationTokens?: number })
        .accelerationTokens || 0,
    ).toBe(0);
    s.scheme.threat = 0;
    s = done(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(2);
  });
  it("Prowler's original reveal grants AE Tough and Stalwart rejects statuses", () => {
    let s = base();
    s.player.form = "alter";
    const p = takeEncounter(s, "27058");
    s = done(reveal(s, p));
    expect(s.minions.find((m) => m.id === p.id)?.tough).toBe(true);
    s = done(
      native(
        s,
        { type: "status", target: p.id, status: "stunned" },
        { type: "status", target: p.id, status: "confused" },
      ),
    );
    expect(s.minions.find((m) => m.id === p.id)).toMatchObject({
      stunned: false,
      confused: false,
    });
  });
  it("RazorClaws uses highest printed HP, then actual Piercing and encounter discard", () => {
    let s = base();
    const p = enemy(s),
      weak = minion(s, "01103");
    p.damage = 4;
    const claws = takeEncounter(s, "27059");
    s = reveal(s, claws);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([p.id]);
    s = done(choose(s, p.id));
    expect(s.attachments.find((a) => a.id === claws.id)?.attachedTo).toBe(p.id);
    s.player.tough = true;
    s.player.toughCards = 1;
    s = done(native(s, { type: "enemyAttack", id: p.id }));
    expect(s.player.hp).toBe(5);
    expect(s.player.tough).toBe(false);
    s = done(basic(s, "attack", p.id));
    expect(s.encounter.discard.map((a) => a.id)).toContain(claws.id);
    expect(s.attachments.some((a) => a.id === claws.id)).toBe(false);
    expect(s.minions.some((m) => m.id === weak.id)).toBe(true);
  });
  it("native Ultron Drone supplies actual printedHP/label to Razor and remains source-owned", () => {
    let s = base("p1", false, "ultron");
    s = done(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.code === "drone")!,
      playerCard = drone.droneCard!;
    expect(playerCard.ownerId).toBe("p1");
    const claws = takeEncounter(s, "27059");
    s = reveal(s, claws);
    expect(s.prompt?.options).toMatchObject([
      { id: drone.id, label: "Ultron Drone" },
    ]);
    s = done(choose(s, drone.id));
    expect(s.attachments[0]).toMatchObject({
      id: claws.id,
      attachedTo: drone.id,
    });
    s = done(basic(s, "attack", drone.id));
    expect(s.player.discard.map((p) => p.id)).toContain(playerCard.id);
    expect(s.encounter.discard.map((p) => p.id)).toContain(claws.id);
  });
  it("Razor without an eligible minion surges and discards that actual card", () => {
    let s = base();
    const p = takeEncounter(s, "27059");
    s = done(reveal(s, p));
    expect(surged(s)).toBe(true);
    expect(s.encounter.discard.map((m) => m.id)).toContain(p.id);
  });
  it("Slice performs an actual Prowler attack against the lowest-HP AE teammate", () => {
    let s = base("p1", true);
    const p = enemy(s),
      slice = takeEncounter(s, "27060");
    seatView(s, "p2").player.form = "alter";
    seatView(s, "p2").player.hp = 3;
    s = done(reveal(s, slice));
    expect(seatView(s, "p2").player.hp).toBe(1);
    expect(seatView(s, "p1").player.hp).toBe(9);
    expect(s.scheme.threat).toBe(6);
    expect(surged(s)).toBe(false);
    expect(s.encounter.discard.map((q) => q.id)).toContain(slice.id);
    expect(s.minions.some((q) => q.id === p.id)).toBe(true);
  });
  it("Slice tie choices survive serialization and target the chosen actual player", () => {
    let s = base("p1", true);
    enemy(s);
    s.player.hp = seatView(s, "p2").player.hp = 5;
    s = reveal(s, takeEncounter(s, "27060"));
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    s = done(choose(s, "p2"));
    expect(seatView(s, "p2").player.hp).toBe(3);
    expect(seatView(s, "p1").player.hp).toBe(5);
    expect(surged(s)).toBe(false);
  });
  it("Slice surges when this actual attack defeats its defending ally", () => {
    let s = base("p1", true);
    enemy(s);
    const ally = put(s, "01002", "p2");
    ally.damage = 1;
    s = reveal(s, takeEncounter(s, "27060"));
    s = select(s, ally.id);
    s = done(s);
    expect(seatView(s, "p2").player.discard.map((p) => p.id)).toContain(
      ally.id,
    );
    expect(surged(s)).toBe(true);
  });
  it("WebbedUp replaces actual Prowler attack so Slice surges despite Stalwart", () => {
    let s = base("p1", true);
    const p = enemy(s);
    const web = put(s, "01009", "p2");
    web.attachedTo = p.id;
    s = done(reveal(s, takeEncounter(s, "27060")));
    expect(s.player.hp).toBe(9);
    expect(surged(s)).toBe(true);
    expect(seatView(s, "p2").player.discard.map((q) => q.id)).toContain(web.id);
    expect(s.minions.find((q) => q.id === p.id)?.stunned).toBe(false);
  });
  it("Slice with no actual Prowler gains Surge", () => {
    let s = base();
    const p = takeEncounter(s, "27060");
    s = done(reveal(s, p));
    expect(surged(s)).toBe(true);
    expect(s.encounter.discard.map((q) => q.id)).toContain(p.id);
  });
  it.each(["p1", "p2"])(
    "KeepingSecrets belongs to actual Miles%s even when the other seat reveals",
    (milesSeat) => {
      let s = base(milesSeat, true);
      const p = takeEncounter(s, "27056");
      activateSeat(s, milesSeat === "p1" ? "p2" : "p1");
      s = reveal(s, p);
      s = choose(s, "flip");
      s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "remove"));
      s = done(choose(s, "remove"));
      expect(seatView(s, milesSeat).player.form).toBe("alter");
      expect(seatView(s, milesSeat).player.exhausted).toBe(true);
      expect(s.removed.map((q) => q.id)).toContain(p.id);
      expect(surged(s)).toBe(false);
    },
  );
  it("KeepingSecrets discards both actual named supports from all players preserving owners", () => {
    let s = base("p2", true);
    const ganke = put(s, "27035"),
      jefferson = put(s, "27036");
    s.player.inPlay.splice(
      s.player.inPlay.findIndex((p) => p.id === ganke.id),
      1,
    );
    seatView(s, "p1").player.inPlay.push(ganke);
    const obligation = takeEncounter(s, "27056");
    s = reveal(s, obligation);
    s = choose(s, "stay");
    s = done(choose(s, "discard"));
    expect(seatView(s, "p2").player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([ganke.id, jefferson.id]),
    );
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === ganke.id)).toBe(
      false,
    );
    expect(surged(s)).toBe(false);
    expect(s.encounter.discard.map((p) => p.id)).toContain(obligation.id);
  });
  it("KeepingSecrets gains Surge when neither named support is actually discarded", () => {
    let s = base();
    const p = takeEncounter(s, "27056");
    s = reveal(s, p);
    s = choose(s, "stay");
    s = done(choose(s, "discard"));
    expect(surged(s)).toBe(true);
    expect(s.encounter.discard.map((q) => q.id)).toContain(p.id);
  });
});
