/** Trickster Takeover: Enchantress with the Trickster Magic modular set,
 * exercised with the original physical cards. Every command crosses a JSON
 * save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  pieceHP,
  scenarioModules,
} from "../src/game/cards";
import { deckOptions } from "../src/game/decks";
import {
  abilityOptions,
  allyCount,
  dispatch,
  enemyStats,
  makePiece,
  newGame,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  ENCHANTRESS_CODES,
  ENCHANTRESS_MODULAR_SETS,
  LINKED_ALLIES,
  TRICKSTER_MAGIC_CODES,
  defiant,
  enchantment,
  enchantressObjective,
  enthralled,
} from "../src/game/enchantress-villain";
import type { Effect, GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
const team: Seat[] = [
  { heroId: "captain_marvel", aspect: "aggression" },
  { heroId: "spider_man", aspect: "justice" },
];
const PRIME = "55004b";
const SOVEREIGN = "55005b";
const DESPAIR = "55006";
const ENVY_GAZE = "55007a";
const GREED_GAZE = "55008a";
const PRIDE_GAZE = "55009a";
const SLOTH_GAZE = "55010a";
const WRATH_GAZE = "55011a";
const ALLURING = "55012";
const KISS = "55013";
const LOVE = "55014";
const SEDUCED = "55015";
const CROWN = "55016";
const LACKEY = "55017";
const BRUTE = "55018";
const SINDR = "55019";
const ULIK = "55020";
const LAW = "55021";
const SPELLBOUND = "55022";
const BIDDING = "55023";
const RESTRAINTS = "55024";
const BLAST = "55025";
const SHARDS = "55026";
const ABSORBING = "55056";
const TITANIA = "55057";
const WHIRLWIND = "55058";
const ZZZAX = "55059";
const TANGO = "55060";
const PUPPET = "55061";
const TRIANGLE = "55062";
const CREEL = "55063";
const MARY = "55064";
const CANNON = "55065";
const ZZZAX_ALLY = "55066";
const MOCKINGBIRD = "01083";
const HELICARRIER = "01092";

function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "enchantress_villain",
  modules?: string[],
) {
  return newGame({
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId,
    difficulty,
    seed: 55001,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...(modules ? { modules } : {}),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 200; n++) {
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
function opened(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "enchantress_villain",
  modules?: string[],
) {
  let s = settle(setup(difficulty, players, villainId, modules));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  return s;
}
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "enchantress_villain",
  modules?: string[],
) {
  const s = opened(difficulty, players, villainId, modules);
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  s.encounter.deck.push(...s.encounter.dealt.splice(0));
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return reload(s);
}
function zones(s: GameState): Piece[][] {
  return [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
    s.resolving,
    s.removed,
    s.attachments,
    s.sideSchemes,
    s.minions,
    s.environments || [],
    s.victoryDisplay || [],
    s.enchantress?.despair ? [s.enchantress.despair] : [],
    s.enchantress?.gazes || [],
    s.tricksterMagic?.allies || [],
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** Each physical card stays in exactly one zone: 27 Enchantress set cards
 * besides the villain, and Trickster Magic's 7 encounter cards and 4
 * allies. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(
    all.filter((p) => card(p).set_code === "enchantress_villain"),
  ).toHaveLength(27);
  if (s.tricksterMagic)
    expect(
      all.filter((p) => card(p).set_code === "trickster_magic"),
    ).toHaveLength(11);
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.tricksterMagic?.allies || [],
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) {
      const [p] = zone.splice(i, 1);
      delete p.attachedTo;
      delete p.engagedWith;
      return p;
    }
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
const hit = (
  target: string,
  amount: number,
  source = "hero",
  attack = false,
): Effect => ({
  type: "damage",
  target,
  amount,
  source,
  ...(attack ? { attack: true } : {}),
});
const N = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `ench:${type}`,
  ...args,
});
/** Give a player the Hypnotic Gaze with this front, swapping it with the
 * one they hold. */
function useGaze(s: GameState, front: string, playerId = "p1", counters = 0) {
  const mine = enchantment(s, playerId)!;
  const other = [...s.enchantress!.gazes, ...s.attachments].find(
    (p) => p.code === front,
  );
  if (other && other.id !== mine.id) {
    other.code = mine.code;
    mine.code = front;
  }
  mine.counters = counters;
  return mine;
}
/** A Trance in a player's play area, flipped from its Hypnotic Gaze. */
function entrance(s: GameState, front: string, playerId = "p1") {
  const p = useGaze(s, front, playerId);
  p.code = front.replace("a", "b");
  return p;
}
function minion(s: GameState, code: string, playerId = "p1") {
  const p = take(s, code);
  p.engagedWith = playerId;
  p.damage = 0;
  s.minions.push(p);
  return p;
}
function sideScheme(s: GameState, code: string, counters?: number) {
  const p = take(s, code);
  const c = card(p);
  p.counters =
    counters ??
    (c.base_threat || 0) * (c.base_threat_fixed ? 1 : s.playerCount);
  s.sideSchemes.push(p);
  return p;
}
function attachTo(s: GameState, code: string, target: string) {
  const p = take(s, code);
  p.attachedTo = target;
  s.attachments.push(p);
  return p;
}
/** A player card put into play under the first player's control. */
function own(s: GameState, code: string) {
  const p = makePiece(s, code);
  p.ownerId = s.activePlayerId;
  s.player.inPlay.push(p);
  return p;
}
/** Plain boost cards on top of the encounter deck (Standard treacheries). */
function plainBoosts(s: GameState, n = 2) {
  for (let i = 0; i < n; i++) {
    const p = makePiece(s, "01186");
    s.encounter.deck.unshift(p);
  }
  delete s.encounter.knownTop;
  return s;
}
function playerCard(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  if (i >= 0) return p.deck.splice(i, 1)[0];
  return makePiece(s, code);
}
const optionIds = (s: GameState) => s.prompt?.options.map((o) => o.id) || [];

describe("Enchantress registration and setup", () => {
  it("registers every Enchantress and Trickster Magic face natively", () => {
    const tt = CATALOG_CARDS.filter((c) =>
      ["enchantress_villain", "trickster_magic"].includes(c.set_code || ""),
    );
    expect(tt.map((c) => c.code).sort()).toEqual(
      [...ENCHANTRESS_CODES, ...TRICKSTER_MAGIC_CODES].sort(),
    );
    for (const c of tt) expect(hasExecutableScript(c), c.code).toBe(true);
    const v = VILLAINS.find((v) => v.id === "enchantress_villain")!;
    expect(v.codes).toEqual(["55001", "55002", "55003"]);
    expect(v.schemes).toEqual([PRIME, SOVEREIGN]);
    expect(v.defaultModules).toEqual(["trickster_magic"]);
    expect(MODULES.some((m) => m.id === "trickster_magic")).toBe(true);
    expect(ENCHANTRESS_MODULAR_SETS).toEqual(["trickster_magic"]);
    // Linked allies never join a deck.
    for (const code of LINKED_ALLIES)
      expect(
        deckOptions("captain_marvel", "aggression").some(
          (c) => c.code === code,
        ),
      ).toBe(false);
  });
  it("sets Future of Despair aside and attaches a random Hypnotic Gaze to each identity", () => {
    const s = opened("standard", 2);
    expect(s.villain.code).toBe("55001");
    expect(s.villain.hp).toBe(30);
    expect(s.scheme.code).toBe(PRIME);
    expect(s.scheme.threat).toBe(2);
    for (const seat of s.players) {
      const p = enchantment(s, seat.id)!;
      expect(p.code).toMatch(/^5501[01]a$|^5500[789]a$/);
      expect(p.counters).toBe(0);
      expect(defiant(s, seat.id)).toBe(true);
    }
    expect(s.enchantress!.despair!.code).toBe(DESPAIR);
    expect(s.enchantress!.gazes).toHaveLength(3);
    expect(
      s.encounter.deck.some(
        (p) =>
          /^550(0[6-9]|1[01])/.test(p.code) || LINKED_ALLIES.includes(p.code),
      ),
    ).toBe(false);
    expect(s.tricksterMagic!.allies.map((p) => p.code)).toEqual(LINKED_ALLIES);
    expect(enchantressObjective(s)).toBe(
      "Defeat Enchantress · 0 of 2 heroes entranced",
    );
    exact(s);
  }, 30000);
  it("uses Enchantress (II) in Expert without Future of Despair", () => {
    const s = opened("expert");
    expect(s.villain.code).toBe("55002");
    expect(s.sideSchemes.some((p) => p.code === DESPAIR)).toBe(false);
    expect(s.enchantress!.despair!.code).toBe(DESPAIR);
    exact(s);
  }, 30000);
  it("Trickster Magic joins any scenario with its allies set aside", () => {
    expect(
      scenarioModules("rhino").some((m) => m.id === "trickster_magic"),
    ).toBe(true);
    const s = opened("standard", 1, "rhino", ["trickster_magic"]);
    expect(s.modules).toEqual(["trickster_magic"]);
    expect(
      s.encounter.deck
        .filter((p) => card(p).set_code === "trickster_magic")
        .map((p) => p.code)
        .sort(),
    ).toEqual([ABSORBING, TITANIA, WHIRLWIND, ZZZAX, TANGO, PUPPET, TRIANGLE]);
    expect(s.tricksterMagic!.allies).toHaveLength(4);
  }, 30000);
});

describe("Charm counters and trances", () => {
  it("Enchantress attacking you places a charm counter on your Hypnotic Gaze", () => {
    let s = started();
    plainBoosts(s);
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(enchantment(s, "p1")!.counters).toBe(1);
    exact(s);
  }, 30000);
  it("the fifth charm counter flips the Gaze to its Trance and resolves its When Revealed", () => {
    let s = started();
    useGaze(s, SLOTH_GAZE, "p1", 4);
    s = settle(native(s, N("charm", { playerId: "p1", n: 1, actorId: "p1" })));
    const p = enchantment(s, "p1")!;
    expect(p.code).toBe("55010b");
    expect(p.counters).toBe(0);
    expect(enthralled(s, "p1")).toBe(true);
    // Trance of Sloth: you are stunned.
    expect(s.player.stunned).toBe(true);
    expect(enchantressObjective(s)).toBe(
      "Defeat Enchantress · 1 of 1 hero entranced",
    );
    exact(s);
  }, 30000);
  it("Trance of Sloth's otherwise places 2 threat when you cannot be stunned", () => {
    let s = started();
    s.player.stunned = true;
    useGaze(s, SLOTH_GAZE, "p1", 5);
    const threat = s.scheme.threat;
    s = settle(
      native(
        s,
        N("trance", {
          id: enchantment(s, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(s.scheme.threat).toBe(threat + 2);
    exact(s);
  }, 30000);
  it("Trance of Greed confuses you, otherwise you take 2 damage", () => {
    let s = started();
    useGaze(s, GREED_GAZE, "p1", 5);
    s = settle(
      native(
        s,
        N("trance", {
          id: enchantment(s, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(s.player.confused).toBe(true);
    let t = started();
    t.player.confused = true;
    const hp = t.player.hp;
    useGaze(t, GREED_GAZE, "p1", 5);
    t = settle(
      native(
        t,
        N("trance", {
          id: enchantment(t, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(t.player.hp).toBe(hp - 2);
    exact(t);
  }, 30000);
  it("Trance of Pride exhausts you, otherwise discards a random card from your hand", () => {
    let s = started();
    useGaze(s, PRIDE_GAZE, "p1", 5);
    s = settle(
      native(
        s,
        N("trance", {
          id: enchantment(s, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(s.player.exhausted).toBe(true);
    let t = started();
    t.player.exhausted = true;
    t.player.hand.push(t.player.deck.shift()!, t.player.deck.shift()!);
    useGaze(t, PRIDE_GAZE, "p1", 5);
    t = settle(
      native(
        t,
        N("trance", {
          id: enchantment(t, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(t.player.hand).toHaveLength(1);
    exact(t);
  }, 30000);
  it("Trance of Envy discards a card you control, otherwise the top 8 cards of your deck", () => {
    let s = started();
    const support = own(s, HELICARRIER);
    useGaze(s, ENVY_GAZE, "p1", 5);
    s = settle(
      native(
        s,
        N("trance", {
          id: enchantment(s, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(s.player.inPlay.some((p) => p.id === support.id)).toBe(false);
    let t = started();
    const deck = t.player.deck.length;
    useGaze(t, ENVY_GAZE, "p1", 5);
    t = settle(
      native(
        t,
        N("trance", {
          id: enchantment(t, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(t.player.deck.length).toBe(deck - 8);
    exact(t);
  }, 30000);
  it("Trance of Wrath reveals a card from the top 5 of the encounter deck", () => {
    let s = started();
    stack(s, SPELLBOUND);
    useGaze(s, WRATH_GAZE, "p1", 5);
    s = native(
      s,
      N("trance", {
        id: enchantment(s, "p1")!.id,
        playerId: "p1",
        actorId: "p1",
      }),
    );
    const spellbound = s.prompt!.options.find((o) => o.image === SPELLBOUND)!;
    s = settle(choose(s, spellbound.id));
    expect(s.sideSchemes.some((p) => p.code === SPELLBOUND)).toBe(true);
    exact(s);
  }, 30000);
  it("an Enthralled hero's charm counter becomes 1 threat on the main scheme", () => {
    let s = started();
    entrance(s, SLOTH_GAZE);
    const threat = s.scheme.threat;
    s = settle(native(s, N("charm", { playerId: "p1", n: 1, actorId: "p1" })));
    expect(s.scheme.threat).toBe(threat + 1);
    expect(enchantment(s, "p1")!.counters).toBe(0);
    exact(s);
  }, 30000);
});

describe("Forced Actions", () => {
  it("a Trance's Forced Action is a button and resolves itself before the turn ends", () => {
    let s = started("standard", 2);
    const trance = entrance(s, SLOTH_GAZE);
    s.villain.hp -= 3;
    expect(abilityOptions(s, trance).some((o) => o.id === "forced")).toBe(true);
    const hp = s.villain.hp;
    s = settle(command(s, { type: "END_TURN" }));
    // Heal 1 damage from Enchantress, draw 1 and discard 1, then the next
    // player's turn.
    expect(s.villain.hp).toBe(hp + 1);
    expect(enchantment(s, "p1")!.exhausted).toBe(true);
    expect(s.activePlayerId).toBe("p2");
    exact(s);
  }, 60000);
  it("each Forced Action resolves once, and the ready step readies it", () => {
    let s = started();
    entrance(s, PRIDE_GAZE);
    const scheme = sideScheme(s, SPELLBOUND, 3);
    const threat = s.scheme.threat;
    s = settle(
      command(s, {
        type: "ABILITY",
        id: enchantment(s, "p1")!.id,
        action: "forced",
      }),
    );
    // Trance of Pride: 1 threat on the main scheme, 2 off a side scheme.
    expect(s.scheme.threat).toBe(threat + 1);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)!.counters).toBe(1);
    expect(enchantment(s, "p1")!.exhausted).toBe(true);
    expect(
      abilityOptions(s, enchantment(s, "p1")!).some((o) => o.id === "forced"),
    ).toBe(false);
    s = settle(native(s, { type: "refill", actorId: "p1" }));
    expect(enchantment(s, "p1")!.exhausted).toBe(false);
    exact(s);
  }, 30000);
  it("Trance of Envy gives Enchantress a facedown boost card and readies you", () => {
    let s = started();
    entrance(s, ENVY_GAZE);
    s.player.exhausted = true;
    s = settle(
      native(
        s,
        N("forced", {
          id: enchantment(s, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(s.player.exhausted).toBe(false);
    expect(s.encounter.storedBoosts).toHaveLength(1);
    exact(s);
  }, 30000);
  it("Trance of Greed plays the drawn card, or you take 1 damage", () => {
    let s = started();
    entrance(s, GREED_GAZE);
    s.player.deck.unshift(playerCard(s, "01088"));
    const hp = s.player.hp;
    s = settle(
      native(
        s,
        N("forced", {
          id: enchantment(s, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    // A resource card cannot be played: 1 damage.
    expect(s.player.hp).toBe(hp - 1);
    let t = started();
    entrance(t, GREED_GAZE);
    const support = playerCard(t, HELICARRIER);
    t.player.deck.unshift(support);
    const resources = [
      playerCard(t, "01088"),
      playerCard(t, "01089"),
      playerCard(t, "01090"),
    ];
    t.player.hand.push(...resources);
    t = native(
      t,
      N("forced", {
        id: enchantment(t, "p1")!.id,
        playerId: "p1",
        actorId: "p1",
      }),
    );
    expect(t.prompt?.kind).toBe("payment");
    t = settle(pay(t, resources));
    expect(t.player.inPlay.some((p) => p.id === support.id)).toBe(true);
    expect(t.player.hp).toBe(hp);
    exact(t);
  }, 30000);
  it("Trance of Wrath's indirect damage and 2 damage to a minion", () => {
    let s = started();
    entrance(s, WRATH_GAZE);
    const lackey = minion(s, LACKEY);
    const hp = s.player.hp;
    s = settle(
      native(
        s,
        N("forced", {
          id: enchantment(s, "p1")!.id,
          playerId: "p1",
          actorId: "p1",
        }),
      ),
    );
    expect(s.player.hp).toBe(hp - 1);
    expect(s.minions.find((p) => p.id === lackey.id)!.damage).toBe(2);
    exact(s);
  }, 30000);
});

describe("Temptations and Seduced", () => {
  it("a revealed Temptation attaches to your identity with its Forced Action and Alter-Ego Action", () => {
    let s = started();
    s = settle(reveal(s, KISS));
    const kiss = s.attachments.find((p) => p.code === KISS)!;
    expect(kiss.attachedTo).toBe("hero:p1");
    s.player.deck.unshift(makePiece(s, "01088"));
    s.player.hand.push(playerCard(s, "01089"));
    s = settle(command(s, { type: "ABILITY", id: kiss.id, action: "forced" }));
    // 1 charm counter; draw 1 and discard 1.
    expect(enchantment(s, "p1")!.counters).toBe(1);
    expect(s.player.hand).toHaveLength(1);
    s = settle(native(s, { type: "refill", actorId: "p1" }));
    s.player.form = "alter";
    expect(
      abilityOptions(
        s,
        s.attachments.find((p) => p.id === kiss.id)!,
      ).map((o) => o.id),
    ).toContain("shake-off");
    s = settle(
      command(s, { type: "ABILITY", id: kiss.id, action: "shake-off" }),
    );
    expect(s.attachments.some((p) => p.id === kiss.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === kiss.id)).toBe(true);
    exact(s);
  }, 30000);
  it("Love Concoction readies your identity; Alluring Call plays a card for 1 less", () => {
    let s = started();
    s = settle(reveal(s, LOVE));
    s.player.exhausted = true;
    const love = s.attachments.find((p) => p.code === LOVE)!;
    s = settle(command(s, { type: "ABILITY", id: love.id, action: "forced" }));
    expect(s.player.exhausted).toBe(false);
    expect(enchantment(s, "p1")!.counters).toBe(1);
    let t = started();
    t = settle(reveal(t, ALLURING));
    const call = t.attachments.find((p) => p.code === ALLURING)!;
    const helicarrier = playerCard(t, HELICARRIER);
    const resources = [playerCard(t, "01088"), playerCard(t, "01089")];
    t.player.hand.push(helicarrier, ...resources);
    t = command(t, { type: "ABILITY", id: call.id, action: "forced" });
    t = choose(t, helicarrier.id);
    // Helicarrier costs 3, 1 less.
    expect(t.prompt?.kind).toBe("payment");
    expect(t.prompt?.cost).toBe(2);
    t = settle(pay(t, resources));
    expect(t.player.inPlay.some((p) => p.id === helicarrier.id)).toBe(true);
    expect(enchantment(t, "p1")!.counters).toBe(1);
    exact(t);
  }, 30000);
  it("a Temptation's boost reveals it, attaching it to your identity", () => {
    let s = started();
    stack(s, KISS);
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.attachments.find((p) => p.code === KISS)!.attachedTo).toBe(
      "hero:p1",
    );
    exact(s);
  }, 30000);
  it("Seduced attaches to your identity and prevents basic attacks", () => {
    let s = started();
    s = settle(reveal(s, SEDUCED));
    const seduced = s.attachments.find((p) => p.code === SEDUCED)!;
    expect(seduced.attachedTo).toBe("hero:p1");
    expect(dispatch(reload(s), { type: "BASIC", action: "attack" }).error).toBe(
      "Seduced prevents basic attacks.",
    );
    exact(s);
  }, 30000);
});

describe("The villain, the main scheme and Future of Despair", () => {
  it("Enchantress (II) puts Future of Despair into play with 2 + 3 threat per player: stalwart, and no damage", () => {
    let s = started("standard", 2);
    s = settle(native(s, hit(s.villain.id, 30)));
    expect(s.villain.code).toBe("55002");
    const despair = s.sideSchemes.find((p) => p.code === DESPAIR)!;
    expect(despair.counters).toBe(10);
    expect(s.enchantress!.despair).toBeUndefined();
    const hp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 5)));
    expect(s.villain.hp).toBe(hp);
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBeFalsy();
    exact(s);
  }, 30000);
  it("Future of Despair revealed places a charm counter on each Enchantment", () => {
    let s = started("standard", 2);
    s.encounter.deck.unshift(s.enchantress!.despair!);
    s.enchantress!.despair = undefined;
    s = settle(reveal(s, DESPAIR));
    for (const seat of s.players)
      expect(enchantment(s, seat.id)!.counters).toBe(1);
    expect(s.sideSchemes.find((p) => p.code === DESPAIR)!.counters).toBe(4);
    exact(s);
  }, 30000);
  it("Sovereign Sorceress finds and reveals the Crown; with it in play, stuns each identity", () => {
    let s = started();
    s.scheme.threat = 100;
    s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.scheme.code).toBe(SOVEREIGN);
    const crown = s.attachments.find((p) => p.code === CROWN)!;
    expect(crown.attachedTo).toBe(s.villain.id);
    let t = started();
    attachTo(t, CROWN, t.villain.id);
    t.scheme.threat = 100;
    t = settle(native(t, { type: "threat", target: "main", amount: 1 }));
    expect(t.player.stunned).toBe(true);
    exact(t);
  }, 30000);
  it("completing Sovereign Sorceress loses", () => {
    let s = started();
    s.scheme.index = 1;
    s.scheme.code = SOVEREIGN;
    s.scheme.threat = 100;
    s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.phase).toBe("lost");
  }, 30000);
  it("the Crown: charm after Enchantress schemes, stalwart in Expert, and its Hero Action", () => {
    let s = started();
    attachTo(s, CROWN, s.villain.id);
    plainBoosts(s);
    s.player.form = "alter";
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(enchantment(s, "p1")!.counters).toBe(1);
    let t = started("expert");
    attachTo(t, CROWN, t.villain.id);
    t = settle(
      native(t, { type: "status", target: t.villain.id, status: "confused" }),
    );
    expect(t.villain.confused).toBeFalsy();
    let u = started();
    const crown = attachTo(u, CROWN, u.villain.id);
    const hp = u.player.hp;
    expect(abilityOptions(u, crown).some((o) => o.id === "crown")).toBe(true);
    u = settle(command(u, { type: "ABILITY", id: crown.id, action: "crown" }));
    expect(u.player.exhausted).toBe(true);
    expect(u.player.hp).toBe(hp - 1);
    expect(u.attachments.some((p) => p.id === crown.id)).toBe(false);
    exact(u);
  }, 30000);
});

describe("The Enchantress minions", () => {
  it("Enthralled Lackey charms you after attacking; its boost charms you or confuses you", () => {
    let s = started();
    const lackey = minion(s, LACKEY);
    s = settle(native(s, { type: "enemyAttack", id: lackey.id }));
    expect(enchantment(s, "p1")!.counters).toBe(1);
    let t = started();
    stack(t, LACKEY);
    t = native(t, { type: "enemyAttack", id: t.villain.id });
    t = settle(t, (s) =>
      s.prompt?.options.some((o) => o.id === "confuse") ? "confuse" : undefined,
    );
    expect(t.player.confused).toBe(true);
    exact(t);
  }, 30000);
  it("Enthralled Brute gets +3 hit points engaged with an Enthralled player", () => {
    const s = started();
    const brute = minion(s, BRUTE);
    expect(pieceHP(s, brute)).toBe(4);
    entrance(s, SLOTH_GAZE);
    expect(pieceHP(s, brute)).toBe(7);
  }, 30000);
  it("Sindr activates against a Defiant identity with indirect damage, or gains tough against an Enthralled one", () => {
    let s = started();
    plainBoosts(s);
    const hp = s.player.hp;
    s = settle(reveal(s, SINDR));
    expect(s.player.hp).toBeLessThan(hp);
    let t = started();
    entrance(t, SLOTH_GAZE);
    t = settle(reveal(t, SINDR));
    expect(t.minions.find((p) => p.code === SINDR)!.tough).toBe(true);
    exact(t);
  }, 30000);
  it("Ulik attacks the player who damages Enchantress; defeated, Enchantress attacks with +1 ATK", () => {
    let s = started();
    const ulik = minion(s, ULIK);
    plainBoosts(s, 4);
    const hp = s.player.hp;
    s = settle(native(s, hit(s.villain.id, 1)));
    // Ulik's 3 ATK.
    expect(s.player.hp).toBe(hp - 3);
    let t = started();
    const u = minion(t, ULIK);
    plainBoosts(t, 4);
    const before = t.player.hp;
    t = settle(native(t, hit(u.id, 5)));
    expect(t.minions.some((p) => p.id === u.id)).toBe(false);
    // Enchantress: 1 ATK + 1, plus the boost.
    expect(t.player.hp).toBeLessThan(before);
    expect(enchantment(t, "p1")!.counters).toBe(1);
    void ulik;
    exact(t);
  }, 30000);
  it("Ulik gains toughness in Expert", () => {
    let s = started("expert");
    s = settle(reveal(s, ULIK));
    expect(s.minions.find((p) => p.code === ULIK)!.tough).toBe(true);
  }, 30000);
});

describe("The Enchantress treacheries and side schemes", () => {
  it("Law of Attraction discards to the next Enthralled minion and reveals it", () => {
    let s = started();
    stack(s, SHARDS, BRUTE);
    s = settle(reveal(s, LAW));
    expect(s.minions.some((p) => p.code === BRUTE)).toBe(true);
    expect(s.encounter.discard.some((p) => p.code === SHARDS)).toBe(true);
    exact(s);
  }, 30000);
  it("Spellbound charms each Defiant player and makes each Enthralled player discard a card", () => {
    let s = started("standard", 2);
    entrance(s, SLOTH_GAZE, "p2");
    const support = makePiece(s, HELICARRIER);
    support.ownerId = "p2";
    seatView(s, "p2").player.inPlay.push(support);
    s = settle(reveal(s, SPELLBOUND));
    expect(enchantment(s, "p1")!.counters).toBe(1);
    expect(
      seatView(s, "p2").player.inPlay.some((p) => p.id === support.id),
    ).toBe(false);
    exact(s);
  }, 30000);
  it('"Do My Bidding": a Defiant identity chooses one, an Enthralled one does both', () => {
    let s = started();
    s = reveal(s, BIDDING);
    expect(optionIds(s)).toEqual(["minion", "scheme"]);
    s = settle(choose(s, "scheme"));
    expect(s.sideSchemes.length).toBeGreaterThan(0);
    let t = started();
    entrance(t, SLOTH_GAZE);
    t = reveal(t, BIDDING);
    expect(optionIds(t)).toEqual(["ab", "ba"]);
    t = settle(choose(t, "ab"));
    expect(t.minions.length).toBeGreaterThan(0);
    expect(t.sideSchemes.length).toBeGreaterThan(0);
    exact(t);
  }, 30000);
  it("Magical Restraints stuns or confuses you with a charm counter", () => {
    let s = started();
    s = settle(choose(reveal(s, RESTRAINTS), "stunned"));
    expect(s.player.stunned).toBe(true);
    expect(enchantment(s, "p1")!.counters).toBe(1);
    let t = started();
    entrance(t, SLOTH_GAZE);
    const threat = t.scheme.threat;
    t = settle(choose(reveal(t, RESTRAINTS), "ab"));
    expect(t.player.stunned).toBe(true);
    expect(t.player.confused).toBe(true);
    // An Enthralled hero's two charm counters become threat.
    expect(t.scheme.threat).toBe(threat + 2);
    exact(t);
  }, 30000);
  it("Spell Blast: Enchantress schemes or attacks you, with +1 in Expert", () => {
    let s = started();
    plainBoosts(s);
    const threat = s.scheme.threat;
    s = settle(choose(reveal(s, BLAST), "scheme"));
    expect(s.scheme.threat).toBeGreaterThan(threat);
    let t = started();
    plainBoosts(t);
    const hp = t.player.hp;
    t = settle(choose(reveal(t, BLAST), "attack"));
    expect(t.player.hp).toBeLessThan(hp);
    expect(enchantment(t, "p1")!.counters).toBe(1);
    exact(t);
  }, 30000);
  it("Spell Shards: 3 indirect damage, and a charm counter if your identity took any", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(reveal(s, SHARDS));
    expect(s.player.hp).toBe(hp - 3);
    expect(enchantment(s, "p1")!.counters).toBe(1);
    let t = started();
    t.player.tough = true;
    t = settle(reveal(t, SHARDS));
    expect(enchantment(t, "p1")!.counters).toBe(0);
    exact(t);
  }, 30000);
  it("Shards, Law and the Temptations as boosts charm you", () => {
    let s = started();
    stack(s, SHARDS);
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    // The boost and the attack's Forced Response.
    expect(enchantment(s, "p1")!.counters).toBe(2);
    exact(s);
  }, 30000);
});

describe("Trickster Magic", () => {
  it("Absorbing Man gets +X ATK from your highest-cost card and becomes Carl Creel's ally once defeated", () => {
    let s = started();
    const absorbing = minion(s, ABSORBING);
    own(s, HELICARRIER);
    expect(enemyStats(s, absorbing).attack).toBe(1 + 3);
    s = settle(native(s, hit(absorbing.id, 7)));
    expect(s.victoryDisplay!.some((p) => p.code === ABSORBING)).toBe(true);
    const creel = s.player.inPlay.find((p) => p.code === CREEL)!;
    expect(creel.ownerId).toBe("p1");
    expect(allyCount(s)).toBe(0);
    exact(s);
  }, 30000);
  it("the allies are Victory 0 and leave the game otherwise", () => {
    let s = started();
    const creel = take(s, CREEL);
    creel.ownerId = "p1";
    s.player.inPlay.push(creel);
    s = settle(native(s, hit(creel.id, 3, s.villain.id)));
    expect(s.victoryDisplay!.some((p) => p.id === creel.id)).toBe(true);
    let t = started();
    const mary = take(t, MARY);
    mary.ownerId = "p1";
    t.player.inPlay.push(mary);
    t = settle(native(t, N("discard", { id: mary.id })));
    expect(t.removed.some((p) => p.id === mary.id)).toBe(true);
    exact(t);
  }, 30000);
  it("Carl Creel exhausts an upgrade or support for +X to that use", () => {
    let s = started();
    const creel = take(s, CREEL);
    creel.ownerId = "p1";
    s.player.inPlay.push(creel);
    const helicarrier = own(s, HELICARRIER);
    const lackey = minion(s, LACKEY);
    s = command(s, { type: "ABILITY", id: creel.id, action: "attack" });
    s = settle(
      s,
      (s) =>
        s.prompt?.options.find((o) => o.id === lackey.id)?.id ||
        s.prompt?.options.find((o) => o.id === `creel:${helicarrier.id}`)?.id,
    );
    expect(
      s.player.inPlay.find((p) => p.id === helicarrier.id)!.exhausted,
    ).toBe(true);
    // 1 ATK + 3: the 3-hit-point Lackey is defeated.
    expect(s.minions.some((p) => p.id === lackey.id)).toBe(false);
    exact(s);
  }, 30000);
  it("Titania's attacks gain overkill; Mary MacPherran's gain overkill and piercing", () => {
    let s = started();
    const titania = minion(s, TITANIA);
    void titania;
    const mary = take(s, MARY);
    mary.ownerId = "p1";
    s.player.inPlay.push(mary);
    const lackey = minion(s, LACKEY);
    lackey.tough = true;
    const hp = s.villain.hp;
    s = command(s, { type: "ABILITY", id: mary.id, action: "attack" });
    s = settle(s, (s) => s.prompt?.options.find((o) => o.id === lackey.id)?.id);
    // Piercing removes tough; 3 ATK on 3 hit points, no excess.
    expect(s.minions.some((p) => p.id === lackey.id)).toBe(false);
    expect(s.villain.hp).toBe(hp);
    exact(s);
  }, 30000);
  it("Whirlwind: indirect damage per side scheme after attacking; his ally removes threat for ATK", () => {
    let s = started();
    const whirlwind = minion(s, WHIRLWIND);
    sideScheme(s, SPELLBOUND, 2);
    sideScheme(s, LAW, 2);
    plainBoosts(s);
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: whirlwind.id }));
    // 1 ATK and 2 indirect damage.
    expect(s.player.hp).toBe(hp - 3);
    let t = started();
    const cannon = take(t, CANNON);
    cannon.ownerId = "p1";
    t.player.inPlay.push(cannon);
    // Law of Attraction has no crisis icon.
    sideScheme(t, LAW, 2);
    const lackey = minion(t, LACKEY);
    const threat = t.scheme.threat;
    t = command(t, { type: "ABILITY", id: cannon.id, action: "attack" });
    t = settle(
      t,
      (s) =>
        s.prompt?.options.find((o) => o.id === lackey.id)?.id ||
        s.prompt?.options.find((o) => o.id === "whirlwind")?.id,
    );
    expect(t.scheme.threat).toBe(threat - 1);
    expect(t.sideSchemes.find((p) => p.code === LAW)!.counters).toBe(1);
    // 0 ATK + 2.
    expect(t.minions.find((p) => p.id === lackey.id)!.damage).toBe(2);
    exact(t);
  }, 30000);
  it("Zzzax discards your top 4 cards for indirect damage; his ally searches for an energy card", () => {
    let s = started();
    const energy = playerCard(s, "01088");
    s.player.deck.unshift(energy);
    const hp = s.player.hp;
    s = settle(reveal(s, ZZZAX));
    expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
    expect(s.player.hp).toBeLessThan(hp);
    let t = started();
    const e2 = playerCard(t, "01088");
    t.player.deck.unshift(e2);
    t = native(
      t,
      N("free", { code: ZZZAX_ALLY, playerId: "p1", actorId: "p1" }),
    );
    t = settle(t, (s) => s.prompt?.options.find((o) => o.id === e2.id)?.id);
    expect(t.player.inPlay.some((p) => p.code === ZZZAX_ALLY)).toBe(true);
    expect(t.player.hand.some((p) => p.id === e2.id)).toBe(true);
    exact(t);
  }, 30000);
  it("The Trickster Tango gives the villain stalwart; its boost gives the attack overkill", () => {
    let s = started();
    sideScheme(s, TANGO);
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBeFalsy();
    let t = started();
    const ally = own(t, MOCKINGBIRD);
    ally.damage = 2;
    stack(t, TANGO);
    const hp = t.player.hp;
    t = native(t, { type: "enemyAttack", id: t.villain.id });
    t = settle(t, (s) => s.prompt?.options.find((o) => o.id === ally.id)?.id);
    // Enchantress (I): 1 ATK + the Tango's boost icon on Mockingbird's last
    // hit point: overkill sends the excess 1 to the hero.
    expect(t.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(t.player.hp).toBe(hp - 1);
    exact(t);
  }, 30000);
  it("Puppet Master: allies cannot thwart it or defend against the villain; hinder in Expert", () => {
    let s = started("expert");
    s = settle(reveal(s, PUPPET));
    const puppet = s.sideSchemes.find((p) => p.code === PUPPET)!;
    // 2 fixed threat and hinder 1 per player.
    expect(puppet.counters).toBe(3);
    const ally = own(s, MOCKINGBIRD);
    s.scheme.threat = 2;
    // The main scheme is the ally's only target.
    const thwart = settle(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
    );
    expect(thwart.sideSchemes.find((p) => p.id === puppet.id)!.counters).toBe(
      3,
    );
    expect(thwart.scheme.threat).toBe(1);
    plainBoosts(s);
    const attacked = native(reload(s), {
      type: "enemyAttack",
      id: s.villain.id,
    });
    expect(attacked.prompt?.options.some((o) => o.id === ally.id)).toBe(false);
    exact(s);
  }, 30000);
  it("Love Triangle attaches to an ally you control, else surges; the ally cannot attack the villain", () => {
    let s = started();
    const ally = own(s, MOCKINGBIRD);
    s = settle(reveal(s, TRIANGLE));
    const triangle = s.attachments.find((p) => p.code === TRIANGLE)!;
    expect(triangle.attachedTo).toBe(ally.id);
    const lackey = minion(s, LACKEY);
    // The Lackey is the ally's only target.
    const hp = s.villain.hp;
    const attack = settle(
      command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
    );
    expect(attack.minions.find((p) => p.id === lackey.id)!.damage).toBe(1);
    expect(attack.villain.hp).toBe(hp);
    plainBoosts(s);
    const attacked = native(reload(s), {
      type: "enemyAttack",
      id: s.villain.id,
    });
    expect(attacked.prompt?.options.some((o) => o.id === ally.id)).toBe(false);
    // Its Alter-Ego Action: exhaust the ally and spend a mental resource.
    s.player.form = "alter";
    const mental = playerCard(s, "01089");
    s.player.hand.push(mental);
    s = command(s, { type: "ABILITY", id: triangle.id, action: "triangle" });
    s = settle(pay(s, [mental]));
    expect(s.attachments.some((p) => p.id === triangle.id)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === ally.id)!.exhausted).toBe(true);
    let t = started();
    const deck = t.encounter.deck.length;
    t = settle(reveal(t, TRIANGLE));
    expect(t.encounter.discard.some((p) => p.code === TRIANGLE)).toBe(true);
    // Surge: another encounter card.
    expect(t.encounter.deck.length).toBeLessThan(deck);
    exact(t);
  }, 30000);
});

describe("Expert and edge cases", () => {
  it("Enchantress (III) puts Future of Despair into play with 2 + 4 threat per player", () => {
    let s = started("expert");
    s = settle(native(s, hit(s.villain.id, 16)));
    expect(s.villain.code).toBe("55003");
    expect(s.sideSchemes.find((p) => p.code === DESPAIR)!.counters).toBe(6);
    exact(s);
  }, 30000);
  it("no damage to Enchantress under Future of Despair means no Ulik attack", () => {
    let s = started();
    minion(s, ULIK);
    const despair = s.enchantress!.despair!;
    s.enchantress!.despair = undefined;
    despair.counters = 2;
    s.sideSchemes.push(despair);
    const hp = s.player.hp;
    s = settle(native(s, hit(s.villain.id, 3)));
    expect(s.player.hp).toBe(hp);
    exact(s);
  }, 30000);
  it("Sindr schemes against a Defiant identity in alter-ego form", () => {
    let s = started();
    s.player.form = "alter";
    plainBoosts(s);
    const threat = s.scheme.threat;
    s = settle(reveal(s, SINDR));
    expect(s.scheme.threat).toBeGreaterThan(threat);
    exact(s);
  }, 30000);
  it("Titania's attacks gain overkill", () => {
    let s = started();
    const titania = minion(s, TITANIA);
    const ally = own(s, MOCKINGBIRD);
    ally.damage = 1;
    const hp = s.player.hp;
    s = native(s, { type: "enemyAttack", id: titania.id });
    s = settle(s, (s) => s.prompt?.options.find((o) => o.id === ally.id)?.id);
    // 3 ATK on Mockingbird's 2 remaining hit points: the excess 1 goes to
    // the hero.
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.hp).toBe(hp - 1);
    exact(s);
  }, 30000);
});

describe("Engine interactions", () => {
  it("Ulik's attack waits until the card being played finishes resolving", () => {
    let s = started();
    const ulik = minion(s, ULIK);
    plainBoosts(s, 4);
    const event = playerCard(s, "01088");
    s.resolving.push(event);
    const hp = s.player.hp;
    s = settle(native(s, hit(s.villain.id, 1)));
    expect(s.enchantress!.ulik).toEqual([{ id: ulik.id, playerId: "p1" }]);
    expect(s.player.hp).toBe(hp);
    s.resolving = s.resolving.filter((p) => p.id !== event.id);
    s.player.discard.push(event);
    s = settle(native(s, { type: "draw", amount: 0 }));
    expect(s.enchantress!.ulik).toEqual([]);
    // Ulik's 3 ATK.
    expect(s.player.hp).toBe(hp - 3);
    exact(s);
  }, 30000);
  it("an eliminated SP//dr's Enchantment is set aside again", () => {
    let s = settle(
      newGame({
        heroId: "captain_marvel",
        aspect: "aggression",
        villainId: "enchantress_villain",
        difficulty: "standard",
        seed: 55001,
        pacing: "expert",
        heroes: [
          { heroId: "captain_marvel", aspect: "aggression" },
          { heroId: "spdr", aspect: "protection" },
        ],
      }),
    );
    for (let i = 0; i < 2; i++)
      s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    entrance(s, SLOTH_GAZE, "p2");
    const gaze = enchantment(s, "p2")!;
    seatView(s, "p2").player.hp = 1;
    s = settle(native(s, hit("hero:p2", 9)));
    expect(s.players.find((p) => p.id === "p2")!.eliminated).toBe(true);
    expect(s.attachments.some((p) => p.id === gaze.id)).toBe(false);
    expect(s.enchantress!.gazes.find((p) => p.id === gaze.id)?.code).toBe(
      SLOTH_GAZE,
    );
  }, 30000);
});
