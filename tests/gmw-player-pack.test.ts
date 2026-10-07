import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { allInPlay, controller, seatView } from "../src/game/team";
import * as pack from "../src/game/gmw-player-pack";
import type { Effect, GameState, Piece } from "../src/game/types";

const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "gmw-pack:" + type,
  ...args,
});
function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "protection",
    seed: 1624,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "protection" as const },
            { heroId: "captain_marvel", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  s.phase = "player";
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.inPlay = [];
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
  }
  s.scheme.threat = 5;
  const ports: pack.GmwPlayerPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    discardPiece: vi.fn((state: GameState, id: string) => {
      const seat = controller(state, id);
      if (!seat) return;
      const zone = seatView(state, seat).player.inPlay;
      const [p] = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      );
      seatView(state, p.ownerId || seat.id).player.discard.push(p);
    }),
    hasTrait: vi.fn(() => true),
    cardCost: (_s, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    minionTargets: (state) =>
      state.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    enemyTargets: (state) => [{ id: state.villain.id, label: "Rhino" }],
    startingHeroHP: vi.fn(() => 10),
    allyMaxHP: (_s, p) => card(p).health || 0,
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
    putMinion: vi.fn((state: GameState, p: Piece, playerId: string) => {
      state.encounter.discard = state.encounter.discard.filter(
        (x) => x.id !== p.id,
      );
      state.encounter.deck = state.encounter.deck.filter((x) => x.id !== p.id);
      p.engagedWith = playerId;
      state.minions.push(p);
    }),
    discardPlayerTop: vi.fn((state) => {
      const piece = state.player.deck.shift();
      if (piece) state.player.discard.push(piece);
      return piece;
    }),
    preventDamage: vi.fn(),
    returnAllyToHand: vi.fn((state: GameState, id: string) => {
      const seat = controller(state, id)!;
      const view = seatView(state, seat);
      const [p] = view.player.inPlay.splice(
        view.player.inPlay.findIndex((p) => p.id === id),
        1,
      );
      p.damage = 0;
      p.exhausted = false;
      p.counters = 0;
      p.tough = p.stunned = p.confused = false;
      seatView(state, p.ownerId || seat.id).player.hand.push(p);
    }),
    transferControl: vi.fn((state: GameState, id: string, playerId: string) => {
      const seat = controller(state, id)!;
      const view = seatView(state, seat);
      const [p] = view.player.inPlay.splice(
        view.player.inPlay.findIndex((p) => p.id === id),
        1,
      );
      seatView(state, playerId).player.inPlay.push(p);
    }),
    canRemoveMainThreat: vi.fn(() => true),
    canReady: vi.fn(() => true),
    growthCounters: (state, target) =>
      target.startsWith("hero:")
        ? Number(
            seatView(state, target.slice(5)).flags.grootGrowthCounters || 0,
          )
        : allInPlay(state).find((p) => p.id === target)?.counters || 0,
    addGrowthCounters: (state, target, amount) => {
      if (target.startsWith("hero:")) {
        const view = seatView(state, target.slice(5));
        view.flags.grootGrowthCounters = Math.min(
          10,
          Number(view.flags.grootGrowthCounters || 0) + amount,
        );
      } else {
        const p = allInPlay(state).find((p) => p.id === target)!;
        p.counters = Math.min(10, p.counters + amount);
      }
    },
  };
  const play = (code: string, seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = seatId;
    seatView(s, seatId).player.inPlay.push(p);
    return p;
  };
  const hand = (code: string) => {
    const p = makePiece(s, code);
    s.player.hand.push(p);
    return p;
  };
  const run = (e: Effect, state = s) =>
    pack.resolveGmwPlayerPackEffect(state, e, ports);
  const choose = (id: string) => {
    const o = s.prompt!.options.find((o) => o.id === id)!;
    s.prompt = null;
    for (const e of o.effects) if (!run(e)) s.queue.push(e);
  };
  return { s, ports, play, hand, run, choose };
}

describe("Galaxy's Most Wanted original player packs", () => {
  it("covers all 26 supplementary physical printings with native rules and exact Core aliases", () => {
    expect(pack.GMW_PLAYER_PACK_SCRIPT_CODES).toHaveLength(16);
    expect(pack.GMW_PLAYER_PACK_CORE_ALIASES).toHaveLength(10);
    expect(
      new Set([
        ...pack.GMW_PLAYER_PACK_SCRIPT_CODES,
        ...pack.GMW_PLAYER_PACK_CORE_ALIASES,
      ]).size,
    ).toBe(26);
    expect(pack.GMW_PLAYER_PACK_SCRIPT_CODES).toContain("16048");
  });
  it.each(["16012", "16019", "16040", "16047"])(
    "%s is a native ally without invented entry actions",
    (code) => {
      const { s } = fixture();
      expect(pack.gmwPlayerPackAllyEnter(s, makePiece(s, code))).toEqual([]);
    },
  );
  it("rejects unrelated events, abilities and effects", () => {
    const { s, ports, play, run } = fixture();
    const p = play("01084");
    expect(pack.gmwPlayerPackAllyEnter(s, p)).toBeNull();
    expect(pack.gmwPlayerPackEvent(s, p)).toBeNull();
    expect(pack.gmwPlayerPackAbility(s, p.id, ports)).toBe(false);
    expect(run({ type: "draw", amount: 1 })).toBe(false);
    expect(() => run(P("unknown"))).toThrow(/Unknown GMW/);
  });
  it.each(["16019", "16047", "16052"])(
    "%s checks the actual current identity's Guardian trait",
    (code) => {
      const { s, ports } = fixture();
      vi.mocked(ports.hasTrait).mockReturnValue(false);
      expect(
        pack.gmwPlayerPackPlayRestriction(s, makePiece(s, code), ports),
      ).toMatch(/Guardian/);
      expect(ports.hasTrait).toHaveBeenCalledWith(s, "hero", "Guardian");
    },
  );
  it("enforces per-controller Deft Focus and Booster Boots limits", () => {
    const { s, ports, play } = fixture();
    for (const code of ["16024", "16052"]) {
      play(code);
      expect(
        pack.gmwPlayerPackPlayRestriction(s, makePiece(s, code), ports),
      ).toMatch(/Max 1/);
    }
  });
  it("Fighting Fit uses printed starting HP and a single villain attack", () => {
    const { s, run } = fixture();
    s.player.hp = 10;
    run(P("fighting-fit"));
    expect(s.queue).toEqual([
      expect.objectContaining({
        type: "damage",
        target: s.villain.id,
        amount: 5,
        attack: true,
      }),
    ]);
    s.queue = [];
    s.player.hp = 9;
    run(P("fighting-fit"));
    expect(s.queue[0].amount).toBe(2);
  });
  it("Fighting Fit requires a villain allowed by actual Guard restrictions", () => {
    const { s, ports } = fixture();
    ports.enemyTargets = () => [];
    expect(
      pack.gmwPlayerPackPlayRestriction(s, makePiece(s, "16014"), ports),
    ).toMatch(/villain/);
    s.player.stunned = true;
    expect(
      pack.gmwPlayerPackPlayRestriction(s, makePiece(s, "16014"), ports),
    ).toBeNull();
  });
  it("Dauntless grants hero Retaliate at printed HP, independently of extra maximum HP", () => {
    const { s, ports, play } = fixture();
    play("16016");
    s.player.hp = 10;
    expect(pack.gmwPlayerPackRetaliate(s, ports)).toBe(1);
    s.player.hp = 15;
    expect(pack.gmwPlayerPackRetaliate(s, ports)).toBe(1);
    s.player.hp = 9;
    expect(pack.gmwPlayerPackRetaliate(s, ports)).toBe(0);
    s.player.hp = 10;
    s.player.form = "alter";
    expect(pack.gmwPlayerPackRetaliate(s, ports)).toBe(0);
  });
  it("Dauntless can enter under another player's control while preserving its owner", () => {
    const { s, ports, play, run } = fixture(true);
    const existing = play("16016", "p1"),
      next = play("16016", "p1");
    expect(pack.gmwPlayerPackCardEntered(s, next)).toEqual([
      P("control", { id: next.id }),
    ]);
    run(P("control", { id: next.id }));
    expect(controller(s, existing.id)?.id).toBe("p1");
    expect(controller(s, next.id)?.id).toBe("p2");
    expect(next.ownerId).toBe("p1");
    expect(ports.transferControl).toHaveBeenCalledWith(s, next.id, "p2");
    expect(
      pack.gmwPlayerPackPlayRestriction(s, makePiece(s, "16016"), ports),
    ).toMatch(/Every player/);
  });
  it("Desperate Defense opens only for the hero actually defending and pays its physical printing", () => {
    const { s, ports, hand, run } = fixture();
    const p = hand("16013");
    s.attack = {
      attacker: s.villain.id,
      base: 2,
      boostCodes: [],
      boostEffects: [],
      defender: "hero",
      targetPlayerId: "p1",
      defense: 2,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    const opts = pack.gmwPlayerPackDefenseOptions(
      s,
      [{ type: "resume" }],
      ports,
    );
    expect(opts[0].image).toBe("16013");
    run(opts[0].effects[0]);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      piece: { id: p.id, code: "16013" },
      cost: 1,
    });
    expect(pack.gmwPlayerPackPlayRestriction(s, p, ports)).toMatch(/defends/);
    s.attack.defender = "none";
    expect(pack.gmwPlayerPackDefenseOptions(s, [], ports)).toEqual([]);
  });
  it("Desperate Defense adds DEF then readies only after an actual no-damage defense", () => {
    const { s, ports, run } = fixture();
    s.attack = {
      attacker: s.villain.id,
      base: 2,
      boostCodes: [],
      boostEffects: [],
      defender: "hero",
      defense: 2,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    run(P("defense"));
    expect(s.attack.defenseBonus).toBe(2);
    expect(
      pack.gmwPlayerPackAfterDefense(
        s,
        { heroDefended: true, heroDamage: 0, playerId: "p1" },
        ports,
      ),
    ).toContainEqual({ type: "ready", target: "hero" });
    expect(s.flags.gmwDesperateDefense).toBeUndefined();
    run(P("defense"));
    expect(
      pack.gmwPlayerPackAfterDefense(
        s,
        { heroDefended: true, heroDamage: 1, playerId: "p1" },
        ports,
      ),
    ).toEqual([]);
  });
  it("Hard to Ignore removes threat without initiating a thwart or ignoring Crisis", () => {
    const { s, ports, play, run } = fixture();
    const p = play("16017");
    s.player.confused = true;
    const opts = pack.gmwPlayerPackAfterDefense(
      s,
      { heroDefended: true, heroDamage: 0, playerId: "p1" },
      ports,
    );
    run(opts[0].effects[0]);
    expect(p.exhausted).toBe(true);
    expect(s.queue[0]).toMatchObject({
      type: "thwart",
      source: p.id,
      amount: 1,
      ignorePatrol: true,
    });
    expect(s.queue[0].action).toBeUndefined();
    expect(s.queue[0].ignoreCrisis).toBeUndefined();
  });
  it.each([
    { heroDefended: false, heroDamage: 0, playerId: "p1" },
    { heroDefended: true, heroDamage: 1, playerId: "p1" },
    { heroDefended: true, heroDamage: 0, playerId: "p2" },
  ])(
    "Hard to Ignore rejects an ineligible completed defense %j",
    (snapshot) => {
      const { s, ports, play } = fixture();
      play("16017");
      expect(pack.gmwPlayerPackAfterDefense(s, snapshot, ports)).toEqual([]);
    },
  );
  it("Hard to Ignore cannot exhaust for a locked or empty main scheme", () => {
    const { s, ports, play } = fixture();
    play("16017");
    vi.mocked(ports.canRemoveMainThreat!).mockReturnValue(false);
    expect(
      pack.gmwPlayerPackAfterDefense(
        s,
        { heroDefended: true, heroDamage: 0, playerId: "p1" },
        ports,
      ),
    ).toEqual([]);
  });
  it("Rocket ally gains +3 and overkill for the actual minion target only", () => {
    const { s, play } = fixture();
    const rocket = play("16019"),
      minion = makePiece(s, "01102");
    s.minions.push(minion);
    expect(pack.gmwPlayerPackAllyAttackModifier(s, rocket, minion.id)).toEqual({
      amount: 3,
      overkill: true,
    });
    expect(
      pack.gmwPlayerPackAllyAttackModifier(s, rocket, s.villain.id),
    ).toEqual({ amount: 0, overkill: false });
    rocket.stunned = true;
    expect(
      pack.gmwPlayerPackAllyAttackModifier(s, rocket, minion.id).amount,
    ).toBe(0);
  });
  it("Rocket ally's minion attack interrupt is optional and modifies the chosen actual attack once", () => {
    const { s, ports, play, run } = fixture();
    const rocket = play("16019"),
      minion = makePiece(s, "01102");
    s.minions.push(minion);
    const packet = {
      type: "damage",
      target: minion.id,
      source: rocket.id,
      amount: 1,
      attack: true,
    };
    const [choice] = pack.gmwPlayerPackAllyAttackOptions(
      s,
      rocket,
      packet,
      [{ type: "consequence" }],
      ports,
    );
    expect(packet.amount).toBe(1);
    expect(choice.id).toBe(rocket.id);
    run(choice.effects[0]);
    expect(s.queue).toEqual([
      expect.objectContaining({
        amount: 4,
        overkill: true,
        gmwRocketAllyHandled: true,
      }),
      { type: "consequence" },
    ]);
    expect(
      pack.gmwPlayerPackAllyAttackOptions(s, rocket, s.queue[0], [], ports),
    ).toEqual([]);
  });
  it("Groot ally heals only the surviving actual defender, without substituting a new copy", () => {
    const { s, ports, play } = fixture();
    const groot = play("16047");
    groot.damage = 4;
    const snapshot = {
      heroDefended: false,
      heroDamage: 0,
      playerId: "p1",
      defender: groot.id,
    };
    expect(pack.gmwPlayerPackAfterDefense(s, snapshot, ports)[0]).toMatchObject(
      { title: "Groot", effects: [P("groot-heal", { id: groot.id })] },
    );
    s.player.inPlay = [];
    const replacement = play("16047");
    replacement.damage = 4;
    expect(pack.gmwPlayerPackAfterDefense(s, snapshot, ports)).toEqual([]);
  });
  it("Bug offers optional healing only after an actual hero basic attack", () => {
    const { s, play, run } = fixture();
    const bug = play("16040");
    expect(pack.gmwPlayerPackAfterBasicAttack(s)).toEqual([]);
    bug.damage = 1;
    const [effect] = pack.gmwPlayerPackAfterBasicAttack(s);
    expect(effect.type).toBe("optional");
    run(effect.effects[0]);
    expect(s.queue[0]).toMatchObject({
      type: "heal",
      target: bug.id,
      amount: 1,
    });
    s.player.form = "alter";
    expect(pack.gmwPlayerPackAfterBasicAttack(s)).toEqual([]);
  });
  it("Deft Focus stores a lasting discount independently of its discarded physical source", () => {
    const { s, ports, play, run } = fixture();
    const deft = play("16024");
    expect(pack.gmwPlayerPackAbilityOptions(s, deft.id, ports)[0].id).toBe(
      "deft-focus",
    );
    pack.gmwPlayerPackAbility(s, deft.id, ports, "deft-focus");
    run(s.queue.shift()!);
    expect(deft.exhausted).toBe(true);
    s.player.inPlay = [];
    expect(pack.gmwPlayerPackCardCostReduction(s, card("16004"))).toBe(1);
    expect(pack.gmwPlayerPackCardCostReduction(s, card("16031"))).toBe(0);
    pack.gmwPlayerPackCardPlayed(s, card("16031"));
    expect(s.flags.gmwDeftFocus).toBe(1);
    pack.gmwPlayerPackCardPlayed(s, card("16004"));
    expect(s.flags.gmwDeftFocus).toBeUndefined();
  });
  it("Deft Focus expires for every controller when the current turn ends", () => {
    const { s } = fixture(true);
    s.flags.gmwDeftFocus = 1;
    s.players[1].flags.gmwDeftFocus = 2;
    pack.gmwPlayerPackTurnEnded(s);
    expect(s.flags.gmwDeftFocus).toBeUndefined();
    expect(s.players[1].flags.gmwDeftFocus).toBeUndefined();
  });
  it("Hand Cannon spends and discards its last actual charge before the attack continuation", () => {
    const { s, ports, play, run } = fixture();
    const cannon = play("16046");
    pack.gmwPlayerPackCardEntered(s, cannon);
    expect(cannon.counters).toBe(3);
    cannon.counters = 1;
    const packet = {
      type: "damage",
      target: s.villain.id,
      source: "hero",
      attack: true,
      basic: true,
      amount: 2,
    };
    run(
      pack.gmwPlayerPackBasicAttackOptions(
        s,
        packet,
        [{ type: "after" }],
        ports,
      )[0].effects[0],
    );
    expect(s.player.inPlay).not.toContain(cannon);
    expect(s.player.discard).toContain(cannon);
    expect(s.queue).toEqual([
      expect.objectContaining({ amount: 4, overkill: true, gmwBasicBonus: 2 }),
      { type: "after" },
    ]);
  });
  it("Blank Tech text suppresses Hand Cannon's Uses entry and its printed interrupt", () => {
    const { s, ports, play } = fixture();
    s.sideSchemes = [makePiece(s, "12026")];
    const cannon = play("16046");
    pack.gmwPlayerPackCardEntered(s, cannon);
    expect(cannon.counters).toBe(0);
    cannon.counters = 3;
    expect(
      pack.gmwPlayerPackBasicAttackOptions(
        s,
        { type: "damage", basic: true, attack: true, amount: 2 },
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it("Stun replacement cannot spend a Hand Cannon charge", () => {
    const { s, ports, play } = fixture();
    const p = play("16046");
    p.counters = 3;
    s.player.stunned = true;
    expect(
      pack.gmwPlayerPackBasicAttackOptions(
        s,
        { type: "damage", basic: true, attack: true, amount: 2 },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(p.counters).toBe(3);
    expect(p.exhausted).toBe(false);
  });
  it("Follow Through modifies positive excess and survives save/reload without changing attack damage", () => {
    const { s, ports, play, run } = fixture();
    const first = play("16045"),
      second = play("16045");
    const packet = {
      type: "damage",
      target: s.villain.id,
      source: "hero",
      attack: true,
      amount: 6,
    };
    const opts = pack.gmwPlayerPackExcessOptions(
      s,
      packet,
      2,
      [{ type: "after" }],
      ports,
    );
    expect(opts).toHaveLength(2);
    const loaded = JSON.parse(JSON.stringify(s)) as GameState;
    run(JSON.parse(JSON.stringify(opts[0].effects[0])), loaded);
    expect(loaded.queue[0]).toMatchObject({
      amount: 6,
      excessBonus: 1,
      gmwExcessUsed: [first.id],
    });
    const next = pack.gmwPlayerPackExcessOptions(
      loaded,
      loaded.queue[0],
      3,
      [],
      ports,
    );
    expect(next.map((o) => o.id)).toEqual([second.id]);
  });
  it.each([0, -1])(
    "Follow Through does not create excess from %s",
    (excess) => {
      const { s, ports, play } = fixture();
      play("16045");
      expect(
        pack.gmwPlayerPackExcessOptions(
          s,
          { type: "damage", attack: true, source: "hero", amount: 6 },
          excess,
          [],
          ports,
        ),
      ).toEqual([]);
    },
  );
  it("Follow Through does not amplify an ally's attack", () => {
    const { s, ports, play } = fixture();
    const p = play("16045");
    expect(
      pack.gmwPlayerPackExcessOptions(
        s,
        { type: "damage", attack: true, source: p.id, amount: 6 },
        2,
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it("Looking for Trouble discards actual cards until one minion, before its continuation", () => {
    const { s, ports, run } = fixture();
    const before = makePiece(s, "01104"),
      minion = makePiece(s, "01102"),
      untouched = makePiece(s, "01104");
    s.encounter.deck = [before, minion, untouched];
    s.encounter.discard = [];
    s.player.confused = true;
    const after = [{ type: "check-status" }];
    run(pack.gmwPlayerPackBeforeEvent(s, makePiece(s, "16043"), after)[0]);
    expect(ports.putMinion).toHaveBeenCalledWith(s, minion, "p1");
    expect(s.encounter.deck).toEqual([untouched]);
    expect(s.encounter.discard).toEqual([before]);
    expect(s.minions[0].id).toBe(minion.id);
    expect(s.player.confused).toBe(true);
    expect(s.queue).toEqual(after);
  });
  it("Looking for Trouble stops after exhausting one deck even if the recycle contains a minion", () => {
    const { s, ports, run } = fixture();
    const only = makePiece(s, "01104"),
      oldMinion = makePiece(s, "01102");
    s.encounter.deck = [only];
    s.encounter.discard = [oldMinion];
    const before = s.encounter.acceleration;
    run(P("looking-cost", { after: [{ type: "event-status" }] }));
    expect(s.encounter.acceleration).toBe(before + 1);
    expect(ports.discardEncounterTop).toHaveBeenCalledTimes(1);
    expect(ports.putMinion).not.toHaveBeenCalled();
    expect(s.queue[0].type).toBe("event-status");
  });
  it("Into the Fray targets one minion and captures excess in the native damage dispatcher", () => {
    const { s, ports } = fixture();
    const p = makePiece(s, "16042");
    expect(pack.gmwPlayerPackPlayRestriction(s, p, ports)).toMatch(/minion/);
    expect(pack.gmwPlayerPackEvent(s, p)![0]).toMatchObject({
      type: "target",
      group: "minion",
      action: { amount: 6, attack: true, excessToMain: true },
    });
    s.player.stunned = true;
    expect(pack.gmwPlayerPackPlayRestriction(s, p, ports)).toBeNull();
  });
  it.each(["16020", "16048"])(
    "Flora and Fauna %s accepts actual ally Groot and identity Rocket",
    (code) => {
      const { s, ports, play, run, choose } = fixture();
      s.heroId = "rocket";
      s.players[0].heroId = "rocket";
      const groot = play("16047"),
        weapon = play("16038");
      groot.counters = 9;
      groot.exhausted = true;
      weapon.counters = 1;
      weapon.exhausted = true;
      expect(
        pack.gmwPlayerPackPlayRestriction(s, makePiece(s, code), ports),
      ).toBeNull();
      run(pack.gmwPlayerPackEvent(s, makePiece(s, code))![0]);
      expect(s.prompt!.options.map((o) => o.id)).toEqual([groot.id, weapon.id]);
      choose(groot.id);
      expect(groot.counters).toBe(10);
      expect(s.queue[0]).toMatchObject({ type: "ready", target: groot.id });
    },
  );
  it("Flora and Fauna accepts another Groot identity in alter ego and preserves each seat's growth", () => {
    const { s, ports, play, run, choose } = fixture(true);
    s.heroId = "rocket";
    s.players[0].heroId = "rocket";
    s.players[1].heroId = "groot";
    s.players[1].player.form = "alter";
    s.players[1].flags.grootGrowthCounters = 9;
    const upgrade = play("16034");
    upgrade.counters = 4;
    run(P("flora"));
    expect(s.prompt!.options.some((o) => o.id === "hero:p2")).toBe(true);
    choose("hero:p2");
    expect(s.players[1].flags.grootGrowthCounters).toBe(10);
    expect(s.flags.grootGrowthCounters).toBeUndefined();
    expect(upgrade.counters).toBe(4);
    expect(
      pack.gmwPlayerPackPlayRestriction(s, makePiece(s, "16048"), ports),
    ).toBeNull();
  });
  it("Flora and Fauna adds charges to and readies the actual Rocket upgrade", () => {
    const { s, play, run, choose } = fixture();
    s.heroId = "rocket";
    s.players[0].heroId = "rocket";
    play("16047");
    const weapon = play("16038");
    weapon.counters = 2;
    weapon.exhausted = true;
    run(P("flora"));
    choose(weapon.id);
    expect(weapon.counters).toBe(4);
    expect(s.queue[0]).toMatchObject({ type: "ready", target: weapon.id });
  });
  it("Flora and Fauna cannot be used by an unrelated identity despite both named allies", () => {
    const { s, ports, play } = fixture();
    play("16019");
    play("16047");
    expect(
      pack.gmwPlayerPackPlayRestriction(s, makePiece(s, "16020"), ports),
    ).toMatch(/requires/);
  });
  it("Booster Boots pays the physical discard cost before prevention", () => {
    const { s, ports, play, run } = fixture();
    const boots = play("16052"),
      top = makePiece(s, "16021");
    s.player.deck = [top];
    const packet = { type: "attackDamage", kind: "attack", target: "hero" };
    run(
      pack.gmwPlayerPackDamageOptions(
        s,
        packet,
        2,
        [{ type: "resume" }],
        ports,
      )[0].effects[0],
    );
    expect(boots.exhausted).toBe(true);
    expect(s.player.discard).toContain(top);
    expect(ports.preventDamage).toHaveBeenCalledWith(s, 1, packet);
    expect(s.queue).toEqual([{ type: "resume" }]);
    expect(
      vi.mocked(ports.discardPlayerTop).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(ports.preventDamage).mock.invocationCallOrder[0]);
  });
  it("Booster Boots cannot pay with an empty deck or prevent consequential damage", () => {
    const { s, ports, play } = fixture();
    play("16052");
    expect(
      pack.gmwPlayerPackDamageOptions(
        s,
        { type: "damage", target: "hero", attack: true },
        1,
        [],
        ports,
      ),
    ).toEqual([]);
    s.player.deck = [makePiece(s, "16021")];
    expect(
      pack.gmwPlayerPackDamageOptions(
        s,
        { type: "damage", target: "hero", source: "consequential" },
        1,
        [],
        ports,
      ),
    ).toEqual([]);
    s.player.tough = true;
    expect(
      pack.gmwPlayerPackDamageOptions(
        s,
        { type: "damage", target: "hero", attack: true },
        1,
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it("Starhawk returns the actual card to its owner's hand instead of taking exactly lethal damage", () => {
    const { s, ports, play, run } = fixture();
    const starhawk = play("16012");
    starhawk.damage = 1;
    starhawk.exhausted = true;
    const opts = pack.gmwPlayerPackStarhawkDamageOptions(
      s,
      starhawk,
      2,
      [{ type: "after" }],
      ports,
    );
    run(opts[0].effects[0]);
    expect(s.player.inPlay).not.toContain(starhawk);
    expect(s.player.hand[0].id).toBe(starhawk.id);
    expect(s.player.hand[0].damage).toBe(0);
    expect(s.player.discard).not.toContain(starhawk);
    expect(s.queue).toEqual([{ type: "after" }]);
  });
  it.each([0, 1, 3])(
    "Starhawk cannot return when actual damage %s differs from 2 remaining HP",
    (amount) => {
      const { s, ports, play } = fixture();
      const p = play("16012");
      p.damage = 1;
      expect(
        pack.gmwPlayerPackStarhawkDamageOptions(s, p, amount, [], ports),
      ).toEqual([]);
    },
  );
  it("Starhawk compares actual remaining ally HP after health modifiers", () => {
    const { s, ports, play } = fixture();
    const p = play("16012");
    p.damage = 1;
    ports.allyMaxHP = () => 4;
    expect(
      pack.gmwPlayerPackStarhawkDamageOptions(s, p, 3, [], ports),
    ).toHaveLength(1);
    expect(pack.gmwPlayerPackStarhawkDamageOptions(s, p, 2, [], ports)).toEqual(
      [],
    );
  });
  it("Starhawk's Tough status has priority over his optional damage interrupt", () => {
    const { s, ports, play } = fixture();
    const p = play("16012");
    p.damage = 1;
    p.tough = true;
    expect(pack.gmwPlayerPackStarhawkDamageOptions(s, p, 2, [], ports)).toEqual(
      [],
    );
  });
});
