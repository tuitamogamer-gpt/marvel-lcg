import { describe, expect, it, vi } from "vitest";
import { newGame, makePiece } from "../src/game/engine";
import { activateSeat, seatView } from "../src/game/team";
import { card } from "../src/game/cards";
import type { Card, Effect, GameState, Piece } from "../src/game/types";
import {
  activeRevealWindow,
  beginRevealWindow,
  resolveRevealWindowEffect,
  revealWindowGainSurge,
  type RevealWindowEnginePorts,
} from "../src/game/reveal-window";

function fixture() {
  const s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    pacing: "expert",
    seed: 737,
  });
  s.phase = "player";
  s.playerCount = 2;
  s.players[0].player = s.player;
  s.players.push({
    ...s.players[0],
    id: "p2",
    player: structuredClone(s.player),
    flags: {},
    eliminated: false,
  });
  s.firstPlayerId = "p2";
  s.queue = [];
  s.prompt = null;
  s.encounter = { deck: [], discard: [], dealt: [], acceleration: 0 };
  s.scheme.threat = 0;
  const trace: string[] = [];
  const ports: RevealWindowEnginePorts = {
    queue: (state, ...effects) => state.queue.unshift(...effects),
    choose: (state, title, text, options) => {
      state.prompt = { kind: "choice", title, text, options };
    },
    resolveText: vi.fn((state, piece, windowId) => {
      trace.push(`text:${state.activePlayerId}`);
      if (piece.code === "01191") state.player.exhausted = true;
      if (piece.code === "02039") {
        expect(revealWindowGainSurge(state, windowId)).toBe(true);
      }
    }),
    dealEncounter: vi.fn((state, id) => {
      trace.push(`surge:${id}`);
      const p = state.encounter.deck.shift();
      if (p) {
        p.dealtTo = id;
        state.encounter.dealt.push(p);
      }
    }),
    finish: vi.fn((_state, piece) => {
      trace.push(`finish:${piece.id}`);
    }),
  };
  const run = (e: Effect) => {
    if (e.actorId) activateSeat(s, e.actorId);
    if (resolveRevealWindowEffect(s, e, ports)) return;
    if (e.type === "threat") {
      trace.push(`incite:${s.activePlayerId}`);
      s.scheme.threat += e.amount;
    } else throw Error(`Unexpected ${e.type}`);
  };
  const drain = () => {
    for (let n = 0; s.queue.length && !s.prompt && n < 100; n++)
      run(s.queue.shift()!);
  };
  const effects = (list: Effect[]) => {
    ports.queue(s, ...list);
    drain();
  };
  const choose = (id: string) => {
    const option = s.prompt?.options.find((o) => o.id === id);
    expect(option, s.prompt?.title).toBeDefined();
    s.prompt = null;
    effects(option!.effects);
  };
  const start = (code: string, copies = 1, definition: Card = card(code)) => {
    const piece = makePiece(s, code);
    effects(beginRevealWindow(s, piece, definition, "p1", copies));
    return piece;
  };
  s.encounter.deck = Array.from({ length: 8 }, () => makePiece(s, "02013"));
  return { s, ports, trace, run, drain, effects, choose, start };
}
describe("current-RRG serializable When Revealed window", () => {
  it("Exhaustion exposes printed Surge and text as first-player choice, preserving original revealer", () => {
    const f = fixture();
    const p = f.start("01191");
    expect(f.s.activePlayerId).toBe("p2");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["text", "surge"]);
    f.choose("surge");
    expect(f.trace).toEqual(["surge:p1", "text:p1", `finish:${p.id}`]);
    expect(seatView(f.s, "p1").player.exhausted).toBe(true);
    expect(f.s.encounter.dealt[0].dealtTo).toBe("p1");
    expect(activeRevealWindow(f.s, p.id)).toBeUndefined();
  });
  it("the other order resolves text before Surge without another physical entry", () => {
    const f = fixture();
    const p = f.start("01191");
    f.choose("text");
    expect(f.trace).toEqual(["text:p1", "surge:p1", `finish:${p.id}`]);
    expect(f.ports.finish).toHaveBeenCalledTimes(1);
  });
  it("Media copies repeat each selected group without repeating its entry or cleanup", () => {
    const f = fixture();
    f.start("01191", 3);
    f.choose("text");
    expect(f.ports.resolveText).toHaveBeenCalledTimes(3);
    expect(f.ports.dealEncounter).toHaveBeenCalledTimes(3);
    expect(f.ports.finish).toHaveBeenCalledTimes(1);
    expect(f.s.encounter.dealt).toHaveLength(3);
  });
  it("Incite and original text are independent same-window groups", () => {
    const f = fixture();
    f.start("04121");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["text", "incite"]);
    f.choose("incite");
    expect(f.trace.slice(0, 2)).toEqual(["incite:p1", "text:p1"]);
    expect(f.s.scheme.threat).toBe(1);
  });
  it("all three groups share one ordering prompt and selected effects are atomic", () => {
    const f = fixture();
    const c = {
      ...card("04121"),
      text: "Surge. Incite 2.\n<b>When Revealed</b>: Place 1 test counter on the main scheme.",
    };
    f.start("04121", 2, c);
    f.choose("surge");
    expect(f.s.prompt?.options.map((o) => o.id)).toEqual(["text", "incite"]);
    f.choose("incite");
    expect(f.trace.slice(0, 5)).toEqual([
      "surge:p1",
      "surge:p1",
      "incite:p1",
      "incite:p1",
      "text:p1",
    ]);
    expect(f.s.scheme.threat).toBe(4);
  });
  it("gaining conditional Surge during every Media text copy creates one keyword group, repeated by Media", () => {
    const f = fixture();
    const p = f.start("02039", 2);
    expect(f.ports.resolveText).toHaveBeenCalledTimes(2);
    expect(f.ports.dealEncounter).toHaveBeenCalledTimes(2);
    expect(f.s.encounter.dealt).toHaveLength(2);
    expect(f.trace).toEqual([
      "text:p1",
      "text:p1",
      "surge:p1",
      "surge:p1",
      `finish:${p.id}`,
    ]);
  });
  it("gaining Surge cannot stack another unnumbered instance if printed Surge already resolved", () => {
    const f = fixture();
    const c = {
      ...card("02039"),
      text: "Surge.\n<b>When Revealed</b>: This card gains surge.",
    };
    f.start("02039", 2, c);
    f.choose("surge");
    expect(f.ports.resolveText).toHaveBeenCalledTimes(2);
    expect(f.ports.dealEncounter).toHaveBeenCalledTimes(2);
    expect(f.ports.finish).toHaveBeenCalledTimes(1);
  });
  it("duplicate pending gain and printed gain also remain one Surge group", () => {
    const f = fixture();
    const c = {
      ...card("02039"),
      text: "Surge.\n<b>When Revealed</b>: This card gains surge.",
    };
    f.start("02039", 2, c);
    f.choose("text");
    expect(f.ports.dealEncounter).toHaveBeenCalledTimes(2);
  });
  it("queued group selection survives JSON hydration without capturing stale actor references", () => {
    const f = fixture();
    const p = f.start("01191");
    const state = JSON.parse(JSON.stringify(f.s));
    Object.assign(f.s, state);
    f.choose("surge");
    expect(f.ports.resolveText).toHaveBeenCalledTimes(1);
    expect(f.s.encounter.dealt[0].dealtTo).toBe("p1");
    expect(activeRevealWindow(f.s, p.id)).toBeUndefined();
  });
  it("independent nested physical windows cannot gain each other's Surge", () => {
    const f = fixture();
    const p = makePiece(f.s, "01191"),
      other = makePiece(f.s, "02039");
    beginRevealWindow(f.s, p, card(p), "p1");
    beginRevealWindow(f.s, other, card(other), "p2");
    expect(revealWindowGainSurge(f.s, other.id)).toBe(true);
    expect(activeRevealWindow(f.s, p.id)?.pending).toEqual(["text", "surge"]);
    expect(activeRevealWindow(f.s, other.id)?.pending).toEqual([
      "text",
      "surge",
    ]);
    expect(revealWindowGainSurge(f.s, "absent")).toBe(false);
  });
  it("non-WhenRevealed attachment text and reference/reminder keywords do not get repeated", () => {
    const f = fixture();
    f.start("02049", 2);
    expect(f.ports.resolveText).not.toHaveBeenCalled();
    expect(f.ports.dealEncounter).not.toHaveBeenCalled();
    expect(f.ports.finish).toHaveBeenCalledTimes(1);
  });
  it("stale completed effects cannot duplicate cleanup, while malformed active ability choices fail", () => {
    const f = fixture();
    const p = f.start("01191");
    expect(() =>
      f.run({
        type: "reveal-window:execute",
        windowId: p.id,
        abilityId: "fabricated",
      }),
    ).toThrow(/no longer pending/);
    f.choose("surge");
    f.run({ type: "reveal-window:step", windowId: p.id });
    expect(f.ports.finish).toHaveBeenCalledTimes(1);
    expect(resolveRevealWindowEffect(f.s, { type: "native" }, f.ports)).toBe(
      false,
    );
  });
});
