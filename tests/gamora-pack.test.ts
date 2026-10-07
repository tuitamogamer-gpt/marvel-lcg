import { describe, expect, it, vi } from "vitest";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { allInPlay, controller, seatView } from "../src/game/team";
import * as pack from "../src/game/gamora-pack";
import type { Effect, GameState, Piece } from "../src/game/types";

const P = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: "gamora-pack:" + type,
  ...args,
});
function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "aggression",
    seed: 1832,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "aggression" as const },
            { heroId: "captain_marvel", aspect: "justice" as const },
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
  const ports: pack.GamoraPackPorts = {
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
    hasTrait: vi.fn((state, target, trait) => {
      const p = allInPlay(state).find((p) => p.id === target);
      return !!p && (card(p).traits || "").split(/\.\s*/).includes(trait);
    }),
    shufflePlayerDeck: vi.fn(),
    shuffleEncounter: vi.fn(),
    putMinion: vi.fn((state, p, playerId) => {
      p.engagedWith = playerId;
      state.minions.push(p);
    }),
    schemeTargets: (state) => [
      { id: "main", label: "The Break-In!" },
      ...state.sideSchemes.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ],
    enemyTargets: (state) => [{ id: state.villain.id, label: "Rhino" }],
    cardCost: (_s, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    heroThwart: vi.fn(() => 3),
    enemyUnique: vi.fn((_s, target) => target === "villain"),
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
  const run = (e: Effect, state = s) =>
    pack.resolveGamoraPackEffect(state, e, ports);
  const choose = (id: string) => {
    const o = s.prompt!.options.find((o) => o.id === id)!;
    expect(o).toBeDefined();
    s.prompt = null;
    for (const e of o.effects) if (!run(e)) s.queue.push(e);
  };
  return { s, ports, play, hand, run, choose };
}

describe("Gamora original retail player pool", () => {
  it("covers all supplementary printings, retaining exact Core reprints", () => {
    expect(pack.GAMORA_PACK_SCRIPT_CODES).toHaveLength(12);
    expect(pack.GAMORA_PACK_CORE_ALIASES).toEqual([
      "18014",
      "18017",
      "18021",
      "18022",
      "18023",
    ]);
    expect(
      new Set([
        ...pack.GAMORA_PACK_SCRIPT_CODES,
        ...pack.GAMORA_PACK_CORE_ALIASES,
      ]).size,
    ).toBe(17);
  });
  it("does not claim unrelated ally/event/effect text", () => {
    const { s, run } = fixture();
    const p = makePiece(s, "01084");
    expect(pack.gamoraPackAllyEnter(s, p)).toBeNull();
    expect(pack.gamoraPackEvent(s, p)).toBeNull();
    expect(run({ type: "draw", amount: 1 })).toBe(false);
    expect(() => run(P("unknown"))).toThrow(/Unknown Gamora/);
  });
  it("Angela must search a bounded top ten and chooses the actual minion rather than revealing it", () => {
    const { s, ports, play, run, choose } = fixture();
    const p = play("18011"),
      m = makePiece(s, "01102");
    s.encounter.deck = [
      ...Array.from({ length: 9 }, () => makePiece(s, "01104")),
      m,
      makePiece(s, "01103"),
    ];
    run(pack.gamoraPackAllyEnter(s, p)![0]);
    expect(s.prompt!.options.map((o) => o.id)).toEqual([m.id]);
    choose(m.id);
    expect(ports.shuffleEncounter).toHaveBeenCalledWith(s);
    expect(ports.putMinion).toHaveBeenCalledWith(s, m, "p1");
    expect(s.encounter.deck).not.toContain(m);
    expect(s.minions[0].engagedWith).toBe("p1");
  });
  it("Angela shuffles and discards herself when no minion is among the top ten", () => {
    const { s, ports, play, run } = fixture();
    const p = play("18011");
    s.encounter.deck = [
      ...Array.from({ length: 10 }, () => makePiece(s, "01104")),
      makePiece(s, "01102"),
    ];
    run(P("angela", { id: p.id }));
    expect(s.prompt).toBeNull();
    expect(ports.shuffleEncounter).toHaveBeenCalledWith(s);
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
    expect(ports.putMinion).not.toHaveBeenCalled();
  });
  it("Angela still shuffles an empty encounter deck without inventing a minion", () => {
    const { s, ports, play, run } = fixture();
    const p = play("18011");
    s.encounter.deck = [];
    run(P("angela", { id: p.id }));
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
    expect(ports.shuffleEncounter).toHaveBeenCalledOnce();
  });
  it("Drax has no enter-play action and cannot attack a minion", () => {
    const { s, play } = fixture();
    const p = play("18019");
    expect(pack.gamoraPackAllyEnter(s, p)).toEqual([]);
    expect(pack.gamoraPackAllyCanAttack(s, p, "villain")).toBe(true);
    expect(pack.gamoraPackAllyCanAttack(s, p, "some-minion")).toBe(false);
  });
  it("Drax's hand-play requirement checks the current identity's Guardian trait", () => {
    const { s, ports } = fixture();
    expect(
      pack.gamoraPackPlayRestriction(s, makePiece(s, "18019"), ports),
    ).toMatch(/Guardian/);
    expect(ports.hasTrait).toHaveBeenCalledWith(s, "hero", "Guardian");
  });
  it("Comms Implant adds one HP and one THW to only its attached ally across controllers", () => {
    const { s, ports, play } = fixture(true);
    const p = play("17020", "p2"),
      other = play("18019"),
      upgrade = play("18030");
    upgrade.attachedTo = p.id;
    expect(pack.gamoraPackAllyHP(s, p)).toBe(1);
    expect(pack.gamoraPackAllyThwart(s, p)).toBe(1);
    expect(pack.gamoraPackAllyHP(s, other)).toBe(0);
    expect(pack.gamoraPackAttachmentTargets(s, ports)).not.toContain(p);
  });
  it("a blanked Comms Implant loses its HP and THW bonuses", () => {
    const { s, play } = fixture();
    const p = play("17020"),
      upgrade = play("18030");
    upgrade.attachedTo = p.id;
    s.sideSchemes.push(makePiece(s, "12026"));
    expect(pack.gamoraPackAllyHP(s, p)).toBe(0);
    expect(pack.gamoraPackAllyThwart(s, p)).toBe(0);
  });
  it("Comms Implant attaches through a native physical target choice", () => {
    const { s, ports, play, run, choose } = fixture();
    const p = play("17020"),
      upgrade = play("18030");
    run(pack.gamoraPackCardEntered(s, upgrade)[0]);
    choose(p.id);
    expect(ports.attach).toHaveBeenCalledWith(s, upgrade.id, p.id);
  });
  it("Clobber returns only the actual first card played this round", () => {
    const { s, run } = fixture();
    const p = makePiece(s, "18012");
    s.resolving.push(p);
    pack.gamoraPackCardPlayed(s, p);
    run(P("return-first", { id: p.id }));
    expect(s.player.hand).toEqual([p]);
    expect(s.resolving).toEqual([]);
  });
  it("playing a support first prevents a later Clobber return", () => {
    const { s, run } = fixture();
    const support = makePiece(s, "01084"),
      p = makePiece(s, "18012");
    pack.gamoraPackCardPlayed(s, support);
    pack.gamoraPackCardPlayed(s, p);
    s.resolving.push(p);
    run(P("return-first", { id: p.id }));
    expect(s.player.hand).toEqual([]);
    expect(s.resolving).toEqual([p]);
  });
  it("Impede uses round history across the player and villain phases", () => {
    const { s, run } = fixture();
    const p = makePiece(s, "18016"),
      first = makePiece(s, "18031");
    pack.gamoraPackCardPlayed(s, first);
    s.phase = "villain";
    pack.gamoraPackCardPlayed(s, p);
    s.resolving.push(p);
    run(P("return-first", { id: p.id }));
    expect(s.player.hand).toEqual([]);
    s.round++;
    pack.gamoraPackCardPlayed(s, p);
    run(P("return-first", { id: p.id }));
    expect(s.player.hand).toEqual([p]);
  });
  it("first-play history is local to the player and survives JSON hydration", () => {
    const { s } = fixture(true);
    const p = makePiece(s, "18012"),
      other = makePiece(s, "01084");
    pack.gamoraPackCardPlayed(seatView(s, "p2"), other);
    pack.gamoraPackCardPlayed(s, p);
    const restored: GameState = JSON.parse(JSON.stringify(s));
    expect(restored.flags.gamoraPackFirstPlayed).toBe(p.id);
    expect(restored.players[1].flags.gamoraPackFirstPlayed).toBe(other.id);
  });
  it("Clobber's mandatory return follows its three-damage attack", () => {
    const { s } = fixture();
    const p = makePiece(s, "18012");
    pack.gamoraPackCardPlayed(s, p);
    const effects = pack.gamoraPackEvent(s, p)!;
    expect(effects[0].action).toMatchObject({
      type: "damage",
      amount: 3,
      attack: true,
    });
    expect(effects[1]).toEqual(
      P("return-first", { id: p.id, playOccurrence: 1 }),
    );
  });
  it("Impede's removal is a thwart against main, followed by conditional return", () => {
    const { s } = fixture();
    const p = makePiece(s, "18016");
    pack.gamoraPackCardPlayed(s, p);
    const effects = pack.gamoraPackEvent(s, p)!;
    expect(effects[0]).toMatchObject({
      type: "thwart",
      target: "main",
      amount: 3,
      action: true,
    });
    expect(effects[1]).toEqual(
      P("return-first", { id: p.id, playOccurrence: 1 }),
    );
  });
  it("replaying the same returned Clobber is a later play and cannot return again", () => {
    const { s, run } = fixture();
    const p = makePiece(s, "18012");
    pack.gamoraPackCardPlayed(s, p);
    s.resolving.push(p);
    run(pack.gamoraPackEvent(s, p)![1]);
    expect(s.player.hand).toEqual([p]);
    pack.gamoraPackCardPlayed(s, p);
    s.player.hand = [];
    s.resolving.push(p);
    run(pack.gamoraPackEvent(s, p)![1]);
    expect(s.player.hand).toEqual([]);
    expect(s.resolving).toEqual([p]);
  });
  it.each([
    ["hero", 4],
    ["alter", 7],
  ] as const)(
    "Plan of Attack searches %s-form top %s only, for an Attack event",
    (form, count) => {
      const { s, run } = fixture();
      s.player.form = form;
      const event = makePiece(s, "18020"),
        thwart = makePiece(s, "18016"),
        beyond = makePiece(s, "18012");
      s.player.deck = [
        event,
        thwart,
        ...Array.from({ length: count - 2 }, () => makePiece(s, "01088")),
        beyond,
      ];
      const p = makePiece(s, "18013");
      run(pack.gamoraPackEvent(s, p)![0]);
      expect(s.prompt!.options.map((o) => o.id)).toEqual([event.id, "fail"]);
    },
  );
  it("Plan of Attack puts the selected physical event in hand and shuffles the remaining deck", () => {
    const { s, ports, run, choose } = fixture();
    const p = makePiece(s, "18012");
    s.player.deck.push(p);
    run(P("plan", { count: 4 }));
    choose(p.id);
    expect(s.player.hand).toEqual([p]);
    expect(s.player.deck).toEqual([]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledWith(s);
  });
  it("Plan of Attack may fail its search and still shuffles", () => {
    const { s, ports, run, choose } = fixture();
    s.player.deck.push(makePiece(s, "18012"));
    run(P("plan", { count: 4 }));
    choose("fail");
    expect(s.player.hand).toEqual([]);
    expect(ports.shufflePlayerDeck).toHaveBeenCalledOnce();
  });
  it("Godslayer requires a real unstunned basic attack against a unique enemy", () => {
    const { s, ports, play } = fixture();
    const p = play("18018"),
      packet = {
        type: "basicPower",
        kind: "attack",
        basic: true,
        target: "villain",
        amount: 2,
      };
    expect(pack.gamoraPackBasicAttackOptions(s, packet, [], ports)[0].id).toBe(
      p.id,
    );
    expect(
      pack.gamoraPackBasicAttackOptions(
        s,
        { ...packet, basic: false },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.gamoraPackBasicAttackOptions(
        s,
        { ...packet, target: "m" },
        [],
        ports,
      ),
    ).toEqual([]);
    s.player.stunned = true;
    expect(pack.gamoraPackBasicAttackOptions(s, packet, [], ports)).toEqual([]);
  });
  it("Godslayer exhausts the actual Weapon and commits +2 to the retained basic attack", () => {
    const { s, ports, play, run } = fixture();
    const p = play("18018"),
      packet = {
        type: "basicPower",
        basic: true,
        target: "villain",
        amount: 2,
      };
    run(
      pack.gamoraPackBasicAttackOptions(
        s,
        packet,
        [{ type: "sentinel" }],
        ports,
      )[0].effects[0],
    );
    expect(p.exhausted).toBe(true);
    expect(s.queue[0]).toMatchObject({
      amount: 4,
      target: "villain",
      gamoraPackGodslayers: [p.id],
      gmwBasicBonus: 2,
    });
    expect(s.queue[1]).toEqual({ type: "sentinel" });
  });
  it("First Hit offers an optional paid interrupt only for a live minion initiating an attack", () => {
    const { s, ports, hand } = fixture();
    const event = hand("18015"),
      minion = makePiece(s, "01102");
    expect(pack.gamoraPackFirstHitOptions(s, minion, [], ports)).toEqual([]);
    s.minions.push(minion);
    expect(pack.gamoraPackFirstHitOptions(s, minion, [], ports)[0].id).toBe(
      event.id,
    );
    s.player.form = "alter";
    expect(pack.gamoraPackFirstHitOptions(s, minion, [], ports)).toEqual([]);
  });
  it("First Hit's paid native event targets the actual initiating minion and preserves attack continuation", () => {
    const { s, ports, hand, run } = fixture();
    const event = hand("18015"),
      minion = makePiece(s, "01102");
    s.minions.push(minion);
    run(
      pack.gamoraPackFirstHitOptions(
        s,
        minion,
        [{ type: "enemyAttack", id: minion.id }],
        ports,
      )[0].effects[0],
    );
    const payment = s.queue[0];
    expect(payment).toMatchObject({
      type: "payRequest",
      cost: 1,
      cancelable: false,
    });
    expect(payment.after[0]).toMatchObject({
      type: "resolveHandEvent",
      id: event.id,
      after: [
        {
          type: "damage",
          target: minion.id,
          amount: 2,
          source: "hero",
          attack: true,
          attackInitiated: true,
        },
      ],
      continuation: [{ type: "enemyAttack", id: minion.id }],
    });
  });
  it("True Grit is unavailable as a normal action and requires this hero to have defended", () => {
    const { s, ports, hand } = fixture();
    const p = hand("18031");
    expect(pack.gamoraPackPlayRestriction(s, p, ports)).toMatch(/defends/);
    expect(
      pack.gamoraPackAfterDefenseOptions(
        s,
        { heroDefended: false, playerId: "p1" },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.gamoraPackAfterDefenseOptions(
        s,
        { heroDefended: true, playerId: "p2" },
        [],
        ports,
      ),
    ).toEqual([]);
    expect(
      pack.gamoraPackAfterDefenseOptions(
        s,
        { heroDefended: true, playerId: "p1" },
        [],
        ports,
      )[0].id,
    ).toBe(p.id);
  });
  it("True Grit uses the identity's current THW when its paid response resolves", () => {
    const { s, ports, hand, run } = fixture();
    const p = hand("18031"),
      snapshot = { heroDefended: true, playerId: "p1" };
    run(
      pack.gamoraPackAfterDefenseOptions(
        s,
        snapshot,
        [{ type: "sentinel" }],
        ports,
      )[0].effects[0],
    );
    expect(s.queue[0]).toMatchObject({ type: "payRequest", piece: p, cost: 1 });
    s.queue = [];
    run(P("grit"));
    expect(s.queue[0].action).toMatchObject({
      type: "thwart",
      amount: 3,
      action: true,
    });
    expect(ports.heroThwart).toHaveBeenCalledWith(s);
  });
  it("Hit and Run retains its sequential attack and thwart labels", () => {
    const { s } = fixture();
    const effects = pack.gamoraPackEvent(s, makePiece(s, "18020"))!;
    expect(effects[0].action).toMatchObject({
      type: "damage",
      amount: 2,
      attack: true,
    });
    expect(effects[1].action).toMatchObject({
      type: "thwart",
      amount: 2,
      action: true,
      thwartInitiated: true,
    });
  });
  it("Pivotal Moment reads actual main-scheme threat at event resolution", () => {
    const { s } = fixture();
    const p = makePiece(s, "18029");
    expect(pack.gamoraPackEvent(s, p)![0].amount).toBe(2);
    s.scheme.threat = 0;
    expect(pack.gamoraPackEvent(s, p)![0].amount).toBe(5);
  });
  it("Enhanced Reflexes enters with three energy counters, exhausts, and discards at zero", () => {
    const { s, ports, play } = fixture();
    const p = play("18032");
    pack.gamoraPackCardEntered(s, p);
    expect(p.counters).toBe(3);
    expect(pack.gamoraPackResourceSources(s)[0].resources).toEqual(["energy"]);
    pack.gamoraPackResourceSpent(s, p.id, ports);
    expect(p.counters).toBe(2);
    expect(p.exhausted).toBe(true);
    expect(pack.gamoraPackResourceSources(s)).toEqual([]);
    p.exhausted = false;
    p.counters = 1;
    pack.gamoraPackResourceSpent(s, p.id, ports);
    expect(ports.discardPiece).toHaveBeenCalledWith(s, p.id);
  });
  it("Enhanced Reflexes cannot generate resources in alter-ego or while its text is blank", () => {
    const { s, play } = fixture();
    const p = play("18032");
    p.counters = 3;
    s.player.form = "alter";
    expect(pack.gamoraPackResourceSources(s)).toEqual([]);
  });
  it("all paid response continuations can round-trip through JSON", () => {
    const { s, ports, hand } = fixture();
    hand("18031");
    const options = pack.gamoraPackAfterDefenseOptions(
      s,
      { heroDefended: true, playerId: "p1" },
      [{ type: "sentinel" }],
      ports,
    );
    expect(JSON.parse(JSON.stringify(options))).toEqual(options);
  });
});
