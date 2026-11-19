/** Sinister Motives: the Sandman scenario with City in Chaos and Down to
 * Earth, exercised with the original physical cards. Every command crosses a
 * JSON save/reload boundary. */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CARDS,
  MODULES,
  VILLAINS,
  card,
  pieceHP,
} from "../src/game/cards";
import { isTextBlank } from "../src/game/card-text";
import {
  abilityOptions,
  canChangeIdentityForm,
  cardCost,
  enemyStats,
  makePiece,
  newGame,
} from "../src/game/engine";
import { SANDMAN_SCRIPT_CODES, sandCounters } from "../src/game/sandman";
import { hasExecutableScript } from "../src/game/script-registry";
import { seatView } from "../src/game/team";
import type { Effect, GameState, Piece } from "../src/game/types";
import { command, choose, native, passId, reload } from "./dv-test-helpers";

const team = [
  { heroId: "spider_man", aspect: "justice" as const },
  { heroId: "captain_marvel", aspect: "aggression" as const },
  { heroId: "iron_man", aspect: "leadership" as const },
];
function setup(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "sandman",
  module?: string,
) {
  return newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId,
    difficulty,
    seed: 27061,
    pacing: "expert",
    heroes: team.slice(0, players),
    ...(module ? { module } : {}),
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
function started(
  difficulty: "standard" | "expert" = "standard",
  players = 1,
  villainId = "sandman",
  module?: string,
) {
  let s = settle(setup(difficulty, players, villainId, module));
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
const S = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `sandman:${type}`,
  ...args,
});
function take(s: GameState, code: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
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
const streets = (s: GameState) =>
  (s.environments || []).find((p) => p.code === "27065")!;
const minion = (s: GameState, code: string) =>
  s.minions.find((p) => p.code === code)!;
const villainAttack = (s: GameState, playerId = "p1"): Effect => ({
  type: "enemyAttack",
  id: s.villain.id,
  actorId: playerId,
});
const deckAlly = (s: GameState, playerId = "p1") =>
  seatView(s, playerId).player.deck.find((p) => card(p).type_code === "ally")!;
function inPlay(s: GameState, code: string, playerId = "p1"): Piece {
  const p = seatView(s, playerId).player;
  const i = p.deck.findIndex((q) => q.code === code);
  const piece = i >= 0 ? p.deck.splice(i, 1)[0] : makePiece(s, code);
  piece.ownerId ||= playerId;
  p.inPlay.push(piece);
  return piece;
}

describe("Sandman original source", () => {
  it("registers every face of the Sandman, City in Chaos and Down to Earth sets", () => {
    const faces = CATALOG_CARDS.filter(
      (c) =>
        c.pack_code === "sm" &&
        ["sandman", "city_in_chaos", "down_to_earth"].includes(
          c.set_code || "",
        ),
    );
    expect(faces).toHaveLength(22);
    expect(new Set(SANDMAN_SCRIPT_CODES)).toEqual(
      new Set(faces.map((c) => c.code)),
    );
    for (const c of faces)
      expect(hasExecutableScript(c.code), c.code).toBe(true);
    expect(VILLAINS.find((v) => v.id === "sandman")).toMatchObject({
      codes: ["27061", "27062", "27063"],
      schemes: ["27064b"],
      module: "down_to_earth",
      fixedSets: ["city_in_chaos"],
    });
    expect(MODULES.map((m) => m.id)).toEqual(
      expect.arrayContaining(["city_in_chaos", "down_to_earth"]),
    );
  });
  it.each([1, 2, 3])(
    "puts City Streets into play with 4 sand counters for %s players",
    (players) => {
      const s = settle(setup("standard", players));
      expect(streets(s)?.counters).toBe(4);
      expect(s.villain.code).toBe("27061");
      expect(s.villain.maxHp).toBe(16 * players);
      expect(s.scheme).toMatchObject({ code: "27064b", threat: 2 * players });
      const all = [
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.encounter.dealt,
        ...(s.environments || []),
      ];
      const count = (set: string) =>
        all.filter((p) => card(p).set_code === set).length;
      // Sandman set without its villains and main scheme: 14 cards, City
      // in Chaos 5 and Down to Earth 7.
      expect(count("sandman")).toBe(14);
      expect(count("city_in_chaos")).toBe(5);
      expect(count("down_to_earth")).toBe(7);
    },
  );
  it("Expert starts with Sandman (II), whose When Revealed resolves Surging Sands", () => {
    let s = settle(setup("expert"));
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
    expect(s.villain.code).toBe("27062");
    expect(streets(s).counters).toBe(5);
    expect(s.encounter.discard.length).toBeGreaterThanOrEqual(5);
  });
});

describe("Surging Sands and City Streets", () => {
  it("places a sand counter and discards that many encounter cards", () => {
    let s = started();
    const deck = s.encounter.deck.length;
    s = settle(native(s, S("surging")));
    expect(streets(s).counters).toBe(5);
    expect(s.encounter.deck.length).toBe(deck - 5);
  });
  it("the Hero Action exhausts a character to remove sand counters equal to its ATK, once per round", () => {
    let s = started();
    const option = abilityOptions(s, streets(s));
    expect(option.map((o) => o.id)).toContain("streets");
    s = command(s, { type: "ABILITY", id: streets(s).id, action: "streets" });
    s = settle(s);
    // Spider-Man: ATK 2.
    expect(streets(s).counters).toBe(2);
    expect(s.player.exhausted).toBe(true);
    s.player.exhausted = false;
    expect(abilityOptions(s, streets(s))).toHaveLength(0);
  });
  it("Hapless Pedestrians deals 3 indirect damage to the first player for each acceleration token", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(native(s, { type: "accelerate" }));
    expect(s.player.hp).toBe(hp - 3);
  });
});

describe("Sandman and his encounter cards", () => {
  it("Sand Blast: Sandman (I)'s attack deals indirect damage and Surging Sands follows when the identity is damaged", () => {
    let s = started();
    stack(s, "01186");
    const hp = s.player.hp;
    s = settle(native(s, villainAttack(s)));
    expect(s.player.hp).toBeLessThan(hp);
    expect(streets(s).counters).toBe(5);
  });
  it("Sand Form replaces damage a player would deal to Sandman and resolves Surging Sands", () => {
    let s = started();
    s = settle(reveal(s, "27066"));
    expect(s.attachments.find((p) => p.code === "27066")?.attachedTo).toBe(
      s.villain.id,
    );
    const hp = s.villain.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: s.villain.id,
        amount: 3,
        attack: true,
        source: "hero",
      }),
    );
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((p) => p.code === "27066")).toBe(false);
    expect(streets(s).counters).toBe(5);
  });
  it("Sand Clone's ATK is the sand counters and Surging Sands follows its defeat", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(reveal(s, "27067"));
    const clone = minion(s, "27067");
    expect(enemyStats(s, clone).attack).toBe(4);
    s = settle(
      native(s, {
        type: "damage",
        target: clone.id,
        amount: 3,
        source: "hero",
      }),
    );
    expect(s.minions.some((p) => p.id === clone.id)).toBe(false);
    expect(streets(s).counters).toBe(5);
  });
  it("Dirt Trap resolves Surging Sands twice when defeated", () => {
    let s = started();
    s = settle(reveal(s, "27068"));
    const trap = s.sideSchemes.find((p) => p.code === "27068")!;
    s = settle(
      native(s, { type: "thwart", target: trap.id, amount: 5, source: "hero" }),
    );
    expect(s.sideSchemes.some((p) => p.id === trap.id)).toBe(false);
    expect(streets(s).counters).toBe(6);
  });
  it("Tidal Sands places additional threat equal to the sand counters", () => {
    let s = started();
    s = settle(reveal(s, "27069"));
    expect(s.sideSchemes.find((p) => p.code === "27069")?.counters).toBe(2 + 4);
  });
  it("Sandslide adds 2 sand counters and Surging Sands, and stuns you when a Sandman card is discarded", () => {
    let s = started();
    const top = s.encounter.deck.filter((p) => card(p).set_code === "sandman");
    s.encounter.deck = [
      ...top,
      ...s.encounter.deck.filter((p) => !top.includes(p)),
    ];
    s = settle(reveal(s, "27070"));
    expect(streets(s).counters).toBe(7);
    expect(s.player.stunned).toBe(true);
  });
  it("Sand Storm deals indirect damage equal to the sand counters; without counters it places 3 and returns to the deck", () => {
    let s = started();
    const hp = s.player.hp;
    s = settle(reveal(s, "27071"));
    expect(s.player.hp).toBe(hp - 4);
    s = started();
    streets(s).counters = 0;
    const storm = take(s, "27071");
    s = settle(native(s, { type: "reveal", piece: storm, actorId: "p1" }));
    expect(streets(s).counters).toBe(3);
    expect(s.encounter.deck.some((p) => p.id === storm.id)).toBe(true);
  });
  it("Sand Smash: Sandman attacks a hero with +1 ATK; an alter-ego resolves Surging Sands", () => {
    let s = started();
    s.player.form = "alter";
    s = settle(reveal(s, "27072"));
    expect(streets(s).counters).toBe(5);
  });
});

describe("City in Chaos", () => {
  it("Panic in the Streets blanks Location and Persona supports", () => {
    let s = started();
    const station = inPlay(s, "01015");
    expect(isTextBlank(s, station)).toBe(false);
    s = settle(reveal(s, "27127"));
    expect(
      isTextBlank(
        s,
        s.player.inPlay.find((p) => p.id === station.id)!,
      ),
    ).toBe(true);
  });
  it("Rhino's attacks gain overkill and piercing; Calling in Favors brings him or makes him scheme", () => {
    let s = started();
    s = settle(reveal(s, "27129"));
    const rhino = minion(s, "27128");
    expect(rhino?.engagedWith).toBe("p1");
    const threat = s.scheme.threat;
    s = settle(reveal(s, "27129"));
    // Rhino (0 SCH) schemes with +2 SCH.
    expect(s.scheme.threat).toBe(threat + 2);
  });
  it("Now or Never places an acceleration token when you cannot exhaust and pay", () => {
    let s = started();
    s.player.exhausted = true;
    const acceleration = s.encounter.acceleration;
    s = settle(reveal(s, "27130"));
    expect(s.encounter.acceleration).toBe(acceleration + 1);
  });
});

describe("Down to Earth", () => {
  it("Common Criminal's Alter-Ego Action spends a physical resource to deal it 3 damage", () => {
    let s = started();
    s.player.form = "alter";
    const p = take(s, "27131");
    p.engagedWith = "p1";
    s.minions.push(p);
    const physical = s.player.deck.find(
      (q) => card(q).resource_physical && !card(q).resource_wild,
    )!;
    s.player.deck = s.player.deck.filter((q) => q !== physical);
    s.player.hand.push(physical);
    s = command(s, { type: "ABILITY", id: p.id, action: "criminal" });
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: [physical.id] });
    s = settle(s, (x) => x.prompt?.options.find((o) => o.id === "draw")?.id);
    expect(s.minions.some((m) => m.id === p.id)).toBe(false);
  });
  it("Friends and Family stays in play, raises event costs in hero form and leaves through its Alter-Ego Action", () => {
    let s = started();
    const event = card(
      s.player.deck.find(
        (q) => card(q).type_code === "event" && Number(card(q).cost) > 0,
      )!,
    );
    const cost = cardCost(s, event);
    s = settle(reveal(s, "27132"));
    const family = s.player.inPlay.find((p) => p.code === "27132")!;
    expect(family).toBeTruthy();
    expect(cardCost(s, event)).toBe(cost + 1);
    s.player.form = "alter";
    expect(cardCost(s, event)).toBe(cost);
    const signature = s.player.deck.find(
      (q) => card(q).faction_code === "hero",
    )!;
    s.player.deck = s.player.deck.filter((q) => q !== signature);
    s.player.hand.push(signature);
    s = command(s, { type: "ABILITY", id: family.id, action: "family" });
    s = settle(s);
    expect(s.player.inPlay.some((p) => p.id === family.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === signature.id)).toBe(true);
  });
  it("Volunteer Work cannot be thwarted and leaves through its Alter-Ego Action", () => {
    let s = started();
    s = settle(reveal(s, "27133"));
    const work = s.sideSchemes.find((p) => p.code === "27133")!;
    expect(work.counters).toBe(3);
    s = command(s, { type: "BASIC", action: "thwart" });
    if (s.prompt)
      expect(s.prompt.options.map((o) => o.id)).not.toContain(work.id);
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === work.id)?.counters).toBe(3);
    s.player.form = "alter";
    const pick = (kind: string) => {
      const i = s.player.deck.findIndex(
        (p) =>
          !!(card(p) as unknown as Record<string, unknown>)[
            `resource_${kind}`
          ] && !card(p).resource_wild,
      );
      return s.player.deck.splice(i, 1)[0];
    };
    const paid = [pick("energy"), pick("mental")];
    s.player.hand.push(...paid);
    s = command(s, { type: "ABILITY", id: work.id, action: "volunteer" });
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: paid.map((p) => p.id) });
    s = settle(s);
    // Peter Parker's REC 3 removes all 3 threat; he is not a Civilian.
    expect(s.sideSchemes.some((p) => p.id === work.id)).toBe(false);
    expect(s.player.hand).toHaveLength(0);
  });
  it("Threat or Menace? places 2 threat for a hero and locks an alter-ego's form", () => {
    let s = started();
    const threat = s.scheme.threat;
    s = settle(
      reveal(s, "27134"),
      (x) => x.prompt?.options.find((o) => o.id === "stay")?.id,
    );
    expect(s.scheme.threat).toBe(threat + 2);
    expect(canChangeIdentityForm(s)).toBe(true);
    let alter = started();
    alter.player.form = "alter";
    const before = alter.scheme.threat;
    alter = settle(
      reveal(alter, "27134"),
      (x) => x.prompt?.options.find((o) => o.id === "stay")?.id,
    );
    expect(alter.scheme.threat).toBe(before);
    // Revealed during the player's own turn, it lasts through their next.
    expect(alter.flags.sandmanFormLock).toBe(2);
    expect(canChangeIdentityForm(alter)).toBe(false);
  });
  it("Loose Ends reveals your obligation; changing to alter-ego during it discards a random card", () => {
    let s = started();
    const notice = take(s, "01165");
    // The removed-from-game area is searched as well.
    s.removed.push(notice);
    s.player.hand.push(...s.player.deck.splice(0, 3));
    s = settle(
      reveal(s, "27135"),
      (x) => x.prompt?.options.find((o) => o.id === "resolve")?.id,
    );
    expect(s.player.form).toBe("alter");
    expect(s.player.hand).toHaveLength(2);
    expect(s.removed.filter((p) => p.id === notice.id)).toHaveLength(1);
    expect(
      [...s.encounter.deck, ...s.encounter.discard].some(
        (p) => p.id === notice.id,
      ),
    ).toBe(false);
  });
  it("Loose Ends gains surge when your obligation cannot be found", () => {
    let s = started();
    take(s, "01165");
    stack(s, "27069");
    s = settle(reveal(s, "27135"));
    // Surge deals the next encounter card, revealed in the villain phase.
    expect(s.encounter.dealt.map((p) => p.code)).toEqual(["27069"]);
  });
});
