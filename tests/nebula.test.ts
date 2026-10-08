import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import {
  activateSeat,
  seatView,
  syncSeat,
  upgradeSave,
} from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  NEBULA_SCRIPT_CODES,
  nebulaAllyPlayed,
  nebulaAttachmentActions,
  nebulaAttackDamageReduction,
  nebulaAttackKeywords,
  nebulaBoost,
  nebulaCardPlayed,
  nebulaEncounterReveal,
  nebulaEvent,
  nebulaGamoraAttackEnded,
  nebulaIgnoresRestrictions,
  nebulaMinionWillEnter,
  nebulaNamedCharacterModifiers,
  nebulaPlayRestriction,
  nebulaResourceSources,
  nebulaResourceSpent,
  nebulaRetaliate,
  nebulaSpecialAvailable,
  nebulaStats,
  nebulaTurnBegan,
  resolveNebulaEffect,
  type NebulaPorts,
} from "../src/game/nebula.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const N = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `nebula:${type}`,
  ...args,
});
let serial = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `nebu${++serial}`,
  code,
  exhausted: false,
  damage: 0,
  counters: 0,
  tough: false,
  stunned: false,
  confused: false,
  ownerId: "p1",
  ...patch,
});
const player = (): GameState["player"] => ({
  form: "hero",
  hp: 9,
  exhausted: false,
  flipped: false,
  tough: false,
  stunned: false,
  confused: false,
  hand: [],
  deck: [],
  discard: [],
  inPlay: [],
});
function fixture() {
  let s: GameState = {
    version: 1,
    seed: 22,
    nextId: 1,
    heroId: "nebu",
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
    player: player(),
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
      heroId: "nebu",
      aspect: "justice",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  const native: Effect[] = [];
  const find = (state: GameState, id: string) =>
    id === "hero"
      ? state.player
      : id.startsWith("hero:")
        ? seatView(state, id.slice(5)).player
        : id === state.villain.id
          ? state.villain
          : state.minions.find((p) => p.id === id);
  const ports: NebulaPorts = {
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
          label: cards.get(p.code)!.name,
          image: p.code,
          effects: [],
        })),
      };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: vi.fn((state: GameState, counts, target) => {
      state.player.form = target === "alter" ? "alter" : "hero";
      if (counts) state.player.flipped = true;
    }),
    canReadyIdentity: () => true,
    canPay: () => true,
    canGiveStatus: (state, id, status) => {
      const p = find(state, id);
      return !!p && !p[status] && !state.flags[`stalwart:${id}`];
    },
    enemyTargets: (state, attack) => [
      ...(!attack ||
      nebulaIgnoresRestrictions(state, ports).guard ||
      !state.minions.some((p) => p.code === "01101")
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(state.scheme.threat > 0 &&
      (!thwart ||
        nebulaIgnoresRestrictions(state, ports).crisis ||
        !state.sideSchemes.some((p) => p.code === "01098")) &&
      (!thwart ||
        nebulaIgnoresRestrictions(state, ports).patrol ||
        !state.flags.patrol)
        ? [{ id: "main", label: "Main", code: state.scheme.code }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    isIdentityTextBlank: (state) => !!state.flags.identityBlank,
    canDiscardUpgrade: (state, p) =>
      !/\bPermanent\b/.test(cards.get(p.code)?.text || "") &&
      !state.flags[`permanent:${p.id}`],
    discardHand: vi.fn((state: GameState, id) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i >= 0) state.player.discard.push(...state.player.hand.splice(i, 1));
    }),
    discardPiece: vi.fn((state: GameState, id) => {
      for (const seat of state.players) {
        const p = seatView(state, seat).player;
        const i = p.inPlay.findIndex((p) => p.id === id);
        if (i >= 0) p.discard.push(...p.inPlay.splice(i, 1));
      }
      const i = state.attachments.findIndex((p) => p.id === id);
      if (i >= 0)
        state.encounter.discard.push(...state.attachments.splice(i, 1));
    }),
    revealHidden: vi.fn(),
    recycleEncounter: vi.fn((state: GameState) => {
      if (!state.encounter.deck.length) {
        state.encounter.deck.push(...state.encounter.discard.splice(0));
        state.encounter.acceleration++;
      }
    }),
    attackProgram: (state, effects, after) =>
      ports.queue(state, ...effects, ...after),
    log: vi.fn(),
    shufflePlayerDeck: vi.fn((state: GameState) => state.player.deck.reverse()),
    discardUntilTechnique: vi.fn((state: GameState, continuation) => {
      const original = state.player.deck.length;
      let found: Piece | undefined;
      for (let i = 0; i < original; i++) {
        const p = state.player.deck.shift()!;
        state.player.discard.push(p);
        if (cards.get(p.code)?.traits?.includes("Technique.")) {
          found = p;
          break;
        }
      }
      const exhausted = !state.player.deck.length;
      if (exhausted) state.player.deck.push(...state.player.discard.splice(0));
      ports.queue(state, ...(exhausted ? [{ type: "deck-exhausted" }] : []), {
        ...continuation,
        id: found?.id,
      });
    }),
    putDiscardedTechnique: vi.fn((state: GameState, id, after) => {
      const zone = state.player.discard.some((p) => p.id === id)
        ? state.player.discard
        : state.player.deck;
      const i = zone.findIndex((p) => p.id === id);
      if (i < 0) return false;
      state.player.inPlay.push(...zone.splice(i, 1));
      ports.queue(state, { type: "upgrade-entered", id }, ...after);
      return true;
    }),
    gamoraAttack: vi.fn((state: GameState, source, playerId, continuation) => {
      if (state.flags.noAttack) return false;
      ports.queue(
        state,
        { type: "native-gamora-attack", source, playerId },
        { ...continuation, performed: !state.flags.attackReplaced },
      );
      return true;
    }),
  };
  function run() {
    for (let steps = 0; s.queue.length && !s.prompt; steps++) {
      if (steps > 100) throw Error("Unexpected effect loop");
      const e = s.queue.shift()!;
      if (e.actorId && e.actorId !== s.activePlayerId)
        activateSeat(s, e.actorId);
      if (resolveNebulaEffect(s, e, ports)) continue;
      native.push(e);
      if (e.type === "damage") {
        const target = find(s, e.target);
        if (target === s.villain) s.villain.hp -= e.amount;
        else if (target && "damage" in target) target.damage += e.amount;
      }
      if (e.type === "thwart") {
        if (e.target === "main")
          s.scheme.threat = Math.max(0, s.scheme.threat - e.amount);
        else {
          const p = s.sideSchemes.find((p) => p.id === e.target);
          if (p) p.counters = Math.max(0, p.counters - e.amount);
        }
      }
      if (e.type === "status") {
        const p = find(s, e.target);
        if (p) p[e.status as "tough"] = true;
      }
      if (e.type === "draw")
        s.player.hand.push(...s.player.deck.splice(0, e.amount));
      if (e.type === "optional")
        s.prompt = {
          kind: "choice",
          title: e.title,
          text: e.text,
          options: [
            { id: "yes", label: "Yes", effects: e.effects },
            { id: "no", label: "No", effects: [] },
          ],
        };
      if (e.type === "removeEncounter") {
        const i = s.resolving.findIndex((p) => p.id === e.piece.id);
        if (i >= 0) s.removed.push(...s.resolving.splice(i, 1));
      }
    }
  }
  const start = (...effects: Effect[]) => {
    ports.queue(s, ...effects);
    run();
  };
  const choose = (id: string) => {
    const choice = s.prompt!.options.find((o) => o.id === id);
    if (!choice) throw Error(`Missing ${id} in ${s.prompt!.title}`);
    s.prompt = null;
    start(...choice.effects);
  };
  const select = (ids: string[]) => {
    const action = s.prompt!.selectAction!;
    s.prompt = null;
    start({ ...action, ids });
  };
  const save = () => {
    syncSeat(s);
    s = upgradeSave(JSON.parse(JSON.stringify(s)));
  };
  const teammate = (heroId = "gam", form: "hero" | "alter" = "hero") => {
    const p = player();
    p.form = form;
    s.players.push({
      id: "p2",
      heroId,
      aspect: "aggression",
      player: p,
      flags: {},
      ended: false,
      eliminated: false,
      mulliganDone: true,
    });
    s.playerCount++;
    return p;
  };
  return {
    get s() {
      return s;
    },
    ports,
    native,
    run,
    start,
    choose,
    select,
    save,
    teammate,
  };
}

describe("Nebula source and continuous printed rules", () => {
  it("registers the exact 16 identity/signature/encounter faces and original 15 signatures", () => {
    expect(NEBULA_SCRIPT_CODES).toHaveLength(16);
    expect(new Set(NEBULA_SCRIPT_CODES).size).toBe(16);
    expect(NEBULA_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(
      NEBULA_SCRIPT_CODES.filter((code) =>
        /^2200[2-9]$|^22010$/.test(code),
      ).reduce((n, code) => n + (cards.get(code)!.quantity || 0), 0),
    ).toBe(15);
    expect(cards.get("22001a")).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      hand_size: 5,
      health: 9,
    });
    expect(cards.get("22001b")).toMatchObject({ recover: 3, hand_size: 6 });
  });
  it("stacks independent physical Techniques only during Nebula hero form", () => {
    const h = fixture();
    h.s.player.inPlay = [
      piece("22006"),
      piece("22007"),
      piece("22007"),
      piece("22008"),
      piece("22008"),
      piece("22004"),
      piece("22005"),
    ];
    expect(nebulaStats(h.s, h.ports)).toEqual({
      attack: 1,
      thwart: 1,
      defense: 0,
    });
    expect(nebulaRetaliate(h.s, h.ports)).toBe(2);
    expect(nebulaAttackDamageReduction(h.s, h.ports)).toBe(2);
    expect(nebulaAttackKeywords(h.s, h.ports)).toEqual({
      piercing: true,
      overkill: true,
      stalwart: true,
    });
    expect(nebulaIgnoresRestrictions(h.s, h.ports)).toEqual({
      guard: true,
      patrol: true,
      crisis: true,
    });
    h.s.player.form = "alter";
    expect(nebulaStats(h.s, h.ports).attack).toBe(0);
    expect(nebulaRetaliate(h.s, h.ports)).toBe(0);
    expect(nebulaAttackDamageReduction(h.s, h.ports)).toBe(0);
    expect(nebulaIgnoresRestrictions(h.s, h.ports).guard).toBe(false);
    h.s.player.form = "hero";
    h.s.heroId = "gam";
    expect(nebulaAttackKeywords(h.s, h.ports).piercing).toBe(false);
  });
  it("does not derive continuous text from a blank physical source", () => {
    const h = fixture();
    const p = piece("22006");
    h.s.player.inPlay.push(p);
    h.s.flags[`blank:${p.id}`] = true;
    expect(nebulaStats(h.s, h.ports).attack).toBe(0);
    expect(nebulaAttackKeywords(h.s, h.ports).stalwart).toBe(false);
    expect(nebulaSpecialAvailable(h.s, p, h.ports)).toBe(false);
  });
  it("Self-Preservation modifies whichever named character is actually present", () => {
    const h = fixture();
    const scheme = piece("22029");
    h.s.sideSchemes.push(scheme);
    expect(nebulaNamedCharacterModifiers(h.s, "Nebula", h.ports)).toEqual({
      attack: -1,
      thwart: -1,
      defense: -1,
      piercing: false,
    });
    expect(nebulaNamedCharacterModifiers(h.s, "Gamora", h.ports)).toEqual({
      attack: 1,
      thwart: 0,
      defense: 0,
      piercing: true,
    });
    expect(nebulaNamedCharacterModifiers(h.s, "Rhino", h.ports).attack).toBe(0);
    h.s.flags[`blank:${scheme.id}`] = true;
    expect(nebulaNamedCharacterModifiers(h.s, "Gamora", h.ports).piercing).toBe(
      false,
    );
  });
  it("Ship generates one wild in either form and preserves actual physical identity", () => {
    const h = fixture();
    const a = piece("22003"),
      b = piece("22003");
    h.s.player.inPlay.push(a, b);
    h.s.player.form = "alter";
    expect(nebulaResourceSources(h.s, h.ports).map((p) => p.id)).toEqual([
      a.id,
      b.id,
    ]);
    expect(nebulaResourceSpent(h.s, a.id, h.ports)).toBe(true);
    expect(a.exhausted).toBe(true);
    expect(nebulaResourceSources(h.s, h.ports)).toHaveLength(1);
    expect(() => nebulaResourceSpent(h.s, a.id, h.ports)).toThrow();
    h.s.flags[`blank:${b.id}`] = true;
    expect(nebulaResourceSources(h.s, h.ports)).toEqual([]);
    expect(nebulaResourceSpent(h.s, "missing", h.ports)).toBe(false);
  });
});

describe("Combat Protocols and labeled Specials", () => {
  it("starts only on the actual Nebula hero turn, never teammate/AE/blank identity", () => {
    const h = fixture();
    h.s.player.inPlay.push(piece("22004"));
    expect(nebulaTurnBegan(h.s)).toHaveLength(1);
    expect(nebulaTurnBegan(h.s, "p2")).toEqual([]);
    h.s.player.form = "alter";
    expect(nebulaTurnBegan(h.s)).toEqual([]);
    h.s.player.form = "hero";
    h.s.flags.identityBlank = true;
    expect(nebulaTurnBegan(h.s, "p1", h.ports)).toEqual([]);
  });
  it("keeps resolved Cutthroat in play until later Weapons Master receives its keywords, including save/reload", () => {
    const h = fixture();
    const cut = piece("22004"),
      weapon = piece("22007");
    h.s.player.inPlay.push(cut, weapon);
    h.start(...nebulaTurnBegan(h.s));
    h.choose(cut.id);
    h.choose("main");
    expect(h.s.scheme.threat).toBe(2);
    expect(h.s.player.inPlay.map((p) => p.id)).toContain(cut.id);
    h.save();
    h.choose(weapon.id);
    h.save();
    h.choose(h.s.villain.id);
    expect(h.native.find((e) => e.type === "damage")).toMatchObject({
      amount: 4,
      attack: true,
      source: "hero",
      abilitySource: weapon.id,
      piercing: true,
      overkill: true,
    });
    expect(h.s.villain.hp).toBe(10);
    expect(h.s.player.inPlay).toEqual([]);
    expect(h.s.player.discard.map((p) => p.id)).toEqual([cut.id, weapon.id]);
  });
  it("resolves two printed copies individually and retains one that becomes unable to thwart", () => {
    const h = fixture();
    const a = piece("22004"),
      b = piece("22004");
    h.s.player.inPlay.push(a, b);
    h.s.scheme.threat = 2;
    h.start(...nebulaTurnBegan(h.s));
    h.choose(a.id);
    h.choose("main");
    h.choose(b.id);
    expect(h.s.scheme.threat).toBe(0);
    expect(h.s.player.inPlay.map((p) => p.id)).toEqual([b.id]);
    expect(h.s.player.discard.map((p) => p.id)).toEqual([a.id]);
  });
  it("a confused no-threat Special is replaced and counts resolved; the next no-threat Special stays", () => {
    const h = fixture();
    const a = piece("22004"),
      b = piece("22004");
    h.s.player.inPlay.push(a, b);
    h.s.scheme.threat = 0;
    h.s.player.confused = true;
    h.start(...nebulaTurnBegan(h.s));
    h.choose(a.id);
    expect(h.s.player.confused).toBe(false);
    h.choose(b.id);
    expect(h.native.some((e) => e.type === "thwart")).toBe(false);
    expect(h.s.player.inPlay.map((p) => p.id)).toEqual([b.id]);
  });
  it("Stun replaces only the first Weapons Master Special, preserving independent copies", () => {
    const h = fixture();
    const a = piece("22007"),
      b = piece("22007");
    h.s.player.inPlay.push(a, b);
    h.s.player.stunned = true;
    h.start(...nebulaTurnBegan(h.s));
    h.choose(a.id);
    expect(h.s.player.stunned).toBe(false);
    h.choose(b.id);
    h.choose(h.s.villain.id);
    expect(h.native.filter((e) => e.type === "damage")).toHaveLength(1);
    expect(h.s.player.discard.map((p) => p.id)).toEqual([a.id, b.id]);
  });
  it("Unyielding that cannot give Tough remains, and does not clear unrelated Confuse", () => {
    const h = fixture();
    const p = piece("22006");
    h.s.player.inPlay.push(p);
    h.s.player.tough = true;
    h.s.player.confused = true;
    h.start(...nebulaTurnBegan(h.s));
    h.choose(p.id);
    expect(h.s.player.inPlay[0].id).toBe(p.id);
    expect(h.s.player.confused).toBe(true);
  });
  it("giving Tough successfully resolves and discards Unyielding after all Specials", () => {
    const h = fixture();
    const p = piece("22006");
    h.s.player.inPlay.push(p);
    h.start(...nebulaTurnBegan(h.s));
    h.choose(p.id);
    expect(h.s.player.tough).toBe(true);
    expect(h.s.player.inPlay).toEqual([]);
  });
  it("Evasive chooses a nonattack status and cannot affect a Stalwart enemy", () => {
    const h = fixture();
    const p = piece("22005");
    const minion = piece("22028");
    h.s.player.inPlay.push(p);
    h.s.minions.push(minion);
    h.s.flags[`stalwart:${h.s.villain.id}`] = true;
    h.s.player.stunned = true;
    h.start(N("special", { id: p.id }));
    expect(h.s.prompt!.options).toHaveLength(2);
    h.choose(`${minion.id}:confused`);
    expect(minion.confused).toBe(true);
    expect(minion.stunned).toBe(false);
    expect(h.s.player.stunned).toBe(true);
    expect(h.s.player.inPlay).toHaveLength(1);
  });
  it("Evasive remains when every enemy is Stalwart", () => {
    const h = fixture();
    const p = piece("22005");
    h.s.player.inPlay.push(p);
    h.s.flags[`stalwart:${h.s.villain.id}`] = true;
    h.start(...nebulaTurnBegan(h.s));
    h.choose(p.id);
    expect(h.s.player.inPlay[0].id).toBe(p.id);
  });
  it("Guard still applies in AE while hero-form Evasive permits villain Special attacks", () => {
    const h = fixture();
    const weapon = piece("22007"),
      evasion = piece("22005"),
      guard = piece("01101");
    h.s.player.inPlay.push(weapon, evasion);
    h.s.minions.push(guard);
    h.s.player.form = "alter";
    h.start(N("special", { id: weapon.id }));
    expect(h.s.prompt!.options.map((o) => o.id)).toEqual([guard.id]);
    h.choose(guard.id);
    h.s.player.form = "hero";
    h.start(N("special", { id: weapon.id }));
    expect(h.s.prompt!.options.map((o) => o.id)).toContain(h.s.villain.id);
  });
  it("a blank Technique stays in play without its Special", () => {
    const h = fixture();
    const p = piece("22007");
    h.s.player.inPlay.push(p);
    h.s.flags[`blank:${p.id}`] = true;
    h.start(...nebulaTurnBegan(h.s));
    h.choose(p.id);
    expect(h.s.player.inPlay).toHaveLength(1);
    expect(h.s.villain.hp).toBe(14);
  });
});

describe("Wide Stance physical encounter inspection", () => {
  it("discards one of actual top three and orders exactly the two survivors after save/reload", () => {
    const h = fixture();
    const p = piece("22008"),
      a = piece("22031"),
      b = piece("22031"),
      c = piece("22028"),
      d = piece("22029");
    h.s.player.inPlay.push(p);
    h.s.encounter.deck.push(a, b, c, d);
    h.start(N("special", { id: p.id }));
    expect(h.s.encounter.deck.map((p) => p.id)).toEqual([
      a.id,
      b.id,
      c.id,
      d.id,
    ]);
    h.save();
    h.choose(b.id);
    h.save();
    h.choose(c.id);
    expect(h.s.encounter.deck.map((p) => p.id)).toEqual([c.id, a.id, d.id]);
    expect(h.s.encounter.discard.map((p) => p.id)).toEqual([b.id]);
    expect(h.ports.revealHidden).toHaveBeenCalledOnce();
  });
  it("with one remaining encounter card it discards once and performs normal reset once", () => {
    const h = fixture();
    const p = piece("22008"),
      a = piece("22031");
    h.s.player.inPlay.push(p);
    h.s.encounter.deck.push(a);
    h.start(N("special", { id: p.id }));
    h.choose(a.id);
    expect(h.s.encounter.deck.map((p) => p.id)).toEqual([a.id]);
    expect(h.s.encounter.acceleration).toBe(1);
    expect(h.s.prompt).toBeNull();
  });
  it("an empty encounter deck does not acquire an invented Special resolution", () => {
    const h = fixture();
    const p = piece("22008");
    h.s.player.inPlay.push(p);
    h.start(...nebulaTurnBegan(h.s));
    h.choose(p.id);
    expect(h.s.player.inPlay).toHaveLength(1);
    expect(h.ports.recycleEncounter).not.toHaveBeenCalled();
  });
  it("rejects forged look snapshots and duplicate ordering physical IDs", () => {
    const h = fixture();
    const a = piece("22031"),
      b = piece("22031");
    h.s.encounter.deck.push(a, b);
    expect(() =>
      resolveNebulaEffect(
        h.s,
        N("wide-discard", { looked: [b.id, a.id], discardId: a.id }),
        h.ports,
      ),
    ).toThrow(/actual looked/);
    expect(() =>
      resolveNebulaEffect(h.s, N("wide-order", { ids: [a.id, a.id] }), h.ports),
    ).toThrow(/two remaining/);
  });
});

describe("Cybernetic Upgrades, Gamora and event sequencing", () => {
  it("Combat Ready retrieves the exact last-card Technique after immediate deck reset, before its Special", () => {
    const h = fixture();
    h.s.player.form = "alter";
    const old = piece("22003"),
      found = piece("22006");
    h.s.player.discard.push(old);
    h.s.player.deck.push(found);
    h.start(...nebulaEvent(h.s, piece("22009"))!);
    h.choose("find");
    expect(h.native.map((e) => e.type)).toEqual([
      "deck-exhausted",
      "upgrade-entered",
      "status",
    ]);
    expect(h.s.player.inPlay.map((p) => p.id)).toEqual([found.id]);
    expect(h.s.player.inPlay[0].ownerId).toBe(found.ownerId);
    expect(h.s.player.deck.map((p) => p.id)).toEqual([old.id]);
    expect(h.s.player.discard).toEqual([]);
    expect(h.s.flags.nebulaCyberneticRound).toBeUndefined();
  });
  it("Combat Ready cannot choose an unresolvable recovery branch when no discarded Technique exists", () => {
    const h = fixture();
    h.s.player.form = "alter";
    h.s.player.deck.push(piece("22003"));
    h.s.player.discard.push(piece("22010"));
    h.start(...nebulaEvent(h.s, piece("22009"))!);
    expect(h.s.prompt!.options.map((o) => o.id)).toEqual(["find"]);
  });
  it("Cybernetic optional response limits accepted play triggers once per round, survives JSON and resets next round", () => {
    const h = fixture();
    h.s.player.form = "alter";
    const t = piece("22004");
    const a = piece("22003"),
      b = piece("22009"),
      c = piece("22010");
    h.s.player.deck.push(a, b, c);
    h.start(...nebulaCardPlayed(h.s, t, h.ports));
    h.choose("no");
    expect(h.s.flags.nebulaCyberneticRound).toBeUndefined();
    h.start(...nebulaCardPlayed(h.s, t, h.ports));
    h.save();
    h.choose("yes");
    expect(h.s.player.hand.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(nebulaCardPlayed(h.s, t, h.ports)).toEqual([]);
    h.save();
    h.s.round++;
    expect(nebulaCardPlayed(h.s, t, h.ports)).toHaveLength(1);
  });
  it("Cybernetic never triggers in hero form, on nonTechnique or while identity is blank", () => {
    const h = fixture();
    expect(nebulaCardPlayed(h.s, piece("22004"), h.ports)).toEqual([]);
    h.s.player.form = "alter";
    expect(nebulaCardPlayed(h.s, piece("22003"), h.ports)).toEqual([]);
    h.s.flags.identityBlank = true;
    expect(nebulaCardPlayed(h.s, piece("22004"), h.ports)).toEqual([]);
  });
  it("Gamora PLAY response resolves one Special without discarding that Technique, also in AE", () => {
    const h = fixture();
    const t = piece("22006"),
      ally = piece("22002");
    h.s.player.inPlay.push(t, ally);
    h.s.player.form = "alter";
    h.start(...nebulaAllyPlayed(h.s, ally, h.ports)!);
    h.choose("yes");
    h.choose(t.id);
    expect(h.s.player.tough).toBe(true);
    expect(h.s.player.inPlay.map((p) => p.id)).toContain(t.id);
    expect(h.s.flags.nebulaCyberneticRound).toBeUndefined();
  });
  it("blanked Gamora has no response and unrelated ally does not register", () => {
    const h = fixture();
    const p = piece("22002");
    h.s.player.inPlay.push(p, piece("22004"));
    h.s.flags[`blank:${p.id}`] = true;
    expect(nebulaAllyPlayed(h.s, p, h.ports)).toEqual([]);
    expect(nebulaAllyPlayed(h.s, piece("01062"), h.ports)).toBeNull();
  });
  it("Lethal Intent uses paid X, unique physical selections and player-chosen order without Technique discard", () => {
    const h = fixture();
    const a = piece("22004"),
      b = piece("22007"),
      c = piece("22007");
    h.s.player.inPlay.push(a, b, c);
    h.start(...nebulaEvent(h.s, piece("22010"), 2)!);
    expect(h.s.prompt).toMatchObject({ min: 0, max: 2 });
    h.select([a.id, b.id]);
    h.save();
    h.choose(b.id);
    h.choose(h.s.villain.id);
    h.choose(a.id);
    h.choose("main");
    expect(
      h.native
        .filter((e) => ["damage", "thwart"].includes(e.type))
        .map((e) => e.type),
    ).toEqual(["damage", "thwart"]);
    expect(h.s.player.inPlay.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
    expect(h.s.player.discard).toEqual([]);
  });
  it("Lethal Intent may choose zero but cannot choose duplicates or more than paid X", () => {
    const h = fixture();
    const p = piece("22004");
    h.s.player.inPlay.push(p);
    h.start(...nebulaEvent(h.s, piece("22010"), 1)!);
    h.select([]);
    expect(h.s.prompt).toBeNull();
    expect(() =>
      resolveNebulaEffect(
        h.s,
        N("lethal-selected", { limit: 1, ids: [p.id, p.id] }),
        h.ports,
      ),
    ).toThrow();
    expect(() => nebulaEvent(h.s, piece("22010"), -1)).toThrow();
  });
  it("Combat Ready recovers zero, one or two actual discarded Techniques and shuffles without draw", () => {
    const h = fixture();
    h.s.player.form = "alter";
    const a = piece("22004"),
      b = piece("22004"),
      other = piece("22010");
    h.s.player.discard.push(a, b, other);
    h.start(...nebulaEvent(h.s, piece("22009"))!);
    h.choose("recover");
    h.save();
    h.select([a.id, b.id]);
    expect(h.s.player.deck.map((p) => p.id)).toEqual([b.id, a.id]);
    expect(h.s.player.discard.map((p) => p.id)).toEqual([other.id]);
    expect(h.s.player.hand).toEqual([]);
    expect(h.ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    h.s.player.discard.push(piece("22006"));
    h.start(...nebulaEvent(h.s, piece("22009"))!);
    h.choose("recover");
    h.select([]);
    expect(h.ports.shufflePlayerDeck).toHaveBeenCalledTimes(1);
  });
  it("Combat Ready put-into-play entry precedes Special and does not trigger Cybernetic", () => {
    const h = fixture();
    h.s.player.form = "alter";
    const other = piece("22003"),
      t = piece("22006"),
      tail = piece("22010");
    h.s.player.deck.push(other, t, tail);
    h.start(...nebulaEvent(h.s, piece("22009"))!);
    h.choose("find");
    expect(h.native.map((e) => e.type)).toEqual(["upgrade-entered", "status"]);
    expect(h.s.player.inPlay.map((p) => p.id)).toEqual([t.id]);
    expect(h.s.player.discard.map((p) => p.id)).toEqual([other.id]);
    expect(h.s.player.deck.map((p) => p.id)).toEqual([tail.id]);
    expect(h.s.player.tough).toBe(true);
    expect(h.s.flags.nebulaCyberneticRound).toBeUndefined();
  });
  it("Combat Ready exhausted original deck processes exhaustion once and never continues its reset", () => {
    const h = fixture();
    h.s.player.form = "alter";
    const a = piece("22003"),
      b = piece("22010"),
      prior = piece("22006");
    h.s.player.deck.push(a, b);
    h.s.player.discard.push(prior);
    h.start(...nebulaEvent(h.s, piece("22009"))!);
    h.choose("find");
    expect(h.native.map((e) => e.type)).toEqual(["deck-exhausted"]);
    expect(h.s.player.inPlay).toEqual([]);
    expect(h.s.player.deck.map((p) => p.id)).toEqual([prior.id, a.id, b.id]);
    expect(h.ports.putDiscardedTechnique).not.toHaveBeenCalled();
  });
  it("form restrictions and missing meaningful event targets are enforced before payment", () => {
    const h = fixture();
    expect(nebulaPlayRestriction(h.s, piece("22009"), h.ports)).toMatch(
      /alter-ego/,
    );
    expect(nebulaPlayRestriction(h.s, piece("22010"), h.ports)).toMatch(
      /no Technique/,
    );
    h.s.player.form = "alter";
    expect(nebulaPlayRestriction(h.s, piece("22010"), h.ports)).toMatch(
      /hero form/,
    );
    expect(nebulaPlayRestriction(h.s, piece("22009"), h.ports)).toMatch(
      /no cards/,
    );
  });
});

describe("Nebula nemesis and obligation native contracts", () => {
  it("Lethal Weapon attaches to Gamora's alter-ego identity, while Old Rivals cannot attack using that face", () => {
    const h = fixture();
    h.teammate("gam", "alter");
    const attachment = piece("22030");
    h.s.attachments.push(attachment);
    h.start(...nebulaEncounterReveal(h.s, attachment)!);
    expect(attachment.attachedTo).toBe("hero:p2");
    h.start(...nebulaEncounterReveal(h.s, piece("22031"))!);
    expect(h.ports.gamoraAttack).not.toHaveBeenCalled();
    expect(h.native.at(-1)).toMatchObject({
      type: "surge",
      sourceCode: "22031",
    });
  });
  it("Old Rivals receives actual deferred Stun/cancel result and grants native Surge after that window", () => {
    const h = fixture();
    h.s.player.inPlay.push(piece("22002"));
    h.s.flags.attackReplaced = true;
    const event = nebulaEncounterReveal(h.s, piece("22031"))![0];
    event.after = [{ type: "finished" }];
    h.start(event);
    expect(h.native.map((e) => e.type)).toEqual([
      "native-gamora-attack",
      "surge",
      "finished",
    ]);
    expect(h.native[1]).toMatchObject({ sourceCode: "22031" });
  });
  it("Gamora's forced upgrade discard excludes all physical Permanent upgrades", () => {
    const h = fixture();
    h.s.player.inPlay.push(piece("21002"));
    const source = piece("22028");
    h.s.minions.push(source);
    h.start(...nebulaGamoraAttackEnded(h.s, source, "p1", 1, h.ports));
    expect(h.s.prompt).toBeNull();
    expect(h.s.player.inPlay).toHaveLength(1);
    expect(h.s.player.discard).toEqual([]);
  });
  it("Gamora will-enter discards all printed Gamora allies across seats, preserving hero and unrelated allies", () => {
    const h = fixture();
    const a = piece("22002"),
      other = piece("18002");
    h.s.player.inPlay.push(a, other);
    const teammate = h.teammate();
    const b = piece("19020", { ownerId: "p2" });
    teammate.inPlay.push(b);
    // Drax pack19020 is also printed Gamora.
    expect(cards.get("19020")!.name).toBe("Gamora");
    nebulaMinionWillEnter(h.s, piece("22028"), h.ports);
    expect(h.s.player.inPlay.map((p) => p.id)).toEqual([other.id]);
    expect(teammate.inPlay).toEqual([]);
    expect(teammate.form).toBe("hero");
  });
  it("blanked Gamora minion does not discard an entering ally", () => {
    const h = fixture();
    const ally = piece("22002"),
      minion = piece("22028");
    h.s.player.inPlay.push(ally);
    h.s.flags[`blank:${minion.id}`] = true;
    nebulaMinionWillEnter(h.s, minion, h.ports);
    expect(h.s.player.inPlay).toHaveLength(1);
  });
  it.each([0, -1])(
    "Gamora does not discard upgrades after %s attack damage taken",
    (damage) => {
      const h = fixture();
      expect(
        nebulaGamoraAttackEnded(h.s, piece("22028"), "p1", damage, h.ports),
      ).toEqual([]);
    },
  );
  it("Gamora attack damage forces actual victim to choose a discardable upgrade after JSON", () => {
    const h = fixture();
    const teammate = h.teammate("stl");
    const p = piece("17009", { ownerId: "p2" }),
      perm = piece("21002", { ownerId: "p2" });
    teammate.inPlay.push(p, perm);
    teammate.form = "alter";
    h.s.flags[`permanent:${perm.id}`] = true;
    const source = piece("22028");
    h.s.minions.push(source);
    h.start(...nebulaGamoraAttackEnded(h.s, source, "p2", 1, h.ports));
    h.save();
    h.choose(p.id);
    expect(h.s.activePlayerId).toBe("p2");
    expect(h.s.player.discard.map((p) => p.id)).toEqual([p.id]);
  });
  it("Gamora which left play cannot create a new attack-ended forced response", () => {
    const h = fixture();
    const source = piece("22028");
    h.s.player.inPlay.push(piece("22004"));
    expect(nebulaGamoraAttackEnded(h.s, source, "p1", 1, h.ports)).toEqual([]);
    h.s.minions.push(source);
    expect(nebulaGamoraAttackEnded(h.s, source, "unknown", 1, h.ports)).toEqual(
      [],
    );
    h.s.flags[`blank:${source.id}`] = true;
    expect(nebulaGamoraAttackEnded(h.s, source, "p1", 1, h.ports)).toEqual([]);
  });
  it("Lethal Weapon attaches to actual enemy Gamora, player Gamora, or villain fallback", () => {
    const h = fixture();
    const attachment = piece("22030");
    h.s.attachments.push(attachment);
    h.start(...nebulaEncounterReveal(h.s, attachment)!);
    expect(attachment.attachedTo).toBe(h.s.villain.id);
    h.teammate();
    h.start(...nebulaEncounterReveal(h.s, attachment)!);
    expect(attachment.attachedTo).toBe("hero:p2");
    const minion = piece("22028");
    h.s.minions.push(minion);
    h.start(...nebulaEncounterReveal(h.s, attachment)!);
    expect(attachment.attachedTo).toBe(minion.id);
  });
  it("Lethal Weapon action pays a controlled nonPermanent upgrade and discards the actual attachment", () => {
    const h = fixture();
    const attachment = piece("22030"),
      p = piece("22004"),
      perm = piece("21002");
    h.s.attachments.push(attachment);
    h.s.player.inPlay.push(p, perm);
    h.s.flags[`permanent:${perm.id}`] = true;
    h.start(...nebulaAttachmentActions(h.s, attachment, h.ports)[0].effects);
    expect(h.s.prompt!.options.map((p) => p.id)).toEqual([p.id]);
    h.choose(p.id);
    expect(h.s.player.discard.map((p) => p.id)).toEqual([p.id]);
    expect(h.s.encounter.discard.map((p) => p.id)).toEqual([attachment.id]);
  });
  it("Old Rivals delegates an actual Gamora ally attack without exhaust and retains response continuation", () => {
    const h = fixture();
    const ally = piece("22002");
    h.s.player.inPlay.push(ally);
    const e = nebulaEncounterReveal(h.s, piece("22031"))![0];
    e.after = [{ type: "finished" }];
    h.start(e);
    expect(h.ports.gamoraAttack).toHaveBeenCalledWith(
      h.s,
      { kind: "ally", id: ally.id, playerId: "p1", code: "22002" },
      "p1",
      expect.objectContaining({
        type: "nebula:old-rivals-ended",
        actorId: "p1",
        after: [{ type: "finished" }],
      }),
    );
    expect(ally.exhausted).toBe(false);
    expect(h.native.map((e) => e.type)).toEqual([
      "native-gamora-attack",
      "finished",
    ]);
  });
  it("Old Rivals delegates actual Gamora hero even if already exhausted", () => {
    const h = fixture();
    const p = h.teammate();
    p.exhausted = true;
    h.start(...nebulaEncounterReveal(h.s, piece("22031"))!);
    expect(h.native[0]).toMatchObject({
      type: "native-gamora-attack",
      source: { kind: "hero", id: "hero:p2", playerId: "p2", code: "18001a" },
    });
    expect(p.exhausted).toBe(true);
  });
  it("Old Rivals surges only if no Gamora attack is initiated", () => {
    const h = fixture();
    h.start(...nebulaEncounterReveal(h.s, piece("22031"))!);
    expect(h.native[0].type).toBe("surge");
    h.native.length = 0;
    h.s.player.inPlay.push(piece("22002"));
    h.s.flags.noAttack = true;
    h.start(...nebulaEncounterReveal(h.s, piece("22031"))!);
    expect(h.native[0].type).toBe("surge");
  });
  it("obligation optional flip and exhaust removes the exact physical obligation without ordinary flip count", () => {
    const h = fixture();
    const p = piece("22027");
    h.s.resolving.push(p);
    h.start(...nebulaEncounterReveal(h.s, p)!);
    h.choose("flip");
    h.save();
    h.choose("remove");
    expect(h.s.player.form).toBe("alter");
    expect(h.s.player.exhausted).toBe(true);
    expect(h.s.player.flipped).toBe(false);
    expect(h.s.removed.map((p) => p.id)).toEqual([p.id]);
  });
  it.each([1, 2])(
    "obligation discards %s actual available Techniques without surge",
    (count) => {
      const h = fixture();
      const ts = Array.from({ length: count }, () => piece("22004"));
      h.s.player.inPlay.push(...ts);
      h.start(...nebulaEncounterReveal(h.s, piece("22027"))!);
      h.choose("stay");
      h.choose("techniques");
      h.save();
      h.select(ts.map((p) => p.id));
      expect(h.s.player.inPlay).toEqual([]);
      expect(h.s.player.discard.map((p) => p.id)).toEqual(ts.map((p) => p.id));
      expect(h.native.some((e) => e.type === "surge")).toBe(false);
    },
  );
  it("obligation zero-Technique branch always remains legal and surges once", () => {
    const h = fixture();
    h.s.flags.formLocked = true;
    h.start(...nebulaEncounterReveal(h.s, piece("22027"))!);
    h.choose("techniques");
    expect(h.native.filter((e) => e.type === "surge")).toHaveLength(1);
  });
  it("obligation rejects duplicate controlled physical Technique choices", () => {
    const h = fixture();
    const p = piece("22004");
    h.s.player.inPlay.push(p);
    expect(() =>
      resolveNebulaEffect(
        h.s,
        N("obligation-discard", { ids: [p.id, p.id], count: 2 }),
        h.ports,
      ),
    ).toThrow();
  });
  it("all five encounter definitions have inert numeric boost handlers and foreign codes remain unclaimed", () => {
    const h = fixture();
    for (const code of ["22027", "22028", "22029", "22030", "22031"])
      expect(nebulaBoost(h.s, piece(code))).toEqual([]);
    expect(nebulaBoost(h.s, piece("01094"))).toBeNull();
    expect(nebulaEncounterReveal(h.s, piece("01094"))).toBeNull();
    expect(resolveNebulaEffect(h.s, { type: "other" }, h.ports)).toBe(false);
  });
});
