import { describe, expect, it } from "vitest";
import { card, maxHP } from "../src/game/cards.js";
import {
  enemyStats,
  nativeHeroAbilityOptions,
  newGame,
} from "../src/game/engine.js";
import { heroStarterCodes } from "../src/game/hero-runtime.js";
import { seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import { choose, command, finish, native } from "./dv-test-helpers.js";

// Independent source-based positions: move original pieces, retain every source
// ID, and hydrate commands through the same helper used by retained engine tests.
function opening(team = false, mutantTeammate = false) {
  let s = newGame({
    heroId: "storm",
    aspect: "leadership",
    villainId: "rhino",
    module: "bomb_scare",
    seed: 3602026,
    pacing: "expert",
    heroes: [
      {
        heroId: "storm",
        aspect: "leadership",
        deckCards: heroStarterCodes("storm"),
      },
      ...(team
        ? [
            {
              heroId: mutantTeammate ? "colossus" : "captain_marvel",
              aspect: mutantTeammate
                ? ("protection" as const)
                : ("leadership" as const),
              deckCards: heroStarterCodes(
                mutantTeammate ? "colossus" : "captain_marvel",
              ),
            },
          ]
        : []),
    ],
  });
  for (let n = 0; s.phase === "mulligan" && n < 5; n++) {
    s = command(s, { type: "MULLIGAN", ids: [] });
    if (s.prompt)
      s = finish(
        s,
        (v) =>
          v.prompt?.options.find((o) =>
            ["36002", "32006"].includes(o.image || ""),
          )?.id,
      );
  }
  s = finish(
    s,
    (v) =>
      v.prompt?.options.find((o) => ["36002", "32006"].includes(o.image || ""))
        ?.id,
  );
  expect(s.phase).toBe("player");
  expect(s.heroId).toBe("storm");
  s.player.form = "hero";
  s.player.deck.push(...s.player.hand.splice(0));
  return s;
}
function take(s: GameState, code: string): Piece {
  for (const zone of [s.player.hand, s.player.deck, s.player.discard]) {
    const index = zone.findIndex((p) => p.code === code);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw Error(`Missing actual Storm source card ${code}`);
}
function ownedIds(s: GameState) {
  return [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.attachments,
  ]
    .filter((p) => p.ownerId && card(p).faction_code !== "encounter")
    .map((p) => p.id)
    .sort();
}
function sourceConserved(s: GameState, ids: string[]) {
  expect(ownedIds(s)).toEqual(ids);
  expect(new Set(ownedIds(s)).size).toBe(ids.length);
}
function prepareSearch(s: GameState, withAlly: boolean) {
  const event = take(s, "36020"),
    resource = take(s, "36027");
  s.player.hand.push(event, resource);
  const top = (
    withAlly
      ? ["36014", "36009", "36010", "36011", "36013"]
      : ["36009", "36010", "36011", "36012", "36013"]
  ).map((code) => take(s, code));
  s.player.deck.unshift(...top);
  s = command(s, { type: "PLAY", id: event.id });
  expect(s.prompt?.kind).toBe("payment");
  s = command(s, { type: "PAY", ids: [resource.id] });
  expect(s.prompt?.title).toContain("To Me, My X-Men!");
  return { state: s, allyId: withAlly ? top[0].id : undefined };
}
function beginAttackPosition(s: GameState, target = "p1", original = "p1") {
  s.phase = "villain";
  s.attack = {
    id: `storm-independent:${s.round}:${target}`,
    attacker: s.villain.id,
    isVillain: true,
    originalPlayerId: original,
    targetPlayerId: target,
    defender: "hero",
    base: 0,
    boostCodes: [],
    boostEffects: [],
    defense: 0,
    prevented: 0,
    damage: 0,
    overkill: false,
  };
}
function resolvePaidFreeze(s: GameState) {
  const event = take(s, "36012");
  s.resolving.push(event);
  // Isolate the already-paid printed effect from independent payment coverage.
  return finish(
    native(
      s,
      { type: "storm:freeze", piece: event },
      { type: "finishResolution", id: event.id },
    ),
  );
}
function charge(s: GameState) {
  const index = s.encounter.deck.findIndex((p) => p.code === "01099");
  expect(index).toBeGreaterThanOrEqual(0);
  const p = s.encounter.deck.splice(index, 1)[0];
  p.attachedTo = s.villain.id;
  s.attachments.push(p);
}

describe("independent Storm printed-rule boundaries", () => {
  it("Ororo's Garden heals damage above her printed health after Endurance increases maxHP", () => {
    let s = opening();
    const ids = ownedIds(s),
      garden = take(s, "36008"),
      endurance = take(s, "36026");
    s.player.inPlay.push(garden, endurance);
    s.player.form = "alter";
    expect(maxHP(s)).toBe(13);
    s.player.hp = 12;
    expect(
      nativeHeroAbilityOptions(s, garden.id).some((o) => o.id === "garden"),
    ).toBe(true);
    s = finish(
      command(s, { type: "ABILITY", id: garden.id, action: "garden" }),
    );
    expect(s.player.hp).toBe(13);
    expect(s.player.inPlay.find((p) => p.id === garden.id)?.exhausted).toBe(
      true,
    );
    sourceConserved(s, ids);
  });

  it("X-Mansion requires the actual triggering player to be in alter ego", () => {
    const s = opening(true, true),
      mansion = take(s, "36025");
    s.player.inPlay.push(mansion);
    s.player.hp = 9;
    expect(s.player.form).toBe("hero");
    expect(seatView(s, "p2").player.form).toBe("alter");
    expect(nativeHeroAbilityOptions(s, mansion.id)).toEqual([]);
    expect(
      nativeHeroAbilityOptions(seatView(s, "p2"), mansion.id).length,
      "A teammate whose current alter ego is Mutant may trigger the same physical Mansion",
    ).toBeGreaterThan(0);
  });

  it("X-Mansion's non-Mutant controller may use its ordinary alter-ego action", () => {
    const s = opening(true),
      mansion = take(s, "36025"),
      teammate = seatView(s, "p2");
    teammate.player.inPlay.push(mansion);
    s.player.hp = 9;
    expect(teammate.player.form).toBe("alter");
    expect(
      nativeHeroAbilityOptions(teammate, mansion.id).length,
    ).toBeGreaterThan(0);
    expect(mansion.ownerId).toBe("p1");
  });

  it("Possessed can select and restore the same Robert Kelly scenario ally", () => {
    let s = newGame({
      heroId: "storm",
      aspect: "leadership",
      villainId: "sabretooth",
      modules: ["shadow_king", "bomb_scare"],
      senatorDamage: 0,
      seed: 360382026,
      pacing: "expert",
      heroes: [
        {
          heroId: "storm",
          aspect: "leadership",
          deckCards: heroStarterCodes("storm"),
        },
      ],
    });
    s = finish(
      command(s, { type: "MULLIGAN", ids: [] }),
      (v) => v.prompt?.options.find((o) => o.image === "36002")?.id,
    );
    s.player.form = "hero";
    const search = s.sideSchemes.find((p) => p.code === "32065a")!;
    s = finish(
      native(s, {
        type: "thwart",
        target: search.id,
        amount: search.counters,
        source: "hero",
      }),
    );
    const kellyId = s.sabretooth!.kelly!.id;
    const index = s.encounter.deck.findIndex((p) => p.code === "36038");
    expect(index).toBeGreaterThanOrEqual(0);
    const possessed = s.encounter.deck.splice(index, 1)[0];
    s = native(s, { type: "reveal", piece: possessed, skip: true });
    expect(s.prompt?.title).toBe("Possessed");
    expect(s.prompt?.options.map((o) => o.id)).toContain(kellyId);
    s = finish(choose(s, kellyId));
    expect(s.sabretooth?.kelly).toBeUndefined();
    expect(s.minions.filter((p) => p.id === kellyId)).toHaveLength(1);
    expect(s.minions.find((p) => p.id === kellyId)).toMatchObject({
      stormControlled: true,
      engagedWith: "p1",
    });
    s = finish(
      native(s, { type: "storm:discard-target", target: possessed.id }),
    );
    expect(s.sabretooth?.kelly?.id).toBe(kellyId);
    expect(s.minions.some((p) => p.id === kellyId)).toBe(false);
    expect(
      s.encounter.discard.filter((p) => p.id === possessed.id),
    ).toHaveLength(1);
  });

  it("Blizzard cannot trigger Storm's Cape when no non-Elite minion can pay its target cost", () => {
    const s = opening(),
      cape = take(s, "36007");
    s.player.inPlay.push(cape);
    s.player.exhausted = true;
    const clear = s.player.inPlay.find((p) => p.code === "36002")!;
    s.player.inPlay.splice(s.player.inPlay.indexOf(clear), 1);
    s.player.setAside!.push(clear);
    const index = s.player.setAside!.findIndex((p) => p.code === "36005"),
      blizzard = s.player.setAside!.splice(index, 1)[0];
    s.player.inPlay.push(blizzard);
    expect(s.minions).toHaveLength(0);
    const result = native(s, { type: "storm:special", id: blizzard.id });
    expect(
      result.prompt,
      "FFG ruling148: Special did not resolve, so no Cape response window",
    ).toBeNull();
    expect(result.player.exhausted).toBe(true);
    expect(result.player.inPlay.find((p) => p.id === cape.id)?.exhausted).toBe(
      false,
    );
  });

  it.each([true, false])(
    "shuffles after a declined top-five search, eligible ally=%s",
    (withAlly) => {
      let s = opening();
      const ids = ownedIds(s);
      ({ state: s } = prepareSearch(s, withAlly));
      const before = s.player.deck.map((p) => p.id),
        seed = s.seed;
      s = finish(choose(s, "none"));
      expect(
        s.seed,
        "a searched deck is shuffled even after declining or finding no eligible card",
      ).not.toBe(seed);
      expect(s.player.deck.map((p) => p.id).sort()).toEqual([...before].sort());
      expect(s.player.deck.map((p) => p.id)).not.toEqual(before);
      sourceConserved(s, ids);
    },
  );

  it("puts the selected physical top-five ally into play and shuffles the remaining deck", () => {
    let s = opening();
    const ids = ownedIds(s);
    const prepared = prepareSearch(s, true);
    s = prepared.state;
    const before = s.player.deck.map((p) => p.id),
      seed = s.seed;
    s = finish(choose(s, prepared.allyId!));
    expect(
      s.player.inPlay.filter((p) => p.id === prepared.allyId),
    ).toHaveLength(1);
    expect(s.seed, "successful searches also shuffle").not.toBe(seed);
    expect(s.player.deck.map((p) => p.id).sort()).toEqual(
      before.filter((id) => id !== prepared.allyId).sort(),
    );
    sourceConserved(s, ids);
  });

  it("expires the first Flash Freeze before applying the next phase's copy", () => {
    let s = opening();
    const ids = ownedIds(s);
    charge(s);
    beginAttackPosition(s);
    const base = enemyStats(s, s.villain).attack;
    expect(base).toBe(5);
    s = resolvePaidFreeze(s);
    expect(enemyStats(s, s.villain).attack).toBe(2);
    s.round++;
    beginAttackPosition(s);
    expect(enemyStats(s, s.villain).attack).toBe(base);
    s = resolvePaidFreeze(s);
    expect(
      enemyStats(s, s.villain).attack,
      "new-phase Freeze is -3, not stale -6",
    ).toBe(2);
    sourceConserved(s, ids);
  });

  it("uses the actual attacked hero rather than the original player for a later attack", () => {
    let s = opening(true);
    const ids = ownedIds(s);
    charge(s);
    beginAttackPosition(s);
    s = resolvePaidFreeze(s);
    expect(enemyStats(s, s.villain, "p1").attack).toBe(2);
    // Later in the same phase, another player defends an attack initiated
    // against Storm. That attack is no longer attacking the frozen hero.
    beginAttackPosition(s, "p2", "p1");
    expect(enemyStats(s, s.villain, "p1").attack).toBe(5);
    // Conversely, Storm defending an attack originally against her teammate
    // still benefits from the already established lasting effect.
    beginAttackPosition(s, "p1", "p2");
    expect(enemyStats(s, s.villain, "p2").attack).toBe(2);
    sourceConserved(s, ids);
  });
});
