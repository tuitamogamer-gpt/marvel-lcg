import { describe, expect, it } from "vitest";
import { card, heroStats, maxHP } from "../src/game/cards.js";
import { cardCost, nativeHeroAbilityOptions } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import {
  base,
  command,
  conserved,
  finish,
  growth,
  hand,
  native,
  owned,
  paidPlay,
  play,
  put,
  side,
} from "./gmw-test-helpers.js";

describe("Galaxy's Most Wanted shared native adapters", () => {
  it("Cybernetic Skeleton preserves existing wounds when entering and when Tinkering discards it", () => {
    let s = base("rocket");
    s.player.hp = 4;
    const cards = hand(s, "16035", "16051");
    s = finish(play(s, cards[0], [cards[1]]));
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(7);
    expect(heroStats(s).attack).toBe(2);
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: "identity", action: "tinkering" });
    s = finish(command(s, { type: "SELECT", ids: [cards[0].id] }));
    expect(maxHP(s)).toBe(9);
    expect(s.player.hp).toBe(4);
    conserved(s, cards);
  });
  it("a blank Cybernetic Skeleton neither adds HP on entry nor removes HP when discarded", () => {
    let s = base("rocket");
    s.player.hp = 4;
    side(s, "12026", 3);
    const cards = hand(s, "16035", "16051");
    s = finish(play(s, cards[0], [cards[1]]));
    expect(maxHP(s)).toBe(9);
    expect(s.player.hp).toBe(4);
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: "identity", action: "tinkering" });
    s = finish(command(s, { type: "SELECT", ids: [cards[0].id] }));
    expect(s.player.hp).toBe(4);
    conserved(s, cards);
  });
  it("Tech Theft entering and leaving changes Rocket's current HP by the same maximum-HP delta", () => {
    let s = base("rocket");
    put(s, "16035");
    s.player.hp = 7;
    const blank = owned(s, "12026");
    s = finish(native(s, { type: "reveal", piece: blank, skip: true }));
    expect(maxHP(s)).toBe(9);
    expect(s.player.hp).toBe(4);
    s = finish(native(s, { type: "discardPiece", id: blank.id }));
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(7);
  });
  it("Deft Focus is consumed by an actual zero-cost Superpower play", () => {
    let s = base("groot");
    const focus = put(s, "16024");
    s = command(s, { type: "ABILITY", id: focus.id, action: "deft-focus" });
    expect(s.flags.gmwDeftFocus).toBe(1);
    const cards = hand(s, "16002");
    expect(cardCost(s, card(cards[0]))).toBe(0);
    s = finish(play(s, cards[0]));
    expect(growth(s)).toBe(2);
    expect(s.flags.gmwDeftFocus).toBeUndefined();
    conserved(s, cards);
  });
  it("Deft Focus survives Fighting Fit and reduces Root Stomp's actual payment", () => {
    let s = base("groot");
    const focus = put(s, "16024");
    s = command(s, { type: "ABILITY", id: focus.id, action: "deft-focus" });
    s = finish(paidPlay(s, "16014", "16022"));
    expect(s.flags.gmwDeftFocus).toBe(1);
    const superpower = hand(s, "16005", "16003");
    expect(cardCost(s, card(superpower[0]))).toBe(1);
    s = command(s, { type: "PLAY", id: superpower[0].id });
    expect(s.prompt).toMatchObject({ kind: "payment", cost: 1 });
    s = command(s, { type: "PAY", ids: [superpower[1].id] });
    s = finish(s);
    expect(s.villain.hp).toBe(40);
    expect(s.flags.gmwDeftFocus).toBeUndefined();
  });
  it("ending another player's turn expires every controller's Deft Focus discount", () => {
    let s = base("rocket", "groot");
    const focus = put(s, "16024", "p2");
    s = command(s, {
      type: "ABILITY",
      id: focus.id,
      action: "deft-focus",
      playerId: "p2",
    });
    expect(seatView(s, "p2").flags.gmwDeftFocus).toBe(1);
    activateSeat(s, "p1");
    s = command(s, { type: "END_TURN" });
    expect(seatView(s, "p2").flags.gmwDeftFocus).toBeUndefined();
    expect(s.turnPlayerId).toBe("p2");
  });
  it("Looking for Trouble pays the encounter-discard/minion cost before Confused replaces the thwart", () => {
    let s = base("rocket");
    s.player.confused = true;
    const skipped = owned(s, "01104"),
      found = owned(s, "01103"),
      after = owned(s, "01104");
    s.encounter.deck = [skipped, found, after];
    s.encounter.discard = [];
    const cards = hand(s, "16043");
    s = finish(play(s, cards[0]));
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(6);
    expect(s.minions.find((p) => p.id === found.id)?.engagedWith).toBe("p1");
    expect(s.encounter.discard.some((p) => p.id === skipped.id)).toBe(true);
    expect(s.encounter.deck.map((p) => p.id)).toEqual([after.id]);
    expect(s.player.hp).toBe(9); // Put into play does not resolve Hydra Bomber's When Revealed.
    conserved(s, cards);
  });
  it("native round reset retains Groot's actual growth while expiring Rocket's phase and turn effects", () => {
    let s = base("groot", "rocket");
    growth(s, 7);
    const rocket = seatView(s, "p2");
    rocket.flags.rocketPlanPhase = `${s.round}:${s.phase}`;
    rocket.flags.rocketPlanAmount = 2;
    rocket.flags.rocketSchadenTurn = `${s.round}:${s.phase}:p2`;
    rocket.flags.rocketSchadenAmount = 1;
    rocket.flags.rocketTinkerRound = s.round;
    s = finish(native(s, { type: "newRound" }));
    expect(s.round).toBe(2);
    expect(growth(s, undefined, "p1")).toBe(7);
    const flags = seatView(s, "p2").flags;
    for (const key of [
      "rocketPlanPhase",
      "rocketPlanAmount",
      "rocketSchadenTurn",
      "rocketSchadenAmount",
      "rocketTinkerRound",
    ])
      expect(flags[key]).toBeUndefined();
  });
  it("native ability surfaces the printed action labels for both identities and charged upgrades", () => {
    const s = base("rocket");
    const battery = put(s, "16034"),
      pistol = put(s, "16038");
    battery.counters = 2;
    pistol.counters = 3;
    expect(nativeHeroAbilityOptions(s, battery.id).map((o) => o.id)).toEqual([
      "battery",
    ]);
    expect(nativeHeroAbilityOptions(s, pistol.id).map((o) => o.id)).toEqual([
      "weapon",
    ]);
    s.player.form = "alter";
    expect(nativeHeroAbilityOptions(s).map((o) => o.id)).toEqual(["tinkering"]);
  });
});
