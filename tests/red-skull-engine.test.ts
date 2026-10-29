/** Printed Red Skull rules exercised with the original selected physical cards.
 * Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  card,
  CATALOG_CARDS,
  deckCodes,
  heroStats,
  pieceHP,
  scenarioModules,
} from "../src/game/cards";
import {
  abilityOptions,
  enemyStats,
  newGame,
  schemeLimit,
} from "../src/game/engine";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { GameState, Piece, Resource } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  reload,
  respond,
} from "./dv-test-helpers";

function setup(difficulty: "standard" | "expert" = "standard", players = 1) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "red_skull",
    difficulty,
    seed: 4125,
    pacing: "expert",
    heroes: [
      { heroId: "spider_man", aspect: "justice" },
      ...(players >= 2
        ? [{ heroId: "captain_marvel", aspect: "aggression" as const }]
        : []),
      ...(players >= 3
        ? [{ heroId: "iron_man", aspect: "leadership" as const }]
        : []),
    ],
  });
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 150; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).toBe("choice");
    s = choose(
      reload(s),
      prefer?.(s) ||
        passId(s) ||
        s.prompt.options.find((o) =>
          ["none", "hero", "damage", "allow", "resolve"].includes(o.id),
        )?.id ||
        s.prompt.options[0].id,
    );
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return s;
}
function until(s: GameState, predicate: (s: GameState) => boolean) {
  for (let n = 0; s.prompt && !predicate(s) && n < 100; n++)
    s = choose(reload(s), passId(s) || s.prompt.options[0].id);
  expect(predicate(s), JSON.stringify(s.prompt)).toBe(true);
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
    [s.villain],
    s.redSkull!.villainDeck,
    s.redSkull!.mainDeck,
    [s.redSkull!.currentMain],
    s.redSkull!.sideDeck,
    s.redSkull!.sideDiscard,
    ...(s.redSkull!.sleeper ? [[s.redSkull!.sleeper]] : []),
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
function nested(ps: Piece[]): Piece[] {
  return ps.flatMap((p) => [
    p,
    ...nested(p.captured || []),
    ...nested(p.storedCards || []),
  ]);
}
function exact(s: GameState) {
  const all = nested(zones(s).flat());
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  const ps = all.filter((p) => card(p).set_code === "red_skull");
  expect(ps).toHaveLength(27);
  expect(new Set(ps.map((p) => p.id)).size).toBe(27);
  return s;
}
function take(s: GameState, code: string, playerId?: string) {
  const ps = playerId
    ? (() => {
        const p = seatView(s, playerId).player;
        return [p.deck, p.hand, p.discard];
      })()
    : zones(s);
  for (const zone of ps) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original ${playerId || "encounter"}:${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function defeat(s: GameState, code: string, actorId = s.activePlayerId) {
  const p = s.sideSchemes.find((p) => p.code === code)!;
  expect(p).toBeTruthy();
  return native(s, {
    type: "thwart",
    target: p.id,
    amount: p.counters,
    actorId,
  });
}
function clearHouse(s: GameState) {
  return settle(defeat(s, "04139"));
}
function attack(s: GameState, playerId = "p1") {
  return native(s, {
    type: "enemyAttack",
    id: s.villain.id,
    actorId: playerId,
    activation: { enemyId: s.villain.id, playerId, kind: "attack" },
  });
}
function top(s: GameState, ...codes: string[]) {
  const ps = codes.map((code) => take(s, code));
  s.encounter.deck.unshift(...ps);
  return ps;
}
function sideTop(s: GameState, code: string) {
  const p = take(s, code);
  s.redSkull!.sideDeck.unshift(p);
  return p;
}
function ally(s: GameState, playerId = "p1") {
  const player = seatView(s, playerId).player;
  const p = player.deck.find((p) => card(p).type_code === "ally")!;
  expect(p).toBeTruthy();
  player.deck.splice(player.deck.indexOf(p), 1);
  player.inPlay.push(p);
  return p;
}
function resource(s: GameState, type: Resource) {
  const p = s.player.deck.find((p) => card(p)[`resource_${type}`])!;
  expect(p).toBeTruthy();
  s.player.deck.splice(s.player.deck.indexOf(p), 1);
  s.player.hand.push(p);
  return p;
}
function blank(s: GameState, p: Piece) {
  s.flags[`novaIronheartPackBlank:${p.id}`] = s.round;
}

describe("Red Skull original standalone source", () => {
  it("registers all 22 faces and the unmodified 28-card retail source", () => {
    const source = CATALOG_CARDS.filter((p) => p.set_code === "red_skull");
    expect(source).toHaveLength(22);
    for (const p of source)
      expect(hasExecutableScript(p.code), p.code).toBe(true);
    expect(
      source.filter((c) => !c.hidden).reduce((n, c) => n + c.quantity, 0),
    ).toBe(28);
  });
  it.each([1, 2, 3])(
    "preserves originals and sets aside the Sleeper for %i players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        expect(s.modules).toEqual(["hydra_assault", "hydra_patrol"]);
        expect(s.sideSchemes.map((p) => p.code)).toEqual(["04139"]);
        expect(s.sideSchemes[0].counters).toBe(3 * players);
        expect(s.redSkull!.sideDeck).toHaveLength(6);
        expect(s.redSkull!.sideDiscard).toHaveLength(0);
        expect(s.redSkull!.sleeper?.code).toBe("04130");
        expect(
          s.encounter.deck.every((p) => card(p).type_code !== "side_scheme"),
        ).toBe(true);
        expect(s.encounter.dealt).toHaveLength(
          difficulty === "expert" ? players : 0,
        );
        expect(s.scheme.threat).toBe(0);
        expect(schemeLimit(s)).toBe(8 * players);
        expect(s.villain.hp).toBe(
          (difficulty === "expert" ? 16 : 12) * players,
        );
        expect(s.villain.code).toBe(
          difficulty === "expert" ? "04126" : "04125",
        );
        exact(reload(s));
      }
    },
  );
  it("accepts each replaceable set and isolates all its side schemes", () => {
    expect(scenarioModules("red_skull")).toHaveLength(30);
    for (const m of scenarioModules("red_skull")) {
      const partner =
        m.id === "hydra_patrol" ? "hydra_assault" : "hydra_patrol";
      const s = settle(
        newGame({
          heroId: "spider_man",
          aspect: "justice",
          villainId: "red_skull",
          modules: [m.id, partner],
          seed: 4125,
          pacing: "expert",
        }),
      );
      expect(s.modules).toEqual([m.id, partner]);
      expect(
        s.encounter.deck.every((p) => card(p).type_code !== "side_scheme"),
      ).toBe(true);
      exact(s);
    }
  });
  it.each([
    ["hydra_assault"],
    ["hydra_patrol", "hydra_patrol"],
    ["hydra_assault", "hydra_patrol", "bomb_scare"],
  ])("rejects invalid two-module selection %j", (...modules) => {
    expect(() =>
      newGame({
        heroId: "spider_man",
        aspect: "justice",
        villainId: "red_skull",
        modules,
        seed: 1,
      }),
    ).toThrow();
  });
  it.each(["standard", "expert"] as const)(
    "advances physical %s villain stages and deals one card to each player",
    (difficulty) => {
      let s = clearHouse(started(difficulty, 2));
      const old = s.villain.id,
        before = s.encounter.dealt.length;
      s = settle(
        native(s, { type: "damage", target: old, amount: s.villain.hp }),
      );
      expect(s.villain.code).toBe(
        difficulty === "standard" ? "04126" : "04127",
      );
      expect(s.encounter.dealt).toHaveLength(before + 2);
      expect(s.removed.some((p) => p.id === old)).toBe(true);
      exact(reload(s));
      s = settle(
        native(s, {
          type: "damage",
          target: s.villain.id,
          amount: s.villain.hp,
        }),
      );
      expect(s.phase).toBe("won");
      exact(s);
    },
  );
  it("advances the physical main scheme and reveals one side scheme before losing on stage two", () => {
    let s = started("standard", 2);
    const old = s.redSkull!.currentMain.id;
    const next = sideTop(s, "04143");
    s = settle(native(s, { type: "threat", target: "main", amount: 16 }));
    expect(s.scheme).toMatchObject({ code: "04129b", threat: 2, index: 1 });
    expect(schemeLimit(s)).toBe(22);
    expect(s.removed.some((p) => p.id === old)).toBe(true);
    expect(s.redSkull!.currentMain.code).toBe("04129b");
    expect(s.sideSchemes.some((p) => p.id === next.id)).toBe(true);
    exact(reload(s));
    s = settle(native(s, { type: "threat", target: "main", amount: 20 }));
    expect(s.phase).toBe("lost");
    exact(s);
  });
});

describe("Red Skull separate side-scheme deck", () => {
  it("reveals an original side scheme after step-one threat placement", () => {
    let s = started();
    const next = sideTop(s, "04141");
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(1);
    expect(s.sideSchemes.find((p) => p.id === next.id)?.counters).toBe(3);
    expect(s.redSkull!.sideDeck).toHaveLength(5);
    exact(reload(s));
  });
  it("does not run a blank main scheme's forced reveal", () => {
    let s = started();
    const ids = s.redSkull!.sideDeck.map((p) => p.id);
    blank(s, s.redSkull!.currentMain);
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.scheme.threat).toBe(1);
    expect(s.redSkull!.sideDeck.map((p) => p.id)).toEqual(ids);
    exact(s);
  });
  it("defeated side schemes enter their own discard pile and recycle without acceleration", () => {
    let s = clearHouse(started());
    const house = s.redSkull!.sideDiscard.find((p) => p.code === "04139")!;
    expect(house).toBeTruthy();
    expect(s.encounter.discard.some((p) => p.id === house.id)).toBe(false);
    // Focus one complete deck cycle while preserving every remaining original.
    s.redSkull!.sideDiscard.push(...s.redSkull!.sideDeck.splice(0));
    const originalIds = s.redSkull!.sideDiscard.map((p) => p.id).sort(),
      acceleration = s.encounter.acceleration;
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.sideSchemes).toHaveLength(1);
    expect(s.redSkull!.sideDeck).toHaveLength(6);
    expect(s.redSkull!.sideDiscard).toHaveLength(0);
    expect(
      [...s.redSkull!.sideDeck, ...s.sideSchemes].map((p) => p.id).sort(),
    ).toEqual(originalIds);
    expect(s.encounter.acceleration).toBe(acceleration);
    exact(reload(s));
  });
  it("an empty side deck and discard do not create a card or acceleration token", () => {
    let s = started();
    for (const p of s.redSkull!.sideDeck.splice(0)) {
      p.counters = 9;
      s.sideSchemes.push(p);
    }
    const ids = s.sideSchemes.map((p) => p.id).sort();
    s = settle(native(s, { type: "villainStepOne" }));
    expect(s.sideSchemes.map((p) => p.id).sort()).toEqual(ids);
    expect(s.encounter.acceleration).toBe(0);
    exact(s);
  });
  it("Red Skull's attack counts side schemes and honors text blanking", () => {
    let s = started();
    expect(enemyStats(s, s.villain).attack).toBe(1);
    s = settle(reveal(s, "04143"));
    expect(enemyStats(s, s.villain).attack).toBe(2);
    blank(s, s.villain);
    expect(enemyStats(s, s.villain).attack).toBe(0);
    exact(s);
  });
});

describe("Red House and the original Sleeper", () => {
  it("Red House prevents all damage until the original scheme leaves play", () => {
    let s = started();
    const hp = s.villain.hp;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 5 }));
    expect(s.villain.hp).toBe(hp);
    s = clearHouse(s);
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 5 }));
    expect(s.villain.hp).toBe(hp - 5);
    exact(s);
  });
  it("blank Red House no longer prevents damage", () => {
    let s = started();
    blank(s, s.sideSchemes[0]);
    const hp = s.villain.hp;
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 2 }));
    expect(s.villain.hp).toBe(hp - 2);
    exact(s);
  });
  it.each(["attack", "thwart"])(
    "a native basic thwart can use the %s stat at Red House",
    (stat) => {
      let s = started();
      const house = s.sideSchemes[0],
        initial = house.counters;
      s = command(s, { type: "BASIC", action: "thwart" });
      if (s.prompt?.options.some((o) => o.id === house.id))
        s = choose(s, house.id);
      s = until(
        s,
        (v) =>
          !!v.prompt?.options.some((o) =>
            new RegExp(
              stat === "attack" ? "ATK|attack" : "THW|thwart",
              "i",
            ).test(o.label),
          ),
      );
      const option = s.prompt!.options.find((o) =>
        new RegExp(stat === "attack" ? "ATK|attack" : "THW|thwart", "i").test(
          o.label,
        ),
      )!;
      s = settle(choose(reload(s), option.id));
      expect(s.sideSchemes.find((p) => p.id === house.id)?.counters).toBe(
        initial - (stat === "attack" ? 2 : 1),
      );
      expect(s.player.exhausted).toBe(true);
      exact(s);
    },
  );
  it("reveals the set-aside Sleeper for the first player with Guard, Toughness and scaled HP", () => {
    let s = started("standard", 2);
    s.firstPlayerId = "p2";
    const id = s.redSkull!.sleeper!.id;
    s = settle(reveal(s, "04140", "p1"));
    const sleeper = s.minions.find((p) => p.id === id)!;
    expect(sleeper).toMatchObject({
      code: "04130",
      engagedWith: "p2",
      tough: true,
    });
    expect(pieceHP(s, sleeper)).toBe(10);
    expect(s.redSkull!.sleeper).toBeUndefined();
    expect(s.sideSchemes.some((p) => p.code === "04140")).toBe(true);
    exact(reload(s));
  });
  it("Sleeper Awakened cannot be discarded while its Sleeper is in play", () => {
    let s = settle(reveal(started(), "04140"));
    const scheme = s.sideSchemes.find((p) => p.code === "04140")!;
    s = settle(native(s, { type: "discardPiece", id: scheme.id }));
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(true);
    exact(s);
  });
  it("defeating the Sleeper removes both originals instead of recycling them", () => {
    let s = settle(reveal(started(), "04140"));
    const sleeper = s.minions.find((p) => p.code === "04130")!,
      scheme = s.sideSchemes.find((p) => p.code === "04140")!;
    s = settle(native(s, { type: "damage", target: sleeper.id, amount: 1 }));
    s = settle(native(s, { type: "damage", target: sleeper.id, amount: 5 }));
    for (const p of [sleeper, scheme])
      expect(s.removed.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.minions.some((p) => p.id === sleeper.id)).toBe(false);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    exact(reload(s));
  });
});

describe("Red Skull ruling regressions", () => {
  it("Black Cat's ATK substitution uses attack consequential damage but remains a thwart", () => {
    let s = started();
    const house = s.sideSchemes[0],
      cat = take(s, "01002", "p1");
    s.player.inPlay.push(cat);
    s = command(s, { type: "ABILITY", id: cat.id, action: "thwart" });
    if (s.prompt?.options.some((o) => o.id === house.id))
      s = choose(s, house.id);
    s = until(
      s,
      (v) => !!v.prompt?.options.some((o) => /ATK|attack/i.test(o.label)),
    );
    s = settle(
      choose(
        reload(s),
        s.prompt!.options.find((o) => /ATK|attack/i.test(o.label))!.id,
      ),
    );
    expect(s.sideSchemes.find((p) => p.id === house.id)?.counters).toBe(2);
    expect(s.player.inPlay.find((p) => p.id === cat.id)).toMatchObject({
      exhausted: true,
      damage: 0,
    });
    exact(reload(s));
  });
  it("Hulk ally's printed dash THW does not become a legal thwart from Red House", () => {
    const s = started("standard", 2),
      hulk = take(s, "01050", "p2");
    seatView(s, "p2").player.inPlay.push(hulk);
    expect(
      abilityOptions(seatView(s, "p2"), hulk).find((o) => o.id === "thwart")
        ?.disabled,
    ).toMatch(/printed dash/);
    exact(s);
  });
  it("a later nemesis scheme enters play normally and discards into the side deck's pile", () => {
    let s = started();
    s = settle(reveal(s, "01190"));
    const nemesis = s.sideSchemes.find((p) => p.code === "01166")!;
    expect(nemesis).toBeTruthy();
    s = settle(defeat(s, "01166"));
    expect(s.redSkull!.sideDiscard.some((p) => p.id === nemesis.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === nemesis.id)).toBe(false);
    exact(reload(s));
  });
  it("removing Sleeper Awakened does not trigger attached Twisted Reality", () => {
    let s = settle(reveal(started(), "04140"));
    const scheme = s.sideSchemes.find((p) => p.code === "04140")!,
      sleeper = s.minions.find((p) => p.code === "04130")!;
    s = settle(
      reveal(s, "04135"),
      (v) => v.prompt?.options.find((o) => o.id === scheme.id)?.id,
    );
    const before = s.encounter.dealt.length;
    s = settle(native(s, { type: "damage", target: sleeper.id, amount: 1 }));
    s = settle(native(s, { type: "damage", target: sleeper.id, amount: 5 }));
    expect(s.removed.some((p) => p.id === scheme.id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(before);
    expect(s.attachments.some((p) => p.attachedTo === scheme.id)).toBe(false);
    exact(reload(s));
  });
});

describe("Twisted Reality defeat boundaries", () => {
  it("deals once when a player side scheme resolves its reward and enters Victory", () => {
    let s = settle(
      newGame({
        heroId: "cable",
        aspect: "leadership",
        villainId: "red_skull",
        seed: 4125,
        pacing: "expert",
      }),
    );
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.form = "hero";
    s.player.deck.push(...s.player.hand.splice(0));
    const scheme = take(s, "40027", "p1");
    scheme.ownerId = "p1";
    scheme.playerSideSchemeController = "p1";
    scheme.counters = 3;
    s.sideSchemes.push(scheme);
    s = settle(
      reveal(s, "04135"),
      (v) => v.prompt?.options.find((o) => o.id === scheme.id)?.id,
    );
    const reality = s.attachments.find((p) => p.code === "04135")!,
      before = s.encounter.dealt.length;
    s = settle(native(s, { type: "thwart", target: scheme.id, amount: 3 }));
    expect(s.encounter.dealt).toHaveLength(before + 1);
    expect(s.victoryDisplay?.some((p) => p.id === scheme.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === reality.id)).toBe(true);
    expect(s.redSkull!.sideDiscard.some((p) => p.id === scheme.id)).toBe(false);
    exact(reload(s));
  });
  it("does not trigger when all threat is removed from a Permanent scheme", () => {
    let s = settle(
      newGame({
        heroId: "phoenix",
        aspect: "justice",
        villainId: "red_skull",
        seed: 4125,
        pacing: "expert",
      }),
    );
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.form = "hero";
    s.player.deck.push(...s.player.hand.splice(0));
    s = settle(reveal(s, "01190"));
    const scheme = s.sideSchemes.find((p) => p.code === "34030")!;
    expect(scheme).toBeTruthy();
    s = settle(
      reveal(s, "04135"),
      (v) => v.prompt?.options.find((o) => o.id === scheme.id)?.id,
    );
    const before = s.encounter.dealt.length;
    s = settle(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: Math.max(1, scheme.counters),
      }),
    );
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(0);
    expect(s.encounter.dealt).toHaveLength(before);
    expect(
      s.attachments.some(
        (p) => p.code === "04135" && p.attachedTo === scheme.id,
      ),
    ).toBe(true);
    exact(reload(s));
  });
});

describe("Red Skull original attachments and activations", () => {
  it.each(["04132", "04133"])(
    "%s discards only after paying all three required resource types",
    (code) => {
      let s = settle(reveal(started(), code));
      const p = s.attachments.find((p) => p.code === code)!;
      const costs = [
        resource(s, "energy"),
        resource(s, "mental"),
        resource(s, "physical"),
      ];
      expect(abilityOptions(s, p).some((o) => o.id === "remove")).toBe(true);
      s = command(s, { type: "ABILITY", id: p.id, action: "remove" });
      expect([...s.prompt!.requirements!].sort()).toEqual([
        "energy",
        "mental",
        "physical",
      ]);
      s = settle(
        command(reload(s), { type: "PAY", ids: costs.map((p) => p.id) }),
      );
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
      for (const p of costs)
        expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
      exact(s);
    },
  );
  it("Luger adds ATK and SCH, pierces Tough, and attaches from its boost face", () => {
    let s = started();
    const luger = top(s, "04132")[0];
    s.player.tough = true;
    s.player.toughCards = 1;
    const hp = s.player.hp;
    s = settle(attack(s));
    expect(s.attachments.find((p) => p.id === luger.id)?.attachedTo).toBe(
      s.villain.id,
    );
    expect(enemyStats(s, s.villain)).toMatchObject({ attack: 2, scheme: 3 });
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(hp - 2);
    exact(s);
  });
  it("both Right Hooks stack Retaliate and blanking one removes only its contribution", () => {
    let s = clearHouse(started());
    s = settle(reveal(s, "04133"));
    s = settle(reveal(s, "04133"));
    const hp = s.player.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.player.hp).toBe(hp - 2);
    blank(s, s.attachments[0]);
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.player.hp).toBe(hp - 3);
    exact(s);
  });
  it("Master Strategist consumes only one copy per activation and adds a boost for each side scheme", () => {
    let s = started();
    s = settle(reveal(s, "04143"));
    s = settle(reveal(s, "04134"));
    s = settle(reveal(s, "04134"));
    const strategies = s.attachments
      .filter((p) => p.code === "04134")
      .map((p) => p.id);
    top(s, "04133", "04137", "04138");
    s.player.form = "alter";
    // 2 printed SCH + boosts 3,1,2 = 8: stage one completes, stage two begins.
    s = settle(
      native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
    );
    expect(s.attachments.filter((p) => p.code === "04134")).toHaveLength(1);
    expect(
      s.encounter.discard.filter((p) => strategies.includes(p.id)),
    ).toHaveLength(1);
    expect(s.scheme.code).toBe("04129b");
    exact(reload(s));
  });
  it("Hydra Exo-Soldier boosts give Tough and an additional original boost", () => {
    let s = started();
    const boosts = top(s, "04131", "04133"),
      hp = s.player.hp;
    s = settle(attack(s));
    expect(s.villain.tough).toBe(true);
    expect(s.player.hp).toBe(hp - 4);
    for (const p of boosts)
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
    exact(s);
  });
  it.each(["hero", "alter"] as const)(
    "Infinite Power grants Tough before a %s activation",
    (form) => {
      let s = started();
      s.player.form = form;
      top(s, "01186");
      const hp = s.player.hp;
      s = settle(reveal(s, "04138"));
      expect(s.villain.tough).toBe(true);
      if (form === "hero") expect(s.player.hp).toBe(hp - 1);
      else expect(s.scheme.threat).toBe(2);
      exact(s);
    },
  );
});

describe("Red Skull schemes, treacheries and ownership", () => {
  it("Twisted Reality applies Incite and deals an encounter card to the first player when defeated", () => {
    let s = started("standard", 2);
    s.firstPlayerId = "p2";
    const house = s.sideSchemes[0],
      before = s.encounter.dealt.length;
    s = settle(
      reveal(s, "04135", "p1"),
      (v) => v.prompt?.options.find((o) => o.id === house.id)?.id,
    );
    const reality = s.attachments.find((p) => p.code === "04135")!;
    expect(reality.attachedTo).toBe(house.id);
    expect(s.scheme.threat).toBe(1);
    s = settle(defeat(s, "04139", "p1"));
    expect(s.encounter.dealt).toHaveLength(before + 1);
    expect(s.encounter.dealt.at(-1)?.dealtTo).toBe("p2");
    expect(s.encounter.discard.some((p) => p.id === reality.id)).toBe(true);
    exact(reload(s));
  });
  it("Bitter Rival exhausts distinct controlled characters and leaves the teammate ready", () => {
    let s = started("standard", 2);
    const owned = ally(s),
      other = ally(s, "p2");
    s = settle(reveal(s, "04143"));
    s = settle(reveal(s, "04136", "p1"));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === owned.id)?.exhausted).toBe(
      true,
    );
    expect(seatView(s, "p2").player.exhausted).toBe(false);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === other.id)?.exhausted,
    ).toBe(false);
    exact(s);
  });
  it("Bitter Rival boost exhausts only one controlled character", () => {
    let s = started();
    const owned = ally(s);
    top(s, "04136");
    s.player.form = "alter";
    s = settle(
      native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
    );
    expect(
      Number(s.player.exhausted) +
        Number(!!s.player.inPlay.find((p) => p.id === owned.id)?.exhausted),
    ).toBe(1);
    exact(s);
  });
  it("Spreading Lies places two threat on every current scheme", () => {
    let s = started();
    s = settle(reveal(s, "04143"));
    const before = s.sideSchemes.map((p) => ({ id: p.id, threat: p.counters }));
    s = settle(reveal(s, "04137"));
    expect(s.scheme.threat).toBe(2);
    for (const p of before)
      expect(s.sideSchemes.find((q) => q.id === p.id)?.counters).toBe(
        p.threat + 2,
      );
    exact(s);
  });
  it("Spreading Lies boost grants Tough without placing threat", () => {
    let s = started();
    top(s, "04137");
    s = settle(attack(s));
    expect(s.villain.tough).toBe(true);
    expect(s.scheme.threat).toBe(0);
    exact(s);
  });
  it("Prison Camps puts the defeating player's chosen original ally into play", () => {
    let s = started("standard", 2);
    const owner = seatView(s, "p2").player;
    const chosen = owner.deck.find((p) => card(p).type_code === "ally")!;
    owner.deck.splice(owner.deck.indexOf(chosen), 1);
    owner.discard.push(chosen);
    s = settle(reveal(s, "04141"));
    s = defeat(s, "04141", "p2");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === chosen.id));
    s = settle(choose(reload(s), chosen.id));
    expect(
      seatView(s, "p2").player.inPlay.some((p) => p.id === chosen.id),
    ).toBe(true);
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === chosen.id),
    ).toBe(false);
    exact(s);
  });
  it("Censor the Past returns up to three selected originals per player after reloads", () => {
    let s = started("standard", 2);
    const ids = s.players.map((seat) => {
      const p = seatView(s, seat).player,
        cards = p.deck.splice(0, 4);
      p.discard.push(...cards);
      return cards.slice(0, 3).map((p) => p.id);
    });
    s = settle(reveal(s, "04142"));
    s = defeat(s, "04142", "p2");
    s = settle(
      s,
      (v) => v.prompt?.options.find((o) => ids.flat().includes(o.id))?.id,
    );
    for (let i = 0; i < s.players.length; i++) {
      const p = seatView(s, s.players[i]).player;
      for (const id of ids[i])
        expect(p.deck.some((c) => c.id === id)).toBe(true);
      expect(p.discard).toHaveLength(1);
    }
    exact(reload(s));
  });
  it("Hydra Reinforcements discards an original non-Elite minion without its defeat effect", () => {
    let s = started();
    const soldier = take(s, "04153");
    s = settle(
      native(s, { type: "mutagen:put-minion", piece: soldier, playerId: "p1" }),
    );
    s = settle(reveal(s, "04143"));
    const before = s.encounter.dealt.length;
    s = settle(
      defeat(s, "04143"),
      (v) => v.prompt?.options.find((o) => o.id === soldier.id)?.id,
    );
    expect(s.minions.some((p) => p.id === soldier.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === soldier.id)).toBe(true);
    expect(s.encounter.dealt).toHaveLength(before);
    exact(s);
  });
  it("Mass Chaos counts different printed resource types separately for each player", () => {
    let s = started("standard", 2),
      expected = 0;
    const discarded: string[] = [];
    for (const seat of s.players) {
      const p = seatView(s, seat).player,
        types = new Set<Resource>();
      for (const piece of p.deck.slice(0, 5)) {
        discarded.push(piece.id);
        for (const type of ["energy", "mental", "physical", "wild"] as const)
          if (card(piece)[`resource_${type}`]) types.add(type);
      }
      expected += types.size;
    }
    s = settle(reveal(s, "04144"));
    expect(s.sideSchemes.find((p) => p.code === "04144")?.counters).toBe(
      expected,
    );
    const actual = s.players.flatMap((seat) =>
      seatView(s, seat).player.discard.map((p) => p.id),
    );
    for (const id of discarded) expect(actual).toContain(id);
    exact(reload(s));
  });
});

describe("Red Skull cross-hero timing regressions", () => {
  it.each(["attack", "scheme"] as const)(
    "an Exo-Soldier boost during Dark Phoenix's %s stores the extra boost for Red Skull",
    (kind) => {
      let s = settle(
        newGame({
          heroId: "phoenix",
          aspect: "justice",
          villainId: "red_skull",
          seed: 4125,
          pacing: "expert",
        }),
      );
      s = settle(command(s, { type: "MULLIGAN", ids: [] }));
      s.player.form = "hero";
      s.player.deck.push(...s.player.hand.splice(0));
      s = settle(reveal(s, "01190"));
      const dark = s.minions.find((p) => p.code === "34029")!,
        world = s.sideSchemes.find((p) => p.code === "34030")!;
      s = settle(
        native(s, { type: "thwart", target: world.id, amount: world.counters }),
      );
      const [exo, extra] = top(s, "04131", "04133"),
        hp = s.player.hp;
      s = settle(
        native(s, {
          type: kind === "attack" ? "enemyAttack" : "enemyScheme",
          id: dark.id,
          actorId: "p1",
          activation: { enemyId: dark.id, playerId: "p1", kind },
        }),
      );
      expect(s.error).toBeUndefined();
      expect(s.villain.tough).toBe(true);
      expect(s.encounter.discard.some((p) => p.id === exo.id)).toBe(true);
      expect(s.encounter.storedBoosts?.map((p) => p.id)).toEqual([extra.id]);
      expect(s.encounter.discard.some((p) => p.id === extra.id)).toBe(false);
      if (kind === "attack") expect(s.player.hp).toBe(hp - 2);
      else
        expect(s.sideSchemes.find((p) => p.id === world.id)?.counters).toBe(2);
      exact(reload(s));
      // Remove the amplify icon before the next activation; the stored original
      // now resolves for Red Skull, alongside his normal zero-icon boost.
      const current = s.sideSchemes.find((p) => p.id === world.id)!;
      if (current.counters)
        s = settle(
          native(s, {
            type: "thwart",
            target: world.id,
            amount: current.counters,
          }),
        );
      top(s, "01186");
      s = settle(
        native(s, { type: "enemyScheme", id: s.villain.id, actorId: "p1" }),
      );
      expect(s.encounter.storedBoosts || []).toHaveLength(0);
      expect(s.encounter.discard.some((p) => p.id === extra.id)).toBe(true);
      expect(s.scheme.threat).toBe(5);
      exact(reload(s));
    },
  );
  it.each(["atk", "thw"] as const)(
    "Giant Wasp chooses %s at a sole Red House target using the original Helmet's stats",
    (stat) => {
      let s = settle(
        newGame({
          heroId: "wsp",
          aspect: "aggression",
          villainId: "red_skull",
          seed: 4125,
          pacing: "expert",
        }),
      );
      s = settle(command(s, { type: "MULLIGAN", ids: [] }));
      s.player.form = "hero";
      s.player.heroForm = "giant";
      s.player.deck.push(...s.player.hand.splice(0));
      const helmet = take(s, "13010", "p1");
      s.player.inPlay.push(helmet);
      const house = s.sideSchemes[0];
      s = command(s, { type: "BASIC", action: "thwart" });
      s = until(
        s,
        (v) => !!v.prompt?.options.some((o) => o.id.endsWith(`:${stat}`)),
      );
      expect(s.prompt!.options.some((o) => o.id.endsWith(":atk"))).toBe(true);
      expect(s.prompt!.options.some((o) => o.id.endsWith(":thw"))).toBe(true);
      s = settle(
        choose(
          reload(s),
          s.prompt!.options.find((o) => o.id.endsWith(`:${stat}`))!.id,
        ),
      );
      if (stat === "atk")
        expect(s.sideSchemes.find((p) => p.id === house.id)?.counters).toBe(1);
      else
        expect(s.redSkull!.sideDiscard.some((p) => p.id === house.id)).toBe(
          true,
        );
      expect(s.player.exhausted).toBe(true);
      exact(reload(s));
    },
  );
  it("Confused replaces Giant Wasp's basic thwart before any Red House stat selection", () => {
    let s = settle(
      newGame({
        heroId: "wsp",
        aspect: "aggression",
        villainId: "red_skull",
        seed: 4125,
        pacing: "expert",
      }),
    );
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.form = "hero";
    s.player.heroForm = "giant";
    s.player.deck.push(...s.player.hand.splice(0));
    s.player.confused = true;
    s.player.confuseCards = 1;
    const house = s.sideSchemes[0];
    s = command(s, { type: "BASIC", action: "thwart" });
    expect(s.prompt).toBeNull();
    expect(s.player.confused).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.sideSchemes.find((p) => p.id === house.id)?.counters).toBe(3);
    exact(reload(s));
  });
});

describe("Red House substitutes only explicit hero THW components", () => {
  function responseTeam() {
    const codes = deckCodes("spider_man", "protection");
    const replace = codes.findIndex(
      (code) => card(code).faction_code === "protection",
    );
    expect(replace).toBeGreaterThanOrEqual(0);
    codes[replace] = "18031";
    let s = settle(
      newGame({
        heroId: "cable",
        aspect: "justice",
        villainId: "red_skull",
        seed: 4125,
        pacing: "expert",
        heroes: [
          { heroId: "cable", aspect: "justice" },
          { heroId: "spider_man", aspect: "protection", deckCards: codes },
        ],
      }),
    );
    for (let i = 0; i < 2; i++)
      s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    for (const seat of s.players) {
      const p = seatView(s, seat).player;
      p.form = "hero";
      p.deck.push(...p.hand.splice(0));
    }
    return reload(s);
  }
  function defend(s: GameState, playerId: string) {
    top(s, "01186");
    s = attack(s, playerId);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "hero"));
    return choose(reload(s), "hero");
  }
  function useStat(s: GameState, id: string, stat: "atk" | "thw") {
    if (s.prompt?.options.some((o) => o.id === id)) s = choose(reload(s), id);
    s = until(s, (v) => v.prompt?.title === "The Red House");
    expect(s.prompt!.options.some((o) => o.id === "atk")).toBe(true);
    expect(s.prompt!.options.some((o) => o.id === "thw")).toBe(true);
    return settle(choose(reload(s), stat));
  }
  it.each(["atk", "thw"] as const)(
    "True Grit's actual paid defense response uses its controller's %s and original event",
    (stat) => {
      let s = responseTeam();
      const player = seatView(s, "p2").player,
        grit = take(s, "18031", "p2"),
        payer = player.deck.find((p) => !!card(p).resource_energy)!;
      player.deck.splice(player.deck.indexOf(payer), 1);
      player.hand.push(grit, payer);
      const house = s.sideSchemes.find((p) => p.code === "04139")!,
        before = house.counters;
      expect(heroStats(seatView(s, "p2"))).toMatchObject({
        attack: 2,
        thwart: 1,
      });
      s = defend(s, "p2");
      s = until(
        s,
        (v) => !!v.prompt?.options.some((o) => /True Grit/.test(o.label)),
      );
      s = choose(
        reload(s),
        s.prompt!.options.find((o) => /True Grit/.test(o.label))!.id,
      );
      expect(s.prompt?.kind).toBe("payment");
      s = command(reload(s), { type: "PAY", ids: [payer.id] });
      s = useStat(s, house.id, stat);
      expect(s.sideSchemes.find((p) => p.id === house.id)?.counters).toBe(
        before - (stat === "atk" ? 2 : 1),
      );
      for (const source of [grit, payer])
        expect(
          seatView(s, "p2").player.discard.some((p) => p.id === source.id),
        ).toBe(true);
      expect(seatView(s, "p1").player.exhausted).toBe(false);
      expect(seatView(s, "p2").player.exhausted).toBe(true);
      exact(reload(s));
    },
  );
  it.each(["atk", "thw"] as const)(
    "Askani'son's actual paid defense response chooses %s without changing the defending seat",
    (stat) => {
      let s = responseTeam();
      const title = take(s, "40009", "p1"),
        intuition = take(s, "01065", "p1");
      s.player.inPlay.push(title, intuition);
      const payer = resource(s, "energy"),
        house = s.sideSchemes.find((p) => p.code === "04139")!,
        before = house.counters;
      expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 3 });
      s = defend(s, "p1");
      s = respond(s, /Askani/);
      expect(s.prompt?.kind).toBe("payment");
      s = command(reload(s), { type: "PAY", ids: [payer.id] });
      s = useStat(s, house.id, stat);
      expect(s.sideSchemes.find((p) => p.id === house.id)?.counters).toBe(
        before - (stat === "atk" ? 2 : 3),
      );
      expect(
        seatView(s, "p1").player.inPlay.find((p) => p.id === title.id)
          ?.exhausted,
      ).toBe(true);
      expect(
        seatView(s, "p1").player.discard.some((p) => p.id === payer.id),
      ).toBe(true);
      expect(seatView(s, "p1").player.exhausted).toBe(true);
      expect(seatView(s, "p2").player.exhausted).toBe(false);
      exact(reload(s));
    },
  );
  it("For Justice keeps its fixed four-threat amount without a Red House stat choice", () => {
    let s = started("standard", 2);
    const event = take(s, "01060", "p1"),
      genius = take(s, "01089", "p1"),
      house = s.sideSchemes[0],
      before = house.counters;
    s.player.hand.push(event, genius);
    s = command(s, { type: "PLAY", id: event.id });
    expect(s.prompt?.kind).toBe("payment");
    s = command(reload(s), { type: "PAY", ids: [genius.id] });
    expect(s.prompt?.title).not.toBe("The Red House");
    s = settle(s, (v) => {
      expect(v.prompt?.title).not.toBe("The Red House");
      return v.prompt?.options.find((o) => o.id === house.id)?.id;
    });
    expect(s.sideSchemes.find((p) => p.id === house.id)?.counters).toBe(
      before - 4,
    );
    expect(s.player.exhausted).toBe(false);
    for (const source of [event, genius])
      expect(s.player.discard.some((p) => p.id === source.id)).toBe(true);
    exact(reload(s));
  });
});

describe("Red House and composite hero-stat events", () => {
  it.each(["atk", "thw"] as const)(
    "Push Ahead chooses %s only for its THW component and retains ATK plus DEF",
    (stat) => {
      const codes = deckCodes("spider_man", "leadership");
      const replace = codes.findIndex(
        (code) => card(code).faction_code === "leadership",
      );
      expect(replace).toBeGreaterThanOrEqual(0);
      codes[replace] = "29018";
      let s = settle(
        newGame({
          heroId: "spider_man",
          aspect: "leadership",
          villainId: "red_skull",
          seed: 4125,
          pacing: "expert",
          heroes: [
            { heroId: "spider_man", aspect: "leadership", deckCards: codes },
          ],
        }),
      );
      s = settle(command(s, { type: "MULLIGAN", ids: [] }));
      s.player.form = "hero";
      s.player.deck.push(...s.player.hand.splice(0));
      const house = s.sideSchemes[0];
      s = settle(native(s, { type: "threat", target: house.id, amount: 6 }));
      const event = take(s, "29018", "p1"),
        genius = take(s, "01089", "p1"),
        single = s.player.deck.find(
          (p) =>
            [
              card(p).resource_energy,
              card(p).resource_mental,
              card(p).resource_physical,
              card(p).resource_wild,
            ].reduce<number>((n, v) => n + (v || 0), 0) === 1,
        )!;
      s.player.deck.splice(s.player.deck.indexOf(single), 1);
      s.player.hand.push(event, genius, single);
      expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 1, defense: 3 });
      s = command(s, { type: "PLAY", id: event.id });
      expect(s.prompt?.kind).toBe("payment");
      s = command(reload(s), { type: "PAY", ids: [genius.id, single.id] });
      if (s.prompt?.options.some((o) => o.id === house.id))
        s = choose(reload(s), house.id);
      s = until(s, (v) => v.prompt?.title === "The Red House");
      s = settle(choose(reload(s), stat));
      expect(s.sideSchemes.find((p) => p.id === house.id)?.counters).toBe(
        stat === "atk" ? 2 : 3,
      );
      expect(s.player.exhausted).toBe(true);
      for (const p of [event, genius, single])
        expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
      exact(reload(s));
    },
  );
});
