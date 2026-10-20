/** Native Spider-Ham acceptance: original forty-card source, retained physical
 * identity and encounter instances, real dispatch and JSON continuation. */
import { describe, expect, it } from "vitest";
import {
  aerial,
  card,
  deckCodes,
  handSize,
  heroCard,
  heroStats,
} from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import {
  dispatch,
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
  paymentSources,
  playable,
} from "../src/game/engine.js";
import { activateSeat, seatView } from "../src/game/team.js";
import type { Effect, GameState, Piece } from "../src/game/types.js";
import {
  choose,
  command,
  native,
  pay,
  play,
  reload,
  respond,
  target,
  until,
} from "./dv-test-helpers.js";

type HamPlayer = GameState["player"] & { spiderHamIdentity?: Piece };
type Fixture = GameState & { hamOriginalIds?: string[] };
const inheritors = Array.from({ length: 9 }, (_, n) => String(30030 + n));
function identity(s: GameState): Piece {
  const p = (s.player as HamPlayer).spiderHamIdentity;
  expect(
    p,
    "The real Spider-Ham identity must be initialized by the host",
  ).toBeDefined();
  return p!;
}
function toon(s: GameState, count?: number) {
  if (count !== undefined) identity(s).counters = count;
  return identity(s).counters;
}
function all(s: GameState): Piece[] {
  const nested = (p: Piece): Piece[] => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
    ...(p.inheritorBoosts || []).flatMap(nested),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.deck,
        ...p.hand,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
        ...((p as HamPlayer).spiderHamIdentity
          ? [(p as HamPlayer).spiderHamIdentity!]
          : []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function exact(s: GameState) {
  for (const id of (s as Fixture).hamOriginalIds || [])
    expect(
      all(s).filter((p) => p.id === id),
      `original physical ${id}`,
    ).toHaveLength(1);
}
function settle(
  s: GameState,
  prefer?: (s: GameState) => string | undefined,
): GameState {
  for (let n = 0; s.prompt && n < 180; n++) {
    expect(s.prompt.kind, JSON.stringify(s.prompt)).not.toBe("payment");
    const id =
      prefer?.(s) ||
      s.prompt.options.find((o) =>
        [
          "skip",
          "pass",
          "no",
          "decline",
          "allow",
          "none",
          "resolve",
          "continue",
          "done",
          "take",
        ].includes(o.id),
      )?.id ||
      (s.prompt.options.length === 1 ||
      /Forced responses|mandatory/i.test(s.prompt.title)
        ? s.prompt.options[0]?.id
        : undefined);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  exact(s);
  return s;
}
function starting(other?: string, hamSeat = "p1") {
  const ham = { heroId: "spiderham", aspect: "justice" as const };
  const teammate = {
    heroId: other || "spider_man",
    ...(other === "thor"
      ? {
          deckCards: catalogDeckCodes(
            STARTER_DECKS.find((d) => d.id === "starter-06001a")!,
          ),
        }
      : {}),
    aspect:
      other === "thor"
        ? ("aggression" as const)
        : other === "warm"
          ? ("leadership" as const)
          : other === "groot" || other === "drax"
            ? ("protection" as const)
            : other === "ironheart"
              ? ("leadership" as const)
              : ("justice" as const),
  };
  return newGame({
    ...ham,
    villainId: "rhino",
    module: "inheritors",
    seed: 30001,
    pacing: "expert",
    ...(other
      ? { heroes: hamSeat === "p1" ? [ham, teammate] : [teammate, ham] }
      : {}),
  });
}
function base(other?: string, hamSeat = "p1") {
  let s = starting(other, hamSeat);
  for (const _seat of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    const view = seatView(s, seat),
      p = view.player;
    const source = [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    expect(source).toHaveLength(40);
    expect(source.map((p) => p.code).sort()).toEqual(
      (seat.heroId === "thor"
        ? catalogDeckCodes(
            STARTER_DECKS.find((d) => d.id === "starter-06001a")!,
          )
        : deckCodes(seat.heroId, seat.aspect)
      ).sort(),
    );
    p.deck = source;
    p.hand = [];
    p.discard = [];
    p.inPlay = [];
    p.form = "hero";
    p.exhausted = p.flipped = p.stunned = p.confused = p.tough = false;
  }
  activateSeat(s, hamSeat);
  s.turnPlayerId = hamSeat;
  s.villain.hp = s.villain.maxHp = 50;
  s.scheme.threat = 6;
  (s as Fixture).hamOriginalIds = all(s).map((p) => p.id);
  expect(
    inheritors.map((code) => all(s).filter((p) => p.code === code).length),
  ).toEqual(Array(9).fill(1));
  return s;
}
function source(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = seatView(s, seatId).player;
  for (const zone of [p.deck, p.hand, p.discard]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original player source ${seatId}:${code}`);
}
function hand(s: GameState, ...codes: string[]) {
  s.player.deck.push(...s.player.hand.splice(0));
  const pieces = codes.map((code) => source(s, code));
  s.player.hand.push(...pieces);
  return pieces;
}
function put(s: GameState, code: string, seatId = s.activePlayerId) {
  const p = source(s, code, seatId);
  seatView(s, seatId).player.inPlay.push(p);
  return p;
}
function encounter(s: GameState, code: string, seatId = s.activePlayerId) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    seatView(s, seatId).player.setAside || [],
  ]) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing actual encounter ${code}`);
}
function reveal(
  s: GameState,
  piece: Piece,
  actorId = s.activePlayerId,
  fromEncounterDeck = true,
) {
  return native(s, { type: "reveal", piece, actorId, fromEncounterDeck });
}
function neutralBoost(s: GameState) {
  const p = makePiece(s, "01104");
  s.encounter.deck.unshift(p);
  return p;
}
function slots(s: GameState, code?: string, exclude?: string) {
  return paymentSources(s, exclude, code).filter((p) =>
    p.id.startsWith("spider-ham-toon:"),
  );
}
function damaged(s: GameState, amount: number, extra: Partial<Effect> = {}) {
  return native(s, {
    type: "damage",
    target: "hero",
    amount,
    source: "fixture",
    ...extra,
  });
}
function acceptDamage(s: GameState) {
  return settle(respond(s, /Spider-Nonsense/, "30001a"));
}
function basic(
  s: GameState,
  action: "attack" | "thwart",
  id = action === "attack" ? s.villain.id : "main",
) {
  return target(command(s, { type: "BASIC", action }), id);
}
function enemy(
  s: GameState,
  code = "01103",
  damage = 0,
  seatId = s.activePlayerId,
) {
  const p = makePiece(s, code);
  p.engagedWith = seatId;
  p.damage = damage;
  s.minions.push(p);
  return p;
}
function scheme(s: GameState, code = "01107", count = 5) {
  const p = makePiece(s, code);
  p.counters = count;
  s.sideSchemes.push(p);
  return p;
}
function actual(s: GameState, p: Piece) {
  return all(s).find((q) => q.id === p.id)!;
}

describe("Spider-Ham original physical source, identities and hydration", () => {
  it("launches original Justice40, printed forms, one obligation and five reserved nemesis cards", () => {
    const s = starting(),
      starter = STARTER_DECKS.find((d) => d.id === "starter-30001a")!;
    const player = [
      ...s.player.deck,
      ...s.player.hand,
      ...s.player.discard,
      ...s.player.inPlay,
    ];
    expect(player).toHaveLength(40);
    expect(new Set(player.map((p) => p.id)).size).toBe(40);
    expect(player.map((p) => p.code).sort()).toEqual(
      catalogDeckCodes(starter).sort(),
    );
    expect(player.filter((p) => card(p).faction_code === "hero")).toHaveLength(
      15,
    );
    expect(
      player.filter((p) => card(p).faction_code === "justice"),
    ).toHaveLength(19);
    expect(player.filter((p) => card(p).faction_code === "basic")).toHaveLength(
      6,
    );
    expect(heroCard(s)).toMatchObject({
      code: "30001b",
      name: "Peter Porker",
      recover: 5,
    });
    expect(s.player.hp).toBe(12);
    expect(handSize(s)).toBe(6);
    expect(identity(s)).toMatchObject({
      code: "30001b",
      counters: 0,
      ownerId: "p1",
    });
    expect(s.player.setAside?.map((p) => p.code).sort()).toEqual([
      "30025",
      "30026",
      "30027",
      "30028",
      "30028",
    ]);
    expect(new Set(s.player.setAside?.map((p) => p.id)).size).toBe(5);
    expect(s.encounter.deck.filter((p) => p.code === "30024")).toHaveLength(1);
    expect(
      inheritors.map(
        (code) => s.encounter.deck.filter((p) => p.code === code).length,
      ),
    ).toEqual(Array(9).fill(1));
  });
  it("preserves all original source and Inheritor IDs through actual mulligan and reload", () => {
    let s = starting();
    (s as Fixture).hamOriginalIds = all(s).map((p) => p.id);
    const id = identity(s).id;
    s = settle(
      command(s, {
        type: "MULLIGAN",
        ids: s.player.hand.slice(0, 2).map((p) => p.id),
      }),
    );
    expect(s.player.hand).toHaveLength(6);
    expect(toon(s)).toBe(0);
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    expect(identity(s).id).toBe(id);
    exact(s);
  });
  it("synchronizes the same physical identity across native flips without losing counters", () => {
    let s = base();
    const id = identity(s).id;
    toon(s, 4);
    s = settle(command(s, { type: "FLIP" }));
    expect(identity(s)).toMatchObject({ id, code: "30001b", counters: 4 });
    expect(slots(s)).toHaveLength(0);
    s.player.flipped = false;
    s = settle(command(s, { type: "FLIP" }));
    expect(identity(s)).toMatchObject({ id, code: "30001a", counters: 4 });
    expect(heroStats(s)).toMatchObject({
      attack: 1,
      thwart: 2,
      defense: 1,
      recover: 5,
    });
    expect(handSize(s)).toBe(5);
  });
  it("does not replenish consumed nemesis reserve after save hydration", () => {
    let s = base();
    const original = s.player.setAside!;
    s.encounter.discard.push(...original);
    s.player.setAside = [];
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    expect(s.player.setAside).toEqual([]);
    exact(s);
  });
});

describe("original Spider-Woman distribution with Spider-Ham printings", () => {
  function setup() {
    const s = base("spider_woman", "p2");
    const spiderWoman = seatView(s, "p1").player;
    expect(spiderWoman.deck.map((p) => p.code).sort()).toEqual(
      catalogDeckCodes(
        STARTER_DECKS.find((d) => d.id === "starter-04031a")!,
      ).sort(),
    );
    return s;
  }
  function actualSide(s: GameState, code: string, count: number) {
    const p = encounter(s, code, "p2");
    expect(card(p).type_code).toBe("side_scheme");
    p.counters = count;
    s.sideSchemes.push(p);
    return p;
  }
  function attach(s: GameState, code: string, schemeId: string) {
    const p = put(s, code, "p2");
    p.attachedTo = schemeId;
    return p;
  }
  function distribute(s: GameState, assignments: [Piece, number][]) {
    activateSeat(s, "p1");
    s.turnPlayerId = "p1";
    const [event, resource] = hand(s, "04038", "04039");
    s = play(reload(s), event, [resource]);
    s = until(s, (v) => v.prompt?.title === "Inconspicuous");
    expect(s.prompt?.title).toBe("Inconspicuous");
    const before = assignments.map(([p]) => [p.id, p.counters]);
    for (const [index, [p, amount]] of assignments.entries()) {
      s = choose(reload(s), `${p.id}:${amount}`);
      if (index < assignments.length - 1)
        expect(
          assignments.map(([p]) => [
            p.id,
            s.sideSchemes.find((q) => q.id === p.id)?.counters,
          ]),
        ).toEqual(before);
    }
    expect(s.resolving.filter((p) => p.id === event.id)).toHaveLength(1);
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === resource.id),
    ).toHaveLength(1);
    exact(s);
    return s;
  }
  function retained(s: GameState, schemes: Piece[], attachments: Piece[]) {
    for (const p of schemes)
      expect(s.sideSchemes.find((q) => q.id === p.id)).toMatchObject({
        id: p.id,
        counters: 0,
      });
    for (const p of attachments)
      expect(seatView(s, "p2").player.inPlay.some((q) => q.id === p.id)).toBe(
        true,
      );
    exact(s);
  }
  function discarded(s: GameState, schemes: Piece[], attachments: Piece[]) {
    for (const p of schemes) {
      expect(s.sideSchemes.some((q) => q.id === p.id)).toBe(false);
      expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    }
    for (const p of attachments) {
      expect(seatView(s, "p2").player.inPlay.some((q) => q.id === p.id)).toBe(
        false,
      );
      expect(
        seatView(s, "p2").player.discard.filter((q) => q.id === p.id),
      ).toHaveLength(1);
    }
    exact(s);
  }
  it("distributed native thwart offers original Overwatch before Followed or removal of the simultaneous schemes", () => {
    let s = setup();
    const first = actualSide(s, "01107", 1),
      second = actualSide(s, "01108", 2),
      other = actualSide(s, "30030", 6),
      watch = attach(s, "30019", first.id),
      followed = attach(s, "30018", first.id);
    put(s, "04047", "p1");
    s = distribute(s, [
      [first, 1],
      [second, 2],
    ]);
    expect(s.prompt?.title).toBe("Overwatch");
    retained(s, [first, second], [watch, followed]);
    expect(s.villain.hp).toBe(50);
    s = respond(reload(s), /Overwatch/, "30019");
    expect(seatView(s, "p2").player.inPlay.some((p) => p.id === watch.id)).toBe(
      false,
    );
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === watch.id),
    ).toHaveLength(1);
    s = choose(reload(s), other.id);
    expect(s.sideSchemes.find((p) => p.id === other.id)?.counters).toBe(5);
    expect(s.prompt?.title).toBe("Followed");
    retained(s, [first, second], [followed]);
    s = respond(reload(s), /Followed/, "30018");
    retained(s, [first, second], [followed]);
    s = choose(reload(s), s.villain.id);
    expect(s.villain.hp).toBe(46);
    expect(s.prompt?.title).toBe("Skilled Investigator");
    discarded(s, [first, second], [followed]);
    s = settle(s);
    expect(s.sideSchemes.find((p) => p.id === other.id)?.counters).toBe(5);
  });
  it("both original Followed damage interrupts retain the full simultaneous batch before Investigator can draw", () => {
    let s = setup();
    const first = actualSide(s, "01107", 1),
      second = actualSide(s, "01108", 2),
      firstFollowed = attach(s, "30018", first.id),
      secondFollowed = attach(s, "30018", second.id),
      investigator = put(s, "04047", "p1");
    s = distribute(s, [
      [first, 1],
      [second, 2],
    ]);
    const batch = [first, second],
      attachments = [firstFollowed, secondFollowed];
    for (const hp of [46, 42]) {
      expect(s.prompt?.title).toBe("Followed");
      retained(s, batch, attachments);
      s = respond(reload(s), /Followed/, "30018");
      retained(s, batch, attachments);
      s = choose(reload(s), s.villain.id);
      expect(s.villain.hp).toBe(hp);
    }
    expect(s.prompt?.title).toBe("Skilled Investigator");
    discarded(s, batch, attachments);
    const drawn = seatView(s, "p1").player.deck[0];
    s = settle(choose(reload(s), "yes"));
    expect(seatView(s, "p1").player.hand.some((p) => p.id === drawn.id)).toBe(
      true,
    );
    expect(actual(s, investigator).exhausted).toBe(true);
    expect(seatView(s, "p2").player.hand).toHaveLength(0);
    exact(s);
  });
  it("distributed defeat of the original reserved Trap attacks the actual thwarting seat before Investigator responses", () => {
    let s = setup();
    const reserved = seatView(s, "p2").player.setAside!.map((p) => ({
        id: p.id,
        code: p.code,
      })),
      trap = actualSide(s, "30025", 3),
      gobbler = encounter(s, "30026", "p2");
    expect(reserved).toContainEqual({ id: trap.id, code: "30025" });
    expect(reserved).toContainEqual({ id: gobbler.id, code: "30026" });
    gobbler.engagedWith = "p1";
    s.minions.push(gobbler);
    put(s, "04047", "p1");
    seatView(s, "p1").player.hp = 10;
    s = distribute(s, [[trap, 3]]);
    expect(s.attack?.attacker).toBe(gobbler.id);
    expect(s.prompt?.options.some((o) => o.id === "take")).toBe(true);
    expect(s.sideSchemes.find((p) => p.id === trap.id)?.counters).toBe(0);
    expect(seatView(s, "p1").player.hp).toBe(10);
    s = until(
      choose(reload(s), "take"),
      (v) => v.prompt?.title === "Skilled Investigator",
    );
    expect(seatView(s, "p1").player.hp).toBe(8);
    expect(seatView(s, "p2").player.hp).toBe(12);
    discarded(s, [trap], []);
    expect(s.minions.find((p) => p.id === gobbler.id)?.engagedWith).toBe("p1");
    s = settle(s);
    exact(s);
  });
});

describe("native toon resources and complete cost commitment", () => {
  it("offers one unique selectable wild slot per actual hero identity counter", () => {
    const s = base();
    toon(s, 4);
    expect(slots(s)).toHaveLength(4);
    expect(new Set(slots(s).map((p) => p.id)).size).toBe(4);
    expect(slots(s).every((p) => p.resources.join() === "wild")).toBe(true);
    s.player.form = "alter";
    expect(slots(s)).toHaveLength(0);
    expect(toon(s)).toBe(4);
  });
  it("pays selected multiple ordinal slots atomically after reload", () => {
    let s = base();
    toon(s, 3);
    const [event] = hand(s, "30007");
    const ids = slots(s, event.code, event.id).map((p) => p.id);
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(reload(s), [], "energy", ids);
    s = settle(target(s, s.villain.id));
    expect(toon(s)).toBe(0);
    expect(s.villain.hp).toBe(44);
    expect(s.villain.confused).toBe(true);
    expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
  });
  it("rejects duplicate selected toon slots before any payment mutation", () => {
    let s = base();
    toon(s, 3);
    const [event] = hand(s, "30007");
    s = command(s, { type: "PLAY", id: event.id });
    const one = slots(s, event.code, event.id)[0].id;
    const failed = dispatch(reload(s), { type: "PAY", ids: [one, one, one] });
    expect(failed.error).toBeTruthy();
    expect(toon(failed)).toBe(3);
    expect(failed.player.hand).toEqual(s.player.hand);
    expect(failed.prompt).toEqual(s.prompt);
  });
  it("reserves Hogwashed additional toon and cannot fund both costs from one counter", () => {
    const s = base();
    toon(s, 1);
    const [event] = hand(s, "30004");
    enemy(s);
    expect(slots(s, event.code, event.id)).toHaveLength(0);
    expect(playable(s, event)).toBeTruthy();
    toon(s, 2);
    expect(slots(s, event.code, event.id)).toHaveLength(1);
    expect(playable(s, event)).toBeNull();
  });
  it("commits Hogwashed wild resource and additional toon once, retaining unrelated Stun and Confuse", () => {
    let s = base();
    toon(s, 2);
    s.player.stunned = s.player.confused = true;
    const m = enemy(s),
      [event] = hand(s, "30004"),
      id = slots(s, event.code, event.id)[0].id;
    s = command(s, { type: "PLAY", id: event.id });
    s = pay(s, [], "energy", [id]);
    s = settle(target(s, m.id));
    expect(toon(s)).toBe(0);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
    exact(s);
  });
  it("canceling unpaid Hogwashed retains selected source and all identity counters", () => {
    let s = base();
    toon(s, 2);
    const [event] = hand(s, "30004");
    enemy(s);
    s = command(s, { type: "PLAY", id: event.id });
    s = command(reload(s), { type: "CANCEL" });
    expect(toon(s)).toBe(2);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    exact(s);
  });
});

describe("actual damage and recovery responses", () => {
  it.each([1, 4])(
    "offers one optional toon after taking %i actual damage",
    (amount) => {
      let s = damaged(base(), amount);
      expect(s.player.hp).toBe(12 - amount);
      expect(toon(s)).toBe(0);
      s = acceptDamage(reload(s));
      expect(toon(s)).toBe(1);
    },
  );
  it("declining an actual damage response never adds a counter or repeats that window", () => {
    let s = damaged(base(), 2);
    s = settle(s);
    expect(toon(s)).toBe(0);
    s = command(s, { type: "SET_PACING", pacing: "expert" });
    expect(s.prompt).toBeNull();
    expect(toon(s)).toBe(0);
  });
  it.each([0, 3])(
    "fully prevented or zero damage %i never opens Spider-Nonsense",
    (amount) => {
      let s = base();
      if (amount) s.player.tough = true;
      s = settle(damaged(s, amount));
      expect(s.player.hp).toBe(12);
      expect(toon(s)).toBe(0);
      if (amount) expect(s.player.tough).toBe(false);
    },
  );
  it("alter-ego damage and ally damage never grant Spider-Nonsense", () => {
    let s = base();
    s.player.form = "alter";
    s = settle(damaged(s, 2));
    expect(toon(s)).toBe(0);
    const ally = put(s, "30002");
    s.player.form = "hero";
    s = settle(
      native(s, {
        type: "damage",
        target: ally.id,
        amount: 1,
        source: "fixture",
      }),
    );
    expect(toon(s)).toBe(0);
    expect(actual(s, ally).damage).toBe(1);
  });
  it("native basic recovery heals printed five and opens optional Cartoon Power once", () => {
    let s = base();
    s.player.form = "alter";
    s.player.hp = 4;
    s = command(s, { type: "BASIC", action: "recover" });
    expect(s.player.hp).toBe(9);
    expect(s.player.exhausted).toBe(true);
    expect(toon(s)).toBe(0);
    s = settle(respond(reload(s), /Cartoon Power/, "30001b"));
    expect(toon(s)).toBe(1);
    exact(s);
  });
  it("recovery finishes Death Factor, Synch and Probability Field before Cartoon Power or a teammate's Truck responds", () => {
    let s = base("deadpool");
    s.player.form = "alter";
    s.player.hp = 1;
    const synch = makePiece(s, "47018"),
      field = makePiece(s, "40049");
    for (const p of [synch, field]) {
      p.ownerId = "p1";
      s.player.inPlay.push(p);
    }
    const deathFactor = makePiece(s, "35030");
    deathFactor.attachedTo = "hero:p1";
    s.attachments.push(deathFactor);
    const truck = put(s, "44008", "p2");
    const top = source(s, "30002");
    s.player.deck.unshift(top);
    const ids = all(s)
      .map((p) => p.id)
      .sort();
    s = command(reload(s), { type: "BASIC", action: "recover" });
    expect(s.prompt?.title).toBe("Death Factor");
    expect(s.player.hp).toBe(1);
    s = choose(reload(s), "heal");
    expect(s.prompt?.title).toBe("Synch");
    expect(s.player.hp).toBe(1);
    expect(toon(s)).toBe(0);
    s = choose(reload(s), synch.id);
    expect(s.prompt?.title).toBe("Probability Field");
    expect(s.player.hp).toBe(1);
    expect(actual(s, truck).exhausted).toBe(false);
    s = choose(reload(s), field.id);
    expect(s.prompt?.title).toBe("Cartoon Power");
    expect(s.player.hp).toBe(8);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === top.id)).toBe(true);
    s = respond(reload(s), /Cartoon Power/, "30001b");
    expect(s.prompt?.title).toBe("Chimichanga Truck");
    expect(seatView(s, "p1").player.hp).toBe(8);
    s = settle(respond(reload(s), /Chimichanga Truck/));
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(actual(s, truck).exhausted).toBe(true);
    activateSeat(s, "p1");
    expect(toon(s)).toBe(1);
    expect(
      all(reload(s))
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids);
    exact(s);
  });
  it("a Death Factor recovery replacement completes before the after-recovery response and grants no healing", () => {
    let s = base();
    s.player.form = "alter";
    s.player.hp = 4;
    const deathFactor = makePiece(s, "35030");
    deathFactor.attachedTo = "hero:p1";
    s.attachments.push(deathFactor);
    s = command(reload(s), { type: "BASIC", action: "recover" });
    expect(s.prompt?.title).toBe("Death Factor");
    expect(toon(s)).toBe(0);
    s = choose(reload(s), deathFactor.id);
    expect(s.prompt?.title).toBe("Cartoon Power");
    expect(s.attachments.some((p) => p.id === deathFactor.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === deathFactor.id)).toBe(true);
    expect(s.player.hp).toBe(4);
    s = settle(respond(reload(s), /Cartoon Power/, "30001b"));
    expect(s.player.hp).toBe(4);
    expect(toon(s)).toBe(1);
    expect(s.player.exhausted).toBe(true);
    exact(s);
  });
  it("an ordinary healing effect is not a basic recovery response", () => {
    let s = base();
    s.player.form = "alter";
    s.player.hp = 4;
    s = settle(native(s, { type: "heal", target: "hero", amount: 5 }));
    expect(s.player.hp).toBe(9);
    expect(toon(s)).toBe(0);
    expect(s.player.exhausted).toBe(false);
  });
  it("teammate damage routes a retained receipt to the actual Spider-Ham victim only", () => {
    let s = base("spider_man", "p2");
    activateSeat(s, "p1");
    s = native(s, {
      type: "damage",
      target: "hero:p2",
      amount: 2,
      source: "fixture",
    });
    s = acceptDamage(s);
    expect(seatView(s, "p2").player.hp).toBe(10);
    expect(toon(seatView(s, "p2"))).toBe(1);
    expect(seatView(s, "p1").player.hp).toBe(10);
    exact(s);
  });
});

describe("Cartoon Physics retains actual identity damage packets", () => {
  it.each(["hero", "alter"] as const)(
    "discards the physical upgrade and leaves one generic damage in %s form",
    (form) => {
      let s = base();
      s.player.form = form;
      const physics = put(s, "30009");
      s = damaged(s, 5);
      expect(s.player.hp).toBe(12);
      s = respond(reload(s), /Cartoon Physics/, "30009");
      s = form === "hero" ? acceptDamage(s) : settle(s);
      expect(s.player.hp).toBe(11);
      expect(s.player.discard.filter((p) => p.id === physics.id)).toHaveLength(
        1,
      );
      expect(toon(s)).toBe(form === "hero" ? 1 : 0);
      exact(s);
    },
  );
  it("Tough consumes the damage packet before optional Physics and preserves its upgrade", () => {
    let s = base();
    const physics = put(s, "30009");
    s.player.tough = true;
    s = settle(damaged(s, 5));
    expect(s.player.hp).toBe(12);
    expect(s.player.tough).toBe(false);
    expect(actual(s, physics).code).toBe("30009");
    expect(s.player.inPlay.some((p) => p.id === physics.id)).toBe(true);
    expect(toon(s)).toBe(0);
  });
  it("one incoming damage cannot pay a Physics discard that prevents nothing", () => {
    let s = base();
    const physics = put(s, "30009");
    s = damaged(s, 1);
    expect(s.prompt?.options.some((o) => o.image === "30009")).not.toBe(true);
    s = settle(s);
    expect(s.player.hp).toBe(11);
    expect(s.player.inPlay.some((p) => p.id === physics.id)).toBe(true);
  });
  it("reduces a complete undefended native villain attack to one damage", () => {
    let s = base();
    const physics = put(s, "30009"),
      boost = neutralBoost(s);
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    s = respond(s, /Cartoon Physics/, "30009");
    s = acceptDamage(s);
    expect(s.player.hp).toBe(11);
    expect(toon(s)).toBe(1);
    expect(s.attack).toBeNull();
    expect(s.encounter.discard.some((p) => p.id === boost.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === physics.id)).toBe(true);
  });
  it("reduces actual overkill to identity without changing the defeated ally packet", () => {
    let s = base();
    const physics = put(s, "30009"),
      ally = put(s, "30002");
    ally.damage = 2;
    const charge = encounter(s, "01099");
    charge.attachedTo = s.villain.id;
    s.attachments.push(charge);
    neutralBoost(s);
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), ally.id);
    s = respond(s, /Cartoon Physics/, "30009");
    s = acceptDamage(s);
    expect(s.player.hp).toBe(11);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === physics.id)).toBe(true);
    expect(toon(s)).toBe(1);
  });
  it("actual Concussive Blast damage responds separately before Physics prevents the retained attack", () => {
    let s = base();
    const physics = put(s, "30009"),
      boost = makePiece(s, "01130");
    s.encounter.deck.unshift(boost);
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    s = respond(s, /Spider-Nonsense/, "30001a");
    expect(s.player.hp).toBe(11);
    expect(toon(s)).toBe(1);
    expect(s.player.inPlay.some((p) => p.id === physics.id)).toBe(true);
    s = respond(s, /Cartoon Physics/, "30009");
    s = acceptDamage(s);
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.some((p) => p.id === physics.id)).toBe(true);
    expect(toon(s)).toBe(2);
    expect(s.encounter.discard.filter((p) => p.id === boost.id)).toHaveLength(
      1,
    );
  });
  it("native Retaliate damage after a basic attack can use Physics and produces one toon", () => {
    let s = base();
    const physics = put(s, "30009"),
      m = enemy(s, "01184");
    s = basic(s, "attack", m.id);
    s = respond(s, /Cartoon Physics/, "30009");
    s = acceptDamage(s);
    expect(s.player.hp).toBe(11);
    expect(s.player.discard.some((p) => p.id === physics.id)).toBe(true);
    expect(toon(s)).toBe(1);
  });
  it("two damage occurrences do not let one discarded Physics prevent both", () => {
    let s = base();
    const physics = put(s, "30009");
    s = native(
      s,
      { type: "damage", target: "hero", amount: 4, source: "first" },
      { type: "damage", target: "hero", amount: 2, source: "second" },
    );
    s = respond(s, /Cartoon Physics/, "30009");
    s = settle(s, (v) =>
      /Spider-Nonsense/.test(v.prompt?.title || "") ? "yes" : undefined,
    );
    expect(s.player.hp).toBe(9);
    expect(toon(s)).toBe(2);
    expect(s.player.discard.filter((p) => p.id === physics.id)).toHaveLength(1);
  });
});

describe("signature actions, basic powers and physical ally responses", () => {
  it("Ham It Up snapshots actual retained toon count without spending counters", () => {
    let s = base();
    toon(s, 4);
    s.scheme.threat = 9;
    const [event] = hand(s, "30003");
    s = settle(target(play(s, event), "main"));
    expect(s.scheme.threat).toBe(5);
    expect(toon(s)).toBe(4);
    exact(s);
  });
  it("Confuse replaces Ham It Up's thwart while retaining all toon counters", () => {
    let s = base();
    toon(s, 4);
    s.player.confused = true;
    const [event] = hand(s, "30003");
    s = settle(play(s, event));
    expect(s.scheme.threat).toBe(6);
    expect(s.player.confused).toBe(false);
    expect(toon(s)).toBe(4);
  });
  it("Daily Beagle works only in alter-ego and exhausts its actual support for one toon", () => {
    let s = base();
    const beagle = put(s, "30008");
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: beagle.id,
        action: "daily-beagle",
      }).error,
    ).toBeTruthy();
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: beagle.id, action: "daily-beagle" });
    expect(toon(s)).toBe(1);
    expect(actual(s, beagle).exhausted).toBe(true);
    expect(s.player.exhausted).toBe(false);
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: beagle.id,
        action: "daily-beagle",
      }).error,
    ).toBeTruthy();
  });
  it("Hammer grants printed +1 ATK and its paid interrupt makes a four-damage basic overkill attack", () => {
    let s = base();
    toon(s, 2);
    const hammer = put(s, "30010"),
      m = enemy(s, "01103", 2);
    expect(heroStats(s).attack).toBe(2);
    s = basic(s, "attack", m.id);
    s = respond(reload(s), /Huge Wooden Hammer/, "30010");
    s = settle(target(s, m.id));
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.villain.hp).toBe(47);
    expect(toon(s)).toBe(1);
    expect(actual(s, hammer).exhausted).toBe(true);
    expect(s.player.exhausted).toBe(true);
    s.player.exhausted = false;
    s = settle(basic(s, "attack"));
    expect(s.villain.hp).toBe(45);
    expect(toon(s)).toBe(1);
  });
  it("Hammer is unavailable on a Stun-replaced basic attack and costs no toon", () => {
    let s = base();
    toon(s, 2);
    const hammer = put(s, "30010");
    s.player.stunned = true;
    s = settle(basic(s, "attack"));
    expect(s.player.stunned).toBe(false);
    expect(toon(s)).toBe(2);
    expect(actual(s, hammer).exhausted).toBe(false);
    expect(s.villain.hp).toBe(50);
  });
  it("Organic Webbing adds printed THW, pays one toon, readies and expires Aerial at native phase end", () => {
    let s = base();
    toon(s, 2);
    const webbing = put(s, "30011");
    s.player.exhausted = true;
    expect(heroStats(s).thwart).toBe(3);
    s = command(s, {
      type: "ABILITY",
      id: webbing.id,
      action: "organic-webbing",
    });
    expect(toon(s)).toBe(1);
    expect(s.player.exhausted).toBe(false);
    expect(actual(s, webbing).exhausted).toBe(true);
    expect(aerial(s)).toBe(true);
    s = native(s, { type: "beginVillain" });
    expect(aerial(s)).toBe(false);
    exact(s);
  });
  it("Captain Americat optional entry shuffles the selected actual signature and excludes aspect/basic cards", () => {
    let s = base();
    const [ally, signature, aspect, basicCard, fuel] = hand(
      s,
      "30002",
      "30007",
      "30014",
      "30020",
      "30003",
    );
    s.player.discard.push(signature, aspect, basicCard);
    s.player.hand = [ally, fuel];
    toon(s, 3);
    s = command(s, { type: "PLAY", id: ally.id });
    s = pay(
      s,
      [],
      "wild",
      slots(s, ally.code, ally.id).map((p) => p.id),
    );
    s = respond(s, /Captain Americat/, "30002");
    expect(toon(s)).toBe(1);
    expect(s.prompt?.options.map((o) => o.id)).toContain(signature.id);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(aspect.id);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(basicCard.id);
    s = settle(choose(reload(s), signature.id));
    expect(s.player.deck.some((p) => p.id === signature.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === signature.id)).toBe(false);
    exact(s);
  });
  it("declining Captain Americat's entry response retains zero toon and does not shuffle a card", () => {
    let s = base();
    toon(s, 3);
    const [ally] = hand(s, "30002");
    s = command(s, { type: "PLAY", id: ally.id });
    s = pay(
      s,
      [],
      "wild",
      slots(s, ally.code, ally.id).map((p) => p.id),
    );
    s = settle(s);
    expect(toon(s)).toBe(0);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
  });
  it("Captain Americat gains one toon in alter-ego even without an eligible discarded signature", () => {
    let s = base();
    s.player.form = "alter";
    const [ally, first, second, third] = hand(
      s,
      "30002",
      "30012",
      "30014",
      "30020",
    );
    s = play(s, ally, [first, second, third]);
    s = settle(respond(s, /Captain Americat/, "30002"));
    expect(toon(s)).toBe(1);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.discard.map((p) => p.id).sort()).toEqual(
      [first.id, second.id, third.id].sort(),
    );
  });
  it("Petulant Pig waits for complete villain attack and responses before drawing the actual three cards", () => {
    let s = base();
    const [event] = hand(s, "30006");
    neutralBoost(s);
    const draws = s.player.deck.slice(0, 3).map((p) => p.id);
    s = play(s, event);
    expect(s.player.hand).toHaveLength(0);
    s = choose(s, "take");
    s = until(s, (v) => /Spider-Nonsense/.test(v.prompt?.title || ""));
    expect(s.player.hp).toBe(10);
    expect(s.player.hand).toHaveLength(0);
    s = acceptDamage(s);
    expect(s.player.hand.map((p) => p.id)).toEqual(draws);
    expect(toon(s)).toBe(1);
    expect(s.attack).toBeNull();
    exact(s);
  });
  it("Petulant Pig draws three after villain Stun replaces the attack", () => {
    let s = base();
    s.villain.stunned = true;
    const [event] = hand(s, "30006");
    const draws = s.player.deck.slice(0, 3).map((p) => p.id);
    s = settle(play(s, event));
    expect(s.villain.stunned).toBe(false);
    expect(s.player.hp).toBe(12);
    expect(s.player.hand.map((p) => p.id)).toEqual(draws);
    expect(toon(s)).toBe(0);
  });
});

describe("complete encounter-card cancellation on actual native reveal", () => {
  it.each(["01104", "01103", "01107", "01099"])(
    "cancels all effects and discards revealed physical %s",
    (code) => {
      let s = base();
      toon(s, 2);
      const [event] = hand(s, "30005");
      const revealed = encounter(s, code),
        originalThreat = s.scheme.threat;
      s = reveal(s, revealed);
      s = respond(reload(s), /I Don't Think So/, "30005");
      expect(s.prompt?.kind).toBe("payment");
      expect(slots(s, event.code, event.id)).toHaveLength(1);
      s = pay(
        s,
        [],
        "energy",
        slots(s, event.code, event.id).map((p) => p.id),
      );
      s = settle(s);
      expect(toon(s)).toBe(0);
      expect(
        s.encounter.discard.filter((p) => p.id === revealed.id),
      ).toHaveLength(1);
      expect(s.player.discard.filter((p) => p.id === event.id)).toHaveLength(1);
      expect(s.minions.some((p) => p.id === revealed.id)).toBe(false);
      expect(s.sideSchemes.some((p) => p.id === revealed.id)).toBe(false);
      expect(s.attachments.some((p) => p.id === revealed.id)).toBe(false);
      expect(s.encounter.dealt).toHaveLength(0);
      expect(s.scheme.threat).toBe(originalThreat);
      expect(s.player.hp).toBe(12);
      exact(s);
    },
  );
  it("one toon without an independent resource cannot fund reveal resource and counter costs", () => {
    let s = base();
    toon(s, 1);
    hand(s, "30005");
    const revealed = encounter(s, "01103");
    s = reveal(s, revealed);
    expect(s.prompt?.options.some((o) => o.image === "30005")).not.toBe(true);
    s = settle(s);
    expect(toon(s)).toBe(1);
    expect(s.minions.some((p) => p.id === revealed.id)).toBe(true);
  });
  it("canceling reaction payment returns to the same original reveal without spending toon or event", () => {
    let s = base();
    toon(s, 2);
    const [event] = hand(s, "30005");
    const revealed = encounter(s, "01107");
    s = respond(reveal(s, revealed), /I Don't Think So/, "30005");
    s = command(reload(s), { type: "CANCEL" });
    expect(toon(s)).toBe(2);
    expect(s.player.hand.some((p) => p.id === event.id)).toBe(true);
    s = settle(s);
    expect(s.sideSchemes.some((p) => p.id === revealed.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === revealed.id)).toBe(false);
    exact(s);
  });
  it("a canceled physical card can be shuffled back and revealed normally on a later occurrence", () => {
    let s = base();
    toon(s, 2);
    const [event] = hand(s, "30005"),
      revealed = encounter(s, "01103");
    s = respond(reveal(s, revealed), /I Don't Think So/, "30005");
    s = pay(
      s,
      [],
      "energy",
      slots(s, event.code, event.id).map((p) => p.id),
    );
    s = settle(s);
    expect(s.minions.some((p) => p.id === revealed.id)).toBe(false);
    const index = s.encounter.discard.findIndex((p) => p.id === revealed.id);
    expect(index).toBeGreaterThanOrEqual(0);
    s.encounter.deck.unshift(s.encounter.discard.splice(index, 1)[0]);
    s = native(reload(s), { type: "revealNext" });
    s = acceptDamage(s);
    expect(s.minions.filter((p) => p.id === revealed.id)).toHaveLength(1);
    expect(s.player.hp).toBe(11);
    expect(toon(s)).toBe(1);
    exact(s);
  });
  it.each(["alter", "not-deck"])(
    "does not offer hero encounter-deck cancellation for %s reveal",
    (mode) => {
      let s = base();
      toon(s, 2);
      hand(s, "30005");
      if (mode === "alter") s.player.form = "alter";
      s = reveal(
        s,
        encounter(s, "01103"),
        s.activePlayerId,
        mode !== "not-deck",
      );
      expect(s.prompt?.options.some((o) => o.image === "30005")).not.toBe(true);
      s = settle(s);
      expect(toon(s)).toBe(2);
    },
  );
});

describe("actual owner obligation and reserved nemesis continuations", () => {
  it("obligation belongs to Peter Porker and pays actual identity exhaustion and toon before removal", () => {
    let s = base("spider_man", "p2");
    toon(s, 2);
    const obligation = encounter(s, "30024");
    activateSeat(s, "p1");
    s = reveal(s, obligation, "p1");
    s = choose(s, "alter");
    s = settle(choose(reload(s), "exhaust"));
    const ham = seatView(s, "p2");
    expect(ham.player.form).toBe("alter");
    expect(ham.player.exhausted).toBe(true);
    expect(toon(ham)).toBe(1);
    expect(ham.player.flipped).toBe(false);
    expect(seatView(s, "p1").player.exhausted).toBe(false);
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
    exact(s);
  });
  it.each([false, true])(
    "obligation's Stun branch has Surge only when already stunned=%s",
    (stunned) => {
      let s = base();
      s.player.stunned = stunned;
      const obligation = encounter(s, "30024");
      s = choose(reveal(s, obligation), "stay");
      expect(s.prompt?.options.map((o) => o.id)).not.toContain("exhaust");
      s = settle(choose(s, "stun"));
      expect(s.player.stunned).toBe(true);
      expect(s.encounter.dealt).toHaveLength(stunned ? 1 : 0);
      expect(
        s.encounter.discard.filter((p) => p.id === obligation.id),
      ).toHaveLength(1);
    },
  );
  it("Shadow of the Past moves all five actual reserved nemesis IDs without recreating any", () => {
    let s = base();
    toon(s, 4);
    const originals = s.player.setAside!.map((p) => ({ ...p }));
    const shadow = encounter(s, "01190");
    s = settle(reveal(s, shadow));
    expect(s.player.setAside).toEqual([]);
    expect(toon(s)).toBe(0);
    expect(s.minions.find((p) => p.code === "30026")?.id).toBe(
      originals.find((p) => p.code === "30026")!.id,
    );
    expect(s.sideSchemes.find((p) => p.code === "30025")).toMatchObject({
      id: originals.find((p) => p.code === "30025")!.id,
      counters: 3,
    });
    for (const p of originals.filter((p) =>
      ["30027", "30028"].includes(p.code),
    ))
      expect(s.encounter.deck.filter((q) => q.id === p.id)).toHaveLength(1);
    exact(s);
  });
  it("Gobbler engagement clears all controlled card and identity counters while preserving HP, damage and statuses", () => {
    let s = base("spider_man");
    toon(s, 4);
    const ally = put(s, "30002"),
      webbing = put(s, "30011"),
      remote = put(s, "01008", "p2");
    ally.counters = 3;
    ally.damage = 1;
    ally.stunned = true;
    webbing.counters = 2;
    remote.counters = 3;
    s.player.hp = 9;
    s.player.stunned = s.player.confused = s.player.tough = true;
    s.flags.grootGrowthCounters = 5;
    s.flags.draxVengeanceCounters = 3;
    s.flags.warMachineAmmo = 6;
    s = settle(reveal(s, encounter(s, "30026")));
    expect(toon(s)).toBe(0);
    expect(actual(s, ally)).toMatchObject({
      counters: 0,
      damage: 1,
      stunned: true,
    });
    expect(actual(s, webbing).counters).toBe(0);
    expect(s.flags.grootGrowthCounters).toBe(0);
    expect(s.flags.draxVengeanceCounters).toBe(0);
    expect(s.flags.warMachineAmmo).toBe(0);
    expect(s.player).toMatchObject({
      hp: 9,
      stunned: true,
      confused: true,
      tough: true,
    });
    expect(actual(s, remote).counters).toBe(3);
    exact(s);
  });
  it.each(["groot", "drax", "warm", "ironheart"])(
    "Gobbler clears %s identity's actual counter store on that engaged seat only",
    (heroId) => {
      let s = base(heroId);
      toon(s, 3);
      const view = seatView(s, "p2");
      if (heroId === "groot") view.flags.grootGrowthCounters = 5;
      if (heroId === "drax") view.flags.draxVengeanceCounters = 3;
      if (heroId === "warm") view.flags.warMachineAmmo = 6;
      if (heroId === "ironheart") view.player.ironheartIdentity!.counters = 4;
      const gobbler = encounter(s, "30026", "p1");
      s = settle(reveal(s, gobbler, "p2"));
      const after = seatView(s, "p2");
      if (heroId === "groot") expect(after.flags.grootGrowthCounters).toBe(0);
      if (heroId === "drax") expect(after.flags.draxVengeanceCounters).toBe(0);
      if (heroId === "warm") expect(after.flags.warMachineAmmo).toBe(0);
      if (heroId === "ironheart")
        expect(after.player.ironheartIdentity!.counters).toBe(0);
      expect(toon(seatView(s, "p1"))).toBe(3);
      expect(s.minions.find((p) => p.id === gobbler.id)?.engagedWith).toBe(
        "p2",
      );
      exact(s);
    },
  );
  it("actual Get Over Here transfers Gobbler and clears only the new recipient's controlled counters", () => {
    let s = base("thor");
    toon(s, 4);
    const webbing = put(s, "30011"),
      hall = put(s, "06017", "p2"),
      hammer = put(s, "06009", "p2"),
      gobbler = encounter(s, "30026");
    webbing.counters = 2;
    hall.counters = 3;
    gobbler.engagedWith = "p1";
    s.minions.push(gobbler);
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    expect(aerial(s)).toBe(true);
    const [event] = hand(s, "06014");
    s = settle(play(reload(s), event));
    expect(s.minions.find((p) => p.id === gobbler.id)).toMatchObject({
      engagedWith: "p2",
      damage: 1,
    });
    expect(actual(s, hall).counters).toBe(0);
    expect(actual(s, hammer).id).toBe(hammer.id);
    expect(toon(seatView(s, "p1"))).toBe(4);
    expect(actual(s, webbing).counters).toBe(2);
    expect(
      seatView(s, "p2").player.discard.filter((p) => p.id === event.id),
    ).toHaveLength(1);
    exact(s);
  });
  it("actual identity defeat hands Gobbler to the surviving Ham seat and clears that seat's counters", () => {
    let s = base("spider_man", "p2");
    toon(s, 4);
    const ally = put(s, "30002"),
      webbing = put(s, "30011"),
      gobbler = encounter(s, "30026");
    ally.counters = 3;
    ally.damage = 1;
    ally.stunned = true;
    webbing.counters = 2;
    s.player.hp = 9;
    s.player.confused = s.player.tough = true;
    gobbler.engagedWith = "p1";
    s.minions.push(gobbler);
    s = settle(
      native(reload(s), {
        type: "damage",
        target: "hero:p1",
        amount: 99,
        source: "fixture",
      }),
    );
    expect(s.players.find((seat) => seat.id === "p1")?.eliminated).toBe(true);
    expect(s.players.find((seat) => seat.id === "p2")?.eliminated).toBe(false);
    expect(s.minions.find((p) => p.id === gobbler.id)).toMatchObject({
      engagedWith: "p2",
      damage: 0,
    });
    const ham = seatView(s, "p2");
    expect(toon(ham)).toBe(0);
    expect(ham.player).toMatchObject({ hp: 9, confused: true, tough: true });
    expect(actual(s, ally)).toMatchObject({
      counters: 0,
      damage: 1,
      stunned: true,
    });
    expect(actual(s, webbing).counters).toBe(0);
    expect(s.phase).not.toBe("lost");
    exact(s);
  });
  it("Making an Entrance heals after Trap's mandatory attack and cannot rescue or heal across an eliminated seat", () => {
    let s = base("spider_man");
    s.player.hp = 2;
    seatView(s, "p2").player.hp = 5;
    const reserved = s.player.setAside!.map((p) => ({
        id: p.id,
        code: p.code,
      })),
      trap = encounter(s, "30025"),
      gobbler = encounter(s, "30026");
    expect(reserved).toContainEqual({ id: trap.id, code: "30025" });
    expect(reserved).toContainEqual({ id: gobbler.id, code: "30026" });
    trap.counters = card(trap).base_threat!;
    s.sideSchemes.push(trap);
    gobbler.engagedWith = "p1";
    s.minions.push(gobbler);
    const [entrance, resource] = hand(s, "30016", "30003");
    s = command(reload(s), { type: "BASIC", action: "thwart" });
    s = respond(s, /Making an Entrance/, "30016");
    s = pay(reload(s), [resource]);
    s = target(reload(s), trap.id);
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.attack?.attacker).toBe(gobbler.id);
    expect(s.sideSchemes.find((p) => p.id === trap.id)?.counters).toBe(0);
    expect(seatView(s, "p1").player.hp).toBe(2);
    expect(seatView(s, "p2").player.hp).toBe(5);
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === entrance.id),
    ).toHaveLength(1);
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === resource.id),
    ).toHaveLength(1);
    exact(s);
    s = settle(choose(reload(s), "take"));
    expect(s.players.find((seat) => seat.id === "p1")?.eliminated).toBe(true);
    expect(s.players.find((seat) => seat.id === "p2")?.eliminated).toBe(false);
    expect(seatView(s, "p1").player.hp).toBe(0);
    expect(seatView(s, "p2").player.hp).toBe(5);
    expect(s.minions.find((p) => p.id === gobbler.id)?.engagedWith).toBe("p2");
    expect(s.sideSchemes.some((p) => p.id === trap.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === trap.id)).toHaveLength(1);
    expect(s.phase).not.toBe("lost");
    exact(s);
  });
  it("Even the Odds completes its actual defeated-Trap receipt after lethal attack without crediting the surviving seat", () => {
    let s = base("spider_man");
    s.player.hp = 2;
    seatView(s, "p2").player.hp = 5;
    const remote = put(s, "01008", "p2"),
      trap = encounter(s, "30025"),
      gobbler = encounter(s, "30026");
    remote.counters = 3;
    trap.counters = card(trap).base_threat!;
    s.sideSchemes.push(trap);
    gobbler.engagedWith = "p2";
    s.minions.push(gobbler);
    s = settle(basic(reload(s), "thwart", trap.id));
    expect(s.sideSchemes.find((p) => p.id === trap.id)?.counters).toBe(1);
    expect(seatView(s, "p1").player.hp).toBe(2);
    const [event, energy, mental] = hand(s, "30014", "30004", "30003");
    expect(card(energy).resource_energy).toBe(1);
    expect(card(mental).resource_mental).toBe(1);
    s = play(reload(s), event, [energy, mental], "energy");
    s = until(s, (v) => !!v.prompt?.options.some((o) => o.id === "take"));
    expect(s.attack?.attacker).toBe(gobbler.id);
    expect(s.sideSchemes.find((p) => p.id === trap.id)?.counters).toBe(0);
    expect(s.villain.hp).toBe(50);
    expect(seatView(s, "p1").player.hp).toBe(2);
    exact(s);
    s = settle(choose(reload(s), "take"));
    expect(s.players.find((seat) => seat.id === "p1")?.eliminated).toBe(true);
    expect(s.players.find((seat) => seat.id === "p2")?.eliminated).toBe(false);
    expect(seatView(s, "p1").player.hp).toBe(0);
    expect(seatView(s, "p2").player.hp).toBe(5);
    expect(actual(s, remote).counters).toBe(3);
    expect(s.minions.find((p) => p.id === gobbler.id)?.engagedWith).toBe("p2");
    expect(s.sideSchemes.some((p) => p.id === trap.id)).toBe(false);
    expect(s.encounter.discard.filter((p) => p.id === trap.id)).toHaveLength(1);
    expect(s.villain.hp).toBe(49);
    expect(
      s.players.flatMap((seat) =>
        Object.keys(seatView(s, seat).flags).filter((key) =>
          key.startsWith("spiderHamBatch"),
        ),
      ),
    ).toEqual([]);
    for (const p of [event, energy, mental])
      expect(s.removed.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.phase).not.toBe("lost");
    exact(s);
  });
  it("Nefarious Trap attacks with the existing physical Gobbler and completes that activation before removal", () => {
    let s = base();
    const gobbler = encounter(s, "30026");
    gobbler.engagedWith = "p1";
    s.minions.push(gobbler);
    const trap = encounter(s, "30025");
    trap.counters = 1;
    s.sideSchemes.push(trap);
    s = native(s, {
      type: "thwart",
      target: trap.id,
      amount: 1,
      source: "hero",
    });
    s = choose(s, "take");
    s = acceptDamage(s);
    expect(s.player.hp).toBe(10);
    expect(toon(s)).toBe(1);
    expect(s.minions.find((p) => p.id === gobbler.id)?.id).toBe(gobbler.id);
    expect(s.encounter.discard.some((p) => p.id === trap.id)).toBe(true);
    exact(s);
  });
  it.each(["deck", "discard"])(
    "absent Gobbler is searched from %s and PUT engaged without an extra attack",
    (zone) => {
      let s = base();
      toon(s, 3);
      const gobbler = encounter(s, "30026"),
        trap = encounter(s, "30025");
      trap.counters = 1;
      s.sideSchemes.push(trap);
      s.encounter[zone === "deck" ? "deck" : "discard"].push(gobbler);
      s = native(s, {
        type: "thwart",
        target: trap.id,
        amount: 1,
        source: "hero",
      });
      s = settle(choose(reload(s), gobbler.id));
      expect(s.player.hp).toBe(12);
      expect(toon(s)).toBe(0);
      expect(s.minions.find((p) => p.id === gobbler.id)).toMatchObject({
        engagedWith: "p1",
      });
      expect(s.attack).toBeNull();
      exact(s);
    },
  );
  it("Glider prefers actual Gobbler over other minions and grants printed attack/scheme/Aerial plus Surge", () => {
    let s = base();
    const gobbler = encounter(s, "30026");
    gobbler.engagedWith = "p1";
    s.minions.push(gobbler);
    const other = enemy(s),
      glider = encounter(s, "30027");
    s = reveal(s, glider);
    expect(s.prompt?.options.some((o) => o.id === other.id)).toBe(false);
    s = settle(choose(s, gobbler.id));
    expect(s.attachments.find((p) => p.id === glider.id)?.attachedTo).toBe(
      gobbler.id,
    );
    expect(s.encounter.dealt).toHaveLength(1);
    s.scheme.threat = 0;
    s = settle(native(s, { type: "enemyScheme", id: gobbler.id }));
    expect(s.scheme.threat).toBe(2);
    s = choose(native(s, { type: "enemyAttack", id: gobbler.id }), "take");
    s = acceptDamage(s);
    expect(s.player.hp).toBe(9);
    exact(s);
  });
  it("Glider without Gobbler offers actual fallback minions and retains its physical attached card", () => {
    let s = base();
    const other = enemy(s),
      glider = encounter(s, "30027");
    s = settle(choose(reveal(s, glider), other.id));
    expect(s.attachments.find((p) => p.id === glider.id)?.attachedTo).toBe(
      other.id,
    );
    expect(s.encounter.dealt).toHaveLength(1);
    exact(s);
  });
  it.each([false, true])(
    "Feast resolves damage before Confuse and gains Surge only when already confused=%s",
    (confused) => {
      let s = base();
      s.player.confused = confused;
      const feast = encounter(s, "30028");
      s = reveal(s, feast);
      s = until(s, (v) => /Spider-Nonsense/.test(v.prompt?.title || ""));
      expect(s.player.hp).toBe(10);
      expect(s.player.confused).toBe(confused);
      s = acceptDamage(s);
      expect(s.player.confused).toBe(true);
      expect(s.encounter.dealt).toHaveLength(confused ? 1 : 0);
      expect(s.encounter.discard.filter((p) => p.id === feast.id)).toHaveLength(
        1,
      );
      exact(s);
    },
  );
});
