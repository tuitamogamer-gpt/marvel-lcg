/** Hela, the fourth scenario of The Mad Titan's Shadow, with the Legions of
 * Hel and Frost Giants modular sets, exercised with the original physical
 * cards. Every command crosses a JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  scenarioModules,
} from "../src/game/cards";
import { allyCount, enemyStats, newGame } from "../src/game/engine";
import {
  HELA_SCRIPT_CODES,
  helaCanAttach,
  helaOdin,
  helaOdinCaptive,
} from "../src/game/hela";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { GameState, Piece } from "../src/game/types";
import {
  command,
  choose,
  native,
  passId,
  pay,
  reload,
} from "./dv-test-helpers";

const players3 = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "hela",
  modules?: string[],
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 21136,
    pacing: "expert",
    ...(modules ? { modules } : {}),
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
    s.hela?.setAside || [],
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
/** 17 Hela pieces (her card, Odin and fifteen encounter cards; the main
 * scheme is the scheme zone), 7 Legions of Hel and 6 Frost Giants cards
 * each stay in exactly one zone. */
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size, "one zone per physical card").toBe(
    all.length,
  );
  expect(all.filter((p) => card(p).set_code === "hela")).toHaveLength(17);
  expect(all.filter((p) => card(p).set_code === "legions_of_hel")).toHaveLength(
    7,
  );
  expect(all.filter((p) => card(p).set_code === "frost_giants")).toHaveLength(
    6,
  );
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
function stack(s: GameState, ...codes: string[]) {
  s.encounter.deck.unshift(...codes.map((code) => take(s, code)));
  delete s.encounter.knownTop;
}
function attach(s: GameState, code: string) {
  const p = take(s, code);
  p.attachedTo = s.villain.id;
  s.attachments.push(p);
  return p;
}
function engage(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = take(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function playerCard(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  expect(i, `deck card ${code}`).toBeGreaterThanOrEqual(0);
  return p.deck.splice(i, 1)[0];
}
const scheme = (s: GameState, code: string) =>
  s.sideSchemes.find((p) => p.code === code);
const victory = (s: GameState) =>
  (s.victoryDisplay || []).map((p) => p.code).sort();
const stored = (s: GameState) => s.encounter.storedBoosts?.length || 0;
/** Garm leaves play, so threat can be removed from Gnipahellir. */
function noGarm(s: GameState) {
  s.encounter.discard.push(take(s, "21143"));
}
/** Odin's Torment flips Hela to her Wounded side. */
function wound(s: GameState) {
  s = settle(native(s, { type: "damage", target: s.villain.id, amount: 99 }));
  expect(s.villain.code).toMatch(/b$/);
  return s;
}
/** Odin is free: the first player controls him. */
function freeOdin(s: GameState) {
  return settle(native(s, { type: "hela:free-odin" }));
}

describe("Hela original source", () => {
  it("registers every face of the scenario, Legions of Hel and Frost Giants", () => {
    for (const set of ["hela", "legions_of_hel", "frost_giants"])
      for (const c of CATALOG_CARDS.filter(
        (c) =>
          c.set_code === set && c.pack_code === "mts" && c.code !== "21139b",
      )) {
        expect(HELA_SCRIPT_CODES as readonly string[]).toContain(c.code);
        expect(hasExecutableScript(c.code), c.code).toBe(true);
      }
    expect(HELA_SCRIPT_CODES).toHaveLength(27);
    expect(VILLAINS.find((v) => v.id === "hela")).toMatchObject({
      codes: ["21136a", "21137a"],
      schemes: ["21138b"],
      moduleCount: 2,
      defaultModules: ["legions_of_hel", "frost_giants"],
    });
    for (const id of ["legions_of_hel", "frost_giants"])
      expect(MODULES.some((m) => m.id === id)).toBe(true);
    expect(scenarioModules("hela")).toHaveLength(MODULES.length);
  });
  it("reads Gjallerbru and Hall of Nastrond under their printed numbers", () => {
    expect(card("21141")).toMatchObject({
      name: "Gjallerbru",
      base_threat: 3,
      boost: 3,
      scheme_amplify: 1,
    });
    expect(card("21141").scheme_hazard).toBeFalsy();
    expect(card("21142")).toMatchObject({
      name: "Hall of Nastrond",
      base_threat: 4,
      boost: 4,
      scheme_hazard: 1,
    });
    expect(card("21142").scheme_amplify).toBeFalsy();
    expect(card("21142").text).toMatch(/detaches Odin/);
  });
  it.each([1, 2, 3])(
    "attaches Odin, reveals Gnipahellir and Garm and sets the journey aside for %s players",
    (players) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const s = settle(setup(difficulty, players));
        const expert = difficulty === "expert";
        expect(s.villain.code).toBe(expert ? "21137a" : "21136a");
        expect(s.villain.hp).toBe((expert ? 9 : 8) * players);
        expect(s.scheme).toMatchObject({ code: "21138b", threat: players });
        expect(helaOdinCaptive(s)).toBe(true);
        expect(helaOdin(s)?.attachedTo).toBe("main:21138b");
        // Base threat 2 and hinder 1 per player.
        expect(scheme(s, "21140")?.counters).toBe(2 + players);
        const garm = s.minions.find((p) => p.code === "21143")!;
        expect(garm.engagedWith).toBe(s.firstPlayerId);
        expect(garm.tough).toBe(true);
        expect(s.hela!.setAside.map((p) => p.code).sort()).toEqual([
          "21141",
          "21142",
          "21144",
          "21145",
        ]);
        expect(
          s.encounter.deck.filter((p) =>
            ["21139a", "21139b", "21140", "21141", "21142", "21143"].includes(
              p.code,
            ),
          ),
        ).toEqual([]);
        expect(s.modules).toEqual(["legions_of_hel", "frost_giants"]);
        exact(reload(s));
      }
    },
  );
});

describe("Hela's two sides", () => {
  it("Odin's Torment flips Hela to her Wounded side instead of defeating her, discarding each attachment", () => {
    let s = started();
    const sword = attach(s, "21146");
    // A player card attached to Hela is discarded as well.
    const webbed = playerCard(s, "01009");
    webbed.attachedTo = s.villain.id;
    s.player.inPlay.push(webbed);
    s.villain.stunned = true;
    s = wound(s);
    expect(s.player.inPlay.some((p) => p.id === webbed.id)).toBe(false);
    expect(s.player.discard.map((p) => p.id)).toContain(webbed.id);
    expect(s.phase).not.toBe("won");
    expect(s.villain.code).toBe("21136b");
    expect([s.villain.hp, s.villain.maxHp]).toEqual([0, 0]);
    expect(s.attachments.some((p) => p.id === sword.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === sword.id)).toBe(true);
    // Status cards remain attached.
    expect(s.villain.stunned).toBe(true);
    exact(s);
  });
  it("Wounded Hela has infinite hit points: she takes damage but cannot be defeated", () => {
    let s = wound(started());
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 40 }));
    expect(s.villain.code).toBe("21136b");
    expect(s.villain.hp).toBe(0);
    expect(s.phase).not.toBe("won");
    expect(enemyStats(s, s.villain)).toEqual({ attack: 0, scheme: 0 });
    exact(s);
  });
  it("Wounded Hela (B) keeps 1 ATK and 1 SCH", () => {
    const s = wound(started("expert"));
    expect(s.villain.code).toBe("21137b");
    expect(enemyStats(s, s.villain)).toEqual({ attack: 1, scheme: 1 });
  });
  it("flips back to her Mystic side after a side scheme is defeated, with her Victory bonus", () => {
    let s = wound(started());
    noGarm(s);
    const gnip = scheme(s, "21140")!;
    s = settle(native(s, { type: "thwart", target: gnip.id, amount: 9 }));
    expect(victory(s)).toEqual(["21140"]);
    expect(s.villain.code).toBe("21136a");
    // 8 printed and 2 for the side scheme in the victory display.
    expect([s.villain.hp, s.villain.maxHp]).toEqual([10, 10]);
    expect(enemyStats(s, s.villain)).toEqual({ attack: 2, scheme: 2 });
    exact(s);
  });
  it("any side scheme flips her back, even one without Victory", () => {
    let s = wound(started());
    const legions = take(s, "21155");
    legions.counters = 1;
    s.sideSchemes.push(legions);
    s = settle(native(s, { type: "thwart", target: legions.id, amount: 1 }));
    expect(s.villain.code).toBe("21136a");
    expect(s.villain.hp).toBe(8);
    expect(s.encounter.discard.some((p) => p.id === legions.id)).toBe(true);
    exact(s);
  });
  it("Mystic Hela gains +1 ATK, +1 SCH and +2 hit points per player for each side scheme in the victory display", () => {
    let s = started("standard", 2);
    s.villain.hp -= 3;
    (s.victoryDisplay ||= []).push(take(s, "21142"));
    s = settle(native(s, { type: "threat", target: "main", amount: 0 }));
    expect(s.villain.maxHp).toBe(16 + 4);
    expect(s.villain.hp).toBe(13 + 4);
    expect(enemyStats(s, s.villain)).toEqual({ attack: 2, scheme: 2 });
    exact(s);
  });
  it("Hela (B) gains +3 hit points per player for each side scheme in the victory display", () => {
    let s = started("expert");
    (s.victoryDisplay ||= []).push(take(s, "21142"), take(s, "21141"));
    s = settle(native(s, { type: "threat", target: "main", amount: 0 }));
    expect(s.villain.maxHp).toBe(9 + 6);
    expect(enemyStats(s, s.villain)).toEqual({ attack: 4, scheme: 4 });
  });
});

describe("The Journey Through Hel", () => {
  it("Garm locks Gnipahellir and goes to the victory display", () => {
    let s = started();
    const gnip = scheme(s, "21140")!;
    s = settle(native(s, { type: "thwart", target: gnip.id, amount: 2 }));
    expect(scheme(s, "21140")?.counters).toBe(3);
    const garm = s.minions.find((p) => p.code === "21143")!;
    s = settle(native(s, { type: "damage", target: garm.id, amount: 1 }));
    s = settle(native(s, { type: "damage", target: garm.id, amount: 4 }));
    expect(victory(s)).toEqual(["21143"]);
    s = settle(native(s, { type: "thwart", target: gnip.id, amount: 2 }));
    expect(scheme(s, "21140")?.counters).toBe(1);
    exact(s);
  });
  it("Gnipahellir reveals Gjallerbru and Skurge, Gjallerbru reveals Hall of Nastrond and Nidhogg, and each deals the other player a card", () => {
    let s = started("standard", 2);
    const [first, other] = s.players.map((p) => p.id);
    noGarm(s);
    s = settle(
      native(s, { type: "thwart", target: scheme(s, "21140")!.id, amount: 9 }),
    );
    expect(scheme(s, "21141")?.counters).toBe(3 + 2);
    const skurge = s.minions.find((p) => p.code === "21144")!;
    expect([skurge.engagedWith, skurge.tough]).toEqual([first, true]);
    expect(s.encounter.dealt.map((p) => p.dealtTo)).toEqual([other]);
    // Skurge locks Gjallerbru.
    s = settle(
      native(s, { type: "thwart", target: scheme(s, "21141")!.id, amount: 9 }),
    );
    expect(scheme(s, "21141")?.counters).toBe(5);
    s.encounter.discard.push(take(s, "21144"));
    s = settle(
      native(s, { type: "thwart", target: scheme(s, "21141")!.id, amount: 9 }),
    );
    expect(scheme(s, "21142")?.counters).toBe(4 + 2);
    expect(s.minions.find((p) => p.code === "21145")?.engagedWith).toBe(first);
    expect(s.encounter.dealt.map((p) => p.dealtTo)).toEqual([other, other]);
    expect(victory(s)).toEqual(["21140", "21141"]);
    expect(s.hela!.setAside).toEqual([]);
    exact(s);
  });
  it("Hall of Nastrond frees Odin under the first player's control and deals each player a card", () => {
    let s = started("standard", 2);
    const first = s.firstPlayerId;
    const hall = take(s, "21142");
    hall.counters = 1;
    s.sideSchemes.push(hall);
    s = settle(native(s, { type: "thwart", target: hall.id, amount: 1 }));
    expect(helaOdinCaptive(s)).toBe(false);
    const odin = helaOdin(s)!;
    expect(seatView(s, first).player.inPlay.map((p) => p.id)).toContain(
      odin.id,
    );
    expect(odin.code).toBe("21139a");
    expect(s.encounter.dealt).toHaveLength(2);
    expect(victory(s)).toEqual(["21142"]);
    exact(s);
  });
  it("Skurge's attacks gain piercing and Nidhogg's attacks gain overkill", () => {
    let s = started();
    s.player.tough = true;
    const skurge = engage(s, "21144");
    let hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: skurge.id }));
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(hp - 3);
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    const nidhogg = engage(s, "21145");
    hp = s.player.hp;
    s = settle(
      native(s, { type: "enemyAttack", id: nidhogg.id }),
      (v) => v.prompt?.options.find((o) => o.id === cat.id)?.id,
    );
    // Black Cat has 2 hit points: the other 2 damage reaches Spider-Man.
    expect(
      seatView(s, s.activePlayerId).player.discard.map((p) => p.id),
    ).toContain(cat.id);
    expect(s.player.hp).toBe(hp - 2);
    exact(s);
  });
});

describe("Odin", () => {
  it("follows the first player, ignores the ally limit and cannot have cards attached", () => {
    let s = freeOdin(started("standard", 2));
    const [first, other] = s.players.map((p) => p.id);
    const odin = helaOdin(s)!;
    expect(controllerOf(s, odin.id)).toBe(first);
    expect(allyCount(s)).toBe(0);
    expect(helaCanAttach(s, odin.id)).toBe(false);
    s.firstPlayerId = other;
    s = settle(native(s, { type: "threat", target: "main", amount: 0 }));
    expect(controllerOf(s, odin.id)).toBe(other);
    exact(s);
  });
  it("an ally already leaving play does not count against the ally limit again", () => {
    const s = started();
    const allies = ["01002"].map((code) => playerCard(s, code));
    s.player.inPlay.push(...allies);
    expect(allyCount(s)).toBe(1);
    allies[0].pendingDefeat = true;
    expect(allyCount(s)).toBe(0);
  });
  it("the players win when Mystic Hela is defeated while Odin is free", () => {
    let s = freeOdin(started());
    s = settle(native(s, { type: "damage", target: s.villain.id, amount: 8 }));
    expect(s.phase).toBe("won");
  });
  it("the players lose if Odin leaves play", () => {
    let s = freeOdin(started());
    const odin = helaOdin(s)!;
    s = native(s, { type: "damage", target: odin.id, amount: 6 });
    expect(s.phase).toBe("lost");
  });
  it("the players lose when Odin's Torment is completed", () => {
    const s = native(started(), { type: "threat", target: "main", amount: 18 });
    expect(s.phase).toBe("lost");
  });
});

function controllerOf(s: GameState, id: string) {
  return s.players.find((seat) =>
    seatView(s, seat).player.inPlay.some((p) => p.id === id),
  )?.id;
}

describe("Hela encounter cards", () => {
  it("Nightsword gives Hela +1 ATK and piercing, and attaches as a boost", () => {
    let s = started();
    attach(s, "21146");
    expect(enemyStats(s, s.villain).attack).toBe(2);
    s.player.tough = true;
    stack(s, "01186");
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.tough).toBe(false);
    expect(s.player.hp).toBe(hp - 2);
    exact(s);
    let t = started();
    stack(t, "21146");
    t = settle(native(t, { type: "enemyAttack", id: t.villain.id }));
    expect(
      t.attachments.some(
        (p) => p.code === "21146" && p.attachedTo === t.villain.id,
      ),
    ).toBe(true);
    exact(t);
  });
  it("Hela's Crown gives her +1 SCH and a facedown boost card after she schemes", () => {
    let s = started();
    s.player.form = "alter";
    attach(s, "21147");
    stack(s, "01186");
    s = settle(native(s, { type: "enemyScheme", id: s.villain.id }));
    expect(s.scheme.threat).toBe(1 + 2);
    expect(stored(s)).toBe(1);
    exact(s);
  });
  it("Hela's Cloak makes her stalwart", () => {
    let s = started();
    attach(s, "21148");
    s = settle(
      native(s, { type: "status", target: s.villain.id, status: "stunned" }),
    );
    expect(s.villain.stunned).toBe(false);
    exact(s);
  });
  it("Hela's Domain places 1 threat and 1 more for each side scheme in the victory display", () => {
    let s = started();
    (s.victoryDisplay ||= []).push(take(s, "21142"));
    s = settle(reveal(s, "21149"));
    expect(s.scheme.threat).toBe(1 + 2);
    exact(s);
  });
  it("Hela's Domain's boost places 2 threat when the attack defeats an ally", () => {
    let s = started();
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    stack(s, "21149");
    s = settle(
      native(s, { type: "enemyAttack", id: s.villain.id }),
      (v) => v.prompt?.options.find((o) => o.id === cat.id)?.id,
    );
    expect(s.player.discard.map((p) => p.id)).toContain(cat.id);
    expect(s.scheme.threat).toBe(1 + 2);
    exact(s);
  });
  it("The Queen of Hel makes Hela scheme in alter-ego and places 1 threat on each side scheme", () => {
    let s = started();
    s.player.form = "alter";
    stack(s, "01186");
    s = settle(reveal(s, "21150"));
    expect(s.scheme.threat).toBe(1 + 1);
    expect(scheme(s, "21140")?.counters).toBe(3 + 1);
    exact(s);
  });
  it("The Queen of Hel makes Hela attack a hero", () => {
    let s = started();
    stack(s, "01186");
    const hp = s.player.hp;
    s = settle(reveal(s, "21150"));
    expect(s.player.hp).toBe(hp - 1);
    expect(scheme(s, "21140")?.counters).toBe(4);
    exact(s);
  });
  it("The Wastes of Niffleheim deals indirect damage, more for each side scheme in the victory display", () => {
    let s = started();
    (s.victoryDisplay ||= []).push(take(s, "21142"), take(s, "21141"));
    const hp = s.player.hp;
    s = settle(reveal(s, "21151"));
    expect(s.player.hp).toBe(hp - 3);
    exact(s);
  });
  it("The Wastes of Niffleheim's boost has an icon for each side scheme in the victory display", () => {
    let s = started();
    (s.victoryDisplay ||= []).push(take(s, "21142"), take(s, "21141"));
    s = settle(native(s, { type: "threat", target: "main", amount: 0 }));
    stack(s, "21151");
    const hp = s.player.hp;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    // ATK 1, +2 for the victory display, +2 boost icons.
    expect(s.player.hp).toBe(hp - 5);
    exact(s);
  });
});

describe("Legions of Hel", () => {
  it("Draugr makes the player take 1 damage or place 1 threat on the main scheme", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(reveal(s, "21152"), (v) =>
      v.prompt?.title === "Draugr" ? "threat" : undefined,
    );
    expect(s.scheme.threat).toBe(2);
    expect(s.player.hp).toBe(hp);
    s = settle(reveal(s, "21152"), (v) =>
      v.prompt?.title === "Draugr" ? "damage" : undefined,
    );
    expect(s.player.hp).toBe(hp - 1);
    expect(s.minions.filter((p) => p.code === "21152")).toHaveLength(2);
    exact(s);
  });
  it("Fallen Warrior raises the first ally from your deck as an Undead minion engaged with you", () => {
    let s = started();
    const cat = playerCard(s, "01002");
    const top = ["01088", "01089"].map((code) => playerCard(s, code));
    s.player.deck.unshift(...top, cat);
    s = settle(reveal(s, "21153"));
    const minion = s.minions.find((p) => p.id === cat.id)!;
    expect(minion.engagedWith).toBe(s.activePlayerId);
    const definition = card(minion);
    expect(definition.type_code).toBe("minion");
    expect(definition.scheme).toBe(1);
    expect(definition.traits).toMatch(/Undead/);
    expect(s.player.discard.map((p) => p.id)).toEqual(top.map((p) => p.id));
    // Legions of Hel counts it as an Undead minion.
    s = settle(reveal(s, "21155"));
    expect(scheme(s, "21155")?.counters).toBe(2 + 2);
    s = settle(native(s, { type: "damage", target: cat.id, amount: 2 }));
    expect(s.player.discard.map((p) => p.id)).toContain(cat.id);
    expect(s.encounter.discard.some((p) => p.code === "21153")).toBe(true);
    exact(s);
  });
  it("Fallen Warrior is discarded when the deck runs out without an ally", () => {
    let s = started();
    const energy = playerCard(s, "01088");
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck.push(energy);
    s = settle(reveal(s, "21153"));
    expect(s.minions.filter((p) => p.treatedAsMinion)).toEqual([]);
    expect(s.encounter.discard.some((p) => p.code === "21153")).toBe(true);
    exact(s);
  });
  it("The Crazy Gang discards a Fallen Warrior ally to its owner instead of dealing it", () => {
    let s = settle(
      setup("standard", 1, "hela", ["legions_of_hel", "crazy_gang"]),
    );
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    s.player.form = "alter";
    s.player.deck.push(...s.player.hand.splice(0));
    const gang = s.encounter.deck.splice(
      s.encounter.deck.findIndex((p) => p.code === "48033"),
      1,
    )[0];
    gang.counters = 3;
    s.sideSchemes.push(gang);
    const cat = playerCard(s, "01002");
    s.player.deck.unshift(cat);
    const fallen = s.encounter.deck.splice(
      s.encounter.deck.findIndex((p) => p.code === "21153"),
      1,
    )[0];
    s = settle(
      native(s, { type: "reveal", piece: fallen, actorId: s.activePlayerId }),
    );
    expect(s.minions.some((p) => p.id === cat.id)).toBe(true);
    s = settle(native(s, { type: "enemyScheme", id: cat.id }));
    expect(s.minions.some((p) => p.id === cat.id)).toBe(false);
    expect(s.encounter.dealt.some((p) => p.id === cat.id)).toBe(false);
    expect(s.player.discard.map((p) => p.id)).toContain(cat.id);
  });
  it("No Place for the Living: discard the highest-cost upgrade or support, or take damage for each", () => {
    let s = started();
    const may = playerCard(s, "01006");
    const webbed = playerCard(s, "01009");
    s.player.inPlay.push(may, webbed);
    const hp = s.player.hp;
    s = settle(reveal(s, "21154"), (v) =>
      v.prompt?.title === "No Place for the Living" ? "damage" : undefined,
    );
    expect(s.player.hp).toBe(hp - 2);
    s = settle(reveal(s, "21154"), (v) =>
      v.prompt?.title === "No Place for the Living" ? webbed.id : undefined,
    );
    expect(s.player.inPlay.map((p) => p.id)).toEqual([may.id]);
    exact(s);
  });
  it("Legions of Hel gains surge without an Undead minion", () => {
    let s = started();
    stack(s, "01186");
    s = settle(reveal(s, "21155"));
    expect(scheme(s, "21155")?.counters).toBe(2);
    // Surge: the next encounter card is dealt to the player.
    expect(s.encounter.dealt.map((p) => p.code)).toEqual(["01186"]);
    exact(s);
  });
});

describe("Frost Giants", () => {
  it("Laufey stuns the character his attack damages", () => {
    let s = started();
    const laufey = engage(s, "21156");
    s = settle(native(s, { type: "enemyAttack", id: laufey.id }));
    expect(s.player.stunned).toBe(true);
    exact(s);
  });
  it("Frost Giant's boost stuns the character the villain's attack damages", () => {
    let s = started();
    stack(s, "21157");
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.stunned).toBe(true);
    exact(s);
  });
  it("Frozen keeps the identity exhausted until an alter-ego spends energy and physical", () => {
    let s = started();
    s = settle(reveal(s, "21158"));
    const frozen = s.attachments.find((p) => p.code === "21158")!;
    expect(frozen.attachedTo).toBe(`hero:${s.activePlayerId}`);
    s.player.exhausted = true;
    s = settle(native(s, { type: "refill" }));
    expect(s.player.exhausted).toBe(true);
    s.player.form = "alter";
    const energy = playerCard(s, "01088");
    const strength = playerCard(s, "01090");
    s.player.hand.push(energy, strength);
    s = command(s, { type: "ABILITY", id: frozen.id, action: "remove" });
    s = settle(pay(s, [energy, strength]));
    expect(s.attachments.some((p) => p.id === frozen.id)).toBe(false);
    exact(s);
  });
  it("Unnatural Storm exhausts each ally; player cards cannot ready heroes or allies, the ready step still does", () => {
    let s = started();
    const cat = playerCard(s, "01002");
    s.player.inPlay.push(cat);
    s = settle(reveal(s, "21159"));
    expect(s.player.inPlay.find((p) => p.id === cat.id)?.exhausted).toBe(true);
    s = settle(native(s, { type: "ready", target: cat.id }));
    expect(s.player.inPlay.find((p) => p.id === cat.id)?.exhausted).toBe(true);
    s.player.exhausted = true;
    s = settle(native(s, { type: "ready", target: "hero" }));
    expect(s.player.exhausted).toBe(true);
    s = settle(native(s, { type: "refill" }));
    expect(s.player.inPlay.find((p) => p.id === cat.id)?.exhausted).toBe(false);
    expect(s.player.exhausted).toBe(false);
    exact(s);
  });
  it("Legions of Hel and Frost Giants are modular sets for other scenarios", () => {
    for (const modules of [["legions_of_hel"], ["frost_giants"]]) {
      const s = settle(setup("standard", 1, "rhino", modules));
      expect(s.modules).toEqual(modules);
      expect(
        s.encounter.deck.filter((p) => card(p).set_code === modules[0]),
      ).toHaveLength(modules[0] === "legions_of_hel" ? 7 : 6);
    }
  });
});
