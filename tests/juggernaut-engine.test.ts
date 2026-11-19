/** NeXt Evolution: The Unstoppable Juggernaut with Hope Summers and the
 * Black Tom Cassidy modular set, exercised with the original physical
 * cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  heroStats,
  scenarioModules,
} from "../src/game/cards";
import {
  abilityOptions,
  allyCount,
  enemyStats,
  newGame,
} from "../src/game/engine";
import {
  BLACK_TOM_CODES,
  HOPE_SUMMERS_CODES,
  JUGGERNAUT_SCRIPT_CODES,
  jugImmune,
  jugKeyword,
} from "../src/game/juggernaut";
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

type Seat = {
  heroId: string;
  aspect: "aggression" | "justice" | "leadership" | "protection";
};
const team: Seat[] = [
  { heroId: "spider_man", aspect: "justice" },
  { heroId: "captain_marvel", aspect: "aggression" },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "juggernaut",
  modules?: string[],
  heroes = team,
) {
  return newGame({
    heroId: heroes[0].heroId,
    aspect: heroes[0].aspect,
    villainId,
    difficulty,
    seed: 40070,
    pacing: "expert",
    heroes: heroes.slice(0, players),
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
          [
            "none",
            "hero",
            "damage",
            "allow",
            "resolve",
            "done",
            "bonus",
          ].includes(o.id),
        )?.id ||
        s.prompt.options.find((o) => o.id !== "pay")?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
/** Settle choices until a payment prompt appears. */
function toPayment(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
) {
  for (let n = 0; s.prompt?.kind === "choice" && n < 200; n++)
    s = choose(
      reload(s),
      prefer?.(s) ||
        noDefense(s) ||
        passId(s) ||
        s.prompt.options.find((o) => o.id !== "pay")?.id ||
        s.prompt.options[0].id,
    );
  return s;
}
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "juggernaut",
  modules?: string[],
  heroes = team,
) {
  let s = settle(setup(difficulty, players, villainId, modules, heroes));
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
/** Decline the player interrupts offered before an encounter card's When
 * Revealed ability resolves. */
function resolveEncounter(s: GameState) {
  for (
    let n = 0;
    n < 5 &&
    s.prompt?.options.some((o) => o.id === "resolve") &&
    /interrupt available/i.test(s.prompt.text);
    n++
  )
    s = choose(s, "resolve");
  return s;
}
function stack(s: GameState, ...pieces: Piece[]) {
  s.encounter.deck.unshift(...pieces);
  delete s.encounter.knownTop;
}
/** An original encounter card with boost icons but no boost ability on top
 * of the encounter deck. */
function plain(s: GameState) {
  const i = s.encounter.deck.findIndex(
    (p) =>
      !card(p).boost_star &&
      (card(p).boost || 0) >= 1 &&
      card(p).type_code !== "minion",
  );
  const [p] = s.encounter.deck.splice(i, 1);
  stack(s, p);
  return card(p).boost || 0;
}
function fromDeck(s: GameState, code: string, playerId = s.activePlayerId) {
  const view = seatView(s, playerId).player;
  const i = view.deck.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.hand.push(p);
  return p;
}
function ally(s: GameState, code: string, playerId = s.activePlayerId) {
  const view = seatView(s, playerId).player;
  const i = view.deck.findIndex((p) => p.code === code);
  expect(i, code).toBeGreaterThanOrEqual(0);
  const p = view.deck.splice(i, 1)[0];
  view.inPlay.push(p);
  return p;
}
const hit = (target: string, amount: number, source = "hero"): Effect => ({
  type: "damage",
  target,
  amount,
  source,
});
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const helmet = (s: GameState) =>
  s.attachments.find((a) => a.code.startsWith("40122"))!;
const hope = (s: GameState) =>
  s.players
    .flatMap((seat) => seatView(s, seat).player.inPlay)
    .find((p) => p.code === "40130");
const atk = (s: GameState) => enemyStats(s, s.villain).attack;
/** Take the Helmet off: momentum counters removed, Juggernaut Exposed. */
function expose(s: GameState) {
  helmet(s).code = "40122b";
  s.villain.counters = 0;
  return reload(s);
}
/** Discard Juggernaut's tough status cards. */
function untough(s: GameState) {
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return reload(s);
}

describe("The Unstoppable Juggernaut: original source", () => {
  it("registers every face of the Juggernaut, Hope Summers and Black Tom Cassidy sets", () => {
    const faces = (set: string) =>
      CATALOG_CARDS.filter(
        (c) => c.pack_code === "next_evol" && c.set_code === set,
      ).map((c) => c.code);
    expect(new Set(JUGGERNAUT_SCRIPT_CODES)).toEqual(
      new Set(faces("juggernaut")),
    );
    expect(new Set(HOPE_SUMMERS_CODES)).toEqual(new Set(faces("hope_summers")));
    expect(new Set(BLACK_TOM_CODES)).toEqual(
      new Set(faces("black_tom_cassidy")),
    );
    for (const code of [
      ...JUGGERNAUT_SCRIPT_CODES,
      ...HOPE_SUMMERS_CODES,
      ...BLACK_TOM_CODES,
    ])
      expect(hasExecutableScript(code), code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "juggernaut")).toMatchObject({
      codes: ["40118", "40119", "40120"],
      schemes: ["40121b"],
      module: "black_tom_cassidy",
      fixedSets: ["hope_summers"],
    });
    expect(MODULES.at(-5)?.id).toBe("black_tom_cassidy");
    expect(scenarioModules("juggernaut").map((m) => m.id)).toContain(
      "black_tom_cassidy",
    );
  });

  it("starts with the Helmet on Juggernaut, a momentum counter and a tough status card, and Hope Summers beside the first player", () => {
    for (const [difficulty, code] of [
      ["standard", "40118"],
      ["expert", "40119"],
    ] as const)
      for (const players of [1, 2]) {
        const s = started(difficulty, players);
        expect(s.villain.code).toBe(code);
        expect(s.villain.hp).toBe(card(code).health! * players);
        expect(helmet(s)).toMatchObject({
          code: "40122a",
          attachedTo: s.villain.id,
        });
        expect(s.villain.counters).toBe(1);
        expect(s.villain.tough).toBe(true);
        expect(s.scheme).toMatchObject({ code: "40121b", threat: players });
        // Hope Summers is under the first player's control, outside the
        // ally limit.
        const first = seatView(s, s.firstPlayerId).player;
        expect(first.inPlay.filter((p) => p.code === "40130")).toHaveLength(1);
        // The setup cards are single physical cards outside the deck.
        const owned = [
          ...s.attachments,
          ...s.encounter.deck,
          ...s.encounter.discard,
          ...s.players.flatMap((seat) => seatView(s, seat).player.inPlay),
        ];
        for (const setupCode of ["40122a", "40122b", "40130"])
          expect(
            owned.filter((p) => p.code.startsWith(setupCode.slice(0, 5)))
              .length,
            setupCode,
          ).toBeLessThanOrEqual(1);
        expect(s.encounter.deck.some((p) => p.code === "40131")).toBe(true);
        expect(s.encounter.deck.some((p) => p.code === "40130")).toBe(false);
      }
  });
});

describe("Juggernaut", () => {
  it("gets +1 ATK for each momentum counter, and the Helmet gives stalwart and overkill", () => {
    let s = started();
    const printed = card(s.villain).attack!;
    expect(atk(s)).toBe(printed + 1);
    s.villain.counters = 3;
    s = reload(s);
    expect(atk(s)).toBe(printed + 3);
    expect(jugKeyword(s, s.villain, "Stalwart")).toBe(1);
    expect(jugKeyword(s, s.villain, "Overkill")).toBe(1);
    s = expose(s);
    expect(jugKeyword(s, s.villain, "Stalwart")).toBe(0);
  });

  it("the Helmet's Hero Action spends 3 resources of one type to remove the momentum counters and expose him", () => {
    let s = started();
    const physical = s.player.deck
      .filter((p) => (card(p).resource_physical || 0) > 0)
      .slice(0, 3);
    expect(physical).toHaveLength(3);
    for (const p of physical) fromDeck(s, p.code);
    s.villain.counters = 2;
    s = reload(s);
    s = command(s, {
      type: "ABILITY",
      id: helmet(s).id,
      action: "helmet-physical",
    });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(pay(s, physical));
    expect(helmet(s).code).toBe("40122b");
    expect(s.villain.counters).toBe(0);
  });

  it("Juggernaut Exposed: 1 more damage from a card with a printed mental resource; after he schemes he gains momentum and the Helmet goes back on", () => {
    let s = untough(expose(started()));
    const mental = fromDeck(s, "01004");
    s = reload(s);
    const hp = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 2, mental.id)));
    expect(hp - s.villain.hp).toBe(3);
    const before = s.villain.hp;
    s = settle(native(s, hit(s.villain.id, 2)));
    expect(before - s.villain.hp).toBe(2);
    plain(s);
    s = settle(
      native(reload(s), {
        type: "enemyScheme",
        id: s.villain.id,
        actorId: "p1",
      }),
    );
    expect(helmet(s).code).toBe("40122a");
    expect(s.villain.counters).toBe(1);
  });

  it("Juggernaut (II) flips Juggernaut Exposed back instead of taking a tough status card", () => {
    let s = untough(expose(started()));
    s = settle(native(s, hit(s.villain.id, s.villain.hp)));
    expect(s.villain.code).toBe("40119");
    expect(helmet(s).code).toBe("40122a");
    expect(s.villain.tough).toBe(false);
    expect(s.villain.counters).toBe(1);
  });

  it("The Unstoppable Juggernaut never completes: its threat goes, he gains momentum and attacks each player, even in alter-ego form", () => {
    let s = started("standard", 2);
    for (const seat of s.players) seatView(s, seat).player.form = "alter";
    s = reload(s);
    const hp = s.players.map((seat) => seatView(s, seat).player.hp);
    s.scheme.threat = s.scheme.threat + 13;
    s = settle(
      native(reload(s), { type: "threat", target: "main", amount: 1 }),
    );
    expect(s.phase).not.toBe("lost");
    expect(s.scheme.threat).toBe(0);
    expect(s.villain.counters).toBe(2);
    s.players.forEach((seat, i) =>
      expect(seatView(s, seat).player.hp, seat.id).toBeLessThan(hp[i]),
    );
  });
});

describe("Juggernaut encounter cards", () => {
  it("Head of Steam attaches with a momentum counter and gives retaliate X", () => {
    let s = started();
    s = settle(reveal(s, "40123"));
    expect(s.attachments.find((a) => a.code === "40123")?.attachedTo).toBe(
      s.villain.id,
    );
    expect(s.villain.counters).toBe(2);
    expect(jugKeyword(s, s.villain, "Retaliate")).toBe(2);
  });

  it("Breakthrough deals damage equal to Juggernaut's ATK", () => {
    let s = started();
    const hp = s.player.hp;
    const damage = atk(s);
    s = reveal(s, "40125");
    s = resolveEncounter(s);
    s = settle(choose(s, "damage"));
    expect(hp - s.player.hp).toBe(damage);
  });

  it("Flatten can place a momentum counter instead", () => {
    let s = started();
    s = reveal(s, "40126");
    s = resolveEncounter(s);
    s = settle(choose(s, "momentum"));
    expect(s.villain.counters).toBe(2);
  });

  it("Ground Pound deals indirect damage equal to Juggernaut's ATK", () => {
    let s = started();
    const hp = s.player.hp;
    const damage = atk(s);
    s = settle(
      resolveEncounter(reveal(s, "40127")),
      (v) => v.prompt?.options.find((o) => o.id === "hero")?.id,
    );
    const hopeDamage = hope(s)?.damage || 0;
    expect(hp - s.player.hp + hopeDamage).toBe(damage);
  });

  it("Trample: in alter-ego form you take 2 indirect damage", () => {
    let s = started();
    s.player.form = "alter";
    s = reload(s);
    const hp = s.player.hp;
    s = settle(
      resolveEncounter(reveal(s, "40128")),
      (v) => v.prompt?.options.find((o) => o.id === "hero")?.id,
    );
    expect(hp - s.player.hp + (hope(s)?.damage || 0)).toBe(2);
  });

  it("Cyttorak's Exemplar places threat equal to Juggernaut's ATK, or flips Juggernaut Exposed with a momentum counter", () => {
    let s = started();
    const threat = s.scheme.threat;
    const damage = atk(s);
    s = settle(resolveEncounter(reveal(s, "40129")));
    expect(s.scheme.threat - threat).toBe(damage);
    s = expose(s);
    s = settle(resolveEncounter(reveal(s, "40129")));
    expect(helmet(s).code).toBe("40122a");
    expect(s.villain.counters).toBe(1);
  });

  it("Cyttorak's Exemplar gains incite 1 in expert mode", () => {
    let s = started("expert");
    const threat = s.scheme.threat;
    const damage = atk(s);
    s = settle(resolveEncounter(reveal(s, "40129")));
    expect(s.scheme.threat - threat).toBe(damage + 1);
  });
});

describe("Hope Summers", () => {
  it("uses her controller's hero ATK and THW and does not count against the ally limit", () => {
    const s = started();
    const p = hope(s)!;
    expect(p).toBeTruthy();
    expect(allyCount(s)).toBe(0);
    const stats = heroStats(s);
    const labels = abilityOptions(s, p).map((o) => o.label);
    expect(labels).toContain(`Attack ${stats.attack}`);
    expect(labels).toContain(`Thwart ${stats.thwart}`);
  });

  it("Captive Hope exhausts her, and she cannot ready while it is in play", () => {
    let s = started();
    s = settle(resolveEncounter(reveal(s, "40131")));
    expect(hope(s)?.exhausted).toBe(true);
    // A ready effect leaves her exhausted.
    s = settle(native(s, { type: "ready", id: hope(s)!.id }));
    expect(hope(s)?.exhausted).toBe(true);
  });

  it("the players lose if Hope Summers leaves play", () => {
    let s = started();
    s = settle(native(s, hit(hope(s)!.id, 5)));
    expect(s.phase).toBe("lost");
  });
});

describe("Black Tom Cassidy", () => {
  it("brings a Creeping Willow, and cannot take damage while one is in play", () => {
    let s = started("standard", 1, "rhino", ["black_tom_cassidy"]);
    s = settle(resolveEncounter(reveal(s, "40132")));
    const tom = s.minions.find((m) => m.code === "40132")!;
    expect(tom).toBeTruthy();
    expect(s.minions.filter((m) => m.code === "40133")).toHaveLength(1);
    expect(jugImmune(s, tom.id)).toBe(true);
    s = settle(native(s, hit(tom.id, 2)));
    expect(s.minions.find((m) => m.id === tom.id)?.damage || 0).toBe(0);
  });

  it("Creeping Willow stuns the character it damages", () => {
    let s = started("standard", 1, "rhino", ["black_tom_cassidy"]);
    const willow = take(s, "40133");
    willow.engagedWith = "p1";
    s.minions.push(willow);
    s = settle(
      native(reload(s), { type: "enemyAttack", id: willow.id, actorId: "p1" }),
    );
    expect(s.player.stunned).toBe(true);
  });

  it("Making Green gives each Creeping Willow surge", () => {
    let s = started("standard", 1, "rhino", ["black_tom_cassidy"]);
    s = settle(resolveEncounter(reveal(s, "40134")));
    expect(s.sideSchemes.some((p) => p.code === "40134")).toBe(true);
    const willow = take(s, "40133");
    const deck = s.encounter.deck.length;
    s = settle(
      resolveEncounter(
        native(s, { type: "reveal", piece: willow, actorId: "p1" }),
      ),
    );
    expect(s.minions.some((m) => m.id === willow.id)).toBe(true);
    // Surge: another encounter card is revealed.
    expect(s.encounter.deck.length).toBe(deck - 1);
  });

  it("A Sound Thrashing reveals a Creeping Willow when none attacked you", () => {
    let s = started("standard", 1, "rhino", ["black_tom_cassidy"]);
    s = settle(resolveEncounter(reveal(s, "40135")));
    expect(s.minions.filter((m) => m.code === "40133")).toHaveLength(1);
  });
});
