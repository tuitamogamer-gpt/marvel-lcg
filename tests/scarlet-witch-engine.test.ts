/** Scarlet Witch acceptance: native commands, printed cards and saved decisions. */
import { describe, expect, it } from "vitest";
import { handSize, heroCard, heroStats } from "../src/game/cards.js";
import { catalogDeckCodes, STARTER_DECKS } from "../src/game/catalog.js";
import { deckErrors } from "../src/game/decks.js";
import { dispatch, makePiece, newGame, playable } from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import type { Command, Effect, GameState, Piece } from "../src/game/types.js";

const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s));
function command(input: GameState, cmd: Command) {
  let s = dispatch(input, cmd);
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  for (let guard = 0; s.review && guard < 100; guard++)
    s = dispatch(s, { type: "PROCEED" });
  expect(s.error, JSON.stringify(s.prompt)).toBeUndefined();
  expect(s.review).toBeNull();
  return s;
}
function choose(s: GameState, id: string) {
  expect(s.prompt?.kind, JSON.stringify(s.prompt)).toBe("choice");
  expect(
    s.prompt?.options.some((o) => o.id === id),
    JSON.stringify(s.prompt),
  ).toBe(true);
  return command(reload(s), { type: "CHOOSE", id });
}
function passId(s: GameState) {
  return s.prompt?.options.find(
    (o) =>
      /^(skip|pass|none|done|continue|no|decline)$/.test(o.id) ||
      /^(skip|pass|continue without|do not|no response|decline)/i.test(o.label),
  )?.id;
}
function skipAll(s: GameState) {
  for (let guard = 0; s.prompt && guard < 50; guard++) {
    const id = passId(s);
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function optional(s: GameState) {
  for (let guard = 0; s.prompt && passId(s) && guard < 50; guard++)
    s = choose(s, passId(s)!);
  return s;
}
function ordinaryReveal(s: GameState) {
  for (let guard = 0; s.prompt && guard < 50; guard++) {
    const id =
      passId(s) ||
      ["text", "incite", "surge"].find((id) =>
        s.prompt?.options.some((o) => o.id === id),
      );
    expect(id, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, id!);
  }
  expect(s.prompt).toBeNull();
  return s;
}
function respond(s: GameState, name: RegExp, code?: string) {
  for (let guard = 0; guard < 20; guard++) {
    const option =
      s.prompt?.options.find(
        (o) => name.test(o.label) || (code && o.image === code),
      ) ||
      (name.test(s.prompt?.title || "")
        ? s.prompt?.options.find((o) => /^(yes|accept)$/.test(o.id))
        : undefined);
    if (option) return choose(s, option.id);
    const id = passId(s);
    if (!id) break;
    s = choose(s, id);
  }
  throw Error(`Missing response ${name}: ${JSON.stringify(s.prompt)}`);
}
function base(other?: "spider_man" | "qsv") {
  let s = newGame({
    heroId: "scw",
    aspect: "justice",
    villainId: "rhino",
    seed: 15001,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            { heroId: "scw", aspect: "justice" as const },
            {
              heroId: other,
              aspect:
                other === "qsv"
                  ? ("protection" as const)
                  : ("justice" as const),
            },
          ],
        }
      : {}),
  });
  s = command(s, { type: "MULLIGAN", ids: [] });
  if (other) s = command(s, { type: "MULLIGAN", ids: [] });
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.flipped = false;
    v.player.exhausted = false;
    v.player.hand = [];
    v.player.inPlay = [];
    v.player.discard = [];
    v.player.deck = Array.from({ length: 15 }, () => makePiece(s, "15019"));
  }
  s.prompt = null;
  s.review = null;
  s.queue = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.dealt = [];
  s.encounter.discard = [];
  s.scheme.threat = 3;
  s.villain.hp = s.villain.maxHp = 50;
  return s;
}
function hand(s: GameState, ...codes: string[]) {
  s.player.hand = codes.map((code) => makePiece(s, code));
  return [...s.player.hand];
}
function put(s: GameState, code: string, playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.ownerId = playerId;
  seatView(s, playerId).player.inPlay.push(p);
  return p;
}
function minion(s: GameState, code = "15025", playerId = s.activePlayerId) {
  const p = makePiece(s, code);
  p.engagedWith = playerId;
  s.minions.push(p);
  return p;
}
function side(s: GameState, code = "01107", amount = 3) {
  const p = makePiece(s, code);
  p.counters = amount;
  s.sideSchemes.push(p);
  return p;
}
function native(s: GameState, ...effects: Effect[]) {
  s.queue = effects;
  s.prompt = {
    kind: "choice",
    title: "Rules fixture",
    text: "",
    options: [{ id: "go", label: "Resolve", effects: [] }],
  };
  return choose(s, "go");
}
function reveal(s: GameState, p: Piece, fromEncounterDeck = true) {
  return native(s, { type: "reveal", piece: p, fromEncounterDeck });
}
function paid(
  s: GameState,
  p: Piece,
  ids: string[],
  wildAs?: "energy" | "mental" | "physical",
) {
  s = command(s, { type: "PLAY", id: p.id });
  if (s.prompt?.kind === "payment")
    s = command(reload(s), { type: "PAY", ids, ...(wildAs ? { wildAs } : {}) });
  return s;
}
function target(s: GameState, id: string) {
  return s.prompt?.options.some((o) => o.id === id) ? choose(s, id) : s;
}
function physical(s: GameState) {
  return [
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.discard,
    ...s.player.inPlay,
    ...s.resolving,
  ];
}
function encounterPhysical(s: GameState) {
  return [
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...s.resolving,
    ...s.removed,
  ];
}
function conserved(s: GameState, pieces: Piece[], encounter = false) {
  const all = encounter ? encounterPhysical(s) : physical(s);
  for (const p of pieces)
    expect(
      all.filter((q) => q.id === p.id),
      p.code,
    ).toHaveLength(1);
}
function boostDeck(s: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => makePiece(s, code));
  s.encounter.deck.unshift(...pieces);
  return pieces;
}

describe("Scarlet Witch's exact source pack and identity", () => {
  it("launches the original forty-card Justice deck and both physical obligations", () => {
    const source = STARTER_DECKS.find((d) => d.id === "starter-15001a")!;
    const codes = heroStarterCodes("scw");
    expect(codes).toHaveLength(40);
    expect([...codes].sort()).toEqual(catalogDeckCodes(source).sort());
    expect(codes.every((code) => code.startsWith("15"))).toBe(true);
    expect(deckErrors("scw", "justice", codes)).toEqual([]);
    const s = newGame({
      heroId: "scw",
      aspect: "justice",
      villainId: "rhino",
      seed: 15001,
      heroes: [{ heroId: "scw", aspect: "justice", deckCards: codes }],
    });
    expect(
      physical(s)
        .map((p) => p.code)
        .sort(),
    ).toEqual([...codes].sort());
    expect(new Set(physical(s).map((p) => p.id)).size).toBe(40);
    expect(s.player.hp).toBe(10);
    expect(heroCard(s).code).toBe("15001b");
    expect(handSize(s)).toBe(6);
    const obligations = s.encounter.deck.filter((p) => p.code === "15023");
    expect(obligations).toHaveLength(2);
    expect(new Set(obligations.map((p) => p.id)).size).toBe(2);
  });

  it("uses the printed native hero powers, traits and voluntary form change", () => {
    let s = base();
    expect(heroCard(s).code).toBe("15001a");
    expect(heroCard(s).traits).toContain("Mystic");
    expect(heroStats(s)).toMatchObject({
      attack: 1,
      thwart: 2,
      defense: 2,
      recover: 3,
    });
    expect(handSize(s)).toBe(5);
    s = command(s, { type: "FLIP" });
    expect(heroCard(s).code).toBe("15001b");
    expect(handSize(s)).toBe(6);
    expect(s.player.flipped).toBe(true);
  });

  it("Superpowered Siblings selects two actual cards, cancels before paying and persists its round limit", () => {
    let s = base();
    s.player.form = "alter";
    const h = hand(s, "15004", "15005", "15020"),
      top = s.player.deck.slice(0, 2);
    s = command(s, { type: "ABILITY", id: "identity", action: "siblings" });
    expect(s.prompt).toMatchObject({ kind: "select", min: 2, max: 2 });
    expect(
      dispatch(reload(s), { type: "SELECT", ids: [h[0].id] }).error,
    ).toBeTruthy();
    s = command(reload(s), { type: "CANCEL" });
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
    s = command(s, { type: "ABILITY", id: "identity", action: "siblings" });
    s = command(reload(s), {
      type: "SELECT",
      ids: h.slice(0, 2).map((p) => p.id),
    });
    expect(s.player.hand.map((p) => p.id)).toEqual([
      h[2].id,
      ...top.map((p) => p.id),
    ]);
    expect(s.player.discard.map((p) => p.id)).toEqual(
      h.slice(0, 2).map((p) => p.id),
    );
    expect(
      dispatch(reload(s), {
        type: "ABILITY",
        id: "identity",
        action: "siblings",
      }).error,
    ).toBeTruthy();
    conserved(s, h);
  });

  it("Siblings finds the real Pietro ally in another player's area", () => {
    let s = base("spider_man");
    s.player.form = "alter";
    put(s, "15002", "p2");
    const h = hand(s, "15004", "15005"),
      top = s.player.deck.slice(0, 3);
    s = command(s, { type: "ABILITY", id: "identity", action: "siblings" });
    s = command(reload(s), { type: "SELECT", ids: h.map((p) => p.id) });
    expect(s.player.hand.map((p) => p.id)).toEqual(top.map((p) => p.id));
  });

  it.each(["hero", "alter"] as const)(
    "Siblings counts a %s-face Quicksilver identity by the printed active title",
    (form) => {
      let s = base("qsv");
      s.player.form = "alter";
      seatView(s, "p2").player.form = form;
      const h = hand(s, "15004", "15005"),
        top = s.player.deck.slice(0, form === "alter" ? 3 : 2);
      s = command(s, { type: "ABILITY", id: "identity", action: "siblings" });
      s = command(reload(s), { type: "SELECT", ids: h.map((p) => p.id) });
      expect(s.player.hand.map((p) => p.id)).toEqual(top.map((p) => p.id));
    },
  );
});

describe("Scarlet Witch's saved boost-icon counts", () => {
  it("Chaos Control replaces a villain boost with the actual discarded card and is once per phase", () => {
    let s = base();
    const boosts = boostDeck(s, "01101", "01118", "01104");
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    s = choose(reload(s), "chaos:p1");
    s = skipAll(s);
    expect(s.player.hp).toBe(5);
    conserved(s, boosts.slice(0, 2), true);
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    expect(s.prompt?.options.some((o) => o.id === "chaos:p1")).not.toBe(true);
    s = skipAll(s);
    expect(s.player.hp).toBe(3);
    conserved(s, boosts, true);
  });

  it("declining Chaos Control does not spend its phase use", () => {
    let s = base();
    boostDeck(s, "01104", "01101", "01104");
    s = skipAll(
      choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take"),
    );
    expect(s.player.hp).toBe(8);
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    s = skipAll(choose(s, "chaos:p1"));
    expect(s.player.hp).toBe(6);
  });

  it("the actual turn and phase transitions refresh Chaos Control independently of its earlier player-phase use", () => {
    let s = base();
    boostDeck(s, "01101", "01104");
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    s = skipAll(choose(s, "chaos:p1"));
    expect(s.player.hp).toBe(8);
    s.encounter.deck = [
      makePiece(s, "01101"),
      makePiece(s, "01104"),
      ...Array.from({ length: 12 }, () => makePiece(s, "01101")),
    ];
    s = command(s, { type: "END_TURN", discard: [] });
    expect(s.phase).toBe("villain");
    s = choose(s, "take");
    s = choose(reload(s), "chaos:p1");
    s = skipAll(s);
    expect(s.player.hp).toBe(6);
    expect(s.phase).toBe("player");
    expect(s.round).toBe(2);
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    s = skipAll(choose(reload(s), "chaos:p1"));
    expect(s.player.hp).toBe(3);
  });

  it.each([1, -1] as const)(
    "Crest changes a specific count by %s and exhausts only the actual chosen copy",
    (delta) => {
      let s = base();
      const crest = put(s, "15009");
      boostDeck(s, "01101");
      s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
      s = choose(s, "continue");
      s = choose(reload(s), `crest:${crest.id}:${delta > 0 ? "+1" : "-1"}`);
      s = skipAll(s);
      expect(s.player.hp).toBe(7 - delta);
      expect(s.player.inPlay.find((p) => p.id === crest.id)?.exhausted).toBe(
        true,
      );
    },
  );

  it("Chaos Control's replacement is counted before Crest modifies that replacement", () => {
    let s = base();
    const crest = put(s, "15009"),
      boosts = boostDeck(s, "01104", "01118");
    s = choose(native(s, { type: "enemyAttack", id: s.villain.id }), "take");
    s = choose(reload(s), "chaos:p1");
    s = choose(reload(s), `crest:${crest.id}:-1`);
    s = skipAll(s);
    expect(s.player.hp).toBe(6);
    conserved(s, boosts, true);
  });

  it("Chaos Control can interrupt another player's native boost count without making that player pay its cost", () => {
    let s = base("spider_man");
    const boosts = boostDeck(s, "01101", "01104"),
      otherHand = hand(seatView(s, "p2"), "01088"),
      otherTop = seatView(s, "p2").player.deck[0];
    s = choose(
      native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p2" }),
      "take",
    );
    s = skipAll(choose(reload(s), "chaos:p1"));
    expect(seatView(s, "p1").player.hp).toBe(10);
    expect(seatView(s, "p2").player.hp).toBe(8);
    expect(seatView(s, "p2").player.hand.map((p) => p.id)).toEqual([
      ...otherHand.map((p) => p.id),
      otherTop.id,
    ]);
    expect(seatView(s, "p2").player.discard).toEqual([]);
    conserved(s, boosts, true);
  });

  it("Next Evolution modifies boost-icon counts on discarded cards without resolving boost abilities", () => {
    let s = base();
    side(s, "15024", 2);
    const witch = put(s, "15011"),
      top = boostDeck(s, "01121")[0];
    s = target(
      command(s, { type: "ABILITY", id: witch.id, action: "thwart" }),
      "main",
    );
    s = respond(s, /Wiccan/i, "15011");
    s = optional(s);
    s = skipAll(target(s, s.villain.id));
    expect(s.villain.hp).toBe(49);
    expect(s.minions).toEqual([]);
    conserved(s, [top], true);
  });
});

describe("Scarlet Witch's signature events through actual native play", () => {
  it("Hex Bolt discards its whole physical batch before choosing the order of non-attack effects", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    s.player.confused = true;
    s.player.confuseCards = 1;
    const batch = boostDeck(s, "01104", "01101", "01099"),
      h = hand(s, "15004", "15020"),
      draw = s.player.deck[0];
    s = paid(s, h[0], [h[1].id]);
    expect(
      s.encounter.discard.filter((p) => batch.some((b) => b.id === p.id)),
    ).toHaveLength(3);
    s = optional(s);
    s = optional(choose(reload(s), "2"));
    expect(s.player.hand.some((p) => p.id === draw.id)).toBe(true);
    s = target(optional(choose(reload(s), "1")), "main");
    expect(s.scheme.threat).toBe(1);
    s = skipAll(target(optional(s), s.villain.id));
    expect(s.villain.hp).toBe(48);
    expect(s.player.stunned).toBe(true);
    expect(s.player.confused).toBe(true);
    expect(s.player.exhausted).toBe(false);
    conserved(s, [...h, draw]);
    conserved(s, batch, true);
  });

  it("a saved Hex Bolt Chaos Control replaces only one already-discarded batch item's count", () => {
    let s = base();
    const batch = boostDeck(s, "01104", "01101", "01099", "01118"),
      h = hand(s, "15004", "15020");
    s = paid(s, h[0], [h[1].id]);
    expect(
      s.encounter.discard.filter((p) =>
        batch.slice(0, 3).some((b) => b.id === p.id),
      ),
    ).toHaveLength(3);
    expect(s.encounter.deck[0].id).toBe(batch[3].id);
    s = optional(choose(reload(s), "chaos:p1"));
    expect(
      s.encounter.discard.filter((p) => batch.some((b) => b.id === p.id)),
    ).toHaveLength(4);
    s = choose(choose(reload(s), "0"), `${s.villain.id}:stunned`);
    s = target(choose(reload(s), "1"), "main");
    s = skipAll(s);
    expect(s.villain.stunned).toBe(true);
    expect(s.villain.hp).toBe(50);
    expect(s.scheme.threat).toBe(1);
    expect(s.player.hand).toHaveLength(1);
    conserved(s, batch, true);
    conserved(s, h);
  });

  it("Hex Bolt can defeat Crisis with an earlier item before targeting the main scheme", () => {
    let s = base();
    const crisis = side(s, "01108", 2);
    boostDeck(s, "01101", "01101", "01099");
    const h = hand(s, "15004", "15020");
    s = target(
      optional(choose(optional(paid(s, h[0], [h[1].id])), "0")),
      crisis.id,
    );
    expect(s.sideSchemes).toEqual([]);
    s = target(optional(choose(reload(s), "1")), "main");
    s = skipAll(optional(s));
    expect(s.scheme.threat).toBe(1);
  });

  it("Hex Bolt stops its original discard batch when the encounter deck empties", () => {
    let s = base();
    const top = makePiece(s, "01099"),
      old = makePiece(s, "01101"),
      h = hand(s, "15004", "15020");
    s.encounter.deck = [top];
    s.encounter.discard = [old];
    s = optional(paid(s, h[0], [h[1].id]));
    expect(s.encounter.acceleration).toBe(1);
    expect(s.prompt).toBeNull();
    expect(s.player.hand).toHaveLength(1);
    conserved(s, [top, old], true);
  });

  it("Molecular Decay deals one combined attack packet after discarding the two actual boosts", () => {
    let s = base();
    const batch = boostDeck(s, "01101", "01099"),
      h = hand(s, "15005", "15020", "15019");
    s = skipAll(
      optional(
        target(
          paid(
            s,
            h[0],
            h.slice(1).map((p) => p.id),
          ),
          s.villain.id,
        ),
      ),
    );
    expect(s.villain.hp).toBe(42);
    conserved(s, batch, true);
    conserved(s, h);
  });

  it("Molecular Decay's single combined attack is entirely prevented by one Tough status", () => {
    let s = base();
    s.villain.tough = true;
    s.villain.toughCards = 1;
    boostDeck(s, "01101", "01099");
    const h = hand(s, "15005", "15020", "15019");
    s = skipAll(
      optional(
        target(
          paid(
            s,
            h[0],
            h.slice(1).map((p) => p.id),
          ),
          s.villain.id,
        ),
      ),
    );
    expect(s.villain.hp).toBe(50);
    expect(s.villain.tough).toBe(false);
  });

  it("Stunned replaces Molecular Decay before its actual encounter discard or attack target", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    const batch = boostDeck(s, "01101", "01099"),
      h = hand(s, "15005", "15020", "15019");
    s = skipAll(
      paid(
        s,
        h[0],
        h.slice(1).map((p) => p.id),
      ),
    );
    expect(s.villain.hp).toBe(50);
    expect(s.player.stunned).toBe(false);
    expect(s.encounter.deck.slice(0, 2).map((p) => p.id)).toEqual(
      batch.map((p) => p.id),
    );
  });

  it("Molecular Decay obeys Guard while Hex Bolt damage does not", () => {
    let s = base();
    const guard = minion(s, "01101"),
      h = hand(s, "15005", "15020", "15019");
    s = paid(
      s,
      h[0],
      h.slice(1).map((p) => p.id),
    );
    expect(s.prompt?.options.some((o) => o.id === s.villain.id)).not.toBe(true);
    s = skipAll(optional(target(s, guard.id)));
    expect(s.villain.hp).toBe(50);
    minion(s, "01101");
    boostDeck(s, "01104", "01099", "01099");
    const hex = hand(s, "15004", "15020");
    s = target(
      optional(choose(optional(paid(s, hex[0], [hex[1].id])), "0")),
      s.villain.id,
    );
    s = skipAll(optional(choose(s, "1")));
    expect(s.villain.hp).toBe(48);
  });

  it("Chaos Magic plays a selected physical ally without resource payment and then discards its printed cost", () => {
    let s = base();
    const h = hand(s, "15003", "15002"),
      boosts = boostDeck(s, "01104", "01104", "01104", "01104");
    s = paid(s, h[0], []);
    s = skipAll(choose(reload(s), h[1].id));
    expect(s.player.inPlay.some((p) => p.id === h[1].id)).toBe(true);
    expect(s.player.hand).toEqual([]);
    expect(
      s.encounter.discard.filter((p) => boosts.some((b) => b.id === p.id)),
    ).toHaveLength(4);
    conserved(s, h);
    conserved(s, boosts, true);
  });

  it("Chaos Magic obeys unique-card and form restrictions when offering its free physical play", () => {
    let s = base();
    put(s, "15002");
    const h = hand(s, "15003", "15002", "15031", "15008");
    s = paid(s, h[0], []);
    expect(
      s.prompt?.options.some((o) => o.id === h[1].id || o.id === h[2].id),
    ).toBe(false);
    s = skipAll(choose(reload(s), h[3].id));
    expect(s.player.inPlay.some((p) => p.id === h[3].id)).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual([h[1].id, h[2].id]);
  });

  it("Agatha chooses from the actual top three and preserves a saved player-selected bottom order", () => {
    let s = base();
    s.player.form = "alter";
    const agatha = put(s, "15007"),
      top = [
        makePiece(s, "15004"),
        makePiece(s, "15005"),
        makePiece(s, "15008"),
      ],
      tail = [...s.player.deck];
    s.player.deck.unshift(...top);
    s = command(s, { type: "ABILITY", id: agatha.id, action: "agatha" });
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      top.map((p) => p.id).sort(),
    );
    s = choose(reload(s), top[1].id);
    s = choose(reload(s), top[2].id);
    s = target(s, top[0].id);
    s = skipAll(s);
    expect(s.player.hand.map((p) => p.id)).toEqual([top[1].id]);
    expect(s.player.deck.map((p) => p.id)).toEqual([
      ...tail.map((p) => p.id),
      top[2].id,
      top[0].id,
    ]);
    expect(s.player.inPlay.find((p) => p.id === agatha.id)?.exhausted).toBe(
      true,
    );
    conserved(s, top);
  });

  it("Quicksilver ally readies once per phase and its native basic action remains a real exhausted ally action", () => {
    let s = base();
    const ally = put(s, "15002");
    s = skipAll(
      target(
        command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(s.villain.hp).toBe(48);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
      exhausted: true,
    });
    s = command(reload(s), { type: "ABILITY", id: ally.id, action: "ready" });
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(
      false,
    );
    s = skipAll(
      target(
        command(s, { type: "ABILITY", id: ally.id, action: "attack" }),
        s.villain.id,
      ),
    );
    expect(
      dispatch(reload(s), { type: "ABILITY", id: ally.id, action: "ready" })
        .error,
    ).toBeTruthy();
  });
});

describe("Scarlet Witch's actual damage and reveal windows", () => {
  it("Magic Shield discards its actual copy to prevent three damage to its controller", () => {
    let s = base();
    const shield = put(s, "15008");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 5,
      source: "Fixture",
    });
    s = skipAll(respond(reload(s), /Magic Shield/i, "15008"));
    expect(s.player.hp).toBe(8);
    expect(s.player.inPlay.some((p) => p.id === shield.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === shield.id)).toHaveLength(1);
  });

  it("Magic Shield protects another player's actual ally and charges the Shield's controller", () => {
    let s = base("spider_man");
    const shield = put(s, "15008"),
      ally = put(s, "01084", "p2");
    s = native(s, {
      type: "damage",
      target: ally.id,
      amount: 4,
      source: "Fixture",
    });
    s = skipAll(respond(reload(s), /Magic Shield/i, "15008"));
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ally.id)?.damage,
    ).toBe(1);
    expect(
      seatView(s, "p1").player.discard.filter((p) => p.id === shield.id),
    ).toHaveLength(1);
    expect(seatView(s, "p2").player.discard).toEqual([]);
  });

  it("Magic Shield's Hero Interrupt is unavailable while its controller is Wanda", () => {
    let s = base();
    s.player.form = "alter";
    const shield = put(s, "15008");
    s = skipAll(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 2,
        source: "Fixture",
      }),
    );
    expect(s.player.hp).toBe(8);
    expect(s.player.inPlay.some((p) => p.id === shield.id)).toBe(true);
  });

  it("Tough prevents the positive packet before an optional Magic Shield can be discarded", () => {
    let s = base();
    const shield = put(s, "15008");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = skipAll(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 2,
        source: "Fixture",
      }),
    );
    expect(s.player.hp).toBe(10);
    expect(s.player.tough).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === shield.id)).toBe(true);
  });

  it("Warp Reality cancels printed Surge and When Revealed, then discards the real printed boost count", () => {
    let s = base();
    const h = hand(s, "15006", "15020"),
      original = makePiece(s, "01191"),
      batch = boostDeck(s, "01101", "01099", "01101");
    s = respond(reveal(s, original), /Warp Reality/i, "15006");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.player.exhausted).toBe(false);
    expect(s.encounter.dealt).toEqual([]);
    expect(s.encounter.deck[0].id).toBe(batch[2].id);
    expect(
      s.encounter.discard.filter((p) => p.id === original.id),
    ).toHaveLength(1);
    expect(
      s.encounter.discard.filter((p) =>
        batch.slice(0, 2).some((b) => b.id === p.id),
      ),
    ).toHaveLength(2);
    conserved(s, h);
    conserved(s, [original, ...batch], true);
  });

  it("Warp Reality cancels Incite and a minion's entry effects before placing that actual minion", () => {
    let s = base();
    const h = hand(s, "15006", "15020"),
      original = makePiece(s, "14026");
    s = respond(reveal(s, original), /Warp Reality/i, "15006");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = skipAll(s);
    expect(s.scheme.threat).toBe(3);
    expect(s.player.hp).toBe(10);
    expect(s.minions).toEqual([]);
    expect(
      s.encounter.discard.filter((p) => p.id === original.id),
    ).toHaveLength(1);
  });

  it("Warp Reality is unavailable for a physical card revealed from the discard pile", () => {
    let s = base();
    const h = hand(s, "15006", "15020"),
      original = makePiece(s, "01191");
    s = reveal(s, original, false);
    expect(s.prompt?.options.some((o) => o.image === "15006")).not.toBe(true);
    s = ordinaryReveal(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
  });
});

describe("Scarlet Witch retail Justice and aspect printings", () => {
  it("the actual 15018 Order and Chaos printing cancels only text and preserves its Incite keyword", () => {
    let s = base();
    put(s, "15002");
    const h = hand(s, "15018", "15020", "15004"),
      original = makePiece(s, "14028");
    s = respond(reveal(s, original), /Order and Chaos/i, "15018");
    s = command(reload(s), { type: "PAY", ids: [h[1].id] });
    s = ordinaryReveal(s);
    expect(s.villain.hp).toBe(48);
    expect(s.scheme.threat).toBe(4);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.hand.map((p) => p.id)).toEqual([h[2].id]);
    conserved(s, h);
    conserved(s, [original], true);
  });

  it.each(["mental", "physical"] as const)(
    "Crisis Averted's %s payment controls its actual Crisis bypass",
    (resource) => {
      let s = base();
      s.scheme.threat = 6;
      side(s, "01108", 2);
      const h = hand(
        s,
        "15012",
        resource === "mental" ? "15021" : "15022",
        "15020",
      );
      if (resource === "physical") {
        expect(playable(s, h[0])).toBeTruthy();
        expect(
          dispatch(reload(s), { type: "PLAY", id: h[0].id }).error,
        ).toBeTruthy();
        expect(s.scheme.threat).toBe(6);
      } else {
        s = skipAll(
          target(
            paid(
              s,
              h[0],
              h.slice(1).map((p) => p.id),
            ),
            "main",
          ),
        );
        expect(s.scheme.threat).toBe(0);
      }
      conserved(s, h);
    },
  );

  it("Multitasking's actual mental payment offers a different scheme after the first saved choice", () => {
    let s = base();
    const a = side(s, "01107", 2),
      b = side(s, "12025", 3),
      h = hand(s, "15013", "15021");
    s = target(paid(s, h[0], [h[1].id]), a.id);
    expect(s.sideSchemes.some((p) => p.id === a.id)).toBe(false);
    expect(s.prompt?.options.some((o) => o.id === a.id)).toBe(false);
    s = skipAll(target(reload(s), b.id));
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(1);
    expect(s.scheme.threat).toBe(3);
  });

  it("an explicit saved wild-as-mental payment enables Multitasking's second physical scheme", () => {
    let s = base();
    const a = side(s, "01107", 3),
      b = side(s, "12025", 3),
      h = hand(s, "15013", "15002");
    s = target(paid(s, h[0], [h[1].id], "mental"), a.id);
    s = skipAll(target(reload(s), b.id));
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(1);
  });

  it("Multitasking without mental only resolves the one original scheme", () => {
    let s = base();
    const a = side(s, "01107", 3),
      b = side(s, "12025", 3),
      h = hand(s, "15013", "15022");
    s = skipAll(target(paid(s, h[0], [h[1].id]), a.id));
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(1);
    expect(s.sideSchemes.find((p) => p.id === b.id)?.counters).toBe(3);
  });

  it("Confused replaces Multitasking's complete thwart before either removal", () => {
    let s = base();
    s.player.confused = true;
    s.player.confuseCards = 1;
    const a = side(s, "01107", 3),
      h = hand(s, "15013", "15021");
    s = skipAll(paid(s, h[0], [h[1].id]));
    expect(s.player.confused).toBe(false);
    expect(s.scheme.threat).toBe(3);
    expect(s.sideSchemes.find((p) => p.id === a.id)?.counters).toBe(3);
  });

  it("Speed readies only after a real thwart and its physical ally limit persists through saved actions", () => {
    let s = base();
    s.scheme.threat = 6;
    const ally = put(s, "15010");
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
      "main",
    );
    s = skipAll(respond(reload(s), /Speed/i, "15010"));
    expect(s.scheme.threat).toBe(4);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      damage: 1,
      exhausted: false,
    });
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
      "main",
    );
    expect(s.prompt?.options.some((o) => o.image === "15010")).not.toBe(true);
    s = skipAll(s);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.exhausted).toBe(true);
  });

  it("Wiccan's response discards and counts the real card and deals non-attack damage", () => {
    let s = base();
    const ally = put(s, "15011"),
      guard = minion(s, "01101"),
      boost = boostDeck(s, "01099")[0];
    s.player.stunned = true;
    s.player.stunCards = 1;
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
      "main",
    );
    s = respond(reload(s), /Wiccan/i, "15011");
    s = skipAll(target(optional(s), s.villain.id));
    expect(s.scheme.threat).toBe(2);
    expect(s.villain.hp).toBe(48);
    expect(s.player.stunned).toBe(true);
    expect(s.minions.some((p) => p.id === guard.id)).toBe(true);
    conserved(s, [boost], true);
  });

  it("Turn the Tide follows the actual hero's completed thwart, with physical event discard once", () => {
    let s = base();
    s.scheme.threat = 2;
    const h = hand(s, "15015");
    s = target(command(s, { type: "BASIC", action: "thwart" }), "main");
    s = respond(reload(s), /Turn the Tide/i, "15015");
    s = skipAll(target(s, s.villain.id));
    expect(s.scheme.threat).toBe(0);
    expect(s.villain.hp).toBe(47);
    expect(s.player.discard.filter((p) => p.id === h[0].id)).toHaveLength(1);
  });

  it("Multitasking finishes its second scheme before Turn the Tide can respond to the cleared Crisis scheme", () => {
    let s = base();
    const crisis = side(s, "01108", 2),
      other = side(s, "01107", 3),
      h = hand(s, "15013", "15021", "15015");
    s = target(paid(s, h[0], [h[1].id]), crisis.id);
    expect(s.sideSchemes.some((p) => p.id === crisis.id)).toBe(false);
    expect(s.scheme.threat).toBe(3);
    expect(s.prompt?.title).toContain("different scheme");
    expect(s.prompt?.options.some((o) => o.id === h[2].id)).toBe(false);
    s = target(reload(s), "main");
    expect(s.scheme.threat).toBe(1);
    s = respond(reload(s), /Turn the Tide/i, "15015");
    s = skipAll(target(s, s.villain.id));
    expect(s.villain.hp).toBe(47);
    expect(s.sideSchemes.find((p) => p.id === other.id)?.counters).toBe(3);
    conserved(s, h);
    conserved(s, [crisis, other], true);
  });

  it("Turn the Tide is unavailable after an ally's successful complete thwart", () => {
    let s = base();
    s.scheme.threat = 1;
    const h = hand(s, "15015"),
      ally = put(s, "15011");
    s = target(
      command(s, { type: "ABILITY", id: ally.id, action: "thwart" }),
      "main",
    );
    expect(s.prompt?.options.some((o) => o.image === "15015")).not.toBe(true);
    s = skipAll(s);
    expect(s.villain.hp).toBe(50);
    expect(s.player.hand.map((p) => p.id)).toEqual(h.map((p) => p.id));
  });

  it("Spiritual Meditation draws two first and lets the player discard either original or newly drawn physical card", () => {
    let s = base();
    s.player.form = "alter";
    const h = hand(s, "15019", "15004"),
      top = s.player.deck.slice(0, 2);
    s = paid(s, h[0], []);
    expect(s.prompt?.options.map((o) => o.id).sort()).toEqual(
      [h[1].id, ...top.map((p) => p.id)].sort(),
    );
    s = skipAll(choose(reload(s), top[1].id));
    expect(s.player.hand.map((p) => p.id)).toEqual([h[1].id, top[0].id]);
    expect(
      s.player.discard.filter((p) => p.id === h[0].id || p.id === top[1].id),
    ).toHaveLength(2);
    conserved(s, [...h, ...top]);
  });

  it("Swift Retribution completes the villain's scheme before its damage", () => {
    let s = base();
    s.scheme.threat = 0;
    const h = hand(s, "15014", "15020");
    boostDeck(s, "01104");
    s = skipAll(optional(paid(s, h[0], [h[1].id])));
    expect(s.scheme.threat).toBe(1);
    expect(s.villain.hp).toBe(46);
  });

  it("Bait and Switch completes an actual villain attack before its main-scheme removal", () => {
    let s = base();
    s.scheme.threat = 6;
    const h = hand(s, "15030", "15020");
    boostDeck(s, "01104");
    s = paid(s, h[0], [h[1].id]);
    expect(s.scheme.threat).toBe(6);
    s = skipAll(optional(choose(s, "take")));
    expect(s.player.hp).toBe(8);
    expect(s.scheme.threat).toBe(2);
  });

  it("Bait and Switch still initiates its actual attack while Crisis protects the main scheme", () => {
    let s = base();
    s.scheme.threat = 6;
    side(s, "01108", 2);
    const h = hand(s, "15030", "15020");
    boostDeck(s, "01104");
    s = paid(s, h[0], [h[1].id]);
    s = skipAll(optional(choose(s, "take")));
    expect(s.player.hp).toBe(8);
    expect(s.scheme.threat).toBe(6);
    conserved(s, h);
  });

  it("Confused replaces Bait and Switch before the villain can attack", () => {
    let s = base();
    s.player.confused = true;
    s.player.confuseCards = 1;
    const h = hand(s, "15030", "15020"),
      top = boostDeck(s, "01099")[0];
    s = skipAll(paid(s, h[0], [h[1].id]));
    expect(s.player.confused).toBe(false);
    expect(s.player.hp).toBe(10);
    expect(s.scheme.threat).toBe(3);
    expect(s.encounter.deck[0].id).toBe(top.id);
  });

  it("Stunned replaces Swift Retribution before the villain can scheme", () => {
    let s = base();
    s.player.stunned = true;
    s.player.stunCards = 1;
    const h = hand(s, "15014", "15020"),
      top = boostDeck(s, "01099")[0];
    s = skipAll(paid(s, h[0], [h[1].id]));
    expect(s.player.stunned).toBe(false);
    expect(s.villain.hp).toBe(50);
    expect(s.scheme.threat).toBe(3);
    expect(s.encounter.deck[0].id).toBe(top.id);
  });

  it("Last Stand adds three ATK to the actual ally attack, then discards that physical ally after the attack", () => {
    let s = base();
    const ally = put(s, "15002"),
      h = hand(s, "15029");
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    s = respond(s, /Last Stand/i, "15029");
    s = skipAll(target(optional(s), s.villain.id));
    expect(s.villain.hp).toBe(45);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.discard.filter((p) => p.id === ally.id)).toHaveLength(1);
    conserved(s, [...h, ally]);
  });

  it("a Stunned ally's replacement action cannot spend Last Stand or discard that physical ally", () => {
    let s = base();
    const ally = put(s, "15002"),
      h = hand(s, "15029");
    ally.stunned = true;
    ally.stunCards = 1;
    s = command(s, { type: "ABILITY", id: ally.id, action: "attack" });
    expect(s.prompt?.options.some((o) => o.id === h[0].id)).not.toBe(true);
    s = target(s, s.villain.id);
    expect(s.prompt?.options.some((o) => o.id === h[0].id)).not.toBe(true);
    s = skipAll(s);
    expect(s.villain.hp).toBe(50);
    expect(s.player.inPlay.find((p) => p.id === ally.id)).toMatchObject({
      exhausted: true,
      stunned: false,
      damage: 0,
    });
    expect(s.player.hand.map((p) => p.id)).toEqual([h[0].id]);
    conserved(s, [...h, ally]);
  });

  it("Browbeat uses the actual villain stage and Recuperation heals printed REC without exhausting", () => {
    let s = base();
    s.villain.stage = 2;
    s.villain.code = "01095";
    const h = hand(s, "15028", "15020");
    s = skipAll(paid(s, h[0], [h[1].id]));
    expect(s.villain.hp).toBe(46);
    s.player.form = "alter";
    s.player.hp = 5;
    const recovery = hand(s, "15031", "15021");
    s = skipAll(paid(s, recovery[0], [recovery[1].id]));
    expect(s.player.hp).toBe(8);
    expect(s.player.exhausted).toBe(false);
  });
});

describe("Scarlet Witch's physical obligations and nemesis set", () => {
  it("Slipping Sanity may flip and removes only its actual exhausted obligation copy", () => {
    let s = base();
    const obligation = makePiece(s, "15023"),
      other = makePiece(s, "15023");
    s.encounter.deck.unshift(other);
    s = reveal(s, obligation);
    s = choose(choose(s, "flip"), "remove");
    s = skipAll(s);
    expect(s.player).toMatchObject({
      form: "alter",
      exhausted: true,
      flipped: false,
    });
    expect(s.removed.filter((p) => p.id === obligation.id)).toHaveLength(1);
    expect(s.encounter.deck.some((p) => p.id === other.id)).toBe(true);
    conserved(s, [obligation, other], true);
  });

  it("Slipping Sanity's discard branch counts printed boost stars rather than numeric boost icons", () => {
    let s = base();
    s.scheme.threat = 0;
    const obligation = makePiece(s, "15023"),
      batch = boostDeck(s, "01121", "01099", "01123", "01118", "01104");
    s = choose(reveal(s, obligation), "stay");
    const branch = s.prompt?.options.find((o) =>
      /discard.*5|discard.*top/i.test(o.label),
    );
    expect(branch, JSON.stringify(s.prompt)).toBeTruthy();
    s = skipAll(choose(reload(s), branch!.id));
    expect(s.scheme.threat).toBe(2);
    expect(s.player.exhausted).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === obligation.id),
    ).toHaveLength(1);
    conserved(s, [obligation, ...batch], true);
  });

  it("Magical Suspension adds a real additional resource to card payment and can be discarded by hero exhaustion", () => {
    let s = base();
    const attachment = makePiece(s, "15026");
    s = skipAll(reveal(s, attachment));
    const h = hand(s, "15008", "15019", "15004");
    s = command(s, { type: "PLAY", id: h[0].id });
    expect(s.prompt).toMatchObject({ kind: "payment", cost: 2 });
    expect(
      dispatch(reload(s), { type: "PAY", ids: [h[1].id] }).error,
    ).toBeTruthy();
    s = command(reload(s), { type: "CANCEL" });
    s = command(s, { type: "ABILITY", id: attachment.id });
    s = skipAll(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.attachments.some((p) => p.id === attachment.id)).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === attachment.id),
    ).toHaveLength(1);
  });

  it("Luminous's completed activation counts its actual discarded card before dealing an encounter", () => {
    let s = base();
    const enemy = minion(s),
      top = boostDeck(s, "01099", "01101");
    s = choose(native(s, { type: "enemyAttack", id: enemy.id }), "take");
    s = skipAll(optional(s));
    expect(s.player.hp).toBe(8);
    expect(s.encounter.discard.some((p) => p.id === top[0].id)).toBe(true);
    expect(s.encounter.dealt.some((p) => p.id === top[1].id)).toBe(true);
    conserved(s, top, true);
  });

  it.each(["01104", "01099"])(
    "Chaos Manipulation finds the actual discarded Luminous and branches on %s's counted boosts",
    (code) => {
      let s = base();
      const luminous = makePiece(s, "15025"),
        top = makePiece(s, code),
        old = makePiece(s, "01104"),
        treachery = makePiece(s, "15027");
      s.encounter.deck = [top];
      s.encounter.discard = [luminous, old];
      s = reveal(s, treachery);
      for (let guard = 0; s.prompt && guard < 50; guard++) {
        const id = s.prompt.options.some((o) => o.id === "take")
          ? "take"
          : passId(s);
        expect(id, JSON.stringify(s.prompt)).toBeTruthy();
        s = choose(s, id!);
      }
      expect(s.prompt).toBeNull();
      expect(s.minions.filter((p) => p.id === luminous.id)).toHaveLength(1);
      expect(s.minions.find((p) => p.id === luminous.id)?.engagedWith).toBe(
        "p1",
      );
      expect(s.player.hp).toBe(code === "01099" ? 8 : 10);
      expect(s.encounter.acceleration).toBeGreaterThanOrEqual(1);
      expect(
        s.encounter.discard.filter((p) => p.id === treachery.id),
      ).toHaveLength(1);
      conserved(s, [luminous, top, old, treachery], true);
    },
  );
});
