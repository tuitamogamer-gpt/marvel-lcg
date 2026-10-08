/** Native commands, original source decks, and every actual modular instance. */
import { describe, expect, it } from "vitest";
import {
  abilityOptions,
  dispatch,
  makePiece,
  newGame,
  paymentSources,
} from "../src/game/engine.js";
import { card, deckCodes, MODULES, pieceHP } from "../src/game/cards.js";
import { isTextBlank } from "../src/game/card-text.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import { choose, command, native, reload } from "./dv-test-helpers.js";

type Fixture = GameState & { zzzaxOriginalIds?: string[] };
const codes = ["29036", "29037", "29038", "29039", "29040"];

function physical(s: GameState): Piece[] {
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
function exact(s: GameState) {
  const all = physical(s);
  for (const id of (s as Fixture).zzzaxOriginalIds || [])
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
      (/remaining indirect damage/.test(s.prompt.text)
        ? s.prompt.options.find((o) => o.id === "hero")?.id
        : undefined) ||
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
function base(team = false) {
  const iron = { heroId: "ironheart", aspect: "leadership" as const };
  let s = newGame({
    ...iron,
    villainId: "rhino",
    module: "zzzax",
    seed: 29037,
    pacing: "expert",
    ...(team
      ? {
          heroes: [iron, { heroId: "spider_man", aspect: "justice" as const }],
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
    p.form = "hero";
    p.exhausted = p.flipped = false;
  }
  (s as Fixture).zzzaxOriginalIds = physical(s).map((p) => p.id);
  s.scheme.threat = 0;
  activateSeat(s, "p1");
  return s;
}
function sourcePiece(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard, p.inPlay]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing actual source ${seatId}:${code}`);
}
function hand(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = sourcePiece(s, code, seatId);
  seatView(s, seatId).player.hand.push(p);
  return p;
}
function control(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = sourcePiece(s, code, seatId);
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
  throw Error(`Missing actual encounter ${code}`);
}
function reveal(s: GameState, code: string, playerId = s.activePlayerId) {
  return native(s, {
    type: "reveal",
    piece: encounter(s, code),
    actorId: playerId,
    skip: true,
  });
}
const zzzax = (s: GameState) => s.minions.find((p) => p.code === "29037")!;
const haywire = (s: GameState) =>
  s.attachments.filter((p) => p.code === "29038");
const air = (s: GameState) => s.environments?.find((p) => p.code === "29039")!;
function actionSeat(s: GameState, playerId: string) {
  activateSeat(s, playerId);
  s.turnPlayerId = playerId;
}
function removal(s: GameState, p: Piece) {
  expect(abilityOptions(s, p).some((o) => o.id === "remove")).toBe(true);
  return command(s, { type: "ABILITY", id: p.id, action: "remove" });
}
function blankWithVivian(s: GameState, id: string) {
  const target = physical(s).find((p) => p.id === id)!;
  const vivian = hand(s, "29024"),
    one = hand(s, "29005"),
    two = hand(s, "29013");
  s = command(s, { type: "PLAY", id: vivian.id });
  expect(s.prompt?.kind).toBe("payment");
  s = command(s, { type: "PAY", ids: [one.id, two.id] });
  expect(s.prompt?.title).toMatch(/Vivian/);
  s = choose(s, "yes");
  s = choose(s, id);
  s = settle(s);
  // Losing a dynamic HP bonus can immediately defeat the targeted minion;
  // native leave-play cleanup then correctly clears its temporary blank flag.
  if (
    [...s.minions, ...s.attachments, ...s.sideSchemes].some((p) => p.id === id)
  )
    expect(isTextBlank(s, { id, code: target.code })).toBe(true);
  return s;
}
function allocations(s: GameState, ids: string[]) {
  for (const id of ids) {
    expect(s.prompt?.text).toMatch(/remaining indirect damage/);
    s = choose(reload(s), id);
  }
  return settle(s);
}

describe("Zzzax's original modular pieces through the native dispatcher", () => {
  it("registers five faces and seven exact physical module cards beside source forty", () => {
    const s = base();
    expect(MODULES.some((m) => m.id === "zzzax")).toBe(true);
    const modular = physical(s).filter((p) => card(p).set_code === "zzzax");
    expect(modular.map((p) => p.code).sort()).toEqual([
      "29036",
      "29037",
      "29038",
      "29038",
      "29039",
      "29040",
      "29040",
    ]);
    expect(new Set(modular.map((p) => p.id)).size).toBe(7);
    for (const code of codes)
      expect(hasExecutableScript(code), code).toBe(true);
    exact(s);
  });
  it("Feedback Loop counts each seat's hand and controlled printed Energy, excluding ordinary Wild", () => {
    let s = base(true);
    hand(s, "29006");
    hand(s, "29010");
    control(s, "29015");
    control(s, "29027");
    hand(s, "01088", "p2");
    hand(s, "01089", "p2");
    hand(s, "01062", "p2");
    control(s, "01006", "p2");
    s = settle(reveal(s, "29036"));
    expect(s.sideSchemes.find((p) => p.code === "29036")?.counters).toBe(7);
  });
  it("Feedback Loop's fixed base two is not multiplied by player count", () => {
    let s = settle(reveal(base(true), "29036"));
    expect(s.sideSchemes.find((p) => p.code === "29036")?.counters).toBe(2);
    exact(s);
  });
  it("Feedback Loop includes both Haywire-affected hands while preserving double-icon multiplicity", () => {
    let s = base(true);
    hand(s, "29006");
    hand(s, "29010");
    hand(s, "29005");
    control(s, "29015");
    hand(s, "01088", "p2");
    hand(s, "01089", "p2");
    hand(s, "01062", "p2");
    control(s, "01006", "p2");
    s = settle(reveal(s, "29038"));
    s = settle(reveal(s, "29038", "p2"));
    expect(
      haywire(s)
        .map((p) => p.attachedTo)
        .sort(),
    ).toEqual(["hero:p1", "hero:p2"]);
    s = settle(reveal(s, "29036"));
    expect(s.sideSchemes.find((p) => p.code === "29036")?.counters).toBe(12);
  });
  it("stacked Haywire neither doubles icons nor affects another seat's hand", () => {
    let s = base(true);
    const mental = hand(s, "29005"),
      wild = hand(s, "29010");
    const other = hand(s, "01089", "p2");
    s = settle(reveal(reveal(s, "29038"), "29038"));
    expect(haywire(s)).toHaveLength(2);
    for (const p of [mental, wild])
      expect(paymentSources(s).find((v) => v.id === p.id)?.resources).toEqual([
        "energy",
      ]);
    expect(
      paymentSources(seatView(s, "p2")).find((v) => v.id === other.id)
        ?.resources,
    ).toEqual(["mental", "mental"]);
    s = settle(reveal(s, "29036"));
    expect(s.sideSchemes.find((p) => p.code === "29036")?.counters).toBe(4);
  });
});

describe("Zzzax's dynamic engaged-seat statistics and physical boost entry", () => {
  it("gets ATK and HP from engaged controlled icons, ignoring both hands and other seats' controls", () => {
    let s = base(true);
    control(s, "29015");
    control(s, "29023");
    hand(s, "29006");
    hand(s, "01088", "p2");
    control(s, "01006", "p2");
    s = settle(reveal(s, "29037"));
    expect(zzzax(s).engagedWith).toBe("p1");
    expect(pieceHP(s, zzzax(s))).toBe(6);
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: zzzax(s).id }));
    expect(s.player.hp).toBe(hp - 4);
  });
  it("recomputes HP immediately when the engaged player loses a controlled Energy card", () => {
    let s = base();
    control(s, "29015");
    const snowguard = control(s, "29023");
    s = settle(reveal(s, "29037"));
    const id = zzzax(s).id;
    s = settle(native(s, { type: "damage", target: id, amount: 5 }));
    expect(zzzax(s).damage).toBe(5);
    expect(pieceHP(s, zzzax(s))).toBe(6);
    s = settle(native(s, { type: "discardPiece", id: snowguard.id }));
    expect(s.minions.some((p) => p.id === id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("actual Vivian blanks Zzzax's modifier and native checks defeat at printed HP", () => {
    let s = base();
    control(s, "29015");
    control(s, "29023");
    s = settle(reveal(s, "29037"));
    const id = zzzax(s).id;
    s = settle(native(s, { type: "damage", target: id, amount: 4 }));
    expect(s.minions.some((p) => p.id === id)).toBe(true);
    s = blankWithVivian(s, id);
    expect(s.minions.some((p) => p.id === id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("a surviving Vivian-blanked Zzzax attacks with printed ATK despite controlled Energy icons", () => {
    let s = base();
    control(s, "29015");
    control(s, "29023");
    s = settle(reveal(s, "29037"));
    s = blankWithVivian(s, zzzax(s).id);
    expect(pieceHP(s, zzzax(s))).toBe(4);
    const hp = s.player.hp;
    s = settle(native(reload(s), { type: "enemyAttack", id: zzzax(s).id }));
    expect(s.player.hp).toBe(hp - 2);
  });
  it.each([0, 1, 2])(
    "the actual boost threshold requires two hand Energy icons (%i available)",
    (count) => {
      let s = base();
      for (let n = 0; n < count; n++) hand(s, "29006");
      const boost = encounter(s, "29037");
      s.encounter.deck.unshift(boost);
      s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
      expect(s.minions.some((p) => p.id === boost.id)).toBe(count >= 2);
      if (count >= 2)
        expect(zzzax(s)).toMatchObject({ id: boost.id, engagedWith: "p1" });
      else
        expect(
          s.encounter.discard.filter((p) => p.id === boost.id),
        ).toHaveLength(1);
      exact(s);
    },
  );
  it("a single original double-Energy card meets the saved other-seat scheme boost threshold", () => {
    let s = base(true);
    hand(s, "01088", "p2");
    seatView(s, "p2").player.form = "alter";
    const boost = encounter(s, "29037");
    s.encounter.deck.unshift(boost);
    s = settle(
      native(reload(s), {
        type: "enemyScheme",
        id: s.villain.id,
        actorId: "p2",
      }),
    );
    expect(zzzax(s)).toMatchObject({ id: boost.id, engagedWith: "p2" });
    expect(physical(s).filter((p) => p.id === boost.id)).toHaveLength(1);
    exact(s);
  });
  it("Haywire's converted Mental and Wild hand icons meet the boost threshold without multiplying them", () => {
    let s = base();
    hand(s, "29005");
    hand(s, "29010");
    s = settle(reveal(s, "29038"));
    const boost = encounter(s, "29037");
    s.encounter.deck.unshift(boost);
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(zzzax(s)).toMatchObject({ id: boost.id, engagedWith: "p1" });
    exact(s);
  });
});

describe("Haywire's actual payment overlay and optional Hero Action costs", () => {
  it("converts every printed icon, leaves resource abilities unchanged, and restores icons when removed", () => {
    let s = base(true);
    actionSeat(s, "p2");
    const energy = hand(s, "01088"),
      genius = hand(s, "01089"),
      strength = hand(s, "01090"),
      wild = hand(s, "01062"),
      shooter = control(s, "01008"),
      aunt = control(s, "01006");
    shooter.counters = 3;
    s = settle(reveal(s, "29038"));
    for (const p of [energy, genius, strength])
      expect(paymentSources(s).find((v) => v.id === p.id)?.resources).toEqual([
        "energy",
        "energy",
      ]);
    expect(paymentSources(s).find((v) => v.id === wild.id)?.resources).toEqual([
      "energy",
    ]);
    expect(
      paymentSources(s).find((v) => v.id === shooter.id)?.resources,
    ).toEqual(["wild"]);
    const attached = haywire(s)[0];
    s = choose(removal(reload(s), attached), aunt.id);
    s = settle(s);
    expect(
      paymentSources(s).find((v) => v.id === genius.id)?.resources,
    ).toEqual(["mental", "mental"]);
    expect(paymentSources(s).find((v) => v.id === wild.id)?.resources).toEqual([
      "wild",
    ]);
    expect(
      s.encounter.discard.filter((p) => p.id === attached.id),
    ).toHaveLength(1);
  });
  it("native PLAY/PAY accepts Haywire Energy for Go All Out's printed Energy requirement", () => {
    let s = base();
    const event = hand(s, "29017"),
      mental = hand(s, "29005"),
      physical = hand(s, "29013");
    s = settle(reveal(s, "29038"));
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.requirements).toContain("energy");
    s = command(reload(s), { type: "PAY", ids: [mental.id, physical.id] });
    s = settle(
      s,
      (v) => v.prompt?.options.find((o) => o.id === v.villain.id)?.id,
    );
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === mental.id)).toBe(true);
  });
  it("Haywire does not replace Brawn's generated Mental resource while his printed controlled icon remains Physical", () => {
    let s = base();
    const brawn = control(s, "29004"),
      mental = hand(s, "29005");
    brawn.exhausted = true;
    s = settle(reveal(s, "29038"));
    expect(
      paymentSources(s).find((p) => p.id === mental.id)?.resources,
    ).toEqual(["energy"]);
    expect(paymentSources(s).find((p) => p.id === brawn.id)?.resources).toEqual(
      ["mental"],
    );
    s = settle(reveal(s, "29036"));
    expect(s.sideSchemes.find((p) => p.code === "29036")?.counters).toBe(3);
  });
  it("the optional discard cost offers controlled printed Energy, never an Energy hand card or converted Wild control", () => {
    let s = base();
    const energyHand = hand(s, "29006"),
      falcon = control(s, "29015"),
      ronnie = control(s, "29010"),
      physical = control(s, "29013");
    s = settle(reveal(s, "29038"));
    const attached = haywire(s)[0];
    s = removal(s, attached);
    expect(s.prompt?.options.some((o) => o.id === falcon.id)).toBe(true);
    for (const p of [energyHand, ronnie, physical])
      expect(s.prompt?.options.some((o) => o.id === p.id)).toBe(false);
    s = settle(choose(reload(s), falcon.id));
    expect(s.player.discard.some((p) => p.id === falcon.id)).toBe(true);
    expect(s.player.hand.some((p) => p.id === energyHand.id)).toBe(true);
    expect(s.attachments.some((p) => p.id === attached.id)).toBe(false);
  });
  it("canceling a saved cost prompt keeps the source and controlled card unchanged", () => {
    let s = base();
    const falcon = control(s, "29015");
    s = settle(reveal(s, "29038"));
    const attached = haywire(s)[0];
    s = settle(choose(reload(removal(s, attached)), "cancel"));
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(true);
    expect(s.player.inPlay.some((p) => p.id === falcon.id)).toBe(true);
    expect(s.player.hp).toBe(10);
  });
  it("a native Pinpoint replacement prevents a controlled-card discard cost from being paid", () => {
    let s = base();
    const snowguard = control(s, "29023");
    // Pinpoint is an explicit unrelated fixture card from the same imported
    // player pool, retained beside all forty untouched source instances. Her
    // native replacement exercises the asynchronous controlled-card cost.
    const pinpoint = makePiece(s, "29035");
    pinpoint.ownerId = "p1";
    s.player.inPlay.push(pinpoint);
    (s as Fixture).zzzaxOriginalIds!.push(pinpoint.id);
    s = settle(reveal(s, "29038"));
    const attached = haywire(s)[0];
    s = choose(removal(s, attached), snowguard.id);
    expect(s.prompt?.title).toBe("Pinpoint");
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(true);
    s = settle(choose(reload(s), pinpoint.id));
    expect(s.player.deck.some((p) => p.id === snowguard.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === snowguard.id)).toBe(false);
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === pinpoint.id)?.exhausted).toBe(
      true,
    );
  });
  it("the native indirect cost may be allocated to an ally across JSON reload and only then removes Haywire", () => {
    let s = base();
    const brawn = control(s, "29004");
    s = settle(reveal(s, "29038"));
    const attached = haywire(s)[0];
    s = choose(removal(s, attached), "indirect");
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(true);
    s = choose(reload(s), brawn.id);
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(0);
    s = allocations(reload(s), [brawn.id]);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(2);
    expect(s.player.hp).toBe(10);
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(false);
  });
  it("a Tough identity cannot pay the full indirect cost when no other characters or controlled Energy cards can pay", () => {
    let s = settle(reveal(base(), "29038"));
    const attached = haywire(s)[0];
    s.player.tough = true;
    expect(abilityOptions(s, attached).filter((o) => !o.disabled)).toHaveLength(
      0,
    );
    const denied = dispatch(reload(s), {
      type: "ABILITY",
      id: attached.id,
      action: "remove",
    });
    expect(denied.error).toBeTruthy();
    expect(denied.player.tough).toBe(true);
    expect(denied.player.hp).toBe(10);
    expect(haywire(denied).some((p) => p.id === attached.id)).toBe(true);
    exact(denied);
  });
  it("a known Tough identity is excluded from cost allocation while a healthy ally can pay the full two", () => {
    let s = base();
    const brawn = control(s, "29004");
    s = settle(reveal(s, "29038"));
    const attached = haywire(s)[0];
    s.player.tough = true;
    s = choose(removal(s, attached), "indirect");
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(false);
    expect(s.prompt?.options.some((o) => o.id === brawn.id)).toBe(true);
    s = choose(reload(s), brawn.id);
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(false);
    s = allocations(s, [brawn.id]);
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(2);
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(false);
  });
  it("a saved legal allocation gaining Tough before placement leaves Haywire when only one damage is actually taken", () => {
    let s = base();
    const brawn = control(s, "29004");
    s = settle(reveal(s, "29038"));
    const attached = haywire(s)[0];
    s = choose(removal(s, attached), "indirect");
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(true);
    s = choose(reload(s), "hero");
    expect(s.player.hp).toBe(10);
    s = reload(s);
    // Introduce a native status effect into the saved continuation before the
    // final legal ally assignment. This exercises prevention arising after an
    // earlier allocation, without manually fabricating the damage receipt.
    const next = s.prompt!.options.find((o) => o.id === brawn.id)!;
    next.effects.unshift({ type: "status", target: "hero", status: "tough" });
    s = allocations(reload(s), [brawn.id]);
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(1);
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(true);
  });
  it("actual Vivian blanks one physical Haywire and restores that seat's printed resource icons", () => {
    let s = base();
    const mental = hand(s, "29011"),
      wild = hand(s, "29010");
    s = settle(reveal(s, "29038"));
    const attached = haywire(s)[0];
    expect(
      paymentSources(s).find((p) => p.id === mental.id)?.resources,
    ).toEqual(["energy"]);
    s = blankWithVivian(s, attached.id);
    expect(
      paymentSources(s).find((p) => p.id === mental.id)?.resources,
    ).toEqual(["mental"]);
    expect(paymentSources(s).find((p) => p.id === wild.id)?.resources).toEqual([
      "wild",
    ]);
    expect(abilityOptions(s, attached)).toHaveLength(0);
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(true);
  });
  it("any active Hero pays their own controlled cost to remove another identity's Haywire", () => {
    let s = base(true);
    const falcon = control(s, "29015"),
      aunt = control(s, "01006", "p2");
    s = settle(reveal(s, "29038", "p1"));
    const attached = haywire(s)[0];
    actionSeat(s, "p2");
    s = removal(s, attached);
    expect(s.prompt?.options.some((o) => o.id === aunt.id)).toBe(true);
    expect(s.prompt?.options.some((o) => o.id === falcon.id)).toBe(false);
    s = settle(choose(reload(s), aunt.id));
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === falcon.id),
    ).toBe(true);
    expect(seatView(s, "p2").player.discard.some((p) => p.id === aunt.id)).toBe(
      true,
    );
    expect(haywire(s).some((p) => p.id === attached.id)).toBe(false);
  });
  it("an alter-ego cannot initiate the Hero Action", () => {
    let s = settle(reveal(base(), "29038"));
    const attached = haywire(s)[0];
    s.player.form = "alter";
    expect(abilityOptions(s, attached).filter((o) => !o.disabled)).toHaveLength(
      0,
    );
    const denied = dispatch(reload(s), {
      type: "ABILITY",
      id: attached.id,
      action: "remove",
    });
    expect(denied.error).toBeTruthy();
    expect(haywire(denied).some((p) => p.id === attached.id)).toBe(true);
    exact(denied);
  });
});

describe("Air Static's phase-begin interruption and removal", () => {
  it("deals each qualifying seat two indirect before any main-scheme escalation", () => {
    let s = base(true);
    hand(s, "29006");
    control(s, "01006", "p2");
    s = settle(reveal(s, "29039"));
    const hp1 = seatView(s, "p1").player.hp,
      hp2 = seatView(s, "p2").player.hp;
    s = native(s, { type: "beginVillain" });
    expect(s.scheme.threat).toBe(0);
    expect(s.activePlayerId).toBe("p1");
    s = choose(reload(s), "hero");
    expect(s.scheme.threat).toBe(0);
    s = choose(reload(s), "hero");
    expect(seatView(s, "p1").player.hp).toBe(hp1 - 2);
    expect(seatView(s, "p2").player.hp).toBe(hp2);
    expect(s.activePlayerId).toBe("p2");
    expect(s.scheme.threat).toBe(0);
    s = choose(reload(s), "hero");
    expect(s.scheme.threat).toBe(0);
    s = choose(reload(s), "hero");
    expect(seatView(s, "p2").player.hp).toBe(hp2 - 2);
    expect(s.scheme.threat).toBe(2);
    exact(s);
  });
  it("ordinary Wild does not qualify; an actual Haywire replacement makes that same hand qualify", () => {
    let s = base(true);
    hand(s, "29010");
    hand(s, "01062", "p2");
    s = settle(reveal(s, "29039"));
    const unaffected = native(reload(s), { type: "beginVillain" });
    expect(seatView(unaffected, "p1").player.hp).toBe(10);
    expect(seatView(unaffected, "p2").player.hp).toBe(10);
    expect(unaffected.scheme.threat).toBe(2);
    s = settle(reveal(s, "29038"));
    s = native(s, { type: "beginVillain" });
    expect(s.prompt?.text).toMatch(/remaining indirect damage/);
    expect(s.activePlayerId).toBe("p1");
    s = choose(choose(reload(s), "hero"), "hero");
    expect(seatView(s, "p1").player.hp).toBe(8);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.scheme.threat).toBe(2);
    exact(s);
  });
  it.each(["discard", "indirect"])(
    "Air Static's optional %s cost removes the same environment once",
    (kind) => {
      let s = base();
      const falcon = control(s, "29015");
      s = settle(reveal(s, "29039"));
      const source = air(s);
      s = removal(s, source);
      s =
        kind === "discard"
          ? settle(choose(reload(s), falcon.id))
          : allocations(choose(reload(s), "indirect"), ["hero", "hero"]);
      expect(s.environments?.some((p) => p.id === source.id)).toBe(false);
      expect(
        s.encounter.discard.filter((p) => p.id === source.id),
      ).toHaveLength(1);
      expect(s.player.hp).toBe(kind === "discard" ? 10 : 8);
    },
  );
  it("a lethal but fully paid two-damage Air Static cost still discards the environment without charging the survivor", () => {
    let s = base(true);
    s.player.hp = 2;
    s = settle(reveal(s, "29039"));
    const source = air(s);
    s = choose(removal(s, source), "indirect");
    s = allocations(s, ["hero", "hero"]);
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.phase).toBe("player");
    expect(s.environments?.some((p) => p.id === source.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === source.id)).toHaveLength(
      1,
    );
    exact(s);
  });
  it("the original eliminated recipient cannot redirect pending Air Static damage onto the survivor", () => {
    let s = base(true);
    hand(s, "29006");
    hand(s, "01088", "p2");
    s.player.hp = 1;
    s = settle(reveal(s, "29039"));
    s = native(s, { type: "beginVillain" });
    // Allocation cannot overassign a one-HP identity: the unassignable point is
    // lost for this recipient, rather than reassigned to the next player.
    s = choose(reload(s), "hero");
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.activePlayerId).toBe("p2");
    s = choose(choose(reload(s), "hero"), "hero");
    expect(seatView(s, "p2").player.hp).toBe(8);
    exact(s);
  });
});

describe("Zzzap's saved indirect receipt and conditional Surge", () => {
  it.each([0, 1, 2, 3])(
    "identity allocation of %i Energy causes Surge only for zero or one damage dealt",
    (count) => {
      let s = base();
      for (let n = 0; n < count; n++) hand(s, "29006");
      const before = s.encounter.dealt.length;
      s = reveal(s, "29040");
      s = allocations(s, Array(count).fill("hero"));
      expect(s.player.hp).toBe(10 - count);
      expect(s.encounter.dealt).toHaveLength(before + (count <= 1 ? 1 : 0));
    },
  );
  it("two damage allocated to an ally still cause Surge because the identity was dealt zero", () => {
    let s = base();
    hand(s, "29006");
    hand(s, "29006");
    const brawn = control(s, "29004");
    s = allocations(reveal(s, "29040"), [brawn.id, brawn.id]);
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.find((p) => p.id === brawn.id)?.damage).toBe(2);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("splitting three indirect as one identity and two ally damage still causes one Surge", () => {
    let s = base();
    for (let n = 0; n < 3; n++) hand(s, "29006");
    const brawn = control(s, "29004");
    s = allocations(reveal(s, "29040"), ["hero", brawn.id, brawn.id]);
    expect(s.player.hp).toBe(9);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Tough prevents taken damage without changing two damage dealt or gaining Surge", () => {
    let s = base();
    hand(s, "29006");
    hand(s, "29006");
    s.player.tough = true;
    s = allocations(reveal(s, "29040"), ["hero", "hero"]);
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(s.encounter.dealt).toHaveLength(0);
  });
  it("an actual Go for Champions prohibition prevents damage dealt and therefore gains Surge", () => {
    let s = base();
    const event = hand(s, "29025"),
      energy = hand(s, "29006"),
      mental = hand(s, "29007"),
      physical = hand(s, "29013");
    s = command(s, { type: "PLAY", id: event.id });
    s = command(s, { type: "PAY", ids: [energy.id, mental.id, physical.id] });
    s = settle(s);
    hand(s, "29006");
    hand(s, "29006");
    s = allocations(reveal(s, "29040"), ["hero", "hero"]);
    expect(s.player.hp).toBe(10);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("actual Enhanced Spider-Sense cancels Zzzap before any allocation or conditional Surge", () => {
    let s = base(true);
    actionSeat(s, "p2");
    const cancel = hand(s, "01004"),
      resource = hand(s, "01089");
    hand(s, "01088");
    const piece = encounter(s, "29040");
    const deckIds = s.encounter.deck.map((p) => p.id);
    s = native(s, { type: "reveal", piece, actorId: "p2" });
    s = choose(reload(s), "01004");
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = settle(s);
    expect(s.player.hp).toBe(10);
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deckIds);
    expect(s.encounter.discard.filter((p) => p.id === piece.id)).toHaveLength(
      1,
    );
    expect(s.player.discard.some((p) => p.id === cancel.id)).toBe(true);
  });
  it("Haywire counts each converted printed resource once for the actual indirect amount", () => {
    let s = base(true);
    actionSeat(s, "p2");
    hand(s, "01089");
    hand(s, "01062");
    s = settle(reveal(s, "29038"));
    s = allocations(reveal(reload(s), "29040"), ["hero", "hero", "hero"]);
    expect(s.player.hp).toBe(7);
    expect(s.encounter.dealt).toHaveLength(0);
  });
  it("a lethal first-player allocation cannot attach the Surge to or damage the surviving player", () => {
    let s = base(true);
    hand(s, "29006");
    s.player.hp = 1;
    s = allocations(reveal(s, "29040", "p1"), ["hero"]);
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(s.encounter.dealt.filter((p) => p.dealtTo === "p2")).toHaveLength(0);
    exact(s);
  });
});
