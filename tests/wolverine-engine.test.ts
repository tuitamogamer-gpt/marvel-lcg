import { describe, expect, it } from "vitest";
import {
  card,
  deckCodes,
  heroStats,
  maxHP,
  imageFor,
} from "../src/game/cards.js";
import {
  newGame,
  makePiece,
  nativeHeroAbilityOptions,
  playable,
  cardCost,
} from "../src/game/engine.js";
import { statusCards } from "../src/game/keywords.js";
import { seatView } from "../src/game/team.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import * as w from "../src/game/wolverine.js";
import {
  command,
  choose,
  finish,
  native,
  hand,
  put,
  minion,
  side,
  attach,
  play,
  pay,
  respond,
  reload,
} from "./dv-test-helpers.js";
import type { GameState, Piece } from "../src/game/types.js";
function start(team = false) {
  return newGame({
    heroId: "wolverine",
    aspect: "aggression",
    villainId: "rhino",
    module: "deathstrike",
    seed: 35001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "wolverine", aspect: "aggression" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
}
function base(form: "hero" | "alter" = "hero", team = false) {
  let s = start(team);
  for (let n = 0; n < s.players.length; n++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.deck.push(...v.player.hand.splice(0));
    v.player.form = seat.heroId === "wolverine" ? form : "alter";
    v.player.flipped = false;
    v.player.exhausted = false;
  }
  s.villain.hp = s.villain.maxHp = 50;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.scheme.threat = 6;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  return reload(s);
}
const claws = (s: GameState) =>
  s.player.inPlay.find((p) => p.code === "35002")!;
const clawPlay = (s: GameState, p: Piece) =>
  command(s, { type: "ABILITY", id: claws(s).id, action: p.id });
const enemyAttack = (s: GameState, id = s.villain.id) =>
  native(s, { type: "enemyAttack", id });
const noDefend = (s: GameState) =>
  finish(
    s,
    (v) =>
      v.prompt?.options.find((o) => o.id === "none" || o.id === "take")?.id,
  );

describe("Wolverine original native Hero Pack", () => {
  it("starts original forty-card deck plus one physical Claws, five physical nemesis cards and six Deathstrike cards", () => {
    let s = start();
    expect(deckCodes("wolverine", "aggression")).toHaveLength(41);
    expect(s.player.deck.length + s.player.hand.length).toBe(40);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "35002",
      "35028",
      "35029",
      "35030",
      "35030",
      "35031",
    ]);
    expect(
      s.encounter.deck.filter((p) => card(p).set_code === "deathstrike"),
    ).toHaveLength(6);
    const id = s.player.setAside!.find((p) => p.code === "35002")!.id;
    s = finish(command(s, { type: "MULLIGAN", ids: [] }));
    expect(claws(s).id).toBe(id);
    expect(s.player.setAside).toHaveLength(5);
    expect(w.WOLVERINE_SCRIPT_CODES.every(hasExecutableScript)).toBe(true);
    expect(imageFor("35001a")).toContain("35001b");
  });
  it("Claws pays printed cost, performs a real PLAY, pierces Tough, and grants Lunging Strike Overkill", () => {
    let s = base();
    const [p] = hand(s, "35010");
    const m = minion(s, "01103", s.activePlayerId, 0);
    m.tough = true;
    s.flags.discount = 2;
    const hp = s.player.hp;
    s = clawPlay(s, p);
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === m.id) ? m.id : undefined,
    );
    expect(s.player.hp).toBe(hp - 3);
    expect(claws(s).exhausted).toBe(true);
    expect(s.minions).toHaveLength(0);
    expect(s.villain.hp).toBe(45);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(
      Object.keys(s.flags).filter((k) => k.startsWith("wolverineClaws")),
    ).toHaveLength(0);
  });
  it("Tough blocks Claws full TAKE damage cost, a zero cost Attack remains legal, and Requirement remains absolute", () => {
    const s = base();
    const [p, zero, requirement] = hand(s, "35010", "06014", "28013");
    s.player.tough = true;
    minion(s);
    expect(
      nativeHeroAbilityOptions(s, claws(s).id).some((o) => o.id === p.id),
    ).toBe(false);
    expect(
      nativeHeroAbilityOptions(s, claws(s).id).some(
        (o) => o.id === requirement.id,
      ),
    ).toBe(false);
    expect(
      nativeHeroAbilityOptions(s, claws(s).id).some((o) => o.id === zero.id),
    ).toBe(true);
  });
  it("lethal Claws cost defeats identity before the event plays and leaves no grant receipt", () => {
    let s = base();
    const [p] = hand(s, "35010");
    s.player.hp = 3;
    s = clawPlay(s, p);
    expect(s.phase).toBe("lost");
    expect(s.player.hand.some((q) => q.id === p.id)).toBe(true);
    expect(s.flags[`wolverineClaws:${p.id}`]).toBeUndefined();
  });
  it("Slice and Dice is two attacks: only first gains Claws Piercing", () => {
    let s = base();
    const [p] = hand(s, "35009");
    const first = minion(s),
      second = minion(s);
    first.tough = second.tough = true;
    let chosen = 0;
    s = clawPlay(s, p);
    s = finish(s, (v) =>
      v.prompt?.title === "Slice and Dice"
        ? chosen++ === 0
          ? first.id
          : second.id
        : undefined,
    );
    expect(s.minions.some((q) => q.id === first.id)).toBe(false);
    expect(s.minions.find((q) => q.id === second.id)?.damage).toBe(0);
    expect(s.minions.find((q) => q.id === second.id)?.tough).toBe(false);
    expect(s.player.hp).toBe(7);
  });
  it("Berserker Barrage repeat pays2 damage, makes a new attack and does not inherit Claws Piercing", () => {
    let s = base();
    const [p] = hand(s, "35008");
    const first = minion(s),
      second = minion(s);
    first.tough = second.tough = true;
    let repeat = false;
    s = clawPlay(s, p);
    s = finish(s, (v) => {
      if (
        v.prompt?.title === "Berserker Barrage" &&
        v.prompt.options.some((o) => o.id === first.id)
      )
        return first.id;
      if (
        v.prompt?.title === "Berserker Barrage" &&
        v.prompt.options.some((o) => o.id === "yes") &&
        !repeat
      ) {
        repeat = true;
        return "yes";
      }
      if (v.prompt?.options.some((o) => o.id === second.id)) return second.id;
    });
    expect(s.player.hp).toBe(6);
    expect(s.minions.find((q) => q.id === second.id)?.damage).toBe(0);
    expect(s.minions.find((q) => q.id === second.id)?.tough).toBe(false);
  });
  it("Track by Scent draws two only for actual positive-to-zero threat removal", () => {
    let s = base();
    const [p, a] = hand(s, "35011", "35024");
    s.scheme.threat = 3;
    s = finish(play(s, p, [a]));
    expect(s.scheme.threat).toBe(0);
    expect(s.player.hand).toHaveLength(2);
    s = base();
    const q = hand(s, "35011", "35024");
    s.scheme.threat = 4;
    s = finish(play(s, q[0], [q[1]]));
    expect(s.scheme.threat).toBe(1);
    expect(s.player.hand).toHaveLength(0);
  });
  it("Regenerative Healing works in either form and clears both full Steady status stacks", () => {
    let s = base("alter");
    const [p, a] = hand(s, "35012", "35013");
    s.player.stunned = s.player.confused = true;
    s.player.stunCards = s.player.confuseCards = 2;
    s = choose(play(s, p, [a]), "statuses");
    s = finish(s);
    expect(statusCards(s.player, "stunned")).toBe(0);
    expect(statusCards(s.player, "confused")).toBe(0);
  });
  it("Skeleton grants4 actual/maxHP, hero ATK and basic Piercing; removal loses granted HP", () => {
    let s = base();
    const [p, a] = hand(s, "35004", "35024");
    s = finish(play(s, p, [a]));
    expect(maxHP(s)).toBe(14);
    expect(s.player.hp).toBe(14);
    expect(heroStats(s).attack).toBe(3);
    s.villain.tough = true;
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.villain.hp).toBe(47);
    s = native(s, { type: "discardPiece", id: p.id });
    expect(maxHP(s)).toBe(10);
    expect(s.player.hp).toBe(10);
  });
  it("Jubilee lasting target bonuses stack on re-entry and only boost matching basic attacks", () => {
    let s = base();
    s = native(
      s,
      { type: "wolverine:jubilee-target", target: s.villain.id },
      { type: "wolverine:jubilee-target", target: s.villain.id },
    );
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.villain.hp).toBe(44);
    s.player.exhausted = false;
    const m = minion(s);
    s = finish(command(s, { type: "BASIC", action: "attack" }), (v) =>
      v.prompt?.options.some((o) => o.id === m.id) ? m.id : undefined,
    );
    expect(s.minions.find((q) => q.id === m.id)?.damage).toBe(2);
  });
  it("Healing Factor is optional at player-phase start for Wolverine even when another seat is first", () => {
    let s = base("hero", true);
    s.player.hp = 5;
    s.turnPlayerId = "p2";
    s = native(s, { type: "wolverinePlayerPhase", actorId: "p2" });
    s = finish(respond(s, /Healing Factor/));
    expect(seatView(s, "p1").player.hp).toBe(7);
    s = native(s, { type: "beginTurn", actorId: "p1" });
    expect(seatView(s, "p1").player.hp).toBe(7);
  });
  it("Frenzy draws after actual enemy attack damage and is discarded on alter-ego flip", () => {
    let s = base();
    const frenzy = put(s, "35005");
    s = noDefend(enemyAttack(s));
    s = finish(s);
    expect(s.player.hand).toHaveLength(0);
    s = enemyAttack(s);
    s = finish(s, (v) =>
      v.prompt?.title === "Berserker Frenzy" ? "yes" : undefined,
    );
    expect(s.player.hand).toHaveLength(1);
    s = finish(command(s, { type: "FLIP" }));
    expect(s.player.discard.some((p) => p.id === frenzy.id)).toBe(true);
  });
  it('"I Got Better" replaces enemy attack defeat, readies and discards the actual upgrade', () => {
    let s = base();
    const p = put(s, "35006");
    s.player.hp = 1;
    s.player.exhausted = true;
    s = enemyAttack(s);
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === p.id) ? p.id : undefined,
    );
    expect(s.phase).not.toBe("lost");
    expect(s.player.hp).toBe(5);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("Death Factor damages at own turn end and optional basic recovery removes only one physical copy", () => {
    let s = base("alter");
    s.player.hp = 7;
    const a = attach(s, "35030", "hero:p1"),
      b = attach(s, "35030", "hero:p1");
    s = choose(command(s, { type: "BASIC", action: "recover" }), a.id);
    expect(s.player.hp).toBe(7);
    expect(s.attachments.map((p) => p.id)).toEqual([b.id]);
    expect(s.player.exhausted).toBe(true);
    s = native(s, ...w.wolverineTurnEnded(s));
    expect(s.player.hp).toBe(6);
  });
  it("Omega Red interrupt damages each controlled character; Synthesizer blocks defeat until absent", () => {
    let s = base();
    const m = minion(s, "35028");
    const ally = put(s, "35003");
    s = enemyAttack(s, m.id);
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
    s = noDefend(s);
    expect(s.player.hp).toBe(7);
    const scheme = side(s, "35029", 1);
    s = native(s, { type: "damage", target: m.id, amount: 20, source: "hero" });
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(20);
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: 1,
      action: true,
    });
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
  });
  it("Tentacle Strike snapshots already-stunned state on reveal and boost", () => {
    let s = base();
    const p = makePiece(s, "35031");
    s = finish(native(s, { type: "reveal", piece: p }));
    expect(s.player.hp).toBe(9);
    expect(s.player.stunned).toBe(true);
    s = finish(native(s, ...w.wolverineBoost(s, makePiece(s, "35031"))!));
    expect(s.player.hp).toBe(5);
  });
  it("Shadows uses owned five-card reserve, reveals Omega Red/Synthesizer and shuffles actual remaining cards", () => {
    let s = base();
    const reserve = s.player.setAside!.map((p) => p.id);
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "01190") }));
    expect(s.player.setAside).toHaveLength(0);
    expect(s.minions.some((p) => p.code === "35028")).toBe(true);
    expect(s.sideSchemes.some((p) => p.code === "35029")).toBe(true);
    for (const id of reserve)
      expect(
        [
          ...s.minions,
          ...s.sideSchemes,
          ...s.encounter.deck,
          ...s.encounter.discard,
        ].filter((p) => p.id === id),
      ).toHaveLength(1);
  });
  it("Weapon X retrieves actual last identity-specific card after deck exhaustion without manufacturing a copy", () => {
    let s = base("alter");
    const support = put(s, "35022");
    const target = s.player.deck.find((p) => p.code === "35012")!;
    s.player.discard.push(...s.player.deck.filter((p) => p.id !== target.id));
    s.player.deck = [target];
    s = finish(
      command(s, { type: "ABILITY", id: support.id, action: "weapon-x" }),
    );
    expect(s.player.hp).toBe(9);
    expect(s.player.hand.map((p) => p.id)).toEqual([target.id]);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Warrior Skill is an optional interrupt with actual Uses exhaustion", () => {
    let s = base();
    const skill = put(s, "35016");
    skill.counters = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(respond(s, /Warrior Skill/));
    expect(s.villain.hp).toBe(47);
    expect(s.player.discard.some((p) => p.id === skill.id)).toBe(true);
  });
  it("Mean Swing exhausts actual Claws and performs actual event PLAY before basic attack", () => {
    let s = base();
    const [p] = hand(s, "35019");
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(respond(s, /Mean Swing/));
    expect(s.villain.hp).toBe(45);
    expect(claws(s).exhausted).toBe(true);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.log.some((l) => l.text === "Play Mean Swing.")).toBe(true);
  });
  it("Psylocke has two counters and interrupt confuses/damages before its native basic attack", () => {
    let s = base();
    const p = put(s, "35013");
    w.wolverineCardEntered(s, p, true);
    s = command(s, { type: "ABILITY", id: p.id, action: "attack" });
    s = finish(respond(s, /Psylocke/));
    expect(s.villain.confused).toBe(true);
    expect(s.villain.hp).toBe(48);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.counters).toBe(1);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(1);
  });
  it("Outta My Way respects Guard and deals5 against Guard; Precision Strike heals only after defeat", () => {
    let s = base();
    const m = minion(s, "01101");
    const p = hand(s, "35017", "35024");
    s = finish(play(s, p[0], [p[1]]));
    expect(s.minions.some((q) => q.id === m.id)).toBe(false);
    expect(s.villain.hp).toBe(50);
    s.player.hp = 5;
    const n = minion(s, "01103", s.activePlayerId, 1);
    const q = hand(s, "35018", "35013");
    s = finish(play(s, q[0], [q[1]]), (v) =>
      v.prompt?.options.some((o) => o.id === n.id) ? n.id : undefined,
    );
    expect(s.player.hp).toBe(7);
  });
  it("Colossus discount and Weapon X/Longshot traits use current identity face", () => {
    const s = base();
    expect(cardCost(s, card("35021"))).toBe(3);
    const [p] = hand(s, "35022");
    expect(playable(s, p)).toMatch(/Mutant/);
    s.player.form = "alter";
    expect(playable(s, p)).not.toMatch(/Mutant/);
  });
  it("Lady Deathstrike Quickstrike and actual attack damage discard a random card, Hack uses printed resource count", () => {
    let s = base();
    hand(s, "35013");
    s = noDefend(native(s, { type: "reveal", piece: makePiece(s, "35034") }));
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.hp).toBe(8);
    hand(s, "35024");
    s = finish(native(s, { type: "reveal", piece: makePiece(s, "35037") }));
    expect(s.player.hp).toBe(6);
  });
  it("Seeking Vengeance finds actual Lady Deathstrike and puts rather than reveals her", () => {
    let s = base();
    const p = makePiece(s, "35034");
    s.encounter.discard.push(p);
    s = noDefend(native(s, { type: "reveal", piece: makePiece(s, "35035") }));
    expect(s.minions.some((q) => q.id === p.id)).toBe(true);
    expect(s.sideSchemes.some((q) => q.code === "35035")).toBe(true);
  });
  it("Adamantium Upgrades attaches once, grants enemy Piercing and uses three distinct required resources to remove", () => {
    let s = base();
    const p = makePiece(s, "35036");
    s = finish(native(s, { type: "reveal", piece: p }));
    expect(s.attachments.find((q) => q.id === p.id)?.attachedTo).toBe(
      s.villain.id,
    );
    s.player.tough = true;
    s = noDefend(enemyAttack(s));
    expect(s.player.hp).toBe(6);
    expect(s.player.tough).toBe(false);
    const r = hand(s, "35024", "35025", "35026");
    s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
    s = finish(pay(s, r));
    expect(s.attachments).toHaveLength(0);
  });
});

describe("Wolverine pack shared timing and source conservation", () => {
  it("Command Center belongs to its controller and responds to a teammate ally defeating a side scheme", () => {
    let s = base("hero", true);
    const center = put(s, "35032", "p2"),
      ally = put(s, "35013"),
      scheme = side(s, "01107", 2);
    s = command(s, { type: "ABILITY", id: ally.id, action: "thwart" });
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === scheme.id)
        ? scheme.id
        : v.prompt?.title === "Command Center" &&
            v.prompt.options.some((o) => o.id === "yes")
          ? "yes"
          : undefined,
    );
    expect(s.villain.hp).toBe(48);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === center.id)
        ?.exhausted,
    ).toBe(true);
    expect(s.activePlayerId).toBe(s.turnPlayerId);
  });
  it("Logan's Cabin shuffles the selected actual Wolverine card and is unavailable in hero form", () => {
    let s = base("alter");
    const cabin = put(s, "35007"),
      p = hand(s, "35012")[0];
    s.player.hand = [];
    s.player.discard.push(p);
    s = finish(command(s, { type: "ABILITY", id: cabin.id, action: p.id }));
    expect(s.player.deck.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.discard).toHaveLength(0);
    expect(s.player.inPlay.find((q) => q.id === cabin.id)?.exhausted).toBe(
      true,
    );
  });
  it("Sunfire requires actual PLAY from hand, pays one Energy, and discards its selected actual removable attachment", () => {
    let s = base();
    const attachment = attach(s, "01100", s.villain.id),
      [sunfire, resource, energy] = hand(s, "35014", "35025", "35024");
    s = play(s, sunfire, [resource]);
    s = respond(s, /Sunfire/);
    s = pay(s, [energy]);
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === attachment.id)
        ? attachment.id
        : undefined,
    );
    expect(s.attachments).toHaveLength(0);
    expect(s.encounter.discard.some((p) => p.id === attachment.id)).toBe(true);
  });
  it("Sunfire PUT does not resolve its hand-play response", () => {
    let s = base();
    attach(s, "01100", s.villain.id);
    const p = makePiece(s, "35014");
    s.player.inPlay.push(p);
    expect(w.wolverineCardEntered(s, p, false)).toEqual([]);
  });
  it("Longshot discards a real top encounter card and defeats only an attacked surviving non-Elite minion on a star", () => {
    let s = base();
    const ally = put(s, "35033"),
      m = minion(s, "01130"),
      boost = makePiece(s, "35031");
    s.encounter.deck.unshift(boost);
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === m.id)
        ? m.id
        : v.prompt?.title === "Longshot"
          ? "yes"
          : undefined,
    );
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(
      card(ally).attack_cost,
    );
  });
  it("Battle Fury gives native1 damage and ready only after an actual hero attack minion defeat", () => {
    let s = base();
    const fury = put(s, "35015"),
      m = minion(s, "01103", s.activePlayerId, 1);
    s = command(s, { type: "BASIC", action: "attack" });
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === m.id)
        ? m.id
        : v.prompt?.title === "Battle Fury"
          ? "yes"
          : undefined,
    );
    expect(s.player.hp).toBe(9);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === fury.id)).toBe(true);
  });
  it("Fastball Special checks both named characters and uses their actual total ATK with Overkill and Piercing", () => {
    let s = base();
    const colossus = put(s, "35021");
    colossus.bonusAtk = 2;
    const [p, r] = hand(s, "35023", "35013");
    s.villain.tough = true;
    s = finish(play(s, p, [r]));
    expect(s.villain.hp).toBe(43);
  });
  it("Aggressive Energy increases both Slice and Dice attacks while Warrior Skill increases one selected attack", () => {
    let s = base();
    const [p, a, r] = hand(s, "35009", "35020", "35024");
    s = play(s, p, [a, r]);
    s = finish(s, (v) =>
      v.prompt?.title === "Aggressive Energy" ? "yes" : undefined,
    );
    expect(s.villain.hp).toBe(42);
    s = base();
    const skill = put(s, "35016");
    skill.counters = 3;
    const q = hand(s, "35009", "35024", "35013");
    let used = false;
    s = play(s, q[0], q.slice(1));
    s = finish(s, (v) => {
      const option = v.prompt?.options.find((o) => o.image === "35016");
      if (option && !used) {
        used = true;
        return option.id;
      }
    });
    expect(s.villain.hp).toBe(43);
    expect(s.player.inPlay.find((p) => p.id === skill.id)?.counters).toBe(2);
  });
  it("Warrior Skill buffs both damage instances of one Melee attack", () => {
    let s = base();
    const skill = put(s, "35016");
    skill.counters = 3;
    const first = minion(s, "01102"),
      second = minion(s, "01102");
    first.tough = second.tough = false;
    const [p, r, t] = hand(s, "05030", "35024", "35013");
    let selected = 0,
      used = false;
    s = play(s, p, [r, t]);
    s = finish(s, (v) => {
      const option = v.prompt?.options.find((o) => o.image === "35016");
      if (option && !used) {
        used = true;
        return option.id;
      }
      if (
        v.prompt?.options.some((o) => o.id === first.id || o.id === second.id)
      ) {
        return selected++ === 0 ? first.id : second.id;
      }
    });
    expect(s.minions.some((p) => p.id === first.id)).toBe(false);
    expect(s.minions.some((p) => p.id === second.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === skill.id)?.counters).toBe(2);
  });
  it("Past Demons can choose both statuses without flipping and can remove by exhausting Logan", () => {
    let s = base();
    const obligation = makePiece(s, "35027");
    s = native(s, { type: "reveal", piece: obligation });
    s = choose(s, "stay");
    s = finish(choose(s, "statuses"));
    expect(s.player.stunned && s.player.confused).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
    s = base("alter");
    const other = makePiece(s, "35027");
    s = finish(choose(native(s, { type: "reveal", piece: other }), "remove"));
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((p) => p.id === other.id)).toBe(true);
  });
  it('"I Got Better" cannot replace nonattack damage defeat', () => {
    let s = base();
    put(s, "35006");
    s.player.hp = 1;
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    expect(s.phase).toBe("lost");
    expect(s.prompt).toBeNull();
  });
  it("full-health Death Factor recovery is legal and discards the chosen physical attachment", () => {
    let s = base("alter");
    const p = attach(s, "35030", "hero:p1");
    s = finish(choose(command(s, { type: "BASIC", action: "recover" }), p.id));
    expect(s.player.hp).toBe(10);
    expect(s.attachments).toHaveLength(0);
  });
});

describe("Wolverine precise printed boundaries", () => {
  it("Sunfire cannot select an attachment whose effective text is blank", () => {
    let s = base();
    const a = attach(s, "01100", s.villain.id);
    s.flags[`novaIronheartPackBlank:${a.id}`] = s.round;
    const [p, r] = hand(s, "35014", "35024");
    s = finish(play(s, p, [r]));
    expect(s.attachments.some((q) => q.id === a.id)).toBe(true);
    expect(s.prompt).toBeNull();
  });
  it("a blanked enemy still receives unblanked Adamantium Upgrades Piercing", () => {
    let s = base();
    const m = minion(s, "35034");
    attach(s, "35036", m.id);
    s.flags[`novaIronheartPackBlank:${m.id}`] = s.round;
    s.player.tough = true;
    hand(s, "35012");
    s = noDefend(enemyAttack(s, m.id));
    expect(s.player.hp).toBe(6);
    expect(s.player.hand).toHaveLength(1);
  });
  it("Lady Deathstrike discards the original owner's card when a transferred ally takes attack damage", () => {
    let s = base("hero", true);
    const ally = makePiece(s, "35021");
    ally.ownerId = "p2";
    ally.tough = false;
    s.player.inPlay.push(ally);
    hand(s, "35012");
    const other = makePiece(s, "01005");
    other.ownerId = "p2";
    seatView(s, "p2").player.hand.push(other);
    const m = minion(s, "35034");
    s = enemyAttack(s, m.id);
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === ally.id) ? ally.id : undefined,
    );
    expect(seatView(s, "p1").player.hand).toHaveLength(1);
    expect(seatView(s, "p2").player.hand).toHaveLength(0);
  });
  it("Claws first replaced Slice attack does not grant Piercing to its second attack", () => {
    let s = base();
    s.player.stunned = true;
    s.villain.tough = true;
    const [p] = hand(s, "35009");
    s = finish(clawPlay(s, p));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.tough).toBe(false);
    expect(s.villain.hp).toBe(50);
  });
  it("ordinary Lunging Strike gains no Overkill from Claws exhausted by another ability", () => {
    let s = base();
    claws(s).exhausted = true;
    const m = minion(s, "01103");
    const [p, a, b] = hand(s, "35010", "35024", "35013");
    s = finish(play(s, p, [a, b]), (v) =>
      v.prompt?.options.some((o) => o.id === m.id) ? m.id : undefined,
    );
    expect(s.villain.hp).toBe(50);
  });
});
