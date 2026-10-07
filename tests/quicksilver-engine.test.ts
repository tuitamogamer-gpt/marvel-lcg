/** Quicksilver acceptance: native commands, physical printings and saved decisions. */
import { describe, expect, it } from "vitest";
import { card, handSize, heroCard, heroStats } from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import {
  dispatch,
  makePiece,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

function command(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let guard = 0; s.review && guard < 100; guard++)
    s = dispatch(s, { type: "PROCEED" });
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  expect(s.review).toBeNull();
  return s;
}
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt!.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(reload(s), { type: "CHOOSE", id });
}
function skip(s: GameState) {
  const option = s.prompt?.options.find(
    (o) =>
      /^(skip|pass|none|done|continue|no)$/.test(o.id) ||
      /^(skip|pass|continue without|do not|no response|decline)/i.test(o.label),
  );
  expect(option, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(s, option!.id);
}
function skipAll(s: GameState) {
  for (let guard = 0; s.prompt && guard < 40; guard++) s = skip(s);
  expect(s.prompt).toBeNull();
  return s;
}
function respond(s: GameState, name: RegExp, code?: string) {
  for (let guard = 0; guard < 15; guard++) {
    const option =
      s.prompt?.options.find(
        (o) => name.test(o.label) || (code && o.image === code),
      ) ||
      (name.test(s.prompt?.title || "")
        ? s.prompt?.options.find((o) => o.id === "yes")
        : undefined);
    if (option) return choose(s, option.id);
    s = skip(s);
  }
  throw Error(`Missing response ${name}: ${JSON.stringify(s.prompt)}`);
}
function base(team = false, heroSecond = false) {
  let s = newGame({
    heroId: "qsv",
    aspect: "protection",
    villainId: "rhino",
    seed: 14001,
    pacing: "expert",
    ...(team
      ? {
          heroes: heroSecond
            ? [
                { heroId: "spider_man", aspect: "justice" as const },
                { heroId: "qsv", aspect: "protection" as const },
              ]
            : [
                { heroId: "qsv", aspect: "protection" as const },
                { heroId: "spider_man", aspect: "justice" as const },
              ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (team) s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.flipped = false;
    v.player.exhausted = false;
    v.player.hand = [];
    v.player.inPlay = [];
    v.player.discard = [];
    v.player.deck = Array.from({ length: 15 }, () => makePiece(s, "14019"));
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.scheme.threat = 3;
  s.villain.hp = s.villain.maxHp = 50;
  return s;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function put(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code = "14026", playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function side(s: GameState, code = "01107", amount = 3) {
  const p = makePiece(s, code);
  p.counters = amount;
  s.sideSchemes.push(p);
  return p;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function reveal(s: GameState, code: string, skip = true) {
  return native(s, { type: "reveal", piece: makePiece(s, code), skip });
}
function paid(
  s: GameState,
  p: Piece,
  ids: string[],
  wildAs?: "energy" | "physical" | "mental",
) {
  s = command(s, { type: "PLAY", id: p.id });
  if (s.prompt?.kind === "payment")
    s = command(reload(s), { type: "PAY", ids, ...(wildAs ? { wildAs } : {}) });
  return s;
}
function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
function physical(s: GameState) {
  return [
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.discard,
    ...s.player.inPlay,
    ...s.resolving,
  ];
}
function basic(
  s: GameState,
  action: "attack" | "thwart",
  id = action === "attack" ? s.villain.id : "main",
) {
  return target(command(s, { type: "BASIC", action }), id);
}

describe("Quicksilver's source pack through native commands", () => {
  it("launches the original 40-card Protection deck and preserves each physical printing", () => {
    const source = STARTER_DECKS.find((d) => d.id === "starter-14001a")!;
    const codes = heroStarterCodes("qsv");
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("14"))).toBe(true);
    expect(deckErrors("qsv", "protection", codes)).toEqual([]);
    const s = newGame({
      heroId: "qsv",
      aspect: "protection",
      villainId: "rhino",
      seed: 14001,
      heroes: [{ heroId: "qsv", aspect: "protection", deckCards: codes }],
    });
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.hp).toBe(9);
    expect(heroCard(s).code).toBe("14001b");
    expect(handSize(s)).toBe(6);
    expect(s.encounter.deck.some((p) => p.code === "14024")).toBe(true);
  });

  it("uses printed identity stats and native form changes", () => {
    let s = base();
    expect(heroCard(s).code).toBe("14001a");
    expect(heroStats(s)).toMatchObject({
      attack: 1,
      thwart: 1,
      defense: 1,
      recover: 3,
    });
    expect(handSize(s)).toBe(5);
    s = command(s, { type: "FLIP" });
    expect(heroCard(s).code).toBe("14001b");
    expect(s.player.flipped).toBe(true);
    expect(handSize(s)).toBe(6);
  });

  it.each(["attack", "thwart"] as const)(
    "Super Speed can ready after a basic %s, then is unavailable for the phase",
    (action) => {
      let s = base();
      s = basic(s, action);
      expect(s.player.exhausted).toBe(true);
      s = respond(reload(s), /Super Speed/i, "14001a");
      s = skipAll(s);
      expect(s.player.exhausted).toBe(false);
      s = basic(s, action);
      expect(s.prompt?.options.some((o) => o.image === "14001a")).not.toBe(
        true,
      );
      s = skipAll(s);
      expect(s.player.exhausted).toBe(true);
    },
  );

  it("declining Super Speed leaves the once-per-phase use available after another genuine ready", () => {
    let s = skipAll(basic(base(), "attack"));
    expect(s.player.exhausted).toBe(true);
    s = skipAll(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(false);
    s = respond(basic(s, "thwart"), /Super Speed/i, "14001a");
    s = skipAll(s);
    expect(s.player.exhausted).toBe(false);
  });

  it.each(["attack", "thwart"] as const)(
    "status replacement of basic %s does not trigger Super Speed",
    (action) => {
      let s = base();
      if (action === "attack") {
        s.player.stunned = true;
        s.player.stunCards = 1;
      } else {
        s.player.confused = true;
        s.player.confuseCards = 1;
      }
      s = command(s, { type: "BASIC", action });
      expect(s.prompt?.options.some((o) => o.image === "14001a")).not.toBe(
        true,
      );
      expect(s.player.exhausted).toBe(true);
      expect(s.villain.hp).toBe(50);
      expect(s.scheme.threat).toBe(3);
    },
  );

  it("basic defense grants Super Speed only after attack resolution and refreshes at the phase boundary", () => {
    let s = base();
    s = skipAll(respond(basic(s, "attack"), /Super Speed/i, "14001a"));
    s.phase = "villain";
    const enemy = minion(s);
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = choose(s, "hero");
    expect(s.player.hp).toBe(8);
    expect(s.player.exhausted).toBe(true);
    expect(s.attack).toBeFalsy();
    s = skipAll(respond(reload(s), /Super Speed/i, "14001a"));
    expect(s.player.exhausted).toBe(false);
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = skipAll(choose(s, "hero"));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hp).toBe(7);
  });

  it("a defending Quicksilver in the second seat owns his response and phase limit", () => {
    let s = base(true, true);
    s.phase = "villain";
    const enemy = minion(s, "14026", "p1");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = choose(s, "hero:p2");
    expect(s.activePlayerId).toBe("p2");
    expect(seatView(s, "p1").player.hp).toBe(10);
    s = skipAll(respond(reload(s), /Super Speed/i, "14001a"));
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.hp).toBe(8);
    expect(seatView(s, "p1").player.exhausted).toBe(false);
  });

  it("Friction Resistance spends a physical resource only on commit and readies after genuine identity ready", () => {
    let s = base();
    s.player.exhausted = true;
    const friction = put(s, "14009"),
      h = hand(s, "14003");
    expect(
      paymentSources(s, h[0].id, h[0].code).find((p) => p.id === friction.id)
        ?.resources,
    ).toEqual(["physical"]);
    s = command(s, { type: "PLAY", id: h[0].id });
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      false,
    );
    s = paid(s, h[0], [friction.id]);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      true,
    );
    s = skipAll(respond(reload(s), /Friction Resistance/i, "14009"));
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("a ready effect that changes nothing does not ready an exhausted Friction Resistance", () => {
    let s = base();
    const friction = put(s, "14009");
    friction.exhausted = true;
    s = skipAll(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      true,
    );
  });

  it("Friction Resistance follows Super Speed and independently refreshes after later event ready", () => {
    let s = base();
    const friction = put(s, "14009");
    friction.exhausted = true;
    s = respond(basic(s, "attack"), /Super Speed/i, "14001a");
    s = skipAll(respond(reload(s), /Friction Resistance/i, "14009"));
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      false,
    );
    s = skipAll(basic(s, "attack"));
    const h = hand(s, "14003");
    s = paid(s, h[0], [friction.id]);
    s = skipAll(respond(reload(s), /Friction Resistance/i, "14009"));
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      false,
    );
  });

  it("Superpowered Siblings selects exactly two physical hand cards and can cancel before its cost", () => {
    let s = base();
    s.player.form = "alter";
    const h = hand(s, "14003", "14004", "14019"),
      top = s.player.deck.slice(0, 2);
    s = command(s, { type: "ABILITY", id: "identity", action: "siblings" });
    expect(s.prompt).toMatchObject({ kind: "select", min: 2, max: 2 });
    expect(
      dispatch(reload(s), { type: "SELECT", ids: [h[0].id] }).error,
    ).toBeTruthy();
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    s = command(s, { type: "ABILITY", id: "identity", action: "siblings" });
    s = command(reload(s), {
      type: "SELECT",
      ids: h.slice(0, 2).map((p) => p.id),
    });
    expect(s.player.hand.map((p) => p.id)).toEqual([
      h[2].id,
      ...top.map((p) => p.id),
    ]);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      h.slice(0, 2).map((p) => p.id),
    );
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "siblings",
      }).error,
    ).toBeTruthy();
  });

  it("Superpowered Siblings draws three for the actual Wanda ally in either player's area", () => {
    let s = base(true);
    s.player.form = "alter";
    put(s, "14002", "p2");
    const h = hand(s, "14003", "14004"),
      top = s.player.deck.slice(0, 3);
    s = command(s, { type: "ABILITY", id: "hero", action: "siblings" });
    s = command(reload(s), { type: "SELECT", ids: h.map((p) => p.id) });
    expect(s.player.hand.map((p) => p.id)).toEqual(top.map((p) => p.id));
  });

  it("signature stat upgrades affect the native basic powers and preserve their non-Tech text under Tech Theft", () => {
    let s = base();
    put(s, "14008");
    put(s, "14010");
    put(s, "14011");
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 2 });
    s = skipAll(basic(s, "attack"));
    expect(s.villain.hp).toBe(48);
    side(s, "12026");
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 2 });
  });

  it("Maximum Velocity remains through the villain phase, blocks a second phase copy and expires next round", () => {
    let s = base();
    const h = hand(s, "14005", "14005", "14019", "14020");
    s = paid(s, h[0], [h[2].id]);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 3 });
    expect(playable(s, h[1])).toBeTruthy();
    expect(
      dispatch(reload(s), { type: "PLAY", id: h[1].id }).error,
    ).toBeTruthy();
    s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01101"));
    s = command(s, { type: "END_TURN", discard: [] });
    expect(s.phase).toBe("villain");
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 3 });
    for (let guard = 0; s.phase === "villain" && guard < 30; guard++) {
      if (s.prompt?.options.some((o) => o.id === "take")) s = choose(s, "take");
      else if (s.prompt) s = skip(s);
      else throw Error("Villain phase stalled");
    }
    expect(s.phase).toBe("player");
    expect(heroStats(s)).toMatchObject({ attack: 1, thwart: 1, defense: 1 });
    expect(
      playable(
        s,
        s.player.hand.find((p) => p.id === h[1].id)!,
      ),
    ).toBeNull();
  });

  it("Double Time repeats non-attack damage without clearing Stunned or triggering Super Speed", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    const h = hand(s, "14004", "14019");
    s = paid(s, h[0], [h[1].id]);
    for (let i = 0; i < 2; i++)
      s = target(choose(reload(s), "damage"), s.villain.id);
    s = skipAll(s);
    expect(s.villain.hp).toBe(46);
    expect(s.player.stunned).toBe(true);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Double Time resolves sequentially so defeating Crisis unlocks the second main-scheme target", () => {
    let s = base();
    s.player.confused = true;
    s.player.confuseCards = 1;
    const crisis = side(s, "01108", 2),
      h = hand(s, "14004", "14019");
    s = choose(paid(s, h[0], [h[1].id]), "thwart");
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
    s = target(s, crisis.id);
    expect(s.sideSchemes).toEqual([]);
    s = target(choose(reload(s), "thwart"), "main");
    s = skipAll(s);
    expect(s.scheme.threat).toBe(1);
    expect(s.player.confused).toBe(true);
  });

  it("Double Time keeps its first physical target/result when reloaded before the second choice", () => {
    let s = base();
    const enemy = minion(s);
    enemy.damage = 2;
    const h = hand(s, "14004", "14019");
    s = target(choose(paid(s, h[0], [h[1].id]), "damage"), enemy.id);
    expect(s.minions).toEqual([]);
    s = target(choose(reload(s), "damage"), s.villain.id);
    expect(s.villain.hp).toBe(48);
    expect(s.encounter.discard.filter((p) => p.id === enemy.id)).toHaveLength(
      1,
    );
  });

  it("Speed Cyclone binds X to actual paid resources and never repeats a chosen enemy", () => {
    let s = base();
    const enemy = minion(s),
      h = hand(s, "14006", "14019");
    s = choose(command(s, { type: "PLAY", id: h[0].id }), "2");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    expect(s.prompt).toMatchObject({ kind: "select", min: 2, max: 2 });
    expect(
      dispatch(reload(s), { type: "SELECT", ids: [enemy.id, enemy.id] }).error,
    ).toBeTruthy();
    s = command(reload(s), { type: "SELECT", ids: [enemy.id, s.villain.id] });
    s = skipAll(s);
    expect(s.villain.stunned).toBe(true);
    expect(s.minions.find((p) => p.id === enemy.id)?.stunned).toBe(true);
    expect(s.player.exhausted).toBe(false);
  });

  it("Speed Cyclone overpayment cannot increase an already chosen X and canceled payment preserves its physical hand", () => {
    let s = base();
    const enemy = minion(s),
      h = hand(s, "14006", "14019");
    s = choose(command(s, { type: "PLAY", id: h[0].id }), "1");
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    s = choose(command(s, { type: "PLAY", id: h[0].id }), "1");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    expect(s.prompt).toMatchObject({ kind: "select", min: 1, max: 1 });
    s = command(reload(s), { type: "SELECT", ids: [enemy.id] });
    expect(s.minions.find((p) => p.id === enemy.id)?.stunned).toBe(true);
    expect(s.villain.stunned).toBe(false);
  });

  it("Serval Industries requires exactly two Quicksilver cards and preserves physical IDs through reload", () => {
    let s = base();
    s.player.form = "alter";
    const serval = put(s, "14007"),
      eligible = [makePiece(s, "14003"), makePiece(s, "14011")],
      wrong = makePiece(s, "14022");
    s.player.discard = [...eligible, wrong];
    s = command(s, { type: "ABILITY", id: serval.id, action: "serval" });
    expect(s.prompt).toMatchObject({ kind: "select", min: 2, max: 2 });
    expect(s.prompt?.options.some((o) => o.id === wrong.id)).toBe(false);
    expect(
      dispatch(reload(s), { type: "SELECT", ids: [eligible[0].id] }).error,
    ).toBeTruthy();
    s = command(reload(s), { type: "SELECT", ids: eligible.map((p) => p.id) });
    expect(s.player.inPlay.find((p) => p.id === serval.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.discard.map((p) => p.id)).toEqual([wrong.id]);
    expect(
      s.player.deck.filter((p) => eligible.some((e) => e.id === p.id)),
    ).toHaveLength(2);
  });

  it("Serval cannot activate while in hero form or with no eligible discard, and does as much as possible with one", () => {
    let s = base();
    const serval = put(s, "14007"),
      eligible = makePiece(s, "14003");
    s.player.discard = [eligible, makePiece(s, "14019")];
    expect(
      dispatch(reload(s), { type: "ABILITY", id: serval.id }).error,
    ).toBeTruthy();
    s.player.form = "alter";
    s.player.discard = [s.player.discard[1]];
    expect(
      dispatch(reload(s), { type: "ABILITY", id: serval.id }).error,
    ).toBeTruthy();
    expect(s.player.inPlay.find((p) => p.id === serval.id)?.exhausted).toBe(
      false,
    );
    s.player.discard.unshift(eligible);
    s = command(s, { type: "ABILITY", id: serval.id });
    expect(s.prompt).toMatchObject({ kind: "select", min: 1, max: 1 });
    s = command(reload(s), { type: "SELECT", ids: [eligible.id] });
    expect(s.player.deck.filter((p) => p.id === eligible.id)).toHaveLength(1);
    expect(s.player.discard.some((p) => p.id === eligible.id)).toBe(false);
  });

  it.each(["attack", "thwart"] as const)(
    "Scarlet Witch's saved %s interrupt consumes the actual boost card and adds its printed icons",
    (action) => {
      let s = base();
      const witch = put(s, "14002"),
        boost = makePiece(s, "14025");
      s.encounter.deck.unshift(boost);
      s.scheme.threat = 8;
      s = command(s, { type: "ABILITY", id: witch.id, action });
      s = respond(reload(s), /Scarlet Witch/i, "14002");
      s = target(s, action === "attack" ? s.villain.id : "main");
      s = skipAll(s);
      expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
        1,
      );
      expect(s.encounter.deck.some((p) => p.id === boost.id)).toBe(false);
      expect(s.player.inPlay.find((p) => p.id === witch.id)?.damage).toBe(1);
      expect(action === "attack" ? s.villain.hp : s.scheme.threat).toBe(
        action === "attack" ? 46 : 4,
      );
    },
  );

  it("Scarlet Witch handles discarding the final encounter card with native exhaustion acceleration", () => {
    let s = base();
    const witch = put(s, "14002"),
      boost = makePiece(s, "14025");
    s.encounter.deck = [boost];
    s.encounter.discard = [makePiece(s, "01101")];
    s = command(s, { type: "ABILITY", id: witch.id, action: "attack" });
    s = respond(reload(s), /Scarlet Witch/i, "14002");
    s = skipAll(target(s, s.villain.id));
    expect(s.villain.hp).toBe(46);
    expect(s.encounter.acceleration).toBe(1);
    expect(
      [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) => p.id === boost.id,
      ),
    ).toHaveLength(1);
  });

  it("Scarlet Witch discards boost stars without resolving their abilities or adding them as boost icons", () => {
    let s = base();
    const witch = put(s, "14002"),
      boost = makePiece(s, "14028");
    s.encounter.deck.unshift(boost);
    s = command(s, { type: "ABILITY", id: witch.id, action: "attack" });
    s = respond(s, /Scarlet Witch/i, "14002");
    s = skipAll(target(s, s.villain.id));
    expect(s.player.exhausted).toBe(false);
    expect(s.villain.hp).toBe(49 - (card(boost).boost || 0));
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
  });
});

describe("Quicksilver pack allies and shared aspect effects", () => {
  it("Multiple Man searches the physical hand without revealing or shuffling the deck, then recursively enters another copy", () => {
    let s = base();
    const h = hand(s, "14012", "14012", "14012", "14019", "14020"),
      deckIds = s.player.deck.map((p) => p.id),
      seed = s.seed;
    s = paid(
      s,
      h[0],
      h.slice(3).map((p) => p.id),
    );
    s = respond(s, /Multiple Man/i, "14012");
    s = choose(s, "hand");
    s = choose(reload(s), h[1].id);
    s = respond(reload(s), /Multiple Man/i, "14012");
    s = choose(s, "hand");
    s = choose(reload(s), h[2].id);
    s = skipAll(s);
    expect(
      s.player.inPlay
        .filter((p) => p.code === "14012")
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      h
        .slice(0, 3)
        .map((p) => p.id)
        .sort(),
    );
    expect(s.player.deck.map((p) => p.id)).toEqual(deckIds);
    expect(s.seed).toBe(seed);
  });

  it("Multiple Man searches the actual deck, shuffles it and handles ally-limit decisions on recursive entry", () => {
    let s = base();
    const old = [put(s, "01041"), put(s, "14013"), put(s, "01083")],
      h = hand(s, "14012", "14019", "14020"),
      copy = makePiece(s, "14012");
    s.player.deck.unshift(copy);
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    if (s.prompt?.title.includes("Ally limit")) s = choose(s, old[0].id);
    s = respond(s, /Multiple Man/i, "14012");
    s = choose(s, "deck");
    s = choose(reload(s), copy.id);
    for (let guard = 0; s.prompt && guard < 10; guard++) {
      if (s.prompt.title.includes("Ally limit"))
        s = choose(
          s,
          old.find((p) => s.prompt!.options.some((o) => o.id === p.id))!.id,
        );
      else s = skip(s);
    }
    expect(
      s.player.inPlay.filter((p) => card(p).type_code === "ally"),
    ).toHaveLength(3);
    expect(s.player.inPlay.some((p) => p.id === copy.id)).toBe(true);
    expect(s.player.deck.some((p) => p.id === copy.id)).toBe(false);
    expect(
      s.player.discard.filter((p) => old.some((o) => o.id === p.id)),
    ).toHaveLength(2);
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(physical(s).length);
  });

  it("declining Multiple Man preserves both copies and the untouched hidden deck", () => {
    let s = base();
    const h = hand(s, "14012", "14012", "14019", "14020"),
      ids = s.player.deck.map((p) => p.id),
      seed = s.seed;
    s = skipAll(
      paid(
        s,
        h[0],
        h.slice(2).map((p) => p.id),
      ),
    );
    expect(s.player.hand.map((p) => p.id)).toEqual([h[1].id]);
    expect(s.player.deck.map((p) => p.id)).toEqual(ids);
    expect(s.seed).toBe(seed);
  });

  it("Warlock requires an actual mental resource, heals without exhausting and respects missing damage", () => {
    let s = base();
    const warlock = put(s, "14013");
    warlock.damage = 2;
    const h = hand(s, "14021", "14020");
    s = command(s, { type: "ABILITY", id: warlock.id, action: "heal" });
    expect(s.prompt).toMatchObject({
      kind: "payment",
      requirements: ["mental"],
    });
    expect(
      dispatch(reload(s), { type: "PAY", ids: [h[0].id] }).error,
    ).toBeTruthy();
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    expect(s.player.inPlay.find((p) => p.id === warlock.id)).toMatchObject({
      damage: 0,
      exhausted: false,
    });
    expect(s.player.hand.map((p) => p.id)).toEqual([h[0].id]);
    expect(
      dispatch(reload(s), { type: "ABILITY", id: warlock.id, action: "heal" })
        .error,
    ).toBeTruthy();
  });

  it("Never Back Down completes a defense, stuns on zero damage and still opens the later Super Speed response", () => {
    let s = base();
    const enemy = minion(s),
      h = hand(s, "14014", "14019");
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "hero");
    s = respond(s, /Never Back Down/i, "14014");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    expect(s.player.hp).toBe(9);
    expect(s.minions.find((p) => p.id === enemy.id)?.stunned).toBe(true);
    s = skipAll(respond(s, /Super Speed/i, "14001a"));
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Never Back Down does not stun when boosted damage penetrates its defense", () => {
    let s = base();
    const h = hand(s, "14014", "14019"),
      boost = makePiece(s, "14025");
    s.encounter.deck.unshift(boost);
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "hero");
    s = respond(s, /Never Back Down/i, "14014");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.player.hp).toBe(7);
    expect(s.villain.stunned).toBe(false);
  });

  it.each(["14019", "14021"])(
    "Side Step prevents attack damage and only energy payment %s damages the attacker",
    (resource) => {
      let s = base();
      const enemy = minion(s),
        h = hand(s, "14015", resource);
      s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "take");
      s = respond(s, /Side Step/i, "14015");
      s = command(reload(s), { type: "PAY", ids: [h[1].id] });
      s = skipAll(s);
      expect(s.player.hp).toBe(9);
      expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(
        resource === "14019" ? 1 : 0,
      );
      expect(s.player.exhausted).toBe(false);
    },
  );

  it("Side Step protects direct damage without assigning a nonexistent enemy target", () => {
    let s = base();
    const h = hand(s, "14015", "14019");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 5,
      source: "Fixture",
    });
    s = respond(s, /Side Step/i, "14015");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.player.hp).toBe(7);
    expect(s.villain.hp).toBe(50);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Side Step can prevent overkill from a sacrificed ally while preserving the real attacker", () => {
    let s = base();
    const ally = put(s, "14012"),
      charge = makePiece(s, "01099"),
      h = hand(s, "14015", "14019");
    // Rhino's Charge grants +3 ATK and overkill; a blank boost leaves five damage.
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    s.encounter.deck.unshift(makePiece(s, "01104"));
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), ally.id);
    s = respond(s, /Side Step/i, "14015");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    expect(s.villain.hp).toBe(49);
  });

  it("Nerves of Steel and Sense of Justice filter actual payment subjects by printed Defense and Thwart traits", () => {
    const s = base(),
      nerves = put(s, "14017"),
      sense = put(s, "14030");
    expect(
      paymentSources(s, undefined, "14014").some((p) => p.id === nerves.id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "14015").some((p) => p.id === nerves.id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "14004").some(
        (p) => p.id === nerves.id || p.id === sense.id,
      ),
    ).toBe(false);
    expect(
      paymentSources(s, undefined, "01060").some((p) => p.id === sense.id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "14003").some(
        (p) => p.id === nerves.id || p.id === sense.id,
      ),
    ).toBe(false);
  });

  it("Nerves of Steel spends its energy on Side Step and binds the used physical upgrade across saves", () => {
    let s = base();
    const nerves = put(s, "14017"),
      enemy = minion(s),
      h = hand(s, "14015");
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "take");
    s = respond(s, /Side Step/i, "14015");
    expect(
      paymentSources(s, h[0].id, h[0].code).find((p) => p.id === nerves.id)
        ?.resources,
    ).toEqual(["energy"]);
    s = command(reload(s), { type: "PAY", ids: [nerves.id] });
    s = skipAll(s);
    expect(s.player.hp).toBe(9);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(s.player.inPlay.find((p) => p.id === nerves.id)?.exhausted).toBe(
      true,
    );
  });

  it("Sense of Justice pays a real Thwart event with mental and the native event retains its matching resource bonus", () => {
    let s = base();
    s.scheme.threat = 6;
    const sense = put(s, "14030"),
      h = hand(s, "01060", "14003");
    s = paid(s, h[0], [sense.id, h[1].id]);
    s = skipAll(target(s, "main"));
    expect(s.scheme.threat).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === sense.id)?.exhausted).toBe(
      true,
    );
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Side Step preserves a direct packet's actual enemy source and declared wild energy across JSON payment", () => {
    let s = base();
    const enemy = minion(s),
      h = hand(s, "14015", "14002");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: enemy.id,
    });
    s = respond(s, /Side Step/i, "14015");
    s = command(reload(s), { type: "PAY", ids: [h[1].id], wildAs: "energy" });
    s = skipAll(s);
    expect(s.player.hp).toBe(8);
    expect(s.minions.find((p) => p.id === enemy.id)?.damage).toBe(1);
    expect(s.villain.hp).toBe(50);
  });

  it("restricted upgrades can be controlled by another player and discarded back to their original owner", () => {
    let s = base(true);
    const h = hand(s, "14017", "14019");
    s = choose(paid(s, h[0], [h[1].id]), "p2");
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === h[0].id)?.ownerId,
    ).toBe("p1");
    expect(
      paymentSources(s, undefined, "14015").some((p) => p.id === h[0].id),
    ).toBe(false);
    expect(
      paymentSources(seatView(s, "p2"), undefined, "14015").some(
        (p) => p.id === h[0].id,
      ),
    ).toBe(true);
    s = native(s, { type: "discardPiece", id: h[0].id });
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === h[0].id),
    ).toHaveLength(1);
    expect(seatView(s, "p2").player.discard.some((p) => p.id === h[0].id)).toBe(
      false,
    );
  });

  it("Brute Force adds basic ATK and piercing, then discards after the complete attack", () => {
    let s = base();
    const force = put(s, "14029");
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = basic(s, "attack");
    expect(s.villain.hp).toBe(48);
    expect(s.villain.tough).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === force.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === force.id)).toHaveLength(1);
    s = skipAll(s);
    expect(heroStats(s).attack).toBe(1);
  });

  it("Stunned replaces a basic attack before Brute Force's Forced Response can discard it", () => {
    let s = base();
    const force = put(s, "14029");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === force.id)).toBe(true);
  });

  it("Adrenaline Rush and Civic Duty discard real instances, stack phase stats and expire before villain defenses", () => {
    let s = base();
    const adrenaline = [put(s, "14022"), put(s, "14022")],
      civic = put(s, "14023");
    for (const p of [...adrenaline, civic])
      s = command(s, { type: "ABILITY", id: p.id });
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 2, defense: 1 });
    expect(
      s.player.discard.filter((p) =>
        [...adrenaline, civic].some((e) => e.id === p.id),
      ),
    ).toHaveLength(3);
    s.encounter.deck.unshift(makePiece(s, "01104"));
    s = command(s, { type: "END_TURN", discard: [] });
    expect(heroStats(s)).toMatchObject({ attack: 1, thwart: 1, defense: 1 });
  });

  it("United We Stand selects up to the villain stage in damaged friendly characters across both seats", () => {
    let s = base(true);
    s.villain.stage = 2;
    s.player.hp = 7;
    seatView(s, "p2").player.hp = 8;
    const mine = put(s, "14013"),
      theirs = put(s, "01084", "p2");
    mine.damage = theirs.damage = 1;
    const h = hand(s, "14031");
    s = paid(s, h[0], []);
    s = choose(reload(s), "hero");
    s = choose(reload(s), theirs.id);
    s = skipAll(s);
    expect(s.player.hp).toBe(8);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === theirs.id)?.damage,
    ).toBe(0);
    expect(s.player.inPlay.find((p) => p.id === mine.id)?.damage).toBe(1);
  });

  it("Beat 'Em Up deals non-attack damage only to the villain and the acting player's engaged minions", () => {
    let s = base(true);
    const mine = minion(s),
      other = minion(s, "14026", "p2"),
      h = hand(s, "14032", "14019");
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = skipAll(paid(s, h[0], [h[1].id]));
    expect(s.villain.hp).toBe(49);
    expect(s.minions.find((p) => p.id === mine.id)?.damage).toBe(1);
    expect(s.minions.find((p) => p.id === other.id)?.damage).toBe(0);
    expect(s.player.stunned).toBe(true);
  });
});

describe("Quicksilver's encounter cards and team windows", () => {
  it("Order and Chaos cancels encounter-deck Earthquake text while preserving its Incite and the physical card", () => {
    let s = base();
    put(s, "14002");
    const h = hand(s, "14018", "14019", "14003"),
      quake = makePiece(s, "14028");
    s = native(s, { type: "reveal", piece: quake, fromEncounterDeck: true });
    s = respond(reload(s), /Order and Chaos/i, "14018");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.villain.hp).toBe(48);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual([h[2].id]);
    expect(s.encounter.discard.filter((p) => p.id === quake.id)).toHaveLength(
      1,
    );
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Order and Chaos preserves printed Surge while canceling only the original When Revealed text", () => {
    let s = base();
    put(s, "14002");
    const h = hand(s, "14018", "14019"),
      card = makePiece(s, "01191"),
      next = makePiece(s, "01101");
    s.encounter.deck.unshift(next);
    s = native(s, { type: "reveal", piece: card, fromEncounterDeck: true });
    s = respond(s, /Order and Chaos/i, "14018");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.encounter.dealt.filter((p) => p.id === next.id)).toHaveLength(1);
    expect(s.encounter.discard.filter((p) => p.id === card.id)).toHaveLength(1);
    expect(s.villain.hp).toBe(48);
  });

  it("Order and Chaos is unavailable for treacheries retrieved from discard or without its printed team", () => {
    for (const fromDeck of [false, true]) {
      let s = base();
      if (!fromDeck) put(s, "14002");
      const h = hand(s, "14018", "14019");
      s = native(s, {
        type: "reveal",
        piece: makePiece(s, "01191"),
        fromEncounterDeck: fromDeck,
      });
      expect(s.prompt?.options.some((o) => o.image === "14018")).not.toBe(true);
      if (s.prompt?.title === "When Revealed · ability order")
        s = choose(s, "text");
      s = skipAll(s);
      expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
      expect(s.player.exhausted).toBe(true);
      expect(s.villain.hp).toBe(50);
    }
  });

  it("Order and Chaos accepts the printed Scarlet Witch ally in the second seat without charging her controller", () => {
    let s = base(true);
    put(s, "14002", "p2");
    const h = hand(s, "14018", "14019"),
      otherHand = hand(seatView(s, "p2"), "01088");
    s = native(s, {
      type: "reveal",
      piece: makePiece(s, "01191"),
      fromEncounterDeck: true,
    });
    s = respond(s, /Order and Chaos/i, "14018");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(seatView(s, "p2").player.hand.map((p) => p.id)).toEqual(
      otherHand.map((p) => p.id),
    );
    expect(seatView(s, "p2").player.discard).toEqual([]);
  });

  it("Need for Speed changes form and removes its actual physical copy without consuming the voluntary flip", () => {
    let s = base();
    const obligation = makePiece(s, "14024");
    s = native(s, { type: "reveal", piece: obligation, skip: true });
    s = choose(choose(s, "flip"), "remove");
    expect(s.player).toMatchObject({
      form: "alter",
      exhausted: true,
      flipped: false,
    });
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(false);
  });

  it("Need for Speed binds its ready prohibition to the affected seat and blocks all native ready effects", () => {
    let s = base(true);
    s.phase = "villain";
    const friction = put(s, "14009");
    friction.exhausted = true;
    s = choose(choose(reveal(s, "14024"), "stay"), "lock");
    expect(s.player.exhausted).toBe(true);
    s = native(reload(s), { type: "ready", target: "hero" });
    expect(s.player.exhausted).toBe(true);
    expect(s.prompt).toBeNull();
    const h = hand(s, "14003", "14019");
    expect(playable(s, h[0])).toBeTruthy();
    expect(s.player.inPlay.find((p) => p.id === friction.id)?.exhausted).toBe(
      true,
    );
    seatView(s, "p2").player.exhausted = true;
    s = native(s, { type: "ready", target: "hero:p2" });
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(seatView(s, "p1").player.exhausted).toBe(true);
  });

  it("Need for Speed remains locked through round refresh and clears only at the affected player's next turn end", () => {
    let s = base(true);
    s.phase = "villain";
    s = choose(choose(reveal(s, "14024"), "stay"), "lock");
    s = native(reload(s), { type: "newRound" });
    expect(s.round).toBe(2);
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    // First player advances to the second seat, whose turn ending cannot clear Pietro's lock.
    expect(s.turnPlayerId).toBe("p2");
    s = command(s, { type: "END_TURN", discard: [] });
    expect(s.turnPlayerId).toBe("p1");
    expect(s.player.exhausted).toBe(true);
    s = native(s, { type: "ready", target: "hero" });
    expect(s.player.exhausted).toBe(true);
    s.encounter.deck.unshift(makePiece(s, "01104"));
    s = command(s, { type: "END_TURN", discard: [] });
    while (
      s.prompt?.kind === "select" &&
      s.prompt.title.includes("end of hero phase")
    )
      s = command(reload(s), { type: "SELECT", ids: [] });
    expect(seatView(s, "p1").player.exhausted).toBe(false);
  });

  it("the nemesis side scheme retains its Crisis icon and resolves Incite independently of its base threat", () => {
    let s = base(true);
    s = reveal(s, "14025");
    expect(s.sideSchemes.find((p) => p.code === "14025")?.counters).toBe(4);
    expect(s.scheme.threat).toBe(4);
    const h = hand(s, "14004", "14019");
    s = choose(paid(s, h[0], [h[1].id]), "thwart");
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
  });

  it("Avalanche resolves Incite once and gives each actual player a separate exhaust choice", () => {
    let s = base(true);
    s = reveal(s, "14026");
    if (s.prompt?.options.some((o) => o.id === "incite"))
      s = choose(s, "incite");
    s = choose(s, "exhaust");
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    s = choose(reload(s), "exhaust");
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(s.scheme.threat).toBe(5);
    expect(s.minions.filter((p) => p.code === "14026")).toHaveLength(1);
  });

  it("Vibration Resistance attaches to Avalanche rather than the villain and reduces each separate attack", () => {
    let s = base();
    const avalanche = minion(s);
    s = reveal(s, "14027");
    s = target(s, avalanche.id);
    expect(s.attachments.find((p) => p.code === "14027")?.attachedTo).toBe(
      avalanche.id,
    );
    const sinew = put(s, "14011");
    s = basic(s, "attack", avalanche.id);
    expect(s.minions.find((p) => p.id === avalanche.id)?.damage).toBe(1);
    s = skipAll(respond(s, /Super Speed/i, "14001a"));
    s = skipAll(basic(s, "attack", avalanche.id));
    expect(s.minions.find((p) => p.id === avalanche.id)?.damage).toBe(2);
    expect(s.player.inPlay.some((p) => p.id === sinew.id)).toBe(true);
  });

  it("Vibration Resistance does not reduce Double Time non-attack packets and any ready hero may discard it", () => {
    let s = base(true);
    s = target(reveal(s, "14027"), s.villain.id);
    const attachment = s.attachments.find((p) => p.code === "14027")!,
      h = hand(s, "14004", "14019");
    s = paid(s, h[0], [h[1].id]);
    for (let i = 0; i < 2; i++) s = target(choose(s, "damage"), s.villain.id);
    expect(s.villain.hp).toBe(46);
    s.turnPlayerId = "p2";
    s = command(s, { type: "ABILITY", id: attachment.id, playerId: "p2" });
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === attachment.id),
    ).toHaveLength(1);
  });

  it("Earthquake's Incite survives even when its physical hand discard is reloaded", () => {
    let s = base();
    const h = hand(s, "14003", "14004", "14019");
    s = reveal(s, "14028");
    s = choose(s, "incite");
    expect(s.prompt).toMatchObject({ kind: "select", min: 2, max: 2 });
    expect(s.player.exhausted).toBe(true);
    s = command(reload(s), {
      type: "SELECT",
      ids: h.slice(0, 2).map((p) => p.id),
    });
    expect(s.scheme.threat).toBe(4);
    expect(s.player.hand.map((p) => p.id)).toEqual([h[2].id]);
    expect(s.encounter.discard.filter((p) => p.code === "14028")).toHaveLength(
      1,
    );
  });

  it("Earthquake boost requires two actual physical resources and an initiated payment cannot be canceled", () => {
    let s = base();
    const h = hand(s, "14021", "14019");
    s.encounter.deck.unshift(makePiece(s, "14028"));
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    s = choose(s, "pay");
    expect(s.prompt).toMatchObject({
      kind: "payment",
      requirements: ["physical", "physical"],
      cancelable: false,
    });
    expect(dispatch(reload(s), { type: "CANCEL" }).error).toBeTruthy();
    expect(
      dispatch(reload(s), { type: "PAY", ids: [h[1].id] }).error,
    ).toBeTruthy();
    s = command(reload(s), { type: "PAY", ids: [h[0].id] });
    s = skipAll(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual([h[1].id]);
  });
});
