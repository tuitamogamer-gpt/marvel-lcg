import { describe, expect, it } from "vitest";
import { enemyStats, newGame } from "../src/game/engine.js";
import { card } from "../src/game/cards.js";
import {
  actualEncounter,
  base,
  choose,
  command,
  conserved,
  native,
  operation,
  physical,
  put,
  settle,
  until,
} from "./project-wideawake-test-helpers.js";

describe("Zero Tolerance actual native card rules", () => {
  it("a real classic Rhino ally defeat creates no Zero Tolerance ledger", () => {
    let s = newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "rhino",
      seed: 321040,
      pacing: "expert",
    });
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.form = "hero";
    const fury = put(s, "01084");
    const boostIndex = s.encounter.deck.findIndex(
      (p) => (card(p).boost || 0) >= 2 && !card(p).boost_star,
    );
    expect(boostIndex).toBeGreaterThanOrEqual(0);
    const [boost] = s.encounter.deck.splice(boostIndex, 1);
    s.encounter.deck.unshift(boost);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === fury.id));
    s = settle(choose(s, fury.id));
    expect(s.player.inPlay.some((p) => p.id === fury.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === fury.id)).toBe(true);
    expect(physical(s).filter((p) => p.id === fury.id)).toHaveLength(1);
    expect(s.zeroToleranceDefeats).toBeUndefined();
  });
  it("Mark II gains Surge from the permanent Operation's actual presence", () => {
    let s = base();
    const p = actualEncounter(s, "32101");
    const dealt = s.encounter.dealt.length;
    s = settle(native(s, { type: "reveal", piece: p, skip: true }));
    expect(s.minions.find((q) => q.id === p.id)?.engagedWith).toBe(
      s.activePlayerId,
    );
    expect(s.encounter.dealt).toHaveLength(dealt + 1);
    expect(operation(s).code).toBe("32104");
    conserved(s);
  });

  it("Mark II searches and reveals the same Operation source outside Wideawake", () => {
    let s = base();
    const operationPiece = operation(s);
    s.scheme.code = "01097b";
    s.villainId = "rhino";
    s = settle(native(s, { type: "discardPiece", id: operationPiece.id }));
    const mark = actualEncounter(s, "32101");
    s = native(s, { type: "reveal", piece: mark, skip: true });
    s = until(
      s,
      (v) => !!v.prompt?.options.some((o) => o.id === operationPiece.id),
    );
    s = settle(choose(s, operationPiece.id));
    expect(operation(s).id).toBe(operationPiece.id);
    expect(operation(s).counters).toBe(3);
    expect(s.encounter.discard.some((q) => q.id === operationPiece.id)).toBe(
      false,
    );
    conserved(s);
  });

  it("Mark III attaches the actual searched Barrier and Toughness is not repeated after direct attachment", () => {
    let s = base();
    const mark = actualEncounter(s, "32102");
    s = native(s, { type: "reveal", piece: mark, skip: true });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.image === "32103"));
    const barrierId = s.prompt!.options.find((o) => o.image === "32103")!.id;
    // Remove the single actual entry Tough before the searched attachment
    // resolves: a specific attachment must not rerun ordinary Attach To text.
    s.minions.find((p) => p.id === mark.id)!.tough = false;
    s.minions.find((p) => p.id === mark.id)!.toughCards = 0;
    s = settle(choose(s, barrierId));
    expect(s.attachments.find((p) => p.id === barrierId)?.attachedTo).toBe(
      mark.id,
    );
    expect(s.minions.find((p) => p.id === mark.id)?.tough).toBe(false);
    expect(
      enemyStats(
        s,
        s.minions.find((p) => p.id === mark.id)!,
      ).attack,
    ).toBe(5);
    conserved(s);
  });

  it("ordinary Barrier attaches once, gives Tough, and replenishes it after a performed attack", () => {
    let s = base();
    const mark = actualEncounter(s, "32101"),
      barrier = actualEncounter(s, "32103");
    mark.engagedWith = s.activePlayerId;
    s.minions.push(mark);
    s = native(s, { type: "reveal", piece: barrier, skip: true });
    s = settle(choose(s, mark.id));
    expect(s.minions.find((p) => p.id === mark.id)).toMatchObject({
      tough: true,
      toughCards: 1,
    });
    s = settle(
      native(s, { type: "damage", target: mark.id, amount: 1, source: "hero" }),
    );
    expect(s.minions.find((p) => p.id === mark.id)?.tough).toBe(false);
    s = settle(native(s, { type: "enemyAttack", id: mark.id }));
    expect(s.player.hp).toBe(6);
    expect(s.minions.find((p) => p.id === mark.id)).toMatchObject({
      tough: true,
      toughCards: 1,
    });
    conserved(s);
  });

  it("a Stun-replaced Barrier attack never grants a new Tough", () => {
    let s = base();
    const mark = actualEncounter(s, "32101"),
      barrier = actualEncounter(s, "32103");
    mark.engagedWith = s.activePlayerId;
    mark.stunned = true;
    mark.stunCards = 1;
    barrier.attachedTo = mark.id;
    s.minions.push(mark);
    s.attachments.push(barrier);
    s = settle(native(s, { type: "enemyAttack", id: mark.id }));
    expect(s.player.hp).toBe(10);
    expect(s.minions.find((p) => p.id === mark.id)?.tough).toBe(false);
    expect(s.enemyAttackCounts?.[mark.id] || 0).toBe(0);
    conserved(s);
  });

  it.each([false, true])(
    "Mark III's real boost %s distinguishes Stun from independent damage",
    (stunned) => {
      let s = base();
      const boost = actualEncounter(s, "32102");
      s.encounter.deck.unshift(boost);
      s.player.stunned = stunned;
      s.player.stunCards = Number(stunned);
      s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
      expect(s.player.stunned).toBe(true);
      expect(s.player.hp).toBe(stunned ? 6 : 8);
      expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
      conserved(s);
    },
  );
});
