import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { rulesCode } from "../src/game/rules-code";
import { allInPlay, controller, seatView } from "../src/game/team";
import * as pack from "../src/game/drax-pack";
import type { Effect, GameState, Piece } from "../src/game/types";

const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "drax-pack:" + type,
  ...args,
});
function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "protection",
    seed: 1933,
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
  s.resolving = [];
  s.scheme.threat = 5;
  s.encounter.deck = [];
  s.encounter.discard = [];
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
    view.player.inPlay = [];
  }
  const ports: pack.DraxPackPorts = {
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
    enemyTargets: (state) => [
      { id: state.villain.id, label: "Rhino" },
      ...state.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ],
    minionTargets: (state) =>
      state.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    cardCost: (_s, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    discardPlayerTop: vi.fn((state) => {
      const piece = state.player.deck.shift();
      if (piece) state.player.discard.push(piece);
      return { piece, emptied: !state.player.deck.length };
    }),
    discardEncounterTop: vi.fn((state) => {
      const piece = state.encounter.deck.shift();
      if (piece) state.encounter.discard.push(piece);
      return { piece, emptied: !state.encounter.deck.length };
    }),
    preventDamage: vi.fn(),
    removeStatus: vi.fn((state, _target, status) => {
      state.player[status] = false;
    }),
    canGiveTough: vi.fn(() => true),
    returnAllyToHand: vi.fn(),
    minionAttackEnemy: vi.fn(),
    attackProgram: vi.fn((state, effects, after = []) =>
      state.queue.unshift(...effects, ...after),
    ),
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
    pack.resolveDraxPackEffect(state, e, ports);
  const choose = (id: string) => {
    const o = s.prompt!.options.find((o) => o.id === id)!;
    expect(o).toBeDefined();
    s.prompt = null;
    for (const e of o.effects) if (!run(e)) s.queue.push(e);
  };
  return { s, ports, play, hand, minion, run, choose };
}

describe("Drax original retail player pool", () => {
  it("covers all seventeen supplementary faces and five exact Core aliases", () => {
    expect(pack.DRAX_PACK_SCRIPT_CODES).toHaveLength(12);
    expect(pack.DRAX_PACK_CORE_ALIASES).toHaveLength(5);
    expect(
      new Set([...pack.DRAX_PACK_SCRIPT_CODES, ...pack.DRAX_PACK_CORE_ALIASES])
        .size,
    ).toBe(17);
    expect(pack.DRAX_PACK_CORE_ALIASES.map(rulesCode)).toEqual([
      "01077",
      "01082",
      "01088",
      "01089",
      "01090",
    ]);
  });
  it.each(["19012", "19013", "19020"])(
    "%s has no invented enter-play ability",
    (code) => {
      const { s } = fixture();
      expect(pack.draxPackAllyEnter(s, makePiece(s, code))).toEqual([]);
    },
  );
  it("does not claim unrelated event, ally, ability or effect text", () => {
    const { s, ports, play, run } = fixture();
    const p = play("01084");
    expect(pack.draxPackEvent(s, p)).toBeNull();
    expect(pack.draxPackAllyEnter(s, p)).toBeNull();
    expect(pack.draxPackAbility(s, p.id, ports)).toBe(false);
    expect(run({ type: "draw" })).toBe(false);
    expect(() => run(P("unknown"))).toThrow(/Unknown Drax/);
  });
  it.each(["19015", "19017", "19018"])(
    "%s is available only during its printed interrupt",
    (code) => {
      const { s, ports } = fixture();
      expect(
        pack.draxPackPlayRestriction(s, makePiece(s, code), ports),
      ).toMatch(/interrupt/);
    },
  );
  it.each(["19020", "19031"])(
    "%s checks the identity's actual Guardian trait",
    (code) => {
      const { s, ports } = fixture();
      expect(
        pack.draxPackPlayRestriction(s, makePiece(s, code), ports),
      ).toMatch(/Guardian/);
      expect(ports.hasTrait).toHaveBeenCalledWith(s, "hero", "Guardian");
    },
  );
  it("Athletic Conditioning cannot be played without a status card", () => {
    const { s, ports } = fixture();
    expect(
      pack.draxPackPlayRestriction(s, makePiece(s, "19021"), ports),
    ).toMatch(/status card/);
    s.player.stunCards = 1;
    expect(
      pack.draxPackPlayRestriction(s, makePiece(s, "19021"), ports),
    ).toBeNull();
  });
  it("Athletic Conditioning discards one chosen status without clearing the other", () => {
    const { s, ports, run, choose } = fixture();
    s.player.stunned = s.player.confused = true;
    run(P("condition"));
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["stunned", "confused"]);
    choose("stunned");
    expect(ports.removeStatus).toHaveBeenCalledWith(s, "hero", "stunned");
    expect(s.player.confused).toBe(true);
  });
  it('"Bring It!" draws only for minions actually engaged with its player', () => {
    const { s, minion, run } = fixture(true);
    minion("01101");
    minion("01103", "p2");
    run(P("bring"));
    expect(s.queue[0]).toEqual({ type: "draw", amount: 1 });
  });
  it('"Bring It!" is max once per phase across players and can be used in a later phase', () => {
    const { s, ports, run, minion } = fixture(true);
    minion("01101");
    run(P("bring"));
    expect(
      pack.draxPackPlayRestriction(
        seatView(s, "p2"),
        makePiece(s, "19030"),
        ports,
      ),
    ).toMatch(/1 per phase/);
    s.phase = "villain";
    expect(
      pack.draxPackPlayRestriction(s, makePiece(s, "19030"), ports),
    ).toBeNull();
  });
  it('"Bring It!" requires a minion engaged with its controller', () => {
    const { s, ports, minion } = fixture(true);
    minion("01101", "p2");
    expect(
      pack.draxPackPlayRestriction(s, makePiece(s, "19030"), ports),
    ).toMatch(/engaged with you/);
  });
  it('"Think Fast!" resolves its damage effect before the villain confusion', () => {
    const { s } = fixture();
    expect(pack.draxPackEvent(s, makePiece(s, "19031"))).toEqual([
      { type: "damage", target: "hero", amount: 1, source: "think-fast" },
      { type: "status", target: "villain", status: "confused" },
    ]);
  });
  it("Hard Knocks marks its custom target as an attack for native Guard legality", () => {
    const { s } = fixture();
    expect(
      pack.draxPackEvent(s, makePiece(s, "19016"))![0].action,
    ).toMatchObject({ type: "drax-pack:hard-knocks", attack: true });
  });
  it("Hard Knocks gives tough only after its actual minion defeat", () => {
    const { s, ports, minion, run } = fixture();
    const m = minion();
    run(P("hard-knocks", { target: m.id }));
    expect(ports.attackProgram).toHaveBeenCalledWith(s, [
      expect.objectContaining({
        type: "damage",
        amount: 4,
        attack: true,
        target: m.id,
      }),
      expect.objectContaining({
        type: "drax-pack:hard-knocks-check",
        target: m.id,
      }),
    ]);
    const check = s.queue[1];
    s.queue = [];
    run(check);
    expect(s.queue).toEqual([]);
    s.minions = [];
    run(check);
    expect(s.queue).toEqual([
      { type: "status", target: "hero", status: "tough" },
    ]);
  });
  it("Hard Knocks counts a defeated villain stage but not the same surviving stage", () => {
    const { s, run } = fixture();
    const check = P("hard-knocks-check", {
      target: "villain",
      code: s.villain.code,
      stage: s.villain.stage,
    });
    run(check);
    expect(s.queue).toEqual([]);
    s.villain.stage++;
    run(check);
    expect(s.queue[0]).toEqual({
      type: "status",
      target: "hero",
      status: "tough",
    });
  });
  it("Hard Knocks cannot add another tough card when the host disallows it", () => {
    const { s, ports, run } = fixture();
    vi.mocked(ports.canGiveTough).mockReturnValue(false);
    run(P("hard-knocks-check", { target: "gone", code: "01101" }));
    expect(s.queue).toEqual([]);
  });
  it("Moondragon can act in alter-ego form, pays exhaust/discard before selecting a minion, and excludes self-attack", () => {
    const { s, ports, play, minion, run, choose } = fixture();
    s.player.form = "alter";
    const ally = play("19013"),
      m = minion();
    const o = pack.draxPackAbilityOptions(s, ally.id, ports)[0];
    expect(o.id).toBe("command-minion");
    run(o.effects[0]);
    expect(ally.exhausted).toBe(true);
    expect(ports.discardPiece).toHaveBeenCalledWith(s, ally.id);
    choose(m.id);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["villain"]);
    choose("villain");
    expect(ports.minionAttackEnemy).toHaveBeenCalledWith(s, m.id, "villain");
  });
  it("Moondragon may choose a minion engaged with another player and another minion as the target", () => {
    const { s, ports, play, minion, run, choose } = fixture(true);
    const ally = play("19013"),
      source = minion("01103", "p2"),
      target = minion();
    run(P("moondragon", { id: ally.id }));
    choose(source.id);
    choose(target.id);
    expect(ports.minionAttackEnemy).toHaveBeenCalledWith(
      s,
      source.id,
      target.id,
    );
  });
  it("Moondragon does not offer its ability without a minion or while exhausted", () => {
    const { s, ports, play, minion } = fixture();
    const p = play("19013");
    expect(pack.draxPackAbilityOptions(s, p.id, ports)).toEqual([]);
    minion();
    p.exhausted = true;
    expect(pack.draxPackAbilityOptions(s, p.id, ports)).toEqual([]);
  });
  it("Gamora's search is an optional hero response after an actual ally use", () => {
    const { s, play } = fixture();
    const p = play("19020");
    s.player.deck.push(makePiece(s, "19021"));
    expect(pack.draxPackAfterAllyBasic(s, p)[0].type).toBe("optional");
    s.player.form = "alter";
    expect(pack.draxPackAfterAllyBasic(s, p)).toEqual([]);
  });
  it("Gamora mills only through the first event and returns that exact physical event", () => {
    const { s, ports, play, run } = fixture();
    const ally = play("19020"),
      resource = makePiece(s, "19022"),
      event = makePiece(s, "19021"),
      later = makePiece(s, "19016");
    s.player.deck = [resource, event, later];
    run(P("gamora-search", { id: ally.id }));
    expect(s.player.discard).toEqual([resource]);
    expect(s.player.hand).toEqual([event]);
    expect(s.player.deck).toEqual([later]);
    expect(ports.discardPlayerTop).toHaveBeenCalledTimes(2);
  });
  it("Gamora's failed search stops at exhaustion and does not continue into the recycled deck", () => {
    const { s, ports, play, run } = fixture();
    const ally = play("19020"),
      p = makePiece(s, "19022");
    s.player.deck = [p];
    vi.mocked(ports.discardPlayerTop).mockImplementationOnce((state) => {
      state.player.deck = [p];
      return { piece: p, emptied: true };
    });
    run(P("gamora-search", { id: ally.id }));
    expect(ports.discardPlayerTop).toHaveBeenCalledOnce();
    expect(s.player.deck).toEqual([p]);
  });
  it("Gamora retrieves an event even when discarding it as the last card recycled it immediately", () => {
    const { s, ports, play, run } = fixture();
    const ally = play("19020"),
      p = makePiece(s, "19021");
    s.player.deck = [p];
    vi.mocked(ports.discardPlayerTop).mockImplementationOnce((state) => {
      state.player.deck = [p];
      return { piece: p, emptied: true };
    });
    run(P("gamora-search", { id: ally.id }));
    expect(s.player.hand).toEqual([p]);
    expect(s.player.deck).toEqual([]);
  });
  it("Martyr responds only after consequential attack damage following an enemy defeat", () => {
    const { s, ports, play } = fixture();
    const ally = play("19012");
    const snapshot = { attack: true, defeatedEnemy: true, actualDamage: 1 };
    expect(
      pack.draxPackAfterAllyConsequence(s, ally, snapshot, ports)[0].effects,
    ).toEqual([{ type: "status", target: ally.id, status: "tough" }]);
    expect(
      pack.draxPackAfterAllyConsequence(
        s,
        ally,
        { ...snapshot, actualDamage: 0 },
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.draxPackAfterAllyConsequence(
        s,
        ally,
        { ...snapshot, attack: false },
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.draxPackAfterAllyConsequence(
        s,
        ally,
        { ...snapshot, defeatedEnemy: false },
        ports,
      ),
    ).toEqual([]);
  });
  it("a defeated Martyr cannot respond and receive tough after lethal consequential damage", () => {
    const { s, ports, play } = fixture();
    const ally = play("19012");
    s.player.inPlay = [];
    expect(
      pack.draxPackAfterAllyConsequence(
        s,
        ally,
        { attack: true, defeatedEnemy: true, actualDamage: 1 },
        ports,
      ),
    ).toEqual([]);
  });
  it("Regroup can save another player's ally from an enemy attack without spending the support", () => {
    const { s, ports, play, run } = fixture(true);
    const support = play("19032"),
      ally = play("19012", "p2");
    const snapshot = { attack: true, enemySource: true },
      o = pack.draxPackRegroupOptions(
        s,
        ally,
        snapshot,
        [{ type: "finishDefeat", id: ally.id }],
        ports,
      )[0];
    expect(o.id).toBe(support.id);
    run(o.effects[0]);
    expect(ports.returnAllyToHand).toHaveBeenCalledWith(s, ally.id);
    expect(s.player.inPlay).toContain(support);
    expect(support.exhausted).toBe(false);
    expect(s.queue).toEqual([{ type: "finishDefeat", id: ally.id }]);
  });
  it("Regroup never replaces a non-attack or player-sourced defeat", () => {
    const { s, ports, play } = fixture();
    play("19032");
    const ally = play("19012");
    expect(
      pack.draxPackRegroupOptions(
        s,
        ally,
        { attack: false, enemySource: true },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.draxPackRegroupOptions(
        s,
        ally,
        { attack: true, enemySource: false },
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it("every Regroup discards as a mandatory round-end interrupt across controllers", () => {
    const { s, play } = fixture(true);
    const first = play("19032"),
      second = play("19032", "p2");
    expect(pack.draxPackRoundEnded(s)).toEqual([
      { type: "discardPiece", id: first.id, mandatory: true, actorId: "p1" },
      { type: "discardPiece", id: second.id, mandatory: true, actorId: "p2" },
    ]);
  });
  it("Deflection can protect any identity's actual attack packet but not an ally, non-attack, or zero damage", () => {
    const { s, ports, hand } = fixture(true);
    const p = hand("19015"),
      packet = { type: "damage", target: "hero:p2", attack: true };
    expect(pack.draxPackDamageOptions(s, packet, 7, [], ports)[0].id).toBe(
      p.id,
    );
    expect(
      pack.draxPackDamageOptions(
        s,
        { ...packet, target: "ally" },
        7,
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.draxPackDamageOptions(s, { ...packet, attack: false }, 7, [], ports),
    ).toEqual([]);
    expect(pack.draxPackDamageOptions(s, packet, 0, [], ports)).toEqual([]);
  });
  it("Deflection chooses an amount up to five without limiting prevention to remaining deck cards", () => {
    const { s, ports, run, choose } = fixture();
    run(
      P("deflect-amount", {
        packet: { target: "hero:p2", attack: true },
        amount: 8,
      }),
    );
    expect(s.prompt!.options.map((o) => o.id)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    choose("5");
    expect(ports.preventDamage).toHaveBeenCalledWith(s, 5, {
      target: "hero:p2",
      attack: true,
    });
    expect(ports.discardPlayerTop).not.toHaveBeenCalled();
  });
  it("Deflection stops discarding when its original player deck exhausts", () => {
    const { s, ports, run } = fixture();
    const p = makePiece(s, "19022");
    s.player.deck = [p];
    vi.mocked(ports.discardPlayerTop).mockImplementationOnce((state) => {
      state.player.deck = [p];
      return { piece: p, emptied: true };
    });
    run(P("deflect", { packet: { target: "hero", attack: true }, amount: 5 }));
    expect(ports.preventDamage).toHaveBeenCalledWith(s, 5, {
      target: "hero",
      attack: true,
    });
    expect(ports.discardPlayerTop).toHaveBeenCalledOnce();
  });
  it("Deflection's paid native interrupt carries the actual target packet and resumes its window", () => {
    const { s, ports, hand, run } = fixture();
    const p = hand("19015"),
      packet = {
        type: "damage",
        target: "hero:p2",
        attack: true,
        damageWindowId: "packet1",
      };
    run(
      pack.draxPackDamageOptions(
        s,
        packet,
        3,
        [{ type: "damageWindow" }],
        ports,
      )[0].effects[0],
    );
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      piece: p,
      cancelable: false,
      after: [
        {
          type: "resolveHandEvent",
          id: p.id,
          after: [P("deflect-amount", { packet, amount: 3 })],
          continuation: [{ type: "damageWindow" }],
        },
      ],
    });
  });
  it("Leading Blow needs an unstunned actual basic attack and an encounter card to pay its extra cost", () => {
    const { s, ports, hand } = fixture();
    const p = hand("19017"),
      packet = { type: "basicPower", basic: true, amount: 2 };
    expect(pack.draxPackBasicAttackOptions(s, packet, [], ports)).toEqual([]);
    s.encounter.deck.push(makePiece(s, "01102"));
    expect(pack.draxPackBasicAttackOptions(s, packet, [], ports)[0].id).toBe(
      p.id,
    );
    s.player.stunned = true;
    expect(pack.draxPackBasicAttackOptions(s, packet, [], ports)).toEqual([]);
  });
  it("Leading Blow records only printed boost icons and retains raw negative ATK until later bonuses resolve", () => {
    const { s, ports, hand, run } = fixture();
    const p = hand("19017");
    s.encounter.deck = [makePiece(s, "01102")];
    const packet = {
      type: "basicPower",
      basic: true,
      amount: 1,
      target: "villain",
    };
    run(P("leading", { id: p.id, packet }));
    run(P("resume-leading", { id: p.id, packet }));
    expect(ports.discardEncounterTop).toHaveBeenCalledOnce();
    expect(s.queue[0]).toMatchObject({
      amount: -1,
      gmwBasicBonus: -2,
      target: "villain",
      draxPackLeadingBlows: [p.id],
    });
  });
  it.each([
    ["19025", 2],
    ["19026", 2],
    ["19027", 3],
    ["19028", 1],
    ["19029", 2],
  ] as const)(
    "Leading Blow reads the scan-verified printed boost on %s",
    (code, boost) => {
      const { s, hand, run } = fixture();
      const p = hand("19017"),
        packet = { type: "basicPower", basic: true, amount: 5 };
      s.encounter.deck = [makePiece(s, code)];
      run(P("leading", { id: p.id, packet }));
      run(P("resume-leading", { id: p.id, packet }));
      expect(s.queue[0].amount).toBe(5 - boost);
    },
  );
  it("Leading Blow finishes its played event before resuming the basic attack", () => {
    const { s, ports, hand, run } = fixture();
    const p = hand("19017");
    s.encounter.deck = [makePiece(s, "01102")];
    const packet = { type: "basicPower", basic: true, amount: 3 };
    run(
      pack.draxPackBasicAttackOptions(
        s,
        packet,
        [{ type: "sentinel" }],
        ports,
      )[0].effects[0],
    );
    expect(s.queue[0].after[0]).toMatchObject({
      type: "resolveHandEvent",
      after: [P("leading", { id: p.id, packet })],
      continuation: [
        P("resume-leading", {
          id: p.id,
          packet,
          after: [{ type: "sentinel" }],
        }),
      ],
    });
  });
  it("Leading Blow's delayed ready needs positive damage dealt by that basic attack", () => {
    const { s } = fixture();
    const packet = {
      type: "damage",
      draxPackLeadingBlows: ["physical-leading"],
    };
    expect(pack.draxPackBasicAttackDamageResolved(s, packet, 1)).toEqual([
      { type: "ready", target: "hero" },
    ]);
    expect(pack.draxPackBasicAttackDamageResolved(s, packet, 0)).toEqual([]);
    expect(
      pack.draxPackBasicAttackDamageResolved(s, { type: "damage" }, 1),
    ).toEqual([]);
  });
  it("Subdue can interrupt an actual minion attack against another player and resumes only that activation", () => {
    const { s, ports, hand, minion, run } = fixture(true);
    const p = hand("19018"),
      m = minion("01103", "p2"),
      packet = { type: "enemyAttack", id: m.id, actorId: "p2", modifier: 1 };
    run(
      pack.draxPackAttackInitiatedOptions(s, m, packet, [], ports)[0]
        .effects[0],
    );
    const continuation = s.queue[0].after[0].continuation[0];
    s.queue = [];
    run(continuation);
    expect(s.queue[0]).toMatchObject({
      type: "enemyAttack",
      id: m.id,
      actorId: "p2",
      modifier: -2,
      draxPackSubdues: [p.id],
    });
  });
  it("Subdue is a hero interrupt and does not apply to an enemy that left play", () => {
    const { s, ports, hand, minion } = fixture();
    hand("19018");
    const m = minion();
    s.minions = [];
    expect(
      pack.draxPackAttackInitiatedOptions(
        s,
        m,
        { type: "enemyAttack" },
        [],
        ports,
      ),
    ).toEqual([]);
    s.minions = [m];
    s.player.form = "alter";
    expect(
      pack.draxPackAttackInitiatedOptions(
        s,
        m,
        { type: "enemyAttack" },
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it("Enhanced Physique has three actual Uses and discards at zero", () => {
    const { s, ports, play } = fixture();
    const p = play("19033");
    pack.draxPackCardEntered(s, p);
    expect(p.counters).toBe(3);
    expect(pack.draxPackResourceSources(s)[0].resources).toEqual(["physical"]);
    pack.draxPackResourceSpent(s, p.id, ports);
    expect(p).toMatchObject({ counters: 2, exhausted: true });
    p.exhausted = false;
    p.counters = 1;
    pack.draxPackResourceSpent(s, p.id, ports);
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
  });
  it("Enhanced Physique cannot be spent in alter-ego or while exhausted", () => {
    const { s, play } = fixture();
    const p = play("19033");
    p.counters = 3;
    p.exhausted = true;
    expect(pack.draxPackResourceSources(s)).toEqual([]);
    p.exhausted = false;
    s.player.form = "alter";
    expect(pack.draxPackResourceSources(s)).toEqual([]);
  });
  it("shared interrupt packets round-trip through JSON without closures", () => {
    const { s, ports, hand } = fixture();
    hand("19015");
    const options = pack.draxPackDamageOptions(
      s,
      {
        type: "damage",
        target: "hero:p2",
        attack: true,
        damageWindowId: "stable",
      },
      4,
      [{ type: "sentinel" }],
      ports,
    );
    expect(JSON.parse(JSON.stringify(options))).toEqual(options);
  });
});
