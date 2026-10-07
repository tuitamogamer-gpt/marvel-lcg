import { expect, it } from "vitest";
import { dispatch, makePiece, newGame, playable } from "../src/game/engine.js";
import type { Command, GameState } from "../src/game/types.js";

function run(s: GameState, command: Command) {
  s = dispatch(s, command);
  expect(s.error).toBeUndefined();
  for (let i = 0; s.review && i < 30; i++) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function base(heroId = "doctor_strange") {
  let s = newGame({
    heroId,
    aspect: "leadership",
    villainId: "rhino",
    seed: 12018,
    pacing: "expert",
  });
  s = run(s, { type: "MULLIGAN", ids: [] });
  s.player.form = "hero";
  s.player.inPlay = [];
  s.player.hand = [];
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.sideSchemes = [];
  s.minions = [];
  return s;
}

it("Iron Man discounts a Reinforced Suit attached to him", () => {
  let s = base();
  const ironMan = makePiece(s, "09039");
  const ronin = makePiece(s, "12013");
  s.player.inPlay.push(ironMan, ronin);
  const suit = makePiece(s, "12018");
  s.player.hand.push(suit);
  expect(playable(s, suit)).toBeNull();
  s = run(s, { type: "PLAY", id: suit.id });
  expect(s.prompt?.title).toBe("Reinforced Suit");
  expect(s.prompt?.options.map((o) => o.id)).toEqual([ironMan.id, ronin.id]);
  s = run(s, { type: "CHOOSE", id: ironMan.id });
  expect(s.player.inPlay.find((p) => p.id === suit.id)?.attachedTo).toBe(
    ironMan.id,
  );
  expect(s.prompt).toBeNull();
  expect(s.player.hand).toHaveLength(0);
  expect(s.player.discard).toHaveLength(0);
});

it("Power Gloves prepayment excludes non-Avengers and allies already wearing a copy", () => {
  let s = base();
  const ironMan = makePiece(s, "09039");
  const ronin = makePiece(s, "12013");
  const nickFury = makePiece(s, "01084");
  const existing = makePiece(s, "12017");
  existing.attachedTo = ronin.id;
  s.player.inPlay.push(ironMan, ronin, nickFury, existing);
  const gloves = makePiece(s, "12017");
  s.player.hand.push(gloves);
  expect(playable(s, gloves)).toBeNull();
  s = run(s, { type: "PLAY", id: gloves.id });
  expect(s.prompt?.options.map((o) => o.id)).toEqual([ironMan.id]);
  s = run(s, { type: "CHOOSE", id: ironMan.id });
  expect(s.player.inPlay.find((p) => p.id === gloves.id)?.attachedTo).toBe(
    ironMan.id,
  );
  expect(s.prompt).toBeNull();
  expect(s.player.discard).toHaveLength(0);
});

it("Iron Man's unavailable attachment slot cannot discount an upgrade bound to another ally", () => {
  const s = base();
  const ironMan = makePiece(s, "09039");
  const ronin = makePiece(s, "12013");
  const existing = makePiece(s, "12018");
  existing.attachedTo = ironMan.id;
  s.player.inPlay.push(ironMan, ronin, existing);
  const suit = makePiece(s, "12018");
  s.player.hand.push(suit);
  expect(playable(s, suit)).toBe(
    "Not enough resources in your hand or play area.",
  );
});

it("Moment of Triumph sees Giant Stomp's lethal second damage packet on the same enemy", () => {
  let s = base("ant");
  s.player.heroForm = "giant";
  s.player.hp = 4;
  const yellowjacket = makePiece(s, "12027");
  yellowjacket.engagedWith = s.activePlayerId;
  s.minions.push(yellowjacket);
  const stomp = makePiece(s, "12003");
  const energy = makePiece(s, "12021");
  const genius = makePiece(s, "12022");
  const triumph = makePiece(s, "12030");
  s.player.hand.push(stomp, energy, genius, triumph);
  s = run(s, { type: "PLAY", id: stomp.id });
  s = run(s, { type: "PAY", ids: [energy.id, genius.id] });
  s = run(s, { type: "CHOOSE", id: yellowjacket.id });
  expect(s.minions.some((p) => p.id === yellowjacket.id)).toBe(false);
  expect(s.prompt?.title).toBe("Moment of Triumph");
  s = run(s, { type: "CHOOSE", id: triumph.id });
  expect(s.player.hp).toBe(9);
});

it("Giant Stomp's first packet removes Tough and Triumph counts only the lethal second packet", () => {
  let s = base("ant");
  s.player.heroForm = "giant";
  s.player.hp = 4;
  const yellowjacket = makePiece(s, "12027");
  yellowjacket.engagedWith = s.activePlayerId;
  yellowjacket.tough = true;
  yellowjacket.toughCards = 1;
  s.minions.push(yellowjacket);
  const stomp = makePiece(s, "12003");
  const energy = makePiece(s, "12021");
  const genius = makePiece(s, "12022");
  const triumph = makePiece(s, "12030");
  s.player.hand.push(stomp, energy, genius, triumph);
  s = run(s, { type: "PLAY", id: stomp.id });
  s = run(s, { type: "PAY", ids: [energy.id, genius.id] });
  expect(s.minions.find((p) => p.id === yellowjacket.id)).toMatchObject({
    tough: false,
    damage: 0,
  });
  s = run(s, { type: "CHOOSE", id: yellowjacket.id });
  expect(s.prompt?.title).toBe("Moment of Triumph");
  s = run(s, { type: "CHOOSE", id: triumph.id });
  expect(s.player.hp).toBe(8);
});
