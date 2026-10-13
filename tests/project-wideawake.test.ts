import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { playerOrder, seatView } from "../src/game/team";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types";
import {
  PROJECT_WIDEAWAKE_SCRIPT_CODES,
  PROJECT_WIDEAWAKE_SET,
  projectWideawakeActionOptions,
  projectWideawakeAfterMainThreatPlaced,
  projectWideawakeAllyAttackModifiers,
  projectWideawakeAllyAttackResponseOptions,
  projectWideawakeBoost,
  projectWideawakeBombCount,
  projectWideawakeConsequentialReduction,
  projectWideawakeEndPlayerPhase,
  projectWideawakeEndPlayerTurn,
  projectWideawakeEnemyLeftPlay,
  projectWideawakeFirstPlayerChanged,
  projectWideawakeGrantsPermanent,
  projectWideawakeInitialize,
  projectWideawakeJubileeController,
  projectWideawakeJubileeCountsAgainstAllyLimit,
  projectWideawakeMainThreatLimit,
  projectWideawakeModifiers,
  projectWideawakeReveal,
  projectWideawakeSetup,
  projectWideawakeSetupCaptureEffects,
  projectWideawakeSideSchemeDefeated,
  resolveProjectWideawakeEffect,
  type ProjectWideawakeGameState,
  type ProjectWideawakePorts,
  type WideawakeAllyAttackReceipt,
} from "../src/game/project-wideawake";

const cards = new Map((catalog as Card[]).map((c) => [c.code, c]));
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
      hand: [],
      deck: [],
      discard: [],
      inPlay: [],
    },
  }));
  const s = {
    villainId: PROJECT_WIDEAWAKE_SET,
    playerCount: count,
    firstPlayerId: "p1",
    activePlayerId: "p1",
    players,
    player: players[0].player,
    flags: players[0].flags,
    villain: {
      ...piece("32084", "villain"),
      hp: 16 * count,
      maxHp: 16 * count,
      stage: 1,
    },
    scheme: { code: "32087b", threat: count, index: 0 },
    sideSchemes: [],
    attachments: [],
    minions: [],
    resolving: [],
    removed: [],
    environments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    queue: [],
    prompt: null,
    phase: "player",
    nextId: 1,
  } as unknown as ProjectWideawakeGameState;
  const events: string[] = [];
  const blank = new Set<string>();
  const payments: {
    cost: number;
    requirements: Resource[];
    after: Effect[];
    sourceId: string;
    commit: Effect[];
  }[] = [];
  const inPlay = () =>
    playerOrder(s).flatMap((p) => seatView(s, p).player.inPlay);
  const zones = () => [
    s.sideSchemes,
    s.attachments,
    s.minions,
    s.resolving,
    s.removed,
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    ...s.players.flatMap((p) => {
      const view = seatView(s, p);
      return [
        view.player.inPlay,
        view.player.deck,
        view.player.discard,
        view.player.hand,
      ];
    }),
  ];
  const take = (id: string) => {
    for (const zone of zones()) {
      const i = zone.findIndex((p) => p.id === id);
      if (i >= 0) return zone.splice(i, 1)[0];
    }
    return undefined;
  };
  const ports: ProjectWideawakePorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    isTextBlank: (_state, p) => blank.has(p.id || p.code) || blank.has(p.code),
    findPiece: (_state, id) =>
      zones()
        .flat()
        .find((p) => p.id === id) ||
      inPlay()
        .flatMap((p) => p.captured || [])
        .find((p) => p.id === id),
    findAlly: (state, id) => {
      for (const player of playerOrder(state)) {
        const p = seatView(state, player).player.inPlay.find(
          (p) =>
            p.id === id &&
            cards.get(p.code)?.type_code === "ally" &&
            !p.treatedAsMinion,
        );
        if (p) return { piece: p, playerId: player.id };
      }
      return undefined;
    },
    revealSetupSideScheme: vi.fn((state, p, after) => {
      events.push(`setup:${p.code}`);
      state.sideSchemes.push(p);
      ports.queue(state, ...after);
    }),
    searchAndRevealSideScheme: vi.fn((state, code, id, after) => {
      events.push(`search-scheme:${code}:${id}`);
      ports.queue(state, ...after);
    }),
    searchAndRevealMinion: vi.fn((state, trait, id, after) => {
      events.push(`search-minion:${trait}:${id}`);
      ports.queue(state, ...after);
    }),
    flipMallToJubilee: vi.fn((state, p, id) => {
      events.push("flip-mall");
      take(p.id);
      p.code = "32088b";
      p.counters = 0;
      delete p.pendingDefeat;
      seatView(state, id).player.inPlay.push(p);
    }),
    discardOtherJubilees: vi.fn(() =>
      events.push("discard-other-jubilee-allies"),
    ),
    transferAllyControl: vi.fn((state, id, playerId) => {
      const p = take(id);
      if (p) seatView(state, playerId).player.inPlay.push(p);
    }),
    putAlly: vi.fn((state, p, playerId) => {
      p.ownerId = playerId;
      seatView(state, playerId).player.inPlay.push(p);
    }),
    randomIndex: vi.fn(() => 0),
    canCapturePlayerTop: (state, id) =>
      seatView(state, id).player.deck.length > 0,
    capturePlayerTop: vi.fn((state, id, _source, after) => {
      const top = seatView(state, id).player.deck.shift();
      events.push(top ? `capture:${top.id}` : "capture:none");
      const operation = state.sideSchemes.find(
        (p: Piece) => p.code === "32104",
      );
      if (top) {
        operation!.captured ||= [];
        operation!.captured.push(top);
      }
      ports.queue(
        state,
        ...after.map((e: Effect) => ({ ...e, captured: !!top })),
      );
    }),
    captureCard: vi.fn((state, p, _id, after) => {
      take(p.id);
      const operation = state.sideSchemes.find(
        (p: Piece) => p.code === "32104",
      )!;
      operation.captured ||= [];
      operation.captured.push(p);
      ports.queue(state, ...after);
    }),
    removeMainThreat: vi.fn((state, amount) => {
      events.push(`remove:${amount}`);
      state.scheme.threat = Math.max(0, state.scheme.threat - amount);
    }),
    dealEncounter: vi.fn((_state, id) => events.push(`deal:${id}`)),
    enemyAttack: vi.fn((_state, id, playerId) =>
      events.push(`attack:${id}:${playerId}`),
    ),
    damageBatch: vi.fn((_state, targets, source, playerId) => {
      events.push(
        `damage:${source}:${playerId}:${targets.map((t: { id: string; amount: number }) => `${t.id}=${t.amount}`).join(",")}`,
      );
    }),
    enemyTargets: (state) =>
      [state.villain, ...state.minions].map((p) => ({
        id: p.id,
        label: cards.get(p.code)?.name || p.code,
      })),
    canExhaust: (state, id) =>
      id === "hero"
        ? !state.player.exhausted
        : !!ports.findAlly(state, id) &&
          !ports.findAlly(state, id)!.piece.exhausted,
    exhaust: vi.fn((state, id) => {
      if (id === "hero") state.player.exhausted = true;
      else ports.findAlly(state, id)!.piece.exhausted = true;
    }),
    canPay: vi.fn(() => true),
    pay: vi.fn(
      (_state, _title, cost, requirements, after, sourceId, commit = []) => {
        payments.push({ cost, requirements, after, sourceId, commit });
      },
    ),
    attach: vi.fn((state, p, target, boost) => {
      take(p.id);
      p.attachedTo = target;
      state.attachments.push(p);
      events.push(`attach:${p.id}:${boost}`);
    }),
    putBoostMinion: vi.fn((state, p, playerId) => {
      take(p.id);
      p.engagedWith = playerId;
      state.minions.push(p);
    }),
    discardPiece: vi.fn((state, id) => {
      const p = take(id);
      if (p) state.encounter.discard.push(p);
    }),
    clearVillainStatuses: vi.fn((state) => {
      events.push("clear-statuses");
      state.villain.tough =
        state.villain.stunned =
        state.villain.confused =
          false;
      state.villain.toughCards =
        state.villain.stunCards =
        state.villain.confuseCards =
          0;
    }),
    giveVillainTough: vi.fn((state) => {
      events.push("give-tough");
      state.villain.tough = true;
      state.villain.toughCards = 1;
    }),
    healVillain: vi.fn((state, amount) => {
      events.push(`heal:${amount}`);
      state.villain.hp = Math.min(
        state.villain.maxHp,
        state.villain.hp + amount,
      );
    }),
  };
  const run = (effects: Effect[] = []) => {
    ports.queue(s, ...effects);
    for (let i = 0; s.queue.length && !s.prompt; i++) {
      if (i > 100) throw Error("Pure Wideawake queue did not terminate.");
      const e = s.queue.shift()!;
      if (e.actorId && s.players.some((p) => p.id === e.actorId)) {
        s.activePlayerId = e.actorId;
        s.player = s.players.find((p) => p.id === e.actorId)!.player;
      }
      expect(resolveProjectWideawakeEffect(s, e, ports)).toBe(true);
    }
  };
  const choose = (id: string) => {
    const option = s.prompt!.options.find((o) => o.id === id)!;
    expect(option).toBeTruthy();
    s.prompt = null;
    run(option.effects);
  };
  const pay = (cancel = false) => {
    const pending = payments.pop()!;
    if (!cancel) run([...pending.commit, ...pending.after]);
  };
  return { s, ports, events, blank, payments, run, choose, pay, piece, zones };
}
const attack = (
  ally: Piece,
  values: Partial<WideawakeAllyAttackReceipt> = {},
): WideawakeAllyAttackReceipt => ({
  token: "attack-1",
  allyId: ally.id,
  allyCode: ally.code,
  playerId: "p1",
  targetId: "villain",
  targetCode: "32084",
  performed: true,
  defeatedMinion: false,
  ...values,
});

describe("Project Wideawake pure printed-card contract", () => {
  it("covers exactly the 19 original faces and 24 original physical cards", () => {
    expect(PROJECT_WIDEAWAKE_SCRIPT_CODES).toHaveLength(19);
    expect(new Set(PROJECT_WIDEAWAKE_SCRIPT_CODES).size).toBe(19);
    const original = (catalog as Card[]).filter(
      (c) => c.set_code === PROJECT_WIDEAWAKE_SET,
    );
    expect(original.map((c) => c.code).sort()).toEqual(
      [...PROJECT_WIDEAWAKE_SCRIPT_CODES].sort(),
    );
    expect(
      original.filter((c) => !c.hidden).reduce((n, c) => n + c.quantity, 0),
    ).toBe(24);
    expect(cards.get("32088a")?.base_threat_fixed).toBe(true);
    expect(cards.get("32100")?.base_threat_fixed).toBe(true);
  });

  it("sets aside actual original Captives and reveals physical setup schemes in order", () => {
    const f = fixture();
    const captives = ["32089", "32090", "32091", "32092"].map((code) =>
      piece(code),
    );
    const mall = piece("32088a"),
      operation = piece("32104");
    projectWideawakeInitialize(f.s);
    projectWideawakeSetup(f.s, { captives, mall, operation }, f.ports);
    expect(f.s.projectWideawake!.setAsideCaptives).toEqual(captives);
    expect(f.s.projectWideawake!.setAsideCaptives[0]).toBe(captives[0]);
    f.run();
    expect(f.events).toEqual(["setup:32104", "setup:32088a"]);
    expect(f.s.sideSchemes).toEqual([operation, mall]);
    projectWideawakeSetup(f.s, { captives, mall, operation }, f.ports);
    expect(f.ports.revealSetupSideScheme).toHaveBeenCalledTimes(2);
  });

  it("rejects fabricated duplicates and missing original setup Captives", () => {
    const f = fixture();
    expect(() =>
      projectWideawakeSetup(
        f.s,
        {
          captives: [piece("32089")],
          mall: piece("32088a"),
          operation: piece("32104"),
        },
        f.ports,
      ),
    ).toThrow(/four actual/);
    const captives = ["32089", "32090", "32091", "32092"].map((code) =>
      piece(code, "same"),
    );
    expect(() =>
      projectWideawakeSetup(
        f.s,
        { captives, mall: piece("32088a"), operation: piece("32104") },
        f.ports,
      ),
    ).toThrow(/distinct physical/);
  });

  it.each([
    ["32084", []],
    ["32085", ["p2", "p3"]],
    ["32086", ["p1", "p2", "p3"]],
  ])(
    "stage %s searches/reveals before its exact facedown deal",
    (code, dealt) => {
      const f = fixture(3);
      f.s.villain.code = code as string;
      f.run(projectWideawakeReveal(f.s, f.s.villain, f.ports)!);
      expect(f.events).toEqual([
        "search-scheme:32100:p1",
        ...(dealt as string[]).map((id) => `deal:${id}`),
      ]);
    },
  );

  it("returns native unlimited zero and grants permanent from live main text", () => {
    const f = fixture();
    expect(projectWideawakeMainThreatLimit(f.s)).toBe(0);
    expect(projectWideawakeGrantsPermanent(f.s, piece("32104"), f.ports)).toBe(
      true,
    );
    f.blank.add("32104");
    expect(projectWideawakeGrantsPermanent(f.s, piece("32104"), f.ports)).toBe(
      true,
    );
    f.blank.add("32087b");
    expect(projectWideawakeGrantsPermanent(f.s, piece("32104"), f.ports)).toBe(
      false,
    );
    expect(projectWideawakeGrantsPermanent(f.s, piece("32101"), f.ports)).toBe(
      false,
    );
  });

  it.each([
    { actualAmount: 0, threatAfter: 5 },
    { actualAmount: 4, threatAfter: 4 },
    { actualAmount: 5, threatAfter: 5, schemeCode: "other" },
  ])(
    "does not trigger for prevented/insufficient/wrong-scheme placement %j",
    (values) => {
      const f = fixture();
      expect(
        projectWideawakeAfterMainThreatPlaced(
          f.s,
          { token: "placement", schemeCode: "32087b", ...values },
          f.ports,
        ),
      ).toEqual([]);
    },
  );

  it("captures exactly once for a large placement then removes only5N", () => {
    const f = fixture(2);
    f.s.sideSchemes.push(piece("32104"));
    const top = piece("01001", "physical-top");
    f.s.player.deck.push(top, piece("01002", "next-top"));
    f.s.scheme.threat = 32;
    const effects = projectWideawakeAfterMainThreatPlaced(
      f.s,
      {
        token: "large",
        schemeCode: "32087b",
        actualAmount: 30,
        threatAfter: 32,
      },
      f.ports,
    );
    f.run(effects);
    expect(f.events).toEqual(["capture:physical-top", "remove:10"]);
    expect(f.s.scheme.threat).toBe(22);
    expect(f.s.sideSchemes[0].captured).toEqual([top]);
    f.run(effects);
    expect(f.ports.capturePlayerTop).toHaveBeenCalledTimes(1);
    expect(f.s.player.deck[0].id).toBe("next-top");
  });

  it("does not resolve THEN removal without an actual captured top card", () => {
    const f = fixture();
    f.s.sideSchemes.push(piece("32104"));
    f.s.scheme.threat = 5;
    f.run(
      projectWideawakeAfterMainThreatPlaced(
        f.s,
        {
          token: "empty",
          schemeCode: "32087b",
          actualAmount: 4,
          threatAfter: 5,
        },
        f.ports,
      ),
    );
    expect(f.events).toEqual(["capture:none"]);
    expect(f.ports.removeMainThreat).not.toHaveBeenCalled();
    expect(f.s.scheme.threat).toBe(5);
  });

  it("snapshots the qualifying placement and uses the current first player's physical deck", () => {
    const f = fixture(2);
    f.s.firstPlayerId = "p2";
    f.s.sideSchemes.push(piece("32104"));
    f.s.players[1].player.deck.push(piece("01001", "p2-top"));
    const effects = projectWideawakeAfterMainThreatPlaced(
      f.s,
      {
        token: "p2-placement",
        schemeCode: "32087b",
        actualAmount: 10,
        threatAfter: 10,
      },
      f.ports,
    );
    f.s.scheme.threat = 3;
    f.run(effects);
    expect(f.events).toEqual(["capture:p2-top", "remove:10"]);
  });

  it("Mall searches/reveals a Sentinel before flipping the SAME physical card", () => {
    const f = fixture(2);
    const mall = piece("32088a", "physical-mall");
    mall.pendingDefeat = true;
    f.s.sideSchemes.push(mall);
    f.run(projectWideawakeSideSchemeDefeated(f.s, mall, "p2", f.ports)!);
    expect(f.events).toEqual([
      "search-minion:Sentinel:p1",
      "discard-other-jubilee-allies",
      "flip-mall",
    ]);
    expect(f.s.players[0].player.inPlay[0]).toBe(mall);
    expect(mall.code).toBe("32088b");
    expect(f.s.projectWideawake!.jubileeId).toBe("physical-mall");
    expect(f.s.sideSchemes).toEqual([]);
  });

  it("Jubilee moves exact physical control and blank text retains prior control", () => {
    const f = fixture(2);
    const jubilee = piece("32088b", "mall-jubilee");
    f.s.player.inPlay.push(jubilee);
    projectWideawakeInitialize(f.s).jubileeId = jubilee.id;
    expect(
      projectWideawakeJubileeCountsAgainstAllyLimit(f.s, jubilee, f.ports),
    ).toBe(false);
    f.s.firstPlayerId = "p2";
    f.blank.add(jubilee.id);
    projectWideawakeFirstPlayerChanged(f.s, f.ports);
    expect(projectWideawakeJubileeController(f.s, f.ports)).toBe("p1");
    expect(
      projectWideawakeJubileeCountsAgainstAllyLimit(f.s, jubilee, f.ports),
    ).toBe(true);
    f.blank.delete(jubilee.id);
    projectWideawakeFirstPlayerChanged(f.s, f.ports);
    expect(projectWideawakeJubileeController(f.s, f.ports)).toBe("p2");
    expect(f.s.players[1].player.inPlay[0]).toBe(jubilee);
    expect(f.s.players[0].player.inPlay).toHaveLength(0);
  });

  it("Abduction takes a random real Captive and assigns the actual defeating player's ownership", () => {
    const f = fixture(2);
    const captives = [piece("32089"), piece("32090")];
    projectWideawakeInitialize(f.s).setAsideCaptives.push(...captives);
    vi.mocked(f.ports.randomIndex).mockReturnValue(1);
    f.run(
      projectWideawakeSideSchemeDefeated(f.s, piece("32100"), "p2", f.ports)!,
    );
    expect(f.s.players[1].player.inPlay[0]).toBe(captives[1]);
    expect(captives[1].ownerId).toBe("p2");
    expect(f.s.projectWideawake!.setAsideCaptives).toEqual([captives[0]]);
    expect(f.ports.randomIndex).toHaveBeenCalledWith(f.s, 2);
  });

  it("empty captive pool creates no card and consumes no randomness", () => {
    const f = fixture();
    projectWideawakeInitialize(f.s);
    f.run(
      projectWideawakeSideSchemeDefeated(f.s, piece("32100"), "p1", f.ports)!,
    );
    expect(f.ports.putAlly).not.toHaveBeenCalled();
    expect(f.ports.randomIndex).not.toHaveBeenCalled();
  });

  it("Jubilee's unlabeled action pays typed energy and atomically commits exhaustion", () => {
    const f = fixture();
    const jubilee = piece("32088b");
    f.s.player.form = "alter";
    f.s.player.inPlay.push(jubilee);
    f.run(projectWideawakeActionOptions(f.s, jubilee.id, f.ports)[0].effects);
    f.choose("villain");
    expect(f.payments[0]).toMatchObject({
      cost: 1,
      requirements: ["energy"],
      sourceId: jubilee.id,
    });
    expect(jubilee.exhausted).toBe(false);
    expect(f.ports.damageBatch).not.toHaveBeenCalled();
    f.pay();
    expect(jubilee.exhausted).toBe(true);
    expect(f.ports.damageBatch).toHaveBeenCalledWith(
      f.s,
      [{ id: "villain", amount: 2 }],
      jubilee.id,
      "p1",
    );
    expect(f.ports.enemyAttack).not.toHaveBeenCalled();
  });

  it("canceling Jubilee payment preserves readiness and deals no damage", () => {
    const f = fixture();
    const jubilee = piece("32088b");
    f.s.player.inPlay.push(jubilee);
    f.run(projectWideawakeActionOptions(f.s, jubilee.id, f.ports)[0].effects);
    f.choose("villain");
    f.pay(true);
    expect(jubilee.exhausted).toBe(false);
    expect(f.ports.damageBatch).not.toHaveBeenCalled();
  });

  it.each([
    ["32094", "physical"],
    ["32095", "mental"],
    ["32096", "energy"],
  ])(
    "%s removal uses three exact typed resources and a cancellable native cost",
    (code, resource) => {
      const f = fixture();
      const attachment = piece(code);
      attachment.attachedTo = f.s.villain.id;
      f.s.attachments.push(attachment);
      f.run(
        projectWideawakeActionOptions(f.s, attachment.id, f.ports)[0].effects,
      );
      expect(f.payments[0]).toMatchObject({
        cost: 3,
        requirements: [resource, resource, resource],
        sourceId: attachment.id,
      });
      expect(f.s.attachments).toContain(attachment);
      f.pay();
      expect(f.s.encounter.discard).toContain(attachment);
    },
  );

  it("attachment text grants survive villain blanking and disappear with the actual source", () => {
    const f = fixture();
    f.s.attachments.push(
      ...["32094", "32095", "32096"].map((code) => ({
        ...piece(code),
        attachedTo: "villain",
      })),
    );
    f.blank.add("villain");
    expect(projectWideawakeModifiers(f.s, f.s.villain, f.ports)).toEqual({
      health: 8,
      retaliate: 1,
      piercing: true,
      ranged: true,
    });
    f.blank.add("piece-32094");
    f.blank.add("piece-32096");
    expect(projectWideawakeModifiers(f.s, f.s.villain, f.ports)).toEqual({
      health: 0,
      retaliate: 1,
      piercing: false,
      ranged: false,
    });
    expect(projectWideawakeModifiers(f.s, piece("32093"), f.ports).health).toBe(
      0,
    );
  });

  it.each(["32095", "32096"])(
    "boost %s retains the actual physical attachment in play",
    (code) => {
      const f = fixture();
      const p = piece(code, `boost-${code}`);
      f.s.resolving.push(p);
      f.run(projectWideawakeBoost(f.s, p)!);
      expect(f.s.attachments).toEqual([p]);
      expect(f.ports.attach).toHaveBeenCalledWith(f.s, p, "villain", true);
      expect(f.s.resolving).toHaveLength(0);
    },
  );

  it("Sentinel Mark IV boost puts the same piece into play engaged with the attacked player", () => {
    const f = fixture(2);
    f.s.activePlayerId = "p2";
    f.s.player = f.s.players[1].player;
    const p = piece("32093");
    f.s.resolving.push(p);
    f.run(projectWideawakeBoost(f.s, p)!);
    expect(f.s.minions[0]).toBe(p);
    expect(p.engagedWith).toBe("p2");
    expect(cards.get(p.code)?.text).toContain("Guard. Patrol.");
  });

  it("Self-Repair clears every native status before Tough and healing", () => {
    const f = fixture();
    f.s.villain.stunCards = f.s.villain.confuseCards = 2;
    f.s.villain.stunned = f.s.villain.confused = true;
    f.s.villain.hp = 8;
    f.run(projectWideawakeReveal(f.s, piece("32097"), f.ports)!);
    expect(f.events).toEqual(["clear-statuses", "give-tough", "heal:5"]);
    expect(f.s.villain.hp).toBe(13);
    expect(f.s.villain.stunCards).toBe(0);
    expect(f.s.villain.toughCards).toBe(1);
  });

  it("Gauntlet boost exhausts either identity form, Self-Repair boost only grants Tough", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.run(projectWideawakeBoost(f.s, piece("32094"))!);
    expect(f.s.player.exhausted).toBe(true);
    f.run(projectWideawakeBoost(f.s, piece("32097"))!);
    expect(f.s.villain.tough).toBe(true);
    expect(f.ports.healVillain).not.toHaveBeenCalled();
    expect(f.ports.clearVillainStatuses).not.toHaveBeenCalled();
  });

  it("Mutant Detected remains a genuine choice including all explicit attacks in alter ego", () => {
    const f = fixture(2);
    f.s.player.form = "alter";
    f.s.player.deck.push(piece("01001"));
    f.s.minions.push(
      { ...piece("32093", "mine"), engagedWith: "p1" },
      { ...piece("32105", "other"), engagedWith: "p2" },
    );
    f.run(projectWideawakeReveal(f.s, piece("32098"), f.ports)!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([
      "capture",
      "attacks",
    ]);
    expect(f.s.prompt!.options[0].effects[0].type).toBe(
      "wideawake:detected-capture",
    );
    f.choose("attacks");
    expect(f.events).toEqual(["attack:villain:p1", "attack:mine:p1"]);
    expect(f.ports.capturePlayerTop).not.toHaveBeenCalled();
  });

  it("Mutant Detected does not offer a capture that cannot change an empty deck", () => {
    const f = fixture();
    f.run(projectWideawakeReveal(f.s, piece("32098"), f.ports)!);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["attacks"]);
  });

  it("Warn the Others has an alter-ego exhaustion action and actual end-turn captures", () => {
    const f = fixture();
    const warn = piece("32099", "warn-a");
    f.s.sideSchemes.push(piece("32104"));
    f.s.player.inPlay.push(warn);
    expect(projectWideawakeActionOptions(f.s, warn.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    f.run(projectWideawakeActionOptions(f.s, warn.id, f.ports)[0].effects);
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.encounter.discard).toContain(warn);
    const other = piece("32099", "warn-b");
    f.s.player.inPlay.push(other);
    const effects = projectWideawakeEndPlayerTurn(f.s, "p1", "turn-1", f.ports);
    f.run(effects);
    f.run(effects);
    expect(f.s.sideSchemes[0].captured).toEqual([other]);
    expect(f.ports.captureCard).toHaveBeenCalledTimes(1);
    expect(projectWideawakeEndPlayerTurn(f.s, "p1", "turn-1", f.ports)).toEqual(
      [],
    );
  });

  it("each separate Warn copy captures once at its controller's actual turn end", () => {
    const f = fixture(2);
    f.s.sideSchemes.push(piece("32104"));
    f.s.player.inPlay.push(piece("32099", "one"), piece("32099", "two"));
    f.s.players[1].player.inPlay.push(piece("32099", "other-seat"));
    f.run(projectWideawakeEndPlayerTurn(f.s, "p1", "turn", f.ports));
    expect(f.s.sideSchemes[0].captured!.map((p) => p.id)).toEqual([
      "one",
      "two",
    ]);
    expect(f.s.players[1].player.inPlay).toHaveLength(1);
  });

  it("Rictor offers one optional response and deals unlabeled damage to the right engaged group", () => {
    const f = fixture(2);
    const rictor = piece("32089");
    f.s.player.inPlay.push(rictor);
    f.s.minions.push(
      { ...piece("32093", "mine"), engagedWith: "p1" },
      { ...piece("32105", "theirs"), engagedWith: "p2" },
    );
    const receipt = attack(rictor);
    const options = projectWideawakeAllyAttackResponseOptions(
      f.s,
      receipt,
      f.ports,
    );
    expect(options).toHaveLength(1);
    expect(f.ports.damageBatch).not.toHaveBeenCalled();
    f.run(options[0].effects);
    expect(f.ports.damageBatch).toHaveBeenCalledWith(
      f.s,
      [
        { id: "villain", amount: 1 },
        { id: "mine", amount: 1 },
      ],
      rictor.id,
      "p1",
    );
    expect(
      projectWideawakeAllyAttackResponseOptions(f.s, receipt, f.ports),
    ).toEqual([]);
  });

  it("replaced or blanked Captive attacks create no response", () => {
    const f = fixture();
    const rictor = piece("32089");
    f.s.player.inPlay.push(rictor);
    expect(
      projectWideawakeAllyAttackResponseOptions(
        f.s,
        attack(rictor, { performed: false }),
        f.ports,
      ),
    ).toEqual([]);
    f.blank.add(rictor.id);
    expect(
      projectWideawakeAllyAttackResponseOptions(f.s, attack(rictor), f.ports),
    ).toEqual([]);
  });

  it("Boom Boom counters and delayed effects survive the ally leaving play", () => {
    const f = fixture();
    const boom = piece("32090");
    f.s.player.inPlay.push(boom);
    for (const token of ["first", "second"])
      f.run(
        projectWideawakeAllyAttackResponseOptions(
          f.s,
          attack(boom, { token }),
          f.ports,
        )[0].effects,
      );
    expect(f.s.projectWideawake!.bombs).toEqual([
      { enemyId: "villain", count: 2 },
    ]);
    f.s.player.inPlay = [];
    f.run(projectWideawakeEndPlayerPhase(f.s));
    expect(f.s.prompt!.options).toHaveLength(2);
    f.choose(`${boom.id}:second`);
    expect(f.ports.damageBatch).toHaveBeenCalledTimes(1);
    expect(f.ports.damageBatch).toHaveBeenCalledWith(
      f.s,
      [{ id: "villain", amount: 4 }],
      boom.id,
      "p1",
    );
    expect(f.s.projectWideawake!.bombs).toEqual([]);
    expect(f.s.projectWideawake!.delayedBombs).toEqual([]);
  });

  it("Boom Boom cannot place a counter on a defeated enemy or next villain stage", () => {
    const f = fixture();
    const boom = piece("32090");
    f.s.player.inPlay.push(boom);
    expect(
      projectWideawakeAllyAttackResponseOptions(
        f.s,
        attack(boom, { targetId: "gone", targetCode: "32093" }),
        f.ports,
      ),
    ).toEqual([]);
    f.s.villain.code = "32085";
    expect(
      projectWideawakeAllyAttackResponseOptions(f.s, attack(boom), f.ports),
    ).toEqual([]);
  });

  it("enemy leave removes its counters without canceling the scheduled delayed effect", () => {
    const f = fixture();
    const boom = piece("32090");
    f.s.player.inPlay.push(boom);
    f.run(
      projectWideawakeAllyAttackResponseOptions(f.s, attack(boom), f.ports)[0]
        .effects,
    );
    projectWideawakeEnemyLeftPlay(f.s, "villain");
    f.run(projectWideawakeEndPlayerPhase(f.s));
    expect(f.ports.damageBatch).not.toHaveBeenCalled();
    expect(f.s.projectWideawake!.delayedBombs).toEqual([]);
  });

  it("Cannonball reduces consequence only for an actual performed minion-defeating attack", () => {
    const f = fixture();
    const cannonball = piece("32091");
    f.s.player.inPlay.push(cannonball);
    expect(
      projectWideawakeConsequentialReduction(f.s, attack(cannonball), f.ports),
    ).toBe(0);
    expect(
      projectWideawakeConsequentialReduction(
        f.s,
        attack(cannonball, { defeatedMinion: true }),
        f.ports,
      ),
    ).toBe(1);
    expect(
      projectWideawakeConsequentialReduction(
        f.s,
        attack(cannonball, { defeatedMinion: true, performed: false }),
        f.ports,
      ),
    ).toBe(0);
    f.blank.add(cannonball.id);
    expect(
      projectWideawakeConsequentialReduction(
        f.s,
        attack(cannonball, { defeatedMinion: true }),
        f.ports,
      ),
    ).toBe(0);
  });

  it("Wolfsbane gains piercing from live printed text", () => {
    const f = fixture();
    const wolfsbane = piece("32092");
    expect(
      projectWideawakeAllyAttackModifiers(f.s, wolfsbane, f.ports).piercing,
    ).toBe(true);
    f.blank.add(wolfsbane.id);
    expect(
      projectWideawakeAllyAttackModifiers(f.s, wolfsbane, f.ports).piercing,
    ).toBe(false);
  });

  it("serialized persistent zones and receipt lists rehydrate without identity duplication", () => {
    const f = fixture();
    const saved = projectWideawakeInitialize(f.s);
    saved.setAsideCaptives.push(piece("32089", "physical-captive"));
    saved.bombs.push({ enemyId: "villain", count: 2 });
    saved.delayedBombs.push({
      token: "attack",
      sourceId: "gone-boom",
      playerId: "p1",
    });
    saved.handledThreatTokens.push("done");
    const hydrated = JSON.parse(
      JSON.stringify(f.s),
    ) as ProjectWideawakeGameState;
    expect(projectWideawakeInitialize(hydrated)).toEqual(saved);
    expect(hydrated.projectWideawake!.setAsideCaptives[0].id).toBe(
      "physical-captive",
    );
    expect(projectWideawakeEndPlayerPhase(hydrated)).toHaveLength(1);
    expect(hydrated.players.flatMap((p) => p.player.inPlay)).toEqual([]);
  });

  it("captures a configurable GROUP allocation after the initial stage reveal, before hands", () => {
    const f = fixture(2);
    const setup = {
      captives: ["32089", "32090", "32091", "32092"].map((code) => piece(code)),
      mall: piece("32088a"),
      operation: piece("32104"),
    };
    f.s.player.deck.push(
      piece("32013", "p1-first"),
      piece("32014", "p1-second"),
    );
    f.s.players[1].player.deck.push(
      piece("32015", "p2-first"),
      piece("32016", "p2-second"),
    );
    projectWideawakeSetup(f.s, setup, f.ports, [1, 2]);
    f.run();
    expect(f.events).toEqual(["setup:32104", "setup:32088a"]);
    f.run(projectWideawakeReveal(f.s, f.s.villain, f.ports)!);
    expect(f.events).toEqual([
      "setup:32104",
      "setup:32088a",
      "search-scheme:32100:p1",
      "capture:p1-first",
      "capture:p2-first",
      "capture:p2-second",
    ]);
    expect(setup.operation.captured!.map((p) => p.id)).toEqual([
      "p1-first",
      "p2-first",
      "p2-second",
    ]);
    expect(f.s.projectWideawake!.captureAllocation).toEqual([1, 2]);
    expect(f.s.players[0].player.hand).toEqual([]);
    expect(projectWideawakeSetupCaptureEffects(f.s)).toEqual([]);
    f.s.villain.code = "32085";
    f.run(projectWideawakeReveal(f.s, f.s.villain, f.ports)!);
    expect(f.ports.capturePlayerTop).toHaveBeenCalledTimes(3);
    expect(f.s.players[0].player.deck[0].id).toBe("p1-second");
  });

  it.each(["standard", "expert"])(
    "zero capture override is legal in %s and never turns into a recommendation",
    (difficulty) => {
      const f = fixture(2);
      f.s.difficulty = difficulty as GameState["difficulty"];
      projectWideawakeSetup(
        f.s,
        {
          captives: ["32089", "32090", "32091", "32092"].map((code) =>
            piece(code),
          ),
          mall: piece("32088a"),
          operation: piece("32104"),
        },
        f.ports,
        [0, 0],
      );
      f.run();
      f.run(projectWideawakeReveal(f.s, f.s.villain, f.ports)!);
      expect(f.s.projectWideawake!.captureAllocation).toEqual([0, 0]);
      expect(f.ports.capturePlayerTop).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed allocation vectors and an immediate setup loss", () => {
    const f = fixture(2);
    const setup = {
      captives: ["32089", "32090", "32091", "32092"].map((code) => piece(code)),
      mall: piece("32088a"),
      operation: piece("32104"),
    };
    for (const allocation of [[1], [-1, 1], [0.5, 0], [3, 2]]) {
      expect(() =>
        projectWideawakeSetup(f.s, setup, f.ports, allocation),
      ).toThrow(/capture allocation/);
    }
  });

  it("main constant and threshold follow the live source rather than a villain label", () => {
    const f = fixture();
    f.s.villainId = "rhino";
    f.s.villain.code = "01094";
    expect(projectWideawakeGrantsPermanent(f.s, piece("32104"), f.ports)).toBe(
      true,
    );
    expect(projectWideawakeMainThreatLimit(f.s)).toBe(0);
    expect(
      projectWideawakeAfterMainThreatPlaced(
        f.s,
        {
          token: "source",
          schemeCode: "32087b",
          actualAmount: 4,
          threatAfter: 5,
        },
        f.ports,
      ),
    ).toHaveLength(1);
    f.blank.add("32087b");
    expect(
      projectWideawakeAfterMainThreatPlaced(
        f.s,
        {
          token: "blank",
          schemeCode: "32087b",
          actualAmount: 4,
          threatAfter: 5,
        },
        f.ports,
      ),
    ).toEqual([]);
  });

  it("Boom Boom's one delayed effect damages multiple enemies and removes all counters first", () => {
    const f = fixture();
    const boom = piece("32090");
    const minion = piece("32093", "bombed-minion");
    f.s.player.inPlay.push(boom);
    f.s.minions.push(minion);
    f.run(
      projectWideawakeAllyAttackResponseOptions(
        f.s,
        attack(boom, { token: "villain-bomb" }),
        f.ports,
      )[0].effects,
    );
    f.run(
      projectWideawakeAllyAttackResponseOptions(
        f.s,
        attack(boom, {
          token: "minion-bomb",
          targetId: minion.id,
          targetCode: minion.code,
        }),
        f.ports,
      )[0].effects,
    );
    expect(projectWideawakeBombCount(f.s, "villain")).toBe(1);
    expect(projectWideawakeBombCount(f.s, minion.id)).toBe(1);
    vi.mocked(f.ports.damageBatch).mockImplementation((_state, targets) => {
      expect(f.s.projectWideawake!.bombs).toEqual([]);
      expect(targets).toEqual([
        { id: "villain", amount: 2 },
        { id: minion.id, amount: 2 },
      ]);
    });
    f.run(projectWideawakeEndPlayerPhase(f.s));
    f.choose(`${boom.id}:villain-bomb`);
    expect(f.ports.damageBatch).toHaveBeenCalledTimes(1);
    expect(projectWideawakeBombCount(f.s, minion.id)).toBe(0);
  });

  it("an eliminated original controller does not have to trigger a saved delayed effect", () => {
    const f = fixture(2);
    const boom = piece("32090");
    f.s.player.inPlay.push(boom);
    f.run(
      projectWideawakeAllyAttackResponseOptions(f.s, attack(boom), f.ports)[0]
        .effects,
    );
    f.s.players[0].eliminated = true;
    f.s.players[0].player.inPlay = [];
    f.s.firstPlayerId = "p2";
    f.run(projectWideawakeEndPlayerPhase(f.s));
    expect(f.s.activePlayerId).toBe("p2");
    expect(f.ports.damageBatch).toHaveBeenCalledWith(
      f.s,
      [{ id: "villain", amount: 2 }],
      boom.id,
      "p1",
    );
    expect(f.s.projectWideawake!.delayedBombs).toEqual([]);
  });

  it("returns false/null for unrelated dispatch and reveal cards", () => {
    const f = fixture();
    expect(
      resolveProjectWideawakeEffect(f.s, { type: "other:effect" }, f.ports),
    ).toBe(false);
    expect(projectWideawakeReveal(f.s, piece("01001"), f.ports)).toBeNull();
    expect(projectWideawakeBoost(f.s, piece("01001"))).toBeNull();
    expect(() =>
      resolveProjectWideawakeEffect(
        f.s,
        { type: "wideawake:unknown" },
        f.ports,
      ),
    ).toThrow(/Unknown Project/);
  });
});
