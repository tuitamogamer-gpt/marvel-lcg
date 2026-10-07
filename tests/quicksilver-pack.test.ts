import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card, maxHP } from "../src/game/cards";
import { allInPlay, controller, playerOrder, seatView } from "../src/game/team";
import { compileCardScript } from "../src/game/scripts/compiler";
import {
  QUICKSILVER_PACK_CORE_ALIASES,
  QUICKSILVER_PACK_SCRIPT_CODES,
  quicksilverPackResourceSources,
  quicksilverPackHeroStatBonus,
  quicksilverPackBasicPiercing,
  quicksilverPackAfterBasicAttack,
  quicksilverPackPhaseEnded,
  quicksilverPackCardEntered,
  quicksilverPackPlayRestriction,
  quicksilverPackAllyEnter,
  quicksilverPackEvent,
  quicksilverPackAbilityOptions,
  quicksilverPackAbility,
  quicksilverPackDefenseOptions,
  quicksilverPackAfterDefense,
  quicksilverPackDamageOptions,
  quicksilverPackEncounterOptions,
  resolveQuicksilverPackEffect,
  type QuicksilverPackPorts,
  type QuicksilverPackDefenseSnapshot,
} from "../src/game/quicksilver-pack";
import type { Effect, GameState, Piece } from "../src/game/types";

function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "protection",
    seed: 1412,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "protection" as const },
            { heroId: "captain_marvel", aspect: "leadership" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.player.form = "hero";
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.minions = [];
  s.sideSchemes = [];
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.inPlay = [];
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
  }
  const ports: QuicksilverPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    discardPiece: vi.fn((state: GameState, id: string) => {
      const seat = controller(state, id);
      if (!seat) return;
      const view = seatView(state, seat),
        index = view.player.inPlay.findIndex((p) => p.id === id);
      view.player.discard.push(...view.player.inPlay.splice(index, 1));
    }),
    hasTrait: (_, target, trait) => target === "hero" && trait === "Avenger",
    friendlyTargets: (state) =>
      playerOrder(state).flatMap((seat) => [
        {
          id: seat.id === state.activePlayerId ? "hero" : "hero:" + seat.id,
          label: seat.heroId,
        },
        ...seatView(state, seat)
          .player.inPlay.filter((p) => card(p).type_code === "ally")
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
      ]),
    maxHeroHP: (state, id) => maxHP(seatView(state, id)),
    cardCost: (_, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    shufflePlayerDeck: vi.fn(),
    revealHidden: vi.fn(),
    putAllyIntoPlay: vi.fn(
      (state: GameState, p: Piece, beforeResponses: Effect[] = []) => {
        state.player.inPlay.push(p);
        state.queue.unshift(
          ...beforeResponses,
          ...(quicksilverPackAllyEnter(state, p) || []),
        );
      },
    ),
    damageDistribution: vi.fn(),
    preventDamage: vi.fn(),
    transferControl: vi.fn((state: GameState, id: string, playerId: string) => {
      const seat = controller(state, id)!;
      const view = seatView(state, seat),
        index = view.player.inPlay.findIndex((p) => p.id === id);
      const p = view.player.inPlay.splice(index, 1)[0];
      seatView(state, playerId).player.inPlay.push(p);
    }),
    cancelWhenRevealed: vi.fn(),
  };
  const run = (effect: Effect) =>
    resolveQuicksilverPackEffect(s, effect, ports);
  const choose = (id: string) => {
    const o = s.prompt!.options.find((p) => p.id === id);
    if (!o) throw Error("Unknown fixture option " + id);
    s.prompt = null;
    for (const e of o.effects) {
      if (!run(e)) s.queue.push(e);
    }
  };
  const play = (code: string, seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = s.activePlayerId;
    seatView(s, seatId).player.inPlay.push(p);
    return p;
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((c) => makePiece(s, c));
    return [...s.player.hand];
  };
  const minion = (playerId = s.activePlayerId) => {
    const p = makePiece(s, "01100");
    p.engagedWith = playerId;
    s.minions.push(p);
    return p;
  };
  const attack = () => {
    s.attack = {
      attacker: s.villain.id,
      base: 4,
      boostCodes: [],
      boostEffects: [],
      defense: 1,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
      defender: "hero",
      targetPlayerId: s.activePlayerId,
      basicDefense: true,
    };
  };
  return { s, ports, run, choose, play, hand, minion, attack };
}
const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "quicksilver-pack:" + type,
  ...args,
});

describe("Quicksilver Hero Pack supplementary cards", () => {
  it("covers the sixteen supplementary printings with twelve native rules and four exact Core reprints", () => {
    expect(QUICKSILVER_PACK_SCRIPT_CODES).toHaveLength(12);
    expect(QUICKSILVER_PACK_CORE_ALIASES).toEqual([
      "14016",
      "14019",
      "14020",
      "14021",
    ]);
    expect(
      new Set([
        ...QUICKSILVER_PACK_SCRIPT_CODES,
        ...QUICKSILVER_PACK_CORE_ALIASES,
      ]).size,
    ).toBe(16);
    for (const code of QUICKSILVER_PACK_CORE_ALIASES)
      expect(compileCardScript(card(code))).toMatchObject({
        status: "supported",
        implementation: "core",
      });
    for (const code of QUICKSILVER_PACK_SCRIPT_CODES)
      expect(compileCardScript(card(code)).status).toBe("unsupported");
  });

  it("Multiple Man's optional response belongs to its controller and also fires for put-into-play entry", () => {
    const { s, play } = fixture(true);
    const p = play("14012", "p2");
    expect(quicksilverPackAllyEnter(s, p)).toEqual([
      expect.objectContaining({
        type: "optional",
        actorId: "p2",
        title: "Multiple Man",
        effects: [P("multiple-search", { id: p.id })],
      }),
    ]);
    expect(quicksilverPackAllyEnter(s, play("14013"))).toEqual([]);
    expect(quicksilverPackAllyEnter(s, play("01084"))).toBeNull();
  });

  it("a hand-only search moves the same physical copy into play and never touches or shuffles the deck", () => {
    const { s, run, choose, hand, ports, play } = fixture();
    const first = play("14012"),
      [second] = hand("14012");
    const third = makePiece(s, "14012");
    s.player.deck = [third];
    run(P("multiple-search", { id: first.id }));
    choose("hand");
    expect(s.prompt!.options.map((o) => o.id)).toEqual([second.id, "fail"]);
    choose(second.id);
    expect(s.player.inPlay).toContain(second);
    expect(s.player.hand).toEqual([]);
    expect(s.player.deck).toEqual([third]);
    expect(ports.revealHidden).not.toHaveBeenCalled();
    expect(ports.shufflePlayerDeck).not.toHaveBeenCalled();
    expect(s.queue).toEqual([
      expect.objectContaining({ type: "optional", title: "Multiple Man" }),
    ]);
  });

  it("searching the deck exposes its information and shuffles after the actual copy enters with another response", () => {
    const { s, run, choose, ports } = fixture();
    const copy = makePiece(s, "14012");
    s.player.deck = [copy];
    run(P("multiple-find", { searchDeck: true }));
    expect(ports.revealHidden).toHaveBeenCalledOnce();
    choose(copy.id);
    expect(s.player.deck).toEqual([]);
    expect(ports.putAllyIntoPlay).toHaveBeenCalledWith(s, copy, [
      P("multiple-shuffle"),
    ]);
    expect(s.queue).toEqual([
      P("multiple-shuffle"),
      expect.objectContaining({ type: "optional" }),
    ]);
    run(s.queue.shift()!);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });

  it("a hidden search may fail with eligible copies present and still shuffles if the deck was searched", () => {
    const { s, run, choose, ports } = fixture();
    const copy = makePiece(s, "14012");
    s.player.deck = [copy];
    run(P("multiple-find", { searchDeck: true }));
    choose("fail");
    expect(s.player.deck).toEqual([copy]);
    expect(s.player.inPlay).toEqual([]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });

  it("declining both searched locations changes no physical cards or hidden information", () => {
    const { s, run, choose, ports } = fixture();
    run(P("multiple-search"));
    choose("decline");
    expect(s.queue).toEqual([]);
    expect(ports.revealHidden).not.toHaveBeenCalled();
    expect(ports.shufflePlayerDeck).not.toHaveBeenCalled();
  });

  it("Multiple Man refuses to take an unsearched deck copy", () => {
    const { s, run } = fixture();
    const copy = makePiece(s, "14012");
    s.player.deck = [copy];
    expect(() =>
      run(P("multiple-put", { id: copy.id, searchDeck: false })),
    ).toThrow(/searched location/);
    expect(s.player.deck).toEqual([copy]);
  });

  it("Warlock pays a mental resource without exhausting, in either identity form", () => {
    const { s, play, ports } = fixture();
    const warlock = play("14013");
    warlock.damage = 3;
    warlock.exhausted = true;
    s.player.form = "alter";
    expect(
      quicksilverPackAbilityOptions(s, warlock.id, ports).map((o) => o.id),
    ).toEqual(["heal"]);
    expect(quicksilverPackAbility(s, warlock.id, ports, "attack")).toBe(false);
    expect(quicksilverPackAbility(s, warlock.id, ports, "thwart")).toBe(false);
    expect(quicksilverPackAbility(s, warlock.id, ports, "heal")).toBe(true);
    resolveQuicksilverPackEffect(s, s.queue.shift()!, ports);
    expect(s.queue).toEqual([
      expect.objectContaining({
        type: "payRequest",
        title: "Warlock",
        cost: 1,
        requirements: ["mental"],
        paymentTarget: "14013",
        after: [{ type: "heal", target: warlock.id, amount: 2 }],
      }),
    ]);
    expect(warlock.exhausted).toBe(true);
    expect(warlock.damage).toBe(3);
  });

  it("Warlock cannot initiate healing with no damage or no typed payment", () => {
    const { s, play, ports } = fixture();
    const warlock = play("14013");
    expect(quicksilverPackAbilityOptions(s, warlock.id, ports)).toEqual([]);
    warlock.damage = 1;
    vi.mocked(ports.canPay).mockReturnValue(false);
    expect(quicksilverPackAbilityOptions(s, warlock.id, ports)).toEqual([]);
    expect(() => quicksilverPackAbility(s, warlock.id, ports, "heal")).toThrow(
      /unavailable/,
    );
  });

  it("Nerves of Steel and Sense of Justice generate only for matching event traits", () => {
    const { s, play } = fixture();
    const nerves = play("14017"),
      sense = play("14030");
    expect(quicksilverPackResourceSources(s, "14014")).toEqual([
      expect.objectContaining({
        id: nerves.id,
        resources: ["energy"],
        kind: "ability",
      }),
    ]);
    expect(quicksilverPackResourceSources(s, "01060")).toEqual([
      expect.objectContaining({ id: sense.id, resources: ["mental"] }),
    ]);
    expect(quicksilverPackResourceSources(s, "14015").map((p) => p.id)).toEqual(
      [nerves.id],
    );
    for (const target of [undefined, "14013", "14032", "14018", "14031"])
      expect(quicksilverPackResourceSources(s, target)).toEqual([]);
    nerves.exhausted = true;
    sense.exhausted = true;
    expect(quicksilverPackResourceSources(s, "14014")).toEqual([]);
    expect(quicksilverPackResourceSources(s, "01060")).toEqual([]);
  });

  it("restricted resource abilities operate in alter-ego form and remain controller-specific", () => {
    const { s, play } = fixture(true);
    const own = play("14030"),
      teammate = play("14017", "p2");
    s.player.form = "alter";
    expect(quicksilverPackResourceSources(s, "01060").map((p) => p.id)).toEqual(
      [own.id],
    );
    expect(quicksilverPackResourceSources(s, "14014")).toEqual([]);
    expect(
      quicksilverPackResourceSources(seatView(s, "p2"), "14014").map(
        (p) => p.id,
      ),
    ).toEqual([teammate.id]);
  });

  it("resource upgrades may enter under any eligible player's control while retaining their physical owner", () => {
    const { s, play, run, choose, ports } = fixture(true);
    const nerves = play("14017");
    expect(quicksilverPackCardEntered(s, nerves)).toEqual([
      P("control", { id: nerves.id }),
    ]);
    run(P("control", { id: nerves.id }));
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    choose("p2");
    expect(seatView(s, "p2").player.inPlay).toContain(nerves);
    expect(nerves.ownerId).toBe("p1");
    expect(ports.transferControl).toHaveBeenCalledWith(s, nerves.id, "p2");
  });

  it("one-per-player limits permit another teammate but reject a fully occupied table", () => {
    const { s, play, hand, run, ports } = fixture(true);
    play("14017");
    const [second] = hand("14017");
    expect(quicksilverPackPlayRestriction(s, second, ports)).toBeNull();
    play("14017", "p2");
    expect(quicksilverPackPlayRestriction(s, second, ports)).toContain(
      "1 per player",
    );
    expect(() =>
      run(P("controlled", { id: s.player.inPlay[0].id, playerId: "p2" })),
    ).toThrow(/already controls/);
  });

  it("Adrenaline Rush and Civic Duty discard as costs, stack and expire at the phase boundary", () => {
    const { s, play, run, ports } = fixture();
    const a = play("14022"),
      b = play("14022"),
      civic = play("14023");
    a.exhausted = true;
    for (const p of [a, b, civic])
      run(quicksilverPackAbilityOptions(s, p.id, ports)[0].effects[0]);
    expect(s.player.inPlay).toEqual([]);
    expect(s.player.discard).toEqual([a, b, civic]);
    expect(quicksilverPackHeroStatBonus(s, "attack")).toBe(2);
    expect(quicksilverPackHeroStatBonus(s, "thwart")).toBe(1);
    expect(quicksilverPackHeroStatBonus(s, "defense")).toBe(0);
    s.player.form = "alter";
    expect(quicksilverPackHeroStatBonus(s, "attack")).toBe(0);
    quicksilverPackPhaseEnded(s);
    s.player.form = "hero";
    expect(quicksilverPackHeroStatBonus(s, "attack")).toBe(0);
    expect(quicksilverPackHeroStatBonus(s, "thwart")).toBe(0);
  });

  it("phase upgrades reject their hero action in alter-ego form and reject a consumed physical source", () => {
    const { s, play, run, ports } = fixture();
    const a = play("14022");
    s.player.form = "alter";
    expect(quicksilverPackAbilityOptions(s, a.id, ports)).toEqual([]);
    expect(() => run(P("phase-bonus", { id: a.id }))).toThrow(/unavailable/);
    s.player.form = "hero";
    run(P("phase-bonus", { id: a.id }));
    expect(() => run(P("phase-bonus", { id: a.id }))).toThrow(/unavailable/);
  });

  it("Brute Force stacks static attack, gives piercing only to basic attacks and forces every active copy's discard afterward", () => {
    const { s, play } = fixture();
    const a = play("14029"),
      b = play("14029");
    expect(quicksilverPackHeroStatBonus(s, "attack")).toBe(2);
    expect(quicksilverPackBasicPiercing(s)).toBe(true);
    expect(quicksilverPackAfterBasicAttack(s)).toEqual([
      { type: "discardPiece", id: a.id },
      { type: "discardPiece", id: b.id },
    ]);
    s.player.form = "alter";
    expect(quicksilverPackBasicPiercing(s)).toBe(false);
    expect(quicksilverPackHeroStatBonus(s, "attack")).toBe(0);
  });

  it("Never Back Down opens for your hero defending with a basic power or a defense event, with an affordable physical hand card", () => {
    const { s, hand, attack, ports } = fixture(true);
    const [never] = hand("14014");
    attack();
    expect(
      quicksilverPackDefenseOptions(s, [], ports).map((o) => o.id),
    ).toEqual([never.id]);
    s.attack!.basicDefense = false;
    expect(
      quicksilverPackDefenseOptions(s, [], ports).map((o) => o.id),
    ).toEqual([never.id]);
    s.attack!.defender = "none";
    expect(quicksilverPackDefenseOptions(s, [], ports)).toEqual([]);
    s.attack!.defender = "hero";
    s.attack!.basicDefense = true;
    s.attack!.targetPlayerId = "p2";
    expect(quicksilverPackDefenseOptions(s, [], ports)).toEqual([]);
    s.attack!.targetPlayerId = "p1";
    s.player.form = "alter";
    expect(quicksilverPackDefenseOptions(s, [], ports)).toEqual([]);
    s.player.form = "hero";
    vi.mocked(ports.canPay).mockReturnValue(false);
    expect(quicksilverPackDefenseOptions(s, [], ports)).toEqual([]);
  });

  it("Never Back Down commits paid events and stacks defense bonuses on the current attack", () => {
    const { s, hand, attack, run } = fixture();
    const [never] = hand("14014");
    attack();
    run(P("never-pay", { id: never.id, after: [{ type: "boostAttack" }] }));
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cancelable: false,
      piece: never,
      after: [
        P("event-paid", {
          id: never.id,
          effects: [P("never-bonus")],
          continuation: [{ type: "boostAttack" }],
        }),
      ],
    });
    run(P("never-bonus"));
    run(P("never-bonus"));
    expect(s.attack!.defenseBonus).toBe(4);
    expect(
      (s.attack as typeof s.attack & { neverBackDownCount: number })
        .neverBackDownCount,
    ).toBe(2);
  });

  it("Never Back Down stuns only a matching surviving attacker after zero attack-step identity damage", () => {
    const { s, minion } = fixture();
    const enemy = minion();
    const snapshot: QuicksilverPackDefenseSnapshot = {
      attacker: enemy.id,
      attackerCode: enemy.code,
      isVillain: false,
      playerId: "p1",
      heroDefended: true,
      heroDamage: 0,
      neverBackDownCount: 1,
    };
    expect(quicksilverPackAfterDefense(s, snapshot)).toEqual([
      { type: "status", target: enemy.id, status: "stunned" },
    ]);
    for (const update of [
      { heroDamage: 1 },
      { heroDefended: false },
      { playerId: "p2" },
      { neverBackDownCount: 0 },
      { attackerCode: "01101" },
    ])
      expect(
        quicksilverPackAfterDefense(s, { ...snapshot, ...update }),
      ).toEqual([]);
    s.minions = [];
    expect(quicksilverPackAfterDefense(s, snapshot)).toEqual([]);
  });

  it("Never Back Down still stuns the same villain after stage advancement, and does not transfer its stun to another villain", () => {
    const { s } = fixture();
    const snapshot: QuicksilverPackDefenseSnapshot = {
      attacker: s.villain.id,
      attackerCode: s.villain.code,
      attackerStage: s.villain.stage,
      isVillain: true,
      playerId: "p1",
      heroDefended: true,
      heroDamage: 0,
      neverBackDownCount: 1,
    };
    expect(quicksilverPackAfterDefense(s, snapshot)).toHaveLength(1);
    s.villain.stage++;
    s.villain.code = "01095";
    expect(quicksilverPackAfterDefense(s, snapshot)).toHaveLength(1);
    s.villain.code = "01114";
    expect(quicksilverPackAfterDefense(s, snapshot)).toEqual([]);
  });

  it("Side Step offers only positive damage to your own hero and yields to Tough", () => {
    const { s, hand, ports } = fixture(true);
    const [side] = hand("14015"),
      window = { target: "hero", amount: 3, playerId: "p1" };
    expect(
      quicksilverPackDamageOptions(s, window, [], ports).map((o) => o.id),
    ).toEqual([side.id]);
    for (const update of [
      { amount: 0 },
      { target: "hero:p2" },
      { playerId: "p2" },
      { target: "ally" },
    ])
      expect(
        quicksilverPackDamageOptions(s, { ...window, ...update }, [], ports),
      ).toEqual([]);
    s.player.tough = true;
    expect(quicksilverPackDamageOptions(s, window, [], ports)).toEqual([]);
    s.player.tough = false;
    s.player.form = "alter";
    expect(quicksilverPackDamageOptions(s, window, [], ports)).toEqual([]);
  });

  it("Side Step preserves actual allocated energy through the paid event lifecycle before preventing and reflecting", () => {
    const { s, hand, run, ports, minion } = fixture();
    const [side] = hand("14015"),
      enemy = minion();
    const packet = {
      type: "damage",
      target: "hero",
      amount: 4,
      source: enemy.id,
      damageWindowId: "incoming",
    };
    const window = { target: "hero", amount: 4, source: enemy.id, packet };
    run(P("side-pay", { id: side.id, window, after: [packet] }));
    const payment = s.queue.shift()!;
    run({ ...payment.after[0], paid: ["energy"] });
    const resolveEvent = s.queue.shift()!;
    expect(resolveEvent.type).toBe("resolveHandEvent");
    expect(resolveEvent.continuation).toEqual([packet]);
    run(resolveEvent.after[0]);
    expect(ports.preventDamage).toHaveBeenCalledWith(s, 3, packet);
    expect(s.queue).toEqual([
      { type: "damage", target: enemy.id, amount: 1, source: "hero" },
    ]);
    expect(s.queue[0].attack).toBeUndefined();
  });

  it("Side Step prevents direct and ally-overkill packets but never invents a source enemy", () => {
    const { s, run, ports } = fixture();
    run(
      P("side", {
        window: {
          target: "hero",
          amount: 3,
          packet: { type: "damage", kind: "overkill" },
          source: s.villain.id,
        },
        paid: ["energy"],
      }),
    );
    expect(ports.preventDamage).toHaveBeenCalledWith(s, 3, {
      type: "damage",
      kind: "overkill",
    });
    expect(s.queue[0]).toMatchObject({ target: s.villain.id, amount: 1 });
    s.queue = [];
    run(P("side", { window: { target: "hero", amount: 3 }, paid: ["energy"] }));
    expect(s.queue).toEqual([]);
    run(
      P("side", {
        window: { target: "hero", amount: 3, source: s.villain.id },
        paid: ["mental"],
      }),
    );
    expect(s.queue).toEqual([]);
  });

  it("Order and Chaos requires both named characters, hero form, actual encounter-deck provenance and a treachery", () => {
    const { s, hand, play, ports } = fixture();
    s.heroId = "qsv";
    s.players[0].heroId = "qsv";
    const [order] = hand("14018"),
      treachery = makePiece(s, "14028");
    expect(
      quicksilverPackEncounterOptions(s, treachery, true, [], ports),
    ).toEqual([]);
    play("14002");
    expect(
      quicksilverPackEncounterOptions(s, treachery, true, [], ports).map(
        (o) => o.id,
      ),
    ).toEqual([order.id]);
    expect(
      quicksilverPackEncounterOptions(s, treachery, false, [], ports),
    ).toEqual([]);
    expect(
      quicksilverPackEncounterOptions(
        s,
        makePiece(s, "34031"),
        true,
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      quicksilverPackEncounterOptions(
        s,
        makePiece(s, "14026"),
        true,
        [],
        ports,
      ),
    ).toEqual([]);
    s.player.form = "alter";
    expect(
      quicksilverPackEncounterOptions(s, treachery, true, [], ports),
    ).toEqual([]);
    s.player.form = "hero";
    s.heroId = "spider_man";
    expect(
      quicksilverPackEncounterOptions(s, treachery, true, [], ports),
    ).toEqual([]);
  });

  it("Order and Chaos cancels only When Revealed text and resumes physical keyword resolution after non-attack damage", () => {
    const { s, hand, play, run, ports } = fixture();
    s.heroId = "qsv";
    s.players[0].heroId = "qsv";
    const [order] = hand("14018");
    play("14002");
    const p = makePiece(s, "14028"),
      after = [{ type: "reveal", piece: p, skip: true }];
    run(P("order-pay", { id: order.id, piece: p, fromDeck: true, after }));
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      piece: order,
      cancelable: false,
    });
    run(P("order", { piece: p, after }));
    expect(ports.cancelWhenRevealed).toHaveBeenCalledWith(s, p, [
      { type: "damage", target: s.villain.id, amount: 2, source: "hero" },
      ...after,
    ]);
  });

  it("United We Stand heals different friendly characters across teammates, with a stage cap of three", () => {
    const { s, play, run, choose } = fixture(true);
    s.villain.stage = 4;
    s.player.hp -= 2;
    seatView(s, "p2").player.hp -= 1;
    const ally = play("14013", "p2");
    ally.damage = 2;
    const limit = quicksilverPackEvent(s, makePiece(s, "14031"))![0];
    expect(limit.limit).toBe(3);
    run(limit);
    choose("hero");
    expect(s.prompt!.options.some((o) => o.id === "hero")).toBe(false);
    choose("hero:p2");
    choose(ally.id);
    run(s.queue.shift()!);
    expect(s.queue).toEqual([
      { type: "heal", target: "hero", amount: 1 },
      { type: "heal", target: "hero:p2", amount: 1 },
      { type: "heal", target: ally.id, amount: 1 },
    ]);
  });

  it("United We Stand may heal fewer targets, requires an Avenger, and rejects duplicates", () => {
    const { s, run, choose, ports } = fixture();
    const cardInHand = makePiece(s, "14031");
    expect(quicksilverPackPlayRestriction(s, cardInHand, ports)).toContain(
      "damaged",
    );
    s.player.hp--;
    expect(quicksilverPackPlayRestriction(s, cardInHand, ports)).toBeNull();
    ports.hasTrait = () => false;
    expect(quicksilverPackPlayRestriction(s, cardInHand, ports)).toContain(
      "Avenger",
    );
    run(P("united", { limit: 3, selected: [] }));
    choose("finish");
    expect(s.queue).toEqual([]);
    expect(() =>
      run(P("united-finish", { selected: ["hero", "hero"] })),
    ).toThrow(/distinct/);
  });

  it("United We Stand uses native maximum health after upgrades when checking hero damage", () => {
    const { s, play, run, ports } = fixture();
    play("01039");
    expect(s.player.hp).toBeLessThan(maxHP(s));
    expect(
      quicksilverPackPlayRestriction(s, makePiece(s, "14031"), ports),
    ).toBeNull();
    run(P("united", { limit: 1, selected: [] }));
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["hero", "finish"]);
  });

  it("Beat 'Em Up snapshots all your engaged enemies for simultaneous non-attack damage", () => {
    const { s, minion, run, ports } = fixture(true);
    const own = minion(),
      teammate = minion("p2"),
      legacy = minion();
    delete legacy.engagedWith;
    run(quicksilverPackEvent(s, makePiece(s, "14032"))![0]);
    expect(ports.damageDistribution).toHaveBeenCalledWith(
      s,
      [
        { target: s.villain.id, amount: 1 },
        { target: own.id, amount: 1 },
        { target: legacy.id, amount: 1 },
      ],
      { source: "hero" },
    );
    expect(
      vi
        .mocked(ports.damageDistribution)
        .mock.calls[0][1].some((p) => p.target === teammate.id),
    ).toBe(false);
  });

  it("reaction cards are unavailable as ordinary actions and unrelated effects remain host-owned", () => {
    const { s, run, ports } = fixture();
    for (const code of ["14014", "14015", "14018"])
      expect(
        quicksilverPackPlayRestriction(s, makePiece(s, code), ports),
      ).toContain("interrupt window");
    expect(run({ type: "heal", target: "hero", amount: 1 })).toBe(false);
    expect(quicksilverPackEvent(s, makePiece(s, "01059"))).toBeNull();
    expect(() => run(P("unknown"))).toThrow(/Unknown Quicksilver/);
  });
});
