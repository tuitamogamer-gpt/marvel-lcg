import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import sources from "../src/data/catalog-decks.json" with { type: "json" };
import {
  card,
  deckCodes,
  heroStats,
  aerial,
  pieceHP,
  MODULES,
} from "../src/game/cards.js";
import {
  abilityOptions,
  allyCount,
  dispatch,
  makePiece,
  newGame,
  playable,
  paymentSources,
  nativePutIntoPlay,
} from "../src/game/engine.js";
import {
  heroStarterCodes,
  heroSupplementaryCards,
} from "../src/game/hero-runtime.js";
import { deckErrors } from "../src/game/decks.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import {
  magnetoHeroCanAttack,
  magnetoHeroStats,
} from "../src/game/magneto-hero.js";
import { isTextBlank } from "../src/game/card-text.js";
import { activateSeat, allInPlay, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  hand,
  put,
  top,
  native,
  pay,
  target,
  reload,
  minion,
  side,
  attach,
  play,
  respond,
  physical,
  passId,
} from "./dv-test-helpers.js";

function launch(team = false) {
  let s = newGame({
    heroId: "magneto",
    aspect: "leadership",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 49001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "magneto", aspect: "leadership" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  return finish(s);
}
function base(team = false) {
  let s = launch(team);
  s.player.deck.push(...s.player.hand.splice(0));
  s.player.form = "hero";
  s.player.flipped = false;
  s.player.exhausted = false;
  s.villain.hp = s.villain.maxHp = 90;
  s.scheme.threat = 0;
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.encounter.deck = Array.from({ length: 30 }, () => makePiece(s, "01186"));
  s.encounter.discard = [];
  s.encounter.dealt = [];
  return s;
}
const cast = (s: GameState, code: string, ...resources: string[]) => {
  const [p, ...r] = hand(s, code, ...resources);
  return { p, s: play(s, p, r) };
};
const reveal = (s: GameState, code: string) =>
  native(s, { type: "reveal", piece: makePiece(s, code) });
const pull = (s: GameState) =>
  command(s, { type: "ABILITY", id: "identity", action: "pull" });
const onlyDeck = (s: GameState, ...codes: string[]) => {
  s.player.discard.push(...s.player.deck.splice(0));
  const cards = codes.map((c) => top(s, c)).reverse();
  s.player.deck = cards;
  return cards;
};

describe("Magneto hero source and Magnetic Pull", () => {
  it("enables all43original faces, exact40source and four separate Linked allies", () => {
    const pack = catalog.filter((c) => c.pack_code === "magneto");
    expect(pack).toHaveLength(43);
    expect(pack.filter((c) => !hasExecutableScript(c.code))).toEqual([]);
    expect(
      pack
        .filter((c) => c.code !== "49001b")
        .reduce((n, c) => n + c.quantity, 0),
    ).toBe(59);
    expect(deckCodes("magneto", "leadership")).toEqual(
      heroStarterCodes("magneto"),
    );
    expect(heroStarterCodes("magneto")).toHaveLength(40);
    expect(
      deckErrors("magneto", "leadership", heroStarterCodes("magneto")),
    ).toEqual([]);
    expect(heroSupplementaryCards("magneto")).toEqual({
      "49033": 1,
      "49034": 1,
      "49035": 1,
      "49036": 1,
    });
    const s = launch();
    expect(
      s.player.setAside?.filter((p) =>
        ["49033", "49034", "49035", "49036"].includes(p.code),
      ),
    ).toHaveLength(4);
    expect(heroStats(s)).toMatchObject({ recover: 3 });
    expect(MODULES.some((m) => m.id === "hellfire")).toBe(true);
  });
  it("discards until the actual Magnetic card, retains physical IDs and spends the round allowance", () => {
    let s = base();
    const ids = physical(s)
      .map((p) => p.id)
      .sort();
    const found = top(s, "49008"),
      first = top(s, "49024");
    const next = s.player.deck[2].id;
    s = pull(s);
    expect(s.player.hand.some((p) => p.id === found.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === first.id)).toBe(true);
    expect(s.player.deck[0].id).toBe(next);
    expect(reload(s)).toEqual(s);
    expect(
      dispatch(s, { type: "ABILITY", id: "identity", action: "pull" }).error,
    ).toBeTruthy();
    expect(
      physical(s)
        .map((p) => p.id)
        .sort(),
    ).toEqual(ids);
  });
  it("retains a matching last card through immediate recycling and deals an encounter", () => {
    let s = base();
    const [found] = onlyDeck(s, "49008");
    s = pull(s);
    expect(s.player.hand.some((p) => p.id === found.id)).toBe(true);
    expect(s.player.deck).toHaveLength(39);
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.player.deck.some((p) => p.id === found.id)).toBe(false);
  });
  it("does not offer Armor or Cape if the original deck exhausts without finding a Magnetic card", () => {
    let s = base();
    put(s, "49004");
    put(s, "49005");
    s.player.exhausted = true;
    onlyDeck(s, "49024", "49025");
    s = pull(s);
    expect(s.prompt).toBeNull();
    expect(s.player.exhausted).toBe(true);
    expect(magnetoHeroStats(s)).toMatchObject({
      attack: 0,
      thwart: 0,
      defense: 0,
    });
    expect(s.encounter.dealt).toHaveLength(1);
  });
  it("lets Armor and Cape respond in either order and counts each printed icon, not Wild as other types", () => {
    let s = base();
    const armor = put(s, "49004"),
      cape = put(s, "49005");
    s.player.exhausted = true;
    top(s, "49008");
    top(s, "49024");
    top(s, "49025");
    top(s, "49026");
    s = pull(s);
    expect(s.prompt?.title).toBe("Magnetic Pull responses");
    s = choose(s, cape.id);
    expect(s.player.exhausted).toBe(false);
    s = choose(reload(s), armor.id);
    expect(heroStats(s)).toMatchObject({ attack: 3, thwart: 3, defense: 3 });
    expect(s.prompt).toBeNull();
    s = base();
    put(s, "49004");
    top(s, "49011");
    s = pull(s);
    expect(s.prompt?.title).toBe("Magnetic Pull responses");
    s = choose(s, s.prompt!.options.find((o) => o.id !== "continue")!.id);
    expect(heroStats(s).thwart).toBe(3);
  });
});

describe("Magneto native upgrades, resources and player effects", () => {
  it("disables printed identity abilities when blanked and limits Pull across both phases", () => {
    let s = base();
    s.flags["deadpoolRay:hero:p1"] = true;
    expect(
      dispatch(s, { type: "ABILITY", id: "identity", action: "pull" }).error,
    ).toMatch(/blank/);
    delete s.flags["deadpoolRay:hero:p1"];
    top(s, "49008");
    s = finish(pull(s));
    s.phase = "villain";
    expect(
      dispatch(s, { type: "ABILITY", id: "identity", action: "pull" }).error,
    ).toBeTruthy();
  });
  it("resolves Old Grievances before optional Pull responses and can discard it by exhausting Erik", () => {
    let s = base();
    const armor = put(s, "49004");
    s = reveal(s, "49027");
    s = finish(s);
    const obligation = s.player.inPlay.find((p) => p.code === "49027")!;
    expect(obligation.dealtTo).toBe("p1");
    top(s, "49008");
    top(s, "49024");
    s = pull(s);
    expect(s.player.hp).toBe(8);
    s = choose(s, armor.id);
    s.player.form = "alter";
    s = finish(
      command(s, { type: "ABILITY", id: obligation.id, action: "remove" }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === obligation.id)).toBe(true);
  });
  it("Survivor shuffles the actual top three discard cards after changing form and supports reload", () => {
    let s = base();
    const cards = hand(s, "49024", "49025", "49026", "49016");
    s.player.discard.push(...s.player.hand.splice(0));
    const topThree = cards.slice(-3).map((p) => p.id);
    s = command(s, { type: "FLIP" });
    expect(s.prompt?.title).toBe("Survivor");
    s = finish(choose(reload(s), "yes"));
    expect(s.player.discard.map((p) => p.id)).toEqual([cards[0].id]);
    expect(topThree.every((id) => s.player.deck.some((p) => p.id === id))).toBe(
      true,
    );
  });
  it("Asteroid M shuffles only the topmost Magnetic discard and heals in alter ego", () => {
    let s = base();
    s.player.form = "alter";
    s.player.hp = 8;
    const asteroid = put(s, "49002"),
      [a, b, c] = hand(s, "49008", "49024", "49009");
    s.player.discard.push(...s.player.hand.splice(0));
    s = finish(
      command(s, { type: "ABILITY", id: asteroid.id, action: "asteroid" }),
    );
    expect(s.player.hp).toBe(9);
    expect(s.player.discard.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(s.player.deck.some((p) => p.id === c.id)).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === asteroid.id)?.exhausted).toBe(
      true,
    );
  });
  it("Helmet pays only for a Magnetic card and remains a physical exhausted resource ability", () => {
    let s = base();
    const helmet = put(s, "49003");
    const [p, r] = hand(s, "49006", "49024");
    expect(
      paymentSources(s, p.id, p.code).some((q) => q.id === helmet.id),
    ).toBe(true);
    expect(
      paymentSources(s, undefined, "49021").some((q) => q.id === helmet.id),
    ).toBe(false);
    s = command(s, { type: "PLAY", id: p.id });
    s = finish(pay(reload(s), [r], undefined, [helmet.id]));
    expect(s.player.inPlay.some((q) => q.id === p.id)).toBe(true);
    expect(s.player.inPlay.find((q) => q.id === helmet.id)?.exhausted).toBe(
      true,
    );
  });
  it("Helmet grants steady through identity blanking and normalizes status allowance when it leaves", () => {
    let s = base();
    const helmet = put(s, "49003");
    s.flags["deadpoolRay:hero:p1"] = true;
    s = native(
      s,
      { type: "status", target: "hero", status: "stunned" },
      { type: "status", target: "hero", status: "stunned" },
    );
    expect(s.player.stunCards).toBe(2);
    s = native(s, { type: "discardPiece", id: helmet.id });
    expect(s.player.stunCards).toBe(1);
  });
  it("Bubble replaces the entire would-take amount from nonattacks and does not overflow its threshold", () => {
    let s = base();
    const bubble = put(s, "49006");
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 9,
      source: s.villain.id,
    });
    expect(s.player.hp).toBe(10);
    expect(s.player.discard.find((p) => p.id === bubble.id)?.damage).toBe(0);
    expect(s.player.inPlay.some((p) => p.id === bubble.id)).toBe(false);
  });
  it("Tough prevents damage before Bubble, whose replacement also works in alter ego", () => {
    let s = base();
    const bubble = put(s, "49006");
    s = native(
      s,
      { type: "status", target: "hero", status: "tough" },
      { type: "damage", target: "hero", amount: 3, source: s.villain.id },
    );
    expect(s.player.inPlay.find((p) => p.id === bubble.id)?.damage).toBe(0);
    s.player.form = "alter";
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 2,
      source: s.villain.id,
    });
    expect(s.player.hp).toBe(10);
    expect(s.player.inPlay.find((p) => p.id === bubble.id)?.damage).toBe(2);
  });
  it("Cape grants Aerial while its text is active", () => {
    let s = base();
    put(s, "49005");
    expect(aerial(s)).toBe(true);
    s.player.form = "alter";
    expect(aerial(s)).toBe(false);
  });
  it("Wrapped in Metal attaches to a non-Elite minion, blanks Guard and prevents both activations", () => {
    let s = base();
    const m = minion(s, "49030");
    let result = cast(s, "49007", "49024");
    s = target(result.s, m.id);
    s = finish(s);
    const wrap = s.player.inPlay.find((p) => p.id === result.p.id)!;
    expect(wrap.attachedTo).toBe(m.id);
    expect(
      isTextBlank(
        s,
        s.minions.find((p) => p.id === m.id)!,
      ),
    ).toBe(true);
    const deck = s.encounter.deck.map((p) => p.id);
    s = native(
      s,
      { type: "enemyAttack", id: m.id },
      { type: "enemyScheme", id: m.id },
    );
    expect(s.player.hp).toBe(10);
    expect(s.scheme.threat).toBe(0);
    expect(s.encounter.deck.map((p) => p.id)).toEqual(deck);
  });
  it("rejects Wrapped in Metal when only an Elite minion is available", () => {
    const s = base();
    minion(s, "49028");
    const [p] = hand(s, "49007", "49024");
    expect(playable(s, p)).toMatch(/non-Elite/);
  });
  it("Electromagnetic Blast removes the last threat before offering an eligible Hero Response attachment", () => {
    let s = base();
    s.scheme.threat = 3;
    const a = attach(s, "32147", s.villain.id);
    const result = cast(s, "49008", "49024");
    s = result.s;
    s = respond(s, /Electromagnetic Blast/);
    s = choose(s, a.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(0);
    expect(s.attachments.some((p) => p.id === a.id)).toBe(false);
  });
  it("Metal Shards gains Tough after an actual minion defeat and keeps the event's own physical card", () => {
    let s = base();
    const m = minion(s, "01103");
    const result = cast(s, "49009", "49024", "49012");
    s = target(result.s, m.id);
    s = finish(s);
    expect(s.minions.some((p) => p.id === m.id)).toBe(false);
    expect(s.player.tough).toBe(true);
    expect(s.player.discard.some((p) => p.id === result.p.id)).toBe(true);
  });
  it("Magnetic Missile uses its current THEN erratum, so Counterspell cancels the discard too", () => {
    let s = base();
    const m = minion(s, "49030"),
      wrap = put(s, "49007");
    wrap.attachedTo = m.id;
    attach(s, "09030", "hero:p1");
    const before = s.player.deck.length;
    const result = cast(s, "49010", "49024");
    s = finish(result.s);
    expect(s.minions.some((p) => p.id === m.id)).toBe(true);
    expect(s.player.deck).toHaveLength(before - 2);
    expect(s.player.inPlay.some((p) => p.id === wrap.id)).toBe(true);
    expect(s.villain.hp).toBe(90);
    expect(s.villain.stunned).toBe(false);
  });
  it("Magnetic Missile is not an attack and deals five then stuns its actual enemy", () => {
    let s = base();
    const m = minion(s, "01103"),
      wrap = put(s, "49007");
    wrap.attachedTo = m.id;
    s.player.stunned = true;
    s.player.stunCards = 1;
    const result = cast(s, "49010", "49024");
    s = choose(result.s, m.id);
    s = finish(s);
    expect(s.villain.hp).toBe(85);
    expect(s.villain.stunned).toBe(true);
    expect(s.player.stunned).toBe(true);
  });
  it("M's enter response defeats only a minion with strictly fewer remaining HP", () => {
    let s = base();
    const a = minion(s, "01103"),
      b = minion(s, "49030");
    const result = cast(s, "49012", "49024", "49025");
    s = respond(result.s, /^M$/);
    expect(s.prompt?.options.map((o) => o.id)).toContain(a.id);
    expect(s.prompt?.options.map((o) => o.id)).not.toContain(b.id);
    s = finish(choose(reload(s), a.id));
    expect(s.minions.some((p) => p.id === a.id)).toBe(false);
  });
  it("Kid Omega pays Energy for one simultaneous damage to every enemy", () => {
    let s = base();
    const m = minion(s, "01103");
    const [p, r, cost] = hand(s, "49013", "49024", "49025");
    s = play(s, p, [cost]);
    s = respond(s, /Kid Omega/);
    s = choose(s, "energy");
    s = finish(pay(s, [r]));
    expect(s.villain.hp).toBe(89);
    expect(s.minions.find((p) => p.id === m.id)?.damage).toBe(1);
  });
  it("Phoenix readies and heals another player's X-Men ally", () => {
    let s = base(true);
    const p = put(s, "49015", "p2");
    p.exhausted = true;
    p.damage = 1;
    const result = cast(s, "49014", "49024", "49025");
    s = respond(result.s, /Phoenix/);
    s = finish(choose(reload(s), p.id));
    expect(
      seatView(s, "p2").player.inPlay.find((q) => q.id === p.id),
    ).toMatchObject({ exhausted: false, damage: 0 });
  });
  it("Cyclops increases damage taken from each attack only through the current phase", () => {
    let s = base();
    const result = cast(s, "49015", "49024", "49025");
    s = respond(result.s, /Cyclops/);
    s = choose(s, s.villain.id);
    s = finish(s);
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.villain.hp).toBe(87);
    s.phase = "villain";
    s = native(s, {
      type: "damage",
      target: s.villain.id,
      amount: 2,
      attack: true,
      source: "hero",
    });
    expect(s.villain.hp).toBe(85);
  });
  it("Won't Stay Down discards its actual support and returns an X-Men ally to hand", () => {
    let s = base();
    const support = put(s, "49016"),
      [ally] = hand(s, "49015");
    s.player.discard.push(s.player.hand.pop()!);
    s.player.form = "alter";
    s = command(s, { type: "ABILITY", id: support.id, action: "return" });
    s = finish(choose(reload(s), ally.id));
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === support.id)).toBe(true);
  });
  it("Squared Off resolves its real minion engagement cost before playing an ally at minus three", () => {
    let s = base();
    const min = makePiece(s, "01103");
    s.encounter.deck.unshift(min);
    const [event, ally] = hand(s, "49017", "49015");
    s = command(s, { type: "PLAY", id: event.id });
    s = choose(s, ally.id);
    s = finish(s);
    expect(s.minions.find((p) => p.id === min.id)?.engagedWith).toBe("p1");
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("Noble Sacrifice heals printed hit points and gives Tough after the real ally discard cost", () => {
    let s = base();
    s.player.hp = 3;
    const ally = put(s, "49012");
    ally.damage = 3;
    const result = cast(s, "49018", "49024");
    s = finish(choose(result.s, ally.id));
    expect(s.player.hp).toBe(7);
    expect(s.player.tough).toBe(true);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
  });
  it("You Got This uses printed matching power and leaves the hero ready after the basic attack", () => {
    let s = base();
    const ally = put(s, "49012");
    ally.bonusAtk = 6;
    const [event, r] = hand(s, "49019", "49024");
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, event.id);
    s = choose(s, ally.id);
    s = finish(pay(reload(s), [r]));
    expect(s.villain.hp).toBe(85);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
  });
  it("Counterspell cancels You Got This bonus and ready after its ally cost is paid", () => {
    let s = base();
    const ally = put(s, "49012");
    attach(s, "09030", "hero:p1");
    const [event, r] = hand(s, "49019", "49024");
    s.scheme.threat = 6;
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, event.id);
    s = choose(s, ally.id);
    s = finish(pay(s, [r]));
    expect(s.scheme.threat).toBe(4);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
  });
});

describe("Magneto Linked allies, Face the Past and encounter continuations", () => {
  it("naturally launches seed49001 and preserves actual Pull and Linked IDs across reload", () => {
    let s = launch();
    const before = s.player.hand.map((p) => p.id);
    s = command(s, { type: "FLIP" });
    expect(s.player.deck.slice(0, 2).map((p) => [p.id, p.code])).toEqual([
      ["c26", "49018"],
      ["c13", "49010"],
    ]);
    s = finish(pull(s));
    expect(s.player.hand.map((p) => p.id)).toEqual([...before, "c13"]);
    expect(s.player.discard.map((p) => p.id)).toEqual(["c26"]);
    expect(s.player.deck).toHaveLength(32);
    expect(
      s.player.setAside
        ?.filter((p) => /^4903[3-6]$/.test(p.code))
        .map((p) => p.id),
    ).toEqual(["c46", "c47", "c48", "c49"]);
    expect(reload(s)).toEqual(s);
  });
  it("rejects Linked allies in ordinary decks and creates four physical reserves for another eligible source", () => {
    const cards = deckCodes("cyclops", "leadership");
    cards[cards.length - 1] = "49020";
    const s = newGame({
      heroId: "cyclops",
      aspect: "leadership",
      villainId: "rhino",
      heroes: [{ heroId: "cyclops", aspect: "leadership", deckCards: cards }],
      seed: 49002,
    });
    expect(
      s.player.setAside?.filter((p) => /^4903[3-6]$/.test(p.code)),
    ).toHaveLength(4);
    const invalid = heroStarterCodes("magneto");
    invalid[invalid.length - 1] = "49033";
    expect(deckErrors("magneto", "leadership", invalid).join("\n")).toMatch(
      /Linked New allies/,
    );
  });
  it("maintains one full Linked pool per source deck and gives a selected card its new owner's discard destination", () => {
    let cards = deckCodes("cyclops", "leadership");
    cards[cards.length - 1] = "49020";
    let s = newGame({
      heroId: "magneto",
      aspect: "leadership",
      villainId: "rhino",
      heroes: [
        { heroId: "magneto", aspect: "leadership" },
        { heroId: "cyclops", aspect: "leadership", deckCards: cards },
      ],
      seed: 49003,
      pacing: "expert",
    });
    for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
    s = finish(s);
    s.player.form = "hero";
    expect(
      s.players
        .flatMap((seat) => seatView(s, seat).player.setAside || [])
        .filter((p) => /^4903[3-6]$/.test(p.code)),
    ).toHaveLength(8);
    const original = seatView(s, "p1").player.setAside!.find(
      (p) => p.code === "49033",
    )!;
    const own = seatView(s, "p1").player.setAside!.find(
      (p) => p.code === "49034",
    )!;
    const scheme = side(s, "49020", 1);
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: 1,
      action: true,
      source: "hero",
    });
    s = choose(s, own.id);
    s = choose(reload(s), original.id);
    s = finish(s);
    expect(
      seatView(s, "p2").player.hand.find((p) => p.id === original.id)?.ownerId,
    ).toBe("p2");
    activateSeat(s, "p2");
    const selected = s.player.hand.find((p) => p.id === original.id)!;
    s.player.hand.splice(s.player.hand.indexOf(selected), 1);
    nativePutIntoPlay(s, selected);
    s = finish(native(s, { type: "discardPiece", id: selected.id }));
    expect(
      seatView(s, "p2").player.discard.some((p) => p.id === selected.id),
    ).toBe(true);
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === selected.id),
    ).toBe(false);
    expect((s.victoryDisplay || []).some((p) => p.id === scheme.id)).toBe(true);
  });
  it("grants all four New allies their conditional bonuses without counting against the ally limit", () => {
    let s = base();
    const surge = put(s, "49033"),
      anole = put(s, "49034"),
      bling = put(s, "49035"),
      indra = put(s, "49036");
    expect(allyCount(s)).toBe(0);
    expect(pieceHP(s, indra)).toBe(4);
    s = finish(command(s, { type: "ABILITY", id: surge.id, action: "attack" }));
    expect(s.villain.hp).toBe(87);
    s.scheme.threat = 6;
    s = finish(command(s, { type: "ABILITY", id: anole.id, action: "thwart" }));
    expect(s.scheme.threat).toBe(3);
    s.player.inPlay = s.player.inPlay.filter((p) => p.id !== bling.id);
    nativePutIntoPlay(s, bling);
    s = finish(native(s, ...s.queue));
    expect(s.player.inPlay.find((p) => p.id === bling.id)?.tough).toBe(true);
  });
  it("Children of the Atom grants only its controller's qualifying characters all three X traits", () => {
    let s = base(true);
    const [support] = hand(s, "49037", "49024");
    s = play(s, support, [s.player.hand[1]]);
    s = finish(choose(s, "p2"));
    const w = put(s, "49015", "p2");
    activateSeat(s, "p2");
    s.turnPlayerId = "p2";
    const [p] = hand(s, "49016", "49024");
    expect(playable(s, p)).toMatch(/X-Men or X-Force/);
    s = finish(command(s, { type: "ABILITY", id: w.id, action: "attack" }));
    expect(s.player.inPlay.find((p) => p.id === support.id)?.ownerId).toBe(
      "p1",
    );
  });
  it("Face the Past reveals the actual nemesis cost, draws three, readies and removes its actual event", () => {
    let s = base();
    s.player.exhausted = true;
    const nemesis = s.player.setAside!.find((p) => p.code === "49028")!;
    const [event] = hand(s, "49022");
    const before = s.player.deck.length;
    s = command(s, { type: "PLAY", id: event.id });
    s = choose(s, nemesis.id);
    s = finish(s);
    expect(s.minions.some((p) => p.id === nemesis.id)).toBe(true);
    expect(s.player.hand).toHaveLength(3);
    expect(s.player.deck).toHaveLength(before - 3);
    expect(s.player.exhausted).toBe(false);
    expect(s.removed.some((p) => p.id === event.id)).toBe(true);
    expect(magnetoHeroCanAttack(s, s.villain.id)).toBe(false);
    const ally = put(s, "49012");
    expect(magnetoHeroCanAttack(s, s.villain.id, ally.id)).toBe(true);
    s.phase = "villain";
    expect(magnetoHeroCanAttack(s, s.villain.id)).toBe(true);
  });
  it("Counterspell cancels Face the Past effects after its real nemesis was revealed as a cost", () => {
    let s = base();
    s.player.exhausted = true;
    attach(s, "09030", "hero:p1");
    const nemesis = s.player.setAside!.find((p) => p.code === "49028")!;
    const [event] = hand(s, "49022");
    s = command(s, { type: "PLAY", id: event.id });
    s = finish(choose(s, nemesis.id));
    expect(s.minions.some((p) => p.id === nemesis.id)).toBe(true);
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.discard.some((p) => p.id === event.id)).toBe(true);
  });
  it("White Queen discards one actual status card from another player's identity", () => {
    let s = base(true);
    seatView(s, "p2").player.stunned = true;
    seatView(s, "p2").player.stunCards = 1;
    const result = cast(s, "49021", "49024", "49025");
    s = respond(result.s, /White Queen/);
    s = finish(choose(reload(s), "hero:p2:stunned"));
    expect(seatView(s, "p2").player.stunned).toBe(false);
  });
  it("original Deft Focus shares the native Superpower discount while retaining its printing code", () => {
    let s = base();
    const deft = put(s, "49023");
    s = command(s, { type: "ABILITY", id: deft.id, action: "deft-focus" });
    const [bubble, r] = hand(s, "49006", "49024");
    s = finish(play(s, bubble, [r]));
    expect(s.player.inPlay.find((p) => p.id === deft.id)).toMatchObject({
      code: "49023",
      exhausted: true,
    });
    expect(s.player.inPlay.some((p) => p.id === bubble.id)).toBe(true);
  });
  it("Exodus discards the attacked player's deck by total ATK including numeric boosts", () => {
    let s = base();
    const m = minion(s, "49028");
    s.encounter.deck.unshift(makePiece(s, "01103"));
    const before = s.player.deck.length;
    s = finish(native(s, { type: "enemyAttack", id: m.id }));
    expect(s.player.hp).toBe(6);
    expect(s.player.deck).toHaveLength(before - 4);
  });
  it("Fabian Cortez's When Defeated and star boost each discard four real cards", () => {
    let s = base();
    const m = minion(s, "49030");
    let before = s.player.deck.length;
    s = finish(
      native(s, { type: "damage", target: m.id, amount: 4, source: "hero" }),
    );
    expect(s.player.deck).toHaveLength(before - 4);
    before = s.player.deck.length;
    s = finish(
      native(s, { type: "boostEffect", piece: makePiece(s, "49030") }),
    );
    expect(s.player.deck).toHaveLength(before - 4);
  });
  it("Frenzy's completed Quickstrike discards two cards, and Stun replacement does not discard", () => {
    let s = base();
    const before = s.player.deck.length;
    s = finish(reveal(s, "49031"));
    expect(s.player.deck).toHaveLength(before - 2);
    const m = s.minions.find((p) => p.code === "49031")!;
    m.stunned = true;
    m.stunCards = 1;
    s = finish(native(s, { type: "enemyAttack", id: m.id }));
    expect(s.player.deck).toHaveLength(before - 2);
  });
  it("Martyr for Mutants makes the actual defeating player discard nine", () => {
    let s = base(true);
    const scheme = side(s, "49029", 1);
    activateSeat(s, "p2");
    const before = s.player.deck.length;
    s = finish(
      native(s, {
        type: "thwart",
        target: scheme.id,
        amount: 1,
        action: true,
        source: "hero",
      }),
    );
    expect(seatView(s, "p2").player.deck).toHaveLength(before - 9);
  });
  it("Angry Acolyte activates each minion against its engaged player in the correct form", () => {
    let s = base(true);
    const a = minion(s, "49030", "p1"),
      b = minion(s, "49031", "p2");
    seatView(s, "p2").player.form = "alter";
    s = finish(reveal(s, "49032"));
    expect(seatView(s, "p1").player.hp).toBe(8);
    expect(s.scheme.threat).toBe(2);
    expect(s.minions.some((p) => p.id === a.id)).toBe(true);
    expect(s.minions.some((p) => p.id === b.id)).toBe(true);
  });
  it("Angry Acolyte falls back after all actual activation attempts are prohibited", () => {
    let s = base();
    const m = minion(s, "49030"),
      w = put(s, "49007");
    w.attachedTo = m.id;
    const found = makePiece(s, "49028");
    s.encounter.deck.unshift(found);
    s = finish(reveal(s, "49032"));
    expect(s.minions.some((p) => p.id === found.id)).toBe(true);
    expect(s.player.hp).toBe(10);
  });
  it("Shadows of the Past uses the same five set-aside nemesis physical cards", () => {
    let s = base();
    const reserve = s.player.setAside!.filter((p) =>
        /^490(28|29|30|31|32)$/.test(p.code),
      ),
      ids = reserve.map((p) => p.id);
    s = finish(reveal(s, "01190"));
    expect(s.minions.some((p) => p.id === ids[0])).toBe(true);
    expect(s.sideSchemes.some((p) => p.id === ids[1])).toBe(true);
    expect(s.encounter.deck.filter((p) => ids.includes(p.id))).toHaveLength(3);
    expect(s.player.setAside?.some((p) => ids.includes(p.id))).toBe(false);
  });
});

describe("Hellfire native enemies and physical boost timing", () => {
  it("Sebastian Shaw takes one actual facedown boost after being attacked and cannot be attacked again that phase", () => {
    let s = base();
    const shaw = minion(s, "49038");
    shaw.tough = true;
    const next = s.encounter.deck[0].id;
    s = finish(
      native(s, {
        type: "damage",
        target: shaw.id,
        amount: 1,
        attack: true,
        source: "hero",
      }),
    );
    expect(
      s.minions
        .find((p) => p.id === shaw.id)
        ?.inheritorBoosts?.map((p) => p.id),
    ).toEqual([next]);
    expect(magnetoHeroCanAttack(s, shaw.id)).toBe(false);
    s.phase = "villain";
    expect(magnetoHeroCanAttack(s, shaw.id)).toBe(true);
  });
  it("Selene blocks ally attacks but allows identity attacks and loses this restriction when blanked", () => {
    let s = base();
    const selene = minion(s, "49039"),
      ally = put(s, "49012");
    expect(magnetoHeroCanAttack(s, selene.id, ally.id)).toBe(false);
    expect(magnetoHeroCanAttack(s, selene.id)).toBe(true);
    const wrap = put(s, "49007");
    wrap.attachedTo = selene.id;
    expect(magnetoHeroCanAttack(s, selene.id, ally.id)).toBe(true);
  });
  it("Selene's star boost discards the actual controlled ally", () => {
    let s = base();
    const ally = put(s, "49012");
    s = finish(
      choose(
        native(s, { type: "boostEffect", piece: makePiece(s, "49039") }),
        ally.id,
      ),
    );
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
  });
  it("Hellfire Pawn enters through its star boost with the same physical ID and does not trigger Surge", () => {
    let s = base();
    const p = makePiece(s, "49040");
    s.resolving.push(p);
    s = finish(native(s, { type: "boostEffect", piece: p }));
    expect(s.minions.find((q) => q.id === p.id)?.engagedWith).toBe("p1");
    expect(s.encounter.dealt).toHaveLength(0);
    expect(s.resolving.some((q) => q.id === p.id)).toBe(false);
  });
  it("Hellfire Pawn's revealed Surge deals an encounter while Guard and Patrol remain native", () => {
    let s = base();
    s = finish(reveal(s, "49040"));
    expect(s.encounter.dealt).toHaveLength(1);
    expect(s.minions.some((p) => p.code === "49040")).toBe(true);
    s.scheme.threat = 4;
    expect(dispatch(s, { type: "BASIC", action: "thwart" }).error).toBeTruthy();
  });
  it("The Inner Circle snapshots two additional threat for every Hellfire card in play", () => {
    let s = base();
    minion(s, "49038");
    minion(s, "49039");
    s = finish(reveal(s, "49041"));
    expect(s.sideSchemes.find((p) => p.code === "49041")?.counters).toBe(8);
  });
  it("Power and Decadence assigns its same treachery as the villain's facedown boost", () => {
    let s = base();
    const p = makePiece(s, "49042");
    s = finish(native(s, { type: "reveal", piece: p }));
    expect(s.villain.tough).toBe(true);
    expect(s.villain.inheritorBoosts?.map((p) => p.id)).toEqual([p.id]);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(false);
  });
  it("Power and Decadence's boost repeats the completed activation without a new ordinary boost", () => {
    let s = base();
    const power = makePiece(s, "49042");
    s.encounter.deck.unshift(power);
    const remaining = s.encounter.deck.length;
    s = finish(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.player.hp).toBe(6);
    expect(s.encounter.deck).toHaveLength(remaining - 1);
    expect(s.encounter.discard.some((p) => p.id === power.id)).toBe(true);
    expect(s.attack).toBeNull();
    expect(s.scheming).toBeUndefined();
    expect(reload(s)).toEqual(s);
  });
});

describe("Magneto crosspack timing boundaries", () => {
  it.each([
    "aggression",
    "justice",
    "leadership",
    "protection",
    "pool",
  ] as const)(
    "builds a legal40-card %s deck without Linked cards in the deck",
    (aspect) => {
      const codes = deckCodes("magneto", aspect);
      expect(codes).toHaveLength(40);
      expect(deckErrors("magneto", aspect, codes)).toEqual([]);
      expect(codes.some((c) => /^4903[3-6]$/.test(c))).toBe(false);
    },
  );
  it("failed Pull still pays Old Grievances for the actual cards discarded without resolving Armor or Cape", () => {
    let s = base();
    s = finish(reveal(s, "49027"));
    put(s, "49004");
    put(s, "49005");
    s.player.exhausted = true;
    onlyDeck(s, "49024", "49025");
    s = finish(pull(s));
    expect(s.player.hp).toBe(8);
    expect(s.player.exhausted).toBe(true);
    expect(heroStats(s)).toMatchObject({ attack: 2, thwart: 2, defense: 2 });
  });
  it("Armor, Cape, Pull and Survivor each resolve one Superpower Feedback occurrence", () => {
    let s = base();
    attach(s, "40069", "hero:p1");
    const armor = put(s, "49004"),
      cape = put(s, "49005");
    s.player.exhausted = true;
    top(s, "49008");
    top(s, "49024");
    s = pull(s);
    s = choose(s, armor.id);
    s = finish(choose(s, cape.id));
    expect(s.player.hp).toBe(7);
    s = command(s, { type: "FLIP" });
    s = finish(choose(s, "yes"));
    expect(s.player.hp).toBe(6);
  });
  it("Bubble's resolved forced interrupt can itself cause Feedback until the actual Bubble breaks", () => {
    let s = base();
    attach(s, "40069", "hero:p1");
    const bubble = put(s, "49006");
    s = finish(
      native(s, {
        type: "damage",
        target: "hero",
        amount: 2,
        source: s.villain.id,
      }),
    );
    expect(s.player.inPlay.some((p) => p.id === bubble.id)).toBe(false);
    expect(s.player.hp).toBe(9);
    expect(s.player.discard.filter((p) => p.id === bubble.id)).toHaveLength(1);
  });
  it("Helmet's resource ability resolves Feedback before the actual Magnetic card enters play", () => {
    let s = base();
    attach(s, "40069", "hero:p1");
    const helmet = put(s, "49003"),
      [bubble, r] = hand(s, "49006", "49011");
    s = command(s, { type: "PLAY", id: bubble.id });
    s = finish(pay(s, [r], undefined, [helmet.id]));
    expect(s.player.hp).toBe(9);
    expect(s.player.inPlay.find((p) => p.id === bubble.id)?.damage).toBe(0);
  });
  it("can stack separate Cyclops enter responses within a phase without tying them to a surviving ally", () => {
    let s = base();
    let result = cast(s, "49015", "49024", "49025");
    s = respond(result.s, /Cyclops/);
    s = finish(choose(s, s.villain.id));
    s = finish(native(s, { type: "discardPiece", id: result.p.id }));
    result = cast(s, "49015", "49024", "49025");
    s = respond(result.s, /Cyclops/);
    s = finish(choose(s, s.villain.id));
    s = finish(command(s, { type: "BASIC", action: "attack" }));
    expect(s.villain.hp).toBe(86);
  });
  it("Metal Shards gains Tough after a continuing villain stage is defeated", () => {
    let s = base();
    s.villain.hp = 5;
    const result = cast(s, "49009", "49024", "49025");
    s = finish(result.s);
    expect(s.villain.stage).toBe(2);
    expect(s.player.tough).toBe(true);
  });
});
