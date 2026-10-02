import { describe, expect, it, vi } from "vitest";
import importedCards from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { rulesCode } from "../src/game/rules-code";
import { activateSeat, controller, seatView } from "../src/game/team";
import {
  MS_MARVEL_CORE_ALIASES,
  MS_MARVEL_SCRIPT_CODES,
  msMarvelEventAmountModifier,
  msMarvelBeforeEvent,
  msMarvelAfterEvent,
  msMarvelStats,
  msMarvelDiscount,
  msMarvelCardPlayed,
  msMarvelPhaseEnded,
  msMarvelRoundEnded,
  msMarvelPlayRestriction,
  msMarvelEvent,
  msMarvelCardEntered,
  msMarvelAbilityOptions,
  msMarvelAbility,
  msMarvelResourceSources,
  msMarvelResourceSpent,
  msMarvelDamageOptions,
  msMarvelAttackInitiatedOptions,
  msMarvelBoostOptions,
  msMarvelRedDaggerOptions,
  msMarvelDiscardPlayable,
  msMarvelRobotBlank,
  msMarvelDamageImmune,
  msMarvelEncounterReveal,
  resolveMsMarvelEffect,
  type MsMarvelPorts,
} from "../src/game/ms-marvel";
import type { Effect, GameState, Piece } from "../src/game/types";

function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "protection",
    seed: 581,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "protection" as const },
            { heroId: "captain_america", aspect: "leadership" as const },
          ],
        }
      : {}),
  });
  s.heroId = s.players[0].heroId = "ms_marvel";
  s.phase = "player";
  s.player.form = "hero";
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.hand = [];
    view.player.deck = [];
    view.player.inPlay = [];
    view.player.discard = [];
    view.player.exhausted = false;
  }
  s.queue = [];
  s.resolving = [];
  s.prompt = null;
  s.minions = [];
  s.sideSchemes = [];
  const ports: MsMarvelPorts = {
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
          label: card(p).name,
          image: p.code,
          effects: [],
        })),
      };
    },
    discardPiece: vi.fn((state: GameState, id: string) => {
      const seat = controller(state, id)!;
      const zone = seatView(state, seat).player.inPlay;
      const [p] = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      );
      const owner = seatView(state, p.ownerId || seat.id).player.discard;
      owner.push(...(p.storedCards || []), p);
      p.storedCards = [];
      p.counters = 0;
    }),
    discardTop: vi.fn((state: GameState, playerId: string, count: number) => {
      const player = seatView(state, playerId).player;
      const original = Math.min(count, player.deck.length);
      const discarded = player.deck.splice(0, original);
      player.discard.push(...discarded);
      if (!player.deck.length && player.discard.length) {
        player.deck = player.discard.splice(0).reverse();
        const encounter = state.encounter.deck.shift()!;
        encounter.dealtTo = playerId;
        state.encounter.dealt.push(encounter);
      }
      return discarded;
    }),
    cardCost: (_, p) => card(p).cost || 0,
    canPay: vi.fn(() => true),
    pay: vi.fn(
      (state: GameState, _title, _cost, _requirements, after: Effect[]) =>
        state.queue.unshift(...after),
    ),
    canPayDifferentTypes: vi.fn(() => true),
    payDifferentTypes: vi.fn(
      (state: GameState, _title, _count, after: Effect[]) =>
        state.queue.unshift(...after),
    ),
    transferControl: vi.fn((state: GameState, id: string, playerId: string) => {
      const owner = controller(state, id)!;
      const from = seatView(state, owner).player.inPlay;
      const [p] = from.splice(
        from.findIndex((p) => p.id === id),
        1,
      );
      seatView(state, playerId).player.inPlay.push(p);
    }),
    returnEvent: vi.fn((state: GameState, id: string) => {
      const zone = [state.player.discard, state.resolving].find((pile) =>
        pile.some((p) => p.id === id),
      )!;
      state.player.hand.push(
        zone.splice(
          zone.findIndex((p) => p.id === id),
          1,
        )[0],
      );
    }),
    returnAlly: vi.fn((state: GameState, id: string) => {
      const seat = controller(state, id)!;
      const zone = seatView(state, seat).player.inPlay;
      const [p] = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      );
      p.damage = 0;
      p.pendingDefeat = false;
      seatView(state, p.ownerId || seat.id).player.hand.push(p);
    }),
    cancelBoost: vi.fn(() => 2),
    flip: vi.fn((state: GameState) => {
      state.player.form = state.player.form === "hero" ? "alter" : "hero";
    }),
  };
  const run = (e: Effect) => {
    if (e.actorId && e.actorId !== s.activePlayerId) activateSeat(s, e.actorId);
    return resolveMsMarvelEffect(s, e, ports);
  };
  const choose = (id: string) => {
    const o = s.prompt!.options.find((o) => o.id === id)!;
    if (!o) throw Error("Invalid fixture choice.");
    s.prompt = null;
    for (const e of o.effects) if (!run(e)) s.queue.push(e);
  };
  const play = (code: string, seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = s.activePlayerId;
    seatView(s, seatId).player.inPlay.push(p);
    return p;
  };
  const hand = (...codes: string[]) => {
    const pieces = codes.map((code) => {
      const p = makePiece(s, code);
      p.ownerId = s.activePlayerId;
      return p;
    });
    s.player.hand.push(...pieces);
    return pieces;
  };
  const minion = (code: string, seatId = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.engagedWith = seatId;
    s.minions.push(p);
    return p;
  };
  return { s, ports, run, choose, play, hand, minion };
}
const resume: Effect[] = [{ type: "review", title: "Continue" }];

describe("the complete retail Ms. Marvel Hero Pack", () => {
  it("closes every34 face exactly once with28 manual hooks and6 nativeCore aliases", () => {
    const imported = importedCards
      .filter((c) => c.pack_code === "msm")
      .map((c) => c.code)
      .sort();
    expect(
      [...MS_MARVEL_SCRIPT_CODES, ...MS_MARVEL_CORE_ALIASES].sort(),
    ).toEqual(imported);
    expect(imported).toHaveLength(34);
    expect(MS_MARVEL_CORE_ALIASES.map((code) => rulesCode(code))).toEqual([
      "01078",
      "01079",
      "01088",
      "01089",
      "01090",
      "01091",
    ]);
    expect(
      importedCards.filter((c) => c.pack_code === "msm" && c.boost_star),
    ).toEqual([]);
  });
  it("uses honest dispatch ownership instead of silently accepting unknown effects", () => {
    const { run } = fixture();
    expect(run({ type: "ms:invented" })).toBe(false);
    expect(run({ type: "damage", amount: 3 })).toBe(false);
    expect(run({ type: "ms:prevent-damage", amount: 3 })).toBe(false);
  });
  it("Teen Spirit finds an actual signature card and can run only once per round in alter ego", () => {
    const { s, hand, run } = fixture();
    s.player.form = "alter";
    const [first, found, last] = hand("05019", "05004", "05020");
    s.player.hand = [];
    s.player.deck = [first, found, last];
    expect(msMarvelAbility(s, "identity")![0].type).toBe("ms:teen-spirit");
    run({ type: "ms:teen-spirit" });
    expect(s.player.hand).toEqual([found]);
    expect(s.player.discard).toEqual([first]);
    expect(s.player.deck).toEqual([last]);
    expect(msMarvelAbilityOptions(s, "identity")).toEqual([]);
    expect(() => run({ type: "ms:teen-spirit" })).toThrow("unavailable");
  });
  it("Teen Spirit stops at original deck exhaustion and handles a last-card signature after native recycle", () => {
    const { s, hand, run, ports } = fixture();
    s.player.form = "alter";
    const [resource] = hand("05019");
    s.player.hand = [];
    s.player.deck = [resource];
    run({ type: "ms:teen-spirit" });
    expect(ports.discardTop).toHaveBeenCalledTimes(1);
    expect(s.player.hand).toEqual([]);
    expect(s.player.deck).toEqual([resource]);
    expect(s.encounter.dealt).toHaveLength(1);
    s.round++;
    const [signature] = hand("05003");
    s.player.hand = [];
    s.player.deck = [signature];
    s.player.discard = [];
    run({ type: "ms:teen-spirit" });
    expect(s.player.hand).toEqual([signature]);
    expect(s.player.deck).toEqual([]);
    expect(s.encounter.dealt).toHaveLength(2);
  });
  it("Morphogenetics waits for an actual completed Attack/Thwart/Defense event and returns its exact ID", () => {
    const { s, hand, run, ports } = fixture();
    const [p] = hand("05005");
    expect(msMarvelAfterEvent(s, p, resume)[0].type).toBe("ms:event-cleanup");
    s.player.hand = [];
    s.player.discard.push(p);
    const effects = msMarvelAfterEvent(s, p, resume);
    expect(effects[0].type).toBe("optional");
    run(effects[0].effects[0]);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toEqual([p]);
    expect(ports.returnEvent).toHaveBeenCalledWith(s, p.id);
    expect(msMarvelAfterEvent(s, p, resume)[0].type).toBe("ms:event-cleanup");
  });
  it("Embiggen is optional, applies to both Melee packets and cleans up before the next physical event", () => {
    const { s, play, hand, run, choose } = fixture();
    const upgrade = play("05010");
    const [event] = hand("05030");
    run(msMarvelBeforeEvent(s, event, resume)[0]);
    expect(upgrade.exhausted).toBe(false);
    choose("use");
    expect(upgrade.exhausted).toBe(true);
    expect(msMarvelEventAmountModifier(s, event.id, "damage")).toBe(2);
    expect(msMarvelEventAmountModifier(s, event.id, "damage")).toBe(2);
    expect(msMarvelEventAmountModifier(s, event.id, "damage", true)).toBe(0);
    expect(msMarvelEventAmountModifier(s, "another-event", "damage")).toBe(0);
    run({ type: "ms:event-cleanup", eventId: event.id, after: [] });
    expect(msMarvelEventAmountModifier(s, event.id, "damage")).toBe(0);
  });
  it("Shrink increases actual threat removal and cannot create removal from Emergency prevention", () => {
    const { s, play, hand, run, choose } = fixture();
    const shrink = play("05011");
    const [event] = hand("05004");
    run(msMarvelBeforeEvent(s, event, resume)[0]);
    choose("use");
    expect(msMarvelEventAmountModifier(s, event.id, "thwart")).toBe(2);
    expect(msMarvelEventAmountModifier(s, event.id, "damage")).toBe(0);
    const [emergency] = hand("01085");
    shrink.exhausted = false;
    expect(msMarvelBeforeEvent(s, emergency, resume)).toEqual(resume);
    expect(msMarvelEvent(s, emergency, [])).toBeNull(); // native prevention never invokes a removal modifier.
  });
  it("Embiggen decline keeps its card ready and alter ego never offers hero interrupts", () => {
    const { s, play, hand, run, choose } = fixture();
    const p = play("05010");
    const [event] = hand("05003");
    run(msMarvelBeforeEvent(s, event, resume)[0]);
    choose("skip");
    expect(p.exhausted).toBe(false);
    expect(msMarvelEventAmountModifier(s, event.id, "damage")).toBe(0);
    s.player.form = "alter";
    expect(msMarvelBeforeEvent(s, event, resume)).toEqual(resume);
  });
  it("Aamir moves the chosen physical discard to the bottom, exhausts and draws only after that succeeds", () => {
    const { s, play, hand, run, choose } = fixture();
    s.player.form = "alter";
    const aamir = play("05006");
    const [p, top] = hand("05019", "05020");
    s.player.hand = [];
    s.player.discard = [p];
    s.player.deck = [top];
    run(msMarvelAbility(s, aamir.id)![0]);
    expect(aamir.exhausted).toBe(false);
    choose(p.id);
    expect(aamir.exhausted).toBe(true);
    expect(s.player.deck).toEqual([top, p]);
    expect(s.queue[0]).toEqual({ type: "draw", amount: 1 });
    expect(msMarvelAbilityOptions(s, aamir.id)).toEqual([]);
  });
  it("Bruno stores and retrieves actual owned pieces with form-specific costs and no duplication", () => {
    const { s, play, hand, run } = fixture();
    s.player.form = "alter";
    const bruno = play("05007");
    const [p, q] = hand("05003", "05004");
    run({ type: "ms:bruno-store", id: bruno.id, ids: [p.id] });
    expect(bruno.storedCards).toEqual([p]);
    expect(s.player.hand).toEqual([q]);
    expect(bruno.exhausted).toBe(true);
    bruno.exhausted = false;
    s.player.form = "hero";
    expect(msMarvelAbilityOptions(s, bruno.id).map((o) => o.id)).toEqual([
      "bruno-retrieve",
    ]);
    run({ type: "ms:bruno-retrieve", id: bruno.id, ids: [p.id] });
    expect(s.player.hand).toEqual([q, p]);
    expect(bruno.storedCards).toEqual([]);
    bruno.exhausted = false;
    expect(() =>
      run({ type: "ms:bruno-store", id: bruno.id, ids: [q.id] }),
    ).toThrow("unavailable");
  });
  it("Bruno validates the entire selection before exhaustion or zone mutation", () => {
    const { s, play, hand, run } = fixture();
    const bruno = play("05007");
    const [p] = hand("05003");
    s.player.hand = [];
    bruno.storedCards = [p];
    expect(() =>
      run({ type: "ms:bruno-retrieve", id: bruno.id, ids: [p.id, p.id] }),
    ).toThrow("different");
    expect(bruno.exhausted).toBe(false);
    expect(bruno.storedCards).toEqual([p]);
    run({ type: "ms:bruno-retrieve", id: bruno.id, ids: [] });
    expect(bruno.exhausted).toBe(true);
    expect(bruno.storedCards).toEqual([p]);
  });
  it("Nakia discount persists through form change, is consumed by the next card, and expires with the phase", () => {
    const { s, play, run } = fixture();
    s.player.form = "alter";
    const nakia = play("05008");
    run(msMarvelAbility(s, nakia.id)![0]);
    s.player.form = "hero";
    expect(msMarvelDiscount(s)).toBe(1);
    msMarvelCardPlayed(s);
    expect(msMarvelDiscount(s)).toBe(0);
    nakia.exhausted = false;
    s.player.form = "alter";
    run(msMarvelAbility(s, nakia.id)![0]);
    msMarvelPhaseEnded(s);
    expect(msMarvelDiscount(s)).toBe(0);
  });
  it("Bio-Suit pays only events in hero form; Enhanced Reflexes spends and discards its last actual counter", () => {
    const { s, play } = fixture();
    const suit = play("05009"),
      reflexes = play("05024");
    msMarvelCardEntered(s, reflexes);
    expect(reflexes.counters).toBe(3);
    expect(msMarvelResourceSources(s, "05003").map((p) => p.id)).toEqual([
      suit.id,
      reflexes.id,
    ]);
    expect(msMarvelResourceSources(s, "05002").map((p) => p.id)).toEqual([
      reflexes.id,
    ]);
    expect(msMarvelResourceSources(s).map((p) => p.id)).toEqual([reflexes.id]);
    reflexes.counters = 1;
    expect(msMarvelResourceSpent(s, reflexes)).toEqual([
      { type: "discardPiece", id: reflexes.id },
    ]);
    expect(reflexes.exhausted).toBe(true);
    expect(reflexes.counters).toBe(0);
    s.player.form = "alter";
    expect(msMarvelResourceSources(s, "05003")).toEqual([]);
  });
  it("Wiggle Room works for attack and non-attack identity damage, with Morph before the host resumes", () => {
    const { s, hand, run } = fixture();
    const [p] = hand("05005");
    for (const attack of [true, false]) {
      const packet: Effect = { type: "damage", target: "hero", amount: 5 };
      const o = msMarvelDamageOptions(
        s,
        { target: "hero", amount: 5, attack, packet },
        resume,
        fixture().ports,
      )[0];
      run(o.effects[0]);
      const reaction = s.queue.shift()!;
      expect(reaction.id).toBe(p.id);
      expect(reaction.type).toBe("resolveHandEvent");
      expect(reaction.after.map((e: Effect) => e.type)).toEqual([
        "ms:prevent-damage",
        "draw",
      ]);
      expect(reaction.after[0].packet).toBe(packet);
      expect(reaction.resume).toEqual(resume);
    }
    s.player.form = "alter";
    expect(
      msMarvelDamageOptions(
        s,
        { target: "hero", amount: 1 },
        resume,
        fixture().ports,
      ),
    ).toEqual([]);
  });
  it("Energy Barrier prevents its controller's damage in either form, does not exhaust, and loses its final counter", () => {
    const { s, play, run, ports } = fixture();
    s.player.form = "alter";
    const barrier = play("05017");
    msMarvelCardEntered(s, barrier);
    barrier.counters = 1;
    run(
      msMarvelDamageOptions(s, { target: "hero", amount: 3 }, resume, ports)[0]
        .effects[0],
    );
    expect(barrier.counters).toBe(0);
    expect(barrier.exhausted).toBe(false);
    expect(s.queue.map((e) => e.type)).toEqual([
      "ms:prevent-damage",
      "target",
      "discardPiece",
      "review",
    ]);
    expect(s.queue[1].action.attack).toBeUndefined();
    expect(
      msMarvelDamageOptions(s, { target: "ally", amount: 3 }, resume, ports),
    ).toEqual([]);
    barrier.counters = 3;
    s.player.tough = true;
    expect(
      msMarvelDamageOptions(s, { target: "hero", amount: 3 }, resume, ports),
    ).toEqual([]);
  });
  it("Nova's optional ability uses a typed energy payment without exhausting in either form and precedes attack continuation", () => {
    const { s, play, run, ports } = fixture();
    s.player.form = "alter";
    const nova = play("05012");
    const opts = msMarvelAttackInitiatedOptions(s, s.villain, resume, ports);
    run(opts[0].effects[0]);
    expect(ports.pay).toHaveBeenCalledWith(
      s,
      "Nova",
      1,
      ["energy"],
      expect.any(Array),
      undefined,
      "05012",
    );
    expect(s.queue[0]).toEqual({
      type: "damage",
      target: s.villain.id,
      amount: 2,
      source: nova.id,
    });
    expect(s.queue[1]).toEqual(resume[0]);
    expect(nova.exhausted).toBe(false);
  });
  it("Preemptive Strike cancels numeric boost icons but preserves the host's boost-star resolution", () => {
    const { s, hand, run, ports } = fixture();
    const [p] = hand("05014"),
      boost = makePiece(s, "01146");
    vi.mocked(ports.cancelBoost).mockReturnValue(1);
    const starEffects = [{ type: "heal", target: s.villain.id, amount: 2 }];
    s.attack = {
      attacker: s.villain.id,
      base: 2,
      boostCodes: [boost.code],
      boostEffects: starEffects,
      defense: 0,
      prevented: 0,
      damage: 0,
      overkill: false,
      isVillain: true,
    };
    expect(msMarvelBoostOptions(s, boost, resume, ports)).toHaveLength(1);
    run(msMarvelBoostOptions(s, boost, resume, ports)[0].effects[0]);
    expect(s.queue[0]).toMatchObject({
      type: "resolveHandEvent",
      id: p.id,
      resume,
    });
    expect(s.queue[0].after).toEqual([
      { type: "ms:preemptive", boostId: boost.id },
    ]);
    s.queue = [];
    run({ type: "ms:preemptive", boostId: boost.id });
    expect(ports.cancelBoost).toHaveBeenCalledWith(s, boost.id);
    expect(s.queue[0]).toEqual({
      type: "damage",
      target: s.villain.id,
      amount: 1,
      source: "hero",
    });
    expect(s.attack.boostEffects).toBe(starEffects);
    const zero = makePiece(s, "05029");
    expect(msMarvelBoostOptions(s, zero, resume, ports)).toEqual([]);
  });
  it("Red Dagger uses atomic different-type payment and replaces actual defeat with damage then returning the same ally", () => {
    const { s, play, run, ports } = fixture();
    const red = play("05002");
    red.damage = 3;
    red.pendingDefeat = true;
    run(msMarvelRedDaggerOptions(s, red, resume, ports)[0].effects[0]);
    expect(ports.payDifferentTypes).toHaveBeenCalledWith(
      s,
      "Red Dagger",
      2,
      expect.any(Array),
      "05002",
    );
    expect(s.queue.map((e) => e.type)).toEqual([
      "target",
      "ms:red-return",
      "review",
    ]);
    expect(s.queue[0].action).toEqual({
      type: "damage",
      amount: 2,
      source: red.id,
    });
    run(s.queue[1]);
    expect(s.player.hand).toContain(red);
    expect(s.player.inPlay).not.toContain(red);
    expect(red.pendingDefeat).toBe(false);
  });
  it("Red Dagger's ability acts in its controller's payment view even when another player resolves the attack", () => {
    const { s, play, ports } = fixture(true);
    const owner = s.players[1].id;
    const red = play("05002", owner);
    const opts = msMarvelRedDaggerOptions(s, red, resume, ports);
    expect(opts[0].effects[0].actorId).toBe(owner);
    expect(ports.canPayDifferentTypes).toHaveBeenCalledWith(
      expect.objectContaining({ activePlayerId: owner }),
      2,
      "05002",
    );
  });
  it("Lockjaw is payable from his actual discard only during his controller's own turn and obeys uniqueness", () => {
    const { s, hand, play } = fixture();
    const [p] = hand("05018");
    s.player.hand = [];
    s.player.discard.push(p);
    expect(msMarvelDiscardPlayable(s, p)).toBe(true);
    s.turnPlayerId = "p2";
    expect(msMarvelDiscardPlayable(s, p)).toBe(false);
    s.turnPlayerId = s.activePlayerId;
    play("05018");
    expect(msMarvelDiscardPlayable(s, p)).toBe(false);
  });
  it("Tackle and Concussive Blow share one selected enemy; bonus damage requires actual physical payment", () => {
    const { s, hand, run } = fixture();
    const [tackle, blow] = hand("05015", "05031");
    for (const [p, status] of [
      [tackle, "stunned"],
      [blow, "confused"],
    ] as const) {
      const effect = msMarvelEvent(s, p, ["physical"])![0].action;
      run({ ...effect, target: s.villain.id });
      expect(s.queue[0]).toEqual({
        type: "status",
        target: s.villain.id,
        status,
      });
      expect(s.queue[1]).toMatchObject({
        type: "damage",
        target: s.villain.id,
        amount: 3,
        eventId: p.id,
      });
      s.queue = [];
      run({
        ...msMarvelEvent(s, p, ["energy"])![0].action,
        target: s.villain.id,
      });
      expect(s.queue.map((e) => e.type)).toEqual(["status", "damage"]);
      expect(s.queue[1].amount).toBe(0);
      s.queue = [];
    }
  });
  it("Melee makes two sequential target choices, allowing Guard defeat before the villain but never the same enemy twice", () => {
    const { s, hand, minion, run } = fixture();
    const [p] = hand("05030");
    const guard = minion("01101");
    run({ ...msMarvelEvent(s, p, [])![0].action, target: guard.id });
    expect(s.queue.map((e) => e.type)).toEqual(["damage", "ms:melee-second"]);
    expect(s.queue[1].firstId).toBe(guard.id);
    const second = s.queue[1];
    s.queue = [];
    s.minions = [];
    run(second);
    expect(s.queue[0]).toMatchObject({ type: "target", exclude: guard.id });
    s.queue = [];
    run({ type: "ms:melee-second", firstId: s.villain.id, eventId: p.id });
    expect(s.queue).toEqual([]); // No empty target prompt and no next-stage retarget.
  });
  it("Morale Boost stacks on a chosen hero through the villain phase, hides in alter ego, and expires at the round boundary", () => {
    const { s, run } = fixture(true);
    const target = s.players[1].id;
    seatView(s, target).player.form = "hero";
    run({ type: "ms:morale", playerId: target });
    run({ type: "ms:morale", playerId: target });
    expect(msMarvelStats(seatView(s, target))).toMatchObject({
      atk: 2,
      thw: 2,
      def: 2,
    });
    msMarvelPhaseEnded(s);
    s.phase = "villain";
    expect(msMarvelStats(seatView(s, target)).def).toBe(2);
    seatView(s, target).player.form = "alter";
    expect(msMarvelStats(seatView(s, target)).atk).toBe(0);
    msMarvelRoundEnded(s);
    seatView(s, target).player.form = "hero";
    expect(msMarvelStats(seatView(s, target)).def).toBe(0);
  });
  it("Endurance and Down Time choose valid controllers once, retaining original ownership and conditional stat meaning", () => {
    const { s, play, run, choose } = fixture(true);
    const other = s.players[1].id;
    const endurance = play("05023");
    run(msMarvelCardEntered(s, endurance)[0]);
    choose(other);
    expect(controller(s, endurance.id)!.id).toBe(other);
    expect(endurance.ownerId).toBe(s.players[0].id);
    expect(msMarvelStats(seatView(s, other)).health).toBe(3);
    expect(msMarvelStats(s).health).toBe(0);
    const downtime = play("05033", other);
    expect(msMarvelStats(seatView(s, other)).recover).toBe(2);
    seatView(s, other).player.form = "hero";
    expect(msMarvelStats(seatView(s, other)).recover).toBe(0);
    const duplicate = play("05033");
    expect(msMarvelPlayRestriction(s, duplicate)).toBeNull();
    expect(msMarvelAbilityOptions(s, downtime.id)).toEqual([]);
    expect(msMarvelStats(s).recover).toBe(0);
  });
  it("Thomas Edison is protected only by another minion engaged with the same player; Robot blanking is shared across seats and phase-bounded", () => {
    const { s, minion, run, ports } = fixture(true);
    const edison = minion("05027");
    const elsewhere = minion("01110", s.players[1].id);
    expect(msMarvelDamageImmune(s, edison.id)).toBe(false);
    elsewhere.engagedWith = s.activePlayerId;
    expect(msMarvelDamageImmune(s, edison.id)).toBe(true);
    const robot = minion("05028");
    expect(msMarvelDamageImmune(s, robot.id)).toBe(true);
    run(msMarvelAbility(s, robot.id)![0]);
    expect(ports.pay).toHaveBeenCalledWith(
      s,
      "Edison's Giant Robot",
      1,
      ["mental"],
      expect.any(Array),
      undefined,
      "05028",
    );
    run(s.queue.shift()!);
    expect(msMarvelRobotBlank(s, robot.id)).toBe(true);
    activateSeat(s, s.players[1].id);
    expect(msMarvelDamageImmune(s, robot.id)).toBe(false);
    msMarvelPhaseEnded(s);
    expect(msMarvelDamageImmune(s, robot.id)).toBe(true);
  });
  it("Generation Why snapshots the whole table's ally/Persona count and discards that many from EACH player's original deck", () => {
    const { s, play, hand, run } = fixture(true);
    play("05002");
    play("05006");
    play("05008", s.players[1].id);
    const p = makePiece(s, "05026");
    const effects = msMarvelEncounterReveal(s, p)!;
    expect(effects.map((e) => e.count)).toEqual([3, 3]);
    const [only] = hand("05019");
    s.player.hand = [];
    s.player.deck = [only];
    run(effects[0]);
    expect(s.player.deck).toEqual([only]);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Harvest exhausts only ready Persona supports and heals once for each actually exhausted card, otherwise surges", () => {
    const { s, play, run } = fixture(true);
    const ready = play("05006"),
      exhausted = play("05008", s.players[1].id);
    exhausted.exhausted = true;
    play("05002");
    run(msMarvelEncounterReveal(s, makePiece(s, "05029"))![0]);
    expect(ready.exhausted).toBe(true);
    expect(s.queue[0]).toEqual({
      type: "heal",
      target: s.villain.id,
      amount: 1,
    });
    s.queue = [];
    run({ type: "ms:harvest" });
    expect(s.queue).toEqual([{ type: "surge" }]);
  });
  it("Home by Dawn preserves optional flip and resolution choices, and can remove itself only with ready Kamala", () => {
    const { s, run, choose, ports } = fixture();
    const p = makePiece(s, "05025");
    run(msMarvelEncounterReveal(s, p)![0]);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["flip", "stay"]);
    choose("flip");
    expect(ports.flip).toHaveBeenCalledWith(s, false);
    expect(s.player.flipped).toBe(false);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["exhaust", "discard"]);
    choose("exhaust");
    expect(s.player.exhausted).toBe(true);
    expect(s.queue[0]).toEqual({ type: "removeEncounter", piece: p });
  });
  it("Home by Dawn discards a chosen Persona and leaves tucked-card lifecycle to native discard, or surges when none exists", () => {
    const { s, play, hand, run, choose, ports } = fixture();
    const bruno = play("05007"),
      nakia = play("05008");
    const [stored] = hand("05003");
    s.player.hand = [];
    bruno.storedCards = [stored];
    const obligation = makePiece(s, "05025");
    run({ type: "ms:obligation-persona", piece: obligation });
    expect(s.prompt!.options.map((o) => o.id)).toEqual([bruno.id, nakia.id]);
    choose(bruno.id);
    ports.discardPiece(s, bruno.id); // Native effect dispatched by the fixture host.
    expect(s.player.discard).toContain(stored);
    expect(s.player.discard).toContain(bruno);
    s.player.inPlay = [];
    s.queue = [];
    run({ type: "ms:obligation-persona", piece: obligation });
    expect(s.queue).toEqual([{ type: "surge" }]);
  });
});
