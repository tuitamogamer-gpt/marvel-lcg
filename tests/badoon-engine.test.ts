/** Brotherhood of Badoon, Ship Command and Band of Badoon exercised with the
 * original physical cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import { CATALOG_CARDS, card, scenarioModules } from "../src/game/cards";
import {
  abilityOptions,
  dispatch,
  enemyStats,
  newGame,
  schemeLimit,
} from "../src/game/engine";
import { paymentSources } from "../src/game/payment";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import {
  BADOON_SCRIPT_CODES,
  badoonKeyword,
  badoonMilano,
  badoonShip,
} from "../src/game/badoon";
import type { GameState, Piece, Resource } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  module?: string,
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "brotherhood_of_badoon",
    difficulty,
    ...(module ? { module } : {}),
    seed: 16058,
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
    s.badoon!.villainDeck,
    s.badoon!.mainDeck,
    [s.badoon!.currentMain],
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** Twelve selected scenario cards and the seven Ship Command cards stay in
 * exactly one zone each. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  const scenario = all.filter(
    (p) => card(p).set_code === "brotherhood_of_badoon",
  );
  expect(scenario).toHaveLength(12);
  expect(all.filter((p) => card(p).set_code === "ship_command")).toHaveLength(
    7,
  );
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of zones(s)) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original encounter:${code}`);
}
function reveal(s: GameState, code: string, actorId = s.activePlayerId) {
  return native(s, { type: "reveal", piece: take(s, code), actorId });
}
function top(s: GameState, ...codes: string[]) {
  const ps = codes.map((code) => take(s, code));
  s.encounter.deck.unshift(...ps);
  return ps;
}
function resource(s: GameState, type: Resource, playerId = s.activePlayerId) {
  const player = seatView(s, playerId).player;
  const p = player.deck.find((p) => card(p)[`resource_${type}`])!;
  expect(p).toBeTruthy();
  player.deck.splice(player.deck.indexOf(p), 1);
  player.hand.push(p);
  return p;
}
function milanoOwner(s: GameState) {
  return s.players.find((seat) =>
    seatView(s, seat).player.inPlay.some((p) => p.code === "16142"),
  )?.id;
}
function playerHp(s: GameState, playerId: string) {
  return seatView(s, playerId).player.hp;
}

describe("Brotherhood of Badoon original source", () => {
  it("registers every face of the scenario, Ship Command and Band of Badoon", () => {
    for (const set of [
      "brotherhood_of_badoon",
      "ship_command",
      "band_of_badoon",
    ]) {
      const source = CATALOG_CARDS.filter(
        (c) => c.set_code === set && c.pack_code === "gmw",
      );
      for (const c of source)
        expect(hasExecutableScript(c.code), c.code).toBe(true);
    }
    expect(BADOON_SCRIPT_CODES).toHaveLength(26);
    expect(scenarioModules("brotherhood_of_badoon")).toHaveLength(31);
    expect(
      scenarioModules("brotherhood_of_badoon").some(
        (m) => m.id === "band_of_badoon",
      ),
    ).toBe(true);
  });
  it.each([1, 2, 3])(
    "sets up the Badoon Ship, the Milano and both stages for %i players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        expect(s.modules).toEqual(["band_of_badoon"]);
        expect(s.villain.code).toBe(
          difficulty === "expert" ? "16059" : "16058",
        );
        expect(s.villain.hp).toBe(
          (difficulty === "expert" ? 14 : 13) * players,
        );
        expect(s.scheme).toMatchObject({ code: "16061b", threat: 2 * players });
        expect(schemeLimit(s)).toBe(8 * players);
        expect(badoonShip(s)?.counters).toBe(0);
        expect(milanoOwner(s)).toBe(s.firstPlayerId);
        expect(badoonMilano(s)?.ownerId).toBeUndefined();
        for (const p of s.encounter.deck)
          expect(
            ["villain", "main_scheme", "support"].includes(card(p).type_code),
            p.code,
          ).toBe(false);
        expect(s.encounter.deck.filter((p) => p.code === "16063")).toHaveLength(
          0,
        );
        expect(
          s.encounter.deck.filter((p) => card(p).set_code === "ship_command"),
        ).toHaveLength(6);
        expect(
          s.encounter.deck.filter((p) => card(p).set_code === "band_of_badoon"),
        ).toHaveLength(10);
        // Expert's Drang (II) finds and attaches Drang's Spear at setup.
        expect(s.attachments.map((p) => p.code)).toEqual(
          difficulty === "expert" ? ["16064"] : [],
        );
        exact(reload(s));
      }
    },
  );
  it("advances the physical villain stages and wins after the last one", () => {
    let s = started("standard", 2);
    const old = s.villain.id;
    s = settle(
      native(s, { type: "damage", target: old, amount: s.villain.hp }),
    );
    expect(s.villain.code).toBe("16059");
    expect(s.villain.hp).toBe(28);
    expect(s.removed.some((p) => p.id === old)).toBe(true);
    // Drang (II) searched out Drang's Spear and attached it.
    expect(
      s.attachments.some(
        (p) => p.code === "16064" && p.attachedTo === s.villain.id,
      ),
    ).toBe(true);
    exact(reload(s));
    s = settle(
      native(s, { type: "damage", target: s.villain.id, amount: s.villain.hp }),
    );
    expect(s.phase).toBe("won");
  });
  it("charges the Badoon Ship when Protect the Planet is revealed and loses when it completes", () => {
    let s = started("standard", 2);
    const old = s.badoon!.currentMain.id;
    s = settle(native(s, { type: "threat", target: "main", amount: 16 }));
    expect(s.scheme).toMatchObject({ code: "16062b", threat: 8, index: 1 });
    expect(badoonShip(s)?.counters).toBe(1);
    expect(s.removed.some((p) => p.id === old)).toBe(true);
    exact(reload(s));
    s = settle(native(s, { type: "threat", target: "main", amount: 8 }));
    expect(s.phase).toBe("lost");
  });
});

describe("Badoon Ship barrage", () => {
  it("adds one barrage counter per Charge Up and fires indirect damage at four", () => {
    let s = started("standard", 2);
    for (let i = 1; i <= 3; i++) {
      s = settle(native(s, { type: "badoon:charge" }));
      expect(badoonShip(s)?.counters).toBe(i);
    }
    const before = [playerHp(s, "p1"), playerHp(s, "p2")];
    s = settle(native(s, { type: "badoon:charge" }));
    expect(badoonShip(s)?.counters).toBe(0);
    const lost =
      before[0] - playerHp(s, "p1") + (before[1] - playerHp(s, "p2"));
    // Indirect damage may land on allies; nothing is in play, so heroes take it.
    expect(lost).toBe(4);
  });
  it("charges after villain phase step one, once more for each Bombardment", () => {
    let s = started();
    s = settle(native(s, { type: "villainStepOne" }));
    expect(badoonShip(s)?.counters).toBe(1);
    s = settle(reveal(s, "16067"));
    expect(s.sideSchemes.map((p) => p.code)).toContain("16067");
    s = settle(native(s, { type: "villainStepOne" }));
    expect(badoonShip(s)?.counters).toBe(3);
  });
  it("charges after Drang schemes and after Badoon Engineer engages", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(
      native(s, {
        type: "enemyScheme",
        id: s.villain.id,
        activation: {
          enemyId: s.villain.id,
          playerId: "p1",
          kind: "scheme",
        },
      }),
    );
    expect(badoonShip(s)?.counters).toBe(1);
    s.player.form = "hero";
    s = settle(reveal(s, "16065"));
    expect(s.minions.map((p) => p.code)).toContain("16065");
    expect(badoonShip(s)?.counters).toBe(2);
  });
});

describe("Drang's stages and Spear", () => {
  it("gives Drang a facedown boost when the Spear is already attached", () => {
    let s = started("expert");
    expect(s.attachments.map((p) => p.code)).toEqual(["16064"]);
    const boosts = (s.encounter.storedBoosts || []).length;
    s = settle(native(s, { type: "badoon:spear" }));
    expect((s.encounter.storedBoosts || []).length).toBeGreaterThan(boosts);
  });
  it("grants stalwart while the Spear is attached and discards it for M+P+P", () => {
    let s = started("expert");
    expect(badoonKeyword(s, s.villain, "Stalwart")).toBe(true);
    s.villain.stunned = false;
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    const spear = s.attachments.find((p) => p.code === "16064")!;
    const paid = [
      resource(s, "mental"),
      resource(s, "physical"),
      resource(s, "physical"),
    ];
    expect(
      abilityOptions(s, spear).some((o) => /Drang's Spear/.test(o.label)),
    ).toBe(true);
    s = command(reload(s), { type: "ABILITY", id: spear.id, action: "remove" });
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: paid.map((p) => p.id) });
    s = settle(s);
    expect(s.attachments.some((p) => p.id === spear.id)).toBe(false);
    exact(s);
  });
  it("Drang (III) discards the top four per hero and engages each minion with the least engaged player", () => {
    let s = started("standard", 2);
    top(s, "16065", "16066", "16065", "16145");
    s.minions.push(take(s, "16117"));
    s.minions.at(-1)!.engagedWith = "p1";
    s = settle(native(s, { type: "badoon:drang-discard", remaining: 4 }));
    const engineers = s.minions.filter((p) => p.code === "16065");
    expect(engineers).toHaveLength(2);
    // p2 had no minions: the first Engineer engages p2, then the tie is chosen.
    expect(engineers[0].engagedWith).toBe("p2");
    expect(s.encounter.discard.map((p) => p.code)).toEqual(
      expect.arrayContaining(["16066", "16145"]),
    );
    exact(reload(s));
  });
});

describe("Milano and First Player Actions", () => {
  it("removes 3 threat from the main scheme by exhausting the first player's Milano", () => {
    let s = started();
    s.scheme.threat = 5;
    const main = s.badoon!.currentMain;
    const options = abilityOptions(s, main);
    expect(options.map((o) => o.id)).toContain("milano");
    s = settle(command(reload(s), { type: "ABILITY", id: main.id }));
    expect(s.scheme.threat).toBe(2);
    expect(badoonMilano(s)?.exhausted).toBe(true);
    expect(abilityOptions(s, s.badoon!.currentMain)).toEqual([]);
  });
  it("offers side-scheme actions only to the first player", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "16069"));
    const scheme = s.sideSchemes.find((p) => p.code === "16069")!;
    expect(scheme.counters).toBe(6);
    expect(abilityOptions(s, scheme).map((o) => o.id)).toContain("milano");
    s = settle(command(reload(s), { type: "ABILITY", id: scheme.id }));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(3);
    // Second player's turn: the Milano belongs to the first player.
    const second = dispatch(reload(s), {
      type: "ABILITY",
      id: scheme.id,
    });
    expect(second.error).toBeTruthy();
  });
  it("lets the first player deal 3 damage to a minion on Protect the Planet", () => {
    let s = started();
    s = settle(native(s, { type: "threat", target: "main", amount: 8 }));
    expect(s.scheme.code).toBe("16062b");
    s = settle(reveal(s, "16120"));
    const sentry = s.minions.find((p) => p.code === "16120")!;
    s = settle(
      command(reload(s), {
        type: "ABILITY",
        id: s.badoon!.currentMain.id,
        action: "milano-minion",
      }),
    );
    expect(s.minions.find((p) => p.id === sentry.id)?.damage).toBe(3);
  });
  it("generates a wild resource for any player and passes to the next first player", () => {
    let s = started("standard", 2);
    const milano = badoonMilano(s)!;
    const own = paymentSources(s).find((p) => p.code === "16142");
    expect(own).toMatchObject({ resources: ["wild"], kind: "ability" });
    // Another player may use the first player's Milano.
    const other = reload(s);
    other.activePlayerId = "p2";
    other.player = other.players[1].player;
    other.flags = other.players[1].flags;
    other.heroId = other.players[1].heroId;
    const shared = paymentSources(other).find((p) => p.code === "16142");
    expect(shared).toMatchObject({ playerId: "p1", resources: ["wild"] });
    expect(milano.exhausted).toBe(false);
    // End the round: the first player token and the Milano move to p2.
    s = settle(native(s, { type: "newRound" }));
    expect(s.firstPlayerId).toBe("p2");
    expect(milanoOwner(s)).toBe("p2");
    exact(s);
  });
  it("pays another player's cost with the first player's Milano", () => {
    let s = started("standard", 2);
    s = native(s, {
      type: "payRequest",
      title: "Fixture cost",
      cost: 1,
      after: [],
      actorId: "p2",
      abilityCost: true,
    });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.activePlayerId).toBe("p2");
    const source = paymentSources(s).find((p) => p.code === "16142")!;
    expect(source).toMatchObject({ playerId: "p1", resources: ["wild"] });
    s = settle(command(s, { type: "PAY", ids: [source.id] }));
    expect(badoonMilano(s)?.exhausted).toBe(true);
    expect(milanoOwner(s)).toBe("p1");
    exact(s);
  });
  it("discards Rogue Vessel for the Milano plus two resources and damages each player when the villain phase ends", () => {
    let s = started("standard", 2);
    s = settle(reveal(s, "16143"));
    expect((s.environments || []).map((p) => p.code)).toContain("16143");
    const before = [playerHp(s, "p1"), playerHp(s, "p2")];
    s = settle(native(s, { type: "newRound" }));
    expect(playerHp(s, "p1")).toBe(before[0] - 1);
    expect(playerHp(s, "p2")).toBe(before[1] - 1);
    // Back on the first player's turn with a ready Milano.
    const vessel = (s.environments || []).find((p) => p.code === "16143")!;
    const first = s.firstPlayerId;
    s.activePlayerId = first;
    s.player = s.players.find((p) => p.id === first)!.player;
    const paid = [resource(s, "energy"), resource(s, "mental")];
    badoonMilano(s)!.exhausted = false;
    expect(abilityOptions(s, vessel).map((o) => o.id)).toContain("milano");
    s = command(reload(s), { type: "ABILITY", id: vessel.id });
    expect(s.prompt?.kind).toBe("payment");
    s = settle(command(s, { type: "PAY", ids: paid.map((p) => p.id) }));
    expect((s.environments || []).some((p) => p.id === vessel.id)).toBe(false);
    expect(badoonMilano(s)?.exhausted).toBe(true);
    exact(s);
  });
});

describe("Ship Command treacheries", () => {
  it.each([
    ["16145", "first", (s: GameState) => s.players[0].player.stunned],
    ["16147", "first", () => true],
  ] as const)(
    "%s offers the Milano, typed resources or the first-player penalty",
    (code, pick, check) => {
      let s = started();
      s = reveal(s, code);
      expect(s.prompt?.options.map((o) => o.id)).toEqual(
        expect.arrayContaining(["milano", pick]),
      );
      s = settle(choose(s, pick));
      expect(check(s)).toBeTruthy();
      exact(s);
    },
  );
  it("Hull Breach can exhaust the Milano instead of damaging the first player", () => {
    let s = started();
    const hp = s.player.hp;
    s = reveal(s, "16146");
    s = settle(choose(s, "milano"));
    expect(badoonMilano(s)?.exhausted).toBe(true);
    expect(s.player.hp).toBe(hp);
  });
  it("Special Delivery attacks with +1 ATK unless the Milano is exhausted", () => {
    let s = started();
    badoonMilano(s)!.exhausted = true;
    const hp = s.player.hp;
    s = reveal(s, "16148");
    expect(s.prompt?.options.map((o) => o.id)).toEqual(["villain"]);
    s = settle(choose(s, "villain"));
    expect(s.player.hp).toBeLessThan(hp);
  });
});

describe("Band of Badoon", () => {
  it("Badoon Assassin attacks with +2 ATK after engaging a hero", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(reveal(s, "16117"));
    expect(s.minions.map((p) => p.code)).toContain("16117");
    // 1 ATK + 2, defended by nobody, minus no DEF.
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(3);
  });
  it("Badoon Grunt deals a facedown encounter card only when engaging alone", () => {
    let s = started();
    const dealt = s.encounter.dealt.length;
    s = settle(reveal(s, "16118"));
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    s = settle(reveal(s, "16118"));
    expect(s.encounter.dealt.length).toBe(dealt + 1);
  });
  it("Badoon Warlord's attacks have overkill; Assassin's boost grants overkill, piercing and ranged", () => {
    let s = started();
    s = settle(reveal(s, "16121"));
    const warlord = s.minions.find((p) => p.code === "16121")!;
    expect(badoonKeyword(s, warlord, "Overkill")).toBe(true);
    expect(badoonKeyword(s, s.villain, "Overkill")).toBe(false);
    s.attack = {
      id: "fixture",
      attacker: s.villain.id,
      target: "hero",
    } as unknown as GameState["attack"];
    s = native(s, { type: "badoon:attack-keywords" });
    for (const name of ["Overkill", "Piercing", "Ranged"])
      expect(badoonKeyword(s, s.villain, name), name).toBe(true);
  });
  function villainAttack(s: GameState, boost: string) {
    top(s, boost);
    return settle(
      native(s, {
        type: "enemyAttack",
        id: s.villain.id,
        actorId: "p1",
        activation: { enemyId: s.villain.id, playerId: "p1", kind: "attack" },
      }),
      (state) =>
        state.prompt?.options.find((o) => /take|no defender/i.test(o.label))
          ?.id,
    );
  }
  it("Badoon Warlord's boost adds two icons to an attack", () => {
    let s = started();
    const hp = s.player.hp;
    s = villainAttack(s, "16121");
    // Drang (I) 2 ATK + Warlord's two boost-ability icons, undefended.
    expect(hp - s.player.hp).toBe(4);
    exact(s);
  });
  it("Badoon Sentry gives the villain tough, or two icons if already tough", () => {
    let s = started();
    const hp = s.player.hp;
    s = villainAttack(s, "16120");
    expect(s.villain.tough).toBe(true);
    // One printed boost icon.
    expect(hp - s.player.hp).toBe(3);
    const after = s.player.hp;
    s = villainAttack(s, "16120");
    expect(after - s.player.hp).toBe(5);
    exact(s);
  });
  it("Badoon Grunt's boost puts the actual boost card into play engaged with you", () => {
    let s = started();
    const [grunt] = [s.encounter.deck.find((p) => p.code === "16118")!];
    s = villainAttack(s, "16118");
    const engaged = s.minions.find((p) => p.id === grunt.id);
    expect(engaged?.engagedWith).toBe("p1");
    expect(s.encounter.discard.some((p) => p.id === grunt.id)).toBe(false);
    exact(s);
  });
});
