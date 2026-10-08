import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import type { Card, Effect, GameState, Piece } from "../src/game/types.js";
import {
  STAR_LORD_SCRIPT_CODES,
  resolveStarLordEffect,
  starLordAbility,
  starLordAbilityOptions,
  starLordAllyEnter,
  starLordAllyThwartBonus,
  starLordAllyTraits,
  starLordBeforeEvent,
  starLordBoost,
  starLordCanReduceHandCost,
  starLordCardCostReduction,
  starLordDamageOptions,
  starLordEncounterReveal,
  starLordFacedownEncounters,
  starLordGuardianThwartBonus,
  starLordHandPlayFinished,
  starLordHandPlayOptions,
  starLordHandSizeBonus,
  starLordHeroTraits,
  starLordPlayRestriction,
  starLordRoundEnded,
  starLordSetup,
  starLordStats,
  starLordTreacherySurge,
  starLordEvent,
  type StarLordPorts,
} from "../src/game/star-lord.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const L = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `starlord:${type}`,
  ...args,
});
const reload = (s: GameState): GameState => {
  const hydrated: GameState = JSON.parse(JSON.stringify(s));
  const seat = hydrated.players.find((p) => p.id === hydrated.activePlayerId)!;
  seat.player = hydrated.player;
  seat.flags = hydrated.flags;
  return hydrated;
};
function fixture(team = false) {
  let s = newGame({
    heroId: "rocket",
    aspect: "leadership",
    villainId: "rhino",
    seed: 17001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "rocket", aspect: "leadership" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  s = dispatch(s, { type: "MULLIGAN", ids: [] });
  if (team) s = dispatch(s, { type: "MULLIGAN", ids: [] });
  expect(s.error).toBeUndefined();
  // These are isolated module tests. Native Star-Lord creation, printed starter
  // conservation and actual payments belong to the separate engine acceptance.
  s.heroId = "stld";
  s.players[0].heroId = "stld";
  s.player.form = "hero";
  s.player.inPlay = [];
  s.player.hand = [];
  s.player.discard = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.flags = {};
  s.players[0].player = s.player;
  s.players[0].flags = s.flags;
  s.encounter.dealt = [];
  const ports: StarLordPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    canChangeForm: (state) => !state.flags.formLocked,
    flip: (state, _counts, target) => {
      state.player.form = target === "alter" ? "alter" : "hero";
    },
    canReadyIdentity: () => true,
    canPay: vi.fn(() => true),
    canGiveStatus: () => true,
    enemyTargets: (state) => [
      { id: state.villain.id, label: "Rhino", code: state.villain.code },
      ...state.minions.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    schemeTargets: (state) => [
      { id: "main", label: "The Break-In!", code: state.scheme.code },
      ...state.sideSchemes.map((p) => ({
        id: p.id,
        label: cards.get(p.code)!.name,
        code: p.code,
      })),
    ],
    isTextBlank: (state, p) => !!state.flags[`blank:${p.id}`],
    discardHand: (state, id) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Missing hand card");
      state.player.discard.push(state.player.hand.splice(i, 1)[0]);
    },
    discardPiece: vi.fn((state: GameState, id: string) => {
      const i = state.player.inPlay.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Missing controlled card");
      state.player.discard.push(state.player.inPlay.splice(i, 1)[0]);
    }),
    revealHidden: (state) => {
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    },
    recycleEncounter: vi.fn(),
    attackProgram: vi.fn(),
    log: vi.fn(),
    shufflePlayerDeck: vi.fn((state: GameState) => {
      state.player.deck.reverse();
    }),
    dealEncounter: vi.fn((state: GameState) => {
      if (!state.encounter.deck.length && state.encounter.discard.length) {
        state.encounter.deck = state.encounter.discard.splice(0);
        state.encounter.acceleration++;
      }
      const p = state.encounter.deck.shift();
      if (p) {
        p.dealtTo = state.activePlayerId;
        state.encounter.dealt.push(p);
      }
      return p;
    }),
    cardCost: (_state, p) => Number(cards.get(p.code)?.cost || 0),
    preventDamage: vi.fn(
      (state: GameState, packet: Effect | undefined, amount: number) => {
        if (packet?.kind === "attack" && state.attack)
          state.attack.prevented += amount;
        else if (packet?.kind === "overkill" && state.attack)
          state.attack.identityPrevented =
            (state.attack.identityPrevented || 0) + amount;
        else if (packet) packet.prevented = (packet.prevented || 0) + amount;
      },
    ),
    defeatMinion: vi.fn((state: GameState, id: string) => {
      const i = state.minions.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Missing minion");
      state.encounter.discard.push(state.minions.splice(i, 1)[0]);
    }),
    hasTrait: (state, id, trait) => {
      const p = [...state.minions, ...state.player.inPlay].find(
        (p) => p.id === id,
      );
      return (
        !!p && (cards.get(p.code)?.traits || "").split(/\.\s*/).includes(trait)
      );
    },
  };
  const piece = (code: string, patch: Partial<Piece> = {}) => ({
    ...makePiece(s, code),
    ...patch,
  });
  const facedown = (count: number, playerId = s.activePlayerId) => {
    for (let i = 0; i < count; i++)
      s.encounter.dealt.push(piece("01103", { dealtTo: playerId }));
  };
  const attack = (isVillain = true) => {
    s.attack = {
      attacker: s.villain.id,
      base: 6,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain,
    };
  };
  return { s, ports, piece, facedown, attack };
}

describe("Star-Lord printed rules and physical continuations", () => {
  it("covers exactly all 15 identity, signature, obligation and nemesis faces", () => {
    const expected = (catalog as unknown as Card[])
      .filter((c) => ["stld", "stld_nemesis"].includes(c.set_code || ""))
      .map((c) => c.code);
    expect([...STAR_LORD_SCRIPT_CODES].sort()).toEqual(expected.sort());
    expect(new Set(STAR_LORD_SCRIPT_CODES).size).toBe(15);
  });
  it("counts only physical facedown cards dealt to this player", () => {
    const { s, facedown, piece } = fixture(true);
    facedown(2);
    facedown(3, "p2");
    s.encounter.discard.push(piece("01103"));
    s.resolving.push(piece("01103"));
    expect(starLordFacedownEncounters(s)).toBe(2);
    expect(starLordFacedownEncounters(seatView(s, "p2"))).toBe(3);
  });
  it("grants Guardian only to actual controlled allies in hero form", () => {
    const { s, piece } = fixture();
    const nova = piece("17002"),
      support = piece("17006"),
      hand = piece("01067");
    s.player.inPlay.push(nova, support);
    s.player.hand.push(hand);
    expect(starLordAllyTraits(s, nova)).toEqual(["Guardian"]);
    expect(starLordAllyTraits(s, support)).toEqual([]);
    expect(starLordAllyTraits(s, hand)).toEqual([]);
    s.player.form = "alter";
    expect(starLordAllyTraits(s, nova)).toEqual([]);
  });
  it("Leader of the Guardians loses granted allies after a flip but keeps printed Guardians", () => {
    const { s, piece } = fixture();
    const nova = piece("17002"),
      yondu = piece("17013");
    s.player.inPlay.push(nova, yondu, piece("17009"));
    expect(starLordStats(s)).toEqual({ attack: 0, thwart: 1 });
    expect(starLordAllyThwartBonus(s, nova)).toBe(1);
    expect(starLordAllyThwartBonus(s, yondu)).toBe(1);
    s.player.form = "alter";
    expect(starLordStats(s).thwart).toBe(0);
    expect(starLordAllyThwartBonus(s, nova)).toBe(0);
    expect(starLordAllyThwartBonus(s, yondu)).toBe(1);
  });
  it("text blanking removes only the affected continuous card ability", () => {
    const { s, piece, facedown } = fixture();
    s.player.inPlay.push(piece("17008"), piece("17009"), piece("17010"));
    facedown(2);
    expect(starLordHeroTraits(s)).toEqual(["Aerial"]);
    expect(starLordHandSizeBonus(s)).toBe(2);
    s.sideSchemes.push(piece("12026"));
    expect(starLordHeroTraits(s)).toEqual([]);
    expect(starLordHandSizeBonus(s)).toBe(0);
    expect(starLordGuardianThwartBonus(s, true)).toBe(1);
  });
  it.each([0, 1, 2, 3, 5])(
    "Helmet adds min(3, %i) hand size only in hero form",
    (count) => {
      const { s, piece, facedown } = fixture();
      s.player.inPlay.push(piece("17010"));
      facedown(count);
      expect(starLordHandSizeBonus(s)).toBe(Math.min(3, count));
      s.player.form = "alter";
      expect(starLordHandSizeBonus(s)).toBe(0);
    },
  );
  it("setup searches actual deck and discard copies, keeps physical ownership and shuffles", () => {
    let { s, ports, piece } = fixture();
    const deckGun = piece("17007"),
      discardedGun = piece("17007"),
      oldHand = piece("17003");
    s.player.deck = [piece("17004"), deckGun];
    s.player.discard = [discardedGun];
    s.player.hand = [oldHand];
    expect(starLordSetup(s)).toEqual([L("setup")]);
    resolveStarLordEffect(s, L("setup"), ports);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      deckGun.id,
      discardedGun.id,
    ]);
    s = reload(s);
    resolveStarLordEffect(s, s.prompt!.options[1].effects[0], ports);
    expect(s.player.hand.map((p) => p.id)).toEqual([
      oldHand.id,
      discardedGun.id,
    ]);
    expect(s.player.discard).toEqual([]);
    expect(s.player.deck).toContainEqual(deckGun);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("setup never fetches an Element Gun already in hand or fabricates one", () => {
    const { s, ports, piece } = fixture();
    const gun = piece("17007");
    s.player.deck = [piece("17003")];
    s.player.hand = [gun];
    s.player.discard = [];
    resolveStarLordEffect(s, L("setup"), ports);
    expect(s.prompt).toBeNull();
    expect(s.player.hand).toEqual([gun]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    expect(() =>
      resolveStarLordEffect(s, L("setup-gun", { target: gun.id }), ports),
    ).toThrow();
  });
  it("setup with one copy saves the exact target in its continuation", () => {
    const { s, ports, piece } = fixture();
    const gun = piece("17007");
    s.player.deck = [gun];
    resolveStarLordEffect(s, L("setup"), ports);
    expect(s.queue).toEqual([L("setup-gun", { target: gun.id })]);
  });
  it("Smooth Talker chooses before revealing the top, swaps without drawing and does not empty a one-card deck", () => {
    let { s, ports, piece } = fixture();
    s.player.form = "alter";
    const chosen = piece("17003"),
      top = piece("17005");
    s.player.hand = [chosen, piece("17004")];
    s.player.deck = [top];
    const hidden = s.hiddenInfo;
    expect(starLordAbility(s, "identity", "smooth-talker", ports)).toEqual([
      L("smooth"),
    ]);
    resolveStarLordEffect(s, L("smooth"), ports);
    expect(s.hiddenInfo).toBe(hidden);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(
      s.player.hand.map((p) => p.id),
    );
    s = reload(s);
    resolveStarLordEffect(s, s.prompt!.options[0].effects[0], ports);
    expect(s.player.hand[0].id).toBe(top.id);
    expect(s.player.deck).toEqual([chosen]);
    expect(s.player.discard).toEqual([]);
    expect(s.encounter.dealt).toEqual([]);
    expect(s.queue).toEqual([]);
    expect(starLordAbilityOptions(s, "identity", ports)).toEqual([]);
  });
  it.each(["hero", "empty-hand", "empty-deck", "used"])(
    "Smooth Talker rejects unavailable state %s",
    (kind) => {
      const { s, ports, piece } = fixture();
      s.player.form = "alter";
      s.player.hand = [piece("17003")];
      s.player.deck = [piece("17004")];
      if (kind === "hero") s.player.form = "hero";
      if (kind === "empty-hand") s.player.hand = [];
      if (kind === "empty-deck") s.player.deck = [];
      if (kind === "used") s.flags.starlordSmoothRound = s.round;
      expect(starLordAbilityOptions(s, "identity", ports)).toEqual([]);
      expect(() =>
        resolveStarLordEffect(
          s,
          L("smooth-swap", { id: s.player.hand[0]?.id }),
          ports,
        ),
      ).toThrow();
    },
  );
  it("the cost interrupt deals the real facedown encounter before resuming only its chosen hand play", () => {
    let { s, ports, piece } = fixture();
    const card = piece("17005"),
      other = piece("17005"),
      encounter = piece("01103");
    s.player.hand = [card, other];
    s.encounter.deck = [encounter];
    const after = [{ type: "play", id: card.id, starlordHandled: true }];
    expect(starLordHandPlayOptions(s, card, after, ports)[0]).toMatchObject({
      id: "starlord-discount",
    });
    resolveStarLordEffect(
      s,
      starLordHandPlayOptions(s, card, after, ports)[0].effects[0],
      ports,
    );
    s = reload(s);
    expect(
      s.encounter.dealt.map((p) => ({ id: p.id, dealtTo: p.dealtTo })),
    ).toEqual([{ id: encounter.id, dealtTo: "p1" }]);
    expect(starLordCardCostReduction(s, card)).toBe(3);
    expect(starLordCardCostReduction(s, other)).toBe(0);
    expect(s.queue).toEqual(after);
    expect(starLordHandPlayOptions(s, other, [], ports)).toEqual([]);
    starLordHandPlayFinished(s, other.id);
    expect(starLordCardCostReduction(s, card)).toBe(3);
    starLordHandPlayFinished(s, card.id);
    expect(starLordCardCostReduction(s, card)).toBe(0);
    expect(s.flags.starlordCostRound).toBe(s.round);
  });
  it("the interrupt can be offered before affordability and applies in other players' turns", () => {
    const { s, ports, piece } = fixture(true);
    const nova = piece("17002");
    s.player.hand = [nova];
    ports.canPay = () => false;
    s.turnPlayerId = "p2";
    expect(starLordHandPlayOptions(s, nova, [], ports)).toHaveLength(1);
  });
  it.each(["alter", "used", "zero-cost", "not-in-hand", "no-encounter"])(
    "What could go wrong cannot initiate in %s state",
    (kind) => {
      const { s, ports, piece } = fixture();
      const p = piece(kind === "zero-cost" ? "17003" : "17005");
      s.player.hand = [p];
      if (kind === "alter") s.player.form = "alter";
      if (kind === "used") s.flags.starlordCostRound = s.round;
      if (kind === "not-in-hand") s.player.hand = [];
      if (kind === "no-encounter") s.encounter.deck = s.encounter.discard = [];
      expect(starLordHandPlayOptions(s, p, [], ports)).toEqual([]);
      expect(() =>
        resolveStarLordEffect(s, L("discount", { id: p.id }), ports),
      ).toThrow();
    },
  );
  it("an unpayable actual encounter cost leaves once-per-round limits and discount untouched", () => {
    const { s, ports, piece } = fixture();
    const p = piece("17005");
    s.player.hand = [p];
    ports.dealEncounter = () => undefined;
    expect(() =>
      resolveStarLordEffect(s, L("discount", { id: p.id }), ports),
    ).toThrow();
    expect(s.flags.starlordCostRound).toBeUndefined();
    expect(starLordCardCostReduction(s, p)).toBe(0);
  });
  it("round cleanup removes each player's identity limits and stale pending discount", () => {
    const { s } = fixture(true);
    for (const seat of s.players) {
      const f = seatView(s, seat).flags;
      f.starlordCostRound =
        f.starlordSmoothRound =
        f.starlordFirstTreacheryRound =
          s.round;
      f.starlordDiscountCardId = "old-play";
      f.warlockDeckEmptyObserved = seat.id === s.activePlayerId;
    }
    starLordRoundEnded(s);
    for (const seat of s.players) {
      const f = seatView(s, seat).flags;
      for (const key of [
        "starlordCostRound",
        "starlordSmoothRound",
        "starlordFirstTreacheryRound",
        "starlordDiscountCardId",
      ])
        expect(f[key]).toBeUndefined();
      expect(f.warlockDeckEmptyObserved).toBe(seat.id === s.activePlayerId);
    }
  });
  it("Daring Escape pays a real encounter cost before its ready and draw continuation", () => {
    let { s, ports, piece } = fixture();
    const event = piece("17003"),
      encounter = piece("01103");
    s.encounter.deck = [encounter];
    const after = [{ type: "eventResolve", id: event.id }];
    const cost = starLordBeforeEvent(s, event, after);
    expect(starLordEvent(s, event)).toEqual([
      { type: "ready", target: "hero" },
      { type: "draw", amount: 1 },
    ]);
    s = reload(s);
    resolveStarLordEffect(s, cost[0], ports);
    expect(s.encounter.dealt[0].id).toBe(encounter.id);
    expect(s.queue).toEqual(after);
    expect(s.flags.starlordCostRound).toBeUndefined();
  });
  it("Daring Escape stays playable without a readyable hero because its draw can change the game", () => {
    const { s, ports, piece } = fixture();
    ports.canReadyIdentity = () => false;
    expect(starLordPlayRestriction(s, piece("17003"))).toBeNull();
    s.encounter.deck = s.encounter.discard = [];
    expect(starLordPlayRestriction(s, piece("17003"))).toContain(
      "actual facedown",
    );
  });
  it("Gutsy Move uses one thwart packet and only its controller's facedown count", () => {
    const { s, ports, piece, facedown } = fixture(true);
    facedown(2);
    facedown(5, "p2");
    resolveStarLordEffect(s, starLordEvent(s, piece("17004"))![0], ports);
    expect(s.queue).toEqual([
      { type: "thwart", target: "main", amount: 6, action: true },
    ]);
    expect(
      starLordBeforeEvent(s, piece("17004"), [{ type: "sentinel" }]),
    ).toEqual([{ type: "sentinel" }]);
  });
  it("Sliding Shot requires a controlled Gun but permits exhausted or text-blanked Guns", () => {
    const { s, ports, piece, facedown } = fixture();
    const event = piece("17005"),
      gun = piece("17007", { exhausted: true });
    s.player.hand.push(gun);
    expect(starLordPlayRestriction(s, event)).toContain(
      "controlled Element Gun",
    );
    s.player.hand = [];
    s.player.inPlay.push(gun);
    s.flags[`blank:${gun.id}`] = true;
    expect(starLordPlayRestriction(s, event)).toBeNull();
    facedown(3);
    resolveStarLordEffect(s, starLordEvent(s, event)![0], ports);
    expect(s.queue).toEqual([
      { type: "attackAction", target: s.villain.id, amount: 11 },
    ]);
  });
  it.each(["17003", "17004", "17005"])(
    "event %s requires hero form at initiation",
    (code) => {
      const { s, piece } = fixture();
      s.player.form = "alter";
      expect(starLordPlayRestriction(s, piece(code))).toContain("hero form");
    },
  );
  it("Element Gun exhausts and requests its physical resource cost before a stunned attack", () => {
    let { s, ports, piece } = fixture();
    const gun = piece("17007");
    s.player.inPlay.push(gun);
    s.player.stunned = true;
    expect(starLordAbility(s, gun.id, "element-gun", ports)).toEqual([
      L("gun-pay", { id: gun.id }),
    ]);
    resolveStarLordEffect(s, L("gun-pay", { id: gun.id }), ports);
    expect(gun.exhausted).toBe(true);
    s = reload(s);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 1,
      cancelable: false,
      after: [L("gun-attack", { id: gun.id })],
    });
    s.queue = [];
    resolveStarLordEffect(s, L("gun-attack", { id: gun.id }), ports);
    expect(s.queue).toEqual([
      {
        type: "attackAction",
        target: s.villain.id,
        amount: 3,
        source: "hero",
        piercing: true,
      },
    ]);
  });
  it.each(["alter", "exhausted", "blank", "unpayable"])(
    "Element Gun is unavailable when %s",
    (kind) => {
      const { s, ports, piece } = fixture();
      const gun = piece("17007");
      s.player.inPlay.push(gun);
      if (kind === "alter") s.player.form = "alter";
      if (kind === "exhausted") gun.exhausted = true;
      if (kind === "blank") s.flags[`blank:${gun.id}`] = true;
      if (kind === "unpayable") ports.canPay = () => false;
      expect(starLordAbilityOptions(s, gun.id, ports)).toEqual([]);
      expect(() =>
        resolveStarLordEffect(s, L("gun-pay", { id: gun.id }), ports),
      ).toThrow();
    },
  );
  it("Nova Prime's optional defeat ignores Tough but rejects Elite and uses the chosen physical minion", () => {
    let { s, ports, piece } = fixture();
    const nova = piece("17002"),
      tough = piece("01101", { tough: true }),
      elite = piece("17026");
    s.minions.push(tough, elite);
    expect(starLordAllyEnter(s, nova, true)![0]).toMatchObject({
      type: "optional",
      title: "Nova Prime",
    });
    resolveStarLordEffect(s, L("nova", { id: nova.id }), ports);
    expect(s.queue).toEqual([L("nova-defeat", { target: tough.id })]);
    s = reload(s);
    expect(() =>
      resolveStarLordEffect(s, L("nova-defeat", { target: elite.id }), ports),
    ).toThrow();
    resolveStarLordEffect(s, L("nova-defeat", { target: tough.id }), ports);
    expect(s.minions.map((p) => p.id)).toEqual([elite.id]);
    expect(s.encounter.discard.at(-1)?.id).toBe(tough.id);
    expect(ports.defeatMinion).toHaveBeenCalledExactlyOnceWith(s, tough.id);
  });
  it("Nova Prime never responds to put-into-play or when no non-Elite minion is available", () => {
    const { s, piece } = fixture();
    const nova = piece("17002");
    expect(starLordAllyEnter(s, nova, true)).toEqual([]);
    s.minions.push(piece("01101"));
    expect(starLordAllyEnter(s, nova, false)).toEqual([]);
    expect(starLordAllyEnter(s, piece("17013"), true)).toBeNull();
  });
  it("Jet Boots prevents the current facedown count from one exact saved identity damage packet", () => {
    let { s, ports, piece, facedown } = fixture();
    const boots = piece("17008");
    s.player.inPlay.push(boots);
    facedown(2);
    const packet = {
      type: "damage",
      target: "hero",
      source: "17027",
      amount: 3,
    };
    const after = [{ ...packet, starlordHandled: true }];
    const effect = starLordDamageOptions(s, packet, 3, after, ports)[0]
      .effects[0];
    s = reload(s);
    resolveStarLordEffect(s, effect, ports);
    expect(s.player.inPlay[0].exhausted).toBe(true);
    expect(ports.preventDamage).toHaveBeenCalledExactlyOnceWith(s, packet, 2);
    expect(s.queue).toEqual(after);
  });
  it.each([
    "tough",
    "alter",
    "other-target",
    "zero-damage",
    "no-facedown",
    "exhausted",
    "blank",
  ])("Jet Boots cannot trigger for %s", (kind) => {
    const { s, ports, piece, facedown } = fixture();
    const boots = piece("17008");
    s.player.inPlay.push(boots);
    facedown(1);
    let amount = 2,
      target = "hero";
    if (kind === "tough") s.player.tough = true;
    if (kind === "alter") s.player.form = "alter";
    if (kind === "other-target") target = "hero:p2";
    if (kind === "zero-damage") amount = 0;
    if (kind === "no-facedown") s.encounter.dealt = [];
    if (kind === "exhausted") boots.exhausted = true;
    if (kind === "blank") s.flags[`blank:${boots.id}`] = true;
    expect(
      starLordDamageOptions(s, { type: "damage", target }, amount, [], ports),
    ).toEqual([]);
  });
  it("Bad Boy pays its physical discard cost then prevents, changes form and draws before continuation", () => {
    let { s, ports, piece, attack } = fixture();
    const vehicle = piece("17006");
    s.player.inPlay.push(vehicle);
    attack();
    const packet = { type: "damageWindow", kind: "attack", target: "hero" };
    const after = [{ type: "finishAttack" }];
    const effect = starLordDamageOptions(s, packet, 6, after, ports)[0]
      .effects[0];
    s = reload(s);
    resolveStarLordEffect(s, effect, ports);
    expect(s.player.discard.at(-1)?.id).toBe(vehicle.id);
    expect(s.player.inPlay).toEqual([]);
    expect(s.attack?.prevented).toBe(6);
    expect(s.player.form).toBe("alter");
    expect(s.queue).toEqual([{ type: "draw", amount: 2 }, ...after]);
  });
  it("Bad Boy can prevent villain overkill reaching its identity but never ally or minion attack damage", () => {
    const { s, ports, piece, attack } = fixture();
    s.player.inPlay.push(piece("17006"));
    attack();
    expect(
      starLordDamageOptions(
        s,
        { type: "damageWindow", kind: "overkill", target: "hero" },
        3,
        [],
        ports,
      ),
    ).toHaveLength(1);
    expect(
      starLordDamageOptions(
        s,
        { type: "damageWindow", kind: "attack", target: "ally" },
        3,
        [],
        ports,
      ),
    ).toEqual([]);
    attack(false);
    expect(
      starLordDamageOptions(
        s,
        { type: "damageWindow", kind: "attack", target: "hero" },
        3,
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      starLordDamageOptions(
        s,
        { type: "damage", target: "hero" },
        3,
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it("Bad Boy's independent draw and prevention remain when a form lock prevents the change", () => {
    const { s, ports, piece, attack } = fixture();
    s.player.inPlay.push(piece("17006"));
    s.flags.formLocked = true;
    attack();
    const effect = starLordDamageOptions(
      s,
      { type: "damageWindow", kind: "attack", target: "hero" },
      4,
      [],
      ports,
    )[0].effects[0];
    resolveStarLordEffect(s, effect, ports);
    expect(s.player.form).toBe("hero");
    expect(s.attack?.prevented).toBe(4);
    expect(s.queue).toEqual([{ type: "draw", amount: 2 }]);
  });
  it("Mister Knife snapshots only the engaged player's first treachery and stops after it", () => {
    let { s, piece } = fixture(true);
    s.phase = "villain";
    s.minions.push(piece("17026", { engagedWith: "p1" }));
    expect(starLordTreacherySurge(seatView(s, "p2"), piece("17027"))).toBe(0);
    expect(starLordTreacherySurge(s, piece("17027"))).toBe(1);
    s = reload(s);
    expect(starLordTreacherySurge(s, piece("17027"))).toBe(0);
    s.round++;
    expect(starLordTreacherySurge(s, piece("17027"))).toBe(1);
  });
  it("Shadows of the Past bringing Mister Knife into play gains no retroactive Surge", () => {
    const { s, piece } = fixture();
    s.phase = "villain";
    expect(starLordTreacherySurge(s, piece("01190"))).toBe(0);
    s.minions.push(piece("17026", { engagedWith: "p1" }));
    expect(starLordTreacherySurge(s, piece("17027"))).toBe(0);
  });
  it("Mister Knife ignores a side scheme and treacheries revealed outside the villain phase", () => {
    const { s, piece } = fixture();
    s.minions.push(piece("17026"));
    expect(starLordTreacherySurge(s, piece("17027"))).toBe(0);
    expect(s.flags.starlordFirstTreacheryRound).toBeUndefined();
    s.phase = "villain";
    expect(starLordTreacherySurge(s, piece("17025"))).toBe(0);
    expect(starLordTreacherySurge(s, piece("17027"))).toBe(1);
  });
  it("Spartoi Cunning uses independent random discard, damage and main threat clauses", () => {
    const { s, piece } = fixture();
    expect(starLordEncounterReveal(s, piece("17027"))).toEqual([
      { type: "randomDiscard" },
      { type: "damage", target: "hero", amount: 1, source: "17027" },
      { type: "threat", target: "main", amount: 1 },
    ]);
  });
  it("Banishment routes to Star-Lord's actual seat and optionally flips without spending the normal flip", () => {
    const { s, ports, piece } = fixture(true);
    const obligation = piece("17024");
    expect(starLordEncounterReveal(seatView(s, "p2"), obligation)).toEqual([
      L("obligation", { piece: obligation, actorId: "p1" }),
    ]);
    resolveStarLordEffect(s, L("obligation", { piece: obligation }), ports);
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["flip", "stay"]);
    resolveStarLordEffect(s, s.prompt!.options[0].effects[0], ports);
    expect(s.player.form).toBe("alter");
    expect(s.flags.flipped).toBeUndefined();
  });
  it("exhausting Peter Quill removes exactly the physical Banishment once", () => {
    let { s, ports, piece } = fixture();
    const obligation = piece("17024");
    s.player.form = "alter";
    s.resolving.push(obligation);
    s = reload(s);
    resolveStarLordEffect(
      s,
      L("obligation-remove", { piece: obligation }),
      ports,
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.map((p) => p.id)).toEqual([obligation.id]);
    expect(s.resolving).toEqual([]);
    expect(() =>
      resolveStarLordEffect(
        s,
        L("obligation-remove", { piece: obligation }),
        ports,
      ),
    ).toThrow();
  });
  it("Banishment discards a chosen controlled Gun, including an exhausted one, without adding threat", () => {
    let { s, ports, piece } = fixture();
    const first = piece("17007"),
      second = piece("17007", { exhausted: true });
    s.player.inPlay.push(first, second, piece("17008"));
    resolveStarLordEffect(s, L("obligation-discard"), ports);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([first.id, second.id]);
    s = reload(s);
    resolveStarLordEffect(s, s.prompt!.options[1].effects[0], ports);
    expect(s.player.discard.at(-1)?.id).toBe(second.id);
    expect(s.player.inPlay.map((p) => p.id)).toContain(first.id);
    expect(s.queue).toEqual([]);
  });
  it("Banishment adds 3 main threat when no Gun is in play; a hand Gun does not pay", () => {
    const { s, ports, piece } = fixture();
    s.player.hand.push(piece("17007"));
    resolveStarLordEffect(s, L("obligation-discard"), ports);
    expect(s.queue).toEqual([{ type: "threat", target: "main", amount: 3 }]);
  });
  it("plain encounter keywords stay with the native host and unrelated effects remain unclaimed", () => {
    const { s, ports, piece } = fixture();
    for (const code of ["17025", "17026"])
      expect(starLordEncounterReveal(s, piece(code))).toEqual([]);
    expect(starLordBoost(s, piece("17027"))).toBeNull();
    expect(starLordEvent(s, piece("01077"))).toBeNull();
    expect(starLordPlayRestriction(s, piece("01077"))).toBeNull();
    expect(resolveStarLordEffect(s, { type: "draw", amount: 1 }, ports)).toBe(
      false,
    );
  });
});
