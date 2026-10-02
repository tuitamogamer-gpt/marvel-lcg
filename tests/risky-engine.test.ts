import { describe, expect, it } from "vitest";
import { dispatch, makePiece, newGame } from "../src/game/engine";
import { card } from "../src/game/cards";
import { activateSeat, seatView } from "../src/game/team";
import type { Command, Effect, GameState, Piece } from "../src/game/types";

function command(s: GameState, cmd: Command) {
  s = dispatch(s, cmd);
  expect(s.error, s.error).toBeUndefined();
  for (let count = 0; s.review && count < 40; count++)
    s = dispatch(s, { type: "PROCEED" });
  expect(s.error, s.error).toBeUndefined();
  return s;
}
const choose = (s: GameState, id: string) => {
  expect(
    s.prompt?.options.some((o) => o.id === id),
    s.prompt?.title,
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
};
function allow(s: GameState) {
  for (let count = 0; s.prompt && count < 60; count++) {
    expect(s.prompt.kind).toBe("choice");
    const o =
      s.prompt.options.find((o) =>
        ["take", "resolve", "allow", "pass", "skip"].includes(o.id),
      ) ||
      (/indirect/i.test(s.prompt.text)
        ? s.prompt.options.find((o) => o.id === "hero")
        : undefined) ||
      (/order|forced|response/i.test(s.prompt.title)
        ? s.prompt.options[0]
        : undefined);
    if (!o)
      throw Error(
        `Unexpected prompt ${s.prompt.title}: ${s.prompt.options.map((o) => o.id)}`,
      );
    s = choose(s, o.id);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function create(players = 1, difficulty: "standard" | "expert" = "standard") {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "risky_business",
    module: "goblin_gimmicks",
    seed: 879,
    pacing: "expert",
    difficulty,
    ...(players > 1
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
}
function base(players = 1, difficulty: "standard" | "expert" = "standard") {
  let s = create(players, difficulty);
  for (let count = 0; s.phase === "mulligan" && count < 10; count++)
    s =
      s.prompt?.kind === "choice"
        ? choose(s, s.prompt.options[0].id)
        : command(s, { type: "MULLIGAN", ids: [] });
  expect(s.phase).toBe("player");
  for (const seat of s.players) {
    seat.player.form = "hero";
    seat.player.hand = [];
    seat.player.inPlay = [];
    seat.player.discard = [];
    seat.player.deck = Array.from({ length: 10 }, () => makePiece(s, "01089"));
  }
  activateSeat(s, "p1");
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.dealt = [];
  s.encounter.storedBoosts = [];
  s.resolving = [];
  s.queue = [];
  s.prompt = null;
  return s;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Native fixture",
    text: "Resolve",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
const reveal = (s: GameState, code: string) =>
  native(s, { type: "reveal", piece: makePiece(s, code), skip: true });
function deck(s: GameState, ...codes: string[]) {
  s.encounter.deck = codes.map((code) => makePiece(s, code));
  s.encounter.discard = [];
  return [...s.encounter.deck];
}
function attach(s: GameState, code: string) {
  const p = makePiece(s, code);
  p.attachedTo = s.villain.id;
  s.attachments.push(p);
  return p;
}
function goblin(s: GameState, counters = 2) {
  s.villain.code = s.villain.code.replace(/a$/, "b");
  s.environments![0].code = "02006b";
  s.environments![0].counters = counters;
}
function allEncounter(s: GameState): Piece[] {
  return [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...s.resolving,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ];
}

describe("Risky Business actual native dispatcher", () => {
  it.each(["standard", "expert"] as const)(
    "%s setup preserves opening hand order, exactly one physical environment and correct Norman face",
    (difficulty) => {
      const s = create(2, difficulty);
      expect(s.phase).toBe("mulligan");
      expect(s.villain.code).toBe(
        difficulty === "expert" ? "02002a" : "02001a",
      );
      expect(s.scheme).toMatchObject({ code: "02004b", threat: 4 });
      expect(s.environments).toHaveLength(1);
      expect(s.environments![0]).toMatchObject({ code: "02006a", counters: 4 });
      expect(s.players.map((p) => p.player.hand.length)).toEqual([6, 6]);
      expect(s.players.map((p) => p.player.hp)).toEqual([10, 12]);
    },
  );
  it.each([1, 2, 3])(
    "Norman stage%d attacks are replaced before boosts or defense windows",
    (stage) => {
      let s = base();
      s.villain.stage = stage;
      s.villain.code = `0200${stage}a`;
      const cards = deck(s, "02010", "02013");
      const hp = s.player.hp;
      s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
      expect(s.player.hp).toBe(hp);
      expect(s.environments![0].counters).toBe(2 + stage);
      expect(s.encounter.deck.map((p) => p.id)).toEqual(cards.map((p) => p.id));
      expect(s.attack).toBeNull();
    },
  );
  it("Stunned has priority over Norman attack replacement", () => {
    let s = base();
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    deck(s, "02010");
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.villain.stunned).toBe(false);
    expect(s.environments![0].counters).toBe(2);
    expect(s.encounter.deck).toHaveLength(1);
  });
  it("Webbed Up replaces Norman attack before adding infamy", () => {
    let s = base();
    const p = makePiece(s, "01009");
    p.attachedTo = s.villain.id;
    s.player.inPlay.push(p);
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.environments![0].counters).toBe(2);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.inPlay.some((a) => a.id === p.id)).toBe(false);
  });
  it("Tough prevents Norman damage before infamy replacement", () => {
    let s = base();
    s.villain.tough = true;
    s.villain.toughCards = 1;
    const hp = s.villain.hp;
    s = allow(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 8,
        attack: true,
      }),
    );
    expect(s.villain.hp).toBe(hp);
    expect(s.villain.tough).toBe(false);
    expect(s.environments![0].counters).toBe(2);
    expect(s.villain.code).toBe("02001a");
  });
  it("full damage packet flips Norman once with no excess spill, keeping physical IDs and stored boosts", () => {
    let s = base();
    const hp = s.villain.hp;
    const villainId = s.villain.id;
    const environmentId = s.environments![0].id;
    const attachment = attach(s, "02033");
    const boost = makePiece(s, "02010");
    s.encounter.storedBoosts!.push(boost);
    s = allow(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 20,
        attack: true,
      }),
    );
    expect(s.villain).toMatchObject({ id: villainId, hp, code: "02001b" });
    expect(s.environments![0]).toMatchObject({
      id: environmentId,
      code: "02006b",
      counters: 2,
    });
    expect(s.player.hp).toBe(7);
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(true);
    expect(s.encounter.storedBoosts!.map((p) => p.id)).toEqual([boost.id]);
    expect(new Set(allEncounter(s).map((p) => p.id)).size).toBe(
      allEncounter(s).length,
    );
  });
  it("stageI flip damages only heroes; expert flip also damages alter-egos", () => {
    let s = base();
    s.player.form = "alter";
    s = allow(native(s, { type: "damage", target: s.villain.id, amount: 2 }));
    expect(s.player.hp).toBe(10);
    s = base(1, "expert");
    s.player.form = "alter";
    s = allow(native(s, { type: "damage", target: s.villain.id, amount: 2 }));
    expect(s.player.hp).toBe(7);
  });
  it("defeating a Goblin stage preserves its face, attachments and statuses and runs next stage reveal", () => {
    let s = base(1, "expert");
    goblin(s, 4);
    s.villain.hp = 1;
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    const id = s.villain.id;
    const attachment = attach(s, "02033");
    const hp = s.player.hp;
    s = allow(native(s, { type: "damage", target: id, amount: 1 }));
    expect(s.villain).toMatchObject({
      id,
      code: "02003b",
      stage: 3,
      stunned: true,
      stunCards: 1,
    });
    expect(s.player.hp).toBe(hp - 4);
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(true);
    expect(s.environments![0].counters).toBe(4);
  });
  it("expert Goblin flip resolves one indirect packet per player with explicit first-player order", () => {
    let s = base(2, "expert");
    s.players[1].player.form = "alter";
    s = native(s, { type: "damage", target: s.villain.id, amount: 4 });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    s = choose(s, "p2");
    s = allow(s);
    expect(seatView(s, "p1").player.hp).toBe(7);
    expect(seatView(s, "p2").player.hp).toBe(9);
  });
  it("Goblin's each-player reveal continues after the first chosen identity is eliminated", () => {
    let s = base(2, "expert");
    s.player.hp = 1;
    s = native(s, { type: "damage", target: s.villain.id, amount: 4 });
    s = choose(s, "p1");
    s = allow(s);
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(s.phase).not.toBe("lost");
    expect(seatView(s, "p2").player.hp).toBe(9);
    expect(s.environments).toHaveLength(1);
    expect(s.villain.code).toBe("02002b");
  });
  it("final Goblin stage defeat wins and preserves a single physical environment", () => {
    let s = base();
    s.villain.stage = 2;
    s.villain.code = "02002a";
    goblin(s);
    s.villain.hp = 1;
    s = allow(native(s, { type: "damage", target: s.villain.id, amount: 1 }));
    expect(s.phase).toBe("won");
    expect(s.environments).toHaveLength(1);
  });
  it.each([1, 2, 3])(
    "Goblin stage%d scheme is replaced without boost/threat placement",
    (stage) => {
      let s = base();
      s.villain.stage = stage;
      s.villain.code = `0200${stage}a`;
      goblin(s, 4);
      deck(s, "02010");
      const threat = s.scheme.threat;
      s = allow(native(s, { type: "enemyScheme", id: s.villain.id }));
      expect(s.scheme.threat).toBe(threat);
      expect(s.environments![0].counters).toBe(4 - (stage === 3 ? 2 : 1));
      expect(s.encounter.deck).toHaveLength(1);
    },
  );
  it("Confused precedes Goblin scheme replacement", () => {
    let s = base();
    goblin(s, 1);
    s.villain.confused = true;
    s.villain.confuseCards = 1;
    s = allow(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.villain.confused).toBe(false);
    expect(s.villain.code).toBe("02001b");
    expect(s.environments![0].counters).toBe(1);
  });
  it.each(["02007", "02008", "02009", "02011", "02012"])(
    "boost%s removes last madness immediately; ongoing Norman attack uses ATK0 plus boost icons",
    (code) => {
      let s = base();
      goblin(s, 1);
      const hp = s.player.hp;
      deck(s, code, "02013");
      s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
      expect(s.villain.code).toBe("02001a");
      expect(s.environments![0]).toMatchObject({ code: "02006a", counters: 2 });
      expect(s.player.hp).toBe(hp - (card(code).boost || 0));
      expect(s.encounter.deck).toHaveLength(1);
    },
  );
  it("Hired Gun's infamy option and physical stored boost option survive save/reload", () => {
    let s = base();
    s = reveal(s, "02007");
    s = choose(s, "infamy");
    expect(s.environments![0].counters).toBe(4);
    const cards = deck(s, "02010", "02013");
    s = reveal(s, "02007");
    s = choose(s, "boost");
    s = JSON.parse(JSON.stringify(s));
    expect(s.encounter.storedBoosts!.map((p) => p.id)).toEqual([cards[0].id]);
    s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.encounter.storedBoosts!.map((p) => p.id)).toEqual([cards[0].id]);
    expect(s.encounter.deck).toHaveLength(1);
  });
  it("Oscorp Manufacturing has printed threat2P plus1P only when Norman is faceup", () => {
    let s = base(2);
    s = allow(reveal(s, "02010"));
    expect(s.sideSchemes.find((p) => p.code === "02010")!.counters).toBe(6);
    s = base(2);
    goblin(s);
    s = allow(reveal(s, "02010"));
    expect(s.sideSchemes.find((p) => p.code === "02010")!.counters).toBe(4);
  });
  it("All in a Day's Work resolves exact counter fallback on both faces", () => {
    let s = base();
    s = allow(reveal(s, "02012"));
    expect(s.environments![0].counters).toBe(4);
    goblin(s, 3);
    s = allow(reveal(s, "02012"));
    expect(s.environments![0].counters).toBe(1);
  });
  it("Hostile Takeover completes its discard before entering next main and discards old main attachments", () => {
    let s = base();
    const attachment = makePiece(s, "06031");
    attachment.attachedTo = "main";
    s.attachments.push(attachment);
    s.scheme.threat = 10;
    const playerCards = s.player.deck.slice(0, 3);
    deck(s, "02010", "02013");
    s = allow(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.scheme).toMatchObject({ code: "02005b", index: 1, threat: 1 });
    expect(s.environments![0].counters).toBe(3);
    expect(s.player.discard.map((p) => p.id)).toEqual([
      ...playerCards.map((p) => p.id),
      attachment.id,
    ]);
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === attachment.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === attachment.id)).toBe(true);
  });
  it("second main has threshold10P and reaching it causes loss", () => {
    let s = base();
    s.scheme = { code: "02005b", index: 1, threat: 9 };
    s = allow(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.phase).toBe("lost");
  });
  it("second main uses2P escalation and its own hazard in native villain phase", () => {
    let s = base(2);
    s.scheme = { code: "02005b", index: 1, threat: 2 };
    s = native(s, { type: "villainStepOne" });
    expect(s.scheme.threat).toBe(6);
    deck(s, "02013", "02013", "02013", "02013");
    s = native(s, { type: "dealEncounters" });
    s = allow(s);
    expect(s.encounter.discard.filter((p) => p.code === "02013")).toHaveLength(
      3,
    );
  });
  it("Mad Genius tie selection and pending actual attack survive save/reload", () => {
    let s = base(2);
    goblin(s, 4);
    s.players[1].player.hp = 10;
    deck(s, "02013", "02013");
    s = reveal(s, "02013");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["p1", "p2"]);
    s = JSON.parse(JSON.stringify(s));
    s = choose(s, "p2");
    s = JSON.parse(JSON.stringify(s));
    s = allow(s);
    expect(seatView(s, "p2").player.hp).toBe(6);
    expect(seatView(s, "p1").player.hp).toBe(10);
  });
  it("main-stage Then is skipped while Criminal Enterprise is faceup", () => {
    let s = base();
    goblin(s);
    s.scheme.threat = 6;
    s = allow(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.scheme.code).toBe("02005b");
    expect(s.player.discard).toHaveLength(0);
    expect(s.environments![0].counters).toBe(2);
  });
  it("Mad Genius Norman mills only the revealer to first deck exhaustion", () => {
    let s = base();
    s.environments![0].counters = 20;
    s.player.deck = s.player.deck.slice(0, 2);
    const ids = s.player.deck.map((p) => p.id);
    const cards = deck(s, "02010", "02013");
    s = allow(reveal(s, "02013"));
    expect(s.player.deck.map((p) => p.id).sort()).toEqual(ids.sort());
    expect(s.encounter.dealt.map((p) => p.id)).toEqual([cards[0].id]);
    expect(s.encounter.deck).toHaveLength(1);
  });
  it("Mad Genius chooses only lowest eligible hero, and no hero causes surge to original revealer", () => {
    let s = base(2);
    goblin(s, 4);
    s.player.form = "alter";
    const hp = seatView(s, "p2").player.hp;
    deck(s, "02013", "02010");
    s = allow(reveal(s, "02013"));
    expect(seatView(s, "p2").player.hp).toBe(hp - 4);
    expect(seatView(s, "p1").player.hp).toBe(10);
    s = base(2);
    goblin(s);
    for (const seat of s.players) seat.player.form = "alter";
    const cards = deck(s, "02010", "02013");
    s = allow(reveal(s, "02013"));
    expect(s.encounter.dealt.map((p) => [p.id, p.dealtTo])).toEqual([
      [cards[0].id, "p1"],
    ]);
  });
});
