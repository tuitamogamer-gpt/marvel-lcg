import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
} from "../src/game/engine";
import { paymentStatus } from "../src/game/payment";
import { boardSnapshot, recordReview } from "../src/game/review";
import type { Command, Effect, GameState } from "../src/game/types";

function send(s: GameState, command: Command) {
  const result = dispatch(s, command);
  expect(result.error).toBeUndefined();
  return result;
}
function game(villainId = "rhino") {
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    seed: 34,
  });
  s = send(s, { type: "MULLIGAN", ids: [] });
  // Focused fixtures begin after setup, with the real guided dispatcher.
  s.guided = true;
  return s;
}
function fixture(s: GameState, ...effects: Effect[]) {
  s.prompt = {
    kind: "choice",
    title: "Fixture",
    text: "",
    options: [{ id: "start", label: "Start", effects }],
  };
  s = send(s, { type: "CHOOSE", id: "start" });
  return send(s, { type: "PROCEED" });
}
function attack(s: GameState) {
  s.player.form = "hero";
  s.attack = {
    attacker: s.villain.id,
    base: 2,
    boostCodes: [],
    boostEffects: [],
    defender: "none",
    defense: 0,
    prevented: 0,
    damage: 0,
    overkill: false,
    isVillain: true,
    targetPlayerId: "p1",
  };
  s.player.hand = [];
}

describe("visible payments and manual checkpoints", () => {
  it("shows the exact cards and ability paid, saving the receipt before the purchased card resolves", () => {
    let s = game();
    const target = makePiece(s, "01066"),
      resource = makePiece(s, "01088");
    s.player.hand = [target, resource];
    s = send(s, { type: "PLAY", id: target.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(paymentSources(s).find((x) => x.id === "scientist")?.code).toBe(
      "01001b",
    );
    s = send(s, { type: "PAY", ids: [resource.id, "scientist"] });
    expect(s.review?.source).toBe(target.code);
    expect(s.review?.payment).toEqual({ title: "Hawkeye", total: 3, cost: 3 });
    expect(s.review?.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: resource.id,
          code: "01088",
          resources: ["energy", "energy"],
          kind: "spent",
        }),
        expect.objectContaining({
          id: "scientist",
          code: "01001b",
          resources: ["mental"],
          kind: "ability",
        }),
      ]),
    );
    expect(s.player.hand.map((p) => p.id)).toContain(target.id);
    expect(s.player.inPlay.map((p) => p.id)).not.toContain(target.id);
    const saved = JSON.parse(JSON.stringify(s));
    expect(dispatch(saved, { type: "FLIP" }).error).toMatch(/Proceed/);
    s = send(saved, { type: "PROCEED" });
    expect(s.player.inPlay.map((p) => p.id)).toContain(target.id);
    expect(s.review?.cards).toContainEqual(
      expect.objectContaining({ id: target.id, kind: "played" }),
    );
  });

  it("requires the correct printed types and matches the preview without spending an invalid payment", () => {
    let s = game();
    const energy = makePiece(s, "01088"),
      mental = makePiece(s, "01089");
    s.player.hand = [energy, mental];
    s.prompt = {
      kind: "payment",
      title: "Mental cost",
      text: "",
      options: [],
      cost: 2,
      requirements: ["mental", "mental"],
      after: [{ type: "threat", target: "main", amount: 1 }],
    };
    const sources = paymentSources(s);
    expect(
      paymentStatus(sources, [energy.id], 2, ["mental", "mental"]).ready,
    ).toBe(false);
    const invalid = dispatch(s, { type: "PAY", ids: [energy.id] });
    expect(invalid.error).toMatch(/mental/);
    expect(invalid.player).toEqual(s.player);
    expect(invalid.prompt).toEqual(s.prompt);
    expect(
      paymentStatus(sources, [mental.id], 2, ["mental", "mental"]).ready,
    ).toBe(true);
    s = send(s, { type: "PAY", ids: [mental.id] });
    expect(s.review?.payment?.total).toBe(2);
    expect(s.scheme.threat).toBe(0);
  });

  it("does not count a single wild twice and identifies a last Web-Shooter counter as an ability", () => {
    let s = game();
    s.player.form = "hero";
    const shooter = makePiece(s, "01008");
    shooter.counters = 1;
    s.player.inPlay.push(shooter);
    s.player.hand = [];
    const sources = paymentSources(s);
    expect(sources[0].description).toContain("then discard");
    expect(
      paymentStatus(sources, [shooter.id], 1, ["mental", "physical"]).missing,
    ).toEqual(["physical"]);
    s.prompt = {
      kind: "payment",
      title: "Cost",
      text: "",
      options: [],
      cost: 1,
      after: [],
    };
    s = send(s, { type: "PAY", ids: [shooter.id] });
    expect(s.review?.cards).toHaveLength(1);
    expect(s.review?.cards?.[0]).toMatchObject({
      code: shooter.code,
      kind: "ability",
      resources: ["wild"],
    });
    expect(s.player.discard.map((p) => p.id)).toContain(shooter.id);
  });

  it("records the identities of drawn and discarded cards even when the hand count stays the same", () => {
    const s = game();
    const before = boardSnapshot(s);
    const out = s.player.hand.shift()!,
      incoming = s.player.deck.shift()!;
    s.player.discard.push(out);
    s.player.hand.push(incoming);
    recordReview(s, before, { type: "draw" });
    expect(s.review?.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: out.id,
          code: out.code,
          kind: "discarded",
        }),
        expect.objectContaining({
          id: incoming.id,
          code: incoming.code,
          kind: "drawn",
        }),
      ]),
    );
    expect(s.review?.changes.some((c) => c.label === "Spider-Man hand")).toBe(
      false,
    );
  });
});

describe("visible encounters and boosts", () => {
  it("reveals an encounter before it enters play or its damage is applied", () => {
    let s = game();
    s.player.form = "hero";
    s.player.hand = [];
    const encounter = makePiece(s, "01103");
    const hp = s.player.hp;
    s = fixture(s, { type: "reveal", piece: encounter });
    expect(s.review?.source).toBe(encounter.code);
    expect(s.review?.cards?.[0]).toMatchObject({
      code: encounter.code,
      label: "Encounter revealed",
    });
    expect(s.minions).toHaveLength(0);
    expect(s.player.hp).toBe(hp);
    s = send(s, { type: "PROCEED" });
    expect(s.minions.map((p) => p.id)).toContain(encounter.id);
    expect(s.player.hp).toBe(hp);
    s = send(s, { type: "PROCEED" });
    expect(s.player.hp).toBe(hp - 1);
  });

  it("keeps dealt encounters face down and does not repeat an old reveal when there are no cards left", () => {
    let s = game();
    s = fixture(s, { type: "dealEncounters" });
    expect(s.review?.cards).toHaveLength(1);
    expect(s.review?.cards?.[0]).toMatchObject({
      kind: "dealt",
      name: "Facedown encounter",
    });
    expect(s.review?.cards?.[0].code).toBeUndefined();
    const state = game();
    state.lastEncounter = "01103";
    const before = boardSnapshot(state);
    recordReview(state, before, { type: "revealDealt" });
    expect(state.review).toBeNull();
  });

  it("pauses between the boost card, its star ability and attack damage", () => {
    let s = game();
    attack(s);
    s.encounter.deck.unshift(makePiece(s, "01131"));
    const hp = s.player.hp;
    s = fixture(s, { type: "boostAttack" });
    expect(s.review?.cards).toContainEqual(
      expect.objectContaining({ code: "01131", kind: "boost" }),
    );
    expect(s.review?.calculation?.total).toBe(2);
    expect(s.villain.tough).toBe(false);
    expect(s.player.hp).toBe(hp);
    s = send(JSON.parse(JSON.stringify(s)), { type: "PROCEED" });
    expect(s.villain.tough).toBe(true);
    expect(s.review?.title).toBe("Resolve boost ability");
    expect(s.player.hp).toBe(hp);
    s = send(s, { type: "PROCEED" });
    expect(s.review?.title).toBe("Boost resolved · discard card");
    expect(s.player.hp).toBe(hp);
    s = send(s, { type: "PROCEED" });
    expect(s.review?.title).toBe("Prevent damage or resolve the attack");
    expect(s.player.hp).toBe(hp);
    s = send(s, { type: "PROCEED" });
    expect(s.player.hp).toBe(hp - 2);
  });

  it("reveals Klaw's two boosts separately before applying damage", () => {
    let s = game("klaw");
    attack(s);
    s.encounter.deck.unshift(makePiece(s, "01099"), makePiece(s, "01103"));
    const hp = s.player.hp;
    s = fixture(s, { type: "boostAttack" });
    expect(s.attack?.boostCodes).toHaveLength(1);
    expect(s.player.hp).toBe(hp);
    s = send(s, { type: "PROCEED" });
    expect(s.review?.title).toBe("Boost resolved · discard card");
    expect(s.player.hp).toBe(hp);
    s = send(s, { type: "PROCEED" });
    expect(s.attack?.boostCodes).toHaveLength(2);
    expect(s.review?.cards?.filter((c) => c.kind === "boost")).toHaveLength(1);
    expect(s.review?.calculation?.total).toBe(6);
    expect(s.player.hp).toBe(hp);
  });
});
