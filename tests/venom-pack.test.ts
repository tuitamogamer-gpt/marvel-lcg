import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { rulesCode } from "../src/game/rules-code";
import { allInPlay, controller, seatView } from "../src/game/team";
import * as pack from "../src/game/venom-pack";
import type { Effect, GameState } from "../src/game/types";

const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "venom-pack:" + type,
  ...args,
});
function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "justice",
    seed: 2029,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
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
  s.resolving = [];
  s.scheme.threat = 5;
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
    view.player.inPlay = [];
  }
  const ports: pack.VenomPackPorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    discardPiece: vi.fn((state, id) => {
      const seat = controller(state, id)!;
      const view = seatView(state, seat);
      view.player.discard.push(
        ...view.player.inPlay.splice(
          view.player.inPlay.findIndex((p) => p.id === id),
          1,
        ),
      );
    }),
    hasTrait: vi.fn((state, target, trait) => {
      const p = allInPlay(state).find((p) => p.id === target);
      return !!p && (card(p).traits || "").split(/\.\s*/).includes(trait);
    }),
    enemyTargets: (state, attack) => [
      ...(!attack ||
      !state.minions.some(
        (p) => p.code === "01101" && p.engagedWith === state.activePlayerId,
      )
        ? [{ id: state.villain.id, label: "Rhino" }]
        : []),
      ...state.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ],
    cardCost: (_s, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    transferControl: vi.fn((state, id, playerId) => {
      const seat = controller(state, id)!;
      const zone = seatView(state, seat).player.inPlay;
      seatView(state, playerId).player.inPlay.push(
        ...zone.splice(
          zone.findIndex((p) => p.id === id),
          1,
        ),
      );
    }),
    maxHeroHP: () => 10,
    canGiveTough: vi.fn(() => true),
  };
  const play = (code: string, playerId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = playerId;
    seatView(s, playerId).player.inPlay.push(p);
    return p;
  };
  const hand = (code: string) => {
    const p = makePiece(s, code);
    s.player.hand.push(p);
    return p;
  };
  const minion = (code = "01101", playerId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.engagedWith = playerId;
    s.minions.push(p);
    return p;
  };
  const run = (e: Effect, state = s) =>
    pack.resolveVenomPackEffect(state, e, ports);
  const choose = (id: string) => {
    const o = s.prompt!.options.find((o) => o.id === id)!;
    expect(o).toBeDefined();
    s.prompt = null;
    for (const e of o.effects) if (!run(e)) s.queue.push(e);
  };
  return { s, ports, play, hand, minion, run, choose };
}

describe("Venom original retail player pool", () => {
  it("covers sixteen supplementary faces and exactly four Core aliases", () => {
    expect(pack.VENOM_PACK_SCRIPT_CODES).toHaveLength(12);
    expect(pack.VENOM_PACK_CORE_ALIASES).toHaveLength(4);
    expect(
      new Set([
        ...pack.VENOM_PACK_SCRIPT_CODES,
        ...pack.VENOM_PACK_CORE_ALIASES,
      ]).size,
    ).toBe(16);
    expect(pack.VENOM_PACK_CORE_ALIASES.map(rulesCode)).toEqual([
      "01062",
      "01088",
      "01089",
      "01090",
    ]);
  });
  it("does not claim unrelated events, allies, resource sources or effects", () => {
    const { s, ports, play, run } = fixture();
    const p = play("01084");
    expect(pack.venomPackEvent(s, p)).toBeNull();
    expect(pack.venomPackAllyEnter(s, p)).toBeNull();
    expect(pack.venomPackAbility(s, p.id, ports)).toBe(false);
    expect(pack.venomPackResourceSpent(s, p.id, ports)).toBe(false);
    expect(run({ type: "draw" })).toBe(false);
    expect(() => run(P("unknown"))).toThrow(/Unknown Venom/);
  });
  it("Star-Lord gains ranged and deals his actual controller a facedown encounter card when entering", () => {
    const { s, play } = fixture(true);
    const ally = play("20016", "p2");
    expect(pack.venomPackAllyKeywords(s, ally)).toEqual({ ranged: true });
    expect(pack.venomPackAllyEnter(s, ally)).toEqual([
      { type: "dealEncounter", playerId: "p2", mandatory: true },
    ]);
  });
  it("Jack Flag has no invented enter-play effect and can gain ammo after a thwart in either form", () => {
    const { s, play, run } = fixture();
    const ally = play("20011");
    expect(pack.venomPackAllyEnter(s, ally)).toEqual([]);
    s.player.form = "alter";
    const response = pack.venomPackAfterAllyThwart(s, ally)[0];
    expect(response.type).toBe("optional");
    run(response.effects[0]);
    expect(ally.counters).toBe(1);
  });
  it("Jack Flag's ammo ability is a non-attack Hero Action without consequential damage", () => {
    const { s, ports, play, run } = fixture();
    const ally = play("20011");
    ally.counters = 2;
    ally.stunned = true;
    const o = pack.venomPackAbilityOptions(s, ally.id, ports)[0];
    expect(o.id).toBe("ammo");
    run(o.effects[0]);
    expect(ally).toMatchObject({ counters: 1, exhausted: true, stunned: true });
    expect(s.queue[0].action).toEqual({
      type: "damage",
      amount: 2,
      source: ally.id,
    });
  });
  it("Jack Flag needs a ready ally and actual ammo counter for its special action", () => {
    const { s, ports, play } = fixture();
    const ally = play("20011");
    expect(pack.venomPackAbilityOptions(s, ally.id, ports)).toEqual([]);
    ally.counters = 1;
    ally.exhausted = true;
    expect(pack.venomPackAbilityOptions(s, ally.id, ports)).toEqual([]);
    ally.exhausted = false;
    s.player.form = "alter";
    expect(pack.venomPackAbilityOptions(s, ally.id, ports)).toEqual([]);
  });
  it("Scare Tactic attacks only a confused enemy and respects Guard", () => {
    const { s, ports, minion, run, choose } = fixture();
    s.villain.confused = true;
    const guard = minion();
    expect(
      pack.venomPackPlayRestriction(s, makePiece(s, "20012"), ports),
    ).toMatch(/confused enemy/);
    guard.confused = true;
    run(P("scare"));
    expect(s.prompt!.options.map((o) => o.id)).toEqual([guard.id]);
    choose(guard.id);
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: 3,
      attack: true,
      target: guard.id,
    });
  });
  it("a stunned Scare Tactic can be played to replace the attack even without a confused target", () => {
    const { s, ports } = fixture();
    s.player.stunned = true;
    expect(
      pack.venomPackPlayRestriction(s, makePiece(s, "20012"), ports),
    ).toBeNull();
  });
  it("Scare Tactic ignores a partial confuse card that has not made a Steady enemy confused", () => {
    const { s, ports } = fixture();
    s.villain.confuseCards = 1;
    s.villain.confused = false;
    expect(
      pack.venomPackPlayRestriction(s, makePiece(s, "20012"), ports),
    ).toMatch(/confused enemy/);
  });
  it("Sonic Rifle enters with exactly two Uses and Plasma Pistol with three", () => {
    const { s, play } = fixture();
    const rifle = play("20015"),
      pistol = play("20022");
    pack.venomPackCardEntered(s, rifle);
    pack.venomPackCardEntered(s, pistol);
    expect(rifle.counters).toBe(2);
    expect(pistol.counters).toBe(3);
  });
  it("Sonic Rifle spends a counter and exhausts, then confuses an enemy without initiating an attack", () => {
    const { s, ports, play, run } = fixture();
    const rifle = play("20015");
    rifle.counters = 2;
    run(pack.venomPackAbilityOptions(s, rifle.id, ports)[0].effects[0]);
    expect(rifle).toMatchObject({ counters: 1, exhausted: true });
    const effect = s.queue.shift()!.action;
    run({ ...effect, target: "villain" });
    expect(s.queue[0]).toEqual({
      type: "status",
      target: "villain",
      status: "confused",
    });
  });
  it("Sonic Rifle deals three non-attack damage to an already confused enemy", () => {
    const { s, run } = fixture();
    s.villain.confused = true;
    run(P("weapon-target", { target: "villain", code: "20015" }));
    expect(s.queue[0]).toEqual({
      type: "damage",
      target: "villain",
      amount: 3,
      source: "hero",
    });
  });
  it("Sonic Rifle discards from Uses zero before its effect resolves", () => {
    const { s, ports, play, run } = fixture();
    const rifle = play("20015");
    rifle.counters = 1;
    run(P("weapon", { id: rifle.id }));
    expect(ports.discardPiece).toHaveBeenCalledWith(s, rifle.id);
    expect(s.queue[0].action).toEqual(P("weapon-target", { code: "20015" }));
  });
  it("Plasma Pistol's special action does not consume Stun and deals one non-attack damage", () => {
    const { s, ports, play, run } = fixture();
    const pistol = play("20022");
    pistol.counters = 3;
    s.player.stunned = true;
    run(pack.venomPackAbilityOptions(s, pistol.id, ports)[0].effects[0]);
    run({ ...s.queue.shift()!.action, target: "villain" });
    expect(s.queue[0]).toEqual({
      type: "damage",
      target: "villain",
      amount: 1,
      source: "hero",
    });
    expect(s.player.stunned).toBe(true);
  });
  it("charged weapon special actions are unavailable in alter-ego and with zero counters", () => {
    const { s, ports, play } = fixture();
    const pistol = play("20022");
    expect(pack.venomPackAbilityOptions(s, pistol.id, ports)).toEqual([]);
    pistol.counters = 3;
    s.player.form = "alter";
    expect(pack.venomPackAbilityOptions(s, pistol.id, ports)).toEqual([]);
  });
  it("Resourceful is a discard Resource in either form and does not require readying", () => {
    const { s, ports, play } = fixture();
    const p = play("20020");
    p.exhausted = true;
    s.player.form = "alter";
    expect(pack.venomPackResourceSources(s)[0]).toMatchObject({
      id: p.id,
      resources: ["wild"],
      kind: "ability",
    });
    expect(pack.venomPackResourceSpent(s, p.id, ports)).toBe(true);
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
    expect(pack.venomPackResourceSources(s)).toEqual([]);
  });
  it("Side Holster adds a Weapon-only restricted slot for its actual controller", () => {
    const { s, play } = fixture(true);
    play("20021", "p2");
    expect(pack.venomPackRestrictedWeaponAllowance(s)).toBe(0);
    expect(pack.venomPackRestrictedWeaponAllowance(seatView(s, "p2"))).toBe(1);
  });
  it.each(["20021", "20029"])(
    "%s can enter under any eligible player's control and preserves its original owner",
    (code) => {
      const { s, ports, play, run, choose } = fixture(true);
      const p = play(code);
      run(pack.venomPackCardEntered(s, p)[0]);
      expect(s.prompt!.options.map((o) => o.id)).toEqual(["p1", "p2"]);
      choose("p2");
      expect(ports.transferControl).toHaveBeenCalledWith(s, p.id, "p2");
      expect(seatView(s, "p2").player.inPlay).toContain(p);
      expect(p.ownerId).toBe("p1");
    },
  );
  it.each(["20021", "20029"])(
    "%s enforces its physical max one per player even when choosing control",
    (code) => {
      const { s, ports, play } = fixture(true);
      play(code);
      expect(
        pack.venomPackPlayRestriction(s, makePiece(s, code), ports),
      ).toBeNull();
      play(code, "p2");
      expect(
        pack.venomPackPlayRestriction(s, makePiece(s, code), ports),
      ).toMatch(/1 per player/);
    },
  );
  it("Crew Quarters can heal another damaged alter-ego and exhausts its own controller's support", () => {
    const { s, ports, play, run, choose } = fixture(true);
    s.player.form = "alter";
    s.player.hp = 10;
    const other = seatView(s, "p2");
    other.player.form = "alter";
    other.player.hp = 6;
    const quarters = play("20029");
    run(pack.venomPackAbilityOptions(s, quarters.id, ports)[0].effects[0]);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["p2"]);
    choose("p2");
    expect(quarters.exhausted).toBe(true);
    expect(s.queue[0]).toEqual({ type: "heal", target: "hero:p2", amount: 1 });
  });
  it("Crew Quarters cannot heal a hero or activate while its controller is in hero form", () => {
    const { s, ports, play } = fixture(true);
    const quarters = play("20029");
    s.player.hp = 5;
    expect(pack.venomPackAbilityOptions(s, quarters.id, ports)).toEqual([]);
    s.player.form = "alter";
    s.player.hp = 10;
    seatView(s, "p2").player.hp = 5;
    expect(pack.venomPackAbilityOptions(s, quarters.id, ports)).toEqual([]);
  });
  it("Fusillade requires a ready Weapon and commits that additional exhaust cost before event status replacement", () => {
    const { s, ports, play, run, choose } = fixture();
    const event = makePiece(s, "20026");
    expect(pack.venomPackPlayRestriction(s, event, ports)).toMatch(
      /ready Weapon/,
    );
    const weapon = play("20022");
    s.player.stunned = true;
    const continuation = [{ type: "eventResolve", piece: event }];
    run(pack.venomPackBeforeEvent(s, event, continuation)[0]);
    choose(weapon.id);
    expect(weapon.exhausted).toBe(true);
    expect(s.queue).toEqual(continuation);
  });
  it("Fusillade cannot use a teammate's Weapon or an exhausted Weapon", () => {
    const { s, ports, play } = fixture(true);
    play("20022", "p2");
    expect(
      pack.venomPackPlayRestriction(s, makePiece(s, "20026"), ports),
    ).toMatch(/ready Weapon/);
    const weapon = play("20022");
    weapon.exhausted = true;
    expect(
      pack.venomPackPlayRestriction(s, makePiece(s, "20026"), ports),
    ).toMatch(/ready Weapon/);
  });
  it("Fusillade's actual attack is a separate five-damage program after its cost", () => {
    const { s } = fixture();
    expect(pack.venomPackEvent(s, makePiece(s, "20026"))![0].action).toEqual({
      type: "damage",
      amount: 5,
      source: "hero",
      attack: true,
      attackInitiated: true,
    });
  });
  it('"Welcome Aboard" requires an actual Guardian identity and is globally max once per round', () => {
    const { s, ports, run } = fixture(true);
    expect(
      pack.venomPackPlayRestriction(s, makePiece(s, "20027"), ports),
    ).toMatch(/Guardian/);
    vi.mocked(ports.hasTrait).mockReturnValue(true);
    run(P("welcome"));
    expect(
      pack.venomPackPlayRestriction(
        seatView(s, "p2"),
        makePiece(s, "20027"),
        ports,
      ),
    ).toMatch(/1 per round/);
  });
  it('"Welcome Aboard" reduces the next ally played by any player, never a support', () => {
    const { s, run } = fixture(true);
    run(P("welcome"));
    expect(
      pack.venomPackCardCostReduction(seatView(s, "p2"), card("20011")),
    ).toBe(2);
    expect(pack.venomPackCardCostReduction(s, card("20029"))).toBe(0);
    pack.venomPackCardPlayed(seatView(s, "p2"), card("20011"));
    expect(pack.venomPackCardCostReduction(s, card("20011"))).toBe(0);
  });
  it('"Welcome Aboard" survives another played card and expires when its phase ends', () => {
    const { s, run } = fixture();
    run(P("welcome"));
    pack.venomPackCardPlayed(s, card("20029"));
    expect(pack.venomPackCardCostReduction(s, card("20011"))).toBe(2);
    pack.venomPackPhaseEnded(s);
    expect(pack.venomPackCardCostReduction(s, card("20011"))).toBe(0);
  });
  it('"Welcome Aboard" cannot carry a reduction into a later phase or round', () => {
    const { s, run } = fixture();
    run(P("welcome"));
    s.phase = "villain";
    expect(pack.venomPackCardCostReduction(s, card("20011"))).toBe(0);
    s.phase = "player";
    s.round++;
    expect(pack.venomPackCardCostReduction(s, card("20011"))).toBe(0);
  });
  it("Making an Entrance requires an actual unstopped basic thwart", () => {
    const { s, ports, hand } = fixture();
    const p = hand("20013"),
      packet = { type: "basicPower", basic: true, power: "thwart", amount: 2 };
    expect(pack.venomPackBasicThwartOptions(s, packet, [], ports)[0].id).toBe(
      p.id,
    );
    expect(
      pack.venomPackBasicThwartOptions(
        s,
        { ...packet, basic: false },
        [],
        ports,
      ),
    ).toEqual([]);
    s.player.confused = true;
    expect(pack.venomPackBasicThwartOptions(s, packet, [], ports)).toEqual([]);
  });
  it("Making an Entrance finishes its native played event before resuming the boosted basic thwart", () => {
    const { s, ports, hand, run } = fixture();
    const p = hand("20013"),
      packet = { type: "basicPower", basic: true, amount: 2 };
    run(
      pack.venomPackBasicThwartOptions(
        s,
        packet,
        [{ type: "sentinel" }],
        ports,
      )[0].effects[0],
    );
    const pay = s.queue.shift()!;
    expect(pay).toMatchObject({
      type: "payRequest",
      piece: p,
      cancelable: false,
    });
    expect(pay.after[0]).toMatchObject({ type: "resolveHandEvent", after: [] });
    run(pay.after[0].continuation[0]);
    expect(s.queue[0]).toMatchObject({
      amount: 4,
      gmwBasicBonus: 2,
      venomPackEntrances: [p.id],
    });
    expect(s.queue[1]).toEqual({ type: "sentinel" });
  });
  it("Making an Entrance heals only after the complete actual thwart removed all threat from a scheme", () => {
    const { s } = fixture();
    const packet = {
      type: "basicPower",
      venomPackEntrances: ["physical-event"],
    };
    expect(pack.venomPackBasicThwartEnded(s, packet, true)).toEqual([
      { type: "heal", target: "hero", amount: 2 },
    ]);
    expect(pack.venomPackBasicThwartEnded(s, packet, false)).toEqual([]);
    expect(
      pack.venomPackBasicThwartEnded(s, { type: "basicPower" }, true),
    ).toEqual([]);
  });
  it("multiple Making an Entrance copies each retain their own one-time heal", () => {
    const { s } = fixture();
    expect(
      pack.venomPackBasicThwartEnded(
        s,
        { type: "basicPower", venomPackEntrances: ["first", "second"] },
        true,
      ),
    ).toEqual([
      { type: "heal", target: "hero", amount: 2 },
      { type: "heal", target: "hero", amount: 2 },
    ]);
  });
  it("Shake it Off can respond to another player's surviving Guardian taking actual attack damage", () => {
    const { s, ports, hand, play } = fixture(true);
    const event = hand("20028"),
      guardian = play("19020", "p2"),
      snapshot = { target: guardian.id, attack: true, actualDamage: 1 };
    expect(
      pack.venomPackAfterAttackDamageOptions(s, snapshot, [], ports)[0].id,
    ).toBe(event.id);
  });
  it("Shake it Off never responds to zero damage taken, non-attacks, or non-Guardians", () => {
    const { s, ports, hand, play } = fixture();
    hand("20028");
    const guardian = play("19020"),
      ordinary = play("01058");
    expect(
      pack.venomPackAfterAttackDamageOptions(
        s,
        { target: guardian.id, attack: true, actualDamage: 0 },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.venomPackAfterAttackDamageOptions(
        s,
        { target: guardian.id, attack: false, actualDamage: 1 },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.venomPackAfterAttackDamageOptions(
        s,
        { target: ordinary.id, attack: true, actualDamage: 1 },
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it("Shake it Off requires its controller to be in hero form and a target that can still receive tough", () => {
    const { s, ports, hand, play } = fixture();
    hand("20028");
    const p = play("19020"),
      snapshot = { target: p.id, attack: true, actualDamage: 1 };
    s.player.form = "alter";
    expect(
      pack.venomPackAfterAttackDamageOptions(s, snapshot, [], ports),
    ).toEqual([]);
    s.player.form = "hero";
    vi.mocked(ports.canGiveTough).mockReturnValue(false);
    expect(
      pack.venomPackAfterAttackDamageOptions(s, snapshot, [], ports),
    ).toEqual([]);
  });
  it("Shake it Off uses a paid native event and preserves its actual physical Guardian target", () => {
    const { s, ports, hand, play, run } = fixture();
    const event = hand("20028"),
      p = play("19020"),
      snapshot = { target: p.id, attack: true, actualDamage: 2 };
    run(
      pack.venomPackAfterAttackDamageOptions(
        s,
        snapshot,
        [{ type: "sentinel" }],
        ports,
      )[0].effects[0],
    );
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      piece: event,
      after: [
        {
          type: "resolveHandEvent",
          id: event.id,
          after: [{ type: "status", target: p.id, status: "tough" }],
          continuation: [{ type: "sentinel" }],
        },
      ],
    });
  });
  it("response continuations preserve all physical IDs through JSON serialization", () => {
    const { s, ports, hand, play } = fixture();
    hand("20028");
    const p = play("19020"),
      options = pack.venomPackAfterAttackDamageOptions(
        s,
        { target: p.id, attack: true, actualDamage: 1 },
        [{ type: "sentinel" }],
        ports,
      );
    expect(JSON.parse(JSON.stringify(options))).toEqual(options);
  });
});
