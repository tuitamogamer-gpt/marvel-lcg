import { describe, expect, it } from "vitest";
import {
  card,
  deckCodes,
  heroStats,
  imageFor,
  pieceHP,
} from "../src/game/cards.js";
import {
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  playable,
} from "../src/game/engine.js";
import { seatView, controller } from "../src/game/team.js";
import { paymentSources } from "../src/game/payment.js";
import { isTextBlank } from "../src/game/card-text.js";
import { phoenixForce, phoenixChangeCounters } from "../src/game/phoenix.js";
import { deckErrors, deckSizeFor } from "../src/game/decks.js";
import {
  command,
  choose,
  finish,
  native,
  pay,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";
import type { GameState, Piece } from "../src/game/types.js";
const original = (s: GameState) =>
  [
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.discard,
    ...s.player.inPlay,
    ...s.resolving,
    ...s.removed,
  ].filter(
    (p) =>
      p.ownerId === s.activePlayerId && card(p).faction_code !== "encounter",
  );
function start() {
  return newGame({
    heroId: "phoenix",
    aspect: "justice",
    villainId: "rhino",
    seed: 34001,
    pacing: "expert",
  });
}
function base(form: "hero" | "alter" = "hero") {
  let s = finish(command(start(), { type: "MULLIGAN", ids: [] }));
  s.player.deck.push(...s.player.hand.splice(0));
  s.player.form = form;
  s.player.exhausted = false;
  s.player.flipped = false;
  s.player.hp = 9;
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  return s;
}
function take(
  s: GameState,
  code: string,
  zone: "hand" | "inPlay" | "discard" = "hand",
) {
  for (const z of [s.player.deck, s.player.hand, s.player.discard]) {
    const i = z.findIndex((p) => p.code === code);
    if (i >= 0) {
      const [p] = z.splice(i, 1);
      s.player[zone].push(p);
      return p;
    }
  }
  throw Error(`Missing original ${code}`);
}
function encounter(s: GameState, code: string) {
  for (const z of [
    s.encounter.deck,
    s.encounter.discard,
    s.player.setAside || [],
  ]) {
    const i = z.findIndex((p) => p.code === code);
    if (i >= 0) return z.splice(i, 1)[0];
  }
  throw Error(`Missing encounter ${code}`);
}
function minion(s: GameState, code = "01103") {
  const p = encounter(s, code);
  p.engagedWith = s.activePlayerId;
  s.minions.push(p);
  return p;
}
function paid(s: GameState, p: Piece, resources: Piece[], target?: string) {
  s = command(s, { type: "PLAY", id: p.id });
  if (target && s.prompt?.kind === "choice") s = choose(s, target);
  return pay(s, resources);
}
function resolve(s: GameState, prefer?: string) {
  return finish(s, (v) =>
    v.prompt?.options.some((o) => o.id === prefer)
      ? prefer
      : v.prompt?.options.find((o) =>
          ["allow", "resolve", "none"].includes(o.id),
        )?.id,
  );
}
function zeroBoost(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) => !card(p).boost && !card(p).boost_star,
  );
  expect(i).toBeGreaterThanOrEqual(0);
  s.encounter.deck.unshift(s.encounter.deck.splice(i, 1)[0]);
}

describe("Phoenix physical source and native engine", () => {
  it.each([false, true])(
    "elimination removes the same Phoenix Force and owned cards while the teammate continues (Unleashed=%s)",
    (unleashed) => {
      let s = newGame({
        heroId: "phoenix",
        aspect: "justice",
        villainId: "rhino",
        seed: 34002,
        pacing: "expert",
        heroes: [
          { heroId: "phoenix", aspect: "justice" },
          { heroId: "spider_man", aspect: "justice" },
        ],
      });
      s = resolve(command(s, { type: "MULLIGAN", ids: [] }));
      s = resolve(command(s, { type: "MULLIGAN", ids: [] }));
      const owned = original(s);
      const force = phoenixForce(s)!;
      if (unleashed) phoenixChangeCounters(s, -4);
      s = resolve(
        native(s, {
          type: "damage",
          target: "hero",
          amount: 99,
          source: "01103",
          attack: false,
        }),
      );
      expect(s.players.find((seat) => seat.id === "p1")?.eliminated).toBe(true);
      expect(s.players.find((seat) => seat.id === "p2")?.eliminated).toBe(
        false,
      );
      expect(s.phase).toBe("player");
      expect(seatView(s, "p1").player.inPlay).toEqual([]);
      expect(s.removed.filter((p) => p.id === force.id)).toHaveLength(1);
      const physical = [
        ...s.players.flatMap((seat) => {
          const p = seatView(s, seat).player;
          return [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
        }),
        ...s.resolving,
        ...s.removed,
      ];
      expect(owned).toHaveLength(41);
      for (const p of owned) {
        expect(physical.filter((q) => q.id === p.id)).toHaveLength(1);
        expect(s.removed.filter((q) => q.id === p.id)).toHaveLength(1);
      }
    },
  );
  it("launches 40 original playing cards, one actual permanent with4 power and five reserved nemesis", () => {
    const s = start();
    expect(original(s)).toHaveLength(41);
    expect(s.player.hand).toHaveLength(6);
    expect(phoenixForce(s)).toMatchObject({ code: "34002a", counters: 4 });
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "34029",
      "34030",
      "34031",
      "34031",
      "34031",
    ]);
    expect(s.encounter.deck.filter((p) => p.code === "34028")).toHaveLength(1);
    expect(deckSizeFor(deckCodes("phoenix", "justice"))).toBe(40);
    expect(
      deckErrors("phoenix", "justice", deckCodes("phoenix", "justice")),
    ).toEqual([]);
    expect(imageFor("34001a")).toContain("34001b");
    expect(imageFor("34001b")).toContain("34001a");
  });
  it("spends the actual counter through payment once per phase and flips at zero", () => {
    let s = base();
    const force = phoenixForce(s)!;
    force.counters = 1;
    const event = take(s, "34013");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [], undefined, ["phoenix-bond"]);
    expect(phoenixForce(s)).toMatchObject({
      id: force.id,
      code: "34002b",
      counters: 0,
    });
    expect(paymentSources(s).some((p) => p.id === "phoenix-bond")).toBe(false);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 1 });
    s = choose(s, "power");
    expect(phoenixForce(s)?.counters).toBe(2);
    expect(original(s)).toHaveLength(41);
  });
  it("recovery and White Hot Room add counters; the fourth counter restrains the same card", () => {
    let s = base("alter");
    phoenixChangeCounters(s, -4);
    phoenixChangeCounters(s, 2);
    s.player.hp = 5;
    const room = take(s, "34004", "inPlay");
    s = command(s, { type: "BASIC", action: "recover" });
    s = resolve(respond(s, /Jean Grey/));
    expect(phoenixForce(s)?.counters).toBe(3);
    expect(
      nativeHeroAbilityOptions(s, room.id).some((o) => o.id === "power"),
    ).toBe(true);
    s = resolve(command(s, { type: "ABILITY", id: room.id, action: "power" }));
    expect(phoenixForce(s)).toMatchObject({ code: "34002a", counters: 4 });
  });
  it("Telekinetic Attack gains9 damage and overkill only while unleashed", () => {
    let s = base();
    phoenixChangeCounters(s, -4);
    const m = minion(s);
    const p = take(s, "34010"),
      a = take(s, "34025"),
      b = take(s, "34020");
    s = paid(s, p, [a, b]);
    s = resolve(choose(s, m.id));
    expect(s.minions.some((q) => q.id === m.id)).toBe(false);
    expect(s.villain.hp).toBe(44);
    expect(original(s)).toHaveLength(41);
  });
  it("Psychic Blast is nonattack damage and only hits this player's engaged minions", () => {
    let s = base();
    phoenixChangeCounters(s, -4);
    s.player.stunned = true;
    s.player.stunCards = 1;
    const m = minion(s);
    const p = take(s, "34011"),
      r = take(s, "34025");
    s = resolve(paid(s, p, [r]));
    expect(s.villain.hp).toBe(46);
    expect(s.minions.some((q) => q.id === m.id)).toBe(false);
    expect(s.player.stunned).toBe(true);
  });
  it("Telepathic Trickery applies its actual spent Passion bonus and grants both statuses", () => {
    let s = base();
    phoenixChangeCounters(s, -4);
    const p = take(s, "34012"),
      r = take(s, "34020"),
      r2 = take(s, "34004");
    s = paid(s, p, [r, r2]);
    s = choose(s, "main");
    s = resolve(choose(s, s.villain.id));
    expect(s.scheme.threat).toBe(1);
    expect(s.villain.stunned).toBe(true);
    expect(s.villain.confused).toBe(true);
  });
  it("Cyclops entrance and leave-play responses change actual Phoenix Force counters", () => {
    let s = base();
    phoenixChangeCounters(s, -4);
    const p = take(s, "34003"),
      a = take(s, "34025"),
      b = take(s, "34020");
    s = paid(s, p, [a, b]);
    s = resolve(respond(s, /Cyclops/));
    expect(phoenixForce(s)?.counters).toBe(2);
    s = native(s, { type: "discardPiece", id: p.id });
    s = resolve(respond(s, /Cyclops/));
    expect(phoenixForce(s)?.counters).toBe(0);
  });
  it("Telekinetic Shield replaces all enemy attack damage and discards at5 without spillover", () => {
    let s = base();
    const m = minion(s);
    const shield = take(s, "34007"),
      r = take(s, "34025");
    s = paid(s, shield, [r], "hero:p1");
    s = resolve(s);
    const a = s.player.inPlay.find((p) => p.id === shield.id)!;
    a.damage = 4;
    s = native(s, { type: "enemyAttack", id: m.id });
    s = resolve(s);
    expect(s.player.hp).toBe(9);
    expect(s.player.discard.some((p) => p.id === shield.id)).toBe(true);
  });
  it("Mental Paralysis blocks both activations, then physically discards on alter-ego flip", () => {
    let s = base();
    const m = minion(s);
    const p = take(s, "34008"),
      r = take(s, "34025");
    s = resolve(paid(s, p, [r], m.id));
    s = resolve(
      native(
        s,
        { type: "enemyAttack", id: m.id },
        { type: "enemyScheme", id: m.id },
      ),
    );
    expect(s.player.hp).toBe(9);
    expect(s.scheme.threat).toBe(6);
    s = resolve(command(s, { type: "FLIP" }));
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Mind Control keeps the actual minion and attachment; ally defeat returns both to correct discards", () => {
    let s = base();
    const m = minion(s);
    const p = take(s, "34009"),
      a = take(s, "34025"),
      b = take(s, "34026");
    s = resolve(paid(s, p, [a, b], m.id));
    const controlled = s.player.inPlay.find((p) => p.id === m.id)!;
    expect(card(controlled)).toMatchObject({
      type_code: "ally",
      thwart: 1,
      attack_cost: 1,
      thwart_cost: 1,
    });
    expect(isTextBlank(s, controlled)).toBe(true);
    expect(s.minions).toHaveLength(0);
    s = resolve(native(s, { type: "damage", target: m.id, amount: 3 }));
    expect(s.encounter.discard.some((p) => p.id === m.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("discarding Mind Control returns the same surviving minion engaged with its controller", () => {
    let s = base();
    const m = minion(s);
    const p = take(s, "34009"),
      a = take(s, "34025"),
      b = take(s, "34026");
    s = resolve(paid(s, p, [a, b], m.id));
    s = resolve(native(s, { type: "discardPiece", id: p.id }));
    expect(s.minions.find((q) => q.id === m.id)).toMatchObject({
      engagedWith: "p1",
    });
    expect(s.minions[0].treatedAsAlly).toBeUndefined();
  });
  it("Rise from the Ashes replaces defeat, removes itself, restores printedHP and unleashes", () => {
    let s = base();
    const p = take(s, "34006", "inPlay");
    s = native(s, { type: "damage", target: "hero", amount: 10 });
    expect(s.prompt?.title).toBe("Rise from the Ashes");
    s = resolve(choose(s, p.id));
    expect(s.phase).toBe("player");
    expect(s.player.hp).toBe(9);
    expect(s.removed.some((q) => q.id === p.id)).toBe(true);
    expect(phoenixForce(s)).toMatchObject({ code: "34002b", counters: 0 });
  });
  it("Phoenix Suit gives Steady restrained, then Retaliate1 unleashed", () => {
    let s = base();
    take(s, "34005", "inPlay");
    s = resolve(
      native(s, { type: "status", target: "hero", status: "stunned" }),
    );
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(1);
    phoenixChangeCounters(s, -4);
    s.player.stunCards = 0;
    s.player.stunned = false;
    const m = minion(s);
    s = resolve(native(s, { type: "enemyAttack", id: m.id }));
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(1);
  });
  it("Cerebro searches entire deck with Jean's Psionic trait and shuffles after an actual selection", () => {
    let s = base("alter");
    const support = take(s, "34022", "inPlay");
    const cyclops = s.player.deck.find((p) => p.code === "34003")!;
    s.player.deck = s.player.deck.filter((p) => p.id !== cyclops.id);
    s.player.deck.push(cyclops);
    s = command(s, { type: "ABILITY", id: support.id, action: "cerebro" });
    expect(s.prompt?.options.some((p) => p.id === cyclops.id)).toBe(true);
    s = resolve(choose(s, cyclops.id));
    expect(s.player.hand.some((p) => p.id === cyclops.id)).toBe(true);
  });
  it("Mission Training gives a printed X-Men ally +1THW/+2HP and prohibits a second Training", () => {
    let s = base();
    const ally = take(s, "34014", "inPlay"),
      p = take(s, "34016"),
      r = take(s, "34020");
    s = resolve(paid(s, p, [r], ally.id));
    expect(
      pieceHP(
        s,
        s.player.inPlay.find((q) => q.id === ally.id)!,
      ),
    ).toBe(5);
    const other = take(s, "34016");
    expect(playable(s, other)).toMatch(/target/);
    s = resolve(
      native(s, {
        type: "allyAction",
        id: ally.id,
        kind: "thwart",
        target: "main",
      }),
    );
    expect(s.scheme.threat).toBe(3);
  });
  it("Psychic Manipulation is paid in an actual scheme interrupt and removes the boosted amount", () => {
    let s = base("alter");
    const p = take(s, "34017"),
      a = take(s, "34025"),
      b = take(s, "34020");
    zeroBoost(s);
    s = native(s, { type: "enemyScheme", id: s.villain.id });
    s = choose(s, p.id);
    s = pay(s, [a, b]);
    s = resolve(s);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Burning Hunger restrained removes one counter and surges; unleashed reveals actual reserved Dark Phoenix", () => {
    let s = base();
    const p = encounter(s, "34028");
    s = native(s, { type: "reveal", piece: p });
    s = resolve(s);
    expect(phoenixForce(s)?.counters).toBe(3);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    s = base();
    phoenixChangeCounters(s, -4);
    const hungry = encounter(s, "34028"),
      dark = s.player.setAside!.find((q) => q.code === "34029")!;
    s = resolve(native(s, { type: "reveal", piece: hungry }));
    expect(s.removed.some((q) => q.id === hungry.id)).toBe(true);
    expect(s.minions.find((q) => q.id === dark.id)).toMatchObject({
      code: "34029",
      tough: true,
    });
    expect(s.sideSchemes.find((q) => q.code === "34030")?.counters).toBe(6);
  });
  it("Consume World stays at zero, Dark Phoenix schemes there and12 threat defeats all players", () => {
    let s = base("alter");
    const dark = encounter(s, "34029");
    s = resolve(native(s, { type: "reveal", piece: dark }));
    const world = s.sideSchemes.find((p) => p.code === "34030")!;
    s = resolve(native(s, { type: "thwart", target: world.id, amount: 6 }));
    expect(s.sideSchemes.find((q) => q.id === world.id)?.counters).toBe(0);
    zeroBoost(s);
    s = resolve(native(s, { type: "enemyScheme", id: dark.id }));
    expect(s.scheme.threat).toBe(6);
    expect(s.sideSchemes.find((q) => q.id === world.id)?.counters).toBe(2);
    s = resolve(native(s, { type: "threat", target: world.id, amount: 10 }));
    expect(s.phase).toBe("lost");
  });
});

describe("Phoenix pack timing and supplementary events", () => {
  it("White Hot Room heals Jean at9/12 and has no heal option at full modifiedHP", () => {
    let s = base("alter");
    const room = take(s, "34004", "inPlay");
    const endurance = makePiece(s, "05023");
    endurance.ownerId = "p1";
    s.player.inPlay.push(endurance);
    s.player.hp = 9;
    expect(
      nativeHeroAbilityOptions(s, room.id).some((o) => o.id === "heal"),
    ).toBe(true);
    s = resolve(command(s, { type: "ABILITY", id: room.id, action: "heal" }));
    expect(s.player.hp).toBe(11);
    s.player.inPlay.find((p) => p.id === room.id)!.exhausted = false;
    s.player.hp = 12;
    expect(
      nativeHeroAbilityOptions(s, room.id).some((o) => o.id === "heal"),
    ).toBe(false);
  });
  it("Psionic Bond refreshes per phase while physical Force flips only at the printed thresholds", () => {
    let s = base();
    const p = take(s, "34013");
    s = command(s, { type: "PLAY", id: p.id });
    s = pay(s, [], undefined, ["phoenix-bond"]);
    s = resolve(choose(s, "power"));
    expect(phoenixForce(s)?.counters).toBe(5);
    expect(paymentSources(s).some((p) => p.id === "phoenix-bond")).toBe(false);
    s.phase = "villain";
    expect(paymentSources(s).some((p) => p.id === "phoenix-bond")).toBe(true);
    phoenixChangeCounters(s, -5);
    const id = phoenixForce(s)!.id;
    phoenixChangeCounters(s, 3);
    expect(phoenixForce(s)?.code).toBe("34002b");
    phoenixChangeCounters(s, 2);
    expect(phoenixForce(s)).toMatchObject({ id, code: "34002a", counters: 5 });
  });
  it("Firebird pays its counter before readying Phoenix", () => {
    let s = base();
    s.player.exhausted = true;
    phoenixForce(s)!.counters = 1;
    const p = take(s, "34013"),
      r = take(s, "34020");
    s = paid(s, p, [r]);
    s = resolve(choose(s, "ready"));
    expect(s.player.exhausted).toBe(false);
    expect(phoenixForce(s)).toMatchObject({ code: "34002b", counters: 0 });
  });
  it("Banshee confuses a chosen minion after thwarting and Marvel Girl interrupts with printedSCH", () => {
    let s = base();
    const m = minion(s),
      b = take(s, "34014", "inPlay"),
      g = take(s, "34015", "inPlay");
    s = native(s, {
      type: "allyAction",
      id: b.id,
      kind: "thwart",
      target: "main",
    });
    s = respond(s, /Banshee/);
    s = resolve(choose(s, m.id));
    expect(s.minions.find((p) => p.id === m.id)?.confused).toBe(true);
    expect(s.scheme.threat).toBe(4);
    s = native(s, {
      type: "allyAction",
      id: g.id,
      kind: "attack",
      target: m.id,
    });
    s = resolve(respond(s, /Marvel Girl/));
    expect(s.scheme.threat).toBe(3);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(1);
  });
  it("Storm's cost discount is paid and her interrupt moves actual threat before thwarting", () => {
    let s = base();
    s.scheme.threat = 2;
    const p = take(s, "34021"),
      a = take(s, "34025"),
      b = take(s, "34026");
    s = resolve(paid(s, p, [a, b]));
    const side = encounter(s, "01107");
    side.counters = 4;
    s.sideSchemes.push(side);
    s = native(s, {
      type: "allyAction",
      id: p.id,
      kind: "thwart",
      target: side.id,
    });
    s = resolve(choose(s, "main"));
    expect(s.scheme.threat).toBe(4);
    expect(s.sideSchemes.some((p) => p.id === side.id)).toBe(false);
  });
  it("Mutant Peacekeepers exhausts chosen X-Men and divides their nativeTHW over actual schemes", () => {
    let s = base();
    const ally = take(s, "34014", "inPlay"),
      p = take(s, "34018"),
      r = take(s, "34020");
    const side = encounter(s, "01107");
    side.counters = 3;
    s.sideSchemes.push(side);
    s = paid(s, p, [r]);
    s = choose(s, ally.id);
    s = choose(s, "done");
    s = choose(s, side.id);
    s = choose(s, side.id);
    s = choose(s, side.id);
    s = resolve(s, "main");
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
    expect(s.sideSchemes.some((p) => p.id === side.id)).toBe(false);
    expect(s.scheme.threat).toBe(3);
  });
  it("Swift Retribution uses its exact existing native script and Down Time respects alter-ego REC", () => {
    let s = base();
    s.scheme.threat = 2;
    const p = take(s, "34019"),
      r = take(s, "34020");
    zeroBoost(s);
    s = resolve(paid(s, p, [r]));
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.hp).toBe(46);
    const down = take(s, "34024"),
      r2 = take(s, "34020");
    s = resolve(paid(s, down, [r2]));
    s.player.form = "alter";
    expect(heroStats(s).recover).toBe(5);
    s.player.form = "hero";
    expect(heroStats(s).recover).toBe(3);
  });
  it("Psychic Rapport and Soul Sisters ready exactly the named hero and allies", () => {
    let s = base();
    const cyclops = take(s, "34003", "inPlay");
    cyclops.exhausted = true;
    s.player.exhausted = true;
    const p = take(s, "34023"),
      r = take(s, "34025");
    s = paid(s, p, [r]);
    const forceChoice = s.prompt?.options.find((o) =>
      /Place 2 power counters/.test(o.label),
    );
    expect(forceChoice, JSON.stringify(s.prompt)).toBeDefined();
    s = resolve(choose(s, forceChoice!.id));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === cyclops.id)?.exhausted).toBe(
      false,
    );
    expect(phoenixForce(s)?.counters).toBe(6);
    const storm = take(s, "34021", "inPlay");
    storm.exhausted = true;
    storm.damage = 2;
    s.player.exhausted = true;
    s.player.hp = 5;
    const sisters = makePiece(s, "34035");
    sisters.ownerId = "p1";
    s.player.hand.push(sisters);
    const payCard = take(s, "34020");
    s = resolve(paid(s, sisters, [payCard]));
    expect(s.player.hp).toBe(7);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === storm.id)).toMatchObject({
      damage: 0,
      exhausted: false,
    });
  });
  it("Psychic Assault pays to attack and confuse; Psychic Kicker boosts exactly the next ally power", () => {
    let s = base();
    const assault = makePiece(s, "34032");
    assault.ownerId = "p1";
    s.player.hand.push(assault);
    const r = take(s, "34025");
    s = paid(s, assault, [r]);
    s = resolve(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(47);
    expect(s.villain.confused).toBe(true);
    const ally = take(s, "34014", "inPlay");
    ally.exhausted = true;
    const kicker = makePiece(s, "34034");
    kicker.ownerId = "p1";
    s.player.hand.push(kicker);
    s = paid(s, kicker, []);
    s = resolve(choose(s, ally.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
      false,
    );
    s = resolve(
      native(s, {
        type: "allyAction",
        id: ally.id,
        kind: "attack",
        target: s.villain.id,
      }),
    );
    expect(s.villain.hp).toBe(43);
    s.player.inPlay.find((p) => p.id === ally.id)!.exhausted = false;
    s = resolve(
      native(s, {
        type: "allyAction",
        id: ally.id,
        kind: "attack",
        target: s.villain.id,
      }),
    );
    expect(s.villain.hp).toBe(41);
  });
  it("Psychic Misdirection pays during an actual incoming attack and redirects its damage to a different enemy", () => {
    let s = base();
    const m = minion(s);
    const p = makePiece(s, "34033");
    p.ownerId = "p1";
    s.player.hand.push(p);
    const r = take(s, "34025");
    s = native(s, { type: "enemyAttack", id: m.id });
    s = respond(s, /Psychic Misdirection/);
    s = pay(s, [r]);
    s = choose(s, s.villain.id);
    s = resolve(s);
    expect(s.player.hp).toBe(9);
    expect(s.villain.hp).toBe(48);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Fiery Rage activates actual Dark Phoenix or places one threat and surges when absent", () => {
    let s = base();
    const world = encounter(s, "34030");
    s = resolve(native(s, { type: "reveal", piece: world }));
    const rage = encounter(s, "34031");
    s = resolve(native(s, { type: "reveal", piece: rage }));
    expect(s.sideSchemes.find((p) => p.id === world.id)?.counters).toBe(7);
    s = base();
    const dark = encounter(s, "34029");
    s = resolve(native(s, { type: "reveal", piece: dark }));
    zeroBoost(s);
    const r = encounter(s, "34031");
    s = resolve(native(s, { type: "reveal", piece: r }));
    expect(s.player.hp).toBe(6); // Consume World Amplify adds1 to the otherwise zero boost.
  });
  it("Shadows uses original reserved nemesis IDs and shuffles all three Fiery Rage copies", () => {
    let s = base();
    const ids = s.player.setAside!.map((p) => p.id);
    const shadows = encounter(s, "01190");
    s = resolve(native(s, { type: "reveal", piece: shadows }));
    expect(s.player.setAside).toHaveLength(0);
    expect(s.minions.some((p) => p.code === "34029")).toBe(true);
    expect(s.sideSchemes.find((p) => p.code === "34030")?.counters).toBe(6);
    expect(
      [
        ...s.minions,
        ...s.sideSchemes,
        ...s.encounter.deck,
        ...s.encounter.discard,
      ].filter((p) => ids.includes(p.id)),
    ).toHaveLength(5);
  });
});

describe("Passion for Justice event-wide alteration", () => {
  it("adds1 to each distinct native Multitasking thwart, preserving a single physical payment", () => {
    let s = base();
    const p = makePiece(s, "15013");
    p.ownerId = "p1";
    s.player.hand.push(p);
    const r = take(s, "34020"),
      side = encounter(s, "01107");
    side.counters = 4;
    s.sideSchemes.push(side);
    s = command(s, { type: "PLAY", id: p.id });
    s = pay(s, [r], "mental");
    s = choose(s, "main");
    s = resolve(s.prompt ? choose(s, side.id) : s);
    expect(s.scheme.threat).toBe(3);
    expect(s.sideSchemes.find((p) => p.id === side.id)?.counters).toBe(1);
    expect(s.player.discard.filter((p) => p.id === r.id)).toHaveLength(1);
  });
});

describe("Phoenix Suit changing Steady status thresholds", () => {
  it("retains one actual status card and becomes stunned when Unleashed loses Steady", () => {
    let s = base();
    take(s, "34005", "inPlay");
    s = resolve(
      native(s, { type: "status", target: "hero", status: "stunned" }),
    );
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(1);
    phoenixForce(s)!.counters = 1;
    const event = take(s, "34013");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [], undefined, ["phoenix-bond"]);
    expect(s.player.stunned).toBe(true);
    expect(s.player.stunCards).toBe(1);
    s = resolve(choose(s, "power"));
  });
});

describe("Phoenix Suit applies identity-wide conditional keywords", () => {
  it("Jean Grey retains Steady while Restrained", () => {
    let s = base("alter");
    take(s, "34005", "inPlay");
    s = resolve(
      native(s, { type: "status", target: "hero", status: "confused" }),
    );
    expect(s.player.confused).toBe(false);
    expect(s.player.confuseCards).toBe(1);
  });
});

describe("Mind Control ending returns original player-owned allies", () => {
  it("returns the same ally to ownerp2 after older Beguiled leaves and Phoenixp1's Mind Control ends", () => {
    let s = newGame({
      heroId: "phoenix",
      aspect: "justice",
      villainId: "rhino",
      seed: 34009,
      pacing: "expert",
      heroes: [
        { heroId: "phoenix", aspect: "justice" },
        { heroId: "spider_man", aspect: "justice" },
      ],
    });
    s = resolve(command(s, { type: "MULLIGAN", ids: [] }));
    s = resolve(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.deck.push(...s.player.hand.splice(0));
    s.player.form = "hero";
    const other = seatView(s, "p2").player;
    const zone = [other.hand, other.deck].find((zone) =>
      zone.some((p) => card(p).type_code === "ally"),
    )!;
    const index = zone.findIndex((p) => card(p).type_code === "ally");
    const ally = zone.splice(index, 1)[0];
    other.inPlay.push(ally);
    expect(ally.ownerId).toBe("p2");
    const beguiled = makePiece(s, "25031");
    beguiled.attachedTo = ally.id;
    s.attachments.push(beguiled);
    s = resolve(native(s, { type: "draw", amount: 0 }));
    expect(s.minions.some((p) => p.id === ally.id)).toBe(true);
    const mind = take(s, "34009"),
      a = take(s, "34025"),
      b = take(s, "34026");
    s = resolve(paid(s, mind, [a, b], ally.id));
    expect(controller(s, ally.id)?.id).toBe("p1");
    s = resolve(native(s, { type: "discardPiece", id: beguiled.id }));
    expect(controller(s, ally.id)?.id).toBe("p1");
    s = resolve(native(s, { type: "discardPiece", id: mind.id }));
    expect(controller(s, ally.id)?.id).toBe("p2");
    const physical = [
      ...s.minions,
      ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
    ].filter((p) => p.id === ally.id);
    expect(physical).toHaveLength(1);
    expect(physical[0].ownerId).toBe("p2");
    expect(physical[0].treatedAsAlly).toBeUndefined();
    expect(card(physical[0]).type_code).toBe("ally");
  });
});

describe("Passion for Justice expires after its actual paid event", () => {
  it("Morphogenetics returns the same Multitasking, whose replay removes only its printed2 threat from each scheme", () => {
    const codes = deckCodes("ms_marvel", "justice");
    const replace = codes
      .map((code, index) => ({ code, index }))
      .filter(({ code }) => card(code).faction_code === "justice")
      .slice(0, 2);
    codes[replace[0].index] = "15013";
    codes[replace[1].index] = "34020";
    let s = newGame({
      heroId: "ms_marvel",
      aspect: "justice",
      villainId: "rhino",
      seed: 34020,
      pacing: "expert",
      heroes: [{ heroId: "ms_marvel", aspect: "justice", deckCards: codes }],
    });
    s = resolve(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.deck.push(...s.player.hand.splice(0));
    s.player.form = "hero";
    s.player.exhausted = false;
    s.scheme.threat = 6;
    const event = take(s, "15013"),
      passion = take(s, "34020");
    const mentalCode = s.player.deck.find((p) => card(p).resource_mental)!;
    const mental = take(s, mentalCode.code);
    const side = encounter(s, "01107");
    side.counters = 6;
    s.sideSchemes.push(side);
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [passion], "mental");
    s = choose(s, "main");
    s = resolve(respond(s, /Morphogenetics/));
    expect(s.scheme.threat).toBe(3);
    expect(s.sideSchemes.find((p) => p.id === side.id)?.counters).toBe(3);
    expect(s.player.hand.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(s.player.exhausted).toBe(true);
    s = command(reload(s), { type: "PLAY", id: event.id });
    s = pay(s, [mental]);
    s = resolve(choose(s, "main"));
    expect(s.scheme.threat).toBe(1);
    expect(s.sideSchemes.find((p) => p.id === side.id)?.counters).toBe(1);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === passion.id)).toHaveLength(1);
  });
});

describe("Phoenix effects handle actual synthetic Ultron Drones", () => {
  it.each(["34008", "34009"])(
    "%s attaches to the actual Drone and preserves its captured player card through removal",
    (code) => {
      let s = base();
      const upgrade = take(s, code);
      const resources = [take(s, "34025")];
      if (code === "34009") resources.push(take(s, "34026"));
      const captured = s.player.deck[0];
      s = resolve(native(s, { type: "drone" }));
      const drone = s.minions.find((p) => p.code === "drone")!;
      expect(drone.droneCard?.id).toBe(captured.id);
      expect(
        playable(
          s,
          s.player.hand.find((p) => p.id === upgrade.id)!,
        ),
      ).toBeNull();
      s = resolve(paid(s, upgrade, resources, drone.id));
      if (code === "34008") {
        s = resolve(
          native(
            s,
            { type: "enemyAttack", id: drone.id },
            { type: "enemyScheme", id: drone.id },
          ),
        );
        expect(s.player.hp).toBe(9);
        expect(s.scheme.threat).toBe(6);
      } else {
        const ally = s.player.inPlay.find((p) => p.id === drone.id)!;
        expect(card(ally)).toMatchObject({ type_code: "ally", thwart: 1 });
        expect(ally.droneCard?.id).toBe(captured.id);
        expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
      }
      s = resolve(native(s, { type: "discardPiece", id: upgrade.id }));
      expect(s.minions.find((p) => p.id === drone.id)).toMatchObject({
        code: "drone",
        droneCard: { id: captured.id },
        engagedWith: "p1",
      });
      s = resolve(native(s, { type: "damage", target: drone.id, amount: 1 }));
      expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
      expect(s.player.discard.filter((p) => p.id === captured.id)).toHaveLength(
        1,
      );
      expect(s.player.discard.filter((p) => p.id === upgrade.id)).toHaveLength(
        1,
      );
      expect(original(s)).toHaveLength(41);
    },
  );
  it("a Mind-Controlled Drone's defeat returns its actual captured card and attached upgrade exactly once", () => {
    let s = base();
    const upgrade = take(s, "34009");
    const resources = [take(s, "34025"), take(s, "34026")];
    const captured = s.player.deck[0];
    s = resolve(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.code === "drone")!;
    s = resolve(paid(s, upgrade, resources, drone.id));
    s = resolve(native(s, { type: "damage", target: drone.id, amount: 1 }));
    expect(s.player.inPlay.some((p) => p.id === drone.id)).toBe(false);
    expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === captured.id)).toHaveLength(
      1,
    );
    expect(s.player.discard.filter((p) => p.id === upgrade.id)).toHaveLength(1);
    expect(original(s)).toHaveLength(41);
  });
  it("Banshee names and confuses a Drone; Marvel Girl removes its printed1 SCH before defeating it", () => {
    let s = base();
    const banshee = take(s, "34014", "inPlay");
    const marvelGirl = take(s, "34015", "inPlay");
    const captured = s.player.deck[0];
    s = resolve(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.code === "drone")!;
    s = native(s, {
      type: "allyAction",
      id: banshee.id,
      kind: "thwart",
      target: "main",
    });
    s = respond(s, /Banshee/);
    expect(s.prompt?.options).toContainEqual(
      expect.objectContaining({ id: drone.id, label: "Ultron Drone" }),
    );
    s = resolve(choose(s, drone.id));
    expect(s.minions.find((p) => p.id === drone.id)?.confused).toBe(true);
    expect(s.scheme.threat).toBe(4);
    s = native(s, {
      type: "allyAction",
      id: marvelGirl.id,
      kind: "attack",
      target: drone.id,
    });
    s = resolve(respond(s, /Marvel Girl/));
    expect(s.scheme.threat).toBe(3);
    expect(s.minions.some((p) => p.id === drone.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === captured.id)).toHaveLength(
      1,
    );
    expect(original(s)).toHaveLength(41);
  });
});
