import { describe, expect, it, vi } from "vitest";
import importedCards from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { controller, seatView } from "../src/game/team";
import * as strange from "../src/game/doctor-strange";
import type { Card, Effect, GameState, Piece } from "../src/game/types";

function fixture(team = false) {
  const s = newGame({
    heroId: "spider_man",
    villainId: "rhino",
    aspect: "protection",
    seed: 900,
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "protection" as const },
            { heroId: "captain_america", aspect: "leadership" as const },
          ],
        }
      : {}),
  });
  s.heroId = s.players[0].heroId = "doctor_strange";
  s.phase = "player";
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.hand = [];
    view.player.deck = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.hp = 10;
    view.player.exhausted = false;
  }
  s.queue = [];
  s.resolving = [];
  s.prompt = null;
  s.review = null;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  const ports: strange.DoctorStrangePorts = {
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
    makePiece,
    shuffle: vi.fn(<T>(_state: GameState, list: T[]) =>
      [...list].reverse(),
    ) as strange.DoctorStrangePorts["shuffle"],
    revealHidden: vi.fn((state) => {
      state.hiddenInfo = Number(state.hiddenInfo || 0) + 1;
    }),
    discardPiece: vi.fn((state: GameState, id: string) => {
      const p = [
        ...state.attachments,
        ...state.players.flatMap((seat) => seatView(state, seat).player.inPlay),
      ].find((p) => p.id === id)!;
      if (!p) return;
      state.attachments = state.attachments.filter((p) => p.id !== id);
      for (const seat of state.players) {
        const zone = seatView(state, seat).player.inPlay;
        const i = zone.findIndex((p) => p.id === id);
        if (i >= 0) zone.splice(i, 1);
      }
      (p.ownerId
        ? seatView(state, p.ownerId).player.discard
        : state.encounter.discard
      ).push(p);
    }),
    discardTop: vi.fn((state, playerId, count) => {
      const view = seatView(state, playerId);
      const selected = view.player.deck.splice(0, count);
      view.player.discard.push(...selected);
      return selected;
    }),
    peekEncounter: vi.fn((state) => {
      const top = state.encounter.deck[0];
      if (top) ports.revealHidden(state);
      return top;
    }),
    cardCost: (state, p) =>
      Number(card(p).cost || 0) +
      strange.doctorStrangeCostModifier(state, card(p)),
    canPay: vi.fn(() => true),
    pay: vi.fn((state, _title, _cost, _requirements, after) =>
      state.queue.unshift(...after),
    ),
    transferControl: vi.fn((state, id, playerId) => {
      const old = controller(state, id)!;
      const zone = seatView(state, old).player.inPlay;
      const [p] = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      );
      seatView(state, playerId).player.inPlay.push(p);
    }),
    shuffleAllyIntoOwnerDeck: vi.fn((state, id) => {
      const old = controller(state, id)!;
      const zone = seatView(state, old).player.inPlay;
      const [p] = zone.splice(
        zone.findIndex((p) => p.id === id),
        1,
      );
      const view = seatView(state, p.ownerId!);
      view.player.deck.push(p);
      view.player.deck = ports.shuffle(state, view.player.deck);
    }),
    heroMaxHP: () => 10,
    removeStatus: vi.fn((state, target, status) => {
      const p = target.startsWith("hero:")
        ? seatView(state, target.slice(5)).player
        : target === "hero"
          ? state.player
          : [state.villain, ...state.minions, ...state.player.inPlay].find(
              (p) => p.id === target,
            )!;
      const key =
        status === "stunned"
          ? "stunCards"
          : status === "confused"
            ? "confuseCards"
            : "toughCards";
      p[key] = Math.max(0, Number(p[key] ?? Number(p[status])) - 1);
      p[status] = p[key]! > 0;
    }),
    canAddStatus: (state, target, status) => {
      const p = target.startsWith("hero:")
        ? seatView(state, target.slice(5)).player
        : target === "hero"
          ? state.player
          : [
              state.villain,
              ...state.minions,
              ...state.players.flatMap(
                (seat) => seatView(state, seat).player.inPlay,
              ),
            ].find((p) => p.id === target);
      return !!p && !p[status];
    },
    cancelBoost: vi.fn(() => 2),
    canReadyIdentity: () => true,
    canChangeForm: () => true,
    flip: (state) => {
      state.player.form = state.player.form === "hero" ? "alter" : "hero";
    },
  };
  const piece = (code: string) => ({
    ...makePiece(s, code),
    ownerId: s.activePlayerId,
  });
  const run = (e: Effect) => {
    expect(strange.resolveDoctorStrangeEffect(s, e, ports)).toBe(true);
  };
  const choose = (id: string) => {
    const opt = s.prompt!.options.find((o) => o.id === id)!;
    expect(opt).toBeDefined();
    s.prompt = null;
    for (const e of opt.effects) run(e);
  };
  return { s, ports, piece, run, choose };
}

describe("Doctor Strange retail pack's explicit rules", () => {
  it("Wong offers an action only when its controller can heal or the living Strange player has an Invocation", () => {
    const { s, ports, piece } = fixture(true);
    const wong = piece("09002");
    s.player.inPlay.push(wong);
    expect(strange.doctorStrangeAbilityOptions(s, wong.id, ports)).toEqual([]);
    s.player.hp--;
    expect(
      strange.doctorStrangeAbilityOptions(s, wong.id, ports).map((o) => o.id),
    ).toEqual(["wong"]);
    s.player.hp++;
    s.player.invocationDeck = [piece("09036")];
    expect(
      strange.doctorStrangeAbilityOptions(s, wong.id, ports).map((o) => o.id),
    ).toEqual(["wong"]);
    s.players[0].eliminated = true;
    expect(strange.doctorStrangeAbilityOptions(s, wong.id, ports)).toEqual([]);
  });
  it("Cloak checks the host's actual ready restriction before offering an action or paying its exhaust cost", () => {
    const { s, ports, piece, run } = fixture();
    const cloak = piece("09009");
    s.player.inPlay.push(cloak);
    s.player.exhausted = true;
    ports.canReadyIdentity = () => false;
    expect(strange.doctorStrangeAbilityOptions(s, cloak.id, ports)).toEqual([]);
    expect(() => run({ type: "ds:cloak", id: cloak.id })).toThrow(
      "unavailable",
    );
    expect(cloak.exhausted).toBe(false);
    expect(s.player.exhausted).toBe(true);
  });
  it("only offers Night Nurse when a living hero has damage or a status, using its current maximum HP", () => {
    const { s, ports, piece } = fixture(true);
    const nurse = piece("09019");
    nurse.counters = 3;
    s.player.inPlay.push(nurse);
    expect(strange.doctorStrangeAbilityOptions(s, nurse.id, ports)).toEqual([]);
    ports.heroMaxHP = () => 11;
    expect(
      strange.doctorStrangeAbilityOptions(s, nurse.id, ports),
    ).toHaveLength(1);
    s.player.form = "alter";
    seatView(s, "p2").player.form = "alter";
    expect(strange.doctorStrangeAbilityOptions(s, nurse.id, ports)).toEqual([]);
    seatView(s, "p2").player.form = "hero";
    ports.heroMaxHP = () => 10;
    seatView(s, "p2").player.tough = true;
    expect(
      strange.doctorStrangeAbilityOptions(s, nurse.id, ports),
    ).toHaveLength(1);
  });
  it("Physical Toll respects a form-change lock while retaining the alter-ego exhaust option", () => {
    const { s, ports, piece, run } = fixture();
    ports.canChangeForm = () => false;
    const obligation = piece("09027");
    run({ type: "ds:obligation", piece: obligation });
    expect(s.prompt).toBeNull();
    run(s.queue.shift()!);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["event"]);
    s.player.form = "alter";
    s.prompt = null;
    run({ type: "ds:obligation", piece: obligation });
    run(s.queue.shift()!);
    expect(s.prompt!.options.map((o) => o.id)).toEqual(["exhaust", "event"]);
  });
  it("covers exactly40 released faces with34 manual faces and6 exact Core aliases", () => {
    const imported = (importedCards as unknown as Card[])
      .filter((c) => c.pack_code === "drs")
      .map((c) => c.code)
      .sort();
    const covered = [
      ...strange.DOCTOR_STRANGE_SCRIPT_CODES,
      ...strange.DOCTOR_STRANGE_CORE_ALIASES,
    ].sort();
    expect(imported).toHaveLength(40);
    expect(covered).toEqual(imported);
    expect(new Set(covered).size).toBe(40);
  });
  it("creates5 separately owned Invocation pieces, without modifying the ordinary deck or dealing encounters", () => {
    const { s, ports } = fixture();
    const ordinary = [...s.player.deck];
    strange.doctorStrangeSetup(s, ports);
    expect(s.player.invocationDeck?.map((p) => p.code).sort()).toEqual(
      [...strange.DOCTOR_STRANGE_INVOCATIONS].sort(),
    );
    expect(new Set(s.player.invocationDeck?.map((p) => p.id)).size).toBe(5);
    expect(
      s.player.invocationDeck?.every((p) => p.ownerId === s.activePlayerId),
    ).toBe(true);
    const original = s.player.invocationDeck;
    strange.doctorStrangeSetup(s, ports);
    expect(s.player.invocationDeck).toBe(original);
    expect(s.player.deck).toEqual(ordinary);
    expect(s.encounter.dealt).toEqual([]);
  });
  it("Natural Talent is once per phase in alter ego and Invocation exhaustion has no encounter penalty", () => {
    const { s, ports, piece, run } = fixture();
    s.player.form = "alter";
    const last = piece("09036");
    s.player.invocationDeck = [last];
    s.player.invocationDiscard = [];
    run({ type: "ds:natural", id: last.id });
    expect(s.player.invocationDeck?.[0].id).toBe(last.id);
    expect(s.player.invocationDiscard).toEqual([]);
    expect(strange.doctorStrangeAbilityOptions(s, "identity")).toEqual([]);
    expect(s.encounter.dealt).toEqual([]);
    strange.doctorStrangePhaseEnded(s);
    expect(strange.doctorStrangeAbilityOptions(s, "identity")[0].id).toBe(
      "natural",
    );
    expect(ports.shuffle).toHaveBeenCalled();
  });
  it("Spell Mastery pays fixed Invocation cost and exhausts only after payment, preserving play discounts", () => {
    const { s, ports, piece, run } = fixture();
    const top = piece("09032");
    s.player.invocationDeck = [top];
    s.flags.discount = 1;
    s.flags.msNakiaDiscount = 1;
    run({ type: "ds:spell-cost", id: top.id });
    expect(ports.pay).toHaveBeenCalledWith(
      s,
      "Spell Mastery · Crimson Bands of Cyttorak",
      2,
      [],
      [{ type: "ds:spell-paid", id: top.id }],
      undefined,
      top.code,
    );
    expect(s.player.exhausted).toBe(false);
    run(s.queue.shift()!);
    expect(s.player.exhausted).toBe(true);
    expect(s.flags.discount).toBe(1);
    expect(s.flags.msNakiaDiscount).toBe(1);
  });
  it("binds Master of the Mystic Arts to the actual top ID for combined payment", () => {
    const { s, piece } = fixture();
    const top = piece("09032"),
      master = piece("09005");
    s.player.invocationDeck = [top];
    expect(strange.doctorStrangeAdditionalPlayCost(s, master)).toBe(2);
    expect(strange.doctorStrangeMasterInvocation(s, master)).toBe(top);
    expect(
      strange.doctorStrangeEvent(
        s,
        master,
        ["energy", "energy", "mental"],
        top.id,
      ),
    ).toEqual([{ type: "ds:invoke", id: top.id, master: true, paid: true }]);
  });
  it("Master reveals the next Invocation then returns the exact resolved piece to top", () => {
    const { s, ports, piece, run } = fixture();
    const first = piece("09036"),
      second = piece("09032");
    s.player.invocationDeck = [first, second];
    s.player.invocationDiscard = [];
    run({ type: "ds:invocation-finish", id: first.id, master: true });
    expect(s.player.invocationDeck?.map((p) => p.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(s.player.invocationDiscard).toEqual([]);
    expect(ports.revealHidden).toHaveBeenCalledTimes(2);
  });
  it("Master resolving the last Invocation first shuffles its discard, then extracts the same physical ID onto top", () => {
    const { s, ports, piece, run } = fixture();
    const last = piece("09036"),
      discarded = piece("09034");
    s.player.invocationDeck = [last];
    s.player.invocationDiscard = [discarded];
    run({ type: "ds:invocation-finish", id: last.id, master: true });
    expect(ports.shuffle).toHaveBeenCalledTimes(1);
    expect(s.player.invocationDeck?.map((p) => p.id)).toEqual([
      last.id,
      discarded.id,
    ]);
    expect(s.player.invocationDiscard).toEqual([]);
    expect(s.encounter.dealt).toEqual([]);
  });
  it("Crimson Bands resolves a non-attack Special even when Strange is Stunned", () => {
    const { s, piece, run } = fixture();
    const top = piece("09032");
    s.player.invocationDeck = [top];
    s.player.stunned = true;
    run({ type: "ds:invoke", id: top.id, paid: true });
    const effect = s.queue[0];
    expect(effect.type).toBe("target");
    expect(effect.attack).toBeUndefined();
    expect(effect.action.effects[1]).toMatchObject({
      type: "damage",
      amount: 7,
    });
    expect(effect.action.effects[1].attack).toBeUndefined();
    expect(s.player.stunned).toBe(true);
  });
  it("Vapors may resolve with no status to change, retaining its eventual self-discard", () => {
    const { s, piece, run } = fixture();
    const top = piece("09035");
    s.player.invocationDeck = [top];
    s.player.invocationDiscard = [];
    run({ type: "ds:invoke", id: top.id, paid: true });
    run(s.queue.shift()!);
    expect(s.prompt).toBeNull();
    run(s.queue.shift()!);
    expect(s.player.invocationDeck?.[0].id).toBe(top.id);
    expect(s.encounter.dealt).toEqual([]);
  });
  it("Vapors replaces exactly one status card, including one of multiple physical copies", () => {
    const { s, ports, run } = fixture();
    s.player.stunned = true;
    s.player.stunCards = 2;
    run({
      type: "ds:vapors",
      target: `hero:${s.activePlayerId}`,
      old: "stunned",
      status: "tough",
    });
    expect(s.player.stunCards).toBe(1);
    expect(ports.removeStatus).toHaveBeenCalledWith(
      s,
      `hero:${s.activePlayerId}`,
      "stunned",
    );
    expect(s.queue[0]).toEqual({
      type: "status",
      target: `hero:${s.activePlayerId}`,
      status: "tough",
    });
  });
  it("Rings has explicit0–3 selection and rejects repeated characters", () => {
    const { s, run } = fixture(true);
    run({ type: "ds:rings-choice" });
    expect(s.prompt?.min).toBe(0);
    expect(s.prompt?.max).toBe(3);
    expect(() =>
      run({ type: "ds:rings", ids: [s.villain.id, s.villain.id] }),
    ).toThrow(/different/);
  });
  it("Magical Enhancements stack on the chosen controller's hero through the round and discard at round end", () => {
    const { s, piece } = fixture();
    s.player.inPlay = [piece("09010"), piece("09010")];
    expect(strange.doctorStrangeStats(s)).toEqual({
      attack: 2,
      thwart: 2,
      defense: 2,
    });
    s.player.form = "alter";
    expect(strange.doctorStrangeStats(s)).toEqual({
      attack: 0,
      thwart: 0,
      defense: 0,
    });
    expect(strange.doctorStrangeRoundEnded(s)).toHaveLength(2);
  });
  it("Cloak grants Aerial and readies the real identity; Sorcerer Supreme adds hero-only hand size", () => {
    const { s, piece, run } = fixture();
    const cloak = piece("09009");
    s.player.inPlay = [cloak, piece("09026")];
    s.player.exhausted = true;
    expect(strange.doctorStrangeTraits(s)).toEqual(["Aerial"]);
    expect(strange.doctorStrangeHandSize(s)).toBe(1);
    run({ type: "ds:cloak", id: cloak.id });
    expect(cloak.exhausted).toBe(true);
    expect(s.queue[0]).toEqual({ type: "ready", target: "hero" });
    s.player.form = "alter";
    expect(strange.doctorStrangeHandSize(s)).toBe(0);
  });
  it("The Eye is one physical Hero Resource and cannot generate in alter ego", () => {
    const { s, piece } = fixture();
    const eye = piece("09011");
    s.player.inPlay.push(eye);
    expect(strange.doctorStrangeResourceSources(s)).toHaveLength(1);
    expect(strange.doctorStrangeResourceSpent(s, eye)).toEqual([]);
    expect(eye.exhausted).toBe(true);
    eye.exhausted = false;
    s.player.form = "alter";
    expect(strange.doctorStrangeResourceSources(s)).toEqual([]);
    expect(() => strange.doctorStrangeResourceSpent(s, eye)).toThrow(
      /unavailable/,
    );
  });
  it("Physical Toll applies only to played events and is consumed by that actual played card", () => {
    const { s, piece } = fixture();
    const toll = piece("09027");
    toll.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(toll);
    expect(strange.doctorStrangeCostModifier(s, card("09004"))).toBe(3);
    expect(strange.doctorStrangeCostModifier(s, card("09009"))).toBe(0);
    expect(strange.doctorStrangeCardPlayed(s, card("09004"))).toEqual([
      { type: "discardPiece", id: toll.id },
    ]);
  });
  it("Counterspell cancels the played event's effects while leaving invocation resolution outside the hook", () => {
    const { s, piece } = fixture();
    const counter = piece("09030");
    counter.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(counter);
    expect(
      strange.doctorStrangeBeforeEvent(s, piece("09004"), [
        { type: "draw", amount: 1 },
      ]),
    ).toEqual([{ type: "discardPiece", id: counter.id }]);
    s.player.form = "alter";
    expect(strange.doctorStrangeEncounterReveal(s, counter)).toEqual([]);
  });
  it("Magic Blast discards an actual Wild-resource card and resolves all three effects, with only one2-damage packet", () => {
    const { s, piece, run } = fixture();
    const wild = piece("09002");
    s.player.deck = [wild];
    run({
      type: "ds:blast-discard",
      target: s.villain.id,
      name: card(s.villain).name,
      eventId: "played-event",
    });
    expect(s.player.discard[0].id).toBe(wild.id);
    expect(s.queue.map((e) => e.type)).toEqual(["status", "damage", "status"]);
    expect(s.queue[1]).toMatchObject({
      amount: 2,
      attackAlreadyInitiated: true,
    });
    expect(s.queue[1].additional).toBeUndefined();
  });
  it("Magic Blast printed double physical triggers only one Stun, not a multiplier", () => {
    const { s, piece, run } = fixture();
    s.player.deck = [piece("09024")];
    run({
      type: "ds:blast-discard",
      target: s.villain.id,
      name: card(s.villain).name,
    });
    expect(s.queue).toEqual([
      { type: "status", target: s.villain.id, status: "stunned" },
    ]);
  });
  it("Astral Projection looks at the original top simultaneously with threat removal and retains its JSON face", () => {
    const { s, ports, piece, run } = fixture();
    const first = piece("01124"),
      later = piece("09029");
    s.encounter.deck = [first, later];
    run({ type: "ds:astral", target: "main", eventId: "source" });
    expect(ports.peekEncounter).toHaveBeenCalledTimes(1);
    const peek = JSON.parse(JSON.stringify(s.queue[1])) as Effect;
    expect(peek.looked.id).toBe(first.id);
    s.encounter.deck.shift();
    run(peek);
    expect(s.prompt?.options[0].image).toBe(first.code);
    expect(ports.peekEncounter).toHaveBeenCalledTimes(1);
    expect(s.prompt?.options[0].effects[0]).toMatchObject({
      additional: true,
      eventId: "source",
    });
  });
  it("Mystical Studies returns an actual signature card, never the Basic Sorcerer Supreme", () => {
    const { s, piece, run } = fixture();
    const wong = piece("09002"),
      supreme = piece("09026");
    s.player.deck = [supreme];
    s.player.discard = [wong];
    run({ type: "ds:studies" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([wong.id]);
    run({ ...s.prompt!.selectAction!, ids: [wong.id] });
    expect(s.player.hand[0].id).toBe(wong.id);
    expect(s.player.discard).toEqual([]);
    expect(s.player.deck[0].id).toBe(supreme.id);
  });
  it("Brother Voodoo searches only the first five actual cards and shuffles afterward", () => {
    const { s, ports, piece, run } = fixture();
    const event = piece("09003"),
      sixth = piece("09004");
    s.player.deck = [
      event,
      ...Array.from({ length: 4 }, () => piece("09009")),
      sixth,
    ];
    run({ type: "ds:voodoo-search" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([event.id]);
    run({ ...s.prompt!.selectAction!, ids: [event.id] });
    expect(s.player.hand[0].id).toBe(event.id);
    expect(ports.shuffle).toHaveBeenCalled();
  });
  it("Sanctum shuffles the chosen actual Spell from discard before drawing", () => {
    const { s, piece, run } = fixture();
    const sanctum = piece("09008"),
      spell = piece("09004");
    s.player.form = "alter";
    s.player.inPlay = [sanctum];
    s.player.discard = [spell];
    run({ type: "ds:sanctum", id: sanctum.id, ids: [spell.id] });
    expect(sanctum.exhausted).toBe(true);
    expect(s.player.deck[0].id).toBe(spell.id);
    expect(s.player.discard).toEqual([]);
    expect(s.queue[0]).toEqual({ type: "draw", amount: 1 });
  });
  it("Iron Fist's interrupt spends one counter and aborts attack/consequential continuation if the minion left", () => {
    const { s, piece, run } = fixture();
    const iron = piece("09014"),
      target = piece("01101");
    iron.counters = 2;
    s.player.inPlay = [iron];
    s.minions = [target];
    run({ type: "ds:ironfist", id: iron.id, target: target.id });
    expect(iron.counters).toBe(1);
    expect(s.queue[1]).toMatchObject({ amount: 1, source: iron.id });
    expect(s.queue[1].attack).toBeUndefined();
    s.minions = [];
    s.queue = [];
    run({
      type: "ds:ironfist-resume",
      target: target.id,
      targetName: card(target).name,
      after: [
        { type: "damage", amount: 2 },
        { type: "damage", amount: 1, target: iron.id },
      ],
    });
    expect(s.queue).toEqual([]);
  });
  it("Clea's replacement uses her actual ID and owner's deck", () => {
    const { s, ports, piece, run } = fixture(true);
    const clea = piece("09013");
    clea.ownerId = "p2";
    s.player.inPlay.push(clea);
    run({ type: "ds:clea", id: clea.id, after: [] });
    expect(ports.shuffleAllyIntoOwnerDeck).toHaveBeenCalledWith(s, clea.id);
    expect(seatView(s, "p2").player.deck[0].id).toBe(clea.id);
  });
  it("Unflappable requires hero defense and zero actual attack damage, while Desperate Defense adds a preserved bonus", () => {
    const { s, piece, run } = fixture();
    s.player.inPlay = [piece("09020")];
    s.attack = {
      defender: "hero",
      defense: 2,
      defenseBonus: 0,
    } as GameState["attack"];
    run({ type: "ds:defense" });
    expect(s.attack?.defenseBonus).toBe(2);
    expect(
      strange.doctorStrangeAfterDefense(s, {
        heroDefended: false,
        heroDamage: 0,
        playerId: s.activePlayerId,
      }),
    ).toEqual([]);
    expect(
      strange.doctorStrangeAfterDefense(s, {
        heroDefended: true,
        heroDamage: 0,
        playerId: s.activePlayerId,
      })[0].title,
    ).toBe("Unflappable");
  });
  it("Warning can be played by an alter ego for a different HERO, without claiming defense", () => {
    const { s, ports, piece } = fixture(true);
    s.player.form = "alter";
    const warning = piece("09021");
    s.player.hand = [warning];
    const window = { target: "hero:p2", playerId: "p2", amount: 2 };
    expect(strange.doctorStrangeDamageOptions(s, window, [], ports)[0].id).toBe(
      warning.id,
    );
    seatView(s, "p2").player.form = "alter";
    expect(strange.doctorStrangeDamageOptions(s, window, [], ports)).toEqual(
      [],
    );
  });
  it("Skilled Strike's bonus is an actual event effect, so canceled effects do not modify the resumed attack", () => {
    const { s, ports, piece, run } = fixture();
    const event = piece("09037");
    s.player.hand = [event];
    run({
      type: "ds:skilled-cost",
      id: event.id,
      attack: { type: "damage", basic: true, amount: 1 },
    });
    const resolution = s.queue[0];
    expect(resolution.after).toEqual([{ type: "ds:skilled-bonus" }]);
    expect(resolution.resume[0].attack.amount).toBe(1);
    expect(ports.pay).toHaveBeenCalled();
  });
  it("Night Nurse accepts full-HP hero with Tough and removes exactly one physical status", () => {
    const { s, ports, piece, run } = fixture();
    const nurse = piece("09019");
    nurse.counters = 3;
    s.player.inPlay = [nurse];
    s.player.hp = 10;
    s.player.tough = true;
    s.player.toughCards = 1;
    run({ type: "ds:nurse-choice", id: nurse.id });
    expect(s.prompt?.options[0].id).toBe(s.activePlayerId);
    run({ type: "ds:nurse", id: nurse.id, playerId: s.activePlayerId });
    run({ type: "ds:nurse-status", playerId: s.activePlayerId });
    expect(ports.removeStatus).toHaveBeenCalledWith(
      s,
      `hero:${s.activePlayerId}`,
      "tough",
    );
    expect(nurse.counters).toBe(2);
  });
  it("Open the Dark Dimension captures an actual Invocation and shuffles it back before generic scheme discard", () => {
    const { s, ports, piece, run } = fixture();
    const invocation = piece("09036"),
      other = piece("09032"),
      dimension = piece("09029");
    s.player.invocationDeck = [invocation, other];
    s.player.invocationDiscard = [];
    s.sideSchemes = [dimension];
    run({ type: "ds:dimension-capture", id: dimension.id });
    expect(dimension.storedCards?.[0].id).toBe(invocation.id);
    expect(s.player.invocationDeck?.[0].id).toBe(other.id);
    strange.doctorStrangeSchemeDefeated(s, dimension, ports);
    expect(dimension.storedCards).toEqual([]);
    expect(s.player.invocationDeck?.map((p) => p.id).sort()).toEqual(
      [invocation.id, other.id].sort(),
    );
    expect(s.player.discard).toEqual([]);
  });
  it.each([false, true])(
    "finishes the exact resolving Invocation after Open the Dark Dimension shuffles it away from the top (Master=%s)",
    (master) => {
      const { s, ports, piece, run } = fixture();
      const images = piece("09033"),
        captured = piece("09036"),
        other = piece("09032"),
        dimension = piece("09029");
      s.player.invocationDeck = [images, other];
      s.player.invocationDiscard = [];
      dimension.storedCards = [captured];
      run({ type: "ds:invoke", id: images.id, paid: true, master });
      const finish = s.queue.find((e) => e.type === "ds:invocation-finish")!;
      expect(finish.id).toBe(images.id);
      strange.doctorStrangeSchemeDefeated(s, dimension, ports);
      expect(s.player.invocationDeck?.[0].id).not.toBe(images.id);
      expect(() =>
        run({ type: "ds:invoke", id: images.id, paid: true }),
      ).toThrow("no longer on top");
      run(finish);
      expect(s.player.invocationDeck?.[0].id === images.id).toBe(master);
      expect(s.player.invocationDiscard?.some((p) => p.id === images.id)).toBe(
        !master,
      );
      expect(s.player.invocationDeck?.some((p) => p.id === captured.id)).toBe(
        true,
      );
      expect(s.player.discard).toEqual([]);
      expect(
        [...s.player.invocationDeck!, ...s.player.invocationDiscard!].filter(
          (p) => p.id === images.id,
        ),
      ).toHaveLength(1);
    },
  );
  it("Baron Mordo's printed Wild discard stuns, damages and confuses the originally attacked player", () => {
    const { s, piece, run } = fixture(true);
    const top = piece("09002");
    seatView(s, "p2").player.deck = [top];
    run({ type: "ds:mordo", playerId: "p2" });
    expect(s.queue.map((e) => [e.type, e.target])).toEqual([
      ["status", "hero:p2"],
      ["damage", "hero:p2"],
      ["status", "hero:p2"],
    ]);
    expect(s.queue[1].amount).toBe(2);
  });
  it("Thoughtcasting explicitly chooses highest printed-cost ties and uses that printed cost", () => {
    const { s, piece, run } = fixture();
    const first = piece("09004"),
      second = piece("09002"),
      cheap = piece("09006");
    s.player.hand = [first, second, cheap];
    run({ type: "ds:thoughtcasting" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([first.id, second.id]);
    run({
      type: "ds:thoughtcasting-discard",
      id: first.id,
      cost: 3,
      form: "hero",
    });
    expect(s.player.discard[0].id).toBe(first.id);
    expect(s.queue[0]).toMatchObject({ type: "damage", amount: 3 });
  });
  it("unknown effects remain unsupported rather than silently succeeding", () => {
    const { s, ports } = fixture();
    expect(
      strange.resolveDoctorStrangeEffect(s, { type: "ds:unknown" }, ports),
    ).toBe(false);
  });
});
