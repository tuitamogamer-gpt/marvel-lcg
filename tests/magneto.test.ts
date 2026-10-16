import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { playerOrder, seatView } from "../src/game/team";
import type { Card, Effect, Piece } from "../src/game/types";
import {
  MAGNETO_SCENARIO,
  MAGNETO_SCRIPT_CODES,
  MAGNETO_SET,
  magnetoActionOptions,
  magnetoAddCounters,
  magnetoAfterEnemyAttack,
  magnetoAttachmentTargets,
  magnetoBasicAttackResponseOptions,
  magnetoBoost,
  magnetoBoostAllyDefeated,
  magnetoDamageCap,
  magnetoIdentityRestricted,
  magnetoInitialize,
  magnetoMainChanged,
  magnetoMainRevealed,
  magnetoMainThreatLimit,
  magnetoMinionDefeated,
  magnetoModifiers,
  magnetoReplaceDamage,
  magnetoReveal,
  magnetoSetup,
  magnetoSideSchemeBaseThreat,
  magnetoSideSchemeDefeated,
  resolveMagnetoEffect,
  type MagnetoBasicAttackReceipt,
  type MagnetoEnemyAttackReceipt,
  type MagnetoGameState,
  type MagnetoPorts,
} from "../src/game/magneto";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
const allyCode = (catalog as Card[]).find((c) => c.type_code === "ally")!.code;
const piece = (code: string, id = `piece-${code}`): Piece => ({
  code,
  id,
  damage: 0,
  counters: 0,
  exhausted: false,
  tough: false,
  stunned: false,
  confused: false,
});
const M = (name: string, args: Record<string, unknown> = {}): Effect => ({
  type: `magneto:${name}`,
  ...args,
});
function fixture(count = 1) {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    heroId: "spider_man",
    aspect: "justice",
    flags: {},
    eliminated: false,
    ended: false,
    player: {
      form: "hero",
      exhausted: false,
      hp: 10,
      hand: [] as Piece[],
      deck: [] as Piece[],
      discard: [] as Piece[],
      inPlay: [] as Piece[],
    },
  }));
  let s = {
    villainId: MAGNETO_SCENARIO,
    playerCount: count,
    firstPlayerId: "p1",
    activePlayerId: "p1",
    players,
    player: players[0].player,
    flags: players[0].flags,
    villain: {
      ...piece("32138", "villain-original"),
      hp: 18 * count,
      maxHp: 18 * count,
      stage: 1,
    },
    scheme: { code: "32141b", threat: count, index: 0 },
    sideSchemes: [],
    attachments: [],
    minions: [],
    resolving: [],
    removed: [],
    environments: [],
    victoryDisplay: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    queue: [],
    prompt: null,
    phase: "player",
    nextId: 1,
    attack: null,
  } as unknown as MagnetoGameState;
  const blank = new Set<string>();
  const events: string[] = [];
  let payable = true;
  const zones = () => [
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.resolving,
    s.removed,
    s.victoryDisplay!,
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    ...(s.villain.inheritorBoosts ? [s.villain.inheritorBoosts] : []),
    ...s.players.flatMap((p) => {
      const v = seatView(s, p).player;
      return [v.hand, v.deck, v.discard, v.inPlay];
    }),
  ];
  const take = (id: string) => {
    for (const zone of zones()) {
      const i = zone.findIndex((p) => p.id === id);
      if (i >= 0) return zone.splice(i, 1)[0];
    }
    return undefined;
  };
  const find = (id: string) =>
    [
      s.villain,
      ...zones().flat(),
      ...(s.magneto?.orbital ? [s.magneto.orbital] : []),
    ].find((p) => p.id === id);
  const recycle = () => {
    if (!s.encounter.deck.length && s.encounter.discard.length) {
      s.encounter.deck = s.encounter.discard.splice(0);
      s.encounter.acceleration++;
      events.push("exhaustion");
    }
  };
  const ports: MagnetoPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (_state, p) => blank.has(p.id || p.code) || blank.has(p.code),
    hasTrait: (_state, id, trait) =>
      !!find(id) &&
      (cards.get(find(id)!.code)?.traits || "")
        .split(/\.\s*/)
        .some((t) => t.toLowerCase() === trait.toLowerCase()),
    findPiece: (_state, id) => find(id),
    revealEncounter: vi.fn((_state, p, id, after) => {
      take(p.id);
      events.push(`reveal:${p.id}:${id}:${s.magneto?.magnetCounters}`);
      if (cards.get(p.code)?.type_code === "attachment") s.resolving.push(p);
      else if (cards.get(p.code)?.type_code === "side_scheme") {
        s.sideSchemes.push(p);
        p.counters = magnetoSideSchemeBaseThreat(s, p)!;
      } else s.resolving.push(p);
      ports.queue(s, ...(magnetoReveal(s, p, ports) || []), ...after);
    }),
    revealSide: vi.fn((_state, p, id, after) => {
      take(p.id);
      s.sideSchemes.push(p);
      p.counters = magnetoSideSchemeBaseThreat(s, p)!;
      events.push(`side:${p.id}:${p.code}:${id}`);
      ports.queue(s, ...(magnetoReveal(s, p, ports) || []), ...after);
    }),
    attach: vi.fn((_state, p, target) => {
      take(p.id);
      p.attachedTo = target;
      s.attachments.push(p);
      events.push(`attach:${p.id}:${target}`);
    }),
    addToVictory: vi.fn((_state, p) => {
      take(p.id);
      s.victoryDisplay!.push(p);
      events.push(`victory:${p.id}`);
    }),
    discardPiece: vi.fn((_state, id) => {
      const p = take(id);
      if (p) s.encounter.discard.push(p);
      events.push(`discard:${id}`);
    }),
    discardTop: vi.fn((_state, after) => {
      recycle();
      const p = s.encounter.deck.shift();
      if (p) {
        s.encounter.discard.push(p);
        events.push(`mill:${p.id}`);
      }
      const emptied = !!p && !s.encounter.deck.length;
      recycle();
      if (after)
        ports.queue(s, { ...after, id: p?.id, code: p?.code, emptied });
      return { piece: p, emptied };
    }),
    searchAndReveal: vi.fn((_state, kind, id) =>
      events.push(`search:${kind}:${id}`),
    ),
    dealEncounter: vi.fn((_state, id) => events.push(`deal:${id}`)),
    giveTough: vi.fn((_state, id) => {
      const p = find(id);
      if (!p || p.tough) return false;
      p.tough = true;
      events.push(`tough:${id}`);
      return true;
    }),
    giveFacedownBoost: vi.fn((_state, supplied) => {
      const p = supplied ? take(supplied.id) : s.encounter.deck.shift();
      if (p) (s.villain.inheritorBoosts ||= []).push(p);
      events.push(`boost:${p?.id || "none"}`);
    }),
    activateEnemy: vi.fn((_state, enemy, id, kind, _sourceId, after) =>
      ports.queue(s, { type: "fixture:activation", enemy, id, kind, after }),
    ),
    damageBatch: vi.fn((_state, targets, sourceId, playerId) =>
      ports.queue(s, { type: "fixture:damage", targets, sourceId, playerId }),
    ),
    status: vi.fn((_state, targetId, status, sourceId) =>
      ports.queue(s, { type: "fixture:status", targetId, status, sourceId }),
    ),
    addMainThreat: vi.fn((_state, amount) =>
      ports.queue(s, { type: "fixture:threat", amount }),
    ),
    exhaustIdentity: vi.fn((_state, id) => {
      seatView(s, id).player.exhausted = true;
      events.push(`exhaust:${id}`);
    }),
    exhaustControlled: vi.fn((_state, id, kind) => {
      for (const p of seatView(s, id).player.inPlay)
        if (
          kind === "ally"
            ? cards.get(p.code)?.type_code === "ally" && !p.treatedAsMinion
            : ["upgrade", "support"].includes(
                cards.get(p.code)?.type_code || "",
              )
        )
          p.exhausted = true;
      events.push(`exhaust-controlled:${id}:${kind}`);
    }),
    defeatMinion: vi.fn((_state, id, playerId, after) => {
      const p = take(id);
      if (p) {
        s.encounter.discard.push(p);
        events.push(`defeat:${id}`);
        ports.queue(
          s,
          ...(magnetoMinionDefeated(s, p, playerId, ports) || []),
          ...after,
        );
      }
    }),
    discardPlayerTopUnder: vi.fn((_state, id, count, target, after) => {
      const p = find(target);
      if (p) {
        const removed = seatView(s, id).player.deck.splice(0, count);
        for (const c of removed) c.ownerId = id;
        (p.storedCards ||= []).push(...removed);
        events.push(`under:${target}:${id}:${removed.length}`);
      }
      ports.queue(s, ...after);
    }),
    discardStoredCards: vi.fn((_state, id) => {
      const p = find(id);
      for (const c of p?.storedCards?.splice(0) || [])
        seatView(s, c.ownerId!).player.discard.push(c);
      events.push(`release:${id}`);
    }),
    discardHandCard: vi.fn((_state, id, cardId) => {
      const p = take(cardId);
      if (p) seatView(s, id).player.discard.push(p);
      events.push(`hand-discard:${id}:${cardId}`);
    }),
    canExhaustIdentity: (_state, id) => !seatView(s, id).player.exhausted,
    canPay: () => payable,
    pay: vi.fn(
      (view, _title, cost, requirements, after, sourceId, exhaustPlayerId) => {
        events.push(
          `pay:${view.activePlayerId}:${cost}:${requirements.join("/")}:${sourceId}`,
        );
        if (exhaustPlayerId) ports.exhaustIdentity(s, exhaustPlayerId);
        ports.queue(s, ...after);
      },
    ),
    registerAllyDefeatBoost: vi.fn((_state, sourceId, attackId) =>
      events.push(`register:${sourceId}:${attackId}`),
    ),
  };
  const run = (...effects: Effect[]) => {
    ports.queue(s, ...effects);
    let steps = 0;
    while (s.queue.length && !s.prompt) {
      if (++steps > 150) throw Error("Unbounded Magneto continuation");
      const e = s.queue.shift()!;
      if (e.type === "fixture:activation") {
        events.push(`activate:${e.enemy}:${e.id}:${e.kind}`);
        ports.queue(s, ...(e.after || []));
      } else if (e.type === "fixture:damage")
        events.push(
          `damage:${e.targets.map((t: { id: string; amount: number }) => `${t.id}/${t.amount}`).join(",")}`,
        );
      else if (e.type === "fixture:status")
        events.push(`status:${e.targetId}:${e.status}`);
      else if (e.type === "fixture:threat") {
        s.scheme.threat += e.amount;
        events.push(`threat:${e.amount}`);
      } else expect(resolveMagnetoEffect(s, e, ports), e.type).toBe(true);
    }
  };
  const choose = (id: string) => {
    const selected = s.prompt?.options.find((p) => p.id === id);
    expect(selected, `No choice ${id}`).toBeDefined();
    s.prompt = null;
    run(...selected!.effects);
  };
  const reload = () => {
    s = JSON.parse(JSON.stringify(s));
    const p = s.players.find((p) => p.id === s.activePlayerId)!;
    s.player = p.player;
    s.flags = p.flags;
    magnetoInitialize(s);
  };
  const attach = (
    code: string,
    target = s.villain.id,
    id = `attached-${code}`,
  ) => {
    const p = piece(code, id);
    p.attachedTo = target;
    s.attachments.push(p);
    return p;
  };
  const basic = (
    changes: Partial<MagnetoBasicAttackReceipt> = {},
  ): MagnetoBasicAttackReceipt => ({
    token: "basic-1",
    playerId: "p1",
    targetId: s.villain.id,
    performed: true,
    ...changes,
  });
  const attack = (
    changes: Partial<MagnetoEnemyAttackReceipt> = {},
  ): MagnetoEnemyAttackReceipt => ({
    token: "attack-1",
    playerId: "p1",
    enemyId: s.villain.id,
    enemyCode: s.villain.code,
    performed: true,
    ...changes,
  });
  return {
    get s() {
      return s;
    },
    ports,
    events,
    blank,
    take,
    run,
    choose,
    reload,
    attach,
    basic,
    attack,
    setPayable: (value: boolean) => {
      payable = value;
    },
  };
}

describe("Magneto standalone source scope and physical setup", () => {
  it("registers exactly its 26 original faces, retaining the raw set code", () => {
    expect(MAGNETO_SET).toBe("magneto_villain");
    expect(MAGNETO_SCRIPT_CODES).toHaveLength(26);
    expect(new Set(MAGNETO_SCRIPT_CODES).size).toBe(26);
    expect(MAGNETO_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(MAGNETO_SCRIPT_CODES).not.toContain("32159");
  });
  it("sets aside the actual Orbital and reveals the original Boarding once", () => {
    const f = fixture(2);
    const pieces = {
      boarding: piece("32144a", "boarding-original"),
      orbital: piece("32145a", "orbital-original"),
    };
    magnetoSetup(f.s, pieces, f.ports);
    f.run();
    expect(f.s.magneto!.orbital).toBe(pieces.orbital);
    expect(f.s.sideSchemes[0]).toBe(pieces.boarding);
    expect(pieces.boarding.counters).toBe(6);
    magnetoSetup(f.s, pieces, f.ports);
    expect(f.ports.revealSide).toHaveBeenCalledTimes(1);
  });
  it("rejects swapped, cloned-ID and nonnative setup cards", () => {
    const f = fixture();
    expect(() =>
      magnetoSetup(
        f.s,
        { boarding: piece("32144b"), orbital: piece("32145a") },
        f.ports,
      ),
    ).toThrow(/original/);
    expect(() =>
      magnetoSetup(
        f.s,
        { boarding: piece("32144a", "same"), orbital: piece("32145a", "same") },
        f.ports,
      ),
    ).toThrow(/distinct/);
    f.s.villainId = "rhino";
    expect(() =>
      magnetoSetup(
        f.s,
        { boarding: piece("32144a"), orbital: piece("32145a") },
        f.ports,
      ),
    ).toThrow(/native/);
  });
  it("keeps native main/villain ownership metadata during initialize and setup", () => {
    const f = fixture();
    const main = piece("32141b", "main-original");
    const next = piece("32139", "next-villain");
    magnetoInitialize(f.s).currentMain = main;
    f.s.magneto!.villainDeck = [next];
    magnetoSetup(
      f.s,
      { boarding: piece("32144a"), orbital: piece("32145a") },
      f.ports,
    );
    expect(f.s.magneto!.currentMain).toBe(main);
    expect(f.s.magneto!.villainDeck![0]).toBe(next);
  });
  it.each([1, 2, 4])(
    "scales all printed main and progress thresholds for %i players",
    (n) => {
      const f = fixture(n);
      for (const [i, code] of ["32141b", "32142b", "32143b"].entries()) {
        f.s.scheme.code = code;
        expect(magnetoMainThreatLimit(f.s)).toBe((i + 5) * n);
      }
      for (const code of ["32144a", "32144b", "32145a", "32158"])
        expect(magnetoSideSchemeBaseThreat(f.s, piece(code))).toBe(3 * n);
      expect(magnetoSideSchemeBaseThreat(f.s, piece("32156"))).toBe(4);
      expect(magnetoSideSchemeBaseThreat(f.s, piece("32157"))).toBe(2);
    },
  );
  it("returns unrelated effects/cards to the host", () => {
    const f = fixture();
    expect(magnetoReveal(f.s, piece("01001"), f.ports)).toBeNull();
    expect(magnetoBoost(f.s, piece("01001"))).toBeNull();
    expect(
      magnetoMinionDefeated(f.s, piece("01001"), "p1", f.ports),
    ).toBeNull();
    expect(resolveMagnetoEffect(f.s, { type: "other:effect" }, f.ports)).toBe(
      false,
    );
  });
});

describe("Magnet counters use current Rules Reference 1.8 ordering", () => {
  it("removes three BEFORE searching/revealing the exact Magnetic card", () => {
    const f = fixture();
    magnetoInitialize(f.s).magnetCounters = 2;
    f.s.magneto!.mainCode = f.s.scheme.code;
    const mundane = piece("32146", "first");
    const helmet = piece("32147", "helmet-original");
    f.s.encounter.deck.push(mundane, helmet, piece("32146", "tail"));
    magnetoAddCounters(f.s, 1, f.ports);
    f.run();
    expect(f.events).toContain("reveal:helmet-original:p1:0");
    expect(f.s.attachments.find((p) => p.id === helmet.id)).toBe(helmet);
    expect(f.s.encounter.discard).toContain(mundane);
    expect(f.s.magneto!.magnetCounters).toBe(0);
  });
  it("removes counters even if finite search exhausts without finding Magnetic", () => {
    const f = fixture();
    magnetoInitialize(f.s).mainCode = f.s.scheme.code;
    f.s.encounter.deck.push(piece("32146", "one"), piece("32146", "two"));
    f.run(M("place-counters", { amount: 3 }));
    expect(f.s.magneto!.magnetCounters).toBe(0);
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.ports.revealEncounter).not.toHaveBeenCalled();
  });
  it("a Magnetic card adding another counter resolves after removal, without recursion", () => {
    const f = fixture();
    magnetoInitialize(f.s).mainCode = f.s.scheme.code;
    f.s.encounter.deck.push(
      piece("32153", "blast-original"),
      piece("32147", "helmet-original"),
    );
    f.run(M("place-counters", { amount: 3 }));
    expect(f.s.magneto!.magnetCounters).toBe(1);
    expect(f.events.filter((e) => e.startsWith("reveal:"))).toEqual([
      "reveal:blast-original:p1:0",
    ]);
    expect(f.s.encounter.deck.map((p) => p.id)).toEqual(["helmet-original"]);
  });
  it("reveals a final Magnetic card even after native recycle moved it", () => {
    const f = fixture();
    magnetoInitialize(f.s).mainCode = f.s.scheme.code;
    const p = piece("32147", "last-original");
    f.s.encounter.deck.push(p);
    f.run(M("place-counters", { amount: 3 }));
    expect(f.s.attachments).toEqual([p]);
    expect(f.s.encounter.acceleration).toBe(1);
    expect(f.s.encounter.deck).toEqual([]);
  });
  it("blanked main text allows counters without firing its response", () => {
    const f = fixture();
    f.blank.add(f.s.scheme.code);
    f.run(M("place-counters", { amount: 3 }));
    expect(f.s.magneto!.magnetCounters).toBe(3);
    expect(f.ports.discardTop).not.toHaveBeenCalled();
  });
  it("returns old counters when a new physical main scheme is revealed", () => {
    const f = fixture();
    magnetoInitialize(f.s).magnetCounters = 5;
    magnetoMainChanged(f.s, "32142a");
    f.s.scheme.code = "32142b";
    f.run(...magnetoMainRevealed(f.s, "32142a"));
    expect(f.s.magneto!.magnetCounters).toBe(1);
    expect(f.events).toContain("search:sentinel:p1");
  });
  it("Factory skips search only when Sabotage is in the actual Victory zone", () => {
    const f = fixture();
    f.s.victoryDisplay!.push(piece("32144b", "sabotage-original"));
    f.run(M("stage-search", { kind: "sentinel" }));
    expect(f.ports.searchAndReveal).not.toHaveBeenCalled();
    f.s.victoryDisplay = [];
    f.s.encounter.discard.push(piece("32144b", "discarded-copy"));
    f.run(M("stage-search", { kind: "sentinel" }));
    expect(f.ports.searchAndReveal).toHaveBeenCalledTimes(1);
  });
  it("Rule of Magnus places two and skips its search only for attached Physical Strain", () => {
    const f = fixture();
    f.s.scheme.code = "32143b";
    magnetoMainChanged(f.s);
    f.attach("32145b");
    f.run(...magnetoMainRevealed(f.s, "32143a"));
    expect(f.s.magneto!.magnetCounters).toBe(2);
    expect(f.ports.searchAndReveal).not.toHaveBeenCalled();
    f.s.attachments = [];
    f.run(M("stage-search", { kind: "magnetic-attachment", actorId: "p1" }));
    expect(f.events).toContain("search:magnetic-attachment:p1");
  });
  it("a stale response cannot remove counters from the next main scheme", () => {
    const f = fixture();
    magnetoInitialize(f.s).magnetCounters = 3;
    f.s.scheme.code = "32142b";
    f.run(M("magnetic-response", { mainCode: "32141b" }));
    expect(f.s.magneto!.magnetCounters).toBe(3);
    expect(f.ports.discardTop).not.toHaveBeenCalled();
  });
});

describe("physical progress schemes and continuous Magneto rules", () => {
  it("flips Boarding and Orbital in place and sends Sabotage itself to Victory", () => {
    const f = fixture();
    const boarding = piece("32144a", "boarding-original");
    const orbital = piece("32145a", "orbital-original");
    magnetoSetup(f.s, { boarding, orbital }, f.ports);
    f.run();
    expect(magnetoDamageCap(f.s, f.ports)).toBe(6);
    f.run(...magnetoSideSchemeDefeated(f.s, boarding, "p1", f.ports)!);
    expect(f.s.sideSchemes[0]).toBe(boarding);
    expect(boarding.code).toBe("32144b");
    expect(magnetoDamageCap(f.s, f.ports)).toBe(12);
    f.run(...magnetoSideSchemeDefeated(f.s, boarding, "p1", f.ports)!);
    expect(f.s.victoryDisplay).toEqual([boarding]);
    expect(f.s.sideSchemes).toEqual([orbital]);
    expect(f.s.magneto!.orbital).toBeUndefined();
    expect(magnetoDamageCap(f.s, f.ports)).toBe(18);
    f.run(...magnetoSideSchemeDefeated(f.s, orbital, "p1", f.ports)!);
    expect(orbital.code).toBe("32145b");
    expect(f.s.attachments).toEqual([orbital]);
    expect(orbital.attachedTo).toBe(f.s.villain.id);
    expect(magnetoDamageCap(f.s, f.ports)).toBeUndefined();
    expect(magnetoModifiers(f.s, f.s.villain, f.ports).losesSteady).toBe(true);
  });
  it("survives JSON hydration between progress defeat and its flip", () => {
    const f = fixture();
    const boarding = piece("32144a", "boarding-original");
    f.s.sideSchemes.push(boarding);
    f.ports.queue(
      f.s,
      ...magnetoSideSchemeDefeated(f.s, boarding, "p1", f.ports)!,
    );
    f.reload();
    f.run();
    expect(f.s.sideSchemes).toHaveLength(1);
    expect(f.s.sideSchemes[0].id).toBe("boarding-original");
    expect(f.s.sideSchemes[0].code).toBe("32144b");
  });
  it("ignores a blanked progress limit and preserves other active limits", () => {
    const f = fixture(3);
    f.s.sideSchemes.push(
      piece("32144a", "boarding"),
      piece("32145a", "orbital"),
    );
    expect(magnetoDamageCap(f.s, f.ports)).toBe(18);
    f.blank.add("boarding");
    expect(magnetoDamageCap(f.s, f.ports)).toBe(54);
    f.blank.add("orbital");
    expect(magnetoDamageCap(f.s, f.ports)).toBeUndefined();
  });
  it("Bubble absorbs the entire allowed damage event and discards at eight without overflow", () => {
    const f = fixture();
    const bubble = f.attach("32149");
    bubble.damage = 7;
    expect(magnetoReplaceDamage(f.s, f.s.villain.id, 5, f.ports)).toBe(0);
    expect(bubble.damage).toBe(12);
    expect(f.s.encounter.discard).toContain(bubble);
    expect(f.s.villain.hp).toBe(18);
  });
  it("Bubble takes no damage for zero, unrelated targets, or blanked text", () => {
    const f = fixture();
    const bubble = f.attach("32149");
    expect(
      magnetoReplaceDamage(f.s, f.s.villain.id, 0, f.ports),
    ).toBeUndefined();
    expect(magnetoReplaceDamage(f.s, "other", 5, f.ports)).toBeUndefined();
    f.blank.add(bubble.id);
    expect(
      magnetoReplaceDamage(f.s, f.s.villain.id, 3, f.ports),
    ).toBeUndefined();
    expect(bubble.damage).toBe(0);
  });
  it("Helmet/Armor deny only their printed statuses, and Bubble grants Retaliate", () => {
    const f = fixture();
    f.attach("32147");
    f.attach("32148");
    const bubble = f.attach("32149");
    expect(magnetoModifiers(f.s, f.s.villain, f.ports)).toMatchObject({
      attack: 1,
      scheme: 1,
      cannotStun: true,
      cannotConfuse: true,
      retaliate: 1,
      losesSteady: false,
    });
    expect(
      magnetoModifiers(f.s, piece("32146", "minion"), f.ports),
    ).toMatchObject({
      attack: 0,
      scheme: 0,
      cannotStun: false,
      cannotConfuse: false,
      retaliate: 0,
    });
    f.blank.add(bubble.id);
    expect(magnetoModifiers(f.s, f.s.villain, f.ports).retaliate).toBe(0);
  });
  it("Wrapped applies to its actual identity and disallows a second physical copy", () => {
    const f = fixture(2);
    const p = piece("32150", "wrapped-original");
    f.s.resolving.push(p);
    f.run(...magnetoReveal(f.s, p, f.ports)!);
    expect(p.attachedTo).toBe("hero:p1");
    expect(magnetoIdentityRestricted(f.s, "p1", f.ports)).toBe(true);
    expect(magnetoIdentityRestricted(f.s, "p2", f.ports)).toBe(false);
    expect(
      magnetoAttachmentTargets(f.s, piece("32150", "second"), "p1"),
    ).toEqual([]);
    f.blank.add(p.id);
    expect(magnetoIdentityRestricted(f.s, "p1", f.ports)).toBe(false);
  });
  it("Wrapped pays physical and commits exhaustion as a cost before discard", () => {
    const f = fixture();
    const wrapped = f.attach("32150", "hero:p1");
    const [o] = magnetoActionOptions(f.s, wrapped.id, f.ports);
    f.run(...o.effects);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.attachments).toEqual([]);
    expect(f.s.encounter.discard).toContain(wrapped);
    expect(f.events.indexOf("exhaust:p1")).toBeLessThan(
      f.events.indexOf(`discard:${wrapped.id}`),
    );
    expect(f.ports.pay).toHaveBeenCalledWith(
      f.s,
      "Wrapped in Metal",
      1,
      ["physical"],
      expect.any(Array),
      wrapped.id,
      "p1",
    );
  });
  it("Wrapped action is absent for an exhausted identity, wrong owner or unfunded cost", () => {
    const f = fixture(2);
    const wrapped = f.attach("32150", "hero:p1");
    f.s.player.exhausted = true;
    expect(magnetoActionOptions(f.s, wrapped.id, f.ports)).toEqual([]);
    f.s.player.exhausted = false;
    f.setPayable(false);
    expect(magnetoActionOptions(f.s, wrapped.id, f.ports)).toEqual([]);
    f.setPayable(true);
    expect(
      magnetoActionOptions(seatView(f.s, "p2"), wrapped.id, f.ports),
    ).toEqual([]);
  });
});

describe("Magneto actual attack and payment response windows", () => {
  it("places one magnet after any performed Magneto attack, including zero damage", () => {
    const f = fixture();
    f.run(...magnetoAfterEnemyAttack(f.s, f.attack(), f.ports));
    expect(f.s.magneto!.magnetCounters).toBe(1);
    f.run(...magnetoAfterEnemyAttack(f.s, f.attack(), f.ports));
    expect(f.s.magneto!.magnetCounters).toBe(1);
  });
  it.each([
    { performed: false },
    { token: "" },
    { enemyId: "minion" },
    { enemyCode: "32146" },
  ])("does not count a canceled, absent, or unrelated attack %#", (changes) => {
    const f = fixture();
    expect(magnetoAfterEnemyAttack(f.s, f.attack(changes), f.ports)).toEqual(
      [],
    );
  });
  it("blanked villain loses its printed forced attack response", () => {
    const f = fixture();
    f.blank.add(f.s.villain.id);
    expect(magnetoAfterEnemyAttack(f.s, f.attack(), f.ports)).toEqual([]);
  });
  it("registers Shards only on this actual attack and fires once per boost source", () => {
    const f = fixture();
    f.s.attack = { id: "attack-physical" } as typeof f.s.attack;
    f.run(...magnetoBoost(f.s, piece("32154", "shards-original"))!);
    expect(f.events).toContain("register:shards-original:attack-physical");
    const r = {
      sourceId: "shards-original",
      attackId: "attack-physical",
      allyId: "defeated-ally",
    };
    f.run(...magnetoBoostAllyDefeated(f.s, r));
    f.run(...magnetoBoostAllyDefeated(f.s, r));
    expect(f.s.magneto!.magnetCounters).toBe(1);
    expect(magnetoBoostAllyDefeated(f.s, { ...r, allyId: "" })).toEqual([]);
  });
  it("M-Type defeat and boost give Magneto tough; boost also assigns an original facedown card", () => {
    const f = fixture();
    f.s.encounter.deck.push(piece("32152", "physical-boost"));
    f.run(...magnetoMinionDefeated(f.s, piece("32146"), "p1", f.ports)!);
    expect(f.s.villain.tough).toBe(true);
    f.s.villain.tough = false;
    f.run(...magnetoBoost(f.s, piece("32146", "sentinel-boost"))!);
    expect(f.s.villain.tough).toBe(true);
    expect(f.s.villain.inheritorBoosts![0].id).toBe("physical-boost");
  });
  it("Helmet and Armor offer separate optional responses after a performed basic hero attack", () => {
    const f = fixture();
    const helmet = f.attach("32147");
    const armor = f.attach("32148");
    const options = magnetoBasicAttackResponseOptions(f.s, f.basic(), f.ports);
    expect(options.map((o) => o.image)).toEqual([helmet.code, armor.code]);
    f.run(...options[0].effects);
    expect(f.s.encounter.discard).toContain(helmet);
    expect(f.s.attachments).toContain(armor);
    expect(f.ports.pay).toHaveBeenCalledWith(
      f.s,
      "Magneto's Helmet",
      3,
      ["energy", "mental", "physical"],
      expect.any(Array),
      helmet.id,
    );
    expect(
      magnetoBasicAttackResponseOptions(f.s, f.basic(), f.ports),
    ).toHaveLength(1);
  });
  it.each([{ performed: false }, { token: "" }, { targetId: "minion" }])(
    "excludes invalid basic attack receipt %#",
    (changes) => {
      const f = fixture();
      f.attach("32147");
      expect(
        magnetoBasicAttackResponseOptions(f.s, f.basic(changes), f.ports),
      ).toEqual([]);
    },
  );
  it("basic response uses the real attacking player's form and resource availability", () => {
    const f = fixture(2);
    f.attach("32147");
    f.s.players[1].player.form = "alter";
    expect(
      magnetoBasicAttackResponseOptions(
        f.s,
        f.basic({ playerId: "p2" }),
        f.ports,
      ),
    ).toEqual([]);
    f.s.players[1].player.form = "hero";
    f.setPayable(false);
    expect(
      magnetoBasicAttackResponseOptions(
        f.s,
        f.basic({ playerId: "p2" }),
        f.ports,
      ),
    ).toEqual([]);
  });
});

describe("source treacheries, boosts and stored cards", () => {
  it("II/III each deal an actual encounter to every surviving player", () => {
    const f = fixture(3);
    f.s.players[1].eliminated = true;
    f.run(...magnetoReveal(f.s, piece("32139"), f.ports)!);
    expect(f.events).toEqual(["deal:p1", "deal:p3"]);
  });
  it("Master of Magnetism moves the topmost Magnetic discard as its same physical boost", () => {
    const f = fixture();
    const p = piece("32147", "magnetic-original");
    const lower = piece("32154", "lower-original");
    f.s.encounter.discard.push(lower, p, piece("32146", "nonmagnetic-top"));
    f.run(...magnetoReveal(f.s, piece("32151", "master-original"), f.ports)!);
    expect(f.s.villain.inheritorBoosts).toEqual([p]);
    expect(f.s.encounter.discard).toContain(lower);
    expect(f.events.at(-1)).toBe(`activate:${f.s.villain.id}:p1:attack`);
  });
  it("Master of Magnetism still activates against alter ego without a Magnetic discard", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.run(...magnetoReveal(f.s, piece("32151"), f.ports)!);
    expect(f.ports.giveFacedownBoost).not.toHaveBeenCalled();
    expect(f.events.at(-1)).toBe(`activate:${f.s.villain.id}:p1:scheme`);
  });
  it("Electric Shock stuns before hero damage using the current counter count", () => {
    const f = fixture();
    magnetoInitialize(f.s).magnetCounters = 2;
    f.run(...magnetoReveal(f.s, piece("32152"), f.ports)!);
    expect(f.events).toEqual(["status:hero:p1:stunned", "damage:hero:p1/2"]);
  });
  it("Electric Shock confuses alter ego and adds one threat per magnet", () => {
    const f = fixture();
    f.s.player.form = "alter";
    magnetoInitialize(f.s).magnetCounters = 4;
    f.run(...magnetoReveal(f.s, piece("32152"), f.ports)!);
    expect(f.events).toEqual(["status:hero:p1:confused", "threat:4"]);
    expect(f.s.scheme.threat).toBe(5);
  });
  it("Blast exhausts only this player's actual upgrades/supports before placing its magnet", () => {
    const f = fixture(2);
    const upgradeCode = (catalog as Card[]).find(
      (c) => c.type_code === "upgrade",
    )!.code;
    const own = piece(upgradeCode, "own");
    const other = piece(upgradeCode, "other");
    const ally = piece(allyCode, "ally");
    f.s.player.inPlay.push(own, ally);
    f.s.players[1].player.inPlay.push(other);
    f.run(...magnetoReveal(f.s, piece("32153"), f.ports)!);
    expect(own.exhausted).toBe(true);
    expect(other.exhausted).toBe(false);
    expect(ally.exhausted).toBe(false);
    expect(f.s.magneto!.magnetCounters).toBe(1);
  });
  it("Shards damages this player's identity/allies before its magnet response can reveal another card", () => {
    const f = fixture(2);
    f.s.player.inPlay.push(piece(allyCode, "own-ally"));
    f.s.players[1].player.inPlay.push(piece(allyCode, "other-ally"));
    magnetoInitialize(f.s).magnetCounters = 2;
    f.s.magneto!.mainCode = f.s.scheme.code;
    f.s.encounter.deck.push(
      piece("32147", "revealed-helmet"),
      piece("32146", "tail"),
    );
    f.run(...magnetoReveal(f.s, piece("32154", "shards"), f.ports)!);
    expect(f.events[0]).toBe("damage:hero:p1/1,own-ally/1");
    expect(f.events.findIndex((e) => e.startsWith("reveal:"))).toBeGreaterThan(
      0,
    );
  });
  it("Magnetic Missile cannot perform its then-damage without defeating a Sentinel", () => {
    const f = fixture();
    f.run(...magnetoReveal(f.s, piece("32155"), f.ports)!);
    expect(f.ports.defeatMinion).not.toHaveBeenCalled();
    expect(f.ports.damageBatch).not.toHaveBeenCalled();
  });
  it("Missile defeats the chosen actual Sentinel before optional prevention and damage", () => {
    const f = fixture();
    const sentinel = piece("32146", "sentinel-original");
    f.s.minions.push(sentinel, piece("32146", "other-sentinel"));
    f.s.player.hand.push(
      piece("01001", "hand-one"),
      piece("01002", "hand-two"),
    );
    f.run(...magnetoReveal(f.s, piece("32155", "missile-original"), f.ports)!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([
      "sentinel-original",
      "other-sentinel",
    ]);
    f.choose(sentinel.id);
    expect(f.events).toContain("defeat:sentinel-original");
    expect(f.s.villain.tough).toBe(true);
    f.choose("hand-one");
    f.reload();
    f.choose("take-damage");
    expect(f.events.at(-1)).toBe("damage:hero:p1/4");
    expect(f.s.player.discard.map((p) => p.id)).toEqual(["hand-one"]);
    expect(f.s.minions.map((p) => p.id)).toEqual(["other-sentinel"]);
  });
  it("Missile can prevent all five damage with five actual discarded hand cards", () => {
    const f = fixture();
    f.s.minions.push(piece("32146", "sentinel"));
    for (let i = 0; i < 5; i++)
      f.s.player.hand.push(piece("01001", `hand-${i}`));
    f.run(...magnetoReveal(f.s, piece("32155"), f.ports)!);
    for (let i = 0; i < 5; i++) f.choose(`hand-${i}`);
    expect(f.s.player.discard).toHaveLength(5);
    expect(f.ports.damageBatch).not.toHaveBeenCalled();
    expect(f.s.prompt).toBeNull();
  });
  it("Magnetic Mayhem stops discarding at first deck exhaustion and counts only actual Magnetic cards", () => {
    const f = fixture();
    f.s.encounter.deck.push(
      piece("32153", "magnetic-one"),
      piece("32146", "ordinary"),
    );
    f.run(
      ...magnetoSideSchemeDefeated(
        f.s,
        piece("32156", "mayhem-original"),
        "p1",
        f.ports,
      )!,
    );
    expect(f.ports.discardTop).toHaveBeenCalledTimes(2);
    expect(f.s.magneto!.magnetCounters).toBe(1);
    expect(f.s.encounter.acceleration).toBe(1);
  });
  it("Mayhem repeats single magnet placements with responses between placements", () => {
    const f = fixture();
    const four = ["32153", "32154", "32152", "32147"].map((code, i) =>
      piece(code, `mill-${i}`),
    );
    f.s.encounter.deck.push(
      ...four,
      piece("32152", "threshold-shock"),
      piece("32146", "tail"),
    );
    f.run(...magnetoSideSchemeDefeated(f.s, piece("32156"), "p1", f.ports)!);
    expect(f.s.magneto!.magnetCounters).toBe(1);
    expect(f.events).toContain("reveal:threshold-shock:p1:0");
    expect(f.events).toContain("damage:hero:p1/0");
  });
  it("Magnetically Sealed counts allies across all surviving players", () => {
    const f = fixture(3);
    f.s.player.inPlay.push(piece(allyCode, "one"));
    f.s.players[1].player.inPlay.push(piece(allyCode, "two"));
    f.s.players[2].player.inPlay.push(piece(allyCode, "eliminated"));
    f.s.players[2].eliminated = true;
    const seized = piece("32157", "sealed-original");
    seized.counters = 2;
    f.s.sideSchemes.push(seized);
    f.run(...magnetoReveal(f.s, seized, f.ports)!);
    expect(seized.counters).toBe(6);
  });
  it("Seized stores each player's same original cards under one scheme and returns them to their owners on defeat", () => {
    const f = fixture(2);
    const scheme = piece("32158", "seized-original");
    f.s.sideSchemes.push(scheme);
    for (const p of playerOrder(f.s))
      for (let i = 0; i < 7; i++)
        seatView(f.s, p).player.deck.push(
          piece("01001", `${p.id}-original-${i}`),
        );
    f.run(...magnetoReveal(f.s, scheme, f.ports)!);
    f.choose("p1");
    expect(scheme.storedCards).toHaveLength(12);
    expect(f.s.player.deck).toHaveLength(1);
    f.s.players[1].player.form = "alter";
    f.reload();
    const physical = f.s.sideSchemes[0];
    f.run(...magnetoSideSchemeDefeated(f.s, physical, "p2", f.ports)!);
    expect(f.s.players[0].player.discard.map((p) => p.id)).toEqual(
      Array.from({ length: 6 }, (_, i) => `p1-original-${i}`),
    );
    expect(f.s.players[1].player.discard.map((p) => p.id)).toEqual(
      Array.from({ length: 6 }, (_, i) => `p2-original-${i}`),
    );
    expect(f.events).toContain(`activate:${f.s.villain.id}:p2:scheme`);
    expect(
      f.events.indexOf(`activate:${f.s.villain.id}:p2:scheme`),
    ).toBeLessThan(f.events.indexOf("release:seized-original"));
    expect(f.s.encounter.discard.some((p) => p.id === "seized-original")).toBe(
      true,
    );
  });
  it("Blast and Sealed boost effects exhaust the actual defending player's cards", () => {
    const f = fixture(2);
    f.s.players[1].player.inPlay.push(piece(allyCode, "other-ally"));
    f.s.player.inPlay.push(piece(allyCode, "own-ally"));
    f.run(...magnetoBoost(f.s, piece("32153"))!);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.players[1].player.exhausted).toBe(false);
    f.run(...magnetoBoost(f.s, piece("32157"))!);
    expect(f.s.player.inPlay[0].exhausted).toBe(true);
    expect(f.s.players[1].player.inPlay[0].exhausted).toBe(false);
  });
  it("blanked source cards lose their reveal and defeat abilities", () => {
    const f = fixture();
    for (const code of [
      "32139",
      "32152",
      "32153",
      "32154",
      "32155",
      "32158",
      "32146",
      "32144a",
    ]) {
      f.blank.add(code);
      expect(magnetoReveal(f.s, piece(code), f.ports)).toEqual([]);
      expect(magnetoMinionDefeated(f.s, piece(code), "p1", f.ports)).toEqual(
        [],
      );
      expect(
        magnetoSideSchemeDefeated(f.s, piece(code), "p1", f.ports),
      ).toEqual([]);
    }
  });
});

describe("interrupt ordering and continuation regressions", () => {
  it("resolves native deck-exhaustion effects before revealing the final Magnetic card", () => {
    const f = fixture();
    const discard = f.ports.discardTop;
    f.ports.discardTop = vi.fn((state, after) => {
      const result = discard(state, after);
      if (result.emptied)
        f.ports.queue(state, { type: "fixture:threat", amount: 1 });
      return result;
    });
    f.s.encounter.deck.push(piece("32147", "final-helmet"));
    f.run(M("place-counters", { amount: 3 }));
    expect(f.events.indexOf("threat:1")).toBeLessThan(
      f.events.indexOf("reveal:final-helmet:p1:0"),
    );
    expect(f.s.attachments.map((p) => p.id)).toEqual(["final-helmet"]);
  });
  it("hydrates a discarded Magnetic card's original ID across a recycled-deck continuation", () => {
    const f = fixture();
    magnetoInitialize(f.s).magnetCounters = 3;
    f.s.encounter.deck.push(piece("32147", "original-helmet"));
    expect(
      resolveMagnetoEffect(
        f.s,
        M("magnetic-response", { mainCode: f.s.scheme.code }),
        f.ports,
      ),
    ).toBe(true);
    expect(resolveMagnetoEffect(f.s, f.s.queue.shift()!, f.ports)).toBe(true);
    expect(f.s.queue[0]).toMatchObject({
      type: "magneto:magnetic-mill-result",
      id: "original-helmet",
      code: "32147",
      emptied: true,
    });
    f.reload();
    f.run();
    expect(f.s.attachments.map((p) => p.id)).toEqual(["original-helmet"]);
    expect(f.s.encounter.deck).toEqual([]);
  });
  it("Mayhem at two magnets with four Magnetic discards resolves two separate searches", () => {
    const f = fixture();
    magnetoInitialize(f.s).magnetCounters = 2;
    f.s.magneto!.mainCode = f.s.scheme.code;
    f.s.encounter.deck.push(
      ...["32152", "32153", "32154", "32155"].map((code, i) =>
        piece(code, `discard-${i}`),
      ),
      piece("32147", "first-search"),
      piece("32148", "second-search"),
      piece("32146", "tail"),
    );
    f.run(...magnetoSideSchemeDefeated(f.s, piece("32156"), "p1", f.ports)!);
    expect(f.events.filter((e) => e.startsWith("reveal:"))).toEqual([
      "reveal:first-search:p1:0",
      "reveal:second-search:p1:0",
    ]);
    expect(f.s.magneto!.magnetCounters).toBe(0);
  });
  it("Seized lets the first player choose either player's complete effect first", () => {
    const f = fixture(2);
    const scheme = piece("32158", "seized");
    f.s.sideSchemes.push(scheme);
    for (const seat of playerOrder(f.s))
      seatView(f.s, seat).player.deck.push(
        piece("01001", `original-${seat.id}`),
      );
    f.run(...magnetoReveal(f.s, scheme, f.ports)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    f.choose("p2");
    expect(f.events.filter((e) => e.startsWith("under:"))).toEqual([
      "under:seized:p2:1",
      "under:seized:p1:1",
    ]);
    expect(scheme.storedCards!.map((p) => p.id)).toEqual([
      "original-p2",
      "original-p1",
    ]);
  });
  it("offers the remaining paid attachment response for the same actual basic attack", () => {
    const f = fixture();
    const helmet = f.attach("32147");
    const armor = f.attach("32148");
    f.run(
      ...magnetoBasicAttackResponseOptions(f.s, f.basic(), f.ports)[0].effects,
    );
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      `magneto-response:${armor.id}:basic-1`,
      "continue",
    ]);
    f.choose(`magneto-response:${armor.id}:basic-1`);
    expect(f.s.encounter.discard).toEqual([helmet, armor]);
    expect(f.ports.pay).toHaveBeenCalledTimes(2);
    expect(f.s.prompt).toBeNull();
  });
  it("retains the basic-attack response when Magneto advances to his next original stage", () => {
    const f = fixture();
    f.attach("32147");
    const receipt = f.basic({
      targetId: "retired-original-stage",
      targetCode: "32138",
    });
    f.s.villain.code = "32139";
    expect(
      magnetoBasicAttackResponseOptions(f.s, receipt, f.ports),
    ).toHaveLength(1);
    expect(
      magnetoBasicAttackResponseOptions(
        f.s,
        { ...receipt, targetCode: "32146" },
        f.ports,
      ),
    ).toEqual([]);
  });
  it("does not remove existing stun/confuse status cards when Helmet or Armor enters", () => {
    const f = fixture();
    f.s.villain.stunned = true;
    f.s.villain.confused = true;
    f.s.villain.stunCards = 2;
    f.s.villain.confuseCards = 2;
    for (const code of ["32147", "32148"]) {
      const p = piece(code);
      f.s.resolving.push(p);
      f.run(...magnetoReveal(f.s, p, f.ports)!);
    }
    expect(f.s.villain).toMatchObject({
      stunned: true,
      confused: true,
      stunCards: 2,
      confuseCards: 2,
    });
  });
});

describe("physical main-front and villain-stage continuations", () => {
  it.each([
    ["32142a", 1],
    ["32143a", 2],
  ] as const)(
    "places counters on %s before its native back is revealed",
    (front, expected) => {
      const f = fixture();
      f.s.scheme.code = front;
      magnetoMainChanged(f.s, front);
      f.run(...magnetoMainRevealed(f.s, front));
      expect(f.s.magneto!.magnetCounters).toBe(expected);
      expect(f.s.magneto!.mainCode).toBe(front.replace(/a$/, "b"));
      f.s.scheme.code = front.replace(/a$/, "b");
      f.run(M("place-counters", { amount: 1 }));
      expect(f.s.magneto!.magnetCounters).toBe(expected === 2 ? 0 : 2);
    },
  );
  it("retains the same Magneto character's attack response across an original villain-stage change", () => {
    const f = fixture();
    f.s.villain.code = "32139";
    f.run(
      ...magnetoAfterEnemyAttack(
        f.s,
        f.attack({ enemyCode: "32138" }),
        f.ports,
      ),
    );
    expect(f.s.magneto!.magnetCounters).toBe(1);
  });
});

describe("Seized When Defeated activation owns its deferred cleanup", () => {
  it("keeps the original scheme and owned hidden cards until its activation completes", () => {
    const f = fixture();
    const scheme = piece("32158", "seized-original");
    const stored = piece("01001", "hidden-original");
    stored.ownerId = "p1";
    scheme.storedCards = [stored];
    f.s.sideSchemes.push(scheme);
    const [effect] = magnetoSideSchemeDefeated(f.s, scheme, "p1", f.ports)!;
    expect(resolveMagnetoEffect(f.s, effect, f.ports)).toBe(true);
    expect(f.s.sideSchemes).toEqual([scheme]);
    expect(scheme.storedCards).toEqual([stored]);
    expect(f.s.player.discard).toEqual([]);
    expect(f.s.queue[0]).toMatchObject({
      type: "fixture:activation",
      after: [{ type: "magneto:seized-cleanup", id: scheme.id }],
    });
    f.reload();
    f.run();
    expect(f.s.sideSchemes).toEqual([]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([stored.id]);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([scheme.id]);
  });
});
