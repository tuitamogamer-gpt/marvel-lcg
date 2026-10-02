import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine";
import { card, deckCodes, heroStats } from "../src/game/cards";
import type { Command, Effect, GameState, Piece } from "../src/game/types";

function command(input: GameState, cmd: Command): GameState {
  let s = dispatch(input, cmd);
  expect(s.error).toBeUndefined();
  let guard = 0;
  while (s.review && guard++ < 50) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function base() {
  let s = newGame({
    heroId: "captain_america",
    villainId: "rhino",
    aspect: "leadership",
    seed: 42,
    pacing: "expert",
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  expect(s.prompt).toBeNull();
  s.player.form = "hero";
  s.player.hand = [];
  s.player.inPlay = [];
  s.player.discard = [];
  s.queue = [];
  s.review = null;
  return s;
}
function teamBase() {
  let s = newGame({
    heroId: "captain_america",
    villainId: "rhino",
    aspect: "leadership",
    seed: 42,
    pacing: "expert",
    heroes: [
      { heroId: "captain_america", aspect: "leadership" },
      { heroId: "spider_man", aspect: "justice" },
      { heroId: "captain_marvel", aspect: "aggression" },
    ],
  });
  for (let seat = 0; seat < 3; seat++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    seat.player.form = "hero";
    seat.player.hand = [];
    seat.player.inPlay = [];
  }
  s.player = s.players[0].player;
  s.flags = s.players[0].flags;
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "Resolve the queued native effect.",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return command(s, { type: "CHOOSE", id: "go" });
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function support(s: GameState, code: string) {
  const p = makePiece(s, code);
  s.player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind).toBe("choice");
  return command(s, { type: "CHOOSE", id });
}
function select(s: GameState, ids: string[]) {
  expect(s.prompt?.kind).toBe("select");
  return command(s, { type: "SELECT", ids });
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: makePiece(s, code), skip: true });
}
function codeIds(pieces: Piece[], code: string) {
  return pieces.filter((p) => p.code === code).map((p) => p.id);
}

describe("Captain America through the actual game dispatcher", () => {
  it("starts with exactly40 cards and retrieves Shield after the opening mulligan", () => {
    expect(deckCodes("captain_america", "leadership")).toHaveLength(40);
    let s = newGame({
      heroId: "captain_america",
      villainId: "rhino",
      aspect: "leadership",
      seed: 42,
      pacing: "expert",
    });
    const original = [...s.player.hand, ...s.player.deck];
    expect(original).toHaveLength(40);
    expect(original.filter((p) => p.code === "03009")).toHaveLength(1);
    // Put the Shield in the deck if the seeded opening hand happened to contain it.
    const index = s.player.hand.findIndex((p) => p.code === "03009");
    if (index >= 0) {
      const replacement = s.player.deck.shift()!;
      s.player.deck.push(s.player.hand.splice(index, 1, replacement)[0]);
    }
    expect(s.player.hand).toHaveLength(6);
    expect(codeIds(s.player.hand, "03009")).toEqual([]);
    s = command(s, { type: "MULLIGAN", ids: [] });
    expect(s.phase).toBe("player");
    expect(s.player.hand).toHaveLength(7);
    expect(codeIds(s.player.hand, "03009")).toHaveLength(1);
    expect(s.player.deck).toHaveLength(33);
  });
  it("Living Legend reduces a real ally payment once, and counts a first ally played in hero form", () => {
    let s = base();
    s.player.form = "alter";
    // Maria Hill's printed cost2 provides a visible, positive payment after the discount.
    let h = hand(s, "01067", "03003", "03004", "03006", "01083");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.cost).toBe(1);
    s = command(s, { type: "PAY", ids: [h[1].id] });
    expect(s.player.inPlay.some((p) => p.code === "01067")).toBe(true);
    const next = s.player.hand.find((p) => p.code === "01083")!;
    s = command(s, { type: "PLAY", id: next.id });
    expect(s.prompt?.cost).toBe(3);
    s = base();
    h = hand(s, "01067", "03003", "03004", "03006", "01083");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt?.cost).toBe(2);
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    s.player.hand.push(makePiece(s, "01088"));
    s = command(s, { type: "FLIP" });
    s = command(s, { type: "PLAY", id: h[4].id });
    expect(s.prompt?.cost).toBe(3);
  });
  it("All Day asks which card pays, readies the identity and enforces its round limit", () => {
    let s = base();
    const h = hand(s, "03003", "03004");
    s.player.exhausted = true;
    s = command(s, { type: "ABILITY", id: "identity", action: "all-day" });
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toHaveLength(2);
    s = select(s, [h[1].id]);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.map((p) => p.code)).toEqual(["03003"]);
    s.player.exhausted = true;
    const again = dispatch(s, {
      type: "ABILITY",
      id: "identity",
      action: "all-day",
    });
    expect(again.error).toBeTruthy();
    expect(again.player.exhausted).toBe(true);
  });
  it("Fearless Determination really draws, stacks THW and expires at the player-phase boundary", () => {
    let s = base();
    const h = hand(s, "03003", "03003");
    const before = s.player.deck.length;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PLAY", id: h[1].id });
    expect(s.player.deck).toHaveLength(before - 2);
    expect(heroStats(s).thwart).toBe(4);
    s = command(s, { type: "END_TURN" });
    expect(heroStats(s).thwart).toBe(2);
  });
  it("Agent13 enters play and offers her printed optional2-threat response", () => {
    let s = base();
    const h = hand(s, "03002", "01089", "03003");
    s.scheme.threat = 4;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.prompt?.title).toBe("Agent 13");
    s = choose(s, "yes");
    expect(s.scheme.threat).toBe(2);
    expect(s.player.inPlay.some((p) => p.code === "03002")).toBe(true);
  });
  it("Serum pays an actual physical HeroicStrike requirement and exhausts only once", () => {
    let s = base();
    const serum = support(s, "03010");
    const h = hand(s, "03004", "01089");
    expect(
      paymentSources(s, h[0].id).find((p) => p.id === serum.id)?.resources,
    ).toEqual(["physical"]);
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [serum.id, h[1].id] });
    expect(s.villain.hp).toBe(hp - 6);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === serum.id)?.exhausted).toBe(
      true,
    );
    expect(paymentSources(s).some((p) => p.id === serum.id)).toBe(false);
  });
  it("Shield Toss deals4 to two distinct enemies and preserves the Guard target snapshot", () => {
    let s = base();
    const sh = support(s, "03009");
    const h = hand(s, "03006", "03003", "03004");
    const guard = minion(s, "03029");
    const zemo = minion(s, "03028");
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = select(s, [h[1].id, h[2].id]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([guard.id, zemo.id]);
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(false);
    s = select(s, [guard.id, zemo.id]);
    expect(s.villain.hp).toBe(hp);
    expect(s.minions.some((p) => p.id === guard.id)).toBe(false);
    expect(s.minions.find((p) => p.id === zemo.id)?.damage).toBe(4);
    expect(s.player.hand.some((p) => p.id === sh.id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Stunned cancels Shield Toss only after selected discards and return-Shield costs", () => {
    let s = base();
    const sh = support(s, "03009");
    const h = hand(s, "03006", "03003");
    s.player.stunned = true;
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = select(s, [h[1].id]);
    expect(s.player.stunned).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual([sh.id]);
    expect(s.player.discard.map((p) => p.code).sort()).toEqual([
      "03003",
      "03006",
    ]);
    expect(s.villain.hp).toBe(hp);
    expect(s.prompt).toBeNull();
  });
  it("rejects playing Shield Toss before additional costs are available", () => {
    const s = base();
    const h = hand(s, "03006", "03003");
    expect(playable(s, h[0])).toContain("Shield");
  });
  it("Shield Block prevents an actual enemy attack, exhausts Shield and discards itself", () => {
    let s = base();
    const sh = support(s, "03009");
    const h = hand(s, "03005");
    s.encounter.deck = [makePiece(s, "03030"), makePiece(s, "03030")];
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(s.prompt?.options.some((o) => o.id === h[0].id)).toBe(true);
    s = choose(s, h[0].id);
    expect(s.player.hp).toBe(hp);
    expect(s.player.inPlay.find((p) => p.id === sh.id)?.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.code === "03005")).toBe(true);
    expect(s.attack).toBeNull();
  });
  it("Shield Block also prevents non-attack damage in alter-ego form", () => {
    let s = base();
    support(s, "03009");
    const h = hand(s, "03005");
    s.player.form = "alter";
    const hp = s.player.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "Hit Squad",
    });
    expect(s.prompt?.options.some((o) => o.id === h[0].id)).toBe(true);
    s = choose(s, h[0].id);
    expect(s.player.hp).toBe(hp);
    expect(s.player.discard.some((p) => p.code === "03005")).toBe(true);
  });
  it("Tough prevents damage before any ShieldBlock interrupt is offered", () => {
    let s = base();
    const sh = support(s, "03009");
    hand(s, "03005");
    s.player.tough = true;
    const hp = s.player.hp;
    s = native(s, { type: "damage", target: "hero", amount: 3 });
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(s.prompt).toBeNull();
    expect(s.player.inPlay.find((p) => p.id === sh.id)?.exhausted).toBe(false);
    expect(s.player.hand).toHaveLength(1);
  });
  it("Helmet offers its replacement before actual elimination, then leaves1HP and consumes itself", () => {
    let s = base();
    const helmet = support(s, "03008");
    s.player.hp = 2;
    s = native(s, { type: "damage", target: "hero", amount: 3 });
    expect(s.phase).not.toBe("lost");
    expect(s.players[0].eliminated).toBe(false);
    expect(s.prompt?.title).toContain("Helmet");
    s = choose(s, "helmet");
    expect(s.player.hp).toBe(1);
    expect(s.players[0].eliminated).toBe(false);
    expect(s.phase).toBe("player");
    expect(s.player.inPlay.some((p) => p.id === helmet.id)).toBe(false);
    expect(s.player.discard.some((p) => p.code === "03008")).toBe(true);
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    expect(s.phase).toBe("lost");
  });
  it("declining Helmet permits the identity to be defeated", () => {
    let s = base();
    support(s, "03008");
    s.player.hp = 1;
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    s = choose(s, "allow-defeat");
    expect(s.phase).toBe("lost");
    expect(s.players[0].eliminated).toBe(true);
  });
  it("Helmet's named-hero replacement does not protect Steve in alter-ego form", () => {
    let s = base();
    support(s, "03008");
    s.player.form = "alter";
    s.player.hp = 1;
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    expect(s.prompt).toBeNull();
    expect(s.phase).toBe("lost");
    expect(s.players[0].eliminated).toBe(true);
  });
  it("Shield's printed DEF and retaliation apply to Captain America and expire when it leaves play", () => {
    let s = base();
    support(s, "03009");
    expect(heroStats(s).defense).toBe(3);
    s.encounter.deck = [makePiece(s, "03030"), makePiece(s, "03030")];
    const hp = s.player.hp;
    const villainHP = s.villain.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    if (s.prompt) s = choose(s, "resolve");
    expect(s.player.hp).toBe(hp);
    expect(s.villain.hp).toBe(villainHP - 1);
    s.player.inPlay = [];
    expect(heroStats(s).defense).toBe(2);
  });
  it("Apartment's real action draws and heals Steve with an exhaust cost", () => {
    let s = base();
    const apt = support(s, "03007");
    s.player.form = "alter";
    s.player.hp = 7;
    const before = s.player.deck.length;
    s = command(s, { type: "ABILITY", id: apt.id, action: "apartment" });
    expect(s.player.hp).toBe(8);
    expect(s.player.deck).toHaveLength(before - 1);
    expect(s.player.inPlay.find((p) => p.id === apt.id)?.exhausted).toBe(true);
  });
});

describe("native Captain obligation and nemesis resolution", () => {
  it("ManOutOfTime may flip independently, then exhaust ready Steve and remove itself", () => {
    let s = base();
    s = reveal(s, "03026");
    s = choose(s, "flip");
    s = choose(s, "exhaust");
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.filter((p) => p.code === "03026")).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.code === "03026")).toBe(false);
    expect(s.resolving.some((p) => p.code === "03026")).toBe(false);
  });
  it("ManOutOfTime discards the chosen half rounded down and only one obligation instance", () => {
    let s = base();
    const h = hand(s, "03003", "03004", "03005", "03006", "03010");
    s = reveal(s, "03026");
    s = choose(s, "stay");
    s = choose(s, "discard");
    expect(s.prompt?.min).toBe(2);
    s = select(s, [h[1].id, h[3].id]);
    expect(s.player.hand.map((p) => p.code)).toEqual([
      "03003",
      "03005",
      "03010",
    ]);
    expect(s.encounter.discard.filter((p) => p.code === "03026")).toHaveLength(
      1,
    );
  });
  it("HitSquad enters with3 threat and acceleration, mills a boost card and actually deals its numeric damage", () => {
    let s = base();
    s.encounter.deck = [makePiece(s, "03027"), makePiece(s, "03030")];
    const hp = s.player.hp;
    s = reveal(s, "03027");
    expect(s.sideSchemes.find((p) => p.code === "03027")?.counters).toBe(3);
    expect(card("03027").scheme_acceleration).toBe(1);
    expect(s.player.hp).toBe(hp - 3);
    expect(s.encounter.discard.some((p) => p.code === "03027")).toBe(true);
  });
  it("BaronZemo Quickstrikes on entry, restricts identity thwart initiation, but permits an ally's thwart", () => {
    let s = base();
    s = reveal(s, "03028");
    expect(s.prompt?.title).toContain("attacks");
    s = choose(s, "take");
    if (s.prompt) s = choose(s, "resolve");
    expect(s.player.hp).toBe(8);
    s.scheme.threat = 4;
    const blocked = dispatch(s, { type: "BASIC", action: "thwart" });
    expect(blocked.error).toBeTruthy();
    expect(blocked.player.exhausted).toBe(false);
    expect(blocked.scheme.threat).toBe(4);
    const ally = support(s, "03002");
    s = command(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    expect(s.scheme.threat).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("HydraSoldier Guard blocks villain targets and deals its engaged player a card when defeated", () => {
    let s = base();
    const soldier = minion(s, "03029");
    const h = hand(s, "03004", "01089", "03003");
    const hp = s.villain.hp;
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    expect(s.minions.some((p) => p.id === soldier.id)).toBe(false);
    expect(s.villain.hp).toBe(hp);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.encounter.dealt[0].dealtTo).toBe(s.activePlayerId);
  });
  it("HailHydra attacks with engaged Hydra minions and searches after a stunned attack is canceled", () => {
    let s = base();
    const soldier = minion(s, "03029");
    soldier.stunned = true;
    s.encounter.deck = [makePiece(s, "03028"), makePiece(s, "03030")];
    s.encounter.discard = [];
    s = reveal(s, "03030");
    expect(s.minions.find((p) => p.id === soldier.id)?.stunned).toBe(false);
    expect(s.prompt?.title).toBe("Hail Hydra!");
    const zemo = s.prompt!.options.find((o) => o.image === "03028")!;
    s = choose(s, zemo.id);
    expect(s.minions.some((p) => p.code === "03028")).toBe(true);
    expect(s.prompt?.title).toContain("attacks"); // Found Zemo's Quickstrike remains a real window.
  });
  it("HitSquad counts boost cards separately in first-player order for three identities", () => {
    let s = teamBase();
    s.firstPlayerId = "p2";
    s.encounter.deck = [
      makePiece(s, "03026"),
      makePiece(s, "03027"),
      makePiece(s, "03029"),
      makePiece(s, "03030"),
    ];
    s.encounter.discard = [];
    const before = s.players.map((seat) => seat.player.hp);
    s = reveal(s, "03027");
    expect(s.players.map((seat) => seat.player.hp)).toEqual([
      before[0] - 1,
      before[1] - 2,
      before[2] - 3,
    ]);
    expect(s.sideSchemes.find((p) => p.code === "03027")?.counters).toBe(9);
    expect(s.encounter.discard.map((p) => p.code)).toEqual([
      "03026",
      "03027",
      "03029",
    ]);
  });
  it("Captain defeating another player's HydraSoldier deals that engaged player the encounter card", () => {
    let s = teamBase();
    const soldier = minion(s, "03029", "p2");
    const h = hand(s, "03004", "01089", "03003");
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(s, { type: "PAY", ids: [h[1].id, h[2].id] });
    s = choose(s, soldier.id);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.encounter.dealt[0].dealtTo).toBe("p2");
  });
  it("HailHydra tracks each player's performed attacks independently before the fallback search", () => {
    let s = teamBase();
    minion(s, "03029", "p1");
    const canceled = minion(s, "03028", "p3");
    canceled.stunned = true;
    s.players[1].player.form = "alter";
    s.encounter.deck = [
      makePiece(s, "03029"),
      makePiece(s, "03029"),
      makePiece(s, "03030"),
    ];
    s.encounter.discard = [];
    const before = s.players.map((seat) => seat.player.hp);
    s = reveal(s, "03030");
    s = choose(s, "take");
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.title).toBe("Hail Hydra!");
    s = choose(s, s.prompt!.options[0].id);
    expect(s.activePlayerId).toBe("p3");
    expect(s.prompt?.title).toBe("Hail Hydra!");
    s = choose(s, s.prompt!.options[0].id);
    expect(s.players.map((seat) => seat.player.hp)).toEqual([
      before[0] - 2,
      before[1],
      before[2],
    ]);
    expect(s.minions.filter((p) => p.engagedWith === "p1")).toHaveLength(1);
    expect(s.minions.filter((p) => p.engagedWith === "p2")).toHaveLength(1);
    expect(s.minions.filter((p) => p.engagedWith === "p3")).toHaveLength(2);
    expect(s.minions.find((p) => p.id === canceled.id)?.stunned).toBe(false);
  });
});
