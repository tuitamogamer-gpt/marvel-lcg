/** Actual native commands, original source IDs, and JSON before each command. */
import { describe, expect, it } from "vitest";
import {
  aerial,
  card,
  deckCodes,
  handSize,
  heroCard,
  heroStats,
  maxHP,
} from "../src/game/cards.js";
import { STARTER_DECKS, catalogDeckCodes } from "../src/game/catalog.js";
import {
  dispatch,
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
  paymentSources,
  playable,
  cardCost,
} from "../src/game/engine.js";
import {
  ironheartIdentityCode,
  ironheartProgress,
  ironheartVersion,
} from "../src/game/ironheart.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  attach,
  choose,
  command,
  finish,
  hand,
  native,
  pay,
  play,
  put,
  reload,
  respond,
  target,
  top,
  until,
} from "./dv-test-helpers.js";

type Fixture = GameState & { ironheartOriginalIds?: string[] };
function starting(team = false, ironheartSeat = "p1") {
  const ironheart = { heroId: "ironheart", aspect: "leadership" as const };
  const peter = { heroId: "spider_man", aspect: "justice" as const };
  return newGame({
    ...ironheart,
    villainId: "rhino",
    seed: 29001,
    pacing: "expert",
    ...(team
      ? {
          heroes:
            ironheartSeat === "p1" ? [ironheart, peter] : [peter, ironheart],
        }
      : {}),
  });
}
function allPhysical(s: GameState): Piece[] {
  const walk = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(walk),
    ...(p.captured || []).flatMap(walk),
    ...(p.droneCard ? walk(p.droneCard) : []),
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
  ].flatMap(walk);
}
const source = (s: GameState, id = s.activePlayerId) =>
  allPhysical(s).filter(
    (p) =>
      p.ownerId === id &&
      card(p).faction_code !== "encounter" &&
      !["hero", "alter_ego"].includes(card(p).type_code),
  );
function exact(
  s: GameState,
  ids: string[] = (s as Fixture).ironheartOriginalIds || [],
) {
  const all = allPhysical(s);
  for (const id of ids)
    expect(
      all.filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function base(team = false, ironheartSeat = "p1") {
  let s = starting(team, ironheartSeat);
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  const obligation = s.encounter.deck.find((p) => p.code === "29028")!;
  expect(obligation).toBeTruthy();
  const original = [
    ...source(s, ironheartSeat),
    ...seatView(s, ironheartSeat).player.setAside!,
    seatView(s, ironheartSeat).player.ironheartIdentity!,
    obligation,
  ].map((p) => p.id);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    const src = source(s, seat.id);
    v.player.deck = src;
    v.player.hand = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.form = "hero";
    v.player.exhausted = v.player.flipped = false;
    v.player.hp = seat.heroId === "ironheart" ? 10 : 10;
    v.player.stunned = v.player.confused = v.player.tough = false;
  }
  s.queue = [];
  s.resolving = [];
  s.prompt = s.review = null;
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.environments = [];
  s.encounter.deck = [
    ...Array.from({ length: 20 }, () => makePiece(s, "01186")),
    obligation,
  ];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).ironheartOriginalIds = original;
  activateSeat(s, ironheartSeat);
  s.turnPlayerId = ironheartSeat;
  return s;
}
function done(s: GameState, prefer?: (s: GameState) => string | undefined) {
  s = finish(s, prefer);
  exact(s);
  return s;
}
function level(s: GameState) {
  return done(
    command(s, {
      type: "ABILITY",
      id: "identity",
      action: "ironheart-level-up",
    }),
  );
}
function reserve(s: GameState, code: string): Piece {
  const z = s.player.setAside!;
  const i = z.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  return z.splice(i, 1)[0];
}
function reveal(s: GameState, p: Piece) {
  return native(s, { type: "reveal", piece: p });
}
function v2(s: GameState) {
  s.player.ironheartIdentity!.counters = 7;
  return level(s);
}
function v3(s: GameState) {
  s = v2(s);
  s.player.ironheartIdentity!.counters = 7;
  return level(s);
}
function ability(s: GameState, id: string) {
  return command(s, { type: "ABILITY", id });
}

describe("Ironheart's actual original source and three physical identities", () => {
  it("opens original source40 and reserves two identity versions plus five original nemeses", () => {
    const s = starting(),
      starter = STARTER_DECKS.find((d) => d.id === "starter-29001a")!;
    expect(deckCodes("ironheart", "leadership").sort()).toEqual(
      catalogDeckCodes(starter).sort(),
    );
    expect(source(s)).toHaveLength(40);
    expect(new Set(source(s).map((p) => p.id)).size).toBe(40);
    expect(
      source(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual(catalogDeckCodes(starter).sort());
    expect(
      source(s).filter((p) => card(p).faction_code === "hero"),
    ).toHaveLength(15);
    expect(
      source(s).filter((p) => card(p).faction_code === "leadership"),
    ).toHaveLength(17);
    expect(
      source(s).filter((p) => card(p).faction_code === "basic"),
    ).toHaveLength(8);
    expect(s.player.ironheartIdentity?.code).toBe("29001a");
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "29002a",
      "29003a",
      "29029",
      "29030",
      "29031",
      "29032",
      "29032",
    ]);
    expect(s.player.hand).toHaveLength(6);
    expect(s.player.deck).toHaveLength(34);
    expect(s.player.hp).toBe(10);
    expect(heroCard(s).code).toBe("29001b");
    expect(handSize(s)).toBe(6);
    expect(heroStats(s).recover).toBe(3);
  });
  it("retains all forty actual cards through Keep and creates no identity face as a deck card", () => {
    let s = starting();
    const ids = allPhysical(s)
      .filter((p) => ["29001a", "29002a", "29003a"].includes(p.code))
      .map((p) => p.id);
    s = done(command(s, { type: "MULLIGAN", ids: [] }));
    expect(source(s)).toHaveLength(40);
    expect(source(s).some((p) => /[ab]$/.test(p.code))).toBe(false);
    exact(s, ids);
  });
  it("native Level Up preserves HP, status, attached pieces and surplus progress while replacing the exact physical identity", () => {
    let s = base();
    const old = s.player.ironheartIdentity!,
      next = s.player.setAside!.find((p) => p.code === "29002a")!;
    const id = old.id,
      attachment = attach(s, "25032", old.id);
    s.player.ironheartIdentity!.counters = 9;
    s.player.hp = 4;
    s.player.exhausted = true;
    s.player.stunned = true;
    s.player.confused = true;
    s.player.tough = true;
    s.player.flipped = true;
    s = level(s);
    expect(s.player.ironheartIdentity).toMatchObject({
      id: next.id,
      code: "29002a",
      counters: 3,
    });
    expect(s.player.setAside?.find((p) => p.id === id)?.code).toBe("29001a");
    expect(s.player.hp).toBe(4);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.flipped).toBe(true);
    expect(s.player.stunned && s.player.confused && s.player.tough).toBe(true);
    expect(s.attachments.find((p) => p.id === attachment.id)?.attachedTo).toBe(
      next.id,
    );
    expect(handSize(s)).toBe(5);
    expect(heroStats(s).thwart).toBe(2);
    expect(aerial(s)).toBe(true);
  });
  it("native Version 2 upgrade gives tough and Version 3 printed powers survive save/reload", () => {
    let s = v2(base());
    s.player.hp = 5;
    s.player.exhausted = true;
    s.player.ironheartIdentity!.counters = 8;
    const final = s.player.setAside!.find((p) => p.code === "29003a")!.id;
    s = level(s);
    s = command(reload(s), { type: "SET_PACING", pacing: "expert" });
    expect(s.player.ironheartIdentity?.id).toBe(final);
    expect(ironheartProgress(s)).toBe(2);
    expect(s.player.hp).toBe(5);
    expect(s.player.tough).toBe(true);
    expect(handSize(s)).toBe(6);
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 3, defense: 3 });
    expect(heroCard(s).code).toBe("29003a");
    exact(s);
  });
  it("a native ordinary form change retains the same version and same physical progress", () => {
    let s = v2(base());
    const id = s.player.ironheartIdentity!.id;
    s = done(command(s, { type: "FLIP" }));
    expect(s.player.ironheartIdentity?.id).toBe(id);
    expect(ironheartIdentityCode(s)).toBe("29002b");
    expect(heroCard(s).code).toBe("29002b");
    expect(handSize(s)).toBe(6);
    expect(ironheartProgress(s)).toBe(1);
    expect(aerial(s)).toBe(false);
  });
  it("p2's identity and actual reserved versions survive seat activation and JSON commands", () => {
    let s = base(true, "p2");
    s = v3(s);
    const id = s.player.ironheartIdentity!.id;
    activateSeat(s, "p1");
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    expect(seatView(s, "p2").player.ironheartIdentity?.id).toBe(id);
    expect(ironheartVersion(seatView(s, "p2"))).toBe(3);
    activateSeat(s, "p2");
    expect(heroCard(s).code).toBe("29003a");
    exact(s);
  });
  it("native five-nemesis release leaves all three physical identities outside the encounter deck", () => {
    let s = base();
    const ids = [
      s.player.ironheartIdentity!,
      ...s.player.setAside!.filter((p) => p.code.endsWith("a")),
    ].map((p) => p.id);
    const lucia = s.player.setAside!.find((p) => p.code === "29030")!.id;
    s = done(reveal(s, makePiece(s, "01190")));
    expect(s.minions.find((p) => p.code === "29030")?.id).toBe(lucia);
    expect(s.sideSchemes.find((p) => p.code === "29029")?.counters).toBe(4);
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "29002a",
      "29003a",
    ]);
    expect(s.encounter.deck.some((p) => ids.includes(p.id))).toBe(false);
    exact(s, ids);
  });
});

describe("native Child Prodigy payments, physical limits and Stroke of Genius provenance", () => {
  it("Version 1 requires one actual mental and cancellation leaves the source and once-round limit untouched", () => {
    let s = base();
    s.player.form = "alter";
    const [mental] = hand(s, "29011");
    s = ability(s, "identity");
    expect(s.prompt?.kind).toBe("payment");
    expect(s.prompt?.requirements).toEqual(["mental"]);
    s = command(s, { type: "CANCEL" });
    expect(ironheartProgress(s)).toBe(0);
    expect(s.player.hand.some((p) => p.id === mental.id)).toBe(true);
    expect(nativeHeroAbilityOptions(s)).toHaveLength(1);
    s = ability(s, "identity");
    s = done(pay(s, [mental]));
    expect(ironheartProgress(s)).toBe(1);
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
  });
  it("used Child Prodigy persists across native ordinary flips but new physical Version 2 gets its own limit", () => {
    let s = base();
    s.player.form = "alter";
    let [mental] = hand(s, "29011");
    s = done(pay(ability(s, "identity"), [mental]));
    s = done(command(s, { type: "FLIP" }));
    s.player.ironheartIdentity!.counters = 7;
    s = level(s);
    s.player.flipped = false;
    s = done(command(s, { type: "FLIP" }));
    hand(s, "29005");
    expect(nativeHeroAbilityOptions(s)).toHaveLength(1);
    s = ability(s, "identity");
    expect(s.prompt?.options.map((o) => o.id)).toContain("mental");
    s = choose(s, "mental");
    s = done(pay(s, [s.player.hand[0]]));
    expect(ironheartProgress(s)).toBe(2);
  });
  it("same physical identity retains its limit through an actual hero/alter roundtrip", () => {
    let s = base();
    s.player.form = "alter";
    const [mental] = hand(s, "29011");
    s = done(pay(ability(s, "identity"), [mental]));
    s = done(command(s, { type: "FLIP" }));
    s.player.flipped = false;
    s = done(command(s, { type: "FLIP" }));
    hand(s, "29005");
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
    const failed = dispatch(reload(s), { type: "ABILITY", id: "identity" });
    expect(failed.error).toBeTruthy();
    expect(ironheartProgress(failed)).toBe(1);
  });
  it("Version 2 pays any two actual resources and Version 3 any one", () => {
    let s = v2(base());
    s.player.form = "alter";
    let rs = hand(s, "29006", "29013");
    s = ability(s, "identity");
    s = choose(s, "any");
    expect(s.prompt?.cost).toBe(2);
    expect(s.prompt?.requirements).toEqual([]);
    s = done(pay(s, rs));
    expect(ironheartProgress(s)).toBe(2);
    s.player.form = "hero";
    s.player.ironheartIdentity!.counters = 7;
    s = level(s);
    s.player.form = "alter";
    rs = hand(s, "29006");
    s = done(pay(ability(s, "identity"), rs));
    expect(ironheartProgress(s)).toBe(2);
  });
  it("actually spending Stroke for Child Prodigy opens its optional response after cost commit and before the ability progress", () => {
    let s = base();
    s.player.form = "alter";
    const [stroke] = hand(s, "29009");
    const draw = top(s, "29005");
    s = pay(ability(s, "identity"), [stroke]);
    expect(ironheartProgress(s)).toBe(0);
    expect(s.player.discard.some((p) => p.id === stroke.id)).toBe(true);
    expect(nativeHeroAbilityOptions(s)).toEqual([]);
    s = respond(s, /Stroke of Genius/);
    s = done(s);
    expect(ironheartProgress(s)).toBe(2);
    expect(s.player.hand.some((p) => p.id === draw.id)).toBe(true);
  });
  it("a native zero-cost legal SPEND still triggers Stroke, without doubling its hand resource", () => {
    let s = v3(base());
    const [scan, stroke] = hand(s, "29008", "29009");
    expect(cardCost(s, card(scan), scan)).toBe(0);
    expect(
      paymentSources(s, undefined, scan.code).filter((x) => x.id === stroke.id),
    ).toHaveLength(1);
    s = command(s, { type: "PLAY", id: scan.id });
    if (s.prompt?.options.some((o) => o.id === "spend")) s = choose(s, "spend");
    if (s.prompt?.kind !== "payment")
      throw Error("Zero-cost Sector Scan should offer actual spending");
    s = pay(s, [stroke]);
    s = respond(s, /Stroke of Genius/);
    s = done(s);
    expect(ironheartProgress(s)).toBe(2);
    expect(s.player.discard.some((p) => p.id === stroke.id)).toBe(true);
  });
  it("native paid Photon Beam can spend two actual Stroke copies, opening two independent responses", () => {
    let s = base();
    const [beam, a, b] = hand(s, "29006", "29009", "29009");
    s = play(s, beam, [a, b]);
    s = respond(s, /Stroke of Genius/);
    s = respond(s, /Stroke of Genius/);
    s = target(s, s.villain.id);
    s = done(s);
    expect(ironheartProgress(s)).toBe(3);
    expect(s.villain.hp).toBe(46);
  });
  it("discarding Stroke with a native hand discard is not resource SPEND", () => {
    let s = base();
    const [stroke] = hand(s, "29009");
    s = done(native(s, { type: "discardHand", id: stroke.id }));
    expect(ironheartProgress(s)).toBe(0);
    expect(s.player.discard.some((p) => p.id === stroke.id)).toBe(true);
  });
  it("native Brawn has printed 3 ATK/2 THW/3 health and exposes one mental only while exhausted", () => {
    let s = base();
    const b = put(s, "29004");
    expect([card(b).attack, card(b).thwart, card(b).health]).toEqual([3, 2, 3]);
    expect(paymentSources(s).some((p) => p.id === b.id)).toBe(false);
    s = target(
      command(s, { type: "ABILITY", id: b.id, action: "attack" }),
      s.villain.id,
    );
    s = done(s);
    expect(s.player.inPlay.find((p) => p.id === b.id)).toMatchObject({
      exhausted: true,
      damage: 1,
    });
    expect(paymentSources(s).find((p) => p.id === b.id)?.resources).toEqual([
      "mental",
    ]);
  });
  it("native Brawn's phase limit survives readying and re-exhausting the same actual ally", () => {
    let s = base();
    s.player.form = "alter";
    const b = put(s, "29004");
    b.exhausted = true;
    s = done(pay(ability(s, "identity"), [], undefined, [b.id]));
    expect(paymentSources(s).some((p) => p.id === b.id)).toBe(false);
    s.player.inPlay.find((p) => p.id === b.id)!.exhausted = false;
    s.player.inPlay.find((p) => p.id === b.id)!.exhausted = true;
    expect(paymentSources(s).some((p) => p.id === b.id)).toBe(false);
    s.phase = "villain";
    expect(paymentSources(s).some((p) => p.id === b.id)).toBe(true);
  });
});

describe("Ironheart native event receipts and version-dependent support actions", () => {
  it("actual Photon Beam defeats original Lucia and awards two causal progress counters", () => {
    let s = base();
    const lucia = reserve(s, "29030");
    lucia.engagedWith = s.activePlayerId;
    s.minions.push(lucia);
    const [beam, a, b] = hand(s, "29006", "29005", "29011");
    s = target(play(s, beam, [a, b]), lucia.id);
    s = done(s);
    expect(s.minions.some((p) => p.id === lucia.id)).toBe(false);
    expect(ironheartProgress(s)).toBe(2);
    expect(s.encounter.discard.some((p) => p.id === lucia.id)).toBe(true);
  });
  it("actual tough prevents Photon Beam's damage but still places its ordinary one progress", () => {
    let s = base();
    const lucia = reserve(s, "29030");
    lucia.tough = true;
    lucia.engagedWith = s.activePlayerId;
    s.minions.push(lucia);
    const [beam, a, b] = hand(s, "29006", "29005", "29011");
    s = done(target(play(s, beam, [a, b]), lucia.id));
    expect(s.minions.find((p) => p.id === lucia.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
    expect(ironheartProgress(s)).toBe(1);
  });
  it("native Stun replaces Photon Beam's whole ability including progress after spending the card", () => {
    let s = base();
    s.player.stunned = true;
    const [beam, a, b] = hand(s, "29006", "29005", "29011");
    s = done(play(s, beam, [a, b]));
    expect(s.player.stunned).toBe(false);
    expect(ironheartProgress(s)).toBe(0);
    expect(s.villain.hp).toBe(50);
    expect(s.player.discard.some((p) => p.id === beam.id)).toBe(true);
  });
  it("actual Fly Over removing the last main-scheme threat awards two causal progress", () => {
    let s = base();
    s.scheme.threat = 2;
    const [fly, a, b] = hand(s, "29005", "29006", "29011");
    s = done(target(play(s, fly, [a, b]), "main"));
    expect(s.scheme.threat).toBe(0);
    expect(ironheartProgress(s)).toBe(2);
  });
  it("actual Fly Over leaving threat awards one progress", () => {
    let s = base();
    const [fly, a, b] = hand(s, "29005", "29006", "29011");
    s = done(target(play(s, fly, [a, b]), "main"));
    expect(s.scheme.threat).toBe(3);
    expect(ironheartProgress(s)).toBe(1);
  });
  it("native Confuse replaces all of Fly Over, including its progress clause", () => {
    let s = base();
    s.player.confused = true;
    const [fly, a, b] = hand(s, "29005", "29006", "29011");
    s = done(play(s, fly, [a, b]));
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(6);
    expect(ironheartProgress(s)).toBe(0);
  });
  it("New and Improved actually searches for a source signature and shuffles while choosing distinct Version 3 options", () => {
    let s = v3(base());
    s.player.exhausted = true;
    s.player.tough = false;
    s.player.toughCards = 0;
    const search = top(s, "29009");
    const [event, a, b, c] = hand(s, "29007", "29005", "29006", "29011");
    s = play(s, event, [a, b, c]);
    s = choose(s, "ready");
    expect(s.prompt?.options.some((o) => o.id === "ready")).toBe(false);
    s = choose(s, "tough");
    s = choose(s, "search");
    s = choose(s, search.id);
    s = done(s);
    expect(s.player.hand.some((p) => p.id === search.id)).toBe(true);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.tough).toBe(true);
    expect(ironheartProgress(s)).toBe(1);
  });
  it.each([
    [1, 2],
    [2, 1],
    [3, 0],
  ])(
    "Sector Scan's actual cost at Version %i is %i in either form, but PLAY requires hero form",
    (version, cost) => {
      let s = base();
      if (version >= 2) s = v2(s);
      if (version === 3) {
        s.player.ironheartIdentity!.counters = 7;
        s = level(s);
      }
      const [scan] = hand(s, "29008");
      expect(cardCost(s, card(scan), scan)).toBe(cost);
      s.player.form = "alter";
      expect(cardCost(s, card(scan), scan)).toBe(cost);
      expect(playable(s, scan)).toMatch(/hero form/);
    },
  );
  it("native Ronnie's heal respects actual +2 maximum and exhausts the actual card", () => {
    let s = base();
    const ronnie = put(s, "29010");
    put(s, "29012");
    s.player.hp = 11;
    s.player.form = "alter";
    s = ability(s, ronnie.id);
    s = done(choose(s, "heal"));
    expect(s.player.hp).toBe(12);
    expect(s.player.inPlay.find((p) => p.id === ronnie.id)?.exhausted).toBe(
      true,
    );
  });
  it("native Tony adds one of the actual top two and discards the other without drawing or spending Stroke", () => {
    let s = base();
    const tony = put(s, "29011");
    const b = top(s, "29006"),
      a = top(s, "29009");
    const hidden = s.hiddenInfo;
    s = ability(s, tony.id);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    s = done(choose(s, a.id));
    expect(s.player.hand.some((p) => p.id === a.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === b.id)).toBe(true);
    expect(ironheartProgress(s)).toBe(0);
    expect(s.hiddenInfo).toBeGreaterThan(hidden!);
  });
  it("native Blasters/Jets add two hit points each on actual PLAY and cap HP on native leave play", () => {
    let s = base();
    const [blaster, a, b] = hand(s, "29012", "29005", "29006");
    s = done(play(s, blaster, [a, b]));
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(12);
    const [jets, c, d] = hand(s, "29013", "29005", "29011");
    s = done(play(s, jets, [c, d]));
    expect(maxHP(s)).toBe(14);
    expect(s.player.hp).toBe(14);
    s = done(native(s, { type: "discardPiece", id: blaster.id }));
    expect(maxHP(s)).toBe(12);
    expect(s.player.hp).toBe(12);
    s = done(native(s, { type: "discardPiece", id: jets.id }));
    expect(maxHP(s)).toBe(10);
    expect(s.player.hp).toBe(10);
  });
  it("native Version 3 Blasters and Jets are nonattack/non-thwart and preserve Stun/Confuse", () => {
    let s = v3(base());
    const a = put(s, "29012"),
      b = put(s, "29013");
    s.player.stunned = s.player.confused = true;
    s = done(target(ability(s, a.id), s.villain.id));
    s = done(target(ability(s, b.id), "main"));
    expect(s.villain.hp).toBe(47);
    expect(s.scheme.threat).toBe(3);
    expect(s.player.stunned && s.player.confused).toBe(true);
  });
  it("native Maximum Efficiency consumes one counter for nonattack damage and preserves Stun", () => {
    let s = v3(base());
    s.player.stunned = true;
    s = done(target(ability(s, "identity"), s.villain.id));
    expect(s.villain.hp).toBe(48);
    expect(s.player.stunned).toBe(true);
    expect(ironheartProgress(s)).toBe(0);
  });
});

describe("Ironheart native obligation and physical nemesis rules", () => {
  it("actual A Minor Setback removes one progress and discards the original obligation", () => {
    let s = base();
    const i = s.encounter.deck.findIndex((p) => p.code === "29028"),
      p = s.encounter.deck.splice(i, 1)[0];
    s.player.ironheartIdentity!.counters = 2;
    s = done(reveal(s, p));
    expect(ironheartProgress(s)).toBe(1);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.dealt).toEqual([]);
  });
  it("actual A Minor Setback with zero progress deals one card then shuffles the original obligation", () => {
    let s = base();
    const i = s.encounter.deck.findIndex((p) => p.code === "29028"),
      p = s.encounter.deck.splice(i, 1)[0],
      next = s.encounter.deck[0];
    s = done(reveal(s, p));
    expect(s.encounter.dealt.some((q) => q.id === next.id)).toBe(true);
    expect(s.encounter.deck.some((q) => q.id === p.id)).toBe(true);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(false);
  });
  it("actual Cyborg Tech attaches to original Lucia and grants three HP plus native retaliate", () => {
    let s = base();
    const lucia = reserve(s, "29030"),
      tech = reserve(s, "29031");
    lucia.engagedWith = s.activePlayerId;
    s.minions.push(lucia);
    s = done(reveal(s, tech));
    expect(s.attachments.find((p) => p.id === tech.id)?.attachedTo).toBe(
      lucia.id,
    );
    const before = s.player.hp;
    s = target(command(s, { type: "BASIC", action: "attack" }), lucia.id);
    s = done(s);
    expect(s.minions.find((p) => p.id === lucia.id)?.damage).toBe(2);
    expect(s.player.hp).toBe(before - 1);
  });
  it("actual Political Retribution resolves Lucia's +1-tough scheme then adds three to Rule by Force", () => {
    let s = base();
    s.scheme.threat = 0;
    const lucia = reserve(s, "29030"),
      rule = reserve(s, "29029"),
      treachery = reserve(s, "29032");
    lucia.engagedWith = s.activePlayerId;
    lucia.tough = true;
    rule.counters = 4;
    s.minions.push(lucia);
    s.sideSchemes.push(rule);
    s = done(reveal(s, treachery));
    expect(s.scheme.threat).toBe(3);
    expect(s.sideSchemes.find((p) => p.id === rule.id)?.counters).toBe(7);
  });
  it("actual Political Retribution still adds threat when Lucia's scheme is canceled by Confuse", () => {
    let s = base();
    const lucia = reserve(s, "29030"),
      rule = reserve(s, "29029"),
      treachery = reserve(s, "29032");
    lucia.engagedWith = s.activePlayerId;
    lucia.confused = true;
    rule.counters = 4;
    s.minions.push(lucia);
    s.sideSchemes.push(rule);
    s = done(reveal(s, treachery));
    expect(s.scheme.threat).toBe(6);
    expect(s.minions.find((p) => p.id === lucia.id)?.confused).toBe(false);
    expect(s.sideSchemes.find((p) => p.id === rule.id)?.counters).toBe(7);
  });
  it("an actual villain-stage defeat by Photon Beam awards two progress without inventing a minion defeat", () => {
    let s = base();
    s.villain.hp = 4;
    const [beam, a, b] = hand(s, "29006", "29005", "29011");
    s = done(target(play(s, beam, [a, b]), s.villain.id));
    expect(s.villain.stage).toBe(2);
    expect(ironheartProgress(s)).toBe(2);
  });
  it("Fly Over awards its two progress for an actual side-scheme defeat and conserves that source ID", () => {
    let s = base();
    const rule = reserve(s, "29029");
    rule.counters = 3;
    s.sideSchemes.push(rule);
    const [fly, a, b] = hand(s, "29005", "29006", "29011");
    s = done(target(play(s, fly, [a, b]), rule.id));
    expect(s.sideSchemes.some((p) => p.id === rule.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === rule.id)).toBe(true);
    expect(ironheartProgress(s)).toBe(2);
  });
  it("Cyborg Tech's actual boost is dealt once and avoids ordinary boost discard cleanup", () => {
    let s = base();
    const tech = reserve(s, "29031");
    s.encounter.deck.unshift(tech);
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero"));
    s = done(choose(s, "hero"));
    expect(s.encounter.dealt.filter((p) => p.id === tech.id)).toHaveLength(1);
    expect(s.encounter.dealt.find((p) => p.id === tech.id)?.dealtTo).toBe("p1");
    expect(s.encounter.discard.some((p) => p.id === tech.id)).toBe(false);
    exact(s);
  });
  it("native new-round completion grants Lucia tough while preserving her actual ID", () => {
    let s = base();
    const lucia = reserve(s, "29030");
    lucia.engagedWith = s.activePlayerId;
    s.minions.push(lucia);
    s.phase = "villain";
    s = done(native(s, { type: "newRound" }));
    expect(s.round).toBe(2);
    expect(s.minions.find((p) => p.id === lucia.id)?.tough).toBe(true);
    expect(s.player.setAside?.some((p) => p.code === "29030")).toBe(false);
    exact(s);
  });
  it("native Rule by Force contributes one acceleration with Lucia absent", () => {
    let s = base();
    const rule = reserve(s, "29029");
    rule.counters = 4;
    s.sideSchemes.push(rule);
    s.scheme.threat = 0;
    s = native(s, { type: "villainStepOne" });
    expect(s.scheme.threat).toBe(2);
    exact(s);
  });
  it("native Rule by Force deals an extra physical hazard card while Lucia is present", () => {
    let s = base();
    const rule = reserve(s, "29029"),
      lucia = reserve(s, "29030");
    rule.counters = 4;
    lucia.engagedWith = s.activePlayerId;
    s.sideSchemes.push(rule);
    s.minions.push(lucia);
    const first = makePiece(s, "01100"),
      second = makePiece(s, "01100");
    s.encounter.deck.unshift(first, second);
    s = done(native(s, { type: "dealEncounters" }));
    expect(s.attachments.some((p) => p.id === first.id)).toBe(true);
    expect(s.attachments.some((p) => p.id === second.id)).toBe(true);
    expect(s.log.some((entry) => /1 additional hazard/.test(entry.text))).toBe(
      true,
    );
    exact(s);
  });
  it("an invalid physical-only payment cannot use Child Prodigy or spend its actual source", () => {
    let s = base();
    s.player.form = "alter";
    const [mental, physical] = hand(s, "29011", "29013");
    s = ability(s, "identity");
    const failed = dispatch(reload(s), { type: "PAY", ids: [physical.id] });
    expect(failed.error).toBeTruthy();
    expect(ironheartProgress(failed)).toBe(0);
    expect(failed.player.hand.some((p) => p.id === physical.id)).toBe(true);
    s = done(pay(s, [mental]));
    expect(ironheartProgress(s)).toBe(1);
  });
});

describe("Ironheart's simultaneous defeat of all three physical identity versions", () => {
  it("native hotseat elimination removes the exact current and reserved identities, attached encounter, and stored original card once", () => {
    let s = v3(base(true));
    const identity = s.player.ironheartIdentity!;
    const identityIds = [
      identity,
      ...s.player.setAside!.filter((p) => p.code.endsWith("a")),
    ].map((p) => p.id);
    const stored = top(s, "29009");
    s.player.deck.splice(
      s.player.deck.findIndex((p) => p.id === stored.id),
      1,
    );
    identity.storedCards = [stored];
    const attachment = attach(s, "25032", identity.id);
    s.player.hp = 1;
    s.player.tough = false;
    s.player.toughCards = 0;
    s = done(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 3,
        source: s.villain.id,
      }),
    );
    const defeated = seatView(s, "p1");
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(s.players.find((p) => p.id === "p2")?.eliminated).toBe(false);
    expect(defeated.player.ironheartIdentity).toBeUndefined();
    expect(
      defeated.player.setAside?.some((p) => identityIds.includes(p.id)),
    ).toBe(false);
    expect(s.removed.filter((p) => identityIds.includes(p.id))).toHaveLength(3);
    expect(s.removed.filter((p) => p.id === stored.id)).toHaveLength(1);
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(false);
    exact(s, [...identityIds, stored.id, attachment.id]);
    expect(s.phase).not.toBe("lost");
  });
  it("the last-seat loss clears all three actual identities and nested source IDs before the native early game-over path", () => {
    let s = v2(base());
    const identity = s.player.ironheartIdentity!;
    const identityIds = [
      identity,
      ...s.player.setAside!.filter((p) => p.code.endsWith("a")),
    ].map((p) => p.id);
    const stored = top(s, "29005");
    s.player.deck.splice(
      s.player.deck.findIndex((p) => p.id === stored.id),
      1,
    );
    identity.storedCards = [stored];
    const attachment = attach(s, "25032", `hero:${s.activePlayerId}`);
    s.player.hp = 1;
    s = done(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 3,
        source: s.villain.id,
      }),
    );
    expect(s.phase).toBe("lost");
    expect(s.player.ironheartIdentity).toBeUndefined();
    expect(s.player.setAside?.some((p) => identityIds.includes(p.id))).toBe(
      false,
    );
    expect(s.removed.filter((p) => identityIds.includes(p.id))).toHaveLength(3);
    expect(s.removed.filter((p) => p.id === stored.id)).toHaveLength(1);
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(false);
    exact(s, [...identityIds, stored.id, attachment.id]);
  });
});
