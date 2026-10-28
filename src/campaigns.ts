import {
  ASPECTS,
  HEROES,
  VILLAINS,
  deckCodes,
  scenarioModules,
} from "./game/cards";
import { deckErrors } from "./game/decks";
import { newGame } from "./game/engine";
import { upgradeSave } from "./game/team";
import type { Aspect, GameState, Pacing } from "./game/types";
import { readStorage, writeStorage } from "./browser-storage";

export const CAMPAIGNS_KEY = "champions.campaigns.v1";
export const CAMPAIGN_LIMIT = 10;
export interface CampaignSeat {
  heroId: string;
  aspect: Aspect;
  deckCards: string[];
  deckAspects?: Aspect[];
}
export interface CampaignStage {
  villainId: string;
  modules: string[];
}
export interface CampaignAttempt {
  missionId: string;
  stage: number;
  outcome: "won" | "lost";
  round: number;
  seed: number;
  finishedAt: string;
  delayCounters?: number;
}
export interface Campaign {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  heroes: CampaignSeat[];
  difficulty: "standard" | "expert";
  heroic: number;
  stages: CampaignStage[];
  attempts: CampaignAttempt[];
  notes: string;
  /** The only active table, saved atomically with its campaign journal. */
  game: GameState | null;
}
function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
export function campaignStage(c: Campaign): number {
  return c.attempts.filter((a) => a.outcome === "won").length;
}
export function defaultCampaignStage(villainId: string): CampaignStage {
  const scenario = VILLAINS.find((v) => v.id === villainId);
  requireValue(scenario, "Choose an implemented scenario.");
  return {
    villainId,
    modules: [...(scenario.defaultModules || [scenario.module])],
  };
}
export function createCampaign(input: {
  name: string;
  heroes: {
    heroId: string;
    aspect: Aspect;
    deckCards?: string[];
    deckAspects?: Aspect[];
  }[];
  stages: CampaignStage[];
  difficulty: "standard" | "expert";
  heroic?: number;
}): Campaign {
  const result: Campaign = {
    version: 1,
    id: crypto.randomUUID(),
    name: input.name.trim(),
    createdAt: new Date().toISOString(),
    heroes: input.heroes.map((seat) => ({
      heroId: seat.heroId,
      aspect: seat.aspect,
      deckCards: [
        ...(seat.deckCards ||
          deckCodes(seat.heroId, seat.aspect, seat.deckAspects)),
      ],
      ...(seat.deckAspects ? { deckAspects: [...seat.deckAspects] } : {}),
    })),
    difficulty: input.difficulty,
    heroic: input.heroic || 0,
    stages: structuredClone(input.stages),
    attempts: [],
    notes: "",
    game: null,
  };
  validateCampaign(result);
  return result;
}
/** Validation also rejects impossible histories (skipped stages, duplicate wins). */
export function validateCampaign(value: unknown): asserts value is Campaign {
  requireValue(value && typeof value === "object", "Invalid campaign.");
  const c = value as Campaign;
  requireValue(
    c.version === 1 && typeof c.id === "string" && c.id.length > 0,
    "Unsupported campaign save.",
  );
  requireValue(
    typeof c.name === "string" &&
      c.name.trim().length > 0 &&
      c.name.length <= 80,
    "Use a campaign name of 1–80 characters.",
  );
  requireValue(
    typeof c.createdAt === "string" && Number.isFinite(Date.parse(c.createdAt)),
    "Invalid campaign date.",
  );
  requireValue(
    typeof c.notes === "string" && c.notes.length <= 4000,
    "Campaign notes may contain up to 4,000 characters.",
  );
  requireValue(
    ["standard", "expert"].includes(c.difficulty) &&
      [0, 1, 2, 3].includes(c.heroic),
    "Invalid campaign difficulty.",
  );
  requireValue(
    Array.isArray(c.heroes) && c.heroes.length >= 1 && c.heroes.length <= 3,
    "Choose one to three heroes.",
  );
  requireValue(
    new Set(c.heroes.map((s) => s?.heroId)).size === c.heroes.length,
    "Each hero may join once.",
  );
  for (const seat of c.heroes) {
    requireValue(
      seat &&
        HEROES.some((h) => h.id === seat.heroId) &&
        ASPECTS.some((a) => a.id === seat.aspect),
      "Unsupported campaign hero.",
    );
    requireValue(
      Array.isArray(seat.deckCards) &&
        seat.deckCards.every((code) => typeof code === "string"),
      "Invalid campaign deck.",
    );
    requireValue(
      seat.deckAspects === undefined ||
        (Array.isArray(seat.deckAspects) &&
          seat.deckAspects.every((a) => ASPECTS.some((x) => x.id === a))),
      "Invalid deck aspects.",
    );
    const errors = deckErrors(
      seat.heroId,
      seat.aspect,
      seat.deckCards,
      seat.deckAspects,
    );
    requireValue(!errors.length, errors[0]);
  }
  requireValue(
    Array.isArray(c.stages) && c.stages.length >= 1 && c.stages.length <= 12,
    "Choose 1–12 campaign missions.",
  );
  for (const stage of c.stages) {
    const v = VILLAINS.find((v) => v.id === stage?.villainId);
    requireValue(
      v &&
        Array.isArray(stage.modules) &&
        stage.modules.length === (v.moduleCount || 1),
      "Invalid campaign scenario setup.",
    );
    requireValue(
      new Set(stage.modules).size === stage.modules.length &&
        stage.modules.every((id) =>
          scenarioModules(v.id).some((m) => m.id === id),
        ),
      "Choose distinct supported modular sets.",
    );
  }
  requireValue(
    Array.isArray(c.attempts) && c.attempts.length <= 1000,
    "Invalid campaign journal.",
  );
  let nextStage = 0;
  const ids = new Set<string>();
  for (const a of c.attempts) {
    requireValue(
      a &&
        typeof a.missionId === "string" &&
        !!a.missionId &&
        !ids.has(a.missionId),
      "Duplicate campaign result.",
    );
    requireValue(
      a.stage === nextStage &&
        nextStage < c.stages.length &&
        ["won", "lost"].includes(a.outcome),
      "Invalid campaign progression.",
    );
    requireValue(
      Number.isInteger(a.round) &&
        a.round > 0 &&
        Number.isInteger(a.seed) &&
        a.seed >= 0 &&
        a.seed <= 0xffffffff &&
        Number.isFinite(Date.parse(a.finishedAt)),
      "Invalid campaign result.",
    );
    ids.add(a.missionId);
    if (a.outcome === "won") nextStage++;
  }
  if (c.game !== null) {
    const g = c.game;
    requireValue(
      g && g.version === 1 && g.accountMission?.id && g.campaign?.id === c.id,
      "Invalid campaign table.",
    );
    const index = g.campaign.stage;
    requireValue(
      Number.isInteger(index) && index >= 0 && index < c.stages.length,
      "Invalid campaign mission.",
    );
    const recorded = c.attempts.find(
      (a) => a.missionId === g.accountMission?.id,
    );
    requireValue(
      recorded
        ? c.attempts.at(-1) === recorded &&
            recorded.stage === index &&
            recorded.outcome === g.phase
        : index === nextStage && !["won", "lost"].includes(g.phase),
      "The campaign table does not match its journal.",
    );
    requireValue(
      g.villainId === c.stages[index].villainId &&
        g.difficulty === c.difficulty &&
        (g.heroic || 0) === c.heroic &&
        JSON.stringify(g.modules || [g.module]) ===
          JSON.stringify(c.stages[index].modules),
      "The campaign setup changed.",
    );
    requireValue(
      Array.isArray(g.players) &&
        g.players.length === c.heroes.length &&
        g.players.every(
          (s, i) =>
            s.heroId === c.heroes[i].heroId &&
            s.aspect === c.heroes[i].aspect &&
            JSON.stringify(s.deckCards) ===
              JSON.stringify(c.heroes[i].deckCards),
        ),
      "The campaign team changed.",
    );
    requireValue(
      g.player?.hand &&
        Array.isArray(g.queue) &&
        Array.isArray(g.attachments) &&
        g.encounter?.deck &&
        g.villain &&
        g.scheme,
      "Invalid saved table.",
    );
  }
}
/** Starting another attempt is only legal after the previous one has finished. */
export function launchCampaign(c: Campaign, pacing: Pacing): Campaign {
  validateCampaign(c);
  const stage = campaignStage(c);
  requireValue(stage < c.stages.length, "This campaign is complete.");
  requireValue(
    !c.game || ["won", "lost"].includes(c.game.phase),
    "Resume the current campaign mission first.",
  );
  requireValue(
    c.attempts.length < 1000,
    "This campaign's attempt limit has been reached.",
  );
  const setup = c.stages[stage];
  const game = newGame({
    ...c.heroes[0],
    heroes: structuredClone(c.heroes),
    ...setup,
    module: setup.modules[0],
    difficulty: c.difficulty,
    heroic: c.heroic,
    guided: true,
    pacing,
  });
  game.accountMission = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
  };
  game.campaign = { id: c.id, stage };
  return { ...c, game };
}
/** A stale replay or unrelated table cannot advance or replace a newer attempt. */
export function recordCampaignGame(c: Campaign, game: GameState): Campaign {
  if (
    game.campaign?.id !== c.id ||
    !c.game ||
    game.accountMission?.id !== c.game.accountMission?.id
  )
    return c;
  const recorded = c.attempts.some(
    (a) => a.missionId === game.accountMission!.id,
  );
  if (recorded) return c;
  const finished = game.phase === "won" || game.phase === "lost";
  const next: Campaign = {
    ...c,
    game: structuredClone(game),
    attempts: finished
      ? [
          ...c.attempts,
          {
            missionId: game.accountMission!.id,
            stage: game.campaign.stage,
            outcome: game.phase as "won" | "lost",
            round: game.round,
            seed: game.startSeed || 0,
            finishedAt: new Date().toISOString(),
          },
        ]
      : c.attempts,
  };
  validateCampaign(next);
  return next;
}
export function readCampaigns(): { campaigns: Campaign[]; warning: string } {
  try {
    const raw = readStorage(CAMPAIGNS_KEY);
    if (!raw) return { campaigns: [], warning: "" };
    const parsed: unknown = JSON.parse(raw);
    requireValue(
      Array.isArray(parsed) && parsed.length <= CAMPAIGN_LIMIT,
      "Invalid campaign library.",
    );
    const ids = new Set<string>();
    for (const c of parsed) {
      validateCampaign(c);
      requireValue(!ids.has(c.id), "Duplicate campaign save.");
      ids.add(c.id);
      if (c.game) c.game = upgradeSave(c.game);
    }
    return { campaigns: parsed, warning: "" };
  } catch {
    return {
      campaigns: [],
      warning:
        "The campaign library could not be read. Export the saved data before replacing it.",
    };
  }
}
export function writeCampaigns(campaigns: Campaign[]): boolean {
  return writeStorage(CAMPAIGNS_KEY, JSON.stringify(campaigns));
}
