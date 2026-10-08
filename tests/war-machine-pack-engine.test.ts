/** Independent native review: real source cards, real payment/reveal windows,
 * a JSON round-trip before every command and physical source conservation. */
import { describe, expect, it } from "vitest";
import { card, pieceHP } from "../src/game/cards.js";
import {
  dispatch,
  makePiece,
  newGame,
  playable,
  paymentSources,
  warMachinePackStoredPlayable,
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

type Reviewed = GameState & { warmReviewSource: Record<string, string[]> };
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
  expect((s as Reviewed).warmReviewSource).toBeDefined();
  expect(Object.keys((s as Reviewed).warmReviewSource)).toHaveLength(
    s.players.length,
  );
  for (const [owner, ids] of Object.entries((s as Reviewed).warmReviewSource)) {
    expect(ids).toHaveLength(40);
    for (const id of ids) {
      const found = cards.filter((p) => p.id === id);
      expect(found, `original ${owner}:${id}`).toHaveLength(1);
      expect(found[0].ownerId).toBe(owner);
    }
  }
}
function base(otherHero?: string, hero = "warm") {
  let s = newGame({
    heroId: hero,
    aspect: "leadership",
    villainId: "rhino",
    seed: 23012,
    pacing: "expert",
    ...(otherHero
      ? {
          heroes: [
            { heroId: hero, aspect: "leadership" as const },
            { heroId: otherHero, aspect: "leadership" as const },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  (s as Reviewed).warmReviewSource = Object.fromEntries(
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
function stand(
  s: GameState,
  resources: Piece[],
  pair: string,
  target?: string,
) {
  const option = s.prompt?.options.find(
    (o) => o.image === "23034" && (!target || o.id.endsWith(":" + target)),
  );
  expect(option, JSON.stringify(s.prompt)).toBeTruthy();
  s = choose(s, option!.id);
  s = fund(s, resources);
  expect(s.prompt?.title).toBe("Stand Together · additional cost");
  s = choose(s, pair);
  return finish(s);
}

describe("War Machine supplementary native physical integration", () => {
  it("Black Panther stores an actual discarded Leadership event after ordinary PLAY", () => {
    let s = base();
    const bp = take(s, "23012"),
      event = take(s, "23020", "discard"),
      energy = take(s, "23025"),
      genius = take(s, "23026");
    s = play(s, bp, [energy, genius]);
    s = choose(s, "yes");
    s = choose(s, event.id);
    s = finish(s);
    expect(thawed(s, bp.id).storedCards?.map((p) => p.id)).toEqual([event.id]);
    expect(warMachinePackStoredPlayable(reload(s)).map((p) => p.id)).toEqual([
      event.id,
    ]);
    expect(paymentSources(s).some((p) => p.id === event.id)).toBe(false);
    exact(s, bp);
    exact(s, event);
  });

  it("a stored Make the Call plays with its original physical ID and pays its chosen ally normally", () => {
    let s = base();
    const bp = take(s, "23012", "inPlay"),
      event = take(s, "23020", "discard"),
      falcon = take(s, "23014", "discard"),
      energy = take(s, "23025"),
      genius = take(s, "23026");
    s.player.discard.splice(s.player.discard.indexOf(event), 1);
    bp.storedCards = [event];
    s = play(s, event);
    s = choose(s, falcon.id);
    s = command(s, { type: "PAY", ids: [energy.id, genius.id] });
    s = finish(s);
    expect(thawed(s, bp.id).storedCards).toEqual([]);
    expect(s.player.inPlay.some((p) => p.id === falcon.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    exact(s, event);
    exact(s, falcon);
  });

  it("Sneak Attack opens Panther entry before its physical summoning event is discarded", () => {
    let s = base();
    const sneak = take(s, "23017"),
      bp = take(s, "23012"),
      prior = take(s, "23020", "discard"),
      strength = take(s, "23027");
    s = play(s, sneak, [strength]);
    s = choose(s, bp.id);
    expect(s.resolving.some((p) => p.id === sneak.id)).toBe(true);
    s = choose(s, "yes");
    expect(s.prompt?.options.some((o) => o.id === sneak.id)).toBe(false);
    expect(s.prompt?.options.some((o) => o.id === prior.id)).toBe(true);
    s = choose(s, prior.id);
    s = finish(s);
    expect(s.flags[`warMachinePackSneak:${bp.id}`]).toBe("1:player");
    expect(thawed(s, bp.id).storedCards?.[0].id).toBe(prior.id);
    expect(s.player.discard.some((p) => p.id === sneak.id)).toBe(true);
  });

  it("Summoning Spell finishes before Panther can attach that exact event", () => {
    let s = base(undefined, "warlock");
    const spell = take(s, "21055"),
      resources = [take(s, "01088"), take(s, "01089")],
      bp = top(s, ["23012"])[0];
    s = play(s, spell, resources);
    s = choose(s, "yes");
    expect(s.resolving.some((p) => p.id === spell.id)).toBe(false);
    expect(s.prompt?.options.some((o) => o.id === spell.id)).toBe(true);
    s = choose(s, spell.id);
    s = finish(s);
    expect(thawed(s, bp.id).storedCards?.[0].id).toBe(spell.id);
    exact(s, spell);
  });

  it("Quincarrier's source reprint pays actual resources in alter ego after being played as an Avenger", () => {
    let s = base();
    const quin = take(s, "23023"),
      a = take(s, "23025"),
      b = take(s, "23021");
    s = play(s, quin, [a, b]);
    s = finish(s);
    s = command(s, { type: "FLIP" });
    s = finish(s);
    expect(s.player.form).toBe("alter");
    expect(paymentSources(s).filter((p) => p.id === quin.id)).toHaveLength(1);
    const sneak = take(s, "23017"),
      mockingbird = take(s, "23022");
    s = play(s, sneak, [quin]);
    s = choose(s, mockingbird.id);
    s = finish(s);
    expect(thawed(s, quin.id).exhausted).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === mockingbird.id)).toBe(true);
  });

  it("Innovation can be physically spent on a zero-cost nonattack event before its ally discard cost", () => {
    let s = base();
    const event = take(s, "23019"),
      innovation = take(s, "23021"),
      bp = take(s, "23012", "inPlay"),
      falcon = take(s, "23014", "inPlay");
    bp.damage = 1;
    s.player.stunned = true;
    s = command(s, { type: "PLAY", id: event.id });
    s = choose(s, "spend");
    s = command(s, { type: "PAY", ids: [innovation.id] });
    expect(s.prompt?.title).toBe("Innovation");
    s = choose(s, "yes");
    s = choose(s, bp.id);
    expect(thawed(s, bp.id).damage).toBe(0);
    s = choose(s, falcon.id);
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    expect(s.player.stunned).toBe(true);
    expect(s.player.discard.some((p) => p.id === innovation.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === falcon.id)).toBe(true);
  });

  it("Falcon looks at the original encounter top three and removes threat separately without thwarting", () => {
    let s = base();
    const falcon = take(s, "23014"),
      a = take(s, "23025"),
      b = take(s, "23026"),
      side = makePiece(s, "01107");
    side.counters = 4;
    s.sideSchemes.push(side);
    s.encounter.deck = [
      makePiece(s, "01104"),
      makePiece(s, "01098"),
      makePiece(s, "01104"),
      ...s.encounter.deck,
    ];
    const ids = s.encounter.deck.slice(0, 3).map((p) => p.id);
    s.player.confused = true;
    s = play(s, falcon, [a, b]);
    s = choose(s, "yes");
    s = choose(s, "continue");
    s = choose(s, "main");
    s = choose(s, side.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(11);
    expect(s.sideSchemes[0].counters).toBe(3);
    expect(s.encounter.deck.slice(0, 3).map((p) => p.id)).toEqual(ids);
    expect(s.player.confused).toBe(true);
  });

  it("Captain Marvel stops at the original exhausted deck and counts both printed Energy icons on its one physical card", () => {
    let s = base();
    const ally = take(s, "23013"),
      resources = [take(s, "23026"), take(s, "23027"), take(s, "23021")],
      energy = top(s, ["23025"])[0];
    s.player.hand.push(...s.player.deck.splice(1));
    s.player.stunned = true;
    const dealt = s.encounter.dealt.length;
    s = play(s, ally, resources);
    s = choose(s, "yes");
    expect(s.encounter.dealt).toHaveLength(dealt + 1);
    expect(s.player.deck.map((p) => p.id).sort()).toEqual(
      [...resources.map((p) => p.id), energy.id].sort(),
    );
    expect(s.player.discard).toEqual([]);
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.stunned).toBe(true);
    expect(s.player.deck).toHaveLength(4);
    exact(s, ally);
    exact(s, energy);
  });

  it("Command Team's final actual Use readies a teammate's physical ally and discards its owner support", () => {
    let s = base("gam");
    const support = take(s, "23016"),
      energy = take(s, "23025"),
      ally = take(s, "18019", "inPlay", "p2");
    ally.exhausted = true;
    s = play(s, support, [energy]);
    s = finish(s);
    expect(thawed(s, support.id).counters).toBe(3);
    thawed(s, support.id).counters = 1;
    s = command(s, { type: "ABILITY", id: support.id, action: "command-team" });
    s = choose(s, ally.id);
    s = finish(s);
    expect(
      s.player.discard.some((p) => p.id === support.id && p.ownerId === "p1"),
    ).toBe(true);
    expect(thawed(s, ally.id).exhausted).toBe(false);
  });

  it("Vigilante Training spends its final counter before shuffling the chosen physical Justice event", () => {
    let s = base();
    s.player.form = "alter";
    const support = take(s, "23033"),
      r = take(s, "23025"),
      event = take(s, "22015", "discard");
    s = play(s, support, [r]);
    s = finish(s);
    expect(thawed(s, support.id).counters).toBe(2);
    thawed(s, support.id).counters = 1;
    s = command(s, {
      type: "ABILITY",
      id: support.id,
      action: "vigilante-training",
    });
    s = choose(s, event.id);
    s = finish(s);
    expect(s.player.deck.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === support.id)).toBe(true);
    exact(s, event);
  });

  it("Sidearm transfers its actual physical attachment to a teammate and prevents Retaliate during that ally's attack", () => {
    let s = base("gam");
    const ally = take(s, "23022", "inPlay", "p2"),
      sidearm = take(s, "23035"),
      r = take(s, "23021"),
      whiplash = makePiece(s, "01172");
    whiplash.engagedWith = "p2";
    whiplash.tough = false;
    s.minions.push(whiplash);
    s = play(s, sidearm, [r]);
    s = choose(s, ally.id);
    s = finish(s);
    expect(controller(s, sidearm.id)?.id).toBe("p2");
    expect(thawed(s, sidearm.id).ownerId).toBe("p1");
    s = command(s, { type: "END_TURN" });
    s = finish(s);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = choose(s, whiplash.id);
    s = finish(s);
    expect(thawed(s, ally.id).damage).toBe(1);
    expect(s.minions.find((p) => p.id === whiplash.id)?.damage).toBe(2);
    take(s, "23025");
    expect(thawed(s, sidearm.id).attachedTo).toBe(ally.id);
    const extraSidearm = {
      ...makePiece(s, "23035"),
      ownerId: s.activePlayerId,
    };
    s.player.hand.push(extraSidearm);
    expect(playable(s, extraSidearm)).toMatch(/Sidearm needs/i);
    exact(s, sidearm);
  });

  for (const action of ["attack", "thwart"] as const)
    it(`Goliath retains native basic ${action} while its printed Action is available`, () => {
      let s = base();
      const goliath = take(s, "23015", "inPlay");
      s.scheme.threat = 3;
      const hp = s.villain.hp;
      s = command(s, { type: "ABILITY", id: goliath.id, action });
      if (s.prompt) s = choose(s, action === "attack" ? s.villain.id : "main");
      s = finish(s);
      expect(thawed(s, goliath.id).exhausted).toBe(true);
      expect(thawed(s, goliath.id).damage).toBe(action === "attack" ? 2 : 1);
      expect(s.player.inPlay.some((p) => p.id === goliath.id)).toBe(true);
      expect(s.flags.hawkeyeGoliathPhase).toBeUndefined();
      if (action === "attack") expect(s.villain.hp).toBeLessThan(hp);
      else expect(s.scheme.threat).toBeLessThan(3);
      exact(s, goliath);
    });

  it("Goliath's global phase maximum shares the original printing and discards the new actual source at phase end", () => {
    let s = base();
    const goliath = take(s, "23015", "inPlay"),
      original = take(s, "04013", "inPlay");
    s = command(s, { type: "ABILITY", id: goliath.id, action: "goliath" });
    s = finish(s);
    expect(thawed(s, goliath.id).bonusAtk).toBe(4);
    const refused = dispatch(reload(s), {
      type: "ABILITY",
      id: original.id,
      action: "goliath",
    });
    expect(refused.error).toBeTruthy();
    s = native(s, { type: "beginVillain" });
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === goliath.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === goliath.id)).toBe(true);
    exact(s, goliath);
  });
});

describe("Native Alliance costs and Stand Together attack provenance", () => {
  it("a paid Stand protects a teammate without changing the actual defender or creating another attack", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "23026");
    const hp = seatView(s, "p2").player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" });
    s = choose(s, "take");
    s = stand(s, [a, b], "hero:p1|hero:p2", "hero:p2");
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(s.villain.hp).toBe(48);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === event.id),
    ).toBe(true);
    exact(s, event);
    exact(s, a);
    exact(s, b);
  });

  it("Alliance commits the actual teammate resource card and donor response before resolving Stand", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "23026", "hand", "p2");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = stand(s, [a, b], "hero:p1|hero:p2");
    expect(seatView(s, "p1").player.discard.some((p) => p.id === a.id)).toBe(
      true,
    );
    expect(seatView(s, "p2").player.discard.some((p) => p.id === b.id)).toBe(
      true,
    );
    expect(seatView(s, "p1").player.discard.some((p) => p.id === b.id)).toBe(
      false,
    );
    expect(s.villain.hp).toBe(48);
    exact(s, b);
    exact(s, event);
  });

  it("Stand's discounted actual cost is three and its one reflection ignores the event owner's Stun", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "23021");
    s.flags.discount = 1;
    s.player.stunned = true;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    const option = s.prompt?.options.find((o) => o.image === "23034")!;
    s = choose(s, option.id);
    expect(s.prompt?.cost).toBe(3);
    s = fund(s, [a, b]);
    s = choose(s, "hero:p1|hero:p2");
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(seatView(s, "p1").player.stunned).toBe(true);
    exact(s, event);
  });

  it("a Tough recipient offers no would-TAKE Stand and keeps the physical event and resources in hand", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "23026");
    s.player.tough = true;
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(!!s.prompt?.options.some((o) => o.image === "23034")).toBe(false);
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    exact(s, a);
    exact(s, b);
  });

  it("a defended Retaliate ally remains the attacked character when another hero plays Stand", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "23026"),
      charlie = take(s, "21059", "inPlay", "p2");
    charlie.tough = false;
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" });
    s = choose(s, charlie.id);
    s = stand(s, [a, b], "hero:p1|hero:p2", charlie.id);
    expect(thawed(s, charlie.id).damage).toBe(0);
    expect(s.villain.hp).toBe(47);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    exact(s, event);
  });

  it("reflection defeating the physical attacking minion aborts its damage and completed-attack count", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "23026"),
      minion = makePiece(s, "01103");
    minion.engagedWith = "p1";
    minion.tough = false;
    s.minions.push(minion);
    minion.damage = pieceHP(s, minion) - 2;
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: minion.id });
    s = choose(s, "take");
    s = stand(s, [a, b], "hero:p1|hero:p2");
    expect(s.minions.some((p) => p.id === minion.id)).toBe(false);
    expect(s.player.hp).toBe(hp);
    expect(s.enemyAttackCounts?.[minion.id] || 0).toBe(0);
    expect(s.attack).toBeNull();
    exact(s, event);
    exact(s, minion);
  });

  it("As One pays an actual donor resource and exhausts two physical characters for one attack", () => {
    let s = base("gam");
    const event = take(s, "23032"),
      resource = take(s, "23025", "hand", "p2");
    s = command(s, { type: "PLAY", id: event.id });
    s = fund(s, [resource]);
    s = choose(s, "hero:p1|hero:p2");
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === resource.id),
    ).toBe(true);
    exact(s, event);
  });

  it("Stun replaces As One only after Alliance resource and exhaustion costs are committed", () => {
    let s = base("gam");
    const event = take(s, "23032"),
      resource = take(s, "23025", "hand", "p2");
    s.player.stunned = true;
    s = command(s, { type: "PLAY", id: event.id });
    s = fund(s, [resource]);
    s = choose(s, "hero:p1|hero:p2");
    s = finish(s);
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    exact(s, resource);
    exact(s, event);
  });

  it("a donor's spent Innovation heals only that donor's ally before Stand's exhaustion cost", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "01089", "hand", "p2"),
      innovation = take(s, "23021", "hand", "p2");
    const ownAlly = take(s, "23012", "inPlay"),
      donorAlly = take(s, "18019", "inPlay", "p2");
    ownAlly.damage = donorAlly.damage = 1;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    const option = s.prompt!.options.find((o) => o.image === "23034")!;
    s = choose(s, option.id);
    s = fund(s, [a, b, innovation]);
    expect(s.prompt?.title).toBe("Innovation");
    s = choose(s, "yes");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([donorAlly.id]);
    s = choose(s, donorAlly.id);
    expect(thawed(s, donorAlly.id).damage).toBe(0);
    expect(thawed(s, ownAlly.id).damage).toBe(1);
    expect(s.prompt?.title).toBe("Stand Together · additional cost");
    s = choose(s, "hero:p1|hero:p2");
    s = finish(s);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === innovation.id),
    ).toBe(true);
    exact(s, innovation);
    exact(s, event);
  });

  it("an empty donor deck resets once after both actual contributed cards are committed", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "01089", "hand", "p2"),
      innovation = take(s, "23021", "hand", "p2");
    const donor = seatView(s, "p2").player;
    donor.hand.push(...donor.deck.splice(0));
    const rng = s.seed,
      dealt = s.encounter.dealt.length;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = stand(s, [a, b, innovation], "hero:p1|hero:p2");
    expect(
      seatView(s, "p2")
        .player.deck.map((p) => p.id)
        .sort(),
    ).toEqual([b.id, innovation.id].sort());
    expect(seatView(s, "p2").player.discard).toEqual([]);
    expect(s.encounter.dealt).toHaveLength(dealt + 1);
    expect(s.encounter.dealt.at(-1)?.dealtTo).toBe("p2");
    expect(s.seed).not.toBe(rng);
    exact(s, b);
    exact(s, innovation);
    exact(s, event);
  });

  it("Stand reflects only the damage remaining after Groot's actual growth prevention", () => {
    let s = base("groot");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "23026");
    seatView(s, "p2").flags.grootGrowthCounters = 2;
    s.encounter.deck.unshift(makePiece(s, "01118"));
    const hp = seatView(s, "p2").player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" });
    s = choose(s, "take");
    s = stand(s, [a, b], "hero:p1|hero:p2", "hero:p2");
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(seatView(s, "p2").flags.grootGrowthCounters).toBe(0);
    expect(s.villain.hp).toBe(47);
    exact(s, event);
  });

  it("Stand can prevent only an ally attack's Overkill spill while the actual ally remains the defender", () => {
    let s = base("gam");
    const event = take(s, "23034"),
      a = take(s, "23025"),
      b = take(s, "23026"),
      charlie = take(s, "21059", "inPlay", "p2");
    charlie.tough = false;
    charlie.damage = 3;
    const charge = makePiece(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    const hp = seatView(s, "p2").player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" });
    s = choose(s, charlie.id);
    s = stand(s, [a, b], "hero:p1|hero:p2", "hero:p2");
    expect(seatView(s, "p2").player.hp).toBe(hp);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === charlie.id),
    ).toBe(true);
    expect(s.villain.hp).toBe(46);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    exact(s, charlie);
    exact(s, event);
  });

  it("As One may exhaust an actual qualifying alter ego whose unprinted ATK contributes zero", () => {
    let s = base("gam");
    const event = take(s, "23032"),
      resource = take(s, "01088", "hand", "p2"),
      honorary = take(s, "22035", "inPlay", "p2");
    honorary.attachedTo = "hero:p2";
    seatView(s, "p2").player.form = "alter";
    s = command(s, { type: "PLAY", id: event.id });
    s = fund(s, [resource]);
    expect(s.prompt?.options.some((o) => o.id === "hero:p1|hero:p2")).toBe(
      true,
    );
    s = choose(s, "hero:p1|hero:p2");
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    expect(seatView(s, "p2").player.form).toBe("alter");
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    exact(s, honorary);
    exact(s, event);
  });

  it("As One uses current ally modifiers for one Overkill attack without ally Stun or consequential damage", () => {
    let s = base("gam");
    const event = take(s, "23032"),
      resource = take(s, "01088", "hand", "p2"),
      avenger = take(s, "23013", "inPlay"),
      guardian = take(s, "21059", "inPlay", "p2");
    const sidearm = take(s, "23035", "inPlay", "p2");
    sidearm.attachedTo = guardian.id;
    guardian.tough = false;
    guardian.bonusAtk = 2;
    avenger.stunned = guardian.stunned = true;
    const minion = makePiece(s, "01101");
    minion.engagedWith = "p1";
    s.minions.push(minion);
    s = command(s, { type: "PLAY", id: event.id });
    s = fund(s, [resource]);
    s = choose(s, `${avenger.id}|${guardian.id}`);
    s = choose(s, minion.id);
    s = finish(s);
    expect(s.minions.some((p) => p.id === minion.id)).toBe(false);
    expect(s.villain.hp).toBe(46);
    expect(thawed(s, avenger.id).damage).toBe(0);
    expect(thawed(s, guardian.id).damage).toBe(0);
    expect(thawed(s, avenger.id).stunned).toBe(true);
    expect(thawed(s, guardian.id).stunned).toBe(true);
    expect(thawed(s, avenger.id).exhausted).toBe(true);
    expect(thawed(s, guardian.id).exhausted).toBe(true);
    exact(s, minion);
    exact(s, event);
  });

  it("Alliance respects a teammate's restricted Gauntlet and commits its legal Quincarrier source", () => {
    let s = base("gam");
    const event = take(s, "23032", "hand", "p2"),
      gauntlet = take(s, "23005", "inPlay"),
      quin = take(s, "23023", "inPlay"),
      resource = take(s, "23021");
    const ammo = Number(s.flags.warMachineAmmo || 0);
    activateSeat(s, "p2");
    s = command(s, { type: "PLAY", id: event.id });
    expect(
      paymentSources(s, event.id, event.code, false, true).some(
        (p) => p.localId === gauntlet.id,
      ),
    ).toBe(false);
    s = fund(s, [resource, quin]);
    expect(thawed(s, gauntlet.id).exhausted).toBe(false);
    expect(thawed(s, quin.id).exhausted).toBe(true);
    expect(Number(seatView(s, "p1").flags.warMachineAmmo || 0)).toBe(ammo);
    expect(seatView(s, "p2").flags.warMachineAmmo).toBeUndefined();
    s = choose(s, "hero:p1|hero:p2");
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    exact(s, event);
    exact(s, gauntlet);
    exact(s, quin);
  });

  it("Alliance qualifies a teammate's Scientist source and commits its own alter ego flag", () => {
    let s = base("spider_man");
    const event = take(s, "23032"),
      resource = take(s, "23021"),
      honorary = take(s, "22035", "inPlay", "p2");
    honorary.attachedTo = "hero:p2";
    seatView(s, "p2").player.form = "alter";
    s = command(s, { type: "PLAY", id: event.id });
    const sources = paymentSources(
      s,
      s.prompt!.card?.id,
      s.prompt!.paymentTarget,
      false,
      true,
    );
    const scientist = sources.find(
      (p) => p.localId === "scientist" && p.playerId === "p2",
    )!;
    expect(scientist?.id).toBe("alliance:p2:scientist");
    s = command(s, { type: "PAY", ids: [resource.id, scientist.id] });
    expect(seatView(s, "p2").flags.scientist).toBe(true);
    expect(seatView(s, "p1").flags.scientist).toBeUndefined();
    s = choose(s, "hero:p1|hero:p2");
    s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(48);
    exact(s, event);
    exact(s, honorary);
  });

  it("Sneak rejects funding with its only eligible ally before any physical cost is spent", () => {
    const s = base(),
      sneak = take(s, "23017"),
      bp = take(s, "23012");
    expect(playable(s, sneak)).toMatch(/retain.*ally/);
    const refused = dispatch(reload(s), { type: "PLAY", id: sneak.id });
    expect(refused.error).toMatch(/retain.*ally/);
    expect(refused.player.hand.map((p) => p.id).sort()).toEqual(
      [sneak.id, bp.id].sort(),
    );
    expect(refused.player.discard).toEqual([]);
    conserved(refused);
  });

  it("a selected payment cannot spend Sneak's last eligible ally even when another valid funding plan exists", () => {
    let s = base();
    const sneak = take(s, "23017"),
      bp = take(s, "23012"),
      r = take(s, "23025");
    s = command(s, { type: "PLAY", id: sneak.id });
    const refused = dispatch(reload(s), { type: "PAY", ids: [bp.id] });
    expect(refused.error).toMatch(/Keep an eligible ally/);
    expect(refused.player.hand.some((p) => p.id === bp.id)).toBe(true);
    expect(refused.player.hand.some((p) => p.id === r.id)).toBe(true);
    s = fund(s, [r]);
    s = choose(s, bp.id);
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === bp.id)).toBe(true);
  });

  it("a discounted zero-cost Sneak keeps its sole eligible hand ally and puts that physical piece", () => {
    let s = base();
    const sneak = take(s, "23017"),
      bp = take(s, "23012");
    s.flags.discount = 1;
    expect(playable(s, sneak)).toBeNull();
    s = play(s, sneak);
    s = choose(s, bp.id);
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === bp.id)).toBe(true);
    exact(s, sneak);
    exact(s, bp);
  });
});
