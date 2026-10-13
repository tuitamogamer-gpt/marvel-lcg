import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { enemyAttachmentModifier } from "../src/game/cards.js";
import { newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import * as zero from "../src/game/zero-tolerance.js";

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const Z = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `zero-tolerance:${name}`,
  ...args,
});
function saved(s: GameState): GameState {
  const copy: GameState = JSON.parse(JSON.stringify(s));
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
    seed: 32101,
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
    const p = seatView(state, seat).player;
    p.hand = [];
    p.deck = [];
    p.discard = [];
    p.inPlay = [];
    p.setAside = [];
    p.form = "hero";
    p.stunned = p.tough = false;
    p.stunCards = p.toughCards = 0;
    seat.flags = {};
    if (seat.id === state.activePlayerId) state.flags = seat.flags;
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
    removed: [],
    victoryDisplay: [],
  });
  state.encounter.deck = [];
  state.encounter.discard = [];
  state.encounter.dealt = [];
  const f = {
    s: state,
    history: [] as string[],
    ports: {} as zero.ZeroTolerancePorts,
  };
  const piece = (
    code: string,
    ownerId = definitions.get(code)?.faction_code === "encounter"
      ? undefined
      : f.s.activePlayerId,
  ): Piece => ({
    id: `z${f.s.nextId++}`,
    code,
    ownerId,
    damage: 0,
    counters: 0,
    exhausted: false,
    tough: false,
    stunned: false,
    confused: false,
  });
  const zones = (s: GameState): Piece[][] => [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.resolving,
    s.removed,
    s.victoryDisplay || [],
    s.minions,
    s.sideSchemes,
    s.attachments,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.hand, p.deck, p.discard, p.inPlay, p.setAside || []];
    }),
    ...s.sideSchemes.map((p) => p.captured || []),
  ];
  const find = (s: GameState, id: string) =>
    zones(s)
      .flat()
      .find((p) => p.id === id);
  const take = (s: GameState, id: string) => {
    expect(
      zones(s)
        .flat()
        .filter((p) => p.id === id),
      id,
    ).toHaveLength(1);
    for (const zone of zones(s)) {
      const i = zone.findIndex((p) => p.id === id);
      if (i >= 0) return zone.splice(i, 1)[0];
    }
    throw Error("Missing physical source");
  };
  const character = (s: GameState, id: string) =>
    id.startsWith("hero:")
      ? seatView(s, id.slice(5)).player
      : [
          ...s.minions,
          ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
        ].find((p) => p.id === id);
  f.ports = {
    queue: (s, ...effects) => s.queue.unshift(...effects),
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (s, p) => !!s.flags[`blank:${p.id}`],
    hasTrait: (s, id, trait) =>
      !!s.flags[`trait:${id}:${trait}`] ||
      (definitions.get(find(s, id)?.code || "")?.traits || "")
        .split(/\.\s*/)
        .includes(trait),
    hasStatus: (s, id, status) => {
      const p = character(s, id);
      return (
        !!p &&
        !!(status === "stunned"
          ? p.stunCards || p.stunned
          : p.toughCards || p.tough)
      );
    },
    addStatus: (s, id, status) => {
      const p = character(s, id);
      if (
        !p ||
        s.flags[`blocked-status:${id}:${status}`] ||
        (status === "stunned" && s.flags[`stalwart:${id}`])
      )
        return;
      const key = status === "stunned" ? "stunCards" : "toughCards",
        count = Number(p[key] || p[status] || 0);
      const max = status === "stunned" && s.flags[`steady:${id}`] ? 2 : 1;
      if (count >= max) return;
      p[key] = count + 1;
      p[status] = true;
      f.history.push(`status:${id}:${status}`);
    },
    damage: (s, id, amount, sourceId, after) => {
      const p = character(s, id);
      if (p && !s.flags[`prevent:${id}`]) {
        if (p.tough) {
          p.tough = false;
          p.toughCards = 0;
        } else if ("hp" in p) p.hp -= amount;
        else p.damage += amount;
      }
      f.history.push(`boost-damage:${id}:${amount}:${sourceId}`);
      f.ports.queue(s, ...after);
    },
    attachBarrier: (s, id, minionId, after) => {
      expect(s.minions.some((p) => p.id === minionId)).toBe(true);
      const p = take(s, id);
      p.attachedTo = minionId;
      s.attachments.push(p);
      f.history.push(`attach:${id}:${minionId}`);
      f.ports.queue(s, ...after);
    },
    revealSearchedSideScheme: (s, id, playerId, after) => {
      const p = take(s, id);
      p.counters = 3 * s.playerCount;
      s.sideSchemes.push(p);
      f.history.push(`reveal:${id}:${playerId}`);
      f.ports.queue(s, ...after);
    },
    shuffleEncounter: () => {
      f.history.push("shuffle");
    },
    revealHidden: (s) => {
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
    },
    captureDefeatedAlly: (s, schemeId, ally, after) => {
      const scheme = s.sideSchemes.find((p) => p.id === schemeId),
        p = find(s, ally.id);
      if (scheme && p) {
        scheme.captured ||= [];
        scheme.captured.push(take(s, p.id));
        f.history.push(`capture:${p.id}:${schemeId}`);
      }
      f.ports.queue(s, ...after);
    },
    lose: (s, reason) => {
      s.phase = "lost";
      s.result = reason;
      s.queue = [];
      s.prompt = null;
      f.history.push("lost");
    },
  };
  function run(...effects: Effect[]) {
    f.ports.queue(f.s, ...effects);
    for (
      let n = 0;
      f.s.queue.length && !f.s.prompt && f.s.phase !== "lost" && n < 100;
      n++
    ) {
      f.s = saved(f.s);
      const e = f.s.queue.shift()!;
      if (e.actorId) activateSeat(f.s, e.actorId);
      if (zero.resolveZeroToleranceEffect(f.s, e, f.ports)) continue;
      f.history.push(
        e.type === "surge" ? `surge:${e.sourceCode}:${e.actorId}` : e.type,
      );
    }
  }
  function choose(id: string) {
    f.s = saved(f.s);
    const option = f.s.prompt!.options.find((o) => o.id === id);
    expect(option, `choice ${id}`).toBeTruthy();
    f.s.prompt = null;
    run(...option!.effects);
  }
  const conserved = (...pieces: Piece[]) => {
    for (const p of pieces)
      expect(
        zones(f.s)
          .flat()
          .filter((a) => a.id === p.id),
        `${p.code}:${p.id}`,
      ).toHaveLength(1);
  };
  const minion = (code = "32101") => {
    const p = piece(code);
    f.s.minions.push(p);
    return p;
  };
  const scheme = () => {
    const p = piece("32104");
    p.counters = 3 * f.s.playerCount;
    f.s.sideSchemes.push(p);
    return p;
  };
  const barrier = (p: Piece) => {
    const a = piece("32103");
    a.attachedTo = p.id;
    f.s.attachments.push(a);
    return a;
  };
  const ally = (code = "01002", ownerId = f.s.activePlayerId) => {
    const p = piece(code, ownerId);
    seatView(f.s, ownerId).player.discard.push(p);
    return p;
  };
  const defeat = (
    p: Piece,
    controllerId = f.s.activePlayerId,
  ): zero.ZeroToleranceAllyDefeatReceipt => ({
    id: p.id,
    code: p.code,
    ownerId: p.ownerId,
    controllerId,
    actualAlly: true,
  });
  const receipt = (
    p: Piece,
    defeatedAllies: zero.ZeroToleranceAllyDefeatReceipt[] = [],
    overrides: Partial<zero.ZeroToleranceAttackReceipt> = {},
  ): zero.ZeroToleranceAttackReceipt => ({
    token: `attack:${f.s.nextId++}`,
    attackerId: p.id,
    attackerCode: p.code,
    playerId: f.s.activePlayerId,
    performed: true,
    enemyAttack: true,
    defeatedAllies,
    ...overrides,
  });
  return {
    f,
    piece,
    run,
    choose,
    conserved,
    minion,
    scheme,
    barrier,
    ally,
    defeat,
    receipt,
  };
}

describe("Zero Tolerance original module and live source contracts", () => {
  it("retains four original faces and exactly seven actual copies", () => {
    const cards = [...definitions.values()].filter(
      (c) => c.set_code === "zero_tolerance",
    );
    expect(cards.map((c) => c.code)).toEqual([
      ...zero.ZERO_TOLERANCE_SCRIPT_CODES,
    ]);
    expect(cards.map((c) => c.quantity)).toEqual([2, 2, 2, 1]);
    expect(cards.reduce((n, c) => n + c.quantity, 0)).toBe(7);
    expect(zero.ZERO_TOLERANCE_SET).toBe("zero_tolerance");
  });
  it.each([
    ["32101", 2, 1, 2, 1],
    ["32102", 3, 2, 3, undefined],
  ])(
    "%s preserves printed ATK/SCH/HP/numeric boosts",
    (code, attack, scheme, health, boost) => {
      expect(definitions.get(String(code))).toMatchObject({
        attack,
        scheme,
        health,
      });
      expect(definitions.get(String(code))?.boost).toBe(boost);
    },
  );
  it("keeps Toughness and star boost on Mark III distinct from Barrier's printed+2ATK/star response", () => {
    expect(definitions.get("32102")).toMatchObject({
      boost_star: true,
      text: expect.stringContaining("Toughness."),
    });
    expect(definitions.get("32103")).toMatchObject({
      attack: 2,
      attack_star: true,
      boost: 1,
    });
    expect(zero.ZERO_TOLERANCE_BARRIER).toEqual({ attack: 2 });
  });
  it("Operation Zero Tolerance has printed3PERPLAYER threat and a3+N loss threshold", () => {
    const { f } = fixture(true);
    expect(zero.ZERO_TOLERANCE_SIDE_SCHEME).toEqual({
      baseThreat: 3,
      perPlayer: true,
    });
    expect(zero.zeroToleranceLossThreshold(f.s)).toBe(5);
  });
  it("an unknown card is not intercepted by native reveal/boost", () => {
    const { f, piece } = fixture(),
      p = piece("01101");
    expect(zero.zeroToleranceReveal(f.s, p, f.ports)).toBeNull();
    expect(zero.zeroToleranceBoost(f.s, p)).toBeNull();
    expect(
      zero.resolveZeroToleranceEffect(f.s, { type: "other" }, f.ports),
    ).toBe(false);
  });
  it.each(["32101", "32102", "32103", "32104"])(
    "recognizes %s with blanked reveal text as having no printed reveal effects",
    (code) => {
      const { f, piece } = fixture(),
        p = piece(code);
      f.s.flags[`blank:${p.id}`] = true;
      expect(zero.zeroToleranceReveal(f.s, p, f.ports)).toEqual([]);
    },
  );
  it.each(["32101", "32103", "32104"])(
    "%s has no star boost ability",
    (code) => {
      const { f, piece } = fixture();
      expect(zero.zeroToleranceBoost(f.s, piece(code))).toEqual([]);
    },
  );
  it("live main32087b grants Permanent only to the actual in-play OZT and does not remove threats", () => {
    const { f, scheme, piece } = fixture(),
      p = scheme();
    expect(zero.zeroToleranceIsPermanent(f.s, p)).toBe(false);
    f.s.scheme.code = "32087b";
    expect(zero.zeroToleranceIsPermanent(f.s, p)).toBe(true);
    expect(zero.zeroToleranceIsPermanent(f.s)).toBe(true);
    expect(zero.zeroToleranceIsPermanent(f.s, piece("32104"))).toBe(false);
    expect(zero.zeroToleranceIsPermanent(f.s, piece("32101"))).toBe(false);
    expect(p.counters).toBe(3);
  });
  it("blanking the actual donating main removes its grant while blanking OZT itself does not", () => {
    const { f, scheme } = fixture(),
      p = scheme();
    f.s.scheme.code = "32087b";
    f.s.flags[`novaIronheartPackBlank:${p.id}`] = f.s.round;
    expect(zero.zeroToleranceIsPermanent(f.s, p)).toBe(true);
    f.s.flags["novaIronheartPackBlank:main"] = f.s.round;
    expect(zero.zeroToleranceIsPermanent(f.s, p)).toBe(false);
    delete f.s.flags["novaIronheartPackBlank:main"];
    f.s.scheme = { ...f.s.scheme, code: "32087a" };
    expect(zero.zeroToleranceIsPermanent(f.s, p)).toBe(false);
  });
});

describe("Sentinel Mark II physical side-scheme search", () => {
  it.each([false, true])(
    "surges when actual OZT is already in play, including blank=%s",
    (blank) => {
      const { f, minion, scheme, run } = fixture(),
        p = minion(),
        ozt = scheme();
      f.s.flags[`blank:${ozt.id}`] = blank;
      run(...zero.zeroToleranceReveal(f.s, p, f.ports)!);
      expect(f.history).toEqual(["surge:32101:p1"]);
      expect(f.s.hiddenInfo).toBeGreaterThanOrEqual(0);
    },
  );
  it.each(["deck", "discard"] as const)(
    "reveals the SAME searched OZT from encounter%s, then shuffles once",
    (zone) => {
      const { f, minion, piece, run, choose, conserved } = fixture(true),
        p = minion(),
        ozt = piece("32104");
      f.s.encounter[zone].push(ozt);
      run(...zero.zeroToleranceReveal(f.s, p, f.ports)!);
      expect(f.s.prompt?.options.map((o) => o.id)).toEqual([ozt.id]);
      choose(ozt.id);
      expect(f.s.sideSchemes[0]).toMatchObject({
        id: ozt.id,
        code: "32104",
        counters: 6,
      });
      expect(f.history).toEqual([`reveal:${ozt.id}:p1`, "shuffle"]);
      conserved(p, ozt);
    },
  );
  it("a missing OZT does not fabricate one or invent Surge", () => {
    const { f, minion, run } = fixture();
    run(...zero.zeroToleranceReveal(f.s, minion(), f.ports)!);
    expect(f.history).toEqual(["shuffle"]);
    expect(f.s.sideSchemes).toHaveLength(0);
  });
  it("only encounter deck/discard are searched, never removed/hand/captured sources", () => {
    const { f, minion, piece, run } = fixture(),
      p = piece("32104");
    f.s.removed.push(p);
    run(...zero.zeroToleranceReveal(f.s, minion(), f.ports)!);
    expect(f.history).toEqual(["shuffle"]);
    expect(f.s.removed[0].id).toBe(p.id);
  });
  it("a stale search choice validates actual physical source before revealing", () => {
    const { f, minion, piece, run, choose } = fixture(),
      p = piece("32104");
    f.s.encounter.deck.push(p);
    run(...zero.zeroToleranceReveal(f.s, minion(), f.ports)!);
    f.s.removed.push(f.s.encounter.deck.splice(0, 1)[0]);
    expect(() => choose(p.id)).toThrow(/actual searched/);
  });
  it("the search response binds to the actual revealing seat across JSON saves", () => {
    const { f, minion, piece, run, choose } = fixture(true),
      p = piece("32104");
    f.s.encounter.discard.push(p);
    activateSeat(f.s, "p2");
    run(...zero.zeroToleranceReveal(f.s, minion(), f.ports)!);
    choose(p.id);
    expect(f.history).toEqual([`reveal:${p.id}:p2`, "shuffle"]);
  });
});

describe("Energy Barrier ordinary reveal versus Mark III specific attach", () => {
  it("ordinary Barrier targets only actual Sentinel minions without any Energy Barrier attached", () => {
    const { f, minion, barrier, piece } = fixture(),
      eligible = minion(),
      occupied = minion("32102"),
      unrelated = minion("01101");
    const existing = barrier(occupied);
    f.s.flags[`blank:${existing.id}`] = true;
    f.s.villain.code = "32084";
    f.s.player.inPlay.push(piece("32101", "p1"));
    expect(
      zero.zeroToleranceBarrierTargets(f.s, f.ports).map((p) => p.id),
    ).toEqual([eligible.id]);
    expect(
      zero.zeroToleranceBarrierTargets(f.s, f.ports).map((p) => p.id),
    ).not.toContain(unrelated.id);
  });
  it("actual gained Sentinel traits qualify ordinary attach", () => {
    const { f, minion } = fixture(),
      p = minion("01101");
    f.s.flags[`trait:${p.id}:Sentinel`] = true;
    expect(
      zero.zeroToleranceBarrierTargets(f.s, f.ports).map((a) => a.id),
    ).toEqual([p.id]);
  });
  it("ordinary revealed Barrier attaches its same ID, gives Tough, and contributes printed+2ATK once", () => {
    const { f, minion, piece, run, choose, conserved } = fixture(),
      p = minion(),
      a = piece("32103");
    f.s.resolving.push(a);
    run(...zero.zeroToleranceReveal(f.s, a, f.ports)!);
    choose(p.id);
    expect(f.s.attachments).toEqual([
      expect.objectContaining({ id: a.id, attachedTo: p.id }),
    ]);
    expect(f.s.minions.find((a) => a.id === p.id)?.tough).toBe(true);
    expect(enemyAttachmentModifier(f.s, p.id)).toBe(2);
    expect(f.history).toEqual([
      `attach:${a.id}:${p.id}`,
      `status:${p.id}:tough`,
    ]);
    conserved(p, a);
  });
  it("an already Tough eligible minion still receives Barrier without Surge or a second Tough", () => {
    const { f, minion, piece, run, choose } = fixture(),
      p = minion(),
      a = piece("32103");
    p.tough = true;
    p.toughCards = 1;
    f.s.resolving.push(a);
    run(...zero.zeroToleranceReveal(f.s, a, f.ports)!);
    choose(p.id);
    expect(f.history).toEqual([`attach:${a.id}:${p.id}`]);
    expect(f.s.minions[0].toughCards).toBe(1);
  });
  it("without an eligible Sentinel ordinary Barrier gains Surge", () => {
    const { f, piece, run } = fixture(),
      a = piece("32103");
    f.s.resolving.push(a);
    run(...zero.zeroToleranceReveal(f.s, a, f.ports)!);
    expect(f.history).toEqual(["surge:32103:p1"]);
  });
  it("ordinary attach saved choice rejects a target that acquires Barrier first", () => {
    const { f, minion, piece, barrier, run, choose } = fixture(),
      p = minion(),
      a = piece("32103");
    f.s.resolving.push(a);
    run(...zero.zeroToleranceReveal(f.s, a, f.ports)!);
    barrier(p);
    expect(() => choose(p.id)).toThrow(/eligible Sentinel/);
  });
  it.each(["deck", "discard"] as const)(
    "Mark III searches actual%s Barrier, attaches it directly, and shuffles with no extra Tough/Surge",
    (zone) => {
      const { f, minion, piece, run, choose, conserved } = fixture(),
        p = minion("32102"),
        a = piece("32103");
      f.s.encounter[zone].push(a);
      run(...zero.zeroToleranceReveal(f.s, p, f.ports)!);
      choose(a.id);
      expect(f.history).toEqual([`attach:${a.id}:${p.id}`, "shuffle"]);
      expect(f.s.minions[0].tough).toBe(false);
      conserved(p, a);
    },
  );
  it("Mark III specific attach can stack a second Barrier after another effect already attached one", () => {
    const { f, minion, piece, barrier, run, choose, conserved } = fixture(),
      p = minion("32102"),
      first = barrier(p),
      second = piece("32103");
    f.s.encounter.deck.push(second);
    expect(zero.zeroToleranceBarrierTargets(f.s, f.ports)).toHaveLength(0);
    run(...zero.zeroToleranceReveal(f.s, p, f.ports)!);
    choose(second.id);
    expect(f.s.attachments.filter((a) => a.attachedTo === p.id)).toHaveLength(
      2,
    );
    expect(enemyAttachmentModifier(f.s, p.id)).toBe(4);
    expect(f.s.minions[0].tough).toBe(false);
    conserved(p, first, second);
  });
  it("Mark III missing searched Barrier shuffles once and does not Surge", () => {
    const { f, minion, run } = fixture();
    run(...zero.zeroToleranceReveal(f.s, minion("32102"), f.ports)!);
    expect(f.history).toEqual(["shuffle"]);
    expect(f.s.attachments).toHaveLength(0);
  });
  it("Mark III's departed specific minion is not replaced by another Sentinel", () => {
    const { f, minion, piece, run, choose } = fixture(),
      p = minion("32102"),
      other = minion(),
      a = piece("32103");
    f.s.encounter.deck.push(a);
    run(...zero.zeroToleranceReveal(f.s, p, f.ports)!);
    f.s.removed.push(
      f.s.minions.splice(
        f.s.minions.findIndex((a) => a.id === p.id),
        1,
      )[0],
    );
    choose(a.id);
    expect(f.history).toEqual(["shuffle"]);
    expect(f.s.attachments).toHaveLength(0);
    expect(f.s.minions[0].id).toBe(other.id);
  });
  it("printed Barrier+2ATK persists when its abilities blank and does not depend on recipient Sentinel text", () => {
    const { f, minion, barrier } = fixture(),
      p = minion(),
      a = barrier(p);
    f.s.flags[`novaIronheartPackBlank:${a.id}`] = f.s.round;
    f.s.flags[`blank:${p.id}`] = true;
    expect(enemyAttachmentModifier(f.s, p.id)).toBe(2);
  });
});

describe("Mark III native boost decision and attack-triggered Barrier", () => {
  it("an unstunned identity receives a Stun status rather than damage", () => {
    const { f, piece, run } = fixture(),
      boost = piece("32102"),
      hp = f.s.player.hp;
    run(...zero.zeroToleranceBoost(f.s, boost)!);
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.player.hp).toBe(hp);
  });
  it.each(["hero", "alter"] as const)(
    "already-Stunned %s takes native2nonattack boost damage without consuming Stun",
    (form) => {
      const { f, piece, run } = fixture(),
        boost = piece("32102"),
        hp = f.s.player.hp;
      f.s.player.form = form;
      f.s.player.stunned = true;
      f.s.player.stunCards = 1;
      run(...zero.zeroToleranceBoost(f.s, boost)!);
      expect(f.s.player.hp).toBe(hp - 2);
      expect(f.s.player.stunCards).toBe(1);
      expect(f.history).toEqual([`boost-damage:hero:p1:2:${boost.id}`]);
    },
  );
  it("Steady with one actual Stun is already stunned for this boost's conditional", () => {
    const { f, piece, run } = fixture(),
      boost = piece("32102"),
      hp = f.s.player.hp;
    f.s.player.stunned = true;
    f.s.player.stunCards = 1;
    f.s.flags["steady:hero:p1"] = true;
    run(...zero.zeroToleranceBoost(f.s, boost)!);
    expect(f.s.player.hp).toBe(hp - 2);
    expect(f.s.player.stunCards).toBe(1);
  });
  it("Stalwart preventing the initial Stun does not invent the already-stunned damage branch", () => {
    const { f, piece, run } = fixture(),
      hp = f.s.player.hp;
    f.s.flags["stalwart:hero:p1"] = true;
    run(...zero.zeroToleranceBoost(f.s, piece("32102"))!);
    expect(f.s.player.hp).toBe(hp);
    expect(f.s.player.stunned).toBe(false);
  });
  it("the actual boosted player receives the status across a saved foreign-seat context", () => {
    const { f, piece, run } = fixture(true);
    activateSeat(f.s, "p2");
    const effects = zero.zeroToleranceBoost(f.s, piece("32102"))!;
    activateSeat(f.s, "p1");
    run(...effects);
    expect(seatView(f.s, "p2").player.stunned).toBe(true);
    expect(seatView(f.s, "p1").player.stunned).toBe(false);
  });
  it("native prevention owns the2boost-damage packet while an identity is defending", () => {
    const { f, piece, run } = fixture(),
      hp = f.s.player.hp;
    f.s.player.stunned = true;
    f.s.flags["prevent:hero:p1"] = true;
    run(...zero.zeroToleranceBoost(f.s, piece("32102"))!);
    expect(f.s.player.hp).toBe(hp);
    expect(f.history[0]).toMatch(/^boost-damage:/);
  });
  it("every actual attack gives attached minion Tough even when no damage or ally defeat occurs", () => {
    const { f, minion, barrier, receipt, run } = fixture(),
      p = minion(),
      a = barrier(p),
      r = receipt(p);
    run(...zero.zeroToleranceAfterAttack(f.s, r, f.ports));
    expect(f.s.minions[0].tough).toBe(true);
    expect(f.history).toEqual([`status:${p.id}:tough`]);
    expect(a.id).toBeTruthy();
  });
  it("Stun/replacement/aborted attacks never trigger Barrier or OZT", () => {
    const { f, minion, barrier, scheme, ally, defeat, receipt } = fixture(),
      p = minion();
    barrier(p);
    scheme();
    expect(
      zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [defeat(ally())], { performed: false }),
        f.ports,
      ),
    ).toEqual([]);
  });
  it("blank Barrier suppresses its response without removing printedATK", () => {
    const { f, minion, barrier, receipt } = fixture(),
      p = minion(),
      a = barrier(p);
    f.s.flags[`blank:${a.id}`] = true;
    expect(zero.zeroToleranceAfterAttack(f.s, receipt(p), f.ports)).toEqual([]);
    expect(enemyAttachmentModifier(f.s, p.id)).toBe(2);
  });
  it("captured Barrier response survives its source leaving after the trigger", () => {
    const { f, minion, barrier, receipt, run } = fixture(),
      p = minion(),
      a = barrier(p),
      r = receipt(p, [], {
        barrierSources: zero.zeroToleranceBarrierSources(f.s, p.id, f.ports),
      });
    f.s.encounter.discard.push(f.s.attachments.splice(0, 1)[0]);
    run(...zero.zeroToleranceAfterAttack(f.s, r, f.ports));
    expect(f.s.minions[0].tough).toBe(true);
    expect(f.s.encounter.discard[0].id).toBe(a.id);
  });
  it("the same attack/source receipt commits once across duplicated saved callbacks and actor changes", () => {
    const { f, minion, barrier, receipt, run } = fixture(true),
      p = minion();
    barrier(p);
    const r = receipt(p),
      effects = zero.zeroToleranceAfterAttack(f.s, r, f.ports);
    run(...effects);
    f.s.minions[0].tough = false;
    f.s.minions[0].toughCards = 0;
    activateSeat(f.s, "p2");
    run(...effects);
    expect(f.history).toEqual([`status:${p.id}:tough`]);
    expect(f.s.minions[0].tough).toBe(false);
  });
  it("a later actual attack creates a new Tough response for the same physical Barrier", () => {
    const { f, minion, barrier, receipt, run } = fixture(),
      p = minion();
    barrier(p);
    run(...zero.zeroToleranceAfterAttack(f.s, receipt(p), f.ports));
    f.s.minions[0].tough = false;
    f.s.minions[0].toughCards = 0;
    run(...zero.zeroToleranceAfterAttack(f.s, receipt(p), f.ports));
    expect(f.history).toHaveLength(2);
  });
  it("a departed attacked minion receives no invented replacement character status", () => {
    const { f, minion, barrier, receipt, run } = fixture(),
      p = minion();
    barrier(p);
    const effects = zero.zeroToleranceAfterAttack(f.s, receipt(p), f.ports);
    f.s.encounter.discard.push(f.s.minions.splice(0, 1)[0]);
    run(...effects);
    expect(f.history).toEqual([]);
  });
});

describe("OZT actual enemy-attack defeat captures and unblankable alternate loss", () => {
  it.each(["discard", "hand", "deck"] as const)(
    "captures the same defeated ally from actualowner%s without another defeat or copy",
    (zone) => {
      const { f, minion, scheme, ally, defeat, receipt, run, conserved } =
          fixture(true),
        p = minion(),
        ozt = scheme(),
        a = ally("01002", "p2");
      const owner = seatView(f.s, "p2").player;
      if (zone !== "discard") owner[zone].push(owner.discard.splice(0, 1)[0]);
      run(
        ...zero.zeroToleranceAfterAttack(
          f.s,
          receipt(p, [defeat(a, "p1")]),
          f.ports,
        ),
      );
      expect(f.s.sideSchemes[0].captured).toEqual([
        expect.objectContaining({ id: a.id, code: a.code, ownerId: "p2" }),
      ]);
      conserved(p, ozt, a);
      expect(f.history).toEqual([`capture:${a.id}:${ozt.id}`]);
    },
  );
  it("captures actual Jubilee from Victory after her native Victory-1 placement without losing her source ID/owner", () => {
    const { f, minion, scheme, piece, defeat, receipt, run, conserved } =
        fixture(),
      p = minion(),
      ozt = scheme(),
      jubilee = piece("32088b", "p1");
    f.s.victoryDisplay!.push(jubilee);
    run(
      ...zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [defeat(jubilee)]),
        f.ports,
      ),
    );
    expect(f.s.victoryDisplay).toHaveLength(0);
    expect(f.s.sideSchemes[0].captured![0]).toMatchObject({
      id: jubilee.id,
      code: "32088b",
      ownerId: "p1",
    });
    conserved(p, ozt, jubilee);
  });
  it("raw encounter-faction rescued Captives remain eligible actual allies and retain their assigned owner", () => {
    const { f, minion, scheme, ally, defeat, receipt, run } = fixture(),
      p = minion();
    scheme();
    const captive = ally("32090", "p1");
    expect(definitions.get(captive.code)?.faction_code).toBe("encounter");
    run(
      ...zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [defeat(captive)]),
        f.ports,
      ),
    );
    expect(f.s.sideSchemes[0].captured![0]).toMatchObject({
      id: captive.id,
      ownerId: "p1",
    });
  });
  it.each([
    "player attack",
    "consequential damage",
    "independent boost damage",
  ])("does not capture an ally for %s", (cause) => {
    const { f, minion, scheme, ally, defeat, receipt } = fixture(),
      p = minion();
    scheme();
    const a = ally();
    const r =
      cause === "player attack"
        ? receipt(p, [defeat(a)], { enemyAttack: false })
        : receipt(p, []);
    expect(zero.zeroToleranceAfterAttack(f.s, r, f.ports)).toEqual([]);
  });
  it("a printed ally currently classified as a minion is not an actual defeated ally", () => {
    const { f, minion, scheme, ally, defeat, receipt } = fixture(),
      p = minion();
    scheme();
    const a = ally();
    expect(
      zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [{ ...defeat(a), actualAlly: false }]),
        f.ports,
      ),
    ).toEqual([]);
  });
  it("a printed minion temporarily treated as an ally reverts after defeat and cannot be found as an ally by OZT", () => {
    const { f, minion, scheme, piece, receipt } = fixture(),
      p = minion();
    scheme();
    const converted = piece("32102");
    f.s.encounter.discard.push(converted);
    expect(
      zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [
          {
            id: converted.id,
            code: converted.code,
            actualAlly: true,
            controllerId: "p1",
          },
        ]),
        f.ports,
      ),
    ).toEqual([]);
  });
  it("a blank OZT suppresses new capture triggers while the alternate loss remains operative", () => {
    const { f, minion, scheme, ally, defeat, receipt } = fixture(),
      p = minion(),
      ozt = scheme();
    f.s.flags[`blank:${ozt.id}`] = true;
    expect(
      zero.zeroToleranceAfterAttack(f.s, receipt(p, [defeat(ally())]), f.ports),
    ).toEqual([]);
  });
  it("an already captured forced response survives later source text blanking", () => {
    const { f, minion, scheme, ally, defeat, receipt, run } = fixture(),
      p = minion(),
      ozt = scheme(),
      a = ally(),
      r = receipt(p, [defeat(a)], {
        schemeSources: zero.zeroToleranceSchemeSources(f.s, f.ports),
      });
    f.s.flags[`blank:${ozt.id}`] = true;
    run(...zero.zeroToleranceAfterAttack(f.s, r, f.ports));
    expect(f.s.sideSchemes[0].captured![0].id).toBe(a.id);
  });
  it("a departed OZT cannot become an invented out-of-play destination for a captured response", () => {
    const { f, minion, scheme, ally, defeat, receipt, run, conserved } =
        fixture(),
      p = minion(),
      ozt = scheme(),
      a = ally(),
      effects = zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [defeat(a)]),
        f.ports,
      );
    f.s.encounter.discard.push(f.s.sideSchemes.splice(0, 1)[0]);
    run(...effects);
    expect(f.s.player.discard[0].id).toBe(a.id);
    conserved(p, ozt, a);
  });
  it("the same actual attack/ally receipt cannot capture twice", () => {
    const { f, minion, scheme, ally, defeat, receipt, run, conserved } =
        fixture(),
      p = minion(),
      ozt = scheme(),
      a = ally(),
      effects = zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [defeat(a)]),
        f.ports,
      );
    run(...effects, ...effects);
    expect(f.s.sideSchemes[0].captured).toHaveLength(1);
    expect(f.history).toEqual([`capture:${a.id}:${ozt.id}`]);
    conserved(p, ozt, a);
  });
  it("one attack can retain several actual defeated-ally receipts without losing physical instances", () => {
    const { f, minion, scheme, ally, defeat, receipt, run, conserved } =
        fixture(),
      p = minion(),
      ozt = scheme(),
      a = ally(),
      b = ally("01084");
    run(
      ...zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [defeat(a), defeat(b)]),
        f.ports,
      ),
    );
    expect(f.s.sideSchemes[0].captured?.map((a) => a.id)).toEqual([a.id, b.id]);
    conserved(p, ozt, a, b);
  });
  it("a missing actual defeated source is not recreated", () => {
    const { f, minion, scheme, receipt, run } = fixture(),
      p = minion();
    scheme();
    run(
      ...zero.zeroToleranceAfterAttack(
        f.s,
        receipt(p, [
          { id: "absent", code: "01002", ownerId: "p1", actualAlly: true },
        ]),
        f.ports,
      ),
    );
    expect(f.s.sideSchemes[0].captured).toBeUndefined();
  });
  it.each([1, 2, 3])(
    "the continuous alternate loss threshold is exactly3+%i players, including blank OZT",
    (count) => {
      const { f, scheme, piece } = fixture(),
        p = scheme();
      f.s.playerCount = count;
      p.captured = Array.from({ length: 2 + count }, () =>
        piece("01002", "p1"),
      );
      f.s.flags[`blank:${p.id}`] = true;
      expect(zero.zeroToleranceCheckLoss(f.s, f.ports)).toBe(false);
      expect(f.s.phase).toBe("player");
      p.captured.push(piece("01003", "p1"));
      expect(zero.zeroToleranceCheckLoss(f.s, f.ports)).toBe(true);
      expect(f.s.phase).toBe("lost");
    },
  );
  it("the fourth actual capture in solo immediately loses and prevents the authored continuation", () => {
    const { f, minion, scheme, piece, ally, defeat, receipt, run } = fixture(),
      p = minion(),
      ozt = scheme();
    ozt.captured = Array.from({ length: 3 }, () => piece("01002", "p1"));
    const effects = zero
      .zeroToleranceAfterAttack(
        f.s,
        receipt(p, [defeat(ally("01084"))]),
        f.ports,
      )
      .map((e) => ({ ...e, after: [{ type: "later" }] }));
    run(...effects);
    expect(f.s.phase).toBe("lost");
    expect(f.s.sideSchemes[0].captured).toHaveLength(4);
    expect(f.history).not.toContain("later");
  });
  it("preexisting facedown nonally cards count toward loss just like captured allies", () => {
    const { f, scheme, piece } = fixture(),
      p = scheme();
    p.captured = ["01088", "01089", "01090", "32101"].map((code) =>
      piece(code),
    );
    expect(zero.zeroToleranceCheckLoss(f.s, f.ports)).toBe(true);
  });
  it("no OZT, an empty captured array, and already terminal games do not invent a loss", () => {
    const { f, scheme } = fixture();
    expect(zero.zeroToleranceCheckLoss(f.s, f.ports)).toBe(false);
    const p = scheme();
    p.captured = [];
    expect(zero.zeroToleranceCheckLoss(f.s, f.ports)).toBe(false);
    f.s.phase = "won";
    expect(zero.zeroToleranceCheckLoss(f.s, f.ports)).toBe(false);
  });
});
