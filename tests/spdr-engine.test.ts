/** Native acceptance uses the forty original physical player cards, the two
 * reversible identity cards and actual reserved encounters. Every command and
 * choice crosses JSON hydration; no standalone card helper is acceptance. */
import { describe, expect, it } from "vitest";
import {
  card,
  deckCodes,
  handSize,
  heroCard,
  heroStats,
} from "../src/game/cards.js";
import { STARTER_DECKS, catalogDeckCodes } from "../src/game/catalog.js";
import { isTextBlank } from "../src/game/card-text.js";
import {
  dispatch,
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { deckErrors } from "../src/game/decks.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Effect, GameState, Piece, Resource } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  pay,
  reload,
  respond,
  target,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { spdrOriginalIds?: string[] };
const identityCodes = ["31001a", "31001b", "31002a", "31002b"];
const original = () =>
  catalogDeckCodes(STARTER_DECKS.find((d) => d.id === "starter-31001a")!);
function identity(s: GameState): Piece {
  expect(
    s.player.spdrIdentity,
    "The host must retain an actual active SP//dr identity",
  ).toBeDefined();
  return s.player.spdrIdentity!;
}
function suit(s: GameState): Piece {
  const p = [identity(s), ...s.player.inPlay].find(
    (p) => p.id === s.player.spdrSuitId,
  );
  expect(p, "The original physical Suit is missing").toBeDefined();
  return p!;
}
function pilot(s: GameState): Piece {
  const p = [identity(s), ...s.player.inPlay].find(
    (p) => p.id === s.player.spdrPilotId,
  );
  expect(p, "The original physical Pilot is missing").toBeDefined();
  return p!;
}
function all(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
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
    ...s.encounter.dealt,
    ...s.encounter.discard,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  for (const id of (s as Fixture).spdrOriginalIds || [])
    expect(
      all(s).filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function actual(s: GameState, p: Piece) {
  return all(s).find((q) => q.id === p.id)!;
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 150; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).not.toBe("payment");
    const id =
      prefer?.(s) ||
      s.prompt.options.find((o) =>
        [
          "skip",
          "pass",
          "none",
          "continue",
          "no",
          "decline",
          "allow",
          "done",
          "resolve",
        ].includes(o.id),
      )?.id ||
      (s.prompt.options.length === 1 ||
      /forced responses|mandatory/i.test(s.prompt.title)
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(reload(s), id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}
function starting(other?: string, spdrSeat = "p1", deckCards?: string[]) {
  const spdr = {
    heroId: "spdr",
    aspect: "protection" as const,
    ...(deckCards ? { deckCards } : {}),
  };
  const teammate = {
    heroId: other || "spider_man",
    aspect: "justice" as const,
  };
  return newGame({
    ...spdr,
    villainId: "rhino",
    module: "ironspider_sinister",
    seed: 31001,
    pacing: "expert",
    heroes: other
      ? spdrSeat === "p1"
        ? [spdr, teammate]
        : [teammate, spdr]
      : [spdr],
  });
}
function base(
  other?: string,
  spdrSeat = "p1",
  form: "hero" | "alter" = "hero",
  deckCards?: string[],
) {
  let s = starting(other, spdrSeat, deckCards);
  for (let i = 0; i < s.players.length; i++)
    s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const source = [...p.hand, ...p.deck, ...p.discard, ...p.inPlay].filter(
      (p) => !identityCodes.includes(p.code),
    );
    expect(source).toHaveLength(40);
    expect(source.map((p) => p.code).sort()).toEqual(
      (seat.heroId === "spdr"
        ? deckCards || original()
        : deckCodes(seat.heroId, seat.aspect)
      )
        .slice()
        .sort(),
    );
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = p.inPlay.filter((p) => identityCodes.includes(p.code));
    p.exhausted = p.flipped = p.tough = p.confused = p.stunned = false;
    if (seat.heroId !== "spdr") p.form = "hero";
  }
  activateSeat(s, spdrSeat);
  s.turnPlayerId = spdrSeat;
  if (form === "hero") s = settle(command(s, { type: "FLIP" }));
  s.player.flipped = false;
  s.scheme.threat = 8;
  s.villain.hp = s.villain.maxHp = 50;
  (s as Fixture).spdrOriginalIds = all(s).map((p) => p.id);
  exact(s);
  return s;
}
function source(s: GameState, code: string, seatId = s.activePlayerId): Piece {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original player source ${seatId}:${code}`);
}
function hand(s: GameState, ...codes: string[]) {
  s.player.deck.push(...s.player.hand.splice(0));
  const ps = codes.map((c) => source(s, c));
  s.player.hand.push(...ps);
  return ps;
}
function put(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = source(s, code, seatId);
  seatView(s, seatId).player.inPlay.push(p);
  return p;
}
function encounter(
  s: GameState,
  code: string,
  seatId = s.activePlayerId,
): Piece {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    seatView(s, seatId).player.setAside || [],
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original physical encounter ${code}`);
}
function side(s: GameState, count = 4, code = "01107") {
  const p = encounter(s, code);
  p.counters = count;
  s.sideSchemes.push(p);
  return p;
}
function morbius(
  s: GameState,
  seatId = s.activePlayerId,
  ownerId = s.activePlayerId,
) {
  const p = encounter(s, "31027", ownerId);
  p.engagedWith = seatId;
  s.minions.push(p);
  return p;
}
function sync(s: GameState, p: Piece) {
  const q = paymentSources(s, s.prompt?.card?.id, s.prompt?.paymentTarget).find(
    (q) => q.id === `spdr-sync:${p.id}`,
  );
  expect(q, `actual Interface source ${p.id}`).toBeDefined();
  return q!.id;
}
function paid(
  s: GameState,
  p: Piece,
  resources: Piece[],
  interfaces: Piece[] = [],
  allocation?: number,
  resource: Resource = "energy",
) {
  s = command(s, { type: "PLAY", id: p.id });
  s = until(s, (v) => v.prompt?.kind === "payment");
  s = command(reload(s), {
    type: "PAY",
    ids: [...resources.map((p) => p.id), ...interfaces.map((p) => sync(s, p))],
    wildAs: resource,
  });
  if (s.prompt?.title === "Allocate payment resources") {
    const option = s.prompt.options.find(
      (o) => o.id === resource || o.label.includes(resource),
    );
    expect(option, JSON.stringify(s.prompt)).toBeDefined();
    s = choose(reload(s), option!.id);
  }
  if (s.prompt?.title === "Allocate Sync Ratio resources") {
    expect(
      allocation,
      "The receipt must choose a real allocated Sync Ratio amount",
    ).toBeDefined();
    s = choose(reload(s), `sync:${allocation}`);
  }
  return s;
}
function ability(s: GameState, p: Piece | "identity", action: string) {
  return command(reload(s), {
    type: "ABILITY",
    id: p === "identity" ? p : p.id,
    action,
  });
}
function flip(s: GameState) {
  s.player.flipped = false;
  return settle(command(reload(s), { type: "FLIP" }));
}
function reveal(s: GameState, p: Piece, actorId = s.activePlayerId) {
  return native(reload(s), {
    type: "reveal",
    piece: p,
    actorId,
    fromEncounterDeck: true,
  });
}
function custom(...replacements: [string, string][]) {
  const cards = original();
  for (const [before, after] of replacements) {
    const i = cards.indexOf(before);
    expect(i).toBeGreaterThanOrEqual(0);
    cards[i] = after;
  }
  expect(deckErrors("spdr", "protection", cards)).toEqual([]);
  return cards;
}

describe("SP//dr original physical source and two-card identity", () => {
  it("launches original Protection40 and two reversible cards outside the player deck", () => {
    const s = starting();
    const ps = [...s.player.hand, ...s.player.deck, ...s.player.inPlay].filter(
      (p) => !identityCodes.includes(p.code),
    );
    expect(ps.map((p) => p.code).sort()).toEqual(original().sort());
    expect(ps).toHaveLength(40);
    expect(new Set([...ps, identity(s), suit(s)].map((p) => p.id)).size).toBe(
      42,
    );
    expect(identity(s)).toMatchObject({
      id: s.player.spdrPilotId,
      code: "31002a",
      ownerId: "p1",
    });
    expect(suit(s)).toMatchObject({
      code: "31001b",
      exhausted: false,
      ownerId: "p1",
    });
    expect(suit(s).id).not.toBe(pilot(s).id);
    expect(s.player.hand).toHaveLength(4);
    expect(heroCard(s)).toMatchObject({
      code: "31002a",
      recover: 4,
      hand_size: 4,
    });
    expect(s.player.hp).toBe(14);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "31026",
      "31027",
      "31028",
      "31028",
      "31028",
    ]);
    expect(s.encounter.deck.filter((p) => p.code === "31025")).toHaveLength(1);
    for (let n = 31030; n <= 31037; n++)
      expect(s.encounter.deck.filter((p) => p.code === String(n))).toHaveLength(
        1,
      );
  });
  it("conserves all forty source IDs and both identity IDs through real mulligan and hydration", () => {
    let s = starting();
    (s as Fixture).spdrOriginalIds = all(s).map((p) => p.id);
    const suitId = suit(s).id,
      pilotId = pilot(s).id;
    s = settle(
      command(s, {
        type: "MULLIGAN",
        ids: s.player.hand.slice(0, 2).map((p) => p.id),
      }),
    );
    s = command(reload(s), { type: "SET_PACING", pacing: "expert" });
    expect(s.player.hand).toHaveLength(4);
    expect(suit(s).id).toBe(suitId);
    expect(pilot(s).id).toBe(pilotId);
    exact(s);
  });
  it("Maintenance exhausts only the Suit and preserves its exhaustion when it becomes the hero", () => {
    let s = base(undefined, "p1", "alter");
    const suitId = suit(s).id,
      pilotId = pilot(s).id;
    const topIds = s.player.deck.slice(0, 2).map((p) => p.id);
    s = settle(ability(s, "identity", "maintenance"));
    expect(s.player.hand.map((p) => p.id)).toEqual(topIds);
    expect(suit(s).exhausted).toBe(true);
    expect(pilot(s).exhausted).toBe(false);
    s = flip(s);
    expect(identity(s)).toMatchObject({
      id: suitId,
      code: "31001a",
      exhausted: true,
    });
    expect(s.player.exhausted).toBe(true);
    expect(pilot(s)).toMatchObject({
      id: pilotId,
      code: "31002b",
      attachedTo: suitId,
      exhausted: false,
    });
    expect(
      dispatch(reload(s), { type: "BASIC", action: "attack" }).error,
    ).toMatch(/exhausted/i);
    exact(s);
  });
  it("Pilot Sync Ratio exhaustion persists onto Peni and prevents actual basic REC", () => {
    let s = base();
    const p = pilot(s),
      [event] = hand(s, "31004");
    s = paid(s, event, [], [p]);
    s = settle(
      choose(s, "search"),
      (v) => v.prompt?.options.find((o) => o.image === "31011")?.id,
    );
    expect(pilot(s).exhausted).toBe(true);
    expect(suit(s).exhausted).toBe(false);
    s.player.hp = 8;
    s = flip(s);
    expect(identity(s)).toMatchObject({
      id: p.id,
      code: "31002a",
      exhausted: true,
    });
    expect(
      dispatch(reload(s), { type: "BASIC", action: "recover" }).error,
    ).toMatch(/exhausted/i);
    expect(s.player.hp).toBe(8);
    exact(s);
  });
  it("moves physical counters, controlled and encounter attachments both ways under current Suit errata", () => {
    let s = base(undefined, "p1", "alter");
    const aeId = pilot(s).id,
      suitId = suit(s).id;
    identity(s).counters = 3;
    s.player.hp = 9;
    s.player.tough = true;
    s.player.confused = true;
    const upgrade = put(s, "31024");
    upgrade.attachedTo = aeId;
    upgrade.counters = 2;
    const attachment = makePiece(s, "01093");
    attachment.attachedTo = aeId;
    s.attachments.push(attachment);
    s = flip(s);
    expect(identity(s)).toMatchObject({ id: suitId, counters: 3 });
    expect(pilot(s).counters).toBe(0);
    expect(actual(s, upgrade)).toMatchObject({
      attachedTo: suitId,
      counters: 2,
    });
    expect(actual(s, attachment).attachedTo).toBe(suitId);
    identity(s).counters += 2;
    s = flip(s);
    expect(identity(s)).toMatchObject({ id: aeId, counters: 5 });
    expect(suit(s).counters).toBe(0);
    expect(actual(s, upgrade)).toMatchObject({ attachedTo: aeId, counters: 2 });
    expect(actual(s, attachment).attachedTo).toBe(aeId);
    expect(s.player.hp).toBe(9);
    expect(s.player.tough).toBe(true);
    expect(s.player.confused).toBe(true);
    exact(s);
  });
  it("retains independent Pilot and Suit exhaustion across a complete form cycle", () => {
    let s = base();
    suit(s).exhausted = s.player.exhausted = true;
    pilot(s).exhausted = false;
    s = flip(s);
    expect(identity(s).exhausted).toBe(false);
    expect(suit(s).exhausted).toBe(true);
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "maintenance",
      }).error,
    ).toBeTruthy();
    s = flip(s);
    expect(identity(s).exhausted).toBe(true);
    expect(pilot(s).exhausted).toBe(false);
    exact(s);
  });
  it("does not replenish consumed five-card physical nemesis reserve during save hydration", () => {
    let s = base();
    s.encounter.discard.push(...s.player.setAside!);
    s.player.setAside = [];
    s = command(reload(s), { type: "SET_PACING", pacing: "expert" });
    expect(s.player.setAside).toEqual([]);
    exact(s);
  });
  it("removes both real identity pieces once on simultaneous SP//dr defeat and preserves the original forty player cards through reload", () => {
    let s = base("spider_man");
    const identityIds = [suit(s).id, pilot(s).id];
    const sourceIds = [
      ...s.player.deck,
      ...s.player.hand,
      ...s.player.discard,
      ...s.player.inPlay,
    ]
      .filter((p) => !identityCodes.includes(p.code))
      .map((p) => p.id);
    expect(sourceIds).toHaveLength(40);
    s = settle(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 14,
        source: "fixture",
      }),
    );
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(s.players.find((p) => p.id === "p2")?.eliminated).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(10);
    for (const id of identityIds)
      expect(s.removed.filter((p) => p.id === id)).toHaveLength(1);
    expect(seatView(s, "p1").player.spdrIdentity).toBeUndefined();
    expect(
      seatView(s, "p1").player.inPlay.filter((p) =>
        identityCodes.includes(p.code),
      ),
    ).toEqual([]);
    s = command(reload(s), { type: "SET_PACING", pacing: "expert" });
    for (const id of [...identityIds, ...sourceIds])
      expect(all(s).filter((p) => p.id === id)).toHaveLength(1);
    expect(all(s).filter((p) => identityCodes.includes(p.code))).toHaveLength(
      2,
    );
    exact(s);
  });
  it("uses Peni's native four-point basic REC and exposes hero-only cards only after a real form change", () => {
    let s = base(undefined, "p1", "alter");
    s.player.hp = 7;
    const [event] = hand(s, "31005", "31024", "31016");
    expect(playable(s, event)).toMatch(/hero/i);
    expect(
      nativeHeroAbilityOptions(s, "identity").some(
        (o) => o.id === "maintenance",
      ),
    ).toBe(true);
    s = settle(command(s, { type: "BASIC", action: "recover" }));
    expect(s.player.hp).toBe(11);
    expect(pilot(s).exhausted).toBe(true);
    s = flip(s);
    expect(s.player.exhausted).toBe(false);
    expect(playable(s, event)).toBeFalsy();
    expect(handSize(s)).toBe(3);
    expect(heroStats(s)).toMatchObject({
      attack: 2,
      thwart: 2,
      defense: 2,
      recover: 4,
    });
    exact(s);
  });
});

describe("SP//dr native resources and signature payments", () => {
  it("offers actual typed Interface icons and Pilot Wild while retaining the paying physical upgrades", () => {
    let s = base();
    const energy = put(s, "31013"),
      mental = put(s, "31011"),
      physical = put(s, "31012"),
      wild = pilot(s);
    const sources = paymentSources(s).filter((p) =>
      p.id.startsWith("spdr-sync:"),
    );
    expect(sources.find((p) => p.code === "31013")?.resources).toEqual([
      "energy",
    ]);
    expect(sources.find((p) => p.code === "31011")?.resources).toEqual([
      "mental",
    ]);
    expect(sources.find((p) => p.code === "31012")?.resources).toEqual([
      "physical",
    ]);
    expect(sources.find((p) => p.code === "31002b")?.resources).toEqual([
      "wild",
    ]);
    const [event, cardResource] = hand(s, "31006", "31024");
    s = paid(s, event, [cardResource], [energy]);
    s = settle(target(s, s.villain.id));
    expect(s.villain.hp).toBe(45);
    expect(s.villain.stunned).toBe(true);
    expect(actual(s, energy).exhausted).toBe(true);
    for (const p of [mental, physical, wild])
      expect(actual(s, p).exhausted).toBe(false);
    expect(
      s.player.discard.filter((p) => p.id === cardResource.id),
    ).toHaveLength(1);
    exact(s);
  });
  it("withdraws Sync Ratio sources when the actual active hero is blanked and rejects saved stale payment", () => {
    let s = base();
    const i = put(s, "31013"),
      [event, r] = hand(s, "31006", "31024");
    s = command(s, { type: "PLAY", id: event.id });
    const id = sync(s, i);
    s.flags[`novaIronheartPackBlank:${identity(s).id}`] = s.round;
    expect(isTextBlank(s, identity(s))).toBe(true);
    expect(
      paymentSources(s).filter((p) => p.id.startsWith("spdr-sync:")),
    ).toEqual([]);
    const before = reload(s);
    const failed = dispatch(reload(s), { type: "PAY", ids: [id, r.id] });
    expect(failed.error).toMatch(/unavailable/i);
    expect(failed.prompt).toEqual(before.prompt);
    expect(failed.player.hand).toEqual(before.player.hand);
    expect(actual(failed, i).exhausted).toBe(false);
    exact(failed);
  });
  it("retains printed Interface icons through text blanking, but respects Permanent Pilot and Inactive Suit immunity", () => {
    let s = base();
    const i = put(s, "31013");
    s.flags[`novaIronheartPackBlank:${i.id}`] = s.round;
    s.flags[`novaIronheartPackBlank:${pilot(s).id}`] = s.round;
    expect(isTextBlank(s, i)).toBe(true);
    expect(isTextBlank(s, pilot(s))).toBe(false);
    expect(sync(s, i)).toBe(`spdr-sync:${i.id}`);
    expect(sync(s, pilot(s))).toBe(`spdr-sync:${pilot(s).id}`);
    s = flip(s);
    s.flags[`novaIronheartPackBlank:${suit(s).id}`] = s.round;
    expect(isTextBlank(s, suit(s))).toBe(false);
    expect(
      paymentSources(s).filter((p) => p.id.startsWith("spdr-sync:")),
    ).toEqual([]);
    exact(s);
  });
  it("canceling a saved Sync Ratio payment does not exhaust any Interface or discard the actual card", () => {
    let s = base();
    const i = put(s, "31013"),
      [event] = hand(s, "31006");
    s = command(s, { type: "PLAY", id: event.id });
    s = command(reload(s), { type: "CANCEL" });
    expect(s.prompt).toBeNull();
    expect(actual(s, i).exhausted).toBe(false);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    exact(s);
  });
  it("VEN#m receives four sym counters from four actual Sync Ratio resources paid", () => {
    let s = base();
    const interfaces = [
        pilot(s),
        put(s, "31010"),
        put(s, "31011"),
        put(s, "31012"),
      ],
      [ally] = hand(s, "31003");
    s = paid(s, ally, [], interfaces);
    s = settle(respond(s, /VEN#m/, "31003"));
    expect(actual(s, ally)).toMatchObject({ counters: 4, damage: 0 });
    s = settle(
      target(
        command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.villain.hp).toBe(45);
    expect(actual(s, ally).damage).toBe(1);
    for (const p of interfaces) expect(actual(s, p).exhausted).toBe(true);
    exact(s);
  });
  it("VEN#m counts actual allocated Sync Ratio resources, excluding selected Interface overpayment", () => {
    let s = base();
    const interfaces = [
      pilot(s),
      put(s, "31010"),
      put(s, "31011"),
      put(s, "31012"),
      put(s, "31013"),
    ];
    const [ally, handResource] = hand(s, "31003", "31024");
    s = paid(s, ally, [handResource], interfaces, 3);
    s = settle(respond(s, /VEN#m/, "31003"));
    expect(actual(s, ally).counters).toBe(3);
    for (const p of interfaces) expect(actual(s, p).exhausted).toBe(true);
    exact(s);
  });
  it("VEN#m paid only from hand has no Sync Ratio bonus", () => {
    let s = base();
    const [ally, ...rs] = hand(s, "31003", "31014", "31016", "31017", "31024");
    s = settle(paid(s, ally, rs));
    expect(actual(s, ally).counters).toBe(0);
    expect(pilot(s).exhausted).toBe(false);
    exact(s);
  });
  it("Rapid Deployment uses two sequential actual thwarts when Sync Ratio paid the event", () => {
    let s = base();
    const first = side(s, 2),
      [event, r] = hand(s, "31005", "31024");
    s = paid(s, event, [r], [pilot(s)]);
    s = until(s, (v) => v.prompt?.title === "Rapid Deployment");
    s = choose(reload(s), first.id);
    s = until(s, (v) => v.prompt?.title === "Rapid Deployment");
    expect(s.sideSchemes.some((p) => p.id === first.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === first.id)).toHaveLength(
      1,
    );
    s = settle(choose(reload(s), "main"));
    expect(s.scheme.threat).toBe(5);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
    exact(s);
  });
  it("Rapid Deployment paid from hand removes threat only once", () => {
    let s = base();
    const [event, a, b] = hand(s, "31005", "31016", "31024");
    s = settle(target(paid(s, event, [a, b]), "main"));
    expect(s.scheme.threat).toBe(5);
    expect(pilot(s).exhausted).toBe(false);
    exact(s);
  });
  it("Confuse replaces Rapid Deployment's complete thwart ability despite actual Sync Ratio payment", () => {
    let s = base();
    s.player.confused = true;
    const [event, r] = hand(s, "31005", "31024");
    s = settle(paid(s, event, [r], [pilot(s)]));
    expect(s.scheme.threat).toBe(8);
    expect(s.player.confused).toBe(false);
    expect(pilot(s).exhausted).toBe(true);
    exact(s);
  });
  it.each([false, true])(
    "Web-Trap conditional stun uses actual Sync Ratio payment (%s)",
    (useSync) => {
      let s = base();
      const [event, a, b] = hand(s, "31006", "31016", "31024");
      s = settle(
        target(
          paid(s, event, useSync ? [a] : [a, b], useSync ? [pilot(s)] : []),
          s.villain.id,
        ),
      );
      expect(s.villain.hp).toBe(45);
      expect(!!s.villain.stunned).toBe(useSync);
      exact(s);
    },
  );
  it("Stun replaces Web-Trap's whole attack and conditional enemy stun after paying the actual cost", () => {
    let s = base();
    s.player.stunned = true;
    const [event, r] = hand(s, "31006", "31024");
    s = settle(paid(s, event, [r], [pilot(s)]));
    expect(s.villain.hp).toBe(50);
    expect(!!s.villain.stunned).toBe(false);
    expect(s.player.stunned).toBe(false);
    exact(s);
  });
});

describe("SP//dr native signature actions and basic Interface interrupts", () => {
  it("All Systems Go! readies every actual Interface including the Pilot used to pay its cost", () => {
    let s = base();
    const a = put(s, "31010"),
      b = put(s, "31011");
    a.exhausted = b.exhausted = true;
    const [event] = hand(s, "31004");
    s = paid(s, event, [], [pilot(s)]);
    s = settle(choose(reload(s), "ready"));
    for (const p of [a, b, pilot(s)])
      expect(actual(s, p).exhausted).toBe(false);
    exact(s);
  });
  it.each(["deck", "discard"] as const)(
    "All Systems Go! finds the same actual Interface from %s and shuffles the remaining deck",
    (zone) => {
      let s = base();
      const searched = source(s, "31011");
      s.player[zone].push(searched);
      const [event, r] = hand(s, "31004", "31024");
      const before = s.player.deck.map((p) => p.id);
      s = paid(s, event, [r]);
      s = choose(reload(s), "search");
      s = settle(choose(reload(s), searched.id));
      expect(s.player.hand.filter((p) => p.id === searched.id)).toHaveLength(1);
      expect(s.player.discard.some((p) => p.id === searched.id)).toBe(false);
      expect(s.player.deck.map((p) => p.id)).not.toEqual(
        before.filter((id) => id !== searched.id),
      );
      exact(s);
    },
  );
  it.each(["hero", "alter"] as const)(
    "Aunt May & Uncle Ben discards actual top %s cards and returns only SP//dr signatures",
    (form) => {
      let s = base(undefined, "p1", form);
      const aunt = put(s, "31007");
      const signature = source(s, "31011"),
        pool = source(s, "31016"),
        second = source(s, "31010");
      s.player.deck.unshift(signature, pool, second);
      s = settle(ability(s, aunt, "aunt-may"));
      expect(actual(s, aunt).exhausted).toBe(true);
      expect(s.player.hand.map((p) => p.id)).toContain(signature.id);
      expect(s.player.discard.map((p) => p.id)).toContain(pool.id);
      expect(s.player.hand.some((p) => p.id === second.id)).toBe(
        form === "alter",
      );
      exact(s);
    },
  );
  it("Aunt May & Uncle Ben retains physical discarded receipts across actual player-deck exhaustion", () => {
    let s = base(undefined, "p1", "alter");
    const aunt = put(s, "31007"),
      signature = source(s, "31011"),
      pool = source(s, "31016");
    s.player.hand.push(...s.player.deck.splice(0));
    s.player.deck = [signature, pool];
    const dealt = s.encounter.dealt.length;
    s = settle(ability(s, aunt, "aunt-may"));
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    expect(s.player.hand.filter((p) => p.id === signature.id)).toHaveLength(1);
    expect(s.player.deck.map((p) => p.id)).toContain(pool.id);
    exact(s);
  });
  it.each([2, 12])(
    "Ejection Protocol sets HP from %s to six, exhausts every Interface, gives Tough and preserves two identity IDs",
    (hp) => {
      let s = base();
      const ejection = put(s, "31008"),
        interfaces = [pilot(s), put(s, "31010"), put(s, "31011")];
      s.player.hp = hp;
      const suitId = suit(s).id,
        pilotId = pilot(s).id;
      s = settle(ability(s, ejection, "ejection-protocol"));
      expect(s.player.hp).toBe(6);
      expect(s.player.tough).toBe(true);
      expect(s.player.form).toBe("alter");
      expect(suit(s).id).toBe(suitId);
      expect(pilot(s).id).toBe(pilotId);
      expect(s.player.exhausted).toBe(true);
      for (const p of interfaces) expect(actual(s, p).exhausted).toBe(true);
      expect(s.player.discard.filter((p) => p.id === ejection.id)).toHaveLength(
        1,
      );
      exact(s);
    },
  );
  it("Command draw pays both real exhaust costs without exhausting the active Suit", () => {
    let s = base();
    const c = put(s, "31009"),
      i = put(s, "31011"),
      top = s.player.deck[0].id;
    s = ability(s, c, "command-draw");
    expect(s.prompt?.title).toBe("SP//dr Command");
    expect(actual(s, c).exhausted).toBe(false);
    s = settle(choose(reload(s), i.id));
    expect(actual(s, c).exhausted).toBe(true);
    expect(actual(s, i).exhausted).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual([top]);
    expect(s.player.exhausted).toBe(false);
    exact(s);
  });
  it("Command ready discards the chosen real hand card, exhausts its support and readies only the actual Interface", () => {
    let s = base();
    const c = put(s, "31009"),
      i = put(s, "31011"),
      [r] = hand(s, "31024");
    i.exhausted = true;
    s = ability(s, c, "command-ready");
    s = choose(reload(s), r.id);
    expect(s.player.discard.filter((p) => p.id === r.id)).toHaveLength(1);
    expect(actual(s, c).exhausted).toBe(true);
    s = settle(target(reload(s), i.id));
    expect(actual(s, i).exhausted).toBe(false);
    exact(s);
  });
  it("Host Spider exhausts the actual upgrade and readies the actual exhausted Suit", () => {
    let s = base();
    const host = put(s, "31010");
    s.player.exhausted = suit(s).exhausted = true;
    s = settle(ability(s, host, "host-spider"));
    expect(actual(s, host).exhausted).toBe(true);
    expect(s.player.exhausted).toBe(false);
    expect(suit(s).exhausted).toBe(false);
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: host.id,
        action: "host-spider",
      }).error,
    ).toBeTruthy();
    exact(s);
  });
  it.each([
    ["attack", "31013"],
    ["thwart", "31011"],
  ] as const)(
    "the optional %s Interface exhausts for +2 on this one actual basic power",
    (action, code) => {
      let s = base();
      const i = put(s, code);
      s = command(s, { type: "BASIC", action });
      expect(s.prompt?.title).toBe("SP//dr basic power interrupts");
      s = choose(reload(s), i.id);
      s = settle(target(s, action === "attack" ? s.villain.id : "main"));
      expect(action === "attack" ? s.villain.hp : s.scheme.threat).toBe(
        action === "attack" ? 46 : 4,
      );
      expect(actual(s, i).exhausted).toBe(true);
      expect(heroStats(s)[action]).toBe(2);
      exact(s);
    },
  );
  it("Speed-Metal Alloy adds two DEF to one native hero defense before boost damage", () => {
    let s = base();
    const i = put(s, "31012"),
      attacker = makePiece(s, "01103");
    attacker.engagedWith = "p1";
    attacker.bonusAtk = 3;
    s.minions.push(attacker);
    s = native(s, { type: "enemyAttack", id: attacker.id });
    s = target(s, "hero");
    s = respond(reload(s), /Speed-Metal Alloy/, "31012");
    s = settle(s);
    expect(actual(s, i).exhausted).toBe(true);
    expect(s.player.hp).toBe(13);
    expect(s.player.exhausted).toBe(true);
    exact(s);
  });
});

describe("SP//dr obligation, nemesis and actual resource-generation responses", () => {
  it("Inherited Burden routes to the Peni player and removes the real card after actual Peni exhaustion", () => {
    let s = base("spider_man", "p2");
    const obligation = encounter(s, "31025", "p2"),
      pilotId = pilot(s).id;
    s = reveal(s, obligation, "p1");
    s = until(s, (v) => v.prompt?.title === "Inherited Burden");
    expect(s.activePlayerId).toBe("p2");
    s = choose(reload(s), "flip");
    s = settle(choose(reload(s), "remove"));
    const pen = seatView(s, "p2").player;
    expect(pen.form).toBe("alter");
    expect(pen.exhausted).toBe(true);
    expect(pen.spdrIdentity?.id).toBe(pilotId);
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    exact(s);
  });
  it("Inherited Burden offers actual discardable Interfaces and protects the Permanent Pilot", () => {
    let s = base();
    const i = put(s, "31011"),
      obligation = encounter(s, "31025"),
      pilotId = pilot(s).id;
    s = reveal(s, obligation);
    s = choose(reload(s), "continue");
    expect(s.prompt?.options.map((o) => o.id)).toContain(i.id);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(pilotId);
    s = settle(choose(reload(s), i.id));
    expect(s.player.discard.filter((p) => p.id === i.id)).toHaveLength(1);
    expect(
      s.encounter.discard.filter((p) => p.id === obligation.id),
    ).toHaveLength(1);
    expect(pilot(s).id).toBe(pilotId);
    exact(s);
  });
  it("Shadow of the Past consumes the five original reserved encounters, rather than manufacturing replacements", () => {
    let s = base();
    const reserve = s.player.setAside!.map((p) => ({ id: p.id, code: p.code })),
      shadow = encounter(s, "01190");
    s = settle(reveal(s, shadow));
    expect(s.player.setAside).toEqual([]);
    expect(s.minions.find((p) => p.code === "31027")?.id).toBe(
      reserve.find((p) => p.code === "31027")?.id,
    );
    expect(s.sideSchemes.find((p) => p.code === "31026")).toMatchObject({
      id: reserve.find((p) => p.code === "31026")?.id,
      counters: 4,
    });
    expect(
      s.encounter.deck
        .filter((p) => p.code === "31028")
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      reserve
        .filter((p) => p.code === "31028")
        .map((p) => p.id)
        .sort(),
    );
    exact(s);
  });
  it("Giant Monster Attack requires an actual Energy resource for a native basic thwart and preserves Crisis", () => {
    let s = base();
    const giant = side(s, 4, "31026"),
      energy = put(s, "31013");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = target(s, giant.id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.requirements).toEqual(["energy"]);
    s = settle(pay(reload(s), [], "energy", [sync(s, energy)]));
    expect(actual(s, giant).counters).toBe(2);
    expect(actual(s, energy).exhausted).toBe(true);
    expect(s.scheme.threat).toBe(8);
    exact(s);
  });
  it("Giant Monster Attack adds Energy to an ally's real thwart without changing its printed consequent damage", () => {
    let s = base();
    const giant = side(s, 4, "31026"),
      ally = put(s, "31014"),
      [r] = hand(s, "31004");
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
      giant.id,
    );
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(reload(s), [r], "energy"));
    expect(actual(s, giant).counters).toBe(2);
    expect(actual(s, ally).damage).toBe(2);
    expect(actual(s, ally).exhausted).toBe(true);
    exact(s);
  });
  it("Giant Monster Attack does not charge its thwart-only additional cost to native unlabelled threat removal", () => {
    let s = base();
    const giant = side(s, 4, "31026");
    s = settle(
      native(s, {
        type: "thwart",
        target: giant.id,
        amount: 1,
        action: false,
        source: "fixture",
      }),
    );
    expect(actual(s, giant).counters).toBe(3);
    expect(pilot(s).exhausted).toBe(false);
    expect(s.player.hand).toEqual([]);
    exact(s);
  });
  it("Giant Monster Attack charges Energy separately for both actual Rapid Deployment thwarts", () => {
    let s = base();
    const giant = side(s, 4, "31026"),
      [event, ordinary, first, second] = hand(
        s,
        "31005",
        "31024",
        "31004",
        "31004",
      );
    s = paid(s, event, [ordinary], [pilot(s)]);
    s = choose(reload(s), giant.id);
    expect(s.prompt?.title).toMatch(/Giant Monster Attack/);
    expect(s.prompt?.requirements).toEqual(["energy"]);
    s = pay(reload(s), [first], "energy");
    s = until(s, (v) => v.prompt?.title === "Rapid Deployment");
    expect(actual(s, giant).counters).toBe(1);
    s = choose(reload(s), giant.id);
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(reload(s), [second], "energy"));
    expect(
      s.sideSchemes.some((p) => p.id === giant.id),
      JSON.stringify({
        giant: actual(s, giant),
        queue: s.queue,
        resolving: s.resolving,
        flags: s.flags,
      }),
    ).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === giant.id)).toHaveLength(
      1,
    );
    for (const p of [event, ordinary, first, second])
      expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    exact(s);
  });
  it("a Giant Monster Attack basic-thwart target is unavailable when no actual Energy payment remains", () => {
    const s = base();
    side(s, 4, "31026");
    pilot(s).exhausted = true;
    const failed = dispatch(reload(s), { type: "BASIC", action: "thwart" });
    expect(failed.error).toMatch(/eligible targets|energy|resource/i);
    expect(failed.player.exhausted).toBe(false);
    expect(s.scheme.threat).toBe(8);
    exact(failed);
  });
  it.each(["basic", "ally"] as const)(
    "a %s Giant Monster thwart remains legal after its last available Energy pays the additional cost",
    (kind) => {
      let s = base();
      const giant = side(s, 4, "31026"),
        [energy] = hand(s, "31004");
      pilot(s).exhausted = true;
      const ally = kind === "ally" ? put(s, "31014") : undefined;
      s =
        kind === "basic"
          ? command(s, { type: "BASIC", action: "thwart" })
          : command(s, { type: "ABILITY", id: ally!.id, action: "thwart" });
      s = target(s, giant.id);
      expect(s.prompt?.kind).toBe("payment");
      s = settle(pay(reload(s), [energy], "energy"));
      expect(actual(s, giant).counters).toBe(2);
      expect(s.player.discard.filter((p) => p.id === energy.id)).toHaveLength(
        1,
      );
      if (ally)
        expect(actual(s, ally)).toMatchObject({ exhausted: true, damage: 2 });
      else expect(s.player.exhausted).toBe(true);
      exact(s);
    },
  );
  it("Psychic Link's actual boosted basic thwart survives spending the last Energy on Giant and reloading the paid continuation", () => {
    let s = base();
    const giant = side(s, 6, "31026"),
      link = put(s, "31011"),
      [energy] = hand(s, "31004");
    pilot(s).exhausted = true;
    // The native basic interrupt precedes target selection and its extra cost.
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt?.title).toBe("SP//dr basic power interrupts");
    s = choose(reload(s), link.id);
    s = target(reload(s), giant.id);
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.requirements).toEqual(["energy"]);
    expect(actual(s, giant).counters).toBe(6);
    s = settle(reload(pay(reload(s), [energy], "energy")));
    expect(actual(s, giant).counters).toBe(2);
    expect(actual(s, link).exhausted).toBe(true);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand).toEqual([]);
    expect(s.player.discard.filter((p) => p.id === energy.id)).toHaveLength(1);
    expect(s.scheme.threat).toBe(8);
    expect(s.flags.spdrGiantThwartCostPaid).toBeUndefined();
    exact(s);
  });
  it("an actual Core Helmet pays Giant's Energy before its Aerial multi-scheme thwart and preserves Crisis", () => {
    let s = base("iron_man", "p2");
    const giant = side(s, 4, "31026"),
      other = side(s, 3);
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    const helmet = put(s, "01037"),
      boots = put(s, "01039"),
      [genius, energy] = hand(s, "01089", "01088");
    s = command(s, { type: "ABILITY", id: boots.id });
    s = settle(pay(reload(s), [genius], "mental"));
    expect(s.flags.aerial).toBe(true);
    s = command(reload(s), { type: "ABILITY", id: helmet.id });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.requirements).toEqual(["energy"]);
    expect(actual(s, giant).counters).toBe(4);
    expect(actual(s, other).counters).toBe(3);
    expect(s.scheme.threat).toBe(8);
    s = settle(reload(pay(reload(s), [energy], "energy")));
    expect(actual(s, giant).counters).toBe(3);
    expect(actual(s, other).counters).toBe(2);
    expect(s.scheme.threat).toBe(8);
    expect(actual(s, helmet).exhausted).toBe(true);
    expect(actual(s, boots).exhausted).toBe(true);
    expect(s.flags.spdrGiantThwartCostPaid).toBeUndefined();
    for (const p of [genius, energy])
      expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    exact(s);
  });
  it("M.O.R.B.I.U.S. uses all actual generated hand and Sync Ratio resources before the paid card resolves", () => {
    let s = base();
    morbius(s);
    const [event, r] = hand(s, "31006", "31024");
    s = paid(s, event, [r], [pilot(s)]);
    expect(s.player.hp).toBe(12);
    expect(s.villain.hp).toBe(50);
    s = settle(target(reload(s), s.villain.id));
    expect(s.villain.hp).toBe(45);
    expect(s.player.hp).toBe(12);
    exact(s);
  });
  it.each([false, true])(
    "Thwip's saved simultaneous damage cost consumes Tough before MORBIUS's generated-resource response (Forcefield %s)",
    (withGenerator) => {
      let s = base();
      const enemy = morbius(s),
        generator = withGenerator ? put(s, "31019") : undefined,
        [event, a, b] = hand(s, "31017", "31023", "31024");
      if (generator) generator.counters = 6;
      s.player.tough = true;
      s = reload(paid(s, event, [a, b]));
      expect(s.prompt?.title).toBe("Thwip Thwip! · deal 1 damage");
      // Neither generated-resource responses nor the event's effects may
      // interrupt the uncompleted simultaneous cost.
      expect(s.player.hp).toBe(14);
      expect(s.player.tough).toBe(true);
      if (generator) expect(actual(s, generator).counters).toBe(6);
      exact(s);
      s = choose(reload(s), "hero:p1");
      s = until(
        reload(s),
        (v) => v.prompt?.title === "Thwip Thwip! · first stun status card",
      );
      expect(s.player.tough).toBe(false);
      expect(s.player.hp).toBe(withGenerator ? 14 : 12);
      if (generator) expect(actual(s, generator).counters).toBe(4);
      expect(actual(s, enemy).damage).toBe(0);
      expect(!!s.villain.stunned).toBe(false);
      s = choose(reload(s), s.villain.id);
      s = settle(choose(reload(s), s.villain.id));
      expect(s.villain.stunned).toBe(true);
      expect(s.player.hp).toBe(withGenerator ? 14 : 12);
      for (const p of [event, a, b])
        expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
      exact(s);
    },
  );
  it("M.O.R.B.I.U.S. counts overgenerated double-icon hand cards in a legal constructed forty-card source", () => {
    let s = base(undefined, "p1", "hero", custom(["31024", "01089"]));
    morbius(s);
    const [event, genius] = hand(s, "31004", "01089");
    s = paid(s, event, [genius]);
    expect(s.player.hp).toBe(12);
    s = settle(
      choose(s, "search"),
      (v) => v.prompt?.options.find((o) => o.image === "31011")?.id,
    );
    expect(s.player.discard.filter((p) => p.id === genius.id)).toHaveLength(1);
    exact(s);
  });
  it("one simultaneous three-resource payment gives M.O.R.B.I.U.S. one damage packet fully prevented by Tough", () => {
    let s = base();
    morbius(s);
    s.player.tough = true;
    const [event, a, b, c] = hand(s, "31006", "31014", "31016", "31024");
    s = paid(s, event, [a, b, c]);
    expect(s.player.hp).toBe(14);
    expect(s.player.tough).toBe(false);
    s = settle(target(s, s.villain.id));
    expect(s.villain.hp).toBe(45);
    exact(s);
  });
  it("M.O.R.B.I.U.S. deals actual overpayment damage and preserves the selected Sync allocation through hydration", () => {
    let s = base();
    morbius(s);
    const i = put(s, "31013"),
      [event, a, b] = hand(s, "31006", "31016", "31004");
    s = paid(s, event, [a, b], [i], 0);
    expect(s.player.hp).toBe(11);
    s = settle(target(reload(s), s.villain.id));
    expect(s.villain.hp).toBe(45);
    expect(!!s.villain.stunned).toBe(false);
    expect(actual(s, i).exhausted).toBe(true);
    exact(s);
  });
  it("M.O.R.B.I.U.S. cannot damage alter-ego Peni during an actual resource payment", () => {
    let s = base(undefined, "p1", "alter");
    morbius(s);
    const [support, r] = hand(s, "31007", "31024");
    s = settle(paid(s, support, [r]));
    expect(s.player.hp).toBe(14);
    expect(actual(s, support).code).toBe("31007");
    exact(s);
  });
  it("M.O.R.B.I.U.S. counts Genius, a discarded event and actual Pepper Potts generation for an engaged teammate", () => {
    let s = base("iron_man", "p2");
    morbius(s, "p1", "p2");
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    const pepper = put(s, "01033"),
      double = source(s, "01088");
    s.player.discard.push(double);
    const [mansion, genius, aid] = hand(s, "01091", "01089", "01086");
    const offered = paymentSources(s, mansion.id, mansion.code).find(
      (p) => p.id === pepper.id,
    );
    expect(offered?.resources).toEqual(["energy", "energy"]);
    s = command(s, { type: "PLAY", id: mansion.id });
    s = settle(
      command(reload(s), {
        type: "PAY",
        ids: [genius.id, aid.id, pepper.id],
        wildAs: "energy",
      }),
    );
    expect(seatView(s, "p1").player.hp).toBe(4);
    expect(seatView(s, "p2").player.hp).toBe(14);
    expect(actual(s, pepper).exhausted).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === mansion.id)).toBe(true);
    exact(s);
  });
  it("M.O.R.B.I.U.S. resource damage eliminates its actual engaged player before that player's paid Web-Trap resolves", () => {
    let s = base("spider_man");
    morbius(s);
    s.player.hp = 2;
    const [event, a, b] = hand(s, "31006", "31016", "31024");
    s = paid(s, event, [a, b]);
    s = settle(s);
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(s.villain.hp).toBe(50);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.attack).toBeNull();
    exact(s);
  });
  it.each(["hero", "alter"] as const)(
    "Energy Drain's unpaid %s choice uses actual damage or exhaustion",
    (form) => {
      let s = base(undefined, "p1", form);
      const drain = encounter(s, "31028");
      s = reveal(s, drain);
      s = until(s, (v) => v.prompt?.title === "Energy Drain");
      s = settle(choose(reload(s), "other"));
      expect(s.player.hp).toBe(form === "hero" ? 11 : 14);
      expect(s.player.exhausted).toBe(form === "alter");
      expect(s.encounter.discard.filter((p) => p.id === drain.id)).toHaveLength(
        1,
      );
      exact(s);
    },
  );
  it("Energy Drain spends two actual Energy resources and discards the same resolved treachery", () => {
    let s = base();
    const energy = put(s, "31013"),
      [r] = hand(s, "31004"),
      drain = encounter(s, "31028");
    s = reveal(s, drain);
    s = until(s, (v) => v.prompt?.title === "Energy Drain");
    s = choose(reload(s), "pay");
    expect(s.prompt?.requirements).toEqual(["energy", "energy"]);
    s = settle(pay(reload(s), [r], "energy", [sync(s, energy)]));
    expect(s.player.hp).toBe(14);
    expect(actual(s, energy).exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === r.id)).toBe(true);
    expect(s.encounter.discard.filter((p) => p.id === drain.id)).toHaveLength(
      1,
    );
    exact(s);
  });
  it("Energy Drain rejects a saved two-resource payment that lacks its two Energy icons without spending either card", () => {
    let s = base();
    const [energy, physical] = hand(s, "31004", "31024"),
      drain = encounter(s, "31028");
    s = reveal(s, drain);
    s = until(s, (v) => v.prompt?.title === "Energy Drain");
    s = choose(reload(s), "pay");
    const before = reload(s),
      failed = dispatch(reload(s), {
        type: "PAY",
        ids: [energy.id, physical.id],
        wildAs: "energy",
      });
    expect(failed.error).toMatch(/energy/i);
    expect(failed.prompt).toEqual(before.prompt);
    expect(failed.player.hand).toEqual(before.player.hand);
    expect(failed.player.hp).toBe(14);
    exact(failed);
  });
});

describe("SP//dr Sync Ratio with independent Jubilee Wild declarations", () => {
  it.each([
    ["mental", true],
    ["energy", false],
  ] as const)(
    "only counts the actual Interface icon in the %s + physical cost subset",
    (paidWild, shouldStun) => {
      let s = base("jubilee");
      const glasses = source(s, "47005", "p2");
      s.player.inPlay.push(glasses);
      const host = put(s, "31010");
      const [event, physical] = hand(s, "31006", "31024");
      const coat = source(s, "47004", "p2");
      s.player.hand.push(coat);
      const before = all(s)
        .map((p) => p.id)
        .sort();
      s = command(s, { type: "PLAY", id: event.id });
      const sourceIds = [sync(s, host), coat.id, physical.id];
      s = command(reload(s), { type: "PAY", ids: sourceIds });
      expect(s.prompt?.title).toBe("Declare Wild resource");
      s = choose(reload(s), "mental");
      expect(s.player.inPlay.find((p) => p.id === host.id)?.exhausted).toBe(
        false,
      );
      s = choose(reload(s), "energy");
      expect(s.prompt?.title).toBe("Allocate payment resources");
      const paid = [paidWild, "physical"].sort().join(":");
      const allocation = s.prompt!.options.find((o) =>
        o.effects.some(
          (e) =>
            e.type === "commitPaymentAllocation" &&
            [...e.paidForCard].sort().join(":") === paid,
        ),
      )!;
      expect(allocation).toBeDefined();
      s = choose(reload(s), allocation.id);
      expect(s.prompt?.title).not.toBe("Allocate Sync Ratio resources");
      s = settle(target(reload(s), s.villain.id));
      expect(s.villain.hp).toBe(45);
      expect(s.villain.stunned).toBe(shouldStun);
      expect(actual(s, host).exhausted).toBe(true);
      expect(actual(s, coat).ownerId).toBe("p2");
      expect(s.player.discard.some((p) => p.id === physical.id)).toBe(true);
      expect(
        all(reload(s))
          .map((p) => p.id)
          .sort(),
      ).toEqual(before);
      exact(s);
    },
  );
});
