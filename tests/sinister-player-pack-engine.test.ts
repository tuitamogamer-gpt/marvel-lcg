/** Independent native acceptance. Every command reloads JSON and uses the real
 * Ghost/Miles metadata and native engine. Optional fixture cards are explicitly
 * owned original printed cards; both forty-card starter sources remain intact. */
import { describe, expect, it } from "vitest";
import { card, handSize, heroStats, maxHP } from "../src/game/cards.js";
import {
  makePiece,
  newGame,
  dispatch,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  conserved,
  finish,
  hand,
  minion,
  native,
  owned,
  pay,
  physical,
  play,
  put,
  respond,
  reload,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

type Identity = "ghost_spider" | "spider_man_morales";
type SourceState = GameState & { dvSourceIds?: Record<string, string[]> };
function base(
  heroId: Identity = "ghost_spider",
  team = false,
  villainId = "rhino",
) {
  const ghost = { heroId: "ghost_spider", aspect: "protection" as const },
    miles = { heroId: "spider_man_morales", aspect: "justice" as const };
  let s = newGame({
    ...(heroId === "ghost_spider" ? ghost : miles),
    villainId,
    seed: 27190,
    pacing: "expert",
    ...(team ? { heroes: [ghost, miles] } : {}),
  });
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  const obligations = s.encounter.deck.filter((p) =>
    ["27025", "27056"].includes(p.code),
  );
  for (const seat of s.players) {
    const v = seatView(s, seat),
      source = physical(s, seat.id);
    expect(source).toHaveLength(40);
    expect(new Set(source.map((p) => p.id)).size).toBe(40);
    source.forEach((p) => (p.ownerId = seat.id));
    v.player.deck = source;
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.form = "hero";
    v.player.flipped = v.player.exhausted = false;
  }
  s.prompt = s.review = null;
  s.queue = [];
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [
    ...Array.from({ length: 20 }, () => makePiece(s, "01104")),
    ...obligations,
  ];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as SourceState).dvSourceIds = Object.fromEntries(
    s.players.map((seat) => [seat.id, physical(s, seat.id).map((p) => p.id)]),
  );
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  return s;
}
function select(s: GameState, id: string) {
  return choose(
    until(s, (v) => !!v.prompt?.options.some((o) => o.id === id)),
    id,
  );
}
function byCard(s: GameState, code: string) {
  const name = card(code).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return respond(s, new RegExp(name, "i"), code);
}
function stored(s: GameState, george: Piece, event: Piece) {
  s = command(s, { type: "ABILITY", id: george.id, action: "george-store" });
  return select(s, event.id);
}
function originalDiscard(s: GameState, code: string) {
  const p = top(s, code);
  expect(s.player.deck.shift()?.id).toBe(p.id);
  s.player.discard.push(p);
  return p;
}
function repeatPosition() {
  let s = base("ghost_spider", true);
  const first = originalDiscard(s, "27012"),
    [verse, energy] = hand(s, "27018", "27020");
  activateSeat(s, "p2");
  s.player.form = "alter";
  const ready = put(s, "27049"),
    second = owned(s, "27017");
  s.player.discard.push(second);
  const [a, b] = hand(s, "27042", "27043"),
    power = owned(s, "13024");
  s.player.hand.push(power);
  activateSeat(s, "p1");
  s = play(s, verse, [energy]);
  s = select(s, "hero:p1");
  s = select(s, first.id);
  s = select(s, "p2");
  expect(s.prompt?.kind).toBe("payment");
  return { s, verse, first, ready, second, a, b, power };
}

describe("native Jump Flip real damage and actual paid defense PLAY", () => {
  it("prevents nonattack damage, uses only actual FOR Energy, and creates no basic defense receipt", () => {
    let s = base();
    const source = physical(s),
      [jump, energy, kick, genius] = hand(
        s,
        "27014",
        "27020",
        "27002",
        "27021",
      );
    s.player.exhausted = true;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: "environment",
    });
    s = byCard(s, "27014");
    s = pay(s, [energy]);
    expect(s.attack).toBeFalsy();
    expect(s.prompt?.options.some((o) => o.image === "27002")).toBeFalsy();
    s = finish(s);
    expect(s.player.hp).toBe(8);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual([kick.id, genius.id]);
    expect(s.player.discard.some((p) => p.id === jump.id)).toBe(true);
    conserved(s, source);
  });
  it("an overpaid Energy card grants no bonus when the actual one FOR-card resource is Mental", () => {
    let s = base();
    const [jump, mental, energy] = hand(s, "27014", "27021", "27020");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "environment",
    });
    s = byCard(s, "27014");
    s = pay(s, [mental, energy]);
    expect(s.prompt?.title).toMatch(/Allocate payment resources/);
    s = choose(s, "mental");
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.scheme.threat).toBe(6);
    expect(s.player.discard.filter((p) => p.id === jump.id)).toHaveLength(1);
  });
  it("George's actual stored Jump Flip PLAY opens Bracelet and Flow Like Water against the real attacker", () => {
    let s = base();
    const source = physical(s),
      george = put(s, "27007"),
      bracelet = put(s, "27009"),
      flow = put(s, "26016"),
      [jump, energy] = hand(s, "27014", "27020");
    s = stored(s, george, jump);
    expect(paymentSources(s).some((p) => p.id === jump.id)).toBe(false);
    const enemy = minion(s, "01172");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = select(s, "take");
    s = byCard(s, "27014");
    s = pay(s, [energy]);
    s = byCard(s, "26016");
    s = byCard(s, "27009");
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(
      s.player.inPlay.find((p) => p.id === george.id)?.storedCards,
    ).toEqual([]);
    expect(s.player.inPlay.find((p) => p.id === bracelet.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.some((p) => p.id === flow.id)).toBe(true);
    expect(s.player.discard.filter((p) => p.id === jump.id)).toHaveLength(1);
    conserved(s, source);
  });
  it("a nonattack Jump Flip PLAY cannot make Flow Like Water damage a retained unrelated enemy", () => {
    let s = base();
    put(s, "26016");
    const [jump, energy] = hand(s, "27014", "27020"),
      enemy = minion(s, "01172");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 3,
      source: "environment",
    });
    s = byCard(s, "27014");
    s = pay(s, [energy]);
    s = finish(s);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(0);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hp).toBe(9);
    expect(s.player.discard.some((p) => p.id === jump.id)).toBe(true);
  });
});

describe("native Government Liaison, Young Love and recursive contributor payment", () => {
  it("Government Liaison pays an actual George-stored SHIELD event PLAY without exposing storage as resources", () => {
    let s = base();
    const source = physical(s),
      george = put(s, "27007"),
      gov = put(s, "27054"),
      team = put(s, "01064"),
      [homeland] = hand(s, "27042");
    team.counters = 3;
    s = stored(s, george, homeland);
    expect(paymentSources(s).some((p) => p.id === homeland.id)).toBe(false);
    s = command(s, {
      type: "ABILITY",
      id: gov.id,
      action: "government-liaison",
    });
    s = select(s, homeland.id);
    s = select(s, team.id);
    s = select(s, "done");
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(4);
    expect(s.player.inPlay.find((p) => p.id === gov.id)?.exhausted).toBe(true);
    expect(
      s.player.inPlay.find((p) => p.id === george.id)?.storedCards,
    ).toEqual([]);
    expect(s.player.discard.filter((p) => p.id === homeland.id)).toHaveLength(
      1,
    );
    conserved(s, source);
  });
  it("Young Love heals both real chosen identities across players and current hero faces", () => {
    let s = base("ghost_spider", true);
    const source = physical(s),
      other = physical(s, "p2"),
      [love, energy] = hand(s, "27019", "27020");
    s.player.form = "alter";
    s.player.hp = 6;
    seatView(s, "p2").player.hp = 5;
    s = finish(play(s, love, [energy]));
    expect(s.player.hp).toBe(9);
    expect(seatView(s, "p2").player.hp).toBe(8);
    expect(seatView(s, "p2").player.form).toBe("hero");
    conserved(s, source);
    conserved(s, other, "p2");
  });
  it("Young Love cannot be PLAYed when both named characters have no damage to heal", () => {
    const s = base("ghost_spider", true),
      [love, energy] = hand(s, "27019", "27020");
    s.player.form = "alter";
    expect(playable(s, love)).toMatch(/damage|heal|effect/i);
    expect(s.player.hand.map((p) => p.id)).toEqual([love.id, energy.id]);
  });
  it("Across repeats in a selected alter-ego seat, pays an ability cost and restores the original event controller", () => {
    const p = repeatPosition();
    let s = p.s;
    const power = paymentSources(
      s,
      s.prompt!.card?.id,
      s.prompt!.paymentTarget,
    ).find((v) => v.id === p.power.id);
    expect(power?.resources).toHaveLength(1);
    s = pay(s, [p.power, p.a, p.b], "energy");
    s = select(s, p.ready.id);
    s = select(s, p.second.id);
    expect(s.prompt?.options.some((o) => o.id === "p1")).toBe(true);
    s = select(s, "pass");
    s = finish(s);
    expect(s.activePlayerId).toBe("p1");
    expect(s.player.inPlay.some((v) => v.id === p.first.id)).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.find((v) => v.id === p.ready.id)
        ?.exhausted,
    ).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.find((v) => v.id === p.second.id)
        ?.ownerId,
    ).toBe("p2");
    expect(seatView(s, "p2").player.discard.map((v) => v.id)).toEqual(
      expect.arrayContaining([p.power.id, p.a.id, p.b.id]),
    );
    expect(s.player.discard.filter((v) => v.id === p.verse.id)).toHaveLength(1);
  });
  it("canceling Across contribution spends nothing and retains the contributor's actual exhaustion and PUT sources", () => {
    const p = repeatPosition();
    let s = command(p.s, { type: "CANCEL" });
    s = finish(s);
    expect(s.activePlayerId).toBe("p1");
    expect(
      seatView(s, "p2").player.inPlay.find((v) => v.id === p.ready.id)
        ?.exhausted,
    ).toBe(false);
    expect(
      seatView(s, "p2").player.discard.some((v) => v.id === p.second.id),
    ).toBe(true);
    expect(seatView(s, "p2").player.hand.map((v) => v.id)).toEqual(
      expect.arrayContaining([p.power.id, p.a.id, p.b.id]),
    );
  });
});

describe("native printed additional costs and consequential Interrupts", () => {
  it("Return the Favor retains its real paid reveal when Wicked Ambitions puts a Guard into play before the attack", () => {
    let s = base("ghost_spider", false, "mutagen_formula");
    const source = physical(s),
      [favor] = hand(s, "27015"),
      wicked = makePiece(s, "02032"),
      guard = makePiece(s, "02024"),
      neutral = makePiece(s, "01104");
    s.encounter.deck.unshift(wicked, guard, neutral);
    expect(playable(s, favor)).toBeNull();
    s = play(s, favor);
    s = select(s, "minion");
    s = finish(s);
    expect(s.minions.find((p) => p.id === guard.id)?.engagedWith).toBe("p1");
    expect(s.villain.hp).toBe(50);
    expect(s.encounter.discard.filter((p) => p.id === wicked.id)).toHaveLength(
      1,
    );
    expect(s.player.discard.filter((p) => p.id === favor.id)).toHaveLength(1);
    conserved(s, source);
  });
  it("Homeland cannot PLAY with zero threat even while Confused, and Global Logistics remains legal", () => {
    const s = base("spider_man_morales"),
      source = physical(s),
      gov = put(s, "27054"),
      [home, logistics] = hand(s, "27042", "27043");
    s.scheme.threat = 0;
    s.player.confused = true;
    expect(playable(s, home)).toMatch(/scheme with threat/);
    expect(playable(s, logistics)).toBeNull();
    expect(s.player.inPlay.find((p) => p.id === gov.id)?.exhausted).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual([home.id, logistics.id]);
    conserved(s, source);
  });
  it("two controlled-player Helicarriers reduce What Doesn't Kill Me to zero without removing its Physical Requirement", () => {
    let s = base("ghost_spider", true);
    const [event, strength] = hand(s, "27016", "27022"),
      one = put(s, "01092", "p1"),
      two = put(s, "01092", "p2");
    s.player.hp = 8;
    s.player.exhausted = true;
    s = command(s, { type: "ABILITY", id: one.id });
    s = finish(target(s, "p1"));
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    s = command(s, { type: "ABILITY", id: two.id });
    s = finish(target(s, "p1"));
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.cost).toBe(0);
    expect(s.prompt?.requirements).toEqual(["physical"]);
    const refused = dispatch(reload(s), { type: "PAY", ids: [] });
    expect(refused.error).toMatch(/physical|requirement/i);
    expect(refused.player.hp).toBe(8);
    expect(refused.player.exhausted).toBe(true);
    s = finish(pay(s, [strength], "physical"));
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(false);
  });
  it("Return the Favor reveals the exact discarded treachery as cost before Stun replaces the attack", () => {
    let s = base();
    const source = physical(s),
      [favor] = hand(s, "27015"),
      nonTreachery = makePiece(s, "01103"),
      advance = makePiece(s, "01186");
    s.player.stunned = true;
    s.scheme.threat = 2;
    s.encounter.deck.unshift(nonTreachery, advance);
    s = finish(play(s, favor));
    expect(s.scheme.threat).toBe(3);
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(
      s.encounter.discard.filter((p) => p.id === nonTreachery.id),
    ).toHaveLength(1);
    expect(s.encounter.discard.filter((p) => p.id === advance.id)).toHaveLength(
      1,
    );
    expect(s.player.discard.filter((p) => p.id === favor.id)).toHaveLength(1);
    conserved(s, source);
  });
  it("What Doesn't Kill Me requires actual Physical spending and heals exactly two before the ready benefit", () => {
    let s = base();
    const source = physical(s),
      [event, strength] = hand(s, "27016", "27022");
    s.player.hp = 8;
    s.player.exhausted = true;
    s = finish(play(s, event, [strength]));
    expect(s.player.hp).toBe(10);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([event.id, strength.id]),
    );
    conserved(s, source);
    const [second, energy] = hand(s, "27016", "27020");
    s.player.hp = 8;
    s.player.exhausted = true;
    expect(playable(s, second)).toMatch(
      /Physical|physical|resource|requirement/i,
    );
    expect(s.player.hand.some((p) => p.id === energy.id)).toBe(true);
  });
  it("Field Agent enters with three backups and prevents only the actual SHIELD ally consequential packet", () => {
    let s = base("spider_man_morales"),
      [field, energy] = hand(s, "27044", "27051");
    s = finish(play(s, field, [energy]));
    expect(s.player.inPlay.find((p) => p.id === field.id)?.counters).toBe(3);
    const ally = put(s, "27046");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, s.villain.id);
    s = byCard(s, "27044");
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === field.id)).toMatchObject({
      counters: 2,
      exhausted: true,
    });
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    s.player.inPlay.find((p) => p.id === field.id)!.exhausted = false;
    s = finish(
      native(s, {
        type: "damage",
        target: ally.id,
        amount: 1,
        source: "additional-cost",
      }),
    );
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === field.id)).toMatchObject({
      counters: 2,
      exhausted: false,
    });
  });
  it("Dugan's actual basic-use bonus expires before the next use and commits distinct real SHIELD exhaustion", () => {
    let s = base("spider_man_morales");
    const dugan = put(s, "27047"),
      a = put(s, "27054"),
      b = put(s, "27045");
    b.counters = 3;
    s = command(s, { type: "ABILITY", id: dugan.id, action: "attack" });
    s = byCard(s, "27047");
    s = select(s, a.id);
    s = select(s, b.id);
    s = select(s, "done");
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(45);
    expect(s.player.inPlay.find((p) => p.id === dugan.id)?.damage).toBe(2);
    expect(
      s.player.inPlay
        .filter((p) => [a.id, b.id].includes(p.id))
        .every((p) => p.exhausted),
    ).toBe(true);
    s.player.inPlay.find((p) => p.id === dugan.id)!.exhausted = false;
    s = command(s, { type: "ABILITY", id: dugan.id, action: "attack" });
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(42);
    expect(s.player.inPlay.find((p) => p.id === dugan.id)?.damage).toBe(4);
  });
  it("spending Field Agent's last actual backup discards that same source after preventing consequential damage", () => {
    let s = base("spider_man_morales");
    const source = physical(s),
      [field, energy] = hand(s, "27044", "27051");
    s = finish(play(s, field, [energy]));
    s.player.inPlay.find((p) => p.id === field.id)!.counters = 1;
    const ally = put(s, "27046");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = target(s, s.villain.id);
    s = byCard(s, "27044");
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === field.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === field.id)).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
    conserved(s, source);
  });
  it("actual Across PUT of Silk and Miles never fires their PLAY-from-hand responses", () => {
    let s = base();
    const source = physical(s),
      silk = originalDiscard(s, "27010"),
      miles = originalDiscard(s, "27011"),
      [verse, energy, a, b, c] = hand(
        s,
        "27018",
        "27020",
        "27015",
        "27015",
        "27015",
      );
    const encounterIds = s.encounter.deck.map((p) => p.id);
    s = play(s, verse, [energy]);
    s = select(s, "hero:p1");
    s = select(s, silk.id);
    s = select(s, "p1");
    s = pay(s, [a, b, c]);
    s = select(s, silk.id);
    s = select(s, miles.id);
    s = select(s, "pass");
    s = finish(s);
    expect(s.player.inPlay.map((p) => p.id)).toEqual(
      expect.arrayContaining([silk.id, miles.id]),
    );
    expect(s.villain.stunned).toBe(false);
    expect(s.villain.confused).toBe(false);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(encounterIds);
    expect(s.encounter.discard).toEqual([]);
    conserved(s, source);
  });
});

describe("native physical ally leave windows and optional player hazards", () => {
  it("Hobie discards actual three numeric boost cards before his leave and Web Life draws afterward", () => {
    let s = base();
    const source = physical(s),
      hobie = put(s, "27017"),
      life = put(s, "27023");
    hobie.damage = 2;
    const a = makePiece(s, "01191"),
      b = makePiece(s, "01131"),
      c = makePiece(s, "27029");
    s.encounter.deck.unshift(a, b, c);
    s = command(s, { type: "ABILITY", id: hobie.id, action: "attack" });
    s = target(s, s.villain.id);
    s = byCard(s, "27017");
    s = byCard(s, "27023");
    s = select(s, "p1");
    s = finish(s);
    expect(s.villain.hp).toBe(46);
    expect(s.encounter.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining([a.id, b.id, c.id]),
    );
    expect(s.player.discard.filter((p) => p.id === hobie.id)).toHaveLength(1);
    expect(s.player.hand).toHaveLength(1);
    expect(s.player.inPlay.some((p) => p.id === life.id)).toBe(true);
    conserved(s, source);
  });
  it("Gwen's before-leave search adds the actual identity event ID before owner-aware discard", () => {
    let s = base("spider_man_morales");
    const source = physical(s),
      gwen = put(s, "27048"),
      event = top(s, "27034");
    gwen.damage = 2;
    s = command(s, { type: "ABILITY", id: gwen.id, action: "thwart" });
    s = target(s, "main");
    s = byCard(s, "27048");
    s = select(s, event.id);
    s = finish(s);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.discard.filter((p) => p.id === gwen.id)).toHaveLength(1);
    conserved(s, source);
  });
  it("Suit changes every basic power including REC and actual hand/HP in both identity forms", () => {
    let s = base();
    const source = physical(s),
      [suit, energy, genius] = hand(s, "27191", "27020", "27021");
    s.player.hp = 6;
    s = finish(play(s, suit, [energy, genius]));
    expect(heroStats(s)).toMatchObject({
      attack: 3,
      thwart: 2,
      defense: 4,
      recover: 4,
    });
    expect(maxHP(s)).toBe(20);
    expect(s.player.hp).toBe(16);
    expect(handSize(s)).toBe(6);
    s = finish(command(s, { type: "FLIP" }));
    expect(heroStats(s).recover).toBe(4);
    expect(maxHP(s)).toBe(20);
    expect(handSize(s)).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === suit.id)?.code).toBe("27191");
    conserved(s, source);
  });
  it("a Suit controlled by p2 deals its extra hazard card to first player p1", () => {
    let s = base("ghost_spider", true);
    const one = physical(s),
      two = physical(s, "p2");
    activateSeat(s, "p2");
    put(s, "27191");
    s.encounter.deck.unshift(
      ...Array.from({ length: 6 }, () => makePiece(s, "01101")),
    );
    s = finish(native(s, { type: "dealEncounters" }));
    expect(s.minions.filter((p) => p.dealtTo === "p1")).toHaveLength(2);
    expect(s.minions.filter((p) => p.dealtTo === "p2")).toHaveLength(1);
    conserved(s, one, "p1");
    conserved(s, two, "p2");
  });
  it.each([false, true])(
    "Venom counts the actual star icon after a paid dealt-damage cost, lethal=%s",
    (lethal) => {
      let s = base();
      const venom = put(s, "27190"),
        revealed = makePiece(s, "01131");
      venom.damage = lethal ? 5 : 0;
      if (!lethal) {
        venom.tough = true;
        venom.toughCards = 1;
      }
      s = native(s, { type: "reveal", piece: revealed });
      s = byCard(s, "27190");
      s = target(s, s.villain.id);
      s = finish(s);
      expect(s.villain.hp).toBe(49);
      expect(s.minions.filter((p) => p.id === revealed.id)).toHaveLength(1);
      if (lethal)
        expect(s.player.discard.filter((p) => p.id === venom.id)).toHaveLength(
          1,
        );
      else
        expect(s.player.inPlay.find((p) => p.id === venom.id)).toMatchObject({
          damage: 0,
          tough: false,
        });
    },
  );
});
