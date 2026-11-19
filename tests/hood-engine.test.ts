/** The Hood scenario pack: The Hood (I-III), his three main schemes, the
 * seven set-aside modular sets, Foul Play, and the alternative Standard II
 * and Expert II encounter sets, exercised with the original physical cards.
 * Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, VILLAINS, card } from "../src/game/cards";
import {
  abilityOptions,
  enemyStats,
  newGame,
  schemeLimit,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  EXPERT_II_CODES,
  HOOD_SCRIPT_CODES,
  hoodSetAsideSets,
} from "../src/game/hood";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

const players3 = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
const SEVEN = [
  "bomb_scare",
  "masters_of_evil",
  "under_attack",
  "legions_of_hydra",
  "the_doomsday_chair",
  "goblin_gimmicks",
  "a_mess_of_things",
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  extra: { standardII?: boolean; expertII?: boolean; villainId?: string } = {},
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: extra.villainId || "the_hood",
    difficulty,
    seed: 24001,
    pacing: "expert",
    heroes: players3.slice(0, players),
    ...(extra.villainId ? {} : { modules: SEVEN }),
    standardII: extra.standardII,
    expertII: extra.expertII,
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
/** Started table: hands go back into the decks, every identity is a hero,
 * and the cards Foul Play dealt at setup return to the encounter deck. */
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  extra: { standardII?: boolean; expertII?: boolean; villainId?: string } = {},
) {
  let s = settle(setup(difficulty, players, extra));
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
const H = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `hood:${type}`,
  ...args,
});
function zones(s: GameState): Piece[][] {
  return [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.resolving,
    s.removed,
    s.attachments,
    s.sideSchemes,
    s.minions,
    s.environments || [],
    [s.villain],
    s.hood
      ? [
          s.hood.currentMain,
          ...s.hood.mainDeck,
          ...s.hood.villainDeck,
          ...s.hood.setAside,
        ]
      : [],
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** The 15 Hood cards in use stay in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "the_hood")).toHaveLength(15);
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.hood?.setAside || [],
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
const hoodCard = (code: string) => CATALOG_CARDS.find((c) => c.code === code)!;
const dealtTo = (s: GameState, id: string) =>
  s.encounter.dealt.filter((p) => p.dealtTo === id);
/** Put encounter cards from outside The Hood set on top. */
const outsider = (s: GameState) =>
  s.encounter.deck.find((p) => card(p).set_code !== "the_hood")!;

describe("The Hood original source", () => {
  it("registers every face of the scenario and the alternative sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "hood" &&
        ["the_hood", "standard_ii", "expert_ii"].includes(c.set_code || ""),
    );
    expect(faces).toHaveLength(27);
    for (const c of faces) {
      expect(hasExecutableScript(c.code), c.code).toBe(true);
      if (c.code !== "24053")
        expect(HOOD_SCRIPT_CODES as readonly string[], c.code).toContain(
          c.code,
        );
    }
    expect(VILLAINS.find((v) => v.id === "the_hood")).toMatchObject({
      codes: ["24001", "24002", "24003"],
      schemes: ["24004b", "24005b", "24006b"],
      moduleCount: 7,
    });
    expect(EXPERT_II_CODES).toHaveLength(4);
  });
  it.each([1, 2, 3])(
    "sets aside six of the seven modular sets and resolves Foul Play for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        const version = difficulty === "expert" ? 1 : 0;
        expect(s.villain.code).toBe(["24001", "24002"][version]);
        const health = hoodCard(s.villain.code).health! * players;
        expect([s.villain.hp, s.villain.maxHp]).toEqual([health, health]);
        expect(s.scheme).toMatchObject({ code: "24004b", threat: players });
        expect(schemeLimit(s)).toBe(5 * players);
        expect(s.hood!.villainDeck.map((p) => p.code)).toEqual([
          ["24002", "24003"][version],
        ]);
        expect(s.hood!.mainDeck.map((p) => p.code)).toEqual([
          "24005a",
          "24006a",
        ]);
        // One random set is in the deck; Expert's The Hood (II) recruits
        // another when revealed.
        const aside = hoodSetAsideSets(s);
        expect(aside).toHaveLength(difficulty === "expert" ? 5 : 6);
        const inDeck = SEVEN.filter((set) => !aside.includes(set));
        expect(inDeck).toHaveLength(difficulty === "expert" ? 2 : 1);
        for (const p of [
          ...s.encounter.deck,
          ...s.encounter.discard,
          ...s.encounter.dealt,
        ])
          expect(aside, p.code).not.toContain(card(p).set_code);
        // Each player resolved Foul Play: The Hood (I) discards one card,
        // The Hood (II) two.
        expect(s.encounter.discard.length + s.encounter.dealt.length).toBe(
          players * (difficulty === "expert" ? 2 : 1),
        );
        exact(reload(s));
      }
    },
  );
});

describe("Foul Play", () => {
  it("deals the card discarded by The Hood (I) unless it belongs to his set", () => {
    let s = started();
    stack(s, "24013");
    s = settle(native(s, H("foul-play", { playerId: "p1", actorId: "p1" })));
    expect(dealtTo(s, "p1")).toHaveLength(0);
    expect(s.encounter.discard.map((p) => p.code)).toContain("24013");
    const other = outsider(s);
    s.encounter.deck = [other, ...s.encounter.deck.filter((p) => p !== other)];
    s = settle(native(s, H("foul-play", { playerId: "p1", actorId: "p1" })));
    expect(dealtTo(s, "p1").map((p) => p.id)).toEqual([other.id]);
    exact(reload(s));
  });
  it("deals the first such card for The Hood (II) and each one for (III)", () => {
    let s = started("expert");
    const [a, b] = s.encounter.deck
      .filter((p) => card(p).set_code !== "the_hood")
      .slice(0, 2);
    s.encounter.deck = [
      a,
      b,
      ...s.encounter.deck.filter((p) => p !== a && p !== b),
    ];
    s = settle(native(s, H("foul-play", { playerId: "p1", actorId: "p1" })));
    expect(dealtTo(s, "p1").map((p) => p.id)).toEqual([a.id]);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s.encounter.deck.push(...s.encounter.discard.splice(0));
    const v3 = s.hood!.villainDeck[0];
    s.villain.code = v3.code;
    const [c, d] = s.encounter.deck
      .filter((p) => card(p).set_code !== "the_hood")
      .slice(0, 2);
    s.encounter.deck = [
      c,
      d,
      ...s.encounter.deck.filter((p) => p !== c && p !== d),
    ];
    s = settle(native(s, H("foul-play", { playerId: "p1", actorId: "p1" })));
    expect(dealtTo(s, "p1").map((p) => p.id)).toEqual([c.id, d.id]);
  });
});

describe("The Hood's stages", () => {
  it("advances the main scheme: Promised Prosperity recruits, accelerates and punishes players without a dealt card", () => {
    let s = started("standard", 2);
    // No set waits aside and the encounter deck holds only The Hood's cards,
    // so both players discard a card of his set and nobody is dealt one.
    s.encounter.discard.push(...s.hood!.setAside.splice(0));
    s.encounter.discard.push(
      ...s.encounter.deck.filter((p) => card(p).set_code !== "the_hood"),
    );
    s.encounter.deck = s.encounter.deck.filter(
      (p) => card(p).set_code === "the_hood",
    );
    s = settle(native(s, { type: "threat", target: "main", amount: 10 }));
    expect(s.scheme.code).toBe("24005b");
    expect(hoodSetAsideSets(s)).toHaveLength(0);
    expect(s.encounter.acceleration).toBe(1);
    // Base 2 per player plus 2 for each of the two players.
    expect(s.scheme.threat).toBe(4 + 4);
    expect(s.removed.map((p) => p.code)).toContain("24004b");
    exact(reload(s));
  });
  it("Crime State recruits, accelerates and resolves Foul Play after step one", () => {
    let s = started();
    s = settle(native(s, { type: "threat", target: "main", amount: 5 }));
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s = settle(native(s, { type: "threat", target: "main", amount: 20 }));
    expect(s.scheme.code).toBe("24006b");
    expect(s.encounter.acceleration).toBe(2);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    const discard = s.encounter.discard.length;
    s = settle(native(s, { type: "villainStepOne" }));
    expect(
      s.encounter.discard.length + s.encounter.dealt.length - discard,
    ).toBe(1);
    s = settle(native(s, { type: "threat", target: "main", amount: 20 }));
    expect(s.phase).toBe("lost");
  });
  it("advances The Hood (I) to (II), who recruits, and wins against (II)", () => {
    let s = started();
    const sets = hoodSetAsideSets(s).length;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: s.villain.hp,
        source: "hero",
      }),
    );
    expect(s.villain.code).toBe("24002");
    expect(s.villain.hp).toBe(16);
    expect(hoodSetAsideSets(s)).toHaveLength(sets - 1);
    exact(reload(s));
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: s.villain.hp,
        source: "hero",
      }),
    );
    expect(s.phase).toBe("won");
  });
});

describe("The Hood's encounter cards", () => {
  it("Established Dominance makes Foul Play follow The Hood's activations and leaves through its Alter-Ego Action", () => {
    let s = started();
    s = reveal(s, "24007");
    const dominance = s.attachments.find((p) => p.code === "24007")!;
    expect(dominance.attachedTo).toBe("hero:p1");
    // The first card is The Hood's boost card; Foul Play then discards a
    // card from outside his set and deals it.
    const [boost, other] = s.encounter.deck
      .filter((p) => card(p).set_code !== "the_hood")
      .slice(0, 2);
    s.encounter.deck = [
      boost,
      other,
      ...s.encounter.deck.filter((p) => p !== boost && p !== other),
    ];
    s.player.form = "alter";
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(dealtTo(s, "p1").map((p) => p.id)).toEqual([other.id]);
    const threat = s.scheme.threat;
    s.player.exhausted = false;
    expect(abilityOptions(s, dominance).map((o) => o.id)).toContain("discard");
    s = settle(
      command(s, { type: "ABILITY", id: dominance.id, action: "discard" }),
    );
    expect(s.attachments.some((p) => p.id === dominance.id)).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.scheme.threat).toBe(threat + 2);
  });
  it("The Hood's Mantle gives retaliate and steady; The Hood's Pistol adds ATK and SCH", () => {
    let s = started();
    s = reveal(s, "24008");
    s = reveal(s, "24009");
    expect(enemyStats(s, s.villain)).toMatchObject({ attack: 2, scheme: 2 });
    // Steady: one stunned status card does not stun him.
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(true);
    // Retaliate 1 against an attack.
    const hp = s.player.hp;
    s.villain.stunned = false;
    s.villain.stunCards = 0;
    s = settle(
      command(s, { type: "BASIC", action: "attack" }),
      (v) => v.prompt?.options.find((o) => o.id === s.villain.id)?.id,
    );
    expect(hp - s.player.hp).toBe(1);
  });
  it("Madame Masque resolves Foul Play when revealed and when defeated", () => {
    let s = started();
    const other = outsider(s);
    s.encounter.deck = [other, ...s.encounter.deck.filter((p) => p !== other)];
    s = settle(reveal(s, "24010"));
    const masque = s.minions.find((m) => m.code === "24010")!;
    expect(dealtTo(s, "p1").map((p) => p.id)).toEqual([other.id]);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    const next = outsider(s);
    s.encounter.deck = [next, ...s.encounter.deck.filter((p) => p !== next)];
    s = settle(
      native(s, {
        type: "damage",
        target: masque.id,
        amount: 4,
        source: "hero",
      }),
    );
    expect(s.minions.some((m) => m.id === masque.id)).toBe(false);
    expect(dealtTo(s, "p1").map((p) => p.id)).toEqual([next.id]);
  });
  it("Unbridled Ambition hinders and resolves Foul Play when the villain phase begins", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "24011"));
    const ambition = s.sideSchemes.find((p) => p.code === "24011")!;
    expect(ambition.counters).toBe(2 + 4);
    const before = s.encounter.discard.length + s.encounter.dealt.length;
    s = settle(
      native(s, {
        type: "villainPhaseForcedInterrupts",
        remaining: [H("ambition", { id: ambition.id })],
      }),
    );
    expect(s.encounter.discard.length + s.encounter.dealt.length - before).toBe(
      2,
    );
  });
  it("Field Recruitment recruits, resolves Foul Play and is removed from the game", () => {
    let s = started();
    const sets = hoodSetAsideSets(s).length;
    s = settle(reveal(s, "24012"));
    expect(hoodSetAsideSets(s)).toHaveLength(sets - 1);
    expect(s.removed.map((p) => p.code)).toContain("24012");
    expect(s.encounter.discard.map((p) => p.code)).not.toContain("24012");
    exact(reload(s));
  });
  it("Upper Hand makes The Hood attack a hero or scheme against an alter-ego, then Foul Play", () => {
    let s = started();
    s.encounter.discard.push(...s.encounter.deck.filter((p) => card(p).boost));
    s.encounter.deck = s.encounter.deck.filter((p) => !card(p).boost);
    const hp = s.player.hp;
    s = settle(reveal(s, "24013"));
    expect(hp - s.player.hp).toBe(1);
    s.player.form = "alter";
    const threat = s.scheme.threat;
    s = settle(reveal(s, "24013"));
    expect(s.scheme.threat).toBe(threat + 1);
  });
});

describe("Standard II and Expert II", () => {
  it("replace the core sets in any scenario and put Formidable Foe into play", () => {
    for (const difficulty of ["standard", "expert"] as const) {
      const s = settle(
        setup(difficulty, 1, {
          villainId: "rhino",
          standardII: true,
          expertII: true,
        }),
      );
      const deck = [...s.encounter.deck, ...s.encounter.dealt];
      expect(deck.some((p) => card(p).set_code === "standard")).toBe(false);
      expect(deck.some((p) => card(p).set_code === "standard_ii")).toBe(true);
      expect(deck.some((p) => card(p).set_code === "expert")).toBe(false);
      expect(deck.some((p) => card(p).set_code === "expert_ii")).toBe(
        difficulty === "expert",
      );
      expect((s.environments || []).map((p) => p.code)).toEqual([
        difficulty === "expert" ? "24049b" : "24049a",
      ]);
    }
  });
  it("Formidable Foe makes the villain steady, and in Expert each enemy with an acceleration icon", () => {
    let s = started("standard", 1, { villainId: "rhino", standardII: true });
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    s = started("expert", 1, { villainId: "rhino", standardII: true });
    const threat = s.scheme.threat;
    s = settle(native(s, { type: "villainStepOne" }));
    // Rhino's main scheme escalation plus the acceleration icon.
    expect(s.scheme.threat - threat).toBe(
      (hoodCard(s.scheme.code).escalation_threat || 0) + 1,
    );
  });
  it("Total Annihilation's attack gains overkill; Dark Dealings schemes with +1 SCH", () => {
    let s = started("standard", 1, { villainId: "rhino", standardII: true });
    s.encounter.discard.push(...s.encounter.deck.filter((p) => card(p).boost));
    s.encounter.deck = s.encounter.deck.filter((p) => !card(p).boost);
    const hp = s.player.hp;
    s = settle(reveal(s, "24054"));
    expect(hp - s.player.hp).toBe(2);
    // Surge.
    expect(dealtTo(s, "p1")).toHaveLength(1);
    s.player.form = "alter";
    const threat = s.scheme.threat;
    s = settle(reveal(s, "24050"));
    expect(s.scheme.threat).toBe(threat + 1 + 1);
  });
  it("Mob Mentality puts the first of seven minions into play against an alter-ego", () => {
    let s = started("standard", 1, { villainId: "rhino", standardII: true });
    s.player.form = "alter";
    const minion = s.encounter.deck.find(
      (p) => card(p).type_code === "minion",
    )!;
    s.encounter.deck = [
      ...s.encounter.deck
        .filter((p) => card(p).type_code !== "minion")
        .slice(0, 3),
      minion,
      ...s.encounter.deck.filter(
        (p) =>
          p !== minion &&
          !s.encounter.deck
            .filter((q) => card(q).type_code !== "minion")
            .slice(0, 3)
            .includes(p),
      ),
    ];
    s = settle(reveal(s, "24051"));
    expect(s.minions.map((m) => m.id)).toContain(minion.id);
  });
  it("Overwhelming Force discards the highest-cost upgrade or support, or surges", () => {
    let s = started("standard", 1, { villainId: "rhino", standardII: true });
    s = settle(reveal(s, "24052"));
    expect(dealtTo(s, "p1")).toHaveLength(1);
  });
  it("Expert II: Cruel Intentions, Ruination, Seek and Destroy and Slug It Out", () => {
    let s = started("expert", 1, {
      villainId: "rhino",
      standardII: true,
      expertII: true,
    });
    s = settle(reveal(s, "24029"));
    // Each player is dealt a card, plus its surge; the villain has a
    // facedown boost card for his next activation.
    expect(dealtTo(s, "p1")).toHaveLength(2);
    expect(s.encounter.storedBoosts).toHaveLength(1);
    s.encounter.deck.push(...s.encounter.dealt.splice(0));
    s = settle(reveal(s, "24031"));
    expect(
      s.minions.some((m) => card(m).set_code === "spider_man_nemesis"),
    ).toBe(true);
    const hp = s.player.hp;
    s = settle(reveal(s, "24032"));
    expect(s.player.exhausted).toBe(true);
    expect(hp - s.player.hp).toBe(2);
  });
});

describe("The Hood's boosts and actions", () => {
  it("The Hood's Pistol boost reveals it onto The Hood; Field Recruitment's boost resolves Foul Play after the activation", () => {
    let s = started();
    stack(s, "24009");
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    const pistol = s.attachments.find((p) => p.code === "24009");
    expect(pistol?.attachedTo).toBe(s.villain.id);
    expect(s.encounter.discard.map((p) => p.code)).not.toContain("24009");
    s = started();
    const other = outsider(s);
    stack(s, "24012");
    s.encounter.deck = [
      s.encounter.deck[0],
      other,
      ...s.encounter.deck.slice(1).filter((p) => p !== other),
    ];
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(dealtTo(s, "p1").map((p) => p.id)).toEqual([other.id]);
    exact(reload(s));
  });
  it("Hero Actions spend the printed resources to discard The Hood's Mantle", () => {
    let s = started();
    s = reveal(s, "24008");
    const mantle = s.attachments.find((p) => p.code === "24008")!;
    const pick = (kind: "energy" | "mental" | "physical") => {
      const i = s.player.deck.findIndex(
        (p) =>
          !!(card(p) as unknown as Record<string, unknown>)[
            `resource_${kind}`
          ] && !card(p).resource_wild,
      );
      return s.player.deck.splice(i, 1)[0];
    };
    const paid = [pick("energy"), pick("mental"), pick("physical")];
    s.player.hand.push(...paid);
    expect(abilityOptions(s, mantle).map((o) => o.id)).toContain("discard");
    s = command(s, { type: "ABILITY", id: mantle.id, action: "discard" });
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: paid.map((p) => p.id) });
    s = settle(s);
    expect(s.attachments.some((p) => p.id === mantle.id)).toBe(false);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      expect.arrayContaining(paid.map((p) => p.id)),
    );
  });
  it("Ruination reveals the next side scheme and places 2 threat on each scheme", () => {
    let s = started("expert", 1, {
      villainId: "rhino",
      standardII: true,
      expertII: true,
    });
    const side = s.encounter.deck.find(
      (p) => card(p).type_code === "side_scheme",
    )!;
    const before = s.encounter.deck.filter(
      (p) => card(p).type_code !== "side_scheme",
    )[0];
    s.encounter.deck = [
      before,
      side,
      ...s.encounter.deck.filter((p) => p !== side && p !== before),
    ];
    const threat = s.scheme.threat;
    s = settle(reveal(s, "24030"));
    const scheme = s.sideSchemes.find((p) => p.id === side.id)!;
    expect(scheme).toBeTruthy();
    expect(scheme.counters).toBeGreaterThanOrEqual(2);
    // Incite 1, then 2 threat on the main scheme.
    expect(s.scheme.threat).toBe(threat + 1 + 2);
    expect(s.encounter.discard.map((p) => p.id)).toContain(before.id);
  });
});
