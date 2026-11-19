/** Across the Mojoverse: Spiral with the show deck, exercised with the
 * original physical cards. Every command crosses a JSON save/reload
 * boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, VILLAINS } from "../src/game/cards";
import { abilityOptions, enemyStats, newGame } from "../src/game/engine";
import {
  SPIRAL_SCRIPT_CODES,
  spiralCornered,
  spiralEscaped,
} from "../src/game/spiral";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

const team = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
];
function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "spiral",
    difficulty,
    seed: 39012,
    pacing: "expert",
    heroes: team.slice(0, players),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 150; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve", "done"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  return reload(s);
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function stack(s: GameState, ...codes: string[]) {
  s.encounter.deck.unshift(...codes.map((code) => take(s, code)));
  delete s.encounter.knownTop;
}
/** Put the named show deck cards on top, in order. */
function showTop(s: GameState, ...codes: string[]) {
  const deck = s.spiral!.showDeck;
  const top = codes.map((code) => {
    const i = deck.findIndex((p) => p.code === code);
    expect(i, code).toBeGreaterThanOrEqual(0);
    return deck.splice(i, 1)[0];
  });
  deck.unshift(...top);
}
function fromDeck(s: GameState, code: string): Piece {
  const i = s.player.deck.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  const p = s.player.deck.splice(i, 1)[0];
  s.player.hand.push(p);
  return p;
}
const hit = (target: string, amount: number): Effect => ({
  type: "damage",
  target,
  amount,
  source: "hero",
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const villainScheme = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyScheme",
  id: s.villain.id,
  actorId: playerId,
});
const search = (s: GameState) => s.sideSchemes.find((p) => p.code === "39016")!;
const show = (s: GameState) =>
  (s.environments || []).find((p) =>
    ["39035", "39041", "39047", "39053", "39060", "39066"].includes(p.code),
  );
/** Corner Spiral directly, as Cornered! would. */
function corner(s: GameState) {
  s.villain.code = s.villain.code.replace(/a$/, "b");
  return reload(s);
}

describe("Across the Mojoverse: original source", () => {
  it("registers every face of the Spiral set", () => {
    const faces = CATALOG_CARDS.filter(
      (c) => c.pack_code === "mojo" && c.set_code === "spiral",
    );
    expect(faces).toHaveLength(14);
    expect(new Set(SPIRAL_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "spiral")).toMatchObject({
      codes: ["39012a", "39013a", "39014a"],
      schemes: ["39015b"],
      moduleCount: 3,
      defaultModules: ["crime", "fantasy", "horror"],
    });
  });

  it("starts with The Search for Spiral, one Show and the show deck", () => {
    for (const [difficulty, code, hp] of [
      ["standard", "39012a", 26],
      ["expert", "39013a", 30],
    ] as const) {
      const s = started(difficulty, 2);
      expect(s.villain).toMatchObject({ code, hp });
      expect(spiralEscaped(s)).toBe(true);
      expect(s.scheme).toMatchObject({ code: "39015b", threat: 2 });
      expect(search(s).counters).toBe(6);
      expect(show(s)).toBeTruthy();
      // The other two Shows and Cornered! form the show deck.
      expect(s.spiral!.showDeck).toHaveLength(3);
      expect(s.spiral!.showDeck.map((p) => p.code)).toContain("39017");
      const deck = s.encounter.deck.map((p) => p.code);
      for (const c of ["39016", "39017", "39035", "39041", "39047"])
        expect(deck, c).not.toContain(c);
      expect(deck.filter((c) => c === "39018")).toHaveLength(2);
      expect(deck.filter((c) => c === "39019")).toHaveLength(2);
    }
  });
});

describe("Spiral, Escaped", () => {
  it("cannot take damage, be stunned or lose threat from the main scheme", () => {
    let s = started();
    s = settle(native(s, hit(s.villain.id, 5)));
    expect(s.villain.hp).toBe(13);
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    s.scheme.threat = 5;
    s = settle(
      native(reload(s), {
        type: "thwart",
        target: "main",
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.scheme.threat).toBe(5);
  });

  it("schemes instead of attacking", () => {
    let s = started();
    const hp = s.player.hp;
    const threat = s.scheme.threat;
    // Erratic Teleportation is the boost card: boost 1.
    stack(s, "39019");
    s = settle(native(s, villainAttack(s)));
    expect(s.player.hp).toBe(hp);
    expect(s.scheme.threat).toBe(threat + 2);
  });
});

describe("The Search for Spiral and the show deck", () => {
  it("emptied, reveals the next Show, which sends the old one under the show deck", () => {
    let s = started();
    const old = show(s)!;
    const next = s.spiral!.showDeck.find((p) => p.code !== "39017")!;
    showTop(s, next.code);
    const deck = s.encounter.deck.length;
    s = settle(
      native(s, {
        type: "thwart",
        target: search(s).id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(show(s)?.code).toBe(next.code);
    expect(s.spiral!.showDeck.at(-1)?.code).toBe(old.code);
    expect(search(s).counters).toBe(3);
    // Revealed from the show deck, the Show does not surge.
    expect(s.encounter.deck).toHaveLength(deck);
  });

  it("Cornered! flips Spiral, reveals the next card and returns to the show deck", () => {
    let s = started();
    const next = s.spiral!.showDeck.find((p) => p.code !== "39017")!;
    showTop(s, "39017", next.code);
    s = settle(
      native(s, {
        type: "thwart",
        target: search(s).id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.villain.code).toBe("39012b");
    expect(spiralCornered(s)).toBe(true);
    expect(show(s)?.code).toBe(next.code);
    expect(s.spiral!.showDeck.map((p) => p.code)).toContain("39017");
    expect(s.spiral!.showDeck).toHaveLength(3);
  });

  it("Hero Action: take 2 damage to remove 3 threat", () => {
    let s = started();
    const hp = s.player.hp;
    const id = search(s).id;
    const option = abilityOptions(s, search(s)).find((o) => o.id === "search");
    expect(option).toBeTruthy();
    s = settle(command(s, { type: "ABILITY", id, action: "search" }));
    expect(s.player.hp).toBe(hp - 2);
    // 3 threat removed, then the emptied scheme reveals and refills.
    expect(search(s).counters).toBe(3);
  });
});

describe("Spiral, Cornered", () => {
  it("gains a teleport counter after she activates and escapes at 3 per player", () => {
    let s = corner(started());
    stack(s, "39019", "39019");
    s = settle(native(s, villainScheme(s)));
    expect(s.villain.counters).toBe(1);
    s.villain.counters = 2;
    s = settle(native(reload(s), villainScheme(s)));
    expect(s.villain.code).toBe("39012a");
    expect(s.villain.counters).toBe(0);
  });

  it("Spiral (II) escapes at 2 teleport counters per player", () => {
    let s = corner(started("expert"));
    s.villain.counters = 1;
    stack(s, "39019");
    s = settle(native(reload(s), villainScheme(s)));
    expect(s.villain.code).toBe("39013a");
  });

  it("takes damage, and her next stage enters on the same side with her counters", () => {
    let s = corner(started());
    s.villain.counters = 1;
    s = settle(native(reload(s), hit(s.villain.id, 13)));
    expect(s.villain).toMatchObject({
      code: "39013b",
      stage: 2,
      hp: 15,
      counters: 1,
    });
    s = settle(native(s, hit(s.villain.id, 15)));
    expect(s.phase).toBe("won");
  });

  it("Spiral (III) entering on her Cornered side attacks each player", () => {
    let s = corner(started("expert"));
    s.player.form = "alter";
    const hp = s.player.hp;
    stack(s, "39019");
    s = settle(native(reload(s), hit(s.villain.id, 15)));
    expect(s.villain).toMatchObject({ code: "39014b", stage: 3 });
    // ATK 3 and boost 1.
    expect(s.player.hp).toBe(hp - 4);
  });

  it("Spiral (III) attacks each player when Cornered! flips her, even in alter-ego form", () => {
    let s = started("expert");
    s.villain.code = "39014a";
    s.player.form = "alter";
    const hp = s.player.hp;
    showTop(s, "39017");
    stack(s, "39019");
    s = settle(
      native(reload(s), {
        type: "thwart",
        target: search(s).id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.villain.code).toBe("39014b");
    // ATK 3 and boost 1.
    expect(s.player.hp).toBe(hp - 4);
  });
});

describe("Spiral encounter cards", () => {
  it("Spiral's Swords: +1 ATK per sword counter, removed for 2 physical while Cornered", () => {
    let s = corner(started());
    const atk = enemyStats(s, s.villain).attack;
    s = settle(reveal(s, "39018"));
    const sword = s.attachments.find((a) => a.code === "39018")!;
    expect(sword.counters).toBe(3);
    expect(enemyStats(s, s.villain).attack).toBe(atk + 3);
    const a = fromDeck(s, "01003");
    const b = fromDeck(s, "01008");
    s = reload(s);
    s = command(s, { type: "ABILITY", id: sword.id, action: "sword" });
    s = settle(pay(s, [a, b]));
    expect(s.attachments.find((p) => p.id === sword.id)?.counters).toBe(2);
    expect(enemyStats(s, s.villain).attack).toBe(atk + 2);
  });

  it("Erratic Teleportation: a teleport counter while Cornered", () => {
    let s = corner(started());
    stack(s, "39019");
    s = settle(reveal(s, "39019"));
    expect(s.villain.counters).toBe(1);
  });

  it("Erratic Teleportation: while Escaped, pay a mental resource to bury the top card", () => {
    let s = started();
    const mental = fromDeck(s, "01004");
    const top = s.spiral!.showDeck[0];
    stack(s, "39019");
    s = reload(s);
    s = reveal(s, "39019");
    // Surge and the When Revealed text share the timing window.
    if (/ability order/.test(s.prompt?.title || "")) s = choose(s, "text");
    s = choose(s, "look");
    s = pay(s, [mental]);
    s = settle(choose(s, "bottom"));
    expect(s.spiral!.showDeck.at(-1)?.code).toBe(top.code);
  });

  it("The Show Must Go On deals each player a card of the current Show's set", () => {
    let s = started("standard", 2);
    const set = CATALOG_CARDS.find((c) => c.code === show(s)!.code)!.set_code;
    s = settle(reveal(s, "39020"));
    expect(s.encounter.dealt).toHaveLength(2);
    for (const p of s.encounter.dealt)
      expect(CATALOG_CARDS.find((c) => c.code === p.code)?.set_code).toBe(set);
  });

  it("Well-Armed attaches a Sword, then makes Spiral attack you", () => {
    let s = corner(started());
    s = settle(reveal(s, "39021"));
    expect(
      s.attachments.filter(
        (a) => a.code === "39018" && a.attachedTo === s.villain.id,
      ),
    ).toHaveLength(1);
    // With a Sword attached she attacks you, even in alter-ego form.
    s.player.form = "alter";
    const hp = s.player.hp;
    const card = s.encounter.discard.find((p) => p.code === "39021")!;
    s.encounter.discard = s.encounter.discard.filter((p) => p !== card);
    stack(s, "39019");
    s = settle(
      native(reload(s), { type: "reveal", piece: card, actorId: "p1" }),
    );
    // ATK 1, three sword counters and boost 1.
    expect(s.player.hp).toBe(hp - 5);
  });
});
