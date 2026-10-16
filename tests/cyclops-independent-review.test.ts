import { describe, expect, it } from "vitest";
import { card, heroStats } from "../src/game/cards.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Aspect, GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  hand,
  put,
  minion,
  native,
  pay,
  physical,
  play,
  target,
  reload,
} from "./dv-test-helpers.js";

function base(cyclopsSeat = 0) {
  const heroes = [
    { heroId: "cyclops", aspect: "leadership" as Aspect },
    { heroId: "colossus", aspect: "protection" as Aspect },
    { heroId: "spider_man", aspect: "justice" as Aspect },
  ];
  if (cyclopsSeat === 1) [heroes[0], heroes[1]] = [heroes[1], heroes[0]];
  let s = newGame({
    heroId: heroes[0].heroId,
    aspect: heroes[0].aspect,
    heroes,
    villainId: "rhino",
    seed: 3333,
    pacing: "expert",
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s, (v) =>
    v.prompt?.title === "Piotr Rasputin setup"
      ? v.prompt.options[0]?.id
      : undefined,
  );
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    const cards = physical(s);
    s.player.deck = cards;
    s.player.hand = [];
    s.player.discard = [];
    s.player.inPlay = [];
    s.player.form = "hero";
    s.player.exhausted = false;
    s.player.flipped = false;
    s.player.tough = false;
    s.player.toughCards = 0;
  }
  activateSeat(s, `p${cyclopsSeat + 1}`);
  s.turnPlayerId = s.activePlayerId;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.minions = [];
  s.attachments = [];
  s.sideSchemes = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01186"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 0;
  return s;
}
function attached(s: GameState, code: string, target: string) {
  const p = put(s, code);
  p.attachedTo = target;
  return p;
}
function optic(s: GameState) {
  return command(s, { type: "ABILITY", id: "identity", action: "optic-blast" });
}
function useAlly(s: GameState, p: Piece, target: string) {
  s = command(s, {
    type: "ABILITY",
    id: p.id,
    action: "attack",
    target,
  } as any);
  return s.prompt?.kind === "choice" &&
    s.prompt.options.some((o) => o.id === target)
    ? choose(s, target)
    : s;
}

describe("Cyclops independent timing and cross-seat regressions", () => {
  it("Exploit Weakness does not increase the dealt damage redirected to Armored Rhino Suit", () => {
    let s = base();
    attached(s, "33005", s.villain.id);
    const armor = makePiece(s, "01098");
    armor.attachedTo = s.villain.id;
    s.attachments.push(armor);
    const [resource] = hand(s, "33024");
    s = choose(optic(s), s.villain.id);
    s = finish(pay(s, [resource]));
    expect(s.villain.hp).toBe(50);
    expect(s.attachments.find((p) => p.id === armor.id)?.damage).toBe(3);
  });

  it("Visor retains ranged and piercing when Full Blast interrupts and overkills a tough retaliating minion", () => {
    let s = base();
    const enemy = minion(s, "01184"); // MODOK: retaliate 2, eight HP.
    enemy.tough = true;
    enemy.toughCards = 1;
    attached(s, "33006", enemy.id);
    const visor = put(s, "33003");
    const [full, resource] = hand(s, "33008", "33024");
    const hp = s.player.hp;
    s = choose(optic(s), enemy.id);
    s = pay(s, [], undefined, [visor.id]);
    s = choose(s, full.id);
    s = finish(pay(s, [resource]));
    expect(s.minions.some((p) => p.id === enemy.id)).toBe(false);
    expect(s.villain.hp).toBe(47);
    expect(s.player.hp).toBe(hp);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === full.id)).toBe(true);
  });

  it("canceling Full Blast keeps its physical event and still resolves the paid Optic Blast", () => {
    let s = base();
    attached(s, "33006", s.villain.id);
    const visor = put(s, "33003");
    const [full] = hand(s, "33008", "33024");
    s = choose(optic(s), s.villain.id);
    s = pay(s, [], undefined, [visor.id]);
    s = choose(s, full.id);
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "CANCEL" });
    s = finish(s);
    expect(s.villain.hp).toBe(47);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.some((p) => p.id === full.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === visor.id)?.exhausted).toBe(
      true,
    );
  });

  it("an off-turn Utopia owner readies the entering player's hero and returns the response window", () => {
    let s = base();
    activateSeat(s, "p2");
    const utopia = put(s, "33020");
    activateSeat(s, "p1");
    const ally = put(s, "33019");
    s.player.exhausted = true;
    s = native(s, { type: "allyEnter", id: ally.id });
    s = choose(s, utopia.id);
    expect(s.activePlayerId).toBe("p2");
    s = finish(choose(s, "hero:p1"));
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === utopia.id)
        ?.exhausted,
    ).toBe(true);
    expect(s.activePlayerId).toBe("p1");
    expect(s.turnPlayerId).toBe("p1");
  });

  it("a Mutant alter-ego uses another player's Danger Room with their own physical Training", () => {
    let s = base();
    const room = put(s, "33021"),
      ally = put(s, "33019");
    activateSeat(s, "p2");
    s.player.form = "alter";
    const training = put(s, "33015");
    s.player.inPlay = s.player.inPlay.filter((p) => p.id !== training.id);
    s.player.discard.push(training);
    activateSeat(s, "p1");
    s = native(s, { type: "allyEnter", id: ally.id });
    s = choose(s, `${room.id}:p2`);
    s = finish(choose(s, training.id));
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === training.id),
    ).toMatchObject({ attachedTo: ally.id, ownerId: "p2" });
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === room.id)?.exhausted,
    ).toBe(true);
    expect(s.activePlayerId).toBe("p1");
  });

  it("Priority Target draws for the actual defeating ally's controller, not its attachment owner", () => {
    let s = base();
    const enemy = minion(s, "01104");
    attached(s, "33007", enemy.id);
    activateSeat(s, "p2");
    const ally = put(s, "32048");
    s.turnPlayerId = "p2";
    const before = s.player.hand.length;
    s = useAlly(s, ally, enemy.id);
    expect(s.prompt?.title).toContain("Priority Target");
    s = choose(s, "yes");
    s = finish(s);
    expect(seatView(s, "p2").player.hand).toHaveLength(before + 2);
    expect(seatView(s, "p1").player.hand).toHaveLength(0);
  });

  it("Field Commander starts Cyclops before the first player and resumes player order without a second Cyclops turn", () => {
    let s = base(1);
    put(s, "33004");
    s.firstPlayerId = "p3";
    s = finish(native(s, { type: "newRound" }));
    expect(s.firstPlayerId).toBe("p1");
    expect(s.turnPlayerId).toBe("p2");
    s = command(s, { type: "END_TURN" });
    expect(s.turnPlayerId).toBe("p1");
    s = command(s, { type: "END_TURN" });
    expect(s.turnPlayerId).toBe("p3");
    expect(s.players.find((seat) => seat.id === "p2")?.ended).toBe(true);
  });

  it("removing Field Commander restores Temporary on minion attachments before the round ends", () => {
    let s = base();
    const commander = put(s, "33004"),
      enemy = minion(s);
    const tactic = attached(s, "33006", enemy.id);
    s = native(s, { type: "discardPiece", id: commander.id });
    s = finish(native(s, { type: "newRound" }));
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === tactic.id),
    ).toBe(false);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === tactic.id),
    ).toBe(true);
  });

  it("Befuddle replaces an ally's ATK with THW without replacing its consequential attack damage", () => {
    let s = base();
    const enemy = minion(s, "01181");
    const ally = put(s, "33014"); // Blindfold: 0 ATK, 2 THW, one attack consequence.
    attached(s, "33033", enemy.id);
    s = useAlly(s, ally, enemy.id);
    s = choose(s, "thw");
    s = finish(s);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
});
