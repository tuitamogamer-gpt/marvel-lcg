import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sourceDecks from "../src/data/catalog-decks.json" with { type: "json" };
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  SPECTRUM_SCRIPT_CODES,
  SPECTRUM_FORM_CODES,
  resolveSpectrumEffect,
  spectrumAbility,
  spectrumAllyEntersPlay,
  spectrumAttachmentOptions,
  spectrumBoost,
  spectrumCanChangeEnergyForm,
  spectrumChangedForm,
  spectrumDefenseOptions,
  spectrumEncounterReveal,
  spectrumEnergyForm,
  spectrumEnemyActivated,
  spectrumEvent,
  spectrumFormFaceup,
  spectrumFormResponseOptions,
  spectrumObligationOptions,
  spectrumPhaseEnded,
  spectrumPlayRestriction,
  spectrumResourceSources,
  spectrumResourceSpent,
  spectrumRetaliate,
  spectrumSetup,
  spectrumSideSchemeDefeated,
  spectrumStats,
  spectrumTurnEnded,
  type SpectrumEnergyForm,
  type SpectrumPorts,
} from "../src/game/spectrum.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const source = sourceDecks.find((d) => d.id === "starter-21001a")!;
const sourceCodes = Object.entries(source.cards).flatMap(([code, count]) =>
  Array.from({ length: count }, () => code),
);
const S = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `spectrum:${type}`,
  ...args,
});
const reload = (s: GameState): GameState => {
  const saved: GameState = JSON.parse(JSON.stringify(s));
  const seat = saved.players.find((p) => p.id === saved.activePlayerId)!;
  seat.player = saved.player;
  seat.flags = saved.flags;
  return saved;
};

function fixture(team = false, playerId = "p1") {
  let s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId: "rhino",
    seed: 21001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "rocket", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  expect(s.error).toBeUndefined();
  for (const seat of s.players) seat.mulliganDone = true;
  if (playerId !== "p1") activateSeat(s, playerId);
  s.heroId = s.players.find((p) => p.id === playerId)!.heroId = "spectrum";
  s.phase = "player";
  s.player.form = "alter";
  s.player.hp = 11;
  s.flags = {};
  s.players.find((p) => p.id === playerId)!.flags = s.flags;
  s.player.hand = [];
  s.player.discard = [];
  s.player.inPlay = [];
  const piece = (code: string, ownerId = s.activePlayerId) => ({
    ...makePiece(s, code),
    ownerId,
  });
  s.player.deck = sourceCodes.map((code) => piece(code));
  const original = s.player.deck.map((p) => p.id);
  s.players.find((p) => p.id === playerId)!.player = s.player;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.attack = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.scheme.threat = 6;
  const observed: Effect[] = [];
  const ports: SpectrumPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    makePiece: vi.fn((state, code) => ({
      ...makePiece(state, code),
      ownerId: state.activePlayerId,
    })),
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    identityTextBlank: (state) => !!state.flags.identityBlank,
    canChangeForm: (state) => !state.flags.formLocked,
    canReadyIdentity: (state) => !state.flags.readyLocked,
    canPay: (state) => !state.flags.paymentLocked,
    cardCost: (_state, p) => cards.get(p.code)?.cost || 0,
    heroMaxHP: () => 11,
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some(
        (p) =>
          p.engagedWith === state.activePlayerId &&
          /Guard\./.test(cards.get(p.code)?.text || ""),
      )
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart, ignoreCrisis = false) => [
      ...(state.scheme.threat > 0 &&
      (ignoreCrisis ||
        !state.sideSchemes.some((p) => cards.get(p.code)?.scheme_crisis)) &&
      (!thwart || !state.flags.patrol)
        ? [{ id: "main", label: "The Break-In!" }]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({
          id: p.id,
          label: cards.get(p.code)!.name,
          code: p.code,
        })),
    ],
    energyFormChanged: vi.fn(),
    formResponseOptions: (state, after) =>
      state.flags.genericFormResponse
        ? [
            {
              id: "moxie",
              label: "Moxie",
              effects: [{ type: "fixture:moxie" }, ...after],
            },
          ]
        : [],
    refreshDefense: vi.fn((state) => {
      if (state.attack?.basicDefense && state.attack.defender === "hero")
        state.attack.defense = 1 + spectrumStats(state, ports).defense;
    }),
    damageBatch: vi.fn(
      (state: GameState, ids: string[], amount: number, source: string) => {
        observed.push({ type: "damageBatch", ids, amount, source });
        for (const id of ids) {
          if (id.startsWith("hero:")) {
            const v = seatView(state, id.slice(5));
            if (v.player.tough) v.player.tough = false;
            else v.player.hp -= amount;
          } else {
            const p = state.players
              .flatMap((seat) => seatView(state, seat).player.inPlay)
              .find((p) => p.id === id)!;
            if (p.tough) p.tough = false;
            else p.damage += amount;
          }
        }
      },
    ),
    giveObligation: vi.fn((state: GameState, p: Piece, ownerId: string) => {
      state.resolving = state.resolving.filter((c) => c.id !== p.id);
      p.dealtTo = ownerId;
      seatView(state, ownerId).player.inPlay.push(p);
    }),
    attachIdentity: vi.fn((state: GameState, p: Piece, ownerId: string) => {
      state.resolving = state.resolving.filter((c) => c.id !== p.id);
      p.attachedTo = `hero:${ownerId}`;
      state.attachments.push(p);
    }),
  };
  function choose(state: GameState, id: string): GameState {
    state = reload(state);
    const o = state.prompt!.options.find((o) => o.id === id);
    expect(o, JSON.stringify(state.prompt)).toBeDefined();
    state.prompt = null;
    state.queue.unshift(...o!.effects);
    return run(state);
  }
  function step(state: GameState) {
    const e = state.queue.shift()!;
    expect(e).toBeDefined();
    if (resolveSpectrumEffect(state, e, ports)) return e;
    observed.push(e);
    switch (e.type) {
      case "damage": {
        const p =
          e.target === state.villain.id
            ? state.villain
            : state.minions.find((p) => p.id === e.target);
        if (p?.tough) p.tough = false;
        else if (p) p.damage += e.amount;
        break;
      }
      case "thwart":
        if (e.target === "main")
          state.scheme.threat = Math.max(0, state.scheme.threat - e.amount);
        else
          state.sideSchemes.find((p) => p.id === e.target)!.counters = Math.max(
            0,
            state.sideSchemes.find((p) => p.id === e.target)!.counters -
              e.amount,
          );
        break;
      case "heal":
        state.player.hp = Math.min(11, state.player.hp + e.amount);
        break;
      case "draw":
        for (let n = 0; n < e.amount; n++) {
          const p = state.player.deck.shift();
          if (p) state.player.hand.push(p);
        }
        break;
      case "ready":
        if (!state.flags.readyLocked) state.player.exhausted = false;
        break;
      case "optional":
        ports.choose(state, e.title, e.text, [
          { id: "yes", label: "Yes", effects: e.effects },
          { id: "no", label: "No", effects: [] },
        ]);
        break;
      case "payRequest":
        state.prompt = {
          kind: "payment",
          title: e.title,
          text: "Pay",
          options: [],
          cost: e.cost,
          requirements: e.requirements,
          card: e.piece,
          after: e.after,
        };
        break;
      case "resolveHandEvent": {
        const i = state.player.hand.findIndex((p) => p.id === e.id);
        expect(i).toBeGreaterThanOrEqual(0);
        const [p] = state.player.hand.splice(i, 1);
        state.resolving.push(p);
        state.queue.unshift(
          ...e.after,
          { type: "fixture:finish", id: p.id },
          ...(e.continuation || []),
        );
        break;
      }
      case "fixture:finish": {
        const i = state.resolving.findIndex((p) => p.id === e.id);
        if (i >= 0) state.player.discard.push(state.resolving.splice(i, 1)[0]);
        break;
      }
      case "fixture:moxie":
        delete state.flags.genericFormResponse;
        state.flags.moxieResolved = true;
        break;
      case "threat":
        state.scheme.threat += e.amount;
        break;
      case "removeEncounter":
      case "discardEncounter": {
        for (const zone of [
          state.resolving,
          state.attachments,
          ...state.players.map((seat) => seatView(state, seat).player.inPlay),
        ]) {
          const i = zone.findIndex((p) => p.id === e.piece.id);
          if (i >= 0) zone.splice(i, 1);
        }
        (e.type === "removeEncounter"
          ? state.removed
          : state.encounter.discard
        ).push(e.piece);
        break;
      }
      default:
        throw Error(`Unhandled fixture effect ${e.type}`);
    }
    return e;
  }
  function run(state: GameState, effects: Effect[] = []): GameState {
    state.queue.unshift(...effects);
    for (let n = 0; state.queue.length && !state.prompt && n < 150; n++) {
      state = reload(state);
      step(state);
    }
    return state;
  }
  function pay(state: GameState): GameState {
    state = reload(state);
    expect(state.prompt?.kind).toBe("payment");
    const after = state.prompt!.after || [];
    state.prompt = null;
    return run(state, after);
  }
  function skip(state: GameState): GameState {
    while (state.prompt?.kind === "choice") {
      expect(state.prompt.options.some((o) => o.id === "continue")).toBe(true);
      state = choose(state, "continue");
    }
    return state;
  }
  function put(code: string, state = s, ownerId = state.activePlayerId) {
    const player = seatView(state, ownerId).player;
    const i = player.deck.findIndex((p) => p.code === code);
    const p = i >= 0 ? player.deck.splice(i, 1)[0] : piece(code, ownerId);
    player.inPlay.push(p);
    return p;
  }
  function hand(code: string, state = s) {
    const i = state.player.deck.findIndex((p) => p.code === code);
    const p = i >= 0 ? state.player.deck.splice(i, 1)[0] : piece(code);
    state.player.hand.push(p);
    return p;
  }
  function form(form: SpectrumEnergyForm, state = s) {
    const p = state.player.inPlay.find(
      (p) => p.code === SPECTRUM_FORM_CODES[form],
    )!;
    state.player.form = "hero";
    state.flags.spectrumEnergyFormId = p.id;
    return p;
  }
  function defend(state = s, targetPlayerId = state.activePlayerId) {
    state.attack = {
      attacker: state.villain.id,
      base: 2,
      boostCodes: [],
      boostEffects: [],
      defender: "hero",
      basicDefense: true,
      targetPlayerId,
      defense: 1 + spectrumStats(state, ports).defense,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    state.player.exhausted = true;
  }
  function conserve(state: GameState) {
    const physical = [
      ...state.player.deck,
      ...state.player.hand,
      ...state.player.discard,
      ...state.player.inPlay,
      ...state.resolving,
      ...state.removed,
    ];
    for (const id of original)
      expect(
        physical.filter((p) => p.id === id),
        id,
      ).toHaveLength(1);
  }
  s = run(s, spectrumSetup(s));
  return {
    s,
    ports,
    observed,
    piece,
    original,
    run,
    choose,
    pay,
    skip,
    put,
    hand,
    form,
    defend,
    conserve,
  };
}

describe("Spectrum original source, physical setup and energy state", () => {
  it("covers16 actual faces,43 player cards and exactly40 ordinary source cards", () => {
    const f = fixture();
    expect(SPECTRUM_SCRIPT_CODES).toHaveLength(16);
    expect(new Set(SPECTRUM_SCRIPT_CODES).size).toBe(16);
    expect(SPECTRUM_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(sourceCodes).toHaveLength(43);
    expect(f.s.player.deck).toHaveLength(40);
    expect(f.s.player.inPlay.map((p) => p.code).sort()).toEqual([
      "21002",
      "21003",
      "21004",
    ]);
    expect(f.ports.makePiece).not.toHaveBeenCalled();
    expect(f.s.player.inPlay.every((p) => !spectrumFormFaceup(f.s, p))).toBe(
      true,
    );
    f.conserve(f.s);
  });
  it("printed identity and scan resources retain1/1/1 HP11 REC3 hands5/6", () => {
    expect(cards.get("21001a")).toMatchObject({
      attack: 1,
      thwart: 1,
      defense: 1,
      health: 11,
      hand_size: 5,
    });
    expect(cards.get("21001b")).toMatchObject({
      recover: 3,
      health: 11,
      hand_size: 6,
    });
    expect(cards.get("21002")?.resource_physical).toBe(1);
    expect(cards.get("21003")?.resource_mental).toBe(1);
    expect(cards.get("21004")?.resource_energy).toBe(1);
  });
  it("reloaded setup is idempotent and never rebuilds a missing initialized form", () => {
    const f = fixture(),
      ids = f.s.player.inPlay.map((p) => p.id);
    let s = f.run(reload(f.s), spectrumSetup(f.s));
    expect(s.player.inPlay.map((p) => p.id)).toEqual(ids);
    s.removed.push(s.player.inPlay.shift()!);
    s = f.run(s, spectrumSetup(s));
    expect(s.player.inPlay).toHaveLength(2);
    expect(f.ports.makePiece).not.toHaveBeenCalled();
    f.conserve(s);
  });
  it("initialization creates exactly3 setup instances only for a40-card source missing setup", () => {
    const f = fixture();
    delete f.s.flags.spectrumSetupComplete;
    f.s.player.inPlay = [];
    const s = f.run(f.s, spectrumSetup(f.s));
    expect(f.ports.makePiece).toHaveBeenCalledTimes(3);
    expect(s.player.deck).toHaveLength(40);
    expect(s.player.inPlay).toHaveLength(3);
  });
  it("duplicate physical copies of a permanent form are rejected", () => {
    const f = fixture();
    delete f.s.flags.spectrumSetupComplete;
    f.s.player.deck.push(f.piece("21002"));
    expect(() => f.run(f.s, spectrumSetup(f.s))).toThrow(/one physical/);
  });
  it.each(["gamma", "photon", "pulsar"] as const)(
    "mandatory Hero entry chooses one physical%s form across reload",
    (form) => {
      const f = fixture();
      f.s.player.form = "hero";
      f.s.player.flipped = true;
      let s = f.run(f.s, spectrumChangedForm(f.s, f.ports));
      expect(s.prompt?.title).toBe("Energy Transformation");
      expect(s.prompt?.options).toHaveLength(3);
      const p = s.player.inPlay.find(
        (p) => p.code === SPECTRUM_FORM_CODES[form],
      )!;
      s = f.skip(f.choose(s, p.id));
      expect(spectrumEnergyForm(s)).toBe(form);
      expect(
        s.player.inPlay.filter((p) => spectrumFormFaceup(s, p)),
      ).toHaveLength(1);
      expect(s.player.flipped).toBe(true);
      f.conserve(s);
    },
  );
  it("Power Down turns all forms facedown, preserves IDs, and doesn't consume another flip", () => {
    const f = fixture();
    f.form("gamma");
    const ids = f.s.player.inPlay.map((p) => p.id);
    f.s.player.form = "alter";
    expect(spectrumChangedForm(f.s, f.ports)).toEqual([]);
    expect(spectrumEnergyForm(f.s)).toBeUndefined();
    expect(f.s.player.inPlay.map((p) => p.id)).toEqual(ids);
    expect(spectrumStats(f.s)).toEqual({ attack: 0, thwart: 0, defense: 0 });
  });
  it("blank identity does not initiate Energy Transformation or Power Down", () => {
    const f = fixture();
    f.form("gamma");
    f.s.flags.identityBlank = true;
    expect(spectrumChangedForm(f.s, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    expect(spectrumChangedForm(f.s, f.ports)).toEqual([]);
    expect(f.s.flags.spectrumEnergyFormId).toBeDefined();
    expect(spectrumStats(f.s)).toEqual({ attack: 0, thwart: 0, defense: 0 });
  });
  it.each(["gamma", "photon", "pulsar"] as const)(
    "only faceup%s contributes its printed +2 and blanking removes that text",
    (form) => {
      const f = fixture(),
        p = f.form(form);
      expect(spectrumStats(f.s, f.ports)).toEqual({
        attack: form === "gamma" ? 2 : 0,
        thwart: form === "photon" ? 2 : 0,
        defense: form === "pulsar" ? 2 : 0,
      });
      f.s.flags[`blank:${p.id}`] = true;
      expect(spectrumStats(f.s, f.ports)).toEqual({
        attack: 0,
        thwart: 0,
        defense: 0,
      });
      expect(spectrumEnergyForm(f.s)).toBe(form);
    },
  );
  it("other heroes cannot acquire Spectrum's default form or stats", () => {
    const f = fixture();
    f.form("gamma");
    f.s.heroId = "rocket";
    expect(spectrumEnergyForm(f.s)).toBeUndefined();
    expect(spectrumStats(f.s)).toEqual({ attack: 0, thwart: 0, defense: 0 });
  });
});

describe("Spectrum event transitions and ordered responses", () => {
  it("Gamma Blast first deals7 attack damage, then offers Gamma's separate1 nonattack response", () => {
    const f = fixture();
    f.form("photon");
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21007" } as Piece)!);
    expect(spectrumEnergyForm(s)).toBe("gamma");
    expect(s.prompt?.title).toBe("Gamma Blast");
    expect(f.observed).toEqual([]);
    s = f.choose(s, s.villain.id);
    expect(f.observed.filter((e) => e.type === "damage")).toEqual([
      expect.objectContaining({
        amount: 7,
        attack: true,
        overkill: false,
        source: "hero",
      }),
    ]);
    const gamma = s.player.inPlay.find((p) => p.code === "21002")!;
    s.player.stunned = true;
    s = f.choose(s, gamma.id);
    s = f.choose(s, s.villain.id);
    s = f.skip(s);
    expect(f.observed.filter((e) => e.type === "damage")).toEqual([
      expect.objectContaining({ amount: 7, attack: true }),
      expect.objectContaining({ amount: 1, source: "hero" }),
    ]);
    expect(
      f.observed.filter((e) => e.type === "damage")[1].attack,
    ).toBeUndefined();
    f.conserve(s);
  });
  it("alreadyGamma grants Overkill and creates no new form-change response", () => {
    const f = fixture();
    f.form("gamma");
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21007" } as Piece)!);
    s = f.choose(s, s.villain.id);
    expect(f.observed[0]).toMatchObject({ amount: 7, overkill: true });
    expect(s.prompt).toBeNull();
    expect(f.ports.energyFormChanged).not.toHaveBeenCalled();
  });
  it("energy response bypasses Guard while Gamma Blast's attack obeys it", () => {
    const f = fixture();
    f.form("photon");
    const guard = f.piece("01101");
    guard.engagedWith = "p1";
    f.s.minions.push(guard);
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21007" } as Piece)!);
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(false);
    s = f.choose(s, guard.id);
    s = f.choose(s, s.player.inPlay.find((p) => p.code === "21002")!.id);
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(true);
  });
  it.each([false, true])(
    "Photon Speed ignores Crisis only if alreadyPhoton=%s",
    (already) => {
      const f = fixture();
      f.form(already ? "photon" : "gamma");
      const crisis = f.piece("01108");
      crisis.counters = 5;
      f.s.sideSchemes.push(crisis);
      let s = f.run(f.s, spectrumEvent(f.s, { code: "21008" } as Piece)!);
      expect(s.prompt?.options.some((o) => o.id === "main")).toBe(already);
      s = f.choose(s, already ? "main" : crisis.id);
      expect(f.observed[0]).toMatchObject({
        amount: 4,
        action: true,
        ignoreCrisis: already,
      });
      if (!already) expect(s.prompt?.title).toBe("Photon energy form");
    },
  );
  it("alreadyPhoton's Crisis override does not override Patrol", () => {
    const f = fixture();
    f.form("photon");
    f.s.flags.patrol = true;
    const side = f.piece("01108");
    side.counters = 5;
    f.s.sideSchemes.push(side);
    const s = f.run(f.s, spectrumEvent(f.s, { code: "21008" } as Piece)!);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([side.id]);
  });
  it("Photon response removes threat without a thwart but still obeys Crisis", () => {
    const f = fixture();
    f.form("gamma");
    f.s.flags.patrol = true;
    f.s.player.confused = true;
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21008" } as Piece)!);
    expect(s.prompt?.title).toBe("Photon energy form");
    s = f.choose(s, s.player.inPlay.find((p) => p.code === "21003")!.id);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(true);
    s = f.choose(s, "main");
    expect(f.observed.find((e) => e.type === "thwart")).toMatchObject({
      amount: 1,
      action: false,
    });
    expect(s.player.confused).toBe(true);
  });
  it("Speed of Light draws the actual top card before form responses and excludes the current form", () => {
    const f = fixture();
    const gamma = f.form("gamma"),
      top = f.s.player.deck[0];
    f.s.player.flipped = true;
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21010" } as Piece)!);
    expect(s.prompt?.options.some((o) => o.id === gamma.id)).toBe(false);
    s = f.choose(s, s.player.inPlay.find((p) => p.code === "21003")!.id);
    expect(s.player.hand[0].id).toBe(top.id);
    expect(s.prompt?.title).toBe("Photon energy form");
    expect(s.player.flipped).toBe(true);
    f.conserve(s);
  });
  it("form response and common Moxie responses can resolve in either order once each", () => {
    for (const first of ["moxie", "gamma"]) {
      const f = fixture();
      f.form("photon");
      f.s.flags.genericFormResponse = true;
      let s = f.run(f.s, spectrumEvent(f.s, { code: "21007" } as Piece)!);
      s = f.choose(s, s.villain.id);
      const gamma = s.player.inPlay.find((p) => p.code === "21002")!;
      expect(s.prompt?.options.map((o) => o.id)).toEqual([
        gamma.id,
        "moxie",
        "continue",
      ]);
      if (first === "moxie") {
        s = f.choose(s, "moxie");
        s = f.choose(s, gamma.id);
        s = f.choose(s, s.villain.id);
      } else {
        s = f.choose(s, gamma.id);
        s = f.choose(s, s.villain.id);
        expect(s.prompt?.options.some((o) => o.id === gamma.id)).toBe(false);
        s = f.choose(s, "moxie");
      }
      expect(s.prompt).toBeNull();
      expect(s.flags.moxieResolved).toBe(true);
      expect(f.observed.filter((e) => e.type === "damage")).toHaveLength(2);
    }
  });
  it("blank destination form has no response but still allows a common form response", () => {
    const f = fixture();
    f.form("photon");
    const gamma = f.s.player.inPlay.find((p) => p.code === "21002")!;
    f.s.flags[`blank:${gamma.id}`] = true;
    f.s.flags.genericFormResponse = true;
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21007" } as Piece)!);
    s = f.choose(s, s.villain.id);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["moxie", "continue"]);
    expect(spectrumStats(s, f.ports).attack).toBe(0);
  });
  it("loss ofControl blocks Gamma transition while its independent7damage still resolves", () => {
    const f = fixture();
    f.form("photon");
    f.put("21026");
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21007" } as Piece)!);
    s = f.choose(s, s.villain.id);
    expect(spectrumEnergyForm(s)).toBe("photon");
    expect(f.observed[0]).toMatchObject({ amount: 7, overkill: false });
    expect(s.prompt).toBeNull();
  });
  it("locked Speed ofLight still draws1 but has no transition or response", () => {
    const f = fixture();
    f.form("gamma");
    f.put("21026");
    const top = f.s.player.deck[0];
    const s = f.run(f.s, spectrumEvent(f.s, { code: "21010" } as Piece)!);
    expect(s.prompt).toBeNull();
    expect(s.player.hand[0].id).toBe(top.id);
    expect(spectrumEnergyForm(s)).toBe("gamma");
  });
  it("Blue Marvel is an optional Hero response with actual physical form targets", () => {
    const f = fixture();
    const gamma = f.form("gamma"),
      blue = f.put("21005");
    let s = f.run(f.s, spectrumAllyEntersPlay(f.s, blue, f.ports));
    expect(s.prompt?.title).toBe("Blue Marvel");
    s = f.choose(s, "yes");
    expect(s.prompt?.options).toHaveLength(2);
    expect(s.prompt?.options.some((o) => o.id === gamma.id)).toBe(false);
    s = f.skip(
      f.choose(s, s.player.inPlay.find((p) => p.code === "21003")!.id),
    );
    expect(spectrumEnergyForm(s)).toBe("photon");
    f.conserve(s);
  });
  it("Blue Marvel is unavailable in AE, when blank, or without legal form transitions", () => {
    const f = fixture(),
      blue = f.put("21005");
    expect(spectrumAllyEntersPlay(f.s, blue, f.ports)).toEqual([]);
    f.form("gamma");
    f.s.flags[`blank:${blue.id}`] = true;
    expect(spectrumAllyEntersPlay(f.s, blue, f.ports)).toEqual([]);
    delete f.s.flags[`blank:${blue.id}`];
    f.put("21026");
    expect(spectrumAllyEntersPlay(f.s, blue, f.ports)).toEqual([]);
  });
  it.each(["21007", "21008", "21009", "21010"])(
    "printed Hero event%s rejects alter-ego form",
    (code) => {
      const f = fixture();
      expect(spectrumPlayRestriction(f.s, { code } as Piece)).toMatch(
        /hero form/,
      );
    },
  );
});

describe("Spectrum Energy Duplication and Pulsar Shield", () => {
  it.each([
    ["gamma", "physical"],
    ["photon", "mental"],
    ["pulsar", "energy"],
  ] as const)(
    "Energy Duplication uses printed%s icon%s even if the faceup form text is blank",
    (form, resource) => {
      const f = fixture(),
        current = f.form(form),
        a = f.put("21006"),
        b = f.put("21006");
      f.s.flags[`blank:${current.id}`] = true;
      expect(spectrumResourceSources(f.s, f.ports)).toEqual([
        expect.objectContaining({ id: a.id, resources: [resource] }),
        expect.objectContaining({ id: b.id, resources: [resource] }),
      ]);
      expect(spectrumResourceSpent(f.s, a.id, f.ports)).toBe(true);
      expect(
        spectrumResourceSources(reload(f.s), f.ports).map((p) => p.id),
      ).toEqual([b.id]);
      expect(() => spectrumResourceSpent(f.s, a.id, f.ports)).toThrow(
        /ready source/,
      );
      f.conserve(f.s);
    },
  );
  it("Energy Duplication unavailable without faceup form, in AE or when its own text is blank", () => {
    const f = fixture(),
      dup = f.put("21006");
    expect(spectrumResourceSources(f.s, f.ports)).toEqual([]);
    f.s.player.form = "hero";
    expect(spectrumResourceSources(f.s, f.ports)).toEqual([]);
    f.form("gamma");
    f.s.flags[`blank:${dup.id}`] = true;
    expect(spectrumResourceSources(f.s, f.ports)).toEqual([]);
    expect(spectrumResourceSpent(f.s, "unrelated", f.ports)).toBe(false);
  });
  it("Pulsar Shield requires Spectrum actually defending, excluding undefended and allied defenses", () => {
    const f = fixture();
    f.form("gamma");
    f.hand("21009");
    expect(spectrumDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    f.defend();
    expect(spectrumDefenseOptions(f.s, [], [], f.ports)).toHaveLength(1);
    f.s.attack!.defender = "none";
    expect(spectrumDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    f.s.attack!.defender = f.put("21005").id;
    expect(spectrumDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
  });
  it("Pulsar Shield pays physical event then changes DEF before ready and offers heal1", () => {
    const f = fixture();
    f.form("gamma");
    f.s.player.hp = 9;
    const shield = f.hand("21009");
    f.defend();
    const [o] = spectrumDefenseOptions(f.s, [], [], f.ports);
    let s = f.run(f.s, o.effects);
    expect(s.prompt).toMatchObject({
      kind: "payment",
      title: "Pulsar Shield",
      cost: 1,
      card: { id: shield.id },
    });
    s = f.pay(s);
    expect(spectrumEnergyForm(s)).toBe("pulsar");
    expect(s.attack?.defense).toBe(3);
    expect(s.player.exhausted).toBe(false);
    expect(spectrumRetaliate(s)).toBe(0);
    const pulsar = s.player.inPlay.find((p) => p.code === "21004")!;
    s = f.choose(s, pulsar.id);
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.some((p) => p.id === shield.id)).toBe(true);
    f.conserve(s);
  });
  it("alreadyPulsar heals no new damage but stacks Retaliate1 perShield until phase end", () => {
    const f = fixture();
    f.form("pulsar");
    f.s.player.hp = 8;
    f.defend();
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21009" } as Piece)!);
    s = f.run(s, spectrumEvent(s, { code: "21009" } as Piece)!);
    expect(spectrumRetaliate(s)).toBe(2);
    expect(s.player.hp).toBe(8);
    expect(s.prompt).toBeNull();
    spectrumPhaseEnded(s);
    expect(spectrumRetaliate(s)).toBe(0);
  });
  it("Pulsar Shield defending a teammate uses the defender's form and physical card", () => {
    const f = fixture(true, "p2");
    f.form("gamma");
    const p = f.hand("21009");
    f.defend(f.s, "p2");
    f.s.attack!.originalPlayerId = "p1";
    expect(
      spectrumDefenseOptions(f.s, [], [], f.ports).map((o) => o.id),
    ).toEqual([p.id]);
    const s = f.skip(f.run(f.s, spectrumEvent(f.s, p)!));
    expect(spectrumEnergyForm(s)).toBe("pulsar");
    expect(seatView(s, "p1").heroId).toBe("rocket");
  });
  it("Loss ofControl does not prevent the independent ready, nor alreadyPulsar Retaliate", () => {
    const f = fixture();
    f.form("gamma");
    f.put("21026");
    f.defend();
    let s = f.run(f.s, spectrumEvent(f.s, { code: "21009" } as Piece)!);
    expect(s.player.exhausted).toBe(false);
    expect(spectrumEnergyForm(s)).toBe("gamma");
    expect(s.attack?.defense).toBe(1);
    f.form("pulsar", s);
    f.defend(s);
    s = f.run(s, spectrumEvent(s, { code: "21009" } as Piece)!);
    expect(spectrumRetaliate(s)).toBe(1);
  });
  it("stale/unpayable/used Shield choices cannot pay or resolve a second event", () => {
    const f = fixture();
    f.form("gamma");
    const p = f.hand("21009");
    f.defend();
    expect(spectrumDefenseOptions(f.s, [p.id], [], f.ports)).toEqual([]);
    f.s.flags.paymentLocked = true;
    expect(spectrumDefenseOptions(f.s, [], [], f.ports)).toEqual([]);
    expect(() => f.run(f.s, [S("shield-pay", { id: p.id })])).toThrow(
      /payable event/,
    );
  });
});

describe("Spectrum obligation and physical nemesis effects", () => {
  it("Loss ofControl moves actual reveal to its Spectrum owner with no offered free flip", () => {
    const f = fixture(true, "p2"),
      p = f.piece("21026");
    f.s.resolving.push(p);
    f.form("gamma");
    const s = f.run(f.s, spectrumEncounterReveal(f.s, p)!);
    expect(s.prompt).toBeNull();
    expect(s.player.inPlay.filter((c) => c.id === p.id)).toHaveLength(1);
    expect(s.resolving.some((c) => c.id === p.id)).toBe(false);
    expect(spectrumCanChangeEnergyForm(s, f.ports)).toBe(false);
    expect(seatView(s, "p1").player.inPlay.some((c) => c.id === p.id)).toBe(
      false,
    );
  });
  it("Loss ofControl permits PowerDown and Hero flip while blocking its energy selection", () => {
    const f = fixture();
    f.form("gamma");
    f.put("21026");
    f.s.player.form = "alter";
    spectrumChangedForm(f.s, f.ports);
    expect(f.s.flags.spectrumEnergyFormId).toBeUndefined();
    f.s.player.form = "hero";
    const s = f.run(f.s, spectrumChangedForm(f.s, f.ports));
    expect(s.prompt).toBeNull();
    expect(spectrumEnergyForm(s)).toBeUndefined();
  });
  it("obligationAE action exhausts actual Monica and removes exact encounter source", () => {
    const f = fixture(),
      p = f.put("21026");
    let s = f.run(f.s, spectrumAbility(f.s, p.id, "remove", f.ports)!);
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((c) => c.id === p.id)).toHaveLength(1);
    expect(s.player.inPlay.some((c) => c.id === p.id)).toBe(false);
    expect(s.encounter.discard.some((c) => c.id === p.id)).toBe(false);
  });
  it("obligationAE action unavailable to Hero, exhausted identity, blank source or teammate", () => {
    const f = fixture(true),
      p = f.put("21026");
    f.form("gamma");
    expect(spectrumObligationOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.form = "alter";
    f.s.player.exhausted = true;
    expect(spectrumObligationOptions(f.s, p.id, f.ports)).toEqual([]);
    f.s.player.exhausted = false;
    f.s.flags[`blank:${p.id}`] = true;
    expect(spectrumCanChangeEnergyForm(f.s, f.ports)).toBe(true);
    expect(spectrumObligationOptions(f.s, p.id, f.ports)).toEqual([]);
    expect(
      spectrumObligationOptions(seatView(f.s, "p2"), p.id, f.ports),
    ).toEqual([]);
  });
  it("Sap Power attaches actual reveal, has printed twoenergy AE cost, and only attached owner can pay", () => {
    const f = fixture(true),
      p = f.piece("21029");
    f.s.resolving.push(p);
    let s = f.run(f.s, spectrumEncounterReveal(f.s, p)!);
    expect(s.attachments[0]).toMatchObject({ id: p.id, attachedTo: "hero:p1" });
    expect(spectrumAttachmentOptions(seatView(s, "p2"), p.id, f.ports)).toEqual(
      [],
    );
    s = f.run(s, spectrumAbility(s, p.id, "discard", f.ports)!);
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 2,
      requirements: ["energy", "energy"],
    });
    s = f.pay(s);
    expect(s.attachments.some((c) => c.id === p.id)).toBe(false);
    expect(s.encounter.discard.some((c) => c.id === p.id)).toBe(true);
  });
  it("twoSap copies create separate take1 packets only when their attached player's own turn ends", () => {
    const f = fixture(true),
      a = f.piece("21029"),
      b = f.piece("21029"),
      c = f.piece("21029", "p2");
    a.attachedTo = b.attachedTo = "hero:p1";
    c.attachedTo = "hero:p2";
    f.s.attachments.push(a, b, c);
    expect(spectrumTurnEnded(f.s, "p1", f.ports)).toEqual([
      expect.objectContaining({
        amount: 1,
        target: "hero:p1",
        source: a.id,
        actorId: "p1",
      }),
      expect.objectContaining({
        amount: 1,
        target: "hero:p1",
        source: b.id,
        actorId: "p1",
      }),
    ]);
    expect(spectrumTurnEnded(f.s, "p2", f.ports)).toHaveLength(1);
    f.s.flags[`blank:${a.id}`] = true;
    expect(spectrumTurnEnded(f.s, "p1", f.ports)).toHaveLength(1);
  });
  it("Radioactive Man activation damages every controlled character of its attacked seat only", () => {
    const f = fixture(true),
      a = f.put("21005"),
      b = f.put("01067", f.s, "p2"),
      radio = f.piece("21027");
    f.s.minions.push(radio);
    f.s.player.tough = true;
    const s = f.run(f.s, spectrumEnemyActivated(f.s, radio, "p1", f.ports));
    expect(f.observed[0]).toMatchObject({
      type: "damageBatch",
      ids: ["hero:p1", a.id],
      amount: 1,
    });
    expect(s.player.hp).toBe(11);
    expect(s.player.tough).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === a.id)?.damage).toBe(1);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === b.id)?.damage,
    ).toBe(0);
  });
  it("blank Radioactive Man has no activation response; boost star uses current defending seat", () => {
    const f = fixture(true),
      p = f.piece("21027");
    f.s.flags[`blank:${p.id}`] = true;
    expect(spectrumEnemyActivated(f.s, p, "p2", f.ports)).toEqual([]);
    f.defend();
    f.s.attack!.originalPlayerId = "p1";
    f.s.attack!.targetPlayerId = "p2";
    const s = f.run(f.s, spectrumBoost(f.s, p)!);
    expect(f.observed[0]).toMatchObject({ ids: ["hero:p2"] });
    expect(s.player.hp).toBe(11);
    expect(seatView(s, "p2").player.hp).toBe(9);
  });
  it("Reactor Meltdown defeats into one simultaneous allfriendly nonattack batch", () => {
    const f = fixture(true),
      a = f.put("21005"),
      b = f.put("01067", f.s, "p2"),
      scheme = f.piece("21028");
    const s = f.run(f.s, spectrumSideSchemeDefeated(f.s, scheme, f.ports));
    expect(f.ports.damageBatch).toHaveBeenCalledTimes(1);
    expect(f.observed[0]).toMatchObject({
      ids: ["hero:p1", a.id, "hero:p2", b.id],
      amount: 1,
    });
    expect(s.player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(9);
  });
  it("blank Reactor has no defeat ability and eliminated seats are absent from friendly batch", () => {
    const f = fixture(true),
      p = f.piece("21028");
    f.s.flags[`blank:${p.id}`] = true;
    expect(spectrumSideSchemeDefeated(f.s, p, f.ports)).toEqual([]);
    delete f.s.flags[`blank:${p.id}`];
    f.s.players[1].eliminated = true;
    f.run(f.s, spectrumSideSchemeDefeated(f.s, p, f.ports));
    expect(f.observed[0]).toMatchObject({ ids: ["hero:p1"] });
  });
  it.each(["hero", "alter"] as const)(
    "Radioactive Blast resolves its printed%s branch",
    (form) => {
      const f = fixture();
      f.s.player.form = form;
      expect(spectrumEncounterReveal(f.s, f.piece("21030"))).toEqual([
        form === "hero"
          ? expect.objectContaining({
              type: "damage",
              amount: 2,
              target: "hero",
            })
          : { type: "threat", target: "main", amount: 2 },
      ]);
    },
  );
  it("unrelated handlers return null/false and original nemesis printed quantities remain1/1/2/1", () => {
    const f = fixture();
    expect(spectrumEvent(f.s, f.piece("01088"))).toBeNull();
    expect(spectrumEncounterReveal(f.s, f.piece("01102"))).toBeNull();
    expect(spectrumBoost(f.s, f.piece("21028"))).toBeNull();
    expect(resolveSpectrumEffect(f.s, { type: "draw" }, f.ports)).toBe(false);
    expect(
      ["21027", "21028", "21029", "21030"].map(
        (code) => cards.get(code)!.quantity,
      ),
    ).toEqual([1, 1, 2, 1]);
  });
});
