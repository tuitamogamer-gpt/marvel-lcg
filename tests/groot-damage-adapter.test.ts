/** Actual damage adapters: printed Groot, native attacks, and saved windows. */
import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState } from "../src/game/types.js";

const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function run(s: GameState, command: Command) {
  s = dispatch(reload(s), command);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let n = 0; s.review && n < 100; n++) {
    s = dispatch(reload(s), { type: "PROCEED" });
    expect(s.error).toBeUndefined();
  }
  expect(s.review).toBeNull();
  return s;
}
function choose(s: GameState, id: string) {
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return run(s, { type: "CHOOSE", id });
}
function finish(s: GameState, stopId?: string) {
  for (let n = 0; s.prompt && n < 100; n++) {
    if (stopId && s.prompt.options.some((o) => o.id === stopId)) return s;
    const id = s.prompt.options.find((o) =>
      /^(continue|pass|skip|resolve|allow|none|no|done)$/.test(o.id),
    )?.id;
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  if (!stopId) expect(s.prompt).toBeNull();
  return s;
}
function base(team: "solo" | "groot-first" | "groot-second" = "solo") {
  const heroes =
    team === "solo"
      ? [{ heroId: "groot", aspect: "protection" as const }]
      : team === "groot-first"
        ? [
            { heroId: "groot", aspect: "protection" as const },
            { heroId: "scw", aspect: "justice" as const },
          ]
        : [
            { heroId: "scw", aspect: "justice" as const },
            { heroId: "groot", aspect: "protection" as const },
          ];
  let s = newGame({
    heroId: heroes[0].heroId,
    aspect: heroes[0].aspect,
    heroes,
    villainId: "rhino",
    pacing: "expert",
    seed: 16001,
  });
  for (const _ of heroes) s = run(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.flipped = false;
    v.player.exhausted = false;
    v.player.hand = [];
    v.player.inPlay = [];
    v.player.discard = [];
    v.player.deck = Array.from({ length: 15 }, () => makePiece(s, "16021"));
    v.flags.grootGrowthCounters = seat.heroId === "groot" ? 3 : 0;
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.attachments = [];
  s.sideSchemes = [];
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 0;
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Native damage fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function area(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function charge(s: GameState) {
  const p = makePiece(s, "01099");
  p.attachedTo = s.villain.id;
  s.attachments.push(p);
}
function attack(s: GameState, defender = "take") {
  s = native(s, { type: "enemyAttack", id: s.villain.id });
  return choose(s, defender);
}

describe("Groot forced damage prevention in actual engine packets", () => {
  it("spends growth before offering Magic Shield and persists the net packet across reload", () => {
    let s = base("groot-first");
    const shield = area(s, "15008", s.players[1].id);
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 5,
      source: "encounter",
    });
    expect(s.flags.grootGrowthCounters).toBe(0);
    expect(s.player.hp).toBe(10);
    expect(s.prompt?.text).toContain("2 damage");
    expect(s.prompt?.options.some((o) => o.id === shield.id)).toBe(true);
    const continuation = s.prompt?.options.find((o) => o.id === "allow")
      ?.effects[0];
    expect(continuation).toMatchObject({ amount: 2, grootDamageHandled: true });
    s = finish(choose(reload(s), shield.id));
    expect(seatView(s, s.players[0]).player.hp).toBe(10);
    expect(seatView(s, s.players[0]).flags.grootGrowthCounters).toBe(0);
    expect(
      seatView(s, s.players[1]).player.discard.some((p) => p.id === shield.id),
    ).toBe(true);
  });
  it("fully prevented damage leaves an optional Magic Shield in play", () => {
    let s = base("groot-first");
    const shield = area(s, "15008", s.players[1].id);
    s = finish(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 2,
        source: "encounter",
      }),
    );
    expect(seatView(s, s.players[0]).flags.grootGrowthCounters).toBe(1);
    expect(seatView(s, s.players[0]).player.hp).toBe(10);
    expect(
      seatView(s, s.players[1]).player.inPlay.some((p) => p.id === shield.id),
    ).toBe(true);
  });
  it("Tough precedes Flora Colossus on a nonattack packet", () => {
    let s = base();
    s.player.tough = true;
    s = finish(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 5,
        source: "encounter",
      }),
    );
    expect(s.player.tough).toBe(false);
    expect(s.flags.grootGrowthCounters).toBe(3);
    expect(s.player.hp).toBe(10);
  });
  it("separate packets remove Tough first and spend growth on the next packet", () => {
    let s = base();
    s.player.tough = true;
    s = finish(
      native(
        s,
        { type: "damage", target: "hero", amount: 2, source: "encounter" },
        { type: "damage", target: "hero", amount: 2, source: "encounter" },
      ),
    );
    expect(s.flags.grootGrowthCounters).toBe(1);
    expect(s.player.hp).toBe(10);
  });
  it("alter-ego damage does not consume persistent growth counters", () => {
    let s = base();
    s.player.form = "alter";
    s = finish(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 2,
        source: "encounter",
      }),
    );
    expect(s.flags.grootGrowthCounters).toBe(3);
    expect(s.player.hp).toBe(8);
  });
  it("a hero:seat packet spends the actual foreign Groot recipient's counters", () => {
    let s = base("groot-second");
    const grootSeat = s.players[1].id;
    s = finish(
      native(s, {
        type: "damage",
        target: `hero:${grootSeat}`,
        amount: 5,
        source: "encounter",
      }),
    );
    expect(seatView(s, grootSeat).player.hp).toBe(8);
    expect(seatView(s, grootSeat).flags.grootGrowthCounters).toBe(0);
    expect(seatView(s, s.players[0]).player.hp).toBe(10);
  });
  it("calculates basic DEF before removing growth counters", () => {
    let s = base();
    s.flags.grootGrowthCounters = 4;
    charge(s);
    s = finish(attack(s, "hero"));
    expect(s.player.hp).toBe(10);
    expect(s.flags.grootGrowthCounters).toBe(2);
  });
  it("Tough blocks an enemy attack without spending growth", () => {
    let s = base();
    s.player.tough = true;
    charge(s);
    s = finish(attack(s, "hero"));
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(s.flags.grootGrowthCounters).toBe(3);
  });
  it("Piercing removes the hero defender's Tough before Flora Colossus", () => {
    let s = base();
    s.player.tough = true;
    charge(s);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s.attack!.piercing = true;
    s = finish(choose(reload(s), "hero"));
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.flags.grootGrowthCounters).toBe(1);
  });
  it("ally defense spends growth only on the separate identity overkill packet", () => {
    let s = base();
    const ally = area(s, "01083");
    ally.damage = 2; // Mockingbird has one remaining hit point.
    charge(s);
    s = finish(attack(s, ally.id));
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.flags.grootGrowthCounters).toBe(0);
    expect(s.player.hp).toBe(9);
  });
  it("an ally's Tough prevents the complete overkill attack before growth", () => {
    let s = base();
    const ally = area(s, "01083");
    ally.damage = 2;
    ally.tough = true;
    charge(s);
    s = finish(attack(s, ally.id));
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    expect(s.flags.grootGrowthCounters).toBe(3);
    expect(s.player.hp).toBe(10);
  });
  it("the identity's Tough blocks overkill without spending growth", () => {
    let s = base();
    const ally = area(s, "01083");
    ally.damage = 2;
    s.player.tough = true;
    charge(s);
    s = finish(attack(s, ally.id));
    expect(s.player.tough).toBe(false);
    expect(s.flags.grootGrowthCounters).toBe(3);
    expect(s.player.hp).toBe(10);
  });
  it("a teammate Groot's basic defense applies that Groot's DEF and counters", () => {
    let s = base("groot-second");
    const grootSeat = s.players[1].id;
    seatView(s, grootSeat).flags.grootGrowthCounters = 4;
    charge(s);
    s = finish(attack(s, `hero:${grootSeat}`));
    expect(seatView(s, grootSeat).player.hp).toBe(10);
    expect(seatView(s, grootSeat).flags.grootGrowthCounters).toBe(2);
    expect(seatView(s, s.players[0]).player.hp).toBe(10);
  });
  it("Booster Boots uses the remaining attack damage after Flora without declaring defense", () => {
    let s = base();
    s.flags.grootGrowthCounters = 1;
    s.scheme.threat = 2;
    const boots = area(s, "16052");
    const hard = area(s, "16017");
    const top = s.player.deck[0];
    s = finish(attack(s), boots.id);
    expect(s.attack?.defender).toBe("none");
    expect(s.attack?.prevented).toBe(1);
    expect(s.flags.grootGrowthCounters).toBe(0);
    s = finish(choose(reload(s), boots.id));
    expect(s.player.hp).toBe(10);
    expect(s.player.deck.some((p) => p.id === top.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === top.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === boots.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.find((p) => p.id === hard.id)?.exhausted).toBe(
      false,
    );
    expect(s.scheme.threat).toBe(2);
  });
  it("Booster Boots prevents the remaining identity overkill packet after Flora", () => {
    let s = base();
    const boots = area(s, "16052");
    const ally = area(s, "01083");
    ally.damage = 2;
    charge(s);
    s = finish(attack(s, ally.id), boots.id);
    expect(s.attack?.identityPrevented).toBe(3);
    expect(s.flags.grootGrowthCounters).toBe(0);
    s = finish(choose(reload(s), boots.id));
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === boots.id)?.exhausted).toBe(
      true,
    );
  });
  it("Starhawk returns the physical ally before exact consequential damage", () => {
    let s = base();
    const starhawk = area(s, "16012");
    starhawk.damage = 2;
    s = native(s, {
      type: "damage",
      target: starhawk.id,
      amount: 1,
      source: "consequential",
    });
    expect(s.prompt?.title).toBe("Starhawk");
    s = finish(choose(reload(s), starhawk.id));
    expect(s.player.inPlay.some((p) => p.id === starhawk.id)).toBe(false);
    expect(s.player.hand.filter((p) => p.id === starhawk.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === starhawk.id)).toBe(false);
  });
  it("Starhawk checks exact net damage after Magic Shield prevention", () => {
    let s = base("groot-first");
    const starhawk = area(s, "16012");
    starhawk.damage = 2;
    const shield = area(s, "15008", s.players[1].id);
    s = native(s, {
      type: "damage",
      target: starhawk.id,
      amount: 4,
      source: "encounter",
    });
    s = choose(reload(s), shield.id);
    expect(s.prompt?.title).toBe("Starhawk");
    s = finish(choose(reload(s), starhawk.id));
    expect(
      seatView(s, s.players[0]).player.hand.filter((p) => p.id === starhawk.id),
    ).toHaveLength(1);
    expect(
      seatView(s, s.players[1]).player.discard.some((p) => p.id === shield.id),
    ).toBe(true);
  });
  it("Tough prevents exact Starhawk damage without opening his return interrupt", () => {
    let s = base();
    const starhawk = area(s, "16012");
    starhawk.damage = 2;
    starhawk.tough = true;
    s = finish(
      native(s, {
        type: "damage",
        target: starhawk.id,
        amount: 1,
        source: "consequential",
      }),
    );
    const remaining = s.player.inPlay.find((p) => p.id === starhawk.id);
    expect(remaining?.damage).toBe(2);
    expect(remaining?.tough).toBe(false);
    expect(s.player.hand.some((p) => p.id === starhawk.id)).toBe(false);
  });
});
