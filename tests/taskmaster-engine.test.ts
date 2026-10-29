import { describe, expect, it } from "vitest";
import {
  TASKMASTER_SCRIPT_CODES,
  taskmasterKeyword,
} from "../src/game/taskmaster";
import { card, CATALOG_CARDS, scenarioModules } from "../src/game/cards";
import {
  abilityOptions,
  newGame,
  schemeLimit,
  enemyStats,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  reload,
  respond,
} from "./dv-test-helpers";

function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "taskmaster",
    difficulty,
    seed: 4093,
    pacing: "expert",
    heroes: [
      { heroId: "spider_man", aspect: "justice" },
      ...(players >= 2
        ? [{ heroId: "captain_marvel", aspect: "aggression" as const }]
        : []),
      ...(players >= 3
        ? [{ heroId: "iron_man", aspect: "leadership" as const }]
        : []),
    ],
  });
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let i = 0; s.prompt && i < 150; i++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      s,
      prefer?.(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  s.player.form = "hero";
  return reload(s);
}
function zones(s: GameState): Piece[][] {
  return [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
    s.resolving,
    s.removed,
    s.attachments,
    s.sideSchemes,
    s.minions,
    s.environments || [],
    [s.villain],
    s.taskmaster!.villainDeck,
    [s.taskmaster!.currentMain],
    s.taskmaster!.captives,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay];
    }),
  ];
}
function nested(ps: Piece[]): Piece[] {
  return ps.flatMap((p) => [
    p,
    ...nested(p.captured || []),
    ...nested(p.storedCards || []),
  ]);
}
function exact(s: GameState) {
  const ps = nested(zones(s).flat()).filter(
    (p) => card(p).set_code === "taskmaster",
  );
  expect(ps).toHaveLength(22);
  expect(new Set(ps.map((p) => p.id)).size).toBe(22);
}
function take(s: GameState, code: string) {
  for (const zone of zones(s)) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original ${code}`);
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: take(s, code) });
}
function zeroBoost(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) => !card(p).boost && !card(p).boost_star,
  );
  expect(i).toBeGreaterThanOrEqual(0);
  s.encounter.deck.unshift(s.encounter.deck.splice(i, 1)[0]);
}
function resource(
  s: GameState,
  type: "mental" | "physical" | "energy" | "wild",
) {
  const zone = [s.player.deck, s.player.hand, s.player.discard].find((z) =>
    z.some((p) => card(p)[`resource_${type}`]),
  );
  expect(zone).toBeTruthy();
  const p = zone!.splice(
    zone!.findIndex((p) => card(p)[`resource_${type}`]),
    1,
  )[0];
  s.player.hand.push(p);
  return p;
}
function attack(s: GameState) {
  return native(s, {
    type: "enemyAttack",
    id: s.villain.id,
    actorId: "p1",
    activation: { enemyId: s.villain.id, playerId: "p1", kind: "attack" },
  });
}

describe("Taskmaster original-source scenario", () => {
  it("registers seventeen original faces and preserves the 23-card retail source", () => {
    const original = CATALOG_CARDS.filter((c) => c.set_code === "taskmaster");
    expect(original.map((c) => c.code).sort()).toEqual(
      [...TASKMASTER_SCRIPT_CODES].sort(),
    );
    for (const code of TASKMASTER_SCRIPT_CODES)
      expect(hasExecutableScript(code), code).toBe(true);
    expect(
      original.filter((c) => !c.hidden).reduce((n, c) => n + c.quantity, 0),
    ).toBe(23);
  });
  it.each([1, 2, 3])(
    "sets up fixed Hydra Patrol and captive originals for %i players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = setup(difficulty, players);
        expect(s.taskmaster!.captives.map((p) => p.code).sort()).toEqual([
          "04097",
          "04098",
          "04099",
          "04100",
        ]);
        expect(s.sideSchemes.map((p) => p.code)).toEqual(["04154"]);
        expect(s.sideSchemes[0].counters).toBe(2 * players);
        expect(s.encounter.dealt).toHaveLength(
          difficulty === "expert" ? players : 0,
        );
        expect(s.encounter.acceleration).toBe(0);
        expect(s.scheme.threat).toBe(players);
        expect(schemeLimit(s)).toBe(12 * players);
        expect(s.villain.hp).toBe(
          (difficulty === "expert" ? 16 : 13) * players,
        );
        exact(reload(s));
      }
    },
  );
  it("allows every replaceable module while excluding the fixed Hydra Patrol set", () => {
    expect(
      scenarioModules("taskmaster").some((m) => m.id === "hydra_patrol"),
    ).toBe(false);
    for (const m of scenarioModules("taskmaster")) {
      const s = newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "taskmaster",
        module: m.id,
        seed: 7,
      });
      expect(s.modules).toEqual([m.id]);
      expect(s.sideSchemes.some((p) => p.code === "04154")).toBe(true);
      exact(s);
    }
  });
  it("uses the actual discarded top card for form-change boost damage without resolving its boost", () => {
    let s = started();
    s.player.form = "alter";
    const top = take(s, "04102");
    s.encounter.deck.unshift(top);
    const hp = s.player.hp;
    s = settle(command(s, { type: "FLIP" }));
    expect(s.player.hp).toBe(hp - 3);
    expect(s.attachments.some((p) => p.id === top.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === top.id)).toBe(true);
    exact(reload(s));
  });
  it("does not trigger Taskmaster when changing to alter-ego", () => {
    let s = started();
    const deck = s.encounter.deck.map((p) => p.id),
      hp = s.player.hp;
    s = settle(command(s, { type: "FLIP" }));
    expect(s.player.form).toBe("alter");
    expect(s.player.hp).toBe(hp);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deck);
    exact(s);
  });
  it("a boost star counts as zero and never resolves during form-change damage", () => {
    let s = started();
    s.player.form = "alter";
    const top = take(s, "04101");
    s.encounter.deck.unshift(top);
    const hp = s.player.hp;
    s = settle(command(s, { type: "FLIP" }));
    expect(s.player.hp).toBe(hp);
    expect(s.encounter.discard.some((p) => p.id === top.id)).toBe(true);
    exact(s);
  });
  it("each hero chooses threat or damage after ordinary villain phase escalation", () => {
    let s = started("standard", 3);
    seatView(s, "p2").player.form = "hero";
    seatView(s, "p3").player.form = "alter";
    const before = s.players.map((p) => seatView(s, p).player.hp);
    s = native(s, { type: "villainStepOne" });
    while (s.prompt?.title !== "Hunting Down Heroes") s = choose(s, "allow");
    expect(s.scheme.threat, JSON.stringify(s.prompt)).toBe(6);
    s = choose(reload(s), "threat");
    while (s.prompt?.title !== "Hunting Down Heroes") s = choose(s, "allow");
    s = choose(reload(s), "damage");
    s = settle(s);
    expect(s.scheme.threat).toBe(7);
    expect(s.players.map((p) => seatView(s, p).player.hp)).toEqual([
      before[0],
      before[1] - 1,
      before[2],
    ]);
    exact(s);
  });
  it("loses at the printed main scheme threshold", () => {
    let s = started();
    s = settle(native(s, { type: "threat", target: "main", amount: 11 }));
    expect(s.phase, JSON.stringify(s.prompt)).toBe("lost");
    exact(s);
  });
  it("advances original villain stages and deals encounters exactly once", () => {
    let s = started("standard", 2);
    const id = s.villain.id;
    s = settle(native(s, { type: "damage", target: id, amount: 99 }));
    expect(s.villain.code).toBe("04094");
    expect(s.removed.some((p) => p.id === id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(2);
    exact(s);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.phase).toBe("won");
    exact(s);
  });
  it("replaces expert stage II with the actual III and deals to each player", () => {
    let s = started("expert", 2);
    const before = s.encounter.dealt.length;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(s.villain.code).toBe("04095");
    expect(s.encounter.dealt).toHaveLength(before + 2);
    exact(s);
  });
  it("captures distinct original allies, then transfers each to the defeating player's hand", () => {
    let s = started("standard", 2);
    const ids = new Set<string>();
    for (let i = 0; i < 4; i++) {
      s = settle(reveal(s, "04107"));
      const p = s.sideSchemes.find((p) => p.code === "04107")!;
      expect(p.counters).toBe(5);
      expect(p.captured).toHaveLength(1);
      const ally = p.captured![0];
      expect(ids.has(ally.id)).toBe(false);
      ids.add(ally.id);
      s = settle(
        native(reload(s), {
          type: "thwart",
          target: p.id,
          amount: 5,
          actorId: "p2",
        }),
      );
      expect(
        seatView(s, "p2").player.hand.some(
          (p) => p.id === ally.id && p.ownerId === "p2",
        ),
      ).toBe(true);
      expect(s.removed.some((q) => q.id === p.id)).toBe(true);
      exact(s);
    }
    expect(s.taskmaster!.captives).toHaveLength(0);
    expect(ids.size).toBe(4);
  });
  it("puts Training Camp toughness on minions entering by reveal", () => {
    let s = settle(reveal(started(), "04108"));
    s = settle(reveal(s, "04101"));
    const hunter = s.minions.find((p) => p.code === "04101")!;
    expect(hunter.tough).toBe(true);
    expect(taskmasterKeyword(s, hunter, "Piercing")).toBe(1);
    expect(taskmasterKeyword(s, hunter, "Ranged")).toBe(1);
    exact(s);
  });
  it("Hydra Hunter's boost damages a hero and preserves the physical card", () => {
    let s = started();
    const hunter = take(s, "04101");
    s.encounter.deck.unshift(hunter);
    const hp = s.player.hp;
    s = settle(attack(s));
    expect(s.player.hp).toBe(hp - 3);
    expect(s.encounter.discard.some((p) => p.id === hunter.id)).toBe(true);
    exact(s);
  });
  it("Hydra Hunter's scheme boost adds threat in alter-ego", () => {
    let s = started();
    s.player.form = "alter";
    const hunter = take(s, "04101");
    s.encounter.deck.unshift(hunter);
    const threat = s.scheme.threat;
    s = settle(
      native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
    );
    expect(s.scheme.threat).toBe(threat + 2);
    exact(s);
  });
  it.each(["04102", "04103"])(
    "%s uses an atomic typed payment plus hero exhaustion",
    (code) => {
      let s = settle(reveal(started(), code));
      const p = s.attachments.find((p) => p.code === code)!;
      expect(abilityOptions(s, p).map((o) => o.id)).toContain("remove");
      if (code === "04102") {
        expect(enemyStats(s, s.villain).attack).toBe(3);
        expect(taskmasterKeyword(s, s.villain, "Piercing")).toBe(1);
      } else expect(taskmasterKeyword(s, s.villain, "Retaliate")).toBe(1);
      const mental = resource(s, "mental"),
        physical = resource(s, "physical");
      s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
      expect(s.prompt?.kind).toBe("payment");
      s = command(reload(s), { type: "CANCEL" });
      expect(s.player.exhausted).toBe(false);
      expect(s.attachments.some((q) => q.id === p.id)).toBe(true);
      s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
      s = command(reload(s), { type: "PAY", ids: [mental.id, physical.id] });
      expect(s.player.exhausted).toBe(true);
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
      expect(s.attachments.some((q) => q.id === p.id)).toBe(false);
      exact(s);
    },
  );
  it("Photographic Reflexes prevents and reflects an attack while preserving villain Tough", () => {
    let s = settle(reveal(started(), "04104"));
    const reflex = s.attachments.find((p) => p.code === "04104")!;
    s.villain.tough = true;
    s.villain.toughCards = 1;
    const hp = s.player.hp,
      vhp = s.villain.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        attack: true,
      }),
    );
    expect(s.player.hp).toBe(hp - 3);
    expect(s.villain.hp).toBe(vhp);
    expect(s.villain.tough).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === reflex.id)).toBe(true);
    exact(s);
  });
  it("Photographic Reflexes does not replace ordinary nonattack damage", () => {
    let s = settle(reveal(started(), "04104"));
    const hp = s.player.hp,
      vhp = s.villain.hp;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 3 }));
    expect(s.player.hp).toBe(hp);
    expect(s.villain.hp).toBe(vhp - 3);
    expect(s.attachments.some((p) => p.code === "04104")).toBe(true);
    exact(s);
  });
  it("Hunted by Hydra incites once and affects only heroes in multiplayer", () => {
    let s = started("standard", 3);
    seatView(s, "p2").player.form = "hero";
    seatView(s, "p3").player.form = "alter";
    const hp = s.players.map((p) => seatView(s, p).player.hp),
      hands = s.players.map((p) => seatView(s, p).player.hand.length),
      threat = s.scheme.threat;
    s = settle(reveal(s, "04106"));
    expect(s.scheme.threat).toBe(threat + 1);
    expect(s.players.map((p) => seatView(s, p).player.hp)).toEqual([
      hp[0] - 1,
      hp[1] - 1,
      hp[2],
    ]);
    expect(s.players.map((p) => seatView(s, p).player.hand.length)).toEqual([
      hands[0] - 1,
      hands[1] - 1,
      hands[2],
    ]);
    exact(s);
  });
  it("Hunted by Hydra retains its physical source through multiplayer prevention and reload", () => {
    let s = settle(
      newGame({
        heroId: "cable",
        aspect: "leadership",
        heroes: [
          { heroId: "cable", aspect: "leadership" },
          { heroId: "spider_man", aspect: "justice" },
        ],
        villainId: "taskmaster",
        difficulty: "standard",
        seed: 4093,
        pacing: "expert",
      }),
    );
    for (let i = 0; i < 2; i++)
      s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    for (const seat of s.players) seatView(s, seat).player.form = "hero";
    const field = take(s, "40012");
    s.player.inPlay.push(field);
    const hunted = take(s, "04106");
    const hp = s.players.map((seat) => seatView(s, seat).player.hp);
    s = native(s, { type: "reveal", piece: hunted });
    while (s.prompt && s.prompt.title !== "Telekinetic Force Field") {
      const proceed =
        passId(s) ||
        s.prompt.options.find((o) => o.id === "resolve")?.id ||
        s.prompt.options[0]?.id;
      expect(proceed, JSON.stringify(s.prompt)).toBeTruthy();
      s = choose(s, proceed!);
    }
    expect(s.prompt?.title).toBe("Telekinetic Force Field");
    for (const playerId of ["p1", "p2"]) {
      s = reload(s);
      const proceed = s.prompt!.options.find((o) => o.id === "continue")!;
      expect(proceed.effects[0]).toMatchObject({
        type: "damage",
        actorId: playerId,
        source: hunted.id,
      });
      s = choose(s, "continue");
    }
    s = settle(s);
    expect(s.players.map((seat) => seatView(s, seat).player.hp)).toEqual(
      hp.map((value) => value - 1),
    );
    exact(s);
  });
  it.each(["hero", "alter"] as const)(
    "Mimicry discards five originals and activates only for the matching %s trait",
    (form) => {
      let s = started();
      s.player.form = form;
      const trait = form === "hero" ? "Attack" : "Thwart";
      const matching = s.player.deck.find((p) =>
        card(p).traits?.includes(`${trait}.`),
      )!;
      expect(matching).toBeTruthy();
      s.player.deck = s.player.deck.filter((p) => p.id !== matching.id);
      s.player.deck.unshift(matching);
      const discarded = s.player.deck.slice(0, 5).map((p) => p.id),
        hp = s.player.hp,
        threat = s.scheme.threat;
      zeroBoost(s);
      s = settle(reveal(s, "04105"));
      for (const id of discarded)
        expect(s.player.discard.some((p) => p.id === id)).toBe(true);
      if (form === "hero") expect(s.player.hp).toBe(hp - 2);
      else expect(s.scheme.threat).toBe(threat + 1);
      exact(s);
    },
  );
  it("rescued encounter allies play normally and remain in their owner's discard pile", () => {
    let s = started();
    s = settle(reveal(s, "04107"));
    const scheme = s.sideSchemes.find((p) => p.code === "04107")!,
      ally = scheme.captured![0];
    s = settle(native(s, { type: "thwart", target: scheme.id, amount: 5 }));
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    s = settle(command(s, { type: "PLAY", id: ally.id }));
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    s = settle(native(s, { type: "damage", target: ally.id, amount: 3 }));
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === ally.id)).toBe(false);
    exact(reload(s));
  });
});

function rescueAll(s: GameState) {
  for (let i = 0; i < 4; i++) {
    s = settle(reveal(s, "04107"));
    const scheme = s.sideSchemes.find((p) => p.code === "04107")!;
    s = settle(native(s, { type: "thwart", target: scheme.id, amount: 5 }));
  }
  return s;
}
describe("Taskmaster rescued-ally printed responses", () => {
  it.each(["04097", "04098", "04099", "04100"])(
    "%s offers its response only after actual hand play and pays with an original captive Wild",
    (code) => {
      let s = rescueAll(started());
      const ally = s.player.hand.find((p) => p.code === code)!;
      const wild = s.player.hand.find(
        (p) =>
          p.code !== code &&
          ["04097", "04098", "04099", "04100"].includes(p.code),
      )!;
      const hp = s.villain.hp;
      s.sideSchemes.find((p) => p.code === "04154")!.counters = 4;
      s = command(s, { type: "PLAY", id: ally.id });
      for (let n = 0; n < 30 && s.prompt?.title !== card(ally).name; n++)
        s = choose(s, passId(s) || s.prompt!.options[0].id);
      expect(s.prompt?.title).toBe(card(ally).name);
      s = choose(reload(s), "use");
      expect(s.prompt?.kind).toBe("payment");
      const cards = s.player.hand.length;
      s = command(reload(s), { type: "PAY", ids: [wild.id] });
      if (s.prompt && (code === "04098" || code === "04100"))
        s = choose(s, s.villain.id);
      if (s.prompt && code === "04099")
        s = choose(s, s.sideSchemes.find((p) => p.code === "04154")!.id);
      s = settle(s);
      expect(s.player.discard.some((p) => p.id === wild.id)).toBe(true);
      if (code === "04097") expect(s.player.hand).toHaveLength(cards - 1 + 2);
      if (code === "04098") expect(s.villain.stunned).toBe(true);
      if (code === "04099")
        expect(s.sideSchemes.find((p) => p.code === "04154")!.counters).toBe(1);
      if (code === "04100") expect(s.villain.hp).toBe(hp - 3);
      exact(reload(s));
    },
  );
  it("putting a captive into play does not trigger its hand-play response", () => {
    let s = rescueAll(started());
    const ally = take(s, "04097");
    s.player.inPlay.push(ally);
    const hand = s.player.hand.length;
    s = settle(native(s, { type: "allyEnter", id: ally.id, fromHand: false }));
    expect(s.player.hand).toHaveLength(hand);
    exact(s);
  });
  it("Mimicry does not activate when all five discards lack the matching trait", () => {
    let s = started();
    const cards = s.player.deck
      .filter((p) => !card(p).traits?.includes("Attack."))
      .slice(0, 5);
    expect(cards).toHaveLength(5);
    s.player.deck = s.player.deck.filter((p) => !cards.includes(p));
    s.player.deck.unshift(...cards);
    const hp = s.player.hp,
      threat = s.scheme.threat;
    s = settle(reveal(s, "04105"));
    expect(s.player.hp).toBe(hp);
    expect(s.scheme.threat).toBe(threat);
    for (const p of cards)
      expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    exact(s);
  });
});

describe("Photographic Reflexes attack lifetime", () => {
  it("reflects Gambit's interrupt plus attack to Rogue and discards only one of two copies", () => {
    let s = newGame({
      heroId: "rogue",
      aspect: "protection",
      villainId: "taskmaster",
      seed: 38003,
      pacing: "expert",
    });
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.form = "hero";
    const gambit = take(s, "38003");
    s.player.hand.push(gambit);
    const costs = s.player.deck
      .filter(
        (p) =>
          card(p).type_code !== "resource" &&
          (card(p).resource_mental ||
            card(p).resource_energy ||
            card(p).resource_physical ||
            card(p).resource_wild),
      )
      .slice(0, 3);
    s.player.deck = s.player.deck.filter((p) => !costs.includes(p));
    s.player.hand.push(...costs);
    s = command(s, { type: "PLAY", id: gambit.id });
    s = settle(command(s, { type: "PAY", ids: costs.map((p) => p.id) }));
    expect(s.player.inPlay.find((p) => p.id === gambit.id)!.counters).toBe(3);
    s = settle(reveal(s, "04104"));
    s = settle(reveal(s, "04104"));
    const hp = s.player.hp,
      vhp = s.villain.hp;
    s = native(s, {
      type: "allyAction",
      id: gambit.id,
      kind: "attack",
      target: s.villain.id,
    });
    s = respond(reload(s), /Gambit/);
    if (s.prompt?.options.some((o) => o.id === s.villain.id))
      s = choose(s, s.villain.id);
    s = settle(s);
    expect(s.player.hp).toBe(hp - 3);
    expect(s.villain.hp).toBe(vhp);
    expect(s.attachments.filter((p) => p.code === "04104")).toHaveLength(1);
    expect(s.encounter.discard.filter((p) => p.code === "04104")).toHaveLength(
      1,
    );
    expect(s.player.inPlay.find((p) => p.id === gambit.id)!.damage).toBe(1);
    exact(reload(s));
  });
  it("finishing an attack event clears its reflection before that same original card is played again", () => {
    let s = settle(reveal(started(), "04104"));
    const event = take(s, "01005");
    s.player.hand.push(event);
    const vhp = s.villain.hp,
      hp = s.player.hp;
    function playEvent(state: GameState) {
      const rs = state.player.deck
        .filter(
          (p) =>
            card(p).type_code !== "resource" &&
            (card(p).resource_mental ||
              card(p).resource_energy ||
              card(p).resource_physical ||
              card(p).resource_wild),
        )
        .slice(0, 3);
      expect(rs).toHaveLength(3);
      state.player.deck = state.player.deck.filter((p) => !rs.includes(p));
      state.player.hand.push(...rs);
      state = command(state, { type: "PLAY", id: event.id });
      expect(state.prompt?.kind).toBe("payment");
      state = command(state, { type: "PAY", ids: rs.map((p) => p.id) });
      if (state.prompt?.options.some((o) => o.id === state.villain.id))
        state = choose(state, state.villain.id);
      return settle(state);
    }
    s = playEvent(s);
    expect(s.player.hp).toBe(hp - 8);
    expect(s.villain.hp).toBe(vhp);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    const same = s.player.discard.splice(
      s.player.discard.findIndex((p) => p.id === event.id),
      1,
    )[0];
    expect(same.id).toBe(event.id);
    s.player.hand.push(same);
    s = playEvent(reload(s));
    expect(s.player.hp).toBe(hp - 8);
    expect(s.villain.hp).toBe(vhp - 8);
    exact(s);
  });
});

describe("Taskmaster enemy-directed attacks", () => {
  it.each([false, true])(
    "Moondragon directs an original Hydra Hunter into Taskmaster without triggering Reflexes (shield %s)",
    (shield) => {
      let s = newGame({
        heroId: "drax",
        aspect: "protection",
        villainId: "taskmaster",
        seed: 19013,
        pacing: "expert",
      });
      s = settle(command(s, { type: "MULLIGAN", ids: [] }));
      s.player.form = "hero";
      const ally = take(s, "19013");
      s.player.hand.push(ally);
      const costs = s.player.deck
        .filter(
          (p) =>
            card(p).type_code !== "resource" &&
            (card(p).resource_mental ||
              card(p).resource_energy ||
              card(p).resource_physical ||
              card(p).resource_wild),
        )
        .slice(0, 3);
      expect(costs).toHaveLength(3);
      s.player.deck = s.player.deck.filter((p) => !costs.includes(p));
      s.player.hand.push(...costs);
      s = command(s, { type: "PLAY", id: ally.id });
      s = settle(command(s, { type: "PAY", ids: costs.map((p) => p.id) }));
      s = settle(reveal(s, "04101"));
      s = settle(reveal(s, "04104"));
      if (shield) s = settle(reveal(s, "04103"));
      const hunter = s.minions.find((p) => p.code === "04101")!,
        reflex = s.attachments.find((p) => p.code === "04104")!,
        hp = s.player.hp,
        vhp = s.villain.hp;
      s = command(s, {
        type: "ABILITY",
        id: ally.id,
        action: "command-minion",
      });
      if (s.prompt?.options.some((o) => o.id === hunter.id))
        s = choose(reload(s), hunter.id);
      if (s.prompt?.options.some((o) => o.id === s.villain.id))
        s = choose(reload(s), s.villain.id);
      s = settle(s);
      expect(s.player.hp).toBe(hp);
      expect(s.villain.hp).toBe(vhp - 2);
      expect(s.attachments.some((p) => p.id === reflex.id)).toBe(true);
      expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
      // Hydra Hunter's ranged attack also prevents the Shield's retaliation.
      expect(s.minions.find((p) => p.id === hunter.id)!.damage).toBe(0);
      exact(reload(s));
    },
  );
});
