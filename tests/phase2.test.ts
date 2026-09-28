import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards";
import { dispatch, newGame, paymentSources } from "../src/game/engine";
import { suggestPayment, paymentStatus } from "../src/game/payment";
import type { PaymentSource } from "../src/game/payment";
import { dailySeedText, parseSeed } from "../src/game/seed";
import { upgradeSave } from "../src/game/team";
import type { GameState } from "../src/game/types";

function base(pacing: "guided" | "brisk" = "brisk") {
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    seed: 31337,
    guided: true,
    pacing,
  });
  s = dispatch(s, { type: "MULLIGAN", ids: [] });
  return s;
}
const src = (
  id: string,
  resources: PaymentSource["resources"],
  kind: PaymentSource["kind"] = "card",
): PaymentSource => ({
  id,
  name: id,
  code: "01044",
  resources,
  description: "",
  kind,
});

describe("payment suggestion", () => {
  it("spends the lowest-ranked sources first and never overpays when an exact total exists", () => {
    const sources = [
      src("double", ["energy", "energy"]),
      src("cheap", ["physical"]),
      src("precious", ["mental"]),
    ];
    const rank = (x: PaymentSource) =>
      x.id === "precious" ? 9 : x.id === "double" ? 5 : 1;
    expect(suggestPayment(sources, 1, [], rank)).toEqual(["cheap"]);
    expect(suggestPayment(sources, 2, [], rank)).toEqual(["double"]);
    const three = suggestPayment(sources, 3, [], rank)!;
    expect(paymentStatus(sources, three, 3).ready).toBe(true);
    expect(three).not.toContain("precious");
  });
  it("satisfies typed requirements before filling the total", () => {
    const sources = [
      src("a", ["physical"]),
      src("b", ["physical"]),
      src("m", ["mental"]),
    ];
    const ids = suggestPayment(sources, 2, ["mental"], (x) =>
      x.id === "m" ? 9 : 1,
    )!;
    expect(ids).toContain("m");
    expect(paymentStatus(sources, ids, 2, ["mental"]).ready).toBe(true);
    expect(suggestPayment(sources, 2, ["energy"])).toBeNull();
    expect(suggestPayment(sources, 4)).toBeNull();
  });
  it("proposes a real payment from an actual hand", () => {
    let s = base();
    s = dispatch(s, { type: "FLIP" });
    const playable = s.player.hand.find((p) => (card(p).cost || 0) >= 2)!;
    s = dispatch(s, { type: "PLAY", id: playable.id });
    expect(s.prompt?.kind).toBe("payment");
    const sources = paymentSources(
      s,
      s.prompt!.card?.id,
      s.prompt!.paymentTarget,
    );
    const ids = suggestPayment(
      sources,
      s.prompt!.cost || 0,
      s.prompt!.requirements,
    );
    expect(ids).not.toBeNull();
    const paid = dispatch(s, { type: "PAY", ids: ids!, wildAs: "energy" });
    expect(paid.error).toBeUndefined();
    expect(paid.stats?.cardsPlayed).toBe(1);
  });
});

describe("undo boundary and mission statistics", () => {
  it("a basic attack reveals nothing, while drawing, shuffling and encounters do", () => {
    let s = base();
    s = dispatch(s, { type: "FLIP" });
    const before = s.hiddenInfo || 0;
    const attacked = dispatch(s, { type: "BASIC", action: "attack" });
    expect(attacked.hiddenInfo).toBe(before);
    expect(attacked.stats?.damageDealt).toBe(2);
    expect(attacked.villain.hp).toBe(s.villain.hp - 2);
    const ended = dispatch(attacked, {
      type: "END_TURN",
      // Discarding the whole hand forces a refill draw, which reveals hidden cards.
      discard: attacked.player.hand.map((p) => p.id),
    });
    expect(ended.error).toBeUndefined();
    expect(ended.hiddenInfo).toBeGreaterThan(before);
  });
  it("counts damage, threat and defeats on the right side", () => {
    let s = base();
    s.villain.hp = 30;
    s = dispatch(s, { type: "FLIP" });
    s.scheme.threat = 4;
    const thwarted = dispatch(s, { type: "BASIC", action: "thwart" });
    expect(thwarted.stats?.threatRemoved).toBe(1);
    expect(thwarted.scheme.threat).toBe(3);
    let t = base();
    t = dispatch(t, { type: "FLIP" });
    for (
      let n = 0;
      n < 40 && t.phase === "player" && !t.prompt && !t.review;
      n++
    ) {
      t = dispatch(t, {
        type: "END_TURN",
        discard: t.player.hand.map((p) => p.id),
      });
      break;
    }
    for (let n = 0; n < 200 && t.round === 1; n++) {
      if (t.review) t = dispatch(t, { type: "PROCEED" });
      else if (t.prompt) {
        const opt =
          t.prompt.options.find((o) =>
            ["allow", "none", "take", "pass", "skip"].includes(o.id),
          ) || t.prompt.options[0];
        t =
          t.prompt.kind === "select"
            ? dispatch(t, {
                type: "SELECT",
                ids: t.prompt.options
                  .slice(0, t.prompt.min || 0)
                  .map((o) => o.id),
              })
            : t.prompt.kind === "payment"
              ? dispatch(t, { type: "CANCEL" })
              : dispatch(t, { type: "CHOOSE", id: opt.id });
      } else break;
      expect(t.error).toBeUndefined();
    }
    expect(t.stats?.threatPlaced).toBeGreaterThanOrEqual(1);
    expect(t.stats!.damageTaken + t.stats!.threatPlaced).toBeGreaterThan(0);
  });
  it("keeps the starting seed and statistics through a reload and defaults old saves", () => {
    const s = base();
    expect(s.startSeed).toBe(31337);
    expect(s.seed).not.toBe(31337);
    const reloaded = upgradeSave(JSON.parse(JSON.stringify(s)) as GameState);
    expect(reloaded.startSeed).toBe(31337);
    expect(reloaded.stats).toEqual(s.stats);
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.stats;
    delete legacy.hiddenInfo;
    delete legacy.heroic;
    const upgraded = upgradeSave(legacy);
    expect(upgraded.stats?.cardsPlayed).toBe(0);
    expect(upgraded.hiddenInfo).toBe(0);
    expect(upgraded.heroic).toBe(0);
  });
});

describe("heroic mode and seeds", () => {
  it("deals extra encounter cards per hero in heroic mode", () => {
    const count = (heroic: number) => {
      let s = newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "rhino",
        seed: 999,
        heroic,
      });
      s = dispatch(s, { type: "MULLIGAN", ids: [] });
      s.villain.hp = 99;
      s.player.hp = 99;
      s = dispatch(s, { type: "END_TURN", discard: [] });
      for (let n = 0; n < 200 && s.round === 1; n++) {
        if (s.prompt) {
          const p = s.prompt;
          s =
            p.kind === "select"
              ? dispatch(s, {
                  type: "SELECT",
                  ids: p.options.slice(0, p.min || 0).map((o) => o.id),
                })
              : p.kind === "payment"
                ? dispatch(s, { type: "CANCEL" })
                : dispatch(s, {
                    type: "CHOOSE",
                    id: (
                      p.options.find((o) =>
                        ["allow", "none", "take", "pass"].includes(o.id),
                      ) || p.options[0]
                    ).id,
                  });
        } else break;
      }
      return {
        dealt: s.log.find((l) => l.text.startsWith("Deal "))?.text,
        revealed: s.log.filter((l) => l.text.startsWith("Encounter:")).length,
      };
    };
    expect(count(0).dealt).toMatch(/^Deal 1 encounter card to each hero/);
    expect(count(0).revealed).toBeGreaterThanOrEqual(1);
    expect(count(2).dealt).toMatch(
      /^Deal 3 encounter cards to each hero \(Heroic 2\)/,
    );
    expect(count(2).revealed).toBeGreaterThanOrEqual(3);
    expect(() =>
      newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "rhino",
        heroic: 4,
      }),
    ).toThrow();
  });
  it("turns seed text into stable numbers", () => {
    expect(parseSeed("")).toBeUndefined();
    expect(parseSeed("  ")).toBeUndefined();
    expect(parseSeed("12345")).toBe(12345);
    expect(parseSeed("daily-2026-09-29")).toBe(parseSeed("daily-2026-09-29"));
    expect(parseSeed("daily-2026-09-29")).not.toBe(
      parseSeed("daily-2026-09-30"),
    );
    expect(parseSeed("Rhino")).toBeGreaterThan(0);
    expect(dailySeedText(new Date(2026, 8, 29))).toBe("daily-2026-09-29");
  });
});
