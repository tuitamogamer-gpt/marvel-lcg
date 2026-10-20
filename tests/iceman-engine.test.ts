import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import {
  aerial,
  card,
  deckCodes,
  heroStats,
  maxHP,
  MODULES,
} from "../src/game/cards.js";
import {
  dispatch,
  newGame,
  makePiece,
  enemyStats,
  playable,
  nativeCanPutIntoPlay,
  abilityOptions,
} from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { deckErrors, deckOptions } from "../src/game/decks.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { paymentSources } from "../src/game/payment.js";
import { allInPlay, seatView } from "../src/game/team.js";
import {
  command,
  choose,
  finish,
  native,
  hand,
  put,
  top,
  minion,
  side,
  attach,
  play,
  pay,
  respond,
  target,
  reload,
  passId,
} from "./dv-test-helpers.js";
import type { GameState, Piece } from "../src/game/types.js";

const base = (alter = false, team: boolean | "groot" | "deadpool" = false) => {
  let s = newGame({
    heroId: "iceman",
    aspect: "aggression",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 46001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "iceman", aspect: "aggression" as const },
            {
              heroId:
                team === "groot"
                  ? "groot"
                  : team === "deadpool"
                    ? "deadpool"
                    : "spider_man",
              aspect:
                team === "groot"
                  ? ("protection" as const)
                  : ("justice" as const),
            },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  if (!alter) s = finish(command(s, { type: "FLIP" }));
  s.player.flipped = false;
  s.player.deck.push(...s.player.hand.splice(0));
  s.villain.hp = s.villain.maxHp = 80;
  s.scheme.threat = 12;
  s.encounter.deck = Array.from({ length: 20 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
};
const frost = (s: GameState) => allInPlay(s).filter((p) => p.code === "46002");
const reserved = (s: GameState) =>
  (s.player.setAside || []).filter((p) => p.code === "46002");
const freeze = (s: GameState, targetId = s.villain.id) =>
  finish(native(s, { type: "iceman:attach-frostbite", target: targetId }));
const cast = (s: GameState, code: string, ...payments: string[]) => {
  const ps = hand(s, code, ...payments);
  return play(s, ps[0], ps.slice(1));
};
const basic = (s: GameState, id = s.villain.id) =>
  target(command(s, { type: "BASIC", action: "attack" }), id);
const reveal = (s: GameState, code: string) => {
  const reserve = s.player.setAside || [],
    i = reserve.findIndex((p) => p.code === code);
  return native(s, {
    type: "reveal",
    piece: i >= 0 ? reserve.splice(i, 1)[0] : makePiece(s, code),
  });
};
const answer = (s: GameState, id: string) => {
  for (
    let n = 0;
    s.prompt && !s.prompt.options.some((o) => o.id === id) && n < 40;
    n++
  ) {
    const skip = passId(s);
    expect(skip, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, skip!);
  }
  return choose(s, id);
};
const zones = (s: GameState): Piece[] => [
  ...s.players.flatMap((seat) => {
    const p = seatView(s, seat).player;
    return [
      ...p.deck,
      ...p.hand,
      ...p.discard,
      ...p.inPlay,
      ...(p.setAside || []),
    ];
  }),
  ...s.resolving,
  ...s.removed,
  ...s.minions,
  ...s.attachments,
  ...s.sideSchemes,
  ...(s.victoryDisplay || []),
  ...s.encounter.deck,
  ...s.encounter.discard,
  ...s.encounter.dealt,
];

describe("Iceman retail source and native setup", () => {
  it("registers all33faces, exact40source andsixseparatephysicalFrostbites", () => {
    const pack = catalog.filter((c) => c.pack_code === "iceman");
    expect(pack).toHaveLength(33);
    expect(pack.reduce((n, c) => n + (c.quantity || 0), 0) - 1).toBe(59);
    expect(pack.filter((c) => !hasExecutableScript(c.code))).toEqual([]);
    expect(heroStarterCodes("iceman")).toHaveLength(40);
    expect(deckCodes("iceman", "aggression")).toEqual(
      heroStarterCodes("iceman"),
    );
    expect(
      deckErrors("iceman", "aggression", heroStarterCodes("iceman")),
    ).toEqual([]);
    expect(
      deckOptions("iceman", "aggression").some((c) => c.code === "46002"),
    ).toBe(false);
    const s = base();
    expect(reserved(s)).toHaveLength(6);
    expect(new Set(reserved(s).map((p) => p.id)).size).toBe(6);
    expect(
      (s.player.setAside || []).filter(
        (p) => card(p).faction_code === "encounter",
      ),
    ).toHaveLength(5);
    expect(
      s.player.deck.length + s.player.hand.length + s.player.discard.length,
    ).toBe(40);
    expect(MODULES.findIndex((m) => m.id === "sauron")).toBe(22);
  });
  it("provides eachlegaldefaultaspect withall15signaturesandnoFrostbiteindeck", () => {
    for (const aspect of [
      "aggression",
      "justice",
      "leadership",
      "protection",
      "pool",
    ] as const) {
      const codes = deckCodes("iceman", aspect);
      expect(codes).toHaveLength(40);
      expect(codes.filter((c) => card(c).set_code === "iceman")).toHaveLength(
        15,
      );
      expect(codes).not.toContain("46002");
      expect(deckErrors("iceman", aspect, codes)).toEqual([]);
    }
  });
  it("source Sauron module contains six original encounter cards", () => {
    const s = newGame({
      heroId: "iceman",
      aspect: "aggression",
      villainId: "rhino",
      module: "sauron",
      seed: 46,
    });
    expect(
      s.encounter.deck.filter((p) =>
        ["46029", "46030", "46031", "46032"].includes(p.code),
      ),
    ).toHaveLength(6);
  });
});

describe("Freeze, Frostbite, native attacks and activation timing", () => {
  it("attaches anactualFrostbitebeforebasicdamage, stacksstatpenalties andsurvivesreload", () => {
    let s = base();
    const ids = reserved(s).map((p) => p.id);
    s = basic(s);
    expect(s.prompt?.title).toBe("Basic attack interrupts");
    s = finish(choose(reload(s), "freeze"));
    expect(s.villain.hp).toBe(78);
    expect(frost(s)).toHaveLength(1);
    expect(frost(s)[0].attachedTo).toBe(s.villain.id);
    s = freeze(s);
    expect(enemyStats(s, s.villain)).toEqual({ attack: 0, scheme: 0 });
    expect(reserved(s)).toHaveLength(4);
    for (const id of ids)
      expect(zones(reload(s)).filter((p) => p.id === id)).toHaveLength(1);
  });
  it("decliningFreeze andstunnedbasicattacksdonotattach", () => {
    let s = base();
    s = finish(choose(basic(s), "continue"));
    expect(frost(s)).toHaveLength(0);
    s.player.exhausted = false;
    s.player.stunned = true;
    s = finish(basic(s));
    expect(s.player.stunned).toBe(false);
    expect(frost(s)).toHaveLength(0);
  });
  it("Freeze andSurpriseMove shareawindowandthedefeatingattackreadiesthehero", () => {
    let s = base();
    const m = minion(s);
    const [surprise, payment] = hand(s, "46015", "46023");
    s = choose(basic(s, m.id), "freeze");
    expect(s.prompt?.options.some((o) => o.id === surprise.id)).toBe(true);
    s = choose(s, surprise.id);
    s = pay(s, [payment]);
    s = finish(s);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.exhausted).toBe(false);
    expect(reserved(s)).toHaveLength(6);
  });
  it("CryokineticPerceptiondraws/readiesinsideFreeze beforebasicattackcontinues", () => {
    let s = base();
    const perception = put(s, "46005");
    const drawn = top(s, "46011");
    s = choose(basic(s), "freeze");
    expect(s.prompt?.title).toBe("Cryokinetic Perception");
    s = choose(s, "yes");
    expect(s.player.hand.some((p) => p.id === drawn.id)).toBe(true);
    expect(s.player.exhausted).toBe(false);
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === perception.id)?.exhausted).toBe(
      true,
    );
  });
  it("basicdefensepaysitsexhaustbeforeFreezeandcanremainreadyafterPerception", () => {
    let s = base();
    put(s, "46005");
    top(s, "46011");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = answer(s, "hero");
    expect(s.player.exhausted).toBe(true);
    s = choose(s, "freeze");
    s = choose(s, "yes");
    expect(s.player.exhausted).toBe(false);
    s = finish(s);
    expect(s.player.exhausted).toBe(false);
    expect(reserved(s)).toHaveLength(6);
  });
  it("afteranactualattackallFrostbitesreturntotheoriginalreserve", () => {
    let s = freeze(freeze(base()));
    const ids = frost(s).map((p) => p.id);
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(frost(s)).toHaveLength(0);
    expect(reserved(s)).toHaveLength(6);
    for (const id of ids)
      expect(reserved(s).some((p) => p.id === id && !p.attachedTo)).toBe(true);
  });
  it("Stun/Confuse replaceactivationsandpreserveFrostbite", () => {
    let s = freeze(base());
    s.villain.stunned = true;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(frost(s)).toHaveLength(1);
    s.villain.confused = true;
    s = finish(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(frost(s)).toHaveLength(1);
    const threat = s.scheme.threat;
    s = finish(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.scheme.threat).toBe(threat);
    expect(frost(s)).toHaveLength(0);
  });
  it("FrozenSolidcancelsactivationandattachesnewFrostbitewithoutremovingexistingones", () => {
    let s = freeze(base());
    const solid = put(s, "46007");
    solid.attachedTo = s.villain.id;
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp);
    expect(frost(s)).toHaveLength(2);
    expect(s.player.discard.some((p) => p.id === solid.id)).toBe(true);
  });
  it("StunhaspriorityoverFrozenSolid", () => {
    let s = base();
    const solid = put(s, "46007");
    solid.attachedTo = s.villain.id;
    s.villain.stunned = true;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.inPlay.some((p) => p.id === solid.id)).toBe(true);
    expect(frost(s)).toHaveLength(0);
  });
  it("hostdefeatreturnsFrostbiteswithoutdiscardingaPermanentorlosingIDs", () => {
    let s = base();
    const m = minion(s);
    s = freeze(s, m.id);
    const id = frost(s)[0].id;
    s = finish(native(s, { type: "damage", target: m.id, amount: 5 }));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(reserved(s).some((p) => p.id === id)).toBe(true);
    expect(s.player.discard.some((p) => p.code === "46002")).toBe(false);
  });
});

describe("Iceman signatures and supplementary upgrades", () => {
  it("PowerBelt addsactualHP andgeneratesonlyforIcecards", () => {
    let s = base();
    const belt = put(s, "46004");
    expect(maxHP(s)).toBe(14);
    expect(
      paymentSources(s, undefined, "46009").some((p) => p.id === belt.id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "46016").some((p) => p.id === belt.id),
    ).toBe(false);
    const [event, payment] = hand(s, "46011", "46023");
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [payment], "wild", [belt.id]);
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find((o) => o.id === "main" || o.id === s.villain.id)
          ?.id,
    );
    expect(s.player.inPlay.find((p) => p.id === belt.id)?.exhausted).toBe(true);
  });
  it("IceSlideprovidesallthreepowersandAerialthenreturnstodeckonalterego", () => {
    let s = base();
    const slide = put(s, "46006");
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 2, defense: 3 });
    expect(aerial(s)).toBe(true);
    s = finish(command(s, { type: "FLIP" }));
    expect(s.player.deck.some((p) => p.id === slide.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === slide.id)).toBe(false);
  });
  it("CoolOffshufflesoneactualIcecardperFrostbite", () => {
    let s = freeze(freeze(base()));
    const cards = hand(s, "46009", "46011");
    s.player.discard.push(...s.player.hand.splice(0));
    s = command(s, { type: "FLIP" });
    s = choose(s, "yes");
    for (const p of cards) s = choose(reload(s), p.id);
    s = finish(s);
    for (const p of cards)
      expect(s.player.deck.some((q) => q.id === p.id)).toBe(true);
  });
  it("ArcticAttackfirstbulletattachesbeforedefeatandstilltriggersHotHeaded", () => {
    let s = base();
    const m = minion(s);
    const obligation = makePiece(s, "46024");
    obligation.ownerId = s.activePlayerId;
    s.player.inPlay.push(obligation);
    const hp = s.player.hp;
    s = cast(s, "46009", "01088");
    s = choose(s, "freeze");
    s = choose(s, m.id);
    s = finish(s);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.hp).toBe(hp - 1);
    expect(reserved(s)).toHaveLength(6);
  });
  it("ArcticAttacksecondbulletdeals6onlytoanenemywithFrostbite", () => {
    let s = freeze(base());
    s = cast(s, "46009", "01088");
    s = choose(s, "damage");
    s = finish(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(74);
    expect(frost(s)).toHaveLength(1);
  });
  it("IceBlastdamagesFrostbitenemiesoutsidechosenplayersengagement", () => {
    let s = base(false, true);
    const other = minion(s, "01103", "p2");
    s = freeze(s, other.id);
    const [event, a, b] = hand(s, "46010", "01088", "46023");
    s = play(s, event, [a, b]);
    s = choose(s, "p1");
    s = finish(s);
    expect(s.minions.some((p) => p.id === other.id)).toBe(false);
    expect(s.villain.hp).toBe(77);
    expect(frost(s).some((p) => p.attachedTo === s.villain.id)).toBe(true);
  });
  it("ChillOutremovesthreatandattachesaseparateFrostbite", () => {
    let s = base();
    s = cast(s, "46011", "01088");
    s = target(s, "main");
    s = finish(target(s, s.villain.id));
    expect(s.scheme.threat).toBe(9);
    expect(frost(s)).toHaveLength(1);
  });
  it("IceWallabsorbswholepacketanditsnewFrostbiteremainsaftercurrentattack", () => {
    let s = freeze(base());
    const wall = put(s, "46008");
    wall.damage = 7;
    const old = frost(s)[0].id;
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp);
    expect(s.player.discard.some((p) => p.id === wall.id)).toBe(true);
    expect(frost(s)).toHaveLength(1);
    expect(frost(s)[0].id).not.toBe(old);
    expect(reserved(s).some((p) => p.id === old)).toBe(true);
  });
  it("Tough has priority over Ice Wall and preserves the wall", () => {
    let s = base();
    const wall = put(s, "46008");
    s.player.tough = true;
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(hp);
    expect(s.player.tough).toBe(false);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === wall.id)?.damage,
    ).toBe(0);
  });
  for (const order of ["wall", "groot"] as const)
    it(`co-op Groot and Ice Wall allow ${order} to resolve first`, () => {
      let s = base(false, "groot");
      const wall = put(s, "46008");
      const groot = seatView(s, "p2");
      groot.player.form = "hero";
      groot.flags.grootGrowthCounters = 1;
      const hp = groot.player.hp;
      s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" });
      s = answer(s, order);
      s = finish(s);
      expect(seatView(s, "p2").player.hp).toBe(hp);
      expect(seatView(s, "p2").flags.grootGrowthCounters).toBe(
        order === "wall" ? 1 : 0,
      );
      expect(allInPlay(s).find((p) => p.id === wall.id)?.damage).toBe(
        order === "wall" ? 2 : 1,
      );
    });
  it("Ice Wall broken by Pyro indirect damage retains its delayed Frostbite", () => {
    let s = base();
    const wall = put(s, "46008");
    wall.damage = 7;
    const pyro = minion(s, "46025");
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: pyro.id });
    s = finish(s, (v) =>
      /indirect/i.test(v.prompt?.text || "")
        ? v.prompt?.options.find((o) => o.id === "hero")?.id
        : undefined,
    );
    expect(s.player.hp).toBe(hp);
    expect(frost(s)).toHaveLength(1);
    expect(frost(s)[0].attachedTo).toBe(pyro.id);
  });
  it("Frostbite returns when a physical Mansion Attack villain leaves play", () => {
    let s = newGame({
      heroId: "iceman",
      aspect: "aggression",
      villainId: "mansion_attack",
      module: "bomb_scare",
      seed: 46001,
      pacing: "expert",
    });
    s = finish(
      command(s, { type: "MULLIGAN", ids: [] }),
      (v) => v.prompt?.options[0]?.id,
    );
    s = finish(command(s, { type: "FLIP" }), (v) => v.prompt?.options[0]?.id);
    const old = s.villain.id;
    s.villain.tough = false;
    s.villain.toughCards = 0;
    s = freeze(s);
    const id = frost(s)[0].id;
    s = finish(
      native(s, { type: "damage", target: old, amount: 100 }),
      (v) => v.prompt?.options[0]?.id,
    );
    expect(
      reserved(s).some((p) => p.id === id),
      JSON.stringify({
        villain: s.villain,
        old,
        phase: s.phase,
        frost: frost(s),
        victory: s.victoryDisplay,
      }),
    ).toBe(true);
    expect(frost(s)).toHaveLength(0);
    expect(s.villain.id).not.toBe(old);
  });
  it("SnowClone takesnoconsequenceagainstFrostbiteandcannotreceiveupgrades", () => {
    let s = base();
    const clone = put(s, "46003");
    const m = minion(s);
    s = freeze(s, m.id);
    const [upgrade] = hand(s, "01074");
    expect(playable(s, upgrade)).toBeTruthy();
    expect(nativeCanPutIntoPlay(s, upgrade)).toBe(false);
    s = finish(
      command(s, { type: "ABILITY", id: clone.id, action: "attack" }),
      (v) => v.prompt?.options.find((o) => o.id === m.id)?.id,
    );
    expect(s.player.inPlay.find((p) => p.id === clone.id)?.damage).toBe(0);
  });
});

describe("Iceman player pool and retail encounters", () => {
  it("TakeThatrequiresupgradeanddeals7", () => {
    let s = base();
    const [event] = hand(s, "46016");
    expect(playable(s, event)).toMatch(/upgrade/);
    s = freeze(s);
    s = cast(s, "46016", "01088", "46023");
    s = finish(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(73);
  });
  it("SharkGirlgetsoneATKpereachactualupgrade", () => {
    let s = freeze(freeze(base()));
    const shark = put(s, "46012");
    s = finish(
      command(s, { type: "ABILITY", id: shark.id, action: "attack" }),
      (v) => v.prompt?.options.find((o) => o.id === s.villain.id)?.id,
    );
    expect(s.villain.hp).toBe(76);
  });
  it("GlobneedsXMenanditsentrançedamageselectsonlyupgradeenemy", () => {
    let s = base(true);
    const [glob] = hand(s, "46013");
    expect(playable(s, glob)).toMatch(/X-Men/);
    s = finish(command(s, { type: "FLIP" }));
    s = freeze(s);
    s = cast(s, "46013", "01088", "46023");
    s = finish(
      respond(s, /Glob/),
      (v) => v.prompt?.options.find((o) => o.id === s.villain.id)?.id,
    );
    expect(s.villain.hp).toBe(78);
  });
  it("SuppressingFireonlyhealsitscontrolleraftertheirheroattack", () => {
    let s = base();
    s.player.hp = 5;
    const m = minion(s);
    const suppress = put(s, "46014");
    suppress.attachedTo = m.id;
    s = native(s, { type: "damage", target: m.id, amount: 5, attack: true });
    s = finish(respond(s, /Suppressing Fire/));
    expect(s.player.hp).toBe(7);
  });
  it("KeepUpthePressuresearchesactualAttackeventandboostsonlyAttackevents", () => {
    let s = base();
    const scheme = put(s, "46018");
    s.player.inPlay.splice(s.player.inPlay.indexOf(scheme), 1);
    scheme.counters = 1;
    s.sideSchemes.push(scheme);
    s = native(s, { type: "thwart", target: scheme.id, amount: 1 });
    s = respond(s, /Keep Up/);
    const candidate = s.player.deck.find((p) => p.code === "46009")!;
    s = finish(choose(s, candidate.id));
    expect(s.player.hand.some((p) => p.id === candidate.id)).toBe(true);
    s = cast(s, "46009", "01088");
    s = choose(s, "freeze");
    s = finish(choose(s, s.villain.id));
    expect(s.villain.hp).toBe(75);
  });
  it("Shadowcatlosesschemeiconsfortheroundwithoutblankingitstext", () => {
    let s = base();
    const crisis = side(s, "01107", 3);
    const [cat, a, b] = hand(s, "46019", "46023", "46023");
    s = play(s, cat, [a, b]);
    s = respond(s, /Shadowcat/);
    s = finish(choose(s, crisis.id));
    s = native(s, { type: "thwart", target: "main", amount: 2, action: true });
    s = finish(s);
    expect(s.scheme.threat).toBe(10);
  });
  it("BeakcountscontrolledXMenalliesincludingitself", () => {
    let s = base();
    put(s, "46003");
    s = cast(s, "46020", "46023");
    s = finish(
      respond(s, /Beak/),
      (v) => v.prompt?.options.find((o) => o.id === "main")?.id,
    );
    expect(s.scheme.threat).toBe(10);
  });
  it("HotHeadedstaysinplayuntilbasicrecoveryresponse", () => {
    let s = base();
    s = finish(reveal(s, "46024"));
    expect(s.player.inPlay.some((p) => p.code === "46024")).toBe(true);
    s = freeze(s);
    expect(s.player.hp).toBe(10);
    s = finish(command(s, { type: "FLIP" }));
    s = command(s, { type: "BASIC", action: "recover" });
    s = finish(respond(s, /Hot-Headed/));
    expect(s.player.inPlay.some((p) => p.code === "46024")).toBe(false);
  });
  it("ShadowsintroducesoriginalnemesisphysicalIDsincludingtwoBurncards", () => {
    let s = base();
    const ids = (s.player.setAside || [])
      .filter((p) => card(p).faction_code === "encounter")
      .map((p) => p.id);
    s = finish(reveal(s, "01190"));
    expect(s.minions.some((p) => p.code === "46025")).toBe(true);
    expect(s.sideSchemes.some((p) => p.code === "46026")).toBe(true);
    expect(
      (s.player.setAside || []).filter((p) => ids.includes(p.id)),
    ).toHaveLength(0);
    for (const id of ids)
      expect(zones(s).filter((p) => p.id === id)).toHaveLength(1);
  });
  it("BurnandPlayingwithFireuseallprintedresourceicons", () => {
    let s = base();
    top(s, "46023");
    top(s, "01088");
    const hp = s.player.hp;
    s = finish(
      reveal(s, "46028"),
      (v) => v.prompt?.options.find((o) => /hero/.test(o.id))?.id,
    );
    expect(s.player.hp).toBe(hp - 3);
  });
  it("SauronrevealsactualLifeDrainandactivatesitsrequiredhighestHPminion", () => {
    let s = base();
    const life = makePiece(s, "46031");
    s.encounter.deck.unshift(life);
    s = reveal(s, "46029");
    s = finish(
      s,
      (v) =>
        v.prompt?.options.find(
          (o) => o.id === s.minions.find((p) => p.code === "46029")?.id,
        )?.id,
    );
    const sauron = s.minions.find((p) => p.code === "46029")!;
    expect(s.attachments.find((p) => p.id === life.id)?.attachedTo).toBe(
      sauron.id,
    );
    expect(sauron.tough).toBe(true);
    expect(s.player.hp).toBe(7);
  });
  it("SauronLivesdealsexistingSauronfacedownratherthanputtingitinplay", () => {
    let s = base();
    const sauron = makePiece(s, "46029");
    s.encounter.discard.push(sauron);
    const scheme = side(s, "46030", 1);
    s = finish(native(s, { type: "thwart", target: scheme.id, amount: 1 }));
    expect(
      s.encounter.dealt.some(
        (p) => p.id === sauron.id && p.dealtTo === s.activePlayerId,
      ),
    ).toBe(true);
    expect(s.minions.some((p) => p.code === "46029")).toBe(false);
  });
});

describe("Iceman controller restrictions and printed basic powers", () => {
  const mercTurn = (s: GameState) => {
    put(s, "44032", "p2");
    s.turnPlayerId = "p2";
    s.players.find((p) => p.id === "p2")!.ended = false;
    s.phase = "player";
    return s;
  };
  it("Snow Clone cannot thwart with its printed dash, including instructed actions", () => {
    const s = base();
    const clone = put(s, "46003");
    expect(
      abilityOptions(s, clone).find((o) => o.id === "thwart")?.disabled,
    ).toMatch(/dash/);
    const result = dispatch(reload(s), {
      type: "ABILITY",
      id: clone.id,
      action: "thwart",
    });
    expect(result.error).toMatch(/dash/);
    expect(result.player.inPlay.find((p) => p.id === clone.id)?.exhausted).toBe(
      false,
    );
    const queued = reload(s);
    queued.queue = [
      { type: "allyAction", id: clone.id, kind: "thwart", target: "main" },
    ];
    queued.prompt = {
      kind: "choice",
      title: "Instructed action",
      text: "",
      options: [{ id: "go", label: "Resolve", effects: [] }],
    };
    const instructed = dispatch(queued, { type: "CHOOSE", id: "go" });
    expect(instructed.error).toMatch(/dash/);
  });
  it("Merc blocks Frostbite's forced return while its constant modifiers remain", () => {
    let s = freeze(base(false, "deadpool"));
    const id = frost(s)[0].id;
    s = mercTurn(s);
    expect(enemyStats(s, s.villain).attack).toBe(1);
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(frost(s).map((p) => p.id)).toContain(id);
    s.turnPlayerId = "p1";
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(reserved(seatView(s, "p1")).map((p) => p.id)).toContain(id);
  });
  it("Merc blocks Frozen Solid and Ice Wall but does not blank their cards", () => {
    let s = base(false, "deadpool");
    const solid = put(s, "46007"),
      wall = put(s, "46008");
    solid.attachedTo = s.villain.id;
    s = mercTurn(s);
    const hp = s.player.hp;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(seatView(s, "p1").player.hp).toBeLessThan(hp);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === solid.id)
        ?.attachedTo,
    ).toBe(s.villain.id);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === wall.id)?.damage,
    ).toBe(0);
    expect(frost(s)).toHaveLength(0);
  });
  it("Merc blocks Ice Slide's forced return and Bobby's named Cool Off response", () => {
    let s = freeze(base(false, "deadpool"));
    const slide = put(s, "46006"),
      [ice] = hand(s, "46009");
    s.player.hand.splice(s.player.hand.indexOf(ice), 1);
    s.player.discard.push(ice);
    s = mercTurn(s);
    s = native(s, { type: "flip", counts: false });
    expect(s.prompt).toBeNull();
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === slide.id)).toBe(
      true,
    );
    expect(seatView(s, "p1").player.discard.some((p) => p.id === ice.id)).toBe(
      true,
    );
  });
  it("a blocked departure response preserves its physical Permanent Frostbite in play", () => {
    let s = base(false, "deadpool");
    const m = minion(s);
    s = freeze(s, m.id);
    const id = frost(s)[0].id;
    s = mercTurn(s);
    s = finish(native(s, { type: "damage", target: m.id, amount: 5 }));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(frost(s).find((p) => p.id === id)?.attachedTo).toBe(m.id);
    expect(reserved(seatView(s, "p1"))).toHaveLength(5);
    expect(seatView(s, "p1").player.discard.some((p) => p.id === id)).toBe(
      false,
    );
  });
  it("Vivian's real target picker excludes a Permanent player Frostbite", () => {
    let s = base();
    const m = minion(s);
    s = freeze(s, m.id);
    const id = frost(s)[0].id;
    s = cast(s, "29024", "01088");
    s = respond(s, /Vivian/);
    expect(s.prompt?.title).toMatch(/Vivian/);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(id);
    s = finish(choose(s, m.id));
    s = finish(native(s, { type: "damage", target: m.id, amount: 5 }));
    expect(reserved(s).map((p) => p.id)).toContain(id);
  });
  it("a teammate's copied attachment effect uses and returns Iceman's original reserve card", () => {
    let s = base(false, true);
    const ids = reserved(s).map((p) => p.id);
    const hotHeaded = makePiece(s, "46024");
    hotHeaded.ownerId = "p1";
    s.player.inPlay.push(hotHeaded);
    const hp = s.player.hp;
    s = finish(
      native(s, {
        type: "iceman:attach-frostbite",
        target: s.villain.id,
        actorId: "p2",
      }),
    );
    const actual = frost(s)[0];
    expect(ids).toContain(actual.id);
    expect(actual.ownerId).toBe("p1");
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === actual.id),
    ).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.some((p) => p.id === actual.id),
    ).toBe(false);
    expect(seatView(s, "p1").player.hp).toBe(hp);
    s = finish(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" }),
    );
    expect(
      reserved(seatView(s, "p1"))
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids.sort());
  });
  it("Hot-Headed remains an encounter response during Merc's turn", () => {
    let s = base(false, "deadpool");
    const hotHeaded = makePiece(s, "46024");
    hotHeaded.ownerId = "p1";
    s.player.inPlay.push(hotHeaded);
    s = mercTurn(s);
    const hp = s.player.hp;
    s = finish(
      native(s, {
        type: "iceman:attach-frostbite",
        target: s.villain.id,
        actorId: "p1",
      }),
    );
    expect(seatView(s, "p1").player.hp).toBe(hp - 1);
  });
  it("Keep Up the Pressure also increases Dive Bomb's secondary damage clause", () => {
    let s = base();
    put(s, "46006");
    const first = minion(s, "01101"),
      second = minion(s, "01101");
    s.flags.icemanPressure = `${s.round}:${s.phase}`;
    s = cast(s, "17028", "01088", "01089");
    s = finish(choose(s, first.id));
    expect(s.villain.hp).toBe(78);
    expect(s.minions.some((p) => p.id === first.id)).toBe(false);
    expect(s.minions.find((p) => p.id === second.id)?.damage).toBe(2);
  });
});
