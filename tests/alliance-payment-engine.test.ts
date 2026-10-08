import { describe, expect, it } from "vitest";
import { card, resources } from "../src/game/cards.js";
import {
  canPayAlliance,
  dispatch,
  newGame,
  paymentSources,
} from "../src/game/engine.js";
import { advisePrompt } from "../src/game/advisor.js";
import { paymentStatus, suggestPayment } from "../src/game/payment.js";
import { seatView } from "../src/game/team.js";
import type { Command, GameState, Piece } from "../src/game/types.js";

const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function command(s: GameState, c: Command) {
  const next = dispatch(reload(s), c);
  expect(next.error, JSON.stringify(next.prompt)).toBeUndefined();
  return next;
}
function base() {
  const s = newGame({
    heroId: "warm",
    aspect: "leadership",
    villainId: "rhino",
    seed: 23032,
    pacing: "expert",
    heroes: [
      { heroId: "warm", aspect: "leadership" },
      { heroId: "spider_man", aspect: "leadership" },
    ],
  });
  s.phase = "player";
  s.prompt = null;
  s.review = null;
  s.queue = [];
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.deck.push(...v.player.hand.splice(0));
    v.player.form = seat.id === "p1" ? "hero" : "alter";
  }
  return s;
}
function take(s: GameState, owner: string, predicate: (p: Piece) => boolean) {
  const v = seatView(s, owner),
    index = v.player.deck.findIndex(predicate);
  expect(index).toBeGreaterThanOrEqual(0);
  const p = v.player.deck.splice(index, 1)[0];
  v.player.hand.push(p);
  return p;
}
function request(
  s: GameState,
  cost = 2,
  requirements: string[] = [],
  piece?: Piece,
) {
  s.prompt = {
    kind: "choice",
    title: "Native payment review",
    text: "",
    options: [
      {
        id: "go",
        label: "Resolve",
        effects: [
          {
            type: "payRequest",
            title: piece ? card(piece).name : "As One!",
            targetCode: piece?.code || "23032",
            piece,
            cost,
            requirements,
            cancelable: true,
            after: [{ type: "draw", amount: 1 }],
          },
        ],
      },
    ],
  };
  return command(s, { type: "CHOOSE", id: "go" });
}

describe("native Alliance and retained-ally payment", () => {
  it("requires actual Gauntlet funding in the zero-cost preview and saved advisor payment", () => {
    let s = base();
    const gun = take(s, "p1", (p) => p.code === "23005");
    s.player.hand = s.player.hand.filter((p) => p.id !== gun.id);
    s.player.inPlay.push(gun);
    const blast = take(s, "p1", (p) => p.code === "23008");
    s.flags.warMachineAmmo = 0;
    s = request(s, 0, [], blast);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.sourceRequirement).toMatchObject({
      ids: [gun.id],
      minimum: 1,
    });
    const sources = paymentSources(s, blast.id, blast.code);
    expect(
      paymentStatus(sources, [], 0, [], [], s.prompt?.sourceRequirement).ready,
    ).toBe(false);
    expect(
      suggestPayment(sources, 0, [], () => 0, [], s.prompt?.sourceRequirement),
    ).toEqual([gun.id]);
    const advice = advisePrompt(reload(s))!;
    expect(advice.command).toMatchObject({ type: "PAY", ids: [gun.id] });
    s = command(s, advice.command);
    expect(s.flags.warMachineAmmo).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === gun.id)?.exhausted).toBe(true);
    expect(s.prompt).toBeNull();
  });
  it("commits a teammate's Scientist only to that owner and gives the continuation to the event player after reload", () => {
    let s = base();
    const mental = take(
      s,
      "p1",
      (p) =>
        resources(card(p)).length === 1 && resources(card(p))[0] === "mental",
    );
    const handBefore = s.player.hand.length;
    expect(canPayAlliance(s, 2, ["mental", "mental"], undefined, "23032")).toBe(
      true,
    );
    s = request(s, 2, ["mental", "mental"]);
    expect(s.prompt?.alliance).toBe(true);
    const peer = paymentSources(s, undefined, "23032", false, true).find(
      (x) => x.playerId === "p2" && x.localId === "scientist",
    )!;
    expect(peer.resources).toEqual(["mental"]);
    s = command(s, { type: "PAY", ids: [mental.id, peer.id] });
    expect(s.activePlayerId).toBe("p1");
    expect(s.flags.scientist).toBeUndefined();
    expect(seatView(s, "p2").flags.scientist).toBe(true);
    expect(s.player.discard.some((p) => p.id === mental.id)).toBe(true);
    expect(s.player.hand).toHaveLength(handBefore);
    expect(s.prompt).toBeNull();
  });
  it("commits all of a teammate's hand resources before one owner reset and retains global RNG and dealt-card ownership", () => {
    let s = base();
    const strength = take(s, "p2", (p) => card(p).name === "Strength");
    const single = take(s, "p2", (p) => resources(card(p)).length === 1);
    s = request(s, 3);
    const peer = seatView(s, "p2");
    // Establish the empty-deck boundary after the prompt opens; ordinary
    // state checks already reset a pre-existing empty deck before payment.
    peer.player.discard.push(...peer.player.deck.splice(0));
    peer.flags.scientist = true;
    const rng = s.seed,
      hidden = s.hiddenInfo || 0,
      ownHand = s.player.hand.length;
    const sources = paymentSources(s, undefined, "23032", false, true);
    const ids = [strength.id, single.id].map(
      (id) => sources.find((x) => x.playerId === "p2" && x.localId === id)!.id,
    );
    s = command(s, { type: "PAY", ids });
    const finalPeer = seatView(s, "p2");
    expect(finalPeer.player.discard).toHaveLength(0);
    expect(finalPeer.player.deck.some((p) => p.id === strength.id)).toBe(true);
    expect(finalPeer.player.deck.some((p) => p.id === single.id)).toBe(true);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p2")).toHaveLength(1);
    expect(s.seed).not.toBe(rng);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    expect(s.activePlayerId).toBe("p1");
    expect(s.player.hand).toHaveLength(ownHand + 1);
  });
  it("rejects spending the final Sneak Attack ally atomically and proposes a payment retaining that physical ally", () => {
    let s = base();
    const sneak = take(s, "p1", (p) => p.code === "23017");
    const ally = take(s, "p1", (p) => p.code === "23012");
    const strength = take(s, "p1", (p) => card(p).name === "Strength");
    s = request(s, 1, [], sneak);
    expect(s.prompt?.retainOneOfIds).toContain(ally.id);
    const sources = paymentSources(s, sneak.id, sneak.code);
    expect(
      suggestPayment(sources, 1, [], () => 0, s.prompt?.retainOneOfIds),
    ).toEqual([strength.id]);
    const before = reload(s);
    const rejected = dispatch(reload(s), { type: "PAY", ids: [ally.id] });
    expect(rejected.error).toMatch(/Keep an eligible ally/);
    expect(rejected.player.hand).toEqual(before.player.hand);
    expect(rejected.player.discard).toEqual(before.player.discard);
    expect(rejected.prompt).toEqual(before.prompt);
    s = command(s, { type: "PAY", ids: [strength.id] });
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
  });
  it("cancels a contributed Alliance payment without spending the teammate resource or ability", () => {
    let s = base();
    const strength = take(s, "p2", (p) => card(p).name === "Strength");
    s = request(s);
    const before = reload(s);
    s = command(s, { type: "CANCEL" });
    expect(seatView(s, "p2").player.hand).toEqual(
      seatView(before, "p2").player.hand,
    );
    expect(seatView(s, "p2").flags.scientist).toBeUndefined();
    expect(
      seatView(s, "p2").player.hand.some((p) => p.id === strength.id),
    ).toBe(true);
  });
});
