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
  GAMORA_SCRIPT_CODES,
  gamoraAbility,
  gamoraAbilityOptions,
  gamoraAfterEvent,
  gamoraAllyEnter,
  gamoraAttachmentActions,
  gamoraBoost,
  gamoraCanRemoveThreat,
  gamoraCardPlayed,
  gamoraDamageOptions,
  gamoraEncounterReveal,
  gamoraEvent,
  gamoraIdentityBlank,
  gamoraKeenInstinctsEligible,
  gamoraMinionWillEnter,
  gamoraPhaseEnded,
  gamoraPlayRestriction,
  gamoraReplaceMultiLabel,
  gamoraTurnEnded,
  gamoraVillainPhaseBegin,
  resolveGamoraEffect,
  type GamoraPorts,
} from "../src/game/gamora.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const G = (type: string, patch: Record<string, unknown> = {}): Effect => ({
  type: `gamora:${type}`,
  ...patch,
});
let next = 0;
const piece = (code: string, patch: Partial<Piece> = {}): Piece => ({
  id: `gamora${++next}`,
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
});
function fixture() {
  let s: GameState = {
    version: 1,
    seed: 18,
    nextId: 1,
    heroId: "gam",
    aspect: "aggression",
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
      heroId: "gam",
      aspect: "aggression",
      player: s.player,
      flags: s.flags,
      ended: false,
      eliminated: false,
      mulliganDone: true,
    },
  ];
  const native: Effect[] = [];
  const find = (id: string) =>
    id === "hero"
      ? s.player
      : id.startsWith("hero:")
        ? seatView(s, id.slice(5)).player
        : s.minions.find((p) => p.id === id) ||
          (id === s.villain.id ? s.villain : undefined);
  const ports: GamoraPorts = {
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
          effects: [],
          image: p.code,
        })),
      };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: vi.fn((state, counts, target) => {
      state.player.form = target === "alter" ? "alter" : "hero";
      if (counts) state.player.flipped = true;
    }),
    canReadyIdentity: () => true,
    canPay: (state) => !state.flags.cannotPay,
    canGiveStatus: () => true,
    enemyTargets: (state, attack) => [
      ...(!attack || !state.minions.some((p) => p.code === "01101")
        ? [{ id: state.villain.id, label: "Rhino", code: state.villain.code }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state, thwart) => [
      ...(state.scheme.threat > 0 && (!thwart || !state.flags.patrol)
        ? [{ id: "main", label: "The Break-In!", code: state.scheme.code }]
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
    discardHand: vi.fn((state: GameState, id: string) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i >= 0) state.player.discard.push(...state.player.hand.splice(i, 1));
    }),
    discardPiece: vi.fn((state: GameState, id: string) => {
      for (const seat of state.players) {
        const p = seat.id === state.activePlayerId ? state.player : seat.player;
        const i = p.inPlay.findIndex((p) => p.id === id);
        if (i >= 0) p.discard.push(...p.inPlay.splice(i, 1));
      }
      const i = state.attachments.findIndex((p) => p.id === id);
      if (i >= 0)
        state.encounter.discard.push(...state.attachments.splice(i, 1));
    }),
    revealHidden: vi.fn(),
    recycleEncounter: vi.fn(),
    log: vi.fn(),
    attackProgram: vi.fn((state, effects, after) =>
      ports.queue(state, ...effects, ...after),
    ),
    shufflePlayerDeck: vi.fn((state) => {
      state.player.deck.reverse();
    }),
    cardCost: (_state, p) => cards.get(p.code)?.cost || 0,
    heroMaxHP: (state) => Number(state.flags.maxHP || 10),
    preventDamage: vi.fn((state, packet, amount) => {
      if (packet?.kind === "attack" && state.attack)
        state.attack.prevented += amount;
      else state.flags.prevented = Number(state.flags.prevented || 0) + amount;
    }),
    claimDefense: vi.fn((state, packet) => {
      if (packet?.kind === "attack" && state.attack) {
        state.attack.defender = "hero";
        state.attack.heroDefended = true;
      }
    }),
  };
  function run() {
    for (let i = 0; s.queue.length && !s.prompt; i++) {
      if (i > 100) throw Error("Unexpected effect loop");
      const e = s.queue.shift()!;
      if (e.actorId && e.actorId !== s.activePlayerId)
        activateSeat(s, e.actorId);
      if (resolveGamoraEffect(s, e, ports)) continue;
      native.push(e);
      if (e.type === "draw")
        s.player.hand.push(...s.player.deck.splice(0, e.amount));
      if (e.type === "heal")
        s.player.hp = Math.min(ports.heroMaxHP(s), s.player.hp + e.amount);
      if (e.type === "thwart") {
        if (e.target === "main")
          s.scheme.threat = Math.max(0, s.scheme.threat - e.amount);
        else {
          const p = s.sideSchemes.find((p) => p.id === e.target);
          if (p) {
            p.counters -= e.amount;
            if (p.counters <= 0)
              s.sideSchemes.splice(s.sideSchemes.indexOf(p), 1);
          }
        }
      }
      if (e.type === "damage") {
        const p = find(e.target);
        if (p && e.amount > 0) {
          if (p.tough) p.tough = false;
          else if (e.target === "hero" || e.target.startsWith("hero:"))
            (p as GameState["player"]).hp -= e.amount;
          else if (p === s.villain) s.villain.hp -= e.amount;
          else (p as Piece).damage += e.amount;
        }
      }
      if (e.type === "status") {
        const p = find(e.target);
        if (p) p[e.status as "stunned"] = true;
      }
      if (e.type === "optional")
        s.prompt = {
          kind: "choice",
          title: e.title,
          text: e.text,
          options: [
            { id: "yes", label: "Yes", effects: e.effects },
            { id: "continue", label: "Continue", effects: [] },
          ],
        };
      if (e.type === "payRequest") {
        s.prompt = {
          kind: "payment",
          title: e.title,
          text: "Pay",
          options: [],
          cost: e.cost,
          card: e.piece,
          after: e.after,
          cancelable: e.cancelable,
        };
      }
      if (e.type === "resolveHandEvent") {
        const index = s.player.hand.findIndex((p) => p.id === e.id);
        const [p] = s.player.hand.splice(index, 1);
        s.resolving.push(p);
        gamoraCardPlayed(s, cards.get(p.code)!);
        ports.queue(
          s,
          ...e.after,
          { type: "finishResolution", id: p.id },
          ...(e.continuation || []),
        );
      }
      if (e.type === "finishResolution") {
        const i = s.resolving.findIndex((p) => p.id === e.id);
        if (i >= 0) {
          const [p] = s.resolving.splice(i, 1);
          s.player.discard.push(p);
          ports.queue(s, ...gamoraAfterEvent(s, p, [], ports));
        }
      }
      if (e.type === "removeEncounter") {
        s.resolving = s.resolving.filter((p) => p.id !== e.piece.id);
        s.encounter.discard = s.encounter.discard.filter(
          (p) => p.id !== e.piece.id,
        );
        if (!s.removed.some((p) => p.id === e.piece.id))
          s.removed.push(e.piece);
      }
    }
    syncSeat(s);
  }
  const start = (effects: Effect[]) => {
    ports.queue(s, ...effects);
    run();
  };
  function choose(id: string) {
    const o = s.prompt?.options.find((p) => p.id === id);
    if (!o) throw Error(`Missing option ${id} (${s.prompt?.title})`);
    s.prompt = null;
    start(o.effects);
  }
  function select(ids: string[]) {
    const action = s.prompt?.selectAction;
    if (!action) throw Error("No selection");
    s.prompt = null;
    start([{ ...action, ids }]);
  }
  function pay() {
    const after = s.prompt?.after || [];
    s.prompt = null;
    start(after);
  }
  const reload = () => {
    s = upgradeSave(JSON.parse(JSON.stringify(s)));
  };
  return {
    get s() {
      return s;
    },
    ports,
    native,
    start,
    run,
    choose,
    select,
    pay,
    reload,
  };
}

describe("Gamora identity and signature rules", () => {
  it("pins exactly sixteen imported identity/signature/encounter faces", () => {
    expect(GAMORA_SCRIPT_CODES).toHaveLength(16);
    expect(new Set(GAMORA_SCRIPT_CODES).size).toBe(16);
    expect(GAMORA_SCRIPT_CODES.every((code) => cards.has(code))).toBe(true);
    expect(GAMORA_SCRIPT_CODES).not.toContain("18011");
    expect(cards.get("18001a")).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      health: 10,
      hand_size: 5,
    });
    expect(cards.get("18001b")).toMatchObject({ recover: 3, hand_size: 6 });
    expect(
      [...GAMORA_SCRIPT_CODES]
        .filter(
          (code) =>
            cards.get(code)?.faction_code === "hero" &&
            cards.get(code)?.type_code !== "hero" &&
            cards.get(code)?.type_code !== "alter_ego",
        )
        .reduce((n, code) => n + Number(cards.get(code)?.quantity || 0), 0),
    ).toBe(15);
  });
  it.each(["18003", "18005", "18004"])(
    "draws the actual tactical top card %s and persists its round limit",
    (code) => {
      const f = fixture();
      f.s.player.form = "alter";
      const top = piece(code);
      f.s.player.deck = [top, piece("01088")];
      f.start(gamoraAbility(f.s, "hero", "skilled-tactician", f.ports)!);
      expect(f.s.player.hand[0].id).toBe(top.id);
      expect(f.s.player.deck).toHaveLength(1);
      f.reload();
      expect(gamoraAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    },
  );
  it.each(["01088", "18008", "18009"])(
    "looks at non-event %s without moving or replacing it",
    (code) => {
      const f = fixture();
      f.s.player.form = "alter";
      const top = piece(code);
      f.s.player.deck = [top];
      f.start(gamoraAbility(f.s, "hero", undefined, f.ports)!);
      expect(f.s.player.deck[0].id).toBe(top.id);
      expect(f.s.player.hand).toEqual([]);
      expect(f.s.flags.gamoraTacticianRound).toBe(1);
      expect(f.ports.log).toHaveBeenCalledWith(
        f.s,
        expect.stringContaining(cards.get(code)!.name),
      );
    },
  );
  it("cannot look at an empty deck or use the alter-ego Action in hero form", () => {
    const f = fixture();
    expect(gamoraAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
    f.s.player.form = "alter";
    expect(gamoraAbilityOptions(f.s, "hero", f.ports)).toEqual([]);
  });
  it("Conditioning Room selects the actual bottommost matching event, preserves other cards, and heals", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.s.player.hp = 7;
    const room = piece("18008"),
      first = piece("18005"),
      later = piece("18003");
    f.s.player.inPlay = [room];
    f.s.player.discard = [piece("01088"), first, piece("18009"), later];
    f.start(gamoraAbility(f.s, room.id, "conditioning-room", f.ports)!);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([first.id]);
    expect(f.s.player.discard.some((p) => p.id === later.id)).toBe(true);
    expect(f.s.player.hp).toBe(8);
    expect(room.exhausted).toBe(true);
  });
  it("Conditioning Room heals modified maximum HP even with no discarded event", () => {
    const f = fixture();
    f.s.player.form = "alter";
    f.s.flags.maxHP = 13;
    const room = piece("18008");
    f.s.player.inPlay = [room];
    f.start(gamoraAbility(f.s, room.id, undefined, f.ports)!);
    expect(f.s.player.hp).toBe(11);
  });
  it("does not offer a useless, exhausted or text-blank Conditioning Room", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const room = piece("18008");
    f.s.player.inPlay = [room];
    expect(gamoraAbilityOptions(f.s, room.id, f.ports)).toEqual([]);
    f.s.player.hp = 9;
    room.exhausted = true;
    expect(gamoraAbilityOptions(f.s, room.id, f.ports)).toEqual([]);
    room.exhausted = false;
    f.s.flags[`blank:${room.id}`] = true;
    expect(gamoraAbilityOptions(f.s, room.id, f.ports)).toEqual([]);
  });
  it.each(["18003", "18005", "18004", "18020", "18031"])(
    "Keen Instincts can pay an Attack/Thwart event %s",
    (code) => {
      expect(gamoraKeenInstinctsEligible(fixture().s, code)).toBe(true);
    },
  );
  it.each(["18008", "18009", "01088", "18013", undefined])(
    "Keen Instincts cannot pay a non-tactical-event %s",
    (code) => {
      expect(gamoraKeenInstinctsEligible(fixture().s, code)).toBe(false);
    },
  );
  it("Nebula's optional search chooses a physical copy, preserves its duplicate and shuffles", () => {
    const f = fixture();
    const nebula = piece("18002"),
      first = piece("18003"),
      other = piece("18003");
    f.s.player.inPlay = [nebula];
    f.s.player.deck = [piece("01088"), first, other];
    f.start(gamoraAllyEnter(f.s, nebula, f.ports)!);
    f.choose("yes");
    f.reload();
    f.choose(first.id);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([first.id]);
    expect(f.s.player.deck.some((p) => p.id === other.id)).toBe(true);
    expect(f.ports.shufflePlayerDeck).toHaveBeenCalledTimes(1);
  });
  it("Nebula may find no card but still shuffles", () => {
    const f = fixture();
    f.s.player.deck = [piece("18003")];
    f.start([G("nebula")]);
    f.choose("none");
    expect(f.s.player.hand).toEqual([]);
    expect(f.ports.shufflePlayerDeck).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    "searches/shuffles even when no tactical event exists, blank=%s",
    (blank) => {
      const f = fixture();
      const ally = piece("18002");
      f.s.flags[`blank:${ally.id}`] = blank;
      f.s.player.deck = [piece("01088")];
      if (blank) expect(gamoraAllyEnter(f.s, ally, f.ports)).toBeNull();
      else {
        f.start([G("nebula")]);
        expect(f.ports.shufflePlayerDeck).toHaveBeenCalledTimes(1);
      }
    },
  );
  it.each([false, true])(
    "Decisive Blow uses played Thwart event history, previous=%s",
    (previous) => {
      const f = fixture();
      if (previous) gamoraCardPlayed(f.s, cards.get("18005")!);
      gamoraCardPlayed(f.s, cards.get("18006")!);
      f.start(gamoraEvent(f.s, piece("18006"))!);
      expect(f.s.villain.hp).toBe(previous ? 7 : 10);
    },
  );
  it.each([false, true])(
    "Forward Momentum uses played Attack event history, previous=%s",
    (previous) => {
      const f = fixture();
      f.s.scheme.threat = 9;
      if (previous) gamoraCardPlayed(f.s, cards.get("18003")!);
      gamoraCardPlayed(f.s, cards.get("18007")!);
      f.start(gamoraEvent(f.s, piece("18007"))!);
      expect(f.s.scheme.threat).toBe(previous ? 4 : 6);
    },
  );
  it("Acrobatic Move and Set the Pace execute their printed values", () => {
    const f = fixture();
    f.start(gamoraEvent(f.s, piece("18003"))!);
    f.start(gamoraEvent(f.s, piece("18005"))!);
    expect(f.s.villain.hp).toBe(12);
    expect(f.s.scheme.threat).toBe(4);
  });
  it("a Stun-replaced event still establishes history, but no damage is dealt", () => {
    const f = fixture();
    f.s.player.stunned = true;
    gamoraCardPlayed(f.s, cards.get("18003")!);
    f.start(gamoraEvent(f.s, piece("18003"))!);
    expect(f.s.player.stunned).toBe(false);
    expect(f.s.villain.hp).toBe(14);
    f.start(gamoraEvent(f.s, piece("18007"))!);
    expect(f.s.scheme.threat).toBe(0);
  });
  it("history belongs to the current player's turn, not merely the phase", () => {
    const f = fixture();
    gamoraCardPlayed(f.s, cards.get("18005")!);
    f.s.turnPlayerId = "p2";
    f.start(gamoraEvent(f.s, piece("18006"))!);
    expect(f.s.villain.hp).toBe(10);
  });
  it("turn/phase cleanup expires temporary records for all actual seats", () => {
    const f = fixture();
    gamoraCardPlayed(f.s, cards.get("18020")!);
    gamoraTurnEnded(f.s);
    expect(f.s.flags.gamoraAttackEventTurn).toBeUndefined();
    expect(f.s.flags.gamoraThwartEventTurn).toBeUndefined();
    f.s.flags.gamoraFinessePhase = "1:player";
    f.s.flags.gamoraPrecisionPhase = "1:player";
    gamoraPhaseEnded(f.s);
    expect(f.s.flags.gamoraFinessePhase).toBeUndefined();
    expect(f.s.flags.gamoraPrecisionPhase).toBeUndefined();
  });
});

describe("Gamora event responses and damage interrupts", () => {
  it("Finesse and Precision independently resolve once per phase and in either order", () => {
    const f = fixture();
    const event = piece("18020");
    f.start(gamoraAfterEvent(f.s, event, [], f.ports));
    f.choose("precision");
    expect(f.s.villain.hp).toBe(13);
    f.reload();
    f.choose("finesse");
    expect(f.s.scheme.threat).toBe(4);
    expect(f.s.prompt).toBeNull();
    expect(gamoraAfterEvent(f.s, event, [], f.ports)).toEqual([]);
    f.s.phase = "villain";
    expect(gamoraAfterEvent(f.s, event, [], f.ports)).toHaveLength(1);
  });
  it("declining responses leaves both independent phase limits available", () => {
    const f = fixture();
    const event = piece("18020");
    f.start(gamoraAfterEvent(f.s, event, [], f.ports));
    f.choose("continue");
    expect(f.s.flags.gamoraFinessePhase).toBeUndefined();
    expect(f.s.flags.gamoraPrecisionPhase).toBeUndefined();
    expect(gamoraAfterEvent(f.s, event, [], f.ports)).toHaveLength(1);
  });
  it("Sword responds to every Attack event without exhausting or consuming identity limits", () => {
    const f = fixture();
    const sword = piece("18010");
    f.s.player.inPlay = [sword];
    for (let i = 0; i < 2; i++) {
      f.start(gamoraAfterEvent(f.s, piece("18003"), [], f.ports));
      f.choose(sword.id);
      if (f.s.prompt) f.choose("continue");
    }
    expect(f.s.villain.hp).toBe(12);
    expect(sword.exhausted).toBe(false);
    expect(f.s.flags.gamoraFinessePhase).toBeUndefined();
  });
  it("Sword uses a separate source, while identity response damage is not an attack", () => {
    const f = fixture();
    const sword = piece("18010");
    f.s.player.inPlay = [sword];
    f.start(gamoraAfterEvent(f.s, piece("18020"), [], f.ports));
    f.choose(sword.id);
    f.choose("precision");
    f.choose("continue");
    expect(f.native.filter((e) => e.type === "damage")).toEqual([
      expect.objectContaining({ source: sword.id, attack: false }),
      expect.objectContaining({ source: "hero", attack: false }),
    ]);
  });
  it("responses work after the actual played event returned to hand", () => {
    const f = fixture();
    const clobber = piece("18012");
    f.s.player.hand = [clobber];
    f.start(gamoraAfterEvent(f.s, clobber, [], f.ports));
    f.choose("finesse");
    expect(f.s.player.hand[0].id).toBe(clobber.id);
    expect(f.s.scheme.threat).toBe(4);
  });
  it("Finesse bypasses Patrol and Confuse; Precision bypasses Guard and Stun", () => {
    const f = fixture();
    f.s.flags.patrol = true;
    f.s.player.confused = true;
    f.s.player.stunned = true;
    f.s.minions = [piece("01101")];
    f.start(gamoraAfterEvent(f.s, piece("18020"), [], f.ports));
    f.choose("finesse");
    expect(f.s.scheme.threat).toBe(4);
    f.choose("precision");
    f.choose(f.s.villain.id);
    expect(f.s.villain.hp).toBe(13);
    expect(f.s.player.stunned).toBe(true);
    expect(f.s.player.confused).toBe(true);
  });
  it("Finesse cannot bypass Crisis and can defeat Crisis to refresh its remaining responses", () => {
    const f = fixture();
    const crisis = piece("01108", { counters: 1 });
    f.s.sideSchemes = [crisis];
    f.start(gamoraAfterEvent(f.s, piece("18020"), [], f.ports));
    f.choose("finesse");
    expect(f.s.scheme.threat).toBe(5);
    expect(f.s.sideSchemes).toEqual([]);
    f.choose("precision");
    expect(f.s.villain.hp).toBe(13);
  });
  it("a text-blank identity retains Sword responses and printed traits", () => {
    const f = fixture();
    const sword = piece("18010");
    f.s.player.inPlay = [sword];
    f.s.attachments = [piece("18027", { attachedTo: "hero:p1" })];
    expect(gamoraIdentityBlank(f.s)).toBe(true);
    f.start(gamoraAfterEvent(f.s, piece("18020"), [], f.ports));
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
      sword.id,
      "continue",
    ]);
    f.choose(sword.id);
    expect(f.s.villain.hp).toBe(13);
    expect(cards.get("18001a")?.traits).toBe("Guardian.");
  });
  it("an attachment on another identity never blanks Gamora", () => {
    const f = fixture();
    f.s.attachments = [piece("18027", { attachedTo: "hero:p2" })];
    expect(gamoraIdentityBlank(f.s)).toBe(false);
  });
  it("Crosscounter pays with the physical card, prevents before enemy damage, then attacks/thwarts before responses", () => {
    const f = fixture();
    const cross = piece("18004");
    f.s.player.hand = [cross];
    const packet = {
      type: "damage",
      target: "hero",
      amount: 4,
      source: "enemy",
    };
    f.start(
      gamoraDamageOptions(f.s, packet, 4, [{ type: "resume" }], f.ports)[0]
        .effects,
    );
    expect(f.s.prompt).toMatchObject({
      kind: "payment",
      title: "Crosscounter",
      cost: 1,
      cancelable: false,
    });
    f.reload();
    f.pay();
    expect(f.s.flags.prevented).toBe(3);
    expect(f.s.villain.hp).toBe(13);
    expect(f.s.scheme.threat).toBe(4);
    expect(f.s.player.discard[0].id).toBe(cross.id);
    expect(f.s.prompt?.title).toBe("Gamora · after playing an event");
    f.choose("precision");
    f.choose("finesse");
    expect(f.native.at(-1)?.type).toBe("resume");
    expect(f.s.scheme.threat).toBe(3);
    expect(f.s.villain.hp).toBe(12);
  });
  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])(
    "Crosscounter wholly cancels for statuses stunned=%s confused=%s while keeping after-play responses",
    (stunned, confused) => {
      const f = fixture();
      const cross = piece("18004");
      f.s.player.hand = [cross];
      f.s.player.stunned = stunned;
      f.s.player.confused = confused;
      f.start(
        gamoraDamageOptions(
          f.s,
          { type: "damage", target: "hero" },
          2,
          [],
          f.ports,
        )[0].effects,
      );
      f.pay();
      expect(f.s.player.stunned).toBe(false);
      expect(f.s.player.confused).toBe(false);
      expect(f.ports.preventDamage).not.toHaveBeenCalled();
      expect(f.ports.claimDefense).not.toHaveBeenCalled();
      expect(f.s.villain.hp).toBe(14);
      expect(f.s.scheme.threat).toBe(5);
      expect(f.s.prompt?.options.map((o) => o.id)).toEqual([
        "finesse",
        "precision",
        "continue",
      ]);
    },
  );
  it("multi-label replacement removes only statuses that match its labels", () => {
    const f = fixture();
    f.s.player.stunned = f.s.player.confused = true;
    expect(gamoraReplaceMultiLabel(f.s, ["attack"])).toBe(true);
    expect(f.s.player.stunned).toBe(false);
    expect(f.s.player.confused).toBe(true);
    expect(gamoraReplaceMultiLabel(f.s, ["attack"])).toBe(false);
  });
  it.each(["hero:p2", "some-ally"])(
    "Crosscounter cannot prevent somebody else's damage to %s",
    (target) => {
      const f = fixture();
      f.s.player.hand = [piece("18004")];
      expect(
        gamoraDamageOptions(f.s, { type: "damage", target }, 2, [], f.ports),
      ).toEqual([]);
    },
  );
  it("Crosscounter requires a payable cost, positive actual damage and hero form, after Tough", () => {
    const f = fixture();
    f.s.player.hand = [piece("18004")];
    f.s.player.tough = true;
    expect(gamoraDamageOptions(f.s, undefined, 2, [], f.ports)).toEqual([]);
    f.s.player.tough = false;
    expect(gamoraDamageOptions(f.s, undefined, 0, [], f.ports)).toEqual([]);
    f.s.flags.cannotPay = true;
    expect(gamoraDamageOptions(f.s, undefined, 2, [], f.ports)).toEqual([]);
    f.s.flags.cannotPay = false;
    f.s.player.form = "alter";
    expect(gamoraDamageOptions(f.s, undefined, 2, [], f.ports)).toEqual([]);
  });
  it("does not expose Crosscounter as an ordinary hero-phase action", () => {
    const f = fixture();
    expect(gamoraPlayRestriction(f.s, piece("18004"), f.ports)).toContain(
      "interrupt",
    );
    expect(gamoraEvent(f.s, piece("18004"))).toBeNull();
  });
  it("rejects ordinary thwarts with no legal target but permits Confuse replacement", () => {
    const f = fixture();
    f.s.scheme.threat = 0;
    expect(gamoraPlayRestriction(f.s, piece("18005"), f.ports)).toContain(
      "legal scheme",
    );
    f.s.player.confused = true;
    expect(gamoraPlayRestriction(f.s, piece("18005"), f.ports)).toBeNull();
  });
});

describe("Gamora obligation and nemesis", () => {
  it("routes obligation to the actual Gamora seat and persists the optional flip", () => {
    const f = fixture();
    const obligation = piece("18024");
    f.start(gamoraEncounterReveal(f.s, obligation)!);
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["flip", "stay"]);
    f.reload();
    f.choose("flip");
    expect(f.s.player.form).toBe("alter");
    expect(f.s.player.flipped).toBe(false);
    f.choose("remove");
    expect(f.s.player.exhausted).toBe(true);
    expect(f.s.removed.map((p) => p.id)).toEqual([obligation.id]);
  });
  it("chooses and discards two distinct physical events, excluding resources and other cards", () => {
    const f = fixture();
    const first = piece("18003"),
      second = piece("18005"),
      resource = piece("01088");
    f.s.player.hand = [first, second, resource];
    f.start(gamoraEncounterReveal(f.s, piece("18024"))!);
    f.choose("stay");
    f.choose("events");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual([first.id, second.id]);
    f.reload();
    f.select([first.id, second.id]);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([resource.id]);
    expect(f.s.player.discard.map((p) => p.id)).toEqual([first.id, second.id]);
  });
  it("discards as many event targets as available when only one exists", () => {
    const f = fixture();
    f.s.flags.formLocked = true;
    const event = piece("18003");
    f.s.player.hand = [event];
    f.start(gamoraEncounterReveal(f.s, piece("18024"))!);
    f.choose("events");
    expect(f.s.prompt?.min).toBe(1);
    f.select([event.id]);
    expect(f.s.player.discard[0].id).toBe(event.id);
  });
  it("a targetless forced obligation does not deadlock a locked/exhausted identity", () => {
    const f = fixture();
    f.s.flags.formLocked = true;
    f.s.player.exhausted = true;
    f.start(gamoraEncounterReveal(f.s, piece("18024"))!);
    expect(f.s.prompt).toBeNull();
    expect(f.s.queue).toEqual([]);
  });
  it("rejects stale/duplicate event selection before paying any card", () => {
    const f = fixture();
    const event = piece("18003"),
      other = piece("18005");
    f.s.player.hand = [event, other];
    expect(() =>
      f.start([G("obligation-discard", { ids: [event.id, event.id] })]),
    ).toThrow("distinct");
    expect(f.s.player.hand).toHaveLength(2);
  });
  it("only the Gamora player can remove threat from Sibling Rivalry", () => {
    const f = fixture();
    const side = piece("18025", { counters: 4 });
    f.s.sideSchemes = [side];
    expect(gamoraCanRemoveThreat(f.s, side.id)).toBe(true);
    f.s.heroId = "groot";
    expect(gamoraCanRemoveThreat(f.s, side.id)).toBe(false);
    expect(gamoraCanRemoveThreat(f.s, "main")).toBe(true);
  });
  it("Sibling Rivalry deals a facedown card to Gamora rather than the active teammate", () => {
    const f = fixture();
    const hero = player();
    f.s.players.push({
      id: "p2",
      heroId: "groot",
      aspect: "protection",
      player: hero,
      flags: {},
      ended: false,
      eliminated: false,
      mulliganDone: true,
    });
    f.s.playerCount = 2;
    f.s.sideSchemes = [piece("18025", { counters: 4 })];
    activateSeat(f.s, "p2");
    expect(gamoraVillainPhaseBegin(f.s, f.ports)).toEqual([
      { type: "dealEncounter", playerId: "p1" },
    ]);
  });
  it("Nebula minion discards every actual Nebula ally before any entrance", () => {
    const f = fixture();
    const nebula = piece("18002");
    f.s.player.inPlay = [nebula];
    gamoraMinionWillEnter(f.s, piece("18026"), f.ports);
    expect(f.s.player.inPlay).toEqual([]);
    expect(f.s.player.discard[0].id).toBe(nebula.id);
  });
  it("In a Bind attaches to Gamora even when another player reveals it", () => {
    const f = fixture();
    const bind = piece("18027");
    f.s.attachments = [bind];
    f.s.players.push({
      id: "p2",
      heroId: "groot",
      aspect: "protection",
      player: player(),
      flags: {},
      ended: false,
      eliminated: false,
      mulliganDone: true,
    });
    activateSeat(f.s, "p2");
    f.start(gamoraEncounterReveal(f.s, bind)!);
    expect(bind.attachedTo).toBe("hero:p1");
    expect(gamoraIdentityBlank(f.s)).toBe(false);
    expect(gamoraIdentityBlank(seatView(f.s, "p1"))).toBe(true);
  });
  it("the In a Bind removal cost discards an Attack event and deals damage even if Tough prevents it", () => {
    const f = fixture();
    const bind = piece("18027", { attachedTo: "hero:p1" }),
      event = piece("18003"),
      wrong = piece("18005");
    f.s.attachments = [bind];
    f.s.player.hand = [event, wrong];
    f.s.player.tough = true;
    const choices = gamoraAttachmentActions(f.s, bind, f.ports);
    expect(choices.map((o) => o.id)).toEqual([event.id]);
    f.start(choices[0].effects);
    expect(f.s.player.tough).toBe(false);
    expect(f.s.player.hp).toBe(10);
    expect(f.s.player.hand.map((p) => p.id)).toEqual([wrong.id]);
    expect(f.s.attachments).toEqual([]);
    expect(f.s.encounter.discard[0].id).toBe(bind.id);
  });
  it("a teammate can pay In a Bind's Hero Action from their own hand, damaging the actual Gamora", () => {
    const f = fixture();
    f.s.player.form = "alter";
    const bind = piece("18027", { attachedTo: "hero:p1" });
    f.s.attachments = [bind];
    const other = player(),
      event = piece("16004", { ownerId: "p2" });
    other.hand = [event];
    f.s.players.push({
      id: "p2",
      heroId: "groot",
      aspect: "protection",
      player: other,
      flags: {},
      ended: false,
      eliminated: false,
      mulliganDone: true,
    });
    activateSeat(f.s, "p2");
    const choices = gamoraAttachmentActions(f.s, bind, f.ports);
    expect(choices.map((o) => o.id)).toEqual([event.id]);
    f.start(choices[0].effects);
    expect(seatView(f.s, "p1").player.hp).toBe(9);
    expect(f.s.player.hp).toBe(10);
    expect(f.s.player.discard[0].id).toBe(event.id);
    expect(f.s.encounter.discard[0].id).toBe(bind.id);
  });
  it.each([false, true])(
    "Waylay's surge checks preexisting statuses, already=%s",
    (already) => {
      const f = fixture();
      f.s.player.confused = already;
      f.start(gamoraEncounterReveal(f.s, piece("18028"))!);
      expect(f.s.player.confused).toBe(true);
      expect(f.s.player.stunned).toBe(true);
      expect(f.native.filter((e) => e.type === "dealEncounter")).toHaveLength(
        Number(already),
      );
    },
  );
  it("all five nemesis/obligation faces have complete printed numeric boost support", () => {
    const f = fixture();
    for (const code of ["18024", "18025", "18026", "18027", "18028"])
      expect(gamoraBoost(f.s, piece(code))).toEqual([]);
    expect(gamoraBoost(f.s, piece("01099"))).toBeNull();
    expect(cards.get("18026")?.text).toContain("Retaliate 2");
  });
  it("unknown module effects fail loudly while other adapters remain untouched", () => {
    const f = fixture();
    expect(resolveGamoraEffect(f.s, { type: "other" }, f.ports)).toBe(false);
    expect(() => resolveGamoraEffect(f.s, G("unknown"), f.ports)).toThrow(
      "Unknown Gamora",
    );
  });
});
