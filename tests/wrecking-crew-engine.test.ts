/** The Wrecking Crew scenario pack (Breakout): four villains, four signature
 * side schemes and four encounter decks, exercised with the original
 * physical cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { enemyStats, newGame, targets } from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  CREW_KEYS,
  CREW_VILLAINS,
  WRECKING_CREW_SCRIPT_CODES,
  crewDeckOwner,
  crewScheme,
  crewVillain,
  type CrewKey,
} from "../src/game/wrecking-crew";
import type { GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  put,
  reload,
} from "./dv-test-helpers";

const players3 = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "the_wrecking_crew",
    difficulty,
    seed: 7001,
    pacing: "expert",
    heroes: players3.slice(0, players),
  });
}
const noDefense = (s: GameState) =>
  s.prompt?.options.find((o) => /take|no defender|undefended/i.test(o.label))
    ?.id;
function settle(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
  untilPayment = false,
) {
  for (let n = 0; s.prompt && n < 150; n++) {
    if (untilPayment && s.prompt.kind === "payment") return s;
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
/** Started table: hands go back into the decks and every identity is a
 * hero. */
function started(difficulty: "standard" | "expert" = "standard", players = 1) {
  let s = settle(setup(difficulty, players));
  for (let i = 0; i < players; i++)
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    p.form = "hero";
    p.deck.push(...p.hand.splice(0));
  }
  return reload(s);
}
const crew = (s: GameState) => s.wreckingCrew!;
const villain = (s: GameState, key: CrewKey) => crewVillain(s, key)!;
const scheme = (s: GameState, key: CrewKey) => crewScheme(s, key)!;
const threats = (s: GameState) =>
  CREW_KEYS.map((key) => crewScheme(s, key)?.counters ?? null);
function zones(s: GameState): Piece[][] {
  const wc = crew(s);
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
    [s.villain],
    CREW_KEYS.map((key) => wc.bench[key]).filter(
      (v): v is GameState["villain"] => !!v,
    ),
    ...CREW_KEYS.flatMap((key) => [
      wc.decks[key]?.deck || [],
      wc.decks[key]?.discard || [],
    ]),
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** The four villains, four side schemes and sixty encounter cards each stay
 * in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).pack_code === "twc")).toHaveLength(68);
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of zones(s)) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original card ${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
/** Put these cards on top of a villain's encounter deck. */
function stack(s: GameState, key: CrewKey, ...codes: string[]) {
  const pieces = codes.map((code) => take(s, code));
  const wc = crew(s);
  if (wc.deckOwner === key) {
    s.encounter.deck.unshift(...pieces);
    delete s.encounter.knownTop;
  } else (wc.decks[key] ||= { deck: [], discard: [] }).deck.unshift(...pieces);
}
function attachTo(s: GameState, code: string, hostId: string) {
  const p = take(s, code);
  p.attachedTo = hostId;
  s.attachments.push(p);
  return p;
}
function activate(
  s: GameState,
  key: CrewKey,
  kind: "attack" | "scheme",
  prefer?: (s: GameState) => string | undefined,
) {
  return settle(
    native(s, {
      type: "crew:activate",
      key,
      kind,
      playerId: s.activePlayerId,
    }),
    prefer,
  );
}
const heroDefends = (s: GameState) =>
  s.prompt?.options.find((o) => /^Defend with Spider-Man/.test(o.label))?.id;
const cardsIn = (pieces: Piece[]) => pieces.map((p) => p.code);

describe("The Wrecking Crew original source", () => {
  it("registers every face and uses no modular set", () => {
    for (const c of CATALOG_CARDS.filter((c) => c.pack_code === "twc")) {
      expect(WRECKING_CREW_SCRIPT_CODES as readonly string[]).toContain(c.code);
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    }
    expect(WRECKING_CREW_SCRIPT_CODES).toHaveLength(60);
    expect(VILLAINS.find((v) => v.id === "the_wrecking_crew")).toMatchObject({
      codes: ["07002", "07003"],
      schemes: ["07001b"],
      moduleCount: 0,
    });
    expect(scenarioModules("the_wrecking_crew")).toEqual([]);
    expect(() =>
      newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "the_wrecking_crew",
        modules: ["bomb_scare"],
      }),
    ).toThrow(/0 distinct modular/);
  });
  it.each([1, 2, 3])(
    "sets up four villains, their side schemes and four 15-card decks for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        const version = difficulty === "expert" ? 1 : 0;
        for (const key of CREW_KEYS) {
          const v = villain(s, key);
          expect(v.code).toBe(CREW_VILLAINS[key][version]);
          expect([v.hp, v.maxHp]).toEqual([
            card(v.code).health! * players,
            card(v.code).health! * players,
          ]);
        }
        expect(crew(s)).toMatchObject({ active: "wrecker", focus: "wrecker" });
        expect(s.villain.code).toBe(CREW_VILLAINS.wrecker[version]);
        // Fixed starting threat, put into play rather than revealed.
        expect(threats(s)).toEqual([6, 5, 3, 4]);
        expect(s.scheme).toMatchObject({ code: "07001b", threat: 0 });
        expect(s.modules).toEqual([]);
        // The native encounter deck is Wrecker's; each other villain keeps
        // his own deck of fifteen cards.
        expect(s.encounter.deck).toHaveLength(15);
        expect(
          s.encounter.deck.every((p) => crewDeckOwner(p.code) === "wrecker"),
        ).toBe(true);
        for (const key of CREW_KEYS.slice(1)) {
          expect(crew(s).decks[key]!.deck).toHaveLength(15);
          expect(
            crew(s).decks[key]!.deck.every(
              (p) => crewDeckOwner(p.code) === key,
            ),
          ).toBe(true);
        }
        // No Standard or Expert set, no obligations and no nemesis cards.
        expect(
          zones(s)
            .flat()
            .filter(
              (p) =>
                card(p).faction_code === "encounter" &&
                card(p).pack_code !== "twc",
            ),
        ).toEqual([]);
        exact(reload(s));
      }
    },
  );
});

describe("The active villain", () => {
  it("Breakout places 1 threat on each side scheme after step one and moves the active counter to the most threat", () => {
    let s = started("standard", 2);
    scheme(s, "thunderball").counters = 8;
    s = settle(native(s, { type: "villainStepOne" }));
    // Escalation is a fixed 1 threat.
    expect(s.scheme.threat).toBe(1);
    expect(threats(s)).toEqual([7, 9, 4, 5]);
    expect(crew(s).active).toBe("thunderball");
    expect(s.villain.id).toBe(villain(s, "thunderball").id);
    // The encounter deck follows the active counter.
    expect(
      s.encounter.deck.every((p) => crewDeckOwner(p.code) === "thunderball"),
    ).toBe(true);
    expect(crew(s).decks.wrecker!.deck).toHaveLength(15);
    exact(s);
  });
  it("the first player breaks a tie for the most threat", () => {
    let s = started();
    scheme(s, "thunderball").counters = 6;
    s = native(s, { type: "villainStepOne" });
    expect(s.prompt?.title).toBe("Breakout");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([
      "wrecker",
      "thunderball",
    ]);
    s = settle(choose(s, "thunderball"));
    expect(crew(s).active).toBe("thunderball");
  });
  it("only the active villain activates, and his threat goes on his own side scheme", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(native(s, { type: "villainActivate" }));
    expect(threats(s)).toEqual([8, 5, 3, 4]);
    expect(s.scheme.threat).toBe(0);
  });
  it("encounter cards come from the active villain's deck and return to their own discard pile", () => {
    let s = started();
    const top = s.encounter.deck[0];
    s = settle(native(s, { type: "dealEncounter" }));
    expect(s.encounter.dealt.map((p) => p.id)).toEqual([top.id]);
    // A Wrecker card revealed while Bulldozer is active goes back to
    // Wrecker's discard pile.
    s = settle(native(s, { type: "crew:set-active", key: "bulldozer" }));
    expect(crew(s).deckOwner).toBe("bulldozer");
    s = settle(reveal(s, "07016"));
    expect(cardsIn(crew(s).decks.wrecker!.discard)).toContain("07016");
    expect(cardsIn(s.encounter.discard)).not.toContain("07016");
    exact(s);
  });
  it("an empty encounter deck reshuffles its own discard pile with an acceleration token", () => {
    let s = started();
    s.encounter.discard.push(...s.encounter.deck.splice(0));
    s = settle(native(s, { type: "dealEncounter" }));
    expect(s.encounter.acceleration).toBe(1);
    expect(s.encounter.deck).toHaveLength(14);
    exact(s);
  });
});

describe("Signature side schemes", () => {
  it("Hard Hitter deals 2 damage to each friendly character at 10 threat", () => {
    let s = started();
    const ally = put(s, "01058");
    scheme(s, "wrecker").counters = 9;
    const hp = s.player.hp;
    s = settle(
      native(s, { type: "threat", target: scheme(s, "wrecker").id, amount: 1 }),
    );
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(2);
    expect(scheme(s, "wrecker").counters).toBe(3);
  });
  it("Gamma Blast stuns each friendly character at 10 threat", () => {
    let s = started();
    const ally = put(s, "01002");
    scheme(s, "thunderball").counters = 9;
    s = settle(
      native(s, {
        type: "threat",
        target: scheme(s, "thunderball").id,
        amount: 2,
      }),
    );
    expect(s.player.stunned).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.stunned).toBe(true);
    expect(scheme(s, "thunderball").counters).toBe(3);
  });
  it("Pile Drive discards each player's highest-cost upgrade or support at 10 threat", () => {
    let s = started();
    put(s, "01006");
    const webbed = put(s, "01009");
    scheme(s, "piledriver").counters = 9;
    s = settle(
      native(s, {
        type: "threat",
        target: scheme(s, "piledriver").id,
        amount: 1,
      }),
    );
    expect(cardsIn(s.player.inPlay)).toContain("01006");
    expect(s.player.discard.map((p) => p.id)).toContain(webbed.id);
    expect(scheme(s, "piledriver").counters).toBe(3);
  });
  it("Charge! makes each player discard the top 10 cards of their deck at 10 threat", () => {
    let s = started("standard", 2);
    const decks = s.players.map((seat) => seatView(s, seat).player.deck.length);
    scheme(s, "bulldozer").counters = 9;
    s = settle(
      native(s, {
        type: "threat",
        target: scheme(s, "bulldozer").id,
        amount: 1,
      }),
    );
    expect(
      s.players.map((seat) => seatView(s, seat).player.deck.length),
    ).toEqual(decks.map((n) => n - 10));
    expect(scheme(s, "bulldozer").counters).toBe(3);
  });
  it("Breakout resolves completely before the Forced Responses it triggers", () => {
    let s = started();
    scheme(s, "wrecker").counters = 9;
    scheme(s, "thunderball").counters = 8;
    s = settle(native(s, { type: "villainStepOne" }));
    // Day of Reckoning reached 10 and had the most threat when the active
    // counter moved; only then did Hard Hitter remove all but 3.
    expect(crew(s).active).toBe("wrecker");
    expect(threats(s)).toEqual([3, 9, 4, 5]);
  });
  it("a signature side scheme stays in play without threat and leaves with its villain", () => {
    let s = started();
    const pile = scheme(s, "piledriver");
    s = settle(native(s, { type: "thwart", target: pile.id, amount: 5 }));
    expect(scheme(s, "piledriver").counters).toBe(0);
    s = settle(
      native(s, {
        type: "damage",
        target: villain(s, "piledriver").id,
        amount: 99,
      }),
    );
    expect(crewScheme(s, "piledriver")).toBeUndefined();
    expect(s.removed.map((p) => p.id)).toContain(pile.id);
    exact(s);
  });
});

describe("Defeating the Wrecking Crew", () => {
  it("a hero can attack a villain out of focus with the basic power, and Piledriver retaliates", () => {
    let s = started();
    const pile = villain(s, "piledriver");
    s = command(s, { type: "BASIC", action: "attack" });
    expect(s.prompt?.options.map((o) => o.id)).toEqual(
      expect.arrayContaining(CREW_KEYS.map((key) => villain(s, key).id)),
    );
    const hp = s.player.hp;
    s = settle(choose(s, pile.id));
    expect(villain(s, "piledriver").hp).toBe(pile.hp - 2);
    expect(s.player.hp).toBe(hp - 1);
    expect(s.villain.id).toBe(villain(s, "wrecker").id);
  });
  it("a defeated villain leaves play with his side scheme and his attachments; the active counter stays", () => {
    let s = started();
    const ball = attachTo(s, "07020", villain(s, "thunderball").id);
    const hostage = attachTo(s, "07005", scheme(s, "thunderball").id);
    s = settle(
      native(s, {
        type: "damage",
        target: villain(s, "thunderball").id,
        amount: 99,
      }),
    );
    expect(crew(s).defeated).toEqual(["thunderball"]);
    expect(crewVillain(s, "thunderball")).toBeUndefined();
    expect(crewScheme(s, "thunderball")).toBeUndefined();
    expect(crew(s).decks.thunderball!.discard.map((p) => p.id)).toContain(
      ball.id,
    );
    // Held Hostage leaves with the scheme, to Wrecker's discard pile.
    expect(s.attachments.some((p) => p.id === hostage.id)).toBe(false);
    expect(crew(s).decks.wrecker?.discard.map((p) => p.id) ?? []).not.toContain(
      ball.id,
    );
    expect(
      [...s.encounter.discard, ...(crew(s).decks.wrecker?.discard || [])].map(
        (p) => p.id,
      ),
    ).toContain(hostage.id);
    expect(crew(s).active).toBe("wrecker");
    expect(s.villain.id).toBe(villain(s, "wrecker").id);
    // Its villain is no longer a target.
    expect(targets(s, "enemy", true).map((t) => t.id)).not.toContain(
      ball.attachedTo,
    );
    exact(s);
  });
  it("when the active villain is defeated the active counter moves to the most threat", () => {
    let s = started();
    scheme(s, "bulldozer").counters = 8;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
    expect(crew(s).active).toBe("bulldozer");
    expect(s.villain.id).toBe(villain(s, "bulldozer").id);
    expect(
      s.encounter.deck.every((p) => crewDeckOwner(p.code) === "bulldozer"),
    ).toBe(true);
    exact(s);
  });
  it("the players win when all four villains are defeated", () => {
    let s = started();
    for (const key of CREW_KEYS) {
      expect(s.phase).not.toBe("won");
      s = settle(
        native(s, { type: "damage", target: villain(s, key).id, amount: 99 }),
      );
    }
    expect(s.phase).toBe("won");
  });
  it("the players lose when Breakout is completed", () => {
    let s = started("standard", 2);
    s = settle(native(s, { type: "threat", target: "main", amount: 12 }));
    expect(s.phase).toBe("lost");
  });
});

describe("The four villains", () => {
  it("Wrecker gets +2 ATK when his attack is undefended", () => {
    let s = started();
    let hp = s.player.hp;
    stack(s, "wrecker", "07013");
    s = activate(s, "wrecker", "attack");
    // 2 ATK + 2 undefended + 1 boost.
    expect(s.player.hp).toBe(hp - 5);
    hp = s.player.hp;
    s.player.exhausted = false;
    stack(s, "wrecker", "07013");
    s = activate(s, "wrecker", "attack", heroDefends);
    expect(s.player.hp).toBe(hp - Math.max(0, 3 - 3));
  });
  it("Thunderball deals 1 damage to each character you control after he attacks you", () => {
    let s = started();
    const ally = put(s, "01002");
    stack(s, "wrecker", "07013");
    const hp = s.player.hp;
    s = activate(s, "thunderball", "attack");
    // 1 ATK + 1 boost, then 1 more to each character.
    expect(s.player.hp).toBe(hp - 3);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("Bulldozer's attacks gain overkill", () => {
    let s = started();
    const ally = put(s, "01002");
    stack(s, "wrecker", "07013");
    const hp = s.player.hp;
    s = activate(
      s,
      "bulldozer",
      "attack",
      (v) => v.prompt?.options.find((o) => o.id === ally.id)?.id,
    );
    // 3 ATK + 1 boost against Black Cat's 2 hit points: 2 excess.
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.hp).toBe(hp - 2);
  });
});

describe("Encounter cards", () => {
  it("Held Hostage attaches to the active villain's side scheme, stops thwarting and makes its villain attack", () => {
    let s = started();
    s = settle(reveal(s, "07036"));
    const day = scheme(s, "wrecker");
    const hostage = s.attachments.find((p) => p.code === "07036")!;
    expect(hostage.attachedTo).toBe(day.id);
    expect(targets(s, "scheme").map((t) => t.id)).not.toContain(day.id);
    s = settle(native(s, { type: "thwart", target: day.id, amount: 3 }));
    expect(scheme(s, "wrecker").counters).toBe(6);
    // Hero Action: the corresponding villain attacks you; then discard.
    stack(s, "wrecker", "07013");
    const hp = s.player.hp;
    s = settle(
      command(s, { type: "ABILITY", id: hostage.id, action: "hostage" }),
    );
    expect(s.player.hp).toBe(hp - 5);
    expect(s.attachments.some((p) => p.id === hostage.id)).toBe(false);
    expect(cardsIn(crew(s).decks.piledriver!.discard)).toContain("07036");
    exact(s);
  });
  it("Magic Crowbar attaches to Wrecker, places threat after he attacks and leaves through its Hero Action", () => {
    let s = started();
    s = settle(reveal(s, "07006"));
    const crowbar = s.attachments.find((p) => p.code === "07006")!;
    expect(crowbar.attachedTo).toBe(villain(s, "wrecker").id);
    expect(enemyStats(s, s.villain).attack).toBe(3);
    stack(s, "wrecker", "07013");
    s = activate(s, "wrecker", "attack");
    // The side scheme with the least threat is Pile It On!.
    expect(threats(s)).toEqual([6, 5, 4, 4]);
    s.player.exhausted = false;
    s = settle(
      command(s, { type: "ABILITY", id: crowbar.id, action: "remove" }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.attachments.some((p) => p.id === crowbar.id)).toBe(false);
  });
  it("Wrecker's Command places 1 threat on each other villain's side scheme after he schemes", () => {
    let s = started();
    s = settle(reveal(s, "07007"));
    expect(enemyStats(s, s.villain).scheme).toBe(3);
    s.player.form = "alter";
    stack(s, "wrecker", "07013");
    s = activate(s, "wrecker", "scheme");
    // 2 SCH + 1 Command + 1 boost brings Day of Reckoning to 10: Hard Hitter
    // leaves 3. Each other villain's side scheme gets 1.
    expect(threats(s)).toEqual([3, 6, 4, 5]);
  });
  it("Escaped Convict's boost moves the active counter and that villain attacks after the attack without a boost", () => {
    let s = started();
    stack(s, "wrecker", "07009", "07013");
    const hp = s.player.hp;
    s = activate(s, "wrecker", "attack");
    expect(crew(s).active).toBe("piledriver");
    // Wrecker 2 + 2 undefended (boost star, no icons), then Piledriver 2
    // + 0 undefended with no boost card.
    expect(s.player.hp).toBe(hp - 6);
    exact(s);
  });
  it("Buddy System reveals the top card of the deck of the villain whose side scheme has the least threat", () => {
    let s = started();
    stack(s, "piledriver", "07043");
    s = settle(reveal(s, "07010"));
    expect(s.player.confused).toBe(true);
    expect(cardsIn(crew(s).decks.piledriver!.discard)).toContain("07043");
    exact(s);
  });
  it("Buddy System reveals two cards when that villain is the only one in play", () => {
    let s = started();
    for (const key of ["thunderball", "piledriver", "bulldozer"] as const)
      s = settle(
        native(s, { type: "damage", target: villain(s, key).id, amount: 99 }),
      );
    stack(s, "wrecker", "07016", "07016");
    const hp = s.player.hp;
    s = settle(reveal(s, "07039"));
    expect(s.player.hp).toBe(hp - 2);
  });
  it("Chaos in the Prison gains surge without upgrades, or offers a discard or 1 threat per upgrade", () => {
    let s = started();
    s = settle(reveal(s, "07011"));
    expect(s.encounter.dealt).toHaveLength(1);
    put(s, "01008");
    put(s, "01009");
    s = reveal(s, "07026");
    expect(s.prompt?.title).toBe("Chaos in the Prison");
    s = settle(choose(s, "threat"));
    expect(threats(s)).toEqual([8, 5, 3, 4]);
  });
  it("Crowbar Toss makes Wrecker attack, then moves the active counter to the least threat", () => {
    let s = started();
    stack(s, "wrecker", "07013");
    const hp = s.player.hp;
    s = settle(reveal(s, "07012"));
    expect(s.player.hp).toBe(hp - 5);
    expect(crew(s).active).toBe("piledriver");
  });
  it("Get Wrecked! makes the least-threat villain attack a hero and the most-threat villain scheme against an alter-ego", () => {
    let s = started();
    // Piledriver (Pile It On!, 3 threat) attacks: 2 ATK + 1 boost.
    stack(s, "wrecker", "07028");
    const hp = s.player.hp;
    s = settle(reveal(s, "07013"));
    expect(s.player.hp).toBe(hp - 3);
    // Wrecker (Day of Reckoning, 6 threat) schemes: 2 SCH + 1 boost.
    s.player.form = "alter";
    stack(s, "wrecker", "07057");
    s = settle(reveal(s, "07040"));
    expect(threats(s)).toEqual([9, 5, 3, 4]);
  });
  it("I've Been Waiting For This! heals the active villain and makes him tough; as a boost the least-threat villain schemes after", () => {
    let s = started();
    s.villain.hp -= 5;
    s = settle(reveal(s, "07014"));
    expect(s.villain.hp).toBe(s.villain.maxHp - 2);
    expect(s.villain.tough).toBe(true);
    stack(s, "wrecker", "07029");
    stack(s, "piledriver", "07044");
    s.player.form = "alter";
    s = activate(s, "wrecker", "scheme");
    expect(crew(s).active).toBe("piledriver");
    // Wrecker schemes 2; then Piledriver schemes 2, with a boost card from
    // his own deck, now the active encounter deck (Pummel, 2 icons).
    expect(threats(s)).toEqual([8, 5, 7, 4]);
  });
  it("Mystical Link places 2 threat on each side scheme; as a boost Wrecker gets +3 ATK unless 2 threat is placed", () => {
    let s = started();
    s = settle(reveal(s, "07015"));
    expect(threats(s)).toEqual([8, 7, 5, 6]);
    stack(s, "wrecker", "07015");
    s = native(s, {
      type: "crew:activate",
      key: "wrecker",
      kind: "attack",
      playerId: s.activePlayerId,
    });
    s = settle(s, (v) =>
      v.prompt?.title === "Mystical Link" ? "attack" : undefined,
    );
    expect(
      s.log.some((l) => /Mystical Link: Wrecker gets \+3 ATK/.test(l.text)),
    ).toBe(true);
  });
  it("You're Dead Meat! damages the character with the fewest hit points; a defeat places 3 threat on Wrecker's side scheme", () => {
    let s = started();
    const ally = put(s, "01002");
    ally.damage = 1;
    s = settle(reveal(s, "07016"));
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(threats(s)[0]).toBe(9);
  });
  it("Ball and Chain places 1 threat on the main scheme after Thunderball attacks", () => {
    let s = started();
    s = settle(reveal(s, "07020"));
    stack(s, "wrecker", "07013");
    s = activate(s, "thunderball", "attack");
    expect(s.scheme.threat).toBe(1);
  });
  it("Radioactive Buildup places Thunderball's excess damage on his side scheme, then is discarded", () => {
    let s = started();
    const ally = put(s, "01002");
    s = settle(reveal(s, "07022"));
    stack(s, "wrecker", "07013");
    s = activate(
      s,
      "thunderball",
      "attack",
      (v) => v.prompt?.options.find((o) => o.id === ally.id)?.id,
    );
    // 1 + 3 ATK + 1 boost = 5 against Black Cat's 2 hit points: 3 excess.
    expect(threats(s)[1]).toBe(8);
    expect(s.attachments.some((p) => p.code === "07022")).toBe(false);
  });
  it("Energy Projectiles damages each character you control; as a boost the defending character", () => {
    let s = started();
    const ally = put(s, "01002");
    const hp = s.player.hp;
    s = settle(reveal(s, "07027"));
    expect(s.player.hp).toBe(hp - 1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.damage).toBe(1);
  });
  it("Lightning Blast makes Thunderball attack, with 3 threat if undefended; against an alter-ego 3 threat on the most-threat side scheme", () => {
    let s = started();
    stack(s, "wrecker", "07013");
    s = settle(reveal(s, "07030"));
    expect(threats(s)[1]).toBe(8);
    // Thunderstruck has the most threat: 11 triggers Gamma Blast, which
    // stuns every friendly character, then leaves 3.
    s.player.form = "alter";
    s = settle(reveal(s, "07030"));
    expect(threats(s)[1]).toBe(3);
    expect(s.player.stunned).toBe(true);
  });
  it("Tactical Prowess moves all threat from the least to the most; without a Forced Response it gains surge", () => {
    let s = started();
    s = settle(reveal(s, "07031"));
    expect(threats(s)).toEqual([9, 5, 0, 4]);
    expect(s.encounter.dealt).toHaveLength(1);
    s.encounter.discard.push(...s.encounter.dealt.splice(0));
    scheme(s, "piledriver").counters = 2;
    scheme(s, "bulldozer").counters = 1;
    s = settle(reveal(s, "07031"));
    // Clear the Road (1) to Day of Reckoning (9): 10 triggers Hard Hitter, so
    // Tactical Prowess does not gain surge.
    expect(threats(s)).toEqual([3, 5, 2, 0]);
    expect(s.encounter.dealt).toHaveLength(0);
  });
  it("Distracting Taunts gives Piledriver +3 hit points, stops attacks on other villains and leaves through its Response", () => {
    let s = started();
    const pile = villain(s, "piledriver");
    const max = pile.maxHp;
    s = settle(reveal(s, "07035"));
    expect(villain(s, "piledriver").maxHp).toBe(max + 3);
    expect(targets(s, "enemy", true).map((t) => t.id)).toEqual([
      villain(s, "piledriver").id,
    ]);
    hand: {
      const [a, b] = s.player.deck.filter(
        (p) => card(p).resource_physical || card(p).resource_wild,
      );
      if (!a || !b) break hand;
      s.player.deck = s.player.deck.filter((p) => p !== a && p !== b);
      s.player.hand.push(a, b);
    }
    s = command(s, { type: "BASIC", action: "attack" });
    // Piledriver is the only villain that can be attacked.
    if (s.prompt?.options.some((o) => o.id === villain(s, "piledriver").id))
      s = choose(s, villain(s, "piledriver").id);
    s = settle(
      s,
      (v) => v.prompt?.options.find((o) => /Spend physical/.test(o.label))?.id,
      true,
    );
    if (s.prompt?.kind === "payment")
      s = settle(pay(s, s.player.hand.slice(0, 2)));
    expect(s.attachments.some((p) => p.code === "07035")).toBe(false);
    expect(villain(s, "piledriver").maxHp).toBe(max);
  });
  it("Oversized Hands discards your highest-cost support, or places 2 threat on the active villain's side scheme", () => {
    let s = started();
    s = settle(reveal(s, "07042"));
    expect(threats(s)).toEqual([8, 5, 3, 4]);
    put(s, "01006");
    const team = put(s, "01064");
    s = settle(reveal(s, "07042"));
    expect(s.player.discard.map((p) => p.id)).toContain(team.id);
  });
  it("Escape Plan confuses you, and if you were already confused Piledriver schemes", () => {
    let s = started();
    s = settle(reveal(s, "07043"));
    expect(s.player.confused).toBe(true);
    s.player.form = "alter";
    stack(s, "wrecker", "07028");
    s = settle(reveal(s, "07043"));
    expect(threats(s)[2]).toBe(6);
  });
  it("Pummel gives a tough Piledriver +2 for his activation", () => {
    let s = started();
    villain(s, "piledriver").tough = true;
    stack(s, "wrecker", "07013");
    const hp = s.player.hp;
    s = settle(reveal(s, "07044"));
    // 2 ATK + 2 tough + 1 boost.
    expect(s.player.hp).toBe(hp - 5);
  });
  it("Uncanny Resilience removes each villain's stunned and confused status cards, or gains surge", () => {
    let s = started();
    s = settle(reveal(s, "07045"));
    expect(s.encounter.dealt).toHaveLength(1);
    villain(s, "bulldozer").stunned = true;
    s.villain.confused = true;
    s = settle(reveal(s, "07045"));
    expect(villain(s, "bulldozer").stunned).toBe(false);
    expect(s.villain.confused).toBe(false);
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("Bulldozer's Helmet discards a card from your deck for each damage his attack deals", () => {
    let s = started();
    s = settle(reveal(s, "07049"));
    stack(s, "wrecker", "07013");
    const discard = s.player.discard.length;
    const hp = s.player.hp;
    s = activate(s, "bulldozer", "attack");
    // 3 ATK + 1 Helmet + 1 boost.
    const damage = hp - s.player.hp;
    expect(damage).toBe(5);
    expect(s.player.discard.length).toBe(discard + damage);
  });
  it("Ramming Speed makes you defend against Bulldozer with an ally you control, then is discarded", () => {
    let s = started();
    const ally = put(s, "01002");
    s = settle(reveal(s, "07051"));
    stack(s, "wrecker", "07013");
    s = native(s, {
      type: "crew:activate",
      key: "bulldozer",
      kind: "attack",
      playerId: s.activePlayerId,
    });
    s = settle(s, (v) => {
      if (v.prompt?.options.some((o) => o.id === ally.id))
        expect(v.prompt.options.map((o) => o.id)).toEqual([ally.id]);
      return undefined;
    });
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.attachments.some((p) => p.code === "07051")).toBe(false);
  });
  it("Bull Rush discards a card for each damage or threat of Bulldozer's activation", () => {
    let s = started();
    stack(s, "wrecker", "07013");
    let discard = s.player.discard.length;
    const hp = s.player.hp;
    s = settle(reveal(s, "07055"));
    expect(hp - s.player.hp).toBe(4);
    expect(s.player.discard.length).toBe(discard + 4);
    s.player.form = "alter";
    stack(s, "wrecker", "07028");
    discard = s.player.discard.length;
    s = settle(reveal(s, "07055"));
    // 1 SCH + 1 boost on Clear the Road.
    expect(threats(s)[3]).toBe(6);
    expect(s.player.discard.length).toBe(discard + 2);
  });
  it("Headbutt deals damage to a hero, or threat for an alter-ego, equal to a random hand card's cost", () => {
    let s = started();
    put(s, "01009");
    const [webbed] = s.player.inPlay.splice(-1);
    s.player.hand = [webbed];
    const hp = s.player.hp;
    s = settle(reveal(s, "07058"));
    expect(s.player.hp).toBe(hp - 4);
    s.player.form = "alter";
    const shooter = s.player.deck.find((p) => p.code === "01008") || webbed;
    s.player.deck = s.player.deck.filter((p) => p !== shooter);
    s.player.discard = s.player.discard.filter((p) => p !== shooter);
    s.player.hand = [shooter];
    s = settle(reveal(s, "07058"));
    expect(threats(s)[3]).toBe(4 + card(shooter).cost!);
  });
  it("Leading the Charge discards Bulldozer's ATK in cards and places 1 threat per card type", () => {
    let s = started();
    const top = s.player.deck.slice(0, 3);
    const types = new Set(top.map((p) => card(p).type_code)).size;
    s = settle(reveal(s, "07059"));
    expect(threats(s)[3]).toBe(4 + types);
  });
});

describe("Saves", () => {
  it("dispatches survive a JSON save and reload in the middle of a focus window", () => {
    let s = started();
    s = native(s, {
      type: "crew:activate",
      key: "bulldozer",
      kind: "attack",
      playerId: s.activePlayerId,
    });
    expect(s.prompt).not.toBeNull();
    s = reload(s);
    expect(s.villain.id).toBe(villain(s, "bulldozer").id);
    s = settle(s);
    expect(s.villain.id).toBe(villain(s, "wrecker").id);
    expect(crew(s).windows || 0).toBe(0);
  });
});
