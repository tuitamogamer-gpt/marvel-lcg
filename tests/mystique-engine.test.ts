/** Native commands hydrate every saved choice and move original printed pieces. */
import { describe, expect, it } from "vitest";
import { card, deckCodes, handSize } from "../src/game/cards.js";
import { activateSeat, seatView } from "../src/game/team.js";
import { canPay, enemyStats, newGame, targets } from "../src/game/engine.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  passId,
  pay,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { mystiqueOriginalIds?: string[] };
function zones(s: GameState): Piece[][] {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.resolving,
    s.removed,
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.environments || [],
    s.victoryDisplay || [],
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
  ];
}
function exact(s: GameState) {
  const all = zones(s).flat();
  for (const id of (s as Fixture).mystiqueOriginalIds || [])
    expect(
      all.filter((p) => p.id === id),
      `actual physical ${id}`,
    ).toHaveLength(1);
  expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
  return s;
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let i = 0; s.prompt && i < 150; i++) {
    const id =
      prefer?.(s) ||
      passId(s) ||
      (/setup|Worthy|forced|order/i.test(s.prompt.title) ||
      s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return exact(s);
}
function base(
  heroId = "spider_man",
  team = false,
  defenseCards: string[] = [],
): GameState {
  const aspect = defenseCards.length
    ? ("protection" as const)
    : ("aggression" as const);
  const deckCards = defenseCards.length ? deckCodes(heroId, aspect) : undefined;
  for (const code of defenseCards) {
    if (deckCards!.includes(code)) continue;
    const i = deckCards!.findIndex(
      (c) => card(c).faction_code === "protection" && !defenseCards.includes(c),
    );
    expect(i).toBeGreaterThanOrEqual(0);
    deckCards![i] = code;
  }
  const first = { heroId, aspect, ...(deckCards ? { deckCards } : {}) };
  let s = newGame({
    ...first,
    villainId: "rhino",
    module: "mystique",
    seed: 320830,
    pacing: "expert",
    ...(team
      ? {
          heroes: [first, { heroId: "spider_man", aspect: "justice" as const }],
        }
      : deckCards
        ? { heroes: [first] }
        : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const original = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    const permanent = original.filter((p) =>
      ["32031a", "32031b"].includes(p.code),
    );
    p.deck = original.filter((p) => !permanent.includes(p));
    p.hand = [];
    p.discard = [];
    p.inPlay = permanent;
    p.form = "hero";
    p.exhausted = p.flipped = false;
  }
  (s as Fixture).mystiqueOriginalIds = zones(s)
    .flat()
    .map((p) => p.id);
  expect(
    zones(s)
      .flat()
      .filter((p) => ["32080", "32081", "32082", "32083"].includes(p.code)),
  ).toHaveLength(5);
  s.scheme.threat = 0;
  activateSeat(s, "p1");
  return reload(s);
}
function take(s: GameState, code: string, ownerId?: string): Piece {
  for (const zone of zones(s)) {
    const i = zone.findIndex(
      (p) => p.code === code && (!ownerId || p.ownerId === ownerId),
    );
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Actual original source ${code} missing.`);
}
function support(s: GameState, code = "01091", playerId = s.activePlayerId) {
  const p = take(s, code, playerId);
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function playerTop(s: GameState, p: Piece, playerId = s.activePlayerId) {
  seatView(s, playerId).player.deck.unshift(p);
}
function mystique(s: GameState, playerId = s.activePlayerId) {
  const p = take(s, "32080");
  p.engagedWith = playerId;
  p.tough = false;
  p.toughCards = 0;
  s.minions.push(p);
  return p;
}
const triggers = (s: GameState, playerId = s.activePlayerId) =>
  Object.keys(seatView(s, playerId).flags).filter((key) =>
    key.startsWith("mystiqueHandEntry:"),
  );

describe("Mystique original physical pieces in the serializable engine", () => {
  it.each(["32082", "32083"])(
    "revealing %s moves the same encounter-owned piece into the real player deck before Surge",
    (code) => {
      let s = base();
      const p = take(s, code),
        top = take(s, "01187");
      s.encounter.deck.unshift(top);
      s = settle(native(s, { type: "reveal", piece: p, skip: true }));
      expect(s.player.deck.filter((q) => q.id === p.id)).toHaveLength(1);
      expect(s.player.deck.find((q) => q.id === p.id)?.ownerId).toBeUndefined();
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(false);
      expect(s.encounter.dealt.some((q) => q.id === top.id)).toBe(true);
    },
  );

  it("a fixed draw pauses after Infiltration, then draws its exact remainder after the forced discard", () => {
    let s = base();
    const a = support(s),
      p = take(s, "32082"),
      next = s.player.deck[0];
    playerTop(s, p);
    s = native(s, { type: "draw", amount: 2 });
    expect(s.prompt?.title).toBe("Infiltration");
    expect(s.player.hand.map((q) => q.id)).toEqual([p.id]);
    expect(s.player.deck[0].id).toBe(next.id);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id]);
    s = settle(choose(s, a.id));
    expect(s.player.hand.map((q) => q.id)).toEqual([p.id, next.id]);
    expect(s.player.discard.some((q) => q.id === a.id)).toBe(true);
    expect(triggers(s)).toHaveLength(1);
  });

  it("drawing an Infiltration with no controlled ally/support still counts as the actual drawn card", () => {
    let s = base();
    const p = take(s, "32082");
    playerTop(s, p);
    s = settle(native(s, { type: "draw", amount: 1 }));
    expect(s.player.hand.map((q) => q.id)).toEqual([p.id]);
    expect(triggers(s)).toHaveLength(1);
    expect(canPay(s, 1)).toBe(false);
  });

  it("draw-up-to-hand-size resumes against the new hand size after Infiltration discards Asgard", () => {
    let s = base("thor");
    const asgard = support(s, "06007"),
      p = take(s, "32082");
    playerTop(s, p);
    expect(handSize(s)).toBe(5);
    s = native(s, { type: "refill" });
    expect(s.prompt?.title).toBe("Infiltration");
    expect(s.player.hand).toHaveLength(1);
    s = settle(choose(s, asgard.id));
    expect(handSize(s)).toBe(4);
    expect(s.player.hand).toHaveLength(4);
    expect(s.player.hand.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.inPlay.some((q) => q.id === asgard.id)).toBe(false);
  });

  it("the serial allReady window pauses the first seat's refill before drawing any second-seat cards", () => {
    let s = base("thor", true);
    const a = support(s),
      p = take(s, "32082");
    playerTop(s, p);
    s = native(s, { type: "allReady" });
    expect(s.prompt?.title).toBe("Infiltration");
    expect(seatView(s, "p1").player.hand).toHaveLength(1);
    expect(seatView(s, "p2").player.hand).toHaveLength(0);
    s = settle(choose(s, a.id));
    expect(seatView(s, "p1").player.hand).toHaveLength(4);
    expect(seatView(s, "p2").player.hand).toHaveLength(5);
  });

  it("any actual search-to-hand triggers before the next authored effect", () => {
    let s = base();
    const a = support(s),
      p = take(s, "32082");
    playerTop(s, p);
    s = native(s, { type: "fromDeck", id: p.id }, { type: "draw", amount: 1 });
    expect(s.prompt?.title).toBe("Infiltration");
    expect(s.player.hand.map((q) => q.id)).toEqual([p.id]);
    s = settle(choose(s, a.id));
    expect(s.player.hand).toHaveLength(2);
    expect(triggers(s)).toHaveLength(1);
  });

  it("the same actual physical card triggers on each later hand entry after saved discard-to-hand movement", () => {
    let s = base();
    const p = take(s, "32082"),
      a = support(s),
      b = support(s, "01002");
    s.player.discard.push(p);
    s = native(s, { type: "fromDiscard", id: p.id });
    s = settle(choose(s, a.id));
    s = settle(native(s, { type: "discardHand", id: p.id }));
    expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    const i = s.encounter.discard.findIndex((q) => q.id === p.id);
    playerTop(s, s.encounter.discard.splice(i, 1)[0]);
    s = native(s, { type: "draw", amount: 1 });
    s = settle(choose(s, b.id));
    expect(triggers(s)).toHaveLength(2);
    expect(s.player.hand.filter((q) => q.id === p.id)).toHaveLength(1);
    s = settle(native(s, { type: "draw", amount: 0 }));
    expect(triggers(s)).toHaveLength(2);
  });

  it("direct saved hand entry belongs to its receiving seat, with original acting seat restored afterward", () => {
    let s = base("thor", true);
    const a = support(s, "01091", "p2"),
      p = take(s, "32082");
    seatView(s, "p2").player.hand.push(p);
    s = native(s, { type: "draw", amount: 1, actorId: "p1" });
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id]);
    expect(seatView(s, "p1").player.hand).toHaveLength(0);
    s = settle(choose(s, a.id));
    expect(s.activePlayerId).toBe("p1");
    expect(seatView(s, "p1").player.hand).toHaveLength(1);
    expect(seatView(s, "p2").player.hand[0].id).toBe(p.id);
    expect(triggers(s, "p2")).toHaveLength(1);
  });

  it("a preexisting legacy player-discard card is neither rerouted nor treated as a new hand entry", () => {
    let s = base();
    const p = take(s, "32082");
    s.player.discard.push(p);
    delete s.mystiqueHandPresence;
    s = settle(native(s, { type: "draw", amount: 0 }));
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(false);
    expect(triggers(s)).toHaveLength(0);
  });

  it.each(["32082", "32083"])(
    "milling %s from the actual player deck enters encounter discard without a hand-entry trigger",
    (code) => {
      let s = base();
      const p = take(s, code);
      playerTop(s, p);
      s = settle(native(s, { type: "mill", amount: 1 }));
      expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
      expect(s.player.discard.some((q) => q.id === p.id)).toBe(false);
      expect(triggers(s)).toHaveLength(0);
    },
  );

  it("the generic Futurist deck-to-discard path uses the exact authoritative discard destination", () => {
    let s = base();
    const p = take(s, "32082"),
      selected = s.player.deck[0];
    playerTop(s, p);
    s = settle(
      native(s, {
        type: "futurist",
        ids: [p.id, selected.id],
        id: selected.id,
      }),
    );
    expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.player.hand.map((q) => q.id)).toEqual([selected.id]);
    expect(triggers(s)).toHaveLength(0);
  });

  it("random hand discard routes the real encounter card and leaves no fabricated player copy", () => {
    let s = base();
    const p = take(s, "32082");
    playerTop(s, p);
    s = settle(native(s, { type: "draw", amount: 1 }));
    s = settle(native(s, { type: "randomDiscard" }));
    expect(s.player.hand).toHaveLength(0);
    expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(triggers(s)).toHaveLength(1);
  });

  it("Surprise searches and actually reveals the existing physical Mystique with Toughness, then leaves Surprise in hand", () => {
    let s = base();
    const p = take(s, "32083"),
      expected = zones(s)
        .flat()
        .find((q) => q.code === "32080")!;
    playerTop(s, p);
    s = native(s, { type: "draw", amount: 1 });
    expect(s.prompt?.title).toBe("Shapeshifter Surprise");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([expected.id]);
    s = settle(choose(s, expected.id));
    expect(s.minions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expected.id,
          code: "32080",
          engagedWith: "p1",
          tough: true,
        }),
      ]),
    );
    expect(s.player.hand.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(triggers(s)).toHaveLength(1);
  });

  it("Surprise cannot fabricate Mystique from removed or set-aside cards", () => {
    let s = base();
    const p = take(s, "32083"),
      missing = take(s, "32080");
    s.removed.push(missing);
    playerTop(s, p);
    s = settle(native(s, { type: "draw", amount: 1 }));
    expect(s.minions).toHaveLength(0);
    expect(s.removed.some((q) => q.id === missing.id)).toBe(true);
    expect(s.player.hand[0].id).toBe(p.id);
  });

  it("an actual Mystique engaged with another seat attacks the Surprise receiving hero and retains engagement", () => {
    let s = base("thor", true);
    const p = take(s, "32083"),
      enemy = mystique(s, "p2"),
      hp = s.player.hp;
    playerTop(s, p);
    s = native(s, { type: "draw", amount: 1 });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero"));
    expect(s.attack?.attacker).toBe(enemy.id);
    expect(s.attack?.originalPlayerId).toBe("p1");
    expect(s.attack?.base).toBe(card(s.villain).attack);
    s = settle(choose(s, "take"));
    expect(s.player.hp).toBe(hp - (card(s.villain).attack || 0));
    expect(s.minions.find((q) => q.id === enemy.id)?.engagedWith).toBe("p2");
    expect(s.attack).toBeNull();
  });

  it("Defensive Energy hand entry resolves before Mutant Protectors puts its paid ally into play", () => {
    let s = base("shadowcat", false, ["32017", "32018", "32011"]);
    const event = take(s, "32017", "p1"),
      energy = take(s, "32018", "p1"),
      ally = take(s, "32011", "p1");
    s.player.hand.push(event, energy, ally);
    const a = support(s),
      infiltration = take(s, "32082"),
      boost = take(s, "01186");
    playerTop(s, infiltration);
    s.encounter.deck.unshift(boost);
    s = respond(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      /Mutant Protectors/,
      "32017",
    );
    s = pay(s, [energy]);
    s = respond(s, /Defensive Energy/, "32018");
    expect(s.prompt?.title).toBe("Infiltration");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id]);
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.attack?.defender).not.toBe(ally.id);
    s = choose(s, a.id);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === ally.id));
    s = settle(choose(s, ally.id));
    expect(card(ally).health).toBe(2);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    expect(s.player.hand.some((p) => p.id === infiltration.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.attack).toBeNull();
  });

  it("Phased retains outer hero-defense damage immunity during a Surprise activation drawn by Defensive Energy", () => {
    let s = base("shadowcat", false, ["05014", "32018"]);
    s.player.inPlay.find((p) => p.code === "32031a")!.code = "32031b";
    const event = take(s, "05014", "p1"),
      energy = take(s, "32018", "p1");
    s.player.hand.push(event, energy);
    const surprise = take(s, "32083"),
      enemy = mystique(s),
      boost = take(s, "01102"),
      hp = s.player.hp;
    playerTop(s, surprise);
    s.encounter.deck.unshift(boost);
    s = until(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => !!v.prompt?.options.some((o) => o.id === "hero"),
    );
    s = choose(s, "hero");
    s = respond(s, /Preemptive Strike/, "05014");
    s = pay(s, [energy]);
    s = respond(s, /Defensive Energy/, "32018");
    s = until(
      s,
      (v) =>
        v.attack?.attacker === enemy.id &&
        !!v.prompt?.options.some((o) => o.id === "take"),
    );
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.some((p) => p.code === "32031b")).toBe(true);
    s = settle(choose(s, "take"));
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.some((p) => p.code === "32031a")).toBe(true);
    expect(s.enemyAttackCounts?.[enemy.id]).toBe(1);
    expect(s.enemyAttackCounts?.[s.villain.id]).toBe(1);
    expect(s.player.hand.some((p) => p.id === surprise.id)).toBe(true);
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
    expect(s.attack).toBeNull();
  });

  it("Surprise activates Mystique's scheme against its actual alter-ego recipient", () => {
    let s = base("thor", true);
    s.player.form = "alter";
    const p = take(s, "32083"),
      enemy = mystique(s, "p2"),
      before = s.scheme.threat;
    playerTop(s, p);
    s = settle(native(s, { type: "draw", amount: 1 }));
    expect(s.scheme.threat - before).toBe(card(s.villain).scheme || 0);
    expect(s.minions.find((q) => q.id === enemy.id)?.engagedWith).toBe("p2");
    expect(s.scheming).toBeUndefined();
  });

  it("copied attack values follow live villain stage and native bonuses, then zero when Mystique is text-blank", () => {
    let s = base("thor");
    const enemy = mystique(s);
    s.villain.bonusAtk = 2;
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero"));
    expect(s.attack?.base).toBe((card(s.villain).attack || 0) + 2);
    s = settle(choose(s, "hero"));
    s.player.exhausted = false;
    s.flags[`novaIronheartPackBlank:${enemy.id}`] = s.round;
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero"));
    expect(s.attack?.base).toBe(0);
    s = settle(choose(s, "take"));
  });

  it("derived star statistics re-read the actual villain after a stage change without altering the source instance", () => {
    const s = base("thor"),
      enemy = mystique(s);
    expect(enemyStats(s, enemy)).toEqual(enemyStats(s, s.villain));
    const id = enemy.id;
    s.villain.code = "01095";
    s.villain.bonusAtk = 2;
    expect(enemyStats(s, enemy)).toEqual(enemyStats(s, s.villain));
    expect(enemy.id).toBe(id);
    s.flags[`novaIronheartPackBlank:${enemy.id}`] = s.round;
    expect(enemyStats(s, enemy)).toEqual({ attack: 0, scheme: 0 });
    exact(s);
  });

  it("Mystique is an absolute villain-attack prohibition even for Phased Shadowcat, while nonattack damage stays legal", () => {
    let s = base("shadowcat");
    const enemy = mystique(s);
    s.player.inPlay.find((p) => p.code === "32031a")!.code = "32031b";
    expect(targets(s, "enemy", true).map((t) => t.id)).not.toContain(
      s.villain.id,
    );
    expect(targets(s, "enemy", true).map((t) => t.id)).toContain(enemy.id);
    const before = s.villain.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 1,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(before - 1);
    s.flags[`novaIronheartPackBlank:${enemy.id}`] = s.round;
    expect(targets(s, "enemy", true).map((t) => t.id)).toContain(s.villain.id);
  });

  it("the printed Shadowcat ally's keyword bypass does not bypass Mystique's villain prohibition", () => {
    let s = base("colossus");
    const ally = support(s, "32002"),
      enemy = mystique(s),
      other = take(s, "01102");
    other.engagedWith = "p1";
    s.minions.push(other);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(s.villain.id);
    expect(s.prompt?.options.map((o) => o.id)).toContain(enemy.id);
    s = settle(choose(s, enemy.id));
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(2);
  });

  it("saved attack selections are revalidated after Mystique enters play", () => {
    let s = base("thor");
    const other = take(s, "01102");
    other.engagedWith = "p1";
    s.minions.push(other);
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(true);
    const enemy = mystique(s),
      before = s.villain.hp;
    const rejected = settle(command(s, { type: "CHOOSE", id: s.villain.id }));
    expect(rejected.error).toBeUndefined();
    expect(rejected.villain.hp).toBe(before);
    expect(rejected.minions.some((p) => p.id === enemy.id)).toBe(true);
    exact(rejected);
  });

  it("Mayhem has fixed three threat in multiplayer and moves all actual discarded Shapeshifters into its defeating player's deck", () => {
    let s = base("thor", true);
    const scheme = take(s, "32081"),
      a = take(s, "32082"),
      b = take(s, "32082"),
      p = take(s, "32083");
    s.encounter.discard.push(a, b, p);
    s = settle(native(s, { type: "reveal", piece: scheme, skip: true }));
    expect(s.sideSchemes.find((q) => q.id === scheme.id)?.counters).toBe(3);
    s = settle(
      native(s, {
        type: "thwart",
        amount: 3,
        target: scheme.id,
        source: "hero",
        actorId: "p2",
      }),
    );
    const deck = seatView(s, "p2").player.deck;
    for (const q of [a, b, p]) {
      expect(deck.filter((x) => x.id === q.id)).toHaveLength(1);
      expect(deck.find((x) => x.id === q.id)?.ownerId).toBeUndefined();
      expect(s.encounter.discard.some((x) => x.id === q.id)).toBe(false);
    }
    expect(
      seatView(s, "p1").player.deck.some((x) =>
        [a.id, b.id, p.id].includes(x.id),
      ),
    ).toBe(false);
    expect(s.encounter.discard.some((x) => x.id === scheme.id)).toBe(true);
  });
});
