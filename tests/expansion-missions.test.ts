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
import { heroStarterAspects } from "../src/game/hero-runtime";
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
];
const missions = heroIds.flatMap((heroId, hi) =>
  VILLAINS.flatMap((scenario, vi) =>
    (["standard", "expert"] as const).flatMap((difficulty, di) =>
      MODULES.map((module, mi) => ({
        heroId,
        villainId: scenario.id,
        difficulty,
        module: module.id,
        seed: 9000 + hi * 1000 + vi * 100 + di * 10 + mi,
      })),
    ),
  ),
);

/** Only physical-zone auditing inspects hidden card IDs. The player strategy
 * uses hand cards, visible board state, and the same public prompts as the UI. */
function ownedPieces(s: GameState, originalIds: Set<string>): Piece[] {
  const playerZones = s.players.flatMap((seat) => [
    ...seat.player.hand,
    ...seat.player.deck,
    ...seat.player.discard,
    ...seat.player.inPlay,
    ...(seat.player.invocationDeck || []),
    ...(seat.player.invocationDiscard || []),
  ]);
  const owners = new Set(s.players.map((seat) => seat.id));
  return [
    ...playerZones,
    ...playerZones.flatMap((p) => p.storedCards || []),
    ...[
      ...s.resolving,
      ...s.removed,
      ...s.attachments,
      ...s.minions.flatMap((p) => (p.droneCard ? [p.droneCard] : [])),
      ...s.sideSchemes.flatMap((p) => [
        ...(p.captured || []),
        ...(p.storedCards || []),
      ]),
    ].filter(
      (p) => originalIds.has(p.id) || (!!p.ownerId && owners.has(p.ownerId)),
    ),
  ];
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
  expect(codes).toHaveLength(40);
  let s = newGame({
    ...config,
    aspect,
    pacing: "expert",
    heroes: [{ heroId: hero.id, aspect, deckCards: codes }],
  });
  const initial = [...s.player.hand, ...s.player.deck];
  expect(initial.map((p) => p.code).sort()).toEqual([...codes].sort());
  const supplementary = [
    ...(s.player.invocationDeck || []),
    ...(s.player.invocationDiscard || []),
  ];
  const total = 40 + supplementary.length;
  const originalIds = new Set([...initial, ...supplementary].map((p) => p.id));
  const trace: string[] = [];
  let commands = 0;
  const audit = () => {
    const pieces = ownedPieces(s, originalIds);
    expect(
      pieces.length,
      `Physical40-card invariant after ${trace.at(-1)}`,
    ).toBe(total);
    expect(
      new Set(pieces.map((p) => p.id)).size,
      "No duplicated physical player cards",
    ).toBe(total);
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
      if (s.player.hp < maxHP(s) && !s.player.exhausted)
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
    const basic = () => {
      if (s.player.exhausted || s.player.form !== "hero") return;
      const canThwart =
        !captainThwartBlocked(s) &&
        ((!!targets(s, "scheme").length && heroStats(s).thwart > 0) ||
          s.player.confused);
      const urgent = s.scheme.threat >= 3 || !!s.sideSchemes.length;
      act({ type: "BASIC", action: urgent && canThwart ? "thwart" : "attack" });
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
  it("covers sixteen expansion heroes, all scenarios, both difficulties and every supported encounter module", () => {
    expect(missions).toHaveLength(
      heroIds.length * VILLAINS.length * 2 * MODULES.length,
    );
    expect(VILLAINS).toHaveLength(5);
    expect(MODULES).toHaveLength(9);
    expect(heroIds).toHaveLength(16);
    expect(missions).toHaveLength(1440);
  });
  for (const mission of missions)
    it(
      `${mission.heroId}/${mission.villainId}/${mission.difficulty}/${mission.module} seed${mission.seed}`,
      () => runMission(mission),
      30000,
    );
});
