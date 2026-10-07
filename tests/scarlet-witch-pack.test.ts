import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { allInPlay, controller, seatView } from "../src/game/team";
import {
  SCARLET_WITCH_PACK_CORE_ALIASES,
  SCARLET_WITCH_PACK_SCRIPT_CODES,
  scarletWitchPackPlayRestriction,
  scarletWitchPackEvent,
  scarletWitchPackAbilityOptions,
  scarletWitchPackAbility,
  scarletWitchPackAllyEnter,
  scarletWitchPackAfterAllyThwart,
  scarletWitchPackAfterHeroThwart,
  scarletWitchPackAllyAttackOptions,
  scarletWitchPackAllyAttackBonus,
  scarletWitchPackAfterAllyAttack,
  resolveScarletWitchPackEffect,
  type ScarletWitchPackPorts,
  type ScarletWitchPackThwartSnapshot,
} from "../src/game/scarlet-witch-pack";
import type { Effect, GameState, Piece } from "../src/game/types";

const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "scarlet-pack:" + type,
  ...args,
});
function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 1511,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "leadership" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.player.form = "hero";
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.inPlay = [];
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
  }
  let targets = [{ id: "main", label: "Main scheme" }];
  let ignoring = targets;
  const ports: ScarletWitchPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    discardPiece: vi.fn((state: GameState, id: string) => {
      const seat = controller(state, id);
      if (!seat) return;
      const view = seatView(state, seat),
        index = view.player.inPlay.findIndex((p) => p.id === id);
      const [p] = view.player.inPlay.splice(index, 1);
      seatView(state, p.ownerId || seat.id).player.discard.push(p);
    }),
    hasTrait: vi.fn(() => true),
    enemyTargets: (state, _attack) => [
      { id: state.villain.id, label: "Rhino" },
      ...state.minions.map((p) => ({ id: p.id, label: card(p).name })),
    ],
    schemeTargets: vi.fn((_state, ignoreCrisis) =>
      ignoreCrisis ? ignoring : targets,
    ),
    cardCost: (_, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    heroREC: vi.fn(() => 5),
    discardEncounterTop: vi.fn((state) => {
      const piece = state.encounter.deck.shift();
      if (piece) state.encounter.discard.push(piece);
      const emptied = !state.encounter.deck.length;
      if (emptied) {
        state.encounter.acceleration++;
        state.encounter.deck = state.encounter.discard.splice(0).reverse();
      }
      return { piece, emptied };
    }),
  };
  const run = (e: Effect) => resolveScarletWitchPackEffect(s, e, ports);
  const choose = (id: string) => {
    const found = s.prompt!.options.find((o) => o.id === id);
    if (!found) throw Error("Unknown fixture option " + id);
    s.prompt = null;
    for (const e of found.effects) if (!run(e)) s.queue.push(e);
  };
  const play = (code: string, seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = seatId;
    seatView(s, seatId).player.inPlay.push(p);
    return p;
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((code) => makePiece(s, code));
    return [...s.player.hand];
  };
  const schemes = (normal: typeof targets, ignoreCrisis = normal) => {
    targets = normal;
    ignoring = ignoreCrisis;
  };
  return { s, ports, run, choose, play, hand, schemes };
}

describe("Scarlet Witch retail pack", () => {
  it("registers all seventeen supplementary printings with twelve native rules and five exact Core aliases", () => {
    expect(SCARLET_WITCH_PACK_SCRIPT_CODES).toHaveLength(12);
    expect(SCARLET_WITCH_PACK_CORE_ALIASES).toEqual([
      "15016",
      "15017",
      "15020",
      "15021",
      "15022",
    ]);
    expect(
      new Set([
        ...SCARLET_WITCH_PACK_SCRIPT_CODES,
        ...SCARLET_WITCH_PACK_CORE_ALIASES,
      ]).size,
    ).toBe(17);
    expect(SCARLET_WITCH_PACK_SCRIPT_CODES).toContain("15018");
  });
  it("retail allies use normal entry and have no unrelated active ability", () => {
    const { s, ports, play } = fixture();
    for (const code of ["15010", "15011"]) {
      const p = play(code);
      expect(scarletWitchPackAllyEnter(s, p)).toEqual([]);
      expect(scarletWitchPackAbilityOptions(s, p.id, ports)).toEqual([]);
      expect(scarletWitchPackAbility(s, p.id, ports, "use")).toBe(false);
    }
    expect(scarletWitchPackAllyEnter(s, makePiece(s, "01084"))).toBeNull();
    expect(scarletWitchPackEvent(s, makePiece(s, "01084"))).toBeNull();
    expect(
      resolveScarletWitchPackEffect(s, { type: "draw", amount: 1 }, ports),
    ).toBe(false);
    expect(() => resolveScarletWitchPackEffect(s, P("unknown"), ports)).toThrow(
      /Unknown Scarlet Witch/,
    );
  });
  it.each(["15015", "15018", "15029"])(
    "%s is unavailable through ordinary hand play",
    (code) => {
      const { s, ports } = fixture();
      expect(
        scarletWitchPackPlayRestriction(s, makePiece(s, code), ports),
      ).toMatch(/response or interrupt/);
    },
  );
  it("Speed offers an optional response only while an actual controlled copy can ready", () => {
    const { s, play } = fixture();
    const speed = play("15010");
    expect(scarletWitchPackAfterAllyThwart(s, speed)).toEqual([]);
    speed.exhausted = true;
    expect(scarletWitchPackAfterAllyThwart(s, speed)).toEqual([
      expect.objectContaining({
        type: "optional",
        actorId: "p1",
        title: "Speed",
        effects: [P("speed-ready", { id: speed.id })],
      }),
    ]);
  });
  it("accepting Speed commits his once-per-round limit and a later round permits it again", () => {
    const { s, play, run } = fixture();
    const speed = play("15010");
    speed.exhausted = true;
    run(P("speed-ready", { id: speed.id }));
    expect(s.queue).toEqual([{ type: "ready", target: speed.id }]);
    expect(scarletWitchPackAfterAllyThwart(s, speed)).toEqual([]);
    expect(() => run(P("speed-ready", { id: speed.id }))).toThrow(
      /once-per-round/,
    );
    s.round++;
    expect(scarletWitchPackAfterAllyThwart(s, speed)).toHaveLength(1);
  });
  it("declining Speed never commits his limit", () => {
    const { s, play } = fixture();
    const speed = play("15010");
    speed.exhausted = true;
    const first = scarletWitchPackAfterAllyThwart(s, speed);
    expect(first).toHaveLength(1);
    expect(scarletWitchPackAfterAllyThwart(s, speed)).toEqual(first);
    expect(s.flags["scwPackSpeed:" + speed.id]).toBeUndefined();
  });
  it("ally responses and Speed's round limit belong to the current controller", () => {
    const { s, play } = fixture(true);
    const speed = play("15010", "p2");
    speed.exhausted = true;
    expect(scarletWitchPackAfterAllyThwart(s, speed)[0].actorId).toBe("p2");
    seatView(s, "p2").flags["scwPackSpeed:" + speed.id] = s.round;
    expect(scarletWitchPackAfterAllyThwart(s, speed)).toEqual([]);
    expect(s.flags["scwPackSpeed:" + speed.id]).toBeUndefined();
  });
  it("Speed cannot manufacture a response after leaving play", () => {
    const { s, play, run } = fixture();
    const speed = play("15010");
    speed.exhausted = true;
    s.player.inPlay = [];
    expect(scarletWitchPackAfterAllyThwart(s, speed)).toEqual([]);
    expect(() => run(P("speed-ready", { id: speed.id }))).toThrow(
      /unavailable/,
    );
  });
  it("Wiccan's optional response uses the actual physical encounter discard through the shared count window", () => {
    const { s, play, run, ports } = fixture();
    const wiccan = play("15011"),
      top = makePiece(s, "01188"),
      next = makePiece(s, "01186");
    s.encounter.deck = [top, next];
    s.encounter.discard = [];
    expect(scarletWitchPackAfterAllyThwart(s, wiccan)).toEqual([
      expect.objectContaining({
        type: "optional",
        title: "Wiccan",
        effects: [P("wiccan-count", { id: wiccan.id })],
      }),
    ]);
    run(P("wiccan-count", { id: wiccan.id }));
    expect(ports.discardEncounterTop).toHaveBeenCalledOnce();
    expect(s.encounter.deck).toEqual([next]);
    expect(s.encounter.discard).toEqual([top]);
    expect(s.queue).toEqual([
      expect.objectContaining({
        type: "scw:count-window",
        pieces: [top],
        sourceTitle: "Wiccan",
        after: [P("wiccan-damage", { id: wiccan.id })],
      }),
    ]);
  });
  it("Wiccan's count is still resumable when the physical encounter discard exhausts and recycles the deck", () => {
    const { s, play, run } = fixture();
    const wiccan = play("15011"),
      top = makePiece(s, "01188");
    s.encounter.deck = [top];
    s.encounter.discard = [];
    const before = s.encounter.acceleration;
    run(P("wiccan-count", { id: wiccan.id }));
    expect(s.encounter.acceleration).toBe(before + 1);
    expect(s.encounter.deck).toEqual([top]);
    const hydrated = JSON.parse(JSON.stringify(s));
    expect(hydrated.queue[0]).toMatchObject({
      type: "scw:count-window",
      pieces: [{ id: top.id }],
      after: [P("wiccan-damage", { id: wiccan.id })],
    });
  });
  it("Wiccan deals the effective count as nonattack damage and ignores a stale raw count", () => {
    const { s, run } = fixture();
    run(
      P("wiccan-damage", {
        id: "wiccan-copy",
        boostTotal: 4,
        boostCounts: [4],
        boost: 1,
      }),
    );
    expect(s.queue).toEqual([
      {
        type: "damage",
        target: s.villain.id,
        amount: 4,
        source: "wiccan-copy",
      },
    ]);
    expect(s.queue[0].attack).toBeUndefined();
  });
  it("Wiccan's zero effective count opens no unusable enemy choice", () => {
    const { s, run } = fixture();
    run(P("wiccan-damage", { id: "wiccan-copy", boostTotal: 0 }));
    expect(s.prompt).toBeNull();
    expect(s.queue).toEqual([]);
  });
  it("Crisis Averted ignores Crisis only for an actually paid mental resource", () => {
    const { s } = fixture();
    const p = makePiece(s, "15012");
    for (const paid of [[], ["physical"], ["energy"], ["wild"]])
      expect(scarletWitchPackEvent(s, p, paid as any)![0]).toMatchObject({
        target: "main",
        amount: 6,
        action: true,
        ignoreCrisis: false,
      });
    expect(scarletWitchPackEvent(s, p, ["mental"])).toEqual([
      {
        type: "thwart",
        target: "main",
        amount: 6,
        action: true,
        source: "hero",
        thwartInitiated: true,
        thwartStatusChecked: true,
        ignoreCrisis: true,
      },
    ]);
  });
  it("Crisis Averted keeps Patrol and main-scheme threat restrictions and can consume an initial confuse status", () => {
    const { s, ports, schemes } = fixture();
    const p = makePiece(s, "15012");
    schemes([]);
    expect(scarletWitchPackPlayRestriction(s, p, ports)).toMatch(
      /eligible main scheme/,
    );
    s.player.confused = true;
    expect(scarletWitchPackPlayRestriction(s, p, ports)).toBeNull();
  });
  it("Crisis Averted requires a feasible mental payment when only Crisis blocks the main scheme", () => {
    const { s, ports, schemes } = fixture();
    const p = makePiece(s, "15012");
    schemes([], [{ id: "main", label: "Main" }]);
    vi.mocked(ports.canPay).mockReturnValue(false);
    expect(scarletWitchPackPlayRestriction(s, p, ports)).toMatch(
      /mental resource/,
    );
    expect(ports.canPay).toHaveBeenCalledWith(s, 3, p.id, p.code, ["mental"]);
    vi.mocked(ports.canPay).mockReturnValue(true);
    expect(scarletWitchPackPlayRestriction(s, p, ports)).toBeNull();
  });
  it("Multitasking can target the second scheme only after the first native thwart and its aftermath", () => {
    const { s, run, choose, schemes } = fixture();
    schemes([{ id: "crisis-copy", label: "Crisis" }]);
    run(P("multitask", { mental: true, eventId: "event-copy" }));
    expect(s.queue).toEqual([
      P("multitask-first", {
        mental: true,
        eventId: "event-copy",
        target: "crisis-copy",
      }),
    ]);
    run(s.queue.shift()!);
    expect(s.queue).toEqual([
      {
        type: "thwart",
        target: "crisis-copy",
        amount: 2,
        action: true,
        source: "hero",
        thwartInitiated: true,
        thwartStatusChecked: true,
      },
      P("multitask-second", {
        firstTarget: "crisis-copy",
        eventId: "event-copy",
      }),
    ]);
    s.queue.shift();
    schemes([
      { id: "main", label: "Main" },
      { id: "other-copy", label: "Other" },
      { id: "crisis-copy", label: "Reentered copy" },
    ]);
    run(s.queue.shift()!);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["main", "other-copy"]);
    choose("main");
    expect(s.queue).toEqual([
      {
        type: "thwart",
        target: "main",
        amount: 2,
        action: true,
        source: "hero",
        thwartInitiated: true,
        thwartStatusChecked: true,
      },
    ]);
  });
  it("Multitasking with no paid mental resource creates exactly one thwart", () => {
    const { s, run } = fixture();
    const p = makePiece(s, "15013");
    expect(scarletWitchPackEvent(s, p, ["physical"])).toEqual([
      P("multitask", { eventId: p.id, mental: false }),
    ]);
    run(P("multitask-first", { target: "main", mental: false }));
    expect(s.queue).toHaveLength(1);
    expect(s.queue[0]).toMatchObject({
      type: "thwart",
      target: "main",
      amount: 2,
    });
  });
  it("Multitasking never removes threat twice from the same physical scheme", () => {
    const { s, run } = fixture();
    run(P("multitask-second", { firstTarget: "main" }));
    expect(s.queue).toEqual([]);
    expect(s.prompt).toBeNull();
  });
  it("Multitasking does not accept a stale illegal first target", () => {
    const { run } = fixture();
    expect(() =>
      run(P("multitask-first", { target: "gone-scheme", mental: true })),
    ).toThrow(/eligible first scheme/);
  });
  it("Swift Retribution schemes before its single already-initiated attack packet", () => {
    const { s } = fixture();
    expect(scarletWitchPackEvent(s, makePiece(s, "15014"))).toEqual([
      { type: "enemyScheme", id: s.villain.id },
      {
        type: "damage",
        target: s.villain.id,
        amount: 4,
        attack: true,
        source: "hero",
        attackInitiated: true,
      },
    ]);
  });
  it("Bait and Switch resolves the villain's complete attack before its initiated main-scheme thwart", () => {
    const { s } = fixture();
    expect(scarletWitchPackEvent(s, makePiece(s, "15030"))).toEqual([
      { type: "enemyAttack", id: s.villain.id },
      {
        type: "thwart",
        target: "main",
        amount: 4,
        action: true,
        source: "hero",
        thwartInitiated: true,
        thwartStatusChecked: true,
      },
    ]);
  });
  it("Bait and Switch may initiate its villain attack when the independent main-scheme removal is blocked", () => {
    const { s, ports, schemes } = fixture();
    schemes([]);
    expect(
      scarletWitchPackPlayRestriction(s, makePiece(s, "15030"), ports),
    ).toBeNull();
  });
  it("Bait and Switch distinguishes an engaged Patrol prohibition from Crisis or zero threat", () => {
    const { s, ports } = fixture(true);
    const patrol = makePiece(s, "16119");
    patrol.engagedWith = "p1";
    s.minions = [patrol];
    const event = makePiece(s, "15030");
    expect(scarletWitchPackPlayRestriction(s, event, ports)).toMatch(/Patrol/);
    patrol.engagedWith = "p2";
    expect(scarletWitchPackPlayRestriction(s, event, ports)).toBeNull();
    patrol.engagedWith = "p1";
    s.player.confused = true;
    expect(scarletWitchPackPlayRestriction(s, event, ports)).toBeNull();
  });
  it("Browbeat is one attack whose amount includes the capped villain stage bonus", () => {
    const { s } = fixture();
    for (const [stage, amount] of [
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 5],
    ]) {
      s.villain.stage = stage;
      expect(scarletWitchPackEvent(s, makePiece(s, "15028"))).toEqual([
        {
          type: "damage",
          target: s.villain.id,
          amount,
          attack: true,
          source: "hero",
          attackInitiated: true,
        },
      ]);
    }
  });
  it("Spiritual Meditation and Browbeat validate the actual identity's printed trait", () => {
    const { s, ports } = fixture();
    vi.mocked(ports.hasTrait).mockReturnValue(false);
    expect(
      scarletWitchPackPlayRestriction(s, makePiece(s, "15019"), ports),
    ).toMatch(/Mystic/);
    expect(
      scarletWitchPackPlayRestriction(s, makePiece(s, "15028"), ports),
    ).toMatch(/Avenger/);
    vi.mocked(ports.hasTrait).mockReturnValue(true);
    expect(
      scarletWitchPackPlayRestriction(s, makePiece(s, "15019"), ports),
    ).toBeNull();
  });
  it("Spiritual Meditation chooses a real current hand card after both draws", () => {
    const { s, run, choose, hand } = fixture();
    const event = makePiece(s, "15019");
    expect(scarletWitchPackEvent(s, event)).toEqual([
      { type: "draw", amount: 2 },
      P("meditation-discard"),
    ]);
    const [old, drawn] = hand("01088", "15004");
    run(P("meditation-discard"));
    expect(s.prompt!.options.map((o) => o.id)).toEqual([old.id, drawn.id]);
    choose(drawn.id);
    expect(s.queue).toEqual([{ type: "discardHand", id: drawn.id }]);
    expect(() =>
      run(P("meditation-discarded", { id: "invented-copy" })),
    ).toThrow(/physical card/);
  });
  it("an empty hand after Spiritual Meditation never leaves an empty blocking prompt", () => {
    const { s, run } = fixture();
    run(P("meditation-discard"));
    expect(s.prompt).toBeNull();
    expect(s.queue).toEqual([]);
  });
  it("Recuperation reads the current REC and heals without exhausting the alter ego", () => {
    const { s, run, ports } = fixture();
    s.player.form = "alter";
    s.player.exhausted = false;
    const event = makePiece(s, "15031");
    expect(scarletWitchPackEvent(s, event)).toEqual([P("recuperation")]);
    run(P("recuperation"));
    expect(ports.heroREC).toHaveBeenCalledWith(s);
    expect(s.queue).toEqual([{ type: "heal", target: "hero", amount: 5 }]);
    expect(s.player.exhausted).toBe(false);
  });
  it("Turn the Tide qualifies only when this hero's actual thwart removes all positive threat", () => {
    const { s, ports, hand } = fixture();
    const [event] = hand("15015");
    const snapshot: ScarletWitchPackThwartSnapshot = {
      scheme: "actual-side",
      beforeThreat: 2,
      removed: 2,
      playerId: "p1",
    };
    expect(
      scarletWitchPackAfterHeroThwart(s, snapshot, [], ports).map((o) => o.id),
    ).toEqual([event.id]);
    for (const change of [
      { removed: 1 },
      { removed: 0, beforeThreat: 0 },
      { playerId: "p2" },
    ])
      expect(
        scarletWitchPackAfterHeroThwart(
          s,
          { ...snapshot, ...change },
          [],
          ports,
        ),
      ).toEqual([]);
  });
  it("Turn the Tide's physical event and continuation survive serialization and repeat responses", () => {
    const { s, ports, hand, run } = fixture();
    const [event] = hand("15015");
    const snapshot = { scheme: "main", beforeThreat: 2, removed: 2 },
      after = [{ type: "done" }];
    const [choice] = scarletWitchPackAfterHeroThwart(s, snapshot, after, ports);
    run(JSON.parse(JSON.stringify(choice.effects[0])));
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      piece: event,
      cost: 0,
      cancelable: false,
    });
    const paid = s.queue.shift()!.after[0];
    run(paid);
    expect(s.queue[0]).toMatchObject({
      type: "resolveHandEvent",
      id: event.id,
      after: [
        {
          type: "target",
          attack: true,
          action: { type: "damage", amount: 3, attack: true, source: "hero" },
        },
      ],
      continuation: [P("tide-window", { snapshot, continuation: after })],
    });
  });
  it("Turn the Tide keeps an actual hero-thwart trigger after a forced response changes that identity to alter ego", () => {
    const { s, ports, hand } = fixture();
    const [event] = hand("15015");
    s.player.form = "alter";
    const snapshot = {
      scheme: "actual-side",
      beforeThreat: 2,
      removed: 2,
      wasHero: true,
    };
    expect(
      scarletWitchPackAfterHeroThwart(s, snapshot, [], ports).map((o) => o.id),
    ).toEqual([event.id]);
    expect(
      scarletWitchPackAfterHeroThwart(
        s,
        { ...snapshot, wasHero: false },
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it("Turn the Tide's response window passes into the original continuation exactly once", () => {
    const { s, hand, run, choose } = fixture();
    hand("15015");
    run(
      P("tide-window", {
        snapshot: { scheme: "main", beforeThreat: 2, removed: 2 },
        continuation: [{ type: "done" }],
      }),
    );
    choose("pass");
    expect(s.queue).toEqual([{ type: "done" }]);
  });
  it("Last Stand accepts only attacks by controlled allies while their controller is a hero", () => {
    const { s, ports, play, hand } = fixture(true);
    hand("15029");
    const mine = play("15011"),
      other = play("15010", "p2");
    expect(scarletWitchPackAllyAttackOptions(s, mine, [], ports)).toHaveLength(
      1,
    );
    expect(scarletWitchPackAllyAttackOptions(s, other, [], ports)).toEqual([]);
    mine.stunned = true;
    expect(scarletWitchPackAllyAttackOptions(s, mine, [], ports)).toEqual([]);
    mine.stunned = false;
    s.player.form = "alter";
    expect(scarletWitchPackAllyAttackOptions(s, mine, [], ports)).toEqual([]);
  });
  it("Last Stand consumes the actual event before applying a single-attack bonus and reopens remaining interrupts", () => {
    const { s, ports, play, hand, run } = fixture();
    const ally = play("15011"),
      [event] = hand("15029");
    const after = [
      { type: "allyAction", id: ally.id, kind: "attack", target: s.villain.id },
    ];
    run(scarletWitchPackAllyAttackOptions(s, ally, after, ports)[0].effects[0]);
    const pay = s.queue.shift()!;
    expect(pay).toMatchObject({ type: "payRequest", piece: event, cost: 0 });
    run(pay.after[0]);
    expect(s.queue[0]).toMatchObject({
      type: "resolveHandEvent",
      id: event.id,
      after: [P("last-bonus", { id: ally.id, paid: [] })],
      continuation: [P("last-window", { id: ally.id, continuation: after })],
    });
  });
  it("Last Stand copies stack for just this attack and never mutate the ally's persistent ATK", () => {
    const { s, play, run } = fixture();
    const ally = play("15011");
    run(P("last-bonus", { id: ally.id }));
    run(P("last-bonus", { id: ally.id }));
    expect(scarletWitchPackAllyAttackBonus(s, ally)).toBe(6);
    expect(ally.bonusAtk || 0).toBe(0);
    expect(scarletWitchPackAfterAllyAttack(s, ally)).toEqual([
      P("last-finish", { id: ally.id, actualAttack: true }),
    ]);
  });
  it("Last Stand discards a surviving physical ally once after the full attack, into its owner's zone", () => {
    const { s, play, run, ports } = fixture();
    const ally = play("15011");
    run(P("last-bonus", { id: ally.id }));
    run(scarletWitchPackAfterAllyAttack(s, ally)[0]);
    expect(ports.discardPiece).toHaveBeenCalledWith(s, ally.id);
    expect(allInPlay(s)).not.toContain(ally);
    expect(s.player.discard).toEqual([ally]);
    expect(scarletWitchPackAllyAttackBonus(s, ally)).toBe(0);
    expect(scarletWitchPackAfterAllyAttack(s, ally)).toEqual([]);
  });
  it("Last Stand does not discard an ally twice when consequential damage already defeated it", () => {
    const { s, play, run, ports } = fixture();
    const ally = play("15011");
    run(P("last-bonus", { id: ally.id }));
    s.player.inPlay.splice(s.player.inPlay.indexOf(ally), 1);
    s.player.discard.push(ally);
    run(scarletWitchPackAfterAllyAttack(s, ally.id)[0]);
    expect(ports.discardPiece).not.toHaveBeenCalled();
    expect(s.player.discard).toEqual([ally]);
    expect(scarletWitchPackAllyAttackBonus(s, ally.id)).toBe(0);
  });
  it("Last Stand's discard follows the physical ally's ownership when its controller differs", () => {
    const { s, play, run } = fixture(true);
    const ally = play("15011");
    ally.ownerId = "p2";
    run(P("last-bonus", { id: ally.id }));
    run(scarletWitchPackAfterAllyAttack(s, ally)[0]);
    expect(s.player.discard).toEqual([]);
    expect(seatView(s, "p2").player.discard).toEqual([ally]);
  });
  it("an attack replaced by a new stun clears Last Stand's bonus without discarding the ally", () => {
    const { s, play, run, ports } = fixture();
    const ally = play("15011");
    run(P("last-bonus", { id: ally.id }));
    run(scarletWitchPackAfterAllyAttack(s, ally, false)[0]);
    expect(ports.discardPiece).not.toHaveBeenCalled();
    expect(s.player.inPlay).toContain(ally);
    expect(scarletWitchPackAllyAttackBonus(s, ally)).toBe(0);
  });
});
