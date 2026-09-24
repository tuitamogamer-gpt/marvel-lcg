import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame, summarize } from "../src/game/engine";
import { mergeReviews } from "../src/game/review";
import type { Command, GameState } from "../src/game/types";

function send(s: GameState, command: Command) {
  const result = dispatch(s, command);
  expect(result.error).toBeUndefined();
  return result;
}
function game() {
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "rhino",
    seed: 34,
  });
  s = send(s, { type: "MULLIGAN", ids: [] });
  s.guided = true;
  s.player.form = "hero";
  s.player.hand = [];
  return s;
}
function triggerAttack(s: GameState) {
  s.prompt = {
    kind: "choice",
    title: "Attack fixture",
    text: "",
    options: [
      {
        id: "start",
        label: "Start",
        effects: [{ type: "enemyAttack", id: "villain" }],
      },
    ],
  };
  return send(s, { type: "CHOOSE", id: "start" });
}

describe("one confirmation per meaningful action", () => {
  it("opens target selection immediately and combines the chosen damage with exhaustion", () => {
    let s = game();
    const minion = makePiece(s, "01110");
    minion.engagedWith = s.activePlayerId;
    s.minions.push(minion);
    s = send(s, { type: "BASIC", action: "attack" });
    expect(s.review).toBeNull();
    expect(s.prompt?.title).toBe("Basic attack");
    expect(s.villain.hp).toBe(14);
    expect(s.player.exhausted).toBe(true);
    s = send(JSON.parse(JSON.stringify(s)), { type: "CHOOSE", id: "villain" });
    expect(s.villain.hp).toBe(12);
    expect(s.review?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Rhino HP", before: 14, after: 12 }),
        expect.objectContaining({
          label: "Spider-Man readiness",
          before: "Ready",
          after: "Exhausted",
        }),
      ]),
    );
    s = send(s, { type: "PROCEED" });
    expect(s.review).toBeNull();
    expect(s.prompt).toBeNull();
  });

  it("combines an event's payment and damage, then cleans up without another Proceed", () => {
    let s = game();
    const event = makePiece(s, "01005"),
      energy = makePiece(s, "01088"),
      mental = makePiece(s, "01089");
    s.player.hand = [event, energy, mental];
    s = send(s, { type: "PLAY", id: event.id });
    s = send(s, { type: "PAY", ids: [energy.id, mental.id] });
    expect(s.villain.hp).toBe(6);
    expect(s.review?.payment).toMatchObject({ cost: 3, total: 4 });
    expect(s.review?.cards?.filter((c) => c.kind === "spent")).toHaveLength(2);
    s = send(JSON.parse(JSON.stringify(s)), { type: "PROCEED" });
    expect(s.review).toBeNull();
    expect(s.resolving).toHaveLength(0);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  });

  it("keeps cancel and pass immediate without spending or an acknowledgement", () => {
    let s = game();
    const event = makePiece(s, "01005");
    s.player.hand = [event, makePiece(s, "01088"), makePiece(s, "01089")];
    const before = structuredClone(s.player);
    s = send(s, { type: "PLAY", id: event.id });
    s = send(s, { type: "CANCEL" });
    expect(s.player).toEqual(before);
    expect(s.review).toBeNull();
    s.prompt = {
      kind: "choice",
      title: "Optional",
      text: "",
      options: [{ id: "skip", label: "Pass", effects: [] }],
    };
    s = send(s, { type: "CHOOSE", id: "skip" });
    expect(s.review).toBeNull();
  });

  it("shows damage prevention choices directly with saved calculation and hidden boosts before defense", () => {
    let s = game();
    s.player.hand.push(makePiece(s, "01003"));
    s.encounter.deck.unshift(makePiece(s, "01103"));
    s = triggerAttack(s);
    expect(s.review).toBeNull();
    expect(s.prompt?.title).toMatch(/Rhino attacks/);
    expect(s.prompt?.context?.cards?.some((c) => c.code === "01103")).not.toBe(
      true,
    );
    s = send(s, { type: "CHOOSE", id: "take" });
    expect(s.review).toBeNull();
    expect(s.prompt?.title).toBe("Incoming attack");
    expect(s.prompt?.context?.calculation?.total).toBeGreaterThan(0);
    expect(s.player.hp).toBe(10);
    expect(summarize(s).prompt?.context).toEqual(s.prompt?.context);
    s = send(JSON.parse(JSON.stringify(s)), { type: "CHOOSE", id: "backflip" });
    // The prevention is a meaningful result, never an extra choice-confirmed stop.
    expect(s.review?.title).not.toBe("Decision confirmed");
    for (let i = 0; s.review && i < 10; i++) s = send(s, { type: "PROCEED" });
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.filter((p) => p.code === "01003")).toHaveLength(1);
  });

  it("retains two distinct copies of the same ordinary boost without duplicate discard thumbnails", () => {
    let s = game();
    s.villainId = "klaw";
    s.encounter.deck.unshift(makePiece(s, "01103"), makePiece(s, "01103"));
    s = triggerAttack(s);
    s.player.hand = [];
    s = send(s, { type: "CHOOSE", id: "take" });
    const boosts = s.review?.cards?.filter((c) => c.code === "01103");
    expect(boosts).toHaveLength(2);
    expect(new Set(boosts?.map((c) => c.id)).size).toBe(2);
    expect(boosts?.every((c) => c.kind === "boost")).toBe(true);
    expect(s.player.hp).toBe(10);
  });

  it("does not collapse changes to separate characters with the same printed name", () => {
    const base = {
      id: 1,
      title: "Damage",
      actor: "Spider-Man",
      phase: "player",
      messages: [],
    };
    const combined = mergeReviews(
      {
        ...base,
        changes: [
          {
            key: "a:damage",
            label: "Hydra Soldier damage",
            kind: "health",
            before: 0,
            after: 1,
          },
        ],
      },
      {
        ...base,
        changes: [
          {
            key: "b:damage",
            label: "Hydra Soldier damage",
            kind: "health",
            before: 0,
            after: 2,
          },
        ],
      },
    );
    expect(combined.changes).toHaveLength(2);
  });
});
