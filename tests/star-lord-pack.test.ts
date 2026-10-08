import { describe, expect, it, vi } from "vitest";
import {
  makePiece,
  newGame,
  nativeHeroAbilityOptions,
  paymentSources,
} from "../src/game/engine";
import { card } from "../src/game/cards";
import { allInPlay, controller, seatView } from "../src/game/team";
import * as pack from "../src/game/star-lord-pack";
import type { Effect, GameState } from "../src/game/types";
import {
  base as nativeBase,
  command as nativeCommand,
  finish as nativeFinish,
  hand as nativeHand,
  put as nativePut,
  play as nativePlay,
  conserved as nativeConserved,
} from "./sg-test-helpers.js";

const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "star-pack:" + type,
  ...args,
});
function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "leadership",
    seed: 1722,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "leadership" as const },
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
  const ports: pack.StarLordPackPorts = {
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
    attach: vi.fn((state, id, target) => {
      allInPlay(state).find((p) => p.id === id)!.attachedTo = target;
    }),
    mill: () => [],
    maxAllyHP: (_s, p) => card(p).health || 0,
    maxHeroHP: () => 10,
    hasTrait: vi.fn((state, target, trait) => {
      const p = allInPlay(state).find((p) => p.id === target);
      return !!p && (card(p).traits || "").split(/\.\s*/).includes(trait);
    }),
    friendlyTargets: (state) => [
      { id: "hero", label: "Spider-Man" },
      ...allInPlay(state)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    schemeTargets: (state) => [
      { id: "main", label: "The Break-In!" },
      ...state.sideSchemes.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ],
    enemyTargets: (state) => [
      { id: state.villain.id, label: "Rhino", code: state.villain.code },
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
    canGiveStatus: () => true,
    cardCost: (_s, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    playableWithDiscount: () => true,
    playFromHand: vi.fn(),
    shufflePlayerDeck: vi.fn(),
    shuffleEncounter: vi.fn(),
    randomIndex: vi.fn(() => 0),
    discardEncounterTop: vi.fn((state) => {
      const piece = state.encounter.deck.shift();
      if (piece) state.encounter.discard.push(piece);
      return { piece, emptied: !state.encounter.deck.length };
    }),
    discardPlayerTop: vi.fn((state, playerId) => {
      const view = seatView(state, playerId),
        p = view.player.deck.shift();
      if (p) view.player.discard.push(p);
      return p;
    }),
    attackProgram: vi.fn((state, effects, after = []) =>
      state.queue.unshift(...effects, ...after),
    ),
    damageDistribution: vi.fn(),
    threatDistribution: vi.fn(),
    canReady: vi.fn(() => true),
  };
  const play = (code: string, playerId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = playerId;
    seatView(s, playerId).player.inPlay.push(p);
    return p;
  };
  const run = (e: Effect, state = s) =>
    pack.resolveStarLordPackEffect(state, e, ports);
  const choose = (id: string) => {
    const o = s.prompt!.options.find((o) => o.id === id)!;
    expect(o).toBeDefined();
    s.prompt = null;
    for (const e of o.effects) if (!run(e)) s.queue.push(e);
  };
  const flush = () => {
    while (s.queue[0]?.type.startsWith("star-pack:") && !s.prompt)
      run(s.queue.shift()!);
  };
  return { s, ports, play, run, choose, flush };
}

describe("Star-Lord original retail player pool", () => {
  it("accounts for every supplementary printing and preserves exact Core aliases", () => {
    expect(pack.STAR_LORD_PACK_SCRIPT_CODES).toHaveLength(15);
    expect(pack.STAR_LORD_PACK_CORE_ALIASES).toEqual(["17016", "17018"]);
    expect(
      new Set([
        ...pack.STAR_LORD_PACK_SCRIPT_CODES,
        ...pack.STAR_LORD_PACK_CORE_ALIASES,
      ]).size,
    ).toBe(17);
  });
  it.each(["17011", "17012", "17013", "17020"])(
    "%s has no invented enter-play ability",
    (code) => {
      const { s } = fixture();
      expect(pack.starLordPackAllyEnter(s, makePiece(s, code))).toEqual([]);
    },
  );
  it("does not claim unrelated cards or effect namespaces", () => {
    const { s, ports, play, run } = fixture();
    const p = play("01084");
    expect(pack.starLordPackAllyEnter(s, p)).toBeNull();
    expect(pack.starLordPackEvent(s, p)).toBeNull();
    expect(pack.starLordPackAbility(s, p.id, ports)).toBe(false);
    expect(run({ type: "draw", amount: 1 })).toBe(false);
    expect(() => run(P("unknown"))).toThrow(/Unknown Star-Lord/);
  });
  it("Laser Blaster gives only its attached ally +1 ATK and overkill; Yondu is ranged", () => {
    const { s, play } = fixture();
    const yondu = play("17013"),
      other = play("17020"),
      laser = play("17019");
    laser.attachedTo = yondu.id;
    expect(pack.starLordPackModifiers(s, yondu.id)).toEqual({
      attack: 1,
      thwart: 0,
      overkill: true,
      ranged: true,
    });
    expect(pack.starLordPackModifiers(s, other.id).attack).toBe(0);
  });
  it("blanked Laser Blaster loses both continuous effects", () => {
    const { s, play } = fixture();
    const ally = play("17020"),
      laser = play("17019");
    laser.attachedTo = ally.id;
    s.sideSchemes.push(makePiece(s, "12026"));
    expect(pack.starLordPackModifiers(s, ally.id)).toMatchObject({
      attack: 0,
      overkill: false,
    });
  });
  it("Laser Blaster cannot duplicate its printing on an ally and can attach across players", () => {
    const { s, ports, play } = fixture(true);
    const ally = play("17020", "p2");
    expect(pack.starLordPackAttachmentTargets(s, "17019", ports)).toEqual([
      ally,
    ]);
    const laser = play("17019");
    laser.attachedTo = ally.id;
    expect(pack.starLordPackAttachmentTargets(s, "17019", ports)).toEqual([]);
    expect(
      pack.starLordPackPlayRestriction(s, makePiece(s, "17019"), ports),
    ).toMatch(/Guardian ally/);
  });
  it("native attachment choices keep both physical instances", () => {
    const { s, ports, play, run, choose } = fixture();
    const ally = play("17020"),
      laser = play("17019");
    run(pack.starLordPackCardEntered(s, laser)[0]);
    choose(ally.id);
    expect(ports.attach).toHaveBeenCalledWith(s, laser.id, ally.id);
  });
  it("Blaze of Glory affects all current Guardian characters and is globally max once per round", () => {
    const { s, ports, play, run } = fixture(true);
    const guardian = play("17020", "p2"),
      nonguardian = play("01058");
    run(P("blaze"));
    expect(pack.starLordPackModifiers(s, guardian.id).attack).toBe(2);
    expect(pack.starLordPackModifiers(s, nonguardian.id).attack).toBe(0);
    expect(
      pack.starLordPackPlayRestriction(
        seatView(s, "p2"),
        makePiece(s, "17015"),
        ports,
      ),
    ).toMatch(/1 per round/);
  });
  it("Blaze recognizes Star-Lord's Guardian grant only while that identity is in hero form", () => {
    const { s, play, run } = fixture();
    s.heroId = s.players[0].heroId = "stld";
    const ally = play("01058");
    run(P("blaze"));
    expect(pack.starLordPackModifiers(s, ally.id).thwart).toBe(2);
    s.player.form = "alter";
    expect(pack.starLordPackModifiers(s, ally.id).thwart).toBe(0);
  });
  it("Blaze end-of-phase damage targets current Guardians and removes the phase bonus once", () => {
    const { s, ports, play, run } = fixture(true);
    const guardian = play("17020", "p2");
    run(P("blaze"));
    const effects = pack.starLordPackPhaseEnded(s, ports);
    expect(effects).toEqual([
      {
        type: "damage",
        target: guardian.id,
        amount: 1,
        source: "blaze-of-glory",
      },
    ]);
    expect(pack.starLordPackModifiers(s, guardian.id).attack).toBe(0);
    expect(pack.starLordPackPhaseEnded(s, ports)).toEqual([]);
  });
  it("Knowhere increases its controller's ally limit", () => {
    const { s, play } = fixture(true);
    play("17022", "p2");
    expect(pack.starLordPackAllyLimit(s)).toBe(0);
    expect(pack.starLordPackAllyLimit(seatView(s, "p2"))).toBe(1);
  });
  it("Knowhere's owner exhausts it but the player who played the ally draws", () => {
    const { s, ports, play, run } = fixture(true);
    const knowhere = play("17022", "p2"),
      ally = play("17020");
    const effects = pack.starLordPackAllyPlayed(s, ally, "p1", ports);
    expect(effects[0].actorId).toBe("p2");
    run(effects[0].effects[0], seatView(s, "p2"));
    expect(knowhere.exhausted).toBe(true);
    expect(s.queue[0]).toEqual({ type: "draw", amount: 1, actorId: "p1" });
    expect(pack.starLordPackAllyPlayed(s, ally, "p1", ports)).toEqual([]);
  });
  it("Knowhere does not trigger for a non-Guardian played ally", () => {
    const { s, ports, play } = fixture();
    play("17022");
    const ally = play("01058");
    expect(pack.starLordPackAllyPlayed(s, ally, "p1", ports)).toEqual([]);
  });
  it("Enhanced Awareness uses exactly three counters, is hero-only, and discards at zero", () => {
    const { s, ports, play } = fixture();
    const p = play("17031");
    pack.starLordPackCardEntered(s, p);
    expect(p.counters).toBe(3);
    expect(pack.starLordPackResourceSources(s)[0].resources).toEqual([
      "mental",
    ]);
    pack.starLordPackResourceSpent(s, p.id, ports);
    expect(p.counters).toBe(2);
    expect(pack.starLordPackResourceSources(s)).toEqual([]);
    p.exhausted = false;
    p.counters = 1;
    pack.starLordPackResourceSpent(s, p.id, ports);
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
    s.player.form = "alter";
    expect(pack.starLordPackResourceSources(s)).toEqual([]);
  });
  it.each(["17028", "17029", "17030"])(
    "%s enforces the actual Aerial identity requirement",
    (code) => {
      const { s, ports } = fixture();
      expect(
        pack.starLordPackPlayRestriction(s, makePiece(s, code), ports),
      ).toMatch(/Aerial/);
    },
  );
  it("Air Supremacy counts controlled Aerial characters, chooses different enemies, and deals a simultaneous non-attack batch", () => {
    const { s, ports, play, run, choose, flush } = fixture(true);
    play("17011");
    play("17011", "p2");
    const m = makePiece(s, "01102");
    s.minions.push(m);
    run(P("air", { selected: [] }));
    choose("villain");
    flush();
    expect(ports.damageDistribution).toHaveBeenCalledWith(
      s,
      [{ target: "villain", amount: 3 }],
      { source: "hero" },
    );
  });
  it("Air Supremacy supports choosing no enemies", () => {
    const { s, ports, play, run, choose, flush } = fixture();
    play("17011");
    run(P("air", { selected: [] }));
    choose("finish");
    flush();
    expect(ports.damageDistribution).toHaveBeenCalledWith(s, [], {
      source: "hero",
    });
  });
  it("Dive Bomb commits its seven-damage attack before its one-damage secondary batch", () => {
    const { s, ports, run } = fixture();
    const m = makePiece(s, "01102");
    s.minions.push(m);
    run(P("dive", { target: m.id }));
    expect(ports.attackProgram).toHaveBeenCalledWith(s, [
      expect.objectContaining({
        type: "damage",
        target: m.id,
        amount: 7,
        attack: true,
      }),
      P("dive-others", { target: m.id }),
    ]);
    run(P("dive-others", { target: m.id }));
    expect(ports.damageDistribution).toHaveBeenCalledWith(
      s,
      [{ target: "villain", amount: 1 }],
      { source: "hero" },
    );
  });
  it("Agile Flight allocates at most five actual threat before moving any of it", () => {
    const { s, ports, run, choose, flush } = fixture();
    const side = makePiece(s, "01107");
    side.counters = 2;
    s.sideSchemes.push(side);
    run(P("flight", { packets: [], remaining: 5 }));
    choose(side.id + ":2");
    expect(s.scheme.threat).toBe(5);
    expect(side.counters).toBe(2);
    choose("main:3");
    flush();
    expect(ports.threatDistribution).toHaveBeenCalledWith(s, [
      { target: side.id, amount: 2 },
      { target: "main", amount: 3 },
    ]);
  });
  it("Ever Vigilant's removal is not a thwart and bypasses Patrol while retaining ordinary Crisis rules", () => {
    const { s } = fixture();
    expect(pack.starLordPackEvent(s, makePiece(s, "17030"))).toEqual([
      { type: "ready", target: "hero" },
      {
        type: "thwart",
        target: "main",
        amount: 2,
        source: "hero",
        ignorePatrol: true,
      },
    ]);
  });
  it("C.I.T.T. pays its exhaust cost before its locked resource payment and readies a Guardian only", () => {
    const { s, ports, play, run, choose } = fixture();
    const citt = play("17021"),
      cosmo = play("17020");
    cosmo.exhausted = true;
    run(pack.starLordPackAbilityOptions(s, citt.id, ports)[0].effects[0]);
    expect(citt.exhausted).toBe(true);
    expect(s.queue[0]).toMatchObject({
      type: "payRequest",
      cost: 2,
      cancelable: false,
    });
    run(s.queue.shift()!.after[0]);
    choose(cosmo.id);
    expect(s.queue[0]).toEqual({ type: "ready", target: cosmo.id });
  });
  it("C.I.T.T. respects absolute cannot-ready restrictions", () => {
    const { s, ports, play } = fixture();
    const citt = play("17021"),
      cosmo = play("17020");
    cosmo.exhausted = true;
    vi.mocked(ports.canReady!).mockReturnValue(false);
    expect(pack.starLordPackAbilityOptions(s, citt.id, ports)).toEqual([]);
  });
  it("Pulse Grenade is discarded as a cost and counts numeric boost icons without resolving boost abilities", () => {
    const { s, ports, play, run } = fixture();
    const p = play("17023");
    run(P("grenade", { id: p.id }));
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
    s.queue = [];
    s.encounter.deck = [makePiece(s, "01104"), makePiece(s, "01103")];
    run(P("grenade-count", { target: "villain" }));
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: (card("01104").boost || 0) + (card("01103").boost || 0),
      attack: true,
    });
    expect(ports.discardEncounterTop).toHaveBeenCalledTimes(2);
  });
  it("a stunned Pulse Grenade still pays its discard cost and does not discard encounter cards", () => {
    const { s, ports, play, run } = fixture();
    const p = play("17023");
    s.player.stunned = true;
    run(P("grenade", { id: p.id }));
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
    expect(ports.discardEncounterTop).not.toHaveBeenCalled();
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: 0,
      attack: true,
    });
  });
  it("Pulse Grenade stops discarding when the original encounter deck is exhausted", () => {
    const { s, ports, run } = fixture();
    const top = makePiece(s, "01104");
    vi.mocked(ports.discardEncounterTop).mockImplementationOnce((state) => {
      state.encounter.acceleration++;
      state.encounter.deck = [top];
      return { piece: top, emptied: true };
    });
    run(P("grenade-count", { target: "villain" }));
    expect(ports.discardEncounterTop).toHaveBeenCalledOnce();
    expect(s.queue[0].amount).toBe(card(top).boost || 0);
    expect(s.encounter.deck).toEqual([top]);
  });
  it("Target Practice requires a Weapon upgrade attached to the attacking ally", () => {
    const { s, ports, play } = fixture();
    const p = play("17020"),
      support = play("17017"),
      packet = { type: "allyAction", kind: "attack", id: p.id, amount: 1 };
    expect(
      pack
        .starLordPackBeforeAllyBasicOptions(s, p, packet, [], ports)
        .map((o) => o.id),
    ).not.toContain(support.id);
    const laser = play("17019");
    laser.attachedTo = p.id;
    expect(
      pack
        .starLordPackBeforeAllyBasicOptions(s, p, packet, [], ports)
        .map((o) => o.id),
    ).toContain(support.id);
    expect(
      pack
        .starLordPackBeforeAllyBasicOptions(
          s,
          p,
          { ...packet, kind: "thwart" },
          [],
          ports,
        )
        .map((o) => o.id),
    ).not.toContain(support.id);
  });
  it("another player's Target Practice can enhance the declared ally's attack", () => {
    const { s, ports, play, run } = fixture(true);
    const p = play("17020"),
      support = play("17017", "p2"),
      laser = play("17019");
    laser.attachedTo = p.id;
    const packet = {
      type: "allyAction",
      kind: "attack",
      id: p.id,
      target: "villain",
      amount: 2,
    };
    const o = pack
      .starLordPackBeforeAllyBasicOptions(s, p, packet, [], ports)
      .find((o) => o.id === support.id)!;
    expect(o.effects[0].actorId).toBe("p2");
    run(o.effects[0], seatView(s, "p2"));
    expect(s.queue[0]).toMatchObject({
      amount: 4,
      actorId: "p1",
      target: "villain",
    });
  });
  it("Cosmo names the type before selecting any player deck or the encounter deck, and preserves only this use's consequence prevention", () => {
    const { s, ports, play, run, choose } = fixture(true);
    const cosmo = play("17020"),
      top = makePiece(s, "01086");
    seatView(s, "p2").player.deck.push(top);
    const packet = {
      type: "allyAction",
      kind: "attack",
      id: cosmo.id,
      amount: 1,
      target: "villain",
    };
    run(
      pack.starLordPackBeforeAllyBasicOptions(s, cosmo, packet, [], ports)[0]
        .effects[0],
    );
    expect(s.prompt!.title).toBe("Cosmo");
    choose("event");
    expect(s.prompt!.options.map((o) => o.id)).toContain("p2");
    choose("p2");
    expect(s.queue[0]).toMatchObject({
      starPackCosmoHandled: true,
      starPackCosmoSafe: true,
      target: "villain",
    });
    expect(pack.starLordPackConsequentialDamage(s.queue[0], 1)).toBe(0);
    expect(pack.starLordPackConsequentialDamage(packet, 1)).toBe(1);
  });
  it("Cosmo's failed prediction still permits its attack but keeps consequential damage", () => {
    const { s, ports, play, run, choose } = fixture();
    const cosmo = play("17020");
    s.encounter.deck.push(makePiece(s, "01102"));
    const packet = {
      type: "allyAction",
      kind: "thwart",
      id: cosmo.id,
      amount: 1,
    };
    run(
      pack.starLordPackBeforeAllyBasicOptions(s, cosmo, packet, [], ports)[0]
        .effects[0],
    );
    choose("event");
    choose("encounter");
    expect(s.queue[0].starPackCosmoSafe).toBe(false);
    expect(pack.starLordPackConsequentialDamage(s.queue[0], 1)).toBe(1);
  });
  it("Cosmo and Target Practice do not trigger on a status-replaced ally use", () => {
    const { s, ports, play } = fixture();
    const cosmo = play("17020");
    cosmo.stunned = true;
    expect(
      pack.starLordPackBeforeAllyBasicOptions(
        s,
        cosmo,
        { type: "allyAction", kind: "attack" },
        [],
        ports,
      ),
    ).toEqual([]);
  });
  it.each([
    ["01089", "mental"],
    ["01088", "energy"],
    ["01090", "physical"],
  ])(
    "Adam Warlock uses the printed resource of the actual randomly discarded %s",
    (code, kind) => {
      const { s, ports, play, run } = fixture();
      const adam = play("17011"),
        p = makePiece(s, code);
      s.player.hand.push(p);
      run(P("adam", { id: adam.id }));
      expect(ports.randomIndex).toHaveBeenCalledWith(s, 1);
      expect(s.player.discard).toContain(p);
      expect(s.queue[0]).toEqual(P("adam-resource", { kind, source: adam.id }));
    },
  );
  it("Adam Warlock's wild choice does not draw or substitute a different physical card", () => {
    const { s, play, run, flush, choose } = fixture();
    const adam = play("17011"),
      p = makePiece(s, "01072");
    s.player.hand.push(p);
    run(P("adam", { id: adam.id }));
    flush();
    choose("mental");
    expect(s.queue[0]).toMatchObject({
      type: "target",
      group: "enemy",
      action: { type: "damage", amount: 3, source: adam.id },
    });
    expect(s.player.hand).toEqual([]);
  });
  it("Adam Warlock resolves Salvage's printed mental effect and one independent wild choice", () => {
    const { s, play, run } = fixture();
    const adam = play("17011");
    s.player.hand.push(makePiece(s, "16033"));
    run(P("adam", { id: adam.id }));
    expect(s.queue).toEqual([
      P("adam-resource", { kind: "mental", source: adam.id }),
      P("adam-wild", { source: adam.id }),
    ]);
  });
  it("Adam Warlock's heal can select another damaged identity", () => {
    const { s, run, choose } = fixture(true);
    seatView(s, "p2").player.hp = 5;
    s.player.hp = 10;
    run(P("adam-resource", { kind: "energy", source: "adam" }));
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["p2"]);
    choose("p2");
    expect(s.queue[0]).toEqual({ type: "heal", target: "hero:p2", amount: 3 });
  });
  it("Beta Ray Bill requires an actual attack defeat of a minion", () => {
    const { s, play } = fixture();
    const p = play("17012");
    expect(
      pack.starLordPackAfterAllyBasic(s, p, {
        attack: true,
        defeatedMinion: true,
      })[0].effects[0],
    ).toMatchObject({
      type: "thwart",
      target: "main",
      amount: 2,
      ignorePatrol: true,
    });
    expect(
      pack.starLordPackAfterAllyBasic(s, p, {
        attack: true,
        defeatedMinion: false,
      }),
    ).toEqual([]);
    expect(
      pack.starLordPackAfterAllyBasic(s, p, {
        attack: false,
        defeatedMinion: true,
      }),
    ).toEqual([]);
  });
  it("optional interruptions retain JSON-serializable physical continuations", () => {
    const { s, ports, play } = fixture();
    const cosmo = play("17020");
    const options = pack.starLordPackBeforeAllyBasicOptions(
      s,
      cosmo,
      {
        type: "allyAction",
        id: cosmo.id,
        kind: "attack",
        amount: 1,
        target: "villain",
      },
      [{ type: "sentinel" }],
      ports,
    );
    expect(JSON.parse(JSON.stringify(options))).toEqual(options);
  });
});

describe("retail shared-pack native host adapters", () => {
  it("C.I.T.T. doubles The Power in All of Us for its Basic ability cost (RRG 1.8 p13)", () => {
    const s = nativeBase("gam"),
      citt = nativePut(s, "17021"),
      cosmo = nativePut(s, "17020");
    cosmo.exhausted = true;
    nativeHand(s, "13024");
    expect(nativeHeroAbilityOptions(s, citt.id)[0].id).toBe("ready-guardian");
  });
  it("C.I.T.T. pays two resources from one Power in All of Us, then readies its selected Guardian after JSON reload", () => {
    let s = nativeBase("gam");
    const citt = nativePut(s, "17021"),
      cosmo = nativePut(s, "17020"),
      [power, ordinary] = nativeHand(s, "13024", "01086");
    cosmo.exhausted = true;
    s = nativeCommand(s, {
      type: "ABILITY",
      id: citt.id,
      action: "ready-guardian",
    });
    expect(s.prompt).toMatchObject({ kind: "payment", cost: 2 });
    expect(
      paymentSources(s, undefined, s.prompt?.paymentTarget).find(
        (p) => p.id === power.id,
      )?.resources,
    ).toEqual(["wild", "wild"]);
    s = nativeFinish(nativeCommand(s, { type: "PAY", ids: [power.id] }));
    expect(s.player.inPlay.find((p) => p.id === citt.id)?.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === cosmo.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.hand.some((p) => p.id === ordinary.id)).toBe(true);
    nativeConserved(s, [citt, cosmo, power, ordinary]);
  });
  it("Enhanced Awareness's physical printing enters with three Uses and pays a later card through the native payment adapter", () => {
    let s = nativeBase("gam");
    const [awareness, power] = nativeHand(s, "17031", "13024");
    s = nativeFinish(nativePlay(s, awareness, [power]));
    expect(s.player.inPlay.find((p) => p.id === awareness.id)?.counters).toBe(
      3,
    );
    const [instincts] = nativeHand(s, "18009");
    s = nativeCommand(s, { type: "PLAY", id: instincts.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(
      paymentSources(s, instincts.id, instincts.code).find(
        (p) => p.id === awareness.id,
      )?.resources,
    ).toEqual(["mental"]);
    s = nativeFinish(nativeCommand(s, { type: "PAY", ids: [awareness.id] }));
    expect(s.player.inPlay.find((p) => p.id === awareness.id)).toMatchObject({
      counters: 2,
      exhausted: true,
    });
    expect(s.player.inPlay.some((p) => p.id === instincts.id)).toBe(true);
    nativeConserved(s, [awareness, power, instincts]);
  });
});
