/** Independent Vision supplementary native review: real source cards, real payment/reveal windows,
 * a JSON round-trip before every command and physical source conservation. */
import { describe, expect, it } from "vitest";
import { card, pieceHP, heroStats, maxHP } from "../src/game/cards.js";
import {
  dispatch,
  makePiece,
  newGame,
  playable,
  paymentSources,
  visionPackStoredPlayable,
  summarize,
} from "../src/game/engine.js";
import {
  activateSeat,
  allInPlay,
  controller,
  seatView,
} from "../src/game/team.js";
import type {
  Command,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";

type VisionReviewed = GameState & {
  visionReviewSource: Record<string, string[]>;
};
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
    /^(skip|pass|none|done|continue|no|decline|take|resolve|allow)$/.test(o.id),
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
  expect((s as VisionReviewed).visionReviewSource).toBeDefined();
  expect(Object.keys((s as VisionReviewed).visionReviewSource)).toHaveLength(
    s.players.length,
  );
  for (const [owner, ids] of Object.entries(
    (s as VisionReviewed).visionReviewSource,
  )) {
    expect(ids).toHaveLength(
      ["valk", "vision"].includes(seatView(s, owner).heroId) ? 41 : 40,
    );
    for (const id of ids) {
      const found = cards.filter((p) => p.id === id);
      expect(found, `original ${owner}:${id}`).toHaveLength(1);
      expect(found[0].ownerId).toBe(owner);
    }
  }
}
function base(otherHero?: string, hero = "vision") {
  let s = newGame({
    heroId: hero,
    aspect: "protection",
    villainId: "rhino",
    seed: 26013,
    pacing: "expert",
    ...(otherHero
      ? {
          heroes: [
            { heroId: hero, aspect: "protection" as const },
            { heroId: otherHero, aspect: "protection" as const },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  (s as VisionReviewed).visionReviewSource = Object.fromEntries(
    s.players.map((seat) => {
      const p = seatView(s, seat).player,
        source = [
          ...p.deck,
          ...p.hand,
          ...p.discard,
          ...p.inPlay,
          ...(p.setAside || []),
        ].filter((p) => card(p).faction_code !== "encounter");
      expect(source).toHaveLength(
        ["valk", "vision"].includes(seat.heroId) ? 41 : 40,
      );
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
  const mass = s.player.inPlay.find((p) =>
    ["26002", "26002b"].includes(p.code),
  );
  if (mass) mass.code = "26002b";
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
function fund(s: GameState, pieces: Piece[]) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("payment");
  const sources = paymentSources(
    s,
    s.prompt!.card?.id,
    s.prompt!.paymentTarget,
    !!s.prompt!.handOnly,
    !!s.prompt!.alliance,
  );
  const ids = pieces.map(
    (p) =>
      sources.find((source) => source.id === p.id || source.localId === p.id)
        ?.id,
  );
  expect(ids.every(Boolean), JSON.stringify(sources)).toBe(true);
  return command(s, { type: "PAY", ids: ids as string[] });
}
function glow(s: GameState, target: string) {
  const cards = s.player.setAside!;
  const index = cards.findIndex((p) => p.code === "25002");
  const p = cards.splice(index, 1)[0];
  expect(p).toBeDefined();
  p.attachedTo = target;
  s.player.inPlay.push(p);
  return p;
}
function enemy(s: GameState, code = "01103", playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  p.tough = false;
  s.minions.push(p);
  return p;
}
function payPrompt(s: GameState, resources: Piece[]) {
  return fund(s, resources);
}
function useHeroAttack(s: GameState, id: string) {
  s = command(s, { type: "BASIC", action: "attack" });
  return choose(s, id);
}

function stored(s: GameState, event: Piece, jocasta: Piece) {
  for (const cards of [s.player.hand, s.player.deck, s.player.discard]) {
    const i = cards.findIndex((p) => p.id === event.id);
    if (i >= 0) cards.splice(i, 1);
  }
  (jocasta.storedCards ||= []).push(event);
}
function byImage(s: GameState, code: string) {
  return choose(s, s.prompt!.options.find((o) => o.image === code)!.id);
}
function attackWindow(s: GameState, defender = "take") {
  s = native(s, { type: "enemyAttack", id: s.villain.id });
  s = choose(s, defender);
  return s;
}
function mass(s: GameState) {
  return s.player.inPlay.find((p) => ["26002", "26002b"].includes(p.code))!;
}

describe("Vision supplementary native physical integration", () => {
  it("preserves forty source playing cards plus the same outside-deck mass instance", () => {
    const s = base();
    conserved(s);
    expect(s.player.deck).toHaveLength(40);
    expect(mass(s)).toBeDefined();
  });
  it("Jocasta actually stores the original discarded Defense event after paid PLAY", () => {
    let s = base();
    const ally = take(s, "26013"),
      event = take(s, "26012", "discard"),
      a = take(s, "26025"),
      b = take(s, "26026");
    s = play(s, ally, [a, b]);
    s = choose(s, "yes");
    s = choose(s, event.id);
    s = finish(s);
    expect(thawed(s, ally.id).storedCards?.map((p) => p.id)).toEqual([
      event.id,
    ]);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(false);
    exact(s, event);
    exact(s, ally);
  });
  it("stored Mass Increase joins its real defense window and extracts only after payment commits", () => {
    let s = base();
    const ally = take(s, "26013", "inPlay"),
      event = take(s, "26012"),
      a = take(s, "26025");
    stored(s, event, ally);
    expect(visionPackStoredPlayable(s).map((p) => p.id)).toEqual([event.id]);
    expect(paymentSources(s).some((p) => p.id === event.id)).toBe(false);
    s = attackWindow(s, "hero");
    s = byImage(s, "26012");
    expect(thawed(s, ally.id).storedCards?.some((p) => p.id === event.id)).toBe(
      true,
    );
    s = payPrompt(s, [a]);
    s = finish(s);
    expect(thawed(s, ally.id).storedCards).toEqual([]);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.hp).toBe(maxHP(s));
    expect(s.villain.stunned).toBe(true);
    exact(s, event);
    exact(s, ally);
  });
  it("Defiance discards the exact facedown starred boost before flip without its icons or ability", () => {
    let s = base();
    const event = take(s, "26018"),
      boost = makePiece(s, "01131");
    s.encounter.deck.unshift(boost);
    const hp = s.player.hp;
    s = attackWindow(s);
    s = until(s, (v) => v.prompt?.title === "Before revealing boost");
    const hidden = s.hiddenInfo || 0;
    s = byImage(s, "26018");
    s = finish(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
    expect(s.hiddenInfo || 0).toBe(hidden);
    exact(s, event);
    exact(s, boost);
  });
  it("Flow Like Water responds to actual Defense PLAY from Jocasta against the actual attacker", () => {
    let s = base();
    const ally = take(s, "26013", "inPlay"),
      event = take(s, "26018"),
      flow = take(s, "26016", "inPlay");
    stored(s, event, ally);
    s = attackWindow(s);
    s = until(s, (v) => v.prompt?.title === "Before revealing boost");
    s = byImage(s, "26018");
    s = respond(s, "26016");
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(thawed(s, ally.id).storedCards).toEqual([]);
    exact(s, event);
    exact(s, flow);
  });
  it("Side Step prevents real nonattack damage in Intangible while unrelated damage has no enemy bonus", () => {
    let s = base();
    mass(s).code = "26002";
    const event = take(s, "26019"),
      a = take(s, "26025"),
      hp = s.player.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: "environment",
    });
    s = byImage(s, "26019");
    s = payPrompt(s, [a]);
    s = finish(s);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.villain.hp).toBe(50);
    exact(s, event);
    exact(s, a);
  });
  it("Side Step's actual FOR-card Energy bonus damages the attacking source minion", () => {
    let s = base();
    const event = take(s, "26019"),
      a = take(s, "26025"),
      minion = enemy(s, "01172"),
      hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: minion.id });
    s = choose(s, "take");
    s = byImage(s, "26019");
    s = payPrompt(s, [a]);
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(s.minions.find((p) => p.id === minion.id)?.damage).toBe(1);
    expect(s.villain.hp).toBe(50);
    exact(s, event);
    exact(s, minion);
  });
  it("an overpaid Energy icon is not a Side Step FOR-card Energy benefit", () => {
    let s = base();
    const event = take(s, "26019"),
      a = take(s, "26026"),
      b = take(s, "26025"),
      hp = s.player.hp;
    s = attackWindow(s);
    s = byImage(s, "26019");
    s = payPrompt(s, [a, b]);
    expect(s.prompt?.title).toBe("Allocate payment resources");
    s = choose(s, "mental");
    s = finish(s);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hp).toBe(hp);
    exact(s, event);
  });
  it("Protector pays actual Mental once per round before consequential damage and Powers do not double ability cost", () => {
    let s = base();
    const ally = take(s, "26014", "inPlay"),
      a = take(s, "26020"),
      power = take(s, "01079");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = byImage(s, "26014");
    expect(
      paymentSources(s, s.prompt!.card?.id, s.prompt!.paymentTarget).find(
        (p) => p.id === power.id,
      )?.resources,
    ).toHaveLength(1);
    s = payPrompt(s, [a]);
    s = finish(s);
    expect(thawed(s, ally.id).damage).toBe(1);
    expect(s.flags[`visionPackProtector:${ally.id}`]).toBe(s.round);
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 1,
      source: "consequential",
    });
    s = finish(s);
    expect(thawed(s, ally.id).damage).toBe(2);
    exact(s, ally);
    exact(s, a);
    exact(s, power);
  });
  it("Victor Mancha reduces each attack before Tough, without reducing consequential damage", () => {
    let s = base();
    const ally = take(s, "26015", "inPlay");
    ally.tough = true;
    ally.toughCards = 1;
    const hp = s.player.hp;
    const minion = enemy(s, "01110");
    s = native(s, { type: "enemyAttack", id: minion.id });
    s = choose(s, ally.id);
    s = finish(s);
    expect(thawed(s, ally.id).tough).toBe(true);
    expect(thawed(s, ally.id).damage).toBe(0);
    expect(s.player.hp).toBe(hp);
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 1,
      source: "consequential",
    });
    s = finish(s);
    expect(thawed(s, ally.id).tough).toBe(false);
    exact(s, ally);
    exact(s, minion);
  });
  it("Preservation can actually be spent for zero-cost Defiance and heals only its Hero payer", () => {
    let s = base();
    const event = take(s, "26018"),
      preservation = take(s, "26021");
    s.player.hp = maxHP(s) - 2;
    s = attackWindow(s);
    s = until(s, (v) => v.prompt?.title === "Before revealing boost");
    s = byImage(s, "26018");
    s = choose(s, "spend");
    s = payPrompt(s, [preservation]);
    s = choose(s, "yes");
    s = finish(s);
    expect(s.player.hp).toBe(maxHP(s) - 3);
    exact(s, event);
    exact(s, preservation);
  });
  it("Machine Man's paid interrupt applies to exactly one ordinary use and a Power remains one wild", () => {
    let s = base();
    const ally = take(s, "26022", "inPlay"),
      power = take(s, "13024"),
      a = take(s, "26025");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = choose(s, "3");
    expect(
      paymentSources(s, s.prompt!.card?.id, s.prompt!.paymentTarget).find(
        (p) => p.id === power.id,
      )?.resources,
    ).toHaveLength(1);
    s = payPrompt(s, [power, a]);
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    expect(thawed(s, ally.id).damage).toBe(1);
    thawed(s, ally.id).exhausted = false;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(s);
    expect(s.villain.hp).toBe(45);
    expect(thawed(s, ally.id).damage).toBe(2);
    exact(s, ally);
    exact(s, power);
  });
  it("Reboot readies and heals an actual teammate Android in alter ego", () => {
    let s = base("vision", "gam");
    const event = take(s, "26024"),
      r = take(s, "26025");
    seatView(s, "p2").player.form = "alter";
    seatView(s, "p2").player.exhausted = true;
    seatView(s, "p2").player.hp = maxHP(seatView(s, "p2")) - 2;
    s = play(s, event, [r]);
    s = choose(s, "hero:p2");
    s = finish(s);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(maxHP(seatView(s, "p2")) - 1);
    exact(s, event);
  });
  it("Assault Training's final actual Use discards the support before shuffling its Aggression event", () => {
    let s = base();
    const support = take(s, "26033"),
      event = take(s, "25018", "discard"),
      a = take(s, "26025");
    s.player.form = "alter";
    s = play(s, support, [a]);
    s = finish(s);
    expect(thawed(s, support.id).counters).toBe(2);
    thawed(s, support.id).counters = 1;
    s = command(s, { type: "ABILITY", id: support.id, action: "train" });
    s = choose(s, event.id);
    s = finish(s);
    expect(s.player.discard.some((p) => p.id === support.id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === event.id)).toBe(true);
    exact(s, event);
    exact(s, support);
  });
  it("Chance Encounter searches its actual controller before physical side-scheme defeat", () => {
    let s = base("gam");
    const upgrade = take(s, "26034"),
      resource = take(s, "26025"),
      side = makePiece(s, "01107"),
      ally = top(s, ["18002"], "p2")[0];
    side.counters = 1;
    s.sideSchemes.push(side);
    s = play(s, upgrade, [resource]);
    s = choose(s, side.id);
    s = finish(s);
    s = native(s, {
      type: "thwart",
      target: side.id,
      amount: 1,
      action: true,
      source: "hero",
    });
    s = choose(s, "yes");
    expect(s.sideSchemes.some((p) => p.id === side.id)).toBe(true);
    // The attached upgrade remains controlled by its actual original owner.
    const chosen = s.prompt!.options.find(
      (o) => o.image === "26013" || o.image === "26014" || o.image === "26015",
    )!;
    s = choose(s, chosen.id);
    s = finish(s);
    expect(s.sideSchemes.some((p) => p.id === side.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === upgrade.id)).toBe(true);
    exact(s, upgrade);
    exact(s, side);
    exact(s, ally);
  });
  it("Joining Forces retains both actual Alliance allies and PUTs the whole pair before Jocasta's entry response", () => {
    let s = base("gam");
    const event = take(s, "26035"),
      jocasta = take(s, "26013"),
      guardian = take(s, "18002", "hand", "p2"),
      defense = take(s, "26012", "discard"),
      a = take(s, "26025"),
      b = take(s, "01089", "hand", "p2");
    s = command(s, { type: "PLAY", id: event.id });
    s = payPrompt(s, [a, b]);
    s = choose(s, `${jocasta.id}|${guardian.id}`);
    expect(thawed(s, jocasta.id)).toBeDefined();
    expect(thawed(s, guardian.id)).toBeDefined();
    s = choose(s, "yes");
    s = choose(s, defense.id);
    s = finish(s);
    expect(thawed(s, jocasta.id).storedCards?.map((p) => p.id)).toEqual([
      defense.id,
    ]);
    expect(thawed(s, guardian.id).ownerId).toBe("p2");
    exact(s, event);
    exact(s, defense);
    exact(s, guardian);
  });
  it("Meditation commits alter-ego exhaustion then plays the actual discounted hand card and restores its parent continuation", () => {
    let s = base();
    const event = take(s, "26036"),
      ally = take(s, "26013"),
      defense = take(s, "26012", "discard");
    s.player.form = "alter";
    s = play(s, event);
    s = choose(s, ally.id);
    s = choose(s, "yes");
    s = choose(s, defense.id);
    s = finish(s);
    expect(s.player.exhausted).toBe(true);
    expect(thawed(s, ally.id).storedCards?.map((p) => p.id)).toEqual([
      defense.id,
    ]);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.flags.discount).toBe(0);
    exact(s, event);
    exact(s, ally);
  });
  it("saved legacy Side Step uses the actual allocated cost and leaves Jocasta exactly once", () => {
    let s = base();
    const ally = take(s, "26013", "inPlay"),
      event = take(s, "14015"),
      mental = take(s, "26026"),
      energy = take(s, "26025");
    stored(s, event, ally);
    const hp = s.player.hp;
    s = attackWindow(s);
    s = byImage(s, "14015");
    expect(thawed(s, ally.id).storedCards?.map((p) => p.id)).toEqual([
      event.id,
    ]);
    s = payPrompt(s, [mental, energy]);
    expect(s.prompt?.title).toBe("Allocate payment resources");
    s = choose(s, "mental");
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(s.villain.hp).toBe(50);
    expect(thawed(s, ally.id).storedCards).toEqual([]);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    exact(s, event);
    exact(s, ally);
  });
  it("Core Backflip is offered from actual Jocasta storage and preserves its ordinary complete prevention", () => {
    let s = base(undefined, "spider_man");
    const ally = take(s, "26013", "inPlay"),
      event = take(s, "01003");
    stored(s, event, ally);
    const hp = s.player.hp;
    s = attackWindow(s);
    s = byImage(s, "01003");
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(thawed(s, ally.id).storedCards).toEqual([]);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    exact(s, event);
  });
  it("Protector payment cancellation resumes the actual nonattack damage without consuming its round limit", () => {
    let s = base();
    const ally = take(s, "26014", "inPlay"),
      mental = take(s, "26020");
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 1,
      source: "consequential",
    });
    s = byImage(s, "26014");
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "CANCEL" });
    s = finish(s);
    expect(thawed(s, ally.id).damage).toBe(1);
    expect(s.flags[`visionPackProtector:${ally.id}`]).toBeUndefined();
    expect(s.player.hand.some((p) => p.id === mental.id)).toBe(true);
    exact(s, mental);
  });
  it("Protector commits its limit before the spent Preservation healing response", () => {
    let s = base();
    const ally = take(s, "26014", "inPlay"),
      resource = take(s, "26021");
    s.player.hp = maxHP(s) - 2;
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 1,
      source: "consequential",
    });
    s = byImage(s, "26014");
    s = payPrompt(s, [resource]);
    expect(s.flags[`visionPackProtector:${ally.id}`]).toBe(s.round);
    expect(thawed(s, ally.id).damage).toBe(0);
    expect(s.prompt?.title).toBe("Preservation");
    s = choose(s, "yes");
    s = finish(s);
    expect(s.player.hp).toBe(maxHP(s) - 1);
    expect(thawed(s, ally.id).damage).toBe(0);
    exact(s, resource);
    exact(s, ally);
  });
  it("Intangible prohibits Defiance during the attack without moving the held event", () => {
    let s = base();
    mass(s).code = "26002";
    const event = take(s, "26018"),
      boost = makePiece(s, "01131");
    s.encounter.deck.unshift(boost);
    s = attackWindow(s);
    expect(!!s.prompt?.options.some((o) => o.image === "26018")).toBe(false);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
    exact(s, event);
    exact(s, boost);
  });
  it("Defiance while an ally defends preserves that actual defender and its attack damage", () => {
    let s = base();
    const ally = take(s, "26022", "inPlay"),
      event = take(s, "26018"),
      hp = s.player.hp;
    s = attackWindow(s, ally.id);
    s = until(s, (v) => v.prompt?.title === "Before revealing boost");
    expect(s.attack?.defender).toBe(ally.id);
    s = byImage(s, "26018");
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(thawed(s, ally.id).damage).toBe(2);
    expect(thawed(s, ally.id).exhausted).toBe(true);
    exact(s, event);
    exact(s, ally);
  });
  it("nested Meditation payment cancellation completes the parent event and removes the temporary discount", () => {
    let s = base();
    const event = take(s, "26036"),
      ally = take(s, "26014"),
      resource = take(s, "26025");
    s.player.form = "alter";
    s = play(s, event);
    s = choose(s, ally.id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(1);
    s = command(s, { type: "CANCEL" });
    s = finish(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === resource.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.flags.discount).toBe(0);
    exact(s, event);
    exact(s, ally);
  });
  it("Jocasta's real leave-play cleanup returns its nested actual Defense card to discard", () => {
    let s = base();
    const ally = take(s, "26013", "inPlay"),
      event = take(s, "26012");
    stored(s, event, ally);
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: pieceHP(s, ally),
      source: "consequential",
    });
    s = finish(s);
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(visionPackStoredPlayable(s)).toEqual([]);
    exact(s, event);
    exact(s, ally);
  });
  it("the table inspection export exposes the real saved ID, current cost and timing restriction", () => {
    const s = base(),
      ally = take(s, "26013", "inPlay"),
      event = take(s, "26012");
    stored(s, event, ally);
    const rows = summarize(s).jocastaDefenseEvents;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: event.id,
      code: event.code,
      cost: 1,
      playable: false,
    });
    expect(rows[0].disabled).toBeTruthy();
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(false);
    expect(paymentSources(s).some((p) => p.id === event.id)).toBe(false);
    exact(s, event);
  });
});
