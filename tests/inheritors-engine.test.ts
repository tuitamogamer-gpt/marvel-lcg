/** Original modular cards, native dispatcher continuations, and saved choices. */
import { describe, expect, it } from "vitest";
import { card, deckCodes, MODULES } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { dispatch, makePiece, newGame, targets } from "../src/game/engine.js";
import {
  inheritorsModifiers,
  inheritorsVillainPhaseInterrupts,
} from "../src/game/inheritors.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import { choose, command, native, reload } from "./dv-test-helpers.js";

type Fixture = GameState & { inheritorOriginalIds?: string[] };
const codes = Array.from({ length: 9 }, (_, n) => String(30030 + n));
const minionCodes = codes.slice(1);

function physical(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
    ...(
      (p as Piece & { inheritorBoosts?: Piece[] }).inheritorBoosts || []
    ).flatMap(nested),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  const all = physical(s);
  for (const id of (s as Fixture).inheritorOriginalIds || [])
    expect(
      all.filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 160; n++) {
    const id =
      prefer?.(s) ||
      s.prompt.options.find((o) =>
        ["take", "allow", "skip", "pass", "continue", "no", "resolve"].includes(
          o.id,
        ),
      )?.id ||
      (s.prompt.title === "Forced responses" || s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}
function base(team = false, villainId = "rhino", otherHeroId = "ghost_spider") {
  const iron = { heroId: "ironheart", aspect: "leadership" as const };
  let s = newGame({
    ...iron,
    villainId,
    module: "inheritors",
    seed: 30030,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            iron,
            { heroId: otherHeroId, aspect: "protection" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  expect(s.phase).toBe("player");
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    expect(source).toHaveLength(40);
    expect(source.map((p) => p.code).sort()).toEqual(
      deckCodes(seat.heroId, seat.aspect).sort(),
    );
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = [];
    p.form = seat.id === "p1" ? "hero" : "alter";
    p.exhausted = p.flipped = p.stunned = p.confused = p.tough = false;
  }
  (s as Fixture).inheritorOriginalIds = physical(s).map((p) => p.id);
  s.scheme.threat = 0;
  activateSeat(s, "p1");
  return s;
}
function source(s: GameState, code: string, seatId = "p1") {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard, p.inPlay]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original source ${seatId}:${code}`);
}
function control(s: GameState, code: string, seatId = "p1") {
  const p = source(s, code, seatId);
  seatView(s, seatId).player.inPlay.push(p);
  return p;
}
function encounter(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original encounter ${code}`);
}
function reveal(s: GameState, code: string, actorId = "p1") {
  return native(s, {
    type: "reveal",
    piece: encounter(s, code),
    actorId,
    skip: true,
  });
}
function minion(s: GameState, code: string) {
  return s.minions.find((p) => p.code === code)!;
}
function actionSeat(s: GameState, id: string) {
  activateSeat(s, id);
  s.turnPlayerId = id;
}
function blank(s: GameState, id: string) {
  actionSeat(s, "p1");
  const vivian = source(s, "29024");
  const resources = [source(s, "29005"), source(s, "29013")];
  s.player.hand.push(vivian, ...resources);
  s = command(s, { type: "PLAY", id: vivian.id });
  s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
  expect(s.prompt?.title).toBe("Vivian");
  s = choose(s, "yes");
  s = choose(reload(s), id);
  s = settle(s);
  expect(
    isTextBlank(
      s,
      physical(s).find((p) => p.id === id)!,
    ),
  ).toBe(true);
  return s;
}
function top(s: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => encounter(s, code));
  s.encounter.deck.unshift(...pieces);
  return pieces;
}
function hunt(s: GameState) {
  return native(s, ...inheritorsVillainPhaseInterrupts(s));
}
function boosts(s: GameState, p: Piece) {
  return (
    (minion(s, p.code) as Piece & { inheritorBoosts?: Piece[] })
      .inheritorBoosts || []
  );
}

describe("The original nine-card Inheritors module", () => {
  it("registers all nine executable faces and exact physical copies beside source forty", () => {
    const s = base();
    expect(MODULES.some((m) => m.id === "inheritors")).toBe(true);
    expect(
      physical(s)
        .filter((p) => card(p).set_code === "inheritors")
        .map((p) => p.code)
        .sort(),
    ).toEqual(codes);
    for (const code of codes)
      expect(hasExecutableScript(code), code).toBe(true);
    exact(s);
  });
  it("preserves nine physical cards in every executable scenario, including setup searches", () => {
    for (const villainId of [
      "rhino",
      "klaw",
      "ultron",
      "mutagen_formula",
      "risky_business",
    ]) {
      const s = newGame({
        heroId: "ironheart",
        aspect: "leadership",
        villainId,
        module: "inheritors",
        seed: 30030,
        pacing: "expert",
      });
      const module = physical(s).filter(
        (p) => card(p).set_code === "inheritors",
      );
      expect(module.map((p) => p.code).sort(), villainId).toEqual(codes);
      expect(new Set(module.map((p) => p.id)).size).toBe(9);
    }
  });
  it.each(minionCodes)(
    "%s reveals without a Web-Warrior character and performs no conditional effect",
    (code) => {
      let s = base(true);
      const ally = control(s, "29004"),
        upgrade = control(s, "29013");
      const before = s.encounter.deck
        .filter((p) => p.code !== code)
        .map((p) => p.id);
      s = settle(reveal(s, code));
      expect(minion(s, code)).toMatchObject({
        engagedWith: "p1",
        tough: false,
      });
      expect(s.scheme.threat).toBe(0);
      expect(s.player.hp).toBe(10);
      expect(s.player.stunned).toBe(false);
      expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(0);
      expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(true);
      expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
    },
  );
  it.each(minionCodes)(
    "%s sees another seat's hero Web-Warrior, while its reveal affects the acting seat",
    (code) => {
      let s = base(true);
      seatView(s, "p2").player.form = "hero";
      const ally = control(s, "29004"),
        upgrade = control(s, "29013");
      s = settle(reveal(s, "30030"));
      const sideId = s.sideSchemes[0].id;
      const topId = s.encounter.deck.find((p) => p.code !== code)!.id;
      const actorHP = s.player.hp;
      s = reveal(s, code);
      if (code === "30033") {
        expect(s.prompt?.title).toBe("Daemos");
        expect(s.prompt?.options.some((o) => o.id === ally.id)).toBe(true);
        expect(s.prompt?.options.some((o) => o.id === "hero:p2")).toBe(false);
        s = choose(reload(s), ally.id);
      }
      if (code === "30035") {
        expect(s.prompt?.title).toBe("Karn");
        expect(s.prompt?.options.some((o) => o.id === ally.id)).toBe(false);
        s = choose(reload(s), upgrade.id);
      }
      s = settle(s);
      expect(minion(s, code).engagedWith).toBe("p1");
      expect(s.scheme.threat).toBe(
        code === "30031" ? 1 : code === "30032" ? 2 : 0,
      );
      expect(s.sideSchemes.find((p) => p.id === sideId)?.counters).toBe(
        code === "30031" ? 7 : 6,
      );
      expect(s.player.hp).toBe(
        actorHP -
          (code === "30036" || code === "30035" ? 2 : code === "30038" ? 1 : 0),
      );
      expect(seatView(s, "p2").player.hp).toBe(10);
      expect(s.player.inPlay.find((p) => p.id === ally.id)?.stunned).toBe(
        code === "30033",
      );
      expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(
        code === "30038" ? 1 : 0,
      );
      expect(s.player.inPlay.some((p) => p.id === upgrade.id)).toBe(
        code !== "30035",
      );
      expect(minion(s, code).tough).toBe(code === "30034");
      if (code === "30037")
        expect(boosts(s, minion(s, code)).map((p) => p.id)).toEqual([topId]);
    },
  );
  it("a controlled Web-Warrior ally qualifies while its identity is in alter-ego", () => {
    let s = base(true);
    control(s, "27010", "p2");
    s = settle(reveal(s, "30036"));
    expect(s.player.hp).toBe(8);
    expect(seatView(s, "p2").player.form).toBe("alter");
    expect(seatView(s, "p2").player.hp).toBe(10);
  });
  it("a Web-Warrior ally in hand does not satisfy the in-play character condition", () => {
    let s = base(true);
    seatView(s, "p2").player.hand.push(source(s, "27010", "p2"));
    s = settle(reveal(s, "30034"));
    expect(minion(s, "30034").tough).toBe(false);
  });
  it("a reveal addressed to the other seat damages that seat through a saved native continuation", () => {
    let s = base(true);
    seatView(s, "p2").player.form = "hero";
    s = settle(reveal(reload(s), "30036", "p2"));
    expect(minion(s, "30036").engagedWith).toBe("p2");
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(8);
  });
});

describe("Global Inheritor auras observed through native rules", () => {
  it("Bora grants a scalar icon to every Inheritor across seats, stacking with tokens and side-scheme icons", () => {
    let s = base(true, "klaw");
    s = settle(reveal(s, "30031"));
    s = settle(reveal(s, "30032", "p2"));
    s = settle(reveal(s, "30034", "p2"));
    const outsider = encounter(s, "01120");
    outsider.engagedWith = "p1";
    s.minions.push(outsider);
    s.encounter.acceleration = 2;
    const printed = encounter(s, "01127");
    printed.counters = 3;
    s.sideSchemes.push(printed);
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(
      2 + 2 + (card(printed).scheme_acceleration || 0) + 3,
    );
  });
  it("actual Vivian blanks Bora's acceleration source immediately while its printed stats remain", () => {
    let s = settle(reveal(base(), "30031"));
    s = settle(reveal(s, "30032"));
    s = blank(s, minion(s, "30031").id);
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(1);
    expect(minion(s, "30031").code).toBe("30031");
  });
  it("Brix patrol affects another seat's Inheritor, blocks native main thwart, and stops on source removal", () => {
    let s = base(true);
    s = settle(reveal(s, "30032"));
    s = settle(reveal(s, "30031", "p2"));
    seatView(s, "p2").player.form = "hero";
    actionSeat(s, "p2");
    s.scheme.threat = 3;
    expect(targets(s, "scheme", false, true).some((p) => p.id === "main")).toBe(
      false,
    );
    expect(
      dispatch(reload(s), { type: "BASIC", action: "thwart" }).error,
    ).toBeTruthy();
    s = settle(native(s, { type: "discardPiece", id: minion(s, "30032").id }));
    s = settle(command(s, { type: "BASIC", action: "thwart" }));
    expect(s.scheme.threat).toBe(2);
  });
  it("Jennix guard restricts only a seat engaged with an Inheritor and disappears on source removal", () => {
    let s = base(true);
    s = settle(reveal(s, "30034"));
    expect(
      targets(seatView(s, "p2"), "enemy", true).some(
        (p) => p.id === s.villain.id,
      ),
    ).toBe(true);
    s = settle(reveal(s, "30031", "p2"));
    seatView(s, "p2").player.form = "hero";
    actionSeat(s, "p2");
    expect(targets(s, "enemy", true).some((p) => p.id === s.villain.id)).toBe(
      false,
    );
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).toBe(false);
    s = settle(choose(s, minion(s, "30031").id));
    s = settle(native(s, { type: "discardPiece", id: minion(s, "30034").id }));
    expect(targets(s, "enemy", true).some((p) => p.id === s.villain.id)).toBe(
      true,
    );
  });
  it("blanking the recipient leaves externally granted patrol active, but removes its own guard aura", () => {
    let s = settle(reveal(base(), "30032"));
    s = settle(reveal(s, "30034"));
    const recipient = minion(s, "30034").id;
    s = blank(s, recipient);
    s.scheme.threat = 2;
    expect(targets(s, "enemy", true).some((p) => p.id === s.villain.id)).toBe(
      true,
    );
    expect(targets(s, "scheme", false, true).some((p) => p.id === "main")).toBe(
      false,
    );
  });
  it("Daemos clears existing stun/confuse cards on all Inheritors and rejects later native statuses", () => {
    let s = base(true);
    s = settle(reveal(s, "30031"));
    s = settle(reveal(s, "30032", "p2"));
    const ids = s.minions.map((p) => p.id);
    s = settle(
      native(
        s,
        ...ids.flatMap((target) => [
          { type: "status", target, status: "stunned" },
          { type: "status", target, status: "confused" },
        ]),
      ),
    );
    expect(s.minions.every((p) => p.stunned && p.confused)).toBe(true);
    s = settle(reveal(reload(s), "30033"));
    expect(
      s.minions.every(
        (p) => !p.stunned && !p.confused && !p.stunCards && !p.confuseCards,
      ),
    ).toBe(true);
    s = settle(
      native(
        reload(s),
        ...s.minions.flatMap((p) => [
          { type: "status", target: p.id, status: "stunned" },
          { type: "status", target: p.id, status: "confused" },
        ]),
      ),
    );
    expect(s.minions.every((p) => !p.stunned && !p.confused)).toBe(true);
  });
  it("Vivian blanks Daemos, permitting statuses again without restoring statuses already cleared", () => {
    let s = settle(reveal(base(), "30031"));
    const id = minion(s, "30031").id;
    s = settle(native(s, { type: "status", target: id, status: "stunned" }));
    s = settle(reveal(s, "30033"));
    s = blank(s, minion(s, "30033").id);
    expect(minion(s, "30031").stunned).toBe(false);
    s = settle(
      native(
        s,
        { type: "status", target: id, status: "stunned" },
        { type: "status", target: id, status: "confused" },
      ),
    );
    expect(minion(s, "30031")).toMatchObject({ stunned: true, confused: true });
  });
  it("Daemos does not grant stalwart to a non-Inheritor physical encounter minion", () => {
    let s = settle(reveal(base(), "30033"));
    s = settle(reveal(s, "01103"));
    const outsider = minion(s, "01103");
    s = settle(
      native(s, { type: "status", target: outsider.id, status: "stunned" }),
    );
    expect(minion(s, "01103").stunned).toBe(true);
  });
  it("Morlun raises the native ATK of itself and an Inheritor engaged with another seat", () => {
    let s = settle(reveal(base(true), "30036"));
    s = settle(reveal(s, "30031", "p2"));
    const hp = seatView(s, "p2").player.hp;
    s = native(s, {
      type: "enemyAttack",
      id: minion(s, "30031").id,
      actorId: "p2",
    });
    expect(s.attack?.base).toBe(2);
    s = settle(s);
    expect(seatView(s, "p2").player.hp).toBe(hp - 2);
    s = native(s, {
      type: "enemyAttack",
      id: minion(s, "30036").id,
      actorId: "p1",
    });
    expect(s.attack?.base).toBe(3);
    s = settle(s);
  });
  it("removing Morlun removes its global attack bonus from surviving original Inheritors", () => {
    let s = settle(reveal(base(), "30036"));
    s = settle(reveal(s, "30031"));
    s = settle(native(s, { type: "discardPiece", id: minion(s, "30036").id }));
    s = native(s, { type: "enemyAttack", id: minion(s, "30031").id });
    expect(s.attack?.base).toBe(1);
    s = settle(s);
  });
  it("Karn gives a different seat's actual Inheritor attack piercing through identity Tough", () => {
    let s = settle(reveal(base(true), "30035"));
    s = settle(reveal(s, "30032", "p2"));
    s = settle(
      native(s, { type: "status", target: "hero:p2", status: "tough" }),
    );
    expect(inheritorsModifiers(s, minion(s, "30032")).piercing).toBe(true);
    expect(seatView(s, "p2").player).toMatchObject({
      tough: true,
      toughCards: 1,
    });
    s = settle(
      native(s, {
        type: "enemyAttack",
        id: minion(s, "30032").id,
        actorId: "p2",
      }),
    );
    expect(
      seatView(s, "p2").player,
      JSON.stringify({
        sources: s.minions.map((p) => ({
          id: p.id,
          code: p.code,
          blank: isTextBlank(s, p),
        })),
        grants: inheritorsModifiers(s, minion(s, "30032")),
        log: s.log.slice(-5),
      }),
    ).toMatchObject({ hp: 8, tough: false });
  });
  it("Karn gives an actual other-seat ally-defended attack overkill, preserving physical ally ownership", () => {
    let s = settle(reveal(base(true), "30035"));
    s = settle(reveal(s, "30032", "p2"));
    const silk = control(s, "27010", "p2");
    silk.damage = 1;
    s = native(s, {
      type: "enemyAttack",
      id: minion(s, "30032").id,
      actorId: "p2",
    });
    s = settle(choose(reload(s), silk.id));
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === silk.id),
    ).toHaveLength(1);
  });
  it("actual Vivian blanks Karn so a surviving Inheritor no longer pierces Tough or overkills", () => {
    let s = settle(reveal(base(), "30035"));
    s = settle(reveal(s, "30031"));
    s = blank(s, minion(s, "30035").id);
    s = settle(native(s, { type: "status", target: "hero", status: "tough" }));
    s = native(s, { type: "enemyAttack", id: minion(s, "30031").id });
    s = settle(s);
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
  });
  it("a saved Forcefield Projection from another seat prevents Karn's actual piercing overkill through a Tough ally", () => {
    let s = settle(reveal(base(true, "rhino", "nova"), "30035"));
    s = settle(reveal(s, "30036"));
    const brawn = control(s, "29004");
    brawn.damage = 2;
    s = settle(
      native(s, { type: "status", target: brawn.id, status: "tough" }),
    );
    seatView(s, "p2").player.form = "hero";
    const forcefield = source(s, "28003", "p2"),
      energy = source(s, "28005", "p2");
    seatView(s, "p2").player.hand.push(forcefield, energy);
    s = native(s, {
      type: "enemyAttack",
      id: minion(s, "30035").id,
      actorId: "p1",
    });
    s = choose(reload(s), brawn.id);
    expect(s.prompt?.title).toBe("Incoming attack");
    const prevention = s.prompt!.options.find(
      (o) => o.image === "28003" && /overkill damage to/.test(o.label),
    );
    expect(prevention, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(reload(s), prevention!.id);
    expect(s.activePlayerId).toBe("p2");
    s = command(reload(s), { type: "PAY", ids: [energy.id] });
    s = settle(s);
    expect(seatView(s, "p1").player.hp, JSON.stringify(s.log.slice(-15))).toBe(
      10,
    );
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === brawn.id),
    ).toHaveLength(1);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === forcefield.id),
    ).toHaveLength(1);
  });
  it("removing Karn during a saved defender choice removes piercing and overkill from that pending attack", () => {
    let s = settle(reveal(base(), "30035"));
    s = settle(reveal(s, "30036"));
    s = settle(reveal(s, "30032"));
    const brawn = control(s, "29004");
    brawn.damage = 2;
    s = settle(
      native(s, { type: "status", target: brawn.id, status: "tough" }),
    );
    const karnId = minion(s, "30035").id;
    s = native(s, { type: "enemyAttack", id: minion(s, "30032").id });
    // A native leave-play effect occurs within the saved choice continuation;
    // the source must be read again when the pending attack deals its damage.
    s.prompt!.options.find((o) => o.id === brawn.id)!.effects.unshift({
      type: "discardPiece",
      id: karnId,
    });
    s = settle(choose(reload(s), brawn.id));
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)).toMatchObject({
      damage: 2,
      tough: false,
    });
    expect(s.encounter.discard.filter((p) => p.id === karnId)).toHaveLength(1);
  });
  it("Verna grants retaliate to an Inheritor in another seat during an actual basic attack", () => {
    let s = settle(reveal(base(true), "30038", "p2"));
    s = settle(reveal(s, "30031"));
    actionSeat(s, "p1");
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(choose(reload(s), minion(s, "30031").id));
    expect(s.player.hp).toBe(9);
    expect(minion(s, "30031").damage).toBe(2);
  });
  it("an actual ranged ally attack ignores externally granted retaliate", () => {
    let s = settle(reveal(base(), "30038"));
    s = settle(reveal(s, "30031"));
    // Explicit unrelated imported ally fixture; all original source forty
    // and all nine original module instances remain physically conserved.
    const yondu = makePiece(s, "17013");
    yondu.ownerId = "p1";
    s.player.inPlay.push(yondu);
    (s as Fixture).inheritorOriginalIds!.push(yondu.id);
    s = command(s, { type: "ABILITY", id: yondu.id, action: "attack" });
    s = settle(choose(reload(s), minion(s, "30031").id));
    expect(s.player.inPlay.find((p) => p.id === yondu.id)?.damage).toBe(0);
    expect(minion(s, "30031").damage).toBe(1);
  });
  it("removing Verna stops retaliation and ordinary non-attack damage never triggers it", () => {
    let s = settle(reveal(base(), "30038"));
    s = settle(reveal(s, "30031"));
    const target = minion(s, "30031").id;
    s = settle(
      native(s, {
        type: "damage",
        target,
        amount: 1,
        source: "hero",
        attack: false,
      }),
    );
    expect(s.player.hp).toBe(10);
    s = settle(native(s, { type: "discardPiece", id: minion(s, "30038").id }));
    s = command(s, { type: "BASIC", action: "attack" });
    s = settle(choose(s, target));
    expect(s.player.hp).toBe(10);
  });
  it.each([
    [5, 8, true],
    [6, 10, false],
  ] as const)(
    "a simultaneous attack deals %i to Verna and resolves only still-active retaliation",
    (amount, hp, survives) => {
      let s = settle(reveal(base(), "30038"));
      s = settle(reveal(s, "30031"));
      const verna = minion(s, "30038"),
        bora = minion(s, "30031");
      s = settle(
        native(reload(s), {
          type: "waspDistributedAttack",
          basic: false,
          source: "hero",
          packets: [
            { target: verna.id, amount },
            { target: bora.id, amount: 1 },
          ],
        }),
      );
      expect(s.minions.some((p) => p.id === verna.id)).toBe(survives);
      expect(minion(s, "30031").damage).toBe(1);
      expect(s.player.hp).toBe(hp);
    },
  );
});

describe("Solus grants native villainous and stores original physical boosts", () => {
  it.each(["attack", "scheme"])(
    "another seat's actual Inheritor %s gets one physical boost and discards it once",
    (kind) => {
      let s = settle(reveal(base(true), "30037"));
      s = settle(reveal(s, "30031", "p2"));
      const [boost] = top(s, "30038");
      s = settle(
        native(reload(s), {
          type: kind === "attack" ? "enemyAttack" : "enemyScheme",
          id: minion(s, "30031").id,
          actorId: "p2",
        }),
      );
      if (kind === "attack") expect(seatView(s, "p2").player.hp).toBe(7);
      else expect(s.scheme.threat).toBe(5);
      expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
        1,
      );
      expect(s.minions.some((p) => p.id === boost.id)).toBe(false);
    },
  );
  it("Solus's conditional stored boost joins its normal villainous boost in one actual saved attack", () => {
    let s = base(true);
    seatView(s, "p2").player.form = "hero";
    const [extra, normal] = top(s, "30031", "30032");
    s = settle(reveal(s, "30037"));
    const solus = minion(s, "30037");
    expect(boosts(s, solus).map((p) => p.id)).toEqual([extra.id]);
    expect(s.encounter.deck[0].id).toBe(normal.id);
    s = native(reload(s), { type: "enemyAttack", id: solus.id, actorId: "p1" });
    expect(s.attack?.pendingBoosts?.map((p) => p.id).sort()).toEqual(
      [extra.id, normal.id].sort(),
    );
    expect(boosts(s, solus)).toHaveLength(0);
    s = settle(s);
    expect(s.player.hp).toBe(3);
    for (const p of [extra, normal])
      expect(s.encounter.discard.filter((x) => x.id === p.id)).toHaveLength(1);
    expect(s.minions).toHaveLength(1);
  });
  it("a stunned canceled Solus activation preserves its stored boost; leave-play discards that physical card", () => {
    let s = base(true);
    seatView(s, "p2").player.form = "hero";
    const [extra] = top(s, "30031");
    s = settle(reveal(s, "30037"));
    const solus = minion(s, "30037");
    s = settle(
      native(
        s,
        { type: "status", target: solus.id, status: "stunned" },
        { type: "enemyAttack", id: solus.id },
      ),
    );
    expect(boosts(s, solus).map((p) => p.id)).toEqual([extra.id]);
    expect(s.player.hp).toBe(10);
    s = settle(native(reload(s), { type: "discardPiece", id: solus.id }));
    expect(s.encounter.discard.filter((p) => p.id === extra.id)).toHaveLength(
      1,
    );
    expect(s.encounter.discard.filter((p) => p.id === solus.id)).toHaveLength(
      1,
    );
  });
  it("removing Solus immediately stops normal villainous boosts on surviving Inheritors", () => {
    let s = settle(reveal(base(), "30037"));
    s = settle(reveal(s, "30031"));
    s = settle(native(s, { type: "discardPiece", id: minion(s, "30037").id }));
    const before = s.encounter.deck.map((p) => p.id);
    s = settle(native(s, { type: "enemyAttack", id: minion(s, "30031").id }));
    expect(s.player.hp).toBe(9);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
  });
});

describe("Hunting the Spider-Totems at the native villain-phase boundary", () => {
  it("has fixed six threat with two players", () => {
    const s = settle(reveal(base(true), "30030"));
    expect(s.sideSchemes[0].counters).toBe(6);
  });
  it("discards exactly three original top cards, puts only Inheritors into play, and leaves the fourth untouched", () => {
    let s = settle(reveal(base(), "30030"));
    const [one, nonInheritor, three, fourth] = top(
      s,
      "30031",
      "01103",
      "30034",
      "30036",
    );
    s = settle(hunt(reload(s)));
    expect(s.minions.map((p) => p.id)).toEqual([one.id, three.id]);
    expect(s.minions.every((p) => p.engagedWith === "p1")).toBe(true);
    expect(
      s.encounter.discard.filter((p) => p.id === nonInheritor.id),
    ).toHaveLength(1);
    expect(s.encounter.deck[0].id).toBe(fourth.id);
    expect(s.player.hp).toBe(10);
    expect(s.scheme.threat).toBe(0);
  });
  it("putting Inheritors into play does not reveal their conditional effects even with a Web-Warrior", () => {
    let s = settle(reveal(base(true), "30030"));
    seatView(s, "p2").player.form = "hero";
    const [jennix, morlun, solus, untouched] = top(
      s,
      "30034",
      "30036",
      "30037",
      "30038",
    );
    s = settle(hunt(reload(s)));
    expect(s.minions.map((p) => p.id)).toEqual([
      jennix.id,
      morlun.id,
      solus.id,
    ]);
    expect(s.minions.every((p) => p.engagedWith === "p2")).toBe(true);
    expect(minion(s, "30034").tough).toBe(false);
    expect(boosts(s, solus)).toHaveLength(0);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.encounter.deck[0].id).toBe(untouched.id);
  });
  it("the first player chooses each qualified recipient across JSON reloads", () => {
    let s = settle(reveal(base(true), "30030"));
    const silk = source(s, "27010", "p2");
    seatView(s, "p1").player.inPlay.push(silk);
    seatView(s, "p2").player.form = "hero";
    s.firstPlayerId = "p2";
    const [one, two, three] = top(s, "30031", "30032", "30034");
    s = hunt(reload(s));
    for (const [piece, recipient] of [
      [one, "p1"],
      [two, "p2"],
      [three, "p1"],
    ] as const) {
      expect(s.activePlayerId).toBe("p2");
      expect(s.prompt?.title).toBe("Hunting the Spider-Totems");
      expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(["p1", "p2"]);
      s = choose(reload(s), recipient);
      expect(s.minions.find((p) => p.id === piece.id)?.engagedWith).toBe(
        recipient,
      );
    }
    s = settle(s);
    expect(s.player.hp).toBe(10);
    expect(s.scheme.threat).toBe(0);
  });
  it("no qualifying character means first-player fallback, independent of the acting seat", () => {
    let s = settle(reveal(base(true), "30030"));
    s.firstPlayerId = "p2";
    actionSeat(s, "p1");
    const [one, two, three] = top(s, "30031", "30032", "30034");
    s = settle(hunt(reload(s)));
    for (const p of [one, two, three])
      expect(s.minions.find((x) => x.id === p.id)?.engagedWith).toBe("p2");
    expect(s.prompt).toBeNull();
  });
  it("an exhausted two-card encounter deck stops the discard instruction at its shuffle boundary", () => {
    for (const second of ["30034", "01103"]) {
      let s = settle(reveal(base(), "30030"));
      const [one, two] = top(s, "30031", second);
      const remainder = s.encounter.deck.splice(2);
      // Retain every other original physical encounter outside the exhausted
      // deck. Only these two cards can be discarded by this top-three effect.
      s.removed.push(...remainder);
      s = settle(hunt(reload(s)));
      expect(s.encounter.acceleration).toBe(1);
      expect(s.minions.map((p) => p.id).sort()).toEqual(
        (second === "30034" ? [one.id, two.id] : [one.id]).sort(),
      );
      expect(s.encounter.deck.map((p) => p.id)).toEqual(
        second === "30034" ? [] : [two.id],
      );
      expect(s.encounter.discard).toHaveLength(0);
      expect(s.player.hp).toBe(10);
    }
  });
  it("actual END_TURN runs Hunting before threat, with Bora's new icons counted in that same phase", () => {
    let s = settle(reveal(base(true), "30030"));
    const silk = source(s, "27010", "p2");
    s.player.inPlay.push(silk);
    seatView(s, "p2").player.form = "hero";
    const [bora, jennix, solus] = top(s, "30031", "30034", "30037");
    s = command(s, { type: "END_TURN", discard: [] });
    s = command(s, { type: "END_TURN", discard: [] });
    for (let n = 0; s.prompt?.kind === "select" && n < 2; n++)
      s = command(reload(s), { type: "SELECT", ids: [] });
    expect(s.phase).toBe("villain");
    for (const [p, recipient] of [
      [bora, "p2"],
      [jennix, "p1"],
      [solus, "p2"],
    ] as const) {
      expect(s.prompt?.title).toBe("Hunting the Spider-Totems");
      expect(s.scheme.threat).toBe(0);
      s = choose(reload(s), recipient);
      expect(s.minions.find((x) => x.id === p.id)?.engagedWith).toBe(recipient);
    }
    expect(s.scheme.threat).toBe(5);
    expect(minion(s, "30034").tough).toBe(false);
    expect(boosts(s, solus)).toHaveLength(0);
    expect(s.prompt?.title).toMatch(/attacks/);
    exact(s);
  });
  it("a lethal first-player Air Static interrupt does not cancel the remaining Hunting interrupt or phase threat", () => {
    let s = settle(reveal(base(true, "rhino", "spider_man"), "30030"));
    const huntingId = s.sideSchemes[0].id;
    // Explicit mixed-source timing control: Air Static is an additional
    // original imported face beside the untouched nine-card Inheritors set.
    const air = makePiece(s, "29039");
    (s as Fixture).inheritorOriginalIds!.push(air.id);
    s = settle(
      native(s, { type: "reveal", piece: air, actorId: "p1", skip: true }),
    );
    s.player.hand.push(source(s, "29006"));
    s.player.hp = 1;
    seatView(s, "p2").player.form = "hero";
    const [bora, outsider, jennix, boost] = top(
      s,
      "30031",
      "01103",
      "30034",
      "30036",
    );
    s = native(reload(s), { type: "beginVillain" });
    expect(s.prompt?.title).toBe("Villain phase · forced interrupt order");
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      [air.id, huntingId].sort(),
    );
    expect(s.scheme.threat).toBe(0);
    s = choose(reload(s), air.id);
    expect(s.prompt?.text).toMatch(/remaining indirect damage/);
    expect(s.activePlayerId).toBe("p1");
    expect(s.scheme.threat).toBe(0);
    s = choose(reload(s), "hero");
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(s.firstPlayerId).toBe("p2");
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.minions.map((p) => p.id)).toEqual([bora.id, jennix.id]);
    expect(s.minions.every((p) => p.engagedWith === "p2")).toBe(true);
    expect(
      s.encounter.discard.filter((p) => p.id === outsider.id),
    ).toHaveLength(1);
    expect(s.scheme.threat).toBe(4);
    expect(s.prompt?.title).toMatch(/attacks/);
    expect(s.attack?.targetPlayerId).toBe("p2");
    expect(s.attack?.pendingBoosts?.map((p) => p.id)).toEqual([boost.id]);
    expect(
      physical(s)
        .filter((p) => card(p).set_code === "inheritors")
        .map((p) => p.code)
        .sort(),
    ).toEqual(codes);
    exact(s);
  });
  it("actual Vivian blanks Hunting and suppresses its entire native phase trigger", () => {
    let s = settle(reveal(base(), "30030"));
    s = blank(s, s.sideSchemes[0].id);
    const before = s.encounter.deck.map((p) => p.id);
    s = settle(hunt(reload(s)));
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
    expect(s.minions).toHaveLength(0);
  });
});
