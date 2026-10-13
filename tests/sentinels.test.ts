import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { card } from "../src/game/cards.js";
import { makePiece, newGame } from "../src/game/engine.js";
import { printedKeyword } from "../src/game/keywords.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Effect, GameState, Piece } from "../src/game/types.js";
import * as pack from "../src/game/sentinels.js";

function fixture() {
  const s = newGame({
    heroId: "colossus",
    aspect: "protection",
    villainId: "rhino",
    seed: 32105,
    pacing: "expert",
    heroes: [
      { heroId: "colossus", aspect: "protection" },
      { heroId: "shadowcat", aspect: "aggression" },
      { heroId: "spider_man", aspect: "justice" },
    ],
  });
  s.phase = "player";
  s.queue = [];
  s.prompt = s.review = null;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.resolving = [];
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.exhausted = false;
    v.player.inPlay = [];
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    seat.flags = {};
    if (seat.id === s.activePlayerId) s.flags = seat.flags;
  }
  const originals = (
    catalog as { code: string; set_code?: string; quantity: number }[]
  )
    .filter((c) => c.set_code === "sentinels")
    .flatMap((c) =>
      Array.from({ length: c.quantity }, () => makePiece(s, c.code)),
    );
  s.encounter.deck.push(...originals);
  const trace: {
    type: string;
    id?: string;
    playerId?: string;
    form?: string;
  }[] = [];
  const zones = (v: GameState) => [
    v.encounter.deck,
    v.encounter.discard,
    v.encounter.dealt,
    v.resolving,
    v.minions,
    v.attachments,
    v.sideSchemes,
    v.attack?.pendingBoosts || [],
  ];
  const take = (v: GameState, id: string) => {
    const found = zones(v)
      .flat()
      .filter((p) => p.id === id);
    expect(found).toHaveLength(1);
    const zone = zones(v).find((zone) => zone.some((p) => p.id === id))!;
    return zone.splice(
      zone.findIndex((p) => p.id === id),
      1,
    )[0];
  };
  const ports: pack.SentinelsPorts = {
    queue: (v, ...effects) =>
      v.queue.unshift(
        ...effects.map((e) => ({ actorId: v.activePlayerId, ...e })),
      ),
    choose: (v, title, text, options) => {
      v.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (v, p) => !!v.flags[`blank:${p.id}`],
    hasTrait: (v, id, trait) =>
      !!v.flags[`trait:${id}:${trait}`] ||
      !!v.minions.find(
        (p) =>
          p.id === id && (card(p).traits || "").split(/\.\s*/).includes(trait),
      ),
    isEngagedWith: (_v, p, playerId) =>
      !p.engagedWith || p.engagedWith === playerId,
    canExhaustIdentity: (v, playerId) =>
      !seatView(v, playerId).player.exhausted &&
      !v.flags[`cannotExhaust:${playerId}`],
    exhaustIdentity: vi.fn((v: GameState, playerId: string) => {
      seatView(v, playerId).player.exhausted = true;
      trace.push({ type: "exhaust", playerId });
    }),
    attachIdentity: vi.fn((v: GameState, id: string, playerId: string) => {
      const p = take(v, id);
      p.attachedTo = `hero:${playerId}`;
      v.attachments.push(p);
      trace.push({ type: "attach", id, playerId });
    }),
    discardPiece: vi.fn((v: GameState, id: string) => {
      v.encounter.discard.push(take(v, id));
      trace.push({ type: "discard", id });
    }),
    searchAndRevealTargeted: vi.fn(
      (v: GameState, playerId: string, after: Effect[]) => {
        let p: Piece | undefined;
        for (const zone of [v.encounter.deck, v.encounter.discard]) {
          const index = zone.findIndex((p) => p.code === "32107");
          if (index >= 0) {
            p = zone.splice(index, 1)[0];
            break;
          }
        }
        trace.push({ type: "search", id: p?.id, playerId });
        ports.queue(
          v,
          ...(p
            ? [{ type: "native-reveal", piece: p, actorId: playerId }]
            : []),
          { type: "native-shuffle", actorId: playerId },
          ...after,
        );
      },
    ),
    startAttack: vi.fn(
      (v: GameState, id: string, playerId: string, after: Effect[]) => {
        const minion = v.minions.find((p) => p.id === id);
        trace.push({
          type: minion ? "attack" : "absent-attack",
          id,
          playerId,
          form: seatView(v, playerId).player.form,
        });
        ports.queue(v, ...after);
      },
    ),
    dealBoostFacedown: vi.fn((v: GameState, id: string, playerId: string) => {
      const p = take(v, id);
      p.dealtTo = playerId;
      v.encounter.dealt.push(p);
      if (v.attack && !v.attack.retainedBoostIds?.includes(id))
        (v.attack.retainedBoostIds ||= []).push(id);
      trace.push({ type: "boost-deal", id, playerId });
    }),
  };
  const f = { s, ports, originals, trace, zones, take };
  return f;
}
type Fixture = ReturnType<typeof fixture>;
function run(f: Fixture) {
  for (let n = 0; f.s.queue.length && !f.s.prompt && n < 80; n++) {
    const e = f.s.queue.shift()!;
    if (e.actorId) activateSeat(f.s, e.actorId);
    if (pack.resolveSentinelsEffect(f.s, e, f.ports)) continue;
    if (e.type === "native-reveal") {
      f.s.resolving.push(e.piece);
      f.trace.push({
        type: "reveal",
        id: e.piece.id,
        playerId: f.s.activePlayerId,
      });
      f.ports.queue(
        f.s,
        ...(pack.sentinelsReveal(f.s, e.piece, f.ports) || []),
      );
    } else if (e.type === "native-shuffle") f.trace.push({ type: "shuffle" });
    else if (e.type === "surge")
      f.trace.push({
        type: "surge",
        id: e.sourceId,
        playerId: f.s.activePlayerId,
      });
    else if (e.type === "after")
      f.trace.push({ type: "after", playerId: f.s.activePlayerId });
    else throw Error(`Unexpected fixture effect ${e.type}`);
  }
}
function choose(f: Fixture, id: string) {
  f.s = JSON.parse(JSON.stringify(f.s));
  const option = f.s.prompt?.options.find((o) => o.id === id);
  expect(option).toBeTruthy();
  f.s.prompt = null;
  f.ports.queue(f.s, ...option!.effects);
  run(f);
}
function source(f: Fixture, code: string) {
  const p = f.s.encounter.deck.find((p) => p.code === code)!;
  expect(p, `source${code}`).toBeTruthy();
  return f.take(f.s, p.id);
}
function minion(f: Fixture, code = "32105", playerId = "p1") {
  const p = ["32105", "32106"].includes(code)
    ? source(f, code)
    : makePiece(f.s, code);
  p.engagedWith = playerId;
  f.s.minions.push(p);
  return p;
}
function attach(f: Fixture, playerId = "p1") {
  const p = source(f, "32107");
  p.attachedTo = `hero:${playerId}`;
  f.s.attachments.push(p);
  return p;
}
function side(f: Fixture) {
  const p = source(f, "32108");
  p.counters = 3 * f.s.playerCount;
  f.s.sideSchemes.push(p);
  return p;
}
function reveal(f: Fixture, code: string, playerId = "p1") {
  activateSeat(f.s, playerId);
  const p = source(f, code);
  if (card(p).type_code === "minion") {
    p.engagedWith = playerId;
    f.s.minions.push(p);
  } else f.s.resolving.push(p);
  f.ports.queue(f.s, ...(pack.sentinelsReveal(f.s, p, f.ports) || []));
  run(f);
  return p;
}
function boost(f: Fixture, playerId = "p1") {
  activateSeat(f.s, playerId);
  const p = source(f, "32106");
  f.s.resolving.push(p);
  f.s.attack = {
    id: "actual-boost-attack",
    attacker: f.s.villain.id,
    targetPlayerId: playerId,
    base: 2,
    boostIds: [p.id],
    boostCodes: [p.code],
    boostEffects: [],
    defense: 0,
    prevented: 0,
    damage: 0,
    isVillain: true,
    overkill: false,
  };
  f.ports.queue(f.s, ...(pack.sentinelsBoost(f.s, p) || []));
  run(f);
  return p;
}
function exact(f: Fixture) {
  const all = f.zones(f.s).flat();
  for (const p of f.originals)
    expect(
      all.filter((q) => q.id === p.id),
      p.id,
    ).toHaveLength(1);
}

describe("Sentinels original modular contract", () => {
  it("partitions the four exact printing codes and all seven physical source cards", () => {
    const f = fixture(),
      raw = (
        catalog as {
          code: string;
          set_code?: string;
          pack_code: string;
          quantity: number;
        }[]
      ).filter((c) => c.set_code === "sentinels");
    expect(pack.SENTINELS_SET).toBe("sentinels");
    expect(raw.map((c) => c.code)).toEqual([...pack.SENTINELS_SCRIPT_CODES]);
    expect(raw.every((c) => c.pack_code === "mut_gen")).toBe(true);
    expect(raw.map((c) => c.quantity)).toEqual([2, 2, 2, 1]);
    expect(f.originals).toHaveLength(7);
    exact(f);
  });
  it("retains exact printed minion statistics, boosts and Sentinel traits", () => {
    expect([
      card("32105").scheme,
      card("32105").attack,
      card("32105").health,
      card("32105").boost,
    ]).toEqual([1, 3, 5, 2]);
    expect([
      card("32106").scheme,
      card("32106").attack,
      card("32106").health,
      card("32106").boost || 0,
    ]).toEqual([2, 2, 5, 0]);
    expect(card("32106").boost_star).toBe(true);
    expect(card("32105").traits).toBe("Sentinel.");
    expect(card("32106").traits).toBe("Sentinel.");
  });
  it("keeps Relentless Robots base3perplayer and its printed Hazard separate", () => {
    const c = card("32108");
    expect(c.base_threat).toBe(3);
    expect(c.base_threat_fixed).not.toBe(true);
    expect(c.scheme_hazard).toBe(1);
    expect(c.boost).toBe(3);
  });
  it("preserves the imported Mark VI metadata while the runtime overlay restores the original scan's HP5", () => {
    const raw = catalog.find((c) => c.code === "32106")!;
    expect(raw.health).toBe(6);
    expect(raw.quantity).toBe(2);
    expect(card("32106").health).toBe(5);
  });
  it("keeps Mark VI printed Quickstrike exclusively native without an authored duplicate", () => {
    const f = fixture(),
      p = minion(f, "32106");
    expect(printedKeyword(card(p), "Quickstrike")).toBe(1);
    expect(pack.sentinelsReveal(f.s, p, f.ports)).toEqual([]);
    expect(f.ports.startAttack).not.toHaveBeenCalled();
  });
  it("has no synthetic actor mutation for Relentless Robots reveal", () => {
    const f = fixture(),
      p = side(f);
    expect(pack.sentinelsReveal(f.s, p, f.ports)).toEqual([]);
    expect(f.s.queue).toEqual([]);
  });
  it("does not claim another set's ordinary reveal/boost or effect", () => {
    const f = fixture(),
      p = makePiece(f.s, "32073");
    expect(pack.sentinelsReveal(f.s, p, f.ports)).toBeNull();
    expect(pack.sentinelsBoost(f.s, p)).toBeNull();
    expect(
      pack.resolveSentinelsEffect(f.s, { type: "brotherhood:attack" }, f.ports),
    ).toBe(false);
  });
  it("rejects unknown effects in its own namespace", () => {
    const f = fixture();
    expect(() =>
      pack.resolveSentinelsEffect(f.s, { type: "sentinels:unknown" }, f.ports),
    ).toThrow(/Unknown Sentinels/);
  });
  it.each(["hero", "alter"] as const)(
    "Mark V makes an actual native attack in%s when this identity has Targeted",
    (form) => {
      const f = fixture();
      attach(f);
      f.s.player.form = form;
      const p = reveal(f, "32105");
      expect(f.ports.startAttack).toHaveBeenCalledWith(f.s, p.id, "p1", []);
      expect(f.trace).toContainEqual({
        type: "attack",
        id: p.id,
        playerId: "p1",
        form,
      });
      expect(f.ports.searchAndRevealTargeted).not.toHaveBeenCalled();
      exact(f);
    },
  );
  it("Mark V references a blanked existing Targeted by name without granting its blanked form lock", () => {
    const f = fixture(),
      marker = attach(f);
    f.s.flags[`blank:${marker.id}`] = true;
    const p = reveal(f, "32105");
    expect(f.ports.startAttack).toHaveBeenCalledWith(f.s, p.id, "p1", []);
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(true);
  });
  it("Mark V ignores Targeted attached to a different identity and searches for its own", () => {
    const f = fixture();
    attach(f, "p2");
    reveal(f, "32105");
    expect(f.ports.startAttack).not.toHaveBeenCalled();
    expect(
      f.s.attachments
        .filter((p) => p.code === "32107")
        .map((p) => p.attachedTo)
        .sort(),
    ).toEqual(["hero:p1", "hero:p2"]);
    exact(f);
  });
  it.each(["deck", "discard"] as const)(
    "Mark V search REVEALS the same actual Targeted from%s and shuffles afterward",
    (zone) => {
      const f = fixture(),
        p = source(f, "32107");
      f.s.encounter.discard.push(
        ...f.s.encounter.deck.filter((q) => q.code === "32107"),
      );
      f.s.encounter.deck = f.s.encounter.deck.filter((q) => q.code !== "32107");
      f.s.encounter[zone].unshift(p);
      reveal(f, "32105");
      expect(f.s.attachments.find((q) => q.id === p.id)?.attachedTo).toBe(
        "hero:p1",
      );
      expect(f.trace.map((t) => t.type)).toEqual([
        "search",
        "reveal",
        "attach",
        "shuffle",
      ]);
      exact(f);
    },
  );
  it("failed Mark V search cannot create an absent third copy or search a player's zone", () => {
    const f = fixture();
    for (const p of [...f.s.encounter.deck].filter((p) => p.code === "32107")) {
      f.take(f.s, p.id);
      f.s.player.deck.push(p);
    }
    reveal(f, "32105");
    expect(f.s.attachments).toHaveLength(0);
    expect(f.trace.map((t) => t.type)).toEqual(["search", "shuffle"]);
    expect(f.s.player.deck.map((p) => p.code)).toEqual(["32107", "32107"]);
  });
  it("Mark V delegates Stun and other native attack replacements without fabricating damage/statuses", () => {
    const f = fixture();
    attach(f);
    const p = minion(f);
    p.stunned = true;
    p.stunCards = 1;
    f.ports.queue(f.s, ...pack.sentinelsReveal(f.s, p, f.ports)!);
    run(f);
    expect(f.ports.startAttack).toHaveBeenCalledWith(f.s, p.id, "p1", []);
    expect(p.stunned).toBe(true);
    expect(f.s.player.hp).toBe(card("32001a").health);
  });
  it("a saved Mark V trigger retains its actor and actual source through cooperative handoff", () => {
    const f = fixture();
    attach(f, "p2");
    const p = minion(f, "32105", "p2");
    activateSeat(f.s, "p2");
    const effects = pack.sentinelsReveal(f.s, p, f.ports)!;
    activateSeat(f.s, "p1");
    f.s = JSON.parse(JSON.stringify(f.s));
    f.ports.queue(f.s, ...effects);
    run(f);
    expect(f.ports.startAttack).toHaveBeenCalledWith(f.s, p.id, "p2", []);
  });
  it("if Mark V left play after its reveal trigger, the native port attempts no absent-source attack", () => {
    const f = fixture();
    attach(f);
    const p = minion(f),
      effects = pack.sentinelsReveal(f.s, p, f.ports)!;
    f.s.minions.splice(0);
    f.s.encounter.discard.push(p);
    f.ports.queue(f.s, ...effects);
    run(f);
    expect(f.trace).toContainEqual({
      type: "absent-attack",
      id: p.id,
      playerId: "p1",
      form: "hero",
    });
  });
  it("Targeted attaches its same actual physical source to its actual identity", () => {
    const f = fixture(),
      p = reveal(f, "32107", "p2");
    expect(f.s.attachments).toHaveLength(1);
    expect(f.s.attachments[0].id).toBe(p.id);
    expect(f.s.attachments[0].attachedTo).toBe("hero:p2");
    expect(f.trace.filter((t) => t.type === "surge")).toHaveLength(0);
    exact(f);
  });
  it("Targeted reveals only one attached copy per identity and Surges the other physical copy", () => {
    const f = fixture();
    const first = reveal(f, "32107"),
      second = reveal(f, "32107");
    expect(f.s.attachments.map((p) => p.id)).toEqual([first.id]);
    expect(f.trace).toContainEqual({
      type: "surge",
      id: second.id,
      playerId: "p1",
    });
    expect(f.s.resolving.map((p) => p.id)).toEqual([second.id]);
    exact(f);
  });
  it("an attached blanked Targeted still prevents another copy attaching", () => {
    const f = fixture(),
      first = attach(f);
    f.s.flags[`blank:${first.id}`] = true;
    const second = reveal(f, "32107");
    expect(f.s.attachments).toHaveLength(1);
    expect(f.trace).toContainEqual({
      type: "surge",
      id: second.id,
      playerId: "p1",
    });
  });
  it("two identities can receive the two separate physical Targeted copies", () => {
    const f = fixture();
    const a = reveal(f, "32107"),
      b = reveal(f, "32107", "p2");
    expect(a.id).not.toBe(b.id);
    expect(pack.sentinelsTargetedIdentities(f.s)).toEqual(["p1", "p2"]);
    exact(f);
  });
  it.each(["32105", "32106", "32101", "32093"])(
    "Targeted's form lock uses any actual Sentinel minion (%s)",
    (code) => {
      const f = fixture();
      attach(f);
      minion(f, code);
      expect(
        pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
      ).toBe(false);
    },
  );
  it("Targeted blocks only hero→alter, allowing alter→hero and hero-face/mode changes", () => {
    const f = fixture();
    attach(f);
    minion(f);
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "alter", "hero", f.ports),
    ).toBe(true);
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "hero", f.ports),
    ).toBe(true);
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "alter", "alter", f.ports),
    ).toBe(true);
  });
  it("Targeted does not lock an identity merely because the Sentinel villain is present", () => {
    const f = fixture();
    attach(f);
    f.s.villain.code = "32084";
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(true);
  });
  it("Targeted does not lock when an unrelated minion or another player's Sentinel is engaged", () => {
    const f = fixture();
    attach(f);
    minion(f, "32073");
    minion(f, "32105", "p2");
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(true);
  });
  it("Targeted's own blanking removes its restriction but blanking the recipient minion does not remove Sentinel traits", () => {
    const f = fixture(),
      marker = attach(f),
      m = minion(f);
    f.s.flags[`blank:${m.id}`] = true;
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(false);
    f.s.flags[`blank:${marker.id}`] = true;
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(true);
  });
  it("current granted Sentinel traits and engagement transfers affect the form lock immediately", () => {
    const f = fixture();
    attach(f);
    const m = minion(f, "32073");
    f.s.flags[`trait:${m.id}:Sentinel`] = true;
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(false);
    m.engagedWith = "p2";
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(true);
  });
  it("when its Sentinel minion leaves play, Targeted's form lock ends immediately", () => {
    const f = fixture();
    attach(f);
    const m = minion(f);
    f.s.minions = [];
    f.s.encounter.discard.push(m);
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(true);
    exact(f);
  });
  it.each(["hero", "alter"] as const)(
    "Targeted's actual identity-exhaustion Action works in%s",
    (form) => {
      const f = fixture(),
        p = attach(f);
      f.s.player.form = form;
      const option = pack.sentinelsAbilityOptions(f.s, p.id, f.ports)[0];
      expect(option.id).toBe(`discard:${p.id}`);
      f.ports.queue(f.s, ...option.effects);
      run(f);
      expect(f.s.player.exhausted).toBe(true);
      expect(f.s.attachments).toHaveLength(0);
      expect(f.trace).toEqual([
        { type: "exhaust", playerId: "p1" },
        { type: "discard", id: p.id },
      ]);
      exact(f);
    },
  );
  it("Targeted Action still works while a Sentinel locks form change", () => {
    const f = fixture(),
      p = attach(f);
    minion(f);
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(false);
    f.ports.queue(
      f.s,
      ...pack.sentinelsAbility(f.s, p.id, "discard", f.ports)!,
    );
    run(f);
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(true);
  });
  it.each(["exhausted", "blank", "prohibited"])(
    "Targeted Action is unavailable for%s identity/source",
    (mode) => {
      const f = fixture(),
        p = attach(f);
      if (mode === "exhausted") f.s.player.exhausted = true;
      if (mode === "blank") f.s.flags[`blank:${p.id}`] = true;
      if (mode === "prohibited") f.s.flags["cannotExhaust:p1"] = true;
      expect(pack.sentinelsAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
      expect(() =>
        pack.sentinelsAbility(f.s, p.id, "discard", f.ports),
      ).toThrow(/ready identity/);
      expect(f.ports.exhaustIdentity).not.toHaveBeenCalled();
    },
  );
  it("an unavailable saved Targeted Action pays no identity exhaustion cost", () => {
    const f = fixture(),
      p = attach(f),
      effects = pack.sentinelsAbilityOptions(f.s, p.id, f.ports)[0].effects;
    f.s.player.exhausted = true;
    expect(() => pack.resolveSentinelsEffect(f.s, effects[0], f.ports)).toThrow(
      /ready identity/,
    );
    expect(f.ports.exhaustIdentity).not.toHaveBeenCalled();
    expect(f.ports.discardPiece).not.toHaveBeenCalled();
  });
  it("a saved Targeted Action cannot exhaust another actual player's identity by changing the active seat", () => {
    const f = fixture(),
      p = attach(f),
      effect = pack.sentinelsAbilityOptions(f.s, p.id, f.ports)[0].effects[0];
    activateSeat(f.s, "p2");
    expect(() => pack.resolveSentinelsEffect(f.s, effect, f.ports)).toThrow(
      /ready identity/,
    );
    expect(seatView(f.s, "p1").player.exhausted).toBe(false);
    expect(f.s.player.exhausted).toBe(false);
  });
  it("only the actual active actor's identity pays a cooperative Targeted Action", () => {
    const f = fixture(),
      p = attach(f, "p2");
    activateSeat(f.s, "p2");
    f.ports.queue(
      f.s,
      ...pack.sentinelsAbility(f.s, p.id, `discard:${p.id}`, f.ports)!,
    );
    run(f);
    expect(seatView(f.s, "p1").player.exhausted).toBe(false);
    expect(seatView(f.s, "p2").player.exhausted).toBe(true);
  });
  it("a teammate cannot trigger Targeted attached to another identity or pay its cost", () => {
    const f = fixture(),
      p = attach(f, "p1");
    activateSeat(f.s, "p2");
    expect(pack.sentinelsAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    expect(() => pack.sentinelsAbility(f.s, p.id, "discard", f.ports)).toThrow(
      /ready identity/,
    );
    expect(f.ports.exhaustIdentity).not.toHaveBeenCalled();
    expect(seatView(f.s, "p1").player.exhausted).toBe(false);
    expect(seatView(f.s, "p2").player.exhausted).toBe(false);
  });
  it("does not claim an unrelated action or absent attachment", () => {
    const f = fixture(),
      p = attach(f);
    expect(pack.sentinelsAbility(f.s, p.id, "attack", f.ports)).toBeNull();
    expect(
      pack.sentinelsAbility(f.s, "missing", "discard", f.ports),
    ).toBeNull();
  });
  it("Mark VI boost with no targeted identity has no extra encounter deal", () => {
    const f = fixture(),
      p = boost(f);
    expect(f.ports.dealBoostFacedown).not.toHaveBeenCalled();
    expect(f.s.resolving.map((q) => q.id)).toEqual([p.id]);
    exact(f);
  });
  it("Mark VI boost moves the same physical card facedown to the uniquely targeted other player", () => {
    const f = fixture();
    attach(f, "p2");
    const p = boost(f, "p1");
    expect(f.s.encounter.dealt.map((q) => [q.id, q.code, q.dealtTo])).toEqual([
      [p.id, "32106", "p2"],
    ]);
    expect(f.s.attack?.retainedBoostIds).toEqual([p.id]);
    expect(f.s.attack?.boostIds).toEqual([p.id]);
    expect(f.s.minions).toHaveLength(0);
    expect(f.s.resolving).toHaveLength(0);
    expect(f.trace).toEqual([{ type: "boost-deal", id: p.id, playerId: "p2" }]);
    exact(f);
  });
  it("blanked Targeted still qualifies its attached identity for Mark VI's named boost condition", () => {
    const f = fixture(),
      marker = attach(f, "p2");
    f.s.flags[`blank:${marker.id}`] = true;
    const p = boost(f);
    expect(f.ports.dealBoostFacedown).toHaveBeenCalledWith(f.s, p.id, "p2");
  });
  it("Mark VI offers actual identity IDs when both original Targeted copies are attached", () => {
    const f = fixture();
    attach(f, "p1");
    attach(f, "p2");
    const p = boost(f, "p3");
    expect(f.s.prompt?.title).toBe("Sentinel Mark VI");
    expect(f.s.activePlayerId).toBe(f.s.firstPlayerId);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    choose(f, "p2");
    expect(f.s.encounter.dealt.map((q) => [q.id, q.dealtTo])).toEqual([
      [p.id, "p2"],
    ]);
    expect(f.s.activePlayerId).toBe("p3");
    exact(f);
  });
  it("Mark VI's saved recipient choice revalidates the actual attached marker before moving the boost", () => {
    const f = fixture();
    attach(f);
    const marker = attach(f, "p2");
    boost(f);
    f.s.attachments = f.s.attachments.filter((p) => p.id !== marker.id);
    f.s.encounter.discard.push(marker);
    expect(() => choose(f, "p2")).toThrow(/no longer has/);
    expect(f.ports.dealBoostFacedown).not.toHaveBeenCalled();
  });
  it("Mark VI ignores an eliminated identity's attached marker", () => {
    const f = fixture();
    attach(f, "p2");
    f.s.players.find((p) => p.id === "p2")!.eliminated = true;
    boost(f);
    expect(f.ports.dealBoostFacedown).not.toHaveBeenCalled();
  });
  it.each(["32105", "32107", "32108"])(
    "%s contributes its printed numeric boost only without an invented star effect",
    (code) => {
      const f = fixture(),
        p = source(f, code);
      expect(pack.sentinelsBoost(f.s, p)).toEqual([]);
      expect(f.s.queue).toEqual([]);
      expect(f.ports.dealBoostFacedown).not.toHaveBeenCalled();
    },
  );
  it("Relentless blocks actual THW by the player engaged with a Sentinel, including their allies", () => {
    const f = fixture(),
      scheme = side(f);
    minion(f);
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p1", f.ports)).toBe(false);
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p2", f.ports)).toBe(true);
  });
  it("Relentless cannot be bypassed by hero-form changes or keyword ignore permissions", () => {
    const f = fixture(),
      scheme = side(f);
    minion(f, "32105", "p2");
    f.s.flags.ignorePatrol = true;
    seatView(f.s, "p2").player.form = "alter";
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p2", f.ports)).toBe(false);
  });
  it("Relentless's own text blanking removes THW restriction while blanking the Sentinel does not", () => {
    const f = fixture(),
      scheme = side(f),
      m = minion(f);
    f.s.flags[`blank:${m.id}`] = true;
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p1", f.ports)).toBe(false);
    f.s.flags[`blank:${scheme.id}`] = true;
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p1", f.ports)).toBe(true);
  });
  it("Relentless restriction follows actual current engagement and granted Sentinel trait", () => {
    const f = fixture(),
      scheme = side(f),
      m = minion(f, "32073");
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p1", f.ports)).toBe(true);
    f.s.flags[`trait:${m.id}:Sentinel`] = true;
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p1", f.ports)).toBe(false);
    m.engagedWith = "p2";
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p1", f.ports)).toBe(true);
    expect(pack.sentinelsCanThwart(f.s, scheme.id, "p2", f.ports)).toBe(false);
  });
  it("Relentless does not affect a different scheme, main scheme or native non-THW removal", () => {
    const f = fixture(),
      scheme = side(f);
    minion(f);
    expect(pack.sentinelsCanThwart(f.s, "main", "p1", f.ports)).toBe(true);
    expect(pack.sentinelsCanThwart(f.s, "other", "p1", f.ports)).toBe(true);
    expect(f.s.queue).toHaveLength(0);
    expect(scheme.counters).toBe(9);
    // The host calls this predicate only for actual THW. It makes no global
    // threat-removal prohibition or mutation that can affect ordinary removal.
  });
  it.each(["32105", "32106", "32107", "32108"])(
    "blanked%s reveals no authored ability text",
    (code) => {
      const f = fixture(),
        p = source(f, code);
      f.s.flags[`blank:${p.id}`] = true;
      expect(pack.sentinelsReveal(f.s, p, f.ports)).toEqual([]);
    },
  );
  it("Targeted legacy hero target resolves to its actual active solo identity", () => {
    const f = fixture(),
      marker = attach(f);
    marker.attachedTo = "hero";
    f.s.players = [f.s.players[0]];
    f.s.playerCount = 1;
    minion(f);
    expect(pack.sentinelsTargetedIdentities(f.s)).toEqual(["p1"]);
    expect(
      pack.sentinelsCanChangeForm(f.s, "p1", "hero", "alter", f.ports),
    ).toBe(false);
  });
});
