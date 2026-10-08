/** Independent native review: real source cards, real payment/reveal windows,
 * a JSON round-trip before every command and physical source conservation. */
import { describe, expect, it } from "vitest";
import { card, maxHP, pieceHP } from "../src/game/cards.js";
import { dispatch, makePiece, newGame, playable } from "../src/game/engine.js";
import { giveStatus, statusCards } from "../src/game/keywords.js";
import { allInPlay, controller, seatView } from "../src/game/team.js";
import type {
  Command,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";

type Reviewed = GameState & { nebulaReviewSource: Record<string, string[]> };
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function command(input: GameState, c: Command) {
  let s = dispatch(reload(input), c);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let n = 0; s.review && n < 100; n++) {
    s = dispatch(reload(s), { type: "PROCEED" });
    expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  }
  expect(s.review).toBeNull();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt!.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function pass(s: GameState) {
  return s.prompt?.options.find((o) =>
    /^(skip|pass|none|done|continue|no|decline|take)$/.test(o.id),
  )?.id;
}
function finish(s: GameState) {
  for (let n = 0; s.prompt && n < 150; n++) {
    const id =
      pass(s) ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  conserved(s);
  return s;
}
function until(s: GameState, predicate: (s: GameState) => boolean) {
  for (let n = 0; s.prompt && !predicate(s) && n < 100; n++) {
    const id = pass(s);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(predicate(s), JSON.stringify(s.prompt)).toBe(true);
  return s;
}
function respond(s: GameState, code: string) {
  s = until(
    s,
    (v) =>
      !!v.prompt?.options.some((o) => o.image === code) ||
      (v.prompt?.title === card(code).name &&
        v.prompt.options.some((o) => o.id === "yes")),
  );
  return choose(
    s,
    (s.prompt!.options.find((o) => o.image === code) ||
      s.prompt!.options.find((o) => o.id === "yes"))!.id,
  );
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Native independent rules review",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function physical(s: GameState): Piece[] {
  const result = s.players.flatMap((seat) => {
    const p = seatView(s, seat).player;
    return [
      ...p.deck,
      ...p.hand,
      ...p.discard,
      ...p.inPlay,
      ...(p.setAside || []),
      ...(p.invocationDeck || []),
      ...(p.invocationDiscard || []),
    ];
  });
  result.push(
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  );
  const nested = (p: Piece) => {
    const children = [
      ...(p.storedCards || []),
      ...(p.captured || []),
      ...(p.droneCard ? [p.droneCard] : []),
    ];
    result.push(...children);
    children.forEach(nested);
  };
  [...result].forEach(nested);
  return result;
}
function exact(s: GameState, p: Piece) {
  const found = physical(s).filter((a) => a.id === p.id);
  expect(found, `exact physical ${p.code}:${p.id}`).toHaveLength(1);
  expect(found[0].code).toBe(p.code);
  expect(found[0].ownerId).toBe(p.ownerId);
  return found[0];
}
function conserved(s: GameState) {
  const cards = physical(s);
  expect((s as Reviewed).nebulaReviewSource).toBeDefined();
  expect(Object.keys((s as Reviewed).nebulaReviewSource)).toHaveLength(
    s.players.length,
  );
  for (const [owner, ids] of Object.entries(
    (s as Reviewed).nebulaReviewSource,
  )) {
    expect(ids).toHaveLength(40);
    for (const id of ids) {
      const found = cards.filter((p) => p.id === id);
      expect(found, `original ${owner}:${id}`).toHaveLength(1);
      expect(found[0].ownerId).toBe(owner);
    }
  }
}
function base(team = false) {
  let s = newGame({
    heroId: "nebu",
    aspect: "justice",
    villainId: "rhino",
    seed: 22011,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "nebu", aspect: "justice" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  (s as Reviewed).nebulaReviewSource = Object.fromEntries(
    s.players.map((seat) => {
      const p = seatView(s, seat).player,
        source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
      expect(source).toHaveLength(40);
      return [seat.id, source.map((p) => p.id)];
    }),
  );
  for (let i = 0; i < s.players.length; i++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.deck.push(
      ...v.player.hand.splice(0),
      ...v.player.discard.splice(0),
    );
    v.player.form = "hero";
    v.player.flipped = false;
    v.player.exhausted = false;
  }
  s.villain.hp = s.villain.maxHp = 50;
  s.villain.tough = false;
  s.scheme.threat = 12;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01104"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  return s;
}
function take(
  s: GameState,
  code: string,
  zone: "hand" | "inPlay" | "discard" = "hand",
  playerId = s.activePlayerId,
) {
  const p = seatView(s, playerId).player;
  let found: Piece | undefined;
  for (const cards of [p.deck, p.hand, p.discard, p.inPlay]) {
    const i = cards.findIndex((p) => p.code === code);
    if (i >= 0) {
      found = cards.splice(i, 1)[0];
      break;
    }
  }
  found ||= { ...makePiece(s, code), ownerId: playerId };
  p[zone].push(found);
  return found;
}
function top(s: GameState, codes: string[], playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player,
    cards = codes.map((code) => take(s, code, "hand", playerId));
  for (const card of cards)
    p.hand.splice(
      p.hand.findIndex((p) => p.id === card.id),
      1,
    );
  p.deck.unshift(...cards);
  return cards;
}
function play(
  s: GameState,
  p: Piece,
  resources: Piece[] = [],
  wildAs?: Resource,
) {
  s = command(s, { type: "PLAY", id: p.id });
  if (s.prompt?.kind === "payment")
    s = command(s, {
      type: "PAY",
      ids: resources.map((p) => p.id),
      ...(wildAs ? { wildAs } : {}),
    });
  if (wildAs && s.prompt?.title === "Allocate payment resources")
    s = choose(s, wildAs);
  return s;
}
function attack(s: GameState, p: Piece) {
  s = command(s, { type: "ABILITY", id: p.id, action: "attack" });
  return s.prompt?.options.some((o) => o.id === s.villain.id)
    ? choose(s, s.villain.id)
    : s;
}
function thawed(s: GameState, id: string) {
  return allInPlay(s).find((p) => p.id === id)!;
}

// The Steady minion is a printed metadata fixture for the generic current-RRG
// status keyword. Its future-pack card ability is never revealed or executed.
function steady(s: GameState, playerId = s.activePlayerId) {
  const p = makePiece(s, "27122");
  p.engagedWith = playerId;
  p.tough = false;
  p.toughCards = 0;
  s.minions.push(p);
  return p;
}

describe("Nebula pool native payment and current Eros errata", () => {
  it("spends one actual double-Mental resource and chooses the same Steady physical minion twice", () => {
    let s = base(true);
    const eros = take(s, "22011"),
      genius = take(s, "22025"),
      minion = steady(s, "p2");
    s = play(s, eros, [genius]);
    s = respond(s, "22011");
    s = choose(s, minion.id);
    expect(
      statusCards(
        s.minions.find((p) => p.id === minion.id)!,
        "confused",
      ),
    ).toBe(1);
    expect(s.minions.find((p) => p.id === minion.id)!.confused).toBe(false);
    expect(s.prompt!.options.some((o) => o.id === minion.id)).toBe(true);
    s = choose(s, minion.id);
    s = finish(s);
    expect(
      statusCards(
        s.minions.find((p) => p.id === minion.id)!,
        "confused",
      ),
    ).toBe(2);
    expect(s.minions.find((p) => p.id === minion.id)!.confused).toBe(true);
    expect(s.player.discard.some((p) => p.id === genius.id)).toBe(true);
    exact(s, eros);
    exact(s, genius);
    exact(s, minion);
  });
  it("does not count two surplus Mental resources when the player allocates the two Energy resources to Eros", () => {
    let s = base();
    const eros = take(s, "22011"),
      genius = take(s, "22025"),
      energy = take(s, "22024"),
      minion = steady(s);
    s = play(s, eros, [genius, energy]);
    expect(s.prompt?.title).toBe("Allocate payment resources");
    expect(s.player.hand.map((p) => p.id)).toEqual(
      expect.arrayContaining([eros.id, genius.id, energy.id]),
    );
    s = choose(s, "energy");
    expect(s.prompt?.title).not.toBe("Eros");
    s = finish(s);
    expect(
      statusCards(
        s.minions.find((p) => p.id === minion.id)!,
        "confused",
      ),
    ).toBe(0);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([genius.id, energy.id]),
    );
    exact(s, eros);
    exact(s, genius);
    exact(s, energy);
  });
  it("a mixed real allocation creates one Eros choice despite a double-Mental card also being spent", () => {
    let s = base();
    const eros = take(s, "22011"),
      genius = take(s, "22025"),
      energy = take(s, "22024"),
      minion = steady(s);
    s = play(s, eros, [genius, energy]);
    const choice = s.prompt!.options.find(
      (o) => /1 mental/.test(o.label) && /1 energy/.test(o.label),
    )!;
    expect(choice).toBeDefined();
    s = choose(s, choice.id);
    s = respond(s, "22011");
    s = choose(s, minion.id);
    s = finish(s);
    expect(
      statusCards(
        s.minions.find((p) => p.id === minion.id)!,
        "confused",
      ),
    ).toBe(1);
    expect(s.minions.find((p) => p.id === minion.id)!.confused).toBe(false);
  });
  it("double Wild Power of Justice actually assigned as Mental funds two separate choices", () => {
    let s = base();
    const eros = take(s, "22011"),
      power = take(s, "22017"),
      minion = steady(s);
    s = play(s, eros, [power], "mental");
    s = respond(s, "22011");
    s = choose(s, minion.id);
    s = choose(s, minion.id);
    s = finish(s);
    expect(
      statusCards(
        s.minions.find((p) => p.id === minion.id)!,
        "confused",
      ),
    ).toBe(2);
    expect(s.player.discard.some((p) => p.id === power.id)).toBe(true);
    exact(s, power);
  });
  it("putting the actual Eros into play never manufactures a from-hand paid response", () => {
    let s = base();
    const eros = take(s, "22011", "discard"),
      minion = steady(s);
    s = native(s, { type: "returnAlly", id: eros.id });
    s = finish(s);
    expect(thawed(s, eros.id)).toBeDefined();
    expect(
      statusCards(
        s.minions.find((p) => p.id === minion.id)!,
        "confused",
      ),
    ).toBe(0);
    exact(s, eros);
  });
});

describe("Honorary Guardian native HP and physical ownership", () => {
  it("adds and later subtracts one CURRENT HP from a wounded teammate, returning the physical upgrade to its owner", () => {
    let s = base(true);
    const title = take(s, "22035");
    seatView(s, "p2").player.hp = 5;
    const ownHP = s.player.hp;
    s = play(s, title);
    s = choose(s, "hero:p2");
    s = finish(s);
    expect(controller(s, title.id)!.id).toBe("p2");
    expect(exact(s, title).ownerId).toBe("p1");
    expect(maxHP(seatView(s, "p2"))).toBe(11);
    expect(seatView(s, "p2").player.hp).toBe(6);
    expect(s.player.hp).toBe(ownHP);
    const knowhere = take(s, "22021", "hand", "p2");
    take(s, "01089", "hand", "p2");
    expect(
      playable({ ...seatView(s, "p2"), turnPlayerId: "p2" }, knowhere),
    ).toBeNull();
    s = native(s, { type: "discardPiece", id: title.id });
    s = finish(s);
    expect(maxHP(seatView(s, "p2"))).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(5);
    expect(s.player.hp).toBe(ownHP);
    expect(s.player.discard.some((p) => p.id === title.id)).toBe(true);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === title.id),
    ).toBe(false);
    expect(
      playable({ ...seatView(s, "p2"), turnPlayerId: "p2" }, knowhere),
    ).toMatch(/Guardian/);
    exact(s, title);
  });
  it("the local hero attachment is canonical and an existing title excludes the same physical character", () => {
    let s = base(true);
    const first = take(s, "22035"),
      second = { ...makePiece(s, "22035"), ownerId: "p1" };
    s.player.hand.push(second);
    s = play(s, first);
    s = choose(s, "hero:p1");
    s = finish(s);
    expect(exact(s, first).attachedTo).toBe("hero:p1");
    expect(maxHP(s)).toBe(10);
    expect(s.player.hp).toBe(10);
    s = play(s, second);
    expect(
      s.prompt?.options.some((o) => o.id === "hero:p1" || o.id === "hero"),
    ).toBe(false);
    s = choose(s, "hero:p2");
    s = finish(s);
    expect(maxHP(seatView(s, "p2"))).toBe(11);
    exact(s, first);
    exact(s, second);
  });
  it("losing the extra HP at one remaining HP eliminates the teammate through ordinary cleanup", () => {
    let s = base(true);
    const title = take(s, "22035");
    s = play(s, title);
    s = choose(s, "hero:p2");
    s = finish(s);
    s = native(s, {
      type: "damage",
      target: "hero:p2",
      amount: 10,
      source: "independent-test",
    });
    s = finish(s);
    expect(seatView(s, "p2").player.hp).toBe(1);
    s = native(s, { type: "discardPiece", id: title.id });
    s = finish(s);
    expect(s.players.find((p) => p.id === "p2")!.eliminated).toBe(true);
    expect(s.player.discard.some((p) => p.id === title.id)).toBe(true);
    exact(s, title);
  });
  it("losing the title also defeats an ally whose damage now equals its printed HP without changing its damage tokens", () => {
    let s = base(true);
    const title = take(s, "22035"),
      ally = take(s, "01083", "inPlay", "p2");
    ally.damage = 2;
    s = play(s, title);
    s = choose(s, ally.id);
    s = finish(s);
    expect(pieceHP(s, thawed(s, ally.id))).toBe(4);
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 1,
      source: "independent-test",
    });
    s = finish(s);
    expect(thawed(s, ally.id).damage).toBe(3);
    s = native(s, { type: "discardPiece", id: title.id });
    s = finish(s);
    expect(seatView(s, "p2").player.discard.some((p) => p.id === ally.id)).toBe(
      true,
    );
    expect(s.player.discard.some((p) => p.id === title.id)).toBe(true);
    exact(s, ally);
    exact(s, title);
  });
});

describe("Venom current consequential timing", () => {
  it.each([
    { threat: 2, remaining: 0, damage: 1 },
    { threat: 3, remaining: 1, damage: 2 },
  ])(
    "checks main threat AFTER his actual basic thwart (%j)",
    ({ threat, remaining, damage }) => {
      let s = base();
      const venom = take(s, "22013", "inPlay");
      s.scheme.threat = threat;
      s = command(s, { type: "ABILITY", id: venom.id, action: "thwart" });
      if (s.prompt?.options.some((o) => o.id === "main")) s = choose(s, "main");
      s = finish(s);
      expect(s.scheme.threat).toBe(remaining);
      expect(thawed(s, venom.id).damage).toBe(damage);
      expect(thawed(s, venom.id).exhausted).toBe(true);
      exact(s, venom);
    },
  );
});

describe("Cosmo hidden saved physical deck choices", () => {
  it("uses a saved teammate top-card ID exactly once and does not carry prediction protection to a later use", () => {
    let s = base(true);
    const cosmo = take(s, "22020", "inPlay"),
      [topCard] = top(s, ["01089"], "p2");
    s = attack(s, cosmo);
    s = respond(s, "22020");
    s = choose(s, "resource");
    expect(s.prompt!.options.map((o) => o.id)).toEqual([
      "p1",
      "p2",
      "encounter",
    ]);
    expect(s.prompt!.options.every((o) => !o.image)).toBe(true);
    const saved = s.prompt!.options.find((o) => o.id === "p2")!;
    expect(saved.effects[0].topId).toBe(topCard.id);
    s = choose(s, "p2");
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(thawed(s, cosmo.id).damage).toBe(0);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === topCard.id),
    ).toBe(true);
    exact(s, topCard);
    exact(s, cosmo);
    s = native(s, { type: "ready", target: cosmo.id });
    s = finish(s);
    s = finish(attack(s, thawed(s, cosmo.id)));
    expect(s.villain.hp).toBe(48);
    expect(thawed(s, cosmo.id).damage).toBe(1);
    exact(s, topCard);
  });
  it("predicts the actual discarded last card even when the teammate immediately resets that deck", () => {
    let s = base(true);
    const cosmo = take(s, "22020", "inPlay"),
      [topCard] = top(s, ["01089"], "p2"),
      player = seatView(s, "p2").player;
    player.discard.push(...player.deck.splice(1));
    s = attack(s, cosmo);
    s = respond(s, "22020");
    s = choose(s, "resource");
    s = choose(s, "p2");
    s = finish(s);
    expect(seatView(s, "p2").player.deck).toHaveLength(40);
    expect(seatView(s, "p2").player.discard).toHaveLength(0);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p2")).toHaveLength(1);
    expect(thawed(s, cosmo.id).damage).toBe(0);
    expect(s.villain.hp).toBe(49);
    exact(s, topCard);
    exact(s, cosmo);
  });
  it("keeps an encounter discard in the encounter pile and a mismatched prediction still takes consequential damage", () => {
    let s = base();
    const cosmo = take(s, "22020", "inPlay"),
      topCard = makePiece(s, "01104");
    s.encounter.deck.unshift(topCard);
    s = attack(s, cosmo);
    s = respond(s, "22020");
    s = choose(s, "resource");
    s = choose(s, "encounter");
    s = finish(s);
    expect(s.encounter.discard.some((p) => p.id === topCard.id)).toBe(true);
    expect(thawed(s, cosmo.id).damage).toBe(1);
    exact(s, topCard);
  });
});

describe("One Way or Another actual reveal cost and global Max", () => {
  it("can spend actual Determination on the zero-cost play and resolve its non-thwart response before the reveal cost", () => {
    let s = base();
    const event = take(s, "22015"),
      determination = take(s, "22016"),
      drawn = top(s, ["22024", "22025", "22026"]),
      scheme = makePiece(s, "01107");
    s.scheme.threat = 1;
    s.encounter.deck.push(scheme);
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["continue", "spend"]);
    s = choose(s, "spend");
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(0);
    s = command(s, { type: "PAY", ids: [determination.id] });
    expect(s.sideSchemes).toHaveLength(0);
    expect(s.encounter.deck.some((p) => p.id === scheme.id)).toBe(true);
    s = respond(s, "22016");
    expect(s.scheme.threat).toBe(0);
    expect(s.prompt?.title).toBe("One Way or Another");
    expect(s.player.hand).toHaveLength(0);
    s = choose(s, scheme.id);
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual(drawn.map((p) => p.id));
    expect(s.player.discard.some((p) => p.id === determination.id)).toBe(true);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(true);
    exact(s, determination);
    exact(s, event);
    exact(s, scheme);
  });
  it("completes the selected physical scheme's When Revealed choice before drawing its benefit", () => {
    let s = base();
    const event = take(s, "22015"),
      drawn = top(s, ["22024", "22025", "22026"]),
      scheme = makePiece(s, "01151");
    s.encounter.deck.push(scheme);
    s = play(s, event);
    s = choose(s, scheme.id);
    expect(s.prompt?.title).toBe("Under Attack");
    expect(s.player.hand).toHaveLength(0);
    s = choose(s, "threat");
    s = finish(s);
    expect(s.player.hand.map((p) => p.id)).toEqual(drawn.map((p) => p.id));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)!.counters).toBe(
      (card(scheme).base_threat || 0) + 2,
    );
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    exact(s, scheme);
    exact(s, event);
  });
  it("canceling the revealed scheme still finishes its replacement reveal before drawing three", () => {
    let s = base();
    take(s, "01083", "inPlay");
    const spy = take(s, "08018"),
      resource = take(s, "22023");
    s = finish(play(s, spy, [resource]));
    const event = take(s, "22015"),
      drawn = top(s, ["22024", "22025", "22026"]),
      original = makePiece(s, "01107"),
      replacement = makePiece(s, "01151");
    s.encounter.deck.unshift(replacement);
    s.encounter.deck.push(original);
    s = play(s, event);
    s = choose(s, original.id);
    s = respond(s, "08018");
    expect(s.prompt?.title).toBe("Under Attack");
    expect(s.player.hand).toHaveLength(0);
    s = choose(s, "threat");
    s = finish(s);
    expect(s.sideSchemes.some((p) => p.id === original.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === original.id)).toBe(true);
    expect(s.sideSchemes.some((p) => p.id === replacement.id)).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual(drawn.map((p) => p.id));
    exact(s, original);
    exact(s, replacement);
    exact(s, event);
    exact(s, spy);
  });
  it("the actual play consumes the title-wide round maximum for both players", () => {
    let s = base(true);
    const event = take(s, "22015"),
      teammateEvent = take(s, "22015", "hand", "p2"),
      scheme = makePiece(s, "01107");
    s.encounter.deck.push(scheme);
    s = play(s, event);
    s = choose(s, scheme.id);
    s = finish(s);
    s.encounter.deck.push(makePiece(s, "01107"));
    expect(playable(seatView(s, "p2"), teammateEvent)).toMatch(
      /1 per round.*all players/,
    );
    const blocked = dispatch(reload(s), {
      type: "PLAY",
      id: teammateEvent.id,
      playerId: "p2",
    });
    expect(blocked.error).toBeTruthy();
    expect(
      seatView(blocked, "p2").player.hand.some(
        (p) => p.id === teammateEvent.id,
      ),
    ).toBe(true);
    conserved(blocked);
  });
});

describe("Wraith native current boost ability and numeric icons", () => {
  it.each(["normal", "tough", "defeated"] as const)(
    "pays the %s Wraith damage cost while canceling only the star ability of a boost with one numeric icon",
    (condition) => {
      let s = base(true);
      const wraith = take(s, "22012", "inPlay", "p2"),
        boost = makePiece(s, "01158");
      if (condition === "tough") giveStatus(wraith, card(wraith), "tough");
      if (condition === "defeated") wraith.damage = 2;
      const hp = s.player.hp,
        teammateHP = seatView(s, "p2").player.hp;
      expect(card(boost).boost).toBe(1);
      expect(card(boost).boost_star).toBe(true);
      s.encounter.deck.unshift(boost);
      s = native(s, { type: "enemyAttack", id: s.villain.id });
      s = choose(s, "take");
      s = respond(s, "22012");
      s = finish(s);
      expect(s.villain.tough).toBe(false);
      expect(s.player.hp).toBe(hp - 3);
      expect(seatView(s, "p2").player.hp).toBe(teammateHP);
      if (condition === "defeated")
        expect(
          seatView(s, "p2").player.discard.some((p) => p.id === wraith.id),
        ).toBe(true);
      else {
        expect(thawed(s, wraith.id).exhausted).toBe(true);
        expect(thawed(s, wraith.id).damage).toBe(condition === "tough" ? 0 : 1);
        expect(thawed(s, wraith.id).tough).toBe(false);
      }
      expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
      exact(s, boost);
      exact(s, wraith);
    },
  );
  it("an Alter-Ego controller cannot use Wraith even while a different player's hero is attacked", () => {
    let s = base(true);
    const wraith = take(s, "22012", "inPlay", "p2"),
      boost = makePiece(s, "01158");
    seatView(s, "p2").player.form = "alter";
    s.encounter.deck.unshift(boost);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(s.prompt?.options.some((o) => o.image === "22012")).toBeFalsy();
    s = finish(s);
    expect(s.villain.tough).toBe(true);
    expect(thawed(s, wraith.id).damage).toBe(0);
    expect(thawed(s, wraith.id).exhausted).toBe(false);
    exact(s, boost);
  });
});
