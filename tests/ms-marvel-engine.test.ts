import { describe, expect, it } from "vitest";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine";
import { card, deckCodes, heroStats, maxHP } from "../src/game/cards";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog";
import { deckErrors } from "../src/game/decks";
import { seatView } from "../src/game/team";
import type { Command, Effect, GameState, Piece } from "../src/game/types";

function command(input: GameState, cmd: Command): GameState {
  let s = dispatch(input, cmd);
  expect(s.error).toBeUndefined();
  for (let i = 0; s.review && i < 50; i++) s = dispatch(s, { type: "PROCEED" });
  expect(s.error).toBeUndefined();
  return s;
}
function base(team = false) {
  let s = newGame({
    heroId: "ms_marvel",
    villainId: "rhino",
    aspect: "protection",
    seed: 705,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "ms_marvel", aspect: "protection" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (let i = 0; i < s.players.length; i++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const view = seatView(s, seat);
    view.player.form = "hero";
    view.player.hand = [];
    view.player.inPlay = [];
    view.player.discard = [];
  }
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  return s;
}
function owned(s: GameState, code: string, ownerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = ownerId;
  return p;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => owned(s, code));
  return [...s.player.hand];
}
function playArea(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = owned(s, code);
  seatView(s, seatId).player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = seatId;
  s.minions.push(p);
  return p;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "Resolve native effects.",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return command(s, { type: "CHOOSE", id: "go" });
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind).toBe("choice");
  return command(s, { type: "CHOOSE", id });
}
function pay(
  s: GameState,
  ids: string[],
  wildAs?: "energy" | "mental" | "physical",
) {
  expect(s.prompt?.kind).toBe("payment");
  return command(s, { type: "PAY", ids, wildAs });
}
function find(s: GameState, id: string): Piece | undefined {
  return [
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.discard,
    ...s.player.inPlay,
    ...s.minions,
  ].find((p) => p.id === id);
}

describe("Ms. Marvel through native newGame and dispatch", () => {
  it("starts her valid exact source40-card preconstructed deck with10HP and Kamala's6-card hand", () => {
    const source = STARTER_DECKS.find(
      (deck) =>
        deck.heroCode === "05001a" &&
        deck.sourceType === "source-preconstructed",
    )!;
    const codes = catalogDeckCodes(source);
    expect(codes).toHaveLength(40);
    expect(deckErrors("ms_marvel", "protection", codes)).toEqual([]);
    expect(deckCodes("ms_marvel", "protection")).toHaveLength(40);
    const s = newGame({
      heroId: "ms_marvel",
      villainId: "rhino",
      aspect: "protection",
      heroes: [{ heroId: "ms_marvel", aspect: "protection", deckCards: codes }],
      seed: 705,
    });
    expect(s.player.hp).toBe(10);
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.form).toBe("alter");
    expect(
      [...s.player.hand, ...s.player.deck].map((p) => p.code).sort(),
    ).toEqual(codes.sort());
  });
  it("plays Big Hands, fully resolves4damage and discards before explicitly choosing Morphogenetics", () => {
    let s = base();
    const [event, resource] = hand(s, "05003", "05020");
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    expect(s.villain.hp).toBe(before - 4);
    expect(s.prompt?.title).toBe("Morphogenetics");
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.resolving).toEqual([]);
    s = choose(s, "yes");
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual([event.id]);
    expect(s.player.discard.map((p) => p.id)).toEqual([resource.id]);
  });
  it("still returns a played event whose effects Stunned cancelled, consuming the physical status once", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    const [event, resource] = hand(s, "05003", "05020");
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    expect(s.villain.hp).toBe(before);
    expect(s.player.stunned).toBe(false);
    expect(s.player.stunCards).toBe(0);
    expect(s.prompt?.title).toBe("Morphogenetics");
    s = choose(s, "yes");
    expect(s.player.hand[0].id).toBe(event.id);
  });
  it("Embiggen creates an optional choice before Big Hands, deals6 once, then forgets that source event", () => {
    let s = base();
    const upgrade = playArea(s, "05010");
    const [event, resource] = hand(s, "05003", "05020");
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    expect(s.prompt?.title).toBe("Embiggen!");
    expect(find(s, upgrade.id)!.exhausted).toBe(false);
    s = choose(s, "use");
    expect(s.villain.hp).toBe(before - 6);
    expect(s.prompt?.title).toBe("Morphogenetics");
    s = choose(s, "skip");
    expect(Object.keys(s.flags).some((key) => key.startsWith("msEvent:"))).toBe(
      false,
    );
    s.player.exhausted = true;
    const [next, payNext] = hand(s, "05003", "05020");
    s = command(s, { type: "PLAY", id: next.id });
    s = pay(s, [payNext.id]);
    expect(s.villain.hp).toBe(before - 10);
    expect(s.prompt).toBeNull();
  });
  it("Shrink removes5 threat with Sneak By and returns the actual event only after scheme defeat resolves", () => {
    let s = base();
    playArea(s, "05011");
    s.scheme.threat = 9;
    const [event, resource] = hand(s, "05004", "05020");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    s = choose(s, "use");
    expect(s.scheme.threat).toBe(4);
    expect(s.prompt?.title).toBe("Morphogenetics");
    s = choose(s, "yes");
    expect(s.player.hand[0].id).toBe(event.id);
  });
  it("Embiggen increases both sequential Melee hits, defeating Guard before allowing the villain as second target", () => {
    let s = base();
    playArea(s, "05010");
    const guard = minion(s, "01101");
    const [event, r1, r2] = hand(s, "05030", "05020", "05021");
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [r1.id, r2.id]);
    s = choose(s, "use");
    if (s.prompt?.title === "Melee · first enemy") s = choose(s, guard.id);
    expect(s.minions.some((p) => p.id === guard.id)).toBe(false);
    expect(s.villain.hp).toBe(before - 5);
    expect(s.prompt?.title).toBe("Morphogenetics");
  });
  it("Melee cannot target Rhino's next stage as its second enemy and never leaves an empty target prompt", () => {
    let s = base();
    s.villain.hp = 1;
    const [event, r1, r2] = hand(s, "05030", "05020", "05021");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [r1.id, r2.id]);
    expect(card(s.villain).stage).toBe("II");
    expect(s.villain.hp).toBe(card(s.villain).health!);
    expect(s.prompt?.title).toBe("Morphogenetics");
  });
  it("Melee resolves its entire single attack before the first enemy's lethal Retaliate", () => {
    let s = base();
    s.aspect = "aggression";
    s.player.hp = 2;
    const modok = minion(s, "01184");
    const [event, r1, r2] = hand(s, "05030", "05020", "05021");
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [r1.id, r2.id]);
    s = choose(s, modok.id);
    expect(s.minions.find((p) => p.id === modok.id)?.damage).toBe(3);
    expect(s.villain.hp).toBe(before - 3);
    expect(s.phase).toBe("lost");
    expect(s.prompt).toBeNull();
  });
  it("both Melee targets' mandatory Retaliate resolve before either optional Jarnbjorn response", () => {
    let s = base();
    s.aspect = "aggression";
    s.player.hp = 3;
    const modok = minion(s, "01184");
    const blasters = makePiece(s, "01153");
    blasters.attachedTo = s.villain.id;
    s.attachments.push(blasters);
    playArea(s, "06019");
    const [event, r1, r2] = hand(s, "05030", "05020", "05021", "05003");
    const before = s.villain.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [r1.id, r2.id]);
    s = choose(s, modok.id);
    expect(s.minions.find((p) => p.id === modok.id)?.damage).toBe(3);
    expect(s.villain.hp).toBe(before - 3);
    expect(s.prompt?.title).toBe("Forced responses");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "retaliate:0",
      "retaliate:1",
    ]);
    s = choose(s, "retaliate:0");
    expect(s.phase).toBe("lost");
    expect(s.prompt).toBeNull();
  });
  it("Tackle stun/Concussive confuse persist onto a same-character new stage before physical-paid damage", () => {
    for (const [code, field] of [
      ["05015", "stunned"],
      ["05031", "confused"],
    ] as const) {
      let s = base();
      s.villain.hp = 1;
      const [event, r1, r2] = hand(s, code, "05021", "05020");
      s = command(s, { type: "PLAY", id: event.id });
      s = pay(s, [r1.id, r2.id]);
      expect(card(s.villain).stage).toBe("II");
      expect(s.villain[field]).toBe(true);
    }
  });
  it("nonphysical Tackle remains an attack for Retaliate but Embiggen cannot invent its conditional damage", () => {
    let s = base();
    const upgrade = playArea(s, "05010");
    const retaliation = makePiece(s, "01119");
    retaliation.attachedTo = s.villain.id;
    s.attachments.push(retaliation);
    const [event, r1, r2] = hand(s, "05015", "05019", "05020");
    const hp = s.player.hp,
      enemyHp = s.villain.hp;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [r1.id, r2.id]);
    s = choose(s, "use");
    expect(find(s, upgrade.id)!.exhausted).toBe(true);
    expect(s.villain.hp).toBe(enemyHp);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.prompt?.title).toBe("Morphogenetics");
  });
  it("Aamir queues the chosen discard on the bottom and draws from the top without replacing IDs", () => {
    let s = base();
    s.player.form = "alter";
    const aamir = playArea(s, "05006");
    const discarded = owned(s, "05003"),
      top = owned(s, "05019"),
      bottom = owned(s, "05020");
    s.player.deck = [top, bottom];
    s.player.discard = [discarded];
    s = command(s, { type: "ABILITY", id: aamir.id, action: "aamir" });
    s = choose(s, discarded.id);
    expect(s.player.hand.map((p) => p.id)).toEqual([top.id]);
    expect(s.player.deck.map((p) => p.id)).toEqual([bottom.id, discarded.id]);
    expect(find(s, aamir.id)!.exhausted).toBe(true);
  });
  it("Teen Spirit stops at first signature and preserves real deck-exhaustion encounter cost", () => {
    let s = base();
    s.player.form = "alter";
    const plain = owned(s, "05019"),
      signature = owned(s, "05003");
    s.player.deck = [plain, signature];
    s = command(s, { type: "ABILITY", id: "identity", action: "teen-spirit" });
    expect(s.player.hand.map((p) => p.id)).toEqual([signature.id]);
    expect(s.player.deck.map((p) => p.id)).toEqual([plain.id]);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Bruno exposes distinct store/retrieve actions, tucks actual owned pieces and supports save reload", () => {
    let s = base();
    s.player.form = "alter";
    const bruno = playArea(s, "05007");
    const [p] = hand(s, "05003");
    s = command(s, { type: "ABILITY", id: bruno.id, action: "bruno-store" });
    s = command(s, { type: "SELECT", ids: [p.id] });
    expect(s.player.hand).toEqual([]);
    expect(find(s, bruno.id)!.storedCards?.map((p) => p.id)).toEqual([p.id]);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    find(s, bruno.id)!.exhausted = false;
    s.player.form = "hero";
    s = command(s, { type: "ABILITY", id: bruno.id, action: "bruno-retrieve" });
    s = command(s, { type: "SELECT", ids: [p.id] });
    expect(s.player.hand.map((p) => p.id)).toEqual([p.id]);
    expect(find(s, bruno.id)!.storedCards).toEqual([]);
  });
  it("discarding Bruno places his stored actual cards into their owner's discard with no duplicates", () => {
    let s = base();
    const bruno = playArea(s, "05007"),
      p = owned(s, "05003");
    bruno.storedCards = [p];
    s = native(s, { type: "discardPiece", id: bruno.id });
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      [bruno.id, p.id].sort(),
    );
  });
  it("Nakia next-card discount and Bio-Suit event-only wild are accepted by native payment", () => {
    let s = base();
    s.player.form = "alter";
    const nakia = playArea(s, "05008"),
      suit = playArea(s, "05009");
    s = command(s, { type: "ABILITY", id: nakia.id, action: "nakia" });
    s.player.form = "hero";
    const [event] = hand(s, "05003");
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.cost).toBe(1);
    expect(
      paymentSources(s, event.id, event.code).find((p) => p.id === suit.id)
        ?.resources,
    ).toEqual(["wild"]);
    s = pay(s, [suit.id], "physical");
    expect(find(s, suit.id)!.exhausted).toBe(true);
    expect(s.flags.msNakiaDiscount).toBeUndefined();
    expect(s.prompt?.title).toBe("Morphogenetics");
  });
  it("Endurance selects another player's control, moves max/current HP once and Down Time changes only REC", () => {
    let s = base(true);
    const other = s.players[1].id;
    const beforeSelf = s.player.hp,
      beforeOther = seatView(s, other).player.hp;
    const [event, resource] = hand(s, "05023", "05020");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    expect(s.prompt?.title).toBe("Endurance");
    s = choose(s, other);
    expect(s.player.hp).toBe(beforeSelf);
    expect(seatView(s, other).player.hp).toBe(beforeOther + 3);
    expect(maxHP(seatView(s, other))).toBe(13);
    s = native(s, { type: "discardPiece", id: event.id });
    expect(seatView(s, other).player.hp).toBe(beforeOther);
    const downtime = playArea(s, "05033", other);
    seatView(s, other).player.form = "alter";
    expect(heroStats(seatView(s, other)).recover).toBe(5);
    expect(find(s, downtime.id)).toBeUndefined();
  });
  it("Lockjaw is paid and played from the actual discard during the player's turn", () => {
    let s = base();
    const lockjaw = owned(s, "05018");
    s.player.discard.push(lockjaw);
    const [r1, r2] = hand(s, "05019", "05020");
    expect(playable(s, lockjaw)).toBeNull();
    s = command(s, { type: "PLAY", id: lockjaw.id });
    s = pay(s, [r1.id, r2.id]);
    expect(s.player.inPlay.some((p) => p.id === lockjaw.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === lockjaw.id)).toBe(false);
  });
  it("Thomas Edison ignores damage only with another minion engaged with his player, and Robot blanking ends with the phase", () => {
    let s = base(true);
    const edison = minion(s, "05027"),
      robot = minion(s, "05028");
    s = native(s, { type: "damage", target: edison.id, amount: 2 });
    expect(find(s, edison.id)!.damage).toBe(0);
    s.minions = s.minions.filter((p) => p.id !== robot.id);
    s = native(s, { type: "damage", target: edison.id, amount: 2 });
    expect(find(s, edison.id)!.damage).toBe(2);
    s.minions = [robot];
    const [mental] = hand(s, "05020");
    s = command(s, { type: "ABILITY", id: robot.id, action: "robot-blank" });
    s = pay(s, [mental.id]);
    s = native(s, { type: "damage", target: robot.id, amount: 2 });
    expect(find(s, robot.id)!.damage).toBe(2);
  });
  it("Harvest counts only supports actually exhausted and gives surge when all Personas were already exhausted", () => {
    let s = base();
    const persona = playArea(s, "05006");
    s.villain.hp -= 4;
    const before = s.villain.hp;
    s = native(s, { type: "reveal", piece: makePiece(s, "05029"), skip: true });
    expect(find(s, persona.id)!.exhausted).toBe(true);
    expect(s.villain.hp).toBe(before + 1);
  });
  it("Wiggle Room prevents3 non-attack damage and draws before Morph, then the remaining packet resumes", () => {
    let s = base();
    s.player.hp = 4;
    const [wiggle] = hand(s, "05005");
    const drawn = owned(s, "05019");
    s.player.deck.unshift(drawn);
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 6,
      source: "Harvest damage fixture",
    });
    s = choose(s, wiggle.id);
    expect(s.player.hp).toBe(4);
    expect(s.prompt?.title).toBe("Morphogenetics");
    expect(s.player.hand.map((p) => p.id)).toEqual([drawn.id]);
    s = choose(s, "yes");
    if (s.prompt?.options.some((o) => o.id === "allow")) s = choose(s, "allow");
    expect(s.player.hp).toBe(1);
    expect(s.player.exhausted).toBe(true);
    expect(s.phase).toBe("player");
    expect(s.player.hand.map((p) => p.id)).toContain(wiggle.id);
  });
  it("Morphogenetics permits replaying the same Wiggle Room against the same6-damage non-attack packet", () => {
    let s = base();
    const [wiggle] = hand(s, "05005");
    const before = s.player.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 6,
      source: "Fixture damage",
    });
    s = choose(s, wiggle.id);
    s = choose(s, "yes");
    expect(s.prompt?.options.some((o) => o.id === wiggle.id)).toBe(true);
    s = choose(s, wiggle.id);
    expect(s.player.hp).toBe(before);
    expect(s.player.hand).toHaveLength(2);
    expect(s.player.discard.some((p) => p.id === wiggle.id)).toBe(true);
    expect(s.prompt).toBeNull();
  });
  it("Morphogenetics permits replaying the same Wiggle Room against the same enemy attack", () => {
    let s = base();
    const [wiggle] = hand(s, "05005");
    const before = s.player.hp;
    for (const code of ["01099", "01100"]) {
      const p = makePiece(s, code);
      p.attachedTo = s.villain.id;
      s.attachments.push(p);
    }
    s.encounter.deck = [makePiece(s, "05029"), makePiece(s, "05029")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = choose(s, wiggle.id);
    s = choose(s, "yes");
    expect(s.prompt?.options.some((o) => o.id === wiggle.id)).toBe(true);
    s = choose(s, wiggle.id);
    expect(s.player.hp).toBe(before);
    expect(s.player.hand).toHaveLength(2);
    expect(s.attack).toBeNull();
  });
  it("Energy Barrier can use separate instances once per damage packet and discards each exhausted counter supply", () => {
    let s = base();
    s.player.form = "alter";
    const first = playArea(s, "05017"),
      second = playArea(s, "05017");
    first.counters = 1;
    second.counters = 3;
    const hp = s.player.hp,
      villainHp = s.villain.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "Fixture",
    });
    s = choose(s, first.id);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(first.id);
    s = choose(s, second.id);
    expect(s.prompt?.options.map((o) => o.id) || []).not.toContain(second.id);
    if (s.prompt) s = choose(s, "allow");
    expect(s.player.hp).toBe(hp - 1);
    expect(s.villain.hp).toBe(villainHp - 2);
    expect(s.player.discard.some((p) => p.id === first.id)).toBe(true);
    expect(find(s, second.id)!.counters).toBe(2);
    expect(find(s, second.id)!.exhausted).toBe(false);
  });
  it("a different Barrier and Wiggle can be ordered in the same attack without adding DEF or exhausting the hero", () => {
    let s = base();
    s.player.exhausted = true;
    const barrier = playArea(s, "05017");
    barrier.counters = 3;
    const [wiggle] = hand(s, "05005");
    const hp = s.player.hp;
    const charge = makePiece(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    s.encounter.deck = [makePiece(s, "05029"), makePiece(s, "05029")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = choose(s, barrier.id);
    s = choose(s, wiggle.id);
    if (s.prompt) s = choose(s, "resolve");
    expect(s.player.hp).toBe(hp - 1);
    expect(find(s, barrier.id)!.counters).toBe(2);
    expect(s.attack).toBeNull();
  });
  it("Wiggle Room prevents reactive Overkill damage after Lockjaw takes the attack", () => {
    let s = base();
    s.player.exhausted = true;
    const ally = playArea(s, "05018");
    const [wiggle] = hand(s, "05005");
    const charge = makePiece(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    s.encounter.deck = [makePiece(s, "05029"), makePiece(s, "05029")];
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, ally.id);
    expect(s.prompt?.options.some((o) => o.id === wiggle.id)).toBe(true);
    s = choose(s, wiggle.id);
    expect(s.player.hp).toBe(hp);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.hand).toHaveLength(1);
  });
  it("Nova may stop an attack in alter ego by killing its attacker before any boost or defense step", () => {
    let s = base();
    s.player.form = "alter";
    const nova = playArea(s, "05012"),
      attacker = minion(s, "01110");
    const [energy] = hand(s, "05005");
    const hp = s.player.hp,
      boosts = s.encounter.deck.map((p) => p.id);
    s = native(s, { type: "enemyAttack", id: attacker.id });
    expect(s.prompt?.title).toBe("Enemy initiates attack");
    s = choose(s, nova.id);
    s = pay(s, [energy.id]);
    expect(s.minions.some((p) => p.id === attacker.id)).toBe(false);
    expect(s.player.hp).toBe(hp);
    expect(s.attack).toBeNull();
    expect(s.prompt).toBeNull();
    expect(s.encounter.deck.map((p) => p.id)).toEqual(boosts);
    expect(find(s, nova.id)!.exhausted).toBe(false);
  });
  it("Nova rejects the wrong typed resource before paying and accepts Enhanced Reflexes, consuming its final counter", () => {
    let s = base();
    const nova = playArea(s, "05012"),
      reflexes = playArea(s, "05024");
    reflexes.counters = 1;
    const [wrong] = hand(s, "05003");
    s.encounter.deck = [makePiece(s, "05029"), makePiece(s, "05029")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, nova.id);
    const invalid = dispatch(s, { type: "PAY", ids: [wrong.id] });
    expect(invalid.error).toBeDefined();
    expect(invalid.player.hand.map((p) => p.id)).toEqual([wrong.id]);
    expect(find(invalid, reflexes.id)!.counters).toBe(1);
    s = pay(s, [reflexes.id]);
    s = choose(s, "take");
    expect(s.player.discard.some((p) => p.id === reflexes.id)).toBe(true);
  });
  it("Preemptive Strike cancels only numeric boost icons, keeps the star effect, and creates no basic defense reduction", () => {
    let s = base();
    s.player.exhausted = true;
    s.villain.hp -= 4;
    const villainHp = s.villain.hp,
      hp = s.player.hp;
    const [event, resource] = hand(s, "05014", "05023");
    s.encounter.deck = [makePiece(s, "01158"), makePiece(s, "05029")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    expect(s.prompt?.title).toBe("Boost card revealed");
    s = choose(s, `${s.activePlayerId}:${event.id}`);
    s = pay(s, [resource.id]);
    expect(s.villain.hp).toBe(villainHp - 1); // interrupt1damage, then HeartShapedHerb's boost star.
    expect(s.villain.tough).toBe(true);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.attack).toBeNull();
  });
  it("Preemptive Strike preserves a defending ally and refuses every other player's defense events", () => {
    let s = base(true);
    s.player.exhausted = true;
    const ally = playArea(s, "05018");
    const [event, resource] = hand(s, "05014", "05023");
    const other = seatView(s, s.players[1]);
    other.player.hand = [
      owned(s, "05014", other.activePlayerId),
      owned(s, "05023", other.activePlayerId),
    ];
    s.encounter.deck = [makePiece(s, "05025"), makePiece(s, "05029")];
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, ally.id);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      `${s.activePlayerId}:${event.id}`,
      "continue",
    ]);
    s = choose(s, `${s.activePlayerId}:${event.id}`);
    s = pay(s, [resource.id]);
    expect(s.player.hp).toBe(hp);
    expect(find(s, ally.id)!.damage).toBe(2);
    expect(s.attack).toBeNull();
  });
  it("a ready teammate's Preemptive Strike redirects an undefended attack without exhausting or applying their DEF", () => {
    let s = base(true);
    const original = s.activePlayerId,
      defender = s.players[1].id;
    const other = seatView(s, defender);
    const event = owned(s, "05014", defender),
      resource = owned(s, "05023", defender);
    other.player.hand = [event, resource];
    const originalHp = s.player.hp,
      defenderHp = other.player.hp;
    s.encounter.deck = [makePiece(s, "05025"), makePiece(s, "05029")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = choose(s, `${defender}:${event.id}`);
    s = pay(s, [resource.id]);
    expect(seatView(s, original).player.hp).toBe(originalHp);
    expect(seatView(s, defender).player.hp).toBe(defenderHp - 2);
    expect(seatView(s, defender).player.exhausted).toBe(false);
  });
  it("Red Dagger pays two different types atomically, interrupts defeat and returns its original piece after dealing2", () => {
    let s = base();
    const red = playArea(s, "05002");
    red.damage = 2;
    const [energy, mental, p1, p2] = hand(
      s,
      "05005",
      "05004",
      "05003",
      "05015",
    );
    const villainHp = s.villain.hp;
    s = native(s, {
      type: "damage",
      target: red.id,
      amount: 1,
      source: "Fixture",
    });
    s = choose(s, red.id);
    if (s.prompt?.kind === "choice") s = choose(s, "energy+mental");
    const invalid = dispatch(s, { type: "PAY", ids: [p1.id, p2.id] });
    expect(invalid.error).toBeDefined();
    expect(invalid.player.hand).toHaveLength(4);
    expect(find(invalid, red.id)!.damage).toBe(3);
    s = pay(s, [energy.id, mental.id]);
    expect(s.villain.hp).toBe(villainHp - 2);
    expect(s.player.hand.map((p) => p.id)).toContain(red.id);
    expect(s.player.inPlay.some((p) => p.id === red.id)).toBe(false);
    expect(find(s, red.id)!.damage).toBe(0);
  });
  it("Red Dagger accepts independently allocated wild resources and never uses Bio-Suit for its ally cost", () => {
    let s = base();
    const red = playArea(s, "05002"),
      suit = playArea(s, "05009");
    const [w1, w2] = hand(s, "05016", "05016");
    s = native(s, {
      type: "damage",
      target: red.id,
      amount: 3,
      source: "Fixture",
    });
    s = choose(s, red.id);
    s = choose(s, "energy+mental");
    expect(
      paymentSources(s, undefined, "05002").some((p) => p.id === suit.id),
    ).toBe(false);
    s = pay(s, [w1.id, w2.id], "physical");
    expect(find(s, red.id)!.damage).toBe(0);
    expect(s.player.hand.map((p) => p.id)).toContain(red.id);
  });
  it("same-type-only resources cannot offer Red Dagger's defeat replacement", () => {
    let s = base();
    const red = playArea(s, "05002");
    hand(s, "05003", "05015");
    s = native(s, {
      type: "damage",
      target: red.id,
      amount: 3,
      source: "Fixture",
    });
    expect(s.prompt).toBeNull();
    expect(s.player.discard.some((p) => p.id === red.id)).toBe(true);
  });
  it("round/phase boundary clears Robot immunity blanking and Nakia while Morale Boost persists through villain attacks", () => {
    let s = base();
    s.player.form = "alter";
    const nakia = playArea(s, "05008");
    s = command(s, { type: "ABILITY", id: nakia.id, action: "nakia" });
    s.player.form = "hero";
    const robot = minion(s, "05028");
    s = native(
      s,
      { type: "ms:robot-blank", id: robot.id },
      { type: "ms:morale", playerId: s.activePlayerId },
    );
    expect(heroStats(s).defense).toBe(2);
    s.encounter.deck = Array.from({ length: 30 }, () => makePiece(s, "05029"));
    s = command(s, { type: "END_TURN" });
    if (s.prompt?.options.some((o) => o.id === "hero")) s = choose(s, "hero");
    expect(s.flags.msNakiaDiscount).toBeUndefined();
    expect(s.flags[`msRobotBlank:${robot.id}`]).toBeUndefined();
    if (s.attack) expect(heroStats(s).defense).toBe(2);
  });
  it("Embiggen applies when playing the Core Counter-Punch response, without leaking into a later basic attack", () => {
    let s = base();
    const embiggen = playArea(s, "05010");
    hand(s, "01077");
    s.encounter.deck = [makePiece(s, "05029"), makePiece(s, "05029")];
    const before = s.villain.hp;
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "hero");
    s = choose(s, "counter");
    expect(s.prompt?.title).toBe("Embiggen!");
    s = choose(s, "use");
    expect(s.villain.hp).toBe(before - 3);
    expect(find(s, embiggen.id)!.exhausted).toBe(true);
    s.player.exhausted = false;
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.villain.hp).toBe(before - 4);
  });
  it("Shrink applies to You'll Pay for That played in its after-attack response window", () => {
    let s = base();
    playArea(s, "05011");
    s.scheme.threat = 7;
    const [event, resource] = hand(s, "10016", "05003");
    s.encounter.deck = [makePiece(s, "05029"), makePiece(s, "05029")];
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(s, "take");
    s = choose(s, event.id);
    s = pay(s, [resource.id]);
    expect(s.prompt?.title).toBe("Shrink");
    s = choose(s, "use");
    expect(s.scheme.threat).toBe(3);
    expect(s.prompt?.title).toBe("Morphogenetics");
  });
  it("Wiggle drawing the final player card immediately reshuffles its completed event and deals the deck-exhaustion encounter", () => {
    let s = base();
    s.player.exhausted = true;
    const [wiggle] = hand(s, "05005");
    const last = owned(s, "05019");
    s.player.deck = [last];
    s.player.discard = [];
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "Fixture",
    });
    s = choose(s, wiggle.id);
    expect(s.player.hand.map((p) => p.id)).toEqual([last.id]);
    expect(s.player.deck.map((p) => p.id)).toEqual([wiggle.id]);
    expect(s.player.discard).toEqual([]);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("reload preserves a paid event's Embiggen source context through optional target selection and Morph", () => {
    let s = base();
    playArea(s, "05010");
    const target = minion(s, "01184");
    const [event, resource] = hand(s, "05003", "05020");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [resource.id]);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = choose(s, "use");
    expect(s.prompt?.kind).toBe("choice");
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = choose(s, target.id);
    expect(find(s, target.id)!.damage).toBe(6);
    expect(s.prompt?.title).toBe("Morphogenetics");
    s = choose(s, "skip");
    expect(Object.keys(s.flags).some((key) => key.startsWith("msEvent:"))).toBe(
      false,
    );
  });
  it("reload preserves a non-attack damage packet ID, accumulated prevention and once-per-instance Barrier usage", () => {
    let s = base();
    const barrier = playArea(s, "05017");
    barrier.counters = 3;
    const [wiggle] = hand(s, "05005");
    const hp = s.player.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 5,
      source: "Fixture",
    });
    s = choose(s, barrier.id);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = choose(s, wiggle.id);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = choose(s, "skip");
    if (s.prompt) s = choose(s, "allow");
    expect(s.player.hp).toBe(hp - 1);
    expect(find(s, barrier.id)!.counters).toBe(2);
    expect(
      Object.keys(s.flags).some(
        (key) => key.startsWith("msPrevent:") || key.startsWith("msUsed:"),
      ),
    ).toBe(false);
  });
  it("Home by Dawn hides a forbidden hero-to-alter flip while All Tied Up is attached", () => {
    let s = base();
    const persona = playArea(s, "05006");
    const lock = makePiece(s, "02048");
    lock.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(lock);
    const obligation = makePiece(s, "05025");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    expect(s.prompt?.title).toBe("Home by Dawn");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["discard"]);
    s = choose(s, "discard");
    expect(s.player.form).toBe("hero");
    expect(s.player.discard.some((p) => p.id === persona.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
    expect(s.error).toBeUndefined();
  });
  it("Home by Dawn preserves its legal ready-alter-ego exhaust option under the same form lock", () => {
    let s = base();
    s.player.form = "alter";
    const lock = makePiece(s, "02048");
    lock.attachedTo = `hero:${s.activePlayerId}`;
    s.attachments.push(lock);
    const obligation = makePiece(s, "05025");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["exhaust", "discard"]);
    s = choose(s, "exhaust");
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((p) => p.id === obligation.id)).toBe(true);
  });
});
