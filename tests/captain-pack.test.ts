import { describe, expect, it, vi } from "vitest";
import importedCards from "../src/data/catalog-cards.json";
import { makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { rulesCode } from "../src/game/rules-code";
import { seatView } from "../src/game/team";
import { CAPTAIN_AMERICA_SCRIPT_CODES } from "../src/game/captain-america";
import {
  CAPTAIN_PACK_CORE_ALIASES,
  CAPTAIN_PACK_SCRIPT_CODES,
  captainPackModifiers,
  captainPackHasTrait,
  captainPackAllyLimit,
  captainPackDiscount,
  captainPackCardPlayed,
  captainPackStats,
  captainPackPhaseEnded,
  captainPackPlayRestriction,
  captainPackEvent,
  captainPackAllyEnter,
  captainPackAllyAttackCost,
  captainPackCardEntered,
  captainPackTurnStart,
  captainPackAbilityOptions,
  captainPackResourceSources,
  captainPackResourceSpent,
  captainPackSchemeDefeated,
  captainPackExpertDefenseOptions,
  resolveCaptainPackEffect,
  type CaptainPackPorts,
} from "../src/game/captain-pack";
import type { Effect, GameState, Piece } from "../src/game/types";

function fixture() {
  const s = newGame({
    heroId: "captain_america",
    villainId: "rhino",
    aspect: "leadership",
    seed: 42,
    pacing: "expert",
  });
  s.phase = "player";
  s.player.form = "hero";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.queue = [];
  s.prompt = null;
  const ports: CaptainPackPorts = {
    queue: (s, ...effects) => {
      s.queue.unshift(...effects);
    },
    choose: (s, title, text, options) => {
      s.prompt = { kind: "choice", title, text, options };
    },
    select: (s, title, text, pieces, min, max, selectAction) => {
      s.prompt = {
        kind: "select",
        title,
        text,
        min,
        max,
        selectAction,
        options: pieces.map((p) => ({
          id: p.id,
          label: card(p).name,
          effects: [],
        })),
      };
    },
    discardHand: (s, id) => {
      const index = s.player.hand.findIndex((p) => p.id === id);
      if (index < 0) throw Error("Not in hand");
      s.player.discard.push(s.player.hand.splice(index, 1)[0]);
    },
    revealHidden: (s) => {
      s.hiddenInfo = (s.hiddenInfo || 0) + 1;
    },
    putAllyFromHand: vi.fn((s: GameState, id: string) => {
      const index = s.player.hand.findIndex((p) => p.id === id);
      s.player.inPlay.push(s.player.hand.splice(index, 1)[0]);
    }),
    attach: vi.fn((s: GameState, id: string, target: string) => {
      s.player.inPlay.find((p) => p.id === id)!.attachedTo = target;
    }),
  };
  const run = (effect: Effect) => resolveCaptainPackEffect(s, effect, ports);
  const choose = (id: string) => {
    const option = s.prompt!.options.find((o) => o.id === id)!;
    s.prompt = null;
    option.effects.forEach(run);
  };
  const select = (...ids: string[]) => {
    const effect = s.prompt!.selectAction!;
    s.prompt = null;
    run({ ...effect, ids });
  };
  const hand = (...codes: string[]) => {
    s.player.hand = codes.map((code) => makePiece(s, code));
    return [...s.player.hand];
  };
  const play = (code: string, target?: string) => {
    const p = makePiece(s, code);
    if (target) p.attachedTo = target;
    s.player.inPlay.push(p);
    return p;
  };
  return { s, ports, run, choose, select, hand, play };
}

describe("the complete Captain America product's non-signature rules", () => {
  it("accounts for all35 faces through16 identity/set handlers,12 pack handlers and7 exact Core reprints", () => {
    const packCodes = importedCards
      .filter((c) => c.pack_code === "cap")
      .map((c) => c.code)
      .sort();
    expect(
      [
        ...CAPTAIN_AMERICA_SCRIPT_CODES,
        ...CAPTAIN_PACK_SCRIPT_CODES,
        ...CAPTAIN_PACK_CORE_ALIASES,
      ].sort(),
    ).toEqual(packCodes);
    for (const code of CAPTAIN_PACK_CORE_ALIASES)
      expect(rulesCode(code)).toMatch(/^01/);
  });
  it("Falcon reveals the actual ordered top3 without milling or shuffling, then allows separate1-threat targets", () => {
    const { s, run, choose } = fixture();
    const top = ["03030", "03028", "03030"].map((code) => makePiece(s, code));
    s.encounter.deck = top.slice();
    run({ type: "cap-pack:falcon" });
    expect(s.encounter.deck).toEqual(top);
    expect(s.hiddenInfo).toBeGreaterThan(0);
    expect(s.prompt?.options[0].detail).toContain("1. Hail Hydra!");
    choose("continue");
    expect(s.queue).toHaveLength(2);
    expect(
      s.queue.every((e) => e.type === "target" && e.action.amount === 1),
    ).toBe(true);
  });
  it("Falcon handles fewer than3 remaining cards without recycling the encounter discard pile", () => {
    const { s, run, choose } = fixture();
    s.encounter.deck = [makePiece(s, "03028")];
    s.encounter.discard = [makePiece(s, "03030")];
    run({ type: "cap-pack:falcon" });
    choose("continue");
    expect(s.queue).toEqual([]);
    expect(s.encounter.deck).toHaveLength(1);
    expect(s.encounter.discard).toHaveLength(1);
  });
  it("SquirrelGirl's optional entry damages each enemy without initiating an attack", () => {
    const { s, run } = fixture();
    const guard = makePiece(s, "03029");
    s.minions = [guard];
    s.player.stunned = true;
    const entry = captainPackAllyEnter(s, makePiece(s, "03013"))!;
    expect(entry[0].type).toBe("optional");
    run(entry[0].effects[0]);
    expect(s.queue.map((e) => e.target)).toEqual([s.villain.id, guard.id]);
    expect(s.queue.every((e) => e.amount === 1 && !e.attack)).toBe(true);
    expect(s.player.stunned).toBe(true);
  });
  it("WonderMan's attack waits for a real selected hand discard before targeting, even if stunned", () => {
    const { s, run, play, hand, select } = fixture();
    const ally = play("03014");
    ally.stunned = true;
    const h = hand("03003", "03004");
    run(captainPackAllyAttackCost(s, ally)![0]);
    expect(ally.exhausted).toBe(false);
    expect(s.player.hand).toHaveLength(2);
    select(h[1].id);
    expect(s.player.discard).toEqual([h[1]]);
    expect(s.queue).toEqual([
      {
        type: "target",
        group: "enemy",
        action: {
          type: "allyAction",
          id: ally.id,
          kind: "attack",
          attack: true,
        },
      },
    ]);
  });
  it("WonderMan cannot attack with no hand card, but his ordinary thwart has no discard requirement", () => {
    const { run, play, s } = fixture();
    const ally = play("03014");
    expect(() => run(captainPackAllyAttackCost(s, ally)![0])).toThrow(
      "discard one card",
    );
    expect(captainPackAllyAttackCost(s, play("03002"))).toBeNull();
  });
  it("StrengthInNumbers selects only controlled ready allies and draws exactly the chosen number", () => {
    const { s, run, play, select } = fixture();
    const a = play("03002");
    const b = play("03014");
    const exhausted = play("03011");
    exhausted.exhausted = true;
    run(captainPackEvent(s, makePiece(s, "03017"))![0]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    expect(s.prompt?.min).toBe(0);
    select(b.id);
    expect(b.exhausted).toBe(true);
    expect(a.exhausted).toBe(false);
    expect(s.queue).toEqual([{ type: "draw", amount: 1 }]);
  });
  it("StrengthInNumbers validates all selections before any ally is exhausted", () => {
    const { run, play } = fixture();
    const a = play("03002");
    expect(() =>
      run({ type: "cap-pack:strength-paid", ids: [a.id, "missing"] }),
    ).toThrow();
    expect(a.exhausted).toBe(false);
  });
  it("Quinjet's turn counter is an optional response and entering it does not grant a counter immediately", () => {
    const { s, play } = fixture();
    const jet = play("03019");
    expect(captainPackCardEntered(s, jet)).toEqual([]);
    expect(jet.counters).toBe(0);
    expect(captainPackTurnStart(s)[0]).toMatchObject({
      type: "optional",
      effects: [{ type: "counter", id: jet.id, amount: 1 }],
    });
  });
  it("Quinjet compares printed Avenger costs, ignores discounts and can put an ally into play without paying", () => {
    const { s, run, choose, play, hand, ports } = fixture();
    const jet = play("03019");
    jet.counters = 2;
    jet.exhausted = true;
    const h = hand("03014", "03011", "03002", "01083");
    s.flags.discount = 5;
    expect(captainPackAbilityOptions(s, jet.id)).toHaveLength(1);
    run({ type: "cap-pack:quinjet", id: jet.id });
    expect(s.prompt?.options.map((o) => o.id)).toEqual([h[0].id]);
    choose(h[0].id);
    expect(ports.putAllyFromHand).toHaveBeenCalledWith(s, h[0].id);
    expect(s.queue).toEqual([{ type: "discardPiece", id: jet.id }]);
    expect(s.flags.discount).toBe(5); // Putting into play does not consume a "next played" discount.
  });
  it("Quinjet excludes matching unique allies and matching identities already in play", () => {
    const { s, play, hand, run } = fixture();
    const jet = play("03019");
    jet.counters = 6;
    play("03014");
    hand("03014", "21011");
    expect(captainPackAbilityOptions(s, jet.id)).toEqual([]);
    run({ type: "cap-pack:quinjet", id: jet.id });
    expect(s.prompt?.options).toEqual([]);
  });
  it("AvengersTower's conditional ally limit responds to HonoraryAvenger and trait loss", () => {
    const { s, play } = fixture();
    play("03024");
    expect(captainPackAllyLimit(s)).toBe(1);
    const ally = play("03002");
    expect(captainPackAllyLimit(s)).toBe(0);
    const honorary = play("03025", ally.id);
    expect(captainPackAllyLimit(s)).toBe(1);
    s.player.inPlay = s.player.inPlay.filter((p) => p.id !== honorary.id);
    expect(captainPackAllyLimit(s)).toBe(0);
  });
  it("Tower exhausts, waits through non-Avenger cards and only discounts the next played Avenger ally", () => {
    const { s, play, run } = fixture();
    const tower = play("03024");
    run({ type: "cap-pack:tower", id: tower.id });
    expect(tower.exhausted).toBe(true);
    expect(captainPackDiscount(s, card("03014"))).toBe(1);
    expect(captainPackDiscount(s, card("03002"))).toBe(0);
    captainPackCardPlayed(s, card("03002"));
    expect(captainPackDiscount(s, card("03014"))).toBe(1);
    captainPackCardPlayed(s, card("03014"));
    expect(captainPackDiscount(s, card("03014"))).toBe(0);
    tower.exhausted = false;
    run({ type: "cap-pack:tower", id: tower.id });
    captainPackPhaseEnded(s);
    expect(captainPackDiscount(s, card("03014"))).toBe(0);
  });
  it("HonoraryAvenger can attach to a canonical hero or ally once and keeps its granted trait across forms", () => {
    const { s, play, run, choose } = fixture();
    const honorary = play("03025");
    run(captainPackCardEntered(s, honorary)[0]);
    expect(s.prompt?.options.some((o) => o.id === "hero:p1")).toBe(true);
    choose("hero:p1");
    expect(captainPackModifiers(s, "hero").hp).toBe(1);
    s.player.form = "alter";
    expect(captainPackHasTrait(s, "hero", "Avenger")).toBe(true);
    const other = play("03025");
    run(captainPackCardEntered(s, other)[0]);
    expect(s.prompt?.options.some((o) => o.id === "hero:p1")).toBe(false);
    expect(captainPackPlayRestriction(s, other)).toBeTruthy();
  });
  it("HonoraryAvenger's play permission depends on the currently active identity trait", () => {
    const { s } = fixture();
    const upgrade = makePiece(s, "03025");
    s.player.form = "alter";
    expect(captainPackPlayRestriction(s, upgrade)).toContain("Avenger trait");
    s.player.form = "hero";
    expect(captainPackPlayRestriction(s, upgrade)).toBeNull();
  });
  it("Enraged grants2ATK and1extra attack consequence only to its attached ally", () => {
    const { s, play } = fixture();
    const ally = play("03014");
    const other = play("03002");
    play("03031", ally.id);
    expect(captainPackModifiers(s, ally.id)).toMatchObject({
      attack: 2,
      consequentialAttack: 1,
    });
    expect(captainPackModifiers(s, other.id)).toMatchObject({
      attack: 0,
      consequentialAttack: 0,
    });
  });
  it("Followed's defeated-scheme interrupt is optional damage, belongs to its controller and ignores Guard", () => {
    const { s, play } = fixture();
    const scheme = makePiece(s, "03027");
    s.sideSchemes.push(scheme);
    const followed = play("03032", scheme.id);
    const effects = captainPackSchemeDefeated(s, scheme);
    expect(effects[0]).toMatchObject({
      type: "optional",
      actorId: followed.ownerId,
      title: "Followed",
    });
    expect(effects[0].effects[0].action).toMatchObject({
      type: "damage",
      amount: 4,
    });
    expect(effects[0].effects[0].action.attack).toBeUndefined();
  });
  it("ExpertDefense is a real basic-defense interrupt and gives3DEF to that attack, never future attacks", () => {
    const { s, hand, run } = fixture();
    const h = hand("03033");
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
      basicDefense: true,
    };
    const after = [{ type: "boostAttack" }];
    const opts = captainPackExpertDefenseOptions(s, after);
    run(opts[0].effects[0]);
    expect(s.queue[0]).toEqual({
      type: "resolveHandEvent",
      id: h[0].id,
      after: [{ type: "cap-pack:expert-bonus" }, ...after],
    });
    run(s.queue[0].after[0]);
    expect(s.attack.defense).toBe(5);
    s.attack = null;
    expect(captainPackExpertDefenseOptions(s, after)).toEqual([]);
  });
  it("EnhancedAwareness has3mental counters, is HeroResource only, and discards after its final resource", () => {
    const { s, play } = fixture();
    const p = play("03034");
    captainPackCardEntered(s, p);
    expect(p.counters).toBe(3);
    expect(captainPackResourceSources(s)[0].resources).toEqual(["mental"]);
    expect(captainPackResourceSpent(s, p)).toEqual([]);
    expect(p.counters).toBe(2);
    p.exhausted = true;
    expect(captainPackResourceSources(s)).toEqual([]);
    p.exhausted = false;
    s.player.form = "alter";
    expect(captainPackResourceSources(s)).toEqual([]);
    s.player.form = "hero";
    captainPackResourceSpent(s, p);
    expect(captainPackResourceSpent(s, p)).toEqual([
      { type: "discardPiece", id: p.id },
    ]);
    expect(() => captainPackResourceSpent(s, p)).toThrow();
    expect(p.counters).toBe(0);
  });
  it("AvengersAssemble readies own Avengers, snapshots current recipients and enforces max1perround", () => {
    const { s, play, run } = fixture();
    const ally = play("03014");
    ally.exhausted = true;
    const nonAvenger = play("03002");
    nonAvenger.exhausted = true;
    s.player.exhausted = true;
    run({ type: "cap-pack:assemble" });
    expect(s.player.exhausted).toBe(false);
    expect(ally.exhausted).toBe(false);
    expect(nonAvenger.exhausted).toBe(true);
    expect(captainPackStats(s)).toEqual({ attack: 1, thwart: 1 });
    expect(ally.bonusAtk).toBe(1);
    expect(nonAvenger.bonusAtk).toBeUndefined();
    const later = play("03013");
    expect(later.bonusAtk).toBeUndefined();
    expect(captainPackPlayRestriction(s, makePiece(s, "03015"))).toContain(
      "once per round",
    );
    captainPackPhaseEnded(s);
    expect(captainPackStats(s)).toEqual({ attack: 0, thwart: 0 });
    expect(ally.bonusAtk).toBe(0);
  });
  it("Assemble's Max applies across players even when the played copy's effects are canceled", () => {
    const s = newGame({
      heroId: "captain_america",
      villainId: "rhino",
      aspect: "leadership",
      seed: 42,
      heroes: [
        { heroId: "captain_america", aspect: "leadership" },
        { heroId: "spider_man", aspect: "justice" },
      ],
    });
    captainPackCardPlayed(s, card("03015"));
    const other = seatView(s, "p2");
    const second = makePiece(s, "03015");
    expect(captainPackPlayRestriction(other, second)).toContain(
      "once per round",
    );
    // Player elimination does not erase a shared maximum already consumed.
    s.players[0].eliminated = true;
    expect(captainPackPlayRestriction(other, second)).toContain(
      "once per round",
    );
    other.round++;
    expect(captainPackPlayRestriction(other, second)).toBeNull();
  });
});
