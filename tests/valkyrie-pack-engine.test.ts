/** Independent Valkyrie supplementary native review: real source cards, real payment/reveal windows,
 * a JSON round-trip before every command and physical source conservation. */
import { describe, expect, it } from "vitest";
import { card, pieceHP, heroStats, maxHP } from "../src/game/cards.js";
import {
  dispatch,
  makePiece,
  newGame,
  playable,
  paymentSources,
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

type ValkReviewed = GameState & { valkReviewSource: Record<string, string[]> };
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
  expect((s as ValkReviewed).valkReviewSource).toBeDefined();
  expect(Object.keys((s as ValkReviewed).valkReviewSource)).toHaveLength(
    s.players.length,
  );
  for (const [owner, ids] of Object.entries(
    (s as ValkReviewed).valkReviewSource,
  )) {
    expect(ids).toHaveLength(seatView(s, owner).heroId === "valk" ? 41 : 40);
    for (const id of ids) {
      const found = cards.filter((p) => p.id === id);
      expect(found, `original ${owner}:${id}`).toHaveLength(1);
      expect(found[0].ownerId).toBe(owner);
    }
  }
}
function base(otherHero?: string, hero = "valk") {
  let s = newGame({
    heroId: hero,
    aspect: "aggression",
    villainId: "rhino",
    seed: 25013,
    pacing: "expert",
    ...(otherHero
      ? {
          heroes: [
            { heroId: hero, aspect: "aggression" as const },
            { heroId: otherHero, aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  (s as ValkReviewed).valkReviewSource = Object.fromEntries(
    s.players.map((seat) => {
      const p = seatView(s, seat).player,
        source = [
          ...p.deck,
          ...p.hand,
          ...p.discard,
          ...p.inPlay,
          ...(p.setAside || []),
        ].filter((p) => card(p).faction_code !== "encounter");
      expect(source).toHaveLength(seat.heroId === "valk" ? 41 : 40);
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

describe("Valkyrie supplementary native physical integration", () => {
  it("retains all 41 original physical cards while Death-Glow setup leaves 40 playing cards", () => {
    const s = base();
    conserved(s);
    expect(s.player.setAside?.filter((p) => p.code === "25002")).toHaveLength(
      1,
    );
    expect([
      ...s.player.deck,
      ...s.player.hand,
      ...s.player.discard,
      ...s.player.inPlay,
    ]).toHaveLength(40);
  });

  it("Throg's actual PLAY entry response gives Tough only while its controller is engaged", () => {
    let s = base();
    const minion = enemy(s),
      ally = take(s, "25014"),
      resource = take(s, "25025");
    s = play(s, ally, [resource]);
    s = choose(s, "yes");
    s = finish(s);
    expect(thawed(s, ally.id).tough).toBe(true);
    exact(s, minion);
    exact(s, ally);
  });

  it("Angela puts the exact searched encounter minion without revealing its When Revealed damage", () => {
    let s = base();
    const ally = take(s, "25015"),
      minion = makePiece(s, "01103");
    s.encounter.deck.unshift(minion);
    const hp = s.player.hp,
      hidden = s.hiddenInfo || 0;
    s = play(s, ally);
    expect(s.prompt?.title).toBe("Angela");
    s = choose(s, minion.id);
    s = finish(s);
    expect(s.player.hp).toBe(hp);
    expect(s.minions.find((p) => p.id === minion.id)?.engagedWith).toBe("p1");
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    exact(s, ally);
    exact(s, minion);
  });

  it("Angela with no original top-ten minion shuffles and discards that physical ally", () => {
    let s = base();
    const ally = take(s, "25015"),
      seed = s.seed;
    s = play(s, ally);
    s = finish(s);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.seed).not.toBe(seed);
    exact(s, ally);
  });

  it("Hall of Heroes adds actual glory only for the controller's identity defeat and spends three before drawing", () => {
    let s = base();
    const hall = take(s, "25016", "inPlay"),
      minion = enemy(s);
    hall.counters = 0;
    minion.damage = 1;
    s = useHeroAttack(s, minion.id);
    s = respond(s, "25016");
    s = finish(s);
    expect(thawed(s, hall.id).counters).toBe(1);
    thawed(s, hall.id).counters = 3;
    s.player.form = "alter";
    const hand = s.player.hand.length;
    s = command(s, { type: "ABILITY", id: hall.id, action: "hall-of-heroes" });
    s = finish(s);
    expect(thawed(s, hall.id).counters).toBe(0);
    expect(thawed(s, hall.id).exhausted).toBe(true);
    expect(s.player.hand).toHaveLength(hand + 3);
    exact(s, hall);
    exact(s, minion);
  });

  it("Quick Strike uses current target-specific Dragonfang ATK but does not perform a basic attack", () => {
    let s = base();
    const weapon = take(s, "25006", "inPlay"),
      event = take(s, "25018"),
      resource = take(s, "25025"),
      minion = enemy(s, "01184");
    const actualGlow = glow(s, minion.id);
    const atk = heroStats(s).attack;
    s = play(s, event, [resource]);
    s = choose(s, minion.id);
    s = finish(s);
    expect(s.minions.find((p) => p.id === minion.id)?.damage).toBe(atk + 1);
    expect(s.player.exhausted).toBe(false);
    expect(s.flags.basicAttack).toBe(false);
    exact(s, event);
    exact(s, weapon);
    exact(s, actualGlow);
  });

  it("Smash the Problem captures ordinary ATK and excludes Dragonfang's attacking-only extra", () => {
    let s = base();
    const weapon = take(s, "25006", "inPlay"),
      event = take(s, "25019"),
      resource = take(s, "25025"),
      actualGlow = glow(s, s.villain.id);
    const atk = heroStats(s).attack;
    s = play(s, event, [resource]);
    s = choose(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(12 - atk);
    expect(s.player.exhausted).toBe(true);
    exact(s, event);
    exact(s, actualGlow);
    exact(s, weapon);
  });

  it("Confuse replaces Smash only after its printed exhaustion cost and physical resource are paid", () => {
    let s = base();
    const event = take(s, "25019"),
      resource = take(s, "25025");
    s.player.confused = true;
    s = play(s, event, [resource]);
    s = finish(s);
    expect(s.player.confused).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.scheme.threat).toBe(12);
    expect(s.player.discard.some((p) => p.id === resource.id)).toBe(true);
    exact(s, event);
  });

  it("The Bifrost plays its actual deck ally with paid resources and shuffles after entry", () => {
    let s = base();
    const bifrost = take(s, "25023", "inPlay"),
      ally = top(s, ["25014"])[0],
      resource = take(s, "25025"),
      minion = enemy(s),
      seed = s.seed;
    s = command(s, { type: "ABILITY", id: bifrost.id, action: "bifrost" });
    s = choose(s, ally.id);
    s = payPrompt(s, [resource]);
    s = choose(s, "yes");
    s = finish(s);
    expect(thawed(s, bifrost.id).exhausted).toBe(true);
    expect(thawed(s, ally.id).tough).toBe(true);
    expect(s.seed).not.toBe(seed);
    expect(s.player.deck.some((p) => p.id === ally.id)).toBe(false);
    exact(s, ally);
    exact(s, resource);
    exact(s, minion);
  });

  it("canceling Bifrost's paid deck play keeps its exact ally in deck and still performs the printed shuffle", () => {
    let s = base();
    const bifrost = take(s, "25023", "inPlay"),
      ally = top(s, ["25014"])[0],
      resource = take(s, "25025");
    s = command(s, { type: "ABILITY", id: bifrost.id, action: "bifrost" });
    s = choose(s, ally.id);
    const seed = s.seed;
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "CANCEL" });
    s = finish(s);
    expect(thawed(s, bifrost.id).exhausted).toBe(true);
    expect(s.player.deck.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === resource.id)).toBe(true);
    expect(s.seed).not.toBe(seed);
    exact(s, ally);
  });

  it("Godlike Stamina heals in alter ego and discards exactly one chosen actual status card", () => {
    let s = base();
    const event = take(s, "25024");
    s.player.form = "alter";
    s.player.hp = maxHP(s) - 3;
    s.player.stunCards = 2;
    s.player.stunned = true;
    s = play(s, event);
    s = choose(s, "stunned");
    s = finish(s);
    expect(s.player.hp).toBe(maxHP(s) - 1);
    expect(s.player.stunCards).toBe(1);
    expect(s.player.stunned).toBe(true);
    exact(s, event);
  });

  it("Audacity may fund zero-cost Godlike Stamina and resolves its actual spend response before healing", () => {
    let s = base();
    const event = take(s, "25024"),
      audacity = take(s, "25021");
    s.player.hp = maxHP(s) - 2;
    s.player.stunned = true;
    s = command(s, { type: "PLAY", id: event.id });
    s = choose(s, "spend");
    s = payPrompt(s, [audacity]);
    expect(s.prompt?.title).toBe("Audacity");
    s = choose(s, "yes");
    expect(s.villain.hp).toBe(49);
    s = choose(s, "none");
    s = finish(s);
    expect(s.player.hp).toBe(maxHP(s));
    expect(s.player.stunned).toBe(true);
    exact(s, event);
    exact(s, audacity);
  });

  it("Anticipation pays its physical discard to ready before an Angela PUT minion's Quickstrike attack", () => {
    let s = base();
    const ally = take(s, "25015"),
      anticipation = take(s, "25035", "inPlay"),
      minion = makePiece(s, "01167");
    s.player.exhausted = true;
    s.encounter.deck.unshift(minion);
    s = play(s, ally);
    s = choose(s, minion.id);
    expect(s.prompt?.title).toBe("Minion engagement interrupts");
    s = choose(s, anticipation.id);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === anticipation.id)).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(true);
    s = choose(s, "hero");
    s = finish(s);
    expect(s.player.exhausted).toBe(true);
    exact(s, anticipation);
    exact(s, minion);
    exact(s, ally);
  });

  it("Leadership Training spends its last Use before returning an actual Leadership event to deck", () => {
    let s = base();
    const support = take(s, "25034"),
      event = take(s, "23017", "discard"),
      resource = take(s, "25025");
    s.player.form = "alter";
    s = play(s, support, [resource]);
    s = finish(s);
    expect(thawed(s, support.id).counters).toBe(2);
    thawed(s, support.id).counters = 1;
    s = command(s, {
      type: "ABILITY",
      id: support.id,
      action: "leadership-training",
    });
    s = choose(s, event.id);
    s = finish(s);
    expect(s.player.discard.some((p) => p.id === support.id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === event.id)).toBe(true);
    exact(s, support);
    exact(s, event);
  });

  it("Anticipation also interrupts an actual engagement transfer without replaying Quickstrike", () => {
    let s = base("gam");
    const event = take(s, "06014"),
      anticipation = take(s, "25035", "inPlay"),
      mount = take(s, "25007", "inPlay"),
      minion = enemy(s, "01167", "p2");
    s.player.exhausted = true;
    const hp = s.player.hp;
    s = play(s, event);
    expect(s.prompt?.title).toBe("Minion engagement interrupts");
    expect(s.minions.find((p) => p.id === minion.id)?.engagedWith).toBe("p1");
    s = choose(s, anticipation.id);
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hp).toBe(hp);
    expect(s.minions.find((p) => p.id === minion.id)?.damage).toBe(1);
    expect(s.player.discard.some((p) => p.id === anticipation.id)).toBe(true);
    exact(s, event);
    exact(s, anticipation);
    exact(s, mount);
    exact(s, minion);
  });

  it("Problem Solvers uses Alliance resources and one simultaneous modified-THW removal from each scheme", () => {
    let s = base("gam");
    const event = take(s, "25033"),
      a = take(s, "25025"),
      b = take(s, "01089", "hand", "p2"),
      sideA = makePiece(s, "01107"),
      sideB = makePiece(s, "01109");
    sideA.counters = 3;
    sideB.counters = 6;
    s.sideSchemes.push(sideA, sideB);
    const thw = heroStats(s).thwart + heroStats(seatView(s, "p2")).thwart;
    s = command(s, { type: "PLAY", id: event.id });
    s = payPrompt(s, [a, b]);
    s = choose(s, "hero:p1|hero:p2");
    s = finish(s);
    expect(s.scheme.threat).toBe(12 - thw);
    expect(s.sideSchemes.some((p) => p.id === sideA.id)).toBe(false);
    expect(s.sideSchemes.find((p) => p.id === sideB.id)?.counters).toBe(
      6 - thw,
    );
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.discard.some((p) => p.id === b.id)).toBe(
      true,
    );
    exact(s, event);
    exact(s, sideA);
    exact(s, sideB);
  });

  it("Problem Solvers may exhaust a real Guardian alter ego whose unprinted THW contributes zero", () => {
    let s = base("gam");
    const event = take(s, "25033"),
      a = take(s, "25025"),
      b = take(s, "01089", "hand", "p2"),
      honorary = take(s, "22035", "inPlay", "p2");
    honorary.attachedTo = "hero:p2";
    seatView(s, "p2").player.form = "alter";
    const actualThwart = heroStats(s).thwart;
    s = command(s, { type: "PLAY", id: event.id });
    s = payPrompt(s, [a, b]);
    s = choose(s, "hero:p1|hero:p2");
    s = finish(s);
    expect(s.scheme.threat).toBe(12 - actualThwart);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.form).toBe("alter");
    exact(s, event);
    exact(s, honorary);
    exact(s, b);
  });

  it("Problem Solvers obeys Crisis for its whole simultaneous scheme snapshot", () => {
    let s = base("gam");
    const event = take(s, "25033"),
      a = take(s, "25025"),
      b = take(s, "01089", "hand", "p2"),
      crisis = makePiece(s, "01108"),
      other = makePiece(s, "01109");
    crisis.counters = 3;
    other.counters = 3;
    s.sideSchemes.push(crisis, other);
    s = command(s, { type: "PLAY", id: event.id });
    s = payPrompt(s, [a, b]);
    s = choose(s, "hero:p1|hero:p2");
    s = finish(s);
    expect(s.scheme.threat).toBe(12);
    expect(s.sideSchemes).toEqual([]);
    exact(s, event);
    exact(s, crisis);
    exact(s, other);
  });

  it("Problem Solvers completes every scheme removal before offering its real Turn the Tide hero response", () => {
    let s = base("gam");
    const event = take(s, "25033"),
      a = take(s, "25025"),
      b = take(s, "01089", "hand", "p2"),
      tide = take(s, "15015"),
      side = makePiece(s, "01107");
    side.counters = 3;
    s.sideSchemes.push(side);
    s = command(s, { type: "PLAY", id: event.id });
    s = payPrompt(s, [a, b]);
    s = choose(s, "hero:p1|hero:p2");
    expect(s.scheme.threat).toBe(9);
    expect(s.sideSchemes.some((p) => p.id === side.id)).toBe(false);
    expect(s.prompt?.title).toBe("Turn the Tide");
    s = choose(s, tide.id);
    if (s.prompt?.options.some((o) => o.id === s.villain.id))
      s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    exact(s, event);
    exact(s, tide);
    exact(s, side);
  });

  it("Problem Solvers belongs to the actual event-playing Gamora and offers Precision after the whole thwart", () => {
    let s = base("valk", "gam");
    const event = take(s, "25033"),
      a = take(s, "01088"),
      b = take(s, "25026", "hand", "p2");
    s = command(s, { type: "PLAY", id: event.id });
    s = payPrompt(s, [a, b]);
    s = choose(s, "hero:p2|hero:p1");
    expect(s.scheme.threat).toBe(9);
    expect(s.prompt?.title).toBe("Gamora · after playing an event");
    s = choose(s, "precision");
    if (s.prompt?.options.some((o) => o.id === s.villain.id))
      s = choose(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(49);
    expect(s.flags.gamoraPrecisionPhase).toBeDefined();
    exact(s, event);
    exact(s, b);
  });

  it("Confuse replaces Problem Solvers once after all Alliance resource and exhaustion costs", () => {
    let s = base("gam");
    const event = take(s, "25033"),
      a = take(s, "25025"),
      b = take(s, "01089", "hand", "p2");
    s.player.confused = true;
    s = command(s, { type: "PLAY", id: event.id });
    s = payPrompt(s, [a, b]);
    s = choose(s, "hero:p1|hero:p2");
    s = finish(s);
    expect(s.scheme.threat).toBe(12);
    expect(s.player.confused).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    exact(s, event);
    exact(s, b);
  });

  it("The Best Defense persists through boosts and recalculates current ordinary ATK after an actual modifier leaves", () => {
    let s = base();
    const event = take(s, "25020"),
      secondBest = take(s, "25020"),
      expert = take(s, "03033"),
      secondExpert = { ...makePiece(s, "03033"), ownerId: s.activePlayerId },
      fang = take(s, "25006", "inPlay"),
      spear = take(s, "25005", "inPlay"),
      training = take(s, "25017", "inPlay"),
      actualGlow = glow(s, s.villain.id);
    s.player.hand.push(secondExpert);
    s.encounter.deck.unshift(makePiece(s, "01118"));
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    expect(s.prompt?.title).toBe("Defense interrupts");
    s = choose(s, expert.id);
    s = choose(s, event.id);
    expect(s.attack?.valkyriePackAttackDefensePlayerId).toBe("p1");
    expect(s.attack?.defense).toBe(4);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.attack?.defenseBonus).toBe(3);
    expect(s.prompt?.options.some((o) => o.id === secondBest.id)).toBe(false);
    s = native(
      s,
      { type: "discardPiece", id: training.id },
      { type: "boostAttack", expertChecked: true },
    );
    s = finish(s);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.exhausted).toBe(true);
    exact(s, event);
    exact(s, fang);
    exact(s, spear);
    exact(s, training);
    exact(s, actualGlow);
  });

  it("Thor's paid interrupt resolves ordered targets as one attack with one consequential damage payment", () => {
    let s = base("gam");
    const ally = take(s, "25013", "inPlay"),
      resource = take(s, "25025"),
      first = enemy(s, "01103"),
      second = enemy(s, "01110"),
      third = enemy(s, "01172", "p2");
    ally.tough = false;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = choose(s, first.id);
    expect(s.prompt?.title).toBe("Thor attack interrupts");
    s = choose(s, "thor-attack-each");
    s = payPrompt(s, [resource]);
    s = choose(s, second.id);
    s = choose(s, first.id);
    s = finish(s);
    expect(s.minions.some((p) => p.id === first.id)).toBe(false);
    expect(s.minions.some((p) => p.id === second.id)).toBe(false);
    expect(s.minions.find((p) => p.id === third.id)?.damage).toBe(0);
    expect(thawed(s, ally.id).damage).toBe(2);
    expect(thawed(s, ally.id).exhausted).toBe(true);
    exact(s, ally);
    exact(s, first);
    exact(s, second);
    exact(s, third);
    exact(s, resource);
  });

  it("Thor orders an actual saved Ultron Drone by its public name and returns its original captured source exactly once", () => {
    let s = base();
    const ally = take(s, "25013", "inPlay"),
      resource = take(s, "25025"),
      other = enemy(s, "01103"),
      captured = s.player.deck[0];
    ally.tough = false;
    s = finish(native(s, { type: "drone" }));
    const drone = s.minions.find((p) => p.code === "drone")!;
    expect(card(drone).name).toBe("Ultron Drone");
    expect(drone.droneCard?.id).toBe(captured.id);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = choose(s, drone.id);
    s = choose(s, "thor-attack-each");
    s = payPrompt(s, [resource]);
    expect(s.prompt?.options).toContainEqual(
      expect.objectContaining({
        id: drone.id,
        image: "drone",
        label: "Ultron Drone",
      }),
    );
    expect(s.prompt?.options.some((o) => o.id === captured.id)).toBe(false);
    expect(s.minions.find((p) => p.id === drone.id)?.droneCard?.id).toBe(
      captured.id,
    );
    conserved(reload(s));
    s = choose(s, other.id);
    s = choose(s, drone.id);
    s = finish(s);
    expect(s.minions.some((p) => [drone.id, other.id].includes(p.id))).toBe(
      false,
    );
    expect(s.player.discard.filter((p) => p.id === captured.id)).toHaveLength(
      1,
    );
    expect(thawed(s, ally.id).damage).toBe(2);
    expect(thawed(s, ally.id).exhausted).toBe(true);
    exact(s, ally);
    exact(s, resource);
    exact(s, captured);
    conserved(s);
  });
  it("Thor completes all target damage before surviving enemy Retaliate can defeat its physical attacker", () => {
    let s = base();
    const ally = take(s, "25013", "inPlay"),
      resource = take(s, "25025"),
      retaliating = enemy(s, "01184"),
      other = enemy(s, "01181");
    ally.tough = false;
    ally.damage = 1;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = choose(s, retaliating.id);
    s = choose(s, "thor-attack-each");
    s = payPrompt(s, [resource]);
    s = choose(s, retaliating.id);
    s = choose(s, other.id);
    s = finish(s);
    expect(s.minions.find((p) => p.id === retaliating.id)?.damage).toBe(3);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(3);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    exact(s, ally);
    exact(s, retaliating);
    exact(s, other);
  });

  it("Thor's Stun replaces the basic attack without offering or paying the energy interrupt", () => {
    let s = base();
    const ally = take(s, "25013", "inPlay"),
      resource = take(s, "25025"),
      minion = enemy(s);
    ally.stunned = true;
    ally.tough = false;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(s);
    expect(thawed(s, ally.id).stunned).toBe(false);
    expect(thawed(s, ally.id).damage).toBe(0);
    expect(s.minions.find((p) => p.id === minion.id)?.damage).toBe(0);
    expect(s.player.hand.some((p) => p.id === resource.id)).toBe(true);
    exact(s, ally);
    exact(s, resource);
  });

  it("Cosmic Alliance uses an actual teammate contribution and readies both distinct qualified characters", () => {
    let s = base("gam");
    const event = take(s, "25036"),
      a = take(s, "25021"),
      b = take(s, "01089", "hand", "p2");
    s.player.exhausted = true;
    seatView(s, "p2").player.exhausted = true;
    s = command(s, { type: "PLAY", id: event.id });
    s = payPrompt(s, [a, b]);
    if (s.prompt?.title === "Audacity") s = choose(s, "skip");
    s = choose(s, "hero:p1|hero:p2");
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    exact(s, event);
    exact(s, b);
  });

  it.each(["25021", "21046"])(
    "spent Audacity %s is identity damage for Death-Glow's actual villain-stage defeat",
    (code) => {
      let s = base();
      const event = take(s, "25024"),
        audacity = take(s, code),
        actualGlow = glow(s, s.villain.id);
      s.villain.hp = 1;
      s.player.hp = maxHP(s) - 2;
      s.player.exhausted = true;
      s = command(s, { type: "PLAY", id: event.id });
      s = choose(s, "spend");
      s = payPrompt(s, [audacity]);
      s = choose(s, "yes");
      s = finish(s);
      expect(s.villain.stage).toBe(2);
      expect(s.player.exhausted).toBe(false);
      expect(s.player.setAside?.some((p) => p.id === actualGlow.id)).toBe(true);
      expect(s.player.hp).toBe(maxHP(s));
      exact(s, event);
      exact(s, audacity);
      exact(s, actualGlow);
    },
  );
});
