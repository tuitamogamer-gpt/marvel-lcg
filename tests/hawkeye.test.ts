import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine.js";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import {
  activateSeat,
  controller,
  seatView,
  syncSeat,
} from "../src/game/team.js";
import { compileCardScript } from "../src/game/scripts/compiler.js";
import { giveStatus } from "../src/game/keywords.js";
import type {
  Card,
  Effect,
  GameState,
  Piece,
  Resource,
} from "../src/game/types.js";
import {
  HAWKEYE_CORE_ALIASES,
  HAWKEYE_EXISTING_CODES,
  HAWKEYE_COMPILED_CODES,
  HAWKEYE_SCRIPT_CODES,
  hawkeyeStats,
  hawkeyeAllyMaxHP,
  hawkeyeAllyAttackTraits,
  hawkeyeAllyAerial,
  hawkeyeEnemyAttackTraits,
  hawkeyePlayRestriction,
  hawkeyeEvent,
  hawkeyeCardEntered,
  hawkeyeStoredPlayable,
  hawkeyeTakeStoredForPlay,
  hawkeyeResourceSources,
  hawkeyeAbilityOptions,
  hawkeyeAbility,
  hawkeyeAttackInitiatedOptions,
  hawkeyeEncounterReveal,
  hawkeyeBoost,
  hawkeyeSchemeDefeated,
  hawkeyePhaseEnded,
  resolveHawkeyeEffect,
  type HawkeyePorts,
} from "../src/game/hawkeye.js";

const sourceCards = catalog as unknown as Card[];
const card = (p: Piece | string) =>
  sourceCards.find((c) => c.code === (typeof p === "string" ? p : p.code))!;
const H = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `hawkeye:${type}`,
  ...args,
});
function fixture() {
  const s = newGame({
    heroId: "spider_man",
    aspect: "leadership",
    villainId: "rhino",
    seed: 401,
  });
  s.heroId = s.players[0].heroId = "hawkeye";
  s.phase = "player";
  s.player.form = "hero";
  s.player.hp = 9;
  s.player.hand = [];
  s.player.deck = [];
  s.player.discard = [];
  s.player.inPlay = [];
  s.queue = [];
  s.prompt = null;
  s.review = null;
  let locked = false;
  const ports: HawkeyePorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    revealHidden: vi.fn((state: GameState) => {
      state.hiddenInfo = (state.hiddenInfo || 0) + 1;
    }),
    shufflePlayerDeck: vi.fn(),
    recyclePlayer: vi.fn(),
    discardHand: (state, id) => {
      const i = state.player.hand.findIndex((p) => p.id === id);
      if (i < 0) throw Error("Not in hand");
      state.player.discard.push(state.player.hand.splice(i, 1)[0]);
    },
    discardPiece: (state, id) => {
      const owner = controller(state, id);
      const zones = [
        ...state.players.map((seat) => seatView(state, seat).player.inPlay),
        state.attachments,
        state.sideSchemes,
      ];
      const zone = zones.find((x) => x.some((p) => p.id === id));
      const p = zone?.find((x) => x.id === id);
      if (!p) throw Error("Not in play");
      for (const a of state.players
        .flatMap((seat) => seatView(state, seat).player.inPlay)
        .filter((x) => x.attachedTo === id))
        ports.discardPiece(state, a.id);
      zone!.splice(zone!.indexOf(p), 1);
      p.exhausted = false;
      p.damage = 0;
      p.bonusAtk = 0;
      p.attachedTo = undefined;
      if (card(p).faction_code === "encounter") state.encounter.discard.push(p);
      else seatView(state, p.ownerId || owner!.id).player.discard.push(p);
    },
    returnAlly: vi.fn((state: GameState, id: string) => {
      const p = state.players
        .flatMap((seat) => seatView(state, seat).player.inPlay)
        .find((x) => x.id === id)!;
      const owner = p.ownerId!;
      ports.discardPiece(state, id);
      const view = seatView(state, owner),
        i = view.player.discard.findIndex((x) => x.id === id);
      view.player.hand.push(view.player.discard.splice(i, 1)[0]);
    }),
    transferControl: (state, id, playerId) => {
      const old = controller(state, id)!;
      const zone = seatView(state, old).player.inPlay,
        i = zone.findIndex((p) => p.id === id);
      seatView(state, playerId).player.inPlay.push(zone.splice(i, 1)[0]);
    },
    canChangeForm: () => !locked,
    flip: (state) => {
      state.player.form = state.player.form === "hero" ? "alter" : "hero";
    },
    canReadyIdentity: () => !locked,
    identityHasTrait: () => true,
    canPay: (state, cost, requirements: Resource[] = [], exclude) => {
      const available = state.player.hand
        .filter((p) => p.id !== exclude)
        .flatMap((p) =>
          (["energy", "mental", "physical", "wild"] as Resource[]).flatMap(
            (r) => Array(card(p)[`resource_${r}`] || 0).fill(r),
          ),
        );
      return (
        available.length >= cost &&
        requirements.every(
          (r) => available.includes(r) || available.includes("wild"),
        )
      );
    },
    enemyTargets: (state, attack) =>
      [
        ...(!(
          attack &&
          state.minions.some((p) => card(p).text?.startsWith("Guard."))
        )
          ? [state.villain]
          : []),
        ...state.minions,
      ].map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    schemeTargets: (state, ignoreCrisis) => [
      ...(state.scheme.threat &&
      (ignoreCrisis || !state.sideSchemes.some((p) => card(p).scheme_crisis))
        ? [
            {
              id: "main",
              label: card(state.scheme.code).name,
              code: state.scheme.code,
            },
          ]
        : []),
      ...state.sideSchemes
        .filter((p) => p.counters > 0)
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    preventAllAttackDamage: vi.fn(),
    log: vi.fn(),
  };
  const make = (code: string) => makePiece(s, code);
  const play = (code: string) => {
    const p = make(code);
    s.player.inPlay.push(p);
    return p;
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map(make);
    return s.player.hand;
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    expect(resolveHawkeyeEffect(s, e, ports)).toBe(true);
  };
  const drain = () => {
    let guard = 0;
    while (s.queue[0]?.type.startsWith("hawkeye:") && !s.prompt && guard++ < 40)
      run(s.queue.shift()!);
  };
  const choose = (id: string) => {
    const choice = s.prompt!.options.find((o) => o.id === id);
    expect(choice).toBeTruthy();
    s.prompt = null;
    s.queue.unshift(...choice!.effects);
    drain();
  };
  const second = () => {
    syncSeat(s);
    const copy = structuredClone(s.players[0]);
    copy.id = "p2";
    copy.heroId = "captain_marvel";
    copy.player.inPlay = [];
    copy.player.hand = [];
    copy.player.deck = [];
    copy.player.discard = [];
    copy.flags = {};
    s.players.push(copy);
    s.playerCount = 2;
    return copy;
  };
  return {
    s,
    ports,
    play,
    make,
    hand,
    run,
    choose,
    drain,
    second,
    lock: () => {
      locked = true;
    },
  };
}
describe("Hawkeye's entire source-preconstructed Rise of Red Skull half", () => {
  it("assigns all31 faces once to native, Core-equivalent, existing Tower, or compiled whole text", () => {
    const source = sourceCards.filter(
      (c) => c.pack_code === "trors" && c.position <= 30,
    );
    const assigned = [
      ...HAWKEYE_SCRIPT_CODES,
      ...HAWKEYE_CORE_ALIASES,
      ...HAWKEYE_EXISTING_CODES,
      ...HAWKEYE_COMPILED_CODES,
    ];
    expect(source).toHaveLength(31);
    expect(new Set(assigned).size).toBe(31);
    expect([...assigned].sort()).toEqual(source.map((c) => c.code).sort());
    for (const code of HAWKEYE_CORE_ALIASES)
      expect(compileCardScript(card(code)).implementation).toBe("core");
    for (const code of HAWKEYE_COMPILED_CODES)
      expect(compileCardScript(card(code)).status).toBe("supported");
    expect(card("04021").text).toBe(card("03024").text);
  });
  it("fails closed for unknown module effects and leaves unrelated effects to native dispatcher", () => {
    const { s, ports } = fixture();
    expect(resolveHawkeyeEffect(s, { type: "draw" }, ports)).toBe(false);
    expect(() => resolveHawkeyeEffect(s, H("guess"), ports)).toThrow(
      "Unimplemented Hawkeye",
    );
  });
  it("Bow modifies the controlling hero only in hero form and Quick Draw pays hero exhaustion", () => {
    const { s, play, ports, run } = fixture(),
      b = play("04002");
    expect(hawkeyeStats(s).atk).toBe(1);
    b.exhausted = true;
    expect(hawkeyeAbility(s, "hero", "quick-draw", ports)).toEqual([
      H("quick-draw"),
    ]);
    run(H("quick-draw"));
    expect(s.player.exhausted).toBe(true);
    expect(b.exhausted).toBe(false);
    expect(hawkeyeAbilityOptions(s, "hero", ports)).toEqual([]);
    s.player.form = "alter";
    expect(hawkeyeStats(s).atk).toBe(0);
  });
  it("Weapon of Choice spends through native payment, takes the exact discarded Bow, shuffles, and limits by phase", () => {
    const { s, ports, make, hand, run } = fixture();
    s.player.form = "alter";
    hand("04023");
    const b = make("04002");
    s.player.discard.push(b);
    const ability = hawkeyeAbilityOptions(s, "hero", ports)[0];
    expect(ability.effects[0]).toMatchObject({
      type: "payRequest",
      cost: 1,
      targetCode: "04001b",
      cancelable: true,
    });
    run(ability.effects[0].after[0]);
    expect(s.player.hand).toContain(b);
    expect(s.player.discard).not.toContain(b);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    s.player.hand = [];
    s.player.discard.push(b);
    hand("04023");
    expect(hawkeyeAbilityOptions(s, "hero", ports)).toEqual([]);
    s.phase = "villain";
    expect(hawkeyeAbilityOptions(s, "hero", ports)).toHaveLength(1);
  });
  it("Quiver searches only top5, offers an explicit miss, tucks the chosen physical Arrow and shuffles the entire deck", () => {
    const { s, ports, make, play, run, choose } = fixture(),
      q = play("04003");
    const deck = ["04023", "04005", "04024", "04007", "04025", "04009"].map(
      make,
    );
    s.player.deck = [...deck];
    run(H("quiver", { id: q.id }));
    expect(q.exhausted).toBe(true);
    expect(s.prompt!.options.map((o) => o.id)).toEqual([
      deck[1].id,
      deck[3].id,
      "none",
    ]);
    choose(deck[3].id);
    expect(q.storedCards?.map((p) => p.id)).toEqual([deck[3].id]);
    expect(s.player.deck.map((p) => p.id)).toEqual(
      deck.filter((_, i) => i !== 3).map((p) => p.id),
    );
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    expect(ports.revealHidden).toHaveBeenCalledOnce();
  });
  it("Quiver's saved search retains exact eligibility and its public stored card is played once, never offered as a resource", () => {
    const { s, ports, make, play, run } = fixture(),
      q = play("04003"),
      a = make("04005");
    s.player.deck = [a];
    run(H("quiver", { id: q.id }));
    const saved = JSON.parse(JSON.stringify(s)) as GameState;
    const selected = saved.prompt!.options[0].effects[0];
    saved.prompt = null;
    resolveHawkeyeEffect(saved, selected, ports);
    expect(hawkeyeStoredPlayable(saved).map((p) => p.id)).toEqual([a.id]);
    expect(saved.player.hand).toEqual([]);
    expect(hawkeyeTakeStoredForPlay(saved, a.id)?.id).toBe(a.id);
    expect(hawkeyeTakeStoredForPlay(saved, a.id)).toBeUndefined();
    expect(hawkeyeStoredPlayable(saved)).toEqual([]);
  });
  it("Quiver can find no card and still shuffles, while a forged sixth-card selection fails closed", () => {
    const { s, make, play, run, ports } = fixture(),
      q = play("04003");
    const deck = Array.from({ length: 6 }, () => make("04005"));
    s.player.deck = deck;
    run(H("quiver", { id: q.id }));
    expect(() =>
      resolveHawkeyeEffect(
        s,
        H("quiver-found", {
          id: q.id,
          target: deck[5].id,
          searched: deck.slice(0, 5).map((p) => p.id),
        }),
        ports,
      ),
    ).toThrow("not an Arrow in this search");
    resolveHawkeyeEffect(
      s,
      H("quiver-found", {
        id: q.id,
        searched: deck.slice(0, 5).map((p) => p.id),
      }),
      ports,
    );
    expect(q.storedCards || []).toEqual([]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("Expert Marksman sources exhaust only for Arrow events, including alter-ego resource windows, never ability costs or allies", () => {
    const { s, play } = fixture();
    const a = play("04010"),
      b = play("04010");
    b.exhausted = true;
    expect(hawkeyeResourceSources(s, "04005").map((p) => p.id)).toEqual([a.id]);
    expect(hawkeyeResourceSources(s, "04005")[0].resources).toEqual(["wild"]);
    for (const code of [undefined, "04004", "04001b", "04029", "04017"])
      expect(hawkeyeResourceSources(s, code)).toEqual([]);
    s.player.form = "alter";
    expect(hawkeyeResourceSources(s, "04005")).toHaveLength(1);
  });
  it.each(["04005", "04007", "04009"])(
    "%s exhausts Bow before stunned replaces the entire attack without status or damage",
    (code) => {
      const { s, play, run, drain } = fixture(),
        b = play("04002");
      s.player.stunned = true;
      s.player.stunCards = 1;
      run(hawkeyeEvent(s, makePiece(s, code))![0]);
      drain();
      expect(b.exhausted).toBe(true);
      expect(s.player.stunned).toBe(false);
      expect(s.queue).toEqual([]);
      expect(s.prompt).toBeNull();
    },
  );
  it.each([
    ["04005", "confused"],
    ["04007", "stunned"],
  ] as const)(
    "%s evaluates already-%s BEFORE its simultaneous status placement",
    (code, status) => {
      const { s, play, run, drain } = fixture();
      play("04002");
      run(H("arrow", { code }));
      drain();
      expect(s.queue).toEqual([
        expect.objectContaining({
          type: "status",
          status,
          target: s.villain.id,
        }),
        expect.objectContaining({
          type: "damage",
          amount: 3,
          attack: true,
          attackInitiated: true,
          ranged: true,
        }),
      ]);
      s.queue = [];
      s.player.inPlay[0].exhausted = false;
      s.villain[status] = true;
      run(H("arrow", { code }));
      drain();
      expect(s.queue[1].amount).toBe(5);
    },
  );
  it("Steady's first status leaves Sonic Arrow at3, and a Stalwart enemy still takes its damage", () => {
    const { s, play, run, drain } = fixture();
    play("04002");
    s.villain.confused = false;
    s.villain.confuseCards = 1;
    run(H("arrow", { code: "04005" }));
    drain();
    expect(s.queue[1].amount).toBe(3);
    const c = { ...card(s.villain), text: "Stalwart." };
    expect(giveStatus(s.villain, c, "confused")).toBe(false);
    expect(s.queue[1].amount).toBe(3);
  });
  it("Vibranium Arrow dispatches one ranged and piercing6 attack after Bow cost", () => {
    const { s, play, run, drain } = fixture();
    play("04002");
    run(H("arrow", { code: "04009" }));
    drain();
    expect(s.queue).toEqual([
      expect.objectContaining({
        type: "damage",
        amount: 6,
        piercing: true,
        ranged: true,
        attack: true,
      }),
    ]);
  });
  it("Cable Arrow targets main through Crisis and pays Bow cost when Confused replaces the thwart", () => {
    const { s, play, make, run, choose } = fixture(),
      b = play("04002"),
      scheme = make("01108");
    scheme.counters = 5;
    s.sideSchemes = [scheme];
    s.scheme.threat = 5;
    run(H("arrow", { code: "04008" }));
    expect(s.prompt!.options.some((o) => o.id === "main")).toBe(true);
    choose("main");
    expect(s.queue[0]).toMatchObject({
      type: "thwart",
      amount: 3,
      ignoreCrisis: true,
      action: true,
    });
    s.queue = [];
    b.exhausted = false;
    s.player.confused = true;
    run(H("arrow", { code: "04008" }));
    expect(b.exhausted).toBe(true);
    expect(s.player.confused).toBe(false);
    expect(s.queue).toEqual([]);
  });
  it("Explosive Arrow is non-attack damage, works through Stunned and Guard, and uses chosen player's engagement", () => {
    const { s, play, make, run, choose, second } = fixture(),
      teammate = second();
    play("04002");
    s.player.stunned = true;
    const mine = make("01101"),
      theirs = make("01101");
    mine.engagedWith = s.activePlayerId;
    theirs.engagedWith = teammate.id;
    s.minions = [mine, theirs];
    run(H("arrow", { code: "04006" }));
    choose(teammate.id);
    expect(s.player.stunned).toBe(true);
    expect(s.queue.map((e) => e.target)).toEqual([s.villain.id, theirs.id]);
    expect(
      s.queue.every((e) => !e.attack && e.amount === 3 && e.source === "hero"),
    ).toBe(true);
  });
  it("Kate Bishop discards exact chosen printed resources, does not double Power of Leadership, and never attacks", () => {
    const { s, play, hand, run, choose } = fixture(),
      kate = play("04011"),
      [power] = hand("04019", "04023");
    run(H("kate-bishop", { id: kate.id }));
    expect(kate.exhausted).toBe(false);
    choose(power.id);
    expect(kate.exhausted).toBe(true);
    expect(s.player.discard).toContain(power);
    expect(s.queue[0]).toMatchObject({
      type: "damage",
      amount: 1,
      source: kate.id,
    });
    expect(s.queue[0].attack).toBeUndefined();
  });
  it("Goliath can act while exhausted, gains4 until real phase end, and the delayed discard survives reload", () => {
    const { s, play, run, ports } = fixture(),
      p = play("04013");
    p.exhausted = true;
    run(H("goliath", { id: p.id }));
    expect(p.bonusAtk).toBe(4);
    expect(hawkeyeAbilityOptions(s, p.id, ports)).toEqual([]);
    const saved = JSON.parse(JSON.stringify(s)) as GameState;
    hawkeyePhaseEnded(saved, ports);
    expect(saved.player.inPlay).toEqual([]);
    expect(saved.player.discard.map((x) => x.id)).toEqual([p.id]);
  });
  it("Team Training transfers control without changing physical ownership and raises only that controller's ally health", () => {
    const { s, second, play, make, run, choose } = fixture(),
      teammate = second(),
      ally = play("04004"),
      support = play("04016"),
      theirs = make("04020");
    theirs.ownerId = teammate.id;
    teammate.player.inPlay.push(theirs);
    run(hawkeyeCardEntered(s, support)[0]);
    choose(teammate.id);
    expect(controller(s, support.id)?.id).toBe(teammate.id);
    expect(support.ownerId).toBe("p1");
    expect(hawkeyeAllyMaxHP(s, ally)).toBe(0);
    expect(hawkeyeAllyMaxHP(s, theirs)).toBe(1);
  });
  it("Goliath's delayed discard forgets a physical card that left play and entered as a new instance", () => {
    const { s, play, run, ports } = fixture();
    const p = play("04013");
    run(H("goliath", { id: p.id }));
    s.player.inPlay = [
      {
        id: p.id,
        code: p.code,
        ownerId: p.ownerId,
        exhausted: false,
        damage: 0,
        counters: 0,
        tough: false,
        stunned: false,
        confused: false,
      },
    ];
    hawkeyePhaseEnded(s, ports);
    expect(s.player.inPlay.map((x) => x.id)).toEqual([p.id]);
    expect(s.player.discard).toEqual([]);
    expect(s.flags[`hawkeyeGoliath:${p.id}`]).toBeUndefined();
  });
  it("Goliath's delayed discard tracks continuous play through a control transfer", () => {
    const { s, second, play, run, ports } = fixture();
    const teammate = second(),
      p = play("04013");
    run(H("goliath", { id: p.id }));
    ports.transferControl(s, p.id, teammate.id);
    hawkeyePhaseEnded(s, ports);
    expect(teammate.player.inPlay).toEqual([]);
    expect(s.player.discard.map((x) => x.id)).toContain(p.id);
  });
  it("Team Training rejects a second support under an occupied controller", () => {
    const { s, ports, play, make } = fixture();
    play("04016");
    expect(hawkeyePlayRestriction(s, make("04016"), ports)).toContain(
      "already controls",
    );
  });
  it("Sky Cycle attaches to another player's Avenger, grants Aerial, and readies by exhausting only the upgrade", () => {
    const { s, second, make, play, run, drain, ports } = fixture(),
      teammate = second(),
      ally = make("04020"),
      cycle = play("04015");
    ally.ownerId = teammate.id;
    ally.exhausted = true;
    teammate.player.inPlay.push(ally);
    run(hawkeyeCardEntered(s, cycle)[0]);
    drain();
    expect(cycle.attachedTo).toBe(ally.id);
    expect(hawkeyeAllyAerial(s, ally)).toBe(true);
    run(hawkeyeAbilityOptions(s, cycle.id, ports)[0].effects[0]);
    expect(cycle.exhausted).toBe(true);
    expect(s.queue[0]).toMatchObject({ type: "ready", target: ally.id });
    expect(hawkeyePlayRestriction(s, make("04015"), ports)).toContain(
      "no eligible",
    );
  });
  it("Ready for Action chooses only this controller's non-Tough ally", () => {
    const { s, second, make, play, run } = fixture(),
      teammate = second(),
      ally = play("04004");
    teammate.player.inPlay.push(make("04020"));
    run(H("ready-for-action"));
    expect(s.queue).toEqual([
      { type: "status", status: "tough", target: ally.id },
    ]);
  });
  it("Earth's Mightiest Heroes chooses the cost and different exhausted target before exhausting either", () => {
    const { s, play, run, choose } = fixture(),
      a = play("04004"),
      b = play("04011");
    b.exhausted = true;
    s.player.exhausted = true;
    run(H("earths-mightiest"));
    expect(a.exhausted).toBe(false);
    expect(s.queue[0]?.type || s.prompt?.title).toBeTruthy();
    if (s.prompt) choose(a.id);
    else {
      run(s.queue.shift()!);
    }
    expect(a.exhausted).toBe(false);
    choose("hero");
    expect(a.exhausted).toBe(true);
    expect(s.queue[0]).toMatchObject({ type: "ready", target: "hero" });
    expect(b.exhausted).toBe(true);
  });
  it("Earth's Mightiest Heroes cannot exhaust its only Avenger or bypass an identity ready lock", () => {
    const { s, play, make, ports, lock } = fixture();
    const a = play("04011");
    expect(hawkeyePlayRestriction(s, make("04022"), ports)).toContain(
      "one ready",
    );
    s.player.exhausted = true;
    expect(hawkeyePlayRestriction(s, make("04022"), ports)).toBeNull();
    lock();
    expect(hawkeyePlayRestriction(s, make("04022"), ports)).toContain(
      "one ready",
    );
    a.exhausted = true;
  });
  it("ally attacks and nemesis attacks preserve their different native keywords", () => {
    const { s, make } = fixture();
    const knight = make("04012"),
      warmachine = make("04020"),
      crossfire = make("04027"),
      rifle = make("04029");
    s.minions.push(crossfire);
    rifle.attachedTo = crossfire.id;
    s.attachments.push(rifle);
    expect(hawkeyeAllyAttackTraits(knight)).toEqual({
      piercing: true,
      ranged: false,
    });
    expect(hawkeyeAllyAttackTraits(warmachine)).toEqual({
      piercing: false,
      ranged: true,
    });
    expect(hawkeyeEnemyAttackTraits(s, crossfire)).toEqual({
      piercing: true,
      ranged: true,
    });
    expect(hawkeyeEnemyAttackTraits(s, s.villain)).toEqual({
      piercing: false,
      ranged: false,
    });
  });
  it("Mockingbird's exact initiation interrupt is offered only against her controller and villain, even in alter-ego", () => {
    const { s, play, hand, ports, make } = fixture();
    const bobbi = play("04004");
    hand("04023");
    s.player.form = "alter";
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      originalPlayerId: "p1",
      base: 2,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      damage: 0,
      prevented: 0,
      overkill: false,
    };
    expect(hawkeyeAttackInitiatedOptions(s, s.villain, ports)[0]).toMatchObject(
      { id: bobbi.id },
    );
    expect(hawkeyeAttackInitiatedOptions(s, make("04027"), ports)).toEqual([]);
    s.attack.originalPlayerId = "p2";
    expect(hawkeyeAttackInitiatedOptions(s, s.villain, ports)).toEqual([]);
  });
  it("Mockingbird is returned reset to her actual owner before native all-damage prevention, and cancels no boost effects", () => {
    const { s, second, play, hand, ports, run } = fixture(),
      teammate = second(),
      bobbi = play("04004");
    bobbi.ownerId = teammate.id;
    bobbi.damage = 2;
    bobbi.exhausted = true;
    hand("04023");
    s.flags.attacksPerformed = 3;
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      originalPlayerId: "p1",
      base: 2,
      boostCodes: [],
      boostEffects: [{ type: "threat", target: "main", amount: 1 }],
      defense: 0,
      damage: 0,
      prevented: 0,
      overkill: false,
    };
    const payment = hawkeyeAttackInitiatedOptions(s, s.villain, ports)[0]
      .effects[0];
    expect(payment).toMatchObject({
      cost: 1,
      targetCode: "04004",
      cancelable: true,
    });
    run(payment.after[0]);
    expect(s.player.inPlay).not.toContain(bobbi);
    expect(teammate.player.hand.map((p) => p.id)).toContain(bobbi.id);
    expect(teammate.player.hand[0].damage).toBe(0);
    expect(ports.preventAllAttackDamage).toHaveBeenCalledOnce();
    expect(s.attack.boostEffects).toHaveLength(1);
  });
  it("Criminal Past offers optional form change, removes only through payable alter-ego exhaustion, and otherwise discards Bow", () => {
    const { s, make, play, run, choose } = fixture(),
      p = make("04026"),
      b = play("04002");
    s.resolving = [p];
    run(hawkeyeEncounterReveal(s, p)![0]);
    choose("stay");
    choose("bow");
    expect(s.player.discard.map((x) => x.id)).toContain(b.id);
    expect(s.removed).toEqual([]);
    s.player.form = "alter";
    run(H("obligation-choice", { piece: p }));
    choose("remove");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.map((x) => x.id)).toContain(p.id);
    expect(s.resolving).toEqual([]);
  });
  it("Criminal Past honors native form locks and cannot exhaust a ready hero as its alter-ego cost", () => {
    const { s, make, run, drain, lock } = fixture();
    lock();
    run(H("obligation", { piece: make("04026") }));
    drain();
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["bow"]);
  });
  it("Marked for Death uses current tucked errata, takes exact Mockingbird, cleans attachments and returns only that copy", () => {
    const { s, second, play, make, run } = fixture(),
      teammate = second(),
      bobbi = play("04004"),
      otherBobbi = make("01083"),
      cycle = play("04015"),
      scheme = make("04028");
    otherBobbi.ownerId = teammate.id;
    teammate.player.inPlay.push(otherBobbi);
    cycle.attachedTo = bobbi.id;
    s.sideSchemes.push(scheme);
    run(H("marked", { id: scheme.id }));
    expect(s.player.inPlay).not.toContain(bobbi);
    expect(s.player.discard.map((p) => p.id)).toContain(cycle.id);
    expect(scheme.storedCards?.map((p) => p.id)).toEqual([bobbi.id]);
    expect(teammate.player.inPlay).toContain(otherBobbi);
    hawkeyeSchemeDefeated(s, scheme);
    expect(s.player.hand.map((p) => p.id)).toContain(bobbi.id);
    expect(teammate.player.inPlay).toContain(otherBobbi);
    expect(scheme.storedCards).toEqual([]);
  });
  it("Marked for Death still shuffles after a failed whole-deck search; defeated tucked owner moves to removed", () => {
    const { s, make, run, ports } = fixture(),
      scheme = make("04028"),
      bobbi = make("04004");
    s.sideSchemes = [scheme];
    run(H("marked", { id: scheme.id }));
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
    scheme.storedCards = [bobbi];
    s.players[0].eliminated = true;
    hawkeyeSchemeDefeated(s, scheme);
    expect(s.removed.map((p) => p.id)).toContain(bobbi.id);
  });
  it("Marked for Death preserves the player's explicit choice when the search finds two Mockingbird printings", () => {
    const { s, make, run, choose, ports } = fixture();
    const scheme = make("04028"),
      signature = make("04004"),
      basic = make("01083");
    s.sideSchemes = [scheme];
    s.player.hand = [signature];
    s.player.deck = [basic];
    run(H("marked", { id: scheme.id }));
    expect(s.prompt!.options.map((p) => p.id)).toEqual([
      signature.id,
      basic.id,
    ]);
    choose(basic.id);
    expect(scheme.storedCards?.map((p) => p.id)).toEqual([basic.id]);
    expect(s.player.hand).toContain(signature);
    expect(ports.revealHidden).toHaveBeenCalledOnce();
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("Rifle attaches to Crossfire preferentially, removes only with native wild payment+hero exhaust, and Crossfire boost only grants attack piercing", () => {
    const { s, make, hand, run, ports } = fixture(),
      rifle = make("04029"),
      crossfire = make("04027");
    s.attachments = [rifle];
    s.minions = [crossfire];
    run(hawkeyeEncounterReveal(s, rifle)![0]);
    expect(rifle.attachedTo).toBe(crossfire.id);
    hand("04002");
    expect(
      hawkeyeAbilityOptions(s, rifle.id, ports)[0].effects[0],
    ).toMatchObject({ type: "payRequest", requirements: ["wild"], cost: 1 });
    run(H("discard-rifle", { id: rifle.id }));
    expect(s.player.exhausted).toBe(true);
    expect(s.attachments).toEqual([]);
    expect(hawkeyeBoost(s, crossfire)).toEqual([]);
    s.attack = {
      attacker: s.villain.id,
      isVillain: true,
      base: 2,
      boostCodes: [],
      boostEffects: [],
      defense: 0,
      damage: 0,
      prevented: 0,
      overkill: false,
    };
    run(hawkeyeBoost(s, crossfire)![0]);
    expect(s.queue[0]).toEqual({ type: "attackKeyword", keyword: "piercing" });
  });
  it("Sniper Shot routes form-dependent non-attack damage or main threat without fabricating a boost ability", () => {
    const { s, make } = fixture(),
      p = make("04030");
    expect(hawkeyeEncounterReveal(s, p)).toEqual([
      { type: "damage", target: "hero", amount: 3 },
    ]);
    s.player.form = "alter";
    expect(hawkeyeEncounterReveal(s, p)).toEqual([
      { type: "threat", target: "main", amount: 3 },
    ]);
    expect(hawkeyeBoost(s, p)).toBeNull();
  });
});
