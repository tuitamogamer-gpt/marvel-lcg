import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json" with { type: "json" };
import { card, deckCodes, heroStats, pieceHP } from "../src/game/cards.js";
import {
  dispatch,
  enemyStats,
  makePiece,
  nativeHeroAbilityOptions,
  newGame,
  playable,
  targets,
} from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import { deckErrors } from "../src/game/decks.js";
import { paymentSources } from "../src/game/payment.js";
import { isTextBlank, isPrintedTraitsBlank } from "../src/game/card-text.js";
import { captainPackHasTrait } from "../src/game/captain-pack.js";
import { allInPlay, seatView, activateSeat } from "../src/game/team.js";
import {
  command,
  choose,
  finish,
  native,
  hand,
  put,
  minion,
  side,
  attach,
  target,
  reload,
  respond,
  passId,
} from "./dv-test-helpers.js";
import type { GameState, Piece, Resource } from "../src/game/types.js";

function base(alter = false, team = false) {
  let s = newGame({
    heroId: "jubilee",
    aspect: "justice",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 47001,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "jubilee", aspect: "justice" as const },
            { heroId: "spider_man", aspect: "justice" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.deck.push(...v.player.hand.splice(0));
    v.player.form = alter ? "alter" : "hero";
    v.player.flipped = false;
  }
  s.villain.hp = s.villain.maxHp = 100;
  s.scheme.threat = 5;
  s.encounter.deck = Array.from({ length: 12 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
function cast(
  s: GameState,
  code: string,
  codes: string[],
  wilds: Resource[] = [],
) {
  const pieces = hand(s, code, ...codes);
  s = command(s, { type: "PLAY", id: pieces[0].id });
  if (s.prompt?.kind === "payment")
    s = command(s, { type: "PAY", ids: pieces.slice(1).map((p) => p.id) });
  for (const r of wilds) {
    expect(s.prompt?.title).toBe("Declare Wild resource");
    s = choose(reload(s), r);
  }
  return s;
}
function reveal(s: GameState, code: string) {
  const zone = s.player.setAside || [];
  const index = zone.findIndex((p) => p.code === code);
  return native(s, {
    type: "reveal",
    piece: index >= 0 ? zone.splice(index, 1)[0] : makePiece(s, code),
  });
}
function sourceIds(s: GameState) {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [...p.deck, ...p.hand, ...p.discard, ...p.inPlay];
    }),
    ...s.resolving,
    ...s.sideSchemes,
    ...s.attachments,
    ...s.minions,
    ...s.removed,
    ...(s.victoryDisplay || []),
  ]
    .filter((p) => card(p).faction_code !== "encounter")
    .map((p) => p.id);
}
function settleAllocation(s: GameState, wanted: Resource[]) {
  if (s.prompt?.title !== "Allocate payment resources") return s;
  const key = (a: Resource[]) => [...a].sort().join(":");
  const option = s.prompt.options.find((o) =>
    o.effects.some(
      (e) =>
        e.type === "commitPaymentAllocation" &&
        key(e.paidForCard) === key(wanted),
    ),
  );
  expect(option, JSON.stringify(s.prompt)).toBeTruthy();
  return choose(reload(s), option!.id);
}

describe("Jubilee original retail source and native identity", () => {
  it("registers all41faces and preserves the exact original40 physical printing codes", () => {
    const pack = catalog.filter((c) => c.pack_code === "jubilee");
    expect(pack).toHaveLength(41);
    expect(pack.filter((c) => !hasExecutableScript(c.code))).toEqual([]);
    expect(heroStarterCodes("jubilee")).toHaveLength(40);
    expect(deckCodes("jubilee", "justice")).toEqual(
      heroStarterCodes("jubilee"),
    );
    expect(
      deckErrors("jubilee", "justice", heroStarterCodes("jubilee")),
    ).toEqual([]);
    const s = base(true);
    expect(sourceIds(s)).toHaveLength(40);
    expect(s.player.setAside?.map((p) => p.code)).toEqual([
      "47024",
      "47025",
      "47026",
      "47027",
      "47027",
    ]);
  });
  it("Mall Rat finds the same deck card, shuffles, does not exhaust, and preserves fixed2 threat across reload", () => {
    let s = base(true);
    const id = s.player.deck.find((p) => p.code === "47003")!.id;
    const before = sourceIds(s).sort();
    s = finish(
      command(s, { type: "ABILITY", id: "identity", action: "mall-rat" }),
    );
    expect(s.sideSchemes.find((p) => p.id === id)?.counters).toBe(2);
    expect(s.player.exhausted).toBe(false);
    expect(nativeHeroAbilityOptions(s).some((o) => o.id === "mall-rat")).toBe(
      false,
    );
    expect(sourceIds(reload(s)).sort()).toEqual(before);
  });
  it("Mall Rat searches only the deck, not hand or discard, and is not automaticSetup", () => {
    const s = base(true);
    expect(s.sideSchemes).toEqual([]);
    hand(s, "47003");
    expect(nativeHeroAbilityOptions(s).some((o) => o.id === "mall-rat")).toBe(
      false,
    );
  });
  it("Like totally pays one Wild by exhausting the actual ready hero only oncommit", () => {
    let s = base();
    const pieces = hand(s, "47007a", "47007b");
    expect(
      paymentSources(s).find((p) => p.id === "jubilee-like-totally")?.resources,
    ).toEqual(["wild"]);
    s = command(s, { type: "PLAY", id: pieces[0].id });
    expect(s.player.exhausted).toBe(false);
    s = command(s, {
      type: "PAY",
      ids: [pieces[1].id, "jubilee-like-totally"],
    });
    expect(s.player.exhausted).toBe(false);
    s = choose(reload(s), "wild");
    expect(s.player.exhausted).toBe(true);
    expect(paymentSources(s).some((p) => p.id === "jubilee-like-totally")).toBe(
      false,
    );
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(96);
    expect(s.villain.stunned).toBe(true);
  });
  it("the X-Gene reprint retains its physical code, Mutant restriction and shared one-per-player limit", () => {
    let s = base(true);
    s = finish(cast(s, "47020", ["47007a"]));
    const gene = s.player.inPlay.find((p) => p.code === "47020")!;
    const duplicate = hand(s, "38019")[0];
    expect(playable(s, duplicate)).toContain("Max 1");
    s.player.form = "hero";
    expect(
      paymentSources(s, undefined, "47014").some(
        (p) => p.id === `rogue-gene:${gene.id}`,
      ),
    ).toBe(false);
    expect(
      paymentSources(s, undefined, "47007a").some(
        (p) => p.id === `rogue-gene:${gene.id}`,
      ),
    ).toBe(true);
    const ps = hand(s, "47007a", "47007c");
    s = command(s, { type: "PLAY", id: ps[0].id });
    s = command(s, { type: "PAY", ids: [ps[1].id, `rogue-gene:${gene.id}`] });
    s = choose(reload(s), "energy");
    s = finish(s);
    expect(s.player.inPlay.find((p) => p.id === gene.id)).toMatchObject({
      code: "47020",
      exhausted: true,
    });
    expect(s.villain.stunned).toBe(true);
    const restricted = base();
    expect(playable(restricted, hand(restricted, "47020")[0])).toContain(
      "Mutant",
    );
  });
  it("Coat and Sunglasses modify printed hero powers only in hero form", () => {
    const s = base();
    put(s, "47004");
    put(s, "47005");
    expect(heroStats(s).attack).toBe(2);
    expect(heroStats(s).thwart).toBe(2);
    s.player.form = "alter";
    expect(heroStats(s).recover).toBe(3);
  });
});

describe("Jubilee per-resource payment and event effects", () => {
  it("doubled Wild icons declare independently and survive each payment reload", () => {
    let s = cast(base(), "47015", ["47017", "47007c"], ["energy", "mental"]);
    s = finish(s);
    expect(s.scheme.threat).toBe(0);
    expect(s.player.discard.find((p) => p.code === "47017")?.code).toBe(
      "47017",
    );
    const event = s.player.discard.find((p) => p.code === "47015")!;
    expect(
      JSON.parse(String(s.flags[`jubileePaid:${event.id}`])).sort(),
    ).toEqual(["energy", "mental", "physical"]);
  });
  it("canceling a Wild declaration spends nothing and a changed payment declares afresh", () => {
    let s = base();
    const ps = hand(s, "47007a", "47004", "47005", "47010a");
    const ids = sourceIds(s).sort();
    s = command(s, { type: "PLAY", id: ps[0].id });
    s = command(s, { type: "PAY", ids: [ps[1].id, "jubilee-like-totally"] });
    s = choose(s, "mental");
    expect(s.prompt?.title).toBe("Declare Wild resource");
    s = command(reload(s), { type: "CANCEL" });
    expect(s.prompt?.kind).toBe("payment");
    expect(s.player.exhausted).toBe(false);
    expect(sourceIds(s).sort()).toEqual(ids);
    s = command(s, { type: "PAY", ids: [ps[2].id, "jubilee-like-totally"] });
    expect(s.prompt?.text).toContain("1 of 2");
    s = choose(s, "physical");
    s = choose(s, "physical");
    s = finish(target(s, s.villain.id));
    expect(s.villain.stunned).toBe(false);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.hand.some((p) => p.id === ps[1].id)).toBe(true);
    expect(sourceIds(s).sort()).toEqual(ids);
  });
  it("two independent Wild icons can be different types and stun Firecracker's target", () => {
    let s = cast(base(), "47007a", ["47004", "47005"], ["energy", "mental"]);
    s = finish(target(reload(s), s.villain.id));
    expect(s.villain.hp).toBe(96);
    expect(s.villain.stunned).toBe(true);
  });
  it("a double-resource card retains both distinct printed pips for Flash of Light", () => {
    let s = cast(base(), "47008a", ["47010a"]);
    s = target(s, "main");
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(2);
    expect(s.villain.confused).toBe(true);
  });
  it("same-type payment does not stun and overpaid third types do not increase a2cost receipt", () => {
    let s = cast(base(), "47007a", ["01088", "01090"]);
    s = settleAllocation(s, ["energy", "energy"]);
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(96);
    expect(s.villain.stunned).toBe(false);
  });
  it("Blinding Flash chooses different enemies and cannot choose one twice", () => {
    let s = base();
    const a = minion(s, "01103"),
      b = minion(s, "01103");
    s = cast(s, "47006", ["47010a", "47007c"]);
    s = choose(s, a.id);
    expect(s.prompt?.options.some((o) => o.id === a.id)).toBe(false);
    s = choose(s, b.id);
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.minions.every((p) => p.stunned && p.confused)).toBe(true);
    expect(s.villain.stunned && s.villain.confused).toBe(true);
  });
  it("Grande Finale resolves its initial hit plus each paid-type hit sequentially", () => {
    let s = cast(base(), "47009", ["47010a", "47007c"]);
    for (let n = 0; n < 4; n++) s = target(reload(s), s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(92);
  });
  it("Firecracker must attack the Guard, and Finale can attack the villain after defeating it", () => {
    let s = base();
    const guard = minion(s, "01101");
    s = cast(s, "47007a", ["47010a"]);
    s = finish(s);
    expect(s.villain.hp).toBe(100);
    expect(s.minions.some((p) => p.id === guard.id)).toBe(false);
    s = base();
    const guard2 = minion(s, "01101");
    guard2.damage = 1;
    s = cast(s, "47009", ["47010a", "47007c"]);
    s = finish(s);
    expect(s.minions.some((p) => p.id === guard2.id)).toBe(false);
    expect(s.villain.hp).toBe(94);
  });
  it("Three Steps Ahead respects Patrol during every sequential target choice", () => {
    let s = base();
    minion(s, "16119");
    const a = side(s, "01107", 6),
      b = side(s, "01107", 6);
    s = cast(s, "47015", ["47010a", "47007c"]);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
    s = choose(s, a.id);
    expect(s.prompt?.options.some((o) => o.id === "main")).toBe(false);
    s = choose(s, b.id);
    s = choose(s, a.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(5);
  });
  it("status-only Blinding Flash and Flash of Light do not offer Stalwart enemies", () => {
    let s = base();
    const stalwart = minion(s, "27058");
    s = cast(s, "47008a", ["47010a"]);
    s = target(s, "main");
    expect(s.prompt?.options.some((o) => o.id === stalwart.id)).not.toBe(true);
    s = finish(s);
    expect(s.villain.confused).toBe(true);
    expect(s.minions.find((p) => p.id === stalwart.id)?.confused).toBe(false);
    s = base();
    const other = minion(s, "27058");
    s = cast(s, "47006", ["47010a", "47007c"]);
    expect(s.prompt?.options.some((o) => o.id === other.id)).not.toBe(true);
    s = finish(s);
    expect(s.villain.stunned && s.villain.confused).toBe(true);
    expect(s.minions.find((p) => p.id === other.id)?.stunned).toBe(false);
  });
  it("replaying the same event for free cannot reuse the prior payment receipt", () => {
    let s = cast(base(), "47007a", ["47010a"]);
    s = finish(s);
    const event = s.player.discard.find((p) => p.code === "47007a")!;
    s.player.discard.splice(s.player.discard.indexOf(event), 1);
    s.player.hand.push(event);
    s.villain.stunned = false;
    s = finish(
      native(reload(s), {
        type: "play",
        piece: event,
        paid: [],
        paidForCard: [],
      }),
    );
    expect(s.villain.hp).toBe(92);
    expect(s.villain.stunned).toBe(false);
    expect(JSON.parse(String(s.flags[`jubileePaid:${event.id}`]))).toEqual([]);
    expect(sourceIds(s).filter((id) => id === event.id)).toHaveLength(1);
  });
  it("Unlikely Duo's status-only target respects Guard and shares one Retaliate window with its damage", () => {
    let s = base();
    put(s, "47002");
    put(s, "41017");
    const guard = minion(s, "11042");
    s = cast(s, "47022", ["47010a"]);
    expect(s.prompt?.options.map((o) => o.id)).toEqual([guard.id]);
    s = choose(reload(s), guard.id);
    expect(s.player.hp).toBe(9);
    s = choose(reload(s), guard.id);
    s = finish(s);
    expect(s.minions.find((p) => p.id === guard.id)?.damage).toBe(4);
    expect(s.player.hp).toBe(8);
  });
  it("Unlikely Duo attacks both distinct targets, Retaliates after both clauses, and boosts an initially confused target", () => {
    let s = base();
    put(s, "47002");
    put(s, "41017");
    const a = minion(s, "01184"),
      b = minion(s, "01184");
    b.confused = true;
    s = cast(s, "47022", ["47010a"]);
    s = choose(s, a.id);
    expect(s.player.hp).toBe(9);
    s = choose(s, b.id);
    s = finish(s, (v) =>
      v.prompt?.title === "Forced responses"
        ? v.prompt.options[0].id
        : undefined,
    );
    expect(s.minions.find((p) => p.id === a.id)?.damage).toBe(0);
    expect(s.minions.find((p) => p.id === b.id)?.damage).toBe(5);
    expect(s.player.hp).toBe(5);
  });
  it("Three Steps Ahead clears Crisis before selecting the main scheme for its later instances", () => {
    let s = base();
    const crisis = side(s, "01151", 2);
    s = cast(s, "47015", ["47010a", "47007c"]);
    expect(s.sideSchemes.some((p) => p.id === crisis.id)).toBe(false);
    expect(s.sideSchemes.some((p) => p.id === crisis.id)).toBe(false);
    expect(s.scheme.threat).toBe(1);
    s = target(s, "main");
    s = target(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(1);
  });
  it("Multitalented uses only the actual physical, mental and energy paid icons", () => {
    let s = base();
    s.player.hp = 4;
    s = cast(s, "47021", ["47010a", "47007c"]);
    s = target(s, s.villain.id);
    s = target(s, "main");
    s = finish(s);
    expect(s.player.hp).toBe(6);
    expect(s.scheme.threat).toBe(3);
    expect(s.villain.hp).toBe(98);
  });
  it("Sunglasses responds after an Attack event using the exact saved cost receipt", () => {
    let s = base();
    const glasses = put(s, "47005");
    s = cast(s, "47007a", ["47010a"]);
    s = target(s, s.villain.id);
    s = respond(reload(s), /Sunglasses/);
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(94);
    expect(allInPlay(s).find((p) => p.id === glasses.id)?.exhausted).toBe(true);
  });
});

describe("Jubilee player pool and side schemes", () => {
  it("Shopping Spree blocks heroes/allies, permits its alter-ego cost, and goes to ownerdiscard after Item reward", () => {
    let s = base(true);
    const item = s.player.deck.find((p) => p.code === "47004")!;
    s = finish(
      command(s, { type: "ABILITY", id: "identity", action: "mall-rat" }),
    );
    const scheme = s.sideSchemes.find((p) => p.code === "47003")!;
    s.player.form = "hero";
    expect(
      targets(s, "scheme", false, true).some((t) => t.id === scheme.id),
    ).toBe(false);
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: 2,
      source: "hero",
    });
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(2);
    s.player.form = "alter";
    s = finish(
      command(s, { type: "ABILITY", id: scheme.id, action: "shopping-spree" }),
    );
    expect(s.player.exhausted).toBe(true);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(1);
    s.player.exhausted = false;
    s = command(s, {
      type: "ABILITY",
      id: scheme.id,
      action: "shopping-spree",
    });
    s = choose(s, item.id);
    s = finish(s);
    expect(s.player.inPlay.some((p) => p.id === item.id)).toBe(true);
    expect(s.player.discard.some((p) => p.id === scheme.id)).toBe(true);
    expect(s.victoryDisplay?.some((p) => p.id === scheme.id)).not.toBe(true);
  });
  it("Disguise can be controlled by a teammate and thwarts in alterego with the same two exhaust costs", () => {
    let s = base(true, true);
    s = cast(s, "47013", ["47007a"]);
    s = choose(s, "p2");
    s = finish(s);
    const p = seatView(s, "p2").player.inPlay.find((p) => p.code === "47013")!;
    expect(p.ownerId).toBe("p1");
    activateSeat(s, "p2");
    s = command(s, { type: "ABILITY", id: p.id, action: "disguise" });
    s = target(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(3);
    expect(seatView(s, "p2").player.exhausted).toBe(true);
    expect(
      seatView(s, "p2").player.inPlay.find((q) => q.id === p.id)?.exhausted,
    ).toBe(true);
  });
  it("Husk spends three different types, heals before consequential damage and readies after the use", () => {
    let s = base();
    const husk = put(s, "47012");
    husk.damage = 1;
    const ps = hand(s, "47010a", "47007c");
    s = command(s, { type: "ABILITY", id: husk.id, action: "attack" });
    s = target(s, s.villain.id);
    s = choose(s, "3");
    s = command(s, { type: "PAY", ids: ps.map((p) => p.id) });
    s = finish(s);
    const current = allInPlay(s).find((p) => p.id === husk.id)!;
    expect(s.villain.hp).toBe(97);
    expect(current.damage).toBe(1);
    expect(current.exhausted).toBe(false);
  });
  it("Husk receives only the benefit of the actual paid icon when a double resource overpays one", () => {
    let s = base();
    const husk = put(s, "47012");
    husk.damage = 1;
    const resource = hand(s, "47010a")[0];
    s = command(s, { type: "ABILITY", id: husk.id, action: "attack" });
    s = target(s, s.villain.id);
    s = choose(s, "1");
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = settleAllocation(s, ["energy"]);
    s = finish(s);
    expect(s.villain.hp).toBe(97);
    expect(s.player.inPlay.find((p) => p.id === husk.id)?.damage).toBe(2);
  });
  it("Chamber takes no consequential damage attacking a confused enemy even if it is defeated", () => {
    let s = base();
    const chamber = put(s, "47011"),
      m = minion(s, "01103");
    m.confused = true;
    m.damage = 2;
    s = command(s, { type: "ABILITY", id: chamber.id, action: "attack" });
    s = choose(s, m.id);
    s = finish(s);
    expect(allInPlay(s).find((p) => p.id === chamber.id)?.damage).toBe(0);
  });
  it("Synch adds one to a native basic attack and exhausts without consequential damage", () => {
    let s = base();
    const synch = put(s, "47018");
    s = command(s, { type: "BASIC", action: "attack" });
    s = choose(s, synch.id);
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(98);
    expect(allInPlay(s).find((p) => p.id === synch.id)?.damage).toBe(0);
    expect(allInPlay(s).find((p) => p.id === synch.id)?.exhausted).toBe(true);
  });
  it("Synch can boost REC in alterego using the ordinary recovery response path", () => {
    let s = base(true);
    const synch = put(s, "47018");
    s.player.hp = 1;
    s = command(s, { type: "BASIC", action: "recover" });
    s = choose(s, synch.id);
    s = finish(s);
    expect(s.player.hp).toBe(5);
  });
  it("Synch boosts the actual basic defense before damage and consumes its separate exhaust", () => {
    let s = base();
    const synch = put(s, "47018"),
      enemy = minion(s, "01182");
    s = native(s, { type: "enemyAttack", id: enemy.id });
    s = choose(s, "hero");
    s = choose(reload(s), synch.id);
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.player.exhausted).toBe(true);
    expect(s.player.inPlay.find((p) => p.id === synch.id)?.exhausted).toBe(
      true,
    );
  });
  it("Generation X grants its X-Men basic-thwart bonus and keeps the same scheme in Victory", () => {
    let s = base();
    const p = hand(s, "47016")[0];
    s = command(s, { type: "PLAY", id: p.id });
    s = finish(s);
    s = command(s, { type: "BASIC", action: "thwart" });
    s = choose(s, p.id);
    s = finish(s);
    expect(s.sideSchemes.find((q) => q.id === p.id)?.counters).toBe(1);
  });
});

describe("Jubilee obligation, physical control changes and Arcade", () => {
  it("Generation X's THW modifier does not increase an Assault basic thwart", () => {
    let s = base();
    const scheme = side(s, "47016", 10);
    put(s, "43020").attachedTo = scheme.id;
    put(s, "47004");
    s.scheme.threat = 0;
    s = finish(command(s, { type: "BASIC", action: "thwart" }));
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(9);
    s = base();
    const ally = put(s, "47011"),
      scheme2 = side(s, "47016", 10);
    put(s, "43020").attachedTo = scheme2.id;
    s.scheme.threat = 0;
    s = finish(command(s, { type: "ABILITY", id: ally.id, action: "thwart" }));
    expect(s.sideSchemes.find((p) => p.id === scheme2.id)?.counters).toBe(8);
  });
  it("Grounded changes form, charges exactly two same-type resources only during Jubilee's turn, and leaves after a Jubilee event", () => {
    let s = finish(reveal(base(), "47023"));
    expect(s.player.form).toBe("alter");
    const resources = hand(s, "01088");
    s = command(s, { type: "FLIP" });
    s = choose(s, "energy");
    expect(s.player.form).toBe("alter");
    s = command(reload(s), { type: "PAY", ids: resources.map((p) => p.id) });
    s = finish(s);
    expect(s.player.form).toBe("hero");
    expect(s.player.flipped).toBe(true);
    s = cast(s, "47007a", ["47010a"]);
    s = target(s, s.villain.id);
    s = respond(s, /Grounded/);
    s = finish(s);
    expect(s.removed.some((p) => p.code === "47023")).toBe(true);
  });
  it("Naughty Children counts printed types in hand, treating printed Wild as just Wild", () => {
    let s = base();
    hand(s, "47010a", "47004", "47007c");
    s = finish(reveal(s, "47025"));
    expect(s.sideSchemes.find((p) => p.code === "47025")?.counters).toBe(6);
  });
  it("Nanny's attack reveals the same reserved Lost Child and converts the attacked player's actual ally", () => {
    let s = base();
    const nanny = minion(s, "47024"),
      ally = put(s, "47012");
    const lost = s.player.setAside!.find((p) => p.code === "47027")!;
    s = native(s, { type: "enemyAttack", id: nanny.id });
    s = choose(s, "take");
    s = finish(s);
    expect(s.attachments.find((p) => p.id === lost.id)?.attachedTo).toBe(
      ally.id,
    );
    expect(s.minions.some((p) => p.id === ally.id)).toBe(true);
    expect(s.player.setAside?.some((p) => p.id === lost.id)).toBe(false);
  });
  it("Battle Suit chooses the fewest remaining HP and adds printed+1ATK/+3HP/Aerial", () => {
    let s = base();
    const a = minion(s, "01103"),
      b = minion(s, "01103");
    a.damage = 2;
    s = reveal(s, "47026");
    expect(s.prompt?.options.map((o) => o.id)).toEqual([a.id]);
    s = finish(choose(s, a.id));
    expect(
      pieceHP(
        s,
        s.minions.find((p) => p.id === a.id)!,
      ),
    ).toBe(6);
    expect(
      enemyStats(
        s,
        s.minions.find((p) => p.id === a.id)!,
      ).attack,
    ).toBe(card(a).attack! + 1);
  });
  it("Lost Child moves the actual highest-cost ally to a blank Regressed minion and restores it on attachment removal", () => {
    let s = base();
    const ally = put(s, "47012");
    put(s, "47018");
    s = reveal(s, "47027");
    s = finish(choose(s, ally.id));
    const minion = s.minions.find((p) => p.id === ally.id)!;
    expect(minion).toBeTruthy();
    expect(isTextBlank(s, minion)).toBe(true);
    expect(isPrintedTraitsBlank(s, minion)).toBe(true);
    expect(captainPackHasTrait(s, minion.id, "X-Men")).toBe(false);
    expect(enemyStats(s, minion).scheme).toBe(1);
    const lost = s.attachments.find((p) => p.code === "47027")!;
    s = finish(native(reload(s), { type: "discardPiece", id: lost.id }));
    expect(s.minions.some((p) => p.id === ally.id)).toBe(false);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    expect(captainPackHasTrait(s, ally.id, "X-Men")).toBe(true);
  });
  it("Arcade is an available original five-card module and reveals a physical Trap from the encounter discard-until", () => {
    let initial = newGame({
      heroId: "jubilee",
      aspect: "justice",
      villainId: "rhino",
      module: "arcade",
      seed: 1,
    });
    expect(
      initial.encounter.deck.filter((p) => card(p).set_code === "arcade"),
    ).toHaveLength(5);
    let s = base();
    const trap = makePiece(s, "47031");
    s.encounter.deck.unshift(makePiece(s, "01104"), trap);
    s = finish(reveal(s, "47030"));
    expect(s.sideSchemes.find((p) => p.id === trap.id)?.counters).toBe(3);
    const arcade = s.minions.find((p) => p.code === "47030")!;
    s = finish(
      native(s, {
        type: "damage",
        target: arcade.id,
        amount: 8,
        source: "hero",
      }),
    );
    expect(s.minions.find((p) => p.id === arcade.id)?.damage).toBe(0);
  });
  it("Trap defeat effects affect the actual defeating player and Elaborate Trap leaves schemes in play", () => {
    let s = base();
    side(s, "47031", 2);
    side(s, "47033", 2);
    const before = s.player.hp;
    s = finish(
      reveal(s, "47034"),
      (v) =>
        v.prompt?.options.find((o) => /Murderworld|Mirrors/.test(o.label))?.id,
    );
    expect(s.player.hp).toBe(before - 2);
    expect(s.player.confused).toBe(true);
    expect(s.sideSchemes).toHaveLength(2);
  });
  it("Shadows of the Past uses all five actual set-aside nemesis IDs without synthesizing duplicates", () => {
    let s = base();
    const originals = s.player.setAside!.map((p) => p.id);
    s = finish(reveal(s, "01190"));
    expect(s.player.setAside).toEqual([]);
    const zones = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.attachments,
      ...s.encounter.deck,
      ...s.encounter.discard,
      ...s.resolving,
    ];
    for (const id of originals)
      expect(zones.filter((p) => p.id === id)).toHaveLength(1);
    expect(s.minions.find((p) => p.code === "47024")?.tough).toBe(true);
  });
  it("Arcade discard-until stops at the original deck's exhaustion and keeps every physical card exactly once", () => {
    let s = base();
    const first = makePiece(s, "01104"),
      last = makePiece(s, "01104"),
      discardedTrap = makePiece(s, "47031");
    s.encounter.deck = [first, last];
    s.encounter.discard = [discardedTrap];
    s = finish(reveal(s, "47030"));
    expect(s.sideSchemes).toEqual([]);
    expect(s.encounter.acceleration).toBe(1);
    const ids = [...s.encounter.deck, ...s.encounter.discard].map((p) => p.id);
    expect(ids.filter((id) => id === discardedTrap.id)).toHaveLength(1);
    expect(ids.filter((id) => id === first.id)).toHaveLength(1);
  });
  it("a Trap discarded as the last encounter card is removed from the freshly reshuffled deck before revealing", () => {
    let s = base();
    const trap = makePiece(s, "47031");
    s.encounter.deck = [trap];
    s.encounter.discard = [];
    s = finish(reveal(s, "47030"));
    expect(s.sideSchemes.filter((p) => p.id === trap.id)).toHaveLength(1);
    expect(s.encounter.deck.some((p) => p.id === trap.id)).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === trap.id)).toBe(false);
  });
});

describe("Jubilee shared player-card timing and cooperative choices", () => {
  it("Waylay is offered after a real hero thwart and keeps the last-threat receipt through its payment", () => {
    let s = base();
    s.scheme.threat = 1;
    const ps = hand(s, "47014", "47010a", "47007c");
    s = command(s, { type: "BASIC", action: "thwart" });
    s = respond(reload(s), /Waylay/);
    s = command(s, { type: "PAY", ids: ps.slice(1).map((p) => p.id) });
    s = finish(target(s, s.villain.id));
    expect(s.villain.hp).toBe(93);
    expect(s.scheme.threat).toBe(0);
  });
  it("Multitalented's printed attack/thwart labels still allow Waylay when only its heal resolves", () => {
    let s = base();
    s.player.hp = 2;
    const ps = hand(s, "47021", "47014", "01088", "01088", "47010a", "47007c");
    s = command(s, { type: "PLAY", id: ps[0].id });
    s = command(s, { type: "PAY", ids: [ps[2].id, ps[3].id] });
    s = settleAllocation(s, ["energy", "energy", "energy"]);
    s = respond(s, /Waylay/);
    s = command(s, { type: "PAY", ids: [ps[4].id, ps[5].id] });
    s = finish(target(s, s.villain.id));
    expect(s.player.hp).toBe(4);
    expect(s.scheme.threat).toBe(5);
    expect(s.villain.hp).toBe(96);
  });
  it("Cell Phone gives a teammate's actual ally one basic power with+1 and spends one charge", () => {
    let s = base(false, true);
    const phone = put(s, "47019");
    phone.counters = 3;
    const ally = put(s, "01084", "p2");
    s = command(s, { type: "ABILITY", id: phone.id, action: "cell-phone" });
    s = choose(s, "p2");
    s = choose(s, `${ally.id}:attack`);
    s = finish(s);
    expect(s.villain.hp).toBe(97);
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === ally.id)?.exhausted,
    ).toBe(true);
    expect(
      seatView(s, "p1").player.inPlay.find((p) => p.id === phone.id)?.counters,
    ).toBe(2);
  });
  it("Cell Phone does not advertise an identity that cannot use either basic power", () => {
    const s = base();
    const phone = put(s, "47019");
    phone.counters = 3;
    attach(s, "32156", `hero:${s.activePlayerId}`);
    s.player.exhausted = true;
    expect(nativeHeroAbilityOptions(s, phone.id)).toEqual([]);
    expect(phone.counters).toBe(3);
  });
  it("Cell Phone gives exactly one appropriate +1 to an Assault basic thwart", () => {
    let s = base();
    const scheme = side(s, "47016", 10);
    put(s, "43020").attachedTo = scheme.id;
    put(s, "47004");
    put(s, "47005");
    const phone = put(s, "47019");
    phone.counters = 3;
    s.scheme.threat = 0;
    s = command(s, { type: "ABILITY", id: phone.id, action: "cell-phone" });
    s = choose(s, "p1");
    s = choose(s, "hero:thwart");
    s = finish(s);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(7);
  });
  it("Mutant Mayhem returns its two original allies as costs then replays those same IDs, ready with reset damage", () => {
    let s = base();
    const force = put(s, "40015"),
      men = put(s, "47002");
    force.damage = 1;
    men.damage = 2;
    men.exhausted = true;
    const resources = hand(s, "47028", "47010a", "47007c");
    s = command(s, { type: "PLAY", id: resources[0].id });
    s = choose(s, `${force.id}:${men.id}`);
    expect(s.player.inPlay.some((p) => p.id === force.id)).toBe(true);
    s = command(s, { type: "PAY", ids: resources.slice(1).map((p) => p.id) });
    s = finish(s);
    for (const p of [force, men]) {
      const current = s.player.inPlay.find((q) => q.id === p.id)!;
      expect(current).toBeTruthy();
      expect(current.damage).toBe(0);
      expect(current.exhausted).toBe(false);
      expect(sourceIds(s).filter((id) => id === p.id)).toHaveLength(1);
    }
  });
  it("Serve and Protect prevents the full main threat and exhausts two distinct controlled characters as costs", () => {
    let s = base();
    const force = put(s, "40015"),
      men = put(s, "47002");
    const ps = hand(s, "47029", "47010a");
    s = native(s, { type: "threat", target: "main", amount: 9 });
    s = respond(s, /Serve and Protect/);
    s = choose(s, `${force.id}:${men.id}`);
    s = command(reload(s), { type: "PAY", ids: [ps[1].id] });
    s = finish(s);
    expect(s.scheme.threat).toBe(5);
    for (const p of [force, men]) {
      const current = s.player.inPlay.find((q) => q.id === p.id)!;
      expect(current.exhausted).toBe(true);
      expect(current.tough).toBe(true);
    }
  });
  it("Serve and Protect can be canceled at payment without losing the pending threat or exhausting characters", () => {
    let s = base();
    const force = put(s, "40015"),
      men = put(s, "47002");
    hand(s, "47029", "47010a");
    s = native(s, { type: "threat", target: "main", amount: 3 });
    s = respond(s, /Serve and Protect/);
    s = choose(s, `${force.id}:${men.id}`);
    s = command(s, { type: "CANCEL" });
    s = finish(s);
    expect(s.scheme.threat).toBe(8);
    expect(s.player.inPlay.find((q) => q.id === force.id)?.exhausted).toBe(
      false,
    );
  });
});

function mercPosition() {
  let s = newGame({
    heroId: "jubilee",
    aspect: "justice",
    villainId: "rhino",
    seed: 47040,
    pacing: "expert",
    heroes: [
      { heroId: "jubilee", aspect: "justice" },
      { heroId: "deadpool", aspect: "justice" },
    ],
  });
  while (s.phase === "mulligan") s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.deck.push(...v.player.hand.splice(0));
  }
  put(s, "44032", "p2");
  s.turnPlayerId = "p2";
  activateSeat(s, "p2");
  return s;
}
describe("player side scheme rewards use their controller under The Merc with the Mouth", () => {
  it("blocks another player's Shopping Spree reward while retaining the real defeat and owner discard", () => {
    let s = mercPosition();
    const p = side(s, "47003", 1);
    p.ownerId = "p1";
    p.playerSideSchemeController = "p1";
    const support = put(s, "01063", "p2");
    s = finish(
      native(s, {
        type: "thwart",
        target: p.id,
        amount: 1,
        source: support.id,
      }),
    );
    expect(s.sideSchemes.some((q) => q.id === p.id)).toBe(false);
    expect(seatView(s, "p1").player.discard.some((q) => q.id === p.id)).toBe(
      true,
    );
    expect(s.prompt).toBeNull();
  });
  it("blocks another player's Generation X reward while still moving that real scheme to Victory", () => {
    let s = mercPosition();
    const p = side(s, "47016", 1);
    p.ownerId = "p1";
    p.playerSideSchemeController = "p1";
    const handSizes = s.players.map(
      (seat) => seatView(s, seat).player.hand.length,
    );
    s = finish(
      native(s, { type: "thwart", target: p.id, amount: 1, source: "hero" }),
    );
    expect(s.victoryDisplay?.some((q) => q.id === p.id)).toBe(true);
    expect(
      s.players.map((seat) => seatView(s, seat).player.hand.length),
    ).toEqual(handSizes);
  });
  it("allows Deadpool-owned Generation X to instruct a teammate to search despite Merc", () => {
    let s = mercPosition();
    const p = side(s, "47016", 1);
    p.ownerId = "p2";
    p.playerSideSchemeController = "p2";
    const sought = seatView(s, "p1").player.deck.find(
      (q) => card(q).type_code === "event" && card(q).faction_code === "hero",
    )!;
    s = native(s, { type: "thwart", target: p.id, amount: 1, source: "hero" });
    expect(s.prompt?.options.some((o) => o.id === sought.id)).toBe(true);
    s = choose(reload(s), sought.id);
    s = finish(s);
    expect(seatView(s, "p1").player.hand.some((q) => q.id === sought.id)).toBe(
      true,
    );
    expect(s.victoryDisplay?.some((q) => q.id === p.id)).toBe(true);
  });
});
