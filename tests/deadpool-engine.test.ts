import { describe, expect, it, vi } from "vitest";
import {
  newGame,
  makePiece,
  cardCost,
  schemeLimit,
  nativeHeroAbilityOptions,
  playable,
} from "../src/game/engine.js";
import {
  card,
  deckCodes,
  heroStats,
  handSize,
  maxHP,
} from "../src/game/cards.js";
import { resourcesFor } from "../src/game/payment.js";
import { activateSeat } from "../src/game/team.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { hasExecutableScript } from "../src/game/script-registry.js";
import {
  DEADPOOL_SCRIPT_CODES,
  deadpoolIcons,
  deadpoolIconCount,
  deadpoolRPS,
  deadpoolBoardWon,
} from "../src/game/deadpool.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  command,
  choose,
  finish,
  native,
  hand,
  put,
  minion,
  side,
  target,
  pay,
  play,
  respond,
  reload,
} from "./dv-test-helpers.js";
function starting(other = false) {
  return newGame({
    heroId: "deadpool",
    aspect: "pool",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 44001,
    pacing: "expert",
    ...(other
      ? {
          heroes: [
            { heroId: "deadpool", aspect: "pool" as const },
            { heroId: "spider_man", aspect: "pool" as const },
          ],
        }
      : {}),
  });
}
function base(form: "hero" | "alter" = "hero", other = false) {
  let s = starting(other);
  while (s.phase === "mulligan") s = command(s, { type: "MULLIGAN", ids: [] });
  s = finish(s);
  s.player.form = form;
  s.player.deck.push(...s.player.hand.splice(0));
  s.player.flipped = false;
  s.villain.hp = s.villain.maxHp = 100;
  s.scheme.threat = 3;
  s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01104"));
  s.encounter.discard = [];
  return s;
}
function cast(s: GameState, code: string, ...resources: string[]) {
  const cards = hand(s, code, ...resources);
  return play(s, cards[0], cards.slice(1));
}
function reveal(s: GameState, code: string) {
  return native(s, { type: "reveal", piece: makePiece(s, code) });
}
function ability(s: GameState, p: Piece, action: string) {
  return command(s, { type: "ABILITY", id: p.id, action });
}
describe("Deadpool full original pack", () => {
  it("registers all 59 original faces and the exact source 40-card Pool deck", () => {
    expect(DEADPOOL_SCRIPT_CODES).toHaveLength(59);
    for (const code of DEADPOOL_SCRIPT_CODES)
      expect(hasExecutableScript(code), code).toBe(true);
    expect(deckCodes("deadpool", "pool")).toEqual(heroStarterCodes("deadpool"));
    expect(heroStarterCodes("deadpool")).toHaveLength(40);
  });
  it("creates one shared seven-card Dreadpool dependency even for two Pool players", () => {
    const s = starting(true);
    expect(s.encounter.deck.filter((p) => p.code === "44037")).toHaveLength(1);
    expect(s.deadpool?.poolSetAside.map((p) => p.code).sort()).toEqual([
      "44038",
      "44039",
      "44040",
      "44041",
      "44041",
      "44042",
    ]);
    expect(s.player.setAside).toHaveLength(5);
  });
  it("borrowing a pink ally without choosing Pool does not add Dreadpool", () => {
    const s = newGame({
      heroId: "cyclops",
      aspect: "leadership",
      villainId: "rhino",
      module: "bomb_scare",
      pacing: "expert",
      seed: 1,
    });
    expect(s.deadpool).toBeUndefined();
    expect(s.encounter.deck.some((p) => p.code === "44037")).toBe(false);
  });
  it("Break the Fourth Wall discards one actual hand card, searches a physical event, and survives reload", () => {
    let s = base("alter");
    const cost = hand(s, "44002")[0];
    const sought = s.player.deck.find((p) => p.code === "44004")!;
    s = command(s, { type: "ABILITY", id: "identity", action: "fourth-wall" });
    s = choose(s, cost.id);
    s = choose(reload(s), sought.id);
    expect(s.player.hand.map((p) => p.id)).toContain(sought.id);
    expect(s.player.discard.map((p) => p.id)).toContain(cost.id);
    expect(
      nativeHeroAbilityOptions(s).some((o) => o.id === "fourth-wall"),
    ).toBe(false);
  });
  it("Maximum Effort can pay all remaining health, regenerate, and still complete its attack", () => {
    let s = base();
    s.player.hp = 4;
    s = cast(s, "44004");
    s = choose(s, "4");
    expect(s.player.hp).toBe(1);
    expect(s.player.form).toBe("alter");
    expect(s.encounter.acceleration).toBe(1);
    expect(s.player.flipped).toBe(false);
    s = target(s, s.villain.id);
    expect(s.villain.hp).toBe(96);
  });
  it("Tough makes a TAKE damage cost unavailable", () => {
    const s = base();
    s.player.tough = true;
    const p = hand(s, "44004")[0];
    expect(playable(s, p)).toMatch(/Tough/);
  });
  it("Yoo-Hoo takes its declared cost and removes the same threat", () => {
    let s = base();
    s.scheme.threat = 5;
    s = cast(s, "44006", "44025");
    s = choose(s, "3");
    s = target(s, "main");
    expect(s.scheme.threat).toBe(2);
    expect(s.player.hp).toBe(6);
  });
  it("Montage caps at four resources while Self resources check actual sustained damage", () => {
    const s = base();
    s.encounter.acceleration = 10;
    const p = makePiece(s, "44007");
    expect(resourcesFor(s, p)).toEqual(["wild", "wild", "wild", "wild"]);
    for (const code of ["44025", "44026", "44027"]) {
      const q = makePiece(s, code);
      expect(resourcesFor(s, q)).toHaveLength(3);
      s.player.hp = 8;
      expect(resourcesFor(s, q)).toHaveLength(2);
      s.player.hp = 4;
      expect(resourcesFor(s, q)).toHaveLength(1);
      s.player.hp = 9;
    }
  });
  it("acceleration tokens do not count as icons; player card icons do", () => {
    const s = base();
    s.encounter.acceleration = 8;
    ["44013", "44014", "44044"].forEach((c) => put(s, c));
    expect(deadpoolIcons(s)).toEqual({
      acceleration: 1,
      amplify: 1,
      hazard: 1,
      crisis: 0,
    });
    expect(deadpoolIconCount(s)).toBe(3);
  });
  it("counts mixed Pool, Suit, Venom, Guild, and Angel hazards once across both players", () => {
    let s = base("hero", true);
    put(s, "44044");
    activateSeat(s, "p2");
    ["27190", "27191", "37025", "42024"].forEach((code) => put(s, code));
    activateSeat(s, "p1");
    s.encounter.deck = Array.from({ length: 15 }, () => makePiece(s, "01101"));
    s = finish(native(s, { type: "dealEncounters" }));
    expect(s.minions.filter((p) => p.dealtTo === "p1")).toHaveLength(4);
    expect(s.minions.filter((p) => p.dealtTo === "p2")).toHaveLength(3);
    expect(s.encounter.deck).toHaveLength(8);
  });
  it("Live Dangerously adds two cards to each identity's hand size and leaves one physical side scheme", () => {
    let s = base();
    s = cast(s, "44024");
    s = finish(s);
    expect(s.sideSchemes.filter((p) => p.code === "44024")).toHaveLength(1);
    expect(handSize(s)).toBe(7);
    expect(deadpoolIconCount(s)).toBe(4);
  });
  it("Laser Swords caps its own ATK bonus at four", () => {
    const s = base();
    ["44055", "44013", "44014", "44015", "44016", "44044"].forEach((c) =>
      put(s, c),
    );
    expect(heroStats(s).attack).toBe(6);
  });
  it("It Ain't Over increases current main target by two per acceleration token", () => {
    let s = base();
    const original = schemeLimit(s);
    s = cast(s, "44011", "44025");
    s = finish(s);
    s.encounter.acceleration = 3;
    expect(schemeLimit(s)).toBe(original + 6);
  });
  it("This Card is Fire harms its controller when the turn ends", () => {
    let s = base();
    hand(s, "44012");
    s = command(s, { type: "END_TURN", discard: [] });
    expect(s.player.hp).toBeLessThanOrEqual(8);
  });
  it("Cutupper deals five then stuns the same enemy", () => {
    let s = base();
    s = cast(s, "44018", "44025");
    s = target(s, s.villain.id);
    expect(s.villain.hp).toBe(95);
    expect(s.villain.stunned).toBe(true);
  });
  it("Git Gud requires an honest history input and discounts a previous non-win", () => {
    let s = base();
    const p = hand(s, "44028")[0];
    expect(playable(s, p)).toMatch(/previous/);
    s = command(s, { type: "ABILITY", id: "identity", action: "game-history" });
    s = choose(s, "not-won");
    expect(cardCost(s, card(p), p)).toBe(0);
    s = play(s, p);
    s.player.form = "alter";
    s.player.hp = 1;
    s = native(s, { type: "damage", target: "hero", amount: 2 });
    expect(s.player.hp).toBe(1);
    expect(s.removed.some((q) => q.id === p.id)).toBe(true);
  });
  it("Tabula Rasa blanks Deadpool's replacement, so lethal damage defeats him", () => {
    let s = base();
    s = reveal(s, "44035");
    s = finish(s);
    s = native(s, { type: "damage", target: "hero", amount: 99 });
    expect(s.phase).toBe("lost");
  });
  it.each([0, 1, 2])(
    "Crisis preserves its seven physical cards with %i Media Coverage copies",
    (copies) => {
      let s = base();
      for (let i = 0; i < copies; i++)
        s.attachments.push({
          ...makePiece(s, "02049"),
          attachedTo: `hero:${s.activePlayerId}`,
        });
      const ids = s.deadpool!.poolSetAside.map((p) => p.id);
      const crisis = makePiece(s, "44037");
      s = native(s, { type: "reveal", piece: crisis });
      s = finish(s);
      expect(s.deadpool!.poolSetAside).toHaveLength(0);
      expect(s.removed.filter((p) => p.id === crisis.id)).toHaveLength(1);
      const current = [
        ...s.minions,
        ...s.sideSchemes,
        ...s.encounter.deck,
        ...s.encounter.discard,
        ...s.resolving,
        ...s.removed,
      ];
      for (const id of [...ids, crisis.id])
        expect(current.filter((p) => p.id === id)).toHaveLength(1);
    },
  );
  it("keeps both pending Crisis reveals in physical zones during interrupts", () => {
    let s = base();
    hand(s, "44005", "01088");
    const ids = s.deadpool!.poolSetAside.map((p) => p.id);
    const crisis = makePiece(s, "44037");
    s = native(s, { type: "reveal", piece: crisis });
    s = choose(s, "resolve");
    expect(s.prompt?.title).toBe("Dreadpool");
    const current = [
      ...s.minions,
      ...s.sideSchemes,
      ...s.encounter.deck,
      ...s.resolving,
      ...s.removed,
    ];
    for (const id of [...ids, crisis.id])
      expect(current.filter((p) => p.id === id)).toHaveLength(1);
  });
  it("Pool-ized moves the same highest-cost ally to its controller's enemy area and restores it when removed", () => {
    let s = base();
    const q = put(s, "44045");
    s = reveal(s, "44041");
    s = target(s, q.id);
    s = finish(s);
    expect(s.minions.find((p) => p.id === q.id)?.treatedAsMinion).toBe(true);
    const a = s.attachments.find((p) => p.code === "44041")!;
    s = native(s, { type: "discardPiece", id: a.id });
    expect(s.player.inPlay.some((p) => p.id === q.id)).toBe(true);
    expect(s.minions.some((p) => p.id === q.id)).toBe(false);
  });
  it("Dreadpool returns as the defeating player's actual facedown encounter card", () => {
    let s = base();
    const q = minion(s, "44038");
    s = native(s, { type: "damage", target: q.id, amount: 3, source: "hero" });
    s = finish(s);
    expect(s.encounter.dealt.filter((p) => p.id === q.id)).toHaveLength(1);
    expect(s.encounter.dealt.find((p) => p.id === q.id)?.dealtTo).toBe(
      s.activePlayerId,
    );
  });
  it("Involuntary Procedures counts damage occurrences and leaves at ten", () => {
    let s = base();
    const q = side(s, "44034", 9);
    s = native(s, { type: "damage", target: "hero", amount: 1 });
    expect(s.sideSchemes.some((p) => p.id === q.id)).toBe(false);
    expect(s.removed.some((p) => p.id === q.id)).toBe(true);
  });
  it("Mulligan is blocked after any earlier card play that phase", () => {
    let s = base();
    s = cast(s, "44024");
    s = finish(s);
    const p = hand(s, "44048")[0];
    expect(playable(s, p)).toMatch(/another card/);
  });
  it("Break Time measures real saved elapsed whole minutes", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      let s = base("alter");
      s.player.hp = 3;
      s = cast(s, "44046", "44025", "44026", "44027");
      expect(s.prompt?.title).toBe("Break Time");
      s = reload(s);
      vi.advanceTimersByTime(125000);
      s = choose(s, "return");
      expect(s.player.hp).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });
  it("Rock Paper Scissors implements every printed arrow, excluding wild to wild", () => {
    const c = (r: string) =>
      ({ code: "", [`resource_${r}`]: 1 }) as unknown as ReturnType<
        typeof card
      >;
    expect(deadpoolRPS(c("energy"), c("mental"))).toBe(true);
    expect(deadpoolRPS(c("mental"), c("physical"))).toBe(true);
    expect(deadpoolRPS(c("physical"), c("energy"))).toBe(true);
    expect(deadpoolRPS(c("energy"), c("physical"))).toBe(false);
    expect(deadpoolRPS(c("wild"), c("wild"))).toBe(false);
    expect(deadpoolRPS(c("wild"), c("energy"))).toBe(true);
  });
  it("Tic-Tac-Toe wins only on a real printed row/column/diagonal", () => {
    for (const x of [
      [0, 1, 2],
      [0, 3, 6],
      [0, 4, 8],
      [2, 4, 6],
    ])
      expect(deadpoolBoardWon(x)).toBe(true);
    expect(deadpoolBoardWon([0, 1, 3])).toBe(false);
  });
  it("Healing Factor uses its real player-phase response and exhausts", () => {
    let s = base();
    const p = put(s, "44029");
    s.player.hp = 4;
    s = native(s, { type: "wolverinePlayerPhase" });
    s = respond(s, /Healing Factor/);
    s = finish(s);
    expect(s.player.hp).toBe(6);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Chimichanga Truck readies the identity after an actual basic recovery", () => {
    let s = base("alter");
    const p = put(s, "44008");
    s.player.hp = 2;
    s = command(s, { type: "BASIC", action: "recover" });
    s = respond(s, /Chimichanga/);
    s = finish(s);
    expect(s.player.hp).toBe(9);
    expect(s.player.exhausted).toBe(false);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(true);
  });
  it("Exhausting Personality can exhaust a teammate and gives that player the actual acceleration draw", () => {
    let s = base("hero", true);
    s.encounter.acceleration = 2;
    const before = s.players[1].player.hand.length;
    s = cast(s, "44003");
    s = choose(s, "p2");
    s = finish(s);
    expect(s.players[1].player.exhausted).toBe(true);
    expect(s.players[1].player.hand).toHaveLength(before + 2);
  });
  it("Deadpool's Katana pays health and bypasses Tough with piercing", () => {
    let s = base();
    const p = put(s, "44010");
    s.villain.tough = true;
    s = ability(s, p, "katana");
    s = target(s, s.villain.id);
    s = finish(s);
    expect(s.villain.hp).toBe(98);
    expect(s.villain.tough).toBe(false);
    expect(s.player.hp).toBe(8);
  });
  it("Get Rage-y readies the selected ally and grants a phase bonus", () => {
    let s = base();
    const p = put(s, "44002");
    p.exhausted = true;
    s = cast(s, "44020");
    s = target(s, p.id);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.exhausted).toBe(false);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.bonusAtk).toBe(1);
  });
  it("I Got This resolves each printed icon type once despite duplicates", () => {
    let s = base();
    put(s, "44013");
    put(s, "44015");
    s.scheme.threat = 5;
    s = cast(s, "44021", "44025");
    s = target(s, "main");
    s = finish(s);
    expect(s.scheme.threat).toBe(3);
  });
  it("Pool Inspection ignores Crisis for its first main-scheme removal", () => {
    let s = base();
    const q = side(s, "01108", 2);
    s.scheme.threat = 6;
    s = cast(s, "44023", "44025", "44026");
    s = finish(s);
    expect(s.scheme.threat).toBe(1);
    expect(s.sideSchemes.find((p) => p.id === q.id)?.counters).toBe(1);
  });
  it("Deadpool Corps Ship deals a physical encounter card and puts a real Pool ally into play", () => {
    let s = base();
    const ship = put(s, "44049"),
      ally = hand(s, "44045")[0];
    const before = s.encounter.dealt.length;
    s = ability(s, ship, "ship");
    s = choose(s, ally.id);
    s = finish(s);
    expect(s.encounter.dealt).toHaveLength(before + 1);
    expect(s.player.inPlay.find((p) => p.id === ally.id)?.tough).toBe(true);
    expect(s.player.hand.some((p) => p.id === ally.id)).toBe(false);
  });
  it("Plot Convenience retains the same physical aspect card through storage and reload", () => {
    let s = base();
    const plot = put(s, "44050"),
      p = hand(s, "44018")[0];
    s = ability(s, plot, "plot");
    s = choose(s, `store:${p.id}`);
    expect(
      s.player.inPlay.find((q) => q.id === plot.id)?.storedCards?.[0].id,
    ).toBe(p.id);
    s = reload(s);
    s.player.inPlay.find((q) => q.id === plot.id)!.exhausted = false;
    s = ability(s, plot, "plot");
    s = choose(s, `take:${p.id}`);
    expect(s.player.hand.some((q) => q.id === p.id)).toBe(true);
    expect(
      s.player.inPlay.find((q) => q.id === plot.id)?.storedCards,
    ).toHaveLength(0);
  });
  it("Distraction prevents the actual attached minion activating", () => {
    let s = base();
    const m = minion(s, "01103");
    s = cast(s, "44054");
    s = target(s, m.id);
    s = finish(s);
    const before = s.player.hp;
    s = native(s, { type: "enemyAttack", id: m.id });
    s = finish(s);
    expect(s.player.hp).toBe(before);
  });
  it("Butler schemes on Involuntary Procedures and Mutated Soldier heals after activation", () => {
    let s = base("alter");
    const scheme = side(s, "44034", 6),
      butler = minion(s, "44033"),
      soldier = minion(s, "44036");
    soldier.damage = 3;
    s = native(s, { type: "enemyScheme", id: butler.id });
    s = finish(s);
    expect(s.sideSchemes.find((p) => p.id === scheme.id)?.counters).toBe(8);
    s = native(s, { type: "enemyScheme", id: soldier.id });
    s = finish(s);
    expect(s.minions.find((p) => p.id === soldier.id)?.damage).toBe(0);
  });
  it("Metacidal Tendencies deals damage to actual Deadpool Corps characters", () => {
    let s = base();
    const p = put(s, "44016");
    s = reveal(s, "44042");
    s = finish(s);
    expect(s.player.hp).toBe(7);
    expect(s.player.inPlay.find((q) => q.id === p.id)?.damage).toBe(2);
    expect(s.encounter.acceleration).toBe(0);
  });
  it("concurrent mandatory Deadpool and Git Gud replacements allow their prescribed order", () => {
    let s = base();
    const p = put(s, "44028");
    s.player.hp = 1;
    s = native(s, { type: "damage", target: "hero", amount: 2 });
    expect(s.prompt?.title).toBe("Forced defeat replacements");
    s = choose(s, "git-gud");
    s = finish(s);
    expect(s.player.hp).toBe(1);
    expect(s.player.form).toBe("alter");
    expect(s.encounter.acceleration).toBe(0);
    expect(s.removed.some((q) => q.id === p.id)).toBe(true);
  });
  it("Frenemies requires both named characters and one named identity", () => {
    let s = base();
    const p = hand(s, "44031")[0];
    expect(playable(s, p)).toMatch(/Cable and Deadpool/);
    put(s, "44002");
    expect(playable(s, p)).not.toMatch(/Cable and Deadpool/);
  });
  it("unattachable Ambush and Distraction cannot be played", () => {
    const s = base();
    const a = hand(s, "44051")[0];
    expect(playable(s, a)).toMatch(/side scheme/);
    const d = hand(s, "44054")[0];
    expect(playable(s, d)).toMatch(/non-Elite/);
  });
  it("Metaknowledge cancels the actual encounter and takes its printed boost-area damage", () => {
    let s = base();
    const [event, res] = hand(s, "44005", "44025");
    const p = makePiece(s, "01189");
    s = native(s, { type: "reveal", piece: p });
    s = respond(s, /Metaknowledge/);
    s = pay(s, [res]);
    s = finish(s);
    expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(s.player.hp).toBe(
      9 - (card(p).boost || 0) - Number(!!card(p).boost_star),
    );
    expect(s.player.discard.some((q) => q.id === event.id)).toBe(true);
  });
  it("Barely a Scratch prevents one attack damage per printed icon", () => {
    let s = base();
    put(s, "44013");
    hand(s, "44017");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    s = respond(s, /Barely a Scratch/);
    s = finish(s);
    expect(s.player.hp).toBe(9 - 2 - (card("01104").boost || 0) + 1);
  });
  it("Not my Responsibility replaces threat with damage to the selected actual ally", () => {
    let s = base();
    const q = put(s, "44002");
    hand(s, "44022");
    s = native(s, { type: "threat", target: "main", amount: 2 });
    s = respond(s, /Not my Responsibility/);
    s = choose(s, q.id);
    s = finish(s);
    expect(s.scheme.threat).toBe(3);
    expect(s.player.inPlay.find((p) => p.id === q.id)?.damage).toBe(2);
  });
  it("Negasonic takes two damage and cancels When Revealed while retaining printed Surge", () => {
    let s = base();
    const ally = put(s, "44044");
    const p = makePiece(s, "01104");
    s = native(s, { type: "reveal", piece: p });
    s = respond(s, /Negasonic/);
    s = finish(s);
    expect(s.player.inPlay.find((q) => q.id === ally.id)?.damage).toBe(2);
    expect(s.encounter.discard.some((q) => q.id === p.id)).toBe(true);
  });
  it("War counts printed boost triangles and star, then deals the actual player card cost", () => {
    let s = base();
    const war = put(s, "44058");
    const player = makePiece(s, "44019");
    player.ownerId = "p1";
    s.player.deck.unshift(player);
    const boost = makePiece(s, "44033");
    s.encounter.deck.unshift(boost);
    s = ability(s, war, "war");
    s = finish(s);
    expect(s.player.hp).toBe(8);
    expect(s.villain.hp).toBe(94);
    expect(s.player.discard.some((q) => q.id === player.id)).toBe(true);
  });
});
