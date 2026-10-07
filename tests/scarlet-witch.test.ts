import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  SCARLET_WITCH_SCRIPT_CODES,
  scarletWitchAbility,
  scarletWitchAbilityOptions,
  scarletWitchAttachmentActions,
  scarletWitchBoost,
  scarletWitchBoostIconBonus,
  scarletWitchCardCostBonus,
  scarletWitchCountBoosts,
  scarletWitchDamageOptions,
  scarletWitchEncounterReveal,
  scarletWitchEnemyActivated,
  scarletWitchEvent,
  scarletWitchPhaseEnded,
  scarletWitchPlayRestriction,
  scarletWitchRevealOptions,
  resolveScarletWitchEffect,
  type ScarletWitchPorts,
} from "../src/game/scarlet-witch.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const W = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `scw:${type}`,
  ...args,
});
let nextId = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `scw${++nextId}`,
  code,
  ownerId: "p1",
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ...patch,
});
const encounter = (boost: number, star = false) => {
  const c = (catalog as unknown as Card[]).find(
    (c) =>
      c.faction_code === "encounter" &&
      (c.boost || 0) === boost &&
      !!c.boost_star === star,
  )!;
  return piece(c.code);
};
function fixture() {
  const player: GameState["player"] = {
    form: "hero",
    hp: 10,
    exhausted: false,
    flipped: false,
    tough: false,
    stunned: false,
    confused: false,
    hand: [],
    deck: [],
    discard: [],
    inPlay: [],
  };
  const s: GameState = {
    version: 1,
    seed: 15,
    nextId: 1,
    heroId: "scw",
    aspect: "justice",
    villainId: "rhino",
    difficulty: "standard",
    module: "bomb_scare",
    phase: "player",
    round: 1,
    players: [],
    activePlayerId: "p1",
    firstPlayerId: "p1",
    turnPlayerId: "p1",
    playerCount: 1,
    guided: false,
    review: null,
    reviewCount: 0,
    player,
    villain: { ...piece("01094"), hp: 14, maxHp: 14, stage: 1 },
    scheme: { code: "01097", threat: 5, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    removed: [],
    resolving: [],
    queue: [],
    prompt: null,
    flags: {},
    log: [],
    attack: null,
  };
  s.players = [
    {
      id: "p1",
      heroId: "scw",
      aspect: "justice",
      player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  const native: Effect[] = [];
  const ports: ScarletWitchPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    select: (state, title, text, pieces, min, max, action) => {
      state.prompt = {
        kind: "select",
        title,
        text,
        min,
        max,
        selectAction: action,
        options: pieces.map((p) => ({
          id: p.id,
          label: cards.get(p.code)?.name || p.code,
          image: p.code,
          effects: [],
        })),
      };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: vi.fn((state, _counts, form) => {
      state.player.form = form === "alter" ? "alter" : "hero";
    }),
    canReadyIdentity: () => true,
    canPay: vi.fn(() => true),
    canGiveStatus: (state, id, status) => {
      const p =
        id === state.villain.id
          ? state.villain
          : state.minions.find((p) => p.id === id) ||
            state.player.inPlay.find((p) => p.id === id);
      return id === "hero"
        ? !state.player[status]
        : !!p && !p[status] && p.code !== "04030";
    },
    enemyTargets: (state, attack) => [
      ...(!attack || !state.minions.some((p) => p.code === "01101")
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)?.name || p.code,
        code: p.code,
      })),
    ],
    schemeTargets: (state) => [
      ...(state.scheme.threat > 0
        ? [{ id: "main", label: "Main scheme", code: state.scheme.code }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          code: p.code,
          label: cards.get(p.code)?.name || p.code,
        })),
    ],
    friendlyTargets: (state) => [
      { id: "hero", label: "Scarlet Witch", code: "15001a" },
      ...state.player.inPlay
        .filter((p) => cards.get(p.code)?.type_code === "ally")
        .map((p) => ({
          id: p.id,
          code: p.code,
          label: cards.get(p.code)!.name,
        })),
    ],
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    discardHand: (state, id) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i < 0) throw Error("No hand card");
      state.player.discard.push(state.player.hand.splice(i, 1)[0]);
    },
    discardPiece: (state, id) => {
      const zone = [state.player.inPlay, state.attachments].find((zone) =>
        zone.some((p) => p.id === id),
      );
      if (zone)
        state.player.discard.push(
          zone.splice(
            zone.findIndex((p) => p.id === id),
            1,
          )[0],
        );
    },
    revealHidden: vi.fn(),
    recycleEncounter: vi.fn(),
    attackProgram: vi.fn(),
    log: vi.fn(),
    shufflePlayerDeck: vi.fn(),
    discardEncounterTop: vi.fn((state) => {
      const p = state.encounter.deck.shift();
      if (p) state.encounter.discard.push(p);
      const emptied = !!p && !state.encounter.deck.length;
      if (emptied) {
        state.encounter.deck.push(...state.encounter.discard);
        state.encounter.discard = [];
        state.encounter.acceleration++;
      }
      return { piece: p, emptied };
    }),
    cardCost: (_state, p) => Number(cards.get(p.code)?.cost || 0),
    canPlayIgnoringCost: (state, p) =>
      !state.flags[`illegal:${p.id}`] &&
      ["event", "support", "upgrade", "ally"].includes(
        cards.get(p.code)?.type_code || "",
      ),
    playIgnoringCost: vi.fn(),
    preventDamage: vi.fn(),
    searchEncounter: vi.fn(),
    putMinion: vi.fn((state, p, playerId) => {
      p.engagedWith = playerId;
      state.minions.push(p);
    }),
    cancelEncounter: vi.fn((state, p) => {
      state.resolving = state.resolving.filter((q: Piece) => q.id !== p.id);
      if (!state.encounter.discard.some((q: Piece) => q.id === p.id))
        state.encounter.discard.push(p);
    }),
  };
  const resolve = (e: Effect) => resolveScarletWitchEffect(s, e, ports);
  const run = () => {
    for (let i = 0; s.queue.length && !s.prompt; i++) {
      if (i > 100) throw Error("Unexpected effect loop");
      const e = s.queue.shift()!;
      if (!resolve(e)) {
        native.push(e);
        if (e.type === "ready") {
          const p = s.player.inPlay.find((p) => p.id === e.target);
          if (p) p.exhausted = false;
        }
      }
    }
  };
  const choose = (id: string) => {
    const o = s.prompt!.options.find((o) => o.id === id);
    if (!o) throw Error(`Missing choice ${id}`);
    s.prompt = null;
    ports.queue(s, ...o.effects);
    run();
  };
  const pass = () => {
    run();
    for (let i = 0; s.prompt?.options.some((o) => o.id === "continue"); i++) {
      if (i > 20) throw Error("Unexpected prompt loop");
      choose("continue");
    }
  };
  return { s, ports, native, resolve, run, choose, pass };
}

describe("Scarlet Witch identity and exact encounter-card counting", () => {
  it("registers all 15 immutable identity, signature, obligation and nemesis faces", () => {
    expect(SCARLET_WITCH_SCRIPT_CODES).toHaveLength(15);
    expect(new Set(SCARLET_WITCH_SCRIPT_CODES).size).toBe(15);
    expect(SCARLET_WITCH_SCRIPT_CODES.every((code) => cards.has(code))).toBe(
      true,
    );
  });
  it("rejects effects outside the module prefix", () =>
    expect(fixture().resolve({ type: "other" })).toBe(false));
  it("counts numerical icons, excludes stars and returns every independent count", () => {
    const f = fixture(),
      originals = [encounter(0, true), encounter(2)];
    f.s.heroId = f.s.players[0].heroId = "spider_man";
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, originals, [{ type: "done" }]),
    );
    f.run();
    expect(f.native).toEqual([
      { type: "done", boostCounts: [0, 2], boostTotal: 2 },
    ]);
    expect(f.ports.discardEncounterTop).not.toHaveBeenCalled();
  });
  it("lets Chaos Control count an actual physical replacement without resolving its boost star", () => {
    const f = fixture(),
      original = encounter(3),
      replacement = encounter(0, true);
    f.s.encounter.deck = [replacement, encounter(1)];
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [original], [{ type: "done" }]),
    );
    f.run();
    f.choose("chaos:p1");
    expect(f.native.at(-1)).toMatchObject({ boostCounts: [0], boostTotal: 0 });
    expect(f.s.encounter.discard).toEqual([replacement]);
    expect(f.s.flags.scwChaosControlPhase).toBe("1:player");
    expect(original.code).toBe(cards.get(original.code)!.code);
  });
  it("offers no Chaos Control in alter-ego and allows a fresh use in the next phase", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [encounter(1)], [{ type: "done" }]),
    );
    f.run();
    expect(f.s.prompt).toBeNull();
    f.s.player.form = "hero";
    f.s.flags.scwChaosControlPhase = "1:player";
    f.s.phase = "villain";
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [encounter(1)], [{ type: "done" }]),
    );
    f.run();
    expect(f.s.prompt!.options.some((o) => o.id === "chaos:p1")).toBe(true);
  });
  it("resumes a serialized replacement window with the original star card unchanged", () => {
    const f = fixture(),
      original = encounter(1, true),
      replacement = encounter(2),
      crest = piece("15009");
    f.s.player.inPlay = [crest];
    f.s.encounter.deck = [replacement, encounter(1)];
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [original], [{ type: "done" }]),
    );
    f.run();
    const effects = JSON.parse(
      JSON.stringify(
        f.s.prompt!.options.find((o) => o.id === "chaos:p1")!.effects,
      ),
    ) as Effect[];
    f.s.prompt = null;
    f.ports.queue(f.s, ...effects);
    f.run();
    f.choose(`crest:${crest.id}:+1`);
    expect(f.native.at(-1)).toMatchObject({ boostTotal: 3 });
    expect(crest.exhausted).toBe(true);
    expect(cards.get(original.code)?.boost_star).toBe(true);
  });
  it("allows Crest in either form and clamps its decrease at zero", () => {
    const f = fixture(),
      crest = piece("15009");
    f.s.player.form = "alter";
    f.s.player.inPlay = [crest];
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [encounter(0)], [{ type: "done" }]),
    );
    f.run();
    expect(
      f.s.prompt!.options.some((o) => o.id === `crest:${crest.id}:-1`),
    ).toBe(false);
    f.choose(`crest:${crest.id}:+1`);
    expect(f.native.at(-1)?.boostTotal).toBe(1);
  });
  it("does not offer an exhausted or blanked Crest", () => {
    const f = fixture(),
      exhausted = piece("15009", { exhausted: true }),
      blanked = piece("15009");
    f.s.player.form = "alter";
    f.s.player.inPlay = [exhausted, blanked];
    f.s.flags[`blank:${blanked.id}`] = true;
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [encounter(1)], [{ type: "done" }]),
    );
    f.run();
    expect(f.s.prompt).toBeNull();
    expect(f.native.at(-1)?.boostTotal).toBe(1);
  });
  it("applies The Next Evolution to original and replacement numeric counts but never twice", () => {
    const f = fixture();
    f.s.sideSchemes = [piece("15024")];
    f.s.encounter.deck = [encounter(0, true), encounter(2)];
    expect(scarletWitchBoostIconBonus(f.s)).toBe(1);
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [encounter(3)], [{ type: "done" }]),
    );
    f.run();
    f.choose("chaos:p1");
    expect(f.native.at(-1)?.boostTotal).toBe(1);
  });
  it("keeps Amplify only on an original activation boost, never a discarded replacement", () => {
    const original = fixture();
    original.ports.queue(
      original.s,
      ...scarletWitchCountBoosts(
        original.s,
        [encounter(1)],
        [{ type: "done" }],
        { amplify: 2 },
      ),
    );
    original.pass();
    expect(original.native.at(-1)?.boostTotal).toBe(3);
    const replaced = fixture();
    replaced.s.encounter.deck = [encounter(1), encounter(2)];
    replaced.ports.queue(
      replaced.s,
      ...scarletWitchCountBoosts(
        replaced.s,
        [encounter(1)],
        [{ type: "done" }],
        { amplify: 2 },
      ),
    );
    replaced.run();
    replaced.choose("chaos:p1");
    expect(replaced.native.at(-1)?.boostTotal).toBe(1);
  });
  it("returns zero cleanly for an empty discarded batch", () => {
    const f = fixture();
    f.ports.queue(f.s, ...scarletWitchCountBoosts(f.s, [], [{ type: "done" }]));
    f.run();
    expect(f.native).toEqual([
      { type: "done", boostCounts: [], boostTotal: 0 },
    ]);
  });
  it("lets a different player's actual Scarlet Witch hero replace a count without changing its actor", () => {
    const f = fixture();
    f.s.heroId = f.s.players[0].heroId = "spider_man";
    const seat = {
      ...f.s.players[0],
      id: "p2",
      heroId: "scw",
      player: { ...f.s.player, inPlay: [] },
      flags: {},
    };
    f.s.players.push(seat);
    f.s.encounter.deck = [encounter(2), encounter(0)];
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [encounter(3)], [{ type: "done" }]),
    );
    f.run();
    f.choose("chaos:p2");
    expect(seatView(f.s, "p2").flags.scwChaosControlPhase).toBe("1:player");
    expect(f.s.flags.scwChaosControlPhase).toBeUndefined();
    expect(f.s.activePlayerId).toBe("p1");
    expect(f.native.at(-1)?.boostTotal).toBe(2);
  });
  it("uses a controlled Crest from another player's alter-ego without exhausting a source belonging to the actor", () => {
    const f = fixture(),
      crest = piece("15009", { ownerId: "p2" });
    f.s.player.form = "alter";
    f.s.players.push({
      ...f.s.players[0],
      id: "p2",
      player: { ...f.s.player, inPlay: [crest] },
      flags: {},
    });
    f.ports.queue(
      f.s,
      ...scarletWitchCountBoosts(f.s, [encounter(2)], [{ type: "done" }]),
    );
    f.run();
    f.choose(`crest:${crest.id}:-1`);
    expect(crest.exhausted).toBe(true);
    expect(f.s.activePlayerId).toBe("p1");
    expect(f.native.at(-1)?.boostTotal).toBe(1);
  });
  it("resets phase limits without resetting the siblings round limit", () => {
    const f = fixture();
    f.s.flags.scwChaosControlPhase = "1:player";
    f.s.flags["scwQuicksilverReady:ally"] = "1:player";
    f.s.flags.scwSiblingsRound = 1;
    scarletWitchPhaseEnded(f.s);
    expect(f.s.flags).toEqual({ scwSiblingsRound: 1 });
  });
});

describe("Scarlet Witch signature cards", () => {
  it("commits exactly two actual hand cards before Superpowered Siblings draws", () => {
    const f = fixture(),
      hand = [piece("15004"), piece("15005")];
    f.s.player.form = "alter";
    f.s.player.hand = [...hand];
    expect(scarletWitchAbility(f.s, "identity", "siblings", f.ports)).toEqual([
      W("siblings"),
    ]);
    f.resolve(W("siblings"));
    expect(f.s.prompt?.kind).toBe("select");
    expect(f.s.player.hand).toHaveLength(2);
    f.s.prompt = null;
    f.resolve(W("siblings-discard", { ids: hand.map((p) => p.id) }));
    expect(f.s.player.hand).toHaveLength(0);
    expect(f.s.player.discard).toEqual(hand);
    expect(f.s.queue).toEqual([{ type: "draw", amount: 2 }]);
  });
  it("counts the Pietro ally subtitle for siblings while respecting named active identity faces", () => {
    const f = fixture(),
      hand = [piece("15004"), piece("15005")];
    f.s.player.form = "alter";
    f.s.player.hand = hand;
    f.s.player.inPlay = [piece("15002")];
    f.resolve(W("siblings-discard", { ids: hand.map((p) => p.id) }));
    expect(f.s.queue[0].amount).toBe(3);
  });
  it("rejects duplicate physical selections and a second siblings use in one round", () => {
    const f = fixture(),
      p = piece("15004");
    f.s.player.form = "alter";
    f.s.player.hand = [p, piece("15005")];
    expect(() =>
      f.resolve(W("siblings-discard", { ids: [p.id, p.id] })),
    ).toThrow();
    f.s.flags.scwSiblingsRound = 1;
    expect(scarletWitchAbilityOptions(f.s, "identity", f.ports)).toEqual([]);
  });
  it("readies the actual Quicksilver ally once each phase in either form", () => {
    const f = fixture(),
      p = piece("15002", { exhausted: true });
    f.s.player.form = "alter";
    f.s.player.inPlay = [p];
    f.resolve(W("quicksilver-ready", { id: p.id }));
    f.run();
    expect(p.exhausted).toBe(false);
    p.exhausted = true;
    expect(scarletWitchAbilityOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.phase = "villain";
    expect(scarletWitchAbilityOptions(f.s, p.id, f.ports)).toHaveLength(1);
  });
  it("Agatha looks at actual top cards, adds one and preserves a chosen bottom order", () => {
    const f = fixture(),
      p = piece("15007"),
      deck = [piece("15004"), piece("15005"), piece("15008"), piece("15009")];
    f.s.player.form = "alter";
    f.s.player.inPlay = [p];
    f.s.player.deck = [...deck];
    f.resolve(W("agatha", { id: p.id }));
    expect(p.exhausted).toBe(true);
    expect(f.ports.revealHidden).toHaveBeenCalledOnce();
    f.choose(deck[1].id);
    f.choose(deck[2].id);
    expect(f.s.player.hand).toEqual([deck[1]]);
    expect(f.s.player.deck).toEqual([deck[3], deck[2], deck[0]]);
  });
  it("Agatha handles a one-card deck without inventing cards or recycling it", () => {
    const f = fixture(),
      p = piece("15007"),
      top = piece("15004");
    f.s.player.form = "alter";
    f.s.player.inPlay = [p];
    f.s.player.deck = [top];
    f.resolve(W("agatha", { id: p.id }));
    f.choose(top.id);
    expect(f.s.player.hand).toEqual([top]);
    expect(f.s.player.deck).toEqual([]);
    expect(f.ports.recycleEncounter).not.toHaveBeenCalled();
  });
  it("Chaos Magic offers only legal physical hand cards and delegates the full nested play before discarding", () => {
    const f = fixture(),
      legal = piece("15002"),
      illegal = piece("15006");
    f.s.player.hand = [legal, illegal];
    f.s.flags[`illegal:${illegal.id}`] = true;
    f.resolve(W("chaos-magic"));
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([legal.id]);
    f.choose(legal.id);
    expect(f.ports.playIgnoringCost).toHaveBeenCalledWith(f.s, legal, [
      W("discard-batch", { amount: 4 }),
    ]);
    expect(f.ports.discardEncounterTop).not.toHaveBeenCalled();
  });
  it("Chaos Magic's encounter discard stops at deck exhaustion even after immediate recycling", () => {
    const f = fixture(),
      one = encounter(1);
    f.s.encounter.deck = [one];
    f.s.encounter.discard = [encounter(2)];
    f.resolve(W("discard-batch", { amount: 4 }));
    expect(f.ports.discardEncounterTop).toHaveBeenCalledOnce();
    expect(f.s.encounter.acceleration).toBe(1);
  });
  it("Hex Bolt discards the entire batch before any exact-count interrupt and permits chosen effect order", () => {
    const f = fixture(),
      pieces = [encounter(0), encounter(1), encounter(2)];
    f.s.encounter.deck = [...pieces, encounter(3)];
    f.resolve(W("hex"));
    f.run();
    expect(f.ports.discardEncounterTop).toHaveBeenCalledTimes(3);
    expect(f.s.encounter.discard).toEqual(pieces);
    f.pass();
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["0", "1", "2"]);
    f.choose("2");
    expect(f.native[0]).toEqual({ type: "draw", amount: 1 });
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["0", "1"]);
  });
  it("Hex Bolt stops at exhaustion, saves the discarded face and resolves its result after recycle", () => {
    const f = fixture(),
      only = encounter(2);
    f.s.player.form = "alter";
    f.s.encounter.deck = [only];
    f.s.encounter.discard = [encounter(3)];
    f.resolve(W("hex"));
    f.run();
    expect(f.ports.discardEncounterTop).toHaveBeenCalledOnce();
    expect(f.native).toEqual([{ type: "draw", amount: 1 }]);
    expect(f.s.encounter.acceleration).toBe(1);
  });
  it("Hex Bolt's nonattack damage ignores Guard and does not use attack programming", () => {
    const f = fixture();
    f.s.minions = [piece("01101")];
    f.resolve(
      W("hex-resolve", {
        boostCounts: [0],
        index: 0,
        remaining: [],
        pieces: [encounter(0)],
      }),
    );
    expect(f.s.prompt!.options.some((o) => o.id === f.s.villain.id)).toBe(true);
    f.choose(f.s.villain.id);
    expect(f.native[0]).toMatchObject({
      type: "damage",
      target: f.s.villain.id,
      amount: 2,
      action: false,
    });
    expect(f.ports.attackProgram).not.toHaveBeenCalled();
  });
  it("Hex Bolt respects Crisis while allowing nonthwart removal from the Crisis itself", () => {
    const f = fixture(),
      crisis = piece(
        (catalog as unknown as Card[]).find((c) => c.scheme_crisis)!.code,
        { counters: 2 },
      );
    f.s.sideSchemes = [crisis];
    f.resolve(
      W("hex-resolve", {
        boostCounts: [1],
        index: 0,
        remaining: [],
        pieces: [encounter(1)],
      }),
    );
    f.run();
    expect(f.native[0]).toMatchObject({
      type: "thwart",
      target: crisis.id,
      action: false,
      ignoreCrisis: false,
    });
  });
  it("Hex Bolt 3+ results offer only character statuses that can actually change the game", () => {
    const f = fixture();
    f.s.villain.tough = true;
    f.resolve(
      W("hex-resolve", {
        boostCounts: [3],
        index: 0,
        remaining: [],
        pieces: [encounter(3)],
      }),
    );
    expect(
      f.s.prompt!.options.some((o) => o.id === `${f.s.villain.id}:tough`),
    ).toBe(false);
    expect(f.s.prompt!.options.some((o) => o.id === "hero:tough")).toBe(true);
    f.choose("hero:tough");
    expect(f.native[0]).toEqual({
      type: "status",
      target: "hero",
      status: "tough",
    });
  });
  it("Molecular Decay produces one actual attack packet containing base plus all counted icons", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.s.encounter.deck = [encounter(1), encounter(3), encounter(0)];
    f.resolve(W("molecular-discard", { target: f.s.villain.id }));
    f.run();
    expect(f.ports.attackProgram).toHaveBeenCalledWith(
      f.s,
      [
        {
          type: "damage",
          target: f.s.villain.id,
          amount: 9,
          source: "hero",
          attack: true,
        },
      ],
      [],
    );
  });
  it("Magic Shield prevents a positive friendly ally packet, discards its actual copy and resumes the same window", () => {
    const f = fixture(),
      shield = piece("15008"),
      ally = piece("15002");
    f.s.player.inPlay = [shield, ally];
    const packet = {
      type: "damage",
      target: ally.id,
      amount: 5,
      damageWindowId: "one",
    };
    const options = scarletWitchDamageOptions(
      f.s,
      packet,
      5,
      [{ type: "resume" }],
      f.ports,
    );
    expect(options[0].id).toBe(shield.id);
    f.resolve(options[0].effects[0]);
    expect(f.ports.preventDamage).toHaveBeenCalledWith(f.s, packet, 3);
    expect(f.s.player.inPlay).toEqual([ally]);
    expect(f.s.player.discard).toEqual([shield]);
    expect(f.s.queue).toEqual([{ type: "resume" }]);
  });
  it("Magic Shield is unavailable in its controller's alter-ego or for enemy/zero damage", () => {
    const f = fixture(),
      shield = piece("15008");
    f.s.player.inPlay = [shield];
    f.s.player.form = "alter";
    expect(scarletWitchDamageOptions(f.s, undefined, 1, [], f.ports)).toEqual(
      [],
    );
    f.s.player.form = "hero";
    expect(
      scarletWitchDamageOptions(
        f.s,
        { type: "damage", target: f.s.villain.id },
        1,
        [],
        f.ports,
      ),
    ).toEqual([]);
    expect(scarletWitchDamageOptions(f.s, undefined, 0, [], f.ports)).toEqual(
      [],
    );
  });
  it("Magic Shield can protect a different player's actual identity packet while its controller stays the actor", () => {
    const f = fixture(),
      shield = piece("15008");
    f.s.player.inPlay = [shield];
    f.ports.friendlyTargets = () => [
      { id: "hero:p2", label: "Other identity" },
    ];
    const packet = {
      type: "damage",
      target: "hero:p2",
      damageWindowId: "shared",
      amount: 2,
    };
    const effects = scarletWitchDamageOptions(f.s, packet, 2, [], f.ports)[0]
      .effects;
    f.resolve(effects[0]);
    expect(f.ports.preventDamage).toHaveBeenCalledWith(f.s, packet, 3);
    expect(f.s.activePlayerId).toBe("p1");
  });
  it("Warp Reality is offered for deck-origin reveals only and full cancellation happens before its count", () => {
    const f = fixture(),
      event = piece("15006"),
      original = encounter(2);
    f.s.player.hand = [event];
    f.s.resolving = [original];
    expect(
      scarletWitchRevealOptions(f.s, original, [], f.ports, false),
    ).toEqual([]);
    expect(
      scarletWitchRevealOptions(f.s, original, [], f.ports, true)[0].image,
    ).toBe("15006");
    f.resolve(W("warp", { piece: original }));
    expect(f.ports.cancelEncounter).toHaveBeenCalledWith(f.s, original);
    expect(f.s.resolving).toEqual([]);
    f.run();
    expect(f.s.prompt!.options.some((o) => o.id === "chaos:p1")).toBe(true);
  });
  it("signature Hero actions are restricted in alter-ego and Warp Reality cannot be a normal PLAY", () => {
    const f = fixture();
    f.s.player.form = "alter";
    for (const code of ["15003", "15004", "15005", "15006"])
      expect(scarletWitchPlayRestriction(f.s, piece(code), f.ports)).toContain(
        "hero form",
      );
    f.s.player.form = "hero";
    expect(scarletWitchPlayRestriction(f.s, piece("15006"), f.ports)).toContain(
      "interrupt",
    );
    expect(scarletWitchEvent(f.s, piece("15004"))).toEqual([W("hex")]);
    expect(scarletWitchEvent(f.s, piece("01001a"))).toBeNull();
  });
});

describe("Scarlet Witch obligation and nemesis", () => {
  it("offers the obligation flip separately from the chosen resolution", () => {
    const f = fixture(),
      p = piece("15023");
    f.resolve(scarletWitchEncounterReveal(f.s, p)![0]);
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["flip", "stay"]);
    f.choose("flip");
    expect(f.s.player.form).toBe("alter");
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual(["remove", "discard"]);
  });
  it("removes only the actual exhausted-for obligation copy when two copies exist", () => {
    const f = fixture(),
      one = piece("15023"),
      two = piece("15023");
    f.s.player.form = "alter";
    f.s.resolving = [one];
    f.s.encounter.discard = [two];
    f.resolve(W("obligation-remove", { piece: one }));
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed).toEqual([one]);
    expect(f.s.encounter.discard).toEqual([two]);
  });
  it("Slipping Sanity counts printed stars only, with no Chaos/Crest/Next Evolution window", () => {
    const f = fixture();
    f.s.sideSchemes = [piece("15024")];
    f.s.player.inPlay = [piece("15009")];
    f.s.encounter.deck = [
      encounter(0, true),
      encounter(3),
      encounter(1, true),
      encounter(0),
      encounter(2),
      encounter(1),
    ];
    f.resolve(W("obligation-discard", { piece: piece("15023") }));
    expect(f.s.queue).toEqual([{ type: "threat", target: "main", amount: 2 }]);
    expect(f.s.prompt).toBeNull();
  });
  it("Slipping Sanity stops the five-card batch at encounter exhaustion", () => {
    const f = fixture();
    f.s.encounter.deck = [encounter(1, true)];
    f.s.encounter.discard = [encounter(2)];
    f.resolve(W("obligation-discard", { piece: piece("15023") }));
    expect(f.ports.discardEncounterTop).toHaveBeenCalledOnce();
    expect(f.s.queue[0].amount).toBe(1);
  });
  it("Magical Suspension attaches to the actual player, adds play cost and costs hero exhaustion to remove", () => {
    const f = fixture(),
      p = piece("15026");
    f.s.attachments = [p];
    f.resolve(W("suspension", { id: p.id }));
    expect(p.attachedTo).toBe("hero:p1");
    expect(scarletWitchCardCostBonus(f.s)).toBe(1);
    expect(scarletWitchAttachmentActions(f.s, p, f.ports)).toHaveLength(1);
    f.resolve(W("suspension-remove", { id: p.id }));
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.attachments).toEqual([]);
  });
  it("Magical Suspension does not affect another player's hand and cannot be removed in alter-ego", () => {
    const f = fixture(),
      p = piece("15026", { attachedTo: "hero:p2" });
    f.s.attachments = [p];
    expect(scarletWitchCardCostBonus(f.s)).toBe(0);
    f.s.player.form = "alter";
    expect(scarletWitchAttachmentActions(f.s, p, f.ports)).toEqual([]);
  });
  it("only the attached identity's player can exhaust their hero to remove Magical Suspension", () => {
    const f = fixture(),
      p = piece("15026", { attachedTo: "hero:p2" });
    f.s.attachments = [p];
    expect(scarletWitchAttachmentActions(f.s, p, f.ports)).toEqual([]);
    expect(() => f.resolve(W("suspension-remove", { id: p.id }))).toThrow();
    expect(f.s.player.exhausted).toBe(false);
    expect(f.s.attachments).toEqual([p]);
  });
  it("Luminous's completed activation counts a real top discard and deals an encounter at 2+", () => {
    const f = fixture(),
      p = piece("15025", { engagedWith: "p1" });
    f.s.player.form = "alter";
    f.s.minions = [p];
    f.s.encounter.deck = [encounter(2), encounter(0)];
    f.resolve(scarletWitchEnemyActivated(f.s, p)[0]);
    f.run();
    expect(f.native).toEqual([{ type: "dealEncounter" }]);
    expect(f.ports.discardEncounterTop).toHaveBeenCalledOnce();
  });
  it("Luminous's count is modified by The Next Evolution for a discarded card", () => {
    const f = fixture(),
      p = piece("15025");
    f.s.player.form = "alter";
    f.s.minions = [p];
    f.s.sideSchemes = [piece("15024")];
    f.s.encounter.deck = [encounter(1), encounter(0)];
    f.resolve(W("luminous", { id: p.id }));
    f.run();
    expect(f.native[0].type).toBe("dealEncounter");
  });
  it("Chaos Manipulation searches for and puts an actual Luminous copy into play before counting", () => {
    const f = fixture(),
      p = piece("15025");
    f.s.player.form = "alter";
    vi.mocked(f.ports.searchEncounter).mockReturnValue(p);
    f.s.encounter.deck = [encounter(2), encounter(0)];
    f.resolve(W("manipulation"));
    f.run();
    expect(f.ports.searchEncounter).toHaveBeenCalledWith(f.s, "15025");
    expect(f.ports.putMinion).toHaveBeenCalledWith(f.s, p, "p1");
    expect(f.native.at(-1)).toMatchObject({ type: "minionActivate", id: p.id });
  });
  it("Chaos Manipulation has no invented minion when the actual physical copy is absent", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.s.encounter.deck = [encounter(2), encounter(0)];
    f.resolve(W("manipulation"));
    f.run();
    expect(f.ports.putMinion).not.toHaveBeenCalled();
    expect(f.native).toEqual([]);
  });
  it("Chaos Manipulation activates an existing Luminous against the revealer without changing her other engagement", () => {
    const f = fixture(),
      p = piece("15025", { engagedWith: "p2" });
    f.s.player.form = "alter";
    f.s.minions = [p];
    f.s.encounter.deck = [encounter(2), encounter(0)];
    f.resolve(W("manipulation"));
    f.run();
    expect(f.native.at(-1)).toMatchObject({
      type: "minionActivate",
      id: p.id,
      playerId: "p1",
    });
    expect(p.engagedWith).toBe("p2");
  });
  it("nemesis definitions have no invented boost-star effect", () => {
    const f = fixture();
    expect(scarletWitchBoost(f.s, piece("15027"))).toEqual([]);
    expect(scarletWitchBoost(f.s, piece("01101"))).toBeNull();
  });
});
