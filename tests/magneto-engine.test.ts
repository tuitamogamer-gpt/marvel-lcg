import { describe, expect, it } from "vitest";
import { card, VILLAINS, MODULES } from "../src/game/cards.js";
import {
  dispatch,
  newGame,
  schemeLimit,
  enemyStats,
  playable,
  abilityOptions,
} from "../src/game/engine.js";
import { seatView } from "../src/game/team.js";
import { statusCards } from "../src/game/keywords.js";
import type { Effect, GameState, Piece } from "../src/game/types.js";
import { command, choose, native, reload, passId } from "./dv-test-helpers.js";

function settle(s: GameState) {
  for (let n = 0; s.prompt && n < 160; n++) {
    const o =
      passId(s) ||
      s.prompt.options.find((o) => /^(resolve|allow|take-damage)$/.test(o.id))
        ?.id ||
      s.prompt.options[0]?.id;
    expect(o, JSON.stringify(s.prompt)).toBeTruthy();
    s = choose(s, o!);
  }
  expect(s.prompt, JSON.stringify(s.prompt)).toBeNull();
  expect(s.error).toBeUndefined();
  return reload(s);
}
function base(
  team = false,
  difficulty: "standard" | "expert" = "standard",
  module = "acolytes",
) {
  let s = newGame({
    heroId: "spider_man",
    aspect: "justice",
    villainId: "magneto",
    difficulty,
    module,
    seed: 321380,
    pacing: "expert",
    ...(team
      ? {
          heroes: [
            { heroId: "spider_man", aspect: "justice" as const },
            { heroId: "captain_marvel", aspect: "aggression" as const },
          ],
        }
      : {}),
  });
  for (const _ of s.players) s = command(s, { type: "MULLIGAN", ids: [] });
  s = settle(s);
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.form = "hero";
    v.player.hp = 100;
    v.player.deck.push(...v.player.hand);
    v.player.hand = [];
  }
  s.villain.tough = false;
  s.villain.toughCards = 0;
  return s;
}
function zones(s: GameState): Piece[][] {
  const list = [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.encounter.storedBoosts || [],
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.resolving,
    s.removed,
    s.victoryDisplay || [],
    s.magneto?.mainDeck || [],
    s.magneto?.villainDeck || [],
    ...(s.magneto?.currentMain ? [[s.magneto.currentMain]] : []),
    ...(s.magneto?.orbital ? [[s.magneto.orbital]] : []),
    [s.villain],
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.hand, p.deck, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
  for (const zone of [...list])
    for (const p of zone) if (p.storedCards) list.push(p.storedCards);
  return list;
}
function exact(s: GameState) {
  const all = zones(s).flat();
  expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
  const scenario = all.filter((p) => card(p).set_code === "magneto_villain");
  expect(scenario).toHaveLength(29);
  return s;
}
function take(s: GameState, code: string) {
  for (const zone of zones(s)) {
    const i = zone.findIndex((p) => p.code === code);
    if (i >= 0) return zone.splice(i, 1)[0];
  }
  throw Error(`Missing original source ${code}`);
}
function reveal(s: GameState, code: string, actorId = "p1") {
  return settle(native(s, { type: "reveal", piece: take(s, code), actorId }));
}
function damage(s: GameState, n: number, extra: Partial<Effect> = {}) {
  return settle(
    native(s, {
      type: "damage",
      target: s.villain.id,
      amount: n,
      source: "hero",
      ...extra,
    }),
  );
}
function sideDefeat(s: GameState, code: string, actorId = "p1") {
  const p = s.sideSchemes.find((p) => p.code === code)!;
  expect(p).toBeTruthy();
  return settle(
    native(s, { type: "thwart", target: p.id, amount: p.counters, actorId }),
  );
}
function noCap(s: GameState) {
  for (const code of ["32144a", "32144b", "32145a"])
    if (s.sideSchemes.some((p) => p.code === code)) s = sideDefeat(s, code);
  return s;
}
function hand(s: GameState, codes: string[], playerId = "p1") {
  const p = seatView(s, playerId).player;
  for (const code of codes) p.hand.push(take(s, code));
  return p.hand;
}
function top(s: GameState, ...codes: string[]) {
  const pieces = codes.map((code) => take(s, code));
  s.encounter.deck.unshift(...pieces);
  return pieces;
}

describe("native standalone Magneto", () => {
  it("registers replaceable Acolytes recommendation without fixed modular sets", () => {
    const v = VILLAINS.find((v) => v.id === "magneto")!;
    expect(v.module).toBe("acolytes");
    expect(v.fixedSets).toBeUndefined();
    expect(MODULES).toHaveLength(30);
    expect(MODULES.slice(20, 22).map((module) => module.id)).toEqual([
      "exodus",
      "reavers",
    ]);
    const s = base(false, "standard", "bomb_scare");
    expect(
      s.encounter.deck.some((p) => card(p).set_code === "bomb_scare"),
    ).toBe(true);
    expect(s.encounter.deck.some((p) => card(p).set_code === "acolytes")).toBe(
      false,
    );
    exact(s);
  });
  for (const difficulty of ["standard", "expert"] as const)
    for (const team of [false, true])
      it(`${difficulty} ${team ? "two player" : "solo"} setup owns 29 original physical scenario cards`, () => {
        const s = newGame({
          heroId: "spider_man",
          aspect: "justice",
          villainId: "magneto",
          difficulty,
          seed: 321380,
          pacing: "expert",
          ...(team
            ? {
                heroes: [
                  { heroId: "spider_man", aspect: "justice" as const },
                  { heroId: "captain_marvel", aspect: "aggression" as const },
                ],
              }
            : {}),
        });
        expect(s.villain.id).not.toBe("villain");
        expect(s.villain.code).toBe(
          difficulty === "expert" ? "32139" : "32138",
        );
        expect(s.villain.tough).toBe(true);
        expect(s.magneto?.currentMain?.code).toBe("32141b");
        expect(s.magneto?.mainDeck?.map((p) => p.code)).toEqual([
          "32142a",
          "32143a",
        ]);
        expect(s.magneto?.orbital?.code).toBe("32145a");
        expect(s.sideSchemes.map((p) => [p.code, p.counters])).toEqual([
          ["32144a", 3 * s.playerCount],
        ]);
        expect(s.scheme.threat).toBe(s.playerCount);
        expect(schemeLimit(s)).toBe(5 * s.playerCount);
        expect(s.encounter.dealt).toHaveLength(
          difficulty === "expert" ? s.playerCount : 0,
        );
        expect(
          s.encounter.deck.some((p) => ["32144b", "32145b"].includes(p.code)),
        ).toBe(false);
        exact(reload(s));
      });
  it("progress side schemes flip the same IDs into Victory and permanent Physical Strain", () => {
    let s = base();
    const boarding = s.sideSchemes[0].id,
      orbital = s.magneto!.orbital!.id;
    s = sideDefeat(s, "32144a");
    expect(s.sideSchemes.find((p) => p.id === boarding)?.code).toBe("32144b");
    expect(s.sideSchemes[0].counters).toBe(3);
    s = sideDefeat(s, "32144b");
    expect(s.victoryDisplay?.find((p) => p.id === boarding)?.code).toBe(
      "32144b",
    );
    expect(s.sideSchemes.find((p) => p.id === orbital)?.code).toBe("32145a");
    s = sideDefeat(s, "32145a");
    expect(s.attachments.find((p) => p.id === orbital)?.code).toBe("32145b");
    expect(s.attachments.find((p) => p.id === orbital)?.attachedTo).toBe(
      s.villain.id,
    );
    exact(s);
  });
  for (const team of [false, true])
    it(`enforces 6/12/18 sustained damage limits ${team ? "per two players" : "solo"}`, () => {
      let s = base(team);
      s.villain.hp = s.villain.maxHp = 40 * s.playerCount;
      const hp = s.villain.hp;
      s = damage(s, 100);
      expect(hp - s.villain.hp).toBe(6 * s.playerCount);
      s = sideDefeat(s, "32144a");
      s = damage(s, 100);
      expect(hp - s.villain.hp).toBe(12 * s.playerCount);
      // Advance to the high health stage before the 18N ceiling can defeat I.
      if (s.villain.maxHp < 18 * s.playerCount) {
        s.villain.maxHp = 40 * s.playerCount;
        s.villain.hp = s.villain.maxHp - 12 * s.playerCount;
      }
      const max = s.villain.maxHp;
      s = sideDefeat(s, "32144b");
      s = damage(s, 100);
      expect(max - s.villain.hp).toBe(18 * s.playerCount);
      exact(s);
    });
  it("applies constant cap before Bubble and Tough before the take replacement", () => {
    let s = base();
    s = damage(s, 5);
    s = reveal(s, "32149");
    const bubble = s.attachments.find((p) => p.code === "32149")!.id;
    s = damage(s, 2);
    expect(s.attachments.find((p) => p.id === bubble)?.damage).toBe(1);
    expect(s.villain.maxHp - s.villain.hp).toBe(5);
    s.villain.tough = true;
    s.villain.toughCards = 1;
    s = damage(s, 1);
    expect(s.villain.tough).toBe(false);
    expect(s.attachments.find((p) => p.id === bubble)?.damage).toBe(1);
    s = damage(s, 1);
    expect(s.attachments.find((p) => p.id === bubble)?.damage).toBe(2);
    exact(s);
  });
  it("Bubble absorbs the full capped packet without overflowing when it breaks", () => {
    let s = noCap(base());
    s = reveal(s, "32149");
    const p = s.attachments.find((p) => p.code === "32149")!;
    p.damage = 7;
    const hp = s.villain.hp;
    s = damage(s, 20);
    expect(s.villain.hp).toBe(hp);
    expect(s.attachments.some((q) => q.id === p.id)).toBe(false);
    expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    exact(s);
  });
  it("Helmet and Armor block new statuses while retaining existing Steady status cards", () => {
    let s = base();
    s = settle(
      native(
        s,
        { type: "status", target: s.villain.id, status: "confused" },
        { type: "status", target: s.villain.id, status: "stunned" },
      ),
    );
    expect(statusCards(s.villain, "confused")).toBe(1);
    s = reveal(s, "32147");
    s = reveal(s, "32148");
    s = settle(
      native(
        s,
        { type: "status", target: s.villain.id, status: "confused" },
        { type: "status", target: s.villain.id, status: "stunned" },
      ),
    );
    expect(statusCards(s.villain, "confused")).toBe(1);
    expect(statusCards(s.villain, "stunned")).toBe(1);
    expect(s.villain.confused).toBe(false);
    expect(enemyStats(s, s.villain)).toEqual({
      attack: card(s.villain).attack! + 1,
      scheme: card(s.villain).scheme! + 1,
    });
    s = noCap(s);
    expect(statusCards(s.villain, "confused")).toBe(1);
    expect(s.villain.confused).toBe(true);
    expect(s.villain.stunned).toBe(true);
    exact(s);
  });
  it("main scheme source IDs advance through actual 2A/3A searches and final loss", () => {
    let s = base();
    const ids = [
      s.magneto!.currentMain!.id,
      ...s.magneto!.mainDeck!.map((p) => p.id),
    ];
    s = settle(native(s, { type: "threat", target: "main", amount: 5 }));
    expect(s.scheme.code).toBe("32142b");
    expect(s.magneto!.currentMain!.id).toBe(ids[1]);
    expect(s.magneto!.magnetCounters).toBe(1);
    expect(s.minions.some((p) => p.code === "32146")).toBe(true);
    s = settle(native(s, { type: "threat", target: "main", amount: 6 }));
    expect(s.scheme.code).toBe("32143b");
    expect(s.magneto!.currentMain!.id).toBe(ids[2]);
    expect(s.magneto!.magnetCounters).toBe(2);
    expect(
      s.attachments.some((p) => /Magnetic/.test(card(p).traits || "")),
    ).toBe(true);
    s = settle(native(s, { type: "threat", target: "main", amount: 7 }));
    expect(s.phase).toBe("lost");
    exact(s);
  });
  it("main searches are suppressed by Sabotage Victory and attached Physical Strain", () => {
    let s = noCap(base());
    s = settle(native(s, { type: "threat", target: "main", amount: 5 }));
    expect(s.minions).toEqual([]);
    s = settle(native(s, { type: "threat", target: "main", amount: 6 }));
    expect(s.attachments.map((p) => p.code)).toEqual(["32145b"]);
    exact(s);
  });
  it("removes three magnet counters before revealing the actual Magnetic source", () => {
    let s = base();
    const [shock] = top(s, "32152");
    s.magneto!.magnetCounters = 2;
    const hp = s.player.hp;
    s = settle(native(s, { type: "magneto:place-counters", amount: 1 }));
    expect(s.magneto!.magnetCounters).toBe(0);
    expect(s.player.hp).toBe(hp);
    expect(s.player.stunned).toBe(true);
    expect(s.encounter.discard.filter((p) => p.id === shock.id)).toHaveLength(
      1,
    );
    exact(s);
  });
  it("after a performed zero-damage Magneto attack adds one magnet counter", () => {
    let s = base();
    top(s, "32153");
    s.player.tough = true;
    s.player.toughCards = 1;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.magneto!.magnetCounters).toBe(1);
    expect(s.player.tough).toBe(false);
    expect(s.player.exhausted).toBe(true);
    exact(s);
  });
  it("a stun replacement adds no magnet counter and does not draw the boost", () => {
    let s = base();
    const [boost] = top(s, "32153");
    s.villain.stunned = true;
    s.villain.stunCards = 2;
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.magneto!.magnetCounters).toBe(0);
    expect(s.encounter.deck[0].id).toBe(boost.id);
    exact(s);
  });
  it("M-Type Sentinel defeat gives Magneto Tough using its same source card", () => {
    let s = base();
    s = reveal(s, "32146");
    const p = s.minions[0];
    s = settle(
      native(s, { type: "damage", target: p.id, amount: 20, source: "hero" }),
    );
    expect(s.villain.tough).toBe(true);
    expect(s.encounter.discard.filter((q) => q.id === p.id)).toHaveLength(1);
    exact(s);
  });
  it("M-Type boost gives Tough and reveals its extra boost during Magneto’s current attack", () => {
    let s = base();
    const [sentinel, future] = top(s, "32146", "32153");
    s = settle(native(s, { type: "enemyAttack", id: s.villain.id }));
    expect(s.villain.tough).toBe(true);
    expect(s.encounter.storedBoosts || []).toEqual([]);
    expect(s.encounter.discard.some((p) => p.id === future.id)).toBe(true);
    expect(s.player.exhausted).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === sentinel.id)).toBe(true);
    exact(s);
  });
  it("Wrapped blocks all basic powers, attack/thwart events and basic defense, while allowing form changes", () => {
    let s = reveal(base(), "32150");
    hand(s, ["01003"]);
    expect(playable(s, s.player.hand[0])).toMatch(/Wrapped/);
    for (const action of ["attack", "thwart", "recover"] as const)
      expect(dispatch(reload(s), { type: "BASIC", action }).error).toMatch(
        /Wrapped/,
      );
    s = command(s, { type: "FLIP" });
    expect(s.player.form).toBe("alter");
    s.player.flipped = false;
    s.player.form = "hero";
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    expect(s.prompt?.options.some((o) => o.id === "hero")).toBe(false);
  });
  it("Wrapped paid Action exhausts the actual identity and spends a physical source card in alter ego", () => {
    let s = reveal(base(), "32150");
    s.player.form = "alter";
    const source = s.attachments.find((p) => p.code === "32150")!;
    const [resource] = hand(s, ["01090"]);
    const options = abilityOptions(s, source);
    expect(options[0]?.id).toMatch(/^magneto-wrapped:/);
    s = command(s, { type: "ABILITY", id: source.id, action: options[0].id });
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: [resource.id] });
    s = settle(s);
    expect(s.player.exhausted).toBe(true);
    expect(s.attachments.some((p) => p.id === source.id)).toBe(false);
    expect(s.player.discard.some((p) => p.id === resource.id)).toBe(true);
    exact(s);
  });
  it("a real basic attack opens Armor's paid response even when Tough prevents all damage", () => {
    let s = reveal(base(), "32148");
    const armor = s.attachments.find((p) => p.code === "32148")!;
    const resources = hand(s, ["01088", "01089", "01090"]);
    s.villain.tough = true;
    s.villain.toughCards = 1;
    const hp = s.villain.hp;
    s = command(s, { type: "BASIC", action: "attack" });
    for (
      let n = 0;
      s.prompt &&
      !s.prompt.options.some((o) => o.id.startsWith("magneto-response:")) &&
      n < 50;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    const response = s.prompt?.options.find((o) =>
      o.id.startsWith("magneto-response:"),
    );
    expect(response, JSON.stringify(s.prompt)).toBeTruthy();
    expect(s.villain.hp).toBe(hp);
    s = choose(s, response!.id);
    expect(s.prompt?.kind).toBe("payment");
    s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
    s = settle(s);
    expect(s.attachments.some((p) => p.id === armor.id)).toBe(false);
    expect(
      resources.every((r) => s.player.discard.some((p) => p.id === r.id)),
    ).toBe(true);
    exact(s);
  });
  it("an attack event never offers Armor's basic attack response", () => {
    let s = reveal(base(), "32148");
    hand(s, ["01088", "01089", "01090"]);
    s = native(s, {
      type: "damage",
      target: s.villain.id,
      amount: 2,
      source: "hero",
      attack: true,
    });
    for (let n = 0; s.prompt && n < 100; n++) {
      expect(
        s.prompt.options.some((o) => o.id.startsWith("magneto-response:")),
      ).toBe(false);
      s = choose(s, passId(s) || s.prompt.options[0].id);
    }
    exact(s);
  });
  it("Master of Magnetism moves the actual topmost discarded Magnetic source into a boost", () => {
    let s = base();
    const older = take(s, "32149"),
      latest = take(s, "32153");
    s.encounter.discard.push(older, latest);
    top(s, "32147");
    const hp = s.player.hp;
    s = reveal(s, "32151");
    expect(s.player.hp).toBeLessThan(hp);
    expect(s.encounter.storedBoosts || []).toEqual([]);
    expect(s.encounter.discard.filter((p) => p.id === latest.id)).toHaveLength(
      1,
    );
    expect(s.encounter.discard.some((p) => p.id === older.id)).toBe(true);
    expect(s.player.exhausted).toBe(true);
    expect(s.magneto!.magnetCounters).toBe(1);
    exact(s);
  });
  it("Metal Shards boost adds a counter only for an actual ally defeat", () => {
    let s = base();
    const ally = take(s, "01002");
    s.player.inPlay.push(ally);
    top(s, "32154");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    for (
      let n = 0;
      s.prompt && !s.prompt.options.some((o) => o.id === ally.id) && n < 50;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    s = choose(s, ally.id);
    s = settle(s);
    expect(s.player.discard.some((p) => p.id === ally.id)).toBe(true);
    expect(s.magneto!.magnetCounters).toBe(2);
    exact(s);
  });
  it("Metal Shards boost does not add its extra counter when Tough saves the defender", () => {
    let s = base();
    const ally = take(s, "01002");
    ally.tough = true;
    ally.toughCards = 1;
    s.player.inPlay.push(ally);
    top(s, "32154");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    for (
      let n = 0;
      s.prompt && !s.prompt.options.some((o) => o.id === ally.id) && n < 50;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    s = choose(s, ally.id);
    s = settle(s);
    expect(s.player.inPlay.some((p) => p.id === ally.id)).toBe(true);
    expect(s.magneto!.magnetCounters).toBe(1);
    exact(s);
  });
  it("Magnetic Missile defeats an actual Sentinel before its Then damage and hand prevention", () => {
    let s = reveal(base(), "32146");
    const sentinel = s.minions[0];
    const handCards = hand(s, ["01088", "01089"]);
    const hp = s.player.hp;
    s = native(s, { type: "reveal", piece: take(s, "32155") });
    for (
      let n = 0;
      s.prompt &&
      !s.prompt.options.some((o) => o.id === handCards[0].id) &&
      n < 50;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    expect(s.villain.tough).toBe(true);
    expect(s.minions.some((p) => p.id === sentinel.id)).toBe(false);
    s = choose(s, handCards[0].id);
    s = choose(s, handCards[1].id);
    if (s.prompt?.options.some((o) => o.id === "take-damage"))
      s = choose(s, "take-damage");
    s = settle(s);
    expect(s.player.hp).toBe(hp - 3);
    exact(s);
  });
  it("Magnetic Missile with no Sentinel skips its Then damage but still surges", () => {
    let s = base();
    top(s, "32153");
    const hp = s.player.hp;
    s = reveal(s, "32155");
    expect(s.player.hp).toBe(hp);
    expect(s.encounter.dealt.some((p) => p.code === "32153")).toBe(true);
    exact(s);
  });
  it("Magneto stages retain statuses and attachments while changing original physical villain IDs", () => {
    let s = noCap(base());
    s = reveal(s, "32147");
    const old = s.villain.id,
      next = s.magneto!.villainDeck![0].id;
    const helmet = s.attachments.find((p) => p.code === "32147")!.id;
    s.villain.stunCards = 1;
    s.villain.stunned = true;
    s = damage(s, 100);
    expect(s.villain.id).toBe(next);
    expect(s.villain.code).toBe("32139");
    expect(s.removed.some((p) => p.id === old)).toBe(true);
    expect(s.attachments.find((p) => p.id === helmet)?.attachedTo).toBe(next);
    expect(statusCards(s.villain, "stunned")).toBe(1);
    expect(s.villain.tough).toBe(true);
    expect(s.encounter.dealt).toHaveLength(1);
    exact(s);
    s.villain.tough = false;
    s.villain.toughCards = 0;
    s = damage(s, 100);
    expect(s.phase).toBe("won");
    exact(s);
  });
  it("Expert opening stage deals exactly once after every mulligan", () => {
    const s = base(true, "expert");
    expect(s.encounter.dealt).toHaveLength(2);
    expect(s.encounter.dealt.map((p) => p.dealtTo).sort()).toEqual([
      "p1",
      "p2",
    ]);
    exact(s);
  });
  it("Magneto’s after-you attack counter belongs to the teammate who actually defends", () => {
    let s = base(true);
    s.magneto!.magnetCounters = 2;
    top(s, "32153", "32150");
    s = native(s, { type: "enemyAttack", id: s.villain.id, actorId: "p1" });
    for (
      let n = 0;
      s.prompt && !s.prompt.options.some((o) => o.id === "hero:p2") && n < 50;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    s = choose(s, "hero:p2");
    s = settle(s);
    expect(s.attachments.find((p) => p.code === "32150")?.attachedTo).toBe(
      "hero:p2",
    );
    expect(s.magneto!.magnetCounters).toBe(0);
    exact(s);
  });
  it("Wrapped does not prevent discarding an attack event to prevent Magnetic Missile damage", () => {
    let s = reveal(base(), "32150");
    s = reveal(s, "32146");
    const [webkick] = hand(s, ["01005"]);
    const hp = s.player.hp;
    s = native(s, { type: "reveal", piece: take(s, "32155") });
    for (
      let n = 0;
      s.prompt && !s.prompt.options.some((o) => o.id === webkick.id) && n < 50;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    expect(s.prompt?.options.some((o) => o.id === webkick.id)).toBe(true);
    s = choose(s, webkick.id);
    s = settle(s);
    expect(s.player.hp).toBe(hp - 4);
    exact(s);
  });
  it("Seized moves the available top-card cohort before a native deck reset", () => {
    let s = base();
    const kept = s.player.deck.splice(0, 2);
    s.player.discard.push(...s.player.deck.splice(0));
    s.player.deck = kept;
    const ids = kept.map((p) => p.id);
    const dealt = s.encounter.dealt.length;
    s = reveal(s, "32158");
    expect(
      s.sideSchemes
        .find((p) => p.code === "32158")
        ?.storedCards?.map((p) => p.id),
    ).toEqual(ids);
    expect(s.player.deck.length).toBeGreaterThan(0);
    expect(s.encounter.dealt.length).toBe(dealt + 1);
    exact(s);
  });
  it("M-Type Sentinel boosting a Villainous minion gives Magneto a future boost", () => {
    let s = reveal(base(), "32159");
    const fabian = s.minions.find((p) => p.code === "32159")!;
    const [sentinel, future] = top(s, "32146", "32153");
    s = settle(native(s, { type: "enemyAttack", id: fabian.id }));
    expect(s.encounter.storedBoosts?.map((p) => p.id)).toEqual([future.id]);
    expect(s.encounter.discard.some((p) => p.id === sentinel.id)).toBe(true);
    expect(s.player.exhausted).toBe(false);
    exact(s);
  });
  it("a paid basic attack response still targets Magneto after advancing his physical stage", () => {
    let s = noCap(base());
    s = reveal(s, "32148");
    const armor = s.attachments.find((p) => p.code === "32148")!;
    const old = s.villain.id;
    s.villain.hp = 1;
    const resources = hand(s, ["01088", "01089", "01090"]);
    s = command(s, { type: "BASIC", action: "attack" });
    for (
      let n = 0;
      s.prompt &&
      !s.prompt.options.some((o) => o.id.startsWith("magneto-response:")) &&
      n < 50;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    expect(s.villain.id).not.toBe(old);
    const response = s.prompt?.options.find((o) =>
      o.id.startsWith("magneto-response:"),
    );
    expect(response).toBeTruthy();
    s = choose(s, response!.id);
    s = command(s, { type: "PAY", ids: resources.map((p) => p.id) });
    s = settle(s);
    expect(s.attachments.some((p) => p.id === armor.id)).toBe(false);
    exact(s);
  });
  it("Seized retains its cards until its When Defeated activation has finished", () => {
    let s = reveal(base(), "32158");
    const scheme = s.sideSchemes.find((p) => p.code === "32158")!;
    const stored = scheme.storedCards!.map((p) => p.id);
    top(s, "32153");
    s = native(s, {
      type: "thwart",
      target: scheme.id,
      amount: scheme.counters,
    });
    for (
      let n = 0;
      s.prompt && !s.prompt.options.some((o) => o.id === "take") && n < 50;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    expect(
      s.sideSchemes
        .find((p) => p.id === scheme.id)
        ?.storedCards?.map((p) => p.id),
    ).toEqual(stored);
    expect(s.player.discard.some((p) => stored.includes(p.id))).toBe(false);
    s = settle(s);
    expect(s.sideSchemes.some((p) => p.id === scheme.id)).toBe(false);
    expect(
      stored.every((id) => s.player.discard.some((p) => p.id === id)),
    ).toBe(true);
    exact(s);
  });
  it("Wrapped permits discarding Backflip for a Missile revealed in an attack’s magnet-counter window", () => {
    let s = reveal(base(), "32150");
    s = reveal(s, "32146");
    const [backflip] = hand(s, ["01003"]);
    s.magneto!.magnetCounters = 2;
    top(s, "32153", "32155");
    s = native(s, { type: "enemyAttack", id: s.villain.id });
    for (
      let n = 0;
      s.prompt &&
      !s.prompt.options.some((o) => o.id === backflip.id) &&
      n < 100;
      n++
    )
      s = choose(s, passId(s) || s.prompt.options[0].id);
    expect(s.prompt?.options.some((o) => o.id === backflip.id)).toBe(true);
    s = choose(s, backflip.id);
    s = settle(s);
    expect(s.player.discard.some((p) => p.id === backflip.id)).toBe(true);
    exact(s);
  });
  for (const attack of [true, false])
    it(`Wrapped blocks Captain Marvel's Cosmic Flight defense against ${attack ? "an actual attack" : "ordinary damage"}`, () => {
      let s = reveal(base(true), "32150", "p2");
      const flight = take(s, "01017");
      seatView(s, "p2").player.inPlay.push(flight);
      const firstHp = seatView(s, "p1").player.hp;
      const hp = seatView(s, "p2").player.hp;
      if (attack) top(s, "32153");
      const amount = attack ? card(s.villain).attack! : 4;
      s = native(
        s,
        attack
          ? { type: "enemyAttack", id: s.villain.id, actorId: "p2" }
          : {
              type: "damage",
              target: "hero",
              amount,
              source: s.villain.id,
              actorId: "p2",
            },
      );
      for (let n = 0; s.prompt && n < 100; n++) {
        expect(
          s.prompt.options.some(
            (o) => o.id === "flight" || o.image === "01017",
          ),
          JSON.stringify(s.prompt),
        ).toBe(false);
        s = choose(
          s,
          passId(s) ||
            s.prompt.options.find((o) => o.id === "allow")?.id ||
            s.prompt.options[0].id,
        );
      }
      expect(s.prompt).toBeNull();
      expect(seatView(s, "p1").player.hp).toBe(firstHp);
      expect(seatView(s, "p2").player.hp).toBe(hp - amount);
      expect(
        seatView(s, "p2").player.inPlay.some((p) => p.id === flight.id),
      ).toBe(true);
      exact(s);
    });
  it("Wrapped blocks Captain America's Shield Block defense against ordinary damage", () => {
    let s = newGame({
      heroId: "captain_america",
      aspect: "leadership",
      villainId: "magneto",
      seed: 321380,
      pacing: "expert",
    });
    s = command(s, { type: "MULLIGAN", ids: [] });
    s = settle(s);
    s.player.form = "hero";
    s.player.hp = 100;
    s.player.deck.push(...s.player.hand.splice(0));
    const shield = take(s, "03009"),
      block = take(s, "03005");
    shield.exhausted = false;
    s.player.inPlay.push(shield);
    s.player.hand.push(block);
    s = reveal(s, "32150");
    const hp = s.player.hp;
    s = native(s, {
      type: "damage",
      target: "hero",
      amount: 4,
      source: s.villain.id,
    });
    for (let n = 0; s.prompt && n < 100; n++) {
      expect(
        s.prompt.options.some(
          (o) => o.image === "03005" || /Shield Block/.test(o.label),
        ),
        JSON.stringify(s.prompt),
      ).toBe(false);
      s = choose(
        s,
        passId(s) ||
          s.prompt.options.find((o) => o.id === "allow")?.id ||
          s.prompt.options[0].id,
      );
    }
    expect(s.prompt).toBeNull();
    expect(s.player.hp).toBe(hp - 4);
    expect(s.player.inPlay.find((p) => p.id === shield.id)?.exhausted).toBe(
      false,
    );
    expect(s.player.hand.some((p) => p.id === block.id)).toBe(true);
    exact(s);
  });
  it("Seized stores both players' original cards and Magneto activates against the actual defeating player", () => {
    let s = base(true);
    const before = s.players.map((seat) =>
      seatView(s, seat)
        .player.deck.slice(0, 6)
        .map((p) => p.id),
    );
    s = reveal(s, "32158", "p2");
    const p = s.sideSchemes.find((p) => p.code === "32158")!;
    expect(p.storedCards?.map((q) => q.id)).toEqual(before.flat());
    const hp1 = s.players[0].player.hp,
      hp2 = s.players[1].player.hp;
    top(s, "32153");
    s = sideDefeat(s, "32158", "p2");
    expect(s.players[0].player.hp).toBe(hp1);
    expect(s.players[1].player.hp).toBeLessThan(hp2);
    for (const [i, ids] of before.entries())
      expect(
        ids.every((id) =>
          seatView(s, s.players[i]).player.discard.some((q) => q.id === id),
        ),
      ).toBe(true);
    exact(s);
  });
});
