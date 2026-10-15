/** Mansion Attack acceptance uses complete published player decks and moves
 * original scenario pieces between native zones. Every command is hydrated. */
import { describe, expect, it } from "vitest";
import sourceDecks from "../src/data/catalog-decks.json";
import { card, heroStats, pieceHP } from "../src/game/cards.js";
import { catalogDeckCodes, type CatalogDeck } from "../src/game/catalog.js";
import {
  dispatch,
  enemyStats,
  escalation,
  newGame,
  schemeLimit,
} from "../src/game/engine.js";
import { statusCards } from "../src/game/keywords.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type {
  Aspect,
  Card,
  Command,
  Effect,
  GameState,
  Piece,
} from "../src/game/types.js";
import { passId } from "./dv-test-helpers.js";

type Mansion = {
  villainDeck: Piece[];
  mainDeck: Piece[];
  currentMain?: Piece;
  winTarget: number;
  activeVillainRetired?: boolean;
  handledVillainDefeats: string[];
  handledMainCompletions: string[];
  handledAttackResponses: string[];
};
type Fixture = GameState & {
  mansionAttack?: Mansion;
  mansionOriginalIds?: string[];
};
const mission = (s: GameState) => (s as Fixture).mansionAttack!;
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
const nested = (p: Piece): Piece[] => [
  p,
  ...(p.captured || []).flatMap(nested),
  ...(p.storedCards || []).flatMap(nested),
  ...(p.inheritorBoosts || []).flatMap(nested),
  ...(p.droneCard ? nested(p.droneCard) : []),
];
function physical(s: GameState) {
  const m = mission(s);
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.victoryDisplay || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
    ...(m
      ? [
          ...m.villainDeck,
          ...m.mainDeck,
          ...(m.currentMain ? [m.currentMain] : []),
          ...(m.activeVillainRetired ? [] : [s.villain]),
        ]
      : []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  const ids = physical(s)
    .map((p) => p.id)
    .sort();
  expect(
    new Set(ids).size,
    "each physical source is in exactly one native zone",
  ).toBe(ids.length);
  if ((s as Fixture).mansionOriginalIds)
    expect(ids).toEqual([...(s as Fixture).mansionOriginalIds!].sort());
  expect(
    mission(s).mainDeck.every((p) => /^3212[6-9]a$/.test(p.code)),
    "hidden original room cards retain their 2A faces",
  ).toBe(true);
  return s;
}
function command(input: GameState, cmd: Command) {
  let s = dispatch(reload(input), cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let n = 0; s.review && n < 100; n++) {
    s = dispatch(reload(s), { type: "PROCEED" });
    expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  }
  expect(s.review).toBeNull();
  return exact(s);
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(s, { type: "CHOOSE", id });
}
function settle(s: GameState, prefer?: (s: GameState) => string | undefined) {
  for (let n = 0; s.prompt && n < 250; n++) {
    const id =
      prefer?.(s) ||
      passId(s) ||
      (/indirect/i.test(s.prompt.text)
        ? s.prompt.options.find((o) => /^hero(?::|$)/.test(o.id))?.id
        : undefined) ||
      (/forced|order|each player|setup/i.test(s.prompt.title) ||
      s.prompt.options.length === 1
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return exact(s);
}
function native(s: GameState, ...effects: Effect[]) {
  expect(s.prompt).toBeNull();
  expect(s.queue).toEqual([]);
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Original-source printed-rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
const sourceSeats = [
  { heroId: "spider_man", heroCode: "01001a", aspect: "justice" as Aspect },
  {
    heroId: "captain_marvel",
    heroCode: "01010a",
    aspect: "leadership" as Aspect,
  },
];
function opening(
  team = false,
  difficulty: "standard" | "expert" = "standard",
  seed = 3212130,
  module = "mystique",
  heroId = "spider_man",
) {
  const seats = [...sourceSeats];
  if (heroId === "colossus")
    seats[0] = { heroId, heroCode: "32001a", aspect: "protection" };
  if (heroId === "ms_marvel")
    seats[0] = { heroId, heroCode: "05001a", aspect: "protection" };
  const heroes = seats
    .slice(0, team ? 2 : 1)
    .map(({ heroId, heroCode, aspect }) => ({
      heroId,
      aspect,
      deckCards: catalogDeckCodes(
        (sourceDecks as unknown as CatalogDeck[]).find(
          (d) => d.heroCode === heroCode,
        )!,
      ),
    }));
  expect(heroes.map((p) => p.deckCards.length)).toEqual(team ? [40, 40] : [40]);
  const s = newGame({
    ...heroes[0],
    heroes,
    villainId: "mansion_attack",
    difficulty,
    modules: [module],
    seed,
    pacing: "expert",
  });
  (s as Fixture).mansionOriginalIds = physical(s).map((p) => p.id);
  return exact(s);
}
function base(
  team = false,
  difficulty: "standard" | "expert" = "standard",
  module = "mystique",
  heroId = "spider_man",
) {
  let s = settle(opening(team, difficulty, 3212130, module, heroId));
  while (s.phase === "mulligan")
    s = settle(command(s, { type: "MULLIGAN", ids: [] }));
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    expect(source).toHaveLength(40);
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = [];
    p.form = "hero";
    p.flipped = p.exhausted = p.stunned = p.confused = p.tough = false;
    p.stunCards = p.confuseCards = p.toughCards = 0;
  }
  activateSeat(s, "p1");
  s.turnPlayerId = "p1";
  s.scheme.threat = 0;
  return exact(reload(s));
}
function take(s: GameState, code: string, playerId?: string) {
  const p = playerId ? seatView(s, playerId).player : undefined;
  const zones = p
    ? [p.deck, p.hand, p.discard, p.inPlay]
    : [s.encounter.deck, s.encounter.discard, s.encounter.dealt];
  for (const z of zones) {
    const i = z.findIndex((p) => p.code === code);
    if (i >= 0) return z.splice(i, 1)[0];
  }
  throw Error(`Missing original source ${playerId || "encounter"}:${code}`);
}
function top(s: GameState, ...codes: string[]) {
  const ps = codes.map((c) => take(s, c));
  s.encounter.deck.unshift(...ps);
  return ps;
}
function hand(s: GameState, codes: string[], playerId = "p1") {
  const ps = codes.map((c) => take(s, c, playerId));
  seatView(s, playerId).player.hand.push(...ps);
  return ps;
}
function ally(s: GameState, code = "01002", playerId = "p1") {
  const p = take(s, code, playerId);
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code = "32076", playerId = "p1") {
  const p = take(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function boss(s: GameState, code: string) {
  const m = mission(s),
    i = m.villainDeck.findIndex((p) => p.code === code);
  if (s.villain.code !== code) {
    expect(i, `original villain ${code}`).toBeGreaterThanOrEqual(0);
    const [p] = m.villainDeck.splice(i, 1);
    m.villainDeck.push(s.villain);
    s.villain = p as GameState["villain"];
    s.villain.hp = s.villain.maxHp = card(p).health! * s.playerCount;
    s.villain.stage = s.difficulty === "expert" ? 2 : 1;
  }
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return exact(s);
}
function room(s: GameState, code: string) {
  const m = mission(s);
  if (m.currentMain!.code !== code) {
    const i = m.mainDeck.findIndex(
      (p) => p.code.slice(0, -1) === code.slice(0, -1),
    );
    expect(i, `original room ${code}`).toBeGreaterThanOrEqual(0);
    const [p] = m.mainDeck.splice(i, 1);
    const previous = m.currentMain!;
    previous.code = `${previous.code.slice(0, -1)}a`;
    m.mainDeck.push(previous);
    p.code = code;
    m.currentMain = p;
    s.scheme.code = code;
  }
  s.scheme.threat = 0;
  return exact(s);
}
function attack(s: GameState, id = s.villain.id, playerId = "p1") {
  return native(s, {
    type: "enemyAttack",
    id,
    actorId: playerId,
    activation: { enemyId: id, playerId, kind: "attack" },
  });
}
function scheme(s: GameState, id = s.villain.id, playerId = "p1") {
  return native(s, {
    type: "enemyScheme",
    id,
    actorId: playerId,
    activation: { enemyId: id, playerId, kind: "scheme" },
  });
}
function defend(s: GameState, id: string) {
  for (
    let n = 0;
    s.prompt && !s.prompt.options.some((o) => o.id === id) && n < 100;
    n++
  ) {
    const skip = passId(s);
    expect(skip, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, skip!);
  }
  return choose(s, id);
}
function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: take(s, code), skip: true });
}
function defeat(s: GameState) {
  return settle(
    native(s, {
      type: "damage",
      target: s.villain.id,
      amount: s.villain.hp,
      source: "hero",
    }),
  );
}

describe("Mansion Attack actual original-source setup, piles and completion", () => {
  it.each([false, true])(
    "deals each player once and randomizes four physical villains/five mains (team %s)",
    (team) => {
      const openings = new Set<string>(),
        villains = new Set<string>();
      for (const seed of [32121, 32122, 32123, 32124, 32125, 32126]) {
        const s = settle(opening(team, "standard", seed)),
          m = mission(s),
          all = physical(s);
        expect(m.winTarget).toBe(2);
        expect(s.villain.code).toMatch(/^3212[1-4]a$/);
        expect(m.villainDeck).toHaveLength(3);
        expect(m.mainDeck).toHaveLength(3);
        expect(m.currentMain).toMatchObject({ code: s.scheme.code });
        expect(s.scheme.code).toMatch(/^3212[6-9]b$/);
        expect(s.scheme.threat).toBe(s.playerCount);
        expect(schemeLimit(s)).toBe(7 * s.playerCount);
        expect(escalation(s)).toBe(s.playerCount);
        expect(s.villain).toMatchObject({
          hp: card(s.villain).health! * s.playerCount,
          tough: true,
        });
        expect(
          s.victoryDisplay?.filter((p) => p.code === "32125b"),
        ).toHaveLength(1);
        expect(s.environments?.filter((p) => p.code === "32130")).toHaveLength(
          1,
        );
        for (const seat of s.players)
          expect(
            s.encounter.dealt.filter((p) => p.dealtTo === seat.id),
          ).toHaveLength(1);
        expect(all.filter((p) => card(p).type_code === "villain")).toHaveLength(
          4,
        );
        expect(
          all.filter((p) => card(p).type_code === "main_scheme"),
        ).toHaveLength(5);
        expect(
          all.filter((p) => card(p).set_code === "brotherhood"),
        ).toHaveLength(8);
        expect(all.filter((p) => card(p).set_code === "mystique")).toHaveLength(
          5,
        );
        openings.add(s.scheme.code);
        villains.add(s.villain.code);
        exact(reload(s));
      }
      expect(openings.size).toBeGreaterThan(1);
      expect(villains.size).toBeGreaterThan(1);
    },
  );
  it("uses all four B sides with their printed HP and the source-backed three-villain Expert target", () => {
    const s = base(true, "expert"),
      m = mission(s);
    expect(m.winTarget).toBe(3);
    for (const p of [s.villain, ...m.villainDeck])
      expect(p.code).toMatch(/^3212[1-4]b$/);
    expect(s.villain.maxHp).toBe(card(s.villain).health! * 2);
  });
  it.each([false, true])(
    "loses on the second completed room because initial 1B already counts (team %s)",
    (team) => {
      let s = base(team);
      const first = mission(s).currentMain!.id;
      s.scheme.threat = 7 * s.playerCount - 1;
      s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
      expect(s.phase).toBe("player");
      expect(
        s.victoryDisplay?.filter((p) => card(p).type_code === "main_scheme"),
      ).toHaveLength(2);
      expect(s.victoryDisplay?.some((p) => p.id === first)).toBe(true);
      expect(mission(s).currentMain!.id).not.toBe(first);
      expect(s.scheme.threat).toBe(s.playerCount);
      s.scheme.threat = 7 * s.playerCount - 1;
      s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
      expect(s.phase).toBe("lost");
      expect(
        s.victoryDisplay?.filter((p) => card(p).type_code === "main_scheme"),
      ).toHaveLength(3);
      exact(reload(s));
    },
  );
  it.each(["standard", "expert"] as const)(
    "wins after exactly the printed %s target and retires each original once",
    (difficulty) => {
      let s = base(false, difficulty);
      const n = difficulty === "standard" ? 2 : 3;
      const dealt = s.encounter.dealt.length,
        ids = new Set<string>();
      for (let i = 1; i <= n; i++) {
        const prior = s.villain.id;
        ids.add(prior);
        s.villain.tough = false;
        s.villain.toughCards = 0;
        s = defeat(s);
        expect(
          s.victoryDisplay?.filter((p) => card(p).type_code === "villain"),
        ).toHaveLength(i);
        expect(s.victoryDisplay?.filter((p) => p.id === prior)).toHaveLength(1);
        expect(s.phase).toBe(i === n ? "won" : "player");
        if (i < n) {
          expect(s.villain.id).not.toBe(prior);
          expect(ids.has(s.villain.id)).toBe(false);
          expect(s.villain.tough).toBe(true);
        }
        expect(s.encounter.dealt.length).toBe(dealt + Math.min(i, n - 1));
        exact(reload(s));
      }
    },
  );
  it("replaces different identities without carrying wounds, statuses or player attachments", () => {
    let s = room(boss(base(), "32121a"), "32129b");
    const prior = s.villain.id;
    const web = take(s, "01008", "p1");
    web.attachedTo = prior;
    s.player.inPlay.push(web);
    s.villain.hp = 1;
    s.villain.stunned = true;
    s.villain.stunCards = 1;
    s.villain.confused = true;
    s.villain.confuseCards = 1;
    s = defeat(s);
    expect(s.villain.id).not.toBe(prior);
    expect(card(s.villain).name).not.toBe("Avalanche");
    expect(s.villain.hp).toBe(s.villain.maxHp);
    expect(s.villain.hp).toBe(card(s.villain).health);
    expect(s.villain.stunned).toBe(false);
    expect(s.villain.confused).toBe(false);
    expect(s.villain.tough).toBe(true);
    expect(s.player.discard.some((p) => p.id === web.id)).toBe(true);
    expect(s.victoryDisplay?.find((p) => p.id === prior)?.code).toBe("32121a");
  });
});

describe("Mansion Attack native room grants", () => {
  it.each([false, true])(
    "Atrium grants Steady to hero, ally, minion and villain even when character text is blank (main blank %s)",
    (mainBlank) => {
      let s = room(boss(base(), "32121a"), "32126b");
      const a = ally(s),
        m = minion(s);
      s.flags[`novaIronheartPackBlank:${m.id}`] = s.round;
      if (mainBlank)
        s.flags[`novaIronheartPackBlank:${mission(s).currentMain!.id}`] =
          s.round;
      const ids = ["hero:p1", a.id, m.id, s.villain.id];
      s = settle(
        native(
          s,
          ...ids.map(
            (id) =>
              ({ type: "status", target: id, status: "stunned" }) as Effect,
          ),
        ),
      );
      const actual = [
        s.player,
        s.player.inPlay.find((p) => p.id === a.id)!,
        s.minions.find((p) => p.id === m.id)!,
        s.villain,
      ];
      for (const p of actual) {
        expect(statusCards(p, "stunned")).toBe(1);
        expect(p.stunned).toBe(mainBlank);
      }
      if (!mainBlank) {
        s = settle(
          native(
            s,
            ...ids.map(
              (id) =>
                ({ type: "status", target: id, status: "stunned" }) as Effect,
            ),
          ),
        );
        for (const p of [
          s.player,
          s.player.inPlay.find((p) => p.id === a.id)!,
          s.minions.find((p) => p.id === m.id)!,
          s.villain,
        ])
          expect(statusCards(p, "stunned")).toBe(2);
      }
    },
  );
  it.each([false, true])(
    "Courtyard adds exactly one native ATK to hero, ally, minion and villain (main blank %s)",
    (mainBlank) => {
      let s = room(boss(base(), "32121a"), "32129b");
      const a = ally(s),
        m = minion(s);
      if (mainBlank)
        s.flags[`novaIronheartPackBlank:${mission(s).currentMain!.id}`] =
          s.round;
      const bonus = mainBlank ? 0 : 1;
      expect(heroStats(s).attack).toBe(2 + bonus);
      expect(enemyStats(s, m).attack).toBe(card(m).attack! + bonus);
      expect(enemyStats(s, s.villain).attack).toBe(
        card(s.villain).attack! + bonus,
      );
      const hp = s.villain.hp;
      s = command(s, { type: "ABILITY", id: a.id, action: "attack" });
      s = settle(target(s, s.villain.id));
      expect(s.villain.hp).toBe(hp - card(a).attack! - bonus);
    },
  );
  it.each([false, true])(
    "Basketball Court grants Toughness only when actual ally/minion enters (main blank %s)",
    (mainBlank) => {
      let s = boss(base(), "32121a");
      const existing = ally(s);
      s = room(s, "32128b");
      if (mainBlank)
        s.flags[`novaIronheartPackBlank:${mission(s).currentMain!.id}`] =
          s.round;
      expect(s.player.tough).toBe(false);
      expect(existing.tough).toBe(false);
      expect(s.villain.tough).toBe(false);
      const [blackCat, energy] = hand(s, ["01002", "01088"]);
      // take() moves this same original ally from play to hand for its entry.
      expect(blackCat.id).toBe(existing.id);
      s = command(s, { type: "PLAY", id: blackCat.id });
      s = command(s, { type: "PAY", ids: [energy.id] });
      s = settle(s);
      expect(s.player.inPlay.find((p) => p.id === blackCat.id)?.tough).toBe(
        !mainBlank,
      );
      const p = take(s, "32076");
      s = settle(native(s, { type: "reveal", piece: p, skip: true }));
      expect(s.minions.find((m) => m.id === p.id)?.tough).toBe(!mainBlank);
      expect(s.player.tough).toBe(false);
      expect(s.villain.tough).toBe(false);
    },
  );
  it.each([false, true])(
    "Cafeteria retaliates after real basic/ally attacks and from a defending hero (main blank %s)",
    (mainBlank) => {
      let s = room(boss(base(), "32121a"), "32127b");
      const a = ally(s, "01058");
      if (mainBlank)
        s.flags[`novaIronheartPackBlank:${mission(s).currentMain!.id}`] =
          s.round;
      const hp = s.player.hp;
      s = command(s, { type: "BASIC", action: "attack" });
      s = settle(target(s, s.villain.id));
      expect(s.player.hp).toBe(hp - Number(!mainBlank));
      s = command(s, { type: "ABILITY", id: a.id, action: "attack" });
      s = settle(target(s, s.villain.id));
      expect(s.player.inPlay.find((p) => p.id === a.id)?.damage).toBe(
        1 + Number(!mainBlank),
      );
      const m = minion(s),
        before = m.damage;
      s = settle(attack(s, m.id));
      expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(
        before + Number(!mainBlank),
      );
    },
  );
});

const brothers = [
  { villain: "32121a", minion: "32073", treachery: "32132", name: "Avalanche" },
  { villain: "32122a", minion: "32074", treachery: "32133", name: "Blob" },
  { villain: "32123a", minion: "32075", treachery: "32134", name: "Pyro" },
  { villain: "32124a", minion: "32076", treachery: "32135", name: "Toad" },
];
function inPlay(s: GameState, id: string, playerId = "p1") {
  return seatView(s, playerId).player.inPlay.find((p) => p.id === id)!;
}
function printedResources(p: Piece) {
  const c = card(p);
  return (
    (c.resource_energy || 0) +
    (c.resource_mental || 0) +
    (c.resource_physical || 0) +
    (c.resource_wild || 0)
  );
}
function playerTop(s: GameState, playerId: string, count = 2) {
  const p = seatView(s, playerId).player;
  const pieces = [...p.deck]
    .sort((a, b) => printedResources(b) - printedResources(a))
    .slice(0, count);
  for (const q of pieces)
    p.deck.splice(
      p.deck.findIndex((v) => v.id === q.id),
      1,
    );
  p.deck.unshift(...pieces);
  return pieces;
}
describe("Mansion Attack native actual completed-attack receipts", () => {
  it.each(["32122a", "32124a"])(
    "a real Backflip prevents %s's attack damage and its damage-dependent response",
    (code) => {
      let s = room(boss(base(), code), "32129b");
      const [backflip, retained] = hand(s, ["01003", "01009"]);
      top(s, "01186");
      const hp = s.player.hp;
      s = settle(
        attack(s),
        (v) =>
          v.prompt?.options.find(
            (o) => o.image === backflip.code || /Backflip/i.test(o.label),
          )?.id,
      );
      expect(s.player.hp).toBe(hp);
      expect(s.player.stunned).toBe(false);
      expect(s.player.discard.some((p) => p.id === backflip.id)).toBe(true);
      expect(s.player.hand.some((p) => p.id === retained.id)).toBe(true);
      expect(mission(s).handledAttackResponses).toEqual([]);
    },
  );
  it.each([false, true])(
    "Avalanche exhausts an actual ally after a completed attack even when Tough prevents damage (Tough %s)",
    (tough) => {
      let s = room(boss(base(), "32121a"), "32129b");
      const a = ally(s);
      s.player.tough = tough;
      s.player.toughCards = Number(tough);
      top(s, "01186");
      const hp = s.player.hp;
      s = settle(attack(s));
      expect(inPlay(s, a.id).exhausted).toBe(true);
      expect(s.player.hp).toBe(tough ? hp : hp - card("32121a").attack! - 1);
      expect(mission(s).handledAttackResponses.length).toBe(1);
    },
  );
  it("Avalanche uses the actual cooperative defender's allies", () => {
    let s = room(boss(base(true), "32121a"), "32129b");
    const own = ally(s),
      otherCode = seatView(s, "p2").player.deck.find(
        (p) => card(p).type_code === "ally",
      )!.code;
    const other = ally(s, otherCode, "p2");
    top(s, "01186");
    s = settle(defend(attack(s), "hero:p2"), (v) =>
      v.prompt?.options.some((o) => o.id === other.id) &&
      /Avalanche/i.test(v.prompt.title)
        ? other.id
        : undefined,
    );
    expect(inPlay(s, own.id).exhausted).toBe(false);
    expect(inPlay(s, other.id, "p2").exhausted).toBe(true);
  });
  it.each([false, true])(
    "Blob stuns only the actual damaged cooperative defender (prevented %s)",
    (prevented) => {
      let s = room(boss(base(true), "32122a"), "32129b");
      const p2 = seatView(s, "p2").player;
      p2.tough = prevented;
      p2.toughCards = Number(prevented);
      top(s, "01186");
      const hp = p2.hp;
      s = settle(defend(attack(s), "hero:p2"));
      expect(s.player.stunned).toBe(false);
      expect(seatView(s, "p2").player.stunned).toBe(!prevented);
      expect(seatView(s, "p2").player.hp).toBe(prevented ? hp : hp - 2);
    },
  );
  it("Blob stuns a surviving actual ally defender and does not stun its controller", () => {
    let s = room(boss(base(), "32122a"), "32126b");
    const a = ally(s, "01058");
    // Atrium requires two statuses: an actual one-stun receipt must remain un-stunned.
    top(s, "01186");
    s = settle(defend(attack(s), a.id));
    expect(inPlay(s, a.id).damage).toBe(2);
    expect(statusCards(inPlay(s, a.id), "stunned")).toBe(1);
    expect(inPlay(s, a.id).stunned).toBe(false);
    expect(s.player.stunned).toBe(false);
  });
  it("Pyro's completed zero-ATK attack discards original top two and sums every printed icon", () => {
    let s = room(boss(base(), "32123a"), "32126b");
    const ps = playerTop(s, "p1"),
      amount = ps.reduce((n, p) => n + printedResources(p), 0);
    // Spider-Sense draws its actual mandatory source before the attack finishes.
    const drawn = take(s, "01009", "p1");
    s.player.deck.unshift(drawn);
    top(s, "01186");
    const hp = s.player.hp;
    s = settle(attack(s));
    expect(amount).toBe(4);
    expect(s.player.hp).toBe(hp - amount);
    expect(s.player.hand.some((p) => p.id === drawn.id)).toBe(true);
    for (const p of ps)
      expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    expect(mission(s).handledAttackResponses.length).toBe(1);
  });
  it("Pyro mills the actual cooperative defender's source deck and routes indirect damage there", () => {
    let s = room(boss(base(true), "32123a"), "32126b");
    const ps = playerTop(s, "p2"),
      amount = ps.reduce((n, p) => n + printedResources(p), 0);
    top(s, "01186");
    const hp1 = s.player.hp,
      hp2 = seatView(s, "p2").player.hp;
    s = settle(defend(attack(s), "hero:p2"));
    expect(s.player.hp).toBe(hp1);
    expect(seatView(s, "p2").player.hp).toBe(hp2 - amount);
    for (const p of ps)
      expect(seatView(s, "p2").player.discard.some((q) => q.id === p.id)).toBe(
        true,
      );
    expect(s.activePlayerId).toBe("p1");
    expect(s.attack).toBeNull();
  });
  it.each([false, true])(
    "Toad discards from the actual damaged character's controller (Tough %s)",
    (tough) => {
      let s = room(boss(base(true), "32124a"), "32129b");
      const own = hand(s, [s.player.deck[0].code])[0],
        p2 = seatView(s, "p2").player;
      const other = hand(s, [p2.deck[0].code], "p2")[0];
      p2.tough = tough;
      p2.toughCards = Number(tough);
      top(s, "01186");
      s = settle(defend(attack(s), "hero:p2"));
      expect(s.player.hand.some((p) => p.id === own.id)).toBe(true);
      expect(seatView(s, "p2").player.hand.some((p) => p.id === other.id)).toBe(
        tough,
      );
      expect(
        seatView(s, "p2").player.discard.some((p) => p.id === other.id),
      ).toBe(!tough);
    },
  );
  it.each(brothers)(
    "a Stun-cancelled $name attack creates no completed-attack forced response",
    ({ villain }) => {
      let s = room(boss(base(), villain), "32129b");
      const a = ally(s),
        cards = hand(s, [s.player.deck[0].code]);
      s.villain.stunned = true;
      s.villain.stunCards = 1;
      const hp = s.player.hp,
        deck = s.player.deck.map((p) => p.id);
      s = settle(attack(s));
      expect(s.player.hp).toBe(hp);
      expect(s.villain.stunned).toBe(false);
      expect(inPlay(s, a.id).exhausted).toBe(false);
      expect(s.player.hand.some((p) => p.id === cards[0].id)).toBe(true);
      expect(s.player.deck.map((p) => p.id)).toEqual(deck);
      expect(mission(s).handledAttackResponses).toEqual([]);
    },
  );
  it.each(brothers)(
    "blanked $name suppresses its printed completed-attack response",
    ({ villain }) => {
      let s = room(boss(base(), villain), "32126b");
      const a = ally(s),
        cards = hand(s, [s.player.deck[0].code]);
      s.flags[`novaIronheartPackBlank:${s.villain.id}`] = s.round;
      const deck = s.player.deck.map((p) => p.id);
      top(s, "01186");
      s = settle(attack(s));
      expect(inPlay(s, a.id).exhausted).toBe(false);
      expect(s.player.stunned).toBe(false);
      expect(statusCards(s.player, "stunned")).toBe(0);
      expect(s.player.hand.some((p) => p.id === cards[0].id)).toBe(true);
      expect(s.player.deck.map((p) => p.id)).toEqual(deck.slice(1));
      expect(s.player.hand.some((p) => p.id === deck[0])).toBe(true);
      expect(mission(s).handledAttackResponses).toEqual([]);
    },
  );
});

describe("Mansion Attack actual treacheries, boosts and side schemes", () => {
  it("Brotherhood Beatdown resolves each named enemy that is actually in play", () => {
    let s = room(boss(base(), "32121a"), "32129b");
    minion(s, "32074");
    minion(s, "32075");
    minion(s, "32076");
    const [h] = hand(s, [s.player.deck[0].code]);
    const hp = s.player.hp;
    s = settle(reveal(s, "32131"));
    expect(s.player.exhausted).toBe(true);
    expect(s.player.stunned).toBe(true);
    expect(s.player.hp).toBe(hp - 2);
    expect(s.player.discard.some((p) => p.id === h.id)).toBe(true);
  });
  it.each(brothers)(
    "$name treachery uses actual villain activation in both forms",
    ({ villain, treachery }) => {
      for (const form of ["hero", "alter"] as const) {
        let s = room(boss(base(), villain), "32126b");
        s.player.form = form;
        top(s, "01186");
        // Cancellation identifies the exact actor and avoids extra printed after-attack effects here.
        s.villain[form === "hero" ? "stunned" : "confused"] = true;
        s.villain[form === "hero" ? "stunCards" : "confuseCards"] = 2;
        const hp = s.player.hp;
        s = settle(reveal(s, treachery));
        expect(s.villain[form === "hero" ? "stunned" : "confused"]).toBe(false);
        expect(s.player.hp).toBe(hp);
        expect(s.scheme.threat).toBe(0);
      }
    },
  );
  it.each(brothers)(
    "$name treachery activates an engaged matching minion without creating a duplicate",
    ({ villain, minion: code, treachery }) => {
      const other = villain === "32121a" ? "32122a" : "32121a";
      let s = room(boss(base(), other), "32126b");
      s.player.form = "alter";
      const p = minion(s, code);
      p.confused = true;
      p.confuseCards = 2;
      s = settle(reveal(s, treachery));
      expect(s.minions.filter((q) => q.id === p.id)).toHaveLength(1);
      expect(s.minions.find((q) => q.id === p.id)?.confused).toBe(false);
      expect(s.scheme.threat).toBe(0);
    },
  );
  it.each(brothers)(
    "$name treachery searches and reveals its actual minion from discard when absent",
    ({ villain, minion: code, treachery }) => {
      const other = villain === "32121a" ? "32122a" : "32121a";
      let s = room(boss(base(), other), "32126b");
      const p = take(s, code);
      s.encounter.discard.push(p);
      s = settle(
        reveal(s, treachery),
        (v) =>
          v.prompt?.options.find((o) => o.id === p.id || o.image === code)?.id,
      );
      expect(s.minions.filter((q) => q.id === p.id)).toHaveLength(1);
      expect(s.minions.find((q) => q.id === p.id)?.engagedWith).toBe("p1");
      expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(false);
    },
  );
  it.each(brothers)(
    "$name boost adds one actual extra boost only for its matching villain",
    ({ villain, treachery }) => {
      for (const matches of [true, false]) {
        let s = room(
          boss(
            base(),
            matches ? villain : villain === "32121a" ? "32122a" : "32121a",
          ),
          "32126b",
        );
        s.player.form = "alter";
        const [boost, extra] = top(s, treachery, "32131");
        const expected = card(s.villain).scheme! + 1 + (matches ? 2 : 0);
        s = settle(scheme(s));
        expect(s.scheme.threat).toBe(expected);
        expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
        expect(s.encounter.discard.some((p) => p.id === extra.id)).toBe(
          matches,
        );
        if (!matches) expect(s.encounter.deck[0].id).toBe(extra.id);
      }
    },
  );
  it("Protect the Students applies fixed 2 plus Hinder 2N and searches only actual defeating player's deck/discard", () => {
    let s = room(base(true), "32126b");
    const side = take(s, "32136");
    s = settle(native(s, { type: "reveal", piece: side, skip: true }));
    expect(s.sideSchemes.find((p) => p.id === side.id)?.counters).toBe(6);
    const p2 = seatView(s, "p2").player,
      found = p2.deck.find((p) => card(p).type_code === "ally")!;
    s = native(s, {
      type: "thwart",
      target: side.id,
      amount: 6,
      source: "hero:p2",
      actorId: "p2",
    });
    s = settle(s, (v) => v.prompt?.options.find((o) => o.id === found.id)?.id);
    expect(seatView(s, "p2").player.hand.some((p) => p.id === found.id)).toBe(
      true,
    );
    expect(s.player.hand.some((p) => p.id === found.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === side.id)).toBe(true);
  });
  it("Under Siege counts actual Brotherhood characters including the current villain", () => {
    let s = room(boss(base(true), "32123a"), "32126b");
    minion(s, "32073");
    minion(s, "32074", "p2");
    const p = take(s, "32137");
    s = settle(native(s, { type: "reveal", piece: p, skip: true }));
    expect(s.sideSchemes.find((q) => q.id === p.id)?.counters).toBe(9);
    expect(escalation(s)).toBe(2);
    expect(card(p).scheme_acceleration).toBe(1);
  });
});

function nextBoss(s: GameState, code: string) {
  const deck = mission(s).villainDeck,
    i = deck.findIndex((p) => p.code === code);
  expect(i).toBeGreaterThanOrEqual(0);
  deck.unshift(...deck.splice(i, 1));
  return deck[0];
}
describe("Mansion Attack actual targets, collision activations and continuations", () => {
  it.each(["direct", "Ground Swell"])(
    "Powerful Punch pays and defeats an initiating villain through %s before dealing its boost, conserving nested continuation",
    (route) => {
      let s = room(
        boss(base(false, "standard", "mystique", "colossus"), "32121a"),
        "32126b",
      );
      const old = s.villain.id,
        next = nextBoss(s, "32122a"),
        collision = minion(s, "32074");
      s.villain.hp = 4;
      const [punch, energy] = hand(s, ["32014", "32022"]);
      const [dealt, replacementBoost] = top(s, "32131", "01186");
      s = route === "direct" ? attack(s) : reveal(s, "32132");
      for (
        let n = 0;
        s.prompt &&
        !s.prompt.options.some(
          (o) => o.image === punch.code || /Powerful Punch/i.test(o.label),
        ) &&
        n < 100;
        n++
      ) {
        const id = passId(s);
        expect(id, JSON.stringify(s.prompt)).toBeTruthy();
        s = choose(s, id!);
      }
      const offered = s.prompt?.options.find(
        (o) => o.image === punch.code || /Powerful Punch/i.test(o.label),
      );
      expect(offered, JSON.stringify(s.prompt)).toBeTruthy();
      s = choose(s, offered!.id);
      expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("payment");
      s = command(s, { type: "PAY", ids: [energy.id] });
      s = settle(s);
      expect(s.villain.id).toBe(next.id);
      expect(s.victoryDisplay?.filter((p) => p.id === old)).toHaveLength(1);
      expect(s.encounter.dealt.filter((p) => p.id === dealt.id)).toHaveLength(
        1,
      );
      expect(
        s.encounter.discard.filter((p) => p.id === replacementBoost.id),
      ).toHaveLength(1);
      expect(
        s.encounter.discard.filter((p) => p.id === collision.id),
      ).toHaveLength(1);
      for (const p of [punch, energy])
        expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
      expect(s.player.hp).toBe(12); // only the new Blob's actual two-damage attack
      expect(s.player.stunned).toBe(false);
      expect(statusCards(s.player, "stunned")).toBe(1);
      expect(s.resolving).toEqual([]);
      expect(s.currentEventId).toBeUndefined();
      expect(s.queue).toEqual([]);
      expect(s.attack).toBeNull();
      expect(s.scheming).toBeUndefined();
      expect(s.activePlayerId).toBe("p1");
      exact(reload(s));
    },
  );
  it.each(["direct", "Ground Swell"])(
    "Preemptive Strike pays during %s boost reveal, defeats that original villain and finishes its event after collision",
    (route) => {
      let s = room(
        boss(base(false, "standard", "mystique", "ms_marvel"), "32121a"),
        "32126b",
      );
      const old = s.villain.id,
        next = nextBoss(s, "32122a"),
        collision = minion(s, "32074");
      s.villain.hp = 1;
      const [strike, resource] = hand(s, ["05014", "05023"]);
      const [boost] = top(s, "32131", "32131", "01186");
      s = route === "direct" ? attack(s) : reveal(s, "32132");
      for (
        let n = 0;
        s.prompt &&
        !s.prompt.options.some(
          (o) => o.image === strike.code || /Preemptive Strike/i.test(o.label),
        ) &&
        n < 100;
        n++
      ) {
        const id = passId(s);
        expect(id, JSON.stringify(s.prompt)).toBeTruthy();
        s = choose(s, id!);
      }
      expect(s.prompt?.title).toBe("Boost card revealed");
      const offered = s.prompt?.options.find(
        (o) => o.image === strike.code || /Preemptive Strike/i.test(o.label),
      );
      expect(offered).toBeTruthy();
      s = choose(s, offered!.id);
      expect(s.prompt?.kind).toBe("payment");
      s = command(s, { type: "PAY", ids: [resource.id] });
      s = settle(s);
      expect(s.villain.id).toBe(next.id);
      expect(s.player.hp).toBe(8);
      expect(s.victoryDisplay?.filter((p) => p.id === old)).toHaveLength(1);
      expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
        1,
      );
      expect(
        s.encounter.discard.filter((p) => p.id === collision.id),
      ).toHaveLength(1);
      for (const p of [strike, resource])
        expect(s.player.discard.filter((q) => q.id === p.id)).toHaveLength(1);
      expect(s.resolving).toEqual([]);
      expect(s.currentEventId).toBeUndefined();
      expect(s.queue).toEqual([]);
      expect(s.attack).toBeNull();
      expect(s.scheming).toBeUndefined();
      expect(s.activePlayerId).toBe("p1");
      exact(reload(s));
    },
  );
  it("removes Steady from all four character types when the actual Atrium completes", () => {
    let s = room(boss(base(), "32121a"), "32126b");
    const a = ally(s),
      m = minion(s);
    const chars = ["hero:p1", a.id, m.id, s.villain.id];
    s = settle(
      native(
        s,
        ...chars.flatMap((target) => [
          { type: "status", target, status: "stunned" } as Effect,
          { type: "status", target, status: "stunned" } as Effect,
        ]),
      ),
    );
    const deck = mission(s).mainDeck,
      i = deck.findIndex((p) => p.code.slice(0, -1) === "32129");
    deck.unshift(...deck.splice(i, 1));
    s.scheme.threat = 6;
    s = settle(native(s, { type: "threat", target: "main", amount: 1 }));
    expect(s.scheme.code).toBe("32129b");
    for (const p of [
      s.player,
      inPlay(s, a.id),
      s.minions.find((p) => p.id === m.id)!,
      s.villain,
    ]) {
      expect(statusCards(p, "stunned")).toBe(1);
      expect(p.stunned).toBe(true);
    }
  });
  it("pays for Swinging Web Kick, targets the physical villain, then attacks the different replacement ID", () => {
    let s = room(boss(base(), "32121a"), "32129b");
    const old = s.villain.id;
    s.villain.hp = 8;
    const [kick, energy, single] = hand(s, ["01005", "01088", "01009"]);
    s = command(s, { type: "PLAY", id: kick.id });
    s = command(s, { type: "PAY", ids: [energy.id, single.id] });
    s = settle(target(s, old));
    expect(s.villain.id).not.toBe(old);
    expect(s.victoryDisplay?.filter((p) => p.id === old)).toHaveLength(1);
    for (const p of [kick, energy, single])
      expect(s.player.discard.some((q) => q.id === p.id)).toBe(true);
    const replacement = s.villain.id,
      hp = s.villain.hp;
    s = settle(
      native(s, {
        type: "damage",
        target: "villain",
        amount: 1,
        source: "hero",
      }),
    );
    expect(s.villain.id).toBe(replacement);
    expect(s.villain.tough).toBe(false);
    expect(s.villain.hp).toBe(hp);
    s = command(s, { type: "BASIC", action: "attack" });
    if (s.prompt?.options.some((o) => o.id === replacement)) {
      expect(s.prompt.options.some((o) => o.id === old)).toBe(false);
      s = choose(s, replacement);
    }
    s = settle(s);
    expect(s.villain.hp).toBe(hp - 3);
  });
  it.each(["hero", "alter"] as const)(
    "reveals a next original villain and activates it against the matching minion's %s controller",
    (form) => {
      let s = room(boss(base(true), "32121a"), "32126b");
      const next = nextBoss(s, "32122a"),
        collision = minion(s, "32074", "p2");
      seatView(s, "p2").player.form = form;
      top(s, "32131", "32131", "01186");
      const hp1 = s.player.hp,
        hp2 = seatView(s, "p2").player.hp;
      s = defeat(s);
      expect(s.villain.id).toBe(next.id);
      expect(s.villain.code).toBe("32122a");
      expect(s.minions.some((p) => p.id === collision.id)).toBe(false);
      expect(
        s.encounter.discard.filter((p) => p.id === collision.id),
      ).toHaveLength(1);
      expect(s.player.hp).toBe(hp1);
      expect(seatView(s, "p2").player.hp).toBe(form === "hero" ? hp2 - 2 : hp2);
      expect(s.scheme.threat).toBe(form === "alter" ? 1 : 0);
      expect(s.activePlayerId).toBe("p1");
      expect(s.attack).toBeNull();
      expect(s.scheming).toBeUndefined();
    },
  );
  it.each(["32122a", "32124a"])(
    "actual Unstoppable Overkill applies %s's damage receipt to the surviving controller once",
    (code) => {
      let s = room(
        boss(base(false, "standard", "mystique", "colossus"), code),
        "32129b",
      );
      const nemesisIds = s.player.setAside!.map((p) => p.id);
      expect(s.player.setAside!.map((p) => p.code).sort()).toEqual([
        "32026",
        "32027",
        "32028",
        "32028",
        "32029",
      ]);
      s = settle(reveal(s, "01190"));
      // The actual nemesis sources started set aside. Shadow of the Past moves
      // their IDs into native encounter zones; it introduces no fixture cards.
      for (const id of nemesisIds)
        expect(physical(s).filter((p) => p.id === id)).toHaveLength(1);
      const juggernautIndex = s.minions.findIndex((p) => p.code === "32026");
      expect(juggernautIndex).toBeGreaterThanOrEqual(0);
      s.encounter.discard.push(...s.minions.splice(juggernautIndex, 1));
      const a = ally(s, "32002"),
        [h] = hand(s, [s.player.deck[0].code]);
      const unstoppable = take(s, "32028");
      s = settle(native(s, { type: "reveal", piece: unstoppable, skip: true }));
      expect(
        s.attachments.find((p) => p.id === unstoppable.id)?.attachedTo,
      ).toBe(s.villain.id);
      top(s, "32131");
      const hp = s.player.hp,
        remaining = pieceHP(s, inPlay(s, a.id)) - inPlay(s, a.id).damage;
      // Shadow of the Past also revealed the real Rampaging Juggernaut:
      // its amplification icon adds one to Beatdown's printed two boosts.
      expect(s.sideSchemes.find((p) => p.code === "32027")).toBeTruthy();
      expect(
        (card("32027") as Card & { scheme_amplify?: number }).scheme_amplify,
      ).toBe(1);
      const amount = enemyStats(s, s.villain).attack + 3;
      s = settle(defend(attack(s), a.id));
      expect(s.player.discard.some((p) => p.id === a.id)).toBe(true);
      expect(s.player.hp, JSON.stringify(s.log)).toBe(hp - amount + remaining);
      if (code === "32122a") expect(s.player.stunned).toBe(true);
      else {
        expect(s.player.hand.some((p) => p.id === h.id)).toBe(false);
        expect(s.player.discard.filter((p) => p.id === h.id)).toHaveLength(1);
      }
      expect(
        s.encounter.discard.filter((p) => p.id === unstoppable.id),
      ).toHaveLength(1);
    },
  );
  it.each(["retaliate", "Avalanche"])(
    "preserves outer context and source timing with %s first before a collision schemes",
    (first) => {
      let s = room(boss(base(true), "32121a"), "32127b");
      const a = ally(s);
      const old = s.villain.id,
        next = nextBoss(s, "32122a"),
        collision = minion(s, "32074", "p2");
      s.villain.hp = 1;
      seatView(s, "p2").player.form = "alter";
      top(s, "01186", "32131", "32131", "01186");
      s = settle(attack(s), (v) =>
        v.prompt?.title === "Forced responses"
          ? v.prompt.options.find((o) => new RegExp(first, "i").test(o.label))
              ?.id
          : undefined,
      );
      expect(s.villain.id).toBe(next.id);
      expect(s.victoryDisplay?.filter((p) => p.id === old)).toHaveLength(1);
      expect(s.encounter.discard.some((p) => p.id === collision.id)).toBe(true);
      expect(s.scheme.threat).toBe(1);
      expect(inPlay(s, a.id).exhausted).toBe(first === "Avalanche");
      expect(s.player.stunned).toBe(false);
      expect(s.attack).toBeNull();
      expect(s.scheming).toBeUndefined();
      expect(s.activePlayerId).toBe("p1");
    },
  );
});
