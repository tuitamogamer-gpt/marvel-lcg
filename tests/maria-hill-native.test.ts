import { describe, expect, it } from "vitest";
import {
  newGame,
  makePiece,
  dispatch,
  nativeHeroAbilityOptions,
  paymentSources,
  enemyStats,
  targets,
} from "../src/game/engine.js";
import { card, heroStats, deckCodes, HEROES } from "../src/game/cards.js";
import { seatView, allInPlay } from "../src/game/team.js";
import {
  heroStarterCodes,
  heroStarterAspects,
  heroRequiredCards,
  validateHeroDeck,
} from "../src/game/hero-runtime.js";
import { deckErrors, deckOptions } from "../src/game/decks.js";
import { boardSnapshot, recordReview } from "../src/game/review.js";
import { attackContext } from "../src/game/presentation.js";
import { MARIA_HILL_SCRIPT_CODES } from "../src/game/maria-hill.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import {
  command,
  choose,
  finish,
  native,
  hand,
  put,
  top,
  minion,
  side,
  play,
  pay,
  respond,
  target,
  passId,
  reload,
} from "./dv-test-helpers.js";
import type { GameState, Piece } from "../src/game/types.js";
const base = (alter = false, team = false) => {
  let s = newGame({
    heroId: "maria_hill",
    aspect: "leadership",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 50001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "maria_hill", aspect: "leadership" as const },
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
  s.scheme.threat = 2;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
};
const cast = (s: GameState, ...codes: string[]) => {
  const ps = hand(s, ...codes);
  return play(s, ps[0], ps.slice(1));
};
const act = (s: GameState, p: Piece | string, action: string) =>
  command(s, { type: "ABILITY", id: typeof p === "string" ? p : p.id, action });
const reveal = (s: GameState, code: string) =>
  native(s, { type: "reveal", piece: makePiece(s, code) });
describe("Maria Hill original source and native command integration", () => {
  it("registers every owned retail face and preserves the exact Leadership source", () => {
    const s = base();
    expect(MARIA_HILL_SCRIPT_CODES).toHaveLength(33);
    expect(
      MARIA_HILL_SCRIPT_CODES.filter((c) => !hasExecutableScript(c)),
    ).toEqual([]);
    expect(heroStarterCodes("maria_hill")).toHaveLength(40);
    expect(deckCodes("maria_hill", "leadership")).toEqual(
      heroStarterCodes("maria_hill"),
    );
    expect(heroStarterAspects("maria_hill")).toEqual(["leadership"]);
    expect((s.player.setAside || []).map((p) => p.code)).toEqual([
      "50030",
      "50031",
      "50032",
      "50033",
      "50033",
    ]);
    expect(
      Object.values(heroRequiredCards("maria_hill")).reduce((a, b) => a + b, 0),
    ).toBe(15);
  });
  it("searches an actual physical SHIELD support with the alter-ego action", () => {
    let s = base(true);
    const p = s.player.deck.find((q) => q.code === "50009")!;
    s = act(s, "identity", "shield-search");
    s = finish(choose(reload(s), p.id));
    expect(s.player.hand.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.exhausted).toBe(true);
  });
  it("reassigns a counter across players and discards a Uses support when its last counter leaves", () => {
    let s = base(false, true);
    const from = put(s, "50008"),
      to = put(s, "50009", "p2");
    from.counters = 1;
    to.counters = 2;
    s = act(s, "identity", "reassignment");
    s = choose(s, from.id);
    s = finish(choose(s, to.id));
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === to.id)?.counters,
    ).toBe(3);
    expect(s.player.discard.some((p) => p.id === from.id)).toBe(true);
    expect(
      nativeHeroAbilityOptions(s).some((o) => o.id === "reassignment"),
    ).toBe(false);
  });
  it("Reinforcements targets other players' supports within a single printed-cost budget", () => {
    let s = base(false, true);
    const staff = put(s, "50008", "p2"),
      iliad = put(s, "50009");
    s = cast(s, "50005", "50025");
    s = choose(s, iliad.id);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(staff.id);
    s = finish(choose(s, "done"));
    expect(s.player.inPlay.find((p) => p.id === iliad.id)?.counters).toBe(1);
  });
  it("On the Double can ready a teammate's support", () => {
    let s = base(false, true);
    const staff = put(s, "50008", "p2");
    staff.exhausted = true;
    s = cast(s, "50004");
    s = choose(s, staff.id);
    s = finish(choose(s, "done"));
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === staff.id)?.exhausted,
    ).toBe(false);
  });
  it("The Hard Call pays its own support cost then damages every enemy simultaneously", () => {
    let s = base();
    const fleet = put(s, "50009"),
      m = minion(s);
    s = cast(s, "50006", "50025");
    s = finish(choose(s, fleet.id));
    expect(s.villain.hp).toBe(74);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === fleet.id)).toBe(true);
  });
  it("Special Funding adds its response after the support receives its printed Uses", () => {
    let s = base();
    const [staff, funding] = hand(s, "50008", "50007");
    s = play(s, staff, [funding]);
    s = finish(respond(s, /Special Funding/));
    expect(s.player.inPlay.find((p) => p.id === staff.id)?.counters).toBe(4);
  });
  it("Support Staff can fund another SHIELD player's payment and discards its last use", () => {
    let s = base(false, true);
    const staff = put(s, "50008", "p2");
    staff.counters = 1;
    const [support] = hand(s, "50008");
    const source = paymentSources(s, support.id, support.code).find(
      (q) => q.localId === staff.id,
    )!;
    expect(source).toBeTruthy();
    s = command(s, { type: "PLAY", id: support.id });
    s = command(s, { type: "PAY", ids: [source.id] });
    s = finish(s);
    expect(
      seatView(s, "p2").player.discard.some((q) => q.id === staff.id),
    ).toBe(true);
  });
  it("Organizational Support generates only selected matching cards' printed icons and exhausts at commit", () => {
    let s = base();
    const nick = put(s, "50002"),
      support = put(s, "50008");
    const [iliad, org, energy, genius] = hand(
      s,
      "50009",
      "50014",
      "50025",
      "50026",
    );
    s = command(s, { type: "PLAY", id: iliad.id });
    s = command(s, { type: "PAY", ids: [org.id, energy.id, genius.id] });
    expect(s.prompt?.title).toBe("Organizational Support");
    s = choose(s, nick.id);
    s = choose(s, "done");
    expect(s.prompt?.kind).toBe("payment");
    expect(s.player.inPlay.find((p) => p.id === nick.id)?.exhausted).toBe(
      false,
    );
    s = command(s, { type: "PAY", ids: [org.id, energy.id, genius.id] });
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === nick.id)?.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === support.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.inPlay.find((p) => p.id === iliad.id)?.counters).toBe(3);
  });
  it("Controlled Innocents uses the actual owned top card and restores it to its owner's discard on defeat", () => {
    let s = base();
    const environment = makePiece(s, "50032");
    s.environments!.push(environment);
    const p = top(s, "50011"),
      id = p.id;
    s = finish(native(s, { type: "maria:controller" }));
    expect(s.minions.find((q) => q.id === id)?.mariaControlled).toBe(true);
    expect(card(s.minions.find((q) => q.id === id)!)).toMatchObject({
      name: "Controlled Innocent",
      attack: 1,
      scheme: 1,
      health: 1,
    });
    expect(targets(s, "enemy").find((q) => q.id === id)?.code).toBeUndefined();
    s = finish(native(s, { type: "damage", target: id, amount: 1 }));
    expect(s.player.discard.find((q) => q.id === id)?.code).toBe("50011");
    expect(
      s.player.discard.find((q) => q.id === id)?.mariaControlled,
    ).toBeUndefined();
    expect(s.scheme.threat).toBe(3);
  });
});

describe("Maria Hill fleets, native windows and physical encounter set", () => {
  it("All-Points Bulletin resolves one independently chosen effect per controlled support", () => {
    let s = base();
    put(s, "50008");
    put(s, "50009");
    s = cast(s, "50003", "50025");
    s = choose(s, `damage:${s.villain.id}`);
    s = finish(choose(s, "threat:main"));
    expect(s.villain.hp).toBe(79);
    expect(s.scheme.threat).toBe(1);
  });
  it("The Iliad spends a real mission counter for damage", () => {
    let s = base();
    const p = put(s, "50009");
    p.counters = 3;
    s = act(s, p, "support-action");
    s = choose(s, "damage");
    s = finish(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(75);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.counters).toBe(2);
  });
  it("Director can place a counter on a teammate's support", () => {
    let s = base(false, true);
    const director = put(s, "50011"),
      support = put(s, "50009", "p2");
    s = act(s, director, "director");
    s = finish(choose(s, support.id));
    expect(
      seatView(s, "p2").player.inPlay.find((q) => q.id === support.id)
        ?.counters,
    ).toBe(1);
    expect(s.player.inPlay.find((q) => q.id === director.id)?.exhausted).toBe(
      true,
    );
  });
  it("Victoria Hand readies an actual teammate support after entry", () => {
    let s = base(false, true);
    const support = put(s, "50009", "p2");
    support.exhausted = true;
    s = cast(s, "50012", "50025", "50027");
    s = respond(s, /Victoria Hand/);
    s = finish(choose(s, support.id));
    expect(
      seatView(s, "p2").player.inPlay.find((q) => q.id === support.id)
        ?.exhausted,
    ).toBe(false);
  });
  it("Slingshot enters under another player's control for Energy and returns to her original owner at phase end", () => {
    let s = base(false, true);
    s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01102"));
    const [p, energy] = hand(s, "50013", "50025");
    s = act(s, p, "slingshot");
    s = pay(s, [energy]);
    s = finish(choose(s, "p2"));
    expect(
      seatView(s, "p2").player.inPlay.find((q) => q.id === p.id)?.ownerId,
    ).toBe("p1");
    s = command(s, { type: "END_TURN", discard: [] });
    s = command(s, { type: "END_TURN", discard: [] });
    for (let n = 0; s.phase === "player" && s.prompt && n < 10; n++) {
      if (s.prompt.kind === "select")
        s = command(s, {
          type: "SELECT",
          ids: s.prompt.options.slice(0, s.prompt.min || 0).map((o) => o.id),
        });
      else s = choose(s, passId(s) || s.prompt.options[0].id);
    }
    expect(s.phase).toBe("villain");
    expect(seatView(s, "p2").player.inPlay.some((q) => q.id === p.id)).toBe(
      false,
    );
    expect(
      [...seatView(s, "p1").player.hand, ...seatView(s, "p1").player.deck].some(
        (q) => q.id === p.id,
      ),
    ).toBe(true);
  });
  it("Command Team's actual printing readies an ally and discards its last command counter", () => {
    let s = base();
    const team = put(s, "50016"),
      nick = put(s, "50002");
    team.counters = 1;
    nick.exhausted = true;
    s = act(s, team, "support-action");
    s = finish(choose(s, nick.id));
    expect(s.player.inPlay.find((q) => q.id === nick.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.discard.some((q) => q.id === team.id)).toBe(true);
  });
  it("The Circe puts the chosen player's actual hand ally under their control", () => {
    let s = base(false, true);
    const circe = put(s, "50017");
    circe.counters = 2;
    const ally = makePiece(s, "01002");
    ally.ownerId = "p2";
    seatView(s, "p2").player.hand.push(ally);
    s = act(s, circe, "support-action");
    s = choose(s, "p2");
    s = finish(choose(s, ally.id));
    expect(
      seatView(s, "p2").player.inPlay.find((q) => q.id === ally.id)?.ownerId,
    ).toBe("p2");
    expect(s.player.inPlay.find((q) => q.id === circe.id)?.counters).toBe(1);
  });
  it("The Bellerophon discards every Tough card before its chosen-player enemy damage", () => {
    let s = base(false, true);
    const ship = put(s, "50018");
    ship.counters = 3;
    const a = minion(s, "01101", "p1"),
      b = minion(s, "01101", "p2");
    s.villain.tough = true;
    s.villain.toughCards = 2;
    b.tough = true;
    b.toughCards = 2;
    s = act(s, ship, "support-action");
    s = finish(choose(s, "p2"));
    expect(s.villain.hp).toBe(77);
    expect(s.villain.tough).toBe(false);
    expect(s.minions.find((q) => q.id === a.id)?.damage).toBe(0);
    expect(s.minions.some((q) => q.id === b.id)).toBe(false);
  });
  it("The Douglass ignores Crisis and removes threat from every scheme", () => {
    let s = base();
    const ship = put(s, "50019");
    ship.counters = 3;
    const crisis = side(s, "01125", 4);
    s.scheme.threat = 4;
    s = finish(act(s, ship, "support-action"));
    expect(s.scheme.threat).toBe(2);
    expect(s.sideSchemes.find((q) => q.id === crisis.id)?.counters).toBe(2);
  });
  it("The Pericles gives separately chosen statuses to an identity and a minion", () => {
    let s = base();
    const ship = put(s, "50020");
    ship.counters = 2;
    const m = minion(s);
    s = act(s, ship, "support-action");
    s = choose(s, s.villain.id);
    s = choose(s, "stunned");
    s = choose(s, m.id);
    s = finish(choose(s, "confused"));
    expect(s.villain.stunned).toBe(true);
    expect(s.minions.find((q) => q.id === m.id)?.confused).toBe(true);
  });
  it("Dum Dum Dugan's reprint exhausts actual SHIELD cards to boost its basic power", () => {
    let s = base();
    const dugan = put(s, "50021"),
      staff = put(s, "50008");
    s = act(s, dugan, "attack");
    s = target(s, s.villain.id);
    s = respond(s, /Dum Dum/);
    s = choose(s, staff.id);
    s = finish(choose(s, "done"));
    expect(s.villain.hp).toBe(76);
    expect(s.player.inPlay.find((q) => q.id === staff.id)?.exhausted).toBe(
      true,
    );
  });
  it("Nick Fury responds after a basic thwart with a counter on any SHIELD support", () => {
    let s = base(false, true);
    const nick = put(s, "50002"),
      support = put(s, "50009", "p2");
    s = act(s, nick, "thwart");
    s = target(s, "main");
    s = respond(s, /Nick Fury/);
    s = finish(choose(s, support.id));
    expect(
      seatView(s, "p2").player.inPlay.find((q) => q.id === support.id)
        ?.counters,
    ).toBe(1);
  });
  it("Melinda May looks at the actual encounter top, may keep it, and preserves knowledge through reload", () => {
    let s = base();
    const may = put(s, "50023"),
      id = s.encounter.deck[0].id;
    s = act(s, may, "thwart");
    s = target(s, "main");
    s = respond(s, /Melinda May/);
    s = finish(choose(s, "leave"));
    expect(reload(s).encounter.knownTop?.id).toBe(id);
    expect(s.encounter.deck[0].id).toBe(id);
  });
  it("Life Model Decoy prevents the actual attack without exhausting or claiming a defense", () => {
    let s = base();
    const decoy = put(s, "50010"),
      front = put(s, "50028"),
      hp = s.player.hp;
    s.phase = "villain";
    const resolving = makePiece(s, "01188");
    s.resolving.push(resolving);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = finish(respond(s, /Life Model/));
    expect(s.player.hp).toBe(hp);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((q) => q.id === decoy.id)).toBe(true);
    expect(s.player.inPlay.some((q) => q.id === front.id)).toBe(true);
  });
  it("Grant Ward cannot defend and is removed after declining a revealed-treachery payment", () => {
    let s = base();
    const ward = put(s, "50022"),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    for (let i = 0; s.prompt && !/attacks$/.test(s.prompt.title) && i < 30; i++)
      s = choose(s, passId(s) || s.prompt.options[0].id);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(ward.id);
    s = finish(s);
    const before = s.player.hp;
    s = reveal(s, "01186");
    s = finish(respond(s, /Grant Ward|Take damage/));
    expect(s.player.hp).toBe(before - 2);
    expect(s.removed.some((q) => q.id === ward.id)).toBe(true);
  });
  it("Front Organization replaces Caught Off Guard's actual discard but cannot pay The Hard Call's cost", () => {
    let s = base();
    const front = put(s, "50028"),
      iliad = put(s, "50009");
    s = reveal(s, "01188");
    s = choose(s, iliad.id);
    expect(s.prompt?.title).toBe("Front Organization");
    s = finish(choose(s, front.id));
    expect(s.player.inPlay.some((q) => q.id === iliad.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === front.id)).toBe(true);
    const next = put(s, "50028");
    s = cast(s, "50006", "50025");
    s = finish(choose(s, iliad.id));
    expect(s.player.inPlay.some((q) => q.id === next.id)).toBe(true);
    expect(s.player.discard.some((q) => q.id === iliad.id)).toBe(true);
  });
  it("Front Organization distinguishes a villain-phase player discard cost from an explicit encounter instruction", () => {
    let s = base();
    const front = put(s, "50028"),
      decoy = put(s, "50010"),
      ally = put(s, "50012");
    s.phase = "villain";
    const source = makePiece(s, "01188");
    s.resolving.push(source);
    s.currentRevealWindowId = source.id;
    s = finish(
      native(s, {
        type: "maria:lmd",
        id: decoy.id,
        after: [],
        revealWindowId: source.id,
      }),
    );
    expect(s.player.inPlay.some((p) => p.id === front.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === decoy.id)).toBe(true);
    s = native(s, {
      type: "discardPiece",
      id: ally.id,
      encounterDiscard: true,
      source: source.id,
      after: [{ type: "threat", target: "main", amount: 1 }],
    });
    expect(s.prompt?.title).toBe("Front Organization");
    const beforeThreat = s.scheme.threat;
    s = finish(choose(s, front.id));
    expect(s.scheme.threat).toBe(beforeThreat + 1);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === front.id)).toBe(true);
  });
  it("Press Conference removes counters through Uses cleanup and has an actual alter-ego action", () => {
    let s = base();
    const staff = put(s, "50008");
    staff.counters = 1;
    const front = put(s, "50028");
    s = finish(reveal(s, "50029"));
    const obligation = s.player.inPlay.find((q) => q.code === "50029")!;
    s = finish(native(s, { type: "maria:press" }));
    expect(s.player.discard.some((q) => q.id === staff.id)).toBe(true);
    expect(s.player.inPlay.some((q) => q.id === front.id)).toBe(true);
    s = finish(command(s, { type: "FLIP" }));
    s = finish(act(s, obligation, "press-conference"));
    expect(s.player.discard.some((q) => q.id === obligation.id)).toBe(false);
    expect(s.encounter.discard.some((q) => q.id === obligation.id)).toBe(true);
    expect(s.player.exhausted).toBe(true);
  });
  it("Press Conference's encounter action remains available during another player's Merc turn", () => {
    let s = base(true, true);
    s = finish(reveal(s, "50029"));
    const obligation = s.player.inPlay.find((q) => q.code === "50029")!;
    put(s, "44032", "p2");
    s.turnPlayerId = "p2";
    expect(
      nativeHeroAbilityOptions(s, obligation.id).map((o) => o.id),
    ).toContain("press-conference");
    s = finish(act(s, obligation, "press-conference"));
    expect(s.encounter.discard.some((q) => q.id === obligation.id)).toBe(true);
  });
  it("the original Shadows set retains all five nemesis IDs and finds its physical environment", () => {
    let s = base();
    const ids = (s.player.setAside || []).map((q) => q.id);
    s = finish(reveal(s, "01190"));
    for (const id of ids)
      expect(
        [
          ...s.minions,
          ...s.sideSchemes,
          ...s.environments!,
          ...s.encounter.deck,
          ...s.encounter.discard,
          ...s.resolving,
        ].filter((q) => q.id === id),
      ).toHaveLength(1);
    expect(s.minions.some((q) => q.code === "50030")).toBe(true);
    expect(s.environments!.some((q) => q.code === "50032")).toBe(true);
  });
});

describe("Maria Hill source limits, payment provenance and nemesis timing", () => {
  it("allows maximum copies of three logical off-aspect SHIELD support types, merging reprint copy counts", () => {
    const source = heroStarterCodes("maria_hill");
    expect(
      validateHeroDeck("maria_hill", ["leadership"], source).errors,
    ).toEqual([]);
    let codes = source.map((c) =>
      ["50018", "50019", "50020"].includes(c) ? "01056" : c,
    );
    codes = codes
      .map((c) => (c === "50028" ? "01064" : c))
      .map((c) => (c === "50025" ? "01080" : c));
    expect(
      validateHeroDeck("maria_hill", ["leadership"], codes).errors,
    ).toEqual([]);
    expect(
      deckOptions("maria_hill", "leadership").some((c) => c.code === "01080"),
    ).toBe(true);
    const fourth = codes.map((c) => (c === "50026" ? "27044" : c));
    expect(
      validateHeroDeck("maria_hill", ["leadership"], fourth).errors,
    ).toContain(
      "Maria Hill may include at most 3 different off-aspect S.H.I.E.L.D. supports.",
    );
    const reprint = [...codes];
    reprint[reprint.indexOf("50026")] = "08016";
    expect(
      validateHeroDeck("maria_hill", ["leadership"], reprint).errors.some(
        (e) => e.includes("Surveillance Team") && e.includes("4 copies"),
      ),
    ).toBe(true);
  });
  it("Special Funding wholly overpaid from its physical source grants no counter response", () => {
    let s = base();
    const [staff, funding, genius] = hand(s, "50008", "50007", "50026");
    s = command(s, { type: "PLAY", id: staff.id });
    s = command(s, { type: "PAY", ids: [funding.id, genius.id] });
    expect(s.prompt?.title).toBe("Allocate Special Funding");
    const other = s.prompt!.options.find(
      (o) => o.label === "Use other sources for the cost",
    )!;
    s = finish(choose(s, other.id));
    expect(s.player.inPlay.find((p) => p.id === staff.id)?.counters).toBe(3);
    expect(s.player.discard.some((p) => p.id === funding.id)).toBe(true);
  });
  it("Maria grants SHIELD only to her own allies in hero form, enabling actual Organizational Support choices", () => {
    let s = base(true, true);
    const ally = put(s, "01068"),
      other = put(s, "01068", "p2");
    const [staff, org] = hand(s, "50008", "50014");
    s = command(s, { type: "PLAY", id: staff.id });
    s = command(s, { type: "PAY", ids: [org.id] });
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(ally.id);
    s = choose(s, "done");
    s = finish(command(s, { type: "PAY", ids: [org.id] }));
    s = finish(command(s, { type: "FLIP" }));
    const [support, next] = hand(s, "50016", "50014");
    s = command(s, { type: "PLAY", id: support.id });
    s = command(s, { type: "PAY", ids: [next.id] });
    expect(s.prompt?.options.map((o) => o.id)).toContain(ally.id);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(other.id);
  });
  it("Controller uses its scan-verified 2 SCH, then removes a counter and converts the actual top card", () => {
    let s = base();
    s.scheme.threat = 0;
    const enemy = minion(s, "50030"),
      staff = put(s, "50008");
    staff.counters = 2;
    s.environments!.push(makePiece(s, "50032"));
    const original = top(s, "50011");
    expect(card(enemy).scheme).toBe(2);
    s = native(s, { type: "enemyScheme", id: enemy.id });
    s = finish(choose(s, staff.id));
    expect(s.scheme.threat).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === staff.id)?.counters).toBe(1);
    expect(s.minions.find((p) => p.id === original.id)?.mariaControlled).toBe(
      true,
    );
  });
  it("keeps the real Controlled card face hidden in action reviews and attack participants", () => {
    let s = base();
    s.environments!.push(makePiece(s, "50032"));
    const original = top(s, "50011"),
      before = boardSnapshot(s);
    s = finish(native(s, { type: "maria:controller" }));
    s.guided = true;
    recordReview(s, before, { type: "maria:controller" });
    const shown = s.review?.cards?.find((q) => q.id === original.id);
    expect(shown?.code).toBeUndefined();
    expect(shown?.back).toBe("hero");
    expect(shown?.name).toBe("Controlled Innocent");
    s.review = null;
    s = native(s, { type: "enemyAttack", id: original.id });
    expect(attackContext(s)?.attacker).toEqual({
      code: "back:hero",
      name: "Controlled Innocent",
    });
  });
  it("a stunned Controller never completes an activation or its forced response", () => {
    let s = base();
    const enemy = minion(s, "50030"),
      staff = put(s, "50008");
    staff.counters = 2;
    enemy.stunned = true;
    s.environments!.push(makePiece(s, "50032"));
    s = finish(native(s, { type: "enemyAttack", id: enemy.id }));
    expect(s.player.inPlay.find((p) => p.id === staff.id)?.counters).toBe(2);
    expect(s.minions.filter((p) => p.mariaControlled)).toHaveLength(0);
  });
  it("Army of the Controlled discards real controlled minions without defeat threat and places separate support counters", () => {
    let s = base();
    s.environments!.push(makePiece(s, "50032"));
    const a = top(s, "50011"),
      b = top(s, "50010"),
      staff = put(s, "50008");
    s = finish(native(s, { type: "maria:controller" }));
    s = finish(native(s, { type: "maria:controller" }));
    const scheme = side(s, "50031", 1),
      before = s.scheme.threat;
    s = native(s, { type: "thwart", target: scheme.id, amount: 1 });
    s = choose(s, staff.id);
    s = finish(choose(s, staff.id));
    expect(s.scheme.threat).toBe(before);
    expect(s.minions.filter((p) => p.mariaControlled)).toHaveLength(0);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([a.id, b.id]),
    );
    expect(s.player.inPlay.find((p) => p.id === staff.id)?.counters).toBe(2);
  });
  it("Diabolical Discs removes an actual support counter, creates a real owned minion and resolves Surge", () => {
    let s = base();
    s.environments!.push(makePiece(s, "50032"));
    const staff = put(s, "50008");
    staff.counters = 2;
    s.encounter.deck[0] = makePiece(s, "01102");
    const original = top(s, "50011"),
      encounter = s.encounter.deck[0].id;
    s = reveal(s, "50033");
    s = choose(s, "text");
    s = finish(choose(s, staff.id));
    expect(s.player.inPlay.find((p) => p.id === staff.id)?.counters).toBe(1);
    expect(s.minions.some((p) => p.id === original.id)).toBe(true);
    expect(
      [...s.attachments, ...s.encounter.discard, ...s.encounter.dealt].some(
        (p) => p.id === encounter,
      ),
    ).toBe(true);
  });
  it("Grant Ward can pay the actual Mental requirement after revealing a treachery", () => {
    let s = base();
    const ward = put(s, "50022"),
      [mental] = hand(s, "50026");
    s = reveal(s, "01186");
    s = choose(s, "pay");
    s = finish(pay(s, [mental]));
    expect(s.player.inPlay.some((p) => p.id === ward.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === mental.id)).toBe(true);
  });
  it("Agents of SHIELD can be controlled by another player but requires that controller's whole team to share SHIELD", () => {
    let s = base(false, true);
    const [team, energy, genius] = hand(s, "50015", "50025", "50026");
    s = play(s, team, [energy, genius]);
    s = finish(choose(s, "p2"));
    s = reveal(s, "01186");
    expect(
      s.prompt?.options.some((o) =>
        o.label.includes("Agents of S.H.I.E.L.D."),
      ) ?? false,
    ).toBe(false);
    s = finish(s);
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === team.id)).toBe(
      true,
    );
  });
  it("Agents of SHIELD cancels the actual encounter and reveals the next physical card", () => {
    let s = base();
    const team = put(s, "50015"),
      next = s.encounter.deck[0].id,
      before = s.scheme.threat;
    s = reveal(s, "01186");
    s = respond(s, /Agents of S.H.I.E.L.D/);
    s = finish(s);
    expect(s.scheme.threat).toBe(before);
    expect(s.player.inPlay.find((p) => p.id === team.id)?.exhausted).toBe(true);
    expect(
      [...s.attachments, ...s.encounter.discard].some((p) => p.id === next),
    ).toBe(true);
  });
});
