import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sources from "../src/data/catalog-decks.json" with { type: "json" };
import {
  card,
  deckCodes,
  imageFor,
  maxHP,
  MODULES,
} from "../src/game/cards.js";
import { deckErrors } from "../src/game/decks.js";
import {
  newGame,
  dispatch,
  makePiece,
  playable,
  cardCost,
  enemyStats,
} from "../src/game/engine.js";
import { gambitCharges } from "../src/game/gambit.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
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
function base(team = false) {
  let s = newGame({
    heroId: "gambit",
    aspect: "justice",
    villainId: "rhino",
    seed: 37001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "gambit", aspect: "justice" as Aspect },
            { heroId: "spider_man", aspect: "justice" as Aspect },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    s.player.deck = physical(s);
    s.player.hand = [];
    s.player.discard = [];
    s.player.inPlay = [];
    s.player.form = "hero";
    s.player.exhausted = false;
    s.player.flipped = false;
  }
  activateSeat(s, "p1");
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01186"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 8;
  return s;
}
const ability = (s: GameState, action: string, id = "identity") =>
  command(s, { type: "ABILITY", id, action });
const charge = (s: GameState, n: number) => {
  s.flags.gambitCharges = n;
  return s;
};
function paid(s: GameState, code: string, resources = ["37022", "37023"]) {
  const [p, ...rs] = hand(s, code, ...resources);
  s = command(s, { type: "PLAY", id: p.id });
  return s.prompt?.kind === "payment" ? pay(s, rs) : s;
}
function playAttack(s: GameState, code: string, n: number, id?: string) {
  s = paid(s, code);
  if (s.prompt?.title === "Throw de Card") s = choose(s, String(n));
  return target(s, id || s.villain.id);
}
function reveal(s: GameState, code: string) {
  const p = makePiece(s, code);
  return { p, s: native(s, { type: "reveal", piece: p }) };
}
function attach(s: GameState, code: string, target: string) {
  const p = makePiece(s, code);
  p.attachedTo = target;
  s.attachments.push(p);
  return p;
}
describe("Gambit original sources and native rules", () => {
  it("closes all36faces, preserves exact40playingcards and five owned nemesis cards", () => {
    const faces = catalog.filter((c) => c.pack_code === "gambit");
    expect(faces).toHaveLength(36);
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    const src = sources.find((d) => d.heroCode === "37001a")!;
    expect(deckCodes("gambit", "justice").sort()).toEqual(
      Object.entries(src.cards)
        .flatMap(([c, n]) => Array(n).fill(c))
        .sort(),
    );
    for (const aspect of [
      "justice",
      "leadership",
      "aggression",
      "protection",
    ] as Aspect[])
      expect(deckErrors("gambit", aspect, deckCodes("gambit", aspect))).toEqual(
        [],
      );
    const s = newGame({
      heroId: "gambit",
      aspect: "justice",
      villainId: "rhino",
    });
    expect(s.player.deck.length + s.player.hand.length).toBe(40);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "37026",
      "37027",
      "37028",
      "37028",
      "37029",
    ]);
    expect(maxHP(s)).toBe(9);
    expect(imageFor("37001a")).toContain("37001b.webp");
  });
  it("includes Exodus six physical modular cards", () => {
    expect(MODULES.some((m) => m.id === "exodus")).toBe(true);
    const s = newGame({
      heroId: "gambit",
      aspect: "justice",
      villainId: "rhino",
      module: "exodus",
    });
    expect(
      s.encounter.deck
        .filter((p) => card(p).set_code === "exodus")
        .map((p) => p.code)
        .sort(),
    ).toEqual(["37032", "37033", "37034", "37034", "37035", "37035"]);
  });
  it("Charge de Card is once perround, survivesflip/reload and boosts Rogue's discount", () => {
    let s = base();
    s = ability(s, "charge-de-card");
    expect(gambitCharges(s)).toBe(1);
    expect(
      dispatch(s, { type: "ABILITY", id: "identity", action: "charge-de-card" })
        .error,
    ).toBeTruthy();
    s = command(s, { type: "FLIP" });
    expect(gambitCharges(reload(s))).toBe(1);
    expect(cardCost(s, card("37002"))).toBe(3);
    s = finish(native(s, { type: "newRound" }));
    expect(gambitCharges(s)).toBe(1);
  });
  it("Thief pays exhaust/look/discard, retains other topcard, and removesnumericboostthreat", () => {
    let s = base();
    s.player.form = "alter";
    const top = makePiece(s, "37026"),
      other = makePiece(s, "37035");
    s.encounter.deck.unshift(top, other);
    s = ability(s, "thief-extraordinaire");
    expect(s.player.exhausted).toBe(true);
    s = choose(reload(s), top.id);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(5);
    expect(s.encounter.deck[0].id).toBe(other.id);
    expect(s.encounter.discard.filter((p) => p.id === top.id)).toHaveLength(1);
  });
  it("confused still pays Thief's exhaust/look/discard cost and replaces threatremoval", () => {
    let s = base();
    s.player.form = "alter";
    s.player.confused = true;
    const top = makePiece(s, "37026");
    s.encounter.deck.unshift(top);
    s = choose(ability(s, "thief-extraordinaire"), top.id);
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(8);
    expect(s.player.confused).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === top.id)).toBe(true);
  });
  it("The Thieves Guild is optional, exhausts, and draws after clearing a scheme", () => {
    let s = base();
    s.player.form = "alter";
    s.scheme.threat = 4;
    const guild = put(s, "37003"),
      top = makePiece(s, "37026");
    s.encounter.deck.unshift(top);
    s = target(choose(ability(s, "thief-extraordinaire"), top.id), "main");
    expect(s.prompt?.title).toBe("The Thieves Guild");
    s = choose(s, "yes");
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(0);
    expect(s.player.inPlay.find((p) => p.id === guild.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.hand).toHaveLength(1);
  });
  it("Charged Card removes threecharges for7damage, ranged,piercing andoverkill", () => {
    let s = charge(base(), 3);
    const m = minion(s, "01184");
    m.damage = 4;
    m.tough = true;
    m.toughCards = 1;
    const hp = s.player.hp;
    s = finish(playAttack(s, "37006", 3, m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.villain.hp).toBe(47);
    expect(s.player.hp).toBe(hp);
    expect(gambitCharges(s)).toBe(0);
  });
  it("Royal Flush preserves the bonus across all three damage instances and gains one charge", () => {
    let s = charge(base(), 3);
    s = playAttack(s, "37007", 3);
    s = target(s, s.villain.id);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(41);
    expect(gambitCharges(s)).toBe(1);
  });
  it.each([0, 1])(
    "Royal Flush stacks Float Like a Butterfly with %i Throw de Card charges on every instance",
    (charges) => {
      let s = charge(base(), charges);
      s.villain.confused = true;
      put(s, "41017");
      s = playAttack(s, "37007", charges);
      s = target(s, s.villain.id);
      s = finish(target(s, s.villain.id));
      expect(s.villain.hp).toBe(50 - 3 * (charges + 1));
      expect(gambitCharges(s)).toBe(1);
    },
  );
  it("Honed Technique does not modify Royal Flush, even when Mental pays for the event", () => {
    let s = charge(base(), 1);
    put(s, "28017");
    s = paid(s, "37007", ["37023", "37016"]);
    s = target(choose(s, "1"), s.villain.id);
    s = target(s, s.villain.id);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(47);
    expect(gambitCharges(s)).toBe(1);
    expect(s.player.discard.some((p) => p.code === "37023")).toBe(true);
  });
  it("Throw de Card stacks with Honed Technique on a qualifying paid Aggression attack", () => {
    let s = charge(base(), 2);
    put(s, "28017");
    s = paid(s, "01054", ["37023", "37016"]);
    s = finish(target(choose(s, "2"), s.villain.id));
    // Uppercut: printed 5 damage + printed cost 3 from Honed + 2 charges.
    expect(s.villain.hp).toBe(40);
    expect(gambitCharges(s)).toBe(0);
    expect(s.player.discard.some((p) => p.code === "01054")).toBe(true);
  });
  it("Royal Flush is one attack, with sequential Tough and one Retaliate per enemy", () => {
    let s = charge(base(), 1);
    const m = minion(s, "01184");
    m.tough = true;
    m.toughCards = 1;
    const hp = s.player.hp;
    s = playAttack(s, "37007", 1, m.id);
    s = target(s, m.id);
    s = finish(target(s, m.id));
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(2);
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Molecular Acceleration adds onecharge before the paid attack eventinterrupt", () => {
    let s = base();
    s = paid(s, "37006", ["37010"]);
    expect(gambitCharges(s)).toBe(1);
    expect(s.prompt?.title).toBe("Throw de Card");
    s = finish(target(choose(s, "1"), s.villain.id));
    expect(s.villain.hp).toBe(45);
    expect(gambitCharges(s)).toBe(0);
  });
  it("stun cancels attackeffect after paid event and chargecost withno damage", () => {
    let s = charge(base(), 2);
    s.player.stunned = true;
    s = paid(s, "37006");
    s = finish(choose(s, "2"));
    expect(s.player.stunned).toBe(false);
    expect(gambitCharges(s)).toBe(0);
    expect(s.villain.hp).toBe(50);
  });
  it("Creole Charmer clearsandconfuses inalterego", () => {
    let s = base();
    s.player.form = "alter";
    s.scheme.threat = 3;
    s = finish(target(paid(s, "37009"), "main"));
    expect(s.scheme.threat).toBe(0);
    expect(s.villain.confused).toBe(true);
  });
  it("Breaking and Entering works ineitherform for Thief and Passioncopy adds1", () => {
    let s = base();
    s.player.form = "alter";
    s = finish(target(paid(s, "37015", ["37016", "37022"]), "main"));
    expect(s.scheme.threat).toBe(4);
    const other = base(true);
    activateSeat(other, "p2");
    const [event] = hand(other, "37015");
    expect(playable(other, event)).toMatch(/Spy|Thief/);
  });
  it("Operative Skill is optional and spends allthreeactual counters beforediscard", () => {
    let s = base();
    const skill = put(s, "37013");
    skill.counters = 3;
    for (let i = 0; i < 3; i++) {
      s.player.exhausted = false;
      s.scheme.threat = 8;
      s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
      s = finish(choose(s, skill.id));
      expect(s.scheme.threat).toBe(6);
    }
    expect(s.player.inPlay.some((p) => p.id === skill.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === skill.id)).toBe(true);
  });
  it("Dazzler actualentry optionallyconfuses anenemy", () => {
    let s = base();
    s = paid(s, "37012");
    s = finish(choose(s, s.villain.id));
    expect(s.villain.confused).toBe(true);
  });
  it("Professor X physicalreprint usesforcedentryand delayedrounddiscard", () => {
    let s = base();
    s = paid(s, "37017");
    s = choose(s, "confuse");
    s = finish(s);
    const id = s.player.inPlay.find((p) => p.code === "37017")!.id;
    expect(s.villain.confused).toBe(true);
    s = finish(native(s, { type: "newRound" }));
    expect(s.player.inPlay.some((p) => p.id === id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === id)).toBe(true);
  });
  it("X-Mansion physicalreprint is an actual alterego heal ability", () => {
    let s = base();
    s.player.form = "alter";
    s.player.hp = 5;
    const mansion = put(s, "37018");
    s = ability(s, "heal", mansion.id);
    s = finish(target(s, "hero:p1"));
    expect(s.player.hp).toBe(6);
    expect(s.player.inPlay.find((p) => p.id === mansion.id)?.exhausted).toBe(
      true,
    );
  });
  it("Mutant Education shufflesselected actual signatures anddrawswithXMansion", () => {
    let s = base();
    s.player.form = "alter";
    put(s, "37018");
    const p = put(s, "37006");
    s.player.inPlay = s.player.inPlay.filter((q) => q.id !== p.id);
    s.player.discard.push(p);
    s = paid(s, "37021", []);
    s = choose(s, p.id);
    if (s.prompt) s = choose(s, "done");
    s = finish(s);
    expect(s.player.discard.some((q) => q.id === p.id)).toBe(false);
    expect(
      [...s.player.deck, ...s.player.hand].filter((q) => q.id === p.id),
    ).toHaveLength(1);
    expect(s.player.hand).toHaveLength(1);
  });
  it("X-Men Instruction shuffles two physical X-Men allies, excluding other allies", () => {
    let s = base();
    s.player.form = "alter";
    const [first, second, other] = hand(s, "37011", "37012", "01084");
    s.player.hand = [];
    s.player.discard.push(first, second, other);
    s = paid(s, "37031", []);
    expect(s.prompt?.options.some((o) => o.id === other.id)).toBe(false);
    s = choose(s, first.id);
    s = finish(choose(s, second.id));
    expect(s.player.deck.some((p) => p.id === first.id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === second.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === other.id)).toBe(true);
  });
  it("Mutant Education can return an identity-specific card from another identity", () => {
    let s = base();
    s.player.form = "alter";
    const [signature] = hand(s, "01002");
    s.player.hand = [];
    s.player.discard.push(signature);
    s = paid(s, "37021", []);
    s = choose(s, signature.id);
    if (s.prompt) s = choose(s, "done");
    s = finish(s);
    expect(s.player.deck.some((p) => p.id === signature.id)).toBe(true);
  });
  it("Beauty and the Thief requires bothcharacters and gives4damage4threat", () => {
    let s = base();
    const [event] = hand(s, "37019");
    expect(playable(s, event)).toMatch(/both characters/);
    put(s, "37002");
    s = finish(target(playAttack(s, "37019", 0), "main"));
    expect(s.villain.hp).toBe(46);
    expect(s.scheme.threat).toBe(4);
  });
  it("Hit and Run copy resolves actualattack/thwart with chargebonus", () => {
    let s = charge(base(), 1);
    s = finish(target(playAttack(s, "37020", 1), "main"));
    expect(s.villain.hp).toBe(47);
    expect(s.scheme.threat).toBe(6);
  });
  it("Stealth Strike copy onlyremovesthreat ifattackdefeatstarget", () => {
    let s = base();
    const m = minion(s, "01103");
    s = finish(target(playAttack(s, "37014", 0, m.id), "main"));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.scheme.threat).toBe(6);
  });
  it("Staff's unlabelledinterrupt damage can defeat attackingminion beforeattack", () => {
    let s = base();
    const staff = put(s, "37004"),
      m = minion(s, "01103");
    m.damage = 2;
    s = native(s, { type: "enemyAttack", id: m.id });
    const option = s.prompt?.options.find((o) => o.id.endsWith(staff.id));
    expect(option).toBeTruthy();
    s = finish(choose(s, option!.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === staff.id)?.exhausted).toBe(
      true,
    );
  });
  it("Natural Agility paysdefenseevent,gainschargeand addsDEF foractualattack", () => {
    let s = charge(base(), 2);
    hand(s, "37008");
    s = native(s, { type: "enemyAttack", id: "villain" });
    s = choose(s, "hero");
    const event = s.player.hand.find((p) => p.code === "37008")!;
    s = choose(s, event.id);
    if (s.prompt?.kind === "payment") s = pay(s, []);
    s = finish(s);
    expect(gambitCharges(s)).toBe(3);
    expect(s.player.hp).toBe(9);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Guild Armor readies Gambit only afterdefendingwithoutdamage", () => {
    let s = base();
    const armor = put(s, "37005");
    s = native(s, { type: "enemyAttack", id: "villain" });
    s = choose(s, "hero");
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === armor.id) ? armor.id : undefined,
    );
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === armor.id)?.exhausted).toBe(
      true,
    );
  });
  it("Bishop gains optionalenergy when ownallydefends then spendsall with6ATKcap", () => {
    let s = base();
    const bishop = put(s, "37011"),
      ally = put(s, "37012");
    s = native(s, { type: "enemyAttack", id: "villain" });
    s = choose(s, ally.id);
    s = finish(s, (v) =>
      v.prompt?.options.some((o) => o.id === bishop.id) ? bishop.id : undefined,
    );
    expect(s.player.inPlay.find((p) => p.id === bishop.id)?.counters).toBe(1);
    s.player.inPlay.find((p) => p.id === bishop.id)!.counters = 4;
    s = target(
      command(s, { type: "ABILITY", id: bishop.id, action: "attack" }),
      s.villain.id,
    );
    s = finish(choose(s, "yes"));
    expect(s.villain.hp).toBe(44);
    expect(s.player.inPlay.find((p) => p.id === bishop.id)?.damage).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === bishop.id)?.counters).toBe(0);
  });
  it("War Room exhausts after anally defeatsminion", () => {
    let s = base();
    const room = put(s, "37030"),
      ally = put(s, "37012"),
      m = minion(s, "01103");
    m.damage = 1;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
      m.id,
    );
    s = choose(s, "yes");
    s = finish(target(s, "main"));
    expect(s.scheme.threat).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === room.id)?.exhausted).toBe(true);
  });
  it("Guild Business entersownerarea andrequiresenergy+readyalterego toremove", () => {
    let s = base();
    const r = reveal(s, "37025");
    s = finish(r.s);
    expect(s.player.inPlay.some((p) => p.id === r.p.id)).toBe(true);
    s.player.form = "alter";
    const [rsc] = hand(s, "37022");
    s = ability(s, "guild-business", r.p.id);
    s = finish(pay(s, [rsc]));
    expect(s.player.exhausted).toBe(true);
    expect(s.removed.some((p) => p.id === r.p.id)).toBe(true);
  });
  it("Shadows usesallfiveownedphysicalnemesiscards once", () => {
    let s = base();
    const ids = s.player
      .setAside!.filter((p) => card(p).set_code === "gambit_nemesis")
      .map((p) => p.id);
    s = finish(reveal(s, "01190").s);
    const all = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.encounter.deck,
      ...s.encounter.discard,
    ];
    expect(all.filter((p) => ids.includes(p.id))).toHaveLength(5);
    expect(
      new Set(all.filter((p) => ids.includes(p.id)).map((p) => p.id)).size,
    ).toBe(5);
    expect(s.minions.find((p) => p.code === "37026")?.tough).toBe(true);
  });
  it("Psionic Shield healsattachedminion instead of defeat, consumesoneshield", () => {
    let s = base();
    const m = minion(s, "01103"),
      shield = attach(s, "37034", m.id);
    s = finish(
      native(s, {
        type: "damage",
        target: m.id,
        amount: 7,
        source: "hero",
        attack: true,
      }),
    );
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(0);
    expect(s.attachments.some((p) => p.id === shield.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === shield.id)).toBe(true);
  });
  it("Psionic Shield replaces leaving after Priority Target defeat interrupts, which can recur", () => {
    let s = base();
    const m = minion(s, "01103");
    attach(s, "37034", m.id);
    const priority = makePiece(s, "33007");
    priority.attachedTo = m.id;
    priority.ownerId = "p1";
    s.player.inPlay.push(priority);
    const damage = {
      type: "damage",
      target: m.id,
      amount: 3,
      source: "hero",
      attack: true,
    };
    s = native(s, damage);
    expect(s.prompt?.title).toBe("Priority Target");
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(3);
    s = finish(choose(s, "yes"));
    expect(s.player.hand).toHaveLength(2);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(0);
    s = native(s, damage);
    expect(s.prompt?.title).toBe("Priority Target");
    s = finish(choose(s, "yes"));
    expect(s.player.hand).toHaveLength(4);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
  });
  it("Psionic Shield also resolves a printed When Defeated interrupt before healing", () => {
    let s = base();
    const m = minion(s, "32146");
    attach(s, "37034", m.id);
    s = finish(
      native(s, {
        type: "damage",
        target: m.id,
        amount: 99,
        source: "hero",
        attack: true,
      }),
    );
    expect(s.villain.tough).toBe(true);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(0);
    expect(s.flags[`magnetoDefeat:${m.id}`]).toBeUndefined();
  });
  it("Psionic Shield also replacesa nondefeat leaveplay", () => {
    let s = base();
    const m = minion(s, "01103");
    m.damage = 1;
    attach(s, "37034", m.id);
    s = finish(native(s, { type: "discardPiece", id: m.id }));
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(0);
  });
  it("Exodus searchesphysicalShield andgainsitsprintedstats", () => {
    let s = base();
    const shield = makePiece(s, "37034");
    s.encounter.discard.push(shield);
    const r = reveal(s, "37032");
    s = r.s;
    s = finish(choose(s, shield.id));
    expect(s.attachments.find((p) => p.id === shield.id)?.attachedTo).toBe(
      r.p.id,
    );
    expect(
      enemyStats(
        s,
        s.minions.find((p) => p.id === r.p.id)!,
      ).attack,
    ).toBe(2);
  });
  it("Acolyte Frenzy real boost givesbothstatuses", () => {
    let s = base();
    s.encounter.deck.unshift(makePiece(s, "37035"));
    s = finish(native(s, { type: "enemyAttack", id: "villain" }));
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
  });
});
