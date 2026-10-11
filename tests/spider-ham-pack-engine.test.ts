/** Native player-pool acceptance: every saved command uses the original forty
 * cards, nine Inheritors and five nemesis cards. Warrior fixtures declare a
 * legal forty-card substitution before native setup. */
import { describe, expect, it } from "vitest";
import { card, deckCodes, heroStats } from "../src/game/cards.js";
import {
  cardCost,
  dispatch,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  pay,
  play,
  reload,
  respond,
  until,
} from "./dv-test-helpers.js";

type HamPlayer = GameState["player"] & { spiderHamIdentity?: Piece };
type Fixture = GameState & { packOriginalIds?: string[] };
function all(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
    ...(p.inheritorBoosts || []).flatMap(nested),
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
        ...((p as HamPlayer).spiderHamIdentity
          ? [(p as HamPlayer).spiderHamIdentity!]
          : []),
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
  for (const id of (s as Fixture).packOriginalIds || [])
    expect(
      all(s).filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function settle(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
): GameState {
  for (let n = 0; s.prompt && n < 180; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).not.toBe("payment");
    const id =
      prefer?.(s) ||
      s.prompt.options.find((o) =>
        [
          "skip",
          "pass",
          "no",
          "decline",
          "allow",
          "take",
          "resolve",
          "continue",
          "done",
          "none",
        ].includes(o.id),
      )?.id ||
      (s.prompt.options.length === 1 ||
      /Forced responses|mandatory/i.test(s.prompt.title)
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}
function base(other?: string, warrior = false, otherDeckCards?: string[]) {
  const sourceCodes = deckCodes("spiderham", "justice");
  if (warrior) sourceCodes[sourceCodes.indexOf("30018")] = "30029";
  const ham = {
    heroId: "spiderham",
    aspect: "justice" as const,
    ...(warrior ? { deckCards: sourceCodes } : {}),
  };
  let s = newGame({
    ...ham,
    villainId: "rhino",
    module: "inheritors",
    seed: 30012,
    pacing: "expert",
    ...(other || warrior
      ? {
          heroes: [
            ham,
            ...(other
              ? [
                  {
                    heroId: other,
                    aspect:
                      other === "ghost_spider"
                        ? ("protection" as const)
                        : ("justice" as const),
                    ...(otherDeckCards ? { deckCards: otherDeckCards } : {}),
                  },
                ]
              : []),
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    expect(source).toHaveLength(40);
    expect(source.map((p) => p.code).sort()).toEqual(
      (seat.id === "p1"
        ? sourceCodes
        : otherDeckCards || deckCodes(seat.heroId, seat.aspect)
      ).sort(),
    );
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = [];
    p.form = "hero";
    p.exhausted = p.flipped = p.stunned = p.confused = p.tough = false;
  }
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).packOriginalIds = all(s).map((p) => p.id);
  return s;
}
function source(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original source ${seatId}:${code}`);
}
function hand(s: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => source(s, code));
  s.player.hand.push(...pieces);
  return pieces;
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
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original encounter ${code}`);
}
function side(s: GameState, code = "01108", amount = 3) {
  const p = encounter(s, code);
  p.counters = amount;
  s.sideSchemes.push(p);
  return p;
}
function select(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
function byCard(s: GameState, code: string) {
  return respond(
    s,
    new RegExp(card(code).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    code,
  );
}
function actionSeat(s: GameState, id: string) {
  activateSeat(s, id);
  s.turnPlayerId = id;
}
function attachOriginal(s: GameState, code: string, target: string) {
  const p = control(s, code);
  p.attachedTo = target;
  return p;
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: encounter(s, code), actorId });
}
function thwart(s: GameState, target: string, amount: number, action = true) {
  return native(s, { type: "thwart", target, amount, source: "hero", action });
}

describe("Spider-Ham original source player pool through native dispatch", () => {
  it("retains the exact starter40, all nine modular cards and five native set-aside nemesis cards", () => {
    const s = base();
    expect(s.player.deck).toHaveLength(40);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "30025",
      "30026",
      "30027",
      "30028",
      "30028",
    ]);
    expect(
      all(s)
        .filter((p) => card(p).set_code === "inheritors")
        .map((p) => p.code)
        .sort(),
    ).toEqual(Array.from({ length: 9 }, (_, n) => String(30030 + n)));
    for (const code of [
      ...Array.from({ length: 12 }, (_, n) => String(30012 + n)),
      "30029",
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    exact(s);
  });
  it("Pavitr's paid PLAY counts his own card, the current identity and non-character Web-Warrior supports", () => {
    let s = base();
    control(s, "30023");
    control(s, "30020");
    const [pavitr, a, b, c] = hand(s, "30013", "30007", "30004", "30009");
    s = play(s, pavitr, [a, b, c]);
    s = byCard(s, "30013");
    s = select(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === pavitr.id)?.damage).toBe(0);
  });
  it("Pavitr's actual PUT into play enters once without creating paid-PLAY responses", () => {
    let s = base();
    const pavitr = source(s, "30013");
    s.player.discard.push(pavitr);
    s = native(s, { type: "returnAlly", id: pavitr.id });
    s = byCard(s, "30013");
    s = select(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.inPlay.filter((p) => p.id === pavitr.id)).toHaveLength(1);
  });
  it("Lady Spider copies the actual one threat removed, after the original side scheme is defeated", () => {
    let s = base();
    const lady = control(s, "30012"),
      a = side(s, "01108", 1),
      b = side(s, "01107", 5);
    s = command(s, { type: "ABILITY", id: lady.id, action: "thwart" });
    s = select(s, a.id);
    s = byCard(s, "30012");
    expect(s.prompt?.options.some((o) => o.id === a.id)).toBe(false);
    s = select(s, b.id);
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(4);
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === lady.id)?.damage).toBe(2);
  });
  it("Lady Spider accepts another controlled Web-Warrior support while Peter Porker has no printed trait", () => {
    let s = base();
    s.player.form = "alter";
    control(s, "30023");
    const lady = control(s, "30012"),
      a = side(s, "01107", 4);
    s = command(s, { type: "ABILITY", id: lady.id, action: "thwart" });
    s = select(s, a.id);
    s = byCard(s, "30012");
    s = select(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(4);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(2);
  });
  it("Lady Spider's own trait and another seat's Web-Warrior do not satisfy another card you control", () => {
    let s = base("ghost_spider");
    s.player.form = "alter";
    const lady = control(s, "30012");
    const a = side(s, "01107", 4);
    s = settle(
      select(
        command(s, { type: "ABILITY", id: lady.id, action: "thwart" }),
        a.id,
      ),
    );
    expect(s.scheme.threat).toBe(6);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(2);
  });
  it("a confused Lady Spider removes her actual status instead of thwarting or copying threat", () => {
    let s = base();
    const lady = control(s, "30012");
    lady.confused = true;
    lady.confuseCards = 1;
    s = settle(command(s, { type: "ABILITY", id: lady.id, action: "thwart" }));
    expect(s.scheme.threat).toBe(6);
    expect(s.player.inPlay.find((p) => p.id === lady.id)).toMatchObject({
      confused: false,
      damage: 0,
    });
  });
  it("Even the Odds rejects an all-Mental payment before spending any actual resource", () => {
    let s = base();
    side(s);
    const [odds, a, b, energy] = hand(s, "30014", "30003", "30017", "30004");
    s = command(s, { type: "PLAY", id: odds.id });
    expect(s.prompt?.requirements).toEqual(["energy"]);
    const bad = dispatch(reload(s), { type: "PAY", ids: [a.id, b.id] });
    expect(bad.error).toMatch(/require|energy/i);
    expect(bad.player.hand.map((p) => p.id)).toEqual([
      odds.id,
      a.id,
      b.id,
      energy.id,
    ]);
    exact(bad);
  });
  it("Even the Odds removes starting-player-count threat simultaneously and damages only for actual defeats", () => {
    let s = base("ghost_spider");
    const a = side(s, "01108", 2),
      b = side(s, "01107", 3);
    const [odds, energy, mental] = hand(s, "30014", "30004", "30003");
    s = settle(play(s, odds, [energy, mental]));
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(false);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(1);
    expect(s.villain.hp).toBe(49);
    expect(s.scheme.threat).toBe(6);
  });
  it("Even the Odds spends actual toon-counter wild resources for its Energy Requirement across saved payment", () => {
    let s = base();
    const originalIdentity = s.player.spiderHamIdentity!;
    originalIdentity.counters = 3;
    const a = side(s, "01108", 1),
      [odds] = hand(s, "30014");
    const sources = paymentSources(s).filter((p) =>
      p.id.startsWith("spider-ham-toon:"),
    );
    expect(sources).toHaveLength(3);
    s = command(s, { type: "PLAY", id: odds.id });
    expect(s.prompt?.requirements).toEqual(["energy"]);
    s = command(reload(s), {
      type: "PAY",
      ids: sources.slice(0, 2).map((p) => p.id),
      wildAs: "energy",
    });
    s = settle(s);
    expect(s.player.spiderHamIdentity).toMatchObject({
      id: originalIdentity.id,
      counters: 1,
    });
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(false);
    expect(s.villain.hp).toBe(49);
  });
  it("Even the Odds finishes every simultaneous removal before Followed's actual defeat interrupt", () => {
    let s = base();
    const a = side(s, "01108", 1),
      b = side(s, "01107", 2);
    attachOriginal(s, "30018", a.id);
    const [odds, energy, mental] = hand(s, "30014", "30004", "30003");
    s = play(s, odds, [energy, mental]);
    s = byCard(s, "30018");
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(1);
    expect(s.villain.hp).toBe(50);
    s = select(s, "villain");
    s = settle(s);
    expect(s.villain.hp).toBe(45);
  });
  it("Even the Odds respects Confused and retains its actual paid cost without defeating schemes", () => {
    let s = base();
    const a = side(s, "01108", 1),
      b = side(s, "01107", 1);
    s.player.confused = true;
    s.player.confuseCards = 1;
    const [odds, energy, mental] = hand(s, "30014", "30004", "30003");
    s = settle(play(s, odds, [energy, mental]));
    expect(s.player.confused).toBe(false);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(1);
    expect(s.villain.hp).toBe(50);
    expect(s.player.discard.some((p) => p.id === odds.id)).toBe(true);
  });
  it("Making an Entrance pays through the basic thwart interrupt, grants +2 and heals only when fully cleared", () => {
    let s = base();
    s.player.hp = 7;
    s.scheme.threat = 3;
    const [entrance, cost] = hand(s, "30016", "30003");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = byCard(s, "30016");
    s = pay(s, [cost]);
    s = select(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(0);
    expect(s.player.hp).toBe(9);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === entrance.id)).toBe(true);
  });
  it("Making an Entrance does not heal when its basic thwart leaves actual threat", () => {
    let s = base();
    s.player.hp = 7;
    const [entrance, cost] = hand(s, "30016", "30003");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = byCard(s, "30016");
    s = pay(s, [cost]);
    s = select(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(2);
    expect(s.player.hp).toBe(7);
    expect(s.player.discard.some((p) => p.id === entrance.id)).toBe(true);
  });
  it("Making an Entrance cannot be played as a manual event or offered for a Confused basic thwart", () => {
    let s = base();
    const [entrance, cost] = hand(s, "30016", "30003");
    expect(playable(s, entrance)).toBeTruthy();
    expect(
      dispatch(reload(s), { type: "PLAY", id: entrance.id }).error,
    ).toBeTruthy();
    s.player.confused = true;
    s.player.confuseCards = 1;
    s = settle(command(s, { type: "BASIC", action: "thwart" }));
    expect(s.scheme.threat).toBe(6);
    expect(s.player.hand.map((p) => p.id)).toEqual([entrance.id, cost.id]);
  });
  it("One Way or Another searches and reveals an actual side scheme as its cost before drawing three", () => {
    let s = base();
    const [event] = hand(s, "30017"),
      original = s.encounter.deck.find((p) => p.code === "01108")!,
      drawIds = s.player.deck.slice(0, 3).map((p) => p.id),
      hidden = s.hiddenInfo!;
    s = play(s, event);
    s = select(s, original.id);
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === original.id)?.code).toBe("01108");
    expect(s.player.hand.map((p) => p.id)).toEqual(drawIds);
    expect(s.hiddenInfo).toBeGreaterThan(hidden);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    const [second] = hand(s, "30017");
    expect(playable(s, second)).toBeTruthy();
  });
  it("One Way or Another cannot search a side scheme that exists only in discard", () => {
    const s = base();
    for (const p of s.encounter.deck.filter(
      (p) => card(p).type_code === "side_scheme",
    ))
      s.encounter.discard.push(encounter(s, p.code));
    const [event] = hand(s, "30017");
    expect(playable(s, event)).toBeTruthy();
    exact(s);
  });
  it("One Way's maximum follows the shared printed name across teammates and the original 22015 printing", () => {
    let s = base("nebu");
    const [event] = hand(s, "30017"),
      a = s.encounter.deck.find((p) => p.code === "01108")!;
    s = play(s, event);
    s = select(s, a.id);
    s = settle(s);
    actionSeat(s, "p2");
    const [oldPrinting] = hand(s, "22015");
    expect(playable(s, oldPrinting)).toBeTruthy();
    expect(
      dispatch(reload(s), { type: "PLAY", id: oldPrinting.id }).error,
    ).toBeTruthy();
    exact(s);
  });
  it("Followed attaches its original physical upgrade, enforces max one and deals nonattack damage on defeat", () => {
    let s = base();
    const a = side(s, "01108", 1);
    const [followed, cost, duplicate] = hand(s, "30018", "30003", "30018");
    s = play(s, followed, [cost]);
    s = select(s, a.id);
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === followed.id)?.attachedTo).toBe(
      a.id,
    );
    expect(playable(s, duplicate)).toBeTruthy();
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = thwart(s, a.id, 1);
    s = byCard(s, "30018");
    s = select(s, "villain");
    s = settle(s);
    expect(s.villain.hp).toBe(46);
    expect(s.player.stunned).toBe(true);
    expect(s.player.discard.filter((p) => p.id === followed.id)).toHaveLength(
      1,
    );
  });
  it("Overwatch's paid attachment discards itself as a cost and copies only actual threat removed", () => {
    let s = base();
    const a = side(s, "01108", 1),
      b = side(s, "01107", 5),
      [watch] = hand(s, "30019");
    s = play(s, watch);
    s = select(s, a.id);
    s = settle(s);
    s = thwart(s, a.id, 4);
    s = byCard(s, "30019");
    expect(s.player.inPlay.some((p) => p.id === watch.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === watch.id)).toHaveLength(1);
    s = select(s, b.id);
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(4);
  });
  it("Overwatch ignores a non-thwart removal and Lady Spider's mirrored removal does not recursively trigger it", () => {
    let s = base();
    const a = side(s, "01107", 4),
      watch = attachOriginal(s, "30019", a.id),
      lady = control(s, "30012");
    s = settle(thwart(s, a.id, 1, false));
    expect(s.player.inPlay.some((p) => p.id === watch.id)).toBe(true);
    s = command(s, { type: "ABILITY", id: lady.id, action: "thwart" });
    s = select(s, "main");
    s = byCard(s, "30012");
    s = select(s, a.id);
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
    expect(s.player.inPlay.some((p) => p.id === watch.id)).toBe(true);
  });
  it("Overwatch interrupts Lady Spider's thwart before scheme cleanup and her response copies its original actual removal", () => {
    let s = base();
    const a = side(s, "01108", 1),
      b = side(s, "01107", 5),
      watch = attachOriginal(s, "30019", a.id),
      lady = control(s, "30012");
    s = command(s, { type: "ABILITY", id: lady.id, action: "thwart" });
    s = select(s, a.id);
    expect(s.prompt?.title).toBe("Overwatch");
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(0);
    expect(s.player.inPlay.some((p) => p.id === watch.id)).toBe(true);
    s = byCard(s, "30019");
    s = select(s, b.id);
    expect(s.prompt?.title).toBe("Lady Spider");
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(false);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(4);
    s = byCard(s, "30012");
    s = select(s, b.id);
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === lady.id)?.damage).toBe(2);
    expect(s.player.discard.filter((p) => p.id === watch.id)).toHaveLength(1);
  });
  it("Lady Spider has no stale response when Overwatch first removes her only other scheme", () => {
    let s = base();
    const a = side(s, "01107", 1),
      watch = attachOriginal(s, "30019", "main"),
      lady = control(s, "30012");
    s = command(s, { type: "ABILITY", id: lady.id, action: "thwart" });
    s = select(s, "main");
    expect(s.prompt?.title).toBe("Overwatch");
    s = byCard(s, "30019");
    s = select(s, a.id);
    expect(s.prompt?.title).not.toBe("Lady Spider");
    s = settle(s);
    expect(s.scheme.threat).toBe(4);
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === a.id)).toHaveLength(1);
    expect(s.player.inPlay.find((p) => p.id === lady.id)?.damage).toBe(2);
    expect(s.player.discard.filter((p) => p.id === watch.id)).toHaveLength(1);
  });
  it("simultaneous Even the Odds rechecks a second Overwatch after the first defeats its attached scheme", () => {
    let s = base();
    const a = side(s, "01107", 2),
      b = side(s, "01108", 2),
      first = attachOriginal(s, "30019", a.id),
      second = attachOriginal(s, "30019", b.id),
      [event, energy, other] = hand(s, "30014", "30004", "30003");
    s = play(s, event, [energy, other]);
    expect(s.prompt?.title).toBe("Overwatch");
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(1);
    s = byCard(s, "30019");
    s = select(s, b.id);
    expect(s.prompt?.title).not.toBe("Overwatch");
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
    expect(s.sideSchemes.some((p) => p.id === b.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === b.id)).toHaveLength(1);
    for (const p of [first, second, event, energy, other])
      expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    // The other scheme was defeated by Overwatch's unlabelled removal,
    // rather than by the original simultaneous thwart.
    expect(s.villain.hp).toBe(50);
  });
  it("Overwatch belongs to its controller's hero interrupt even when a teammate performs the actual thwart", () => {
    let s = base("ghost_spider");
    const a = side(s, "01107", 4),
      watch = attachOriginal(s, "30019", a.id);
    actionSeat(s, "p2");
    s = thwart(s, a.id, 2);
    s = byCard(s, "30019");
    expect(s.activePlayerId).toBe("p1");
    s = select(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(4);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === watch.id),
    ).toBe(true);
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === watch.id),
    ).toBe(false);
  });
  it("both actual Aerial Crisis Interdiction removals open the attached controller's Overwatch interrupt", () => {
    let s = base("captain_marvel");
    const a = side(s, "01107", 4),
      b = side(s, "01108", 4),
      first = attachOriginal(s, "30019", a.id),
      second = attachOriginal(s, "30019", b.id);
    control(s, "01017", "p2");
    actionSeat(s, "p2");
    const [event, resource] = hand(s, "01012", "01089");
    s = play(s, event, [resource]);
    s = select(s, a.id);
    s = byCard(s, "30019");
    expect(s.activePlayerId).toBe("p1");
    s = select(s, b.id);
    // Crisis blocks the main scheme, so the second printed removal has
    // exactly one legal different target and resolves without another choice.
    expect(s.prompt?.title).toBe("Overwatch");
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(2);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(0);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === first.id),
    ).toBe(true);
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === second.id),
    ).toBe(true);
    s = byCard(s, "30019");
    s = select(s, a.id);
    s = settle(s);
    expect(s.sideSchemes).toHaveLength(0);
    for (const p of [a, b])
      expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    for (const p of [first, second])
      expect(
        seatView(s, "p1").player.discard.filter((q) => q.id === p.id),
      ).toHaveLength(1);
    for (const p of [event, resource])
      expect(
        seatView(s, "p2").player.discard.filter((q) => q.id === p.id),
      ).toHaveLength(1);
    expect(s.scheme.threat).toBe(6);
  });
  it("actual Rocket Boots Aerial makes Mark V Helmet's simultaneous native thwart trigger Overwatch", () => {
    let s = base("iron_man");
    const a = side(s, "01107", 2),
      watch = attachOriginal(s, "30019", a.id),
      helmet = control(s, "01037", "p2"),
      boots = control(s, "01039", "p2");
    actionSeat(s, "p2");
    const [resource] = hand(s, "01089");
    s = command(s, { type: "ABILITY", id: boots.id });
    s = pay(s, [resource]);
    s = settle(s);
    s = command(s, { type: "ABILITY", id: helmet.id });
    expect(s.scheme.threat).toBe(5);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
    s = byCard(s, "30019");
    s = select(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(4);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === helmet.id)
        ?.exhausted,
    ).toBe(true);
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === watch.id),
    ).toHaveLength(1);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === resource.id),
    ).toHaveLength(1);
  });
  it("Making an Entrance's actual paid interrupt also heals after Giant Wasp's distributed basic thwart", () => {
    const sourceCodes = deckCodes("wsp", "justice");
    sourceCodes[sourceCodes.indexOf("01065")] = "30016";
    let s = base("wsp", false, sourceCodes);
    const a = side(s, "01107", 4),
      watch = attachOriginal(s, "30019", a.id);
    actionSeat(s, "p2");
    s.player.heroForm = "giant";
    s.player.hp = 5;
    const [entrance, resource] = hand(s, "30016", "01085");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = byCard(s, "30016");
    s = pay(s, [resource]);
    s = choose(s, `${a.id}:4`);
    expect(s.prompt?.title).toBe("Overwatch");
    expect(seatView(s, "p2").player.hp).toBe(5);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(0);
    s = byCard(s, "30019");
    s = select(s, "main");
    s = settle(s);
    expect(seatView(s, "p2").player.hp).toBe(7);
    expect(s.scheme.threat).toBe(2);
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === a.id)).toHaveLength(1);
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === watch.id),
    ).toHaveLength(1);
    for (const p of [entrance, resource])
      expect(
        seatView(s, "p2").player.discard.filter((q) => q.id === p.id),
      ).toHaveLength(1);
  });
  it("Scarlet Spider names a type before looking at the retained actual encounter card and draws on a match", () => {
    let s = base();
    const scarlet = control(s, "30020"),
      drawId = s.player.deck[0].id,
      pending = s.encounter.deck.find((p) => p.code === "01104")!;
    s = reveal(s, "01104");
    s = byCard(s, "30020");
    const beforeLook = s.hiddenInfo!;
    expect(s.prompt?.title).toMatch(/name a card type/i);
    expect(s.prompt?.options.some((o) => o.id === "treachery")).toBe(true);
    s = choose(reload(s), "treachery");
    s = settle(s);
    expect(s.hiddenInfo).toBeGreaterThan(beforeLook);
    expect(s.player.inPlay.find((p) => p.id === scarlet.id)?.damage).toBe(1);
    expect(s.player.hand.map((p) => p.id)).toEqual([drawId]);
    expect(s.encounter.discard.filter((p) => p.id === pending.id)).toHaveLength(
      1,
    );
  });
  it("Scarlet Spider's wrong named type advances the look but does not damage or draw", () => {
    let s = base();
    const scarlet = control(s, "30020");
    s = reveal(s, "01104");
    s = byCard(s, "30020");
    const before = s.hiddenInfo!;
    s = choose(s, "minion");
    s = settle(s);
    expect(s.hiddenInfo).toBeGreaterThan(before);
    expect(s.player.inPlay.find((p) => p.id === scarlet.id)?.damage).toBe(0);
    expect(s.player.hand).toHaveLength(0);
  });
  it("Scarlet Spider can interrupt the actual searched One Way reveal and Tough still permits its draw", () => {
    let s = base();
    const scarlet = control(s, "30020");
    scarlet.tough = true;
    scarlet.toughCards = 1;
    const [event] = hand(s, "30017"),
      a = s.encounter.deck.find((p) => p.code === "01108")!;
    s = play(s, event);
    s = select(s, a.id);
    s = byCard(s, "30020");
    s = select(s, "side_scheme");
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === scarlet.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
    expect(s.player.hand).toHaveLength(4);
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(true);
  });
  it("Scarlet Spider is not offered for facedown boost-card processing", () => {
    let s = base();
    const scarlet = control(s, "30020"),
      boost = encounter(s, "01104");
    s.encounter.deck.unshift(boost);
    s = settle(native(s, { type: "enemyAttack", id: "villain" }));
    expect(s.player.inPlay.find((p) => p.id === scarlet.id)?.damage).toBe(0);
    expect(s.player.hand).toHaveLength(0);
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
  });
  it("Scarlet Spider's lethal matching damage finishes its actual leave window before retaining the earned draw", () => {
    let s = base();
    control(s, "30023");
    const scarlet = control(s, "30020");
    scarlet.damage = 3;
    const draws = s.player.deck.slice(0, 2).map((p) => p.id);
    s = reveal(s, "01104");
    s = byCard(s, "30020");
    s = select(s, "treachery");
    s = byCard(s, "30023");
    s = select(s, "p1");
    s = settle(s);
    expect(s.player.discard.filter((p) => p.id === scarlet.id)).toHaveLength(1);
    expect(s.player.hand.map((p) => p.id)).toEqual(draws);
  });
  it("SP//dr returns its same owned instance only after excess consequential damage", () => {
    let s = base();
    const spdr = control(s, "30021");
    spdr.damage = 1;
    s = command(s, { type: "ABILITY", id: spdr.id, action: "thwart" });
    s = select(s, "main");
    s = settle(s);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.hand.filter((p) => p.id === spdr.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === spdr.id)).toBe(false);
    expect(s.player.hand.find((p) => p.id === spdr.id)).toMatchObject({
      damage: 0,
      exhausted: false,
    });
  });
  it("SP//dr exact lethal consequential damage discards rather than returning the physical ally", () => {
    let s = base();
    const spdr = control(s, "30021");
    s = command(s, { type: "ABILITY", id: spdr.id, action: "thwart" });
    s = select(s, "main");
    s = settle(s);
    expect(s.player.hand.some((p) => p.id === spdr.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === spdr.id)).toHaveLength(1);
  });
  it("the same SP//dr can be paid, re-enter and return after a second distinct excess-consequential defeat", () => {
    let s = base();
    const spdr = control(s, "30021");
    spdr.damage = 1;
    s = settle(
      select(
        command(s, { type: "ABILITY", id: spdr.id, action: "thwart" }),
        "main",
      ),
    );
    const [energy, mental] = hand(s, "30004", "30003");
    s = settle(
      play(
        s,
        s.player.hand.find((p) => p.id === spdr.id)!,
        [energy, mental],
      ),
    );
    expect(s.player.inPlay.find((p) => p.id === spdr.id)).toMatchObject({
      damage: 0,
      exhausted: false,
    });
    s = settle(
      native(s, {
        type: "damage",
        target: spdr.id,
        amount: 1,
        source: "environment",
      }),
    );
    s = settle(
      select(
        command(s, { type: "ABILITY", id: spdr.id, action: "thwart" }),
        "main",
      ),
    );
    expect(s.player.hand.filter((p) => p.id === spdr.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === spdr.id)).toBe(false);
    expect(s.scheme.threat).toBe(2);
  });
  it("SP//dr's defeat from an ordinary damage packet never returns her to hand", () => {
    let s = base();
    const spdr = control(s, "30021");
    s = settle(
      native(s, {
        type: "damage",
        target: spdr.id,
        amount: 3,
        source: "environment",
      }),
    );
    expect(s.player.hand.some((p) => p.id === spdr.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === spdr.id)).toHaveLength(1);
  });
  it("a teammate's controlled SP//dr returns the physical original to its owner, preserving saved ownership", () => {
    let s = base("ghost_spider");
    const spdr = source(s, "30021");
    spdr.damage = 1;
    seatView(s, "p2").player.inPlay.push(spdr);
    actionSeat(s, "p2");
    s = command(s, { type: "ABILITY", id: spdr.id, action: "thwart" });
    s = select(s, "main");
    s = settle(s);
    expect(
      seatView(s, "p1").player.hand.filter((p) => p.id === spdr.id),
    ).toHaveLength(1);
    expect(seatView(s, "p2").player.hand.some((p) => p.id === spdr.id)).toBe(
      false,
    );
    expect(seatView(s, "p2").player.discard.some((p) => p.id === spdr.id)).toBe(
      false,
    );
  });
  it("Team-Building Exercise makes a real discounted PLAY, exhausts its source and preserves ally entry responses", () => {
    let s = base();
    const exercise = control(s, "30022"),
      [pavitr, a, b] = hand(s, "30013", "30004", "30003");
    s = command(s, {
      type: "ABILITY",
      id: exercise.id,
      action: "team-building",
    });
    s = select(s, pavitr.id);
    expect(s.prompt?.cost).toBe(2);
    s = pay(s, [a, b]);
    s = byCard(s, "30013");
    s = select(s, "main");
    s = settle(s);
    expect(s.player.inPlay.find((p) => p.id === exercise.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.inPlay.some((p) => p.id === pavitr.id)).toBe(true);
    expect(s.scheme.threat).toBe(4);
  });
  it("Team-Building Exercise rejects a card with no current identity trait match", () => {
    let s = base();
    const exercise = control(s, "30022"),
      [followed, a] = hand(s, "30018", "30003");
    side(s);
    const bad = dispatch(reload(s), {
      type: "ABILITY",
      id: exercise.id,
      action: "team-building",
    });
    expect(bad.error).toBeTruthy();
    expect(bad.player.inPlay.find((p) => p.id === exercise.id)?.exhausted).toBe(
      false,
    );
    expect(bad.player.hand.map((p) => p.id)).toEqual([followed.id, a.id]);
    exact(bad);
  });
  it("Web of Life's printed cost is ignored only for the current identity's effective Web-Warrior trait", () => {
    let s = base();
    const [web] = hand(s, "30023");
    expect(cardCost(s, card(web), web)).toBe(0);
    s = settle(play(s, web));
    expect(s.player.inPlay.some((p) => p.id === web.id)).toBe(true);
    const ae = base();
    ae.player.form = "alter";
    const [other] = hand(ae, "30023");
    control(ae, "30012");
    expect(cardCost(ae, card(other), other)).toBe(3);
    expect(playable(ae, other)).toBeTruthy();
    exact(ae);
  });
  it("Web of Life reacts to another seat's Web-Warrior ally leave and the chosen player draws", () => {
    let s = base("ghost_spider");
    const web = control(s, "30023"),
      ally = control(s, "27017", "p2"),
      next = seatView(s, "p2").player.deck[0].id;
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 9,
      source: "environment",
      actorId: "p2",
    });
    s = byCard(s, "30023");
    s = select(s, "p2");
    s = settle(s);
    expect(seatView(s, "p2").player.hand.map((p) => p.id)).toEqual([next]);
    expect(seatView(s, "p1").player.hand).toHaveLength(0);
    expect(seatView(s, "p1").player.inPlay.some((p) => p.id === web.id)).toBe(
      true,
    );
  });
  it("Web of Life triggers when SP//dr actually leaves for a return to its owner's hand", () => {
    let s = base();
    control(s, "30023");
    const spdr = control(s, "30021");
    spdr.damage = 1;
    const next = s.player.deck[0].id;
    s = command(s, { type: "ABILITY", id: spdr.id, action: "thwart" });
    s = select(s, "main");
    s = byCard(s, "30023");
    s = select(s, "p1");
    s = settle(s);
    expect(s.player.hand.map((p) => p.id).sort()).toEqual(
      [spdr.id, next].sort(),
    );
    expect(s.player.discard.some((p) => p.id === spdr.id)).toBe(false);
  });
  it("Warrior's declared custom source attaches to the Spider identity and grants Web-Warrior across a face change", () => {
    let s = base(undefined, true);
    const [warrior, cost, web] = hand(s, "30029", "30003", "30023");
    s = play(s, warrior, [cost]);
    s = select(s, "hero:p1");
    s = settle(s);
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("alter");
    expect(s.player.inPlay.find((p) => p.id === warrior.id)?.attachedTo).toBe(
      "hero:p1",
    );
    expect(cardCost(s, card(web), web)).toBe(0);
    s = settle(play(s, web));
    expect(s.player.inPlay.some((p) => p.id === web.id)).toBe(true);
  });
  it("Warrior responds to another player's actual Web-Warrior ally leave and expires at the native phase boundary", () => {
    let s = base("ghost_spider", true);
    const [warrior, cost] = hand(s, "30029", "30003");
    s = play(s, warrior, [cost]);
    s = select(s, "hero:p1");
    s = settle(s);
    const ally = control(s, "27017", "p2");
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 9,
      source: "environment",
      actorId: "p2",
    });
    s = byCard(s, "30029");
    s = settle(s);
    actionSeat(s, "p1");
    expect(heroStats(s).attack).toBe(2);
    s = settle(command(s, { type: "END_TURN", discard: [] }));
    expect(heroStats(seatView(s, "p1")).attack).toBe(2);
    s = command(s, { type: "END_TURN", discard: [] });
    for (let n = 0; s.prompt?.kind === "select" && n < 3; n++)
      s = command(s, { type: "SELECT", ids: [] });
    s = until(s, (v) => !!v.attack);
    expect(heroStats(seatView(s, "p1")).attack).toBe(1);
    exact(s);
  });
  it("Warrior's native attached ally receives its temporary attack bonus when another seat's Web-Warrior leaves", () => {
    let s = base("ghost_spider", true);
    const pavitr = control(s, "30013"),
      [warrior, cost] = hand(s, "30029", "30003");
    s = play(s, warrior, [cost]);
    s = select(s, pavitr.id);
    s = settle(s);
    const leaving = control(s, "27017", "p2");
    s = native(s, {
      type: "damage",
      target: leaving.id,
      amount: 9,
      source: "environment",
      actorId: "p2",
    });
    s = byCard(s, "30029");
    s = settle(s);
    actionSeat(s, "p1");
    s = settle(
      select(
        command(s, { type: "ABILITY", id: pavitr.id, action: "attack" }),
        "villain",
      ),
    );
    expect(s.villain.hp).toBe(48);
    expect(s.player.inPlay.find((p) => p.id === pavitr.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === warrior.id)?.attachedTo).toBe(
      pavitr.id,
    );
  });
});
