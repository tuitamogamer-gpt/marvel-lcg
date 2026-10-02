import { describe, expect, it } from "vitest";
import starters from "../src/data/catalog-decks.json";
import {
  aerial,
  card,
  CATALOG_CARDS,
  deckCodes,
  handSize,
  heroStats,
} from "../src/game/cards";
import {
  BLACK_WIDOW_COMPILED_CODES,
  BLACK_WIDOW_CORE_ALIASES,
  BLACK_WIDOW_SCRIPT_CODES,
} from "../src/game/black-widow";
import {
  DOCTOR_STRANGE_CORE_ALIASES,
  DOCTOR_STRANGE_INVOCATIONS,
  DOCTOR_STRANGE_SCRIPT_CODES,
} from "../src/game/doctor-strange";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import { paymentSources } from "../src/game/payment";
import type { Command, Effect, GameState } from "../src/game/types";

function command(input: GameState, cmd: Command) {
  let state = dispatch(input, cmd);
  expect(state.error, JSON.stringify(state.prompt)).toBeUndefined();
  let guard = 0;
  while (state.review && guard++ < 60)
    state = dispatch(state, { type: "PROCEED" });
  expect(state.error).toBeUndefined();
  return state;
}

function base(heroId = "doctor_strange") {
  let state = newGame({
    heroId,
    aspect: heroId === "black_widow" ? "justice" : "protection",
    villainId: "rhino",
    seed: 112,
    pacing: "expert",
  });
  state = command(state, { type: "MULLIGAN", ids: [] });
  state.player.form = "hero";
  state.player.hand = [];
  state.player.inPlay = [];
  state.player.discard = [];
  state.minions = [];
  state.sideSchemes = [];
  state.attachments = [];
  state.queue = [];
  state.prompt = null;
  state.review = null;
  return state;
}

function inPlay(state: GameState, code: string) {
  const piece = makePiece(state, code);
  state.player.inPlay.push(piece);
  return piece;
}

function hand(state: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => makePiece(state, code));
  state.player.hand = pieces;
  return pieces;
}

function choose(state: GameState, id: string) {
  expect(state.prompt?.kind).toBe("choice");
  return command(state, { type: "CHOOSE", id });
}

function native(state: GameState, ...effects: Effect[]) {
  state.queue = effects;
  state.prompt = {
    kind: "choice",
    title: "Native timing fixture",
    text: "Resolve the native effect.",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(state, "go");
}

function invocations(state: GameState, first: string, only = false) {
  const pieces = [
    ...(state.player.invocationDeck || []),
    ...(state.player.invocationDiscard || []),
  ];
  expect(pieces).toHaveLength(5);
  const top = pieces.find((piece) => piece.code === first)!;
  expect(top).toBeDefined();
  state.player.invocationDeck = only
    ? [top]
    : [top, ...pieces.filter((piece) => piece.id !== top.id)];
  state.player.invocationDiscard = only
    ? pieces.filter((piece) => piece.id !== top.id)
    : [];
  return top;
}

describe("hero pack integration boundary audit", () => {
  it.each([
    [
      "bkw",
      34,
      [
        ...BLACK_WIDOW_SCRIPT_CODES,
        ...BLACK_WIDOW_CORE_ALIASES,
        ...BLACK_WIDOW_COMPILED_CODES,
      ],
    ],
    [
      "drs",
      40,
      [...DOCTOR_STRANGE_SCRIPT_CODES, ...DOCTOR_STRANGE_CORE_ALIASES],
    ],
  ] as const)(
    "%s covers exactly its imported faces without duplicate declarations",
    (pack, count, codes) => {
      const faces = CATALOG_CARDS.filter((face) => face.pack_code === pack);
      expect(faces).toHaveLength(count);
      expect(new Set(codes).size).toBe(count);
      expect([...codes].sort()).toEqual(faces.map((face) => face.code).sort());
    },
  );

  it("both imported starters have40 ordinary cards; the five Invocations remain supplementary", () => {
    for (const heroCode of ["08001a", "09001a"]) {
      const starter = starters.find((deck) => deck.heroCode === heroCode)!;
      expect(
        Object.values(starter.cards).reduce(
          (sum, count) => sum + Number(count),
          0,
        ),
      ).toBe(40);
      expect(
        Object.keys(starter.cards).some((code) =>
          (DOCTOR_STRANGE_INVOCATIONS as readonly string[]).includes(code),
        ),
      ).toBe(false);
    }
    const strange = starters.find((deck) => deck.heroCode === "09001a")!;
    expect(strange.supplementaryCards).toEqual(
      Object.fromEntries(DOCTOR_STRANGE_INVOCATIONS.map((code) => [code, 1])),
    );
    expect(deckCodes("doctor_strange", "protection")).toHaveLength(40);
    expect(
      deckCodes("doctor_strange", "protection").some((code) =>
        card(code).traits?.includes("Invocation"),
      ),
    ).toBe(false);
  });

  it("each Gauntlet is a distinct payment source only for Preparation cards", () => {
    const state = base("black_widow");
    const first = inPlay(state, "08007");
    const second = inPlay(state, "08007");
    const quincarrier = inPlay(state, "08023");
    expect(
      paymentSources(state, undefined, "08006")
        .map((source) => source.id)
        .sort(),
    ).toEqual([first.id, second.id, quincarrier.id].sort());
    expect(
      paymentSources(state, undefined, "09032").map((source) => source.id),
    ).toEqual([quincarrier.id]);
    expect(
      paymentSources(state, undefined, "09005").map((source) => source.id),
    ).toEqual([quincarrier.id]);
  });

  it("Eye has one hero-only resource action, despite compiler recognition", () => {
    const state = base();
    const eye = inPlay(state, "09011");
    expect(
      paymentSources(state, undefined, "09032").filter(
        (source) => source.id === eye.id,
      ),
    ).toHaveLength(1);
    state.player.form = "alter";
    expect(
      paymentSources(state, undefined, "09032").some(
        (source) => source.id === eye.id,
      ),
    ).toBe(false);
  });

  it("native stat helpers count Enhancements once and respect its recipient's form", () => {
    const state = base();
    const initial = heroStats(state);
    inPlay(state, "09010");
    inPlay(state, "09026");
    inPlay(state, "09009");
    expect(heroStats(state)).toMatchObject({
      attack: initial.attack + 1,
      thwart: initial.thwart + 1,
      defense: initial.defense + 1,
    });
    expect(handSize(state)).toBe(6);
    expect(aerial(state)).toBe(true);
    state.player.form = "alter";
    expect(heroStats(state)).toEqual(initial);
    expect(handSize(state)).toBe(6);
    expect(aerial(state)).toBe(true);
  });
});

describe("Doctor Strange native timing audit", () => {
  it("Astral Projection records its simultaneous look before Power Drain's defeat mills the encounter deck", () => {
    let state = base();
    const scheme = makePiece(state, "02041");
    scheme.counters = 3;
    state.sideSchemes = [scheme];
    const looked = makePiece(state, "01104");
    const second = makePiece(state, "01186");
    const third = makePiece(state, "01102");
    state.encounter.deck = [looked, second, third];
    state.encounter.discard = [];
    const [projection, energy] = hand(state, "09003", "09022");
    state = command(state, { type: "PLAY", id: projection.id });
    state = command(state, { type: "PAY", ids: [energy.id] });
    if (state.prompt?.options.some((option) => option.id === scheme.id))
      state = choose(state, scheme.id);
    // Crisis leaves a single legal scheme, so the native selector may resolve
    // that target directly and already be displaying the simultaneous look.
    expect(state.sideSchemes).toHaveLength(0);
    expect(state.encounter.deck[0].id).toBe(third.id);
    expect(state.prompt?.title).toBe("Astral Projection · encounter card");
    expect(state.prompt?.options[0].image).toBe(looked.code);
    state = choose(JSON.parse(JSON.stringify(state)), "continue");
    expect(state.encounter.deck[0].id).toBe(third.id);
  });

  it("Spell Mastery preserves next-play discounts and uses one physical Eye resource", () => {
    let state = base();
    invocations(state, "09032");
    const helicarrier = inPlay(state, "01092");
    const eye = inPlay(state, "09011");
    const [single, vest] = hand(state, "09021", "01081");
    state = command(state, {
      type: "ABILITY",
      id: helicarrier.id,
      action: "special",
    });
    expect(state.flags.discount).toBe(1);
    state = command(state, {
      type: "ABILITY",
      id: "identity",
      action: "spell",
    });
    expect(state.prompt?.kind).toBe("payment");
    expect(state.prompt?.cost).toBe(2);
    state = command(JSON.parse(JSON.stringify(state)), {
      type: "PAY",
      ids: [eye.id, single.id],
    });
    if (state.prompt?.kind === "choice")
      state = choose(state, state.villain.id);
    expect(
      state.player.inPlay.find((piece) => piece.id === eye.id)?.exhausted,
    ).toBe(true);
    expect(state.flags.discount).toBe(1);
    expect(state.villain.hp).toBe(7);
    state = command(state, { type: "PLAY", id: vest.id });
    expect(state.prompt?.kind).not.toBe("payment");
    expect(Number(state.flags.discount || 0)).toBe(0);
    expect(state.player.inPlay.some((piece) => piece.id === vest.id)).toBe(
      true,
    );
  });

  it("MotMA resets an emptied Invocation deck before returning the same original instance", () => {
    let state = base();
    const top = invocations(state, "09036", true);
    const allIds = [
      ...state.player.invocationDeck!,
      ...state.player.invocationDiscard!,
    ]
      .map((piece) => piece.id)
      .sort();
    const [event, resource] = hand(state, "09005", "09021");
    state.player.exhausted = true;
    state = command(state, { type: "PLAY", id: event.id });
    expect(state.prompt?.cost).toBe(1);
    state = command(JSON.parse(JSON.stringify(state)), {
      type: "PAY",
      ids: [resource.id],
    });
    expect(state.player.invocationDeck?.[0].id).toBe(top.id);
    expect(state.player.invocationDeck).toHaveLength(5);
    expect(state.player.invocationDiscard).toHaveLength(0);
    expect(
      state.player.invocationDeck!.map((piece) => piece.id).sort(),
    ).toEqual(allIds);
    expect(state.player.exhausted).toBe(true);
  });

  it("Night Nurse can remove Tough from a full-HP hero without inventing healing", () => {
    let state = base();
    const nurse = inPlay(state, "09019");
    nurse.counters = 3;
    state.player.tough = true;
    state.player.toughCards = 1;
    const hp = state.player.hp;
    state = command(state, { type: "ABILITY", id: nurse.id, action: "nurse" });
    state = choose(JSON.parse(JSON.stringify(state)), state.activePlayerId);
    expect(state.player.hp).toBe(hp);
    expect(state.player.tough).toBe(false);
    expect(state.player.toughCards).toBe(0);
    expect(
      state.player.inPlay.find((piece) => piece.id === nurse.id)?.counters,
    ).toBe(2);
  });

  it("Stunned replaces an attack event before Counterspell's Forced Interrupt", () => {
    let state = base();
    const counterspell = makePiece(state, "09030");
    counterspell.attachedTo = `hero:${state.activePlayerId}`;
    state.attachments = [counterspell];
    state.player.stunned = true;
    state.player.stunCards = 1;
    const [blast, energy, single] = hand(state, "09004", "09022", "09021");
    const hp = state.villain.hp;
    state = command(state, { type: "PLAY", id: blast.id });
    state = command(JSON.parse(JSON.stringify(state)), {
      type: "PAY",
      ids: [energy.id, single.id],
    });
    expect(state.player.stunned).toBe(false);
    expect(state.player.stunCards).toBe(0);
    expect(
      state.attachments.some((piece) => piece.id === counterspell.id),
    ).toBe(true);
    expect(state.player.discard.some((piece) => piece.id === blast.id)).toBe(
      true,
    );
    expect(state.villain.hp).toBe(hp);
  });
});

describe("Black Widow native timing audit", () => {
  it.each([
    ["02023", 13],
    ["02024", 14],
  ])(
    "Attacrobatics with Goblin %s cancels numeric icons while a later star icon still applies",
    (minionCode, villainHP) => {
      let state = base("black_widow");
      const preparation = inPlay(state, "08006");
      const thrall = makePiece(state, minionCode);
      thrall.engagedWith = state.activePlayerId;
      state.minions = [thrall];
      const boost = makePiece(state, "02030");
      state.encounter.deck = [boost, makePiece(state, "01186")];
      state.encounter.discard = [];
      const hp = state.player.hp;
      state = native(state, { type: "enemyAttack", id: state.villain.id });
      state = choose(state, "take");
      expect(state.prompt?.title).toBe("Boost card revealed");
      state = choose(JSON.parse(JSON.stringify(state)), preparation.id);
      if (state.prompt?.title === "After your Preparation resolves")
        state = choose(state, "continue");
      if (state.prompt?.kind === "choice") state = choose(state, "resolve");
      expect(state.player.hp).toBe(hp - 3);
      expect(state.villain.hp).toBe(villainHP);
      expect(
        state.player.discard.some((piece) => piece.id === preparation.id),
      ).toBe(true);
      expect(
        state.encounter.discard.filter((piece) => piece.id === boost.id),
      ).toHaveLength(1);
    },
  );
});
