/** Dedicated native text effects observed through actual Vivian PLAY/PAY and
 * JSON reloads. Printed stat fields and established delayed effects survive. */
import { describe, expect, it } from "vitest";
import { card, heroStats, maxHP, pieceHP } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { dispatch, makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  antManEnemyActivated,
  antManEnemyRetaliate,
  antManEnemyStats,
} from "../src/game/ant-man.js";
import { waspBasicAttackCost, waspEnemyHP } from "../src/game/wasp.js";
import {
  gamoraCanRemoveThreat,
  gamoraIdentityBlank,
} from "../src/game/gamora.js";
import {
  valkyrieBeguiledController,
  valkyrieBeguiledEnemy,
} from "../src/game/valkyrie.js";
import { hawkeyeEnemyAttackTraits } from "../src/game/hawkeye.js";
import { rocketEnemyStats } from "../src/game/rocket.js";
import {
  goblinIdentityLocked,
  goblinModuleAttackResponses,
  goblinWhenRevealedCopies,
} from "../src/game/goblin-modules.js";
import {
  choose,
  command,
  native,
  passId,
  play,
  reload,
  target,
  until,
} from "./dv-test-helpers.js";

function settle(s: GameState): GameState {
  for (let n = 0; s.prompt && n < 100; n++) {
    const id =
      passId(s) ||
      s.prompt.options.find((o) => o.id === "undefended")?.id ||
      s.prompt.options.find((o) => o.id === "resolve")?.id ||
      (s.prompt.title === "Forced responses"
        ? s.prompt.options[0]?.id
        : undefined) ||
      (s.prompt.options.length === 1 ? s.prompt.options[0].id : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return reload(s);
}
function base(other?: "ant" | "gam" | "spider_man" | "captain_america") {
  const iron = { heroId: "ironheart", aspect: "leadership" as const };
  let s = newGame({
    ...iron,
    villainId: "rhino",
    seed: 29024,
    pacing: "expert",
    ...(other
      ? {
          heroes: [iron, { heroId: other, aspect: "justice" as const }],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    const view = seatView(s, seat);
    const originals = [
      ...view.player.hand,
      ...view.player.deck,
      ...view.player.discard,
      ...view.player.inPlay,
    ];
    expect(originals).toHaveLength(40);
    view.player.deck = originals;
    view.player.hand = [];
    view.player.discard = [];
    view.player.inPlay = [];
    view.player.form = "hero";
    view.player.hp = maxHP(view);
    view.player.exhausted = view.player.flipped = false;
    view.player.stunned = view.player.confused = view.player.tough = false;
  }
  s.queue = [];
  s.prompt = s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 0;
  activateSeat(s, "p1");
  return s;
}
function own(s: GameState, code: string, playerId = "p1") {
  const player = seatView(s, playerId).player;
  for (const zone of [player.deck, player.hand, player.discard]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original ${playerId} ${code}`);
}
function minion(s: GameState, code: string, playerId = "p1") {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function attachment(s: GameState, code: string, targetId = s.villain.id) {
  const p = makePiece(s, code);
  p.attachedTo = targetId;
  s.attachments.push(p);
  return p;
}
function scheme(s: GameState, code: string, counters = 3) {
  const p = makePiece(s, code);
  p.counters = counters;
  s.sideSchemes.push(p);
  return p;
}
function inPlay(s: GameState, id: string) {
  return [
    ...s.minions,
    ...s.attachments,
    ...s.sideSchemes,
    ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
  ].find((p) => p.id === id)!;
}
function blank(s: GameState, id: string) {
  activateSeat(s, "p1");
  const vivian = own(s, "29024");
  const resources = [own(s, "29009"), own(s, "29009")];
  s.player.hand.push(vivian, ...resources);
  s = play(s, vivian, resources);
  s = until(s, (v) => v.prompt?.title === "Vivian");
  s = choose(s, "yes");
  expect(s.prompt?.options.some((o) => o.id === id)).toBe(true);
  s = choose(s, id);
  s = settle(s);
  expect(isTextBlank(s, inPlay(s, id))).toBe(true);
  expect(s.player.inPlay.some((p) => p.id === vivian.id)).toBe(true);
  for (const r of resources)
    expect(s.player.discard.filter((p) => p.id === r.id)).toHaveLength(1);
  return s;
}
function expire(s: GameState) {
  const round = s.round;
  s = settle(native(s, { type: "newRound" }));
  expect(s.round).toBe(round + 1);
  return s;
}
function attack(s: GameState, id: string, playerId = "p1") {
  activateSeat(s, playerId);
  s = native(s, { type: "enemyAttack", id });
  expect(s.attack?.attacker).toBe(id);
  return s;
}

describe("Vivian respects dedicated native printed text", () => {
  it("removes Yellowjacket's Tiny ATK and restores it at round expiry", () => {
    let s = base("ant");
    seatView(s, "p2").player.heroForm = "tiny";
    const y = minion(s, "12027", "p2");
    expect(antManEnemyStats(s, y).attack).toBe(1);
    s = blank(s, y.id);
    expect(antManEnemyStats(s, inPlay(s, y.id)).attack).toBe(0);
    s = attack(s, y.id, "p2");
    expect(s.attack?.base).toBe(2);
    s = expire(settle(s));
    expect(antManEnemyStats(s, inPlay(s, y.id)).attack).toBe(1);
  });

  it("removes Yellowjacket's granted Giant retaliate independently of printed stats", () => {
    let s = base("ant");
    seatView(s, "p2").player.heroForm = "giant";
    const y = minion(s, "12027", "p2");
    expect(antManEnemyRetaliate(s, y)).toBe(1);
    s = blank(s, y.id);
    expect(antManEnemyRetaliate(s, inPlay(s, y.id))).toBe(0);
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: y.id,
        amount: 1,
        source: "hero",
        attack: true,
      }),
    );
    expect(s.player.hp).toBe(hp);
    expect(inPlay(s, y.id).damage).toBe(1);
  });

  it("stops Size Increase's counter response while keeping its printed +2 ATK/SCH", () => {
    let s = base();
    const enemy = minion(s, "06028");
    const increase = attachment(s, "12028", enemy.id);
    increase.counters = 3;
    expect(antManEnemyActivated(s, enemy.id)).toHaveLength(1);
    s.player.tough = true;
    s = settle(attack(s, enemy.id));
    expect(inPlay(s, increase.id).counters).toBe(2);
    s = blank(s, increase.id);
    expect(antManEnemyActivated(s, enemy.id)).toEqual([]);
    s.player.tough = true;
    s = attack(s, enemy.id);
    expect(s.attack?.base).toBe((card(enemy).attack || 0) + 2);
    s = settle(s);
    expect(inPlay(s, increase.id).counters).toBe(2);
    expect(antManEnemyStats(s, inPlay(s, enemy.id)).scheme).toBe(2);
  });

  it("removes Mother's Orders' actual BASIC payment without removing scheme icons", () => {
    let s = base();
    const orders = scheme(s, "13027");
    s.player.hand.push(own(s, "29009"));
    expect(waspBasicAttackCost(s)).toBe(1);
    const blocked = command(reload(s), { type: "BASIC", action: "attack" });
    expect(blocked.prompt?.kind).toBe("payment");
    expect(blocked.player.exhausted).toBe(false);
    s = blank(s, orders.id);
    expect(waspBasicAttackCost(s)).toBe(0);
    const before = s.villain.hp;
    const amount = heroStats(s).attack;
    const discardIds = s.player.discard.map((p) => p.id);
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.kind).not.toBe("payment");
    s = settle(target(s, s.villain.id));
    expect(s.player.exhausted).toBe(true);
    expect(s.villain.hp).toBe(before - amount);
    expect(s.player.discard.map((p) => p.id)).toEqual(discardIds);
  });

  it("removes only the selected Beetle Armor's text HP and restores it on expiry", () => {
    let s = base();
    const beetle = minion(s, "13028");
    const armor = attachment(s, "13029", beetle.id);
    const other = attachment(s, "13029", beetle.id);
    expect(pieceHP(s, beetle)).toBe(card(beetle).health! + 8);
    s = blank(s, armor.id);
    expect(waspEnemyHP(s, inPlay(s, beetle.id))).toBe(4);
    expect(pieceHP(s, inPlay(s, beetle.id))).toBe(card(beetle).health! + 4);
    expect(isTextBlank(s, inPlay(s, other.id))).toBe(false);
    s = expire(s);
    expect(pieceHP(s, inPlay(s, beetle.id))).toBe(card(beetle).health! + 8);
  });

  it("defeats a blank Beetle without its forced payment/shuffle replacement", () => {
    let s = base();
    const beetle = minion(s, "13028");
    s = blank(s, beetle.id);
    s = settle(
      native(s, {
        type: "damage",
        target: beetle.id,
        amount: 8,
        source: "hero",
        attack: true,
      }),
    );
    expect(s.minions.some((p) => p.id === beetle.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === beetle.id)).toHaveLength(
      1,
    );
    expect(s.encounter.deck.some((p) => p.id === beetle.id)).toBe(false);
  });

  it("reconciles Beetle Armor on the actual villain, preserves damage, and avoids a second HP subtraction on blank leave", () => {
    let s = base();
    const armor = makePiece(s, "13029");
    s = settle(native(s, { type: "reveal", piece: armor }));
    expect(inPlay(s, armor.id).attachedTo).toBe(s.villain.id);
    expect(s.villain.maxHp).toBe(54);
    expect(s.villain.hp).toBe(54);
    s.villain.hp -= 7;
    s = blank(s, armor.id);
    expect(s.villain.maxHp).toBe(50);
    expect(s.villain.hp).toBe(43);
    const removed = settle(
      native(reload(s), { type: "discardPiece", id: armor.id }),
    );
    expect(removed.villain.maxHp).toBe(50);
    expect(removed.villain.hp).toBe(43);
    expect(
      removed.encounter.discard.filter((p) => p.id === armor.id),
    ).toHaveLength(1);
    s = expire(s);
    expect(s.villain.maxHp).toBe(54);
    expect(s.villain.hp).toBe(47);
  });

  it("lets a non-Gamora player defeat blank Sibling Rivalry", () => {
    let s = base();
    const rivalry = scheme(s, "18025");
    expect(gamoraCanRemoveThreat(s, rivalry.id)).toBe(false);
    s = blank(s, rivalry.id);
    expect(gamoraCanRemoveThreat(s, rivalry.id)).toBe(true);
    s = settle(
      native(s, {
        type: "thwart",
        target: rivalry.id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.encounter.discard.some((p) => p.id === rivalry.id)).toBe(true);
  });

  it("restores Gamora's identity text while In a Bind's own text is blank", () => {
    let s = base("gam");
    const bind = attachment(s, "18027", "hero:p2");
    expect(gamoraIdentityBlank(seatView(s, "p2"))).toBe(true);
    s = blank(s, bind.id);
    expect(gamoraIdentityBlank(seatView(s, "p2"))).toBe(false);
    s = expire(s);
    expect(gamoraIdentityBlank(seatView(s, "p2"))).toBe(true);
  });

  it("temporarily restores the same Beguiled ally to its original controller, then reconverts on expiry", () => {
    let s = base("spider_man");
    const ally = own(s, "01002", "p2");
    seatView(s, "p2").player.inPlay.push(ally);
    const beguiled = makePiece(s, "25031");
    s = native(s, { type: "reveal", piece: beguiled });
    s = settle(target(s, ally.id));
    expect(s.minions.some((p) => p.id === ally.id)).toBe(true);
    expect(card(inPlay(s, ally.id)).type_code).toBe("minion");
    expect(valkyrieBeguiledController(s, ally.id)).toBe("p2");
    s = blank(s, beguiled.id);
    expect(s.minions.some((p) => p.id === ally.id)).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.filter((p) => p.id === ally.id),
    ).toHaveLength(1);
    expect(card(inPlay(s, ally.id)).type_code).toBe("ally");
    expect(valkyrieBeguiledEnemy(s, inPlay(s, ally.id))).toBe(false);
    expect(valkyrieBeguiledController(s, ally.id)).toBe("p2");
    s = expire(s);
    expect(s.minions.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === ally.id)).toBe(
      false,
    );
    expect(card(inPlay(s, ally.id)).type_code).toBe("minion");
    expect(inPlay(s, ally.id).engagedWith).toBe("p2");
  });

  it("stops Crossfire's actual attack piercing, so Tough absorbs its damage", () => {
    let s = base();
    const crossfire = minion(s, "04027");
    expect(hawkeyeEnemyAttackTraits(s, crossfire).piercing).toBe(true);
    s = blank(s, crossfire.id);
    expect(hawkeyeEnemyAttackTraits(s, inPlay(s, crossfire.id)).piercing).toBe(
      false,
    );
    s.player.tough = true;
    const hp = s.player.hp;
    s = settle(attack(s, crossfire.id));
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
  });

  it("stops Rifle's actual ranged suppression of Captain America's retaliate, retaining printed +2 ATK", () => {
    let s = base("captain_america");
    const shield = own(s, "03009", "p2");
    seatView(s, "p2").player.inPlay.push(shield);
    const crossfire = minion(s, "04027", "p2");
    const rifle = attachment(s, "04029", crossfire.id);
    expect(hawkeyeEnemyAttackTraits(s, crossfire).ranged).toBe(true);
    s = blank(s, rifle.id);
    expect(hawkeyeEnemyAttackTraits(s, inPlay(s, crossfire.id)).ranged).toBe(
      false,
    );
    s = attack(s, crossfire.id, "p2");
    expect(s.attack?.base).toBe((card(crossfire).attack || 0) + 2);
    s = settle(s);
    expect(inPlay(s, crossfire.id).damage).toBe(1);
  });

  it("keeps Blackjack's Bazooka's separately printed +2 ATK under Vivian", () => {
    let s = base();
    const enemy = minion(s, "06028");
    const bazooka = attachment(s, "16056", enemy.id);
    expect(rocketEnemyStats(s, enemy).attack).toBe(2);
    s = blank(s, bazooka.id);
    expect(rocketEnemyStats(s, inPlay(s, enemy.id)).attack).toBe(2);
    s = attack(s, enemy.id);
    expect(s.attack?.base).toBe((card(enemy).attack || 0) + 2);
    s = settle(s);
  });

  it("allows ready and form change after Vivian blanks All Tied Up", () => {
    let s = base();
    const tied = attachment(s, "02048", "hero:p1");
    s.player.exhausted = true;
    expect(goblinIdentityLocked(s)).toBe(true);
    s = settle(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(true);
    expect(dispatch(reload(s), { type: "FLIP" }).error).toBeTruthy();
    s = blank(s, tied.id);
    expect(goblinIdentityLocked(s)).toBe(false);
    s = settle(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(false);
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("alter");
  });

  it("stops Media Coverage repeating an actual revealed side scheme's When Revealed", () => {
    let s = base();
    const media = attachment(s, "02049", "hero:p1");
    expect(goblinWhenRevealedCopies(s)).toBe(1);
    s = blank(s, media.id);
    expect(goblinWhenRevealedCopies(s)).toBe(0);
    const hire = makePiece(s, "08027");
    s = settle(native(s, { type: "reveal", piece: hire }));
    expect(inPlay(s, hire.id).counters).toBe(
      (card(hire).base_threat || 0) * s.playerCount + s.playerCount,
    );
  });

  it("defeats blank Power Drain without discarding encounter cards or requiring hand resources", () => {
    let s = base();
    const drain = scheme(s, "02041");
    s = blank(s, drain.id);
    const deckIds = s.encounter.deck.map((p) => p.id);
    s = settle(
      native(s, {
        type: "thwart",
        target: drain.id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deckIds);
    expect(s.encounter.discard.filter((p) => p.id === drain.id)).toHaveLength(
      1,
    );
  });

  it.each(["02038", "02042", "02047"])(
    "stops %s's actual post-attack forced effect",
    (code) => {
      let s = base();
      const enemy = minion(s, code);
      expect(
        goblinModuleAttackResponses(s, {
          attacker: enemy,
          playerId: "p1",
          performed: true,
          identityDamage: 1,
          damaged: [{ target: "hero:p1", playerId: "p1", amount: 1 }],
        }),
      ).toHaveLength(1);
      s = blank(s, enemy.id);
      const spare = s.player.deck.find(
        (p) => card(p).resource_mental || card(p).resource_physical,
      )!;
      s.player.deck.splice(s.player.deck.indexOf(spare), 1);
      s.player.hand.push(spare);
      const handIds = s.player.hand.map((p) => p.id);
      const deckIds = s.encounter.deck.map((p) => p.id);
      const hp = s.player.hp;
      s = settle(attack(s, enemy.id));
      expect(s.player.stunned).toBe(false);
      expect(s.player.hand.map((p) => p.id)).toEqual(handIds);
      expect(s.encounter.deck.map((p) => p.id)).toEqual(deckIds);
      expect(s.player.hp).toBe(hp - (card(enemy).attack || 0));
    },
  );
});
