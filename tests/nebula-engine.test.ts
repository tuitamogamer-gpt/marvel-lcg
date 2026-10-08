/** Original Nebula Justice source, native commands, physical IDs and JSON reload. */
import { describe, expect, it } from "vitest";
import {
  card,
  deckCodes,
  handSize,
  heroCard,
  heroStats,
} from "../src/game/cards.js";
import { STARTER_DECKS, catalogDeckCodes } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
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
function starting(other?: "gam" | "drax" | "spider_man", nebulaSeat = "p1") {
  const nebula = { heroId: "nebu", aspect: "justice" as const };
  const teammate = other
    ? {
        heroId: other,
        aspect:
          other === "gam"
            ? ("aggression" as const)
            : other === "drax"
              ? ("protection" as const)
              : ("justice" as const),
      }
    : undefined;
  return newGame({
    ...nebula,
    villainId: "rhino",
    pacing: "expert",
    seed: 22001,
    ...(teammate
      ? {
          heroes: nebulaSeat === "p1" ? [nebula, teammate] : [teammate, nebula],
        }
      : {}),
  });
}
function base(other?: "gam" | "drax" | "spider_man", nebulaSeat = "p1") {
  let s = starting(other, nebulaSeat);
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const view = seatView(s, seat);
    const source = physical(s, seat.id);
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
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01174"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  activateSeat(s, nebulaSeat);
  s.turnPlayerId = nebulaSeat;
  return s;
}
function natural(s: GameState) {
  return finish(s, (v) => {
    const title = v.prompt?.title || "";
    if (
      ["Combat Protocols", "Wide Stance", "Evasive Maneuvering"].includes(title)
    )
      return v.prompt!.options[0]?.id;
    if (title === "Cutthroat Ambition") return "main";
    if (title === "Weapons Master") return v.villain.id;
    return undefined;
  });
}
function reveal(s: GameState, p: Piece) {
  return native(s, { type: "reveal", piece: p });
}
function originalEncounter(s: GameState, code: string) {
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
function nemesis(s: GameState) {
  s = finish(reveal(s, makePiece(s, "01190")));
  const cards = encounterPhysical(s).filter((p) =>
    ["22028", "22029", "22030", "22031"].includes(p.code),
  );
  expect(cards).toHaveLength(5);
  expect(new Set(cards.map((p) => p.id)).size).toBe(5);
  return { s, cards };
}
function removeNemesisCharacters(s: GameState) {
  return finish(
    native(
      s,
      ...[...s.minions, ...s.sideSchemes]
        .filter((p) => ["22028", "22029"].includes(p.code))
        .map((p) => ({ type: "discardPiece", id: p.id })),
    ),
  );
}

describe("Nebula's original retail source and physical identities", () => {
  it("creates the exact original Justice40, actual printed identities and one obligation", () => {
    const s = starting();
    const source = STARTER_DECKS.find((d) => d.id === "starter-22001a")!;
    expect(deckCodes("nebu", "justice").sort()).toEqual(
      catalogDeckCodes(source).sort(),
    );
    expect(deckErrors("nebu", "justice", deckCodes("nebu", "justice"))).toEqual(
      [],
    );
    expect(physical(s)).toHaveLength(40);
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual(catalogDeckCodes(source).sort());
    expect(s.player.hp).toBe(9);
    expect(heroCard(s).code).toBe("22001b");
    expect(handSize(s)).toBe(6);
    expect(s.encounter.deck.filter((p) => p.code === "22027")).toHaveLength(1);
  });
  it("preserves all40 source IDs through an actual mulligan and hero flip", () => {
    let s = starting();
    const source = physical(s);
    s = finish(
      command(s, {
        type: "MULLIGAN",
        ids: s.player.hand.slice(0, 3).map((p) => p.id),
      }),
    );
    s = command(s, { type: "FLIP" });
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      recover: 3,
    });
    expect(handSize(s)).toBe(5);
    conserved(s, source);
  });
  it("creates five unique physical nemesis cards from actual Shadows without losing source40", () => {
    const { s, cards } = nemesis(base());
    expect(cards.map((p) => p.code).sort()).toEqual([
      "22028",
      "22029",
      "22030",
      "22031",
      "22031",
    ]);
    encounterConserved(reload(s), cards);
    expect(physical(s)).toHaveLength(40);
  });
});

describe("Nebula's actual turn and PLAY responses", () => {
  it("retains continuous Technique sources until the last mandatory Special resolves", () => {
    let s = base();
    const cut = put(s, "22004"),
      weapon = put(s, "22007");
    s.villain.tough = true;
    s = native(s, { type: "beginTurn", actorId: "p1" });
    expect(s.prompt?.title).toBe("Combat Protocols");
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      [cut.id, weapon.id].sort(),
    );
    expect(s.prompt?.options.some((o) => /pass|skip|continue/.test(o.id))).toBe(
      false,
    );
    s = choose(s, cut.id);
    s = choose(s, "main");
    expect(s.scheme.threat).toBe(3);
    expect(s.player.inPlay.map((p) => p.id)).toContain(cut.id);
    s = choose(s, weapon.id);
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    expect(s.villain.tough).toBe(false);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([cut.id, weapon.id]),
    );
    conserved(s, [cut, weapon]);
  });
  it("consumes Stun on one Weapons Master and resolves its other physical copy", () => {
    let s = base();
    const first = put(s, "22007"),
      second = put(s, "22007");
    s.player.stunned = true;
    s = native(s, { type: "beginTurn", actorId: "p1" });
    s = choose(s, first.id);
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.map((p) => p.id)).toContain(first.id);
    s = choose(s, second.id);
    s = finish(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    conserved(s, [first, second]);
    expect(
      s.player.inPlay.some((p) => [first.id, second.id].includes(p.id)),
    ).toBe(false);
  });
  it("retains an unavailable Tough Special rather than discarding that physical upgrade", () => {
    let s = base();
    const persistence = put(s, "22006");
    s.player.tough = true;
    s = finish(native(s, { type: "beginTurn", actorId: "p1" }));
    expect(s.player.inPlay.some((p) => p.id === persistence.id)).toBe(true);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3 });
  });
  it("fires only on Nebula's own real p2 turn, not a requested teammate action", () => {
    let s = base("spider_man", "p2");
    const cut = put(s, "22004");
    activateSeat(s, "p1");
    s = finish(native(s, { type: "beginTurn", actorId: "p1" }));
    expect(s.scheme.threat).toBe(6);
    expect(seatView(s, "p2").player.inPlay.map((p) => p.id)).toContain(cut.id);
    s = command(s, { type: "END_TURN" });
    expect(s.prompt?.title).toBe("Combat Protocols");
    expect(s.activePlayerId).toBe("p2");
    s = finish(choose(choose(s, cut.id), "main"));
    expect(s.scheme.threat).toBe(3);
  });
  it("resolves first-player Protocols on the actual newRound transition", () => {
    let s = base();
    const cut = put(s, "22004");
    s.phase = "villain";
    s = native(s, { type: "newRound" });
    expect(s.round).toBe(2);
    expect(s.prompt?.title).toBe("Combat Protocols");
    s = finish(choose(choose(s, cut.id), "main"));
    expect(s.scheme.threat).toBe(3);
  });
  it("draws2 after actual AE Technique PLAY once per round, and can decline before using the limit", () => {
    let s = base();
    s.player.form = "alter";
    let [first, resource] = hand(s, "22004", "22024");
    s = play(s, first, [resource]);
    expect(s.prompt?.title).toBe("Cybernetic Upgrades");
    s = finish(choose(s, "skip"));
    expect(s.flags.nebulaCyberneticRound).toBeUndefined();
    const [second, secondResource] = hand(s, "22007", "22025");
    const drawn = s.player.deck.slice(0, 2);
    s = play(s, second, [secondResource]);
    s = finish(choose(s, "yes"));
    expect(s.player.hand.map((p) => p.id)).toEqual(drawn.map((p) => p.id));
    expect(s.flags.nebulaCyberneticRound).toBe(s.round);
    const [third, thirdResource] = hand(s, "22008", "22026");
    s = finish(play(s, third, [thirdResource]));
    expect(s.player.hand).toHaveLength(0);
    conserved(s, [first, second, third, ...drawn]);
  });
  it("lets actual PLAY Gamora resolve a controlled Special without discarding its source", () => {
    let s = base();
    const cut = put(s, "22004");
    const [ally, genius, energy] = hand(s, "22002", "22025", "22024");
    s = play(s, ally, [genius, energy]);
    s = respond(s, /^Gamora$/);
    s = choose(s, cut.id);
    s = finish(choose(s, "main"));
    expect(s.scheme.threat).toBe(3);
    expect(s.player.inPlay.map((p) => p.id)).toEqual(
      expect.arrayContaining([ally.id, cut.id]),
    );
  });
});

describe("Combat Ready and actual paid X", () => {
  it("finds the original last Technique after immediate deck reset, with no AE PLAY response", () => {
    let s = base();
    s.player.form = "alter";
    const [event] = hand(s, "22009"),
      technique = top(s, "22007");
    s.player.discard.push(
      ...s.player.deck.filter((p) => p.id !== technique.id),
    );
    s.player.deck = [technique];
    const beforeDealt = s.encounter.dealt.length;
    s = play(s, event);
    s = choose(s, "find");
    expect(s.prompt?.title).toBe("Weapons Master");
    expect(s.flags.nebulaCyberneticRound).toBeUndefined();
    s = finish(choose(s, s.villain.id));
    expect(s.player.inPlay.map((p) => p.id)).toContain(technique.id);
    expect(s.encounter.dealt).toHaveLength(beforeDealt + 1);
    expect(s.villain.hp).toBe(46);
    conserved(s, [event, technique]);
  });
  it("recovery chooses zero without shuffling the existing physical deck", () => {
    let s = base();
    s.player.form = "alter";
    const p = put(s, "22004");
    s = finish(native(s, { type: "discardPiece", id: p.id }));
    const [event] = hand(s, "22009");
    const deck = s.player.deck.map((p) => p.id);
    s = play(s, event);
    s = choose(s, "recover");
    expect(s.prompt?.kind).toBe("select");
    s = finish(command(s, { type: "SELECT", ids: [] }));
    expect(s.player.deck.map((p) => p.id)).toEqual(deck);
    expect(s.player.discard.map((p) => p.id)).toContain(p.id);
  });
  it("selects up to actual paidX and resolves distinct physical sources in chosen order", () => {
    let s = base();
    const cut = put(s, "22004"),
      weapon = put(s, "22007"),
      persistence = put(s, "22006");
    const [event, resource] = hand(s, "22010", "22025");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.title).toBe("Lethal Intent");
    s = choose(s, "2");
    s = pay(s, [resource]);
    expect(s.prompt?.kind).toBe("select");
    expect(s.prompt?.max).toBe(2);
    s = command(s, { type: "SELECT", ids: [weapon.id, cut.id] });
    s = choose(s, cut.id);
    s = choose(s, "main");
    s = choose(s, weapon.id);
    s = finish(choose(s, s.villain.id));
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.hp).toBe(46);
    expect(s.player.inPlay.map((p) => p.id)).toEqual(
      expect.arrayContaining([cut.id, weapon.id, persistence.id]),
    );
    conserved(s, [event, resource, cut, weapon, persistence]);
  });
  it("cancels Lethal Intent payment without spending a resource or resolving a Special", () => {
    let s = base();
    const weapon = put(s, "22007"),
      [event, resource] = hand(s, "22010", "22025");
    s = choose(command(s, { type: "PLAY", id: event.id }), "1");
    s = command(s, { type: "CANCEL" });
    expect(s.villain.hp).toBe(50);
    expect(s.player.hand.map((p) => p.id)).toEqual([event.id, resource.id]);
    expect(s.player.inPlay.map((p) => p.id)).toContain(weapon.id);
  });
});

describe("Nebula's Ship native current-controller payment", () => {
  it.each(["hero", "alter"] as const)(
    "spends the actual Ship in %s form and rejects an exhausted source",
    (form) => {
      let s = base();
      s.player.form = form;
      const ship = put(s, "22003"),
        [technique] = hand(s, "22004");
      expect(
        paymentSources(s, technique.id, technique.code).filter(
          (p) => p.id === ship.id,
        ),
      ).toHaveLength(1);
      s = command(s, { type: "PLAY", id: technique.id });
      s = pay(s, [], "mental", [ship.id]);
      s = finish(s);
      expect(s.player.inPlay.find((p) => p.id === ship.id)?.exhausted).toBe(
        true,
      );
      expect(paymentSources(s).some((p) => p.id === ship.id)).toBe(false);
      conserved(s, [ship, technique]);
    },
  );
  it("uses transferred Ship control while preserving its original p1 ownership", () => {
    let s = base("spider_man");
    const ship = put(s, "22003");
    s.player.inPlay = s.player.inPlay.filter((p) => p.id !== ship.id);
    seatView(s, "p2").player.inPlay.push(ship);
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    const [event] = hand(s, "01085");
    expect(paymentSources(s).find((p) => p.id === ship.id)?.resources).toEqual([
      "wild",
    ]);
    // A regular positive-cost upgrade uses that controller's exact resource.
    const upgrade = owned(s, "01065", "p2");
    s.player.hand.push(upgrade);
    s = command(s, { type: "PLAY", id: upgrade.id });
    s = pay(s, [event], "mental", [ship.id]);
    s = finish(s, (v) =>
      v.prompt?.title === "Heroic Intuition" ? "p2" : undefined,
    );
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ship.id),
    ).toMatchObject({ exhausted: true, ownerId: "p1" });
    conserved(s, [ship], "p1");
    conserved(s, [event], "p2");
  });
});

describe("Inferiority Complex and actual Gamora nemesis attacks", () => {
  it("routes the obligation to Nebula p2, optionally flips without consuming the ordinary flip, and removes itself", () => {
    let s = starting("spider_man", "p2");
    const obligation = originalEncounter(s, "22027");
    for (const _seat of s.players)
      s = command(s, { type: "MULLIGAN", ids: [] });
    s = finish(s);
    seatView(s, "p2").player.form = "hero";
    activateSeat(s, "p1");
    s = reveal(s, obligation);
    s = until(s, (v) => v.prompt?.title === "Inferiority Complex");
    expect(s.activePlayerId).toBe("p2");
    s = choose(s, "flip");
    s = finish(choose(s, "remove"));
    expect(seatView(s, "p2").player).toMatchObject({
      form: "alter",
      exhausted: true,
      flipped: false,
    });
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(s.removed.map((p) => p.id)).toContain(obligation.id);
    encounterConserved(s, [obligation]);
  });
  it("discards one available Technique, counts it and grants no Surge", () => {
    let s = base();
    const technique = put(s, "22004"),
      obligation = makePiece(s, "22027"),
      next = s.encounter.deck[0];
    s = reveal(s, obligation);
    s = choose(s, "stay");
    s = choose(s, "techniques");
    expect(s.prompt?.min).toBe(1);
    s = finish(command(s, { type: "SELECT", ids: [technique.id] }));
    expect(s.encounter.deck[0].id).toBe(next.id);
    expect(s.player.discard.map((p) => p.id)).toContain(technique.id);
    expect(s.encounter.discard.map((p) => p.id)).toContain(obligation.id);
  });
  it("gives native Surge only when zero upgrades were actually discarded", () => {
    let s = base();
    const obligation = makePiece(s, "22027"),
      bomb = makePiece(s, "01107");
    s.encounter.deck.unshift(bomb);
    s = finish(choose(choose(reveal(s, obligation), "stay"), "techniques"));
    expect(s.encounter.dealt.map((p) => p.id)).toContain(bomb.id);
    encounterConserved(s, [obligation, bomb]);
  });
  it("discards every actual Gamora ally before nemesis entry while retaining each owner", () => {
    let s = base("drax");
    const ownGamora = put(s, "22002"),
      teammateGamora = put(s, "19020", "p2");
    const result = nemesis(s);
    s = result.s;
    expect(s.minions.some((p) => p.code === "22028")).toBe(true);
    expect(s.player.discard.map((p) => p.id)).toContain(ownGamora.id);
    expect(seatView(s, "p2").player.discard.map((p) => p.id)).toContain(
      teammateGamora.id,
    );
    conserved(s, [ownGamora]);
    conserved(s, [teammateGamora], "p2");
    encounterConserved(s, result.cards);
  });
  it("requires an actual identity attack-damage victim to discard its controlled upgrade", () => {
    let s = base();
    const { s: fight, cards } = nemesis(s);
    s = fight;
    const source = s.minions.find((p) => p.code === "22028")!,
      upgrade = put(s, "22004");
    s = native(s, { type: "enemyAttack", id: source.id });
    s = until(s, (v) => v.prompt?.title === "Gamora");
    expect(s.player.hp).toBe(6);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([upgrade.id]);
    s = finish(choose(s, upgrade.id));
    expect(s.player.discard.map((p) => p.id)).toContain(upgrade.id);
    encounterConserved(s, cards);
  });
  it("does not force an upgrade discard when an ally alone takes Gamora's attack", () => {
    let s = base();
    const { s: fight, cards } = nemesis(s);
    s = fight;
    const source = s.minions.find((p) => p.code === "22028")!,
      upgrade = put(s, "22004"),
      defender = put(s, "22012");
    s = native(s, { type: "enemyAttack", id: source.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === defender.id));
    s = finish(choose(s, defender.id));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.map((p) => p.id)).toContain(upgrade.id);
    encounterConserved(s, cards);
  });
});

describe("Old Rivals native physical enemy, ally and hero attacks", () => {
  it("uses the actual minion attack, Self-Preservation ATK and its native forced response", () => {
    let { s, cards } = nemesis(base());
    const upgrade = put(s, "22004"),
      event = originalEncounter(s, "22031");
    s = reveal(s, event);
    s = until(s, (v) => v.prompt?.title === "Gamora");
    s = finish(choose(s, upgrade.id));
    expect(s.player.hp).toBe(6);
    expect(s.player.discard.map((p) => p.id)).toContain(upgrade.id);
    encounterConserved(s, cards);
  });
  it("performs an actual ally attack without exhausting her and deals consequential damage afterward", () => {
    let result = nemesis(base());
    let s = removeNemesisCharacters(result.s);
    const ally = put(s, "22002"),
      event = originalEncounter(s, "22031");
    s = finish(reveal(s, event));
    expect(s.player.hp).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      exhausted: false,
      damage: 1,
    });
    expect(s.attack).toBeNull();
    encounterConserved(s, result.cards);
    conserved(s, [ally]);
  });
  it("lets another controller's Gamora ally search before native consequential damage", () => {
    let result = nemesis(base("drax"));
    let s = removeNemesisCharacters(result.s);
    const ally = put(s, "19020", "p2"),
      found = top(s, "19004", "p2"),
      event = originalEncounter(s, "22031");
    s = reveal(s, event);
    s = respond(s, /^Gamora$/);
    s = finish(s);
    expect(s.player.hp).toBe(7);
    expect(seatView(s, "p2").player.hand.map((p) => p.id)).toContain(found.id);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ally.id),
    ).toMatchObject({ exhausted: false, damage: 1 });
    conserved(s, [ally, found], "p2");
    encounterConserved(s, result.cards);
  });
  it("uses actual Gamora hero stats and keeps her ready across JSON restored native defense", () => {
    let s = base("gam");
    const weapon = attach(s, "22030", "hero:p2");
    const event = makePiece(s, "22031");
    s = reveal(s, event);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.attack?.attacker).toBe("hero:p2");
    expect(s.attack?.base).toBe(3);
    s = finish(choose(reload(s), "take"));
    expect(seatView(s, "p1").player.hp).toBe(6);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(s.attack).toBeNull();
    encounterConserved(s, [event, weapon]);
  });
  it("consumes the actual hero's Stun and grants Surge when no attack was made", () => {
    let s = base("gam");
    seatView(s, "p2").player.stunned = true;
    const event = makePiece(s, "22031"),
      bomb = makePiece(s, "01107");
    s.encounter.deck.unshift(bomb);
    s = finish(reveal(s, event));
    expect(seatView(s, "p2").player.stunned).toBe(false);
    expect(s.player.hp).toBe(9);
    expect(s.encounter.dealt.map((p) => p.id)).toContain(bomb.id);
    expect(s.attack).toBeNull();
    encounterConserved(s, [event, bomb]);
  });
  it("does not attack using Gamora's alter-ego face and resolves native Surge", () => {
    let s = base("gam");
    seatView(s, "p2").player.form = "alter";
    const event = makePiece(s, "22031"),
      bomb = makePiece(s, "01107");
    s.encounter.deck.unshift(bomb);
    s = finish(reveal(s, event));
    expect(s.player.hp).toBe(9);
    expect(s.encounter.dealt.map((p) => p.id)).toContain(bomb.id);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
  });
  it("attaches the same Lethal Weapon to alter-ego Gamora and pays a real upgrade discard to remove it", () => {
    let s = base("gam");
    seatView(s, "p2").player.form = "alter";
    const attachment = makePiece(s, "22030");
    s = finish(reveal(s, attachment));
    expect(s.attachments.find((p) => p.id === attachment.id)?.attachedTo).toBe(
      "hero:p2",
    );
    expect(heroStats(seatView(s, "p2")).attack).toBe(3);
    const upgrade = put(s, "22004");
    s = command(s, {
      type: "ABILITY",
      id: attachment.id,
      action: "lethal-weapon",
    });
    s = finish(choose(s, upgrade.id));
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(false);
    expect(s.player.discard.map((p) => p.id)).toContain(upgrade.id);
    encounterConserved(s, [attachment]);
  });
});

describe("Old Rivals completion and cancellation boundaries", () => {
  it("records an initiated attack ending before damage when First Hit defeats the minion", () => {
    let result = nemesis(base()),
      s = result.s;
    const source = s.minions.find((p) => p.code === "22028")!;
    source.damage = 4;
    const firstHit = owned(s, "18015"),
      resource = hand(s, "22025")[0];
    s.player.hand.push(firstHit);
    const rivals = originalEncounter(s, "22031"),
      bomb = makePiece(s, "01107");
    s.encounter.deck.unshift(bomb);
    s = reveal(s, rivals);
    s = respond(s, /First Hit/);
    s = pay(s, [resource]);
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.minions.some((p) => p.id === source.id)).toBe(false);
    expect(s.encounter.dealt.map((p) => p.id)).not.toContain(bomb.id);
    expect(s.encounter.deck[0].id).toBe(bomb.id);
    expect(s.attack).toBeNull();
    encounterConserved(s, result.cards);
  });
  it("consumes the actual ally's Stun, gives no consequential damage and reports no attack", () => {
    let result = nemesis(base()),
      s = removeNemesisCharacters(result.s);
    const ally = put(s, "22002");
    ally.stunned = true;
    const event = originalEncounter(s, "22031"),
      bomb = makePiece(s, "01107");
    s.encounter.deck.unshift(bomb);
    s = finish(reveal(s, event));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      stunned: false,
      exhausted: false,
      damage: 0,
    });
    expect(s.encounter.dealt.map((p) => p.id)).toContain(bomb.id);
    encounterConserved(s, result.cards);
  });
  it("counts a completed Tough-prevented ally attack and still applies its consequential damage", () => {
    let result = nemesis(base()),
      s = removeNemesisCharacters(result.s);
    const ally = put(s, "22002"),
      event = originalEncounter(s, "22031"),
      topCard = s.encounter.deck[0];
    s.player.tough = true;
    s = finish(reveal(s, event));
    expect(s.player.hp).toBe(9);
    expect(s.player.tough).toBe(false);
    expect(s.encounter.deck[0].id).toBe(topCard.id);
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    encounterConserved(s, result.cards);
  });
  it("applies Nebula's actual Retaliate to another player's Gamora hero", () => {
    let s = base("gam");
    put(s, "22007");
    const rival = makePiece(s, "22031");
    s = finish(reveal(s, rival));
    expect(seatView(s, "p1").player.hp).toBe(7);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(s.attack).toBeNull();
    encounterConserved(s, [rival]);
  });
  it("records a completed attack when Retaliate defeats the ally source before its ordinary responses", () => {
    let result = nemesis(base()),
      s = removeNemesisCharacters(result.s);
    put(s, "22007");
    const ally = put(s, "22002");
    ally.damage = 2;
    const rival = originalEncounter(s, "22031"),
      topCard = s.encounter.deck[0];
    s = finish(reveal(s, rival));
    expect(s.player.hp).toBe(7);
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.encounter.deck[0].id).toBe(topCard.id);
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.attack).toBeNull();
    encounterConserved(s, result.cards);
    conserved(s, [ally]);
  });
  it("uses actual Self-Preservation and printed Lethal Weapon bonuses on friendly Gamora", () => {
    let s = base("gam");
    const preservation = side(s, "22029", 4),
      weapon = attach(s, "22030", "hero:p2"),
      rival = makePiece(s, "22031");
    expect(heroStats(seatView(s, "p2")).attack).toBe(4);
    s = finish(reveal(s, rival));
    expect(seatView(s, "p1").player.hp).toBe(5);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    encounterConserved(s, [preservation, weapon, rival]);
  });
  it("leaves a controlled upgrade when the actual nemesis attack is prevented by Tough", () => {
    let result = nemesis(base()),
      s = result.s;
    s = finish(
      native(s, {
        type: "discardPiece",
        id: s.sideSchemes.find((p) => p.code === "22029")!.id,
      }),
    );
    const upgrade = put(s, "22004");
    s.player.tough = true;
    const source = s.minions.find((p) => p.code === "22028")!;
    s = finish(native(s, { type: "enemyAttack", id: source.id }));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.map((p) => p.id)).toContain(upgrade.id);
    expect(s.enemyAttackCounts?.[source.id]).toBe(1);
    encounterConserved(s, result.cards);
  });
});

describe("Old Rivals retains printed ally attack interrupts", () => {
  it("uses a physical Target Practice with Gamora's Weapon before her native attack", () => {
    let result = nemesis(base()),
      s = removeNemesisCharacters(result.s);
    const ally = put(s, "22002"),
      laser = put(s, "17019"),
      practice = put(s, "17017");
    laser.attachedTo = ally.id;
    const event = originalEncounter(s, "22031");
    s = reveal(s, event);
    expect(s.prompt?.title).toBe("Gamora · attack interrupts");
    s = finish(choose(s, practice.id));
    expect(s.player.hp).toBe(4);
    expect(s.player.discard.map((p) => p.id)).toContain(practice.id);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      exhausted: false,
      damage: 1,
    });
    conserved(s, [ally, laser, practice]);
    encounterConserved(s, result.cards);
  });
  it("pays Last Stand before an actual Gamora ally attack and discards her after consequential damage", () => {
    let result = nemesis(base()),
      s = removeNemesisCharacters(result.s);
    const ally = put(s, "22002"),
      last = owned(s, "15029");
    const resource = hand(s, "22025")[0];
    s.player.hand.push(last);
    const event = originalEncounter(s, "22031");
    s = reveal(s, event);
    expect(s.prompt?.title).toBe("Gamora · attack interrupts");
    s = choose(s, last.id);
    s = pay(s, [resource]);
    s = finish(s);
    expect(s.player.hp).toBe(4);
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === last.id)).toBe(true);
    expect(s.attack).toBeNull();
    conserved(s, [ally, last, resource]);
    encounterConserved(s, result.cards);
  });
});
