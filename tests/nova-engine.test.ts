/** Native Nova acceptance: original source pieces, real dispatch and JSON reload
 * before commands. No pure resolver or synthetic identity/stat fallback. */
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
  pay,
  physical,
  play,
  put,
  reload,
  respond,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & {
  dvSourceIds?: Record<string, string[]>;
  novaEncounters?: Piece[];
};
function starting(novaSeat = "p1", team = false, villainId = "rhino") {
  const nova = { heroId: "nova", aspect: "aggression" as const },
    other = { heroId: "spider_man", aspect: "justice" as const };
  return newGame({
    ...nova,
    villainId,
    seed: 28001,
    pacing: "expert",
    ...(team
      ? { heroes: novaSeat === "p1" ? [nova, other] : [other, nova] }
      : {}),
  });
}
function base(novaSeat = "p1", team = false, villainId = "rhino") {
  let s = starting(novaSeat, team, villainId);
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  const obligation = s.encounter.deck.find((p) => p.code === "28021");
  expect(obligation, "original Weight of the World instance").toBeTruthy();
  const encounters = [
    ...(seatView(s, novaSeat).player.setAside || []),
    obligation!,
  ];
  expect(encounters).toHaveLength(6);
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
    view.player.exhausted =
      view.player.flipped =
      view.player.stunned =
      view.player.confused =
      view.player.tough =
        false;
  }
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [
    ...Array.from({ length: 20 }, () => makePiece(s, "01104")),
    obligation!,
  ];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  (s as Fixture).novaEncounters = encounters;
  activateSeat(s, novaSeat);
  s.turnPlayerId = novaSeat;
  return s;
}
function done(s: GameState, prefer?: (s: GameState) => string | undefined) {
  s = finish(s, prefer);
  encounterConserved(s, (s as Fixture).novaEncounters || []);
  return s;
}
function encounter(s: GameState, code: string) {
  for (const seat of s.players) {
    const zone = seatView(s, seat).player.setAside || [],
      i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  for (const zone of [
    s.encounter.deck,
    s.encounter.dealt,
    s.encounter.discard,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing actual encounter ${code}`);
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
function response(s: GameState, code: string) {
  return respond(
    s,
    new RegExp(card(code).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    code,
  );
}
function actual(s: GameState, code: string) {
  const p = physical(s).find((p) => p.code === code);
  expect(p, code).toBeDefined();
  return p!;
}
function unleash(s: GameState) {
  const [event, resource] = hand(s, "28006", "28007");
  return done(play(s, event, [resource]));
}

describe("Nova native original retail source and setup", () => {
  it("creates source40 with15Hero20Aggression5Basic, actual printed forms and exactly five reserved nemeses", () => {
    const s = starting(),
      starter = STARTER_DECKS.find((d) => d.id === "starter-28001a")!;
    expect(deckCodes("nova", "aggression").sort()).toEqual(
      catalogDeckCodes(starter).sort(),
    );
    expect(physical(s)).toHaveLength(40);
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual(catalogDeckCodes(starter).sort());
    expect(
      physical(s).filter((p) => card(p).faction_code === "hero"),
    ).toHaveLength(15);
    expect(
      physical(s).filter((p) => card(p).faction_code === "aggression"),
    ).toHaveLength(20);
    expect(
      physical(s).filter((p) => card(p).faction_code === "basic"),
    ).toHaveLength(5);
    expect(heroCard(s)).toMatchObject({
      code: "28001b",
      name: "Sam Alexander",
      traits: "Civilian.",
      recover: 3,
    });
    expect(heroStats(s)).toMatchObject({
      attack: 1,
      thwart: 1,
      defense: 2,
      recover: 3,
    });
    expect(s.player.hp).toBe(10);
    expect(handSize(s)).toBe(6);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "28022",
      "28023",
      "28024",
      "28024",
      "28025",
    ]);
    expect(new Set(s.player.setAside?.map((p) => p.id)).size).toBe(5);
    expect(s.encounter.deck.filter((p) => p.code === "28021")).toHaveLength(1);
  });
  it("mulligan has no setup-created Helmet and retains original physical source through hydrate", () => {
    let s = starting(),
      originals = physical(s);
    s = done(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.player.inPlay).toEqual([]);
    expect(s.player.hand).toHaveLength(6);
    const retainedWorldminds = originals.filter(
      (p) => p.code === "28007" && s.player.hand.some((q) => q.id === p.id),
    );
    expect(handSize(s)).toBe(6 + retainedWorldminds.length);
    conserved(s, originals);
    s = command(reload(s), { type: "SET_PACING", pacing: "expert" });
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    conserved(s, originals);
  });
  it("actual Shadows reveals same Warbringer/BringWar and shuffles same remaining physical IDs", () => {
    let s = base(),
      reserve = [...s.player.setAside!],
      originals = physical(s);
    s = done(reveal(s, makePiece(s, "01190")));
    expect(s.minions.find((p) => p.code === "28023")?.id).toBe(
      reserve.find((p) => p.code === "28023")!.id,
    );
    expect(s.sideSchemes.find((p) => p.code === "28022")).toMatchObject({
      id: reserve.find((p) => p.code === "28022")!.id,
      counters: 2,
    });
    expect(
      s.encounter.deck
        .filter((p) => ["28024", "28025"].includes(p.code))
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      reserve
        .filter((p) => ["28024", "28025"].includes(p.code))
        .map((p) => p.id)
        .sort(),
    );
    expect(s.player.setAside).toEqual([]);
    conserved(s, originals);
    encounterConserved(s, reserve);
    expect(new Set(encounterPhysical(s).map((p) => p.id)).size).toBe(
      encounterPhysical(s).length,
    );
  });
  it("JSON migration never recreates already consumed actual nemesis reserve", () => {
    let s = base("p2", true);
    s = done(reveal(s, makePiece(s, "01190")));
    const nextId = s.nextId;
    activateSeat(s, "p1");
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    expect(seatView(s, "p2").player.setAside).toEqual([]);
    expect(s.nextId).toBe(nextId);
  });
});

describe("Nova actual generated Wild scope and conditional Sam payment", () => {
  it("unexhausted Helmet offers exactly one Wild for ordinary cards and grants Aerial only in hero", () => {
    const s = base(),
      helmet = put(s, "28009");
    expect(aerial(s)).toBe(true);
    expect(
      paymentSources(s, undefined, "28006").find((p) => p.id === helmet.id)
        ?.resources,
    ).toEqual(["wild"]);
    expect(
      paymentSources(s, undefined, "28003").find((p) => p.id === helmet.id)
        ?.resources,
    ).toEqual(["wild"]);
    s.player.form = "alter";
    expect(aerial(s)).toBe(false);
    expect(paymentSources(s).some((p) => p.id === helmet.id)).toBe(false);
  });
  it.each(["28004", "28005"])(
    "paying printed %s doubles Wild from actual Helmet and every hand source exactly once",
    (code) => {
      const s = base(),
        helmet = put(s, "28009"),
        [event, connection, everyday, power] = hand(
          s,
          code,
          "28007",
          "28019",
          "28015",
        );
      const sources = paymentSources(s, event.id, code);
      for (const p of [helmet, connection, everyday, power])
        expect(
          sources.find((source) => source.id === p.id)?.resources,
          p.code,
        ).toEqual(["wild", "wild"]);
      expect(
        paymentSources(s, event.id, "28006").find(
          (source) => source.id === connection.id,
        )?.resources,
      ).toEqual(["wild"]);
    },
  );
  it.each(["28004", "28005"])(
    "native actual %s is fully paid with just one Helmet activation",
    (code) => {
      let s = base(),
        helmet = put(s, "28009"),
        original = physical(s),
        [event] = hand(s, code);
      expect(playable(s, event)).toBeNull();
      s = command(s, { type: "PLAY", id: event.id });
      expect(s.prompt?.cost).toBe(2);
      s = pay(s, [], "wild", [helmet.id]);
      s = done(target(s, code === "28005" ? s.villain.id : "main"));
      expect(actual(s, "28009").exhausted).toBe(true);
      expect(code === "28005" ? s.villain.hp : s.scheme.threat).toBe(
        code === "28005" ? 46 : 3,
      );
      expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
      conserved(s, original);
    },
  );
  it.each([false, true])(
    "Sam spends actual allocated Wild=%s to find exact Helmet and preserve source IDs",
    (wild) => {
      let s = base(),
        originals = physical(s);
      s.player.form = "alter";
      const [resource] = hand(s, wild ? "28007" : "28005"),
        helmet = actual(s, "28009");
      expect(
        nativeHeroAbilityOptions(s, "identity").some(
          (o) => o.id === "sam-search",
        ),
      ).toBe(true);
      s = command(s, { type: "ABILITY", id: "identity", action: "sam-search" });
      expect(s.prompt?.kind).toBe("payment");
      s = pay(s, [resource], wild ? "wild" : "energy");
      s = done(target(s, helmet.id));
      expect(
        s.player[wild ? "inPlay" : "hand"].some((p) => p.id === helmet.id),
      ).toBe(true);
      expect(s.player.flipped).toBe(false);
      expect(s.player.exhausted).toBe(false);
      conserved(s, originals);
    },
  );
  it("Sam payment allocation can overpay Wild without using it for the cost, then finds Helmet into hand", () => {
    let s = base();
    s.player.form = "alter";
    const [energy, wild] = hand(s, "28005", "28007"),
      helmet = actual(s, "28009");
    s = command(s, { type: "ABILITY", id: "identity", action: "sam-search" });
    s = pay(s, [energy, wild], "energy");
    s = done(target(s, helmet.id));
    expect(s.player.hand.some((p) => p.id === helmet.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === helmet.id)).toBe(false);
  });
});

describe("Nova performed basic powers and absolute ready prohibition", () => {
  it.each(["attack", "thwart"] as const)(
    "completed native basic %s opens real Helmet-ready response once",
    (action) => {
      let s = base(),
        helmet = put(s, "28009");
      helmet.exhausted = true;
      s = basic(s, action);
      expect(actual(s, "28009").exhausted).toBe(true);
      s = respond(s, /ready Supernova Helmet/, "28001a");
      s = done(s);
      expect(actual(s, "28009").exhausted).toBe(false);
      expect(s.player.exhausted).toBe(true);
    },
  );
  it("completed native basic defense readies Helmet only after the actual attack has dealt damage", () => {
    let s = base(),
      helmet = put(s, "28009");
    helmet.exhausted = true;
    attach(s, "01099", s.villain.id);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero"));
    s = choose(s, "hero");
    s = until(
      s,
      (v) =>
        !!v.prompt?.options.some((o) => /ready Supernova Helmet/.test(o.label)),
    );
    expect(s.player.hp).toBeLessThan(10);
    expect(actual(s, "28009").exhausted).toBe(true);
    s = done(respond(s, /ready Supernova Helmet/, "28001a"));
    expect(actual(s, "28009").exhausted).toBe(false);
  });
  it.each(["attack", "thwart"] as const)(
    "native basic %s replaced by status never readies Helmet",
    (action) => {
      let s = base(),
        helmet = put(s, "28009");
      helmet.exhausted = true;
      s.player[action === "attack" ? "stunned" : "confused"] = true;
      s = done(basic(s, action));
      expect(actual(s, "28009").exhausted).toBe(true);
      expect(s.player[action === "attack" ? "stunned" : "confused"]).toBe(
        false,
      );
    },
  );
  it("native REC does not expose a Helmet ready response", () => {
    let s = base(),
      helmet = put(s, "28009");
    helmet.exhausted = true;
    s.player.form = "alter";
    s.player.hp = 6;
    s = done(command(s, { type: "BASIC", action: "recover" }));
    expect(s.player.hp).toBe(9);
    expect(actual(s, "28009").exhausted).toBe(true);
  });
  it("actual Weight blocks generic ready and Nova response, then native AE cost removes same obligation", () => {
    let s = base(),
      helmet = put(s, "28009"),
      obligation = encounter(s, "28021");
    helmet.exhausted = true;
    s = done(reveal(s, obligation));
    expect(s.player.inPlay.some((p) => p.id === obligation.id)).toBe(true);
    expect(s.player.form).toBe("hero");
    s = done(native(s, { type: "ready", id: helmet.id }));
    expect(actual(s, "28009").exhausted).toBe(true);
    s = done(basic(s, "attack"));
    expect(actual(s, "28009").exhausted).toBe(true);
    s.player.exhausted = false;
    s = done(command(s, { type: "FLIP" }));
    s = done(
      command(s, { type: "ABILITY", id: obligation.id, action: "remove" }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((p) => p.id === obligation.id)).toBe(true);
    s = done(native(s, { type: "ready", id: helmet.id }));
    expect(actual(s, "28009").exhausted).toBe(false);
  });
  it("Weight prevents actual player phase ready/refill but leaves unrelated teammate upgrade unaffected", () => {
    let s = base("p1", true),
      helmet = put(s, "28009"),
      obligation = encounter(s, "28021"),
      teammate = put(s, "01065", "p2");
    helmet.exhausted = teammate.exhausted = true;
    s = done(reveal(s, obligation));
    s = done(native(s, { type: "allReady" }));
    expect(actual(seatView(s, "p1"), "28009").exhausted).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === teammate.id)
        ?.exhausted,
    ).toBe(false);
  });
  it("actual Helmet transferred to teammate stays locked by Sam's still-active Weight", () => {
    let s = base("p1", true),
      helmet = put(s, "28009"),
      obligation = encounter(s, "28021");
    helmet.exhausted = true;
    s = done(reveal(s, obligation));
    const actualHelmet = s.player.inPlay.splice(
      s.player.inPlay.findIndex((p) => p.id === helmet.id),
      1,
    )[0];
    seatView(s, "p2").player.inPlay.push(actualHelmet);
    activateSeat(s, "p2");
    s = done(native(s, { type: "ready", id: helmet.id }));
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === helmet.id)
        ?.exhausted,
    ).toBe(true);
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === obligation.id),
    ).toBe(true);
  });
});

describe("Connection dynamic refill and Jesse native source", () => {
  it("a last refill Connection immediately prompts the next real draw, preserving both actual source copies", () => {
    let s = base();
    const originals = physical(s);
    hand(s, "28002", "28003", "28004", "28005");
    const connection = top(s, "28007");
    s = done(native(s, { type: "refill" }));
    expect(s.player.hand.some((p) => p.id === connection.id)).toBe(true);
    expect(s.player.hand).toHaveLength(6);
    expect(handSize(s)).toBe(6);
    conserved(s, originals);
  });
  it("Jesse native ability exhausts actual card, shuffles actual discard Worldmind then draws it", () => {
    let s = base(),
      jesse = put(s, "28008"),
      [connection] = hand(s, "28007");
    s.player.discard.push(s.player.hand.splice(0)[0]);
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: jesse.id, action: "jesse" });
    expect(s.player.inPlay.find((p) => p.id === jesse.id)?.exhausted).toBe(
      true,
    );
    s = done(target(s, connection.id));
    expect(
      s.player.deck.concat(s.player.hand).some((p) => p.id === connection.id),
    ).toBe(true);
    expect(s.player.hand).toHaveLength(1);
  });
});

describe("native Unleash actual PLAY and defeat/threat attribution", () => {
  it("actual Unleash gives no stat bonus and readies/draws once after native Pot Shot defeats enemy", () => {
    let s = unleash(base());
    expect(heroStats(s)).toMatchObject({ attack: 1, thwart: 1 });
    const m = minion(s),
      helmet = put(s, "28009"),
      [pot] = hand(s, "28005");
    s.player.exhausted = true;
    s = command(s, { type: "PLAY", id: pot.id });
    s = pay(s, [], "wild", [helmet.id]);
    s = done(target(s, m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand).toHaveLength(1);
    expect(heroStats(s)).toMatchObject({ attack: 1, thwart: 1 });
  });
  it("native Lightspeed removing last main threat draws/readies once, positive removal without last threat does not", () => {
    let s = unleash(base()),
      helmet = put(s, "28009"),
      [flight] = hand(s, "28004");
    s.scheme.threat = 3;
    s.player.exhausted = true;
    s = command(s, { type: "PLAY", id: flight.id });
    s = pay(s, [], "wild", [helmet.id]);
    s = done(target(s, "main"));
    expect(s.scheme.threat).toBe(0);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand).toHaveLength(1);
    s.player.exhausted = true;
    s.scheme.threat = 6;
    s = done(
      native(s, { type: "thwart", target: "main", amount: 2, source: "hero" }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toHaveLength(1);
  });
  it("native ally basic defeat never creates a Nova Unleash reward", () => {
    let s = unleash(base()),
      ally = put(s, "28002"),
      m = minion(s, "01103", s.activePlayerId, 2);
    s.player.exhausted = true;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = done(target(s, m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toEqual([]);
  });
  it("native multiple actual identity damage defeats each award one draw, not one per shared effect batch", () => {
    let s = unleash(base()),
      first = minion(s, "01103", "p1", 2),
      second = minion(s, "01103", "p1", 2);
    s.player.exhausted = true;
    s = done(
      native(
        s,
        {
          type: "damage",
          target: first.id,
          amount: 1,
          source: "hero",
          attack: false,
        },
        {
          type: "damage",
          target: second.id,
          amount: 1,
          source: "hero",
          attack: false,
        },
      ),
    );
    expect(s.player.hand).toHaveLength(2);
    expect(s.player.exhausted).toBe(false);
  });
  it("committed Unleash forbids second actual copy, canceled unpaid PLAY consumes no maximum", () => {
    let s = base(),
      [event, fuel] = hand(s, "28006", "28007");
    s = command(s, { type: "PLAY", id: event.id });
    s = command(s, { type: "CANCEL" });
    expect(playable(s, event)).toBeNull();
    s = done(play(s, event, [fuel]));
    const [copy, resource] = hand(s, "28006", "28007");
    expect(resource).toBeDefined();
    expect(playable(s, copy)).toBeTruthy();
    const next = dispatch(reload(s), { type: "PLAY", id: copy.id });
    expect(next.error).toContain("max 1");
  });
});

describe("native Ms. Marvel actual played-event response", () => {
  it("pays last ally HP and returns the same actual played event after native leave-play cleanup", () => {
    let s = base(),
      ally = put(s, "28002"),
      [event, fuel] = hand(s, "28005", "28007"),
      originals = physical(s);
    ally.damage = 2;
    s = play(s, event, [fuel], "wild");
    s = target(s, s.villain.id);
    s = respond(s, /Ms\. Marvel/, "28002");
    s = done(s);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.villain.hp).toBe(46);
    conserved(s, originals);
  });
  it("Tough cannot pay the full ally damage cost and leaves that played event in the actual discard pile", () => {
    let s = base(),
      ally = put(s, "28002"),
      [event, fuel] = hand(s, "28005", "28007");
    ally.tough = true;
    s = done(target(play(s, event, [fuel], "wild"), s.villain.id));
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 0,
      exhausted: false,
      tough: true,
    });
  });
  it("a committed event with Stun replacing its ability still played and may be returned by Ms. Marvel", () => {
    let s = base(),
      ally = put(s, "28002"),
      [event, fuel] = hand(s, "28005", "28007");
    s.player.stunned = true;
    s = play(s, event, [fuel], "wild");
    s = respond(s, /Ms\. Marvel/, "28002");
    s = done(s);
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
      exhausted: true,
    });
  });
});

describe("native Forcefield friendly actual attack window", () => {
  it("actual attack damage interruption prevents three and allocated Wild deals independent nonattack damage", () => {
    let s = base(),
      [forcefield, wild] = hand(s, "28003", "28007");
    attach(s, "01099", s.villain.id);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    s = choose(s, "take");
    s = response(s, "28003");
    s = pay(s, [wild], "wild");
    s = target(s, s.villain.id);
    s = done(s);
    expect(s.villain.hp).toBe(47);
    expect(s.player.hp).toBe(8);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === forcefield.id)).toBe(true);
  });
  it("friendly ally defender remains actual defender; Forcefield is not a defense and ally receives remaining damage", () => {
    let s = base(),
      ally = put(s, "28002"),
      [forcefield, energy] = hand(s, "28003", "28005");
    attach(s, "01099", s.villain.id);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === ally.id));
    s = choose(s, ally.id);
    s = until(
      s,
      (v) =>
        !!v.prompt?.options.some((o) =>
          o.effects.some(
            (e) =>
              e.type === "nova:play-forcefield" &&
              e.context?.targetId === ally.id,
          ),
        ),
    );
    const option = s.prompt!.options.find((o) =>
      o.effects.some(
        (e) =>
          e.type === "nova:play-forcefield" && e.context?.targetId === ally.id,
      ),
    )!;
    s = choose(s, option.id);
    s = pay(s, [energy], "energy");
    s = done(s);
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(2);
    expect(s.player.discard.some((p) => p.id === forcefield.id)).toBe(true);
    expect(s.villain.hp).toBe(50);
  });
  it("overpaid Wild never adds Forcefield damage when the actual allocated cost is Energy", () => {
    let s = base(),
      [forcefield, energy, wild] = hand(s, "28003", "28005", "28007");
    attach(s, "01099", s.villain.id);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    s = choose(s, "take");
    s = response(s, "28003");
    s = pay(s, [energy, wild], "energy");
    s = done(s);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hp).toBe(8);
    expect(
      s.player.discard.filter((p) =>
        [forcefield.id, energy.id, wild.id].includes(p.id),
      ),
    ).toHaveLength(3);
  });
  it("Warbringer snapshots two printed-Wild cards before Forcefield payment and keeps ATK5 after one is spent", () => {
    let s = base(),
      [forcefield, first, second] = hand(s, "28003", "28007", "28007"),
      warbringer = encounter(s, "28023");
    warbringer.engagedWith = s.activePlayerId;
    s.minions.push(warbringer);
    s = native(s, { type: "enemyAttack", id: warbringer.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.attack?.base).toBe(5);
    s = choose(s, "take");
    s = response(s, "28003");
    s = pay(s, [first], "wild");
    s = done(target(s, s.villain.id));
    expect(s.player.hp).toBe(8);
    expect(s.player.hand.some((p) => p.id === second.id)).toBe(true);
    expect(s.villain.hp).toBe(47);
    expect(s.player.discard.some((p) => p.id === forcefield.id)).toBe(true);
  });

  it("manual Forcefield PLAY has no actual damage window and cannot spend sources", () => {
    const s = base(),
      [forcefield, wild] = hand(s, "28003", "28007");
    expect(playable(s, forcefield)).toContain("actual friendly");
    const failed = dispatch(reload(s), { type: "PLAY", id: forcefield.id });
    expect(failed.error).toBeTruthy();
    expect(failed.player.hand.map((p) => p.id)).toEqual([
      forcefield.id,
      wild.id,
    ]);
  });
});
