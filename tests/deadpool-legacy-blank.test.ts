import { describe, expect, it } from "vitest";
import { makePiece, newGame } from "../src/game/engine.js";
import { isTextBlank } from "../src/game/card-text.js";
import {
  venomRestrictedAllowance,
  venomResourceSources,
} from "../src/game/venom.js";
import {
  starLordAllyTraits,
  starLordCanReduceHandCost,
} from "../src/game/star-lord.js";
import { grootPreventDamage } from "../src/game/groot.js";
import { gamoraIdentityBlank } from "../src/game/gamora.js";
import { antManFormChanged, type AntManPorts } from "../src/game/ant-man.js";
import { quicksilverBasicUsed } from "../src/game/quicksilver.js";
import { rocketDamageResolved } from "../src/game/rocket.js";
import {
  waspDefeated,
  resolveWaspEffect,
  type WaspPorts,
} from "../src/game/wasp.js";
import { hulkTurnEnds } from "../src/game/hulk.js";
import { msMarvelAfterEvent } from "../src/game/ms-marvel.js";
import { thorEngagementResponses } from "../src/game/thor.js";
import {
  blackWidowCardPlayed,
  resolveBlackWidowEffect,
  type BlackWidowPorts,
} from "../src/game/black-widow.js";
import {
  resolveScarletWitchEffect,
  type ScarletWitchPorts,
} from "../src/game/scarlet-witch.js";
import {
  spiderWomanCardPlayed,
  spiderWomanStats,
} from "../src/game/spider-woman.js";
import { visionAlterStats } from "../src/game/vision.js";
import { captainAllyDiscount } from "../src/game/captain-america.js";
import {
  roguePhaseBegan,
  rogueFormChanged,
  rogueModifiers,
  type RoguePorts,
} from "../src/game/rogue.js";
import { card } from "../src/game/cards.js";
import type { Effect, GameState, Option } from "../src/game/types.js";

function board(heroId: string, form: "hero" | "alter" = "hero") {
  const s = newGame({
    heroId,
    aspect: "aggression",
    villainId: "rhino",
    seed: 44035,
  });
  s.phase = "player";
  s.player.form = form;
  s.player.exhausted = false;
  return s;
}
function blank(s: GameState) {
  const p = makePiece(s, "44035");
  p.attachedTo = `hero:${s.activePlayerId}`;
  s.attachments.push(p);
}

describe("Tabula Rasa suppresses printed identity abilities across existing heroes", () => {
  it("Rogue keeps Touched and its separate upgrade bonus while identity responses are blank", () => {
    const s = board("rogue");
    const touched = makePiece(s, "38002");
    touched.ownerId = s.activePlayerId;
    touched.attachedTo = s.villain.id;
    s.player.inPlay.push(touched);
    expect(roguePhaseBegan(s)).toHaveLength(1);
    blank(s);
    expect(roguePhaseBegan(s)).toHaveLength(0);
    expect(rogueModifiers(s).retaliate).toBe(1);
    s.player.form = "alter";
    let searched = false;
    rogueFormChanged(s, false, {
      findTouched: () => {
        searched = true;
        return touched;
      },
    } as unknown as RoguePorts);
    expect(searched).toBe(false);
  });
  it("removes Venom's Restricted allowance and resource ability", () => {
    const s = board("vnm");
    expect(venomRestrictedAllowance(s)).toBe(1);
    expect(
      venomResourceSources(s, { canTakeDamageCost: () => true }),
    ).toHaveLength(1);
    blank(s);
    expect(venomRestrictedAllowance(s)).toBe(0);
    expect(
      venomResourceSources(s, { canTakeDamageCost: () => true }),
    ).toHaveLength(0);
    s.player.form = "alter";
    expect(venomRestrictedAllowance(s)).toBe(0);
  });

  it("removes Star-Lord's granted ally trait and play interrupt", () => {
    const s = board("stld"),
      ally = makePiece(s, "01011"),
      event = makePiece(s, "01087");
    s.player.inPlay.push(ally);
    s.player.hand.push(event);
    expect(starLordAllyTraits(s, ally)).toEqual(["Guardian"]);
    expect(starLordCanReduceHandCost(s, event, 2)).toBe(true);
    blank(s);
    expect(starLordAllyTraits(s, ally)).toEqual([]);
    expect(starLordCanReduceHandCost(s, event, 2)).toBe(false);
  });

  it("Groot retains growth counters but cannot prevent damage with Flora Colossus", () => {
    const s = board("groot");
    s.flags.grootGrowthCounters = 5;
    expect(grootPreventDamage(s, "hero", 1)).toBe(1);
    blank(s);
    expect(grootPreventDamage(s, "hero", 2)).toBe(0);
    expect(s.flags.grootGrowthCounters).toBe(4);
  });

  it("Gamora's existing identity guard recognizes the new blank attachment", () => {
    const s = board("gam");
    expect(gamoraIdentityBlank(s)).toBe(false);
    blank(s);
    expect(gamoraIdentityBlank(s)).toBe(true);
    s.player.form = "alter";
    expect(gamoraIdentityBlank(s)).toBe(true);
  });

  it("Ant-Man loses his form response while his Helmet still responds", () => {
    const s = board("ant");
    s.player.heroForm = "tiny";
    s.player.inPlay.push(makePiece(s, "12008"));
    const ports = {
      isTextBlank,
      schemeTargets: () => [{ id: "main" }],
      enemyTargets: () => [],
    } as unknown as AntManPorts;
    expect(antManFormChanged(s, ports).map((e) => e.title)).toContain(
      "Puny Pest",
    );
    blank(s);
    expect(antManFormChanged(s, ports).map((e) => e.title)).toEqual([
      "Ant-Man's Helmet",
    ]);
  });

  it("Quicksilver cannot trigger Super Speed and Hulk does not discard his hand", () => {
    const q = board("qsv"),
      h = board("hulk");
    q.player.exhausted = true;
    expect(quicksilverBasicUsed(q, "attack")).toHaveLength(1);
    expect(hulkTurnEnds(h)).toHaveLength(1);
    blank(q);
    blank(h);
    expect(quicksilverBasicUsed(q, "attack")).toHaveLength(0);
    expect(hulkTurnEnds(h)).toHaveLength(0);
  });

  it("Rocket loses Murdered You but retains a resolved Schadenfreude lasting effect", () => {
    const s = board("rocket");
    s.flags.rocketSchadenTurn = `${s.round}:${s.phase}:${s.turnPlayerId}`;
    const packet = {
      actualDamage: 3,
      excessDamage: 1,
      sourceIsIdentity: true,
      wasHero: true,
    };
    expect(
      rocketDamageResolved(s, packet).some(
        (e) => e.title === '"Murdered You!"',
      ),
    ).toBe(true);
    blank(s);
    const effects = rocketDamageResolved(s, packet);
    expect(effects.some((e) => e.title === '"Murdered You!"')).toBe(false);
    expect(effects.some((e) => e.type === "heal" && e.amount === 2)).toBe(true);
  });

  it("Wasp loses Small but Mighty and Giant basic-power distribution", () => {
    const s = board("wsp");
    s.player.heroForm = "tiny";
    expect(waspDefeated(s, "minion", "hero")).toHaveLength(1);
    blank(s);
    expect(waspDefeated(s, "minion", "hero")).toHaveLength(0);
    s.player.heroForm = "giant";
    const queued: Effect[] = [];
    const ports = {
      heroStat: () => 2,
      enemyTargets: () => [{ id: "a", label: "A" }],
      queue: (_s: GameState, ...e: Effect[]) => queued.push(...e),
    } as unknown as WaspPorts;
    resolveWaspEffect(
      s,
      { type: "wasp:basic-resolve", power: "attack" },
      ports,
    );
    expect(
      queued.some(
        (e) => e.type === "wasp:divide" || e.type === "wasp:division-commit",
      ),
    ).toBe(false);
    expect(queued.some((e) => e.type === "damage" && e.target === "a")).toBe(
      true,
    );
  });

  it("Ms. Marvel cannot return her event through Morphogenetics", () => {
    const s = board("ms_marvel"),
      event = makePiece(s, "05003");
    s.player.discard.push(event);
    expect(
      msMarvelAfterEvent(s, event, []).some(
        (e) => e.title === "Morphogenetics",
      ),
    ).toBe(true);
    blank(s);
    expect(
      msMarvelAfterEvent(s, event, []).some(
        (e) => e.title === "Morphogenetics",
      ),
    ).toBe(false);
  });

  it("Thor cannot draw for engaging a minion", () => {
    const s = board("thor"),
      minion = makePiece(s, "01102");
    minion.engagedWith = s.activePlayerId;
    expect(thorEngagementResponses(s, minion)).toHaveLength(1);
    blank(s);
    expect(thorEngagementResponses(s, minion)).toHaveLength(0);
  });

  it("Natasha cannot trigger Mission Prep", () => {
    const s = board("black_widow", "alter"),
      prep = makePiece(s, "08006");
    expect(blackWidowCardPlayed(s, prep)).toHaveLength(1);
    blank(s);
    expect(blackWidowCardPlayed(s, prep)).toHaveLength(0);
  });

  it("Black Widow loses Widowmaker while Synth-Suit still responds", () => {
    const s = board("black_widow");
    s.player.exhausted = true;
    const suit = makePiece(s, "08009");
    s.player.inPlay.push(suit);
    let choices: Option[] = [];
    const ports = {
      enemyTargets: () => [{ id: "villain", label: "Villain" }],
      canReadyIdentity: () => true,
      choose: (
        _s: GameState,
        _title: string,
        _text: string,
        options: Option[],
      ) => {
        choices = options;
      },
    } as unknown as BlackWidowPorts;
    resolveBlackWidowEffect(s, { type: "bw:after-preparation" }, ports);
    expect(choices.some((o) => o.id === "widowmaker")).toBe(true);
    blank(s);
    resolveBlackWidowEffect(s, { type: "bw:after-preparation" }, ports);
    expect(choices.some((o) => o.id === "widowmaker")).toBe(false);
    expect(choices.some((o) => o.id === suit.id)).toBe(true);
  });

  it("Scarlet Witch cannot replace boost counts through Chaos Control", () => {
    const s = board("scw");
    let choices: Option[] = [];
    const queued: Effect[] = [];
    const ports = {
      queue: (_s: GameState, ...effects: Effect[]) => queued.push(...effects),
      choose: (
        _s: GameState,
        _title: string,
        _text: string,
        options: Option[],
      ) => {
        choices = options;
      },
    } as unknown as ScarletWitchPorts;
    const effect = {
      type: "scw:count-window",
      index: 0,
      pieces: [makePiece(s, "01104")],
      after: [],
      boostCounts: [],
    };
    resolveScarletWitchEffect(s, effect, ports);
    expect(choices.some((o) => o.id.startsWith("chaos:"))).toBe(true);
    choices = [];
    blank(s);
    resolveScarletWitchEffect(s, effect, ports);
    expect(choices).toEqual([]);
    expect(queued.some((e) => e.type === "scw:count-crest")).toBe(true);
  });

  it("Spider-Woman retains existing agility buffs but cannot add a new one", () => {
    const s = board("spider_woman"),
      event = card(makePiece(s, "01076"));
    s.flags["swAgility:justice"] = s.round;
    expect(spiderWomanCardPlayed(s, event)).toHaveLength(1);
    blank(s);
    expect(spiderWomanCardPlayed(s, event)).toHaveLength(0);
    expect(spiderWomanStats(s).attack).toBe(1);
  });

  it("Vision loses identity REC/hand-size bonuses without blanking his mass upgrade", () => {
    const s = board("vision", "alter");
    const mass =
      s.player.inPlay.find((p) => ["26002a", "26002b"].includes(p.code)) ||
      makePiece(s, "26002b");
    if (!s.player.inPlay.includes(mass)) s.player.inPlay.push(mass);
    mass.code = "26002b";
    expect(visionAlterStats(s).recover).toBe(2);
    blank(s);
    expect(visionAlterStats(s).recover).toBe(0);
    expect(isTextBlank(s, mass)).toBe(false);
  });

  it("Steve Rogers loses Living Legend", () => {
    const s = board("captain_america", "alter"),
      ally = card(makePiece(s, "01011"));
    expect(captainAllyDiscount(s, ally)).toBe(1);
    blank(s);
    expect(captainAllyDiscount(s, ally)).toBe(0);
  });
});
