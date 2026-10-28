import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAMPAIGNS_KEY,
  campaignStage,
  createCampaign,
  defaultCampaignStage,
  launchCampaign,
  readCampaigns,
  recordCampaignGame,
  validateCampaign,
  writeCampaigns,
} from "../src/campaigns";
import { dispatch } from "../src/game/engine";
import { card } from "../src/game/cards";
import { reload } from "./dv-test-helpers";
import type { Campaign } from "../src/campaigns";
const create = () =>
  createCampaign({
    name: "Avengers",
    heroes: [{ heroId: "spider_man", aspect: "justice" }],
    stages: ["rhino", "klaw"].map(defaultCampaignStage),
    difficulty: "standard",
  });
const complete = (c: Campaign, outcome: "won" | "lost") =>
  recordCampaignGame(c, { ...reload(c.game!), phase: outcome, review: null });
afterEach(() => vi.unstubAllGlobals());
describe("saved standalone campaigns", () => {
  it("snapshots legal decks and modules without sharing mutable setup objects", () => {
    const c = create();
    expect(c.heroes[0].deckCards).toHaveLength(40);
    const launched = launchCampaign(c, "guided");
    expect(launched.game?.campaign).toEqual({ id: c.id, stage: 0 });
    expect(launched.game?.players[0].deckCards).toEqual(c.heroes[0].deckCards);
    launched.game!.players[0].deckCards!.reverse();
    expect(c.game).toBeNull();
    expect(launched.game!.players[0].deckCards).not.toEqual(
      c.heroes[0].deckCards,
    );
  });
  it("persists an exact mulligan and current deck order, then resumes native commands", () => {
    const c = launchCampaign(create(), "guided");
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (k: string, v: string) => data.set(k, v),
      getItem: (k: string) => data.get(k) || null,
    });
    expect(writeCampaigns([c])).toBe(true);
    const loaded = readCampaigns();
    expect(loaded.warning).toBe("");
    expect(loaded.campaigns[0].game).toEqual(c.game);
    const after = dispatch(loaded.campaigns[0].game!, {
      type: "MULLIGAN",
      ids: [],
    });
    expect(after.error).toBeUndefined();
    const saved = recordCampaignGame(loaded.campaigns[0], after);
    expect(saved.game!.player.hand).toEqual(after.player.hand);
    expect(saved.attempts).toEqual([]);
    expect(() => launchCampaign(saved, "expert")).toThrow(/Resume/);
  });
  it("keeps losses at the same stage and advances exactly once per won mission", () => {
    let c = launchCampaign(create(), "expert");
    c = complete(c, "lost");
    expect(campaignStage(c)).toBe(0);
    const old = c.game!;
    c = launchCampaign(c, "expert");
    expect(c.game!.accountMission!.id).not.toBe(old.accountMission!.id);
    expect(recordCampaignGame(c, old)).toBe(c);
    c = complete(c, "won");
    expect(campaignStage(c)).toBe(1);
    expect(recordCampaignGame(c, reload(c.game!))).toBe(c);
    c = launchCampaign(c, "expert");
    expect(c.game!.villainId).toBe("klaw");
    expect(c.game!.players[0].deckCards).toEqual(c.heroes[0].deckCards);
    c = complete(c, "won");
    expect(campaignStage(c)).toBe(2);
    expect(c.attempts.map((a) => a.outcome)).toEqual(["lost", "won", "won"]);
    expect(() => launchCampaign(c, "expert")).toThrow(/complete/);
  });
  it("does not accept changed heroes, decks, scenario or difficulty in a checkpoint", () => {
    const c = launchCampaign(create(), "expert");
    for (const mutate of [
      (g: NonNullable<Campaign["game"]>) => {
        g.villainId = "ultron";
      },
      (g: NonNullable<Campaign["game"]>) => {
        g.difficulty = "expert";
      },
      (g: NonNullable<Campaign["game"]>) => {
        g.players[0].deckCards!.pop();
      },
      (g: NonNullable<Campaign["game"]>) => {
        g.campaign!.stage = 1;
      },
    ]) {
      const g = reload(c.game!);
      mutate(g);
      expect(() => recordCampaignGame(c, g)).toThrow();
    }
    expect(c.attempts).toEqual([]);
  });
  it("preserves independent campaigns while switching tables", () => {
    const a = launchCampaign(create(), "guided"),
      b = launchCampaign(create(), "expert");
    expect(recordCampaignGame(a, b.game!)).toBe(a);
    expect(a.game!.accountMission!.id).not.toBe(b.game!.accountMission!.id);
  });
  it("handles blocked storage without reporting a successful save", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("quota");
      },
    });
    expect(readCampaigns().campaigns).toEqual([]);
    expect(writeCampaigns([create()])).toBe(false);
  });
  it.each(["not json", "{}", '[{"version":99}]'])(
    "keeps malformed saves available for recovery: %s",
    (raw) => {
      const setItem = vi.fn();
      vi.stubGlobal("localStorage", { getItem: () => raw, setItem });
      expect(readCampaigns()).toMatchObject({
        campaigns: [],
        warning: expect.stringContaining("could not be read"),
      });
      expect(setItem).not.toHaveBeenCalled();
    },
  );
  it("rejects duplicate results, skipped missions and unsupported scenarios", () => {
    const c = complete(launchCampaign(create(), "expert"), "won");
    const duplicate = structuredClone(c);
    duplicate.attempts.push(duplicate.attempts[0]);
    expect(() => validateCampaign(duplicate)).toThrow();
    const skipped = structuredClone(c);
    skipped.attempts[0].stage = 1;
    expect(() => validateCampaign(skipped)).toThrow();
    expect(() => defaultCampaignStage("taskmaster")).toThrow(/implemented/);
    expect(() =>
      createCampaign({
        ...create(),
        stages: [
          {
            villainId: "crossbones",
            modules: ["hydra_assault", "hydra_assault", "weap_master"],
          },
        ],
      }),
    ).toThrow(/distinct/);
  });
  it("retains all three original Crossbones modules and Absorbing Man's setup", () => {
    const c = create();
    c.stages = [
      defaultCampaignStage("crossbones"),
      defaultCampaignStage("absorbing_man"),
    ];
    const crossbones = launchCampaign(c, "expert");
    expect(crossbones.game!.modules).toEqual([
      "hydra_assault",
      "weap_master",
      "legions_of_hydra",
    ]);
    const next = launchCampaign(complete(crossbones, "won"), "expert");
    expect(next.game!.absorbingMan?.delay).toBe(0);
    expect(next.game!.environments).toHaveLength(1);
    expect(card(next.game!.environments![0]).type_code).toBe("environment");
  });
  it("does not discard duplicate library IDs silently", () => {
    const c = create();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) =>
        k === CAMPAIGNS_KEY ? JSON.stringify([c, c]) : null,
    });
    expect(readCampaigns().warning).not.toBe("");
  });
});
