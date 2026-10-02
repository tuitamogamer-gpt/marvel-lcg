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
    villainId: "rhino",
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
function base(
  players = 1,
  difficulty: "standard" | "expert" = "standard",
  heroId = "spider_man",
) {
  let s = create(players, difficulty);
  if (heroId !== "spider_man") {
    s = newGame({
      heroId,
      aspect: "protection",
      villainId: "rhino",
      module: "bomb_scare",
      seed: 879,
      pacing: "expert",
      difficulty,
    });
  }
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
const reveal = (s: GameState, code: string, skip = true) =>
  native(s, { type: "reveal", piece: makePiece(s, code), skip });
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

function identityAttachment(
  s: GameState,
  code: string,
  playerId = s.activePlayerId,
) {
  const p = makePiece(s, code);
  p.attachedTo = `hero:${playerId}`;
  s.attachments.push(p);
  return p;
}
function minion(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function physical(s: GameState) {
  const pieces = allEncounter(s);
  expect(
    new Set(pieces.map((p) => p.id)).size,
    pieces.map((p) => `${p.id}:${p.code}`).join(","),
  ).toBe(pieces.length);
  expect(s.resolving).toHaveLength(0);
}

describe("Green Goblin modular sets actual native dispatcher", () => {
  it.each(["text", "surge"])(
    "Exhaustion exposes native same-window order and resolves both groups exactly once: %s first",
    (first) => {
      let s = base();
      const pieces = deck(s, "02013", "02010");
      s = reveal(s, "01191");
      expect(s.prompt?.title).toBe("When Revealed · ability order");
      expect(s.prompt?.options.map((p) => p.id)).toEqual(["text", "surge"]);
      expect(s.player.exhausted).toBe(false);
      expect(s.encounter.dealt).toHaveLength(0);
      s = allow(choose(s, first));
      expect(s.player.exhausted).toBe(true);
      expect(s.encounter.dealt.map((p) => p.id)).toEqual([pieces[0].id]);
      expect(
        s.encounter.discard.filter((p) => p.code === "01191"),
      ).toHaveLength(1);
      expect(s.revealWindows).toEqual({});
      physical(s);
    },
  );
  it("JSON reload of first-player order retains the original revealer for Media Coverage copies", () => {
    let s = base(2);
    s.firstPlayerId = "p2";
    identityAttachment(s, "02049", "p1");
    const pieces = deck(s, "02013", "02010", "02037");
    s = reveal(s, "01191");
    expect(s.activePlayerId).toBe("p2");
    expect(s.prompt?.title).toBe("When Revealed · ability order");
    expect(s.players.find((p) => p.id === "p1")?.player.exhausted).toBe(false);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = allow(choose(s, "surge"));
    expect(seatView(s, "p1").player.exhausted).toBe(true);
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(s.encounter.dealt.map((p) => p.id)).toEqual(
      pieces.slice(0, 2).map((p) => p.id),
    );
    expect(s.encounter.dealt.every((p) => p.dealtTo === "p1")).toBe(true);
    expect(s.encounter.discard.filter((p) => p.code === "01191")).toHaveLength(
      1,
    );
    expect(s.revealWindows).toEqual({});
    physical(s);
  });
  it.each(["text", "surge"])(
    "Kree Manipulator order has an observable native loss boundary: %s first",
    (first) => {
      let s = base();
      s.scheme.threat = 6;
      const pieces = deck(s, "02013", "02010");
      s = reveal(s, "01178");
      expect(s.prompt?.title).toBe("When Revealed · ability order");
      s = choose(s, first);
      expect(s.phase).toBe("lost");
      expect(s.scheme.threat).toBe(7);
      expect(s.encounter.dealt.map((p) => p.id)).toEqual(
        first === "surge" ? [pieces[0].id] : [],
      );
      expect(s.encounter.deck.map((p) => p.id)).toEqual(
        pieces.slice(first === "surge" ? 1 : 0).map((p) => p.id),
      );
    },
  );
  it("Media Coverage repeats Kree Manipulator's actual threat text and printed Surge exactly twice", () => {
    let s = base();
    identityAttachment(s, "02049");
    const pieces = deck(s, "02013", "02010", "02037");
    s = reveal(s, "01178");
    s = allow(choose(s, "text"));
    expect(s.scheme.threat).toBe(2);
    expect(s.encounter.dealt.map((p) => p.id)).toEqual(
      pieces.slice(0, 2).map((p) => p.id),
    );
    expect(s.encounter.discard.filter((p) => p.code === "01178")).toHaveLength(
      1,
    );
    physical(s);
  });
  it("revealing a second Media Coverage treats its quoted timing label as a reference, not another entry ability", () => {
    let s = base();
    identityAttachment(s, "02049");
    s = allow(reveal(s, "02049"));
    expect(s.attachments.filter((p) => p.code === "02049")).toHaveLength(2);
    physical(s);
  });
  it.each([1, 2])(
    "%s Media Coverage copies repeat gained Surge, with one original Gang-Up discard",
    (copies) => {
      let s = base();
      s.player.form = "alter";
      for (let n = 0; n < copies; n++) identityAttachment(s, "02049");
      const pieces = deck(s, "02013", "02010", "02037", "02044");
      s = allow(reveal(s, "02039"));
      expect(s.encounter.dealt.map((p) => p.id)).toEqual(
        pieces.slice(0, copies + 1).map((p) => p.id),
      );
      expect(
        s.encounter.discard.filter((p) => p.code === "02039"),
      ).toHaveLength(1);
      expect(s.revealWindows).toEqual({});
      physical(s);
    },
  );
  it("Media Coverage reevaluates Pulse text twice before its single gained-Surge group resolves twice", () => {
    let s = base();
    identityAttachment(s, "02049");
    const pieces = deck(s, ...Array.from({ length: 18 }, () => "02036"));
    s = allow(reveal(s, "02043"));
    expect(s.encounter.discard.filter((p) => p.code === "02036")).toHaveLength(
      14,
    );
    expect(s.encounter.dealt.map((p) => p.id)).toEqual(
      pieces.slice(14, 16).map((p) => p.id),
    );
    expect(s.encounter.deck.map((p) => p.id)).toEqual(
      pieces.slice(16).map((p) => p.id),
    );
    expect(s.encounter.discard.filter((p) => p.code === "02043")).toHaveLength(
      1,
    );
    physical(s);
  });
  it("a blocked Glider gains repeated Surge without repeating physical attachment entry", () => {
    let s = base();
    identityAttachment(s, "02049");
    attach(s, "02019");
    const pieces = deck(s, "02013", "02010", "02037");
    s = allow(reveal(s, "02033"));
    expect(s.encounter.dealt.map((p) => p.id)).toEqual(
      pieces.slice(0, 2).map((p) => p.id),
    );
    expect(
      s.attachments.filter((p) => ["02019", "02033"].includes(p.code)),
    ).toHaveLength(1);
    expect(s.encounter.discard.filter((p) => p.code === "02033")).toHaveLength(
      1,
    );
    physical(s);
  });
  it("JSON reload preserves Overconfidence's pending text copies, attack callback and original revealer's gained Surge", () => {
    let s = base();
    identityAttachment(s, "02049");
    const pieces = deck(s, "02013", "02036", "02010", "02037", "02044");
    s = reveal(s, "02031");
    expect(s.attack).not.toBeNull();
    expect(s.prompt?.options.some((p) => p.id === "take")).toBe(true);
    expect(Object.keys(s.revealWindows || {})).toHaveLength(1);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = allow(s);
    expect(s.player.hp).toBe(5);
    expect(s.encounter.dealt.map((p) => p.id)).toEqual(
      pieces.slice(2, 4).map((p) => p.id),
    );
    expect(s.encounter.dealt.every((p) => p.dealtTo === "p1")).toBe(true);
    expect(s.encounter.discard.filter((p) => p.code === "02031")).toHaveLength(
      1,
    );
    expect(s.attack).toBeNull();
    expect(s.revealWindows).toEqual({});
    physical(s);
  });
  it("a reveal window cleans up its physical treachery once after the original revealer is eliminated", () => {
    let s = base(2);
    s.player.hp = 2;
    deck(s, "02024", "02036", "02013", "02037");
    s = reveal(s, "02032");
    expect(s.prompt?.title).toBe("Wicked Ambitions");
    s = allow(choose(s, "damage"));
    expect(s.players.find((p) => p.id === "p1")?.eliminated).toBe(true);
    expect(s.phase).not.toBe("lost");
    expect(s.encounter.discard.filter((p) => p.code === "02032")).toHaveLength(
      1,
    );
    expect(s.revealWindows).toEqual({});
    physical(s);
  });
  it.each(["a_mess_of_things", "power_drain", "running_interference"])(
    "module%s uses real physical product cards in newGame",
    (module) => {
      const s = newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "rhino",
        module,
        seed: 12,
        pacing: "expert",
      });
      const expected =
        module === "a_mess_of_things"
          ? ["02037", "02038", "02039", "02040", "02040"]
          : module === "power_drain"
            ? ["02041", "02042", "02043", "02044", "02045"]
            : ["02046", "02047", "02048", "02049", "02049"];
      expect(
        s.encounter.deck
          .filter((p) => /^020(?:3[7-9]|4[0-9])$/.test(p.code))
          .map((p) => p.code)
          .sort(),
      ).toEqual(expected.sort());
    },
  );
  it("Scorpion's actual Quickstrike and positive identity damage stun the hero", () => {
    let s = base();
    s = allow(reveal(s, "02038"));
    expect(s.player.hp).toBe(7);
    expect(s.player.stunned).toBe(true);
    expect(s.minions).toHaveLength(1);
    physical(s);
  });
  it("Scorpion stuns surviving ally defender, not identity, while Tough stops the damage condition", () => {
    let s = base();
    const scorpion = minion(s, "02038");
    const ally = makePiece(s, "01050");
    s.player.inPlay.push(ally);
    s = native(s, { type: "enemyAttack", id: scorpion.id });
    s = allow(choose(s, ally.id));
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 3,
      stunned: true,
    });
    expect(s.player.stunned).toBe(false);
    s = base();
    const source = minion(s, "02038");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = allow(native(s, { type: "enemyAttack", id: source.id }));
    expect(s.player.hp).toBe(10);
    expect(s.player.stunned).toBe(false);
    physical(s);
  });
  it("choosing Retaliate first defeats Scorpion and suppresses its uninitiated source response", () => {
    let s = base(1, "standard", "black_panther");
    const source = minion(s, "02038");
    source.damage = 6;
    s = native(s, { type: "enemyAttack", id: source.id });
    s = choose(s, "take");
    expect(s.prompt?.options.map((o) => o.id)).toContain("retaliate");
    s = allow(choose(s, "retaliate"));
    expect(s.minions).toHaveLength(0);
    expect(s.player.stunned).toBe(false);
    physical(s);
  });
  it("A Mess of Things base2 is fixed across players, then adds2 per stunned friendly character", () => {
    let s = base(2);
    s.player.stunned = true;
    const ally = makePiece(s, "01083");
    ally.stunned = true;
    s.players[1].player.inPlay.push(ally);
    s = allow(reveal(s, "02037"));
    expect(s.sideSchemes.find((p) => p.code === "02037")!.counters).toBe(6);
    physical(s);
  });
  it("Gang-Up preserves original player through all activations and presents minion ordering", () => {
    let s = base(2);
    s.player.hp = 20;
    const a = minion(s, "02038"),
      b = minion(s, "02042");
    deck(s, "02013", "02040", "02013");
    const other = s.players[1].player.hp;
    s = reveal(s, "02039");
    s = choose(s, "take");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id, b.id]);
    s = choose(s, b.id);
    s = choose(s, "take");
    s = choose(s, "take");
    s = allow(s);
    expect(seatView(s, "p1").player.hp).toBe(12);
    expect(seatView(s, "p2").player.hp).toBe(other);
    physical(s);
  });
  it("Gang-Up also activates a minion newly put into play by the villain boost", () => {
    let s = base();
    deck(s, "01121", "02013");
    s = allow(reveal(s, "02039"));
    expect(s.minions.find((p) => p.code === "01121")).toBeDefined();
    expect(s.player.hp).toBe(7);
    physical(s);
  });
  it("Scorpion Overkill damages ally and identity, stuns only surviving identity and does not duplicate source", () => {
    let s = base();
    const scorpion = minion(s, "02038");
    const ally = makePiece(s, "01050");
    ally.damage = 4;
    s.player.inPlay.push(ally);
    s = native(s, { type: "enemyAttack", id: scorpion.id });
    s.attack!.overkill = true;
    s = allow(choose(s, ally.id));
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.hp).toBe(8);
    expect(s.player.stunned).toBe(true);
    physical(s);
  });
  it("Scorpion Overkill does not spill through Tough on defending ally", () => {
    let s = base();
    const scorpion = minion(s, "02038"),
      ally = makePiece(s, "01050");
    ally.damage = 4;
    ally.tough = true;
    ally.toughCards = 1;
    s.player.inPlay.push(ally);
    s = native(s, { type: "enemyAttack", id: scorpion.id });
    s.attack!.overkill = true;
    s = allow(choose(s, ally.id));
    expect(s.player.hp).toBe(10);
    expect(s.player.stunned).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 4,
      tough: false,
      stunned: false,
    });
    physical(s);
  });
  it("Tail Sweep actual canceled Scorpion attack removes Stunned and stuns revealer", () => {
    let s = base();
    const p = minion(s, "02038");
    p.stunned = true;
    p.stunCards = 1;
    s = allow(reveal(s, "02040"));
    expect(s.minions[0].stunned).toBe(false);
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBe(10);
    physical(s);
  });
  it("Tail Sweep in alter ego cannot attack hero and still stuns identity", () => {
    let s = base();
    minion(s, "02038");
    s.player.form = "alter";
    s = allow(reveal(s, "02040"));
    expect(s.player.hp).toBe(10);
    expect(s.player.stunned).toBe(true);
  });
  it("Tail Sweep actual performed attack with0 damage does not invoke fallback stun", () => {
    let s = base();
    minion(s, "02038");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = allow(reveal(s, "02040"));
    expect(s.player.stunned).toBe(false);
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(10);
  });
  it.each(["02042", "02043", "02044", "02045"])(
    "boost%s discards3 physical cards and resolves no discarded stars",
    (code) => {
      let s = base();
      const cards = deck(s, code, "02042", "02043", "02044", "02013");
      s = allow(native(s, { type: "enemyAttack", id: s.villain.id }));
      expect(s.encounter.deck.map((p) => p.id)).toEqual([cards[4].id]);
      expect(s.encounter.discard.map((p) => p.id).sort()).toEqual(
        cards
          .slice(0, 4)
          .map((p) => p.id)
          .sort(),
      );
      expect(s.player.hp).toBe(10 - 2 - (card(code).boost || 0));
      physical(s);
    },
  );
  it("Electro attack response delivers indirect packet from one discarded card to ally or identity", () => {
    let s = base();
    const p = minion(s, "02042"),
      ally = makePiece(s, "01050");
    ally.tough = true;
    ally.toughCards = 1;
    s.player.inPlay.push(ally);
    deck(s, "02010", "02013");
    s = native(s, { type: "enemyAttack", id: p.id });
    s = choose(s, "take");
    expect(s.prompt?.text).toMatch(/indirect/);
    for (let n = 0; n < 3; n++) s = choose(s, ally.id);
    s = allow(s);
    expect(s.player.hp).toBe(8);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 0,
      tough: false,
    });
    physical(s);
  });
  it("Lightning Bolt allocates exactly numeric icons, with stars ignored", () => {
    let s = base();
    deck(s, "02042", "02040", "02013");
    s = reveal(s, "02044");
    expect(s.prompt?.text).toMatch(/indirect/);
    s = choose(s, "hero");
    s = allow(choose(s, "hero"));
    expect(s.player.hp).toBe(8);
    expect(s.encounter.deck).toHaveLength(1);
    physical(s);
  });
  it("Electromagnetic Pulse moves the exact discarded Electro instance and supports deck exhaustion", () => {
    let s = base();
    const cards = deck(s, "02042");
    s = allow(reveal(s, "02043"));
    expect(s.minions.map((p) => p.id)).toEqual([cards[0].id]);
    expect(s.encounter.acceleration).toBe(2); // Put removes Electro from the reshuffled deck; finishing Pulse empties it a second time.
    expect(s.encounter.dealt).toHaveLength(0);
    physical(s);
  });
  it("Electromagnetic Pulse without Electro surges after first deck exhaustion only", () => {
    let s = base();
    deck(s, "02013", "02040");
    s = allow(reveal(s, "02043"));
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.dealt).toHaveLength(1);
    physical(s);
  });
  it("Shock Therapy countsP cards and heals actual villain damage", () => {
    let s = base(2);
    s.villain.hp -= 4;
    const before = s.villain.hp;
    deck(s, "02042", "02013", "02040");
    s = allow(reveal(s, "02045"));
    expect(s.villain.hp).toBe(before + 3);
    expect(s.encounter.deck).toHaveLength(1);
    physical(s);
  });
  it("Power Drain When Defeated interrupts leaving play and forces printed hand-resource choice", () => {
    let s = base();
    s = allow(reveal(s, "02041"));
    const scheme = s.sideSchemes.find((p) => p.code === "02041")!;
    const hand = makePiece(s, "01089");
    s.player.hand.push(hand);
    deck(s, "02042", "02040", "02013");
    s = native(s, { type: "thwart", target: scheme.id, amount: 2 });
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(true);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([hand.id]);
    s = choose(s, hand.id);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === hand.id)).toBe(true);
    physical(s);
  });
  it("Power Drain each-player hand choice survives save/reload without changing card owner", () => {
    let s = base(2);
    s = allow(reveal(s, "02041"));
    const scheme = s.sideSchemes.find((p) => p.code === "02041")!,
      cardA = makePiece(s, "01089"),
      cardB = makePiece(s, "01090");
    cardA.ownerId = "p1";
    cardB.ownerId = "p2";
    s.player.hand.push(cardA);
    s.players[1].player.hand.push(cardB);
    deck(s, "02042", "02040", "02013");
    s = native(s, { type: "thwart", target: scheme.id, amount: 4 });
    s = JSON.parse(JSON.stringify(s));
    s = choose(s, "p2");
    s = JSON.parse(JSON.stringify(s));
    s = choose(s, cardB.id);
    s = choose(s, cardA.id);
    expect(
      seatView(s, "p2").player.discard.map((p) => [p.id, p.ownerId]),
    ).toEqual([[cardB.id, "p2"]]);
    expect(
      seatView(s, "p1").player.discard.map((p) => [p.id, p.ownerId]),
    ).toEqual([[cardA.id, "p1"]]);
    physical(s);
  });
  it("Running Interference atomic payment can use generated wild and does not allow decline after branch choice", () => {
    let s = base();
    const mental = makePiece(s, "01089"),
      physicalCard = makePiece(s, "01090");
    s.player.hand.push(mental, physicalCard);
    s = reveal(s, "02046");
    s = choose(s, "pay");
    expect(s.prompt?.kind).toBe("payment");
    const attempted = dispatch(s, { type: "CANCEL" });
    expect(attempted.error).toMatch(/cannot|must|cancel/i);
    s = command(s, { type: "PAY", ids: [mental.id, physicalCard.id] });
    expect(s.sideSchemes.find((p) => p.code === "02046")!.counters).toBe(1);
    physical(s);
  });
  it("Running Interference without resources must place2threat and Crisis blocks main removal", () => {
    let s = base();
    s.scheme.threat = 4;
    s = reveal(s, "02046");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["threat"]);
    s = choose(s, "threat");
    expect(s.sideSchemes[0].counters).toBe(3);
    s = native(s, { type: "threat", target: "main", amount: -1 });
    expect(s.scheme.threat).toBe(4);
    physical(s);
  });
  it("Tombstone actual damage triggers only hand mental/physical; ally defense damage alone does not", () => {
    let s = base();
    const tomb = minion(s, "02047"),
      mental = makePiece(s, "01089"),
      wild = makePiece(s, "01055");
    s.player.hand.push(mental, wild);
    s = native(s, { type: "enemyAttack", id: tomb.id });
    s = choose(s, "take");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([mental.id]);
    s = choose(s, mental.id);
    expect(s.player.hand.map((p) => p.id)).toEqual([wild.id]);
    s = base();
    const min = minion(s, "02047"),
      ally = makePiece(s, "01050");
    s.player.inPlay.push(ally);
    s.player.hand.push(makePiece(s, "01089"));
    s = native(s, { type: "enemyAttack", id: min.id });
    s = allow(choose(s, ally.id));
    expect(s.player.hand).toHaveLength(1);
    physical(s);
  });
  it("All Tied Up attaches one physical instance, blocks flip and every ready effect, then paid removal unlocks", () => {
    let s = base();
    s.player.exhausted = true;
    s = reveal(s, "02048");
    const attachment = s.attachments.find((p) => p.code === "02048")!;
    expect(attachment.attachedTo).toBe("hero:p1");
    const blocked = dispatch(s, { type: "FLIP" });
    expect(blocked.error).toMatch(/Tied Up/);
    s = native(s, { type: "ready", target: "hero" });
    expect(s.player.exhausted).toBe(true);
    const a = makePiece(s, "01089"),
      b = makePiece(s, "01090");
    s.player.hand.push(a, b);
    s = command(s, { type: "ABILITY", id: attachment.id });
    s = command(s, { type: "PAY", ids: [a.id, b.id] });
    s = native(s, { type: "ready", target: "hero" });
    expect(s.player.exhausted).toBe(false);
    expect(s.attachments).toHaveLength(0);
    physical(s);
  });
  it("All Tied Up refill keeps identity exhausted while allies ready", () => {
    let s = base();
    identityAttachment(s, "02048");
    s.player.exhausted = true;
    const ally = makePiece(s, "01083");
    ally.exhausted = true;
    s.player.inPlay.push(ally);
    s = native(s, { type: "refill" });
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)!.exhausted).toBe(
      false,
    );
  });
  it("All Tied Up prevents obligation's optional hero-to-alter flip but permits exhaustion when already alter ego", () => {
    let s = base();
    identityAttachment(s, "02048");
    s = reveal(s, "01165");
    expect(s.prompt?.options.map((o) => o.id)).not.toContain("resolve");
    s = choose(s, "penalty");
    expect(s.player.form).toBe("hero");
    s = base();
    identityAttachment(s, "02048");
    s.player.form = "alter";
    s = reveal(s, "01165");
    expect(s.prompt?.options.map((o) => o.id)).toContain("resolve");
    s = choose(s, "resolve");
    expect(s.player.form).toBe("alter");
    expect(s.player.exhausted).toBe(true);
    physical(s);
  });
  it("Media Coverage repeats actual side When Revealed without resetting or duplicating physical entry", () => {
    let s = base();
    identityAttachment(s, "02049");
    s.player.stunned = true;
    s = allow(reveal(s, "02037"));
    expect(s.sideSchemes).toHaveLength(1);
    expect(s.sideSchemes[0].counters).toBe(6);
    physical(s);
  });
  it("Media Coverage never repeats Quickstrike/attachment entry or creates resolving duplicates", () => {
    let s = base();
    identityAttachment(s, "02049");
    s = allow(reveal(s, "02038"));
    expect(s.player.hp).toBe(7);
    expect(s.minions).toHaveLength(1);
    physical(s);
    s = allow(reveal(s, "02048"));
    expect(s.attachments.filter((p) => p.code === "02048")).toHaveLength(1);
    physical(s);
  });
  it("two Media Coverages repeat conditional treachery three times and retain one physical treachery", () => {
    let s = base();
    identityAttachment(s, "02049");
    identityAttachment(s, "02049");
    s = allow(reveal(s, "02040"));
    expect(s.player.stunCards).toBe(1);
    expect(s.encounter.discard.filter((p) => p.code === "02040")).toHaveLength(
      1,
    );
    physical(s);
  });
  it("Media Coverage repeats printed Surge per currentRRG1.8", () => {
    let s = base();
    identityAttachment(s, "02049");
    const cards = deck(s, "02013", "02010", "02037");
    s = allow(reveal(s, "01121"));
    expect(s.encounter.dealt.map((p) => p.id)).toEqual(
      cards.slice(0, 2).map((p) => p.id),
    );
    expect(s.minions.filter((p) => p.code === "01121")).toHaveLength(1);
    physical(s);
  });
  it("Enhanced Spider-Sense cancels printed Surge and all Media repetitions before payment completion", () => {
    let s = base();
    identityAttachment(s, "02049");
    const cancel = makePiece(s, "01004"),
      resource = makePiece(s, "01089");
    s.player.hand.push(cancel, resource);
    const cards = deck(s, "02010", "02013");
    s = reveal(s, "01191", false);
    s = choose(s, "01004");
    s = command(s, { type: "PAY", ids: [resource.id] });
    expect(s.encounter.deck.map((p) => p.id)).toEqual(cards.map((p) => p.id));
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.encounter.discard.filter((p) => p.code === "01191")).toHaveLength(
      1,
    );
    physical(s);
  });
  it("Media Coverage removal belongs to attached identity controller and requires their alter-ego mental payment", () => {
    let s = base(2);
    const attachment = identityAttachment(s, "02049", "p2");
    s.player.form = "alter";
    const rejected = dispatch(s, { type: "ABILITY", id: attachment.id });
    expect(rejected.error).toBeTruthy();
    expect(rejected.attachments.some((p) => p.id === attachment.id)).toBe(true);
    activateSeat(s, "p2");
    s.player.form = "alter";
    const mental = makePiece(s, "01089");
    s.player.hand.push(mental);
    s = command(s, { type: "ABILITY", id: attachment.id, playerId: "p2" });
    s = command(s, { type: "PAY", ids: [mental.id] });
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(false);
    physical(s);
  });
});
