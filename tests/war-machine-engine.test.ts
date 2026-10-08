/** Native original War Machine source, actual ammo/payment and physical nemesis. */
import { describe, expect, it } from "vitest";
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
  owned,
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

type Fixture = GameState & { dvSourceIds?: Record<string, string[]> };
function starting(other?: "drax" | "spider_man", warmSeat = "p1") {
  const warm = { heroId: "warm", aspect: "leadership" as const };
  const teammate = other
    ? {
        heroId: other,
        aspect:
          other === "drax" ? ("protection" as const) : ("justice" as const),
      }
    : undefined;
  return newGame({
    ...warm,
    villainId: "rhino",
    pacing: "expert",
    seed: 23001,
    ...(teammate
      ? { heroes: warmSeat === "p1" ? [warm, teammate] : [teammate, warm] }
      : {}),
  });
}
function base(other?: "drax" | "spider_man", warmSeat = "p1") {
  let s = starting(other, warmSeat);
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  const obligation = s.encounter.deck.find((p) => p.code === "23028")!;
  for (const seat of s.players) {
    const view = seatView(s, seat),
      source = physical(s, seat.id);
    expect(source).toHaveLength(40);
    source.forEach((p) => (p.ownerId = seat.id));
    view.player.deck = source;
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
  s.encounter.deck = [
    ...Array.from({ length: 15 }, () => makePiece(s, "01174")),
    obligation,
  ];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  activateSeat(s, warmSeat);
  s.turnPlayerId = warmSeat;
  s.flags.warMachineAmmo = 0;
  return s;
}
function ammo(s: GameState, value: number) {
  s.flags.warMachineAmmo = value;
  return s;
}
function fire(s: GameState, source: Piece, enemy = s.villain.id) {
  s = command(s, { type: "ABILITY", id: source.id, action: "attack" });
  return target(s, enemy);
}
function reveal(s: GameState, p: Piece) {
  return native(s, { type: "reveal", piece: p });
}
function encounter(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Actual encounter ${code} absent`);
}

describe("War Machine actual retail source and nemesis initialization", () => {
  it("creates original Leadership40, printed identities, one obligation and five actual set-aside nemeses", () => {
    const s = starting(),
      source = STARTER_DECKS.find((d) => d.id === "starter-23001a")!;
    expect(deckCodes("warm", "leadership").sort()).toEqual(
      catalogDeckCodes(source).sort(),
    );
    expect(physical(s)).toHaveLength(40);
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual(catalogDeckCodes(source).sort());
    expect(s.player.hp).toBe(10);
    expect(heroCard(s).code).toBe("23001b");
    expect(handSize(s)).toBe(6);
    expect(s.flags.warMachineAmmo || 0).toBe(0);
    expect(s.encounter.deck.filter((p) => p.code === "23028")).toHaveLength(1);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "23029",
      "23030",
      "23031",
      "23031",
      "23031",
    ]);
    expect(new Set(s.player.setAside?.map((p) => p.id)).size).toBe(5);
  });
  it("preserves source40 and never loads ammo merely for initial alter-ego setup", () => {
    let s = starting();
    const source = physical(s),
      nemesis = s.player.setAside!;
    s = finish(
      command(s, {
        type: "MULLIGAN",
        ids: s.player.hand.slice(0, 2).map((p) => p.id),
      }),
    );
    expect(s.flags.warMachineAmmo || 0).toBe(0);
    conserved(s, source);
    encounterConserved(s, nemesis);
    s = command(s, { type: "FLIP" });
    expect(s.prompt?.title).toBe("War Machine · form responses");
    s = finish(choose(s, "identity"));
    expect(s.flags.warMachineAmmo).toBe(5);
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 1,
      defense: 2,
      recover: 3,
    });
    expect(handSize(s)).toBe(5);
  });
  it("migrates a missing p2 set-aside zone with shared root IDs, but never replenishes an existing empty zone", () => {
    let s = base("spider_man", "p2");
    s.player.setAside = undefined;
    const maximum = s.nextId;
    activateSeat(s, "p1");
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    const zone = seatView(s, "p2").player.setAside!;
    expect(zone).toHaveLength(5);
    expect(s.nextId).toBeGreaterThanOrEqual(maximum + 5);
    expect(new Set(encounterPhysical(s).map((p) => p.id)).size).toBe(
      encounterPhysical(s).length,
    );
    seatView(s, "p2").player.setAside = [];
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    expect(seatView(s, "p2").player.setAside).toEqual([]);
  });
});

describe("War Machine actual form changes, counter zones and phase limit", () => {
  it("orders physical Chassis and Locked and Loaded responses without double-loading", () => {
    let s = base();
    s.player.form = "alter";
    ammo(s, 2);
    const chassis = put(s, "23004");
    s = command(s, { type: "FLIP" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(
      expect.arrayContaining(["identity", chassis.id]),
    );
    s = choose(s, chassis.id);
    expect(s.player.tough).toBe(true);
    expect(s.flags.warMachineAmmo).toBe(2);
    s = finish(choose(s, "identity"));
    expect(s.flags.warMachineAmmo).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === chassis.id)?.exhausted).toBe(
      true,
    );
    expect(aerial(s)).toBe(true);
    conserved(s, [chassis]);
  });
  it("suppresses the exhausted Chassis's Aerial grant while its actual Tech text is blank", () => {
    const s = base(),
      chassis = put(s, "23004");
    chassis.exhausted = true;
    expect(aerial(s)).toBe(true);
    const theft = side(s, "12026");
    expect(aerial(s)).toBe(false);
    s.sideSchemes = s.sideSchemes.filter((p) => p.id !== theft.id);
    expect(aerial(s)).toBe(true);
    s.player.form = "alter";
    expect(aerial(s)).toBe(false);
    conserved(s, [chassis]);
  });
  it("removes every identity ammo on actual alter-ego entry while retaining Bunker counters", () => {
    let s = base();
    const bunker = put(s, "23003");
    bunker.counters = 4;
    ammo(s, 9);
    s = command(s, { type: "FLIP" });
    expect(s.flags.warMachineAmmo).toBe(0);
    expect(s.player.inPlay.find((p) => p.id === bunker.id)?.counters).toBe(4);
  });
  it("keeps identity ammo through actual round end when staying in hero form", () => {
    let s = ammo(base(), 3);
    s.phase = "villain";
    s = finish(native(s, { type: "newRound" }));
    expect(s.round).toBe(2);
    expect(s.flags.warMachineAmmo).toBe(3);
  });
  it("stores2 on the actual Bunker then transfers every counter without exhausting the identity", () => {
    let s = base();
    s.player.form = "alter";
    const bunker = put(s, "23003");
    s = command(s, { type: "ABILITY", id: bunker.id, action: "store-ammo" });
    expect(s.player.inPlay.find((p) => p.id === bunker.id)?.counters).toBe(2);
    s.player.inPlay.find((p) => p.id === bunker.id)!.exhausted = false;
    s = finish(choose(command(s, { type: "FLIP" }), "identity"));
    s = command(s, { type: "ABILITY", id: bunker.id, action: "transfer-ammo" });
    expect(s.flags.warMachineAmmo).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === bunker.id)).toMatchObject({
      counters: 0,
      exhausted: true,
    });
    expect(s.player.exhausted).toBe(false);
  });
  it("shuffles the same discarded War Machine card once per phase and rejects the basic named Team-Up", () => {
    let s = base();
    s.player.form = "alter";
    const [beam, teamup] = hand(s, "23008", "23024");
    s = finish(
      native(
        s,
        { type: "discardHand", id: beam.id },
        { type: "discardHand", id: teamup.id },
      ),
    );
    s = command(s, {
      type: "ABILITY",
      id: "identity",
      action: "recover-war-machine",
    });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([beam.id]);
    s = finish(choose(s, beam.id));
    expect(s.player.deck.map((p) => p.id)).toContain(beam.id);
    expect(s.player.discard.map((p) => p.id)).toContain(teamup.id);
    expect(
      nativeHeroAbilityOptions(s).some((o) => o.id === "recover-war-machine"),
    ).toBe(false);
    conserved(s, [beam, teamup]);
  });
});

describe("Gauntlet Gun resources commit actual ammo before event costs", () => {
  it("allows zero-ammo Repulsor Beam only by spending the actual ready Gun", () => {
    let s = base();
    const gun = put(s, "23005"),
      [beam] = hand(s, "23008");
    expect(playable(s, beam)).toBeNull();
    expect(
      paymentSources(s, beam.id, beam.code).filter((p) => p.id === gun.id),
    ).toHaveLength(1);
    s = command(s, { type: "PLAY", id: beam.id });
    s = pay(s, [], "energy", [gun.id]);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(s.flags.warMachineAmmo).toBe(0);
    expect(s.player.inPlay.find((p) => p.id === gun.id)?.exhausted).toBe(true);
    conserved(s, [gun, beam]);
  });
  it("commits a p2 Gun and ammo only on its controller after a saved payment", () => {
    let s = base("spider_man", "p2");
    const gun = put(s, "23005"),
      [beam] = hand(s, "23008");
    s = command(s, { type: "PLAY", id: beam.id });
    s = pay(reload(s), [], "energy", [gun.id]);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(seatView(s, "p2").flags.warMachineAmmo).toBe(0);
    expect(seatView(s, "p1").flags.warMachineAmmo).toBeUndefined();
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === gun.id)?.exhausted,
    ).toBe(true);
    conserved(s, [gun, beam], "p2");
  });
  it("allows Full Auto starting at2 only with both actual paid Guns, then uses its fixed target", () => {
    let s = ammo(base(), 2);
    const guns = [put(s, "23005"), put(s, "23005")],
      [event] = hand(s, "23011");
    expect(playable(s, event)).toBeNull();
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(
      s,
      [],
      "energy",
      guns.map((p) => p.id),
    );
    expect(s.prompt?.title).toBe("Full Auto · additional cost");
    s = finish(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(42);
    expect(s.flags.warMachineAmmo).toBe(0);
    expect(
      s.player.inPlay
        .filter((p) => guns.some((gun) => gun.id === p.id))
        .every((p) => p.exhausted),
    ).toBe(true);
    conserved(s, [event, ...guns]);
  });
  it("rejects a funding selection lacking the required Guns before any card, ammo or exhaust mutation", () => {
    let s = ammo(base(), 2);
    const guns = [put(s, "23005"), put(s, "23005")],
      [event, genius] = hand(s, "23011", "23026");
    s = command(s, { type: "PLAY", id: event.id });
    const before = reload(s);
    const rejected = dispatch(reload(s), { type: "PAY", ids: [genius.id] });
    expect(rejected.error).toMatch(/ammo/i);
    expect(rejected.player).toEqual(before.player);
    expect(rejected.flags.warMachineAmmo).toBe(2);
    expect(rejected.prompt).toEqual(before.prompt);
    s = command(s, { type: "CANCEL" });
    expect(s.player.hand.map((p) => p.id)).toEqual([event.id, genius.id]);
    expect(
      s.player.inPlay
        .filter((p) => guns.some((gun) => gun.id === p.id))
        .every((p) => !p.exhausted),
    ).toBe(true);
  });
  it("does not treat Guns as free ammo or as funding non-War-Machine cards", () => {
    let s = base();
    const guns = [put(s, "23005"), put(s, "23005")],
      [event] = hand(s, "23011");
    expect(playable(s, event)).toMatch(/ammo/i);
    expect(
      paymentSources(s, undefined, "23024").some((p) =>
        guns.some((gun) => gun.id === p.id),
      ),
    ).toBe(false);
    expect(
      paymentSources(s, undefined, "23006").some((p) =>
        guns.some((gun) => gun.id === p.id),
      ),
    ).toBe(false);
  });
  it("can pay a real Gun when Helicarrier makes Repulsor cost0, with atomic cancel and empty-payment refusal", () => {
    let s = base();
    const gun = put(s, "23005"),
      carrier = put(s, "01092"),
      [beam] = hand(s, "23008");
    s = command(s, { type: "ABILITY", id: carrier.id });
    s = command(s, { type: "PLAY", id: beam.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(0);
    const refused = dispatch(reload(s), { type: "PAY", ids: [] });
    expect(refused.error).toMatch(/ammo/i);
    expect(refused.player).toEqual(s.player);
    expect(refused.flags.warMachineAmmo).toBe(0);
    const cancelled = command(s, { type: "CANCEL" });
    expect(
      cancelled.player.inPlay.find((p) => p.id === gun.id)?.exhausted,
    ).toBe(false);
    s = pay(s, [], "energy", [gun.id]);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(s.flags.warMachineAmmo).toBe(0);
    conserved(s, [gun, carrier, beam]);
  });
  it("pays ammo before native Stun or Confuse cancels the actual event ability", () => {
    for (const [code, status] of [
      ["23008", "stunned"],
      ["23009", "confused"],
    ] as const) {
      let s = ammo(base(), 1);
      s.player[status] = true;
      const [event, resource] = hand(s, code, "23025");
      s = finish(play(s, event, [resource]));
      expect(s.flags.warMachineAmmo).toBe(0);
      expect(s.player[status]).toBe(false);
      expect(s.villain.hp).toBe(50);
      expect(s.scheme.threat).toBe(6);
      conserved(s, [event, resource]);
    }
  });
  it("pays Full Auto's target and4ammo cost before a stunned attack is replaced", () => {
    let s = ammo(base(), 4);
    s.player.stunned = true;
    const guard = minion(s, "01101");
    const [event, resource] = hand(s, "23011", "23026");
    s = play(s, event, [resource]);
    expect(s.prompt?.title).toBe("Full Auto · additional cost");
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(true);
    s = finish(choose(s, s.villain.id));
    expect(s.flags.warMachineAmmo).toBe(0);
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.minions.find((p) => p.id === guard.id)?.damage).toBe(0);
  });
});

describe("Physical War Machine weapons and deferred aftermath", () => {
  it("uses Missile Launcher as a ranged attack spending1ammo and actual source exhaustion", () => {
    let s = ammo(base(), 2);
    const launcher = put(s, "23006"),
      enemy = minion(s, "01172");
    s = finish(fire(s, launcher, enemy.id));
    expect(s.flags.warMachineAmmo).toBe(1);
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.find((p) => p.id === launcher.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.exhausted).toBe(false);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(2);
    conserved(s, [launcher]);
  });
  it("readies the same Shoulder Cannon for1ammo before one native Retaliate aftermath", () => {
    let s = ammo(base(), 2);
    const cannon = put(s, "23007"),
      enemy = minion(s, "01172");
    s = fire(s, cannon, enemy.id);
    expect(s.prompt?.title).toBe("Shoulder Cannon");
    expect(s.player.hp).toBe(10);
    s = finish(choose(s, "ready"));
    expect(s.flags.warMachineAmmo).toBe(1);
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === cannon.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.exhausted).toBe(false);
    conserved(s, [cannon]);
  });
  it("a stunned Shoulder Cannon still exhausts and cancels the entire ready sentence", () => {
    let s = ammo(base(), 2);
    s.player.stunned = true;
    const cannon = put(s, "23007");
    s = finish(fire(s, cannon));
    expect(s.player.stunned).toBe(false);
    expect(s.flags.warMachineAmmo).toBe(2);
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === cannon.id)?.exhausted).toBe(
      true,
    );
  });
  it("a stunned Missile Launcher pays its actual ammo and source exhaustion before the attack is replaced", () => {
    let s = ammo(base(), 2);
    s.player.stunned = true;
    const launcher = put(s, "23006");
    s = finish(
      command(s, { type: "ABILITY", id: launcher.id, action: "attack" }),
    );
    expect(s.player.stunned).toBe(false);
    expect(s.flags.warMachineAmmo).toBe(1);
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === launcher.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.exhausted).toBe(false);
    conserved(s, [launcher]);
  });
  it("fullAuto applies actual Overkill to a defeated minion without making a second attack", () => {
    let s = ammo(base(), 4);
    const enemy = minion(s, "01103"),
      [event, resource] = hand(s, "23011", "23026");
    s = play(s, event, [resource]);
    s = finish(choose(s, enemy.id));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.villain.hp).toBe(45);
    expect(s.flags.warMachineAmmo).toBe(0);
    conserved(s, [event, resource]);
  });
});

describe("Scorched Earth and actual simultaneous nonattack identity damage", () => {
  it("damages each real enemy across seats, ignores Stun/Guard/Retaliate, and consumes3ammo", () => {
    let s = ammo(base("spider_man"), 3);
    s.player.stunned = true;
    const own = minion(s, "01103"),
      other = minion(s, "01172", "p2"),
      [event, first, second] = hand(s, "23010", "23025", "23026");
    s = finish(play(s, event, [first, second]));
    expect(s.villain.hp).toBe(47);
    expect(s.player.hp).toBe(10);
    expect(s.player.stunned).toBe(true);
    expect(s.flags.warMachineAmmo).toBe(0);
    expect(s.minions.some((p) => p.id === own.id)).toBe(false);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(3);
    conserved(s, [event, first, second]);
  });
  it("Deadly Light Show enters at3+1perHero and its defeat damages BOTH actual identities including alter egos", () => {
    let s = base("spider_man");
    seatView(s, "p2").player.form = "alter";
    const allNemeses = s.player.setAside!,
      scheme = allNemeses.find((p) => p.code === "23030")!;
    s.player.setAside = allNemeses.filter((p) => p.id !== scheme.id);
    s = finish(reveal(s, scheme));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(5);
    s = finish(
      native(s, { type: "thwart", target: scheme.id, amount: 5, action: true }),
    );
    expect(seatView(s, "p1").player.hp).toBe(9);
    expect(seatView(s, "p2").player.hp).toBe(9);
    encounterConserved(s, allNemeses);
  });
  it("commits both identities' Light Show damage before a lethal p1 elimination", () => {
    let s = base("spider_man");
    s.player.hp = 1;
    seatView(s, "p2").player.hp = 5;
    const allNemeses = s.player.setAside!,
      scheme = allNemeses.find((p) => p.code === "23030")!;
    s.player.setAside = allNemeses.filter((p) => p.id !== scheme.id);
    s = finish(reveal(s, scheme));
    s = finish(
      native(s, { type: "thwart", target: scheme.id, amount: 5, action: true }),
    );
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(seatView(s, "p2").player.hp).toBe(4);
    expect(s.phase).toBe("player");
    encounterConserved(s, allNemeses);
  });
  it("lets the second seat replace defeat after the whole Light Show batch and first-seat elimination", () => {
    let s = base("drax");
    s.player.hp = 1;
    const drax = seatView(s, "p2");
    drax.player.hp = 1;
    drax.flags.draxVengeanceCounters = 1;
    const rescue = put(s, "19011", "p2"),
      allNemeses = s.player.setAside!,
      scheme = allNemeses.find((p) => p.code === "23030")!;
    s.player.setAside = allNemeses.filter((p) => p.id !== scheme.id);
    s = finish(reveal(s, scheme));
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: 5,
      action: true,
    });
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.title).toBe("Too Stubborn to Die");
    s = finish(choose(s, rescue.id));
    expect(seatView(s, "p2").player.hp).toBe(6);
    expect(seatView(s, "p2").player.form).toBe("alter");
    expect(s.players.find((p) => p.id === "p2")?.eliminated).toBeFalsy();
    conserved(s, [rescue], "p2");
    encounterConserved(s, allNemeses);
  });
});

describe("Actual Iron Man entry search and nemesis reveal/boost routing", () => {
  it("uses Iron Man's native entry response to find any actual Tech upgrade and preserves its ID", () => {
    let s = base();
    const [ally, first, second] = hand(s, "23002", "23025", "23026"),
      gun = s.player.deck.find((p) => p.code === "23005")!;
    s = play(s, ally, [first, second]);
    s = respond(s, /^Iron Man$/);
    s = finish(choose(s, gun.id));
    expect(s.player.hand.map((p) => p.id)).toContain(gun.id);
    expect(s.player.inPlay.map((p) => p.id)).toContain(ally.id);
    conserved(s, [ally, gun, first, second]);
  });
  it("a p2 Iron Man put into play by actual Sneak Attack searches its final physical deck card and commits one real owner reset", () => {
    let s = base("spider_man", "p2");
    const [sneak, ironMan, strength] = hand(s, "23017", "23002", "23027"),
      gun = s.player.deck.find((p) => p.code === "23005")!;
    s.player.discard.push(...s.player.deck.filter((p) => p.id !== gun.id));
    s.player.deck = [gun];
    const seed = s.seed,
      hidden = s.hiddenInfo || 0,
      other = reload(seatView(s, "p1")).player,
      encounterTop = s.encounter.deck[0];
    s = play(s, sneak, [strength]);
    s = choose(s, ironMan.id);
    expect(s.resolving.map((p) => p.id)).toContain(sneak.id);
    s = respond(s, /^Iron Man$/);
    s = finish(choose(reload(s), gun.id));
    expect(s.player.hand.map((p) => p.id)).toContain(gun.id);
    expect(s.player.inPlay.map((p) => p.id)).toContain(ironMan.id);
    expect(s.player.deck).toHaveLength(37);
    expect(s.player.discard.map((p) => p.id)).toEqual([sneak.id]);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.encounter.dealt[0]).toMatchObject({
      id: encounterTop.id,
      dealtTo: "p2",
    });
    expect(s.seed).not.toBe(seed);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    expect(seatView(s, "p1").player).toEqual(other);
    conserved(s, [sneak, ironMan, strength, gun], "p2");
  });
  it("moves the SAME five actual nemesis pieces on Shadows and uses native Quickstrike/Piercing", () => {
    let s = base();
    const cards = s.player.setAside!;
    s.player.tough = true;
    s = finish(reveal(s, makePiece(s, "01190")));
    expect(s.player.setAside).toEqual([]);
    expect(
      s.minions.some((p) => p.id === cards.find((p) => p.code === "23029")!.id),
    ).toBe(true);
    expect(s.sideSchemes.find((p) => p.code === "23030")?.counters).toBe(4);
    expect(s.player.hp).toBe(8);
    expect(s.player.tough).toBe(false);
    expect(
      s.encounter.deck
        .filter((p) => p.code === "23031")
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      cards
        .filter((p) => p.code === "23031")
        .map((p) => p.id)
        .sort(),
    );
    encounterConserved(s, cards);
  });
  it("routes actual Laser Strike reveal to a controlled physical upgrade, or native facedown Surge if none", () => {
    let s = base();
    const cards = s.player.setAside!,
      strike = cards.find((p) => p.code === "23031")!,
      upgrade = put(s, "23005");
    s.player.setAside = cards.filter((p) => p.id !== strike.id);
    s = reveal(s, strike);
    s = finish(choose(s, upgrade.id));
    expect(s.player.discard.map((p) => p.id)).toContain(upgrade.id);
    encounterConserved(s, cards);
    const next = s.player.setAside!.find((p) => p.code === "23031")!;
    s.player.setAside = s.player.setAside!.filter((p) => p.id !== next.id);
    const topCard = s.encounter.deck[0];
    s = finish(reveal(s, next));
    expect(s.encounter.dealt.map((p) => p.id)).toContain(topCard.id);
    encounterConserved(s, cards);
  });
  it.each(["take", "hero", "scheme"])(
    "resolves an actual Laser Strike boost on %s with its printed numeric1 and conditional upgrade discard",
    (mode) => {
      let s = base();
      s.scheme.threat = 0;
      const cards = s.player.setAside!,
        strike = cards.find((p) => p.code === "23031")!,
        upgrade = put(s, "23005");
      s.player.setAside = cards.filter((p) => p.id !== strike.id);
      s.encounter.deck.unshift(strike);
      if (mode === "scheme") {
        s.player.form = "alter";
        s = finish(native(s, { type: "enemyScheme", id: s.villain.id }));
        expect(s.scheme.threat).toBe(2);
      } else {
        s = native(s, { type: "enemyAttack", id: s.villain.id });
        s = choose(s, mode);
        if (mode === "take") {
          s = until(s, (v) => v.prompt?.title === "Laser Strike");
          s = choose(s, upgrade.id);
        }
        s = finish(s);
        expect(s.player.hp).toBe(mode === "take" ? 7 : 9);
      }
      expect(s.player.discard.some((p) => p.id === upgrade.id)).toBe(
        mode === "take",
      );
      expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(
        mode !== "take",
      );
      expect(s.encounter.dealt).toHaveLength(0);
      expect(s.encounter.discard.some((p) => p.id === strike.id)).toBe(true);
      encounterConserved(s, cards);
      conserved(s, [upgrade]);
    },
  );
  it.each([0, 2, 3, 7])(
    "Equipment Malfunction removes actual identity ammo%d and surges only at2orless",
    (count) => {
      let s = ammo(base(), count);
      const bunker = put(s, "23003");
      bunker.counters = 4;
      const obligation = encounter(s, "23028"),
        topCard = s.encounter.deck[0];
      s = reveal(s, obligation);
      s = choose(s, "stay");
      s = finish(choose(s, "ammo"));
      expect(s.flags.warMachineAmmo).toBe(0);
      expect(s.encounter.dealt.some((p) => p.id === topCard.id)).toBe(
        count <= 2,
      );
      expect(s.player.inPlay.find((p) => p.id === bunker.id)?.counters).toBe(4);
      encounterConserved(s, [obligation]);
    },
  );
  it("a free obligation flip loses ammo first, so its second option removes0 and gains native Surge", () => {
    let s = ammo(base("spider_man", "p2"), 8);
    const obligation = encounter(s, "23028"),
      topCard = s.encounter.deck[0];
    activateSeat(s, "p1");
    s = reveal(s, obligation);
    expect(s.activePlayerId).toBe("p2");
    s = choose(s, "alter");
    expect(s.flags.warMachineAmmo).toBe(0);
    s = finish(choose(s, "ammo"));
    expect(s.encounter.dealt.find((p) => p.id === topCard.id)?.dealtTo).toBe(
      "p2",
    );
    expect(seatView(s, "p2").player.flipped).toBe(false);
    encounterConserved(s, [obligation]);
  });
});
