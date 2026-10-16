import { createHash } from "node:crypto";
import { magnetoIdentityRestricted } from "../src/game/magneto";
import { cyclopsCanAttack } from "../src/game/cyclops";
import { isTextBlank } from "../src/game/card-text";
import { visionCanAttack } from "../src/game/vision";
import { valkyrieCannotBasicAttack } from "../src/game/valkyrie";
import { doctorStrangeAbilityOptions } from "../src/game/doctor-strange";
import { thorAbilityOptions } from "../src/game/thor";
import { msMarvelAbilityOptions } from "../src/game/ms-marvel";
import { describe, expect, it } from "vitest";
import {
  HEROES,
  MODULES,
  VILLAINS,
  card,
  heroStats,
  maxHP,
  scenarioModules,
} from "../src/game/cards";
import { CATALOG_HEROES, catalogDeckCodes } from "../src/game/catalog";
import { deckErrors } from "../src/game/decks";
import {
  abilityOptions,
  canChangeIdentityForm,
  dispatch,
  newGame,
  playable,
  targets,
  nativeHeroAbilityOptions,
  hawkeyeStoredPlayable,
} from "../src/game/engine";
import { advisePrompt } from "../src/game/advisor";
import {
  captainAbilityOptions,
  captainThwartBlocked,
} from "../src/game/captain-america";
import { hulkAbilityOptions } from "../src/game/hulk";
import { uniqueConflict } from "../src/game/unique";
import {
  heroStarterAspects,
  heroSupplementaryCards,
  isPermanent,
} from "../src/game/hero-runtime";
import { deckSizeFor } from "../src/game/decks";
import { seatView } from "../src/game/team";
import type { Aspect, Command, GameState, Piece } from "../src/game/types";

const ended = (s: GameState) => ["won", "lost"].includes(s.phase);
const heroIds = [
  "captain_america",
  "hulk",
  "thor",
  "ms_marvel",
  "black_widow",
  "doctor_strange",
  "hawkeye",
  "spider_woman",
  "ant",
  "wsp",
  "qsv",
  "scw",
  "groot",
  "rocket",
  "stld",
  "gam",
  "drax",
  "vnm",
  "spectrum",
  "warlock",
  "nebu",
  "warm",
  "valk",
  "vision",
  "ghost_spider",
  "spider_man_morales",
  "nova",
  "ironheart",
  "spiderham",
  "spdr",
  "colossus",
  "shadowcat",
  "cyclops",
  "phoenix",
  "wolverine",
  "storm",
];
const missions = heroIds.flatMap((heroId, hi) =>
  VILLAINS.flatMap((scenario, vi) =>
    (["standard", "expert"] as const).flatMap((difficulty, di) =>
      scenarioModules(scenario.id).map((module, mi) => ({
        heroId,
        villainId: scenario.id,
        difficulty,
        module: module.id,
        seed: 9000 + hi * 1000 + vi * 100 + di * 10 + mi,
      })),
    ),
  ),
);

// Build the complete grid before partitioning so every existing configuration
// keeps the original global hero/scenario/module indexes and seeded shuffle.
const shardIndex = process.env.MISSION_SHARD_INDEX;
const shardCount = process.env.MISSION_SHARD_COUNT;
const isSharded = shardIndex !== undefined || shardCount !== undefined;
if (
  isSharded &&
  (shardCount !== "4" || !["0", "1", "2", "3"].includes(shardIndex ?? ""))
)
  throw Error(
    "Set both MISSION_SHARD_COUNT=4 and MISSION_SHARD_INDEX=0..3, or neither.",
  );
const partitions = Array.from({ length: 4 }, (_, index) =>
  missions.filter((mission) => heroIds.indexOf(mission.heroId) % 4 === index),
);
const selectedMissions = isSharded ? partitions[Number(shardIndex)] : missions;

/** Only physical-zone auditing inspects hidden card IDs. The player strategy
 * uses hand cards, visible board state, and the same public prompts as the UI. */
function ownedPieces(s: GameState, originalIds: Set<string>): Piece[] {
  const playerZones = s.players.flatMap((seat) => {
    const p = seatView(s, seat).player;
    return [
      ...p.hand,
      ...p.deck,
      ...p.discard,
      ...p.inPlay,
      ...(p.spdrIdentity ? [p.spdrIdentity] : []),
      ...(p.setAside || []),
      ...(p.invocationDeck || []),
      ...(p.invocationDiscard || []),
    ];
  });
  const actual = [
    ...playerZones,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...((s.encounter as GameState["encounter"] & { setAside?: Piece[] })
      .setAside || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
    s.villain,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.resolving,
    ...s.removed,
  ];
  const pieces: Piece[] = [];
  const visit = (p: Piece) => {
    // Do not deduplicate: the audit must detect the same physical ID in two
    // actual zones. Prompt, queue and attacker snapshots are not physical zones.
    pieces.push(p);
    for (const child of [
      ...(p.storedCards || []),
      ...(p.captured || []),
      ...(p.droneCard ? [p.droneCard] : []),
    ])
      visit(child);
  };
  actual.forEach(visit);
  // Encounter cards such as Spectrum's Loss of Control can be in player zones;
  // owned Cosmic Entities can be in encounter zones. Membership follows the
  // original physical source IDs, never the current zone or owner alone.
  return pieces.filter((p) => originalIds.has(p.id));
}

/** Native scenario piles own original main/villain/progress cards. Public
 * scheme counters, attacker snapshots and retired villain views own no cards. */
function scenarioPhysicalPieces(s: GameState): Piece[] {
  if (!["mansion_attack", "magneto"].includes(s.villainId)) return [];
  const m = s.mansionAttack;
  const g = s.magneto;
  const pieces: Piece[] = [];
  const visit = (p: Piece) => {
    pieces.push(p);
    for (const child of [
      ...(p.storedCards || []),
      ...(p.captured || []),
      ...(p.inheritorBoosts || []),
      ...(p.droneCard ? [p.droneCard] : []),
    ])
      visit(child);
  };
  [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.spdrIdentity ? [p.spdrIdentity] : []),
        ...(p.setAside || []),
        ...(p.invocationDeck || []),
        ...(p.invocationDiscard || []),
      ];
    }),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...((s.encounter as GameState["encounter"] & { setAside?: Piece[] })
      .setAside || []),
    ...(m?.activeVillainRetired ? [] : [s.villain]),
    ...(m?.villainDeck || g?.villainDeck || []),
    ...(m?.mainDeck || g?.mainDeck || []),
    ...(m?.currentMain
      ? [m.currentMain]
      : g?.currentMain
        ? [g.currentMain]
        : []),
    ...(g?.orbital ? [g.orbital] : []),
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.victoryDisplay || []),
    ...s.resolving,
    ...s.removed,
  ].forEach(visit);
  // These callbacks own suspended activations while a native nested activation
  // runs. Attacker snapshots and arbitrary effect payloads are not card zones.
  const activation = (a: GameState["attack"] | GameState["scheming"]) => {
    if (!a) return;
    (a.pendingBoosts || []).forEach(visit);
    continuation(a.activationAfter);
  };
  const continuation = (e?: GameState["queue"][number]) => {
    if (!e) return;
    if (/native:activation-finish$/.test(e.type)) {
      activation(e.outerAttack);
      activation(e.outerScheme);
    }
    if (Array.isArray(e.after)) e.after.forEach(continuation);
  };
  activation(s.attack);
  activation(s.scheming);
  s.queue.forEach(continuation);
  return pieces;
}

function runMission(config: (typeof missions)[number]) {
  const hero = HEROES.find((h) => h.id === config.heroId)!;
  const deck = CATALOG_HEROES.find((h) => h.id === hero.id)!.decks.find(
    (d) => d.sourceType !== "app-starter",
  )!;
  const codes = catalogDeckCodes(deck),
    aspect = (
      deck.aspect === "multi" ? heroStarterAspects(hero.id)[0] : deck.aspect
    ) as Aspect;
  expect(deckErrors(hero.id, aspect, codes)).toEqual([]);
  expect(deckSizeFor(codes)).toBe(deck.deckSize ?? 40);
  let s = newGame({
    ...config,
    aspect,
    pacing: "expert",
    heroes: [{ heroId: hero.id, aspect, deckCards: codes }],
  });
  const initial = [
    ...s.player.hand,
    ...s.player.deck,
    ...s.player.inPlay.filter(
      (p) => isPermanent(card(p)) && codes.includes(p.code),
    ),
    ...(s.player.setAside || []).filter((p) => codes.includes(p.code)),
    ...s.sideSchemes
      .flatMap((p) => p.captured || [])
      .filter((p) => p.ownerId === s.activePlayerId && codes.includes(p.code)),
  ];
  expect(initial.map((p) => p.code).sort()).toEqual([...codes].sort());
  const supplementary = [
    ...(s.player.invocationDeck || []),
    ...(s.player.invocationDiscard || []),
    ...[...s.player.inPlay, ...(s.player.setAside || [])].filter(
      (p) =>
        !codes.includes(p.code) &&
        Object.hasOwn(heroSupplementaryCards(hero.id), p.code),
    ),
  ];
  const identities = s.player.spdrIdentity
    ? [
        s.player.spdrIdentity,
        ...s.player.inPlay.filter(
          (p) => p.id === s.player.spdrSuitId || p.id === s.player.spdrPilotId,
        ),
      ]
    : [];
  if (hero.id === "spdr") {
    expect(identities).toHaveLength(2);
    expect(identities.map((p) => p.id).sort()).toEqual(
      [s.player.spdrSuitId, s.player.spdrPilotId].sort(),
    );
  }
  const total = codes.length + supplementary.length + identities.length;
  const originalIds = new Set(
    [...initial, ...supplementary, ...identities].map((p) => p.id),
  );
  expect(originalIds.size, "Original physical source IDs are distinct").toBe(
    total,
  );
  const scenarioSet =
    s.villainId === "mansion_attack"
      ? "mansion_attack"
      : s.villainId === "magneto"
        ? "magneto_villain"
        : undefined;
  const scenarioSources = scenarioSet
    ? scenarioPhysicalPieces(s).filter((p) => card(p).set_code === scenarioSet)
    : [];
  const scenarioIds = scenarioSources.map((p) => p.id).sort();
  const scenarioCodeFamily = new Map(
    scenarioSources.map((p) => [p.id, p.code.replace(/[ab]$/, "")]),
  );
  if (scenarioSet) {
    const expected = scenarioSet === "mansion_attack" ? 25 : 29;
    expect(
      scenarioSources,
      "All selected original scenario cards begin in physical zones",
    ).toHaveLength(expected);
    expect(new Set(scenarioIds).size).toBe(expected);
  }
  const trace: string[] = [];
  let commands = 0;
  const audit = () => {
    const pieces = ownedPieces(s, originalIds);
    expect(
      pieces.length,
      `Physical source-composition invariant after ${trace.at(-1)}`,
    ).toBe(total);
    expect(
      new Set(pieces.map((p) => p.id)).size,
      "No duplicated physical player cards",
    ).toBe(total);
    // ownedPieces admits only original IDs. Equal total and distinct counts
    // therefore prove every original instance occurs exactly once.
    if (scenarioSet) {
      const actual = scenarioPhysicalPieces(s).filter(
        (p) => card(p).set_code === scenarioSet,
      );
      expect(
        actual.map((p) => p.id).sort(),
        `all original ${scenarioSet} source IDs after ${trace.at(-1)}`,
      ).toEqual(scenarioIds);
      for (const p of actual)
        expect(
          p.code.replace(/[ab]$/, ""),
          `same original double-sided source ${p.id}`,
        ).toBe(scenarioCodeFamily.get(p.id));
    }
  };
  const send = (command: Command) => {
    trace.push(
      `${s.round}:${s.phase}:${s.prompt?.title || "action"}:${JSON.stringify(command)}`,
    );
    if (trace.length > 16) trace.shift();
    const next = dispatch(s, command);
    if (next.error) throw Error(`${next.error}\n${trace.join("\n")}`);
    s = next;
    commands++;
    audit();
  };
  const settle = () => {
    for (let n = 0; !ended(s) && (s.review || s.prompt); n++) {
      if (n > 250) throw Error(`Decision loop\n${trace.join("\n")}`);
      if (s.review) {
        send({ type: "PROCEED" });
        continue;
      }
      const prompt = s.prompt!;
      const optionalYes =
        prompt.kind === "choice" && prompt.options.find((o) => o.id === "yes");
      const advice = optionalYes
        ? { command: { type: "CHOOSE", id: optionalYes.id } as Command }
        : advisePrompt(s);
      if (!advice)
        throw Error(`No legal answer for ${prompt.title}\n${trace.join("\n")}`);
      send(advice.command);
    }
    if (!ended(s)) {
      expect(s.phase).toBe("player");
      expect(s.queue).toHaveLength(0);
      expect(s.review).toBeNull();
      expect(s.prompt).toBeNull();
      for (const piece of s.player.inPlay)
        expect(
          uniqueConflict(s, card(piece), piece.id),
          `No matching unique cards in play: ${card(piece).name}`,
        ).toBe(false);
    }
  };
  const act = (command: Command) => {
    send(command);
    settle();
  };
  act({ type: "MULLIGAN", ids: [] });
  for (let round = 0; round < 60 && !ended(s); round++) {
    if (s.player.form === "alter") {
      if (
        s.player.hp < maxHP(s) &&
        !s.player.exhausted &&
        !magnetoIdentityRestricted(s, s.activePlayerId, { isTextBlank })
      )
        act({ type: "BASIC", action: "recover" });
      const identity = [
        ...nativeHeroAbilityOptions(s),
        ...doctorStrangeAbilityOptions(s, "identity"),
        ...hulkAbilityOptions(s, "identity"),
        ...thorAbilityOptions(s, "identity"),
        ...msMarvelAbilityOptions(s, "identity"),
      ][0];
      if (identity)
        act({ type: "ABILITY", id: "identity", action: identity.id });
      if (ended(s)) break;
      if (!s.player.flipped && canChangeIdentityForm(s)) act({ type: "FLIP" });
    }
    for (let actions = 0; actions < 8 && !ended(s); actions++) {
      const next = [...s.player.hand, ...hawkeyeStoredPlayable(s)]
        .filter((p) => playable(s, p) === null)
        .sort((a, b) => {
          const value = (p: Piece) =>
            card(p).type_code === "event"
              ? 3
              : card(p).type_code === "ally"
                ? 2
                : 1;
          return value(b) - value(a);
        })[0];
      if (!next) break;
      act({ type: "PLAY", id: next.id });
    }
    if (ended(s)) break;
    for (const piece of [...s.player.inPlay]) {
      if (ended(s)) break;
      const current = s.player.inPlay.find((p) => p.id === piece.id);
      if (!current || current.exhausted) continue;
      const options = abilityOptions(s, current).filter((o) => !o.disabled);
      const urgent = s.scheme.threat >= 3 || !!s.sideSchemes.length;
      const option =
        card(current).type_code === "ally"
          ? options.find(
              (o) =>
                o.id ===
                (urgent && (card(current).thwart || 0) > 0
                  ? "thwart"
                  : "attack"),
            )
          : options.find((o) => o.id !== "attack" && o.id !== "thwart");
      if (option) act({ type: "ABILITY", id: current.id, action: option.id });
    }
    if (ended(s)) break;
    const strangeSpell = doctorStrangeAbilityOptions(s, "identity").find(
      (o) => o.id === "spell",
    );
    if (strangeSpell)
      act({ type: "ABILITY", id: "identity", action: strangeSpell.id });
    if (ended(s)) break;
    if (!visionCanAttack(s)) {
      const density = nativeHeroAbilityOptions(s).find(
        (o) => o.id === "density",
      );
      if (density) act({ type: "ABILITY", id: "identity", action: density.id });
    }
    const basic = () => {
      if (
        s.player.exhausted ||
        s.player.form !== "hero" ||
        magnetoIdentityRestricted(s, s.activePlayerId, { isTextBlank })
      )
        return;
      const canThwart =
        !captainThwartBlocked(s) &&
        ((!!targets(s, "scheme").length && heroStats(s).thwart > 0) ||
          s.player.confused);
      const urgent = s.scheme.threat >= 3 || !!s.sideSchemes.length;
      const canAttack =
        visionCanAttack(s) &&
        cyclopsCanAttack(s) &&
        !valkyrieCannotBasicAttack(s);
      if (!canAttack && !canThwart) return;
      act({
        type: "BASIC",
        action: (urgent || !canAttack) && canThwart ? "thwart" : "attack",
      });
    };
    basic();
    if (ended(s)) break;
    const ready = captainAbilityOptions(s, "identity")[0];
    if (ready) {
      act({ type: "ABILITY", id: "identity", action: ready.id });
      if (!ended(s)) basic();
    }
    if (ended(s)) break;
    if (s.player.hp <= 3 && !s.player.flipped && canChangeIdentityForm(s))
      act({ type: "FLIP" });
    if (ended(s)) break;
    act({ type: "END_TURN", discard: s.player.hand.map((p) => p.id) });
  }
  expect(
    ended(s),
    `Mission must terminate within60 turns (${config.seed}); last actions\n${trace.join("\n")}`,
  ).toBe(true);
  expect(commands).toBeLessThan(5000);
  audit();
}

describe("published expansion starters across every supported mission setting", () => {
  it("covers every imported expansion hero, scenario, difficulty and supported encounter module", () => {
    expect(missions).toHaveLength(
      heroIds.length *
        2 *
        VILLAINS.reduce(
          (n, scenario) => n + scenarioModules(scenario.id).length,
          0,
        ),
    );
    expect(VILLAINS).toHaveLength(10);
    expect(MODULES).toHaveLength(20);
    expect(heroIds).toHaveLength(36);
    expect(missions).toHaveLength(14184);
    const key = (mission: (typeof missions)[number]) =>
      [
        mission.heroId,
        mission.villainId,
        mission.difficulty,
        mission.module,
      ].join("/");
    const manifest = (list: typeof missions) =>
      list.map((mission) => `${key(mission)} seed${mission.seed}`).sort();
    const combined = partitions.flat();
    // New heroes and modular sets extend the published mission grid without
    // changing the names or seeded shuffles of the 11,328 prior missions.
    const retained = missions.filter(
      (mission) =>
        heroIds.indexOf(mission.heroId) < 32 &&
        !["deathstrike", "shadow_king"].includes(mission.module),
    );
    expect(retained).toHaveLength(11328);
    expect(
      createHash("sha256").update(manifest(retained).join("\n")).digest("hex"),
    ).toBe("8639244ce44d6832c10f3f51edb418a1435a42fa862f629f47a62b4016e519a0");
    expect(new Set(missions.map(key)).size).toBe(14184);
    expect(new Set(combined.map(key)).size).toBe(14184);
    expect(manifest(combined)).toEqual(manifest(missions));
    for (const partition of partitions) {
      expect(partition).toHaveLength(3546);
      expect(new Set(partition.map((mission) => mission.heroId)).size).toBe(9);
    }
    expect(selectedMissions).toHaveLength(isSharded ? 3546 : 14184);
  });
  for (const mission of selectedMissions)
    it(
      `${mission.heroId}/${mission.villainId}/${mission.difficulty}/${mission.module} seed${mission.seed}`,
      () => runMission(mission),
      30000,
    );
});
