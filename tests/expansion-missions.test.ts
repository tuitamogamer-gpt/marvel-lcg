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
  DB,
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
  canPay,
} from "../src/game/engine";
import { advisePrompt } from "../src/game/advisor";
import {
  captainAbilityOptions,
  captainThwartBlocked,
} from "../src/game/captain-america";
import { hulkAbilityOptions } from "../src/game/hulk";
import { magikTopPlayable } from "../src/game/magik";
import { uniqueConflict } from "../src/game/unique";
import {
  heroStarterAspects,
  heroSupplementaryCards,
  isPermanent,
} from "../src/game/hero-runtime";
import { deckSizeFor } from "../src/game/decks";
import { seatView } from "../src/game/team";
import { crewBench, crewStoredPieces } from "../src/game/wrecking-crew";
import { horsemenBench } from "../src/game/four-horsemen";
import { waspBasicAttackCost } from "../src/game/wasp";
import { kangStoredPieces } from "../src/game/kang";
import { STUN_NET, stunNetted } from "../src/game/black-widow-villain";
import { venomStoredPieces } from "../src/game/venom-villain";
import type { Aspect, Command, GameState, Piece } from "../src/game/types";

const ended = (s: GameState) => ["won", "lost"].includes(s.phase);
// A declared front/back link owns one physical card. Lettered alternate
// printings, such as Jubilee's three resource variants, remain distinct.
const physicalFaces = new Map<string, Set<string>>();
for (const definition of Object.values(DB)) {
  if (!definition.back_link) continue;
  const faces = new Set([
    definition.code,
    definition.back_link,
    ...(physicalFaces.get(definition.code) || []),
    ...(physicalFaces.get(definition.back_link) || []),
  ]);
  for (const code of faces) physicalFaces.set(code, faces);
}
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
  "gambit",
  "rogue",
  "psylocke",
  "angel",
  "cable",
  "domino",
  "x23",
  "deadpool",
  "bishop",
  "magik",
  "iceman",
  "jubilee",
  "nightcrawler",
  "magneto",
  "maria_hill",
  "nick_fury",
];
interface MissionConfig {
  heroId: string;
  villainId: string;
  difficulty: "standard" | "expert";
  module: string;
  seed: number;
  /** The Hood scenario pack's Standard II and Expert II encounter sets, Age
   * of Apocalypse's Standard III with the core Expert set, or Agents of
   * S.H.I.E.L.D.'s Executive Board added to the scenario. */
  variant?: "ii" | "iii" | "board";
}
const grid: MissionConfig[] = heroIds.flatMap((heroId, hi) =>
  VILLAINS.flatMap((scenario, vi) =>
    (["standard", "expert"] as const).flatMap((difficulty, di) =>
      // The Wrecking Crew and The Sinister Six use no modular sets: one
      // configuration.
      (scenario.moduleCount === 0
        ? [{ id: "none" }]
        : scenarioModules(scenario.id)
      ).map((module, mi) => ({
        heroId,
        villainId: scenario.id,
        difficulty,
        module: module.id,
        seed: 9000 + hi * 1000 + vi * 100 + di * 10 + mi,
      })),
    ),
  ),
);
// Standard II replaces the core Standard set (and Expert II the Expert set
// in Expert) in every scenario that uses them, with its recommended module.
const alternativeSets: MissionConfig[] = heroIds.flatMap((heroId, hi) =>
  VILLAINS.filter((scenario) => scenario.moduleCount !== 0).flatMap(
    (scenario, vi) =>
      (["standard", "expert"] as const).map((difficulty, di) => ({
        heroId,
        villainId: scenario.id,
        difficulty,
        // The Hood's configurations keep the recommended set they were named
        // with before the pack's own modular sets were imported.
        module: scenario.id === "the_hood" ? "bomb_scare" : scenario.module,
        seed: 600000 + hi * 1000 + vi * 10 + di,
        variant: "ii" as const,
      })),
  ),
);
// Age of Apocalypse's Standard III replaces the core Standard set (the
// Expert set stays) in every scenario that uses it, with its recommended
// module.
const standardIIISets: MissionConfig[] = heroIds.flatMap((heroId, hi) =>
  VILLAINS.filter((scenario) => scenario.moduleCount !== 0).flatMap(
    (scenario, vi) =>
      (["standard", "expert"] as const).map((difficulty, di) => ({
        heroId,
        villainId: scenario.id,
        difficulty,
        module: scenario.id === "the_hood" ? "bomb_scare" : scenario.module,
        seed: 700000 + hi * 1000 + vi * 10 + di,
        variant: "iii" as const,
      })),
  ),
);
// Agents of S.H.I.E.L.D.'s Executive Board joins every other scenario with
// modular sets without counting as one, with its recommended module.
const executiveBoardSets: MissionConfig[] = heroIds.flatMap((heroId, hi) =>
  VILLAINS.filter(
    (scenario) => scenario.moduleCount !== 0 && scenario.id !== "baron_zemo",
  ).flatMap((scenario, vi) =>
    (["standard", "expert"] as const).map((difficulty, di) => ({
      heroId,
      villainId: scenario.id,
      difficulty,
      module: scenario.id === "the_hood" ? "bomb_scare" : scenario.module,
      seed: 800000 + hi * 1000 + vi * 10 + di,
      variant: "board" as const,
    })),
  ),
);
const missions = [
  ...grid,
  ...alternativeSets,
  ...standardIIISets,
  ...executiveBoardSets,
];

// Build the complete grid before partitioning so every existing configuration
// keeps the original global hero/scenario/module indexes and seeded shuffle.
const shardIndex = process.env.MISSION_SHARD_INDEX;
const shardCount = process.env.MISSION_SHARD_COUNT;
const missionShardCount = 16;
const isSharded = shardIndex !== undefined || shardCount !== undefined;
if (
  isSharded &&
  (shardCount !== String(missionShardCount) ||
    !/^(\d|1[0-5])$/.test(shardIndex ?? ""))
)
  throw Error(
    "Set both MISSION_SHARD_COUNT=16 and MISSION_SHARD_INDEX=0..15, or neither.",
  );
// Round-robin individual configurations, not whole heroes: every runner gets
// all identities, spreading their different simulation costs across shards.
const partitions = Array.from({ length: missionShardCount }, (_, index) =>
  missions.filter(
    (_, missionIndex) => missionIndex % missionShardCount === index,
  ),
);
// Exercise the newest imports first without changing any mission's original
// seed or shard membership, so integration failures surface early in CI.
const selectedMissions = [
  ...(isSharded ? partitions[Number(shardIndex)] : missions),
].sort((a, b) => heroIds.indexOf(b.heroId) - heroIds.indexOf(a.heroId));

/** Only physical-zone auditing inspects hidden card IDs. The player strategy
 * uses hand cards, visible board state, and the same public prompts as the UI. */
function ownedPieces(s: GameState, originalIds?: Set<string>): Piece[] {
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
    ...((s as GameState & { deadpool?: { poolSetAside: Piece[] } }).deadpool
      ?.poolSetAside || []),
    ...(s.encounter.storedBoosts || []),
    ...(s.crossbones?.weaponDeck || []),
    ...(s.taskmaster?.captives || []),
    ...(s.redSkull?.sideDeck || []),
    ...(s.redSkull?.sideDiscard || []),
    ...(s.redSkull?.sleeper ? [s.redSkull.sleeper] : []),
    ...(s.collector?.collection || []),
    ...(s.escape?.setAside || []),
    // Across the Mojoverse: the show deck.
    ...(s.spiral?.showDeck || []),
    // MojoMania: the set-aside modular sets.
    ...(s.mojo?.setAside.flatMap((group) => group.pieces) || []),
    // Morlock Siege: the villain deck, the villains under Routed and the
    // set-aside Morlocks and Hide!.
    ...(s.morlockSiege?.villainDeck || []),
    ...(s.morlockSiege?.routed || []),
    ...(s.morlockSiege?.setAside || []),
    // Mister Sinister: the set-aside superpower sets.
    ...(s.sinister?.setAside.flatMap((group) => group.pieces) || []),
    // Apocalypse: the set-aside Prelates and The Tyrant's Throne.
    ...(s.apocalypse?.prelates || []),
    ...(s.apocalypse?.throne ? [s.apocalypse.throne] : []),
    // Dark Beast: the set-aside Savage Land, Genosha and Blue Moon sets.
    ...(s.darkBeast?.setAside.flatMap((group) => group.pieces) || []),
    // The Wrecking Crew: the encounter decks of the villains not active.
    ...crewStoredPieces(s),
    // Kang: the game areas out of focus and the set-aside scenario cards.
    ...kangStoredPieces(s),
    // Venom: the facedown boost cards on each identity.
    ...venomStoredPieces(s),
    ...((s.encounter as GameState["encounter"] & { setAside?: Piece[] })
      .setAside || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
    s.villain,
    ...s.minions,
    ...s.sideSchemes,
    ...(s.victoryDisplay || []),
    ...s.attachments,
    ...(s.environments || []),
    // The S.H.I.E.L.D. Executive Board: the board members who joined the
    // villain.
    ...(s.executiveBoard?.joined || []),
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
  return originalIds ? pieces.filter((p) => originalIds.has(p.id)) : pieces;
}

/** Native scenario piles own original main/villain/progress cards. Public
 * scheme counters, attacker snapshots and retired villain views own no cards. */
function scenarioPhysicalPieces(s: GameState): Piece[] {
  if (
    ![
      "mansion_attack",
      "magneto",
      "crossbones",
      "absorbing_man",
      "taskmaster",
      "zola",
      "red_skull",
      "brotherhood_of_badoon",
      "infiltrate_the_museum",
      "escape_the_museum",
      "nebula",
      "ronan",
      "ebony_maw",
      "tower_defense",
      "thanos",
      "hela",
      "loki",
      "the_wrecking_crew",
      "kang",
      "the_hood",
    ].includes(s.villainId)
  )
    return [];
  const m = s.mansionAttack;
  const g = s.magneto;
  const c = s.crossbones;
  const a = s.absorbingMan;
  const t = s.taskmaster;
  const z = s.zola;
  const r = s.redSkull;
  const b = s.badoon;
  const k = s.collector;
  const x = s.escape;
  const n = s.nebulaVillain;
  const o = s.ronan;
  const e = s.ebonyMaw;
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
    ...((s as GameState & { deadpool?: { poolSetAside: Piece[] } }).deadpool
      ?.poolSetAside || []),
    ...(s.encounter.storedBoosts || []),
    ...(s.crossbones?.weaponDeck || []),
    ...(s.taskmaster?.captives || []),
    ...(s.redSkull?.sideDeck || []),
    ...(s.redSkull?.sideDiscard || []),
    ...(s.redSkull?.sleeper ? [s.redSkull.sleeper] : []),
    ...(k?.collection || []),
    ...(x?.setAside || []),
    ...((s.encounter as GameState["encounter"] & { setAside?: Piece[] })
      .setAside || []),
    ...(m?.activeVillainRetired ? [] : [s.villain]),
    // Hela: the set-aside Journey Through Hel cards.
    ...(s.hela?.setAside || []),
    // The Wrecking Crew: the villains out of focus and the encounter decks
    // of the villains who are not active.
    ...(s.wreckingCrew ? [...crewBench(s), ...crewStoredPieces(s)] : []),
    // Four Horsemen: the Horsemen out of focus.
    ...horsemenBench(s),
    // Kang: the main schemes, the set-aside villains and Kang's Dominions,
    // and the game areas out of focus.
    ...kangStoredPieces(s),
    // The Hood: the main scheme cards, the next villain and the set-aside
    // modular sets.
    ...(s.hood
      ? [
          s.hood.currentMain,
          ...s.hood.mainDeck,
          ...s.hood.villainDeck,
          ...s.hood.setAside,
        ]
      : []),
    // Loki: the set-aside Lokis and the Infinity Stone deck.
    ...(s.loki
      ? [...s.loki.setAside, ...s.loki.stoneDeck, ...s.loki.stoneDiscard]
      : []),
    // Thanos: his stages, main schemes and the Infinity Stone deck.
    ...(s.thanos
      ? [
          s.thanos.currentMain,
          ...s.thanos.mainDeck,
          ...s.thanos.villainDeck,
          ...s.thanos.stoneDeck,
          ...s.thanos.stoneDiscard,
        ]
      : []),
    // Tower Defense: the villain out of focus, both villains' remaining
    // stages and both physical main schemes.
    ...(s.towerDefense
      ? [
          s.towerDefense.other.villain,
          ...s.towerDefense.villainDecks.proxima,
          ...s.towerDefense.villainDecks.corvus,
          s.towerDefense.mains.proxima,
          s.towerDefense.mains.corvus,
        ]
      : []),
    ...(m?.villainDeck ||
      g?.villainDeck ||
      c?.villainDeck ||
      a?.villainDeck ||
      t?.villainDeck ||
      z?.villainDeck ||
      r?.villainDeck ||
      b?.villainDeck ||
      k?.villainDeck ||
      n?.villainDeck ||
      o?.villainDeck ||
      e?.villainDeck ||
      []),
    ...(m?.mainDeck ||
      g?.mainDeck ||
      c?.mainDeck ||
      z?.mainDeck ||
      r?.mainDeck ||
      b?.mainDeck ||
      x?.mainDeck ||
      n?.mainDeck ||
      o?.mainDeck ||
      e?.mainDeck ||
      []),
    ...(m?.currentMain
      ? [m.currentMain]
      : g?.currentMain
        ? [g.currentMain]
        : c?.currentMain
          ? [c.currentMain]
          : a?.currentMain
            ? [a.currentMain]
            : t?.currentMain
              ? [t.currentMain]
              : z?.currentMain
                ? [z.currentMain]
                : r?.currentMain
                  ? [r.currentMain]
                  : b?.currentMain
                    ? [b.currentMain]
                    : k?.currentMain
                      ? [k.currentMain]
                      : x?.currentMain
                        ? [x.currentMain]
                        : n?.currentMain
                          ? [n.currentMain]
                          : o?.currentMain
                            ? [o.currentMain]
                            : e?.currentMain
                              ? [e.currentMain]
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
  const physicalSourceCounts: Record<string, number> = {
    gambit: 40,
    rogue: 41,
    psylocke: 42,
    angel: 40,
    cable: 40,
    domino: 40,
    x23: 41,
    deadpool: 40,
    bishop: 40,
    magik: 40,
    iceman: 40,
    jubilee: 40,
    nightcrawler: 40,
    magneto: 40,
    maria_hill: 40,
    nick_fury: 41,
  };
  if (Object.hasOwn(physicalSourceCounts, hero.id)) {
    expect(codes).toHaveLength(physicalSourceCounts[hero.id]);
    expect(deckSizeFor(codes)).toBe(hero.id === "rogue" ? 41 : 40);
  }
  const { variant, ...setup } = config;
  let s = newGame({
    ...setup,
    aspect,
    pacing: "expert",
    heroes: [{ heroId: hero.id, aspect, deckCards: codes }],
    ...(variant === "ii"
      ? { standardII: true, expertII: true }
      : variant === "iii"
        ? { standardIII: true }
        : variant === "board"
          ? { executiveBoard: true }
          : {}),
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
    // The Grand Collection's setup puts each player's top card into The Collection.
    ...(s.collector?.collection || []).filter(
      (p) => p.ownerId === s.activePlayerId && codes.includes(p.code),
    ),
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
  expect(
    supplementary.map((p) => p.code).sort(),
    "All original supplementary cards begin in physical zones",
  ).toEqual(
    Object.entries(heroSupplementaryCards(hero.id))
      .flatMap(([code, count]) => Array(count).fill(code))
      .sort(),
  );
  if (hero.id === "spdr") {
    expect(identities).toHaveLength(2);
    expect(identities.map((p) => p.id).sort()).toEqual(
      [s.player.spdrSuitId, s.player.spdrPilotId].sort(),
    );
  }
  // Scenario setup can already deal or discard Crisis before the mulligan.
  // Capture all seven actual dependency IDs from the full physical zones.
  const poolDependency = ownedPieces(s).filter(
    (p) => Number(p.code) >= 44037 && Number(p.code) <= 44042,
  );
  expect(poolDependency).toHaveLength(aspect === "pool" ? 7 : 0);
  const total =
    codes.length +
    supplementary.length +
    identities.length +
    poolDependency.length;
  const originalIds = new Set(
    [...initial, ...supplementary, ...identities, ...poolDependency].map(
      (p) => p.id,
    ),
  );
  const originalFaces = new Map(
    [...initial, ...supplementary, ...identities, ...poolDependency].map(
      (p) => [p.id, physicalFaces.get(p.code) || new Set([p.code])],
    ),
  );
  expect(originalIds.size, "Original physical source IDs are distinct").toBe(
    total,
  );
  const scenarioSet =
    s.villainId === "mansion_attack"
      ? "mansion_attack"
      : s.villainId === "magneto"
        ? "magneto_villain"
        : s.villainId === "crossbones"
          ? "crossbones"
          : s.villainId === "absorbing_man"
            ? "absorbing_man"
            : s.villainId === "taskmaster"
              ? "taskmaster"
              : s.villainId === "zola"
                ? "zola"
                : s.villainId === "red_skull"
                  ? "red_skull"
                  : s.villainId === "brotherhood_of_badoon"
                    ? "brotherhood_of_badoon"
                    : s.villainId === "infiltrate_the_museum"
                      ? "infiltrate_the_museum"
                      : s.villainId === "escape_the_museum"
                        ? "escape_the_museum"
                        : s.villainId === "nebula"
                          ? "nebula"
                          : s.villainId === "ronan"
                            ? "ronan"
                            : s.villainId === "ebony_maw"
                              ? "ebony_maw"
                              : s.villainId === "tower_defense"
                                ? "tower_defense"
                                : s.villainId === "thanos"
                                  ? "thanos"
                                  : s.villainId === "hela"
                                    ? "hela"
                                    : s.villainId === "loki"
                                      ? "loki"
                                      : s.villainId === "the_wrecking_crew"
                                        ? "the_wrecking_crew"
                                        : s.villainId === "kang"
                                          ? "kang"
                                          : s.villainId === "the_hood"
                                            ? "the_hood"
                                            : undefined;
  // The Wrecking Crew's cards span five sets: every card of its pack.
  const scenarioSources = scenarioSet
    ? scenarioPhysicalPieces(s).filter((p) =>
        scenarioSet === "the_wrecking_crew"
          ? card(p).pack_code === "twc"
          : scenarioSet === "kang"
            ? ["kang", "exp_kang"].includes(card(p).set_code || "")
            : card(p).set_code === scenarioSet,
      )
    : [];
  const scenarioIds = scenarioSources.map((p) => p.id).sort();
  const scenarioCodeFamily = new Map(
    scenarioSources.map((p) => [p.id, p.code.replace(/[ab]$/, "")]),
  );
  if (scenarioSet) {
    const expected =
      scenarioSet === "mansion_attack"
        ? 25
        : scenarioSet === "crossbones"
          ? 18
          : scenarioSet === "absorbing_man"
            ? 24
            : scenarioSet === "taskmaster"
              ? 22
              : scenarioSet === "zola"
                ? 30
                : scenarioSet === "red_skull"
                  ? 27
                  : scenarioSet === "brotherhood_of_badoon"
                    ? 12
                    : scenarioSet === "infiltrate_the_museum"
                      ? 12
                      : scenarioSet === "escape_the_museum"
                        ? 11
                        : scenarioSet === "nebula"
                          ? 21
                          : scenarioSet === "ronan"
                            ? 19
                            : scenarioSet === "ebony_maw"
                              ? 21
                              : scenarioSet === "tower_defense"
                                ? 25
                                : scenarioSet === "thanos"
                                  ? 18
                                  : scenarioSet === "hela"
                                    ? 17
                                    : scenarioSet === "loki"
                                      ? 20
                                      : scenarioSet === "the_wrecking_crew"
                                        ? 68
                                        : scenarioSet === "kang"
                                          ? 43
                                          : scenarioSet === "the_hood"
                                            ? 15
                                            : 29;
    expect(
      scenarioSources,
      "All selected original scenario cards begin in physical zones",
    ).toHaveLength(expected);
    expect(new Set(scenarioIds).size).toBe(expected);
  }
  const weaponSources =
    s.villainId === "crossbones"
      ? scenarioPhysicalPieces(s).filter(
          (p) => card(p).set_code === "exper_weapon",
        )
      : [];
  const weaponIds = weaponSources.map((p) => p.id).sort();
  if (s.villainId === "crossbones") {
    expect(weaponSources.map((p) => p.code).sort()).toEqual([
      "04072",
      "04073",
      "04074",
      "04075",
    ]);
    expect(new Set(weaponIds).size).toBe(4);
    expect(s.modules).toHaveLength(3);
    expect(new Set(s.modules).size).toBe(3);
    expect(s.modules).not.toContain("exper_weapon");
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
    expect(
      pieces
        .filter((p) => !originalFaces.get(p.id)?.has(p.code))
        .map((p) => ({ id: p.id, code: p.code })),
      `Every original printing or its linked reverse after ${trace.at(-1)}`,
    ).toEqual([]);
    if (s.villainId === "crossbones")
      expect(
        scenarioPhysicalPieces(s)
          .filter((p) => card(p).set_code === "exper_weapon")
          .map((p) => p.id)
          .sort(),
        `all four original Experimental Weapons after ${trace.at(-1)}`,
      ).toEqual(weaponIds);
    // ownedPieces admits only original IDs. Equal total and distinct counts
    // therefore prove every original instance occurs exactly once.
    if (scenarioSet) {
      const actual = scenarioPhysicalPieces(s).filter((p) =>
        scenarioSet === "the_wrecking_crew"
          ? card(p).pack_code === "twc"
          : scenarioSet === "kang"
            ? ["kang", "exp_kang"].includes(card(p).set_code || "")
            : card(p).set_code === scenarioSet,
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
      // A recover can end the mission, e.g. Superpower Feedback's damage.
      if (ended(s)) break;
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
      const top = magikTopPlayable(s);
      const next = [
        ...s.player.hand,
        ...hawkeyeStoredPlayable(s),
        ...(top ? [top] : []),
      ]
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
    // Black Widow's Stun Net: a ready ally is exhausted to free the identity.
    const net = s.attachments.find(
      (a) => a.code === STUN_NET && a.attachedTo === `hero:${s.activePlayerId}`,
    );
    const free =
      net && abilityOptions(s, net).find((o) => o.id.startsWith("discard:"));
    if (net && free && !free.disabled)
      act({ type: "ABILITY", id: net.id, action: free.id });
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
      // Kang leaves no villain in play between his stages.
      const canAttack =
        visionCanAttack(s) &&
        cyclopsCanAttack(s) &&
        !valkyrieCannotBasicAttack(s) &&
        !stunNetted(s, `hero:${s.activePlayerId}`) &&
        // Mother's Orders adds a resource to a basic attack's cost.
        canPay(s, waspBasicAttackCost(s)) &&
        (s.player.stunned || !!targets(s, "enemy", true).length);
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
    expect(grid).toHaveLength(
      heroIds.length *
        2 *
        VILLAINS.reduce(
          (n, scenario) =>
            n +
            (scenario.moduleCount === 0
              ? 1
              : scenarioModules(scenario.id).length),
          0,
        ),
    );
    expect(alternativeSets).toHaveLength(
      heroIds.length *
        2 *
        VILLAINS.filter((scenario) => scenario.moduleCount !== 0).length,
    );
    expect(standardIIISets).toHaveLength(alternativeSets.length);
    expect(executiveBoardSets).toHaveLength(
      alternativeSets.length - heroIds.length * 2,
    );
    expect(VILLAINS).toHaveLength(53);
    expect(MODULES).toHaveLength(96);
    expect(heroIds).toHaveLength(52);
    expect(missions).toHaveLength(514384);
    const redSkullModules = ["hydra_assault", "weap_master", "hydra_patrol"];
    const key = (mission: (typeof missions)[number]) =>
      [
        mission.heroId,
        mission.villainId,
        mission.difficulty,
        mission.module,
        ...(mission.variant ? [mission.variant] : []),
      ].join("/");
    const manifest = (list: typeof missions) =>
      list.map((mission) => `${key(mission)} seed${mission.seed}`).sort();
    // Trickster Takeover's God of Lies joins as the fifty-third scenario, in
    // Single Group Mode, with every modular set as its one. Every earlier
    // name and seed stays in place: the 504,088 configurations before it
    // hash identically to the complete grid of 915d939.
    expect(missions.filter((m) => m.villainId === "god_of_lies")).toHaveLength(
      52 * 2 * 96 + 52 * 2 * 3,
    );
    const enchantressGrid = missions.filter(
      (m) => m.villainId !== "god_of_lies",
    );
    expect(enchantressGrid).toHaveLength(504088);
    expect(
      createHash("sha256")
        .update(manifest(enchantressGrid).join("\n"))
        .digest("hex"),
    ).toBe("7f2ccfb4e681f3cea43f05e47db0e374de90d155c5133bc8224c82c3912584cd");
    // Trickster Takeover's Enchantress joined as the fifty-second scenario
    // before that, with every modular set as her one, and the Trickster
    // Magic modular set joined every other scenario with modular sets: the
    // 488,800 configurations before them hash identically to the complete
    // grid of 80a3be9.
    expect(
      enchantressGrid.filter((m) => m.villainId === "enchantress_villain"),
    ).toHaveLength(52 * 2 * 96 + 52 * 2 * 3);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        !["thunderbolts", "enchantress_villain", "god_of_lies"].includes(v.id),
    ))
      expect(
        enchantressGrid.filter(
          (m) => m.villainId === scenario.id && m.module === "trickster_magic",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const zemoGrid = enchantressGrid.filter(
      (m) =>
        m.villainId !== "enchantress_villain" && m.module !== "trickster_magic",
    );
    expect(zemoGrid).toHaveLength(488800);
    expect(
      createHash("sha256").update(manifest(zemoGrid).join("\n")).digest("hex"),
    ).toBe("3e39e7a9f698414f96d5df4c2df2998877569438270846a8cd21fb83a91f7b21");
    // Agents of S.H.I.E.L.D.'s Baron Zemo joined as the fifty-first scenario
    // before that, with every modular set as the first of his two; the
    // S.H.I.E.L.D. modular set joined every other scenario with modular
    // sets, and the S.H.I.E.L.D. Executive Board joined each of them without
    // counting as a modular set: the 468,832 configurations before them hash
    // identically to the complete grid of 8c9a194.
    expect(zemoGrid.filter((m) => m.villainId === "baron_zemo")).toHaveLength(
      52 * 2 * 95 + 52 * 2 * 2,
    );
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      expect(
        zemoGrid.filter(
          (m) => m.villainId === scenario.id && m.module === "s.h.i.e.l.d.",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        !["baron_zemo", "enchantress_villain", "god_of_lies"].includes(v.id),
    ))
      expect(
        zemoGrid.filter(
          (m) => m.villainId === scenario.id && m.variant === "board",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const thunderboltsGrid = zemoGrid.filter(
      (m) =>
        m.villainId !== "baron_zemo" &&
        m.module !== "s.h.i.e.l.d." &&
        m.variant !== "board",
    );
    expect(thunderboltsGrid).toHaveLength(468832);
    expect(
      createHash("sha256")
        .update(manifest(thunderboltsGrid).join("\n"))
        .digest("hex"),
    ).toBe("360ef049736ed929fdbfd5c859891f44e7089895d10e02aa52ce2ae8884aafd8");
    // Agents of S.H.I.E.L.D.'s Thunderbolts joined as the fiftieth scenario
    // before that, with each of the six Elite Thunderbolt sets, the only sets
    // it allows, as the first of its two, and those six sets joined every
    // other scenario with modular sets: the 438,672 configurations before
    // them hash identically to the complete grid of c684ea9.
    const thunderboltsSets = [
      "gravitational_pull",
      "hard_sound",
      "pale_little_spider",
      "power_of_the_atom",
      "supersonic",
      "the_leaper",
    ];
    expect(
      thunderboltsGrid.filter((m) => m.villainId === "thunderbolts"),
    ).toHaveLength(52 * 2 * 6 + 52 * 2 * 2);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      for (const module of thunderboltsSets)
        expect(
          thunderboltsGrid.filter(
            (m) => m.villainId === scenario.id && m.module === module,
          ),
          `${scenario.id}/${module}`,
        ).toHaveLength(52 * 2);
    const modokGrid = thunderboltsGrid.filter(
      (m) =>
        m.villainId !== "thunderbolts" && !thunderboltsSets.includes(m.module),
    );
    expect(modokGrid).toHaveLength(438672);
    expect(
      createHash("sha256").update(manifest(modokGrid).join("\n")).digest("hex"),
    ).toBe("57175c556e8bc72aec5ce120ec02db8a7cf13395bbe3823fb7a95f8b07415ec3");
    // Agents of S.H.I.E.L.D.'s M.O.D.O.K. joined as the forty-ninth scenario
    // before that, with every modular set as his one, and the Scientist
    // Supreme modular set joined every other scenario with modular sets: the
    // 424,528 configurations before them hash identically to the complete
    // grid of 7b6aa57.
    expect(modokGrid.filter((m) => m.villainId === "modok")).toHaveLength(
      52 * 2 * 88 + 52 * 2 * 2,
    );
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      expect(
        modokGrid.filter(
          (m) =>
            m.villainId === scenario.id && m.module === "scientist_supreme",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const batrocGrid = modokGrid.filter(
      (m) => m.villainId !== "modok" && m.module !== "scientist_supreme",
    );
    expect(batrocGrid).toHaveLength(424528);
    expect(
      createHash("sha256")
        .update(manifest(batrocGrid).join("\n"))
        .digest("hex"),
    ).toBe("453e12bdf666f819d45a0c4534048698d9753f9f502f4a35049c77a651dc4880");
    // Agents of S.H.I.E.L.D.'s Batroc joined as the forty-eighth scenario
    // before that, with every modular set as the first of his two, and the
    // Batroc's Brigade modular set joined every other scenario with modular
    // sets: the 410,592 configurations before them hash identically to the
    // complete grid of a308934.
    expect(batrocGrid.filter((m) => m.villainId === "batroc")).toHaveLength(
      52 * 2 * 87 + 52 * 2 * 2,
    );
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      expect(
        batrocGrid.filter(
          (m) => m.villainId === scenario.id && m.module === "batrocs_brigade",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const blackWidowGrid = batrocGrid.filter(
      (m) => m.villainId !== "batroc" && m.module !== "batrocs_brigade",
    );
    expect(blackWidowGrid).toHaveLength(410592);
    expect(
      createHash("sha256")
        .update(manifest(blackWidowGrid).join("\n"))
        .digest("hex"),
    ).toBe("941d88de6aeac05788ea4a2a2c0b1131c71891d9d46c70d178574d4e94d3ad1f");
    // Agents of S.H.I.E.L.D.'s Black Widow joined as the forty-seventh
    // scenario before that, with every modular set as the first of her two,
    // and the A.I.M. Abduction and A.I.M. Science modular sets joined every
    // other scenario with modular sets: the 392,288 configurations before
    // them hash identically to the complete grid of d9ad0bd.
    const blackWidowSets = ["a.i.m._abduction", "a.i.m._science"];
    expect(
      blackWidowGrid.filter((m) => m.villainId === "black_widow_villain"),
    ).toHaveLength(52 * 2 * 86 + 52 * 2 * 2);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      for (const module of blackWidowSets)
        expect(
          blackWidowGrid.filter(
            (m) => m.villainId === scenario.id && m.module === module,
          ),
          `${scenario.id}/${module}`,
        ).toHaveLength(52 * 2);
    const standardIIIGrid = blackWidowGrid.filter(
      (m) =>
        m.villainId !== "black_widow_villain" &&
        !blackWidowSets.includes(m.module),
    );
    expect(standardIIIGrid).toHaveLength(392288);
    expect(
      createHash("sha256")
        .update(manifest(standardIIIGrid).join("\n"))
        .digest("hex"),
    ).toBe("94a0a826c68782b0aeb1e8ca36d3dae7ef35bb7b4d420c9977047db759781b57");
    // Age of Apocalypse's Standard III joined as a third choice of encounter
    // sets before that, with one configuration per hero, difficulty and
    // scenario that uses the Standard set: the 387,712 configurations before
    // them hash identically to the complete grid of 8387e99.
    expect(missions.filter((m) => m.variant === "iii")).toHaveLength(5304);
    expect(enchantressGrid.filter((m) => m.variant === "iii")).toHaveLength(
      5200,
    );
    expect(zemoGrid.filter((m) => m.variant === "iii")).toHaveLength(5096);
    expect(thunderboltsGrid.filter((m) => m.variant === "iii")).toHaveLength(
      4992,
    );
    expect(modokGrid.filter((m) => m.variant === "iii")).toHaveLength(4888);
    expect(batrocGrid.filter((m) => m.variant === "iii")).toHaveLength(4784);
    expect(blackWidowGrid.filter((m) => m.variant === "iii")).toHaveLength(
      4680,
    );
    expect(standardIIIGrid.filter((m) => m.variant === "iii")).toHaveLength(
      4576,
    );
    const enSabahNurGrid = standardIIIGrid.filter((m) => m.variant !== "iii");
    expect(enSabahNurGrid).toHaveLength(387712);
    expect(
      createHash("sha256")
        .update(manifest(enSabahNurGrid).join("\n"))
        .digest("hex"),
    ).toBe("4e4f41bf3009288a1f35fa2168ca05be5851bcd769bec6cc1dc0ac3a3fa4cac1");
    // Age of Apocalypse's En Sabah Nur joined as the forty-sixth scenario
    // before that, with every modular set as the first of his two, and the
    // Celestial Tech and Clan Akkaba modular sets joined every other scenario
    // with modular sets: the 369,928 configurations before them hash
    // identically to the complete grid of 7fcdac2.
    const enSabahNurSets = ["celestial_tech", "clan_akkaba"];
    expect(
      enSabahNurGrid.filter((m) => m.villainId === "en_sabah_nur"),
    ).toHaveLength(52 * 2 * 84 + 52 * 2);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      for (const module of enSabahNurSets)
        expect(
          enSabahNurGrid.filter(
            (m) => m.villainId === scenario.id && m.module === module,
          ),
          `${scenario.id}/${module}`,
        ).toHaveLength(52 * 2);
    const darkBeastGrid = enSabahNurGrid.filter(
      (m) =>
        m.villainId !== "en_sabah_nur" && !enSabahNurSets.includes(m.module),
    );
    expect(darkBeastGrid).toHaveLength(369928);
    expect(
      createHash("sha256")
        .update(manifest(darkBeastGrid).join("\n"))
        .digest("hex"),
    ).toBe("f5e4749f08184f0e95cfed3432ff6767e888064aa3d32cee0fb6e19f291a75a9");
    // Age of Apocalypse's Dark Beast joined as the forty-fifth scenario
    // before that, with every modular set but his three set-aside sets as
    // his one, and the Savage Land, Genosha and Blue Moon modular sets joined
    // every other scenario with modular sets: the 348,504 configurations
    // before them hash identically to the complete grid of 4de0cc6.
    const darkBeastSets = ["savage_land", "genosha", "blue_moon"];
    expect(
      darkBeastGrid.filter((m) => m.villainId === "dark_beast"),
    ).toHaveLength(52 * 2 * 79 + 52 * 2);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "dark_beast",
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      for (const module of darkBeastSets)
        expect(
          darkBeastGrid.filter(
            (m) => m.villainId === scenario.id && m.module === module,
          ),
          `${scenario.id}/${module}`,
        ).toHaveLength(52 * 2);
    const apocalypseGrid = darkBeastGrid.filter(
      (m) => m.villainId !== "dark_beast" && !darkBeastSets.includes(m.module),
    );
    expect(apocalypseGrid).toHaveLength(348504);
    expect(
      createHash("sha256")
        .update(manifest(apocalypseGrid).join("\n"))
        .digest("hex"),
    ).toBe("32bf2b546373620f807faa6ddacb3de6384a6617b19ee292bd6850ae6722bcc0");
    // Age of Apocalypse's Apocalypse joined as the forty-fourth scenario
    // before that, with every modular set as the first of his two, and the
    // Dark Riders modular set joined every other scenario with modular sets:
    // the 335,920 configurations before them hash identically to the
    // complete grid of 7b9ec3d.
    expect(
      apocalypseGrid.filter((m) => m.villainId === "apocalypse"),
    ).toHaveLength(52 * 2 * 79 + 52 * 2);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "apocalypse",
          "dark_beast",
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      expect(
        apocalypseGrid.filter(
          (m) => m.villainId === scenario.id && m.module === "dark_riders",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const horsemenGrid = apocalypseGrid.filter(
      (m) => m.villainId !== "apocalypse" && m.module !== "dark_riders",
    );
    expect(horsemenGrid).toHaveLength(335920);
    expect(
      createHash("sha256")
        .update(manifest(horsemenGrid).join("\n"))
        .digest("hex"),
    ).toBe("75e0a6ea1754b7a06811f8a5e729eae2d8468ca223a3d945c6481f0de8870989");
    // Age of Apocalypse's Four Horsemen joined as the forty-third scenario
    // before that, with every modular set as the first of their two, and the
    // Hounds modular set joined every other scenario with modular sets: the
    // 323,544 configurations before them hash identically to the complete
    // grid of cf2fe78.
    expect(
      horsemenGrid.filter((m) => m.villainId === "four_horsemen"),
    ).toHaveLength(52 * 2 * 78 + 52 * 2);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "four_horsemen",
          "apocalypse",
          "dark_beast",
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      expect(
        horsemenGrid.filter(
          (m) => m.villainId === scenario.id && m.module === "hounds",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const unusGrid = horsemenGrid.filter(
      (m) => m.villainId !== "four_horsemen" && m.module !== "hounds",
    );
    expect(unusGrid).toHaveLength(323544);
    expect(
      createHash("sha256").update(manifest(unusGrid).join("\n")).digest("hex"),
    ).toBe("27e85cc84d6c11658458de9faf518693cf9aed493fd5fa3cd951a4a780435d30");
    // Age of Apocalypse's Unus joined as the forty-second scenario before
    // that, with every modular set but its required Infinites set as its
    // one, and the Infinites and Dystopian Nightmare modular sets joined
    // every other scenario with modular sets: the 307,424 configurations
    // before them hash identically to the complete grid of 253c9fe.
    const aoaSets = ["infinites", "dystopian_nightmare"];
    expect(unusGrid.filter((m) => m.villainId === "unus")).toHaveLength(
      52 * 2 * 76 + 52 * 2,
    );
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "unus",
          "four_horsemen",
          "apocalypse",
          "dark_beast",
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      for (const module of aoaSets)
        expect(
          unusGrid.filter(
            (m) => m.villainId === scenario.id && m.module === module,
          ),
          `${scenario.id}/${module}`,
        ).toHaveLength(52 * 2);
    const styGrid = unusGrid.filter(
      (m) => m.villainId !== "unus" && !aoaSets.includes(m.module),
    );
    expect(styGrid).toHaveLength(307424);
    expect(
      createHash("sha256").update(manifest(styGrid).join("\n")).digest("hex"),
    ).toBe("9a769d77c50165a56e31c0227309d6d2324aa97f41c9a4cc51322def2f27bc97");
    // NeXt Evolution's Stryfe joined as the forty-first scenario before that,
    // with every modular set as the first of its two, and its Extreme
    // Measures and Mutant Insurrection modular sets joined every scenario with
    // modular sets: the 291,616 configurations before them hash identically
    // to the complete grid of 1b5971c.
    const stryfeSets = ["extreme_measures", "mutant_insurrection"];
    expect(styGrid.filter((m) => m.villainId === "stryfe")).toHaveLength(
      52 * 2 * 75 + 52 * 2,
    );
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "stryfe",
          "unus",
          "four_horsemen",
          "apocalypse",
          "dark_beast",
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      for (const module of stryfeSets)
        expect(
          styGrid.filter(
            (m) => m.villainId === scenario.id && m.module === module,
          ),
          `${scenario.id}/${module}`,
        ).toHaveLength(52 * 2);
    const sinGrid = styGrid.filter(
      (m) => m.villainId !== "stryfe" && !stryfeSets.includes(m.module),
    );
    expect(sinGrid).toHaveLength(291616);
    expect(
      createHash("sha256").update(manifest(sinGrid).join("\n")).digest("hex"),
    ).toBe("a1437d634d8ab21f1c06036cbb9699676f68bbf7869956a3fb81244bbd401a09");
    // NeXt Evolution's Mister Sinister joined as the fortieth scenario before
    // that, with every modular set as its one: the 283,920 configurations
    // before it hash identically to the complete grid of e21b14c.
    expect(
      sinGrid.filter((m) => m.villainId === "mister_sinister"),
    ).toHaveLength(52 * 2 * 73 + 52 * 2);
    const jugGrid = sinGrid.filter((m) => m.villainId !== "mister_sinister");
    expect(jugGrid).toHaveLength(283920);
    expect(
      createHash("sha256").update(manifest(jugGrid).join("\n")).digest("hex"),
    ).toBe("8bf7e259688061aafcb75c01c097b9e85a9bc8937bfbcbcfc19337fa9290126b");
    // NeXt Evolution's Juggernaut joined as the thirty-ninth scenario before
    // that, with every modular set as its one, and its Black Tom Cassidy
    // modular set joined every scenario with modular sets: the 272,480
    // configurations before them hash identically to the complete grid of
    // 9672756.
    expect(jugGrid.filter((m) => m.villainId === "juggernaut")).toHaveLength(
      52 * 2 * 73 + 52 * 2,
    );
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "juggernaut",
          "mister_sinister",
          "stryfe",
          "unus",
          "four_horsemen",
          "apocalypse",
          "dark_beast",
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      expect(
        jugGrid.filter(
          (m) =>
            m.villainId === scenario.id && m.module === "black_tom_cassidy",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const otrGrid = jugGrid.filter(
      (m) => m.villainId !== "juggernaut" && m.module !== "black_tom_cassidy",
    );
    expect(otrGrid).toHaveLength(272480);
    expect(
      createHash("sha256").update(manifest(otrGrid).join("\n")).digest("hex"),
    ).toBe("a884976c04271883fdfb8571f7b61c6726c388203c565295920d1d04233d5d17");
    // NeXt Evolution's On the Run joined as the thirty-eighth scenario before
    // that, with every modular set but its required Mutant Slayers as the
    // first of its two, and its Nasty Boys modular set joined every scenario
    // with modular sets: the 261,352 configurations before them hash
    // identically to the complete grid of 1cb1d9f.
    expect(otrGrid.filter((m) => m.villainId === "on_the_run")).toHaveLength(
      52 * 2 * 71 + 52 * 2,
    );
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "on_the_run",
          "juggernaut",
          "mister_sinister",
          "stryfe",
          "unus",
          "four_horsemen",
          "apocalypse",
          "dark_beast",
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      expect(
        otrGrid.filter(
          (m) => m.villainId === scenario.id && m.module === "nasty_boys",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const morlockGrid = otrGrid.filter(
      (m) => m.villainId !== "on_the_run" && m.module !== "nasty_boys",
    );
    expect(morlockGrid).toHaveLength(261352);
    expect(
      createHash("sha256")
        .update(manifest(morlockGrid).join("\n"))
        .digest("hex"),
    ).toBe("43994df4fb233bc5f695c96192eeced92664f0930f100eef80411e5f8045a8d2");
    // NeXt Evolution's Morlock Siege joined as the thirty-seventh scenario
    // before that, with every modular set as the first of its two, and its
    // Military Grade and Mutant Slayers modular sets joined every scenario
    // with modular sets: the 246,792 configurations before them hash
    // identically to the complete grid of 5a9f498.
    const nextSets = ["military_grade", "mutant_slayers"];
    expect(
      morlockGrid.filter((m) => m.villainId === "morlock_siege"),
    ).toHaveLength(52 * 2 * 71 + 52 * 2);
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        v.id !== "morlock_siege" &&
        v.id !== "on_the_run" &&
        v.id !== "juggernaut" &&
        v.id !== "mister_sinister" &&
        v.id !== "stryfe" &&
        v.id !== "unus" &&
        v.id !== "four_horsemen" &&
        v.id !== "apocalypse" &&
        v.id !== "dark_beast" &&
        v.id !== "en_sabah_nur" &&
        v.id !== "black_widow_villain" &&
        v.id !== "batroc" &&
        v.id !== "modok" &&
        v.id !== "thunderbolts" &&
        v.id !== "baron_zemo" &&
        v.id !== "enchantress_villain" &&
        v.id !== "god_of_lies",
    ))
      for (const module of nextSets)
        expect(
          morlockGrid.filter(
            (m) => m.villainId === scenario.id && m.module === module,
          ),
          `${scenario.id}/${module}`,
        ).toHaveLength(52 * 2);
    const mojoGrid = morlockGrid.filter(
      (m) => m.villainId !== "morlock_siege" && !nextSets.includes(m.module),
    );
    expect(mojoGrid).toHaveLength(246792);
    expect(
      createHash("sha256").update(manifest(mojoGrid).join("\n")).digest("hex"),
    ).toBe("a41eacadfd7b62c3b929af1f3a4dfcd2823d4bde158f5c7ce58218aa0c837d05");
    // MojoMania (Mojo) joined as the thirty-sixth scenario before that, with
    // every modular set as the first of those it sets aside, and the
    // one-card Longshot modular set joined every scenario with modular sets:
    // the 236,080 configurations before them hash identically to the
    // complete grid of d80558d.
    expect(mojoGrid.filter((m) => m.villainId === "mojo")).toHaveLength(
      52 * 2 * 69 + 52 * 2,
    );
    for (const scenario of VILLAINS.filter(
      (v) =>
        v.moduleCount !== 0 &&
        ![
          "mojo",
          "morlock_siege",
          "on_the_run",
          "juggernaut",
          "mister_sinister",
          "stryfe",
          "unus",
          "four_horsemen",
          "apocalypse",
          "dark_beast",
          "en_sabah_nur",
          "black_widow_villain",
          "batroc",
          "modok",
          "thunderbolts",
          "baron_zemo",
          "enchantress_villain",
          "god_of_lies",
        ].includes(v.id),
    ))
      expect(
        mojoGrid.filter(
          (m) => m.villainId === scenario.id && m.module === "longshot",
        ),
        scenario.id,
      ).toHaveLength(52 * 2);
    const spiralGrid = mojoGrid.filter(
      (m) => m.villainId !== "mojo" && m.module !== "longshot",
    );
    expect(spiralGrid).toHaveLength(236080);
    expect(
      createHash("sha256")
        .update(manifest(spiralGrid).join("\n"))
        .digest("hex"),
    ).toBe("baa4eacbe6bf509085de7409dde9779e2657a9d2af4a46eb0562b923e705ca36");
    // Across the Mojoverse (Spiral) joined as the thirty-fifth scenario before
    // that, with every modular set as the first of its three: the 228,904
    // configurations before it hash identically to the complete grid of
    // deb8ed9.
    expect(spiralGrid.filter((m) => m.villainId === "spiral")).toHaveLength(
      52 * 2 * 68 + 52 * 2,
    );
    const magogGrid = spiralGrid.filter((m) => m.villainId !== "spiral");
    expect(magogGrid).toHaveLength(228904);
    expect(
      createHash("sha256").update(manifest(magogGrid).join("\n")).digest("hex"),
    ).toBe("093e93e067fda5ec80c1ba9038a68609ce230bc1a77bbd0e6681608a4b4edc07");
    // Melee in the Mojo-seum (MaGog) joined as the thirty-fourth scenario
    // before that, with every modular set: the 221,728 configurations before
    // it hash identically to the complete grid of ae73f23.
    expect(magogGrid.filter((m) => m.villainId === "magog")).toHaveLength(
      52 * 2 * 68 + 52 * 2,
    );
    const genreGrid = magogGrid.filter((m) => m.villainId !== "magog");
    expect(genreGrid).toHaveLength(221728);
    expect(
      createHash("sha256").update(manifest(genreGrid).join("\n")).digest("hex"),
    ).toBe("a8d99b606def0dceec80869ff07e5eca4f6b924f1f61969de9eda93a0337f702");
    // MojoMania's Horror, Sci-Fi and Sitcom genre sets joined every scenario
    // with modular sets before that: the 212,056 configurations before them
    // hash identically to the complete grid of ecc71e8.
    const lastGenres = ["horror", "sci-fi", "sitcom"];
    const firstGenreGrid = genreGrid.filter(
      (m) => !lastGenres.includes(m.module),
    );
    expect(firstGenreGrid).toHaveLength(212056);
    expect(
      createHash("sha256")
        .update(manifest(firstGenreGrid).join("\n"))
        .digest("hex"),
    ).toBe("e12f61a4448138de3790277c37509a5376e8c96464bc75774f73e7cfa0a078ec");
    for (const module of lastGenres)
      expect(
        genreGrid.filter((m) => m.module === module),
        module,
      ).toHaveLength(3224);
    // The Crime, Fantasy and Western genre sets joined every scenario with
    // modular sets before them: the 202,384 configurations before those hash
    // identically to the complete grid of e9145ea.
    const genres = ["crime", "fantasy", "western"];
    const kreeGrid = firstGenreGrid.filter((m) => !genres.includes(m.module));
    expect(kreeGrid).toHaveLength(202384);
    expect(
      createHash("sha256").update(manifest(kreeGrid).join("\n")).digest("hex"),
    ).toBe("4c11326639ec53fb92c8aeeebb1d29464db0d55a1076add06240fe5179eb2a3c");
    for (const module of genres)
      expect(
        firstGenreGrid.filter((m) => m.module === module),
        module,
      ).toHaveLength(3224);
    // The free Kree Fanatic modular set joined every scenario with modular
    // sets before them: the 199,160 configurations before it hash
    // identically to the complete grid of ea801d9.
    const sinisterGrid = kreeGrid.filter((m) => m.module !== "kree_fanatic");
    expect(sinisterGrid).toHaveLength(199160);
    expect(
      createHash("sha256")
        .update(manifest(sinisterGrid).join("\n"))
        .digest("hex"),
    ).toBe("f013b7959018fe8c376800ac7593fe022ed42ff70c2be75f39768f340c023094");
    expect(kreeGrid.filter((m) => m.module === "kree_fanatic")).toHaveLength(
      3224,
    );
    // Sinister Motives' last two modular sets, Osborn Tech and Sinister
    // Assault, joined every scenario with modular sets before that: the
    // 192,712 configurations before them hash identically to the complete
    // grid of da7dd55.
    const lastSets = ["osborn_tech", "sinister_assault"];
    const vgGrid = sinisterGrid.filter((m) => !lastSets.includes(m.module));
    expect(vgGrid).toHaveLength(192712);
    expect(
      createHash("sha256").update(manifest(vgGrid).join("\n")).digest("hex"),
    ).toBe("73b6a78244428716cfda4c780441a9c7eabdb2ab0f0c417853e8e091349338e1");
    for (const module of lastSets)
      expect(
        sinisterGrid.filter((m) => m.module === module),
        module,
      ).toHaveLength(3224);
    // Venom Goblin extended the grid before that, and his Goblin Gear set
    // joined every scenario with modular sets: the 183,456 configurations
    // before them hash identically to the complete grid of 5c10dbb.
    const sixGrid = vgGrid.filter(
      (m) => m.villainId !== "venom_goblin" && m.module !== "goblin_gear",
    );
    expect(sixGrid).toHaveLength(183456);
    expect(
      createHash("sha256").update(manifest(sixGrid).join("\n")).digest("hex"),
    ).toBe("8796fbb1189374b1c2e4b59cfa11716d693981ea80273b728d72938bf9453280");
    expect(vgGrid.filter((m) => m.villainId === "venom_goblin")).toHaveLength(
      6136,
    );
    expect(
      vgGrid.filter(
        (m) => m.villainId !== "venom_goblin" && m.module === "goblin_gear",
      ),
    ).toHaveLength(3120);
    // The Sinister Six extended the grid before that, and its Guerrilla
    // Tactics set joined every scenario with modular sets: the 180,232
    // configurations before them hash identically to the complete grid of
    // 5600800.
    const mysterioGrid = sixGrid.filter(
      (m) => m.villainId !== "sinister_six" && m.module !== "guerrilla_tactics",
    );
    expect(mysterioGrid).toHaveLength(180232);
    expect(
      createHash("sha256")
        .update(manifest(mysterioGrid).join("\n"))
        .digest("hex"),
    ).toBe("1378dccc0061d30abbefd0f37b67eb52972ea5c28ede05b61a256f8c0c1a7292");
    expect(sixGrid.filter((m) => m.villainId === "sinister_six")).toHaveLength(
      104,
    );
    expect(
      sixGrid.filter(
        (m) =>
          m.villainId !== "sinister_six" && m.module === "guerrilla_tactics",
      ),
    ).toHaveLength(3120);
    // Mysterio extended the grid before that, and his Personal Nightmare and
    // Whispers of Paranoia sets joined every scenario with modular sets: the
    // 168,272 configurations before them hash identically to the complete
    // grid of 49a76f5.
    const mysterioSets = ["personal_nightmare", "whispers_of_paranoia"];
    const venomGrid = mysterioGrid.filter(
      (m) => m.villainId !== "mysterio" && !mysterioSets.includes(m.module),
    );
    expect(venomGrid).toHaveLength(168272);
    expect(
      createHash("sha256").update(manifest(venomGrid).join("\n")).digest("hex"),
    ).toBe("d81eb759b974de4401f967376f31f5f3aadd6b18a31ed8a172712938c9af9cc6");
    expect(mysterioGrid.filter((m) => m.villainId === "mysterio")).toHaveLength(
      5928,
    );
    expect(
      mysterioGrid.filter(
        (m) => m.villainId !== "mysterio" && mysterioSets.includes(m.module),
      ),
    ).toHaveLength(6032);
    // Venom extended the grid before that, and his Symbiotic Strength set
    // joined every scenario with modular sets: the 159,640 configurations
    // before them hash identically to the complete grid of 18bbd63.
    const sandmanGrid = venomGrid.filter(
      (m) => m.villainId !== "venom" && m.module !== "symbiotic_strength",
    );
    expect(sandmanGrid).toHaveLength(159640);
    expect(
      createHash("sha256")
        .update(manifest(sandmanGrid).join("\n"))
        .digest("hex"),
    ).toBe("b57ae1d1a7dcb525d03c7bd3c5db5fdc0a2bf09e3a6c83c748f5171a06b014e5");
    expect(venomGrid.filter((m) => m.villainId === "venom")).toHaveLength(5720);
    expect(
      venomGrid.filter(
        (m) => m.villainId !== "venom" && m.module === "symbiotic_strength",
      ),
    ).toHaveLength(2912);
    // Sandman extended the grid before that, and his City in Chaos and Down
    // to Earth modular sets joined every scenario with modular sets: the
    // 148,408 configurations before them hash identically to the complete
    // grid of a97d297.
    const sinisterSets = ["city_in_chaos", "down_to_earth"];
    const previous = sandmanGrid.filter(
      (m) => m.villainId !== "sandman" && !sinisterSets.includes(m.module),
    );
    expect(previous).toHaveLength(148408);
    expect(
      createHash("sha256").update(manifest(previous).join("\n")).digest("hex"),
    ).toBe("c9e4dd470ed71d823f6e04a457ef1e1f8a41b68fae683341a6cdf39da1116290");
    expect(sandmanGrid.filter((m) => m.villainId === "sandman")).toHaveLength(
      5616,
    );
    expect(
      sandmanGrid.filter(
        (m) => m.villainId !== "sandman" && sinisterSets.includes(m.module),
      ),
    ).toHaveLength(5616);
    // The Hood scenario pack's nine modular sets extended the grid in every
    // scenario with modular sets before that: the 123,136 configurations
    // before them hash identically to the complete grid of 16962b1.
    const hoodSets = [
      "beasty_boys",
      "brothers_grimm",
      "crossfire_crew",
      "mister_hyde",
      "ransacked_armory",
      "sinister_syndicate",
      "state_of_emergency",
      "streets_of_mayhem",
      "wrecking_crew_modular",
    ];
    const hoodGrid = previous.filter((m) => !hoodSets.includes(m.module));
    expect(hoodGrid).toHaveLength(123136);
    expect(
      createHash("sha256").update(manifest(hoodGrid).join("\n")).digest("hex"),
    ).toBe("03c35f14da4751b7850965425aeff70b7b37e503bff288e1d93a206aa6c4e48f");
    expect(
      previous.filter((m) => m.villainId === "the_hood" && !m.variant),
    ).toHaveLength(5408);
    expect(previous.filter((m) => hoodSets.includes(m.module))).toHaveLength(
      25272,
    );
    // The Hood extended the grid before that, and Standard II and Expert II
    // add one configuration per hero, scenario and difficulty: the 115,856
    // configurations before it hash identically to the complete grid of
    // 6574234.
    const kangGrid = hoodGrid.filter(
      (m) => m.villainId !== "the_hood" && !m.variant,
    );
    expect(kangGrid).toHaveLength(115856);
    expect(
      createHash("sha256").update(manifest(kangGrid).join("\n")).digest("hex"),
    ).toBe("78e1e0e682eef6f38dfb5407b3edfc61d248f919087accf37a185e99caf4a092");
    expect(
      hoodGrid.filter((m) => m.villainId === "the_hood" && !m.variant),
    ).toHaveLength(4472);
    expect(previous.filter((m) => m.variant === "ii")).toHaveLength(2808);
    expect(sandmanGrid.filter((m) => m.variant === "ii")).toHaveLength(2912);
    expect(venomGrid.filter((m) => m.variant === "ii")).toHaveLength(3016);
    expect(sixGrid.filter((m) => m.variant === "ii")).toHaveLength(3120);
    expect(genreGrid.filter((m) => m.variant === "ii")).toHaveLength(3224);
    expect(magogGrid.filter((m) => m.variant === "ii")).toHaveLength(3328);
    expect(spiralGrid.filter((m) => m.variant === "ii")).toHaveLength(3432);
    expect(mojoGrid.filter((m) => m.variant === "ii")).toHaveLength(3536);
    expect(morlockGrid.filter((m) => m.variant === "ii")).toHaveLength(3640);
    expect(otrGrid.filter((m) => m.variant === "ii")).toHaveLength(3744);
    expect(jugGrid.filter((m) => m.variant === "ii")).toHaveLength(3848);
    expect(sinGrid.filter((m) => m.variant === "ii")).toHaveLength(3952);
    expect(styGrid.filter((m) => m.variant === "ii")).toHaveLength(4056);
    expect(unusGrid.filter((m) => m.variant === "ii")).toHaveLength(4160);
    expect(horsemenGrid.filter((m) => m.variant === "ii")).toHaveLength(4264);
    expect(apocalypseGrid.filter((m) => m.variant === "ii")).toHaveLength(4368);
    expect(darkBeastGrid.filter((m) => m.variant === "ii")).toHaveLength(4472);
    expect(enSabahNurGrid.filter((m) => m.variant === "ii")).toHaveLength(4576);
    expect(standardIIIGrid.filter((m) => m.variant === "ii")).toHaveLength(
      4576,
    );
    expect(blackWidowGrid.filter((m) => m.variant === "ii")).toHaveLength(4680);
    expect(batrocGrid.filter((m) => m.variant === "ii")).toHaveLength(4784);
    expect(modokGrid.filter((m) => m.variant === "ii")).toHaveLength(4888);
    expect(thunderboltsGrid.filter((m) => m.variant === "ii")).toHaveLength(
      4992,
    );
    expect(zemoGrid.filter((m) => m.variant === "ii")).toHaveLength(5096);
    expect(zemoGrid.filter((m) => m.variant === "board")).toHaveLength(4992);
    expect(enchantressGrid.filter((m) => m.variant === "ii")).toHaveLength(
      5200,
    );
    expect(enchantressGrid.filter((m) => m.variant === "board")).toHaveLength(
      5096,
    );
    expect(missions.filter((m) => m.variant === "ii")).toHaveLength(5304);
    expect(missions.filter((m) => m.variant === "board")).toHaveLength(5200);
    // Kang and the Temporal, Master of Time and Anachronauts modular sets
    // extended the grid before that: the 103,584 configurations before it
    // hash identically to the complete grid of 1600763.
    const kangModules = ["temporal", "mot", "anachronauts"];
    const wreckingCrewGrid = kangGrid.filter(
      (m) => m.villainId !== "kang" && !kangModules.includes(m.module),
    );
    expect(wreckingCrewGrid).toHaveLength(103584);
    expect(
      createHash("sha256")
        .update(manifest(wreckingCrewGrid).join("\n"))
        .digest("hex"),
    ).toBe("92358309e714ce98ef71ae1f6d24c5890c553c1a9c894f956c9ec9effcadd2db");
    expect(kangGrid.filter((m) => m.villainId === "kang")).toHaveLength(4472);
    expect(
      kangGrid.filter(
        (m) => m.villainId !== "kang" && kangModules.includes(m.module),
      ),
    ).toHaveLength(7800);
    // The Wrecking Crew extended the grid without a modular set before that:
    // the 103,480 configurations before it hash identically to the complete
    // grid of e629ea5.
    const lokiGrid = wreckingCrewGrid.filter(
      (m) => m.villainId !== "the_wrecking_crew",
    );
    expect(lokiGrid).toHaveLength(103480);
    expect(
      createHash("sha256").update(manifest(lokiGrid).join("\n")).digest("hex"),
    ).toBe("f5056c423f3a2507660763a872f07deadb77d998b7a16b10903488eee3da1c38");
    expect(
      wreckingCrewGrid.filter((m) => m.villainId === "the_wrecking_crew"),
    ).toHaveLength(104);
    expect(
      grid
        .filter((m) => m.villainId === "the_wrecking_crew")
        .every((m) => m.module === "none"),
    ).toBe(true);
    // Loki and the Enchantress modular set extended the grid before that: the
    // 96,824 configurations before that import hash identically to the
    // complete grid of 37147cd.
    const helaGrid = lokiGrid.filter(
      (m) => m.villainId !== "loki" && m.module !== "enchantress",
    );
    expect(helaGrid).toHaveLength(96824);
    expect(
      createHash("sha256").update(manifest(helaGrid).join("\n")).digest("hex"),
    ).toBe("4e157440ea9add58490a34a901f3244224eca3e271392dfdfad01711af777822");
    expect(wreckingCrewGrid.filter((m) => m.villainId === "loki")).toHaveLength(
      4160,
    );
    expect(
      kangGrid.filter(
        (m) =>
          m.module === "enchantress" &&
          m.villainId !== "loki" &&
          m.villainId !== "kang",
      ),
    ).toHaveLength(2496);
    // Hela and the Legions of Hel and Frost Giants modular sets extended the
    // grid before that: the 87,984 configurations before that import hash
    // identically to the complete grid of f5fed09.
    const thanosGrid = helaGrid.filter(
      (m) =>
        m.villainId !== "hela" &&
        !["legions_of_hel", "frost_giants"].includes(m.module),
    );
    expect(thanosGrid).toHaveLength(87984);
    expect(
      createHash("sha256")
        .update(manifest(thanosGrid).join("\n"))
        .digest("hex"),
    ).toBe("44caed50d87a9125e8420025ddd2ff39a1f031297460faabd34c6cb72b9d0c56");
    expect(helaGrid.filter((m) => m.villainId === "hela")).toHaveLength(4056);
    expect(
      helaGrid.filter(
        (m) =>
          ["legions_of_hel", "frost_giants"].includes(m.module) &&
          m.villainId !== "hela",
      ),
    ).toHaveLength(4784);
    // Thanos and the Children of Thanos modular set extended the grid before
    // that: the 81,848 configurations before that import hash identically to
    // the complete grid of 1e03888.
    const towerGrid = thanosGrid.filter(
      (m) => m.villainId !== "thanos" && m.module !== "children_of_thanos",
    );
    expect(towerGrid).toHaveLength(81848);
    expect(
      createHash("sha256").update(manifest(towerGrid).join("\n")).digest("hex"),
    ).toBe("0acbe3b90a4d9e92f0eff5489bb7ecae357aeb2263d8b60e2e40bef2f9d218ce");
    expect(thanosGrid.filter((m) => m.villainId === "thanos")).toHaveLength(
      3848,
    );
    expect(
      thanosGrid.filter(
        (m) => m.module === "children_of_thanos" && m.villainId !== "thanos",
      ),
    ).toHaveLength(2288);
    // Tower Defense extended the grid before that. Every earlier name and
    // seed stays in place: the 78,104 configurations before that import hash
    // identically to the complete grid of 519fdc8.
    const ebonyGrid = towerGrid.filter((m) => m.villainId !== "tower_defense");
    expect(ebonyGrid).toHaveLength(78104);
    expect(
      createHash("sha256").update(manifest(ebonyGrid).join("\n")).digest("hex"),
    ).toBe("e08f1c4878ec52c20f1db88d0286c0c89d38d32a9a6a5be50adb65cfa7db990d");
    expect(
      towerGrid.filter((m) => m.villainId === "tower_defense"),
    ).toHaveLength(3744);
    // Ebony Maw and its Black Order and Armies of Titan modular sets extended
    // the grid before that. Every earlier name and seed stays in place: the
    // 70,200 configurations before that import hash identically.
    const ronanGrid = ebonyGrid.filter(
      (m) =>
        m.villainId !== "ebony_maw" &&
        !["black_order", "armies_of_titan"].includes(m.module),
    );
    expect(ronanGrid).toHaveLength(70200);
    expect(
      createHash("sha256").update(manifest(ronanGrid).join("\n")).digest("hex"),
    ).toBe("4a8d2fdfc9c9e0d7be67eadcb5e38cbecd153929a1c3eb28abe8a65ec36c3116");
    expect(ebonyGrid.filter((m) => m.villainId === "ebony_maw")).toHaveLength(
      3744,
    );
    expect(
      ebonyGrid.filter(
        (m) =>
          ["black_order", "armies_of_titan"].includes(m.module) &&
          m.villainId !== "ebony_maw",
      ),
    ).toHaveLength(4160);
    // Ronan the Accuser and its Kree Militants modular set extended the grid
    // before that: the 64,688 configurations before that import hash
    // identically.
    const nebulaGrid = ronanGrid.filter(
      (m) => m.villainId !== "ronan" && m.module !== "kree_militant",
    );
    expect(nebulaGrid).toHaveLength(64688);
    expect(
      createHash("sha256")
        .update(manifest(nebulaGrid).join("\n"))
        .digest("hex"),
    ).toBe("f1ee348fefcc2450750b390ffc3f6f36ff460123a7ffd75c248a0e393ce3d1ad");
    expect(ronanGrid.filter((m) => m.villainId === "ronan")).toHaveLength(3536);
    expect(
      ronanGrid.filter(
        (m) => m.module === "kree_militant" && m.villainId !== "ronan",
      ),
    ).toHaveLength(1976);
    // Nebula and its Space Pirates modular set extended the grid before that:
    // the 59,384 configurations before that import hash identically.
    const escapeGrid = nebulaGrid.filter(
      (m) => m.villainId !== "nebula" && m.module !== "space_pirates",
    );
    expect(escapeGrid).toHaveLength(59384);
    expect(
      createHash("sha256")
        .update(manifest(escapeGrid).join("\n"))
        .digest("hex"),
    ).toBe("b95aaedb68243c5efa561cee935ffb462534c163bfb2bda9ca98380ad202097a");
    expect(nebulaGrid.filter((m) => m.villainId === "nebula")).toHaveLength(
      3432,
    );
    expect(
      nebulaGrid.filter(
        (m) => m.module === "space_pirates" && m.villainId !== "nebula",
      ),
    ).toHaveLength(1872);
    // Escape the Museum extended the grid without a new modular set: the
    // 56,056 configurations before that import hash identically.
    const collectorGrid = escapeGrid.filter(
      (m) => m.villainId !== "escape_the_museum",
    );
    expect(collectorGrid).toHaveLength(56056);
    expect(
      createHash("sha256")
        .update(manifest(collectorGrid).join("\n"))
        .digest("hex"),
    ).toBe("48cc1a99662b97eedbe4ee218503ce44ebd6a5e313dd24f44fd8faaff06f1792");
    expect(
      escapeGrid.filter((m) => m.villainId === "escape_the_museum"),
    ).toHaveLength(3328);
    // Infiltrate the Museum and its Menagerie Medley modular set extended the
    // grid after Brotherhood of Badoon: the 51,064 configurations before that
    // import hash identically.
    const badoonGrid = collectorGrid.filter(
      (m) =>
        m.villainId !== "infiltrate_the_museum" &&
        m.module !== "menagerie_medley",
    );
    expect(badoonGrid).toHaveLength(51064);
    expect(
      createHash("sha256")
        .update(manifest(badoonGrid).join("\n"))
        .digest("hex"),
    ).toBe("4d5c7c4c61d182ec83bcf32fa9a7215afff649c0299413a4aacb3b437b15b466");
    expect(
      collectorGrid.filter((m) => m.villainId === "infiltrate_the_museum"),
    ).toHaveLength(3328);
    expect(
      collectorGrid.filter(
        (m) =>
          m.module === "menagerie_medley" &&
          m.villainId !== "infiltrate_the_museum",
      ),
    ).toHaveLength(1664);
    // Brotherhood of Badoon and its Band of Badoon modular set extended the
    // grid before that. All retained snapshots below are computed from the
    // same 46,280 configurations.
    const priorGrid = badoonGrid.filter(
      (m) =>
        m.villainId !== "brotherhood_of_badoon" &&
        m.module !== "band_of_badoon",
    );
    expect(priorGrid).toHaveLength(46280);
    expect(
      createHash("sha256").update(manifest(priorGrid).join("\n")).digest("hex"),
    ).toBe("bc765bcb35cc55cebe6415eb50a784a8e9b19f3b0617322dd7075ec8b209917a");
    expect(
      badoonGrid.filter((m) => m.villainId === "brotherhood_of_badoon"),
    ).toHaveLength(3224);
    expect(
      badoonGrid.filter(
        (m) =>
          m.module === "band_of_badoon" &&
          m.villainId !== "brotherhood_of_badoon",
      ),
    ).toHaveLength(1560);
    expect(
      createHash("sha256")
        .update(
          manifest(
            priorGrid.filter(
              (m) =>
                !["absorbing_man", "taskmaster", "zola", "red_skull"].includes(
                  m.villainId,
                ),
            ),
          ).join("\n"),
        )
        .digest("hex"),
    ).toBe("6a4742e07325a1c84c1f98ec22302ae79769a2dc9efff1e71eae461d644ba6a0");
    const absorbingSnapshot = priorGrid.filter(
      (m) => !["taskmaster", "zola", "red_skull"].includes(m.villainId),
    );
    expect(absorbingSnapshot).toHaveLength(37024);
    expect(
      createHash("sha256")
        .update(manifest(absorbingSnapshot).join("\n"))
        .digest("hex"),
    ).toBe("a0b4128d53ac2aae65b810f07cae056b5179fbf9851e910b56b3f5b0dac296dc");
    expect(priorGrid.filter((m) => m.villainId === "taskmaster")).toHaveLength(
      3016,
    );
    const taskmasterSnapshot = priorGrid.filter(
      (m) => !["zola", "red_skull"].includes(m.villainId),
    );
    expect(taskmasterSnapshot).toHaveLength(40040);
    expect(
      createHash("sha256")
        .update(manifest(taskmasterSnapshot).join("\n"))
        .digest("hex"),
    ).toBe("5649977ca5e521c574a85b5af8b992349d64bd06605b1d8207217f1ae853c8a6");
    expect(priorGrid.filter((m) => m.villainId === "zola")).toHaveLength(3120);
    const zolaSnapshot = priorGrid.filter((m) => m.villainId !== "red_skull");
    expect(zolaSnapshot).toHaveLength(43160);
    expect(
      createHash("sha256")
        .update(manifest(zolaSnapshot).join("\n"))
        .digest("hex"),
    ).toBe("dc71d9702420d7de9ca79f5ebea5447740a195b314adbc288dfa39fb7a4117a8");
    expect(priorGrid.filter((m) => m.villainId === "red_skull")).toHaveLength(
      3120,
    );
    const combined = partitions.flat();
    const previousMissions = priorGrid.filter(
      (mission) =>
        ![
          "crossbones",
          "absorbing_man",
          "taskmaster",
          "zola",
          "red_skull",
        ].includes(mission.villainId),
    );
    expect(previousMissions).toHaveLength(30888);
    expect(
      createHash("sha256")
        .update(manifest(previousMissions).join("\n"))
        .digest("hex"),
    ).toBe("492adb711daff6578c014486b51281291235d8d3672f3d408a2689e7f8990ae1");
    expect(
      priorGrid.filter((mission) => mission.villainId === "crossbones"),
    ).toHaveLength(3016);
    expect(
      priorGrid.filter((m) => m.villainId === "absorbing_man"),
    ).toHaveLength(3120);
    // New heroes and modular sets extend the published mission grid without
    // changing the names or seeded shuffles of the 11,328 prior missions.
    const retained = previousMissions.filter(
      (mission) =>
        heroIds.indexOf(mission.heroId) < 32 &&
        ![
          "deathstrike",
          "shadow_king",
          "exodus",
          "reavers",
          "sauron",
          "arcade",
          "crazy_gang",
          "hellfire",
          "exper_weapon",
          ...redSkullModules,
        ].includes(mission.module),
    );
    expect(retained).toHaveLength(11328);
    expect(
      createHash("sha256").update(manifest(retained).join("\n")).digest("hex"),
    ).toBe("8639244ce44d6832c10f3f51edb418a1435a42fa862f629f47a62b4016e519a0");
    const previousImport = previousMissions.filter(
      (mission) =>
        heroIds.indexOf(mission.heroId) < 36 &&
        ![
          "exodus",
          "reavers",
          "sauron",
          "arcade",
          "crazy_gang",
          "hellfire",
          "exper_weapon",
          ...redSkullModules,
        ].includes(mission.module),
    );
    expect(previousImport).toHaveLength(14184);
    expect(
      createHash("sha256")
        .update(manifest(previousImport).join("\n"))
        .digest("hex"),
    ).toBe("88a7dfa4ec824a10b054097804b59c33d9bafb5f1f15f3e35dde99edec2463b3");
    const secondImport = previousMissions.filter(
      (mission) =>
        heroIds.indexOf(mission.heroId) < 40 &&
        ![
          "sauron",
          "arcade",
          "crazy_gang",
          "hellfire",
          "exper_weapon",
          ...redSkullModules,
        ].includes(mission.module),
    );
    expect(secondImport).toHaveLength(17360);
    expect(
      createHash("sha256")
        .update(manifest(secondImport).join("\n"))
        .digest("hex"),
    ).toBe("81f2fa5fc4410fcd58139b13ade0c65cf7812111772eeb17299d72f9622ce255");
    const thirdImport = previousMissions.filter(
      (mission) =>
        heroIds.indexOf(mission.heroId) < 44 &&
        ![
          "sauron",
          "arcade",
          "crazy_gang",
          "hellfire",
          "exper_weapon",
          ...redSkullModules,
        ].includes(mission.module),
    );
    expect(thirdImport).toHaveLength(19096);
    expect(
      createHash("sha256")
        .update(manifest(thirdImport).join("\n"))
        .digest("hex"),
    ).toBe("b3ee09ef91e3f0f528da00b9c5e541220bdd12344987c2d0fcac7600024daf66");
    const fourthImport = previousMissions.filter(
      (mission) =>
        heroIds.indexOf(mission.heroId) < 48 &&
        ![
          "crazy_gang",
          "hellfire",
          "exper_weapon",
          ...redSkullModules,
        ].includes(mission.module),
    );
    expect(fourthImport).toHaveLength(22752);
    expect(
      createHash("sha256")
        .update(manifest(fourthImport).join("\n"))
        .digest("hex"),
    ).toBe("8700b7efebe73397bb71519e768a39b4c7096cfbda3637e15ca405c4f0b5f5a3");
    const fifthImport = previousMissions.filter(
      (mission) =>
        !["exper_weapon", ...redSkullModules].includes(mission.module),
    );
    expect(fifthImport).toHaveLength(26728);
    expect(
      createHash("sha256")
        .update(manifest(fifthImport).join("\n"))
        .digest("hex"),
    ).toBe("50a2adec4c438e99521fa30c0fa2c46be481d6837ff5396f82eaec269dcf63c1");
    const experimentalWeaponsImport = previousMissions.filter(
      (mission) => !redSkullModules.includes(mission.module),
    );
    expect(experimentalWeaponsImport).toHaveLength(27768);
    expect(
      createHash("sha256")
        .update(manifest(experimentalWeaponsImport).join("\n"))
        .digest("hex"),
    ).toBe("bfd15ff0e1081015f5b01d55beb096051c63af39d842c8342b0a8e70ad1f6b9e");
    const perShard = (keep: (mission: MissionConfig) => boolean) =>
      partitions.map((partition) => partition.filter(keep).length);
    // Each shard runs 624 of the 9,984 configurations of a scenario
    // with all 96 modular sets, 611 or 624 of the 9,880 of a scenario whose fixed or
    // reserved set leaves 95, 598 or 611 of Dark Beast's 9,672, and 39 of the 624 of
    // Thunderbolts, which allows only its six sets.
    for (const scenario of VILLAINS.filter((v) => v.moduleCount !== 0)) {
      const counts = perShard(
        (mission) => !mission.variant && mission.villainId === scenario.id,
      );
      const total = heroIds.length * 2 * scenarioModules(scenario.id).length;
      expect([9984, 9880, 9672, 624], scenario.id).toContain(total);
      expect(
        counts.reduce((sum, count) => sum + count, 0),
        scenario.id,
      ).toBe(total);
      for (const count of counts)
        expect(
          total === 624
            ? [39]
            : total === 9672
              ? [598, 611]
              : total === 9880
                ? [611, 624]
                : [624],
          scenario.id,
        ).toContain(count);
    }
    expect(
      VILLAINS.filter((v) => scenarioModules(v.id).length === 95)
        .map((v) => v.id)
        .sort(),
    ).toEqual([
      "crossbones",
      "mansion_attack",
      "master_mold",
      "mysterio",
      "on_the_run",
      "project_wideawake",
      "sandman",
      "taskmaster",
      "unus",
      "venom",
      "venom_goblin",
    ]);
    expect(
      perShard((mission) => !mission.variant && mission.villainId === "kang"),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "the_hood",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard((mission) => !mission.variant && mission.villainId === "magog"),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard((mission) => !mission.variant && mission.villainId === "spiral"),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard((mission) => !mission.variant && mission.villainId === "mojo"),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "morlock_siege",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "on_the_run",
      ),
    ).toEqual([
      611, 611, 624, 624, 611, 611, 624, 624, 611, 611, 624, 624, 611, 611, 624,
      624,
    ]);
    expect(
      perShard((mission) => !mission.variant && mission.villainId === "stryfe"),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "juggernaut",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) =>
          !mission.variant && mission.villainId === "mister_sinister",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard((mission) => !mission.variant && mission.villainId === "unus"),
    ).toEqual([
      624, 624, 611, 611, 624, 624, 611, 611, 624, 624, 611, 611, 624, 624, 611,
      611,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "four_horsemen",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "apocalypse",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "dark_beast",
      ),
    ).toEqual([
      598, 598, 611, 611, 598, 598, 611, 611, 598, 598, 611, 611, 598, 598, 611,
      611,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "god_of_lies",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) =>
          !mission.variant && mission.villainId === "enchantress_villain",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "baron_zemo",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "thunderbolts",
      ),
    ).toEqual([39, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39]);
    expect(
      perShard((mission) => !mission.variant && mission.villainId === "modok"),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard((mission) => !mission.variant && mission.villainId === "batroc"),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) =>
          !mission.variant && mission.villainId === "black_widow_villain",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    expect(
      perShard(
        (mission) => !mission.variant && mission.villainId === "en_sabah_nur",
      ),
    ).toEqual([
      624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624, 624,
      624,
    ]);
    // The two scenarios without modular sets each spread over eight of the
    // sixteen shards.
    expect(
      perShard((mission) => mission.villainId === "the_wrecking_crew"),
    ).toEqual([0, 0, 13, 13, 0, 0, 13, 13, 0, 0, 13, 13, 0, 0, 13, 13]);
    expect(perShard((mission) => mission.villainId === "sinister_six")).toEqual(
      [0, 0, 13, 13, 0, 0, 13, 13, 0, 0, 13, 13, 0, 0, 13, 13],
    );
    expect(perShard((mission) => mission.variant === "ii")).toEqual([
      332, 332, 332, 332, 332, 332, 332, 332, 331, 331, 331, 331, 331, 331, 331,
      331,
    ]);
    expect(perShard((mission) => mission.variant === "iii")).toEqual([
      331, 331, 331, 331, 331, 331, 331, 331, 332, 332, 332, 332, 332, 332, 332,
      332,
    ]);
    expect(perShard((mission) => mission.variant === "board")).toEqual([
      325, 325, 325, 325, 325, 325, 325, 325, 325, 325, 325, 325, 325, 325, 325,
      325,
    ]);
    expect(new Set(missions.map(key)).size).toBe(514384);
    expect(new Set(combined.map(key)).size).toBe(514384);
    expect(manifest(combined)).toEqual(manifest(missions));
    expect(partitions.map((partition) => partition.length)).toEqual(
      Array(16).fill(32149),
    );
    for (const partition of partitions)
      expect(new Set(partition.map((mission) => mission.heroId)).size).toBe(52);
    for (const heroId of heroIds) {
      const perShard = partitions.map(
        (partition) =>
          partition.filter((mission) => mission.heroId === heroId).length,
      );
      expect(Math.min(...perShard)).toBeGreaterThanOrEqual(617);
      expect(Math.max(...perShard)).toBeLessThanOrEqual(620);
      expect(perShard.reduce((total, count) => total + count, 0)).toBe(9892);
    }
    expect(selectedMissions).toHaveLength(
      isSharded ? partitions[Number(shardIndex)].length : 514384,
    );
    // Hashing every layer of the 514,384-configuration manifest takes a few
    // seconds on its own.
  }, 60000);
  for (const mission of selectedMissions)
    it(
      `${mission.heroId}/${mission.villainId}/${mission.difficulty}/${mission.module}${mission.variant ? `/${mission.variant}` : ""} seed${mission.seed}`,
      () => runMission(mission),
      30000,
    );
});
