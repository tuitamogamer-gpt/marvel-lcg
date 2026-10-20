import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { newGame } from "../src/game/engine.js";
import { printedKeyword } from "../src/game/keywords.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import * as mystique from "../src/game/mystique.js";
const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const M = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mystique:${type}`,
  ...args,
});
type FixtureState = GameState & {
  testNPC?: { piece: Piece; controllerId: string };
};
function saved(s: FixtureState): FixtureState {
  const copy: FixtureState = JSON.parse(JSON.stringify(s));
  const actor = copy.players.find((p) => p.id === copy.activePlayerId)!;
  actor.player = copy.player;
  actor.flags = copy.flags;
  return copy;
}
function fixture(team = false) {
  const state = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    pacing: "expert",
    seed: 32080,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "shadowcat", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  for (const seat of state.players) {
    const v = seatView(state, seat);
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.setAside = [];
    v.flags = seat.flags = {};
    if (seat.id === state.activePlayerId) state.flags = seat.flags;
    v.player.form = "hero";
  }
  Object.assign(state, {
    phase: "player",
    prompt: null,
    review: null,
    queue: [],
    resolving: [],
    minions: [],
    sideSchemes: [],
    attachments: [],
  });
  state.encounter.deck = [];
  state.encounter.discard = [];
  state.encounter.dealt = [];
  state.encounter.acceleration = 0;
  const f = {
    s: state as FixtureState,
    history: [] as string[],
    ports: {} as mystique.MystiquePorts,
  };
  const piece = (
    code: string,
    ownerId = cards.get(code)?.faction_code === "encounter"
      ? undefined
      : f.s.activePlayerId,
  ): Piece => ({
    id: `m${f.s.nextId++}`,
    code,
    ownerId,
    damage: 0,
    counters: 0,
    exhausted: false,
    tough: false,
    stunned: false,
    confused: false,
  });
  const zones = (s: GameState) => [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.resolving,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
  const take = (s: GameState, id: string) => {
    const matches = zones(s).flatMap((z) => z.filter((p) => p.id === id));
    expect(matches, `physical ${id}`).toHaveLength(1);
    for (const z of zones(s)) {
      const i = z.findIndex((p) => p.id === id);
      if (i >= 0) return z.splice(i, 1)[0];
    }
    throw Error("Missing physical card");
  };
  f.ports = {
    queue: (s, ...effects) => s.queue.unshift(...effects),
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (s, p) => !!s.flags[`blank:${p.id}`],
    villainStats: (s) => ({
      attack: Number(s.flags.villainATK ?? 2),
      scheme: Number(s.flags.villainSCH ?? 1),
    }),
    controlledPieces: (s) => [
      ...s.player.inPlay,
      ...((s as FixtureState).testNPC?.controllerId === s.activePlayerId
        ? [(s as FixtureState).testNPC!.piece]
        : []),
    ],
    canDiscardControlled: (s, p) =>
      !cards.get(p.code)?.permanent &&
      !s.flags[`locked:${p.id}`] &&
      f.ports.controlledPieces(s).some((q) => q.id === p.id),
    discardControlled: (s, id, after) => {
      const npc = (s as FixtureState).testNPC;
      if (npc?.piece.id === id) {
        s.encounter.discard.push(npc.piece);
        delete (s as FixtureState).testNPC;
        s.phase = "lost";
      } else {
        const p = take(s, id);
        seatView(s, p.ownerId || s.activePlayerId).player.discard.push(p);
      }
      f.history.push(`discard:${id}`);
      f.ports.queue(s, ...after);
    },
    shuffleIntoPlayerDeck: (s, ids, playerId, after) => {
      expect(new Set(ids).size).toBe(ids.length);
      const actual = ids.map((id) => take(s, id));
      seatView(s, playerId).player.deck.push(...actual);
      f.history.push(`player-shuffle:${playerId}:${ids.join(",")}`);
      f.ports.queue(s, ...after);
    },
    activateMystique: (s, id, playerId, after) => {
      expect(s.minions.some((p) => p.id === id && p.code === "32080")).toBe(
        true,
      );
      f.history.push(
        `activate:${id}:${playerId}:${seatView(s, playerId).player.form === "hero" ? "attack" : "scheme"}`,
      );
      f.ports.queue(s, ...after);
    },
    revealSearchedMystique: (s, id, playerId, after) => {
      const from = s.encounter.deck.some((p) => p.id === id)
        ? "deck"
        : "discard";
      const p = take(s, id);
      p.engagedWith = playerId;
      p.tough = true;
      s.minions.push(p);
      f.history.push(`reveal:${id}:${playerId}:${from}`);
      f.ports.queue(s, ...after);
    },
    shuffleEncounter: () => {
      f.history.push("encounter-shuffle");
    },
    revealHidden: (s) => {
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
    },
  };
  function run(...effects: Effect[]) {
    f.ports.queue(f.s, ...effects);
    for (let n = 0; f.s.queue.length && !f.s.prompt && n < 100; n++) {
      f.s = saved(f.s);
      const e = f.s.queue.shift()!;
      if (e.actorId) activateSeat(f.s, e.actorId);
      if (mystique.resolveMystiqueEffect(f.s, e, f.ports)) continue;
      if (e.type === "discardPiece") {
        f.ports.discardControlled(f.s, e.id, e.after || []);
        continue;
      }
      f.history.push(
        e.type === "surge"
          ? `surge:${e.actorId || f.s.activePlayerId}`
          : e.type,
      );
    }
  }
  function choose(id: string) {
    f.s = saved(f.s);
    const o = f.s.prompt!.options.find((o) => o.id === id);
    expect(o, `choice ${id}`).toBeTruthy();
    f.s.prompt = null;
    run(...o!.effects);
  }
  function entry(
    p: Piece,
    playerId = f.s.activePlayerId,
    token = `entry:${f.s.nextId++}`,
  ): mystique.MystiqueHandEntryReceipt {
    return { token, playerId, pieceId: p.id, code: p.code };
  }
  const conserved = (ps: Piece[]) => {
    const all = [
      ...zones(f.s).flat(),
      ...f.s.minions,
      ...f.s.sideSchemes,
      ...f.s.removed,
      ...(f.s.testNPC ? [f.s.testNPC.piece] : []),
    ];
    for (const p of ps)
      expect(
        all.filter((q) => q.id === p.id),
        p.id,
      ).toHaveLength(1);
  };
  return { f, piece, run, choose, entry, conserved };
}

describe("Mystique original modular contract", () => {
  it("registers exactly four original faces with five physical cards", () => {
    const source = [...cards.values()].filter((c) => c.set_code === "mystique");
    expect([...mystique.MYSTIQUE_SCRIPT_CODES]).toEqual(
      source.map((c) => c.code),
    );
    expect(source.reduce((n, c) => n + c.quantity, 0)).toBe(5);
    expect(mystique.MYSTIQUE_SET).toBe("mystique");
  });
  it("retains original unique Elite Mystique, Toughness and numeric boost3", () => {
    const c = cards.get("32080")!;
    expect(c).toMatchObject({ is_unique: true, health: 9, boost: 3 });
    expect(c.traits).toContain("Elite.");
    expect(printedKeyword(c, "Toughness")).toBe(1);
    expect(c.attack || 0).toBe(0);
    expect(c.scheme || 0).toBe(0);
  });
  it("uses fixed3 Mayhem threat and one Amplify independent of player count", () => {
    expect(cards.get("32081")).toMatchObject({
      base_threat: 3,
      base_threat_fixed: true,
      boost: 3,
    });
    expect(mystique.MYSTIQUE_SIDE_SCHEME).toEqual({
      baseThreat: 3,
      perPlayer: false,
      amplify: 1,
    });
  });
  it.each(["32080", "32081", "32082", "32083"])(
    "has no boost star ability on %s",
    (code) => {
      const { f, piece } = fixture();
      expect(mystique.mystiqueBoost(f.s, piece(code))).toEqual([]);
      expect(cards.get(code)?.boost_star).not.toBe(true);
    },
  );
  it("does not mutate the imported 'an reveal' typo to implement the printed 'and reveal'", () => {
    expect(cards.get("32083")!.text).toContain("an reveal");
  });
});

describe("absolute prohibition and current star statistics", () => {
  it("globally prohibits villain attacks even when Mystique engages the other seat", () => {
    const { f, piece } = fixture(true);
    const p = piece("32080");
    p.engagedWith = f.s.players[1].id;
    f.s.minions.push(p);
    expect(mystique.mystiqueVillainAttackProhibited(f.s, f.ports)).toBe(true);
    activateSeat(f.s, f.s.players[1].id);
    f.s.heroId = f.s.players[1].heroId = "shadowcat";
    f.s.player.inPlay.push(piece("32031b"));
    expect(mystique.mystiqueVillainAttackProhibited(f.s, f.ports)).toBe(true);
  });
  it("the actual prohibition ends when Mystique leaves play", () => {
    const { f, piece } = fixture();
    f.s.minions.push(piece("32080"));
    expect(mystique.mystiqueVillainAttackProhibited(f.s, f.ports)).toBe(true);
    f.s.minions = [];
    expect(mystique.mystiqueVillainAttackProhibited(f.s, f.ports)).toBe(false);
  });
  it("blanking Mystique removes dynamic stars and prohibition without removing existing Tough", () => {
    const { f, piece } = fixture();
    const p = piece("32080");
    p.tough = true;
    f.s.minions.push(p);
    f.s.flags[`blank:${p.id}`] = true;
    expect(mystique.mystiqueStats(f.s, p, f.ports)).toEqual({
      attack: 0,
      scheme: 0,
    });
    expect(mystique.mystiqueVillainAttackProhibited(f.s, f.ports)).toBe(false);
    expect(p.tough).toBe(true);
    expect(cards.get(p.code)!.traits).toContain("Elite.");
  });
  it("recalculates ATK/SCH from the villain's current derived values every time", () => {
    const { f, piece } = fixture();
    const p = piece("32080");
    f.s.minions.push(p);
    expect(mystique.mystiqueStats(f.s, p, f.ports)).toEqual({
      attack: 2,
      scheme: 1,
    });
    f.s.flags.villainATK = 5;
    f.s.flags.villainSCH = 4;
    expect(mystique.mystiqueStats(f.s, p, f.ports)).toEqual({
      attack: 5,
      scheme: 4,
    });
  });
  it("returns no override for an unrelated or no-longer-present Piece", () => {
    const { f, piece } = fixture();
    expect(mystique.mystiqueStats(f.s, piece("32080"), f.ports)).toBeNull();
    const p = piece("32058");
    f.s.minions.push(p);
    expect(mystique.mystiqueStats(f.s, p, f.ports)).toBeNull();
  });
});

describe("physical reveal shuffles and Metamorphic Mayhem", () => {
  it.each(["32082", "32083"])(
    "shuffles actual revealed %s into the revealer's existing deck before Surge",
    (code) => {
      const { f, piece, run, conserved } = fixture();
      const p = piece(code),
        owned = piece("01088"),
        oldDiscard = piece("01089");
      f.s.resolving.push(p);
      f.s.player.deck.push(owned);
      f.s.player.discard.push(oldDiscard);
      run(...mystique.mystiqueReveal(f.s, p, f.ports)!);
      expect(f.s.player.deck.map((p) => p.id)).toEqual([owned.id, p.id]);
      expect(f.s.player.discard[0].id).toBe(oldDiscard.id);
      expect(f.s.player.deck[1].ownerId).toBeUndefined();
      expect(f.s.resolving).toEqual([]);
      expect(f.history).toEqual([`player-shuffle:p1:${p.id}`, "surge:p1"]);
      conserved([p, owned, oldDiscard]);
    },
  );
  it("multiplayer reveal retains receiving player and physical card owner", () => {
    const { f, piece, run } = fixture(true);
    activateSeat(f.s, f.s.players[1].id);
    const p = piece("32082");
    f.s.resolving.push(p);
    run(...mystique.mystiqueReveal(f.s, p, f.ports)!);
    expect(f.s.activePlayerId).toBe("p2");
    expect(f.s.player.deck[0].id).toBe(p.id);
    expect(f.s.player.deck[0].ownerId).toBeUndefined();
    expect(seatView(f.s, "p1").player.deck).toEqual([]);
    expect(f.history.at(-1)).toBe("surge:p2");
  });
  it("blank When Revealed text grants neither its printed shuffle nor gained Surge", () => {
    const { f, piece } = fixture();
    const p = piece("32082");
    f.s.flags[`blank:${p.id}`] = true;
    expect(mystique.mystiqueReveal(f.s, p, f.ports)).toEqual([]);
  });
  it("Mayhem moves EVERY actual encounter-discard Shapeshifter, including other sets, to its defeater", () => {
    const { f, piece, run, conserved } = fixture(true);
    const ps = [piece("32082"), piece("32082"), piece("32083"), piece("38027")],
      unrelated = piece("01186"),
      untouched = piece("32082");
    f.s.encounter.discard.push(...ps, unrelated);
    f.s.encounter.deck.push(untouched);
    const scheme = piece("32081");
    f.s.sideSchemes.push(scheme);
    run(...mystique.mystiqueSideSchemeDefeated(f.s, scheme, "p2", f.ports));
    expect(f.s.player.deck.map((p) => p.id)).toEqual(ps.map((p) => p.id));
    expect(f.s.player.deck.every((p) => p.ownerId === undefined)).toBe(true);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([unrelated.id]);
    expect(f.s.encounter.deck[0].id).toBe(untouched.id);
    expect(seatView(f.s, "p1").player.deck).toEqual([]);
    expect(f.history).toEqual([
      `player-shuffle:p2:${ps.map((p) => p.id).join(",")}`,
    ]);
    conserved([...ps, unrelated, untouched, scheme]);
  });
  it("Mayhem does not pull copies from players' discard/hand/deck or manufacture missing cards", () => {
    const { f, piece, run } = fixture();
    const ps = [piece("32082"), piece("32083"), piece("32082")];
    f.s.player.hand.push(ps[0]);
    f.s.player.deck.push(ps[1]);
    f.s.player.discard.push(ps[2]);
    const scheme = piece("32081");
    run(
      ...mystique.mystiqueSideSchemeDefeated(f.s, scheme, undefined, f.ports),
    );
    expect(f.history).toEqual([]);
    expect(f.s.player.hand[0].id).toBe(ps[0].id);
    expect(f.s.player.discard[0].id).toBe(ps[2].id);
  });
  it("blank Mayhem has no When Defeated effect", () => {
    const { f, piece } = fixture();
    const p = piece("32081");
    f.s.flags[`blank:${p.id}`] = true;
    expect(
      mystique.mystiqueSideSchemeDefeated(f.s, p, undefined, f.ports),
    ).toEqual([]);
  });
  it.each(["32080", "32081"])(
    "recognizes %s as native reveal with no invented When Revealed clause",
    (code) => {
      const { f, piece } = fixture();
      expect(mystique.mystiqueReveal(f.s, piece(code), f.ports)).toEqual([]);
    },
  );
});

describe("actual hand-entry receipts and Infiltration", () => {
  it.each(["draw", "search", "return", "stored-card retrieval"])(
    "triggers on an actual %s hand entry and keeps Infiltration in hand",
    (_method) => {
      const { f, piece, entry, run, choose } = fixture();
      const p = piece("32082"),
        ally = piece("01067");
      f.s.player.hand.push(p);
      f.s.player.inPlay.push(ally);
      run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
      expect(f.s.prompt!.options.map((o) => o.id)).toEqual([ally.id]);
      choose(ally.id);
      expect(f.s.player.hand[0].id).toBe(p.id);
      expect(f.s.player.discard[0].id).toBe(ally.id);
    },
  );
  it("does not trigger on hidden milling or a search which never adds the card to hand", () => {
    const { f, piece, entry } = fixture();
    const p = piece("32082");
    f.s.player.deck.push(p);
    expect(mystique.mystiqueHandEntered(f.s, entry(p), f.ports)).toEqual([]);
    f.s.player.deck = [];
    f.s.encounter.discard.push(p);
    expect(mystique.mystiqueHandEntered(f.s, entry(p), f.ports)).toEqual([]);
  });
  it("filters to actual controlled allies/supports and never offers upgrades or teammates' cards", () => {
    const { f, piece, run, entry } = fixture(true);
    const p = piece("32082"),
      ally = piece("01067"),
      support = piece("01015"),
      upgrade = piece("32034"),
      teammate = piece("01067", "p2");
    f.s.player.hand.push(p);
    f.s.player.inPlay.push(ally, support, upgrade);
    seatView(f.s, "p2").player.inPlay.push(teammate);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([ally.id, support.id]);
    expect(f.s.prompt!.options.some((o) => /pass|continue/.test(o.id))).toBe(
      false,
    );
  });
  it("can discard a borrowed actual ally to that card's owner", () => {
    const { f, piece, run, entry, choose } = fixture(true);
    const p = piece("32082"),
      ally = piece("01067", "p2");
    f.s.player.hand.push(p);
    f.s.player.inPlay.push(ally);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    choose(ally.id);
    expect(seatView(f.s, "p2").player.discard[0].id).toBe(ally.id);
    expect(f.s.player.discard).toEqual([]);
  });
  it("offers the real controlled scenario Kelly outside player.inPlay and uses his actual leave/loss port", () => {
    const { f, piece, run, entry, choose, conserved } = fixture();
    const p = piece("32082"),
      kelly = piece("32066");
    f.s.player.hand.push(p);
    f.s.testNPC = { piece: kelly, controllerId: "p1" };
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([kelly.id]);
    choose(kelly.id);
    expect(f.s.phase).toBe("lost");
    expect(f.s.encounter.discard[0].id).toBe(kelly.id);
    expect(f.s.testNPC).toBeUndefined();
    conserved([p, kelly]);
  });
  it("a different seat's Kelly is not controlled by the Infiltration recipient", () => {
    const { f, piece, run, entry } = fixture(true);
    const p = piece("32082");
    f.s.player.hand.push(p);
    f.s.testNPC = { piece: piece("32066"), controllerId: "p2" };
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.s.prompt).toBeNull();
  });
  it("forwards continuation without inventing a discard when no eligible ally/support exists", () => {
    const { f, piece, run, entry } = fixture();
    const p = piece("32082");
    f.s.player.hand.push(p);
    const effects = mystique.mystiqueHandEntered(f.s, entry(p), f.ports);
    run({ ...effects[0], after: [{ type: "continued" }] });
    expect(f.s.prompt).toBeNull();
    expect(f.history).toEqual(["continued"]);
    expect(f.s.player.hand[0].id).toBe(p.id);
  });
  it("respects native cannot-discard restrictions", () => {
    const { f, piece, run, entry } = fixture();
    const p = piece("32082"),
      ally = piece("01067");
    f.s.player.hand.push(p);
    f.s.player.inPlay.push(ally);
    f.s.flags[`locked:${ally.id}`] = true;
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.s.prompt).toBeNull();
    expect(f.s.player.inPlay[0].id).toBe(ally.id);
  });
  it("does not treat an ally currently changed into a minion as a controlled ally", () => {
    const { f, piece, run, entry } = fixture();
    const p = piece("32082"),
      ally = piece("01067");
    ally.treatedAsMinion = true;
    f.s.player.hand.push(p);
    f.s.player.inPlay.push(ally);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.s.prompt).toBeNull();
  });
  it("one actual entry cannot trigger twice, but the same physical card entering again can", () => {
    const { f, piece, run, choose, entry } = fixture();
    const p = piece("32082"),
      allies = [piece("01067"), piece("01067")];
    f.s.player.hand.push(p);
    f.s.player.inPlay.push(...allies);
    const r = entry(p);
    const duplicate = mystique.mystiqueHandEntered(f.s, r, f.ports);
    run(...duplicate, ...duplicate);
    choose(allies[0].id);
    expect(f.s.prompt).toBeNull();
    expect(f.s.player.inPlay[0].id).toBe(allies[1].id);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    choose(allies[1].id);
    expect(f.s.player.discard).toHaveLength(2);
    expect(f.s.player.hand[0].id).toBe(p.id);
  });
  it("a previously captured forced response still resolves after its source leaves hand", () => {
    const { f, piece, run, entry, choose } = fixture();
    const p = piece("32082"),
      ally = piece("01067");
    f.s.player.hand.push(p);
    f.s.player.inPlay.push(ally);
    const effects = mystique.mystiqueHandEntered(f.s, entry(p), f.ports);
    f.s.encounter.discard.push(f.s.player.hand.pop()!);
    run(...effects);
    choose(ally.id);
    expect(f.s.player.discard[0].id).toBe(ally.id);
  });
  it("stale saved discard choices cannot discard an unrelated source", () => {
    const { f, piece, run, entry, choose } = fixture();
    const p = piece("32082"),
      ally = piece("01067");
    f.s.player.hand.push(p);
    f.s.player.inPlay.push(ally);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    f.s.player.inPlay = [];
    expect(() => choose(ally.id)).toThrow(/actual controlled/);
    expect(f.s.player.discard).toEqual([]);
  });
  it("schedules a foreign hand recipient with that actual actor context", () => {
    const { f, piece, run, entry, choose } = fixture(true);
    const p = piece("32082"),
      ally = piece("01067", "p2");
    seatView(f.s, "p2").player.hand.push(p);
    seatView(f.s, "p2").player.inPlay.push(ally);
    const effects = mystique.mystiqueHandEntered(f.s, entry(p, "p2"), f.ports);
    expect(effects[0].actorId).toBe("p2");
    run(...effects);
    choose(ally.id);
    expect(f.s.activePlayerId).toBe("p2");
    expect(f.s.player.discard[0].id).toBe(ally.id);
  });
  it("does not trigger for an eliminated/missing recipient or mismatched physical code", () => {
    const { f, piece, entry } = fixture();
    const p = piece("32082");
    f.s.player.hand.push(p);
    const r = entry(p);
    expect(
      mystique.mystiqueHandEntered(f.s, { ...r, playerId: "absent" }, f.ports),
    ).toEqual([]);
    expect(
      mystique.mystiqueHandEntered(f.s, { ...r, code: "32083" }, f.ports),
    ).toEqual([]);
    f.s.players[0].eliminated = true;
    expect(mystique.mystiqueHandEntered(f.s, r, f.ports)).toEqual([]);
  });
});

describe("Shapeshifter Surprise native activation and actual search", () => {
  it.each(["hero", "alter"] as const)(
    "activates Mystique against recipient in %s regardless of her existing engagement",
    (form) => {
      const { f, piece, run, entry } = fixture(true);
      const p = piece("32083"),
        enemy = piece("32080");
      enemy.engagedWith = "p2";
      f.s.minions.push(enemy);
      f.s.player.hand.push(p);
      f.s.player.form = form;
      run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
      expect(f.history).toEqual([
        `activate:${enemy.id}:p1:${form === "hero" ? "attack" : "scheme"}`,
      ]);
      expect(f.s.minions[0].engagedWith).toBe("p2");
      expect(f.s.player.hand[0].id).toBe(p.id);
    },
  );
  it("a blank Mystique still activates as the actual existing minion with zero copied stats", () => {
    const { f, piece, run, entry } = fixture();
    const p = piece("32083"),
      enemy = piece("32080");
    f.s.minions.push(enemy);
    f.s.player.hand.push(p);
    f.s.flags[`blank:${enemy.id}`] = true;
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.history[0]).toContain(`activate:${enemy.id}`);
    expect(mystique.mystiqueStats(f.s, f.s.minions[0], f.ports)).toEqual({
      attack: 0,
      scheme: 0,
    });
  });
  it.each(["deck", "discard"] as const)(
    "absent Mystique is searched and REVEALED from actual %s, then shuffled",
    (zone) => {
      const { f, piece, run, entry, choose, conserved } = fixture();
      const p = piece("32083"),
        enemy = piece("32080");
      f.s.player.hand.push(p);
      f.s.encounter[zone].push(enemy);
      run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
      expect(f.s.prompt!.options.map((o) => o.id)).toEqual([enemy.id]);
      choose(enemy.id);
      expect(f.history).toEqual([
        `reveal:${enemy.id}:p1:${zone}`,
        "encounter-shuffle",
      ]);
      expect(f.s.minions[0]).toMatchObject({
        id: enemy.id,
        engagedWith: "p1",
        tough: true,
      });
      expect(f.s.player.hand[0].id).toBe(p.id);
      conserved([p, enemy]);
    },
  );
  it("does not search player decks/discards or a set-aside Mystique", () => {
    const { f, piece, run, entry } = fixture();
    const p = piece("32083"),
      enemy = piece("32080");
    f.s.player.hand.push(p);
    f.s.player.setAside!.push(enemy);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.s.minions).toEqual([]);
    expect(f.s.player.setAside![0].id).toBe(enemy.id);
    expect(f.history).toEqual(["encounter-shuffle"]);
  });
  it("a failed search has no fabricated Mystique and still shuffles encounter deck once", () => {
    const { f, piece, run, entry } = fixture();
    const p = piece("32083");
    f.s.player.hand.push(p);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.s.minions).toEqual([]);
    expect(f.history).toEqual(["encounter-shuffle"]);
    expect(f.s.hiddenInfo).toBeGreaterThan(0);
  });
  it("two hand entries of the same physical Surprise cause two actual activations", () => {
    const { f, piece, run, entry } = fixture();
    const p = piece("32083"),
      enemy = piece("32080");
    f.s.player.hand.push(p);
    f.s.minions.push(enemy);
    const r = entry(p);
    run(...mystique.mystiqueHandEntered(f.s, r, f.ports));
    expect(mystique.mystiqueHandEntered(f.s, r, f.ports)).toEqual([]);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    expect(f.history.filter((h) => h.startsWith("activate:"))).toHaveLength(2);
  });
  it("a saved search choice revalidates that exact ID in a searched zone", () => {
    const { f, piece, run, entry, choose } = fixture();
    const p = piece("32083"),
      enemy = piece("32080");
    f.s.player.hand.push(p);
    f.s.encounter.deck.push(enemy);
    run(...mystique.mystiqueHandEntered(f.s, entry(p), f.ports));
    f.s.encounter.deck = [];
    f.s.removed.push(enemy);
    expect(() => choose(enemy.id)).toThrow(/actual searched/);
    expect(f.s.minions).toEqual([]);
  });
});

describe("printed treachery discard destination authority", () => {
  it.each(["32082", "32083"])(
    "routes %s discarded from HAND and DECK to encounter discard",
    (code) => {
      const { piece } = fixture();
      const p = piece(code);
      expect(mystique.mystiqueDiscardFromPlayerZone(p, "hand")).toBe(true);
      expect(mystique.mystiqueDiscardFromPlayerZone(p, "deck")).toBe(true);
      expect(mystique.mystiqueDiscardFromPlayerZone(p, "discard")).toBe(false);
    },
  );
  it("does not silently reroute unrelated player cards or existing old discard zones", () => {
    const { piece } = fixture();
    expect(mystique.mystiqueDiscardFromPlayerZone(piece("01088"), "hand")).toBe(
      false,
    );
    expect(mystique.mystiqueDiscardFromPlayerZone(piece("32080"), "deck")).toBe(
      false,
    );
  });
});

describe("additional source and saved-trigger controls", () => {
  it("zero current villain statistics are copied as zero rather than printed stage defaults", () => {
    const { f, piece } = fixture();
    const p = piece("32080");
    f.s.minions.push(p);
    f.s.flags.villainATK = 0;
    f.s.flags.villainSCH = 0;
    expect(mystique.mystiqueStats(f.s, p, f.ports)).toEqual({
      attack: 0,
      scheme: 0,
    });
  });
  it("a hand card with blank text has no new Forced Response to capture", () => {
    const { f, piece, entry } = fixture();
    const p = piece("32082");
    f.s.player.hand.push(p);
    f.s.flags[`blank:${p.id}`] = true;
    expect(mystique.mystiqueHandEntered(f.s, entry(p), f.ports)).toEqual([]);
  });
  it("eliminating the receiving player cancels their pending hand response without inventing a target", () => {
    const { f, piece, entry, run } = fixture();
    const p = piece("32083");
    f.s.player.hand.push(p);
    const effects = mystique.mystiqueHandEntered(f.s, entry(p), f.ports);
    f.s.players[0].eliminated = true;
    run(...effects);
    expect(f.history).toEqual([]);
    expect(f.s.minions).toEqual([]);
  });
  it.each(["32082", "32083"])(
    "encounter %s boost triangles never become player resource icons",
    (code) => {
      const c = cards.get(code)!;
      expect(c.boost).toBeGreaterThan(0);
      expect(
        (c.resource_energy || 0) +
          (c.resource_mental || 0) +
          (c.resource_physical || 0) +
          (c.resource_wild || 0),
      ).toBe(0);
    },
  );
});
