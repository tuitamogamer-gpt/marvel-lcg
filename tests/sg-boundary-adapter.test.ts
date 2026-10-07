import { describe, expect, it } from "vitest";
import { heroStats } from "../src/game/cards.js";
import { dispatch, paymentSources } from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import {
  base,
  command,
  conserved,
  finish,
  hand,
  native,
  owned,
  play,
  put,
  reload,
} from "./sg-test-helpers.js";

describe("native Gamora and Star-Lord resource adapters", () => {
  it("spends each actual Enhanced Reflexes counter and discards its physical upgrade at zero", () => {
    let s = base("gam");
    const [upgrade, energy] = hand(s, "18032", "18021");
    s = finish(play(s, upgrade, [energy]));
    expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.counters).toBe(3);
    for (let i = 0; i < 3; i++) {
      if (i) s = native(s, { type: "ready", target: upgrade.id });
      const event = hand(s, "18015")[0];
      s = command(s, { type: "PLAY", id: event.id });
      expect(s.prompt?.kind).toBe("payment");
      expect(
        paymentSources(s, event.id, event.code).find((p) => p.id === upgrade.id)
          ?.resources,
      ).toEqual(["energy"]);
      s = finish(command(s, { type: "PAY", ids: [upgrade.id] }));
      expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.counters).toBe(
        i < 2 ? 2 - i : undefined,
      );
      expect(s.player.inPlay.find((p) => p.id === upgrade.id)?.exhausted).toBe(
        i < 2 ? true : undefined,
      );
      conserved(s, [upgrade, event]);
    }
    expect(s.player.discard.filter((p) => p.id === upgrade.id)).toHaveLength(1);
  });

  it("Enhanced Awareness pays a native card cost and removes its exact source when the last counter is spent", () => {
    let s = base("stld");
    s.flags.starlordCostRound = s.round;
    const source = put(s, "17031");
    source.counters = 1;
    const event = hand(s, "17010")[0];
    s = command(s, { type: "PLAY", id: event.id });
    expect(
      paymentSources(s, event.id, event.code).find((p) => p.id === source.id)
        ?.resources,
    ).toEqual(["mental"]);
    s = finish(command(s, { type: "PAY", ids: [source.id] }));
    expect(s.player.inPlay.some((p) => p.id === source.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === source.id)).toHaveLength(1);
    expect(s.player.inPlay.some((p) => p.id === event.id)).toBe(true);
    conserved(s, [source, event]);
  });

  it.each(["18032", "17031"])(
    "Hero Resource %s cannot generate in alter-ego or without a counter",
    (code) => {
      const s = base("gam");
      const source = put(s, code);
      source.counters = 1;
      s.player.form = "alter";
      expect(
        paymentSources(s, undefined, "18006").some((p) => p.id === source.id),
      ).toBe(false);
      s.player.form = "hero";
      source.counters = 0;
      expect(
        paymentSources(s, undefined, "18006").some((p) => p.id === source.id),
      ).toBe(false);
    },
  );

  it("a stale exhausted Keen Instincts payment is rejected without discarding the event", () => {
    let s = base("gam");
    const first = put(s, "18009"),
      second = put(s, "18009");
    const event = hand(s, "18006")[0];
    s = command(s, { type: "PLAY", id: event.id });
    s.player.inPlay.find((p) => p.id === first.id)!.exhausted = true;
    const invalid = dispatch(reload(s), {
      type: "PAY",
      ids: [first.id, second.id],
    });
    expect(invalid.error).toContain("unavailable");
    expect(invalid.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(
      invalid.player.inPlay.find((p) => p.id === second.id)?.exhausted,
    ).toBe(false);
  });
});

describe("Blaze of Glory crosses actual phase boundaries once", () => {
  it("deals one end-of-player-phase damage to every current Guardian before villain activations", () => {
    let s = base("stld", "gam");
    s.flags.starlordCostRound = s.round;
    const acquiredGuardian = put(s, "01066"),
      printedGuardian = put(s, "18019", "p2");
    const [blaze, energy] = hand(s, "17015", "17018");
    s = finish(play(s, blaze, [energy]));
    expect(heroStats(s).attack).toBe(4);
    expect(heroStats(seatView(s, "p2")).attack).toBe(4);
    s = native(s, { type: "beginVillain" });
    expect(s.phase).toBe("villain");
    expect(s.player.hp).toBe(9);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(
      s.player.inPlay.find((p) => p.id === acquiredGuardian.id)?.damage,
    ).toBe(1);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === printedGuardian.id)
        ?.damage,
    ).toBe(1);
    expect(heroStats(s).attack).toBe(2);
    expect(heroStats(seatView(s, "p2")).attack).toBe(2);
    expect(s.flags.starPackBlazePhase).toBeUndefined();
  });

  it("end-of-villain-phase damage completes before advancing the round and is not repeated", () => {
    let s = base("stld", "gam");
    s.phase = "villain";
    s.flags.starPackBlazePhase = "villain";
    const ally = put(s, "01066");
    s = native(s, { type: "newRound" });
    expect(s.phase).toBe("player");
    expect(s.round).toBe(2);
    expect(seatView(s, "p1").player.hp).toBe(9);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === ally.id)?.damage,
    ).toBe(1);
    s.phase = "villain";
    s = native(s, { type: "newRound" });
    expect(seatView(s, "p1").player.hp).toBe(9);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === ally.id)?.damage,
    ).toBe(1);
  });

  it("Blaze's damage uses current Guardian traits after Star-Lord changes to alter-ego", () => {
    let s = base("stld", "gam");
    const acquired = put(s, "01066"),
      printed = put(s, "17020");
    s.flags.starPackBlazePhase = "player";
    s.player.form = "alter";
    s.scheme.threat = 0;
    s = native(s, { type: "beginVillain" });
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === acquired.id)?.damage,
    ).toBe(0);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === printed.id)?.damage,
    ).toBe(1);
    expect(seatView(s, "p2").player.hp).toBe(9);
  });

  it("a saved damage interrupt resumes the old phase before completing its boundary", () => {
    let s = base("gam", "stld");
    s.flags.starPackBlazePhase = "player";
    put(s, "15008");
    s = native(s, { type: "beginVillain" });
    expect(s.phase).toBe("player");
    expect(s.prompt?.options.some((o) => /Magic Shield/.test(o.label))).toBe(
      true,
    );
    // JSON hydration occurs on every choice. Declining allows exactly one point
    // for each Guardian before the normal villain phase defense prompt.
    for (let i = 0; s.phase === "player" && s.prompt && i < 10; i++) {
      const pass = s.prompt.options.find((o) =>
        /^(allow|continue|pass)$/.test(o.id),
      )!;
      expect(pass).toBeDefined();
      s = command(s, { type: "CHOOSE", id: pass.id });
    }
    expect(s.phase).toBe("villain");
    expect(seatView(s, "p1").player.hp).toBe(9);
    expect(seatView(s, "p2").player.hp).toBe(9);
  });
});
