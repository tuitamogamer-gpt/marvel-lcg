import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards";
import { dispatch, makePiece, newGame, targets } from "../src/game/engine";
import type { Effect, GameState } from "../src/game/types";
import {
  clearStatuses,
  consumeStatus,
  consumeTough,
  discardToughForPiercing,
  giveStatus,
  hasPrintedKeyword,
  keywordDeclarations,
  patrolBlocksMainScheme,
  printedKeyword,
  retaliateAmount,
  scaledKeyword,
  statusCards,
  syncStatuses,
  type StatusState,
} from "../src/game/keywords";

const empty = (): StatusState => ({
  stunned: false,
  confused: false,
  tough: false,
});
const normal = { text: "" };

describe("printed keyword declarations", () => {
  it("recognizes printed Core and expansion declarations with reminders and multiple keywords", () => {
    expect(printedKeyword(card("01040a"), "Retaliate")).toBe(1);
    expect(printedKeyword(card("01172"), "Retaliate")).toBe(1);
    expect(printedKeyword(card("01184"), "Retaliate")).toBe(2);
    expect(printedKeyword(card("27075"), "Steady")).toBe(1);
    expect(printedKeyword(card("27075"), "Toughness")).toBe(1);
    expect(printedKeyword(card("16133"), "Guard")).toBe(1);
    expect(printedKeyword(card("16133"), "Stalwart")).toBe(1);
    expect(printedKeyword(card("16055"), "Quickstrike")).toBe(1);
    expect(printedKeyword(card("16055"), "Villainous")).toBe(1);
  });

  it("keeps grants, keyword references, ability text and boost text out of printed keywords", () => {
    expect(printedKeyword(card("17013"), "Ranged")).toBe(0); // Yondu's attacks gain ranged.
    expect(printedKeyword(card("24008"), "Steady")).toBe(0); // Attached Hood gains steady.
    expect(printedKeyword(card("16132"), "Piercing")).toBe(0); // A boost grants piercing.
    expect(printedKeyword(card("61023"), "Patrol")).toBe(0); // Event ignores patrol.
    expect(
      printedKeyword(
        { text: "If you control a Weapon, this card gains Retaliate 2." },
        "Retaliate",
      ),
    ).toBe(0);
    expect(
      printedKeyword(
        { text: "Toughness. (This reminder mentions Guard.)" },
        "Guard",
      ),
    ).toBe(0);
    expect(
      printedKeyword(
        {
          text: "Hero Action (attack): Deal 3 damage. This attack gains overkill.",
        },
        "Overkill",
      ),
    ).toBe(0);
    expect(
      printedKeyword(
        { text: "Surge.<hr />[star] Boost: This attack gains ranged." },
        "Ranged",
      ),
    ).toBe(0);
  });

  it("parses keyword arguments without splitting trait names or nested reminders", () => {
    const declarations = keywordDeclarations({
      text: "Teamwork ([[S.H.I.E.L.D.]]). Retaliate 2 (Reminder (including nested text).).",
    });
    expect(declarations).toEqual([
      {
        name: "Teamwork",
        value: 1,
        perPlayer: false,
        argument: "S.H.I.E.L.D.",
      },
      { name: "Retaliate", value: 2, perPlayer: false },
    ]);
    expect(
      keywordDeclarations(card("60202")).find(
        (entry) => entry.name === "Teamwork",
      )?.argument,
    ).toBe("Tracksuit");
  });

  it("separates a numeric keyword value from presence and starting-player scaling", () => {
    expect(printedKeyword(card("04056"), "Incite")).toBe(1);
    expect(printedKeyword(card("16066"), "Hinder")).toBe(2);
    expect(scaledKeyword(card("16066"), "Hinder", 3)).toBe(6);
    expect(printedKeyword(card("16127"), "Victory")).toBe(0);
    expect(hasPrintedKeyword(card("16127"), "Victory")).toBe(true);
    expect(printedKeyword(card("50125"), "Victory")).toBe(-1);
    expect(hasPrintedKeyword(card("50125"), "Victory")).toBe(true);
  });

  it("adds numbered instances but does not multiply duplicate boolean keywords", () => {
    expect(
      printedKeyword({ text: "\n Retaliate 1. Retaliate 2." }, "Retaliate"),
    ).toBe(3);
    expect(printedKeyword({ text: "Guard. Guard." }, "Guard")).toBe(1);
    expect(printedKeyword({ text: "Retaliate X." }, "Retaliate")).toBe(0);
  });
});

describe("counted and legacy status cards", () => {
  it("normal characters hold one Stun/Confuse and consume all cards that canceled a power", () => {
    const piece = empty();
    expect(giveStatus(piece, normal, "stunned")).toBe(true);
    expect(giveStatus(piece, normal, "stunned")).toBe(false);
    expect(piece.stunned).toBe(true);
    expect(statusCards(piece, "stunned")).toBe(1);
    expect(consumeStatus(piece, "stunned", normal)).toBe(true);
    expect(consumeStatus(piece, "stunned", normal)).toBe(false);
    expect(piece.stunCards).toBe(0);
    expect(giveStatus(piece, normal, "confused")).toBe(true);
    expect(consumeStatus(piece, "confused", normal)).toBe(true);
  });

  it("Steady needs two cards, then cancels once and removes both", () => {
    const piece = empty();
    const steady = card("27075");
    expect(giveStatus(piece, steady, "stunned")).toBe(true);
    expect(piece.stunned).toBe(false);
    expect(statusCards(piece, "stunned")).toBe(1);
    expect(consumeStatus(piece, "stunned", steady)).toBe(false);
    expect(giveStatus(piece, steady, "stunned")).toBe(true);
    expect(piece.stunned).toBe(true);
    expect(giveStatus(piece, steady, "stunned")).toBe(false);
    expect(consumeStatus(piece, "stunned", steady)).toBe(true);
    expect(piece.stunCards).toBe(0);
    expect(piece.stunned).toBe(false);
    expect(giveStatus(piece, steady, "confused")).toBe(true);
    expect(piece.confused).toBe(false);
    expect(giveStatus(piece, steady, "confused")).toBe(true);
    expect(piece.confused).toBe(true);
  });

  it("Stalwart forbids Stun/Confuse and removes existing cards when gained", () => {
    const piece = {
      ...empty(),
      stunned: true,
      confused: true,
      stunCards: 2,
      confuseCards: 1,
      tough: true,
    };
    syncStatuses(piece, card("21112"));
    expect(piece).toMatchObject({
      stunned: false,
      confused: false,
      stunCards: 0,
      confuseCards: 0,
      tough: true,
      toughCards: 1,
    });
    expect(giveStatus(piece, card("21112"), "stunned")).toBe(false);
    expect(giveStatus(piece, card("21112"), "confused")).toBe(false);
    expect(giveStatus(empty(), card("21112"), "tough")).toBe(true);
  });

  it("derived keyword grants and removals override printed state without interpreting card references", () => {
    const piece = empty();
    giveStatus(piece, normal, "stunned", { steady: true });
    expect(piece.stunned).toBe(false);
    syncStatuses(piece, normal, { steady: false });
    expect(piece.stunned).toBe(true);
    syncStatuses(piece, normal, { stalwart: true });
    expect(statusCards(piece, "stunned")).toBe(0);
    expect(
      giveStatus(piece, card("21112"), "confused", { stalwart: false }),
    ).toBe(true);
    expect(giveStatus(piece, normal, "stunned", { cannotStun: true })).toBe(
      false,
    );
  });

  it("preserves legacy effective statuses and explicit counts across JSON saves", () => {
    const legacy = { ...empty(), stunned: true, confused: true, tough: true };
    syncStatuses(legacy, card("27075"));
    expect(legacy).toMatchObject({
      stunned: true,
      confused: true,
      stunCards: 2,
      confuseCards: 2,
      toughCards: 1,
    });
    const restored = JSON.parse(JSON.stringify(legacy));
    expect(consumeStatus(restored, "stunned", card("27075"))).toBe(true);
    expect(restored.stunCards).toBe(0);
    const explicit = { ...empty(), stunned: true, stunCards: 1 };
    syncStatuses(explicit, card("27075"));
    expect(explicit.stunned).toBe(false);
    expect(explicit.stunCards).toBe(1);
    syncStatuses(explicit, normal);
    expect(explicit.stunned).toBe(true);
  });

  it("counts Tough independently, consumes one per damage instance and honors increased limits", () => {
    const piece = empty();
    expect(giveStatus(piece, normal, "tough")).toBe(true);
    expect(giveStatus(piece, normal, "tough")).toBe(false);
    expect(giveStatus(piece, normal, "tough", { toughLimit: 2 })).toBe(true);
    expect(piece.toughCards).toBe(2);
    expect(consumeTough(piece)).toBe(true);
    expect(piece.tough).toBe(true);
    expect(consumeTough(piece)).toBe(true);
    expect(piece.tough).toBe(false);
    expect(consumeTough(piece)).toBe(false);
    for (let i = 0; i < 5; i++)
      expect(giveStatus(piece, normal, "tough", { toughLimit: Infinity })).toBe(
        true,
      );
    expect(statusCards(piece, "tough")).toBe(5);
  });

  it("clears all statuses when a card instance resets and sanitizes malformed counts", () => {
    const piece = {
      ...empty(),
      stunned: true,
      confused: true,
      tough: true,
      stunCards: 2,
      confuseCards: 2,
      toughCards: 3,
    };
    clearStatuses(piece);
    expect(piece).toMatchObject({
      stunned: false,
      confused: false,
      tough: false,
      stunCards: 0,
      confuseCards: 0,
      toughCards: 0,
    });
    expect(statusCards({ ...empty(), stunCards: NaN }, "stunned")).toBe(0);
    expect(statusCards({ ...empty(), confuseCards: -1 }, "confused")).toBe(0);
  });
});

describe("RRG1.8 combat keyword boundaries", () => {
  it("piercing discards every Tough only if positive damage would remain before Tough", () => {
    const piece = { ...empty(), tough: true, toughCards: 3 };
    expect(discardToughForPiercing(piece, 0, true)).toBe(0);
    expect(piece.toughCards).toBe(3);
    expect(discardToughForPiercing(piece, -1, true)).toBe(0);
    expect(discardToughForPiercing(piece, 4, false)).toBe(0);
    expect(discardToughForPiercing(piece, 4, true)).toBe(3);
    expect(piece.toughCards).toBe(0);
    expect(piece.tough).toBe(false);
  });

  it("retaliate requires a resolved attack and surviving source, and ranged ignores it", () => {
    expect(
      retaliateAmount(2, { attackResolved: true, sourceInPlay: true }),
    ).toBe(2);
    expect(
      retaliateAmount(2, { attackResolved: true, sourceInPlay: false }),
    ).toBe(0);
    expect(
      retaliateAmount(2, { attackResolved: false, sourceInPlay: true }),
    ).toBe(0);
    expect(
      retaliateAmount(2, {
        attackResolved: true,
        sourceInPlay: true,
        ranged: true,
      }),
    ).toBe(0);
    // The helper intentionally has no damage-taken check: Tough doesn't prevent retaliate.
  });

  it("patrol restricts main-scheme thwarts rather than direct removal of threat", () => {
    expect(patrolBlocksMainScheme({ engagedPatrol: true, thwart: true })).toBe(
      true,
    );
    expect(patrolBlocksMainScheme({ engagedPatrol: true, thwart: false })).toBe(
      false,
    );
    expect(patrolBlocksMainScheme({ engagedPatrol: false, thwart: true })).toBe(
      false,
    );
    expect(
      patrolBlocksMainScheme({
        engagedPatrol: true,
        thwart: true,
        ignorePatrol: true,
      }),
    ).toBe(false);
  });
});

function engineBase() {
  let state = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    seed: 177,
    guided: false,
  });
  state = dispatch(state, { type: "MULLIGAN", ids: [] });
  state.player.form = "hero";
  state.player.hand = [];
  state.player.deck = [];
  state.player.discard = [];
  state.queue = [];
  return state;
}
function execute(state: GameState, effects: Effect[]) {
  state.queue = effects;
  state.prompt = {
    kind: "choice",
    title: "keyword fixture",
    text: "",
    options: [{ id: "go", label: "go", effects: [] }],
  };
  let result = dispatch(state, { type: "CHOOSE", id: "go" });
  for (let step = 0; result.prompt && step < 20; step++) {
    const option = result.prompt.options.find((option) =>
      ["take", "allow", "pass", "skip"].includes(option.id),
    );
    if (!option) break;
    result = dispatch(result, { type: "CHOOSE", id: option.id });
  }
  expect(result.error).toBeUndefined();
  return result;
}

describe("keyword effects through the native engine", () => {
  it("uses the two-card Steady threshold and Stalwart prohibition for queued status effects", () => {
    const state = engineBase();
    const steady = makePiece(state, "27128");
    const stalwart = makePiece(state, "16133");
    state.minions.push(steady, stalwart);
    let result = execute(state, [
      { type: "status", target: steady.id, status: "stunned" },
      { type: "status", target: stalwart.id, status: "confused" },
    ]);
    expect(
      result.minions.find((piece) => piece.id === steady.id),
    ).toMatchObject({ stunCards: 1, stunned: false });
    expect(
      result.minions.find((piece) => piece.id === stalwart.id),
    ).toMatchObject({ confuseCards: 0, confused: false });
    result = execute(result, [
      { type: "status", target: steady.id, status: "stunned" },
      { type: "enemyAttack", id: steady.id },
    ]);
    expect(
      result.minions.find((piece) => piece.id === steady.id),
    ).toMatchObject({ stunCards: 0, stunned: false });
    expect(result.player.hp).toBe(state.player.hp);
  });

  it("consumes one Tough per damage and discards all Tough for a positive piercing attack", () => {
    const state = engineBase();
    const minion = makePiece(state, "01172");
    minion.tough = true;
    minion.toughCards = 2;
    state.minions.push(minion);
    let result = execute(state, [
      { type: "damage", target: minion.id, amount: 1, attack: true },
    ]);
    expect(
      result.minions.find((piece) => piece.id === minion.id),
    ).toMatchObject({ tough: true, toughCards: 1, damage: 0 });
    expect(result.player.hp).toBe(state.player.hp - 1); // Retaliate even though Tough prevented damage.
    result = execute(result, [
      {
        type: "damage",
        target: minion.id,
        amount: 1,
        attack: true,
        piercing: true,
        ranged: true,
      },
    ]);
    expect(
      result.minions.find((piece) => piece.id === minion.id),
    ).toMatchObject({ tough: false, toughCards: 0, damage: 1 });
    expect(result.player.hp).toBe(state.player.hp - 1); // Ranged ignores that attack's Retaliate.
  });

  it("does not remove Tough for a zero-damage piercing attack and does not retaliate after defeat", () => {
    const state = engineBase();
    const minion = makePiece(state, "01172");
    minion.tough = true;
    state.minions.push(minion);
    let result = execute(state, [
      {
        type: "damage",
        target: minion.id,
        amount: 0,
        attack: true,
        piercing: true,
        ranged: true,
      },
    ]);
    expect(result.minions.find((piece) => piece.id === minion.id)?.tough).toBe(
      true,
    );
    result = execute(result, [
      {
        type: "damage",
        target: minion.id,
        amount: card(minion).health!,
        attack: true,
        piercing: true,
      },
    ]);
    expect(result.minions.some((piece) => piece.id === minion.id)).toBe(false);
    expect(result.player.hp).toBe(state.player.hp);
  });

  it("gives a Villainous minion one boost for either attack or scheme and resolves its icons", () => {
    for (const form of ["hero", "alter"] as const) {
      const state = engineBase();
      state.player.form = form;
      state.scheme.threat = 0;
      const minion = makePiece(state, "16075");
      const boost = makePiece(state, "01112");
      state.minions.push(minion);
      state.encounter.deck = [boost, makePiece(state, "01101")];
      state.encounter.discard = [];
      const result = execute(state, [
        {
          type: form === "hero" ? "enemyAttack" : "enemyScheme",
          id: minion.id,
        },
      ]);
      expect(result.encounter.discard.map((piece) => piece.id)).toContain(
        boost.id,
      );
      const power =
        (form === "hero" ? card(minion).attack! : card(minion).scheme!) +
        card(boost).boost!;
      if (form === "hero")
        expect(result.player.hp).toBe(state.player.hp - power);
      else expect(result.scheme.threat).toBe(power);
    }
  });

  it("Patrol blocks thwarting but permits direct main-scheme threat removal", () => {
    const state = engineBase();
    state.scheme.threat = 3;
    const patrol = makePiece(state, "16132");
    patrol.engagedWith = state.activePlayerId;
    state.minions.push(patrol);
    expect(
      targets(state, "scheme", false, true).some(
        (target) => target.id === "main",
      ),
    ).toBe(false);
    expect(
      targets(state, "scheme", false, false).some(
        (target) => target.id === "main",
      ),
    ).toBe(true);
    const result = execute(state, [
      { type: "thwart", target: "main", amount: 2 },
    ]);
    expect(result.scheme.threat).toBe(1);
  });

  it("Crisis blocks all main-scheme threat removal by player cards", () => {
    const state = engineBase();
    state.scheme.threat = 3;
    const crisis = makePiece(state, "01108");
    expect(card(crisis).scheme_crisis).toBe(1);
    crisis.counters = 2;
    state.sideSchemes.push(crisis);
    for (const thwarting of [true, false])
      expect(
        targets(state, "scheme", false, thwarting).some(
          (target) => target.id === "main",
        ),
      ).toBe(false);
    const result = execute(state, [
      { type: "thwart", target: "main", amount: 2 },
    ]);
    expect(result.scheme.threat).toBe(3);
  });

  it("adds Incite on reveal and Hinder to the printed starting threat", () => {
    const state = engineBase();
    state.scheme.threat = 0;
    const incite = makePiece(state, "04056");
    const hinder = makePiece(state, "16066");
    const result = execute(state, [
      { type: "reveal", piece: incite, skip: true },
      { type: "reveal", piece: hinder, skip: true },
    ]);
    expect(result.scheme.threat).toBe(1);
    expect(
      result.sideSchemes.find((piece) => piece.id === hinder.id)?.counters,
    ).toBe(card(hinder).base_threat! + 2);
  });
});
