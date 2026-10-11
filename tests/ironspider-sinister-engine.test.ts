/** Native commands use original forty-card sources and the actual eight-card
 * module. Every original physical instance is conserved without deduplication. */
import { describe, expect, it } from "vitest";
import { abilityOptions, newGame, targets } from "../src/game/engine.js";
import {
  card,
  deckCodes,
  enemyAttachmentModifier,
  MODULES,
  pieceHP,
} from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import { choose, command, native, reload } from "./dv-test-helpers.js";

type Fixture = GameState & { ironspiderOriginalIds?: string[] };
const codes = Array.from({ length: 8 }, (_, n) => String(31030 + n));
function physical(s: GameState): Piece[] {
  const walk = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(walk),
    ...(p.captured || []).flatMap(walk),
    ...(p.droneCard ? walk(p.droneCard) : []),
    ...(p.inheritorBoosts || []).flatMap(walk),
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
        ...(p.invocationDeck || []),
        ...(p.invocationDiscard || []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
        ...(p.spiderHamIdentity ? [p.spiderHamIdentity] : []),
        ...(p.spdrIdentity ? [p.spdrIdentity] : []),
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
  ].flatMap(walk);
}
function exact(s: GameState) {
  const all = physical(s);
  for (const id of (s as Fixture).ironspiderOriginalIds || [])
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
        [
          "take",
          "allow",
          "skip",
          "pass",
          "continue",
          "no",
          "resolve",
          "none",
        ].includes(o.id),
      )?.id ||
      (/remaining indirect damage/.test(s.prompt.text)
        ? s.prompt.options.find((o) => o.id === "hero")?.id
        : undefined) ||
      (s.prompt.title === "Forced responses" || s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(reload(s), id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}
function base(
  team = false,
  villainId = "rhino",
  secondHero = "spider_man",
  firstHero = "ironheart",
) {
  const iron = {
    heroId: firstHero,
    ...(firstHero === "doctor_strange"
      ? {
          deckCards: catalogDeckCodes(
            STARTER_DECKS.find((d) => d.heroCode === "09001a")!,
          ),
        }
      : {}),
    aspect:
      firstHero === "doctor_strange" || firstHero === "spdr"
        ? ("protection" as const)
        : firstHero === "wsp"
          ? ("aggression" as const)
          : ("leadership" as const),
  };
  let s = newGame({
    ...iron,
    villainId,
    module: "ironspider_sinister",
    seed: 31030,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            iron,
            {
              heroId: secondHero,
              aspect:
                secondHero === "drax"
                  ? ("protection" as const)
                  : ("justice" as const),
            },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  expect(s.phase).toBe("player");
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const identities = p.inPlay.filter((p) =>
      ["31001a", "31001b", "31002a", "31002b"].includes(p.code),
    );
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay].filter(
      (p) => !identities.some((identity) => identity.id === p.id),
    );
    expect(source).toHaveLength(40);
    expect(source.map((p) => p.code).sort()).toEqual(
      (seat.heroId === "doctor_strange"
        ? catalogDeckCodes(STARTER_DECKS.find((d) => d.heroCode === "09001a")!)
        : deckCodes(seat.heroId, seat.aspect)
      ).sort(),
    );
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = identities;
    p.form = ["spdr", "wsp"].includes(seat.heroId) ? "alter" : "hero";
    p.exhausted = p.flipped = p.stunned = p.confused = p.tough = false;
  }
  (s as Fixture).ironspiderOriginalIds = physical(s).map((p) => p.id);
  s.scheme.threat = 0;
  activateSeat(s, "p1");
  if (firstHero === "spdr") s = command(reload(s), { type: "FLIP" });
  if (firstHero === "wsp")
    s = settle(command(reload(s), { type: "FLIP", target: "giant" }));
  return s;
}
function source(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard, p.inPlay]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing actual source ${seatId}:${code}`);
}
function hand(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = source(s, code, seatId);
  seatView(s, seatId).player.hand.push(p);
  return p;
}
function control(s: GameState, code: string, seatId = s.activePlayerId) {
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
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing actual encounter ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
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
function top(s: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => encounter(s, code));
  s.encounter.deck.unshift(...pieces);
  return pieces;
}
function attack(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "enemyAttack", id: minion(s, code).id, actorId });
}
function basicAttack(s: GameState, id: string) {
  s = command(s, { type: "BASIC", action: "attack" });
  if (s.prompt?.options.some((p) => p.id === id)) s = choose(reload(s), id);
  return settle(s);
}
function blankWithVivian(s: GameState, id: string) {
  const p = physical(s).find((p) => p.id === id)!;
  const vivian = hand(s, "29024");
  const resources = [hand(s, "29005"), hand(s, "29013")];
  s = command(s, { type: "PLAY", id: vivian.id });
  s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
  expect(s.prompt?.title).toBe("Vivian");
  s = choose(reload(s), "yes");
  s = choose(reload(s), id);
  s = settle(s);
  if (
    physical(s).some((p) => p.id === id && s.minions.some((q) => q.id === id))
  )
    expect(isTextBlank(s, p)).toBe(true);
  return s;
}
function indirect(s: GameState, ...ids: string[]) {
  for (const id of ids) {
    expect(s.prompt?.text, JSON.stringify(s.prompt)).toMatch(
      /remaining indirect damage/,
    );
    s = choose(reload(s), id);
  }
  return settle(s);
}

describe("Eight original Iron Spider's Sinister Six physical cards", () => {
  it("registers every executable face beside an unchanged original source forty", () => {
    const s = base();
    expect(MODULES.some((m) => m.id === "ironspider_sinister")).toBe(true);
    expect(
      physical(s)
        .filter((p) => card(p).set_code === "ironspider_sinister")
        .map((p) => p.code)
        .sort(),
    ).toEqual(codes);
    for (const code of codes)
      expect(hasExecutableScript(code), code).toBe(true);
    exact(s);
  });
  it.each(["rhino", "klaw", "ultron", "mutagen_formula", "risky_business"])(
    "preserves all eight unique physical copies through %s setup",
    (villainId) => {
      const s = newGame({
        heroId: "ironheart",
        aspect: "leadership",
        villainId,
        module: "ironspider_sinister",
        seed: 31030,
      });
      const pieces = physical(s).filter(
        (p) => card(p).set_code === "ironspider_sinister",
      );
      expect(pieces.map((p) => p.code).sort()).toEqual(codes);
      expect(new Set(pieces.map((p) => p.id)).size).toBe(8);
    },
  );
  it.each([false, true])(
    "Grand Larceny has fixed four threat with team=%s",
    (team) => {
      const s = settle(reveal(base(team), "31030"));
      expect(s.sideSchemes[0].counters).toBe(4);
      expect(card(s.sideSchemes[0]).scheme_crisis).toBe(1);
    },
  );
  it("a Criminal at another seat blocks basic and copied removal from Grand Larceny", () => {
    let s = settle(reveal(base(true), "31030"));
    s = settle(reveal(s, "31036", "p2"));
    const id = s.sideSchemes[0].id;
    expect(targets(s, "scheme", false, true).some((p) => p.id === id)).toBe(
      false,
    );
    s = settle(
      native(s, {
        type: "thwart",
        target: id,
        amount: 4,
        source: "unlabelled",
      }),
    );
    expect(s.sideSchemes[0].counters).toBe(4);
    s = settle(native(s, { type: "discardPiece", id: minion(s, "31036").id }));
    s = settle(native(reload(s), { type: "thwart", target: id, amount: 4 }));
    expect(s.sideSchemes.some((p) => p.id === id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("actual Vivian blanking unlocks Grand Larceny despite a remaining Criminal", () => {
    let s = settle(reveal(base(), "31030"));
    s = settle(reveal(s, "31036"));
    const id = s.sideSchemes[0].id;
    s = blankWithVivian(s, id);
    s = settle(native(s, { type: "thwart", target: id, amount: 4 }));
    expect(s.sideSchemes.some((p) => p.id === id)).toBe(false);
  });
});

describe("Electro actual hand ownership, dynamic HP and activation timing", () => {
  it("original VEN#m attached for Energy grants HP without its ally ATK leaking into Electro's attack", () => {
    let s = base(false, "rhino", "spider_man", "spdr");
    const venm = hand(s, "31003");
    s = settle(reveal(s, "31032"), () => venm.id);
    const electro = minion(s, "31032");
    expect(s.attachments.find((p) => p.id === venm.id)).toMatchObject({
      attachedTo: electro.id,
      ownerId: "p1",
    });
    expect(pieceHP(s, electro)).toBe(4);
    expect(enemyAttachmentModifier(s, electro.id, "attack")).toBe(0);
    s = attack(reload(s), "31032");
    expect(s.attack?.base).toBe(2);
    s = settle(choose(reload(s), "take"));
    expect(s.player.hp).toBe(12);
    expect(pieceHP(s, minion(s, "31032"))).toBe(4);
    expect(s.attachments.filter((p) => p.id === venm.id)).toHaveLength(1);
  });
  it("attaches one actual Energy resource card on engagement and gains two HP", () => {
    let s = base(true);
    const energy = hand(s, "01088", "p2");
    const mental = hand(s, "01089", "p2");
    s = reveal(s, "31032", "p2");
    expect(s.prompt?.title).toBe("Electro · Forced Response");
    expect(s.prompt?.options.map((p) => p.id)).toEqual([energy.id]);
    s = settle(choose(reload(s), energy.id));
    expect(seatView(s, "p2").player.hand.map((p) => p.id)).toEqual([mental.id]);
    expect(s.attachments.find((p) => p.id === energy.id)).toMatchObject({
      attachedTo: minion(s, "31032").id,
      ownerId: "p2",
    });
    expect(pieceHP(s, minion(s, "31032"))).toBe(5);
  });
  it("forces another actual attachment only after Electro's attack completes", () => {
    let s = settle(reveal(base(), "31032"));
    const energy = hand(s, "29006");
    s = attack(s, "31032");
    expect(s.prompt?.title).toMatch(/attacks/);
    s = choose(reload(s), "take");
    s = settle(s, (v) =>
      v.prompt?.title === "Electro · Forced Response" ? energy.id : undefined,
    );
    expect(s.player.hp).toBe(8);
    expect(s.attachments.find((p) => p.id === energy.id)?.attachedTo).toBe(
      minion(s, "31032").id,
    );
    expect(pieceHP(s, minion(s, "31032"))).toBe(4);
  });
  it("Electro's actual alter-ego scheme attaches the attacked seat's Energy card", () => {
    let s = settle(reveal(base(true), "31032", "p2"));
    seatView(s, "p2").player.form = "alter";
    const energy = hand(s, "01088", "p2");
    s = native(s, {
      type: "enemyScheme",
      id: minion(s, "31032").id,
      actorId: "p2",
    });
    expect(s.prompt?.title).toBe("Electro · Forced Response");
    s = settle(choose(reload(s), energy.id));
    expect(s.scheme.threat).toBe(1);
    expect(s.attachments.find((p) => p.id === energy.id)?.ownerId).toBe("p2");
    expect(pieceHP(s, minion(s, "31032"))).toBe(5);
  });
  it("a stun-canceled Electro attack keeps Energy in hand and gives no new attachment", () => {
    let s = settle(reveal(base(), "31032"));
    const energy = hand(s, "29006");
    s = settle(
      native(s, {
        type: "status",
        target: minion(s, "31032").id,
        status: "stunned",
      }),
    );
    s = settle(attack(reload(s), "31032"));
    expect(s.player.hp).toBe(10);
    expect(s.player.hand.some((p) => p.id === energy.id)).toBe(true);
    expect(s.attachments).toHaveLength(0);
  });
  it("returns every attached actual hand card to its owner's discard on Electro defeat", () => {
    let s = base(true);
    const one = hand(s, "01088", "p2");
    s = settle(reveal(s, "31032", "p2"), () => one.id);
    const electro = minion(s, "31032");
    const two = hand(s, "29006", "p1");
    s = settle(attack(s, "31032", "p1"), (v) =>
      v.prompt?.title === "Electro · Forced Response" ? two.id : undefined,
    );
    expect(pieceHP(s, minion(s, "31032"))).toBe(6);
    s = settle(
      native(reload(s), { type: "damage", target: electro.id, amount: 6 }),
    );
    expect(s.minions.some((p) => p.id === electro.id)).toBe(false);
    expect(s.attachments.some((p) => p.attachedTo === electro.id)).toBe(false);
    expect(
      seatView(s, "p2").player.discard.filter((q) => q.id === one.id),
    ).toHaveLength(1);
    expect(
      seatView(s, "p1").player.discard.filter((q) => q.id === two.id),
    ).toHaveLength(1);
  });
  it("actual Vivian blanking removes Electro's bonus and immediately defeats at printed HP", () => {
    let s = base();
    const energy = hand(s, "29006");
    s = settle(reveal(s, "31032"), () => energy.id);
    const id = minion(s, "31032").id;
    s = settle(native(s, { type: "damage", target: id, amount: 3 }));
    expect(s.minions.some((p) => p.id === id)).toBe(true);
    s = blankWithVivian(s, id);
    expect(s.minions.some((p) => p.id === id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === energy.id)).toHaveLength(1);
  });
  it("another player's ally defense changes whose hand Electro takes after its activation", () => {
    let s = settle(reveal(base(true), "31032"));
    const ownEnergy = hand(s, "29006", "p1");
    const energy = hand(s, "01088", "p2");
    const blackCat = control(s, "01002", "p2");
    s = attack(s, "31032", "p1");
    s = choose(reload(s), blackCat.id);
    expect(s.prompt?.title).toBe("Electro · Forced Response");
    s = settle(choose(reload(s), energy.id));
    expect(
      seatView(s, "p1").player.hand.some((p) => p.id === ownEnergy.id),
    ).toBe(true);
    expect(s.attachments.find((p) => p.id === energy.id)?.ownerId).toBe("p2");
    expect(minion(s, "31032").engagedWith).toBe("p1");
    expect(pieceHP(s, minion(s, "31032"))).toBe(5);
  });
  it("Electro reengages the surviving seat on player defeat and takes exactly one new hand card", () => {
    let s = settle(reveal(base(true), "31032"));
    const energy = hand(s, "01088", "p2");
    const second = hand(s, "01006", "p2");
    s.player.hp = 1;
    s = attack(s, "31032", "p1");
    s = choose(reload(s), "take");
    expect(s.players[0].eliminated).toBe(true);
    expect(s.prompt?.title).toBe("Electro · Forced Response");
    expect(s.prompt?.options.map((p) => p.id).sort()).toEqual(
      [energy.id, second.id].sort(),
    );
    s = settle(choose(reload(s), energy.id));
    expect(minion(s, "31032").engagedWith).toBe("p2");
    expect(
      s.attachments
        .filter((p) => p.attachedTo === minion(s, "31032").id)
        .map((p) => p.id),
    ).toEqual([energy.id]);
    expect(seatView(s, "p2").player.hand.some((p) => p.id === second.id)).toBe(
      true,
    );
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.attack).toBeNull();
  });
});

describe("Hobgoblin replaces would-attack before defense and boosts", () => {
  it("discards actual current-ATK top cards and deals the ordinary boost-icon total indirectly", () => {
    let s = settle(reveal(base(), "31033"));
    const id = minion(s, "31033").id;
    const pieces = top(s, "31030", "31034", "31036");
    const before = s.player.hp;
    s = attack(reload(s), "31033");
    expect(s.attack).toBeNull();
    expect(s.prompt?.text).toMatch(/remaining indirect damage/);
    s = indirect(s, ...Array(6).fill("hero"));
    expect(s.player.hp).toBe(before - 6);
    expect(s.player.exhausted).toBe(false);
    expect(s.encounter.deck[0].id).toBe(pieces[2].id);
    for (const p of pieces.slice(0, 2))
      expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(Number(s.enemyAttackCounts?.[id] || 0)).toBe(0);
  });
  it("a stunned Hobgoblin consumes Stun before replacement without discarding or damage", () => {
    let s = settle(reveal(base(), "31033"));
    const before = s.encounter.deck.map((p) => p.id);
    s = settle(
      native(s, {
        type: "status",
        target: minion(s, "31033").id,
        status: "stunned",
      }),
    );
    s = settle(attack(reload(s), "31033"));
    expect(s.player.hp).toBe(10);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
    expect(minion(s, "31033").stunned).toBe(false);
    expect(s.player.exhausted).toBe(false);
  });
  it("actual Vivian restores Hobgoblin's ordinary attack with no encounter discard", () => {
    let s = settle(reveal(base(), "31033"));
    s = blankWithVivian(s, minion(s, "31033").id);
    const before = s.encounter.deck.map((p) => p.id);
    const hp = s.player.hp;
    s = settle(attack(s, "31033"));
    expect(s.player.hp).toBe(hp - 2);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
  });
  it("stops at the actual empty-deck boundary, places one acceleration and preserves every ID", () => {
    let s = settle(reveal(base(), "31033"));
    const last = encounter(s, "31030");
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck.push(last);
    s = attack(s, "31033");
    s = indirect(s, "hero", "hero", "hero");
    expect(s.encounter.acceleration).toBe(1);
    expect(s.player.hp).toBe(7);
    exact(s);
  });
  it("counts the native +1 ATK from an actual reserved Gobbler Glider attached after its owner nemesis enters", () => {
    let s = settle(reveal(base(true, "rhino", "spiderham"), "31033"));
    s = settle(reveal(s, "01190", "p2"));
    const gobbler = minion(s, "30026");
    const glider = physical(s).find((p) => p.code === "30027")!;
    expect(glider.ownerId).toBe("p2");
    s = settle(
      native(s, { type: "discardPiece", id: gobbler.id, actorId: "p2" }),
    );
    s = settle(reveal(s, "30027", "p1"));
    expect(s.attachments.find((p) => p.id === glider.id)?.attachedTo).toBe(
      minion(s, "31033").id,
    );
    expect(enemyAttachmentModifier(s, minion(s, "31033").id, "attack")).toBe(1);
    const pieces = top(s, "31030", "31034", "31036", "31035");
    s = attack(s, "31033", "p1");
    s = indirect(s, ...Array(6).fill("hero"));
    expect(seatView(s, "p1").player.hp).toBe(4);
    expect(s.encounter.deck[0].id).toBe(pieces[3].id);
    for (const p of pieces.slice(0, 3))
      expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.minions.some((p) => p.code === "31036")).toBe(false);
  });
});

describe("Bombshell ordinary attack allocation and actual boost damage", () => {
  it("with no allies completes one actual ordinary attack for three damage", () => {
    let s = settle(reveal(base(), "31031"));
    const id = minion(s, "31031").id;
    s = settle(attack(s, "31031"));
    expect(s.player.hp).toBe(7);
    expect(s.enemyAttackCounts?.[id]).toBe(1);
    expect(s.attack).toBeNull();
  });
  it("distributes a three-damage actual attack across all three controlled characters", () => {
    let s = settle(reveal(base(), "31031"));
    const brawn = control(s, "29004");
    const falcon = control(s, "29015");
    s = settle(attack(reload(s), "31031"));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === falcon.id)?.damage).toBe(1);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.every((p) => !p.exhausted)).toBe(true);
  });
  it("saves a remainder choice and gives the chosen actual ally two, identity one", () => {
    let s = settle(reveal(base(), "31031"));
    const brawn = control(s, "29004");
    s = attack(s, "31031");
    s = choose(reload(s), "take");
    expect(s.prompt?.title).toBe("Bombshell · divide attack damage");
    expect(s.prompt?.options.map((p) => p.id)).toEqual(["hero:p1", brawn.id]);
    s = settle(choose(reload(s), brawn.id));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(2);
    expect(s.attack).toBeNull();
  });
  it("basic hero defense reduces the total before each controlled character receives its share", () => {
    let s = settle(reveal(base(), "31031"));
    const brawn = control(s, "29004");
    s = attack(s, "31031");
    s = settle(choose(reload(s), "hero"));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(0);
  });
  it("Tough prevents only the ally's saved share without redistributing damage", () => {
    let s = settle(reveal(base(), "31031"));
    const brawn = control(s, "29004");
    s = settle(
      native(s, { type: "status", target: brawn.id, status: "tough" }),
    );
    s = attack(s, "31031");
    s = choose(reload(s), "take");
    s = settle(choose(reload(s), brawn.id));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
  });
  it("a Tough ally defender is not stripped of Tough before damage division", () => {
    let s = settle(reveal(base(), "31031"));
    const brawn = control(s, "29004");
    s = settle(
      native(s, { type: "status", target: brawn.id, status: "tough" }),
    );
    s = attack(s, "31031");
    s = choose(reload(s), brawn.id);
    s = settle(choose(reload(s), "hero:p1"));
    expect(s.player.hp).toBe(8);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)).toMatchObject({
      damage: 0,
      tough: false,
      exhausted: true,
    });
  });
  it("Tough Drax takes zero while his actual Mantis takes her allocated attack damage", () => {
    let s = settle(reveal(base(true, "rhino", "drax"), "31031", "p2"));
    const mantis = control(s, "19002", "p2");
    s = settle(
      native(s, { type: "status", target: "hero:p2", status: "tough" }),
    );
    s = attack(s, "31031", "p2");
    s = choose(reload(s), "take");
    s = settle(choose(reload(s), mantis.id));
    expect(seatView(s, "p2").player).toMatchObject({ hp: 14, tough: false });
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === mantis.id),
    ).toMatchObject({ damage: 2, exhausted: false });
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(s.attack).toBeNull();
  });
  it("Unflappable sees the actual Tough defender's zero damage when Wong takes positive attack damage", () => {
    let s = base(true, "rhino", "drax", "doctor_strange");
    const initialIds = new Set((s as Fixture).ironspiderOriginalIds);
    s = settle(reveal(s, "01190", "p2"));
    // This older hero's native Shadows handler creates the printed nemesis
    // set when it enters. Track those five physical IDs for the entire attack.
    const nemesis = physical(s).filter((p) => !initialIds.has(p.id));
    expect(nemesis.map((p) => p.code).sort()).toEqual([
      "19026",
      "19027",
      "19028",
      "19029",
      "19029",
    ]);
    (s as Fixture).ironspiderOriginalIds!.push(...nemesis.map((p) => p.id));
    exact(s);
    expect(s.sideSchemes.some((p) => p.code === "19026")).toBe(true);
    s = settle(reveal(s, "31031", "p1"));
    const wong = control(s, "09002", "p1");
    const unflappable = control(s, "09020", "p1");
    s = settle(
      native(s, { type: "status", target: "hero:p1", status: "tough" }),
    );
    const nextDraw = seatView(s, "p1").player.deck[0];
    s = attack(s, "31031", "p1");
    s = choose(reload(s), "hero");
    expect(s.prompt?.title).toBe("Bombshell · divide attack damage");
    s = choose(reload(s), wong.id);
    expect(s.prompt?.title).toBe("Unflappable");
    s = settle(choose(reload(s), "yes"));
    expect(seatView(s, "p1").player).toMatchObject({
      hp: 10,
      tough: false,
      exhausted: true,
    });
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === wong.id)?.damage,
    ).toBe(2);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === unflappable.id)
        ?.exhausted,
    ).toBe(true);
    expect(seatView(s, "p1").player.hand.map((p) => p.id)).toEqual([
      nextDraw.id,
    ]);
    expect(seatView(s, "p2").player.hp).toBe(14);
  });
  it("lethal allocated damage defeats the actual low-HP ally without adding its excess to the identity", () => {
    let s = settle(reveal(base(), "31031"));
    const brawn = control(s, "29004");
    brawn.damage = 2;
    s = attack(s, "31031");
    s = choose(reload(s), "take");
    s = settle(choose(reload(s), brawn.id));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.some((p) => p.id === brawn.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === brawn.id)).toHaveLength(1);
  });
  it("a teammate ally defense changes the attacked player and all allocation recipients", () => {
    let s = settle(reveal(base(true), "31031"));
    const own = control(s, "29004", "p1");
    const ally = control(s, "01002", "p2");
    s = attack(s, "31031", "p1");
    s = choose(reload(s), ally.id);
    expect(s.prompt?.title).toBe("Bombshell · divide attack damage");
    expect(s.prompt?.options.map((p) => p.id)).toEqual(["hero:p2", ally.id]);
    s = settle(choose(reload(s), ally.id));
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === own.id)?.damage,
    ).toBe(0);
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === ally.id),
    ).toHaveLength(1);
  });
  it("actual Vivian blanking restores one ordinary defender damage packet", () => {
    let s = settle(reveal(base(), "31031"));
    s = blankWithVivian(s, minion(s, "31031").id);
    const brawn = control(s, "29004");
    s = settle(attack(s, "31031"));
    expect(s.player.hp).toBe(7);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(0);
    expect(s.player.inPlay.find((p) => p.code === "29024")?.damage).toBe(0);
  });
  it("actual Bombshell boost assigns one indirect to each seat and exhausts only actual-damaged characters", () => {
    let s = base(true);
    const brawn = control(s, "29004", "p1");
    const [bomb] = top(s, "31031");
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p1" });
    s = choose(reload(s), "take");
    expect(s.prompt?.text).toMatch(/remaining indirect damage/);
    s = choose(reload(s), brawn.id);
    expect(s.prompt?.text).toMatch(/remaining indirect damage/);
    s = choose(reload(s), "hero");
    s = settle(s);
    expect(seatView(s, "p1").player.hp).toBe(8);
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === brawn.id),
    ).toMatchObject({ damage: 1, exhausted: true });
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(s.encounter.discard.filter((p) => p.id === bomb.id)).toHaveLength(1);
  });
  it("a Tough boost allocation prevents damage and leaves that character ready", () => {
    let s = base(true);
    const brawn = control(s, "29004", "p1");
    s = settle(
      native(s, { type: "status", target: brawn.id, status: "tough" }),
    );
    top(s, "31031");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = choose(reload(s), "take");
    s = choose(reload(s), brawn.id);
    s = choose(reload(s), "hero");
    s = settle(s);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === brawn.id),
    ).toMatchObject({ damage: 0, exhausted: false, tough: false });
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
  });
  it("a lethal first-player boost allocation still damages the other seat exactly once", () => {
    let s = base(true);
    s.player.hp = 1;
    const [bomb] = top(s, "31031");
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p1" });
    s = choose(reload(s), "take");
    s = choose(reload(s), "hero");
    expect(s.players[0].eliminated).toBe(true);
    expect(s.prompt?.text).toMatch(/remaining indirect damage/);
    s = settle(choose(reload(s), "hero"));
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(s.encounter.discard.filter((p) => p.id === bomb.id)).toHaveLength(1);
    expect(s.attack).toBeNull();
  });
  it("a lethal allocated Bombshell attack cleans its actual ally while the surviving teammate stays untouched", () => {
    let s = settle(reveal(base(true), "31031"));
    const brawn = control(s, "29004");
    brawn.damage = 2;
    s.player.hp = 1;
    s = attack(s, "31031");
    s = choose(reload(s), "take");
    s = settle(choose(reload(s), "hero:p1"));
    expect(s.players[0].eliminated).toBe(true);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(seatView(s, "p1").player.inPlay).toHaveLength(0);
    expect(s.removed.filter((p) => p.id === brawn.id)).toHaveLength(1);
    expect(s.attack).toBeNull();
  });
});

describe("Iron Spider native keywords and overkill", () => {
  it("enters Tough and blocks villain basic attacks and main-scheme basic thwarts", () => {
    const s = settle(reveal(base(), "31034"));
    expect(minion(s, "31034").tough).toBe(true);
    expect(targets(s, "enemy", true).some((p) => p.id === s.villain.id)).toBe(
      false,
    );
    s.scheme.threat = 3;
    expect(targets(s, "scheme", false, true).some((p) => p.id === "main")).toBe(
      false,
    );
  });
  it("Tough prevents the first actual basic hit and surviving Iron Spider retaliates once", () => {
    let s = settle(reveal(base(), "31034"));
    const id = minion(s, "31034").id;
    s = basicAttack(s, id);
    expect(minion(s, "31034").damage).toBe(0);
    expect(minion(s, "31034").tough).toBe(false);
    expect(s.player.hp).toBe(9);
  });
  it("actual Iron Spider attack overkills the defeated ally for the exact excess", () => {
    let s = settle(reveal(base(), "31034"));
    const brawn = control(s, "29004");
    brawn.damage = 2;
    s = attack(s, "31034");
    s = choose(reload(s), brawn.id);
    s = settle(s);
    expect(s.player.discard.filter((p) => p.id === brawn.id)).toHaveLength(1);
    expect(s.player.hp).toBe(9);
  });
});

describe("Sandman actual attack-damage and boost discard boundaries", () => {
  it.each([
    { damage: 4, surviving: true },
    { damage: 5, surviving: false },
  ])(
    "original Giant Wasp's distributed basic attack respects surviving=$surviving Sandman",
    ({ damage, surviving }) => {
      let s = settle(
        reveal(base(false, "rhino", "spider_man", "wsp"), "31035"),
      );
      const id = minion(s, "31035").id;
      s = settle(native(s, { type: "damage", target: id, amount: damage }));
      const before = s.encounter.deck.map((p) => p.id);
      s = command(reload(s), { type: "BASIC", action: "attack" });
      s = settle(s, (v) =>
        v.prompt?.options.some((o) => o.id === `${id}:2`)
          ? `${id}:2`
          : undefined,
      );
      expect(s.minions.some((p) => p.id === id)).toBe(surviving);
      expect(s.encounter.deck.map((p) => p.id)).toEqual(
        surviving ? before.slice(7) : before,
      );
      if (surviving) expect(minion(s, "31035").damage).toBe(6);
      else
        expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
    },
  );
  it.each([
    { damage: 2, surviving: true },
    { damage: 3, surviving: false },
  ])(
    "original paid Giant Wasp Sting respects surviving=$surviving Sandman after distributed damage",
    ({ damage, surviving }) => {
      let s = settle(
        reveal(base(false, "rhino", "spider_man", "wsp"), "31035"),
      );
      const id = minion(s, "31035").id;
      s = settle(native(s, { type: "damage", target: id, amount: damage }));
      const sting = hand(s, "13006"),
        energy = hand(s, "13021");
      const before = s.encounter.deck.map((p) => p.id);
      s = command(reload(s), { type: "PLAY", id: sting.id });
      s = command(reload(s), { type: "PAY", ids: [energy.id] });
      s = settle(s, (v) =>
        v.prompt?.options.some((o) => o.id === `${id}:4`)
          ? `${id}:4`
          : undefined,
      );
      expect(s.minions.some((p) => p.id === id)).toBe(surviving);
      expect(s.encounter.deck.map((p) => p.id)).toEqual(
        surviving ? before.slice(7) : before,
      );
      expect(s.player.discard.filter((p) => p.id === sting.id)).toHaveLength(1);
      expect(s.player.discard.filter((p) => p.id === energy.id)).toHaveLength(
        1,
      );
      if (surviving) expect(minion(s, "31035").damage).toBe(6);
      else
        expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
    },
  );
  it("a surviving actual basic attack discards exactly seven native top cards", () => {
    let s = settle(reveal(base(), "31035"));
    const id = minion(s, "31035").id;
    const before = s.encounter.deck.map((p) => p.id);
    s = basicAttack(s, id);
    expect(minion(s, "31035").damage).toBe(2);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before.slice(7));
    for (const id of before.slice(0, 7))
      expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("lethal basic attack does not trigger discarded Sandman's response, per official June2023 ruling", () => {
    let s = settle(reveal(base(), "31035"));
    const id = minion(s, "31035").id;
    s = settle(native(s, { type: "damage", target: id, amount: 5 }));
    const before = s.encounter.deck.map((p) => p.id);
    s = basicAttack(reload(s), id);
    expect(s.minions.some((p) => p.id === id)).toBe(false);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
  });
  it("Tough's zero actual attack damage does not discard seven", () => {
    let s = settle(reveal(base(), "31035"));
    const id = minion(s, "31035").id;
    s = settle(native(s, { type: "status", target: id, status: "tough" }));
    const before = s.encounter.deck.map((p) => p.id);
    s = basicAttack(s, id);
    expect(minion(s, "31035").damage).toBe(0);
    expect(minion(s, "31035").tough).toBe(false);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
  });
  it("ordinary nonattack damage never initiates Sandman's attack response", () => {
    let s = settle(reveal(base(), "31035"));
    const before = s.encounter.deck.map((p) => p.id);
    s = settle(
      native(s, { type: "damage", target: minion(s, "31035").id, amount: 1 }),
    );
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
  });
  it("actual Sandman boost discards seven, leaves the minion out of play and finishes boost once", () => {
    let s = base();
    const [sand] = top(s, "31035");
    const before = s.encounter.deck.slice(1).map((p) => p.id);
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before.slice(7));
    expect(s.encounter.discard.filter((p) => p.id === sand.id)).toHaveLength(1);
    expect(s.minions.some((p) => p.id === sand.id)).toBe(false);
    expect(s.player.hp).toBe(7);
  });
  it("a surviving Sandman attack response stops at real exhaustion and leaves the reset deck intact", () => {
    let s = settle(reveal(base(), "31035"));
    const topCards = [
      encounter(s, "31030"),
      encounter(s, "31031"),
      encounter(s, "31036"),
    ];
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck.push(...topCards);
    const deckSize = s.encounter.discard.length + topCards.length;
    s = basicAttack(reload(s), minion(s, "31035").id);
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck).toHaveLength(deckSize);
    expect(s.encounter.discard).toHaveLength(0);
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.minions.some((p) => p.code === "31036")).toBe(false);
  });
  it("a Sandman boost's short discard stops once and still discards the actual boost after reshuffle", () => {
    let s = base();
    const sand = encounter(s, "31035");
    const cards = [
      encounter(s, "31031"),
      encounter(s, "31036"),
      encounter(s, "31030"),
    ];
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s.encounter.deck.push(sand, ...cards);
    const resetSize = s.encounter.discard.length + cards.length;
    s = settle(native(reload(s), { type: "enemyAttack", id: s.villain.id }));
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck).toHaveLength(resetSize);
    expect(s.encounter.discard.map((p) => p.id)).toEqual([sand.id]);
    expect(s.minions.some((p) => p.code === "31036")).toBe(false);
  });
});

describe("Spot actual defeat and boost destinations", () => {
  it("exactly lethal public basic attack shuffles the same physical Spot and retains defeated-minion credit", () => {
    let s = settle(reveal(base(), "31036"));
    const id = minion(s, "31036").id;
    s = settle(native(s, { type: "damage", target: id, amount: 2 }));
    s = basicAttack(reload(s), id);
    expect(s.minions.some((p) => p.id === id)).toBe(false);
    expect(s.encounter.deck.filter((p) => p.id === id)).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.id === id)).toBe(false);
    expect(s.stats?.enemiesDefeated).toBe(1);
    expect(s.flags.defeatedMinion).toBe(true);
  });
  it("positive actual excess from public basic attack leaves Spot in ordinary discard", () => {
    let s = settle(reveal(base(), "31036"));
    const id = minion(s, "31036").id;
    s = settle(native(s, { type: "damage", target: id, amount: 3 }));
    s = basicAttack(s, id);
    expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
    expect(s.encounter.deck.some((p) => p.id === id)).toBe(false);
  });
  it("Tough prevents lethal damage, keeps Spot in play and does not shuffle", () => {
    let s = settle(reveal(base(), "31036"));
    const id = minion(s, "31036").id;
    s = settle(
      native(
        s,
        { type: "damage", target: id, amount: 2 },
        { type: "status", target: id, status: "tough" },
      ),
    );
    const before = s.encounter.deck.map((p) => p.id);
    s = basicAttack(s, id);
    expect(minion(s, "31036").damage).toBe(2);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(before);
  });
  it("actual Vivian suppresses Spot's When Defeated reshuffle", () => {
    let s = settle(reveal(base(), "31036"));
    const id = minion(s, "31036").id;
    s = blankWithVivian(s, id);
    s = settle(native(s, { type: "damage", target: id, amount: 2 }));
    s = basicAttack(s, id);
    expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("Spot's actual boost enters engaged with the attacked seat without ordinary boost discard", () => {
    let s = base(true);
    const [spot] = top(s, "31036");
    s = settle(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" }),
    );
    expect(s.minions.find((p) => p.id === spot.id)?.engagedWith).toBe("p2");
    expect(s.encounter.discard.some((p) => p.id === spot.id)).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(8);
  });
  it("actual Spider-Tracer resolves its defeated-minion removal while the same Spot is shuffled", () => {
    let s = settle(reveal(base(true), "31030"));
    s = settle(reveal(s, "31036", "p2"));
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    const spot = minion(s, "31036");
    const larceny = s.sideSchemes.find((p) => p.code === "31030")!;
    const tracer = hand(s, "01007");
    const resource = hand(s, "01003");
    s = command(s, { type: "PLAY", id: tracer.id });
    s = command(s, { type: "PAY", ids: [resource.id] });
    if (s.prompt?.options.some((p) => p.id === spot.id))
      s = choose(reload(s), spot.id);
    s = settle(s);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === tracer.id)
        ?.attachedTo,
    ).toBe(spot.id);
    s = settle(native(s, { type: "damage", target: spot.id, amount: 2 }));
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(reload(s), spot.id);
    s = settle(s, (v) =>
      v.prompt?.title === "Spider-Tracer" ? larceny.id : undefined,
    );
    expect(s.encounter.deck.filter((p) => p.id === spot.id)).toHaveLength(1);
    expect(s.sideSchemes.find((p) => p.id === larceny.id)?.counters).toBe(1);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === tracer.id),
    ).toHaveLength(1);
    expect(s.stats?.enemiesDefeated).toBe(1);
  });
});

describe("Surge in Crime native reveal keyword and paid environment action", () => {
  it("reveals one physical environment and deals exactly one printed Surge encounter", () => {
    const s = settle(reveal(base(), "31037"));
    expect(s.environments?.filter((p) => p.code === "31037")).toHaveLength(1);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.code === "31037")).toBe(false);
  });
  it("an actual Criminal reveal gains one Surge while the environment remains in play", () => {
    let s = settle(reveal(base(), "31037"));
    const before = s.encounter.dealt.length;
    s = settle(reveal(s, "31036"));
    expect(s.encounter.dealt).toHaveLength(before + 1);
    expect(minion(s, "31036")).toBeDefined();
  });
  it("Spot PUT by an actual boost does not reveal or gain the environment's Surge", () => {
    let s = settle(reveal(base(), "31037"));
    const before = s.encounter.dealt.length;
    const [spot] = top(s, "31036");
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.minions.some((p) => p.id === spot.id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(before);
  });
  it("canceling real environment payment preserves every selected source and the environment", () => {
    let s = settle(reveal(base(), "31037"));
    const energy = hand(s, "29006");
    hand(s, "29008");
    const env = s.environments![0];
    expect(
      abilityOptions(s, env).some((p) => p.id === "ironspider-sinister-remove"),
    ).toBe(true);
    s = command(s, {
      type: "ABILITY",
      id: env.id,
      action: "ironspider-sinister-remove",
    });
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.hand.some((p) => p.id === energy.id)).toBe(true);
    expect(s.environments?.some((p) => p.id === env.id)).toBe(true);
    exact(s);
  });
  it("paying the real printed Energy double discards only the environment and source", () => {
    let s = settle(reveal(base(true), "31037"));
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    const energy = hand(s, "01088", "p2");
    const env = s.environments![0];
    s = command(s, {
      type: "ABILITY",
      id: env.id,
      action: "ironspider-sinister-remove",
    });
    s = settle(command(reload(s), { type: "PAY", ids: [energy.id] }));
    expect(s.environments?.some((p) => p.id === env.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === env.id)).toHaveLength(1);
    expect(s.player.discard.filter((p) => p.id === energy.id)).toHaveLength(1);
  });
  it("another seat's Criminal prevents the actual Hero Action and alter ego has no action", () => {
    let s = settle(reveal(base(true), "31037"));
    hand(s, "29006");
    hand(s, "29008");
    const env = s.environments![0];
    s.player.form = "alter";
    expect(
      abilityOptions(s, env).some((p) => p.id === "ironspider-sinister-remove"),
    ).toBe(false);
    s.player.form = "hero";
    s = settle(reveal(s, "31036", "p2"));
    expect(
      abilityOptions(s, env).some((p) => p.id === "ironspider-sinister-remove"),
    ).toBe(false);
  });
});
