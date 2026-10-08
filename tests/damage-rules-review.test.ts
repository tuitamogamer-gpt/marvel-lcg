/** Independent contracts for the Drax/Venom shared damage-port repair.
 * RRG 1.8 pp.14/35: prevention changes damage TAKEN, not damage DEALT.
 * https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf#page=35
 * Excess/overkill remain outside this repair: p.31's same-value sentence is
 * retained in the current RRG, despite older official excess-damage rulings.
 */
import { describe, expect, it } from "vitest";
import catalog from "../src/data/catalog-cards.json";
import { newGame, makePiece } from "../src/game/engine";
import {
  rocketDamageResolved,
  type RocketDamageSnapshot,
} from "../src/game/rocket";
import { draxDamageDealt, type DraxPorts } from "../src/game/drax";
import { draxPackBasicAttackDamageResolved } from "../src/game/drax-pack";
import type { Effect, GameState } from "../src/game/types";

function state(heroId: "rocket" | "drax" = "rocket"): GameState {
  // These are pure module contracts. Native Drax registration is exercised by
  // its separate acceptance suite once the host adapter is connected.
  const s = newGame({
    heroId: "rocket",
    aspect: "aggression",
    villainId: "rhino",
    seed: 19028,
    pacing: "expert",
  });
  s.heroId = heroId;
  s.phase = "player";
  s.player.form = "hero";
  s.player.hp = 3;
  s.flags.rocketSchadenTurn = `${s.round}:${s.phase}:${s.turnPlayerId}`;
  s.flags.rocketSchadenAmount = 1;
  s.attachments = [];
  return s;
}

type DealtSnapshot = RocketDamageSnapshot & { damageDealt: number };
function snapshot(fields: Partial<DealtSnapshot> = {}): DealtSnapshot {
  return {
    target: "enemy",
    damageDealt: 4,
    actualDamage: 0,
    excessDamage: 0,
    sourceIsIdentity: true,
    wasHero: true,
    ...fields,
  };
}

const blankPorts = {
  isTextBlank: (_s: GameState, p: { id: string }) => p.id === "blank-challenge",
} as Pick<DraxPorts, "isTextBlank"> as DraxPorts;

describe("printed damage words determine the response contract", () => {
  it("Schadenfreude and Challenge Accepted reference dealt damage", () => {
    expect(catalog.find((c) => c.code === "16032")!.text).toContain(
      "each time you deal any amount of damage to an enemy",
    );
    expect(catalog.find((c) => c.code === "19028")!.text).toContain(
      "After Drax deals 4 or more damage",
    );
    expect(catalog.find((c) => c.code === "19017")!.text).toContain(
      "If that attack still deals damage, ready your hero",
    );
  });
});

describe("Schadenfreude counts positive damage dealt independently of HP taken", () => {
  it.each([
    ["Tough", 4, 0],
    ["Vibration Resistance", 1, 0],
    ["partial prevention", 4, 3],
  ] as const)(
    "heals after %s without inventing excess damage",
    (_reason, dealt, taken) => {
      const effects = rocketDamageResolved(
        state(),
        snapshot({ damageDealt: dealt, actualDamage: taken }),
      );
      expect(effects).toEqual([
        {
          type: "heal",
          target: "hero",
          amount: 2,
          title: "Schadenfreude",
          mandatory: true,
        },
      ]);
    },
  );

  it("retains dealt and taken amounts in a saved continuation", () => {
    const saved = JSON.parse(
      JSON.stringify({ s: state(), damage: snapshot() }),
    ) as { s: GameState; damage: DealtSnapshot };
    expect(saved.damage).toMatchObject({ damageDealt: 4, actualDamage: 0 });
    expect(rocketDamageResolved(saved.s, saved.damage)).toHaveLength(1);
  });

  it("does not heal when Rhino's armor replaces damage to the enemy", () => {
    // Armored Rhino Suit01098 places damage on the attachment INSTEAD.
    expect(catalog.find((c) => c.code === "01098")!.text).toContain(
      "place it here instead",
    );
    expect(
      rocketDamageResolved(
        state(),
        snapshot({ damageDealt: 0, actualDamage: 0 }),
      ),
    ).toEqual([]);
  });

  it("does not credit an ally or another player for identity damage", () => {
    const s = state();
    expect(
      rocketDamageResolved(s, snapshot({ sourceIsIdentity: false })),
    ).toEqual([]);
    expect(rocketDamageResolved(s, snapshot({ playerId: "p2" }))).toEqual([]);
  });
});

describe("Drax's damage-dealt contracts", () => {
  it("discards Challenge Accepted after four dealt damage even if none is taken", () => {
    const s = state("drax");
    const challenge = makePiece(s, "19028");
    challenge.attachedTo = "enemy";
    s.attachments.push(challenge);
    const saved = JSON.parse(
      JSON.stringify({
        target: "enemy",
        attack: true,
        sourceIsDrax: true,
        damageDealt: 4,
        actualDamage: 0,
      }),
    );
    expect(draxDamageDealt(s, saved, blankPorts)).toEqual([
      {
        type: "discardPiece",
        id: challenge.id,
        mandatory: true,
        title: "Challenge Accepted",
      },
    ]);
  });

  it("requires one qualifying Drax attack on the attached enemy with active text", () => {
    const s = state("drax");
    const challenge = makePiece(s, "19028");
    challenge.attachedTo = "enemy";
    s.attachments.push(challenge);
    const attack = {
      target: "enemy",
      attack: true,
      sourceIsDrax: true,
      damageDealt: 4,
    };
    for (const change of [
      { damageDealt: 3 },
      { sourceIsDrax: false },
      { attack: false },
      { target: "other-enemy" },
    ]) {
      expect(draxDamageDealt(s, { ...attack, ...change }, blankPorts)).toEqual(
        [],
      );
    }
    challenge.id = "blank-challenge";
    expect(draxDamageDealt(s, attack, blankPorts)).toEqual([]);
  });

  it("Leading Blow readies from positive dealt damage after a saved attack", () => {
    // Official March 6, 2026: the event discards before damage; its delayed
    // readiness checks dealt damage before forced attack responses resolve.
    // https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/
    const saved: {
      packet: Effect;
      damageDealt: number;
      actualDamage: number;
    } = JSON.parse(
      JSON.stringify({
        packet: {
          type: "damage",
          target: "enemy",
          source: "hero",
          attack: true,
          basic: true,
          amount: 4,
          draxPackLeadingBlows: ["physical-leading-blow"],
        },
        damageDealt: 4,
        actualDamage: 0,
      }),
    );
    const packet = saved.packet;
    expect(saved.actualDamage).toBe(0);
    expect(
      draxPackBasicAttackDamageResolved(
        state("drax"),
        packet,
        saved.damageDealt,
      ),
    ).toEqual([{ type: "ready", target: "hero" }]);
    expect(draxPackBasicAttackDamageResolved(state("drax"), packet, 0)).toEqual(
      [],
    );
    expect(
      draxPackBasicAttackDamageResolved(
        state("drax"),
        { ...packet, draxPackLeadingBlows: [] },
        4,
      ),
    ).toEqual([]);
  });
});
