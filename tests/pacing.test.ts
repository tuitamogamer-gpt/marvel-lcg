import { describe, expect, it } from "vitest";
import { card, maxHP } from "../src/game/cards";
import {
  dispatch,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine";
import { upgradeSave } from "../src/game/team";
import type {
  ActionReview,
  Aspect,
  GameState,
  Pacing,
  Piece,
  Resource,
} from "../src/game/types";

const PACINGS: Pacing[] = ["guided", "brisk", "expert"];
function start(
  pacing: Pacing,
  heroes: { heroId: string; aspect: Aspect }[] = [
    { heroId: "spider_man", aspect: "justice" },
  ],
  villainId = "rhino",
  seed = 4242,
) {
  return newGame({
    heroId: heroes[0].heroId,
    aspect: heroes[0].aspect,
    heroes,
    villainId,
    seed,
    guided: true,
    pacing,
  });
}
function payIds(s: GameState) {
  const p = s.prompt!;
  const sources = paymentSources(s, p.card?.id, p.paymentTarget);
  const ids: string[] = [];
  const pool: Resource[] = [];
  for (const r of p.requirements || []) {
    let i = pool.indexOf(r);
    if (i < 0) i = pool.indexOf("wild");
    if (i >= 0) {
      pool.splice(i, 1);
      continue;
    }
    const src = sources.find(
      (x) =>
        !ids.includes(x.id) &&
        (x.resources.includes(r) || x.resources.includes("wild")),
    );
    if (!src) return null;
    ids.push(src.id);
    pool.push(...src.resources);
    i = pool.indexOf(r);
    if (i < 0) i = pool.indexOf("wild");
    pool.splice(i, 1);
  }
  let total = ids.reduce(
    (n, id) => n + sources.find((x) => x.id === id)!.resources.length,
    0,
  );
  for (const src of sources) {
    if (total >= (p.cost || 0)) break;
    if (!ids.includes(src.id)) {
      ids.push(src.id);
      total += src.resources.length;
    }
  }
  return total >= (p.cost || 0) ? ids : null;
}
/** Answers one pending prompt the way the seeded mission tests do. */
function answer(s: GameState) {
  const p = s.prompt!;
  if (p.kind === "payment") {
    const ids = payIds(s);
    if (!ids) {
      if (p.cancelable) return dispatch(s, { type: "CANCEL" });
      throw Error(`Cannot pay ${p.title}`);
    }
    return dispatch(s, {
      type: "PAY",
      ids,
      wildAs: p.requirements?.[0] || "energy",
    });
  }
  if (p.kind === "select")
    return dispatch(s, {
      type: "SELECT",
      ids: p.options.slice(0, p.min || 0).map((o) => o.id),
    });
  const opt =
    p.options.find((o) =>
      [
        "resolve",
        "allow",
        "take",
        "skip",
        "pass",
        "threat",
        "exhaust",
      ].includes(o.id),
    ) || p.options[0];
  return dispatch(s, { type: "CHOOSE", id: opt.id });
}
type Trace = { stops: ActionReview[]; prompts: string[]; proceeds: number };
/** Drives reviews and prompts until the hero can act again (or the mission ends). */
function drain(
  input: GameState,
  trace: Trace,
  until?: (s: GameState) => boolean,
) {
  let s = input;
  for (let n = 0; n < 400; n++) {
    if (["won", "lost"].includes(s.phase)) return s;
    if (s.review) {
      trace.stops.push(s.review);
      trace.proceeds++;
      s = dispatch(s, { type: "PROCEED" });
    } else if (s.prompt) {
      trace.prompts.push(s.prompt.title);
      s = answer(s);
    } else if (until ? until(s) : true) return s;
    else throw Error("The mission is idle before the requested state.");
    if (s.error) throw Error(s.error);
  }
  throw Error("Too many steps");
}
const heroKey = /^p\d+:hp$/;
function reasonFor(s: GameState, review: ActionReview, pacing: Pacing) {
  const num = (v: string | number) => Number(v) || 0;
  const reasons: string[] = [];
  for (const c of review.changes) {
    const key = c.key || "";
    if (heroKey.test(key) && num(c.after) < num(c.before))
      reasons.push("hero-damage");
    if (/^p\d+:(stunned|confused)$/.test(key) && c.after === "Active")
      reasons.push("hero-status");
    if (key === "stage") reasons.push("stage");
    if (key.endsWith(":damage") && num(c.after) > num(c.before))
      reasons.push("damage");
    if (key.endsWith(":zone") && c.after === "Left play")
      reasons.push("left-play");
    if (
      pacing === "brisk" &&
      c.kind === "threat" &&
      num(c.after) > num(c.before)
    )
      reasons.push("threat");
    if (pacing === "brisk" && key.endsWith(":zone") && c.after === "In play")
      reasons.push("entered-play");
  }
  if (pacing === "brisk" && review.cards?.some((c) => c.kind === "revealed"))
    reasons.push("revealed");
  if (
    review.cards?.some(
      (c) => c.kind === "discarded" && c.detail.includes("Hand →"),
    )
  )
    reasons.push("hand-discard");
  if (["won", "lost"].includes(s.phase)) reasons.push("ended");
  return reasons;
}
/** The deterministic policy from the seeded mission tests, for one hero turn. */
function heroTurn(input: GameState, trace: Trace) {
  let s = input;
  const cmd = (c: any) => {
    const next = dispatch(s, c);
    if (next.error) throw Error(`${c.type}: ${next.error}`);
    s = drain(
      next,
      trace,
      (g) =>
        g.phase !== "player" || g.turnPlayerId === input.turnPlayerId || true,
    );
  };
  if (s.player.form === "alter") {
    if (s.player.hp < maxHP(s) && !s.player.exhausted)
      cmd({ type: "BASIC", action: "recover" });
    if (
      (s.heroId === "captain_marvel" && !s.flags.commander) ||
      (s.heroId === "iron_man" && !s.flags.futurist)
    )
      cmd({ type: "ABILITY", id: "identity" });
    if (!s.player.flipped && s.phase === "player") cmd({ type: "FLIP" });
  }
  for (let count = 0; count < 5 && s.phase === "player"; count++) {
    const p = s.player.hand
      .filter((p) => playable(s, p) === null)
      .sort((a, b) => {
        const score = (p: Piece) =>
          card(p).type_code === "event"
            ? 3
            : card(p).type_code === "ally"
              ? 2
              : 1;
        return score(b) - score(a);
      })[0];
    if (!p) break;
    cmd({ type: "PLAY", id: p.id });
  }
  for (const p of [...s.player.inPlay].filter(
    (p) => card(p).type_code === "ally" && !p.exhausted,
  )) {
    if (s.phase !== "player") break;
    cmd({
      type: "ABILITY",
      id: p.id,
      action:
        s.scheme.threat >= 3 || s.sideSchemes.length ? "thwart" : "attack",
    });
  }
  if (s.phase === "player" && !s.player.exhausted && s.player.form === "hero")
    cmd({
      type: "BASIC",
      action:
        s.scheme.threat >= 3 || s.sideSchemes.length ? "thwart" : "attack",
    });
  if (s.phase === "player")
    cmd({
      type: "END_TURN",
      discard: s.playerCount === 1 ? s.player.hand.map((p) => p.id) : undefined,
    });
  return s;
}
function playRounds(
  pacing: Pacing,
  heroes: { heroId: string; aspect: any }[],
  villainId: string,
  rounds: number,
  seed = 90210,
) {
  let s = start(pacing, heroes, villainId, seed);
  const trace: Trace = { stops: [], prompts: [], proceeds: 0 };
  for (const _ of heroes) {
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    s = drain(s, trace, (g) => g.phase !== "mulligan" || !g.review);
  }
  s = drain(s, trace);
  let guard = 0;
  while (
    s.round <= rounds &&
    !["won", "lost"].includes(s.phase) &&
    guard++ < 60
  ) {
    s = heroTurn(s, trace);
    s = drain(s, trace);
  }
  return { s, trace, roundsPlayed: Math.min(rounds, s.round) };
}

describe("tempo: fewer acknowledgements without hiding consequences", () => {
  it("a solo mission reaches the first hero action without an acknowledgement in every tempo", () => {
    for (const pacing of PACINGS) {
      const s = dispatch(start(pacing), { type: "MULLIGAN", ids: [] });
      expect(s.error, pacing).toBeUndefined();
      expect(s.review, pacing).toBeNull();
      expect(s.prompt, pacing).toBeNull();
      expect(s.phase).toBe("player");
      expect(s.turnPlayerId).toBe("p1");
      expect(s.pacing).toBe(pacing);
    }
  });
  it("hands the turn to the next hero without an empty stop", () => {
    let s = start("guided", [
      { heroId: "spider_man", aspect: "justice" },
      { heroId: "she_hulk", aspect: "aggression" },
    ]);
    const trace: Trace = { stops: [], prompts: [], proceeds: 0 };
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    s = drain(s, trace, (g) => g.phase !== "mulligan" || !g.review);
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    s = drain(s, trace);
    expect(s.turnPlayerId).toBe("p1");
    s = dispatch(s, { type: "END_TURN" });
    expect(s.error).toBeUndefined();
    expect(s.review).toBeNull();
    expect(s.prompt).toBeNull();
    expect(s.turnPlayerId).toBe("p2");
    expect(s.activePlayerId).toBe("p2");
    expect(s.log.at(-1)?.text).toContain("takes their turn");
  });
  it("brisk and expert need fewer acknowledgements than guided, and every pause has a reason", () => {
    const counts: Record<Pacing, number> = { guided: 0, brisk: 0, expert: 0 };
    for (const pacing of PACINGS) {
      const { s, trace } = playRounds(
        pacing,
        [{ heroId: "spider_man", aspect: "justice" }],
        "rhino",
        2,
      );
      counts[pacing] = trace.proceeds;
      if (pacing !== "guided")
        for (const stop of trace.stops)
          expect(
            reasonFor(s, stop, pacing),
            `${pacing}: ${stop.title}\n${JSON.stringify(stop.changes)}`,
          ).not.toEqual([]);
      expect(
        trace.prompts.some((t) => t.includes("attacks")),
        pacing,
      ).toBe(true);
    }
    expect(counts.brisk).toBeLessThan(counts.guided);
    expect(counts.expert).toBeLessThanOrEqual(counts.brisk);
  });
  it("keeps brisk and expert within a click budget per round", () => {
    for (const [heroes, villainId, brisk, expert] of [
      [[{ heroId: "spider_man", aspect: "justice" }], "rhino", 9, 5],
      [[{ heroId: "captain_marvel", aspect: "leadership" }], "klaw", 10, 6],
      [
        [
          { heroId: "she_hulk", aspect: "aggression" },
          { heroId: "captain_marvel", aspect: "leadership" },
          { heroId: "spider_man", aspect: "justice" },
        ],
        "rhino",
        20,
        10,
      ],
    ] as [{ heroId: string; aspect: Aspect }[], string, number, number][]) {
      for (const [pacing, budget] of [
        ["brisk", brisk],
        ["expert", expert],
      ] as const) {
        const { trace, roundsPlayed } = playRounds(
          pacing,
          [...heroes],
          villainId,
          3,
        );
        expect(
          trace.proceeds / Math.max(1, roundsPlayed),
          `${pacing} ${villainId} ${heroes.length} heroes`,
        ).toBeLessThanOrEqual(budget);
      }
    }
  });
  it("brisk pauses to read a revealed encounter; expert reads it from the timeline or log", () => {
    const brisk = playRounds(
      "brisk",
      [{ heroId: "spider_man", aspect: "justice" }],
      "rhino",
      1,
      777,
    );
    expect(
      brisk.trace.stops.some((r) =>
        r.cards?.some((c) => c.kind === "revealed"),
      ),
    ).toBe(true);
    const expert = playRounds(
      "expert",
      [{ heroId: "spider_man", aspect: "justice" }],
      "rhino",
      1,
      777,
    );
    for (const stop of expert.trace.stops)
      expect(reasonFor(expert.s, stop, "expert"), stop.title).not.toEqual([]);
    expect(expert.s.log.some((l) => l.text.includes("Encounter:"))).toBe(true);
  });
  it("the timeline keeps the hero's own resolved actions in the faster tempos", () => {
    let s = dispatch(start("brisk"), { type: "MULLIGAN", ids: [] });
    s = dispatch(s, { type: "FLIP" });
    expect(s.review).toBeNull();
    s = dispatch(s, { type: "BASIC", action: "attack" });
    expect(s.error).toBeUndefined();
    expect(s.review).toBeNull();
    expect(s.prompt).toBeNull();
    expect(s.villain.hp).toBe(card(s.villain).health! - 2);
    const entry = s.timeline?.at(-1);
    expect(entry?.title).toBe("Resolve damage");
    expect(
      entry?.changes.some(
        (c) => c.key === "villain" && c.after === s.villain.hp,
      ),
    ).toBe(true);
    let g = dispatch(start("guided"), { type: "MULLIGAN", ids: [] });
    g = dispatch(g, { type: "FLIP" });
    g = dispatch(g, { type: "BASIC", action: "attack" });
    expect(g.review?.title).toBe("Resolve damage");
    expect(g.timeline).toEqual([]);
  });
  it("changes tempo mid-mission, survives a reload, and defaults old saves to guided", () => {
    let s = dispatch(start("guided"), { type: "MULLIGAN", ids: [] });
    s = dispatch(s, { type: "SET_PACING", pacing: "brisk" });
    expect(s.error).toBeUndefined();
    expect(s.pacing).toBe("brisk");
    const reloaded = upgradeSave(JSON.parse(JSON.stringify(s)));
    expect(reloaded.pacing).toBe("brisk");
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.pacing;
    delete legacy.timeline;
    const upgraded = upgradeSave(legacy);
    expect(upgraded.pacing).toBe("guided");
    expect(upgraded.timeline).toEqual([]);
    const bad = dispatch(s, { type: "SET_PACING", pacing: "turbo" as Pacing });
    expect(bad.error).toBe("Unknown tempo.");
    s = dispatch(s, { type: "FLIP" });
    s = dispatch(s, { type: "BASIC", action: "attack" });
    expect(s.review).toBeNull();
    expect(s.timeline?.at(-1)?.title).toBe("Resolve damage");
  });
});
