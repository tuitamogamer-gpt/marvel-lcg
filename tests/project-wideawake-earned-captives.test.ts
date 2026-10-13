import { describe, expect, it } from "vitest";
import { card, deckCodes } from "../src/game/cards.js";
import { playable } from "../src/game/engine.js";
import { paymentSources, resourcesFor } from "../src/game/payment.js";
import { activateSeat, controller, seatView } from "../src/game/team.js";
import type { GameState, Piece } from "../src/game/types.js";
import {
  base,
  choose,
  command,
  conserved,
  native,
  pay,
  physical,
  reload,
  settle,
} from "./project-wideawake-test-helpers.js";

const captiveCodes = ["32089", "32090", "32091", "32092"];

/** Uses the actual original Abduction and its actual random set-aside source. */
function rescue(s: GameState, playerId = "p1") {
  const abduction = s.sideSchemes.find((p) => p.code === "32100")!;
  expect(abduction).toBeTruthy();
  const originals = s.projectWideawake!.setAsideCaptives.map((p) => p.id);
  const next = settle(
    native(s, {
      type: "thwart",
      target: abduction.id,
      amount: abduction.counters,
      source: `hero:${playerId}`,
      actorId: playerId,
    }),
  );
  const ally = seatView(next, playerId).player.inPlay.find((p) =>
    captiveCodes.includes(p.code),
  )!;
  expect(originals).toContain(ally.id);
  expect(ally.ownerId).toBe(playerId);
  expect(controller(next, ally.id)?.id).toBe(playerId);
  return { s: next, ally };
}

/** The fixture preserves every original player card in hand while testing an
 * actual one-card discard reset, draw, and dealt encounter penalty. */
function defeatAndDraw(s: GameState, ally: Piece, playerId = "p1") {
  s = settle(
    native(s, {
      type: "damage",
      target: ally.id,
      amount: 3,
      source: "consequential",
      actorId: playerId,
    }),
  );
  const view = seatView(s, playerId);
  expect(view.player.discard.find((p) => p.id === ally.id)?.ownerId).toBe(
    playerId,
  );
  expect(s.encounter.discard.some((p) => p.id === ally.id)).toBe(false);
  expect(
    s.sideSchemes
      .find((p) => p.code === "32104")!
      .captured?.some((p) => p.id === ally.id),
  ).toBeFalsy();
  view.player.hand.push(...view.player.deck.splice(0));
  const dealt = s.encounter.dealt.filter((p) => p.dealtTo === playerId).length;
  s = settle(native(reload(s), { type: "draw", amount: 1, actorId: playerId }));
  const drawn = seatView(s, playerId).player.hand.find(
    (p) => p.id === ally.id,
  )!;
  expect(drawn).toBeTruthy();
  expect(drawn.ownerId).toBe(playerId);
  expect(s.encounter.dealt.filter((p) => p.dealtTo === playerId)).toHaveLength(
    dealt + 1,
  );
  expect(physical(s).filter((p) => p.id === ally.id)).toHaveLength(1);
  return { s, ally: drawn };
}

describe("Project Wideawake earned Captives in native player zones", () => {
  it("real p2 rescue, nonattack defeat, discard recycle/draw and PLAY cost2 preserve the physical Captive", () => {
    let { s, ally } = rescue(base("spider_man", true), "p2");
    activateSeat(s, "p1");
    s = settle(command(s, { type: "END_TURN" }));
    expect(s.turnPlayerId).toBe("p2");
    ({ s, ally } = defeatAndDraw(s, ally, "p2"));
    activateSeat(s, "p2");
    const originalId = ally.id;
    const energy = s.player.hand.find((p) => p.code === "01088")!;
    expect(energy, "actual original double resource").toBeTruthy();
    const buffer = s.player.hand.findIndex(
      (p) => p.id !== ally.id && p.id !== energy.id,
    );
    s.player.deck.push(...s.player.hand.splice(buffer, 1));
    expect(card(ally).faction_code).toBe("encounter");
    expect(card(ally).cost).toBe(2);
    expect(playable(s, ally)).toBeNull();
    s = command(reload(s), { type: "PLAY", id: originalId });
    expect(s.prompt).toMatchObject({ kind: "payment", cost: 2 });
    s = settle(pay(s, [energy]));
    expect(s.player.inPlay.find((p) => p.id === originalId)).toMatchObject({
      code: ally.code,
      ownerId: "p2",
      damage: 0,
      exhausted: false,
    });
    expect(controller(s, originalId)?.id).toBe("p2");
    expect(s.player.discard.some((p) => p.id === energy.id)).toBe(true);
    expect(s.encounter.discard.some((p) => p.id === originalId)).toBe(false);
    expect(card(ally).faction_code).toBe("encounter");
    conserved(s);
  });

  it("a recycled earned Captive supplies its printed wild for Jubilee's actual typed-energy Action", () => {
    let { s, ally } = rescue(base());
    ({ s, ally } = defeatAndDraw(s, ally));
    const originalId = ally.id;
    const mall = s.sideSchemes.find((p) => p.code === "32088a")!;
    s = native(s, {
      type: "thwart",
      target: mall.id,
      amount: mall.counters,
      source: "hero",
    });
    if (s.prompt?.title === "Forced responses") {
      const effect =
        s.prompt.options.find((o) => /Mutants at the Mall/.test(o.label)) ||
        s.prompt.options[0];
      s = choose(s, effect.id);
    }
    if (/Search encounter cards/i.test(s.prompt?.title || "")) {
      const markIV = s.prompt!.options.find((o) => o.image === "32093")!;
      expect(markIV).toBeTruthy();
      s = choose(s, markIV.id);
    }
    s = settle(s);
    const jubilee = s.player.inPlay.find((p) => p.id === mall.id)!;
    expect(jubilee.code).toBe("32088b");
    expect(jubilee.ownerId).toBeUndefined();
    const earned = s.player.hand.find((p) => p.id === originalId)!;
    expect(resourcesFor(s, earned)).toEqual(["wild"]);
    expect(
      paymentSources(s).find((p) => p.id === originalId)?.resources,
    ).toEqual(["wild"]);
    const buffer = s.player.hand.findIndex((p) => p.id !== earned.id);
    s.player.deck.push(...s.player.hand.splice(buffer, 1));
    s.villain.tough = false;
    s.villain.toughCards = 0;
    const hp = s.villain.hp;
    s = command(s, {
      type: "ABILITY",
      id: jubilee.id,
      action: `wideawake-jubilee:${jubilee.id}`,
    });
    s = choose(s, s.villain.id);
    expect(s.prompt).toMatchObject({
      kind: "payment",
      cost: 1,
      requirements: ["energy"],
    });
    s = settle(pay(s, [earned], "energy"));
    expect(s.villain.hp).toBe(hp - 2);
    expect(s.player.discard.find((p) => p.id === originalId)).toMatchObject({
      ownerId: "p1",
      code: ally.code,
    });
    expect(s.encounter.discard.some((p) => p.id === originalId)).toBe(false);
    expect(s.player.inPlay.find((p) => p.id === jubilee.id)?.exhausted).toBe(
      true,
    );
    conserved(s);
  });

  it("immutable encounter printings stay out of starting decks while the four actual set-aside Captives remain available", () => {
    const s = base();
    for (const code of captiveCodes) {
      expect(card(code)).toMatchObject({
        faction_code: "encounter",
        type_code: "ally",
        cost: 2,
        resource_wild: 1,
      });
      expect(deckCodes("spider_man", "justice")).not.toContain(code);
      expect(deckCodes("colossus", "protection")).not.toContain(code);
    }
    expect(
      s.projectWideawake!.setAsideCaptives.map((p) => p.code).sort(),
    ).toEqual(captiveCodes);
    expect(s.player.deck).toHaveLength(40);
    expect(s.player.deck.some((p) => captiveCodes.includes(p.code))).toBe(
      false,
    );
    conserved(s);
  });

  it("the native control-transfer port applies the scenario player-back ownership exception", () => {
    let { s, ally } = rescue(base("spider_man", true));
    const originalId = ally.id;
    expect(ally.ownerId).toBe("p1");
    // Exercise the existing shared transfer port through its native queue
    // dispatcher. A manual zone splice would bypass the take-control rule.
    s = settle(
      native(reload(s), {
        type: "hulk-pack:control-to",
        id: originalId,
        playerId: "p2",
        actorId: "p1",
      }),
    );
    expect(controller(s, originalId)?.id).toBe("p2");
    expect(
      seatView(s, "p2").player.inPlay.find((p) => p.id === originalId)?.ownerId,
    ).toBe("p2");
    expect(
      seatView(s, "p1").player.inPlay.some((p) => p.id === originalId),
    ).toBe(false);
    s = settle(
      native(s, {
        type: "damage",
        target: originalId,
        amount: 3,
        source: "consequential",
        actorId: "p2",
      }),
    );
    expect(
      seatView(s, "p2").player.discard.find((p) => p.id === originalId),
    ).toMatchObject({ ownerId: "p2", code: ally.code });
    expect(
      seatView(s, "p1").player.discard.some((p) => p.id === originalId),
    ).toBe(false);
    expect(s.encounter.discard.some((p) => p.id === originalId)).toBe(false);
    conserved(s);
  });
});
