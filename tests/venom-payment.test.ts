import { describe, expect, it } from "vitest";
import { dispatch, paymentSources } from "../src/game/engine.js";
import { paidResourceAllocations } from "../src/game/payment.js";
import { activateSeat, seatView } from "../src/game/team.js";
import {
  base,
  choose,
  command,
  conserved,
  finish,
  hand,
  native,
  pay,
  play,
  physical,
  reload,
  respond,
  target,
} from "./dv-test-helpers.js";

describe("actual cost resource allocation", () => {
  it("enumerates distinct legal multisets rather than trimming generated pips", () => {
    expect(
      paidResourceAllocations(["mental", "mental", "energy", "energy"], 2),
    ).toEqual([
      ["energy", "energy"],
      ["mental", "mental"],
      ["energy", "mental"],
    ]);
  });
  it("does not ask which indistinguishable double-resource pips were used", () => {
    expect(
      paidResourceAllocations(["mental", "mental", "mental", "mental"], 2),
    ).toEqual([["mental", "mental"]]);
  });
  it("allocates wilds to typed requirements before allowing generic overpayment", () => {
    expect(
      paidResourceAllocations(
        ["energy", "energy", "wild"],
        2,
        ["mental"],
        "physical",
      ),
    ).toEqual([["energy", "mental"]]);
    expect(
      paidResourceAllocations(["energy", "energy"], 2, ["mental"]),
    ).toEqual([]);
  });
  it("retains legal choices when either a matching pip or a wild pays a requirement", () => {
    expect(
      paidResourceAllocations(
        ["mental", "physical", "wild"],
        2,
        ["mental"],
        "energy",
      ),
    ).toEqual([
      ["mental", "mental"],
      ["energy", "mental"],
      ["mental", "physical"],
    ]);
  });
  it("uses each generated wild once for multiple requirements", () => {
    expect(
      paidResourceAllocations(
        ["wild", "wild", "physical"],
        2,
        ["mental", "energy"],
        "physical",
      ),
    ).toEqual([["energy", "mental"]]);
    expect(
      paidResourceAllocations(["wild", "physical"], 2, ["mental", "energy"]),
    ).toEqual([]);
  });
  it("an actual zero resource cost has an empty allocation even with generated excess", () => {
    expect(
      paidResourceAllocations(["mental", "mental", "wild"], 0, [], "mental"),
    ).toEqual([[]]);
  });
  it("deduplicates a large generated pool by resource counts", () => {
    const printed = Array.from(
      { length: 40 },
      () => ["energy", "mental", "physical"] as const,
    ).flat();
    expect(paidResourceAllocations(printed, 2)).toHaveLength(6);
  });
});

describe("saved native Venom payments", () => {
  it("chooses only-Mental before any card or resource source is spent", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20018", "20017");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: h.slice(1).map((p) => p.id) });
    expect(s.prompt?.title).toBe("Allocate payment resources");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "energy",
      "mental",
      "energy+mental",
    ]);
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    expect(s.player.discard).toEqual([]);
    s = choose(reload(s), "mental");
    s = finish(target(target(s, "main"), "villain"));
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.confused).toBe(true);
    expect(
      s.player.discard.filter((p) => h.some((c) => c.id === p.id)),
    ).toHaveLength(3);
    conserved(s, h);
  });
  it("a different legal allocation from the same overpayment omits the bonus", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20018", "20017");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: h.slice(1).map((p) => p.id) });
    s = choose(reload(s), "energy");
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.confused).toBe(false);
    conserved(s, h);
  });
  it("a single actual multiset resolves without an extra choice", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20018", "20018");
    s = play(s, h[0], h.slice(1), "mental");
    expect(s.prompt?.title).not.toBe("Allocate payment resources");
    s = finish(target(target(s, "main"), "villain"));
    expect(s.villain.confused).toBe(true);
    conserved(s, h);
  });
  it("does not take Bond damage while an allocation is pending or canceled", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20018", "20017");
    s = command(s, { type: "PLAY", id: h[0].id });
    const originalPayment = JSON.parse(JSON.stringify(s.prompt));
    s = command(s, {
      type: "PAY",
      ids: [...h.slice(1).map((p) => p.id), "symbiotic-bond"],
      wildAs: "mental",
    });
    expect(s.prompt?.title).toBe("Allocate payment resources");
    expect(s.player.hp).toBe(12);
    expect(s.flags.venomBondPhase).toBeUndefined();
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    const canceled = command(reload(s), { type: "CANCEL" });
    expect(canceled.prompt).toEqual(originalPayment);
    expect(canceled.player.hp).toBe(12);
    expect(canceled.flags.venomBondPhase).toBeUndefined();
    expect(canceled.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    s = choose(reload(s), "mental");
    s = finish(target(target(s, "main"), "villain"));
    expect(s.player.hp).toBe(11);
    expect(s.flags.venomBondPhase).toBe(`${s.round}:${s.phase}`);
    conserved(s, h);
  });
  it("a saved Bond payment takes its full HP cost once and spends the phase limit", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20004");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(
      paymentSources(s, h[0].id, h[0].code).some(
        (p) => p.id === "symbiotic-bond",
      ),
    ).toBe(true);
    s = pay(reload(s), [h[1]], "mental", ["symbiotic-bond"]);
    s = finish(target(target(s, "main"), "villain"));
    expect(s.player.hp).toBe(11);
    expect(s.flags.venomBondPhase).toBe(`${s.round}:${s.phase}`);
    expect(s.villain.confused).toBe(true);
    const second = hand(s, "20002", "20004", "20012");
    s = command(s, { type: "PLAY", id: second[0].id });
    const unavailable = dispatch(reload(s), {
      type: "PAY",
      ids: [second[1].id, "symbiotic-bond"],
      wildAs: "mental",
    });
    expect(unavailable.error).toMatch(/unavailable/);
    expect(unavailable.player.hp).toBe(11);
    expect(unavailable.player.hand.map((p) => p.id)).toEqual(
      second.map((p) => p.id),
    );
  });
  it("allocation cancellation preserves the pending next-card discount until the card plays", () => {
    let s = base("vnm");
    s.flags.discount = 1;
    const h = hand(s, "20002", "20018", "20017");
    s = command(s, { type: "PLAY", id: h[0].id });
    const payment = JSON.parse(JSON.stringify(s.prompt));
    expect(s.prompt?.cost).toBe(1);
    s = command(s, { type: "PAY", ids: h.slice(1).map((p) => p.id) });
    expect(s.flags.discount).toBe(1);
    s = command(reload(s), { type: "CANCEL" });
    expect(s.prompt).toEqual(payment);
    expect(s.flags.discount).toBe(1);
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    s = command(s, { type: "PAY", ids: [h[1].id] });
    s = finish(target(target(s, "main"), "villain"));
    expect(s.flags.discount).toBe(0);
    expect(s.villain.confused).toBe(true);
    expect(s.player.hand.some((p) => p.id === h[2].id)).toBe(true);
    conserved(s, h);
  });
  it("can revise allocation for a mandatory payment without canceling the mandatory cost", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20018", "20017");
    s = native(s, {
      type: "payRequest",
      title: "Behind Enemy Lines",
      cost: 2,
      piece: h[0],
      cancelable: false,
      after: [{ type: "play", piece: h[0] }],
    });
    const payment = JSON.parse(JSON.stringify(s.prompt));
    s = command(s, { type: "PAY", ids: h.slice(1).map((p) => p.id) });
    s = command(reload(s), { type: "CANCEL" });
    expect(s.prompt).toEqual(payment);
    expect(s.prompt?.cancelable).toBe(false);
    const rejected = dispatch(reload(s), { type: "CANCEL" });
    expect(rejected.error).toMatch(/cannot be canceled/);
    expect(rejected.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    s = pay(s, [h[1]], "mental");
    s = finish(target(target(s, "main"), "villain"));
    expect(s.villain.confused).toBe(true);
    conserved(s, h);
  });
  it("Tough preserves both the status and HP when Bond cannot pay TAKE damage", () => {
    let s = base("vnm");
    s.player.tough = true;
    const h = hand(s, "20002", "20004", "20012");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(
      paymentSources(s, h[0].id, h[0].code).some(
        (p) => p.id === "symbiotic-bond",
      ),
    ).toBe(false);
    const result = dispatch(reload(s), {
      type: "PAY",
      ids: [h[1].id, "symbiotic-bond"],
      wildAs: "mental",
    });
    expect(result.error).toMatch(/unavailable/);
    expect(result.player.tough).toBe(true);
    expect(result.player.hp).toBe(12);
    expect(result.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    expect(result.flags.venomBondPhase).toBeUndefined();
  });
  it("generated Mental overpayment cannot give a zero-cost event its bonus", () => {
    let s = base("vnm");
    const h = hand(s, "20002", "20018");
    s = native(s, {
      type: "payRequest",
      title: "Behind Enemy Lines",
      cost: 0,
      forcePayment: true,
      piece: h[0],
      after: [{ type: "play", piece: h[0] }],
    });
    s = pay(s, [h[1]], "mental");
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.confused).toBe(false);
    conserved(s, h);
  });
  it("keeps Star-Lord's one cost interrupt separate from a teammate's saved Tendrils payment", () => {
    let s = base("vnm", "stld");
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    const starCards = hand(s, "17012", "17018");
    s = command(s, { type: "PLAY", id: starCards[0].id });
    expect(s.prompt?.title).toBe('"What could go wrong?"');
    s = choose(reload(s), "starlord-discount");
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(2);
    s = finish(pay(reload(s), [starCards[1]], "energy"));
    expect(seatView(s, "p2").flags.starlordCostRound).toBe(s.round);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p2")).toHaveLength(1);
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    const venomCards = hand(s, "20003", "20019", "20018");
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p1" });
    s = respond(s, /Grasping Tendrils/);
    expect(s.prompt?.title).toBe("Grasping Tendrils");
    expect(s.prompt?.cost).toBe(2);
    const originalPayment = JSON.parse(JSON.stringify(s.prompt));
    s = command(s, { type: "PAY", ids: venomCards.slice(1).map((p) => p.id) });
    expect(s.prompt?.title).toBe("Allocate payment resources");
    s = command(reload(s), { type: "CANCEL" });
    expect(s.prompt).toEqual(originalPayment);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p2")).toHaveLength(1);
    s = command(s, { type: "PAY", ids: venomCards.slice(1).map((p) => p.id) });
    s = finish(choose(reload(s), "physical"));
    expect(s.attack).toBeNull();
    expect(s.villain.stunned).toBe(true);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p2")).toHaveLength(1);
    expect(physical(s, "p1")).toHaveLength(40);
    expect(physical(s, "p2")).toHaveLength(40);
    conserved(s, venomCards, "p1");
    conserved(s, starCards, "p2");
  });
  it.each([false, true])(
    "lethal saved Bond cost defeats Venom before the paid card resolves (team=%s)",
    (team) => {
      let s = base("vnm", team ? "drax" : undefined);
      const originalSeat = s.activePlayerId;
      s.player.hp = 1;
      const h = hand(s, "20002", "20004");
      s = command(s, { type: "PLAY", id: h[0].id });
      s = pay(reload(s), [h[1]], "mental", ["symbiotic-bond"]);
      expect(s.players.find((p) => p.id === originalSeat)?.eliminated).toBe(
        true,
      );
      expect(s.scheme.threat).toBe(6);
      expect(s.villain.confused).toBe(false);
      expect(s.stats?.cardsPlayed).toBe(0);
      expect(s.phase).toBe(team ? "player" : "lost");
      if (team) expect(s.activePlayerId).toBe("p2");
      conserved(s, h, originalSeat);
    },
  );
});
